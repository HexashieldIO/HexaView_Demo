import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Activity, Building2, CalendarCheck, Server } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import type { BiaService } from '../../../data/modules/comply';
import { Card, Badge, Btn, Callout, StatusBadge, Freshness } from '../../../components/ui';
import { FlowMap, type FlowColumn, type FlowLink } from '../../../components/FlowMap';
import { DataTable } from '../../../components/DataTable';
import { MetricBand, Facet, StateKey, WriteBackModal, Field } from '../parts';
import { useContinuityData, useRiskData, useWorkspaceData } from '../useComply';
import { useQuery, useDeepLink, SectionHead, Toggles, CountLine, RecordDrawer, RSec, LinkedRecords, ago, ahead } from './shared';

const tone = MODULE_BY_ID.comply.tone;
const PRIORITIES = ['Immediate', 'High', 'Medium', 'Low'] as const;
const PRIORITY_COLOR: Record<string, string> = { Immediate: 'var(--sev-critical)', High: 'var(--sev-high)', Medium: 'var(--sev-medium)', Low: 'var(--sev-low)' };
const RESULT_COLOR: Record<string, string> = { Pass: 'var(--good)', Partial: 'var(--sev-medium)', Fail: 'var(--bad)', 'Not tested': 'var(--sev-info)' };
const STATUS_COLOR: Record<string, string> = { Confirmed: 'var(--good)', Draft: 'var(--sev-info)', 'AI Draft': 'var(--m-ai)' };
const IMPACT_NAMES = ['Financial', 'Operational', 'Regulatory', 'Reputational'];
const isCritical = (b: BiaService) => b.priority === 'Immediate';

export function hrs(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h >= 48 && h % 24 === 0) return `${h / 24} days`;
  return `${h} h`;
}
const word = (w: string) => w.split(/[\s(/]/)[0].toLowerCase();
const OP_DIM: Record<string, string> = {
  healthcare: 'Patient safety', automotive: 'Production & safety', maritime: 'Operations & safety',
  insurance: 'Policyholder service', defence: 'Mission & delivery', pharma: 'Patient supply & quality', sghospital: 'Patient safety', studio: 'Guest safety & release',
};

const SECTOR: Record<string, { title: string; body: ReactNode }> = {
  healthcare: { title: 'Epic downtime readiness', body: <>Downtime procedures are in place on every unit: BCA read-only workstations, paper order sets and downtime registration. The last full downtime drill ran <b>7 h against a 4 h target</b>; BCA workstations were missing on 3 units. Ambulance diversion is considered after 2 h without the EHR.</> },
  automotive: { title: 'JIT/JIS line-stop exposure', body: <>Parts arrive just in time and in sequence: Ingolstadt line buffers cover <b>2.5 h</b> before the line stops at about <b>€22k per minute</b>. The battery plant is air-gapped and restores only from the signed data-diode bundle; OTA campaigns can be paused and rolled back in under 4 h.</> },
  maritime: { title: 'Terminal and fleet continuity', body: <>Berthing runs on a single Navis N4 production instance with a warm standby in Antwerp; manual crane sequencing covers 8 h. Vessels fall back to paper charts and manual watchkeeping under the SMS. Backup evidence is ageing while the Veeam integration is broken.</> },
  finserv: { title: 'Impact tolerances (FCA SYSC 15A / DORA Art. 11–12)', body: <>Each important business service has a board-approved impact tolerance. Faster Payments recovered in <b>2.5 h within its 4 h tolerance</b> in the last severe-but-plausible scenario test; the single card-acquiring HSM cluster remains a single point of failure.</> },
  insurance: { title: 'Claims continuity through a catastrophe', body: <>First notice of loss and claims payments run on a single Guidewire ClaimCenter cloud tenant; the contact centre falls back to paper FNOL scripts and a manual cheque run. In a landfall week claims volume reaches <b>4x normal</b>, and the last ransomware tabletop drafted the NYDFS 72-hour notice in <b>30 h</b>.</> },
  defence: { title: 'Programme delivery and the CUI enclave', body: <>Prime deliveries depend on the GCC High enclave and Teamcenter; both restore from immutable Rubrik copies. Building 3 can machine from the signed offline CNC library for <b>6 h</b>. Late deliveries cost about <b>$18k per day</b> in penalties, and the Tucson range records locally while its WAN link is saturated.</> },
  pharma: { title: 'Batch release and patient supply', body: <>Batch release runs on PAS-X and LabWare; the approved contingency SOP allows paper batch records, but the last drill took <b>3 days</b> to reconcile. Cork can safe-state the aseptic line and restart only after the media fill is reviewed. Trials keep running on paper CRFs with phone unblinding.</> },
  sghospital: { title: 'TrakCare downtime and the MOH clock', body: <>Downtime procedures are in place on every ward: read-only workstations, paper order sets and manual registration. The last drill ran <b>6.5 h against a 4 h target</b>, and the tabletop reached MOH notification at <b>3 h 10 min</b> against the 2-hour requirement. A&E diversion is considered after 2 h without the EHR.</> },
  studio: { title: 'Release, streaming and park continuity', body: <>Starfall+ fails over to a second region in about <b>6 minutes</b>; London finishing restores from immutable masters, which took 16 h against a 12 h objective. Rides fail safe and reopen only after inspection; ticketing validates offline for up to 6 h.</> },
  media: { title: 'On-air and editorial continuity', body: <>Live playout can switch to the DR gallery in about 4 minutes; rights penalties run at around $120k per minute off air. Editorial restores from immutable masters took 14 h against an 8 h objective in the last test.</> },
};

export default function BiaSection() {
  const { customer: c, tenantId, toast } = useApp();
  const { p, set, go } = useQuery();
  const { bia, assets } = useContinuityData();
  const risks = useRiskData();
  const { vendorsReg } = useWorkspaceData();
  const conns = scopedConnectors(c, tenantId);
  const backups = conns.filter((k) => k.category === 'Backup');
  const grc = conns.find((k) => k.category === 'GRC');
  const src = `${grc ? `${grc.vendor} ${grc.product}` : 'HexaComply'} BIA register${backups.length ? ` · ${backups.map((k) => k.product).join(', ')}` : ''}`;

  const status = p('status') ?? 'all';
  const priority = p('priority') ?? 'all';
  const critOnly = p('critical') === '1';
  const overdue = p('lifecycle') === 'overdue' || p('review') === 'overdue';
  const spofOnly = p('spof') === '1';
  const result = p('result') ?? 'all';
  const clear = () => set({ status: null, priority: null, critical: null, lifecycle: null, review: null, spof: null, result: null, id: null });
  const rows = bia.filter((b) => (status === 'all' || b.status === status) && (priority === 'all' || b.priority === priority) && (!critOnly || isCritical(b)) && (!overdue || b.nextReviewDays < 0) && (!spofOnly || !!b.spof) && (result === 'all' || b.testResult === result));
  const filtered = status !== 'all' || priority !== 'all' || critOnly || overdue || spofOnly || result !== 'all';

  const [open, setOpen] = useState<BiaService | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [testModal, setTestModal] = useState<BiaService | null>(null);
  const [testType, setTestType] = useState('Restore test');
  const match = useCallback((b: BiaService, id: string) => b.id === id, []);
  useDeepLink(bia, match, setOpen);

  const focusSvc = bia.find((b) => b.id === focus) ?? bia.find(isCritical) ?? bia[0];
  const maxH = Math.max(1, ...bia.map((b) => Math.max(b.mtpdH, b.testedRtoH ?? 0)));
  const scaleH = (h: number) => `${Math.min(100, (Math.log10(1 + h * 4) / Math.log10(1 + maxH * 4)) * 100)}%`;
  const linkedAssets = useCallback((b: BiaService) => assets.filter((a) => b.systems.some((s) => a.base.toLowerCase().includes(word(s)) || s.toLowerCase().includes(word(a.base)))), [assets]);
  const linkedVendors = useCallback((b: BiaService) => b.suppliers.map((s) => ({ s, v: vendorsReg.find((v) => v.name.toLowerCase().includes(word(s)) || s.toLowerCase().includes(word(v.name))) })), [vendorsReg]);

  const flow = useMemo(() => {
    if (!focusSvc) return null;
    const b = focusSvc;
    const dims = ['Financial', OP_DIM[c.id] ?? OP_DIM[c.dataKey] ?? 'Operational', 'Regulatory', 'Reputational'];
    const isSpof = (s: string) => !!b.spof && b.spof.toLowerCase().includes(word(s));
    const columns: FlowColumn[] = [
      { label: 'Suppliers', nodes: b.suppliers.map((s) => ({ id: `s-${s}`, title: s, sub: 'third party', icon: <Building2 size={13} />, onClick: () => { const v = linkedVendors(b).find((x) => x.s === s)?.v; go('vendors', v ? { id: v.id } : {}); } })) },
      { label: 'Systems', nodes: b.systems.map((s) => ({ id: `y-${s}`, title: s, sub: isSpof(s) ? 'single point of failure' : 'dependency', state: isSpof(s) ? 'bad' as const : undefined, icon: <Server size={13} /> })) },
      { label: 'Business service', nodes: [{ id: 'svc', title: b.name, count: hrs(b.rtoH), sub: `RTO · tolerance ${hrs(b.mtpdH)}`, color: 'var(--m-comply)', icon: <Activity size={13} />, onClick: () => setOpen(b) }] },
      { label: 'Impact if lost', nodes: dims.map((d, i) => ({ id: `i-${i}`, title: d, count: ['Low', 'Medium', 'High'][b.impacts[i] - 1], state: b.impacts[i] === 3 ? 'bad' as const : b.impacts[i] === 2 ? 'warn' as const : 'good' as const })) },
    ];
    const links: FlowLink[] = [
      ...b.suppliers.map((s, i) => ({ from: `s-${s}`, to: `y-${b.systems[i % b.systems.length]}`, value: 2 })),
      ...b.systems.map((s) => ({ from: `y-${s}`, to: 'svc', value: 3, bad: isSpof(s) })),
      ...dims.map((_, i) => ({ from: 'svc', to: `i-${i}`, value: b.impacts[i], bad: b.impacts[i] === 3 })),
    ];
    return { columns, links };
  }, [focusSvc, c.id, go, linkedVendors]);

  const tested = bia.filter((b) => b.testedRtoH !== null);

  return (
    <>
      <SectionHead intro={<>Business services scored for impact, with recovery objectives and dependencies. Criticality is the product of the four impacts (1–3 each), computed by HexaComply; dependencies link to the asset, risk and vendor registers.</>} />
      <MetricBand tone={tone} items={[
        { ac: 'Services', word: 'Assessed', value: bia.length, unit: `${bia.filter(isCritical).length} immediate priority`, active: !filtered, onClick: clear, source: src },
        { ac: 'Critical', word: 'Immediate', value: bia.filter(isCritical).length, unit: 'services', color: 'var(--sev-critical)', active: critOnly, onClick: () => { clear(); set({ critical: '1' }); }, source: src },
        { ac: 'Within RTO', word: 'Last test', value: `${bia.filter((b) => b.testResult === 'Pass').length}/${tested.length}`, unit: 'tested services', gauge: (bia.filter((b) => b.testResult === 'Pass').length / Math.max(1, tested.length)) * 100, active: result === 'Pass', onClick: () => { clear(); set({ result: 'Pass' }); }, source: src },
        { ac: 'SPOF', word: 'Single points of failure', value: bia.filter((b) => b.spof).length, unit: 'services', color: 'var(--sev-high)', active: spofOnly, onClick: () => { clear(); set({ spof: '1' }); }, source: src },
        { ac: 'Review overdue', word: 'Lifecycle', value: bia.filter((b) => b.nextReviewDays < 0).length, unit: 'services', color: 'var(--bad)', active: overdue, onClick: () => { clear(); set({ lifecycle: 'overdue' }); }, source: src },
      ]} />
      <Callout color={tone}><b>{(SECTOR[c.id] ?? SECTOR[c.dataKey]).title}.</b> {(SECTOR[c.id] ?? SECTOR[c.dataKey]).body}</Callout>

      <div className="grid comply-split">
        <Card title="Recovery objectives vs last test" sub="Bar = RTO · shaded = impact tolerance · dot = time achieved in the last test · log scale · click a service" actions={backups[0] && <Freshness minutes={backups[0].lastSyncMin} stale={backups[0].status !== 'healthy'} label={backups[0].product} />}>
          {bia.map((b) => (
            <button key={b.id} type="button" className="comply-rto" onClick={() => setFocus(b.id)} title={`RTO ${hrs(b.rtoH)} · tolerance ${hrs(b.mtpdH)} · tested ${b.testedRtoH === null ? 'never' : hrs(b.testedRtoH)}`}>
              <span className="comply-rto-name" style={focusSvc?.id === b.id ? { color: 'var(--m-comply)' } : undefined}>{b.name}</span>
              <span className="comply-rto-track">
                <span className="comply-rto-tol" style={{ width: scaleH(b.mtpdH) }} />
                <span className="comply-rto-target" style={{ width: scaleH(b.rtoH) }} />
                {b.testedRtoH !== null && <span className="comply-rto-actual" style={{ left: scaleH(b.testedRtoH), background: RESULT_COLOR[b.testResult] }} />}
              </span>
              <span className="comply-rto-val">{hrs(b.rtoH)} · {b.testedRtoH === null ? <span style={{ color: 'var(--sev-info)' }}>untested</span> : <b style={{ color: RESULT_COLOR[b.testResult] }}>{hrs(b.testedRtoH)}</b>}</span>
            </button>
          ))}
          <div className="comply-keys">
            {(['Pass', 'Partial', 'Fail', 'Not tested'] as const).map((r) => <StateKey key={r} color={RESULT_COLOR[r]} label={r} n={bia.filter((b) => b.testResult === r).length} on={result === r} onClick={() => set({ result: result === r ? null : r })} />)}
          </div>
        </Card>
        {flow && focusSvc && (
          <Card title={`Dependencies · ${focusSvc.name}`} sub="Suppliers and systems the service needs, and what is lost if it stops" actions={<Btn sm onClick={() => setOpen(focusSvc)}>Open record</Btn>}>
            <div className="comply-flow"><FlowMap columns={flow.columns} links={flow.links} height={280} /></div>
          </Card>
        )}
      </div>

      <Card flush>
        <div className="comply-facets">
          <Facet label="Status" value={status} onChange={(v) => set({ status: v })} options={(['Confirmed', 'Draft', 'AI Draft'] as const).map((x) => ({ id: x as string, label: x, n: bia.filter((b) => b.status === x).length }))} />
          <Facet label="Priority" value={priority} onChange={(v) => set({ priority: v })} options={PRIORITIES.map((x) => ({ id: x as string, label: x, n: bia.filter((b) => b.priority === x).length }))} />
          {result !== 'all' && <Facet label="Last test" value={result} onChange={(v) => set({ result: v })} options={(['Pass', 'Partial', 'Fail', 'Not tested'] as const).map((x) => ({ id: x as string, label: x }))} />}
          <Toggles label="Lifecycle" items={[
            { label: 'Critical only', on: critOnly, onChange: (on) => set({ critical: on ? '1' : null }), n: bia.filter(isCritical).length },
            { label: 'Review overdue', on: overdue, onChange: (on) => set({ lifecycle: on ? 'overdue' : null, review: null }), n: bia.filter((b) => b.nextReviewDays < 0).length },
            { label: 'Single point of failure', on: spofOnly, onChange: (on) => set({ spof: on ? '1' : null }), n: bia.filter((b) => b.spof).length },
          ]} />
        </div>
        <CountLine filtered={filtered} onClear={clear}>{rows.length} of {bia.length} business services · criticality = financial × operational × regulatory × reputational</CountLine>
        <DataTable<BiaService>
          rows={rows}
          rowKey={(b) => b.id}
          onRowClick={setOpen}
          initialSort={{ key: 'crit', dir: 'desc' }}
          empty="No business services recorded for this tenant."
          columns={[
            { key: 'svc', header: 'Service', sort: (b) => b.name, render: (b) => <><div className="t-main">{b.name}</div><div className="t-sub"><span className="mono">{b.id}</span> · {b.owner}</div></> },
            { key: 'imp', header: 'Impacts (F · O · Rg · Rp)', render: (b) => <span className="cmp-imp" title={IMPACT_NAMES.map((n, i) => `${n} ${b.impacts[i]}`).join(' · ')}>{b.impacts.map((v, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <i>·</i>}<span className={`v${v}`}>{v}</span></span>)}</span> },
            { key: 'crit', header: 'Criticality', align: 'right', sort: (b) => b.criticality, render: (b) => <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><b className="num">{b.criticality}</b><Badge color={PRIORITY_COLOR[b.priority]}>{b.priority}</Badge></span> },
            { key: 'fw', header: 'Framework(s)', render: (b) => <span className="t-sub">{b.frameworks.join(', ')}</span> },
            { key: 'rto', header: 'RTO / RPO', sort: (b) => b.rtoH, render: (b) => <><div className="t-main">{hrs(b.rtoH)}</div><div className="t-sub">RPO {hrs(b.rpoH)}</div></> },
            { key: 'spof', header: 'SPOF', sort: (b) => (b.spof ? 1 : 0), render: (b) => (b.spof ? <span className="t-sub" style={{ color: 'var(--sev-high)', whiteSpace: 'normal', maxWidth: 200, display: 'block' }}>{b.spof}</span> : <span className="t-sub">None</span>) },
            { key: 'review', header: 'Next review', align: 'right', sort: (b) => b.nextReviewDays, render: (b) => <span className="t-sub" style={{ color: b.nextReviewDays < 0 ? 'var(--bad)' : undefined, fontWeight: b.nextReviewDays < 0 ? 700 : undefined }}>{b.nextReviewDays < 0 ? `${-b.nextReviewDays} d overdue` : ahead(b.nextReviewDays)}</span> },
            { key: 'status', header: 'Status', sort: (b) => b.status, render: (b) => <StatusBadge value={b.status} map={STATUS_COLOR} /> },
          ]}
        />
      </Card>

      {open && (() => {
        const b = open;
        const la = linkedAssets(b);
        const lr = risks.filter((r) => la.some((a) => a.base === r.asset) || b.systems.some((s) => r.asset.toLowerCase().includes(word(s))));
        const lv = linkedVendors(b);
        const close = () => { setOpen(null); set({ id: null }); };
        return (
          <RecordDrawer id={b.id} recordId={`bia ${b.id.toLowerCase()}-${b.tenant}`} updatedDays={Math.max(1, (b.lastTestDays ?? 60) % 50)} title={b.name}
            badges={<><Badge color={PRIORITY_COLOR[b.priority]} solid>{b.priority} priority</Badge><StatusBadge value={b.status} map={STATUS_COLOR} /><Badge color={RESULT_COLOR[b.testResult]} dot>Last test: {b.testResult}</Badge></>}
            onClose={close}
            actions={<Btn primary color={tone} onClick={() => setTestModal(b)}><CalendarCheck /> Schedule recovery test</Btn>}>
            <div className="cmp-bigscores">
              <div><small>Criticality</small><b style={{ color: PRIORITY_COLOR[b.priority] }}>{b.criticality}</b><span>of 81</span></div>
              <div><small>RTO</small><b>{hrs(b.rtoH)}</b><span>tolerance {hrs(b.mtpdH)}</span></div>
              <div><small>RPO</small><b>{hrs(b.rpoH)}</b><span>data loss tolerated</span></div>
              <div><small>Recovery priority</small><b>{b.priority}</b><span>{b.frameworks.join(', ')}</span></div>
            </div>
            <RSec title="Impact assessment" rows={[
              ...IMPACT_NAMES.map((n, i) => [n, `${b.impacts[i]} · ${['Low', 'Medium', 'High'][b.impacts[i] - 1]}`] as [string, string]),
              ['Criticality', `${b.impacts.join(' × ')} = ${b.criticality}`],
            ]} note="Criticality is the product of the four impacts and is computed by HexaComply." />
            <RSec title="Recovery" rows={[
              ['RTO', hrs(b.rtoH)], ['RPO', hrs(b.rpoH)], ['Impact tolerance', hrs(b.mtpdH)],
              ['Single point of failure', b.spof ? <span key="s" style={{ color: 'var(--sev-high)', fontWeight: 600 }}>{b.spof}</span> : 'None recorded'],
              ['Strategy', b.strategy], ['Recovery priority', b.priority], ['Vendor dependencies', b.suppliers.join(', ')], ['Systems', b.systems.join(', ')],
              ['Last test', b.testedRtoH === null ? 'Never tested' : `${hrs(b.testedRtoH)} · ${b.testResult} · ${ago(b.lastTestDays ?? 0)}`],
            ]} />
            {b.metrics.length > 0 && <div className="mini-stats">{b.metrics.map(([k, v]) => <div key={k} className="mini-stat"><b>{v}</b><span>{k}</span></div>)}</div>}
            {(b.testResult === 'Fail' || b.testResult === 'Partial') && <Callout kind="warn">The last test missed the {hrs(b.rtoH)} objective{b.testedRtoH !== null && b.testedRtoH > b.mtpdH ? ' and breached the impact tolerance' : ''}. A re-test is required before the next audit.</Callout>}
            <RSec title="Review" rows={[
              ['Last review', ago(Math.max(10, 365 + Math.min(0, b.nextReviewDays) - Math.max(0, b.nextReviewDays)))], ['Next review', b.nextReviewDays < 0 ? <span key="n" style={{ color: 'var(--bad)', fontWeight: 700 }}>{-b.nextReviewDays} days overdue</span> : ahead(b.nextReviewDays)],
              ['Assessed by', b.status === 'AI Draft' ? 'HexaComply AI draft · awaiting owner' : b.owner], ['Notes', b.status === 'Confirmed' ? 'Confirmed by the service owner.' : 'Draft: impacts and objectives not yet signed off.'],
            ]} />
            <LinkedRecords items={[
              { label: `Assets (${la.length})`, sub: la.slice(0, 3).map((a) => a.base).join(' · ') || 'No matching assets on the register', count: la.length, onClick: () => go('assets', la.length ? { base: la[0].base } : {}) },
              ...la.slice(0, 3).map((a) => ({ label: `${a.id} ${a.base}`, sub: `${a.category} · ${a.criticality}`, onClick: () => go('assets', { id: a.id }) })),
              { label: `Risks (${lr.length})`, sub: lr.length ? `Highest residual ${Math.max(...lr.map((r) => r.residualScore ?? r.inherentScore))}` : 'No risks raised against these systems', count: lr.length, onClick: () => go('risks', lr.length ? { asset: lr[0].asset } : {}) },
              ...lv.map(({ s, v }) => ({ label: `Vendor: ${v?.name ?? s}`, sub: v ? `${v.id} · recorded risk ${v.risk}` : 'Not on the vendor register', onClick: () => go('vendors', v ? { id: v.id } : {}) })),
            ]} />
          </RecordDrawer>
        );
      })()}

      {testModal && (
        <WriteBackModal title="Schedule recovery test" target={grc ? grc.product : 'HexaComply'} risk="low" approvals={`Service owner: ${testModal.owner}`} submitLabel="Schedule"
          onClose={() => setTestModal(null)}
          onSubmit={() => { toast(`${testType} scheduled for ${testModal.name} · owner ${testModal.owner} notified`); setTestModal(null); }}
          changes={[['Service', `${testModal.id} · ${testModal.name}`], ['Objective', `RTO ${hrs(testModal.rtoH)} · RPO ${hrs(testModal.rpoH)}`], ['Type', testType], ['Evidence', 'Result recorded against the continuity controls']]}>
          <Field label="Test type">
            <select className="select" value={testType} onChange={(e) => setTestType(e.target.value)}>{['Restore test', 'Failover test', 'Tabletop exercise', 'Full DR exercise'].map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
        </WriteBackModal>
      )}
    </>
  );
}
