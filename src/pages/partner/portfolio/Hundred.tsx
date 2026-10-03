import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Card, KpiStrip, Badge, Bar, Btn, Callout, StatusBadge, Stacked } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { portfolio, hundredDayPlan, riskCurve, PHASES, MS_COLOR, MS_LABEL, type Milestone, type MsStatus } from '../../../data/modules/portfolio';
import { scoreTone } from '../../../lib/format';
import { CoAvatar, PF_TONE, usePfNav } from './parts';

const MS_HEX: Record<MsStatus, string> = { done: '#22c55e', 'in-progress': '#38bdf8', 'at-risk': '#f0466e', 'not-started': '#8593b4' };

export default function Hundred() {
  const { toast } = useApp();
  const nav = useNavigate();
  const { sp, patch } = usePfNav();
  const cands = useMemo(() => portfolio().filter((c) => c.status === 'integrating'), []);
  const co = cands.find((c) => c.id === sp.get('co')) ?? cands[0];
  const day = co.day ?? 0;
  const base = useMemo(() => hundredDayPlan(co), [co]);
  const [over, setOver] = useState<Record<string, MsStatus>>({});
  const plan: Milestone[] = base.map((m) => (over[m.id] ? { ...m, status: over[m.id] } : m));
  const curve = useMemo(() => riskCurve(co, base), [co, base]);
  const phaseFilter = sp.get('phase');
  const statusFilter = sp.get('status');

  const done = plan.filter((m) => m.status === 'done').length;
  const atRisk = plan.filter((m) => m.status === 'at-risk').length;
  const overdue = plan.filter((m) => m.due < day && m.status !== 'done').length;
  const gained = plan.filter((m) => m.status === 'done').reduce((s, m) => s + m.riGain, 0);
  const curPhase = PHASES.slice().reverse().find((p) => day >= (p.id === 0 ? 0 : p.id - 30 + 1))?.id ?? 0;
  const phaseOf = (m: Milestone) => m.phase;

  const toggle = (m: Milestone) => {
    const next: MsStatus = m.status === 'done' ? (m.due < day ? 'at-risk' : 'in-progress') : 'done';
    setOver((o) => ({ ...o, [m.id]: next }));
    toast(next === 'done' ? `Marked done: ${m.title} (evidence logged for the IC report)` : `Re-opened: ${m.title}`);
  };

  const conn = [
    { name: 'Identity (Entra ID / AD)', ms: plan[4] },
    { name: 'EDR', ms: plan[5] },
    { name: 'SIEM via HexaCore', ms: plan[6] },
    { name: 'HexaInt outside-in', ms: plan[2] },
    { name: 'Vulnerability scanner', ms: plan[7] },
    { name: 'Backup', ms: plan[12] },
  ];

  const shown = plan.filter((m) => (!phaseFilter || String(m.phase) === phaseFilter) && (!statusFilter || m.status === statusFilter));

  return (
    <>
      <div className="row wrap" style={{ gap: 10 }}>
        {cands.map((c) => (
          <button key={c.id} type="button" className={`pf-target ${c.id === co.id ? 'on' : ''}`} style={{ flex: '1 1 300px' }} onClick={() => patch({ co: c.id, phase: null, status: null })}>
            <div className="pf-target-top">
              <CoAvatar co={c} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13 }}>{c.name}</b>
                <span className="muted" style={{ fontSize: 11 }}>{c.sector} · {c.country} · {c.ownership}</span>
              </div>
              <Badge color={PF_TONE}>Day {c.day} of 100</Badge>
            </div>
            <Bar value={c.day ?? 0} max={100} color={PF_TONE} size="thin" />
          </button>
        ))}
      </div>

      <KpiStrip
        toneColor={PF_TONE}
        items={[
          { label: 'Plan day', value: day, unit: '/ 100', bar: day, onClick: () => patch({ phase: String(curPhase), status: null }), source: 'Integration plan (deal close date)' },
          { label: 'Milestones done', value: `${done}/${plan.length}`, bar: (done / plan.length) * 100, onClick: () => patch({ status: 'done', phase: null }), source: 'HexaView 100-day plan' },
          { label: 'At risk', value: atRisk, hint: `${overdue} past due`, delta: atRisk ? { text: 'needs owner action', good: false } : undefined, onClick: () => patch({ status: 'at-risk', phase: null }), source: 'HexaView 100-day plan' },
          { label: 'Resilience Index', value: co.ri, hint: `baseline ${curve.start}`, delta: { text: `+${co.ri - curve.start} since close`, good: true }, onClick: () => patch({ section: 'risk', co: co.id, phase: null, status: null }), source: 'Resilience Index (provisional until day 38 baseline)' },
          { label: 'Target at day 100', value: curve.target, hint: `+${(curve.target - curve.start).toFixed(0)} planned`, bar: curve.target, onClick: () => patch({ phase: '100', status: null }), source: 'Plan: sum of milestone RI gains' },
          { label: 'Open critical items', value: co.openCritical, onClick: () => nav('/partner/portfolio?section=diligence'), source: 'HexaInt · HexaStrike findings carried from due diligence' },
        ]}
      />

      <Card title={`Progress · ${co.name}`} sub={`Acquired ${day} days ago · ${gained.toFixed(1)} RI points banked from completed milestones · click a phase to filter`} toneColor={PF_TONE}>
        <div className="pf-dayline">
          <div className="trk" />
          <div className="fill" style={{ width: `${day}%` }} />
          {PHASES.map((p) => <div key={p.id} className="tick" style={{ left: `${p.id}%` }}><span>{p.label}</span></div>)}
          <div className="now" style={{ left: `${day}%` }}><span>Today · day {day}</span></div>
        </div>
        <div className="pf-phases" style={{ marginTop: 16 }}>
          {PHASES.map((p) => {
            const ms = plan.filter((m) => phaseOf(m) === p.id);
            const d = ms.filter((m) => m.status === 'done').length;
            return (
              <button key={p.id} type="button" className={`pf-phase ${p.id === curPhase ? 'cur' : ''}`} style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => patch({ phase: phaseFilter === String(p.id) ? null : String(p.id), status: null })}>
                <small>{p.label} · {p.sub}</small>
                <b>{d}/{ms.length} done</b>
                <Stacked parts={(['done', 'in-progress', 'at-risk', 'not-started'] as MsStatus[]).map((s) => ({ value: ms.filter((m) => m.status === s).length, color: MS_HEX[s], label: MS_LABEL[s] }))} />
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Risk reduction curve" sub="Planned against actual Resilience Index, and open critical findings, across the first 100 days" toneColor={PF_TONE}>
          <Chart
            height={270}
            option={{
              grid: { left: 40, right: 40, top: 30, bottom: 30 },
              legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 8 },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: curve.days.map((d) => `D${d}`) },
              yAxis: [{ type: 'value', min: Math.floor(curve.start - 6), max: Math.ceil(curve.target + 4), name: 'RI' }, { type: 'value', name: 'Critical', splitLine: { show: false } }],
              series: [
                { name: 'Open critical', type: 'bar', yAxisIndex: 1, data: curve.crit, itemStyle: { color: 'rgba(240,70,110,0.55)', borderRadius: [3, 3, 0, 0] }, barWidth: '45%' },
                { name: 'Planned RI', type: 'line', data: curve.planned, symbol: 'none', lineStyle: { color: '#8593b4', width: 2, type: 'dashed' } },
                { name: 'Actual RI', type: 'line', data: curve.actual, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#fb923c', width: 2.5 }, itemStyle: { color: '#fb923c' }, connectNulls: false },
              ],
            }}
          />
        </Card>
        <Card title="Connected to HexaCore" sub="The integration milestones that make the company visible" toneColor={PF_TONE}>
          <div className="pf-conn">
            {conn.map((c) => (
              <div key={c.name}>
                <b>{c.name}</b>
                <StatusBadge value={c.ms.status === 'done' ? 'live' : c.ms.status === 'not-started' ? 'planned' : c.ms.status === 'at-risk' ? 'blocked' : 'connecting'} map={{ live: 'var(--good)', planned: 'var(--text-muted)', blocked: 'var(--bad)', connecting: 'var(--m-matrix)' }} />
                <small>Due day {c.ms.due} · {c.ms.owner}</small>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Callout color={PF_TONE}>Resilience Index is <b>provisional</b> until identity, EDR and SIEM are all live; the agreed baseline is published at day 38.</Callout>
          </div>
        </Card>
      </div>

      <Card
        title="Integration milestones"
        count={shown.length}
        sub="Tick a milestone when its evidence is in · owners are Northwind and the acquired company's IT lead"
        actions={(phaseFilter || statusFilter) ? <Btn sm onClick={() => patch({ phase: null, status: null })}>Show all</Btn> : undefined}
      >
        {shown.map((m) => (
          <div key={m.id} className="pf-ms">
            <button type="button" className={`pf-chk ${m.status === 'done' ? 'on' : ''}`} onClick={() => toggle(m)} aria-label={m.status === 'done' ? 'Re-open milestone' : 'Mark milestone done'}>{m.status === 'done' && <Check />}</button>
            <span className="num" style={{ fontWeight: 700, color: m.due < day && m.status !== 'done' ? 'var(--bad)' : undefined }}>Day {m.due}</span>
            <span style={{ minWidth: 0 }}>
              <b>{m.title}</b>
              <span className="s">{m.detail}</span>
            </span>
            <span style={{ fontSize: 12 }}>
              {m.owner}
              <button type="button" className="link" style={{ display: 'block', fontSize: 11, background: 'none', border: 0, padding: 0 }} onClick={() => nav(m.path)}>{m.module} →</button>
            </span>
            <span style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
              <Badge color={MS_COLOR[m.status]} dot>{MS_LABEL[m.status]}</Badge>
              {m.riGain > 0 && <span className="muted" style={{ fontSize: 10.5, color: scoreTone(80) }}>+{m.riGain} RI</span>}
            </span>
          </div>
        ))}
        {!shown.length && <div className="empty">No milestones match.</div>}
      </Card>
    </>
  );
}
