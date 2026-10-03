import { useEffect, useMemo, useState } from 'react';
import { MapPin, Globe2, ShieldBan, Plug, Ban } from 'lucide-react';
import { Card, Badge, KV, Btn, IcoBox, Sources, Callout } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { WorldMap, type MapPoint, type MapLink } from '../../components/WorldMap';
import { geoThreats } from '../../data/modules/soc';
import { fmtCompact, fmtNum } from '../../lib/format';
import { useSoc, StatTile, RankList, RecordsDrawer, WriteBackModal, type WriteBack } from './parts';

type Country = ReturnType<typeof geoThreats>['list'][number];

export default function SocGeomap() {
  const { c, tenantId, days, tools, tone, scopeLabel, rangeText } = useSoc();
  const g = useMemo(() => geoThreats(c, tenantId, days), [c, tenantId, days]);
  const [sel, setSel] = useState<Country | null>(null);
  const [panel, setPanel] = useState<'ports' | 'targets' | 'locations' | null>(null);
  const [proto, setProto] = useState<string | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 2600);
    return () => window.clearInterval(t);
  }, []);
  const netWrite = c.connectors.find((k) => (k.category === 'Network' || k.category === 'SASE') && k.write.length);
  const src = g.perimeter.join(' · ');

  const max = g.list[0]?.count ?? 1;
  const points: MapPoint[] = [
    ...g.list.slice(0, 18).map((x) => ({ id: x.cc, lat: x.lat, lon: x.lon, label: `${x.name} · ${fmtNum(x.count)} blocked`, sub: 'Click for detail', color: '#f0466e', size: 0.15 + (x.count / max) * 0.85, pulse: x.count / max > 0.45 })),
    ...g.tenants.map((t) => ({ id: `t-${t.id}`, lat: t.lat, lon: t.lon, label: t.name, sub: `${t.city} · protected perimeter`, color: '#2dd4bf', size: 0.25 })),
  ];
  const home = g.tenants[0];
  const links: MapLink[] = home ? g.list.slice(0, 6).map((x) => ({ from: [x.lat, x.lon], to: [home.lat, home.lon], color: '#f0466e' })) : [];
  const feed = g.feed.map((_, i) => g.feed[(i + tick) % g.feed.length]);
  const now = new Date();
  const fmtT = (sec: number) => new Date(now.getTime() + tick * 2600 - sec * 1000).toLocaleTimeString('en-GB');

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · where blocked connection attempts against {c.short}'s perimeter originate, from {src}. Bubble size reflects volume · {rangeText.toLowerCase()}.
      </p>

      <div className="soc-stats">
        <StatTile icon={<MapPin />} value={fmtNum(g.locations)} label="Total source locations" tone="#4f8cff" onClick={() => setPanel('locations')} source={src} />
        <StatTile icon={<Globe2 />} value={g.countries} label="Countries" tone="#2dd4bf" onClick={() => setPanel('locations')} source={src} />
        <StatTile icon={<ShieldBan />} value={fmtNum(g.blocked)} label="Blocked threats" tone="#f0466e" onClick={() => setPanel('targets')} source={src} />
        <StatTile icon={<Plug />} value={fmtNum(g.activePorts)} label="Active ports probed" tone="#f5a83d" onClick={() => setPanel('ports')} source={src} />
      </div>

      <div className="grid g-2-1">
        <Card title="Attack origin map" sub="Red: blocked sources · teal: your sites · click a bubble" actions={<Sources items={g.perimeter.slice(0, 3).map((n) => ({ name: n }))} />}>
          <WorldMap points={points} links={links} height={360} onPoint={(id) => { const x = g.list.find((k) => k.cc === id); if (x) setSel(x); }} />
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Top source countries" sub="Blocked attempts">
            <RankList tone="#f0466e" onPick={(id) => setSel(g.list.find((x) => x.cc === id) ?? null)} rows={g.list.slice(0, 6).map((x) => ({ id: x.cc, label: x.name, value: x.count }))} />
          </Card>
          <Card title="Top targeted protocols" sub="Blocked attempts">
            <RankList tone="#f5a83d" onPick={(id) => { setProto(id); setPanel('ports'); }} rows={g.protocols.slice(0, 6).map((p) => ({ id: p.name, label: p.name, sub: `port ${p.port}`, value: p.count }))} />
          </Card>
        </div>
      </div>

      <div className="grid g-2-1">
        <Card title="Live attack feed" actions={<span className="soc-live"><i />LIVE</span>} flush>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th className="r">Port</th><th>Reason</th><th>Action</th></tr>
              </thead>
              <tbody>
                {feed.slice(0, 10).map((f, i) => (
                  <tr key={`${tick}-${i}`} className="clickable" onClick={() => setSel(g.list.find((x) => x.cc === f.cc) ?? null)}>
                    <td className="mono nowrap">{fmtT(f.sec)}</td>
                    <td><span className="row" style={{ gap: 6 }}><span className="soc-cc">{f.cc}</span><span><span className="mono" style={{ fontSize: 11.5 }}>{f.srcIp}</span><div className="t-sub">{f.country}</div></span></span></td>
                    <td><span className="mono" style={{ fontSize: 11.5 }}>{f.destIp}</span><div className="t-sub">{f.dest}</div></td>
                    <td><b style={{ fontSize: 12 }}>{f.proto}</b></td>
                    <td className="r mono">{f.port}</td>
                    <td className="t-sub">{f.reason}</td>
                    <td><Badge color="var(--bad)" solid>{f.action}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Most targeted public services" sub={`${c.domain} estate · click for detail`}>
          <RankList tone={tone} onPick={() => setPanel('targets')} rows={g.targets.map((t) => ({ id: t.host, label: t.host, value: t.count, display: fmtCompact(t.count) }))} />
          {g.protocols.some((p) => p.note) && (
            <div style={{ marginTop: 12 }}>
              <div className="section-label">Sector-specific probes</div>
              <div className="stack" style={{ gap: 4, fontSize: 12 }}>
                {g.protocols.filter((p) => p.note).map((p) => <span key={p.name}><b>{p.name}</b> <span className="muted">· port {p.port} · {p.note} · {fmtNum(p.count)}</span></span>)}
              </div>
            </div>
          )}
        </Card>
      </div>

      {sel && (
        <Drawer
          title={sel.name}
          sub={`${fmtNum(sel.count)} blocked attempts · ${rangeText.toLowerCase()}`}
          icon={<IcoBox color="#f0466e"><Globe2 /></IcoBox>}
          onClose={() => setSel(null)}
          footer={netWrite ? <Btn primary onClick={() => setWb({ title: `Geo-block ${sel.name}`, system: `${netWrite.vendor} ${netWrite.product}`, target: `Inbound from ${sel.name} (${sel.cc})`, changes: [`${netWrite.write[0]}: deny inbound from ${sel.cc} to published services`, 'Exceptions kept for named partners and roaming staff (conditional access still applies)', 'Review in 30 days'], risk: 'medium', done: `Geo-block for ${sel.name} requested` })}><Ban size={14} /> Geo-block</Btn> : undefined}
        >
          <div className="stack" style={{ gap: 16 }}>
            <KV rows={[
              ['Blocked attempts', fmtNum(sel.count)],
              ['Share of total', `${((sel.count / Math.max(1, g.blocked)) * 100).toFixed(1)}%`],
              ['Top protocols', g.protocols.slice(0, 3).map((p) => p.name).join(', ')],
              ['Enforced by', g.perimeter.join(', ')],
              ['Threat intel', `${Math.round(sel.count * 0.07)} source IPs matched HexaInt scanner and botnet lists`],
            ]} />
            <div>
              <div className="section-label">Recent sources</div>
              <div className="stack" style={{ gap: 4 }}>
                {g.feed.filter((f) => f.cc === sel.cc).concat(g.feed.slice(0, 3)).slice(0, 5).map((f, i) => (
                  <span key={i} className="row between" style={{ fontSize: 12 }}><span className="mono">{f.srcIp}</span><span className="muted">{f.proto}/{f.port} → {f.dest}</span></span>
                ))}
              </div>
            </div>
            <Callout>Blocked traffic is noise, not compromise. HexaSOC escalates only when a blocked source later succeeds elsewhere (for example a sign-in from the same ASN) or matches a tracked actor.</Callout>
          </div>
        </Drawer>
      )}

      {panel && (
        <RecordsDrawer
          title={panel === 'ports' ? (proto ? `${proto} attempts` : 'Ports and protocols probed') : panel === 'targets' ? 'Targeted services' : 'Source countries'}
          source={src}
          icon={<Plug />}
          onClose={() => { setPanel(null); setProto(null); }}
          rows={panel === 'ports'
            ? g.protocols.filter((p) => !proto || p.name === proto).map((p) => ({ id: p.name, title: `${p.name} · port ${p.port}`, sub: p.note || `${tools.siemShort} firewall logs`, right: <span className="num" style={{ fontWeight: 700 }}>{fmtNum(p.count)}</span> }))
            : panel === 'targets'
              ? g.targets.map((t) => ({ id: t.host, title: t.host, sub: t.ip, right: <span className="num" style={{ fontWeight: 700 }}>{fmtNum(t.count)}</span> }))
              : g.list.map((x) => ({ id: x.cc, title: x.name, sub: x.cc, right: <span className="num" style={{ fontWeight: 700 }}>{fmtNum(x.count)}</span>, onClick: () => { setPanel(null); setSel(x); } }))}
        />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
    </>
  );
}
