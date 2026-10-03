import type { CSSProperties, ReactNode } from 'react';
import { Flame, ShieldAlert } from 'lucide-react';
import { Btn, Callout, KV } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import {
  VR_PHASE_COLOR, VR_REPLY_COLOR, VR_STATUS_COLOR, VR_VERDICT_COLOR, VR_VALIDATION_COLOR, VR_SOURCE_META,
  type VrAdvisory, type VrPhase, type VrReply, type VrStatus, type VrVerdict, type VrValidation, type VrSource,
} from '../../../data/modules/vulnresponse';

type TC = CSSProperties & { '--tc'?: string };

export function VrPill({ color, children, title, solid }: { color: string; children: ReactNode; title?: string; solid?: boolean }) {
  return <span className={`vr-pill ${solid ? 'solid' : ''}`} style={{ '--tc': color } as TC} title={title}>{children}</span>;
}

export const StatusPill = ({ s }: { s: VrStatus }) => <VrPill color={VR_STATUS_COLOR[s]}>{s}</VrPill>;
export const VerdictPill = ({ verdict }: { verdict: VrVerdict }) => <VrPill color={VR_VERDICT_COLOR[verdict]} solid={verdict === 'Affected'}>{verdict}</VrPill>;
export const PhasePill = ({ phase }: { phase: VrPhase }) => <VrPill color={VR_PHASE_COLOR[phase]}>{phase}</VrPill>;
export const ReplyPill = ({ r }: { r: VrReply | 'Not asked' | 'Awaiting reply' }) => <VrPill color={VR_REPLY_COLOR[r]}>{r}</VrPill>;
export const ValPill = ({ v }: { v: VrValidation }) => <VrPill color={VR_VALIDATION_COLOR[v]}>{v}</VrPill>;
export const SourceTag = ({ s }: { s: VrSource }) => <span className="vr-src" style={{ '--tc': VR_SOURCE_META[s].color } as TC}>{VR_SOURCE_META[s].short}</span>;

export function CvssBadge({ score, big }: { score: number; big?: boolean }) {
  const col = score >= 9 ? 'var(--sev-critical)' : score >= 7 ? 'var(--sev-high)' : 'var(--sev-medium)';
  return (
    <span className={`vr-cvss ${big ? 'big' : ''}`} style={{ '--tc': col } as TC} title="CVSS v3.1 base score">
      <b>{score.toFixed(1)}</b><small>CVSS</small>
    </span>
  );
}

export function Flags({ adv }: { adv: VrAdvisory }) {
  return (
    <span className="vr-flags">
      {adv.exploited && <VrPill color="var(--bad)" title="Exploitation reported by the vendor, ISACs or HexaInt collection"><Flame size={11} /> Exploited in the wild</VrPill>}
      {adv.kev && <VrPill color="var(--sev-high)" title="Listed in the CISA Known Exploited Vulnerabilities catalogue"><ShieldAlert size={11} /> KEV</VrPill>}
    </span>
  );
}

/** Original-style state tiles: label, big number, optional bar. Each pivots to its records. */
export function VrTiles({ items }: { items: { label: string; sub?: string; value: ReactNode; unit?: string; color?: string; bar?: number; on?: boolean; onClick: () => void; source: string }[] }) {
  return (
    <div className="vr-tiles">
      {items.map((t) => (
        <button key={t.label} type="button" className={`vr-tile ${t.on ? 'on' : ''}`} onClick={t.onClick} title={`Source: ${t.source} · click to filter`}>
          <span className="vr-tile-l">{t.label}{t.sub && <em>{t.sub}</em>}</span>
          <span className="vr-tile-v"><b style={t.color ? { color: t.color } : undefined}>{t.value}</b>{t.unit && <small>{t.unit}</small>}</span>
          {t.bar !== undefined && <span className="vr-tile-bar"><i style={{ width: `${Math.max(2, Math.min(100, t.bar))}%`, background: t.color ?? 'var(--m-int)' }} /></span>}
        </button>
      ))}
    </div>
  );
}

export function fmtDue(min: number): { text: string; color: string } {
  if (min < 0) return { text: `${fmtH(-min)} overdue`, color: 'var(--bad)' };
  if (min < 6 * 60) return { text: `${fmtH(min)} left`, color: 'var(--sev-high)' };
  if (min < 48 * 60) return { text: `${fmtH(min)} left`, color: 'var(--sev-medium)' };
  return { text: `${fmtH(min)} left`, color: 'var(--good)' };
}
function fmtH(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}

/** Absolute timestamp from minutes ago, e.g. "3 Oct 09:42". */
export function stamp(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60000);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

const RISK_COLOR = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--bad)' } as const;

/** Confirmation modal following LLD 8.2: what changes, risk class and approvals, then a callback. */
export function Confirm({ title, sub, change, risk, approvers, confirmLabel, onConfirm, onClose, children }: {
  title: string; sub?: string; change: [ReactNode, ReactNode][]; risk: keyof typeof RISK_COLOR; approvers: number; confirmLabel: string; onConfirm: () => void; onClose: () => void; children?: ReactNode;
}) {
  return (
    <Modal
      title={title}
      sub={sub}
      onClose={onClose}
      footer={
        <>
          <Btn ghost onClick={onClose}>Cancel</Btn>
          <Btn primary color={RISK_COLOR[risk]} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
        </>
      }
    >
      <Callout kind={risk === 'low' ? 'info' : 'warn'} color={RISK_COLOR[risk]}>
        <b>{risk === 'high' ? 'High-risk action' : risk === 'medium' ? 'Medium-risk action' : 'Low-risk action'}</b> · requires {approvers} approver{approvers > 1 ? 's' : ''} and is written to the HexaCore audit ledger. The underlying tool stays the system of record.
      </Callout>
      <div style={{ marginTop: 12 }}><KV rows={change} /></div>
      {children}
    </Modal>
  );
}
