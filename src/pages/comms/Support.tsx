import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy, Plus, MessageSquare, Phone, CalendarClock, ShieldCheck, BookOpen, ArrowRight, Timer, Lock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Btn, Badge, KV, Timeline, Chip, Callout, StatusBadge } from '../../components/ui';
import { Drawer, Modal } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtDur } from '../../lib/format';
import { scopedTenants } from '../../data/customers';
import { useSeconds } from '../ops/parts';
import {
  conversations, supportTickets, serviceStatus, sectorKb, localTime, PRIORITY_META,
  type Ticket, type Priority, type TicketStatus,
} from '../../data/modules/comms';
import { useComms, useLocalChat, Avatar, PresenceDot, MessageList, Composer, SecureNote, COMMS_TONE } from './parts';

const STATUS_COLOR: Record<TicketStatus, string> = { New: 'var(--accent)', 'In progress': 'var(--m-comms)', 'Awaiting you': 'var(--sev-medium)', Resolved: 'var(--good)' };

export default function Support() {
  const { customer, tenantId, persona } = useApp();
  return <SupportInner key={`${customer.id}-${tenantId}-${persona}`} />;
}

function fmtLeft(min: number): string {
  if (min <= 0) return `breached ${fmtDur(-min)} ago`;
  if (min < 60) {
    const m = Math.floor(min);
    const s = Math.floor((min - m) * 60);
    return `${m}:${String(s).padStart(2, '0')} left`;
  }
  return `${fmtDur(min)} left`;
}

function SupportInner() {
  const { tenantId, toast } = useApp();
  const nav = useNavigate();
  const sec = useSeconds();
  const { c, me, people, byId, mid, recList, anchorMin } = useComms();
  const base = useMemo(() => supportTickets(c, people), [c, people]);
  const [tickets, setTickets] = useState<Ticket[]>(base.tickets);
  const sessions = base.sessions;
  const status = useMemo(() => serviceStatus(c), [c]);
  const kb = useMemo(() => sectorKb(c), [c]);
  const desk = useMemo(() => conversations(c, tenantId, me, people).find((x) => x.kind === 'support'), [c, tenantId, me, people]);
  const chat = useLocalChat(mid);
  const [sel, setSel] = useState<Ticket | null>(null);
  const [raise, setRaise] = useState(false);
  const [pf, setPf] = useState<'all' | 'open' | 'p12' | 'awaiting'>('open');
  const [form, setForm] = useState({ title: '', priority: 'P3' as Priority, category: 'Connector / data plane', tenant: tenantId === 'all' ? c.tenants[0].id : tenantId, desc: '', session: false });

  const csm = byId.get('hx-csm');
  const deskP = byId.get('hx-desk');
  const se = byId.get('hx-se');
  const open = tickets.filter((t) => t.status !== 'Resolved');
  const p12 = open.filter((t) => t.priority === 'P1' || t.priority === 'P2');
  const awaiting = open.filter((t) => t.status === 'Awaiting you');
  const responded = tickets.filter((t) => t.respondedMin > 0).map((t) => t.respondedMin).sort((a, b) => a - b);
  const medResp = responded[Math.floor(responded.length / 2)] ?? 0;
  const pendingAccess = sessions.filter((s) => s.status === 'pending');
  const operational = status.filter((s) => s.status === 'Operational').length;
  const leftOf = (t: Ticket) => PRIORITY_META[t.priority].resolveMin - t.openedMin - sec / 60;
  const shown = tickets.filter((t) => pf === 'all' || (pf === 'open' ? t.status !== 'Resolved' : pf === 'p12' ? t.status !== 'Resolved' && (t.priority === 'P1' || t.priority === 'P2') : t.status === 'Awaiting you'));
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const submit = () => {
    const id = `HS-SUP-${70000 + Math.floor(Math.random() * 9999)}`;
    const t: Ticket = {
      id, title: form.title || 'New support request', priority: form.priority, status: 'New', openedMin: 0, respondedMin: 0, owner: deskP?.name ?? 'Support Desk', category: form.category, raisedBy: mid,
      updates: [{ minAgo: 0, by: me.name, text: `Raised from HexaView${form.session ? '; pre-authorised a read-only support session request (still needs Tenant Admin approval)' : ''}` }],
    };
    setTickets((ts) => [t, ...ts]);
    setRaise(false);
    setPf('open');
    setForm((f) => ({ ...f, title: '', desc: '', session: false }));
    toast(`${id} raised as ${form.priority}; ${PRIORITY_META[form.priority].label.split(' · ')[1]} response target ${fmtDur(PRIORITY_META[form.priority].responseMin)}. The support desk has been notified.`);
  };

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · your direct line to HexaShield: the HexaView support desk and platform admins, your named Customer Success Manager and the escalation path. HexaShield staff have <b>no standing access</b> to your tenant; every support session needs a Tenant Admin's approval ({c.people.admin.name}) and is recorded to the audit ledger.
      </p>

      <KpiStrip toneColor={COMMS_TONE} items={[
        { label: 'Open tickets', value: open.length, unit: `${tickets.length - open.length} resolved`, onClick: () => { setPf('open'); scroll('cm-tickets'); }, source: 'HexaShield service desk (ITSM) · ticket sync' },
        { label: 'P1 / P2 open', value: p12.length, unit: 'high priority', onClick: () => { setPf('p12'); scroll('cm-tickets'); }, source: 'HexaShield service desk · SLA engine', toneColor: p12.length ? 'var(--sev-high)' : undefined },
        { label: 'Awaiting you', value: awaiting.length, unit: 'need your input', onClick: () => { setPf('awaiting'); scroll('cm-tickets'); }, source: 'HexaShield service desk', toneColor: awaiting.length ? 'var(--sev-medium)' : undefined },
        { label: 'Median first response', value: medResp, unit: 'min', onClick: () => { setPf('all'); scroll('cm-tickets'); }, source: 'HexaShield service desk · 90-day SLA report' },
        { label: 'Support-access requests', value: pendingAccess.length, unit: 'awaiting Tenant Admin', to: '/ops/admin', source: 'HexaView support-access broker' },
        { label: 'Service health', value: `${operational}/${status.length}`, unit: 'operational', onClick: () => scroll('cm-status'), source: 'HexaShield status page · stamp telemetry' },
      ]} />

      <div className="grid g-2-1">
        <div id="cm-tickets" style={{ scrollMarginTop: 80, minWidth: 0 }}>
          <Card title="Support tickets" count={shown.length} sub="Live SLA timers against your contract (resolution targets)" flush
            actions={<><span className="chips" style={{ marginRight: 6 }}>{([['open', 'Open'], ['p12', 'P1/P2'], ['awaiting', 'Awaiting you'], ['all', 'All']] as const).map(([k, l]) => <Chip key={k} on={pf === k} onClick={() => setPf(k)} color={COMMS_TONE}>{l}</Chip>)}</span><Btn sm primary color={COMMS_TONE} onClick={() => setRaise(true)}><Plus /> Raise a ticket</Btn></>}>
            <DataTable
              rows={shown}
              rowKey={(t) => t.id}
              onRowClick={(t) => setSel(t)}
              columns={[
                { key: 'p', header: 'Priority', sort: (t) => t.priority, render: (t) => <span className="cm-prio" style={{ background: PRIORITY_META[t.priority].color }}>{t.priority}</span> },
                { key: 'title', header: 'Ticket', sort: (t) => t.title, render: (t) => (<><div className="t-main">{t.title}</div><div className="t-sub"><span className="mono">{t.id}</span> · {t.category} · opened {fmtAgo(t.openedMin)}</div></>) },
                { key: 's', header: 'Status', sort: (t) => t.status, render: (t) => <StatusBadge value={t.status} map={STATUS_COLOR} /> },
                { key: 'sla', header: 'Resolution SLA', sort: (t) => (t.status === 'Resolved' ? 99999 : leftOf(t)), render: (t) => {
                  if (t.status === 'Resolved') return <span className="cm-sla ok"><CheckCircle2 size={12} /> Met</span>;
                  const left = leftOf(t);
                  const pct = left / PRIORITY_META[t.priority].resolveMin;
                  return <span className={`cm-sla ${left <= 0 ? 'breach' : pct < 0.25 ? 'risk' : 'ok'}`}><Timer size={12} /> {fmtLeft(left)}</span>;
                } },
                { key: 'o', header: 'Owner', sort: (t) => t.owner, render: (t) => <span className="t-sub" style={{ whiteSpace: 'nowrap' }}>{t.owner}</span> },
              ]}
            />
          </Card>
        </div>

        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          {csm && (
            <Card title="Your Customer Success Manager" toneColor={COMMS_TONE} tinted>
              <div className="cm-csm">
                <Avatar p={csm} size={56} />
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 15 }}>{csm.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{csm.role} · HexaShield</div>
                  <div style={{ fontSize: 11.5, marginTop: 3 }}><PresenceDot p={csm.presence} /> {csm.presence} · {localTime(csm.tzOffset)} {csm.tz}</div>
                  {csm.status && <div className="muted" style={{ fontSize: 11.5 }}>{csm.status}</div>}
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <Btn sm primary color={COMMS_TONE} onClick={() => nav('/comms/inbox?with=hx-csm')}><MessageSquare /> Message</Btn>
                <Btn sm onClick={() => toast(`Calling ${csm.name} · end-to-end encrypted`)}><Phone /> Call</Btn>
                <Btn sm onClick={() => nav('/comms/bridges')}><CalendarClock /> Service review</Btn>
              </div>
              <div style={{ marginTop: 12 }}>
                <KV rows={[
                  ['Contract', `${c.tier} · ${c.stamp}`],
                  ['Next service review', 'Thursday 10:00 (weekly)'],
                  ['Solutions engineer', se ? `${se.name} (${se.presence})` : '—'],
                  ['Support hours', 'P1/P2 24×7 · P3/P4 business hours'],
                ]} />
              </div>
            </Card>
          )}
          <Card title="Escalation path" sub="If an SLA is at risk, HexaShield escalates automatically; you can escalate any time">
            <div className="cm-esc">
              {[
                ['Support desk', `${deskP?.name ?? 'Desk'} · 24×7`, true],
                ['Platform engineer', 'L2 on call · 30 min (P1)', false],
                ['Duty manager', 'Service delivery · 1 h (P1)', false],
                ['Your CSM', csm?.name ?? 'CSM', false],
                ['Head of Customer Success', 'Executive sponsor', false],
              ].map(([t, s, now], i) => (
                <div key={i} className={`cm-esc-step ${now ? 'now' : ''}`}>
                  <div className="n">{i + 1}</div>
                  <b>{t as string}</b>
                  <span>{s as string}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <Btn sm onClick={() => toast('Escalation raised to the HexaShield duty manager; your CSM is copied')}>Escalate now</Btn>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g-3-2">
        {desk && deskP ? (
          <Card className="cm-chat-card">
            <div className="cm-pane-head">
              <Avatar p={deskP} size={36} />
              <div className="cm-head-title">
                <h3><LifeBuoy size={14} style={{ color: COMMS_TONE }} /> HexaView Support Desk</h3>
                <div className="sub">{deskP.name} · platform admin on shift · <PresenceDot p={deskP.presence} /> {deskP.presence} · typical reply under 5 min</div>
              </div>
              <span className="cm-e2e"><Lock size={11} /> E2EE</span>
            </div>
            <div className="cm-banner hx"><ShieldCheck /> The desk can see this chat and ticket metadata only. Access to tenant data needs an approved support session.</div>
            <MessageList messages={[...desk.messages, ...(chat.added[desk.id] ?? [])]} byId={byId} people={people} mid={mid} typing={chat.typing[desk.id]} />
            <Composer placeholder="Message the support desk…" members={[deskP]} records={recList} external onSend={(o) => chat.send(desk.id, o, deskP.id, desk.replies)} />
            <SecureNote anchorMin={anchorMin} />
          </Card>
        ) : <Card title="Support desk">No desk conversation.</Card>}

        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          <div id="cm-status" style={{ scrollMarginTop: 80 }}>
            <Card title="Service status" sub={`${c.stamp} · 90-day uptime`} actions={<Badge color={operational === status.length ? 'var(--good)' : 'var(--sev-medium)'} dot>{operational === status.length ? 'All systems operational' : 'Partial degradation'}</Badge>}>
              {status.map((s, i) => (
                <div key={i} className="cm-status-row">
                  <span className="nm">{s.name}{s.note && <small>{s.note}</small>}</span>
                  <span className="cm-uptime" title={`${s.uptime}% over 90 days`}>
                    {Array.from({ length: 30 }, (_, j) => <i key={j} className={s.status === 'Degraded' && j > 26 ? 'd' : s.status === 'Maintenance' && j === 29 ? 'm' : (i * 7 + j * 3) % 41 === 0 && s.uptime < 99.99 ? 'd' : ''} />)}
                  </span>
                  <span className="num" style={{ width: 50, textAlign: 'right', fontSize: 11.5 }}>{s.uptime}%</span>
                  <Badge color={s.status === 'Operational' ? 'var(--good)' : s.status === 'Degraded' ? 'var(--sev-medium)' : 'var(--accent)'}>{s.status}</Badge>
                </div>
              ))}
            </Card>
          </div>
          <Card title="Support-access requests" count={sessions.filter((s) => s.status === 'pending' || s.status === 'active').length} sub="No standing access · max 8 h · read-only by default · recorded"
            actions={<Btn sm onClick={() => nav('/ops/admin')}>Review in Administration <ArrowRight /></Btn>}>
            <div className="list">
              {sessions.map((s) => (
                <button key={s.id} className="list-row" onClick={() => nav('/ops/admin')}>
                  <span className="list-main">
                    <b style={{ whiteSpace: 'normal' }}>{s.reason}</b>
                    <span>{s.engineer} · {s.scope} · {s.durationH} h · {fmtAgo(s.requestedMinAgo)}</span>
                  </span>
                  <StatusBadge value={s.status} map={{ pending: 'var(--sev-medium)', active: 'var(--m-comms)', closed: 'var(--good)', denied: 'var(--bad)' }} />
                </button>
              ))}
            </div>
            {pendingAccess.length > 0 && <Callout kind="warn">{pendingAccess.length} request{pendingAccess.length > 1 ? 's' : ''} waiting for a Tenant Admin. Nothing is accessible until approved.</Callout>}
          </Card>
        </div>
      </div>

      <div className="grid g2">
        <Card title="Knowledge base" sub="Most relevant to your estate" actions={<BookOpen size={16} style={{ color: COMMS_TONE }} />}>
          {kb.map((a, i) => (
            <button key={i} className="cm-kb" onClick={() => toast(`Opening “${a.title}” in the HexaShield knowledge base`)}>
              <Badge color={COMMS_TONE}>{a.cat}</Badge>
              <b>{a.title}</b>
              <span className="muted" style={{ fontSize: 11 }}>{a.mins} min read</span>
            </button>
          ))}
        </Card>
        <Card title="Support SLAs" sub="From your HexaShield service schedule">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Priority</th><th>Definition</th><th style={{ textAlign: 'right' }}>First response</th><th style={{ textAlign: 'right' }}>Resolution</th><th style={{ textAlign: 'right' }}>Open</th></tr></thead>
              <tbody>
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <tr key={p} style={{ cursor: 'pointer' }} onClick={() => { setPf('all'); scroll('cm-tickets'); }}>
                    <td><span className="cm-prio" style={{ background: PRIORITY_META[p].color }}>{p}</span></td>
                    <td className="t-sub">{{ P1: 'Platform down or data plane offline; no workaround', P2: 'Major function degraded, e.g. connector or approvals failing', P3: 'Minor issue with a workaround', P4: 'Question or feature request' }[p]}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{fmtDur(PRIORITY_META[p].responseMin)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{fmtDur(PRIORITY_META[p].resolveMin)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{open.filter((t) => t.priority === p).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {sel && (
        <Drawer title={sel.title} sub={<><span className="mono">{sel.id}</span> · {PRIORITY_META[sel.priority].label}</>} icon={<span className="cm-prio" style={{ background: PRIORITY_META[sel.priority].color }}>{sel.priority}</span>} onClose={() => setSel(null)}
          footer={<>
            <Btn onClick={() => nav('/comms/inbox?with=hx-desk')}><MessageSquare /> Message the desk</Btn>
            {sel.needsAccess && <Btn primary color={COMMS_TONE} onClick={() => nav('/ops/admin')}><ShieldCheck /> Review access request</Btn>}
            {sel.path && !sel.needsAccess && <Btn onClick={() => nav(sel.path!)}>Open affected area <ArrowRight /></Btn>}
            {sel.status !== 'Resolved' && <Btn onClick={() => { setTickets((ts) => ts.map((t) => (t.id === sel.id ? { ...t, status: 'Resolved' } : t))); setSel(null); toast(`${sel.id} marked resolved; HexaShield will confirm closure`); }}>Mark resolved</Btn>}
          </>}>
          <KV rows={[
            ['Status', <StatusBadge value={sel.status} map={STATUS_COLOR} />],
            ['Category', sel.category],
            ['Owner', sel.owner],
            ['Raised by', byId.get(sel.raisedBy)?.name ?? sel.raisedBy],
            ['Opened', fmtAgo(sel.openedMin)],
            ['First response', sel.respondedMin ? `${sel.respondedMin} min (target ${fmtDur(PRIORITY_META[sel.priority].responseMin)})` : 'Pending'],
            ['Resolution SLA', sel.status === 'Resolved' ? 'Met' : fmtLeft(leftOf(sel))],
          ]} />
          {sel.needsAccess && <div style={{ marginTop: 12 }}><Callout kind="warn">HexaShield has asked for a time-boxed, read-only support session for this ticket. It needs Tenant Admin approval in Administration.</Callout></div>}
          <div className="section-label" style={{ marginTop: 16 }}>Updates</div>
          <Timeline items={sel.updates.map((u) => ({ time: fmtAgo(u.minAgo), title: u.by, body: u.text, color: COMMS_TONE }))} />
        </Drawer>
      )}

      {raise && (
        <Modal title="Raise a ticket with HexaShield" sub="Routed to the HexaView support desk; your CSM is copied on P1 and P2" onClose={() => setRaise(false)}
          footer={<><Btn onClick={() => setRaise(false)}>Cancel</Btn><Btn primary color={COMMS_TONE} onClick={submit} disabled={!form.title.trim()}>Submit ticket</Btn></>}>
          <div className="cm-form">
            <label>Summary<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sentinel connector failing since 09:00" autoFocus /></label>
            <label>Priority
              <div className="cm-choice">
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <button key={p} className={form.priority === p ? 'on' : ''} onClick={() => setForm({ ...form, priority: p })}>{PRIORITY_META[p].label}</button>)}
              </div>
            </label>
            <div className="row2">
              <label>Category
                <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {['Connector / data plane', 'Action Centre', 'Reports', 'Identity & access', 'Communications Hub', 'HexaSOC service', 'Billing & licences', 'Feature request'].map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label>Affected tenant
                <select className="select" value={form.tenant} onChange={(e) => setForm({ ...form, tenant: e.target.value })}>
                  {scopedTenants(c, 'all').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </div>
            <label>Description<textarea className="input" rows={4} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="What happened, when, and what you have tried" /></label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
              <input type="checkbox" checked={form.session} onChange={(e) => setForm({ ...form, session: e.target.checked })} />
              Allow HexaShield to request a read-only support session for this ticket (still needs Tenant Admin approval)
            </label>
            <Callout>Target first response: <b>{fmtDur(PRIORITY_META[form.priority].responseMin)}</b>, resolution: <b>{fmtDur(PRIORITY_META[form.priority].resolveMin)}</b>. Tickets and their updates are written to the audit ledger.</Callout>
          </div>
        </Modal>
      )}
    </>
  );
}
