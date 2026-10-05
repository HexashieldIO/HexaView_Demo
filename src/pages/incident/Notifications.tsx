import { useState } from 'react';
import { Check, Send, Ban, ExternalLink, Mail } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, Chip, KV } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { fmtNum } from '../../lib/format';
import type { CustomerProfile } from '../../data/types';
import { IR_TYPES, SEV_LABEL, PHASE_LABEL, type IrIncident, type Notice, type NoticeKind, type NoticeStatus } from '../../data/modules/incident';
import { useIr, useNow, IrPage, IncidentPicker, NoIncident, Pill, noticeClock, fmtT, useGuideTarget, IR_TONE } from './parts';
import { ir } from './store';

const MIN = 60_000;
const KIND_META: Record<NoticeKind, { label: string; color: string }> = {
  regulator: { label: 'Regulator', color: 'var(--sev-high)' },
  insurer: { label: 'Insurer', color: 'var(--m-insurance)' },
  law: { label: 'Law enforcement', color: 'var(--bad)' },
  contract: { label: 'Contractual', color: 'var(--m-comply)' },
  internal: { label: 'Internal', color: 'var(--sev-info)' },
  customer: { label: 'Customers / individuals', color: 'var(--m-core)' },
};
const STATUS_COLOR: Record<NoticeStatus, string> = { draft: 'var(--sev-medium)', approved: 'var(--m-core)', sent: 'var(--good)', na: 'var(--text-muted)' };

export default function Notifications() {
  return <IrPage><Inner /></IrPage>;
}
function Inner() {
  const { focus } = useIr();
  return <><IncidentPicker />{focus ? <Nt inc={focus} /> : <NoIncident />}</>;
}

function template(c: CustomerProfile, inc: IrIncident, n: Notice): string {
  const tenant = c.tenants.find((t) => t.id === inc.tenantIds[0]);
  const facts = `Incident reference: ${inc.id}\nEntity: ${tenant?.name ?? c.name}, ${tenant?.city ?? ''}\nDetected: ${fmtT(inc.detectedAt)} · Declared: ${fmtT(inc.declaredAt)}\nNature: ${IR_TYPES[inc.type].label} (${SEV_LABEL[inc.sev]}), currently in ${PHASE_LABEL[inc.phase].toLowerCase()}\nSystems affected: ${inc.assets.join(', ')}\nBusiness services: ${inc.services.join('; ')}\nData potentially affected: ${inc.dataClasses.join('; ')}${inc.stats.records ? ` (approx. ${fmtNum(inc.stats.records)} records, under assessment)` : ''}`;
  if (n.kind === 'regulator') return `To: ${n.recipient}\nSubject: ${n.name} · ${c.name}\nBasis: ${n.basis}\n\n${facts}\n\nWhat happened\n${inc.summary}\n\nMeasures taken\nAffected systems were contained (${inc.stats.hostsIsolated} hosts isolated, ${inc.stats.accountsDisabled} accounts disabled). Forensic investigation is under way with HexaShield DFIR under legal privilege.\n\nCross-border / other authorities: assessed by ${inc.roles.find((r) => r.role === 'Legal')?.name}.\n\nContact: ${inc.commander} (incident commander) · ${c.people.grcLead.email}\n\nThis is an initial notification; an intermediate and a final report will follow within the statutory periods.`;
  if (n.kind === 'insurer') return `To: ${n.recipient}\nSubject: Notice of circumstance · cyber policy · ${c.name}\n\n${facts}\n\nWe are notifying a circumstance that may give rise to a claim. Panel vendors engaged: HexaShield (IR retainer) and the panel breach coach. Estimated exposure is being quantified; no ransom has been paid or offered.\n\nPlease confirm coverage position and any further panel requirements.`;
  if (n.kind === 'law') return `To: ${n.recipient}\nSubject: Crime report · ${c.name} · ${inc.id}\n\n${facts}\n\nIndicators of compromise and timeline extracts are available on request through counsel. Point of contact: ${c.people.socLead.name} (${c.people.socLead.email}).`;
  if (n.kind === 'contract') return `To: ${n.recipient}\nSubject: Security incident notice under our agreement · ${inc.id}\nBasis: ${n.basis}\n\n${facts}\n\nWe will share further detail as the investigation allows. Please confirm your point of contact and whether any of your systems or credentials connected to the affected environment.`;
  if (n.kind === 'internal') return `To: ${n.recipient}\nSubject: Important: security incident ${inc.id}\n\nWe are responding to a security incident affecting ${inc.services[0] ?? 'some systems'}. The security team and HexaShield are working on it now.\n\nWhat you should do:\n• Do not discuss the incident outside the company or on social media\n• Report anything unusual to the service desk\n• Expect a call-back before any password or MFA reset; we will never ask for your code\n\nUpdates will follow on the ${c.short} intranet and Teams.`;
  return `To: ${n.recipient}\nSubject: Notice of a security incident · ${c.name}\n\nWe are writing to let you know about a security incident that ${inc.personal ? 'may have involved some of your personal information' : 'affected material we hold for you'}.\n\nWhat happened: ${inc.summary.split('.')[0]}.\nWhat we are doing: we contained the incident, engaged independent forensic experts and notified the relevant authorities.\nWhat you can do: be alert to unexpected messages that refer to this incident.\n\nQuestions: ${c.domain}/security-notice`;
}

function Nt({ inc }: { inc: IrIncident }) {
  const { c, actor, toast, nav, ppl } = useIr();
  const now = useNow(1000);
  const [kf, setKf] = useState<'all' | NoticeKind | 'due'>('all');
  const ns = inc.notices;
  const firstDraft = ns.find((n) => n.status === 'draft' && n.kind === 'regulator') ?? ns.find((n) => n.status === 'draft') ?? ns[0];
  const [selId, setSelId] = useState<string | undefined>(firstDraft?.id);
  const sel = ns.find((n) => n.id === selId) ?? ns[0];
  const guide = useGuideTarget(4);
  const live = inc.status === 'active';
  const pending = ns.filter((n) => n.status === 'draft' || n.status === 'approved');
  const due24 = pending.filter((n) => n.dueAt && n.dueAt - now < 1440 * MIN && n.dueAt > now);
  const overdue = pending.filter((n) => n.dueAt && n.dueAt < now);
  const sent = ns.filter((n) => n.status === 'sent');
  const onTime = sent.filter((n) => !n.dueAt || (n.sentAt ?? 0) <= n.dueAt);
  const rows = ns.filter((n) => (kf === 'all' ? true : kf === 'due' ? pending.includes(n) && !!n.dueAt : n.kind === kf));
  const src = 'HexaSOC regulatory clock engine · tenant regimes · insurance policy';

  return (
    <>
      <p className="page-intro">
        Notifications required for <b>{inc.id}</b>, computed from {c.tenants.find((t) => t.id === inc.tenantIds[0])?.regimes.join(', ')}, the cyber policy with {c.insurance.carrier.split('/')[0].trim()}, supplier contracts and the internal escalation policy. Clocks run from the declaration time. Each moves draft → approved → sent; sends go out through the <button className="ir-link" onClick={() => nav('/comms/inbox')}>Comms Hub</button> and are logged.
      </p>
      <KpiStrip toneColor={IR_TONE} items={[
        { label: 'Required notifications', value: ns.filter((n) => n.status !== 'na').length, hint: `${ns.filter((n) => n.kind === 'regulator').length} regulatory`, onClick: () => setKf('all'), source: src },
        { label: 'Due < 24 h', value: due24.length, hint: due24[0] ? noticeClock(due24.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0], now).label : 'none', toneColor: due24.length ? 'var(--sev-critical)' : IR_TONE, onClick: () => setKf('due'), source: src },
        { label: 'Overdue', value: overdue.length, toneColor: overdue.length ? 'var(--bad)' : 'var(--good)', onClick: () => setKf('due'), source: src },
        { label: 'Approved, not sent', value: ns.filter((n) => n.status === 'approved').length, onClick: () => setKf('all'), source: 'Approval ledger' },
        { label: 'Sent on time', value: `${onTime.length}/${sent.length}`, toneColor: 'var(--good)', onClick: () => setKf('all'), source: 'Comms Hub delivery receipts' },
      ]} />

      <div className="grid g-3-2">
        <Card title="Required notifications" count={rows.length} sub="Click a row to preview the template" flush>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelId(r.id)}
            pageSize={14}
            initialSort={{ key: 'due', dir: 'asc' }}
            toolbar={<span className="chips"><Chip on={kf === 'all'} onClick={() => setKf('all')} color={IR_TONE}>All {ns.length}</Chip><Chip on={kf === 'due'} onClick={() => setKf('due')} color="var(--sev-critical)">Clock running {pending.filter((n) => n.dueAt).length}</Chip>{(Object.keys(KIND_META) as NoticeKind[]).filter((k) => ns.some((n) => n.kind === k)).map((k) => <Chip key={k} on={kf === k} onClick={() => setKf(k)} color={KIND_META[k].color}>{KIND_META[k].label} {ns.filter((n) => n.kind === k).length}</Chip>)}</span>}
            columns={[
              { key: 'n', header: 'Notification', sort: (r) => r.name, render: (r) => <div style={{ background: r.id === sel?.id ? 'color-mix(in srgb, var(--m-ir) 9%, transparent)' : undefined, borderRadius: 6, padding: 2 }}><div className="t-main" style={{ whiteSpace: 'normal', maxWidth: 300 }}>{r.name}</div><div className="t-sub">{r.recipient}</div></div> },
              { key: 'k', header: 'Kind', sort: (r) => r.kind, render: (r) => <Pill color={KIND_META[r.kind].color}>{KIND_META[r.kind].label}</Pill> },
              { key: 'due', header: 'Deadline', sort: (r) => (r.status === 'sent' || r.status === 'na' ? 9e15 : r.dueAt ?? 8e15), render: (r) => { const k = noticeClock(r, now); return <div style={{ minWidth: 130 }}><b className="ir-mono" style={{ color: k.color, fontSize: 11.5 }}>{k.label}</b><div className="ir-clock-bar" style={{ marginTop: 3 }}><i style={{ width: `${k.pct}%`, background: k.color }} /></div>{r.dueAt && <div className="t-sub">due {fmtT(r.dueAt)}</div>}</div>; } },
              { key: 's', header: 'Status', sort: (r) => r.status, render: (r) => <Flow s={r.status} /> },
              { key: 'o', header: 'Owner', sort: (r) => r.owner, render: (r) => <span className="t-sub">{r.owner}</span> },
            ]}
          />
        </Card>

        {sel && (
          <Card title={sel.name} sub={`${KIND_META[sel.kind].label} · ${sel.recipient}`} actions={<Flow s={sel.status} />}>
            <div className="stack" style={{ gap: 12 }}>
              <KV rows={[
                ['Basis', sel.basis],
                ['Clock', sel.dueAt ? `${fmtT(sel.startAt)} → ${fmtT(sel.dueAt)}` : 'No statutory deadline'],
                ['Remaining', <b key="r" style={{ color: noticeClock(sel, now).color }}>{noticeClock(sel, now).label}</b>],
                ['Owner', sel.owner],
                ['Channel', sel.channel],
                ...(sel.approvedBy ? [['Approved', `${sel.approvedBy} · ${sel.approvedAt ? fmtT(sel.approvedAt) : ''}`] as [string, string]] : []),
                ...(sel.sentAt ? [['Sent', fmtT(sel.sentAt)] as [string, string]] : []),
              ]} />
              <div>
                <div className="section-label">Template preview</div>
                <div className="ir-notice-tpl">{template(c, inc, sel)}</div>
              </div>
              {live && sel.status !== 'sent' && sel.status !== 'na' && (
                <div className="row wrap" style={{ gap: 8 }}>
                  {sel.status === 'draft' && <span className={guide}><Btn primary color={IR_TONE} onClick={() => { ir.approveNotice(c, inc.id, sel.id, actor); toast(`Approved: ${sel.name}`); }}><Check size={13} /> Approve</Btn></span>}
                  <Btn primary={sel.status === 'approved'} color={IR_TONE} onClick={() => { ir.sendNotice(c, inc.id, sel.id, actor); toast(`Sent via ${sel.channel}: ${sel.name}`); }}><Send size={13} /> Send{sel.status === 'draft' ? ' (approve & send)' : ''}</Btn>
                  <Btn ghost onClick={() => { ir.notApplicable(c, inc.id, sel.id, actor); toast('Marked not required; assessment logged'); }}><Ban size={13} /> Not required</Btn>
                </div>
              )}
              {sel.status === 'sent' && <Callout kind="good">Delivered. Receipt stored in the Comms Hub and the audit ledger. <button className="ir-link" onClick={() => nav('/comms/inbox')}>Open in Comms Hub <ExternalLink size={11} /></button></Callout>}
              {sel.kind === 'regulator' && sel.status === 'draft' && <Callout kind="warn">Regulatory notices are approved by legal ({ppl.legal.name}) before sending.</Callout>}
            </div>
          </Card>
        )}
      </div>

      <Card title="Internal and customer communications" sub="Drafts held with the incident; sent through the Comms Hub" actions={<Btn sm ghost onClick={() => nav('/comms/channels')}><Mail size={13} /> Comms Hub channels</Btn>}>
        <div className="grid g3">
          {ns.filter((n) => n.kind === 'internal' || n.kind === 'customer').map((n) => (
            <button key={n.id} type="button" className="ir-ext-card" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => setSelId(n.id)}>
              <div className="row between"><b>{n.name}</b><Flow s={n.status} /></div>
              <small>{n.recipient}</small>
              <span className="ir-sub" style={{ whiteSpace: 'pre-wrap', maxHeight: 64, overflow: 'hidden' }}>{template(c, inc, n).split('\n').slice(2, 5).join(' ')}</span>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

function Flow({ s }: { s: NoticeStatus }) {
  if (s === 'na') return <Pill color="var(--text-muted)">Not required</Pill>;
  const order: NoticeStatus[] = ['draft', 'approved', 'sent'];
  const ix = order.indexOf(s);
  return <span className="ir-flow" style={{ ['--pc' as string]: STATUS_COLOR[s] }}>{order.map((x, i) => <span key={x} className={i <= ix ? 'on' : ''}>{x}</span>)}</span>;
}
