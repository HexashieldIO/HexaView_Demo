import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import type { CustomerProfile } from '../../../data/types';
import {
  tpSuppliers, tpTasks, tpQuestionnaires, tpQuestionSets, tpChangeLog, tpOwners, tpPriority,
  type TpSupplier, type TpTask, type TpGap, type TpQuestionnaire, type QSet, type QaCol, type QSetId, type TpLogEntry, type TpLogType, type TpPriority,
} from '../../../data/modules/tprm';

export type TpSection = 'suppliers' | 'questionnaires' | 'exposure' | 'tasks' | 'changelog';
export const TP_SECTIONS: { id: TpSection; label: string }[] = [
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'questionnaires', label: 'Questionnaires' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'changelog', label: 'Change Log' },
];

interface TprmState {
  c: CustomerProfile;
  tenantId: string;
  sup: TpSupplier[];
  byId: Map<string, TpSupplier>;
  tasks: TpTask[];
  log: TpLogEntry[];
  qas: TpQuestionnaire[];
  qsets: QSet[];
  owners: string[];
  me: string;
  grc: string;
  /** Open task covering this gap, if any. */
  taskFor: (gapKey: string) => TpTask | undefined;
  raise: (gap: TpGap, opts?: { owner?: string; priority?: TpPriority; dueInDays?: number; note?: string }) => TpTask;
  setDone: (taskId: string, done: boolean) => void;
  moveQa: (id: string, col: QaCol) => void;
  sendQa: (supplierId: string, set: QSetId) => void;
  addLog: (supplierId: string, event: string, type: TpLogType) => void;
  section: TpSection;
  go: (section: TpSection, params?: Record<string, string>) => void;
  setParams: (patch: Record<string, string | null>) => void;
  openSupplier: (id: string) => void;
}

const Ctx = createContext<TprmState | null>(null);

export function useTprm(): TprmState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTprm outside TprmProvider');
  return v;
}

/** Shared local state for the five sections: tasks, questionnaire moves and change log. */
export function TprmProvider({ children }: { children: ReactNode }) {
  const { customer: c, tenantId, toast } = useApp();
  const [sp, setSp] = useSearchParams();
  const base = useMemo(() => {
    const sup = tpSuppliers(c, tenantId);
    const tasks = tpTasks(c, tenantId, sup);
    return { sup, tasks, qas: tpQuestionnaires(c, tenantId, sup), log: tpChangeLog(c, tenantId, sup, tasks), qsets: tpQuestionSets(c), owners: tpOwners(c) };
  }, [c, tenantId]);
  const byId = useMemo(() => new Map(base.sup.map((s) => [s.id, s])), [base.sup]);
  const me = c.people.grcLead.name;
  const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';

  // Local edits, kept per customer + tenant scope.
  const scope = `${c.id}:${tenantId}`;
  const [edits, setEdits] = useState<{ scope: string; tasks: TpTask[]; done: Record<string, number | null>; qa: Record<string, Partial<TpQuestionnaire>>; newQa: TpQuestionnaire[]; log: TpLogEntry[] }>({ scope, tasks: [], done: {}, qa: {}, newQa: [], log: [] });
  const ed = edits.scope === scope ? edits : { scope, tasks: [], done: {}, qa: {}, newQa: [], log: [] };
  const update = useCallback((fn: (e: typeof ed) => typeof ed) => setEdits((prev) => fn(prev.scope === scope ? prev : { scope, tasks: [], done: {}, qa: {}, newQa: [], log: [] })), [scope]);

  const tasks = useMemo(() => [...base.tasks, ...ed.tasks].map((t) => (t.id in ed.done ? { ...t, done: ed.done[t.id] !== null, completedDaysAgo: ed.done[t.id] ?? undefined } : t)), [base.tasks, ed.tasks, ed.done]);
  const qas = useMemo(() => [...base.qas.map((q) => ({ ...q, ...ed.qa[q.id] })), ...ed.newQa.map((q) => ({ ...q, ...ed.qa[q.id] }))], [base.qas, ed.qa, ed.newQa]);
  const log = useMemo(() => [...ed.log, ...base.log], [base.log, ed.log]);

  const openByGap = useMemo(() => {
    const m = new Map<string, TpTask>();
    tasks.forEach((t) => { if (!t.done) m.set(t.gapKey, t); });
    return m;
  }, [tasks]);

  const mkLog = (supplierId: string, event: string, type: TpLogType, n: number): TpLogEntry => ({
    id: `CL-U${n}`, minutesAgo: 0, supplierId, supplierName: byId.get(supplierId)?.name ?? supplierId, event, type, by: me,
  });

  const addLog = (supplierId: string, event: string, type: TpLogType) => update((e) => ({ ...e, log: [mkLog(supplierId, event, type, e.log.length + 1), ...e.log] }));

  const raise: TprmState['raise'] = (gap, opts) => {
    const existing = openByGap.get(gap.key);
    if (existing) return existing;
    const s = byId.get(gap.supplierId);
    const id = `TP-${String(base.tasks.length + ed.tasks.length + 1).padStart(3, '0')}`;
    const t: TpTask = {
      id, gapKey: gap.key, supplierId: gap.supplierId, supplierName: gap.supplierName, check: gap.check, domain: gap.domain, title: gap.title,
      priority: opts?.priority ?? (s ? tpPriority(s, gap) : 'Medium'), owner: opts?.owner ?? me, raisedDaysAgo: 0, dueInDays: opts?.dueInDays ?? 30, done: false, note: opts?.note, byUser: true,
    };
    update((e) => ({ ...e, tasks: [...e.tasks, t], log: [mkLog(gap.supplierId, `Task ${id} raised — ${gap.title}`, 'Updated', e.log.length + 1), ...e.log] }));
    toast(`${id} raised in ${grc} · ${gap.supplierName}: ${gap.title} · owner ${t.owner}`);
    return t;
  };

  const setDone = (taskId: string, done: boolean) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    update((e) => ({ ...e, done: { ...e.done, [taskId]: done ? 0 : null }, log: [mkLog(t.supplierId, done ? `Task ${taskId} completed — ${t.title}` : `Task ${taskId} reopened — ${t.title}`, done ? 'Closed' : 'Status changed', e.log.length + 1), ...e.log] }));
    toast(done ? `${taskId} completed · ${t.supplierName}. The gap is re-checked on the next register sync.` : `${taskId} reopened`);
  };

  const COL_EVENT: Record<QaCol, string> = { Draft: 'moved back to draft', Sent: 'sent to the supplier', Submitted: 'marked as submitted', Approved: 'approved', Rejected: 'rejected and sent back for more' };
  const moveQa = (id: string, col: QaCol) => {
    const q = qas.find((x) => x.id === id);
    if (!q) return;
    const patch: Partial<TpQuestionnaire> = { col };
    if (col === 'Sent') { patch.sentDaysAgo = 0; patch.dueInDays = 21; patch.returnedDaysAgo = null; }
    if (col === 'Submitted' || col === 'Approved' || col === 'Rejected') { patch.returnedDaysAgo = q.returnedDaysAgo ?? 0; patch.dueInDays = col === 'Rejected' ? 14 : null; }
    const set = base.qsets.find((x) => x.id === q.set)?.name ?? q.set;
    update((e) => ({ ...e, qa: { ...e.qa, [id]: { ...e.qa[id], ...patch } }, log: [mkLog(q.supplierId, `Questionnaire ${id} (${set}) ${COL_EVENT[col]}`, 'Status changed', e.log.length + 1), ...e.log] }));
    toast(`${id} ${COL_EVENT[col]} · ${byId.get(q.supplierId)?.name ?? ''}`);
  };

  const sendQa = (supplierId: string, set: QSetId) => {
    const live = qas.find((q) => q.supplierId === supplierId && q.col !== 'Approved');
    if (live) { moveQa(live.id, 'Sent'); return; }
    const id = `QA-${900 + ed.newQa.length + 1}`;
    const q: TpQuestionnaire = { id, supplierId, set, col: 'Sent', sentDaysAgo: 0, dueInDays: 21, returnedDaysAgo: null };
    const setName = base.qsets.find((x) => x.id === set)?.name ?? set;
    update((e) => ({ ...e, newQa: [...e.newQa, q], log: [mkLog(supplierId, `Questionnaire ${id} (${setName}) sent to the supplier`, 'Status changed', e.log.length + 1), ...e.log] }));
    toast(`${id} · ${setName} sent to ${byId.get(supplierId)?.name ?? supplierId} · due in 21 days`);
  };

  const raw = sp.get('section') as TpSection | null;
  const section: TpSection = raw && TP_SECTIONS.some((s) => s.id === raw) ? raw : 'suppliers';
  const go = (sec: TpSection, params?: Record<string, string>) => {
    const next = new URLSearchParams();
    if (sec !== 'suppliers') next.set('section', sec);
    Object.entries(params ?? {}).forEach(([k, v]) => next.set(k, v));
    setSp(next, { replace: false });
  };
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  };
  const openSupplier = (id: string) => setParams({ id });

  const value: TprmState = {
    c, tenantId, sup: base.sup, byId, tasks, log, qas, qsets: base.qsets, owners: base.owners, me, grc,
    taskFor: (k) => openByGap.get(k), raise, setDone, moveQa, sendQa, addLog, section, go, setParams, openSupplier,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
