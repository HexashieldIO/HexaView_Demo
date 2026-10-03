import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui';
import { PARTNER } from '../../data/modules/partner';
import { portfolio } from '../../data/modules/portfolio';
import { PF_SECTIONS, PF_TONE, type PfSection } from './portfolio/parts';
import Risk from './portfolio/Risk';
import Diligence from './portfolio/Diligence';
import Hundred from './portfolio/Hundred';
import Benchmark from './portfolio/Benchmark';

const BODY: Record<PfSection, ComponentType> = { risk: Risk, diligence: Diligence, hundred: Hundred, benchmark: Benchmark };
const IDS = new Set<string>(PF_SECTIONS.map((s) => s.id));
const INTRO: Record<PfSection, string> = {
  risk: 'Cyber risk across every company you hold or protect, on one scale: Resilience Index, insurability, open critical items and framework status.',
  diligence: 'Outside-in cyber due diligence on acquisition targets, turned into numbers the deal team can negotiate with.',
  hundred: 'The first 100 days after close: connect the acquired company to HexaCore, baseline it and close what diligence found.',
  benchmark: 'How portfolio companies compare with each other and with sector peers from the HexaShield benchmark.',
};

export default function PartnerPortfolio() {
  const [sp, setSp] = useSearchParams();
  const raw = sp.get('section');
  const section: PfSection = raw && IDS.has(raw) ? (raw as PfSection) : 'risk';
  const Body = BODY[section];
  const cos = portfolio();
  return (
    <>
      <nav className="pf-subtabs" aria-label="Portfolio sections">
        {PF_SECTIONS.map((s) => (
          <button key={s.id} type="button" className={`pf-subtab ${section === s.id ? 'on' : ''}`} onClick={() => section !== s.id && setSp(new URLSearchParams({ section: s.id }))} aria-current={section === s.id ? 'page' : undefined}>
            {s.label}
          </button>
        ))}
        <span className="pf-subtabs-end"><Badge color={PF_TONE} dot>Delegated portfolio access · audited</Badge></span>
      </nav>
      {sp.get('report') !== '1' && (
        <p className="page-intro" style={{ margin: 0 }}>
          <b>{PARTNER.name}</b> · portfolio programme for sponsors, insurers and groups: {cos.length} companies ({cos.filter((c) => c.demoId).length} on full HexaView tenants, the rest via HexaInt outside-in and questionnaires). {INTRO[section]}
        </p>
      )}
      <Body key={section} />
    </>
  );
}
