import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { LINK_ORDER, type Loop, type LinkKey } from '../../data/core';
import { hexPath } from '../../components/ui';
import { LoopChain, LINK_ICON, LINK_STATE_COLOR } from './loopParts';

const MOVE = 850;
const DWELL = 520;
const RETURN = 1800;
const HOLD_CLOSED = 1400;
const HOLD_OPEN = 2300;
const TRAIL = 80;

type Phase = { kind: 'dwell' | 'move' | 'hold'; dur: number; node?: number; from?: number; to?: number };
type Geom = { w: number; h: number; pts: [number, number][]; cum: number[]; d: string };

function Hex({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="loop-hex" style={{ '--state': color } as CSSProperties}>
      <svg className="loop-hex-bg" width={52} height={52} viewBox="0 0 52 52" aria-hidden>
        <path d={hexPath(26, 26, 23)} fill={`color-mix(in srgb, ${color} 16%, transparent)`} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      {children}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Animated six-link loop. A packet traces real loops link by link: closed loops
 * ride the return path back into control assurance, open loops stop at the first
 * failing link. Falls back to the static chain for reduced motion.
 */
export function LoopMotion({ loops, captions, tenantLabel, onOpen }: {
  loops: Loop[];
  captions?: Partial<Record<LinkKey, string>>;
  tenantLabel?: (tenantId: string) => string;
  onOpen?: (l: Loop) => void;
}) {
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const scenarios = useMemo(() => {
    const closed = loops.filter((l) => l.status === 'closed');
    const open = loops.filter((l) => l.status === 'broken' || l.status === 'partial');
    const out: Loop[] = [];
    [closed[0], closed[1], open[0], closed[2], open[1]].forEach((l) => l && out.push(l));
    return out;
  }, [loops]);

  const [playing, setPlaying] = useState(!reduced);
  const [idx, setIdx] = useState(0);
  const [lit, setLit] = useState(-1);
  const [failed, setFailed] = useState(false);
  const [closedFlash, setClosedFlash] = useState(false);
  const [closedCount, setClosedCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [geom, setGeom] = useState<Geom | null>(null);

  const stage = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const retRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const pausedAt = useRef<{ idx: number; t: number } | null>(null);

  // Measure hex centres and the return path in container pixels (crisp, no scaling).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const centres = nodeRefs.current.slice(0, 6).map((n) => {
        const hx = n?.querySelector('.loop-hex')?.getBoundingClientRect();
        return (hx ? [hx.left + hx.width / 2 - box.left, hx.top + hx.height / 2 - box.top] : [0, 0]) as [number, number];
      });
      const r = retRef.current?.getBoundingClientRect();
      // Narrow layouts wrap the chain onto two rows: no single motion path then.
      if (!r || Math.abs(centres[0][1] - centres[5][1]) > 4) { setGeom(null); return; }
      const rb = r.bottom - box.top - 1;
      const pts: [number, number][] = [...centres, [centres[5][0], rb], [centres[0][0], rb], centres[0]];
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      setGeom({ w: box.width, h: box.height, pts, cum, d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scenarios.length]);

  const loop = scenarios.length ? scenarios[idx % scenarios.length] : undefined;
  const failAt = loop ? LINK_ORDER.findIndex((l) => loop.links[l.key].state !== 'ok') : -1;

  useEffect(() => {
    if (!geom || !playing || !loop) return;
    const { cum, pts } = geom;
    const total = cum[cum.length - 1];
    const stop = failAt === -1 ? 5 : failAt;
    const phases: Phase[] = [];
    for (let i = 0; i <= stop; i++) {
      phases.push({ kind: 'dwell', node: i, dur: DWELL });
      if (i < stop) phases.push({ kind: 'move', from: cum[i], to: cum[i + 1], dur: MOVE });
    }
    if (failAt === -1) phases.push({ kind: 'move', from: cum[5], to: total, dur: RETURN }, { kind: 'hold', dur: HOLD_CLOSED });
    else phases.push({ kind: 'hold', dur: HOLD_OPEN });

    const at = (dist: number): [number, number] => {
      let k = 1;
      while (k < cum.length - 1 && cum[k] < dist) k++;
      const seg = cum[k] - cum[k - 1] || 1;
      const f = Math.min(1, Math.max(0, (dist - cum[k - 1]) / seg));
      return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f];
    };
    const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

    // Resume where we paused within the same loop; otherwise start fresh.
    const resume = pausedAt.current && pausedAt.current.idx === idx ? pausedAt.current.t : 0;
    pausedAt.current = null;
    if (!resume) { setLit(-1); setFailed(false); setClosedFlash(false); }
    let litNow = resume ? lit : -1;
    let flagged = resume ? failed || closedFlash : false;
    const start = performance.now() - resume;
    let elapsed = resume;
    let raf = 0;

    const tick = (now: number) => {
      elapsed = now - start;
      let t = elapsed;
      let p = 0;
      for (; p < phases.length && t >= phases[p].dur; p++) t -= phases[p].dur;
      if (p >= phases.length) { setIdx((x) => x + 1); return; }
      const ph = phases[p];
      let dist: number;
      if (ph.kind === 'dwell') {
        dist = cum[ph.node!];
        if (ph.node! > litNow) { litNow = ph.node!; setLit(litNow); }
        if (failAt !== -1 && ph.node === failAt && !flagged) { flagged = true; setFailed(true); setOpenCount((n) => n + 1); }
      } else if (ph.kind === 'move') {
        dist = ph.from! + (ph.to! - ph.from!) * ease(t / ph.dur);
      } else {
        dist = failAt === -1 ? total : cum[failAt];
        if (failAt === -1 && !flagged) { flagged = true; setClosedFlash(true); setClosedCount((n) => n + 1); }
      }
      const [x, y] = at(dist);
      for (const c of [headRef.current, haloRef.current]) { c?.setAttribute('cx', x.toFixed(1)); c?.setAttribute('cy', y.toFixed(1)); }
      if (trailRef.current) {
        trailRef.current.style.strokeDasharray = `${Math.min(TRAIL, dist)} ${total + TRAIL}`;
        trailRef.current.style.strokeDashoffset = `${-Math.max(0, dist - TRAIL)}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); pausedAt.current = { idx, t: elapsed }; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geom, playing, idx, scenarios]);

  if (reduced || !loop) return <LoopChain captions={captions} />;

  const failLink = failAt !== -1 ? LINK_ORDER[failAt] : null;
  const headColor = failed && failLink ? LINK_STATE_COLOR[loop.links[failLink.key].state] : 'var(--good)';

  return (
    <div className="lm">
      <div className="lm-head">
        <button className="lm-trace" onClick={() => onOpen?.(loop)} title="Open this loop">
          <span className={`lm-live ${playing ? 'on' : ''}`} />
          <span className="lm-trace-txt">
            Tracing <b>{loop.framework}</b> · control <b>{loop.controlId}</b> → <b>{loop.technique}</b> {loop.techniqueName}
            {tenantLabel ? <> · {tenantLabel(loop.tenantId)}</> : null}
          </span>
        </button>
        <div className="lm-counters">
          <span className="lm-count good"><Check size={12} /> {closedCount} closed</span>
          <span className="lm-count bad">{openCount} open</span>
          <button className="lm-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause animation' : 'Play animation'}>
            {playing ? <Pause size={12} /> : <Play size={12} />} {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>

      <div className="lm-stage" ref={stage}>
        <div className="loop-chain">
          {LINK_ORDER.map((l, i) => {
            const Icon = LINK_ICON[l.key];
            const link = loop.links[l.key];
            const visited = i <= lit;
            const isFail = failed && i === failAt;
            const color = isFail ? LINK_STATE_COLOR[link.state] : visited ? 'var(--good)' : 'color-mix(in srgb, var(--m-view) 65%, var(--text-muted))';
            const segDone = lit > i || closedFlash;
            return (
              <div
                key={l.key}
                ref={(n) => { nodeRefs.current[i] = n; }}
                className={`loop-node lm-node ${visited ? 'lit' : ''} ${isFail ? 'fail' : ''} ${i === lit && !isFail ? 'now' : ''}`}
                style={{ '--state': color, '--link-color': segDone ? 'var(--good)' : 'color-mix(in srgb, var(--m-view) 28%, transparent)' } as CSSProperties}
              >
                <span className="lm-ring" />
                <Hex color={color}><Icon /></Hex>
                <b>{l.label}</b>
                {visited ? (
                  <>
                    <em>{isFail ? cap(link.state) : 'OK'}</em>
                    <span className="loop-ref">{link.ref}</span>
                    <small>{link.source}{link.daysAgo !== undefined ? ` · ${link.daysAgo} d` : ''}</small>
                  </>
                ) : (
                  <small>{captions?.[l.key] ?? l.from}</small>
                )}
              </div>
            );
          })}
        </div>
        <div ref={retRef} className={`loop-return lm-return ${closedFlash ? 'flash' : ''} ${failed ? 'open' : ''}`}>
          <span>
            {closedFlash ? <b className="lm-closed"><Check size={12} /> Loop closed · control assurance updated</b>
              : failed && failLink ? <b className="lm-open">Loop open · {failLink.label.toLowerCase()} {loop.links[failLink.key].state} · not assured</b>
              : 'validation result feeds back into control assurance'}
          </span>
        </div>
        {geom && (
          <svg className="lm-svg" width={geom.w} height={geom.h} aria-hidden>
            <defs>
              <filter id="lm-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" /></filter>
            </defs>
            <path ref={trailRef} d={geom.d} fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: headColor, opacity: 0.85, strokeDasharray: `0 ${geom.cum[geom.cum.length - 1] + TRAIL}` }} />
            <circle ref={haloRef} cx={geom.pts[0][0]} cy={geom.pts[0][1]} r={11} filter="url(#lm-glow)" style={{ fill: headColor, opacity: 0.75 }} />
            <circle ref={headRef} cx={geom.pts[0][0]} cy={geom.pts[0][1]} r={5} style={{ fill: '#fff', stroke: headColor, strokeWidth: 2 }} />
          </svg>
        )}
      </div>
    </div>
  );
}
