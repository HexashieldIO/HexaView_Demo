import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useIntro, reducedMotion } from '../../lib/useIntro';
import { Ring, hexPath } from '../../components/ui';
import { monthLabels } from '../../lib/format';
import type { FeedEvent } from '../../data/overview';

export { useIntro } from '../../lib/useIntro';

export interface HeroGauge {
  key: string;
  value: number;
  color: string;
  label: string;
  sub: string;
  to: string;
}

type Flow = { d: string; x1: number; y1: number; x2: number; y2: number };
type Geo = { w: number; h: number; flows: Flow[] };

/**
 * Command Centre hero, centred: the Resilience Index hex in the middle, the six
 * capabilities in an arc either side feeding it signals, the trend beneath.
 */
export function ResilienceHero({ introKey, value, trend, scopeText, gauges, events, onOpenIndex, onOpenGauge, onOpenEvent }: {
  introKey: string;
  value: number;
  trend: number[];
  scopeText: string;
  gauges: HeroGauge[];
  events: FeedEvent[];
  onOpenIndex: () => void;
  onOpenGauge: (g: HeroGauge) => void;
  onOpenEvent: (e: FeedEvent) => void;
}) {
  const anim = useIntro(introKey, 2200);
  const motion = !reducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const hexRef = useRef<HTMLButtonElement>(null);
  const ringRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [geo, setGeo] = useState<Geo | null>(null);

  // Spokes from each capability ring into the Index hex, measured in stage pixels.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const hb = hexRef.current?.querySelector('.rh-hexbox')?.getBoundingClientRect();
      if (!hb) return;
      const hx = hb.left + hb.width / 2 - box.left;
      const hy = hb.top + hb.height / 2 - box.top;
      const hr = hb.width / 2 - 8;
      const flows = ringRefs.current.slice(0, gauges.length).map((n): Flow => {
        const r = n?.getBoundingClientRect();
        if (!r) return { d: '', x1: 0, y1: 0, x2: 0, y2: 0 };
        const gx = r.left + r.width / 2 - box.left;
        const gy = r.top + r.height / 2 - box.top;
        // Stacked (narrow) layout: rings sit under the hex, no spokes.
        if (Math.abs(gx - hx) < hb.width / 2 + 20) return { d: '', x1: 0, y1: 0, x2: 0, y2: 0 };
        const dir = gx < hx ? 1 : -1;
        const x1 = gx + dir * (r.width / 2 + 6);
        const y1 = gy;
        // Land on the hex edge, facing the ring.
        const ang = Math.atan2(gy - hy, gx - hx);
        const x2 = hx + hr * Math.cos(ang);
        const y2 = hy + hr * Math.sin(ang) * 0.8;
        // Leaves the ring level, then bends into the hex, like a circuit trace.
        const d = `M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + (x2 - x1) * 0.55).toFixed(1)},${y1.toFixed(1)} ${(x1 + (x2 - x1) * 0.45).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
        return { d, x1, y1, x2, y2 };
      });
      setGeo({ w: box.width, h: box.height, flows });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gauges.length]);

  // Live ticker over the event feed.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!events.length) return;
    const t = setInterval(() => setTick((x) => x + 1), 3600);
    return () => clearInterval(t);
  }, [events.length]);
  const ev = events.length ? events[tick % events.length] : null;

  const shown = Math.round(anim(value, 150, 1500));
  const delta = trend[trend.length - 1] - trend[0];

  // Sparkline under the hex (crisp SVG, draws in on load).
  const W = 150;
  const H = 34;
  const lo = Math.min(...trend) - 3;
  const hi = Math.max(...trend) + 2;
  const pts = trend.map((v, i) => [(i / (trend.length - 1)) * (W - 8) + 4, H - 4 - ((v - lo) / Math.max(1, hi - lo)) * (H - 12)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const months = monthLabels(trend.length);
  const end = pts[pts.length - 1];

  const half = Math.ceil(gauges.length / 2);
  const sides: { side: 'left' | 'right'; items: { g: HeroGauge; i: number }[] }[] = [
    { side: 'left', items: gauges.slice(0, half).map((g, k) => ({ g, i: k })) },
    { side: 'right', items: gauges.slice(half).map((g, k) => ({ g, i: half + k })) },
  ];

  return (
    <div className={`rh ${motion ? 'rh-motion' : ''}`}>
      <div className="rh-head">
        <div className="rh-title">
          <h3>Resilience Index</h3>
          <span className="rh-live"><i /> Live</span>
        </div>
        <p className="secondary">
          One explainable score for {scopeText}. It moves as controls are validated, evidence ages and exposure changes.{' '}
          <button className="link" onClick={onOpenIndex}>See how it is made →</button>
        </p>
      </div>

      <div className="rh-stage" ref={stage}>
        {geo && (
          <svg className="rh-flow" width={geo.w} height={geo.h} aria-hidden>
            <defs>
              {geo.flows.map((f, i) => (
                <linearGradient key={i} id={`rh-grad-${i}`} gradientUnits="userSpaceOnUse" x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}>
                  <stop offset="0" stopColor={gauges[i].color} stopOpacity=".8" />
                  <stop offset="1" stopColor={gauges[i].color} stopOpacity=".18" />
                </linearGradient>
              ))}
              <filter id="rh-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.5" /></filter>
            </defs>
            {geo.flows.map((f, i) => f.d && (
              <g key={i}>
                <path d={f.d} fill="none" stroke={`url(#rh-grad-${i})`} strokeWidth={1.6} className="rh-track" style={{ animationDelay: `${300 + i * 120}ms` }} />
                {motion && [0, 1].map((k) => {
                  const dur = `${1.9 + (i % 3) * 0.2}s`;
                  const begin = `${1.1 + i * 0.3 + k}s`;
                  return (
                    <g key={k}>
                      <circle r={5} fill={gauges[i].color} opacity={0.55} filter="url(#rh-glow)">
                        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={f.d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .6 1" />
                        <animate attributeName="opacity" values="0;.7;.7;0" keyTimes="0;.15;.85;1" dur={dur} begin={begin} repeatCount="indefinite" />
                      </circle>
                      <circle r={2} fill="#fff">
                        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={f.d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .6 1" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.85;1" dur={dur} begin={begin} repeatCount="indefinite" />
                      </circle>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        )}

        {sides.map(({ side, items }) => (
          <div key={side} className={`rh-side ${side}`}>
            {items.map(({ g, i }, k) => (
              <button
                key={g.key}
                className={`rh-cap ${side} ${k === 1 ? 'mid' : ''}`}
                style={{ '--c': g.color, animationDelay: `${120 + i * 90}ms` } as CSSProperties}
                onClick={() => onOpenGauge(g)}
                title={`${g.label} · ${g.sub}: ${g.value}. Click to open ${g.sub}.`}
              >
                <span className="rh-cap-txt">
                  <b>{g.label}</b>
                  <small>{g.sub}</small>
                </span>
                <span className="rh-cap-ring" ref={(n) => { ringRefs.current[i] = n; }}>
                  <Ring value={Math.round(anim(g.value, 250 + i * 110, 1200))} color={g.color} size={64} stroke={7} />
                </span>
              </button>
            ))}
          </div>
        ))}

        <div className="rh-centre">
          <button ref={hexRef} className="rh-hex" onClick={onOpenIndex} title="Open the Board view: how the Index is made">
            <HeroHex value={anim(value, 150, 1500)} display={shown} colors={gauges.map((g) => g.color)} motion={motion} />
          </button>
        </div>
      </div>

      <div className="rh-foot">
        <button className="rh-spark" onClick={onOpenIndex} title="Resilience Index, last 12 months">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <linearGradient id="rh-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3ad0ae" stopOpacity=".38" />
                <stop offset="1" stopColor="#3ad0ae" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#rh-area)" className="rh-area" />
            <path d={line} fill="none" stroke="#3ad0ae" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="rh-line" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={7} fill="transparent"><title>{`${months[i]}: ${trend[i]}`}</title></circle>
            ))}
            <circle cx={end[0]} cy={end[1]} r={4} fill="#3ad0ae" className="rh-end" />
            <circle cx={end[0]} cy={end[1]} r={4} fill="none" stroke="#3ad0ae" className="rh-end-ping" />
          </svg>
          <span className="rh-delta"><b>{delta >= 0 ? '+' : ''}{Math.round(anim(delta, 900, 1000))}</b> over 12 months</span>
        </button>
        {ev && (
          <button className="rh-ticker" onClick={() => onOpenEvent(ev)} title="Open where this signal came from">
            <span className="rh-live-dot" />
            <span className={`rh-kind k-${ev.kind}`}>{ev.kind}</span>
            <span key={tick} className="rh-ticker-txt">{ev.text}</span>
          </button>
        )}
        </div>
    </div>
  );
}

/** The Index hex: draws in, counts up, six capability lights orbit the edge. */
function HeroHex({ value, display, colors, motion }: { value: number; display: number; colors: string[]; motion: boolean }) {
  const s = 156;
  const r = s / 2 - 11;
  const perim = 6 * r;
  const pct = Math.max(0, Math.min(1, value / 100));
  const edge = hexPath(s / 2, s / 2, r);
  return (
    <div className="rh-hexbox" style={{ width: s, height: s }}>
      {motion && <span className="rh-pulse" />}
      {motion && <span className="rh-pulse two" />}
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
        <defs>
          <linearGradient id="rh-hexgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="rh-hexglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        <g className={motion ? 'rh-spin' : ''} style={{ transformOrigin: '50% 50%' }}>
          <path d={hexPath(s / 2, s / 2, r + 8)} fill="none" stroke="color-mix(in srgb, #22d3ee 35%, transparent)" strokeWidth={1} strokeDasharray="3 7" />
        </g>
        <path d={edge} fill="color-mix(in srgb, var(--card-bg) 75%, transparent)" stroke="var(--track)" strokeWidth={8} strokeLinejoin="round" />
        <path d={edge} fill="none" stroke="url(#rh-hexgrad)" strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={perim} strokeDashoffset={perim * (1 - pct)} filter="url(#rh-hexglow)" opacity={0.75} />
        <path d={edge} fill="none" stroke="url(#rh-hexgrad)" strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={perim} strokeDashoffset={perim * (1 - pct)} />
        {motion && colors.map((col, i) => (
          <circle key={i} r={3.4} fill={col} style={{ filter: `drop-shadow(0 0 4px ${col})` }}>
            <animateMotion dur="12s" begin={`${-(12 / colors.length) * i}s`} repeatCount="indefinite" path={hexPath(s / 2, s / 2, r + 8)} />
          </circle>
        ))}
      </svg>
      <div className="rh-hexval">
        <b>{display}</b>
        <small>OF 100</small>
      </div>
    </div>
  );
}
