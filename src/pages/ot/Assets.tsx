import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Factory } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { otScope, otAssets, trackedAssets, PURDUE, LEVEL_HEX, SECTOR, type OtAsset, type PurdueLevel } from '../../data/modules/ot';
import { KpiStrip, Card, Badge, Chip, BarRow } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { fmtNum } from '../../lib/format';
import { OT_TONE, OtIntro, NoOtState, AssetDrawer, LevelBadge, levelLabel, srcNames } from './parts';

const CRIT_COLOR: Record<string, string> = { Safety: 'var(--sev-critical)', Production: 'var(--sev-medium)', Support: 'var(--text-muted)' };

function critOf(a: OtAsset): 'Safety' | 'Production' | 'Support' {
  return a.consequence >= 5 ? 'Safety' : a.consequence >= 3 ? 'Production' : 'Support';
}

export default function OtAssets() {
  const { customer: c, tenantId } = useApp();
  const [params, setParams] = useSearchParams();
  const sc = useMemo(() => otScope(c, tenantId), [c, tenantId]);
  const all = useMemo(() => otAssets(c, tenantId), [c, tenantId]);
  const tracked = useMemo(() => trackedAssets(c, tenantId), [c, tenantId]);
  const [sel, setSel] = useState<OtAsset | null>(null);

  const view = params.get('view') === 'all' ? 'all' : 'tracked';
  const level = params.get('level') as PurdueLevel | null;
  const site = params.get('site');
  const zone = params.get('zone');
  const type = params.get('type');
  const crit = params.get('crit');
  const fw = params.get('fw') === 'behind';
  const route = params.get('route');
  const proto = params.get('proto');
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v === null || p.get(k) === v) p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };

  const base: OtAsset[] = view === 'all' ? all : tracked;
  const rows = useMemo(() => base.filter((a) =>
    (!level || a.level === level) && (!site || a.siteId === site) && (!zone || a.zone === zone) && (!type || a.type === type) &&
    (!crit || critOf(a) === crit) && (!fw || a.fwBehind > 0) && (!proto || a.protocols.includes(proto)) && (!route || ('route' in a && (a as { route: string }).route === route))), [base, level, site, zone, type, crit, fw, route, proto]);

  if (!sc.hasOt) return <NoOtState what="The asset inventory covers sites that run operational technology." />;
  const w = SECTOR[c.id];
  const src = srcNames(sc);
  const findings = tracked.reduce((s, a) => s + a.findings, 0);
  const noFix = tracked.filter((a) => a.route === 'No vendor fix').length;
  const byType = count(tracked.map((a) => a.type));
  const byZone = count(tracked.map((a) => a.zone));
  const maxT = Math.max(1, ...byType.map(([, n]) => n));
  const maxZ = Math.max(1, ...byZone.map(([, n]) => n));
  const findingsOf = new Map(tracked.map((a) => [a.id, a]));
  const activeFilters = [level && `Level ${levelLabel(level)}`, site && sc.sites.find((s) => s.id === site)?.name, zone, type, crit, fw && 'Firmware behind', route, proto && `Speaks ${proto}`].filter(Boolean) as string[];

  return (
    <>
      <OtIntro>
        <b>{c.name}</b> · the {tracked.length} assets HexaOT follows individually — the ones that govern the process or carry an open finding — out of {fmtNum(all.length)} discovered across the estate by {src}. Everything here was found by listening, not by scanning.
      </OtIntro>

      <KpiStrip
        toneColor={OT_TONE}
        items={[
          { label: 'Tracked', hint: 'individually', value: tracked.length, onClick: () => setParams(new URLSearchParams(), { replace: true }), source: src },
          { label: 'Safety', hint: c.id === 'healthcare' ? 'failure can harm a patient' : 'failure risks people', value: tracked.filter((a) => a.crit === 'Safety').length, toneColor: 'var(--sev-critical)', onClick: () => setParams(new URLSearchParams({ crit: 'Safety' }), { replace: true }), source: src },
          { label: 'Firmware', hint: 'behind vendor latest', value: tracked.filter((a) => a.fwBehind > 0).length, bar: (tracked.filter((a) => a.fwBehind > 0).length / Math.max(1, tracked.length)) * 100, onClick: () => setParams(new URLSearchParams({ fw: 'behind' }), { replace: true }), source: `${src} · vendor firmware catalogue` },
          { label: 'Findings', hint: 'open on these assets', value: fmtNum(findings), to: '/ot/vulns', source: `${src} · vendor advisories, NVD` },
          { label: 'No fix', hint: 'vendor has none', value: noFix, onClick: () => setParams(new URLSearchParams({ route: 'No vendor fix' }), { replace: true }), source: 'Vendor advisories' },
          { label: 'Discovered', hint: 'full inventory', value: fmtNum(all.length), onClick: () => setParams(new URLSearchParams({ view: 'all' }), { replace: true }), source: src },
        ]}
      />

      <div className="grid g2">
        <Card title="Tracked assets by type" sub="what we follow closely · click to filter">
          <div className="stack" style={{ gap: 4 }}>
            {byType.slice(0, 12).map(([t, n]) => (
              <button key={t} className="ot-barbtn" onClick={() => setParams(new URLSearchParams({ type: t }), { replace: true })}>
                <BarRow label={t} value={n} max={maxT} color="var(--m-ot)" display={n} />
              </button>
            ))}
          </div>
        </Card>
        <Card title="By network zone" sub="where they sit · click to filter">
          <div className="stack" style={{ gap: 4 }}>
            {byZone.slice(0, 12).map(([z, n]) => (
              <button key={z} className="ot-barbtn" onClick={() => setParams(new URLSearchParams({ zone: z }), { replace: true })}>
                <BarRow label={z} value={n} max={maxZ} color="var(--m-ot)" display={n} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="ot-filters">
        <span>
          <em>View</em>
          <Chip on={view === 'tracked'} onClick={() => set('view', null)} color={OT_TONE}>Tracked · {tracked.length}</Chip>
          <Chip on={view === 'all'} onClick={() => set('view', 'all')} color={OT_TONE}>Full inventory · {fmtNum(all.length)}</Chip>
        </span>
        <span>
          <em>Site</em>
          <Chip on={!site} onClick={() => set('site', null)} color={OT_TONE}>All</Chip>
          {sc.sites.map((s) => <Chip key={s.id} on={site === s.id} onClick={() => set('site', s.id)} color={OT_TONE}>{s.name.replace(/ \(air-gapped\)/, '')}</Chip>)}
        </span>
        <span>
          <em>Criticality</em>
          {['Safety', 'Production', 'Support'].map((k) => <Chip key={k} on={crit === k} onClick={() => set('crit', k)} color={CRIT_COLOR[k]}>{k}</Chip>)}
        </span>
        <span>
          <em>Level</em>
          {PURDUE.map((p) => <Chip key={p.id} on={level === p.id} onClick={() => set('level', p.id)} color={LEVEL_HEX[p.id]}>{w.levels[p.id].name}</Chip>)}
        </span>
        <span>
          <em>Firmware</em>
          <Chip on={fw} onClick={() => set('fw', 'behind')} color="var(--sev-medium)">Behind latest</Chip>
        </span>
      </div>

      <Card
        title={<><Factory size={15} /> {view === 'all' ? 'Asset inventory' : 'Tracked assets'}</>}
        count={fmtNum(rows.length)}
        sub={activeFilters.length ? `Filtered: ${activeFilters.join(' · ')}` : `${fmtNum(rows.length)} of ${fmtNum(base.length)} ${view === 'all' ? 'discovered' : 'tracked'} assets · click a row for detail`}
        actions={activeFilters.length ? <button className="link" onClick={() => setParams(view === 'all' ? new URLSearchParams({ view: 'all' }) : new URLSearchParams(), { replace: true })}>Clear filters</button> : undefined}
        flush
      >
        <DataTable
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={setSel}
          search={(a) => `${a.name} ${a.type} ${a.vendor} ${a.model} ${a.ip} ${a.zone} ${a.siteName} ${a.protocols.join(' ')}`}
          searchPlaceholder="Search name, IP, vendor, zone, protocol…"
          initialSort={{ key: view === 'all' ? 'risk' : 'findings', dir: 'desc' }}
          pageSize={12}
          columns={[
            { key: 'name', header: 'Asset', sort: (a) => a.name, render: (a) => (<><div className="t-main mono">{a.name}</div><div className="t-sub">{a.vendor} · {a.model}</div></>) },
            { key: 'type', header: 'Type', sort: (a) => a.type, render: (a) => (<><div>{a.type}</div><Badge color={CRIT_COLOR[critOf(a)]}>{critOf(a)}</Badge></>) },
            { key: 'level', header: 'Level', sort: (a) => levelLabel(a.level), render: (a) => <LevelBadge level={a.level} /> },
            { key: 'site', header: 'Site & zone', sort: (a) => a.siteName, render: (a) => (<><div>{a.siteName}</div><div className="t-sub">{a.zone}</div></>) },
            { key: 'proto', header: 'Protocols', render: (a) => <span className="chips">{a.protocols.slice(0, 3).map((p) => <span key={p} className="src-chip">{p}</span>)}</span> },
            view === 'all'
              ? { key: 'risk', header: 'Risk', align: 'right' as const, sort: (a: OtAsset) => a.risk, render: (a: OtAsset) => <b style={{ color: a.risk >= 75 ? 'var(--sev-critical)' : a.risk >= 55 ? 'var(--sev-high)' : 'var(--text-secondary)' }}>{a.risk}</b> }
              : { key: 'findings', header: 'Open findings', align: 'right' as const, sort: (a: OtAsset) => findingsOf.get(a.id)?.findings ?? 0, render: (a: OtAsset) => {
                  const t = findingsOf.get(a.id);
                  return t ? <span><b>{t.findings}</b>{t.critFindings > 0 && <Badge color="var(--sev-critical)">{t.critFindings} critical</Badge>}</span> : '—';
                } },
            { key: 'fw', header: 'Firmware', sort: (a) => a.fwBehind, render: (a) => (<><div className="mono">{a.firmware}</div><div className="t-sub">{a.fwBehind > 0 ? `latest ${a.latestFirmware}` : 'current'}</div></>) },
          ]}
          empty="No assets match these filters."
        />
      </Card>

      {sel && <AssetDrawer a={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function count(xs: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
