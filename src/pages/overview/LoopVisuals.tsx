import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Filter } from 'lucide-react';
import type { Loop, LoopStatus } from '../../data/core';

export interface GapRow {
  id: string;
  short: string;
  documented: number;
  assured: number;
  loops: number;
}

/** Plays a one-off grow-in animation on mount and whenever `key` changes. */
function useGrow(key: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const t = setTimeout(() => setOn(true), 40);
    return () => clearTimeout(t);
  }, [key]);
  return on;
}

/**
 * Documented vs assured as a gap chart: for each framework, how far the
 * paperwork (documented) is ahead of what is proven by closed loops (assured).
 */
export function AssuranceGap({ rows, active, onFilter, onOpenFramework }: {
  rows: GapRow[];
  active: string;
  onFilter: (short: string) => void;
  onOpenFramework: (id: string) => void;
}) {
  const grow = useGrow(rows.map((r) => r.id + r.assured).join());
  const avgGap = Math.round(rows.reduce((s, r) => s + (r.documented - r.assured), 0) / Math.max(1, rows.length));
  const worst = [...rows].sort((a, b) => b.documented - b.assured - (a.documented - a.assured))[0];
  const best = [...rows].sort((a, b) => b.assured - a.assured)[0];
  return (
    <div className="ag">
      <div className="ag-summary">
        <div><span>Average gap</span><b className="bad">{avgGap} pts</b></div>
        {worst && <button onClick={() => onFilter(worst.short)}><span>Widest gap</span><b>{worst.short} · {worst.documented - worst.assured} pts</b></button>}
        {best && <button onClick={() => onFilter(best.short)}><span>Most assured</span><b className="good">{best.short} · {best.assured}%</b></button>}
      </div>
      <div className="ag-scale"><span /><span className="ag-scale-track">{[0, 25, 50, 75, 100].map((v) => <i key={v} style={{ left: `${v}%` }}>{v}{v === 100 ? "%" : ""}</i>)}</span><span /></div>
      <div className="ag-rows">
        {rows.map((r, i) => {
          const gap = r.documented - r.assured;
          return (
            <div key={r.id} className={`ag-row ${active === r.short ? 'on' : ''}`} style={{ '--d': `${grow ? r.documented : 0}%`, '--a': `${grow ? r.assured : 0}%`, '--delay': `${i * 60}ms` } as CSSProperties}>
              <button
                className="ag-main"
                onClick={() => (r.loops ? onFilter(r.short) : onOpenFramework(r.id))}
                title={r.loops
                  ? `${r.short}: ${r.documented}% documented, ${r.assured}% assured by ${r.loops} loops. Click to filter the loop register.`
                  : `${r.short}: ${r.documented}% documented, ${r.assured}% assured. No loops traced yet; click to open its controls in HexaComply.`}
              >
                <b className="ag-name">{r.short}{!r.loops && <small className="ag-noloops">no loops</small>}</b>
                <span className="ag-track">
                  <i className="ag-gap" />
                  <i className="ag-dot doc"><em>{r.documented}</em></i>
                  <i className="ag-dot ass"><em>{r.assured}</em></i>
                </span>
                <span className={`ag-delta ${gap >= 20 ? 'hi' : ''}`}>−{gap}</span>
              </button>
              <button className="ag-open" onClick={() => onOpenFramework(r.id)} title={`Open ${r.short} controls in HexaComply`} aria-label={`Open ${r.short} in HexaComply`}>
                <ArrowUpRight size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="ag-legend">
        <span><i className="doc" /> Documented</span>
        <span><i className="ass" /> Assured (loop-proven)</span>
        <span><i className="gapk" /> Assurance gap</span>
        <span className="muted">Click a row to filter loops · <ArrowUpRight size={11} /> opens HexaComply</span>
      </div>
    </div>
  );
}

/** Loop status per tenant or framework as clickable segments with counts. */
export function StatusBars({ dims, loopsFor, order, colors, labels, activeDim, activeStatus, onPick }: {
  dims: { key: string; label: string }[];
  loopsFor: (key: string) => Loop[];
  order: LoopStatus[];
  colors: Record<LoopStatus, string>;
  labels: Record<LoopStatus, string>;
  activeDim: string;
  activeStatus: LoopStatus | 'all';
  onPick: (dim: string | null, status: LoopStatus | null) => void;
}) {
  const grow = useGrow(dims.map((d) => d.key).join());
  const max = Math.max(1, ...dims.map((d) => loopsFor(d.key).length));
  const totals = order.map((s) => dims.reduce((n, d) => n + loopsFor(d.key).filter((l) => l.status === s).length, 0));
  const all = totals.reduce((a, b) => a + b, 0);
  return (
    <div className="sb2">
      <div className="sb2-totals">
        {order.map((s, i) => (
          <button key={s} className={`sb2-total ${activeStatus === s ? 'on' : ''}`} style={{ '--c': colors[s] } as CSSProperties} onClick={() => onPick(null, s)}>
            <b>{totals[i]}</b>
            <span><i /> {labels[s]}</span>
            <em>{all ? Math.round((totals[i] / all) * 100) : 0}%</em>
          </button>
        ))}
      </div>
      <div className="sb2-rows">
        {dims.map((d, ri) => {
          const ls = loopsFor(d.key);
          const closed = ls.filter((l) => l.status === 'closed').length;
          const applicable = ls.filter((l) => l.status !== 'not_applicable').length;
          const pct = applicable ? Math.round((closed / applicable) * 100) : 0;
          return (
            <div key={d.key} className={`sb2-row ${activeDim === d.key ? 'on' : ''}`}>
              <button className="sb2-label" onClick={() => onPick(d.key, null)} title={`Filter loops to ${d.label}`}>{d.label}</button>
              <div className="sb2-bar" style={{ width: grow ? `${(ls.length / max) * 100}%` : '0%', transitionDelay: `${ri * 70}ms` }}>
                {order.map((s) => {
                  const n = ls.filter((l) => l.status === s).length;
                  if (!n) return null;
                  return (
                    <button
                      key={s}
                      className={`sb2-seg ${activeDim === d.key && activeStatus === s ? 'on' : ''}`}
                      style={{ flex: n, background: colors[s] }}
                      onClick={() => onPick(d.key, s)}
                      title={`${d.label} · ${labels[s]}: ${n} loop${n === 1 ? '' : 's'}. Click to filter.`}
                    >
                      {n >= 2 ? n : ''}
                    </button>
                  );
                })}
              </div>
              <span className="sb2-pct" title={`${closed} of ${applicable} applicable loops closed`}>
                <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
                  <circle cx="13" cy="13" r="10" fill="none" stroke="var(--track)" strokeWidth="3" />
                  <circle cx="13" cy="13" r="10" fill="none" stroke={colors.closed} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(grow ? pct : 0) * 0.628} 62.8`} transform="rotate(-90 13 13)" style={{ transition: 'stroke-dasharray .9s ease' }} />
                </svg>
                <b>{pct}%</b>
              </span>
            </div>
          );
        })}
      </div>
      <div className="sb2-hint"><Filter size={11} /> Click a segment, label or total to filter the loop register below</div>
    </div>
  );
}
