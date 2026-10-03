import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bug, ShieldAlert, Lock } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { trackedAssets } from '../../data/modules/ot';
import { useNavigate } from 'react-router-dom';
import { BarRow } from '../../components/ui';
import { otScope, otVulns, otAssets, REACH_LABEL, type OtVuln, type PatchState } from '../../data/modules/ot';
import { KpiStrip, Card, Badge, SevBadge, StatusBadge, KV, IcoBox, Legend, Callout, Bar, Chip } from '../../components/ui';
import { Chart, SEV_HEX } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtNum, fmtDate, daysAgo, daysAhead } from '../../lib/format';
import { OT_TONE, OtIntro, NoOtState, OtSources, LevelBadge, ConsequenceDots, srcNames } from './parts';
import type { Severity } from '../../data/types';

const STATUS_COLOR: Record<string, string> = { Open: 'var(--bad)', Mitigated: 'var(--good)', 'Risk accepted': 'var(--sev-info)', 'Planned (outage)': 'var(--sev-medium)' };
const PATCH_COLOR: Record<PatchState, string> = {
  'Vendor patch available': '#2dd4bf',
  'Patch needs outage window': '#f5a83d',
  'No vendor fix': '#f8646f',
  'Unpatchable by design (safety case)': '#8a9bc0',
};
const REACH_SHORT = ['Isolated', 'Adjacent', 'From IT', 'Remote / internet'];

function sevOf(cvss: number): Severity {
  return cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low';
}
function prioColor(p: number): string {
  return p >= 75 ? 'var(--sev-critical)' : p >= 55 ? 'var(--sev-high)' : p >= 35 ? 'var(--sev-medium)' : 'var(--text-secondary)';
}

export default function OtVulns() {
  const { customer: c, tenantId, timeRange } = useApp();
  const sc = useMemo(() => otScope(c, tenantId), [c, tenantId]);
  const vulns = useMemo(() => otVulns(c, tenantId), [c, tenantId]);
  const assets = useMemo(() => otAssets(c, tenantId), [c, tenantId]);
  const [sel, setSel] = useState<OtVuln | null>(null);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const tracked = useMemo(() => trackedAssets(c, tenantId), [c, tenantId]);
  const [reachFilter, setReachFilter] = useState<number | 'all'>(params.get('reach') ? Number(params.get('reach')) : 'all');
  const [extra, setExtra] = useState<'all' | 'kev' | 'accepted' | 'new'>((['kev', 'accepted', 'new'] as const).find((x) => x === params.get('filter')) ?? 'all');
  const toTable = () => window.setTimeout(() => document.getElementById('ot-vuln-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  const days = rangeDays(timeRange);

  const fw = useMemo(() => {
    const m = new Map<string, { cur: number; one: number; two: number }>();
    for (const a of assets) {
      const x = m.get(a.type) ?? { cur: 0, one: 0, two: 0 };
      if (a.fwBehind === 0) x.cur++;
      else if (a.fwBehind === 1) x.one++;
      else x.two++;
      m.set(a.type, x);
    }
    return [...m.entries()].map(([type, v]) => ({ type, ...v, total: v.cur + v.one + v.two })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [assets]);

  if (!sc.hasOt) return <NoOtState what="OT vulnerability management covers sites that run operational technology." />;

  const h = sc.h;
  const kevInst = vulns.filter((v) => v.cve.kev).reduce((s, v) => s + v.instances, 0);
  const remoteInst = vulns.filter((v) => v.reach === 3).reduce((s, v) => s + v.instances, 0);
  const accepted = vulns.filter((v) => v.acceptance);
  const overdue = accepted.filter((v) => (v.acceptance?.reviewInDays ?? 1) < 0);
  const uniqueCves = new Set(vulns.map((v) => v.cve.id)).size;
  const fwCurrentPct = assets.length ? Math.round((assets.filter((a) => a.fwBehind === 0).length / assets.length) * 100) : 0;
  const newInRange = vulns.filter((v) => v.advisoryDaysAgo <= days);
  const patchMix = (Object.keys(PATCH_COLOR) as PatchState[]).map((p) => ({ p, n: vulns.filter((v) => v.patch === p).reduce((s, v) => s + v.instances, 0) }));
  const rows = vulns.filter((v) => (reachFilter === 'all' || v.reach === reachFilter) && (extra === 'all' || (extra === 'kev' ? v.cve.kev : extra === 'accepted' ? !!v.acceptance : v.advisoryDaysAgo <= days)));
  const src = srcNames(sc);
  const pick = (reach: number | 'all', x: typeof extra) => { setReachFilter(reach); setExtra(x); toTable(); };

  const kevs = [...new Map(vulns.filter((v) => v.cve.kev).map((v) => [v.cve.id, v.cve])).values()].map((cve) => {
    const g = vulns.filter((v) => v.cve.id === cve.id);
    return { cve, groups: g, instances: g.reduce((s, v) => s + v.instances, 0), sites: [...new Set(g.map((v) => v.siteName))], open: g.filter((v) => v.status === 'Open').length };
  });

  return (
    <>
      <OtIntro>
        <b>{c.name}</b> · {tenantId === 'all' ? `${sc.sites.length} sites` : sc.sites.map((s) => s.name).join(', ')}. Vulnerabilities matched passively from firmware fingerprints, ranked by whether an attacker can actually reach the device, what it controls and which compensating controls already stand in the way. Sources: {sc.sources.map((s) => s.name).join(', ')}.
      </OtIntro>

      <KpiStrip
        toneColor={OT_TONE}
        items={[
          { label: 'Vuln instances', value: fmtNum(h.otVulns), onClick: () => pick('all', 'all'), source: `${src} · vendor advisories, NVD`, delta: { text: `${newInRange.length} new advisories · ${rangeLabel(timeRange).toLowerCase()}`, good: false } },
          { label: 'Advisories', hint: 'distinct CVEs', value: uniqueCves, onClick: () => pick('all', 'new'), source: 'Vendor advisories · CISA ICS advisories · NVD' },
          { label: 'KEV-listed', hint: 'instances', value: fmtNum(kevInst), toneColor: 'var(--sev-critical)', onClick: () => pick('all', 'kev'), source: 'CISA KEV catalogue' },
          { label: 'Remotely reachable', hint: 'instances', value: fmtNum(remoteInst), onClick: () => pick(3, 'all'), source: `${src} · observed conduits` },
          { label: 'Risk accepted', value: accepted.length, onClick: () => pick('all', 'accepted'), source: 'HexaComply risk register', delta: overdue.length ? { text: `${overdue.length} review overdue`, good: false } : { text: 'All reviews in date', good: true } },
          { label: 'Firmware current', value: `${fwCurrentPct}%`, bar: fwCurrentPct, to: '/ot/assets?view=all&fw=behind', source: `${src} · vendor firmware catalogue` },
        ]}
      />

      <TrackedSummary tracked={tracked} sites={sc.sites.map((x) => ({ id: x.id, name: x.name }))} onOpen={(q) => nav(`/ot/assets?${q}`)} />

      <div className="grid g-3-2">
        <Card title="Prioritisation" sub="Reachability × consequence; bubble size = instances · click a bubble for detail" actions={<Legend items={[{ label: 'KEV', color: SEV_HEX.critical }, { label: 'Open', color: '#f5a83d' }, { label: 'Planned / mitigated', color: '#2dd4bf' }, { label: 'Risk accepted', color: '#8a9bc0' }]} />}>
          <Chart
            height={300}
            onClick={(p) => {
              const id = (p as { data?: { id?: string } }).data?.id;
              const v = vulns.find((x) => x.id === id);
              if (v) setSel(v);
            }}
            option={{
              grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
              tooltip: { trigger: 'item', formatter: (p: unknown) => { const d = (p as { data: { name: string; tip: string } }).data; return `<b>${d.name}</b><br/>${d.tip}`; } },
              xAxis: { type: 'value', min: -0.5, max: 3.5, interval: 1, name: 'Reachability', nameLocation: 'middle', nameGap: 26, axisLabel: { formatter: (v: number) => REACH_SHORT[v] ?? '' } },
              yAxis: { type: 'value', min: 0.5, max: 5.5, interval: 1, name: 'Consequence', axisLabel: { formatter: (v: number) => (v >= 1 && v <= 5 ? String(v) : '') } },
              series: [
                {
                  type: 'scatter',
                  data: vulns.map((v, i) => ({
                    id: v.id,
                    name: `${v.cve.id} · ${v.assetType}`,
                    tip: `${v.siteName}<br/>${fmtNum(v.instances)} instances · priority ${v.priority}<br/>${v.patch}`,
                    value: [v.reach + (((i * 37) % 11) - 5) * 0.05, v.consequence + (((i * 53) % 9) - 4) * 0.06],
                    symbolSize: Math.min(46, 8 + Math.sqrt(v.instances) * 2.2),
                    itemStyle: { color: v.cve.kev ? SEV_HEX.critical : v.status === 'Risk accepted' ? '#8a9bc0' : v.status === 'Open' ? '#f5a83d' : '#2dd4bf', opacity: 0.78, borderColor: 'rgba(255,255,255,.5)', borderWidth: 1 },
                  })),
                  markArea: { silent: true, itemStyle: { color: 'rgba(240,52,94,0.07)' }, data: [[{ xAxis: 1.5, yAxis: 3.5 }, { xAxis: 3.5, yAxis: 5.5 }]] },
                },
              ],
            }}
          />
          <div className="card-foot">
            <span>Shaded: reachable from IT or remotely, and able to cause a safety or loss-of-operation consequence. Fix or isolate these first.</span>
          </div>
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="How the ranking works" toneColor={OT_TONE} tinted>
            <div className="stack" style={{ gap: 4, fontSize: 12.5 }}>
              <div><b>Reachability</b> <span className="muted">from observed conduits, not network diagrams</span></div>
              <div><b>Consequence</b> <span className="muted">what the device can do to the process (1–5)</span></div>
              <div><b>Compensating controls</b> <span className="muted">each verified control lowers priority</span></div>
              <div><b>Severity &amp; KEV</b> <span className="muted">CVSS base, +15% when exploited in the wild</span></div>
            </div>
          </Card>
          <Card title="Patch state" sub="Instances by what the vendor allows">
            <Chart
              height={170}
              option={{
                tooltip: { trigger: 'item' },
                series: [{ type: 'pie', radius: ['52%', '80%'], center: ['30%', '50%'], label: { show: false }, data: patchMix.map((x) => ({ name: x.p, value: x.n, itemStyle: { color: PATCH_COLOR[x.p] } })) }],
                legend: { orient: 'vertical', right: 0, top: 'middle', textStyle: { fontSize: 10.5 } },
              }}
            />
          </Card>
        </div>
      </div>

      <div id="ot-vuln-table" />
      <Card title={<><Bug size={15} /> Ranked vulnerabilities</>} count={rows.length} sub="One row per advisory × asset type × site · click for path, controls and patch state" flush>
        <DataTable
          rows={rows}
          rowKey={(v) => v.id}
          onRowClick={setSel}
          search={(v) => `${v.cve.id} ${v.cve.product} ${v.assetType} ${v.siteName} ${v.zone} ${v.status}`}
          searchPlaceholder="Search CVE, asset type, site…"
          initialSort={{ key: 'prio', dir: 'desc' }}
          toolbar={
            <span className="chips">
              <Chip on={reachFilter === 'all' && extra === 'all'} onClick={() => { setReachFilter('all'); setExtra('all'); }} color={OT_TONE}>All</Chip>
              {extra !== 'all' && <Chip on onClick={() => setExtra('all')} color="var(--sev-critical)">{extra === 'kev' ? 'KEV-listed' : extra === 'accepted' ? 'Risk accepted' : 'New advisories'} ✕</Chip>}
              {[3, 2, 1, 0].map((n) => (
                <Chip key={n} on={reachFilter === n} onClick={() => setReachFilter(n)} color={OT_TONE}>{REACH_SHORT[n]}</Chip>
              ))}
            </span>
          }
          columns={[
            { key: 'prio', header: 'Priority', sort: (v) => v.priority, render: (v) => <b className="num" style={{ fontSize: 15, color: prioColor(v.priority) }}>{v.priority}</b> },
            { key: 'cve', header: 'Advisory', sort: (v) => v.cve.cvss, render: (v) => (<><div className="t-main mono">{v.cve.id} {v.cve.kev && <Badge color="var(--sev-critical)" solid>KEV</Badge>}</div><div className="t-sub">{v.cve.title} · CVSS {v.cve.cvss}</div></>) },
            { key: 'asset', header: 'Asset type · site', sort: (v) => v.assetType, render: (v) => (<><div>{v.assetType}</div><div className="t-sub">{v.siteName} · {v.zone}</div></>) },
            { key: 'lvl', header: 'Level', render: (v) => <LevelBadge level={v.level} /> },
            { key: 'reach', header: 'Reachability', sort: (v) => v.reach, render: (v) => <Badge color={v.reach >= 3 ? 'var(--sev-critical)' : v.reach === 2 ? 'var(--sev-high)' : v.reach === 1 ? 'var(--sev-medium)' : 'var(--good)'}>{REACH_SHORT[v.reach]}</Badge> },
            { key: 'cons', header: 'Consequence', sort: (v) => v.consequence, render: (v) => <ConsequenceDots value={v.consequence} /> },
            { key: 'ctl', header: 'Controls', align: 'right', sort: (v) => v.controls.length, render: (v) => v.controls.length },
            { key: 'patch', header: 'Patch state', sort: (v) => v.patch, render: (v) => <span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: PATCH_COLOR[v.patch] }} /><span className="t-sub" style={{ margin: 0 }}>{v.patch}</span></span> },
            { key: 'st', header: 'Status', sort: (v) => v.status, render: (v) => <StatusBadge value={v.status} map={STATUS_COLOR} /> },
            { key: 'n', header: 'Instances', align: 'right', sort: (v) => v.instances, render: (v) => fmtNum(v.instances) },
          ]}
        />
      </Card>

      <div className="grid g2">
        <Card title="Firmware currency" sub="Top asset types by count · share on the latest vendor release" actions={<Legend items={[{ label: 'Current', color: '#2dd4bf' }, { label: '1 behind', color: '#f5a83d' }, { label: '2+ behind', color: '#f8646f' }]} />}>
          <Chart
            height={300}
            option={{
              grid: { left: 8, right: 12, top: 4, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
              yAxis: { type: 'category', data: fw.map((x) => (x.type.length > 30 ? `${x.type.slice(0, 29)}…` : x.type)).reverse(), axisLabel: { fontSize: 10 } },
              series: [
                { name: 'Current', type: 'bar', stack: 'f', data: fw.map((x) => Math.round((x.cur / x.total) * 100)).reverse(), itemStyle: { color: '#2dd4bf', borderRadius: 0 } },
                { name: '1 behind', type: 'bar', stack: 'f', data: fw.map((x) => Math.round((x.one / x.total) * 100)).reverse(), itemStyle: { color: '#f5a83d', borderRadius: 0 } },
                { name: '2+ behind', type: 'bar', stack: 'f', data: fw.map((x) => 100 - Math.round((x.cur / x.total) * 100) - Math.round((x.one / x.total) * 100)).reverse(), itemStyle: { color: '#f8646f', borderRadius: [0, 3, 3, 0] } },
              ],
            }}
          />
        </Card>

        <Card title={<><ShieldAlert size={15} /> Unpatchable by design</>} count={accepted.length} sub="Risk acceptances backed by a safety case, with review dates" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {accepted.sort((a, b) => (a.acceptance?.reviewInDays ?? 0) - (b.acceptance?.reviewInDays ?? 0)).map((v) => {
              const ra = v.acceptance!;
              const late = ra.reviewInDays < 0;
              return (
                <button key={v.id} className="list-row" onClick={() => setSel(v)}>
                  <span className="list-main">
                    <b>{v.assetType} · {v.cve.id}</b>
                    <span>{ra.ref} · safety case {ra.safetyCase} · {v.siteName} · owner {ra.owner}</span>
                  </span>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Badge color={late ? 'var(--bad)' : ra.reviewInDays < 30 ? 'var(--sev-medium)' : 'var(--good)'}>{late ? `Review ${-ra.reviewInDays} d overdue` : `Review in ${ra.reviewInDays} d`}</Badge>
                    <span className="muted" style={{ fontSize: 10.5 }}>{fmtDate(daysAhead(ra.reviewInDays))}</span>
                  </span>
                </button>
              );
            })}
            {accepted.length === 0 && <div className="empty">No risk acceptances in this scope.</div>}
          </div>
        </Card>
      </div>

      <Card title="Known exploited (KEV) in the OT estate" count={kevs.length} sub="CISA Known Exploited Vulnerabilities matched to OT and OT-adjacent assets" flush>
        <DataTable
          rows={kevs}
          rowKey={(k) => k.cve.id}
          onRowClick={(k) => setSel(k.groups[0])}
          initialSort={{ key: 'n', dir: 'desc' }}
          columns={[
            { key: 'cve', header: 'CVE', sort: (k) => k.cve.id, render: (k) => (<><div className="t-main mono">{k.cve.id}</div><div className="t-sub">{k.cve.product}</div></>) },
            { key: 't', header: 'Title', render: (k) => k.cve.title },
            { key: 'sev', header: 'Severity', sort: (k) => k.cve.cvss, render: (k) => <span className="row" style={{ gap: 6 }}><SevBadge sev={sevOf(k.cve.cvss)} /><span className="t-sub" style={{ margin: 0 }}>CVSS {k.cve.cvss} · EPSS {Math.round(k.cve.epss * 100)}%</span></span> },
            { key: 'sites', header: 'Sites', render: (k) => <span className="t-sub">{k.sites.join(' · ')}</span> },
            { key: 'open', header: 'Open groups', align: 'right', sort: (k) => k.open, render: (k) => k.open },
            { key: 'n', header: 'Instances', align: 'right', sort: (k) => k.instances, render: (k) => <b>{fmtNum(k.instances)}</b> },
          ]}
          empty="No KEV-listed vulnerabilities matched in this scope."
        />
      </Card>

      {sel && (
        <Drawer
          wide
          title={`${sel.cve.id} · ${sel.assetType}`}
          sub={`${sel.siteName} · ${sel.zone}`}
          icon={<IcoBox color={prioColor(sel.priority)}><Bug /></IcoBox>}
          onClose={() => setSel(null)}
          footer={<span className="muted" style={{ fontSize: 11.5 }}><Lock size={12} style={{ verticalAlign: -2 }} /> Read-only. Patching is planned with the asset owner and OEM inside an approved outage window; HexaView tracks it, it never pushes changes to OT.</span>}
        >
          <div className="row" style={{ gap: 18, marginBottom: 14 }}>
            <div>
              <div className="stat-big" style={{ color: prioColor(sel.priority), fontSize: 34 }}>{sel.priority}</div>
              <div className="stat-label">priority of 100</div>
            </div>
            <div style={{ flex: 1 }} className="stack">
              <div className="row" style={{ fontSize: 12 }}><span style={{ width: 110 }} className="muted">Reachability</span><Bar value={sel.reach + 1} max={4} color="var(--sev-high)" /></div>
              <div className="row" style={{ fontSize: 12 }}><span style={{ width: 110 }} className="muted">Consequence</span><Bar value={sel.consequence} max={5} color="var(--sev-critical)" /></div>
              <div className="row" style={{ fontSize: 12 }}><span style={{ width: 110 }} className="muted">Controls</span><Bar value={sel.controls.length} max={3} color="var(--good)" /></div>
            </div>
          </div>
          <KV rows={[
            ['Advisory', <span>{sel.cve.product}: {sel.cve.title}</span>],
            ['Severity', <span className="row" style={{ gap: 6 }}><SevBadge sev={sevOf(sel.cve.cvss)} /> CVSS {sel.cve.cvss} · EPSS {Math.round(sel.cve.epss * 100)}% {sel.cve.kev && <Badge color="var(--sev-critical)" solid>KEV</Badge>}</span>],
            ['Purdue level', <LevelBadge level={sel.level} />],
            ['Instances', fmtNum(sel.instances)],
            ['Reachability', REACH_LABEL[sel.reach]],
            ['Observed path', <span className="mono" style={{ fontSize: 11.5 }}>{sel.path}</span>],
            ['Consequence', <span><ConsequenceDots value={sel.consequence} /> {sel.consequenceText}</span>],
            ['Running / fixed in', `${sel.running} → ${sel.fixedIn}`],
            ['Patch state', sel.patch],
            ['Status', <StatusBadge value={sel.status} map={STATUS_COLOR} />],
            ['Advisory published', fmtDate(daysAgo(sel.advisoryDaysAgo))],
          ]} />
          <div className="section-label" style={{ marginTop: 16 }}>Compensating controls (verified)</div>
          <div className="chips">{sel.controls.map((x) => <Badge key={x} color="var(--good)" dot>{x}</Badge>)}</div>
          {sel.acceptance && (
            <>
              <div className="section-label" style={{ marginTop: 16 }}>Risk acceptance</div>
              <KV rows={[
                ['Reference', sel.acceptance.ref],
                ['Safety case', sel.acceptance.safetyCase],
                ['Owner', sel.acceptance.owner],
                ['Approved', fmtDate(daysAgo(sel.acceptance.approvedDaysAgo))],
                ['Next review', <span style={{ color: sel.acceptance.reviewInDays < 0 ? 'var(--bad)' : undefined }}>{fmtDate(daysAhead(sel.acceptance.reviewInDays))}{sel.acceptance.reviewInDays < 0 ? ' (overdue)' : ''}</span>],
                ['Conditions', sel.acceptance.conditions],
              ]} />
            </>
          )}
          <div style={{ marginTop: 16 }}>
            <Callout kind="info" color={OT_TONE}>Evidence for this decision is filed in HexaComply against {c.id === 'maritime' ? 'IEC 62443-2-3 and IACS UR E26' : 'IEC 62443-2-3'} patch-management requirements.</Callout>
          </div>
          <div style={{ marginTop: 12 }}><OtSources sc={sc} /></div>
        </Drawer>
      )}
    </>
  );
}

const SEVS = [['Critical', SEV_HEX.critical], ['High', SEV_HEX.high], ['Medium', SEV_HEX.medium], ['Low', SEV_HEX.low]] as const;
const ROUTES = ['Vendor patch available', 'Compensating control', 'Already on latest', 'No vendor fix'] as const;
function TrackedSummary({ tracked, sites, onOpen }: { tracked: ReturnType<typeof trackedAssets>; sites: { id: string; name: string }[]; onOpen: (q: string) => void }) {
  const mix = [0, 1, 2, 3].map((i) => tracked.reduce((s, a) => s + a.sevMix[i], 0));
  const total = mix.reduce((s, x) => s + x, 0) || 1;
  const byRoute = ROUTES.map((r) => ({ r, n: tracked.filter((a) => a.route === r).reduce((s, a) => s + a.findings, 0) }));
  const bySite = sites.map((x) => ({ ...x, n: tracked.filter((a) => a.siteId === x.id).reduce((s, a) => s + a.findings, 0) })).sort((a, b) => b.n - a.n);
  const maxR = Math.max(1, ...byRoute.map((x) => x.n));
  const maxS = Math.max(1, ...bySite.map((x) => x.n));
  const patchPct = Math.round((byRoute[0].n / Math.max(1, byRoute.reduce((s, x) => s + x.n, 0))) * 100);
  return (
    <Card title={`On the ${tracked.length} assets we follow individually`} sub="Findings by severity, by how they get fixed and by site · click to open the assets">
      <div className="ot-band-bar" style={{ height: 22, marginBottom: 8 }}>
        {SEVS.map(([l, col], i) => <button key={l} style={{ flex: Math.max(mix[i], total * 0.01), background: col }} title={`${l}: ${mix[i]}`} onClick={() => onOpen('fw=behind')} />)}
      </div>
      <div className="ot-band-legend" style={{ marginBottom: 14 }}>
        {SEVS.map(([l, col], i) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: col, display: 'inline-block' }} />{l} <b>{fmtNum(mix[i])}</b> <span className="muted">({Math.round((mix[i] / total) * 100)}%)</span></span>)}
      </div>
      <div className="grid g2" style={{ gap: 24 }}>
        <div>
          <div className="section-label">How these get fixed</div>
          {byRoute.map((x) => (
            <button key={x.r} className="ot-barbtn" onClick={() => onOpen(`route=${encodeURIComponent(x.r)}`)}>
              <BarRow label={x.r} value={x.n} max={maxR} color={x.r === 'No vendor fix' ? 'var(--bad)' : 'var(--m-ot)'} display={fmtNum(x.n)} />
            </button>
          ))}
          <div className="t-sub" style={{ marginTop: 6 }}>{patchPct}% of findings on tracked assets have a vendor fix waiting for a maintenance window.</div>
        </div>
        <div>
          <div className="section-label">Which site carries them</div>
          {bySite.map((x) => (
            <button key={x.id} className="ot-barbtn" onClick={() => onOpen(`site=${x.id}`)}>
              <BarRow label={x.name} value={x.n} max={maxS} color="var(--m-ot)" display={fmtNum(x.n)} />
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
