import { useMemo, useState } from 'react';
import { Shield, Lock, KeyRound, Ship, HardDrive, Cloud, Server, Factory, Car, ShieldCheck, ArrowDownToLine } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { BarList, RecordsDrawer, Stat, scrollToId } from '../insurance/viz';
import { useApp, rangeDays } from '../../state/AppContext';
import { scopedConnectors } from '../../data/customers';
import { headlines } from '../../data/core';
import type { DataPlane } from '../../data/types';
import {
  planesInScope, planeSeries, vessels, keyInventory, DEPLOYMENT_MODELS, deploymentHighlights,
  connShort, effHealth, airGapBundles, vehicleFleet,
} from '../../data/modules/fabric';
import { Card, KpiStrip, Badge, HealthBadge, Btn, Callout, KV, HEALTH_COLOR, Bar, Freshness } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtCompact, fmtNum } from '../../lib/format';
import { TONE, CodeBlock, toneStyle } from './parts';
import { PALETTE } from '../../components/Chart';
import './fabric.css';

export default function FabricDataplanes() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const planes = useMemo(() => planesInScope(c, tenantId), [c, tenantId]);
  const conns = useMemo(() => scopedConnectors(c, tenantId), [c, tenantId]);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [sel, setSel] = useState<DataPlane | null>(() => c.dataPlanes.find((d) => d.id === params.get('plane')) ?? null);
  const [rec, setRec] = useState<null | 'planes' | 'unhealthy' | 'keys' | 'bundles' | 'fleet'>(null);
  const ves = useMemo(() => vessels(c), [c]);
  const keys = useMemo(() => keyInventory(c), [c]);
  const gapped = planes.filter((d) => d.placement === 'Air-gapped');
  const bundles = useMemo(() => (gapped[0] ? airGapBundles(c, gapped[0].id) : []), [c, gapped]);
  const fleet = useMemo(() => (tenantId === 'all' || tenantId === 'connected' ? vehicleFleet(c) : null), [c, tenantId]);

  const connFor = (dp: DataPlane) => conns.filter((k) => k.dataPlaneId === dp.id);
  const totalEpm = planes.reduce((s, d) => s + d.eventsPerMin, 0);
  const healthyPlanes = planes.filter((d) => d.status === 'healthy').length;
  const highlights = deploymentHighlights(c);
  const bufferedTotal = ves.reduce((s, v) => s + v.bufferedEvents, 0);

  const throughput = {
    labels: planes.map((d) => d.name),
    series: planes.map((d, i) => ({ name: d.name, data: planeSeries(c, d.id, days), color: PALETTE[i % PALETTE.length] })),
  };

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · {c.deployment}. The HexaShield control plane ({c.stamp}) reaches {planes.length} customer-side data plane{planes.length > 1 ? 's' : ''} through <b>hv-gateway</b> over mTLS, outbound 443 only. Credentials and raw data stay below the trust boundary; only canonical records and signed intents cross.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Data planes', value: planes.length, hint: tenantId === 'all' ? 'in estate' : 'in scope', toneColor: TONE, onClick: () => setRec('planes'), source: 'hv-agent heartbeats via hv-gateway' },
          { label: 'Healthy', value: healthyPlanes, unit: `/ ${planes.length}`, bar: (healthyPlanes / Math.max(1, planes.length)) * 100, toneColor: 'var(--good)', onClick: () => setRec('unhealthy'), source: 'hv-agent heartbeats via hv-gateway' },
          ...(gapped.length || fleet ? [] : [{ label: 'Events / min', value: fmtCompact(totalEpm), hint: 'across planes', toneColor: TONE, onClick: () => scrollToId('fab-throughput'), source: 'hv-gateway ingest counters' }]),
          { label: 'Events / day', value: fmtCompact(h.fabric.eventsPerDay), toneColor: TONE, onClick: () => scrollToId('fab-planes'), source: 'HexaCore metering (events_normalised)' },
          { label: 'Key management', value: c.byok ? 'BYOK' : 'Managed', hint: c.byok ? 'customer HSM' : 'per-tenant', toneColor: c.byok ? 'var(--good)' : 'var(--m-ai)', onClick: () => setRec('keys'), source: c.dataPlanes[0]?.vault ?? 'Key Vault' },
          ...(ves.length ? [{ label: 'Vessels buffering', value: ves.filter((v) => v.link === 'Out of coverage').length, hint: `${fmtCompact(bufferedTotal)} events held`, toneColor: 'var(--sev-medium)', onClick: () => scrollToId('fab-fleet'), source: 'Vessel edge collectors (store & forward)' }] : []),
          ...(gapped.length ? [{ label: 'Air-gapped bundles', value: `${Math.round(gapped[0].heartbeatSecAgo / 3600)} h`, hint: 'since last', toneColor: 'var(--m-ot)', delta: { text: `${bundles.length} verified in 72 h`, good: true }, onClick: () => setRec('bundles'), source: `${gapped[0].name} · signed bundle via data diode` }] : []),
          ...(fleet ? [{ label: 'Vehicles online', value: fmtCompact(fleet.online), hint: `of ${fmtCompact(fleet.vehicles)}`, toneColor: 'var(--m-core)', onClick: () => setRec('fleet'), source: 'Upstream vSOC · vehicle cloud data plane' }] : []),
        ]}
      />

      <Card title="Control plane → data planes" sub="HexaShield control plane reaches each customer-side data plane through hv-gateway (mTLS, outbound 443 only). Credentials and raw data stay on the plane · click a plane for detail">
        <Topology c={c} planes={planes} conns={conns} onSelect={setSel} />
      </Card>

      {(gapped.length > 0 || fleet) && (
        <div className={gapped.length > 0 && fleet ? 'grid g2' : 'grid'}>
          {gapped.length > 0 && (
            <Card title={<><ShieldCheck size={15} style={{ verticalAlign: -2, color: 'var(--m-ot)' }} /> {gapped[0].name}: signed bundles</>} sub={gapped[0].note ?? 'No network path out; data leaves only as signed bundles'} toneColor="var(--m-ot)" tinted>
              <div className="ins-stats" style={{ marginBottom: 12 }}>
                <Stat value={`${Math.round(gapped[0].heartbeatSecAgo / 3600)} h ago`} label="Last bundle imported" color="var(--m-ot)" onClick={() => setRec('bundles')} source="Group data plane import log" />
                <Stat value="6 h" label="Export interval" sub="00:00 · 06:00 · 12:00 · 18:00" />
                <Stat value={fmtCompact(bundles.reduce((s, b) => s + b.events, 0) / Math.max(1, bundles.length) * 4)} label="Events per day" onClick={() => setRec('bundles')} source="Bundle manifests" />
                <Stat value={`${bundles.filter((b) => b.verified).length}/${bundles.length}`} label="Signatures verified" color="var(--good)" onClick={() => setRec('bundles')} source="Ed25519 bundle signatures" />
              </div>
              <div className="section-label">Bundle timeline (last 72 h)</div>
              <div className="fab-bundles">
                {bundles.slice().reverse().map((b) => (
                  <button key={b.id} className="fab-bundle" onClick={() => setRec('bundles')} title={`${b.id} · ${fmtNum(b.events)} events · ${b.sizeMb} MB · SHA-256 ${b.sha.slice(0, 12)}…`}>
                    <ArrowDownToLine size={12} />
                    <span>{fmtAgo(b.exportedMin)}</span>
                  </button>
                ))}
              </div>
              <Callout kind="info">Nothing reaches the battery plant from outside. HexaOT sensors write to a local store; every 6 h the plane signs a bundle that crosses a one-way data diode to the group plane, where HexaView verifies the signature before import. Freshness is shown as bundle age, never as live.</Callout>
            </Card>
          )}
          {fleet && (
            <Card title={<><Car size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> Vehicle cloud plane · Upstream vSOC</>} sub="2.1M connected vehicles; telemetry summarised at the edge, raw CAN data never leaves the vehicle cloud">
              <div className="ins-stats" style={{ marginBottom: 12 }}>
                <Stat value={fmtCompact(fleet.online)} label="Vehicles online now" onClick={() => setRec('fleet')} source="Upstream vSOC fleet inventory" />
                <Stat value={fleet.anomalies24h} label="Vehicle anomalies (24 h)" color="var(--sev-medium)" onClick={() => setRec('fleet')} source="Upstream vSOC detections" />
                <Stat value={fleet.vsocIncidents} label="Open fleet incidents" color="var(--sev-high)" onClick={() => nav('/soc/ir')} source="Upstream vSOC → HexaSOC" />
                <Stat value={fleet.campaigns.filter((x) => x.status === 'Rolling out').length} label="OTA campaigns live" onClick={() => setRec('fleet')} source="OTA backend (R156 SUMS)" />
              </div>
              <div className="section-label">OTA campaigns (UNECE R156)</div>
              <BarList
                labelWidth={210}
                max={100}
                items={fleet.campaigns.map((x) => ({ label: x.name, sub: `${x.ecu} · ${fmtCompact(x.vehicles)} vehicles · ${x.status}`, value: x.progress, display: `${x.progress}%`, color: x.status === 'Paused' ? 'var(--sev-medium)' : x.status === 'Complete' ? 'var(--good)' : 'var(--m-core)', onClick: () => setRec('fleet') }))}
              />
            </Card>
          )}
        </div>
      )}

      <div className="grid g-3-2">
        <Card title={<span id="fab-throughput">Throughput by data plane</span>} sub={`Events per minute · ${timeRange}${gapped.length ? ' · air-gapped planes arrive as 6-hourly bundles' : ''}`}>
          <Chart height={260} option={{
            tooltip: { trigger: 'axis' },
            legend: { top: 0, type: 'scroll' },
            grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
            xAxis: { type: 'category', data: throughput.series[0]?.data.map((_, i) => (days === 1 ? `${i}:00` : `d${i + 1}`)) ?? [], boundaryGap: false },
            yAxis: { type: 'value', name: 'events/min' },
            series: throughput.series.map((s) => ({ name: s.name, type: 'line', data: s.data, symbol: 'none', smooth: true, lineStyle: { color: s.color, width: 1.8 }, itemStyle: { color: s.color } })),
          }} />
        </Card>

        <Card title={<><KeyRound size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> {c.byok ? 'BYOK & key rotation' : 'Key management & rotation'}</>} sub={c.residency}>
          <Callout kind={c.byok ? 'good' : 'info'}>
            {c.byok ? <><b>Bring your own key.</b> Encryption keys live in the customer HSM; HexaShield holds only wrapped data keys and can never read evidence or raw data without you.</> : <><b>HexaShield-managed keys, per-tenant.</b> Each tenant gets its own key-encryption key; customer-managed keys are available on the dedicated-stamp upgrade.</>}
          </Callout>
          <div className="list">
            {keys.map((k) => {
              const overdue = k.rotatedDaysAgo > k.rotationDays;
              const due = k.rotatedDaysAgo > k.rotationDays * 0.8;
              return (
                <div key={k.name} className="list-row">
                  <Lock size={14} style={{ color: k.owner === 'Customer' ? 'var(--good)' : 'var(--m-ai)' }} />
                  <span className="list-main"><b>{k.name}</b><span>{k.purpose} · {k.location}</span></span>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Badge color={k.owner === 'Customer' ? 'var(--good)' : 'var(--m-ai)'}>{k.owner}</Badge>
                    <span className="muted" style={{ fontSize: 10.5, color: overdue ? 'var(--bad)' : due ? 'var(--warn)' : undefined }}>rotated {k.rotatedDaysAgo} d ago · {k.algo}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}><Btn sm color={TONE} onClick={() => toast('Key rotation requested — change staged for the next maintenance window')}>Rotate mTLS certificates</Btn></div>
        </Card>
      </div>

      <div id="fab-planes" />
      <Card title="Data planes" sub="One agent per plane · heartbeat, agent version, vault and throughput" flush>
        <DataTable
          rows={planes}
          rowKey={(d) => d.id}
          onRowClick={(d) => setSel(d)}
          initialSort={{ key: 'epm', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Data plane', sort: (d) => d.name, render: (d) => (<><div className="t-main">{d.name}</div><div className="t-sub">{d.placement} · {d.region}</div></>) },
            { key: 'status', header: 'Status', sort: (d) => d.status, render: (d) => <HealthBadge status={d.status} /> },
            { key: 'agent', header: 'Agent', sort: (d) => d.agentVersion, render: (d) => <span className="mono">hv-agent {d.agentVersion}</span> },
            { key: 'hb', header: 'Heartbeat', sort: (d) => d.heartbeatSecAgo, render: (d) => d.placement === 'Air-gapped' ? <Badge color="var(--m-ot)">Bundle {fmtAgo(d.heartbeatSecAgo / 60)}</Badge> : <Freshness minutes={d.heartbeatSecAgo / 60} stale={d.status !== 'healthy'} label="Heartbeat" /> },
            { key: 'epm', header: 'Events/min', align: 'right', sort: (d) => d.eventsPerMin, render: (d) => d.placement === 'Air-gapped' ? <span className="muted">batched</span> : fmtNum(d.eventsPerMin) },
            { key: 'conn', header: 'Connectors', align: 'right', sort: (d) => connFor(d).length, render: (d) => connFor(d).length },
            { key: 'vault', header: 'Vault', render: (d) => <span className="t-sub">{d.vault}</span> },
          ]}
        />
      </Card>

      {ves.length > 0 && (
        <Card title={<><Ship size={15} style={{ verticalAlign: -2, color: 'var(--m-ot)' }} /> <span id="fab-fleet">Fleet store-and-forward</span></>} sub="Vessel edge collectors buffer events locally while out of satellite coverage, then forward signed bundles on the next window" flush>
          <Callout kind="warn"><b>{ves.filter((v) => v.link === 'Out of coverage').length} vessels out of coverage</b> are holding {fmtCompact(bufferedTotal)} events on board. Nothing is lost: data is forwarded, in order, when a LEO or VSAT link returns.</Callout>
          <DataTable
            rows={ves}
            rowKey={(v) => v.imo}
            search={(v) => `${v.name} ${v.region} ${v.type}`}
            searchPlaceholder="Find a vessel…"
            initialSort={{ key: 'buf', dir: 'desc' }}
            pageSize={8}
            columns={[
              { key: 'name', header: 'Vessel', sort: (v) => v.name, render: (v) => (<><div className="t-main">{v.name}</div><div className="t-sub">{v.imo} · {v.type}</div></>) },
              { key: 'region', header: 'Position', render: (v) => v.region },
              { key: 'link', header: 'Link', sort: (v) => v.link, render: (v) => <Badge color={v.link === 'Out of coverage' ? 'var(--bad)' : v.link === 'LEO' ? 'var(--good)' : 'var(--m-matrix)'} dot>{v.link}</Badge> },
              { key: 'buf', header: 'Buffered', align: 'right', sort: (v) => v.bufferedEvents, render: (v) => (<div style={{ minWidth: 120 }}><div className="t-main">{fmtNum(v.bufferedEvents)}</div><Bar value={v.bufferPct} color={v.bufferPct > 70 ? 'var(--sev-high)' : 'var(--m-ot)'} size="thin" /></div>) },
              { key: 'sync', header: 'Last sync', sort: (v) => v.lastSyncMin, render: (v) => fmtAgo(v.lastSyncMin) },
              { key: 'next', header: 'Next window', align: 'right', render: (v) => `~${v.nextWindowMin} min` },
            ]}
          />
        </Card>
      )}

      <Card title="Deployment model" sub="Where the control plane and your data live — your model is highlighted">
        <div className="grid g4">
          {DEPLOYMENT_MODELS.map((m) => {
            const on = highlights.includes(m.id);
            const Icon = m.id === 'airgap' ? Ship : m.id === 'saas' ? Cloud : m.id === 'hosted' ? HardDrive : Shield;
            return (
              <Card key={m.id} tinted={on} toneColor={on ? TONE : undefined} style={on ? undefined : { opacity: 0.8 }}>
                <div className="row" style={{ gap: 8 }}><Icon size={16} style={{ color: on ? 'var(--m-core)' : 'var(--text-muted)' }} /><b>{m.name}</b>{on && <Badge color={TONE}>Yours</Badge>}</div>
                <KV rows={[['Control plane', m.control], ['Data plane', m.data], ['Best for', m.fit]]} />
              </Card>
            );
          })}
        </div>
      </Card>

      {rec === 'planes' && (
        <RecordsDrawer title="Data planes" sub={c.deployment} source="hv-agent heartbeats via hv-gateway" onClose={() => setRec(null)}
          rows={planes.map((d) => ({ key: d.id, title: d.name, sub: `${d.placement} · ${d.region} · hv-agent ${d.agentVersion} · ${connFor(d).length} connectors`, right: d.placement === 'Air-gapped' ? 'bundled' : `${fmtCompact(d.eventsPerMin)}/min`, badge: <HealthBadge status={d.status} />, onClick: () => { setRec(null); setSel(d); } }))} />
      )}
      {rec === 'unhealthy' && (
        <RecordsDrawer title="Plane health" sub={`${healthyPlanes} of ${planes.length} healthy`} source="hv-agent heartbeats via hv-gateway" onClose={() => setRec(null)}
          rows={planes.slice().sort((a, b) => Number(a.status === 'healthy') - Number(b.status === 'healthy')).map((d) => ({ key: d.id, title: d.name, sub: d.note ?? `Heartbeat ${fmtAgo(d.heartbeatSecAgo / 60)} · hv-agent ${d.agentVersion}`, badge: <HealthBadge status={d.status} />, onClick: () => { setRec(null); setSel(d); } }))} />
      )}
      {rec === 'keys' && (
        <RecordsDrawer title="Key inventory" sub={c.residency} source={c.dataPlanes[0]?.vault} onClose={() => setRec(null)}
          rows={keys.map((k) => ({ key: k.name, title: k.name, sub: `${k.purpose} · ${k.location} · ${k.algo}`, right: `${k.rotatedDaysAgo} d`, badge: <Badge color={k.owner === 'Customer' ? 'var(--good)' : 'var(--m-ai)'}>{k.owner}</Badge> }))} />
      )}
      {rec === 'bundles' && gapped[0] && (
        <RecordsDrawer title={`${gapped[0].name}: bundle log`} sub="Signed bundles imported through the data diode, newest first" source={`${gapped[0].name} → Group data plane · Ed25519 signatures`} onClose={() => setRec(null)}
          rows={bundles.map((b) => ({ key: b.id, title: `${b.id} · ${fmtNum(b.events)} events`, sub: `Exported ${fmtAgo(b.exportedMin)} · ${b.sizeMb} MB · SHA-256 ${b.sha.slice(0, 16)}… · ${b.via}`, badge: <Badge color="var(--good)" dot>Signature verified</Badge> }))} />
      )}
      {rec === 'fleet' && fleet && (
        <RecordsDrawer title="Connected-vehicle fleet" sub={`${fmtCompact(fleet.vehicles)} vehicles · ${fleet.anomalies24h} anomalies in 24 h`} source="Upstream vSOC · vehicle cloud data plane (AWS eu-central-1)" onClose={() => setRec(null)}
          rows={[
            ...fleet.regions.map((r) => ({ key: r.region, title: r.region, sub: `${fmtCompact(r.online)} online of ${fmtCompact(r.vehicles)} · ${fmtCompact(r.otaPending)} awaiting OTA`, right: `${r.anomalies24h} anomalies` })),
            ...fleet.campaigns.map((x) => ({ key: x.name, title: x.name, sub: `${x.ecu} · ${fmtCompact(x.vehicles)} vehicles`, right: `${x.progress}%`, badge: <Badge color={x.status === 'Paused' ? 'var(--sev-medium)' : x.status === 'Complete' ? 'var(--good)' : 'var(--m-core)'}>{x.status}</Badge> })),
          ]} />
      )}

      {sel && (
        <Drawer wide onClose={() => setSel(null)} title={sel.name} sub={`${sel.placement} · ${sel.region}`} icon={<span className="dot" style={{ background: HEALTH_COLOR[sel.status], width: 12, height: 12, marginTop: 6 }} />}>
          <div className="fab-kvgrid">
            <div><b style={{ color: HEALTH_COLOR[sel.status] }}>{sel.status === 'healthy' ? 'Healthy' : sel.status === 'degraded' ? 'Degraded' : 'Failing'}</b><span>Status</span></div>
            <div><b>{fmtAgo(sel.heartbeatSecAgo / 60)}</b><span>Heartbeat</span></div>
            <div><b>{fmtNum(sel.eventsPerMin)}</b><span>Events/min</span></div>
            <div><b>{connFor(sel).length}</b><span>Connectors</span></div>
          </div>
          {sel.note && <Callout kind={sel.placement === 'Air-gapped' ? 'info' : 'warn'}>{sel.note}</Callout>}
          <KV rows={[
            ['Placement', sel.placement],
            ['Region', sel.region],
            ['Agent version', <span className="mono">hv-agent {sel.agentVersion}</span>],
            ['Credential vault', sel.vault],
            ['Egress', 'hv-gateway · mTLS · outbound 443 only'],
          ]} />
          <div>
            <div className="section-label">Throughput ({timeRange})</div>
            <Chart height={120} option={{
              grid: { left: 8, right: 10, top: 10, bottom: 20, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: planeSeries(c, sel.id, days).map((_, i) => (days === 1 ? `${i}:00` : `d${i + 1}`)), boundaryGap: false },
              yAxis: { type: 'value' },
              series: [{ type: 'line', data: planeSeries(c, sel.id, days), symbol: 'none', smooth: true, areaStyle: { color: 'rgba(79,140,255,.2)' }, lineStyle: { color: PALETTE[0], width: 2 } }],
            }} />
          </div>
          <div>
            <div className="section-label">Connectors on this plane</div>
            <div className="list">
              {connFor(sel).map((k) => (
                <div key={k.id} className="list-row">
                  <span className="dot" style={{ background: HEALTH_COLOR[effHealth(k)] }} />
                  <span className="list-main"><b>{connShort(k)}</b><span>{k.category} · {fmtCompact(k.records)} records</span></span>
                  <span className="muted" style={{ fontSize: 10.5 }}>{fmtAgo(k.lastSyncMin)}</span>
                </div>
              ))}
              {connFor(sel).length === 0 && <div className="empty">No connectors on this plane in the current scope.</div>}
            </div>
          </div>
          <CodeBlock label="Agent heartbeat (last)" text={`plane: ${sel.id}\nagent: hv-agent ${sel.agentVersion}\nstatus: ${sel.status}\nheartbeat_sec_ago: ${sel.heartbeatSecAgo}\nevents_per_min: ${sel.eventsPerMin}\nchannel: mtls://hv-gateway  # outbound 443 only\nvault: ${sel.vault}\ncredentials_leave_boundary: false`} />
        </Drawer>
      )}
    </div>
  );
}

/* ---- Topology as a crisp flow map: control plane -> gateway -> data planes -> tools ---- */
function Topology({ c, planes, conns, onSelect }: { c: ReturnType<typeof useApp>['customer']; planes: DataPlane[]; conns: ReturnType<typeof scopedConnectors>; onSelect: (d: DataPlane) => void }) {
  const icon = (d: DataPlane) => (d.placement === 'Air-gapped' ? <ShieldCheck /> : d.placement.startsWith('Customer') ? <Cloud /> : d.placement.startsWith('Vessel') ? <Ship /> : d.placement.includes('Kubernetes') || d.placement.includes('Docker') ? <Server /> : <HardDrive />);
  const columns: FlowColumn[] = [
    { label: 'HexaShield control plane', nodes: [
      { id: 'cp', title: 'Control plane', count: c.stamp.split(' · ')[0], icon: <Shield />, color: 'var(--m-view)' },
      { id: 'gw', title: 'hv-gateway', count: 'mTLS', sub: 'outbound 443 only', icon: <Lock />, color: 'var(--m-core)' },
    ] },
    {
      label: 'Customer data planes',
      nodes: planes.map((d) => ({
        id: d.id, title: d.name, icon: icon(d),
        count: d.placement === 'Air-gapped' ? 'bundle / 6 h' : `${fmtCompact(d.eventsPerMin)}/min`,
        sub: d.placement === 'Air-gapped' ? 'via data diode' : d.placement.replace('Customer ', '').replace('On-prem ', '').replace('Vessel edge (store & forward)', 'store & forward'),
        state: d.status === 'healthy' ? undefined : 'warn' as const,
        color: d.placement === 'Air-gapped' ? 'var(--m-ot)' : HEALTH_COLOR[d.status],
        onClick: () => onSelect(d),
      })),
    },
    {
      label: 'Tools on each plane',
      nodes: planes.map((d) => {
        const direct = conns.filter((k) => k.dataPlaneId === d.id);
        const ks = direct.length ? direct : conns.filter((k) => k.tenants !== 'all' && k.tenants.some((t) => c.tenants.find((x) => x.id === t)?.dataPlaneId === d.id));
        const envs = [...new Set(ks.map((k) => (k.env === 'onprem' ? 'on-prem' : k.env)))].join(' · ');
        return { id: `t-${d.id}`, title: ks.length ? ks.slice(0, 2).map(connShort).join(', ') + (ks.length > 2 ? ` +${ks.length - 2}` : '') : 'No tools in scope', count: ks.length, sub: direct.length ? envs : ks.length ? 'site feeds relayed' : '—', icon: ks.some((k) => k.env === 'ot') ? <Factory /> : <Server />, onClick: () => onSelect(d) };
      }),
    },
  ];
  const links: FlowLink[] = [
    ...planes.map((d) => ({ from: d.placement === 'HexaShield-hosted' ? 'cp' : 'gw', to: d.id, value: d.placement === 'Air-gapped' ? 1 : Math.max(1, Math.log10(d.eventsPerMin + 1)), bad: d.status !== 'healthy', color: d.placement === 'Air-gapped' ? '#f7a04a' : d.status !== 'healthy' ? '#f0a338' : undefined })),
    ...planes.map((d) => ({ from: d.id, to: `t-${d.id}`, value: Math.max(1, conns.filter((k) => k.dataPlaneId === d.id).length / 2) })),
  ];
  return <FlowMap columns={columns} links={links} footer={<span>Blue: live mTLS channel · amber: degraded or batched (air-gapped bundles cross a one-way data diode) · credentials never leave the plane</span>} />;
}
