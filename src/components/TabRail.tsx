import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSlideBar } from './useSlideBar';

/**
 * Module tab bar that overflows gracefully: edge arrows with fades, a slim
 * draggable slide bar underneath, wheel-to-scroll, and the active tab kept in
 * view. Nothing extra shows when every tab fits.
 */
export function TabRail({ children, label }: { children: ReactNode; label: string }) {
  const nav = useRef<HTMLElement>(null);
  const { m, max, thumbPct, leftPct, trackProps } = useSlideBar(nav, { wheel: true });
  const { pathname } = useLocation();

  // Keep the active tab visible when the route changes.
  useEffect(() => {
    const el = nav.current;
    const active = el?.querySelector<HTMLElement>('a.active, button.active');
    if (!el || !active) return;
    const a = active.offsetLeft;
    const b = a + active.offsetWidth;
    if (a < el.scrollLeft + 40 || b > el.scrollLeft + el.clientWidth - 40) {
      el.scrollTo({ left: a - el.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' });
    }
  }, [pathname]);

  const overflow = max > 2;
  const atStart = m.left <= 1;
  const atEnd = m.left >= max - 1;
  const go = (dir: 1 | -1) => nav.current?.scrollBy({ left: dir * m.client * 0.7, behavior: 'smooth' });

  return (
    <div className={`tab-rail ${overflow ? 'overflow' : ''} ${atStart ? 'at-start' : ''} ${atEnd ? 'at-end' : ''}`}>
      <div className="tab-rail-row">
        {overflow && <button className="tr-arrow left" onClick={() => go(-1)} disabled={atStart} aria-label="Previous tabs"><ChevronLeft size={16} /></button>}
        <nav className="mod-tabs" aria-label={label} ref={nav}>{children}</nav>
        {overflow && <button className="tr-arrow right" onClick={() => go(1)} disabled={atEnd} aria-label="More tabs"><ChevronRight size={16} /></button>}
      </div>
      {overflow && (
        <div className="tr-track" {...trackProps} aria-hidden>
          <div className="tr-thumb" data-thumb="1" style={{ width: `${thumbPct}%`, left: `${leftPct}%` }} />
        </div>
      )}
    </div>
  );
}
