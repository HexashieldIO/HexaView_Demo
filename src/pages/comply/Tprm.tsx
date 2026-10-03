import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { tenantName } from '../../data/customers';
import { MODULE_BY_ID } from '../../modules/registry';
import { ratingsSource } from '../../data/modules/comply';
import { tpExposure, TP_LEVEL_COLOR, tpLevelOf } from '../../data/modules/tprm';
import { KpiStrip } from '../../components/ui';
import { fmtNum } from '../../lib/format';
import { TprmProvider, useTprm } from './tprm/state';
import { SubTabs } from './tprm/ui';
import { Suppliers } from './tprm/Suppliers';
import { Questionnaires } from './tprm/Questionnaires';
import { Exposure } from './tprm/Exposure';
import { Tasks } from './tprm/Tasks';
import { ChangeLog } from './tprm/ChangeLog';
import { SupplierDrawer } from './tprm/SupplierDrawer';
import './tprm/tprm.css';

const tone = MODULE_BY_ID.comply.tone;

export default function ComplyTprm() {
  return (
    <TprmProvider>
      <Workspace />
    </TprmProvider>
  );
}

function Workspace() {
  const { tenantId } = useApp();
  const { c, sup, tasks, qas, section, go, setParams, grc } = useTprm();
  const [sp] = useSearchParams();
  const h = headlines(c, tenantId);
  const src = ratingsSource(c);
  const ex = useMemo(() => tpExposure(sup), [sup]);
  const idParam = sp.get('id');
  const openSup = idParam ? sup.find((s) => s.id === idParam || s.name === idParam) : undefined;
  const openTasks = tasks.filter((t) => !t.done);
  const overdueQa = qas.filter((q) => q.col === 'Sent' && (q.dueInDays ?? 0) < 0).length;
  const renewals = sup.filter((s) => s.renewal.kind === 'date' && s.renewal.days <= 90).length;
  const drops = sup.filter((s) => s.v.ratingDelta <= -5).length;
  const regSrc = `${grc} vendor register`;
  const people = c.connectors.filter((k) => ['PAM', 'Identity'].includes(k.category)).map((k) => k.product);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: {fmtNum(h.comply.vendors)} suppliers scored against twelve checks on their own register records in {grc}. Outside-in ratings from <b>{src.name}</b>
        {src.connector ? '' : ' (no ratings connector: HexaShield scans the supplier attack surface)'}{people.length ? <>, access evidence from {people.join(' and ')}</> : ''}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Suppliers', value: fmtNum(h.comply.vendors), unit: `${sup.filter((s) => s.v.tier === 1).length} tier 1`, onClick: () => go('suppliers'), source: regSrc },
          { label: 'High risk', value: h.comply.highRiskVendors, toneColor: 'var(--bad)', bar: (h.comply.highRiskVendors / Math.max(1, sup.length)) * 100, onClick: () => go('suppliers', { risk: 'high' }), source: `${regSrc} · twelve-check score` },
          { label: 'Portfolio risk', hint: 'higher is worse', value: ex.portfolio, unit: '/100', bar: ex.portfolio, toneColor: TP_LEVEL_COLOR[tpLevelOf(ex.portfolio)], onClick: () => go('exposure'), source: `${grc} · mean of live supplier scores` },
          { label: 'Assessments in flight', value: fmtNum(qas.length), unit: overdueQa ? `${overdueQa} overdue` : undefined, onClick: () => go('questionnaires'), source: `${grc} questionnaires` },
          { label: 'Open tasks', value: openTasks.length, unit: `${openTasks.filter((t) => t.dueInDays < 0).length} overdue`, onClick: () => go('tasks'), source: `${grc} TPRM tasks` },
          { label: 'Renewals', hint: '≤ 90 d', value: renewals, onClick: () => go('suppliers', { flag: 'expiring' }), source: `${regSrc} · contract end` },
          { label: 'Rating drops', hint: '≥ 5 pts, 30 d', value: drops, toneColor: drops ? 'var(--sev-high)' : undefined, onClick: () => go('suppliers', { flag: 'drops' }), source: src.name },
        ]}
      />

      <SubTabs />

      {section === 'suppliers' && <Suppliers />}
      {section === 'questionnaires' && <Questionnaires />}
      {section === 'exposure' && <Exposure />}
      {section === 'tasks' && <Tasks />}
      {section === 'changelog' && <ChangeLog />}

      {openSup && <SupplierDrawer key={openSup.id} s={openSup} onClose={() => setParams({ id: null })} />}
    </>
  );
}
