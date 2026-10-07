import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Siren, ChevronRight, X, Wand2, Play, CheckCircle2, ArrowRight } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { ROLE_BY_ID } from '../../modules/roles';
import { Drawer } from '../../components/Overlay';
import { IcoBox, Btn } from '../../components/ui';
import {
  irTools, irPeople, PHASES, PHASE_LABEL, PHASE_SHORT, PHASE_COLOR, SEV_LABEL, SEV_COLOR_IR, IR_TYPES, TL_TYPE,
  type IrIncident, type Notice, type Phase, type Sev, type IrType, type TimelineEntry,
} from '../../data/modules/incident';
import { useIrState, ir, getIrState } from './store';
import { fmtDateShort, fmtTime } from '../../lib/format';
import { reducedMotion } from '../../lib/useIntro';
import { AV_COLORS, initials } from '../soc/parts';
import './incident.css';

export const IR_TONE = 'var(--m-ir)';
export const IR_HEX = '#e11d48';
const MIN = 60_000;
type ToneStyle = CSSProperties & { '--pc'?: string; '--hc'?: string };

/* ---------------------------------------------------------------------
   Hooks
   --------------------------------------------------------------------- */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), reducedMotion() ? Math.max(ms, 5000) : ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useIr() {
  const app = useApp();
  const c = app.customer;
  const state = useIrState(c);
  const nav = useNavigate();
  const tools = useMemo(() => irTools(c), [c]);
  const ppl = useMemo(() => irPeople(c), [c]);
  const actor = ROLE_BY_ID[app.persona]?.person(c).name ?? c.people.socLead.name;
  const inScope = (tids: string[]) => app.tenantId === 'all' || tids.includes(app.tenantId);
  const incidents = state.incidents.filter((i) => inScope(i.tenantIds) || i.id === state.focus || i.guided);
  const active = incidents.filter((i) => i.status === 'active');
  const closed = incidents.filter((i) => i.status === 'closed').sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const escalations = state.escalations.filter((e) => inScope([e.tenantId]) || e.guided);
  const focus = state.incidents.find((i) => i.id === state.focus) ?? active[0] ?? incidents[0] ?? null;
  const scopeLabel = app.tenantId === 'all' ? `${c.name} (all ${c.tenants.length} tenants)` : c.tenants.find((t) => t.id === app.tenantId)?.name ?? c.name;
  return { ...app, c, state, nav, tools, ppl, actor, incidents, active, closed, escalations, focus, scopeLabel, tone: IR_TONE, setFocus: (id: string) => ir.focus(c, id) };
}
export type IrCtx = ReturnType<typeof useIr>;

/* ---------------------------------------------------------------------
   Formatting
   --------------------------------------------------------------------- */
export const fmtT = (t: number) => `${fmtDateShort(new Date(t))} ${fmtTime(new Date(t))}`;
export const fmtClock = (t: number) => fmtTime(new Date(t));
export function fmtSpan(ms: number): string {
  const neg = ms < 0;
  const m = Math.round(Math.abs(ms) / MIN);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const body = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
  return neg ? `-${body}` : body;
}
export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return d > 0 ? `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
export function agoText(t: number, now: number): string {
  const m = (now - t) / MIN;
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.round(m)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

/** Deadline state of a notification. */
export function noticeClock(n: Notice, now: number) {
  if (n.status === 'sent') return { left: 0, pct: 100, color: 'var(--good)', label: `Sent ${fmtT(n.sentAt ?? now)}`, overdue: false, onTime: !n.dueAt || (n.sentAt ?? 0) <= n.dueAt };
  if (n.status === 'na') return { left: 0, pct: 100, color: 'var(--text-muted)', label: 'Not required', overdue: false, onTime: true };
  if (!n.dueAt) return { left: Infinity, pct: 0, color: 'var(--sev-info)', label: 'No statutory deadline', overdue: false, onTime: true };
  const left = n.dueAt - now;
  const pct = Math.min(100, Math.max(2, ((now - n.startAt) / (n.dueAt - n.startAt)) * 100));
  const color = left < 0 ? 'var(--bad)' : pct > 75 ? 'var(--sev-critical)' : pct > 45 ? 'var(--sev-high)' : 'var(--sev-medium)';
  return { left, pct, color, label: left < 0 ? `Overdue ${fmtSpan(-left)}` : `${fmtSpan(left)} left`, overdue: left < 0, onTime: true };
}

/* ---------------------------------------------------------------------
   Small visual pieces
   --------------------------------------------------------------------- */
export function Pill({ children, color = IR_TONE, solid, dot, title }: { children: ReactNode; color?: string; solid?: boolean; dot?: boolean; title?: string }) {
  return <span className={`ir-pill ${solid ? 'solid' : ''}`} style={{ '--pc': color } as ToneStyle} title={title}>{dot && <i />}{children}</span>;
}
export const SevPill = ({ sev }: { sev: Sev }) => <Pill color={SEV_COLOR_IR[sev]} solid={sev === 1}>{SEV_LABEL[sev]}</Pill>;
export const PhasePill = ({ phase }: { phase: Phase }) => <Pill color={PHASE_COLOR[phase]} dot>{PHASE_LABEL[phase]}</Pill>;
export const TypePill = ({ type }: { type: IrType }) => <Pill color={IR_TYPES[type].color}>{IR_TYPES[type].short}</Pill>;
export function StatusPill({ inc }: { inc: IrIncident }) {
  return inc.status === 'closed' ? <Pill color="var(--good)" dot>Closed</Pill> : <PhasePill phase={inc.phase} />;
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const h = name.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return <span className="ir-avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: AV_COLORS[h % AV_COLORS.length] }}>{initials(name)}</span>;
}

export function ProgBar({ parts }: { parts: { value: number; color: string }[] }) {
  return <div className="ir-prog">{parts.map((p, i) => <i key={i} style={{ width: `${Math.max(0, Math.min(100, p.value))}%`, background: p.color }} />)}</div>;
}

/** NIST SP 800-61 phase stepper. */
export function PhaseStepper({ inc, compact }: { inc: IrIncident; compact?: boolean }) {
  const cur = PHASES.indexOf(inc.phase);
  return (
    <div className="ir-phases">
      {PHASES.map((p, i) => {
        const done = inc.status === 'closed' || i < cur;
        const on = inc.status !== 'closed' && i === cur;
        return (
          <div key={p} className={`ir-phase ${done ? 'done' : ''} ${on ? 'on' : ''}`} style={{ '--pc': PHASE_COLOR[p] } as ToneStyle}>
            <span className="ir-phase-dot">{done ? '✓' : i + 1}</span>
            <b>{compact ? PHASE_SHORT[p] : PHASE_LABEL[p]}</b>
            {!compact && <small>{inc.phaseAt[p] ? fmtT(inc.phaseAt[p] as number) : 'not started'}</small>}
          </div>
        );
      })}
    </div>
  );
}

/** Compact progress across the five phases (used on cards). */
export function PhaseBar({ inc }: { inc: IrIncident }) {
  const cur = inc.status === 'closed' ? 5 : PHASES.indexOf(inc.phase) + 0.5;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }} title={`${PHASE_LABEL[inc.phase]} (${Math.round(Math.min(5, cur))} of 5)`}>
      {PHASES.map((p, i) => <div key={p} style={{ height: 6, borderRadius: 3, background: i < Math.floor(cur) ? PHASE_COLOR[p] : i < cur ? `color-mix(in srgb, ${PHASE_COLOR[p]} 45%, var(--track))` : 'var(--track)' }} />)}
    </div>
  );
}

export function NoticeClock({ n, now, onClick }: { n: Notice; now: number; onClick?: () => void }) {
  const k = noticeClock(n, now);
  return (
    <div className="ir-clock" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="ir-clock-h"><b>{n.name}</b><span style={{ color: k.color }}>{k.label}</span></div>
      <div className="ir-clock-bar"><i style={{ width: `${k.pct}%`, background: k.color }} /></div>
      <div className="ir-sub">{n.recipient} · {n.basis}</div>
    </div>
  );
}

/** Incident header used by the War Room and other per-incident pages. */
export function IncidentHeader({ inc, actions, now }: { inc: IrIncident; actions?: ReactNode; now: number }) {
  const { c } = useIr();
  const tenant = c.tenants.find((t) => t.id === inc.tenantIds[0]);
  const live = inc.status === 'active';
  return (
    <div className="ir-head" style={{ '--hc': SEV_COLOR_IR[inc.sev] } as ToneStyle}>
      {live && <span className="ir-blink" />}
      <div className="ir-head-main">
        <div className="row wrap" style={{ gap: 6 }}>
          <SevPill sev={inc.sev} />
          <StatusPill inc={inc} />
          <TypePill type={inc.type} />
          <span className="ir-mono muted">{inc.id} · {tenant?.short ?? inc.tenantIds[0]}{inc.socId ? ` · ${inc.socId}` : ''}</span>
        </div>
        <h3>{inc.title}</h3>
        <div className="ir-sub" style={{ marginTop: 4 }}>Commander <b style={{ color: 'var(--text-primary)' }}>{inc.commander}</b> · declared {fmtT(inc.declaredAt)}</div>
      </div>
      <div className="ir-head-side">
        <span className="ir-clock-big">{live ? `T+${fmtElapsed(now - inc.declaredAt)}` : `Closed ${fmtDateShort(new Date(inc.closedAt ?? now))}`}</span>
        {actions && <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>{actions}</div>}
      </div>
    </div>
  );
}

/** Incident selector chips (active first, closed in a select). */
export function IncidentPicker({ includeClosed = true, label = 'Incident' }: { includeClosed?: boolean; label?: string }) {
  const { active, closed, focus, setFocus } = useIr();
  return (
    <div className="ir-picker">
      <span className="section-label" style={{ margin: 0 }}>{label}</span>
      {active.map((i) => (
        <button key={i.id} type="button" className={`ir-pick ${focus?.id === i.id ? 'on' : ''}`} style={{ '--pc': SEV_COLOR_IR[i.sev] } as ToneStyle} onClick={() => setFocus(i.id)} title={i.title}>
          <b>{i.id} · {SEV_LABEL[i.sev]}</b>
          <small>{PHASE_SHORT[i.phase]} · {IR_TYPES[i.type].short}{i.guided ? ' · guided' : ''}</small>
        </button>
      ))}
      {includeClosed && closed.length > 0 && (
        <select className="select" value={focus?.status === 'closed' ? focus.id : ''} onChange={(e) => e.target.value && setFocus(e.target.value)} aria-label="Closed incidents" style={{ maxWidth: 260 }}>
          <option value="">Closed incidents ({closed.length})…</option>
          {closed.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.title.slice(0, 48)}</option>)}
        </select>
      )}
    </div>
  );
}

/** Drawer listing records behind a number. */
export function RecordsDrawer({ title, sub, source, rows, onClose }: { title: ReactNode; sub?: ReactNode; source: string; rows: { id: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }[]; onClose: () => void }) {
  return (
    <Drawer title={title} sub={sub ?? `${rows.length} records`} icon={<IcoBox color={IR_TONE}><Siren /></IcoBox>} onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <span className="src-chip" style={{ alignSelf: 'flex-start' }}>Source: {source}</span>
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className={`list-row ${r.onClick ? 'clickable' : ''}`} onClick={r.onClick} style={r.onClick ? { cursor: 'pointer' } : undefined}>
              <span className="list-main"><b>{r.title}</b>{r.sub && <span>{r.sub}</span>}</span>
              {r.right}
            </div>
          ))}
          {rows.length === 0 && <div className="empty">Nothing in this scope.</div>}
        </div>
      </div>
    </Drawer>
  );
}

/** One audited timeline entry. */
export function EntryRow({ e, onKey, compact }: { e: TimelineEntry; onKey?: () => void; compact?: boolean }) {
  const nav = useNavigate();
  const meta = TL_TYPE[e.type];
  return (
    <div className="ir-tl-row" style={{ '--pc': meta.color } as ToneStyle}>
      <div className="ir-tl-time">{fmtClock(e.t)}<br />{fmtDateShort(new Date(e.t))}</div>
      <div className={`ir-tl-dot ${e.key ? 'key' : ''}`} />
      <div className="ir-tl-body">
        <p>{e.text}</p>
        <div className="ir-tl-meta">
          <Pill color={meta.color}>{meta.label}</Pill>
          <span>{e.actor}</span>
          <span>·</span>
          {e.to ? <button type="button" className="ir-link" style={{ fontSize: 10.5 }} onClick={() => nav(e.to as string)}>{e.source}</button> : <span>{e.source}</span>}
          {!compact && <><span>·</span><span>{PHASE_SHORT[e.phase]}</span><span className="ir-tl-hash" title={`Audit id ${e.id}\nprev ${e.prev}\nhash ${e.hash}`}>#{e.seq} {e.hash.slice(0, 10)}</span></>}
          {e.auto && <span title="Written by a connector or HexaSOC automation">auto</span>}
        </div>
      </div>
      {!compact && onKey && (
        <div className="ir-tl-actions">
          <button type="button" className={`ir-icon-btn ${e.key ? 'on' : ''}`} onClick={onKey} title={e.key ? 'Unpin key event' : 'Mark as key event'} aria-label="Toggle key event">★</button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Guided scenario
   --------------------------------------------------------------------- */
export const GUIDE_STEPS: { label: string; path: string; text: string }[] = [
  { label: 'Accept & declare', path: '/incident-response/escalations', text: 'HexaSOC L3 has escalated this case to L4. Open it, review the triage, then Accept & declare the incident as SEV1.' },
  { label: 'War room', path: '/incident-response/warroom', text: 'The war room, bridge and clocks are live. Join the bridge, check the roles, then record the first decision.' },
  { label: 'Stakeholders', path: '/incident-response/stakeholders', text: 'Bring in the right people: notify legal, the breach coach and the insurer, or add a stakeholder from the directory.' },
  { label: 'Timeline', path: '/incident-response/timeline', text: 'Add an analyst note to the audited timeline; every entry is SHA-256 hash-chained.' },
  { label: 'Notifications', path: '/incident-response/notifications', text: 'Regulatory clocks are running. Review the template and approve (or send) the first notification.' },
  { label: 'Report', path: '/incident-response/report', text: 'Generate the incident report, request sign-off and sign as legal and CISO to remove the DRAFT watermark.' },
  { label: 'Review', path: '/incident-response/review', text: 'Scenario complete. Schedule the blameless post-incident review and push actions to HexaComply and the Security Programme.' },
];

/** className for the element the guide is pointing at on this page. */
export function useGuideTarget(step: number): string {
  const { state, focus } = useIr();
  const g = state.guided;
  if (!g || g.step !== step) return '';
  if (step > 0 && focus?.id !== g.incidentId) return '';
  return 'ir-target';
}

function GuidedBanner() {
  const { c, state, nav, actor, ppl, toast } = useIr();
  const loc = useLocation();
  const g = state.guided;
  if (!g) return null;
  const esc = state.escalations.find((e) => e.id === g.escalationId);
  const inc = g.incidentId ? state.incidents.find((i) => i.id === g.incidentId) : null;
  const step = GUIDE_STEPS[Math.min(g.step, GUIDE_STEPS.length - 1)];
  const onPage = loc.pathname === step.path;
  const go = (i: number) => {
    if (inc) ir.focus(c, inc.id);
    nav(GUIDE_STEPS[i].path + (i === 0 ? `?esc=${g.escalationId}` : ''));
  };
  const doIt = () => {
    const s = getIrState(c);
    const cur = s.incidents.find((i) => i.id === s.guided?.incidentId);
    switch (g.step) {
      case 0: {
        if (!esc) return;
        const id = ir.accept(c, esc.id, { title: esc.title, type: esc.type, sev: 1, commander: ppl.ciso.name, scope: `${esc.assets.join(', ')}` }, actor);
        if (id) { toast(`${id} declared · war room opened and ${esc.dataClasses.length ? 'notification clocks started' : 'clocks started'}`); ir.focus(c, id); nav(GUIDE_STEPS[1].path); }
        return;
      }
      case 1:
        if (!cur) return;
        ir.joinBridge(c, cur.id, actor);
        ir.addDecision(c, cur.id, { decision: cur.ot ? 'Hold OT in a safe state; site engineers isolate the IT/OT conduit' : cur.type === 'bec' ? 'Hold all payments to changed beneficiaries and request a recall' : `Isolate ${cur.assets[0]} and adjacent systems now`, rationale: 'Contain first; business impact accepted by the exec sponsor', by: cur.commander }, actor);
        toast('Decision recorded and written to the timeline');
        nav(GUIDE_STEPS[2].path);
        return;
      case 2: {
        if (!cur) return;
        const ids = cur.stakeholders.filter((x) => !x.notifiedAt && /Legal|Outside counsel|Insurer|Privacy|Broker|PR/i.test(x.kind)).map((x) => x.id);
        ir.notify(c, cur.id, ids.length ? ids : cur.stakeholders.filter((x) => !x.notifiedAt).slice(0, 3).map((x) => x.id), 'Comms Hub · Teams + email', actor);
        toast('Legal, breach coach and insurer notified through Comms Hub');
        nav(GUIDE_STEPS[3].path);
        return;
      }
      case 3:
        if (!cur) return;
        ir.addEntry(c, cur.id, { type: 'note', text: `Scope check: no further hosts beaconing; ${cur.assets[0]} remains the only confirmed patient zero.`, key: true }, actor);
        toast('Note added to the audited timeline');
        nav(GUIDE_STEPS[4].path);
        return;
      case 4: {
        if (!cur) return;
        const n = cur.notices.find((x) => x.status === 'draft' && x.kind === 'regulator') ?? cur.notices.find((x) => x.status === 'draft');
        if (n) ir.approveNotice(c, cur.id, n.id, ppl.legal.name);
        else ir.setGuidedStep(c, 5);
        toast(n ? `Approved: ${n.name}` : 'No drafts left to approve');
        nav(GUIDE_STEPS[5].path);
        return;
      }
      case 5:
        if (!cur) return;
        if (cur.report.status === 'none') ir.generate(c, cur.id, actor);
        ir.requestSignoff(c, cur.id, actor, '');
        ir.sign(c, cur.id, 'legal', ppl.legal.name);
        ir.sign(c, cur.id, 'ciso', ppl.ciso.name);
        toast('Report generated and signed by legal and the CISO');
        return;
      default:
        nav(GUIDE_STEPS[6].path);
    }
  };
  const finished = g.step >= GUIDE_STEPS.length - 1;
  return (
    <div className="ir-guide" role="region" aria-label="Guided IR scenario">
      <div className="ir-guide-top">
        <Wand2 size={16} style={{ color: IR_TONE }} />
        <h4>Guided IR scenario · {inc ? inc.id : esc?.id}</h4>
        <span className="ir-sub" style={{ flex: 1, minWidth: 200 }}>{esc?.title}</span>
        <button type="button" className="ir-icon-btn" onClick={() => ir.exitGuided(c)} title="Exit the guided scenario" aria-label="Exit guided scenario"><X size={15} /></button>
      </div>
      <div className="ir-guide-steps">
        {GUIDE_STEPS.map((s, i) => (
          <button key={s.label} type="button" className={`ir-guide-step ${i < g.step ? 'done' : ''} ${i === g.step ? 'on' : ''}`} onClick={() => (i === 0 || inc) && go(i)}>
            <b>{i < g.step ? '✓' : i + 1}</b><span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
        <span className="ir-guide-text">{finished ? <><CheckCircle2 size={14} style={{ verticalAlign: -2, color: 'var(--good)' }} /> {step.text}</> : <><b>Step {g.step + 1}:</b> {step.text}</>}</span>
        {!onPage && <Btn sm onClick={() => go(Math.min(g.step, GUIDE_STEPS.length - 1))}><ArrowRight size={13} /> Go to {step.label}</Btn>}
        {!finished && <Btn sm primary color={IR_TONE} onClick={doIt}><Play size={13} /> Do this step for me</Btn>}
        {finished && <Btn sm ghost onClick={() => ir.exitGuided(c)}>Finish</Btn>}
      </div>
    </div>
  );
}

/** Page wrapper: scope, guided banner and ?inc= focus handling. */
export function IrPage({ children }: { children: ReactNode }) {
  const { c, state } = useIr();
  const [sp] = useSearchParams();
  const want = sp.get('inc');
  useEffect(() => {
    if (want && state.incidents.some((i) => i.id === want) && state.focus !== want) ir.focus(c, want);
  }, [want, c, state.incidents, state.focus]);
  return (
    <div className="ir-scope">
      <GuidedBanner />
      {children}
    </div>
  );
}

export function LinkBtn({ to, children }: { to: string; children: ReactNode }) {
  const nav = useNavigate();
  return <Btn sm ghost onClick={() => nav(to)}>{children} <ChevronRight size={12} /></Btn>;
}

/** Empty-state when the scope has no incident. */
export function NoIncident() {
  const { nav } = useIr();
  return (
    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
      <p className="muted" style={{ marginBottom: 10 }}>No incident in this tenant scope. Declare one from an escalation, or switch scope to the group.</p>
      <Btn primary color={IR_TONE} onClick={() => nav('/incident-response/escalations')}>Open escalations</Btn>
    </div>
  );
}
