// In-session store for the Playbook Builder: edits, publish state and test
// runs survive navigation (module state) and reloads in the same browser
// session (sessionStorage). One slot per customer profile.
import { useCallback, useSyncExternalStore } from 'react';
import type { CustomerProfile } from '../../../data/types';
import { playbookLibrary, type Playbook, type PbRun } from '../../../data/modules/playbooks';

export interface PbStore {
  playbooks: Playbook[];
  sessionRuns: PbRun[];
}

const VERSION = 'v5';
const slots = new Map<string, PbStore>();
const listeners = new Set<() => void>();

function keyOf(c: CustomerProfile) {
  return `hv.playbooks.${VERSION}.${String(c.id)}`;
}

function load(c: CustomerProfile): PbStore {
  const k = keyOf(c);
  const hit = slots.get(k);
  if (hit) return hit;
  let s: PbStore | null = null;
  try {
    const raw = sessionStorage.getItem(k);
    if (raw) {
      const parsed = JSON.parse(raw) as PbStore;
      if (Array.isArray(parsed.playbooks) && Array.isArray(parsed.sessionRuns)) s = parsed;
    }
  } catch {
    /* storage unavailable or corrupt: regenerate */
  }
  if (!s) s = { playbooks: playbookLibrary(c), sessionRuns: [] };
  slots.set(k, s);
  return s;
}

function save(c: CustomerProfile, s: PbStore) {
  const k = keyOf(c);
  slots.set(k, s);
  try {
    sessionStorage.setItem(k, JSON.stringify(s));
  } catch {
    /* storage full or unavailable: module state still holds the edits */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePlaybookStore(c: CustomerProfile) {
  const state = useSyncExternalStore(subscribe, () => load(c));
  const update = useCallback((fn: (s: PbStore) => PbStore) => save(c, fn(load(c))), [c]);
  const updatePb = useCallback(
    (id: string, fn: (p: Playbook) => Playbook) => save(c, (() => {
      const s = load(c);
      return { ...s, playbooks: s.playbooks.map((p) => (p.id === id ? fn(p) : p)) };
    })()),
    [c],
  );
  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(keyOf(c));
    } catch {
      /* ignore */
    }
    slots.delete(keyOf(c));
    save(c, { playbooks: playbookLibrary(c), sessionRuns: [] });
  }, [c]);
  return { state, update, updatePb, reset };
}

export function agoOf(minAgo: number, at?: number): number {
  return at ? Math.max(0, Math.round((Date.now() - at) / 60000)) : minAgo;
}
