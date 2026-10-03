import { useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipForward, Flag, Gavel, Mic, MicOff, Radio, Timer, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Card, Badge, Btn, Callout, Chip, Bar, KV, Timeline, MiniStat } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { fmtDateShort, fmtDur } from '../../../lib/format';
import { tenantName } from '../../../data/customers';
import { CAPS, CAP_BY_ID, KIND_BY_ID, type Cap, type Exercise } from '../../../data/modules/exercises';
import { fmtCountdown } from '../parts';
import { useEx, type RunState } from './state';
import { KindBadge, css, whenText, scoreColor } from './parts';

export function Run() {
  const { run } = useEx();
  return run ? <Live run={run} /> : <Picker />;
}

function Picker() {
  const { c, exs, scs, startRun, param, setParams } = useEx();
  const exParam = param('ex');
  const upcoming = exs.filter((e) => e.status !== 'completed').sort((a, b) => a.dayOffset - b.dayOffset);
  const [sid, setSid] = useState(scs[0]?.id ?? '');
  const pre = exParam ? upcoming.find((e) => e.id === exParam) : undefined;
  const start = (e: Exercise) => { startRun(e.scenarioId, e.id); setParams({ ex: e.id }); };
  return (
    <div className="ex-stack">
      <Callout>
        Exercise mode: injects, clocks and decisions are simulated and recorded to the exercise record only. No connector write-backs run and nothing leaves HexaView. One simulated minute passes per second at 1×.
      </Callout>
      {pre && (
        <Card title={`Ready to run · ${pre.id}`} sub={`${fmtDateShort(pre.date)} · ${whenText(pre)} · ${tenantName(c, pre.tenantId)}`} tinted toneColor="var(--m-ops)" actions={<Btn primary color="var(--m-ops)" onClick={() => start(pre)}><Play size={14} /> Load exercise</Btn>}>
          <b>{pre.title}</b>
          <div className="ex-muted" style={{ marginTop: 4 }}>{pre.invited} invited · facilitated by {pre.facilitator}</div>
        </Card>
      )}
      <Card title="Upcoming and overdue exercises" count={upcoming.length} sub="Load one to run it live with the room">
        <div className="ex-pick">
          {upcoming.map((e) => (
            <button key={e.id} type="button" className="ex-card" style={css({ '--kc': KIND_BY_ID[e.kind].color })} onClick={() => start(e)}>
              <span className="m">{e.id} · {fmtDateShort(e.date)} · {whenText(e)}</span>
              <span className="t">{e.title}</span>
              <span className="s"><KindBadge kind={e.kind} /><b style={{ color: e.status === 'overdue' ? 'var(--bad)' : undefined }}><Play size={12} style={{ verticalAlign: -2 }} /> Load</b></span>
            </button>
          ))}
          {!upcoming.length && <span className="ex-muted">Nothing outstanding in scope.</span>}
        </div>
      </Card>
      <Card title="Ad-hoc run" sub="Pick any scenario from the library, for practice or a surprise drill">
        <div className="ex-row">
          <select className="select" value={sid} onChange={(e) => setSid(e.target.value)} aria-label="Scenario" style={{ minWidth: 320 }}>
            {scs.map((s) => <option key={s.id} value={s.id}>{KIND_BY_ID[s.kind].short} · {s.title}</option>)}
          </select>
          <Btn primary color="var(--m-ops)" onClick={() => startRun(sid, null)}><Play size={14} /> Load scenario</Btn>
        </div>
      </Card>
    </div>
  );
}

function Live({ run }: { run: RunState }) {
  const { c, scById, clocks, people, exs, toggleRun, nextInject, setSpeed, logDecision, rate, toggleAttendance, submitClock, abandonRun } = useEx();
  const sc = scById.get(run.scenarioId);
  const [injSel, setInjSel] = useState<number | null>(null);
  const [text, setText] = useState('');
  const attendees = people.filter((p) => run.attendance[p.name]);
  const [by, setBy] = useState(attendees[0]?.name ?? c.people.ciso.name);
  const [finish, setFinish] = useState(false);
  const formRef = useRef<HTMLTextAreaElement>(null);
  if (!sc) return null;
  const released = run.releasedAt.length;
  const ex = run.exId ? exs.find((e) => e.id === run.exId) : undefined;
  const latest = released - 1;
  const sel = injSel ?? Math.max(0, latest);
  const decidedIdx = new Set(run.decisions.map((d) => d.inject));
  const avgTtd = run.decisions.length ? Math.round(run.decisions.reduce((s, d) => s + d.ttd, 0) / run.decisions.length) : null;
  const clockState = (dueMin: number, name: string) => {
    const sub = run.submitted[name];
    if (sub !== undefined) return sub <= dueMin ? 'on time' : 'late';
    return run.simMin > dueMin ? 'missed' : 'running';
  };
  const clocksMet = clocks.filter((k) => clockState(k.dueMin, k.name) === 'on time').length;
  const allOut = released >= sc.injects.length;

  const record = () => {
    if (!text.trim()) return;
    logDecision(sel, text.trim(), by);
    setText('');
    setInjSel(null);
  };
  const decideOn = (i: number) => {
    setInjSel(i);
    setText('');
    setTimeout(() => formRef.current?.focus(), 30);
  };

  return (
    <div className="ex-stack">
      <div className={`ex-banner ${run.running ? 'live' : ''}`}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="ex-row">
            {run.running ? <Badge color="var(--bad)" solid>Live</Badge> : <Badge color="var(--sev-info)">{released ? 'Paused' : 'Ready'}</Badge>}
            <KindBadge kind={sc.kind} />
            <span className="mono ex-muted">{run.exId ?? 'Ad-hoc'} · {sc.id} · {tenantName(c, ex?.tenantId ?? sc.tenantId)}</span>
          </div>
          <h3>{sc.title}</h3>
          <div className="ex-muted" style={{ marginTop: 2 }}>Exercise mode · simulated injects and clocks · no write-backs</div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
          <span className="ex-simclock">T+{fmtCountdown(run.simMin * 60)}</span>
          <div className="ex-row" style={{ justifyContent: 'flex-end' }}>
            {[1, 5, 15].map((n) => <Chip key={n} on={run.speed === n} onClick={() => setSpeed(n)} color="var(--m-ops)">{n}×</Chip>)}
          </div>
          <div className="ex-row" style={{ justifyContent: 'flex-end' }}>
            <Btn sm primary color={run.running ? 'var(--sev-medium)' : 'var(--m-ops)'} onClick={toggleRun}>{run.running ? <><Pause size={13} /> Pause</> : <><Play size={13} /> {released ? 'Resume' : 'Start'}</>}</Btn>
            <Btn sm onClick={nextInject} disabled={allOut}><SkipForward size={13} /> Next inject</Btn>
            <Btn sm primary color="var(--good)" onClick={() => setFinish(true)} disabled={!released}><Flag size={13} /> Complete & score</Btn>
            <Btn sm ghost onClick={abandonRun} title="Discard this run"><X size={13} /></Btn>
          </div>
        </div>
      </div>

      <div className="mini-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
        <MiniStat value={`${released}/${sc.injects.length}`} label="injects released" color="var(--m-ops)" />
        <MiniStat value={run.decisions.length} label="decisions logged" />
        <MiniStat value={avgTtd === null ? '—' : `${avgTtd} min`} label="avg time to decision" color={avgTtd !== null && avgTtd > 20 ? 'var(--sev-high)' : undefined} />
        <MiniStat value={`${clocksMet}/${clocks.length}`} label="clocks met" color={clocks.some((k) => clockState(k.dueMin, k.name) === 'missed') ? 'var(--bad)' : undefined} />
        <MiniStat value={`${attendees.length}`} label="in the room" />
      </div>

      <div className="grid g-2-1">
        <Card title={<>{run.running && <span className="live-dot" />} Injects</>} sub={`${released} released · next ${allOut ? 'none' : `at T+${sc.injects[released].t} min`}`}>
          {[...sc.injects.keys()].slice(0, released).reverse().map((i) => {
            const inj = sc.injects[i];
            const decided = decidedIdx.has(i);
            return (
              <div key={i} className={`ex-inj ${i === latest && !decided ? 'new' : ''}`}>
                <span className="tt">T+{run.releasedAt[i]}m</span>
                <div className="bd">
                  <span className="from">{inj.from}</span>
                  <b>{inj.title}</b>
                  <span className="q">{inj.prompt}</span>
                  <div className="ex-row">
                    <Badge color={CAP_BY_ID[inj.cap].color}>{CAP_BY_ID[inj.cap].label}</Badge>
                    {decided ? <Badge color="var(--good)" dot>Decided</Badge> : <Btn sm onClick={() => decideOn(i)}><Gavel size={12} /> Record decision</Btn>}
                  </div>
                </div>
              </div>
            );
          })}
          {sc.injects.slice(released).map((inj, j) => (
            <div key={`s${j}`} className="ex-inj sealed">
              <span className="tt">T+{inj.t}m</span>
              <div className="bd"><b>Inject {released + j + 1} · sealed until released</b></div>
            </div>
          ))}
          {!released && <div className="ex-muted" style={{ padding: '6px 0' }}>Press Start to release the first inject to the room.</div>}
        </Card>

        <Card title="Regulatory & contractual clocks" sub="Simulated from T+0 · mark when the drafted notice would be filed">
          <div className="stack" style={{ gap: 8 }}>
            {clocks.map((k) => {
              const st = clockState(k.dueMin, k.name);
              const rem = k.dueMin - run.simMin;
              const urgent = st === 'running' && rem < k.dueMin * 0.25;
              return (
                <div key={k.name} className={`ex-clock ${urgent ? 'urgent' : ''} ${st === 'missed' ? 'missed' : ''} ${st === 'on time' ? 'done' : ''}`}>
                  <div className="ex-row">
                    <b style={{ fontSize: 12, flex: 1 }}>{k.name}</b>
                    <Badge color={st === 'on time' ? 'var(--good)' : st === 'late' || st === 'missed' ? 'var(--bad)' : 'var(--sev-high)'} dot>{st}</Badge>
                  </div>
                  <span className="ex-muted">{k.body}</span>
                  {st === 'running' && (
                    <>
                      <div className="ex-row">
                        <span className="tm" style={{ color: urgent ? 'var(--sev-high)' : undefined }}><Timer size={12} style={{ verticalAlign: -1 }} /> {fmtCountdown(rem * 60)}</span>
                        <span className="spacer" />
                        <Btn sm onClick={() => submitClock(k.name)} disabled={!released}>Mark filed</Btn>
                      </div>
                      <Bar value={run.simMin} max={k.dueMin} color={urgent ? 'var(--sev-high)' : 'var(--m-ops)'} size="thin" />
                    </>
                  )}
                  {(st === 'on time' || st === 'late') && <span className="ex-muted">Filed at T+{fmtDur(run.submitted[k.name])}</span>}
                  {st === 'missed' && <Btn sm onClick={() => submitClock(k.name)}>Mark filed (late)</Btn>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Decision log" count={run.decisions.length} sub="Time to decision is measured from the inject's release">
          <div className="stack" style={{ gap: 6, marginBottom: 12 }}>
            <div className="ex-row">
              <select className="select" value={sel} onChange={(e) => setInjSel(Number(e.target.value))} aria-label="Inject" disabled={!released} style={{ flex: 1, minWidth: 200 }}>
                {[...sc.injects.keys()].slice(0, Math.max(1, released)).map((i) => <option key={i} value={i}>Inject {i + 1}: {sc.injects[i].title}</option>)}
              </select>
              <select className="select" value={by} onChange={(e) => setBy(e.target.value)} aria-label="Decided by">
                {(attendees.length ? attendees : people).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="ex-dec-form">
              <textarea ref={formRef} className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={released ? sc.injects[sel]?.prompt : 'Start the exercise first'} disabled={!released} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) record(); }} />
              <Btn primary color="var(--m-ops)" onClick={record} disabled={!text.trim()}><Radio size={13} /> Log</Btn>
            </div>
          </div>
          {run.decisions.length ? (
            <Timeline items={[...run.decisions].reverse().map((d) => ({ time: `T+${d.t}m`, title: d.text, body: `${d.by} · inject ${d.inject + 1} · decided in ${d.ttd} min`, color: d.ttd > 20 ? 'var(--sev-high)' : 'var(--m-ops)' }))} />
          ) : (
            <div className="ex-muted">No decisions yet. Each decision is timed against its inject.</div>
          )}
        </Card>
        <Card title="Participants" count={attendees.length} sub="Click to mark present or absent">
          {people.map((p) => (
            <button key={p.name} type="button" className={`ex-person ${run.attendance[p.name] ? '' : 'off'}`} onClick={() => toggleAttendance(p.name)}>
              {run.attendance[p.name] ? <Mic size={14} style={{ color: 'var(--good)' }} /> : <MicOff size={14} className="muted" />}
              <span className="nm"><b>{p.name}</b><span>{p.role}{p.org !== c.short ? ` · ${p.org}` : ''}</span></span>
              <Badge color={run.attendance[p.name] ? 'var(--good)' : 'var(--sev-info)'} dot>{run.attendance[p.name] ? 'Present' : 'Absent'}</Badge>
            </button>
          ))}
        </Card>
      </div>

      <Card title="Scoring rubric" sub="Facilitator rates each capability 1 (not demonstrated) to 5 (exemplary); signals from the run are shown for calibration">
        {CAPS.map((k) => {
          const injs = sc.injects.map((x, i) => ({ x, i })).filter(({ x }) => k.id === 'decide' || x.cap === k.id);
          const ds = run.decisions.filter((d) => injs.some(({ i }) => i === d.inject));
          const sig = k.id === 'notify'
            ? `${clocksMet} of ${clocks.length} clocks filed on time`
            : injs.length ? `${ds.length}/${injs.filter(({ i }) => i < released).length} injects decided${ds.length ? ` · avg ${Math.round(ds.reduce((s, d) => s + d.ttd, 0) / ds.length)} min` : ''}` : 'Not tested by this scenario';
          return (
            <div key={k.id} className="ex-rub">
              <span className="nm"><b style={{ color: k.color }}>{k.label}</b><span>{k.hint}</span></span>
              <span className="ex-pipbtns">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={`ex-pipbtn ${run.ratings[k.id] === n ? 'on' : ''}`} style={css({ '--pc': k.color })} onClick={() => rate(k.id, n)} aria-label={`${k.label} ${n}`}>{n}</button>
                ))}
              </span>
              <span className="ex-signal">{sig}</span>
            </div>
          );
        })}
      </Card>

      {finish && <FinishModal run={run} onClose={() => setFinish(false)} clockState={clockState} />}
    </div>
  );
}

function FinishModal({ run, onClose, clockState }: { run: RunState; onClose: () => void; clockState: (due: number, name: string) => string }) {
  const { c, scById, clocks, people, completeRun, go, ds } = useEx();
  const sc = scById.get(run.scenarioId);
  const [push, setPush] = useState(true);
  const scores = useMemo(() => {
    const out = {} as Record<Cap, number>;
    CAPS.forEach((k) => {
      const injs = (sc?.injects ?? []).map((x, i) => ({ x, i })).filter(({ x }) => k.id === 'decide' || x.cap === k.id);
      const ds = run.decisions.filter((d) => injs.some(({ i }) => i === d.inject));
      let v = run.ratings[k.id] !== undefined ? (run.ratings[k.id] ?? 3) * 19 + 4 : 62;
      if (ds.length) {
        const avg = ds.reduce((s, d) => s + d.ttd, 0) / ds.length;
        v += avg <= 10 ? 4 : avg > 25 ? -7 : 0;
      }
      const missedDecisions = injs.filter(({ i }) => i < run.releasedAt.length && !run.decisions.some((d) => d.inject === i)).length;
      v -= missedDecisions * 4;
      if (k.id === 'notify') {
        const st = clocks.map((cl) => clockState(cl.dueMin, cl.name));
        v += st.filter((s) => s === 'on time').length * 3 - st.filter((s) => s === 'missed' || s === 'late').length * 8;
      }
      out[k.id] = Math.max(20, Math.min(98, Math.round(v)));
    });
    return out;
  }, [sc, run, clocks, clockState]);
  const owners = [c.people.ciso.name, c.people.socLead.name, c.people.grcLead.name, c.people.otLead?.name ?? c.people.admin.name];
  const proposed = useMemo(() => {
    const out: { title: string; cap: Cap; owner: string }[] = [];
    CAPS.forEach((k, i) => {
      if (scores[k.id] < 70) {
        const lesson = sc?.lessons.find((l) => l[2] === k.id);
        out.push({ title: lesson ? lesson[1] : `Improve ${k.label.toLowerCase()} capability: ${k.hint.charAt(0).toLowerCase()}${k.hint.slice(1)}`, cap: k.id, owner: owners[i % owners.length] });
      }
    });
    return out;
  }, [scores, sc]); // eslint-disable-line react-hooks/exhaustive-deps
  const [keep, setKeep] = useState<Record<number, boolean>>(() => Object.fromEntries(proposed.map((_, i) => [i, true])));
  if (!sc) return null;
  const overall = Math.round(CAPS.reduce((s, k) => s + scores[k.id], 0) / CAPS.length);
  const present = people.filter((p) => run.attendance[p.name]).length;
  return (
    <Modal
      title="Complete and score the exercise"
      sub={`${sc.title} · T+${fmtDur(run.simMin)} · ${run.decisions.length} decisions · ${present} present`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Keep running</Btn>
          <Btn primary color="var(--good)" onClick={() => { const ex = completeRun(scores, proposed.filter((_, i) => keep[i]), push); onClose(); if (ex) go('after-action', { ex: ex.id }); }}><CheckCircle2 size={14} /> Record after-action</Btn>
        </>
      }
    >
      <div className="ex-row" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor(overall) }}>{overall}</span>
        <span className="ex-muted">overall · ratings adjusted by decision times, unanswered injects and clocks</span>
      </div>
      {CAPS.map((k) => (
        <div key={k.id} className="ex-capscore">
          <span>{k.label}</span>
          <span className="trk"><i style={{ width: `${scores[k.id]}%`, background: k.color }} /><u style={{ left: '75%' }} /></span>
          <b>{scores[k.id]}</b>
        </div>
      ))}
      <div className="section-label" style={{ marginTop: 12 }}>Actions to raise ({proposed.filter((_, i) => keep[i]).length})</div>
      {proposed.length ? (
        <div className="list">
          {proposed.map((a, i) => (
            <label key={i} className="list-row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={!!keep[i]} onChange={() => setKeep((k) => ({ ...k, [i]: !k[i] }))} />
              <span className="list-main"><b>{a.title}</b><span>{a.owner} · due in 30 days</span></span>
              <Badge color={CAP_BY_ID[a.cap].color}>{CAP_BY_ID[a.cap].label}</Badge>
            </label>
          ))}
        </div>
      ) : <div className="ex-muted">Every capability scored 70 or above; no mandatory actions.</div>}
      <KV rows={[['Evidence', 'After-action report, attendance, inject timeline and decision log'], ['Counts towards', ds.filter((d) => sc.drivers.includes(d.id)).map((d) => d.name).join(', ')]]} />
      <label className="ex-row" style={{ marginTop: 8, fontSize: 12.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={push} onChange={() => setPush(!push)} />
        <ShieldAlert size={14} style={{ color: 'var(--m-comply)' }} /> Push evidence and actions to HexaComply now
      </label>
    </Modal>
  );
}
