import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, GraduationCap, Search } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import type { Workflow, WfState, Course } from '../../../data/modules/complyRegisters';
import { Card, Badge, Btn } from '../../../components/ui';
import { MetricBand } from '../parts';
import { useWorkspaceData } from '../useComply';
import { useQuery, useLocal, SectionHead, ahead, ago } from './shared';

const tone = MODULE_BY_ID.comply.tone;
const STATE_LABEL: Record<WfState, string> = { next: 'Next up', progress: 'In progress', done: 'Completed' };
const STATE_DOT: Record<WfState, string> = { next: '#7e8aa0', progress: '#e0a03a', done: '#0e9a6a' };

export default function StreamSection() {
  const { customer: c, tenantId, toast } = useApp();
  const { p, set, go } = useQuery();
  const { workflows, training } = useWorkspaceData();
  const local = useLocal();
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = grc ? `${grc.vendor} ${grc.product}` : 'HexaComply';
  const mode = p('mode') === 'training' ? 'training' : 'compliance';
  const fwSel = useMemo(() => (p('framework') ? p('framework')!.split(',') : []), [p]);
  const tab = (p('wf') as WfState | null) ?? 'next';
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  // Live state: pre-existing answers plus anything answered in this session.
  const live = useMemo(() => workflows.map((w) => {
    const answered = Math.min(w.questions.length, w.answered + (local.answers[w.id]?.length ?? 0));
    const state: WfState = answered >= w.questions.length ? 'done' : answered > 0 ? 'progress' : 'next';
    return { ...w, answered, state };
  }), [workflows, local.answers]);
  const inFw = (w: Workflow) => !fwSel.length || fwSel.includes(w.fwId);
  const scoped = live.filter(inFw);
  const count = (s: WfState) => scoped.filter((w) => w.state === s).length;
  const shown = scoped.filter((w) => (w.state === tab || w.id === open) && (!q || `${w.name} ${w.ref} ${w.groupName}`.toLowerCase().includes(q.toLowerCase())));

  const courseStep = (k: Course) => (k.done ? k.steps.length : local.steps[k.id] ?? 0);
  const courseDone = (k: Course) => courseStep(k) >= k.steps.length;
  const outstanding = training.filter((k) => !courseDone(k));
  const minutesLeft = outstanding.reduce((s, k) => s + Math.round(k.minutes * (1 - courseStep(k) / k.steps.length)), 0);
  const fws = c.frameworks;
  const toggleFw = (id: string) => {
    const next = fwSel.includes(id) ? fwSel.filter((x) => x !== id) : [...fwSel, id];
    set({ framework: next.length ? next.join(',') : null });
  };

  return (
    <>
      <SectionHead intro={<>The work itself: the questions that establish each control, and the training assigned to you. Answers here become the evidence the registers report on, routed to {c.people.grcLead.name} in {src} for review.</>} />
      <MetricBand tone={tone} items={[
        { ac: 'Workflows', word: 'Answered', value: live.filter((w) => w.state === 'done').length, unit: `of ${live.length} in scope`, gauge: (live.filter((w) => w.state === 'done').length / Math.max(1, live.length)) * 100, active: mode === 'compliance' && tab === 'done', onClick: () => set({ mode: null, wf: 'done' }), source: src },
        { ac: 'Not started', word: 'Waiting on an answer', value: live.filter((w) => w.state === 'next').length, unit: 'workflows', color: 'var(--sev-medium)', active: mode === 'compliance' && tab === 'next', onClick: () => set({ mode: null, wf: null }), source: src },
        { ac: 'Your training', word: 'Completed', value: training.length - outstanding.length, unit: `of ${training.length} assigned`, gauge: ((training.length - outstanding.length) / Math.max(1, training.length)) * 100, active: mode === 'training', onClick: () => set({ mode: 'training' }), source: `${src} training` },
        { ac: 'Time left', word: 'Your outstanding training', value: minutesLeft, unit: 'minutes', active: false, onClick: () => set({ mode: 'training' }), source: `${src} training` },
      ]} />

      <div className="cmp-stream">
        <Card>
          <div className="cmp-mode">
            <button type="button" className={mode === 'compliance' ? 'on' : ''} onClick={() => set({ mode: null })}><ClipboardCheck size={14} /> Compliance <em>{live.filter((w) => w.state !== 'done').length}</em></button>
            <button type="button" className={mode === 'training' ? 'on' : ''} onClick={() => set({ mode: 'training' })}><GraduationCap size={14} /> Training <em>{outstanding.length}</em></button>
          </div>
          {mode === 'compliance' ? (
            <>
              <div className="cmp-fwpick">
                <div className="section-label" style={{ margin: '4px 0 2px' }}>Select framework</div>
                {fws.map((f) => {
                  const ws = live.filter((w) => w.fwId === f.id);
                  const on = fwSel.includes(f.id);
                  return (
                    <label key={f.id} className={on ? 'on' : ''}>
                      <input type="checkbox" checked={on} onChange={() => toggleFw(f.id)} />
                      <span>{f.short}</span>
                      <em>{ws.filter((w) => w.state === 'done').length}/{ws.length}</em>
                    </label>
                  );
                })}
              </div>
              <label className="search" style={{ marginTop: 12 }}><Search size={14} /><input placeholder="Search workflow or control tag" value={q} onChange={(e) => setQ(e.target.value)} /></label>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 0 }}>{fwSel.length ? `Showing workflows for ${fwSel.map((id) => fws.find((f) => f.id === id)?.short).join(', ')}.` : 'Select a framework to narrow the controls. The workflows on the right follow whichever controls you tick here.'}</p>
            </>
          ) : (
            <div className="cmp-list" style={{ marginTop: 12 }}>
              {training.map((k) => (
                <button key={k.id} type="button" className="cmp-list-row" onClick={() => setPick(k.id)} style={pick === k.id ? { borderColor: 'var(--m-comply)' } : undefined}>
                  <span><b>{k.title}</b><span className="s">{k.kind} · {k.minutes} min · {courseDone(k) ? 'completed' : `due ${ahead(k.dueDays)}`}</span></span>
                  {courseDone(k) ? <Badge color="var(--good)"><Check size={11} /> Done</Badge> : <Badge color="var(--sev-medium)">{courseStep(k)}/{k.steps.length}</Badge>}
                </button>
              ))}
            </div>
          )}
        </Card>

        {mode === 'compliance' ? (
          <Card title="Control workflows" sub="Pick a framework on the left to narrow these to its controls · open a workflow to answer it"
            actions={<span className="cmp-wfcount">{(['next', 'progress', 'done'] as WfState[]).map((s) => <button key={s} type="button" className={tab === s ? 'on' : ''} onClick={() => set({ wf: s === 'next' ? null : s })}><i style={{ background: STATE_DOT[s] }} />{STATE_LABEL[s]} <b>{count(s)}</b></button>)}</span>}>
            {shown.length === 0 && <div className="empty">{tab === 'done' ? 'Nothing completed yet for this selection.' : 'Nothing waiting here. Pick another framework or tab.'}</div>}
            {shown.map((w) => <WorkflowRow key={w.id} w={w} open={open === w.id} onToggle={() => setOpen(open === w.id ? null : w.id)}
              onAnswer={(a) => {
                local.answer(w.id, a);
                if (w.answered + 1 >= w.questions.length) {
                  setOpen(null);
                  toast(`${w.name} workflow complete · answers saved as draft evidence for ${w.fwShort} ${w.ref}, routed to ${c.people.grcLead.name}`);
                }
              }}
              onControl={() => go('frameworks', { framework: w.fwId, id: w.controlId })} />)}
          </Card>
        ) : (
          <div>
            {(pick ? training.filter((k) => k.id === pick) : outstanding.length ? outstanding : training).map((k) => <CourseCard key={k.id} k={k} step={courseStep(k)} onNext={() => {
              const n = courseStep(k) + 1;
              local.setStep(k.id, n);
              if (n >= k.steps.length) toast(`Course complete: ${k.title} · recorded as training evidence`);
            }} />)}
          </div>
        )}
      </div>
    </>
  );
}

function WorkflowRow({ w, open, onToggle, onAnswer, onControl }: { w: Workflow; open: boolean; onToggle: () => void; onAnswer: (a: string) => void; onControl: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const qi = Math.min(w.answered, w.questions.length - 1);
  const q = w.questions[qi];
  const done = w.state === 'done';
  return (
    <div className="cmp-wf">
      <button type="button" className="cmp-wf-head" onClick={onToggle} aria-expanded={open}>
        <span className="cmp-wf-ico">{done ? <Check size={14} /> : <ClipboardCheck size={14} />}</span>
        <span><b>{w.name} workflow</b><span className="s">{w.ref} · {w.groupName} · {w.fwShort} · {w.questions.length} questions{w.state === 'progress' ? ` · ${w.answered} answered` : ''}</span></span>
        {done ? <Badge color="var(--good)">Answered</Badge> : <span className="cmp-wf-plus">{open ? '−' : '+'}</span>}
      </button>
      {open && !done && (
        <div className="cmp-q">
          <p className="cmp-q-lead">{q.lead}</p>
          <p className="cmp-q-q">{q.q}</p>
          <div className="section-label" style={{ margin: 0 }}>What good looks like</div>
          <ul>{q.checks.map((ck) => <li key={ck}>{ck}</li>)}</ul>
          <div className="cmp-q-ans">
            {['Yes', 'No', 'I am not sure'].map((a) => <button key={a} type="button" className={`cmp-ans ${sel === a ? 'on' : ''}`} onClick={() => setSel(a)}>{a}</button>)}
          </div>
          <div className="cmp-q-foot">
            <span className="row" style={{ gap: 10 }}>
              <span className="cmp-steps">{w.questions.map((_, i) => <i key={i} className={i < w.answered || i === qi ? 'on' : ''} />)}</span>
              Question {qi + 1} of {w.questions.length} · <button type="button" className="link" onClick={onControl}>Open control {w.ref}</button>
            </span>
            <Btn primary color={tone} disabled={!sel} onClick={() => { if (sel) { onAnswer(sel); setSel(null); } }}>{qi + 1 >= w.questions.length ? 'Finish' : 'Next'}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function CourseCard({ k, step, onNext }: { k: Course; step: number; onNext: () => void }) {
  const done = step >= k.steps.length;
  const s = k.steps[Math.min(step, k.steps.length - 1)];
  return (
    <div className="cmp-course">
      <div className="cmp-course-head">
        <span><b>{k.title}</b><span className="s">{k.kind} · {k.audience} · {k.minutes} minutes · {done ? (k.done ? `completed ${ago(-k.dueDays)}` : 'completed today') : `due ${ahead(k.dueDays)}`}</span></span>
        {done ? <Badge color="var(--good)"><Check size={11} /> Completed</Badge> : <Badge color={tone}>{k.id}</Badge>}
      </div>
      {done ? (
        <p className="cmp-desc" style={{ fontSize: 12.5 }}>All {k.steps.length} steps completed. Your completion is recorded as evidence for the awareness-training controls.</p>
      ) : (
        <div className="cmp-q" style={{ margin: 0 }}>
          <p className="cmp-q-q">{s.title}</p>
          <p className="cmp-desc" style={{ fontSize: 13 }}>{s.body}</p>
          {s.points && <ul>{s.points.map((x) => <li key={x}>{x}</li>)}</ul>}
          <div className="cmp-q-foot">
            <span className="row" style={{ gap: 10 }}><span className="cmp-steps">{k.steps.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</span>Step {step + 1} of {k.steps.length}</span>
            <Btn primary color={tone} onClick={onNext}>{step + 1 >= k.steps.length ? 'Complete course' : 'Next'}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
