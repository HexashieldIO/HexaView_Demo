import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import type { CustomerProfile } from '../../../data/types';
import {
  humanOverview, campaigns, courses, overdueLearners, riskyUsers, policies, champions, cultureSurvey, departments, awarenessPlatform,
  type HumanOverview, type Campaign, type Course, type Learner, type RiskyUser, type Policy, type Champion, type CultureDim, type Dept, type AwarenessPlatform, type UserAction,
} from '../../../data/modules/human';

export type HrSection = 'overview' | 'phishing' | 'training' | 'risky' | 'culture';
export const HR_SECTIONS: { id: HrSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'phishing', label: 'Phishing simulations' },
  { id: 'training', label: 'Training' },
  { id: 'risky', label: 'Risky users' },
  { id: 'culture', label: 'Culture & policy' },
];
const IDS = new Set<string>(HR_SECTIONS.map((s) => s.id));

interface HrState {
  c: CustomerProfile;
  tenantId: string;
  ov: HumanOverview;
  depts: (Dept & { headcount: number })[];
  deptName: (id: string) => string;
  platform: AwarenessPlatform;
  camps: Campaign[];
  courses: Course[];
  learners: Learner[];
  users: RiskyUser[];
  pols: Policy[];
  champs: Champion[];
  culture: { dims: CultureDim[]; responses: number; rate: number };
  section: HrSection;
  go: (s: HrSection, params?: Record<string, string | undefined>) => void;
  param: (k: string) => string | null;
  patch: (p: Record<string, string | null>) => void;
  /* in-session state */
  launch: (c: Campaign) => void;
  nudged: Record<string, number>;
  nudge: (ids: string[]) => void;
  applied: Record<string, UserAction[]>;
  apply: (userIds: string[], a: UserAction) => void;
  reminded: Record<string, boolean>;
  remind: (id: string) => void;
}

const Ctx = createContext<HrState | null>(null);
export function useHr(): HrState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHr outside HrProvider');
  return v;
}

export function HrProvider({ children }: { children: ReactNode }) {
  const { customer: c, tenantId } = useApp();
  return <Inner key={`${c.id}-${tenantId}`} c={c} tenantId={tenantId}>{children}</Inner>;
}

function Inner({ c, tenantId, children }: { c: CustomerProfile; tenantId: string; children: ReactNode }) {
  const [sp, setSp] = useSearchParams();
  const ov = useMemo(() => humanOverview(c, tenantId), [c, tenantId]);
  const depts = useMemo(() => departments(c, tenantId), [c, tenantId]);
  const baseCamps = useMemo(() => campaigns(c, tenantId), [c, tenantId]);
  const crs = useMemo(() => courses(c, tenantId), [c, tenantId]);
  const learners = useMemo(() => overdueLearners(c, tenantId, crs), [c, tenantId, crs]);
  const users = useMemo(() => riskyUsers(c, tenantId), [c, tenantId]);
  const pols = useMemo(() => policies(c, tenantId), [c, tenantId]);
  const champs = useMemo(() => champions(c, tenantId), [c, tenantId]);
  const culture = useMemo(() => cultureSurvey(c, tenantId), [c, tenantId]);
  const platform = useMemo(() => awarenessPlatform(c), [c]);

  const [local, setLocal] = useState<Campaign[]>([]);
  const [nudged, setNudged] = useState<Record<string, number>>({});
  const [applied, setApplied] = useState<Record<string, UserAction[]>>({});
  const [reminded, setReminded] = useState<Record<string, boolean>>({});

  const raw = sp.get('section');
  const section: HrSection = raw && IDS.has(raw) ? (raw as HrSection) : 'overview';
  const go = useCallback((s: HrSection, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams();
    next.set('section', s);
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && next.set(k, v));
    setSp(next);
  }, [setSp]);
  const patch = useCallback((p: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(p).forEach(([k, v]) => (v === null || v === 'All' || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  }, [sp, setSp]);

  const value: HrState = {
    c, tenantId, ov, depts, platform, courses: crs, learners, users, pols, champs, culture,
    deptName: (id) => depts.find((d) => d.id === id)?.name ?? id,
    camps: [...local, ...baseCamps],
    section, go, param: (k) => sp.get(k), patch,
    launch: (x) => setLocal((l) => [x, ...l]),
    nudged, nudge: (ids) => setNudged((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, (m[id] ?? 0) + 1])) })),
    applied, apply: (ids, a) => setApplied((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, [...new Set([...(m[id] ?? []), a])]])) })),
    reminded, remind: (id) => setReminded((m) => ({ ...m, [id]: true })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Colour for a 0-100 human risk score (lower is better). */
export function riskColor(score: number): string {
  return score >= 70 ? 'var(--sev-critical)' : score >= 55 ? 'var(--sev-high)' : score >= 40 ? 'var(--sev-medium)' : 'var(--good)';
}
export function riskLabel(score: number): string {
  return score >= 70 ? 'Critical' : score >= 55 ? 'High' : score >= 40 ? 'Moderate' : 'Low';
}
export const pct = (n: number, d: number, dp = 1) => (d ? +((n / d) * 100).toFixed(dp) : 0);
