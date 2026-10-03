import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MODULE_BY_ID, type ModuleDef } from '../../modules/registry';
import { HexIcon } from '../../components/HexIcon';
import { Badge, Btn, hexPath } from '../../components/ui';

export interface MapNodeInfo {
  id: string;
  metrics: { value: string; label: string }[];
  status: 'Nominal' | 'Needs review' | 'Action required';
}

const STATUS_COLOR = { Nominal: 'var(--good)', 'Needs review': 'var(--sev-medium)', 'Action required': 'var(--bad)' } as const;

const CX = 320;
const CY = 280;
const CORE = ['soc', 'comply', 'strike', 'ot', 'custody', 'int'];
const OUTER = ['ai', 'insurance', 'reports'];

/**
 * The HexaCore platform map from the v2 demo, extended with the new modules on
 * an outer ring. Hover to explore, click to open.
 */
export function PlatformMap({ info, coreInfo }: { info: Record<string, MapNodeInfo>; coreInfo: MapNodeInfo }) {
  const nav = useNavigate();
  const [hover, setHover] = useState<string>('core');

  const nodes: { mod: ModuleDef | null; id: string; x: number; y: number; r: number }[] = [
    ...CORE.map((id, i) => {
      const a = (-90 + i * 60) * (Math.PI / 180);
      return { id, mod: MODULE_BY_ID[id], x: CX + Math.cos(a) * 168, y: CY + Math.sin(a) * 168, r: 40 };
    }),
    ...OUTER.map((id, i) => {
      // Outer modules sit between core nodes (0°, 120°, 240°) so nothing overlaps.
      const a = (i * 120) * (Math.PI / 180);
      return { id, mod: MODULE_BY_ID[id], x: CX + Math.cos(a) * 252, y: CY + Math.sin(a) * 218, r: 31 };
    }),
  ];

  const active = hover === 'core' ? null : MODULE_BY_ID[hover];
  const activeInfo = hover === 'core' ? coreInfo : info[hover];
  const fabric = MODULE_BY_ID.fabric;

  return (
    <div className="grid g-3-2" style={{ alignItems: 'center' }}>
      <svg viewBox="0 0 640 560" style={{ width: '100%', maxHeight: 520 }} role="region" aria-label="HexaCore platform map">
        <defs>
          <radialGradient id="coreHalo">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0.22" />
            <stop offset="0.6" stopColor="#3b82f6" stopOpacity="0.10" />
            <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="coreStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.5" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="coreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" stopOpacity="0.16" />
            <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="coreSweep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2dd4bf" stopOpacity="0" />
            <stop offset="1" stopColor="#2dd4bf" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx={CX} cy={CY} r={168} fill="none" stroke="var(--hairline)" strokeDasharray="2 6" />
        <ellipse cx={CX} cy={CY} rx={252} ry={218} fill="none" stroke="var(--hairline-soft)" strokeDasharray="1 7" />
        {nodes.map((n) => {
          const tone = n.mod?.tone ?? 'var(--m-core)';
          const lit = hover === n.id || hover === 'core';
          return (
            <g key={`l-${n.id}`}>
              <line x1={CX} y1={CY} x2={n.x} y2={n.y} stroke={tone} strokeOpacity={lit ? 0.45 : 0.15} strokeWidth={1.4} />
              <circle r={2.6} fill={tone} opacity={0.9}>
                <animateMotion dur={`${2.4 + (n.x % 7) / 5}s`} repeatCount="indefinite" path={`M${n.x},${n.y} L${CX},${CY}`} />
              </circle>
            </g>
          );
        })}
        {/* Core: radial ticks, radar sweep, halo, rotating dashed orbit, breathing inner hex (original v2 look). */}
        <g className="pm-rays" aria-hidden>
          {Array.from({ length: 36 }, (_, i) => {
            const ang = (i * 10 * Math.PI) / 180;
            const r1 = 128 + (i % 3) * 6;
            const r2 = r1 + 7 + (i % 2) * 5;
            const col = ['#22d3ee', '#8b5cf6', '#3b82f6', '#f5a83d', '#2dd4bf', '#ec4899'][i % 6];
            return <line key={i} x1={CX + Math.cos(ang) * r1} y1={CY + Math.sin(ang) * r1} x2={CX + Math.cos(ang) * r2} y2={CY + Math.sin(ang) * r2} stroke={col} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />;
          })}
        </g>
        <circle className="pm-halo" cx={CX} cy={CY} r={145} fill="url(#coreHalo)" />
        <g className="pm-sweep" aria-hidden>
          <path d={`M${CX},${CY} L${CX - 26},${CY + 150} L${CX + 26},${CY + 150} Z`} fill="url(#coreSweep)" />
        </g>
        <path className="pm-core-orbit" d={hexPath(CX, CY, 104)} fill="none" stroke="url(#coreStroke)" strokeWidth={1} strokeDasharray="3 9" opacity={0.5} />
        <g className="pm-core" style={{ cursor: 'pointer' }} onMouseEnter={() => setHover('core')} onClick={() => nav('/fabric/integrations')} role="link" aria-label="HexaCore, the shared resilience core">
          <path d={hexPath(CX, CY, 82)} fill="url(#coreFill)" stroke="url(#coreStroke)" strokeWidth={2.4} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 14px rgba(59,130,246,.45))' }} />
          <path className="pm-core-inner" d={hexPath(CX, CY, 68)} fill="none" stroke="url(#coreStroke)" strokeWidth={1} opacity={0.45} strokeLinejoin="round" />
          <svg x={CX - 26} y={CY - 58} width={52} height={52} viewBox="0 0 48 48" fill="none" stroke="url(#coreStroke)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M24 13 32.66 18 32.66 30 24 35 15.34 30 15.34 18 Z" />
            <path d="M24 13 24 24 M24 24 15.34 18 M24 24 32.66 18" />
          </svg>
          <text className="pm-core-name" x={CX} y={CY + 14} textAnchor="middle">HexaCore</text>
          <text className="pm-core-sub" x={CX} y={CY + 34} textAnchor="middle">RESILIENCE CORE</text>
        </g>
        {nodes.map((n) => {
          const tone = n.mod?.tone ?? 'var(--m-core)';
          const on = hover === n.id;
          return (
            <g
              key={n.id}
              style={{ cursor: 'pointer', transition: 'transform .2s' }}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => setHover(n.id)}
              onClick={() => n.mod && nav(n.mod.tabs.length ? `${n.mod.basePath}/${n.mod.tabs[0].id}` : n.mod.basePath)}
              tabIndex={0}
              role="link"
              aria-label={n.mod?.product}
            >
              <path
                d={hexPath(n.x, n.y, on ? n.r + 4 : n.r)}
                fill={`color-mix(in srgb, ${tone} ${on ? 22 : 10}%, var(--card-bg))`}
                stroke={tone}
                strokeWidth={on ? 2.4 : 1.6}
                style={{ filter: on ? `drop-shadow(0 0 12px ${tone})` : undefined, transition: 'all .2s' }}
              />
              <foreignObject x={n.x - 11} y={n.y - n.r * 0.58} width={22} height={22}>
                <div style={{ width: 22, height: 22 }}>{n.mod && <HexIcon mod={n.mod} size={22} />}</div>
              </foreignObject>
              <text x={n.x} y={n.y + (n.r > 35 ? 16 : 13)} textAnchor="middle" fontSize={n.r > 35 ? 10.5 : 9} fontWeight={700} fill={tone} fontFamily="var(--font-display)">
                {n.mod?.product.replace('Cyber Insurance', 'Insurance')}
              </text>
              {info[n.id] && (
                <circle cx={n.x + n.r * 0.72} cy={n.y - n.r * 0.62} r={4.5} fill={STATUS_COLOR[info[n.id].status]} stroke="var(--card-bg)" strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>

      <div className="card tinted" style={{ '--tone': active?.tone ?? 'var(--m-core)', borderTop: `2px solid ${active?.tone ?? 'var(--m-core)'}`, minHeight: 250 } as CSSProperties}>
        <div className="row" style={{ marginBottom: 6 }}>
          <HexIcon mod={active ?? fabric} size={30} />
          <div>
            <h3 style={{ fontSize: 17, color: active?.tone ?? 'var(--m-core)' }}>{active ? active.product : 'HexaCore'}</h3>
            <div className="section-label" style={{ margin: 0 }}>{active ? active.title : 'The resilience core'}</div>
          </div>
        </div>
        <p className="secondary" style={{ fontSize: 13, lineHeight: 1.55, margin: '6px 0 14px' }}>
          {active
            ? active.tagline
            : 'One canonical data, identity and AI-orchestration layer. Every module and every connected tool writes to it and reads from it, so a signal in one place sharpens every other. Credentials and raw data stay in your data planes.'}
        </p>
        <div className="mini-stats" style={{ marginBottom: 14 }}>
          {activeInfo?.metrics.map((m) => (
            <div className="mini-stat" key={m.label}>
              <b>{m.value}</b>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
        <div className="row between">
          {activeInfo && (
            <Badge color={STATUS_COLOR[activeInfo.status]} dot>
              {activeInfo.status}
            </Badge>
          )}
          <Btn
            sm
            primary
            color={active?.tone ?? 'var(--m-core)'}
            onClick={() => nav(active ? (active.tabs.length ? `${active.basePath}/${active.tabs[0].id}` : active.basePath) : '/fabric/integrations')}
          >
            Open {active ? active.product : 'Integration Fabric'} <ArrowRight size={13} />
          </Btn>
        </div>
      </div>
    </div>
  );
}
