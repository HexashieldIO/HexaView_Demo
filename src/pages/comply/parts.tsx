import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Overlay';
import { Badge, Btn, Callout, KV } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { L_LABELS, riskLevel, type RiskItem } from '../../data/modules/comply';
import './comply.css';
import './comply-v2.css';

export const RISK_CLASS_COLOR = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--bad)' } as const;
export type RiskClass = keyof typeof RISK_CLASS_COLOR;

/** Write-back confirmation (LLD 8.2): what will change, risk class, approvals. */
export function WriteBackModal({
  title, target, changes, risk, approvals, onClose, onSubmit, submitLabel = 'Submit', children, tone = 'var(--m-comply)',
}: {
  title: string; target: string; changes: [ReactNode, ReactNode][]; risk: RiskClass; approvals: string;
  onClose: () => void; onSubmit: () => void; submitLabel?: string; children?: ReactNode; tone?: string;
}) {
  return (
    <Modal
      title={title}
      sub={<>Write-back to <b>{target}</b></>}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary color={tone} onClick={onSubmit}>{submitLabel}</Btn>
        </>
      }
    >
      <div className="row wrap" style={{ gap: 8 }}>
        <Badge color={RISK_CLASS_COLOR[risk]} dot>Risk class: {risk}</Badge>
        <Badge color="var(--accent)">{approvals}</Badge>
        <Badge>Audited · hash-chained</Badge>
      </div>
      <div>
        <div className="section-label">What will change</div>
        <KV rows={changes} />
      </div>
      {children}
      <Callout>
        Every write-back is signed, recorded in the audit ledger and verified against the target system after it is applied.
      </Callout>
    </Modal>
  );
}

/** Small controlled form field. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="comply-modal-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/** "Request evidence from owner" modal used on Caas and in the loop drawer. */
export function RequestEvidenceModal({ what, owner, ownerEmail, control, onClose, onDone }: { what: string; owner: string; ownerEmail?: string; control: string; onClose: () => void; onDone?: (due: string) => void }) {
  const { toast } = useApp();
  const [due, setDue] = useState('7');
  const [note, setNote] = useState(`Please upload ${what.toLowerCase()} for ${control}.`);
  return (
    <WriteBackModal
      title="Request evidence from owner"
      target="HexaComply"
      risk="low"
      approvals="No approval needed"
      submitLabel="Send request"
      onClose={onClose}
      onSubmit={() => {
        toast(`Evidence request sent to ${owner} · due in ${due} days · ${control}`);
        onDone?.(due);
        onClose();
      }}
      changes={[
        ['Evidence task', what],
        ['Control', control],
        ['Assignee', <>{owner}{ownerEmail && <span className="muted"> · {ownerEmail}</span>}</>],
        ['Notification', 'Email and Teams/Slack via HexaComply'],
      ]}
    >
      <div className="grid g2" style={{ gap: 10 }}>
        <Field label="Due in">
          <select className="select" value={due} onChange={(e) => setDue(e.target.value)}>
            {['3', '7', '14', '30'].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </Field>
        <Field label="Escalate to">
          <select className="select" defaultValue="grc">
            <option value="grc">GRC lead after due date</option>
            <option value="ciso">CISO after 7 days overdue</option>
          </select>
        </Field>
      </div>
      <Field label="Message">
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </WriteBackModal>
  );
}

export function riskScoreColor(score: number): string {
  const l = riskLevel(score);
  return l === 'High' ? 'var(--sev-critical)' : l === 'Medium' ? 'var(--sev-medium)' : 'var(--good)';
}

/* =====================================================================
   Original-style visual primitives (crisp HTML/SVG, no text on marks)
   ===================================================================== */

export interface BandItem {
  ac: string;
  word?: string;
  value: ReactNode;
  unit?: ReactNode;
  gauge?: number;
  to?: string;
  onClick?: () => void;
  source?: string;
  active?: boolean;
  color?: string;
}
/** The original "metric band": headline blocks that open their register pre-filtered. */
export function MetricBand({ items, tone = 'var(--m-comply)' }: { items: BandItem[]; tone?: string }) {
  const nav = useNavigate();
  return (
    <section className="comply-band" style={{ '--product': tone } as CSSProperties}>
      {items.map((m) => {
        const click = m.onClick ?? (m.to ? () => nav(m.to!) : undefined);
        return (
          <button key={m.ac + (m.word ?? '')} type="button" className={`comply-band-item ${m.active ? 'active' : ''}`} onClick={click} title={`${m.source ? `Source: ${m.source} · ` : ''}click to open the records behind this number`}>
            <div className="comply-band-top"><span className="comply-band-ac">{m.ac}</span>{m.word && <span className="comply-band-word">{m.word}</span>}</div>
            <div className="comply-band-val"><span className="comply-band-num" style={m.color ? { color: m.color } : undefined}>{m.value}</span>{m.unit && <span className="comply-band-u">{m.unit}</span>}</div>
            {m.gauge !== undefined && <div className="comply-band-gauge"><i style={{ width: `${Math.max(2, Math.min(100, m.gauge))}%` }} /></div>}
          </button>
        );
      })}
    </section>
  );
}

/** Segmented ring gauge (SVG, crisp), with the headline figure in the centre hole. */
export function SegRing({ parts, size = 132, stroke = 14, center, sub }: { parts: { value: number; color: string; label: string }[]; size?: number; stroke?: number; center: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const gap = parts.filter((p) => p.value > 0).length > 1 ? 3 : 0;
  let off = 0;
  return (
    <div className="comply-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {parts.map((p) => {
          if (p.value <= 0) return null;
          const len = Math.max(0, (p.value / total) * circ - gap);
          const el = (
            <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <title>{`${p.label}: ${p.value}`}</title>
            </circle>
          );
          off += (p.value / total) * circ;
          return el;
        })}
      </svg>
      <div className="comply-ring-c">
        <b>{center}</b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/** Horizontal segmented bar (no labels on marks unless the segment is wide). */
export function SegBar({ parts, height = 26, onPick, labels = true }: { parts: { key: string; value: number; color: string; label: string }[]; height?: number; onPick?: (key: string) => void; labels?: boolean }) {
  return (
    <span className="comply-segbar" style={{ height }}>
      {parts.filter((p) => p.value > 0).map((p) => (
        <span key={p.key} className={`comply-seg ${onPick ? 'click' : ''}`} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${p.value}`}
          onClick={onPick ? (e) => { e.stopPropagation(); onPick(p.key); } : undefined}>
          {labels && <b>{p.value}</b>}
        </span>
      ))}
    </span>
  );
}

/** Original likelihood × impact grid. Shading scales with the count, which is always written in the cell. */
export function HeatGrid({ items, mode, selected, onPick, tone = 'var(--m-comply)' }: { items: RiskItem[]; mode: 'inherent' | 'residual'; selected?: [number, number] | null; onPick: (cell: [number, number] | null) => void; tone?: string }) {
  const cell = (l: number, i: number) => items.filter((x) => { const v = x[mode]; return v && v.l === l && v.i === i; }).length;
  let max = 1;
  for (let l = 1; l <= 5; l++) for (let i = 1; i <= 5; i++) max = Math.max(max, cell(l, i));
  return (
    <div className="comply-heatx">
      <span className="comply-heatx-y">Likelihood</span>
      <div className="comply-heatx-grid">
        {[5, 4, 3, 2, 1].map((l) => (
          <div key={l} className="comply-heatx-row">
            <span className="comply-heatx-tick">{L_LABELS[l - 1]}</span>
            {[1, 2, 3, 4, 5].map((i) => {
              const n = cell(l, i);
              const on = !!selected && selected[0] === l && selected[1] === i;
              const zone = riskLevel(l * i * 4);
              const zc = zone === 'High' ? 'var(--sev-critical)' : zone === 'Medium' ? 'var(--sev-medium)' : 'var(--good)';
              return (
                <button key={i} type="button" className={`comply-heatx-cell ${n ? 'hot' : 'empty'} ${on ? 'on' : ''}`}
                  style={{ '--heat': n / max, '--zone': zc, '--tone': tone } as CSSProperties}
                  onClick={() => n && onPick(on ? null : [l, i])} title={`${L_LABELS[l - 1]} likelihood × ${L_LABELS[i - 1].toLowerCase()} impact: ${n} risk${n === 1 ? '' : 's'} (${zone} zone)`}>
                  {n || ''}
                </button>
              );
            })}
          </div>
        ))}
        <div className="comply-heatx-row">
          <span />
          {L_LABELS.map((x) => <span key={x} className="comply-heatx-xt">{x}</span>)}
        </div>
      </div>
      <span />
      <span className="comply-heatx-x">Impact</span>
    </div>
  );
}

/** Inherent → residual shift row (dot-and-link, original "risk posture"). */
export function ShiftRow({ name, from, to, max, onClick, colors = ['#2e6fdb', '#c2590b'] }: { name: string; from: number; to: number; max: number; onClick?: () => void; colors?: [string, string] }) {
  const d = to - from;
  const p1 = from / Math.max(1, max);
  const p2 = to / Math.max(1, max);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="comply-shift" onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className="comply-shift-name">{name}</span>
      <span className="comply-shift-track">
        <span className="comply-shift-link" style={{ left: `calc(${Math.min(p1, p2)} * (100% - 11px) + 5.5px)`, width: `calc(${Math.abs(p2 - p1)} * (100% - 11px))` }} />
        <span className="comply-shift-dot" style={{ left: `calc(${p1} * (100% - 11px))`, background: colors[0] }} />
        <span className="comply-shift-dot" style={{ left: `calc(${p2} * (100% - 11px))`, background: colors[1] }} />
      </span>
      <span className="comply-shift-vals"><b>{from}</b><i>→</i><b>{to}</b><em className={d < 0 ? 'down' : d > 0 ? 'up' : ''}>{d > 0 ? '+' : ''}{d}</em></span>
    </Tag>
  );
}

/** Original attention / exclusions row list. */
export function CapRow({ title, meta, badges, onClick }: { title: ReactNode; meta?: ReactNode; badges?: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="comply-cap-row" onClick={onClick}>
      <span className="comply-cap-main"><b>{title}</b>{meta && <span>{meta}</span>}</span>
      {badges && <span className="comply-cap-badges">{badges}</span>}
    </button>
  );
}

/** Square-dot legend item that can act as a filter. */
export function StateKey({ color, label, n, onClick, on }: { color: string; label: ReactNode; n?: ReactNode; onClick?: () => void; on?: boolean }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`comply-key ${onClick ? 'click' : ''} ${on ? 'on' : ''}`} onClick={onClick}>
      <i style={{ background: color }} />
      <span>{label}</span>
      {n !== undefined && <b>{n}</b>}
    </Tag>
  );
}

/** Filter facet row: label + chips. */
export function Facet<T extends string>({ label, value, options, onChange, all = 'All' }: { label: string; value: T | 'all'; options: { id: T; label: ReactNode; n?: number }[]; onChange: (v: T | 'all') => void; all?: string }) {
  return (
    <div className="comply-facet">
      <span className="comply-facet-l">{label}</span>
      <div className="comply-facet-opts">
        <button type="button" className={`comply-fchip ${value === 'all' ? 'on' : ''}`} onClick={() => onChange('all')}>{all}</button>
        {options.map((o) => (
          <button key={o.id} type="button" className={`comply-fchip ${value === o.id ? 'on' : ''}`} onClick={() => onChange(value === o.id ? 'all' : o.id)}>
            {o.label}{o.n !== undefined && <em>{o.n}</em>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Impact dots 1–3 for BIA. */
export function ImpactDots({ v, max = 3 }: { v: number; max?: number }) {
  return (
    <span className="comply-idots">
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < v ? (v >= 3 ? 'hi' : v === 2 ? 'mid' : 'lo') : ''} />)}
    </span>
  );
}
