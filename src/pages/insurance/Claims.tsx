import { useMemo, useState } from 'react';
import { Siren, Lock, Users, PlayCircle, CheckCircle2, AlertTriangle, Hand } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { scenarios, obligations, panel, vault, biTemplate, priorEvents, walkthrough, type PriorEvent, type WalkStep } from '../../data/modules/insurance';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Chip, Freshness, Sources, SectionLabel } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtAgo, fmtMoney, fmtNum } from '../../lib/format';
import { Intro, TenantNote, INS_TONE, INS_HEX, money } from './parts';
import { RecordsDrawer, scrollToId } from './viz';

const READY_COLOR: Record<WalkStep['ready'], string> = { ready: 'var(--good)', partial: 'var(--sev-medium)', manual: 'var(--text-muted)' };
const CLAIM_COLOR: Record<PriorEvent['claimed'], string> = { 'Claim paid': 'var(--good)', 'Below retention': 'var(--sev-info)', 'Notice of circumstances': 'var(--sev-medium)', 'No claim': 'var(--text-muted)', Open: 'var(--sev-high)' };

export default function InsuranceClaims() {
  const { customer: c, toast } = useApp();
  const sc = useMemo(() => scenarios(c).slice().sort((a, b) => b.ale - a.ale), [c]);
  const obl = obligations(c);
  const pnl = panel(c);
  const vlt = vault(c);
  const bi = biTemplate(c);
  const prior = priorEvents(c);
  const [scId, setScId] = useState(sc[0].id);
  const scenario = sc.find((s) => s.id === scId) ?? sc[0];
  const steps = walkthrough(c, scenario);
  const [step, setStep] = useState(0);
  const [ev, setEv] = useState<PriorEvent | null>(null);
  const [drill, setDrill] = useState(false);
  const [rec, setRec] = useState<null | 'ready' | 'vault' | 'paid' | 'panel'>(null);
  const siemK = c.connectors.find((k) => k.category === 'SIEM');
  const itsmK = c.connectors.find((k) => k.category === 'ITSM');

  const checklist = [...obl.map((o) => o.ready), ...pnl.map((p) => p.status === 'ready'), ...vlt.map((v) => v.ready), true];
  const readiness = Math.round((checklist.filter(Boolean).length / checklist.length) * 100);
  const stepsReady = steps.filter((s) => s.ready === 'ready').length;
  const paid = prior.reduce((s, p) => s + p.paidM, 0);
  const lost = prior.reduce((s, p) => s + p.lossM, 0);
  const tightest = obl.slice().sort((a, b) => a.hours - b.hours)[0];

  return (
    <>
      <Intro ids={[c.connectors.find((k) => k.category === 'SIEM')!.id, c.connectors.find((k) => k.category === 'EDR / XDR')!.id, c.connectors.find((k) => k.category === 'ITSM')!.id, 'c-hexacomply']}>
        What happens the day you need the policy: notification clocks, panel vendors, preserved evidence and business-interruption tracking, all prepared before the incident.
      </Intro>
      <TenantNote />

      <KpiStrip
        toneColor={INS_TONE}
        items={[
          { label: 'Claims readiness', value: `${readiness}%`, bar: readiness, delta: { text: `${checklist.length - checklist.filter(Boolean).length} items need action`, good: readiness >= 90 }, onClick: () => setRec('ready'), source: `HexaComply · ${itsmK?.product ?? 'ITSM'} · evidence vault` },
          { label: 'Notification clocks', value: obl.length, delta: { text: `Tightest: ${tightest.deadline.split(';')[0]}`, good: true }, onClick: () => scrollToId('ins-obligations'), source: 'HexaComply regulatory register · policy conditions' },
          { label: 'Panel vendors ready', value: pnl.filter((p) => p.status === 'ready').length, unit: `of ${pnl.length}`, onClick: () => setRec('panel'), source: `${c.insurance.carrier.split(' ')[0]} panel list · retainer records` },
          { label: 'Evidence sets preserved', value: vlt.filter((v) => v.ready).length, unit: `of ${vlt.length}`, delta: { text: `${fmtNum(vlt.reduce((s, v) => s + v.sizeTB, 0))} TB under hold-ready retention`, good: true }, onClick: () => setRec('vault'), source: vlt.map((v) => v.source?.name).filter(Boolean).slice(0, 4).join(' · ') },
          { label: 'Walkthrough steps ready', value: stepsReady, unit: `of ${steps.length}`, onClick: () => scrollToId('ins-walk'), source: `${siemK?.product ?? 'SIEM'} · HexaView claim playbook` },
          { label: 'Claims paid (5 yrs)', value: money(paid, c), delta: { text: `on ${money(lost, c)} of incident losses`, good: true }, onClick: () => setRec('paid'), source: `${itsmK?.product ?? 'ITSM'} incident records · ${c.insurance.broker} claims history` },
        ]}
      />

      <Card
        title={<><PlayCircle size={15} style={{ verticalAlign: -2, marginRight: 6 }} /><span id="ins-walk">If we had a claim today</span></>}
        sub="A simulated walkthrough: pick a scenario and see what HexaView already has ready at each step of the claim"
        actions={<Btn sm primary color={INS_TONE} onClick={() => setDrill(true)}>Schedule tabletop</Btn>}
      >
        <div className="chips" style={{ marginBottom: 12 }}>
          {sc.map((s) => (
            <Chip key={s.id} on={s.id === scId} onClick={() => { setScId(s.id); setStep(0); }} color={INS_TONE}>{s.name.split(' (')[0]}</Chip>
          ))}
        </div>
        <div className="grid g-3-2" style={{ gap: 18 }}>
          <div className="ins-steps">
            {steps.map((s, i) => (
              <button key={s.title} className={`ins-step ${i === step ? 'active' : ''}`} onClick={() => setStep(i)} style={{ background: i === step ? undefined : 'none', border: 0, borderBottom: '1px dashed var(--hairline-soft)', textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer', width: '100%' }}>
                <span className="t">{s.t}</span>
                <span className="d" style={{ background: READY_COLOR[s.ready], ['--tone' as string]: READY_COLOR[s.ready] }} />
                <span>
                  <b>{s.title}</b>
                  <span className="x">{s.artefact}</span>
                </span>
                <Badge color={READY_COLOR[s.ready]}>{s.ready === 'ready' ? 'Ready' : s.ready === 'partial' ? 'Partial' : 'Manual'}</Badge>
              </button>
            ))}
          </div>
          <div>
            <div className="section-label">Step {step + 1} of {steps.length} · {steps[step].t}</div>
            <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>{steps[step].title}</h3>
            <div className="ins-metric" style={{ fontSize: 13, fontWeight: 500 }}>{steps[step].has}</div>
            <div style={{ marginTop: 12 }}>
              {steps[step].ready === 'ready' && <Callout kind="good">Ready now: {steps[step].artefact.toLowerCase()} can be produced in one click.</Callout>}
              {steps[step].ready === 'partial' && <Callout kind="warn">Partly ready. Close the gap before renewal so this step is not the one an adjuster challenges.</Callout>}
              {steps[step].ready === 'manual' && <Callout>Human step, supported by everything compiled in the earlier steps.</Callout>}
            </div>
            <KV
              rows={[
                ['Scenario', scenario.name],
                ['Most likely loss', money(scenario.ml, c)],
                ['Policy response', scenario.cover],
                ['Expected recovery', `${Math.round(scenario.coveredPct * 100)}% after retention and sublimits`],
              ]}
            />
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <Btn sm ghost disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</Btn>
              <Btn sm color={INS_TONE} disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>Next step</Btn>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title={<><Siren size={15} style={{ verticalAlign: -2, marginRight: 6 }} /><span id="ins-obligations">Notification obligations</span></>} count={obl.length} sub="Policy notice conditions and the regulatory clocks that start with the same incident" flush>
          <DataTable
            rows={obl}
            rowKey={(r) => r.party}
            initialSort={{ key: 'h', dir: 'asc' }}
            columns={[
              { key: 'party', header: 'Notify', sort: (r) => r.party, render: (r) => (<><div className="t-main">{r.party}</div><div className="t-sub">{r.trigger}</div></>) },
              { key: 'h', header: 'Deadline', sort: (r) => r.hours, render: (r) => <span style={{ fontWeight: 600, color: r.hours <= 4 ? 'var(--sev-high)' : undefined }}>{r.deadline}</span> },
              { key: 'basis', header: 'Basis', render: (r) => <span className="t-sub">{r.basis}</span> },
              { key: 'ready', header: 'Template', sort: (r) => Number(r.ready), render: (r) => r.ready ? <Badge color="var(--good)" dot>Pre-drafted</Badge> : <Badge color="var(--sev-medium)" dot>Missing</Badge> },
            ]}
          />
        </Card>

        <Card title={<><Users size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Panel vendors</>} sub="Using non-panel vendors without consent can leave costs uninsured" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {pnl.map((p) => (
              <div key={p.role} className="list-row">
                {p.status === 'ready' ? <CheckCircle2 size={16} color="var(--good)" /> : <AlertTriangle size={16} color="var(--sev-medium)" />}
                <span className="list-main">
                  <b>{p.firm}</b>
                  <span>{p.role} · {p.engagement}</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge color={p.onPanel ? INS_TONE : 'var(--sev-medium)'}>{p.onPanel ? 'On panel' : 'Consent needed'}</Badge>
                  <span className="muted" style={{ fontSize: 10.5 }}>SLA {p.sla}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title={<><Lock size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Forensic evidence vault</>} sub="Immutable, hash-anchored sets that can be put on legal hold in one action" flush actions={<Btn sm onClick={() => toast('Legal hold rehearsal logged; no data was frozen')}>Rehearse legal hold</Btn>}>
          <DataTable
            rows={vlt}
            rowKey={(r) => r.artefact}
            columns={[
              { key: 'a', header: 'Evidence set', render: (r) => (<><div className="t-main">{r.artefact}</div><div className="t-sub">Retention {r.retention}{r.immutable ? ' · immutable' : ''}</div></>) },
              { key: 's', header: 'Source', render: (r) => r.source ? <><Sources items={[{ name: r.source.name, status: r.source.status }]} />{r.source.stale && <div><Freshness minutes={r.source.lastSyncMin} stale label={r.source.name} /></div>}</> : <span className="muted" style={{ fontSize: 11.5 }}>No connector: manual</span> },
              { key: 'size', header: 'Size', align: 'right', sort: (r) => r.sizeTB, render: (r) => <span className="num">{r.sizeTB < 1 ? `${fmtNum(r.sizeTB * 1000)} GB` : `${fmtNum(r.sizeTB, r.sizeTB < 10 ? 1 : 0)} TB`}</span> },
              { key: 'anchor', header: 'Last anchored', sort: (r) => r.anchoredMin, render: (r) => <span className="t-sub">{r.anchoredMin ? fmtAgo(r.anchoredMin) : '—'}</span> },
              { key: 'ready', header: 'Hold-ready', render: (r) => r.ready ? <Badge color="var(--good)" dot>Ready</Badge> : <Badge color="var(--sev-medium)" dot>Gap</Badge> },
            ]}
          />
        </Card>

        <Card title="Business-interruption loss tracking" sub={`Template the forensic accountants use, pre-filled from live metrics; ${bi[0].waitingH} h waiting period`} flush actions={<Btn sm onClick={() => toast('BI worksheet exported (XLSX) with live baselines')}>Export template</Btn>}>
          <DataTable
            rows={bi}
            rowKey={(r) => r.service}
            initialSort={{ key: 'loss', dir: 'desc' }}
            columns={[
              { key: 'svc', header: 'Business service', render: (r) => (<><div className="t-main">{r.service}</div><div className="t-sub">{r.metric}</div></>) },
              { key: 'loss', header: 'Loss / hour', align: 'right', sort: (r) => r.hourlyLossK, render: (r) => <b className="num">{fmtMoney(r.hourlyLossK * 1000, c.currency)}</b> },
              { key: 'wait', header: 'Retained in waiting period', align: 'right', sort: (r) => r.hourlyLossK * r.waitingH, render: (r) => <span className="num">{fmtMoney(r.hourlyLossK * 1000 * r.waitingH, c.currency)}</span> },
              { key: 'src', header: 'Measured from', render: (r) => <span className="t-sub">{r.source}</span> },
              { key: 'xe', header: 'Extra expense', render: (r) => <span className="t-sub">{r.extraExpense}</span> },
            ]}
          />
        </Card>
      </div>

      <div className="grid g-1-2">
        <Card title="Incident and claims history" sub="Five policy years">
          <Chart
            height={240}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => money(Number(v), c) },
              legend: { top: 0, data: ['Incident loss', 'Recovered'] },
              grid: { left: 8, right: 8, top: 30, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: prior.map((p) => p.date).reverse(), axisLabel: { fontSize: 9.5 } },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => money(v, c) } },
              series: [
                { name: 'Incident loss', type: 'bar', data: prior.map((p) => p.lossM).reverse(), itemStyle: { color: '#8a9bc0' } },
                { name: 'Recovered', type: 'bar', data: prior.map((p) => p.paidM).reverse(), itemStyle: { color: INS_HEX } },
              ],
            }}
          />
          <div className="card-foot">
            <span>Retention {money(c.insurance.retentionK / 1000, c)}</span>
            <span>Loss ratio driver for the next renewal</span>
          </div>
        </Card>
        <Card title="Prior incidents and claims" count={prior.length} sub="Disclosed in the evidence pack; click for the lesson learned" flush>
          <DataTable
            rows={prior}
            rowKey={(r) => r.title}
            onRowClick={setEv}
            columns={[
              { key: 'd', header: 'Date', render: (r) => <span className="t-sub">{r.date}</span> },
              { key: 't', header: 'Incident', render: (r) => (<><div className="t-main">{r.title}</div><div className="t-sub">{r.category}</div></>) },
              { key: 'l', header: 'Loss', align: 'right', sort: (r) => r.lossM, render: (r) => <span className="num">{money(r.lossM, c)}</span> },
              { key: 'c', header: 'Claim', sort: (r) => r.claimed, render: (r) => <Badge color={CLAIM_COLOR[r.claimed]}>{r.claimed}</Badge> },
              { key: 'p', header: 'Paid', align: 'right', sort: (r) => r.paidM, render: (r) => <span className="num">{r.paidM ? money(r.paidM, c) : '—'}</span> },
            ]}
          />
        </Card>
      </div>

      {ev && (
        <Drawer title={ev.title} sub={`${ev.date} · ${ev.category}`} onClose={() => setEv(null)}>
          <KV
            rows={[
              ['Total incident loss', money(ev.lossM, c)],
              ['Claim outcome', <Badge color={CLAIM_COLOR[ev.claimed]}>{ev.claimed}</Badge>],
              ['Recovered from insurers', ev.paidM ? money(ev.paidM, c) : '—'],
              ['Retention at the time', money(c.insurance.retentionK / 1000, c)],
            ]}
          />
          <SectionLabel><span style={{ display: 'block', marginTop: 14 }}>Lesson learned and control change</span></SectionLabel>
          <Callout kind="good">{ev.lesson}</Callout>
          <SectionLabel><span style={{ display: 'block', marginTop: 14 }}>How it appears in the pack</span></SectionLabel>
          <p className="secondary" style={{ marginTop: 0 }}>Disclosed under "Claims history" with the root cause, the control that now prevents recurrence and the evidence that it is in place.</p>
        </Drawer>
      )}

      {rec === 'ready' && (
        <RecordsDrawer title="Claims readiness checklist" sub={`${checklist.filter(Boolean).length} of ${checklist.length} items ready`} source={`HexaComply · ${itsmK?.product ?? 'ITSM'} · forensic evidence vault`} onClose={() => setRec(null)}
          rows={[
            ...obl.map((o) => ({ key: `o-${o.party}`, title: `Notification template: ${o.party}`, sub: `${o.deadline} · ${o.basis}`, ok: o.ready, badge: <Badge color={o.ready ? 'var(--good)' : 'var(--sev-medium)'} dot>{o.ready ? 'Ready' : 'Missing'}</Badge> })),
            ...pnl.map((p) => ({ key: `p-${p.role}`, title: `Panel: ${p.firm}`, sub: `${p.role} · ${p.engagement}`, ok: p.status === 'ready', badge: <Badge color={p.status === 'ready' ? 'var(--good)' : 'var(--sev-medium)'} dot>{p.status === 'ready' ? 'Ready' : 'Action'}</Badge> })),
            ...vlt.map((v) => ({ key: `v-${v.artefact}`, title: `Evidence: ${v.artefact}`, sub: `${v.source?.name ?? 'Manual'} · ${v.retention}`, ok: v.ready, badge: <Badge color={v.ready ? 'var(--good)' : 'var(--sev-medium)'} dot>{v.ready ? 'Hold-ready' : 'Gap'}</Badge> })),
          ].sort((a, b) => Number(a.ok) - Number(b.ok))}
        />
      )}
      {rec === 'panel' && (
        <RecordsDrawer title="Panel vendors" sub="Using non-panel vendors without consent can leave costs uninsured" source={`${c.insurance.carrier.split(' ')[0]} panel list`} onClose={() => setRec(null)}
          rows={pnl.map((p) => ({ key: p.role, title: p.firm, sub: `${p.role} · ${p.engagement} · SLA ${p.sla}`, badge: <Badge color={p.onPanel ? INS_TONE : 'var(--sev-medium)'}>{p.onPanel ? 'On panel' : 'Consent needed'}</Badge> }))} />
      )}
      {rec === 'vault' && (
        <RecordsDrawer title="Forensic evidence vault" sub={`${vlt.filter((v) => v.ready).length} of ${vlt.length} sets hold-ready`} sources={vlt.filter((v) => v.source).map((v) => ({ name: v.source!.name, status: v.source!.stale && v.source!.status === 'healthy' ? 'degraded' as const : v.source!.status }))} onClose={() => setRec(null)}
          rows={vlt.map((v) => ({ key: v.artefact, title: v.artefact, sub: `${v.source?.name ?? 'No connector: manual'} · ${v.retention}${v.anchoredMin ? ` · anchored ${fmtAgo(v.anchoredMin)}` : ''}`, right: v.sizeTB < 1 ? `${fmtNum(v.sizeTB * 1000)} GB` : `${fmtNum(v.sizeTB, 1)} TB`, badge: <Badge color={v.ready ? 'var(--good)' : 'var(--sev-medium)'} dot>{v.ready ? 'Ready' : 'Gap'}</Badge> }))} />
      )}
      {rec === 'paid' && (
        <RecordsDrawer title="Incidents and claims, 5 years" sub={`${money(paid, c)} recovered on ${money(lost, c)} of losses`} source={`${itsmK?.product ?? 'ITSM'} incident records · ${c.insurance.broker} claims history`} onClose={() => setRec(null)}
          rows={prior.map((p) => ({ key: p.title, title: p.title, sub: `${p.date} · ${p.category} · loss ${money(p.lossM, c)}`, right: p.paidM ? money(p.paidM, c) : '—', badge: <Badge color={CLAIM_COLOR[p.claimed]}>{p.claimed}</Badge>, onClick: () => { setRec(null); setEv(p); } }))} />
      )}

      {drill && (
        <Modal
          title="Schedule a claims tabletop"
          sub={`Scenario: ${scenario.name}`}
          onClose={() => setDrill(false)}
          footer={
            <>
              <Btn ghost onClick={() => setDrill(false)}>Cancel</Btn>
              <Btn primary color={INS_TONE} onClick={() => { setDrill(false); toast(`Tabletop scheduled with HexaShield DFIR, breach counsel and ${c.insurance.broker}`); }}><Hand size={14} /> Schedule</Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Participants', `${c.people.ciso.name}, ${c.people.socLead.name}, ${c.people.grcLead.name}, CFO, HexaShield DFIR, breach counsel, ${c.insurance.broker}`],
              ['Covers', `${steps.length} claim steps, ${obl.length} notification clocks, BI quantification`],
              ['Output', 'After-action report attached to the IR control as fresh evidence'],
              ['Risk class', <Badge color="var(--good)">Low: calendar invitation only</Badge>],
            ]}
          />
        </Modal>
      )}
    </>
  );
}
