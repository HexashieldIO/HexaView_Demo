import { useState, type ReactNode } from 'react';

// Dot-matrix world map (Natural Earth, equirectangular, from the HexaShield site)
// with markers placed by real latitude/longitude.
const LON_MIN = -168, LON_MAX = 190, LAT_MIN = -56, LAT_MAX = 79;
const W = 1196, H = 281;

export function project(lat: number, lon: number): [number, number] {
  return [((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W, ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H];
}

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  label: string;
  sub?: ReactNode;
  color?: string;
  /** Relative size 0..1 */
  size?: number;
  pulse?: boolean;
}
export interface MapLink {
  from: [number, number];
  to: [number, number];
  color?: string;
  dashed?: boolean;
}

export function WorldMap({ points, links = [], height = 280, onPoint, dotColor = 'var(--text-muted)' }: { points: MapPoint[]; links?: MapLink[]; height?: number; onPoint?: (id: string) => void; dotColor?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const hp = points.find((p) => p.id === hover);
  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }} role="img" aria-label="Map">
        <defs>
          <mask id="hv-world-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <image href="/world-dots.svg" x={0} y={0} width={W} height={H} />
          </mask>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill={dotColor} opacity={0.38} mask="url(#hv-world-mask)" />
        {links.map((l, i) => {
          const [x1, y1] = project(l.from[0], l.from[1]);
          const [x2, y2] = project(l.to[0], l.to[1]);
          const mx = (x1 + x2) / 2;
          const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.18 - 10;
          return (
            <path key={i} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={l.color ?? 'var(--accent)'} strokeWidth={1.4} strokeOpacity={0.7} strokeDasharray={l.dashed ? '4 4' : undefined}>
              {!l.dashed && <animate attributeName="stroke-dasharray" values="0,1200;1200,0" dur="2.6s" repeatCount="indefinite" />}
            </path>
          );
        })}
        {points.map((p) => {
          const [x, y] = project(p.lat, p.lon);
          const r = 4 + (p.size ?? 0.4) * 9;
          const c = p.color ?? 'var(--accent)';
          return (
            <g key={p.id} style={{ cursor: onPoint ? 'pointer' : 'default' }} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onClick={() => onPoint?.(p.id)}>
              {p.pulse && (
                <circle cx={x} cy={y} r={r} fill={c} opacity={0.35}>
                  <animate attributeName="r" values={`${r};${r * 2.6}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={x} cy={y} r={r} fill={c} fillOpacity={0.85} stroke="var(--card-bg)" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      {hp && (() => {
        const [x, y] = project(hp.lat, hp.lon);
        return (
          <div
            style={{
              position: 'absolute', left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 14px))',
              background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 10px', fontSize: 11.5,
              boxShadow: 'var(--shadow-card-hover)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2,
            }}
          >
            <b>{hp.label}</b>
            {hp.sub && <div className="muted">{hp.sub}</div>}
          </div>
        );
      })()}
    </div>
  );
}
