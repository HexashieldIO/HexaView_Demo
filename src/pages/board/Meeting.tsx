import { CalendarDays, Printer } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { KpiStrip, Btn } from '../../components/ui';
import { useIntro } from '../../lib/useIntro';
import { fmtDate } from '../../lib/format';
import { isOverdue } from '../../data/modules/boardMeeting';
import { BoardMeetingProvider, useBm, useBmNav, BM_SECTIONS, BM_TONE, paperReadiness } from './state';
import NextMeeting from './Next';
import Questions from './Questions';
import Decisions from './Decisions';
import Actions from './Actions';
import Minutes from './Minutes';
import { BoardPack, MinuteExtract } from './Print';

export default function Meeting() {
  const { customer: c } = useApp();
  return (
    <BoardMeetingProvider key={c.id}>
      <Workspace />
    </BoardMeetingProvider>
  );
}

function Workspace() {
  const { customer: c } = useApp();
  const { m, questions, requests, recorded, actions, papers, print, setPrint } = useBm();
  const { section, go } = useBmNav();
  const anim = useIntro(`bm-${c.id}`, 1600);

  if (print === 'pack') return <BoardPack onClose={() => setPrint(null)} />;
  if (print === 'minutes') return <MinuteExtract onClose={() => setPrint(null)} />;

  const pr = paperReadiness(papers);
  const redAmber = questions.filter((q) => q.rag !== 'green').length;
  const red = questions.filter((q) => q.rag === 'red').length;
  const pending = requests.filter((q) => !recorded[q.id]).length;
  const overdue = actions.filter(isOverdue).length;
  const voting = m.directors.filter((d) => d.kind !== 'In attendance');
  const trained = voting.filter((d) => d.training.status === 'Completed').length;
  const trainedPct = Math.round((trained / Math.max(1, voting.length)) * 100);
  const confirmedVoting = m.directors.filter((d) => d.voting && d.attending === 'Confirmed').length;

  const counts: Record<string, number | undefined> = { questions: red || undefined, decisions: pending || undefined, actions: overdue || undefined };

  return (
    <>
      <div className="row between wrap no-print" style={{ gap: 10 }}>
        <p className="page-intro" style={{ flex: 1, minWidth: 260, margin: 0 }}>
          <b>{c.name}</b> · {m.committee}, {fmtDate(m.date)} at {m.time}. The cyber item for {m.chair.name} ({m.chair.role}) and directors: agenda and papers linked to live HexaView data, the questions to ask, decisions, actions and minutes.
        </p>
        <Btn onClick={() => go('next')}><CalendarDays /> {m.daysTo} days to meeting</Btn>
        <Btn primary color={BM_TONE} onClick={() => setPrint('pack')}><Printer /> Generate board pack</Btn>
      </div>

      <KpiStrip
        toneColor={BM_TONE}
        items={[
          { label: 'Next meeting', hint: m.isBoard ? 'Board' : 'Committee', value: Math.round(anim(m.daysTo)), unit: 'days', bar: 100 - (m.daysTo / 91) * 100, onClick: () => go('next'), source: 'Company secretariat calendar' },
          { label: 'Board pack readiness', value: Math.round(anim(pr.score)), unit: '%', bar: pr.score, delta: { text: `${pr.circulated}/${pr.total} papers circulated`, good: pr.circulated === pr.total }, onClick: () => go('next', { focus: 'pack' }), source: 'HexaView board workspace · paper checklist' },
          { label: 'Quorum', value: `${confirmedVoting}/${m.quorum}`, unit: 'confirmed', delta: { text: confirmedVoting >= m.quorum ? 'Quorate' : 'Not yet quorate', good: confirmedVoting >= m.quorum }, onClick: () => go('next', { focus: 'attendees' }), source: 'Company secretariat · attendance returns' },
          { label: 'Questions not green', value: Math.round(anim(redAmber)), unit: `of ${questions.length}`, delta: { text: `${red} red`, good: red === 0 }, onClick: () => go('questions', { rag: red ? 'red' : 'amber' }), source: 'HexaView · answers built from live module data' },
          { label: 'Decisions requested', value: pending, unit: `of ${requests.length}`, onClick: () => go('decisions'), source: 'Board papers · decision requests' },
          { label: 'Actions overdue', value: Math.round(anim(overdue)), unit: `of ${actions.length}`, toneColor: overdue ? 'var(--bad)' : undefined, onClick: () => go('actions', { filter: 'overdue' }), source: 'Board action log' },
          { label: 'Directors trained', value: Math.round(anim(trainedPct)), unit: '%', bar: trainedPct, delta: { text: `${voting.length - trained} outstanding`, good: trained === voting.length }, onClick: () => go('minutes', { focus: 'training' }), source: 'HexaComply training attestation' },
        ]}
      />

      <div className="bm-subtabs no-print" role="tablist">
        {BM_SECTIONS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={section === s.id} className={`bm-subtab ${section === s.id ? 'on' : ''}`} onClick={() => go(s.id)}>
            {s.label}
            {counts[s.id] !== undefined && <em>{counts[s.id]}</em>}
          </button>
        ))}
      </div>

      {section === 'next' && <NextMeeting />}
      {section === 'questions' && <Questions />}
      {section === 'decisions' && <Decisions />}
      {section === 'actions' && <Actions />}
      {section === 'minutes' && <Minutes />}
    </>
  );
}
