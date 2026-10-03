import { useMemo, useState } from 'react';
import { useApp } from '../../../state/AppContext';
import { Card, KpiStrip, Chip, Legend, Badge } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { portfolio, benchValues, peerMedian, BENCH_METRICS, type BenchMetric, type PortfolioCo } from '../../../data/modules/portfolio';
import { CoAvatar, CoName, PF_TONE, heatHex, useOpenCo, usePfNav } from './parts';
import { CoDrawer } from './CoDrawer';

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmtV = (m: BenchMetric, v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''}`;

export default function Benchmark() {
  const { customerId } = useApp();
  const cos = useMemo(() => portfolio(), []);
  const { sp, set } = usePfNav();
  const [drawer, setDrawer] = useState<PortfolioCo | null>(null);
  const open = useOpenCo(setDrawer);
  const metric = BENCH_METRICS.find((m) => m.id === sp.get('metric')) ?? BENCH_METRICS[0];
  const co = cos.find((c) => c.id === sp.get('co')) ?? cos.find((c) => c.demoId === customerId) ?? cos[0];
  const vals = useMemo(() => Object.fromEntries(cos.map((c) => [c.id, benchValues(c)])) as Record<string, Record<string, number>>, [cos]);
  const pfMed = useMemo(() => Object.fromEntries(BENCH_METRICS.map((m) => [m.id, median(cos.map((c) => vals[c.id][m.id]))])) as Record<string, number>, [cos, vals]);

  /** 0–100 "goodness" score for a metric value, so lower-is-better metrics compare on the same axis. */
  const score = (m: BenchMetric, v: number) => {
    const all = cos.map((c) => vals[c.id][m.id]);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const s = hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
    return Math.round(Math.max(0, Math.min(100, m.higherBetter ? s : 100 - s)));
  };
  const ranked = cos.slice().sort((a, b) => (metric.higherBetter ? vals[b.id][metric.id] - vals[a.id][metric.id] : vals[a.id][metric.id] - vals[b.id][metric.id]));
  const maxV = Math.max(...cos.map((c) => vals[c.id][metric.id])) * 1.08;
  const peer = peerMedian(co.sector);
  const rank = ranked.findIndex((c) => c.id === co.id) + 1;
  const better = BENCH_METRICS.filter((m) => (m.higherBetter ? vals[co.id][m.id] >= peer.v[m.id] : vals[co.id][m.id] <= peer.v[m.id])).length;

  return (
    <>
      <KpiStrip
        toneColor={PF_TONE}
        items={[
          { label: 'Companies benchmarked', value: cos.length, hint: `${new Set(cos.map((c) => c.sector)).size} sectors`, onClick: () => set('metric', 'ri'), source: 'HexaView portfolio registry' },
          { label: `${co.short} rank`, value: `#${rank}`, unit: `of ${cos.length}`, hint: metric.label, onClick: () => open(co), source: metric.source },
          { label: 'Beats sector peers', value: `${better}/${BENCH_METRICS.length}`, hint: `${co.sector} median, n=${peer.n}`, onClick: () => set('co', co.id), source: 'HexaShield benchmark (anonymised, opted-in tenants)' },
          { label: `Portfolio median ${metric.label.toLowerCase()}`, value: fmtV(metric, Math.round(pfMed[metric.id] * 10) / 10), onClick: () => set('metric', metric.id), source: metric.source },
          { label: 'Best in portfolio', value: ranked[0].short, hint: fmtV(metric, vals[ranked[0].id][metric.id]), onClick: () => set('co', ranked[0].id), source: metric.source },
          { label: 'Needs most help', value: ranked[ranked.length - 1].short, hint: fmtV(metric, vals[ranked[ranked.length - 1].id][metric.id]), onClick: () => set('co', ranked[ranked.length - 1].id), source: metric.source },
        ]}
      />

      <div className="row wrap" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>Metric:</span>
        {BENCH_METRICS.map((m) => <Chip key={m.id} on={m.id === metric.id} color={PF_TONE} onClick={() => set('metric', m.id)}>{m.label}</Chip>)}
      </div>

      <div className="grid g-3-2">
        <Card title={`${metric.label} across the portfolio`} sub={`${metric.higherBetter ? 'Higher' : 'Lower'} is better · tick marks the sector peer median · click a company to compare it`} toneColor={PF_TONE}>
          <div className="pf-rank">
            {ranked.map((c) => {
              const v = vals[c.id][metric.id];
              const pm = peerMedian(c.sector).v[metric.id];
              const ok = metric.higherBetter ? v >= pm : v <= pm;
              return (
                <button key={c.id} type="button" className={`pf-rank-row ${c.id === co.id ? 'on' : ''}`} onClick={() => set('co', c.id)} title={`${c.name}: ${fmtV(metric, v)} · ${c.sector} peer median ${fmtV(metric, pm)} · source: ${metric.source}`}>
                  <span className="pf-rank-name">{c.short}{c.demoId ? ' ●' : ''}</span>
                  <span className="pf-rank-bar">
                    <i style={{ width: `${(v / maxV) * 100}%`, background: ok ? '#22c55e' : '#f0a338', opacity: c.id === co.id ? 1 : 0.75 }} />
                    <em style={{ left: `${(pm / maxV) * 100}%` }} />
                  </span>
                  <span className="pf-rank-val">{fmtV(metric, v)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}><Legend items={[{ label: 'At or better than sector peers', color: '#22c55e' }, { label: 'Behind sector peers', color: '#f0a338' }, { label: '● full HexaView tenant', color: 'transparent' }]} /></div>
        </Card>
        <Card
          title={<span className="row" style={{ gap: 8 }}><CoAvatar co={co} size={22} />{co.short} against peers</span>}
          sub={`All metrics scored 0–100 within the portfolio · ${co.sector} peer median from ${peer.n} HexaShield tenants`}
          toneColor={PF_TONE}
        >
          <Chart
            height={300}
            option={{
              legend: { bottom: 0, itemWidth: 12, itemHeight: 8 },
              tooltip: { trigger: 'item' },
              radar: { radius: '62%', center: ['50%', '46%'], indicator: BENCH_METRICS.map((m) => ({ name: m.label.replace('Phishing-resistant ', '').replace('Critical patch latency', 'Patch latency').replace('Mean time to respond', 'MTTR').replace(' (90 d)', '').replace('Phishing click rate', 'Click rate'), max: 100 })), axisName: { color: '#8593b4', fontSize: 10.5 } },
              series: [{
                type: 'radar',
                data: [
                  { name: co.short, value: BENCH_METRICS.map((m) => score(m, vals[co.id][m.id])), lineStyle: { color: '#fb923c', width: 2 }, itemStyle: { color: '#fb923c' }, areaStyle: { color: 'rgba(251,146,60,0.18)' } },
                  { name: 'Portfolio median', value: BENCH_METRICS.map((m) => score(m, pfMed[m.id])), lineStyle: { color: '#4f8cff', type: 'dashed' }, itemStyle: { color: '#4f8cff' } },
                  { name: `${co.sector} peers`, value: BENCH_METRICS.map((m) => score(m, peer.v[m.id])), lineStyle: { color: '#8593b4' }, itemStyle: { color: '#8593b4' } },
                ],
              }],
            }}
          />
        </Card>
      </div>

      <Card title="Benchmark matrix" sub="Every company on every metric, coloured by position within the portfolio · click a cell to rank by that metric, a name to open the company" flush>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th>
                {BENCH_METRICS.map((m) => <th key={m.id} className="r" style={{ cursor: 'pointer', color: m.id === metric.id ? 'var(--m-partner)' : undefined }} onClick={() => set('metric', m.id)}>{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {cos.map((c) => (
                <tr key={c.id} className="clickable" style={c.id === co.id ? { background: 'color-mix(in srgb, var(--m-partner) 8%, transparent)' } : undefined}>
                  <td onClick={() => open(c)}><CoName co={c} /></td>
                  {BENCH_METRICS.map((m) => {
                    const v = vals[c.id][m.id];
                    const s = score(m, v);
                    return (
                      <td key={m.id} className="r" onClick={() => { set('metric', m.id); }}>
                        <span style={{ display: 'inline-block', minWidth: 52, padding: '2px 6px', borderRadius: 5, background: heatHex(40 + s * 0.55), color: '#fff', fontWeight: 700, fontSize: 11.5 }}>{fmtV(m, v)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td><Badge color={PF_TONE}>Portfolio median</Badge></td>
                {BENCH_METRICS.map((m) => <td key={m.id} className="r num">{fmtV(m, Math.round(pfMed[m.id] * 10) / 10)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      {drawer && <CoDrawer co={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}
