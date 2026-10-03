import { useSyncExternalStore } from 'react';
import type { TourTarget } from './stories';

// Active guided story. Kept in sessionStorage so it survives the step-to-step
// navigation and an accidental reload during a pitch.
const KEY = 'hv.tour';

export interface TourState {
  storyId: string;
  step: number;
}

let state: TourState | null = (() => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as TourState | null; } catch { return null; }
})();
const subs = new Set<() => void>();

function emit(next: TourState | null) {
  state = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
  subs.forEach((f) => f());
}

export const tour = {
  get: () => state,
  start: (storyId: string) => emit({ storyId, step: 0 }),
  go: (step: number) => state && emit({ ...state, step }),
  stop: () => emit(null),
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};

export function useTour(): TourState | null {
  return useSyncExternalStore(tour.subscribe, tour.get, tour.get);
}

/** Resolve a step target to an element on the current page. */
export function findTarget(t: TourTarget | undefined): HTMLElement | null {
  if (!t) return null;
  const root = document.querySelector('.content') ?? document.body;
  let el: HTMLElement | null = null;
  if (t.card) {
    const needle = t.card.toLowerCase();
    el = [...root.querySelectorAll<HTMLElement>('.card')].find((c) => visible(c) && (c.querySelector('.card-title')?.textContent ?? '').toLowerCase().includes(needle)) ?? null;
  }
  if (!el && t.sel) {
    for (const s of t.sel.split(',').map((x) => x.trim())) {
      el = [...root.querySelectorAll<HTMLElement>(s)].find(visible) ?? null;
      if (el) break;
    }
  }
  if (!el && t.text) {
    const needle = t.text.toLowerCase();
    const hits = [...root.querySelectorAll<HTMLElement>('*')]
      .filter((n) => n.children.length < 12 && visible(n) && (n.textContent ?? '').toLowerCase().includes(needle));
    // Smallest element that contains the text.
    el = hits.sort((a, b) => area(a) - area(b))[0] ?? null;
  }
  if (el && t.up) {
    for (const s of t.up.split(',').map((x) => x.trim())) {
      const u = el.closest<HTMLElement>(s);
      if (u && root.contains(u)) { el = u; break; }
    }
  }
  return el;
}

function visible(n: HTMLElement) {
  const r = n.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}
function area(n: HTMLElement) {
  const r = n.getBoundingClientRect();
  return r.width * r.height;
}

/** Reset every demo change: per-browser state and in-memory stores (via reload). */
export function resetDemo(to = '/') {
  try {
    const keep = new Set(['hv.theme']);
    Object.keys(localStorage).filter((k) => k.startsWith('hv.') && !keep.has(k)).forEach((k) => localStorage.removeItem(k));
    Object.keys(sessionStorage).filter((k) => k.startsWith('hv.') && k !== 'hv.session').forEach((k) => sessionStorage.removeItem(k));
  } catch { /* storage unavailable */ }
  window.location.assign(to);
}
