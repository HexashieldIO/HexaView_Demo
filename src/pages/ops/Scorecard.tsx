import { useMemo, useState, type ReactNode } from 'react';
import { Gauge, Wrench, Merge, RefreshCw, Replace } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { scopedTenants, isStale } from '../../data/customers';
import { toolScores, overlapPct, GRADE_COLOR, RECO_COLOR, gradeOf, type ToolScore, type Reco } from '../../data/modules/ops';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Bar, Sources, Freshness, HealthBadge } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtMoney, fmtNum, fmtAgo } from '../../lib/format';
import { OPS_TONE, useParamFilter, FilterChip, HBars, useRecords, scrollToId, StatLink } from './parts';

const RECO_ICON: Record<Reco, typeof Wrench> = { Renew: RefreshCw, Tune: Wrench, Consolidate: Merge, Replace };
const GRADE_HEX: Record<string, string> = { A: '#2dd4bf', B: '#68b1ff', C: '#f0a338', D: '#f2643f', F: '#e0345e' };

function GradeChip({ g, size = 30 }: { g: ReturnType<typeof gradeOf>; size?: number }) {
  return (
    <span style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: 8, fontWeight: 800, fontSize: size * 0.5, color: '#fff', background: GRADE_COLOR[g] }}>{g}</span>
  );
}

export default function Scorecard() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const tenants = scopedTenants(c, tenantId);
  const scores = useMemo(() => toolScores(c, tenantId, days), [c, tenantId, days]);
  const [sel, setSel] = useState<ToolScore | null>(null);
  const [recoF, setRecoF] = useParamFilter('reco');
  const [gradeF, setGradeF] = useParamFilter('grade');
  const [, openRecords, recordsNode] = useRecords();

  const spend = scores.reduce((s, t) => s + t.cost, 0);
  const avg = Math.round(scores.reduce((s, t) => s + t.composite, 0) / Math.max(1, scores.length));
  const validations = scores.reduce((s, t) => s + t.validations, 0);
  const passed = scores.reduce((s, t) => s + t.passed, 0);
  const byReco = (r: Reco) => scores.filter((t) => t.reco === r);
  const savings = byReco('Consolidate').reduce((s, t) => s + t.cost * 0.8, 0) + byReco('Replace').reduce((s, t) => s + t.cost * 0.25, 0);
  const pairs: { a: ToolScore; b: ToolScore; pct: number }[] = [];
  scores.forEach((a, i) => scores.slice(i + 1).forEach((b) => { const pct = overlapPct(a.tags, b.tags); if (pct >= 50) pairs.push({ a, b, pct }); }));
  pairs.sort((x, y) => y.pct - x.pct);
  const gradeCounts = (['A', 'B', 'C', 'D', 'F'] as const).map((g) => ({ g, n: scores.filter((t) => t.grade === g).length }));

  const recoSet = recoF ? recoF.split(',') : null;
  const tableRows = scores.filter((t) => (!recoSet || recoSet.includes(t.reco)) && (!gradeF || t.grade === gradeF));
  const pivot = (reco: string | null, grade: string | null = null) => {
    setRecoF(reco);
    setGradeF(grade);
    scrollToId('ops-scorecard');
  };
  const srcAll = `Connector telemetry (${scores.slice(0, 3).map((t) => t.k.product).join(', ')}…) · HexaStrike validations · HexaMatrix coverage`;
  const toolRecords = (title: string, list: ToolScore[], right: (t: ToolScore) => ReactNode, source = srcAll) =>
    openRecords({ title, source, rows: list.map((t) => ({ key: t.k.id, main: `${t.k.vendor} ${t.k.product}`, meta: `${t.k.category} · grade ${t.grade} · ${t.reco}: ${t.recoWhy}`, right: right(t), color: GRADE_COLOR[t.grade] })) });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''}: how your own {scores.length} tools really perform, graded from live telemetry, HexaStrike validations and sync health: {scores.slice(0, 6).map((t) => `${t.k.vendor} ${t.k.product}`).join(', ')}
        {scores.length > 6 ? ` and ${scores.length - 6} more` : ''}. Costs are indicative annual figures in {c.currency}.
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Tools graded', value: scores.length, unit: `${gradeCounts.filter((x) => x.g === 'A' || x.g === 'B').reduce((s, x) => s + x.n, 0)} at A or B`, onClick: () => pivot(null), source: srcAll },
          { label: 'Portfolio score', value: avg, unit: `grade ${gradeOf(avg)}`, bar: avg, source: srcAll, onClick: () => toolRecords('Composite score by tool', [...scores].sort((a, b) => b.composite - a.composite), (t) => <b>{t.composite}</b>) },
          { label: 'Annual tool spend', value: fmtMoney(spend, c.currency), unit: 'indicative', source: 'Contract register (indicative list prices)', onClick: () => toolRecords('Annual cost by tool', [...scores].sort((a, b) => b.cost - a.cost), (t) => <b>{fmtMoney(t.cost, c.currency)}</b>, 'Contract register (indicative list prices)') },
          { label: 'Validations', hint: rangeLabel(timeRange).replace('Last ', ''), value: fmtNum(validations), unit: `${Math.round((passed / Math.max(1, validations)) * 100)}% detected`, source: 'HexaStrike breach-and-attack validations', onClick: () => toolRecords('Validations detected by tool', [...scores].sort((a, b) => a.efficacy - b.efficacy), (t) => <span><b>{t.passed}</b>/{t.validations}</span>, 'HexaStrike breach-and-attack validations') },
          { label: 'Overlapping pairs', value: pairs.filter((p) => p.pct >= 75).length, unit: '≥ 75% overlap', onClick: () => scrollToId('ops-overlap'), source: 'HexaView capability map' },
          { label: 'Potential saving', value: fmtMoney(savings, c.currency), unit: 'per year', delta: { text: `${byReco('Consolidate').length} consolidate · ${byReco('Replace').length} replace`, good: true }, onClick: () => pivot('Consolidate,Replace'), source: 'Scorecard recommendations · contract register' },
        ]}
      />

      <div id="ops-scorecard" style={{ scrollMarginTop: 80 }}>
      <Card title="Scorecard" count={tableRows.length} actions={<FilterChip label={[recoF?.replace(',', ' or '), gradeF ? `Grade ${gradeF}` : null].filter(Boolean).join(' · ')} onClear={() => pivot(null)} />} sub={`Coverage = ATT&CK priority techniques the tool contributes to · efficacy = HexaStrike validations detected (${rangeLabel(timeRange)}) · signal-to-noise = true-positive rate · data quality = sync freshness, drift and health`} flush>
        <DataTable
          rows={tableRows}
          rowKey={(t) => t.k.id}
          onRowClick={setSel}
          search={(t) => `${t.k.vendor} ${t.k.product} ${t.k.category} ${t.reco}`}
          searchPlaceholder="Filter tools…"
          initialSort={{ key: 'grade', dir: 'desc' }}
          pageSize={30}
          columns={[
            { key: 'grade', header: 'Grade', sort: (t) => t.composite, render: (t) => (<div className="row" style={{ gap: 8 }}><GradeChip g={t.grade} /><span className="num muted">{t.composite}</span></div>) },
            { key: 'tool', header: 'Tool', sort: (t) => t.k.product, render: (t) => (<><div className="t-main">{t.k.vendor} {t.k.product}</div><div className="t-sub">{t.k.category} · {t.k.env}</div></>) },
            { key: 'cov', header: 'Coverage', sort: (t) => t.coverage, render: (t) => (<div style={{ minWidth: 80 }}><Bar value={t.coverage} size="thin" color={PALETTE[0]} /><span className="t-sub">{t.coverage}%</span></div>) },
            { key: 'eff', header: 'Efficacy', sort: (t) => t.efficacy, render: (t) => (<div style={{ minWidth: 80 }}><Bar value={t.efficacy} size="thin" color={PALETTE[1]} /><span className="t-sub">{t.passed}/{t.validations} detected</span></div>) },
            { key: 'snr', header: 'Signal / noise', sort: (t) => t.snr, render: (t) => <span className="num" style={{ color: t.snr < 62 ? 'var(--sev-medium)' : undefined }}>{t.snr}%</span> },
            { key: 'dq', header: 'Data quality', sort: (t) => t.dataQuality, render: (t) => (<><span className="num" style={{ color: t.dataQuality < 75 ? 'var(--warn)' : undefined, fontWeight: 600 }}>{t.dataQuality}</span>{isStale(t.k) && <div><Freshness minutes={t.k.lastSyncMin} stale label={t.k.product} /></div>}</>) },
            { key: 'cost', header: 'Annual cost', align: 'right', sort: (t) => t.cost, render: (t) => fmtMoney(t.cost, c.currency) },
            { key: 'val', header: 'Value / cost', sort: (t) => t.valueIdx, render: (t) => (<div style={{ minWidth: 70 }}><Bar value={t.valueIdx} size="thin" color={OPS_TONE} /><span className="t-sub">index {t.valueIdx}</span></div>) },
            { key: 'reco', header: 'Recommendation', sort: (t) => t.reco, render: (t) => <Badge color={RECO_COLOR[t.reco]}>{t.reco}</Badge> },
          ]}
        />
      </Card>
      </div>

      <div className="grid g-3-2">
        <div id="ops-overlap" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Capability overlap" count={pairs.length} sub="Tool pairs sharing 50% or more of their capabilities (relative to the smaller tool) · click to open the weaker tool">
          {pairs.length ? (
            <HBars
              labelWidth={250}
              max={100}
              items={pairs.slice(0, 14).map((pr) => {
                const weak = pr.a.composite < pr.b.composite ? pr.a : pr.b;
                return {
                  key: `${pr.a.k.id}-${pr.b.k.id}`,
                  label: `${pr.a.k.product} × ${pr.b.k.product}`,
                  sub: `${pr.a.tags.filter((t) => pr.b.tags.includes(t)).join(', ')}`,
                  value: pr.pct,
                  display: `${pr.pct}%`,
                  color: pr.pct >= 75 ? '#a07cfb' : '#5b6b8c',
                  onClick: () => setSel(weak),
                };
              })}
            />
          ) : (
            <div className="muted">No material overlap in this scope.</div>
          )}
        </Card>
        </div>
        <Card title="Recommendations" sub="Consolidate, tune, renew or replace, with the reason">
          <div className="stack" style={{ gap: 12 }}>
            {(['Replace', 'Consolidate', 'Tune', 'Renew'] as Reco[]).map((r) => {
              const items = byReco(r);
              if (!items.length) return null;
              const Icon = RECO_ICON[r];
              return (
                <div key={r}>
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    <Icon size={14} style={{ color: RECO_COLOR[r] }} />
                    <button type="button" className="cc-link" style={{ fontWeight: 700, fontSize: 12.5 }} onClick={() => pivot(r)} title="Filter the scorecard">{r}</button>
                    <span className="muted" style={{ fontSize: 11 }}>{items.length} tool{items.length > 1 ? 's' : ''} · {fmtMoney(items.reduce((s, t) => s + t.cost, 0), c.currency)}</span>
                  </div>
                  <div className="list">
                    {items.map((t) => (
                      <button key={t.k.id} className="list-row" onClick={() => setSel(t)}>
                        <GradeChip g={t.grade} size={22} />
                        <span className="list-main">
                          <b>{t.k.vendor} {t.k.product}</b>
                          <span style={{ whiteSpace: 'normal' }}>{t.recoWhy} · renewal in {t.renewalDays} d</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Value map" sub="Annual cost against composite score; bubble size is ATT&CK coverage · click a bubble to open the tool">
          <Chart
            height={300}
            onClick={(p: unknown) => { const n = (p as { name?: string }).name; const t = scores.find((x) => x.k.product === n); if (t) setSel(t); }}
            option={{
              grid: { left: 8, right: 24, top: 24, bottom: 8, containLabel: true },
              tooltip: { formatter: (p: unknown) => { const d = (p as { data: { name: string; value: number[] } }).data; return `<b>${d.name}</b><br/>${fmtMoney(d.value[0], c.currency)} · score ${d.value[1]} · coverage ${d.value[2]}%`; } },
              xAxis: { type: 'value', name: `Annual cost (${c.currency})`, axisLabel: { formatter: (v: number) => fmtMoney(v, c.currency) } },
              yAxis: { type: 'value', name: 'Composite', min: 40, max: 100 },
              series: [{
                type: 'scatter',
                symbolSize: (v: number[]) => 8 + v[2] / 3,
                data: scores.map((t) => ({ name: t.k.product, value: [t.cost, t.composite, t.coverage], itemStyle: { color: GRADE_HEX[t.grade], opacity: 0.85 } })),
                label: { show: false },
                emphasis: { label: { show: true, formatter: (p: unknown) => (p as { name: string }).name, position: 'top', fontSize: 11, color: '#e6ecf8' } },
                markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: '#5b6b8c' }, data: [{ yAxis: 75, name: 'B' }] },
              }],
            }}
          />
        </Card>
        <Card title="Grade distribution" sub={`${scores.length} tools · ${tenantId === 'all' ? 'group' : tenants[0]?.short}`}>
          <div className="ops-grades">
            {gradeCounts.map((x) => (
              <button key={x.g} type="button" className={`ops-grade ${gradeF === x.g ? 'on' : ''}`} onClick={() => pivot(null, gradeF === x.g ? null : x.g)} title={`Show grade ${x.g} tools`}>
                <span className="g" style={{ background: GRADE_COLOR[x.g] }}>{x.g}</span>
                <span className="col"><i style={{ height: `${(x.n / Math.max(1, ...gradeCounts.map((y) => y.n))) * 100}%`, background: GRADE_HEX[x.g] }} /></span>
                <b>{x.n}</b>
              </button>
            ))}
          </div>
          <div className="ops-stats" style={{ marginTop: 12 }}>
            <StatLink value={byReco('Renew').length} label="renew" color="var(--good)" onClick={() => pivot('Renew')} source={srcAll} />
            <StatLink value={byReco('Tune').length} label="tune" color="var(--sev-medium)" onClick={() => pivot('Tune')} source={srcAll} />
            <StatLink value={byReco('Consolidate').length} label="consolidate" color="var(--m-core)" onClick={() => pivot('Consolidate')} source={srcAll} />
            <StatLink value={byReco('Replace').length} label="replace" color="var(--bad)" onClick={() => pivot('Replace')} source={srcAll} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Callout kind="info">
              Composite = 25% coverage + 30% detection efficacy + 20% signal-to-noise + 25% data quality. Weights are versioned and shown on every report.
            </Callout>
          </div>
        </Card>
      </div>

      {recordsNode}
      {sel && (
        <Drawer title={`${sel.k.vendor} ${sel.k.product}`} sub={`${sel.k.category} · grade ${sel.grade} · ${sel.composite}/100`} onClose={() => setSel(null)} icon={<Gauge size={20} style={{ color: OPS_TONE }} />}
          footer={<><Btn onClick={() => setSel(null)}>Close</Btn><Btn primary color={OPS_TONE} onClick={() => { toast(`Recommendation "${sel.reco}" for ${sel.k.product} added to the tooling review pack`); setSel(null); }}>Add to tooling review</Btn></>}
        >
          <div className="stack" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 14 }}>
              <GradeChip g={sel.grade} size={52} />
              <div>
                <Badge color={RECO_COLOR[sel.reco]}>{sel.reco}</Badge>
                <div className="secondary" style={{ fontSize: 12.5, marginTop: 6 }}>{sel.recoWhy}</div>
              </div>
            </div>
            <Chart
              height={220}
              option={{
                radar: { indicator: ['Coverage', 'Efficacy', 'Signal/noise', 'Data quality', 'Value/cost'].map((n) => ({ name: n, max: 100 })), radius: '65%' },
                series: [{ type: 'radar', data: [
                  { name: sel.k.product, value: [sel.coverage, sel.efficacy, sel.snr, sel.dataQuality, sel.valueIdx], areaStyle: { opacity: 0.25 }, itemStyle: { color: PALETTE[2] } },
                  { name: 'Portfolio average', value: [avg, avg, avg, avg, 50], lineStyle: { type: 'dashed' }, itemStyle: { color: '#8a9bc0' } },
                ] }],
                legend: { bottom: 0 },
              }}
            />
            <KV
              rows={[
                ['Health', <HealthBadge status={sel.k.status} />],
                ['Last sync', `${fmtAgo(sel.k.lastSyncMin)} (every ${sel.k.intervalMin} min)`],
                ['Schema drift', sel.k.drift ? `${sel.k.drift} fields` : 'None'],
                ['Validations', `${sel.passed} of ${sel.validations} detected · ${rangeLabel(timeRange)}`],
                ['Annual cost', fmtMoney(sel.cost, c.currency, false)],
                ['Renewal', `in ${sel.renewalDays} days`],
                ['Capabilities', sel.tags.join(', ')],
                ['Overlaps with', scores.filter((o) => o !== sel && overlapPct(o.tags, sel.tags) >= 50).map((o) => `${o.k.product} (${overlapPct(o.tags, sel.tags)}%)`).join(', ') || 'None'],
                ['Note', sel.k.note ?? '—'],
              ]}
            />
            <Sources items={[{ name: sel.k.product, status: sel.k.status }, { name: 'HexaStrike', status: 'healthy' }, { name: 'HexaMatrix', status: 'healthy' }]} />
          </div>
        </Drawer>
      )}
    </>
  );
}
