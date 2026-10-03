import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, PhoneCall, Play, Sparkles, ArrowRight, Check, CalendarPlus, Globe2, Lock, Radio, FileText } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Btn, Badge, KV, Callout } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtDur } from '../../lib/format';
import { useSeconds } from '../ops/parts';
import { calls as callList, CALL_META, firstName, type Call, type CommsPerson } from '../../data/modules/comms';
import { useComms, Avatar, RecordCard, COMMS_TONE } from './parts';

const AGENDA: Record<Call['kind'], string[]> = {
  incident: ['Situation update from HexaSOC', 'Containment status and pending approvals', 'Business impact and regulatory clocks', 'Communications and next update time'],
  service: ['SLA performance and MDR metrics', 'Open tickets and support sessions', 'Roadmap and upcoming releases', 'Actions from last review'],
  risk: ['Top risks and appetite', 'Broken and stale assurance loops', 'Audit deadlines and overdue evidence', 'Decisions required'],
  insurance: ['Underwriter questions', 'Live evidence pack walkthrough', 'Open gaps and remediation dates', 'Premium and retention options'],
  board: ['Resilience Index and trend', 'Material incidents this quarter', 'Insurance and regulatory position', 'Asks of the board'],
  vendor: ['Access and change windows', 'Open findings and attestations', 'Contractual obligations', 'Next steps'],
};

function when(min: number): { day: string; time: string } {
  const d = new Date(Date.now() + min * 60000);
  const today = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  return {
    day: diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

export default function Bridges() {
  const { customer, tenantId, persona } = useApp();
  return <BridgesInner key={`${customer.id}-${tenantId}-${persona}`} />;
}

function BridgesInner() {
  const { toast } = useApp();
  const nav = useNavigate();
  const sec = useSeconds();
  const { c, me, people, byId, mid } = useComms();
  const all = useMemo(() => callList(c, me, people), [c, me, people]);
  const live = all.find((x) => x.status === 'live');
  const upcoming = all.filter((x) => x.status === 'scheduled').sort((a, b) => a.startMin - b.startMin);
  const recs = all.filter((x) => x.recording);
  const [sel, setSel] = useState<Call | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(true);
  const [rsvp, setRsvp] = useState<Record<string, boolean>>({});
  const [speaker, setSpeaker] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSpeaker((s) => s + 1), 2400);
    return () => clearInterval(t);
  }, []);

  const actions = recs.flatMap((r) => r.recording!.actions.map((a, i) => ({ ...a, key: `${r.id}-${i}`, call: r })));
  const isDone = (k: string, d?: boolean) => done[k] ?? !!d;
  const openActions = actions.filter((a) => !isDone(a.key, a.done));
  const week = upcoming.filter((x) => x.startMin < 7 * 1440);
  const extUpcoming = upcoming.filter((x) => x.external).length;
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const ppl = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is CommsPerson => !!p);
  const liveP = live ? ppl(live.participants) : [];
  const elapsed = live ? -live.startMin * 60 + sec : 0;
  const days = Array.from({ length: 7 }, (_, i) => i);

  const join = (x: Call) => {
    if (x.status === 'live') {
      setJoined(true);
      toast(`Joined “${x.title}” ${muted ? 'muted' : ''} · end-to-end encrypted · attendance written to the audit ledger`);
    } else toast(`“${x.title}” starts ${when(x.startMin).day.toLowerCase()} at ${when(x.startMin).time}; you will get a join reminder 5 minutes before`);
  };

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · encrypted voice and video bridges with colleagues, HexaShield and invited guests. Incident bridges mirror the Crisis War Room; recordings get an AI summary with action items that link straight into HexaView. Recording requires consent from all parties and follows your retention policy.
      </p>

      <KpiStrip toneColor={COMMS_TONE} items={[
        { label: 'Live now', value: live ? 1 : 0, unit: live ? CALL_META[live.kind].label : 'no bridges', onClick: () => scroll('cm-live'), source: 'Communications Hub call service', toneColor: live ? '#f0466e' : undefined },
        { label: 'This week', value: week.length, unit: 'scheduled', onClick: () => scroll('cm-week'), source: 'Communications Hub calendar · Exchange / Google sync' },
        { label: 'With external parties', value: extUpcoming, unit: 'upcoming', onClick: () => scroll('cm-week'), source: 'Guest licences · calendar' },
        { label: 'Recordings', value: recs.length, unit: 'with AI summary', onClick: () => scroll('cm-recs'), source: 'Communications Hub recordings (customer key)' },
        { label: 'Open action items', value: openActions.length, unit: `of ${actions.length}`, onClick: () => scroll('cm-actions'), source: 'HexaAI meeting summaries · linked HexaView records', toneColor: openActions.length ? COMMS_TONE : undefined },
        { label: 'Incident bridge', value: live ? fmtDur(Math.round(elapsed / 60)) : '—', unit: 'elapsed', to: '/ops/warroom', source: 'Crisis War Room · HexaSOC' },
      ]} />

      {live && (
        <div id="cm-live" style={{ scrollMarginTop: 80 }}>
          <Card title={<><span className="cm-live-pill"><i /> Live</span> {live.title}</>} sub={`Hosted by ${byId.get(live.host)?.name ?? 'HexaShield IR'} · ${liveP.length} on the bridge · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} elapsed`}
            actions={<><Btn sm onClick={() => nav('/ops/warroom')}><Radio /> War Room</Btn><Btn sm primary color="#f0466e" onClick={() => join(live)}><PhoneCall /> {joined ? 'Joined' : 'Join bridge'}</Btn></>}>
            <div className="cm-live">
              <div className="cm-stage">
                {liveP.map((p, i) => (
                  <div key={p.id} className={`cm-tile ${speaker % liveP.length === i && p.id !== mid ? 'speaking' : ''}`}>
                    <span className="mic">{p.id === mid ? (joined && !muted ? <Mic size={13} /> : <MicOff size={13} />) : speaker % liveP.length === i ? <Mic size={13} /> : <MicOff size={13} />}</span>
                    <Avatar p={p} size={46} presence={false} />
                    <b>{p.id === mid ? `${firstName(p.name)} (you)` : p.name}</b>
                    <span>{p.party === 'hexashield' ? 'HexaShield' : p.role.split(',')[0]}</span>
                  </div>
                ))}
              </div>
              <div className="stack" style={{ gap: 10, minWidth: 0 }}>
                {live.card && <RecordCard r={live.card} />}
                <div className="cm-ai">
                  <div className="cm-ai-head"><Sparkles size={13} /> Live notes (HexaAI, so far)</div>
                  HexaSOC reports containment holding. Two approvals are pending in the Action Centre. Legal asked for privileged analysis to stay in #incident-bridge. Next update at the top of the hour.
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Btn sm onClick={() => setMuted((m) => !m)}>{muted ? <MicOff /> : <Mic />} {muted ? 'Unmute' : 'Mute'}</Btn>
                  <Btn sm onClick={() => toast('Camera on · background blurred')}><Video /> Camera</Btn>
                  <Btn sm onClick={() => nav('/comms/channels?channel=incident-bridge')}>#incident-bridge <ArrowRight /></Btn>
                </div>
                <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><Lock size={11} /> End-to-end encrypted · recording on with consent · legal hold applies</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid g-3-2">
        <div id="cm-week" style={{ scrollMarginTop: 80, minWidth: 0 }}>
          <Card title="Next 7 days" count={week.length} sub="Click a meeting for agenda, attendees and linked records">
            <div className="cm-week">
              {days.map((d) => {
                const dd = new Date(Date.now() + d * 86400000);
                const evs = upcoming.filter((x) => {
                  const t = new Date(Date.now() + x.startMin * 60000);
                  return t.toDateString() === dd.toDateString();
                });
                return (
                  <div key={d} className={`cm-day-col ${d === 0 ? 'today' : ''}`}>
                    <span>{d === 0 ? 'Today' : dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</span>
                    {evs.map((x) => (
                      <button key={x.id} className="cm-ev" style={{ '--ec': CALL_META[x.kind].color } as CSSProperties} onClick={() => setSel(x)}>
                        <b>{when(x.startMin).time}</b> {x.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              {upcoming.map((x) => {
                const w = when(x.startMin);
                const ps = ppl(x.participants);
                return (
                  <div key={x.id} className="cm-call">
                    <div className="cm-when"><span>{w.day}</span><b>{w.time}</b></div>
                    <div className="cm-call-main" style={{ cursor: 'pointer' }} onClick={() => setSel(x)}>
                      <b>{x.title}</b>
                      <div className="sub">
                        <Badge color={CALL_META[x.kind].color}>{CALL_META[x.kind].label}</Badge>
                        {x.external && <span className="cm-tag ext"><Globe2 size={10} /> External</span>}
                        <span>{x.durationMin} min</span>
                        <span className="cm-av-stack">{ps.slice(0, 5).map((p) => <Avatar key={p.id} p={p} size={20} presence={false} />)}</span>
                        {ps.length > 5 && <span>+{ps.length - 5}</span>}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <Btn sm onClick={() => { setRsvp((r) => ({ ...r, [x.id]: true })); toast(`Accepted “${x.title}”; calendar updated`); }}>{rsvp[x.id] ? <><Check /> Going</> : 'RSVP'}</Btn>
                      <Btn sm primary color={COMMS_TONE} onClick={() => join(x)}>Join</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Btn sm onClick={() => toast('Scheduling assistant: pick attendees, and HexaView attaches the relevant records as the agenda')}><CalendarPlus /> Schedule a call</Btn>
            </div>
          </Card>
        </div>

        <div id="cm-recs" style={{ scrollMarginTop: 80, minWidth: 0 }}>
          <Card title="Recordings & AI summaries" count={recs.length} sub="Recorded with consent · summaries by HexaAI · encrypted with your key">
            {recs.map((r) => {
              const w = when(r.startMin);
              const n = r.recording!.actions.length;
              const open = r.recording!.actions.filter((a, i) => !isDone(`${r.id}-${i}`, a.done)).length;
              return (
                <div key={r.id} className="cm-rec-item" onClick={() => setSel(r)}>
                  <span className="cm-play"><Play size={16} /></span>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 12.5 }}>{r.title}</b>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{w.day} {w.time} · {r.recording!.lengthMin} min · {r.participants.length} people</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.recording!.summary}</div>
                  </div>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge color={CALL_META[r.kind].color}>{CALL_META[r.kind].label}</Badge>
                    <span className="muted" style={{ fontSize: 11 }}>{open}/{n} actions open</span>
                  </span>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      <div id="cm-actions" style={{ scrollMarginTop: 80 }}>
        <Card title="Action items from meetings" count={openActions.length} sub="Extracted by HexaAI from recordings; each links to the HexaView record that closes it" flush>
          <DataTable
            rows={actions}
            rowKey={(a) => a.key}
            onRowClick={(a) => nav(a.path)}
            initialSort={{ key: 'due', dir: 'asc' }}
            columns={[
              { key: 'done', header: '', render: (a) => <button className={`cm-check ${isDone(a.key, a.done) ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); setDone((d) => ({ ...d, [a.key]: !isDone(a.key, a.done) })); }} aria-label="Toggle done">{isDone(a.key, a.done) && <Check size={11} />}</button> },
              { key: 'text', header: 'Action', sort: (a) => a.text, render: (a) => <div><div className="t-main" style={{ textDecoration: isDone(a.key, a.done) ? 'line-through' : undefined }}>{a.text}</div><div className="t-sub">from “{a.call.title}”</div></div> },
              { key: 'owner', header: 'Owner', sort: (a) => byId.get(a.owner)?.name ?? a.owner, render: (a) => { const p = byId.get(a.owner); return p ? <span className="row" style={{ gap: 6 }}><Avatar p={p} size={22} presence={false} /><span className="t-sub">{p.name}</span></span> : a.owner; } },
              { key: 'due', header: 'Due', sort: (a) => a.dueDays, render: (a) => <span className="t-sub" style={{ color: !isDone(a.key, a.done) && a.dueDays <= 2 ? 'var(--sev-medium)' : undefined }}>in {a.dueDays} d</span> },
              { key: 'go', header: 'Opens', render: (a) => <button className="link" onClick={(e) => { e.stopPropagation(); nav(a.path); }}>{a.path} →</button> },
            ]}
          />
        </Card>
      </div>

      {sel && (
        <Drawer wide={!!sel.recording} title={sel.title} sub={`${CALL_META[sel.kind].label} · ${when(sel.startMin).day} ${when(sel.startMin).time} · ${sel.recording ? `${sel.recording.lengthMin} min recording` : `${sel.durationMin} min`}`} onClose={() => setSel(null)}
          footer={sel.recording
            ? <><Btn onClick={() => toast('Transcript exported (redacted) and written to the audit ledger')}><FileText /> Export transcript</Btn><Btn onClick={() => toast('Summary shared to the attendees')}>Share summary</Btn></>
            : <><Btn onClick={() => { setRsvp((r) => ({ ...r, [sel.id]: true })); toast('Accepted; calendar updated'); }}>RSVP</Btn><Btn primary color={COMMS_TONE} onClick={() => join(sel)}><PhoneCall /> Join</Btn></>}>
          {sel.recording && (
            <>
              <div className="cm-wave">{Array.from({ length: 90 }, (_, i) => <i key={i} className={i < 34 ? 'p' : ''} style={{ height: `${20 + Math.abs(Math.sin(i * 1.7) * 60 + Math.cos(i * 0.6) * 20)}%` }} />)}</div>
              <div className="row" style={{ gap: 6, marginBottom: 14 }}><Btn sm onClick={() => toast('Playing recording (decrypted locally)')}><Play /> Play</Btn><span className="muted" style={{ fontSize: 11 }}>Encrypted with your tenant key · retention 1 year</span></div>
              <div className="cm-ai">
                <div className="cm-ai-head"><Sparkles size={13} /> AI summary</div>
                {sel.recording.summary}
              </div>
              <div className="section-label" style={{ marginTop: 16 }}>Decisions</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>{sel.recording.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
              <div className="section-label" style={{ marginTop: 16 }}>Action items</div>
              {sel.recording.actions.map((a, i) => {
                const k = `${sel.id}-${i}`;
                const p = byId.get(a.owner);
                return (
                  <div key={k} className="cm-action">
                    <button className={`cm-check ${isDone(k, a.done) ? 'on' : ''}`} onClick={() => setDone((d) => ({ ...d, [k]: !isDone(k, a.done) }))} aria-label="Toggle done">{isDone(k, a.done) && <Check size={11} />}</button>
                    <span className="tx"><b style={{ textDecoration: isDone(k, a.done) ? 'line-through' : undefined }}>{a.text}</b><small>{p?.name ?? a.owner} · due in {a.dueDays} days</small></span>
                    <Btn sm onClick={() => nav(a.path)}>Open <ArrowRight /></Btn>
                  </div>
                );
              })}
            </>
          )}
          {!sel.recording && (
            <>
              <KV rows={[
                ['Host', byId.get(sel.host)?.name ?? sel.host],
                ['When', `${when(sel.startMin).day} ${when(sel.startMin).time} · ${sel.durationMin} min`],
                ['Security', 'End-to-end encrypted · waiting room for guests · recording only with consent'],
                ['External', sel.external ? 'Yes: guests join via a one-time link and see only this call' : 'No'],
              ]} />
              <div className="section-label" style={{ marginTop: 16 }}>Agenda</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>{AGENDA[sel.kind].map((a, i) => <li key={i}>{a}</li>)}</ol>
              {sel.card && <><div className="section-label" style={{ marginTop: 16 }}>Linked record</div><RecordCard r={sel.card} /></>}
            </>
          )}
          <div className="section-label" style={{ marginTop: 16 }}>Participants</div>
          <div className="list">
            {ppl(sel.participants).map((p) => (
              <div key={p.id} className="list-row">
                <Avatar p={p} size={28} />
                <span className="list-main"><b>{p.name}{p.id === mid ? ' (you)' : ''}</b><span>{p.role} · {p.org}</span></span>
              </div>
            ))}
          </div>
          {sel.kind === 'insurance' && <div style={{ marginTop: 12 }}><Callout>The broker and carrier join as guests and see only the shared evidence pack, not the rest of HexaView.</Callout></div>}
        </Drawer>
      )}
    </>
  );
}
