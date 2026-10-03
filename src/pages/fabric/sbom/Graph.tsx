import { Package, Boxes } from 'lucide-react';
import { Card, Btn, Callout } from '../../../components/ui';
import { FlowMap, type FlowColumn, type FlowLink } from '../../../components/FlowMap';
import { fmtNum, plural } from '../../../lib/format';
import { sbProductVulns, type SbVex } from '../../../data/modules/sbom';
import { VexPill, type SbCtx } from './ui';

const OPEN: SbVex[] = ['Affected', 'Under investigation'];

export function Graph({ ctx }: { ctx: SbCtx }) {
  const { d, sp, setParams, openComp, openProduct, tenantShort, go } = ctx;
  const withSb = d.products.filter((p) => p.sbom);
  const openN = (id: string) => { const p = withSb.find((x) => x.id === id); return p ? sbProductVulns(p, d.byId).filter((x) => OPEN.includes(x.vex)).length : 0; };
  const ranked = [...withSb].sort((a, b) => openN(b.id) - openN(a.id) || b.criticality - a.criticality);
  const sel = withSb.find((p) => p.id === sp.get('product')) ?? ranked[0];

  if (!sel) return <Callout kind="info">No product in scope has an SBOM yet. Request one from the Products &amp; SBOMs section.</Callout>;

  const vulns = sbProductVulns(sel, d.byId);
  const libVex = (compId: string): SbVex | null => {
    const vs = vulns.filter((v) => v.comp.id === compId);
    if (!vs.length) return null;
    return vs.find((v) => v.vex === 'Affected')?.vex ?? vs.find((v) => v.vex === 'Under investigation')?.vex ?? vs[0].vex;
  };
  const libIds = [...new Set(sel.modules.flatMap((m) => m.libs.map((l) => l.compId)))];
  const columns: FlowColumn[] = [
    { label: 'Product', nodes: [{ id: 'p', title: sel.name, count: fmtNum(sel.componentCount), sub: 'components in SBOM', icon: <Package size={13} />, color: 'var(--m-core)', onClick: () => openProduct(sel.id) }] },
    { label: 'Direct dependencies', nodes: sel.modules.map((m, i) => {
      const bad = m.libs.some((l) => { const s = libVex(l.compId); return !!s && OPEN.includes(s); });
      return { id: `m${i}`, title: m.name, count: m.libs.length, sub: `libraries · v${m.version}`, icon: <Boxes size={13} />, state: bad ? ('bad' as const) : undefined };
    }) },
    { label: 'Transitive dependencies', nodes: libIds.map((id) => {
      const comp = d.byId.get(id)!;
      const s = libVex(id);
      const lib = sel.modules.flatMap((m) => m.libs).find((l) => l.compId === id)!;
      const bad = !!s && OPEN.includes(s);
      return {
        id: `l-${id}`, title: <span className="mono">{comp.name}</span>, count: lib.version,
        sub: s ? (bad ? `${comp.vulns[0].id} · ${s.toLowerCase()}` : `${comp.vulns[0].id} · ${s.toLowerCase()}`) : comp.category,
        state: bad ? ('bad' as const) : s ? ('good' as const) : undefined,
        color: comp.advisory ? '#e0345e' : undefined,
        onClick: () => openComp(id),
      };
    }) },
  ];
  const links: FlowLink[] = [];
  sel.modules.forEach((m, i) => {
    const bad = m.libs.some((l) => { const s = libVex(l.compId); return !!s && OPEN.includes(s); });
    links.push({ from: 'p', to: `m${i}`, value: m.libs.length, bad });
    m.libs.forEach((l) => { const s = libVex(l.compId); links.push({ from: `m${i}`, to: `l-${l.compId}`, value: 1, bad: !!s && OPEN.includes(s) }); });
  });

  const openV = vulns.filter((v) => OPEN.includes(v.vex));

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', alignItems: 'start' }}>
      <Card title="Products" count={withSb.length} sub="With an SBOM · red = open vulnerabilities">
        <div className="sb-picker">
          {ranked.map((p) => {
            const n = openN(p.id);
            return (
              <button key={p.id} type="button" className={`sb-pick ${p.id === sel.id ? 'on' : ''}`} onClick={() => setParams({ product: p.id })}>
                <b>{p.name}</b>
                <span>{p.vendor} · {p.sbom!.format}</span>
                <em style={{ background: n ? 'color-mix(in srgb, var(--sev-critical) 18%, transparent)' : 'color-mix(in srgb, var(--good) 15%, transparent)', color: n ? 'var(--sev-critical)' : 'var(--good)' }}>{n}</em>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="sb-stack">
        <Card
          title={sel.name}
          sub={`${sel.vendor} · ${sel.sbom!.format} via ${sel.sbom!.source.toLowerCase()} · ${sel.tenants.map(tenantShort).join(', ')} · notable libraries shown, ${fmtNum(sel.componentCount)} components in total`}
          actions={<Btn sm onClick={() => openProduct(sel.id)}>Product detail</Btn>}
        >
          <div className="sb-flow">
            <FlowMap columns={columns} links={links} height={Math.max(260, libIds.length * 50)} badColor="#e0345e" footer={<span>Red paths reach a library with an open vulnerability (VEX affected or under investigation). Green-edged libraries carry a known CVE that the supplier’s VEX marks not affected or fixed. Click any library for every product it is inside.</span>} />
          </div>
        </Card>

        <Card title="Paths to vulnerable libraries" count={openV.length} sub="Product → direct dependency → library, with the VEX statement for this product">
          {openV.length ? (
            <div className="sb-reqs">
              {openV.map((v) => (
                <div key={`${v.module}-${v.comp.id}-${v.vuln.id}`} className="sb-req" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}>
                  <div className="sb-path">
                    <span className="prod">{sel.name}</span><i>→</i><span>{v.module}</span>{v.lib.via && <><i>→</i><span className="mono">{v.lib.via}</span></>}<i>→</i><span className="bad mono">{v.comp.name}@{v.lib.version}</span>
                  </div>
                  <span className="sb-cve" title={v.vuln.title}>{v.vuln.id}</span>
                  <span className="sb-row" style={{ gap: 6, flexWrap: 'nowrap' }}><VexPill s={v.vex} /><Btn sm ghost onClick={() => openComp(v.comp.id)}>Open</Btn></span>
                </div>
              ))}
            </div>
          ) : <Callout kind="good">No open vulnerabilities in {sel.name}: {plural(vulns.length, 'known CVE')} in its libraries {vulns.length === 1 ? 'is' : 'are'} covered by a VEX statement.</Callout>}
          {sel.adv === 'hidden' && (
            <div style={{ marginTop: 10 }}>
              <Callout kind="warn" color="var(--sev-critical)">This product embeds the component behind the headline advisory and is not in the asset-level match. <button className="link" onClick={() => go('hidden')}>See hidden exposure →</button></Callout>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
