import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, KpiStrip, Badge, BarRow, Legend } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { CAP_LIST, REG_COLOR, REG_LABEL, STAGES, STAGE_PROB, bookingsHistory, deals, type Deal, type DealStage } from '../../data/modules/partner';
import { monthLabels } from '../../lib/format';
import { CapPills, PT_TONE, money } from '../partner/parts';

const OPEN_STAGES: DealStage[] = ['Discovery', 'Qualifying', 'Proposal', 'Negotiation'];
const STAGE_HEX: Record<DealStage, string> = { Discovery: '#8a9bc0', Qualifying: '#68b1ff', Proposal: '#a07cfb', Negotiation: '#fb923c', 'Closed won': '#2dd4bf', 'Closed lost': '#f8646f' };

export default function PartnerPipeline() {
  const nav = useNavigate();
  const ds = useMemo(() => deals(), []);
  const hist = useMemo(() => bookingsHistory(), []);
  const [drill, setDrill] = useState<{ title: string; rows: Deal[] } | null>(null);
  const open = ds.filter((d) => OPEN_STAGES.includes(d.stage));
  const value = open.reduce((s, d) => s + d.valueUsd, 0);
  const weighted = open.reduce((s, d) => s + (d.valueUsd * STAGE_PROB[d.stage]) / 100, 0);
  const wonHist = hist.reduce((s, h) => s + h.won, 0);
  const lostHist = hist.reduce((s, h) => s + h.lost, 0);
  const winRate = Math.round((wonHist / (wonHist + lostHist)) * 100);
  const won = ds.filter((d) => d.stage === 'Closed won');
  const maxStage = Math.max(...OPEN_STAGES.map((s) => open.filter((d) => d.stage === s).reduce((a, d) => a + d.valueUsd, 0)));

  const bySector = useMemo(() => {
    const m = new Map<string, { won: number; total: number; value: number }>();
    const r = [...ds];
    for (const d of r) {
      const e = m.get(d.sector) ?? { won: 0, total: 0, value: 0 };
      e.total++;
      e.value += d.valueUsd;
      if (d.stage === 'Closed won' || d.stage === 'Negotiation') e.won++;
      m.set(d.sector, e);
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8);
  }, [ds]);

  const owners = useMemo(() => {
    const m = new Map<string, { open: number; weighted: number; won: number }>();
    for (const d of ds) {
      const e = m.get(d.owner) ?? { open: 0, weighted: 0, won: 0 };
      if (OPEN_STAGES.includes(d.stage)) { e.open += d.valueUsd; e.weighted += (d.valueUsd * STAGE_PROB[d.stage]) / 100; }
      if (d.stage === 'Closed won') e.won += d.valueUsd;
      m.set(d.owner, e);
    }
    return [...m.entries()].sort((a, b) => b[1].weighted - a[1].weighted);
  }, [ds]);

  const quarters = ['Q4 2026', 'Q1 2027', 'Q2 2027'];

  return (
    <>
      <p className="page-intro">
        Your HexaView pipeline from registration to close: every deal here is registered with HexaShield, so stage, value and protection stay in step with the deal desk. Weighted by stage probability ({OPEN_STAGES.map((s) => `${s} ${STAGE_PROB[s]}%`).join(', ')}).
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Open pipeline', value: money(value), hint: `${open.length} deals`, onClick: () => setDrill({ title: 'Open pipeline', rows: open }), source: 'HexaShield deal registration' },
          { label: 'Weighted forecast', value: money(weighted), onClick: () => setDrill({ title: 'Weighted forecast', rows: open }), source: 'Deal registration × stage probability' },
          { label: 'Win rate (12 mo)', value: `${winRate}%`, delta: { text: '+6 pts YoY', good: true }, onClick: () => setDrill({ title: 'Closed deals', rows: ds.filter((d) => d.stage.startsWith('Closed')) }), source: 'Closed registrations, last 12 months' },
          { label: 'Won this quarter', value: money(won.reduce((s, d) => s + d.valueUsd, 0)), hint: `${won.length} deals`, onClick: () => setDrill({ title: 'Closed won', rows: won }), source: 'HexaShield deal registration' },
          { label: 'Average deal', value: money(value / Math.max(1, open.length)), source: 'Open registrations' },
          { label: 'Median cycle', value: 74, unit: 'days', delta: { text: '−9 d', good: true }, source: 'Registration to close, last 12 months' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Pipeline by stage" sub="Value and count per stage · click a stage to see its deals" toneColor={PT_TONE}>
          <div className="pt-funnel">
            {OPEN_STAGES.map((s) => {
              const rows = open.filter((d) => d.stage === s);
              const v = rows.reduce((a, d) => a + d.valueUsd, 0);
              return (
                <button key={s} onClick={() => setDrill({ title: s, rows })} title="Source: HexaShield deal registration · click to open">
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s}</span>
                  <div className="pt-fbar" style={{ width: `${Math.max(8, (v / maxStage) * 100)}%`, background: STAGE_HEX[s] }}>{rows.length}</div>
                  <span className="num" style={{ textAlign: 'right', fontSize: 12.5 }}><b>{money(v)}</b> <span className="muted">· {STAGE_PROB[s]}%</span></span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${OPEN_STAGES.length}, 1fr)`, gap: 10, marginTop: 18 }}>
            {OPEN_STAGES.map((s) => (
              <div key={s} style={{ background: 'var(--surface-sunken)', borderRadius: 10, padding: 8, minHeight: 120, border: '1px solid var(--hairline)' }}>
                <div className="section-label" style={{ margin: '0 0 6px', color: STAGE_HEX[s] }}>{s}</div>
                <div className="stack" style={{ gap: 6 }}>
                  {open.filter((d) => d.stage === s).map((d) => (
                    <button key={d.id} onClick={() => nav(`/partner-sales/deals?deal=${d.id}&reg=all`)} style={{ textAlign: 'left', border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 8, padding: '7px 8px', color: 'inherit', font: 'inherit', cursor: 'pointer', borderLeft: `3px solid ${STAGE_HEX[s]}` }}>
                      <b style={{ fontSize: 11.5, display: 'block', lineHeight: 1.3 }}>{d.endClient}</b>
                      <div className="row" style={{ gap: 4, marginTop: 4, fontSize: 10.5 }}>
                        <span className="num" style={{ fontWeight: 700 }}>{money(d.valueUsd)}</span>
                        <span className="spacer" />
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: REG_COLOR[d.reg] }} title={REG_LABEL[d.reg]} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Forecast by quarter" sub="Commit (Negotiation) vs. best case (Proposal) vs. upside" toneColor={PT_TONE}>
          <Chart
            height={220}
            option={{
              grid: { left: 46, right: 8, top: 26, bottom: 22 },
              legend: { top: 0, itemWidth: 10, itemHeight: 8 },
              tooltip: { trigger: 'axis', valueFormatter: (v) => money(Number(v)) },
              xAxis: { type: 'category', data: quarters },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => money(v) } },
              series: [
                { name: 'Commit', type: 'bar', stack: 'f', data: quarters.map((q) => open.filter((d) => d.closeQuarter === q && d.stage === 'Negotiation').reduce((s, d) => s + d.valueUsd, 0)), itemStyle: { color: '#fb923c' } },
                { name: 'Best case', type: 'bar', stack: 'f', data: quarters.map((q) => open.filter((d) => d.closeQuarter === q && d.stage === 'Proposal').reduce((s, d) => s + d.valueUsd, 0)), itemStyle: { color: '#a07cfb' } },
                { name: 'Upside', type: 'bar', stack: 'f', data: quarters.map((q) => open.filter((d) => d.closeQuarter === q && (d.stage === 'Discovery' || d.stage === 'Qualifying')).reduce((s, d) => s + d.valueUsd, 0)), itemStyle: { color: '#8a9bc0', borderRadius: [3, 3, 0, 0] } },
              ],
            }}
          />
          <div className="section-label">Pipeline by capability</div>
          {CAP_LIST.map((cap) => {
            const v = open.filter((d) => d.modules.includes(cap.id)).reduce((s, d) => s + d.valueUsd / d.modules.length, 0);
            return <BarRow key={cap.id} label={cap.product} value={v} max={value / 2} color={cap.tone} display={money(v)} />;
          })}
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="Bookings, 12 months" sub="Won and lost first-year value, with new pipeline created" toneColor={PT_TONE}>
          <Chart
            height={240}
            option={{
              grid: { left: 50, right: 8, top: 26, bottom: 22 },
              legend: { top: 0, itemWidth: 10, itemHeight: 8 },
              tooltip: { trigger: 'axis', valueFormatter: (v) => money(Number(v)) },
              xAxis: { type: 'category', data: monthLabels(12) },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => money(v) } },
              series: [
                { name: 'Won', type: 'bar', data: hist.map((h) => h.won), itemStyle: { color: '#2dd4bf', borderRadius: [3, 3, 0, 0] } },
                { name: 'Lost', type: 'bar', data: hist.map((h) => -h.lost), itemStyle: { color: '#f8646f', borderRadius: [0, 0, 3, 3] } },
                { name: 'Pipeline created', type: 'line', data: hist.map((h) => h.created), symbol: 'none', smooth: true, lineStyle: { color: '#fb923c', width: 2 } },
              ],
            }}
          />
        </Card>
        <Card title="Win rate and value by sector" sub="Share of registrations at Negotiation or won">
          {bySector.map(([s, e]) => (
            <BarRow key={s} label={s} sub={`${e.total} deals · ${money(e.value)}`} value={Math.round((e.won / e.total) * 100)} color={PT_TONE} display={`${Math.round((e.won / e.total) * 100)}%`} />
          ))}
        </Card>
      </div>

      <Card title="By owner" sub="Open, weighted and won value per seller" flush>
        <table className="tbl">
          <thead><tr><th>Owner</th><th className="r">Open</th><th className="r">Weighted</th><th className="r">Won (12 mo)</th><th style={{ width: '35%' }}>Weighted share</th></tr></thead>
          <tbody>
            {owners.map(([o, e]) => (
              <tr key={o} className="clickable" onClick={() => setDrill({ title: `${o}'s deals`, rows: ds.filter((d) => d.owner === o) })}>
                <td className="t-main">{o}</td>
                <td className="r num">{money(e.open)}</td>
                <td className="r num">{money(e.weighted)}</td>
                <td className="r num">{money(e.won)}</td>
                <td><div className="bar thin" style={{ '--tone': 'var(--m-partner)' } as CSSProperties}><i style={{ width: `${(e.weighted / weighted) * 100}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {drill && (
        <Drawer title={drill.title} sub={`${drill.rows.length} deals · ${money(drill.rows.reduce((s, d) => s + d.valueUsd, 0))} · source: HexaShield deal registration`} onClose={() => setDrill(null)}>
          <div className="list">
            {drill.rows.map((d) => (
              <button key={d.id} className="list-row" onClick={() => nav(`/partner-sales/deals?deal=${d.id}&reg=all`)}>
                <span className="list-main">
                  <b>{d.opportunity}</b>
                  <span>{d.id} · {d.stage} · {d.owner} · close {d.closeQuarter}</span>
                  <span style={{ marginTop: 4 }}><CapPills caps={d.modules} /></span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <b className="num">{money(d.valueUsd)}</b>
                  <Badge color={REG_COLOR[d.reg]}>{REG_LABEL[d.reg]}</Badge>
                </span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><Legend items={STAGES.map((s) => ({ label: s, color: STAGE_HEX[s] }))} /></div>
        </Drawer>
      )}
    </>
  );
}
