import { useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '../../../state/AppContext';
import { Card, KpiStrip, Badge, Bar, Chip, Legend, Callout } from '../../../components/ui';
import { DataTable, type Column } from '../../../components/DataTable';
import { Seg } from '../parts';
import {
  portfolio, portfolioTotals, DIMENSIONS, PF_STATUS_COLOR, PF_STATUS_HEX, PF_STATUS_LABEL, type PortfolioCo, type PfStatus,
} from '../../../data/modules/portfolio';
import { scoreTone } from '../../../lib/format';
import { CoName, PF_TONE, Spark, heatHex, usdM, useOpenCo, usePfNav } from './parts';
import { CoDrawer } from './CoDrawer';

type Lens = 'sponsor' | 'insurer' | 'group';
const LENS: Record<Lens, { label: string; axis: string; val: (c: PortfolioCo) => number }> = {
  sponsor: { label: 'PE sponsor', axis: 'Enterprise value', val: (c) => c.evM },
  insurer: { label: 'Insurer', axis: 'Cyber limit written', val: (c) => c.insuredLimitM },
  group: { label: 'Group', axis: 'Revenue', val: (c) => c.revenueM },
};

const SHORT: Record<string, string> = { Identity: 'IAM', Endpoint: 'EDR', Cloud: 'Cloud', 'OT / IoT': 'OT', 'Third parties': '3rd', Recovery: 'DR', Compliance: 'GRC' };
const W = 660;
const H = 340;
const L = 56;
const R = 640;
const T = 18;
const B = 296;

function Quadrant({ cos, lens, onPick }: { cos: PortfolioCo[]; lens: Lens; onPick: (c: PortfolioCo) => void }) {
  const val = LENS[lens].val;
  const vals = cos.map(val);
  const lo = Math.floor(Math.log10(Math.min(...vals)) * 2) / 2 - 0.1;
  const hi = Math.ceil(Math.log10(Math.max(...vals)) * 2) / 2 + 0.1;
  const x = (ri: number) => L + ((Math.min(56, Math.max(8, 100 - ri)) - 8) / 48) * (R - L);
  const y = (v: number) => B - ((Math.log10(v) - lo) / (hi - lo)) * (B - T);
  const gmean = 10 ** (vals.reduce((s, v) => s + Math.log10(v), 0) / vals.length);
  const qx = x(70);
  const qy = y(gmean);
  const maxEmp = Math.max(...cos.map((c) => c.employees));
  const ticks: number[] = [];
  for (let e = Math.ceil(lo); e <= hi; e++) ticks.push(10 ** e);
  const fmtTick = (m: number) => (m >= 1000 ? `$${m / 1000}B` : `$${m}M`);
  return (
    <svg className="pf-quad" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Portfolio risk versus value">
      <rect x={qx} y={T} width={R - qx} height={qy - T} fill="rgba(240,70,110,0.08)" />
      <rect x={L} y={T} width={qx - L} height={qy - T} fill="rgba(34,197,94,0.06)" />
      <rect x={qx} y={qy} width={R - qx} height={B - qy} fill="rgba(240,163,56,0.07)" />
      <text x={R - 6} y={T + 14} textAnchor="end" fontSize={12} fontWeight={700} fill="#f0466e">PROTECT VALUE · fix first</text>
      <text x={L + 6} y={T + 14} fontSize={12} fontWeight={700} fill="#22c55e">MAINTAIN</text>
      <text x={R - 6} y={B - 8} textAnchor="end" fontSize={12} fontWeight={700} fill="#f0a338">FAST FIXES</text>
      <text x={L + 6} y={B - 8} fontSize={12} fontWeight={700} fill="#8593b4">MONITOR</text>
      <line x1={qx} x2={qx} y1={T} y2={B} stroke="#8593b4" strokeDasharray="4 4" strokeWidth={1} />
      <line x1={L} x2={R} y1={qy} y2={qy} stroke="#8593b4" strokeDasharray="4 4" strokeWidth={1} />
      <line x1={L} x2={R} y1={B} y2={B} stroke="#8593b4" strokeOpacity={0.5} />
      <line x1={L} x2={L} y1={T} y2={B} stroke="#8593b4" strokeOpacity={0.5} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L - 4} x2={L} y1={y(t)} y2={y(t)} stroke="#8593b4" />
          <text x={L - 7} y={y(t) + 4} textAnchor="end" fontSize={11.5} fill="#8593b4">{fmtTick(t)}</text>
        </g>
      ))}
      {[90, 80, 70, 60, 50].map((ri) => (
        <text key={ri} x={x(ri)} y={B + 15} textAnchor="middle" fontSize={11.5} fill="#8593b4">{ri}</text>
      ))}
      <text x={(L + R) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="#8593b4">Resilience Index (higher risk to the right) →</text>
      <text x={14} y={(T + B) / 2} textAnchor="middle" fontSize={12} fill="#8593b4" transform={`rotate(-90 14 ${(T + B) / 2})`}>{LENS[lens].axis} (log)</text>
      {cos.slice().sort((a, b) => b.employees - a.employees).map((c) => {
        const r = 6 + Math.sqrt(c.employees / maxEmp) * 16;
        const cx = x(c.ri);
        const cy = y(val(c));
        const right = cx < R - 90;
        return (
          <g key={c.id} className="pf-bub" onClick={() => onPick(c)}>
            <title>{`${c.name} · RI ${c.ri} · ${LENS[lens].axis} ${fmtTick(val(c))} · ${c.openCritical} critical open`}</title>
            <circle cx={cx} cy={cy} r={r} fill={PF_STATUS_HEX[c.status]} fillOpacity={0.28} stroke={PF_STATUS_HEX[c.status]} strokeWidth={c.demoId ? 2.2 : 1.4} strokeDasharray={c.status === 'integrating' ? '3 2' : undefined} />
            <text x={right ? cx + r + 4 : cx - r - 4} y={cy + 4} textAnchor={right ? 'start' : 'end'} fontSize={11.5} fontWeight={c.demoId ? 700 : 500} fill="currentColor">{c.short}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Risk() {
  const { customerId } = useApp();
  const cos = useMemo(() => portfolio(), []);
  const t = portfolioTotals(cos);
  const { sp, set, patch } = usePfNav();
  const [lens, setLens] = useState<Lens>('sponsor');
  const [sel, setSel] = useState<PortfolioCo | null>(() => cos.find((c) => c.id === sp.get('co') && !c.demoId) ?? null);
  const open = useOpenCo(setSel);
  const filter = sp.get('filter');
  const sort = sp.get('sort');
  const rows = cos.filter((c) => !filter || (filter === 'below' && c.ri < 70) || (filter === 'critical' && c.openCritical > 0) || (filter === 'integrating' && c.status === 'integrating') || filter === c.status);

  const cols: Column<PortfolioCo>[] = [
    { key: 'name', header: 'Company', sort: (c) => c.short, render: (c) => <CoName co={c} /> },
    { key: 'own', header: 'Holding', sort: (c) => c.ownership, render: (c) => <span><span style={{ display: 'block', fontSize: 12 }}>{c.ownership}</span><span className="muted" style={{ fontSize: 11 }}>{usdM(LENS[lens].val(c))}</span></span> },
    { key: 'ri', header: 'Resilience', sort: (c) => c.ri, render: (c) => <span className="row" style={{ gap: 8 }}><b className="num" style={{ color: scoreTone(c.ri), fontSize: 15, minWidth: 22 }}>{c.ri}</b><Spark data={c.trend} color={c.delta >= 0 ? '#22c55e' : '#f0466e'} /><span className="muted" style={{ fontSize: 11 }}>{c.delta >= 0 ? '+' : ''}{c.delta}</span></span> },
    { key: 'risk', header: 'Top risk', render: (c) => <span title={c.topRisk} style={{ display: 'block', maxWidth: 230, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{c.topRisk}</span> },
    { key: 'ins', header: 'Insurability', sort: (c) => c.insurability, render: (c) => <span style={{ display: 'grid', gridTemplateColumns: '28px 60px', gap: 6, alignItems: 'center' }}><b className="num">{c.insurability}</b><Bar value={c.insurability} color={scoreTone(c.insurability)} size="thin" /></span> },
    { key: 'crit', header: 'Critical', align: 'right', sort: (c) => c.openCritical, render: (c) => (c.openCritical ? <Badge color="var(--sev-critical)" solid={c.openCritical > 3}>{c.openCritical}</Badge> : <span className="muted">0</span>) },
    { key: 'loss', header: 'Exp. loss', align: 'right', sort: (c) => c.expectedLossM, render: (c) => usdM(c.expectedLossM) },
    { key: 'fw', header: 'Frameworks', render: (c) => <span className="pf-fws">{c.frameworks.slice(0, 3).map((f) => <span key={f.short} style={{ '--tone': scoreTone(f.pct) } as CSSProperties} title={`${f.short}: ${f.pct}% documented`}>{f.short} {f.pct}%</span>)}</span> },
    { key: 'status', header: 'Status', sort: (c) => c.status, render: (c) => <Badge color={PF_STATUS_COLOR[c.status]} dot>{PF_STATUS_LABEL[c.status]}</Badge> },
  ];

  const statuses: PfStatus[] = ['healthy', 'watch', 'critical', 'integrating'];
  const current = cos.find((c) => c.demoId === customerId);

  return (
    <>
      <KpiStrip
        toneColor={PF_TONE}
        items={[
          { label: 'Portfolio companies', value: t.count, hint: `${cos.filter((c) => c.demoId).length} with full tenants`, onClick: () => set('filter', null), source: 'HexaView portfolio registry' },
          { label: 'Portfolio Resilience', value: t.wRi, hint: 'value-weighted', bar: t.wRi, onClick: () => patch({ filter: null, sort: 'ri' }), source: 'Resilience Index across portfolio tenants' },
          { label: 'Below threshold', value: t.below, hint: 'RI under 70', delta: { text: 'covenant: 70', good: false }, onClick: () => set('filter', 'below'), source: 'Resilience Index · portfolio policy' },
          { label: 'Open critical items', value: t.critical, hint: `${cos.filter((c) => c.openCritical).length} companies`, onClick: () => set('filter', 'critical'), source: 'HexaSOC critical incidents · HexaStrike critical findings' },
          { label: 'Avg insurability', value: t.insurability, bar: t.insurability, onClick: () => set('sort', 'ins'), source: 'HexaView insurer model' },
          { label: 'Expected annual loss', value: usdM(t.expectedLossM), hint: 'portfolio', onClick: () => set('sort', 'loss'), source: 'HexaView cyber risk quantification' },
          { label: 'Integrating', value: t.integrating, hint: 'in first 100 days', to: '/partner/portfolio?section=hundred', source: '100-day integration plans' },
        ]}
      />

      <div className="grid g-3-2">
        <Card
          title="Risk against value"
          sub="Every portfolio company by Resilience Index and value; bubble size is headcount, dashed are still integrating · click a bubble"
          toneColor={PF_TONE}
          actions={<Seg options={(Object.keys(LENS) as Lens[]).map((k) => ({ id: k, label: LENS[k].label }))} value={lens} onChange={setLens} />}
        >
          <Quadrant cos={cos} lens={lens} onPick={open} />
          <Legend items={statuses.map((s) => ({ label: `${PF_STATUS_LABEL[s]} ${cos.filter((c) => c.status === s).length}`, color: PF_STATUS_HEX[s] }))} />
        </Card>
        <Card title="Control heat map" sub="Domain scores per company from connected tools or outside-in evidence · click a row" toneColor={PF_TONE}>
          <div className="pf-heat" style={{ gridTemplateColumns: `96px repeat(${DIMENSIONS.length}, minmax(0, 1fr))` }}>
            <span />
            {DIMENSIONS.map((d) => <span key={d} className="pf-hh" title={d}>{SHORT[d]}</span>)}
            {cos.slice().sort((a, b) => a.ri - b.ri).map((c) => (
              <div key={c.id} style={{ display: 'contents' }}>
                <button type="button" className="pf-hr" onClick={() => open(c)} title={c.name}>{c.short}</button>
                {DIMENSIONS.map((d) => (
                  <button key={d} type="button" className="pf-cell" style={{ background: heatHex(c.dims[d]) }} onClick={() => open(c)} title={`${c.short} · ${d}: ${c.dims[d]}`}>{c.dims[d]}</button>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {current && (
        <Callout color={PF_TONE}>
          You are viewing the portfolio from <b>{current.name}</b>'s workspace. Click any <b>LIVE</b> company to open its own Command Centre; other companies open a summary from outside-in and connector evidence.
        </Callout>
      )}

      <Card
        title="Portfolio companies"
        count={rows.length}
        sub="Resilience, trend, top risk, insurability, open critical items and framework status · click a row"
        flush
        actions={
          <span className="chips">
            <Chip on={!filter} onClick={() => set('filter', null)}>All</Chip>
            <Chip on={filter === 'below'} onClick={() => set('filter', filter === 'below' ? null : 'below')}>Below 70</Chip>
            <Chip on={filter === 'critical'} onClick={() => set('filter', filter === 'critical' ? null : 'critical')}>Critical open</Chip>
            {statuses.map((s) => <Chip key={s} on={filter === s} color={PF_STATUS_COLOR[s]} onClick={() => set('filter', filter === s ? null : s)}>{PF_STATUS_LABEL[s]}</Chip>)}
          </span>
        }
      >
        <DataTable
          key={sort ?? 'ri'}
          columns={cols}
          rows={rows}
          rowKey={(c) => c.id}
          onRowClick={open}
          search={(c) => `${c.name} ${c.sector} ${c.country} ${c.topRisk}`}
          searchPlaceholder="Filter companies…"
          initialSort={sort === 'ins' ? { key: 'ins', dir: 'asc' } : sort === 'loss' ? { key: 'loss', dir: 'desc' } : { key: 'ri', dir: 'asc' }}
          pageSize={20}
        />
      </Card>
      {sel && <CoDrawer co={sel} onClose={() => setSel(null)} />}
    </>
  );
}
