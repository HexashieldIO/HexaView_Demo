import { useMemo, useState } from 'react';
import { Mail, FileText, Presentation, Send, Save, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Btn, IcoBox } from '../../components/ui';
import { PARTNER, clientBook, type PartnerClient } from '../../data/modules/partner';
import { monthLabels } from '../../lib/format';
import { Field, PT_TONE, Toggle } from '../partner/parts';
import { serviceName, useBrand, type Brand } from './brand';
import { BrandMark } from './Preview';

type Channel = 'Email' | 'PDF report' | 'Deck';
interface Tpl {
  id: string;
  name: string;
  channel: Channel;
  trigger: string;
  subject: string;
  body: string;
  sends30d: number;
  openRate?: number;
  editedDays: number;
  kpis: boolean;
}
const TEMPLATES: Tpl[] = [
  { id: 'monthly', name: 'Monthly service report', channel: 'PDF report', trigger: '1st working day, monthly', subject: '{{client.short}} · Security service report · {{period}}', body: 'Executive summary\n\nYour Resilience Index is {{ri}} ({{ri.delta}} this month). We handled {{incidents.handled}} incidents; {{incidents.open}} remain open, {{incidents.critical}} critical.\n\nWhat would raise your index most\n{{top_action}}\n\nService levels\nAll critical alerts acknowledged inside 15 minutes.', sends30d: 15, editedDays: 12, kpis: true },
  { id: 'incident', name: 'Incident notification', channel: 'Email', trigger: 'P1 / P2 incident opened', subject: '[{{product}}] {{incident.severity}} incident at {{client.short}}: action needed', body: 'Hello {{contact.first}},\n\nOur SOC opened a {{incident.severity}} incident for {{client.name}} at {{incident.time}}.\n\nWhat we have done: contained the affected host and revoked active sessions (approved by your on-call lead).\nWhat we need from you: confirm whether the affected account belongs to a contractor.\n\nTrack it live in {{product}}.\n\n{{csm}}\n{{partner.name}} SOC', sends30d: 41, openRate: 96, editedDays: 30, kpis: false },
  { id: 'digest', name: 'Weekly digest', channel: 'Email', trigger: 'Mondays 07:00 client time', subject: 'Your week in {{product}}: index {{ri}}, {{incidents.open}} open', body: 'Good morning {{contact.first}},\n\nHere is your week at a glance for {{client.name}}.\n\nTop action this week: {{top_action}}\n\nSee everything in {{product}}.\n\nThe {{partner.short}} team', sends30d: 64, openRate: 71, editedDays: 5, kpis: true },
  { id: 'welcome', name: 'Welcome email', channel: 'Email', trigger: 'New client user invited', subject: 'Welcome to {{product}}', body: 'Hello {{contact.first}},\n\n{{client.name}} has invited you to {{product}}, run for you by {{partner.name}}.\n\nSign in with your company account at {{domain}}.\n\nYour customer success manager is {{csm}}.', sends30d: 23, openRate: 88, editedDays: 64, kpis: false },
  { id: 'renewal', name: 'Renewal reminder', channel: 'Email', trigger: '90, 60 and 30 days before renewal', subject: '{{client.short}}: your {{product}} renewal in {{renewal.days}} days', body: 'Hello {{contact.first}},\n\nYour {{product}} subscription renews in {{renewal.days}} days. Over the past year your Resilience Index moved to {{ri}}.\n\n{{csm}} will be in touch to review scope and options.', sends30d: 6, openRate: 82, editedDays: 21, kpis: true },
  { id: 'board', name: 'Quarterly board pack', channel: 'PDF report', trigger: 'Quarterly, on request', subject: '{{client.name}} · Cyber resilience board pack · {{period}}', body: 'Resilience Index {{ri}} and how it is made\nTop risks in money terms\nRegulatory position\nDecisions requested from the board', sends30d: 4, editedDays: 40, kpis: true },
  { id: 'qbr', name: 'Quarterly business review', channel: 'Deck', trigger: 'Quarterly', subject: '{{client.short}} QBR · {{period}}', body: 'Service performance\nIncidents and lessons learned\nRoadmap and recommendations\nCommercials and renewal', sends30d: 3, editedDays: 18, kpis: true },
  { id: 'attest', name: 'Compliance attestation letter', channel: 'PDF report', trigger: 'On request (auditors, insurers)', subject: 'Attestation of managed security services for {{client.name}}', body: 'To whom it may concern,\n\n{{partner.name}} confirms that it provides managed detection and response to {{client.name}} under contract, with evidence available in {{product}}.', sends30d: 7, editedDays: 90, kpis: false },
  { id: 'invoice', name: 'Invoice email', channel: 'Email', trigger: 'Invoice issued', subject: 'Invoice {{invoice.no}} from {{partner.name}}', body: 'Hello,\n\nPlease find invoice {{invoice.no}} attached for {{period}}.\n\nPayment terms: 30 days.', sends30d: 15, openRate: 93, editedDays: 120, kpis: false },
];
const MERGE = ['client.name', 'client.short', 'contact.first', 'ri', 'ri.delta', 'incidents.open', 'incidents.critical', 'top_action', 'period', 'product', 'partner.name', 'csm', 'renewal.days', 'domain'];
const ICON: Record<Channel, typeof Mail> = { Email: Mail, 'PDF report': FileText, Deck: Presentation };

function fill(s: string, c: PartnerClient, b: Brand): string {
  const contact = c.demoId ? 'Alex' : 'Sam';
  const vals: Record<string, string> = {
    'client.name': c.name, 'client.short': c.short, 'contact.first': contact, ri: String(c.ri), 'ri.delta': `${c.riTrend[11] - c.riTrend[10] >= 0 ? '+' : ''}${c.riTrend[11] - c.riTrend[10]}`,
    'incidents.open': String(c.openIncidents), 'incidents.critical': String(c.critical), 'incidents.handled': String(c.openIncidents * 6 + 11), top_action: c.topAction,
    period: `${monthLabels(2)[0]} 2026`, product: b.productName, 'partner.name': PARTNER.name, 'partner.short': PARTNER.short, csm: c.csm, 'renewal.days': String(c.renewalDays), domain: b.domain,
    'incident.severity': c.critical ? 'Critical' : 'High', 'incident.time': '06:42 UTC', 'invoice.no': 'NW-4412',
  };
  return s.replace(/\{\{([a-z_.]+)\}\}/g, (_, k: string) => vals[k] ?? `{{${k}}}`);
}

export default function WhiteLabelTemplates() {
  const brand = useBrand();
  const { toast } = useApp();
  const nav = useNavigate();
  const book = useMemo(() => clientBook(), []);
  const [tpls, setTpls] = useState(TEMPLATES);
  const [selId, setSelId] = useState('monthly');
  const [clientId, setClientId] = useState(book[0].id);
  const t = tpls.find((x) => x.id === selId)!;
  const c = book.find((x) => x.id === clientId)!;
  const upd = (p: Partial<Tpl>) => setTpls((ts) => ts.map((x) => (x.id === selId ? { ...x, ...p } : x)));
  const emails = tpls.filter((x) => x.channel === 'Email');

  return (
    <>
      <p className="page-intro">
        Every email, report and deck your clients receive carries your brand and your voice. Edit a template, insert live merge fields and preview it with any client's real numbers; sends come from <b>notifications@{brand.domain.replace(/^portal\./, '')}</b>.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Templates', value: tpls.length, hint: `${emails.length} email`, onClick: () => setSelId(tpls[0].id), source: 'Template store' },
          { label: 'Emails sent (30 d)', value: emails.reduce((s, x) => s + x.sends30d, 0), onClick: () => setSelId('digest'), source: 'Notification service · delivery log' },
          { label: 'Average open rate', value: `${Math.round(emails.reduce((s, x) => s + (x.openRate ?? 0), 0) / emails.length)}%`, onClick: () => setSelId('incident'), source: 'Notification service · opens' },
          { label: 'Reports issued (30 d)', value: tpls.filter((x) => x.channel !== 'Email').reduce((s, x) => s + x.sends30d, 0), to: '/reports/history', source: 'Reporting Centre · issued reports' },
          { label: 'Bounces', value: 0, hint: 'DKIM pending', to: '/white-label/domains', source: 'Notification service · bounces' },
        ]}
      />

      <div className="grid" style={{ gridTemplateColumns: '260px minmax(0, 1fr) minmax(0, 1.1fr)', alignItems: 'start' }}>
        <Card title="Templates" flush>
          <div className="list" style={{ padding: '0 12px 8px' }}>
            {tpls.map((x) => {
              const Icon = ICON[x.channel];
              return (
                <button key={x.id} className="list-row" onClick={() => setSelId(x.id)} style={{ background: x.id === selId ? 'color-mix(in srgb, var(--m-partner) 10%, transparent)' : undefined, borderRadius: 8, padding: '9px 8px' }}>
                  <IcoBox color={x.id === selId ? PT_TONE : undefined}><Icon /></IcoBox>
                  <span className="list-main">
                    <b>{x.name}</b>
                    <span>{x.channel} · {x.sends30d} sent (30 d)</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={t.name} sub={`${t.channel} · ${t.trigger} · edited ${t.editedDays} d ago`} toneColor={PT_TONE}>
          <div className="stack" style={{ gap: 12 }}>
            <Field label={t.channel === 'Email' ? 'Subject' : 'Title'}><input className="input" value={t.subject} onChange={(e) => upd({ subject: e.target.value })} /></Field>
            <Field label="Body"><textarea className="input" rows={12} value={t.body} onChange={(e) => upd({ body: e.target.value })} style={{ fontFamily: 'var(--font-ui)', lineHeight: 1.5 }} /></Field>
            <div>
              <div className="pt-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Merge fields · click to insert</div>
              <div className="chips">
                {MERGE.map((m) => <button key={m} className="pt-merge" onClick={() => upd({ body: `${t.body}{{${m}}}` })}>{`{{${m}}}`}</button>)}
              </div>
            </div>
            <div className="row"><Toggle on={t.kpis} onChange={(v) => upd({ kpis: v })} /><span style={{ fontSize: 12.5 }}>Include the live KPI block (Resilience, incidents, top action)</span></div>
            <div className="row wrap">
              <Btn primary color={PT_TONE} onClick={() => toast(`Test of “${t.name}” sent to you, rendered with ${c.short}'s data`)}><Send /> Send test</Btn>
              <Btn onClick={() => { upd({ editedDays: 0 }); toast(`“${t.name}” saved as v${Math.floor(t.editedDays / 10) + 3}`); }}><Save /> Save</Btn>
              {t.channel !== 'Email' && <Btn ghost onClick={() => nav('/reports/scheduled')}><CalendarClock /> Schedule</Btn>}
            </div>
          </div>
        </Card>

        <Card title="Preview" sub="Rendered with live client data" actions={<select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>{book.map((x) => <option key={x.id} value={x.id}>{x.short}</option>)}</select>}>
          {t.channel === 'Email' ? (
            <div className="pt-email">
              <div style={{ fontSize: 11, color: '#5a6478', marginBottom: 8 }}>
                <b>From:</b> {brand.productName} &lt;notifications@{brand.domain.replace(/^portal\./, '')}&gt;<br />
                <b>Subject:</b> {fill(t.subject, c, brand)}
              </div>
              <div className="pt-email-inner">
                <div className="pt-email-head" style={{ background: brand.sidebar }}>
                  <BrandMark brand={brand} size={24} />
                  {brand.logoShape === 'square' && <b style={{ fontSize: 13 }}>{brand.productName}</b>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, opacity: 0.7 }}>{c.short}</span>
                </div>
                <div style={{ height: 3, background: brand.primary }} />
                {t.kpis && (
                  <div className="pt-email-kpis" style={{ paddingTop: 14 }}>
                    <div><small>Resilience</small><b style={{ color: brand.primary }}>{c.ri}</b></div>
                    <div><small>Open incidents</small><b>{c.openIncidents}</b></div>
                    <div><small>Critical</small><b style={{ color: c.critical ? '#e5533d' : undefined }}>{c.critical}</b></div>
                  </div>
                )}
                <div className="pt-email-body">{fill(t.body, c, brand)}</div>
                <div style={{ padding: '0 18px 16px' }}><span style={{ display: 'inline-block', background: brand.primary, color: '#fff', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700 }}>Open {brand.productName}</span></div>
                <div className="pt-email-foot">{PARTNER.name} · {PARTNER.hq} · {brand.supportEmail}{brand.poweredBy ? ' · Powered by HexaShield' : ''}</div>
              </div>
            </div>
          ) : (
            <div className="pt-email" style={{ padding: 16 }}>
              <div className="pt-email-inner" style={{ aspectRatio: t.channel === 'Deck' ? '16 / 9' : '1 / 1.3', display: 'flex', flexDirection: 'column', maxWidth: t.channel === 'Deck' ? 560 : 420 }}>
                <div style={{ background: brand.sidebar, color: '#fff', padding: 18, flex: t.channel === 'Deck' ? 1 : '0 0 46%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div className="row" style={{ gap: 8 }}><BrandMark brand={brand} size={24} />{brand.logoShape === 'square' && <b style={{ fontSize: 12.5 }}>{brand.productName}</b>}</div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: brand.accent, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>{fill(t.subject, c, brand)}</div>
                  </div>
                  <div style={{ height: 3, width: 60, background: brand.primary, borderRadius: 2 }} />
                </div>
                {t.channel !== 'Deck' && (
                  <div style={{ padding: 16, fontSize: 11, lineHeight: 1.55, flex: 1, overflow: 'hidden' }}>
                    {t.kpis && (
                      <div className="pt-email-kpis" style={{ padding: '0 0 10px' }}>
                        <div><small>Resilience</small><b style={{ color: brand.primary }}>{c.ri}</b></div>
                        <div><small>Incidents</small><b>{c.openIncidents}</b></div>
                        <div><small>Services</small><b>{c.services.length}</b></div>
                      </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{fill(t.body, c, brand).slice(0, 420)}</div>
                  </div>
                )}
                <div style={{ fontSize: 9, color: '#8b94a8', padding: '6px 16px', borderTop: '1px solid #eef1f6' }}>Prepared by {PARTNER.name} for {c.name} · {serviceName('HexaSOC', brand)} · page 1</div>
              </div>
            </div>
          )}
          <div className="row" style={{ marginTop: 10, gap: 6 }}>
            <Badge color={PT_TONE}>{t.channel}</Badge>
            <span className="muted" style={{ fontSize: 11 }}>Unknown merge fields are left visible so they are caught before sending.</span>
          </div>
        </Card>
      </div>
    </>
  );
}
