import { useState } from 'react';
import { Check, CreditCard, Landmark, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Btn, Callout, Badge } from '../../components/ui';
import { Modal } from '../../components/Overlay';
import { DatePicker } from '../../components/DatePicker';
import { fmtMoney, fmtDate } from '../../lib/format';
import { RETAINER_TIERS, IR_RESERVED_BY_TIER, typicalCoverage, usdToCustomer, type RetainerTier, type Retainer } from '../../data/modules/aiptRetainer';
import { RATE_NOTE } from '../../data/modules/retainer';
import type { AiptStoreApi } from '../strike/aipentest/store';
import { Switch, OPS_TONE } from './parts';

const usd = (n: number) => fmtMoney(n, 'USD', false);
export const withLocal = (n: number, currency: string) => (currency === 'USD' ? usd(n) : `${usd(n)} · ≈ ${fmtMoney(usdToCustomer(n, currency), currency, false)}`);
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/** Tier cards shown when there is no active retainer. */
export function TierPicker({ onBuy }: { onBuy: (t: RetainerTier) => void }) {
  const { customer: c } = useApp();
  return (
    <>
      <Callout>An annual HexaShield services retainer, paid upfront in USD. HexaShield services then draw down from it — AI and manual penetration testing, incident response hours, vCISO and GRC advisory, threat hunting and training — instead of being invoiced one by one.</Callout>
      <div className="aipt-tiers">
        {RETAINER_TIERS.map((t) => {
          const k = typicalCoverage(t.usd);
          return (
            <div key={t.id} className={`aipt-tier ${t.usd === 50_000 ? 'feat' : ''}`}>
              {t.usd === 50_000 && <Badge color={OPS_TONE} solid>Most chosen</Badge>}
              <b className="aipt-tier-amt">{usd(t.usd)}<small>/ year</small></b>
              {c.currency !== 'USD' && <span className="muted">≈ {fmtMoney(usdToCustomer(t.usd, c.currency), c.currency, false)}</span>}
              <span className="aipt-tier-cover">≈ {k.irHours} IR hours <em>or</em> {k.n} web app tests <em>or</em> a mix</span>
              <ul>
                {t.perks.map((p) => <li key={p}><Check size={12} /> {p}</li>)}
                {IR_RESERVED_BY_TIER[t.usd] && <li><Check size={12} /> {IR_RESERVED_BY_TIER[t.usd]} IR hours reserved for incidents</li>}
                {t.bonusPct > 0 && <li><Sparkles size={12} /> +{t.bonusPct}% bonus credit (configurable)</li>}
              </ul>
              <Btn primary={t.usd === 50_000} color={OPS_TONE} onClick={() => onBuy(t)}>Buy {usd(t.usd)} retainer</Btn>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 11 }}>Perks, bonus credit and rates are {RATE_NOTE}. Stripe TEST MODE — no real payment is taken.</div>
    </>
  );
}

/** Buy flow: tier and start date → payment method → terms → confirm. */
export function BuyRetainerModal({ tier: initial, store, onClose }: { tier: RetainerTier; store: AiptStoreApi; onClose: () => void }) {
  const { customer: c, toast } = useApp();
  const [tierUsd, setTierUsd] = useState(initial.usd);
  const [start, setStart] = useState(todayIso());
  const [method, setMethod] = useState<'card' | 'invoice'>('card');
  const [bankConfirmed, setBankConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [accept, setAccept] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const tier = RETAINER_TIERS.find((t) => t.usd === tierUsd)!;
  const bonus = Math.round((tier.usd * tier.bonusPct) / 100);
  const card = store.state.cards.find((x) => x.default) ?? store.state.cards[0];
  const cardLabel = card ? `${card.brand} •••• ${card.last4}` : 'No card on file';
  const paid = method === 'card' ? !!card : bankConfirmed;
  const renewal = new Date(new Date(`${start}T00:00:00`).getTime() + 365 * 864e5);

  const confirmTransfer = () => { setConfirming(true); window.setTimeout(() => { setBankConfirmed(true); setConfirming(false); }, reduced() ? 0 : 1100); };
  const buy = () => {
    const at = Date.now();
    const r: Retainer = { tierUsd: tier.usd, bonusUsd: bonus, topUps: [], startDate: start, paidAt: at, method, methodLabel: method === 'card' ? cardLabel : 'Invoice · bank transfer', autoRenew, irReservedHours: IR_RESERVED_BY_TIER[tier.usd], ledger: [] };
    store.setRetainer(r);
    store.payFor({ engagementId: 'RETAINER', engagementName: `Annual retainer ${usd(tier.usd)}${bonus ? ` (+${usd(bonus)} bonus credit)` : ''}`, amountGbp: Math.round(tier.usd * 0.79), amount: usdToCustomer(tier.usd, c.currency), amountUsd: tier.usd, currency: c.currency, method: r.methodLabel, kind: 'Retainer' });
    toast(`Retainer active: ${usd(tier.usd + bonus)} available from ${fmtDate(new Date(`${start}T00:00:00`))} · Stripe test mode`);
    onClose();
  };

  return (
    <Modal title="Buy an annual retainer" sub="HexaShield services · paid upfront in USD · Stripe TEST MODE" onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={OPS_TONE} disabled={!paid || !accept} onClick={buy}><Check size={13} /> Confirm & activate</Btn></>}>
      <div className="aipt-form">
        <div className="aipt-qgrid">
          <label className="aipt-field"><span>Tier</span>
            <select className="select" value={tierUsd} onChange={(e) => setTierUsd(Number(e.target.value))}>
              {RETAINER_TIERS.map((t) => <option key={t.id} value={t.usd}>{usd(t.usd)} / year</option>)}
            </select>
          </label>
          <label className="aipt-field"><span>Start date</span><DatePicker value={start} min={todayIso()} onChange={(v) => setStart(v || todayIso())} clearable={false} ariaLabel="Retainer start date" /></label>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{withLocal(tier.usd, c.currency)}{bonus ? ` · +${usd(bonus)} bonus credit` : ''} · renews {fmtDate(renewal)}</div>

        <div className="aipt-field"><span>Payment method</span>
          <div className="aipt-paymodes">
            <label className={`aipt-paymode ${method === 'card' ? 'on' : ''}`}><input type="radio" checked={method === 'card'} onChange={() => setMethod('card')} /><CreditCard size={15} /><span><b>Card on file</b><em>{cardLabel} · charged on confirmation</em></span></label>
            <label className={`aipt-paymode ${method === 'invoice' ? 'on' : ''}`}><input type="radio" checked={method === 'invoice'} onChange={() => setMethod('invoice')} /><Landmark size={15} /><span><b>Invoice / bank transfer</b><em>{bankConfirmed ? 'Invoice paid — transfer confirmed' : 'Pay the invoice, then confirm receipt'}</em></span></label>
          </div>
          {method === 'invoice' && !bankConfirmed && (
            <div style={{ marginTop: 6 }}><Btn sm color={OPS_TONE} disabled={confirming} onClick={confirmTransfer}>{confirming ? <><Loader2 size={12} className="rep-spin" /> Waiting for transfer…</> : 'Simulate transfer received'}</Btn></div>
          )}
        </div>

        <Card title="Retainer terms (summary)" sub="Plain summary — the full terms are in your HexaShield agreement">
          <ul className="aipt-terms">
            <li><b>Term:</b> 12 months from the start date.</li>
            <li><b>Draw-down:</b> HexaShield services are deducted at the rates shown in the service catalogue, when booked (committed) and when delivered (drawn).</li>
            <li><b>Unused balance:</b> handled as set out in your HexaShield agreement at the end of the term.</li>
            <li><b>Top-ups:</b> available at any time during the term.</li>
          </ul>
          <div className="row" style={{ gap: 10, marginTop: 6 }}><Switch on={autoRenew} onChange={setAutoRenew} /><span style={{ fontSize: 12.5 }}>Auto-renew for another 12 months</span></div>
          <label className="aipt-confirm" style={{ marginTop: 8 }}><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> <span>I accept the retainer terms</span></label>
        </Card>
      </div>
    </Modal>
  );
}
