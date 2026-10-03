import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fmtCompact, fmtNum } from '../../lib/format';
import { AS_KINDS, KIND_HEX, STATUS_HEX, type AsItem, type AsStatus } from '../../data/modules/aisec';

const STATUSES: AsStatus[] = ['sanctioned', 'pilot', 'in review', 'shadow'];
const STATUS_LABEL: Record<AsStatus, string> = { sanctioned: 'Sanctioned', pilot: 'Pilot', 'in review': 'In review', shadow: 'Shadow' };

export interface EstateGroup {
  key: string;
  items: AsItem[];
  sessions: number;
  color: string;
}

/** Estate tiles: one per vendor (or type), sized by item count, with its own status mix. */
export function EstateTiles({ groups, active, onPick }: { groups: EstateGroup[]; active: string | null; onPick: (key: string) => void }) {
  const total = Math.max(1, groups.reduce((s, g) => s + g.items.length, 0));
  return (
    <div className="es-grid">
      {groups.map((g, i) => {
        const shadow = g.items.filter((x) => x.status === 'shadow').length;
        const users = g.items.reduce((s, x) => s + x.users, 0);
        return (
          <button
            key={g.key}
            className={`es-tile ${active === g.key ? 'on' : ''} ${active && active !== g.key ? 'dim' : ''}`}
            style={{ '--c': g.color, flexGrow: g.items.length, flexBasis: `${Math.max(150, (g.items.length / total) * 900)}px`, animationDelay: `${i * 60}ms` } as CSSProperties}
            onClick={() => onPick(g.key)}
            title={`${g.key}: ${g.items.map((x) => x.name).join(', ')}. Click to filter the inventory.`}
          >
            <span className="es-name">{g.key}</span>
            <span className="es-count">
              <b>{g.items.length}</b>
              <small>item{g.items.length === 1 ? '' : 's'}</small>
            </span>
            <span className="es-meta">{fmtCompact(g.sessions)} sessions · {fmtNum(users)} users</span>
            <span className="es-mix" aria-hidden>
              {STATUSES.map((st) => {
                const n = g.items.filter((x) => x.status === st).length;
                return n ? <i key={st} style={{ flex: n, background: STATUS_HEX[st] }} /> : null;
              })}
            </span>
            <span className={`es-flag ${shadow ? 'bad' : 'good'}`}>
              {shadow ? <><AlertTriangle size={11} /> {shadow} shadow</> : <><CheckCircle2 size={11} /> All registered</>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Status split as a segmented bar with clickable segments. */
export function StatusSplit({ items, active, onPick }: { items: AsItem[]; active: AsStatus | null; onPick: (s: AsStatus) => void }) {
  const total = Math.max(1, items.length);
  return (
    <div className="es-split">
      <div className="es-split-bar">
        {STATUSES.map((st) => {
          const n = items.filter((x) => x.status === st).length;
          if (!n) return null;
          const pct = Math.round((n / total) * 100);
          return (
            <button key={st} className={`es-seg ${active === st ? 'on' : ''}`} style={{ flex: n, background: STATUS_HEX[st] }} onClick={() => onPick(st)} title={`${STATUS_LABEL[st]}: ${n} (${pct}%)`}>
              {pct >= 9 ? `${pct}%` : ''}
            </button>
          );
        })}
      </div>
      <div className="es-split-legend">
        {STATUSES.map((st) => (
          <button key={st} className={active === st ? 'on' : ''} onClick={() => onPick(st)} style={{ '--c': STATUS_HEX[st] } as CSSProperties}>
            <i /> {STATUS_LABEL[st]} <b>{items.filter((x) => x.status === st).length}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

const LANE = 36;
const LABEL_W = 118;
const PAD = 16;
const MAX_DAYS = 400;
const AXIS_H = 34;

/** Swimlane discovery timeline: one lane per type, newest on the right, bubble area = users. */
export function DiscoveryTimeline({ items, activeStatus, onPickStatus, onOpen }: {
  items: AsItem[];
  activeStatus: AsStatus | null;
  onPickStatus: (s: AsStatus) => void;
  onOpen: (x: AsItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<{ x: AsItem; left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(0, w - LABEL_W - 4);
  const innerW = Math.max(0, plotW - PAD * 2);
  const H = AS_KINDS.length * LANE;
  const maxUsers = Math.max(1, ...items.map((x) => x.users));
  const xOf = (days: number) => LABEL_W + PAD + innerW - (Math.min(days, MAX_DAYS) / MAX_DAYS) * innerW;
  const rOf = (users: number) => 4 + Math.sqrt(users / maxUsers) * (LANE / 2 - 6);

  // Place bubbles; nudge overlapping ones within the lane so none hide another.
  const placed = useMemo(() => {
    const out: { x: AsItem; cx: number; cy: number; r: number }[] = [];
    AS_KINDS.forEach((k, lane) => {
      const row = items.filter((x) => x.kind === k).sort((a, b) => b.firstSeenDays - a.firstSeenDays);
      let flip = 1;
      let prev: { cx: number; r: number } | null = null;
      row.forEach((x) => {
        const cx = xOf(x.firstSeenDays);
        const r = rOf(x.users);
        let cy = lane * LANE + LANE / 2;
        if (prev && Math.abs(cx - prev.cx) < r + prev.r) { cy += flip * Math.min(7, LANE / 2 - r); flip = -flip; }
        out.push({ x, cx, cy, r });
        prev = { cx, r };
      });
    });
    // Draw big bubbles first so small ones stay clickable on top.
    return out.sort((a, b) => b.r - a.r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, plotW]);

  const ticks = [400, 300, 200, 100, 0];
  const counts = AS_KINDS.map((k) => items.filter((x) => x.kind === k).length);

  return (
    <div className="dt">
      <div className="dt-legend">
        {STATUSES.map((st) => (
          <button key={st} className={activeStatus === st ? 'on' : ''} style={{ '--c': STATUS_HEX[st] } as CSSProperties} onClick={() => onPickStatus(st)}>
            <i /> {STATUS_LABEL[st]}
          </button>
        ))}
      </div>
      <div className="dt-plot" ref={ref} onMouseLeave={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={H + AXIS_H} role="img" aria-label="AI discovery timeline">
            {AS_KINDS.map((k, lane) => (
              <g key={k}>
                <rect x={LABEL_W} y={lane * LANE + 2} width={plotW} height={LANE - 4} rx={8} className={lane % 2 ? 'dt-lane alt' : 'dt-lane'} />
                <rect x={8} y={lane * LANE + LANE / 2 - 4} width={8} height={8} rx={2} fill={KIND_HEX[k]} />
                <text x={22} y={lane * LANE + LANE / 2} dominantBaseline="central" className="dt-label">{k}</text>
                <text x={LABEL_W - 10} y={lane * LANE + LANE / 2} dominantBaseline="central" textAnchor="end" className="dt-count">{counts[lane] || ''}</text>
              </g>
            ))}
            {ticks.map((d) => (
              <g key={d}>
                <line x1={xOf(d)} x2={xOf(d)} y1={0} y2={H} className="dt-grid" />
                <text x={xOf(d)} y={H + 14} textAnchor={d === 400 ? 'start' : d === 0 ? 'end' : 'middle'} className="dt-tick">{d === 0 ? 'Today' : `${d} d`}</text>
              </g>
            ))}
            <text x={LABEL_W + plotW / 2} y={H + 30} textAnchor="middle" className="dt-axis">First seen (days ago)</text>
            <line x1={xOf(0)} x2={xOf(0)} y1={0} y2={H} className="dt-today" />
            {placed.map(({ x, cx, cy, r }, i) => {
              const dim = activeStatus && x.status !== activeStatus;
              return (
                <g
                  key={x.id}
                  className={`dt-bub ${x.status === 'shadow' ? 'shadow' : ''} ${dim ? 'dim' : ''}`}
                  style={{ '--c': STATUS_HEX[x.status], animationDelay: `${Math.min(900, (MAX_DAYS - Math.min(x.firstSeenDays, MAX_DAYS)) * 2 + i * 8)}ms`, transformOrigin: `${cx}px ${cy}px` } as CSSProperties}
                  onClick={() => onOpen(x)}
                  onMouseEnter={() => setHover({ x, left: cx, top: cy - r })}
                >
                  {x.status === 'shadow' && <circle cx={cx} cy={cy} r={r} className="dt-ring" />}
                  <circle cx={cx} cy={cy} r={r} className="dt-dot" />
                </g>
              );
            })}
          </svg>
        )}
        {hover && (
          <div className="dt-tip" style={{ left: Math.min(Math.max(hover.left, 120), w - 120), top: hover.top }}>
            <b>{hover.x.name}</b>
            <span><i style={{ background: STATUS_HEX[hover.x.status] }} /> {STATUS_LABEL[hover.x.status]} · {hover.x.kind}</span>
            <span>First seen {hover.x.firstSeenDays} days ago · {fmtNum(hover.x.users)} users</span>
            <em>Click for details</em>
          </div>
        )}
      </div>
    </div>
  );
}
