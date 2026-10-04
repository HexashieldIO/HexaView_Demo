import { useMemo, useState } from 'react';
import { Ban, Building2, Send } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { custodyScope, vendorChain, type ChainVendor, type TpnStatus } from '../../data/modules/custody';
import { KpiStrip, Card, Badge, Btn, Chip, Legend, KV, IcoBox, Bar, Callout, StatusBadge } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { WorldMap } from '../../components/WorldMap';
import { fmtAgo, fmtNum, scoreTone } from '../../lib/format';
import { rng } from '../../lib/rng';
import { CUSTODY_TONE, RevokeModal, fmtGb, type RevokeRequest } from './parts';

const TPN_COLOR: Record<TpnStatus, string> = { 'Gold Shield': 'var(--m-custody)', 'Blue Shield': 'var(--accent)', 'Assessment due': 'var(--sev-medium)', 'Not assessed': 'var(--bad)' };
const SCORE_HEX = (s: number) => (s >= 85 ? '#2dd4bf' : s >= 70 ? '#f0a338' : '#f8646f');

export default function CustodyVendors() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const sc = useMemo(() => custodyScope(c, tenantId), [c, tenantId]);
  const vendors = useMemo(() => vendorChain(c), [c]);
  const [sel, setSel] = useState<ChainVendor | null>(null);
  const [revoke, setRevoke] = useState<RevokeRequest | null>(null);
  const [band, setBand] = useState<'all' | 'risk' | 'untracked'>('all');
  const [revoked, setRevoked] = useState<Set<string>>(new Set());

  const media = c.dataKey === 'media';
  const hq = c.tenants[0];
  const avgScore = Math.round(vendors.reduce((s, v) => s + v.custodyScore, 0) / Math.max(1, vendors.length));
  const avgCov = Math.round(vendors.reduce((s, v) => s + v.agentCoverage, 0) / Math.max(1, vendors.length));
  const untracked = vendors.reduce((s, v) => s + v.untrackedCopies, 0);
  const volRange = Math.round((vendors.reduce((s, v) => s + v.volumeGb30d, 0) * days) / 30);
  const tpnOk = vendors.filter((v) => v.tpn === 'Gold Shield' || v.tpn === 'Blue Shield').length;
  const rows = band === 'all' ? vendors : band === 'risk' ? vendors.filter((v) => v.custodyScore < 70) : vendors.filter((v) => v.untrackedCopies > 0);
  const topVol = vendors.slice().sort((a, b) => b.volumeGb30d - a.volumeGb30d).slice(0, 10);
  const r = rng(`custody-vendor-handoffs-${c.id}`);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {vendors.length} organisations hold or handle {sc.label.toLowerCase()} on {c.short}&rsquo;s behalf{tenantId !== 'all' ? ` (vendor chain is shared across the group; volumes shown for ${sc.tenantName})` : ''}. Scores combine custody agent coverage, untracked copies and the {media ? 'TPN status and ' : ''}third-party rating from HexaComply.
      </p>

      <KpiStrip
        toneColor={CUSTODY_TONE}
        items={[
          { label: 'Vendors in chain', value: sc.h.vendorsInChain, onClick: () => document.getElementById('custody-vendor-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaComply TPRM · HexaCustody agents' },
          { label: 'Avg custody score', value: avgScore, bar: avgScore, onClick: () => document.getElementById('custody-vendor-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Agent coverage', value: `${avgCov}%`, bar: avgCov, to: '/custody/telemetry', source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Untracked copies', hint: '7 d', value: untracked, toneColor: 'var(--bad)', to: '/custody/lineage?status=left', source: 'HexaCustody agents · signed custody ledger' },
          media
            ? { label: 'TPN assessed', value: `${tpnOk}/${vendors.length}`, bar: (tpnOk / vendors.length) * 100, onClick: () => document.getElementById('custody-vendor-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'MPA Trusted Partner Network' }
            : { label: 'Tier 1 vendors', value: vendors.filter((v) => v.tier === 1).length, to: '/comply/tprm', source: 'HexaComply TPRM' },
          { label: 'Volume', hint: rangeLabel(timeRange).toLowerCase(), value: fmtGb(volRange), onClick: () => document.getElementById('custody-vendor-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Where your content goes" sub={`Vendor locations with hand-off paths from ${hq.city} · coloured by custody score · click a vendor`} actions={<Legend items={[{ label: '85+', color: '#2dd4bf' }, { label: '70–84', color: '#f0a338' }, { label: '<70', color: '#f8646f' }]} />}>
          <WorldMap
            height={290}
            onPoint={(id) => { const v = vendors.find((x) => x.id === id); if (v) setSel(v); }}
            links={vendors.filter((v) => v.tier === 1 || v.custodyScore < 70).map((v) => ({ from: [hq.lat, hq.lon] as [number, number], to: [v.lat, v.lon] as [number, number], color: SCORE_HEX(v.custodyScore), dashed: v.custodyScore < 70 }))}
            points={[
              { id: 'hq', lat: hq.lat, lon: hq.lon, label: `${c.short} · ${hq.city}`, sub: 'Custody vault & HQ', color: CUSTODY_TONE, size: 0.9 },
              ...vendors.map((v) => ({ id: v.id, lat: v.lat, lon: v.lon, label: `${v.name} · ${v.custodyScore}`, sub: `${v.category} · ${v.country}`, color: SCORE_HEX(v.custodyScore), size: v.tier === 1 ? 0.45 : 0.2, pulse: v.untrackedCopies > 0 })),
            ]}
          />
        </Card>
        <Card title="Volume by vendor" sub="Top 10, last 30 days · bar colour = custody score">
          <Chart
            height={290}
            onClick={(p) => { const n = (p as { name?: string }).name; const v = vendors.find((x) => x.name === n); if (v) setSel(v); }}
            option={{
              grid: { left: 8, right: 40, top: 4, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtGb(v) } },
              yAxis: { type: 'category', data: topVol.map((v) => v.name).reverse(), axisLabel: { fontSize: 10.5 } },
              series: [{ type: 'bar', data: topVol.map((v) => ({ value: v.volumeGb30d, itemStyle: { color: SCORE_HEX(v.custodyScore), borderRadius: [0, 3, 3, 0] } })).reverse() }],
            }}
          />
        </Card>
      </div>

      <div id="custody-vendor-table" />
      <Card title={<><Building2 size={15} /> Vendor chain</>} count={rows.length} sub="Click a vendor for coverage, recent hand-offs and actions" flush>
        <DataTable
          rows={rows}
          rowKey={(v) => v.id}
          onRowClick={setSel}
          search={(v) => `${v.name} ${v.category} ${v.country} ${v.access}`}
          searchPlaceholder="Search vendor, category, country…"
          initialSort={{ key: 'score', dir: 'asc' }}
          toolbar={
            <span className="chips">
              <Chip on={band === 'all'} onClick={() => setBand('all')} color={CUSTODY_TONE}>All</Chip>
              <Chip on={band === 'risk'} onClick={() => setBand('risk')} color="var(--bad)">Score &lt; 70 · {vendors.filter((v) => v.custodyScore < 70).length}</Chip>
              <Chip on={band === 'untracked'} onClick={() => setBand('untracked')} color="var(--sev-high)">Untracked copies · {vendors.filter((v) => v.untrackedCopies > 0).length}</Chip>
            </span>
          }
          columns={[
            { key: 'name', header: 'Vendor', sort: (v) => v.name, render: (v) => (<><div className="t-main">{v.name} {revoked.has(v.id) && <Badge color="var(--bad)">Access revoked</Badge>}</div><div className="t-sub">{v.category} · {v.country} · Tier {v.tier}</div></>) },
            { key: 'score', header: 'Custody score', sort: (v) => v.custodyScore, render: (v) => <b className="num" style={{ fontSize: 15, color: scoreTone(v.custodyScore) }}>{v.custodyScore}</b> },
            { key: 'cov', header: 'Agent coverage', sort: (v) => v.agentCoverage, render: (v) => (<div style={{ minWidth: 110 }}><Bar value={v.agentCoverage} color={v.agentCoverage >= 95 ? 'var(--good)' : v.agentCoverage >= 80 ? 'var(--sev-medium)' : 'var(--bad)'} size="thin" /><span className="t-sub">{v.agentCoverage}% · {v.agents} agents</span></div>) },
            { key: 'untr', header: 'Untracked', align: 'right', sort: (v) => v.untrackedCopies, render: (v) => <b style={{ color: v.untrackedCopies ? 'var(--bad)' : 'var(--text-muted)' }}>{v.untrackedCopies}</b> },
            media
              ? { key: 'tpn', header: 'TPN', sort: (v: ChainVendor) => v.tpn ?? '', render: (v: ChainVendor) => (v.tpn ? <StatusBadge value={v.tpn} map={TPN_COLOR} /> : '—') }
              : { key: 'assur', header: 'Assurance', sort: (v: ChainVendor) => v.assurance, render: (v: ChainVendor) => <span className="t-sub">{v.assurance}</span> },
            { key: 'vol', header: 'Volume 30 d', align: 'right', sort: (v) => v.volumeGb30d, render: (v) => fmtGb(v.volumeGb30d) },
            { key: 'assets', header: 'Assets held', align: 'right', sort: (v) => v.assetsHeld, render: (v) => fmtNum(v.assetsHeld) },
            { key: 'last', header: 'Last transfer', sort: (v) => -v.lastTransferMin, render: (v) => <span className="t-sub">{fmtAgo(v.lastTransferMin)}</span> },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          wide
          title={sel.name}
          sub={`${sel.category} · ${sel.country} · Tier ${sel.tier}`}
          icon={<IcoBox color={SCORE_HEX(sel.custodyScore)}><Building2 /></IcoBox>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn onClick={() => toast(`Agent deployment requested from ${sel.name} via HexaComply third-party workflow; due in 10 working days`)}><Send /> Request agent deployment</Btn>
              <span className="spacer" />
              <Btn primary color="var(--bad)" disabled={revoked.has(sel.id)} onClick={() => setRevoke({ scope: 'supplier', target: sel.name, asset: sel.access, detail: `${sel.users} users · ${sel.agents} agents` })}><Ban /> Revoke supplier access</Btn>
            </>
          }
        >
          <div className="row" style={{ gap: 18, marginBottom: 14 }}>
            <div>
              <div className="stat-big" style={{ color: scoreTone(sel.custodyScore), fontSize: 36 }}>{sel.custodyScore}</div>
              <div className="stat-label">custody score</div>
            </div>
            <div className="stack" style={{ flex: 1, gap: 6 }}>
              <div className="row" style={{ fontSize: 12 }}><span className="muted" style={{ width: 120 }}>Agent coverage</span><Bar value={sel.agentCoverage} color={CUSTODY_TONE} /><b style={{ width: 40, textAlign: 'right' }}>{sel.agentCoverage}%</b></div>
              <div className="row" style={{ fontSize: 12 }}><span className="muted" style={{ width: 120 }}>Third-party rating</span><Bar value={sel.rating} color="var(--accent)" /><b style={{ width: 40, textAlign: 'right' }}>{sel.rating}</b></div>
            </div>
          </div>
          <KV rows={[
            ['Access', sel.access],
            ['Untracked copies (7 d)', <b style={{ color: sel.untrackedCopies ? 'var(--bad)' : undefined }}>{sel.untrackedCopies}</b>],
            [media ? 'TPN status' : 'Assurance', media && sel.tpn ? <StatusBadge value={sel.tpn} map={TPN_COLOR} /> : sel.assurance],
            ['Users with grants', sel.users],
            ['Custody agents', sel.agents],
            ['Assets held', fmtNum(sel.assetsHeld)],
            ['Transfers (30 d)', fmtNum(sel.transfers30d)],
            ['Volume (30 d)', fmtGb(sel.volumeGb30d)],
            ['Last transfer', fmtAgo(sel.lastTransferMin)],
          ]} />
          <div className="section-label" style={{ marginTop: 16 }}>Recent hand-offs</div>
          <div className="list">
            {c.vocab.custodyItems.slice(0, 4).map((it, i) => (
              <div key={it} className="list-row" style={{ padding: '7px 0' }}>
                <span className="list-main"><b>{it}</b><span>{i % 2 ? 'Returned to vault' : 'Delivered'} · signed by agent · {fmtAgo(sel.lastTransferMin + i * r.int(200, 900))}</span></span>
                <Badge color={i === 0 && sel.untrackedCopies ? 'var(--bad)' : 'var(--good)'}>{i === 0 && sel.untrackedCopies ? 'Copy untracked' : 'Verified'}</Badge>
              </div>
            ))}
          </div>
          {sel.untrackedCopies > 0 && <div style={{ marginTop: 12 }}><Callout kind="warn">{sel.untrackedCopies} cop{sel.untrackedCopies > 1 ? 'ies' : 'y'} seen without an agent in the last 7 days. Ask the vendor to deploy agents before the next delivery, or revoke supplier access.</Callout></div>}
        </Drawer>
      )}
      {revoke && sel && (
        <RevokeModal req={revoke} onClose={() => setRevoke(null)} onDone={() => setRevoked((s) => new Set(s).add(sel.id))} />
      )}
    </>
  );
}
