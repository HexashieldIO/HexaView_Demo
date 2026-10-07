import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Wallet, Plus } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Btn, Callout, KV } from '../../components/ui';
import { fmtMoney, fmtDateTime } from '../../lib/format';
import { useAiptStore } from '../strike/aipentest/store';
import { retainerTotals, irHours } from '../../data/modules/aiptRetainer';
import { IR_HOUR_USD, IR_SLA } from '../../data/modules/retainer';
import { IR_TONE } from './parts';
import '../strike/aipentest/aipt.css';

const usd = (n: number) => fmtMoney(n, 'USD', false);
const BUY = '/ops/admin?section=billing&billing=retainer';

/** War Room card: IR hours logged on this incident against the HexaShield services retainer. */
export function IrHoursCard({ incId, title }: { incId: string; title: string }) {
  const { customer: c, toast } = useApp();
  const store = useAiptStore(c);
  const nav = useNavigate();
  const r = store.retainer;
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(4);
  const [note, setNote] = useState('');

  if (!r) {
    return (
      <Card title={<><Clock size={14} /> IR hours</>} sub="HexaShield incident response">
        <Callout>Time &amp; materials — no retainer. HexaShield IR is invoiced at {usd(IR_HOUR_USD)}/h for this incident.</Callout>
        <div style={{ marginTop: 8 }}><Btn sm color={IR_TONE} onClick={() => nav(BUY)}><Wallet size={12} /> Buy a retainer</Btn></div>
      </Card>
    );
  }

  const t = retainerTotals(r, store.engagements);
  const ir = irHours(r, t.available);
  const logged = r.ledger.filter((l) => l.serviceId === 'ir-hours' && l.engId === incId && l.status !== 'Released');
  const loggedHours = logged.reduce((s, l) => s + (l.qty ?? 0), 0);
  const cost = hours * IR_HOUR_USD;

  const log = () => {
    const at = Date.now();
    store.setRetainer({ ...r, ledger: [...r.ledger, { id: `RL-ir-${incId}-${at.toString(36)}`, at, engId: incId, label: 'IR retainer hours', usd: cost, serviceId: 'ir-hours', category: 'Incident response', qty: hours, note: note.trim() || title, status: 'Drawn' }] });
    toast(`Logged ${hours} IR hours on ${incId} — ${usd(cost)} drawn from the retainer`);
    setOpen(false);
    setNote('');
  };

  return (
    <Card title={<><Clock size={14} /> IR hours (retainer)</>} sub={IR_SLA}
      actions={<Btn sm color={IR_TONE} onClick={() => setOpen((x) => !x)}><Plus size={12} /> Log IR hours</Btn>}>
      <KV rows={[
        ['On this incident', <b>{loggedHours} h · {usd(loggedHours * IR_HOUR_USD)}</b>],
        ['Retainer balance', <span>{usd(t.available)} <span className="muted">of {usd(t.total)}</span></span>],
        ['IR hours remaining', `≈ ${ir.affordable} at ${usd(IR_HOUR_USD)}/h${ir.reserved ? ` · ${ir.reservedLeft} of ${ir.reserved} reserved left` : ''}`],
      ]} />
      {open && (
        <div className="aipt-form" style={{ marginTop: 10 }}>
          <div className="aipt-qgrid">
            <label className="aipt-field"><span>Hours</span><input className="input" type="number" min={1} max={200} value={hours} onChange={(e) => setHours(Math.max(1, Math.round(Number(e.target.value) || 1)))} /></label>
            <label className="aipt-field"><span>Work done</span><input className="input" value={note} placeholder="e.g. Containment support, log review" onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{usd(cost)} · balance after {usd(t.available - cost)}</div>
          {cost > t.available && <Callout kind="warn">Exceeds the available balance. Top up the retainer in Billing &amp; payments.</Callout>}
          <div className="row" style={{ gap: 8 }}>
            <Btn sm primary color={IR_TONE} disabled={cost > t.available} onClick={log}>Log {hours} h</Btn>
            <Btn sm ghost onClick={() => setOpen(false)}>Cancel</Btn>
          </div>
        </div>
      )}
      {logged.length > 0 && (
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
          {logged.slice(-3).map((l) => <div key={l.id}>{fmtDateTime(new Date(l.at))} · {l.qty} h · {l.note}</div>)}
        </div>
      )}
    </Card>
  );
}

/** Shown when declaring an incident: covered by the retainer, or time & materials. */
export function RetainerCoverNote() {
  const { customer: c } = useApp();
  const store = useAiptStore(c);
  const nav = useNavigate();
  if (store.retainer) {
    const t = retainerTotals(store.retainer, store.engagements);
    return <Callout kind="good"><b>Covered by retainer — priority response SLA</b> ({IR_SLA}). {usd(t.available)} available ≈ {Math.floor(t.available / IR_HOUR_USD)} IR hours.</Callout>;
  }
  return <Callout>Time &amp; materials — no retainer ({usd(IR_HOUR_USD)}/h). <button type="button" className="aipt-linkbtn" onClick={() => nav(BUY)}>Buy a retainer →</button></Callout>;
}
