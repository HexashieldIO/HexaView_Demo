import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Shared behaviour for the custom horizontal slide bars (HScroll, TabRail):
 * measures the scroller, and gives the track 1:1 pointer dragging. Press
 * anywhere on the track to jump the thumb under the pointer and keep dragging;
 * the content moves instantly (no smooth-scroll lag) and the thumb follows the
 * pointer exactly.
 */
export function useSlideBar(box: RefObject<HTMLElement | null>, opts: { wheel?: boolean } = {}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerX: number; startLeft: number; ratio: number } | null>(null);
  const [m, setM] = useState({ left: 0, client: 1, width: 1 });

  const measure = useCallback(() => {
    const el = box.current;
    if (el) setM({ left: el.scrollLeft, client: el.clientWidth, width: el.scrollWidth });
  }, [box]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    // Vertical wheel scrolls sideways when the content only scrolls horizontally.
    const onWheel = (e: WheelEvent) => {
      if (!opts.wheel || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
      if (next !== el.scrollLeft) { e.preventDefault(); el.scrollLeft = next; }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('scroll', measure); el.removeEventListener('wheel', onWheel); ro.disconnect(); };
  }, [box, measure, opts.wheel]);

  const max = Math.max(0, m.width - m.client);
  const thumbPct = m.width ? Math.min(100, (m.client / m.width) * 100) : 100;
  const leftPct = max ? (m.left / max) * (100 - thumbPct) : 0;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = box.current;
    const t = track.current;
    if (!el || !t || e.button !== 0) return;
    e.preventDefault();
    const r = t.getBoundingClientRect();
    const thumbW = (r.width * thumbPct) / 100;
    const travel = Math.max(1, r.width - thumbW);
    const ratio = max / travel; // content px per pointer px, so the thumb sits under the pointer
    const onThumb = (e.target as HTMLElement).dataset.thumb === '1';
    if (!onThumb) {
      // Jump: centre the thumb on the pointer instantly, then continue as a drag.
      const thumbLeft = Math.max(0, Math.min(travel, e.clientX - r.left - thumbW / 2));
      el.scrollLeft = thumbLeft * ratio;
      measure();
    }
    drag.current = { pointerX: e.clientX, startLeft: el.scrollLeft, ratio };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add('hs-dragging');
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    el.scrollLeft = d.startLeft + (e.clientX - d.pointerX) * d.ratio;
    // Update the thumb now rather than waiting for the next scroll event.
    measure();
  };
  const onPointerUp = () => {
    drag.current = null;
    document.body.classList.remove('hs-dragging');
  };

  return {
    m, max, thumbPct, leftPct, track,
    trackProps: { ref: track, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onLostPointerCapture: onPointerUp },
  };
}
