import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { Btn } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { daysAgo, daysAhead, fmtDate } from '../../../lib/format';
import type { EvidenceItem, RegAsset } from '../../../data/modules/comply';
import type { DriveItem, VendorRec } from '../../../data/modules/complyRegisters';
import './compliance.css';

/* ---------------- Sections ---------------- */
export type SectionId = 'stream' | 'frameworks' | 'tasks' | 'drive' | 'risks' | 'assets' | 'vendors' | 'incidents' | 'bia';
export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'stream', label: 'Stream' }, { id: 'frameworks', label: 'Frameworks' }, { id: 'tasks', label: 'Tasks & Evidence' }, { id: 'drive', label: 'Drive' },
  { id: 'risks', label: 'Risks' }, { id: 'assets', label: 'Assets' }, { id: 'vendors', label: 'Vendors' }, { id: 'incidents', label: 'Incidents' }, { id: 'bia', label: 'BIA' },
];

/** URL-driven state for a register: read a param, patch params, or jump to another register pre-filtered. */
export function useQuery() {
  const [sp, setSp] = useSearchParams();
  const p = useCallback((k: string) => sp.get(k), [sp]);
  const set = useCallback((patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === undefined || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  }, [sp, setSp]);
  const go = useCallback((section: SectionId, params: Record<string, string | undefined> = {}) => {
    const next = new URLSearchParams();
    next.set('section', section);
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && next.set(k, v));
    setSp(next);
  }, [setSp]);
  return { sp, p, set, go };
}

/** `?id=` opens the matching record once. */
export function useDeepLink<T>(items: T[], match: (x: T, id: string) => boolean, open: (x: T) => void) {
  const { p } = useQuery();
  const id = p('id');
  const [handled, setHandled] = useState<string | null>(null);
  useEffect(() => {
    if (!id || handled === id) return;
    setHandled(id);
    const x = items.find((i) => match(i, id));
    if (x) open(x);
  }, [id, handled, items, match, open]);
}

/* ---------------- Local (session) state for things the user adds ---------------- */
export type LocalEvidence = EvidenceItem & { comment: string; docs: string[] };
interface LocalState {
  evidence: LocalEvidence[];
  addEvidence: (e: LocalEvidence) => void;
  drive: DriveItem[];
  addDrive: (d: DriveItem) => void;
  patchDrive: (id: string, patch: Partial<DriveItem>) => void;
  assets: RegAsset[];
  addAsset: (a: RegAsset) => void;
  vendors: VendorRec[];
  addVendor: (v: VendorRec) => void;
  answers: Record<string, string[]>;
  answer: (wfId: string, a: string) => void;
  steps: Record<string, number>;
  setStep: (courseId: string, n: number) => void;
}
const Ctx = createContext<LocalState | null>(null);
export function LocalProvider({ children }: { children: ReactNode }) {
  const [evidence, setEv] = useState<LocalEvidence[]>([]);
  const [drive, setDrive] = useState<DriveItem[]>([]);
  const [assets, setAssets] = useState<RegAsset[]>([]);
  const [vendors, setVendors] = useState<VendorRec[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [steps, setSteps] = useState<Record<string, number>>({});
  const value = useMemo<LocalState>(() => ({
    evidence, addEvidence: (e) => setEv((l) => [e, ...l]),
    drive, addDrive: (d) => setDrive((l) => [...l, d]), patchDrive: (id, patch) => setDrive((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    assets, addAsset: (a) => setAssets((l) => [a, ...l]),
    vendors, addVendor: (v) => setVendors((l) => [v, ...l]),
    answers, answer: (id, a) => setAnswers((m) => ({ ...m, [id]: [...(m[id] ?? []), a] })),
    steps, setStep: (id, n) => setSteps((m) => ({ ...m, [id]: n })),
  }), [evidence, drive, assets, vendors, answers, steps]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useLocal(): LocalState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocal outside LocalProvider');
  return v;
}

/* ---------------- Dates ---------------- */
export const ago = (d: number) => fmtDate(daysAgo(d));
export const ahead = (d: number) => fmtDate(daysAhead(d));

/* ---------------- Register chrome ---------------- */
export function SectionHead({ intro, actions }: { intro: ReactNode; actions?: ReactNode }) {
  return (
    <div className="cmp-head">
      <p className="cmp-intro">{intro}</p>
      {actions && <div className="cmp-head-actions">{actions}</div>}
    </div>
  );
}

/** Lifecycle-style toggles: each chip is an independent on/off filter. */
export function Toggles({ label, items }: { label: string; items: { label: ReactNode; on: boolean; onChange: (on: boolean) => void; n?: number }[] }) {
  return (
    <div className="comply-facet">
      <span className="comply-facet-l">{label}</span>
      <div className="comply-facet-opts">
        {items.map((t, i) => (
          <button key={i} type="button" className={`comply-fchip cmp-toggle ${t.on ? 'on' : ''}`} onClick={() => t.onChange(!t.on)} aria-pressed={t.on}>
            <i className="cmp-toggle-box" />{t.label}{t.n !== undefined && <em>{t.n}</em>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CountLine({ children, onClear, filtered }: { children: ReactNode; onClear?: () => void; filtered?: boolean }) {
  return (
    <div className="comply-count-line cmp-count">
      <span>{children}</span>
      {filtered && onClear && <button type="button" className="link" onClick={onClear}>Clear filters</button>}
    </div>
  );
}

/** Right-hand record drawer in the original register style. */
export function RecordDrawer({
  id, recordId, version = 'v2 · schema 1.0.0-draft', updatedDays, title, badges, onClose, children, actions,
}: {
  id: string; recordId: string; version?: string; updatedDays?: number; title: ReactNode; badges?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode;
}) {
  return (
    <Drawer
      wide
      title={<span className="cmp-rec-id">{id}</span>}
      sub={<span className="cmp-rec-ver">{recordId} · {version}{updatedDays !== undefined ? ` · updated ${ago(updatedDays)}` : ''}</span>}
      onClose={onClose}
      footer={
        <>
          <span className="cmp-ro"><Lock size={12} /> Compliance register · read-only view</span>
          <span className="spacer" />
          {actions}
          <Btn onClick={onClose}>Close</Btn>
        </>
      }
    >
      <div className="cmp-rec-title">
        <h2>{title}</h2>
        {badges && <div className="cmp-rec-badges">{badges}</div>}
      </div>
      {children}
    </Drawer>
  );
}

/** Sectioned key/value block. */
export function RSec({ title, rows, children, note }: { title: string; rows?: [ReactNode, ReactNode][]; children?: ReactNode; note?: ReactNode }) {
  return (
    <section className="cmp-sec">
      <h4>{title}</h4>
      {rows && (
        <dl className="cmp-kv">
          {rows.map(([k, v], i) => (
            <div key={i}>
              <dt>{k}</dt>
              <dd>{v === '' || v === null || v === undefined ? <span className="cmp-none">Not recorded</span> : v}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {note && <p className="cmp-sec-note">{note}</p>}
    </section>
  );
}

export interface LinkItem { label: ReactNode; sub?: ReactNode; onClick: () => void; count?: number }
export function LinkedRecords({ items, title = 'Linked records' }: { items: LinkItem[]; title?: string }) {
  return (
    <section className="cmp-sec">
      <h4>{title}</h4>
      <div className="cmp-links">
        {items.length === 0 && <span className="cmp-none">No linked records.</span>}
        {items.map((l, i) => (
          <button key={i} type="button" className="cmp-link" onClick={l.onClick}>
            <span><b>{l.label}</b>{l.sub && <em>{l.sub}</em>}</span>
            {l.count !== undefined && <i>{l.count}</i>}
            <ArrowRight size={13} />
          </button>
        ))}
      </div>
    </section>
  );
}

export function Monogram({ name, size = 30 }: { name: string; size?: number }) {
  const parts = name.replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
  return <span className="comply-vavatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>{ini}</span>;
}

/** C · I · A levels as three small letter pills. */
export function Cia({ v }: { v: [string, string, string] }) {
  return (
    <span className="cmp-cia" title={`Confidentiality ${v[0]} · Integrity ${v[1]} · Availability ${v[2]}`}>
      {v.map((x, i) => <i key={i} className={`l-${x}`}>{x}</i>)}
    </span>
  );
}

export const LEVEL_WORD: Record<string, string> = { L: 'Low', M: 'Medium', H: 'High' };
