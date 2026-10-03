import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ListPlus } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Btn, Badge, Callout } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { regulations, type FeedStatus, type Reg } from '../../../data/modules/horizon';
import { daysAhead, fmtDateShort } from '../../../lib/format';
import './horizon.css';

export const HZ_TONE = 'var(--m-comply)';

export type HzSection = 'timeline' | 'impact' | 'feed' | 'board';
export const HZ_SECTIONS: { id: HzSection; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'impact', label: 'Impact analysis' },
  { id: 'feed', label: 'Change feed' },
  { id: 'board', label: 'Board briefing' },
];

interface HzState {
  regs: Reg[];
  setStatus: (id: string, s: FeedStatus) => void;
  raise: (id: string, n: number) => void;
  raising: Reg | null;
  openRaise: (r: Reg) => void;
}
const Ctx = createContext<HzState | null>(null);

/** Session state: change-feed triage and tasks raised from regulatory change. */
export function HorizonProvider({ children }: { children: ReactNode }) {
  const { customer: c, tenantId } = useApp();
  const base = useMemo(() => regulations(c, tenantId), [c, tenantId]);
  const [over, setOver] = useState<Record<string, { status?: FeedStatus; raised?: number }>>({});
  const [raising, setRaising] = useState<Reg | null>(null);
  const regs = useMemo(() => base.map((r) => (over[r.id] ? { ...r, feedStatus: over[r.id].status ?? r.feedStatus, raised: r.raised + (over[r.id].raised ?? 0) } : r)), [base, over]);
  const setStatus = useCallback((id: string, s: FeedStatus) => setOver((o) => ({ ...o, [id]: { ...o[id], status: s } })), []);
  const raise = useCallback((id: string, n: number) => setOver((o) => ({ ...o, [id]: { ...o[id], status: 'actions raised', raised: (o[id]?.raised ?? 0) + n } })), []);
  const v = useMemo(() => ({ regs, setStatus, raise, raising, openRaise: setRaising }), [regs, setStatus, raise, raising]);
  return (
    <Ctx.Provider value={v}>
      {children}
      {raising && <RaiseModal reg={regs.find((r) => r.id === raising.id) ?? raising} onClose={() => setRaising(null)} />}
    </Ctx.Provider>
  );
}

export function useHorizon(): HzState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHorizon outside HorizonProvider');
  return v;
}

/** Section navigation that keeps everything else in the URL out of the way. */
export function useHzNav() {
  const [sp, setSp] = useSearchParams();
  const go = useCallback((section: HzSection, params: Record<string, string> = {}) => {
    const next = new URLSearchParams({ section, ...params });
    setSp(next);
  }, [setSp]);
  const set = useCallback((k: string, v: string | null) => {
    const next = new URLSearchParams(sp);
    if (v === null || v === 'all') next.delete(k); else next.set(k, v);
    setSp(next, { replace: true });
  }, [sp, setSp]);
  return { sp, go, set };
}

export function whenLabel(m: number): string {
  if (m < 0) return 'Applying';
  if (m === 0) return 'This month';
  return `${m} mo`;
}

/** Framework pills that open HexaComply Frameworks pre-filtered. */
export function FwLinks({ reg }: { reg: Reg }) {
  const nav = useNavigate();
  return (
    <span className="hz-fw">
      {reg.fwShorts.map((f) => (
        <button key={f.id} type="button" title={`Open ${f.short} in HexaComply Frameworks`} onClick={(e) => { e.stopPropagation(); nav(`/comply/caas?section=frameworks&framework=${f.id}`); }}>
          {f.short}
        </button>
      ))}
    </span>
  );
}

function RaiseModal({ reg, onClose }: { reg: Reg; onClose: () => void }) {
  const { customer: c, toast } = useApp();
  const { raise } = useHorizon();
  const nav = useNavigate();
  const open = Math.max(1, reg.gaps - reg.raised);
  const tasks = reg.themes.map((t, i) => ({
    title: `${reg.short}: ${t} gap assessment and remediation`,
    owner: i === 0 ? reg.owner.name : [c.people.grcLead.name, c.people.ciso.name, (c.people.otLead ?? c.people.socLead).name][i % 3],
    due: fmtDateShort(daysAhead(Math.max(14, Math.min(reg.months < 0 ? 30 : reg.months * 30 - 20, 240) - i * 7))),
    fw: reg.fwShorts[i % Math.max(1, reg.fwShorts.length)]?.short ?? 'Group',
  }));
  const submit = () => {
    raise(reg.id, tasks.length);
    toast(`${tasks.length} tasks raised in HexaComply for ${reg.short}; owners notified`);
    onClose();
  };
  return (
    <Modal
      title={`Raise tasks · ${reg.short}`}
      sub={`${reg.name} · ${open} open gap${open === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => { submit(); nav('/comply/caas?section=tasks'); }}>Raise and open tasks</Btn>
          <Btn primary color={HZ_TONE} onClick={submit}><ListPlus /> Raise {tasks.length} tasks</Btn>
        </>
      }
    >
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 12.5 }}>One task per affected control area, mapped to {reg.fwShorts.map((f) => f.short).join(', ') || 'the group control set'}. Tasks advance only through evidence, as everywhere in HexaComply.</p>
      <div className="hz-bucket">
        {tasks.map((t) => (
          <div key={t.title} className="hz-row" style={{ cursor: 'default', gridTemplateColumns: 'minmax(0,1fr) 130px 70px' }}>
            <span><b>{t.title}</b><small>Framework: {t.fw}</small></span>
            <span style={{ fontSize: 12 }}>{t.owner}</span>
            <Badge color={HZ_TONE}>Due {t.due}</Badge>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Callout color={HZ_TONE}>Risk class: <b>low</b> (creates records in HexaComply only). No approval needed; the GRC lead {c.people.grcLead.name} is notified.</Callout>
      </div>
    </Modal>
  );
}
