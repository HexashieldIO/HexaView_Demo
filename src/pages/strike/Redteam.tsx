import { useMemo, useState, type CSSProperties } from 'react';
import { Swords, Gem, Check, X } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { tenantName } from '../../data/customers';
import { redCampaigns, edrName, siemName, type RedCampaign, type StageOutcome, type KillChainStep } from '../../data/modules/strike';
import { RecordsDrawer } from './parts';
import { TECHNIQUE_BY_ID } from '../../data/reference';
import { Card, KpiStrip, Badge, Btn, KV, SectionLabel, Callout, MiniStat, Bar } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { fmtDur } from '../../lib/format';
import './strike.css';

const tone = MODULE_BY_ID.strike.tone;
const OUTCOME_COLOR: Record<StageOutcome, string> = { achieved: 'var(--bad)', detected: '#68b1ff', blocked: 'var(--good)' };
const OUTCOME_LABEL: Record<StageOutcome, string> = { achieved: 'Achieved', detected: 'Detected', blocked: 'Blocked' };

export default function StrikeRedteam() {
  const { customer: c } = useApp();
  const campaigns = useMemo(() => redCampaigns(c), [c]);
  const [sel, setSel] = useState<RedCampaign | null>(null);
  const [steps, setSteps] = useState<{ title: string; rows: (KillChainStep & { campaign: string })[] } | null>(null);
  const [campList, setCampList] = useState<{ title: string; rows: RedCampaign[] } | null>(null);
  const allSteps = campaigns.flatMap((cp) => cp.steps.map((st) => ({ ...st, campaign: cp.name })));
  const SRC = 'HexaStrike operator logs · ' + siemName(c) + ' · ' + edrName(c);

  const isPreview = c.services.redteam === 'available';
  const crownJewels = c.vocab.crownJewels;

  const totalSteps = campaigns.reduce((s, cp) => s + cp.steps.length, 0);
  const detectedOrBlocked = campaigns.reduce((s, cp) => s + cp.steps.filter((st) => st.outcome !== 'achieved').length, 0);
  const ttds = campaigns.flatMap((cp) => cp.steps.map((s) => s.ttdMin).filter((x): x is number => x !== undefined));
  const medianTtd = ttds.length ? ttds.sort((a, b) => a - b)[Math.floor(ttds.length / 2)] : 0;
  const reached = campaigns.filter((cp) => cp.crownJewelReached).length;

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · objective-based, intelligence-led adversary emulation against agreed goals, with a kill-chain timeline, time-to-detect and crown-jewel outcomes.
      </p>

      {isPreview && (
        <Callout kind="info" color={tone}>
          <b>Red Teaming is available on your plan but not yet engaged.</b> The view below is a representative preview for {c.sector}; engage HexaStrike to run a scoped, safety-gated campaign.
        </Callout>
      )}

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Campaigns', value: campaigns.length, toneColor: tone, onClick: () => setCampList({ title: 'Red-team campaigns', rows: campaigns }), source: 'HexaStrike campaign register' },
          { label: 'Kill-chain stages', value: totalSteps, toneColor: tone, onClick: () => setSteps({ title: 'All kill-chain stages', rows: allSteps }), source: SRC },
          { label: 'Detected or blocked', value: `${Math.round((detectedOrBlocked / Math.max(1, totalSteps)) * 100)}%`, bar: Math.round((detectedOrBlocked / Math.max(1, totalSteps)) * 100), toneColor: 'var(--good)', onClick: () => setSteps({ title: 'Stages detected or blocked', rows: allSteps.filter((x) => x.outcome !== 'achieved') }), source: SRC },
          { label: 'Median time to detect', value: fmtDur(medianTtd), toneColor: 'var(--sev-medium)', onClick: () => setSteps({ title: 'Stages with a time to detect', rows: allSteps.filter((x) => x.ttdMin !== undefined) }), source: siemName(c) + ' alert timestamps' },
          { label: 'Crown jewels reached', value: `${reached}/${campaigns.length}`, toneColor: reached ? 'var(--bad)' : 'var(--good)', onClick: () => setCampList({ title: 'Campaigns that reached a crown jewel', rows: campaigns.filter((x) => x.crownJewelReached) }), source: 'HexaStrike objective scorecard' },
          { label: 'Objectives met', value: campaigns.reduce((s, cp) => s + cp.objectivesMet, 0), toneColor: tone, onClick: () => setSteps({ title: 'Stages the attacker achieved', rows: allSteps.filter((x) => x.outcome === 'achieved') }), source: 'HexaStrike objective scorecard' },
        ]}
      />

      {campaigns.map((cp) => (
        <Card
          key={cp.id}
          title={cp.name}
          sub={`${cp.framework} · ${tenantName(c, cp.tenantId)} · ${cp.daysAgo}d ago`}
          actions={<Badge color={cp.status === 'Complete' ? 'var(--good)' : cp.status === 'Debrief' ? 'var(--sev-medium)' : tone} dot>{cp.status}</Badge>}
        >
          <Callout kind="info" color={tone}><b>Objective:</b> {cp.objective}</Callout>

          <div className="grid g-2-1" style={{ marginTop: 12 }}>
            <div>
              <SectionLabel>Kill-chain timeline</SectionLabel>
              <div className="strike-kill">
                {cp.steps.map((st, i) => {
                  const tech = TECHNIQUE_BY_ID[st.technique];
                  return (
                    <div key={i} className="strike-stage">
                      <div>
                        <div className="strike-phase">{st.phase}</div>
                        <div className="t-sub mono">{st.technique}{tech ? ` · ${tech.name}` : ''}</div>
                      </div>
                      <div>
                        <div className="row between">
                          <span style={{ fontSize: 12.5 }}>{st.action}</span>
                          <span className="strike-outcome" style={{ background: OUTCOME_COLOR[st.outcome] }}>{OUTCOME_LABEL[st.outcome]}</span>
                        </div>
                        {st.ttdMin !== undefined && <div className="t-sub">Time to detect: {fmtDur(st.ttdMin)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Objectives scorecard</SectionLabel>
              <div className="strike-scorecard">
                {Array.from({ length: cp.objectivesTotal }).map((_, i) => {
                  const met = i < cp.objectivesMet;
                  return (
                    <div key={i} className="strike-obj">
                      <span className="strike-tick" style={{ background: met ? 'var(--bad)' : 'var(--good)' }}>{met ? <X size={10} /> : <Check size={10} />}</span>
                      <span>{met ? 'Attacker objective achieved' : 'Objective defended'} #{i + 1}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mini-stats" style={{ marginTop: 12 }}>
                <MiniStat value={cp.crownJewelReached ? 'Reached' : 'Held'} label="Crown jewel" color={cp.crownJewelReached ? 'var(--bad)' : 'var(--good)'} />
                <MiniStat value={`${cp.objectivesMet}/${cp.objectivesTotal}`} label="Attacker objectives" />
              </div>
              <div style={{ marginTop: 10 }}><Btn sm color={tone} onClick={() => setSel(cp)}>Debrief &amp; recommendations</Btn></div>
            </div>
          </div>
        </Card>
      ))}

      <Card title="Crown jewels in scope" sub="Assets the campaign objectives target">
        <div className="grid g3">
          {crownJewels.map((j, i) => {
            const touched = campaigns.some((cp) => cp.crownJewelReached) && i === 0;
            return (
              <div key={j} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span className="ico-box" style={{ '--tone': touched ? 'var(--bad)' : tone } as CSSProperties}><Gem /></span>
                <div>
                  <b style={{ fontSize: 12.5 }}>{j}</b>
                  <div className="t-sub">{touched ? 'Reachability demonstrated' : 'Not reached in last campaign'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {steps && (
        <RecordsDrawer
          title={steps.title}
          rows={steps.rows}
          source={[SRC]}
          onClose={() => setSteps(null)}
          columns={[
            { key: 'c', header: 'Campaign', render: (x) => x.campaign },
            { key: 'p', header: 'Stage', render: (x) => (<><div className="t-main">{x.phase}</div><div className="t-sub mono">{x.technique} · {x.techniqueName}</div></>) },
            { key: 'a', header: 'Action', render: (x) => x.action },
            { key: 'o', header: 'Outcome', render: (x) => <span className="strike-outcome" style={{ background: OUTCOME_COLOR[x.outcome] }}>{OUTCOME_LABEL[x.outcome]}</span> },
            { key: 't', header: 'Time to detect', align: 'right', sort: (x) => x.ttdMin ?? 9999, render: (x) => x.ttdMin !== undefined ? fmtDur(x.ttdMin) : '—' },
          ]}
        />
      )}
      {campList && (
        <RecordsDrawer
          title={campList.title}
          rows={campList.rows}
          source={['HexaStrike campaign register']}
          onClose={() => setCampList(null)}
          onRow={(cp) => { setCampList(null); setSel(cp); }}
          columns={[
            { key: 'n', header: 'Campaign', render: (cp) => (<><div className="t-main">{cp.name}</div><div className="t-sub">{cp.objective}</div></>) },
            { key: 'f', header: 'Framework', render: (cp) => cp.framework },
            { key: 'o', header: 'Objectives met', align: 'right', render: (cp) => `${cp.objectivesMet}/${cp.objectivesTotal}` },
          ]}
        />
      )}

      {sel && (
        <Drawer
          wide
          title={`${sel.name}: debrief`}
          sub={sel.framework}
          icon={<span className="ico-box" style={{ '--tone': tone } as CSSProperties}><Swords /></span>}
          onClose={() => setSel(null)}
          footer={<Btn primary color={tone} onClick={() => setSel(null)}>Close</Btn>}
        >
          <KV
            rows={[
              ['Objective', sel.objective],
              ['Framework', sel.framework],
              ['Tenant', tenantName(c, sel.tenantId)],
              ['Status', <Badge color={sel.status === 'Complete' ? 'var(--good)' : 'var(--sev-medium)'} dot>{sel.status}</Badge>],
              ['Objectives met by attacker', `${sel.objectivesMet} of ${sel.objectivesTotal}`],
              ['Crown jewel reached', sel.crownJewelReached ? <Badge color="var(--bad)" dot>Yes</Badge> : 'No'],
            ]}
          />
          <SectionLabel>Detection performance</SectionLabel>
          <div className="stack" style={{ gap: 6 }}>
            {sel.steps.map((s, i) => (
              <div key={i} className="row" style={{ fontSize: 12, gap: 8 }}>
                <span style={{ minWidth: 100, color: 'var(--text-muted)' }}>{s.phase}</span>
                <span style={{ flex: 1 }}>{s.action}</span>
                <span className="strike-outcome" style={{ background: OUTCOME_COLOR[s.outcome] }}>{OUTCOME_LABEL[s.outcome]}</span>
              </div>
            ))}
          </div>
          <SectionLabel>Recommendations</SectionLabel>
          <ul className="secondary" style={{ fontSize: 12.5, paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
            <li>Tighten detection on the earliest achieved stage to cut time-to-detect.</li>
            <li>Validate the newly tuned rules in the next purple-team sprint, then close the loop.</li>
            <li>Review brokered access paths to the crown jewels named above.</li>
          </ul>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <MiniStat value={`${sel.steps.filter((s) => s.outcome === 'blocked').length}`} label="Blocked" color="var(--good)" />
            <MiniStat value={`${sel.steps.filter((s) => s.outcome === 'detected').length}`} label="Detected" color="#68b1ff" />
            <MiniStat value={`${sel.steps.filter((s) => s.outcome === 'achieved').length}`} label="Achieved" color="var(--bad)" />
          </div>
          <div style={{ marginTop: 10 }}>
            <Bar value={Math.round((sel.steps.filter((s) => s.outcome !== 'achieved').length / sel.steps.length) * 100)} color="var(--good)" />
          </div>
        </Drawer>
      )}
    </>
  );
}
