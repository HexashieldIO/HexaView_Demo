import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSlideBar } from './useSlideBar';

/**
 * Horizontal scroller with a visible slide bar above the content: a draggable
 * thumb sized to the visible share, arrow buttons, and a "columns in view" label.
 * Stays in sync with trackpad, wheel and native scrolling of the content.
 */
export function HScroll({ children, className = '', columns, step = 0.8, label = 'columns' }: {
  children: ReactNode;
  className?: string;
  /** Total column count, for the "1–6 of 14" label. */
  columns?: number;
  /** Fraction of the visible width each arrow press moves. */
  step?: number;
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { m, max, thumbPct, leftPct, trackProps } = useSlideBar(box);
  const scrollable = max > 2;
  const go = (dir: 1 | -1) => box.current?.scrollBy({ left: dir * m.client * step, behavior: 'smooth' });

  let viewLabel = '';
  if (columns && m.width > 0) {
    const colW = m.width / columns;
    const first = Math.min(columns, Math.floor(m.left / colW) + 1);
    const last = Math.min(columns, Math.ceil((m.left + m.client) / colW));
    viewLabel = `${first}–${last} of ${columns} ${label}`;
  }

  return (
    <div className={`hs ${scrollable ? '' : 'hs-static'}`}>
      {scrollable && (
        <div className="hs-bar">
          <button className="hs-btn" onClick={() => go(-1)} disabled={m.left <= 1} aria-label="Scroll left"><ChevronLeft size={16} /></button>
          <div
            className="hs-track"
            {...trackProps}
            role="scrollbar"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={max ? Math.round((m.left / max) * 100) : 0}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
          >
            <div className="hs-thumb" data-thumb="1" style={{ width: `${thumbPct}%`, left: `${leftPct}%` }} />
          </div>
          <button className="hs-btn" onClick={() => go(1)} disabled={m.left >= max - 1} aria-label="Scroll right"><ChevronRight size={16} /></button>
          {viewLabel && <span className="hs-label">{viewLabel}</span>}
        </div>
      )}
      <div className={`hs-box ${className}`} ref={box}>{children}</div>
    </div>
  );
}
