import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { KpiStrip, Badge } from '../../components/ui';
import { tenantName } from '../../data/customers';
import { driverProgress, requiredThisYear, KIND_BY_ID } from '../../data/modules/exercises';
import { OPS_TONE, useRecords, scrollToId } from './parts';
import { ExProvider, useEx } from './exercises/state';
import { SubTabs, scoreColor } from './exercises/parts';
import { Programme } from './exercises/Programme';
import { Library } from './exercises/Library';
import { Run } from './exercises/Run';
import { AfterAction } from './exercises/AfterAction';

export default function Exercises() {
  const { customer } = useApp();
  return (
    <ExProvider key={customer.id}>
      <Workspace />
    </ExProvider>
  );
}

function Workspace() {
  const { c, tenantId, exs, ds, actions, section, go, run } = useEx();
  const [, openRecords, recordsNode] = useRecords();
  const completed = exs.filter((e) => e.status === 'completed');
  const overdue = exs.filter((e) => e.status === 'overdue');
  const required = tenantId === 'all' ? requiredThisYear(c) : Math.max(completed.length + overdue.length, Math.round(requiredThisYear(c) * 0.6));
  const invited = completed.reduce((s, e) => s + e.invited, 0);
  const attended = completed.reduce((s, e) => s + e.attended, 0);
  const partPct = invited ? Math.round((attended / invited) * 100) : 0;
  const avg = completed.length ? Math.round(completed.reduce((s, e) => s + (e.overall ?? 0), 0) / completed.length) : 0;
  const openActs = actions.filter((a) => a.status !== 'done');
  const overdueActs = openActs.filter((a) => a.dueDays < 0);
  const prog = useMemo(() => driverProgress(ds, exs), [ds, exs]);
  const met = prog.filter((p) => p.done >= p.d.perYear).length;
  const next = exs.filter((e) => e.status === 'scheduled' || e.status === 'planned').sort((a, b) => a.dayOffset - b.dayOffset)[0];
  const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';
  const itsm = c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM';
  const src = `HexaView exercise register · ${grc} evidence · ${itsm} calendar`;

  const participation = () =>
    openRecords({
      title: 'Participation by exercise',
      sub: `${attended} of ${invited} invited attended (${partPct}%)`,
      source: `Exercise attendance records · ${src}`,
      rows: completed.map((e) => ({
        key: e.id,
        main: e.title,
        meta: `${e.id} · ${KIND_BY_ID[e.kind].short} · ${e.participants.slice(0, 4).join(', ')}${e.participants.length > 4 ? '…' : ''}`,
        right: <><b>{e.attended}/{e.invited}</b> <Badge color={e.attended / e.invited >= 0.85 ? 'var(--good)' : 'var(--sev-medium)'}>{Math.round((e.attended / Math.max(1, e.invited)) * 100)}%</Badge></>,
        color: e.attended / e.invited >= 0.85 ? 'var(--good)' : 'var(--sev-medium)',
      })),
    });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: the crisis exercise programme that keeps the war room ready between real incidents. Scenarios are written for {c.sector.toLowerCase()} and its regulators ({ds.slice(0, 4).map((d) => d.name).join(', ')}); evidence and actions flow to {grc}, invitations to {itsm}, and live runs share the war-room clocks.
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Exercises this year', value: `${completed.length}/${required}`, unit: 'completed vs required', bar: (completed.length / Math.max(1, required)) * 100, onClick: () => go('programme', { status: 'completed' }), source: src },
          { label: 'Overdue', value: overdue.length, unit: overdue.length ? overdue.map((e) => e.id).join(', ') : 'none', toneColor: overdue.length ? 'var(--bad)' : 'var(--good)', onClick: () => go('programme', { status: 'overdue' }), source: src },
          { label: 'Participation', value: `${partPct}%`, unit: `${attended}/${invited}`, bar: partPct, onClick: participation, source: `Attendance records · ${src}` },
          { label: 'Average score', value: avg, unit: '/ 100', bar: avg, toneColor: scoreColor(avg), onClick: () => go('after-action'), source: 'Facilitator rubric × run signals (decision times, clocks)' },
          { label: 'Open actions', value: openActs.length, unit: `${overdueActs.length} overdue`, toneColor: overdueActs.length ? 'var(--sev-high)' : undefined, onClick: () => go('after-action', { actions: 'open' }), source: `${grc} tasks raised from exercises` },
          { label: 'Drivers met', value: `${met}/${ds.length}`, unit: 'regulatory', bar: (met / Math.max(1, ds.length)) * 100, onClick: () => { go('programme'); scrollToId('ex-drivers'); }, source: `${grc} obligations register` },
          { label: run ? 'Live run' : 'Next exercise', value: run ? 'Running' : next ? `${next.dayOffset} d` : '—', unit: run ? undefined : next ? `${KIND_BY_ID[next.kind].short} · ${next.id}` : undefined, toneColor: run ? 'var(--bad)' : undefined, onClick: () => (run ? go('run') : next ? go('run', { ex: next.id }) : go('library')), source: `${itsm} calendar · ${src}` },
        ]}
      />

      <SubTabs />

      {section === 'programme' && <Programme />}
      {section === 'library' && <Library />}
      {section === 'run' && <Run />}
      {section === 'after-action' && <AfterAction />}
      {recordsNode}
    </>
  );
}
