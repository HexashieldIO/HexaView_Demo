import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useIntro, easeOutBack, reducedMotion } from '../../lib/useIntro';

export interface SlaMetric {
  key: string;
  label: string;
  value: number;
  sla: number;
  series: readonly number[];
  color: string;
}

const GOOD = '#2dd4bf';
const BAD = '#f8646f';

/** Three stopwatch dials racing against their SLA, each over its 30-day trend. */
export function SlaMotion({ introKey, metrics, onOpen }: { introKey: string; metrics: SlaMetric[]; onOpen: (m: SlaMetric) => void }) {
  const anim = useIntro(introKey, 2600);
  const motion = !reducedMotion();
  return (
    <div className={`sla-m ${motion ? 'sla-motion' : ''}`}>
      {metrics.map((m, i) => (
        <SlaTile key={m.key} m={m} i={i} anim={anim} motion={motion} onOpen={() => onOpen(m)} />
      ))}
    </div>
  );
}

function SlaTile({ m, i, anim, motion, onOpen }: { m: SlaMetric; i: number; anim: ReturnType<typeof useIntro>; motion: boolean; onOpen: () => void }) {
  const ok = m.value <= m.sla;
  const headroom = Math.round((1 - m.value / m.sla) * 100);
  const delay = 200 + i * 220;
  const shown = Math.round(anim(m.value, delay, 1200));
  const needle = anim(Math.min(m.value, m.sla * 1.05), delay, 1500, easeOutBack);
  const room = Math.round(anim(Math.max(0, headroom), delay + 500, 900));
  const valColor = ok ? GOOD : BAD;

  // Dial geometry: a 220° stopwatch arc from 0 to the SLA.
  const R = 46;
  const C = 60;
  const A0 = 200;
  const SPAN = 220;
  const ang = (v: number) => ((A0 - (Math.min(v, m.sla * 1.05) / m.sla) * SPAN) * Math.PI) / 180;
  const pt = (v: number, r = R) => [C + r * Math.cos(ang(v)), C - r * Math.sin(ang(v))] as const;
  const arc = (a: number, b: number, r = R) => {
    const [x1, y1] = pt(a, r);
    const [x2, y2] = pt(b, r);
    const large = ((b - a) / m.sla) * SPAN > 180 ? 1 : 0;
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };
  const [nx, ny] = pt(Math.max(0.0001, needle), R - 8);
  const ticks = Array.from({ length: 11 }, (_, k) => (m.sla * k) / 10);

  return (
    <button className="sla-tile" onClick={onOpen} style={{ '--c': m.color, '--v': valColor } as CSSProperties} title={`${m.label}: ${m.value} min against a ${m.sla} min SLA. Click for the SLA breakdown.`}>
      <span className="section-label" style={{ margin: 0 }}>{m.label}</span>
      <div className="sla-head">
        <svg className="sla-dial" width={120} height={98} viewBox="0 0 120 98" aria-hidden>
          <defs>
            <filter id={`sla-glow-${m.key}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          <path d={arc(0, m.sla)} fill="none" stroke="var(--track)" strokeWidth={8} strokeLinecap="round" />
          {needle < m.sla && <path d={arc(Math.max(0.0001, needle), m.sla)} fill="none" stroke={GOOD} strokeOpacity={0.22} strokeWidth={8} strokeLinecap="round" />}
          {needle > 0.01 && (
            <>
              <path d={arc(0.0001, needle)} fill="none" stroke={m.color} strokeWidth={8} strokeLinecap="round" filter={`url(#sla-glow-${m.key})`} opacity={0.6} />
              <path d={arc(0.0001, needle)} fill="none" stroke={m.color} strokeWidth={8} strokeLinecap="round" />
            </>
          )}
          {ticks.map((v, k) => {
            const [x1, y1] = pt(v, R + 7);
            const [x2, y2] = pt(v, R + (k % 5 === 0 ? 12 : 10));
            return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={k === 10 ? BAD : 'var(--text-muted)'} strokeWidth={k === 10 ? 2 : 1} opacity={k === 10 ? 1 : 0.5} />;
          })}
          <line x1={C} y1={C} x2={nx} y2={ny} stroke="var(--text-primary)" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={C} cy={C} r={5} fill="var(--card-bg)" stroke="var(--text-primary)" strokeWidth={2} />
          {motion && <circle cx={C} cy={C} r={5} fill="none" stroke={valColor} className="sla-hub-ping" />}
          <text x={C} y={92} textAnchor="middle" className="sla-dial-cap">SLA {m.sla} min</text>
        </svg>
        <div className="sla-read">
          <div className="sla-val">{shown}<small>min</small></div>
          <span className={`sla-room ${ok ? 'good' : 'bad'}`}>{ok ? `${room}% headroom` : `${Math.abs(headroom)}% over SLA`}</span>
          <span className="sla-ok">{ok ? 'Within SLA' : 'Breaching SLA'} · {m.series.length}-day trend</span>
        </div>
      </div>
      <Trend m={m} motion={motion} delay={delay + 300} />
    </button>
  );
}

/** Trend line drawn against the dashed SLA ceiling, with a scan dot that keeps running. */
function Trend({ m, motion, delay }: { m: SlaMetric; motion: boolean; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const H = 70;
  const max = Math.max(m.sla * 1.12, ...m.series);
  const y = (v: number) => H - 2 - (v / max) * (H - 8);
  const pts = m.series.map((v, i) => [w ? (i / (m.series.length - 1)) * (w - 4) + 2 : 0, y(v)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z` : '';
  const slaY = y(m.sla);
  const last = pts[pts.length - 1];
  return (
    <div className="sla-trend" ref={ref}>
      {w > 0 && (
        <svg width={w} height={H} aria-hidden={false} role="img" aria-label={`${m.label} over ${m.series.length} days`}>
          <defs>
            <linearGradient id={`sla-area-${m.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={m.color} stopOpacity=".32" />
              <stop offset="1" stopColor={m.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={w} height={Math.max(0, slaY)} fill={BAD} opacity={0.05} />
          <line x1={0} x2={w} y1={slaY} y2={slaY} stroke={BAD} strokeDasharray="5 5" strokeWidth={1.4} className="sla-ceiling" />
          <text x={w - 2} y={slaY - 4} textAnchor="end" className="sla-ceiling-label">SLA {m.sla} min</text>
          <path d={area} fill={`url(#sla-area-${m.key})`} className="sla-area" style={{ animationDelay: `${delay + 900}ms` }} />
          <path d={line} fill="none" stroke={m.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="sla-line" style={{ animationDelay: `${delay}ms` }} />
          {m.series.map((v, i) => (
            <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r={Math.max(3, w / m.series.length / 2)} fill="transparent">
              <title>{`D-${m.series.length - 1 - i}: ${v} min`}</title>
            </circle>
          ))}
          {last && <circle cx={last[0]} cy={last[1]} r={3.5} fill={m.color} className="sla-last" style={{ animationDelay: `${delay + 1400}ms` }} />}
          {motion && line && (
            <g className="sla-scan" style={{ animationDelay: `${delay + 1600}ms` }}>
              <circle r={7} fill={m.color} opacity={0.35}>
                <animateMotion dur="4.5s" begin={`${(delay + 1600) / 1000}s`} repeatCount="indefinite" path={line} />
              </circle>
              <circle r={2.6} fill="#fff">
                <animateMotion dur="4.5s" begin={`${(delay + 1600) / 1000}s`} repeatCount="indefinite" path={line} />
              </circle>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
