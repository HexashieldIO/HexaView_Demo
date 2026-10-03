import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users2, EyeOff, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { riTrend } from '../../data/core';
import { scopedTenants } from '../../data/customers';
import { benchmark } from '../../data/modules/ops';
import { Card, KpiStrip, Badge, Callout, HexScore, Legend, KV } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { monthLabels, scoreTone } from '../../lib/format';
import { OPS_TONE, Switch, HBars, useRecords, scrollToId } from './parts';
import { MODULE_BY_ID } from '../../modules/registry';

/** Where each benchmark metric comes from, so every number can pivot to its data. */
const METRIC_SRC: Record<string, { to: string; src: string }> = {
  ri: { to: '/board', src: 'HexaView Resilience Index (LLD 7.7)' },
  mttr: { to: '/soc/ir', src: 'HexaSOC incident records' },
  mttd: { to: '/soc/ir', src: 'HexaSOC incident records' },
  patch: { to: '/fabric/exposure', src: 'Vulnerability scanner remediation history' },
  mfa: { to: '/fabric/identity', src: 'Identity provider authentication methods' },
  loop: { to: '/loop', src: 'Closed-loop assurance (HexaComply × HexaMatrix)' },
  attack: { to: '/soc/attack', src: 'HexaMatrix ATT&CK coverage' },
};

function pctColor(p: number): string {
  return p >= 75 ? 'var(--good)' : p >= 50 ? '#68b1ff' : p >= 25 ? 'var(--sev-medium)' : 'var(--bad)';
}

export default function Benchmark() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const tenants = scopedTenants(c, tenantId);
  const b = useMemo(() => benchmark(c, tenantId, days), [c, tenantId, days]);
  const trend = riTrend(c, tenantId);
  const [optIn, setOptIn] = useState(true);
  const [shareGranular, setShareGranular] = useState(false);
  const nav = useNavigate();
  const [, openRecords, recordsNode] = useRecords();
  const idp = c.connectors.find((k) => k.category === 'Identity')?.product ?? 'IdP';
  const vuln = c.connectors.find((k) => k.category === 'Vulnerability')?.product ?? 'scanner';
  const srcFor = (key: string) => (key === 'mfa' ? `${idp} authentication methods` : key === 'patch' ? `${vuln} remediation history` : METRIC_SRC[key]?.src ?? 'HexaView');
  const cohortRecords = () => {
    const bands = ['< 2,000 staff', '2,000–10,000 staff', '10,000–50,000 staff', '> 50,000 staff'];
    const regions = ['Europe', 'North America', 'Asia-Pacific', 'Middle East & Africa'];
    const split = (n: number, w: number[]) => { const t = w.reduce((a, x) => a + x, 0); const out = w.map((x) => Math.floor((n * x) / t)); out[0] += n - out.reduce((a, x) => a + x, 0); return out; };
    const bs = split(b.peers.n, [2, 4, 3, 1]);
    const rs = split(b.peers.n, c.currency === 'USD' ? [2, 5, 1, 1] : [5, 2, 2, 1]);
    openRecords({
      title: `Peer cohort · ${b.peers.n} ${b.peers.label}`,
      sub: 'Anonymised aggregates only; k ≥ 10 per metric',
      source: 'HexaView benchmarking service (opt-in, monthly refresh)',
      rows: [
        ...bands.map((x, i) => ({ key: x, main: x, meta: 'Organisation size band', right: <b>{bs[i]}</b> })),
        ...regions.map((x, i) => ({ key: x, main: x, meta: 'Headquarters region', right: <b>{rs[i]}</b>, color: 'var(--m-core)' })),
      ],
    });
  };

  const riM = b.metrics[0];
  const sorted = [...b.metrics].slice(1).sort((x, y) => y.pct - x.pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const lo = 40;
  const hi = 100;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''} compared with <b>{b.peers.n} anonymised {c.sector.toLowerCase()} peers</b> ({b.peers.label}) who have opted in to HexaView benchmarking. Only aggregates are shown, never a named peer; a metric appears only when at least 10 peers contribute. Your metrics use {rangeLabel(timeRange).toLowerCase()}; peer data refreshes monthly.
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Resilience Index', value: b.ri, unit: `peer median ${b.peers.median}`, delta: { text: `${b.ri - b.peers.median >= 0 ? '+' : ''}${b.ri - b.peers.median} vs median`, good: b.ri >= b.peers.median }, to: '/board', source: METRIC_SRC.ri.src },
          { label: 'Percentile', value: `P${riM.pct}`, bar: riM.pct, onClick: () => scrollToId('ops-bm-metrics'), source: 'HexaView benchmarking service' },
          { label: 'Peers', value: b.peers.n, unit: 'opt-in, anonymised', onClick: cohortRecords, source: 'HexaView benchmarking service' },
          { label: 'Strongest', value: `P${best.pct}`, unit: best.label, to: METRIC_SRC[best.key]?.to, source: srcFor(best.key) },
          { label: 'Weakest', value: `P${worst.pct}`, unit: worst.label, toneColor: 'var(--sev-medium)', to: METRIC_SRC[worst.key]?.to, source: srcFor(worst.key) },
          { label: 'Top quartile from', value: b.peers.q3, unit: `RI · top decile ${b.peers.p90}`, onClick: () => scrollToId('ops-bm-gaps'), source: 'HexaView benchmarking service' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Where you sit" sub={`Resilience Index across ${b.peers.n} ${c.sector.toLowerCase()} peers`}>
          <div className="row" style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <HexScore value={b.ri} size={96} />
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ position: 'relative', height: 64, margin: '20px 6px 6px' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 26, height: 12, borderRadius: 6, background: 'var(--track)' }} />
                <div style={{ position: 'absolute', left: pos(b.peers.q1), width: `calc(${pos(b.peers.q3)} - ${pos(b.peers.q1)})`, top: 26, height: 12, borderRadius: 6, background: 'color-mix(in srgb, var(--m-ops) 45%, transparent)' }} title="Interquartile range" />
                <div style={{ position: 'absolute', left: pos(b.peers.median), top: 20, width: 2, height: 24, background: 'var(--text-secondary)' }} />
                <div style={{ position: 'absolute', left: pos(b.peers.median), top: 46, transform: 'translateX(-50%)', fontSize: 10.5 }} className="muted">median {b.peers.median}</div>
                <div style={{ position: 'absolute', left: pos(b.peers.p90), top: 22, width: 2, height: 20, background: 'var(--good)', opacity: 0.7 }} />
                <div style={{ position: 'absolute', left: pos(b.peers.p90), top: 46, transform: 'translateX(-50%)', fontSize: 10.5, color: 'var(--good)' }}>P90 {b.peers.p90}</div>
                <div style={{ position: 'absolute', left: pos(b.ri), top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: scoreTone(b.ri) }}>You {b.ri}</div>
                  <div style={{ width: 0, height: 0, margin: '2px auto 0', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${'var(--m-view)'}` }} />
                </div>
              </div>
              <div className="row between muted" style={{ fontSize: 10.5 }}>
                <span>{lo}</span><span>Q1 {b.peers.q1}</span><span>Q3 {b.peers.q3}</span><span>{hi}</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Chart
              height={200}
              option={{
                tooltip: { trigger: 'axis' },
                legend: { top: 0 },
                xAxis: { type: 'category', data: monthLabels(12) },
                yAxis: { type: 'value', min: Math.min(b.peers.q1 - 6, ...trend) - 2, max: 100 },
                series: [
                  { name: c.short, type: 'line', data: trend, lineStyle: { width: 3, color: '#3ad0ae' }, itemStyle: { color: '#3ad0ae' } },
                  { name: 'Peer median', type: 'line', data: b.medianTrend, lineStyle: { type: 'dashed', color: '#8a9bc0' }, itemStyle: { color: '#8a9bc0' }, symbol: 'none' },
                  { name: 'Top quartile', type: 'line', data: b.q3Trend, lineStyle: { type: 'dotted', color: PALETTE[2] }, itemStyle: { color: PALETTE[2] }, symbol: 'none' },
                ],
              }}
            />
          </div>
        </Card>
        <Card title="By capability" sub="You vs peer median vs top quartile">
          <Chart
            height={330}
            option={{
              legend: { bottom: 0 },
              tooltip: {},
              radar: { indicator: b.radar.map((x) => ({ name: x.label, max: 100 })), radius: '62%', center: ['50%', '48%'] },
              series: [{
                type: 'radar',
                data: [
                  { name: c.short, value: b.radar.map((x) => x.you), areaStyle: { opacity: 0.25 }, itemStyle: { color: '#3ad0ae' }, lineStyle: { width: 2.5 } },
                  { name: 'Peer median', value: b.radar.map((x) => x.median), itemStyle: { color: '#8a9bc0' }, lineStyle: { type: 'dashed' } },
                  { name: 'Top quartile', value: b.radar.map((x) => x.top), itemStyle: { color: PALETTE[2] }, lineStyle: { type: 'dotted' } },
                ],
              }],
            }}
          />
        </Card>
      </div>

      <div className="grid g-2-1">
        <div id="ops-bm-metrics" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Operational metrics" sub={`Your percentile among ${b.peers.n} peers · ${rangeLabel(timeRange)} · click a metric to open its source`}>
          <div className="stack" style={{ gap: 14 }}>
            {b.metrics.map((m) => {
              const better = m.higherBetter ? m.you >= m.median : m.you <= m.median;
              return (
                <button key={m.key} type="button" className="ops-metric" onClick={() => METRIC_SRC[m.key] && nav(METRIC_SRC[m.key].to)} title={`Source: ${srcFor(m.key)} · click to open`}>
                  <div className="row" style={{ gap: 10, fontSize: 12.5 }}>
                    <b style={{ flex: 1 }}>{m.label}</b>
                    <span className="num" style={{ fontWeight: 700 }}>{m.you}{m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''}</span>
                    <span className="muted" style={{ fontSize: 11, width: 150, textAlign: 'right' }}>median {m.median}{m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''} · Q3 {m.q3}</span>
                    {better ? <TrendingUp size={14} style={{ color: 'var(--good)' }} /> : <TrendingDown size={14} style={{ color: 'var(--sev-medium)' }} />}
                    <Badge color={pctColor(m.pct)}>P{m.pct}</Badge>
                  </div>
                  <div style={{ position: 'relative', height: 10, marginTop: 6, borderRadius: 5, background: 'linear-gradient(90deg, color-mix(in srgb, var(--bad) 30%, transparent), color-mix(in srgb, var(--sev-medium) 30%, transparent) 35%, color-mix(in srgb, #68b1ff 30%, transparent) 60%, color-mix(in srgb, var(--good) 35%, transparent))' }}>
                    <div style={{ position: 'absolute', left: '50%', top: -2, width: 1.5, height: 14, background: 'var(--text-muted)' }} title="Median" />
                    <div style={{ position: 'absolute', left: '75%', top: -2, width: 1.5, height: 14, background: 'var(--text-muted)', opacity: 0.5 }} title="Top quartile" />
                    <div style={{ position: 'absolute', left: `calc(${m.pct}% - 7px)`, top: -2, width: 14, height: 14, borderRadius: '50%', background: pctColor(m.pct), border: '2px solid var(--card-bg)', boxShadow: '0 0 0 1px var(--card-border)' }} />
                  </div>
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>{m.higherBetter ? 'Higher is better' : 'Lower is better'} · {srcFor(m.key)}</div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <Legend items={[{ label: 'Bottom quartile', color: 'var(--bad)' }, { label: 'Below median', color: 'var(--sev-medium)' }, { label: 'Above median', color: '#68b1ff' }, { label: 'Top quartile', color: 'var(--good)' }]} />
          </div>
        </Card>
        </div>
        <div className="stack">
          <div id="ops-bm-gaps" style={{ scrollMarginTop: 80 }}>
          <Card title="Capability gaps to top quartile" sub="Points needed to reach Q3 · click to open the capability">
            <HBars
              labelWidth={150}
              max={Math.max(1, ...b.radar.map((x) => Math.abs(x.top - x.you)))}
              items={[...b.radar].sort((x, y) => (y.top - y.you) - (x.top - x.you)).map((x) => {
                const gap = x.top - x.you;
                return {
                  key: x.id,
                  label: x.label,
                  sub: `you ${x.you} · median ${x.median} · Q3 ${x.top}`,
                  value: Math.abs(gap),
                  display: gap > 0 ? `+${gap}` : 'ahead',
                  color: gap > 0 ? '#f0a338' : '#2dd4bf',
                  onClick: () => nav(MODULE_BY_ID[x.id].basePath),
                };
              })}
            />
          </Card>
          </div>
          <Card title="Participation" sub="Benchmarking is opt-in and can be withdrawn at any time" actions={<Users2 size={16} style={{ color: OPS_TONE }} />}>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <Switch on={optIn} onChange={(v) => { setOptIn(v); toast(v ? 'Opted in: your anonymised aggregates join the next monthly cohort' : 'Opted out: your aggregates are removed from the next cohort; you keep this month’s view'); }} />
                <span style={{ fontSize: 12.5 }}><b>Contribute anonymised aggregates</b></span>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <Switch on={shareGranular} disabled={!optIn} onChange={(v) => { setShareGranular(v); toast(v ? 'Capability-level scores will be contributed' : 'Only the Resilience Index will be contributed'); }} />
                <span style={{ fontSize: 12.5 }}>Include capability-level scores</span>
              </div>
              <KV
                rows={[
                  ['Cohort', `${c.sector} · ${b.peers.n} peers`],
                  ['Minimum cohort', '10 contributors per metric (k-anonymity)'],
                  ['Shared', 'Aggregated scores and medians only'],
                  ['Never shared', 'Names, tenants, assets, findings, raw events'],
                ]}
              />
              <Callout kind="info">
                <EyeOff size={12} style={{ verticalAlign: -2 }} /> Peers see {c.short} only as one anonymous point in the distribution.
              </Callout>
            </div>
          </Card>
        </div>
      </div>
      {recordsNode}
    </>
  );
}
