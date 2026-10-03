import { Card } from '../../../components/ui';
import { DataTable, type Column } from '../../../components/DataTable';
import { BarList } from '../../insurance/viz';
import { plural } from '../../../lib/format';
import { SB_VEX, type SbCompRow, type SbVex } from '../../../data/modules/sbom';
import { SEV_VAR } from '../parts';
import { FChips, LicPill, Pill, SevPill, VexBar, type SbCtx } from './ui';

type CF = 'vulnerable' | 'vex-na' | 'licence';

export function Components({ ctx }: { ctx: SbCtx }) {
  const { d, sp, setParams, openComp } = ctx;
  const f = (sp.get('f') as CF | null) ?? 'all';
  const vex = sp.get('vex') as SbVex | null;
  const eco = sp.get('eco');
  const test = (x: SbCompRow, k: CF) => (k === 'vulnerable' ? x.vulnerable : k === 'vex-na' ? x.vex['Not affected'] > 0 : x.licFlag);
  const rows = d.comps.filter((x) => (f === 'all' || test(x, f)) && (!vex || x.vex[vex] > 0) && (!eco || x.c.ecosystem === eco));
  const ecos = [...new Set(d.comps.map((x) => x.c.ecosystem))].map((e) => ({ e, n: d.comps.filter((x) => x.c.ecosystem === e).length })).sort((a, b) => b.n - a.n);

  const cols: Column<SbCompRow>[] = [
    { key: 'n', header: 'Component', sort: (x) => x.c.name, render: (x) => (<><div className="t-main"><span className="mono">{x.c.name}</span>{x.c.advisory && <Pill color="var(--sev-critical)" solid>Headline advisory</Pill>}</div><div className="t-sub">{x.c.ecosystem} · {x.c.category}</div></>) },
    { key: 'v', header: 'Versions in use', sort: (x) => x.versions.length, render: (x) => <span className="mono" style={{ fontSize: 11 }}>{x.versions.slice(0, 3).join(', ')}{x.versions.length > 3 ? ` +${x.versions.length - 3}` : ''}</span> },
    { key: 'p', header: 'Used in', align: 'right', sort: (x) => x.products, render: (x) => <b>{plural(x.products, 'product')}</b> },
    { key: 'k', header: 'Known vulns', sort: (x) => (x.maxSev ? ['info', 'low', 'medium', 'high', 'critical'].indexOf(x.maxSev) : -1), render: (x) => (x.c.vulns.length ? <span className="sb-row" style={{ gap: 6 }}><span className="sb-cve" style={{ color: x.maxSev ? SEV_VAR[x.maxSev] : undefined }}>{x.c.vulns[0].id}</span>{x.maxSev && <SevPill sev={x.maxSev} />}</span> : <span className="muted">None</span>) },
    { key: 'x', header: 'VEX status', sort: (x) => x.vex.Affected * 10 + x.vex['Under investigation'], render: (x) => <VexBar vex={x.vex} /> },
    { key: 'l', header: 'Licence', sort: (x) => x.c.licRisk, render: (x) => <LicPill r={x.c.licRisk} licence={x.c.licence.length > 22 ? x.c.licRisk : x.c.licence} /> },
  ];

  return (
    <div className="sb-stack">
      <div className="grid g3">
        <Card title="By ecosystem" sub="Components in the watched set · click to filter">
          <BarList labelWidth={120} items={ecos.map(({ e, n }) => ({ label: e, value: n, color: eco === e ? 'var(--m-core)' : '#4f8cff', onClick: () => setParams({ eco: eco === e ? null : e }) }))} />
        </Card>
        <Card title="VEX status" sub="Vulnerability findings × products">
          <BarList labelWidth={140} items={SB_VEX.map((k) => ({ label: k, value: d.comps.reduce((s, x) => s + x.vex[k], 0), color: k === 'Affected' ? '#e0345e' : k === 'Under investigation' ? '#f0a338' : k === 'Fixed' ? '#a07cfb' : '#2dd4bf', onClick: () => setParams({ vex: vex === k ? null : k }) }))} />
        </Card>
        <Card title="Licence risk" sub="Copyleft in distributed software, or no licence stated">
          <BarList labelWidth={140} items={(['Strong copyleft', 'Weak copyleft', 'Unknown', 'Permissive'] as const).map((r) => ({ label: r, value: d.comps.filter((x) => x.c.licRisk === r).length, color: r === 'Strong copyleft' ? '#f2643f' : r === 'Unknown' ? '#f0a338' : r === 'Weak copyleft' ? '#e2c73f' : '#2dd4bf', onClick: () => setParams({ f: 'licence' }) }))} />
        </Card>
      </div>

      <Card title="Components" count={rows.length} sub={`The watched set: every library that appears in a product SBOM in scope, from ${d.kpi.tracked.toLocaleString('en-GB')} distinct components · click for every product it is inside`} flush>
        <div className="sb-facets">
          <FChips<CF> label="Show" value={f} options={[{ id: 'vulnerable', label: 'Vulnerable' }, { id: 'vex-na', label: 'VEX: not affected' }, { id: 'licence', label: 'Licence risk' }]} onChange={(v) => setParams({ f: v })} counts={{ vulnerable: d.kpi.vulnerable, 'vex-na': d.comps.filter((x) => x.vex['Not affected'] > 0).length, licence: d.kpi.licence }} />
          {vex && <button type="button" className="sb-fchip on" onClick={() => setParams({ vex: null })}>VEX: {vex} ✕</button>}
          {eco && <button type="button" className="sb-fchip on" onClick={() => setParams({ eco: null })}>{eco} ✕</button>}
        </div>
        <DataTable rows={rows} columns={cols} rowKey={(x) => x.c.id} onRowClick={(x) => openComp(x.c.id)} search={(x) => `${x.c.name} ${x.c.category} ${x.c.ecosystem} ${x.c.vulns.map((v) => v.id).join(' ')} ${x.c.licence}`} searchPlaceholder="Search library, CVE, licence…" initialSort={{ key: 'x', dir: 'desc' }} pageSize={25} empty="No components for this filter." />
      </Card>
    </div>
  );
}
