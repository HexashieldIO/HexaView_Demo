import { useState } from 'react';
import { CalendarClock, CheckCircle2, Plus, Upload, ExternalLink, ThumbsUp, AlertTriangle } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, Chip, KV } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Overlay';
import { DEST_META, timings, type IrIncident, type ActionDest } from '../../data/modules/incident';
import { useIr, IrPage, IncidentPicker, NoIncident, Pill, fmtT, fmtSpan, IR_TONE } from './parts';
import { ir } from './store';

const MIN = 60_000;
const ROOT_CATS = ['Identity', 'Third party', 'Vulnerability management', 'Process', 'Detection gap', 'Segmentation', 'Awareness', 'Configuration', 'Backup & recovery'];
const DEST_COLOR: Record<ActionDest, string> = { comply: 'var(--m-comply)', programme: 'var(--m-programme)', detection: 'var(--m-soc)', exercise: 'var(--m-ops)' };

export default function Review() {
  return <IrPage><Inner /></IrPage>;
}
function Inner() {
  const { focus } = useIr();
  return <><IncidentPicker label="Review for" />{focus ? <Rv inc={focus} /> : <NoIncident />}</>;
}

function Rv({ inc }: { inc: IrIncident }) {
  const { c, actor, toast, nav, incidents, closed } = useIr();
  const [add, setAdd] = useState(false);
  const [well, setWell] = useState('');
  const [bad, setBad] = useState('');
  const rv = inc.review;
  const tm = timings(inc);
  const met = tm.filter((t) => t.min !== null && t.min <= t.target).length;
  const measured = tm.filter((t) => t.min !== null).length;
  const allActions = incidents.flatMap((i) => i.review.actions.map((a) => ({ a, i })));
  const openActions = allActions.filter((x) => !x.a.done);
  const pushed = allActions.filter((x) => x.a.pushed);
  const cats = ROOT_CATS.map((k) => ({ k, n: closed.filter((i) => i.review.rootCauses.includes(k)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const toggleCat = (k: string) => ir.setReview(c, inc.id, { rootCauses: rv.rootCauses.includes(k) ? rv.rootCauses.filter((x) => x !== k) : [...rv.rootCauses, k] });

  return (
    <>
      <p className="page-intro">
        Blameless post-incident review for <b>{inc.id}</b>, facilitated by {rv.facilitator}. Timing is measured from the audited timeline; actions are pushed to <button className="ir-link" onClick={() => nav('/comply/caas?section=tasks')}>HexaComply tasks</button>, the <button className="ir-link" onClick={() => nav('/programme/initiatives')}>Security Programme</button>, <button className="ir-link" onClick={() => nav('/soc/detection')}>detection engineering</button> and the <button className="ir-link" onClick={() => nav('/ops/exercises')}>exercise library</button>.
      </p>
      <KpiStrip toneColor={IR_TONE} items={[
        { label: 'Review status', value: rv.status.replace('_', ' ').replace(/^\w/, (x) => x.toUpperCase()), hint: rv.scheduledAt ? `${rv.status === 'complete' ? 'held' : 'scheduled'} ${fmtT(rv.completedAt ?? rv.scheduledAt)}` : 'not scheduled', toneColor: rv.status === 'complete' ? 'var(--good)' : IR_TONE, onClick: () => document.getElementById('ir-rv-actions')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaView IR review register' },
        { label: 'Targets met', value: `${met}/${measured}`, hint: 'timing metrics', toneColor: met === measured ? 'var(--good)' : 'var(--sev-medium)', onClick: () => document.getElementById('ir-rv-metrics')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaView IR audited timeline' },
        { label: 'Actions (this incident)', value: rv.actions.length, hint: `${rv.actions.filter((a) => a.pushed).length} pushed`, onClick: () => document.getElementById('ir-rv-actions')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaView IR review register' },
        { label: 'Open actions (all incidents)', value: openActions.length, hint: `${pushed.length} tracked in other modules`, to: '/comply/caas?section=tasks', source: 'HexaComply tasks · Security Programme' },
        { label: 'Reviews complete', value: `${incidents.filter((i) => i.review.status === 'complete').length}/${closed.length}`, hint: 'closed incidents', toneColor: 'var(--good)', source: 'HexaView IR review register' },
      ]} />

      <div className="grid g-3-2">
        <Card title="Timing metrics vs targets" sub="From the audited timeline; the marker is the target" >
          <div id="ir-rv-metrics">
            {tm.map((t) => {
              const max = Math.max(t.target * 2, t.min ?? 0);
              const ok = t.min !== null && t.min <= t.target;
              return (
                <div key={t.id} className="ir-metric">
                  <span>{t.label}<div className="ir-sub">target {fmtSpan(t.target * MIN)}</div></span>
                  <div className="ir-metric-track">
                    {t.min !== null && <i style={{ width: `${Math.min(100, (t.min / max) * 100)}%`, background: ok ? 'var(--good)' : 'var(--sev-high)' }} />}
                    <em style={{ left: `${(t.target / max) * 100}%` }} />
                  </div>
                  <b style={{ color: t.min === null ? 'var(--text-muted)' : ok ? 'var(--good)' : 'var(--sev-high)' }}>{t.min === null ? 'n/a' : fmtSpan(t.min * MIN)}</b>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Review" sub="Blameless: systems and decisions, not people">
          <KV rows={[
            ['Facilitator', rv.facilitator],
            ['Status', <Pill key="s" color={rv.status === 'complete' ? 'var(--good)' : IR_TONE} dot>{rv.status.replace('_', ' ')}</Pill>],
            ['When', rv.completedAt ? `Held ${fmtT(rv.completedAt)}` : rv.scheduledAt ? `Scheduled ${fmtT(rv.scheduledAt)}` : 'Not scheduled'],
            ['Attendees', inc.stakeholders.filter((s) => s.raci === 'R' || s.raci === 'A').map((s) => s.name.split(' (')[0]).slice(0, 6).join(', ')],
          ]} />
          <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
            {rv.status === 'not_started' && <Btn primary color={IR_TONE} onClick={() => { ir.scheduleReview(c, inc.id, 5 * 1440, actor); toast('Review scheduled in 5 days; invites sent through the Comms Hub'); }}><CalendarClock size={13} /> Schedule review</Btn>}
            {(rv.status === 'scheduled' || rv.status === 'in_progress') && <Btn primary color={IR_TONE} onClick={() => { ir.completeReview(c, inc.id, actor); toast('Review completed and logged'); }}><CheckCircle2 size={13} /> Mark review complete</Btn>}
            <Btn ghost onClick={() => nav('/ops/exercises')}><ExternalLink size={13} /> Exercise library</Btn>
          </div>
          {inc.status === 'active' && <Callout>Incident still active ({inc.phase}); the review can be scheduled now and held after recovery.</Callout>}
        </Card>
      </div>

      <div className="grid g2">
        <Card title={<><ThumbsUp size={14} style={{ verticalAlign: -2 }} /> What went well</>}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>{rv.wentWell.map((x, i) => <li key={i}>{x}</li>)}{!rv.wentWell.length && <li className="muted">Nothing recorded yet.</li>}</ul>
          <div className="row" style={{ gap: 6, marginTop: 10 }}><input className="input" value={well} onChange={(e) => setWell(e.target.value)} placeholder="Add an observation" aria-label="What went well" style={{ flex: 1 }} /><Btn sm disabled={!well.trim()} onClick={() => { ir.setReview(c, inc.id, { wentWell: [...rv.wentWell, well.trim()], status: rv.status === 'not_started' ? 'in_progress' : rv.status }); setWell(''); }}><Plus size={12} /></Btn></div>
        </Card>
        <Card title={<><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> What didn’t go well</>}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>{rv.didnt.map((x, i) => <li key={i}>{x}</li>)}{!rv.didnt.length && <li className="muted">Nothing recorded yet.</li>}</ul>
          <div className="row" style={{ gap: 6, marginTop: 10 }}><input className="input" value={bad} onChange={(e) => setBad(e.target.value)} placeholder="Add an observation" aria-label="What did not go well" style={{ flex: 1 }} /><Btn sm disabled={!bad.trim()} onClick={() => { ir.setReview(c, inc.id, { didnt: [...rv.didnt, bad.trim()], status: rv.status === 'not_started' ? 'in_progress' : rv.status }); setBad(''); }}><Plus size={12} /></Btn></div>
        </Card>
      </div>

      <Card title="Root-cause categories" sub={`Root cause: ${inc.rootCause}`}>
        <div className="chips">{ROOT_CATS.map((k) => <Chip key={k} on={rv.rootCauses.includes(k)} onClick={() => toggleCat(k)} color={IR_TONE}>{k}</Chip>)}</div>
        {cats.length > 0 && <div className="ir-sub" style={{ marginTop: 10 }}>Across {closed.length} closed incidents: {cats.map((x) => `${x.k} ${x.n}`).join(' · ')}</div>}
      </Card>

      <Card title="Actions" count={rv.actions.length} sub="Owners and due dates; push each to where it will be tracked" flush actions={<Btn sm primary color={IR_TONE} onClick={() => setAdd(true)}><Plus size={13} /> Add action</Btn>}>
        <div id="ir-rv-actions">
          <DataTable
            rows={rv.actions}
            rowKey={(r) => r.id}
            pageSize={10}
            empty="No actions yet. Add one, or generate them from the review."
            columns={[
              { key: 't', header: 'Action', sort: (r) => r.title, render: (r) => <div className="t-main" style={{ whiteSpace: 'normal', maxWidth: 380 }}>{r.title}</div> },
              { key: 'o', header: 'Owner', sort: (r) => r.owner, render: (r) => <span className="nowrap">{r.owner}</span> },
              { key: 'd', header: 'Due', sort: (r) => r.dueAt, render: (r) => <span className="nowrap">{fmtT(r.dueAt).split(' ').slice(0, 2).join(' ')}</span> },
              { key: 'dest', header: 'Destination', sort: (r) => r.dest, render: (r) => <Pill color={DEST_COLOR[r.dest]}>{DEST_META[r.dest].label}</Pill> },
              { key: 'p', header: 'Tracking', render: (r) => (r.pushed ? <button className="ir-link" onClick={() => nav(DEST_META[r.dest].to)}>{r.ref} {r.done ? '· done' : '· open'} <ExternalLink size={11} /></button> : <Btn sm onClick={() => { const ref = ir.pushAction(c, inc.id, r.id, actor); toast(`Pushed to ${DEST_META[r.dest].label}${ref ? ` as ${ref}` : ''}`); }}><Upload size={12} /> Push</Btn>) },
            ]}
          />
        </div>
      </Card>

      {add && <AddAction inc={inc} onClose={() => setAdd(false)} />}
    </>
  );
}

function AddAction({ inc, onClose }: { inc: IrIncident; onClose: () => void }) {
  const { c, actor, toast } = useIr();
  const [title, setTitle] = useState('');
  const owners = Array.from(new Set([...inc.roles.map((r) => r.name), ...inc.stakeholders.filter((s) => s.group === 'internal').map((s) => s.name)]));
  const [owner, setOwner] = useState(owners[0]);
  const [dest, setDest] = useState<ActionDest>('comply');
  const [days, setDays] = useState(30);
  return (
    <Modal title="Add review action" sub={inc.id} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!title.trim()} onClick={() => { ir.addAction(c, inc.id, { title, owner, dueDays: days, dest }, actor); toast('Action added'); onClose(); }}><Plus size={13} /> Add</Btn></>}>
      <div className="ir-form">
        <label><span className="section-label" style={{ margin: 0 }}>Action</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Remove MFA exclusion for the legacy remote-access group" aria-label="Action" /></label>
        <div className="row2">
          <label><span className="section-label" style={{ margin: 0 }}>Owner</span><select className="select" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">{owners.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label><span className="section-label" style={{ margin: 0 }}>Destination</span><select className="select" value={dest} onChange={(e) => setDest(e.target.value as ActionDest)} aria-label="Destination">{(Object.keys(DEST_META) as ActionDest[]).map((d) => <option key={d} value={d}>{DEST_META[d].label}</option>)}</select></label>
        </div>
        <div><span className="section-label">Due in</span><div className="ir-seg">{[7, 14, 30, 60, 90].map((d) => <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} days</button>)}</div></div>
      </div>
    </Modal>
  );
}
