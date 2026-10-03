import { useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, Fingerprint, GraduationCap, MailWarning, UserCheck, Users } from 'lucide-react';
import { incidents } from '../../../data/modules/soc';
import { emailGateway, identitySource } from '../../../data/modules/human';
import { Card, Freshness, Ring, SevBadge, Sources } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { fmtAgo, fmtNum } from '../../../lib/format';
import { useHr, riskColor, riskLabel, pct } from './state';
import { Funnel } from './ui';

export function Overview() {
  const { c, tenantId, ov, depts, camps, users, courses, learners, platform, go } = useHr();
  const nav = useNavigate();
  const humanInc = useMemo(() => incidents(c, tenantId, 90).filter((i) => i.techniques.some((t) => t.startsWith('T1566') || t === 'T1657' || t === 'T1621' || t === 'T1204.002' || t === 'T1098')), [c, tenantId]);
  const last = camps.find((x) => x.status === 'Completed') ?? camps[0];
  const noMfa = users.filter((u) => u.mfa === 'None' || u.mfa === 'SMS').length;
  const repeat = users.filter((u) => u.clicks12m >= 3).length;
  const finance = depts.find((d) => /Finance|Payments|Revenue/.test(d.name));

  // Department view from the completed campaigns + training.
  const deptRows = depts.map((d) => {
    const res = camps.filter((x) => x.status === 'Completed').flatMap((x) => x.byDept.filter((b) => b.deptId === d.id));
    const sent = res.reduce((s, b) => s + b.sent, 0);
    const ccs = courses.filter((k) => k.mandatory && k.byDept[d.id] !== undefined);
    const comp = ccs.length ? Math.round(ccs.reduce((s, k) => s + k.byDept[d.id], 0) / ccs.length) : 0;
    return { d, click: pct(res.reduce((s, b) => s + b.clicked, 0), sent), report: pct(res.reduce((s, b) => s + b.reported, 0), sent), comp, risky: users.filter((u) => u.deptId === d.id).length };
  }).sort((a, b) => b.click - a.click);
  const maxClick = Math.max(1, ...deptRows.map((r) => r.click));
  const maxRisky = Math.max(1, ...deptRows.map((r) => r.risky));

  const comps = [
    { label: 'Simulation click rate', value: ov.clickRate, show: `${ov.clickRate}%`, bar: Math.min(100, ov.clickRate * 5), color: '#f8646f', onClick: () => go('phishing') },
    { label: 'Report rate', value: ov.reportRate, show: `${ov.reportRate}%`, bar: ov.reportRate, color: '#2dd4bf', onClick: () => go('phishing') },
    { label: 'Training completion', value: ov.completion, show: `${ov.completion}%`, bar: ov.completion, color: '#4f8cff', onClick: () => go('training') },
    { label: 'Risky users', value: users.length, show: fmtNum(users.length), bar: Math.min(100, (users.length / Math.max(1, ov.headcount)) * 2000), color: '#f5a83d', onClick: () => go('risky') },
    { label: 'Risky users without strong MFA', value: noMfa, show: fmtNum(noMfa), bar: users.length ? (noMfa / users.length) * 100 : 0, color: '#a07cfb', onClick: () => go('risky', { factor: 'mfa' }) },
  ];

  const actions = [
    { icon: <Fingerprint />, tone: '#a07cfb', title: `Enforce phishing-resistant MFA for ${noMfa} risky users`, sub: `${identitySource(c)} · HexaFabric Identity`, gain: '−6 risk', onClick: () => nav('/fabric/identity?filter=nomfa') },
    { icon: <UserCheck />, tone: '#f8646f', title: `Enrol ${repeat} repeat clickers in coaching`, sub: 'Three or more simulation clicks in 12 months', gain: '−4 risk', onClick: () => go('risky', { factor: 'repeat' }) },
    { icon: <GraduationCap />, tone: '#4f8cff', title: `Nudge ${learners.length} learners with overdue mandatory training`, sub: `${platform.name} reminders`, gain: '−3 risk', onClick: () => go('training', { view: 'overdue' }) },
    { icon: <MailWarning />, tone: '#f5a83d', title: `Run a payment-fraud simulation for ${finance?.name ?? 'finance'}`, sub: 'Highest real-world loss exposure; last tested over 60 days ago', gain: '−2 risk', onClick: () => go('phishing', { launch: '1', dept: finance?.id }) },
    { icon: <BookOpenCheck />, tone: '#2dd4bf', title: 'Complete your own assigned training in HexaComply Stream', sub: 'Training mode of the compliance workspace', gain: 'evidence', onClick: () => nav('/comply/caas?section=stream&mode=training') },
  ];

  return (
    <>
      <div className="grid g-2-1" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)' }}>
        <Card title="Human risk score" sub="Lower is better · the people pillar of the Resilience Index" actions={<Freshness minutes={platform.lastSyncMin} stale={platform.stale} label={platform.name} />}>
          <div className="hr-hero">
            <Ring value={ov.score} size={118} stroke={11} color={riskColor(ov.score)} sub={riskLabel(ov.score)} />
            <div className="hr-hero-main">
              <h4 style={{ color: riskColor(ov.score) }}>{ov.scoreDelta <= 0 ? `Down ${-ov.scoreDelta} in 3 months` : `Up ${ov.scoreDelta} in 3 months`}</h4>
              <p>Combines simulation behaviour, reporting, training and identity signals for {fmtNum(ov.headcount)} people. Contributes <b>{ov.riPillar}</b> to the people pillar of the Resilience Index.</p>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {comps.map((x) => (
              <button key={x.label} type="button" className="hr-comp" onClick={x.onClick} title="Click to open the records behind this number">
                <span>{x.label}</span>
                <span className="hr-track"><i style={{ width: `${Math.max(3, x.bar)}%`, background: x.color }} /></span>
                <b>{x.show}</b>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Phishing behaviour over 12 months" sub="Click and credential rates on the left axis, report and training rates on the right · click to open the campaigns">
          <Chart
            height={300}
            onClick={() => go('phishing')}
            option={{
              legend: { bottom: 0, textStyle: { fontSize: 10.5 } },
              grid: { left: 6, right: 10, top: 16, bottom: 32, containLabel: true },
              tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
              xAxis: { type: 'category', data: ov.months },
              yAxis: [{ type: 'value', splitNumber: 4, axisLabel: { formatter: '{value}%' } }, { type: 'value', max: 100, splitLine: { show: false }, axisLabel: { formatter: '{value}%' } }],
              series: [
                { name: 'Clicked', type: 'line', data: ov.clickSeries, smooth: true, symbolSize: 5, lineStyle: { width: 2.2, color: '#f8646f' }, itemStyle: { color: '#f8646f' }, areaStyle: { color: 'rgba(248,100,111,0.10)' } },
                { name: 'Entered credentials', type: 'line', data: ov.submitSeries, smooth: true, symbolSize: 4, lineStyle: { width: 1.8, color: '#f5a83d' }, itemStyle: { color: '#f5a83d' } },
                { name: 'Reported', type: 'line', yAxisIndex: 1, data: ov.reportSeries, smooth: true, symbolSize: 5, lineStyle: { width: 2.2, color: '#2dd4bf' }, itemStyle: { color: '#2dd4bf' } },
                { name: 'Training complete', type: 'line', yAxisIndex: 1, data: ov.completionSeries, smooth: true, symbol: 'none', lineStyle: { width: 1.6, type: 'dashed', color: '#4f8cff' }, itemStyle: { color: '#4f8cff' } },
              ],
            }}
          />
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="By department" sub="Completed simulations and mandatory training · click a department for its risky users">
          <div className="hr-dept head"><span>Department</span><span>Click rate</span><span>Report rate</span><span>Training</span><span>Risky users</span></div>
          {deptRows.map(({ d, click, report, comp, risky }) => (
            <button key={d.id} type="button" className="hr-dept" onClick={() => go('risky', { dept: d.id })}>
              <span><b>{d.name}</b><small>{fmtNum(d.headcount)} people</small></span>
              <span className="hr-cellbar"><em style={{ color: click > ov.clickRate * 1.2 ? 'var(--bad)' : undefined }}>{click}%</em><span className="hr-track"><i style={{ width: `${(click / maxClick) * 100}%`, background: '#f8646f' }} /></span></span>
              <span className="hr-cellbar"><em>{report}%</em><span className="hr-track"><i style={{ width: `${report}%`, background: '#2dd4bf' }} /></span></span>
              <span className="hr-cellbar"><em style={{ color: comp < 85 ? 'var(--sev-medium)' : undefined }}>{comp}%</em><span className="hr-track"><i style={{ width: `${comp}%`, background: '#4f8cff' }} /></span></span>
              <span className="hr-cellbar"><em>{risky}</em><span className="hr-track"><i style={{ width: `${(risky / maxRisky) * 100}%`, background: '#f5a83d' }} /></span></span>
            </button>
          ))}
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Latest completed simulation" sub={`${last.name} · ${last.channel}`} onClick={() => go('phishing', { id: last.id })}>
            <Funnel camp={last} />
            <div className="hr-note" style={{ marginTop: 8 }}>Report-to-click ratio <b>{(last.reported / Math.max(1, last.clicked)).toFixed(1)}</b> · median time to first report {last.medianReportMin} min</div>
          </Card>
          <Card title="What would lower human risk most" sub="Ranked by modelled effect on the score">
            {actions.map((a) => (
              <button key={a.title} type="button" className="hr-act" style={{ '--tone': a.tone } as CSSProperties} onClick={a.onClick}>
                <span className="hr-act-ico">{a.icon}</span>
                <span><b>{a.title}</b><span>{a.sub}</span></span>
                <span className="hr-act-gain">{a.gain}</span>
              </button>
            ))}
          </Card>
        </div>
      </div>

      <Card title="Where human risk became a real incident" count={humanInc.length} sub="HexaSOC incidents in the last 90 days that started with a person: phishing, MFA fatigue, help-desk social engineering, payment fraud · click to open" actions={<Users size={14} className="muted" />}>
        <div className="list">
          {humanInc.slice(0, 8).map((i) => (
            <button key={i.id} type="button" className="list-row" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--hairline-soft)', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => nav(`/soc/ir?id=${i.id}`)}>
              <span className="mono muted" style={{ fontSize: 11, minWidth: 80 }}>{i.id}</span>
              <span className="list-main"><b>{i.title}</b><span>{i.techniques.join(' · ')} · {i.status} · opened {fmtAgo(i.openedMin)}</span></span>
              <SevBadge sev={i.sev} />
            </button>
          ))}
          {!humanInc.length && <div className="empty">No people-initiated incidents in the last 90 days.</div>}
        </div>
        <div style={{ marginTop: 10 }}>
          <Sources items={[{ name: platform.name, status: platform.stale ? 'degraded' : 'healthy' }, { name: emailGateway(c) }, { name: identitySource(c) }, { name: 'HexaSOC incidents' }]} />
        </div>
      </Card>
    </>
  );
}
