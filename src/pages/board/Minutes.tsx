import { useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Bell, BadgeCheck, Copy, GraduationCap } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Badge, Btn, Callout } from '../../components/ui';
import { useIntro } from '../../lib/useIntro';
import { headlines, resilienceIndex, riTrend, riDrivers } from '../../data/core';
import { boardDuties, mainFramework, isOverdue, cfoOf, type TrainingStatus } from '../../data/modules/boardMeeting';
import { NOW, fmtDate, fmtDateShort, fmtMoney, fmtNum } from '../../lib/format';
import { useBm, useBmNav, BM_TONE, initials } from './state';

const TRAIN_COLOR: Record<TrainingStatus, string> = { Completed: 'var(--good)', 'Due soon': 'var(--sev-medium)', Overdue: 'var(--bad)' };

export interface MinutePara { n: string; heading: string; text: string; path?: string }

/** Draft minute of the cyber item, assembled from live data and in-session decisions. */
export function useMinutes(): MinutePara[] {
  const { customer: c } = useApp();
  const { m, questions, requests, recorded, actions } = useBm();
  return useMemo(() => {
    const h = headlines(c);
    const ri = resilienceIndex(c);
    const trend = riTrend(c);
    const drivers = riDrivers(c);
    const duties = boardDuties(c);
    const main = mainFramework(c);
    const money = (n: number) => fmtMoney(n, c.currency);
    const present = m.directors.filter((d) => d.kind !== 'In attendance' && d.attending !== 'Apologies');
    const apologies = m.directors.filter((d) => d.attending === 'Apologies');
    const inAtt = m.directors.filter((d) => d.kind === 'In attendance');
    const red = questions.filter((q) => q.rag === 'red');
    const qDelta = trend[11] - trend[8];
    const overdue = actions.filter(isOverdue);
    const cfo = cfoOf(c);
    const decided = requests.filter((q) => recorded[q.id]);
    const pending = requests.filter((q) => !recorded[q.id]);
    const confirmedVoting = m.directors.filter((d) => d.voting && d.attending !== 'Apologies').length;
    return [
      { n: '1', heading: 'Attendance and quorum', text: `Present: ${present.map((d) => `${d.name} (${d.role})`).join('; ')}. In attendance: ${inAtt.map((d) => `${d.name} (${d.role})`).join('; ')}.${apologies.length ? ` Apologies: ${apologies.map((d) => d.name).join(', ')}.` : ''} The Chair confirmed the meeting was ${confirmedVoting >= m.quorum ? 'quorate' : 'NOT quorate'} (quorum ${m.quorum}). No conflicts of interest were declared in relation to the cyber item.` },
      { n: '2', heading: 'Cyber resilience report', path: '/board/view', text: `${c.people.ciso.name} presented the cyber resilience report. The Resilience Index stands at ${ri.value} (${qDelta >= 0 ? '+' : ''}${qDelta} in the quarter). The committee noted that the largest modelled improvement is to ${drivers[0].text.charAt(0).toLowerCase()}${drivers[0].text.slice(1)} (+${drivers[0].gain.toFixed(1)}).` },
      { n: '3', heading: 'Incidents and vulnerabilities', path: '/soc/ir', text: `Since the last meeting ${fmtNum(m.incidentsSince.handled)} security incidents were handled, ${m.incidentsSince.major} of them major, and ${m.incidentsSince.notifiable ? `${m.incidentsSince.notifiable} was notifiable to a regulator` : 'none was notifiable to a regulator'}. ${fmtNum(h.soc.openIncidents)} remain open; median time to contain is ${h.soc.mttrMin} minutes.` },
      { n: '4', heading: 'Financial exposure and insurance', path: '/insurance/quantification', text: `${cfo.name} reported an expected annual cyber loss of ${money(h.insurance.expectedLossM * 1e6)} and a 1-in-100-year loss of ${money(h.insurance.tailLossM * 1e6)} against a policy limit of ${money(c.insurance.limitM * 1e6)} with ${c.insurance.carrier}; renewal falls in ${c.insurance.renewalDays} days.` },
      { n: '5', heading: 'Regulation and directors’ accountability', path: '/comply/horizon?section=board', text: `${c.people.grcLead.name} reminded directors of their duties under ${duties.map((d) => d.reg).join('; ')}.${main ? ` ${main.short} coverage is ${main.documented}% documented and ${main.assured}% assured.` : ''} ${fmtNum(h.comply.overdueTasks)} compliance tasks are overdue.` },
      { n: '6', heading: 'Challenge from directors', path: '/board/meeting?section=questions', text: red.length ? `Directors challenged management on: ${red.map((q) => q.q.replace(/\?$/, '').toLowerCase()).join('; ')}. Management responded with the evidence referenced in the papers.` : 'Directors reviewed the standard cyber questions; no item was rated red.' },
      { n: '7', heading: 'Decisions', path: '/board/meeting?section=decisions', text: [
        ...decided.map((q) => { const rc = recorded[q.id]; const o = q.options.find((x) => x.id === rc.option); return `RESOLVED (${rc.outcome.toLowerCase()}): ${q.title}${rc.outcome === 'Approved' && o ? ` — ${o.label}` : ''}.${rc.note ? ` ${rc.note}` : ''}`; }),
        ...pending.map((q) => `[To be recorded] ${q.title}; management recommends: ${q.options.find((o) => o.id === q.recommended)?.label ?? '—'}.`),
      ].join(' ') },
      { n: '8', heading: 'Actions', path: '/board/meeting?section=actions', text: `${actions.filter((a) => a.status === 'Complete').length} of ${actions.length} previous actions are complete.${overdue.length ? ` Overdue: ${overdue.map((a) => `${a.id} (${a.owner.name})`).join(', ')}; owners to report at the next meeting.` : ''}` },
    ];
  }, [c, m, questions, requests, recorded, actions]);
}

export default function Minutes() {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const { m, attest, setPrint } = useBm();
  const { sp } = useBmNav();
  const paras = useMinutes();
  const anim = useIntro(`bm-min-${c.id}`, 1500);
  const focus = sp.get('focus');
  useEffect(() => {
    if (focus) document.getElementById(`bm-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus]);

  const board = m.directors.filter((d) => d.kind !== 'In attendance');
  const done = board.filter((d) => d.training.status === 'Completed').length;
  const pct = Math.round((done / Math.max(1, board.length)) * 100);
  const R = 40;
  const C = 2 * Math.PI * R;
  const course = board[0]?.training.course ?? 'Board cyber training';

  return (
    <div className="grid g-3-2">
      <Card title={`Draft minutes · cyber item, ${m.committee}`} sub={`For ${fmtDate(m.date)} · drafted by HexaView from the papers and in-session decisions · requires ${m.secretary.name}’s review`}
        actions={<span className="row" style={{ gap: 6 }}>
          <Btn sm onClick={() => { navigator.clipboard?.writeText(paras.map((p) => `${p.n}. ${p.heading}\n${p.text}`).join('\n\n')).catch(() => undefined); toast('Draft minute copied to the clipboard'); }}><Copy /> Copy</Btn>
          <Btn sm primary color={BM_TONE} onClick={() => setPrint('minutes')}><Printer /> Print minute extract</Btn>
        </span>}>
        <ol className="bm-minutes">
          {paras.map((p) => (
            <li key={p.n}>
              <div className="row between" style={{ gap: 8 }}>
                <b>{p.n}. {p.heading}</b>
                {p.path && <button type="button" className="bm-link" onClick={() => nav(p.path!)}>Source →</button>}
              </div>
              <p className={p.text.includes('[To be recorded]') ? 'pending' : ''}>{p.text}</p>
            </li>
          ))}
        </ol>
        <Callout kind="info">Text in the decisions paragraph updates as outcomes are recorded on the Decisions log tab. Minutes are retained with the cited evidence in HexaCustody.</Callout>
      </Card>

      <div id="bm-training">
        <Card title="Director cyber-training attestation" sub={course} toneColor={BM_TONE}>
          <div className="bm-train-head">
            <button type="button" className="bm-train-ring" onClick={() => nav('/comply/human')} title="Source: HexaComply human risk and training · open the training programme">
              <svg viewBox="0 0 100 100" width={100} height={100} aria-hidden>
                <circle cx={50} cy={50} r={R} fill="none" stroke="var(--track)" strokeWidth={9} />
                <circle cx={50} cy={50} r={R} fill="none" stroke={pct === 100 ? '#2dd4bf' : '#f0a338'} strokeWidth={9} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - anim(pct) / 100)} transform="rotate(-90 50 50)" />
              </svg>
              <span><b className="num">{Math.round(anim(pct))}%</b><small>{done}/{board.length}</small></span>
            </button>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              Directors are expected to keep their cyber knowledge current{boardDuties(c).some((d) => d.personal) ? '; several regimes that apply to us make this a personal duty' : ''}. Completion is recorded in HexaComply as evidence.
            </p>
          </div>
          <div className="bm-train">
            {board.map((d) => (
              <div key={d.name} className="bm-train-row" style={{ '--tone': TRAIN_COLOR[d.training.status] } as CSSProperties}>
                <span className="bm-av">{initials(d.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <b>{d.name}</b>
                  <small>{d.role}</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge color={TRAIN_COLOR[d.training.status]} dot solid={d.training.status === 'Overdue'}>{d.training.status}</Badge>
                  <small className="muted" style={{ display: 'block', marginTop: 3 }}>
                    {d.training.status === 'Completed' ? `${fmtDate(d.training.date)} · ${d.training.hours} h · ${d.training.provider}` : d.training.status === 'Overdue' ? `due ${fmtDateShort(d.training.date)} · ${Math.round((NOW.getTime() - d.training.date.getTime()) / 86_400_000)} d late` : `due ${fmtDateShort(d.training.date)}`}
                  </small>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {d.training.status !== 'Completed' && (
                    <>
                      <Btn sm ghost onClick={() => toast(`Reminder sent to ${d.name} with the course link · copied to ${m.secretary.name}`)} title="Send reminder"><Bell /></Btn>
                      <Btn sm onClick={() => { attest(d.name); toast(`${d.name}: training attestation recorded · evidence filed in HexaComply`); }} title="Record attestation"><BadgeCheck /></Btn>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="card-foot row between" style={{ gap: 8 }}>
            <span><GraduationCap size={13} style={{ verticalAlign: -2 }} /> Executives in attendance follow the staff programme</span>
            <button type="button" className="bm-link" onClick={() => nav('/comply/human')}>Training programme →</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
