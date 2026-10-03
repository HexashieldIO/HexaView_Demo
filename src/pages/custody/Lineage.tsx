import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitBranch, ShieldCheck, ShieldAlert, FileLock2, Copy, Archive, Send, Sparkles, Ban } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { custodyScope, lineageViews, type LNode, type LineageView } from '../../data/modules/custody';
import { KpiStrip, Card, Badge, StatusBadge, Chip, Timeline } from '../../components/ui';
import { FlowMap, type FlowColumn } from '../../components/FlowMap';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtDateTime, ago, fmtNum } from '../../lib/format';
import { CUSTODY_TONE } from './parts';

const TAG_COLOR: Record<string, string> = { Verified: 'var(--good)', 'Signature broken': 'var(--bad)', 'Left the estate': 'var(--sev-high)', Untagged: 'var(--sev-medium)' };
const STATE_COLOR: Record<string, string> = { verified: 'var(--good)', broken: 'var(--bad)', revoked: 'var(--text-muted)', untracked: 'var(--sev-high)' };
const STATE_LABEL: Record<string, string> = { verified: 'Verified', broken: 'Signature broken', revoked: 'Revoked', untracked: 'Left the estate' };
const DEPTH_LABEL = ['Origin', 'Custody vault', 'First hop', 'Second hop', 'Third hop', 'Fourth hop', 'Fifth hop', 'Sixth hop'];

function nodeIcon(n: LNode) {
  if (n.state === 'revoked') return <Ban size={13} />;
  if (n.kind === 'DERIVATIVE') return <Sparkles size={13} />;
  if (n.kind === 'ARCHIVE') return <Archive size={13} />;
  if (n.kind === 'TRANSFER') return <Send size={13} />;
  if (n.kind === 'CREATED') return <FileLock2 size={13} />;
  return <Copy size={13} />;
}

export default function CustodyLineage() {
  const { customer: c, tenantId } = useApp();
  const [params, setParams] = useSearchParams();
  const sc = useMemo(() => custodyScope(c, tenantId), [c, tenantId]);
  const views = useMemo(() => lineageViews(c, tenantId), [c, tenantId]);
  const status = params.get('status');
  const list = views.filter((v) => !status || (status === 'broken' ? v.status === 'Signature broken' : status === 'untagged' ? v.status === 'Untagged' : status === 'left' ? v.leftEstate > 0 : v.status === 'Verified'));
  const idx = Number(params.get('asset') ?? NaN);
  const view: LineageView | undefined = (Number.isFinite(idx) ? views[idx] : undefined) ?? list[0] ?? views[0];
  const nodeId = params.get('node');
  const node = view?.nodes.find((n) => n.id === nodeId) ?? view?.nodes.find((n) => n.state === 'broken' || n.state === 'untracked') ?? view?.nodes[0];
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v === null ? p.delete(k) : p.set(k, v));
    setParams(p, { replace: true });
  };

  const cols: FlowColumn[] = useMemo(() => {
    if (!view) return [];
    const D = Math.max(...view.nodes.map((n) => n.depth));
    const out: FlowColumn[] = [];
    for (let d = 0; d <= D; d++) {
      const ns = view.nodes.filter((n) => n.depth === d);
      out.push({
        label: DEPTH_LABEL[d] ?? `Hop ${d - 1}`,
        nodes: ns.map((n) => ({
          id: n.id,
          title: <span><span className="custody-kind">{n.kind}</span><br />{n.location}</span>,
          icon: nodeIcon(n),
          sub: `${n.user} · ${fmtAgo(n.minAgo)}`,
          state: n.state === 'broken' || n.state === 'untracked' ? 'bad' as const : n.state === 'revoked' ? 'warn' as const : undefined,
          color: n.id === node?.id ? 'var(--m-custody)' : n.state === 'verified' ? (d === 0 ? 'var(--accent)' : 'var(--good)') : undefined,
          onClick: () => set({ node: n.id }),
        })),
      });
    }
    return out;
  }, [view, node?.id]);

  if (!view) return null;
  const links = view.nodes.filter((n) => n.parent).map((n) => ({ from: n.parent!, to: n.id, value: n.kind === 'DERIVATIVE' ? 3 : 1, bad: n.state === 'broken' || n.state === 'untracked' }));
  const allNodes = views.flatMap((v) => v.nodes.map((n) => ({ ...n, asset: v.asset.name, assetIdx: views.indexOf(v) })));
  const custodyConn = c.connectors.find((k) => k.category === 'Custody');
  const SRC = custodyConn ? `${custodyConn.vendor === 'HexaShield' ? '' : `${custodyConn.vendor} `}${custodyConn.product}` : 'HexaCustody agents';
  const valid = node ? node.state !== 'broken' : true;

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {sc.tenantName}. Where each file of {sc.label.toLowerCase()} went: every copy and derivative, which organisation holds it now, and whether its signature still verifies. Tags are written on create, verified on every open and reported on egress by {SRC}.
      </p>

      <KpiStrip
        toneColor={CUSTODY_TONE}
        items={[
          { label: 'Assets', hint: 'under custody', value: fmtNum(sc.h.assetsUnderCustody), onClick: () => set({ status: null }), source: SRC },
          { label: 'Copies', hint: `of ${views.length} key assets`, value: allNodes.length, onClick: () => document.getElementById('custody-copies')?.scrollIntoView({ behavior: 'smooth' }), source: SRC },
          { label: 'Organisations', hint: 'holding a copy', value: new Set(allNodes.map((n) => n.org)).size, to: '/custody/vendors', source: SRC },
          { label: 'Left the estate', hint: 'copies', value: allNodes.filter((n) => n.leftEstate).length, toneColor: 'var(--bad)', onClick: () => set({ status: 'left', asset: null, node: null }), source: SRC },
          { label: 'Signature broken', hint: 'assets', value: views.filter((v) => v.status === 'Signature broken').length, toneColor: 'var(--bad)', onClick: () => set({ status: 'broken', asset: null, node: null }), source: `${SRC} · signature verification` },
          { label: 'Untagged', hint: 'assets', value: views.filter((v) => v.status === 'Untagged').length, toneColor: 'var(--sev-medium)', onClick: () => set({ status: 'untagged', asset: null, node: null }), source: SRC },
        ]}
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(200px, 0.8fr) minmax(0, 3.4fr)' }}>
        <Card title="Assets" count={list.length} sub={status ? <button className="link" onClick={() => set({ status: null })}>Filtered · show all</button> : 'Click to trace'} flush>
          <div className="custody-assets" style={{ padding: '0 10px 10px' }}>
            {list.map((v) => (
              <button key={v.asset.id} className={`custody-asset ${v === view ? 'on' : ''}`} onClick={() => set({ asset: String(views.indexOf(v)), node: null })}>
                <span className="list-main">
                  <b>{v.asset.name}</b>
                  <span><Badge color={TAG_COLOR[v.status]}>{v.status}</Badge> {v.asset.project}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card
          title={<><GitBranch size={15} /> Where this file went</>}
          sub={`${view.asset.name} · ${view.asset.sizeLabel} · ${view.asset.classification} · created ${fmtAgo(view.createdMinAgo)} by ${view.createdBy}`}
          toneColor={CUSTODY_TONE}
          actions={<span className="chips"><Badge color="var(--text-muted)">{view.nodes.length - 1} hops</Badge><Badge color="var(--text-muted)">{view.orgs} organisations</Badge>{view.leftEstate > 0 && <Badge color="var(--bad)" solid>{view.leftEstate} left the estate</Badge>}</span>}
        >
          <div className="custody-lin">
            <FlowMap columns={cols} links={links} goodColor="#4f8cff" footer="Blue curves are sanctioned hand-offs; red dashed curves left the sanctioned chain. Click a copy to inspect its signature." />
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Cryptographic inspector" sub={node ? `${node.kind} · ${node.location}` : ''}>
          {node && (
            <>
              <div className="custody-verdict" style={{ ['--v' as string]: valid ? 'var(--good)' : 'var(--bad)' }}>
                {valid ? <ShieldCheck /> : <ShieldAlert />}
                <div>
                  <b>{valid ? 'Signature valid' : 'Signature broken'}</b>
                  <span>{valid ? (node.state === 'revoked' ? 'The tag verifies, but the grant was revoked: the copy cannot be opened.' : node.state === 'untracked' ? 'The tag verifies and the watermark is bound, but this copy is outside the sanctioned chain.' : 'The packet verifies against the signing key on record.') : 'The tagged hash does not match the bytes on disk. Treat this copy as altered.'}</span>
                </div>
              </div>
              <div className="custody-ids">
                <span><em>Project ID</em><b>{view.projectId}</b></span>
                <span><em>Asset ID</em><b>{view.asset.id}</b></span>
                <span><em>Holder</em><b>{node.org}</b></span>
                <span><em>Device</em><b>{node.machine}</b></span>
                <span><em>Algorithm</em><b>{view.algorithm}</b></span>
                <span><em>Signing key</em><b>{view.signingKey}</b></span>
                <span><em>Signed at</em><b>{fmtDateTime(ago(node.minAgo))}</b></span>
                <span><em>Watermark</em><b>{node.watermark}</b></span>
              </div>
              <div className="section-label">Original SHA-256</div>
              <div className="custody-hashbox">{view.originalSha}</div>
              <div className="section-label" style={{ marginTop: 10 }}>Tagged SHA-256 (this copy)</div>
              <div className="custody-hashbox" style={{ color: valid ? undefined : 'var(--bad)' }}>{node.sha256}</div>
              {node.note && <div className="t-sub" style={{ marginTop: 8 }}>{node.note}</div>}
            </>
          )}
        </Card>
        <Card title="Lifecycle" count={view.events.length} sub="Every custody event for this asset, newest first">
          <Timeline items={view.events.slice().sort((x, y) => x.minAgo - y.minAgo).map((e) => ({
            time: fmtDateTime(ago(e.minAgo)),
            title: <span><span className="custody-kind" style={{ color: e.sev === 'critical' ? 'var(--sev-critical)' : e.sev === 'high' ? 'var(--sev-high)' : undefined }}>{e.kind}{e.sev ? ` · ${e.sev}` : ''}</span><br />{e.text}</span>,
            body: <>{e.who}{e.nodeId && <> · <button className="link" onClick={() => set({ node: e.nodeId! })}>show on the graph</button></>}</>,
            color: e.sev === 'critical' ? 'var(--sev-critical)' : e.sev === 'high' ? 'var(--sev-high)' : e.sev === 'medium' ? 'var(--sev-medium)' : 'var(--m-custody)',
          }))} />
        </Card>
      </div>

      <div id="custody-copies" />
      <Card title="Where every copy is now" count={allNodes.length} sub={`All ${views.length} key assets · click a row to trace it on the graph`} flush
        actions={<span className="chips">
          <Chip on={!status} onClick={() => set({ status: null })} color={CUSTODY_TONE}>All</Chip>
          <Chip on={status === 'left'} onClick={() => set({ status: 'left' })} color="var(--bad)">Left the estate</Chip>
          <Chip on={status === 'broken'} onClick={() => set({ status: 'broken' })} color="var(--bad)">Signature broken</Chip>
        </span>}>
        <DataTable
          rows={allNodes.filter((n) => !status || (status === 'left' ? n.leftEstate : status === 'broken' ? n.state === 'broken' || views[n.assetIdx].status === 'Signature broken' : true))}
          rowKey={(n) => `${n.assetIdx}-${n.id}`}
          onRowClick={(n) => set({ asset: String(n.assetIdx), node: n.id })}
          search={(n) => `${n.asset} ${n.org} ${n.location} ${n.user} ${n.machine} ${n.watermark}`}
          searchPlaceholder="Search asset, organisation, device, watermark…"
          initialSort={{ key: 'state', dir: 'desc' }}
          pageSize={10}
          columns={[
            { key: 'asset', header: 'Asset', sort: (n) => n.asset, render: (n) => (<><div className="t-main" style={{ whiteSpace: 'normal' }}>{n.asset}</div><div className="t-sub">{n.kind}</div></>) },
            { key: 'org', header: 'Held by', sort: (n) => n.org, render: (n) => (<><div>{n.org}</div><div className="t-sub">{n.location}</div></>) },
            { key: 'dev', header: 'Device · user', render: (n) => (<><div className="mono">{n.machine}</div><div className="t-sub">{n.user}</div></>) },
            { key: 'wm', header: 'Watermark', render: (n) => <span className="mono t-sub">{n.watermark}</span> },
            { key: 'state', header: 'State', sort: (n) => (n.state === 'verified' ? 0 : n.state === 'revoked' ? 1 : 2), render: (n) => <StatusBadge value={STATE_LABEL[n.state]} map={{ [STATE_LABEL[n.state]]: STATE_COLOR[n.state] }} /> },
            { key: 'ver', header: 'Last verified', sort: (n) => -n.lastVerifiedMin, render: (n) => <span className="t-sub">{fmtAgo(n.lastVerifiedMin)}</span> },
          ]}
        />
      </Card>
    </>
  );
}
