import { useMemo, useState } from 'react';
import { Inbox, Plus, MessageSquare, Phone, Mail, MonitorSmartphone, ArrowRight, Timer, CheckCircle2, Hourglass, Loader } from 'lucide-react';
import { Card, Badge, KV, Btn, IcoBox, Callout, Sources } from '../../components/ui';
import { Drawer, Modal } from '../../components/Overlay';
import { tickets, type Ticket, type TicketStatus } from '../../data/modules/soc';
import { fmtAgo, fmtDur } from '../../lib/format';
import { useSoc, tenantShort, StatTile, Pills, RankList, SegBar, RecordsDrawer, useParamFilter } from './parts';

const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In progress', waiting: 'Waiting on you', resolved: 'Resolved' };
const STATUS_COLOR: Record<TicketStatus, string> = { open: '#4f8cff', in_progress: '#a78bfa', waiting: '#f5a83d', resolved: '#2dd4bf' };
const PRIO_COLOR: Record<string, string> = { Urgent: 'var(--sev-critical)', High: 'var(--sev-high)', Normal: 'var(--sev-info)', Low: 'var(--text-muted)' };
const CHANNEL_ICON = { Portal: MonitorSmartphone, Phone, Email: Mail, Teams: MessageSquare } as const;
type F = 'all' | TicketStatus;

export default function SocTickets() {
  const { c, tenantId, tone, scopeLabel, nav, toast } = useSoc();
  const ts = useMemo(() => tickets(c, tenantId), [c, tenantId]);
  const [f, setF] = useParamFilter<F>('status', ['all', 'open', 'in_progress', 'waiting', 'resolved'] as const, 'all');
  const [cat, setCat] = useState<string>('all');
  const [sel, setSel] = useState<Ticket | null>(null);
  const [create, setCreate] = useState(false);
  const [slaPanel, setSlaPanel] = useState(false);
  const [draft, setDraft] = useState({ title: '', category: 'Report suspicious activity', priority: 'Normal' });
  const itsm = c.connectors.find((k) => k.category === 'ITSM');
  const src = `HexaSOC portal · ${itsm ? `${itsm.vendor} ${itsm.product}` : 'ITSM'}`;

  const count = (s: TicketStatus) => ts.filter((t) => t.status === s).length;
  const rows = ts.filter((t) => (f === 'all' || t.status === f) && (cat === 'all' || t.category === cat));
  const cats = Array.from(new Set(ts.map((t) => t.category)));
  const inSla = ts.filter((t) => t.firstResponseMin <= t.slaMin).length;
  const median = ts.map((t) => t.firstResponseMin).sort((a, b) => a - b)[Math.floor(ts.length / 2)] ?? 0;
  const channels = (['Portal', 'Phone', 'Email', 'Teams'] as const).map((ch, i) => ({ id: ch, label: ch, value: ts.filter((t) => t.channel === ch).length, color: ['#4f8cff', '#2dd4bf', '#a78bfa', '#f5a83d'][i] }));

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · open a request with your HexaSOC team and track it here: report something suspicious, ask for access, or flag a device. Incidents HexaSOC detects for you live under <button className="link" onClick={() => nav('/soc/ir')}>Incidents</button>; requests sync two-way with {itsm ? `${itsm.vendor} ${itsm.product}` : 'your ITSM'}.
      </p>

      <div className="soc-stats">
        <StatTile icon={<Inbox />} value={count('open')} label="Open" tone={STATUS_COLOR.open} onClick={() => setF('open')} source={src} />
        <StatTile icon={<Loader />} value={count('in_progress')} label="In progress" tone={STATUS_COLOR.in_progress} onClick={() => setF('in_progress')} source={src} />
        <StatTile icon={<Hourglass />} value={count('waiting')} label="Waiting on you" tone={STATUS_COLOR.waiting} onClick={() => setF('waiting')} source={src} />
        <StatTile icon={<CheckCircle2 />} value={count('resolved')} label="Resolved (30 d)" tone={STATUS_COLOR.resolved} onClick={() => setF('resolved')} source={src} />
        <StatTile icon={<Timer />} value={fmtDur(median)} label={`Median first response · ${Math.round((inSla / Math.max(1, ts.length)) * 100)}% in SLA`} bar={(inSla / Math.max(1, ts.length)) * 100} tone={tone} onClick={() => setSlaPanel(true)} source="HexaSOC service ledger" />
      </div>

      <div className="grid g-2-1">
        <Card
          title="Your requests"
          count={`${rows.length} of ${ts.length}`}
          sub="Click a request for the conversation"
          actions={<Btn primary sm onClick={() => setCreate(true)}><Plus size={14} /> New request</Btn>}
          flush
        >
          <div className="row wrap" style={{ padding: '0 18px 12px', gap: 10 }}>
            <Pills
              label="Status"
              value={f}
              onChange={setF}
              tone={tone}
              items={[{ id: 'all', label: 'All', n: ts.length }, ...(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => ({ id: s, label: STATUS_LABEL[s], n: count(s) }))]}
            />
            <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {cats.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            {rows.map((t) => {
              const Ico = CHANNEL_ICON[t.channel];
              return (
                <button key={t.id} type="button" className="soc-ticket" onClick={() => setSel(t)}>
                  <span style={{ minWidth: 0 }}>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="t">{t.title}</span>
                    </span>
                    <span className="m">
                      <span className="mono">{t.id}</span>·<span>{t.category}</span>·<Ico size={11} /> {t.channel === 'Portal' ? 'Opened in portal' : t.channel === 'Phone' ? 'Phoned in' : t.channel === 'Email' ? 'By email' : 'Via Teams'}
                      {t.linkedIncident && <><span>·</span><span style={{ color: 'var(--m-soc)' }}>↗ {t.linkedIncident}</span></>}
                      <span>·</span><span>{tenantShort(c, t.tenantId)}</span>
                    </span>
                  </span>
                  <span className="r">
                    <Badge color={STATUS_COLOR[t.status]} dot>{STATUS_LABEL[t.status]}</Badge>
                    <span><b style={{ color: PRIO_COLOR[t.priority] }}>{t.priority}</b> · {t.requester}</span>
                    <span>{fmtAgo(t.openedMin)}</span>
                  </span>
                </button>
              );
            })}
            {rows.length === 0 && <div className="empty">No requests match this filter.</div>}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="By category" sub="Click to filter">
            <RankList tone={tone} onPick={(id) => setCat(cat === id ? 'all' : id)} rows={cats.map((x) => ({ id: x, label: x, value: ts.filter((t) => t.category === x).length })).sort((a, b) => b.value - a.value)} />
          </Card>
          <Card title="How requests reach us" sub="Channel mix, last 30 days">
            <SegBar parts={channels} />
          </Card>
          <Card title="Response SLA" sub="First response by priority">
            <div className="stack" style={{ gap: 6, fontSize: 12.5 }}>
              {(['Urgent', 'High', 'Normal', 'Low'] as const).map((p) => (
                <div key={p} className="row between">
                  <span><b style={{ color: PRIO_COLOR[p] }}>{p}</b></span>
                  <span className="muted">{p === 'Urgent' ? '15 min, 24/7' : p === 'High' ? '1 h, 24/7' : p === 'Normal' ? '4 business hours' : '1 business day'}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}><Sources items={[{ name: 'HexaSOC portal' }, ...(itsm ? [{ name: itsm.product, status: itsm.status }] : [])]} /></div>
          </Card>
        </div>
      </div>

      {sel && (
        <Drawer
          title={sel.title}
          sub={<span className="row wrap" style={{ gap: 6 }}><span className="mono">{sel.id}</span><Badge color={STATUS_COLOR[sel.status]} dot>{STATUS_LABEL[sel.status]}</Badge><Badge color={PRIO_COLOR[sel.priority]}>{sel.priority}</Badge></span>}
          icon={<IcoBox color={tone}><Inbox /></IcoBox>}
          onClose={() => setSel(null)}
          footer={
            <>
              {sel.linkedIncident && <Btn onClick={() => nav(`/soc/ir?status=all&id=${sel.linkedIncident}`)}>Open {sel.linkedIncident} <ArrowRight size={14} /></Btn>}
              {sel.status !== 'resolved' && <Btn primary onClick={() => { toast(`Reply added to ${sel.id} and synced to ${itsm?.product ?? 'ITSM'}`); setSel(null); }}>Reply</Btn>}
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <KV rows={[
              ['Requester', `${sel.requester} · ${sel.requesterRole}`],
              ['Category', sel.category],
              ['Channel', sel.channel],
              ['Tenant', tenantShort(c, sel.tenantId)],
              ['Assigned to', sel.assignee],
              ['First response', `${fmtDur(sel.firstResponseMin)} (SLA ${fmtDur(sel.slaMin)})`],
              ['Mirrored to', itsm ? `${itsm.vendor} ${itsm.product}` : 'Not mirrored'],
            ]} />
            {sel.firstResponseMin > sel.slaMin && <Callout kind="warn">First response missed the {fmtDur(sel.slaMin)} SLA by {fmtDur(sel.firstResponseMin - sel.slaMin)}; logged in the monthly service review.</Callout>}
            <div>
              <div className="section-label">Conversation</div>
              <div className="soc-thread">
                {sel.thread.map((m, i) => (
                  <div key={i} className={`soc-msg ${m.soc ? 'soc-side' : ''}`}>
                    <header><b>{m.who}</b><span>{fmtAgo(m.min)}</span></header>
                    {m.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {slaPanel && (
        <RecordsDrawer title="First response times" sub={`${inSla} of ${ts.length} requests answered inside SLA`} source="HexaSOC service ledger" icon={<Timer />} onClose={() => setSlaPanel(false)}
          rows={ts.slice().sort((a, b) => b.firstResponseMin / b.slaMin - a.firstResponseMin / a.slaMin).map((t) => ({ id: t.id, title: t.title, sub: `${t.id} · ${t.priority} · SLA ${fmtDur(t.slaMin)}`, right: <Badge color={t.firstResponseMin <= t.slaMin ? 'var(--good)' : 'var(--bad)'}>{fmtDur(t.firstResponseMin)}</Badge>, onClick: () => { setSlaPanel(false); setSel(t); } }))} />
      )}

      {create && (
        <Modal
          title="New request"
          sub="Goes straight to the on-shift HexaSOC analyst"
          onClose={() => setCreate(false)}
          footer={
            <>
              <Btn ghost onClick={() => setCreate(false)}>Cancel</Btn>
              <Btn primary disabled={!draft.title.trim()} onClick={() => { toast(`Request "${draft.title}" opened (${draft.priority}) and mirrored to ${itsm?.product ?? 'ITSM'}`); setCreate(false); setDraft({ ...draft, title: '' }); }}>Submit request</Btn>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <label className="stack" style={{ gap: 6 }}>
              <span className="section-label" style={{ margin: 0 }}>What do you need?</span>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={c.id === 'healthcare' ? 'e.g. Caller asked a nurse to approve an MFA prompt' : c.id === 'automotive' ? 'e.g. Supplier asked to change bank details' : 'e.g. Suspicious email to the finance team'} />
            </label>
            <div className="grid g2" style={{ gap: 10 }}>
              <select className="select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} aria-label="Category">
                {['Report suspicious activity', 'Access & permissions', 'Device & hardware', 'Change request', 'Vendor & third party', 'Reports & questions'].map((x) => <option key={x}>{x}</option>)}
              </select>
              <select className="select" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} aria-label="Priority">
                {['Urgent', 'High', 'Normal', 'Low'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <Callout>Urgent requests also page the on-shift analyst. If someone is asking you for an MFA code or to approve a prompt right now, phone the SOC hotline as well.</Callout>
          </div>
        </Modal>
      )}
    </>
  );
}
