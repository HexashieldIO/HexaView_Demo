import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { tenantName } from '../../../data/customers';
import type { AssessStatus } from '../../../data/modules/comply';
import { TP_LEVEL_COLOR, TP_STATES, TP_STATE_COLOR, type TpLevel, type TpState, type TpSupplier } from '../../../data/modules/tprm';
import { fmtNum } from '../../../lib/format';
import { useTprm } from './state';
import { Facet, FacetSelect, Pill, ScopeTags, ScoreBar, SupplierCell, Tiles } from './ui';
import { SectorPanel, RatingsPanel } from './SectorPanels';

export const TP_FLAGS: Record<string, { label: string; test: (s: TpSupplier) => boolean }> = {
  drops: { label: 'Rating dropped ≥ 5', test: (s) => s.v.ratingDelta <= -5 },
  expiring: { label: 'Contract ends ≤ 90 d', test: (s) => s.renewal.kind === 'date' && s.renewal.days <= 90 },
  overdue: { label: 'Renewal overdue', test: (s) => s.renewal.kind === 'overdue' },
  complete: { label: 'Assessment complete', test: (s) => s.v.assessment === 'Complete' },
  review: { label: 'Review overdue', test: (s) => s.results.review === false },
  baa: { label: 'PHI without valid BAA', test: (s) => s.v.baa === 'Missing' || s.v.baa === 'Expired' },
  tisax: { label: 'Prototype data without AL3', test: (s) => s.v.dataAccess.includes('Prototype') && s.v.tisax !== 'AL3 valid' },
  ot: { label: 'Remote OT / device access', test: (s) => !!s.v.otRemote },
  tpn: { label: 'Pre-release without current TPN', test: (s) => s.v.dataAccess.includes('Pre-release') && (s.v.tpn === 'Not assessed' || s.v.tpn === 'Expired') },
  lei: { label: 'Missing LEI', test: (s) => s.v.lei === false },
  cif: { label: 'Supports a critical or important function', test: (s) => !!s.v.cif },
  exit: { label: 'Critical provider without tested exit plan', test: (s) => !!s.v.cif && !s.v.obligations.exitPlan },
  cmmc: { label: 'CUI without a verified CMMC L2 position', test: (s) => s.v.dataAccess.includes('CUI') && (s.v.cmmc === 'POA&M open' || s.v.cmmc === 'No SPRS score') },
  qa: { label: 'GxP data without a quality agreement', test: (s) => s.v.qa === 'Missing' || s.v.qa === 'Expired' },
  xfer: { label: 'Patient data overseas without safeguards', test: (s) => s.v.xfer === 'No safeguards' },
  npi: { label: 'Holds NPI with notice window over 24 h', test: (s) => s.v.dataAccess.includes('NPI') && s.v.obligations.breachNotifyHrs > 24 },
};

const SECTOR_COL: Record<string, { header: string; render: (s: TpSupplier) => ReactNode; sort: (s: TpSupplier) => string } | undefined> = {
  finserv: { header: 'DORA', sort: (s) => `${s.v.cif ? 1 : 0}${s.v.lei ? 1 : 0}`, render: (s) => <span className="tp-tags">{s.v.cif ? <Pill color="var(--sev-high)">CIF</Pill> : <span className="tp-muted">—</span>}{s.v.lei === false && <Pill color="var(--bad)">No LEI</Pill>}</span> },
  healthcare: { header: 'BAA', sort: (s) => s.v.baa ?? '', render: (s) => (s.v.baa && s.v.baa !== 'Not required' ? <Pill color={s.v.baa === 'Signed' ? 'var(--good)' : 'var(--bad)'}>{s.v.baa}</Pill> : <span className="tp-muted">n/a</span>) },
  automotive: { header: 'TISAX', sort: (s) => s.v.tisax ?? '', render: (s) => (s.v.tisax ? <Pill color={s.v.tisax === 'AL3 valid' ? 'var(--good)' : s.v.tisax === 'AL2 valid' ? 'var(--m-matrix)' : s.v.tisax === 'Expiring' ? 'var(--sev-medium)' : 'var(--bad)'}>{s.v.tisax}</Pill> : '—') },
  media: { header: 'TPN', sort: (s) => s.v.tpn ?? '', render: (s) => (s.v.tpn ? <Pill color={s.v.tpn === 'Gold Shield' ? 'var(--m-custody)' : s.v.tpn === 'Blue Shield' ? 'var(--m-matrix)' : s.v.tpn === 'Self-reported' ? 'var(--sev-info)' : 'var(--bad)'}>{s.v.tpn}</Pill> : '—') },
  insurance: { header: 'NYDFS TPSP', sort: (s) => `${s.v.dataAccess.includes('NPI') ? 1 : 0}${s.v.obligations.breachNotifyHrs}`, render: (s) => (s.v.dataAccess.includes('NPI') ? <span className="tp-tags"><Pill color="var(--m-comply)">NPI</Pill>{s.v.obligations.breachNotifyHrs > 24 && <Pill color="var(--sev-high)">{s.v.obligations.breachNotifyHrs} h notice</Pill>}</span> : <span className="tp-muted">—</span>) },
  defence: { header: 'CMMC', sort: (s) => s.v.cmmc ?? '', render: (s) => (s.v.cmmc && s.v.cmmc !== 'Not required' ? <Pill color={s.v.cmmc === 'L2 C3PAO' ? 'var(--good)' : s.v.cmmc === 'L2 self-assessed' ? 'var(--m-matrix)' : 'var(--bad)'}>{s.v.cmmc}</Pill> : <span className="tp-muted">n/a</span>) },
  pharma: { header: 'Quality agreement', sort: (s) => s.v.qa ?? '', render: (s) => (s.v.qa && s.v.qa !== 'Not required' ? <Pill color={s.v.qa === 'Signed' ? 'var(--good)' : 'var(--bad)'}>{s.v.qa}</Pill> : <span className="tp-muted">n/a</span>) },
  sghospital: { header: 'Data location', sort: (s) => s.v.xfer ?? '', render: (s) => (s.v.xfer && s.v.xfer !== 'No patient data' ? <Pill color={s.v.xfer === 'Singapore only' ? 'var(--good)' : s.v.xfer === 'Safeguards on file' ? 'var(--m-matrix)' : 'var(--bad)'}>{s.v.xfer}</Pill> : <span className="tp-muted">—</span>) },
  maritime: { header: 'OT access', sort: (s) => (s.v.otRemote ? '1' : '0'), render: (s) => (s.v.otRemote ? <Pill color="var(--m-ot)">Remote OT</Pill> : <span className="tp-muted">—</span>) },
};

export function Suppliers() {
  const { c, tenantId, sup, setParams, openSupplier, grc } = useTprm();
  const [sp] = useSearchParams();
  const service = sp.get('service') ?? 'all';
  const riskRaw = sp.get('risk');
  const risk: TpLevel | 'all' = riskRaw === 'high' ? 'High' : riskRaw === 'medium' ? 'Medium' : riskRaw === 'low' ? 'Low' : 'all';
  const scope = sp.get('scope') ?? 'all';
  const state = (sp.get('state') as TpState | null) ?? 'all';
  const status = sp.get('status') as AssessStatus | null;
  const flag = sp.get('flag');

  const services = useMemo(() => [...new Set(sup.map((s) => s.service))].sort(), [sup]);
  const scopes = useMemo(() => {
    const m = new Map<string, number>();
    sup.forEach((s) => s.inScope.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sup]);

  const shown = sup.filter((s) => (service === 'all' || s.service === service) && (risk === 'all' || s.level === risk) && (scope === 'all' || s.inScope.includes(scope))
    && (state === 'all' || s.state === state) && (!status || s.v.assessment === status) && (!flag || !TP_FLAGS[flag] || TP_FLAGS[flag].test(s)));
  const sector = SECTOR_COL[c.id] ?? SECTOR_COL[c.dataKey];
  const assessed = sup.filter((s) => s.v.assessment !== 'Not started').length;

  return (
    <div className="tp-stack">
      <p className="tp-intro">
        Every supplier in <b>{c.short}</b>'s register{tenantId !== 'all' && <> serving <b>{tenantName(c, tenantId)}</b></>}, scored against up to 12 checks on its own record. Higher is worse. Open a row for the gaps behind its score.
      </p>

      <Tiles items={[
        { ac: 'Register', word: 'All', value: fmtNum(sup.length), unit: 'suppliers', on: state === 'all', onClick: () => setParams({ state: null }), source: `${grc} vendor register` },
        ...TP_STATES.map((st) => {
          const n = sup.filter((s) => s.state === st).length;
          return { ac: 'State', word: st, value: n, unit: n === 1 ? 'supplier' : 'suppliers', on: state === st, onClick: () => setParams({ state: state === st ? null : st }), color: st === 'Escalated' ? 'var(--bad)' : undefined, bar: (n / Math.max(1, sup.length)) * 100, source: `${grc} vendor register · record status` };
        }),
      ]} />

      <Card flush>
        <div className="tp-facets">
          <FacetSelect label="Service" value={service} all="All services" options={services.map((x) => ({ id: x, label: x }))} onChange={(v) => setParams({ service: v })} />
          <Facet<TpLevel> label="Risk" value={risk} options={(['Low', 'Medium', 'High'] as TpLevel[]).map((l) => ({ id: l, label: l, n: sup.filter((s) => s.level === l).length }))} onChange={(v) => setParams({ risk: v === 'all' ? null : v.toLowerCase() })} />
          <Facet<string> label="In scope for" value={scope} options={scopes.slice(0, 7).map(([t, n]) => ({ id: t, label: t, n }))} onChange={(v) => setParams({ scope: v })} />
        </div>
        {(status || (flag && TP_FLAGS[flag])) && (
          <div className="tp-count">
            Also filtered by
            {status && <button type="button" className="tp-fchip on" onClick={() => setParams({ status: null })}>Assessment: {status} ×</button>}
            {flag && TP_FLAGS[flag] && <button type="button" className="tp-fchip on" onClick={() => setParams({ flag: null })}>{TP_FLAGS[flag].label} ×</button>}
          </div>
        )}
        <div className="tp-count"><span><b>{fmtNum(shown.length)}</b> of {fmtNum(sup.length)} suppliers · scored from the vendor register, {fmtNum(assessed)} records assessed</span></div>
        <div style={{ paddingTop: 10 }}>
          <DataTable<TpSupplier>
            rows={shown}
            rowKey={(s) => s.id}
            onRowClick={(s) => openSupplier(s.id)}
            search={(s) => `${s.name} ${s.id} ${s.service} ${s.contact} ${s.inScope.join(' ')} ${s.v.access}`}
            searchPlaceholder="Search supplier, id, service…"
            initialSort={{ key: 'risk', dir: 'desc' }}
            pageSize={15}
            columns={[
              { key: 'name', header: 'Supplier', sort: (s) => s.name, render: (s) => <SupplierCell s={s} /> },
              { key: 'service', header: 'Service', sort: (s) => s.service, render: (s) => <span style={{ fontSize: 12 }}>{s.service}</span> },
              { key: 'risk', header: 'Risk', sort: (s) => s.score, render: (s) => <ScoreBar score={s.score} /> },
              { key: 'gaps', header: 'Gaps', align: 'right', sort: (s) => s.gaps.length, render: (s) => <span className="tp-gapn" style={{ background: `color-mix(in srgb, ${TP_LEVEL_COLOR[s.level]} 16%, transparent)`, color: TP_LEVEL_COLOR[s.level] }}>{s.gaps.length}</span> },
              { key: 'renewal', header: 'Renewal', sort: (s) => s.renewal.days, render: (s) => (s.renewal.kind === 'open' ? <span className="tp-muted">Open-ended</span> : s.renewal.kind === 'overdue' ? <span className="tp-renew-over">{-s.renewal.days}d overdue</span> : <span style={{ fontSize: 12, color: s.renewal.days <= 90 ? 'var(--sev-medium)' : undefined }}>{s.renewal.date}</span>) },
              { key: 'scope', header: 'In scope for', render: (s) => <ScopeTags s={s} /> },
              ...(sector ? [{ key: 'sector', header: sector.header, sort: sector.sort, render: sector.render }] : []),
              { key: 'state', header: 'State', sort: (s) => s.state, render: (s) => <Pill color={TP_STATE_COLOR[s.state]}>{s.state}</Pill> },
            ]}
          />
        </div>
      </Card>

      <div className="grid g-3-2">
        <SectorPanel />
        <RatingsPanel />
      </div>
    </div>
  );
}
