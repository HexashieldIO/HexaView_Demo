import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './datepicker.css';

/**
 * Themed date field with a calendar pop-up, used in place of the native
 * <input type="date"> (whose picker icon is near-invisible on the dark theme).
 * Value is an ISO date string 'YYYY-MM-DD' ('' when empty), like the native input.
 */
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string | undefined) => {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function DatePicker({ value, onChange, min, max, placeholder = 'Select a date', className = '', clearable = true, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
  ariaLabel?: string;
}) {
  const sel = fromIso(value);
  const minD = fromIso(min);
  const maxD = fromIso(max);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => sel ?? new Date());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setView(sel ?? minD ?? new Date()); }, [open]);

  // Place the pop-up under the field (or above it when there is no room), kept on screen.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const w = 296, h = pop.current?.offsetHeight ?? 340;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
      const below = r.bottom + 6;
      const top = below + h > window.innerHeight - 12 && r.top - h - 6 > 12 ? r.top - h - 6 : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const y = view.getFullYear(), mo = view.getMonth();
  const first = new Date(y, mo, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const days = Array.from({ length: 42 }, (_, i) => new Date(y, mo, 1 - lead + i));
  const todayIso = toIso(new Date());
  const disabled = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD);
  const pick = (d: Date) => { if (disabled(d)) return; onChange(toIso(d)); setOpen(false); btn.current?.focus(); };
  const shift = (n: number) => setView(new Date(y, mo + n, 1));

  return (
    <>
      <button ref={btn} type="button" className={`input dp-field ${className}`} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)}>
        <span className={sel ? 'dp-val' : 'dp-ph'}>{sel ? fmt(sel) : placeholder}</span>
        {clearable && sel && (
          <span className="dp-clear" role="button" tabIndex={-1} aria-label="Clear date" onClick={(e) => { e.stopPropagation(); onChange(''); }}><X size={14} /></span>
        )}
        <CalendarDays size={16} className="dp-ico" />
      </button>
      {open && createPortal(
        <div ref={pop} className="dp-pop" role="dialog" aria-label="Choose a date" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <div className="dp-title">{MONTHS[mo]} {y}</div>
            <button type="button" className="dp-nav" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="dp-grid">
            {DOW.map((d) => <div key={d} className="dp-dow">{d}</div>)}
            {days.map((d) => {
              const iso = toIso(d);
              const cls = ['dp-day', d.getMonth() !== mo && 'is-out', iso === todayIso && 'is-today', iso === value && 'is-sel', disabled(d) && 'is-dis'].filter(Boolean).join(' ');
              return <button key={iso} type="button" className={cls} disabled={disabled(d)} onClick={() => pick(d)} aria-pressed={iso === value}>{d.getDate()}</button>;
            })}
          </div>
          <div className="dp-foot">
            <button type="button" className="dp-link" disabled={disabled(new Date())} onClick={() => pick(new Date())}>Today</button>
            {clearable && <button type="button" className="dp-link" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
