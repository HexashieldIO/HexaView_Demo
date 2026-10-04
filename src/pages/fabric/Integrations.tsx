import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RingLegend, RecordsDrawer, scrollToId } from '../insurance/viz';
import { Plus, Play, Pause, RefreshCw, AlertTriangle, CheckCircle2, ArrowUpRight, Search } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { scopedConnectors } from '../../data/customers';
import { headlines } from '../../data/core';
import type { Connector, ConnectorCategory, Env, Health } from '../../data/types';
import {
  connName, connShort, effHealth, connectorHealth, manifestYaml, CATALOGUE, catalogueConnected, ENV_LABEL,
  type CatalogueItem, type CatalogueKind,
} from '../../data/modules/fabric';
import { Card, KpiStrip, Badge, HealthBadge, Btn, Chip, Callout, KV, HEALTH_COLOR, cap } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtAgo, fmtCompact, fmtNum } from '../../lib/format';
import { TONE, ENV_ICON, CodeBlock, sparkline, toneStyle } from './parts';
import './fabric.css';

const CAT_ORDER: ConnectorCategory[] = ['SIEM', 'EDR / XDR', 'Identity', 'PAM', 'Cloud posture', 'Vulnerability', 'OT', 'Network', 'SASE', 'Email', 'DLP', 'AppSec', 'Backup', 'ITSM', 'Asset / CMDB', 'GRC', 'Intelligence', 'Validation', 'Custody', 'Ratings', 'AI', 'HexaShield'];

export default function FabricIntegrations() {
  const { customer: c, tenantId, toast } = useApp();
  const h = headlines(c, tenantId);
  const all = useMemo(() => scopedConnectors(c, tenantId), [c, tenantId]);
  const [params] = useSearchParams();
  const envParam = params.get('env');
  const statusParam = params.get('status');
  const [envF, setEnvF] = useState<Env | 'all'>('all');
  const [statusF, setStatusF] = useState<Health | 'all' | 'stale'>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Connector | null>(null);
  const [mkt, setMkt] = useState(false);
  const [rec, setRec] = useState<null | 'records' | 'drift' | 'write'>(null);
  // Pivots from the Command Centre and other pages: /fabric/integrations?env=ot&status=degraded&q=veeam
  useEffect(() => {
    setEnvF(envParam && ['cloud', 'onprem', 'ot', 'saas'].includes(envParam) ? (envParam as Env) : 'all');
    setStatusF(statusParam && ['healthy', 'degraded', 'stale', 'paused', 'failing'].includes(statusParam) ? (statusParam as Health | 'stale') : 'all');
    if (params.get('q')) setQ(params.get('q') ?? '');
    if (envParam || statusParam || params.get('q')) scrollToId('fab-board');
    const id = params.get('connector');
    if (id) setSel(c.connectors.find((k) => k.id === id) ?? null);
  }, [envParam, statusParam, params, c]);
  const pivot = (s: Health | 'all' | 'stale', e: Env | 'all' = 'all') => { setStatusF(s); setEnvF(e); scrollToId('fab-board'); };

  const shown = all.filter((k) => {
    if (envF !== 'all' && k.env !== envF) return false;
    const eh = effHealth(k);
    if (statusF === 'stale' && eh === 'healthy') return false;
    if (statusF !== 'all' && statusF !== 'stale' && eh !== statusF) return false;
    if (q.trim() && !connName(k).toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });

  const healthy = all.filter((k) => effHealth(k) === 'healthy').length;
  const degraded = all.filter((k) => effHealth(k) === 'degraded').length;
  const failing = all.filter((k) => effHealth(k) === 'failing').length;
  const paused = all.filter((k) => k.status === 'paused').length;
  const totalDrift = all.reduce((s, k) => s + k.drift, 0);
  const totalRecords = all.reduce((s, k) => s + k.records, 0);
  const writeBack = all.filter((k) => k.write.length).length;

  const cats = CAT_ORDER.filter((cat) => shown.some((k) => k.category === cat));

  const envCounts = (['cloud', 'onprem', 'ot', 'saas'] as Env[]).map((e) => ({ e, n: all.filter((k) => k.env === e).length }));

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · {c.tier} tier. HexaCore reads {h.fabric.connectors} security tools across cloud, on-prem and OT into one canonical OCSF model, over an mTLS channel from each data plane. Credentials and raw data never leave the customer boundary; {writeBack} connectors support gated write-back.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Integrations', value: all.length, hint: tenantId === 'all' ? 'group' : 'this tenant', bar: 100, toneColor: TONE, onClick: () => pivot('all'), source: 'HexaCore connector registry' },
          { label: 'Healthy', value: healthy, unit: `/ ${all.length}`, bar: (healthy / Math.max(1, all.length)) * 100, toneColor: 'var(--good)', onClick: () => pivot('healthy'), source: 'Connector health checks (LLD 6.5)' },
          { label: 'Degraded / stale', value: degraded, delta: degraded ? { text: 'needs attention', good: false } : { text: 'all fresh', good: true }, toneColor: 'var(--sev-medium)', onClick: () => pivot('stale'), source: 'Connector health checks · last-sync vs schedule' },
          { label: 'Paused / failing', value: paused + failing, toneColor: failing ? 'var(--bad)' : 'var(--sev-info)', onClick: () => pivot('paused'), source: 'Connector health checks' },
          { label: 'Records in model', value: fmtCompact(totalRecords), hint: 'last sync', toneColor: TONE, onClick: () => setRec('records'), source: 'HexaCore canonical store (OCSF)' },
          { label: 'Schema drift', value: totalDrift, hint: 'fields', delta: totalDrift ? { text: `${all.filter((k) => k.drift).length} connectors`, good: false } : { text: 'none', good: true }, toneColor: totalDrift ? 'var(--sev-medium)' : 'var(--good)', onClick: () => setRec('drift'), source: 'Contract tests vs recorded response schemas' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title={<span id="fab-board">Connector health board</span>} sub="LLD 6.5 · grouped by category · click a tile for health, manifest and contract tests"
          actions={<><Link to="/fabric/marketplace" className="btn sm ghost">Browse the Marketplace →</Link><Btn sm primary color={TONE} onClick={() => setMkt(true)}><Plus size={14} /> Add integration</Btn></>}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
            <label className="search" style={{ flex: '0 1 220px' }}>
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tool…" aria-label="Find a tool" />
            </label>
            <span style={{ width: 1, height: 20, background: 'var(--hairline)' }} />
            <Chip on={envF === 'all'} onClick={() => setEnvF('all')} color={TONE}>All envs</Chip>
            {(['cloud', 'onprem', 'ot', 'saas'] as Env[]).map((e) => (
              <Chip key={e} on={envF === e} onClick={() => setEnvF(e)} color={TONE}>{ENV_LABEL[e]}</Chip>
            ))}
            <span style={{ width: 1, height: 20, background: 'var(--hairline)' }} />
            {(['all', 'healthy', 'degraded', 'stale', 'paused'] as const).map((s) => (
              <Chip key={s} on={statusF === s} onClick={() => setStatusF(s)} color={TONE}>{cap(s)}</Chip>
            ))}
          </div>

          {cats.length === 0 && <div className="empty">No connectors match these filters.</div>}
          {cats.map((cat) => {
            const items = shown.filter((k) => k.category === cat);
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div className="fab-cat-head"><span>{cat}</span><span className="ln" /><span>{items.length}</span></div>
                <div className="fab-cat-grid">
                  {items.map((k) => {
                    const eh = effHealth(k);
                    const Icon = ENV_ICON[k.env];
                    return (
                      <button key={k.id} className="fab-tile" onClick={() => setSel(k)} style={{ '--tone': TONE } as CSSProperties}>
                        <div className="fab-tile-top">
                          <div style={{ minWidth: 0 }}>
                            <div className="fab-tile-name">{connShort(k)}</div>
                            <div className="fab-tile-vendor">{k.vendor === 'HexaShield' || k.vendor === 'Generic' ? k.product : `${k.vendor}`}</div>
                          </div>
                          <span className="dot" style={{ background: HEALTH_COLOR[eh], boxShadow: `0 0 0 3px color-mix(in srgb, ${HEALTH_COLOR[eh]} 22%, transparent)` }} />
                        </div>
                        <div className="fab-tile-meta">
                          <span><Icon size={11} style={{ verticalAlign: -1 }} /> {ENV_LABEL[k.env]}</span>
                          <span>{fmtCompact(k.records)} rec</span>
                          {k.drift > 0 && <span style={{ color: 'var(--sev-medium)' }}>{k.drift} drift</span>}
                          <span>v{k.version}</span>
                        </div>
                        <div className="fab-tile-foot">
                          <span className="fab-tile-caps">
                            <span className="fab-cap read">READ</span>
                            {k.env === 'ot' ? <span className="fab-cap ro">READ-ONLY</span> : k.write.length ? <span className="fab-cap gated">WRITE · GATED</span> : <span className="fab-cap ro">NO WRITE</span>}
                          </span>
                          <span style={{ color: eh === 'healthy' ? undefined : 'var(--warn)' }}>{eh === 'paused' ? 'paused' : fmtAgo(k.lastSyncMin)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Card>

        <div className="stack">
          <Card title="Estate at a glance" sub="How your tools split across environments">
            <div className="fab-kvgrid">
              {envCounts.map(({ e, n }) => {
                const Icon = ENV_ICON[e];
                return (
                  <button key={e} className="fab-kv-btn" onClick={() => pivot('all', e)} title={`Source: HexaCore connector registry · click to filter ${e}`}>
                    <b>{n}</b>
                    <span><Icon size={11} style={{ verticalAlign: -1 }} /> {ENV_LABEL[e]}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 14 }}>
              <RingLegend
                value={healthy}
                max={Math.max(1, all.length)}
                color="var(--good)"
                center={`${Math.round((healthy / Math.max(1, all.length)) * 100)}%`}
                centerSub="healthy"
                size={108}
                rows={[
                  { label: 'Healthy', value: healthy, color: HEALTH_COLOR.healthy, onClick: () => pivot('healthy') },
                  { label: 'Degraded / stale', value: degraded, color: HEALTH_COLOR.degraded, onClick: () => pivot('stale') },
                  { label: 'Failing', value: failing, color: HEALTH_COLOR.failing, onClick: () => pivot('failing') },
                  { label: 'Paused', value: paused, color: HEALTH_COLOR.paused, onClick: () => pivot('paused') },
                ]}
              />
            </div>
          </Card>

          <Card title="Needs attention" sub="Connectors degraded, stale or paused">
            <div className="list">
              {all.filter((k) => effHealth(k) !== 'healthy').map((k) => (
                <button key={k.id} className="list-row" onClick={() => setSel(k)}>
                  <AlertTriangle size={15} style={{ color: effHealth(k) === 'failing' ? 'var(--bad)' : effHealth(k) === 'paused' ? 'var(--sev-info)' : 'var(--sev-medium)' }} />
                  <span className="list-main">
                    <b>{connShort(k)}</b>
                    <span>{k.note ?? `Last sync ${fmtAgo(k.lastSyncMin)} (schedule ${k.intervalMin} min)`}</span>
                  </span>
                  <HealthBadge status={effHealth(k)} />
                </button>
              ))}
              {all.every((k) => effHealth(k) === 'healthy') && <div className="empty"><CheckCircle2 size={16} /> Every connector is healthy and fresh.</div>}
            </div>
          </Card>
        </div>
      </div>

      {rec === 'records' && (
        <RecordsDrawer title="Records in the canonical model" sub={`${fmtCompact(totalRecords)} records from ${all.length} connectors`} source="HexaCore canonical store (OCSF 1.3)" onClose={() => setRec(null)}
          rows={all.slice().sort((a, b) => b.records - a.records).map((k) => ({ key: k.id, title: connName(k), sub: `${k.category} · ${k.env === 'onprem' ? 'on-prem' : k.env} · synced ${fmtAgo(k.lastSyncMin)}`, right: fmtCompact(k.records), badge: <HealthBadge status={effHealth(k)} />, onClick: () => { setRec(null); setSel(k); } }))} />
      )}
      {rec === 'drift' && (
        <RecordsDrawer title="Schema drift" sub="Fields that differ from the recorded vendor response schemas" source="Nightly contract tests (sandbox + live)" onClose={() => setRec(null)}
          rows={all.filter((k) => k.drift > 0).map((k) => ({ key: k.id, title: connName(k), sub: k.note ?? `${k.drift} fields drifted`, right: `${k.drift} fields`, badge: <HealthBadge status={effHealth(k)} />, onClick: () => { setRec(null); setSel(k); } }))} />
      )}
      {sel && <ConnectorDrawer k={sel} onClose={() => setSel(null)} onToast={toast} />}
      {mkt && <Marketplace onClose={() => setMkt(false)} onToast={toast} />}
    </div>
  );
}

function ConnectorDrawer({ k, onClose, onToast }: { k: Connector; onClose: () => void; onToast: (s: string) => void }) {
  const { customer: c } = useApp();
  const hc = useMemo(() => connectorHealth(c, k), [c, k]);
  const yaml = useMemo(() => manifestYaml(c, k), [c, k]);
  const isOt = k.env === 'ot';
  const action = (verb: string) => onToast(`${verb} ${connName(k)} — intent signed and sent to the data plane`);
  return (
    <Drawer
      wide
      onClose={onClose}
      icon={<span className="dot" style={{ background: HEALTH_COLOR[hc.health], width: 12, height: 12, marginTop: 6 }} />}
      title={connName(k)}
      sub={`${k.category} · ${ENV_LABEL[k.env]} · data plane ${k.dataPlaneId}`}
      footer={
        isOt ? <Badge color="var(--m-ot)">OT target · read-only by policy, no actions</Badge> : (
          <>
            <Btn onClick={() => action(k.status === 'paused' ? 'Resumed' : 'Paused')}>{k.status === 'paused' ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</Btn>
            <Btn primary color={TONE} onClick={() => action('Triggered a sync for')}><RefreshCw size={14} /> Sync now</Btn>
          </>
        )
      }
    >
      <div className="fab-kvgrid">
        <div><b style={{ color: HEALTH_COLOR[hc.health] }}>{cap(hc.health)}</b><span>Status</span></div>
        <div><b>{fmtAgo(hc.lastSuccessMin)}</b><span>Last success</span></div>
        <div><b>{fmtNum(hc.recordsLastSync)}</b><span>Records last sync</span></div>
        <div><b style={{ color: hc.errorRate1h > 2 ? 'var(--sev-medium)' : undefined }}>{hc.errorRate1h}%</b><span>Error rate (1 h)</span></div>
        <div><b style={{ color: hc.rateLimited1h > 10 ? 'var(--sev-medium)' : undefined }}>{hc.rateLimited1h}</b><span>Rate limited (1 h)</span></div>
        <div><b style={{ color: hc.authExpiresDays !== null && hc.authExpiresDays < 14 ? 'var(--sev-high)' : undefined }}>{hc.authExpiresDays === null ? 'n/a' : `${hc.authExpiresDays} d`}</b><span>Auth expires</span></div>
      </div>

      {hc.stale && <Callout kind="warn"><b>Stale.</b> Last sync {fmtAgo(k.lastSyncMin)} exceeds twice the {k.intervalMin}-minute schedule interval. {k.note ?? ''}</Callout>}
      {k.status === 'paused' && <Callout kind="warn"><b>Paused by admin.</b> {k.note ?? 'No data is flowing from this connector.'}</Callout>}

      <div>
        <div className="section-label">Records per sync, last 24 h</div>
        <Chart height={70} option={sparkline(hc.spark, HEALTH_COLOR[hc.health])} />
      </div>

      <div>
        <div className="section-label">Drift (vs recorded response schemas)</div>
        <div className="fab-kvgrid">
          <div><b style={{ color: hc.drift.unknown ? 'var(--sev-low)' : undefined }}>{hc.drift.unknown}</b><span>Unknown fields</span></div>
          <div><b style={{ color: hc.drift.missing ? 'var(--sev-high)' : undefined }}>{hc.drift.missing}</b><span>Missing required</span></div>
          <div><b style={{ color: hc.drift.typeMismatch ? 'var(--sev-medium)' : undefined }}>{hc.drift.typeMismatch}</b><span>Type mismatches</span></div>
        </div>
      </div>

      <KV rows={[
        ['Read scopes', <span className="chips">{k.read.map((x) => <Chip key={x}>{x}</Chip>)}</span>],
        ['Write-back', k.write.length ? <span className="chips">{k.write.map((x) => <Badge key={x} color="var(--sev-medium)">{x} · gated</Badge>)}</span> : <span className="muted">None — read-only</span>],
        ['Auth', <span className="mono">{hc.authType}</span>],
        ['Secret', <span className="mono">{hc.secretRef}</span>],
        ['Manifest / runtime', `${hc.manifestVersion} · ${hc.runtimeVersion}`],
        ['OCSF classes', <span className="chips">{hc.ocsf.map((x) => <Chip key={x}>{x}</Chip>)}</span>],
      ]} />

      <CodeBlock label="Connector manifest (excerpt)" text={yaml} />

      <div>
        <div className="section-label">Contract tests (nightly sandbox + live)</div>
        <div className="list">
          {hc.contract.map((t) => (
            <div key={t.name} className="list-row">
              {t.pass ? <CheckCircle2 size={15} style={{ color: 'var(--good)' }} /> : <AlertTriangle size={15} style={{ color: 'var(--sev-high)' }} />}
              <span className="list-main"><b>{t.name}</b><span>{t.detail}</span></span>
              <Badge color={t.pass ? 'var(--good)' : 'var(--sev-high)'}>{t.pass ? 'Pass' : 'Fail'}</Badge>
            </div>
          ))}
        </div>
      </div>

      {hc.lastError && (
        <div>
          <div className="section-label">Last error (redacted — no payloads, no secrets)</div>
          <CodeBlock text={hc.lastError} />
        </div>
      )}
    </Drawer>
  );
}

const KIND_COLOR: Record<CatalogueKind, string> = { 'Standards-native': 'var(--m-core)', 'First-party': 'var(--m-matrix)', 'Community / partner': 'var(--m-ai)' };

function Marketplace({ onClose, onToast }: { onClose: () => void; onToast: (s: string) => void }) {
  const { customer: c } = useApp();
  const [kind, setKind] = useState<CatalogueKind | 'all'>('all');
  const [q, setQ] = useState('');
  const active = c.connectors.filter((k) => k.status !== 'paused').length;
  const limit = c.integrationLimit;
  const items = CATALOGUE.filter((it) => (kind === 'all' || it.kind === kind) && (!q.trim() || it.name.toLowerCase().includes(q.trim().toLowerCase())));
  const add = (it: CatalogueItem) => {
    if (limit !== null && active >= limit) { onToast(`Entitlement reached (${active}/${limit}). Upgrade to Enterprise to add ${it.name}.`); return; }
    onToast(`${it.name} staged for onboarding — a manifest and sandbox contract test will run before first sync.`);
  };
  return (
    <Modal
      title="Connector marketplace"
      sub="Standards-native, first-party and community connectors. Credentials stay on your data plane."
      onClose={onClose}
      footer={<Btn primary color={TONE} onClick={onClose}>Done</Btn>}
    >
      {limit !== null && (
        <Callout kind={active >= limit ? 'warn' : 'info'}>
          <b>Entitlement usage: {active} of {limit} integrations.</b> {c.tier} tier. {active >= limit - 2 ? 'You are near your limit — Enterprise / CNI lifts the cap and unlocks dedicated-stamp connectors and OT write-paths.' : 'Add more within your plan, or upgrade for an unlimited estate.'}
          <div style={{ marginTop: 8 }}><div className="bar"><i style={{ width: `${Math.min(100, (active / limit) * 100)}%`, background: active >= limit ? 'var(--bad)' : 'var(--sev-medium)' }} /></div></div>
        </Callout>
      )}
      {limit === null && <Callout kind="good"><b>Unlimited integrations.</b> {c.tier} tier — {active} connected across cloud, on-prem and OT.</Callout>}

      <div className="row wrap" style={{ gap: 8 }}>
        <label className="search" style={{ flex: '0 1 200px' }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalogue…" /></label>
        {(['all', 'Standards-native', 'First-party', 'Community / partner'] as const).map((kk) => (
          <Chip key={kk} on={kind === kk} onClick={() => setKind(kk)} color={TONE}>{kk === 'all' ? 'All' : kk}</Chip>
        ))}
      </div>

      <div className="fab-mkt">
        {items.map((it) => {
          const on = catalogueConnected(c, it);
          return (
            <div key={it.id} className={`fab-mkt-item ${on ? 'on' : ''}`}>
              <div className="row between">
                <span className="fab-mkt-name">{it.name}</span>
                <Badge color={KIND_COLOR[it.kind]}>{it.kind.split(' ')[0]}</Badge>
              </div>
              <div className="muted" style={{ fontSize: 10.5 }}>{it.category} · {it.envs}</div>
              <div className="fab-mkt-blurb">{it.blurb}</div>
              <div className="row between" style={{ marginTop: 2 }}>
                {it.writeBack ? <Badge color="var(--sev-medium)">Write-back (gated)</Badge> : <Badge>Read-only</Badge>}
                {on ? <Badge color="var(--good)" dot>Connected</Badge> : <Btn sm color={TONE} onClick={() => add(it)}><ArrowUpRight size={13} /> Add</Btn>}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
