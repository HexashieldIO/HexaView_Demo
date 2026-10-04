import { useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, FileText, Check, Clock, MapPin, Users, ArrowRight, CalendarDays } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Badge, Btn, Legend, Stacked } from '../../components/ui';
import { useIntro } from '../../lib/useIntro';
import { NOW, fmtDate, fmtDateShort } from '../../lib/format';
import type { DirectorKind, PaperStage, Purpose } from '../../data/modules/boardMeeting';
import { useBm, useBmNav, BM_TONE, paperReadiness, initials } from './state';

const PURPOSE_COLOR: Record<Purpose, string> = { 'For approval': 'var(--m-view)', 'For decision': 'var(--sev-high)', 'For discussion': 'var(--m-reports)', 'For noting': 'var(--text-muted)' };
const KIND_COLOR: Record<DirectorKind, string> = { Chair: 'var(--m-view)', 'Non-executive': 'var(--m-reports)', Executive: 'var(--m-programme)', 'In attendance': 'var(--text-muted)' };
const ATTEND_COLOR = { Confirmed: 'var(--good)', Tentative: 'var(--sev-medium)', Apologies: 'var(--text-muted)' } as const;

function addMin(d: Date, min: number): string {
  const t = new Date(d.getTime() + min * 60_000);
  return t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function NextMeeting() {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const { m, papers, setPaper, setPrint } = useBm();
  const { sp } = useBmNav();
  const anim = useIntro(`bm-next-${c.id}`, 1800);
  const focus = sp.get('focus');

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`bm-${focus}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus]);

  const span = m.date.getTime() - m.prevDate.getTime();
  const elapsed = Math.max(0, Math.min(1, (NOW.getTime() - m.prevDate.getTime()) / span));
  const total = m.agenda.reduce((s, a) => s + a.minutes, 0);
  const pr = paperReadiness(papers);
  const voting = m.directors.filter((d) => d.voting);
  const confirmed = voting.filter((d) => d.attending === 'Confirmed').length;
  const packDays = Math.round((m.packDue.getTime() - NOW.getTime()) / 86_400_000);
  const paperById = new Map(papers.map((p) => [p.id, p]));

  // Countdown ring
  const R = 62;
  const C = 2 * Math.PI * R;
  const prog = elapsed * Math.min(1, anim(1, 0, 1400));

  let cursor = 0;
  return (
    <>
      <div className="grid g-1-2">
        <div className="bm-col">
        <Card title="Next meeting" sub={`${m.committee} · cyber standing item`} toneColor={BM_TONE}>
          <div className="bm-hero">
            <button type="button" className="bm-count" onClick={() => toast(`Calendar hold sent to ${m.directors.length} attendees · ${fmtDate(m.date)} ${m.time}`)} title="Source: company secretariat calendar · click to resend the calendar hold">
              <svg viewBox="0 0 150 150" width={150} height={150} aria-hidden>
                <circle cx={75} cy={75} r={R} fill="none" stroke="var(--track)" strokeWidth={10} />
                <circle cx={75} cy={75} r={R} fill="none" stroke="#20b292" strokeWidth={10} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - prog)} transform="rotate(-90 75 75)" />
                {Array.from({ length: 13 }, (_, i) => {
                  const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
                  return <line key={i} x1={75 + Math.cos(a) * 49} y1={75 + Math.sin(a) * 49} x2={75 + Math.cos(a) * 53} y2={75 + Math.sin(a) * 53} stroke="var(--hairline)" strokeWidth={2} />;
                })}
              </svg>
              <span className="bm-count-val"><b className="num">{Math.round(anim(m.daysTo))}</b><small>days to go</small></span>
            </button>
            <div className="bm-hero-facts">
              <div><CalendarDays size={14} /> <b>{m.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b></div>
              <div><Clock size={14} /> {m.time} to {addMin(m.date, total)} · {total} minutes</div>
              <div><MapPin size={14} /> {m.location}</div>
              <div><Users size={14} /> Chair {m.chair.name} · Secretary {m.secretary.name}</div>
              <div className="bm-quorum" title={`Quorum is ${m.quorum} voting members · source: attendance returns`}>
                {voting.map((d) => <i key={d.name} className={d.attending === 'Confirmed' ? 'on' : d.attending === 'Tentative' ? 'maybe' : ''} title={`${d.name}: ${d.attending}`} />)}
                <span>{confirmed} of {voting.length} voting members confirmed · quorum {m.quorum} · {confirmed >= m.quorum ? <b style={{ color: 'var(--good)' }}>quorate</b> : <b style={{ color: 'var(--bad)' }}>not quorate</b>}</span>
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>Last meeting {fmtDate(m.prevDate)} · board pack due {fmtDate(m.packDue)} ({packDays > 0 ? `in ${packDays} days` : packDays === 0 ? 'today' : `${-packDays} days late`})</div>
            </div>
          </div>
        </Card>
        <div id="bm-attendees">
          <Card title="Attendees" sub={`${m.directors.filter((d) => d.voting).length} voting · ${m.directors.filter((d) => !d.voting).length} in attendance`} count={m.directors.length}>
            <div className="bm-people">
              {m.directors.map((d) => (
                <div key={d.name} className="bm-person">
                  <span className="bm-av" style={{ '--tone': KIND_COLOR[d.kind] } as CSSProperties}>{initials(d.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <b>{d.name}</b>
                    <small>{d.role}</small>
                  </div>
                  <div className="bm-person-tags">
                    <Badge color={KIND_COLOR[d.kind]}>{d.voting ? d.kind : 'Non-voting'}</Badge>
                    <Badge color={ATTEND_COLOR[d.attending]} dot>{d.attending}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        </div>
        <div className="bm-col">
        <Card title="Agenda" sub={`${m.agenda.length} items · ${total} minutes · every paper opens its live source in HexaView`} actions={<Btn sm onClick={() => setPrint('pack')}><Printer /> Board pack</Btn>}>
          <div className="bm-timebar" aria-hidden>
            <svg viewBox="0 0 1000 34" preserveAspectRatio="none" width="100%" height={34}>
              {m.agenda.map((a) => {
                const x = (cursor / total) * 1000;
                const w = (a.minutes / total) * 1000 * Math.min(1, anim(1, a.n * 70, 700));
                cursor += a.minutes;
                return <rect key={a.n} x={x + 1} y={4} width={Math.max(0, w - 2)} height={26} rx={5} fill={a.tone} opacity={0.85} />;
              })}
            </svg>
            <div className="bm-timebar-labels">
              {(() => { let cur = 0; return m.agenda.map((a) => { const left = (cur / total) * 100; cur += a.minutes; return a.minutes >= 10 ? <span key={a.n} style={{ left: `${left}%` }}>{addMin(m.date, cur - a.minutes)}</span> : null; }); })()}
            </div>
          </div>
          <div className="bm-agenda">
            {(() => { let cur = 0; return m.agenda.map((a) => {
              const start = cur; cur += a.minutes;
              return (
                <div key={a.n} className="bm-agenda-row" style={{ '--tone': a.tone } as CSSProperties}>
                  <span className="bm-agenda-n">{a.n}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <b className="bm-agenda-title">{a.title}</b>
                      <Badge color={PURPOSE_COLOR[a.purpose]}>{a.purpose}</Badge>
                    </div>
                    <div className="bm-agenda-meta">
                      <span className="bm-av sm">{initials(a.presenter.name)}</span>{a.presenter.name} <span className="muted">· {a.presenter.role}</span>
                    </div>
                    {a.papers.length > 0 && (
                      <div className="bm-papers">
                        {a.papers.map((p0) => {
                          const p = paperById.get(p0.id) ?? p0;
                          const st = p.circulated ? 'Circulated' : p.approved ? 'Approved' : p.drafted ? 'Drafted' : 'Not started';
                          return (
                            <button key={p.id} type="button" className={`bm-paper st-${st.toLowerCase().replace(' ', '-')}`} onClick={() => nav(p.path)} title={`${p.title} · ${st} · source: ${p.source} · opens the live page`}>
                              <FileText size={12} /> {p.title} <ArrowRight size={11} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="bm-agenda-time"><b className="num">{a.minutes}′</b><small>{addMin(m.date, start)}</small></div>
                </div>
              );
            }); })()}
          </div>
        </Card>
        <div id="bm-pack">
          <Card title="Board pack readiness" sub={`${pr.total} papers · pack due ${fmtDateShort(m.packDue)} · tick each stage as it completes`}
            actions={<Btn sm primary color={BM_TONE} onClick={() => setPrint('pack')}><Printer /> Generate board pack</Btn>}>
            <div className="bm-ready-head">
              <div className="bm-ready-score"><b className="num">{Math.round(anim(pr.score))}%</b><small>ready</small></div>
              <div style={{ flex: 1 }}>
                <Stacked tall parts={[
                  { value: pr.circulated, color: '#20b292', label: 'Circulated' },
                  { value: pr.approved - pr.circulated, color: '#4b7bd8', label: 'Approved, not circulated' },
                  { value: pr.drafted - pr.approved, color: '#f0a338', label: 'Drafted, not approved' },
                  { value: pr.total - pr.drafted, color: '#8593b4', label: 'Not started' },
                ]} />
                <Legend items={[{ label: `Circulated ${pr.circulated}`, color: '#20b292' }, { label: `Approved ${pr.approved - pr.circulated}`, color: '#4b7bd8' }, { label: `Drafted ${pr.drafted - pr.approved}`, color: '#f0a338' }, { label: `Not started ${pr.total - pr.drafted}`, color: '#8593b4' }]} />
              </div>
            </div>
            <table className="bm-tbl">
              <thead><tr><th>Paper</th><th>Owner</th><th className="c">Drafted</th><th className="c">Approved</th><th className="c">Circulated</th></tr></thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.id}>
                    <td><button type="button" className="bm-link" onClick={() => nav(p.path)} title={`Source: ${p.source} · open the live page`}>{p.title}</button><small className="muted" style={{ display: 'block' }}>{p.pages} pages · {p.source}</small></td>
                    <td className="muted" style={{ fontSize: 11.5 }}>{p.owner.name}</td>
                    {(['drafted', 'approved', 'circulated'] as PaperStage[]).map((s) => (
                      <td key={s} className="c">
                        <button type="button" className={`bm-check ${p[s] ? 'on' : ''}`} aria-pressed={p[s]} onClick={() => { setPaper(p.id, s, !p[s]); if (!p[s] && s === 'circulated') toast(`${p.title} circulated to directors via HexaCustody (view-only, watermarked)`); }} title={`${p[s] ? 'Undo' : 'Mark'} ${s}`}>
                          {p[s] && <Check size={13} />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-foot">Approving a paper marks it drafted; circulating it marks it approved. Papers are distributed through HexaCustody, view-only and watermarked per director.</div>
          </Card>
        </div>
        </div>
      </div>
    </>
  );
}

