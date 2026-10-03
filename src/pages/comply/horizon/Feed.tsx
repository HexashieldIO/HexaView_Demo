import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ListPlus, MinusCircle, Rss } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Card, Badge, Btn, Chip, StatusBadge, Stacked, Legend, IcoBox } from '../../../components/ui';
import { FEED_COLOR, JUR_HEX, type FeedStatus, type Reg } from '../../../data/modules/horizon';
import { daysAgo, fmtDate } from '../../../lib/format';
import { useHorizon, useHzNav, HZ_TONE } from './state';
import { RegDrawer } from './RegDrawer';

const STATUSES: FeedStatus[] = ['new', 'assessed', 'actions raised', 'not applicable'];

export default function Feed() {
  const { customer: c, toast } = useApp();
  const { regs, setStatus, openRaise } = useHorizon();
  const { sp, set } = useHzNav();
  const nav = useNavigate();
  const [sel, setSel] = useState<Reg | null>(null);
  const status = sp.get('status') ?? 'all';
  const items = regs.filter((r) => r.update).sort((a, b) => (a.update!.daysAgo - b.update!.daysAgo));
  const shown = items.filter((r) => status === 'all' || r.feedStatus === status);
  const count = (s: FeedStatus) => items.filter((r) => r.feedStatus === s).length;
  const raised = regs.reduce((s, r) => s + r.raised, 0);

  return (
    <>
      <div className="grid g-3-2" style={{ alignItems: 'start' }}>
        <Card title="Triage" sub="Every regulatory update is assessed, actioned or ruled out · click a status to filter" toneColor={HZ_TONE}>
          <Stacked tall showLabels parts={STATUSES.map((s) => ({ value: count(s), color: FEED_COLOR[s], label: s }))} />
          <div style={{ marginTop: 8 }} className="row wrap">
            {STATUSES.map((s) => (
              <Chip key={s} on={status === s} onClick={() => set('status', status === s ? null : s)} color={FEED_COLOR[s]}>
                {s.charAt(0).toUpperCase() + s.slice(1)} · {count(s)}
              </Chip>
            ))}
            <Chip on={status === 'all'} onClick={() => set('status', null)}>All · {items.length}</Chip>
          </div>
        </Card>
        <Card title="Tasks raised from regulatory change" sub="Created in HexaComply, owned and evidenced like any other task" toneColor={HZ_TONE}>
          <div className="row" style={{ gap: 14 }}>
            <button type="button" onClick={() => nav('/comply/caas?section=tasks')} style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer', textAlign: 'left' }} title="Source: HexaComply tasks · click to open">
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 30 }}>{raised}</b>
              <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>tasks open from {regs.filter((r) => r.raised).length} regulations</span>
            </button>
            <span className="spacer" />
            <Btn sm onClick={() => nav('/comply/caas?section=tasks')}>Open tasks</Btn>
          </div>
          <div style={{ marginTop: 10 }}>
            <Legend items={[{ label: 'Sources: EU Official Journal, ESAs, ENISA, national regulators, standards bodies and HexaShield analysts', color: HZ_TONE }]} />
          </div>
        </Card>
      </div>

      <Card title="Change feed" count={shown.length} sub={`Recent regulatory updates and consultations relevant to ${c.name}, newest first`}>
        <div className="hz-feed">
          {shown.map((r) => {
            const u = r.update!;
            return (
              <div key={r.id} className={`hz-item ${r.feedStatus === 'new' ? 'new' : ''}`}>
                <div className="hz-item-head">
                  <IcoBox color={JUR_HEX[r.jur]}><Rss /></IcoBox>
                  <h4>{u.title}</h4>
                  <StatusBadge value={r.feedStatus} map={FEED_COLOR} />
                </div>
                <div className="hz-item-meta">
                  <span>{fmtDate(daysAgo(u.daysAgo))}</span>·<span>{u.source}</span>·
                  <button type="button" className="link" onClick={() => setSel(r)}>{r.short}</button>
                  <Badge color={JUR_HEX[r.jur]}>{r.jur}</Badge>
                  {r.raised > 0 && <Badge color={HZ_TONE}>{r.raised} tasks raised</Badge>}
                </div>
                <div className="hz-two">
                  <div><h5>What changed</h5><p>{u.changed}</p></div>
                  <div><h5>What you need to do</h5><p>{u.todo}</p></div>
                </div>
                <div className="hz-item-foot">
                  <Btn sm primary color={HZ_TONE} onClick={() => openRaise(r)}><ListPlus size={13} /> Raise tasks</Btn>
                  {r.feedStatus !== 'assessed' && r.feedStatus !== 'actions raised' && (
                    <Btn sm onClick={() => { setStatus(r.id, 'assessed'); toast(`${r.short} update marked as assessed by ${c.people.grcLead.name}`); }}><CheckCircle2 size={13} /> Mark assessed</Btn>
                  )}
                  {r.feedStatus !== 'not applicable' && (
                    <Btn sm ghost onClick={() => { setStatus(r.id, 'not applicable'); toast(`${r.short} update marked not applicable; rationale logged in the audit trail`); }}><MinusCircle size={13} /> Not applicable</Btn>
                  )}
                  <span className="spacer" />
                  <span className="muted" style={{ fontSize: 11 }}>Owner {r.owner.name}</span>
                  {r.raised > 0 && <button type="button" className="link" onClick={() => nav('/comply/caas?section=tasks')}>View tasks →</button>}
                </div>
              </div>
            );
          })}
          {!shown.length && <div className="empty">No updates with this status.</div>}
        </div>
      </Card>
      {sel && <RegDrawer reg={regs.find((r) => r.id === sel.id) ?? sel} onClose={() => setSel(null)} />}
    </>
  );
}
