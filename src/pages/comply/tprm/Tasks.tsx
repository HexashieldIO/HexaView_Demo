import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Card, Btn, Callout } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { TP_DOMAINS, TP_PRIORITY_COLOR, type TpDomain, type TpGap, type TpPriority, type TpTask } from '../../../data/modules/tprm';
import { daysAgo, daysAhead, isoDate } from '../../../lib/format';
import { useTprm } from './state';
import { Facet, FacetSelect, Pill, Mono, scoreColor } from './ui';

const PRIOS: TpPriority[] = ['High', 'Medium', 'Low'];

export function Tasks() {
  const { tasks, owners, byId, setDone, openSupplier, grc } = useTprm();
  const [sp, setSp] = useSearchParams();
  const [raise, setRaise] = useState(false);
  const prio = (sp.get('priority') as TpPriority | null) ?? 'all';
  const supF = sp.get('supplier') ?? 'all';
  const ownerF = sp.get('owner') ?? 'all';
  const domF = (sp.get('domain') as TpDomain | null) ?? 'all';
  const focus = sp.get('task');
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null || v === 'all') n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const open = tasks.filter((t) => !t.done);
  const doneN = tasks.length - open.length;
  const match = (t: TpTask) => (prio === 'all' || t.priority === prio) && (supF === 'all' || t.supplierId === supF) && (ownerF === 'all' || t.owner === ownerF) && (domF === 'all' || t.domain === domF);
  const openShown = open.filter(match).sort((a, b) => a.dueInDays - b.dueInDays);
  const doneShown = tasks.filter((t) => t.done && match(t)).sort((a, b) => (a.completedDaysAgo ?? 0) - (b.completedDaysAgo ?? 0));
  const supOpts = useMemo(() => [...new Map(tasks.map((t) => [t.supplierId, t.supplierName])).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, label]) => ({ id, label })), [tasks]);
  const ownerOpts = useMemo(() => [...new Set([...owners, ...tasks.map((t) => t.owner)])].map((o) => ({ id: o, label: o })), [owners, tasks]);

  const row = (t: TpTask) => {
    const s = byId.get(t.supplierId);
    const overdue = !t.done && t.dueInDays < 0;
    return (
      <div key={t.id} className={`tp-task ${t.done ? 'done' : ''} ${focus === t.id || t.raisedDaysAgo === 0 && t.byUser ? 'tp-new' : ''}`}>
        <button type="button" className={`tp-check ${t.done ? 'on' : ''}`} onClick={() => setDone(t.id, !t.done)} title={t.done ? 'Reopen' : 'Complete'} aria-label={t.done ? 'Reopen task' : 'Complete task'}>{t.done && <Check size={12} strokeWidth={3} />}</button>
        <div className="tp-task-main">
          <span className="tp-task-title">{t.title}</span>
          <span className="tp-task-meta">
            <span className="tp-id">{t.id}</span>
            <Pill color={TP_PRIORITY_COLOR[t.priority]}>{t.priority}</Pill>
            <span>{t.domain}</span>
            {s && <button type="button" onClick={() => openSupplier(s.id)} className="tp-row" style={{ gap: 5 }}><Mono s={s} size="sm" />{s.name} <b style={{ color: scoreColor(s.score) }}>{s.score}</b></button>}
            {!s && <span>{t.supplierName}</span>}
            <span>Owner {t.owner}</span>
            <span>Raised {t.raisedDaysAgo === 0 ? 'today' : isoDate(daysAgo(t.raisedDaysAgo))}</span>
            {t.note && <span>· {t.note}</span>}
          </span>
        </div>
        <div className="tp-task-right">
          {t.done ? <span style={{ color: 'var(--good)' }}>Completed {t.completedDaysAgo ? isoDate(daysAgo(t.completedDaysAgo)) : 'today'}</span>
            : <span style={{ color: overdue ? 'var(--bad)' : t.dueInDays <= 7 ? 'var(--sev-medium)' : undefined, fontWeight: overdue ? 600 : undefined }}>{overdue ? `${-t.dueInDays}d overdue` : `Due ${isoDate(daysAhead(t.dueInDays))}`}</span>}
          {t.done && <span>Re-checked on next sync</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="tp-stack">
      <div className="tp-row">
        <p className="tp-intro" style={{ margin: 0 }}><b>{open.length} open, {doneN} completed.</b> Each one closes a named gap at a named supplier — new ones are raised from the Exposure tab or a supplier's record, and land in {grc}.</p>
        <span className="tp-spacer" />
        <Btn sm primary color="var(--m-comply)" onClick={() => setRaise(true)}><Plus /> Raise from a recommendation</Btn>
      </div>
      <Card flush>
        <div className="tp-facets">
          <Facet<TpPriority> label="Priority" value={prio} options={PRIOS.map((p) => ({ id: p, label: p, n: open.filter((t) => t.priority === p).length }))} onChange={(v) => setParam('priority', v)} />
          <Facet<TpDomain> label="Domain" value={domF} options={TP_DOMAINS.map((d) => ({ id: d, label: d, n: open.filter((t) => t.domain === d).length }))} onChange={(v) => setParam('domain', v)} />
          <FacetSelect label="Supplier" value={supF} all="All suppliers" options={supOpts} onChange={(v) => setParam('supplier', v)} />
          <FacetSelect label="Owner" value={ownerF} all="All owners" options={ownerOpts} onChange={(v) => setParam('owner', v)} />
        </div>
        <div className="tp-group-h">Open <Pill color="var(--m-comply)">{openShown.length}</Pill><span className="tp-spacer" /><span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{openShown.filter((t) => t.dueInDays < 0).length} overdue</span></div>
        {openShown.map(row)}
        {openShown.length === 0 && <div className="tp-empty" style={{ padding: 14 }}>No open tasks match these filters.</div>}
        <div className="tp-group-h">Completed <Pill color="var(--good)">{doneShown.length}</Pill></div>
        {doneShown.map(row)}
        {doneShown.length === 0 && <div className="tp-empty" style={{ padding: 14 }}>Nothing completed yet.</div>}
      </Card>
      {raise && <RaiseModal onClose={() => setRaise(false)} />}
    </div>
  );
}

function RaiseModal({ onClose }: { onClose: () => void }) {
  const { sup, owners, taskFor, raise, me, grc } = useTprm();
  const [q, setQ] = useState('');
  const [dom, setDom] = useState<TpDomain | 'all'>('all');
  const [pick, setPick] = useState<TpGap | null>(null);
  const [owner, setOwner] = useState(me);
  const [prio, setPrio] = useState<TpPriority | 'auto'>('auto');
  const [due, setDue] = useState('30');
  const [note, setNote] = useState('');
  const recs = useMemo(() => sup.filter((s) => s.live).flatMap((s) => s.gaps).filter((g) => !taskFor(g.key)).sort((a, b) => b.score - a.score), [sup, taskFor]);
  const shown = recs.filter((g) => (dom === 'all' || g.domain === dom) && (!q.trim() || `${g.supplierName} ${g.title}`.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 40);
  const byId = new Map(sup.map((s) => [s.id, s]));
  return (
    <Modal
      title="Raise from a recommendation"
      sub={<>Pick a gap; the task lands in <b>{grc}</b> with its supplier attached</>}
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color="var(--m-comply)" onClick={() => { if (pick) { raise(pick, { owner, priority: prio === 'auto' ? undefined : prio, dueInDays: Number(due), note: note.trim() || undefined }); onClose(); } }}>{pick ? 'Raise task' : 'Pick a recommendation'}</Btn></>}
    >
      <div className="tp-row">
        <input className="tp-search" placeholder="Search supplier or gap…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="tp-select" value={dom} onChange={(e) => setDom(e.target.value as TpDomain | 'all')}>
          <option value="all">All domains</option>
          {TP_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="tp-foot-note">{recs.length} recommendations without a task, worst first</span>
      </div>
      <div className="tp-pick">
        {shown.map((g) => {
          const s = byId.get(g.supplierId);
          return (
            <button key={g.key} type="button" className={pick?.key === g.key ? 'on' : ''} onClick={() => setPick(g)}>
              {s ? <Mono s={s} size="sm" /> : <span />}
              <span><b>{g.title}</b><span>{g.supplierName} · {g.domain} · score {g.score}</span></span>
            </button>
          );
        })}
        {shown.length === 0 && <div className="tp-empty">No recommendations match.</div>}
      </div>
      <div className="tp-form">
        <label>Owner<select className="tp-select" value={owner} onChange={(e) => setOwner(e.target.value)}>{owners.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>Priority<select className="tp-select" value={prio} onChange={(e) => setPrio(e.target.value as TpPriority | 'auto')}><option value="auto">From supplier risk</option>{PRIOS.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label>Due in<select className="tp-select" value={due} onChange={(e) => setDue(e.target.value)}>{['7', '14', '30', '60', '90'].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
      </div>
      <label className="tp-form" style={{ gridTemplateColumns: '1fr' }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Note to owner (optional)</span><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {pick && <Callout>{pick.guidance}</Callout>}
    </Modal>
  );
}
