import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, PauseCircle, XCircle, ArrowRight, Gavel, Star } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Badge, Btn, Chip, KV, Callout, MiniStat } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { fmtDate, fmtDateShort, fmtTime } from '../../lib/format';
import { DECISION_COLOR, type Decision, type DecisionRequest, type DecisionStatus } from '../../data/modules/boardMeeting';
import { useBm, useBmNav, BM_TONE, type Outcome } from './state';

const OUTCOME_ICON = { Approved: <Check />, Deferred: <PauseCircle />, Rejected: <XCircle /> };

function RequestCard({ q }: { q: DecisionRequest }) {
  const { toast } = useApp();
  const nav = useNavigate();
  const { recorded, record, m } = useBm();
  const rc = recorded[q.id];
  const [opt, setOpt] = useState(q.recommended);
  const [note, setNote] = useState('');

  const submit = (outcome: Outcome) => {
    record(q.id, { outcome, option: opt, note: note.trim() });
    toast(`${outcome}: ${q.title} · recorded in the decisions log and the draft minutes`);
  };

  return (
    <div className={`bm-req ${rc ? 'done' : ''}`} style={{ '--tone': rc ? DECISION_COLOR[rc.outcome] : BM_TONE } as CSSProperties}>
      <div className="row between wrap" style={{ gap: 8 }}>
        <h4><Gavel size={15} /> {q.title}</h4>
        {rc ? <Badge color={DECISION_COLOR[rc.outcome]} solid>{rc.outcome} · {fmtTime(rc.at)}</Badge> : <Badge color="var(--sev-high)" dot>For decision · {fmtDateShort(m.date)}</Badge>}
      </div>
      <p className="bm-req-ctx">{q.context}</p>
      <div className="bm-opts">
        {q.options.map((o) => (
          <button key={o.id} type="button" disabled={!!rc} className={`bm-opt ${opt === o.id ? 'on' : ''}`} onClick={() => setOpt(o.id)}>
            <span className="bm-radio" />
            <span style={{ minWidth: 0 }}>
              <b>{o.label}{o.id === q.recommended && <em><Star size={10} /> Recommended</em>}</b>
              <small>{o.cost} · {o.effect}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="bm-req-why"><b>Management recommendation.</b> {q.why} <span className="muted">Paper owner: {q.owner.name}, {q.owner.role}.</span></div>
      {rc ? (
        <div className="row between wrap" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>{rc.note ? `Note: “${rc.note}”` : 'No note recorded.'}</span>
          <button type="button" className="link" onClick={() => nav(q.paper.path)}>{q.paper.label} <ArrowRight size={12} /></button>
        </div>
      ) : (
        <>
          <textarea className="bm-note" rows={2} placeholder="Note for the minutes (conditions, dissent, rationale)…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row between wrap" style={{ gap: 8 }}>
            <button type="button" className="link" onClick={() => nav(q.paper.path)} title={`Source: ${q.paper.source}`}>Paper: {q.paper.label} <ArrowRight size={12} /></button>
            <span className="row" style={{ gap: 6 }}>
              <Btn sm onClick={() => submit('Rejected')}><XCircle /> Reject</Btn>
              <Btn sm onClick={() => submit('Deferred')}><PauseCircle /> Defer</Btn>
              <Btn sm primary color="var(--good)" onClick={() => submit('Approved')}><Check /> Approve</Btn>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const STATUSES: DecisionStatus[] = ['In progress', 'Overdue', 'Implemented', 'Approved', 'Deferred', 'Rejected'];

export default function Decisions() {
  const nav = useNavigate();
  const { requests, decisions, recorded } = useBm();
  const { sp, set } = useBmNav();
  const [sel, setSel] = useState<Decision | null>(null);
  const status = sp.get('status') as DecisionStatus | null;
  const rows = decisions.filter((d) => !status || d.status === status);
  const count = (s: DecisionStatus) => decisions.filter((d) => d.status === s).length;
  const used = STATUSES.filter((s) => count(s) > 0);

  return (
    <>
      <Card title="Decisions requested at the next meeting" sub="Options and management's recommendation. Record the outcome in session: it is written to the log and the draft minutes" count={requests.length}
        actions={<Badge color={Object.keys(recorded).length === requests.length ? 'var(--good)' : 'var(--sev-medium)'} dot>{Object.keys(recorded).length} of {requests.length} recorded</Badge>}>
        <div className="bm-reqs">
          {requests.map((q) => <RequestCard key={q.id} q={q} />)}
        </div>
      </Card>

      <Card title="Decisions log" sub="Every cyber decision taken by the board and its committees, with rationale, owner and the live record it relates to" count={decisions.length}
        actions={<div className="chips"><Chip on={!status} onClick={() => set('status', null)}>All</Chip>{used.map((s) => <Chip key={s} on={status === s} color={DECISION_COLOR[s]} onClick={() => set('status', status === s ? null : s)}>{s} {count(s)}</Chip>)}</div>}>
        <div className="bm-mini-row">
          <MiniStat value={count('Implemented')} label="Implemented" color="var(--good)" />
          <MiniStat value={count('In progress')} label="In progress" color="var(--m-view)" />
          <MiniStat value={count('Overdue')} label="Overdue" color={count('Overdue') ? 'var(--bad)' : undefined} />
          <MiniStat value={decisions.filter((d) => d.inSession).length} label="Recorded this session" />
        </div>
        <table className="bm-tbl hover">
          <thead><tr><th>Date</th><th>Decision</th><th>Owner</th><th>Status</th><th>Linked record</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={d.inSession ? 'bm-new' : ''} onClick={() => setSel(d)} title="Open the decision">
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(d.date)}<small className="muted mono" style={{ display: 'block' }}>{d.id}</small></td>
                <td><b style={{ fontWeight: 600 }}>{d.decision}</b><small className="muted" style={{ display: 'block', marginTop: 2 }}>{d.rationale}</small></td>
                <td style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{d.owner.name}<small className="muted" style={{ display: 'block' }}>{d.owner.role}</small></td>
                <td><Badge color={DECISION_COLOR[d.status]} dot>{d.status}</Badge></td>
                <td><button type="button" className="bm-link" onClick={(e) => { e.stopPropagation(); nav(d.link.path); }} title={`Source: ${d.link.source}`}>{d.link.label} →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {sel && (
        <Drawer title={sel.decision} sub={`${sel.id} · ${sel.forum} · ${fmtDate(sel.date)}`} icon={OUTCOME_ICON[sel.status as Outcome]} onClose={() => setSel(null)}
          footer={<Btn primary color={BM_TONE} onClick={() => { const p = sel.link.path; setSel(null); nav(p); }}>Open {sel.link.label} <ArrowRight /></Btn>}>
          <KV rows={[
            ['Status', <Badge key="s" color={DECISION_COLOR[sel.status]} dot>{sel.status}</Badge>],
            ['Forum', sel.forum],
            ['Date', fmtDate(sel.date)],
            ['Owner', `${sel.owner.name} · ${sel.owner.role}`],
            ['Rationale', sel.rationale],
            ['Linked record', `${sel.link.label} (${sel.link.source})`],
            ...(sel.note ? [['Note', sel.note] as [string, string]] : []),
          ]} />
          <Callout>{sel.inSession ? 'Recorded in this session; it will appear in the draft minutes and the next board pack.' : 'Decisions are minuted and retained with the evidence that supported them, so the board can show what it knew and when.'}</Callout>
        </Drawer>
      )}
    </>
  );
}
