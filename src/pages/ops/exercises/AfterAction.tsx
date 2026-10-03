import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, UploadCloud, ExternalLink, Printer, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, Badge, Btn, Callout, Chip, KV, Ring, Timeline, Empty } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { fmtDate, fmtDateShort, fmtDur, NOW } from '../../../lib/format';
import { tenantName } from '../../../data/customers';
import { CAPS, CAP_BY_ID, KIND_BY_ID, type Cap, type ExAction, type Exercise, type ActionStatus } from '../../../data/modules/exercises';
import { FilterChip } from '../parts';
import { useEx } from './state';
import { ActionBadge, CapBadge, KindBadge, actionState, heatHex, scoreColor } from './parts';

const NEXT: Record<ActionStatus, ActionStatus> = { open: 'in_progress', in_progress: 'done', done: 'open' };

export function AfterAction() {
  const { c, exs, actions, param, setParams, isPushed, pushEvidence, ds, scById } = useEx();
  const nav = useNavigate();
  const [printing, setPrinting] = useState(false);
  const completed = exs.filter((e) => e.status === 'completed').sort((a, b) => b.date.getTime() - a.date.getTime());
  const qF = param('q');
  const capF = param('cap') as Cap | null;
  const actF = param('actions');
  const shown = completed.filter((e) => !qF || String(e.quarter) === qF);
  const exId = param('ex');
  const sel = completed.find((e) => e.id === exId) ?? shown[0] ?? completed[0];
  const [scope, setScope] = useState<'this' | 'all'>(capF || actF ? 'all' : 'this');

  if (!completed.length) return <Empty>No completed exercises in this scope yet. Run one from the programme.</Empty>;
  if (!sel) return null;
  if (printing) return <AarPaper ex={sel} onBack={() => setPrinting(false)} />;

  const avg = (k: Cap) => Math.round(completed.reduce((s, e) => s + (e.scores?.[k] ?? 0), 0) / completed.length);
  const selActs = actions.filter((a) => a.exerciseId === sel.id);
  const actRows = (scope === 'this' ? selActs : actions).filter((a) => (!capF || a.cap === capF) && (!actF || (actF === 'open' ? a.status !== 'done' : actionState(a) === actF)));
  const pushed = isPushed(sel);
  const sc = scById.get(sel.scenarioId);
  const drv = ds.filter((d) => sel.drivers.includes(d.id));

  return (
    <div className="ex-stack">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 16 }}>
        <Card title="Completed" count={shown.length} sub={qF ? `Q${qF} only` : 'Most recent first'} actions={<FilterChip label={qF ? `Q${qF}` : null} onClear={() => setParams({ q: null })} />}>
          <div className="stack" style={{ gap: 6, maxHeight: 640, overflowY: 'auto' }}>
            {shown.map((e) => (
              <button key={e.id} type="button" className={`ex-pick-ex ${e.id === sel.id ? 'on' : ''}`} onClick={() => setParams({ ex: e.id })}>
                <span>{e.id} · {fmtDateShort(e.date)}{e.live ? ' · live' : ''}</span>
                <b>{e.title}</b>
                <span className="ex-row"><Badge color={KIND_BY_ID[e.kind].color}>{KIND_BY_ID[e.kind].short}</Badge><b style={{ marginLeft: 'auto', color: scoreColor(e.overall ?? 0) }}>{e.overall}</b></span>
              </button>
            ))}
          </div>
        </Card>

        <div className="ex-stack" style={{ minWidth: 0 }}>
          <Card
            title={sel.title}
            sub={`${sel.id} · ${fmtDate(sel.date)} · ${tenantName(c, sel.tenantId)} · facilitated by ${sel.facilitator}`}
            actions={
              <div className="ex-row">
                {pushed ? (
                  <Btn sm onClick={() => nav('/comply/caas?section=tasks')}><ExternalLink size={13} /> Open in HexaComply</Btn>
                ) : (
                  <Btn sm primary color="var(--m-comply)" onClick={() => pushEvidence(sel)}><UploadCloud size={13} /> Push evidence to HexaComply</Btn>
                )}
                <Btn sm primary color="var(--m-ops)" onClick={() => setPrinting(true)}><FileText size={13} /> Generate after-action report</Btn>
              </div>
            }
          >
            <div className="ex-row" style={{ gap: 18, alignItems: 'flex-start' }}>
              <Ring value={sel.overall ?? 0} size={92} stroke={9} color={scoreColor(sel.overall ?? 0)} sub="overall" />
              <div style={{ flex: 1, minWidth: 260 }}>
                {CAPS.map((k) => (
                  <div key={k.id} className="ex-capscore">
                    <span>{k.label}</span>
                    <span className="trk" title={`Score ${sel.scores?.[k.id]} · programme average ${avg(k.id)} · target 75`}>
                      <i style={{ width: `${sel.scores?.[k.id] ?? 0}%`, background: k.color }} />
                      <u style={{ left: '75%' }} />
                      <s style={{ left: `${avg(k.id)}%` }} />
                    </span>
                    <b style={{ color: scoreColor(sel.scores?.[k.id] ?? 0) }}>{sel.scores?.[k.id]}</b>
                  </div>
                ))}
                <div className="ex-muted">White tick: target 75 · grey tick: programme average</div>
              </div>
              <div style={{ minWidth: 220 }}>
                <KV
                  rows={[
                    ['Type', <KindBadge key="k" kind={sel.kind} />],
                    ['Attendance', `${sel.attended} of ${sel.invited} (${Math.round((sel.attended / Math.max(1, sel.invited)) * 100)}%)`],
                    ['Duration', fmtDur(sel.durationMin)],
                    ['Drivers', drv.map((d) => d.name).join(' · ')],
                    ['Evidence', <span key="e">{sel.evidenceId} {pushed ? <Badge color="var(--good)" dot>In HexaComply</Badge> : <Badge color="var(--sev-medium)" dot>Not pushed</Badge>}</span>],
                  ]}
                />
              </div>
            </div>
            {!pushed && <Callout kind="warn">Evidence for {drv.map((d) => d.name).join(' and ')} is not in HexaComply yet. Push it so auditors see the report, attendance and actions against the requirement.</Callout>}
          </Card>

          <div className="grid g2">
            <Card title="Lessons learned" count={sel.lessons.length}>
              {sel.lessons.map((l, i) => (
                <div key={l} className="ex-lesson"><em>{String(i + 1).padStart(2, '0')}</em><span>{l}</span></div>
              ))}
              {!sel.lessons.length && <div className="ex-muted">No lessons recorded.</div>}
            </Card>
            {sel.decisions?.length ? (
              <Card title="Decision log" count={sel.decisions.length} sub="Recorded live during the run">
                <Timeline items={sel.decisions.map((d) => ({ time: `T+${d.t}m`, title: d.text, body: `${d.by} · ${d.ttd} min to decide`, color: d.ttd > 20 ? 'var(--sev-high)' : 'var(--m-ops)' }))} />
              </Card>
            ) : (
              <Card title="Scenario recap" sub={sc?.id}>
                <p className="secondary" style={{ fontSize: 12.5, marginTop: 0 }}>{sc?.summary}</p>
                <Timeline items={(sc?.injects ?? []).map((i) => ({ time: `T+${i.t}m`, title: i.title, body: i.prompt, color: CAP_BY_ID[i.cap].color }))} />
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="grid g-2-1">
        <Card
          title="Actions from exercises"
          count={actRows.length}
          flush
          sub="Click a row to move it on (open → in progress → done); every change syncs to the HexaComply task"
          actions={
            <div className="ex-row">
              <Chip on={scope === 'this'} onClick={() => setScope('this')}>This exercise</Chip>
              <Chip on={scope === 'all'} onClick={() => setScope('all')}>All exercises</Chip>
              <FilterChip label={[capF && CAP_BY_ID[capF]?.label, actF].filter(Boolean).join(' · ') || null} onClear={() => setParams({ cap: null, actions: null })} />
            </div>
          }
        >
          <ActionsTable rows={actRows} />
        </Card>
        <Card title="Scores across the programme" sub="Completed exercises × capability · click a row">
          <div className="ex-heat">
            <div className="ex-heat-row head" style={{ gridTemplateColumns: 'minmax(110px, 1.4fr) repeat(5, minmax(30px, 1fr)) 40px' }}>
              <span>Exercise</span>
              {CAPS.map((k) => <span key={k.id} title={k.label}>{k.label.slice(0, 3)}</span>)}
              <span>All</span>
            </div>
            {completed.slice(0, 12).map((e) => (
              <div key={e.id} className={`ex-heat-row ${e.id === sel.id ? 'on' : ''}`} style={{ gridTemplateColumns: 'minmax(110px, 1.4fr) repeat(5, minmax(30px, 1fr)) 40px' }}>
                <button type="button" className="ex-heat-name" onClick={() => setParams({ ex: e.id })}>
                  <b>{e.id}</b>
                  <em>{KIND_BY_ID[e.kind].short} · Q{e.quarter}</em>
                </button>
                {CAPS.map((k) => (
                  <button key={k.id} type="button" className="ex-cell" style={{ background: heatHex(e.scores?.[k.id] ?? 0) }} onClick={() => setParams({ ex: e.id })} title={`${k.label}: ${e.scores?.[k.id]}`}>
                    {e.scores?.[k.id]}
                  </button>
                ))}
                <span className="ex-cell overall">{e.overall}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActionsTable({ rows }: { rows: ExAction[] }) {
  const { setActionStatus, exs } = useEx();
  return (
    <DataTable
      rows={rows}
      rowKey={(a) => a.id}
      initialSort={{ key: 'due', dir: 'asc' }}
      onRowClick={(a) => setActionStatus(a.id, NEXT[a.status])}
      search={(a) => `${a.id} ${a.title} ${a.owner} ${a.cap}`}
      searchPlaceholder="Search actions, owners…"
      empty="No actions match."
      columns={[
        { key: 'id', header: 'ID', sort: (a) => a.id, render: (a) => <span className="mono" style={{ fontSize: 11.5 }}>{a.id}</span> },
        { key: 'title', header: 'Action', render: (a) => <><div className="t-main">{a.title}</div><div className="t-sub">{exs.find((e) => e.id === a.exerciseId)?.title}</div></> },
        { key: 'cap', header: 'Capability', sort: (a) => a.cap, render: (a) => <CapBadge cap={a.cap} /> },
        { key: 'owner', header: 'Owner', sort: (a) => a.owner, render: (a) => <span style={{ fontSize: 12 }}>{a.owner}</span> },
        { key: 'due', header: 'Due', sort: (a) => a.dueDays, render: (a) => <span style={{ color: actionState(a) === 'overdue' ? 'var(--bad)' : undefined, fontSize: 12 }}>{fmtDateShort(new Date(NOW.getTime() + a.dueDays * 86_400_000))}</span> },
        { key: 'st', header: 'Status', sort: (a) => actionState(a), render: (a) => <ActionBadge a={a} /> },
        { key: 'push', header: 'HexaComply', render: (a) => (a.pushed ? <Badge color="var(--good)" dot>Synced</Badge> : <span className="muted" style={{ fontSize: 11.5 }}>Local</span>) },
      ]}
    />
  );
}

/** Printable after-action report (Print / Save as PDF). */
function AarPaper({ ex, onBack }: { ex: Exercise; onBack: () => void }) {
  const { c, scById, ds, actions, isPushed } = useEx();
  const nav = useNavigate();
  const sc = scById.get(ex.scenarioId);
  const acts = actions.filter((a) => a.exerciseId === ex.id);
  const drv = ds.filter((d) => ex.drivers.includes(d.id));
  return (
    <div className="ex-stack">
      <div className="ex-row ex-noprint">
        <Btn onClick={onBack}><ArrowLeft size={14} /> Back to after-action</Btn>
        <span className="spacer" />
        <Btn onClick={() => nav('/reports/builder?template=exercise-aar')}><ExternalLink size={14} /> Open in Report Builder</Btn>
        <Btn primary color="var(--m-ops)" onClick={() => window.print()}><Printer size={14} /> Print / save PDF</Btn>
      </div>
      <article className="ex-paper">
        <div className="kick">{c.name} · Crisis exercise after-action report · Confidential</div>
        <h1>{ex.title}</h1>
        <div className="meta">
          <span>{ex.id}</span>
          <span>{fmtDate(ex.date)}</span>
          <span>{KIND_BY_ID[ex.kind].label}</span>
          <span>{tenantName(c, ex.tenantId)}</span>
          <span>Facilitator: {ex.facilitator}</span>
          <span>Overall score: <b>{ex.overall}/100</b></span>
        </div>

        <h2>1 · Scenario and objectives</h2>
        <p>{sc?.summary}</p>
        <ul>{sc?.objectives.map((o) => <li key={o}>{o}</li>)}</ul>

        <h2>2 · Regulatory drivers satisfied</h2>
        <table>
          <thead><tr><th>Driver</th><th>Requirement</th><th>Evidence</th></tr></thead>
          <tbody>
            {drv.map((d) => <tr key={d.id}><td>{d.name}</td><td>{d.requirement}</td><td>{ex.evidenceId}{isPushed(ex) ? ' · filed in HexaComply' : ' · pending'}</td></tr>)}
          </tbody>
        </table>

        <h2>3 · Scores by capability</h2>
        <div className="bars">
          {CAPS.map((k) => (
            <div key={k.id}>
              <span>{k.label}</span>
              <span className="t"><i style={{ width: `${ex.scores?.[k.id] ?? 0}%`, background: k.color }} /></span>
              <b>{ex.scores?.[k.id]}</b>
            </div>
          ))}
        </div>

        <h2>4 · {ex.decisions?.length ? 'Decision log' : 'Inject timeline'}</h2>
        <table>
          <thead><tr><th>Time</th><th>{ex.decisions?.length ? 'Decision' : 'Inject'}</th><th>{ex.decisions?.length ? 'By · time to decide' : 'Question for the room'}</th></tr></thead>
          <tbody>
            {ex.decisions?.length
              ? ex.decisions.map((d, i) => <tr key={i}><td>T+{d.t} min</td><td>{d.text}</td><td>{d.by} · {d.ttd} min</td></tr>)
              : (sc?.injects ?? []).map((i) => <tr key={i.t}><td>T+{i.t} min</td><td>{i.title}</td><td>{i.prompt}</td></tr>)}
          </tbody>
        </table>

        <h2>5 · Lessons learned</h2>
        <ol>{ex.lessons.map((l) => <li key={l}>{l}</li>)}</ol>

        <h2>6 · Actions</h2>
        <table>
          <thead><tr><th>ID</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {acts.map((a) => <tr key={a.id}><td>{a.id}</td><td>{a.title}</td><td>{a.owner}</td><td>{fmtDateShort(new Date(NOW.getTime() + a.dueDays * 86_400_000))}</td><td>{actionState(a).replace('_', ' ')}</td></tr>)}
          </tbody>
        </table>

        <h2>7 · Participation</h2>
        <p>{ex.attended} of {ex.invited} invited attended ({Math.round((ex.attended / Math.max(1, ex.invited)) * 100)}%): {ex.participants.join(', ')}.</p>

        <div className="sig">
          <div>Exercise lead<br />{ex.facilitator}</div>
          <div>Accountable executive<br />{c.people.ciso.name}</div>
          <div>Compliance sign-off<br />{c.people.grcLead.name}</div>
        </div>
        <div className="foot">
          <span>{c.short} · {ex.id} · generated {fmtDate(NOW)} by HexaView</span>
          <span><CheckCircle2 size={11} style={{ verticalAlign: -1 }} /> Evidence {ex.evidenceId} · SHA-256 anchored to the audit ledger on release</span>
        </div>
      </article>
    </div>
  );
}
