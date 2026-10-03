import { useMemo, useState } from 'react';
import { Lock, Bot, Factory, CheckCircle2, XCircle, UserCheck, Lightbulb, Zap } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedConnectors, tenantName } from '../../data/customers';
import { TECHNIQUE_BY_ID } from '../../data/reference';
import {
  socAgents, agentDaily, accuracyTrend, decisionLog, AUTONOMY_LEVELS,
  type Autonomy, type SocAgent, type Decision, type DecisionOutcome,
} from '../../data/modules/ai';
import { Badge, BarRow, Callout, Card, KpiStrip, KV, Legend, Sources, StatusBadge, Timeline } from '../../components/ui';
import { PALETTE } from '../../components/Chart';
import { ChartLegend, SvgColumns, SvgLines } from '../reports/parts';
import { Drawer } from '../../components/Overlay';
import { dayLabels, fmtAgo, fmtNum } from '../../lib/format';
import { AI_TONE, ApprovalModal, RiskBadge } from './parts';
import './ai.css';

const OUTCOME_COLOR: Record<DecisionOutcome, string> = {
  auto: 'var(--m-ai)',
  approved: 'var(--good)',
  overridden: 'var(--sev-medium)',
  recommended: 'var(--sev-info)',
  rejected: 'var(--bad)',
};
const OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  auto: 'Auto (internal scope)',
  approved: 'Approved by human',
  overridden: 'Analyst override',
  recommended: 'Recommended',
  rejected: 'Rejected by human',
};
const SHORT = ['Visualise', 'Recommend', 'Approve', 'Auto'];
const LEVEL_COLOR = ['var(--sev-info)', 'var(--sev-low)', 'var(--m-ai)', 'var(--good)'];

function Dial({ level }: { level: Autonomy }) {
  // Half-circle dial with four segments and a needle.
  const cx = 32, cy = 32, r = 26;
  const seg = (i: number) => {
    const a0 = Math.PI + (i * Math.PI) / 4 + 0.04;
    const a1 = Math.PI + ((i + 1) * Math.PI) / 4 - 0.04;
    return `M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`;
  };
  const angle = -90 + (level + 0.5) * 45;
  return (
    <svg width={64} height={38} viewBox="0 0 64 38" aria-label={`Autonomy: ${AUTONOMY_LEVELS[level]}`}>
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={seg(i)} fill="none" strokeWidth={6} strokeLinecap="round" stroke={i <= level ? LEVEL_COLOR[level] : 'var(--track)'} />
      ))}
      <g className="ai-needle" style={{ transform: `rotate(${angle}deg)` }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - 20} stroke="var(--text-primary)" strokeWidth={2} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={3.5} fill="var(--text-primary)" />
    </svg>
  );
}

export default function Agents() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const h = headlines(c, tenantId);
  const days = rangeDays(timeRange);
  const base = useMemo(() => socAgents(c, tenantId), [c, tenantId]);
  const [levels, setLevels] = useState<Record<string, Autonomy>>({});
  const [pending, setPending] = useState<{ agent: SocAgent; to: Autonomy } | null>(null);
  const [dec, setDec] = useState<Decision | null>(null);
  const [agentSel, setAgentSel] = useState<string | 'all'>('all');
  const [requested, setRequested] = useState<Record<string, Autonomy>>({});
  const [outcomeSel, setOutcomeSel] = useState<DecisionOutcome | 'all'>('all');
  const [agentDrawer, setAgentDrawer] = useState<SocAgent | null>(null);
  const agents = base.map((a) => ({ ...a, level: (levels[`${c.id}-${a.id}`] ?? a.level) as Autonomy }));
  const daily = useMemo(() => agentDaily(c, tenantId, base), [c, tenantId, base]);
  const acc = accuracyTrend(c, tenantId);
  const log = decisionLog(c, tenantId);
  const logInRange = log.filter((d) => d.minAgo <= Math.max(days, 1) * 1440 && (agentSel === 'all' || d.agent === agentSel) && (outcomeSel === 'all' || d.outcome === outcomeSel));
  const toLog = (o: DecisionOutcome | 'all', a: string = 'all') => { setOutcomeSel(o); setAgentSel(a); document.getElementById('ai-declog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const total7 = agents.reduce((s, a) => s + a.actions7d, 0); // equals headlines.ai.agentActions7d
  const inRange = Math.round((total7 / 7) * days);
  const overrides = agents.reduce((s, a) => s + a.overrides, 0);
  const wAcc = agents.reduce((s, a) => s + a.accuracy * a.actions7d, 0) / Math.max(1, total7);
  const hours = agents.reduce((s, a) => s + a.hoursSaved, 0);
  const conns = scopedConnectors(c, tenantId);
  const siem = conns.filter((k) => ['SIEM', 'EDR / XDR', 'Identity'].includes(k.category)).slice(0, 4);

  function change(a: SocAgent, to: Autonomy) {
    if (a.ot || to === a.level) return;
    if (to > a.level && to >= 2) {
      setPending({ agent: a, to });
      return;
    }
    setLevels((m) => ({ ...m, [`${c.id}-${a.id}`]: to }));
    toast(`${a.name} lowered to “${AUTONOMY_LEVELS[to]}”. Takes effect immediately; logged to the audit ledger.`);
  }

  return (
    <>
      <p className="page-intro">
        HexaSOC agents work every alert for <b>{c.name}</b> · {tenantName(c, tenantId)} across {siem.map((k) => k.product).join(', ')}. Autonomy is a dial per agent, set by you;
        anything that writes to your tools goes through the approval gate, and OT stays human-on-the-loop.
      </p>

      <KpiStrip
        toneColor={AI_TONE}
        items={[
          { label: 'Agent actions', hint: '7 days', value: fmtNum(h.ai.agentActions7d), onClick: () => document.getElementById('ai-actions')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: `HexaSOC agent log · ${siem.map((k) => k.product).join(', ')}` },
          { label: 'Agent actions', hint: rangeLabel(timeRange), value: fmtNum(inRange), onClick: () => toLog('all'), source: 'HexaSOC agent log' },
          { label: 'Human approval rate', hint: 'write-backs', value: `${h.ai.humanApprovalPct}%`, bar: h.ai.humanApprovalPct, toneColor: 'var(--good)', onClick: () => toLog('approved'), source: 'HexaView approval gate' },
          { label: 'Agent accuracy', hint: 'vs analyst review', value: `${wAcc.toFixed(1)}%`, bar: wAcc, onClick: () => document.getElementById('ai-acc')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: 'Analyst review sampling' },
          { label: 'Analyst overrides', hint: '7 days', value: fmtNum(overrides), unit: `${((overrides / Math.max(1, total7)) * 100).toFixed(2)}%`, onClick: () => toLog('overridden'), source: 'HexaSOC case store' },
          { label: 'Analyst hours saved', hint: '7 days', value: fmtNum(hours), unit: `≈ ${(hours / 37.5).toFixed(1)} FTE`, onClick: () => document.getElementById('ai-hours')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: 'Actions × median analyst minutes' },
          { label: 'Auto-triaged', value: `${h.soc.autoTriagedPct}%`, unit: `of ${fmtNum(h.soc.alerts24h)} alerts / 24 h`, to: '/soc/mdr', source: siem.map((k) => k.product).join(' · ') },
        ]}
      />

      <Card title="Agents and autonomy" sub="Visualise only → Recommend → Act with approval → Act autonomously. Raising autonomy to an acting level needs approval; lowering it is instant.">
        <div className="grid g4">
          {agents.map((a) => (
            <div key={a.id} className="card ai-agent" style={{ ['--tone' as string]: a.ot ? 'var(--m-ot)' : AI_TONE, boxShadow: 'none' }}>
              <div className="ai-agent-top">
                <span className="ico-box" style={{ ['--tone' as string]: a.ot ? 'var(--m-ot)' : AI_TONE }}>{a.ot ? <Factory /> : <Bot />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>{a.name}</h4>
                  <p>{a.role}</p>
                </div>
              </div>
              <div className="ai-dial">
                <Dial level={a.level} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: LEVEL_COLOR[a.level] }}>{AUTONOMY_LEVELS[a.level]}</div>
                  <div className="muted" style={{ fontSize: 10.5, lineHeight: 1.35 }}>{a.level === 3 ? a.autoScope : a.level === 2 ? 'Drafts actions; a human approves each one' : a.level === 1 ? 'Suggests; analysts decide' : 'Shows findings only'}</div>
                </div>
              </div>
              <div className="ai-dial-seg" style={{ ['--tone' as string]: LEVEL_COLOR[a.level] }}>
                {SHORT.map((s, i) => (
                  <button key={s} className={i === a.level ? 'on' : ''} disabled={a.ot && i !== a.level} onClick={() => change(a, i as Autonomy)} title={AUTONOMY_LEVELS[i]}>
                    {s}
                  </button>
                ))}
              </div>
              {requested[`${c.id}-${a.id}`] !== undefined && (
                <Badge color="var(--sev-medium)" dot>Approval pending: {AUTONOMY_LEVELS[requested[`${c.id}-${a.id}`]]}</Badge>
              )}
              {a.lockReason && (
                <div className="ai-lock">
                  <Lock /> <span>{a.lockReason}</span>
                </div>
              )}
              <div className="ai-tiles">
                <button className="ai-tile" onClick={() => toLog('all', a.id)} title="Source: HexaSOC agent log · click for decisions"><b>{fmtNum(a.actions7d)}</b><span>actions 7 d</span></button>
                <button className="ai-tile" style={{ ['--tile' as string]: 'var(--good)' }} onClick={() => setAgentDrawer(a)} title="Source: analyst review sampling"><b>{a.accuracy}%</b><span>accuracy</span></button>
                <button className="ai-tile" style={{ ['--tile' as string]: 'var(--sev-medium)' }} onClick={() => toLog('overridden', a.id)} title="Source: HexaSOC case store · click for overrides"><b>{a.overrides}</b><span>overrides</span></button>
              </div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>
                <Zap size={11} style={{ verticalAlign: -1, color: 'var(--m-ai)' }} /> {a.lastAction}
              </div>
              <Sources items={a.tools.map((t) => ({ name: t }))} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Agent actions over 7 days" sub={`Stacked by agent · total ${fmtNum(total7)} = HexaSOC headline · hover a column for the split`} actions={<Sources items={siem.map((k) => ({ name: k.product, status: k.status }))} />}>
          <div id="ai-actions">
            <ChartLegend items={agents.map((a, i) => ({ label: a.name.replace(' agent', ''), color: a.ot ? '#f7a04a' : PALETTE[i % PALETTE.length] }))} />
            <SvgColumns labels={dayLabels(7)} height={250} series={agents.map((a, i) => ({ name: a.name.replace(' agent', ''), color: a.ot ? '#f7a04a' : PALETTE[i % PALETTE.length], data: daily[i] }))} />
          </div>
        </Card>
        <Card title="Accuracy vs analyst overrides" sub="Weekly, last 12 weeks · overrides feed back into agent prompts and detections">
          <div id="ai-acc" className="stack" style={{ gap: 6 }}>
            <SvgLines labels={Array.from({ length: 12 }, (_, i) => `W${i + 1}`)} height={150} series={[{ name: 'Accuracy', color: '#8f8cff', data: acc.acc }]} unit="%" />
            <div className="section-label" style={{ margin: 0 }}>Analyst overrides per week</div>
            <SvgColumns labels={Array.from({ length: 12 }, (_, i) => `W${i + 1}`)} height={100} series={[{ name: 'Overrides', color: '#f0a338', data: acc.ovr }]} />
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <div id="ai-declog">
        <Card
          title="Decision log"
          count={logInRange.length}
          sub={`Reasoning and evidence for every agent decision · ${rangeLabel(timeRange).toLowerCase()}`}
          flush
          actions={
            <div className="chips">
              <select className="select" value={outcomeSel} onChange={(e) => setOutcomeSel(e.target.value as DecisionOutcome | 'all')} aria-label="Filter by outcome">
                <option value="all">All outcomes</option>
                {(Object.keys(OUTCOME_LABEL) as DecisionOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
              </select>
              <select className="select" value={agentSel} onChange={(e) => setAgentSel(e.target.value)} aria-label="Filter by agent">
                <option value="all">All agents</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          }
        >
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {logInRange.map((d) => {
              const a = agents.find((x) => x.id === d.agent);
              return (
                <button key={d.id} className="list-row" onClick={() => setDec(d)}>
                  <span className="ico-box" style={{ ['--tone' as string]: OUTCOME_COLOR[d.outcome] }}>
                    {d.outcome === 'approved' ? <UserCheck /> : d.outcome === 'rejected' ? <XCircle /> : d.outcome === 'recommended' ? <Lightbulb /> : d.outcome === 'overridden' ? <UserCheck /> : <CheckCircle2 />}
                  </span>
                  <span className="list-main">
                    <b>{d.title}</b>
                    <span>{a?.name} · {c.tenants.find((t) => t.id === d.tenant)?.short} · {d.reasoning}</span>
                  </span>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge value={d.outcome} map={OUTCOME_COLOR} />
                    <span className="muted" style={{ fontSize: 10.5 }}>{fmtAgo(d.minAgo)}</span>
                  </span>
                </button>
              );
            })}
            {logInRange.length === 0 && <div className="empty">No agent decisions match in this range for this scope. Widen the time range or clear the filters.</div>}
          </div>
        </Card>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Analyst hours saved" sub="7 days · actions × median analyst minutes per action · click an agent for its decisions">
            <div id="ai-hours" />
            {agents.slice().sort((x, y) => y.hoursSaved - x.hoursSaved).map((a) => (
              <button key={a.id} className="list-row" style={{ padding: 0, display: 'block', width: '100%' }} onClick={() => toLog('all', a.id)}><BarRow label={a.name.replace(' agent', '')} sub={`${a.minutesPerAction} min / action`} value={a.hoursSaved} max={Math.max(...agents.map((x) => x.hoursSaved))} color={a.ot ? 'var(--m-ot)' : AI_TONE} display={`${fmtNum(a.hoursSaved)} h`} /></button>
            ))}
          </Card>
          <Card title="Guardrails on agent autonomy" tinted toneColor={AI_TONE}>
            <div className="stack" style={{ gap: 8, fontSize: 12 }}>
              <Callout kind="good"><b>{h.ai.humanApprovalPct}% of write-backs</b> to customer tools were approved by a named human. Autonomous scope is limited to HexaSOC-internal actions.</Callout>
              <Callout kind="warn" color="var(--m-ot)"><b>OT is human-on-the-loop, always.</b> OT agents are locked at Recommend and OT connectors are read-only by policy.</Callout>
              <Legend items={AUTONOMY_LEVELS.map((l, i) => ({ label: l, color: LEVEL_COLOR[i] }))} />
            </div>
          </Card>
        </div>
      </div>

      {agentDrawer && (
        <Drawer title={agentDrawer.name} sub={`${AUTONOMY_LEVELS[agentDrawer.level]} · ${tenantName(c, tenantId)}`} icon={<span className="ico-box" style={{ ['--tone' as string]: agentDrawer.ot ? 'var(--m-ot)' : AI_TONE }}>{agentDrawer.ot ? <Factory /> : <Bot />}</span>} onClose={() => setAgentDrawer(null)}>
          <KV
            rows={[
              ['Role', agentDrawer.role],
              ['Autonomous scope', agentDrawer.autoScope],
              ['Actions (7 d)', fmtNum(agentDrawer.actions7d)],
              ['Accuracy', `${agentDrawer.accuracy}% (analyst review sample)`],
              ['Overrides (7 d)', String(agentDrawer.overrides)],
              ['Median analyst minutes / action', String(agentDrawer.minutesPerAction)],
              ['Hours saved (7 d)', `${fmtNum(agentDrawer.hoursSaved)} h`],
              ['Last action', agentDrawer.lastAction],
            ]}
          />
          <div>
            <div className="section-label">Tools it reads</div>
            <Sources items={agentDrawer.tools.map((t) => ({ name: t }))} />
          </div>
          <div>
            <div className="section-label">Recent decisions</div>
            <div className="list">
              {log.filter((d) => d.agent === agentDrawer.id).map((d) => (
                <button key={d.id} className="list-row" onClick={() => { setAgentDrawer(null); setDec(d); }}>
                  <i className="dot" style={{ background: OUTCOME_COLOR[d.outcome] }} />
                  <span className="list-main"><b>{d.title}</b><span>{OUTCOME_LABEL[d.outcome]} · {fmtAgo(d.minAgo)}</span></span>
                </button>
              ))}
              {log.filter((d) => d.agent === agentDrawer.id).length === 0 && <div className="muted" style={{ fontSize: 12 }}>No logged decisions for this agent in this scope.</div>}
            </div>
          </div>
        </Drawer>
      )}

      {dec && (
        <Drawer
          title={dec.title}
          sub={`${dec.id} · ${agents.find((a) => a.id === dec.agent)?.name} · ${c.tenants.find((t) => t.id === dec.tenant)?.name}`}
          icon={<span className="ico-box" style={{ ['--tone' as string]: OUTCOME_COLOR[dec.outcome] }}><Bot /></span>}
          onClose={() => setDec(null)}
        >
          <KV
            rows={[
              ['Outcome', <StatusBadge value={dec.outcome} map={OUTCOME_COLOR} />],
              ['Meaning', OUTCOME_LABEL[dec.outcome]],
              ['Decided by', dec.by ?? (dec.outcome === 'auto' ? 'Agent (within autonomous scope)' : 'Awaiting analyst')],
              ['Confidence', `${Math.round(dec.confidence * 100)}%`],
              ['ATT&CK', dec.technique ? `${dec.technique} · ${TECHNIQUE_BY_ID[dec.technique]?.name ?? ''}` : '—'],
              ['Risk class', dec.risk ? <RiskBadge risk={dec.risk} /> : '—'],
            ]}
          />
          <div>
            <div className="section-label">Reasoning</div>
            <Callout>{dec.reasoning}</Callout>
          </div>
          <div>
            <div className="section-label">Evidence</div>
            <div className="chips">{dec.evidence.map((e) => <Badge key={e} color={AI_TONE}>{e}</Badge>)}</div>
          </div>
          <div>
            <div className="section-label">Trace</div>
            <Timeline
              items={[
                { time: fmtAgo(dec.minAgo + 3), title: 'Signal received', body: dec.evidence[0], color: 'var(--sev-info)' },
                { time: fmtAgo(dec.minAgo + 2), title: 'Context gathered', body: `${dec.evidence.length} sources queried through HexaCore`, color: AI_TONE },
                { time: fmtAgo(dec.minAgo + 1), title: dec.outcome === 'auto' ? 'Acted within autonomous scope' : 'Proposal written', body: `Confidence ${Math.round(dec.confidence * 100)}%`, color: AI_TONE },
                { time: fmtAgo(dec.minAgo), title: OUTCOME_LABEL[dec.outcome], body: dec.by, color: OUTCOME_COLOR[dec.outcome] },
              ]}
            />
          </div>
        </Drawer>
      )}

      {pending && (
        <ApprovalModal
          title={`Raise ${pending.agent.name} to “${AUTONOMY_LEVELS[pending.to]}”`}
          connector="HexaSOC agent policy"
          operation={`set_autonomy(${pending.agent.id}, ${pending.to})`}
          risk={pending.to === 3 ? 'high' : 'medium'}
          change={
            pending.to === 3
              ? `${pending.agent.name} will act without per-action approval inside this scope: ${pending.agent.autoScope}. Every action is still logged, reversible where the tool allows, and reviewed weekly.`
              : `${pending.agent.name} will draft actions for human approval instead of only recommending.`
          }
          approvers={pending.to === 3 ? [c.people.ciso.name, c.people.admin.name] : [c.people.socLead.name]}
          onClose={() => setPending(null)}
          onSubmit={() => {
            setRequested((m) => ({ ...m, [`${c.id}-${pending.agent.id}`]: pending.to }));
            toast(`Autonomy change for ${pending.agent.name} submitted for approval (${pending.to === 3 ? 'two approvers' : 'one approver'}).`);
            setPending(null);
          }}
        />
      )}
    </>
  );
}
