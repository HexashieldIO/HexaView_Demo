import { useEffect, useState } from 'react';

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
export const easeOutBack = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  const c1 = 1.4;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Intro clock: 0 → `ms` once per `key`. Values derived from it animate on load
 * and again when the key (e.g. customer or tenant) changes. A timer guarantees
 * the final value even where animation frames are throttled.
 */
export function useIntro(key: string, ms = 1800) {
  const [t, setT] = useState(reducedMotion() ? ms : 0);
  useEffect(() => {
    if (reducedMotion()) { setT(ms); return; }
    setT(0);
    const start = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const e = now - start;
      setT(Math.min(ms, e));
      if (e < ms) raf = requestAnimationFrame(step);
    });
    const done = setTimeout(() => setT(ms), ms + 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [key, ms]);
  /** Value eased from 0 to `target`, starting `delay` ms in and lasting `dur` ms. */
  return (target: number, delay = 0, dur = 1100, ease: (x: number) => number = easeOut) => target * ease((t - delay) / dur);
}
