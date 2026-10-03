import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, Callout, KV, Sources } from '../../components/ui';
import { Drawer, Modal } from '../../components/Overlay';
import { DataTable, type Column } from '../../components/DataTable';
import { useApp } from '../../state/AppContext';
import { SEV_HEX } from '../../components/Chart';
import type { Finding } from '../../data/modules/strike';
import type { Severity } from '../../data/types';

export const RISK_CLASS_COLOR = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--bad)' } as const;
export type RiskClass = keyof typeof RISK_CLASS_COLOR;

export function WriteBack({
  title, sub, change, risk, approvers, confirmLabel, onDone, onClose,
}: {
  title: string; sub?: string; change: [ReactNode, ReactNode][]; risk: RiskClass; approvers: number; confirmLabel: string; onDone: string; onClose: () => void;
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
          <Btn primary color={RISK_CLASS_COLOR[risk]} disabled={sent} onClick={() => { setSent(true); toast(onDone); setTimeout(onClose, 350); }}>{confirmLabel}</Btn>
        </>
      }
    >
      <Callout kind={risk === 'low' ? 'info' : 'warn'} color={RISK_CLASS_COLOR[risk]}>
        <b>{risk === 'high' ? 'High-risk action' : risk === 'medium' ? 'Medium-risk action' : 'Low-risk action'}</b> · requires {approvers} approver{approvers > 1 ? 's' : ''} and is written to the HexaCore audit ledger.
      </Callout>
      <div style={{ marginTop: 12 }}><KV rows={change} /></div>
    </Modal>
  );
}

const SEV_LEVEL: Record<Severity, string> = SEV_HEX as unknown as Record<Severity, string>;

/** Likelihood × impact risk matrix with finding chips (v2-style). */
export function RiskMatrix({ findings, onPick }: { findings: Finding[]; onPick: (f: Finding) => void }) {
  // cell[impact][likelihood], impact rows top (5) to bottom (1)
  const cellColor = (l: number, i: number): string => {
    const score = l * i;
    if (score >= 16) return 'color-mix(in srgb, var(--sev-critical) 24%, transparent)';
    if (score >= 10) return 'color-mix(in srgb, var(--sev-high) 20%, transparent)';
    if (score >= 5) return 'color-mix(in srgb, var(--sev-medium) 16%, transparent)';
    return 'color-mix(in srgb, var(--good) 12%, transparent)';
  };
  const rows = [5, 4, 3, 2, 1];
  const cols = [1, 2, 3, 4, 5];
  return (
    <div>
      <div className="strike-matrix">
        <div />
        {cols.map((c) => <div key={`cx${c}`} className="strike-axis-x">{c}</div>)}
        {rows.map((imp) => (
          <div key={`r${imp}`} style={{ display: 'contents' }}>
            <div className="strike-axis-y">{imp}</div>
            {cols.map((lik) => {
              const inCell = findings.filter((f) => f.impact === imp && f.likelihood === lik);
              return (
                <div key={`c${imp}-${lik}`} className="strike-cell" style={{ background: cellColor(lik, imp) }}>
                  {inCell.slice(0, 6).map((f) => (
                    <button key={f.id} className="strike-chip-f" style={{ background: SEV_LEVEL[f.sev] }} title={f.title} onClick={() => onPick(f)}>
                      {f.id.replace('PT-', '')}
                    </button>
                  ))}
                  {inCell.length > 6 && <span className="muted" style={{ fontSize: 9.5 }}>+{inCell.length - 6}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row between" style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>
        <span>Impact ▲</span>
        <span>Likelihood ▶</span>
      </div>
    </div>
  );
}

/* ---------------- headline pivots ---------------- */

/** A filter value that lives in the URL so KPIs can link straight to a filtered table. */
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

/** Drawer listing the records behind a headline number, with the tools they came from. */
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
          {openTo && <Btn primary color="var(--m-strike)" onClick={() => { onClose(); nav(openTo); }}>{openLabel ?? 'Open full view'}</Btn>}
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
