import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import type { GrcIncident, GrcIncStatus, GrcCause } from '../../../data/modules/complyRegisters';
import { Card, Badge, Callout, StatusBadge, Timeline } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { fmtDateTime, daysAgo } from '../../../lib/format';
import { MetricBand, Facet } from '../parts';
import { useContinuityData, useRiskData, useWorkspaceData } from '../useComply';
import { useQuery, useDeepLink, SectionHead, Toggles, CountLine, RecordDrawer, RSec, LinkedRecords, ago } from './shared';

const tone = MODULE_BY_ID.comply.tone;
const STATUSES: GrcIncStatus[] = ['Open', 'Under investigation', 'Contained', 'Resolved', 'Closed'];
const CAUSES: GrcCause[] = ['Human error', 'System failure', 'Third party', 'Malicious act', 'Process gap', 'Physical / environmental'];
const STATUS_COLOR: Record<string, string> = { Open: 'var(--bad)', 'Under investigation': 'var(--sev-high)', Contained: 'var(--sev-medium)', Resolved: 'var(--good)', Closed: 'var(--sev-info)' };
const dur = (h: number) => (h < 48 ? `${h} h` : `${Math.round(h / 24)} days`);

export default function IncidentsSection() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const { p, set, go } = useQuery();
  const { incidents } = useWorkspaceData();
  const { assets } = useContinuityData();
  const risks = useRiskData();
  const { vendorsReg } = useWorkspaceData();
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = `${grc ? `${grc.vendor} ${grc.product}` : 'HexaComply'} incident register`;

  const status = p('status') ?? 'all';
  const cause = p('cause') ?? 'all';
  const personal = p('personal') === '1';
  const breach = p('breach') === '1';
  const clear = () => set({ status: null, cause: null, personal: null, breach: null, id: null });
  const rows = incidents.filter((x) => (status === 'all' || x.status === status) && (cause === 'all' || x.cause === cause) && (!personal || x.personal) && (!breach || x.breach));
  const filtered = status !== 'all' || cause !== 'all' || personal || breach;

  const [open, setOpen] = useState<GrcIncident | null>(null);
  const match = useCallback((x: GrcIncident, id: string) => x.id === id, []);
  useDeepLink(incidents, match, setOpen);
  const n = (f: (x: GrcIncident) => boolean) => incidents.filter(f).length;
  const live = (x: GrcIncident) => x.status === 'Open' || x.status === 'Under investigation';

  return (
    <>
      <SectionHead intro={<>Operational and compliance incidents recorded by {c.short} — misdirected data, outages, supplier failures, process breaches — distinct from the SOC's detection incidents, which live in HexaSOC. Data-protection outcomes and regulator notifications are recorded here.</>} />
      <MetricBand tone={tone} items={[
        { ac: 'Incidents', word: 'Recorded', value: incidents.length, unit: 'last 12 months', active: !filtered, onClick: clear, source: src },
        { ac: 'Open', word: 'Or under investigation', value: n(live), unit: 'incidents', color: 'var(--bad)', active: status === 'Open', onClick: () => { clear(); set({ status: 'Open' }); }, source: src },
        { ac: 'Personal data', word: 'Involved', value: n((x) => x.personal), unit: 'incidents', active: personal && !breach, onClick: () => { clear(); set({ personal: '1' }); }, source: src },
        { ac: 'Breach', word: 'Notifiable', value: n((x) => x.breach), unit: 'notified to a regulator', color: 'var(--sev-critical)', active: breach, onClick: () => { clear(); set({ breach: '1' }); }, source: src },
        { ac: 'Third party', word: 'Cause', value: n((x) => x.cause === 'Third party'), unit: 'incidents', active: cause === 'Third party', onClick: () => { clear(); set({ cause: 'Third party' }); }, source: src },
      ]} />
      <Card flush>
        <div className="comply-facets">
          <Facet label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUSES.map((s) => ({ id: s as string, label: s, n: n((x) => x.status === s) }))} />
          <Facet label="Cause" value={cause} onChange={(v) => set({ cause: v })} options={CAUSES.filter((k) => n((x) => x.cause === k)).map((s) => ({ id: s as string, label: s, n: n((x) => x.cause === s) }))} />
          <Toggles label="Data protection" items={[
            { label: 'Personal data involved', on: personal, onChange: (on) => set({ personal: on ? '1' : null }), n: n((x) => x.personal) },
            { label: 'Breach', on: breach, onChange: (on) => set({ breach: on ? '1' : null }), n: n((x) => x.breach) },
          ]} />
        </div>
        <CountLine filtered={filtered} onClear={clear}>{rows.length} of {incidents.length} incidents · source {src}</CountLine>
        <DataTable<GrcIncident>
          rows={rows}
          rowKey={(x) => x.id}
          onRowClick={setOpen}
          search={(x) => `${x.id} ${x.title} ${x.cause} ${x.reportedBy}`}
          searchPlaceholder="Search incidents…"
          initialSort={{ key: 'start', dir: 'asc' }}
          empty="No GRC incidents recorded for this tenant."
          columns={[
            { key: 'inc', header: 'Incident', sort: (x) => x.id, render: (x) => <><div className="t-main" style={{ maxWidth: 400, whiteSpace: 'normal' }}>{x.title}</div><div className="t-sub mono">{x.id}</div></> },
            { key: 'cause', header: 'Cause', sort: (x) => x.cause, render: (x) => <><div className="t-main" style={{ fontSize: 12 }}>{x.cause}</div><div className="t-sub" style={{ maxWidth: 220, whiteSpace: 'normal' }}>{x.causeDetail}</div></> },
            { key: 'by', header: 'Reported by', sort: (x) => x.reportedBy, render: (x) => <span className="t-sub">{x.reportedBy}</span> },
            { key: 'start', header: 'Started', sort: (x) => x.startedDays, render: (x) => <span className="t-sub">{ago(x.startedDays)}</span> },
            { key: 'end', header: 'Ended', render: (x) => (x.durationH === null ? <Badge color="var(--bad)">Ongoing</Badge> : <span className="t-sub">{ago(Math.max(0, Math.round(x.startedDays - x.durationH / 24)))} · {dur(x.durationH)}</span>) },
            { key: 'pd', header: 'Personal data', sort: (x) => (x.breach ? 2 : x.personal ? 1 : 0), render: (x) => (x.breach ? <Badge color="var(--sev-critical)" solid>Breach</Badge> : x.personal ? <Badge color="var(--sev-medium)">Involved</Badge> : <span className="t-sub">No</span>) },
            { key: 'st', header: 'Status', sort: (x) => STATUSES.indexOf(x.status), render: (x) => <StatusBadge value={x.status} map={STATUS_COLOR} /> },
          ]}
        />
      </Card>

      {open && (() => {
        const x = open;
        const ast = x.asset ? assets.filter((a) => a.base === x.asset) : [];
        const ven = x.vendor ? vendorsReg.find((v) => v.name === x.vendor) : undefined;
        const rk = x.asset ? risks.filter((r) => r.asset === x.asset) : [];
        const close = () => { setOpen(null); set({ id: null }); };
        return (
          <RecordDrawer id={x.id} recordId={`incident grc-${x.id.slice(-3)}`} version="v3 · option set 2026.1" updatedDays={x.updatedDays} title={x.title}
            badges={<><StatusBadge value={x.status} map={STATUS_COLOR} /><Badge>{x.cause}</Badge>{x.breach ? <Badge color="var(--sev-critical)" solid>Personal data breach</Badge> : x.personal ? <Badge color="var(--sev-medium)">Personal data involved</Badge> : null}</>}
            onClose={close}>
            <RSec title="Timeline">
              <Timeline items={x.timeline.map((t, i) => ({ time: fmtDateTime(daysAgo(t.days)), title: t.text, color: i === 0 ? 'var(--sev-high)' : /Closed|Resolved/.test(t.text) ? 'var(--good)' : /Notified/.test(t.text) ? 'var(--sev-critical)' : tone }))} />
            </RSec>
            <RSec title="Cause" rows={[['Category', x.cause], ['Detail', x.causeDetail], ['Started', ago(x.startedDays)], ['Ended', x.durationH === null ? 'Ongoing' : `after ${dur(x.durationH)}`]]} />
            <RSec title="Data protection" rows={[
              ['Personal data involved', x.personal ? 'Yes' : 'No'], ['Breach', x.breach ? 'Yes — notifiable' : 'No'],
              ['Regulator notified', x.regulator ?? (x.breach ? 'Pending' : 'Not required')], ['Assessed by', c.people.grcLead.name],
            ]} />
            {x.breach && <Callout kind="warn">Notifiable personal data breach: notification timings and the decision record are kept with this incident for the regulator.</Callout>}
            <RSec title="Status" rows={[['Status', x.status], ['Description', x.description], ['Option set version', '2026.1']]} />
            <RSec title="Audit" rows={[['Reported by', x.reportedBy], ['Recorded by', c.people.grcLead.name], ['Created', ago(x.startedDays)], ['Last updated', ago(x.updatedDays)], ['Tenant', c.tenants.find((t) => t.id === x.tenant)?.name ?? '—']]} />
            <LinkedRecords items={[
              ...ast.slice(0, 1).map((a) => ({ label: `Asset: ${x.asset}`, sub: `${ast.length} record${ast.length === 1 ? '' : 's'} on the asset register`, count: ast.length, onClick: () => go('assets', { base: a.base }) })),
              ...(rk.length ? [{ label: `Risks against ${x.asset}`, count: rk.length, onClick: () => go('risks', { asset: x.asset }) }] : []),
              ...(ven ? [{ label: `Vendor: ${ven.name}`, sub: `${ven.id} · recorded risk ${ven.risk}`, onClick: () => go('vendors', { id: ven.id }) }] : x.vendor ? [{ label: `Vendor: ${x.vendor}`, sub: 'Third-Party Risk', onClick: () => nav('/comply/tprm') }] : []),
              ...(x.cause === 'Malicious act' ? [{ label: 'Related SOC detections', sub: 'HexaSOC incident response', onClick: () => nav('/soc/ir') }] : []),
            ]} />
          </RecordDrawer>
        );
      })()}
    </>
  );
}
