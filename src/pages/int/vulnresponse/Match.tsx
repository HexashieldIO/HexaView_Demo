import { useSearchParams, useNavigate } from 'react-router-dom';
import { Server, ShieldCheck, Factory, Truck, Siren, ExternalLink, Package } from 'lucide-react';
import { sbAdvisoryExposure } from '../../../data/modules/sbom';
import { Card, Callout, Badge } from '../../../components/ui';
import { FlowMap, type FlowColumn, type FlowLink } from '../../../components/FlowMap';
import { DataTable, type Column } from '../../../components/DataTable';
import { fmtNum, plural } from '../../../lib/format';
import { VR_SOURCE_META, VR_STATUSES, VR_STATUS_COLOR, type VrAsset, type VrSource, type VrStatus, type VrSupplier } from '../../../data/modules/vulnresponse';
import { FilterGroup } from '../parts';
import { useVr } from './state';
import { StatusPill, SourceTag, ReplyPill } from './ui';

const ICON = { core: <Server size={13} />, tooling: <ShieldCheck size={13} />, ot: <Factory size={13} />, tprm: <Truck size={13} /> };
const LINK_OUT: Record<VrSource, { to: string; label: string }> = {
  core: { to: '/fabric/assets', label: 'Open HexaCore unified assets' },
  tooling: { to: '/tooling/overview', label: 'Open Security Tooling' },
  ot: { to: '/ot/assets', label: 'Open HexaOT assets' },
  tprm: { to: '/comply/tprm?section=suppliers', label: 'Open Third-Party Risk' },
};
const SRC_LABEL: Record<string, VrSource> = { HexaCore: 'core', 'Security Tooling': 'tooling', HexaOT: 'ot', 'Third parties': 'tprm' };

export function Match() {
  const { c, tenantId, adv, rows, tally, sups, coverage, verdict, setParams } = useVr();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const src = (sp.get('src') as VrSource | null) ?? null;
  const tenant = sp.get('tenant');
  const status = (sp.get('status') as VrStatus | null) ?? null;
  const runs = sups.filter((s) => s.runsProduct);
  const counts: Record<VrSource, number> = { ...tally.bySource, tprm: runs.length };
  const cov = new Map(coverage.map((x) => [x.source, x]));
  const sbom = sbAdvisoryExposure(c, tenantId, adv.cve);

  const filtered = rows.filter((a) => (!src || a.source === src) && (!tenant || a.tenantId === tenant) && (!status || a.status === status));
  const openAsset = (a: VrAsset) => { const next = new URLSearchParams(sp); next.set('asset', a.id); setSp(next, { replace: true }); };
  const scrollToTable = () => setTimeout(() => document.getElementById('vr-match-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  const pick = (patch: Record<string, string | null>) => { setParams(patch); scrollToTable(); };

  // Flow: advisory -> sources -> where -> status
  const tenants = [...new Set(rows.map((a) => a.tenantId))];
  const columns: FlowColumn[] = [
    { label: 'Advisory', nodes: [{ id: 'adv', title: adv.cve, count: rows.length + runs.length, sub: 'matches', icon: <Siren size={13} />, color: 'var(--sev-critical)', onClick: () => pick({ src: null, tenant: null, status: null }) }] },
    {
      label: 'Matched in', nodes: (['core', 'tooling', 'ot', 'tprm'] as VrSource[]).map((s) => ({
        id: `s-${s}`, title: s === 'tooling' ? 'Tooling' : s === 'tprm' ? 'Suppliers' : VR_SOURCE_META[s].short, count: counts[s], icon: ICON[s], color: VR_SOURCE_META[s].color,
        sub: counts[s] ? (s === 'tprm' ? 'suppliers run it' : 'assets') : `0 of ${fmtNum(cov.get(s)?.checked ?? 0)} checked`, state: counts[s] ? undefined : ('good' as const),
        onClick: () => pick({ src: s, tenant: null, status: null }),
      })),
    },
    {
      label: 'Where', nodes: [
        ...tenants.map((t) => ({ id: `t-${t}`, title: c.tenants.find((x) => x.id === t)?.short ?? t, count: rows.filter((a) => a.tenantId === t).length, sub: 'assets', onClick: () => pick({ tenant: t, src: null, status: null }) })),
        ...(runs.length ? [{ id: 't-sup', title: 'Suppliers', count: runs.length, sub: 'outside your network', color: VR_SOURCE_META.tprm.color, onClick: () => pick({ src: 'tprm', tenant: null, status: null }) }] : []),
      ],
    },
    {
      label: 'Status now', nodes: VR_STATUSES.map((s) => ({ id: `st-${s}`, title: s, count: tally[s], color: VR_STATUS_COLOR[s], state: s === 'Unpatched' && tally[s] ? ('bad' as const) : undefined, sub: s === 'Unpatched' ? 'exposed' : undefined, onClick: () => pick({ status: s, src: null, tenant: null }) })),
    },
  ];
  const links: FlowLink[] = [];
  (['core', 'tooling', 'ot', 'tprm'] as VrSource[]).forEach((s) => { if (counts[s]) links.push({ from: 'adv', to: `s-${s}`, value: counts[s], color: VR_SOURCE_META[s].hex }); });
  (['core', 'tooling', 'ot'] as VrSource[]).forEach((s) => tenants.forEach((t) => {
    const n = rows.filter((a) => a.source === s && a.tenantId === t).length;
    if (n) links.push({ from: `s-${s}`, to: `t-${t}`, value: n, color: VR_SOURCE_META[s].hex });
  }));
  if (runs.length) links.push({ from: 's-tprm', to: 't-sup', value: runs.length, color: VR_SOURCE_META.tprm.hex });
  tenants.forEach((t) => VR_STATUSES.forEach((s) => {
    const n = rows.filter((a) => a.tenantId === t && a.status === s).length;
    if (n) links.push({ from: `t-${t}`, to: `st-${s}`, value: n, bad: s === 'Unpatched' });
  }));

  const cols: Column<VrAsset>[] = [
    { key: 'name', header: 'Asset', sort: (a) => a.name, render: (a) => (<><div className="t-main mono">{a.name}</div><div className="t-sub muted" style={{ fontSize: 11 }}>{a.kind}</div></>) },
    { key: 'src', header: 'Matched in', sort: (a) => a.source, render: (a) => (<><SourceTag s={a.source} /><div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{a.tool}</div></>) },
    { key: 'where', header: 'Tenant · site', sort: (a) => a.tenantName, render: (a) => (<><div>{a.tenantName}</div><div className="muted" style={{ fontSize: 11 }}>{a.site.replace(`${a.tenantName} · `, '')}</div></>) },
    { key: 'ver', header: 'Version', sort: (a) => a.version, render: (a) => <span className="mono">{a.version}</span> },
    { key: 'net', header: 'Internet', sort: (a) => Number(a.internet), render: (a) => (a.internet ? <Badge color="var(--bad)" dot>Exposed</Badge> : a.airGapped ? <span className="muted">Air-gapped</span> : <span className="muted">Internal</span>) },
    { key: 'matched', header: 'Matched', align: 'right', sort: (a) => a.matchedAfterMin, render: (a) => <span className="muted">+{a.matchedAfterMin} min</span> },
    { key: 'st', header: 'Status', sort: (a) => VR_STATUSES.indexOf(a.status), render: (a) => <StatusPill s={a.status} /> },
  ];
  const supCols: Column<VrSupplier>[] = [
    { key: 'n', header: 'Supplier', sort: (s) => s.name, render: (s) => (<span className="vr-row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="tp-mono sm" style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, background: 'var(--surface-sunken)', border: '1px solid var(--card-border)' }}>{s.mono}</span><span><div className="t-main">{s.name}</div><div className="muted" style={{ fontSize: 11 }}>{s.category} · tier {s.tier}</div></span></span>) },
    { key: 'w', header: 'Why it matched', render: (s) => <span className="muted" style={{ fontSize: 12 }}>{s.why}</span> },
    { key: 'r', header: 'Their answer', render: (s) => <ReplyPill r={s.reply ?? (s.asked ? 'No response' : 'Not asked')} /> },
  ];

  return (
    <div className="vr-stack">
      {verdict === 'Affected' ? (
        <Callout kind="warn" color="var(--sev-critical)">
          <b>Yes, {c.short} uses {adv.product}.</b> {plural(rows.length, 'asset')} across {plural(tenants.length, 'tenant')}{runs.length ? ` and ${plural(runs.length, 'supplier')} in the TPRM register` : ''} run an affected version. Matched {adv.matchedAfterMin} min after disclosure from four sources; every count below opens its records.
        </Callout>
      ) : verdict === 'Investigating' ? (
        <Callout kind="warn"><b>Checking.</b> {adv.candidates} hosts respond like {adv.product} but their version is not yet known. A credentialed check is running; nothing is confirmed affected yet.</Callout>
      ) : (
        <Callout kind="good"><b>No, {c.short} does not run an affected version.</b> All four sources were checked: {coverage.map((x) => `${fmtNum(x.checked)} ${x.unit}`).join(', ')}.</Callout>
      )}

      <div className="vr-srcgrid">
        {(['core', 'tooling', 'ot', 'tprm'] as VrSource[]).map((s) => {
          const m = VR_SOURCE_META[s];
          const cv = cov.get(s);
          return (
            <button key={s} type="button" className={`vr-srccard ${src === s ? 'on' : ''}`} style={{ ['--tc' as string]: m.color }} onClick={() => pick({ src: src === s ? null : s, tenant: null, status: null })} title={`Source: ${cv?.tools.filter(Boolean).join(' · ') || m.label} · click to filter the list below`}>
              <span className="vr-srccard-h"><span className="vr-row" style={{ gap: 6 }}>{ICON[s]} {m.label}</span></span>
              <span className="vr-srccard-n"><b>{counts[s]}</b><span>{s === 'tprm' ? 'suppliers run it' : 'matched'}</span></span>
              <small>{fmtNum(cv?.checked ?? 0)} {cv?.unit} checked{cv?.tools.filter(Boolean).length ? ` · ${cv.tools.filter(Boolean).slice(0, 3).join(', ')}` : ''}</small>
              <span className="link" role="link" onClick={(e) => { e.stopPropagation(); nav(LINK_OUT[s].to); }}>{LINK_OUT[s].label} <ExternalLink size={11} /></span>
            </button>
          );
        })}
      </div>

      {sbom && sbom.hidden.length > 0 && (
        <button type="button" className="vr-srccard" style={{ ['--tc' as string]: 'var(--sev-critical)', width: '100%' }} onClick={() => nav(`/fabric/sbom?section=hidden&component=${sbom.comp.id}`)} title="Source: HexaCore Software Supply Chain (SBOM) · vendor SBOMs × this advisory">
          <span className="vr-srccard-h"><span className="vr-row" style={{ gap: 6 }}><Package size={13} /> Found inside software (SBOM)</span></span>
          <span className="vr-srccard-n"><b>{sbom.hidden.length}</b><span>more vendor {sbom.hidden.length === 1 ? 'product embeds' : 'products embed'} <span className="mono">{sbom.comp.name}</span> · {fmtNum(sbom.hiddenInstances)} units the asset match cannot see</span></span>
          <small>{sbom.hidden.map((p) => p.name).join(' · ')}</small>
          <span className="link">Open Software Supply Chain <ExternalLink size={11} /></span>
        </button>
      )}

      <Card title="Advisory to affected assets" sub="Where the match came from, which tenants it lands in and where each asset stands now · click any node to filter">
        <div className="vr-flow"><FlowMap columns={columns} links={links} height={Math.max(230, (tenants.length + 1) * 64)} badColor="#e0345e" /></div>
      </Card>

      <div id="vr-match-table">
        {src === 'tprm' ? (
          <Card title="Suppliers that run the product" count={runs.length} sub="From the TPRM technology register · ask them in Supplier outreach" flush actions={<button className="link" onClick={() => nav('/comply/tprm?section=suppliers')}>Open Third-Party Risk →</button>}>
            <DataTable rows={runs} columns={supCols} onRowClick={(s) => nav(`/comply/tprm?section=suppliers&id=${s.id}`)} empty="No supplier in the register runs this product." />
          </Card>
        ) : (
          <Card
            title="Matched assets"
            count={filtered.length}
            sub={src || tenant || status ? 'Filtered · click a row for detail, evidence and actions' : 'Every asset matched to the advisory · click a row for detail'}
            flush
            actions={src ? <button className="link" onClick={() => nav(LINK_OUT[src].to)}>{LINK_OUT[src].label} →</button> : undefined}
          >
            <div className="vr-facets">
              <FilterGroup label="Source" value={src ? VR_SOURCE_META[src].short : 'All'} options={['HexaCore', 'Security Tooling', 'HexaOT', 'Third parties']} onChange={(v) => setParams({ src: v === 'All' ? null : SRC_LABEL[v] })} counts={{ HexaCore: counts.core, 'Security Tooling': counts.tooling, HexaOT: counts.ot, 'Third parties': counts.tprm }} />
              <FilterGroup label="Status" value={status ?? 'All'} options={VR_STATUSES} onChange={(v) => setParams({ status: v === 'All' ? null : v })} counts={Object.fromEntries(VR_STATUSES.map((s) => [s, tally[s]]))} />
              {tenant && <button className="int-fchip on" onClick={() => setParams({ tenant: null })}>{c.tenants.find((t) => t.id === tenant)?.short} ✕</button>}
            </div>
            <DataTable rows={filtered} columns={cols} onRowClick={openAsset} search={(a) => `${a.name} ${a.kind} ${a.site} ${a.tool}`} searchPlaceholder="Filter assets…" initialSort={{ key: 'st', dir: 'asc' }} rowKey={(a) => a.id} empty="No matched assets for this filter." />
          </Card>
        )}
      </div>
    </div>
  );
}
