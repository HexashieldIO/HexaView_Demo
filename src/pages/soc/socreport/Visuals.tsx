import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CustomerProfile } from '../../../data/types';
import { delta } from '../../../data/modules/reports';
import { SLA, type SocReportData, type SocSectionId } from '../../../data/modules/socReport';
import { PALETTE, SEV_HEX } from '../../../components/Chart';
import { Ring, Stacked } from '../../../components/ui';
import { fmtNum } from '../../../lib/format';
import { ChartLegend, HBar, RTile, SvgColumns, SvgLines } from '../../reports/parts';

const SOC_HEX = '#a07cfb';
const TEAL = '#2dd4bf';
const SEV_LIST = [
  { id: 'critical', label: 'Critical', color: SEV_HEX.critical },
  { id: 'high', label: 'High', color: SEV_HEX.high },
  { id: 'medium', label: 'Medium', color: SEV_HEX.medium },
  { id: 'low', label: 'Low', color: '#8593b4' },
] as const;
const LEVEL_COLOR = { full: TEAL, partial: SEV_HEX.medium, none: SEV_HEX.critical } as const;
const LEVEL_LABEL = { full: 'Covered', partial: 'Partial', none: 'Gap' } as const;

const fmtMin = (m: number) => (m >= 1440 ? `${Math.round((m / 1440) * 10) / 10} d` : m >= 120 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`);

/** Value against an SLA target: bar fills to the value, tick marks the target. */
function SlaBullet({ label, value, target, d, to, source }: { label: string; value: number; target: number; d?: ReturnType<typeof delta>; to: string; source: string }) {
  const nav = useNavigate();
  const max = Math.max(target * 1.25, value * 1.1);
  const ok = value <= target;
  return (
    <button type="button" className="socr-bullet" onClick={() => nav(to)} title={`Source: ${source} · click to open the records`}>
      <span className="socr-bullet-h">
        <span>{label}</span>
        <b style={{ color: ok ? 'var(--good)' : 'var(--bad)' }}>{value} min</b>
      </span>
      <span className="socr-bullet-track">
        <i style={{ width: `${(value / max) * 100}%`, background: ok ? TEAL : SEV_HEX.high }} />
        <em style={{ left: `${(target / max) * 100}%` }} />
      </span>
      <span className="socr-bullet-f">
        <span>SLA {target} min · {Math.round((value / target) * 100)}% of target</span>
        {d && <span className={d.flat ? 'flat' : d.good ? 'good' : 'bad'}>{d.text}</span>}
      </span>
    </button>
  );
}

/** Triage funnel: alerts down to confirmed true positives (log-scaled so every stage stays visible). */
function Funnel({ steps }: { steps: { label: string; value: number; color: string; to: string; source: string }[] }) {
  const nav = useNavigate();
  const lmax = Math.log10(Math.max(10, steps[0]?.value ?? 10) + 1);
  return (
    <div className="socr-funnel">
      {steps.map((s) => (
        <button key={s.label} type="button" onClick={() => nav(s.to)} title={`Source: ${s.source}`}>
          <span>{s.label}</span>
          <div><i style={{ width: `${Math.max(3, (Math.log10(s.value + 1) / lmax) * 100)}%`, background: s.color }} /></div>
          <b>{fmtNum(s.value)}</b>
        </button>
      ))}
    </div>
  );
}

function Tbl({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <table className="rep-table socr-table">
      <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Row({ to, children }: { to: string; children: ReactNode }) {
  const nav = useNavigate();
  return <tr className="socr-link" onClick={() => nav(to)} title="Open the record in HexaSOC">{children}</tr>;
}

export function SocSectionVisual({ id, data, compare, c }: { id: SocSectionId; data: SocReportData; compare: boolean; c: CustomerProfile }) {
  const { cur, prev, period, tools } = data;
  const dd = (a: number, b: number, hib: boolean, mode: 'pct' | 'pts' = 'pct') => (compare ? delta(a, b, hib, mode) : undefined);
  const labels = period.buckets.map((b) => b.label);
  const per = period.bucketUnit;
  const siemSrc = `${tools.siemShort} · HexaSOC alert ledger`;

  if (id === 'summary') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={fmtNum(cur.alerts)} label="Alerts triaged" d={dd(cur.alerts, prev.alerts, false)} to="/soc/mdr" source={siemSrc} />
          <RTile value={fmtNum(cur.incidents)} label="Incidents raised" d={dd(cur.incidents, prev.incidents, false)} to="/soc/ir?status=all" source="HexaSOC case store" />
          <RTile value={fmtNum(cur.truePositives)} label="True positives" color={SEV_HEX.high} d={dd(cur.truePositives, prev.truePositives, false)} to="/soc/ir?status=closed" source="HexaSOC case store" />
          <RTile value={`${cur.slaPct}%`} label="SLA met" color={TEAL} d={dd(cur.slaPct, prev.slaPct, true, 'pts')} to="/soc/mdr" source="HexaSOC SLA ledger" />
          <RTile value={`${cur.mttr} min`} label="Mean time to contain" color={SOC_HEX} d={dd(cur.mttr, prev.mttr, false)} to="/soc/ir?status=closed" source="HexaSOC SLA ledger" />
          <RTile value={`${cur.coverageEnd}%`} label="HexaMatrix coverage" color="#4f8cff" d={dd(cur.coverageEnd, prev.coverageEnd, true, 'pts')} to="/soc/attack" source="HexaMatrix coverage engine" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">From alert to confirmed threat</div>
          <Funnel steps={[
            { label: 'Alerts ingested', value: cur.alerts, color: '#68b1ff', to: '/soc/mdr', source: siemSrc },
            { label: 'Escalated to analysts', value: cur.escalated, color: SOC_HEX, to: '/soc/mdr', source: 'HexaSOC agent log' },
            { label: 'Incidents raised', value: cur.incidents, color: SEV_HEX.medium, to: '/soc/ir?status=all', source: 'HexaSOC case store' },
            { label: 'True positives', value: cur.truePositives, color: SEV_HEX.high, to: '/soc/ir?status=closed', source: 'HexaSOC case store' },
            { label: 'Critical', value: cur.sev.critical, color: SEV_HEX.critical, to: '/soc/ir?status=all&severity=critical', source: 'HexaSOC case store' },
          ]} />
        </div>
      </div>
    );
  }

  if (id === 'sla') {
    return (
      <div className="rep-vis">
        <div className="socr-bullets">
          <SlaBullet label="Mean time to detect (MTTD)" value={cur.mttd} target={SLA.mttd} d={dd(cur.mttd, prev.mttd, false)} to="/soc/mdr" source="HexaSOC SLA ledger" />
          <SlaBullet label="Mean time to acknowledge (MTTA)" value={cur.mtta} target={SLA.mtta} d={dd(cur.mtta, prev.mtta, false)} to="/soc/ir?status=all" source="HexaSOC SLA ledger" />
          <SlaBullet label="Mean time to contain (MTTR)" value={cur.mttr} target={SLA.mttr} d={dd(cur.mttr, prev.mttr, false)} to="/soc/ir?status=closed" source="HexaSOC SLA ledger" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Response times (minutes), per {per}</div>
          <SvgLines labels={labels} min={0} unit=" min" height={150} series={[
            { name: 'Contain', color: SEV_HEX.high, data: cur.s.mttr },
            { name: 'Ack', color: SOC_HEX, data: cur.s.mtta },
            { name: 'Detect', color: TEAL, data: cur.s.mttd },
          ]} />
        </div>
        <Tbl head={['Severity', 'Acknowledge SLA', 'Contain SLA', 'Median contain', 'SLA met']}>
          {cur.slaBySev.map((s) => (
            <Row key={s.sev} to={`/soc/ir?status=all&severity=${s.sev}`}>
              <td><span className="socr-dot" style={{ background: SEV_LIST.find((x) => x.id === s.sev)?.color }} />{s.sev[0].toUpperCase() + s.sev.slice(1)}</td>
              <td>{fmtMin(s.ack)}</td>
              <td>{fmtMin(s.contain)}</td>
              <td>{fmtMin(cur.containMin[s.sev])}</td>
              <td style={{ fontWeight: 700, color: s.met >= 99.5 ? 'var(--good)' : 'var(--sev-medium)' }}>{s.met}%</td>
            </Row>
          ))}
        </Tbl>
      </div>
    );
  }

  if (id === 'alerts') {
    const all = cur.bySource.map((s, i) => ({ name: s.name, value: s.value, data: cur.s.sources[i] })).sort((a, b) => b.value - a.value);
    const head = all.slice(0, 5);
    const rest = all.slice(5);
    const grouped = rest.length ? [...head, { name: `Other (${rest.length})`, value: rest.reduce((s, x) => s + x.value, 0), data: labels.map((_, i) => rest.reduce((s, x) => s + (x.data[i] ?? 0), 0)) }] : head;
    const src = grouped.map((s, i) => ({ ...s, color: i === 5 ? '#8593b4' : PALETTE[i % PALETTE.length] }));
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={fmtNum(cur.alerts)} label="Alerts ingested" d={dd(cur.alerts, prev.alerts, false)} to="/soc/mdr" source={siemSrc} />
          <RTile value={`${cur.autoPct}%`} label="Auto-triaged by agents" color={TEAL} d={dd(cur.autoPct, prev.autoPct, true, 'pts')} to="/ai/agents" source="HexaSOC agent log" />
          <RTile value={fmtNum(cur.escalated)} label="Escalated to analysts" color={SOC_HEX} d={dd(cur.escalated, prev.escalated, false)} to="/soc/mdr" source="HexaSOC agent log" />
          <RTile value={`${cur.fpRate}%`} label="False-positive rate" color={SEV_HEX.medium} d={dd(cur.fpRate, prev.fpRate, false, 'pts')} to="/soc/detection" source="HexaSOC case store" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Alerts by source tool, per {per}</div>
          <ChartLegend items={src.map((s) => ({ label: `${s.name} · ${fmtNum(s.value)}`, color: s.color }))} />
          <SvgColumns labels={labels} series={src.map((s) => ({ name: s.name, color: s.color, data: s.data }))} height={150} />
        </div>
        <div className="socr-split">
          <div className="rep-chart">
            <div className="rep-chart-title">Escalated alerts by verdict</div>
            <Stacked tall parts={[
              { value: cur.tpAlerts, color: SEV_HEX.high, label: 'True positive' },
              { value: cur.btpAlerts, color: TEAL, label: 'Benign true positive' },
              { value: cur.fpAlerts, color: SEV_HEX.medium, label: 'False positive' },
              { value: cur.undAlerts, color: '#8593b4', label: 'Undetermined' },
            ]} />
            <ChartLegend items={[
              { label: `True positive ${fmtNum(cur.tpAlerts)}`, color: SEV_HEX.high },
              { label: `Benign ${fmtNum(cur.btpAlerts)}`, color: TEAL },
              { label: `False positive ${fmtNum(cur.fpAlerts)}`, color: SEV_HEX.medium },
              { label: `Undetermined ${fmtNum(cur.undAlerts)}`, color: '#8593b4' },
            ]} />
          </div>
          <div className="rep-chart">
            <div className="rep-chart-title">Noise: false-positive rate (%), per {per}</div>
            <SvgLines labels={labels} series={[{ name: 'FP rate', color: SEV_HEX.medium, data: cur.s.fpRate }]} height={120} unit="%" />
          </div>
        </div>
      </div>
    );
  }

  if (id === 'incidents') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          {SEV_LIST.map((s) => (
            <RTile key={s.id} value={cur.sev[s.id]} label={`${s.label} raised`} color={s.color} d={dd(cur.sev[s.id], prev.sev[s.id], false)} to={`/soc/ir?status=all&severity=${s.id}`} source="HexaSOC case store" />
          ))}
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Incidents raised by severity, per {per}</div>
          <ChartLegend items={SEV_LIST.map((s) => ({ label: s.label, color: s.color }))} />
          <SvgColumns labels={labels} series={SEV_LIST.map((s) => ({ name: s.label, color: s.color, data: cur.s.raised[s.id] }))} height={140} />
        </div>
        <div className="rep-tiles">
          <RTile value={fmtNum(cur.closed)} label="Closed in period" color={TEAL} d={dd(cur.closed, prev.closed, true)} to="/soc/ir?status=closed" source="HexaSOC case store" />
          <RTile value={cur.openEnd} label="Open at period end" color={SEV_HEX.medium} d={dd(cur.openEnd, prev.openEnd, false)} to="/soc/ir?status=open" source="HexaSOC case store" />
          <RTile value={fmtMin(cur.containMin.critical)} label="Median contain · critical" color={SEV_HEX.critical} d={dd(cur.containMin.critical, prev.containMin.critical, false)} to="/soc/ir?status=closed&severity=critical" source={`HexaSOC case store${tools.edr ? ` · ${tools.edrShort}` : ''}`} />
          <RTile value={fmtMin(cur.containMin.high)} label="Median contain · high" color={SEV_HEX.high} d={dd(cur.containMin.high, prev.containMin.high, false)} to="/soc/ir?status=closed&severity=high" source="HexaSOC case store" />
        </div>
        <div className="rep-sublabel">Most significant incidents</div>
        <div className="socr-incs">
          {data.topIncidents.map((t) => <IncRow key={t.inc.id} t={t} />)}
        </div>
      </div>
    );
  }

  if (id === 'threats') {
    const tmax = Math.max(1, ...data.tactics.map((t) => t.count));
    const gain = Math.round((cur.coverageEnd - cur.coverageStart) * 10) / 10;
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={`${cur.coverageEnd}%`} label="HexaMatrix coverage" color="#4f8cff" d={dd(cur.coverageEnd, prev.coverageEnd, true, 'pts')} to="/soc/attack" source="HexaMatrix coverage engine" />
          <RTile value={`${gain >= 0 ? '+' : ''}${gain} pts`} label="Coverage change in period" color={TEAL} to="/soc/attack" source="HexaMatrix coverage engine" />
          <RTile value={data.matrix.full} label="Techniques fully covered" color={TEAL} to="/soc/attack?coverage=full" source="HexaMatrix coverage engine" />
          <RTile value={data.matrix.none} label="Techniques with no coverage" color={SEV_HEX.critical} to="/soc/attack?coverage=none" source="HexaMatrix coverage engine" />
        </div>
        <div className="socr-split">
          <div className="rep-chart">
            <div className="rep-chart-title">Incidents by ATT&CK tactic</div>
            <div className="socr-hbars">
              {data.tactics.map((t) => <HBar key={t.name} label={t.name} value={t.count} max={tmax} color={t.color} display={t.count} />)}
            </div>
          </div>
          <div className="rep-chart">
            <div className="rep-chart-title">Sector actors: share of known techniques covered</div>
            <div className="socr-hbars">
              {data.actors.map((a) => <HBar key={a.name} label={a.name} value={a.pct} max={100} color={a.pct >= 70 ? TEAL : a.pct >= 50 ? SEV_HEX.medium : SEV_HEX.critical} display={`${a.pct}%`} />)}
            </div>
          </div>
        </div>
        <Tbl head={['Technique', 'Tactic', 'Incidents', 'HexaMatrix']}>
          {data.techniques.map((t) => (
            <Row key={t.id} to={`/soc/attack?coverage=${t.level}`}>
              <td><span className="mono socr-tid">{t.id}</span> {t.name}</td>
              <td>{t.tactic}</td>
              <td className="num">{t.count}</td>
              <td><span className="socr-pill" style={{ ['--pc' as string]: LEVEL_COLOR[t.level] }}>{LEVEL_LABEL[t.level]}</span></td>
            </Row>
          ))}
        </Tbl>
      </div>
    );
  }

  if (id === 'hunting') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={cur.huntsRun} label="Hunts run" d={dd(cur.huntsRun, prev.huntsRun, true)} to="/soc/hunting" source="HexaSOC hunt ledger" />
          <RTile value={cur.huntFindings} label="Findings" color={SEV_HEX.medium} d={dd(cur.huntFindings, prev.huntFindings, false)} to="/soc/hunting" source="HexaSOC hunt ledger" />
          <RTile value={cur.huntDetections} label="New detections from hunts" color={TEAL} d={dd(cur.huntDetections, prev.huntDetections, true)} to="/soc/detection" source="HexaSOC detection pipeline" />
        </div>
        <Tbl head={['Hunt', 'Hypothesis', 'Actor', 'Outcome']}>
          {data.huntList.map((h) => (
            <Row key={h.id} to="/soc/hunting">
              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</td>
              <td>{h.hypothesis}</td>
              <td>{h.actor}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{h.status === 'active' ? `Active · ${h.progress}%` : h.outcome}</td>
            </Row>
          ))}
        </Tbl>
      </div>
    );
  }

  if (id === 'detection') {
    const life = [
      { label: 'Added', value: cur.rulesAdded, color: TEAL },
      { label: 'Tuned', value: cur.rulesTuned, color: SOC_HEX },
      { label: 'Retired', value: cur.rulesRetired, color: '#8593b4' },
    ];
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={cur.rulesAdded} label="Rules added" color={TEAL} d={dd(cur.rulesAdded, prev.rulesAdded, true)} to="/soc/detection" source="HexaSOC detection pipeline (CI)" />
          <RTile value={cur.rulesTuned} label="Rules tuned" color={SOC_HEX} d={dd(cur.rulesTuned, prev.rulesTuned, true)} to="/soc/detection" source="HexaSOC detection pipeline (CI)" />
          <RTile value={cur.rulesRetired} label="Rules retired" color="#8593b4" to="/soc/detection" source="HexaSOC detection pipeline (CI)" />
          <RTile value={cur.noisyFixed} label="Noisy rules fixed" color={SEV_HEX.medium} d={dd(cur.noisyFixed, prev.noisyFixed, true)} to="/soc/detection" source={`${tools.siemShort} rule analytics`} />
        </div>
        <div className="socr-split">
          <div className="rep-chart">
            <div className="rep-chart-title">Rule changes in the period</div>
            <Stacked tall parts={life} />
            <ChartLegend items={life.map((l) => ({ label: `${l.label} ${l.value}`, color: l.color }))} />
            <div className="socr-cov">
              <span>Coverage</span>
              <div><i style={{ width: `${cur.coverageStart}%`, background: '#68b1ff' }} /><i style={{ width: `${cur.coverageEnd}%`, background: TEAL }} /></div>
              <b>{cur.coverageStart}% → {cur.coverageEnd}%</b>
            </div>
          </div>
          <div className="rep-chart">
            <div className="rep-chart-title">Noisy rules tuned (false-positive rate before tuning)</div>
            <Tbl head={['Rule', 'Platform', 'FP']}>
              {data.noisyRules.map((r) => (
                <Row key={r.name} to="/soc/detection">
                  <td>{r.name.replace(/ \(HexaSOC\)$/, '')}</td>
                  <td>{r.platform}</td>
                  <td className="num" style={{ color: 'var(--sev-medium)', fontWeight: 700 }}>{r.fpPct}%</td>
                </Row>
              ))}
            </Tbl>
          </div>
        </div>
      </div>
    );
  }

  if (id === 'automation') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={fmtNum(cur.pbRuns)} label="Playbook runs" d={dd(cur.pbRuns, prev.pbRuns, true)} to="/soc/playbooks?view=runs" source="HexaSOC playbook engine" />
          <RTile value={fmtNum(cur.pbAutoClosed)} label="Auto-closed" color={TEAL} d={dd(cur.pbAutoClosed, prev.pbAutoClosed, true)} to="/soc/playbooks?view=runs&status=success" source="HexaSOC playbook engine" />
          <RTile value={`${fmtNum(cur.hoursSaved)} h`} label="Analyst hours saved" color={SOC_HEX} d={dd(cur.hoursSaved, prev.hoursSaved, true)} to="/soc/playbooks" source="HexaSOC playbook engine" />
          <RTile value={fmtNum(cur.approvals)} label="Human approvals" color={SEV_HEX.medium} d={dd(cur.approvals, prev.approvals, false)} to="/soc/playbooks?view=runs&status=awaiting" source="HexaView action broker" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Playbook runs per {per}</div>
          <SvgColumns labels={labels} series={[{ name: 'Runs', color: SOC_HEX, data: cur.s.pbRuns }]} height={120} />
        </div>
        <Tbl head={['Playbook (Playbook Builder)', 'Runs', 'Auto-closed', 'Hours saved', 'Approvers']}>
          {data.topPlaybooks.map((p) => (
            <Row key={p.id} to={`/soc/playbooks?view=editor&pb=${p.id}`}>
              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
              <td className="num">{fmtNum(p.runs)}</td>
              <td className="num">{p.autoPct}%</td>
              <td className="num">{fmtNum(p.savedH)}</td>
              <td className="num">{p.approvals || 'None'}</td>
            </Row>
          ))}
        </Tbl>
      </div>
    );
  }

  if (id === 'posture') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={cur.vulnsCritical} label="Critical vulnerabilities" color={SEV_HEX.critical} d={dd(cur.vulnsCritical, prev.vulnsCritical, false)} to="/soc/endpoint?severity=critical" source={`${tools.edrShort} vulnerability management`} />
          <RTile value={cur.vulnsHigh} label="High vulnerabilities" color={SEV_HEX.high} d={dd(cur.vulnsHigh, prev.vulnsHigh, false)} to="/soc/endpoint?severity=high" source={`${tools.edrShort} vulnerability management`} />
          <RTile value={cur.kev} label="On CISA KEV" color={SEV_HEX.critical} d={dd(cur.kev, prev.kev, false)} to="/soc/endpoint?severity=critical" source="CISA KEV · HexaInt" />
          <RTile value={fmtNum(cur.exposedDevices)} label="High-exposure devices" color={SEV_HEX.medium} d={dd(cur.exposedDevices, prev.exposedDevices, false)} to="/soc/entities?exposure=High" source={tools.edrShort} />
        </div>
        <div className="socr-rings">
          <PostureRing value={cur.secureScore} label="Secure Score" sub={compare ? delta(cur.secureScore, prev.secureScore, true, 'pts').text : 'of 100'} color={SOC_HEX} to="/soc/recommendations" source={`${tools.edrShort} Secure Score`} />
          <PostureRing value={cur.mfaPct} unit="%" label="MFA coverage" sub={`${fmtNum(cur.mfaGaps)} accounts without`} color={TEAL} to="/soc/identity" source={tools.idpShort} />
          <div className="rep-tiles c2" style={{ flex: 1 }}>
            <RTile value={fmtNum(cur.riskySignIns)} label="Risky sign-ins investigated" color={SEV_HEX.high} d={dd(cur.riskySignIns, prev.riskySignIns, false)} to="/soc/identity" source={tools.idpShort} />
            <RTile value={fmtNum(cur.caFailed)} label="Conditional Access failures" color={SEV_HEX.medium} to="/soc/identity?ca=Failed" source={tools.idpShort} />
          </div>
        </div>
      </div>
    );
  }

  if (id === 'recommendations') {
    const PC = { P1: SEV_HEX.critical, P2: SEV_HEX.medium, P3: '#68b1ff' } as const;
    return (
      <Tbl head={['', 'Action', 'Owner', 'Due']}>
        {data.actions.map((a, i) => (
          <Row key={i} to={a.to}>
            <td><span className="socr-pill" style={{ ['--pc' as string]: PC[a.priority] }}>{a.priority}</span></td>
            <td><b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.title}</b><div className="socr-why">{a.why}</div></td>
            <td>{a.owner}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{a.due}</td>
          </Row>
        ))}
      </Tbl>
    );
  }

  if (id === 'analysts') {
    const max = Math.max(1, ...data.analysts.map((a) => a.cases));
    return (
      <div className="rep-vis">
        <div className="rep-chart">
          <div className="rep-chart-title">Cases handled per analyst</div>
          <div className="socr-hbars wide">
            {data.analysts.map((a, i) => <HBar key={a.name} label={a.name} value={a.cases} max={max} color={PALETTE[i % PALETTE.length]} display={fmtNum(a.cases)} />)}
          </div>
        </div>
        <Tbl head={['Analyst', 'Cases', 'Escalated to customer', 'Median handling']}>
          {data.analysts.map((a) => (
            <Row key={a.name} to="/soc/ir?status=all">
              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</td>
              <td className="num">{fmtNum(a.cases)}</td>
              <td className="num">{a.escalations}</td>
              <td className="num">{a.medianMin} min</td>
            </Row>
          ))}
        </Tbl>
        <p className="socr-why">Escalations go to {c.people.socLead.name} ({c.people.socLead.role}).</p>
      </div>
    );
  }
  return null;
}

function PostureRing({ value, label, sub, color, to, source, unit = '' }: { value: number; label: string; sub: string; color: string; to: string; source: string; unit?: string }) {
  const nav = useNavigate();
  return (
    <button type="button" className="socr-ring" onClick={() => nav(to)} title={`Source: ${source}`}>
      <Ring value={value} size={78} stroke={8} color={color} label={`${value}${unit}`} />
      <span><b>{label}</b><small>{sub}</small></span>
    </button>
  );
}

function IncRow({ t }: { t: SocReportData['topIncidents'][number] }) {
  const nav = useNavigate();
  const sev = SEV_LIST.find((s) => s.id === t.inc.sev);
  return (
    <button type="button" className="socr-inc" onClick={() => nav(`/soc/ir?status=all&id=${t.inc.id}`)} title="Source: HexaSOC case store · click to open the incident" style={{ ['--pc' as string]: sev?.color ?? '#8593b4' }}>
      <span className="socr-inc-h">
        <span className="mono">{t.inc.id}</span>
        <span className="socr-pill">{sev?.label ?? t.inc.sev}</span>
        <span className="socr-inc-tac">{t.tactic}</span>
        <span className="socr-inc-st">{t.inc.status === 'closed' ? 'Closed' : t.inc.status}</span>
      </span>
      <b>{t.inc.title}</b>
      <span className="socr-why">{t.narrative}</span>
    </button>
  );
}
