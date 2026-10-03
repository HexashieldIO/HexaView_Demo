import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, GraduationCap, ShieldAlert, Wrench, Receipt, Handshake } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Bar, Btn, Callout, Legend, Stacked, Ring, IcoBox } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { WorldMap } from '../../components/WorldMap';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import {
  PARTNER, CAP_LIST, STATUS_COLOR, STATUS_LABEL, MODE_COLOR, MOD_MODES, TIERS,
  clientBook, bookTotals, deals, provisioningQueue, invoices, certifications, STAFF, TRACKS, clientMargin, type PartnerClient,
} from '../../data/modules/partner';
import { monthLabels, scoreTone, fmtNum } from '../../lib/format';
import { ClientAvatar, PT_TONE, money } from './parts';
import { ClientDrawer } from './ClientDrawer';

export default function PartnerOverview() {
  const nav = useNavigate();
  const { customerId } = useApp();
  const book = useMemo(() => clientBook(), []);
  const t = bookTotals(book);
  const ds = useMemo(() => deals(), []);
  const [sel, setSel] = useState<PartnerClient | null>(null);
  const inFlight = ds.filter((d) => d.stage !== 'Closed won' && d.stage !== 'Closed lost');
  const protectedDeals = inFlight.filter((d) => d.reg === 'approved' || d.reg === 'expiring' || d.reg === 'renewal');
  const pipeValue = inFlight.reduce((s, d) => s + d.valueUsd, 0);

  // Attention list: everything that needs the partner, soonest first.
  const att = useMemo(() => {
    const out: { icon: typeof Clock; color: string; title: string; detail: string; path: string; rank: number }[] = [];
    for (const d of ds) {
      if (d.reg === 'expiring' || d.reg === 'renewal') out.push({ icon: Clock, color: 'var(--bad)', title: `${d.opportunity}: registration ${d.reg === 'renewal' ? 'renewal requested' : `expires in ${d.protectedDays} days`}`, detail: 'Renew it or the opportunity opens up to other partners', path: `/partner-sales/deals?deal=${d.id}`, rank: d.protectedDays ?? 0 });
      if (d.reg === 'pending') out.push({ icon: Handshake, color: 'var(--sev-medium)', title: `${d.opportunity}: with the deal desk`, detail: `Reviewed within 2 business days · ${d.deskHoursLeft} h left${d.conflict ? ' · possible conflict' : ''}`, path: `/partner-sales/deals?deal=${d.id}`, rank: 3 });
    }
    for (const c of book.filter((x) => x.status === 'at-risk' || x.critical > 0)) {
      out.push({ icon: c.status === 'at-risk' ? AlertTriangle : ShieldAlert, color: c.status === 'at-risk' ? 'var(--bad)' : 'var(--sev-critical)', title: `${c.short}: ${c.status === 'at-risk' ? `at risk, renewal in ${c.renewalDays} days` : `${c.critical} critical incident${c.critical > 1 ? 's' : ''} open`}`, detail: c.healthNotes.join(' · '), path: `/partner/clients?client=${c.id}`, rank: c.status === 'at-risk' ? 1 : 2 });
    }
    for (const p of provisioningQueue().filter((x) => x.status === 'failed' || x.status === 'awaiting-client')) {
      const c = book.find((x) => x.id === p.clientId);
      out.push({ icon: Wrench, color: p.status === 'failed' ? 'var(--bad)' : 'var(--m-matrix)', title: `${c?.short}: ${p.kind.toLowerCase()} ${p.status === 'failed' ? 'blocked' : 'waiting on client'}`, detail: p.detail, path: `/partner/provisioning?req=${p.id}`, rank: 4 });
    }
    const overdue = invoices().filter((i) => i.status === 'Overdue' || i.status === 'Disputed');
    if (overdue.length) out.push({ icon: Receipt, color: 'var(--sev-high)', title: `${overdue.length} client invoices overdue or disputed`, detail: overdue.map((i) => i.counterparty.split(' ')[0]).join(', '), path: '/partner-billing/invoices?status=overdue', rank: 5 });
    const certs = certifications();
    const expiring = STAFF.flatMap((p) => TRACKS.filter((tr) => certs[p.id][tr.id].state === 'expiring').map((tr) => `${p.name.split(' ')[0]} (${tr.short})`));
    if (expiring.length) out.push({ icon: GraduationCap, color: 'var(--sev-medium)', title: `${expiring.length} certifications expire within 45 days`, detail: expiring.slice(0, 4).join(', '), path: '/enablement/training?state=expiring', rank: 6 });
    return out.sort((a, b) => a.rank - b.rank);
  }, [ds, book]);

  // FlowMap: tier → capability → delivery mode, weighted by ARR.
  const flow = useMemo(() => {
    const tierNodes = TIERS.map((tr) => {
      const cs = book.filter((c) => c.tier === tr.id);
      return { id: `t-${tr.id}`, title: tr.id, count: money(cs.reduce((s, c) => s + c.arrUsd, 0)), sub: `${cs.length} clients`, color: PT_TONE, onClick: () => nav(`/partner/clients?tier=${encodeURIComponent(tr.id)}`) };
    });
    const capNodes = CAP_LIST.map((cap) => {
      const cs = book.filter((c) => c.modules[cap.id] !== 'Off');
      return { id: `c-${cap.id}`, title: cap.product, count: cs.length, sub: 'clients', color: cap.tone, onClick: () => nav(`/partner/clients?module=${cap.id}`) };
    });
    const modeNodes = MOD_MODES.filter((m) => m !== 'Off').map((m) => {
      const n = book.reduce((s, c) => s + Object.values(c.modules).filter((x) => x === m).length, 0);
      return { id: `m-${m}`, title: m, count: n, sub: m === 'Fully managed' ? 'by your SOC' : m === 'Co-managed' ? 'shared with client' : 'guidance only', color: MODE_COLOR[m], onClick: () => nav('/partner/provisioning') };
    });
    const links: FlowLink[] = [];
    for (const tr of TIERS) for (const cap of CAP_LIST) {
      const v = book.filter((c) => c.tier === tr.id && c.modules[cap.id] !== 'Off').reduce((s, c) => s + c.arrUsd, 0);
      if (v) links.push({ from: `t-${tr.id}`, to: `c-${cap.id}`, value: v });
    }
    for (const cap of CAP_LIST) for (const m of MOD_MODES.filter((x) => x !== 'Off')) {
      const v = book.filter((c) => c.modules[cap.id] === m).reduce((s, c) => s + c.arrUsd, 0);
      if (v) links.push({ from: `c-${cap.id}`, to: `m-${m}`, value: v, color: m === 'Advisory' ? '#8593b4' : undefined });
    }
    const columns: FlowColumn[] = [
      { label: 'Client tier · ARR', nodes: tierNodes },
      { label: 'Capability provisioned', nodes: capNodes },
      { label: 'Delivery model', nodes: modeNodes },
    ];
    return { columns, links };
  }, [book, nav]);

  const arrSeries = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 12; i++) out.push(Math.round((t.arr * (0.71 + i * 0.0265) + (i % 3) * 18000) / 1000));
    out[11] = Math.round(t.arr / 1000);
    return out;
  }, [t.arr]);
  const marginPct = (t.margin / book.reduce((s, c) => s + clientMargin(c).sell, 0)) * 100;

  return (
    <>
      <p className="page-intro">
        <b>{PARTNER.name}</b> · {PARTNER.level} ({PARTNER.partnerId}) since {PARTNER.since}. Your side of the partnership: {t.clients} clients across {new Set(book.map((c) => c.sector)).size} sectors, run from {PARTNER.socs.join(' and ')}. Channel manager {PARTNER.channelManager.name}; partner SE {PARTNER.partnerSe.name}.
      </p>

      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Clients', value: t.clients, hint: `${t.onboarding + t.trial} onboarding`, to: '/partner/clients', source: 'HexaView partner tenant registry' },
          { label: 'Annual recurring revenue', value: money(t.arr), delta: { text: '+18% YoY', good: true }, to: '/partner-billing/usage', source: 'HexaShield billing · list price' },
          { label: 'Your margin', value: money(t.margin), unit: `${marginPct.toFixed(0)}%`, to: '/partner-billing/commissions', source: 'Partner price book · HexaShield billing' },
          { label: 'Book Resilience Index', value: t.wRi, hint: 'ARR-weighted', bar: t.wRi, to: '/partner/clients?sort=ri', source: 'Resilience Index across client tenants' },
          { label: 'Open incidents', value: t.incidents, hint: `${t.critical} critical`, to: '/partner/clients?sort=incidents', source: 'HexaSOC case management (all client tenants)' },
          { label: 'Deals in flight', value: inFlight.length, hint: money(pipeValue), to: '/partner-sales/deals', source: 'HexaShield deal registration' },
          { label: 'Protected deals', value: protectedDeals.length, hint: '90-day lock', to: '/partner-sales/deals?reg=approved', source: 'HexaShield deal desk' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Needs your attention" count={att.length} sub="Across clients, deals, provisioning, billing and enablement, soonest first" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {att.slice(0, 9).map((a, i) => {
              const Icon = a.icon;
              return (
                <button key={i} className="list-row" onClick={() => nav(a.path)}>
                  <IcoBox color={a.color}><Icon /></IcoBox>
                  <span className="list-main">
                    <b>{a.title}</b>
                    <span>{a.detail}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Open <ArrowRight size={13} /></span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title="Book health" sub="Every client, coloured by status · click a segment" toneColor={PT_TONE}>
          <div className="row" style={{ gap: 18 }}>
            <button className="link" onClick={() => nav('/partner/clients?sort=ri')} title="Source: Resilience Index across client tenants · click to open" style={{ background: 'none', border: 0, padding: 0 }}>
              <Ring value={t.wRi} size={96} stroke={9} color={scoreTone(t.wRi)} sub="BOOK RI" />
            </button>
            <div style={{ flex: 1 }}>
              <div className="pt-stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <button onClick={() => nav('/partner/clients?status=at-risk')} title="Source: account health model"><small>At risk</small><b style={{ color: 'var(--bad)' }}>{t.atRisk}</b></button>
                <button onClick={() => nav('/partner/clients?status=renewal')} title="Source: HexaShield billing · renewal dates"><small>Renewals ≤ 90 d</small><b>{t.renewals90}</b></button>
              </div>
              <div style={{ marginTop: 10 }}>
                <Stacked tall showLabels parts={(['active', 'onboarding', 'trial', 'at-risk'] as const).map((s) => ({ value: book.filter((c) => c.status === s).length, color: STATUS_COLOR[s], label: STATUS_LABEL[s] }))} />
              </div>
              <div style={{ marginTop: 8 }}>
                <Legend items={(['active', 'onboarding', 'trial', 'at-risk'] as const).map((s) => ({ label: `${STATUS_LABEL[s]} ${book.filter((c) => c.status === s).length}`, color: STATUS_COLOR[s] }))} />
              </div>
            </div>
          </div>
          <WorldMap height={190} onPoint={(id) => setSel(book.find((c) => c.id === id) ?? null)} points={book.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, label: `${c.short} · RI ${c.ri}`, sub: `${c.sector} · ${STATUS_LABEL[c.status]}`, color: STATUS_COLOR[c.status], size: Math.min(1, c.arrUsd / 900000) + 0.25, pulse: c.status === 'at-risk' }))} />
        </Card>
      </div>

      <Card title="Where your recurring revenue runs" sub="Client tier → capability provisioned → who delivers it, weighted by annual run rate · click any node to filter" toneColor={PT_TONE}>
        <FlowMap columns={flow.columns} links={flow.links} goodColor="#fb923c" />
      </Card>

      <div className="grid g-2-1">
        <Card title="Client book at a glance" sub="Resilience, incidents and account health per client · click a tile for detail" actions={<Btn sm onClick={() => nav('/partner/clients')}>All clients</Btn>}>
          <div className="grid g3" style={{ gap: 8 }}>
            {book.map((c) => (
              <button key={c.id} className="pt-tierCard" style={{ gap: 8, padding: '10px 12px', borderColor: c.demoId === customerId ? 'var(--m-partner)' : undefined }} onClick={() => setSel(c)} title="Source: client tenant headlines · click for detail">
                <div className="row" style={{ gap: 8 }}>
                  <ClientAvatar c={c} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 12.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.short}</b>
                    <span className="muted" style={{ fontSize: 10.5 }}>{c.tier}</span>
                  </div>
                  <b className="num" style={{ fontSize: 17, color: scoreTone(c.ri), fontFamily: 'var(--font-display)' }}>{c.ri}</b>
                </div>
                <Bar value={c.health} color={scoreTone(c.health)} size="thin" />
                <div className="row" style={{ fontSize: 10.5, gap: 6 }}>
                  <span className="muted">{c.openIncidents} incidents</span>
                  {c.critical > 0 && <Badge color="var(--sev-critical)">{c.critical} crit</Badge>}
                  <span className="spacer" />
                  <Badge color={STATUS_COLOR[c.status]} dot>{STATUS_LABEL[c.status]}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Recurring revenue" sub="Book ARR (US$k, list) and your margin, 12 months" toneColor={PT_TONE} actions={<button className="link" onClick={() => nav('/partner-billing/commissions')}>Commissions →</button>}>
          <Chart
            height={230}
            option={{
              grid: { left: 44, right: 8, top: 24, bottom: 22 },
              legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 8 },
              tooltip: { trigger: 'axis', valueFormatter: (v) => `US$${fmtNum(Number(v))}k` },
              xAxis: { type: 'category', data: monthLabels(12) },
              yAxis: { type: 'value' },
              series: [
                { name: 'ARR', type: 'bar', data: arrSeries, itemStyle: { color: '#fb923c', borderRadius: [3, 3, 0, 0] }, barWidth: '55%' },
                { name: 'Margin', type: 'line', data: arrSeries.map((v) => Math.round(v * marginPct / 100)), symbol: 'none', lineStyle: { color: '#2dd4bf', width: 2 } },
              ],
            }}
          />
          <div className="mini-stats" style={{ marginTop: 8 }}>
            <div className="mini-stat"><b>{money(t.arr / 12)}</b><span>monthly run rate</span></div>
            <div className="mini-stat"><b>{t.modules}</b><span>modules provisioned</span></div>
            <div className="mini-stat"><b>{t.integrations}</b><span>integrations live</span></div>
          </div>
        </Card>
      </div>

      <Callout color={PT_TONE}>
        <b>Deal registration:</b> an approved registration protects an opportunity for 90 days and is renewable while the deal is live. The HexaShield deal desk reviews within 2 business days. Currently {protectedDeals.length} deals protected, {ds.filter((d) => d.reg === 'pending').length} with the desk ({ds.filter((d) => d.reg === 'pending').map((d) => d.endClient).join(', ')}).{' '}
        <button className="link" onClick={() => nav('/partner-sales/deals')}>Open deal registration →</button>
      </Callout>

      {sel && <ClientDrawer c={sel} onClose={() => setSel(null)} />}
    </>
  );
}
