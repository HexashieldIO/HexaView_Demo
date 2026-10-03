import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, BellRing, MessageSquareWarning } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, BarRow, Btn, Callout, KV, SectionLabel, StatusBadge } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { PARTNER, clientBook, invoices, type Invoice } from '../../data/modules/partner';
import { daysAhead, fmtDate, monthLabels } from '../../lib/format';
import { ClientAvatar, PT_TONE, Seg, money, moneyFull } from '../partner/parts';

const INV_COLOR: Record<Invoice['status'], string> = { Paid: 'var(--good)', Due: 'var(--m-matrix)', Overdue: 'var(--bad)', Draft: 'var(--sev-info)', Disputed: 'var(--sev-high)' };
type Dir = 'all' | 'receivable' | 'payable';

export default function BillingInvoices() {
  const [params, setParams] = useSearchParams();
  const { toast } = useApp();
  const book = useMemo(() => clientBook(), []);
  const all = useMemo(() => invoices(), []);
  const [dir, setDir] = useState<Dir>('all');
  const [sel, setSel] = useState<Invoice | null>(null);
  const statusF = params.get('status');
  const setStatus = (s: string | null) => {
    const p = new URLSearchParams(params);
    if (s) p.set('status', s);
    else p.delete('status');
    setParams(p, { replace: true });
  };
  const rows = all.filter((i) => (dir === 'all' || i.direction === dir) && (!statusF || (statusF === 'overdue' ? i.status === 'Overdue' || i.status === 'Disputed' : i.status.toLowerCase() === statusF)));
  const rec = all.filter((i) => i.direction === 'receivable');
  const pay = all.filter((i) => i.direction === 'payable');
  const recMonth = rec.reduce((s, i) => s + i.amountUsd, 0);
  const payDue = pay.find((i) => i.status === 'Due');
  const overdue = rec.filter((i) => i.status === 'Overdue' || i.status === 'Disputed');

  const aging = [
    { label: 'Current', v: rec.filter((i) => i.status === 'Due' || i.status === 'Draft').reduce((s, i) => s + i.amountUsd, 0), c: 'var(--good)' },
    { label: '1–15 days', v: rec.filter((i) => i.status === 'Overdue' && i.dueDays >= -15).reduce((s, i) => s + i.amountUsd, 0), c: 'var(--sev-medium)' },
    { label: '16–30 days', v: rec.filter((i) => i.status === 'Overdue' && i.dueDays < -15).reduce((s, i) => s + i.amountUsd, 0), c: 'var(--sev-high)' },
    { label: 'Disputed', v: rec.filter((i) => i.status === 'Disputed').reduce((s, i) => s + i.amountUsd, 0), c: 'var(--bad)' },
  ];
  const months = monthLabels(12);
  const recSeries = months.map((_, i) => Math.round((recMonth * (0.74 + i * 0.024)) / 1000));
  const paySeries = recSeries.map((v) => Math.round(v * ((pay[0]?.amountUsd ?? 0) / recMonth)));

  return (
    <>
      <p className="page-intro">
        Two sides of the ledger: what HexaShield bills {PARTNER.short} wholesale each month, and what you bill your clients through HexaView billing. Client invoices go out under your brand from the invoice template.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Billed to clients (Oct)', value: money(recMonth), onClick: () => { setDir('receivable'); setStatus(null); }, source: 'HexaView billing · receivables' },
          { label: 'Due to HexaShield', value: money(payDue?.amountUsd ?? 0), hint: `in ${payDue?.dueDays ?? 0} d`, onClick: () => payDue && setSel(payDue), source: 'HexaShield billing · payables' },
          { label: 'Gross margin (Oct)', value: money(recMonth - (payDue?.amountUsd ?? 0)), unit: `${Math.round(((recMonth - (payDue?.amountUsd ?? 0)) / recMonth) * 100)}%`, to: '/partner-billing/commissions', source: 'Receivables − payables' },
          { label: 'Overdue & disputed', value: money(overdue.reduce((s, i) => s + i.amountUsd, 0)), hint: `${overdue.length} invoices`, onClick: () => { setDir('receivable'); setStatus('overdue'); }, source: 'HexaView billing · ageing' },
          { label: 'Days sales outstanding', value: 34, unit: 'days', delta: { text: '+3 d', good: false }, source: 'HexaView billing · 90-day DSO' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Billed vs. owed" sub="Monthly receivables from clients and payables to HexaShield (US$k)" toneColor={PT_TONE}>
          <Chart
            height={230}
            option={{
              grid: { left: 46, right: 8, top: 26, bottom: 22 },
              legend: { top: 0, itemWidth: 10, itemHeight: 8 },
              tooltip: { trigger: 'axis', valueFormatter: (v) => `US$${Number(v)}k` },
              xAxis: { type: 'category', data: months },
              yAxis: { type: 'value' },
              series: [
                { name: 'Billed to clients', type: 'bar', data: recSeries, itemStyle: { color: '#fb923c', borderRadius: [3, 3, 0, 0] } },
                { name: 'Owed to HexaShield', type: 'bar', data: paySeries, itemStyle: { color: '#8a9bc0', borderRadius: [3, 3, 0, 0] } },
                { name: 'Margin', type: 'line', data: recSeries.map((v, i) => v - paySeries[i]), symbol: 'none', lineStyle: { color: '#2dd4bf', width: 2 } },
              ],
            }}
          />
        </Card>
        <Card title="Receivables ageing" sub="Client invoices by age · click to filter">
          {aging.map((a) => (
            <button key={a.label} style={{ display: 'block', width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={() => { setDir('receivable'); setStatus(a.label === 'Current' ? 'due' : 'overdue'); }}>
              <BarRow label={a.label} value={a.v} max={recMonth} color={a.c} display={money(a.v)} />
            </button>
          ))}
          {overdue.length > 0 && <div style={{ marginTop: 10 }}><Callout kind="warn">{overdue.map((i) => i.counterparty.split(' ')[0]).join(', ')}: chase before month end. Greyfriars is disputing pending the P1 SLA review.</Callout></div>}
        </Card>
      </div>

      <Card
        title="Invoices"
        count={rows.length}
        flush
        actions={
          <div className="row" style={{ gap: 8 }}>
            {statusF && <Badge color={PT_TONE}>{statusF} <button className="link" onClick={() => setStatus(null)}>clear</button></Badge>}
            <Seg options={[{ id: 'all', label: 'All' }, { id: 'receivable', label: 'From clients' }, { id: 'payable', label: 'To HexaShield' }]} value={dir} onChange={setDir} />
          </div>
        }
      >
        <DataTable
          rows={rows}
          rowKey={(i) => i.id}
          onRowClick={setSel}
          pageSize={20}
          search={(i) => `${i.id} ${i.counterparty} ${i.status}`}
          searchPlaceholder="Filter invoices…"
          columns={[
            { key: 'id', header: 'Invoice', sort: (i) => i.id, render: (i) => <><div className="mono t-main" style={{ fontSize: 11.5 }}>{i.id}</div><div className="t-sub">{i.period}</div></> },
            { key: 'cp', header: 'Counterparty', sort: (i) => i.counterparty, render: (i) => { const c = book.find((x) => x.id === i.clientId); return <div className="row" style={{ gap: 8 }}>{c ? <ClientAvatar c={c} size={22} /> : <ClientAvatar c={{ initials: 'HX', colour: '#2563eb' }} size={22} />}<span className="t-main">{i.counterparty}</span></div>; } },
            { key: 'dir', header: 'Direction', sort: (i) => i.direction, render: (i) => <Badge color={i.direction === 'receivable' ? PT_TONE : 'var(--sev-info)'}>{i.direction === 'receivable' ? 'Receivable' : 'Payable'}</Badge> },
            { key: 'amt', header: 'Amount', align: 'right', sort: (i) => i.amountUsd, render: (i) => <span className="num">{moneyFull(i.amountUsd)}</span> },
            { key: 'due', header: 'Due', sort: (i) => i.dueDays, render: (i) => <span className="t-sub" style={{ color: i.status === 'Overdue' ? 'var(--bad)' : undefined }}>{i.status === 'Paid' ? 'Paid' : i.dueDays < 0 ? `${-i.dueDays} d overdue` : fmtDate(daysAhead(i.dueDays))}</span> },
            { key: 'st', header: 'Status', sort: (i) => i.status, render: (i) => <StatusBadge value={i.status} map={INV_COLOR} /> },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          title={`${sel.id} · ${sel.counterparty}`}
          sub={`${sel.direction === 'receivable' ? 'Receivable' : 'Payable to HexaShield'} · ${sel.period}`}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn primary color={PT_TONE} onClick={() => toast(`${sel.id}.pdf downloaded`)}><Download /> PDF</Btn>
              {sel.direction === 'receivable' && (sel.status === 'Overdue' || sel.status === 'Due') && <Btn onClick={() => toast(`Reminder for ${sel.id} sent to ${sel.counterparty} accounts payable under your brand`)}><BellRing /> Send reminder</Btn>}
              {sel.direction === 'payable' && <Btn onClick={() => toast(`Query on ${sel.id} raised with HexaShield billing (ticket created)`)}><MessageSquareWarning /> Query</Btn>}
            </>
          }
        >
          <KV rows={[['Status', <StatusBadge value={sel.status} map={INV_COLOR} />], ['Amount', moneyFull(sel.amountUsd)], ['Due', sel.status === 'Paid' ? 'Paid' : sel.dueDays < 0 ? `${-sel.dueDays} days overdue` : fmtDate(daysAhead(sel.dueDays))], ['Terms', 'Net 30 · USD'], ['Billing source', sel.direction === 'receivable' ? 'HexaView billing (white-labelled)' : 'HexaShield partner billing']]} />
          <SectionLabel>Lines</SectionLabel>
          <table className="tbl">
            <tbody>
              {sel.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td className="r num">{moneyFull(l.amount)}</td></tr>)}
              <tr><td><b>Total</b></td><td className="r num"><b>{moneyFull(sel.lines.reduce((s, l) => s + l.amount, 0))}</b></td></tr>
            </tbody>
          </table>
          {sel.status === 'Disputed' && <div style={{ marginTop: 12 }}><Callout kind="warn">Disputed by the client pending the joint RCA on the August P1 (ticket PS-7766).</Callout></div>}
        </Drawer>
      )}
    </>
  );
}
