import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, KpiStrip, Badge, Bar, Btn, Callout, KV, SectionLabel } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { SERVICE_BY_ID } from '../../modules/registry';
import { usage, type UsageRow } from '../../data/modules/partner';
import { fmtNum, monthLabels } from '../../lib/format';
import { ClientAvatar, PT_TONE, money } from '../partner/parts';
import { ClientDrawer } from '../partner/ClientDrawer';

function Spark({ data, color = '#fb923c' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 70},${18 - ((v - min) / Math.max(0.001, max - min)) * 16}`).join(' ');
  return (
    <svg width={72} height={20} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export default function BillingUsage() {
  const nav = useNavigate();
  const rows = useMemo(() => usage(), []);
  const [sel, setSel] = useState<UsageRow | null>(null);
  const [client, setClient] = useState<UsageRow | null>(null);
  const events = rows.reduce((s, r) => s + r.eventsM, 0);
  const top = rows.slice().sort((a, b) => b.eventsM - a.eventsM);
  const top5 = top.slice(0, 5);
  const months = monthLabels(12);
  const warnings = rows.filter((r) => (r.limit !== null && r.integrations / r.limit >= 0.9) || r.overageUsd > 0);

  return (
    <>
      <p className="page-intro">
        Metered usage for every client this billing month, as HexaShield bills it to you: integrations against entitlement, events ingested, copilot tokens, managed services and seats. Overage is billed monthly in arrears; nothing is capped silently.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Clients metered', value: rows.length, to: '/partner/clients', source: 'HexaShield metering service' },
          { label: 'Integrations live', value: rows.reduce((s, r) => s + r.integrations, 0), onClick: () => setSel(top[0]), source: 'HexaCore integration fabric · entitlement service' },
          { label: 'Events this month', value: `${fmtNum(events / 1000, 1)}B`, onClick: () => setSel(top[0]), source: 'HexaShield metering service · data planes' },
          { label: 'Copilot tokens', value: `${fmtNum(rows.reduce((s, r) => s + r.copilotM, 0), 1)}M`, onClick: () => setSel(rows.slice().sort((a, b) => b.copilotM - a.copilotM)[0]), source: 'HexaAI usage meter' },
          { label: 'Managed services', value: rows.reduce((s, r) => s + r.services, 0), to: '/ops/services', source: 'Service catalogue · subscriptions' },
          { label: 'Overage (month)', value: money(rows.reduce((s, r) => s + r.overageUsd, 0)), hint: `${rows.filter((r) => r.overageUsd > 0).length} clients`, onClick: () => setSel(warnings[0] ?? null), source: 'HexaShield billing · overage' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Events ingested per month" sub="Millions of normalised events, top five clients and the rest" toneColor={PT_TONE}>
          <Chart
            height={250}
            option={{
              grid: { left: 50, right: 10, top: 28, bottom: 22 },
              legend: { top: 0, itemWidth: 10, itemHeight: 8, type: 'scroll' },
              tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmtNum(Number(v))}M` },
              xAxis: { type: 'category', data: months },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${fmtNum(v / 1000, 1)}B` } },
              series: [
                ...top5.map((r, i) => ({ name: r.client.short, type: 'bar' as const, stack: 'e', data: r.series.map((v) => Math.round(v)), itemStyle: { color: PALETTE[i] } })),
                { name: 'Others', type: 'bar' as const, stack: 'e', data: months.map((_, mi) => Math.round(top.slice(5).reduce((s, r) => s + r.series[mi], 0))), itemStyle: { color: '#8a9bc0', borderRadius: [3, 3, 0, 0] } },
              ],
            }}
          />
        </Card>
        <Card title="Entitlement watch" count={warnings.length} sub="Near or over the cap: upsell before it bills as overage">
          <div className="list">
            {warnings.map((r) => (
              <button key={r.client.id} className="list-row" onClick={() => setSel(r)}>
                <ClientAvatar c={r.client} size={26} />
                <span className="list-main">
                  <b>{r.client.short}</b>
                  <span>{r.limit !== null ? `${r.integrations} of ${r.limit} integrations` : 'Unlimited integrations'}{r.overageUsd ? ` · ${money(r.overageUsd)} overage` : ''}</span>
                </span>
                <AlertTriangle size={14} color={r.overageUsd ? 'var(--bad)' : 'var(--sev-medium)'} />
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><Btn sm primary color={PT_TONE} onClick={() => nav('/partner-sales/quotes')}>Quote an upgrade</Btn></div>
        </Card>
      </div>

      <Card title="Usage by client" count={rows.length} sub="This billing month · click a row for the meter breakdown" flush>
        <DataTable
          rows={rows}
          rowKey={(r) => r.client.id}
          onRowClick={setSel}
          initialSort={{ key: 'ev', dir: 'desc' }}
          search={(r) => `${r.client.name} ${r.client.tier}`}
          searchPlaceholder="Filter clients…"
          pageSize={20}
          columns={[
            { key: 'c', header: 'Client', sort: (r) => r.client.name, render: (r) => <div className="row" style={{ gap: 8 }}><ClientAvatar c={r.client} size={24} /><div><div className="t-main">{r.client.short}</div><div className="t-sub">{r.client.tier}</div></div></div> },
            { key: 'int', header: 'Integrations', sort: (r) => r.integrations, render: (r) => <div style={{ width: 110 }}>{r.limit !== null ? <Bar value={r.integrations} max={r.limit} size="thin" color={r.integrations >= r.limit ? 'var(--bad)' : PT_TONE} /> : <Bar value={1} max={1} size="thin" color="var(--good)" />}<span className="t-sub">{r.integrations}{r.limit !== null ? ` / ${r.limit}` : ' · unlimited'}</span></div> },
            { key: 'ev', header: 'Events / mo', align: 'right', sort: (r) => r.eventsM, render: (r) => <span className="num">{fmtNum(r.eventsM, r.eventsM < 100 ? 1 : 0)}M</span> },
            { key: 'trend', header: '12 months', render: (r) => <Spark data={r.series} /> },
            { key: 'cp', header: 'Copilot tokens', align: 'right', sort: (r) => r.copilotM, render: (r) => (r.copilotM ? `${fmtNum(r.copilotM, 1)}M` : <span className="muted">not entitled</span>) },
            { key: 'svc', header: 'Services', align: 'right', sort: (r) => r.services, render: (r) => r.services },
            { key: 'seats', header: 'Seats', align: 'right', sort: (r) => r.seats, render: (r) => r.seats },
            { key: 'tb', header: 'Storage', align: 'right', sort: (r) => r.storageTb, render: (r) => `${fmtNum(r.storageTb, 1)} TB` },
            { key: 'ov', header: 'Overage', align: 'right', sort: (r) => r.overageUsd, render: (r) => (r.overageUsd ? <Badge color="var(--bad)">{money(r.overageUsd)}</Badge> : <span className="muted">—</span>) },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          title={`${sel.client.name} · usage`}
          sub={`${sel.client.tier} · billing month to date`}
          icon={<ClientAvatar c={sel.client} size={34} />}
          onClose={() => setSel(null)}
          footer={<><Btn primary color={PT_TONE} onClick={() => { setClient(sel); setSel(null); }}>Client details</Btn><Btn onClick={() => nav('/partner-billing/invoices')}>Invoices</Btn></>}
        >
          {sel.overageUsd > 0 && <div style={{ marginBottom: 12 }}><Callout kind="warn">{money(sel.overageUsd)} overage this month. Moving to the next tier would cost less within {sel.limit === 5 ? 'four' : 'six'} months.</Callout></div>}
          <Chart
            height={140}
            option={{
              grid: { left: 40, right: 6, top: 10, bottom: 20 },
              tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmtNum(Number(v))}M events` },
              xAxis: { type: 'category', data: months },
              yAxis: { type: 'value' },
              series: [{ type: 'line', data: sel.series, symbol: 'none', smooth: true, lineStyle: { color: '#fb923c', width: 2 }, areaStyle: { color: 'rgba(251,146,60,.15)' } }],
            }}
          />
          <KV
            rows={[
              ['Integrations', `${sel.integrations}${sel.limit !== null ? ` of ${sel.limit} entitled` : ' (unlimited)'}`],
              ['Events ingested', `${fmtNum(sel.eventsM, 1)}M this month`],
              ['Copilot tokens', sel.copilotM ? `${fmtNum(sel.copilotM, 1)}M` : 'Not in tier'],
              ['Seats', sel.seats],
              ['Hot storage', `${fmtNum(sel.storageTb, 1)} TB (90-day hot, 1-year warm)`],
              ['Data plane', sel.client.deployment],
            ]}
          />
          <SectionLabel>Managed services metered</SectionLabel>
          <div className="chips">{sel.client.services.map((s) => <Badge key={s} color={PT_TONE}>{SERVICE_BY_ID[s].name}</Badge>)}</div>
        </Drawer>
      )}
      {client && <ClientDrawer c={client.client} onClose={() => setClient(null)} />}
    </>
  );
}
