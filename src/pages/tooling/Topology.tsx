import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Chip, Btn, Legend, HealthBadge } from '../../components/ui';
import { toolProfiles, ENTITIES, ENTITY_HEX, ENTITY_LABEL, MODULE_LABEL, type ToolProfile } from '../../data/modules/tooling';
import { ENV_HEX, ENV_LABEL } from '../../data/modules/fabric';
import { hexPath } from '../../components/ui';
import { fmtCompact, fmtNum } from '../../lib/format';
import type { Env, Health } from '../../data/types';
import { ToolDrawer, ToolMark, TONE, toneStyle } from './parts';

const ENV_ORDER: Env[] = ['cloud', 'saas', 'onprem', 'ot'];
const HEALTH_HEX: Record<Health, string> = { healthy: '#2dd4bf', degraded: '#f5a83d', failing: '#f0466e', paused: '#8593b4' };

// Column x positions inside the 1240-wide drawing.
const X = { tool: 16, toolW: 218, dp: 318, dpW: 190, gw: 590, gwW: 132, core: 880, mod: 1066, modW: 166 };
const ROW = 36;
const LANE_GAP = 30;
const TOP = 46;

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

interface Edge {
  id: string;
  d: string;
  color: string;
  /** particles per edge (0 = none) */
  n: number;
  dur: number;
  tools: string[];
  write?: boolean;
  width: number;
}

export default function ToolingTopology() {
  const { customer: c, tenantId } = useApp();
  const [params, setParams] = useSearchParams();
  const tools = useMemo(() => toolProfiles(c, tenantId), [c, tenantId]);
  const [envFilter, setEnvFilter] = useState<Env | 'all'>('all');
  const [showWrite, setShowWrite] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<ToolProfile | null>(null);
  const selected = params.get('tool');
  const focus = hover ?? selected;

  const shown = tools.filter((t) => envFilter === 'all' || t.k.env === envFilter);

  // ---- Layout ----
  const lanes = ENV_ORDER.map((env) => ({ env, tools: shown.filter((t) => t.k.env === env).sort((a, b) => b.eventsPerMin - a.eventsPerMin) })).filter((l) => l.tools.length);
  const toolPos = new Map<string, number>();
  let y = TOP;
  const laneBoxes: { env: Env; y: number; h: number }[] = [];
  for (const l of lanes) {
    const start = y;
    y += 22;
    for (const t of l.tools) {
      toolPos.set(t.k.id, y + ROW / 2 - 4);
      y += ROW;
    }
    laneBoxes.push({ env: l.env, y: start, h: y - start + 4 });
    y += LANE_GAP;
  }
  const height = Math.max(560, y + 10);

  const planes = c.dataPlanes.filter((d) => shown.some((t) => t.k.dataPlaneId === d.id));
  const dpH = 54;
  const dpGap = Math.max(14, (height - TOP - planes.length * dpH) / (planes.length + 1));
  const dpPos = new Map<string, number>();
  planes.forEach((d, i) => dpPos.set(d.id, TOP + dpGap * (i + 1) + dpH * i + dpH / 2));

  const midY = height / 2;
  const modules = [...new Set(shown.flatMap((t) => t.modules))];
  const modH = 34;
  const modGap = Math.max(10, (height - TOP - modules.length * modH) / (modules.length + 1));
  const modPos = new Map<string, number>();
  modules.forEach((m, i) => modPos.set(m, TOP + modGap * (i + 1) + modH * i + modH / 2));

  const focusTool = focus ? tools.find((t) => t.k.id === focus) : undefined;
  const lit = (ids: string[]) => !focusTool || ids.includes(focusTool.k.id);

  // ---- Edges ----
  const maxEpm = Math.max(1, ...shown.map((t) => t.eventsPerMin));
  const edges: Edge[] = [];
  for (const t of shown) {
    const ty = toolPos.get(t.k.id)!;
    const dy = dpPos.get(t.k.dataPlaneId);
    if (dy === undefined) continue;
    const intensity = t.eventsPerMin / maxEpm;
    const color = t.health === 'failing' ? HEALTH_HEX.failing : ENV_HEX[t.k.env];
    edges.push({ id: `t-${t.k.id}`, d: curve(X.tool + X.toolW, ty, X.dp, dy), color, n: t.eventsPerMin === 0 ? 0 : 1 + Math.round(intensity * 3), dur: 3.2 - intensity * 1.6, tools: [t.k.id], width: 1 + intensity * 2.5 });
    if (showWrite && !t.readOnly) {
      edges.push({ id: `w-${t.k.id}`, d: curve(X.dp, dy + 8, X.tool + X.toolW, ty + 6), color: '#f97316', n: 1, dur: 5.5, tools: [t.k.id], write: true, width: 1 });
    }
  }
  for (const d of planes) {
    const dy = dpPos.get(d.id)!;
    const ids = shown.filter((t) => t.k.dataPlaneId === d.id).map((t) => t.k.id);
    const vol = shown.filter((t) => t.k.dataPlaneId === d.id).reduce((s, t) => s + t.eventsPerMin, 0);
    const gapped = d.placement === 'Air-gapped';
    edges.push({ id: `d-${d.id}`, d: curve(X.dp + X.dpW, dy, X.gw, midY), color: gapped ? '#8593b4' : '#38bdf8', n: gapped ? 1 : 2 + Math.min(3, Math.round(vol / 400)), dur: gapped ? 9 : 2.6, tools: ids, width: 1.5 + Math.min(3, vol / 500) });
    if (showWrite && shown.some((t) => t.k.dataPlaneId === d.id && !t.readOnly)) {
      edges.push({ id: `dw-${d.id}`, d: curve(X.gw, midY + 10, X.dp + X.dpW, dy + 10), color: '#f97316', n: 1, dur: 6, tools: ids.filter((id) => !shown.find((t) => t.k.id === id)?.readOnly), write: true, width: 1 });
    }
  }
  edges.push({ id: 'gw-core', d: `M${X.gw + X.gwW},${midY} L${X.core - 86},${midY}`, color: '#22d3ee', n: 5, dur: 1.6, tools: shown.map((t) => t.k.id), width: 4 });
  for (const m of modules) {
    const my = modPos.get(m)!;
    const ids = shown.filter((t) => t.modules.includes(m)).map((t) => t.k.id);
    edges.push({ id: `m-${m}`, d: curve(X.core + 86, midY, X.mod, my), color: '#8b5cf6', n: 2, dur: 2.4, tools: ids, width: 1.4 + Math.min(2.5, ids.length / 4) });
  }

  const totalEpm = shown.reduce((s, t) => s + t.eventsPerMin, 0);
  const writers = shown.filter((t) => !t.readOnly).length;

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · how every integrated tool is wired into HexaView, live. Tools on the left talk only to their own <b>data plane</b> inside {c.short}&rsquo;s boundary; only canonical records and signed intents cross the <b>mTLS gateway</b> into <b>HexaCore</b>, which feeds each module. Moving dots are events; <span style={{ color: '#f97316', fontWeight: 600 }}>orange</span> dots are approved write-back.
      </p>
      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Tools on the map', value: shown.length, unit: `of ${tools.length}`, to: '/tooling/overview', source: 'HexaCore connector registry' },
          { label: 'Data planes', value: planes.length, to: '/fabric/dataplanes', source: 'hv-edge agents' },
          { label: 'Events / min', value: fmtCompact(totalEpm), to: '/tooling/activity', source: 'Gateway throughput (hv-gateway)' },
          { label: 'Write-capable', value: writers, unit: 'gated', to: '/ops/actions', source: 'Action Centre policy' },
          { label: 'Read-only', value: shown.length - writers, unit: 'incl. all OT', to: '/tooling/matrix?write=no', source: 'Connector manifests' },
          { label: 'Need attention', value: shown.filter((t) => t.health !== 'healthy').length, toneColor: 'var(--sev-medium)', to: '/fabric/integrations?status=degraded', source: 'Connector health (LLD 6.5)' },
        ]}
      />

      <Card
        title="Architecture topology"
        sub="Hover a tool to trace its path · click for its full profile"
        actions={
          <div className="row wrap" style={{ gap: 6 }}>
            <Chip on={envFilter === 'all'} onClick={() => setEnvFilter('all')} color={TONE}>All</Chip>
            {ENV_ORDER.filter((e) => tools.some((t) => t.k.env === e)).map((e) => (
              <Chip key={e} on={envFilter === e} onClick={() => setEnvFilter(e)} color={ENV_HEX[e]}>{ENV_LABEL[e]}</Chip>
            ))}
            <Chip on={showWrite} onClick={() => setShowWrite((v) => !v)} color="#f97316">Write-back</Chip>
            <Btn sm onClick={() => setPlaying((p) => !p)}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Pause' : 'Play'}</Btn>
            {selected && <Btn sm onClick={() => { params.delete('tool'); setParams(params); }}>Clear selection</Btn>}
          </div>
        }
      >
        <div className={`tl-topo ${playing ? '' : 'paused'}`}>
          <svg viewBox={`0 0 1240 ${height}`} width="100%" style={{ minWidth: 1000 }} role="img" aria-label="Security tooling architecture topology">
            <defs>
              <linearGradient id="tlCore" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="0.5" stopColor="#3b82f6" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
              <radialGradient id="tlHalo">
                <stop offset="0" stopColor="#22d3ee" stopOpacity="0.25" />
                <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Column headings */}
            {[
              ['SECURITY TOOLS', X.tool],
              ['DATA PLANES · YOUR BOUNDARY', X.dp],
              ['GATEWAY', X.gw],
              ['HEXACORE', X.core - 60],
              ['HEXAVIEW MODULES', X.mod],
            ].map(([t, x]) => (
              <text key={t as string} x={x as number} y={20} className="tl-colhead">{t}</text>
            ))}

            {/* Trust boundary */}
            <line x1={540} y1={30} x2={540} y2={height - 6} stroke="#f97316" strokeOpacity={0.55} strokeDasharray="6 6" />
            <text x={546} y={height - 12} className="tl-boundary">Trust boundary · credentials &amp; raw data stay left of this line</text>

            {/* Env lanes */}
            {laneBoxes.map((l) => (
              <g key={l.env}>
                <rect x={X.tool - 8} y={l.y} width={X.toolW + 16} height={l.h} rx={10} fill={ENV_HEX[l.env]} fillOpacity={0.05} stroke={ENV_HEX[l.env]} strokeOpacity={0.25} />
                <text x={X.tool} y={l.y + 15} className="tl-lane" fill={ENV_HEX[l.env]}>{ENV_LABEL[l.env].toUpperCase()}</text>
              </g>
            ))}

            {/* Edges + particles */}
            {edges.map((e) => {
              const on = lit(e.tools);
              return (
                <g key={e.id} opacity={on ? 1 : 0.08}>
                  <path d={e.d} fill="none" stroke={e.color} strokeOpacity={e.write ? 0.5 : 0.28} strokeWidth={e.width} strokeDasharray={e.write ? '4 5' : undefined} />
                  {Array.from({ length: e.n }, (_, i) => (
                    <circle key={i} r={e.write ? 2.6 : 2.4 + e.width * 0.25} fill={e.color} className="tl-particle">
                      <animateMotion dur={`${e.dur}s`} repeatCount="indefinite" begin={`${(i * e.dur) / Math.max(1, e.n)}s`} path={e.d} />
                    </circle>
                  ))}
                </g>
              );
            })}

            {/* Tools */}
            {shown.map((t) => {
              const ty = toolPos.get(t.k.id)!;
              const on = lit([t.k.id]);
              return (
                <g
                  key={t.k.id}
                  className="tl-node"
                  opacity={on ? 1 : 0.3}
                  onMouseEnter={() => setHover(t.k.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setOpen(t)}
                  role="button"
                  aria-label={t.name}
                >
                  <rect x={X.tool} y={ty - 14} width={X.toolW} height={28} rx={7} className="tl-node-box" stroke={focus === t.k.id ? ENV_HEX[t.k.env] : undefined} />
                  <rect x={X.tool + 5} y={ty - 9} width={18} height={18} rx={4} fill={ENV_HEX[t.k.env]} fillOpacity={0.18} />
                  <text x={X.tool + 14} y={ty + 3.5} textAnchor="middle" className="tl-mono" fill={ENV_HEX[t.k.env]}>{t.monogram}</text>
                  <text x={X.tool + 30} y={ty + 4} className="tl-node-name">{t.short.length > 22 ? `${t.short.slice(0, 21)}…` : t.short}</text>
                  <circle cx={X.tool + X.toolW - 12} cy={ty} r={4} fill={HEALTH_HEX[t.health]}>
                    {t.health !== 'healthy' && <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />}
                  </circle>
                  {!t.readOnly && <text x={X.tool + X.toolW - 24} y={ty + 4} textAnchor="end" className="tl-rw">R/W</text>}
                </g>
              );
            })}

            {/* Data planes */}
            {planes.map((d) => {
              const dy = dpPos.get(d.id)!;
              const ids = shown.filter((t) => t.k.dataPlaneId === d.id).map((t) => t.k.id);
              const on = lit(ids);
              const gapped = d.placement === 'Air-gapped';
              return (
                <g key={d.id} opacity={on ? 1 : 0.3}>
                  <rect x={X.dp} y={dy - dpH / 2} width={X.dpW} height={dpH} rx={9} className="tl-dp-box" stroke={HEALTH_HEX[d.status]} strokeDasharray={gapped ? '4 4' : undefined} />
                  <text x={X.dp + 10} y={dy - 8} className="tl-dp-name">{d.name.length > 26 ? `${d.name.slice(0, 25)}…` : d.name}</text>
                  <text x={X.dp + 10} y={dy + 7} className="tl-dp-sub">{d.placement}</text>
                  <text x={X.dp + 10} y={dy + 20} className="tl-dp-sub">hv-edge {d.agentVersion} · {ids.length} tool{ids.length === 1 ? '' : 's'}</text>
                  <circle cx={X.dp + X.dpW - 12} cy={dy - 12} r={4} fill={HEALTH_HEX[d.status]} />
                </g>
              );
            })}

            {/* Gateway */}
            <g>
              <rect x={X.gw} y={midY - 38} width={X.gwW} height={76} rx={12} className="tl-gw-box" />
              <text x={X.gw + X.gwW / 2} y={midY - 12} textAnchor="middle" className="tl-gw-name">hv-gateway</text>
              <text x={X.gw + X.gwW / 2} y={midY + 5} textAnchor="middle" className="tl-dp-sub">mTLS · outbound 443</text>
              <text x={X.gw + X.gwW / 2} y={midY + 19} textAnchor="middle" className="tl-dp-sub">signed intents only</text>
            </g>

            {/* HexaCore */}
            <g>
              <circle cx={X.core} cy={midY} r={130} fill="url(#tlHalo)" className="tl-halo" />
              <path d={hexPath(X.core, midY, 104)} fill="none" stroke="url(#tlCore)" strokeOpacity={0.5} strokeDasharray="3 9" className="tl-orbit" />
              <path d={hexPath(X.core, midY, 84)} fill="#3b82f61f" stroke="url(#tlCore)" strokeWidth={2.4} strokeLinejoin="round" />
              <svg x={X.core - 20} y={midY - 62} width={40} height={40} viewBox="0 0 48 48" fill="none" stroke="url(#tlCore)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M24 13 32.66 18 32.66 30 24 35 15.34 30 15.34 18 Z" />
                <path d="M24 13 24 24 M24 24 15.34 18 M24 24 32.66 18" />
              </svg>
              <text x={X.core} y={midY - 4} textAnchor="middle" className="tl-core-name">HexaCore</text>
              <text x={X.core} y={midY + 11} textAnchor="middle" className="tl-dp-sub">canonical model · OCSF</text>
              {ENTITIES.map((en, i) => {
                const a = (i / ENTITIES.length) * Math.PI * 2 - Math.PI / 2;
                const ex = X.core + Math.cos(a) * 118;
                const ey = midY + Math.sin(a) * 148;
                const fed = shown.some((t) => t.entities.includes(en) && lit([t.k.id]));
                return (
                  <g key={en} opacity={fed ? 1 : 0.25}>
                    <rect x={ex - 36} y={ey - 10} width={72} height={20} rx={10} fill={ENTITY_HEX[en]} fillOpacity={0.15} stroke={ENTITY_HEX[en]} strokeOpacity={0.5} />
                    <text x={ex} y={ey + 4} textAnchor="middle" className="tl-entity" fill={ENTITY_HEX[en]}>{ENTITY_LABEL[en]}</text>
                  </g>
                );
              })}
            </g>

            {/* Modules */}
            {modules.map((m) => {
              const my = modPos.get(m)!;
              const on = lit(shown.filter((t) => t.modules.includes(m)).map((t) => t.k.id));
              return (
                <g key={m} opacity={on ? 1 : 0.3}>
                  <rect x={X.mod} y={my - modH / 2} width={X.modW} height={modH} rx={9} className="tl-mod-box" />
                  <text x={X.mod + 12} y={my + 4.5} className="tl-node-name">{MODULE_LABEL[m]}</text>
                  <text x={X.mod + X.modW - 10} y={my + 4} textAnchor="end" className="tl-dp-sub">{shown.filter((t) => t.modules.includes(m)).length} tools</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="row wrap between" style={{ marginTop: 10 }}>
          <Legend
            items={[
              ...ENV_ORDER.filter((e) => tools.some((t) => t.k.env === e)).map((e) => ({ label: ENV_LABEL[e], color: ENV_HEX[e] })),
              { label: 'Gated write-back', color: '#f97316' },
              { label: 'HexaCore → modules', color: '#8b5cf6' },
            ]}
          />
          <span className="muted" style={{ fontSize: 11.5 }}>Particle speed and density follow each tool&rsquo;s live event rate</span>
        </div>
      </Card>

      {focusTool && (
        <Card title={<><ToolMark t={focusTool} size={24} /> {focusTool.name}</>} sub={focusTool.role} actions={<Btn sm primary color={TONE} onClick={() => setOpen(focusTool)}>Full profile</Btn>}>
          <div className="row wrap" style={{ gap: 18 }}>
            <HealthBadge status={focusTool.health} />
            <span className="secondary">{fmtNum(focusTool.eventsPerMin)} events/min</span>
            <span className="secondary">{focusTool.method}</span>
            <span className="secondary">via {c.dataPlanes.find((d) => d.id === focusTool.k.dataPlaneId)?.name}</span>
            <span className="secondary">feeds {focusTool.modules.map((m) => MODULE_LABEL[m]).join(', ')}</span>
          </div>
        </Card>
      )}

      {open && <ToolDrawer t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
