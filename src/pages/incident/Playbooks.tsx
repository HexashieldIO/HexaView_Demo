import { useState } from 'react';
import { Zap, ExternalLink, BookOpen } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, Ring } from '../../components/ui';
import { OtReadOnly } from '../soc/parts';
import { IR_TYPES, IR_TYPE_IDS, PHASES, PHASE_LABEL, PHASE_COLOR, playbookFor, playbookProgress, type IrIncident, type IrType } from '../../data/modules/incident';
import { useIr, IrPage, IncidentPicker, NoIncident, Pill, fmtT, IR_TONE, PhaseStepper } from './parts';
import { ir } from './store';

export default function Playbooks() {
  return <IrPage><Inner /></IrPage>;
}
function Inner() {
  const { focus } = useIr();
  return <><IncidentPicker />{focus ? <PB inc={focus} /> : <NoIncident />}</>;
}

function PB({ inc }: { inc: IrIncident }) {
  const { c, tools, actor, toast, nav } = useIr();
  const [preview, setPreview] = useState<IrType>(inc.type);
  const pb = playbookFor(inc.type, tools);
  const prog = playbookProgress(inc, tools);
  const live = inc.status === 'active';
  const curIx = PHASES.indexOf(inc.phase);
  const autoItems = PHASES.flatMap((p) => pb[p]).filter((x) => x.auto);
  const autoDone = autoItems.filter((x) => inc.checks[x.id]).length;
  const prevPb = playbookFor(preview, tools);
  const isOt = inc.type === 'ot' || inc.ot;

  return (
    <>
      <p className="page-intro">
        The <b>{IR_TYPES[inc.type].label}</b> runbook for {inc.id}, agreed with {c.people.socLead.name}. Tick steps as they are done; progress feeds the war room and every tick is written to the timeline. Steps marked <Zap size={11} style={{ verticalAlign: -1 }} /> run through the <button className="ir-link" onClick={() => nav('/soc/playbooks')}>HexaSOC Playbook Builder</button> with the usual approvals.
      </p>
      <KpiStrip toneColor={IR_TONE} items={[
        { label: 'Runbook progress', value: `${Math.round((prog.done / Math.max(1, prog.total)) * 100)}%`, hint: `${prog.done} of ${prog.total} steps`, bar: (prog.done / Math.max(1, prog.total)) * 100, onClick: () => document.getElementById(`pb-${inc.phase}`)?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaView IR playbook state' },
        { label: `${PHASE_LABEL[inc.phase]} steps`, value: `${prog.byPhase[inc.phase].done}/${prog.byPhase[inc.phase].total}`, hint: 'current phase', toneColor: PHASE_COLOR[inc.phase], onClick: () => document.getElementById(`pb-${inc.phase}`)?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaView IR playbook state' },
        { label: 'Automated steps', value: `${autoDone}/${autoItems.length}`, hint: `via ${tools.edr} / ${tools.idp}`, to: '/soc/playbooks', source: 'HexaSOC Playbook Builder' },
        { label: 'Open war-room tasks', value: inc.tasks.filter((t) => t.status !== 'done').length, hint: 'linked to this runbook', to: '/incident-response/warroom', source: 'HexaView IR task board' },
      ]} />
      {isOt && <OtReadOnly>OT steps are carried out by site engineers; HexaView tracks them but never sends commands to OT.</OtReadOnly>}

      <Card title="Phase progress" sub="Completed steps per NIST SP 800-61 phase">
        <PhaseStepper inc={inc} compact />
        <div className="grid g5" style={{ marginTop: 14 }}>
          {PHASES.map((p) => (
            <button key={p} type="button" className="gauge-tile" onClick={() => document.getElementById(`pb-${p}`)?.scrollIntoView({ behavior: 'smooth' })}>
              <Ring value={prog.byPhase[p].done} max={prog.byPhase[p].total} color={PHASE_COLOR[p]} size={64} stroke={7}>{prog.byPhase[p].done}/{prog.byPhase[p].total}</Ring>
              <b>{PHASE_LABEL[p]}</b>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid g-2-1">
        <div className="stack" style={{ gap: 12 }}>
          {PHASES.map((p, i) => (
            <div key={p} id={`pb-${p}`} className="ir-pb-phase">
              <div className="ir-pb-h">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: PHASE_COLOR[p] }} />
                <b>{PHASE_LABEL[p]}</b>
                {i === curIx && inc.status === 'active' && <Pill color={PHASE_COLOR[p]} dot>current</Pill>}
                <span className="ir-sub">{prog.byPhase[p].done}/{prog.byPhase[p].total}</span>
              </div>
              {pb[p].map((it) => {
                const ck = inc.checks[it.id];
                return (
                  <div key={it.id} className={`ir-pb-item ${ck ? 'done' : ''}`}>
                    <input type="checkbox" checked={!!ck} disabled={!live} onChange={() => { ir.toggleCheck(c, inc.id, it.id, actor); toast(ck ? 'Step reopened' : 'Step completed and logged'); }} aria-label={it.text} />
                    <div>
                      <span>{it.auto && <Zap size={12} style={{ verticalAlign: -2, color: 'var(--m-soc)', marginRight: 4 }} />}{it.text}</span>
                      {ck && <div className="ir-sub">{ck.by} · {fmtT(ck.t)}</div>}
                    </div>
                    {it.auto && !ck && live && !isOt && <Btn sm onClick={() => { ir.runAutomated(c, inc.id, it.id, actor); toast('Sent to HexaSOC playbook runner (approvals per risk class)'); }}><Zap size={12} /> Run</Btn>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Runbook library" sub={`${c.sector} IR runbooks · click to preview`}>
            <div className="list">
              {IR_TYPE_IDS.map((t) => {
                const n = PHASES.reduce((s, p) => s + playbookFor(t, tools)[p].length, 0);
                return (
                  <div key={t} className="list-row clickable" style={{ cursor: 'pointer', background: preview === t ? 'color-mix(in srgb, var(--m-ir) 9%, transparent)' : undefined }} onClick={() => setPreview(t)}>
                    <span className="list-main"><b>{IR_TYPES[t].label}</b><span>{n} steps · {PHASES.reduce((s, p) => s + playbookFor(t, tools)[p].filter((x) => x.auto).length, 0)} automated</span></span>
                    {t === inc.type ? <Pill color={IR_TONE}>in use</Pill> : <BookOpen size={14} className="muted" />}
                  </div>
                );
              })}
            </div>
          </Card>
          {preview !== inc.type && (
            <Card title={`Preview · ${IR_TYPES[preview].label}`} sub="Read-only">
              {PHASES.map((p) => (
                <div key={p} style={{ marginBottom: 8 }}>
                  <div className="section-label" style={{ color: PHASE_COLOR[p] }}>{PHASE_LABEL[p]}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>{prevPb[p].map((x) => <li key={x.id}>{x.text}</li>)}</ul>
                </div>
              ))}
            </Card>
          )}
          <Callout>Automated steps run through HexaSOC with the same risk classes and approvals as any write-back. <button className="ir-link" onClick={() => nav('/soc/playbooks')}>Open Playbook Builder <ExternalLink size={11} /></button></Callout>
        </div>
      </div>
    </>
  );
}
