import { useState } from 'react';
import { Ban } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { Badge, Btn, Callout, KV } from '../../components/ui';
import { Modal } from '../../components/Overlay';
import type { GrantScope } from '../../data/modules/custody';
import { fmtNum } from '../../lib/format';
import { rng } from '../../lib/rng';
import './custody.css';

export const CUSTODY_TONE = MODULE_BY_ID.custody.tone;

export function fmtGb(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(gb >= 10000 ? 0 : 1)} TB`;
  return `${fmtNum(gb)} GB`;
}

export const SCOPE_META: Record<GrantScope, { label: string; risk: 'medium' | 'high'; approvals: number; what: string }> = {
  session: { label: 'Session', risk: 'medium', approvals: 1, what: 'Ends one live session on one device; the user keeps other access' },
  user: { label: 'User', risk: 'medium', approvals: 1, what: 'Removes this person’s access to the asset on every device and session' },
  supplier: { label: 'Supplier', risk: 'high', approvals: 2, what: 'Removes access for every user, agent and session at the supplier' },
};

export interface RevokeRequest {
  scope: GrantScope;
  target: string;
  asset: string;
  detail?: string;
}

/**
 * Revocation write-back (bidirectional): shows what changes, the risk class and
 * the approvals needed, then propagates through the custody agents.
 */
export function RevokeModal({ req, onClose, onDone }: { req: RevokeRequest; onClose: () => void; onDone: (r: { id: string; propagationSec: number; reason: string; approvers: string[] }) => void }) {
  const { customer: c, toast } = useApp();
  const [scope, setScope] = useState<GrantScope>(req.scope);
  const [reason, setReason] = useState('Unsanctioned copy detected');
  const meta = SCOPE_META[scope];
  const approvers = meta.approvals === 2 ? [c.people.grcLead, c.people.ciso] : [c.people.grcLead];
  const agents = c.connectors.find((k) => k.category === 'Custody');
  const r = rng(`revoke-${req.target}-${scope}`);
  const agentsAffected = scope === 'supplier' ? r.int(6, 40) : scope === 'user' ? r.int(1, 6) : 1;
  const submit = () => {
    const id = `RV-${r.int(10000, 99999)}`;
    const sec = scope === 'session' ? r.int(4, 14) : scope === 'user' ? r.int(9, 28) : r.int(22, 48);
    toast(`${id}: ${meta.label.toLowerCase()} access for ${req.target} revoked · approved by ${approvers.map((a) => a.name).join(' and ')} · propagated to ${agentsAffected} agent${agentsAffected > 1 ? 's' : ''} in ${sec} s`);
    onDone({ id, propagationSec: sec, reason, approvers: approvers.map((a) => a.name) });
    onClose();
  };
  return (
    <Modal
      title={<><Ban size={16} style={{ verticalAlign: -3, color: 'var(--bad)' }} /> Revoke access</>}
      sub={`${req.target} · ${req.asset}`}
      onClose={onClose}
      footer={
        <>
          <span className="muted" style={{ fontSize: 11.5, marginRight: 'auto' }}>Target: propagation in under 60 s</span>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary color="var(--bad)" onClick={submit}>{meta.approvals === 2 ? 'Request 2 approvals & revoke' : 'Approve & revoke'}</Btn>
        </>
      }
    >
      <div className="custody-scope-pick" style={{ marginBottom: 14 }}>
        {(['session', 'user', 'supplier'] as GrantScope[]).map((s) => (
          <button key={s} className={scope === s ? 'on' : ''} onClick={() => setScope(s)} type="button">
            <b>{SCOPE_META[s].label}</b>
            <span>{SCOPE_META[s].risk === 'high' ? 'High risk · 2 approvers' : 'Medium risk · 1 approver'}</span>
          </button>
        ))}
      </div>
      <KV rows={[
        ['What changes', meta.what],
        ['Asset', req.asset],
        ...(req.detail ? ([['Grant', req.detail]] as [string, string][]) : []),
        ['Risk class', <Badge color={meta.risk === 'high' ? 'var(--sev-high)' : 'var(--sev-medium)'}>{meta.risk === 'high' ? 'High' : 'Medium'} (LLD 8.2)</Badge>],
        ['Approvals', approvers.map((a) => `${a.name} (${a.role})`).join(' + ')],
        ['Enforced by', `${agents ? (agents.vendor === 'HexaShield' ? agents.product : `${agents.vendor} ${agents.product}`) : 'HexaCustody agents'} · ${agentsAffected} agent${agentsAffected > 1 ? 's' : ''}`],
        ['Reversible', 'Yes: re-grant from the same screen; the audit ledger keeps both'],
      ]} />
      <label className="stack" style={{ gap: 4, marginTop: 14, fontSize: 12 }}>
        <span className="muted">Reason (recorded in the audit ledger)</span>
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {['Unsanctioned copy detected', 'Engagement or delivery complete', 'Leaver or contract ended', 'Device lost or stolen', 'Investigation hold'].map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      {scope === 'supplier' && (
        <div style={{ marginTop: 12 }}>
          <Callout kind="warn">Supplier-wide revocation interrupts every open job at this vendor. Production schedules that depend on it will be notified.</Callout>
        </div>
      )}
    </Modal>
  );
}
