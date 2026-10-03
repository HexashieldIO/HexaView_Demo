import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Crosshair } from 'lucide-react';
import { Card, Badge, Btn, SevBadge, Sources, Stacked, Ring } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { DataTable, type Column } from '../../../components/DataTable';
import { fmtAgo, fmtDur } from '../../../lib/format';
import { useApp } from '../../../state/AppContext';
import {
  VR_SOURCE_META, VR_STATUSES, VR_STATUS_HEX, vrRequestValidation, vrRequestScan, vrSiem, vrScanner, vrItsm,
  type VrAsset, type VrSource, type VrStatus,
} from '../../../data/modules/vulnresponse';
import { FilterGroup } from '../parts';
import { useVr } from './state';
import { StatusPill, SourceTag, ValPill, Confirm, fmtDue, stamp } from './ui';

const SRC_LABEL: Record<string, VrSource> = { HexaCore: 'core', 'Security Tooling': 'tooling', HexaOT: 'ot' };

export function Patch() {
  const { c, adv, rows, tally, detections, checks, burn, setParams, me } = useVr();
  const { toast } = useApp();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const [bulk, setBulk] = useState(false);
  const status = (sp.get('status') as VrStatus | null) ?? null;
  const src = (sp.get('src') as VrSource | null) ?? null;
  const net = sp.get('net') === '1';
  const shown = rows.filter((a) => (!status || a.status === status) && (!src || a.source === src) && (!net || a.internet));
  const openAsset = (a: VrAsset) => { const next = new URLSearchParams(sp); next.set('asset', a.id); setSp(next, { replace: true }); };
  const open = rows.filter((a) => a.status === 'Unpatched' || a.status === 'Mitigated');
  const itsm = vrItsm(c);
  const pct = tally.total ? Math.round((tally.Patched / tally.total) * 100) : 0;
  const filter = (patch: Record<string, string | null>) => {
    setParams(patch);
    setTimeout(() => document.getElementById('vr-patch-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const cols: Column<VrAsset>[] = [
    { key: 'name', header: 'Asset', sort: (a) => a.name, render: (a) => (<><div className="t-main mono">{a.name}</div><div className="muted" style={{ fontSize: 11 }}>{a.kind}</div></>) },
    { key: 'where', header: 'Tenant · site', sort: (a) => a.tenantName, render: (a) => (<><div>{a.tenantName}</div><div className="muted" style={{ fontSize: 11 }}>{a.site.replace(`${a.tenantName} · `, '')}</div></>) },
    { key: 'src', header: 'Source', sort: (a) => a.source, render: (a) => <SourceTag s={a.source} /> },
    { key: 'net', header: 'Internet', sort: (a) => Number(a.internet), render: (a) => (a.internet ? <Badge color="var(--bad)" dot>Exposed</Badge> : <span className="muted">{a.airGapped ? 'Air-gapped' : 'No'}</span>) },
    { key: 'owner', header: 'Owner', sort: (a) => a.owner, render: (a) => a.owner },
    { key: 'due', header: 'Due (SLA)', sort: (a) => (a.status === 'Unpatched' ? a.dueInMin : 1e9), render: (a) => {
      if (a.status === 'Patched' || a.status === 'Not applicable') return <span className="muted">Met · {a.slaHours} h SLA</span>;
      const d = fmtDue(a.dueInMin);
      return <><div style={{ color: d.color, fontWeight: 600 }}>{d.text}</div><div className="muted" style={{ fontSize: 11 }}>{a.slaHours} h SLA · {stamp(-a.dueInMin)}</div></>;
    } },
    { key: 'ticket', header: 'Ticket', sort: (a) => a.ticket ?? '', render: (a) => (a.ticket ? <span className="mono">{a.ticket}</span> : <span className="muted">—</span>) },
    { key: 'val', header: 'Validation', sort: (a) => a.validation, render: (a) => <ValPill v={a.validation} /> },
    { key: 'st', header: 'Status', sort: (a) => VR_STATUSES.indexOf(a.status), render: (a) => (<><StatusPill s={a.status} />{a.statusMinAgo !== null && <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{fmtAgo(a.statusMinAgo)}</div>}</>) },
  ];

  if (!rows.length) {
    return (
      <Card title="Patch tracker">
        <div className="empty">{adv.verdict === 'Investigating' ? `${adv.candidates} candidate hosts are being version-checked; nothing confirmed affected yet.` : `No affected assets in this scope for ${adv.cve}. Nothing to patch.`}</div>
      </Card>
    );
  }

  return (
    <div className="vr-stack">
      <div className="grid g-3-2" style={{ alignItems: 'stretch' }}>
        <Card>
          <div className="vr-progress">
            <button type="button" className="cc-link" onClick={() => filter({ status: 'Patched', src: null, net: null })} title={`Source: ${vrScanner(c)} rescans and HexaOT re-fingerprints · click to list patched assets`} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}>
              <Ring value={pct} size={96} stroke={9} color="var(--good)"><span style={{ fontSize: 22 }}>{pct}%</span></Ring>
            </button>
            <div>
              <h3>{tally.Patched} of {tally.total} patched <small>· {fmtDur(adv.publishedMinAgo)} since disclosure</small></h3>
              <div style={{ marginTop: 10 }}>
                <Stacked tall showLabels parts={VR_STATUSES.map((s) => ({ value: s === 'Unpatched' ? tally.Unpatched : tally[s], color: VR_STATUS_HEX[s], label: s }))} />
              </div>
              <div className="vr-progress-legend">
                {VR_STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => filter({ status: s, src: null, net: null })} title={`Source: ${VR_SOURCE_META.core.label} · HexaOT · click to filter`}>
                    <i style={{ background: VR_STATUS_HEX[s] }} />{s} <b>{tally[s]}</b>
                  </button>
                ))}
                <button type="button" onClick={() => filter({ status: 'Unpatched', net: '1', src: null })} title="Source: HexaInt external scanner · click to filter">
                  <i style={{ background: '#f2643f' }} />Internet-facing and open <b>{tally.internetOpen}</b>
                </button>
                <button type="button" onClick={() => filter({ status: 'Unpatched', src: null, net: null })} title="Source: vulnerability SLA policy · click to filter">
                  <i style={{ background: '#e0345e' }} />Past SLA <b>{tally.overdue}</b>
                </button>
              </div>
              <div className="vr-row" style={{ marginTop: 12 }}>
                <Btn sm primary color="var(--m-strike)" disabled={!open.length} onClick={() => setBulk(true)}><Crosshair size={13} /> Request validation for {open.length} open</Btn>
                <Sources items={[{ name: vrScanner(c) }, { name: itsm.name }, { name: 'HexaStrike' }]} />
              </div>
            </div>
          </div>
        </Card>
        <Card title="Burn-down since disclosure" sub={`Open, mitigated and fixed assets · ${burn.bucketMin < 60 ? `${burn.bucketMin}-minute` : burn.bucketMin < 1440 ? `${burn.bucketMin / 60}-hour` : 'daily'} steps · click to filter`}>
          <Chart
            height={200}
            onClick={(p) => { const n = (p as { seriesName?: string }).seriesName; if (n) filter({ status: n === 'Fixed' ? 'Patched' : n === 'Open' ? 'Unpatched' : n, src: null, net: null }); }}
            option={{
              legend: { data: ['Open', 'Mitigated', 'Fixed'], top: 0, right: 0 },
              grid: { left: 8, right: 14, top: 30, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: burn.labels, boundaryGap: false },
              yAxis: { type: 'value', minInterval: 1 },
              series: [
                { name: 'Fixed', type: 'line', smooth: 0.2, symbol: 'none', data: burn.resolved, lineStyle: { width: 1.5, color: VR_STATUS_HEX.Patched }, itemStyle: { color: VR_STATUS_HEX.Patched }, areaStyle: { color: 'rgba(45,212,191,0.16)' } },
                { name: 'Mitigated', type: 'line', smooth: 0.2, symbol: 'none', data: burn.mitigated, lineStyle: { width: 1.5, color: VR_STATUS_HEX.Mitigated }, itemStyle: { color: VR_STATUS_HEX.Mitigated }, areaStyle: { color: 'rgba(240,163,56,0.10)' } },
                { name: 'Open', type: 'line', smooth: 0.2, symbol: 'circle', symbolSize: 5, data: burn.open, lineStyle: { width: 2, color: VR_STATUS_HEX.Unpatched }, itemStyle: { color: VR_STATUS_HEX.Unpatched }, areaStyle: { color: 'rgba(224,52,94,0.18)' } },
              ],
            }}
          />
        </Card>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Linked HexaSOC detections" count={detections.length} sub={`Activity against affected assets since disclosure · ${vrSiem(c)}`} actions={<button className="link" onClick={() => nav('/soc/mdr')}>Open HexaSOC →</button>}>
          <div className="vr-list">
            {detections.slice(0, 7).map((d) => {
              const a = rows.find((x) => x.name === d.asset);
              return (
                <div key={d.id} className="vr-li click" onClick={() => a && openAsset(a)} title={`Source: ${d.tool} · click for the asset`}>
                  <b>{d.title}</b>
                  <SevBadge sev={d.sev} />
                  <span><span className="mono">{d.asset}</span> · {d.tool} · {d.outcome}</span>
                  <span>{fmtAgo(d.minAgo)}</span>
                </div>
              );
            })}
            {!detections.length && <div className="empty">No detections against affected assets.</div>}
          </div>
        </Card>
        <Card title="HexaStrike validation checks" count={checks.length} sub="Safe, non-exploiting checks that confirm the fix from the outside" actions={<button className="link" onClick={() => nav('/strike/asm')}>Open HexaStrike →</button>}>
          <div className="vr-list">
            {checks.slice(0, 7).map((k) => {
              const a = rows.find((x) => x.name === k.asset);
              return (
                <div key={k.id} className="vr-li click" onClick={() => a && openAsset(a)} title="Source: HexaStrike · click for the asset">
                  <b><span className="mono">{k.asset}</span> · {k.check}</b>
                  <ValPill v={k.result} />
                  <span>{k.id}</span>
                  <span>{k.minAgo !== null ? fmtAgo(k.minAgo) : 'queued'}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div id="vr-patch-table">
        <Card title="Affected assets" count={shown.length} sub="Click a row for detail, remediation steps, evidence and actions" flush>
          <div className="vr-facets">
            <FilterGroup label="Status" value={status ?? 'All'} options={VR_STATUSES} onChange={(v) => setParams({ status: v === 'All' ? null : v })} counts={Object.fromEntries(VR_STATUSES.map((s) => [s, tally[s]]))} />
            <FilterGroup label="Source" value={src ? VR_SOURCE_META[src].short : 'All'} options={['HexaCore', 'Security Tooling', 'HexaOT']} onChange={(v) => setParams({ src: v === 'All' ? null : SRC_LABEL[v] })} counts={{ HexaCore: tally.bySource.core, 'Security Tooling': tally.bySource.tooling, HexaOT: tally.bySource.ot }} />
            <FilterGroup label="Internet" value={net ? 'Exposed' : 'All'} options={['Exposed']} onChange={(v) => setParams({ net: v === 'Exposed' ? '1' : null })} counts={{ Exposed: rows.filter((a) => a.internet).length }} />
          </div>
          <DataTable rows={shown} columns={cols} onRowClick={openAsset} search={(a) => `${a.name} ${a.kind} ${a.site} ${a.owner} ${a.ticket ?? ''}`} searchPlaceholder="Filter assets…" initialSort={{ key: 'due', dir: 'asc' }} pageSize={15} rowKey={(a) => a.id} empty="No assets for this filter." />
        </Card>
      </div>

      {bulk && (
        <Confirm
          title="Request HexaStrike validation"
          sub={`${adv.cve} · ${open.length} open asset${open.length === 1 ? '' : 's'}`}
          risk="low"
          approvers={1}
          change={[
            ['Action', 'Safe, non-exploiting version and exposure checks (no payloads)'],
            ['Targets', `${open.length} assets (${open.filter((a) => a.source === 'ot').length} OT: passive re-fingerprint only, read-only by policy)`],
            ['Rescan', `${vrScanner(c)} credentialed check on IT assets`],
            ['Requested by', me],
          ]}
          confirmLabel="Request validation"
          onConfirm={() => {
            vrRequestValidation(c, adv, open.length, me);
            open.forEach((a) => vrRequestScan(c, a, me));
            toast(`Validation requested for ${open.length} assets · HexaStrike will attach results as evidence`);
          }}
          onClose={() => setBulk(false)}
        />
      )}
    </div>
  );
}
