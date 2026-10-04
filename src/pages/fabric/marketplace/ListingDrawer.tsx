import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Lock, ShieldCheck, ShieldOff, Download, Sparkles, Server, Database, Boxes, KeyRound } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import {
  frameworkHits, reviewsFor, ratingSpread, setupSteps, POWER_COLOR, POWER_PATH, RISK_COLOR,
  type Gap, type Listing,
} from '../../../data/modules/marketplace';
import { ENV_LABEL, connName, effHealth } from '../../../data/modules/fabric';
import type { DataPlane } from '../../../data/types';
import { Badge, Btn, Callout, Chip, HealthBadge, KV, Tabs, Timeline, HEALTH_COLOR, cap } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { FlowMap, type FlowColumn, type FlowLink } from '../../../components/FlowMap';
import { fmtNum } from '../../../lib/format';
import { TONE } from '../parts';
import { CertBadge, Monogram, Stars, EnvTags, fmtSetup } from './parts';

type Tab = 'overview' | 'flow' | 'perms' | 'write' | 'setup' | 'residency' | 'reviews';

/** Best data plane for a listing: OT edges for OT tools, the main cloud plane otherwise. */
export function defaultPlane(planes: DataPlane[], l: Listing): DataPlane | undefined {
  const ot = l.envs.includes('ot') && !l.envs.some((e) => e === 'cloud' || e === 'saas');
  const pick = ot
    ? planes.find((p) => /ot|edge|air|vessel|plant/i.test(`${p.name} ${p.placement}`))
    : planes.find((p) => /Azure|AWS|GCP|HexaShield/.test(p.placement));
  return pick ?? planes[0];
}

export function ListingDrawer({ l, installed, session, matchedIds, gaps, onClose, onInstall }: {
  l: Listing;
  installed: boolean;
  session: boolean;
  matchedIds: string[];
  gaps: Gap[];
  onClose: () => void;
  onInstall: (planeId: string) => void;
}) {
  const { customer: c } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [plane, setPlane] = useState(() => defaultPlane(c.dataPlanes, l)?.id ?? '');
  const ot = l.envs.includes('ot') && l.envs.length === 1;
  const hits = frameworkHits(c, l);
  const conns = c.connectors.filter((k) => matchedIds.includes(k.id));
  const reviews = useMemo(() => reviewsFor(l), [l]);
  const spread = useMemo(() => ratingSpread(l), [l]);

  const flow = useMemo(() => {
    const src = l.read.slice(0, 5).map((x, i) => ({ id: `r${i}`, title: x, sub: l.vendor === 'Generic' ? 'source' : l.vendor }));
    const mid = [
      { id: 'core', title: 'HexaCore', count: l.ocsf.length, sub: 'OCSF classes', icon: <Boxes size={13} />, color: 'var(--m-core)' },
      { id: 'graph', title: 'Entity graph', sub: 'asset & owner joins', icon: <Database size={13} />, color: 'var(--m-core)' },
    ];
    const out = l.powers.map((p) => ({ id: p, title: p, sub: 'module', color: POWER_COLOR[p], onClick: () => nav(POWER_PATH[p]) }));
    const cols: FlowColumn[] = [
      { label: l.name.length > 26 ? l.vendor : l.name, nodes: src },
      { label: 'HexaCore (your data plane)', nodes: mid },
      { label: 'HexaShield modules', nodes: out },
    ];
    const links: FlowLink[] = [
      ...src.map((s, i) => ({ from: s.id, to: i % 3 === 2 ? 'graph' : 'core', value: 5 - Math.min(4, i) })),
      ...out.map((o, i) => ({ from: i % 2 ? 'graph' : 'core', to: o.id, value: 3 })),
    ];
    return { cols, links };
  }, [l, nav]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'flow', label: 'Data flow' },
    { id: 'perms', label: 'Permissions' },
    { id: 'write', label: `Write-back${l.write.length ? ` (${l.write.length})` : ''}` },
    { id: 'setup', label: 'Setup' },
    { id: 'residency', label: 'Data residency' },
    ...(l.custom ? [] : [{ id: 'reviews' as Tab, label: 'Reviews' }]),
  ];

  return (
    <Drawer
      wide
      onClose={onClose}
      icon={<Monogram l={l} size={44} />}
      title={l.name}
      sub={<span className="row wrap" style={{ gap: 6 }}>{l.category} · {l.methods.join(' / ')} · v{l.version}<CertBadge cert={l.cert} /></span>}
      footer={
        installed ? (
          <div className="mkt-foot">
            <span style={{ marginRight: 'auto' }}><Badge color="var(--good)" dot>{session ? 'Connected this session' : `Installed · ${conns.length || 1} instance${conns.length > 1 ? 's' : ''}`}</Badge></span>
            <Btn onClick={() => nav(conns[0] ? `/fabric/integrations?connector=${conns[0].id}` : '/fabric/integrations')}>Open in Integrations <ArrowUpRight size={13} /></Btn>
            {!l.custom && <Btn primary color={TONE} onClick={() => onInstall(plane)}>Add another instance</Btn>}
          </div>
        ) : (
          <div className="mkt-foot">
            <span className="muted" style={{ fontSize: 11.5, marginRight: 'auto' }}>Setup ≈ {fmtSetup(l.setupMin)} · runs on {c.dataPlanes.find((p) => p.id === plane)?.name ?? 'your data plane'}</span>
            <Btn primary color={TONE} onClick={() => onInstall(plane)}><Download size={14} /> Install</Btn>
          </div>
        )
      }
    >
      {gaps.length > 0 && !installed && (
        <Callout kind="info" color="var(--m-core)">
          <b><Sparkles size={13} style={{ verticalAlign: -2 }} /> Recommended for {c.short}.</b> Closes {gaps.length === 1 ? 'the gap' : `${gaps.length} gaps`}: {gaps.map((g) => g.title).join('; ')}.
          Impact ≈ <b>{gaps.reduce((s, g) => s + g.loops, 0)} loops</b> able to close and <b>+{gaps.reduce((s, g) => s + g.completeness, 0)} pts</b> data completeness.
        </Callout>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} color={TONE} />

      {tab === 'overview' && (
        <>
          <p className="mkt-lede">{l.blurb}</p>
          <div className="fab-kvgrid">
            <div><b>{l.custom ? '—' : l.rating.toFixed(1)}</b><span>{l.custom ? 'Private listing' : `${l.reviews} reviews`}</span></div>
            <div><b>{l.custom ? 1 : fmtNum(l.installs)}</b><span>Organisations</span></div>
            <div><b>{fmtSetup(l.setupMin)}</b><span>Median setup</span></div>
            <div><b>{l.write.length || '—'}</b><span>Write-back actions</span></div>
          </div>
          <KV rows={[
            ['Environments', <EnvTags l={l} />],
            ['Connection', <span className="chips">{l.methods.map((m) => <Chip key={m}>{m}</Chip>)}</span>],
            ['Data read', <span className="chips">{l.read.map((x) => <Chip key={x}>{x}</Chip>)}</span>],
            ['Powers', <span className="chips">{l.powers.map((p) => <button key={p} className="mkt-power" style={{ ['--c' as string]: POWER_COLOR[p] }} onClick={() => nav(POWER_PATH[p])}>{p}</button>)}</span>],
            ['Evidences', <span className="chips">{l.frameworks.map((f) => <Badge key={f} color={hits.includes(f) ? 'var(--m-comply)' : undefined}>{hits.includes(f) ? <CheckCircle2 size={11} /> : null} {f}</Badge>)}</span>],
            ['Updated', `${l.updatedDays} days ago · manifest v${l.version}`],
          ]} />
          {hits.length > 0 && <div className="muted" style={{ fontSize: 11.5 }}>Highlighted frameworks are in scope for {c.short}: {hits.join(', ')}.</div>}
          {conns.length > 0 && (
            <div>
              <div className="section-label">Your instances</div>
              <div className="list">
                {conns.map((k) => (
                  <button key={k.id} className="list-row" onClick={() => nav(`/fabric/integrations?connector=${k.id}`)}>
                    <span className="dot" style={{ background: HEALTH_COLOR[effHealth(k)] }} />
                    <span className="list-main"><b>{connName(k)}</b><span>{ENV_LABEL[k.env]} · data plane {k.dataPlaneId} · {k.tenants === 'all' ? 'all tenants' : k.tenants.join(', ')}</span></span>
                    <HealthBadge status={effHealth(k)} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'flow' && (
        <>
          <div className="muted" style={{ fontSize: 12 }}>What HexaView ingests from {l.name}, where it is normalised and which HexaShield modules it powers. Click a module to open it.</div>
          <FlowMap columns={flow.cols} links={flow.links} goodColor="#3fd0f0"
            footer={l.write.length && !ot
              ? <>Write-back returns the other way as signed intents from the Action Centre, executed by the data plane: {l.write.map((x) => x.name).join(', ')}.</>
              : <>Read-only: no data or commands flow back to {l.vendor === 'Generic' ? 'the source' : l.vendor}{ot ? ' (OT is read-only by policy)' : ''}.</>} />
          <KV rows={[
            ['OCSF classes', <span className="chips">{l.ocsf.map((x) => <Chip key={x}>{x}</Chip>)}</span>],
            ['Processing', 'Normalised on your data plane; only findings and metadata reach the HexaView control plane'],
            ['Typical volume', `${fmtNum(Math.round(l.popularity * 37 + 400))} records / day per tenant`],
          ]} />
        </>
      )}

      {tab === 'perms' && (
        <>
          <Callout kind="good"><b>Least privilege by default.</b> HexaView requests only the scopes below. Credentials are referenced by vault path on your data plane and are never visible to HexaShield staff.</Callout>
          <div className="list">
            {l.scopes.map((s) => {
              const gated = s.includes('(gated)');
              return (
                <div key={s} className="list-row">
                  {gated ? <Lock size={15} style={{ color: 'var(--sev-medium)' }} /> : <KeyRound size={15} style={{ color: 'var(--m-core)' }} />}
                  <span className="list-main"><b className="mono">{s.replace(' (gated)', '')}</b><span>{gated ? 'Only used when an approved write-back intent executes' : 'Read access for scheduled syncs'}</span></span>
                  <Badge color={gated ? 'var(--sev-medium)' : 'var(--m-core)'}>{gated ? 'Write · gated' : 'Read'}</Badge>
                </div>
              );
            })}
          </div>
          <div>
            <div className="section-label">HexaView never requests</div>
            <div className="chips">{['Global admin', 'Mailbox content', 'Secret values', 'Key material', ...(ot ? ['Any OT write path'] : [])].map((x) => <Chip key={x}><ShieldOff size={11} style={{ verticalAlign: -1 }} /> {x}</Chip>)}</div>
          </div>
        </>
      )}

      {tab === 'write' && (
        ot || !l.write.length ? (
          <Callout kind="info">{ot ? <><b>OT target: read-only by policy.</b> HexaView never sends commands to OT networks; responses are routed to the site OT team as tickets.</> : <><b>Read-only integration.</b> {l.name} supplies data only; no actions are sent back.</>}</Callout>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 12 }}>Every write-back is disabled until an admin opts in. Each action is a signed intent with a risk class (LLD 8.2) and an approval gate; nothing executes without it.</div>
            <div className="list">
              {l.write.map((a) => (
                <div key={a.name} className="list-row">
                  <ShieldCheck size={16} style={{ color: RISK_COLOR[a.risk] }} />
                  <span className="list-main"><b>{a.name}</b><span>Gate: {a.gate}</span></span>
                  <Badge color={RISK_COLOR[a.risk]}>{cap(a.risk)} risk</Badge>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === 'setup' && (
        <>
          <div className="muted" style={{ fontSize: 12 }}>Median setup {fmtSetup(l.setupMin)} across {l.custom ? 'this deployment' : `${fmtNum(l.installs)} organisations`}. Steps run against {c.dataPlanes.find((p) => p.id === plane)?.name ?? 'your data plane'}.</div>
          <Timeline items={setupSteps(l).map((s, i) => ({ time: `Step ${i + 1}`, title: s.title, body: s.body, color: 'var(--m-core)' }))} />
        </>
      )}

      {tab === 'residency' && (
        <>
          <div className="muted" style={{ fontSize: 12 }}>Choose where the connector runs. Raw data and credentials stay on that data plane; residency is {c.residency}.</div>
          <div className="mkt-planes">
            {c.dataPlanes.map((p) => (
              <button key={p.id} className={`mkt-plane ${plane === p.id ? 'on' : ''}`} onClick={() => setPlane(p.id)}>
                <Server size={15} />
                <span className="list-main"><b>{p.name}</b><span>{p.placement} · {p.region}</span><span>Vault: {p.vault}</span></span>
                <HealthBadge status={p.status} />
              </button>
            ))}
          </div>
          {c.dataPlanes.find((p) => p.id === plane)?.note && <Callout kind="warn">{c.dataPlanes.find((p) => p.id === plane)?.note}</Callout>}
        </>
      )}

      {tab === 'reviews' && (
        <>
          <div className="mkt-rev-head">
            <div>
              <div className="stat-big">{l.rating.toFixed(1)}</div>
              <Stars value={l.rating} size={14} />
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{l.reviews} reviews · {fmtNum(l.installs)} orgs</div>
            </div>
            <div className="mkt-spread">
              {spread.map((n, i) => (
                <div key={i}><span>{5 - i}★</span><div className="bar thin"><i style={{ width: `${(n / Math.max(1, l.reviews)) * 100}%`, background: '#f0a338' }} /></div><em>{n}</em></div>
              ))}
            </div>
          </div>
          <div className="fab-kvgrid">
            <div><b>{(99.2 + (l.popularity % 7) / 10).toFixed(1)}%</b><span>Sync success (30 d)</span></div>
            <div><b>{Math.max(1, Math.round(l.updatedDays / 3))} d</b><span>Avg fix for schema drift</span></div>
            <div><b>{l.cert === 'HexaView-certified' ? 'Nightly' : 'Weekly'}</b><span>Contract tests</span></div>
          </div>
          <div className="list">
            {reviews.map((r, i) => (
              <div key={i} className="mkt-review">
                <div className="row between"><b>{r.who}, {r.org}</b><Stars value={r.stars} /></div>
                <p>{r.text}</p>
                <span className="muted">{r.daysAgo} days ago · verified HexaView customer</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}
