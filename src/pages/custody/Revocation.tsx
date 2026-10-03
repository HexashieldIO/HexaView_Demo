import { useEffect, useMemo, useState } from 'react';
import { Ban, KeyRound, Timer } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { custodyScope, custodyGrants, custodyRevocations, type Grant, type GrantScope, type Revocation } from '../../data/modules/custody';
import { KpiStrip, Card, Badge, Btn, Chip, Legend, Callout, KV, IcoBox } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtDur, fmtDate, daysAgo, fmtNum } from '../../lib/format';
import { CUSTODY_TONE, SCOPE_META, RevokeModal, type RevokeRequest } from './parts';

const SCOPE_COLOR: Record<GrantScope, string> = { supplier: 'var(--sev-high)', user: 'var(--accent)', session: 'var(--m-custody)' };

function fmtExpiry(h: number): string {
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}
function fmtProp(s: number): string {
  return s < 120 ? `${s} s` : fmtDur(s / 60);
}

export default function CustodyRevocation() {
  const { customer: c, tenantId, timeRange } = useApp();
  const days = rangeDays(timeRange);
  const sc = useMemo(() => custodyScope(c, tenantId), [c, tenantId]);
  const baseGrants = useMemo(() => custodyGrants(c, tenantId), [c, tenantId]);
  const baseRevs = useMemo(() => custodyRevocations(c, tenantId), [c, tenantId]);
  const [grants, setGrants] = useState<Grant[]>(baseGrants);
  const [revs, setRevs] = useState<Revocation[]>(baseRevs);
  const [scopeFilter, setScopeFilter] = useState<GrantScope | 'all'>('all');
  const [revoke, setRevoke] = useState<{ req: RevokeRequest; grant: Grant } | null>(null);
  const [selRev, setSelRev] = useState<Revocation | null>(null);

  useEffect(() => { setGrants(baseGrants); setRevs(baseRevs); }, [baseGrants, baseRevs]);

  const shown = scopeFilter === 'all' ? grants : grants.filter((g) => g.scope === scopeFilter);
  const expiring = grants.filter((g) => g.expiresInHours <= 24).length;
  const createdInRange = grants.filter((g) => g.ageHours <= days * 24).length;
  const props = revs.map((r) => r.propagationSec).sort((a, b) => a - b);
  const median = props.length ? props[Math.floor(props.length / 2)] : 0;
  const within = props.length ? Math.round((props.filter((p) => p < 60).length / props.length) * 100) : 100;
  const chronological = revs.slice().sort((a, b) => b.daysAgo - a.daysAgo);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {sc.tenantName}. Access to {sc.label.toLowerCase()} is granted per supplier, user or session and can be withdrawn at any of those levels; custody agents enforce it everywhere a copy lives, with a target of under 60 seconds.
      </p>

      <KpiStrip
        toneColor={CUSTODY_TONE}
        items={[
          { label: 'Active grants', value: grants.length, onClick: () => document.getElementById('custody-grants')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger', delta: { text: `${createdInRange} issued · ${rangeLabel(timeRange).toLowerCase()}`, good: true } },
          { label: 'Supplier-wide', value: grants.filter((g) => g.scope === 'supplier').length, toneColor: 'var(--sev-high)', onClick: () => document.getElementById('custody-grants')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Expiring < 24 h', value: expiring, onClick: () => document.getElementById('custody-grants')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Revocations', hint: '30 d', value: revs.length, onClick: () => document.getElementById('custody-revs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Median propagation', value: `${median} s`, bar: Math.max(5, 100 - (median / 60) * 100), onClick: () => document.getElementById('custody-revs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Within 60 s', value: `${within}%`, bar: within, onClick: () => document.getElementById('custody-revs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'HexaCustody agents · signed custody ledger', delta: within < 100 ? { text: `${props.filter((p) => p >= 60).length} over target`, good: false } : undefined },
        ]}
      />

      <div id="custody-grants" />
      <Card
        title={<><KeyRound size={15} /> Active grants</>}
        count={shown.length}
        sub="Who can open what, and until when · revoke at session, user or supplier level"
        flush
      >
        <DataTable
          rows={shown}
          rowKey={(g) => g.id}
          search={(g) => `${g.target} ${g.asset} ${g.detail} ${g.grantedBy}`}
          searchPlaceholder="Search supplier, user, asset…"
          initialSort={{ key: 'exp', dir: 'asc' }}
          toolbar={
            <span className="chips">
              <Chip on={scopeFilter === 'all'} onClick={() => setScopeFilter('all')} color={CUSTODY_TONE}>All</Chip>
              {(['supplier', 'user', 'session'] as GrantScope[]).map((s) => (
                <Chip key={s} on={scopeFilter === s} onClick={() => setScopeFilter(s)} color={SCOPE_COLOR[s]}>{SCOPE_META[s].label} · {grants.filter((g) => g.scope === s).length}</Chip>
              ))}
            </span>
          }
          columns={[
            { key: 'scope', header: 'Level', sort: (g) => g.scope, render: (g) => <Badge color={SCOPE_COLOR[g.scope]}>{SCOPE_META[g.scope].label}</Badge> },
            { key: 'target', header: 'Grantee', sort: (g) => g.target, render: (g) => (<><div className="t-main">{g.target}</div><div className="t-sub">{g.detail}</div></>) },
            { key: 'asset', header: 'Asset / project', sort: (g) => g.asset, render: (g) => g.asset },
            { key: 'by', header: 'Granted by', render: (g) => <span className="t-sub">{g.grantedBy}</span> },
            { key: 'uses', header: 'Uses', align: 'right', sort: (g) => g.uses, render: (g) => fmtNum(g.uses) },
            { key: 'exp', header: 'Expires in', sort: (g) => g.expiresInHours, render: (g) => <span style={{ color: g.expiresInHours <= 24 ? 'var(--sev-medium)' : undefined, fontWeight: 600 }}>{fmtExpiry(g.expiresInHours)}</span> },
            { key: 'risk', header: 'Revoke risk', render: (g) => <Badge color={g.risk === 'high' ? 'var(--sev-high)' : 'var(--sev-medium)'}>{g.risk === 'high' ? 'High · 2 approvers' : 'Medium · 1 approver'}</Badge> },
            { key: 'act', header: '', render: (g) => <Btn sm danger onClick={() => setRevoke({ grant: g, req: { scope: g.scope, target: g.target, asset: g.asset, detail: g.detail } })}><Ban /> Revoke</Btn> },
          ]}
        />
      </Card>

      <div className="grid g-3-2">
        <Card title={<><Timer size={15} /> Propagation time</>} sub="Seconds from approval to enforcement on every agent holding a copy · last 30 days" actions={<Legend items={[{ label: 'Within 60 s', color: '#2dd4bf' }, { label: 'Over target', color: '#f8646f' }]} />}>
          <Chart
            height={260}
            onClick={(p) => { const i = (p as { dataIndex?: number }).dataIndex; if (i !== undefined) setSelRev(chronological[i]); }}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: unknown) => { const p = (ps as { dataIndex: number }[])[0]; const r = chronological[p.dataIndex]; return `<b>${r.id}</b> · ${SCOPE_META[r.scope].label}<br/>${r.target}<br/>${fmtProp(r.propagationSec)} · ${r.reason}`; } },
              xAxis: { type: 'category', data: chronological.map((r) => fmtDate(daysAgo(r.daysAgo)).replace(/ \d{4}$/, '')), axisLabel: { fontSize: 9.5 } },
              yAxis: { type: 'value', max: 90, name: 'seconds', axisLabel: { formatter: (v: number) => (v >= 90 ? '90+' : String(v)) } },
              series: [{
                type: 'bar',
                data: chronological.map((r) => ({ value: Math.min(90, r.propagationSec), itemStyle: { color: r.propagationSec >= 60 ? '#f8646f' : '#2dd4bf' } })),
                markLine: { silent: true, symbol: 'none', lineStyle: { color: '#f5a83d', type: 'dashed' }, label: { formatter: '60 s target', color: '#f5a83d', fontSize: 10 }, data: [{ yAxis: 60 }] },
              }],
            }}
          />
        </Card>
        <Card title="By level and reason" sub={`${revs.length} revocations in 30 days`}>
          <div className="stack" style={{ gap: 10 }}>
            {(['session', 'user', 'supplier'] as GrantScope[]).map((s) => {
              const rs = revs.filter((r) => r.scope === s);
              const med = rs.length ? rs.map((r) => r.propagationSec).sort((a, b) => a - b)[Math.floor(rs.length / 2)] : 0;
              return (
                <div key={s} className="row" style={{ fontSize: 12.5 }}>
                  <Badge color={SCOPE_COLOR[s]}>{SCOPE_META[s].label}</Badge>
                  <span className="spacer" />
                  <b>{rs.length}</b>
                  <span className="muted" style={{ width: 110, textAlign: 'right' }}>median {rs.length ? `${med} s` : '—'}</span>
                </div>
              );
            })}
          </div>
          <div className="section-label" style={{ marginTop: 14 }}>Top reasons</div>
          <div className="chips">
            {[...new Set(revs.map((r) => r.reason))].map((x) => ({ x, n: revs.filter((r) => r.reason === x).length })).sort((a, b) => b.n - a.n).slice(0, 6).map(({ x, n }) => <Badge key={x}>{x} · {n}</Badge>)}
          </div>
          {revs.some((r) => r.note) && (
            <div style={{ marginTop: 14 }}>
              <Callout kind="warn">{revs.find((r) => r.note)?.note}</Callout>
            </div>
          )}
        </Card>
      </div>

      <div id="custody-revs" />
      <Card title="Revocations, last 30 days" count={revs.length} sub="Every revocation is approved, recorded in the audit ledger and timed to enforcement" flush>
        <DataTable
          rows={revs}
          rowKey={(r) => r.id}
          onRowClick={setSelRev}
          search={(r) => `${r.id} ${r.target} ${r.asset} ${r.reason} ${r.by}`}
          initialSort={{ key: 'when', dir: 'asc' }}
          columns={[
            { key: 'when', header: 'When', sort: (r) => r.daysAgo, render: (r) => <span className="t-sub">{fmtDate(daysAgo(r.daysAgo))}</span> },
            { key: 'scope', header: 'Level', sort: (r) => r.scope, render: (r) => <Badge color={SCOPE_COLOR[r.scope]}>{SCOPE_META[r.scope].label}</Badge> },
            { key: 'target', header: 'Target', sort: (r) => r.target, render: (r) => (<><div className="t-main">{r.target}</div><div className="t-sub">{r.asset}</div></>) },
            { key: 'reason', header: 'Reason', sort: (r) => r.reason, render: (r) => r.reason },
            { key: 'appr', header: 'Approved by', render: (r) => <span className="t-sub">{r.approvers.join(' + ')}</span> },
            { key: 'prop', header: 'Propagation', align: 'right', sort: (r) => r.propagationSec, render: (r) => <b style={{ color: r.propagationSec >= 60 ? 'var(--bad)' : 'var(--good)' }}>{fmtProp(r.propagationSec)}</b> },
          ]}
        />
      </Card>

      {revoke && (
        <RevokeModal
          req={revoke.req}
          onClose={() => setRevoke(null)}
          onDone={(res) => {
            const g = revoke.grant;
            setGrants((gs) => gs.filter((x) => x.id !== g.id));
            setRevs((rs) => [{ id: res.id, scope: revoke.req.scope, target: g.target, asset: g.asset, reason: res.reason, by: res.approvers[0], approvers: res.approvers, daysAgo: 0, propagationSec: res.propagationSec }, ...rs]);
          }}
        />
      )}
      {selRev && (
        <Drawer title={`${selRev.id} · ${SCOPE_META[selRev.scope].label} revocation`} sub={selRev.target} icon={<IcoBox color={SCOPE_COLOR[selRev.scope]}><Ban /></IcoBox>} onClose={() => setSelRev(null)}>
          <KV rows={[
            ['Level', SCOPE_META[selRev.scope].label],
            ['Target', selRev.target],
            ['Asset', selRev.asset],
            ['Reason', selRev.reason],
            ['Requested by', selRev.by],
            ['Approved by', selRev.approvers.join(' + ')],
            ['Risk class', selRev.scope === 'supplier' ? 'High (2 approvers)' : 'Medium (1 approver)'],
            ['When', selRev.daysAgo < 0.05 ? 'Just now' : fmtDate(daysAgo(selRev.daysAgo))],
            ['Propagation', <b style={{ color: selRev.propagationSec >= 60 ? 'var(--bad)' : 'var(--good)' }}>{fmtProp(selRev.propagationSec)} {selRev.propagationSec >= 60 ? '(over 60 s target)' : '(within target)'}</b>],
          ]} />
          {selRev.note && <div style={{ marginTop: 14 }}><Callout kind="warn">{selRev.note}</Callout></div>}
        </Drawer>
      )}
    </>
  );
}
