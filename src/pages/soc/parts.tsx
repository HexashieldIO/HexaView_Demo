import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, Copy } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedTenants } from '../../data/customers';
import { socTools, techName } from '../../data/modules/soc';
import { MODULE_BY_ID } from '../../modules/registry';
import { Modal, Drawer } from '../../components/Overlay';
import { Badge, Btn, Callout, KV, IcoBox } from '../../components/ui';
import type { CustomerProfile } from '../../data/types';
import { fmtDur } from '../../lib/format';
import './soc.css';

export function useSoc() {
  const app = useApp();
  const { customer: c, tenantId, timeRange } = app;
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const tools = socTools(c, tenantId);
  const tone = MODULE_BY_ID.soc.tone;
  const tenants = scopedTenants(c, tenantId);
  const scopeLabel = tenantId === 'all' ? `${c.name} (${c.tenants.length} tenants)` : `${tenants[0]?.name ?? tenantId}`;
  const nav = useNavigate();
  return { ...app, c, days, h, tools, tone, tenants, scopeLabel, nav, rangeText: rangeLabel(timeRange) };
}

export function tenantShort(c: CustomerProfile, id: string): string {
  return c.tenants.find((t) => t.id === id)?.short ?? id;
}

export type Risk = 'low' | 'medium' | 'high';
export const RISK_COLOR: Record<Risk, string> = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--sev-high)' };

export function approversFor(c: CustomerProfile, risk: Risk): string[] {
  if (risk === 'high') return [`${c.people.admin.name} (Tenant Admin)`, `${c.people.socLead.name} (${c.people.socLead.role})`];
  if (risk === 'medium') return [`${c.people.socLead.name} (${c.people.socLead.role})`];
  return [];
}

export interface WriteBack {
  title: string;
  system: string;
  target: string;
  changes: string[];
  risk: Risk;
  done: string;
  rollback?: string;
}

/** Write-back request (LLD 8.2): shows what will change, the risk class and approvals, then toasts. */
export function WriteBackModal({ wb, onClose }: { wb: WriteBack; onClose: () => void }) {
  const { customer: c, toast } = useApp();
  const [why, setWhy] = useState('');
  const approvers = approversFor(c, wb.risk);
  const submit = () => {
    toast(approvers.length ? `${wb.done} · sent for approval to ${approvers.map((a) => a.split(' (')[0]).join(' and ')}` : `${wb.done} · executed and logged`);
    onClose();
  };
  return (
    <Modal
      title={wb.title}
      sub={`Write-back to ${wb.system} via the HexaView action broker`}
      onClose={onClose}
      footer={
        <>
          <Btn ghost onClick={onClose}>Cancel</Btn>
          <Btn primary onClick={submit}>{approvers.length ? `Request approval (${approvers.length})` : 'Execute now'}</Btn>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <KV
          rows={[
            ['Target', <b key="t">{wb.target}</b>],
            ['System', wb.system],
            ['Risk class', <Badge key="r" color={RISK_COLOR[wb.risk]} solid={wb.risk === 'high'}>{wb.risk.toUpperCase()}</Badge>],
            ['Approvals', approvers.length ? `${approvers.length} required: ${approvers.join(', ')}` : 'None (low risk, logged to the audit ledger)'],
            ['Rollback', wb.rollback ?? 'Automatic rollback available for 24 h'],
          ]}
        />
        <div>
          <div className="section-label">What will change</div>
          <ul className="soc-changes">
            {wb.changes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="section-label" style={{ margin: 0 }}>Justification</span>
          <textarea className="input" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why is this action needed? (recorded in the audit ledger)" />
        </label>
        <Callout kind={wb.risk === 'high' ? 'warn' : 'info'}>
          {wb.risk === 'high' ? (
            <>
              <b>High-risk action.</b> Requires two approvers including the Tenant Admin. HexaSOC agents never execute this on their own.
            </>
          ) : (
            <>Every write-back is signed, time-stamped and anchored in the HexaView audit ledger.</>
          )}
        </Callout>
      </div>
    </Modal>
  );
}

export function TechChips({ ids, max = 4, highlight }: { ids: string[]; max?: number; highlight?: Set<string> }) {
  return (
    <span className="chips">
      {ids.slice(0, max).map((t) => (
        <span key={t} className={`soc-tech ${highlight?.has(t) ? 'on' : ''}`} title={techName(t)}>
          {t}
        </span>
      ))}
      {ids.length > max && <span className="muted" style={{ fontSize: 11 }}>+{ids.length - max}</span>}
    </span>
  );
}

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { toast } = useApp();
  return (
    <div className="soc-code">
      <div className="soc-code-head">
        <span>{lang}</span>
        <button
          className="link"
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(code);
            } catch {
              /* clipboard unavailable */
            }
            toast('Query copied to clipboard');
          }}
        >
          <Copy size={12} /> Copy
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}

/** Countdown bar for a regulatory clock. */
export function ClockBar({ name, regulator, basis, deadlineMin, elapsedMin, filed }: { name: string; regulator: string; basis: string; deadlineMin: number; elapsedMin: number; filed: boolean }) {
  const pct = Math.min(100, (elapsedMin / deadlineMin) * 100);
  const left = deadlineMin - elapsedMin;
  const color = filed ? 'var(--good)' : left < 0 ? 'var(--bad)' : pct > 70 ? 'var(--sev-high)' : pct > 40 ? 'var(--sev-medium)' : 'var(--m-soc)';
  return (
    <div className="soc-clock">
      <div className="row between" style={{ gap: 8 }}>
        <b>{name}</b>
        <span className="num" style={{ color, fontWeight: 700, fontSize: 12 }}>
          {filed ? 'Filed' : left < 0 ? `Overdue ${fmtDur(-left)}` : `${fmtDur(left)} left`}
        </span>
      </div>
      <div className="soc-clock-bar">
        <i style={{ width: `${filed ? 100 : Math.max(2, pct)}%`, background: color }} />
      </div>
      <div className="t-sub muted" style={{ fontSize: 11 }}>
        {regulator} · {basis} · deadline {fmtDur(deadlineMin)}
      </div>
    </div>
  );
}

export function OtReadOnly({ children }: { children?: ReactNode }) {
  return (
    <Callout kind="warn">
      <b>OT is read-only by policy.</b> {children ?? 'HexaView never sends commands to OT systems; containment is carried out by site engineers following the OT playbook.'}
    </Callout>
  );
}

export function ScopeNote({ text }: { text: ReactNode }) {
  return (
    <span className="soc-scope">
      <ShieldAlert size={12} /> {text}
    </span>
  );
}

export const INC_STATUS_COLOR: Record<string, string> = {
  new: 'var(--sev-critical)',
  triage: 'var(--sev-high)',
  investigating: 'var(--sev-medium)',
  containing: 'var(--m-soc)',
  recovering: 'var(--accent)',
  closed: 'var(--good)',
};

/* ---------------- Phase 2 shared pieces ---------------- */
type ToneStyle = CSSProperties & { '--tone'?: string };

/** Icon stat tile (original HexaView style). Clickable when onClick or to is set. */
export function StatTile({ icon, value, unit, label, bar, tone, onClick, to, source }: { icon: ReactNode; value: ReactNode; unit?: ReactNode; label: ReactNode; bar?: number; tone?: string; onClick?: () => void; to?: string; source?: string }) {
  const nav = useNavigate();
  const click = onClick ?? (to ? () => nav(to) : undefined);
  const Tag = click ? 'button' : 'div';
  return (
    <Tag className="soc-stat" onClick={click} style={tone ? ({ '--tone': tone } as ToneStyle) : undefined} title={source ? `Source: ${source}${click ? ' · click to open' : ''}` : undefined}>
      <span className="soc-stat-ico">{icon}</span>
      <span className="soc-stat-body">
        <span className="soc-stat-val">{value}{unit && <small>{unit}</small>}</span>
        <span className="soc-stat-lbl">{label}</span>
        {bar !== undefined && <span className="soc-stat-bar"><i style={{ width: `${Math.max(2, Math.min(100, bar))}%` }} /></span>}
      </span>
    </Tag>
  );
}

/** Filter pills with counts; highlights the active one. */
export function Pills<T extends string>({ label, items, value, onChange, tone }: { label?: string; items: { id: T; label: ReactNode; n?: number; dashed?: boolean; dot?: ReactNode }[]; value: T; onChange: (v: T) => void; tone?: string }) {
  return (
    <span className="soc-pills" style={tone ? ({ '--tone': tone } as ToneStyle) : undefined}>
      {label && <span className="soc-pills-label">{label}</span>}
      {items.map((it) => (
        <button key={it.id} type="button" className={`soc-pill ${value === it.id ? 'on' : ''} ${it.dashed ? 'dashed' : ''}`} onClick={() => onChange(it.id)}>
          {it.dot}
          {it.label}
          {it.n !== undefined && <span className="n">{it.n.toLocaleString('en-GB')}</span>}
        </button>
      ))}
    </span>
  );
}

/** Segmented bar with crisp HTML labels and a clickable legend. */
export function SegBar({ parts, onPick }: { parts: { id: string; label: string; value: number; color: string }[]; onPick?: (id: string) => void }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="soc-seg">
        {parts.filter((p) => p.value > 0).map((p) => {
          const pct = (p.value / total) * 100;
          return (
            <button key={p.id} type="button" style={{ width: `${pct}%`, background: p.color }} onClick={() => onPick?.(p.id)} title={`${p.label}: ${p.value.toLocaleString('en-GB')} (${Math.round(pct)}%)`}>
              {pct >= 9 ? `${Math.round(pct)}%` : ''}
            </button>
          );
        })}
      </div>
      <div className="soc-seg-legend">
        {parts.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick?.(p.id)}>
            <i style={{ background: p.color }} />
            {p.label} <b>{p.value.toLocaleString('en-GB')}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Ranked list with HTML bars (no chart text over marks). */
export function RankList({ rows, tone, onPick }: { rows: { id: string; label: ReactNode; sub?: ReactNode; value: number; display?: ReactNode }[]; tone?: string; onPick?: (id: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="soc-rank" style={tone ? ({ '--tone': tone } as ToneStyle) : undefined}>
      {rows.map((r, i) => (
        <button key={r.id} type="button" className="soc-rank-row" onClick={() => onPick?.(r.id)}>
          <span className="ix">{String(i + 1).padStart(2, '0')}</span>
          <span className="nm">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="bar"><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="v">{r.display ?? r.value.toLocaleString('en-GB')}</span>
        </button>
      ))}
    </div>
  );
}

export interface RecordRow {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}
/** Drawer listing the records behind a headline number, with the source connector. */
export function RecordsDrawer({ title, sub, source, rows, onClose, icon, footer, children }: { title: ReactNode; sub?: ReactNode; source: string; rows: RecordRow[]; onClose: () => void; icon?: ReactNode; footer?: ReactNode; children?: ReactNode }) {
  return (
    <Drawer title={title} sub={sub ?? `${rows.length.toLocaleString('en-GB')} records`} icon={icon ? <IcoBox color="var(--m-soc)">{icon}</IcoBox> : undefined} onClose={onClose} footer={footer}>
      <div className="stack" style={{ gap: 12 }}>
        <span className="src-chip" style={{ alignSelf: 'flex-start' }}>Source: {source}</span>
        {children}
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className={`list-row ${r.onClick ? 'clickable' : ''}`} onClick={r.onClick} style={r.onClick ? { cursor: 'pointer' } : undefined}>
              <span className="list-main">
                <b>{r.title}</b>
                {r.sub && <span>{r.sub}</span>}
              </span>
              {r.right}
            </div>
          ))}
          {rows.length === 0 && <div className="empty">No records in this scope.</div>}
        </div>
      </div>
    </Drawer>
  );
}

/** Read a query-string filter once, with an allowed set and a fallback. */
export function useParamFilter<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const [sp, setSp] = useSearchParams();
  const raw = sp.get(key) as T | null;
  const value = raw && allowed.includes(raw) ? raw : fallback;
  const set = (v: T) => {
    const next = new URLSearchParams(sp);
    if (v === fallback) next.delete(key);
    else next.set(key, v);
    setSp(next, { replace: true });
  };
  return [value, set];
}

export const AV_COLORS = ['#4f8cff', '#2dd4bf', '#a07cfb', '#f5a83d', '#ef6aae', '#93d65a', '#f8646f', '#68b1ff'];
export function initials(name: string): string {
  return name.replace(/^Dr\.\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}
