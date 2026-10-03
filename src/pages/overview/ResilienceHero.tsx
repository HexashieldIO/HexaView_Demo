import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useIntro, reducedMotion } from '../../lib/useIntro';
import { GaugeTile, hexPath } from '../../components/ui';
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

type Geo = { w: number; h: number; hx: number; hy: number; paths: string[] };

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
  const wrap = useRef<HTMLDivElement>(null);
  const hexRef = useRef<HTMLButtonElement>(null);
  const gaugeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [geo, setGeo] = useState<Geo | null>(null);

  // Signal paths from each capability gauge up into the Index hex.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const hx = hexRef.current?.getBoundingClientRect();
      if (!hx) return;
      const cx = hx.left + hx.width / 2 - box.left;
      const bottom = hx.bottom - box.top - 10;
      const paths = gaugeRefs.current.slice(0, gauges.length).map((g, i) => {
        const r = g?.querySelector('.ring')?.getBoundingClientRect();
        if (!r) return '';
        const gx = r.left + r.width / 2 - box.left;
        const gy = r.top - box.top + 2;
        const band = gy - 18 - i * 2;
        const ex = cx + (i - (gauges.length - 1) / 2) * 7;
        return `M${gx.toFixed(1)},${gy.toFixed(1)} C${gx.toFixed(1)},${(band - 10).toFixed(1)} ${(ex + (gx - ex) * 0.35).toFixed(1)},${band.toFixed(1)} ${ex.toFixed(1)},${bottom.toFixed(1)}`;
      });
      setGeo({ w: box.width, h: box.height, hx: cx, hy: hx.top + hx.height / 2 - box.top, paths });
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

  // Sparkline geometry (crisp SVG, draws in on load).
  const W = 220;
  const H = 74;
  const lo = Math.min(...trend) - 3;
  const hi = Math.max(...trend) + 2;
  const pts = trend.map((v, i) => [(i / (trend.length - 1)) * (W - 8) + 2, H - 6 - ((v - lo) / Math.max(1, hi - lo)) * (H - 16)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const months = monthLabels(trend.length);
  const end = pts[pts.length - 1];

  return (
    <div className={`rh ${motion ? "rh-motion" : ""}`} ref={wrap}>
      {geo && (
        <svg className="rh-flow" width={geo.w} height={geo.h} aria-hidden>
          <defs>
            {gauges.map((g, i) => (
              <linearGradient key={g.key} id={`rh-grad-${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={geo.h} x2="0" y2={geo.hy}>
                <stop offset="0" stopColor={g.color} stopOpacity=".15" />
                <stop offset="1" stopColor={g.color} stopOpacity=".7" />
              </linearGradient>
            ))}
            <filter id="rh-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.5" /></filter>
          </defs>
          {geo.paths.map((d, i) => d && (
            <g key={i}>
              <path d={d} fill="none" stroke={`url(#rh-grad-${i})`} strokeWidth={1.5} className="rh-track" style={{ animationDelay: `${300 + i * 120}ms` }} />
              {motion && [0, 1].map((k) => (
                <g key={k}>
                  <circle r={5} fill={gauges[i].color} opacity={0.55} filter="url(#rh-glow)">
                    <animateMotion dur={`${2.6 + i * 0.17}s`} begin={`${1.2 + i * 0.35 + k * 1.4}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .6 1" />
                    <animate attributeName="opacity" values="0;.7;.7;0" keyTimes="0;.15;.85;1" dur={`${2.6 + i * 0.17}s`} begin={`${1.2 + i * 0.35 + k * 1.4}s`} repeatCount="indefinite" />
                  </circle>
                  <circle r={2} fill="#fff">
                    <animateMotion dur={`${2.6 + i * 0.17}s`} begin={`${1.2 + i * 0.35 + k * 1.4}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .6 1" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.85;1" dur={`${2.6 + i * 0.17}s`} begin={`${1.2 + i * 0.35 + k * 1.4}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              ))}
            </g>
          ))}
        </svg>
      )}

      <div className="rh-top">
        <button ref={hexRef} className="rh-hex" onClick={onOpenIndex} title="Open the Board view: how the Index is made">
          <HeroHex value={anim(value, 150, 1500)} display={shown} colors={gauges.map((g) => g.color)} motion={motion} />
        </button>
        <div className="rh-copy">
          <div className="rh-title">
            <h3>Resilience Index</h3>
            <span className="rh-live"><i /> Live</span>
            {ev && (
              <button className="rh-ticker" onClick={() => onOpenEvent(ev)} title="Open where this signal came from">
                <span className={`rh-kind k-${ev.kind}`}>{ev.kind}</span>
                <span key={tick} className="rh-ticker-txt">{ev.text}</span>
              </button>
            )}
          </div>
          <p className="secondary">
            One explainable score for {scopeText}. It moves as controls are validated, evidence ages and exposure changes.{' '}
            <button className="link" onClick={onOpenIndex}>See how it is made →</button>
          </p>
        </div>
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
      </div>

      <div className="rh-gauges">
        {gauges.map((g, i) => (
          <div key={g.key} ref={(n) => { gaugeRefs.current[i] = n; }} className="rh-gauge" style={{ '--c': g.color, animationDelay: `${120 + i * 90}ms` } as CSSProperties}>
            <GaugeTile value={Math.round(anim(g.value, 250 + i * 110, 1200))} color={g.color} label={g.label} sub={g.sub} onClick={() => onOpenGauge(g)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Index hex: draws in, counts up, six capability lights orbit the edge. */
function HeroHex({ value, display, colors, motion }: { value: number; display: number; colors: string[]; motion: boolean }) {
  const s = 132;
  const r = s / 2 - 10;
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
          <path d={hexPath(s / 2, s / 2, r + 7)} fill="none" stroke="color-mix(in srgb, #22d3ee 35%, transparent)" strokeWidth={1} strokeDasharray="3 7" />
        </g>
        <path d={edge} fill="color-mix(in srgb, var(--card-bg) 75%, transparent)" stroke="var(--track)" strokeWidth={7} strokeLinejoin="round" />
        <path d={edge} fill="none" stroke="url(#rh-hexgrad)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={perim} strokeDashoffset={perim * (1 - pct)} filter="url(#rh-hexglow)" opacity={0.75} />
        <path d={edge} fill="none" stroke="url(#rh-hexgrad)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={perim} strokeDashoffset={perim * (1 - pct)} />
        {motion && colors.map((col, i) => (
          <circle key={i} r={3.2} fill={col} style={{ filter: `drop-shadow(0 0 4px ${col})` }}>
            <animateMotion dur="12s" begin={`${-(12 / colors.length) * i}s`} repeatCount="indefinite" path={hexPath(s / 2, s / 2, r + 7)} />
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
