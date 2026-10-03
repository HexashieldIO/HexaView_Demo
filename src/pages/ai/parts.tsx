import type { ReactNode } from 'react';
import { ShieldCheck, Lock, Eye, Ban, Cpu, Fingerprint } from 'lucide-react';
import { Modal } from '../../components/Overlay';
import { Badge, Btn, Callout, KV } from '../../components/ui';
import { MODULE_BY_ID } from '../../modules/registry';
import type { AiStatus } from '../../data/modules/ai';

export const AI_TONE = MODULE_BY_ID.ai.tone;

export type Risk = 'low' | 'medium' | 'high';
export const RISK_COLOR: Record<Risk, string> = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--sev-high)' };
export const RISK_APPROVALS: Record<Risk, string> = {
  low: 'One approver (analyst or owner)',
  medium: 'One approver with the Approver role',
  high: 'Two approvers, one a Tenant Admin (four-eyes)',
};

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <Badge color={RISK_COLOR[risk]} dot>
      {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
    </Badge>
  );
}

export const AI_STATUS_COLOR: Record<AiStatus, string> = { sanctioned: 'var(--good)', pilot: 'var(--sev-low)', shadow: 'var(--bad)' };
export function AiStatusBadge({ status }: { status: AiStatus }) {
  return (
    <Badge color={AI_STATUS_COLOR[status]} dot>
      {status === 'shadow' ? 'Shadow' : status === 'pilot' ? 'Pilot' : 'Sanctioned'}
    </Badge>
  );
}

/** Approval-gate modal (LLD 8.2): shows what will change, risk class and approvers. */
export function ApprovalModal({
  title, connector, operation, risk, change, approvers, onClose, onSubmit, children, submitLabel = 'Submit for approval',
}: {
  title: string; connector: string; operation: string; risk: Risk; change: ReactNode; approvers: string[];
  onClose: () => void; onSubmit: () => void; children?: ReactNode; submitLabel?: string;
}) {
  return (
    <Modal
      title={title}
      sub="Write-back request · routed through the HexaView approval gate"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary color={AI_TONE} onClick={onSubmit}>
            <ShieldCheck /> {submitLabel}
          </Btn>
        </>
      }
    >
      <KV
        rows={[
          ['Target connector', connector],
          ['Operation', <span className="mono">{operation}</span>],
          ['Risk class', <RiskBadge risk={risk} />],
          ['Approval policy', RISK_APPROVALS[risk]],
          ['Approvers', <span className="chips">{approvers.map((a) => <Badge key={a}>{a}</Badge>)}</span>],
        ]}
      />
      <div>
        <div className="section-label">What will change</div>
        <Callout kind="warn">{change}</Callout>
      </div>
      {children}
      <p className="muted" style={{ fontSize: 11.5 }}>
        Drafted by HexaAI, submitted by you. Nothing executes until the approvers sign; the request, approvals and the connector response are written to the audit ledger and verified after execution.
      </p>
    </Modal>
  );
}

const SAFETY = [
  { icon: Eye, title: 'Read-only', text: 'The copilot queries HexaCore through typed tools; it cannot change anything.' },
  { icon: Lock, title: 'Tenant-scoped', text: 'Every tool call carries your tenant and role; row-level security applies before the model sees data.' },
  { icon: ShieldCheck, title: 'Prompt Shields screened', text: 'User prompts and retrieved documents are screened for direct and indirect injection.' },
  { icon: Ban, title: 'No autonomous actions', text: 'It may draft an action request; a named human submits it through the approval gate.' },
  { icon: Cpu, title: 'Model-portable', text: 'Runs on Azure OpenAI in-region today; the tool contract lets you swap models without retraining.' },
  { icon: Fingerprint, title: 'Cited or flagged', text: 'Every factual sentence cites a versioned record; uncited numbers are marked unverified.' },
];

export function SafetyNotes({ compact }: { compact?: boolean }) {
  return (
    <div className="ai-safety">
      {SAFETY.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.title} className="ai-safety-row">
            <span className="ico-box" style={{ ['--tone' as string]: AI_TONE, width: 24, height: 24 }}>
              <Icon />
            </span>
            <div>
              <b>{s.title}</b>
              {!compact && <span>{s.text}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
