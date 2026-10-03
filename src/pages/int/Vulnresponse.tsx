import { useSearchParams } from 'react-router-dom';
import { Siren, FileText, Radar } from 'lucide-react';
import { MODULE_BY_ID } from '../../modules/registry';
import { tenantName } from '../../data/customers';
import { KpiStrip, Btn } from '../../components/ui';
import { fmtDur, plural } from '../../lib/format';
import { vrScanner, vrEdr, VR_VERDICT_COLOR } from '../../data/modules/vulnresponse';
import { VrProvider, useVr, VR_SECTIONS } from './vulnresponse/state';
import { CvssBadge, Flags, VerdictPill, PhasePill } from './vulnresponse/ui';
import { Advisories } from './vulnresponse/Advisories';
import { Match } from './vulnresponse/Match';
import { Patch } from './vulnresponse/Patch';
import { Outreach } from './vulnresponse/Outreach';
import { Statement } from './vulnresponse/Statement';
import { AssetDrawer } from './vulnresponse/AssetDrawer';
import './int.css';
import './vulnresponse/vr.css';

const tone = MODULE_BY_ID.int.tone;

export default function IntVulnResponse() {
  return (
    <VrProvider>
      <Workspace />
    </VrProvider>
  );
}

function Workspace() {
  const { c, tenantId, adv, rows, tally, verdict, sups, section, go } = useVr();
  const [sp, setSp] = useSearchParams();
  const assetId = sp.get('asset');
  const openAsset = assetId ? rows.find((a) => a.id === assetId) : undefined;
  const otTools = c.connectors.filter((k) => k.category === 'OT').map((k) => (k.vendor === 'HexaShield' ? 'HexaOT' : k.vendor));
  const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';
  const asked = sups.filter((s) => s.asked);
  const supAffected = sups.filter((s) => s.reply === 'Affected – patching' || s.reply === 'Affected – patched').length;
  const noReply = asked.filter((s) => !s.reply || s.reply === 'No response').length;
  const srcAssets = `${vrScanner(c)} · ${vrEdr(c)}${otTools.length ? ` · ${[...new Set(otTools)].join(' · ')}` : ''} · Security Tooling inventory`;

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: when a critical vulnerability drops, HexaInt answers &ldquo;do we use it, and is it patched?&rdquo; in minutes. Advisories are matched against HexaCore unified assets ({vrScanner(c)}, {vrEdr(c)}), the Security Tooling inventory{otTools.length ? <>, HexaOT assets ({[...new Set(otTools)].join(', ')})</> : ''} and the {grc} supplier register, then tracked to patched with evidence.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Advisory', hint: adv.cve, value: adv.cvss.toFixed(1), unit: 'CVSS', toneColor: 'var(--sev-critical)', onClick: () => go('advisories'), source: adv.feed },
          { label: 'Do we use it?', value: verdict === 'Affected' ? 'Yes' : verdict === 'Investigating' ? 'Checking' : 'No', unit: verdict === 'Affected' ? `${tally.total} assets` : verdict === 'Investigating' ? `${adv.candidates} candidates` : 'no match', toneColor: VR_VERDICT_COLOR[verdict], onClick: () => go('exposure'), source: srcAssets },
          { label: 'Patched', value: `${tally.Patched}`, unit: `of ${tally.total}`, bar: tally.total ? (tally.Patched / tally.total) * 100 : 0, toneColor: 'var(--good)', onClick: () => go('patch', { status: 'Patched' }), source: `${vrScanner(c)} rescans · ${srcAssets}` },
          { label: 'Mitigated', hint: 'not yet patched', value: tally.Mitigated, toneColor: 'var(--sev-medium)', onClick: () => go('patch', { status: 'Mitigated' }), source: 'Compensating controls recorded against each asset' },
          { label: 'Still exposed', value: tally.Unpatched, unit: tally.internetOpen ? `${tally.internetOpen} internet-facing` : undefined, toneColor: tally.Unpatched ? 'var(--sev-critical)' : 'var(--good)', onClick: () => go('patch', { status: 'Unpatched' }), source: `${srcAssets} · SLA from the vulnerability policy` },
          { label: 'Suppliers', hint: asked.length ? 'affected / asked' : 'to ask', value: asked.length ? `${supAffected}/${asked.length}` : sups.length, unit: asked.length && noReply ? `${noReply} awaiting` : undefined, toneColor: 'var(--m-comply)', onClick: () => go('suppliers'), source: `${grc} TPRM register · supplier questionnaire` },
          { label: 'Since disclosure', value: fmtDur(adv.publishedMinAgo), unit: adv.matchedAfterMin ? `answered in ${adv.matchedAfterMin} min` : undefined, onClick: () => go('statement'), source: `${adv.feed} · HexaCore audit ledger` },
        ]}
      />

      <section className="vr-hero" style={{ ['--vc' as string]: VR_VERDICT_COLOR[verdict] }}>
        <div className="vr-hero-ico"><Siren size={20} /></div>
        <div className="vr-hero-main">
          <div className="vr-hero-top">
            <span className="vr-cve">{adv.cve}</span>
            <CvssBadge score={adv.cvss} />
            <Flags adv={adv} />
            <PhasePill phase={adv.phase} />
          </div>
          <h3>{adv.product} · {adv.weakness.toLowerCase()}</h3>
          <p>
            <VerdictPill verdict={verdict} />{' '}
            {verdict === 'Affected'
              ? <>Yes, {c.short} runs it: <b>{plural(tally.total, 'asset')}</b> matched{tally.bySource.ot ? `, ${tally.bySource.ot} of them OT` : ''}. <b style={{ color: 'var(--good)' }}>{tally.Patched} patched</b>, <b style={{ color: 'var(--sev-medium)' }}>{tally.Mitigated} mitigated</b>{tally['Not applicable'] ? `, ${tally['Not applicable']} not applicable` : ''}, <b style={{ color: tally.Unpatched ? 'var(--sev-critical)' : 'var(--good)' }}>{tally.Unpatched} still exposed</b>.</>
              : verdict === 'Investigating'
                ? <>{adv.candidates} candidate hosts respond like the product; versions are being confirmed.</>
                : <>No asset, security tool, OT device or recorded supplier in {tenantName(c, tenantId)} runs an affected version.</>}
          </p>
        </div>
        <div className="vr-hero-act">
          <Btn sm onClick={() => go('exposure')}><Radar size={14} /> Where it is</Btn>
          <Btn sm primary color={tone} onClick={() => go('statement')}><FileText size={14} /> Exposure statement</Btn>
        </div>
      </section>

      <nav className="vr-subtabs" aria-label="Vulnerability response sections">
        {VR_SECTIONS.map((s) => {
          const n = s.id === 'advisories' ? undefined : s.id === 'exposure' ? tally.total : s.id === 'patch' ? tally.Unpatched : s.id === 'suppliers' ? sups.length : undefined;
          return (
            <button key={s.id} type="button" className={`vr-subtab ${section === s.id ? 'on' : ''}`} onClick={() => go(s.id)}>
              {s.label}{n !== undefined && <em>{n}</em>}
            </button>
          );
        })}
      </nav>

      {section === 'advisories' && <Advisories />}
      {section === 'exposure' && <Match />}
      {section === 'patch' && <Patch />}
      {section === 'suppliers' && <Outreach />}
      {section === 'statement' && <Statement />}

      {openAsset && (
        <AssetDrawer
          key={openAsset.id}
          a={openAsset}
          onClose={() => {
            const next = new URLSearchParams(sp);
            next.delete('asset');
            setSp(next, { replace: true });
          }}
        />
      )}
    </>
  );
}
