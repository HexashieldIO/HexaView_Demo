import { useMemo, useState } from 'react';
import { Crosshair, Scissors, Target, Globe2, KeyRound, Server, Factory, Gem } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { RecordsDrawer, scrollToId } from '../insurance/viz';
import { useApp } from '../../state/AppContext';
import { attackPaths, chokePoints, techName, type AttackPath, type PathNode, type PathNodeKind } from '../../data/modules/fabric';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Chip } from '../../components/ui';

import { Drawer } from '../../components/Overlay';
import { TONE, toneStyle } from './parts';
import './fabric.css';

const KIND_COLOR: Record<PathNodeKind, string> = {
  entry: '#f2643f', identity: '#a07cfb', host: '#68b1ff', ot: '#f7a04a', jewel: '#ecc873',
};
const KIND_LABEL: Record<PathNodeKind, string> = { entry: 'Entry point', identity: 'Identity', host: 'Host', ot: 'OT device', jewel: 'Crown jewel' };
const KIND_ICON: Record<PathNodeKind, typeof Globe2> = { entry: Globe2, identity: KeyRound, host: Server, ot: Factory, jewel: Gem };

export default function FabricPaths() {
  const { customer: c, tenantId } = useApp();
  const { nodes, paths } = useMemo(() => attackPaths(c, tenantId), [c, tenantId]);
  const chokes = useMemo(() => chokePoints(c, tenantId), [c, tenantId]);
  const [params] = useSearchParams();
  const [sel, setSel] = useState<AttackPath | null>(() => paths.find((p) => p.id === params.get('path')) ?? null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [nodeRec, setNodeRec] = useState<PathNode | null>(null);
  const [rec, setRec] = useState<null | 'paths' | 'high' | 'entries' | 'jewels' | 'chokes' | 'ot'>(null);

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const activeSteps = sel ? new Set<string>(sel.steps) : null;
  const activeEdges = useMemo(() => {
    const set = new Set<string>();
    if (sel) for (let i = 0; i < sel.steps.length - 1; i++) set.add(`${sel.steps[i]}>${sel.steps[i + 1]}`);
    return set;
  }, [sel]);

  // Layered layout: each node sits one column right of its deepest predecessor; crown jewels last.
  const edgeSet = new Map<string, number>();
  for (const p of paths) for (let i = 0; i < p.steps.length - 1; i++) {
    const key = `${p.steps[i]}>${p.steps[i + 1]}`;
    edgeSet.set(key, (edgeSet.get(key) ?? 0) + 1);
  }
  const depth = new Map<string, number>();
  for (const n of nodes) depth.set(n.id, n.kind === 'entry' ? 0 : 1);
  for (let it = 0; it < 8; it++) for (const key of edgeSet.keys()) {
    const [s, t] = key.split('>');
    depth.set(t, Math.max(depth.get(t) ?? 1, (depth.get(s) ?? 0) + 1));
  }
  const maxDepth = Math.max(1, ...nodes.filter((n) => n.kind !== 'jewel').map((n) => depth.get(n.id) ?? 1)) + 1;
  for (const n of nodes) if (n.kind === 'jewel') depth.set(n.id, maxDepth);
  const usedCols = [...new Set(nodes.map((n) => depth.get(n.id) ?? 0))].sort((a, b) => a - b);
  const colLabel = (ns: PathNode[]) => {
    const kinds = [...new Set(ns.map((n) => n.kind))];
    return kinds.length === 1 ? (kinds[0] === 'entry' ? 'Entry points' : kinds[0] === 'jewel' ? 'Crown jewels' : kinds[0] === 'identity' ? 'Identities' : kinds[0] === 'host' ? 'Hosts' : 'OT devices') : kinds.map((k) => KIND_LABEL[k].split(' ')[0]).join(' / ');
  };
  const columns: FlowColumn[] = usedCols.map((d) => {
    const ns = nodes.filter((n) => (depth.get(n.id) ?? 0) === d);
    return {
      label: colLabel(ns),
      nodes: ns.map((n) => {
        const Icon = KIND_ICON[n.kind];
        const through = paths.filter((p) => p.steps.includes(n.id)).length;
        const choke = chokes.find((ch) => ch.node.id === n.id);
        return {
          id: n.id, title: <span title={`${n.label} · ${n.sub}`}>{n.label}</span>, icon: <Icon />, color: KIND_COLOR[n.kind],
          count: through, sub: `path${through === 1 ? '' : 's'}${choke ? ' · choke' : ''}`,
          state: activeSteps && !activeSteps.has(n.id) ? undefined : choke ? 'warn' as const : undefined,
          onClick: () => setNodeRec(n),
        };
      }),
    };
  });
  const links: FlowLink[] = [...edgeSet.entries()].map(([key, n]) => {
    const [from, to] = key.split('>');
    const active = activeEdges.has(key);
    return { from, to, value: n, bad: active || (!sel && byId[to]?.kind === 'jewel'), color: sel && !active ? 'rgba(133,147,180,.25)' : undefined };
  });

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · attack paths computed across the unified graph — from entry points (internet-facing hosts, phished users, vendor remote access) through identities and hosts to crown jewels{c.id === 'maritime' ? ', including IT→OT routes to the crane PLCs' : ''}. {paths.length} material paths; fixing a choke point cuts several at once.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Attack paths', value: paths.length, hint: 'to crown jewels', toneColor: TONE, onClick: () => setRec('paths'), source: 'HexaCore graph over identity, EDR, vulnerability and OT data' },
          { label: 'High likelihood', value: paths.filter((p) => p.likelihood === 'High').length, toneColor: 'var(--sev-high)', onClick: () => setRec('high'), source: 'HexaCore graph · HexaInt actor TTPs' },
          { label: 'Entry points', value: nodes.filter((n) => n.kind === 'entry').length, toneColor: 'var(--sev-medium)', onClick: () => setRec('entries'), source: 'HexaStrike ASM · email · vendor access' },
          { label: 'Crown jewels reachable', value: new Set(paths.map((p) => p.steps[p.steps.length - 1])).size, toneColor: 'var(--m-custody)', onClick: () => setRec('jewels'), source: 'Crown-jewel register (HexaComply)' },
          { label: 'Choke points', value: chokes.length, hint: 'fix these first', toneColor: 'var(--good)', onClick: () => scrollToId('fab-chokes'), source: 'HexaCore graph (path intersection)' },
          ...(nodes.some((n) => n.kind === 'ot') ? [{ label: 'IT→OT paths', value: paths.filter((p) => p.steps.some((s) => byId[s]?.kind === 'ot')).length, toneColor: 'var(--m-ot)', onClick: () => setRec('ot'), source: 'HexaCore graph · OT asset inventory' }] : []),
        ]}
      />

      <Card title="Attack path graph" sub={sel ? `Highlighting ${sel.id}: ${sel.name}` : 'Entry points through identities and hosts to crown jewels · red flows reach a crown jewel · click a node for the paths through it, or a path below to highlight it'}
        actions={sel && <Btn sm onClick={() => setSel(null)}>Clear highlight</Btn>}>
        <div className="fab-legend" style={{ marginBottom: 10 }}>
          {(['entry', 'identity', 'host', 'ot', 'jewel'] as PathNodeKind[]).filter((k) => nodes.some((n) => n.kind === k)).map((k) => (
            <span key={k}><i style={{ background: KIND_COLOR[k] }} />{KIND_LABEL[k]}</span>
          ))}
          <span><i style={{ background: 'var(--sev-medium)' }} />Choke point</span>
        </div>
        <div className="fab-pathmap"><FlowMap columns={columns} links={links} /></div>
      </Card>

      <div className="grid g-3-2">
        <Card title={<><Scissors size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> <span id="fab-chokes">Choke points</span></>} sub="Ranked by the number of paths each one cuts">
          <div className="stack">
            {chokes.map((ch) => (
              <div key={ch.node.id} className={`fab-path ${highlight === ch.node.id ? 'on' : ''}`} onMouseEnter={() => setHighlight(ch.node.id)} onMouseLeave={() => setHighlight(null)} style={{ cursor: 'default' }}>
                <div className="row between">
                  <b style={{ fontSize: 12.5 }}>{ch.node.label}</b>
                  <Badge color="var(--sev-high)">cuts {ch.paths} path{ch.paths === 1 ? '' : 's'}</Badge>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{ch.node.sub}</div>
                <div style={{ fontSize: 11.5, marginTop: 6 }}><b style={{ color: 'var(--good)' }}>Fix:</b> {ch.fix}</div>
                <div className="row between" style={{ marginTop: 8 }}>
                  <Badge color="var(--m-core)">{ch.effort}</Badge>
                  <span className="muted" style={{ fontSize: 10.5 }}>Owner: {ch.owner}</span>
                </div>
              </div>
            ))}
            {chokes.length === 0 && <div className="empty">No shared choke points — paths are independent.</div>}
          </div>
        </Card>

      <Card title="Attack paths" count={paths.length} sub="Click a path to highlight it on the graph">
        <div className="stack">
          {paths.map((p) => (
            <div key={p.id} className={`fab-path ${sel?.id === p.id ? 'on' : ''}`} onClick={() => setSel(sel?.id === p.id ? null : p)}>
              <div className="row between">
                <b style={{ fontSize: 13 }}>{p.name}</b>
                <Badge color={p.likelihood === 'High' ? 'var(--sev-high)' : p.likelihood === 'Medium' ? 'var(--sev-medium)' : 'var(--sev-info)'}>{p.likelihood}</Badge>
              </div>
              <div className="fab-steps">
                {p.steps.map((s, i) => {
                  const n = byId[s];
                  return (
                    <span key={s} style={{ display: 'contents' }}>
                      <span className={`fab-step ${n?.kind === 'entry' ? 'entry' : n?.kind === 'jewel' ? 'jewel' : n?.kind === 'ot' ? 'ot' : ''}`}>{n?.label ?? s}</span>
                      {i < p.steps.length - 1 && <span className="fab-arrow">→</span>}
                    </span>
                  );
                })}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 7 }}>Modelled actor: {p.actor} · {p.techniques.length} techniques</div>
            </div>
          ))}
        </div>
      </Card>
      </div>

      {nodeRec && (
        <RecordsDrawer title={nodeRec.label} sub={`${KIND_LABEL[nodeRec.kind]} · ${nodeRec.sub}`} source="HexaCore graph" onClose={() => setNodeRec(null)}
          rows={paths.filter((p) => p.steps.includes(nodeRec.id)).map((p) => ({ key: p.id, title: `${p.id} · ${p.name}`, sub: `${p.actor} · ${p.evidence}`, badge: <Badge color={p.likelihood === 'High' ? 'var(--sev-high)' : p.likelihood === 'Medium' ? 'var(--sev-medium)' : 'var(--sev-info)'}>{p.likelihood}</Badge>, onClick: () => { setNodeRec(null); setSel(p); } }))}>
          {chokes.find((ch) => ch.node.id === nodeRec.id) && <Callout kind="good"><b>Choke point.</b> {chokes.find((ch) => ch.node.id === nodeRec.id)!.fix}</Callout>}
        </RecordsDrawer>
      )}
      {rec && (
        <RecordsDrawer
          title={rec === 'entries' ? 'Entry points' : rec === 'jewels' ? 'Crown jewels reachable' : rec === 'high' ? 'High-likelihood paths' : rec === 'ot' ? 'IT→OT paths' : 'Attack paths'}
          source="HexaCore graph over identity, EDR, vulnerability and OT connectors"
          onClose={() => setRec(null)}
          rows={rec === 'entries' || rec === 'jewels'
            ? nodes.filter((n) => n.kind === (rec === 'entries' ? 'entry' : 'jewel')).map((n) => ({ key: n.id, title: n.label, sub: n.sub, right: `${paths.filter((p) => p.steps.includes(n.id)).length} paths`, onClick: () => { setRec(null); setNodeRec(n); } }))
            : paths.filter((p) => rec === 'paths' || (rec === 'high' ? p.likelihood === 'High' : p.steps.some((s) => byId[s]?.kind === 'ot'))).map((p) => ({ key: p.id, title: `${p.id} · ${p.name}`, sub: `${p.actor} · ${p.steps.length} steps · ${p.techniques.join(', ')}`, badge: <Badge color={p.likelihood === 'High' ? 'var(--sev-high)' : p.likelihood === 'Medium' ? 'var(--sev-medium)' : 'var(--sev-info)'}>{p.likelihood}</Badge>, onClick: () => { setRec(null); setSel(p); } }))}
        />
      )}

      {sel && (
        <Drawer wide onClose={() => setSel(null)} title={sel.name} sub={`${sel.id} · ${sel.likelihood} likelihood`}
          icon={<span className="ico-box" style={{ '--tone': 'var(--sev-high)' } as React.CSSProperties}><Target /></span>}>
          <Callout kind="warn"><b>Modelled actor: {sel.actor}.</b> This path is reconstructed from your own telemetry, not an active intrusion. Fixing any choke point on it breaks the chain.</Callout>
          <div>
            <div className="section-label">Path</div>
            <div className="fab-steps">
              {sel.steps.map((s, i) => {
                const n = byId[s];
                return (
                  <span key={s} style={{ display: 'contents' }}>
                    <span className={`fab-step ${n?.kind === 'entry' ? 'entry' : n?.kind === 'jewel' ? 'jewel' : n?.kind === 'ot' ? 'ot' : ''}`} title={n?.sub}>{n?.label ?? s}</span>
                    {i < sel.steps.length - 1 && <span className="fab-arrow">→</span>}
                  </span>
                );
              })}
            </div>
          </div>
          <KV rows={[
            ['Entry', byId[sel.steps[0]]?.sub ?? '—'],
            ['Target', `${byId[sel.steps[sel.steps.length - 1]]?.label} (crown jewel)`],
            ['Likelihood', <Badge color={sel.likelihood === 'High' ? 'var(--sev-high)' : 'var(--sev-medium)'}>{sel.likelihood}</Badge>],
            ['Evidence', sel.evidence],
            ['Tenants', sel.tenants.join(', ')],
          ]} />
          <div>
            <div className="section-label"><Crosshair size={12} style={{ verticalAlign: -2 }} /> ATT&CK techniques</div>
            <div className="chips">{sel.techniques.map((t) => <Chip key={t}>{t} · {techName(t)}</Chip>)}</div>
          </div>
          <div>
            <div className="section-label">Choke points on this path</div>
            <div className="list">
              {chokes.filter((ch) => sel.steps.includes(ch.node.id)).map((ch) => (
                <div key={ch.node.id} className="list-row">
                  <Scissors size={14} style={{ color: 'var(--good)' }} />
                  <span className="list-main"><b>{ch.node.label}</b><span>{ch.fix}</span></span>
                  <Badge color="var(--m-core)">{ch.effort}</Badge>
                </div>
              ))}
              {chokes.filter((ch) => sel.steps.includes(ch.node.id)).length === 0 && <div className="empty">No ranked choke point on this specific path.</div>}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
