import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, PencilLine, Send, RefreshCw, ArrowRight, Check } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { headlines, loops, loopSummary } from '../../data/core';
import { scopedConnectors, isStale, tenantName } from '../../data/customers';
import { MODULE_BY_ID } from '../../modules/registry';
import {
  soaRows, TASK_STATES, TASK_SEVS, TASK_STATUS_COLOR, taskState, CONTROL_STATUS_COLOR, EVIDENCE_STATES, DOMAINS, WORKFLOW_QUESTIONS,
  type ComplyControl, type ComplyTask, type EvidenceItem, type RequirementGroup, type ControlStatus, type TaskState, type TaskSev, type DomainId, type SoaRow, type FrameworkStatus,
} from '../../data/modules/comply';
import { Card, Badge, Bar, Btn, KV, Callout, SectionLabel, SevBadge, StatusBadge, Sources, cap } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtNum } from '../../lib/format';
import { WriteBackModal, RequestEvidenceModal, Field, MetricBand, SegRing, Facet, StateKey } from './parts';
import { useComplyData, EV_HEX } from './useComply';

const tone = MODULE_BY_ID.comply.tone;
type View = 'frameworks' | 'requirements' | 'controls' | 'tasks' | 'evidence' | 'workflows' | 'soa';
const STATUSES: ControlStatus[] = ['Compliant', 'In progress', 'Not started', 'Not applicable'];
const EV_LABEL = Object.fromEntries(EVIDENCE_STATES.map((s) => [s.key, s.label])) as Record<string, string>;

export default function ComplyCaas() {
  const { customer: c, tenantId, toast } = useApp();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const h = headlines(c, tenantId);
  const { fws, controls, tasks, evidence, groups, pipeline } = useComplyData();
  const soa = useMemo(() => soaRows(c), [c]);
  const hasIso = c.frameworks.some((f) => f.id === 'iso27001');
  const conns = scopedConnectors(c, tenantId);
  const grc = conns.find((k) => k.category === 'GRC');
  const grcName = grc ? `${grc.vendor} ${grc.product}` : 'HexaComply';
  const evFeeds = conns.filter((k) => ['SIEM', 'EDR / XDR', 'Identity', 'Cloud posture', 'Backup', 'Vulnerability', 'PAM', 'OT'].includes(k.category));
  const staleFeeds = evFeeds.filter((k) => isStale(k) || k.status !== 'healthy');

  // ---- URL-driven filters (every headline elsewhere pivots here) ----
  const p = (k: string) => sp.get(k);
  const fwParam = p('framework') || 'all';
  const view = (p('view') as View | null) ?? (fwParam !== 'all' ? 'controls' : 'frameworks');
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  };
  const status = (p('status') as ControlStatus | null) ?? 'all';
  const state = p('state') ?? 'all';
  const sev = (p('sev') as TaskSev | null) ?? 'all';
  const domain = (p('domain') as DomainId | null) ?? 'all';
  const group = p('group') ?? 'all';
  const owner = p('owner') ?? 'all';
  const overdueOnly = p('overdue') === '1';
  const naOnly = p('scope') === 'na';
  const coveredOnly = p('covered') === '1';
  const expiring = p('expiring');
  const openId = p('id');

  const fwSel = fws.find((f) => f.fw.id === fwParam) ?? null;
  const inFw = <T extends { fwId?: string }>(x: T) => fwParam === 'all' || x.fwId === fwParam;

  const ctlRows = controls.filter((x) => inFw(x) && (status === 'all' || x.status === status) && (domain === 'all' || x.domain === domain) && (group === 'all' || `${x.fwId}:${x.group}` === group) && (!naOnly || x.status === 'Not applicable') && (owner === 'all' || x.owner === owner));
  const taskRows = tasks.filter((t) => inFw(t) && (state === 'all' || taskState(t.status) === state || t.status === state) && (sev === 'all' || t.sev === sev) && (!overdueOnly || t.overdue) && (owner === 'all' || t.owner === owner) && (!naOnly || t.status === 'Not applicable'));
  const evFw = (e: EvidenceItem) => fwParam === 'all' || e.fwShort === fwSel?.fw.short;
  const evRows = evidence.filter((e) => evFw(e) && (state === 'all' || e.state === state || (state === 'moving' && ['draft', 'submitted', 'processing'].includes(e.state)) || (state === 'failing' && ['rejected', 'expired', 'failed'].includes(e.state))) && (!expiring || (e.state === 'approved' && e.expiresDays <= Number(expiring))));
  const reqRows = groups.filter((g) => (fwParam === 'all' || g.fwId === fwParam) && (!coveredOnly || g.covered));

  const [ctlOpen, setCtlOpen] = useState<ComplyControl | null>(null);
  const [taskOpen, setTaskOpen] = useState<ComplyTask | null>(null);
  const [evOpen, setEvOpen] = useState<EvidenceItem | null>(null);
  const [statusModal, setStatusModal] = useState<{ control: string; framework: string } | null>(null);
  const [newStatus, setNewStatus] = useState('Implemented');
  const [evReq, setEvReq] = useState<{ what: string; owner: string; email?: string; control: string; taskId?: string } | null>(null);
  const [requested, setRequested] = useState<Record<string, string>>({});
  const [recollect, setRecollect] = useState<EvidenceItem | null>(null);

  // Deep links: ?id= opens the matching record once.
  const [handled, setHandled] = useState<string | null>(null);
  if (openId && handled !== openId) {
    setHandled(openId);
    const ct = controls.find((x) => x.id === openId);
    const tk = tasks.find((x) => x.id === openId);
    const ev = evidence.find((x) => x.id === openId);
    if (ct) setCtlOpen(ct); else if (tk) setTaskOpen(tk); else if (ev) setEvOpen(ev);
  }

  const owners = [...new Set(controls.map((x) => x.owner))];
  const compliant = controls.filter((x) => x.status === 'Compliant').length;
  const inScope = controls.filter((x) => x.status !== 'Not applicable').length;
  const tasksDone = tasks.filter((t) => taskState(t.status) === 'Compliant').length;
  const approved = evidence.filter((e) => e.state === 'approved').length;
  const covered = groups.filter((g) => g.covered).length;
  const viewCounts: Record<View, number> = { frameworks: fws.length, requirements: reqRows.length, controls: ctlRows.length, tasks: taskRows.length, evidence: evRows.length, workflows: controls.filter((x) => inFw(x) && x.status !== 'Not applicable' && x.status !== 'Compliant').length, soa: soa.length };
  const views: { id: View; label: string }[] = [
    { id: 'frameworks', label: 'Frameworks' }, { id: 'requirements', label: 'Requirements' }, { id: 'controls', label: 'Controls' }, { id: 'tasks', label: 'Tasks' }, { id: 'evidence', label: 'Evidence' }, { id: 'workflows', label: 'Control workflows' },
    ...(hasIso ? [{ id: 'soa' as View, label: 'Statement of Applicability' }] : []),
  ];
  const scopeName = tenantName(c, tenantId);
  const goView = (v: View, extra: Record<string, string | null> = {}) => set({ view: v, status: null, state: null, sev: null, overdue: null, scope: null, covered: null, expiring: null, domain: null, group: null, id: null, ...extra });

  return (
    <>
      <div className="row between wrap" style={{ gap: 10 }}>
        <p className="page-intro" style={{ flex: 1, minWidth: 280, margin: 0 }}>
          <b>{c.name}</b> · {scopeName}: the compliance chain as applied to this company, frameworks → requirements → controls → tasks → evidence, operated by HexaShield in {grcName}. Evidence arrives continuously from {evFeeds.slice(0, 5).map((k) => k.product).join(', ')}{evFeeds.length > 5 ? ` and ${evFeeds.length - 5} more` : ''}.
        </p>
        <Badge color={tone} dot>Compliance authority: HexaShield</Badge>
      </div>

      <MetricBand
        tone={tone}
        items={[
          { ac: 'Frameworks', word: 'Applied', value: fws.length, unit: 'in scope', active: view === 'frameworks', onClick: () => goView('frameworks'), source: grcName },
          { ac: 'Requirements', word: 'Covered', value: covered, unit: `of ${groups.length}`, gauge: (covered / Math.max(1, groups.length)) * 100, active: view === 'requirements', onClick: () => goView('requirements', { covered: '1' }), source: grcName },
          { ac: 'Controls', word: 'Compliant', value: fmtNum(compliant), unit: `of ${fmtNum(inScope)}`, gauge: (compliant / Math.max(1, inScope)) * 100, active: view === 'controls', onClick: () => goView('controls', { status: 'Compliant' }), source: grcName },
          { ac: 'Tasks', word: 'Complete', value: fmtNum(tasksDone), unit: `of ${fmtNum(tasks.length)}`, gauge: (tasksDone / Math.max(1, tasks.length)) * 100, active: view === 'tasks' && !overdueOnly, onClick: () => goView('tasks', { state: 'Compliant' }), source: grcName },
          { ac: 'Overdue', word: 'Tasks', value: h.comply.overdueTasks, unit: 'past due', color: 'var(--bad)', active: view === 'tasks' && overdueOnly, onClick: () => goView('tasks', { overdue: '1' }), source: grcName },
          { ac: 'Evidence', word: 'Approved', value: fmtNum(approved), unit: `of ${fmtNum(evidence.length)} · ${pipeline.autoPct}% automated`, gauge: (approved / Math.max(1, evidence.length)) * 100, active: view === 'evidence', onClick: () => goView('evidence', { state: 'approved' }), source: `${grcName} · ${evFeeds.slice(0, 3).map((k) => k.product).join(', ')}` },
        ]}
      />

      {staleFeeds.length > 0 && (
        <Callout kind="warn">
          <b>Evidence freshness:</b> {staleFeeds.map((k) => `${k.vendor} ${k.product} (${k.note ?? k.status})`).join('; ')}. Controls that rely on these feeds show their last good evidence and are flagged as ageing, never as passing.
        </Callout>
      )}

      {fwSel && <FrameworkSummary f={fwSel} grcName={grcName} onStatus={(s) => set({ view: 'controls', status: s })} onClear={() => set({ framework: null })} onLoops={() => nav(`/loop?framework=${fwSel.fw.id}`)} />}

      <Card flush>
        <div className="comply-views">
          {views.map((v) => (
            <button key={v.id} type="button" className={`comply-view ${view === v.id ? 'on' : ''}`} onClick={() => goView(v.id)}>
              {v.label}<em>{fmtNum(viewCounts[v.id])}</em>
            </button>
          ))}
        </div>
        {view !== 'soa' && (
          <div className="comply-facets">
            <Facet label="Framework" value={fwParam} onChange={(v) => set({ framework: v, group: null })} options={c.frameworks.map((f) => ({ id: f.id, label: f.short }))} />
            {view === 'controls' && (
              <>
                <Facet label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUSES.map((s) => ({ id: s, label: s, n: controls.filter((x) => inFw(x) && x.status === s).length }))} />
                <Facet label="Domain" value={domain} onChange={(v) => set({ domain: v })} options={(Object.keys(DOMAINS) as DomainId[]).filter((d) => controls.some((x) => inFw(x) && x.domain === d)).map((d) => ({ id: d, label: DOMAINS[d].label }))} />
                {fwParam !== 'all' && <Facet label="Requirement" value={group} onChange={(v) => set({ group: v })} options={groups.filter((g) => g.fwId === fwParam).map((g) => ({ id: g.id, label: `${g.ref} ${g.name}` }))} />}
                <Facet label="Scope" value={naOnly ? 'na' : 'all'} all="All controls" onChange={(v) => set({ scope: v })} options={[{ id: 'na', label: 'Not applicable only' }]} />
              </>
            )}
            {view === 'tasks' && (
              <>
                <Facet label="State" value={state as TaskState | 'all'} onChange={(v) => set({ state: v })} options={TASK_STATES.map((s) => ({ id: s, label: s, n: tasks.filter((t) => inFw(t) && taskState(t.status) === s).length }))} />
                <Facet label="Severity" value={sev} onChange={(v) => set({ sev: v })} options={TASK_SEVS.map((s) => ({ id: s, label: cap(s) }))} />
                <Facet label="Owner" value={owner} onChange={(v) => set({ owner: v })} options={owners.map((o) => ({ id: o, label: o }))} />
                <Facet label="Lifecycle" value={overdueOnly ? 'overdue' : 'all'} onChange={(v) => set({ overdue: v === 'overdue' ? '1' : null })} options={[{ id: 'overdue', label: 'Overdue', n: tasks.filter((t) => inFw(t) && t.overdue).length }]} />
              </>
            )}
            {view === 'evidence' && (
              <>
                <Facet label="State" value={state} onChange={(v) => set({ state: v })} options={[...EVIDENCE_STATES.map((s) => ({ id: s.key as string, label: s.label, n: evidence.filter((e) => evFw(e) && e.state === s.key).length })), { id: 'moving', label: 'Still moving' }, { id: 'failing', label: 'Rejected, expired or failed' }]} />
                <Facet label="Lifecycle" value={expiring ? 'exp' : 'all'} onChange={(v) => set({ expiring: v === 'exp' ? '30' : null })} options={[{ id: 'exp', label: 'Approved, expiring in 30 d', n: evidence.filter((e) => evFw(e) && e.state === 'approved' && e.expiresDays <= 30).length }]} />
              </>
            )}
            {view === 'requirements' && <Facet label="Coverage" value={coveredOnly ? 'cov' : 'all'} onChange={(v) => set({ covered: v === 'cov' ? '1' : null })} options={[{ id: 'cov', label: 'Covered (≥ 80% compliant)' }]} />}
          </div>
        )}

        {view === 'frameworks' && (
          <DataTable<FrameworkStatus>
            rows={fws}
            rowKey={(f) => f.fw.id}
            onRowClick={(f) => set({ framework: f.fw.id, view: 'controls' })}
            columns={[
              { key: 'fw', header: 'Framework', sort: (f) => f.fw.short, render: (f) => <><div className="t-main">{f.fw.name}</div><div className="t-sub">{f.fw.kind} · {f.fw.owner}</div></> },
              { key: 'req', header: 'Requirements', align: 'right', sort: (f) => f.fw.requirements, render: (f) => <span className="num">{f.fw.inScope} / {f.fw.requirements}</span> },
              { key: 'status', header: 'Status', render: (f) => <span style={{ display: 'block', width: 220 }}><StatusMini f={f} /></span> },
              { key: 'doc', header: 'Documented', align: 'right', sort: (f) => f.documented, render: (f) => <b className="num">{f.documented}%</b> },
              { key: 'ass', header: 'Assured', align: 'right', sort: (f) => f.assured, render: (f) => <b className="num" style={{ color: 'var(--m-view)' }}>{f.assured}%</b> },
              { key: 'ev', header: 'Evidence', align: 'right', sort: (f) => f.evidence, render: (f) => <span className="num">{fmtNum(evidence.filter((e) => e.fwShort === f.fw.short).length)}</span> },
              { key: 'audit', header: 'Next audit', sort: (f) => f.auditInDays ?? 999, render: (f) => (f.auditInDays !== undefined ? <><Badge color={f.auditInDays < 60 ? 'var(--sev-medium)' : 'var(--text-muted)'}><CalendarClock size={11} /> {f.auditInDays} d</Badge><div className="t-sub">{f.fw.nextAudit}</div></> : <span className="t-sub">Continuous</span>) },
            ]}
          />
        )}

        {view === 'requirements' && (
          <DataTable<RequirementGroup>
            rows={reqRows}
            rowKey={(g) => g.id}
            onRowClick={(g) => set({ view: 'controls', framework: g.fwId, group: g.id, covered: null })}
            search={(g) => `${g.ref} ${g.name} ${g.fwShort}`}
            searchPlaceholder="Filter requirements…"
            pageSize={20}
            columns={[
              { key: 'ref', header: 'Requirement', sort: (g) => g.ref, render: (g) => <><div className="t-main">{g.ref}</div><div className="t-sub">{g.name}</div></> },
              { key: 'fw', header: 'Framework', sort: (g) => g.fwShort, render: (g) => <Badge>{g.fwShort}</Badge> },
              { key: 'ctl', header: 'Controls', align: 'right', sort: (g) => g.controls, render: (g) => <span className="num">{g.inScope} in scope · {g.controls - g.inScope} N/A</span> },
              { key: 'cov', header: 'Compliant', sort: (g) => g.compliant / Math.max(1, g.inScope), render: (g) => <span className="row" style={{ gap: 8, minWidth: 180 }}><span style={{ flex: 1 }}><Bar value={g.compliant} max={Math.max(1, g.inScope)} color={g.covered ? 'var(--good)' : 'var(--sev-medium)'} size="thin" /></span><b className="num">{g.compliant}/{g.inScope}</b></span> },
              { key: 'state', header: 'Coverage', sort: (g) => (g.covered ? 1 : 0), render: (g) => <Badge color={g.covered ? 'var(--good)' : 'var(--sev-medium)'} dot>{g.covered ? 'Covered' : 'Gaps'}</Badge> },
            ]}
          />
        )}

        {view === 'controls' && (
          <>
            <div className="comply-count-line">{fmtNum(ctlRows.length)} of {fmtNum(controls.filter(inFw).length)} controls · source {grcName} · statuses derived from task evidence, not set by hand</div>
            <DataTable<ComplyControl>
              rows={ctlRows}
              rowKey={(x) => x.id}
              onRowClick={setCtlOpen}
              search={(x) => `${x.ref} ${x.name} ${x.groupName} ${x.fwShort} ${x.owner}`}
              searchPlaceholder="Search controls…"
              pageSize={20}
              columns={[
                { key: 'ref', header: 'Control', sort: (x) => x.ref, render: (x) => <><div className="t-main">{x.ref}</div><div className="t-sub" style={{ maxWidth: 360, whiteSpace: 'normal' }}>{x.name}</div></> },
                { key: 'req', header: 'Requirement', sort: (x) => x.group, render: (x) => <><div className="t-main">{x.group}</div><div className="t-sub">{x.groupName}</div></> },
                ...(fwParam === 'all' ? [{ key: 'fw', header: 'Framework', sort: (x: ComplyControl) => x.fwShort, render: (x: ComplyControl) => <Badge>{x.fwShort}</Badge> }] : []),
                { key: 'tasks', header: 'Tasks', align: 'right', sort: (x) => tasks.filter((t) => t.controlId === x.id).length, render: (x) => <span className="num">{tasks.filter((t) => t.controlId === x.id).length}</span> },
                { key: 'status', header: 'Status', sort: (x) => STATUSES.indexOf(x.status), render: (x) => <StatusBadge value={x.status} map={CONTROL_STATUS_COLOR} /> },
                { key: 'app', header: 'Applicability', sort: (x) => (x.status === 'Not applicable' ? 1 : 0), render: (x) => (x.status === 'Not applicable' ? <><Badge color="var(--sev-info)">Not applicable</Badge><div className="t-sub">{x.decidedBy}</div></> : <span className="t-sub">In scope</span>) },
                { key: 'loop', header: 'Loop', render: (x) => (x.loopControl ? <Badge color="var(--m-view)">{x.loopControl}</Badge> : <span className="t-sub">—</span>) },
                { key: 'upd', header: 'Updated', align: 'right', sort: (x) => -x.updatedDays, render: (x) => <span className="t-sub">{x.updatedDays} d ago</span> },
              ]}
            />
          </>
        )}

        {view === 'tasks' && (
          <>
            <div className="comply-count-line">{fmtNum(taskRows.length)} of {fmtNum(tasks.filter(inFw).length)} tasks · a task advances only through evidence submitted against it</div>
            <DataTable<ComplyTask>
              rows={taskRows}
              rowKey={(t) => t.id}
              onRowClick={setTaskOpen}
              search={(t) => `${t.ref} ${t.title} ${t.owner} ${t.fwShort}`}
              searchPlaceholder="Search tasks…"
              pageSize={20}
              initialSort={overdueOnly ? { key: 'due', dir: 'asc' } : undefined}
              columns={[
                { key: 'ref', header: 'Task', sort: (t) => t.ref, render: (t) => <><div className="t-main">{t.ref}</div><div className="t-sub" style={{ maxWidth: 380, whiteSpace: 'normal' }}>{t.title}</div></> },
                { key: 'owner', header: 'Owner', sort: (t) => t.owner, render: (t) => <span className="t-sub">{t.owner}</span> },
                { key: 'sev', header: 'Severity', sort: (t) => TASK_SEVS.indexOf(t.sev), render: (t) => <SevBadge sev={t.sev} /> },
                { key: 'ev', header: 'Evidence', align: 'right', sort: (t) => t.evidence, render: (t) => <span className="num">{t.evidence}</span> },
                { key: 'status', header: 'Status', sort: (t) => t.status, render: (t) => <StatusBadge value={requested[t.id] ? 'Evidence requested' : t.status} map={{ ...TASK_STATUS_COLOR, 'Evidence requested': 'var(--m-matrix)' }} /> },
                { key: 'due', header: 'Due', align: 'right', sort: (t) => t.dueDays, render: (t) => (t.status === 'Not applicable' || taskState(t.status) === 'Compliant' ? <span className="t-sub">—</span> : <span className="t-sub" style={{ color: t.overdue ? 'var(--bad)' : undefined, fontWeight: t.overdue ? 700 : undefined }}>{t.overdue ? `${-t.dueDays} d overdue` : `in ${t.dueDays} d`}</span>) },
                { key: 'tenant', header: 'Tenant', sort: (t) => t.tenant, render: (t) => <span className="t-sub">{c.tenants.find((x) => x.id === t.tenant)?.short}</span> },
              ]}
            />
          </>
        )}

        {view === 'evidence' && (
          <>
            <div className="comply-keys" style={{ margin: '10px 18px 0', paddingTop: 0, borderTop: 0 }}>
              {EVIDENCE_STATES.map((s) => <StateKey key={s.key} color={EV_HEX[s.key]} label={s.label} n={fmtNum(evidence.filter((e) => evFw(e) && e.state === s.key).length)} on={state === s.key} onClick={() => set({ state: state === s.key ? null : s.key })} />)}
            </div>
            <div className="comply-count-line">{fmtNum(evRows.length)} of {fmtNum(evidence.filter(evFw).length)} items · {pipeline.autoPct}% collected automatically by connectors · every item is hashed on receipt</div>
            <DataTable<EvidenceItem>
              rows={evRows}
              rowKey={(e) => e.id}
              onRowClick={setEvOpen}
              search={(e) => `${e.id} ${e.title} ${e.source} ${e.controlRef} ${e.fwShort}`}
              searchPlaceholder="Search evidence, sources, controls…"
              pageSize={20}
              columns={[
                { key: 'id', header: 'Evidence', sort: (e) => e.id, render: (e) => <><div className="t-main">{e.title}</div><div className="t-sub">{e.id} · {e.controlRef} · {e.fwShort}</div></> },
                { key: 'src', header: 'Source', sort: (e) => e.source, render: (e) => <span className="row" style={{ gap: 6 }}>{e.automated ? <Badge color="var(--good)">Connector</Badge> : <Badge>Manual</Badge>}<span className="t-sub">{e.source}</span></span> },
                { key: 'state', header: 'State', sort: (e) => e.state, render: (e) => <Badge color={EV_HEX[e.state]} dot>{EV_LABEL[e.state]}</Badge> },
                { key: 'col', header: 'Collected', align: 'right', sort: (e) => -e.collectedDays, render: (e) => <span className="t-sub">{e.collectedDays === 0 ? 'today' : `${e.collectedDays} d ago`}</span> },
                { key: 'exp', header: 'Expires', align: 'right', sort: (e) => e.expiresDays, render: (e) => <span className="t-sub" style={{ color: e.expiresDays < 0 ? 'var(--bad)' : e.expiresDays <= 30 ? 'var(--sev-medium)' : undefined }}>{e.expiresDays < 0 ? `${-e.expiresDays} d ago` : `in ${e.expiresDays} d`}</span> },
              ]}
            />
          </>
        )}

        {view === 'workflows' && <Workflows controls={controls.filter(inFw)} onDone={(x) => toast(`Answers recorded for ${x.ref} ${x.name}: draft evidence created in ${grcName}, routed to ${c.people.grcLead.name} for review`)} />}

        {view === 'soa' && (
          <DataTable<SoaRow>
            rows={soa}
            rowKey={(r) => r.id}
            search={(r) => `${r.id} ${r.name} ${r.justification}`}
            searchPlaceholder="Filter Annex A controls…"
            pageSize={20}
            onRowClick={(r) => r.applicable && setStatusModal({ control: `${r.id} ${r.name}`, framework: 'ISO 27001' })}
            columns={[
              { key: 'id', header: 'Control', sort: (r) => r.id, render: (r) => <><div className="t-main">{r.id}</div><div className="t-sub">{r.name}</div></> },
              { key: 'app', header: 'Applicable', sort: (r) => (r.applicable ? 1 : 0), render: (r) => <Badge color={r.applicable ? 'var(--good)' : 'var(--sev-info)'} dot>{r.applicable ? 'Yes' : 'Excluded'}</Badge> },
              { key: 'by', header: 'Decided by', sort: (r) => r.decidedBy, render: (r) => <Badge color={r.decidedBy === 'Client' ? 'var(--text-muted)' : 'var(--m-view)'}>{r.decidedBy}</Badge> },
              { key: 'why', header: 'Justification', render: (r) => <div className="comply-why">{r.justification}</div> },
              { key: 'impl', header: 'Implementation', sort: (r) => r.implemented, render: (r) => <span className="t-sub" style={{ color: r.implemented === 'Implemented' ? 'var(--good)' : r.implemented === 'Partially' ? 'var(--sev-medium)' : undefined }}>{r.implemented}</span> },
            ]}
          />
        )}
      </Card>

      <div className="row wrap" style={{ gap: 10 }}>
        <Sources items={[...(grc ? [{ name: grc.product, status: grc.status }] : []), ...evFeeds.slice(0, 8).map((k) => ({ name: k.product, status: k.status }))]} />
        <span className="muted" style={{ fontSize: 11 }}>Operated by HexaShield GRC analysts · {c.people.grcLead.name} ({c.people.grcLead.role}) is the client ISMS owner</span>
      </div>

      {ctlOpen && (
        <Drawer
          wide
          title={`${ctlOpen.ref} · ${ctlOpen.name}`}
          sub={`${ctlOpen.fwShort} · ${ctlOpen.group} ${ctlOpen.groupName}`}
          onClose={() => { setCtlOpen(null); set({ id: null }); }}
          footer={
            <>
              {ctlOpen.loopControl && <Btn onClick={() => nav(`/loop?framework=${ctlOpen.fwId}&control=${ctlOpen.loopControl}`)}>Loops for {ctlOpen.loopControl} <ArrowRight /></Btn>}
              <Btn primary color={tone} onClick={() => setStatusModal({ control: `${ctlOpen.ref} ${ctlOpen.name}`, framework: ctlOpen.fwShort })}><PencilLine /> Update control status</Btn>
            </>
          }
        >
          <KV rows={[
            ['Status', <StatusBadge key="s" value={ctlOpen.status} map={CONTROL_STATUS_COLOR} />],
            ['Domain', DOMAINS[ctlOpen.domain].label],
            ['Owner', ctlOpen.owner],
            ['Applicability', ctlOpen.status === 'Not applicable' ? `Not applicable · ${ctlOpen.decidedBy}` : 'In scope'],
            ...(ctlOpen.justification ? [['Justification', ctlOpen.justification] as [string, ReactNode]] : []),
            ['Updated', `${ctlOpen.updatedDays} days ago`],
            ['Source', grcName],
          ]} />
          {ctlOpen.loopControl && (() => {
            const ls = loops(c, tenantId).filter((l) => l.controlId === ctlOpen.loopControl);
            const s = loopSummary(ls);
            return (
              <Callout color="var(--m-view)">
                <b>Assurance:</b> mapped to {ctlOpen.loopControl} in the loop engine · {s.closed}/{s.applicable} loops closed ({s.assuredPct}% assured). Documented here means fresh evidence; assured means the linked detections were also proven by HexaStrike.
              </Callout>
            );
          })()}
          <div>
            <SectionLabel>Tasks ({tasks.filter((t) => t.controlId === ctlOpen.id).length})</SectionLabel>
            <div className="list">
              {tasks.filter((t) => t.controlId === ctlOpen.id).map((t) => (
                <button key={t.id} className="list-row" onClick={() => setTaskOpen(t)}>
                  <span className="list-main"><b>{t.ref} · {t.title}</b><span>{t.owner} · {t.evidence} evidence item{t.evidence === 1 ? '' : 's'}{t.overdue ? ` · ${-t.dueDays} d overdue` : ''}</span></span>
                  <StatusBadge value={t.status} map={TASK_STATUS_COLOR} />
                </button>
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {taskOpen && (
        <Drawer
          wide
          title={`${taskOpen.ref} · ${taskOpen.title}`}
          sub={`${taskOpen.id} · ${taskOpen.fwShort} · control ${taskOpen.controlRef}`}
          onClose={() => { setTaskOpen(null); set({ id: null }); }}
          footer={
            <>
              <Btn onClick={() => { const ct = controls.find((x) => x.id === taskOpen.controlId); if (ct) { setTaskOpen(null); setCtlOpen(ct); } }}>Open control</Btn>
              {taskOpen.status !== 'Not applicable' && taskState(taskOpen.status) !== 'Compliant' && (
                <Btn primary color={tone} onClick={() => setEvReq({ what: taskOpen.title, owner: taskOpen.owner, email: taskOpen.ownerEmail, control: taskOpen.controlRef, taskId: taskOpen.id })}><Send /> Request evidence</Btn>
              )}
            </>
          }
        >
          <KV rows={[
            ['Status', <StatusBadge key="s" value={requested[taskOpen.id] ? 'Evidence requested' : taskOpen.status} map={{ ...TASK_STATUS_COLOR, 'Evidence requested': 'var(--m-matrix)' }} />],
            ['Severity', <SevBadge key="v" sev={taskOpen.sev} />],
            ['Owner', `${taskOpen.owner} (${taskOpen.ownerEmail})`],
            ['Tenant', c.tenants.find((t) => t.id === taskOpen.tenant)?.name ?? '—'],
            ['Due', taskOpen.overdue ? `${-taskOpen.dueDays} days overdue` : taskState(taskOpen.status) === 'Compliant' ? 'Complete' : `in ${taskOpen.dueDays} days`],
            ...(requested[taskOpen.id] ? [['Request', `Evidence requested, due in ${requested[taskOpen.id]} days`] as [string, ReactNode]] : []),
          ]} />
          {taskOpen.overdue && <Callout kind="warn">This task counts against {taskOpen.fwShort} documented coverage until its evidence is approved.</Callout>}
          <div>
            <SectionLabel>Evidence ({evidence.filter((e) => e.taskId === taskOpen.id).length})</SectionLabel>
            <div className="list">
              {evidence.filter((e) => e.taskId === taskOpen.id).slice(0, 12).map((e) => (
                <button key={e.id} className="list-row" onClick={() => setEvOpen(e)}>
                  <span className="list-main"><b>{e.title}</b><span>{e.id} · {e.source} · collected {e.collectedDays} d ago</span></span>
                  <Badge color={EV_HEX[e.state]} dot>{EV_LABEL[e.state]}</Badge>
                </button>
              ))}
              {evidence.filter((e) => e.taskId === taskOpen.id).length === 0 && <div className="muted" style={{ fontSize: 12 }}>No evidence submitted yet.</div>}
            </div>
          </div>
        </Drawer>
      )}

      {evOpen && (
        <Drawer
          title={evOpen.title}
          sub={`${evOpen.id} · ${EV_LABEL[evOpen.state]}`}
          onClose={() => { setEvOpen(null); set({ id: null }); }}
          footer={evOpen.automated ? <Btn primary color={tone} onClick={() => setRecollect(evOpen)}><RefreshCw /> Re-collect from {evOpen.source}</Btn> : undefined}
        >
          <KV rows={[
            ['State', <Badge key="s" color={EV_HEX[evOpen.state]} dot>{EV_LABEL[evOpen.state]}</Badge>],
            ['Source', <span key="src">{evOpen.source} {evOpen.automated ? <Badge color="var(--good)">Connector snapshot</Badge> : <Badge>Manual</Badge>}</span>],
            ['Control', `${evOpen.controlRef} · ${evOpen.fwShort}`],
            ['Task', evOpen.taskId],
            ['Collected', `${evOpen.collectedDays} days ago`],
            ['Expires', evOpen.expiresDays < 0 ? `Expired ${-evOpen.expiresDays} days ago` : `in ${evOpen.expiresDays} days`],
            ['SHA-256 (prefix)', <span key="h" className="mono">{evOpen.hash}…</span>],
          ]} />
          <Callout>Evidence is hashed on receipt and the hash is anchored in the audit ledger, so an auditor can verify the file has not changed since collection.</Callout>
          <Btn sm onClick={() => { const t = tasks.find((x) => x.id === evOpen.taskId); if (t) { setEvOpen(null); setTaskOpen(t); } }}>Open task</Btn>
        </Drawer>
      )}

      {statusModal && (
        <WriteBackModal
          title="Update control status"
          target={grcName}
          risk="low"
          approvals="No approval needed (low risk)"
          submitLabel="Apply update"
          onClose={() => setStatusModal(null)}
          onSubmit={() => { toast(`Control status updated in ${grcName}: ${statusModal.control} → ${newStatus}`); setStatusModal(null); }}
          changes={[['Control', statusModal.control], ['Framework', statusModal.framework], ['Field', 'implementation_status'], ['New value', newStatus], ['Tenant', scopeName]]}
        >
          <Field label="New status">
            <select className="select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              {['Implemented', 'Partially implemented', 'Planned', 'Not applicable'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </WriteBackModal>
      )}

      {recollect && (
        <WriteBackModal
          title="Re-collect evidence"
          target={recollect.source}
          risk="low"
          approvals="No approval needed (read-only collection)"
          submitLabel="Collect now"
          onClose={() => setRecollect(null)}
          onSubmit={() => { toast(`Snapshot requested from ${recollect.source} for ${recollect.controlRef}; new item will be hashed and sent for review`); setRecollect(null); }}
          changes={[['Connector', recollect.source], ['Artefact', recollect.title], ['Control', recollect.controlRef], ['Effect', 'New evidence version; previous version retained']]}
        />
      )}

      {evReq && (
        <RequestEvidenceModal what={evReq.what} owner={evReq.owner} ownerEmail={evReq.email} control={evReq.control} onClose={() => setEvReq(null)}
          onDone={(due) => evReq.taskId && setRequested((m) => ({ ...m, [evReq.taskId!]: due }))} />
      )}
    </>
  );
}

function StatusMini({ f }: { f: FrameworkStatus }) {
  const parts = [['Compliant', f.compliant], ['In progress', f.inProgress], ['Not started', f.notStarted], ['Not applicable', f.outOfScope]] as [ControlStatus, number][];
  const total = parts.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <span className="comply-segbar" style={{ height: 10 }} title={parts.map(([k, n]) => `${k}: ${n}`).join(' · ')}>
      {parts.filter(([, n]) => n > 0).map(([k, n]) => <span key={k} className="comply-seg" style={{ flexGrow: n / total, background: CONTROL_STATUS_COLOR[k], minWidth: 4 }} />)}
    </span>
  );
}

function FrameworkSummary({ f, grcName, onStatus, onClear, onLoops }: { f: FrameworkStatus; grcName: string; onStatus: (s: ControlStatus) => void; onClear: () => void; onLoops: () => void }) {
  const counts: Record<ControlStatus, number> = { Compliant: f.compliant, 'In progress': f.inProgress, 'Not started': f.notStarted, 'Not applicable': f.outOfScope };
  const pct = Math.round((f.compliant / Math.max(1, f.fw.inScope)) * 100);
  return (
    <Card toneColor={tone} tinted title={f.fw.name} sub={`${f.fw.kind} · owner ${f.fw.owner} · source ${grcName}`} actions={<><Btn sm onClick={onLoops}>Loops <ArrowRight /></Btn><Btn sm ghost onClick={onClear}>All frameworks</Btn></>}>
      <div className="row wrap" style={{ gap: 28, alignItems: 'center' }}>
        <SegRing parts={STATUSES.map((s) => ({ label: s, value: counts[s], color: CONTROL_STATUS_COLOR[s] }))} center={`${pct}%`} sub={`${f.compliant}/${f.fw.inScope}`} />
        <dl className="comply-facts" style={{ minWidth: 220 }}>
          {STATUSES.map((s) => (
            <div key={s} className="click" onClick={() => onStatus(s)}>
              <dt><i style={{ background: CONTROL_STATUS_COLOR[s] }} />{s === 'Not applicable' ? 'Out of scope' : s}</dt>
              <dd>{counts[s]}</dd>
            </div>
          ))}
        </dl>
        <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 10 }}>
          <div className="comply-mini"><span>Documented</span><Bar value={f.documented} color={tone} size="thin" /><b>{f.documented}%</b></div>
          <div className="comply-mini"><span>Assured</span><Bar value={f.assured} color="var(--m-view)" size="thin" /><b>{f.assured}%</b></div>
          <span className="muted" style={{ fontSize: 12 }}>{f.fw.nextAudit ? `${f.fw.nextAudit} · in ${f.auditInDays} days` : 'No external audit scheduled · continuous monitoring'}</span>
        </div>
      </div>
    </Card>
  );
}

function Workflows({ controls, onDone }: { controls: ComplyControl[]; onDone: (c: ComplyControl) => void }) {
  const [tab, setTab] = useState<'next' | 'progress' | 'done'>('next');
  const [open, setOpen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const list = {
    next: controls.filter((x) => x.status === 'Not started' && !done[x.id]),
    progress: controls.filter((x) => x.status === 'In progress' && !done[x.id]),
    done: [...controls.filter((x) => done[x.id]), ...controls.filter((x) => x.status === 'Compliant')],
  };
  const shown = list[tab].slice(0, 40);
  return (
    <div style={{ padding: '14px 18px' }}>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>The work itself: the questions that establish each control. Answers here become draft evidence that the registers report on. Use the Framework filter above to narrow the controls.</p>
      <div className="chips" style={{ marginBottom: 10 }}>
        {([['next', 'Next up'], ['progress', 'In progress'], ['done', 'Completed']] as const).map(([k, l]) => (
          <button key={k} type="button" className={`comply-fchip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}<em>{list[k].length}</em></button>
        ))}
      </div>
      {shown.map((x) => {
        const qs = WORKFLOW_QUESTIONS[x.domain];
        const a = answers[x.id] ?? [];
        const isOpen = open === x.id;
        const qi = Math.min(a.length, qs.length - 1);
        return (
          <div key={x.id} className="comply-wf">
            <button type="button" className="comply-wf-head" onClick={() => setOpen(isOpen ? null : x.id)}>
              <span><b>{x.name} workflow</b><span>{x.ref} · {x.groupName} · {x.fwShort} · {qs.length} questions</span></span>
              {done[x.id] || x.status === 'Compliant' ? <Badge color="var(--good)"><Check size={11} /> Answered</Badge> : <span className="muted">{isOpen ? '−' : '+'}</span>}
            </button>
            {isOpen && !(done[x.id] || x.status === 'Compliant') && (
              <div className="comply-wf-body">
                <p className="comply-wf-lead">{qs[qi].lead}</p>
                <p className="comply-wf-q">{qs[qi].q}</p>
                <ul className="comply-wf-checks">{qs[qi].checks.map((ck) => <li key={ck}>{ck}</li>)}</ul>
                <div className="comply-wf-ans">
                  {['Yes', 'No', 'I am not sure'].map((ans) => (
                    <Btn key={ans} sm primary={ans === 'Yes'} color={tone} onClick={() => {
                      const next = [...a, ans];
                      setAnswers((m) => ({ ...m, [x.id]: next }));
                      if (next.length >= qs.length) { setDone((m) => ({ ...m, [x.id]: true })); setOpen(null); onDone(x); }
                    }}>{ans}</Btn>
                  ))}
                  <span className="muted" style={{ fontSize: 11 }}>Question {qi + 1} of {qs.length}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {list[tab].length > shown.length && <div className="muted" style={{ fontSize: 12 }}>Showing 40 of {list[tab].length}; narrow with the framework filter.</div>}
    </div>
  );
}

