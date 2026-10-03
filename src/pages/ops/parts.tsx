import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X as XIcon } from 'lucide-react';
import { Drawer } from '../../components/Overlay';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { signedIn, LIFECYCLE_EDGES, LIFECYCLE_LAYOUT, LIFECYCLE_STATES, TERMINAL_BAD, type LifecycleState, type Me } from '../../data/modules/ops';
import './ops.css';

export const OPS_TONE = MODULE_BY_ID.ops.tone;

/** The signed-in persona as a HexaView user with a role. */
export function useMe(): Me {
  const { customer, persona } = useApp();
  return useMemo(() => signedIn(customer, persona), [customer, persona]);
}

/** Seconds since the page mounted, ticking every second (drives countdowns). */
export function useSeconds(): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return s;
}

export function Switch({ on, onChange, disabled, title, color }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; title?: string; color?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      disabled={disabled}
      className={`ops-switch ${on ? 'on' : ''}`}
      style={color ? ({ '--tone': color } as CSSProperties) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!on);
      }}
    />
  );
}

/** "3 h 12 m 05 s" style countdown from seconds remaining. */
export function fmtCountdown(sec: number): string {
  const neg = sec < 0;
  const s = Math.abs(Math.round(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const body = d > 0 ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return neg ? `-${body}` : body;
}

export function shortHash(h: string, n = 8): string {
  return `${h.slice(0, n)}…${h.slice(-4)}`;
}

/** Tiny Rego highlighter: comments, keywords, strings. */
export function CodeBlock({ code }: { code: string }) {
  const lines = code.split('\n');
  const kw = /\b(package|import|default|if|contains|some|in|not|count|allow|deny|every)\b/g;
  return (
    <pre className="ops-code">
      {lines.map((ln, i) => {
        const ci = ln.indexOf('#');
        const codePart = ci >= 0 ? ln.slice(0, ci) : ln;
        const comment = ci >= 0 ? ln.slice(ci) : '';
        const parts: ReactNode[] = [];
        let last = 0;
        const re = new RegExp(`${kw.source}|("[^"]*")`, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(codePart))) {
          if (m.index > last) parts.push(codePart.slice(last, m.index));
          parts.push(
            <span key={m.index} className={m[0].startsWith('"') ? 's' : 'k'}>
              {m[0]}
            </span>,
          );
          last = m.index + m[0].length;
        }
        parts.push(codePart.slice(last));
        return (
          <div key={i}>
            {parts}
            {comment && <span className="c">{comment}</span>}
            {!ln && ' '}
          </div>
        );
      })}
    </pre>
  );
}

/** SVG state machine for the action lifecycle (LLD 8.4), highlighting the current state. */
export function LifecycleDiagram({ current, visited, onPick }: { current?: LifecycleState; visited?: LifecycleState[]; onPick?: (s: LifecycleState) => void }) {
  const W = 120;
  const H = 30;
  const X = (col: number) => 10 + col * 140;
  const Y = (row: number) => 16 + row * 62;
  const anchor = (s: LifecycleState, side: 'r' | 'l' | 't' | 'b') => {
    const [c, r] = LIFECYCLE_LAYOUT[s];
    if (side === 'r') return [X(c) + W, Y(r) + H / 2];
    if (side === 'l') return [X(c), Y(r) + H / 2];
    if (side === 't') return [X(c) + W / 2, Y(r)];
    return [X(c) + W / 2, Y(r) + H];
  };
  const seen = new Set(visited ?? []);
  return (
    <svg className="ops-lc" viewBox="0 0 990 168" role="img" aria-label="Action lifecycle state machine">
      <defs>
        <marker id="ops-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
        </marker>
        <marker id="ops-arr-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--good)" />
        </marker>
      </defs>
      {LIFECYCLE_EDGES.map(([a, b]) => {
        const [ca, ra] = LIFECYCLE_LAYOUT[a];
        const [cb, rb] = LIFECYCLE_LAYOUT[b];
        let p1: number[];
        let p2: number[];
        if (ra === rb) {
          p1 = anchor(a, cb > ca ? 'r' : 'l');
          p2 = anchor(b, cb > ca ? 'l' : 'r');
        } else if (rb > ra) {
          p1 = anchor(a, 'b');
          p2 = anchor(b, 't');
        } else {
          p1 = anchor(a, 't');
          p2 = anchor(b, 'b');
        }
        const on = seen.has(a) && (seen.has(b) || current === b);
        return <line key={`${a}-${b}`} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={on ? 'var(--good)' : 'var(--card-border)'} strokeWidth={on ? 2 : 1.3} markerEnd={`url(#${on ? 'ops-arr-on' : 'ops-arr'})`} />;
      })}
      {LIFECYCLE_STATES.map((s) => {
        const [c, r] = LIFECYCLE_LAYOUT[s];
        const bad = TERMINAL_BAD.includes(s);
        const isCur = current === s;
        const wasSeen = seen.has(s) && !isCur;
        const fill = isCur ? 'var(--m-ops)' : wasSeen ? 'color-mix(in srgb, var(--good) 22%, var(--card-bg))' : 'var(--surface-sunken)';
        const stroke = isCur ? 'var(--m-ops)' : wasSeen ? 'var(--good)' : bad ? 'color-mix(in srgb, var(--bad) 45%, var(--card-border))' : 'var(--card-border)';
        return (
          <g key={s} className={`node ${isCur ? 'cur' : ''}`} onClick={onPick ? () => onPick(s) : undefined} style={{ cursor: onPick ? 'pointer' : undefined }}>
            <rect x={X(c)} y={Y(r)} width={W} height={H} rx={8} fill={fill} stroke={stroke} strokeWidth={isCur ? 2 : 1.2} />
            <text x={X(c) + W / 2} y={Y(r) + H / 2 + 4} textAnchor="middle" fill={isCur ? '#fff' : bad ? 'var(--text-muted)' : 'var(--text-primary)'}>
              {s}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* =====================================================================
   Crisp HTML visuals and pivots (Phase 2): every number leads to its data
   ===================================================================== */

/** A filter carried in the URL (?key=value) so KPIs can pivot with `to`. */
export function useParamFilter(key: string): [string | null, (v: string | null) => void] {
  const [sp, setSp] = useSearchParams();
  const v = sp.get(key);
  const set = (nv: string | null) => {
    const n = new URLSearchParams(sp);
    if (nv === null) n.delete(key);
    else n.set(key, nv);
    setSp(n, { replace: true });
  };
  return [v, set];
}

/** Active-filter chip shown in a card header; click to clear. */
export function FilterChip({ label, onClear }: { label?: string | null; onClear: () => void }) {
  if (!label) return null;
  return (
    <button type="button" className="ops-fchip" onClick={onClear} title="Clear filter">
      {label} <XIcon size={11} />
    </button>
  );
}

export interface HBarItem {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  value: number;
  display?: ReactNode;
  color?: string;
  onClick?: () => void;
  active?: boolean;
}
/** Crisp HTML horizontal bars (v2 style): label left, fine bar, number right. Every row can pivot. */
export function HBars({ items, max, color = 'var(--m-ops)', labelWidth = 150 }: { items: HBarItem[]; max?: number; color?: string; labelWidth?: number }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="ops-hbars" style={{ '--lw': `${labelWidth}px` } as CSSProperties}>
      {items.map((it) => {
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag key={it.key} type={it.onClick ? 'button' : undefined} className={`ops-hbar ${it.onClick ? 'link' : ''} ${it.active ? 'on' : ''}`} onClick={it.onClick} title={it.onClick ? 'Open the records behind this bar' : undefined}>
            <span className="l">
              <b>{it.label}</b>
              {it.sub && <em>{it.sub}</em>}
            </span>
            <span className="t">
              <i style={{ width: `${Math.max(1.5, (it.value / m) * 100)}%`, background: it.color ?? color }} />
            </span>
            <span className="v">{it.display ?? it.value}</span>
          </Tag>
        );
      })}
    </div>
  );
}

/** Segmented bar with a clickable legend underneath (replaces donuts: no text on marks). */
export function SegBreakdown({ parts, total, totalLabel, onPick, active }: {
  parts: { key: string; label: string; value: number; color: string }[];
  total?: number;
  totalLabel?: string;
  onPick?: (key: string) => void;
  active?: string | null;
}) {
  const sum = total ?? parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="ops-seg">
      {totalLabel && (
        <div className="ops-seg-total">
          <b>{sum.toLocaleString('en-GB')}</b>
          <span>{totalLabel}</span>
        </div>
      )}
      <div className="ops-seg-bar">
        {parts.filter((p) => p.value > 0).map((p) => (
          <i key={p.key} style={{ flexGrow: p.value, background: p.color, opacity: active && active !== p.key ? 0.3 : 1 }} title={`${p.label}: ${p.value}`} onClick={onPick ? () => onPick(p.key) : undefined} />
        ))}
      </div>
      <div className="ops-seg-legend">
        {parts.map((p) => {
          const Tag = onPick ? 'button' : 'div';
          return (
            <Tag key={p.key} type={onPick ? 'button' : undefined} className={`ops-seg-row ${onPick ? 'link' : ''} ${active === p.key ? 'on' : ''}`} onClick={onPick ? () => onPick(p.key) : undefined}>
              <i style={{ background: p.color }} />
              <span>{p.label}</span>
              <b>{p.value.toLocaleString('en-GB')}</b>
              <em>{sum ? Math.round((p.value / sum) * 100) : 0}%</em>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

/** A big clickable number with a caption (stat blocks inside cards). */
export function StatLink({ value, label, color, onClick, source }: { value: ReactNode; label: ReactNode; color?: string; onClick?: () => void; source?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`ops-stat ${onClick ? 'link' : ''}`} onClick={onClick} title={source ? `Source: ${source}${onClick ? ' · click to open' : ''}` : undefined}>
      <b style={color ? { color } : undefined}>{value}</b>
      <span>{label}</span>
    </Tag>
  );
}

export interface RecordRow {
  key: string;
  main: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  color?: string;
}
/** Generic records drawer: the rows behind a number, with the source connector named. */
export function RecordsDrawer({ title, sub, source, rows, onClose }: { title: ReactNode; sub?: ReactNode; source: string; rows: RecordRow[]; onClose: () => void }) {
  return (
    <Drawer title={title} sub={sub ?? `${rows.length} records`} onClose={onClose} wide>
      <div className="ops-src-line">
        Source: <b>{source}</b>
      </div>
      <div className="ops-recs">
        {rows.map((r) => (
          <div key={r.key} className="ops-rec" style={r.color ? ({ '--tone': r.color } as CSSProperties) : undefined}>
            <div style={{ minWidth: 0 }}>
              <div className="m">{r.main}</div>
              {r.meta && <div className="s">{r.meta}</div>}
            </div>
            {r.right && <div className="r">{r.right}</div>}
          </div>
        ))}
        {!rows.length && <div className="muted" style={{ padding: 12 }}>No records in scope.</div>}
      </div>
    </Drawer>
  );
}

/** Records-drawer state helper: open with a spec, close with null. */
export interface RecordsSpec {
  title: ReactNode;
  sub?: ReactNode;
  source: string;
  rows: RecordRow[];
}
export function useRecords(): [RecordsSpec | null, (s: RecordsSpec | null) => void, ReactNode] {
  const [spec, setSpec] = useState<RecordsSpec | null>(null);
  const node = spec ? <RecordsDrawer {...spec} onClose={() => setSpec(null)} /> : null;
  return [spec, setSpec, node];
}

/** Scroll a card into view after an in-page pivot. */
export function scrollToId(id: string) {
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
}
