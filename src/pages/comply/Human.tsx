import { Badge, Callout, KpiStrip } from '../../components/ui';
import { MODULE_BY_ID } from '../../modules/registry';
import { tenantName } from '../../data/customers';
import { emailGateway, identitySource } from '../../data/modules/human';
import { fmtNum } from '../../lib/format';
import { HrProvider, useHr, HR_SECTIONS, riskColor } from './human/state';
import { Overview } from './human/Overview';
import { Phishing } from './human/Phishing';
import { Training } from './human/Training';
import { Risky } from './human/Risky';
import { Culture } from './human/Culture';
import './human/human.css';

const tone = MODULE_BY_ID.comply.tone;

export default function ComplyHuman() {
  return (
    <HrProvider>
      <Workspace />
    </HrProvider>
  );
}

function Workspace() {
  const { c, tenantId, ov, users, learners, camps, platform, pols, section, go } = useHr();
  const src = platform.name;
  const count: Record<string, number | undefined> = { phishing: camps.length, training: learners.length, risky: users.length, culture: pols.length };

  return (
    <>
      <p className="page-intro">
        The people side of the Resilience Index for <b>{c.name}</b> · {tenantName(c, tenantId)}: phishing simulations and training from {src}, report-button telemetry from {emailGateway(c)}, MFA and privilege from {identitySource(c)}, and real incidents from HexaSOC, combined into one human risk score.
      </p>
      {platform.stale && (
        <Callout kind="warn">Stale: {src} last synced {Math.round(platform.lastSyncMin / 60)} h ago{platform.note ? ` · ${platform.note}` : ''}. Figures below are from the last successful sync; awareness evidence for the mapped controls is marked stale, not zero.</Callout>
      )}

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Human risk', hint: 'lower is better', value: ov.score, unit: '/100', delta: { text: `${ov.scoreDelta <= 0 ? '−' : '+'}${Math.abs(ov.scoreDelta)} in 3 months`, good: ov.scoreDelta <= 0 }, toneColor: riskColor(ov.score), onClick: () => go('overview'), source: `${src} · ${identitySource(c)} · HexaSOC` },
          { label: 'Click rate', hint: 'latest month', value: `${ov.clickRate}%`, unit: `${ov.submitRate}% creds`, toneColor: 'var(--bad)', onClick: () => go('phishing'), source: `${src} simulations` },
          { label: 'Report rate', value: `${ov.reportRate}%`, unit: `median ${ov.mttrMin} min`, toneColor: 'var(--good)', onClick: () => go('phishing'), source: `${emailGateway(c)} report button · ${src}` },
          { label: 'Report : click', value: ov.ratio.toFixed(1), unit: ov.ratio >= 3 ? 'healthy' : 'below 3.0 target', toneColor: ov.ratio >= 3 ? 'var(--good)' : 'var(--sev-medium)', onClick: () => go('phishing'), source: `${src} simulations` },
          { label: 'Training', hint: 'mandatory', value: `${ov.completion}%`, bar: ov.completion, toneColor: ov.completion >= 90 ? 'var(--good)' : 'var(--sev-medium)', onClick: () => go('training'), source: `${src} LMS` },
          { label: 'Overdue', value: fmtNum(learners.length), unit: 'learners', toneColor: 'var(--sev-high)', onClick: () => go('training', { view: 'overdue' }), source: `${src} LMS · HR feed` },
          { label: 'Risky users', value: users.length, unit: `${users.filter((u) => u.score >= 70).length} critical`, toneColor: 'var(--sev-critical)', onClick: () => go('risky'), source: `${src} · ${identitySource(c)} · HexaInt · HexaSOC` },
        ]}
      />

      <nav className="hr-subtabs" aria-label="Human risk sections">
        {HR_SECTIONS.map((s) => (
          <button key={s.id} type="button" className={`hr-subtab ${section === s.id ? 'on' : ''}`} onClick={() => section !== s.id && go(s.id)} aria-current={section === s.id ? 'page' : undefined}>
            {s.label}{count[s.id] !== undefined && <em>{count[s.id]}</em>}
          </button>
        ))}
        <span className="hr-subtabs-end"><Badge color={platform.stale ? 'var(--sev-medium)' : 'var(--good)'} dot>{src}</Badge></span>
      </nav>

      {section === 'overview' && <Overview />}
      {section === 'phishing' && <Phishing />}
      {section === 'training' && <Training />}
      {section === 'risky' && <Risky />}
      {section === 'culture' && <Culture />}
    </>
  );
}
