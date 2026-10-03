// Crisp HTML visuals in the original HexaView style, shared by the insurance and
// fabric pages: diverging bar lists, labelled bar rows, segmented bars with
// counts inside, ring + legend blocks, clickable stat blocks, a marker scale
// that never lets labels overlap, and a generic records drawer.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Ring, Sources } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import type { Health } from '../../data/types';
import './viz.css';

/* ---------------- Diverging bar list ---------------- */
export interface DivRow { label: ReactNode; sub?: ReactNode; value: number; color?: string; onClick?: () => void; tag?: ReactNode }
export function DivergingBars({ rows, total, format = (v) => `${v > 0 ? '+' : ''}${v}`, negColor = 'var(--good)', posColor = 'var(--bad)', negLabel, posLabel }: {
  rows: DivRow[]; total?: { label: ReactNode; value: number; color?: string }; format?: (v: number) => string;
  negColor?: string; posColor?: string; negLabel?: ReactNode; posLabel?: ReactNode;
}) {
  const max = Math.max(0.0001, ...rows.map((r) => Math.abs(r.value)), total ? Math.abs(total.value) : 0);
  const line = (r: DivRow, key: string | number, isTotal?: boolean) => {
    const pct = (Math.abs(r.value) / max) * 100;
    const col = r.color ?? (r.value < 0 ? negColor : posColor);
    const Tag = r.onClick ? 'button' : 'div';
    const val = <span className="ins-div-val" style={{ color: col }}>{format(r.value)}</span>;
    return (
      <Tag key={key} className={`ins-div-row ${isTotal ? 'total' : ''} ${r.onClick ? 'click' : ''}`} onClick={r.onClick} type={r.onClick ? 'button' : undefined}>
        <span className="ins-div-label">
          <b>{r.label}</b>
          {r.sub && <span>{r.sub}</span>}
        </span>
        <span className="ins-div-half neg">
          {r.value < 0 && <>{val}<i style={{ width: `calc((100% - 46px) * ${(pct / 100).toFixed(4)})`, background: col }} /></>}
        </span>
        <span className="ins-div-half pos">
          {r.value >= 0 && <><i style={{ width: `calc((100% - 46px) * ${(pct / 100).toFixed(4)})`, background: col }} />{val}</>}
        </span>
        <span className="ins-div-tag">{r.tag}</span>
      </Tag>
    );
  };
  return (
    <div className="ins-div">
      {(negLabel || posLabel) && (
        <div className="ins-div-row head">
          <span />
          <span className="ins-div-half neg"><em>{negLabel}</em></span>
          <span className="ins-div-half pos"><em>{posLabel}</em></span>
          <span />
        </div>
      )}
      {rows.map((r, i) => line(r, i))}
      {total && line({ label: total.label, value: total.value, color: total.color }, 'total', true)}
    </div>
  );
}

/* ---------------- Labelled bar rows (value outside the bar) ---------------- */
export interface BarItem { label: ReactNode; sub?: ReactNode; value: number; display?: ReactNode; color?: string; onClick?: () => void }
export function BarList({ items, max, color = 'var(--accent)', labelWidth = 170 }: { items: BarItem[]; max?: number; color?: string; labelWidth?: number }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="ins-bl" style={{ ['--lw' as string]: `${labelWidth}px` }}>
      {items.map((it, i) => {
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag key={i} className={`ins-bl-row ${it.onClick ? 'click' : ''}`} onClick={it.onClick} type={it.onClick ? 'button' : undefined}>
            <span className="ins-bl-label"><b>{it.label}</b>{it.sub && <span>{it.sub}</span>}</span>
            <span className="ins-bl-track"><i style={{ width: `${Math.max(1.5, (it.value / m) * 100)}%`, background: it.color ?? color }} /></span>
            <span className="ins-bl-val">{it.display ?? it.value}</span>
          </Tag>
        );
      })}
    </div>
  );
}

/* ---------------- Segmented bar rows (numbers inside, like the original) ---------------- */
export interface SegPart { value: number; color: string; label: string }
export function SegRows({ rows, legend, max, showTotal = true, format = (v) => String(v), labelWidth = 150 }: {
  rows: { label: ReactNode; sub?: ReactNode; parts: SegPart[]; onClick?: () => void; total?: ReactNode }[];
  legend?: boolean; max?: number; showTotal?: boolean; format?: (v: number) => string; labelWidth?: number;
}) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.parts.reduce((s, p) => s + p.value, 0)));
  const keys = rows[0]?.parts.map((p) => ({ label: p.label, color: p.color })) ?? [];
  return (
    <div className="ins-seg" style={{ ['--lw' as string]: `${labelWidth}px` }}>
      {rows.map((r, i) => {
        const tot = r.parts.reduce((s, p) => s + p.value, 0);
        const Tag = r.onClick ? 'button' : 'div';
        return (
          <Tag key={i} className={`ins-seg-row ${r.onClick ? 'click' : ''}`} onClick={r.onClick} type={r.onClick ? 'button' : undefined}>
            <span className="ins-seg-label"><b>{r.label}</b>{r.sub && <span>{r.sub}</span>}</span>
            <span className="ins-seg-track">
              <span className="ins-seg-fill" style={{ width: `${Math.max(2, (tot / m) * 100)}%` }}>
                {r.parts.filter((p) => p.value > 0).map((p, j) => {
                  const share = p.value / Math.max(1e-9, tot);
                  const wide = share * (tot / m) > 0.13;
                  return (
                    <i key={j} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${format(p.value)}`}>
                      {wide ? format(p.value) : ''}
                    </i>
                  );
                })}
              </span>
            </span>
            {showTotal && <span className="ins-seg-tot">{r.total ?? format(tot)}</span>}
          </Tag>
        );
      })}
      {legend && (
        <div className="ins-seg-legend">
          {keys.map((k) => <span key={k.label}><i style={{ background: k.color }} />{k.label}</span>)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Ring with legend rows (original framework card) ---------------- */
export function RingLegend({ value, max = 100, center, centerSub, color, rows, size = 120 }: {
  value: number; max?: number; center: ReactNode; centerSub?: ReactNode; color: string; size?: number;
  rows: { label: ReactNode; value: ReactNode; color?: string; onClick?: () => void }[];
}) {
  return (
    <div className="ins-rl">
      <Ring value={value} max={max} size={size} stroke={11} color={color}>
        <span className="ins-rl-c">{center}{centerSub && <small>{centerSub}</small>}</span>
      </Ring>
      <div className="ins-rl-rows">
        {rows.map((r, i) => {
          const Tag = r.onClick ? 'button' : 'div';
          return (
            <Tag key={i} className={`ins-rl-row ${r.onClick ? 'click' : ''}`} onClick={r.onClick} type={r.onClick ? 'button' : undefined}>
              <span>{r.color && <i style={{ background: r.color }} />}{r.label}</span>
              <b>{r.value}</b>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Clickable stat block ---------------- */
export function Stat({ value, label, sub, color, onClick, source }: { value: ReactNode; label: ReactNode; sub?: ReactNode; color?: string; onClick?: () => void; source?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`ins-stat ${onClick ? 'click' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined} title={source ? `Source: ${source}${onClick ? ' · click to open' : ''}` : undefined}>
      <b style={color ? { color } : undefined}>{value}</b>
      <span>{label}</span>
      {sub && <em>{sub}</em>}
      {onClick && <ArrowRight size={12} className="ins-stat-go" />}
    </Tag>
  );
}

/* ---------------- Marker scale: labelled lines that never overlap ---------------- */
export interface Marker { value: number; label: string; detail?: string; color: string; dash?: boolean; onClick?: () => void }
/** Horizontal log or linear scale with marker lines; labels are laid out in lanes so they never collide. */
export function MarkerScale({ markers, min, max, log = true, format, band }: {
  markers: Marker[]; min: number; max: number; log?: boolean; format: (v: number) => string;
  band?: { from: number; to: number; color: string; label: string };
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [lanes, setLanes] = useState<number[]>([]);
  const [lefts, setLefts] = useState<number[]>([]);
  const pos = (v: number) => {
    const t = log ? (Math.log(Math.max(v, min)) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min);
    return Math.max(0, Math.min(1, t)) * 100;
  };
  const sorted = markers.map((m, i) => ({ ...m, i, p: pos(m.value) })).sort((a, b) => a.p - b.p);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const compute = () => {
      const w = el.getBoundingClientRect().width;
      const ends: number[] = [];
      const out: number[] = [];
      const ls: number[] = [];
      el.querySelectorAll<HTMLElement>('[data-mk]').forEach((n) => {
        const idx = Number(n.dataset.mk);
        const m = sorted[idx];
        const width = n.getBoundingClientRect().width;
        const x = (m.p / 100) * w;
        const left = Math.min(Math.max(0, x - 6), w - width);
        let lane = 0;
        while (ends[lane] !== undefined && ends[lane] > left - 8) lane++;
        ends[lane] = left + width;
        out[idx] = lane;
        ls[idx] = left;
      });
      setLanes(out);
      setLefts(ls);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers.map((m) => `${m.label}${m.value}`).join('|'), min, max]);
  const laneCount = Math.max(1, ...lanes.map((l) => l + 1));
  const rawTicks = log ? [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000] : [(min + max) / 2];
  const ticks = [min];
  for (const t of rawTicks) {
    if (t <= min || t >= max) continue;
    if (pos(t) - pos(ticks[ticks.length - 1]) >= 9 && pos(max) - pos(t) >= 9) ticks.push(t);
  }
  ticks.push(max);
  return (
    <div className="ins-ms" ref={wrap}>
      <div className="ins-ms-labels" style={{ height: laneCount * 34 }}>
        {sorted.map((m, idx) => {
          const Tag = m.onClick ? 'button' : 'div';
          return (
            <Tag key={m.i} data-mk={idx} type={m.onClick ? 'button' : undefined} onClick={m.onClick} className={`ins-ms-label ${m.onClick ? 'click' : ''}`}
              style={{ left: lefts[idx] !== undefined ? lefts[idx] : `calc(${m.p}% - 6px)`, bottom: (lanes[idx] ?? 0) * 34, borderColor: m.color, ['--mk' as string]: m.color, visibility: lanes.length ? 'visible' : 'hidden' }}>
              <b>{m.label}</b>
              {m.detail && <span>{m.detail}</span>}
            </Tag>
          );
        })}
      </div>
      <div className="ins-ms-axis">
        {band && <span className="ins-ms-band" style={{ left: `${pos(band.from)}%`, width: `${pos(band.to) - pos(band.from)}%`, background: band.color }} title={band.label} />}
        {sorted.map((m) => <i key={m.i} className={m.dash ? 'dash' : ''} style={{ left: `${m.p}%`, borderColor: m.color }} />)}
      </div>
      <div className="ins-ms-ticks">
        {ticks.map((t, i) => <span key={i} style={{ left: `${pos(t)}%` }}>{format(t)}</span>)}
      </div>
    </div>
  );
}

/* ---------------- Records drawer (the data behind a headline) ---------------- */
export interface RecordRow { key: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; badge?: ReactNode; onClick?: () => void }
export function RecordsDrawer({ title, sub, source, sources, rows, onClose, footer, children }: {
  title: ReactNode; sub?: ReactNode; source?: string; sources?: { name: string; status?: Health }[]; rows: RecordRow[]; onClose: () => void; footer?: ReactNode; children?: ReactNode;
}) {
  return (
    <Drawer title={title} sub={sub} onClose={onClose} footer={footer} wide>
      {(source || sources) && (
        <div className="ins-rd-src">
          <span className="section-label" style={{ margin: 0 }}>Source</span>
          {sources ? <Sources items={sources} /> : <span className="secondary" style={{ fontSize: 12 }}>{source}</span>}
        </div>
      )}
      {children}
      <div className="ins-rd-count">{rows.length} record{rows.length === 1 ? '' : 's'}</div>
      <div className="list">
        {rows.map((r) => {
          const Tag = r.onClick ? 'button' : 'div';
          return (
            <Tag key={r.key} className={`list-row ${r.onClick ? 'ins-rd-click' : ''}`} onClick={r.onClick} type={r.onClick ? 'button' : undefined}>
              <span className="list-main"><b>{r.title}</b>{r.sub && <span>{r.sub}</span>}</span>
              {r.badge}
              {r.right && <span className="ins-rd-right">{r.right}</span>}
            </Tag>
          );
        })}
        {rows.length === 0 && <div className="empty">No records.</div>}
      </div>
    </Drawer>
  );
}

/** Scroll a card into view (used by KPIs that pivot to a table on the same page). */
export function scrollToId(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
