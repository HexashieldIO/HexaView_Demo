import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Send, Server, Building2, Activity, LifeBuoy } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { scopedConnectors, isStale, tenantName } from '../../data/customers';
import { MODULE_BY_ID } from '../../modules/registry';
import { exercises, type BiaService, type RegAsset, type Exercise } from '../../data/modules/comply';
import { Card, KpiStrip, Badge, Btn, KV, Callout, SectionLabel, Sources, Freshness, Timeline, StatusBadge } from '../../components/ui';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtNum } from '../../lib/format';
import { WriteBackModal, Field, Facet, ImpactDots, StateKey } from './parts';
import { useContinuityData } from './useComply';

const tone = MODULE_BY_ID.comply.tone;
const PRIORITY_COLOR = { Immediate: 'var(--sev-critical)', High: 'var(--sev-high)', Medium: 'var(--sev-medium)', Low: 'var(--sev-low)' } as const;
const RESULT_COLOR = { Pass: 'var(--good)', Partial: 'var(--sev-medium)', Fail: 'var(--bad)', 'Not tested': 'var(--sev-info)' } as const;
const STATUS_COLOR = { Confirmed: 'var(--good)', Draft: 'var(--sev-info)', 'AI Draft': 'var(--m-ai)' };

function hrs(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h >= 48 && h % 24 === 0) return `${h / 24} days`;
  return `${h} h`;
}

export default function ComplyContinuity() {
  const { customer: c, tenantId, toast } = useApp();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { bia, assets } = useContinuityData();
  const ex = useMemo(() => exercises(c), [c]);
  const conns = scopedConnectors(c, tenantId);
  const backups = conns.filter((k) => k.category === 'Backup');
  const grc = conns.find((k) => k.category === 'GRC');
  const grcName = grc ? `${grc.vendor} ${grc.product}` : 'HexaComply';
  const src = `${grcName} BIA register${backups.length ? ` · ${backups.map((k) => k.product).join(', ')}` : ''}`;

  const p = (k: string) => sp.get(k);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  };
  const view = (p('view') as 'bia' | 'assets' | null) ?? 'bia';
  const priority = p('priority') ?? 'all';
  const result = p('result') ?? 'all';
  const bstatus = p('status') ?? 'all';
  const reviewOverdue = p('review') === 'overdue';
  const spofOnly = p('spof') === '1';
  const category = p('category') ?? 'all';
  const crit = p('criticality') ?? 'all';
  const eos = p('lifecycle') === 'eos';
  const openId = p('id');

  const biaRows = bia.filter((b) => (priority === 'all' || b.priority === priority) && (result === 'all' || b.testResult === result) && (bstatus === 'all' || b.status === bstatus) && (!reviewOverdue || b.nextReviewDays < 0) && (!spofOnly || !!b.spof));
  const isEos = (a: RegAsset) => a.supportEndDays !== null && a.supportEndDays < 0 && (a.status === 'Active' || a.status === 'Legacy');
  const assetRows = assets.filter((a) => (category === 'all' || a.category === category) && (crit === 'all' || a.criticality === crit) && (!eos || isEos(a)));

  const [open, setOpen] = useState<BiaService | null>(null);
  const [assetOpen, setAssetOpen] = useState<RegAsset | null>(null);
  const [handled, setHandled] = useState<string | null>(null);
  if (openId && handled !== openId) {
    setHandled(openId);
    const b = bia.find((x) => x.id === openId);
    const a = assets.find((x) => x.id === openId);
    if (b) setOpen(b); else if (a) setAssetOpen(a);
  }
  const [focus, setFocus] = useState<string | null>(null);
  const [testModal, setTestModal] = useState<BiaService | null>(null);
  const [reviewModal, setReviewModal] = useState<BiaService | null>(null);
  const [testType, setTestType] = useState('Restore test');

  const immediate = bia.filter((b) => b.priority === 'Immediate');
  const tested = bia.filter((b) => b.testedRtoH !== null);
  const passed = bia.filter((b) => b.testResult === 'Pass');
  const outside = bia.filter((b) => b.testResult === 'Fail' || b.testResult === 'Partial');
  const overdue = bia.filter((b) => b.nextReviewDays < 0);
  const spofs = bia.filter((b) => b.spof);
  const eosAssets = assets.filter(isEos);
  const focusSvc = bia.find((b) => b.id === focus) ?? immediate[0] ?? bia[0];
  const maxH = Math.max(1, ...bia.map((b) => Math.max(b.mtpdH, b.testedRtoH ?? 0)));
  const scaleH = (h: number) => `${Math.min(100, (Math.log10(1 + h * 4) / Math.log10(1 + maxH * 4)) * 100)}%`;

  // Dependency flow for the focused service.
  const flow = useMemo(() => {
    if (!focusSvc) return null;
    const dims = ['Financial', c.id === 'healthcare' ? 'Patient safety' : c.id === 'automotive' ? 'Production & safety' : c.id === 'maritime' ? 'Operations & safety' : 'Operational', 'Regulatory', 'Reputational'];
    const columns: FlowColumn[] = [
      { label: 'Suppliers', nodes: focusSvc.suppliers.map((s) => ({ id: `s-${s}`, title: s, sub: 'third party', icon: <Building2 size={13} />, onClick: () => nav('/comply/tprm') })) },
      { label: 'Systems', nodes: focusSvc.systems.map((s) => ({ id: `y-${s}`, title: s, sub: focusSvc.spof && focusSvc.spof.includes(s.split(' (')[0]) ? 'single point of failure' : 'dependency', state: focusSvc.spof && focusSvc.spof.includes(s.split(' (')[0]) ? 'bad' as const : undefined, icon: <Server size={13} /> })) },
      { label: 'Business service', nodes: [{ id: 'svc', title: focusSvc.name, count: hrs(focusSvc.rtoH), sub: `RTO · tolerance ${hrs(focusSvc.mtpdH)}`, color: 'var(--m-comply)', icon: <Activity size={13} />, onClick: () => setOpen(focusSvc) }] },
      { label: 'Impact if lost', nodes: dims.map((d, i) => ({ id: `i-${i}`, title: d, count: ['Low', 'Medium', 'High'][focusSvc.impacts[i] - 1], state: focusSvc.impacts[i] === 3 ? 'bad' as const : focusSvc.impacts[i] === 2 ? 'warn' as const : 'good' as const })) },
    ];
    const links: FlowLink[] = [
      ...focusSvc.suppliers.map((s, i) => ({ from: `s-${s}`, to: `y-${focusSvc.systems[i % focusSvc.systems.length]}`, value: 2 })),
      ...focusSvc.systems.map((s) => ({ from: `y-${s}`, to: 'svc', value: 3, bad: !!focusSvc.spof && focusSvc.spof.includes(s.split(' (')[0]) })),
      ...dims.map((_, i) => ({ from: 'svc', to: `i-${i}`, value: focusSvc.impacts[i], bad: focusSvc.impacts[i] === 3 })),
    ];
    return { columns, links };
  }, [focusSvc, c.id, nav]);

  const sector: Record<string, { title: string; body: ReactNode }> = {
    healthcare: { title: 'Epic downtime readiness', body: <>Downtime procedures are in place on every unit: BCA read-only workstations, paper order sets and downtime registration. The last full downtime drill ran <b>7 h against a 4 h target</b>; BCA workstations were missing on 3 units. Ambulance diversion is considered after 2 h without the EHR.</> },
    automotive: { title: 'JIT/JIS line-stop exposure', body: <>Parts arrive just in time and in sequence: Ingolstadt line buffers cover <b>2.5 h</b> before the line stops at about <b>€22k per minute</b>. The battery plant is air-gapped and restores only from the signed data-diode bundle; OTA campaigns can be paused and rolled back in under 4 h.</> },
    maritime: { title: 'Terminal and fleet continuity', body: <>Berthing runs on a single Navis N4 production instance with a warm standby in Antwerp; manual crane sequencing covers 8 h. Vessels fall back to paper charts and manual watchkeeping under the SMS. Backup evidence is ageing while the Veeam integration is broken.</> },
    finserv: { title: 'Impact tolerances (FCA SYSC 15A / DORA Art. 11–12)', body: <>Each important business service has a board-approved impact tolerance. Faster Payments recovered in <b>2.5 h within its 4 h tolerance</b> in the last severe-but-plausible scenario test; the single card-acquiring HSM cluster remains a single point of failure.</> },
    media: { title: 'On-air and editorial continuity', body: <>Live playout can switch to the DR gallery in about 4 minutes; rights penalties run at around $120k per minute off air. Editorial restores from immutable masters took 14 h against an 8 h objective in the last test.</> },
  };

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: business impact analysis for {bia.length} business services with recovery objectives, impact tolerances, dependencies and test history, plus the asset register behind them. Read from {grcName}{backups.length ? ` with restore evidence from ${backups.map((k) => `${k.vendor} ${k.product}`).join(', ')}` : ''}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Business services', value: bia.length, unit: `${immediate.length} immediate`, onClick: () => set({ view: 'bia', priority: null, result: null, review: null, spof: null, status: null }), source: src },
          { label: 'Tested within RTO', value: `${passed.length}/${tested.length}`, bar: (passed.length / Math.max(1, tested.length)) * 100, toneColor: 'var(--good)', onClick: () => set({ view: 'bia', result: 'Pass' }), source: src },
          { label: 'Outside objective', hint: 'last test', value: outside.length, toneColor: 'var(--sev-high)', onClick: () => set({ view: 'bia', result: outside.some((b) => b.testResult === 'Fail') ? 'Fail' : 'Partial' }), source: src },
          { label: 'Never tested', value: bia.length - tested.length, onClick: () => set({ view: 'bia', result: 'Not tested' }), source: src },
          { label: 'BIA reviews overdue', value: overdue.length, toneColor: 'var(--bad)', onClick: () => set({ view: 'bia', review: 'overdue' }), source: src },
          { label: 'Single points of failure', value: spofs.length, toneColor: 'var(--sev-medium)', onClick: () => set({ view: 'bia', spof: '1' }), source: src },
          { label: 'Assets past support end', value: eosAssets.length, toneColor: 'var(--bad)', onClick: () => set({ view: 'assets', lifecycle: 'eos' }), source: `${grcName} asset register` },
        ]}
      />

      <Callout color={tone}><b>{sector[c.id].title}.</b> {sector[c.id].body}</Callout>

      <div className="grid comply-split">
        <Card title="Recovery objectives vs last test" sub="Bar = RTO target · shaded = impact tolerance (max tolerable disruption) · dot = time achieved in the last test · log scale" actions={backups[0] && <Freshness minutes={backups[0].lastSyncMin} stale={isStale(backups[0]) || backups[0].status !== 'healthy'} label={backups[0].product} />}>
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
            {(['Pass', 'Partial', 'Fail', 'Not tested'] as const).map((r) => <StateKey key={r} color={RESULT_COLOR[r]} label={r} n={bia.filter((b) => b.testResult === r).length} onClick={() => set({ view: 'bia', result: r })} />)}
          </div>
        </Card>

        <Card title={<><LifeBuoy size={15} /> Exercises and tests</>} sub="Recovery tests, drills and tabletops · newest first">
          <Timeline items={ex.map((e: Exercise) => ({
            time: `${e.date} d ago`,
            title: <span>{e.type}: {e.scope} <Badge color={RESULT_COLOR[e.result]}>{e.result}</Badge></span>,
            body: `${e.note} · ${e.findings} finding${e.findings === 1 ? '' : 's'}`,
            color: RESULT_COLOR[e.result],
          }))} />
          <div className="card-foot"><Sources items={[...backups.map((k) => ({ name: k.product, status: k.status })), ...(grc ? [{ name: grc.product, status: grc.status }] : [])]} /></div>
        </Card>
      </div>

      {flow && focusSvc && (
        <Card title={`Dependencies · ${focusSvc.name}`} sub="Suppliers and systems the service needs, and what is lost if it stops · pick another service from the chart above" actions={<Btn sm onClick={() => setOpen(focusSvc)}>Open BIA</Btn>}>
          <div className="comply-flow"><FlowMap columns={flow.columns} links={flow.links} height={260} /></div>
        </Card>
      )}

      <Card flush>
        <div className="comply-views">
          <button type="button" className={`comply-view ${view === 'bia' ? 'on' : ''}`} onClick={() => set({ view: 'bia' })}>Business impact analysis<em>{biaRows.length}</em></button>
          <button type="button" className={`comply-view ${view === 'assets' ? 'on' : ''}`} onClick={() => set({ view: 'assets' })}>Asset register<em>{fmtNum(assetRows.length)}</em></button>
        </div>
        {view === 'bia' ? (
          <>
            <div className="comply-facets">
              <Facet label="Priority" value={priority} onChange={(v) => set({ priority: v })} options={(['Immediate', 'High', 'Medium', 'Low'] as const).map((x) => ({ id: x as string, label: x, n: bia.filter((b) => b.priority === x).length }))} />
              <Facet label="Last test" value={result} onChange={(v) => set({ result: v })} options={(['Pass', 'Partial', 'Fail', 'Not tested'] as const).map((x) => ({ id: x as string, label: x, n: bia.filter((b) => b.testResult === x).length }))} />
              <Facet label="Status" value={bstatus} onChange={(v) => set({ status: v })} options={(['Confirmed', 'Draft', 'AI Draft'] as const).map((x) => ({ id: x as string, label: x }))} />
              <Facet label="Lifecycle" value={reviewOverdue ? 'overdue' : spofOnly ? 'spof' : 'all'} onChange={(v) => set({ review: v === 'overdue' ? 'overdue' : null, spof: v === 'spof' ? '1' : null })} options={[{ id: 'overdue', label: 'Review overdue', n: overdue.length }, { id: 'spof', label: 'Has a single point of failure', n: spofs.length }]} />
            </div>
            <div className="comply-count-line">{biaRows.length} of {bia.length} business services · criticality is the product of the four impacts (1–3 each), computed by HexaComply</div>
            <DataTable<BiaService>
              rows={biaRows}
              rowKey={(b) => b.id}
              onRowClick={setOpen}
              initialSort={{ key: 'crit', dir: 'desc' }}
              empty="No business services recorded for this tenant."
              columns={[
                { key: 'svc', header: 'Service', sort: (b) => b.name, render: (b) => <><div className="t-main">{b.name}</div><div className="t-sub">{b.id} · {b.owner}</div></> },
                { key: 'imp', header: 'Impacts (F · O · R · Rep)', render: (b) => <span className="row" style={{ gap: 8 }}>{b.impacts.map((v, i) => <ImpactDots key={i} v={v} />)}</span> },
                { key: 'crit', header: 'Criticality', align: 'right', sort: (b) => b.criticality, render: (b) => <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><b className="num">{b.criticality}</b><Badge color={PRIORITY_COLOR[b.priority]}>{b.priority}</Badge></span> },
                { key: 'rto', header: 'RTO / RPO', sort: (b) => b.rtoH, render: (b) => <><div className="t-main">{hrs(b.rtoH)}</div><div className="t-sub">RPO {hrs(b.rpoH)} · tolerance {hrs(b.mtpdH)}</div></> },
                { key: 'test', header: 'Last test', sort: (b) => b.testResult, render: (b) => <><Badge color={RESULT_COLOR[b.testResult]} dot>{b.testResult}</Badge>{b.testedRtoH !== null && <div className="t-sub">{hrs(b.testedRtoH)} · {b.lastTestDays} d ago</div>}</> },
                { key: 'spof', header: 'SPOF', sort: (b) => (b.spof ? 1 : 0), render: (b) => (b.spof ? <span className="t-sub" style={{ color: 'var(--sev-high)', whiteSpace: 'normal', maxWidth: 200, display: 'block' }}>{b.spof}</span> : <span className="t-sub">No</span>) },
                { key: 'review', header: 'Next review', align: 'right', sort: (b) => b.nextReviewDays, render: (b) => <span className="t-sub" style={{ color: b.nextReviewDays < 0 ? 'var(--bad)' : undefined, fontWeight: b.nextReviewDays < 0 ? 700 : undefined }}>{b.nextReviewDays < 0 ? `${-b.nextReviewDays} d overdue` : `in ${b.nextReviewDays} d`}</span> },
                { key: 'status', header: 'Status', sort: (b) => b.status, render: (b) => <StatusBadge value={b.status} map={STATUS_COLOR} /> },
              ]}
            />
          </>
        ) : (
          <>
            <div className="comply-facets">
              <Facet label="Category" value={category} onChange={(v) => set({ category: v })} options={[...new Set(assets.map((a) => a.category))].map((x) => ({ id: x as string, label: x, n: assets.filter((a) => a.category === x).length }))} />
              <Facet label="Criticality" value={crit} onChange={(v) => set({ criticality: v })} options={(['Critical', 'Moderate', 'Non-Critical'] as const).map((x) => ({ id: x as string, label: x }))} />
              <Facet label="Lifecycle" value={eos ? 'eos' : 'all'} onChange={(v) => set({ lifecycle: v })} options={[{ id: 'eos', label: 'Past support end, still in use', n: eosAssets.length }]} />
            </div>
            <div className="comply-count-line">{fmtNum(assetRows.length)} of {fmtNum(assets.length)} assets · people, software, hardware, OT and information with CIA levels and business criticality</div>
            <DataTable<RegAsset>
              rows={assetRows}
              rowKey={(a) => a.id}
              onRowClick={setAssetOpen}
              search={(a) => `${a.id} ${a.name} ${a.category} ${a.owner}`}
              searchPlaceholder="Search assets…"
              initialSort={eos ? { key: 'eos', dir: 'asc' } : undefined}
              pageSize={20}
              columns={[
                { key: 'name', header: 'Asset', sort: (a) => a.id, render: (a) => <><div className="t-main">{a.id}</div><div className="t-sub" style={{ maxWidth: 380, whiteSpace: 'normal' }}>{a.name}</div></> },
                { key: 'cat', header: 'Category', sort: (a) => a.category, render: (a) => <span className="t-sub">{a.category}</span> },
                { key: 'cls', header: 'Class', sort: (a) => a.cls, render: (a) => <span className="t-sub">{a.cls}</span> },
                { key: 'crit', header: 'Criticality', sort: (a) => a.criticality, render: (a) => <Badge color={a.criticality === 'Critical' ? 'var(--sev-high)' : a.criticality === 'Moderate' ? 'var(--sev-medium)' : 'var(--text-muted)'}>{a.criticality}</Badge> },
                { key: 'cia', header: 'C · I · A', render: (a) => <span className="mono t-sub">{a.cia.join(' · ')}</span> },
                { key: 'eos', header: 'Support end', align: 'right', sort: (a) => a.supportEndDays ?? 99999, render: (a) => (a.supportEndDays === null ? <span className="t-sub">—</span> : <span className="t-sub" style={{ color: a.supportEndDays < 0 ? 'var(--bad)' : a.supportEndDays < 180 ? 'var(--sev-medium)' : undefined, fontWeight: a.supportEndDays < 0 ? 700 : undefined }}>{a.supportEndDays < 0 ? `${-a.supportEndDays} d ago` : `in ${a.supportEndDays} d`}</span>) },
                { key: 'status', header: 'Status', sort: (a) => a.status, render: (a) => <span className="t-sub">{a.status}</span> },
                { key: 'tenant', header: 'Tenant', sort: (a) => a.tenant, render: (a) => <span className="t-sub">{c.tenants.find((t) => t.id === a.tenant)?.short}</span> },
              ]}
            />
          </>
        )}
      </Card>

      {open && (
        <Drawer
          wide
          title={open.name}
          sub={`${open.id} · ${open.priority} priority · owner ${open.owner}`}
          onClose={() => { setOpen(null); set({ id: null }); }}
          footer={
            <>
              <Btn onClick={() => setReviewModal(open)}><Send /> Request BIA review</Btn>
              <Btn primary color={tone} onClick={() => setTestModal(open)}><CalendarCheck /> Schedule recovery test</Btn>
            </>
          }
        >
          <div className="grid g2" style={{ gap: 18 }}>
            <KV rows={[
              ['Recovery time objective', hrs(open.rtoH)],
              ['Recovery point objective', hrs(open.rpoH)],
              ['Impact tolerance', hrs(open.mtpdH)],
              ['Last test', open.testedRtoH === null ? 'Never tested' : `${hrs(open.testedRtoH)} · ${open.testResult} · ${open.lastTestDays} days ago`],
              ['Single point of failure', open.spof ?? 'None recorded'],
            ]} />
            <KV rows={[
              ['Impacts', <span key="i" className="row" style={{ gap: 10 }}>{['Financial', 'Operational', 'Regulatory', 'Reputational'].map((d, i) => <span key={d} title={d}><ImpactDots v={open.impacts[i]} /></span>)}</span>],
              ['Criticality', `${open.criticality} (${open.priority})`],
              ['Status', open.status],
              ['Next review', open.nextReviewDays < 0 ? `${-open.nextReviewDays} days overdue` : `in ${open.nextReviewDays} days`],
              ['Frameworks', open.frameworks.join(', ')],
            ]} />
          </div>
          {open.metrics.length > 0 && (
            <div className="mini-stats">
              {open.metrics.map(([k, v]) => <div key={k} className="mini-stat"><b>{v}</b><span>{k}</span></div>)}
            </div>
          )}
          <div>
            <SectionLabel>Recovery strategy</SectionLabel>
            <p style={{ fontSize: 13, margin: 0 }}>{open.strategy}</p>
          </div>
          <div className="grid g2" style={{ gap: 18 }}>
            <div>
              <SectionLabel>Systems</SectionLabel>
              <div className="chips">{open.systems.map((s) => <Badge key={s} color={open.spof && open.spof.includes(s.split(' (')[0]) ? 'var(--bad)' : undefined}>{s}</Badge>)}</div>
            </div>
            <div>
              <SectionLabel>Suppliers</SectionLabel>
              <div className="chips">{open.suppliers.map((s) => <button key={s} className="link" style={{ fontSize: 12 }} onClick={() => nav('/comply/tprm')}>{s}</button>)}</div>
            </div>
          </div>
          {open.testResult === 'Fail' || open.testResult === 'Partial' ? <Callout kind="warn">The last test missed the {hrs(open.rtoH)} objective{open.testedRtoH !== null && open.testedRtoH > open.mtpdH ? ' and breached the impact tolerance' : ''}. A re-test is required before the next audit.</Callout> : null}
        </Drawer>
      )}

      {assetOpen && (
        <Drawer title={assetOpen.name} sub={`${assetOpen.id} · ${assetOpen.category}`} onClose={() => { setAssetOpen(null); set({ id: null }); }}
          footer={assetOpen.category === 'OT & devices' ? undefined : <Btn primary color={tone} onClick={() => { toast(`Lifecycle risk raised in ${grcName} for ${assetOpen.id}; owner ${assetOpen.owner} notified`); setAssetOpen(null); }}>Raise lifecycle risk</Btn>}>
          <KV rows={[
            ['Category', assetOpen.category], ['Class', assetOpen.cls], ['Criticality', assetOpen.criticality], ['Confidentiality · integrity · availability', assetOpen.cia.join(' · ')],
            ['Support end', assetOpen.supportEndDays === null ? '—' : assetOpen.supportEndDays < 0 ? `${-assetOpen.supportEndDays} days ago` : `in ${assetOpen.supportEndDays} days`],
            ['Status', assetOpen.status], ['Owner', assetOpen.owner], ['Department', assetOpen.department], ['Tenant', c.tenants.find((t) => t.id === assetOpen.tenant)?.name ?? '—'],
          ]} />
          {assetOpen.category === 'OT & devices'
            ? <Callout kind="warn">OT and medical or plant devices are read-only in HexaView by policy: no actions are offered here. Lifecycle changes go through the site change process with {c.people.otLead?.name ?? 'the OT lead'}.</Callout>
            : isEos(assetOpen) ? <Callout kind="warn">Past vendor support and still in use: no security patches. Record a compensating control or a replacement date.</Callout> : null}
        </Drawer>
      )}

      {testModal && (
        <WriteBackModal
          title="Schedule recovery test"
          target={grcName}
          risk="medium"
          approvals={`Approval: service owner ${testModal.owner}`}
          submitLabel="Schedule test"
          onClose={() => setTestModal(null)}
          onSubmit={() => { toast(`${testType} scheduled for ${testModal.name}; change request raised in ServiceNow and owner ${testModal.owner} asked to approve`); setTestModal(null); }}
          changes={[['Service', testModal.name], ['Test', testType], ['Objective', `Recover within ${hrs(testModal.rtoH)}`], ['Evidence', 'Result attached to the BIA and to continuity controls']]}
        >
          <Field label="Test type">
            <select className="select" value={testType} onChange={(e) => setTestType(e.target.value)}>
              {['Restore test', 'Failover test', 'Tabletop exercise', c.id === 'healthcare' ? 'Epic downtime drill' : c.id === 'automotive' ? 'Line-stop simulation' : 'Manual operations drill'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </WriteBackModal>
      )}

      {reviewModal && (
        <WriteBackModal
          title="Request BIA review"
          target={grcName}
          risk="low"
          approvals="No approval needed"
          submitLabel="Send request"
          onClose={() => setReviewModal(null)}
          onSubmit={() => { toast(`BIA review requested from ${reviewModal.owner} for ${reviewModal.name}; due in 14 days`); setReviewModal(null); }}
          changes={[['Service', reviewModal.name], ['Owner', reviewModal.owner], ['Due', '14 days'], ['Scope', 'Impacts, RTO/RPO, dependencies, tolerance']]}
        />
      )}
    </>
  );
}
