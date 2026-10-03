import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren, Package, MapPin, ShieldCheck, ExternalLink, Send, PlusCircle } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Card, Btn, Callout, KV } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { FlowMap, type FlowColumn, type FlowLink } from '../../../components/FlowMap';
import { DataTable, type Column } from '../../../components/DataTable';
import { fmtNum, plural } from '../../../lib/format';
import { sbUsageOf, type SbProduct } from '../../../data/modules/sbom';
import { VexPill, type SbCtx } from './ui';

export function Hidden({ ctx }: { ctx: SbCtx }) {
  const { c, exp, openProduct, openComp, tenantShort } = ctx;
  const { toast } = useApp();
  const nav = useNavigate();
  const [ask, setAsk] = useState<SbProduct | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  if (!exp) return <Callout kind="info">No headline advisory is active.</Callout>;
  const all = [...exp.matched, ...exp.hidden];
  const tenants = [...new Set(all.flatMap((p) => p.tenants))];
  const vr = '/int/vulnresponse?section=exposure';

  const columns: FlowColumn[] = [
    { label: 'Advisory', nodes: [{ id: 'adv', title: exp.cve, count: exp.comp.vulns[0].cvss.toFixed(1), sub: 'CVSS · exploited', icon: <Siren size={13} />, color: 'var(--sev-critical)', onClick: () => nav(vr) }] },
    { label: 'Vulnerable component', nodes: [{ id: 'comp', title: <span className="mono">{exp.comp.name}</span>, count: all.length, sub: 'products embed it', icon: <Package size={13} />, state: 'bad', onClick: () => openComp(exp.comp.id) }] },
    { label: 'Product', nodes: all.map((p) => ({
      id: p.id, title: p.name, count: fmtNum(p.instances), sub: p.adv === 'matched' ? 'units · already in asset match' : 'units · not seen by asset match',
      state: p.adv === 'hidden' ? ('bad' as const) : undefined, color: p.adv === 'matched' ? '#8593b4' : undefined, onClick: () => openProduct(p.id),
    })) },
    { label: 'Where', nodes: tenants.map((t) => ({ id: `t-${t}`, title: tenantShort(t), count: all.filter((p) => p.tenants.includes(t)).length, sub: 'products', icon: <MapPin size={13} /> })) },
  ];
  const links: FlowLink[] = [{ from: 'adv', to: 'comp', value: all.length, bad: true }];
  all.forEach((p) => {
    links.push({ from: 'comp', to: p.id, value: 2, bad: p.adv === 'hidden', color: p.adv === 'matched' ? '#8593b4' : undefined });
    p.tenants.forEach((t) => links.push({ from: p.id, to: `t-${t}`, value: 1, bad: p.adv === 'hidden', color: p.adv === 'matched' ? '#8593b4' : undefined }));
  });

  const cols: Column<SbProduct>[] = [
    { key: 'n', header: 'Product', sort: (p) => p.name, render: (p) => (<><div className="t-main">{p.name}</div><div className="t-sub">{p.vendor} · {p.category}</div></>) },
    { key: 'p', header: 'Where the component sits', render: (p) => { const u = sbUsageOf(p, exp.comp.id); return <div className="sb-path">{(u?.module.split(' · ') ?? []).map((m, i) => <span key={m} style={i ? { marginLeft: -2 } : undefined}>{i ? '› ' : ''}{m}</span>)}<i>→</i><span className="bad mono">{exp.comp.name}@{u?.lib.version}</span></div>; } },
    { key: 'v', header: 'Vendor VEX', render: (p) => { const u = sbUsageOf(p, exp.comp.id); const s = u?.lib.vex[exp.cve]; return s ? <VexPill s={s} /> : null; } },
    { key: 's', header: 'SBOM', render: (p) => <span className="muted" style={{ fontSize: 11.5 }}>{p.sbom ? `${p.sbom.format} · ${p.sbom.source.toLowerCase()}` : '–'}</span> },
    { key: 't', header: 'Where', render: (p) => <span className="muted" style={{ fontSize: 11.5 }}>{p.tenants.map(tenantShort).join(', ')}</span> },
    { key: 'i', header: 'Units', align: 'right', sort: (p) => p.instances, render: (p) => <b>{fmtNum(p.instances)}</b> },
    { key: 'a', header: '', render: (p) => (
      <span className="sb-row" style={{ gap: 6, flexWrap: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
        {added.has(p.id)
          ? <span className="sb-row" style={{ gap: 4, fontSize: 11.5, color: 'var(--good)', fontWeight: 600 }}><ShieldCheck size={13} /> In response</span>
          : <Btn sm primary color="var(--sev-critical)" onClick={() => { setAdded(new Set(added).add(p.id)); toast(`${p.name} added to the ${exp.cve} response · ${fmtNum(p.instances)} units tracked in Critical Vulnerability Response`); }}><PlusCircle size={12} /> Add to response</Btn>}
        <Btn sm onClick={() => setAsk(p)}><Send size={12} /> Ask vendor</Btn>
      </span>
    ) },
  ];

  return (
    <div className="sb-stack">
      {exp.hidden.length ? (
        <section className="sb-hero">
          <div className="sb-hero-ico"><Siren size={20} /></div>
          <div>
            <h3>{exp.cve} is inside {plural(exp.hidden.length, 'vendor product')} you did not know about</h3>
            <p>
              The asset match for <b>{exp.advProduct}</b> found <b>{plural(exp.assetMatched, 'asset')}</b>. The SBOMs show the vulnerable <b className="mono">{exp.comp.name}</b> library, which {exp.vendor} licenses to other manufacturers, embedded in <b style={{ color: 'var(--sev-critical)' }}>{exp.hidden.map((p) => p.name).join(', ')}</b>: <b>{fmtNum(exp.hiddenInstances)} more installed units</b> that scanners see under their own product names.
            </p>
          </div>
          <div className="sb-hero-act">
            <Btn sm onClick={() => nav(vr)}><ExternalLink size={13} /> Critical Vulnerability Response</Btn>
          </div>
        </section>
      ) : (
        <section className="sb-hero good">
          <div className="sb-hero-ico"><ShieldCheck size={20} /></div>
          <div>
            <h3>No hidden exposure to {exp.cve} in {ctx.tenantId === 'all' ? c.short : tenantShort(ctx.tenantId)}</h3>
            <p>No product SBOM in this scope embeds <b className="mono">{exp.comp.name}</b> beyond the {plural(exp.assetMatched, 'asset')} already matched for {exp.advProduct}.</p>
          </div>
          <div className="sb-hero-act"><Btn sm onClick={() => nav(vr)}><ExternalLink size={13} /> Critical Vulnerability Response</Btn></div>
        </section>
      )}

      {all.length > 0 && (
        <Card title="Advisory to every product that carries the code" sub="Grey: already found by the asset match. Red: found only through SBOMs · click any node">
          <div className="sb-flow4">
            <FlowMap columns={columns} links={links} height={Math.max(240, Math.max(all.length, tenants.length) * 62)} badColor="#e0345e" />
          </div>
        </Card>
      )}

      {exp.hidden.length > 0 && (
        <Card title="Products found only through SBOMs" count={exp.hidden.length} sub="Add them to the advisory response so patch tracking, supplier outreach and the exposure statement include them" flush actions={<button className="link" onClick={() => nav(vr)}>Open the response →</button>}>
          <DataTable rows={exp.hidden} columns={cols} rowKey={(p) => p.id} onRowClick={(p) => openProduct(p.id)} initialSort={{ key: 'i', dir: 'desc' }} />
        </Card>
      )}

      <div className="grid g2">
        <Card title="Why the asset match missed them" sub="What scanners and passive monitoring report">
          <ul className="sb-why">
            <li><b>Product identity hides the library.</b> Each device reports its own vendor, model and firmware version, never the OEM components inside it.</li>
            <li><b>The vulnerable service is not exposed the same way.</b> The embedded agent often listens only on a maintenance interface or dials out, so network fingerprints do not match.</li>
            <li><b>Firmware is a binary.</b> Without an SBOM or a binary composition scan, nothing lists what was compiled in.</li>
            <li><b>VEX closes the loop.</b> Vendors that state “affected” or “not affected” turn a library match into a decision.</li>
          </ul>
        </Card>
        <Card title="What happens next" sub="Each step is written to the HexaCore audit ledger">
          <KV rows={[
            ['1. Add to response', 'Hidden products join the advisory in HexaInt so patch tracking and the exposure statement count them'],
            ['2. Ask the vendor', 'VEX and fixed-firmware request through the HexaComply TPRM questionnaire'],
            ['3. Contain', 'Restrict the embedded agent’s management interface; HexaOT watches for its traffic (read-only in OT)'],
            ['4. Verify', 'Re-ingest the vendor’s updated SBOM; the library version must show the fixed release'],
          ]} />
        </Card>
      </div>

      {ask && (
        <Modal
          title={`Ask ${ask.vendor} about ${exp.cve}`}
          sub={ask.name}
          onClose={() => setAsk(null)}
          footer={<><Btn ghost onClick={() => setAsk(null)}>Cancel</Btn><Btn primary color="var(--m-core)" onClick={() => { toast(`VEX request sent to ${ask.vendor} for ${ask.name} · due in 48 h`); setAsk(null); }}>Send request</Btn></>}
        >
          <Callout kind="info"><b>Low-risk action</b> · one approver, nothing changes in the product. The request goes through the HexaComply supplier questionnaire and is written to the audit ledger.</Callout>
          <div style={{ marginTop: 12 }}>
            <KV rows={[
              ['Question', `Is ${ask.name} affected by ${exp.cve} through its embedded ${exp.comp.name}? Please send a VEX statement (CSAF 2.0 or CycloneDX VEX) and the fixed firmware version.`],
              ['Evidence attached', `SBOM extract: ${sbUsageOf(ask, exp.comp.id)?.module.split(' · ').join(' → ')} → ${exp.comp.name}@${sbUsageOf(ask, exp.comp.id)?.lib.version}`],
              ['Due', '48 hours (critical advisory SLA)'],
              ['Route', ask.supplierName ? `TPRM supplier record · ${ask.supplierName}` : `${ask.vendor} PSIRT contact · supplier not yet in the TPRM register`],
            ]} />
          </div>
        </Modal>
      )}
    </div>
  );
}
