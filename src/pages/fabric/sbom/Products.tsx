import { useNavigate } from 'react-router-dom';
import { FileSearch, Send, ShieldCheck } from 'lucide-react';
import { Card, Btn, Badge } from '../../../components/ui';
import { DataTable, type Column } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { SB_STALE_DAYS, sbProductVulns, type SbProduct, type SbSource } from '../../../data/modules/sbom';
import { FChips, Pill, ReqPill, ageColor, type SbCtx } from './ui';

type SbF = 'yes' | 'missing' | 'stale';
type OrF = 'In-house' | 'Vendor' | 'Supplier';

export function Products({ ctx }: { ctx: SbCtx }) {
  const { c, d, sp, setParams, openProduct, requestSbom, tenantShort } = ctx;
  const nav = useNavigate();
  const sbF = (sp.get('sbom') as SbF | null) ?? 'all';
  const orF = (sp.get('origin') as OrF | null) ?? 'all';
  const site = sp.get('site');
  const regId = sp.get('reg');
  const srcF = sp.get('src') as SbSource | null;
  const reg = d.regs.find((r) => r.reg.id === regId);

  const isOrigin = (p: SbProduct, o: OrF) => (o === 'Supplier' ? !!p.supplierName : o === 'Vendor' ? p.origin === 'Vendor' && !p.supplierName : p.origin === 'In-house');
  const isSb = (p: SbProduct, f: SbF) => (f === 'missing' ? !p.sbom : f === 'stale' ? !!p.sbom && p.sbom.ageDays > SB_STALE_DAYS : !!p.sbom);
  const rows = d.products.filter((p) =>
    (sbF === 'all' || isSb(p, sbF)) && (orF === 'all' || isOrigin(p, orF)) && (!site || p.tenants.includes(site)) && (!reg || reg.reg.test(p)) && (!srcF || p.sbom?.source === srcF));
  const vulnCount = new Map(d.products.map((p) => [p.id, sbProductVulns(p, d.byId).filter((x) => x.vex === 'Affected' || x.vex === 'Under investigation').length]));
  const missing = d.products.filter((p) => !p.sbom).sort((a, b) => b.criticality - a.criticality);

  const cols: Column<SbProduct>[] = [
    { key: 'n', header: 'Product', sort: (p) => p.name, render: (p) => (<><div className="t-main">{p.name}{p.adv === 'hidden' && <Pill color="var(--sev-critical)" title="Embeds the component behind the headline advisory">Hidden exposure</Pill>}</div><div className="t-sub">{p.vendor} · {p.category}</div></>) },
    { key: 'o', header: 'Origin', sort: (p) => (p.supplierName ? 'TPRM' : p.origin), render: (p) => (p.supplierName ? <Badge color="var(--m-comply)">TPRM supplier</Badge> : p.origin === 'In-house' ? <Badge color="var(--m-core)">In-house</Badge> : <Badge>Vendor</Badge>) },
    { key: 'w', header: 'Where', render: (p) => <span className="muted" style={{ fontSize: 11.5 }}>{p.tenants.map(tenantShort).join(', ')}</span> },
    { key: 's', header: 'SBOM', sort: (p) => p.sbom?.format ?? 'zz', render: (p) => (p.sbom ? (<><div className="sb-row" style={{ gap: 5 }}><span className="sb-fmt">{p.sbom.format}</span>{p.sbom.signed && <ShieldCheck size={12} color="var(--good)" aria-label="signed" />}</div><div className="t-sub">{p.sbom.source}</div></>) : <ReqPill r={p.request} days={p.requestDaysAgo} />) },
    { key: 'a', header: 'Age', align: 'right', sort: (p) => p.sbom?.ageDays ?? 9999, render: (p) => (p.sbom ? <span style={{ color: ageColor(p.sbom.ageDays), fontWeight: p.sbom.ageDays > SB_STALE_DAYS ? 700 : 400, whiteSpace: "nowrap" }}>{p.sbom.ageDays} d</span> : <span className="muted">–</span>) },
    { key: 'c', header: 'Components', align: 'right', sort: (p) => p.componentCount, render: (p) => (p.sbom ? <span className="num">{fmtNum(p.componentCount)}</span> : <span className="muted" title="Unknown until the vendor supplies an SBOM">unknown</span>) },
    { key: 'v', header: 'Open vulns', align: 'right', sort: (p) => vulnCount.get(p.id) ?? -1, render: (p) => (p.sbom ? <span style={{ fontWeight: 700, color: vulnCount.get(p.id) ? 'var(--sev-critical)' : 'var(--good)' }}>{vulnCount.get(p.id)}</span> : <span className="muted">?</span>) },
    { key: 'i', header: 'Installed', align: 'right', sort: (p) => p.instances, render: (p) => <span className="num">{fmtNum(p.instances)}</span> },
    { key: 'x', header: '', render: (p) => (!p.sbom && p.request !== 'Declined' ? <span onClick={(e) => e.stopPropagation()}><Btn sm onClick={() => requestSbom(p)}><Send size={12} /> {p.request === 'Not requested' ? 'Request' : 'Chase'}</Btn></span> : null) },
  ];

  const filterLabel = [reg ? reg.reg.short : null, site ? tenantShort(site) : null, srcF].filter(Boolean).join(' · ');

  return (
    <div className="sb-stack">
      <div className="grid g-3-2">
        <Card title="Missing SBOMs" count={missing.length} sub="Products whose supplier has not provided an SBOM · requests run through the HexaComply TPRM questionnaire" actions={<button className="link" onClick={() => nav('/comply/tprm?section=suppliers')}>Third-Party Risk →</button>}>
          {missing.length ? (
            <div className="sb-reqs">
              {missing.map((p) => (
                <div key={p.id} className="sb-req">
                  <div className="sb-req-main" onClick={() => openProduct(p.id)} role="button" tabIndex={0}>
                    <b>{p.name}</b>
                    <span>{p.vendor}{p.supplierName ? ' · TPRM supplier' : ''} · {p.tenants.map(tenantShort).join(', ')}</span>
                  </div>
                  <ReqPill r={p.request} days={p.requestDaysAgo} />
                  {p.request === 'Declined'
                    ? <Btn sm ghost onClick={() => nav(p.supplierId ? `/comply/tprm?section=suppliers&id=${p.supplierId}` : '/comply/tprm?section=suppliers')}>Escalate</Btn>
                    : <Btn sm onClick={() => requestSbom(p)}><Send size={12} /> {p.request === 'Not requested' ? 'Request SBOM' : 'Chase'}</Btn>}
                </div>
              ))}
            </div>
          ) : <div className="empty">Every product in scope has an SBOM.</div>}
        </Card>
        <Card title="How SBOMs reach HexaCore" sub={`${c.short}'s intake channels`}>
          <div className="sb-kv">
            {(['Build pipeline', 'Vendor portal', 'Generated by scan'] as SbSource[]).map((s) => {
              const ps = d.products.filter((p) => p.sbom?.source === s);
              return (
                <button key={s} type="button" onClick={() => setParams({ src: srcF === s ? null : s, sbom: null })} title={ps[0]?.sbom?.tool ?? s}>
                  <b>{ps.length}</b>
                  <span>{s}</span>
                  <div className="sb-muted" style={{ fontSize: 10.5, marginTop: 4, lineHeight: 1.35 }}>{s === 'Build pipeline' ? 'CycloneDX emitted on every release build, signed' : s === 'Vendor portal' ? 'Uploaded by suppliers or fetched from their trust portal' : 'Binary composition analysis of firmware and installers'}</div>
                </button>
              );
            })}
          </div>
          <p className="sb-muted" style={{ margin: '12px 0 0', fontSize: 11.5, lineHeight: 1.5 }}>
            <FileSearch size={12} style={{ verticalAlign: -2 }} /> Formats accepted: CycloneDX 1.4–1.6 (JSON / XML), SPDX 2.2–3.0, and VEX as CSAF 2.0 or CycloneDX VEX. Every SBOM is hashed into the HexaCore audit ledger on arrival.
          </p>
        </Card>
      </div>

      <Card title="Software products" count={rows.length} sub={filterLabel ? `Filtered · ${filterLabel}` : 'Vendor-supplied and in-house software · click a row for its SBOM, components and regulation scope'} flush>
        <div className="sb-facets">
          <FChips<SbF> label="SBOM" value={sbF} options={[{ id: 'yes', label: 'Has SBOM' }, { id: 'missing', label: 'Missing' }, { id: 'stale', label: `Stale > ${SB_STALE_DAYS} d` }]} onChange={(v) => setParams({ sbom: v })} counts={{ yes: d.kpi.withSbom, missing: d.kpi.missing, stale: d.kpi.stale }} />
          <FChips<OrF> label="Origin" value={orF} options={[{ id: 'In-house', label: 'In-house' }, { id: 'Vendor', label: 'Vendor' }, { id: 'Supplier', label: 'TPRM supplier' }]} onChange={(v) => setParams({ origin: v })} />
          {reg && <button type="button" className="sb-fchip on" onClick={() => setParams({ reg: null })} title={reg.reg.ask}>{reg.reg.short} · {reg.reg.scopeLabel} ✕</button>}
          {site && <button type="button" className="sb-fchip on" onClick={() => setParams({ site: null })}>{tenantShort(site)} ✕</button>}
          {srcF && <button type="button" className="sb-fchip on" onClick={() => setParams({ src: null })}>{srcF} ✕</button>}
        </div>
        <DataTable rows={rows} columns={cols} rowKey={(p) => p.id} onRowClick={(p) => openProduct(p.id)} search={(p) => `${p.name} ${p.vendor} ${p.category} ${p.sbom?.format ?? ''}`} searchPlaceholder="Search product, vendor…" initialSort={{ key: 'v', dir: 'desc' }} pageSize={20} empty="No products for this filter." />
      </Card>
    </div>
  );
}
