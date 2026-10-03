import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Boxes, Send, GitBranch, Siren } from 'lucide-react';
import { Btn, Callout, KV, Badge, Sources } from '../../../components/ui';
import { Drawer, Modal } from '../../../components/Overlay';
import { FlowMap, type FlowColumn, type FlowLink } from '../../../components/FlowMap';
import { fmtNum, plural } from '../../../lib/format';
import { SB_STALE_DAYS, sbProductVulns, type SbCompRow, type SbProduct, type SbVex } from '../../../data/modules/sbom';
import { LicPill, Pill, ReqPill, SevPill, VexPill, ageColor, type SbCtx } from './ui';

const OPEN: SbVex[] = ['Affected', 'Under investigation'];

export function ProductDrawer({ ctx, p, onClose }: { ctx: SbCtx; p: SbProduct; onClose: () => void }) {
  const { d, openComp, requestSbom, tenantShort, go } = ctx;
  const nav = useNavigate();
  const vulns = sbProductVulns(p, d.byId);
  const open = vulns.filter((v) => OPEN.includes(v.vex));
  const regs = d.regs.filter((r) => r.reg.test(p));
  return (
    <Drawer
      wide
      onClose={onClose}
      title={p.name}
      sub={`${p.vendor} · ${p.category}`}
      icon={<span className="ico-box" style={{ ['--tone' as string]: 'var(--m-core)' }}><Package /></span>}
      footer={p.sbom
        ? <><Btn onClick={() => go('graph', { product: p.id })}><GitBranch size={14} /> Dependency graph</Btn>{p.supplierId && <Btn ghost onClick={() => nav(`/comply/tprm?section=suppliers&id=${p.supplierId}`)}>Supplier record</Btn>}</>
        : <>{p.request !== 'Declined' && <Btn primary color="var(--m-core)" onClick={() => requestSbom(p)}><Send size={14} /> {p.request === 'Not requested' ? 'Request SBOM' : 'Chase SBOM request'}</Btn>}{p.supplierId && <Btn ghost onClick={() => nav(`/comply/tprm?section=suppliers&id=${p.supplierId}`)}>Supplier record</Btn>}</>}
    >
      <div className="sb-kv">
        <div><b>{p.sbom ? fmtNum(p.componentCount) : '?'}</b><span>components</span></div>
        <div><b style={{ color: open.length ? 'var(--sev-critical)' : p.sbom ? 'var(--good)' : undefined }}>{p.sbom ? open.length : '?'}</b><span>open vulnerabilities</span></div>
        <div><b style={{ color: p.sbom ? ageColor(p.sbom.ageDays) : 'var(--sev-medium)' }}>{p.sbom ? `${p.sbom.ageDays} d` : 'None'}</b><span>SBOM age</span></div>
        <div><b>{fmtNum(p.instances)}</b><span>installed units</span></div>
      </div>
      {p.adv === 'hidden' && <Callout kind="warn" color="var(--sev-critical)"><Siren size={13} style={{ verticalAlign: -2 }} /> Embeds the component behind the headline advisory, which the asset-level match did not catch. <button className="link" onClick={() => go('hidden')}>Hidden exposure →</button></Callout>}
      {!p.sbom && <Callout kind="warn">No SBOM: {p.name} is a black box, so every advisory has to be answered by asking {p.vendor}. {p.request === 'Declined' ? 'The supplier declined; escalate through the contract review.' : ''}</Callout>}
      {p.note && <Callout kind="info">{p.note}</Callout>}
      <KV rows={[
        ['Origin', p.supplierName ? <span>TPRM supplier · {p.supplierName}</span> : p.origin],
        ['Deployed in', p.tenants.map(tenantShort).join(', ')],
        ['SBOM', p.sbom ? <span className="sb-row" style={{ gap: 6 }}><span className="sb-fmt">{p.sbom.format}</span>{p.sbom.signed ? <Badge color="var(--good)">Signed</Badge> : <Badge color="var(--sev-medium)">Unsigned</Badge>}</span> : <ReqPill r={p.request} days={p.requestDaysAgo} />],
        ...(p.sbom ? [
          ['Source', <span>{p.sbom.source}<div className="muted" style={{ fontSize: 11 }}>{p.sbom.tool}</div></span>] as [string, ReactNode],
          ['Freshness', p.sbom.ageDays > SB_STALE_DAYS ? <span style={{ color: 'var(--sev-medium)' }}>Stale: generated {p.sbom.ageDays} days ago, older than the {SB_STALE_DAYS}-day policy</span> : `Generated ${p.sbom.ageDays} days ago`] as [string, ReactNode],
          ['Serial', <span className="mono" style={{ fontSize: 11 }}>{p.sbom.serial}</span>] as [string, ReactNode],
        ] : []),
        ['Regulation scope', regs.length ? <span className="sb-row" style={{ gap: 5 }}>{regs.map((r) => <Pill key={r.reg.id} color="var(--m-comply)" title={r.reg.ask}>{r.reg.short}</Pill>)}</span> : <span className="muted">None mapped</span>],
      ]} />
      {p.sbom && (
        <div>
          <div className="section-label">Libraries with known vulnerabilities</div>
          {vulns.length ? (
            <div className="list">
              {vulns.map((v) => (
                <button key={`${v.comp.id}-${v.vuln.id}`} className="list-row" onClick={() => openComp(v.comp.id)}>
                  <span className="list-main"><b className="mono">{v.comp.name}@{v.lib.version}</b><span>{v.module} · {v.vuln.id} · {v.vuln.title}</span></span>
                  <SevPill sev={v.vuln.sev} />
                  <VexPill s={v.vex} />
                </button>
              ))}
            </div>
          ) : <div className="empty">No known vulnerabilities in the notable libraries of this SBOM.</div>}
        </div>
      )}
      {p.sbom && (
        <div>
          <div className="section-label">Direct dependencies</div>
          <div className="chips">{p.modules.map((m) => <span key={m.name} className="sb-tag">{m.name} · {plural(m.libs.length, 'lib')}</span>)}</div>
        </div>
      )}
    </Drawer>
  );
}

export function ComponentDrawer({ ctx, row, onClose }: { ctx: SbCtx; row: SbCompRow; onClose: () => void }) {
  const { openProduct, go, exp } = ctx;
  const x = row.c;
  const uses = row.uses;
  const mods = [...new Set(uses.map((u) => `${u.product.id}::${u.module}`))];
  const usageOpen = (u: (typeof uses)[number]) => Object.values(u.lib.vex).some((s) => OPEN.includes(s));
  const columns: FlowColumn[] = [
    { label: 'Product', nodes: uses.map((u) => ({ id: `p-${u.product.id}`, title: u.product.name, count: fmtNum(u.product.instances), sub: 'units', state: usageOpen(u) ? ('bad' as const) : undefined, onClick: () => openProduct(u.product.id) })) },
    { label: 'Module', nodes: mods.map((m) => { const [, name] = m.split('::'); return { id: `m-${m}`, title: name.replace(' · ', ' › '), sub: undefined }; }) },
    { label: 'Library', nodes: [{ id: 'c', title: <span className="mono">{x.name}</span>, count: plural(row.products, 'product'), sub: plural(row.versions.length, 'version'), state: row.vulnerable ? ('bad' as const) : ('good' as const), icon: <Boxes size={13} /> }] },
  ];
  const links: FlowLink[] = [];
  uses.forEach((u) => {
    const m = `m-${u.product.id}::${u.module}`;
    links.push({ from: `p-${u.product.id}`, to: m, value: 1, bad: usageOpen(u) });
    links.push({ from: m, to: 'c', value: 1, bad: usageOpen(u) });
  });
  return (
    <Drawer
      wide
      onClose={onClose}
      title={<span className="mono">{x.name}</span>}
      sub={`${x.ecosystem} · ${x.category} · ${x.maintainer}`}
      icon={<span className="ico-box" style={{ ['--tone' as string]: row.vulnerable ? 'var(--sev-critical)' : 'var(--m-core)' }}><Boxes /></span>}
      footer={x.advisory ? <Btn primary color="var(--sev-critical)" onClick={() => go('hidden')}><Siren size={14} /> Hidden exposure for {exp?.cve}</Btn> : undefined}
    >
      <div className="sb-kv">
        <div><b>{row.products}</b><span>products it is inside</span></div>
        <div><b>{row.versions.length}</b><span>versions in use</span></div>
        <div><b style={{ color: row.vex.Affected ? 'var(--sev-critical)' : undefined }}>{row.vex.Affected}</b><span>VEX affected</span></div>
        <div><b style={{ color: 'var(--good)' }}>{row.vex['Not affected'] + row.vex.Fixed}</b><span>suppressed / fixed</span></div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{x.desc}. Latest release {x.latest}.</p>

      <div>
        <div className="section-label">Every product it is inside</div>
        <div className="sb-flow">
          <FlowMap columns={columns} links={links} height={Math.max(150, uses.length * 54)} badColor="#e0345e" />
        </div>
      </div>

      {x.vulns.length > 0 && (
        <div>
          <div className="section-label">Vulnerabilities and VEX per product</div>
          {x.vulns.map((v) => (
            <div key={v.id} style={{ marginBottom: 10 }}>
              <div className="sb-row" style={{ marginBottom: 6 }}><span className="sb-cve">{v.id}</span><SevPill sev={v.sev} /><span className="muted" style={{ fontSize: 12 }}>CVSS {v.cvss.toFixed(1)} · {v.title} · fixed in {v.fixedIn}</span></div>
              <div className="list">
                {uses.map((u) => (
                  <button key={u.product.id} className="list-row" onClick={() => openProduct(u.product.id)}>
                    <span className="list-main"><b>{u.product.name}</b><span className="sb-path" style={{ marginTop: 3 }}><span>{u.module.replace(' · ', ' › ')}</span>{u.lib.via && <><i>→</i><span className="mono">{u.lib.via}</span></>}<i>→</i><span className={`mono ${OPEN.includes(u.lib.vex[v.id]) ? 'bad' : ''}`}>{x.name}@{u.lib.version}</span></span></span>
                    {u.lib.vex[v.id] && <VexPill s={u.lib.vex[v.id]} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <KV rows={[
        ['Licence', <LicPill r={x.licRisk} licence={x.licence} />],
        ['Licence note', x.licRisk === 'Strong copyleft' ? 'Copyleft: shipping it inside distributed apps or firmware obliges source disclosure; legal review needed' : x.licRisk === 'Unknown' ? 'No licence stated in the SBOM; ask the supplier' : 'No obligations beyond attribution'],
        ['Seen in', <Sources items={[...new Set(uses.map((u) => u.product.sbom?.source ?? 'SBOM'))].map((n) => ({ name: n }))} />],
      ]} />
    </Drawer>
  );
}

export function RequestModal({ ctx, p, onClose, onConfirm }: { ctx: SbCtx; p: SbProduct; onClose: () => void; onConfirm: () => void }) {
  const { c, d, tenantShort } = ctx;
  const regs = d.regs.filter((r) => r.reg.test(p));
  const owner = c.people.grcLead.name;
  return (
    <Modal
      title={`${p.request === 'Not requested' ? 'Request' : 'Chase'} SBOM from ${p.vendor}`}
      sub={p.name}
      onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color="var(--m-core)" onClick={onConfirm}><Send size={14} /> Send request</Btn></>}
    >
      <Callout kind="info"><b>Low-risk action</b> · one approver ({owner}), nothing changes in the supplier’s system. Sent as a HexaComply TPRM questionnaire item and written to the HexaCore audit ledger.</Callout>
      <div style={{ marginTop: 12 }}>
        <KV rows={[
          ['Asks for', 'SBOM in CycloneDX 1.5+ or SPDX 2.3+, signed, plus VEX statements (CSAF 2.0 or CycloneDX VEX) for known vulnerabilities'],
          ['Supplier record', p.supplierName ? `${p.supplierName} · HexaComply TPRM register` : `${p.vendor} · not yet in the TPRM register (record will be created)`],
          ['Why', regs.length ? `Needed for ${regs.map((r) => r.reg.short).join(', ')}` : 'Vulnerability response coverage'],
          ['Deployed in', p.tenants.map(tenantShort).join(', ')],
          ['Due', '30 days, then chased weekly'],
          ['Status now', <ReqPill r={p.request} days={p.requestDaysAgo} />],
        ]} />
      </div>
    </Modal>
  );
}
