import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { headlines, loops, loopSummary } from '../../../data/core';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import {
  soaRows, CONTROL_STATUS_COLOR, DOMAINS, TASK_STATUS_COLOR,
  type ComplyControl, type ControlStatus, type DomainId, type RequirementGroup, type SoaRow,
} from '../../../data/modules/comply';
import { Card, Badge, Bar, Btn, Callout, StatusBadge } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { MetricBand, SegRing, Facet } from '../parts';
import { useComplyData } from '../useComply';
import { useQuery, useDeepLink, SectionHead, Toggles, CountLine, RecordDrawer, RSec, LinkedRecords, ago, ahead } from './shared';
import { rng } from '../../../lib/rng';

const tone = MODULE_BY_ID.comply.tone;
const STATUSES: ControlStatus[] = ['Compliant', 'In progress', 'Not started', 'Not applicable'];
type FView = 'controls' | 'requirements' | 'soa';

export default function FrameworksSection() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const { p, set, go } = useQuery();
  const h = headlines(c, tenantId);
  const { fws, controls, tasks, groups } = useComplyData();
  const soa = useMemo(() => soaRows(c), [c]);
  const hasIso = c.frameworks.some((f) => f.id === 'iso27001');
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = grc ? `${grc.vendor} ${grc.product}` : 'HexaComply';

  const fw = p('framework') ?? 'all';
  const view = ((p('view') as FView | null) ?? 'controls');
  const status = (p('status') as ControlStatus | null) ?? 'all';
  const group = p('group') ?? 'all';
  const domain = (p('domain') as DomainId | null) ?? 'all';
  const naOnly = p('scope') === 'na';
  const coveredOnly = p('covered') === '1';
  const inFw = (x: { fwId: string }) => fw === 'all' || x.fwId === fw;

  const taskCount = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => m.set(t.controlId, (m.get(t.controlId) ?? 0) + 1));
    return m;
  }, [tasks]);
  const rows = controls.filter((x) => inFw(x) && (status === 'all' || x.status === status) && (group === 'all' || `${x.fwId}:${x.group}` === group) && (domain === 'all' || x.domain === domain) && (!naOnly || x.status === 'Not applicable'));
  const reqRows = groups.filter((g) => inFw(g) && (!coveredOnly || g.covered));
  const filtered = status !== 'all' || group !== 'all' || domain !== 'all' || naOnly || fw !== 'all';

  const [open, setOpen] = useState<ComplyControl | null>(null);
  const match = useCallback((x: ComplyControl, id: string) => x.id === id || x.ref === id, []);
  useDeepLink(controls, match, setOpen);

  const compliant = controls.filter((x) => x.status === 'Compliant').length;
  const inScope = controls.filter((x) => x.status !== 'Not applicable').length;
  const na = controls.length - inScope;
  const totalReq = c.frameworks.reduce((s, f) => s + f.requirements, 0);
  const covered = groups.filter((g) => g.covered).length;

  return (
    <>
      <SectionHead intro={<>The compliance chain — frameworks, requirements and controls — as applied to <b>{c.name}</b>. Standard framework content, read-only: you select frameworks, you never author them. Statuses are derived from task evidence in {src}.</>} />

      <MetricBand tone={tone} items={[
        { ac: 'Frameworks', word: 'Applied', value: fws.length, unit: 'in scope', active: fw === 'all' && view === 'controls' && !filtered, onClick: () => set({ framework: null, status: null, group: null, domain: null, scope: null, view: null, id: null }), source: src },
        { ac: 'Requirements', word: 'Across all frameworks', value: fmtNum(totalReq), unit: `${covered} of ${groups.length} groups covered`, gauge: (covered / Math.max(1, groups.length)) * 100, active: view === 'requirements', onClick: () => set({ view: 'requirements', covered: '1' }), source: src },
        { ac: 'Controls', word: 'Compliant', value: fmtNum(compliant), unit: `of ${fmtNum(inScope)} · ${h.comply.controlsMetPct}% met`, gauge: (compliant / Math.max(1, inScope)) * 100, active: status === 'Compliant', onClick: () => set({ view: null, status: 'Compliant', scope: null }), source: src },
        { ac: 'Not started', word: 'Gaps', value: fmtNum(controls.filter((x) => x.status === 'Not started').length), unit: 'controls', color: 'var(--bad)', active: status === 'Not started', onClick: () => set({ view: null, status: 'Not started', scope: null }), source: src },
        { ac: 'Out of scope', word: 'With justification', value: na, unit: 'controls', active: naOnly, onClick: () => set({ view: null, scope: 'na', status: null }), source: src },
      ]} />

      <section className="cmp-fwcards">
        {fws.map((f) => {
          const counts: Record<ControlStatus, number> = { Compliant: f.compliant, 'In progress': f.inProgress, 'Not started': f.notStarted, 'Not applicable': f.outOfScope };
          const pct = Math.round((f.compliant / Math.max(1, f.fw.inScope)) * 100);
          return (
            <button key={f.fw.id} type="button" className={`cmp-fwcard ${fw === f.fw.id ? 'on' : ''}`} onClick={() => set({ framework: fw === f.fw.id ? null : f.fw.id, group: null, id: null })} title={`Source: ${src} · filter the controls to ${f.fw.short}`}>
              <SegRing size={92} stroke={11} parts={STATUSES.map((s) => ({ label: s, value: counts[s], color: CONTROL_STATUS_COLOR[s] }))} center={`${pct}%`} />
              <span>
                <b className="t">{f.fw.name}</b>
                <span className="cmp-fwfacts">
                  {STATUSES.map((s) => <span key={s} style={{ display: 'contents' }}><span><i style={{ background: CONTROL_STATUS_COLOR[s] }} />{s === 'Not applicable' ? 'Out of scope' : s}</span><b>{counts[s]}</b></span>)}
                </span>
                {f.auditInDays !== undefined && <Badge color={f.auditInDays < 60 ? 'var(--sev-medium)' : 'var(--text-muted)'}><CalendarClock size={11} /> {f.fw.nextAudit} · {f.auditInDays} d</Badge>}
              </span>
            </button>
          );
        })}
      </section>

      <Card flush>
        <div className="comply-views">
          <button type="button" className={`comply-view ${view === 'controls' ? 'on' : ''}`} onClick={() => set({ view: null })}>Controls<em>{fmtNum(rows.length)}</em></button>
          <button type="button" className={`comply-view ${view === 'requirements' ? 'on' : ''}`} onClick={() => set({ view: 'requirements' })}>Requirements<em>{reqRows.length}</em></button>
          {hasIso && <button type="button" className={`comply-view ${view === 'soa' ? 'on' : ''}`} onClick={() => set({ view: 'soa' })}>Statement of Applicability<em>{soa.length}</em></button>}
        </div>
        {view !== 'soa' && (
          <div className="comply-facets">
            <Facet label="Framework" value={fw} onChange={(v) => set({ framework: v, group: null })} options={c.frameworks.map((f) => ({ id: f.id, label: f.short, n: controls.filter((x) => x.fwId === f.id).length }))} />
            {view === 'controls' && (
              <>
                {(fw !== 'all' || group !== 'all') && <Facet label="Requirement" value={group} onChange={(v) => set({ group: v })} options={groups.filter((g) => inFw(g)).map((g) => ({ id: g.id, label: fw === 'all' ? `${g.fwShort} · ${g.ref} ${g.name}` : `${g.ref} ${g.name}`, n: g.controls }))} />}
                <Facet label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUSES.map((s) => ({ id: s, label: s, n: controls.filter((x) => inFw(x) && x.status === s).length }))} />
                {domain !== 'all' && <Facet label="Domain" value={domain} onChange={(v) => set({ domain: v })} options={[{ id: domain, label: DOMAINS[domain].label }]} />}
                <Toggles label="Scope" items={[{ label: 'Not applicable only', on: naOnly, onChange: (on) => set({ scope: on ? 'na' : null }), n: controls.filter((x) => inFw(x) && x.status === 'Not applicable').length }]} />
              </>
            )}
            {view === 'requirements' && <Toggles label="Coverage" items={[{ label: 'Covered (≥ 80% compliant) only', on: coveredOnly, onChange: (on) => set({ covered: on ? '1' : null }) }]} />}
          </div>
        )}

        {view === 'controls' && (
          <>
            <CountLine filtered={filtered} onClear={() => set({ framework: null, status: null, group: null, domain: null, scope: null })}>
              {fmtNum(rows.length)} of {fmtNum(controls.length)} controls · source {src} · statuses derived from task evidence, not set by hand
            </CountLine>
            <DataTable<ComplyControl>
              rows={rows}
              rowKey={(x) => x.id}
              onRowClick={setOpen}
              search={(x) => `${x.ref} ${x.name} ${x.groupName} ${x.fwShort} ${x.owner}`}
              searchPlaceholder="Search controls…"
              pageSize={25}
              columns={[
                { key: 'ref', header: 'Control', sort: (x) => x.ref, render: (x) => <><div className="t-main" style={{ maxWidth: 380, whiteSpace: 'normal' }}>{x.name}</div><div className="t-sub">{x.ref}{fw === 'all' ? ` · ${x.fwShort}` : ''}</div></> },
                { key: 'req', header: 'Requirement', sort: (x) => x.group, render: (x) => <><div className="t-main" style={{ fontSize: 12 }}>{x.group}</div><div className="t-sub">{x.groupName}</div></> },
                { key: 'tasks', header: 'Tasks', align: 'right', sort: (x) => taskCount.get(x.id) ?? 0, render: (x) => <span className="num">{taskCount.get(x.id) ?? 0}</span> },
                { key: 'status', header: 'Status', sort: (x) => STATUSES.indexOf(x.status), render: (x) => <StatusBadge value={x.status} map={CONTROL_STATUS_COLOR} /> },
                { key: 'app', header: 'Applicability', sort: (x) => (x.status === 'Not applicable' ? 1 : 0), render: (x) => (x.status === 'Not applicable' ? <><Badge color="var(--sev-info)">Not applicable</Badge><div className="t-sub">{x.decidedBy}</div></> : <span className="t-sub">In scope · platform default</span>) },
                { key: 'upd', header: 'Updated', align: 'right', sort: (x) => -x.updatedDays, render: (x) => <span className="t-sub">{ago(x.updatedDays)}</span> },
              ]}
            />
          </>
        )}

        {view === 'requirements' && (
          <>
            <CountLine>{reqRows.length} of {groups.length} requirement groups · a group is covered when at least 80% of its in-scope controls are compliant</CountLine>
            <DataTable<RequirementGroup>
              rows={reqRows}
              rowKey={(g) => g.id}
              onRowClick={(g) => set({ view: null, framework: g.fwId, group: g.id, covered: null })}
              search={(g) => `${g.ref} ${g.name} ${g.fwShort}`}
              searchPlaceholder="Filter requirements…"
              pageSize={25}
              columns={[
                { key: 'ref', header: 'Requirement', sort: (g) => g.ref, render: (g) => <><div className="t-main">{g.ref}</div><div className="t-sub">{g.name}</div></> },
                { key: 'fw', header: 'Framework', sort: (g) => g.fwShort, render: (g) => <Badge>{g.fwShort}</Badge> },
                { key: 'ctl', header: 'Controls', align: 'right', sort: (g) => g.controls, render: (g) => <span className="num">{g.inScope} in scope · {g.controls - g.inScope} N/A</span> },
                { key: 'cov', header: 'Compliant', sort: (g) => g.compliant / Math.max(1, g.inScope), render: (g) => <span className="row" style={{ gap: 8, minWidth: 180 }}><span style={{ flex: 1 }}><Bar value={g.compliant} max={Math.max(1, g.inScope)} color={g.covered ? 'var(--good)' : 'var(--sev-medium)'} size="thin" /></span><b className="num">{g.compliant}/{g.inScope}</b></span> },
                { key: 'state', header: 'Coverage', sort: (g) => (g.covered ? 1 : 0), render: (g) => <Badge color={g.covered ? 'var(--good)' : 'var(--sev-medium)'} dot>{g.covered ? 'Covered' : 'Gaps'}</Badge> },
              ]}
            />
          </>
        )}

        {view === 'soa' && (
          <>
            <CountLine>ISO/IEC 27001:2022 Annex A · {soa.filter((r) => r.applicable).length} applicable, {soa.filter((r) => !r.applicable).length} excluded · every decision carries a justification</CountLine>
            <DataTable<SoaRow>
              rows={soa}
              rowKey={(r) => r.id}
              search={(r) => `${r.id} ${r.name} ${r.justification}`}
              searchPlaceholder="Filter Annex A controls…"
              pageSize={25}
              onRowClick={(r) => { const x = controls.find((k) => k.fwId === 'iso27001' && k.ref === r.id); if (x) setOpen(x); }}
              columns={[
                { key: 'id', header: 'Control', sort: (r) => r.id, render: (r) => <><div className="t-main">{r.id}</div><div className="t-sub">{r.name}</div></> },
                { key: 'app', header: 'Applicable', sort: (r) => (r.applicable ? 1 : 0), render: (r) => <Badge color={r.applicable ? 'var(--good)' : 'var(--sev-info)'} dot>{r.applicable ? 'Yes' : 'Excluded'}</Badge> },
                { key: 'by', header: 'Decided by', sort: (r) => r.decidedBy, render: (r) => <Badge color={r.decidedBy === 'Client' ? 'var(--text-muted)' : 'var(--m-view)'}>{r.decidedBy}</Badge> },
                { key: 'why', header: 'Justification', render: (r) => <div className="comply-why">{r.justification}</div> },
                { key: 'impl', header: 'Implementation', sort: (r) => r.implemented, render: (r) => <span className="t-sub" style={{ color: r.implemented === 'Implemented' ? 'var(--good)' : r.implemented === 'Partially' ? 'var(--sev-medium)' : undefined }}>{r.implemented}</span> },
              ]}
            />
          </>
        )}
      </Card>

      {open && (() => {
        const x = open;
        const f = c.frameworks.find((k) => k.id === x.fwId)!;
        const r = rng(`ctld-${c.id}-${x.id}`);
        const own = tasks.filter((t) => t.controlId === x.id);
        const created = r.int(200, 900);
        const reviewIn = r.int(20, 300);
        const na = x.status === 'Not applicable';
        const same = controls.filter((k) => k.id !== x.id && k.fwId !== x.fwId && k.domain === x.domain && k.status !== 'Not applicable').slice(0, 3);
        const ls = x.loopControl ? loops(c, tenantId).filter((l) => l.controlId === x.loopControl) : [];
        const lsum = loopSummary(ls);
        const close = () => { setOpen(null); set({ id: null }); };
        return (
          <RecordDrawer
            id={x.ref}
            recordId={`control ctl-n${String(r.int(10, 999)).padStart(3, '0')}`}
            version="applicability v1"
            updatedDays={x.updatedDays}
            title={x.name}
            badges={<><StatusBadge value={x.status} map={CONTROL_STATUS_COLOR} /><Badge>Standard content</Badge><Badge color={tone}>{x.fwShort}</Badge></>}
            onClose={close}
            actions={x.loopControl ? <Btn onClick={() => nav(`/loop?framework=${x.fwId}&control=${x.loopControl}`)}>Loops for {x.loopControl} <ArrowRight /></Btn> : undefined}
          >
            <RSec title="Description">
              <p className="cmp-desc">{f.name}, {x.group} {x.groupName}: {c.short} shows that {x.name.charAt(0).toLowerCase()}{x.name.slice(1)} is defined, implemented and reviewed across the certified scope, with evidence refreshed at least every {r.pick([90, 180, 365])} days. Control category: {DOMAINS[x.domain].label.toLowerCase()}.</p>
            </RSec>
            <RSec title="Record" rows={[['Control category', DOMAINS[x.domain].label], ['Active', 'Yes'], ['Created', ago(created)], ['Owner', x.owner]]} />
            <RSec title="Applicability" rows={[
              ['In scope', na ? 'No' : 'Yes'],
              ['Justification', na ? x.justification : 'Applies to the full certified scope'],
              ['Source', na ? x.decidedBy : 'Platform default'],
              ['Review date', x.reviewOverdue ? <span style={{ color: 'var(--bad)', fontWeight: 700 }}>{ago(r.int(5, 60))} · overdue</span> : ahead(reviewIn)],
              ['Decided at', ago(r.int(30, 400))],
              ['Decided by', na ? (x.decidedBy === 'HexaShield override' ? 'HexaShield GRC analyst' : c.people.grcLead.name) : 'HexaComply'],
            ]} note={na ? 'Excluded controls stay on the register with their justification and come back for review; an auditor sees the same record.' : 'Applicability comes from the framework selection. A client or HexaShield override would be recorded here with its reason.'} />
            {x.loopControl && (
              <Callout color="var(--m-view)"><b>Assurance:</b> mapped to {x.loopControl} in the loop engine · {lsum.closed}/{lsum.applicable} loops closed ({lsum.assuredPct}% assured). Documented means fresh evidence; assured means the linked detections were also proven by HexaStrike.</Callout>
            )}
            <RSec title="Requirements">
              <div className="cmp-list">
                <button type="button" className="cmp-list-row" onClick={() => { close(); set({ view: null, framework: x.fwId, group: `${x.fwId}:${x.group}`, status: null, id: null }); }}>
                  <span><b>{x.group} · {x.groupName}</b><span className="s">{f.name}</span></span><ArrowRight size={13} />
                </button>
                {same.map((k) => (
                  <button key={k.id} type="button" className="cmp-list-row" onClick={() => setOpen(k)}>
                    <span><b>{k.fwShort} {k.ref} · {k.name}</b><span className="s">Same control domain in another framework · {k.status}</span></span><ArrowRight size={13} />
                  </button>
                ))}
              </div>
            </RSec>
            <RSec title={`Tasks (${own.length})`}>
              <div className="cmp-list">
                {own.slice(0, 4).map((t) => (
                  <button key={t.id} type="button" className="cmp-list-row" onClick={() => go('tasks', { control: x.id, id: t.id })}>
                    <span><b>{t.ref} · {t.title}</b><span className="s">{t.owner} · {t.evidence} evidence</span></span>
                    <StatusBadge value={t.status} map={TASK_STATUS_COLOR} />
                  </button>
                ))}
              </div>
            </RSec>
            <LinkedRecords items={[
              { label: `View the ${own.length} task${own.length === 1 ? '' : 's'} for this control →`, sub: 'Tasks & Evidence, filtered to this control', count: own.length, onClick: () => go('tasks', { control: x.id }) },
              { label: 'Evidence for this control', sub: `${own.reduce((s, t) => s + t.evidence, 0)} items across its tasks`, onClick: () => go('tasks', { view: 'evidence', control: x.id }) },
              { label: 'Workflow questions', sub: 'Stream › the questions that establish this control', onClick: () => go('stream', { framework: x.fwId }) },
            ]} />
          </RecordDrawer>
        );
      })()}
    </>
  );
}
