import type { CSSProperties, ReactNode } from 'react';
import { Plus, ListChecks } from 'lucide-react';
import { TP_LEVEL_COLOR, tpLevelOf, type TpGap, type TpSupplier } from '../../../data/modules/tprm';
import { useTprm } from './state';
import './tprm.css';

type TC = CSSProperties & { '--tc'?: string };

export function scoreColor(score: number): string {
  return TP_LEVEL_COLOR[tpLevelOf(score)];
}

export function Mono({ s, size }: { s: { mono: string }; size?: 'sm' | 'lg' }) {
  return <span className={`tp-mono ${size ?? ''}`}>{s.mono}</span>;
}

export function SupplierCell({ s, sub }: { s: TpSupplier; sub?: ReactNode }) {
  return (
    <span className="tp-sup">
      <Mono s={s} />
      <span style={{ minWidth: 0 }}>
        <div className="tp-sup-name">{s.name}</div>
        <div className="tp-sup-sub">{sub ?? <>{s.id} · {s.contact}</>}</div>
      </span>
    </span>
  );
}

export function ScoreBar({ score, color }: { score: number; color?: string }) {
  const col = color ?? scoreColor(score);
  return (
    <span className="tp-score" title="Risk score · higher is worse">
      <b style={{ color: col }}>{score}</b>
      <span className="tp-score-bar"><i style={{ width: `${Math.max(3, score)}%`, background: col }} /></span>
    </span>
  );
}

export function Pill({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return <span className="tp-pill" style={{ '--tc': color } as TC} title={title}>{children}</span>;
}

export function Tag({ color, children }: { color?: string; children: ReactNode }) {
  return <span className="tp-tag" style={color ? ({ '--tc': color } as TC) : undefined}>{children}</span>;
}

export const SCOPE_COLOR = (t: string): string =>
  t === 'Critical' ? 'var(--sev-high)' : /DORA|HIPAA|TISAX|TPN|IEC|IACS|FDA|R155/.test(t) ? 'var(--m-comply)' : /GDPR|CCPA/.test(t) ? 'var(--m-matrix)' : 'var(--sev-info)';

export function ScopeTags({ s }: { s: TpSupplier }) {
  if (!s.inScope.length) return <span className="tp-muted">—</span>;
  return <span className="tp-tags">{s.inScope.map((t) => <Tag key={t} color={SCOPE_COLOR(t)}>{t}</Tag>)}</span>;
}

export function Facet<T extends string>({ label, value, options, onChange, all = 'All' }: { label: string; value: T | 'all'; options: { id: T; label: ReactNode; n?: number }[]; onChange: (v: T | 'all') => void; all?: string | null }) {
  return (
    <div className="tp-facet">
      <span className="tp-facet-l">{label}</span>
      <div className="tp-facet-opts">
        {all !== null && <button type="button" className={`tp-fchip ${value === 'all' ? 'on' : ''}`} onClick={() => onChange('all')}>{all}</button>}
        {options.map((o) => (
          <button key={o.id} type="button" className={`tp-fchip ${value === o.id ? 'on' : ''}`} onClick={() => onChange(value === o.id ? 'all' : o.id)}>
            {o.label}{o.n !== undefined && <em>{o.n}</em>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FacetSelect({ label, value, options, onChange, all }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; all: string }) {
  return (
    <div className="tp-facet">
      <span className="tp-facet-l">{label}</span>
      <select className="tp-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">{all}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Original REGISTER / STATE tiles. */
export function Tiles({ items }: { items: { ac: string; word: string; value: ReactNode; unit?: string; on?: boolean; onClick: () => void; color?: string; bar?: number; source: string }[] }) {
  return (
    <div className="tp-tiles">
      {items.map((t) => (
        <button key={t.ac + t.word} type="button" className={`tp-tile ${t.on ? 'on' : ''}`} onClick={t.onClick} title={`Source: ${t.source} · click to filter`}>
          <span className="tp-tile-top"><span className="tp-tile-ac">{t.ac}</span><span className="tp-tile-word">{t.word}</span></span>
          <span className="tp-tile-val"><span className="tp-tile-num" style={t.color && !t.on ? { color: t.color } : undefined}>{t.value}</span>{t.unit && <span className="tp-tile-u">{t.unit}</span>}</span>
          {t.bar !== undefined && <span className="tp-tile-bar"><i style={{ width: `${Math.max(2, Math.min(100, t.bar))}%`, background: t.color ?? 'var(--m-comply)' }} /></span>}
        </button>
      ))}
    </div>
  );
}

/** Crisp SVG score ring (higher is worse). */
export function ScoreRing({ score, size = 112, stroke = 11, sub }: { score: number; size?: number; stroke?: number; sub?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, score)) / 100) * circ;
  const col = scoreColor(score);
  return (
    <div className="tp-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${len} ${circ - len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="tp-ring-c"><b style={{ color: col }}>{score}</b>{sub && <span>{sub}</span>}</div>
    </div>
  );
}

/** Gap card with Raise a task / On the task list. */
export function GapCard({ gap, showSupplier, mono }: { gap: TpGap; showSupplier?: boolean; mono?: string }) {
  const { taskFor, raise, go } = useTprm();
  const t = taskFor(gap.key);
  return (
    <div className="tp-gap">
      <div className="tp-gap-dom">
        {showSupplier && <><span className="tp-mono sm">{mono}</span><span style={{ color: 'var(--text-primary)', letterSpacing: 0, textTransform: 'none', fontSize: 12 }}>{gap.supplierName}</span><span className="tp-muted">·</span></>}
        {gap.domain}
      </div>
      <div className="tp-gap-body"><b>{gap.title}</b><span>{gap.guidance}</span></div>
      <div>
        {t ? (
          <span className="tp-onlist"><ListChecks size={13} /> On the task list · <button type="button" onClick={() => go('tasks', { task: t.id })}>{t.id}</button></span>
        ) : (
          <button type="button" className="tp-raise" onClick={() => raise(gap)}><Plus size={13} /> Raise a task</button>
        )}
      </div>
    </div>
  );
}

export function SubTabs() {
  const { section, go, tasks, qas } = useTprm();
  const counts: Record<string, number | undefined> = {
    questionnaires: qas.length,
    tasks: tasks.filter((t) => !t.done).length,
  };
  const SECTIONS = [
    ['suppliers', 'Suppliers'], ['questionnaires', 'Questionnaires'], ['exposure', 'Exposure'], ['tasks', 'Tasks'], ['changelog', 'Change Log'],
  ] as const;
  return (
    <nav className="tp-subtabs" aria-label="Third-party risk sections">
      {SECTIONS.map(([id, label]) => (
        <button key={id} type="button" className={`tp-subtab ${section === id ? 'on' : ''}`} onClick={() => go(id)}>
          {label}{counts[id] !== undefined && <em>{counts[id]}</em>}
        </button>
      ))}
    </nav>
  );
}

export function fmtDays(d: number | null): { text: string; color: string } {
  if (d === null) return { text: '', color: 'var(--text-muted)' };
  if (d < 0) return { text: `${-d}d overdue`, color: 'var(--bad)' };
  if (d <= 3) return { text: `${d}d left`, color: 'var(--sev-high)' };
  if (d <= 14) return { text: `${d}d left`, color: 'var(--sev-medium)' };
  return { text: `${d}d left`, color: 'var(--good)' };
}
