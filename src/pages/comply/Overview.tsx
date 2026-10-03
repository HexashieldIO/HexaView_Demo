import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ShieldCheck } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedConnectors, tenantName } from '../../data/customers';
import { MODULE_BY_ID } from '../../modules/registry';
import {
  domainCoverage, TASK_STATES, TASK_SEVS, TASK_STATE_COLOR, TASK_SEV_HEX, taskState, CONTROL_STATUS_COLOR, EVIDENCE_STATES, riskLevel, RISK_LEVEL_COLOR,
  type ControlStatus, type RiskLevel,
} from '../../data/modules/comply';
import { Card, Badge, Tabs, Sources, cap } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { fmtMoney, fmtNum } from '../../lib/format';
import { MetricBand, SegRing, SegBar, HeatGrid, ShiftRow, CapRow, StateKey } from './parts';
import { useComplyData, useRiskData, useContinuityData, EV_HEX, EV_CLASSES } from './useComply';

const tone = MODULE_BY_ID.comply.tone;
const STATUSES: ControlStatus[] = ['Compliant', 'In progress', 'Not started', 'Not applicable'];
const LEVELS: RiskLevel[] = ['High', 'Medium', 'Low'];

export default function ComplyOverview() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const h = headlines(c, tenantId);
  const { fws, controls, tasks, evidence, groups, pipeline } = useComplyData();
  const risks = useRiskData();
  const { bia, attention } = useContinuityData();
  const [heatMode, setHeatMode] = useState<'inherent' | 'residual'>('residual');
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const grcName = grc ? `${grc.vendor} ${grc.product}` : 'HexaComply';
  const evFeeds = scopedConnectors(c, tenantId).filter((k) => ['SIEM', 'EDR / XDR', 'Identity', 'Backup', 'Vulnerability', 'PAM', 'OT', 'Cloud posture'].includes(k.category));

  const inScope = controls.filter((x) => x.status !== 'Not applicable');
  const compliant = controls.filter((x) => x.status === 'Compliant').length;
  const covered = groups.filter((g) => g.covered).length;
  const tasksDone = tasks.filter((t) => taskState(t.status) === 'Compliant').length;
  const approved = evidence.filter((e) => e.state === 'approved').length;
  const matrix = useMemo(() => {
    const m = Object.fromEntries(TASK_STATES.map((s) => [s, Object.fromEntries(TASK_SEVS.map((v) => [v, 0]))])) as Record<string, Record<string, number>>;
    tasks.forEach((t) => { m[taskState(t.status)][t.sev]++; });
    return m;
  }, [tasks]);
  const domains = useMemo(() => domainCoverage(controls), [controls]);

  // Risk posture: the same risks scored both ways.
  const scored = risks.filter((r) => r.residual);
  const levelCount = (lv: RiskLevel, mode: 'inherent' | 'residual') => scored.filter((r) => (mode === 'inherent' ? r.level : r.residualLevel) === lv).length;
  const inhTotal = scored.reduce((s, r) => s + r.inherentScore, 0);
  const resTotal = scored.reduce((s, r) => s + (r.residualScore ?? 0), 0);
  const cutPct = inhTotal ? Math.round(((resTotal - inhTotal) / inhTotal) * 100) : 0;
  const topResidual = scored.slice().sort((a, b) => (b.residualScore ?? 0) - (a.residualScore ?? 0)).slice(0, 3);
  const stillHigh = scored.filter((r) => r.residualLevel === 'High').length;
  const pastDue = risks.filter((r) => r.dueDays !== null && r.dueDays < 0).length;
  const exclusions = [
    ...controls.filter((x) => x.status === 'Not applicable').map((x) => ({ id: x.id, title: `${x.ref} — ${x.name}`, meta: `${x.fwShort} · ${x.justification}`, kind: 'Control', by: x.decidedBy, overdue: x.reviewOverdue, to: `/comply/caas?view=controls&scope=na&framework=${x.fwId}&id=${encodeURIComponent(x.id)}` })),
    ...tasks.filter((t) => t.status === 'Not applicable').slice(0, 12).map((t) => ({ id: t.id, title: `${t.ref} — ${t.title}`, meta: `${t.fwShort} · marked not applicable with its control`, kind: 'Task', by: t.decidedBy, overdue: false, to: `/comply/caas?view=tasks&state=Not%20applicable&id=${t.id}` })),
  ];
  const nextAudits = fws.filter((f) => f.auditInDays !== undefined).sort((a, b) => (a.auditInDays ?? 0) - (b.auditInDays ?? 0));
  const evMoving = pipeline.states.filter((s) => ['draft', 'submitted', 'processing'].includes(s.key)).reduce((n, s) => n + s.count, 0);
  const evWaiting = pipeline.states.find((s) => s.key === 'more_info')?.count ?? 0;
  const evBad = pipeline.states.filter((s) => ['rejected', 'expired', 'failed'].includes(s.key)).reduce((n, s) => n + s.count, 0);
  const evExpiring = evidence.filter((e) => e.state === 'approved' && e.expiresDays <= 30).length;
  const biaOverdue = bia.filter((b) => b.nextReviewDays < 0).length;
  const src = `${grcName} · ${evFeeds.slice(0, 3).map((k) => k.product).join(', ')}`;

  return (
    <>
      <div className="row between wrap" style={{ gap: 10 }}>
        <p className="page-intro" style={{ flex: 1, minWidth: 280, margin: 0 }}>
          <b>{c.name}</b> · {tenantName(c, tenantId)}: compliance, risk and continuity posture across {fws.length} frameworks, run in {grcName} with evidence collected from {evFeeds.slice(0, 4).map((k) => k.product).join(', ')}. Every block opens its register, pre-filtered.
        </p>
        <Badge color={tone} dot>Compliance authority: HexaShield</Badge>
      </div>

      <MetricBand
        tone={tone}
        items={[
          { ac: 'Frameworks', word: 'Applied', value: fws.length, unit: 'in scope', to: '/comply/caas?view=frameworks', source: grcName },
          { ac: 'Requirements', word: 'Covered', value: covered, unit: `of ${groups.length}`, gauge: (covered / Math.max(1, groups.length)) * 100, to: '/comply/caas?view=requirements&covered=1', source: grcName },
          { ac: 'Controls', word: 'Compliant', value: fmtNum(compliant), unit: `of ${fmtNum(inScope.length)} in scope`, gauge: (compliant / Math.max(1, inScope.length)) * 100, to: '/comply/caas?view=controls&status=Compliant', source: grcName },
          { ac: 'Tasks', word: 'Complete', value: fmtNum(tasksDone), unit: `of ${fmtNum(tasks.length)}`, gauge: (tasksDone / Math.max(1, tasks.length)) * 100, to: '/comply/caas?view=tasks&state=Compliant', source: grcName },
          { ac: 'Overdue', word: 'Tasks', value: h.comply.overdueTasks, unit: 'past due', color: 'var(--bad)', to: '/comply/caas?view=tasks&overdue=1', source: grcName },
          { ac: 'Evidence', word: 'Approved', value: fmtNum(approved), unit: `of ${fmtNum(evidence.length)}`, gauge: (approved / Math.max(1, evidence.length)) * 100, to: '/comply/caas?view=evidence&state=approved', source: src },
          { ac: 'Risks', word: 'High residual', value: stillHigh, unit: `of ${risks.length}`, color: stillHigh ? 'var(--sev-critical)' : undefined, to: '/comply/risks?residual=High', source: `${grcName} risk register` },
        ]}
      />

      <section className="comply-rings">
        {fws.map((f) => {
          const pct = Math.round((f.compliant / Math.max(1, f.fw.inScope)) * 100);
          const counts: Record<ControlStatus, number> = { Compliant: f.compliant, 'In progress': f.inProgress, 'Not started': f.notStarted, 'Not applicable': f.outOfScope };
          return (
            <button key={f.fw.id} type="button" className="comply-ringcard" onClick={() => nav(`/comply/caas?framework=${f.fw.id}`)} title={`Source: ${grcName} · open ${f.fw.short} controls`}>
              <div className="comply-ringcard-head">
                <b>{f.fw.name}</b>
                <Badge color={f.auditInDays !== undefined && f.auditInDays < 60 ? 'var(--sev-medium)' : 'var(--text-muted)'}>
                  {f.auditInDays !== undefined ? <><CalendarClock size={11} /> audit {f.auditInDays} d</> : f.fw.kind}
                </Badge>
              </div>
              <div className="comply-ringcard-body">
                <SegRing parts={STATUSES.map((s) => ({ label: s, value: counts[s], color: CONTROL_STATUS_COLOR[s] }))} center={`${pct}%`} sub={`${f.compliant}/${f.fw.inScope}`} />
                <dl className="comply-facts">
                  {STATUSES.map((s) => (
                    <div key={s} className="click" onClick={(e) => { e.stopPropagation(); nav(`/comply/caas?view=controls&framework=${f.fw.id}&status=${encodeURIComponent(s)}`); }}>
                      <dt><i style={{ background: CONTROL_STATUS_COLOR[s] }} />{s === 'Not applicable' ? 'Out of scope' : s}</dt>
                      <dd>{counts[s]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </button>
          );
        })}
      </section>

      <div className="grid comply-split">
        <Card title="Coverage by control domain" sub="Compliant share of in-scope controls · dashed line is the target · click a domain">
          <div className="grid g2" style={{ gap: 12, alignItems: 'center' }}>
            <Chart
              height={300}
              option={{
                tooltip: {},
                radar: { indicator: domains.map((d) => ({ name: d.label, max: 100 })), radius: '50%', center: ['50%', '52%'], axisName: { color: '#8a97b2', fontSize: 10.5 }, splitLine: { lineStyle: { color: 'rgba(138,151,178,.18)' } }, splitArea: { show: false }, axisLine: { lineStyle: { color: 'rgba(138,151,178,.18)' } } },
                series: [{ type: 'radar', symbolSize: 5, data: [
                  { name: 'Coverage', value: domains.map((d) => d.pct), areaStyle: { color: 'rgba(132,204,22,.22)' }, lineStyle: { color: '#84cc16', width: 2 }, itemStyle: { color: '#84cc16' } },
                  { name: 'Target', value: domains.map((d) => d.target), lineStyle: { color: '#8a97b2', type: 'dashed', width: 1 }, itemStyle: { color: '#8a97b2' }, symbol: 'none' },
                ] }],
              }}
            />
            <div className="comply-domains">
              {domains.slice().sort((a, b) => a.pct - a.target - (b.pct - b.target)).map((d) => (
                <button key={d.id} type="button" className="comply-dom" onClick={() => nav(`/comply/caas?view=controls&domain=${d.id}`)} title={`${d.n} in-scope controls · source ${grcName}`}>
                  <span>{d.label}</span>
                  <span className="comply-dom-track">
                    <span className="comply-dom-fill" style={{ width: `${d.pct}%`, background: d.pct >= d.target ? 'var(--good)' : d.pct >= d.target - 15 ? 'var(--sev-medium)' : 'var(--sev-high)' }} />
                    <span className="comply-dom-tgt" style={{ left: `${d.target}%` }} />
                  </span>
                  <span className="comply-dom-val"><b>{d.pct}%</b> / {d.target}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Tasks by state" count={fmtNum(tasks.length)} actions={<button className="link" onClick={() => nav('/comply/caas?view=tasks')}>View all tasks →</button>}>
          <div className="comply-tsb">
            <div className="comply-tsb-head"><span>State</span><span>By severity</span><span>Tasks</span></div>
            {TASK_STATES.map((st) => {
              const row = matrix[st];
              const total = TASK_SEVS.reduce((s, v) => s + row[v], 0);
              return (
                <button key={st} type="button" className="comply-tsb-row" onClick={() => nav(`/comply/caas?view=tasks&state=${encodeURIComponent(st)}`)}>
                  <span className="comply-tsb-state"><i style={{ background: TASK_STATE_COLOR[st] }} />{st}</span>
                  <SegBar parts={TASK_SEVS.map((v) => ({ key: v, value: row[v], color: TASK_SEV_HEX[v], label: cap(v) }))} onPick={(v) => nav(`/comply/caas?view=tasks&state=${encodeURIComponent(st)}&sev=${v}`)} />
                  <span className="comply-tsb-total">{total}</span>
                </button>
              );
            })}
          </div>
          <div className="comply-keys">
            {TASK_SEVS.map((v) => <StateKey key={v} color={TASK_SEV_HEX[v]} label={cap(v)} n={tasks.filter((t) => t.sev === v).length} onClick={() => nav(`/comply/caas?view=tasks&sev=${v}`)} />)}
            <span className="comply-key-sep" />
            <StateKey color="var(--bad)" label="Overdue" n={h.comply.overdueTasks} onClick={() => nav('/comply/caas?view=tasks&overdue=1')} />
          </div>
        </Card>
      </div>

      <Card title="Evidence pipeline" sub={`${fmtNum(evidence.length)} items · ${Math.round((approved / Math.max(1, evidence.length)) * 100)}% approved · ${pipeline.autoPct}% collected automatically`} actions={<Sources items={evFeeds.slice(0, 5).map((k) => ({ name: k.product, status: k.status }))} />}>
        <div className="comply-pipeline">
          {EV_CLASSES.map((cls) => {
            const states = pipeline.states.filter((s) => cls.includes(s.key));
            const n = states.reduce((a, s) => a + s.count, 0);
            return (
              <div key={cls.join()} className="comply-pipeline-class" style={{ flexGrow: Math.max(n, evidence.length * 0.04) }}>
                <SegBar height={30} labels={states.length === 1 || cls.includes('approved')} parts={states.map((s) => ({ key: s.key, value: s.count, color: EV_HEX[s.key], label: s.label }))} onPick={(k) => nav(`/comply/caas?view=evidence&state=${k}`)} />
              </div>
            );
          })}
        </div>
        <div className="comply-keys" style={{ borderTop: 0, paddingTop: 0 }}>
          {EV_CLASSES.map((cls, i) => (
            <span key={cls.join()} className="row" style={{ gap: 14 }}>
              {i > 0 && <span className="comply-key-sep" />}
              {cls.map((k) => {
                const s = EVIDENCE_STATES.find((x) => x.key === k)!;
                return <StateKey key={k} color={EV_HEX[k]} label={s.label} n={fmtNum(pipeline.states.find((x) => x.key === k)?.count ?? 0)} onClick={() => nav(`/comply/caas?view=evidence&state=${k}`)} />;
              })}
            </span>
          ))}
        </div>
        <div className="comply-meta">
          <button type="button" onClick={() => nav('/comply/caas?view=evidence&state=moving')}><strong>{fmtNum(evMoving)}</strong>still moving</button>
          <button type="button" onClick={() => nav('/comply/caas?view=evidence&state=more_info')}><strong className="bad">{fmtNum(evWaiting)}</strong>waiting on you</button>
          <button type="button" onClick={() => nav('/comply/caas?view=evidence&state=failing')}><strong className="bad">{fmtNum(evBad)}</strong>rejected, expired or failed</button>
          <button type="button" className="link" onClick={() => nav('/comply/caas?view=evidence&expiring=30')}>{fmtNum(evExpiring)} approaching expiry (30 d) →</button>
        </div>
      </Card>

      <div className="grid comply-split">
        <Card title="Risk posture — inherent vs residual" sub={`${scored.length} of ${risks.length} risks carry residual scoring`}>
          <div className="comply-shift-lead">
            <span className="comply-shift-fig">{cutPct}%</span>
            <span className="comply-shift-note">total risk score after treatment. Both counts below are the same {scored.length} risks scored both ways; the {risks.length - scored.length} without a residual score are in neither.</span>
          </div>
          {LEVELS.map((lv) => (
            <ShiftRow key={lv} name={lv} from={levelCount(lv, 'inherent')} to={levelCount(lv, 'residual')} max={Math.max(1, ...LEVELS.flatMap((x) => [levelCount(x, 'inherent'), levelCount(x, 'residual')]))} onClick={() => nav(`/comply/risks?residual=${lv}`)} />
          ))}
          <div className="comply-keys" style={{ borderTop: 0, paddingTop: 0, marginTop: 8 }}>
            <StateKey color="#2e6fdb" label="Inherent — before treatment" />
            <StateKey color="#c2590b" label="Residual — after treatment" />
          </div>
          <div className="comply-top-head">Carrying the most residual risk</div>
          {topResidual.map((r) => (
            <CapRow key={r.id} title={r.title} meta={`${r.id} · ${r.residualLevel} after treatment · ${r.treatment.toLowerCase()} · ${r.owner} · ${fmtMoney(r.lossK * 1000, c.currency)} potential loss`}
              badges={<span className="comply-shift-vals"><b>{r.inherentScore}</b><i>→</i><b style={{ color: RISK_LEVEL_COLOR[riskLevel(r.residualScore ?? 0)] }}>{r.residualScore}</b></span>}
              onClick={() => nav(`/comply/risks?id=${r.id}`)} />
          ))}
          <div className="comply-meta">
            <button type="button" className="link" onClick={() => nav('/comply/risks')}>{risks.length} on the register →</button>
            <button type="button" onClick={() => nav('/comply/risks?residual=High')}><strong className="bad">{stillHigh}</strong>still high after treatment</button>
            <button type="button" onClick={() => nav('/comply/risks?lifecycle=pastdue')}><strong className="bad">{pastDue}</strong>treatments past due</button>
          </div>
        </Card>

        <Card title="Where the risk sits" sub={`Likelihood × impact · ${risks.filter((r) => r[heatMode]).length} risks placed · click a cell`} actions={<Tabs color={tone} value={heatMode} onChange={setHeatMode} tabs={[{ id: 'inherent', label: 'Inherent' }, { id: 'residual', label: 'Residual' }]} />}>
          <HeatGrid items={risks} mode={heatMode} onPick={(cell) => cell && nav(`/comply/risks?mode=${heatMode}&l=${cell[0]}&i=${cell[1]}`)} />
          <p className="muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
            Shading is the count in the cell, which is also written in it; the left edge marks the zone (green low, amber medium, red high). Scores are likelihood × impact × 4 on a 0–100 scale.
          </p>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Attention queue" sub={`${attention.length} overdue or lapsing · showing 12`} actions={<button className="link" onClick={() => nav('/comply/continuity?view=assets&lifecycle=eos')}>Asset register →</button>}>
          <div className="comply-scroll">
            {attention.slice(0, 12).map((a) => (
              <CapRow key={`${a.kind}-${a.id}`} title={a.title} meta={a.meta} onClick={() => nav(a.path)}
                badges={<><Badge color={a.kind === 'Asset' ? 'var(--sev-low)' : a.kind === 'Risk' ? 'var(--sev-high)' : a.kind === 'BIA' ? 'var(--m-matrix)' : tone}>{a.kind}</Badge><Badge color="var(--bad)">{a.daysOver} d over</Badge></>} />
            ))}
          </div>
          <div className="comply-meta">
            <button type="button" onClick={() => nav('/comply/continuity?view=assets&lifecycle=eos')}><strong className="bad">{attention.filter((a) => a.kind === 'Asset').length}</strong>assets past support end</button>
            <button type="button" onClick={() => nav('/comply/risks?lifecycle=pastdue')}><strong className="bad">{pastDue}</strong>treatments past due</button>
            <button type="button" onClick={() => nav('/comply/continuity?review=overdue')}><strong className="bad">{biaOverdue}</strong>BIA reviews overdue</button>
          </div>
        </Card>

        <Card title="Scope exclusions" sub={`${exclusions.filter((x) => x.kind === 'Control').length} controls marked not applicable · every exclusion carries a justification`} actions={<button className="link" onClick={() => nav('/comply/caas?view=controls&scope=na')}>All exclusions →</button>}>
          <div className="comply-scroll">
            {exclusions.slice(0, 14).map((x) => (
              <CapRow key={x.id} title={x.title} meta={x.meta} onClick={() => nav(x.to)}
                badges={<><Badge color="var(--sev-info)">{x.kind}</Badge>{x.by && <Badge color={x.by === 'HexaShield override' ? 'var(--m-view)' : 'var(--text-muted)'}>{x.by}</Badge>}{x.overdue && <Badge color="var(--bad)">Review overdue</Badge>}</>} />
            ))}
          </div>
        </Card>
      </div>

      <Card title={<><ShieldCheck size={15} /> Audit and attestation calendar</>} sub="Next external audits, certifications and regulator submissions · click to open the framework">
        <div className="grid g4" style={{ gap: 10 }}>
          {(nextAudits.length ? nextAudits : fws.slice(0, 4)).map((f) => (
            <button key={f.fw.id} type="button" className="comply-ringcard" style={{ padding: '12px 14px' }} onClick={() => nav(`/comply/caas?framework=${f.fw.id}`)}>
              <div className="comply-ringcard-head"><b>{f.fw.short}</b>{f.auditInDays !== undefined && <Badge color={f.auditInDays < 60 ? 'var(--sev-medium)' : 'var(--text-muted)'}>{f.auditInDays} d</Badge>}</div>
              <span className="muted" style={{ fontSize: 12 }}>{f.fw.nextAudit ?? 'Continuous monitoring'}</span>
              <span style={{ fontSize: 12 }}><b className="num">{f.documented}%</b> documented · <b className="num">{f.assured}%</b> assured</span>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
