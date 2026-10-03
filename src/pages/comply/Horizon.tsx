import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { KpiStrip, Badge } from '../../components/ui';
import { scopedConnectors, tenantName } from '../../data/customers';
import { horizonTotals } from '../../data/modules/horizon';
import { fmtMoney, fmtNum } from '../../lib/format';
import { HorizonProvider, useHorizon, HZ_SECTIONS, HZ_TONE, type HzSection } from './horizon/state';
import Timeline from './horizon/Timeline';
import Impact from './horizon/Impact';
import Feed from './horizon/Feed';
import Board from './horizon/Board';

const BODY: Record<HzSection, ComponentType> = { timeline: Timeline, impact: Impact, feed: Feed, board: Board };
const IDS = new Set<string>(HZ_SECTIONS.map((s) => s.id));
const SRC = 'HexaShield regulatory intelligence · HexaComply control mapping';

function Body() {
  const { customer: c, tenantId } = useApp();
  const { regs } = useHorizon();
  const [sp, setSp] = useSearchParams();
  const raw = sp.get('section');
  const section: HzSection = raw && IDS.has(raw) ? (raw as HzSection) : 'timeline';
  const Section = BODY[section];
  const t = horizonTotals(regs);
  const go = (s: HzSection, extra: Record<string, string> = {}) => setSp(new URLSearchParams({ section: s, ...extra }));
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const jurs = Array.from(new Set(regs.map((r) => r.jur)));

  return (
    <>
      <nav className="hz-subtabs" aria-label="Regulatory horizon sections">
        {HZ_SECTIONS.map((s) => (
          <button key={s.id} type="button" className={`hz-subtab ${section === s.id ? 'on' : ''}`} onClick={() => section !== s.id && go(s.id)} aria-current={section === s.id ? 'page' : undefined}>
            {s.label}
            {s.id === 'feed' && t.toAssess > 0 && <em>{t.toAssess}</em>}
          </button>
        ))}
        <span className="hz-subtabs-end"><Badge color={HZ_TONE} dot>Horizon scanning: HexaShield analysts</Badge></span>
      </nav>

      {section !== 'board' && (
        <p className="page-intro" style={{ margin: 0 }}>
          <b>{c.name}</b> · {tenantName(c, tenantId)}: {regs.length} upcoming and changing regulations across {jurs.join(', ')}, mapped to {c.frameworks.length} frameworks in {grc && !grc.product.includes('HexaComply') ? `${grc.vendor} ${grc.product} and ` : ''}HexaComply. Costs in {c.currency}; dates hedged as expected where not yet fixed.
        </p>
      )}

      <KpiStrip
        toneColor={HZ_TONE}
        items={[
          { label: 'Regulations tracked', value: t.tracked, hint: `${jurs.length} jurisdictions`, onClick: () => go('timeline'), source: SRC },
          { label: 'Apply within 12 months', value: t.next12, hint: `${t.applying} applying now`, onClick: () => go('timeline', { window: '12' }), source: SRC },
          { label: 'Open gaps', value: fmtNum(t.gaps), hint: 'controls', onClick: () => go('impact', { sort: 'gaps' }), source: 'HexaComply control status' },
          { label: 'Cost to close (12 m)', value: fmtMoney(t.cost12, c.currency), hint: `${fmtNum(t.effort)} person-days total`, onClick: () => go('board'), source: 'HexaComply effort model · blended rates' },
          { label: 'Readiness', value: t.readiness, unit: '%', bar: t.readiness, onClick: () => go('impact', { sort: 'readiness' }), source: 'HexaComply control status (weighted by controls)' },
          { label: 'Updates to assess', value: t.toAssess, hint: 'change feed', delta: t.toAssess ? { text: 'new this fortnight', good: false } : undefined, onClick: () => go('feed', { status: 'new' }), source: SRC },
        ]}
      />
      <Section key={section} />
    </>
  );
}

export default function ComplyHorizon() {
  const { customer: c, tenantId } = useApp();
  return (
    <HorizonProvider key={`${c.id}-${tenantId}`}>
      <Body />
    </HorizonProvider>
  );
}
