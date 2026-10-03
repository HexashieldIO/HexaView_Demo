import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { Health, Severity } from '../data/types';
import { fmtAgo } from '../lib/format';

type ToneStyle = CSSProperties & { '--tone'?: string };
const tone = (t?: string): ToneStyle | undefined => (t ? { '--tone': t } : undefined);

/* ---------------- Card ---------------- */
export function Card({
  title, sub, count, actions, children, className = '', flush, tinted, toneColor, style, foot, onClick,
}: {
  title?: ReactNode; sub?: ReactNode; count?: ReactNode; actions?: ReactNode; children?: ReactNode;
  className?: string; flush?: boolean; tinted?: boolean; toneColor?: string; style?: CSSProperties; foot?: ReactNode; onClick?: () => void;
}) {
  return (
    <section className={`card ${flush ? 'flush' : ''} ${tinted ? 'tinted' : ''} ${onClick ? 'card-click' : ''} ${className}`} style={{ ...tone(toneColor), ...style }} onClick={onClick} role={onClick ? 'link' : undefined}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && (
              <h3 className="card-title">
                {title}
                {count !== undefined && <span className="count">{count}</span>}
              </h3>
            )}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
      {foot && <div className="card-foot">{foot}</div>}
    </section>
  );
}

/* ---------------- KPI strip ---------------- */
export interface KpiProps {
  label: string;
  hint?: string;
  value: ReactNode;
  unit?: ReactNode;
  bar?: number;
  toneColor?: string;
  delta?: { text: string; good: boolean };
  onClick?: () => void;
  /** Route to pivot to (e.g. '/soc/ir?status=open'). Headlines should always lead to their data. */
  to?: string;
  /** Tooltip naming the data source behind the number. */
  source?: string;
}
export function Kpi({ label, hint, value, unit, bar, toneColor, delta, onClick, to, source }: KpiProps) {
  const nav = useNavigate();
  const click = onClick ?? (to ? () => nav(to) : undefined);
  const Tag = click ? 'button' : 'div';
  return (
    <Tag className={`kpi ${click ? 'kpi-link' : ''}`} onClick={click} style={tone(toneColor)} title={source ? `Source: ${source}${click ? ' · click to open' : ''}` : click ? 'Click to open the records behind this number' : undefined}>
      <div className="kpi-label">
        {label}
        {hint && <em>{hint}</em>}
      </div>
      <div className="kpi-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {bar !== undefined && (
        <div className="kpi-bar">
          <i style={{ width: `${Math.max(2, Math.min(100, bar))}%` }} />
        </div>
      )}
      {delta && <div className={`kpi-delta ${delta.good ? 'up-good' : 'up-bad'}`}>{delta.text}</div>}
    </Tag>
  );
}
export function KpiStrip({ items, toneColor }: { items: KpiProps[]; toneColor?: string }) {
  return (
    <div className="kpi-strip" style={tone(toneColor)}>
      {items.map((k) => (
        <Kpi key={k.label} {...k} />
      ))}
    </div>
  );
}

/* ---------------- Badges ---------------- */
export function Badge({ children, color, solid, dot, title }: { children: ReactNode; color?: string; solid?: boolean; dot?: boolean; title?: string }) {
  return (
    <span className={`badge ${solid ? 'solid' : ''}`} style={tone(color)} title={title}>
      {dot && <i className="bdot" />}
      {children}
    </span>
  );
}

export const SEV_COLOR: Record<Severity, string> = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
  info: 'var(--sev-info)',
};
export const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function SevBadge({ sev, solid }: { sev: Severity; solid?: boolean }) {
  return (
    <Badge color={SEV_COLOR[sev]} solid={solid ?? (sev === 'critical')}>
      {cap(sev)}
    </Badge>
  );
}

export const HEALTH_COLOR: Record<Health, string> = {
  healthy: 'var(--good)',
  degraded: 'var(--sev-medium)',
  failing: 'var(--bad)',
  paused: 'var(--sev-info)',
};
export function HealthBadge({ status }: { status: Health }) {
  return (
    <Badge color={HEALTH_COLOR[status]} dot>
      {cap(status)}
    </Badge>
  );
}

/** Generic status pill with a colour map, e.g. <StatusBadge value="open" map={{open:'var(--bad)'}} /> */
export function StatusBadge({ value, map, fallback = 'var(--text-muted)' }: { value: string; map: Record<string, string>; fallback?: string }) {
  return (
    <Badge color={map[value] ?? fallback} dot>
      {cap(value.replace(/_/g, ' '))}
    </Badge>
  );
}

export function Chip({ children, on, onClick, color }: { children: ReactNode; on?: boolean; onClick?: () => void; color?: string }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className={`chip ${on ? 'on' : ''}`} onClick={onClick} style={tone(color)} type={onClick ? 'button' : undefined}>
      {children}
    </Tag>
  );
}

/** Source chips: which connectors feed a tile (degrade honestly, LLD 11.5). */
export function Sources({ items }: { items: { name: string; status?: Health }[] }) {
  return (
    <span className="chips">
      {items.map((s) => (
        <span key={s.name} className="src-chip" title={s.status ? `${s.name}: ${s.status}` : s.name}>
          <i style={{ background: HEALTH_COLOR[s.status ?? 'healthy'] }} />
          {s.name}
        </span>
      ))}
    </span>
  );
}

export function Freshness({ minutes, stale, label }: { minutes: number; stale?: boolean; label?: string }) {
  return (
    <span className={`freshness ${stale ? 'stale' : ''}`}>
      <i />
      {stale ? `Stale: ${label ?? 'source'} last synced ${fmtAgo(minutes)}` : `${label ? `${label} · ` : ''}as of ${fmtAgo(minutes)}`}
    </span>
  );
}

/* ---------------- Bars ---------------- */
export function Bar({ value, max = 100, color, size }: { value: number; max?: number; color?: string; size?: 'thin' | 'thick' }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar ${size ?? ''}`} style={tone(color)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stacked({ parts, tall, showLabels }: { parts: { value: number; color: string; label?: string }[]; tall?: boolean; showLabels?: boolean }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={`stacked ${tall ? 'tall' : ''}`}>
      {parts.filter((p) => p.value > 0).map((p, i) => {
        const pct = (p.value / total) * 100;
        return (
          <i key={i} style={{ width: `${pct}%`, background: p.color }} title={p.label ? `${p.label}: ${p.value}` : String(p.value)}>
            {tall && showLabels && pct > 7 ? `${Math.round(pct)}%` : null}
          </i>
        );
      })}
    </div>
  );
}

export function BarRow({ label, sub, value, max = 100, color, display }: { label: ReactNode; sub?: ReactNode; value: number; max?: number; color?: string; display?: ReactNode }) {
  return (
    <div className="bar-row">
      <div className="bar-label">
        <b>{label}</b>
        {sub && <span>{sub}</span>}
      </div>
      <Bar value={value} max={max} color={color} />
      <div className="bar-val">{display ?? value}</div>
    </div>
  );
}

export function Legend({ items }: { items: { label: ReactNode; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span key={i}>
          <i style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Ring gauge ---------------- */
export function Ring({
  value, max = 100, size = 64, stroke = 7, color = 'var(--accent)', label, sub, glow, track = 'var(--track)', children,
}: {
  value: number; max?: number; size?: number; stroke?: number; color?: string; label?: ReactNode; sub?: ReactNode; glow?: boolean; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="ring" style={{ width: size, height: size, filter: glow ? `drop-shadow(0 0 10px ${color})` : undefined }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="ring-val" style={{ fontSize: Math.round(size * 0.28) }}>
        <div>
          {children ?? label ?? Math.round(value)}
          {sub && <small>{sub}</small>}
        </div>
      </div>
    </div>
  );
}

export function GaugeTile({ value, color, label, sub, onClick, size = 76 }: { value: number; color: string; label: string; sub?: string; onClick?: () => void; size?: number }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="gauge-tile" onClick={onClick}>
      <Ring value={value} color={color} size={size} stroke={8} />
      <b>{label}</b>
      {sub && <span>{sub}</span>}
    </Tag>
  );
}

/* ---------------- Hex score ---------------- */
export function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
}

export function HexScore({ value, size = 96, color = 'var(--m-view)', sub = 'OF 100', gradient = true }: { value: number; size?: number; color?: string; sub?: string; gradient?: boolean }) {
  const s = size;
  const r = s / 2 - 6;
  const id = `hxg-${s}-${String(color).replace(/[^a-z0-9]/gi, '')}`;
  const perim = 6 * r;
  const pct = Math.max(0, Math.min(1, value / 100));
  return (
    <div className="hexscore" style={{ width: s, height: s }}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={gradient ? '#22d3ee' : color} />
            <stop offset="1" stopColor={gradient ? '#8b5cf6' : color} />
          </linearGradient>
        </defs>
        <path d={hexPath(s / 2, s / 2, r)} fill="color-mix(in srgb, var(--card-bg) 70%, transparent)" stroke="var(--track)" strokeWidth={6} strokeLinejoin="round" />
        <path d={hexPath(s / 2, s / 2, r)} fill="none" stroke={`url(#${id})`} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={perim} strokeDashoffset={perim * (1 - pct)} style={{ filter: `drop-shadow(0 0 8px ${gradient ? '#3b82f6' : color})`, transition: 'stroke-dashoffset 1s' }} />
      </svg>
      <div className="hs-val" style={{ fontSize: Math.round(s * 0.32) }}>
        <div>
          {Math.round(value)}
          <small>{sub}</small>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Misc ---------------- */
export function Callout({ children, kind = 'info', color }: { children: ReactNode; kind?: 'info' | 'warn' | 'good'; color?: string }) {
  const c = color ?? (kind === 'warn' ? 'var(--sev-medium)' : kind === 'good' ? 'var(--good)' : 'var(--accent)');
  const Icon = kind === 'warn' ? AlertTriangle : kind === 'good' ? CheckCircle2 : Info;
  return (
    <div className="callout" style={tone(c)}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}

export function MiniStat({ value, label, color }: { value: ReactNode; label: ReactNode; color?: string }) {
  return (
    <div className="mini-stat">
      <b style={color ? { color } : undefined}>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}

export function IcoBox({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="ico-box" style={tone(color)}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Btn({
  children, onClick, primary, sm, ghost, danger, disabled, color, title, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; primary?: boolean; sm?: boolean; ghost?: boolean; danger?: boolean; disabled?: boolean; color?: string; title?: string; type?: 'button' | 'submit';
}) {
  return (
    <button type={type} title={title} className={`btn ${primary ? 'primary' : ''} ${sm ? 'sm' : ''} ${ghost ? 'ghost' : ''} ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled} style={tone(color)}>
      {children}
    </button>
  );
}

/** Local tab switcher (inside a card). */
export function Tabs<T extends string>({ tabs, value, onChange, color }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; color?: string }) {
  return (
    <div className="chips" style={tone(color)}>
      {tabs.map((t) => (
        <Chip key={t.id} on={t.id === value} onClick={() => onChange(t.id)} color={color}>
          {t.label}
        </Chip>
      ))}
    </div>
  );
}

export function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button className="close-x" onClick={onClick} aria-label="Close">
      <X size={16} />
    </button>
  );
}

/** Key-value list used in drawers. */
export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface TimelineItem {
  time: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  color?: string;
}
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="timeline">
      {items.map((it, i) => (
        <div className="tl-item" key={i} style={tone(it.color)}>
          <div className="tl-time">{it.time}</div>
          <div className="tl-dot" />
          <div className="tl-body">
            <b>{it.title}</b>
            {it.body && <span>{it.body}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
