import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Bar, Btn, Callout, KV, StatusBadge, Timeline, IcoBox } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { FlowMap, type FlowLink } from '../../components/FlowMap';
import { PARTNER, SPIFS, TIERS, clientBook, clientMargin, commissions, type CommissionLine, type PartnerClient } from '../../data/modules/partner';
import { scoreTone } from '../../lib/format';
import { ClientAvatar, PT_TONE, money, moneyFull } from '../partner/parts';
import { ClientDrawer } from '../partner/ClientDrawer';

const PAY_COLOR = { Paid: 'var(--good)', Approved: 'var(--m-matrix)', Accruing: 'var(--sev-medium)' };

export default function BillingCommissions() {
  const { toast } = useApp();
  const book = useMemo(() => clientBook(), []);
  const lines = useMemo(() => commissions(), []);
  const [selQ, setSelQ] = useState<CommissionLine | null>(null);
  const [selC, setSelC] = useState<PartnerClient | null>(null);
  const total = (l: CommissionLine) => l.resaleMargin + l.servicesMargin + l.referralFees + l.rebate + l.spif;
  const ytd = lines.slice(1).reduce((s, l) => s + total(l), 0);
  const cur = lines[lines.length - 1];
  const rows = book.map((c) => ({ c, m: clientMargin(c) }));
  const sell = rows.reduce((s, r) => s + r.m.sell, 0);
  const margin = rows.reduce((s, r) => s + r.m.margin, 0);

  const flow = useMemo(() => {
    const links: FlowLink[] = [];
    const tierNodes = TIERS.map((t) => {
      const rs = rows.filter((r) => r.c.tier === t.id);
      const lic = rs.reduce((s, r) => s + r.m.licence * 0.97, 0);
      const svc = rs.reduce((s, r) => s + r.m.services * 0.97, 0);
      if (lic) links.push({ from: `t-${t.id}`, to: 'lic', value: lic });
      if (svc) links.push({ from: `t-${t.id}`, to: 'svc', value: svc });
      return { id: `t-${t.id}`, title: t.id, count: money(lic + svc), sub: `${rs.length} clients`, color: PT_TONE };
    });
    const licSell = rows.reduce((s, r) => s + r.m.licence * 0.97, 0);
    const svcSell = rows.reduce((s, r) => s + r.m.services * 0.97, 0);
    const licCost = rows.reduce((s, r) => s + r.m.licence * (1 - PARTNER.discount.licence / 100), 0);
    const svcCost = rows.reduce((s, r) => s + r.m.services * (1 - PARTNER.discount.services / 100), 0);
    links.push({ from: 'lic', to: 'hx', value: licCost, color: '#8a9bc0' }, { from: 'lic', to: 'you', value: licSell - licCost, color: '#2dd4bf' });
    links.push({ from: 'svc', to: 'hx', value: svcCost, color: '#8a9bc0' }, { from: 'svc', to: 'you', value: svcSell - svcCost, color: '#2dd4bf' });
    return {
      columns: [
        { label: 'Client tier · billed', nodes: tierNodes },
        { label: 'Revenue type', nodes: [{ id: 'lic', title: 'Platform licences', count: money(licSell), sub: `−${PARTNER.discount.licence}% buy` }, { id: 'svc', title: 'Managed services', count: money(svcSell), sub: `−${PARTNER.discount.services}% buy` }] },
        { label: 'Where it goes', nodes: [{ id: 'hx', title: 'HexaShield wholesale', count: money(licCost + svcCost), sub: 'payable', color: '#8a9bc0' }, { id: 'you', title: 'Your margin', count: money(margin), sub: `${((margin / sell) * 100).toFixed(0)}%`, state: 'good' as const }] },
      ],
      links,
    };
  }, [rows, margin, sell]);

  return (
    <>
      <p className="page-intro">
        Margin, referral fees, the {PARTNER.level} growth rebate and SPIFs, reconciled quarterly against HexaShield billing. Margin is earned on resale (licence buy at −{PARTNER.discount.licence}%, services at −{PARTNER.discount.services}%); referral deals pay {PARTNER.discount.referralFee}% of first-year value.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: `Earnings ${PARTNER.fiscalYear} YTD`, value: money(ytd), delta: { text: '+22% YoY', good: true }, onClick: () => setSelQ(lines[2]), source: 'HexaShield partner billing · commission statements' },
          { label: `This quarter (${cur.quarter})`, value: money(total(cur)), hint: 'accruing', onClick: () => setSelQ(cur), source: 'Commission ledger · accrual' },
          { label: 'Annual resale margin', value: money(margin), unit: `${((margin / sell) * 100).toFixed(0)}%`, onClick: () => document.getElementById('pt-margin')?.scrollIntoView({ behavior: 'smooth' }), source: 'Partner price book × client subscriptions' },
          { label: 'Referral fees YTD', value: money(lines.slice(1).reduce((s, l) => s + l.referralFees, 0)), onClick: () => setSelQ(lines[3]), source: 'Commission ledger' },
          { label: 'SPIFs earned', value: money(SPIFS.reduce((s, x) => s + x.value, 0)), hint: `${SPIFS.length} programmes`, onClick: () => document.getElementById('pt-spif')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaShield incentive programmes' },
        ]}
      />

      <Card title="Where client revenue goes" sub="Annual run rate by tier, split by revenue type and into HexaShield wholesale and your margin" toneColor={PT_TONE}>
        <FlowMap columns={flow.columns} links={flow.links} goodColor="#fb923c" />
      </Card>

      <div className="grid g-2-1">
        <Card title="Earnings by quarter" sub="Click a bar for the commission statement" toneColor={PT_TONE}>
          <Chart
            height={250}
            onClick={(p) => {
              const i = (p as { dataIndex?: number }).dataIndex;
              if (i !== undefined) setSelQ(lines[i]);
            }}
            option={{
              grid: { left: 50, right: 8, top: 28, bottom: 22 },
              legend: { top: 0, itemWidth: 10, itemHeight: 8 },
              tooltip: { trigger: 'axis', valueFormatter: (v) => money(Number(v)) },
              xAxis: { type: 'category', data: lines.map((l) => l.quarter) },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => money(v) } },
              series: [
                { name: 'Resale margin', type: 'bar', stack: 'q', data: lines.map((l) => l.resaleMargin), itemStyle: { color: '#fb923c' } },
                { name: 'Services margin', type: 'bar', stack: 'q', data: lines.map((l) => l.servicesMargin), itemStyle: { color: '#4f8cff' } },
                { name: 'Referral', type: 'bar', stack: 'q', data: lines.map((l) => l.referralFees), itemStyle: { color: '#a07cfb' } },
                { name: 'Rebate', type: 'bar', stack: 'q', data: lines.map((l) => l.rebate), itemStyle: { color: '#2dd4bf' } },
                { name: 'SPIF', type: 'bar', stack: 'q', data: lines.map((l) => l.spif), itemStyle: { color: '#ecc873', borderRadius: [3, 3, 0, 0] } },
              ],
            }}
          />
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <div id="pt-spif">
            <Card title="SPIFs and incentives" toneColor={PT_TONE}>
              <div className="list">
                {SPIFS.map((s) => (
                  <div key={s.name} className="list-row">
                    <IcoBox color={PT_TONE}><Trophy /></IcoBox>
                    <span className="list-main"><b>{s.name}</b><span>{s.rule} · ends {s.ends}</span></span>
                    <span className="stack" style={{ alignItems: 'flex-end', gap: 2 }}><b className="num">{money(s.value)}</b><span className="muted" style={{ fontSize: 10.5 }}>{s.earned} earned</span></span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card title="Payout schedule">
            <Timeline
              items={lines.slice().reverse().map((l) => ({ time: l.quarter, title: `${moneyFull(total(l))} · ${l.status}`, body: l.status === 'Paid' ? 'Credited against HexaShield invoice' : l.status === 'Approved' ? 'Pays with the next HexaShield invoice (net 30)' : 'Statement issued 10 business days after quarter end', color: PAY_COLOR[l.status] }))}
            />
          </Card>
        </div>
      </div>

      <div id="pt-margin">
        <Card title="Margin by client" count={rows.length} sub="Annual, at current subscription · click for client detail" flush>
          <DataTable
            rows={rows}
            rowKey={(r) => r.c.id}
            onRowClick={(r) => setSelC(r.c)}
            initialSort={{ key: 'm', dir: 'desc' }}
            pageSize={20}
            columns={[
              { key: 'c', header: 'Client', sort: (r) => r.c.name, render: (r) => <div className="row" style={{ gap: 8 }}><ClientAvatar c={r.c} size={24} /><div><div className="t-main">{r.c.short}</div><div className="t-sub">{r.c.tier}</div></div></div> },
              { key: 's', header: 'Billed / yr', align: 'right', sort: (r) => r.m.sell, render: (r) => <span className="num">{money(r.m.sell)}</span> },
              { key: 'cost', header: 'HexaShield cost', align: 'right', sort: (r) => r.m.cost, render: (r) => <span className="num muted">{money(r.m.cost)}</span> },
              { key: 'm', header: 'Your margin', align: 'right', sort: (r) => r.m.margin, render: (r) => <b className="num">{money(r.m.margin)}</b> },
              { key: 'pct', header: 'Margin %', sort: (r) => r.m.marginPct, render: (r) => <div style={{ width: 110 }}><Bar value={r.m.marginPct} max={35} size="thin" color={PT_TONE} /><span className="t-sub">{r.m.marginPct.toFixed(1)}%</span></div> },
              { key: 'ri', header: 'Resilience', align: 'right', sort: (r) => r.c.ri, render: (r) => <span className="num" style={{ color: scoreTone(r.c.ri), fontWeight: 700 }}>{r.c.ri}</span> },
              { key: 'ren', header: 'Renewal', sort: (r) => r.c.renewalDays, render: (r) => <span className="t-sub">{r.c.renewalDays} d</span> },
            ]}
          />
        </Card>
      </div>

      {selQ && (
        <Drawer title={`Commission statement · ${selQ.quarter}`} sub={`${PARTNER.name} · ${PARTNER.partnerId}`} onClose={() => setSelQ(null)} footer={<Btn primary color={PT_TONE} onClick={() => toast(`Statement ${selQ.quarter} downloaded (PDF + CSV)`)}>Download statement</Btn>}>
          <KV
            rows={[
              ['Status', <StatusBadge value={selQ.status} map={PAY_COLOR} />],
              ['Resale margin (licences)', moneyFull(selQ.resaleMargin)],
              ['Services margin', moneyFull(selQ.servicesMargin)],
              ['Referral fees', moneyFull(selQ.referralFees)],
              [`${PARTNER.level} growth rebate (3%)`, moneyFull(selQ.rebate)],
              ['SPIFs', moneyFull(selQ.spif)],
              [<b>Total</b>, <b>{moneyFull(total(selQ))}</b>],
            ]}
          />
          <div style={{ marginTop: 12 }}><Callout>Reconciled against HexaShield billing; any variance over 1% opens a billing ticket automatically.</Callout></div>
          <div style={{ marginTop: 12 }} className="chips"><Badge color={PT_TONE}>Source: HexaShield partner billing</Badge></div>
        </Drawer>
      )}
      {selC && <ClientDrawer c={selC} onClose={() => setSelC(null)} />}
    </>
  );
}
