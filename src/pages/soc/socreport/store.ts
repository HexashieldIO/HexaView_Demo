// In-session store for the SOC report builder: templates saved from the
// builder and report schedules. Survives navigation (module state) and reloads
// in the same browser session (sessionStorage). One slot per customer.
import { useCallback, useSyncExternalStore } from 'react';
import type { CustomerProfile } from '../../../data/types';
import type { Format, PeriodKind } from '../../../data/modules/reports';
import type { SocAudience, SocSectionId } from '../../../data/modules/socReport';

export interface SocSavedTemplate {
  id: string;
  title: string;
  audience: SocAudience;
  format: Format;
  period: PeriodKind;
  sections: SocSectionId[];
  by: string;
  at: number;
}
export interface SocSchedule {
  id: string;
  title: string;
  cadence: Exclude<PeriodKind, 'custom'>;
  recipients: string;
  format: Format;
  audience: SocAudience;
  sections: SocSectionId[];
  at: number;
}
export interface SocReportStore {
  templates: SocSavedTemplate[];
  schedules: SocSchedule[];
}

const EMPTY: SocReportStore = { templates: [], schedules: [] };
const slots = new Map<string, SocReportStore>();
const listeners = new Set<() => void>();
const keyOf = (c: CustomerProfile) => `hv.socreport.v1.${String(c.id)}`;

function load(c: CustomerProfile): SocReportStore {
  const k = keyOf(c);
  const hit = slots.get(k);
  if (hit) return hit;
  let s: SocReportStore = EMPTY;
  try {
    const raw = sessionStorage.getItem(k);
    if (raw) {
      const p = JSON.parse(raw) as SocReportStore;
      if (Array.isArray(p.templates) && Array.isArray(p.schedules)) s = p;
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  slots.set(k, s);
  return s;
}

function save(c: CustomerProfile, s: SocReportStore) {
  const k = keyOf(c);
  slots.set(k, s);
  try {
    sessionStorage.setItem(k, JSON.stringify(s));
  } catch {
    /* module state still holds it */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSocReportStore(c: CustomerProfile) {
  const state = useSyncExternalStore(subscribe, () => load(c));
  const addTemplate = useCallback((t: SocSavedTemplate) => save(c, { ...load(c), templates: [t, ...load(c).templates] }), [c]);
  const addSchedule = useCallback((x: SocSchedule) => save(c, { ...load(c), schedules: [x, ...load(c).schedules] }), [c]);
  const removeSchedule = useCallback((id: string) => save(c, { ...load(c), schedules: load(c).schedules.filter((x) => x.id !== id) }), [c]);
  return { state, addTemplate, addSchedule, removeSchedule };
}
