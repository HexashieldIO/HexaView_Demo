import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pause, Play, Check, X } from 'lucide-react';
import { Card, KpiStrip, Chip, Btn, Badge, Legend, KV } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtCompact, fmtNum } from '../../lib/format';
import {
  aisecRuntime, aisecBaselines, aisecApprovals, EV_HEX, EV_LABEL, VERDICT_HEX, STATUS_HEX,
  type AsItem, type EvType, type RuntimeEvent, type Verdict,
} from '../../data/modules/aisec';
import { AS_TONE, AS_HEX, BASE, ActionModal, ItemDrawer, KindBadge, RecordsDrawer, SensorNote, StatusPill, toneStyle, useAs, type Risk } from './parts';

const VERDICT_LABEL: Record<Verdict | 'pending', string> = { allowed: 'Allowed', redacted: 'Redacted', approved: 'Approved', blocked: 'Blocked', killed: 'Killed', pending: 'Awaiting approval' };
const WRITE_RE = /update|write|submit|share|export|create|download|reset|post|merge|draft|publish|generate|run_|upload/i;

function VerdictBadge({ v }: { v: Verdict | 'pending' }) {
  return <Badge color={v === 'pending' ? '#f0a338' : VERDICT_HEX[v]} dot solid={v === 'killed'}>{VERDICT_LABEL[v]}</Badge>;
}
function secLabel(s: number) {
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
}

/** Animated call graph: caller → agent / MCP server → tools → data stores, APIs and model. */
function CallGraph({ x, playing }: { x: AsItem; playing: boolean }) {
  const W = 1000, H = 300;
  const caller = /^Local/.test(x.platform) ? 'Desktop / IDE MCP client' : x.kind === 'MCP server' ? (x.platform.match(/^([^(]+)/)?.[1].trim() ?? 'MCP client') : x.kind === 'Custom GPT' ? 'User in browser' : /Copilot Studio|Teams/i.test(x.platform) ? 'Users in Teams / M365' : 'Trigger: schedule + queue';
  const tools = (x.tools.length ? x.tools : ['invoke']).slice(0, 4);
  const stores = [...x.dataAccess.split(/,|·/).map((s) => s.trim()).filter(Boolean).slice(0, 3), x.endpoint];
  const hot = x.status === 'shadow' || x.risk >= 60;
  const ty = (i: number, n: number) => 40 + ((H - 70) * (i + 0.5)) / n;
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  const edges: { d: string; bad: boolean; key: string }[] = [];
  edges.push({ d: curve(200, H / 2, 300, H / 2), bad: false, key: 'c' });
  tools.forEach((t, i) => edges.push({ d: curve(470, H / 2, 560, ty(i, tools.length)), bad: hot && WRITE_RE.test(t), key: `t${i}` }));
  tools.forEach((t, i) => stores.forEach((_, j) => {
    if (j === stores.length - 1 ? i === 0 : (i + j) % Math.max(1, tools.length) === i % Math.max(1, stores.length - 1) || tools.length === 1) edges.push({ d: curve(730, ty(i, tools.length), 800, ty(j, stores.length)), bad: hot && WRITE_RE.test(t) && j < stores.length - 1, key: `s${i}-${j}` });
  }));
  return (
    <div className={`as-topo ${playing ? '' : 'paused'}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 760 }} role="img" aria-label={`Call graph for ${x.name}`}>
        {[['CALLER', 20], [x.kind === 'MCP server' ? 'MCP SERVER' : 'AGENT', 300], ['TOOLS & MCP CALLS', 560], ['DATA STORES · APIS · MODEL', 800]].map(([t, px]) => <text key={t as string} x={px as number} y={20} className="as-colhead">{t}</text>)}
        {edges.map((e, i) => (
          <g key={e.key}>
            <path d={e.d} fill="none" stroke={e.bad ? '#f0466e' : '#22d3ee'} strokeOpacity={e.bad ? 0.7 : 0.32} strokeWidth={e.bad ? 2.2 : 1.8} strokeDasharray={e.bad ? '5 5' : undefined} />
            {[0, 1].map((k) => (
              <circle key={k} r={2.6} fill={e.bad ? '#f0466e' : '#22d3ee'} className="as-particle">
                <animateMotion dur={`${e.bad ? 1.3 : 2.4}s`} begin={`${(i * 0.3 + k * 1.2) % 2.4}s`} repeatCount="indefinite" path={e.d} />
              </circle>
            ))}
          </g>
        ))}
        <g>
          <rect x={20} y={H / 2 - 26} width={180} height={52} rx={10} className="as-node-box" />
          <text x={32} y={H / 2 - 4} className="as-node-name">{caller.length > 24 ? `${caller.slice(0, 23)}…` : caller}</text>
          <text x={32} y={H / 2 + 13} className="as-node-sub">{fmtNum(x.users)} user{x.users === 1 ? '' : 's'} · {fmtNum(x.hosts)} host{x.hosts === 1 ? '' : 's'}</text>
        </g>
        <g>
          <rect x={300} y={H / 2 - 40} width={170} height={80} rx={12} className="as-node-box" stroke={x.status === 'shadow' ? '#f0466e' : AS_HEX} strokeWidth={1.8} />
          <text x={314} y={H / 2 - 16} className="as-node-name">{x.name.length > 21 ? `${x.name.slice(0, 20)}…` : x.name}</text>
          <text x={314} y={H / 2 + 2} className="as-node-sub">{x.model.length > 28 ? `${x.model.slice(0, 27)}…` : x.model}</text>
          <text x={314} y={H / 2 + 20} className="as-node-sub" style={{ fill: STATUS_HEX[x.status], fontWeight: 700 }}>{x.status.toUpperCase()} · risk {x.risk}</text>
          <rect x={300} y={H / 2 + 46} width={170} height={20} rx={10} fill="#22d3ee" fillOpacity={0.12} stroke="#22d3ee" strokeOpacity={0.45} />
          <text x={385} y={H / 2 + 60} textAnchor="middle" className="as-node-sub" style={{ fill: 'var(--text-primary)' }}>observed by kernel sensor</text>
        </g>
        {tools.map((t, i) => {
          const bad = hot && WRITE_RE.test(t);
          const y = ty(i, tools.length);
          return (
            <g key={t}>
              <rect x={560} y={y - 17} width={170} height={34} rx={8} className="as-node-box" stroke={bad ? '#f0466e' : undefined} />
              <text x={572} y={y + 4} className="as-node-name" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{t.length > (bad ? 17 : 24) ? `${t.slice(0, bad ? 16 : 23)}…` : t}</text>
              {bad && <text x={724} y={y + 4} textAnchor="end" className="as-node-sub" style={{ fill: '#f0466e', fontWeight: 800 }}>GATED</text>}
            </g>
          );
        })}
        {stores.map((s, j) => {
          const y = ty(j, stores.length);
          const model = j === stores.length - 1;
          return (
            <g key={s}>
              <rect x={800} y={y - 17} width={185} height={34} rx={8} className="as-node-box" stroke={model ? '#8b5cf6' : undefined} />
              <text x={812} y={y + 4} className="as-node-name" style={{ fontSize: 11 }}>{s.length > 27 ? `${s.slice(0, 26)}…` : s}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AisecRuntime() {
  const { c, tenantId, inv, sum, scope, rl, toast, nav, siem } = useAs();
  const [params, setParams] = useSearchParams();
  const itemFilter = params.get('item');
  const verdictFilter = params.get('verdict') as Verdict | 'pending' | null;
  const [typeFilter, setTypeFilter] = useState<EvType | null>(null);
  const [playing, setPlaying] = useState(true);
  const [offset, setOffset] = useState(0);
  const [ev, setEv] = useState<RuntimeEvent | null>(null);
  const [open, setOpen] = useState<AsItem | null>(null);
  const [list, setList] = useState<{ title: string; rows: RuntimeEvent[] } | null>(null);
  const [decide, setDecide] = useState<{ i: number; ok: boolean } | null>(null);
  const [decided, setDecided] = useState<Record<number, boolean>>({});

  const events = useMemo(() => aisecRuntime(c, tenantId, inv, 80), [c, tenantId, inv]);
  const baselines = useMemo(() => aisecBaselines(c, inv), [c, inv]);
  const approvals = aisecApprovals(c, tenantId);
  const agentic = inv.filter((x) => x.kind === 'Agent' || x.kind === 'MCP server' || x.kind === 'Custom GPT').sort((a, b) => b.risk - a.risk);
  const [graphId, setGraphId] = useState<string | null>(null);
  const graphItem = agentic.find((x) => x.id === graphId) ?? agentic.find((x) => x.name === itemFilter) ?? agentic[0];

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setOffset((o) => o + 1), 2600);
    return () => clearInterval(t);
  }, [playing]);

  const live = useMemo(() => {
    const rot = events.map((_, i) => events[(i + events.length - (offset % events.length)) % events.length]);
    return rot.map((e, i) => ({ ...e, secAgo: i === 0 ? 1 : e.secAgo }));
  }, [events, offset]);
  const filtered = live.filter((e) => (!typeFilter || e.type === typeFilter) && (!verdictFilter || e.verdict === verdictFilter) && (!itemFilter || e.item.name === itemFilter));

  const agentSessions = inv.filter((x) => x.kind === 'Agent' || x.kind === 'MCP server').reduce((s, x) => s + x.sessions, 0);
  const toolCalls = Math.round(agentSessions * 4.6);
  const mcpCalls = Math.round(inv.filter((x) => x.kind === 'MCP server').reduce((s, x) => s + x.sessions, 0) * 6.1);
  const egress = Math.round(sum.sessions * 1.9);
  const anomalies = baselines.filter((b) => b.anomaly);
  const pending = approvals.filter((_, i) => decided[i] === undefined);

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. What agents and AI apps actually do at the <b>execution path</b>, not what the app layer reports: processes, tool and MCP calls, network egress, file and memory access, seen by the kernel sensor and judged by HexaAI policy. {rl}.
      </p>
      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'AI sessions', value: fmtCompact(sum.sessions), to: `${BASE}/usage`, source: 'Nexovern sensor via HexaAI' },
          { label: 'Agent tool calls', value: fmtCompact(toolCalls), onClick: () => setTypeFilter('tool'), source: 'Nexovern sensor (process + syscall)' },
          { label: 'MCP calls', value: fmtCompact(mcpCalls), unit: `${sum.mcpConnections} connections`, onClick: () => setTypeFilter('mcp'), source: 'Nexovern sensor (MCP stdio / HTTP)' },
          { label: 'Egress to models', value: fmtCompact(egress), onClick: () => setTypeFilter('egress'), source: 'Nexovern sensor (network)' },
          { label: 'Awaiting approval', value: pending.length, toneColor: 'var(--sev-medium)', onClick: () => document.getElementById('as-approvals')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaAI approval gate' },
          { label: 'Behaviour anomalies', value: anomalies.length, unit: `of ${baselines.length} agents`, toneColor: 'var(--bad)', onClick: () => document.getElementById('as-baselines')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaAI behavioural baselines' },
        ]}
      />

      <div className="grid g-3-2">
        <Card
          title={<><span className="live-dot" /> Live session stream</>}
          sub="Every event the sensor sees, with the policy verdict · click for detail"
          flush
          actions={
            <div className="row wrap" style={{ gap: 6 }}>
              {(Object.keys(EV_LABEL) as EvType[]).map((t) => <Chip key={t} on={typeFilter === t} color={EV_HEX[t]} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>{EV_LABEL[t]}</Chip>)}
              {verdictFilter && <Chip on color={verdictFilter === 'pending' ? '#f0a338' : VERDICT_HEX[verdictFilter]} onClick={() => setParams((p) => { p.delete('verdict'); return p; })}>{VERDICT_LABEL[verdictFilter]} ×</Chip>}
              {itemFilter && <Chip on color={AS_TONE} onClick={() => setParams((p) => { p.delete('item'); return p; })}>{itemFilter} ×</Chip>}
              <Btn sm onClick={() => setPlaying((p) => !p)}>{playing ? <Pause size={13} /> : <Play size={13} />}</Btn>
            </div>
          }
        >
          <div className="as-stream">
            {filtered.slice(0, 40).map((e, i) => (
              <button key={`${e.id}-${offset}`} className={`as-ev ${i === 0 && playing ? 'new' : ''}`} onClick={() => setEv(e)}>
                <span className="as-ev-t">{secLabel(e.secAgo)} ago</span>
                <span className="as-type"><i style={{ background: EV_HEX[e.type] }} />{EV_LABEL[e.type]}</span>
                <span className="as-ev-who"><b>{e.item.name}</b><span>{e.host} · {e.process}</span></span>
                <span className="as-ev-detail" title={e.detail}>{e.detail}</span>
                <VerdictBadge v={e.verdict} />
              </button>
            ))}
            {filtered.length === 0 && <div className="empty">No events match these filters right now.</div>}
          </div>
          <div style={{ padding: '10px 18px 14px' }}><SensorNote>process, memory, network and system calls · telemetry stays in {c.short}&rsquo;s data plane</SensorNote></div>
        </Card>

        <Card title="Approval-gate queue" count={pending.length} sub="Agent actions waiting for a human · four-eyes on high risk">
          <div className="stack" style={{ gap: 8 }} id="as-approvals">
            {approvals.map((a, i) => (
              <div key={i} className="as-appr" style={decided[i] !== undefined ? { opacity: 0.55 } : undefined}>
                <div className="as-appr-head">
                  <b>{a.action}</b>
                  <Badge color={a.risk === 'high' ? 'var(--sev-high)' : a.risk === 'medium' ? 'var(--sev-medium)' : 'var(--good)'} dot>{a.risk}</Badge>
                </div>
                <p>{a.agent} → {a.target}</p>
                <p className="muted" style={{ fontSize: 11 }}>Gate: {a.why} · waiting {fmtAgo(a.ageMin)}</p>
                {decided[i] === undefined ? (
                  <div className="row" style={{ gap: 6 }}>
                    <Btn sm primary color={AS_TONE} onClick={() => setDecide({ i, ok: true })}><Check size={13} /> Approve</Btn>
                    <Btn sm onClick={() => setDecide({ i, ok: false })}><X size={13} /> Deny</Btn>
                    <span className="spacer" />
                    <button className="link" onClick={() => { const it = inv.find((x) => x.name === a.agent); if (it) setGraphId(it.id); document.getElementById('as-graph')?.scrollIntoView({ behavior: 'smooth' }); }}>Trace →</button>
                  </div>
                ) : (
                  <Badge color={decided[i] ? 'var(--good)' : 'var(--bad)'}>{decided[i] ? 'Approval recorded' : 'Denied'}</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div id="as-graph">
        <Card
          title="Agent call graph"
          sub="Agent → tools and MCP calls → data stores, APIs and the model it calls · red dashed = gated or anomalous write path"
          actions={
            <select className="select" value={graphItem?.id} onChange={(e) => setGraphId(e.target.value)}>
              {agentic.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.kind}{x.status === 'shadow' ? ', shadow' : ''})</option>)}
            </select>
          }
        >
          {graphItem && <CallGraph x={graphItem} playing={playing} />}
          {graphItem && (
            <div className="row wrap between" style={{ marginTop: 10 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <KindBadge kind={graphItem.kind} />
                <StatusPill status={graphItem.status} />
                <span className="muted" style={{ fontSize: 11.5 }}>{graphItem.platform} · auth {graphItem.auth}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Legend items={[{ label: 'Observed call', color: '#22d3ee' }, { label: 'Gated / anomalous', color: '#f0466e' }]} />
                <Btn sm onClick={() => setOpen(graphItem)}>Open profile</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div id="as-baselines">
        <Card title="Behaviour baselines" count={baselines.length} sub="Per agent and MCP server: learned baseline vs observed now · anomalies feed HexaSOC" flush>
          <DataTable
            rows={baselines}
            rowKey={(b) => b.item.id}
            onRowClick={(b) => setOpen(b.item)}
            initialSort={{ key: 'score', dir: 'desc' }}
            columns={[
              { key: 'name', header: 'Agent / MCP server', sort: (b) => b.item.name, render: (b) => (<><div className="t-main">{b.item.name}</div><div className="t-sub">{b.item.kind} · {b.item.owner}</div></>) },
              ...[0, 1, 2, 3].map((k) => ({
                key: `m${k}`,
                header: baselines[0]?.metrics[k].label ?? '',
                sort: (b: (typeof baselines)[number]) => b.metrics[k].now / Math.max(1, b.metrics[k].base),
                render: (b: (typeof baselines)[number]) => {
                  const m = b.metrics[k];
                  const ratio = m.now / Math.max(1, m.base);
                  return (
                    <div style={{ minWidth: 110 }}>
                      <div className="row" style={{ gap: 6, fontSize: 11.5 }}><b style={{ color: ratio > 1.6 ? 'var(--bad)' : undefined }}>{fmtNum(m.now)}{m.unit ? ` ${m.unit}` : ''}</b><span className="muted">vs {fmtNum(m.base)}</span></div>
                      <div className="as-riskbar" style={{ marginTop: 3 }}><i style={{ width: `${Math.min(100, ratio * 30)}%`, background: ratio > 1.6 ? '#f0466e' : '#2dd4bf' }} /></div>
                    </div>
                  );
                },
              })),
              { key: 'score', header: 'Anomaly', align: 'right', sort: (b) => b.score, render: (b) => (b.learning ? <Badge>Learning</Badge> : b.anomaly ? <Badge color="var(--bad)" solid>{b.score}</Badge> : <Badge color="var(--good)">Normal</Badge>) },
            ]}
          />
        </Card>
      </div>

      {ev && (
        <Drawer title={`${EV_LABEL[ev.type]} · ${ev.item.name}`} sub={`${secLabel(ev.secAgo)} ago · ${ev.host}`} onClose={() => setEv(null)} footer={<><Btn onClick={() => { setEv(null); setOpen(ev.item); }}>Open {ev.item.kind.toLowerCase()}</Btn><Btn onClick={() => setList({ title: `All events: ${ev.item.name}`, rows: events.filter((x) => x.item.id === ev.item.id) })}>All events</Btn>{(ev.verdict === 'blocked' || ev.verdict === 'killed') && <Btn primary color={AS_TONE} onClick={() => nav('/soc/ir')}>Open in HexaSOC</Btn>}</>}>
          <div className="row" style={{ gap: 6 }}><VerdictBadge v={ev.verdict} />{ev.owasp && <Badge color={AS_TONE}>{ev.owasp}</Badge>}{ev.dataClass && <Badge color="var(--sev-high)">{ev.dataClass}</Badge>}</div>
          <KV rows={[
            ['Host', ev.host],
            ['Process', <span className="mono">{ev.process}</span>],
            ['Event', <span className="mono" style={{ fontSize: 11.5 }}>{ev.detail}</span>],
            ['AI system', `${ev.item.name} (${ev.item.kind}, ${ev.item.status})`],
            ['Model / endpoint', `${ev.item.model} · ${ev.item.endpoint}`],
            ['Policy verdict', VERDICT_LABEL[ev.verdict]],
            ['Forwarded to', ev.verdict === 'blocked' || ev.verdict === 'killed' ? `HexaSOC${siem ? ` and ${siem.vendor} ${siem.product}` : ''}` : 'HexaAI session log'],
            ['Evidence', 'Hashed and pushed to HexaComply'],
          ]} />
          <SensorNote>event captured below the application layer</SensorNote>
        </Drawer>
      )}
      {list && <RecordsDrawer title={list.title} source="Nexovern sensor via HexaAI" onClose={() => setList(null)} rows={list.rows.map((e) => ({ key: e.id, main: <span className="mono" style={{ fontSize: 11.5 }}>{e.detail}</span>, sub: `${EV_LABEL[e.type]} · ${e.host} · ${secLabel(e.secAgo)} ago`, right: <VerdictBadge v={e.verdict} /> }))} />}
      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
      {decide && (() => {
        const a = approvals[decide.i];
        return (
          <ActionModal
            title={`${decide.ok ? 'Approve' : 'Deny'}: ${a.action}`}
            target={`${a.agent} → ${a.target}`}
            operation={decide.ok ? 'gate.approve(action)' : 'gate.deny(action) + notify(owner)'}
            risk={a.risk as Risk}
            approvers={a.risk === 'high' ? [c.people.ciso.name, c.people.grcLead.name] : [c.people.grcLead.name]}
            change={decide.ok ? <>The sensor releases the held call and the agent completes <b>{a.action}</b>. {a.risk === 'high' ? 'A second approver must also sign before release.' : ''}</> : <>The held call is dropped, the agent receives a policy refusal and its owner is notified with the reason.</>}
            submitLabel={decide.ok ? (a.risk === 'high' ? 'Approve (1 of 2)' : 'Approve') : 'Deny'}
            danger={!decide.ok}
            onClose={() => setDecide(null)}
            onSubmit={() => { setDecided((d) => ({ ...d, [decide.i]: decide.ok })); setDecide(null); toast(decide.ok ? `Approval recorded for "${a.action}"${a.risk === 'high' ? ': waiting for second approver' : ''}` : `Denied: "${a.action}"; ${a.agent} owner notified`); }}
          />
        );
      })()}
    </div>
  );
}
