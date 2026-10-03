import { useMemo, useState } from 'react';
import { Pause, Play, ArrowRight } from 'lucide-react';
import { Card, KpiStrip, HexScore, Btn, SevBadge, Legend, Badge, Bar, Sources } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { hexPath } from '../../components/ui';
import { fmtAgo, fmtCompact, fmtMoney, fmtNum, monthLabels } from '../../lib/format';
import {
  aisecPosture, aisecTopRisks, aisecRoi, aisecKillLog, aisecIncidents, aisecPhase, aisecSensors, PHASES, SENSOR_NAME,
  type AsItem,
} from '../../data/modules/aisec';
import { AS_TONE, AS_HEX, BASE, ItemDrawer, KindBadge, RecordsDrawer, SensorNote, StatusPill, toneStyle, useAs } from './parts';

function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = (x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

export default function AisecOverview() {
  const { c, tenantId, days, rl, inv, sum, nav, siem, comply, scope } = useAs();
  const post = aisecPosture(c, tenantId);
  const roi = useMemo(() => aisecRoi(c, tenantId), [c, tenantId]);
  const risks = aisecTopRisks(inv);
  const kills = aisecKillLog(c, tenantId);
  const killsInRange = kills.filter((k) => k.minAgo <= days * 1440);
  const incidents = aisecIncidents(c, tenantId);
  const phase = aisecPhase(c);
  const sens = aisecSensors(c, tenantId);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<AsItem | null>(null);
  const [killDrawer, setKillDrawer] = useState(false);

  const groups = [
    { id: 'llm', label: 'LLM apps', sub: 'GenAI SaaS & in-house LLMs', items: inv.filter((x) => x.status !== 'shadow' && (x.kind === 'LLM app' || x.kind === 'ML model')), color: '#4f8cff', to: `${BASE}/inventory?kind=LLM app` },
    { id: 'cop', label: 'Copilots', sub: 'Embedded & code assistants', items: inv.filter((x) => x.status !== 'shadow' && (x.kind === 'Copilot' || x.kind === 'Code assistant')), color: '#2dd4bf', to: `${BASE}/inventory?kind=Copilot` },
    { id: 'agt', label: 'Agents + MCP', sub: `${sum.mcpServers} MCP servers · ${sum.mcpConnections} connections`, items: inv.filter((x) => x.status !== 'shadow' && (x.kind === 'Agent' || x.kind === 'MCP server' || x.kind === 'Custom GPT')), color: '#a07cfb', to: `${BASE}/inventory?kind=Agent` },
    { id: 'shd', label: 'Shadow AI & agents', sub: `${sum.shadowApps} tools · ${sum.shadowAgents} agents / MCP`, items: inv.filter((x) => x.status === 'shadow'), color: '#f0466e', to: `${BASE}/inventory?status=shadow` },
  ];
  const W = 1240, H = 480, MID = 250;
  const ys = [100, 196, 292, 388];
  const SX = 318, SW = 54;
  const CX = 600;
  const outs = [
    { id: 'comply', label: 'HexaComply', role: 'GOVERNED', metric: `${sum.registered}/${sum.total} in AI register`, y: 120, color: '#2dd4bf', to: `${BASE}/compliance` },
    { id: 'soc', label: 'HexaSOC', role: 'OPERATED 24/7', metric: `${incidents.length} AI incident${incidents.length === 1 ? '' : 's'} forwarded`, y: MID, color: '#f5a83d', to: '/soc/ir' },
    { id: 'view', label: 'HexaView', role: 'PROVEN', metric: `Posture ${post.score} · ROI ${roi.roiPct}%`, y: 380, color: '#4f8cff', to: `${BASE}/roi` },
  ];
  const stds = ['ISO/IEC 42001', 'EU AI Act', 'NIST AI RMF', 'OWASP LLM Top 10', 'MITRE ATLAS'];
  const dim = (id: string) => (hover && hover !== id ? 0.25 : 1);

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. <b>See the AI. Govern the AI. Prove it.</b> Every AI tool, agent and MCP connection is discovered by the {SENSOR_NAME.replace('Nexovern ', '')} on the execution path, governed in HexaComply, operated by HexaSOC{siem ? ` alongside ${siem.vendor} ${siem.product}` : ''}, and proven here. {rl}.
      </p>

      <div className="as-kpi8"><KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'AI systems', value: sum.systems, unit: `${sum.registered} registered`, to: `${BASE}/inventory`, source: 'HexaAI register · Nexovern sensor' },
          { label: 'Agents', value: sum.agents, unit: 'incl. custom GPTs', to: `${BASE}/inventory?kind=Agent`, source: 'Nexovern sensor (process tree)' },
          { label: 'MCP connections', value: sum.mcpConnections, unit: `${sum.mcpServers} servers`, to: `${BASE}/inventory?kind=MCP server`, source: 'Nexovern sensor (MCP handshake)' },
          { label: 'Shadow AI', value: sum.shadowApps, unit: `+${sum.shadowAgents} agents`, toneColor: 'var(--bad)', to: `${BASE}/inventory?status=shadow`, source: 'Nexovern sensor · egress fingerprint' },
          { label: days === 1 ? 'Sessions today' : 'AI sessions', hint: days === 1 ? undefined : rl.replace('Last ', ''), value: fmtCompact(sum.sessions), to: `${BASE}/runtime`, source: 'Nexovern sensor via HexaAI' },
          { label: 'Blocked actions', value: fmtNum(sum.blocked), toneColor: 'var(--sev-high)', to: `${BASE}/policy?outcome=blocked`, source: 'HexaAI policy engine' },
          { label: 'Kill-switch events', value: killsInRange.length, unit: rl.replace('Last ', ''), onClick: () => setKillDrawer(true), source: 'Nexovern sensor (process kill)' },
          { label: 'AI ROI', value: `${roi.roiPct}%`, unit: fmtMoney(roi.net, c.currency) + ' net', toneColor: 'var(--good)', to: `${BASE}/roi`, source: 'HexaView ROI model · licence and usage data' },
        ]}
      /></div>

      <div className="grid g-2-1">
        <Card>
          <div className="row" style={{ gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="cc-link" onClick={() => nav(`${BASE}/roi`)} title="Open Board ROI: how AI posture is reported">
              <HexScore value={post.score} size={108} />
            </button>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3 style={{ fontSize: 18 }}>AI posture</h3>
              <p className="secondary" style={{ marginTop: 4 }}>
                One score for {tenantId === 'all' ? `${c.short}'s whole AI estate` : 'this tenant'}: how much AI you can see, how much is governed where it runs, and how much you can prove with fresh evidence.
              </p>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <Badge color={AS_TONE}>Phase {phase.current} · {PHASES[phase.current - 1].title}</Badge>
                <Badge color="var(--good)">+{post.score - post.trend[0]} in 12 months</Badge>
              </div>
            </div>
            <div style={{ width: 220 }}>
              <Chart
                height={78}
                option={{
                  grid: { left: 0, right: 0, top: 6, bottom: 0 },
                  xAxis: { type: 'category', data: monthLabels(12), show: false },
                  yAxis: { type: 'value', show: false, min: 40 },
                  tooltip: { trigger: 'axis' },
                  series: [{ type: 'line', data: post.trend, symbol: 'none', lineStyle: { color: AS_HEX, width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,.35)' }, { offset: 1, color: 'rgba(139,92,246,0)' }] } } }],
                }}
              />
            </div>
          </div>
          <div className="as-pillars" style={{ marginTop: 16 }}>
            {[
              { k: 'SEE', v: post.see, pc: '#22d3ee', to: `${BASE}/inventory`, pts: [`${sum.total} AI systems, agents and MCP servers discovered`, `${sens.pct}% of the AI estate on the runtime sensor`, `${sum.shadowApps + sum.shadowAgents} shadow items surfaced`] },
              { k: 'GOVERN', v: post.govern, pc: '#8b5cf6', to: `${BASE}/policy`, pts: [`${fmtNum(sum.blocked)} actions blocked, ${fmtNum(sum.redacted)} redacted`, `${sum.approvals} approval-gate decisions`, `Sessions mapped to OWASP LLM Top 10 and ATLAS`] },
              { k: 'PROVE', v: post.prove, pc: '#2dd4bf', to: `${BASE}/compliance`, pts: [`Evidence pushed to HexaComply continuously`, `ISO 42001 · EU AI Act · NIST AI RMF`, `Board ROI ${roi.roiPct}% · payback ${roi.paybackMonths} months`] },
            ].map((p) => (
              <button key={p.k} className="as-pillar" style={{ ['--pc' as string]: p.pc }} onClick={() => nav(p.to)}>
                <div className="row between"><h4>{p.k}</h4><b>{p.v}</b></div>
                <Bar value={p.v} color={p.pc} size="thin" />
                <ul>{p.pts.map((t) => <li key={t}>{t}</li>)}</ul>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Top AI risks" count={risks.length} sub="Ranked by risk score across tools, agents and MCP" flush actions={<button className="link" onClick={() => nav(`${BASE}/inventory`)}>Inventory →</button>}>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {risks.map(({ item, why }) => (
              <button key={item.id} className="list-row" onClick={() => setOpen(item)}>
                <span className="list-main">
                  <b>{item.name}</b>
                  <span style={{ whiteSpace: 'normal' }}>{why}</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <SevBadge sev={item.sev} />
                  <StatusPill status={item.status} />
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="The topology, end to end"
        sub="Your AI estate → kernel sensor on the execution path → HexaAI → governed, operated and proven. Hover to trace, click to open."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Legend items={[{ label: 'Observed & governed', color: '#22d3ee' }, { label: 'Shadow (stopped at sensor)', color: '#f0466e' }, { label: 'Evidence & incidents', color: AS_HEX }]} />
            <Btn sm onClick={() => setPlaying((p) => !p)}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Pause' : 'Play'}</Btn>
          </div>
        }
      >
        <div className={`as-topo ${playing ? '' : 'paused'}`}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 980 }} role="img" aria-label="AI security topology">
            <defs>
              <linearGradient id="asSensorGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#22d3ee" stopOpacity="0.18" />
                <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.22" />
              </linearGradient>
              <linearGradient id="asCore" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="0.55" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#c084fc" />
              </linearGradient>
              <radialGradient id="asHalo">
                <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.32" />
                <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
              </radialGradient>
            </defs>

            {[['THE AI ESTATE', 20], ['EXECUTION PATH', SX - 22], ['HEXAAI', CX - 34], ['GOVERNED · OPERATED · PROVEN', 820], ['STANDARDS', 1108]].map(([t, x]) => (
              <text key={t as string} x={x as number} y={28} className="as-colhead">{t}</text>
            ))}

            {/* Estate → sensor, sensor → core */}
            {groups.map((g, i) => {
              const y = ys[i];
              const shadow = g.id === 'shd';
              const d1 = curve(236, y, SX, y);
              const d2 = curve(SX + SW, y, CX - 92, MID + (i - 1.5) * 18);
              const n = Math.min(4, 1 + Math.round(Math.log10(g.items.reduce((s, x) => s + x.sessions, 0) + 10)));
              return (
                <g key={g.id} opacity={dim(g.id)}>
                  <path d={d1} fill="none" stroke={g.color} strokeOpacity={0.35} strokeWidth={2.2} />
                  {Array.from({ length: n }, (_, k) => (
                    <circle key={k} r={3} fill={g.color} className="as-particle">
                      <animateMotion dur={`${shadow ? 1.6 : 2}s`} repeatCount="indefinite" begin={`${(k * 2) / n}s`} path={d1} />
                    </circle>
                  ))}
                  {shadow ? (
                    <g>
                      <circle cx={SX + 6} cy={y} r={7} fill="none" stroke="#f0466e" strokeWidth={2} className="as-blockpulse" />
                      <path d={`M${SX + 1},${y - 5} l10,10 M${SX + 11},${y - 5} l-10,10`} stroke="#f0466e" strokeWidth={2.2} strokeLinecap="round" />
                      <path d={d2} fill="none" stroke="#f0466e" strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="3 6" />
                      <circle r={2.4} fill="#f0466e" className="as-particle">
                        <animateMotion dur="3.6s" repeatCount="indefinite" path={d2} />
                      </circle>
                    </g>
                  ) : (
                    <g>
                      <path d={d2} fill="none" stroke="#22d3ee" strokeOpacity={0.3} strokeWidth={2} />
                      {Array.from({ length: n }, (_, k) => (
                        <circle key={k} r={2.6} fill="#22d3ee" className="as-particle">
                          <animateMotion dur="2.2s" repeatCount="indefinite" begin={`${(k * 2.2) / n}s`} path={d2} />
                        </circle>
                      ))}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Estate nodes */}
            {groups.map((g, i) => {
              const y = ys[i];
              const sessions = g.items.reduce((s, x) => s + x.sessions, 0);
              return (
                <g key={g.id} className="as-node" opacity={dim(g.id)} onMouseEnter={() => setHover(g.id)} onMouseLeave={() => setHover(null)} onClick={() => nav(g.to)} role="button" aria-label={g.label}>
                  <rect x={16} y={y - 36} width={220} height={72} rx={10} className="as-node-box" stroke={g.id === 'shd' ? '#f0466e' : undefined} />
                  <rect x={16} y={y - 36} width={4} height={72} rx={2} fill={g.color} />
                  <text x={30} y={y - 14} className="as-node-name">{g.label}</text>
                  <text x={30} y={y + 2} className="as-node-sub">{g.sub}</text>
                  <text x={30} y={y + 24} className="as-node-num" fill={g.color}>{g.items.length}</text>
                  <text x={58} y={y + 23} className="as-node-sub">items · {fmtCompact(sessions)} sessions</text>
                </g>
              );
            })}

            {/* Kernel sensor band */}
            <g className="as-node" onClick={() => nav(`${BASE}/sensors`)} onMouseEnter={() => setHover('sensor')} onMouseLeave={() => setHover(null)} role="button" aria-label="Kernel sensor">
              <rect x={SX} y={52} width={SW} height={H - 84} rx={12} className="as-sensor-band" />
              <rect x={SX + 4} y={56} width={SW - 8} height={2} fill="#22d3ee" className="as-scan" style={{ ['--as-scan-h' as string]: `${H - 96}px` }} />
              <text transform={`translate(${SX + SW / 2 + 4}, ${MID}) rotate(-90)`} textAnchor="middle" className="as-sensor-title">KERNEL SENSOR</text>
              <text x={SX + SW / 2} y={H - 18} textAnchor="middle" className="as-node-sub">by Nexovern · {sens.pct}% covered</text>
            </g>

            {/* HexaAI core */}
            <g className="as-node" onClick={() => nav(`${BASE}/policy`)} role="button" aria-label="HexaAI">
              <circle cx={CX} cy={MID} r={140} fill="url(#asHalo)" className="as-halo" />
              <path d={hexPath(CX, MID, 112)} fill="none" stroke="url(#asCore)" strokeOpacity={0.5} strokeDasharray="3 9" className="as-orbit" />
              <path d={hexPath(CX, MID, 88)} fill="#8b5cf61f" stroke="url(#asCore)" strokeWidth={2.6} strokeLinejoin="round" />
              <text x={CX} y={MID - 18} textAnchor="middle" className="as-core-name">HexaAI™</text>
              <text x={CX} y={MID} textAnchor="middle" className="as-node-sub">discover · assess · enforce</text>
              <text x={CX} y={MID + 16} textAnchor="middle" className="as-node-sub">{fmtCompact(sum.sessions)} sessions · {fmtNum(sum.blocked)} blocked</text>
              {['Guardrails', 'Approval gates', 'Kill switch', 'OWASP · ATLAS'].map((t, i) => {
                const a = (i / 4) * Math.PI * 2 - Math.PI / 4;
                const ex = CX + Math.cos(a) * 128;
                const ey = MID + Math.sin(a) * 128;
                return (
                  <g key={t}>
                    <rect x={ex - 50} y={ey - 11} width={100} height={22} rx={11} fill="#8b5cf6" fillOpacity={0.16} stroke="#8b5cf6" strokeOpacity={0.5} />
                    <text x={ex} y={ey + 4} textAnchor="middle" className="as-node-sub" style={{ fill: 'var(--text-primary)', fontWeight: 700 }}>{t}</text>
                  </g>
                );
              })}
            </g>

            {/* Core → outputs */}
            {outs.map((o) => {
              const d = curve(CX + 90, MID, 820, o.y);
              return (
                <g key={o.id} opacity={dim(o.id)}>
                  <path d={d} fill="none" stroke={o.color} strokeOpacity={0.35} strokeWidth={2.2} />
                  {[0, 1, 2].map((k) => (
                    <circle key={k} r={2.8} fill={o.color} className="as-particle">
                      <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${k * 0.8}s`} path={d} />
                    </circle>
                  ))}
                </g>
              );
            })}
            {outs.map((o) => (
              <g key={o.id} className="as-node" opacity={dim(o.id)} onMouseEnter={() => setHover(o.id)} onMouseLeave={() => setHover(null)} onClick={() => nav(o.to)} role="button" aria-label={o.label}>
                <rect x={820} y={o.y - 38} width={240} height={76} rx={12} className="as-node-box" stroke={o.color} strokeOpacity={0.7} />
                <text x={836} y={o.y - 14} className="as-node-sub" style={{ fill: o.color, fontWeight: 800, letterSpacing: '.12em' }}>{o.role}</text>
                <text x={836} y={o.y + 6} className="as-core-name" style={{ fontSize: 16 }}>{o.label}™</text>
                <text x={836} y={o.y + 25} className="as-node-sub">{o.metric}</text>
              </g>
            ))}

            {/* Standards */}
            {stds.map((s, i) => {
              const y = 80 + i * 34;
              return (
                <g key={s} className="as-node" onClick={() => nav(`${BASE}/compliance`)} role="button" aria-label={s}>
                  <path d={curve(1060, 120, 1100, y)} fill="none" stroke="#2dd4bf" strokeOpacity={0.3} />
                  <rect x={1100} y={y - 12} width={128} height={24} rx={12} fill="#2dd4bf" fillOpacity={0.12} stroke="#2dd4bf" strokeOpacity={0.45} />
                  <text x={1164} y={y + 4} textAnchor="middle" className="as-node-sub" style={{ fill: 'var(--text-primary)', fontWeight: 700 }}>{s}</text>
                </g>
              );
            })}
            <text x={1100} y={270} className="as-node-sub">Evidence pushed to</text>
            <text x={1100} y={285} className="as-node-sub">HexaComply continuously</text>
          </svg>
        </div>
        <div className="row wrap between" style={{ marginTop: 10 }}>
          <SensorNote>sees process, memory, network and system calls · resists being disabled by a rogue admin or high-privilege malware</SensorNote>
          <span className="muted" style={{ fontSize: 11.5 }}>Particle density follows session volume in the selected range</span>
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Delivery: run for you, in four phases" sub={`Managed service · started ${fmtAgo(phase.startedDays * 1440)} · you keep decision authority`} actions={<Badge color={AS_TONE}>Fully managed</Badge>}>
          <div className="as-phases">
            {PHASES.map((p) => {
              const state = p.n < phase.current ? 'done' : p.n === phase.current ? 'now' : '';
              const pct = p.n < phase.current ? 100 : p.n === phase.current ? phase.pct : 0;
              return (
                <div key={p.n} className={`as-phase ${state}`}>
                  <span className="as-phase-n">{p.n}</span>
                  <b>{p.title}</b>
                  <p>{p.text}</p>
                  <Bar value={pct} color={state === 'done' ? 'var(--good)' : AS_TONE} size="thin" />
                  <span className="muted" style={{ fontSize: 10.5 }}>{state === 'done' ? 'Complete' : state === 'now' ? `${pct}% · in progress` : 'Planned'}</span>
                </div>
              );
            })}
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 11.5 }}>Engagement models:</span>
            <Badge color={AS_TONE} solid>Fully managed</Badge>
            <Badge>Co-managed</Badge>
            <Badge>Advisory</Badge>
          </div>
        </Card>
        <Card title="AI incidents to HexaSOC" count={incidents.length} sub="Forwarded to the 24/7 SOC with OWASP and ATLAS mapping" flush actions={<button className="link" onClick={() => nav('/soc/ir')}>Incidents & Response →</button>}>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {incidents.map((x) => (
              <button key={x.id} className="list-row" onClick={() => nav('/soc/ir')}>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>{x.title}</b>
                  <span>{x.id} · {x.owasp} · {x.atlas} · {x.status} · {fmtAgo(x.ageH * 60)}</span>
                </span>
                <SevBadge sev={x.sev} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g3">
        {[
          { title: 'Agents & MCP to watch', items: inv.filter((x) => (x.kind === 'Agent' || x.kind === 'MCP server') && x.risk >= 50).sort((a, b) => b.risk - a.risk).slice(0, 4), to: `${BASE}/runtime` },
          { title: 'Shadow AI, newest first', items: inv.filter((x) => x.status === 'shadow').sort((a, b) => a.firstSeenDays - b.firstSeenDays).slice(0, 4), to: `${BASE}/inventory?status=shadow` },
          { title: 'High-risk under the EU AI Act', items: inv.filter((x) => x.euClass === 'High').slice(0, 4), to: `${BASE}/compliance` },
        ].map((col) => (
          <Card key={col.title} title={col.title} count={col.items.length} actions={<button className="link" onClick={() => nav(col.to)}>Open <ArrowRight size={12} /></button>}>
            <div className="stack" style={{ gap: 8 }}>
              {col.items.map((x) => (
                <button key={x.id} className="list-row" style={{ padding: '4px 0' }} onClick={() => setOpen(x)}>
                  <span className="list-main"><b>{x.name}</b><span>{x.owner} · {x.modelVendor}</span></span>
                  <KindBadge kind={x.kind} />
                </button>
              ))}
              {col.items.length === 0 && <div className="empty">None in this scope.</div>}
            </div>
          </Card>
        ))}
      </div>

      <Sources items={[{ name: 'Nexovern sensor', status: 'healthy' }, { name: 'HexaAI', status: 'healthy' }, ...(comply ? [{ name: 'HexaComply', status: comply.status }] : []), ...(siem ? [{ name: siem.product, status: siem.status }] : [])]} />

      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
      {killDrawer && (
        <RecordsDrawer
          title="Kill-switch events"
          sub={`${rl} · ${killsInRange.length} of ${kills.length} in the last 90 days`}
          source="Nexovern sensor (process-tree termination) via HexaAI"
          onClose={() => setKillDrawer(false)}
          footer={<Btn primary color={AS_TONE} onClick={() => nav(`${BASE}/policy`)}>Open kill-switch panel</Btn>}
          rows={kills.map((k) => ({ key: k.id, main: `${k.item}`, sub: `${k.id} · ${k.reason} · ${k.mode} · ${k.by}`, right: <span className="muted" style={{ fontSize: 11 }}>{fmtAgo(k.minAgo)}</span> }))}
        />
      )}
    </div>
  );
}
