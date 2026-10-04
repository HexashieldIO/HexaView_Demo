import type { CSSProperties, ReactNode } from 'react';
import { Zap, Search, GitBranch, ShieldCheck, Send, Bell, Hourglass, Flag, Lock } from 'lucide-react';
import type { CustomerProfile } from '../../../data/types';
import { OP, NODE_H, NODE_W, capOf, type NodeKind, type PbNode, type PbEdge, type PbStatus, type PbRisk, type RunStatus } from '../../../data/modules/playbooks';

export type CVars = CSSProperties & Record<`--${string}`, string>;

export const KIND_META: Record<NodeKind, { label: string; color: string; icon: ReactNode }> = {
  trigger: { label: 'Trigger', color: 'var(--m-soc)', icon: <Zap /> },
  enrich: { label: 'Enrich', color: '#4f8cff', icon: <Search /> },
  condition: { label: 'Decide', color: '#e3912c', icon: <GitBranch /> },
  approval: { label: 'Approval gate', color: '#2dd4bf', icon: <ShieldCheck /> },
  action: { label: 'Write-back', color: '#ef6aae', icon: <Send /> },
  notify: { label: 'Notify', color: '#20b292', icon: <Bell /> },
  wait: { label: 'Wait', color: '#8593b4', icon: <Hourglass /> },
  end: { label: 'End', color: '#8593b4', icon: <Flag /> },
};

export const PB_RISK_COLOR: Record<PbRisk, string> = { low: 'var(--sev-low)', medium: 'var(--sev-medium)', high: 'var(--sev-high)' };
export const STATUS_COLOR: Record<PbStatus, string> = { active: 'var(--good)', draft: 'var(--sev-info)', paused: 'var(--sev-medium)', review: '#a07cfb' };
export const STATUS_LABEL: Record<PbStatus, string> = { active: 'Active', draft: 'Draft', paused: 'Paused', review: 'In review' };
export const RUN_COLOR: Record<RunStatus, string> = { success: '#2dd4bf', failed: '#f0466e', awaiting: '#e3912c', denied: '#8a9bc0' };
export const RUN_LABEL: Record<RunStatus, string> = { success: 'Success', failed: 'Failed', awaiting: 'Awaiting approval', denied: 'Denied' };
export const CAT_COLOR: Record<string, string> = { Email: '#4f8cff', Identity: '#a07cfb', Endpoint: '#ef6aae', Data: '#f5a83d', Exposure: '#f8646f', OT: '#f08c2e', Regulatory: '#2dd4bf', Sector: '#93d65a' };

export function isOtWrite(c: CustomerProfile, n: PbNode): boolean {
  if (n.kind !== 'action') return false;
  if (OP[n.op]?.ot) return true;
  const k = c.connectors.find((x) => x.id === n.tool);
  return !!k && capOf(k) === 'ot';
}

export function nodeColor(c: CustomerProfile, n: PbNode): string {
  if (n.kind === 'action') {
    if (isOtWrite(c, n)) return 'var(--bad)';
    return PB_RISK_COLOR[OP[n.op]?.risk ?? 'low'];
  }
  if (n.kind === 'approval') return PB_RISK_COLOR[n.risk ?? 'medium'];
  return KIND_META[n.kind].color;
}

export function nodeIcon(c: CustomerProfile, n: PbNode): ReactNode {
  return isOtWrite(c, n) ? <Lock /> : KIND_META[n.kind].icon;
}

/** Tiny thumbnail of a playbook graph for library cards. */
export function MiniGraph({ c, nodes, edges }: { c: CustomerProfile; nodes: PbNode[]; edges: PbEdge[] }) {
  if (!nodes.length) return <svg className="pb-mini" />;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const w = Math.max(...nodes.map((n) => n.x)) - minX + NODE_W;
  const h = Math.max(...nodes.map((n) => n.y)) - minY + NODE_H;
  const by = new Map(nodes.map((n) => [n.id, n]));
  const cx = (n: PbNode) => n.x - minX + NODE_W / 2;
  const cy = (n: PbNode) => n.y - minY + NODE_H / 2;
  return (
    <svg className="pb-mini" viewBox={`-20 -20 ${w + 40} ${h + 40}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {edges.map((e) => {
        const a = by.get(e.from);
        const b = by.get(e.to);
        if (!a || !b) return null;
        return <line key={e.id} x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} strokeWidth={10} style={{ stroke: 'var(--text-muted)', strokeOpacity: 0.45 }} />;
      })}
      {nodes.map((n) => (
        <rect key={n.id} x={cx(n) - 46} y={cy(n) - 20} width={92} height={40} rx={12} style={{ fill: nodeColor(c, n) }} />
      ))}
    </svg>
  );
}
