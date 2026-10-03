import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Server, Factory, Globe2, ArrowRight, Activity } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { headlines, resilienceIndex, riTrend, loops, loopSummary, LOOP_STATUS_COLOR } from '../../data/core';
import { attention, feed } from '../../data/overview';
import { scopedConnectors, scopedTenants, isStale } from '../../data/customers';
import { MODULE_BY_ID, CAPABILITIES } from '../../modules/registry';
import { Card, GaugeTile, HexScore, SevBadge, Badge, Bar, Stacked, Legend, Freshness, Btn } from '../../components/ui';
import { HexIcon } from '../../components/HexIcon';
import { Chart } from '../../components/Chart';
import { WorldMap } from '../../components/WorldMap';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtCompact, fmtNum, monthLabels, scoreTone } from '../../lib/format';
import { PlatformMap, type MapNodeInfo } from './PlatformMap';
import type { Env } from '../../data/types';

const ENV_META: Record<Env, { label: string; icon: typeof Cloud; color: string }> = {
  cloud: { label: 'Cloud', icon: Cloud, color: 'var(--m-core)' },
  onprem: { label: 'On-prem & data centre', icon: Server, color: 'var(--m-matrix)' },
  ot: { label: 'Operational technology', icon: Factory, color: 'var(--m-ot)' },
  saas: { label: 'SaaS', icon: Globe2, color: 'var(--m-ai)' },
};

const PERSONA_TIPS = {
  executive: { title: 'For the board', items: [['Board view', '/board'], ['Cyber insurance readiness', '/insurance/overview'], ['Board pack (draft, cited)', '/reports/library']] },
  analyst: { title: 'For the SOC', items: [['Open incidents', '/soc/ir'], ['Approvals inbox', '/ops/actions'], ['Ask the copilot', '/ai/copilot']] },
  grc: { title: 'For GRC & audit', items: [['Closed-loop assurance', '/loop'], ['Framework coverage', '/comply/caas'], ['Audit ledger', '/ops/audit']] },
  ot: { title: 'For OT engineering', items: [['OT assets by Purdue level', '/ot/visibility'], ['OT vulnerabilities', '/ot/vulns'], ['Data planes & sensors', '/fabric/dataplanes']] },
  admin: { title: 'For platform admins', items: [['Integrations health', '/fabric/integrations'], ['Data planes', '/fabric/dataplanes'], ['Entitlements & users', '/ops/admin']] },
} as const;

export default function CommandCentre() {
  const { customer: c, tenantId, persona, setTenantId, tick } = useApp();
  const nav = useNavigate();
  const h = headlines(c, tenantId);
  const ri = resilienceIndex(c, tenantId);
  const trend = riTrend(c, tenantId);
  const tenants = scopedTenants(c, tenantId);
  const conns = scopedConnectors(c, tenantId);
  const ls = useMemo(() => loops(c, tenantId), [c, tenantId]);
  const lsum = loopSummary(ls);
  const att = attention(c, tenantId);
  const allLoops = useMemo(() => loops(c), [c]);

  // Capability scores, nudged toward the selected tenant so the gauges move with scope.
  const t0 = tenants[0];
  const scoreFor = (k: keyof typeof c.scores) => (tenantId === 'all' || !t0 ? c.scores[k] : Math.round(c.scores[k] * 0.6 + t0.ri * 0.4));

  const info: Record<string, MapNodeInfo> = {
    soc: { id: 'soc', metrics: [{ value: `${h.soc.mttrMin} min`, label: 'Median time to contain' }, { value: `${h.soc.slaPct}%`, label: 'SLA met (30 d)' }], status: h.soc.critical ? 'Action required' : 'Nominal' },
    comply: { id: 'comply', metrics: [{ value: `${h.comply.controlsMetPct}%`, label: 'Controls met' }, { value: String(h.comply.frameworks), label: 'Frameworks in scope' }], status: h.comply.overdueTasks > 20 ? 'Needs review' : 'Nominal' },
    strike: { id: 'strike', metrics: [{ value: String(h.strike.openFindings), label: 'Open findings' }, { value: `${h.strike.findingsToDetectionsPct}%`, label: 'Findings → detections' }], status: h.strike.criticalFindings > 1 ? 'Action required' : 'Needs review' },
    ot: { id: 'ot', metrics: [{ value: fmtNum(h.ot.otAssets), label: 'OT assets' }, { value: String(h.ot.sites), label: 'Sites / zones' }], status: h.ot.otAssets === 0 ? 'Nominal' : 'Needs review' },
    custody: { id: 'custody', metrics: [{ value: fmtNum(h.custody.assetsUnderCustody), label: 'Assets under custody' }, { value: String(h.custody.vendorsInChain), label: 'Vendors in chain' }], status: h.custody.anomalies > 5 ? 'Needs review' : 'Nominal' },
    int: { id: 'int', metrics: [{ value: String(h.int.prioritisedItems), label: 'Prioritised items' }, { value: String(h.int.exposedCredentials), label: 'Exposed credentials' }], status: 'Nominal' },
    ai: { id: 'ai', metrics: [{ value: String(h.ai.aiSystems), label: 'AI systems governed' }, { value: String(h.ai.shadowAi), label: 'Shadow AI found' }], status: h.ai.shadowAi > 4 ? 'Needs review' : 'Nominal' },
    insurance: { id: 'insurance', metrics: [{ value: `${h.insurance.insurability}`, label: 'Insurability score' }, { value: `${h.insurance.premiumDeltaPct > 0 ? '+' : ''}${h.insurance.premiumDeltaPct}%`, label: 'Modelled premium impact' }], status: h.insurance.premiumDeltaPct > 0 ? 'Needs review' : 'Nominal' },
    reports: { id: 'reports', metrics: [{ value: '14', label: 'Reports scheduled' }, { value: '3', label: 'Drafts awaiting sign-off' }], status: 'Nominal' },
  };
  const coreInfo: MapNodeInfo = {
    id: 'core',
    metrics: [
      { value: String(ri.value), label: 'Resilience Index' },
      { value: `${h.fabric.healthy}/${h.fabric.connectors}`, label: 'Integrations healthy' },
      { value: fmtCompact(h.fabric.eventsPerDay), label: 'Events normalised / day' },
    ],
    status: h.fabric.healthy / h.fabric.connectors > 0.85 ? 'Nominal' : 'Needs review',
  };

  // Estate by environment
  const envStats = (['cloud', 'onprem', 'ot', 'saas'] as Env[]).map((e) => {
    const ks = conns.filter((k) => k.env === e);
    return { env: e, connectors: ks.length, healthy: ks.filter((k) => k.status === 'healthy').length, records: ks.reduce((s, k) => s + k.records, 0), stale: ks.filter(isStale).length };
  });

  // Live feed that ticks while you watch.
  const baseFeed = feed(c, tenantId);
  const [feedOffset, setFeedOffset] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFeedOffset((o) => o + 1), 4500);
    return () => clearInterval(t);
  }, []);
  const liveFeed = baseFeed.length
    ? Array.from({ length: Math.min(7, baseFeed.length) }, (_, i) => {
        const e = baseFeed[(feedOffset + i) % baseFeed.length];
        return { ...e, ageSec: i * 47 + ((feedOffset * 13) % 30) };
      })
    : [];

  const tips = PERSONA_TIPS[persona];

  const tenantRows = tenants.map((t) => {
    const tl = allLoops.filter((l) => l.tenantId === t.id);
    const s = loopSummary(tl);
    const dp = c.dataPlanes.find((d) => d.id === t.dataPlaneId);
    const th = headlines(c, t.id);
    return { t, loops: s, dp, incidents: th.soc.openIncidents };
  });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {c.estateSummary}. {h.fabric.connectors} integrations across cloud, on-prem and OT feed one canonical model{tenantId !== 'all' ? `, scoped to ${tenants[0]?.name}` : ''}. Hover a module to explore, click to open it.
      </p>

      <div className="grid g-2-1">
        <Card>
          <div className="row" style={{ gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <HexScore value={ri.value} size={104} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3 style={{ fontSize: 18 }}>Resilience Index</h3>
              <p className="secondary" style={{ marginTop: 4, maxWidth: 520 }}>
                One explainable score for {tenantId === 'all' ? `${c.tenants.length} tenants, weighted by criticality` : tenants[0]?.name}. It moves as controls are validated, evidence ages and exposure changes.{' '}
                <button className="link" onClick={() => nav('/board')}>
                  See how it is made →
                </button>
              </p>
            </div>
            <div style={{ width: 200 }}>
              <Chart
                height={70}
                option={{
                  grid: { left: 0, right: 0, top: 6, bottom: 0 },
                  xAxis: { type: 'category', data: monthLabels(12), show: false },
                  yAxis: { type: 'value', show: false, min: 50 },
                  tooltip: { trigger: 'axis' },
                  series: [{ type: 'line', data: trend, symbol: 'none', lineStyle: { color: '#3ad0ae', width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(58,208,174,.35)' }, { offset: 1, color: 'rgba(58,208,174,0)' }] } } }],
                }}
              />
              <div className="muted" style={{ fontSize: 11, textAlign: 'right' }}>
                <span style={{ color: 'var(--good)', fontWeight: 700 }}>+{trend[11] - trend[0]}</span> over 12 months
              </div>
            </div>
          </div>
          <div className="grid g6" style={{ marginTop: 16, gap: 6 }}>
            {CAPABILITIES.map((cap) => {
              const m = MODULE_BY_ID[cap.moduleId];
              return <GaugeTile key={cap.id} value={scoreFor(cap.id)} color={m.tone} label={m.scoreLabel ?? m.title} sub={m.product} onClick={() => nav(`${m.basePath}/${m.tabs[0].id}`)} />;
            })}
          </div>
        </Card>

        <Card title={tips.title} sub="Your role-based starting points" toneColor="var(--m-view)" tinted>
          <div className="list">
            {tips.items.map(([label, path]) => (
              <button key={path} className="list-row" onClick={() => nav(path)}>
                <span className="list-main">
                  <b>{label}</b>
                </span>
                <ArrowRight size={14} className="muted" />
              </button>
            ))}
          </div>
          <div className="grid g3" style={{ marginTop: 14, gap: 8 }}>
            {(['ai', 'insurance', 'fabric'] as const).map((k) => {
              const m = MODULE_BY_ID[k];
              return <GaugeTile key={k} value={scoreFor(k)} color={m.tone} label={m.scoreLabel ?? ''} sub={m.product} size={60} onClick={() => nav(`${m.basePath}/${m.tabs[0].id}`)} />;
            })}
          </div>
        </Card>
      </div>

      <Card>
        <PlatformMap info={info} coreInfo={coreInfo} />
      </Card>

      <div className="grid g4">
        {envStats.map((e) => {
          const meta = ENV_META[e.env];
          const Icon = meta.icon;
          return (
            <Card key={e.env} toneColor={meta.color} tinted>
              <div className="row">
                <span className="ico-box" style={{ '--tone': meta.color } as CSSProperties}>
                  <Icon />
                </span>
                <div style={{ flex: 1 }}>
                  <div className="section-label" style={{ margin: 0 }}>{meta.label}</div>
                  <div className="kpi-value" style={{ marginTop: 0 }}>
                    {e.connectors}
                    <small>integrations</small>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <Bar value={e.healthy} max={Math.max(1, e.connectors)} color={meta.color} />
              </div>
              <div className="card-foot" style={{ paddingTop: 8 }}>
                <span>{e.healthy} healthy</span>
                <span>{fmtCompact(e.records)} records</span>
                {e.stale > 0 && <span style={{ color: 'var(--warn)' }}>{e.stale} stale</span>}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid g-3-2">
        <Card title="Where you operate" sub={`${tenants.length} tenant${tenants.length > 1 ? 's' : ''} · coloured by Resilience Index · click to scope`} actions={<Legend items={[{ label: '85+', color: 'var(--good)' }, { label: '70–84', color: 'var(--sev-medium)' }, { label: '<70', color: 'var(--bad)' }]} />}>
          <WorldMap
            height={250}
            onPoint={(id) => setTenantId(id)}
            points={tenants.map((t) => ({
              id: t.id, lat: t.lat, lon: t.lon, label: `${t.short} · RI ${t.ri}`,
              sub: `${t.kind} · ${t.city}`, color: scoreTone(t.ri), size: t.criticality / 5, pulse: t.ri < 75,
            }))}
          />
        </Card>
        <Card title="Closed-loop assurance" sub="Policy → evidence → ATT&CK → detection → validation" actions={<button className="link" onClick={() => nav('/loop')}>Open loops →</button>}>
          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            <div>
              <div className="stat-big" style={{ color: 'var(--good)' }}>{lsum.assuredPct}%</div>
              <div className="stat-label">assured · {lsum.closed} of {lsum.applicable} loops closed</div>
            </div>
          </div>
          <div style={{ margin: '14px 0 8px' }}>
            <Stacked tall showLabels parts={[
              { value: lsum.closed, color: LOOP_STATUS_COLOR.closed, label: 'Closed' },
              { value: lsum.stale, color: LOOP_STATUS_COLOR.stale, label: 'Stale' },
              { value: lsum.partial, color: LOOP_STATUS_COLOR.partial, label: 'Partial' },
              { value: lsum.broken, color: LOOP_STATUS_COLOR.broken, label: 'Broken' },
            ]} />
          </div>
          <Legend items={[
            { label: `Closed ${lsum.closed}`, color: LOOP_STATUS_COLOR.closed },
            { label: `Stale ${lsum.stale}`, color: LOOP_STATUS_COLOR.stale },
            { label: `Partial ${lsum.partial}`, color: LOOP_STATUS_COLOR.partial },
            { label: `Broken ${lsum.broken}`, color: LOOP_STATUS_COLOR.broken },
          ]} />
          <div className="stack" style={{ marginTop: 14, gap: 6 }}>
            {c.frameworks.slice(0, 4).map((f) => (
              <div key={f.id} className="row" style={{ fontSize: 12 }}>
                <span style={{ width: 92, fontWeight: 600 }}>{f.short}</span>
                <div style={{ flex: 1, display: 'grid', gap: 3 }}>
                  <Bar value={f.documented} color="var(--m-comply)" size="thin" />
                  <Bar value={f.assured} color="var(--m-view)" size="thin" />
                </div>
                <span className="muted" style={{ width: 70, textAlign: 'right' }}>
                  {f.documented}% / {f.assured}%
                </span>
              </div>
            ))}
            <Legend items={[{ label: 'Documented', color: 'var(--m-comply)' }, { label: 'Assured (loop-proven)', color: 'var(--m-view)' }]} />
          </div>
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="Attention queue" count={att.length} sub="Ranked across every module and tool" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {att.map((a, i) => {
              const m = MODULE_BY_ID[a.module];
              return (
                <button key={i} className="list-row" onClick={() => nav(a.path)}>
                  <HexIcon mod={m} size={26} />
                  <span className="list-main">
                    <b>{a.title}</b>
                    <span>{a.detail}</span>
                  </span>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <SevBadge sev={a.sev} />
                    <span className="muted" style={{ fontSize: 10.5 }}>{fmtAgo(a.ageMin)}</span>
                  </span>
                </button>
              );
            })}
            {att.length === 0 && <div className="empty">Nothing needs attention for this tenant.</div>}
          </div>
        </Card>
        <Card title={<><span className="live-dot" /> Live across the fabric</>} sub="Every module writes to HexaCore; every module reads from it" flush>
          <div className="list" style={{ padding: '0 18px 8px' }} key={tick}>
            {liveFeed.map((e, i) => {
              const m = MODULE_BY_ID[e.module];
              return (
                <div key={`${feedOffset}-${i}`} className="list-row" style={{ animation: i === 0 ? 'slide .35s ease' : undefined }}>
                  <HexIcon mod={m} size={22} />
                  <span className="list-main">
                    <b style={{ whiteSpace: 'normal', fontWeight: 500 }}>{e.text}</b>
                    <span>
                      {m.product} · {c.tenants.find((t) => t.id === e.tenant)?.short} · {e.ageSec < 60 ? `${e.ageSec}s ago` : `${Math.round(e.ageSec / 60)} min ago`}
                    </span>
                  </span>
                </div>
              );
            })}
            {liveFeed.length === 0 && <div className="empty"><Activity size={16} /> Quiet for this tenant.</div>}
          </div>
        </Card>
      </div>

      <Card title="Tenant roll-up" sub="Each tenant is an isolation boundary; the group view is the union of tenants you may see" flush actions={<Btn sm onClick={() => nav('/fabric/dataplanes')}>Data planes</Btn>}>
        <DataTable
          rows={tenantRows}
          rowKey={(r) => r.t.id}
          onRowClick={(r) => setTenantId(r.t.id)}
          initialSort={{ key: 'crit', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Tenant', sort: (r) => r.t.name, render: (r) => (<><div className="t-main">{r.t.name}</div><div className="t-sub">{r.t.kind} · {r.t.city}, {r.t.country}</div></>) },
            { key: 'crit', header: 'Criticality', sort: (r) => r.t.criticality, render: (r) => <span title="Weight in group roll-up">{'◆'.repeat(r.t.criticality)}<span style={{ opacity: 0.2 }}>{'◆'.repeat(5 - r.t.criticality)}</span></span> },
            { key: 'ri', header: 'Resilience', sort: (r) => r.t.ri, render: (r) => <span className="num" style={{ fontWeight: 700, color: scoreTone(r.t.ri) }}>{r.t.ri}</span> },
            { key: 'inc', header: 'Open incidents', align: 'right', sort: (r) => r.incidents, render: (r) => r.incidents },
            { key: 'loops', header: 'Loops closed', sort: (r) => r.loops.assuredPct, render: (r) => (<div style={{ minWidth: 120 }}><Bar value={r.loops.assuredPct} color="var(--m-view)" size="thin" /><span className="t-sub">{r.loops.closed}/{r.loops.applicable} · {r.loops.assuredPct}%</span></div>) },
            { key: 'env', header: 'Estate', render: (r) => <span className="chips">{r.t.env.map((e) => <Badge key={e} color={ENV_META[e].color}>{ENV_META[e].label.split(' ')[0]}</Badge>)}</span> },
            { key: 'dp', header: 'Data plane', render: (r) => (r.dp ? (<><div className="t-main" style={{ fontWeight: 500 }}>{r.dp.placement}</div><Freshness minutes={r.dp.heartbeatSecAgo / 60} stale={r.dp.status !== 'healthy'} label={r.dp.status !== 'healthy' ? r.dp.name : 'Heartbeat'} /></>) : '—') },
            { key: 'reg', header: 'Regimes', render: (r) => <span className="t-sub">{r.t.regimes.join(' · ')}</span> },
          ]}
        />
      </Card>
    </>
  );
}
