import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Server, ShieldAlert, ShieldCheck, Ban, FileText, Building2, Database, Sparkles } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { tenantName, isStale } from '../../data/customers';
import {
  aiApps, aiControlPlane, dlpTrend, discoveredAgents, inhouseModels, AI_DATA_CLASSES,
  type AiApp, type ModelCard, type DiscoveredAgent,
} from '../../data/modules/ai';
import { Badge, Bar, BarRow, Btn, Callout, Card, Freshness, KpiStrip, KV, Sources, StatusBadge, Tabs } from '../../components/ui';
import { SEV_HEX } from '../../components/Chart';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { dayLabels, fmtCompact, fmtNum, hourLabels, scoreTone } from '../../lib/format';
import { ChartLegend, SvgColumns } from '../reports/parts';
import { AI_TONE, AI_STATUS_COLOR, AiStatusBadge, ApprovalModal } from './parts';
import './ai.css';

type StatusFilter = 'all' | 'shadow' | 'sanctioned';
interface AppList { title: string; sub: string; apps: AiApp[]; metric: 'users' | 'prompts' | 'dlp' }

export default function Discovery() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const h = headlines(c, tenantId);
  const days = rangeDays(timeRange);
  const apps = useMemo(() => aiApps(c, tenantId, days), [c, tenantId, days]);
  const cp = aiControlPlane(c);
  const agents = discoveredAgents(c);
  const models = inhouseModels(c);
  const [params, setParams] = useSearchParams();
  const sp = params.get('status');
  const filter: StatusFilter = sp === 'shadow' || sp === 'sanctioned' ? sp : 'all';
  const setFilter = (f: StatusFilter) => setParams((p) => { const n = new URLSearchParams(p); if (f === 'all') n.delete('status'); else n.set('status', f); return n; }, { replace: true });
  const [sel, setSel] = useState<AiApp | null>(null);
  const [model, setModel] = useState<ModelCard | null>(null);
  const [agent, setAgent] = useState<DiscoveredAgent | null>(null);
  const [list, setList] = useState<AppList | null>(null);
  const [act, setAct] = useState<{ app: AiApp; mode: 'block' | 'guard' } | null>(null);
  const [changed, setChanged] = useState<Record<string, 'blocked' | 'guarded'>>({});

  const external = useMemo(() => apps.filter((a) => a.kind !== 'In-house model'), [apps]);
  const shadow = apps.filter((a) => a.status === 'shadow');
  const sanctioned = apps.filter((a) => a.status === 'sanctioned');
  const pilot = apps.filter((a) => a.status === 'pilot');
  const users = external.reduce((s, a) => s + a.users, 0);
  const prompts = external.reduce((s, a) => s + a.prompts, 0);
  const dlp = apps.reduce((s, a) => s + a.dlpEvents, 0);
  const trend = dlpTrend(c, tenantId, days, dlp);
  const labels = days === 1 ? hourLabels(24) : dayLabels(trend.n);
  const classes = AI_DATA_CLASSES[c.id];
  const byClass = classes.map((k) => ({ name: k.name, sensitive: k.sensitive, prompts: Math.round(external.reduce((s, a) => s + a.prompts * (a.dataClasses.find((x) => x.name === k.name)?.share ?? 0), 0)) }));
  const identity = c.connectors.filter((k) => k.category === 'Identity').slice(0, 2);
  const srcs = [...new Map([cp.connector, ...identity].map((k) => [k.id, { name: k.product, status: k.status }])).values()];
  const srcText = [cp.label, ...identity.map((k) => `${k.vendor} ${k.product}`)].join(' · ');
  const shown = apps.filter((a) => filter === 'all' || (filter === 'shadow' ? a.status === 'shadow' : a.status !== 'shadow'));
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Flow: department → AI app → data class (top apps by prompt volume).
  const flow = useMemo(() => {
    const byVol = external.slice().sort((a, b) => b.prompts - a.prompts);
    const sh = external.filter((a) => a.status === 'shadow').sort((a, b) => b.risk - a.risk).slice(0, 2);
    const top = [...byVol.filter((a) => !sh.includes(a)).slice(0, 7 - sh.length), ...sh].sort((a, b) => b.prompts - a.prompts);
    const deptTotals = new Map<string, number>();
    for (const a of top) for (const d of a.departments) deptTotals.set(d.name, (deptTotals.get(d.name) ?? 0) + a.prompts * d.share);
    const depts = [...deptTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const clsTotals = new Map<string, number>();
    for (const a of top) for (const k of a.dataClasses) clsTotals.set(k.name, (clsTotals.get(k.name) ?? 0) + a.prompts * k.share);
    const cls = classes.filter((k) => clsTotals.has(k.name)).sort((a, b) => (clsTotals.get(b.name) ?? 0) - (clsTotals.get(a.name) ?? 0));
    const columns: FlowColumn[] = [
      { label: 'Department', nodes: depts.map(([name, v]) => ({ id: `d:${name}`, title: name, count: fmtCompact(v), sub: 'prompts', icon: <Building2 />, onClick: () => setList({ title: name, sub: 'AI apps used by this department', apps: external.filter((a) => a.departments.some((d) => d.name === name)), metric: 'prompts' }) })) },
      { label: 'AI app', nodes: top.map((a) => ({ id: `a:${a.id}`, title: a.name, count: fmtNum(a.users), sub: a.status === 'shadow' ? 'users · shadow' : `users · ${a.status}`, state: a.status === 'shadow' ? ('bad' as const) : a.status === 'pilot' ? ('warn' as const) : ('good' as const), icon: a.status === 'shadow' ? <ShieldAlert /> : <Sparkles />, onClick: () => setSel(a) })) },
      { label: 'Data class in prompts', nodes: cls.map((k) => ({ id: `k:${k.name}`, title: k.name, count: fmtCompact(clsTotals.get(k.name) ?? 0), sub: k.sensitive ? 'sensitive' : 'not sensitive', state: k.sensitive ? ('warn' as const) : undefined, icon: <Database />, onClick: () => setList({ title: k.name, sub: k.sensitive ? 'Sensitive class · AI apps whose prompts carry it' : 'AI apps whose prompts carry this class', apps: external.filter((a) => a.dataClasses.some((x) => x.name === k.name)), metric: 'dlp' }) })) },
    ];
    const deptIds = new Set(depts.map(([n]) => n));
    const links: FlowLink[] = [];
    for (const a of top) {
      for (const d of a.departments) if (deptIds.has(d.name)) links.push({ from: `d:${d.name}`, to: `a:${a.id}`, value: a.prompts * d.share, bad: a.status === 'shadow' });
      for (const k of a.dataClasses) links.push({ from: `a:${a.id}`, to: `k:${k.name}`, value: a.prompts * k.share, bad: a.status === 'shadow' && !!classes.find((x) => x.name === k.name)?.sensitive });
    }
    return { columns, links };
  }, [external, classes]);

  const metricOf = (a: AiApp, m: AppList['metric']) => (m === 'users' ? `${fmtNum(a.users)} users` : m === 'prompts' ? `${fmtCompact(a.prompts)} prompts` : `${fmtNum(a.dlpEvents)} DLP events`);

  return (
    <>
      <p className="page-intro">
        AI in use at <b>{c.name}</b> · {tenantName(c, tenantId)}, discovered from {cp.label}, {identity.map((k) => `${k.vendor} ${k.product}`).join(' and ')} sign-in logs and the HexaComply AI register.
        Prompt sensitivity comes from inline DLP; nothing in a prompt body leaves your tenant.
      </p>

      <KpiStrip
        toneColor={AI_TONE}
        items={[
          { label: 'AI apps discovered', value: apps.length, unit: `${apps.filter((a) => a.kind === 'In-house model').length} in-house`, onClick: () => { setFilter('all'); scrollTo('ai-inventory'); }, source: srcText },
          { label: 'Governed AI systems', value: h.ai.aiSystems, unit: 'in AI register', onClick: () => { setFilter('sanctioned'); scrollTo('ai-inventory'); }, source: 'HexaComply AI register' },
          { label: 'Shadow AI', value: h.ai.shadowAi, unit: 'unsanctioned', toneColor: 'var(--bad)', onClick: () => { setFilter('shadow'); scrollTo('ai-inventory'); }, source: `${cp.label} · app discovery` },
          { label: 'Active AI users', hint: rangeLabel(timeRange), value: fmtNum(users), bar: (users / Math.max(1, c.employees * (tenantId === 'all' ? 1 : 0.3))) * 100, onClick: () => setList({ title: 'Active AI users by app', sub: rangeLabel(timeRange), apps: external, metric: 'users' }), source: identity.map((k) => `${k.vendor} ${k.product}`).join(' · ') },
          { label: 'Prompts observed', hint: rangeLabel(timeRange), value: fmtCompact(prompts), onClick: () => setList({ title: 'Prompts by app', sub: rangeLabel(timeRange), apps: external, metric: 'prompts' }), source: cp.label },
          { label: 'DLP events on prompts', hint: rangeLabel(timeRange), value: fmtNum(dlp), toneColor: 'var(--sev-high)', onClick: () => setList({ title: 'DLP events on AI prompts by app', sub: rangeLabel(timeRange), apps: apps.filter((a) => a.dlpEvents > 0), metric: 'dlp' }), source: `${cp.label} inline DLP` },
          { label: 'Agents & MCP servers', value: agents.length, unit: `${agents.filter((a) => a.status === 'unregistered').length} unregistered`, onClick: () => scrollTo('ai-agents'), source: 'Copilot Studio, Bedrock / Foundry, endpoint telemetry, OAuth grants' },
        ]}
      />

      <Card
        title="Prompt and data flow"
        sub={`Department → AI app → data class in prompts · ${rangeLabel(timeRange).toLowerCase()} · top apps by volume plus the riskiest shadow AI · red flows are shadow AI carrying sensitive data · click any card`}
        actions={<Sources items={srcs} />}
      >
        <FlowMap columns={flow.columns} links={flow.links} goodColor="#8f8cff" />
      </Card>

      <div className="grid g-3-2">
        <Card title="Sanctioned vs shadow" sub="Every AI app seen on the network or via SSO · click to filter the inventory">
          <div className="ai-split" style={{ marginBottom: 12 }}>
            {sanctioned.length > 0 && <i style={{ flex: sanctioned.length, background: '#2dd4bf' }} title={`Sanctioned: ${sanctioned.length}`} />}
            {pilot.length > 0 && <i style={{ flex: pilot.length, background: SEV_HEX.low }} title={`Pilot: ${pilot.length}`} />}
            {shadow.length > 0 && <i style={{ flex: shadow.length, background: SEV_HEX.critical }} title={`Shadow: ${shadow.length}`} />}
          </div>
          <div className="ai-tiles" style={{ marginBottom: 12 }}>
            <button className={`ai-tile ${filter === 'sanctioned' ? 'on' : ''}`} style={{ ['--tile' as string]: '#2dd4bf' }} onClick={() => { setFilter('sanctioned'); scrollTo('ai-inventory'); }} title="Source: HexaComply AI register"><b>{sanctioned.length + pilot.length}</b><span>Sanctioned & pilot</span></button>
            <button className={`ai-tile ${filter === 'shadow' ? 'on' : ''}`} style={{ ['--tile' as string]: SEV_HEX.critical }} onClick={() => { setFilter('shadow'); scrollTo('ai-inventory'); }} title={`Source: ${cp.label}`}><b>{shadow.length}</b><span>Shadow</span></button>
            <button className="ai-tile" style={{ ['--tile' as string]: SEV_HEX.high }} onClick={() => setList({ title: 'Shadow AI users', sub: 'Users of unsanctioned AI apps', apps: shadow, metric: 'users' })} title="Source: identity sign-in logs"><b>{fmtNum(shadow.reduce((s, a) => s + a.users, 0))}</b><span>Shadow AI users</span></button>
          </div>
          <div className="list">
            {shadow.slice(0, 5).map((a) => (
              <button key={a.id} className="list-row" style={{ padding: '6px 0' }} onClick={() => setSel(a)}>
                <i className="dot" style={{ background: 'var(--bad)' }} />
                <span className="list-main"><b>{a.name}</b><span>{a.users} users · {a.departments.map((d) => d.name).join(', ')} · {a.note}</span></span>
                <span className="num" style={{ color: scoreTone(100 - a.risk), fontWeight: 700 }} title="Risk score">{a.risk}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Sensitivity of prompts" sub={`Share of prompt volume by data class · inline DLP (${cp.connector.vendor})`} actions={<Freshness minutes={cp.connector.lastSyncMin} stale={isStale(cp.connector)} label={cp.connector.vendor} />}>
          {byClass.slice().sort((a, b) => b.prompts - a.prompts).map((k) => (
            <button key={k.name} className="list-row" style={{ padding: 0, display: 'block', width: '100%' }} onClick={() => setList({ title: k.name, sub: 'AI apps whose prompts carry this class', apps: external.filter((a) => a.dataClasses.some((x) => x.name === k.name)), metric: 'prompts' })}>
              <BarRow label={k.name} sub={k.sensitive ? 'Sensitive' : 'Not sensitive'} value={k.prompts} max={Math.max(...byClass.map((x) => x.prompts))} color={k.sensitive ? 'var(--sev-medium)' : 'var(--sev-info)'} display={fmtCompact(k.prompts)} />
            </button>
          ))}
        </Card>
      </div>

      <div id="ai-inventory">
        <Card
          title="AI inventory"
          count={shown.length}
          sub="Governed systems from the AI register plus SaaS AI discovered on the wire · click a row for detail and write-back"
          flush
          actions={<Tabs color={AI_TONE} value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All' }, { id: 'shadow', label: `Shadow (${shadow.length})` }, { id: 'sanctioned', label: 'Sanctioned & pilot' }]} />}
        >
          <DataTable
            rows={shown}
            rowKey={(a) => a.id}
            onRowClick={setSel}
            search={(a) => `${a.name} ${a.vendor} ${a.kind} ${a.departments.map((d) => d.name).join(' ')} ${a.owner}`}
            searchPlaceholder="Filter apps, vendors, departments…"
            initialSort={{ key: 'risk', dir: 'desc' }}
            columns={[
              { key: 'name', header: 'App', sort: (a) => a.name, render: (a) => (<><div className="t-main">{a.name}{changed[a.id] && <> <Badge color={changed[a.id] === 'blocked' ? 'var(--bad)' : 'var(--good)'}>{changed[a.id] === 'blocked' ? 'Block requested' : 'Guardrails requested'}</Badge></>}</div><div className="t-sub">{a.vendor} · {a.kind}</div></>) },
              { key: 'status', header: 'Status', sort: (a) => a.status, render: (a) => <AiStatusBadge status={a.status} /> },
              { key: 'users', header: 'Users', align: 'right', sort: (a) => a.users, render: (a) => fmtNum(a.users) },
              { key: 'dept', header: 'Departments', render: (a) => <span className="t-sub">{a.departments.map((d) => d.name).join(', ')}</span> },
              { key: 'prompts', header: `Prompts / calls (${days === 1 ? '24 h' : `${days} d`})`, align: 'right', sort: (a) => a.prompts, render: (a) => <span title={a.kind === 'In-house model' ? 'Inference calls' : 'Prompts'}>{fmtCompact(a.prompts)}</span> },
              { key: 'sens', header: 'Sensitive', align: 'right', sort: (a) => a.sensitivePct, render: (a) => <span style={{ color: a.sensitivePct > 40 ? 'var(--sev-high)' : undefined }}>{a.sensitivePct}%</span> },
              { key: 'dlp', header: 'DLP events', align: 'right', sort: (a) => a.dlpEvents, render: (a) => fmtNum(a.dlpEvents) },
              { key: 'risk', header: 'Risk', sort: (a) => a.risk, render: (a) => (<div style={{ minWidth: 90 }}><Bar value={a.risk} color={scoreTone(100 - a.risk)} size="thin" /><span className="t-sub">{a.risk} / 100</span></div>) },
              { key: 'owner', header: 'Owner', sort: (a) => a.owner, render: (a) => <span className={a.owner === 'Unassigned' ? 'muted' : ''}>{a.owner}</span> },
            ]}
          />
        </Card>
      </div>

      <div className="grid g2">
        <div id="ai-agents">
          <Card title="Agents and MCP servers" count={agents.length} sub="Discovered from Copilot Studio, Bedrock / Foundry, endpoint telemetry and OAuth grants" flush>
            <div className="list" style={{ padding: '0 18px 8px' }}>
              {agents.map((a) => (
                <button key={a.name} className="list-row" onClick={() => setAgent(a)}>
                  <span className="ico-box" style={{ ['--tone' as string]: a.status === 'unregistered' ? 'var(--bad)' : AI_TONE }}>{a.kind === 'MCP server' ? <Server /> : <Bot />}</span>
                  <span className="list-main">
                    <b>{a.name}</b>
                    <span>{a.kind} · {a.platform} · {a.dataAccess}</span>
                  </span>
                  <StatusBadge value={a.status} map={{ approved: 'var(--good)', 'in review': 'var(--sev-medium)', unregistered: 'var(--bad)' }} />
                </button>
              ))}
            </div>
          </Card>
        </div>
        <Card title="DLP outcomes on AI prompts" sub={`${rangeLabel(timeRange)} · ${cp.label}`} actions={<Sources items={[{ name: cp.connector.product, status: cp.connector.status }]} />}>
          <ChartLegend items={[{ label: `Blocked ${fmtNum(trend.blocked.reduce((s, x) => s + x, 0))}`, color: SEV_HEX.critical }, { label: `Coached ${fmtNum(trend.coached.reduce((s, x) => s + x, 0))}`, color: SEV_HEX.medium }, { label: `Allowed (logged) ${fmtNum(trend.allowed.reduce((s, x) => s + x, 0))}`, color: '#8a9bc0' }]} />
          <SvgColumns labels={labels} height={230} series={[{ name: 'Blocked', color: SEV_HEX.critical, data: trend.blocked }, { name: 'Coached', color: SEV_HEX.medium, data: trend.coached }, { name: 'Allowed (logged)', color: '#8a9bc0', data: trend.allowed }]} />
        </Card>
      </div>

      <Card title="In-house and clinical / production models" count={models.length} sub="Model cards from the AI register (ISO/IEC 42001) · runtime drift from HexaAI monitors">
        <div className="grid g4">
          {models.map((m) => (
            <button key={m.name} className="ai-model" onClick={() => setModel(m)}>
              <div className="row">
                <span className="ico-box" style={{ ['--tone' as string]: AI_TONE }}><FileText /></span>
                <div style={{ minWidth: 0 }}>
                  <h4>{m.name}</h4>
                  <div className="t-sub">{m.version} · {m.owner}</div>
                </div>
              </div>
              <div className="t-sub" style={{ lineHeight: 1.4 }}>{m.purpose}</div>
              <div className="chips">
                <Badge color={m.euAiAct.startsWith('High') ? 'var(--bad)' : 'var(--sev-info)'}>{m.euAiAct.split(' (')[0]}</Badge>
                <StatusBadge value={m.drift} map={{ stable: 'var(--good)', watch: 'var(--sev-medium)', drifting: 'var(--bad)' }} />
              </div>
              <div className="t-sub">Last evaluated {m.lastEvalDays} d ago · {m.metrics[0][0]} {m.metrics[0][1]}</div>
            </button>
          ))}
        </div>
      </Card>

      {list && (
        <Drawer title={list.title} sub={`${list.sub} · ${list.apps.length} apps · source: ${srcText}`} icon={<span className="ico-box" style={{ ['--tone' as string]: AI_TONE }}><Sparkles /></span>} onClose={() => setList(null)}>
          <div className="list">
            {list.apps.slice().sort((a, b) => (list.metric === 'users' ? b.users - a.users : list.metric === 'prompts' ? b.prompts - a.prompts : b.dlpEvents - a.dlpEvents)).map((a) => (
              <button key={a.id} className="list-row" onClick={() => { setList(null); setSel(a); }}>
                <i className="dot" style={{ background: AI_STATUS_COLOR[a.status] }} />
                <span className="list-main"><b>{a.name}</b><span>{a.vendor} · {a.kind} · {a.status}</span></span>
                <span className="num" style={{ fontWeight: 700 }}>{metricOf(a, list.metric)}</span>
              </button>
            ))}
          </div>
          <Sources items={srcs} />
        </Drawer>
      )}

      {sel && (
        <Drawer
          title={sel.name}
          sub={`${sel.vendor} · ${sel.kind}`}
          icon={<span className="ico-box" style={{ ['--tone' as string]: AI_STATUS_COLOR[sel.status] }}>{sel.status === 'shadow' ? <ShieldAlert /> : <ShieldCheck />}</span>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn danger onClick={() => setAct({ app: sel, mode: 'block' })}><Ban /> Block app</Btn>
              <Btn primary color={AI_TONE} onClick={() => setAct({ app: sel, mode: 'guard' })}><ShieldCheck /> {sel.status === 'shadow' ? 'Allow with guardrails' : 'Tighten guardrails'}</Btn>
            </>
          }
        >
          {sel.status === 'shadow' && <Callout kind="warn">Not in the AI register and no owner. First seen {sel.firstSeenDays} days ago. {sel.note}.</Callout>}
          <KV
            rows={[
              ['Status', <AiStatusBadge status={sel.status} />],
              ['Users', `${fmtNum(sel.users)} (${tenantName(c, tenantId)})`],
              [sel.kind === 'In-house model' ? 'Inference calls' : 'Prompts', `${fmtNum(sel.prompts)} · ${rangeLabel(timeRange).toLowerCase()}`],
              ['Sensitive prompts', `${sel.sensitivePct}% · ${fmtNum(sel.dlpEvents)} DLP events`],
              ['Risk score', <span style={{ color: scoreTone(100 - sel.risk), fontWeight: 700 }}>{sel.risk} / 100</span>],
              ['Owner', sel.owner],
              ['Data residency', sel.residency],
              ['AI regulation', sel.euAiAct],
              ['Guardrails', <span className="chips">{sel.guardrails.map((g) => <Badge key={g}>{g}</Badge>)}</span>],
            ]}
          />
          <div>
            <div className="section-label">Departments</div>
            {sel.departments.map((d) => <BarRow key={d.name} label={d.name} value={Math.round(d.share * 100)} color={AI_TONE} display={`${Math.round(d.share * 100)}%`} />)}
          </div>
          <div>
            <div className="section-label">Data classes in prompts</div>
            {sel.dataClasses.slice().sort((a, b) => b.share - a.share).map((k) => {
              const sens = classes.find((x) => x.name === k.name)?.sensitive;
              return <BarRow key={k.name} label={k.name} sub={sens ? 'Sensitive' : undefined} value={Math.round(k.share * 100)} color={sens ? 'var(--sev-medium)' : 'var(--sev-info)'} display={`${Math.round(k.share * 100)}%`} />;
            })}
          </div>
          <div>
            <div className="section-label">Seen by</div>
            <Sources items={srcs} />
          </div>
        </Drawer>
      )}

      {model && (
        <Drawer title={`Model card · ${model.name}`} sub={`${model.version} · owner ${model.owner}`} icon={<span className="ico-box" style={{ ['--tone' as string]: AI_TONE }}><FileText /></span>} onClose={() => setModel(null)}>
          <KV
            rows={[
              ['Purpose', model.purpose],
              ['Algorithm', model.algorithm],
              ['Training data', model.training],
              ...model.metrics,
              ['Regulatory class', model.euAiAct],
              ['ISO/IEC 42001', model.iso42001],
              ['Human oversight', model.humanOversight],
              ['Last evaluation', `${model.lastEvalDays} days ago`],
              ['Runtime drift', <StatusBadge value={model.drift} map={{ stable: 'var(--good)', watch: 'var(--sev-medium)', drifting: 'var(--bad)' }} />],
            ]}
          />
          {model.euAiAct.startsWith('High') && <Callout kind="warn">High-risk system: conformity assessment, logging (Art. 12) and human oversight (Art. 14) evidence is tracked in HexaComply AI governance.</Callout>}
          {model.drift === 'drifting' && <Callout kind="warn">Output drift detected against the last evaluation set. Re-evaluation and a red-team run are recommended before the next release.</Callout>}
        </Drawer>
      )}

      {agent && (
        <Drawer title={agent.name} sub={`${agent.kind} · ${agent.platform}`} icon={<span className="ico-box" style={{ ['--tone' as string]: AI_TONE }}>{agent.kind === 'MCP server' ? <Server /> : <Bot />}</span>} onClose={() => setAgent(null)}>
          {agent.status === 'unregistered' && <Callout kind="warn">Unregistered: discovered from endpoint and OAuth telemetry, not in the AI register. Credentials are {agent.auth.toLowerCase()}.</Callout>}
          <KV rows={[['Owner', agent.owner], ['Tools exposed', <span className="chips">{agent.tools.map((t) => <Badge key={t}><span className="mono">{t}</span></Badge>)}</span>], ['Data access', agent.dataAccess], ['Auth', agent.auth], ['Status', agent.status], ['Risk', `${agent.risk} / 100`], ['First seen', `${agent.seenDays} days ago`]]} />
          <Btn onClick={() => { toast(`Registration request sent to ${agent.owner.startsWith('Unknown') ? c.people.admin.name : agent.owner}`); setAgent(null); }}>Request registration from owner</Btn>
        </Drawer>
      )}

      {act && (
        <ApprovalModal
          title={act.mode === 'block' ? `Block ${act.app.name}` : `${act.app.status === 'shadow' ? 'Allow' : 'Tighten'} ${act.app.name} with guardrails`}
          connector={cp.label}
          operation={act.mode === 'block' ? cp.blockAction : cp.guardrailAction}
          risk="medium"
          change={
            act.mode === 'block'
              ? `${act.app.name} is blocked for ${fmtNum(act.app.users)} users; they see a coaching page that points to ${act.app.kind === 'GenAI SaaS' ? 'the sanctioned alternative' : 'the AI policy'}. Existing data at the vendor is not deleted.`
              : `${act.app.name} stays available behind SSO with inline DLP blocking ${classes.filter((k) => k.sensitive).map((k) => k.name.toLowerCase()).slice(0, 3).join(', ')}; the app is added to the AI register with an owner.`
          }
          approvers={[c.people.ciso.name]}
          onClose={() => setAct(null)}
          onSubmit={() => {
            setChanged((m) => ({ ...m, [act.app.id]: act.mode === 'block' ? 'blocked' : 'guarded' }));
            toast(`${act.mode === 'block' ? 'Block' : 'Guardrail'} request for ${act.app.name} sent to ${c.people.ciso.name} (${cp.connector.vendor})`);
            setAct(null);
            setSel(null);
          }}
        />
      )}
    </>
  );
}
