import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ClipboardCheck, ExternalLink, CalendarClock } from 'lucide-react';
import { Badge, Btn, KV, StatusBadge, Callout, Timeline } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { fmtDate, fmtDur } from '../../../lib/format';
import { tenantName } from '../../../data/customers';
import {
  KIND_BY_ID, CAP_BY_ID, CAPS, STATUS_COLOR, ACTION_COLOR,
  type ExKind, type Exercise, type Scenario, type Cap, type ExAction,
} from '../../../data/modules/exercises';
import { useEx, EX_SECTIONS } from './state';
import './exercises.css';

export const css = (vars: Record<string, string>) => vars as CSSProperties;

export function KindBadge({ kind }: { kind: ExKind }) {
  const k = KIND_BY_ID[kind];
  return <Badge color={k.color}>{k.short}</Badge>;
}
export function CapBadge({ cap }: { cap: Cap }) {
  const k = CAP_BY_ID[cap];
  return <Badge color={k.color}>{k.label}</Badge>;
}
export function ExStatusBadge({ ex }: { ex: Exercise }) {
  return <StatusBadge value={ex.status} map={STATUS_COLOR} />;
}
export function actionState(a: ExAction): 'open' | 'in_progress' | 'done' | 'overdue' {
  return a.status !== 'done' && a.dueDays < 0 ? 'overdue' : a.status;
}
export function ActionBadge({ a }: { a: ExAction }) {
  return <StatusBadge value={actionState(a)} map={ACTION_COLOR} />;
}

/** Score to a heat colour (hex, readable dark text on top). */
export function heatHex(v: number): string {
  if (v >= 85) return '#3ad0ae';
  if (v >= 75) return '#93d65a';
  if (v >= 65) return '#ecc873';
  if (v >= 55) return '#f7a04a';
  return '#f8646f';
}
export function scoreColor(v: number): string {
  return v >= 80 ? 'var(--good)' : v >= 65 ? 'var(--sev-medium)' : 'var(--bad)';
}
export function whenText(ex: Exercise): string {
  if (ex.status === 'completed') return ex.live ? 'today (live run)' : `${-ex.dayOffset} d ago`;
  if (ex.status === 'overdue') return `overdue ${-ex.dayOffset} d`;
  return ex.dayOffset === 0 ? 'today' : `in ${ex.dayOffset} d`;
}

export function SubTabs() {
  const { section, go, run, scs, exs, actions } = useEx();
  const counts: Record<string, number | undefined> = {
    library: scs.length,
    'after-action': exs.filter((e) => e.status === 'completed').length,
    programme: exs.length,
  };
  const openActs = actions.filter((a) => a.status !== 'done').length;
  return (
    <nav className="ex-subtabs" aria-label="Crisis exercise sections">
      {EX_SECTIONS.map((s) => (
        <button key={s.id} type="button" className={`ex-subtab ${section === s.id ? 'on' : ''}`} onClick={() => go(s.id)}>
          {s.id === 'run' && run && <i className="ex-live" />}
          {s.label}
          {counts[s.id] !== undefined && <em>{counts[s.id]}</em>}
          {s.id === 'after-action' && openActs > 0 && <em title="Open actions">{openActs} open</em>}
        </button>
      ))}
    </nav>
  );
}

/** Mini segmented bar showing which capabilities a scenario's injects exercise. */
export function CapMix({ s }: { s: Scenario }) {
  return (
    <div className="ex-capbar" title={CAPS.map((k) => `${k.label}: ${s.injects.filter((i) => i.cap === k.id).length}`).join(' · ')}>
      {CAPS.map((k) => {
        const n = s.injects.filter((i) => i.cap === k.id).length;
        return n ? <i key={k.id} style={{ flexGrow: n, background: k.color }} /> : null;
      })}
    </div>
  );
}

export function ExerciseDrawer({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { c, scById, ds, go, startRun, isPushed, actions } = useEx();
  const acts = actions.filter((a) => a.exerciseId === ex.id);
  const nav = useNavigate();
  const s = scById.get(ex.scenarioId);
  const drv = ds.filter((d) => ex.drivers.includes(d.id));
  const done = ex.status === 'completed';
  return (
    <Drawer
      title={ex.title}
      sub={`${ex.id} · ${fmtDate(ex.date)} · ${KIND_BY_ID[ex.kind].label}`}
      onClose={onClose}
      wide
      footer={
        <>
          {done ? (
            <>
              <Btn onClick={() => { onClose(); go('after-action', { ex: ex.id }); }}><ClipboardCheck size={14} /> Open after-action</Btn>
              <Btn onClick={() => nav('/comply/caas?section=tasks')}><ExternalLink size={14} /> Actions in HexaComply</Btn>
            </>
          ) : (
            <Btn primary color="var(--m-ops)" onClick={() => { startRun(ex.scenarioId, ex.id); onClose(); go('run', { ex: ex.id }); }}><Play size={14} /> {ex.status === 'overdue' ? 'Run it now' : 'Run now'}</Btn>
          )}
        </>
      }
    >
      <div className="ex-row" style={{ marginBottom: 10 }}>
        <StatusBadge value={ex.status} map={STATUS_COLOR} />
        <Badge color={KIND_BY_ID[ex.kind].color}>{KIND_BY_ID[ex.kind].short}</Badge>
        <span className="ex-muted">{whenText(ex)}</span>
      </div>
      {ex.status === 'overdue' && <Callout kind="warn">Planned for {fmtDate(ex.date)} but not run. {drv.map((d) => d.name).join(' and ')} evidence for this year depends on it.</Callout>}
      {s && <p className="secondary" style={{ fontSize: 12.5, marginTop: 0 }}>{s.summary}</p>}
      <KV
        rows={[
          ['Scope', tenantName(c, ex.tenantId)],
          ['Facilitator', ex.facilitator],
          ['Duration', fmtDur(ex.durationMin)],
          ['Participation', done ? `${ex.attended} of ${ex.invited} invited (${Math.round((ex.attended / Math.max(1, ex.invited)) * 100)}%)` : `${ex.invited} invited`],
          ['Regulatory drivers', drv.map((d) => d.name).join(' · ') || '—'],
          ['Evidence', done ? <>{ex.evidenceId} · {isPushed(ex) ? <Badge color="var(--good)" dot>In HexaComply</Badge> : <Badge color="var(--sev-medium)" dot>Not pushed</Badge>}</> : 'Generated on completion'],
        ]}
      />
      {done && ex.scores && (
        <>
          <div className="section-label" style={{ marginTop: 14 }}>Scores by capability · overall {ex.overall}</div>
          {CAPS.map((k) => (
            <div key={k.id} className="ex-capscore">
              <span>{k.label}</span>
              <span className="trk"><i style={{ width: `${ex.scores?.[k.id] ?? 0}%`, background: k.color }} /><u style={{ left: '75%' }} title="Target 75" /></span>
              <b>{ex.scores?.[k.id]}</b>
            </div>
          ))}
        </>
      )}
      {s && !done && (
        <>
          <div className="section-label" style={{ marginTop: 14 }}><CalendarClock size={12} style={{ verticalAlign: -2 }} /> Inject plan ({s.injects.length})</div>
          <Timeline items={s.injects.map((i) => ({ time: `T+${i.t} min`, title: i.title, body: `${i.from} · ${i.prompt}`, color: CAP_BY_ID[i.cap].color }))} />
        </>
      )}
      <div className="section-label" style={{ marginTop: 14 }}>Participants ({ex.participants.length})</div>
      <div className="chips">{ex.participants.map((p) => <span key={p} className="chip">{p}</span>)}</div>
      {done && acts.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 14 }}>Actions raised</div>
          <div className="list">
            {acts.map((a) => (
              <div key={a.id} className="list-row">
                <span className="list-main"><b>{a.title}</b><span>{a.owner} · due {a.dueDays < 0 ? `${-a.dueDays} d ago` : `in ${a.dueDays} d`}</span></span>
                <ActionBadge a={a} />
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}
