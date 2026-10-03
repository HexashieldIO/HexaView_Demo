import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarList, RingLegend, RecordsDrawer, scrollToId } from '../insurance/viz';
import { scopedConnectors } from '../../data/customers';
import { connShort, effHealth } from '../../data/modules/fabric';
import { Boxes, GitMerge, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { Env } from '../../data/types';
import {
  assetSummary, assetEntities, mergeSuggestions, GAP_LABEL, ENV_LABEL, ENV_HEX,
  type AssetEntity, type GapKey, type MergeSuggestion,
} from '../../data/modules/fabric';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Bar, Chip } from '../../components/ui';
import { SEV_HEX } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtCompact, fmtNum, fmtPct } from '../../lib/format';
import { TONE, EnvBadge, EnvDot, toneStyle } from './parts';
import './fabric.css';

export default function FabricAssets() {
  const { customer: c, tenantId, toast } = useApp();
  const sum = useMemo(() => assetSummary(c, tenantId), [c, tenantId]);
  const entities = useMemo(() => assetEntities(c, tenantId), [c, tenantId]);
  const [merges, setMerges] = useState<MergeSuggestion[]>(() => mergeSuggestions(c, tenantId));
  useMemo(() => setMerges(mergeSuggestions(c, tenantId)), [c, tenantId]);
  const [sel, setSel] = useState<AssetEntity | null>(null);
  const [params] = useSearchParams();
  const [envF, setEnvF] = useState<Env | 'all'>('all');
  const [gapF, setGapF] = useState<GapKey | 'all'>('all');
  const [srcF, setSrcF] = useState<number | null>(null);
  const [rec, setRec] = useState<null | 'raw' | 'merges'>(null);
  useEffect(() => {
    const e = params.get('env');
    const g = params.get('gap');
    setEnvF(e && ['cloud', 'onprem', 'ot', 'saas'].includes(e) ? (e as Env) : 'all');
    setGapF(g && ['edr', 'scan', 'cmdb', 'owner'].includes(g) ? (g as GapKey) : 'all');
    if (e || g) scrollToId('fab-inventory');
  }, [params]);
  const show = (e: Env | 'all', g: GapKey | 'all' = 'all', s: number | null = null) => { setEnvF(e); setGapF(g); setSrcF(s); scrollToId('fab-inventory'); };
  const conns = useMemo(() => scopedConnectors(c, tenantId), [c, tenantId]);
  const resolvers = conns.filter((k) => ['EDR / XDR', 'Vulnerability', 'ITSM', 'Asset / CMDB', 'Cloud posture', 'OT', 'Identity'].includes(k.category));
  const resolverSrc = resolvers.slice(0, 5).map(connShort).join(' · ');

  const rows = entities.filter((e) => (envF === 'all' || e.env === envF) && (gapF === 'all' || e.gaps.includes(gapF)) && (srcF === null || (srcF >= 4 ? e.obs.length >= 4 : e.obs.length === srcF)));
  const gapKeys: GapKey[] = ['edr', 'scan', 'cmdb', 'owner'];

  const typeTop = [...sum.byType].sort((a, b) => b.count - a.count).slice(0, 12);

  const approve = (m: MergeSuggestion) => {
    setMerges((ms) => ms.filter((x) => x.id !== m.id));
    toast(`Merged ${m.a.name} and ${m.b.name} into one entity — override recorded in the audit ledger`);
  };

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · one canonical inventory built by entity resolution (LLD 4.5–4.6). {fmtCompact(sum.rawObservations)} raw observations from your tools collapse into <b>{fmtNum(sum.total)}</b> entities by matching cloud resource IDs, serials, MACs, EDR agent IDs and FQDNs — {fmtPct(sum.autoMergedPct, 1)} resolved automatically.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Unified assets', value: fmtCompact(sum.total), hint: 'entities', toneColor: TONE, onClick: () => show('all'), source: `Entity resolution over ${resolverSrc}` },
          { label: 'Raw observations', value: fmtCompact(sum.rawObservations), hint: `${(sum.rawObservations / Math.max(1, sum.total)).toFixed(1)}× per entity`, toneColor: 'var(--m-matrix)', onClick: () => setRec('raw'), source: resolverSrc },
          { label: 'Auto-resolved', value: fmtPct(sum.autoMergedPct, 1), bar: sum.autoMergedPct, toneColor: 'var(--good)', onClick: () => show('all'), source: 'HexaCore resolver (strong keys: serial, MAC, agent ID, cloud ID)' },
          { label: 'Merge queue', value: merges.length, hint: 'need review', toneColor: merges.length ? 'var(--sev-medium)' : 'var(--good)', onClick: () => setRec('merges'), source: 'HexaCore resolver (weak-key matches)' },
          { label: 'Coverage gaps', value: fmtNum(sum.gaps.edr + sum.gaps.scan), hint: 'no EDR / unscanned', toneColor: 'var(--sev-high)', onClick: () => show('all', 'edr'), source: `${conns.filter((k) => k.category === 'EDR / XDR' || k.category === 'Vulnerability').map(connShort).join(' · ')}` },
          { label: 'Unknown owner', value: fmtNum(sum.gaps.owner), toneColor: 'var(--sev-medium)', onClick: () => show('all', 'owner'), source: `${conns.filter((k) => k.category === 'ITSM' || k.category === 'Asset / CMDB').map(connShort).join(' · ') || 'CMDB'}` },
        ]}
      />

      <div className="grid g3">
        <Card title="By environment" sub="Where your assets live">
          <RingLegend
            value={sum.byEnv.ot + sum.byEnv.onprem}
            max={Math.max(1, sum.total)}
            color={ENV_HEX.onprem}
            center={fmtCompact(sum.total)}
            centerSub="assets"
            size={112}
            rows={(['onprem', 'cloud', 'ot', 'saas'] as Env[]).filter((e) => sum.byEnv[e]).map((e) => ({ label: ENV_LABEL[e], value: fmtNum(sum.byEnv[e]), color: ENV_HEX[e], onClick: () => show(e) }))}
          />
        </Card>

        <Card title="By type" sub="Top asset types across the estate">
          <BarList
            labelWidth={150}
            items={typeTop.slice(0, 8).map((t) => ({ label: t.type, sub: ENV_LABEL[t.env], value: t.count, display: fmtNum(t.count), color: ENV_HEX[t.env], onClick: () => show(t.env) }))}
          />
        </Card>

        <Card title="Sources per asset" sub="How many tools see each entity — more sources, higher confidence">
          <BarList
            labelWidth={90}
            items={sum.overlap.map((o, i) => ({ label: o.label, sub: i === 0 ? 'low confidence' : i === 3 ? 'high confidence' : undefined, value: o.count, display: fmtNum(o.count), color: [SEV_HEX.high, SEV_HEX.medium, '#4f8cff', '#2dd4bf'][i], onClick: () => show('all', 'all', i + 1) }))}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{fmtNum(sum.overlap[0].count)} assets seen by a single tool are the resolution and coverage risk.</div>
        </Card>
      </div>

      <Card title="Coverage gaps" sub="Entities missing a control that should be there (degrade honestly — never shown as zero risk)">
        <div className="grid g4">
          {gapKeys.map((g) => (
            <Card key={g} tinted toneColor={g === 'edr' || g === 'scan' ? 'var(--sev-high)' : 'var(--sev-medium)'}>
              <div className="row" style={{ gap: 8 }}><AlertTriangle size={15} style={{ color: g === 'edr' || g === 'scan' ? 'var(--sev-high)' : 'var(--sev-medium)' }} /><b>{GAP_LABEL[g]}</b></div>
              <button className="cc-link stat-big" style={{ marginTop: 6 }} onClick={() => show('all', g)} title={`Source: ${resolverSrc} · click to list these assets`}>{fmtNum(sum.gaps[g])}</button>
              <div className="stat-label">{fmtPct((sum.gaps[g] / Math.max(1, sum.total)) * 100, 1)} of the estate</div>
              <div style={{ marginTop: 8 }}><Bar value={sum.gaps[g]} max={sum.total} color={g === 'edr' || g === 'scan' ? 'var(--sev-high)' : 'var(--sev-medium)'} size="thin" /></div>
              <button className="link" style={{ marginTop: 8, display: 'block' }} onClick={() => show('all', g)}>Show these assets →</button>
            </Card>
          ))}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title={<span id="fab-inventory">Unified asset inventory</span>} count={rows.length} sub="One row per entity · click for the merged source observations" flush>
          <div className="row wrap" style={{ gap: 8, padding: '0 18px 2px' }}>
            <Chip on={envF === 'all'} onClick={() => setEnvF('all')} color={TONE}>All envs</Chip>
            {(['onprem', 'cloud', 'ot', 'saas'] as Env[]).filter((e) => sum.byEnv[e]).map((e) => <Chip key={e} on={envF === e} onClick={() => setEnvF(e)} color={TONE}>{ENV_LABEL[e]}</Chip>)}
            <span style={{ width: 1, height: 18, background: 'var(--hairline)' }} />
            {srcF !== null && <Chip on onClick={() => setSrcF(null)} color={TONE}>{srcF >= 4 ? '4+' : srcF} source{srcF === 1 ? '' : 's'} ×</Chip>}
            <Chip on={gapF === 'all'} onClick={() => setGapF('all')} color={TONE}>Any gap</Chip>
            {gapKeys.map((g) => <Chip key={g} on={gapF === g} onClick={() => setGapF(g)} color={TONE}>{GAP_LABEL[g]}</Chip>)}
          </div>
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            onRowClick={(e) => setSel(e)}
            search={(e) => `${e.name} ${e.type} ${e.owner ?? ''} ${e.tenantShort} ${e.crownJewel ?? ''}`}
            searchPlaceholder="Search assets by name, type, owner…"
            initialSort={{ key: 'risk', dir: 'desc' }}
            columns={[
              { key: 'name', header: 'Asset', sort: (e) => e.name, render: (e) => (<><div className="t-main"><EnvDot env={e.env} />{e.name}{e.crownJewel && <Badge color="var(--m-custody)">Crown jewel</Badge>}</div><div className="t-sub">{e.type} · {e.os}</div></>) },
              { key: 'tenant', header: 'Tenant', sort: (e) => e.tenantShort, render: (e) => <span className="t-sub">{e.tenantShort}</span> },
              { key: 'src', header: 'Sources', align: 'right', sort: (e) => e.obs.length, render: (e) => <Badge color={e.obs.length >= 3 ? 'var(--good)' : e.obs.length === 1 ? 'var(--sev-high)' : 'var(--sev-medium)'}>{e.obs.length}</Badge> },
              { key: 'crit', header: 'Criticality', sort: (e) => e.criticality, render: (e) => <span title="Business criticality">{'◆'.repeat(e.criticality)}<span style={{ opacity: 0.2 }}>{'◆'.repeat(5 - e.criticality)}</span></span> },
              { key: 'gaps', header: 'Gaps', render: (e) => e.gaps.length ? <span className="chips">{e.gaps.map((g) => <Badge key={g} color="var(--sev-medium)">{GAP_LABEL[g]}</Badge>)}</span> : <span className="muted">—</span> },
              { key: 'risk', header: 'Risk', align: 'right', sort: (e) => e.risk, render: (e) => <span className="num" style={{ fontWeight: 700, color: e.risk >= 60 ? 'var(--bad)' : e.risk >= 30 ? 'var(--warn)' : 'var(--good)' }}>{e.risk}</span> },
            ]}
          />
        </Card>

        <Card title={<><GitMerge size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> Merge suggestions</>} count={merges.length} sub="Weak-only matches the resolver sent for review (LLD 4.6)">
          <div className="stack">
            {merges.map((m) => (
              <div key={m.id} className="fab-path" style={{ cursor: 'default' }}>
                <div className="row between">
                  <b style={{ fontSize: 12.5 }}>{m.confidence >= 0.9 ? 'Likely same entity' : m.confidence >= 0.7 ? 'Possible match' : 'Low confidence'}</b>
                  <Badge color={m.confidence >= 0.9 ? 'var(--good)' : m.confidence >= 0.7 ? 'var(--sev-medium)' : 'var(--bad)'}>{fmtPct(m.confidence * 100)}</Badge>
                </div>
                <div style={{ fontSize: 11.5, margin: '6px 0' }}>
                  <div><b>{m.a.name}</b> <span className="muted">· {m.a.source} ({m.a.key})</span></div>
                  <div><b>{m.b.name}</b> <span className="muted">· {m.b.source} ({m.b.key})</span></div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{m.shared}</div>
                <div className="muted" style={{ fontSize: 10.5, marginTop: 2, fontStyle: 'italic' }}>{m.reason}</div>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  {m.confidence >= 0.7 ? <Btn sm primary color={TONE} onClick={() => approve(m)}>Approve merge</Btn> : <Btn sm onClick={() => approve(m)}>Keep separate</Btn>}
                  <Btn sm ghost onClick={() => setMerges((ms) => ms.filter((x) => x.id !== m.id))}>Dismiss</Btn>
                </div>
              </div>
            ))}
            {merges.length === 0 && <div className="empty"><CheckCircle2 size={16} /> Merge queue is clear.</div>}
          </div>
        </Card>
      </div>

      {rec === 'raw' && (
        <RecordsDrawer title="Raw observations by source" sub={`${fmtCompact(sum.rawObservations)} observations resolve to ${fmtNum(sum.total)} entities`} sources={resolvers.map((k) => ({ name: connShort(k), status: effHealth(k) }))} onClose={() => setRec(null)}
          rows={resolvers.map((k) => ({ key: k.id, title: connShort(k), sub: `${k.category} · match keys: ${k.category === 'OT' ? 'MAC, serial' : k.category === 'Cloud posture' ? 'cloud resource ID' : k.category === 'EDR / XDR' ? 'agent ID, hostname' : k.category === 'Identity' ? 'device object ID' : 'serial, FQDN'}`, right: fmtCompact(k.records) }))} />
      )}
      {rec === 'merges' && (
        <RecordsDrawer title="Merge queue" sub="Weak-only matches waiting for a human decision (LLD 4.6)" source="HexaCore resolver" onClose={() => setRec(null)}
          rows={merges.map((m) => ({ key: m.id, title: `${m.a.name} ↔ ${m.b.name}`, sub: `${m.a.source} (${m.a.key}) · ${m.b.source} (${m.b.key}) · ${m.shared}`, right: fmtPct(m.confidence * 100) }))} />
      )}
      {sel && (
        <Drawer wide onClose={() => setSel(null)} title={sel.name} sub={`${sel.type} · ${sel.tenantShort}`} icon={<span className="ico-box" style={{ '--tone': ENV_HEX[sel.env] } as React.CSSProperties}><Boxes /></span>}>
          <div className="fab-kvgrid">
            <div><b>{sel.obs.length}</b><span>Sources merged</span></div>
            <div><b>{'◆'.repeat(sel.criticality)}</b><span>Criticality</span></div>
            <div><b style={{ color: sel.risk >= 60 ? 'var(--bad)' : undefined }}>{sel.risk}</b><span>Risk</span></div>
            <div><b style={{ fontSize: 13 }}>{sel.owner ?? 'Unknown'}</b><span>Owner</span></div>
          </div>
          {sel.crownJewel && <Callout kind="warn"><b>Crown jewel.</b> Linked to {sel.crownJewel}.</Callout>}
          {sel.gaps.length > 0 && <Callout kind="warn"><b>Coverage gaps:</b> {sel.gaps.map((g) => GAP_LABEL[g]).join(', ')}.</Callout>}
          <KV rows={[
            ['Environment', <EnvBadge env={sel.env} />],
            ['Zone', sel.zone],
            ['OS / firmware', sel.os],
            ['IP', <span className="mono">{sel.ip}</span>],
            ['Findings', <span className="chips">{sel.findings.critical > 0 && <Badge color="var(--sev-critical)" solid>{sel.findings.critical} critical</Badge>}<Badge color="var(--sev-high)">{sel.findings.high} high</Badge><Badge color="var(--sev-medium)">{sel.findings.medium} med</Badge><Badge color="var(--sev-low)">{sel.findings.low} low</Badge></span>],
          ]} />
          <div>
            <div className="section-label">Per-source observations merged into this entity</div>
            <div className="list">
              {sel.obs.map((o, i) => (
                <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <span className="dot" style={{ background: o.status === 'healthy' ? 'var(--good)' : 'var(--sev-medium)', marginTop: 4 }} />
                  <span className="list-main">
                    <b>{o.source} <span className="muted" style={{ fontWeight: 400 }}>· {o.category}</span></b>
                    <span>match key: <b>{o.key}</b> = <span className="mono">{o.value.length > 48 ? `${o.value.slice(0, 48)}…` : o.value}</span></span>
                    <span className="chips" style={{ marginTop: 4 }}>{o.fields.map(([k, v]) => <Chip key={k}>{k}: {v}</Chip>)}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 10.5 }}>{fmtAgo(o.lastSeenMin)}</span>
                </div>
              ))}
              {sel.obs.length === 0 && <div className="empty"><Layers size={16} /> Seen by one source only — resolution confidence is low.</div>}
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Btn sm color={TONE} onClick={() => toast(`Opened resolution history for ${sel.name}`)}>Resolution history</Btn>
            {sel.gaps.includes('owner') && <Btn sm onClick={() => toast(`Owner request sent for ${sel.name}`)}>Request owner</Btn>}
          </div>
        </Drawer>
      )}
    </div>
  );
}
