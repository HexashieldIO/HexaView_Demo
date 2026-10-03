import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap, CalendarDays, UserPlus, Award } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, BarRow, Btn, Callout, KV, Legend, SectionLabel, IcoBox } from '../../components/ui';
import { Drawer, Modal } from '../../components/Overlay';
import { CERT_COLOR, CERT_LABEL, PARTNER, STAFF, TRACKS, certifications, type CertState, type PartnerPerson, type Track } from '../../data/modules/partner';
import { daysAhead, fmtDate, fmtDateShort } from '../../lib/format';
import { PT_TONE } from '../partner/parts';

const STATES: CertState[] = ['certified', 'expiring', 'in-progress', 'expired', 'not-started'];
const SESSIONS = [
  { days: 6, title: 'HexaSOC Delivery Specialist: agentic triage lab', mode: 'Virtual · 3 h', seats: 4 },
  { days: 13, title: 'HexaOT Specialist: Purdue, passive sensors and safe testing', mode: 'Manchester · 1 day', seats: 2 },
  { days: 20, title: 'Technical Professional exam window', mode: 'Proctored online', seats: 6 },
  { days: 34, title: 'Selling closed-loop assurance to GRC buyers', mode: 'Virtual · 90 min', seats: 10 },
];

export default function EnablementTraining() {
  const [params] = useSearchParams();
  const { toast } = useApp();
  const certs = useMemo(() => certifications(), []);
  const focus = params.get('state') as CertState | null;
  const [person, setPerson] = useState<PartnerPerson | null>(null);
  const [enrol, setEnrol] = useState<Track | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const all = STAFF.flatMap((p) => TRACKS.map((t) => ({ p, t, cell: certs[p.id][t.id] })));
  const held = all.filter((x) => x.cell.state === 'certified' || x.cell.state === 'expiring');
  const expiring = all.filter((x) => x.cell.state === 'expiring');
  const inProg = all.filter((x) => x.cell.state === 'in-progress');
  const reqMet = TRACKS.filter((t) => held.filter((x) => x.t.id === t.id).length >= t.required).length;
  const scores = held.map((x) => x.cell.score ?? 0);

  return (
    <>
      <p className="page-intro">
        Training paths and certification for everyone at {PARTNER.short}. {PARTNER.level} status needs a minimum number of certified people per track; certifications last two years and renew with a short recertification module.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Certifications held', value: held.length, hint: `${new Set(held.map((x) => x.p.id)).size} of ${STAFF.length} staff`, onClick: () => setPerson(STAFF[0]), source: 'HexaShield Academy' },
          { label: 'Tier requirements met', value: `${reqMet}/${TRACKS.length}`, bar: (reqMet / TRACKS.length) * 100, onClick: () => document.getElementById('pt-req')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaShield partner programme rules' },
          { label: 'Expiring ≤ 45 d', value: expiring.length, to: '/enablement/training?state=expiring', source: 'HexaShield Academy · expiry dates' },
          { label: 'In progress', value: inProg.length, to: '/enablement/training?state=in-progress', source: 'HexaShield Academy · enrolments' },
          { label: 'Average exam score', value: `${Math.round(scores.reduce((s, x) => s + x, 0) / Math.max(1, scores.length))}%`, source: 'HexaShield Academy · exam results' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Certification matrix" sub="Every person × track · click a row for their record" toneColor={PT_TONE} actions={<Legend items={STATES.map((s) => ({ label: CERT_LABEL[s], color: CERT_COLOR[s] }))} />}>
          {focus && <div style={{ marginBottom: 10 }}><Callout kind="warn">Highlighting <b>{CERT_LABEL[focus].toLowerCase()}</b> certifications.</Callout></div>}
          <div className="pt-matrix" style={{ gridTemplateColumns: `190px repeat(${TRACKS.length}, 1fr)` }}>
            <span />
            {TRACKS.map((t) => <span key={t.id} className="pt-mh">{t.short}</span>)}
            {STAFF.map((p) => (
              <div key={p.id} style={{ display: 'contents' }}>
                <button className="pt-mr" style={{ background: 'none', border: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer', padding: 0 }} onClick={() => setPerson(p)}>
                  {p.name} <span className="muted" style={{ fontWeight: 400, fontSize: 10.5 }}>· {p.team}</span>
                </button>
                {TRACKS.map((t) => {
                  const c = certs[p.id][t.id];
                  const dim = focus && c.state !== focus;
                  return (
                    <button
                      key={t.id}
                      className="pt-cell"
                      onClick={() => setPerson(p)}
                      title={`${p.name} · ${t.name}: ${CERT_LABEL[c.state]}${c.days ? ` (${c.state === 'expired' ? `${c.days} d ago` : `${c.days} d`})` : ''}`}
                      style={{
                        background: c.state === 'not-started' ? 'var(--surface-sunken)' : c.state === 'in-progress' ? `linear-gradient(90deg, color-mix(in srgb, ${CERT_COLOR[c.state]} 60%, transparent) ${c.pct}%, var(--surface-sunken) ${c.pct}%)` : `color-mix(in srgb, ${CERT_COLOR[c.state]} 65%, transparent)`,
                        color: c.state === 'not-started' ? 'var(--text-muted)' : '#fff',
                        opacity: dim ? 0.25 : 1,
                      }}
                    >
                      {c.state === 'certified' ? '✓' : c.state === 'expiring' ? `${c.days}d` : c.state === 'in-progress' ? `${c.pct}%` : c.state === 'expired' ? '!' : '·'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <div id="pt-req">
            <Card title={`${PARTNER.level} requirements`} sub="Certified people per track vs. programme minimum" toneColor={PT_TONE}>
              {TRACKS.map((t) => {
                const n = held.filter((x) => x.t.id === t.id).length;
                return <BarRow key={t.id} label={t.short} sub={n >= t.required ? 'met' : `${t.required - n} short`} value={n} max={Math.max(t.required * 2, n)} color={n >= t.required ? 'var(--good)' : 'var(--bad)'} display={`${n} / ${t.required}`} />;
              })}
              <div style={{ marginTop: 10 }}>
                {reqMet === TRACKS.length ? <Callout kind="good">All tracks meet the {PARTNER.level} minimum.</Callout> : <Callout kind="warn">{TRACKS.length - reqMet} track(s) below the minimum: fix before the programme review in 64 days to keep Platinum discounts.</Callout>}
              </div>
            </Card>
          </div>
          <Card title="Instructor-led sessions" sub="Book seats for your team">
            <div className="list">
              {SESSIONS.map((s) => (
                <button key={s.title} className="list-row" onClick={() => toast(`Seat requested on “${s.title}” (${fmtDate(daysAhead(s.days))})`)}>
                  <IcoBox color={PT_TONE}><CalendarDays /></IcoBox>
                  <span className="list-main"><b>{s.title}</b><span>{fmtDateShort(daysAhead(s.days))} · {s.mode} · {s.seats} seats left</span></span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Training paths" sub="Self-paced in the HexaShield Academy, with a proctored exam at the end" toneColor={PT_TONE}>
        <div className="grid g3" style={{ gap: 12 }}>
          {TRACKS.map((t) => {
            const n = held.filter((x) => x.t.id === t.id).length;
            const ip = inProg.filter((x) => x.t.id === t.id).length;
            return (
              <div key={t.id} className="pt-tierCard" style={{ cursor: 'default' }}>
                <div className="row"><IcoBox color={PT_TONE}><GraduationCap /></IcoBox><b style={{ fontSize: 13, flex: 1 }}>{t.name}</b></div>
                <span className="muted" style={{ fontSize: 11.5 }}>For {t.audience} · {t.modules} modules · {t.hours} h</span>
                <div className="row" style={{ gap: 6 }}>
                  <Badge color="var(--good)">{n} certified</Badge>
                  {ip > 0 && <Badge color="var(--m-matrix)">{ip} in progress</Badge>}
                  <span className="spacer" />
                  <Btn sm onClick={() => { setEnrol(t); setPicked([]); }}><UserPlus /> Enrol</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {person && (
        <Drawer title={person.name} sub={`${person.role} · ${person.team}`} icon={<IcoBox color={PT_TONE}><Award /></IcoBox>} onClose={() => setPerson(null)} footer={<Btn primary color={PT_TONE} onClick={() => toast(`Learning plan sent to ${person.name.split(' ')[0]}`)}>Send learning plan</Btn>}>
          <KV rows={[['Email', person.email], ['Certifications', TRACKS.filter((t) => ['certified', 'expiring'].includes(certs[person.id][t.id].state)).length]]} />
          <SectionLabel>Tracks</SectionLabel>
          <div className="list">
            {TRACKS.map((t) => {
              const c = certs[person.id][t.id];
              return (
                <div key={t.id} className="list-row">
                  <span className="list-main">
                    <b>{t.name}</b>
                    <span>
                      {c.state === 'certified' && `Valid to ${fmtDate(daysAhead(c.days))} · score ${c.score}%`}
                      {c.state === 'expiring' && `Expires ${fmtDate(daysAhead(c.days))}: recertify (45 min)`}
                      {c.state === 'in-progress' && `${c.pct}% of ${t.modules} modules`}
                      {c.state === 'expired' && `Expired ${c.days} days ago`}
                      {c.state === 'not-started' && `${t.hours} h · ${t.audience}`}
                    </span>
                  </span>
                  <Badge color={CERT_COLOR[c.state]} dot>{CERT_LABEL[c.state]}</Badge>
                </div>
              );
            })}
          </div>
        </Drawer>
      )}
      {enrol && (
        <Modal title={`Enrol in ${enrol.name}`} sub={`${enrol.modules} modules · ${enrol.hours} h · exam included`} onClose={() => setEnrol(null)} footer={<><Btn onClick={() => setEnrol(null)}>Cancel</Btn><Btn primary color={PT_TONE} disabled={!picked.length} onClick={() => { toast(`${picked.length} people enrolled in ${enrol.short}; Academy invitations sent`); setEnrol(null); }}>Enrol {picked.length || ''}</Btn></>}>
          <div className="stack" style={{ gap: 4 }}>
            {STAFF.filter((p) => !['certified', 'expiring'].includes(certs[p.id][enrol.id].state)).map((p) => (
              <label key={p.id} className={`pt-check ${picked.includes(p.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} />
                <span style={{ flex: 1 }}>{p.name} <span className="muted">· {p.role}</span></span>
                <span className="muted" style={{ fontSize: 11 }}>{CERT_LABEL[certs[p.id][enrol.id].state]}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
