import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Crisp, original-style flow diagram (the v2 custody "content in motion" look):
// HTML node cards in columns, joined by fine SVG curves. Sanctioned flows are
// blue; flows marked `bad` are red with a moving dash. Use instead of an
// ECharts sankey wherever a flow is the story.

export interface FlowNode {
  id: string;
  title: ReactNode;
  /** Big number on the card. */
  count?: ReactNode;
  /** Small text after the number, e.g. "Confidential", "Can leave". */
  sub?: ReactNode;
  icon?: ReactNode;
  /** 'bad' paints the accent and sub red; 'good' teal; default uses the column tone. */
  state?: 'good' | 'bad' | 'warn';
  /** Accent colour override for the left/right bar. */
  color?: string;
  onClick?: () => void;
}
export interface FlowColumn {
  label: string;
  nodes: FlowNode[];
}
export interface FlowLink {
  from: string;
  to: string;
  value: number;
  bad?: boolean;
  color?: string;
}

const STATE_COLOR = { good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--sev-medium)' } as const;

export function FlowMap({ columns, links, height, goodColor = '#4f8cff', badColor = '#f0466e', footer }: {
  columns: FlowColumn[];
  links: FlowLink[];
  height?: number;
  goodColor?: string;
  badColor?: string;
  footer?: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ d: string; w: number; bad: boolean; color?: string; key: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const compute = () => {
      const box = el.getBoundingClientRect();
      const pos = new Map<string, DOMRect>();
      el.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((n) => pos.set(n.dataset.flowId!, n.getBoundingClientRect()));
      const max = Math.max(1, ...links.map((l) => l.value));
      // Spread several links leaving/entering the same node across its height.
      const outCount = new Map<string, number>();
      const inCount = new Map<string, number>();
      const outIdx = new Map<string, number>();
      const inIdx = new Map<string, number>();
      for (const l of links) {
        outCount.set(l.from, (outCount.get(l.from) ?? 0) + 1);
        inCount.set(l.to, (inCount.get(l.to) ?? 0) + 1);
      }
      const out: typeof paths = [];
      links.forEach((l, i) => {
        const a = pos.get(l.from);
        const b = pos.get(l.to);
        if (!a || !b) return;
        const oi = outIdx.get(l.from) ?? 0;
        outIdx.set(l.from, oi + 1);
        const ii = inIdx.get(l.to) ?? 0;
        inIdx.set(l.to, ii + 1);
        const oc = outCount.get(l.from) ?? 1;
        const ic = inCount.get(l.to) ?? 1;
        const y1 = a.top - box.top + a.height * ((oi + 1) / (oc + 1));
        const y2 = b.top - box.top + b.height * ((ii + 1) / (ic + 1));
        const x1 = a.right - box.left;
        const x2 = b.left - box.left;
        const dx = (x2 - x1) * 0.5;
        out.push({ d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, w: 1.2 + (l.value / max) * 5, bad: !!l.bad, color: l.color, key: `${l.from}>${l.to}>${i}` });
      });
      setPaths(out);
      setSize({ w: box.width, h: box.height });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [columns, links]);

  const cols = columns.length;
  return (
    <div className="flowmap">
      <div ref={wrap} className="flowmap-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, minHeight: height }}>
        <svg className="flowmap-svg" width={size.w} height={size.h} aria-hidden>
          {paths.map((p) => {
            const c = p.color ?? (p.bad ? badColor : goodColor);
            const dim = hover && !p.key.split('>').slice(0, 2).includes(hover);
            return (
              <g key={p.key} opacity={dim ? 0.15 : 1}>
                <path d={p.d} fill="none" stroke={c} strokeOpacity={p.bad ? 0.75 : 0.42} strokeWidth={p.w} strokeLinecap="round" />
                <path d={p.d} fill="none" stroke={c} strokeOpacity={0.95} strokeWidth={Math.max(1, p.w * 0.45)} strokeDasharray="6 14" strokeLinecap="round" className={p.bad ? 'flowmap-dash fast' : 'flowmap-dash'} />
              </g>
            );
          })}
        </svg>
        {columns.map((col, ci) => (
          <div key={col.label} className={`flowmap-col ${ci === 0 ? 'first' : ci === cols - 1 ? 'last' : 'mid'}`}>
            {col.nodes.map((n) => {
              const accent = n.color ?? (n.state ? STATE_COLOR[n.state] : ci === 0 ? 'var(--accent)' : 'var(--text-muted)');
              const Tag = n.onClick ? 'button' : 'div';
              return (
                <Tag
                  key={n.id}
                  data-flow-id={n.id}
                  className={`flowmap-node ${n.onClick ? 'clickable' : ''}`}
                  style={{ ['--accent-bar' as string]: accent }}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={n.onClick}
                >
                  <div className="flowmap-title">
                    {n.icon && <span className="flowmap-ico">{n.icon}</span>}
                    {n.title}
                  </div>
                  {(n.count !== undefined || n.sub) && (
                    <div className="flowmap-meta">
                      {n.count !== undefined && <b>{n.count}</b>}
                      {n.sub && <span style={n.state === 'bad' ? { color: 'var(--bad)' } : undefined}>{n.sub}</span>}
                    </div>
                  )}
                </Tag>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flowmap-axis" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {columns.map((c, i) => (
          <span key={c.label} style={{ textAlign: i === 0 ? 'left' : i === cols - 1 ? 'right' : 'center' }}>{c.label}</span>
        ))}
      </div>
      {footer && <div className="flowmap-foot">{footer}</div>}
    </div>
  );
}
