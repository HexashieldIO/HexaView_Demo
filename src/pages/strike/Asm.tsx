import { useMemo, useState, type CSSProperties } from 'react';
import { ServerCog, ShieldAlert } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { headlines } from '../../data/core';
import { tenantName } from '../../data/customers';
import {
  asmBreakdown, riskyServices, certExpiries, asmAssets, kevExposures, discoveryTrend,
  type AsmAsset, type RiskyService, type KevExposure, type CertExpiry, type AsmBreakdown,
} from '../../data/modules/strike';
import { RecordsDrawer } from './parts';
import { Card, KpiStrip, SevBadge, Badge, Btn, KV, SectionLabel, Sources, Callout, MiniStat } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtNum } from '../../lib/format';
import './strike.css';

const tone = MODULE_BY_ID.strike.tone;
const STRIKE_HEX = '#f8646f';

export default function StrikeAsm() {
  const { customer: c, tenantId } = useApp();
  const h = headlines(c, tenantId);
  const breakdown = useMemo(() => asmBreakdown(c, tenantId), [c, tenantId]);
  const risky = useMemo(() => riskyServices(c, tenantId), [c, tenantId]);
  const certs = useMemo(() => certExpiries(c, tenantId), [c, tenantId]);
  const assets = useMemo(() => asmAssets(c, tenantId), [c, tenantId]);
  const kev = useMemo(() => kevExposures(c, tenantId), [c, tenantId]);
  const trend = useMemo(() => discoveryTrend(c, tenantId), [c, tenantId]);
  const [sel, setSel] = useState<AsmAsset | null>(null);
  const [list, setList] = useState<'breakdown' | 'risky' | 'kev' | 'certs' | 'portals' | null>(null);
  const ASRC = 'HexaStrike ASM continuous discovery';

  const newChanged = breakdown.reduce((s, b) => s + b.new7d + b.changed7d, 0);
  const expiringSoon = certs.filter((x) => x.daysToExpiry <= 30).length;

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)} external attack surface discovered and validated continuously: domains, subdomains, IPs, certificates, cloud buckets, APIs and login portals, with a daily diff.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'External assets', value: fmtNum(h.strike.externalAssets), toneColor: tone, onClick: () => setList('breakdown'), source: ASRC },
          { label: 'New / changed', hint: 'last 7 days', value: newChanged, toneColor: 'var(--sev-medium)', onClick: () => setList('breakdown'), source: ASRC + ' · daily diff' },
          { label: 'Risky services', hint: 'RDP, SSH, admin', value: risky.length, toneColor: 'var(--sev-high)', onClick: () => setList('risky'), source: ASRC + ' · service fingerprinting' },
          { label: 'KEV exposures', value: kev.length, toneColor: 'var(--sev-critical)', onClick: () => setList('kev'), source: 'CISA KEV matched to ASM fingerprints' },
          { label: 'Certs expiring', hint: '≤ 30 days', value: expiringSoon, toneColor: 'var(--sev-medium)', onClick: () => setList('certs'), source: 'Certificate transparency · TLS scans' },
          { label: 'Login portals', value: breakdown.find((b) => b.type === 'Login portals')?.count ?? 0, toneColor: tone, to: '/int/surface', source: ASRC },
        ]}
      />

      {kev.length > 0 && (
        <Callout kind="warn" color="var(--sev-critical)">
          <b>{kev.length} KEV-listed vulnerabilit{kev.length > 1 ? 'ies' : 'y'} on internet-facing services.</b>{' '}
          {kev.map((k) => `${k.cve} on ${k.host}`).join(', ')} — exploited in the wild; patch within the CISA KEV due date.
        </Callout>
      )}

      <div className="grid g-2-1">
        <Card title="Assets by type" sub="With new and changed in the last 7 days">
          <Chart
            height={240}
            option={{
              legend: { data: ['Total', 'New (7d)', 'Changed (7d)'], top: 0 },
              grid: { left: 8, right: 12, top: 26, bottom: 6, containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'category', data: breakdown.map((b) => b.type), axisLabel: { interval: 0, rotate: 24, fontSize: 9.5 } },
              yAxis: { type: 'value', name: 'assets' },
              series: [
                { name: 'Total', type: 'bar', data: breakdown.map((b) => b.count), itemStyle: { color: STRIKE_HEX, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 26 },
                { name: 'New (7d)', type: 'bar', stack: 'd', data: breakdown.map((b) => b.new7d), itemStyle: { color: PALETTE[3] }, barMaxWidth: 12 },
                { name: 'Changed (7d)', type: 'bar', stack: 'd', data: breakdown.map((b) => b.changed7d), itemStyle: { color: PALETTE[7] }, barMaxWidth: 12 },
              ],
            }}
          />
        </Card>

        <Card title="Discovery trend" sub="Known external assets over 12 months">
          <Chart
            height={240}
            option={{
              grid: { left: 8, right: 12, top: 14, bottom: 6, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: trend.labels, boundaryGap: false },
              yAxis: { type: 'value', name: 'assets' },
              series: [{ type: 'line', smooth: true, data: trend.data, symbol: 'none', lineStyle: { color: STRIKE_HEX, width: 2 }, areaStyle: { color: 'rgba(248,100,111,.18)' } }],
            }}
          />
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Exposed risky services" count={risky.length} sub="RDP, SSH, admin panels, VPN and databases reachable from the internet" flush>
          <DataTable
            rows={risky}
            rowKey={(r) => `${r.host}-${r.port}`}
            initialSort={{ key: 'sev', dir: 'asc' }}
            columns={[
              { key: 'sev', header: 'Severity', sort: (r) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(r.sev), render: (r) => <SevBadge sev={r.sev} /> },
              { key: 'svc', header: 'Service', render: (r) => (<><div className="t-main">{r.service} <span className="muted">:{r.port}</span></div><div className="t-sub mono">{r.host}</div></>) },
              { key: 'exp', header: 'Exposure', render: (r) => <span className="t-sub">{r.exposure}</span> },
              { key: 'ten', header: 'Tenant', render: (r) => <span className="muted">{tenantName(c, r.tenantId)}</span> },
            ]}
          />
        </Card>

        <Card title="Certificate expiry" sub="Next certificates to expire" flush>
          <DataTable
            rows={[...certs].sort((a, b) => a.daysToExpiry - b.daysToExpiry)}
            rowKey={(x) => x.host}
            columns={[
              { key: 'host', header: 'Host', render: (x) => <span className="mono">{x.host}</span> },
              { key: 'issuer', header: 'Issuer', render: (x) => x.issuer },
              { key: 'exp', header: 'Expiry', align: 'right', sort: (x) => x.daysToExpiry, render: (x) => <Badge color={x.daysToExpiry < 0 ? 'var(--bad)' : x.daysToExpiry <= 14 ? 'var(--sev-high)' : x.daysToExpiry <= 30 ? 'var(--sev-medium)' : 'var(--good)'} dot>{x.daysToExpiry < 0 ? `${-x.daysToExpiry}d expired` : `${x.daysToExpiry}d`}</Badge> },
            ]}
          />
        </Card>
      </div>

      <Card title="External assets" count={assets.length} sub="Click an asset for detail, technology and KEV exposure" flush>
        <DataTable
          rows={assets}
          rowKey={(a) => a.id}
          onRowClick={setSel}
          search={(a) => `${a.host} ${a.tech} ${a.type} ${a.ip}`}
          searchPlaceholder="Filter assets…"
          initialSort={{ key: 'sev', dir: 'asc' }}
          columns={[
            { key: 'sev', header: 'Severity', sort: (a) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(a.sev), render: (a) => <SevBadge sev={a.sev} /> },
            { key: 'host', header: 'Asset', render: (a) => (<><div className="t-main mono">{a.host}</div><div className="t-sub">{a.type} · {a.ip}</div></>) },
            { key: 'tech', header: 'Technology', sort: (a) => a.tech, render: (a) => a.tech },
            { key: 'ports', header: 'Ports', render: (a) => <span className="mono">{a.ports.join(', ')}</span> },
            { key: 'kev', header: 'KEV', render: (a) => a.kev ? <Badge color="var(--sev-critical)" dot>{a.kev}</Badge> : <span className="muted">—</span> },
            { key: 'seen', header: 'First seen', align: 'right', sort: (a) => a.firstSeenDays, render: (a) => <span className="muted">{a.firstSeenDays}d ago</span> },
          ]}
        />
      </Card>

      {list === 'breakdown' && (
        <RecordsDrawer<AsmBreakdown>
          title="External assets by type"
          rows={breakdown}
          source={[ASRC]}
          onClose={() => setList(null)}
          columns={[
            { key: 't', header: 'Type', render: (b) => b.type },
            { key: 'c', header: 'Assets', align: 'right', sort: (b) => b.count, render: (b) => <b>{fmtNum(b.count)}</b> },
            { key: 'n', header: 'New (7d)', align: 'right', sort: (b) => b.new7d, render: (b) => b.new7d },
            { key: 'x', header: 'Changed (7d)', align: 'right', sort: (b) => b.changed7d, render: (b) => b.changed7d },
          ]}
        />
      )}
      {list === 'risky' && (
        <RecordsDrawer<RiskyService>
          title="Risky services exposed"
          rows={risky}
          source={[ASRC]}
          onClose={() => setList(null)}
          columns={[
            { key: 's', header: 'Service', render: (x) => <b>{x.service}</b> },
            { key: 'h', header: 'Host', render: (x) => <span className="mono">{x.host}:{x.port}</span> },
            { key: 'e', header: 'Exposure', render: (x) => x.exposure },
            { key: 'v', header: 'Severity', render: (x) => <SevBadge sev={x.sev} /> },
          ]}
        />
      )}
      {list === 'kev' && (
        <RecordsDrawer<KevExposure>
          title="Known-exploited vulnerabilities on the edge"
          rows={kev}
          source={['CISA KEV', ASRC]}
          onClose={() => setList(null)}
          columns={[
            { key: 'h', header: 'Host', render: (x) => (<><div className="t-main mono">{x.host}</div><div className="t-sub">{x.product}</div></>) },
            { key: 'c', header: 'CVE', render: (x) => (<><div className="t-main mono">{x.cve}</div><div className="t-sub">{x.title}</div></>) },
            { key: 's', header: 'CVSS', align: 'right', render: (x) => x.cvss.toFixed(1) },
            { key: 'd', header: 'Patch SLA', align: 'right', render: (x) => `${x.slaDays}d` },
          ]}
        />
      )}
      {list === 'certs' && (
        <RecordsDrawer<CertExpiry>
          title="Certificates by expiry"
          rows={[...certs].sort((a, b) => a.daysToExpiry - b.daysToExpiry)}
          source={['Certificate transparency', 'TLS scans']}
          onClose={() => setList(null)}
          columns={[
            { key: 'h', header: 'Host', render: (x) => <span className="mono">{x.host}</span> },
            { key: 'i', header: 'Issuer', render: (x) => x.issuer },
            { key: 'd', header: 'Expires', align: 'right', sort: (x) => x.daysToExpiry, render: (x) => <span style={{ color: x.daysToExpiry <= 30 ? 'var(--bad)' : undefined }}>{x.daysToExpiry < 0 ? `expired ${-x.daysToExpiry}d ago` : `in ${x.daysToExpiry}d`}</span> },
          ]}
        />
      )}

      {sel && (
        <Drawer
          wide
          title={sel.host}
          sub={`${sel.type} · ${sel.ip}`}
          icon={<span className="ico-box" style={{ '--tone': sel.kev ? 'var(--sev-critical)' : tone } as CSSProperties}>{sel.kev ? <ShieldAlert /> : <ServerCog />}</span>}
          onClose={() => setSel(null)}
          footer={<Btn primary color={tone} onClick={() => setSel(null)}>Close</Btn>}
        >
          <KV
            rows={[
              ['Severity', <SevBadge sev={sel.sev} />],
              ['Type', sel.type],
              ['IP address', <span className="mono">{sel.ip}</span>],
              ['Technology', sel.tech],
              ['Open ports', <span className="mono">{sel.ports.join(', ')}</span>],
              ['KEV exposure', sel.kev ? <Badge color="var(--sev-critical)" dot>{sel.kev}</Badge> : 'None'],
              ['First seen', `${sel.firstSeenDays} days ago`],
              ['Tenant', tenantName(c, sel.tenantId)],
            ]}
          />
          <SectionLabel>Assessment</SectionLabel>
          <p className="secondary" style={{ fontSize: 12.5 }}>{sel.note}</p>
          <div className="mini-stats" style={{ marginTop: 10 }}>
            <MiniStat value={sel.ports.length} label="Open ports" color={tone} />
            <MiniStat value={sel.kev ? 'Yes' : 'No'} label="KEV-listed" color={sel.kev ? 'var(--bad)' : 'var(--good)'} />
          </div>
          <SectionLabel>Discovered by</SectionLabel>
          <Sources items={[{ name: 'HexaStrike ASM' }, { name: 'Certificate transparency' }, { name: 'Passive DNS' }]} />
        </Drawer>
      )}
    </>
  );
}
