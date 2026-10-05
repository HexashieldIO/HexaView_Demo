import { useState } from 'react';
import { Phone, PhoneOff, ExternalLink, Gavel, Plus, ChevronRight, Hash, Radio, Laptop, UserX, Database, ListChecks, Lock } from 'lucide-react';
import { Card, Btn, Callout, KV, Chip, Badge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Overlay';
import { fmtNum, fmtMoney } from '../../lib/format';
import { OtReadOnly, StatTile } from '../soc/parts';
import {
  PHASES, PHASE_LABEL, STREAMS, STREAM_COLOR, TASK_COLS, commanderOptions,
  type IrIncident, type Stream, type TaskStatus, type RoleName,
} from '../../data/modules/incident';
import { useIr, useNow, IrPage, IncidentPicker, IncidentHeader, PhaseStepper, NoticeClock, EntryRow, NoIncident, useGuideTarget, fmtSpan, fmtT, IR_TONE, Pill, Avatar } from './parts';
import { ir } from './store';

const MIN = 60_000;
const NEXT: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', blocked: 'doing', done: 'done' };

export default function Warroom() {
  return <IrPage><Inner /></IrPage>;
}

function Inner() {
  const { focus } = useIr();
  return (
    <>
      <IncidentPicker />
      {focus ? <Room inc={focus} /> : <NoIncident />}
    </>
  );
}

function Room({ inc }: { inc: IrIncident }) {
  const { c, nav, toast, actor, tools, ppl } = useIr();
  const now = useNow(1000);
  const [modal, setModal] = useState<'phase' | 'task' | 'decision' | 'close' | null>(null);
  const [stream, setStream] = useState<'all' | Stream>('all');
  const [onBridge, setOnBridge] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const guideDecision = useGuideTarget(1);
  const live = inc.status === 'active';
  const ix = PHASES.indexOf(inc.phase);
  const next = PHASES[ix + 1];
  const clocks = inc.notices.filter((n) => n.dueAt).sort((a, b) => (a.status === 'sent' ? 1 : 0) - (b.status === 'sent' ? 1 : 0) || (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const running = clocks.filter((n) => n.status !== 'sent' && n.status !== 'na');
  const tasks = inc.tasks.filter((t) => stream === 'all' || t.stream === stream);
  const done = inc.tasks.filter((t) => t.status === 'done').length;
  const joined = inc.stakeholders.filter((s) => s.ackAt);
  const move = (id: string, st: TaskStatus) => ir.moveTask(c, inc.id, id, st, actor);

  return (
    <>
      <p className="page-intro">
        War room for <b>{inc.id}</b>: one shared picture for the bridge, fed live by HexaSOC ({tools.siem}, {tools.edr}, {tools.idp}) with roles, tasks, decisions and regulatory clocks. Everything here is written to the audited timeline. The group-level view is also in <button className="ir-link" onClick={() => nav('/ops/warroom')}>Operations › Crisis War Room</button>.
      </p>
      <IncidentHeader
        inc={inc}
        now={now}
        actions={
          <>
            {live && (
              <Btn sm primary={!onBridge} color={IR_TONE} onClick={() => { if (!onBridge) { ir.joinBridge(c, inc.id, actor); toast(`Joined ${inc.bridge}`); } setOnBridge(!onBridge); }}>
                {onBridge ? <><PhoneOff size={13} /> Leave bridge</> : <><Phone size={13} /> Join bridge</>}
              </Btn>
            )}
            <Btn sm onClick={() => nav('/comms/bridges')}><Radio size={13} /> Comms Hub bridge</Btn>
            <Btn sm ghost onClick={() => nav('/ops/warroom')}><ExternalLink size={13} /> Open in Crisis War Room</Btn>
          </>
        }
      />
      {inc.ot && <OtReadOnly>Affected systems include OT. HexaView recommends; site engineers act under the site safety procedure. No write-back is ever sent to controllers.</OtReadOnly>}

      <Card
        title="Response phase"
        sub="NIST SP 800-61: advancing a phase asks for confirmation and is written to the timeline"
        actions={live ? (next
          ? <Btn sm primary color={IR_TONE} onClick={() => setModal('phase')}>Advance to {PHASE_LABEL[next]} <ChevronRight size={13} /></Btn>
          : <Btn sm primary color={IR_TONE} onClick={() => setModal('close')}><Lock size={13} /> Close incident</Btn>) : <Pill color="var(--good)" dot>Closed {inc.closedAt ? fmtT(inc.closedAt) : ''}</Pill>}
      >
        <PhaseStepper inc={inc} />
      </Card>

      <div className="grid g4">
        <StatTile icon={<Laptop size={18} />} value={inc.stats.hostsIsolated} label={`hosts isolated (${tools.edr})`} tone={IR_TONE} to="/soc/endpoint" source={`${tools.edr} write-back via HexaView action broker`} />
        <StatTile icon={<UserX size={18} />} value={inc.stats.accountsDisabled} label={`accounts disabled (${tools.idp})`} tone={IR_TONE} to="/soc/identity" source={`${tools.idp} write-back`} />
        <StatTile icon={<Database size={18} />} value={inc.stats.records ? fmtNum(inc.stats.records) : 'None'} label={`records at risk · est. ${fmtMoney(inc.stats.impact, c.currency)}`} tone={IR_TONE} to="/incident-response/notifications" source="HexaView IR data assessment · DPO" />
        <StatTile icon={<ListChecks size={18} />} value={`${done}/${inc.tasks.length}`} label="tasks complete" bar={(done / Math.max(1, inc.tasks.length)) * 100} tone={IR_TONE} onClick={() => document.getElementById('ir-tasks')?.scrollIntoView({ behavior: 'smooth' })} source="HexaView IR task board" />
      </div>

      <div className="grid g-1-2">
        <Card title="Roles" sub="Assign from the roster; changes are logged">
          <div className="stack" style={{ gap: 8 }}>
            {inc.roles.map((r) => (
              <div key={r.role} className="row" style={{ gap: 10, alignItems: 'center' }}>
                <Avatar name={r.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ir-sub">{r.role}</div>
                  {live ? (
                    <select className="select" value={r.name} onChange={(e) => { ir.assignRole(c, inc.id, r.role as RoleName, e.target.value, actor); toast(`${r.role}: ${e.target.value}`); }} aria-label={r.role} style={{ width: '100%', padding: '3px 6px', fontSize: 12 }}>
                      {Array.from(new Set([r.name, ...commanderOptions(c), ...inc.stakeholders.map((s) => s.name)])).map((n) => <option key={n}>{n}</option>)}
                    </select>
                  ) : <b style={{ fontSize: 12.5 }}>{r.name}</b>}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Regulatory & contractual clocks" count={running.length} sub={`Started from declaration (${fmtT(inc.declaredAt)}) · ${c.tenants.find((t) => t.id === inc.tenantIds[0])?.regimes.join(', ')}`} actions={<Btn sm ghost onClick={() => nav('/incident-response/notifications')}>Notifications <ChevronRight size={12} /></Btn>}>
          {clocks.length ? clocks.slice(0, 7).map((n) => <NoticeClock key={n.id} n={n} now={now} onClick={() => nav('/incident-response/notifications')} />) : <Callout kind="good">No statutory clocks for this severity. The insurer notice still applies.</Callout>}
        </Card>
      </div>

      <Card
        title="Task board"
        count={inc.tasks.length}
        sub="By workstream · drag a card between columns or use the arrow"
        actions={<>{live && <Btn sm primary color={IR_TONE} onClick={() => setModal('task')}><Plus size={13} /> Add task</Btn>}</>}
      >
        <div id="ir-tasks" className="chips" style={{ marginBottom: 10 }}>
          <Chip on={stream === 'all'} onClick={() => setStream('all')} color={IR_TONE}>All {inc.tasks.length}</Chip>
          {STREAMS.map((s) => <Chip key={s} on={stream === s} onClick={() => setStream(s)} color={STREAM_COLOR[s]}>{s} {inc.tasks.filter((t) => t.stream === s).length}</Chip>)}
        </div>
        <div className="ir-kanban">
          {TASK_COLS.map((col) => (
            <div key={col.id} className={`ir-col ${over === col.id ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
              onDragLeave={() => setOver(null)}
              onDrop={() => { if (drag) move(drag, col.id); setDrag(null); setOver(null); }}>
              <div className="ir-col-h"><span>{col.label}</span><span>{tasks.filter((t) => t.status === col.id).length}</span></div>
              {tasks.filter((t) => t.status === col.id).map((t) => {
                const late = t.status !== 'done' && t.dueAt < now;
                return (
                  <div key={t.id} className="ir-task" draggable={live} onDragStart={() => setDrag(t.id)} style={{ ['--pc' as string]: STREAM_COLOR[t.stream] }}>
                    <b>{t.title}</b>
                    <div className="ir-task-f"><span>{t.stream} · {t.owner.split(' (')[0]}</span></div>
                    <div className="ir-task-f">
                      <span style={{ color: late ? 'var(--bad)' : undefined }}>{t.status === 'done' ? 'Done' : late ? `Overdue ${fmtSpan(now - t.dueAt)}` : `Due in ${fmtSpan(t.dueAt - now)}`}</span>
                      {live && t.status !== 'done' && (
                        <span className="row" style={{ gap: 4 }}>
                          {t.status !== 'blocked' && <button type="button" onClick={() => move(t.id, 'blocked')} title="Mark blocked">Block</button>}
                          <button type="button" onClick={() => move(t.id, NEXT[t.status])} title="Move forward">→</button>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Decisions log" count={inc.decisions.length} sub="Decision, rationale, who decided and when" flush actions={live ? <span className={guideDecision}><Btn sm primary color={IR_TONE} onClick={() => setModal('decision')}><Gavel size={13} /> Record decision</Btn></span> : undefined}>
          <DataTable
            rows={inc.decisions.slice().reverse()}
            rowKey={(r) => r.id}
            pageSize={8}
            columns={[
              { key: 't', header: 'When', sort: (r) => r.t, render: (r) => <span className="ir-mono nowrap">{fmtT(r.t)}</span> },
              { key: 'd', header: 'Decision', render: (r) => <><div className="t-main" style={{ whiteSpace: 'normal', maxWidth: 380 }}>{r.decision}</div><div className="t-sub">{r.rationale}</div></> },
              { key: 'b', header: 'Decided by', sort: (r) => r.by, render: (r) => <span className="nowrap">{r.by}</span> },
            ]}
          />
        </Card>
        <Card title="Live timeline" sub="Latest audited entries" actions={<Btn sm ghost onClick={() => nav('/incident-response/timeline')}>Full timeline <ChevronRight size={12} /></Btn>}>
          <div className="ir-tl">
            {inc.timeline.slice().sort((a, b) => b.seq - a.seq).slice(0, 7).map((e) => <EntryRow key={e.id} e={e} compact />)}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Bridge & channels" sub="Hosted in the Comms Hub">
          <KV rows={[
            ['Bridge', <span key="b">{inc.bridge} <button className="ir-link" onClick={() => nav('/comms/bridges')}>open</button></span>],
            ['Channels', <span key="c" className="stack" style={{ gap: 3 }}>{inc.channels.map((ch) => <button key={ch} className="ir-link" style={{ textAlign: 'left' }} onClick={() => nav('/comms/channels')}><Hash size={11} style={{ verticalAlign: -1 }} /> {ch.replace(/^#/, '')}</button>)}</span>],
            ['On the bridge', `${joined.length + (onBridge ? 1 : 0)} of ${inc.stakeholders.length} stakeholders`],
            ['Out-of-band', c.id === 'defence' ? 'Secure phone bridge (US persons only)' : 'Signal group for legal and the commander if email or Teams is compromised'],
          ]} />
        </Card>
        <Card title="Who is engaged" sub="Joined the bridge or acknowledged" actions={<Btn sm ghost onClick={() => nav('/incident-response/stakeholders')}>Stakeholders <ChevronRight size={12} /></Btn>}>
          <div className="row wrap" style={{ gap: 6 }}>
            {joined.map((s) => <Badge key={s.id} color={s.group === 'internal' ? IR_TONE : 'var(--m-core)'}>{s.name.split(' (')[0]}</Badge>)}
            {onBridge && <Badge color="var(--good)" solid>{actor} (you)</Badge>}
            {!joined.length && !onBridge && <span className="muted" style={{ fontSize: 12 }}>Nobody has joined yet.</span>}
          </div>
          <div className="ir-sub" style={{ marginTop: 10 }}>Exec sponsor: {inc.roles.find((r) => r.role === 'Exec sponsor')?.name} · legal: {ppl.legal.name}</div>
        </Card>
      </div>

      {modal === 'phase' && next && <PhaseModal inc={inc} onClose={() => setModal(null)} />}
      {modal === 'close' && (
        <Modal title={`Close ${inc.id}`} sub="Post-incident phase complete" onClose={() => setModal(null)} footer={<><Btn ghost onClick={() => setModal(null)}>Cancel</Btn><Btn primary color={IR_TONE} onClick={() => { ir.closeIncident(c, inc.id, actor); toast(`${inc.id} closed`); setModal(null); }}><Lock size={13} /> Close incident</Btn></>}>
          {inc.report.status !== 'issued' && <Callout kind="warn">The incident report is not issued yet ({inc.report.status}). You can still close; the report stays open in Incident Report.</Callout>}
          {inc.review.status !== 'complete' && <Callout kind="warn">The post-incident review is {inc.review.status.replace('_', ' ')}.</Callout>}
          <Callout>Closing stops the clocks display and moves the incident to Recently closed. The timeline remains append-only.</Callout>
        </Modal>
      )}
      {modal === 'task' && <TaskModal inc={inc} onClose={() => setModal(null)} />}
      {modal === 'decision' && <DecisionModal inc={inc} onClose={() => setModal(null)} />}
    </>
  );
}

function PhaseModal({ inc, onClose }: { inc: IrIncident; onClose: () => void }) {
  const { c, actor, toast } = useIr();
  const next = PHASES[PHASES.indexOf(inc.phase) + 1];
  const [note, setNote] = useState('');
  const openTasks = inc.tasks.filter((t) => t.status !== 'done').length;
  return (
    <Modal title={`Advance to ${PHASE_LABEL[next]}?`} sub={`${inc.id} · currently ${PHASE_LABEL[inc.phase]}`} onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} onClick={() => { ir.advancePhase(c, inc.id, actor, note); toast(`${inc.id} advanced to ${PHASE_LABEL[next]} · written to the timeline`); onClose(); }}>Confirm and advance</Btn></>}>
      <div className="ir-form">
        {openTasks > 0 && <Callout kind="warn">{openTasks} tasks are still open; they carry over.</Callout>}
        <label><span className="section-label" style={{ margin: 0 }}>Exit criteria met / note</span><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={next === 'eradicate' ? 'e.g. No new detections for 2 hours; all affected hosts isolated' : 'Optional note for the timeline'} aria-label="Phase note" /></label>
        <Callout>Recorded as a key event by {actor}, hash-chained to the previous entry.</Callout>
      </div>
    </Modal>
  );
}

function TaskModal({ inc, onClose }: { inc: IrIncident; onClose: () => void }) {
  const { c, actor, toast } = useIr();
  const [title, setTitle] = useState('');
  const [stream, setStream] = useState<Stream>('Containment');
  const owners = Array.from(new Set([...inc.roles.map((r) => r.name), ...inc.stakeholders.map((s) => s.name)]));
  const [owner, setOwner] = useState(owners[0]);
  const [due, setDue] = useState(240);
  return (
    <Modal title="Add task" sub={inc.id} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!title.trim()} onClick={() => { ir.addTask(c, inc.id, { title, stream, owner, dueMin: due }, actor); toast(`Task added to ${stream}`); onClose(); }}><Plus size={13} /> Add</Btn></>}>
      <div className="ir-form">
        <label><span className="section-label" style={{ margin: 0 }}>Task</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rotate service account credentials" aria-label="Task title" /></label>
        <div className="row2">
          <label><span className="section-label" style={{ margin: 0 }}>Workstream</span><select className="select" value={stream} onChange={(e) => setStream(e.target.value as Stream)} aria-label="Workstream">{STREAMS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label><span className="section-label" style={{ margin: 0 }}>Owner</span><select className="select" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">{owners.map((o) => <option key={o}>{o}</option>)}</select></label>
        </div>
        <div><span className="section-label">Due in</span><div className="ir-seg">{[60, 240, 720, 1440, 4320].map((m) => <button key={m} type="button" className={due === m ? 'on' : ''} onClick={() => setDue(m)}>{fmtSpan(m * MIN)}</button>)}</div></div>
      </div>
    </Modal>
  );
}

function DecisionModal({ inc, onClose }: { inc: IrIncident; onClose: () => void }) {
  const { c, actor, toast } = useIr();
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  const people = Array.from(new Set([inc.commander, ...inc.roles.map((r) => r.name)]));
  const [by, setBy] = useState(inc.commander);
  const presets = [
    inc.ot ? 'Keep OT in a safe degraded state; site engineers isolate the conduit' : `Isolate ${inc.assets[0]} and adjacent systems`,
    'Do not engage with the threat actor; refer extortion contact to counsel',
    'Notify the regulator now rather than wait for full scope',
    'Activate the business continuity plan for the affected service',
  ];
  return (
    <Modal title="Record decision" sub={`${inc.id} · written to the decisions log and the audited timeline`} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!decision.trim()} onClick={() => { ir.addDecision(c, inc.id, { decision, rationale, by }, actor); toast('Decision recorded'); onClose(); }}><Gavel size={13} /> Record</Btn></>}>
      <div className="ir-form">
        <div className="chips">{presets.map((p) => <Chip key={p} onClick={() => setDecision(p)} on={decision === p} color={IR_TONE}>{p.length > 46 ? `${p.slice(0, 46)}…` : p}</Chip>)}</div>
        <label><span className="section-label" style={{ margin: 0 }}>Decision</span><textarea className="input" rows={2} value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="Decision" /></label>
        <label><span className="section-label" style={{ margin: 0 }}>Rationale</span><textarea className="input" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} aria-label="Rationale" /></label>
        <label><span className="section-label" style={{ margin: 0 }}>Decided by</span><select className="select" value={by} onChange={(e) => setBy(e.target.value)} aria-label="Decided by">{people.map((p) => <option key={p}>{p}</option>)}</select></label>
      </div>
    </Modal>
  );
}

