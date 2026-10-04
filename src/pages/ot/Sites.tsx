import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Factory, FileCheck2, Radio, Ship, ShieldOff, Cpu } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { otScope, otSensors, trackedAssets, alertBands, vessels, airGapBundles, bundleAgeMin, SECTOR, type OtSensor, type OtSite } from '../../data/modules/ot';
import { KpiStrip, Card, Badge, StatusBadge, KV, IcoBox, Callout, Chip, Freshness } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtAgo, fmtDur, fmtNum } from '../../lib/format';
import { rng } from '../../lib/rng';
import { OT_TONE, OtIntro, NoOtState, PeakBadge, CellMeter, srcNames } from './parts';
import { forCustomer } from '../../data/customerMap';

const HEALTH_COLOR: Record<string, string> = { Good: 'var(--good)', Attention: 'var(--sev-medium)', Offline: 'var(--bad)' };
const VESSEL_COLOR: Record<string, string> = { online: 'var(--good)', 'store & forward': 'var(--sev-medium)', 'out of coverage': 'var(--bad)' };

function uptime(h: number): string {
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function OtSites() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const sc = useMemo(() => otScope(c, tenantId), [c, tenantId]);
  const sensors = useMemo(() => otSensors(c, tenantId), [c, tenantId]);
  const tracked = useMemo(() => trackedAssets(c, tenantId), [c, tenantId]);
  const bands = useMemo(() => alertBands(c, tenantId), [c, tenantId]);
  const fleet = useMemo(() => (sc.sites.some((s) => s.kind === 'vessel') ? vessels(c, sc.siteAssets.fleet ?? 0) : []), [c, sc]);
  const bundles = useMemo(() => airGapBundles(c), [c]);
  const [health, setHealth] = useState<'all' | 'Attention'>(params.get('health') === 'attention' ? 'Attention' : 'all');
  const siteParam = params.get('site');
  const [sel, setSel] = useState<OtSite | null>(null);
  const openSite = sc.sites.find((s) => s.id === siteParam) ?? sel;
  const show = params.get('show');
  useEffect(() => {
    if (show === 'sensors') window.setTimeout(() => document.getElementById('ot-sensors')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [show]);

  if (!sc.hasOt) return <NoOtState what="Sites and sensors cover locations that run operational technology." />;
  const w = forCustomer(SECTOR, c);
  const src = srcNames(sc);
  const r = rng(`ot-sites-${c.id}-${tenantId}`);
  const attention = sensors.filter((s) => s.health !== 'Good' && !s.note?.startsWith('Air-gapped'));
  const reporting = sensors.filter((s) => s.health === 'Good' && !s.note?.startsWith('Air-gapped')).length;
  const mbps = sensors.reduce((s, x) => s + x.mbps, 0);
  const rows = sc.sites.map((s) => {
    const ss = sensors.filter((x) => x.siteId === s.id);
    const assets = sc.siteAssets[s.id] ?? 0;
    return {
      s, assets, tracked: tracked.filter((t) => t.siteId === s.id).length, nodes: Math.round(assets * r.float(1.6, 2.1, 2)),
      alerts: bands.siteTotals[s.id] ?? 0, peak: bands.sitePeak[s.id] ?? 0, sensors: ss.length, good: ss.filter((x) => x.health === 'Good').length,
      conn: c.connectors.find((k) => k.id === s.sourceConnector),
    };
  });
  const nodes = rows.reduce((s, x) => s + x.nodes, 0);
  const sensorRows = health === 'all' ? sensors : sensors.filter((s) => s.health !== 'Good' || s.note?.startsWith('Air-gapped'));
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const gap = sc.sites.find((s) => s.airGapped);
  const closeSite = () => {
    setSel(null);
    if (siteParam) {
      params.delete('site');
      setParams(params, { replace: true });
    }
  };

  return (
    <>
      <OtIntro>
        <b>{c.name}</b> · one passive sensor estate across {sc.sites.length} {sc.sites.length === 1 ? 'site' : 'sites'}, aggregated into a single console from {src}. Sensors listen on mirrored traffic — they never address a device on the {w.net}.
      </OtIntro>

      <KpiStrip
        toneColor={OT_TONE}
        items={[
          { label: 'Sites', hint: 'monitored', value: sc.sites.length, onClick: () => jump('ot-sites-table'), source: src },
          { label: 'Sensors', hint: 'reporting live', value: `${reporting}/${sensors.length}`, bar: (reporting / Math.max(1, sensors.length)) * 100, onClick: () => { setHealth('all'); jump('ot-sensors'); }, source: src },
          { label: 'Need attention', hint: 'sensors', value: attention.length, toneColor: attention.length ? 'var(--sev-medium)' : undefined, onClick: () => { setHealth('Attention'); jump('ot-sensors'); }, source: src },
          { label: 'Mirrored', hint: 'traffic seen', value: fmtNum(mbps), unit: 'Mbit/s', onClick: () => jump('ot-sensors'), source: `${src} · SPAN / TAP` },
          { label: 'Nodes', hint: 'on the wire', value: fmtNum(nodes), to: '/ot/assets?view=all', source: src },
        ]}
      />

      {attention.slice(0, 2).map((s) => (
        <Callout key={s.id} kind="warn">
          <b>{s.health === 'Offline' ? 'A sensor is offline' : 'One sensor is not seeing everything'}.</b> {s.name} at {s.siteName} — {s.note}. Until that is restored, treat traffic on the affected segment as unseen rather than clean.
        </Callout>
      ))}

      <Card title="Sites" count={sc.sites.length} sub="Click a site for its sensors, zones and freshness" flush>
        <div id="ot-sites-table" />
        <DataTable
          rows={rows}
          rowKey={(x) => x.s.id}
          onRowClick={(x) => setSel(x.s)}
          initialSort={{ key: 'assets', dir: 'desc' }}
          columns={[
            { key: 'site', header: 'Site', sort: (x) => x.s.name, render: (x) => (
              <span className="row" style={{ gap: 10 }}>
                <IcoBox color={OT_TONE}>{x.s.airGapped ? <ShieldOff /> : x.s.kind === 'vessel' ? <Ship /> : <Factory />}</IcoBox>
                <span><div className="t-main">{x.s.name}</div><div className="t-sub">{x.s.city}, {x.s.country} · {x.s.kindLabel}</div></span>
              </span>
            ) },
            { key: 'assets', header: 'Assets', align: 'right', sort: (x) => x.assets, render: (x) => fmtNum(x.assets) },
            { key: 'tracked', header: 'Tracked', align: 'right', sort: (x) => x.tracked, render: (x) => x.tracked },
            { key: 'nodes', header: 'Nodes', align: 'right', sort: (x) => x.nodes, render: (x) => fmtNum(x.nodes) },
            { key: 'alerts', header: 'Alerts 14 d', align: 'right', sort: (x) => x.alerts, render: (x) => fmtNum(x.alerts) },
            { key: 'peak', header: 'Peak risk', sort: (x) => x.peak, render: (x) => <PeakBadge n={x.peak} /> },
            { key: 'sensors', header: 'Sensors', sort: (x) => x.good / Math.max(1, x.sensors), render: (x) => <Badge color={x.good === x.sensors ? 'var(--good)' : 'var(--sev-medium)'} dot>{x.good}/{x.sensors}</Badge> },
            { key: 'fresh', header: 'Data as of', render: (x) => x.s.airGapped
              ? <Badge color="var(--sev-medium)">Bundle {fmtAgo(bundleAgeMin(c))}</Badge>
              : x.conn ? <Freshness minutes={x.conn.lastSyncMin} stale={x.conn.status !== 'healthy'} label={x.conn.vendor === 'HexaShield' ? 'HexaOT' : x.conn.vendor} /> : <span className="t-sub">—</span> },
          ]}
        />
      </Card>

      {gap && (
        <div className="grid g-3-2">
          <Card title={<><ShieldOff size={15} /> {gap.name}: signed bundles</>} sub={`Air-gapped plant · no live link · one signed bundle every ${gap.bundleHours ?? 6} h, verified on import`} toneColor="var(--sev-medium)">
            <div className="ot-bundles">
              {bundles.map((b) => (
                <div key={b.id} className="ot-bundle">
                  <FileCheck2 />
                  <span>
                    <b>{b.id} · imported {fmtAgo(b.importedMinAgo)}</b>
                    <span className="mono">{b.signer} · sha256 {b.sha256.slice(0, 16)}…</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <b>{fmtNum(b.events)} events</b>
                    <span>{b.sizeMb} MB · {b.alerts} alerts</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="What the air gap means here" tinted toneColor={OT_TONE}>
            <KV rows={[
              ['Last bundle', fmtAgo(bundleAgeMin(c))],
              ['Next due', bundleAgeMin(c) >= (gap.bundleHours ?? 6) * 60 ? 'Now (awaiting import)' : `in ${fmtDur((gap.bundleHours ?? 6) * 60 - bundleAgeMin(c))}`],
              ['Worst-case delay', `${gap.bundleHours ?? 6} h plus import`],
              ['Integrity', 'Every bundle signed on site and verified before ingestion'],
              ['Live alerting', 'Handled on site by the plant security officer; HexaSOC sees it on import'],
            ]} />
            <div style={{ marginTop: 12 }}>
              <Callout kind="info" color={OT_TONE}>Numbers for this plant are never shown as live. Alert times are when the sensor saw them, which can be hours before HexaView could.</Callout>
            </div>
          </Card>
        </div>
      )}

      <Card title={<><Cpu size={15} /> Sensors</>} count={sensors.length} sub="RAM / disk / CPU as reported by each sensor" flush actions={
        <span className="chips">
          <Chip on={health === 'all'} onClick={() => setHealth('all')} color={OT_TONE}>All</Chip>
          <Chip on={health === 'Attention'} onClick={() => setHealth('Attention')} color="var(--sev-medium)">Attention or delayed</Chip>
        </span>
      }>
        <div id="ot-sensors" />
        <DataTable
          rows={sensorRows}
          rowKey={(s) => s.id}
          search={(s) => `${s.name} ${s.siteName} ${s.desc} ${s.model}`}
          searchPlaceholder="Filter sensors…"
          initialSort={{ key: 'health', dir: 'desc' }}
          pageSize={10}
          onRowClick={(s) => setSel(sc.sites.find((x) => x.id === s.siteId) ?? null)}
          columns={[
            { key: 'name', header: 'Sensor', sort: (s) => s.name, render: (s: OtSensor) => (<><div className="t-main mono">{s.name}</div><div className="t-sub" style={{ whiteSpace: 'normal' }}>{s.desc}</div></>) },
            { key: 'site', header: 'Site', sort: (s) => s.siteName, render: (s) => s.siteName },
            { key: 'model', header: 'Model', sort: (s) => s.model, render: (s) => <span className="t-sub">{s.model}</span> },
            { key: 'health', header: 'Health', sort: (s) => (s.health === 'Good' ? 0 : 1), render: (s) => <StatusBadge value={s.health} map={HEALTH_COLOR} /> },
            { key: 'up', header: 'Uptime', sort: (s) => s.uptimeH, render: (s) => uptime(s.uptimeH) },
            { key: 'sync', header: 'Last sync', sort: (s) => -s.lastSyncMin, render: (s) => <span style={{ color: s.lastSyncMin > 30 ? 'var(--sev-medium)' : undefined }}>{fmtAgo(s.lastSyncMin)}</span> },
            { key: 'mbps', header: 'Traffic', align: 'right', sort: (s) => s.mbps, render: (s) => `${s.mbps} Mbit/s` },
            { key: 'load', header: 'Load', render: (s) => <span className="t-sub mono">{s.ram} / {s.disk} / {s.cpu}%</span> },
          ]}
        />
      </Card>

      {fleet.length > 0 && (
        <Card title={<><Ship size={15} /> Fleet vessels</>} count={fleet.length} sub="Vessel edge collectors store and forward over VSAT / LEO; data from vessels out of coverage is held on board, never shown as zero" flush>
          <DataTable
            rows={fleet}
            rowKey={(v) => v.name}
            search={(v) => `${v.name} ${v.region} ${v.link}`}
            searchPlaceholder="Filter vessels…"
            initialSort={{ key: 'sync', dir: 'desc' }}
            pageSize={8}
            columns={[
              { key: 'name', header: 'Vessel', sort: (v) => v.name, render: (v) => (<><div className="t-main">{v.name}</div><div className="t-sub">{v.cls}</div></>) },
              { key: 'status', header: 'Link status', sort: (v) => v.status, render: (v) => <StatusBadge value={v.status} map={VESSEL_COLOR} /> },
              { key: 'link', header: 'Bearer', sort: (v) => v.link, render: (v) => <span className="row" style={{ gap: 5 }}><Radio size={12} className="muted" />{v.link}</span> },
              { key: 'region', header: 'Position', sort: (v) => v.region, render: (v) => v.region },
              { key: 'sync', header: 'Last sync', sort: (v) => v.lastSyncMin, render: (v) => <span style={{ color: v.lastSyncMin > 120 ? 'var(--sev-medium)' : undefined }}>{fmtAgo(v.lastSyncMin)}</span> },
              { key: 'backlog', header: 'Held on board', align: 'right', sort: (v) => v.backlogMb, render: (v) => `${fmtNum(v.backlogMb)} MB` },
              { key: 'assets', header: 'Assets', align: 'right', sort: (v) => v.assets, render: (v) => v.assets },
            ]}
          />
        </Card>
      )}

      {openSite && (() => {
        const row = rows.find((x) => x.s.id === openSite.id);
        const ss = sensors.filter((x) => x.siteId === openSite.id);
        return (
          <Drawer
            title={openSite.name}
            sub={`${openSite.city}, ${openSite.country} · ${openSite.kindLabel}`}
            icon={<IcoBox color={OT_TONE}>{openSite.airGapped ? <ShieldOff /> : <Factory />}</IcoBox>}
            onClose={closeSite}
            footer={<span className="muted" style={{ fontSize: 11.5 }}>Read-only: sensors are passive and nothing here can change the site.</span>}
          >
            <KV rows={[
              ['Watched by', openSite.source],
              ['Assets', row ? <button className="link" onClick={() => nav(`/ot/assets?view=all&site=${openSite.id}`)}>{fmtNum(row.assets)} · open inventory</button> : '—'],
              ['Tracked individually', row ? <button className="link" onClick={() => nav(`/ot/assets?site=${openSite.id}`)}>{row.tracked} · open tracked assets</button> : '—'],
              ['Alerts (14 d)', row ? <button className="link" onClick={() => nav(`/ot/alerts?site=${openSite.id}`)}>{fmtNum(row.alerts)} · open alerts</button> : '—'],
              ['Peak risk', row ? <PeakBadge n={row.peak} /> : '—'],
              ['Connectivity', openSite.airGapped ? `Air-gapped · signed bundle every ${openSite.bundleHours ?? 6} h (last ${fmtAgo(bundleAgeMin(c))})` : openSite.kind === 'vessel' ? 'VSAT / LEO · store and forward' : 'Site WAN · edge data plane'],
            ]} />
            <div className="section-label" style={{ marginTop: 16 }}>Sensors at this site</div>
            <div className="list">
              {ss.map((s) => (
                <div key={s.id} className="list-row">
                  <span className="list-main">
                    <b className="mono">{s.name}</b>
                    <span style={{ whiteSpace: 'normal' }}>{s.model} · {s.desc}</span>
                  </span>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge value={s.health} map={HEALTH_COLOR} />
                    <CellMeter value={s.ram} max={100} label={`${s.ram}% RAM`} />
                  </span>
                </div>
              ))}
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}
