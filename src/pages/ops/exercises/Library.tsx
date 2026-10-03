import { useState } from 'react';
import { Play, CalendarPlus, Target, Users, Clock, Layers } from 'lucide-react';
import { Card, Badge, Btn, Chip, KV, Timeline, Callout } from '../../../components/ui';
import { Drawer, Modal } from '../../../components/Overlay';
import { fmtDur } from '../../../lib/format';
import { tenantName } from '../../../data/customers';
import { EX_KINDS, KIND_BY_ID, CAPS, CAP_BY_ID, quarterLabel, type Scenario } from '../../../data/modules/exercises';
import { useApp } from '../../../state/AppContext';
import { useEx } from './state';
import { CapMix, KindBadge, css, scoreColor } from './parts';

export function Library() {
  const { c, scs, exs, ds, param, setParams } = useEx();
  const [open, setOpen] = useState<Scenario | null>(null);
  const kindF = param('kind');
  const list = scs.filter((s) => !kindF || s.kind === kindF);
  const lastRun = (s: Scenario) => exs.filter((e) => e.scenarioId === s.id && e.status === 'completed').sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  return (
    <div className="ex-stack">
      <div className="ex-row">
        <Chip on={!kindF} onClick={() => setParams({ kind: null })}>All {scs.length}</Chip>
        {EX_KINDS.map((k) => (
          <Chip key={k.id} on={kindF === k.id} color={k.color} onClick={() => setParams({ kind: kindF === k.id ? null : k.id })}>
            {k.short} {scs.filter((s) => s.kind === k.id).length}
          </Chip>
        ))}
        <span className="spacer" />
        <span className="ex-muted">{c.short} library · written for {c.sector.toLowerCase()} with HexaShield crisis practice</span>
      </div>

      <div className="grid g3">
        {list.map((s) => {
          const lr = lastRun(s);
          return (
            <button key={s.id} type="button" className="ex-sc" style={css({ '--kc': KIND_BY_ID[s.kind].color })} onClick={() => setOpen(s)}>
              <div className="ex-row">
                <KindBadge kind={s.kind} />
                <Badge color="var(--sev-info)">{s.difficulty}</Badge>
                <span className="spacer" />
                <span className="mono ex-muted">{s.id}</span>
              </div>
              <h4>{s.title}</h4>
              <p>{s.summary}</p>
              <div className="ex-sc-meta">
                <div><b>{fmtDur(s.durationMin)}</b><span>duration</span></div>
                <div><b>{s.injects.length}</b><span>injects</span></div>
                <div><b style={lr?.overall !== undefined ? { color: scoreColor(lr.overall) } : undefined}>{lr?.overall ?? '—'}</b><span>{lr ? 'last score' : 'not run yet'}</span></div>
              </div>
              <CapMix s={s} />
              <div className="ex-muted"><Users size={11} style={{ verticalAlign: -1 }} /> {s.audience}</div>
              <div className="chips">
                {s.frameworks.map((f) => <span key={f} className="chip">{f}</span>)}
                {s.drivers.map((d) => <span key={d} className="chip" style={{ borderColor: 'var(--m-ops)' }}>{ds.find((x) => x.id === d)?.name}</span>)}
              </div>
            </button>
          );
        })}
      </div>

      <Card title="Coverage matrix" sub="Injects per capability for each scenario · darker = more practice · click a row to open">
        <div className="ex-heat">
          <div className="ex-heat-row head">
            <span>Scenario</span>
            {CAPS.map((k) => <span key={k.id}>{k.label}</span>)}
            <span>Total</span>
          </div>
          {list.map((s) => (
            <div key={s.id} className="ex-heat-row">
              <button type="button" className="ex-heat-name" onClick={() => setOpen(s)}>
                <b>{s.title}</b>
                <em>{KIND_BY_ID[s.kind].short} · {tenantName(c, s.tenantId)}</em>
              </button>
              {CAPS.map((k) => {
                const n = s.injects.filter((i) => i.cap === k.id).length;
                return (
                  <button key={k.id} type="button" className="ex-cell" onClick={() => setOpen(s)} style={{ background: n ? k.color : 'var(--surface-sunken)', opacity: n ? 0.35 + Math.min(1, n / 3) * 0.65 : 1, color: n ? '#0b1220' : 'var(--text-muted)' }} title={`${k.label}: ${n} inject${n === 1 ? '' : 's'}`}>
                    {n || '·'}
                  </button>
                );
              })}
              <span className="ex-cell overall">{s.injects.length}</span>
            </div>
          ))}
        </div>
      </Card>

      {open && <ScenarioDrawer s={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ScenarioDrawer({ s, onClose }: { s: Scenario; onClose: () => void }) {
  const { c, ds, exs, startRun, go } = useEx();
  const { toast } = useApp();
  const [sched, setSched] = useState(false);
  const [q, setQ] = useState(String(Math.min(4, Math.floor(new Date().getMonth() / 3) + 2)));
  const runs = exs.filter((e) => e.scenarioId === s.id);
  return (
    <>
      <Drawer
        title={s.title}
        sub={`${s.id} · ${KIND_BY_ID[s.kind].label} · ${s.difficulty}`}
        onClose={onClose}
        wide
        footer={
          <>
            <Btn onClick={() => setSched(true)}><CalendarPlus size={14} /> Schedule</Btn>
            <Btn primary color="var(--m-ops)" onClick={() => { startRun(s.id, null); onClose(); go('run'); }}><Play size={14} /> Run this scenario now</Btn>
          </>
        }
      >
        <p className="secondary" style={{ fontSize: 12.5, marginTop: 0 }}>{s.summary}</p>
        <KV
          rows={[
            [<><Users size={12} /> Audience</>, s.audience],
            [<><Clock size={12} /> Duration</>, `${fmtDur(s.durationMin)} · ${s.injects.length} injects`],
            [<><Layers size={12} /> Scope</>, tenantName(c, s.tenantId)],
            ['Controls exercised', <span className="mono" style={{ fontSize: 11.5 }}>{s.controls.join(' · ')}</span>],
            ['Frameworks', s.frameworks.join(' · ')],
            ['Regulatory drivers', ds.filter((d) => s.drivers.includes(d.id)).map((d) => `${d.name} (${d.requirement})`).join('; ')],
            ['Runs this year', runs.length ? runs.map((e) => `${e.id} ${e.status}${e.overall !== undefined ? ` · ${e.overall}` : ''}`).join(' · ') : 'None yet'],
          ]}
        />
        <div className="section-label" style={{ marginTop: 14 }}><Target size={12} style={{ verticalAlign: -2 }} /> Objectives</div>
        <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 12.5 }}>
          {s.objectives.map((o) => <li key={o}>{o}</li>)}
        </ul>
        <div className="section-label" style={{ marginTop: 10 }}>Inject timeline</div>
        <Timeline items={s.injects.map((i) => ({ time: `T+${i.t} min`, title: i.title, body: `${i.from} · ${i.prompt} · tests ${CAP_BY_ID[i.cap].label.toLowerCase()}`, color: CAP_BY_ID[i.cap].color }))} />
        <div className="section-label" style={{ marginTop: 10 }}>Lessons this scenario has surfaced before</div>
        <div className="list">
          {s.lessons.map(([l, , cap]) => (
            <div key={l} className="list-row"><span className="list-main"><b style={{ fontWeight: 500 }}>{l}</b></span><Badge color={CAP_BY_ID[cap].color}>{CAP_BY_ID[cap].label}</Badge></div>
          ))}
        </div>
      </Drawer>
      {sched && (
        <Modal
          title="Schedule exercise"
          sub={s.title}
          onClose={() => setSched(false)}
          footer={
            <>
              <Btn onClick={() => setSched(false)}>Cancel</Btn>
              <Btn primary color="var(--m-ops)" onClick={() => { setSched(false); toast(`${s.title} proposed for ${quarterLabel(Number(q))}; calendar holds sent to ${s.audience.split(',').length} roles for confirmation`); }}><CalendarPlus size={14} /> Propose to participants</Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Quarter', (
                <select className="select" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Quarter">
                  {[1, 2, 3, 4].map((x) => <option key={x} value={x}>{quarterLabel(x)}</option>)}
                </select>
              )],
              ['Facilitator', 'HexaShield crisis practice (included in the IR retainer)'],
              ['Invitations', s.audience],
              ['Counts towards', ds.filter((d) => s.drivers.includes(d.id)).map((d) => d.name).join(', ')],
            ]}
          />
          <Callout>Holds are proposed, not booked: each participant confirms from their own calendar. Nothing is sent outside {c.short}.</Callout>
        </Modal>
      )}
    </>
  );
}

