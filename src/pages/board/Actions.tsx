import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, RotateCcw, Bell, ArrowRight } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Badge, Btn, Chip, Stacked, Legend } from '../../components/ui';
import { useIntro } from '../../lib/useIntro';
import { NOW, fmtDateShort } from '../../lib/format';
import { isOverdue, type BoardAction } from '../../data/modules/boardMeeting';
import { useBm, useBmNav, BM_TONE, initials } from './state';

type Filter = 'all' | 'open' | 'overdue' | 'complete';
const dayDiff = (d: Date) => Math.round((d.getTime() - NOW.getTime()) / 86_400_000);

function statusOf(a: BoardAction): { label: string; color: string } {
  if (a.status === 'Complete') return { label: 'Complete', color: 'var(--good)' };
  if (isOverdue(a)) return { label: 'Overdue', color: 'var(--bad)' };
  return { label: a.status, color: a.status === 'In progress' ? 'var(--m-view)' : 'var(--text-muted)' };
}

export default function Actions() {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const { actions, completeAction, m } = useBm();
  const { sp, set } = useBmNav();
  const anim = useIntro(`bm-a-${c.id}`, 1400);
  const filter = (sp.get('filter') as Filter | null) ?? 'all';
  const overdue = actions.filter(isOverdue);
  const complete = actions.filter((a) => a.status === 'Complete');
  const open = actions.filter((a) => a.status !== 'Complete' && !isOverdue(a));
  const rows = actions.filter((a) => filter === 'all' || (filter === 'overdue' ? isOverdue(a) : filter === 'complete' ? a.status === 'Complete' : a.status !== 'Complete'))
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || a.due.getTime() - b.due.getTime());
  const pct = Math.round((complete.length / Math.max(1, actions.length)) * 100);

  return (
    <>
      <div className="grid g4">
        {[
          { k: 'all' as Filter, v: actions.length, l: 'Actions carried forward', color: BM_TONE },
          { k: 'overdue' as Filter, v: overdue.length, l: 'Overdue', color: 'var(--bad)' },
          { k: 'open' as Filter, v: open.length, l: 'Open, on track', color: 'var(--m-reports)' },
          { k: 'complete' as Filter, v: complete.length, l: `Complete · ${pct}%`, color: 'var(--good)' },
        ].map((s) => (
          <button key={s.k} type="button" className={`bm-stat ${filter === s.k ? 'on' : ''}`} style={{ '--tone': s.color } as CSSProperties} onClick={() => set('filter', s.k)} title="Source: board action log · filter the tracker">
            <b className="num">{Math.round(anim(s.v))}</b>
            <span>{s.l}</span>
          </button>
        ))}
      </div>

      <Card title="Actions tracker" sub={`Actions from previous meetings, due back to the ${m.committee.toLowerCase()} · completion needs evidence from the live source`}
        actions={<div className="chips">{(['all', 'open', 'overdue', 'complete'] as Filter[]).map((f) => <Chip key={f} on={filter === f} onClick={() => set('filter', f)}>{f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</Chip>)}</div>}>
        <div style={{ marginBottom: 12 }}>
          <Stacked tall parts={[{ value: complete.length, color: '#2dd4bf', label: 'Complete' }, { value: open.length, color: '#4b7bd8', label: 'Open' }, { value: overdue.length, color: '#e0345e', label: 'Overdue' }]} />
          <Legend items={[{ label: `Complete ${complete.length}`, color: '#2dd4bf' }, { label: `Open ${open.length}`, color: '#4b7bd8' }, { label: `Overdue ${overdue.length}`, color: '#e0345e' }]} />
        </div>
        <table className="bm-tbl">
          <thead><tr><th>Ref</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th>Evidence of completion</th><th /></tr></thead>
          <tbody>
            {rows.map((a) => {
              const st = statusOf(a);
              const dd = dayDiff(a.due);
              return (
                <tr key={a.id} className={isOverdue(a) ? 'bm-overdue' : a.status === 'Complete' ? 'bm-done' : ''}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.id}<small className="muted" style={{ display: 'block' }}>{fmtDateShort(a.raised)}</small></td>
                  <td style={{ maxWidth: 380 }}>{a.text}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className="bm-av sm">{initials(a.owner.name)}</span>{a.owner.name}<small className="muted" style={{ display: 'block', marginLeft: 26 }}>{a.owner.role}</small></td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(a.due)}<small style={{ display: 'block', color: isOverdue(a) ? 'var(--bad)' : 'var(--text-muted)', fontWeight: isOverdue(a) ? 700 : 400 }}>{a.status === 'Complete' ? `done ${fmtDateShort(a.completedAt ?? a.due)}` : dd < 0 ? `${-dd} d overdue` : dd === 0 ? 'due today' : `in ${dd} d`}</small></td>
                  <td><Badge color={st.color} dot solid={st.label === 'Overdue'}>{st.label}</Badge></td>
                  <td><button type="button" className="bm-link" onClick={() => nav(a.evidence.path)} title={`Source: ${a.evidence.source}`}>{a.evidence.label} <ArrowRight size={11} /></button></td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {a.status === 'Complete'
                      ? <Btn sm ghost onClick={() => completeAction(a.id, false)} title="Reopen this action"><RotateCcw /></Btn>
                      : <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          {isOverdue(a) && <Btn sm ghost onClick={() => toast(`Reminder sent to ${a.owner.name} · copied to ${m.secretary.name}`)} title="Chase the owner"><Bell /></Btn>}
                          <Btn sm color="var(--good)" onClick={() => { completeAction(a.id, true); toast(`${a.id} marked complete · evidence: ${a.evidence.label}`); }}><Check /> Complete</Btn>
                        </span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="empty">No actions in this view.</div>}
      </Card>
    </>
  );
}
