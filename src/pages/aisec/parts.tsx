import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Ban, UserPlus, Cpu, Bot, Plug, AppWindow, Sparkles, Code2, BrainCircuit } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { scopedConnectors, tenantName } from '../../data/customers';
import { Drawer, Modal } from '../../components/Overlay';
import { Badge, Btn, Callout, KV, SevBadge } from '../../components/ui';
import { fmtAgo, fmtCompact, fmtNum } from '../../lib/format';
import {
  aisecInventory, aisecSummary, COVERAGE_HEX, KIND_HEX, STATUS_HEX, VENDOR_HEX, SENSOR_NAME,
  type AsItem, type AsKind, type AsStatus, type Coverage,
} from '../../data/modules/aisec';
import './aisec.css';

export const AS_TONE = MODULE_BY_ID.aisec.tone;
export const AS_HEX = '#8b5cf6';
export const toneStyle = { '--tone': AS_TONE } as CSSProperties;
export const BASE = '/ai-governance';

/** Shared context for every tab: customer, scope, range, inventory and headline summary. */
export function useAs() {
  const app = useApp();
  const { customer: c, tenantId, timeRange } = app;
  const days = rangeDays(timeRange);
  const inv = useMemo(() => aisecInventory(c, tenantId, days), [c, tenantId, days]);
  const sum = useMemo(() => aisecSummary(c, tenantId, days, inv), [c, tenantId, days, inv]);
  const conns = scopedConnectors(c, tenantId);
  const tool = (cat: string) => conns.find((k) => k.category === cat);
  const siem = tool('SIEM');
  const idp = tool('Identity');
  const comply = c.connectors.find((k) => k.product === 'HexaComply');
  return { ...app, c, days, rl: rangeLabel(timeRange), inv, sum, scope: tenantName(c, tenantId), siem, idp, comply, nav: useNavigate() };
}

export const KIND_ICON: Record<AsKind, typeof Bot> = {
  'LLM app': AppWindow, Copilot: Sparkles, 'Code assistant': Code2, Agent: Bot, 'MCP server': Plug, 'Custom GPT': BrainCircuit, 'ML model': Cpu,
};
export function KindBadge({ kind }: { kind: AsKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <Badge color={KIND_HEX[kind]}>
      <Icon size={11} /> {kind}
    </Badge>
  );
}
export function StatusPill({ status }: { status: AsStatus }) {
  return (
    <Badge color={STATUS_HEX[status]} dot solid={status === 'shadow'}>
      {status === 'shadow' ? 'Shadow' : status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
export function CoverageDot({ cov }: { cov: Coverage }) {
  return (
    <span className="as-cov" title={`Runtime sensor: ${cov}`}>
      <i style={{ background: COVERAGE_HEX[cov] }} />
      {cov === 'covered' ? 'Covered' : cov === 'partial' ? 'Egress only' : 'None'}
    </span>
  );
}
export function VendorDot({ v }: { v: string }) {
  return (
    <span className="as-cov">
      <i style={{ background: VENDOR_HEX[v as keyof typeof VENDOR_HEX] ?? '#8a9bc0' }} />
      {v}
    </span>
  );
}

/** Runtime sensor attribution line. */
export function SensorNote({ children }: { children?: ReactNode }) {
  return (
    <span className="as-sensor-note">
      <i /> Runtime sensor by Nexovern{children ? <> · {children}</> : null}
    </span>
  );
}

export type Risk = 'low' | 'medium' | 'high';
export const RISK_HEX: Record<Risk, string> = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--sev-high)' };
export const RISK_APPROVALS: Record<Risk, string> = {
  low: 'One approver (system owner)',
  medium: 'One approver with the AI Approver role',
  high: 'Two approvers, one a Tenant Admin (four-eyes)',
};

/** Write-back / control action confirmation (LLD 8.2). */
export function ActionModal({
  title, target, operation, risk, change, approvers, onClose, onSubmit, children, submitLabel = 'Submit for approval', danger,
}: {
  title: string; target: string; operation: string; risk: Risk; change: ReactNode; approvers: string[];
  onClose: () => void; onSubmit: () => void; children?: ReactNode; submitLabel?: string; danger?: boolean;
}) {
  return (
    <Modal
      title={title}
      sub="Control action · routed through the HexaView approval gate and executed by HexaAI on the execution path"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary danger={danger} color={danger ? undefined : AS_TONE} onClick={onSubmit}>
            <ShieldCheck /> {submitLabel}
          </Btn>
        </>
      }
    >
      <KV
        rows={[
          ['Target', target],
          ['Operation', <span className="mono">{operation}</span>],
          ['Risk class', <Badge color={RISK_HEX[risk]} dot>{risk.charAt(0).toUpperCase() + risk.slice(1)} risk</Badge>],
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
        Enforced by the {SENSOR_NAME} where the AI runs, not at the app layer. The request, approvals and the sensor&rsquo;s confirmation are written to the audit ledger and pushed to HexaComply as evidence.
      </p>
    </Modal>
  );
}

/** Generic records drawer for KPI drill-downs. */
export interface RecordRow { key: string; main: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }
export function RecordsDrawer({ title, sub, rows, source, onClose, footer }: { title: string; sub?: ReactNode; rows: RecordRow[]; source: string; onClose: () => void; footer?: ReactNode }) {
  return (
    <Drawer title={title} sub={sub} onClose={onClose} footer={footer}>
      <div className="row wrap" style={{ gap: 8 }}>
        <Badge color={AS_TONE}>{fmtNum(rows.length)} records</Badge>
        <span className="muted" style={{ fontSize: 11.5 }}>Source: {source}</span>
      </div>
      <div className="list">
        {rows.map((r) => {
          const Tag = r.onClick ? 'button' : 'div';
          return (
            <Tag key={r.key} className="list-row" onClick={r.onClick}>
              <span className="list-main">
                <b style={{ whiteSpace: 'normal' }}>{r.main}</b>
                {r.sub && <span>{r.sub}</span>}
              </span>
              {r.right}
            </Tag>
          );
        })}
        {rows.length === 0 && <div className="empty">No records in this scope and range.</div>}
      </div>
    </Drawer>
  );
}

export function itemRows(items: AsItem[], open: (x: AsItem) => void, metric: (x: AsItem) => ReactNode = (x) => <SevBadge sev={x.sev} />): RecordRow[] {
  return items.map((x) => ({ key: x.id, main: x.name, sub: `${x.kind} · ${x.vendor} · ${x.owner}`, right: metric(x), onClick: () => open(x) }));
}

/** Item drawer with sanction / block / assign owner actions. */
export function ItemDrawer({ item: x, onClose }: { item: AsItem; onClose: () => void }) {
  const { c, toast, nav } = useAs();
  const [act, setAct] = useState<'sanction' | 'block' | 'owner' | null>(null);
  const [owner, setOwner] = useState(c.people.grcLead.name);
  const Icon = KIND_ICON[x.kind];
  const people = [c.people.ciso, c.people.grcLead, c.people.admin, c.people.socLead, ...c.people.staff.slice(0, 6)];
  const agentic = x.kind === 'Agent' || x.kind === 'MCP server' || x.kind === 'Custom GPT';
  return (
    <>
      <Drawer
        wide
        title={x.name}
        sub={`${x.kind} · ${x.vendor} · first seen ${fmtAgo(x.firstSeenDays * 1440)}`}
        icon={<span className="ico-box" style={{ ['--tone' as string]: KIND_HEX[x.kind] }}><Icon /></span>}
        onClose={onClose}
        footer={
          <>
            <Btn onClick={() => setAct('owner')}><UserPlus size={14} /> Assign owner</Btn>
            {x.status !== 'sanctioned' && <Btn onClick={() => setAct('sanction')}><ShieldCheck size={14} /> Sanction</Btn>}
            <Btn danger onClick={() => setAct('block')}><Ban size={14} /> {agentic ? 'Block / kill' : 'Block'}</Btn>
          </>
        }
      >
        <div className="row wrap" style={{ gap: 6 }}>
          <StatusPill status={x.status} />
          <KindBadge kind={x.kind} />
          <SevBadge sev={x.sev} />
          <Badge color={x.euClass === 'High' ? 'var(--sev-high)' : x.euClass === 'Limited' ? 'var(--sev-medium)' : 'var(--good)'}>EU AI Act: {x.euClass}</Badge>
          <CoverageDot cov={x.sensor} />
        </div>
        {x.status === 'shadow' && (
          <Callout kind="warn">
            <b>Shadow {agentic ? 'agent' : 'AI'}</b> discovered by the runtime sensor ({x.discoveredBy.split(' · ')[1]}). No owner, no approval, no model card. {x.sensitive.length ? <>Observed carrying <b>{x.sensitive.join(', ')}</b>.</> : null}
          </Callout>
        )}
        <div className="as-path">
          {[
            ['User / process', `${fmtNum(x.users)} users · ${fmtNum(x.hosts)} hosts`],
            ['Execution path', `${SENSOR_NAME.replace(' runtime sensor', '')} kernel sensor`],
            [agentic ? 'Tools & MCP' : 'Application', agentic ? x.tools.slice(0, 2).join(', ') || '—' : x.platform],
            ['Model', x.model],
            ['Vendor endpoint', x.endpoint],
          ].map(([k, v], i) => (
            <div key={i} className={`as-path-step ${i === 1 ? 'sensor' : ''}`}>
              <span>{k}</span>
              <b title={v}>{v}</b>
            </div>
          ))}
        </div>
        <KV
          rows={[
            ['Owner', x.owner === 'Unassigned' ? <span style={{ color: 'var(--bad)', fontWeight: 600 }}>Unassigned</span> : x.owner],
            ['Department', x.department],
            ['Model vendor', <VendorDot v={x.modelVendor} />],
            ['Residency', x.residency],
            ['Data classes', <span className="chips">{x.dataClasses.map((d) => <Badge key={d} color={x.sensitive.includes(d) ? 'var(--sev-high)' : undefined}>{d}</Badge>)}</span>],
            ['EU AI Act basis', x.euBasis],
            ['Authentication', x.auth],
            ['Discovered by', x.discoveredBy],
            ...(agentic ? ([['Tools', <span className="mono" style={{ fontSize: 11.5 }}>{x.tools.join(' · ') || '—'}</span>], ['Data access', x.dataAccess]] as [ReactNode, ReactNode][]) : []),
            ...(x.kind === 'MCP server' ? ([['MCP client connections', fmtNum(x.clients)]] as [ReactNode, ReactNode][]) : []),
            ['Note', x.note || '—'],
          ]}
        />
        <div className="mini-stats">
          <button className="as-ms" onClick={() => nav(`${BASE}/runtime?item=${encodeURIComponent(x.name)}`)}><b>{fmtCompact(x.sessions)}</b><span>Sessions</span></button>
          <button className="as-ms" onClick={() => nav(`${BASE}/policy?item=${encodeURIComponent(x.name)}`)}><b style={{ color: 'var(--bad)' }}>{fmtNum(x.blocked)}</b><span>Blocked</span></button>
          <button className="as-ms" onClick={() => nav(`${BASE}/dataflows`)}><b style={{ color: '#68b1ff' }}>{fmtNum(x.redacted)}</b><span>Redacted</span></button>
          <div className="as-ms"><b>{x.risk}</b><span>Risk score</span></div>
        </div>
        <SensorNote>process, memory, network and system-call telemetry for this {agentic ? 'agent' : 'system'}</SensorNote>
      </Drawer>
      {act === 'owner' && (
        <ActionModal
          title={`Assign an owner to ${x.name}`}
          target="HexaAI register · HexaComply AI system record"
          operation="register.owner.set"
          risk="low"
          approvers={[c.people.grcLead.name]}
          change={<>The owner becomes accountable for approval, impact assessment and evidence in HexaComply. They are notified and get a task to complete the intake.</>}
          onClose={() => setAct(null)}
          submitLabel="Assign owner"
          onSubmit={() => { setAct(null); toast(`Owner set: ${owner} now owns ${x.name}; intake task created in HexaComply`); }}
        >
          <label className="stack" style={{ gap: 4 }}>
            <span className="section-label" style={{ margin: 0 }}>Owner</span>
            <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {people.map((p) => <option key={p.email} value={p.name}>{p.name} · {p.role}</option>)}
            </select>
          </label>
        </ActionModal>
      )}
      {act === 'sanction' && (
        <ActionModal
          title={`Sanction ${x.name}`}
          target="HexaAI register · guardrail profile"
          operation="register.status.set(sanctioned) + policy.attach(standard-guardrails)"
          risk="medium"
          approvers={[c.people.grcLead.name]}
          change={<>Moves {x.name} from <b>{x.status}</b> to <b>sanctioned</b>, attaches the standard guardrail profile (data-class rules, approval gates, kill switch) and opens an AI impact assessment in HexaComply.</>}
          onClose={() => setAct(null)}
          onSubmit={() => { setAct(null); toast(`Sanction request for ${x.name} sent to ${c.people.grcLead.name}`); }}
        />
      )}
      {act === 'block' && (
        <ActionModal
          danger
          title={`${agentic ? 'Block and kill' : 'Block'} ${x.name}`}
          target={`${SENSOR_NAME} on ${fmtNum(x.hosts)} host${x.hosts === 1 ? '' : 's'}`}
          operation={agentic ? 'sensor.process.kill(tree) + egress.deny' : `egress.deny(${x.endpoint})`}
          risk="high"
          approvers={[c.people.socLead.name, c.people.ciso.name]}
          change={<>{agentic ? 'Terminates the agent process tree and denies its tool, MCP and model egress' : `Denies egress to ${x.endpoint} from managed hosts`}. {fmtNum(x.users)} user{x.users === 1 ? '' : 's'} see a coaching notice pointing to sanctioned alternatives. Reversible from Guardrails &amp; Kill Switch.</>}
          onClose={() => setAct(null)}
          submitLabel="Request block (two approvers)"
          onSubmit={() => { setAct(null); toast(`Block of ${x.name} awaiting second approver (${c.people.ciso.name})`); }}
        />
      )}
    </>
  );
}

/** HTML heat matrix (crisp, original style). */
export function HeatMatrix({ rows, cols, cells, color = AS_HEX, onCell, rowW = 190, fmt = fmtNum }: {
  rows: { id: string; label: ReactNode }[]; cols: string[]; cells: number[][]; color?: string; onCell?: (r: number, c: number) => void; rowW?: number; fmt?: (n: number) => string;
}) {
  const max = Math.max(1, ...cells.flat());
  return (
    <div className="as-heat" style={{ gridTemplateColumns: `${rowW}px repeat(${cols.length}, minmax(0, 1fr))` }}>
      <span />
      {cols.map((cl) => <span key={cl} className="as-heat-col">{cl}</span>)}
      {rows.map((r, ri) => (
        <div key={r.id} style={{ display: 'contents' }}>
          <span className="as-heat-row">{r.label}</span>
          {cols.map((cl, ci) => {
            const v = cells[ri]?.[ci] ?? 0;
            const a = v ? 0.12 + 0.78 * Math.sqrt(v / max) : 0;
            return (
              <button
                key={cl}
                className="as-heat-cell"
                style={{ background: v ? `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)` : undefined, color: a > 0.55 ? '#fff' : undefined }}
                onClick={onCell ? () => onCell(ri, ci) : undefined}
                title={`${typeof r.label === 'string' ? r.label : r.id} · ${cl}: ${v}`}
              >
                {v ? fmt(v) : '·'}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Tiny SVG sparkline. */
export function Spark({ data, color = AS_HEX, w = 90, h = 26, fill = true }: { data: number[]; color?: string; w?: number; h?: number; fill?: boolean }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, h - 2 - ((v - min) / Math.max(1e-9, max - min)) * (h - 4)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="as-spark" aria-hidden>
      {fill && <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.14} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** Clickable big number used inside cards. */
export function BigNum({ value, label, color, onClick, source }: { value: ReactNode; label: ReactNode; color?: string; onClick?: () => void; source?: string }) {
  return (
    <button className="as-big" onClick={onClick} title={source ? `Source: ${source} · click to open` : undefined} style={color ? { color } : undefined}>
      <b>{value}</b>
      <span>{label}</span>
    </button>
  );
}

export function Cite({ children, to }: { children: ReactNode; to: string }) {
  const nav = useNavigate();
  return (
    <button className="as-cite" onClick={() => nav(to)}>
      {children}
    </button>
  );
}

