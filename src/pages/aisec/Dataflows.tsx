import { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Card, KpiStrip, Legend, Badge, Callout } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { WorldMap } from '../../components/WorldMap';
import { DataTable } from '../../components/DataTable';
import { dayLabels, fmtCompact, fmtNum, hourLabels } from '../../lib/format';
import { aiControlPlane } from '../../data/modules/ai';
import {
  aisecFlows, aisecClassVendor, aisecDlpSeries, residencyFor, VENDOR_HEX, KIND_HEX,
  type AsItem, type ModelVendor,
} from '../../data/modules/aisec';
import { AS_TONE, BASE, HeatMatrix, ItemDrawer, KIND_ICON, RecordsDrawer, SensorNote, StatusPill, VendorDot, itemRows, toneStyle, useAs } from './parts';

export default function AisecDataflows() {
  const { c, tenantId, days, inv, sum, scope, rl, nav } = useAs();
  const [open, setOpen] = useState<AsItem | null>(null);
  const [list, setList] = useState<{ title: string; items: AsItem[] } | null>(null);
  const cp = aiControlPlane(c);
  const flows = useMemo(() => aisecFlows(inv, 9), [inv]);
  const cv = useMemo(() => aisecClassVendor(c, inv), [c, inv]);
  const dlp = aisecDlpSeries(c, tenantId, days, sum);
  const labels = days === 1 ? hourLabels(24) : dayLabels(dlp.n);

  const vendorsUsed = flows.vendors.map(([v]) => v);
  const allVendors = [...new Set(inv.filter((x) => x.kind !== 'ML model').map((x) => x.modelVendor))];
  const res = allVendors.map((v) => ({ ...residencyFor(c, v), sessions: inv.filter((x) => x.modelVendor === v).reduce((s, x) => s + x.sessions, 0) }));
  const outOfRegion = res.filter((r) => !r.inRegion);
  const sensitiveItems = inv.filter((x) => x.sensitive.length > 0);
  const sensitiveSessions = Math.round(sensitiveItems.reduce((s, x) => s + x.sessions * 0.06, 0));
  const unknown = inv.filter((x) => x.modelVendor === 'Unknown' && x.sensitive.length);
  const hq = c.tenants[0];

  const columns: FlowColumn[] = [
    { label: 'Department', nodes: flows.depts.map(([d, n]) => ({ id: `d:${d}`, title: d, count: fmtCompact(n), sub: 'sessions', icon: <Building2 size={13} /> })) },
    {
      label: 'AI app / model',
      nodes: flows.apps.map((a) => {
        const Icon = KIND_ICON[a.kind];
        return { id: a.id, title: a.name, count: fmtCompact(a.sessions), sub: a.sensitive.length ? a.sensitive[0] : 'No sensitive class', state: a.status === 'shadow' ? ('bad' as const) : a.sensitive.length ? ('warn' as const) : ('good' as const), icon: <Icon size={13} style={{ color: KIND_HEX[a.kind] }} />, onClick: () => setOpen(a) };
      }),
    },
    {
      label: 'Model vendor',
      nodes: flows.vendors.map(([v, n]) => {
        const r = residencyFor(c, v);
        return { id: `v:${v}`, title: v, count: fmtCompact(n), sub: r.inRegion ? r.label.split(' · ')[1] ?? 'In region' : v === 'Unknown' ? 'Unresolved' : 'Out of region', color: VENDOR_HEX[v], state: !r.inRegion ? ('bad' as const) : undefined, onClick: () => setList({ title: `Apps sending to ${v}`, items: inv.filter((x) => x.modelVendor === v) }) };
      }),
    },
  ];
  const links: FlowLink[] = [
    ...flows.deptApp.map((l) => ({ from: `d:${l.from}`, to: l.to, value: l.value, bad: l.bad })),
    ...flows.apps.map((a) => ({ from: a.id, to: `v:${a.modelVendor}`, value: a.sessions, bad: !residencyFor(c, a.modelVendor).inRegion && a.sensitive.length > 0 })),
  ];

  const flowRows = inv
    .filter((x) => x.sensitive.length && x.kind !== 'ML model')
    .flatMap((x) => x.sensitive.map((k) => ({ x, k, sessions: Math.round(x.sessions * 0.05) + 1, res: residencyFor(c, x.modelVendor) })));

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. Where sensitive data goes, and to which model vendor: department → AI app → model vendor, from the kernel sensor&rsquo;s view of process, memory and network on every covered host, cross-checked with {cp.label}. {c.residency}. {rl}.
      </p>
      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'Sensitive sessions', value: fmtCompact(sensitiveSessions), unit: `${sensitiveItems.length} apps`, onClick: () => setList({ title: 'Apps carrying sensitive data classes', items: sensitiveItems }), source: 'Nexovern sensor (memory + network)' },
          { label: 'Prompts redacted', value: fmtNum(sum.redacted), toneColor: '#68b1ff', to: `${BASE}/policy?outcome=redacted`, source: 'HexaAI data-class rules' },
          { label: 'Prompts blocked', value: fmtNum(sum.blocked), toneColor: 'var(--bad)', to: `${BASE}/policy?outcome=blocked`, source: 'HexaAI data-class rules' },
          { label: 'Model vendors', value: allVendors.length, onClick: () => setList({ title: 'All AI apps by vendor', items: inv.filter((x) => x.kind !== 'ML model') }), source: 'Nexovern sensor (TLS SNI + process)' },
          { label: 'Out-of-region vendors', value: outOfRegion.length, toneColor: 'var(--sev-high)', onClick: () => setList({ title: 'Apps using out-of-region vendors', items: inv.filter((x) => outOfRegion.some((r) => r.vendor === x.modelVendor)) }), source: 'HexaAI residency policy' },
          { label: 'Sensitive → unknown model', value: unknown.length, toneColor: 'var(--bad)', onClick: () => setList({ title: 'Sensitive data to unknown models', items: unknown }), source: 'Nexovern sensor · unresolved endpoints' },
        ]}
      />

      <Card
        title="Data in motion: department → AI app → model vendor"
        sub="Top AI apps by session volume · red = sensitive data to shadow AI or out-of-region vendor · click a node"
        actions={<Legend items={[{ label: 'Sanctioned path', color: '#4f8cff' }, { label: 'Sensitive to shadow / out of region', color: '#f0466e' }]} />}
      >
        <FlowMap columns={columns} links={links} height={440} footer={<SensorNote>flows reconstructed from process → socket → TLS SNI on covered hosts; prompts never leave {c.short}&rsquo;s data plane</SensorNote>} />
      </Card>

      <div className="grid g2">
        <Card title="Sensitive data class × model vendor" sub="Sessions where the sensor matched the class in the prompt buffer · click a cell">
          <HeatMatrix
            rows={cv.classes.map((k) => ({ id: k, label: k }))}
            cols={cv.vendors.map((v) => (v === 'Self-hosted (open source)' ? 'Self-hosted' : v))}
            cells={cv.cells}
            color="#f0466e"
            rowW={170}
            fmt={fmtCompact}
            onCell={(ri, ci) => setList({ title: `${cv.classes[ri]} → ${cv.vendors[ci]}`, items: inv.filter((x) => x.modelVendor === cv.vendors[ci] && x.dataClasses.includes(cv.classes[ri])) })}
          />
        </Card>
        <Card title="Model vendor residency" sub={`Where inference runs vs ${c.short}'s approved regions · dashed = out of region`} actions={<Legend items={[{ label: 'In region', color: '#2dd4bf' }, { label: 'Out of region', color: '#f0466e' }]} />}>
          <WorldMap
            height={210}
            onPoint={(id) => setList({ title: `Apps sending to ${id}`, items: inv.filter((x) => x.modelVendor === id) })}
            points={[
              { id: 'hq', lat: hq.lat, lon: hq.lon, label: `${c.short} · ${hq.city}`, sub: 'Primary data plane', color: AS_TONE, size: 0.6 },
              ...res.filter((r) => r.vendor !== 'Unknown').map((r) => ({ id: r.vendor, lat: r.lat, lon: r.lon, label: r.label, sub: `${fmtCompact(r.sessions)} sessions`, color: r.inRegion ? '#2dd4bf' : '#f0466e', size: Math.min(1, 0.25 + Math.log10(r.sessions + 10) / 8), pulse: !r.inRegion })),
            ]}
            links={res.filter((r) => r.vendor !== 'Unknown' && r.vendor !== 'Self-hosted (open source)').map((r) => ({ from: [hq.lat, hq.lon] as [number, number], to: [r.lat, r.lon] as [number, number], color: r.inRegion ? '#2dd4bf' : '#f0466e', dashed: !r.inRegion }))}
          />
          <div className="stack" style={{ gap: 4, marginTop: 6 }}>
            {res.sort((a, b) => b.sessions - a.sessions).map((r) => (
              <button key={r.vendor} className="row cc-row" style={{ fontSize: 11.5, background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => setList({ title: `Apps sending to ${r.vendor}`, items: inv.filter((x) => x.modelVendor === r.vendor) })}>
                <VendorDot v={r.vendor} />
                <span className="muted" style={{ flex: 1 }}>{r.label}</span>
                <Badge color={r.inRegion ? 'var(--good)' : 'var(--bad)'}>{r.inRegion ? 'In region' : 'Out of region'}</Badge>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <Card title="DLP outcomes on prompts" sub={`${rl} · redacted, blocked and coached by the sensor and HexaAI`}>
          <Chart
            height={220}
            option={{
              legend: { top: 0, left: 0 },
              tooltip: { trigger: 'axis' },
              grid: { left: 8, right: 8, top: 34, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: labels, axisLabel: { interval: Math.max(0, Math.floor(labels.length / 6) - 1) } },
              yAxis: { type: 'value' },
              series: [
                { name: 'Redacted', type: 'bar', stack: 'd', data: dlp.redacted, itemStyle: { color: '#68b1ff' } },
                { name: 'Blocked', type: 'bar', stack: 'd', data: dlp.blocked, itemStyle: { color: '#f0466e' } },
                { name: 'Coached', type: 'bar', stack: 'd', data: dlp.coached, itemStyle: { color: '#f0a338', borderRadius: [3, 3, 0, 0] } },
              ],
            }}
          />
          {vendorsUsed.includes('Unknown') && <Callout kind="warn">Unknown model endpoints are treated as out of region: sensitive classes to them are blocked by default.</Callout>}
        </Card>
        <Card title="Sensitive flows" count={flowRows.length} sub="Every app × sensitive class pair seen in the range" flush>
          <DataTable
            rows={flowRows}
            rowKey={(r, i) => `${r.x.id}-${r.k}-${i}`}
            onRowClick={(r) => setOpen(r.x)}
            initialSort={{ key: 'sess', dir: 'desc' }}
            pageSize={8}
            search={(r) => `${r.x.name} ${r.k} ${r.x.modelVendor}`}
            columns={[
              { key: 'app', header: 'AI app', sort: (r) => r.x.name, render: (r) => (<><div className="t-main">{r.x.name}</div><div className="t-sub">{r.x.department}</div></>) },
              { key: 'st', header: 'Status', render: (r) => <StatusPill status={r.x.status} /> },
              { key: 'class', header: 'Data class', sort: (r) => r.k, render: (r) => <Badge color="var(--sev-high)">{r.k}</Badge> },
              { key: 'vendor', header: 'Vendor', sort: (r) => r.x.modelVendor, render: (r) => <VendorDot v={r.x.modelVendor as ModelVendor} /> },
              { key: 'res', header: 'Residency', render: (r) => <span className="t-sub" style={{ color: r.res.inRegion ? undefined : 'var(--bad)' }}>{r.res.label.split(' · ').slice(-1)[0]}</span> },
              { key: 'sess', header: 'Sessions', align: 'right', sort: (r) => r.sessions, render: (r) => <span className="num">{fmtNum(r.sessions)}</span> },
              { key: 'v', header: 'Outcome', render: (r) => <Badge color={r.x.status === 'shadow' ? 'var(--bad)' : '#68b1ff'}>{r.x.status === 'shadow' ? 'Blocked' : 'Redacted'}</Badge> },
            ]}
          />
        </Card>
      </div>

      <div className="row between">
        <SensorNote>data-class detection runs in memory on the host; only verdicts and hashes leave it</SensorNote>
        <button className="link" onClick={() => nav(`${BASE}/policy`)}>Tune data-class rules →</button>
      </div>

      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
      {list && <RecordsDrawer title={list.title} source="Nexovern sensor via HexaAI" onClose={() => setList(null)} rows={itemRows(list.items, (x) => { setList(null); setOpen(x); }, (x) => <span className="num" style={{ fontSize: 11.5 }}>{fmtCompact(x.sessions)}</span>)} />}
    </div>
  );
}
