import { useCallback, useMemo, useState } from 'react';
import { FileText, Paperclip, Plus, Send } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { headlines } from '../../../data/core';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import {
  TASK_STATES, TASK_SEVS, TASK_STATUS_COLOR, EVIDENCE_STATES, taskState,
  type ComplyTask, type EvidenceItem, type TaskStatus, type TaskSev,
} from '../../../data/modules/comply';
import { Card, Badge, Btn, Callout, SevBadge, StatusBadge, cap } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { DataTable } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { MetricBand, Facet, StateKey, RequestEvidenceModal } from '../parts';
import { useComplyData, useWorkspaceData, EV_HEX } from '../useComply';
import { useQuery, useDeepLink, useLocal, SectionHead, Toggles, CountLine, RecordDrawer, RSec, LinkedRecords, ago, ahead, type LocalEvidence } from './shared';

const tone = MODULE_BY_ID.comply.tone;
const STATUSES: TaskStatus[] = ['Awaiting evidence', 'Completed — evidence approved', 'Evidence expiring', 'Evidence in review', 'Evidence submitted', 'More information requested', 'Not applicable'];
const EV_LABEL = Object.fromEntries(EVIDENCE_STATES.map((s) => [s.key, s.label])) as Record<string, string>;
const docsOf = (e: EvidenceItem | LocalEvidence) => ('docs' in e ? e.docs.length : 1 + (parseInt(e.hash.slice(0, 2), 16) % 3));
const commentOf = (e: EvidenceItem | LocalEvidence) => ('comment' in e && e.comment ? e.comment : e.title.replace(/^[^:]+:\s*/, ''));

export default function TasksSection() {
  const { customer: c, tenantId, toast } = useApp();
  const { p, set, go } = useQuery();
  const h = headlines(c, tenantId);
  const { controls, tasks, evidence: baseEvidence, pipeline } = useComplyData();
  const { drive } = useWorkspaceData();
  const local = useLocal();
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = grc ? `${grc.vendor} ${grc.product}` : 'HexaComply';

  const evidence: (EvidenceItem | LocalEvidence)[] = useMemo(() => [...local.evidence, ...baseEvidence], [local.evidence, baseEvidence]);
  const evByTask = useMemo(() => {
    const m = new Map<string, (EvidenceItem | LocalEvidence)[]>();
    evidence.forEach((e) => m.set(e.taskId, [...(m.get(e.taskId) ?? []), e]));
    return m;
  }, [evidence]);
  const ctlById = useMemo(() => new Map(controls.map((x) => [x.id, x])), [controls]);

  const view = p('view') === 'evidence' ? 'evidence' : 'tasks';
  const fw = p('framework') ?? 'all';
  const owner = p('owner') ?? 'all';
  const statusP = p('status') ?? 'all';
  const isGroup = (TASK_STATES as readonly string[]).includes(statusP);
  const sev = (p('sev') as TaskSev | null) ?? 'all';
  const overdue = p('overdue') === '1';
  const naOnly = p('scope') === 'na';
  const control = p('control');
  const evState = p('state') ?? 'all';
  const expiring = p('expiring');
  const inFw = (t: { fwId?: string; fwShort?: string }) => fw === 'all' || t.fwId === fw || (!t.fwId && t.fwShort === c.frameworks.find((f) => f.id === fw)?.short);

  const owners = useMemo(() => [...new Set(tasks.map((t) => t.owner))].sort(), [tasks]);
  const taskRows = tasks.filter((t) => inFw(t) && (owner === 'all' || t.owner === owner) && (statusP === 'all' || (isGroup ? taskState(t.status) === statusP : t.status === statusP)) && (sev === 'all' || t.sev === sev) && (!overdue || t.overdue) && (!naOnly || t.status === 'Not applicable') && (!control || t.controlId === control));
  const ctlTasks = control ? new Set(tasks.filter((t) => t.controlId === control).map((t) => t.id)) : null;
  const evRows = evidence.filter((e) => {
    const fwOk = fw === 'all' || e.fwShort === c.frameworks.find((f) => f.id === fw)?.short;
    const stOk = evState === 'all' || e.state === evState || (evState === 'moving' && ['draft', 'submitted', 'processing'].includes(e.state)) || (evState === 'failing' && ['rejected', 'expired', 'failed'].includes(e.state));
    return fwOk && stOk && (!expiring || (e.state === 'approved' && e.expiresDays <= Number(expiring))) && (!ctlTasks || ctlTasks.has(e.taskId));
  });
  const filtered = fw !== 'all' || owner !== 'all' || statusP !== 'all' || sev !== 'all' || overdue || naOnly || !!control || evState !== 'all' || !!expiring;
  const clear = () => set({ framework: null, owner: null, status: null, sev: null, overdue: null, scope: null, control: null, state: null, expiring: null, id: null });

  const [open, setOpen] = useState<ComplyTask | null>(null);
  const [evOpen, setEvOpen] = useState<EvidenceItem | LocalEvidence | null>(null);
  const [adding, setAdding] = useState<ComplyTask | null>(null);
  const [req, setReq] = useState<ComplyTask | null>(null);
  const matchT = useCallback((t: ComplyTask, id: string) => t.id === id || t.ref === id, []);
  const matchE = useCallback((e: EvidenceItem | LocalEvidence, id: string) => e.id === id, []);
  useDeepLink(tasks, matchT, setOpen);
  useDeepLink(evidence, matchE, setEvOpen);

  const done = tasks.filter((t) => taskState(t.status) === 'Compliant').length;
  const awaiting = tasks.filter((t) => t.status === 'Awaiting evidence').length;
  const approved = evidence.filter((e) => e.state === 'approved').length;
  const ctl = control ? ctlById.get(control) : undefined;

  return (
    <>
      <SectionHead
        intro={<>Tasks are how a framework is satisfied — a task advances only through evidence submitted against it, and its status is derived by HexaComply rather than set here. Open a task to attach evidence to it. {pipeline.autoPct}% of evidence arrives automatically from connected tools.</>}
      />
      <MetricBand tone={tone} items={[
        { ac: 'Tasks', word: 'On the register', value: fmtNum(tasks.length), unit: `${fmtNum(awaiting)} awaiting evidence`, active: view === 'tasks' && !filtered, onClick: () => { clear(); set({ view: null }); }, source: src },
        { ac: 'Completed', word: 'Evidence approved', value: fmtNum(done), unit: `of ${fmtNum(tasks.length)}`, gauge: (done / Math.max(1, tasks.length)) * 100, active: statusP === 'Compliant', onClick: () => set({ view: null, status: 'Compliant', overdue: null }), source: src },
        { ac: 'Overdue', word: 'Past due', value: h.comply.overdueTasks, unit: 'tasks', color: 'var(--bad)', active: overdue, onClick: () => set({ view: null, overdue: '1', status: null }), source: src },
        { ac: 'Evidence', word: 'Items', value: fmtNum(evidence.length), unit: `${fmtNum(approved)} approved`, gauge: (approved / Math.max(1, evidence.length)) * 100, active: view === 'evidence' && evState === 'all', onClick: () => set({ view: 'evidence', state: null }), source: `${src} evidence ledger` },
        { ac: 'Waiting on you', word: 'More info', value: fmtNum(evidence.filter((e) => e.state === 'more_info').length), unit: 'evidence items', color: 'var(--sev-medium)', active: evState === 'more_info', onClick: () => set({ view: 'evidence', state: 'more_info' }), source: src },
      ]} />

      {ctl && <Callout color={tone}>Filtered to control <b>{ctl.fwShort} {ctl.ref} · {ctl.name}</b>. <button type="button" className="link" onClick={() => go('frameworks', { framework: ctl.fwId, id: ctl.id })}>Open the control</button> · <button type="button" className="link" onClick={() => set({ control: null })}>Show all</button></Callout>}

      <Card flush>
        <div className="comply-views">
          <button type="button" className={`comply-view ${view === 'tasks' ? 'on' : ''}`} onClick={() => set({ view: null, state: null, expiring: null })}>Tasks<em>{fmtNum(taskRows.length)}</em></button>
          <button type="button" className={`comply-view ${view === 'evidence' ? 'on' : ''}`} onClick={() => set({ view: 'evidence', status: null, overdue: null })}>Evidence<em>{fmtNum(evRows.length)}</em></button>
        </div>
        <div className="comply-facets">
          <Facet label="Framework" value={fw} onChange={(v) => set({ framework: v })} options={c.frameworks.map((f) => ({ id: f.id, label: f.short }))} />
          {view === 'tasks' ? (
            <>
              <Facet label="Owner" value={owner} onChange={(v) => set({ owner: v })} options={owners.map((o) => ({ id: o, label: o, n: tasks.filter((t) => inFw(t) && t.owner === o).length }))} />
              <Facet label="Status" value={isGroup ? 'all' : statusP} onChange={(v) => set({ status: v })} options={STATUSES.map((s) => ({ id: s as string, label: s, n: tasks.filter((t) => inFw(t) && t.status === s).length }))} />
              <Facet label="State" value={isGroup ? statusP : 'all'} onChange={(v) => set({ status: v })} options={TASK_STATES.map((s) => ({ id: s as string, label: s, n: tasks.filter((t) => inFw(t) && taskState(t.status) === s).length }))} />
              {sev !== 'all' && <Facet label="Severity" value={sev} onChange={(v) => set({ sev: v })} options={TASK_SEVS.map((s) => ({ id: s, label: cap(s) }))} />}
              <Toggles label="Scope" items={[
                { label: 'Not applicable only', on: naOnly, onChange: (on) => set({ scope: on ? 'na' : null }), n: tasks.filter((t) => inFw(t) && t.status === 'Not applicable').length },
                { label: 'Overdue only', on: overdue, onChange: (on) => set({ overdue: on ? '1' : null }), n: tasks.filter((t) => inFw(t) && t.overdue).length },
              ]} />
            </>
          ) : (
            <>
              <div className="comply-facet">
                <span className="comply-facet-l">State</span>
                <div className="comply-keys" style={{ margin: 0, padding: 0, border: 0 }}>
                  {EVIDENCE_STATES.map((s) => <StateKey key={s.key} color={EV_HEX[s.key]} label={s.label} n={fmtNum(evidence.filter((e) => e.state === s.key).length)} on={evState === s.key} onClick={() => set({ state: evState === s.key ? null : s.key })} />)}
                </div>
              </div>
              <Toggles label="Lifecycle" items={[
                { label: 'Still moving', on: evState === 'moving', onChange: (on) => set({ state: on ? 'moving' : null }) },
                { label: 'Rejected, expired or failed', on: evState === 'failing', onChange: (on) => set({ state: on ? 'failing' : null }) },
                { label: 'Approved, expiring in 30 days', on: !!expiring, onChange: (on) => set({ expiring: on ? '30' : null }), n: evidence.filter((e) => e.state === 'approved' && e.expiresDays <= 30).length },
              ]} />
            </>
          )}
        </div>

        {view === 'tasks' ? (
          <>
            <CountLine filtered={filtered} onClear={clear}>{fmtNum(taskRows.length)} of {fmtNum(tasks.length)} tasks{isGroup ? ` · state ${statusP}` : ''}{sev !== 'all' ? ` · ${sev}` : ''} · status derived from evidence, not set by hand</CountLine>
            <DataTable<ComplyTask>
              rows={taskRows}
              rowKey={(t) => t.id}
              onRowClick={setOpen}
              search={(t) => `${t.ref} ${t.title} ${t.owner} ${t.fwShort}`}
              searchPlaceholder="Search tasks…"
              pageSize={25}
              initialSort={overdue ? { key: 'due', dir: 'asc' } : undefined}
              columns={[
                { key: 'ref', header: 'Task', sort: (t) => t.ref, render: (t) => <><div className="t-main" style={{ maxWidth: 400, whiteSpace: 'normal' }}><span className="mono" style={{ fontSize: 11.5, marginRight: 6 }}>{t.ref}</span>{t.title}</div><div className="t-sub">{t.fwShort} · {t.id}</div></> },
                { key: 'owner', header: 'Owner', sort: (t) => t.owner, render: (t) => <span className="t-sub">{t.owner}</span> },
                { key: 'sev', header: 'Severity', sort: (t) => TASK_SEVS.indexOf(t.sev), render: (t) => <SevBadge sev={t.sev} /> },
                { key: 'ev', header: 'Evidence', align: 'right', sort: (t) => (evByTask.get(t.id)?.length ?? 0), render: (t) => <span className="num">{evByTask.get(t.id)?.length ?? 0}</span> },
                { key: 'status', header: 'Status', sort: (t) => t.status, render: (t) => <><StatusBadge value={t.status} map={TASK_STATUS_COLOR} />{t.overdue && <div className="t-sub" style={{ color: 'var(--bad)', fontWeight: 700 }}>{-t.dueDays} d overdue</div>}</> },
                { key: 'app', header: 'Applicability', sort: (t) => (t.status === 'Not applicable' ? 1 : 0), render: (t) => (t.status === 'Not applicable' ? <Badge color={t.decidedBy === 'HexaShield override' ? 'var(--m-view)' : 'var(--sev-info)'}>{t.decidedBy ?? 'Not applicable'}</Badge> : <span className="t-sub">In scope</span>) },
                { key: 'due', header: 'Updated', align: 'right', sort: (t) => (t.overdue ? t.dueDays - 1000 : t.updatedDays), render: (t) => <span className="t-sub">{ago(t.updatedDays)}</span> },
              ]}
            />
          </>
        ) : (
          <>
            <CountLine filtered={filtered} onClear={clear}>{fmtNum(evRows.length)} of {fmtNum(evidence.length)} evidence items · every item is hashed on receipt · {pipeline.autoPct}% collected by connectors</CountLine>
            <DataTable<EvidenceItem | LocalEvidence>
              rows={evRows}
              rowKey={(e) => e.id}
              onRowClick={setEvOpen}
              search={(e) => `${e.id} ${e.title} ${e.source} ${e.controlRef} ${e.fwShort}`}
              searchPlaceholder="Search evidence, sources, controls…"
              pageSize={25}
              columns={[
                { key: 'id', header: 'Evidence', sort: (e) => e.id, render: (e) => <><div className="t-main" style={{ maxWidth: 420, whiteSpace: 'normal' }}>{commentOf(e)}</div><div className="t-sub">{e.id} · {e.controlRef} · {e.fwShort}</div></> },
                { key: 'src', header: 'Source', sort: (e) => e.source, render: (e) => <span className="row" style={{ gap: 6 }}>{e.automated ? <Badge color="var(--good)">Connector</Badge> : <Badge>Manual</Badge>}<span className="t-sub">{e.source}</span></span> },
                { key: 'docs', header: 'Documents', align: 'right', render: (e) => <span className="num">{docsOf(e)}</span> },
                { key: 'state', header: 'State', sort: (e) => e.state, render: (e) => <Badge color={EV_HEX[e.state]} dot>{EV_LABEL[e.state]}</Badge> },
                { key: 'col', header: 'Submitted', align: 'right', sort: (e) => -e.collectedDays, render: (e) => <span className="t-sub">{e.collectedDays === 0 ? 'today' : ago(e.collectedDays)}</span> },
                { key: 'exp', header: 'Expires', align: 'right', sort: (e) => e.expiresDays, render: (e) => <span className="t-sub" style={{ color: e.expiresDays < 0 ? 'var(--bad)' : e.expiresDays <= 30 ? 'var(--sev-medium)' : undefined }}>{e.expiresDays < 0 ? `expired ${ago(-e.expiresDays)}` : ahead(e.expiresDays)}</span> },
              ]}
            />
          </>
        )}
      </Card>

      {open && (() => {
        const t = open;
        const x = ctlById.get(t.controlId);
        const evs = evByTask.get(t.id) ?? [];
        const term = t.kind === 'Policy' || t.kind === 'Review' ? 365 : 180;
        const na = t.status === 'Not applicable';
        const close = () => { setOpen(null); set({ id: null }); };
        return (
          <RecordDrawer
            id={t.ref}
            recordId={`task ${t.id.toLowerCase()}`}
            updatedDays={t.updatedDays}
            title={t.title}
            badges={<><StatusBadge value={t.status} map={TASK_STATUS_COLOR} /><SevBadge sev={t.sev} /><Badge color={tone}>{t.fwShort}</Badge>{t.overdue && <Badge color="var(--bad)" solid>{-t.dueDays} d overdue</Badge>}</>}
            onClose={close}
            actions={!na ? <>
              {taskState(t.status) !== 'Compliant' && <Btn onClick={() => setReq(t)}><Send /> Request from owner</Btn>}
              <Btn primary color={tone} onClick={() => setAdding(t)}><Plus /> Add evidence</Btn>
            </> : undefined}
          >
            <RSec title="Description">
              <p className="cmp-desc">{t.title} to satisfy {t.controlRef}{x ? ` ${x.name}` : ''} ({t.fwShort}). Upload the artefact that proves it — an export, a signed record or a screenshot — or let a connected tool supply it.</p>
            </RSec>
            <Callout>The status of this task is derived from its evidence: it moves to completed only when HexaComply approves evidence against it, and back to expiring when that evidence ages out.</Callout>
            <RSec title="Detail" rows={[
              ['Owner', `${t.owner} · ${t.ownerEmail}`],
              ['Severity', <SevBadge key="s" sev={t.sev} />],
              ['Expiration term', `${term} days`],
              ['Controls', x ? <button key="c" type="button" className="link" onClick={() => go('frameworks', { framework: x.fwId, id: x.id })}>{x.ref} · {x.name}</button> : t.controlRef],
              ['Due', na || taskState(t.status) === 'Compliant' ? '—' : t.overdue ? <span key="d" style={{ color: 'var(--bad)', fontWeight: 700 }}>{-t.dueDays} days overdue</span> : ahead(t.dueDays)],
              ['Tenant', c.tenants.find((k) => k.id === t.tenant)?.name ?? '—'],
              ['Active', na ? 'No' : 'Yes'],
              ['Kind', t.kind],
            ]} />
            <RSec title="Applicability" rows={[
              ['In scope', na ? 'No' : 'Yes'],
              ['Source', na ? t.decidedBy ?? 'Client override' : 'Platform default'],
              ['Justification', na ? x?.justification : 'Inherited from the control'],
            ]} />
            <RSec title={`Evidence for this task (${evs.length})`}>
              <div className="cmp-list">
                {evs.slice(0, 10).map((e) => (
                  <button key={e.id} type="button" className="cmp-list-row" onClick={() => setEvOpen(e)}>
                    <span><b>{e.id} · {commentOf(e)}</b><span className="s">{docsOf(e)} document{docsOf(e) === 1 ? '' : 's'} · submitted {e.collectedDays === 0 ? 'today' : ago(e.collectedDays)} · {e.expiresDays < 0 ? `expired ${ago(-e.expiresDays)}` : `expires ${ahead(e.expiresDays)}`}</span></span>
                    <Badge color={EV_HEX[e.state]} dot>{EV_LABEL[e.state]}</Badge>
                  </button>
                ))}
                {evs.length === 0 && <span className="cmp-none">No evidence submitted yet.</span>}
                {evs.length > 10 && <button type="button" className="link" onClick={() => { close(); set({ view: 'evidence', control: t.controlId }); }}>All {evs.length} items for this control →</button>}
              </div>
            </RSec>
            <LinkedRecords items={[
              ...(x ? [{ label: `Control ${x.ref}`, sub: `${x.fwShort} · ${x.name}`, onClick: () => go('frameworks', { framework: x.fwId, id: x.id }) }] : []),
              { label: 'Evidence files in Drive', sub: 'Drive › Evidences', onClick: () => go('drive', { folder: 'f-ev' }) },
              { label: `Other tasks owned by ${t.owner}`, count: tasks.filter((k) => k.owner === t.owner).length, onClick: () => { close(); set({ owner: t.owner, view: null, status: null, overdue: null, control: null }); } },
            ]} />
          </RecordDrawer>
        );
      })()}

      {evOpen && (() => {
        const e = evOpen;
        const t = tasks.find((k) => k.id === e.taskId);
        return (
          <RecordDrawer id={e.id} recordId={`evidence ${e.hash.slice(0, 8)}`} updatedDays={e.collectedDays} title={commentOf(e)}
            badges={<><Badge color={EV_HEX[e.state]} dot>{EV_LABEL[e.state]}</Badge>{e.automated ? <Badge color="var(--good)">Connector snapshot</Badge> : <Badge>Manual</Badge>}<Badge color={tone}>{e.fwShort}</Badge></>}
            onClose={() => { setEvOpen(null); set({ id: null }); }}>
            <RSec title="Evidence" rows={[
              ['State', EV_LABEL[e.state]], ['Source', e.source], ['Control', `${e.controlRef} · ${e.fwShort}`], ['Task', t ? `${t.ref} · ${t.title}` : e.taskId],
              ['Submitted', e.collectedDays === 0 ? 'Today' : ago(e.collectedDays)], ['Expires', e.expiresDays < 0 ? `Expired ${ago(-e.expiresDays)}` : ahead(e.expiresDays)],
              ['Documents', 'docs' in e ? e.docs.join(', ') : `${docsOf(e)} file${docsOf(e) === 1 ? '' : 's'}`], ['SHA-256 (prefix)', <span key="h" className="mono">{e.hash}…</span>],
            ]} note="Evidence is hashed on receipt and the hash is anchored in the audit ledger, so an auditor can verify the file has not changed since collection. Review and approval are HexaComply's." />
            <LinkedRecords items={[
              ...(t ? [{ label: `Task ${t.ref}`, sub: t.title, onClick: () => { setEvOpen(null); setOpen(t); } }] : []),
              { label: 'Evidence files in Drive', sub: 'Drive › Evidences', onClick: () => go('drive', { folder: 'f-ev' }) },
            ]} />
          </RecordDrawer>
        );
      })()}

      {adding && (
        <AddEvidenceModal task={adding} files={[...drive, ...local.drive].filter((d) => d.kind === 'file')} folders={[...drive, ...local.drive].filter((d) => d.kind === 'folder')}
          onClose={() => setAdding(null)}
          onSave={(docs, comment) => {
            const n = local.evidence.length + 1;
            local.addEvidence({
              id: `EV-N${String(n).padStart(4, '0')}`, title: `Manual upload: ${comment || docs[0]}`, source: 'Manual upload', automated: false, state: 'draft',
              taskId: adding.id, controlRef: adding.controlRef, fwShort: adding.fwShort, collectedDays: 0, expiresDays: adding.kind === 'Policy' || adding.kind === 'Review' ? 365 : 180,
              hash: Math.random().toString(16).slice(2, 14), comment: comment || `Evidence for ${adding.ref}`, docs,
            });
            toast(`Draft evidence saved against ${adding.ref} with ${docs.length} document${docs.length === 1 ? '' : 's'} · HexaComply will review it`);
            setAdding(null);
          }} />
      )}
      {req && <RequestEvidenceModal what={req.title} owner={req.owner} ownerEmail={req.ownerEmail} control={req.controlRef} onClose={() => setReq(null)} />}
    </>
  );
}

function AddEvidenceModal({ task, files, folders, onClose, onSave }: { task: ComplyTask; files: import('../../../data/modules/complyRegisters').DriveItem[]; folders: import('../../../data/modules/complyRegisters').DriveItem[]; onClose: () => void; onSave: (docs: string[], comment: string) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [q, setQ] = useState('');
  const fname = (id: string | null) => (id ? folders.find((f) => f.id === id)?.name ?? '—' : 'Drive root');
  const list = files.filter((f) => !q || `${f.name} ${f.filename}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="New evidence" sub={<>Against <b>{task.ref} · {task.title}</b>. It saves as a draft; review and approval are HexaComply's.</>} onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={tone} disabled={!sel.length} onClick={() => onSave(sel, comment.trim())}><Paperclip /> Save draft</Btn></>}>
      <div className="cmp-f">
        <span>Documents · pick from Drive ({sel.length} selected)</span>
        <input className="input" placeholder="Filter documents…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="cmp-docpick">
        {list.map((f) => {
          const failed = f.status === 'failed';
          const scanning = f.status === 'scanning';
          const on = sel.includes(f.name);
          return (
            <label key={f.id} className={`${failed || scanning ? 'dis' : ''} ${on ? 'on' : ''}`}>
              <input type="checkbox" disabled={failed || scanning} checked={on} onChange={() => setSel((s) => (on ? s.filter((x) => x !== f.name) : [...s, f.name]))} />
              <span><FileText size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{f.name}<span className="s">{f.filename} · {fmtNum(f.sizeKb ?? 0)} KB · {fname(f.parent)}</span></span>
              {failed ? <Badge color="var(--bad)">Processing failed</Badge> : scanning ? <Badge color="var(--sev-medium)">Scanning</Badge> : <span className="cmp-ftype">{f.type}</span>}
            </label>
          );
        })}
      </div>
      <label className="cmp-f">
        <span>Comment</span>
        <textarea className="input" rows={3} style={{ height: 'auto', padding: 8 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What does this evidence show, and for which period?" />
      </label>
    </Modal>
  );
}
