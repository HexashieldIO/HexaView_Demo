import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiStrip, Card, Callout, Legend, Btn, Sources } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { useIntro } from '../../lib/useIntro';
import { useRecords, HBars } from '../ops/parts';
import { STATUS_HEX, CUR_Q, TODAY_M, PG_MONTHS, budgetByQuarter, burnByMonth, totals, workstreamHealth, monthLabel, monthDate, quarterLabel } from '../../data/modules/programme';
import { fmtDateShort } from '../../lib/format';
import { usePg, PG_TONE, PG_HEX, InitiativeDrawer, StatusPill, Stat, variance, varColor, type PC } from './parts';

export default function Budget() {
  const nav = useNavigate();
  const { c, tenantId, list, $ } = usePg();
  const [open, setOpen] = useState<string | null>(null);
  const [, setRecs, recsNode] = useRecords();
  const anim = useIntro(`pg-bu-${c.id}-${tenantId}`, 1600);
  const t = totals(list);
  const byQ = useMemo(() => budgetByQuarter(list), [list]);
  const byM = useMemo(() => burnByMonth(list), [list]);
  const ws = useMemo(() => workstreamHealth(list).filter((x) => x.xs.length), [list]);
  const riTotal = list.reduce((s, i) => s + i.riGain, 0);
  const costPerPoint = riTotal ? t.forecast / riTotal : 0;
  const varPct = t.budget ? Math.round(((t.forecast - t.budget) / t.budget) * 100) : 0;
  const realised = list.reduce((s, i) => s + i.lossReduction * (i.status === 'Complete' ? 1 : (i.pct / 100) * 0.5), 0);
  const fin = c.people.staff.find((p) => /cfo|finance/i.test(p.role));
  const erp = c.connectors.find((k) => /S\/4HANA|NetSuite|Workday|Oracle (Fusion|E-Business)|Dynamics 365 Finance/.test(k.product));
  const erpName = erp ? (/S\/4HANA/.test(erp.product) ? `${erp.vendor} S/4HANA` : `${erp.vendor} ${erp.product}`) : null;
  const finSrc = `Finance cost centre${erp ? ` (${erpName})` : ''} · nightly actuals`;
  const variances = [...list].filter((i) => i.status !== 'Not started' && Math.abs(variance(i)) >= 6).sort((a, b) => variance(b) - variance(a));
  const maxWs = Math.max(...ws.map((x) => Math.max(x.budget, x.forecast)), 1);

  // Burn-down: remaining budget by month, planned vs actual-then-forecast.
  const burn = useMemo(() => {
    let p = t.budget;
    let a = t.budget;
    return byM.map((r) => {
      p -= r.planned;
      a -= r.m < TODAY_M ? r.actual : r.forecast;
      return { m: r.m, planned: Math.max(0, p), actual: r.m < Math.floor(TODAY_M) ? a : null, forecast: r.m >= Math.floor(TODAY_M) - 1 ? a : null };
    });
  }, [byM, t.budget]);

  const quarterRecs = (q: number) => {
    const m0 = q * 3;
    const xs = list.filter((i) => i.start < m0 + 3 && i.end > m0);
    setRecs({
      title: `${quarterLabel(q)} spend`, sub: `${xs.length} initiatives active · planned ${$(byQ[q].planned)} · ${q < CUR_Q ? `actual ${$(byQ[q].actual)}` : `forecast ${$(byQ[q].actual + byQ[q].forecast)}`}`, source: finSrc,
      rows: xs.map((i) => ({ key: i.id, main: <a style={{ cursor: 'pointer' }} onClick={() => { setRecs(null); setOpen(i.id); }}>{i.title}</a>, meta: `${i.id} · ${i.owner.name} · ${i.status}`, right: <b>{$(i.budget * Math.min(3, Math.min(i.end, m0 + 3) - Math.max(i.start, m0)) / (i.end - i.start))}</b>, color: STATUS_HEX[i.status] })),
    });
  };

  return (
    <div className="pg-stack">
      <p className="page-intro">
        <b>{c.name}</b> programme budget in {c.currency}: approved plan against actuals from {erpName ?? 'the finance cost centre'} and owner forecasts at completion, with the value each workstream buys in Resilience Index points and expected loss avoided.{fin ? ` Budget holder: ${c.people.ciso.name}; finance partner: ${fin.name}.` : ''}
      </p>

      <div className="pg-kpi8">
        <KpiStrip
          toneColor={PG_TONE}
          items={[
            { label: 'Approved budget', value: $(anim(t.budget)), unit: `${PG_MONTHS} months`, onClick: () => setRecs({ title: 'Approved budget by initiative', source: 'Programme business case · steering committee approvals', rows: [...list].sort((a, b) => b.budget - a.budget).map((i) => ({ key: i.id, main: <a style={{ cursor: 'pointer' }} onClick={() => { setRecs(null); setOpen(i.id); }}>{i.title}</a>, meta: `${i.id} · ${i.status}`, right: <b>{$(i.budget)}</b>, color: STATUS_HEX[i.status] })) }), source: 'Programme business case' },
            { label: 'Spent to date', value: $(anim(t.spent)), unit: `plan ${$(t.plannedToDate)}`, bar: t.budget ? (t.spent / t.budget) * 100 : 0, delta: { text: `${Math.round((t.spent / Math.max(1, t.plannedToDate)) * 100)}% of plan to date`, good: t.spent <= t.plannedToDate * 1.03 }, onClick: () => quarterRecs(CUR_Q), source: finSrc },
            { label: 'Forecast at completion', value: $(anim(t.forecast)), unit: `${varPct >= 0 ? '+' : ''}${varPct}% vs budget`, toneColor: varPct > 3 ? 'var(--bad)' : 'var(--good)', onClick: () => document.getElementById('pg-var')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'Owner forecasts, reviewed monthly' },
            { label: 'Capex / opex', value: `${Math.round((t.capex / Math.max(1, t.forecast)) * 100)}%`, unit: `capex · ${$(t.opex)} opex`, bar: (t.capex / Math.max(1, t.forecast)) * 100, onClick: () => document.getElementById('pg-capex')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'Finance classification per cost line' },
            { label: 'Cost per RI point', value: $(anim(costPerPoint)), unit: `${riTotal.toFixed(1)} points`, onClick: () => document.getElementById('pg-cpp')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'Forecast cost ÷ modelled Resilience Index gain' },
            { label: 'Value realised', value: $(anim(realised)), unit: 'loss avoided / yr', toneColor: 'var(--good)', to: '/reports/value', source: 'Expected-loss model · completed and in-flight initiatives' },
            { label: 'Over budget', value: Math.round(anim(list.filter((i) => variance(i) > 5).length)), unit: 'initiatives > 5%', toneColor: 'var(--sev-medium)', onClick: () => document.getElementById('pg-var')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'Forecast vs approved budget per initiative' },
            { label: 'Contingency', value: $(t.budget * 0.08), unit: `${$(Math.max(0, t.budget * 0.08 - Math.max(0, t.forecast - t.budget)))} left`, toneColor: t.forecast - t.budget > t.budget * 0.08 ? 'var(--bad)' : undefined, onClick: () => document.getElementById('pg-var')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'Programme contingency (8% of approved budget)' },
          ]}
        />
      </div>

      <div className="grid g-3-2">
        <Card title="Spend by quarter" sub="Planned vs actual (past) and forecast (to come) · click a quarter" actions={<Sources items={[{ name: erpName ?? 'Finance cost centre', status: erp?.status }, { name: 'Owner forecasts' }]} />}>
          <Chart
            height={260}
            onClick={(p) => { const d = p as { dataIndex?: number }; if (typeof d.dataIndex === 'number') quarterRecs(d.dataIndex); }}
            option={{
              grid: { left: 8, right: 10, top: 18, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => (v == null ? '—' : $(Number(v))) },
              xAxis: { type: 'category', data: byQ.map((q) => (q.q === CUR_Q ? `${q.label} ●` : q.label)) },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => $(v) } },
              series: [
                { name: 'Planned', type: 'bar', data: byQ.map((q) => Math.round(q.planned)), color: '#5b6785', barGap: '10%', barMaxWidth: 22 },
                { name: 'Actual', type: 'bar', stack: 'af', data: byQ.map((q) => Math.round(q.actual) || null), color: PG_HEX, barMaxWidth: 22 },
                { name: 'Forecast', type: 'bar', stack: 'af', data: byQ.map((q) => Math.round(q.forecast) || null), color: '#818cf855', itemStyle: { borderColor: PG_HEX, borderType: 'dashed', borderWidth: 1 }, barMaxWidth: 22 },
              ],
            }}
          />
          <Legend items={[{ label: 'Planned', color: '#5b6785' }, { label: 'Actual', color: PG_HEX }, { label: 'Forecast', color: '#818cf855' }]} />
        </Card>

        <Card title="Burn-down" sub="Budget remaining, plan vs actual then forecast">
          <Chart
            height={260}
            option={{
              grid: { left: 8, right: 14, top: 18, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '—' : $(Number(v))) },
              xAxis: { type: 'category', data: burn.map((b) => monthLabel(b.m + 1, true)), boundaryGap: false, axisLabel: { interval: 3 } },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => $(v) } },
              series: [
                { name: 'Plan', type: 'line', data: burn.map((b) => Math.round(b.planned)), color: '#8593b4', symbol: 'none', lineStyle: { width: 1.6 } },
                { name: 'Actual', type: 'line', data: burn.map((b) => (b.actual == null ? null : Math.round(b.actual))), color: PG_HEX, symbol: 'none', lineStyle: { width: 2.6 }, areaStyle: { opacity: 0.1 }, animationDuration: 1400,
                  markLine: { symbol: 'none', silent: true, lineStyle: { color: '#ef6aae', width: 1.4, type: 'solid' }, label: { formatter: 'Today', color: '#ef6aae', fontSize: 10.5, position: 'insideEndTop' }, data: [{ xAxis: monthLabel(Math.floor(TODAY_M), true) }] } },
                { name: 'Forecast', type: 'line', data: burn.map((b) => (b.forecast == null ? null : Math.round(b.forecast))), color: varPct > 3 ? '#f8646f' : PG_HEX, symbol: 'none', lineStyle: { width: 2, type: 'dashed' }, animationDelay: 700 },
              ],
            }}
          />
          <Callout kind={varPct > 3 ? 'warn' : 'good'}>
            {varPct > 3
              ? <>Forecast lands <b>{$(t.forecast - t.budget)}</b> over the approved budget ({varPct}%): {t.forecast - t.budget > t.budget * 0.08 ? 'more than the 8% contingency; a change request to steering is needed.' : 'inside the 8% contingency.'}</>
              : <>Forecast at completion is within budget ({varPct >= 0 ? '+' : ''}{varPct}%); contingency untouched.</>}
          </Callout>
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="By workstream" sub="Grey track = approved budget · bar = spent · tick = forecast at completion · click to open">
          <div className="pg-pva pg-anim" key={`${c.id}-${tenantId}`}>
            {ws.map((x, k) => {
              const v = x.budget ? Math.round(((x.forecast - x.budget) / x.budget) * 100) : 0;
              return (
                <button key={x.w.id} type="button" className="pg-pvarow" onClick={() => nav(`/programme/initiatives?ws=${x.w.id}`)} title={`Source: ${finSrc}`}>
                  <span className="nm"><b>{x.w.label}</b><span>{x.xs.length} initiatives · {x.pct}% done</span></span>
                  <span className="trk">
                    <i className="p" style={{ width: `${(x.budget / maxWs) * 100}%` }} />
                    <i className="a" style={{ width: `${(x.spent / maxWs) * 100}%`, background: x.w.hex, '--d': `${k * 0.06}s` } as PC} />
                    <i className="f" style={{ left: `${(x.forecast / maxWs) * 100}%`, background: varColor(v) }} />
                  </span>
                  <span className="v"><b>{$(x.spent)} / {$(x.budget)}</b><span style={{ color: varColor(v) }}>forecast {$(x.forecast)} ({v >= 0 ? '+' : ''}{v}%)</span></span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          <div id="pg-capex" style={{ scrollMarginTop: 80 }}>
            <Card title="Capex / opex split" sub="Forecast at completion">
              <div className="row" style={{ gap: 22, marginBottom: 10 }}>
                <Stat value={$(t.capex)} label={`Capex · ${Math.round((t.capex / Math.max(1, t.forecast)) * 100)}%`} color={PG_HEX} onClick={() => setRecs({ title: 'Capex by initiative', source: finSrc, rows: [...list].sort((a, b) => b.forecast * b.capexShare - a.forecast * a.capexShare).map((i) => ({ key: i.id, main: <a style={{ cursor: 'pointer' }} onClick={() => { setRecs(null); setOpen(i.id); }}>{i.title}</a>, meta: `${i.id} · ${Math.round(i.capexShare * 100)}% capex`, right: <b>{$(i.forecast * i.capexShare)}</b>, color: PG_HEX })) })} source={finSrc} />
                <Stat value={$(t.opex)} label={`Opex · ${Math.round((t.opex / Math.max(1, t.forecast)) * 100)}%`} color="#2dd4bf" onClick={() => setRecs({ title: 'Opex by initiative', source: finSrc, rows: [...list].sort((a, b) => b.forecast * (1 - b.capexShare) - a.forecast * (1 - a.capexShare)).map((i) => ({ key: i.id, main: <a style={{ cursor: 'pointer' }} onClick={() => { setRecs(null); setOpen(i.id); }}>{i.title}</a>, meta: `${i.id} · ${100 - Math.round(i.capexShare * 100)}% opex`, right: <b>{$(i.forecast * (1 - i.capexShare))}</b>, color: '#2dd4bf' })) })} source={finSrc} />
              </div>
              <div className="pg-pva">
                {ws.map((x) => {
                  const cap = x.xs.reduce((s, i) => s + i.forecast * i.capexShare, 0);
                  return (
                    <div key={x.w.id} className="pg-pvarow" style={{ gridTemplateColumns: '110px minmax(0, 1fr) 90px', cursor: 'default' }}>
                      <span className="nm"><b style={{ fontSize: 11.5 }}>{x.w.short}</b></span>
                      <span className="trk" style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                        <i style={{ flexGrow: cap, background: PG_HEX }} />
                        <i style={{ flexGrow: Math.max(0, x.forecast - cap), background: '#2dd4bf' }} />
                      </span>
                      <span className="v">{Math.round((cap / Math.max(1, x.forecast)) * 100)}% capex</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <div id="pg-cpp" style={{ scrollMarginTop: 80 }}>
            <Card title="Cost per Resilience Index point" sub="Forecast ÷ modelled RI gain · lower is better value">
              <HBars
                color={PG_HEX}
                labelWidth={130}
                items={ws.map((x) => {
                  const pts = x.xs.reduce((s, i) => s + i.riGain, 0);
                  return { key: x.w.id, label: x.w.short, sub: `${pts.toFixed(1)} points`, value: pts ? x.forecast / pts : 0, display: pts ? $(x.forecast / pts) : '—', color: x.w.hex, onClick: () => nav(`/programme/initiatives?ws=${x.w.id}`) };
                }).sort((a, b) => a.value - b.value)}
              />
            </Card>
          </div>
        </div>
      </div>

      <div className="grid g-2-1">
        <div id="pg-var" style={{ scrollMarginTop: 80, minWidth: 0 }}>
          <Card title="Variance callouts" sub="Initiatives forecasting 6% or more away from budget" count={variances.length} flush>
            <table className="tbl">
              <thead><tr><th>Initiative</th><th>Status</th><th className="r">Budget</th><th className="r">Spent</th><th className="r">Forecast</th><th className="r">Variance</th><th>Why</th></tr></thead>
              <tbody>
                {variances.map((i) => {
                  const v = variance(i);
                  return (
                    <tr key={i.id} className="clickable" onClick={() => setOpen(i.id)}>
                      <td><div className="t-main">{i.title}</div><div className="t-sub">{i.id} · {i.owner.name}</div></td>
                      <td><StatusPill s={i.status} /></td>
                      <td className="r">{$(i.budget)}</td>
                      <td className="r">{$(i.spent)}</td>
                      <td className="r">{$(i.forecast)}</td>
                      <td className="r"><b style={{ color: varColor(v) }}>{v >= 0 ? '+' : ''}{v}%</b></td>
                      <td style={{ fontSize: 11.5, color: 'var(--text-secondary)', maxWidth: 260 }}>{v > 0 ? (i.issues[0] ?? i.risks[0]?.title ?? 'Rate card and scope growth') : 'Licence discount and lower integrator effort'}</td>
                    </tr>
                  );
                })}
                {!variances.length && <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>Every initiative is within 6% of budget.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
        <Card title="Value realised" sub="What the spend has bought so far" tinted toneColor="var(--good)">
          <div className="stack" style={{ gap: 12 }}>
            <div className="pg-stat"><b style={{ color: 'var(--good)' }}>{$(realised)}</b><span>Expected annual loss avoided to date</span></div>
            <div className="pg-stat"><b>{list.filter((i) => i.status === 'Complete').length}</b><span>Initiatives closed with benefits statement</span></div>
            <div className="pg-stat"><b>{$(list.reduce((s, i) => s + i.lossReduction, 0))}</b><span>Expected annual loss avoided once every initiative lands</span></div>
            <div className="muted" style={{ fontSize: 11.5 }}>Completed initiatives count in full; in-flight ones count half their progress. Next steering pack: {fmtDateShort(monthDate(Math.ceil(TODAY_M) + 0.1))}.</div>
            <div className="row wrap" style={{ gap: 8 }}>
              <Btn primary color="var(--m-reports)" onClick={() => nav('/reports/value')}>Open Value & Outcomes</Btn>
              <Btn onClick={() => nav('/insurance/quantification')}>Risk quantification</Btn>
            </div>
          </div>
        </Card>
      </div>

      {recsNode}
      {open && <InitiativeDrawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}

