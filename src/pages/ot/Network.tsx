import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Network as NetIcon, ShieldAlert, Building2, Cloud, Radio, Wifi, Server } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { otScope, otZones, otCrossings, otProtocols, zoneFlows, zoneKey, flowLevel, LEVEL_HEX, LEVEL_NUM, type OtZone, type OtCrossing, type PurdueLevel } from '../../data/modules/ot';
import { KpiStrip, Card, Badge, StatusBadge, Chip, Callout, Legend } from '../../components/ui';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtNum } from '../../lib/format';
import { OT_TONE, OtIntro, NoOtState, CellMeter, srcNames } from './parts';

const BOUNDARY_COLOR: Record<string, string> = { Controlled: 'var(--text-muted)', Isolated: 'var(--good)', Flat: 'var(--sev-high)' };
const KIND_COLOR: Record<string, string> = { Industrial: '#f5a83d', Medical: '#2dd4bf', Building: '#a07cfb', Broadcast: '#68b1ff', Vehicle: '#ef6aae', 'General purpose': '#8a9bc0' };

function LvlNum({ level }: { level: PurdueLevel | 'Internet' }) {
  if (level === 'Internet') return <Badge color="var(--bad)">Internet</Badge>;
  return <span className="ot-lv-n" style={{ ['--lvl' as string]: LEVEL_HEX[level], display: 'inline-grid' }}>{LEVEL_NUM[level]}</span>;
}

function iconFor(name: string) {
  if (/Vendor/.test(name)) return <Radio size={13} />;
  if (/Wi-Fi/.test(name)) return <Wifi size={13} />;
  if (/Enterprise|Corporate|Clinical IT|Facilities IT|Shore|Branch|Crew/.test(name)) return <Building2 size={13} />;
  if (/bundle|internet/i.test(name)) return <Cloud size={13} />;
  if (/DMZ/.test(name)) return <ShieldAlert size={13} />;
  return <Server size={13} />;
}

export default function OtNetwork() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const sc = useMemo(() => otScope(c, tenantId), [c, tenantId]);
  const zones = useMemo(() => otZones(c, tenantId), [c, tenantId]);
  const crossings = useMemo(() => otCrossings(c, tenantId), [c, tenantId]);
  const protocols = useMemo(() => otProtocols(c, tenantId), [c, tenantId]);
  const flows = useMemo(() => zoneFlows(c, tenantId), [c, tenantId]);
  const expected = params.get('expected');
  const zone = params.get('zone');
  const show = params.get('show');
  useEffect(() => {
    const id = show === 'protocols' ? 'ot-protocols' : expected || zone ? 'ot-crossings' : null;
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [show, expected, zone]);

  const graph = useMemo(() => {
    const names = [...new Set(flows.flatMap((f) => [f.from, f.to]))];
    const zl = new Map(zones.map((z) => [z.name, z.level] as const));
    const colOfLevel: Record<string, number> = { L4: 0, 'L3.5': 1, L3: 2, L2: 3, L1: 4, L0: 4 };
    const depth = new Map<string, number>();
    for (const n of names) {
      const lv = zl.get(zoneKey(n)) ?? flowLevel(n);
      const hasIn = flows.some((f) => f.to === n);
      depth.set(n, /bundle/i.test(n) ? 4 : !hasIn && lv !== 'L3' ? 0 : colOfLevel[lv]);
    }
    for (let k = 0; k < 6; k++) for (const f of flows.filter((x) => !x.unexpected)) if ((depth.get(f.to) ?? 0) <= (depth.get(f.from) ?? 0)) depth.set(f.to, (depth.get(f.from) ?? 0) + 1);
    const vol = new Map<string, number>();
    for (const f of flows) {
      vol.set(f.from, (vol.get(f.from) ?? 0) + f.value);
      vol.set(f.to, (vol.get(f.to) ?? 0) + f.value);
    }
    const bad = new Set(flows.filter((f) => f.unexpected).map((f) => f.to));
    const labels = ['Where traffic starts', 'Boundary', 'Site operations', 'Supervisory', 'Control zones', 'Field'];
    const cols: FlowColumn[] = [];
    const D = Math.max(...depth.values());
    for (let d = 0; d <= D; d++) {
      const ns = names.filter((n) => depth.get(n) === d).sort((a, b) => (vol.get(b) ?? 0) - (vol.get(a) ?? 0));
      if (!ns.length) continue;
      cols.push({
        label: labels[Math.min(d, labels.length - 1)],
        nodes: ns.map((n) => ({
          id: n, title: zoneKey(n), icon: iconFor(n),
          count: fmtNum(Math.round((vol.get(n) ?? 0) / (d === 0 || d === D ? 1 : 2))),
          sub: bad.has(n) ? 'unexpected inbound' : 'sessions / day',
          state: bad.has(n) ? 'bad' as const : d === 0 ? undefined : 'good' as const,
          onClick: () => setParams(new URLSearchParams({ zone: zoneKey(n) }), { replace: true }),
        })),
      });
    }
    const links: FlowLink[] = flows.map((f) => ({ from: f.from, to: f.to, value: f.value, bad: f.unexpected }));
    return { cols, links };
  }, [flows, zones, setParams]);

  if (!sc.hasOt) return <NoOtState what="Network segmentation covers sites that run operational technology." />;
  const src = srcNames(sc);
  const conv = zones.reduce((s, z) => s + z.conversations, 0);
  const cross = zones.reduce((s, z) => s + z.crossings, 0);
  const unexpected = crossings.filter((x) => !x.expected);
  const noId = protocols.filter((p) => !p.provesIdentity).length;
  const maxConv = Math.max(1, ...zones.map((z) => z.conversations));
  const maxProto = Math.max(1, ...protocols.map((p) => p.assets));
  const xRows = crossings.filter((x) => (expected === 'no' ? !x.expected : expected === 'yes' ? x.expected : true) && (!zone || x.src.zone === zone || x.dst.zone === zone));
  const setOnly = (k: string, v: string | null) => setParams(v ? new URLSearchParams({ [k]: v }) : new URLSearchParams(), { replace: true });

  return (
    <>
      <OtIntro>
        <b>{c.name}</b> · what actually crossed the boundaries between your networks, as observed on mirrored traffic by {src}. Configuration says what should happen; this says what did.
      </OtIntro>

      <KpiStrip
        toneColor={OT_TONE}
        items={[
          { label: 'Zones', hint: 'observed', value: zones.length, onClick: () => document.getElementById('ot-zones')?.scrollIntoView({ behavior: 'smooth' }), source: src },
          { label: 'Conversations', hint: 'between assets', value: fmtNum(conv), onClick: () => document.getElementById('ot-zones')?.scrollIntoView({ behavior: 'smooth' }), source: src },
          { label: 'Crossings', hint: 'between Purdue levels', value: fmtNum(cross), onClick: () => setOnly('expected', null), source: src },
          { label: 'Unexpected', hint: 'not in the site design', value: unexpected.length, toneColor: 'var(--bad)', onClick: () => setOnly('expected', 'no'), source: src },
          { label: 'Protocols', hint: 'in use', value: protocols.length, onClick: () => setOnly('show', 'protocols'), source: `${src} · passive DPI` },
          { label: 'No identity', hint: 'protocols that cannot prove who is talking', value: noId, onClick: () => setOnly('show', 'protocols'), source: `${src} · passive DPI` },
        ]}
      />

      <Card title={<><NetIcon size={15} /> Zones and conduits</>} sub="Sessions per day between zones · red curves are crossings the site design does not allow · click a zone to filter" actions={<Legend items={[{ label: 'By design', color: '#4f8cff' }, { label: 'Not in the design', color: '#f0466e' }]} />}>
        <div className="ot-flow"><FlowMap columns={graph.cols} links={graph.links} footer={<span>{unexpected.length} crossings outside the conduit design · HexaView raises them to the owning team and never changes firewall rules in OT.</span>} /></div>
      </Card>

      <Card title="Zones" count={zones.length} sub="Crossing rate is conversations that left the level, over all of them · click a zone to open its assets" flush>
        <div id="ot-zones" />
        <DataTable
          rows={zones}
          rowKey={(z) => z.name}
          onRowClick={(z: OtZone) => (z.assets ? nav(`/ot/assets?view=all&zone=${encodeURIComponent(z.name)}`) : setOnly('zone', z.name))}
          pageSize={20}
          columns={[
            { key: 'zone', header: 'Zone', sort: (z) => z.name, render: (z) => (<><div className="t-main">{z.name}</div><div className="t-sub" style={{ whiteSpace: 'normal' }}>{z.desc}</div></>) },
            { key: 'level', header: 'Level', sort: (z) => LEVEL_NUM[z.level], render: (z) => <LvlNum level={z.level} /> },
            { key: 'b', header: 'Boundary', sort: (z) => z.boundary, render: (z) => <StatusBadge value={z.boundary} map={BOUNDARY_COLOR} /> },
            { key: 'assets', header: 'Assets', align: 'right', sort: (z) => z.assets, render: (z) => (z.assets ? fmtNum(z.assets) : '—') },
            { key: 'conv', header: 'Conversations', sort: (z) => z.conversations, render: (z) => <CellMeter value={z.conversations} max={maxConv} label={fmtNum(z.conversations)} /> },
            { key: 'rate', header: 'Crossing rate', sort: (z) => z.crossings / z.conversations, render: (z) => (<><b style={{ color: z.crossings / z.conversations > 0.3 ? 'var(--sev-high)' : undefined }}>{Math.round((z.crossings / z.conversations) * 100)}%</b><div className="t-sub">{z.crossings} of {z.conversations}</div></>) },
          ]}
        />
      </Card>

      <Card
        title="Traffic that crossed a Purdue boundary"
        count={xRows.length}
        sub={`${unexpected.length} not allowed by the site design${zone ? ` · zone: ${zone}` : ''}`}
        flush
        actions={
          <span className="chips">
            <Chip on={!expected} onClick={() => setParams(zone ? new URLSearchParams({ zone }) : new URLSearchParams(), { replace: true })} color={OT_TONE}>All</Chip>
            <Chip on={expected === 'no'} onClick={() => setOnly('expected', 'no')} color="var(--bad)">Unexpected</Chip>
            <Chip on={expected === 'yes'} onClick={() => setOnly('expected', 'yes')} color="var(--good)">By design</Chip>
            {zone && <Chip on onClick={() => setOnly('zone', null)} color={OT_TONE}>{zone} ✕</Chip>}
          </span>
        }
      >
        <div id="ot-crossings" />
        <DataTable
          rows={xRows}
          rowKey={(x) => x.id}
          onRowClick={(x: OtCrossing) => (x.alerts ? nav(`/ot/alerts?q=${encodeURIComponent(x.dst.name)}`) : undefined)}
          columns={[
            { key: 'conv', header: 'Conversation', render: (x) => (
              <div>
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <span><div className="t-main mono">{x.src.name}</div><div className="t-sub">{x.src.zone} · level {x.src.level === 'Internet' ? '—' : LEVEL_NUM[x.src.level]}</div></span>
                  <ArrowRight size={14} className="muted" style={{ marginTop: 3, flex: 'none' }} />
                  <span><div className="t-main mono">{x.dst.name}</div><div className="t-sub">{x.dst.zone} · {x.dst.level === 'Internet' ? 'outside the estate' : `level ${LEVEL_NUM[x.dst.level]}`}</div></span>
                </div>
                <div className="t-sub" style={{ whiteSpace: 'normal', marginTop: 4, color: x.expected ? undefined : 'var(--text-secondary)' }}>{x.note}</div>
              </div>
            ) },
            { key: 'p', header: 'Protocol', sort: (x) => x.protocol, render: (x) => <span className="src-chip">{x.protocol}</span> },
            { key: 'site', header: 'Site', sort: (x) => x.site, render: (x) => <span className="t-sub">{x.site}</span> },
            { key: 'e', header: 'Expected', sort: (x) => Number(x.expected), render: (x) => (x.expected ? <Badge color="var(--good)">By design</Badge> : <Badge color="var(--bad)" solid>Unexpected</Badge>) },
            { key: 'a', header: 'Alerts', align: 'right', sort: (x) => x.alerts, render: (x) => (x.alerts ? <b>{x.alerts}</b> : '—') },
            { key: 'seen', header: 'Last seen', sort: (x) => -x.lastSeenMin, render: (x) => <span className="t-sub">{fmtAgo(x.lastSeenMin)}</span> },
          ]}
          empty="No crossings match this filter."
        />
      </Card>

      <Card title="Protocols in use" count={protocols.length} sub={`${noId} cannot prove who is talking · click to see the assets speaking it`} flush>
        <div id="ot-protocols" />
        <DataTable
          rows={protocols}
          rowKey={(p) => p.name}
          pageSize={14}
          initialSort={{ key: 'n', dir: 'desc' }}
          onRowClick={(p) => (p.kind !== 'General purpose' ? nav(`/ot/assets?view=all&proto=${encodeURIComponent(p.name)}`) : undefined)}
          columns={[
            { key: 'p', header: 'Protocol', sort: (p) => p.name, render: (p) => (<><div className="t-main">{p.name}</div><div className="t-sub">{p.desc}</div></>) },
            { key: 'k', header: 'Kind', sort: (p) => p.kind, render: (p) => <Badge color={KIND_COLOR[p.kind]}>{p.kind}</Badge> },
            { key: 'n', header: 'Assets speaking it', sort: (p) => p.assets, render: (p) => <CellMeter value={p.assets} max={maxProto} color={KIND_COLOR[p.kind]} label={fmtNum(p.assets)} /> },
            { key: 'id', header: 'Proves identity', sort: (p) => Number(p.provesIdentity), render: (p) => (p.provesIdentity ? <Badge color="var(--good)">Yes</Badge> : <Badge color="var(--sev-medium)">No</Badge>) },
          ]}
        />
        <div style={{ padding: '0 18px 14px' }}>
          <Callout kind="info" color={OT_TONE}>A protocol that cannot prove identity accepts commands from anyone who can reach the device. The fix is in the conduit design, which is why boundary crossings above matter more than the protocol list.</Callout>
        </div>
      </Card>
    </>
  );
}
