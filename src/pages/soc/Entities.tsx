import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Monitor, ShieldCheck, ShieldAlert, Shield, WifiOff, Siren, Server, Laptop, ArrowRight } from 'lucide-react';
import { Card, Badge, KV, Btn, IcoBox, Callout, Sources } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { endpointDevices, deviceSummary, endpointCves, incidents, type Device, type Exposure } from '../../data/modules/soc';
import { fmtAgo, fmtNum } from '../../lib/format';
import { useSoc, tenantShort, StatTile, Pills, SegBar, RankList, RecordsDrawer, WriteBackModal, OtReadOnly, useParamFilter, type WriteBack } from './parts';

const EXP_COLOR: Record<Exposure, string> = { High: 'var(--sev-high)', Medium: 'var(--sev-medium)', Low: 'var(--sev-low)', None: 'var(--good)' };
type ExpF = 'all' | Exposure;
type StatF = 'all' | 'online' | 'offline';
type BoardF = 'all' | 'onboarded' | 'not';

export default function SocEntities() {
  const { c, tenantId, days, tools, tone, scopeLabel, nav } = useSoc();
  const devs = useMemo(() => endpointDevices(c, tenantId), [c, tenantId]);
  const sum = useMemo(() => deviceSummary(c, tenantId), [c, tenantId]);
  const cves = useMemo(() => endpointCves(c, tenantId), [c, tenantId]);
  const incs = useMemo(() => incidents(c, tenantId, days), [c, tenantId, days]);
  const [sp] = useSearchParams();
  const [exp, setExp] = useParamFilter<ExpF>('exposure', ['all', 'High', 'Medium', 'Low', 'None'] as const, 'all');
  const [stat, setStat] = useParamFilter<StatF>('status', ['all', 'online', 'offline'] as const, 'all');
  const [board, setBoard] = useState<BoardF>('all');
  const [os, setOs] = useState('all');
  const [sel, setSel] = useState<Device | null>(() => devs.find((d) => d.host === sp.get('q')) ?? null);
  const [threats, setThreats] = useState(false);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const src = `${tools.edrShort}${c.connectors.some((k) => k.category === 'Asset / CMDB' || k.category === 'ITSM') ? ` · ${c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'CMDB'}` : ''}`;
  const oses = Array.from(new Set(devs.map((d) => d.os))).sort();
  const rows = devs.filter((d) => (exp === 'all' || d.exposure === exp) && (stat === 'all' || (stat === 'online' ? d.online : !d.online)) && (board === 'all' || (board === 'onboarded' ? d.onboarded : !d.onboarded)) && (os === 'all' || d.os === os));
  const kinds = Array.from(new Set(devs.map((d) => d.kind)));
  const isPlant = (d: Device) => /HMI|Engineering workstation \(TIA|Crane engineering|Bridge|modality console/.test(d.kind);
  const threatIncs = incs.filter((i) => i.status !== 'closed' && !i.ot).slice(0, Math.max(sum.threats, 1));

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · every onboarded device, its {tools.edrShort} sensor coverage and current exposure. Totals cover the full estate ({fmtNum(sum.total)} devices); the table lists crown jewels, servers and a working sample.
      </p>

      <div className="soc-stats">
        <StatTile icon={<Monitor />} value={fmtNum(sum.onboarded)} unit={`of ${fmtNum(sum.total)}`} label="Devices onboarded" bar={(sum.onboarded / Math.max(1, sum.total)) * 100} tone={tone} onClick={() => setBoard('not')} source={src} />
        <StatTile icon={<ShieldCheck />} value={fmtNum(sum.none)} label="Exposure: none" tone="#2dd4bf" onClick={() => setExp('None')} source={`${tools.edrShort} exposure score`} />
        <StatTile icon={<ShieldAlert />} value={fmtNum(sum.high)} label="Exposure: high" tone="#f2643f" onClick={() => setExp('High')} source={`${tools.edrShort} exposure score`} />
        <StatTile icon={<Shield />} value={fmtNum(sum.medium)} label="Exposure: medium" tone="#f0a338" onClick={() => setExp('Medium')} source={`${tools.edrShort} exposure score`} />
        <StatTile icon={<WifiOff />} value={fmtNum(sum.offline)} label="Not reporting (offline)" tone="#8a9bc0" onClick={() => setStat('offline')} source={`${tools.edrShort} sensor heartbeat`} />
        <StatTile icon={<Siren />} value={sum.threats} label="Active threats now" tone="#e0345e" onClick={() => setThreats(true)} source={`${tools.edrShort} · HexaSOC`} />
      </div>

      <div className="grid g-2-1">
        <Card title="Devices" count={`${rows.length} shown`} sub="Click a device for detail and response actions" flush>
          <div className="row wrap" style={{ padding: '0 18px 12px', gap: 10 }}>
            <Pills label="Status" value={stat} onChange={setStat} tone={tone} items={[{ id: 'all', label: 'All' }, { id: 'online', label: 'Online' }, { id: 'offline', label: 'Offline' }]} />
            <Pills label="Exposure" value={exp} onChange={setExp} tone={tone} items={[{ id: 'all', label: 'All' }, { id: 'High', label: 'High' }, { id: 'Medium', label: 'Medium' }, { id: 'Low', label: 'Low' }, { id: 'None', label: 'None' }]} />
            <Pills label="Boarding" value={board} onChange={setBoard} tone={tone} items={[{ id: 'all', label: 'All' }, { id: 'onboarded', label: 'Onboarded' }, { id: 'not', label: 'Not onboarded' }]} />
            <select className="select" value={os} onChange={(e) => setOs(e.target.value)} aria-label="Operating system">
              <option value="all">All operating systems</option>
              {oses.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <DataTable
            rows={rows}
            rowKey={(r) => r.host}
            onRowClick={setSel}
            pageSize={15}
            search={(r) => `${r.host} ${r.kind} ${r.os} ${r.owner} ${r.ip}`}
            searchPlaceholder="Search hostname, owner, IP…"
            columns={[
              { key: 'h', header: 'Device', sort: (r) => r.host, render: (r) => (<span className="soc-user"><IcoBox color={r.crown ? 'var(--sev-high)' : tone}>{/Server|VDA|Gateway|build/i.test(r.kind) ? <Server /> : <Laptop />}</IcoBox><span style={{ minWidth: 0 }}><b className="mono">{r.host}</b><span>{r.kind} · {r.os}</span></span></span>) },
              { key: 'e', header: 'Security status', sort: (r) => ['None', 'Low', 'Medium', 'High'].indexOf(r.exposure), render: (r) => <Badge color={EXP_COLOR[r.exposure]}>{r.exposure === 'None' ? 'Healthy' : r.exposure}</Badge> },
              { key: 'cov', header: 'Coverage', sort: (r) => (r.onboarded ? 1 : 0) + (r.sensor ? 1 : 0), render: (r) => (<span className="row" style={{ gap: 4 }}><Badge color={r.onboarded ? 'var(--good)' : 'var(--bad)'}>{r.onboarded ? 'Onboarded' : 'Not onboarded'}</Badge><Badge color={r.sensor ? 'var(--good)' : 'var(--sev-info)'}>{r.sensor ? 'Sensor active' : 'Sensor inactive'}</Badge></span>) },
              { key: 't', header: 'Tenant', sort: (r) => tenantShort(c, r.tenantId), render: (r) => <span className="t-sub">{tenantShort(c, r.tenantId)}</span> },
              { key: 'l', header: 'Last seen', sort: (r) => -r.lastSeenMin, render: (r) => <span className="nowrap" style={{ fontSize: 12 }}>{fmtAgo(r.lastSeenMin)}</span> },
              { key: 's', header: 'Status', sort: (r) => (r.online ? 1 : 0), render: (r) => <Badge color={r.online ? 'var(--good)' : 'var(--sev-info)'} dot>{r.online ? 'Online' : 'Offline'}</Badge> },
            ]}
          />
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Exposure across the estate" sub="All devices · click to filter">
            <SegBar parts={[{ id: 'High', label: 'High', value: sum.high, color: '#f2643f' }, { id: 'Medium', label: 'Medium', value: sum.medium, color: '#f0a338' }, { id: 'Low', label: 'Low', value: sum.low, color: '#e2c73f' }, { id: 'None', label: 'None', value: sum.none, color: '#2dd4bf' }]} onPick={(id) => setExp(id as Exposure)} />
          </Card>
          <Card title="Device types" sub="High-exposure devices in the sample">
            <RankList tone="#f2643f" onPick={() => setExp('High')} rows={kinds.map((k) => ({ id: k, label: k, value: devs.filter((d) => d.kind === k && d.exposure === 'High').length, sub: `${devs.filter((d) => d.kind === k).length} total` })).sort((a, b) => b.value - a.value).slice(0, 7)} />
          </Card>
          <Card title="Coverage gaps" sub="Devices without a working sensor">
            <div className="list">
              {devs.filter((d) => !d.onboarded || !d.sensor).slice(0, 6).map((d) => (
                <div key={d.host} className="list-row" style={{ cursor: 'pointer' }} onClick={() => setSel(d)}>
                  <span className="list-main"><b className="mono">{d.host}</b><span>{d.kind} · {d.os}{isPlant(d) ? ' · allow-listing instead of EDR' : ''}</span></span>
                  <Badge color={d.onboarded ? 'var(--sev-info)' : 'var(--bad)'}>{d.onboarded ? 'Sensor inactive' : 'No EDR'}</Badge>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}><Sources items={[...(tools.edr ? [{ name: tools.edrShort, status: tools.edr.status }] : []), ...tools.ot.map((k) => ({ name: k.product, status: k.status }))]} /></div>
          </Card>
        </div>
      </div>

      {sel && (() => {
        const dc = cves.filter((x) => x.devices.includes(sel.host));
        const di = incs.filter((i) => i.hosts.includes(sel.host));
        const plant = isPlant(sel);
        return (
          <Drawer
            title={sel.host}
            sub={`${sel.kind} · ${sel.os} · ${tenantShort(c, sel.tenantId)}`}
            icon={<IcoBox color={EXP_COLOR[sel.exposure]}><Monitor /></IcoBox>}
            onClose={() => setSel(null)}
            footer={!plant && tools.edr ? (
              <>
                {!sel.onboarded && <Btn onClick={() => setWb({ title: `Onboard ${sel.host}`, system: tools.edrShort, target: sel.host, changes: [`Deploy the ${tools.edrShort} sensor through Intune / SCCM`, 'Apply the tenant prevention policy in audit mode for 24 h'], risk: 'low', done: `Onboarding of ${sel.host} queued` })}>Onboard sensor</Btn>}
                <Btn primary onClick={() => setWb({ title: `Isolate ${sel.host}`, system: tools.edrShort, target: sel.host, changes: [`${tools.edrShort} network-contains ${sel.host}; only the EDR channel stays open`, `Owner (${sel.owner}) and service desk notified`, sel.crown ? 'Crown-jewel asset: business owner approval required' : 'Release requires the same approvals'], risk: 'high', done: `Isolation of ${sel.host} requested` })}>Isolate device</Btn>
              </>
            ) : undefined}
          >
            <div className="stack" style={{ gap: 16 }}>
              <KV rows={[
                ['Security status', <Badge key="e" color={EXP_COLOR[sel.exposure]}>{sel.exposure === 'None' ? 'Healthy' : `${sel.exposure} exposure`}</Badge>],
                ['Coverage', `${sel.onboarded ? 'Onboarded' : 'Not onboarded'} · sensor ${sel.sensor ? 'active' : 'inactive'}`],
                ['Status', `${sel.online ? 'Online' : 'Offline'} · last seen ${fmtAgo(sel.lastSeenMin)}`],
                ['IP address', <span key="ip" className="mono">{sel.ip}</span>],
                ['Owner', sel.owner],
                ['Open findings', `${sel.vulns} vulnerabilities · ${sel.alerts} alerts (7 d)`],
                ['Tags', sel.tags.length ? sel.tags.join(', ') : 'None'],
              ]} />
              {plant && <OtReadOnly>This is an OT, medical-device or engineering host on a site network. HexaView reads its telemetry but response is carried out by site engineers.</OtReadOnly>}
              <div>
                <div className="section-label">Vulnerabilities on this device · {dc.length}</div>
                {dc.length ? dc.map((x) => (
                  <div key={x.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => nav('/soc/endpoint')}>
                    <span className="list-main"><b className="mono">{x.id}</b><span>{x.product} · CVSS {x.cvss}{x.kev ? ' · KEV' : ''}</span></span>
                    <ArrowRight size={13} className="muted" />
                  </div>
                )) : <div className="muted" style={{ fontSize: 12 }}>No tracked CVEs named for this device in the current view.</div>}
              </div>
              <div>
                <div className="section-label">Incidents involving this device · {di.length}</div>
                {di.length ? di.map((i) => (
                  <div key={i.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => nav(`/soc/ir?status=${i.status === 'closed' ? 'closed' : 'open'}&id=${i.id}`)}>
                    <span className="list-main"><b>{i.title}</b><span>{i.id} · {i.status}</span></span>
                  </div>
                )) : <div className="muted" style={{ fontSize: 12 }}>No incidents in range.</div>}
              </div>
              {sel.crown && <Callout kind="warn">Crown jewel: changes need the business owner's approval and are scheduled in a maintenance window.</Callout>}
            </div>
          </Drawer>
        );
      })()}

      {threats && (
        <RecordsDrawer title="Active threats" sub="Endpoint incidents open right now" source={`${tools.edrShort} · HexaSOC`} icon={<Siren />} onClose={() => setThreats(false)}
          rows={threatIncs.map((i) => ({ id: i.id, title: i.title, sub: `${i.id} · ${i.hosts.join(', ')} · ${i.status}`, onClick: () => nav(`/soc/ir?status=open&id=${i.id}`) }))} />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
    </>
  );
}
