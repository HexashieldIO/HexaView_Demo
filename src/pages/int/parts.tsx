import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Btn, Callout, KV, Ring, Sources } from '../../components/ui';
import type { ExposedCred } from '../../data/modules/int';
import { Drawer, Modal } from '../../components/Overlay';
import { DataTable, type Column } from '../../components/DataTable';
import { useApp } from '../../state/AppContext';

export const RISK_CLASS_COLOR = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--bad)' } as const;
export type RiskClass = keyof typeof RISK_CLASS_COLOR;

/** A write-back confirmation modal following LLD 8.2: shows change, risk class and approvals. */
export function WriteBack({
  title, sub, change, risk, approvers, confirmLabel, onDone, onClose,
}: {
  title: string;
  sub?: string;
  change: [ReactNode, ReactNode][];
  risk: RiskClass;
  approvers: number;
  confirmLabel: string;
  onDone: string;
  onClose: () => void;
}) {
  const { toast } = useApp();
  const [sent, setSent] = useState(false);
  return (
    <Modal
      title={title}
      sub={sub}
      onClose={onClose}
      footer={
        <>
          <Btn ghost onClick={onClose}>Cancel</Btn>
          <Btn
            primary
            color={RISK_CLASS_COLOR[risk]}
            disabled={sent}
            onClick={() => {
              setSent(true);
              toast(onDone);
              setTimeout(onClose, 350);
            }}
          >
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <Callout kind={risk === 'low' ? 'info' : 'warn'} color={RISK_CLASS_COLOR[risk]}>
        <b>{risk === 'high' ? 'High-risk action' : risk === 'medium' ? 'Medium-risk action' : 'Low-risk action'}</b> · requires {approvers} approver{approvers > 1 ? 's' : ''} and is written to the HexaCore audit ledger. The underlying tool stays the system of record.
      </Callout>
      <div style={{ marginTop: 12 }}>
        <KV rows={change} />
      </div>
    </Modal>
  );
}

/* ---------------- URL-backed filters (headlines pivot here) ---------------- */

/** A filter value that lives in the URL, so KPIs elsewhere can link straight to a filtered view. */
export function useParamFilter(key: string, fallback = 'All'): [string, (v: string) => void] {
  const [sp, setSp] = useSearchParams();
  const value = sp.get(key) ?? fallback;
  const set = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === fallback) next.delete(key);
    else next.set(key, v);
    setSp(next, { replace: true });
  };
  return [value, set];
}

/** Original-style chip group: LABEL  [All] [A] [B] … */
export function FilterGroup({ label, value, options, onChange, counts }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; counts?: Record<string, number> }) {
  return (
    <div className="int-fgroup">
      <span className="int-flabel">{label}</span>
      {['All', ...options].map((o) => (
        <button key={o} type="button" className={`int-fchip ${value === o ? 'on' : ''}`} onClick={() => onChange(o)}>
          {o}
          {counts && o !== 'All' && counts[o] !== undefined && <em>{counts[o]}</em>}
        </button>
      ))}
    </div>
  );
}

/** Horizontal bar list in the v2 style: label + sub on the left, a thin bar and the number on the right. */
export function HBarList({ rows, color = 'var(--m-int)', onPick, max }: { rows: { key: string; label: ReactNode; sub?: ReactNode; n: number }[]; color?: string; onPick?: (key: string) => void; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="int-hbars">
      {rows.map((r) => {
        const Tag = onPick ? 'button' : 'div';
        return (
          <Tag key={r.key} type={onPick ? 'button' : undefined} className={`int-hbar ${onPick ? 'click' : ''}`} onClick={onPick ? () => onPick(r.key) : undefined} title={onPick ? 'Open the records behind this number' : undefined}>
            <span className="int-hbar-l">
              <b>{r.label}</b>
              {r.sub && <small>{r.sub}</small>}
            </span>
            <span className="int-hbar-t"><i style={{ width: `${Math.max(3, (r.n / top) * 100)}%`, background: color }} /></span>
            <span className="int-hbar-n">{r.n.toLocaleString('en-GB')}</span>
          </Tag>
        );
      })}
    </div>
  );
}

/** "What each source is holding" ring tile. */
export function RingTile({ value, max, title, hot, hotLabel, detail, to, source, color = 'var(--m-int)' }: { value: number; max: number; title: string; hot: number; hotLabel: string; detail: string; to: string; source: string; color?: string }) {
  const nav = useNavigate();
  return (
    <button type="button" className="int-ringtile" onClick={() => nav(to)} title={`Source: ${source} · click to open`}>
      <Ring value={value} max={Math.max(1, max)} size={50} stroke={5} color={color}>
        <span style={{ fontSize: 14 }}>{value.toLocaleString('en-GB')}</span>
      </Ring>
      <span className="int-ringtile-b">
        <b>{title}</b>
        <span><em style={{ color }}>{hot.toLocaleString('en-GB')}</em> {hotLabel}</span>
        <small>{detail}</small>
      </span>
    </button>
  );
}

/** Small stat with a big number that opens its records. */
export function StatLink({ value, label, color, onClick, title }: { value: ReactNode; label: ReactNode; color?: string; onClick: () => void; title?: string }) {
  return (
    <button type="button" className="int-statlink" onClick={onClick} title={title ?? 'Open the records behind this number'}>
      <b style={color ? { color } : undefined}>{value}</b>
      <span>{label}</span>
    </button>
  );
}

/** Drawer that lists the records behind a headline number, with where they came from. */
export function RecordsDrawer<T>({ title, sub, rows, columns, source, onClose, onRow, openLabel, openTo }: {
  title: string; sub?: string; rows: T[]; columns: Column<T>[]; source: string[]; onClose: () => void; onRow?: (r: T) => void; openLabel?: string; openTo?: string;
}) {
  const nav = useNavigate();
  return (
    <Drawer
      wide
      title={title}
      sub={sub ?? `${rows.length.toLocaleString('en-GB')} record${rows.length === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <>
          <Btn ghost onClick={onClose}>Close</Btn>
          {openTo && <Btn primary color="var(--m-int)" onClick={() => { onClose(); nav(openTo); }}>{openLabel ?? 'Open full view'}</Btn>}
        </>
      }
    >
      <div style={{ marginBottom: 10 }}>
        <Sources items={source.map((name) => ({ name }))} />
      </div>
      <div className="card flush" style={{ boxShadow: 'none' }}>
        <DataTable rows={rows} columns={columns} onRowClick={onRow} pageSize={15} />
      </div>
    </Drawer>
  );
}

/** Small coloured dot + label used in tables. */
export function Dot({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="src-chip" style={style}>
      <i style={{ background: color }} />
      {children}
    </span>
  );
}

/** Masked password cell (the source is asked for masked values; nothing is stored). */
export function Masked() {
  return <span className="int-mask">•••••••• <small>masked</small></span>;
}

/** Columns for credential record drawers. */
export const CRED_COLUMNS: Column<ExposedCred>[] = [
  { key: 'acc', header: 'Account', sort: (k) => k.account, render: (k) => (<><div className="t-main">{k.account}</div><div className="t-sub">{k.machine ?? 'From a credential list, no machine'}</div></>) },
  { key: 'used', header: 'Used on', sort: (k) => k.usedOn, render: (k) => k.usedOn },
  { key: 'pw', header: 'Password', render: () => <Masked /> },
  { key: 'src', header: 'Source', sort: (k) => k.source, render: (k) => <Badge color={k.source === 'Infostealer' ? 'var(--bad)' : 'var(--sev-medium)'}>{k.source}</Badge> },
  { key: 'found', header: 'Found', align: 'right', sort: (k) => -k.foundDays, render: (k) => <span className="muted">{k.foundDays === 0 ? 'today' : `${k.foundDays}d ago`}</span> },
];


/** Patch several URL filters at once (null removes a key). */
export function useParamPatch(): (patch: Record<string, string | null>) => void {
  const [sp, setSp] = useSearchParams();
  return (patch) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSp(next, { replace: true });
  };
}
