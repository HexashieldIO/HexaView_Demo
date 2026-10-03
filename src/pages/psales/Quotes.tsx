import { useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown, Save, Send, Check } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Btn, Callout, Legend, Ring, Stacked, StatusBadge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { SERVICE_BY_ID } from '../../modules/registry';
import {
  CAP_LIST, PARTNER, SERVICE_LIST_USD, SIZE_BANDS, TIERS, TIER_BY_ID, EXTRA_INTEGRATION_USD, bandFor, clientBook, deals, priceQuote, savedQuotes,
  type SavedQuote, type SizeBand,
} from '../../data/modules/partner';
import type { ServiceId, Tier } from '../../data/types';
import { Field, PT_TONE, Seg, Toggle, money, moneyFull } from '../partner/parts';

const Q_COLOR = { Draft: 'var(--sev-info)', Sent: 'var(--m-matrix)', Accepted: 'var(--good)', Expired: 'var(--bad)' };
const DEFAULT_SVCS: ServiceId[] = ['mdr', 'ir', 'detection-eng', 'caas'];

export default function PartnerQuotes() {
  const [params] = useSearchParams();
  const { toast } = useApp();
  const book = useMemo(() => clientBook(), []);
  const deal = useMemo(() => deals().find((d) => d.id === params.get('deal')), [params]);
  const dealClient = deal ? book.find((c) => c.id === deal.existingClientId) : undefined;
  const [saved, setSaved] = useState<SavedQuote[]>(() => savedQuotes());

  const [client, setClient] = useState(deal?.endClient ?? 'Meridian Foods Ltd');
  const [tier, setTier] = useState<Tier>(deal?.tier ?? 'Professional');
  const [band, setBand] = useState<SizeBand>(dealClient ? bandFor(dealClient.employees) : 'm');
  const [integrations, setIntegrations] = useState(dealClient?.integrations ?? 14);
  const [services, setServices] = useState<ServiceId[]>(() => (deal ? CAP_LIST.filter((c) => deal.modules.includes(c.id)).flatMap((c) => c.services.slice(0, c.id === 'soc' ? 3 : 1)) : DEFAULT_SVCS));
  const [psPct, setPsPct] = useState(35);
  const [term, setTerm] = useState<1 | 3>(1);
  const [disc, setDisc] = useState(5);
  const [reg, setReg] = useState(deal ? deal.reg === 'approved' || deal.reg === 'expiring' : true);

  const res = useMemo(() => priceQuote({ tier, band, integrations, services, psPct, termYears: term, customerDiscountPct: disc, dealRegistered: reg }), [tier, band, integrations, services, psPct, term, disc, reg]);
  const lim = TIER_BY_ID[tier].integrations;
  const toggleSvc = (s: ServiceId) => setServices((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const nextId = `Q-${3392 + saved.length - savedQuotes().length}`;
  const open = saved.filter((s) => s.status === 'Draft' || s.status === 'Sent');

  const save = (status: SavedQuote['status']) => {
    setSaved((s) => [{ id: nextId, client, dealId: deal?.id, tier, services: services.length, sellUsd: Math.round(res.sellY1), marginPct: Math.round(res.marginPct * 10) / 10, status, daysAgo: 0, owner: 'Tom Ellery' }, ...s]);
  };

  return (
    <>
      <p className="page-intro">
        Price HexaView and the twenty managed services for a client in one place. Partner buy price is list less <b>{PARTNER.discount.licence}%</b> on platform licences and <b>{PARTNER.discount.services}%</b> on HexaShield-delivered services, plus <b>{PARTNER.discount.dealReg} points</b> on registered deals. Professional services are yours to deliver at 30–40% of first-year licence.
        {deal && <> Prefilled from <b>{deal.id}</b> ({deal.opportunity}).</>}
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Open quotes', value: open.length, hint: money(open.reduce((s, q) => s + q.sellUsd, 0)), onClick: () => document.getElementById('pt-saved')?.scrollIntoView({ behavior: 'smooth' }), source: 'Partner quote store' },
          { label: 'Average margin', value: `${(saved.reduce((s, q) => s + q.marginPct, 0) / saved.length).toFixed(1)}%`, onClick: () => document.getElementById('pt-saved')?.scrollIntoView({ behavior: 'smooth' }), source: 'Partner quote store · price book' },
          { label: 'Accepted (90 d)', value: saved.filter((q) => q.status === 'Accepted').length, to: '/partner-sales/pipeline', source: 'Partner quote store' },
          { label: 'This quote, year 1', value: money(res.sellY1), hint: `${res.marginPct.toFixed(1)}% margin`, source: 'Live configurator below' },
          { label: 'Contract value', value: money(res.tcv), hint: `${term}-year term`, source: 'Live configurator below' },
        ]}
      />

      <div className="grid g-3-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="1 · Client and platform" toneColor={PT_TONE}>
            <div className="pt-form">
              <Field label="Client or prospect">
                <input className="input" list="pt-clients" value={client} onChange={(e) => {
                  setClient(e.target.value);
                  const c = book.find((b) => b.name === e.target.value);
                  if (c) { setTier(c.tier); setBand(bandFor(c.employees)); setIntegrations(c.integrations); setServices(c.services); }
                }} />
                <datalist id="pt-clients">{book.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </Field>
              <Field label="Organisation size">
                <select className="select" value={band} onChange={(e) => setBand(e.target.value as SizeBand)}>{SIZE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label} staff · ×{b.factor} on services</option>)}</select>
              </Field>
            </div>
            <div className="grid g3" style={{ gap: 10, marginTop: 14 }}>
              {TIERS.map((t) => (
                <button key={t.id} className={`pt-tierCard ${tier === t.id ? 'on' : ''}`} onClick={() => setTier(t.id)}>
                  <div className="row"><b style={{ fontSize: 13.5 }}>{t.id}</b><span className="spacer" />{tier === t.id && <Check size={15} color="var(--m-partner)" />}</div>
                  <div><b style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{money(t.listUsd)}</b><span className="muted" style={{ fontSize: 11 }}> /yr from</span></div>
                  <span className="muted" style={{ fontSize: 11.5 }}>{t.blurb}</span>
                  <ul>{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
                </button>
              ))}
            </div>
            <div className="pt-form" style={{ marginTop: 14 }}>
              <Field label={`Integrations · ${integrations}`} hint={lim === null ? 'Unlimited on Enterprise / CNI' : integrations > lim ? `${integrations - lim} over the ${lim} included, at ${money(EXTRA_INTEGRATION_USD)}/yr each` : `${lim} included`}>
                <input type="range" min={1} max={60} value={integrations} onChange={(e) => setIntegrations(Number(e.target.value))} style={{ accentColor: '#fb923c' }} />
              </Field>
              <Field label="Term">
                <Seg options={[{ id: '1', label: '1 year' }, { id: '3', label: '3 years · 7% off' }]} value={String(term) as '1' | '3'} onChange={(v) => setTerm(v === '3' ? 3 : 1)} />
              </Field>
            </div>
          </Card>

          <Card title="2 · Managed services" sub={`${services.length} of 20 selected · priced for ${SIZE_BANDS.find((b) => b.id === band)!.label} staff`} toneColor={PT_TONE} actions={<Btn sm ghost onClick={() => setServices([])}>Clear</Btn>}>
            <div className="grid g2" style={{ gap: 14 }}>
              {CAP_LIST.map((cap) => (
                <div key={cap.id}>
                  <div className="section-label" style={{ color: cap.tone, marginTop: 0 }}>{cap.product}</div>
                  <div className="stack" style={{ gap: 4 }}>
                    {cap.services.map((s) => (
                      <label key={s} className={`pt-check ${services.includes(s) ? 'on' : ''}`} style={{ '--tone': cap.tone, justifyContent: 'space-between' } as CSSProperties}>
                        <span className="row" style={{ gap: 6 }}><input type="checkbox" checked={services.includes(s)} onChange={() => toggleSvc(s)} />{SERVICE_BY_ID[s].name}</span>
                        <span className="muted num" style={{ fontSize: 11 }}>{money(SERVICE_LIST_USD[s] * SIZE_BANDS.find((b) => b.id === band)!.factor)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="3 · Services, discount and protection" toneColor={PT_TONE}>
            <div className="pt-form">
              <Field label={`Professional services · ${psPct}% of first-year licence`} hint={`${money(res.psList)} onboarding, tuning and runbooks, delivered by your team`}>
                <input type="range" min={30} max={40} value={psPct} onChange={(e) => setPsPct(Number(e.target.value))} style={{ accentColor: '#fb923c' }} />
              </Field>
              <Field label={`Customer discount · ${disc}%`} hint={disc > 10 ? 'Above 10% needs deal desk sign-off' : 'Within your authority'}>
                <input type="range" min={0} max={15} value={disc} onChange={(e) => setDisc(Number(e.target.value))} style={{ accentColor: '#fb923c' }} />
              </Field>
              <div className="pt-field full">
                <div className="row">
                  <Toggle on={reg} onChange={setReg} />
                  <span style={{ fontSize: 12.5 }}>Registered deal (+{PARTNER.discount.dealReg} pts partner discount){deal ? ` · ${deal.id} is ${deal.reg}` : ''}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ position: 'sticky', top: 76 }}>
          <Card title={`Quote ${nextId}`} sub={`${client} · HexaView ${tier} · ${term}-year`} toneColor={PT_TONE} tinted>
            <div className="row" style={{ gap: 16, alignItems: 'center' }}>
              <Ring value={res.marginPct} max={50} size={88} stroke={9} color="var(--m-partner)" sub="MARGIN">
                {res.marginPct.toFixed(0)}%
              </Ring>
              <div style={{ flex: 1 }}>
                <div className="stat-big" style={{ fontSize: 30 }}>{money(res.sellY1)}</div>
                <div className="stat-label">year 1 to the client · {money(res.marginY1)} yours</div>
              </div>
            </div>
            <div style={{ margin: '14px 0 6px' }}>
              <Stacked tall showLabels parts={[{ value: res.licenceList, color: '#fb923c', label: 'Platform' }, { value: res.servicesList, color: '#4f8cff', label: 'Managed services' }, { value: res.psList, color: '#2dd4bf', label: 'Professional services' }]} />
            </div>
            <Legend items={[{ label: 'Platform', color: '#fb923c' }, { label: 'Managed services', color: '#4f8cff' }, { label: 'Professional services', color: '#2dd4bf' }]} />
            <table className="tbl" style={{ marginTop: 12 }}>
              <thead><tr><th>Line</th><th className="r">List</th><th className="r">Client</th><th className="r">Your cost</th></tr></thead>
              <tbody>
                {res.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11.5 }}>{l.kind === 'service' ? SERVICE_BY_ID[l.label as ServiceId].name : l.label}</td>
                    <td className="r num" style={{ fontSize: 11.5 }}>{money(l.list)}</td>
                    <td className="r num" style={{ fontSize: 11.5 }}>{money(l.sell)}</td>
                    <td className="r num muted" style={{ fontSize: 11.5 }}>{money(l.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}>
              <div className="pt-total"><span>List, year 1</span><b>{moneyFull(res.listY1)}</b></div>
              <div className="pt-total"><span>Client discount ({disc}%)</span><b>−{moneyFull(res.listY1 - res.sellY1)}</b></div>
              <div className="pt-total"><span>Client pays, year 1</span><b>{moneyFull(res.sellY1)}</b></div>
              <div className="pt-total"><span>Your buy price (licence −{res.partnerDiscountLicence}%, services −{res.partnerDiscountServices}%)</span><b>{moneyFull(res.costY1)}</b></div>
              <div className="pt-total big"><span>Your margin, year 1</span><b style={{ color: 'var(--m-partner)' }}>{moneyFull(res.marginY1)}</b></div>
              <div className="pt-total"><span>Total contract value ({term} yr)</span><b>{moneyFull(res.tcv)}</b></div>
            </div>
            {disc > 10 && <div style={{ marginTop: 10 }}><Callout kind="warn">Client discount above 10% goes to the deal desk before the quote can be sent.</Callout></div>}
            <div className="row wrap" style={{ marginTop: 14 }}>
              <Btn primary color={PT_TONE} onClick={() => { save('Draft'); toast(`Quote ${nextId} PDF generated under your brand (${client}, ${moneyFull(res.sellY1)} year 1)`); }}><FileDown /> Generate quote PDF</Btn>
              <Btn onClick={() => { save('Draft'); toast(`${nextId} saved as draft`); }}><Save /> Save draft</Btn>
              <Btn onClick={() => { save('Sent'); toast(disc > 10 ? `${nextId} sent to the deal desk for discount approval first` : `${nextId} emailed to ${client} from your quotes address`); }}><Send /> Send</Btn>
            </div>
          </Card>
        </div>
      </div>

      <div id="pt-saved">
        <Card title="Saved quotes" count={saved.length} flush>
          <DataTable
            rows={saved}
            rowKey={(q) => q.id}
            onRowClick={(q) => toast(`${q.id} opened: ${q.client}, ${moneyFull(q.sellUsd)} year 1`)}
            columns={[
              { key: 'id', header: 'Quote', sort: (q) => q.id, render: (q) => <span className="mono t-main" style={{ fontSize: 11.5 }}>{q.id}</span> },
              { key: 'client', header: 'Client', sort: (q) => q.client, render: (q) => <><div className="t-main">{q.client}</div><div className="t-sub">{q.dealId ?? 'No registration'} · {q.owner}</div></> },
              { key: 'tier', header: 'Tier', sort: (q) => q.tier, render: (q) => q.tier },
              { key: 'svc', header: 'Services', align: 'right', sort: (q) => q.services, render: (q) => q.services },
              { key: 'sell', header: 'Year 1', align: 'right', sort: (q) => q.sellUsd, render: (q) => <span className="num">{money(q.sellUsd)}</span> },
              { key: 'm', header: 'Margin', align: 'right', sort: (q) => q.marginPct, render: (q) => <span className="num">{q.marginPct.toFixed(1)}%</span> },
              { key: 'age', header: 'Created', sort: (q) => -q.daysAgo, render: (q) => <span className="t-sub">{q.daysAgo === 0 ? 'today' : `${q.daysAgo} d ago`}</span> },
              { key: 'st', header: 'Status', sort: (q) => q.status, render: (q) => <StatusBadge value={q.status} map={Q_COLOR} /> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
