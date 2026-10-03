import { useMemo, useState, type CSSProperties } from 'react';
import { Share2, Link2, Copy, Ban, Plus, Globe2, BadgeCheck, CalendarCheck } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { resilienceIndex, loops, loopSummary } from '../../data/core';
import { scopedTenants } from '../../data/customers';
import { shareLinks, trustTier, lastPenTest, type ShareLink } from '../../data/modules/ops';
import { Card, KpiStrip, Badge, StatusBadge, Btn, Callout, KV, HexScore, Timeline, Chip } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtAgo, fmtDate, daysAgo, daysAhead } from '../../lib/format';
import { rng } from '../../lib/rng';
import { OPS_TONE, Switch, useParamFilter, FilterChip, scrollToId } from './parts';

type ShareKey = 'ri' | 'attest' | 'certs' | 'pentest';
const KIND_COLOR: Record<ShareLink['kind'], string> = { partner: 'var(--m-comply)', regulator: 'var(--sev-high)', insurer: 'var(--m-insurance)', customer: 'var(--m-core)' };

export default function Trust() {
  const { customer, tenantId } = useApp();
  return <TrustInner key={`${customer.id}-${tenantId}`} />;
}

function TrustInner() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const tenants = scopedTenants(c, tenantId);
  const ri = resilienceIndex(c, tenantId).value;
  const tier = trustTier(ri);
  const assured = loopSummary(loops(c, tenantId)).assuredPct;
  const pt = lastPenTest(c);
  const [links, setLinks] = useState<ShareLink[]>(() => shareLinks(c, tenantId));
  const [shared, setShared] = useState<Record<ShareKey, boolean>>({ ri: true, attest: true, certs: true, pentest: c.id !== 'media' });
  const [sel, setSel] = useState<ShareLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [kindF, setKindF] = useParamFilter('kind');
  const [statusF, setStatusF] = useParamFilter('status');
  const pivot = (k: string | null, st: string | null = null) => {
    setKindF(k);
    setStatusF(st);
    scrollToId('ops-links');
  };
  const [form, setForm] = useState<{ recipient: string; kind: ShareLink['kind']; expiry: number }>({ recipient: '', kind: 'customer', expiry: 30 });

  const certs = c.frameworks.filter((f) => f.kind === 'Certification' || f.kind === 'Attestation');
  const attest = c.frameworks.filter((f) => f.kind !== 'Certification' && f.kind !== 'Attestation');
  const active = links.filter((l) => l.status === 'active');
  const views = links.reduce((s, l) => s + l.views, 0);
  const scopeNow = [shared.ri && 'RI', shared.attest && 'Attestations', shared.certs && 'Certifications', shared.pentest && 'Pen test date'].filter(Boolean) as string[];

  const viewSeries = useMemo(() => {
    const r = rng(`ops-trust-views-${c.id}-${tenantId}-${days}`);
    const n = days === 1 ? 24 : days;
    return Array.from({ length: n }, () => r.int(0, days === 1 ? 3 : 6));
  }, [c.id, tenantId, days]);

  const toggle = (k: ShareKey, label: string) => (v: boolean) => {
    setShared((s) => ({ ...s, [k]: v }));
    toast(`${label} ${v ? 'now shared' : 'hidden'} on the trust page and all active links (${active.length}); change logged`);
  };

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''}: share live, verifiable proof of resilience with partners, regulators, insurers and customers instead of sending questionnaires. You choose what is shared; every link expires and every view is logged to the audit ledger.
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Resilience Index', value: ri, unit: `${tier.tier} tier`, to: '/board', source: `HexaView Resilience Index from ${c.connectors.length} connectors` },
          { label: 'Loop assurance', value: `${assured}%`, bar: assured, to: '/loop', source: 'Closed-loop assurance (HexaComply × HexaMatrix × HexaStrike)' },
          { label: 'Active links', value: active.length, unit: `of ${links.length}`, onClick: () => pivot(null, 'active'), source: 'Trust Centre share links' },
          { label: 'Views', hint: 'all links', value: views, unit: `${viewSeries.reduce((s, v) => s + v, 0)} in range`, onClick: () => scrollToId('ops-views'), source: 'Audit ledger (share_link.viewed)' },
          { label: 'Shared items', value: `${scopeNow.length}/4`, onClick: () => scrollToId('ops-shared'), source: 'Trust Centre sharing policy' },
          { label: 'Last pen test', value: `${pt.daysAgo} d`, unit: 'ago', to: '/strike/pentest', source: `${pt.by} · ${pt.scope}` },
        ]}
      />

      <div className="grid g-1-2">
        <div className="stack">
          <Card title="Resilience badge" sub="Embeddable, signed, refreshed hourly">
            <div className="ops-badge" style={{ '--tier': tier.color } as CSSProperties}>
              <HexScore value={shared.ri ? ri : 0} size={110} sub={shared.ri ? 'RESILIENCE' : 'HIDDEN'} />
              <span className="tier">{tier.tier} · HexaView verified</span>
              <b style={{ fontSize: 14 }}>{c.name}</b>
              <span className="muted" style={{ fontSize: 11 }}>Verified {fmtDate(daysAgo(0))} · ri-v1.2</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <Btn sm onClick={() => toast('Badge embed snippet copied (signed SVG, verifies against trust.hexashield.io)')}><Copy size={13} /> Copy embed</Btn>
              <Btn sm onClick={() => toast(`Public trust page URL copied: trust.hexashield.io/${c.domain.split('.')[0]}`)}><Globe2 size={13} /> Copy page URL</Btn>
            </div>
          </Card>
          <div id="ops-shared" style={{ scrollMarginTop: 80 }} />
          <Card title="What is shared" sub="Applies to the public page and every active link">
            <div className="stack" style={{ gap: 10 }}>
              {([
                ['ri', 'Resilience Index & tier', `${ri} · ${tier.tier}`],
                ['attest', 'Framework attestations', attest.map((f) => f.short).join(', ')],
                ['certs', 'Certifications', certs.map((f) => f.short).join(', ') || 'None'],
                ['pentest', 'Last penetration test date', `${fmtDate(daysAgo(pt.daysAgo))} · ${pt.by}`],
              ] as [ShareKey, string, string][]).map(([k, label, detail]) => (
                <div key={k} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Switch on={shared[k]} onChange={toggle(k, label)} />
                  <span style={{ fontSize: 12.5 }}>
                    <b>{label}</b>
                    <div className="muted" style={{ fontSize: 11 }}>{detail}</div>
                  </span>
                </div>
              ))}
              <Callout kind="info">Findings, assets, tenants and incidents are never shared. Attestations show status and assurance %, not evidence.</Callout>
            </div>
          </Card>
        </div>

        <Card title="Public trust page preview" sub={`trust.hexashield.io/${c.domain.split('.')[0]} · what a recipient sees`}>
          <div className="ops-pub">
            <div className="ops-pub-bar"><i /><i /><i /><span style={{ marginLeft: 8 }}>trust.hexashield.io/{c.domain.split('.')[0]}</span></div>
            <div className="ops-pub-body">
              <div className="row" style={{ gap: 14, alignItems: 'center' }}>
                <span className="org-avatar" style={{ background: c.colour, width: 44, height: 44, fontSize: 15 }}>{c.initials}</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 18 }}>{c.name} Trust Centre</h3>
                  <div className="muted" style={{ fontSize: 12 }}>{c.sectorLong} · {c.hq}</div>
                </div>
                {shared.ri && <HexScore value={ri} size={70} sub={tier.tier.toUpperCase()} />}
              </div>
              {shared.ri && (
                <div className="secondary" style={{ fontSize: 12.5 }}>
                  Resilience Index <b>{ri}</b> ({tier.tier}), computed continuously by HexaView from {c.connectors.length} connected security tools and validated by HexaStrike. {assured}% of control-to-detection loops are proven closed.
                </div>
              )}
              {shared.certs && (
                <div>
                  <div className="section-label">Certifications</div>
                  <div className="chips">{certs.map((f) => <Badge key={f.id} color="var(--good)"><BadgeCheck size={11} /> {f.name}</Badge>)}</div>
                </div>
              )}
              {shared.attest && (
                <div>
                  <div className="section-label">Framework attestations</div>
                  <div className="grid g2" style={{ gap: 6 }}>
                    {attest.map((f) => (
                      <div key={f.id} className="row" style={{ fontSize: 12, gap: 8 }}>
                        <b style={{ width: 110 }}>{f.short}</b>
                        <div style={{ flex: 1 }} className="bar thin"><i style={{ width: `${f.documented}%`, background: 'var(--m-comply)' }} /></div>
                        <span className="muted" style={{ width: 36, textAlign: 'right' }}>{f.documented}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {shared.pentest && (
                <div className="row" style={{ gap: 8, fontSize: 12 }}>
                  <CalendarCheck size={14} style={{ color: OPS_TONE }} />
                  Last independent penetration test: <b>{fmtDate(daysAgo(pt.daysAgo))}</b> <span className="muted">({pt.scope})</span>
                </div>
              )}
              {!scopeNow.length && <div className="empty">Nothing is shared. Recipients see only the company name.</div>}
              <div className="muted" style={{ fontSize: 10.5, borderTop: '1px solid var(--hairline)', paddingTop: 8 }}>
                Signed by HexaView · data residency {c.residency.split('·')[0].trim()} · verify signature
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <div id="ops-links" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card
          title="Share links"
          count={links.filter((l) => (!kindF || l.kind === kindF) && (!statusF || l.status === statusF)).length}
          sub="Expiring, revocable, view-logged"
          flush
          actions={<><FilterChip label={[kindF, statusF].filter(Boolean).join(' · ')} onClear={() => pivot(null)} /><Btn sm primary color={OPS_TONE} onClick={() => setCreating(true)}><Plus size={13} /> New link</Btn></>}
        >
          <DataTable
            rows={links.filter((l) => (!kindF || l.kind === kindF) && (!statusF || l.status === statusF))}
            rowKey={(l) => l.id}
            onRowClick={setSel}
            initialSort={{ key: 'views', dir: 'desc' }}
            columns={[
              { key: 'to', header: 'Recipient', sort: (l) => l.recipient, render: (l) => (<><div className="t-main">{l.recipient}</div><div className="t-sub mono">{l.id}</div></>) },
              { key: 'kind', header: 'Type', sort: (l) => l.kind, render: (l) => <Badge color={KIND_COLOR[l.kind]}>{l.kind}</Badge> },
              { key: 'scope', header: 'Shares', render: (l) => <span className="chips">{l.scope.map((s) => <Chip key={s}>{s}</Chip>)}</span> },
              { key: 'exp', header: 'Expiry', sort: (l) => l.expiresDays, render: (l) => (l.status === 'active' ? <span style={{ color: l.expiresDays < 7 ? 'var(--sev-medium)' : undefined }}>in {l.expiresDays} d</span> : <span className="muted">{fmtDate(daysAhead(l.expiresDays))}</span>) },
              { key: 'views', header: 'Views', align: 'right', sort: (l) => l.views, render: (l) => l.views },
              { key: 'last', header: 'Last viewed', sort: (l) => -(l.lastViewMin ?? 1e9), render: (l) => (l.lastViewMin !== null ? fmtAgo(l.lastViewMin) : '—') },
              { key: 'st', header: 'Status', sort: (l) => l.status, render: (l) => <StatusBadge value={l.status} map={{ active: 'var(--good)', expired: 'var(--sev-info)', revoked: 'var(--bad)' }} /> },
            ]}
          />
        </Card>
        </div>
        <div id="ops-views" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Link views" sub={`${rangeLabel(timeRange)} · logged in the audit ledger`}>
          <div className="ops-cols" style={{ height: 110 }}>
            {viewSeries.map((v, i) => (
              <div key={i} title={`${days === 1 ? `-${viewSeries.length - 1 - i}h` : `-${viewSeries.length - 1 - i}d`}: ${v} views`} style={{ cursor: 'default' }}>
                <i style={{ height: `${(v / Math.max(1, ...viewSeries)) * 100}%`, minHeight: v ? 3 : 0, background: '#68b1ff' }} />
              </div>
            ))}
          </div>
          <div className="ops-cols-axis">
            <span>{days === 1 ? '24 h ago' : `${days} d ago`}</span>
            <span>{viewSeries.reduce((s, v) => s + v, 0)} views</span>
            <span>now</span>
          </div>
          <div className="ops-seg-legend" style={{ marginTop: 12 }}>
            {(['insurer', 'regulator', 'customer', 'partner'] as ShareLink['kind'][]).map((k) => {
              const n = links.filter((l) => l.kind === k).reduce((s, l) => s + l.views, 0);
              return (
                <button key={k} type="button" className={`ops-seg-row link ${kindF === k ? 'on' : ''}`} onClick={() => pivot(kindF === k ? null : k)} title="Filter the share links">
                  <i style={{ background: KIND_COLOR[k] }} />
                  <span style={{ textTransform: 'capitalize' }}>{k}</span>
                  <b>{n}</b>
                  <em>views</em>
                </button>
              );
            })}
          </div>
        </Card>
        </div>
      </div>

      {sel && (
        <Drawer
          title={sel.recipient}
          sub={`${sel.kind} · ${sel.id}`}
          onClose={() => setSel(null)}
          icon={<Link2 size={18} style={{ color: OPS_TONE }} />}
          footer={
            <>
              <Btn onClick={() => { toast(`Link copied: trust.hexashield.io/s/${sel.id}`); }}><Copy size={13} /> Copy link</Btn>
              {sel.status === 'active' && (
                <Btn danger onClick={() => { setLinks((ls) => ls.map((l) => (l.id === sel.id ? { ...l, status: 'revoked' } : l))); toast(`Revoked link for ${sel.recipient}; further views are refused`); setSel(null); }}>
                  <Ban size={13} /> Revoke
                </Btn>
              )}
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <KV
              rows={[
                ['Status', <StatusBadge value={sel.status} map={{ active: 'var(--good)', expired: 'var(--sev-info)', revoked: 'var(--bad)' }} />],
                ['Shares', sel.scope.join(', ')],
                ['Created', `${sel.createdDaysAgo} days ago`],
                ['Expires', sel.status === 'active' ? `in ${sel.expiresDays} days (${fmtDate(daysAhead(sel.expiresDays))})` : fmtDate(daysAhead(sel.expiresDays))],
                ['Views', sel.views],
                ['Access', 'Email-verified recipient domain, watermarked PDF export'],
              ]}
            />
            <div className="section-label">View log</div>
            {sel.viewLog.length ? (
              <Timeline items={sel.viewLog.map((v) => ({ time: fmtAgo(v.minAgo), title: v.who, body: `Viewed from ${v.from} · recorded in the audit ledger (share_link.viewed)` }))} />
            ) : (
              <div className="empty">No views yet.</div>
            )}
          </div>
        </Drawer>
      )}

      {creating && (
        <Modal
          title="New share link"
          sub={`Shares: ${scopeNow.join(', ') || 'nothing (toggle items on first)'}`}
          onClose={() => setCreating(false)}
          footer={
            <>
              <Btn onClick={() => setCreating(false)}>Cancel</Btn>
              <Btn
                primary
                color={OPS_TONE}
                disabled={!form.recipient.trim() || !scopeNow.length}
                onClick={() => {
                  const id = `sh_${Math.random().toString(16).slice(2, 10)}`;
                  setLinks((ls) => [{ id, recipient: form.recipient.trim(), kind: form.kind, scope: scopeNow, expiresDays: form.expiry, createdDaysAgo: 0, views: 0, lastViewMin: null, status: 'active', viewLog: [] }, ...ls]);
                  setCreating(false);
                  toast(`Share link created for ${form.recipient.trim()}, expires in ${form.expiry} days`);
                  setForm({ recipient: '', kind: 'customer', expiry: 30 });
                }}
              >
                <Share2 size={14} /> Create link
              </Btn>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <label className="stack" style={{ gap: 4, fontSize: 12 }}>
              Recipient organisation
              <input className="input" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="e.g. Procurement, a key customer" />
            </label>
            <div className="row" style={{ gap: 12 }}>
              <label className="stack" style={{ gap: 4, fontSize: 12, flex: 1 }}>
                Recipient type
                <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ShareLink['kind'] })}>
                  <option value="customer">Customer</option>
                  <option value="partner">Partner</option>
                  <option value="insurer">Insurer</option>
                  <option value="regulator">Regulator</option>
                </select>
              </label>
              <label className="stack" style={{ gap: 4, fontSize: 12, flex: 1 }}>
                Expires after
                <select className="select" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: Number(e.target.value) })}>
                  {[7, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </label>
            </div>
            <Callout kind="info">The recipient verifies their email domain before viewing. Every view is logged and you can revoke at any time.</Callout>
          </div>
        </Modal>
      )}
    </>
  );
}
