import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import type { CustomerProfile } from '../../../data/types';
import {
  programme, scenarios, drivers, regClocks, exercisePeople, CAPS,
  type Exercise, type Scenario, type Driver, type ExAction, type ActionStatus, type Cap, type RegClock,
} from '../../../data/modules/exercises';

export type ExSection = 'programme' | 'library' | 'run' | 'after-action';
export const EX_SECTIONS: { id: ExSection; label: string }[] = [
  { id: 'programme', label: 'Programme' },
  { id: 'library', label: 'Scenario library' },
  { id: 'run', label: 'Run an exercise' },
  { id: 'after-action', label: 'After-action' },
];

export interface Decision {
  t: number;
  inject: number;
  text: string;
  by: string;
  ttd: number;
}
export interface RunState {
  exId: string | null;
  scenarioId: string;
  running: boolean;
  simMin: number;
  speed: number;
  /** Injects released so far, with the sim minute each was released at. */
  releasedAt: number[];
  decisions: Decision[];
  ratings: Partial<Record<Cap, number>>;
  attendance: Record<string, boolean>;
  submitted: Record<string, number>;
}

interface Store {
  run: RunState | null;
  live: Exercise[];
  actionStatus: Record<string, ActionStatus>;
  pushed: Record<string, boolean>;
  newActions: ExAction[];
}
/** Session store: survives section switches and navigation away and back (not reloads). */
const STORE = new Map<string, Store>();
const emptyStore = (): Store => ({ run: null, live: [], actionStatus: {}, pushed: {}, newActions: [] });

interface ExState {
  c: CustomerProfile;
  tenantId: string;
  exs: Exercise[];
  scs: Scenario[];
  scById: Map<string, Scenario>;
  ds: Driver[];
  clocks: RegClock[];
  people: { name: string; role: string; org: string }[];
  actions: ExAction[];
  isPushed: (ex: Exercise) => boolean;
  setActionStatus: (id: string, st: ActionStatus) => void;
  pushEvidence: (ex: Exercise) => void;
  section: ExSection;
  go: (s: ExSection, params?: Record<string, string>) => void;
  param: (k: string) => string | null;
  setParams: (patch: Record<string, string | null>) => void;
  run: RunState | null;
  startRun: (scenarioId: string, exId?: string | null) => void;
  toggleRun: () => void;
  nextInject: () => void;
  setSpeed: (n: number) => void;
  logDecision: (inject: number, text: string, by: string) => void;
  rate: (cap: Cap, v: number) => void;
  toggleAttendance: (name: string) => void;
  submitClock: (name: string) => void;
  completeRun: (scores: Record<Cap, number>, raise: { title: string; cap: Cap; owner: string }[], push: boolean) => Exercise | null;
  abandonRun: () => void;
}

const Ctx = createContext<ExState | null>(null);
export function useEx(): ExState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEx outside ExProvider');
  return v;
}

export function ExProvider({ children }: { children: ReactNode }) {
  const { customer: c, tenantId, toast } = useApp();
  const [sp, setSp] = useSearchParams();
  const key = c.id;
  const [store, setStore] = useState<Store>(() => STORE.get(key) ?? emptyStore());
  useEffect(() => { STORE.set(key, store); }, [key, store]);

  const scs = useMemo(() => scenarios(c), [c]);
  const scById = useMemo(() => new Map(scs.map((s) => [s.id, s])), [scs]);
  const ds = useMemo(() => drivers(c), [c]);
  const clocks = useMemo(() => regClocks(c), [c]);
  const people = useMemo(() => exercisePeople(c), [c]);
  const base = useMemo(() => programme(c, tenantId), [c, tenantId]);
  const exs = useMemo(() => {
    const live = store.live.filter((e) => tenantId === 'all' || e.tenantId === 'all' || e.tenantId === tenantId);
    const replaced = new Set(live.map((e) => e.id));
    return [...base.filter((e) => !replaced.has(e.id)), ...live].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [base, store.live, tenantId]);
  const actions = useMemo(
    () => [...exs.flatMap((e) => e.actions), ...store.newActions.filter((a) => exs.some((e) => e.id === a.exerciseId))].map((a) => (a.id in store.actionStatus ? { ...a, status: store.actionStatus[a.id] } : a)).map((a) => (store.pushed[a.exerciseId] ? { ...a, pushed: true } : a)),
    [exs, store.newActions, store.actionStatus, store.pushed],
  );

  // Simulation clock: one tick a second advances the sim by `speed` minutes and auto-releases due injects.
  const running = store.run?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setStore((s) => {
        if (!s.run || !s.run.running) return s;
        const sc = scById.get(s.run.scenarioId);
        const simMin = s.run.simMin + s.run.speed;
        const releasedAt = [...s.run.releasedAt];
        while (sc && releasedAt.length < sc.injects.length && sc.injects[releasedAt.length].t <= simMin) releasedAt.push(sc.injects[releasedAt.length].t);
        return { ...s, run: { ...s.run, simMin, releasedAt } };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, scById]);

  const raw = sp.get('section') as ExSection | null;
  const section: ExSection = raw && EX_SECTIONS.some((s) => s.id === raw) ? raw : 'programme';
  const go = (s: ExSection, params?: Record<string, string>) => {
    const n = new URLSearchParams();
    if (s !== 'programme') n.set('section', s);
    Object.entries(params ?? {}).forEach(([k, v]) => n.set(k, v));
    setSp(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const setParams = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v)));
    setSp(n, { replace: true });
  };

  const patchRun = (fn: (r: RunState) => RunState) => setStore((s) => (s.run ? { ...s, run: fn(s.run) } : s));
  const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';

  const value: ExState = {
    c, tenantId, exs, scs, scById, ds, clocks, people, actions,
    isPushed: (ex) => ex.pushed || !!store.pushed[ex.id],
    setActionStatus: (id, st) => {
      setStore((s) => ({ ...s, actionStatus: { ...s.actionStatus, [id]: st } }));
      const a = actions.find((x) => x.id === id);
      toast(`${id} → ${st.replace('_', ' ')}${a ? ` · ${a.owner}` : ''}; synced to the ${grc} task`);
    },
    pushEvidence: (ex) => {
      setStore((s) => ({ ...s, pushed: { ...s.pushed, [ex.id]: true } }));
      toast(`${ex.id} evidence pushed to ${grc}: after-action report, attendance, decision log and ${ex.actions.length} actions as tasks (${ex.drivers.join(', ')})`);
    },
    section, go, param: (k) => sp.get(k), setParams,
    run: store.run,
    startRun: (scenarioId, exId = null) => {
      const sc = scById.get(scenarioId);
      const ex = exId ? exs.find((e) => e.id === exId) : undefined;
      const attendees = ex ? ex.participants : people.slice(0, 7).map((p) => p.name);
      setStore((s) => ({
        ...s,
        run: { exId, scenarioId, running: false, simMin: 0, speed: 5, releasedAt: [], decisions: [], ratings: {}, attendance: Object.fromEntries(people.map((p) => [p.name, attendees.includes(p.name)])), submitted: {} },
      }));
      toast(`Exercise loaded: ${sc?.title ?? scenarioId}. Press Start to release the first inject.`);
    },
    toggleRun: () => patchRun((r) => {
      const sc = scById.get(r.scenarioId);
      const releasedAt = r.releasedAt.length === 0 && sc ? [0] : r.releasedAt;
      return { ...r, running: !r.running, releasedAt };
    }),
    nextInject: () => patchRun((r) => {
      const sc = scById.get(r.scenarioId);
      if (!sc || r.releasedAt.length >= sc.injects.length) return r;
      const nx = sc.injects[r.releasedAt.length];
      const simMin = Math.max(r.simMin, nx.t);
      return { ...r, simMin, releasedAt: [...r.releasedAt, simMin] };
    }),
    setSpeed: (n) => patchRun((r) => ({ ...r, speed: n })),
    logDecision: (inject, text, by) => patchRun((r) => ({ ...r, decisions: [...r.decisions, { t: Math.round(r.simMin), inject, text, by, ttd: Math.max(0, Math.round(r.simMin - (r.releasedAt[inject] ?? r.simMin))) }] })),
    rate: (cap, v) => patchRun((r) => ({ ...r, ratings: { ...r.ratings, [cap]: v } })),
    toggleAttendance: (name) => patchRun((r) => ({ ...r, attendance: { ...r.attendance, [name]: !r.attendance[name] } })),
    submitClock: (name) => patchRun((r) => ({ ...r, submitted: { ...r.submitted, [name]: Math.round(r.simMin) } })),
    completeRun: (scores, raise, push) => {
      const r = store.run;
      if (!r) return null;
      const sc = scById.get(r.scenarioId);
      if (!sc) return null;
      const planned = r.exId ? exs.find((e) => e.id === r.exId) : undefined;
      const id = planned?.id ?? `EX-L${String(store.live.length + 1).padStart(2, '0')}`;
      const now = new Date();
      const attendees = Object.entries(r.attendance).filter(([, v]) => v).map(([k]) => k);
      const overall = Math.round(CAPS.reduce((s, k) => s + scores[k.id], 0) / CAPS.length);
      const acts: ExAction[] = raise.map((a, i) => ({ id: `${id}-L${i + 1}`, exerciseId: id, title: a.title, lesson: a.title, owner: a.owner, cap: a.cap, dueDays: 30 + i * 7, status: 'open', pushed: push }));
      const ex: Exercise = {
        id, scenarioId: sc.id, title: sc.title, kind: sc.kind, quarter: (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4, date: now, dayOffset: 0, status: 'completed',
        tenantId: planned?.tenantId ?? sc.tenantId, facilitator: 'You (live run)', participants: attendees, invited: Math.max(attendees.length, planned?.invited ?? attendees.length), attended: attendees.length,
        durationMin: Math.round(r.simMin), drivers: sc.drivers, scores, overall, lessons: raise.map((a) => a.title), actions: acts,
        evidenceId: `EV-EX-${1000 + Math.round(r.simMin * 7) % 9000}`, pushed: push, live: true, decisions: r.decisions.map((d) => ({ t: d.t, text: d.text, by: d.by, ttd: d.ttd })),
      };
      setStore((s) => ({ ...s, run: null, live: [...s.live.filter((e) => e.id !== id), ex], pushed: push ? { ...s.pushed, [id]: true } : s.pushed }));
      toast(`${id} completed · overall ${overall}/100 · ${acts.length} action${acts.length === 1 ? '' : 's'} raised${push ? ` and pushed to ${grc}` : ''}`);
      return ex;
    },
    abandonRun: () => {
      setStore((s) => ({ ...s, run: null }));
      toast('Exercise run discarded; nothing was recorded');
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
