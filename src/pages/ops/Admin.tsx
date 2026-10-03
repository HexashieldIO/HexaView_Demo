import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, Server, Plug, KeyRound, ShieldCheck, Palette, Check, X, Lock, Fingerprint } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedTenants, scopedConnectors, isStale } from '../../data/customers';
import { adminUsers, supportSessions, idpFor, extraPeople, HV_ROLES, signingKey, type AdminUser, type HvRole, type SupportSession } from '../../data/modules/ops';
import { Card, KpiStrip, Badge, StatusBadge, Btn, Callout, KV, HealthBadge, Chip, Freshness } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtCompact, fmtNum, fmtDate, daysAgo, daysAhead } from '../../lib/format';
import { OPS_TONE, Switch, useParamFilter, FilterChip, HBars, scrollToId } from './parts';

const ROLE_COLOR: Record<HvRole, string> = {
  Analyst: 'var(--m-soc)', Approver: 'var(--m-core)', 'Tenant Admin': 'var(--m-ops)', GRC: 'var(--m-comply)', Auditor: 'var(--sev-info)', 'Board viewer': 'var(--m-view)', 'OT engineer': 'var(--m-ot)', 'Support (read-only)': 'var(--sev-high)',
};

export default function Admin() {
  const { customer, tenantId, account } = useApp();
  return <AdminInner key={`${customer.id}-${tenantId}-${account}`} />;
}

function AdminInner() {
  const { customer: c, tenantId, timeRange, account, toast } = useApp();
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const tenants = scopedTenants(c, tenantId);
  const users = useMemo(() => adminUsers(c, tenantId), [c, tenantId]);
  const [sessions, setSessions] = useState<SupportSession[]>(() => supportSessions(c));
  const [open, setOpen] = useState<Set<string>>(() => new Set(tenants.slice(0, 1).map((t) => t.id)));
  const [roleP, setRoleP] = useParamFilter('role');
  const roleFilter = (roleP ?? 'all') as 'all' | HvRole;
  const setRoleFilter = (r: 'all' | HvRole) => setRoleP(r === 'all' ? null : r);
  const nav = useNavigate();
  const [sso, setSso] = useState({ enforce: true, scim: true, phishingResistant: c.id === 'finserv' || c.id === 'automotive', stepUp: true, sessionH: c.id === 'finserv' ? 8 : 12 });
  const [wl, setWl] = useState({ name: account === 'partner' ? `${extraPeople(c).partner} Resilience` : 'HexaView', colour: account === 'partner' ? '#0f766e' : '#3b5bdb', partner: extraPeople(c).partner });
  const partner = account === 'partner';

  const limit = c.integrationLimit;
  const pending = sessions.filter((s) => s.status === 'pending');
  const metering = [
    { to: '/fabric/integrations', label: 'Integrations', sub: limit ? `${c.tier} entitlement` : 'Unlimited on Enterprise / CNI', value: c.connectors.length, max: limit ?? Math.max(c.connectors.length, 1), display: limit ? `${c.connectors.length} / ${limit}` : `${c.connectors.length} / ∞` },
    { to: '#ops-tree', label: 'Tenants', sub: 'Isolation boundaries', value: c.tenants.length, max: c.tier === 'Professional' ? 5 : 50, display: `${c.tenants.length} / ${c.tier === 'Professional' ? 5 : 50}` },
    { to: '/fabric/pipeline', label: 'Events normalised', sub: rangeLabel(timeRange), value: h.fabric.eventsPerDay * days, max: h.fabric.eventsPerDay * days * 1.4, display: fmtCompact(h.fabric.eventsPerDay * days) },
    { to: '/ai/copilot', label: 'Copilot tokens', sub: rangeLabel(timeRange), value: Math.round(h.ai.copilotQueries30d * 2600 * (days / 30)), max: Math.round(h.ai.copilotQueries30d * 2600 * (days / 30) * 1.6), display: fmtCompact(Math.round(h.ai.copilotQueries30d * 2600 * (days / 30))) },
    { to: '/ops/actions', label: 'Actions executed', sub: rangeLabel(timeRange), value: Math.round(h.ops.actions30d * (days / 30)), max: Math.round(h.ops.actions30d * (days / 30) * 2) + 1, display: fmtNum(Math.round(h.ops.actions30d * (days / 30))) },
    { to: '/comply/caas', label: 'Evidence storage', sub: 'Immutable, all time', value: Math.round(h.comply.evidenceItems * 0.042), max: c.tier === 'Professional' ? 250 : 2000, display: `${Math.round(h.comply.evidenceItems * 0.042)} GB` },
  ];
  const kek = c.byok ? c.dataPlanes[0]?.vault ?? 'Customer HSM' : 'Platform-managed (per-tenant Key Vault)';

  const toggleOpen = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const decide = (s: SupportSession, ok: boolean) => {
    setSessions((ss) => ss.map((x) => (x.id === s.id ? { ...x, status: ok ? 'active' : 'denied', approvedBy: ok ? c.people.admin.name : null } : x)));
    toast(ok ? `Approved ${s.engineer} for ${s.durationH} h, read-only (${s.ticket}); session will be recorded and auto-expire` : `Denied support access request ${s.ticket}; HexaShield notified`);
  };

  const whiteLabel = (
    <Card
      title={<><Palette size={15} /> White-label theme</>}
      sub={partner ? `Partner account: ${wl.partner} resells HexaView under its own brand` : 'Available to partner accounts (MSSPs and resellers)'}
      toneColor={OPS_TONE}
      tinted={partner}
      actions={partner ? <Badge color={OPS_TONE} solid>Partner</Badge> : <Badge color="var(--sev-info)">Customer view</Badge>}
    >
      <div className="grid g2">
        <div className="stack" style={{ gap: 10 }}>
          <label className="stack" style={{ gap: 4, fontSize: 12 }}>
            Product name
            <input className="input" value={wl.name} onChange={(e) => setWl({ ...wl, name: e.target.value })} disabled={!partner} />
          </label>
          <label className="stack" style={{ gap: 4, fontSize: 12 }}>
            Partner
            <input className="input" value={wl.partner} onChange={(e) => setWl({ ...wl, partner: e.target.value })} disabled={!partner} />
          </label>
          <label className="row" style={{ gap: 8, fontSize: 12 }}>
            Primary colour
            <input type="color" value={wl.colour} onChange={(e) => setWl({ ...wl, colour: e.target.value })} disabled={!partner} style={{ width: 42, height: 26, border: 0, background: 'none' }} />
            <span className="mono muted">{wl.colour}</span>
          </label>
          {partner ? (
            <Btn sm primary color={OPS_TONE} onClick={() => toast(`Theme "${wl.name}" published to ${c.tenants.length} tenant${c.tenants.length > 1 ? 's' : ''} of ${c.short}; "Powered by HexaShield" retained in the footer`)}>Publish theme</Btn>
          ) : (
            <span className="muted" style={{ fontSize: 11.5 }}>Switch the account type to Partner in the top bar to edit.</span>
          )}
        </div>
        <div className={`ops-wl ${partner ? 'emph' : ''}`}>
          <div className="ops-wl-bar" style={{ background: wl.colour }}>
            <span className="ops-wl-logo">{wl.partner.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
            <span style={{ flex: 1 }}>{wl.name}</span>
            <span style={{ fontSize: 10.5, opacity: 0.85 }}>{c.short}</span>
          </div>
          <div style={{ padding: 12, display: 'grid', gap: 8, background: 'var(--surface-sunken)' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 8, height: 30, borderRadius: 3, background: wl.colour }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.08em' }}>RESILIENCE INDEX</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{tenants[0]?.ri ?? 0}</div>
              </div>
              <span className="chip" style={{ background: `color-mix(in srgb, ${wl.colour} 18%, transparent)`, color: wl.colour }}>{h.soc.openIncidents} open incidents</span>
            </div>
            <div className="bar thin"><i style={{ width: '72%', background: wl.colour }} /></div>
            <div className="muted" style={{ fontSize: 10 }}>Powered by HexaShield · {wl.partner}</div>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''}: {c.deployment}. Tenancy, users and roles via {idpFor(c)} SSO, keys, entitlements and metering, and HexaShield support access (no standing access).
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Tenants', value: c.tenants.length, unit: tenantId === 'all' ? 'in organisation' : `viewing ${tenants[0]?.short}`, onClick: () => { setOpen(new Set(tenants.map((t) => t.id))); scrollToId('ops-tree'); }, source: 'HexaView tenancy registry' },
          { label: 'Data planes', value: c.dataPlanes.length, unit: `${c.dataPlanes.filter((d) => d.status !== 'healthy').length} degraded`, to: '/fabric/dataplanes', source: 'Data-plane agent heartbeats' },
          { label: 'Integrations', value: c.connectors.length, unit: limit ? `of ${limit}` : 'unlimited', bar: limit ? (c.connectors.length / limit) * 100 : undefined, toneColor: limit && c.connectors.length / limit > 0.85 ? 'var(--sev-medium)' : undefined, to: '/fabric/integrations', source: 'HexaCore connector registry' },
          { label: 'Users', value: users.length, unit: `${new Set(users.map((u) => u.role)).size} roles`, onClick: () => { setRoleFilter('all'); scrollToId('ops-users'); }, source: `${idpFor(c)} (SCIM)` },
          { label: 'Support requests', value: pending.length, unit: 'awaiting you', toneColor: pending.length ? 'var(--sev-medium)' : undefined, onClick: () => scrollToId('ops-support'), source: 'HexaView support-access broker' },
          { label: 'Keys', value: c.byok ? 'BYOK' : 'Managed', unit: c.byok ? 'customer HSM' : 'per tenant', onClick: () => scrollToId('ops-keys'), source: kek },
        ]}
      />

      {partner && whiteLabel}

      <div className="grid g-2-1">
        <div id="ops-tree" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Tenancy hierarchy" sub="Organisation → tenants → data planes → connector instances · click a tenant to expand">
          <div className="ops-tree">
            <div className="ops-tree-row" style={{ fontWeight: 700 }}>
              <span className="org-avatar" style={{ background: c.colour, width: 22, height: 22, fontSize: 9 }}>{c.initials}</span>
              {c.name}
              <span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>organisation · {c.stamp}</span>
            </div>
            {tenants.map((t) => {
              const dp = c.dataPlanes.find((d) => d.id === t.dataPlaneId);
              const conns = scopedConnectors(c, t.id);
              const isOpen = open.has(t.id);
              return (
                <div key={t.id}>
                  <button className="ops-tree-row" style={{ width: '100%', border: 0, background: 'none', color: 'inherit', paddingLeft: 22, textAlign: 'left' }} onClick={() => toggleOpen(t.id)}>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <Building2 size={13} style={{ color: OPS_TONE }} />
                    <b>{t.name}</b>
                    <span className="muted" style={{ fontSize: 11 }}>{t.kind} · {t.city}</span>
                    <span className="spacer" />
                    <span className="chips">{t.regimes.slice(0, 2).map((r) => <Chip key={r}>{r}</Chip>)}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{conns.length} connectors</span>
                  </button>
                  {isOpen && dp && (
                    <>
                      <div className="ops-tree-row" style={{ paddingLeft: 54 }}>
                        <Server size={13} style={{ color: 'var(--m-core)' }} />
                        <span>{dp.name}</span>
                        <span className="muted" style={{ fontSize: 11 }}>{dp.placement} · {dp.region} · agent {dp.agentVersion}</span>
                        <span className="spacer" />
                        <HealthBadge status={dp.status} />
                      </div>
                      {conns.map((k) => (
                        <div key={k.id} className="ops-tree-row" style={{ paddingLeft: 82 }}>
                          <Plug size={12} className="muted" />
                          <span>{k.vendor} {k.product}</span>
                          <span className="muted" style={{ fontSize: 11 }}>{k.category} · v{k.version}{k.write.length ? ` · write: ${k.write.length}` : ' · read-only'}</span>
                          <span className="spacer" />
                          {isStale(k) ? <Freshness minutes={k.lastSyncMin} stale label={k.product} /> : <HealthBadge status={k.status} />}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
        </div>
        <div className="stack">
          <div id="ops-keys" style={{ scrollMarginTop: 80 }} />
          <Card title="Deployment & keys" sub={c.stamp} actions={<KeyRound size={16} style={{ color: OPS_TONE }} />}>
            <KV
              rows={[
                ['Deployment', c.deployment],
                ['Residency', c.residency],
                ['Key model', c.byok ? <Badge color="var(--good)">BYOK · customer-held KEK</Badge> : <Badge color="var(--sev-info)">Platform-managed</Badge>],
                ['Key store', kek],
                ['Key status', c.byok ? <span><Badge color="var(--good)" dot>Active</Badge> <span className="muted">rotated {fmtDate(daysAgo(c.id === 'finserv' ? 41 : 63))} · next {fmtDate(daysAhead(c.id === 'finserv' ? 324 : 302))}</span></span> : <span className="muted">Rotated automatically every 90 days</span>],
                ['Action signing', <span className="mono" style={{ fontSize: 11 }}>{signingKey(c)}</span>],
                ['Ledger anchors', `ES256 · every 5 min · last ${h.ops.lastAnchorMin} min ago`],
              ]}
            />
            {!c.byok && (
              <div style={{ marginTop: 10 }}>
                <Callout kind="info">BYOK, customer-hosted and air-gapped data planes are part of Enterprise / CNI.</Callout>
              </div>
            )}
          </Card>
          <Card title="SSO & MFA" sub={`${idpFor(c)} · SAML 2.0 + SCIM 2.0`} actions={<Fingerprint size={16} style={{ color: OPS_TONE }} />}>
            <div className="stack" style={{ gap: 9 }}>
              {([
                ['enforce', 'Enforce SSO for all users', 'Local passwords disabled'],
                ['scim', 'SCIM provisioning', 'Users and roles from IdP groups'],
                ['phishingResistant', 'Phishing-resistant MFA only', 'FIDO2 / passkeys; blocks push and SMS'],
                ['stepUp', 'Step-up MFA to approve actions', 'Re-authenticate before signing an approval'],
              ] as [keyof typeof sso, string, string][]).map(([k, label, sub]) => (
                <div key={k} className="row" style={{ gap: 10 }}>
                  <Switch on={!!sso[k]} onChange={(v) => { setSso({ ...sso, [k]: v }); toast(`${label}: ${v ? 'on' : 'off'} (Tenant Admin change, logged)`); }} />
                  <span style={{ fontSize: 12.5, flex: 1 }}>
                    <b>{label}</b>
                    <div className="muted" style={{ fontSize: 11 }}>{sub}</div>
                  </span>
                </div>
              ))}
              <div className="row" style={{ gap: 8, fontSize: 12 }}>
                Session lifetime
                <select className="select" value={sso.sessionH} onChange={(e) => { setSso({ ...sso, sessionH: Number(e.target.value) }); toast(`Session lifetime set to ${e.target.value} h`); }}>
                  {[4, 8, 12, 24].map((x) => <option key={x} value={x}>{x} h</option>)}
                </select>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g-2-1">
        <div id="ops-users" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card
          title="Users & roles"
          count={users.filter((u) => roleFilter === 'all' || u.role === roleFilter).length}
          sub={`Provisioned from ${idpFor(c)}; HexaShield staff appear only while a support session is approved`}
          flush
          actions={
            <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | HvRole)} aria-label="Filter by role">
              <option value="all">All roles</option>
              {HV_ROLES.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
            </select>
          }
        >
          <DataTable
            rows={users.filter((u) => roleFilter === 'all' || u.role === roleFilter)}
            rowKey={(u: AdminUser) => u.email + u.role}
            search={(u) => `${u.name} ${u.email} ${u.role} ${u.title}`}
            searchPlaceholder="Filter users…"
            initialSort={{ key: 'role', dir: 'asc' }}
            pageSize={20}
            onRowClick={(u) => toast(`${u.name}: role changes are made in ${idpFor(c)} groups (SCIM)`)}
            columns={[
              { key: 'name', header: 'User', sort: (u) => u.name, render: (u) => (<><div className="t-main">{u.name}</div><div className="t-sub">{u.title} · {u.email}</div></>) },
              { key: 'role', header: 'Role', sort: (u) => HV_ROLES.findIndex((r) => r.role === u.role), render: (u) => <Badge color={ROLE_COLOR[u.role]}>{u.role}</Badge> },
              { key: 'scope', header: 'Tenants', render: (u) => <span style={{ fontSize: 12 }}>{u.tenants}</span> },
              { key: 'mfa', header: 'MFA', render: (u) => <span className="t-sub">{u.mfa}</span> },
              { key: 'last', header: 'Last active', sort: (u) => u.lastActiveMin, render: (u) => fmtAgo(u.lastActiveMin) },
            ]}
          />
        </Card>
        </div>
        <Card title="Roles" sub="Least privilege; approvals need the right role · click to filter users" actions={<FilterChip label={roleFilter === 'all' ? null : roleFilter} onClear={() => setRoleFilter('all')} />}>
          <div className="list">
            {HV_ROLES.map((r) => (
              <button key={r.role} type="button" className="list-row" style={{ width: '100%', textAlign: 'left', background: roleFilter === r.role ? 'var(--surface-hover)' : undefined }} onClick={() => { setRoleFilter(roleFilter === r.role ? 'all' : r.role); scrollToId('ops-users'); }}>
                <Badge color={ROLE_COLOR[r.role]}>{r.role}</Badge>
                <span className="list-main"><span style={{ whiteSpace: 'normal' }}>{r.can}</span></span>
                <b className="num">{users.filter((u) => u.role === r.role).length}</b>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Entitlements & metering" sub={`${c.tier} · ${rangeLabel(timeRange)} · click a meter to open its source`}>
          <HBars
            labelWidth={170}
            max={1}
            items={metering.map((m) => ({
              key: m.label,
              label: m.label,
              sub: m.sub,
              value: m.max ? m.value / m.max : 0,
              display: m.display,
              color: m.max && m.value / m.max > 0.85 ? 'var(--sev-medium)' : OPS_TONE,
              onClick: () => (m.to.startsWith('#') ? (setOpen(new Set(tenants.map((t) => t.id))), scrollToId(m.to.slice(1))) : nav(m.to)),
            }))}
          />
          {limit && c.connectors.length / limit > 0.85 && (
            <div style={{ marginTop: 10 }}>
              <Callout kind="warn">Integration entitlement at {c.connectors.length} of {limit}. Enterprise / CNI unlocks unlimited connectors and BYOK.</Callout>
            </div>
          )}
        </Card>
        <div id="ops-support" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Support access requests" count={pending.length} sub="HexaShield staff have no standing access · max 8 h · read-only by default · audited" actions={<ShieldCheck size={16} style={{ color: OPS_TONE }} />}>
          <div className="list">
            {sessions.map((s) => (
              <div key={s.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>{s.reason}</b>
                  <span>{s.engineer} · {s.ticket} · {s.durationH} h · {s.scope}</span>
                  <span>Requested {fmtAgo(s.requestedMinAgo)}{s.approvedBy ? ` · approved by ${s.approvedBy}` : ''}</span>
                </span>
                {s.status === 'pending' ? (
                  <span className="row" style={{ gap: 6 }}>
                    <Btn sm danger onClick={() => decide(s, false)}><X size={12} /> Deny</Btn>
                    <Btn sm primary color={OPS_TONE} onClick={() => decide(s, true)}><Check size={12} /> Approve</Btn>
                  </span>
                ) : (
                  <StatusBadge value={s.status} map={{ active: 'var(--m-core)', closed: 'var(--good)', denied: 'var(--bad)' }} />
                )}
              </div>
            ))}
          </div>
          <div className="card-foot">
            <span><Lock size={11} style={{ verticalAlign: -1 }} /> Sessions are recorded and written to the audit ledger (support_access.*)</span>
          </div>
        </Card>
        </div>
      </div>

      {!partner && <div style={{ opacity: 0.85 } as CSSProperties}>{whiteLabel}</div>}
    </>
  );
}
