import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CheckSquare, GitPullRequestArrow, Square, Flag, FileCheck2, Gavel, Link2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { signedIn } from '../../data/modules/ops';
import { Drawer, Modal } from '../../components/Overlay';
import { Btn, KV, Ring, Callout, SectionLabel } from '../../components/ui';
import {
  pgSubscribe, pgVersion, initiatives, pgUpdateStatus, pgToggleMilestone, pgRaiseRisk, pgRequestChange,
  WS_BY_ID, STATUS_HEX, PG_STATUSES, TODAY_M, PG_MONTHS, monthDate, monthLabel, CSF_CAT_BY_ID,
  type Initiative, type PgStatus, type PgRisk, type PgChange,
} from '../../data/modules/programme';
import { fmtMoney, fmtDate, fmtDateShort, fmtAgo } from '../../lib/format';
import './programme.css';

export const PG_TONE = MODULE_BY_ID.programme.tone;
export type PC = CSSProperties & { '--pc'?: string; '--d'?: string };

/** Store-backed programme view for the current customer and tenant scope. */
export function usePg() {
  const { customer: c, tenantId, persona, toast } = useApp();
  const version = useSyncExternalStore(pgSubscribe, pgVersion);
  // version re-derives the list when the in-session store changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => initiatives(c, tenantId), [c, tenantId, version]);
  const me = signedIn(c, persona).name;
  const grcs = c.connectors.filter((k) => k.category === 'GRC');
  const grc = (grcs.find((k) => /grc|irm|risk|archer|servicenow|onetrust|comply|logicgate|metricstream|auditboard|drata|vanta|hyperproof/i.test(`${k.vendor} ${k.product}`)) ?? grcs.find((k) => !/awareness|phish|training/i.test(k.product)))?.product ?? 'HexaComply';
  const $ = (n: number) => fmtMoney(n, c.currency);
  return { c, tenantId, list, me, grc, toast, version, $ };
}

export function useWidth(fallback = 900) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function StatusPill({ s }: { s: PgStatus }) {
  return <span className="pg-pill" style={{ '--pc': STATUS_HEX[s] } as PC}>{s}</span>;
}
export function WsTag({ ws }: { ws: Initiative['ws'] }) {
  const w = WS_BY_ID[ws];
  return <span className="pg-ws" style={{ '--pc': w.hex } as PC}><i />{w.short}</span>;
}
export function Progress({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="pg-prog" title={`${pct}% complete`}>
      <span><i style={{ width: `${Math.max(2, pct)}%`, background: color }} /></span>
      <em>{pct}%</em>
    </span>
  );
}

/** Variance in % of budget, signed: positive = overspend. */
export function variance(i: { budget: number; forecast: number }) {
  return i.budget ? Math.round(((i.forecast - i.budget) / i.budget) * 100) : 0;
}
export function varColor(v: number) {
  return v > 10 ? 'var(--bad)' : v > 3 ? 'var(--sev-medium)' : 'var(--good)';
}

/** Owner select options derived from the initiatives in scope. */
export function ownersOf(list: Initiative[]) {
  return [...new Set(list.map((i) => i.owner.name))].sort();
}

/* =====================================================================
   Budget burn mini chart (cumulative planned vs actual vs forecast)
   ===================================================================== */
function BurnChart({ i, currency }: { i: Initiative; currency: string }) {
  const [ref, W] = useWidth(520);
  const H = 150;
  const pad = { l: 46, r: 10, t: 10, b: 22 };
  const m0 = i.start;
  const late = i.status === 'Late' && i.end <= TODAY_M;
  const m1 = Math.min(PG_MONTHS + 3, Math.max(i.end, late ? TODAY_M + 3 : i.end));
  const max = Math.max(i.budget, i.forecast) * 1.08;
  const X = (m: number) => pad.l + ((m - m0) / Math.max(1, m1 - m0)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const planned = `M${X(m0)},${Y(0)} L${X(i.end)},${Y(i.budget)}`;
  const tEnd = Math.min(TODAY_M, i.end);
  const hasActual = i.spent > 0 && tEnd > m0;
  // Actuals arrive lumpily (licences up front, services later): a gentle curve, not the plan line.
  const bow = i.spent > i.budget * Math.max(0, Math.min(1, (tEnd - m0) / Math.max(1, i.end - m0))) ? 0.75 : 1.35;
  const actual = hasActual ? Array.from({ length: 21 }, (_, k) => { const f = k / 20; return `${k ? 'L' : 'M'}${X(m0 + (tEnd - m0) * f).toFixed(1)},${Y(i.spent * Math.pow(f, bow)).toFixed(1)}`; }).join(' ') : '';
  const fEnd = late ? TODAY_M + 3 : i.end;
  const forecast = hasActual && i.status !== 'Complete' ? `M${X(tEnd)},${Y(i.spent)} L${X(fEnd)},${Y(i.forecast)}` : '';
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const months = Array.from({ length: Math.floor(m1 - m0) + 1 }, (_, k) => m0 + k).filter((_m, k, a) => a.length <= 8 || k % Math.ceil(a.length / 8) === 0);
  return (
    <div ref={ref}>
      <svg className="pg-svg" width={W} height={H} role="img" aria-label="Budget burn">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(t)} y2={Y(t)} className="gl" />
            <text x={pad.l - 6} y={Y(t) + 3.5} textAnchor="end" className="ax">{fmtMoney(t, currency)}</text>
          </g>
        ))}
        {months.map((m) => <text key={m} x={X(m)} y={H - 6} textAnchor="middle" className="ax">{monthLabel(m)}</text>)}
        <line x1={pad.l} x2={W - pad.r} y1={Y(i.budget)} y2={Y(i.budget)} stroke="#8593b4" strokeDasharray="2 3" />
        <path d={planned} stroke="#8593b4" strokeWidth={1.6} fill="none" />
        {actual && <path d={actual} stroke={PG_HEX} strokeWidth={2.4} fill="none" className="pg-draw" />}
        {forecast && <path d={forecast} stroke={i.forecast > i.budget * 1.03 ? '#f8646f' : PG_HEX} strokeWidth={2} strokeDasharray="5 4" fill="none" />}
        {TODAY_M > m0 && TODAY_M < m1 && <line x1={X(TODAY_M)} x2={X(TODAY_M)} y1={pad.t} y2={H - pad.b} stroke="#ef6aae" strokeWidth={1.2} />}
      </svg>
      <div className="pg-legend">
        <span><i style={{ background: '#8593b4' }} />Planned</span>
        <span><i style={{ background: PG_HEX }} />Actual</span>
        <span><i className="dash" style={{ borderColor: i.forecast > i.budget * 1.03 ? '#f8646f' : PG_HEX }} />Forecast</span>
        <span><i style={{ background: '#ef6aae' }} />Today</span>
      </div>
    </div>
  );
}
export const PG_HEX = '#818cf8';

/* =====================================================================
   Initiative drawer with in-session actions
   ===================================================================== */
export function InitiativeDrawer({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen?: (id: string) => void }) {
  const nav = useNavigate();
  const { c, list, me, toast, grc, $ } = usePg();
  const [modal, setModal] = useState<null | 'status' | 'risk' | 'change'>(null);
  const i = list.find((x) => x.id === id) ?? initiatives(c).find((x) => x.id === id);
  if (!i) return null;
  const w = WS_BY_ID[i.ws];
  const v = variance(i);
  const overdue = i.milestones.filter((m) => !m.done && m.m < TODAY_M);
  const open = (x: string) => (onOpen ? onOpen(x) : nav(`/programme/initiatives?id=${x}`));
  const tenant = i.tenantId === 'all' ? 'Group-wide' : c.tenants.find((t) => t.id === i.tenantId)?.name ?? i.tenantId;

  return (
    <Drawer
      wide
      title={<>{i.title}</>}
      sub={<span className="pg-dsub"><span className="mono">{i.id}</span><WsTag ws={i.ws} /><StatusPill s={i.status} /><span>{fmtDateShort(monthDate(i.start))} → {fmtDate(monthDate(i.end))}</span></span>}
      onClose={onClose}
      footer={
        <>
          <Btn primary color={PG_TONE} onClick={() => setModal('status')}><Flag size={14} /> Update status</Btn>
          <Btn onClick={() => setModal('risk')}><AlertTriangle size={14} /> Raise risk</Btn>
          <Btn onClick={() => setModal('change')}><GitPullRequestArrow size={14} /> Request change</Btn>
          <span className="spacer" />
          <Btn ghost onClick={() => nav(`/programme/roadmap?focus=${i.id}`)}>Show on roadmap <ArrowUpRight size={13} /></Btn>
        </>
      }
    >
      <div className="pg-dhero" style={{ '--pc': w.hex } as PC}>
        <Ring value={i.pct} size={78} stroke={8} color={STATUS_HEX[i.status]} sub="done" />
        <div className="pg-dstat"><b>{$(i.budget)}</b><span>Budget</span></div>
        <div className="pg-dstat"><b>{$(i.spent)}</b><span>Spent to date</span></div>
        <div className="pg-dstat"><b style={{ color: varColor(v) }}>{$(i.forecast)}</b><span>Forecast {v >= 0 ? '+' : ''}{v}%</span></div>
        <div className="pg-dstat"><b style={{ color: 'var(--good)' }}>+{i.riGain.toFixed(1)}</b><span>{i.status === 'Complete' ? 'RI delivered' : 'RI gain expected'}</span></div>
        <div className="pg-dstat"><b>{$(i.lossReduction)}</b><span>Loss reduction / yr</span></div>
      </div>
      <p className="pg-desc">{i.desc}</p>
      {i.note && <Callout>Latest update: {i.note}</Callout>}
      {overdue.length > 0 && <Callout kind="warn">{overdue.length} milestone{overdue.length === 1 ? '' : 's'} overdue: {overdue.map((m) => m.title).join('; ')}.</Callout>}

      <KV rows={[
        ['Owner', <>{i.owner.name} <span className="muted">· {i.owner.role}</span></>],
        ['Sponsor', <>{i.sponsor.name} <span className="muted">· {i.sponsor.role}</span></>],
        ['Scope', tenant],
        ['Frameworks', <span className="pg-links">{i.frameworks.map((f) => <button key={f.id} type="button" onClick={() => nav(`/comply/caas?section=frameworks&framework=${f.id}`)} title={`Open ${f.short} in HexaComply`}>{f.short} <ArrowUpRight size={11} /></button>)}</span>],
        ['NIST CSF 2.0', <span className="pg-links">{i.csf.map((k) => <button key={k} type="button" onClick={() => nav(`/programme/maturity?cat=${k}`)} title={CSF_CAT_BY_ID[k]?.label}>{k} <span className="muted">{CSF_CAT_BY_ID[k]?.label}</span></button>)}</span>],
        ['Capabilities', <span className="pg-links">{i.modules.map((m) => <button key={m.path} type="button" onClick={() => nav(m.path)}>{m.label} <ArrowUpRight size={11} /></button>)}</span>],
        ['Depends on', i.deps.length ? <span className="pg-links">{i.deps.map((d) => <button key={d} type="button" onClick={() => open(d)}><Link2 size={11} /> {d} · {list.find((x) => x.id === d)?.title ?? initiatives(c).find((x) => x.id === d)?.title}</button>)}</span> : <span className="muted">None</span>],
      ]} />

      <SectionLabel>Milestones</SectionLabel>
      <div className="pg-ms">
        {i.milestones.map((m) => {
          const late = !m.done && m.m < TODAY_M;
          return (
            <button key={m.id} type="button" className={`pg-msrow ${m.done ? 'done' : ''} ${late ? 'late' : ''}`} onClick={() => { pgToggleMilestone(c, i, m.id, !m.done, me); toast(`${m.title}: ${m.done ? 'reopened' : 'marked complete'} · synced to the ${grc} task`); }} title="Toggle complete (in-session)">
              {m.done ? <CheckSquare size={15} /> : <Square size={15} />}
              <span className="t">{m.title}{m.gate && <em>gate</em>}</span>
              <span className="d">{fmtDateShort(monthDate(m.m))}{late ? ' · overdue' : ''}</span>
            </button>
          );
        })}
      </div>

      <SectionLabel>Budget burn</SectionLabel>
      <BurnChart i={i} currency={c.currency} />
      <div className="muted" style={{ fontSize: 11.5 }}>Capex {Math.round(i.capexShare * 100)}% · opex {100 - Math.round(i.capexShare * 100)}% · actuals from finance cost centre, refreshed nightly</div>

      <SectionLabel>Risks and issues</SectionLabel>
      <div className="pg-list">
        {i.risks.map((r) => (
          <div key={r.id} className="pg-li" style={{ '--pc': r.level === 'High' ? '#f8646f' : r.level === 'Medium' ? '#f0a338' : '#8593b4' } as PC}>
            <i />
            <div><b>{r.title}</b><span>{r.level} · {r.mitigation}{r.raised ? ` · raised by ${r.by} this session` : ''}</span></div>
            <button type="button" className="pg-mini" onClick={() => nav(`/comply/caas?section=risks&q=${encodeURIComponent(r.title.split(':')[0].split(' ').slice(0, 3).join(' '))}`)}>Risk register <ArrowUpRight size={11} /></button>
          </div>
        ))}
        {i.issues.map((x, k) => (
          <div key={`iss-${k}`} className="pg-li" style={{ '--pc': '#f8646f' } as PC}><i /><div><b>Issue</b><span>{x}</span></div></div>
        ))}
        {!i.risks.length && !i.issues.length && <div className="muted" style={{ fontSize: 12 }}>No open risks or issues.</div>}
      </div>

      {i.changes.length > 0 && (
        <>
          <SectionLabel>Change requests</SectionLabel>
          <div className="pg-list">
            {i.changes.map((ch) => (
              <div key={ch.id} className="pg-li" style={{ '--pc': '#a07cfb' } as PC}><i /><div><b>{ch.id} · {ch.kind}: {ch.delta}</b><span>{ch.text} · {ch.status} at steering · {ch.by} · {fmtAgo((Date.now() - ch.at) / 60000)}</span></div></div>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Decisions</SectionLabel>
      <div className="pg-list">
        {i.decisions.length ? i.decisions.map((d, k) => (
          <div key={k} className="pg-li" style={{ '--pc': PG_HEX } as PC}><Gavel size={13} className="ic" /><div><b>{d.text}</b><span>{d.by} · {fmtDateShort(monthDate(d.when))}</span></div></div>
        )) : <div className="muted" style={{ fontSize: 12 }}>No decisions logged yet.</div>}
      </div>

      <SectionLabel>Evidence</SectionLabel>
      <div className="pg-list">
        {i.evidence.length ? i.evidence.map((e, k) => (
          <div key={k} className="pg-li" style={{ '--pc': '#2dd4bf' } as PC}><FileCheck2 size={13} className="ic" /><div><b>{e.title}</b><span>{e.source} · {e.ageDays} d old</span></div></div>
        )) : <div className="muted" style={{ fontSize: 12 }}>Evidence is collected as milestones close.</div>}
      </div>

      {modal === 'status' && <StatusModal i={i} onClose={() => setModal(null)} />}
      {modal === 'risk' && <RiskModal i={i} onClose={() => setModal(null)} />}
      {modal === 'change' && <ChangeModal i={i} onClose={() => setModal(null)} />}
    </Drawer>
  );
}

function StatusModal({ i, onClose }: { i: Initiative; onClose: () => void }) {
  const { c, me, toast, grc } = usePg();
  const [s, setS] = useState<PgStatus>(i.status);
  const [pct, setPct] = useState(i.pct);
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`Update ${i.id}`}
      sub={i.title}
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={PG_TONE} onClick={() => { pgUpdateStatus(c, i.id, s, s === 'Complete' ? 100 : pct, note.trim(), me); toast(`${i.id} → ${s} · ${s === 'Complete' ? 100 : pct}% · reflected on the roadmap, budget and maturity views; ${grc} task updated`); onClose(); }}>Save update</Btn></>}
    >
      <div className="pg-form">
        <label>Status</label>
        <div className="chips">{PG_STATUSES.map((x) => <button key={x} type="button" className={`chip ${x === s ? 'on' : ''}`} style={{ '--tone': STATUS_HEX[x] } as CSSProperties} onClick={() => setS(x)}>{x}</button>)}</div>
        <label>Percent complete: <b>{s === 'Complete' ? 100 : pct}%</b></label>
        <input type="range" min={0} max={100} step={5} value={s === 'Complete' ? 100 : pct} disabled={s === 'Complete'} onChange={(e) => setPct(Number(e.target.value))} style={{ accentColor: PG_HEX }} />
        <label>Note to steering committee</label>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" />
        <div className="muted" style={{ fontSize: 11.5 }}>Risk class: low (programme record only). No approval needed; the sponsor {i.sponsor.name} is notified.</div>
      </div>
    </Modal>
  );
}

function RiskModal({ i, onClose }: { i: Initiative; onClose: () => void }) {
  const { c, me, toast, grc } = usePg();
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<PgRisk['level']>('Medium');
  const [mit, setMit] = useState('');
  return (
    <Modal
      title={`Raise a risk on ${i.id}`}
      sub={i.title}
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={PG_TONE} disabled={!title.trim()} onClick={() => { pgRaiseRisk(c, i, title.trim(), level, mit.trim() || 'Mitigation to be agreed at steering', me); toast(`Risk raised on ${i.id} (${level}) and added to the ${grc} risk register; owner ${i.owner.name} notified`); onClose(); }}>Raise risk</Btn></>}
    >
      <div className="pg-form">
        <label>Risk</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Integrator resourcing slips wave 2" />
        <label>Level</label>
        <div className="chips">{(['High', 'Medium', 'Low'] as const).map((x) => <button key={x} type="button" className={`chip ${x === level ? 'on' : ''}`} onClick={() => setLevel(x)}>{x}</button>)}</div>
        <label>Mitigation</label>
        <textarea className="input" rows={2} value={mit} onChange={(e) => setMit(e.target.value)} placeholder="What will reduce it" />
      </div>
    </Modal>
  );
}

function ChangeModal({ i, onClose }: { i: Initiative; onClose: () => void }) {
  const { c, me, toast, $ } = usePg();
  const [kind, setKind] = useState<PgChange['kind']>('Schedule');
  const [text, setText] = useState('');
  const [amt, setAmt] = useState(kind === 'Budget' ? 10 : 1);
  const delta = kind === 'Budget' ? `+${$(i.budget * (amt / 100))} (+${amt}%)` : kind === 'Schedule' ? `+${amt} month${amt === 1 ? '' : 's'}` : 'scope adjusted';
  const approver = kind === 'Budget' && amt > 10 ? `${i.sponsor.name} and ${c.people.staff.find((p) => /cfo|finance/i.test(p.role))?.name ?? 'the CFO'}` : i.sponsor.name;
  return (
    <Modal
      title={`Request a change to ${i.id}`}
      sub={i.title}
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={PG_TONE} disabled={!text.trim()} onClick={() => { pgRequestChange(c, i, kind, text.trim(), delta, me); toast(`Change request on ${i.id} (${kind.toLowerCase()} ${delta}) sent to ${approver} for steering approval`); onClose(); }}>Submit request</Btn></>}
    >
      <div className="pg-form">
        <label>Change type</label>
        <div className="chips">{(['Schedule', 'Budget', 'Scope'] as const).map((x) => <button key={x} type="button" className={`chip ${x === kind ? 'on' : ''}`} onClick={() => { setKind(x); setAmt(x === 'Budget' ? 10 : 1); }}>{x}</button>)}</div>
        {kind !== 'Scope' && (
          <>
            <label>{kind === 'Budget' ? `Additional budget: ${amt}%` : `Extension: ${amt} month${amt === 1 ? '' : 's'}`}</label>
            <input type="range" min={1} max={kind === 'Budget' ? 40 : 6} value={amt} onChange={(e) => setAmt(Number(e.target.value))} style={{ accentColor: PG_HEX }} />
          </>
        )}
        <label>Justification</label>
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Why the change is needed and the impact if declined" />
        <Callout>Impact: {delta}. Approval: {approver}. {kind === 'Schedule' ? `Dependants (${initiatives(c).filter((x) => x.deps.includes(i.id)).map((x) => x.id).join(', ') || 'none'}) would shift too.` : kind === 'Budget' ? 'Programme contingency is drawn first.' : 'Linked controls and maturity targets are re-baselined.'}</Callout>
      </div>
    </Modal>
  );
}

/** Small "x of y" header stat used in cards. */
export function Stat({ value, label, color, onClick, source }: { value: ReactNode; label: ReactNode; color?: string; onClick?: () => void; source?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`pg-stat ${onClick ? 'link' : ''}`} onClick={onClick} title={source ? `Source: ${source}${onClick ? ' · click to open' : ''}` : undefined}>
      <b style={color ? { color } : undefined}>{value}</b>
      <span>{label}</span>
    </Tag>
  );
}
