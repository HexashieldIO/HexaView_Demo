import { useMemo, useState } from 'react';
import { Gauge, Coins, Filter, Database, Cloud, Server, Factory, Globe2, Trash2, Flame, Snowflake, Thermometer } from 'lucide-react';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { RecordsDrawer, scrollToId } from '../insurance/viz';
import { useApp } from '../../state/AppContext';
import { pipelineSummary, meterMetrics, ENV_LABEL } from '../../data/modules/fabric';
import type { Env } from '../../data/types';
import { Card, KpiStrip, Badge, Callout, Bar } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { fmtCompact, fmtMoney, fmtNum } from '../../lib/format';
import { TONE, EnvDot, toneStyle } from './parts';
import './fabric.css';

const TIER_COLOR = ['#f2643f', '#f5a83d', '#68b1ff'];

export default function FabricPipeline() {
  const { customer: c, tenantId } = useApp();
  const p = useMemo(() => pipelineSummary(c, tenantId), [c, tenantId]);
  const meters = useMemo(() => meterMetrics(c, tenantId), [c, tenantId]);
  const [rec, setRec] = useState<null | 'cost' | 'dropped'>(null);
  const siemName = c.connectors.find((k) => k.category === 'SIEM')?.product ?? 'SIEM';
  const envIcon = { cloud: <Cloud />, onprem: <Server />, ot: <Factory />, saas: <Globe2 /> } as const;
  const envs = (['cloud', 'onprem', 'ot', 'saas'] as Env[]).map((e) => {
    const ss = p.sources.filter((s) => s.env === e);
    return { e, n: ss.length, gb: ss.reduce((a, s) => a + s.gbDay, 0), kept: ss.reduce((a, s) => a + s.kept, 0), dropped: ss.reduce((a, s) => a + s.dropped, 0) };
  }).filter((x) => x.n);
  const tierGb = { hot: p.tiers[0].gbDay, warm: p.tiers[1].gbDay, cold: p.tiers[2].gbDay };
  const flowCols: FlowColumn[] = [
    { label: 'Sources', nodes: envs.map((x) => ({ id: `e-${x.e}`, title: `${ENV_LABEL[x.e]} · ${x.n} tools`, count: `${x.gb.toFixed(1)} GB`, sub: '/ day', icon: envIcon[x.e as keyof typeof envIcon], onClick: () => scrollToId('fab-ingest') })) },
    { label: 'HexaCore edge', nodes: [
      { id: 'kept', title: 'Normalised (OCSF)', count: `${p.normalisedGbDay} GB`, sub: 'kept', icon: <Filter />, state: 'good' as const, onClick: () => scrollToId('fab-ingest') },
      { id: 'drop', title: 'Noise & duplicates', count: `${(p.ingestGbDay - p.normalisedGbDay).toFixed(1)} GB`, sub: 'dropped at edge', icon: <Trash2 />, state: 'warn' as const, onClick: () => setRec('dropped') },
    ] },
    { label: 'Storage tiers', nodes: [
      { id: 'hot', title: 'Hot (searchable)', count: `${tierGb.hot} GB`, sub: p.tiers[0].retention, icon: <Flame />, color: TIER_COLOR[0], onClick: () => setRec('cost') },
      { id: 'warm', title: 'Warm (90 d)', count: `${tierGb.warm} GB`, sub: 'Parquet', icon: <Thermometer />, color: TIER_COLOR[1], onClick: () => setRec('cost') },
      { id: 'cold', title: 'Cold archive', count: `${tierGb.cold} GB`, sub: 'lifecycle tiers', icon: <Snowflake />, color: TIER_COLOR[2], onClick: () => setRec('cost') },
    ] },
  ];
  const flowLinks: FlowLink[] = [
    ...envs.flatMap((x) => [{ from: `e-${x.e}`, to: 'kept', value: x.kept }, { from: `e-${x.e}`, to: 'drop', value: x.dropped, color: '#8593b4' }]),
    { from: 'kept', to: 'hot', value: tierGb.hot, color: TIER_COLOR[0] },
    { from: 'kept', to: 'warm', value: tierGb.warm, color: TIER_COLOR[1] },
    { from: 'kept', to: 'cold', value: tierGb.cold, color: TIER_COLOR[2] },
  ];

  const topSources = p.sources.slice(0, 12);
  const savingPct = Math.round(((p.siem.beforeMonthly - p.siem.afterMonthly) / Math.max(1, p.siem.beforeMonthly)) * 100);

  function fmtMetric(m: typeof meters[number]): string {
    if (m.metric === 'evidence_storage_bytes') return `${(m.value / 1e9).toFixed(1)} GB`;
    if (m.metric === 'copilot_tokens') return fmtCompact(m.value);
    if (m.value >= 10000) return fmtCompact(m.value);
    return fmtNum(m.value);
  }

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · the security data pipeline. HexaCore ingests <b>{p.ingestGbDay} GB/day</b> from your tools, de-duplicates and filters to {p.normalisedGbDay} GB of canonical events, and tiers the rest — cutting SIEM ingest cost by {savingPct}% while keeping everything for forensics and compliance.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Ingest', value: `${p.ingestGbDay}`, unit: 'GB/day', toneColor: TONE, onClick: () => scrollToId('fab-ingest'), source: `${p.sources.length} connectors via hv-gateway` },
          { label: 'Normalised', value: `${p.normalisedGbDay}`, unit: 'GB/day', hint: 'kept', toneColor: 'var(--good)', onClick: () => scrollToId('fab-flow'), source: 'HexaCore OCSF normaliser' },
          { label: 'Filtered / dropped', value: `${p.droppedPct}%`, hint: 'noise & dupes', toneColor: 'var(--sev-medium)', onClick: () => setRec('dropped'), source: 'HexaCore edge filters' },
          { label: 'SIEM cost (before)', value: fmtMoney(p.siem.beforeMonthly, c.currency), unit: '/mo', toneColor: 'var(--bad)', onClick: () => setRec('cost'), source: `${siemName} ingest pricing × raw volume` },
          { label: 'SIEM cost (after)', value: fmtMoney(p.siem.afterMonthly, c.currency), unit: '/mo', toneColor: 'var(--good)', onClick: () => setRec('cost'), source: `${siemName} ingest pricing × tiered volume` },
          { label: '12-month saving', value: fmtMoney(p.siem.savingYear, c.currency), delta: { text: `${savingPct}% lower`, good: true }, toneColor: 'var(--good)', onClick: () => scrollToId('fab-cost'), source: 'HexaCore metering · billing meters' },
        ]}
      />

      <Card title={<span id="fab-flow">Where every GB goes</span>} sub="Sources → HexaCore edge filtering and OCSF normalisation → storage tiers · line width is GB/day · click a node for its records">
        <FlowMap columns={flowCols} links={flowLinks} goodColor="#2dd4bf" />
      </Card>

      <div className="grid g-3-2">
        <Card title={<><Coins size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> <span id="fab-cost">SIEM ingest cost, before and after</span></>} sub={`Monthly, ${c.currency} · HexaCore filtering and tiering applied from month 3`}>
          <Chart height={250} option={{
            tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => fmtMoney(Number(v), c.currency) },
            legend: { top: 0, data: ['Before (raw to SIEM)', 'After (filtered & tiered)'] },
            grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
            xAxis: { type: 'category', data: p.siem.beforeSeries.map((_, i) => `m${i + 1}`) },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtMoney(v, c.currency) } },
            series: [
              { name: 'Before (raw to SIEM)', type: 'line', data: p.siem.beforeSeries, smooth: true, symbol: 'none', lineStyle: { color: '#f2643f', width: 2.2 }, areaStyle: { color: 'rgba(242,100,63,.14)' } },
              { name: 'After (filtered & tiered)', type: 'line', data: p.siem.afterSeries, smooth: true, symbol: 'none', lineStyle: { color: '#2dd4bf', width: 2.2 }, areaStyle: { color: 'rgba(45,212,191,.16)' } },
            ],
          }} />
          <Callout kind="good"><b>{fmtMoney(p.siem.savingYear, c.currency)} saved over 12 months.</b> Noise and duplicates are dropped at the edge; only security-relevant, de-duplicated events reach hot search. Everything else is kept in warm and cold tiers.</Callout>
        </Card>

        <div className="stack">
          <Card title="What happens to the data" sub="Every GB accounted for">
            <div className="stack" style={{ gap: 10 }}>
              {p.filters.map((f) => (
                <div key={f.label}>
                  <div className="row between" style={{ fontSize: 12 }}><b>{f.label}</b><span className="muted">{f.pct}%</span></div>
                  <Bar value={f.pct} color={f.label.includes('hot') ? 'var(--good)' : f.label.includes('warm') ? 'var(--m-matrix)' : 'var(--sev-medium)'} />
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{f.note}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title={<><Database size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> Storage tiers</>} sub="Hot search, warm, cold archive (LLD 4.7)">
            <div className="list">
              {p.tiers.map((t, i) => (
                <div key={t.tier} className="list-row">
                  <span className="dot" style={{ background: TIER_COLOR[i] }} />
                  <span className="list-main"><b>{t.tier}</b><span>{t.retention}</span></span>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 2 }}><b className="num">{t.gbDay} GB/day</b><span className="muted" style={{ fontSize: 10 }}>{fmtMoney(t.costPerGb, c.currency, false)}/GB</span></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g-3-2">
        <Card title={<span id="fab-ingest">Ingest by source</span>} sub="GB/day per connector, split into kept vs dropped">
          <Chart height={300} option={{
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => `${Number(v).toFixed(2)} GB` },
            legend: { top: 0, data: ['Kept (normalised)', 'Dropped (noise & dupes)'] },
            grid: { left: 8, right: 16, top: 34, bottom: 6, containLabel: true },
            xAxis: { type: 'value', name: 'GB/day' },
            yAxis: { type: 'category', inverse: true, data: topSources.map((s) => s.name), axisLabel: { fontSize: 10 } },
            series: [
              { name: 'Kept (normalised)', type: 'bar', stack: 'g', data: topSources.map((s) => s.kept), itemStyle: { color: '#2dd4bf' }, barMaxWidth: 16 },
              { name: 'Dropped (noise & dupes)', type: 'bar', stack: 'g', data: topSources.map((s) => s.dropped), itemStyle: { color: 'var(--text-muted)' } },
            ],
          }} />
        </Card>

        <Card title="Routing by tier" sub="How kept data is distributed to hot, warm and cold">
          <Chart height={300} option={{
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => `${Number(v).toFixed(2)} GB` },
            legend: { top: 0, data: ['Hot', 'Warm', 'Cold'] },
            grid: { left: 8, right: 16, top: 34, bottom: 6, containLabel: true },
            xAxis: { type: 'value', name: 'GB/day' },
            yAxis: { type: 'category', inverse: true, data: topSources.map((s) => s.name), axisLabel: { fontSize: 10 } },
            series: [
              { name: 'Hot', type: 'bar', stack: 't', data: topSources.map((s) => s.routed.hot), itemStyle: { color: TIER_COLOR[0] }, barMaxWidth: 16 },
              { name: 'Warm', type: 'bar', stack: 't', data: topSources.map((s) => s.routed.warm), itemStyle: { color: TIER_COLOR[1] } },
              { name: 'Cold', type: 'bar', stack: 't', data: topSources.map((s) => s.routed.cold), itemStyle: { color: TIER_COLOR[2] } },
            ],
          }} />
        </Card>
      </div>

      {rec === 'cost' && (
        <RecordsDrawer title="SIEM cost by tier" sub={`${fmtMoney(p.siem.beforeMonthly, c.currency)} → ${fmtMoney(p.siem.afterMonthly, c.currency)} per month`} source={`${siemName} ingest pricing · HexaCore metering`} onClose={() => setRec(null)}
          rows={[
            ...p.tiers.map((t) => ({ key: t.tier, title: t.tier, sub: `${t.gbDay} GB/day · ${t.retention} · ${fmtMoney(t.costPerGb, c.currency, false)}/GB`, right: fmtMoney(t.gbDay * 30 * t.costPerGb, c.currency) + '/mo' })),
            ...p.sources.slice(0, 10).map((s) => ({ key: s.name, title: s.name, sub: `${s.category} · hot ${s.routed.hot} GB/day`, right: fmtMoney(s.routed.hot * 30 * p.tiers[0].costPerGb, c.currency) + '/mo hot' })),
          ]} />
      )}
      {rec === 'dropped' && (
        <RecordsDrawer title="Dropped at the edge" sub={`${p.droppedPct}% of ${p.ingestGbDay} GB/day`} source="HexaCore edge filters (de-dup, noise, heartbeat suppression)" onClose={() => setRec(null)}
          rows={p.sources.slice().sort((a, b) => b.dropped - a.dropped).map((s) => ({ key: s.name, title: s.name, sub: `${s.category} · ${ENV_LABEL[s.env]} · ${Math.round((s.dropped / Math.max(0.01, s.gbDay)) * 100)}% of its volume`, right: `${s.dropped.toFixed(2)} GB` }))} />
      )}

      <Card title={<><Gauge size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> Per-tenant metering</>} sub="Billing meters per LLD 4.8 · daily roll-ups · entitlement shown where it applies" flush>
        <DataTable
          rows={meters}
          rowKey={(m) => m.metric}
          columns={[
            { key: 'label', header: 'Meter', render: (m) => (<><div className="t-main">{m.label}</div><div className="t-sub mono">{m.metric}</div></>) },
            { key: 'value', header: 'Value', align: 'right', sort: (m) => m.value, render: (m) => <span className="num" style={{ fontWeight: 700 }}>{fmtMetric(m)} <small className="muted" style={{ fontWeight: 400 }}>{m.unit}</small></span> },
            { key: 'trend', header: 'Trend (12 mo)', render: (m) => <div style={{ width: 130, height: 32 }}><Chart height={32} option={{ grid: { left: 0, right: 0, top: 2, bottom: 2 }, xAxis: { type: 'category', show: false, data: m.trend.map((_, i) => i) }, yAxis: { type: 'value', show: false, min: 0 }, tooltip: { show: false }, series: [{ type: 'line', data: m.trend, symbol: 'none', smooth: true, lineStyle: { color: PALETTE[0], width: 1.6 }, areaStyle: { color: 'rgba(79,140,255,.2)' } }] }} /></div> },
            { key: 'ent', header: 'Entitlement', render: (m) => m.entitlement === null ? <span className="muted">Metered (no cap)</span> : (<span className="stack" style={{ gap: 2 }}><Badge color={m.value >= m.entitlement ? 'var(--bad)' : m.value >= m.entitlement * 0.85 ? 'var(--sev-medium)' : 'var(--good)'}>{fmtCompact(m.value)} / {fmtCompact(m.entitlement)}</Badge></span>) },
            { key: 'note', header: 'Definition', render: (m) => <span className="t-sub">{m.note}</span> },
          ]}
        />
      </Card>

      <Card title={<><Filter size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> Ingest detail by source</>} sub="Every connector feeding the pipeline" flush>
        <DataTable
          rows={p.sources}
          rowKey={(s) => s.name}
          search={(s) => `${s.name} ${s.category}`}
          searchPlaceholder="Find a source…"
          initialSort={{ key: 'gb', dir: 'desc' }}
          pageSize={12}
          columns={[
            { key: 'name', header: 'Source', sort: (s) => s.name, render: (s) => (<><div className="t-main"><EnvDot env={s.env as Env} />{s.name}</div><div className="t-sub">{s.category} · {ENV_LABEL[s.env as Env]}</div></>) },
            { key: 'gb', header: 'Ingest GB/day', align: 'right', sort: (s) => s.gbDay, render: (s) => <span className="num">{s.gbDay.toFixed(2)}</span> },
            { key: 'kept', header: 'Kept', align: 'right', sort: (s) => s.kept, render: (s) => <span className="num" style={{ color: 'var(--good)' }}>{s.kept.toFixed(2)}</span> },
            { key: 'drop', header: 'Dropped', align: 'right', sort: (s) => s.dropped, render: (s) => <span className="num muted">{s.dropped.toFixed(2)} ({Math.round((s.dropped / Math.max(0.01, s.gbDay)) * 100)}%)</span> },
            { key: 'tiers', header: 'Hot / Warm / Cold', render: (s) => (<div style={{ minWidth: 120 }}><div className="stacked"><i style={{ width: `${(s.routed.hot / Math.max(0.01, s.kept)) * 100}%`, background: TIER_COLOR[0] }} /><i style={{ width: `${(s.routed.warm / Math.max(0.01, s.kept)) * 100}%`, background: TIER_COLOR[1] }} /><i style={{ width: `${(s.routed.cold / Math.max(0.01, s.kept)) * 100}%`, background: TIER_COLOR[2] }} /></div></div>) },
          ]}
        />
      </Card>
    </div>
  );
}
