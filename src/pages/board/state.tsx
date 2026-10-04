import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import {
  boardMeeting, directorQuestions, decisionLog, decisionRequests, boardActions,
  type Meeting, type DirectorQuestion, type Decision, type DecisionRequest, type BoardAction, type Paper, type PaperStage,
} from '../../data/modules/boardMeeting';
import './meeting.css';

export const BM_TONE = 'var(--m-view)';

export type BmSection = 'next' | 'questions' | 'decisions' | 'actions' | 'minutes';
export const BM_SECTIONS: { id: BmSection; label: string }[] = [
  { id: 'next', label: 'Next meeting' },
  { id: 'questions', label: 'Questions directors should ask' },
  { id: 'decisions', label: 'Decisions log' },
  { id: 'actions', label: 'Actions tracker' },
  { id: 'minutes', label: 'Minutes & attestation' },
];

export type Outcome = 'Approved' | 'Deferred' | 'Rejected';
export interface Recorded { outcome: Outcome; option: string; note: string; at: Date }
export type PrintMode = null | 'pack' | 'minutes';

interface BmState {
  m: Meeting;
  questions: DirectorQuestion[];
  requests: DecisionRequest[];
  decisions: Decision[];
  actions: BoardAction[];
  papers: Paper[];
  recorded: Record<string, Recorded>;
  record: (reqId: string, r: Omit<Recorded, 'at'>) => void;
  setPaper: (id: string, stage: PaperStage, v: boolean) => void;
  completeAction: (id: string, done: boolean) => void;
  attest: (name: string) => void;
  print: PrintMode;
  setPrint: (p: PrintMode) => void;
}

const Ctx = createContext<BmState | null>(null);

/** In-session state for the meeting workspace: checklist, recorded decisions and completed actions. */
export function BoardMeetingProvider({ children }: { children: ReactNode }) {
  const { customer: c } = useApp();
  const base = useMemo(() => boardMeeting(c), [c]);
  const [attested, setAttested] = useState<Record<string, Date>>({});
  const attest = useCallback((name: string) => setAttested((o) => ({ ...o, [name]: new Date() })), []);
  const m = useMemo<Meeting>(() => ({ ...base, directors: base.directors.map((d) => (attested[d.name] ? { ...d, training: { ...d.training, status: 'Completed' as const, date: attested[d.name] } } : d)) }), [base, attested]);
  const questions = useMemo(() => directorQuestions(c), [c]);
  const requests = useMemo(() => decisionRequests(c), [c]);
  const baseLog = useMemo(() => decisionLog(c, base), [c, base]);
  const baseActions = useMemo(() => boardActions(c, base), [c, base]);

  const [recorded, setRecorded] = useState<Record<string, Recorded>>({});
  const [paperOver, setPaperOver] = useState<Record<string, Partial<Record<PaperStage, boolean>>>>({});
  const [done, setDone] = useState<Record<string, Date>>({});
  const [print, setPrint] = useState<PrintMode>(null);

  const record = useCallback((reqId: string, r: Omit<Recorded, 'at'>) => setRecorded((o) => ({ ...o, [reqId]: { ...r, at: new Date() } })), []);
  const setPaper = useCallback((id: string, stage: PaperStage, v: boolean) => setPaperOver((o) => {
    // Stages are sequential: approving implies drafted, circulating implies approved; un-drafting clears later stages.
    const next = { ...o[id] };
    if (stage === 'drafted') { next.drafted = v; if (!v) { next.approved = false; next.circulated = false; } }
    if (stage === 'approved') { next.approved = v; if (v) next.drafted = true; else next.circulated = false; }
    if (stage === 'circulated') { next.circulated = v; if (v) { next.drafted = true; next.approved = true; } }
    return { ...o, [id]: next };
  }), []);
  const completeAction = useCallback((id: string, d: boolean) => setDone((o) => {
    const next = { ...o };
    if (d) next[id] = new Date(); else delete next[id];
    return next;
  }), []);

  const papers = useMemo(() => m.agenda.flatMap((a) => a.papers).map((p) => ({ ...p, ...paperOver[p.id] })), [m, paperOver]);

  const decisions = useMemo(() => {
    const extra: Decision[] = requests.filter((q) => recorded[q.id]).map((q, i) => {
      const rc = recorded[q.id];
      const opt = q.options.find((o) => o.id === rc.option);
      return {
        id: `D-NEW-${i + 1}`, date: rc.at, forum: `${m.committee} (in session)`,
        decision: `${q.title}: ${rc.outcome === 'Approved' ? opt?.label ?? 'approved' : rc.outcome === 'Deferred' ? 'deferred to the next meeting' : 'rejected'}`,
        rationale: rc.note || (rc.outcome === 'Approved' ? q.why : 'No note recorded.'),
        owner: q.owner, status: rc.outcome, link: q.paper, note: rc.note, inSession: true,
      };
    });
    return [...extra, ...baseLog];
  }, [baseLog, requests, recorded, m.committee]);

  const actions = useMemo(() => baseActions.map((a) => (done[a.id] ? { ...a, status: 'Complete' as const, completedAt: done[a.id] } : a)), [baseActions, done]);

  const v = useMemo<BmState>(() => ({ m, questions, requests, decisions, actions, papers, recorded, record, setPaper, completeAction, attest, print, setPrint }),
    [m, questions, requests, decisions, actions, papers, recorded, record, setPaper, completeAction, attest, print]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useBm(): BmState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBm outside BoardMeetingProvider');
  return v;
}

/** ?section= navigation within the page. */
export function useBmNav() {
  const [sp, setSp] = useSearchParams();
  const raw = sp.get('section');
  const section: BmSection = BM_SECTIONS.some((s) => s.id === raw) ? (raw as BmSection) : 'next';
  const go = useCallback((s: BmSection, params: Record<string, string> = {}) => {
    setSp(new URLSearchParams({ section: s, ...params }));
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, [setSp]);
  const set = useCallback((k: string, val: string | null) => {
    const next = new URLSearchParams(sp);
    if (val === null || val === 'all') next.delete(k); else next.set(k, val);
    setSp(next, { replace: true });
  }, [sp, setSp]);
  return { sp, section, go, set };
}

export function paperReadiness(papers: Paper[]) {
  const total = papers.length;
  const drafted = papers.filter((p) => p.drafted).length;
  const approved = papers.filter((p) => p.approved).length;
  const circulated = papers.filter((p) => p.circulated).length;
  const score = total ? Math.round(((drafted + approved + circulated) / (total * 3)) * 100) : 0;
  return { total, drafted, approved, circulated, score };
}

export function initials(name: string): string {
  return name.replace(/^(Dr\.|Sir|Capt\.|Chief Eng\.)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}
