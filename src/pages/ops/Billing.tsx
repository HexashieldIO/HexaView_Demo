import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Plus, Trash2, Receipt, Coins, ShieldCheck } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Btn, Callout, Badge, KV, KpiStrip } from '../../components/ui';
import { Modal } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtNum, fmtMoney, fmtDate } from '../../lib/format';
import { useAiptStore } from '../strike/aipentest/store';
import { priceInCustomer } from '../../data/modules/aipentest';
import { OPS_TONE } from './parts';
import '../strike/aipentest/aipt.css';

const BRANDS = ['Visa', 'Mastercard', 'Amex'];

/** Mock payment centre for HexaStrike AI engine engagements — a Stripe
 * integration shown in TEST MODE. No real card data is ever stored or sent:
 * only a masked placeholder built from the last 4 digits is kept, in memory. */
export function BillingSection() {
  const { customer: c, toast } = useApp();
  const store = useAiptStore(c);
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  const engagements = store.engagements;
  const payEngId = sp.get('pay');
  const payEng = payEngId ? engagements.find((e) => e.id === payEngId) : null;
  const back = sp.get('back');

  const paidTotalGbp = engagements.filter((e) => e.paid).reduce((s, e) => s + e.priceGbp, 0);
  const outstanding = engagements.filter((e) => !e.paid);

  const clearPay = () => { const n = new URLSearchParams(sp); n.delete('pay'); n.delete('back'); setSp(n, { replace: true }); };

  const doPay = (engId: string) => {
    const eng = engagements.find((e) => e.id === engId);
    if (!eng) return;
    const card = store.state.cards.find((x) => x.default) ?? store.state.cards[0];
    const method = card ? `${card.brand} •••• ${card.last4}` : 'Card on file';
    store.payFor({ engagementId: eng.id, engagementName: eng.name, amountGbp: eng.priceGbp, amount: priceInCustomer(eng.priceGbp, c.currency), currency: c.currency, method, kind: 'Engagement' });
    store.patchEngagement(eng.id, { paid: true });
    toast(`Paid ${fmtMoney(priceInCustomer(eng.priceGbp, c.currency), c.currency)} for ${eng.id} (Stripe test mode) · booked`);
    if (back) { clearPay(); nav(decodeURIComponent(back)); }
    else clearPay();
  };

  return (
    <div id="ops-billing" style={{ scrollMarginTop: 80 }}>
      <Card
        title={<><CreditCard size={15} /> Billing &amp; payments</>}
        sub="Mock payment centre for HexaStrike AI engine engagements"
        toneColor={OPS_TONE}
        actions={<Badge color="var(--sev-medium)" solid>Stripe · TEST MODE</Badge>}
      >
        <Callout kind="warn"><b>Demo — test mode.</b> No real card data is stored or sent. Payments are simulated and only a masked placeholder (last 4 digits) is kept in this browser session.</Callout>

        <KpiStrip
          toneColor={OPS_TONE}
          items={[
            { label: 'Spend to date', value: fmtMoney(paidTotalGbp, 'GBP'), unit: `${engagements.filter((e) => e.paid).length} paid`, source: 'HexaStrike AI engine billing (test mode)' },
            { label: 'Outstanding', value: outstanding.length, unit: outstanding.length ? fmtMoney(outstanding.reduce((s, e) => s + e.priceGbp, 0), 'GBP') : 'none', toneColor: outstanding.length ? 'var(--sev-medium)' : undefined, source: 'Unpaid engagements' },
            { label: 'Engagement credits', value: store.state.credits, unit: 'available', toneColor: OPS_TONE, source: 'Pre-purchased engagement credits' },
            { label: 'Saved cards', value: store.state.cards.length, unit: 'masked', source: 'Payment methods (test mode)' },
          ]}
        />

        {payEng && (
          <div style={{ marginTop: 14 }}>
            <Card title="Pay for engagement" sub={`${payEng.id} · ${payEng.type}`} toneColor={OPS_TONE} tinted>
              <KV rows={[
                ['Engagement', payEng.name],
                ['Amount', <span title={`£${fmtNum(payEng.priceGbp)} list`}>{fmtMoney(priceInCustomer(payEng.priceGbp, c.currency), c.currency)} <span className="muted">(£{fmtNum(payEng.priceGbp)} list)</span></span>],
                ['Pay with', (store.state.cards.find((x) => x.default) ?? store.state.cards[0]) ? `${(store.state.cards.find((x) => x.default) ?? store.state.cards[0]).brand} •••• ${(store.state.cards.find((x) => x.default) ?? store.state.cards[0]).last4}` : 'No card on file'],
                ['Status', payEng.paid ? <Badge color="var(--good)" dot>Paid</Badge> : <Badge color="var(--sev-medium)" dot>Outstanding</Badge>],
              ]} />
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                {payEng.paid ? (
                  <Btn primary color={OPS_TONE} onClick={() => { if (back) { clearPay(); nav(decodeURIComponent(back)); } else clearPay(); }}>Back to engagement</Btn>
                ) : (
                  <Btn primary color={OPS_TONE} disabled={!store.state.cards.length} onClick={() => doPay(payEng.id)}><CreditCard size={14} /> Pay &amp; book {fmtMoney(priceInCustomer(payEng.priceGbp, c.currency), c.currency)}</Btn>
                )}
                <Btn ghost onClick={clearPay}>Cancel</Btn>
              </div>
            </Card>
          </div>
        )}

        <div className="grid g2" style={{ marginTop: 14 }}>
          <Card title="Saved payment methods" sub="Masked placeholders only" flush
            actions={<Btn sm color={OPS_TONE} onClick={() => setAddOpen(true)}><Plus size={13} /> Add card</Btn>}>
            <div className="list">
              {store.state.cards.map((card) => (
                <div key={card.id} className="list-row">
                  <CreditCard size={16} style={{ color: OPS_TONE }} />
                  <span className="list-main">
                    <b>{card.brand} •••• {card.last4}</b>
                    <span>{card.label} · exp {card.exp}{card.default ? ' · default' : ''}</span>
                  </span>
                  {!card.default && <Btn sm ghost danger onClick={() => { store.removeCard(card.id); toast('Card removed'); }}><Trash2 size={12} /></Btn>}
                </div>
              ))}
              {store.state.cards.length === 0 && <div className="empty" style={{ padding: 16 }}>No cards. Add one to pay for engagements.</div>}
            </div>
            <div className="card-foot"><span><ShieldCheck size={11} style={{ verticalAlign: -1 }} /> Card numbers are never stored or transmitted in this demo.</span></div>
          </Card>

          <Card title="Invoices & receipts" sub="Per engagement" flush>
            <DataTable
              rows={engagements}
              rowKey={(e) => e.id}
              pageSize={8}
              columns={[
                { key: 'id', header: 'Engagement', render: (e) => (<><div className="t-main">{e.type}</div><div className="t-sub mono">{e.id}</div></>) },
                { key: 'amt', header: 'Amount', align: 'right', sort: (e) => e.priceGbp, render: (e) => fmtMoney(priceInCustomer(e.priceGbp, c.currency), c.currency) },
                { key: 'st', header: 'Status', render: (e) => e.paid ? <Badge color="var(--good)" dot>Paid</Badge> : <Badge color="var(--sev-medium)" dot>Due</Badge> },
              ]}
            />
          </Card>
        </div>

        {store.state.payments.length > 0 && (
          <Card title={<><Receipt size={14} /> Payment history</>} sub="This session" flush style={{ marginTop: 14 }}>
            <DataTable
              rows={store.state.payments}
              rowKey={(p) => p.id}
              pageSize={6}
              columns={[
                { key: 'id', header: 'Receipt', render: (p) => (<><div className="t-main">{p.engagementName}</div><div className="t-sub mono">{p.id} · {p.kind}</div></>) },
                { key: 'method', header: 'Method', render: (p) => <span style={{ fontSize: 12 }}>{p.method}</span> },
                { key: 'amt', header: 'Amount', align: 'right', sort: (p) => p.amountGbp, render: (p) => fmtMoney(p.amountGbp, 'GBP') },
                { key: 'at', header: 'Date', align: 'right', render: (p) => <span className="muted" style={{ fontSize: 11.5 }}>{fmtDate(new Date(p.at))}</span> },
              ]}
            />
          </Card>
        )}

        <div className="card-foot" style={{ marginTop: 10 }}>
          <span><Coins size={11} style={{ verticalAlign: -1 }} /> Engagement credits: {store.state.credits} available · top up from your HexaView agreement</span>
        </div>
      </Card>

      {addOpen && <AddCardModal onClose={() => setAddOpen(false)} onAdd={(brand, last4, exp, label) => { store.addCard(brand, last4, exp, label); toast(`Added ${brand} •••• ${last4.slice(-4)} (masked placeholder)`); setAddOpen(false); }} />}
    </div>
  );
}

function AddCardModal({ onClose, onAdd }: { onClose: () => void; onAdd: (brand: string, last4: string, exp: string, label: string) => void }) {
  const [brand, setBrand] = useState('Visa');
  const [last4, setLast4] = useState('');
  const [exp, setExp] = useState('');
  const [label, setLabel] = useState('Corporate card');
  const valid = /^\d{4}$/.test(last4) && /^\d{2}\/\d{2}$/.test(exp);
  return (
    <Modal
      title="Add a card"
      sub="Demo — test mode, no real card data is stored or sent"
      onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={OPS_TONE} disabled={!valid} onClick={() => onAdd(brand, last4, exp, label)}><Plus size={13} /> Add masked card</Btn></>}
    >
      <Callout kind="warn"><b>Test mode.</b> Enter only the last 4 digits — a full card number is never requested, stored or sent. We keep a masked placeholder like &ldquo;Visa •••• 4242&rdquo;.</Callout>
      <div className="aipt-form" style={{ marginTop: 10 }}>
        <div className="row wrap" style={{ gap: 12 }}>
          <label className="aipt-field"><span>Brand</span>
            <select className="select" value={brand} onChange={(e) => setBrand(e.target.value)}>{BRANDS.map((b) => <option key={b}>{b}</option>)}</select>
          </label>
          <label className="aipt-field"><span>Last 4 digits</span>
            <input className="input" inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4242" style={{ width: 90 }} />
          </label>
          <label className="aipt-field"><span>Expiry (MM/YY)</span>
            <input className="input" maxLength={5} value={exp} onChange={(e) => setExp(e.target.value.replace(/[^\d/]/g, '').slice(0, 5))} placeholder="11/27" style={{ width: 90 }} />
          </label>
        </div>
        <label className="aipt-field"><span>Label</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
