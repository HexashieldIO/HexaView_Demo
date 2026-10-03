import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Send, CheckCircle2, XCircle, Inbox, RotateCcw } from 'lucide-react';
import { Drawer, Modal } from '../../../components/Overlay';
import { Btn, Callout } from '../../../components/ui';
import { QA_COLS, TP_LEVEL_COLOR, TP_STATE_COLOR, type QaCol, type QSetId, type TpQuestionnaire } from '../../../data/modules/tprm';
import { fmtNum, isoDate, daysAgo } from '../../../lib/format';
import { useTprm } from './state';
import { Facet, GapCard, Mono, Pill, ScoreBar, fmtDays } from './ui';

const PAGE = 8;

export function Questionnaires() {
  const { sup, qas, qsets, byId, moveQa, openSupplier, grc } = useTprm();
  const [sp, setSp] = useSearchParams();
  const [lib, setLib] = useState(false);
  const [more, setMore] = useState<Partial<Record<QaCol, number>>>({});
  const setF = (sp.get('set') as QSetId | null) ?? 'all';
  const openId = sp.get('qa');
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null || v === 'all') n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const shown = qas.filter((q) => setF === 'all' || q.set === setF);
  const open = openId ? qas.find((q) => q.id === openId) : undefined;
  const overdue = shown.filter((q) => q.col === 'Sent' && (q.dueInDays ?? 0) < 0).length;

  return (
    <div className="tp-stack">
      <div className="tp-row">
        <p className="tp-intro" style={{ margin: 0 }}>
          <b>{fmtNum(qas.length)}</b> assessments in flight, of {fmtNum(sup.length)} suppliers in the register. A column is whose move it is.
          {overdue > 0 && <> <span style={{ color: 'var(--bad)', fontWeight: 600 }}>{overdue} overdue with the supplier.</span></>}
        </p>
        <span className="tp-spacer" />
        <Btn sm onClick={() => setLib(true)}><BookOpen /> Question set library</Btn>
      </div>
      <div className="tp-facets" style={{ border: '1px solid var(--card-border)', borderRadius: 12, background: 'var(--card-bg)' }}>
        <Facet<QSetId> label="Question set" value={setF} options={qsets.map((s) => ({ id: s.id, label: s.name, n: qas.filter((q) => q.set === s.id).length }))} onChange={(v) => setParam('set', v)} />
        <span className="tp-foot-note">Sent from {grc} · supplier answers flow back here</span>
      </div>

      <div className="tp-kanban">
        {QA_COLS.map((col) => {
          const items = shown.filter((q) => q.col === col.id).sort((a, b) => (col.id === 'Sent' ? (a.dueInDays ?? 0) - (b.dueInDays ?? 0) : (byId.get(b.supplierId)?.score ?? 0) - (byId.get(a.supplierId)?.score ?? 0)));
          const lim = more[col.id] ?? PAGE;
          return (
            <section key={col.id} className="tp-col">
              <div className="tp-col-head" style={{ ['--tc' as string]: col.color }}>
                <b>{col.id} <em>{items.length}</em></b>
                <span>{col.sub}</span>
              </div>
              {items.slice(0, lim).map((q) => <QaCard key={q.id} q={q} onOpen={() => setParam('qa', q.id)} />)}
              {items.length === 0 && <div className="tp-empty">Nothing here</div>}
              {items.length > lim && <button type="button" className="tp-more" onClick={() => setMore((m) => ({ ...m, [col.id]: lim + PAGE * 2 }))}>Show {Math.min(PAGE * 2, items.length - lim)} more of {items.length - lim}</button>}
            </section>
          );
        })}
      </div>

      {open && (() => {
        const s = byId.get(open.supplierId);
        const set = qsets.find((x) => x.id === open.set);
        if (!s || !set) return null;
        const due = fmtDays(open.dueInDays);
        const close = () => setParam('qa', null);
        const act = (col: QaCol) => moveQa(open.id, col);
        return (
          <Drawer
            title={<span className="tp-row" style={{ gap: 10 }}><Mono s={s} size="lg" />{set.name}</span>}
            sub={<span className="tp-row" style={{ gap: 6, marginTop: 6 }}><span className="tp-muted" style={{ fontFamily: 'var(--font-mono)' }}>{open.id}</span><span>{s.name}</span><Pill color={QA_COLS.find((x) => x.id === open.col)!.color}>{open.col}</Pill>{due.text && <Pill color={due.color}>{due.text}</Pill>}</span>}
            onClose={close}
            footer={<>
              <Btn onClick={() => { close(); openSupplier(s.id); }}>See the full assessment</Btn>
              {open.col === 'Draft' && <Btn primary color="var(--m-comply)" onClick={() => act('Sent')}><Send /> Send to supplier</Btn>}
              {open.col === 'Sent' && <Btn primary color="var(--m-comply)" onClick={() => act('Submitted')}><Inbox /> Mark as submitted</Btn>}
              {open.col === 'Submitted' && <><Btn onClick={() => act('Rejected')}><XCircle /> Reject</Btn><Btn primary color="var(--m-comply)" onClick={() => act('Approved')}><CheckCircle2 /> Approve</Btn></>}
              {open.col === 'Rejected' && <Btn primary color="var(--m-comply)" onClick={() => act('Sent')}><RotateCcw /> Send back to supplier</Btn>}
            </>}
          >
            <dl className="tp-kv">
              <dt>Question set</dt><dd>{set.name} · {set.questions} questions</dd>
              <dt>Sector annex</dt><dd>{set.annex}</dd>
              <dt>Sent</dt><dd>{open.sentDaysAgo === null ? 'Not sent yet' : `${isoDate(daysAgo(open.sentDaysAgo))} (${open.sentDaysAgo === 0 ? 'today' : `${open.sentDaysAgo} days ago`})`}</dd>
              {open.returnedDaysAgo !== null && <><dt>Returned</dt><dd>{isoDate(daysAgo(open.returnedDaysAgo))}</dd></>}
              {open.dueInDays !== null && <><dt>Due</dt><dd style={{ color: due.color }}>{due.text}</dd></>}
              <dt>Supplier contact</dt><dd>{s.contact}</dd>
              <dt>Risk score</dt><dd><ScoreBar score={s.score} /> <span className="tp-muted" style={{ marginLeft: 6 }}>{s.level} risk</span></dd>
              <dt>Supplier state</dt><dd><Pill color={TP_STATE_COLOR[s.state]}>{s.state}</Pill></dd>
            </dl>
            {open.col === 'Submitted' && <Callout>Answers are back and unreviewed. Approving accepts them as evidence for the checks this set covers ({set.domains.join(', ')}); rejecting sends it back with a 14-day clock.</Callout>}
            <div>
              <div className="tp-label">Open gaps at this supplier ({s.gaps.length})</div>
              {s.gaps.length ? <div className="tp-gaps">{s.gaps.map((g) => <GapCard key={g.key} gap={g} />)}</div> : <Callout kind="good">No open gaps on this supplier's record.</Callout>}
            </div>
          </Drawer>
        );
      })()}

      {lib && (
        <Modal title="Question set library" sub="Four standard sets, each carrying a sector annex for the regimes in scope · standard content, read-only" onClose={() => setLib(false)} footer={<Btn onClick={() => setLib(false)}>Close</Btn>}>
          <div className="tp-sets">
            {qsets.map((s) => (
              <div key={s.id} className="tp-set">
                <h4>{s.name}<em>{s.questions} questions</em></h4>
                <p>{s.blurb}</p>
                <div className="tp-tags">{s.domains.map((d) => <span key={d} className="tp-tag">{d}</span>)}</div>
                <p><b style={{ color: 'var(--text-primary)' }}>Annex:</b> {s.annex}</p>
                <p className="tp-muted" style={{ fontSize: 11.5 }}>Used for: {s.use} · in flight {qas.filter((q) => q.set === s.id && q.col !== 'Approved').length}</p>
                <ul>{s.sample.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function QaCard({ q, onOpen }: { q: TpQuestionnaire; onOpen: () => void }) {
  const { byId, qsets } = useTprm();
  const s = byId.get(q.supplierId);
  const set = qsets.find((x) => x.id === q.set);
  if (!s || !set) return null;
  const due = q.col === 'Sent' || q.col === 'Rejected' ? fmtDays(q.dueInDays) : null;
  return (
    <button type="button" className="tp-card" onClick={onOpen}>
      <span className="tp-card-top"><span>{q.id}</span>{due && due.text && <span className="tp-due" style={{ background: `color-mix(in srgb, ${due.color} 18%, transparent)`, color: due.color }}>{due.text}</span>}</span>
      <span className="tp-card-set">{set.name}</span>
      <span className="tp-card-sup"><Mono s={s} size="sm" /><span>{s.name}</span></span>
      <span className="tp-card-foot"><span>{set.questions} questions</span><span className="tp-score"><b style={{ color: TP_LEVEL_COLOR[s.level] }}>{s.score}</b><span className="tp-score-bar" style={{ width: 36 }}><i style={{ width: `${s.score}%`, background: TP_LEVEL_COLOR[s.level] }} /></span></span></span>
    </button>
  );
}
