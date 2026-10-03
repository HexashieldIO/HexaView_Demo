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
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0.28" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
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
        <circle cx={CX} cy={CY} r={120} fill="url(#coreGlow)" />
        <g style={{ cursor: 'pointer' }} onMouseEnter={() => setHover('core')} onClick={() => nav('/fabric/integrations')}>
          <path d={hexPath(CX, CY, 74)} fill="color-mix(in srgb, var(--m-core) 12%, var(--card-bg))" stroke="var(--m-core)" strokeWidth={2.4} style={{ filter: 'drop-shadow(0 0 14px rgba(34,211,238,.45))' }} />
          <path d={hexPath(CX, CY, 62)} fill="none" stroke="var(--m-core)" strokeOpacity={0.35} strokeWidth={1} />
          <image href="/brand/HexaCore_icon.svg" x={CX - 15} y={CY - 44} width={30} height={30} />
          <text x={CX} y={CY + 10} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={19} fill="var(--text-primary)">HexaCore</text>
          <text x={CX} y={CY + 28} textAnchor="middle" fontSize={8.5} letterSpacing="2" fill="var(--text-muted)">RESILIENCE CORE</text>
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
