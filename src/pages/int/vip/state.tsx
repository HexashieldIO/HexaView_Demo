import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import {
  protectedPeople, impersonations, brokerRecords, trips,
  type ProtectedPerson, type ImpItem, type ImpStatus, type BrokerRecord, type RemovalState, type Trip,
} from '../../../data/modules/vip';
import type { CustomerProfile } from '../../../data/types';

export type VipSection = 'people' | 'impersonation' | 'brokers' | 'travel';
export const VIP_SECTIONS: { id: VipSection; label: string }[] = [
  { id: 'people', label: 'Protected people' },
  { id: 'impersonation', label: 'Impersonation & deepfakes' },
  { id: 'brokers', label: 'Data-broker & personal exposure' },
  { id: 'travel', label: 'Travel & event risk' },
];
const IDS = new Set<string>(VIP_SECTIONS.map((s) => s.id));

interface VipState {
  c: CustomerProfile;
  tenantId: string;
  people: ProtectedPerson[];
  imps: ImpItem[];
  brokers: BrokerRecord[];
  trips: Trip[];
  section: VipSection;
  /** Jump to a section with fresh filters. */
  go: (s: VipSection, params?: Record<string, string | undefined>) => void;
  /** Read / patch a URL filter on the current section. */
  param: (k: string) => string | null;
  patch: (p: Record<string, string | null>) => void;
  personOf: (id: string) => ProtectedPerson | undefined;
  openPerson: (id: string) => void;
  /* in-session write-back state */
  setImp: (id: string, s: ImpStatus) => void;
  notified: Record<string, boolean>;
  notify: (key: string) => void;
  watch: Record<string, boolean>;
  addWatch: (key: string) => void;
  setRemoval: (ids: string[], s: RemovalState) => void;
  tripDone: Record<string, boolean>;
  toggleTrip: (key: string) => void;
}

const Ctx = createContext<VipState | null>(null);
export function useVip(): VipState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVip outside VipProvider');
  return v;
}

export function VipProvider({ children }: { children: ReactNode }) {
  const { customer: c, tenantId } = useApp();
  return <Inner key={`${c.id}-${tenantId}`} c={c} tenantId={tenantId}>{children}</Inner>;
}

function Inner({ c, tenantId, children }: { c: CustomerProfile; tenantId: string; children: ReactNode }) {
  const [sp, setSp] = useSearchParams();
  const basePeople = useMemo(() => protectedPeople(c, tenantId), [c, tenantId]);
  const baseImps = useMemo(() => impersonations(c, tenantId), [c, tenantId]);
  const baseBrokers = useMemo(() => brokerRecords(c, tenantId), [c, tenantId]);
  const baseTrips = useMemo(() => trips(c, tenantId), [c, tenantId]);

  const [impSt, setImpSt] = useState<Record<string, ImpStatus>>({});
  const [remSt, setRemSt] = useState<Record<string, RemovalState>>({});
  const [notified, setNotified] = useState<Record<string, boolean>>({});
  const [watch, setWatch] = useState<Record<string, boolean>>({});
  const [tripDone, setTripDone] = useState<Record<string, boolean>>({});

  const imps = useMemo(() => baseImps.map((i) => (impSt[i.id] ? { ...i, status: impSt[i.id] } : i)), [baseImps, impSt]);
  const brokers = useMemo(() => baseBrokers.map((b) => (remSt[b.id] ? { ...b, state: remSt[b.id], requestedDays: b.requestedDays ?? 0 } : b)), [baseBrokers, remSt]);

  const raw = sp.get('section');
  const section: VipSection = raw && IDS.has(raw) ? (raw as VipSection) : 'people';

  const go = useCallback((s: VipSection, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams();
    next.set('section', s);
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && next.set(k, v));
    setSp(next);
  }, [setSp]);
  const patch = useCallback((p: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(p).forEach(([k, v]) => (v === null || v === 'All' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  }, [sp, setSp]);

  const value: VipState = {
    c, tenantId, people: basePeople, imps, brokers, trips: baseTrips, section, go,
    param: (k) => sp.get(k),
    patch,
    personOf: (id) => basePeople.find((p) => p.id === id),
    openPerson: (id) => patch({ person: id }),
    setImp: (id, s) => setImpSt((m) => ({ ...m, [id]: s })),
    notified, notify: (k) => setNotified((m) => ({ ...m, [k]: true })),
    watch, addWatch: (k) => setWatch((m) => ({ ...m, [k]: true })),
    setRemoval: (ids, s) => setRemSt((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, s])) })),
    tripDone, toggleTrip: (k) => setTripDone((m) => ({ ...m, [k]: !m[k] })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Initials for an avatar chip. */
export function initials(name: string): string {
  return name.replace(/^(Dr|Sir|Capt|Chief Eng)\.?\s+/i, '').split(/\s+/).filter((w) => /^[A-ZÀ-Ž]/.test(w)).map((w) => w[0]).slice(0, 2).join('');
}
