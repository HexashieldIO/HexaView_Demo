import { useLayoutEffect, type RefObject } from 'react';

/**
 * Keeps a top-bar pop-up panel fully on screen: after it opens, measures where
 * it landed and shifts it sideways so it clears the sidebar (when the sidebar is
 * docked) and the window edges. Re-checks on resize.
 */
export function usePanelFit(panel: RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    const fit = () => {
      el.style.transform = '';
      const r = el.getBoundingClientRect();
      const side = document.querySelector<HTMLElement>('.sidebar');
      const sr = side?.getBoundingClientRect();
      // A docked sidebar takes the left edge; an off-canvas one (mobile) does not.
      const docked = !!sr && sr.width > 0 && sr.right > 0 && sr.width < window.innerWidth * 0.6 && getComputedStyle(side!).position !== 'fixed';
      const minLeft = (docked ? sr!.right : 0) + 12;
      const maxRight = window.innerWidth - 12;
      let dx = 0;
      if (r.left < minLeft) dx = minLeft - r.left;
      if (r.right + dx > maxRight) dx = Math.max(minLeft - r.left, maxRight - r.right);
      if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [panel, open]);
}
