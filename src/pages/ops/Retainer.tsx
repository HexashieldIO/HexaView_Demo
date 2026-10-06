import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wallet, Download, ArrowUpCircle, AlertTriangle, Check, Undo2, Send, ExternalLink } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Btn, Callout, Badge, KpiStrip, Ring, KV } from '../../components/ui';
import { Modal } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { Chart } from '../../components/Chart';
import { DatePicker } from '../../components/DatePicker';
import { fmtMoney, fmtDate } from '../../lib/format';
import { useAiptStore, type AiptStoreApi } from '../strike/aipentest/store';
import {
  RETAINER_TIERS, retainerTotals, ledgerStatus, burnDown, spendByCategory, irHours, categoryOf, tierFor, usdToCustomer,
  type Retainer, type LedgerEntry, type LedgerStatus,
} from '../../data/modules/aiptRetainer';
import { servicesFor, SERVICE_CATEGORIES, CATEGORY_COLOR, IR_HOUR_USD, IR_SLA, RATE_NOTE, unitLabel } from '../../data/modules/retainer';
import { TierPicker, BuyRetainerModal, withLocal } from './RetainerBuy';
import { Switch, OPS_TONE } from './parts';

const usd = (n: number) => fmtMoney(n, 'USD', false);
const STATUS_COLOR: Record<LedgerStatus, string> = { Committed: 'var(--sev-medium)', Drawn: 'var(--good)', Released: 'var(--text-muted)' };
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export { SourceBadge } from '../strike/aipentest/PayMethod';

export function RetainerTab() {
  const { customer: c } = useApp();
  const store = useAiptStore(c);
  const [buying, setBuying] = useState<(typeof RETAINER_TIERS)[number] | null>(null);
  return (
    <div className="stack" style={{ gap: 14, marginTop: 14 }}>
      {store.retainer ? <ActiveRetainer store={store} r={store.retainer} /> : <TierPicker onBuy={setBuying} />}
      {buying && <BuyRetainerModal tier={buying} store={store} onClose={() => setBuying(null)} />}
    </div>
  );
}

function ActiveRetainer({ store, r }: { store: AiptStoreApi; r: Retainer }) {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const engs = store.engagements;
  const t = retainerTotals(r, engs);
  const bd = useMemo(() => burnDown(r, engs), [r, engs]);
  const cats = spendByCategory(r);
  const ir = irHours(r, t.available);
  const [topUp, setTopUp] = useState(false);
  const low = t.pctLeft <= 20;
  const set = (p: Partial<Retainer>) => store.setRetainer({ ...r, ...p });

  // Ledger rows with a running balance (oldest first for the balance, newest first to show).
  const rows = useMemo(() => {
    let bal = r.tierUsd + r.bonusUsd;
    const tops = [...r.topUps].sort((a, b) => a.at - b.at);
    let ti = 0;
    const out: { l: LedgerEntry; status: LedgerStatus; balance: number }[] = [];
    for (const l of [...r.ledger].sort((a, b) => a.at - b.at)) {
      while (ti < tops.length && tops[ti].at <= l.at) bal += tops[ti++].usd;
      const st = ledgerStatus(l, engs);
      if (st !== 'Released') bal -= l.usd;
      out.push({ l, status: st, balance: bal });
    }
    return out.reverse();
  }, [r, engs]);

  const units = new Map(servicesFor(c).map((s) => [s.id, s.unit]));
  const qtyText = (l: LedgerEntry) => {
    const u = units.get(l.serviceId ?? '');
    if (!l.qty || (u !== 'hour' && u !== 'day' && !(u === 'engagement' && l.qty > 1))) return '';
    return ` · ${l.qty} ${u === 'hour' ? 'h' : unitLabel(u, l.qty)}`;
  };
  const updateEntry = (id: string, p: Partial<LedgerEntry>) => set({ ledger: r.ledger.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  const release = (l: LedgerEntry) => {
    updateEntry(l.id, { status: 'Released' });
    const e = engs.find((x) => x.id === l.engId);
    if (e && (l.serviceId ?? 'ai-pt') === 'ai-pt') store.patchEngagement(e.id, { paid: false, paidVia: undefined });
    toast(`${usd(l.usd)} released back to the retainer${e ? ` — ${e.id} cancelled` : ''}`);
  };

  return (
    <>
      {low && <Callout kind="warn"><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> <b>Low balance:</b> {Math.round(t.pctLeft)}% of the retainer left ({usd(t.available)}). Top up to keep services drawing down. <Btn sm color={OPS_TONE} onClick={() => setTopUp(true)}>Top up</Btn></Callout>}

      <div className="grid g-1-2">
        <Card title={<><Wallet size={14} /> {usd(r.tierUsd)} retainer</>} sub={`${fmtDate(new Date(`${r.startDate}T00:00:00`))} – ${fmtDate(t.renewal)} · ${r.methodLabel}`} toneColor={OPS_TONE} tinted>
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <Ring value={t.pctLeft} size={104} stroke={10} color={low ? 'var(--sev-medium)' : OPS_TONE} label={`${Math.round(t.pctLeft)}%`} sub="left" />
            <div className="stack" style={{ gap: 4, fontSize: 12.5 }}>
              <b style={{ fontSize: 20 }}>{usd(t.available)}</b>
              <span className="muted">available of {usd(t.total)}{c.currency !== 'USD' ? ` · ${withLocal(t.available, c.currency).split('·')[1]}` : ''}</span>
              <span>IR hours remaining ≈ <b>{ir.affordable}</b> at {usd(IR_HOUR_USD)}/h</span>
              {ir.reserved > 0 && <span>{ir.reserved} IR hours reserved · <b>{ir.reservedLeft}</b> left</span>}
              <span className="muted" style={{ fontSize: 11 }}>{IR_SLA}</span>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
            <Btn sm primary color={OPS_TONE} onClick={() => setTopUp(true)}><ArrowUpCircle size={13} /> Top up</Btn>
            <Btn sm onClick={() => setTimeout(() => window.print(), 60)}><Download size={13} /> Statement</Btn>
            <span className="row" style={{ gap: 6, fontSize: 12 }}><Switch on={r.autoRenew} onChange={(v) => { set({ autoRenew: v }); toast(`Auto-renew ${v ? 'on' : 'off'}`); }} /> Auto-renew</span>
          </div>
        </Card>
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <KpiStrip
            toneColor={OPS_TONE}
            items={[
              { label: 'Drawn to date', value: usd(t.drawn), unit: 'delivered', source: 'Retainer ledger' },
              { label: 'Committed', value: usd(t.committed), unit: 'booked, not delivered', toneColor: 'var(--sev-medium)', source: 'Retainer ledger' },
              { label: 'Available', value: usd(t.available), unit: `${Math.round(t.pctLeft)}% of ${usd(t.total)}`, toneColor: low ? 'var(--sev-medium)' : 'var(--good)', source: 'Retainer balance' },
              { label: 'Days to renewal', value: t.daysToRenewal, unit: r.autoRenew ? 'auto-renews' : 'manual renewal', source: 'Retainer term' },
            ]}
          />
          <Card title="Burn-down" sub={bd.runOut ? `At the current run rate (${usd(Math.round(bd.perDay * 30))}/month) the balance runs out around ${fmtDate(bd.runOut)}` : 'No draw-downs yet'}>
            <Chart height={190} option={{
              grid: { left: 8, right: 14, top: 26, bottom: 6, containLabel: true },
              legend: { top: 0, data: ['Balance', 'Forecast'] },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: bd.labels },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `$${Math.round(v / 1000)}k` } },
              series: [
                { name: 'Balance', type: 'line', data: bd.actual, itemStyle: { color: '#4f8cff' }, areaStyle: { opacity: 0.12 }, connectNulls: false },
                { name: 'Forecast', type: 'line', data: bd.forecast, itemStyle: { color: '#f5a83d' }, lineStyle: { type: 'dashed' }, connectNulls: false },
              ],
            }} />
          </Card>
        </div>
      </div>

      <div className="grid g-1-2">
        <Card title="Spend by category" sub="Drawn and committed">
          {cats.length ? (
            <Chart height={200} option={{
              tooltip: { trigger: 'item', formatter: '{b}: ${c} ({d}%)' },
              legend: { bottom: 0, type: 'scroll' },
              series: [{ type: 'pie', radius: ['48%', '72%'], center: ['50%', '42%'], label: { show: false }, data: cats.map((x) => ({ name: x.category, value: x.usd, itemStyle: { color: CATEGORY_COLOR[x.category] } })) }],
            }} />
          ) : <div className="empty">Nothing drawn yet.</div>}
        </Card>
        <RequestService store={store} r={r} available={t.available} />
      </div>

      <div className="aipt-print">
        <Card title="Draw-down ledger" sub={`Statement · ${c.name} · ${usd(r.tierUsd)} retainer · ${fmtDate(new Date(`${r.startDate}T00:00:00`))} – ${fmtDate(t.renewal)}`} flush>
          <DataTable
            rows={rows}
            rowKey={(x) => x.l.id}
            pageSize={12}
            search={(x) => `${x.l.engId} ${x.l.label} ${categoryOf(x.l)} ${x.status}`}
            searchPlaceholder="Search the ledger…"
            columns={[
              { key: 'date', header: 'Date', sort: (x) => x.l.at, render: (x) => <span style={{ fontSize: 12 }}>{fmtDate(new Date(x.l.at))}</span> },
              { key: 'ref', header: 'Reference', render: (x) => <span className="mono" style={{ fontSize: 11.5 }}>{x.l.engId}</span> },
              { key: 'svc', header: 'Service', render: (x) => (<><span className="aipt-catchip" style={{ ['--cc' as string]: CATEGORY_COLOR[categoryOf(x.l)] }}>{categoryOf(x.l)}</span><div className="t-main">{x.l.label}{qtyText(x.l)}</div>{x.l.note && <div className="t-sub">{x.l.note}</div>}</>) },
              { key: 'amt', header: 'Amount', align: 'right', sort: (x) => x.l.usd, render: (x) => <span style={x.status === 'Released' ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{usd(x.l.usd)}</span> },
              { key: 'bal', header: 'Balance', align: 'right', render: (x) => usd(x.balance) },
              { key: 'st', header: 'Status', render: (x) => <Badge color={STATUS_COLOR[x.status]} dot>{x.status}</Badge> },
              { key: 'act', header: '', render: (x) => x.status === 'Committed' ? (
                <span className="row" style={{ gap: 4 }}>
                  {(x.l.serviceId ?? 'ai-pt') !== 'ai-pt' && <Btn sm color={OPS_TONE} onClick={() => { updateEntry(x.l.id, { status: 'Drawn' }); toast(`${x.l.label} marked delivered — ${usd(x.l.usd)} drawn`); }}><Check size={12} /> Delivered</Btn>}
                  <Btn sm ghost onClick={() => release(x.l)} title="Cancel and return the funds"><Undo2 size={12} /> Release</Btn>
                </span>
              ) : null },
            ]}
          />
        </Card>
      </div>

      {topUp && <TopUpModal store={store} r={r} onClose={() => setTopUp(false)} />}
      <div className="muted" style={{ fontSize: 11 }}>Rates and perks are {RATE_NOTE}. Retainer amounts are in USD. <button type="button" className="aipt-linkbtn" onClick={() => nav('/ops/services')}>Service catalogue →</button></div>
    </>
  );
}

/** "Use retainer": request a catalogue service, see the cost and balance after, submit as Committed. */
function RequestService({ store, r, available }: { store: AiptStoreApi; r: Retainer; available: number }) {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const services = servicesFor(c);
  const pre = services.find((s) => s.id === sp.get('service'));
  const [id, setId] = useState(pre?.id ?? 'ir-hours');
  const svc = services.find((s) => s.id === id) ?? services[0];
  const [qty, setQty] = useState(pre?.typicalQty ?? 4);
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState(sp.get('ref') ? `For ${sp.get('ref')}` : '');
  const fixed = svc.unit === 'fixed fee';
  const q = fixed ? 1 : Math.max(1, qty);
  const cost = svc.usd * q;
  const after = available - cost;

  const submit = () => {
    const ref = sp.get('ref') ?? `SR-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    store.setRetainer({ ...r, ledger: [...r.ledger, { id: `RL-${svc.id}-${Date.now().toString(36)}`, at: Date.now(), engId: ref, label: svc.name, usd: cost, serviceId: svc.id, category: svc.category, qty: q, date, note: notes.trim() || undefined, status: 'Committed' }] });
    toast(`${svc.name}${fixed ? '' : ` × ${q} ${unitLabel(svc.unit, q)}`} requested — ${usd(cost)} committed from the retainer`);
    setNotes('');
  };

  return (
    <Card title={<><Send size={14} /> Use retainer · request a service</>} sub="Pick a HexaShield service; it is committed now and drawn when delivered">
      <div className="aipt-form">
        <div className="aipt-qgrid">
          <label className="aipt-field"><span>Service</span>
            <select className="select" value={svc.id} onChange={(e) => { const s = services.find((x) => x.id === e.target.value)!; setId(s.id); setQty(s.typicalQty); }}>
              {SERVICE_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>{services.filter((s) => s.category === cat).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
              ))}
            </select>
          </label>
          {!fixed && <label className="aipt-field"><span>Quantity ({unitLabel(svc.unit, 2)})</span><input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))} /></label>}
          <label className="aipt-field"><span>Date</span><DatePicker value={date} min={todayIso()} onChange={(v) => setDate(v || todayIso())} clearable={false} ariaLabel="Service date" /></label>
        </div>
        <label className="aipt-field"><span>Notes</span><input className="input" value={notes} placeholder="Scope, incident or context" onChange={(e) => setNotes(e.target.value)} /></label>
        <KV rows={[
          ['Rate', `${usd(svc.usd)} per ${svc.unit === 'fixed fee' ? 'engagement (fixed fee)' : svc.unit} · ${RATE_NOTE}`],
          ['Typical size', svc.typical],
          ['Cost', <b>{usd(cost)}</b>],
          ['Balance after', <b style={{ color: after < 0 ? 'var(--bad)' : undefined }}>{usd(after)}</b>],
          ...(svc.note ? [['SLA', svc.note] as [string, string]] : []),
        ]} />
        {after < 0 && <Callout kind="warn">This exceeds the available balance by {usd(-after)}. Top up the retainer, or reduce the quantity.</Callout>}
        <div className="row wrap" style={{ gap: 8 }}>
          <Btn primary color={OPS_TONE} disabled={after < 0} onClick={submit}><Send size={13} /> Submit request</Btn>
          <Btn ghost onClick={() => nav(svc.link)}><ExternalLink size={13} /> Where it is delivered</Btn>
        </div>
      </div>
    </Card>
  );
}

function TopUpModal({ store, r, onClose }: { store: AiptStoreApi; r: Retainer; onClose: () => void }) {
  const { customer: c, toast } = useApp();
  const next = RETAINER_TIERS.find((t) => t.usd > r.tierUsd);
  const [amount, setAmount] = useState(next ? next.usd - r.tierUsd : 10_000);
  const card = store.state.cards.find((x) => x.default) ?? store.state.cards[0];
  const confirm = () => {
    const upgrade = next && amount === next.usd - r.tierUsd;
    const tier = upgrade ? tierFor(next!.usd) : null;
    store.setRetainer(upgrade && tier
      ? { ...r, tierUsd: tier.usd, bonusUsd: Math.round((tier.usd * tier.bonusPct) / 100), irReservedHours: Math.max(r.irReservedHours ?? 0, tier.usd >= 50_000 ? (tier.usd >= 100_000 ? 40 : 20) : 0) }
      : { ...r, topUps: [...r.topUps, { usd: amount, at: Date.now() }] });
    store.payFor({ engagementId: 'RETAINER', engagementName: upgrade ? `Retainer upgrade to ${usd(next!.usd)}` : `Retainer top-up ${usd(amount)}`, amountGbp: Math.round(amount * 0.79), amount: usdToCustomer(amount, c.currency), amountUsd: amount, currency: c.currency, method: card ? `${card.brand} •••• ${card.last4}` : 'Invoice · bank transfer', kind: 'Retainer' });
    toast(upgrade ? `Upgraded to the ${usd(next!.usd)} tier (+${usd(amount)})` : `Topped up ${usd(amount)}`);
    onClose();
  };
  return (
    <Modal title="Top up the retainer" sub={`Current tier ${usd(r.tierUsd)} · Stripe TEST MODE`} onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={OPS_TONE} onClick={confirm}>Pay {usd(amount)}</Btn></>}>
      <div className="aipt-paymodes">
        {[5_000, 10_000, 25_000].map((n) => (
          <label key={n} className={`aipt-paymode ${amount === n && !(next && n === next.usd - r.tierUsd) ? 'on' : ''}`}><input type="radio" checked={amount === n} onChange={() => setAmount(n)} /><ArrowUpCircle size={15} /><span><b>Top up {usd(n)}</b><em>{withLocal(n, c.currency)}</em></span></label>
        ))}
        {next && (
          <label className={`aipt-paymode ${amount === next.usd - r.tierUsd ? 'on' : ''}`}><input type="radio" checked={amount === next.usd - r.tierUsd} onChange={() => setAmount(next.usd - r.tierUsd)} /><Wallet size={15} /><span><b>Upgrade to {usd(next.usd)} tier</b><em>Pay the {usd(next.usd - r.tierUsd)} difference · {next.perks.slice(-1)[0]}</em></span></label>
        )}
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Charged to {card ? `${card.brand} •••• ${card.last4}` : 'invoice'} · {RATE_NOTE}</div>
    </Modal>
  );
}
