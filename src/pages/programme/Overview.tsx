import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KpiStrip, Card, Callout, Sources, Legend } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { useIntro } from '../../lib/useIntro';
import { useRecords, HBars } from '../ops/parts';
import { scopedTenants } from '../../data/customers';
import {
  WORKSTREAMS, STATUS_HEX, RAG_HEX, PG_STATUSES, TODAY_M, PG_MONTHS, isLive, monthLabel, monthDate, monthYear,
  totals, riProjection, upcomingMilestones, overdueMilestones, workstreamHealth, planRisks, maturity, pgLog,
} from '../../data/modules/programme';
import { fmtDateShort, fmtAgo } from '../../lib/format';
import { usePg, PG_TONE, PG_HEX, InitiativeDrawer, StatusPill, type PC } from './parts';

export default function Overview() {
  const nav = useNavigate();
  const { c, tenantId, list, grc, $, version } = usePg();
  const [open, setOpen] = useState<string | null>(null);
  const [, setRecs, recsNode] = useRecords();
  const anim = useIntro(`pg-ov-${c.id}-${tenantId}`, 1800);
  const tenants = scopedTenants(c, tenantId);

  const live = list.filter((i) => isLive(i.status));
  const by = (s: string) => list.filter((i) => i.status === s);
  const t = totals(list);
  const proj = useMemo(() => riProjection(c, tenantId, list), [c, tenantId, list]);
  const due = upcomingMilestones(list, 1);
  const overdue = overdueMilestones(list);
  const ws = useMemo(() => workstreamHealth(list), [list]);
  const risks = useMemo(() => planRisks(list), [list]);
  const mat = useMemo(() => maturity(c, list), [c, list]);
  const matNow = mat.fns.reduce((s, f) => s + f.current, 0) / mat.fns.length;
  const matTarget = mat.fns.reduce((s, f) => s + f.target, 0) / mat.fns.length;
  const log = useMemo(() => pgLog(c), [c, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const spentPct = t.plannedToDate ? Math.round((t.spent / t.plannedToDate) * 100) : 0;
  const varPct = t.budget ? Math.round(((t.forecast - t.budget) / t.budget) * 100) : 0;
  const itsm = c.connectors.find((k) => k.category === 'ITSM');
  const movers = [...list].filter((i) => i.status !== 'Complete').sort((a, b) => b.riGain - a.riGain).slice(0, 7);

  const listRecs = (title: string, rows: typeof list, sub?: string) => setRecs({
    title, sub: sub ?? `${rows.length} initiatives`, source: `Programme register · ${grc}${itsm ? ` · ${itsm.product}` : ''}`,
    rows: rows.map((i) => ({ key: i.id, main: <a style={{ cursor: 'pointer' }} onClick={() => { setRecs(null); setOpen(i.id); }}>{i.title}</a>, meta: `${i.id} · ${i.owner.name} · ${i.pct}% · ends ${fmtDateShort(monthDate(i.end))}`, right: <StatusPill s={i.status} />, color: STATUS_HEX[i.status] })),
  });

  const months = Array.from({ length: PG_MONTHS + 1 }, (_, m) => m);
  const pt = (m: number) => proj.points.find((p) => p.m === m);

  return (
    <div className="pg-stack">
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''}: the security programme behind the posture. {list.length} initiatives across {new Set(list.map((i) => i.ws)).size} workstreams, {monthYear(0)} to {monthYear(PG_MONTHS - 1)}, owned by {c.people.ciso.name}. Progress from {grc}{itsm ? ` and ${itsm.product}` : ''}, spend from the finance cost centre, and every initiative tied to the Resilience Index it is expected to move. <Link to="/ops/admin?section=billing&billing=retainer&service=vciso" style={{ color: 'var(--m-ops)', fontWeight: 600 }}>Book vCISO hours via the retainer →</Link>
      </p>

      <div className="pg-kpi8">
        <KpiStrip
          toneColor={PG_TONE}
          items={[
            { label: 'In flight', value: Math.round(anim(live.length)), unit: `of ${list.length}`, to: '/programme/initiatives?status=live', source: `Programme register · ${grc}` },
            { label: 'On track', value: Math.round(anim(by('On track').length)), toneColor: 'var(--good)', to: '/programme/initiatives?status=On%20track', source: 'Status reported by initiative owners' },
            { label: 'At risk', value: Math.round(anim(by('At risk').length + by('On hold').length)), unit: by('On hold').length ? `${by('On hold').length} on hold` : undefined, toneColor: 'var(--sev-medium)', to: '/programme/initiatives?status=At%20risk', source: 'Status reported by initiative owners' },
            { label: 'Late', value: Math.round(anim(by('Late').length)), unit: `${overdue.length} milestones overdue`, toneColor: 'var(--bad)', to: '/programme/initiatives?status=Late', source: 'Milestone dates vs plan' },
            { label: 'Spent vs plan', value: $(anim(t.spent)), unit: `of ${$(t.plannedToDate)}`, bar: spentPct, delta: { text: `${spentPct}% of plan · forecast ${varPct >= 0 ? '+' : ''}${varPct}%`, good: varPct <= 3 }, to: '/programme/budget', source: 'Finance cost centre actuals (nightly) vs approved plan' },
            { label: 'Milestones due', hint: '30 d', value: Math.round(anim(due.length)), unit: overdue.length ? `+${overdue.length} overdue` : undefined, onClick: () => setRecs({ title: 'Milestones in the next 30 days', sub: `${due.length} due · ${overdue.length} overdue`, source: `Programme plan · ${grc}`, rows: [...overdue.map(({ i, m }) => ({ i, m, late: true })), ...due.map(({ i, m }) => ({ i, m, late: false }))].map(({ i, m, late }) => ({ key: m.id, main: <a style={{ cursor: 'pointer' }} onClick={() => { setRecs(null); setOpen(i.id); }}>{m.title}</a>, meta: `${i.id} · ${i.title} · ${i.owner.name}`, right: <b style={{ color: late ? 'var(--bad)' : undefined }}>{late ? 'Overdue' : fmtDateShort(monthDate(m.m))}</b>, color: late ? '#f8646f' : PG_HEX })) }), source: 'Programme plan milestones' },
            { label: 'Maturity', hint: 'CSF 2.0', value: <>{anim(matNow).toFixed(1)}<small style={{ fontSize: 14, color: 'var(--text-muted)' }}> → {matTarget.toFixed(1)}</small></>, unit: 'tier', bar: (matNow / 4) * 100, to: '/programme/maturity', source: 'NIST CSF 2.0 self-assessment, evidence-weighted from HexaComply' },
            { label: 'Projected RI', value: <>{Math.round(anim(proj.today))}<small style={{ fontSize: 14, color: 'var(--good)' }}> → {proj.target}</small></>, unit: `range ${proj.lo}–${proj.hi}`, delta: { text: `+${proj.target - proj.today} by ${monthYear(PG_MONTHS)}`, good: true }, onClick: () => listRecs('Where the RI gain comes from', [...list].filter((i) => i.status !== 'Complete').sort((a, b) => b.riGain - a.riGain), 'Expected Resilience Index points per initiative still to deliver'), source: 'Resilience Index ri-v1.2 · gains modelled per initiative' },
          ]}
        />
      </div>

      <div className="grid g-3-2">
        <Card title="Projected Resilience Index" sub="Last 9 months actual, then the plan to programme end with a confidence band" actions={<Sources items={[{ name: 'HexaView RI' }, { name: grc }, ...(itsm ? [{ name: itsm.product, status: itsm.status }] : [])]} />}>
          <div className="pg-ri-head">
            <button type="button" className="pg-stat link" onClick={() => nav('/board')} title="Source: Resilience Index ri-v1.2 · open the Board view"><b>{proj.today}</b><span>Today</span></button>
            <span className="arrow">→</span>
            <div className="pg-stat"><b style={{ color: 'var(--good)' }}>{proj.target}</b><span>Planned at {monthYear(PG_MONTHS)}</span></div>
            <div className="pg-stat"><b style={{ color: 'var(--text-secondary)' }}>{proj.lo}–{proj.hi}</b><span>Confidence range</span></div>
            <button type="button" className="pg-stat link" onClick={() => listRecs('Initiatives at risk or late', list.filter((i) => i.status === 'At risk' || i.status === 'Late' || i.status === 'On hold'), 'These widen the band: slippage pushes RI gains later')}><b style={{ color: 'var(--sev-medium)' }}>{list.filter((i) => i.status === 'At risk' || i.status === 'Late' || i.status === 'On hold').reduce((s, i) => s + i.riGain, 0).toFixed(1)}</b><span>RI points at risk</span></button>
          </div>
          <Chart
            height={240}
            option={{
              grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '—' : String(v)) },
              xAxis: { type: 'category', data: months.map((m) => monthLabel(m, true)), boundaryGap: false, axisLabel: { interval: 2 } },
              yAxis: { type: 'value', min: Math.max(0, Math.floor((Math.min(...proj.points.map((p) => p.lo ?? p.hist ?? 100)) - 4) / 5) * 5), max: Math.min(100, Math.ceil((proj.hi + 3) / 5) * 5) },
              series: [
                { name: 'Low', type: 'line', stack: 'band', data: months.map((m) => pt(m)?.lo ?? null), lineStyle: { opacity: 0 }, symbol: 'none', tooltip: { show: false } },
                { name: 'Range', type: 'line', stack: 'band', data: months.map((m) => { const p = pt(m); return p?.lo != null && p.hi != null ? Math.round((p.hi - p.lo) * 10) / 10 : null; }), lineStyle: { opacity: 0 }, symbol: 'none', areaStyle: { color: PG_HEX, opacity: 0.16 }, tooltip: { show: false } },
                { name: 'Actual', type: 'line', data: months.map((m) => pt(m)?.hist ?? null), color: '#2dd4bf', symbolSize: 5, lineStyle: { width: 2.4 }, animationDuration: 1400,
                  markLine: { symbol: 'none', silent: true, lineStyle: { color: '#ef6aae', type: 'solid', width: 1.4 }, label: { formatter: 'Today', color: '#ef6aae', fontSize: 10.5, position: 'insideEndTop' }, data: [{ xAxis: monthLabel(Math.floor(TODAY_M), true) }] } },
                { name: 'Plan', type: 'line', data: months.map((m) => pt(m)?.plan ?? null), color: PG_HEX, symbol: 'none', lineStyle: { width: 2.4, type: 'dashed' }, animationDelay: 600, animationDuration: 1600,
                  markPoint: { symbol: 'circle', symbolSize: 9, itemStyle: { color: PG_HEX }, label: { show: false }, data: [{ name: 'Planned end', coord: [monthLabel(PG_MONTHS, true), proj.target] }] } },
              ],
            }}
          />
          <Legend items={[{ label: 'Actual RI', color: '#2dd4bf' }, { label: 'Planned trajectory', color: PG_HEX }, { label: 'Confidence band', color: 'color-mix(in srgb, #818cf8 30%, transparent)' }, { label: 'Today', color: '#ef6aae' }]} />
        </Card>

        <Card title="Programme health by workstream" sub="RAG from status and forecast variance · click to open" count={WORKSTREAMS.length}>
          <div className="pg-wsgrid">
            {ws.map((x, k) => (
              <button key={x.w.id} type="button" className={`pg-wscard pg-rise ${x.xs.length ? '' : 'empty'}`} style={{ '--pc': x.w.hex, '--rc': RAG_HEX[x.rag], '--d': `${k * 0.05}s` } as PC & { '--rc': string }} onClick={() => x.xs.length && nav(`/programme/initiatives?ws=${x.w.id}`)} title={`Source: programme register · ${x.xs.length} initiatives`} disabled={!x.xs.length}>
                <span className="top"><b>{x.w.label}</b><i className="rag" /></span>
                <span className="segs">{x.xs.length ? PG_STATUSES.filter((s) => x.counts[s]).map((s) => <i key={s} style={{ flexGrow: x.counts[s], background: STATUS_HEX[s] }} title={`${s}: ${x.counts[s]}`} />) : <i style={{ flexGrow: 1, background: 'var(--track)' }} />}</span>
                <span className="meta"><span>{x.xs.length ? `${x.xs.length} initiatives · ${x.pct}%` : 'Not in scope'}</span><span>{x.xs.length ? `${$(x.spent)} / ${$(x.budget)}` : ''}</span></span>
                {x.xs.length > 0 && <span className="meta"><span>{x.counts.Late ? <b style={{ color: 'var(--bad)' }}>{x.counts.Late} late</b> : x.counts['At risk'] ? <b style={{ color: 'var(--sev-medium)' }}>{x.counts['At risk']} at risk</b> : 'No slippage'}</span><span style={{ color: 'var(--good)' }}>+{x.riGain.toFixed(1)} RI</span></span>}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Top risks to the plan" sub="From initiative risk logs · highest first" count={risks.length}>
          <div className="pg-rows">
            {risks.slice(0, 7).map((r) => (
              <button key={r.id} type="button" className="pg-row" style={{ '--pc': r.level === 'High' ? '#f8646f' : r.level === 'Medium' ? '#f0a338' : '#8593b4' } as PC} onClick={() => setOpen(r.ini.id)}>
                <i />
                <span className="m"><b>{r.title}</b><span>{r.ini.id} · {r.ini.title}{r.raised ? ' · raised this session' : ''}</span></span>
                <span className="r">{r.level}</span>
              </button>
            ))}
            {!risks.length && <Callout kind="good">No open risks logged against the plan.</Callout>}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Mirrored to the {grc} risk register · <a style={{ cursor: 'pointer', color: PG_TONE }} onClick={() => nav('/comply/caas?section=risks')}>open register</a></div>
        </Card>

        <Card title="Next milestones" sub="Next 60 days, plus anything overdue" count={overdue.length + upcomingMilestones(list, 2).length}>
          <div className="pg-rows">
            {[...overdue.map((x) => ({ ...x, late: true })), ...upcomingMilestones(list, 2).map((x) => ({ ...x, late: false }))].slice(0, 8).map(({ i, m, late }) => (
              <button key={m.id} type="button" className="pg-row" style={{ '--pc': late ? '#f8646f' : m.gate ? PG_HEX : '#2dd4bf' } as PC} onClick={() => setOpen(i.id)}>
                <i className="dia" />
                <span className="m"><b>{m.title}</b><span>{i.id} · {i.title} · {i.owner.name}</span></span>
                <span className="r" style={late ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>{late ? 'Overdue' : fmtDateShort(monthDate(m.m))}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Biggest Resilience Index movers" sub="Expected RI points still to deliver · click for detail">
          <HBars
            color={PG_HEX}
            labelWidth={170}
            items={movers.map((i) => ({ key: i.id, label: i.title, sub: `${i.id} · ${i.status} · ${$(i.lossReduction)} loss reduction`, value: i.riGain, display: `+${i.riGain.toFixed(1)}`, color: STATUS_HEX[i.status], onClick: () => setOpen(i.id) }))}
          />
        </Card>
      </div>

      {log.length > 0 && (
        <Card title="Updates this session" sub="Status changes, milestones, risks and change requests made in HexaView" count={log.length}>
          <div className="pg-rows">
            {log.slice(0, 8).map((l, k) => (
              <button key={k} type="button" className="pg-row" style={{ '--pc': l.color } as PC} onClick={() => setOpen(l.id)}>
                <i />
                <span className="m"><b>{l.text}</b></span>
                <span className="r">{fmtAgo((Date.now() - l.at) / 60000)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {recsNode}
      {open && <InitiativeDrawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}
