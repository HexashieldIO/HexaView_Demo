import { useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { tenantName } from '../../data/customers';
import { KpiStrip } from '../../components/ui';
import { fmtCompact, plural } from '../../lib/format';
import { sbData, sbAdvisoryExposure, sbComp, sbProduct, sbSubscribe, sbVersion, sbRequestSbom, type SbProduct } from '../../data/modules/sbom';
import { TONE, toneStyle } from './parts';
import { SB_SECTIONS, type SbCtx, type SbSection } from './sbom/ui';
import { Overview } from './sbom/Overview';
import { Products } from './sbom/Products';
import { Components } from './sbom/Components';
import { Graph } from './sbom/Graph';
import { Hidden } from './sbom/Hidden';
import { ProductDrawer, ComponentDrawer, RequestModal } from './sbom/Drawers';
import './fabric.css';
import './sbom/sbom.css';

export default function FabricSbom() {
  const { customer: c, tenantId, toast } = useApp();
  const [sp, setSp] = useSearchParams();
  const ver = useSyncExternalStore(sbSubscribe, sbVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const d = useMemo(() => sbData(c, tenantId), [c, tenantId, ver]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exp = useMemo(() => sbAdvisoryExposure(c, tenantId), [c, tenantId, ver]);
  const [reqFor, setReqFor] = useState<SbProduct | null>(null);

  const raw = sp.get('section') as SbSection | null;
  const section: SbSection = raw && SB_SECTIONS.some((s) => s.id === raw) ? raw : 'overview';

  const go = (sec: SbSection, params?: Record<string, string>) => {
    const next = new URLSearchParams();
    if (sec !== 'overview') next.set('section', sec);
    Object.entries(params ?? {}).forEach(([k, v]) => next.set(k, v));
    setSp(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  };
  const openComp = (id: string) => { const next = new URLSearchParams(sp); next.delete('product'); next.set('component', id); setSp(next); };
  const openProduct = (id: string) => { const next = new URLSearchParams(sp); next.delete('component'); next.set('product', id); setSp(next); };
  const tenantShort = (id: string) => c.tenants.find((t) => t.id === id)?.short ?? id;

  const ctx: SbCtx = { c, tenantId, d, exp, sp, go, setParams, openComp, openProduct, requestSbom: setReqFor, tenantShort };

  const k = d.kpi;
  const appsec = c.connectors.find((x) => x.category === 'AppSec');
  const scanner = c.connectors.find((x) => x.category === 'Vulnerability');
  const src = `HexaCore SBOM intake · ${appsec ? `${appsec.vendor} ${appsec.product}` : 'build pipelines'} · ${scanner ? `${scanner.vendor} ${scanner.product}` : 'scanner'}`;
  const hiddenN = exp?.hidden.length ?? 0;

  // The component drawer is opened from any section via ?component=; the product drawer via ?product= (except on the graph, which uses it to pick).
  const comp = sbComp(d, sp.get('component'));
  const prod = section === 'graph' ? undefined : sbProduct(d, sp.get('product'));
  const close = (key: string) => () => { const next = new URLSearchParams(sp); next.delete(key); setSp(next, { replace: true }); };

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: software bills of materials (CycloneDX and SPDX) from vendor portals, {appsec ? `${appsec.vendor} ${appsec.product} in the build pipelines` : 'the build pipelines'} and binary scans of firmware{scanner ? ` (${scanner.vendor} ${scanner.product}, HexaOT)` : ''}, so &ldquo;do we use it?&rdquo; reaches the libraries buried inside {plural(k.total, 'software product')}. VEX statements from suppliers separate exploitable from merely present.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Products with SBOM', value: `${k.withSbom}`, unit: `of ${k.total}`, bar: k.total ? (k.withSbom / k.total) * 100 : 0, delta: k.missing ? { text: `${k.missing} without an SBOM`, good: false } : undefined, toneColor: TONE, onClick: () => go('products', { sbom: k.missing ? 'missing' : 'yes' }), source: `${src} × HexaComply TPRM register` },
          { label: 'Components tracked', value: fmtCompact(k.tracked), hint: 'distinct', toneColor: 'var(--m-matrix)', onClick: () => go('components'), source: `${k.withSbom} SBOMs, de-duplicated by package URL` },
          { label: 'Vulnerable components', value: k.vulnerable, toneColor: k.vulnerable ? 'var(--sev-critical)' : 'var(--good)', onClick: () => go('components', { f: 'vulnerable' }), source: 'SBOM components × HexaInt advisories · NVD · CISA KEV' },
          { label: 'VEX: not affected', hint: 'suppressed', value: k.suppressed, toneColor: 'var(--good)', onClick: () => go('components', { f: 'vex-na' }), source: 'Supplier VEX statements (CSAF / CycloneDX VEX) and HexaCore triage' },
          { label: 'Licence risk', value: k.licence, hint: 'copyleft / unknown', toneColor: 'var(--sev-high)', onClick: () => go('components', { f: 'licence' }), source: 'SPDX licence ids in each SBOM' },
          { label: 'SBOM freshness', value: `${k.freshPct}%`, unit: `≤ 90 d · median ${k.medianAge} d`, bar: k.freshPct, toneColor: k.freshPct >= 75 ? 'var(--good)' : 'var(--sev-medium)', onClick: () => go('products', { sbom: 'stale' }), source: 'SBOM generation timestamps' },
          { label: 'Hidden exposure', hint: exp?.cve, value: hiddenN, unit: hiddenN ? 'vendor products' : 'none', toneColor: hiddenN ? 'var(--sev-critical)' : 'var(--good)', onClick: () => go('hidden'), source: `${exp?.cve ?? 'Headline advisory'} × SBOM components · HexaInt Critical Vulnerability Response` },
        ]}
      />

      <nav className="sb-subtabs" aria-label="Software supply chain sections" style={{ marginBottom: 16 }}>
        {SB_SECTIONS.map((s) => {
          const n = s.id === 'products' ? k.total : s.id === 'components' ? d.comps.length : s.id === 'hidden' ? hiddenN : undefined;
          return (
            <button key={s.id} type="button" className={`sb-subtab ${section === s.id ? 'on' : ''} ${s.id === 'hidden' && hiddenN ? 'hot' : ''}`} onClick={() => go(s.id)}>
              {s.label}{n !== undefined && <em>{n}</em>}
            </button>
          );
        })}
      </nav>

      {section === 'overview' && <Overview ctx={ctx} />}
      {section === 'products' && <Products ctx={ctx} />}
      {section === 'components' && <Components ctx={ctx} />}
      {section === 'graph' && <Graph ctx={ctx} />}
      {section === 'hidden' && <Hidden ctx={ctx} />}

      {comp && <ComponentDrawer key={comp.c.id} ctx={ctx} row={comp} onClose={close('component')} />}
      {prod && !comp && <ProductDrawer key={prod.id} ctx={ctx} p={prod} onClose={close('product')} />}
      {reqFor && (
        <RequestModal
          ctx={ctx}
          p={reqFor}
          onClose={() => setReqFor(null)}
          onConfirm={() => { sbRequestSbom(c, reqFor.id); toast(`SBOM requested from ${reqFor.vendor} for ${reqFor.name} · tracked in HexaComply TPRM`); setReqFor(null); }}
        />
      )}
    </div>
  );
}
