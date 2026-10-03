import { useState } from 'react';
import { Lock } from 'lucide-react';
import { MODULE_BY_ID } from '../../modules/registry';
import { tenantName } from '../../data/customers';
import { FINDING_STATUS_COLOR, type VipFinding } from '../../data/modules/vip';
import { KpiStrip, StatusBadge, SevBadge } from '../../components/ui';
import { fmtMoney } from '../../lib/format';
import { RecordsDrawer } from './parts';
import { VipProvider, useVip, VIP_SECTIONS } from './vip/state';
import { PersonDrawer } from './vip/ui';
import { People } from './vip/People';
import { Impersonation } from './vip/Impersonation';
import { Brokers } from './vip/Brokers';
import { Travel } from './vip/Travel';
import './int.css';
import './vip/vip.css';

const tone = MODULE_BY_ID.int.tone;

export default function IntVip() {
  return (
    <VipProvider>
      <Workspace />
    </VipProvider>
  );
}

function Workspace() {
  const { c, tenantId, people, imps, brokers, trips, section, go, param, patch, personOf } = useVip();
  const [credsOpen, setCredsOpen] = useState(false);
  const person = param('person') ? personOf(param('person')!) : undefined;
  const email = c.connectors.find((k) => k.category === 'Email' && k.vendor !== 'KnowBe4');

  const high = people.filter((p) => p.score >= 60).length;
  const credFindings = people.flatMap((p) => p.findings.filter((f) => f.kind === 'Leaked credential').map((f) => ({ ...f, person: p.name })));
  const openImps = imps.filter((i) => i.status === 'New' || i.status === 'Takedown requested').length;
  const fraud = imps.filter((i) => i.kind === 'CEO fraud / payment diversion');
  const removed = brokers.filter((b) => b.state === 'Removed').length;
  const riskyTrips = trips.filter((t) => t.threat === 'Elevated' || t.threat === 'High').length;
  const count: Record<string, number> = { people: people.length, impersonation: openImps, brokers: brokers.filter((b) => b.state === 'Found' || b.state === 'Re-listed').length, travel: trips.length };

  return (
    <>
      <p className="page-intro">
        Personal exposure and impersonation of <b>{c.short}</b>’s executives, board and key people · {tenantName(c, tenantId)}. HexaInt watches breach and infostealer collections, social platforms, data brokers and domain registrations{email ? <>, and correlates executive-impersonation mail from {email.vendor} {email.product}</> : null}. Advisory only: we show what is exposed and where, never the personal data itself.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Protected people', value: people.length, unit: `${people.filter((p) => p.tier === 'Board').length} board`, onClick: () => go('people'), source: 'HexaInt executive protection roster · board & HR register' },
          { label: 'High exposure', hint: 'score 60+', value: high, unit: 'people', toneColor: 'var(--sev-high)', onClick: () => go('people', { band: 'elevated' }), source: 'HexaInt exposure scoring' },
          { label: 'Leaked credentials', hint: 'personal', value: credFindings.length, unit: 'masked', toneColor: 'var(--bad)', onClick: () => setCredsOpen(true), source: 'HexaInt breach & infostealer collection' },
          { label: 'Impersonations', hint: 'open', value: openImps, unit: `of ${imps.length}`, toneColor: 'var(--sev-critical)', onClick: () => go('impersonation', { status: 'open' }), source: 'HexaInt social & media monitoring · CT logs' },
          { label: 'CEO fraud', hint: 'stopped', value: fraud.length, unit: fmtMoney(fraud.reduce((s, i) => s + (i.amount ?? 0), 0), c.currency), toneColor: 'var(--good)', onClick: () => go('impersonation', { kind: 'CEO fraud / payment diversion' }), source: `${email ? `${email.vendor} ${email.product}` : 'Email gateway'} · HexaSOC` },
          { label: 'Broker removals', value: `${removed}/${brokers.length}`, bar: brokers.length ? (removed / brokers.length) * 100 : 0, toneColor: 'var(--good)', onClick: () => go('brokers'), source: 'HexaInt data-broker sweep · removal tracker' },
          { label: 'Trips', hint: 'next 60 days', value: trips.length, unit: `${riskyTrips} elevated+`, toneColor: riskyTrips ? 'var(--sev-medium)' : undefined, onClick: () => go('travel'), source: 'Travel booking feed · HexaInt travel risk' },
        ]}
      />

      <nav className="vip-subtabs" aria-label="Executive protection sections">
        {VIP_SECTIONS.map((s) => (
          <button key={s.id} type="button" className={`vip-subtab ${section === s.id ? 'on' : ''}`} onClick={() => section !== s.id && go(s.id)} aria-current={section === s.id ? 'page' : undefined}>
            {s.label}<em>{count[s.id]}</em>
          </button>
        ))}
        <span className="vip-subtabs-end"><Lock size={12} /> Restricted: CISO & executive-protection team</span>
      </nav>

      {section === 'people' && <People />}
      {section === 'impersonation' && <Impersonation />}
      {section === 'brokers' && <Brokers />}
      {section === 'travel' && <Travel />}

      {person && <PersonDrawer key={person.id} p={person} onClose={() => patch({ person: null })} />}

      {credsOpen && (
        <RecordsDrawer<VipFinding & { person: string }>
          title="Leaked personal credentials"
          sub={`${credFindings.length} credentials across ${new Set(credFindings.map((f) => f.personId)).size} protected people · passwords masked`}
          rows={credFindings}
          source={['HexaInt breach compilations', 'HexaInt infostealer logs', 'Paste-site monitoring']}
          onClose={() => setCredsOpen(false)}
          onRow={(f) => { setCredsOpen(false); patch({ person: f.personId }); }}
          openLabel="Open credential exposure"
          openTo="/int/exposure?view=vips"
          columns={[
            { key: 'p', header: 'Person', sort: (f) => f.person, render: (f) => <span className="t-main">{f.person}</span> },
            { key: 't', header: 'Finding', render: (f) => (<><div className="t-main">{f.title}</div><div className="t-sub">{f.source}</div></>) },
            { key: 's', header: 'Severity', render: (f) => <SevBadge sev={f.sev} /> },
            { key: 'st', header: 'Status', render: (f) => <StatusBadge value={f.status} map={FINDING_STATUS_COLOR} /> },
            { key: 'd', header: 'Found', align: 'right', sort: (f) => -f.foundDays, render: (f) => <span className="muted">{f.foundDays}d ago</span> },
          ]}
        />
      )}
    </>
  );
}
