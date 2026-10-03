import { useMemo, useState } from 'react';
import { Plus, Send, ArrowUpCircle, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Bar, BarRow, Btn, Callout, KV, SectionLabel, StatusBadge, Timeline, IcoBox } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { PARTNER, PRIORITY_COLOR, STAFF, clientBook, tickets, type Ticket } from '../../data/modules/partner';
import { fmtAgo, fmtDur } from '../../lib/format';
import { ClientAvatar, Field, PT_TONE } from '../partner/parts';

const T_COLOR: Record<Ticket['status'], string> = { Open: 'var(--bad)', 'With HexaShield': 'var(--m-matrix)', 'Awaiting partner': 'var(--sev-medium)', Resolved: 'var(--good)' };
const CATS: Ticket['category'][] = ['Platform', 'Connector', 'Billing', 'Deal desk', 'White label', 'Service delivery', 'Enablement'];

export default function BillingSupport() {
  const { toast } = useApp();
  const book = useMemo(() => clientBook(), []);
  const [list, setList] = useState(() => tickets());
  const [sel, setSel] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [raise, setRaise] = useState(false);
  const [f, setF] = useState({ title: '', clientId: '', category: 'Platform' as Ticket['category'], priority: 'P3' as Ticket['priority'], body: '' });
  const open = list.filter((t) => t.status !== 'Resolved');
  const breaching = open.filter((t) => t.ageHours > t.slaHours);
  const clientOf = (id?: string) => book.find((c) => c.id === id);

  return (
    <>
      <p className="page-intro">
        Your line into HexaShield: platform, connector, billing, deal desk and service-delivery tickets for {PARTNER.short} and its clients, with SLA clocks. P1s page the HexaShield partner duty manager 24/7.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Open tickets', value: open.length, onClick: () => setSel(open[0]), source: 'HexaShield partner support desk' },
          { label: 'P1 / P2 open', value: open.filter((t) => t.priority === 'P1' || t.priority === 'P2').length, onClick: () => setSel(open.find((t) => t.priority === 'P1') ?? null), source: 'Partner support desk · priority' },
          { label: 'Past SLA', value: breaching.length, onClick: () => setSel(breaching[0] ?? null), source: 'Partner support desk · SLA clocks' },
          { label: 'First response', value: fmtDur(48), hint: 'median, 30 d', source: 'Partner support desk' },
          { label: 'Resolved (30 d)', value: list.filter((t) => t.status === 'Resolved').length + 23, source: 'Partner support desk' },
          { label: 'CSAT', value: '4.6', unit: '/ 5', source: 'Post-resolution survey' },
        ]}
      />

      <div className="row">
        <span className="secondary" style={{ fontSize: 12.5 }}>Raising on behalf of a client? Pick the client so HexaShield sees the tenant context.</span>
        <span className="spacer" />
        <Btn primary color={PT_TONE} onClick={() => setRaise(true)}><Plus /> Raise a ticket</Btn>
      </div>

      <div className="grid g-2-1">
        <Card title="Tickets" count={list.length} flush>
          <DataTable
            rows={list}
            rowKey={(t) => t.id}
            onRowClick={(t) => { setSel(t); setReply(''); }}
            initialSort={{ key: 'p', dir: 'asc' }}
            search={(t) => `${t.id} ${t.title} ${t.category} ${t.status}`}
            searchPlaceholder="Filter tickets…"
            columns={[
              { key: 'p', header: 'Pri', sort: (t) => (t.status === 'Resolved' ? 9 : 0) + Number(t.priority[1]), render: (t) => <Badge color={PRIORITY_COLOR[t.priority]} solid={t.priority === 'P1'}>{t.priority}</Badge> },
              { key: 't', header: 'Ticket', sort: (t) => t.title, render: (t) => <><div className="t-main" style={{ maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div><div className="t-sub">{t.id} · {t.category} · {t.owner}</div></> },
              { key: 'c', header: 'Client', render: (t) => { const c = clientOf(t.clientId); return c ? <div className="row" style={{ gap: 6 }}><ClientAvatar c={c} size={20} /><span style={{ fontSize: 12 }}>{c.short}</span></div> : <span className="muted">Partner</span>; } },
              { key: 'sla', header: 'SLA', sort: (t) => t.ageHours / t.slaHours, render: (t) => t.status === 'Resolved' ? <span className="muted" style={{ fontSize: 11 }}>met</span> : <div style={{ width: 90 }}><Bar value={t.ageHours} max={t.slaHours} size="thin" color={t.ageHours > t.slaHours ? 'var(--bad)' : t.ageHours > t.slaHours * 0.7 ? 'var(--sev-medium)' : 'var(--good)'} /><span className="t-sub">{fmtDur(t.ageHours * 60)} / {fmtDur(t.slaHours * 60)}</span></div> },
              { key: 'st', header: 'Status', sort: (t) => t.status, render: (t) => <StatusBadge value={t.status} map={T_COLOR} /> },
            ]}
          />
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Your HexaShield team" toneColor={PT_TONE} tinted>
            <div className="list">
              {[
                { n: PARTNER.channelManager.name, r: PARTNER.channelManager.role, i: Mail },
                { n: PARTNER.partnerSe.name, r: PARTNER.partnerSe.role, i: Mail },
                { n: 'Deal desk', r: `${PARTNER.dealDesk} · 2 business days`, i: Mail },
                { n: 'Partner duty manager (P1)', r: '24/7 bridge · answers in 15 min', i: Phone },
                { n: 'Partner billing', r: 'billing@hexashield.io · 3 business days', i: Mail },
              ].map((x) => (
                <button key={x.n} className="list-row" onClick={() => toast(`Contact card for ${x.n} copied`)}>
                  <IcoBox color={PT_TONE}><x.i /></IcoBox>
                  <span className="list-main"><b>{x.n}</b><span>{x.r}</span></span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Platform status">
            {['EU1 (Frankfurt)', 'UK1 (London)', 'US1 (Virginia)', 'Partner portal & billing'].map((s) => (
              <div key={s} className="row" style={{ fontSize: 12.5, padding: '5px 0' }}><CheckCircle2 size={14} color="var(--good)" /><span style={{ flex: 1 }}>{s}</span><span className="muted" style={{ fontSize: 11 }}>Operational · 99.99% (90 d)</span></div>
            ))}
            <div style={{ marginTop: 8 }}><Callout>Connector release 2026.10.2 on Thursday 02:00 UTC: Veeam mapping fix (PS-7770), agent 1.9.5 (PS-7776).</Callout></div>
          </Card>
          <Card title="Tickets by category" sub="Last 90 days">
            {CATS.map((c) => {
              const n = list.filter((t) => t.category === c).length * 3 + (c === 'Connector' ? 4 : c === 'Platform' ? 3 : 1);
              return <BarRow key={c} label={c} value={n} max={20} color={PT_TONE} display={n} />;
            })}
          </Card>
        </div>
      </div>

      {sel && (() => {
        const c = clientOf(sel.clientId);
        return (
          <Drawer
            title={sel.title}
            sub={`${sel.id} · ${sel.category} · opened ${fmtAgo(sel.ageHours * 60)} by ${sel.owner}`}
            icon={c ? <ClientAvatar c={c} size={34} /> : undefined}
            onClose={() => setSel(null)}
            footer={
              sel.status !== 'Resolved' ? (
                <>
                  <Btn primary color={PT_TONE} disabled={!reply.trim()} onClick={() => { setList((ls) => ls.map((t) => (t.id === sel.id ? { ...t, status: 'With HexaShield', updates: [...t.updates, { who: 'You', text: reply, hoursAgo: 0 }] } : t))); toast(`Reply added to ${sel.id}`); setSel(null); }}><Send /> Reply</Btn>
                  {sel.priority !== 'P1' && <Btn onClick={() => { toast(`${sel.id} escalated to ${PARTNER.channelManager.name} and the partner duty manager`); setSel(null); }}><ArrowUpCircle /> Escalate</Btn>}
                </>
              ) : undefined
            }
          >
            {sel.ageHours > sel.slaHours && sel.status !== 'Resolved' && <div style={{ marginBottom: 12 }}><Callout kind="warn">Past the {fmtDur(sel.slaHours * 60)} SLA for {sel.priority}. Escalation is available.</Callout></div>}
            <KV rows={[['Priority', <Badge color={PRIORITY_COLOR[sel.priority]}>{sel.priority}</Badge>], ['Status', <StatusBadge value={sel.status} map={T_COLOR} />], ['Client', c?.name ?? `${PARTNER.short} (partner)`], ['Assigned to', sel.assignee], ['SLA', `${fmtDur(sel.slaHours * 60)} · elapsed ${fmtDur(sel.ageHours * 60)}`]]} />
            <SectionLabel>Conversation</SectionLabel>
            <Timeline items={sel.updates.map((u) => ({ time: u.hoursAgo ? fmtAgo(u.hoursAgo * 60) : 'just now', title: u.who, body: u.text, color: u.who.includes('HexaShield') || u.who === 'Deal desk' || u.who === 'Connector team' || u.who.includes('Nadia') || u.who.includes('Partner marketing') ? 'var(--m-matrix)' : PT_TONE }))} />
            {sel.status !== 'Resolved' && <div style={{ marginTop: 12 }}><textarea className="input" rows={3} style={{ width: '100%' }} placeholder="Reply to HexaShield…" value={reply} onChange={(e) => setReply(e.target.value)} /></div>}
          </Drawer>
        );
      })()}

      {raise && (
        <Modal
          title="Raise a ticket with HexaShield"
          sub="P1 pages the partner duty manager immediately"
          onClose={() => setRaise(false)}
          footer={<><Btn onClick={() => setRaise(false)}>Cancel</Btn><Btn primary color={PT_TONE} disabled={f.title.trim().length < 4} onClick={() => {
            const id = `PS-${7782 + list.length - tickets().length}`;
            setList((ls) => [{ id, title: f.title, clientId: f.clientId || undefined, priority: f.priority, category: f.category, status: 'Open', ageHours: 0, slaHours: f.priority === 'P1' ? 4 : f.priority === 'P2' ? 8 : f.priority === 'P3' ? 48 : 120, owner: STAFF[1].name, assignee: 'Triage', updates: [{ who: 'You', text: f.body || f.title, hoursAgo: 0 }] }, ...ls]);
            toast(`${id} raised (${f.priority})${f.priority === 'P1' ? ': duty manager paged' : ''}`);
            setRaise(false);
          }}>Raise ticket</Btn></>}
        >
          <div className="pt-form">
            <Field label="Summary" full><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
            <Field label="Client"><select className="select" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">Partner (no client)</option>{book.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Category"><select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Ticket['category'] })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Priority" hint={f.priority === 'P1' ? 'Service down or client breach in progress' : undefined}><select className="select" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Ticket['priority'] })}>{(['P1', 'P2', 'P3', 'P4'] as const).map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Details" full><textarea className="input" rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
