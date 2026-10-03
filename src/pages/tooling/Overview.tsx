import { useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Chip, HealthBadge, Badge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { toolProfiles, csfCoverage, CSF_HEX, MODULE_LABEL, type ToolProfile } from '../../data/modules/tooling';
import { ENV_HEX, ENV_LABEL } from '../../data/modules/fabric';
import { fmtAgo, fmtCompact, fmtNum } from '../../lib/format';
import type { Env } from '../../data/types';
import { Spark, ToolDrawer, ToolMark, TONE, toneStyle } from './parts';

const ENVS: Env[] = ['cloud', 'saas', 'onprem', 'ot'];

export default function ToolingOverview() {
  const { customer: c, tenantId } = useApp();
  const [params, setParams] = useSearchParams();
  const tools = useMemo(() => toolProfiles(c, tenantId), [c, tenantId]);
  const [q, setQ] = useState('');
  const env = (params.get('env') as Env | null) ?? 'all';
  const cat = params.get('cat') ?? 'all';
  const csf = params.get('csf');
  const openId = params.get('tool');
  const open = tools.find((t) => t.k.id === openId) ?? null;

  const set = (k: string, v: string | null) => {
    if (v === null || v === 'all') params.delete(k);
    else params.set(k, v);
    setParams(params, { replace: true });
  };

  const filtered = tools.filter(
    (t) =>
      (env === 'all' || t.k.env === env) &&
      (cat === 'all' || t.k.category === cat) &&
      (!csf || t.csf.includes(csf as never)) &&
      (!q || `${t.name} ${t.k.category} ${t.role}`.toLowerCase().includes(q.toLowerCase())),
  );
  const cats = [...new Set(tools.map((t) => t.k.category))].sort();
  const vendors = new Set(tools.filter((t) => t.k.vendor !== 'Generic').map((t) => t.k.vendor)).size;
  const epm = tools.reduce((s, t) => s + t.eventsPerMin, 0);
  const cov = csfCoverage(tools);

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · the itinerary of every security tool HexaView integrates for {c.short}: {tools.length} integrations from {vendors} vendors across cloud, SaaS, on-prem and OT. Each card shows what the tool does here, what it is doing right now and where its data goes. Click any tool for its full integration profile.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Integrated tools', value: tools.length, onClick: () => { set('env', null); set('cat', null); set('csf', null); }, source: 'HexaCore connector registry' },
          { label: 'Vendors', value: vendors, to: '/ops/scorecard', source: 'Connector manifests' },
          { label: 'Events / min', value: fmtCompact(epm), to: '/tooling/activity', source: 'hv-gateway throughput' },
          { label: 'Write-capable', value: tools.filter((t) => !t.readOnly).length, unit: 'gated', to: '/tooling/matrix?write=yes', source: 'Action Centre policy' },
          { label: 'OT tools', value: tools.filter((t) => t.k.env === 'ot').length, unit: 'read-only', onClick: () => set('env', 'ot'), source: 'Connector manifests' },
          { label: 'Need attention', value: tools.filter((t) => t.health !== 'healthy').length, toneColor: 'var(--sev-medium)', to: '/fabric/integrations?status=degraded', source: 'Connector health' },
        ]}
      />

      <Card title="Coverage across the NIST CSF 2.0 functions" sub="Which tools do what · click a function to filter the itinerary">
        <div className="tl-csf">
          {cov.map(({ fn, tools: ts }) => (
            <button key={fn} className="tl-csf-col" style={{ '--fn': CSF_HEX[fn] } as CSSProperties} onClick={() => set('csf', csf === fn ? null : fn)}>
              <h4>{fn}</h4>
              <div className="num">{ts.length}</div>
              <ul>
                {ts.slice(0, 5).map((t) => <li key={t.k.id}>{t.short}</li>)}
                {ts.length > 5 && <li className="muted">+{ts.length - 5} more</li>}
              </ul>
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Tool itinerary"
        count={filtered.length}
        sub={csf ? `Filtered to ${csf}` : 'Every integrated tool, busiest first'}
        actions={
          <div className="row wrap" style={{ gap: 6 }}>
            <label className="search" style={{ width: 200 }}>
              <Search size={13} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tool…" aria-label="Find a tool" />
            </label>
            <Chip on={env === 'all'} onClick={() => set('env', null)} color={TONE}>All</Chip>
            {ENVS.filter((e) => tools.some((t) => t.k.env === e)).map((e) => (
              <Chip key={e} on={env === e} onClick={() => set('env', e)} color={ENV_HEX[e]}>{ENV_LABEL[e]}</Chip>
            ))}
            <select className="select" value={cat} onChange={(e) => set('cat', e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {cats.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
        }
      >
        <div className="tl-grid">
          {filtered
            .slice()
            .sort((a, b) => b.eventsPerMin - a.eventsPerMin)
            .map((t) => (
              <button key={t.k.id} className="tl-card" style={{ '--env': ENV_HEX[t.k.env] } as CSSProperties} onClick={() => set('tool', t.k.id)}>
                <div className="tl-card-head">
                  <ToolMark t={t} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{t.name}</b>
                    <span>{t.k.category} · {ENV_LABEL[t.k.env]}</span>
                  </div>
                  <HealthBadge status={t.health} />
                </div>
                <div className="tl-card-role">{t.role}.</div>
                <div className="chips">
                  {t.modules.slice(0, 3).map((m) => <span key={m} className="src-chip">{MODULE_LABEL[m]}</span>)}
                  {!t.readOnly && <Badge color="#f97316">R/W</Badge>}
                </div>
                <div className="tl-card-foot">
                  <div>
                    <span className="num">{fmtNum(t.eventsPerMin)}</span>
                    <small>events/min · synced {fmtAgo(t.k.lastSyncMin)}</small>
                  </div>
                  <Spark data={t.hourly} color={ENV_HEX[t.k.env]} w={110} h={30} />
                </div>
              </button>
            ))}
        </div>
      </Card>

      <Card title="Itinerary table" sub="Sortable inventory for export and audit" flush>
        <DataTable
          rows={filtered}
          rowKey={(t) => t.k.id}
          onRowClick={(t) => set('tool', t.k.id)}
          initialSort={{ key: 'epm', dir: 'desc' }}
          columns={[
            { key: 'tool', header: 'Tool', sort: (t) => t.name, render: (t) => (<div className="row" style={{ gap: 8 }}><ToolMark t={t} size={26} /><div><div className="t-main">{t.name}</div><div className="t-sub">{t.k.category}</div></div></div>) },
            { key: 'env', header: 'Where', sort: (t) => t.k.env, render: (t) => <Badge color={ENV_HEX[t.k.env]}>{ENV_LABEL[t.k.env]}</Badge> },
            { key: 'csf', header: 'CSF', render: (t) => <span className="chips">{t.csf.map((f) => <span key={f} className="tl-dot" title={f} style={{ background: CSF_HEX[f] }} />)}</span> },
            { key: 'method', header: 'Integration', render: (t) => <span className="t-sub">{t.method}</span> },
            { key: 'dp', header: 'Data plane', render: (t) => <span className="t-sub">{c.dataPlanes.find((d) => d.id === t.k.dataPlaneId)?.name}</span> },
            { key: 'epm', header: 'Events/min', align: 'right', sort: (t) => t.eventsPerMin, render: (t) => fmtNum(t.eventsPerMin) },
            { key: 'rw', header: 'Write', render: (t) => (t.readOnly ? <span className="muted">Read-only</span> : <Badge color="#f97316">Gated</Badge>) },
            { key: 'health', header: 'Health', sort: (t) => t.health, render: (t) => <HealthBadge status={t.health} /> },
          ]}
        />
      </Card>

      {open && <ToolDrawer t={open as ToolProfile} onClose={() => set('tool', null)} />}
    </div>
  );
}
