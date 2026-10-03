import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Plus, Search, Trash2, Eye } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Bar, Btn, Callout, KV, SectionLabel } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Overlay';
import {
  CAP_LIST, MOD_MODES, STATUS_COLOR, STATUS_LABEL, clientBook, bookTotals, clientMargin,
  type ClientStatus, type ModMode, type PartnerClient,
} from '../../data/modules/partner';
import type { CapabilityId } from '../../data/types';
import { scoreTone } from '../../lib/format';
import { ClientAvatar, ModDots, PT_TONE, Toggle, money, useOpenClient } from './parts';
import { ClientDrawer } from './ClientDrawer';

type Filter = 'all' | ClientStatus | 'renewal';

export default function PartnerClients() {
  const [params, setParams] = useSearchParams();
  const { customerId, toast } = useApp();
  const nav = useNavigate();
  const open = useOpenClient();
  const book = useMemo(() => clientBook(), []);
  const t = bookTotals(book);
  const filter = (params.get('status') as Filter) ?? 'all';
  const tierF = params.get('tier');
  const modF = params.get('module') as CapabilityId | null;
  const sortP = params.get('sort');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string>(params.get('client') ?? book[0].id);
  const [drawer, setDrawer] = useState<PartnerClient | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<Record<CapabilityId, ModMode>>>>({});
  const [confirm, setConfirm] = useState<'apply' | 'remove' | null>(null);

  const setFilter = (f: Filter) => {
    const p = new URLSearchParams(params);
    if (f === 'all') p.delete('status');
    else p.set('status', f);
    p.delete('tier');
    p.delete('module');
    setParams(p, { replace: true });
  };

  const rows = book.filter((c) => {
    if (filter === 'renewal') { if (!(c.renewalDays <= 90 && c.status !== 'onboarding')) return false; }
    else if (filter === 'onboarding') { if (c.status !== 'onboarding' && c.status !== 'trial') return false; }
    else if (filter !== 'all' && c.status !== filter) return false;
    if (tierF && c.tier !== tierF) return false;
    if (modF && c.modules[modF] === 'Off') return false;
    if (q && !`${c.name} ${c.sector} ${c.city}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const sel = book.find((c) => c.id === selId) ?? book[0];
  const mods = (c: PartnerClient): Record<CapabilityId, ModMode> => ({ ...c.modules, ...(overrides[c.id] ?? {}) });
  const selMods = mods(sel);
  const pending = Object.entries(overrides[sel.id] ?? {}).filter(([k, v]) => sel.modules[k as CapabilityId] !== v);
  const setMode = (cap: CapabilityId, m: ModMode) => setOverrides((o) => ({ ...o, [sel.id]: { ...(o[sel.id] ?? {}), [cap]: m } }));

  const pills: { id: Filter; label: string; n: number; color?: string }[] = [
    { id: 'all', label: 'All clients', n: t.clients },
    { id: 'active', label: 'Active', n: t.active, color: STATUS_COLOR.active },
    { id: 'onboarding', label: 'Onboarding & trial', n: t.onboarding + t.trial, color: STATUS_COLOR.onboarding },
    { id: 'at-risk', label: 'At risk', n: t.atRisk, color: STATUS_COLOR['at-risk'] },
    { id: 'renewal', label: 'Renewal ≤ 90 d', n: t.renewals90, color: 'var(--sev-medium)' },
  ];

  return (
    <>
      <p className="page-intro">
        Your client book: the five HexaView reference tenants you run day to day plus {book.length - 5} smaller clients. Pick a row to manage its subscription; <b>Open client</b> switches into that client's own HexaView with delegated, audited partner access.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Clients', value: t.clients, onClick: () => setFilter('all'), source: 'HexaView partner tenant registry' },
          { label: 'Active', value: t.active, onClick: () => setFilter('active'), source: 'HexaView partner tenant registry' },
          { label: 'Onboarding & trial', value: t.onboarding + t.trial, onClick: () => setFilter('onboarding'), source: 'Provisioning service' },
          { label: 'At risk', value: t.atRisk, onClick: () => setFilter('at-risk'), source: 'Account health model (RI, SLA, renewal, incidents)' },
          { label: 'Open incidents', value: t.incidents, hint: `${t.critical} critical`, to: '/partner/clients?sort=incidents', source: 'HexaSOC case management (all client tenants)' },
          { label: 'Annual run rate', value: money(t.arr), to: '/partner-billing/usage', source: 'HexaShield billing · list price' },
        ]}
      />

      <div className="row wrap" style={{ gap: 10 }}>
        <span className="pt-pills">
          {pills.map((p) => (
            <button key={p.id} className={filter === p.id && !tierF && !modF ? 'on' : ''} onClick={() => setFilter(p.id)}>
              {p.color && <i style={{ background: p.color }} />}
              {p.label} <b>{p.n}</b>
            </button>
          ))}
        </span>
        {(tierF || modF) && (
          <Badge color={PT_TONE}>
            Filtered: {tierF ?? CAP_LIST.find((c) => c.id === modF)?.product}{' '}
            <button className="link" onClick={() => setFilter('all')}>clear</button>
          </Badge>
        )}
        <span className="spacer" />
        <label className="search" style={{ width: 240 }}>
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" />
        </label>
        <Btn primary color={PT_TONE} onClick={() => nav('/partner/provisioning?new=1')}>
          <Plus /> Add client
        </Btn>
      </div>

      <div className="pt-split">
        <Card flush foot={<span>{rows.length} of {book.length} clients shown · pick a row to manage its subscription</span>}>
          <DataTable
            rows={rows}
            key={sortP ?? 'default'}
            rowKey={(c) => c.id}
            onRowClick={(c) => setSelId(c.id)}
            pageSize={20}
            initialSort={sortP === 'ri' ? { key: 'ri', dir: 'asc' } : sortP === 'incidents' ? { key: 'inc', dir: 'desc' } : { key: 'arr', dir: 'desc' }}
            columns={[
              {
                key: 'name', header: 'Client', sort: (c) => c.name, render: (c) => (
                  <div className="row" style={{ gap: 9, boxShadow: c.id === sel.id ? 'inset 3px 0 0 var(--m-partner)' : undefined, marginLeft: -18, paddingLeft: 15 }}>
                    <ClientAvatar c={c} size={28} />
                    <div>
                      <div className="t-main">{c.short}</div>
                      <div className="t-sub">{c.demoId === customerId ? <span style={{ color: 'var(--m-partner)', fontWeight: 600 }}>Viewing · </span> : null}{c.sector}</div>
                    </div>
                  </div>
                ),
              },
              { key: 'tier', header: 'Tier', sort: (c) => c.tier, render: (c) => <span className="t-sub" style={{ whiteSpace: 'nowrap' }}>{c.tier}</span> },
              { key: 'mods', header: 'Modules', render: (c) => <ModDots modules={mods(c)} /> },
              { key: 'ri', header: 'Resilience', align: 'right', sort: (c) => c.ri, render: (c) => <span className="num" style={{ fontWeight: 700, color: scoreTone(c.ri) }} title="Source: Resilience Index">{c.ri}</span> },
              { key: 'inc', header: 'Incidents', align: 'right', sort: (c) => c.openIncidents * 10 + c.critical * 100, render: (c) => <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>{c.critical > 0 && <Badge color="var(--sev-critical)" solid>{c.critical}</Badge>}<span className="num">{c.openIncidents}</span></span> },
              { key: 'health', header: 'Health', sort: (c) => c.health, render: (c) => <div style={{ width: 70 }} title={c.healthNotes.join(' · ') || 'No issues'}><Bar value={c.health} color={scoreTone(c.health)} size="thin" /><span className="t-sub">{c.health}</span></div> },
              { key: 'arr', header: 'Run rate', align: 'right', sort: (c) => c.arrUsd, render: (c) => <span className="num">{money(c.arrUsd)}</span> },
              { key: 'ren', header: 'Renewal', sort: (c) => c.renewalDays, render: (c) => <span className="nowrap" style={{ color: c.renewalDays <= 60 ? 'var(--bad)' : undefined, fontSize: 12 }}>{c.status === 'trial' ? `PoV ${c.renewalDays} d` : `${c.renewalDays} d`}</span> },
              { key: 'st', header: 'Status', sort: (c) => c.status, render: (c) => <Badge color={STATUS_COLOR[c.status]} dot>{STATUS_LABEL[c.status]}</Badge> },
              { key: 'open', header: '', render: (c) => <Btn sm ghost onClick={() => open(c)} title={c.demoId ? 'Open this client in HexaView' : 'Sample client (preview only)'}><ExternalLink /> Open</Btn> },
            ]}
          />
        </Card>

        <Card toneColor={PT_TONE}>
          <div className="row" style={{ gap: 12 }}>
            <ClientAvatar c={sel} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 15.5 }}>{sel.name}</h3>
              <div className="row" style={{ gap: 6, fontSize: 11.5 }}>
                <span className="muted">{sel.sector} ·</span>
                <Badge color={STATUS_COLOR[sel.status]} dot>{STATUS_LABEL[sel.status]}</Badge>
              </div>
            </div>
            <Btn sm ghost onClick={() => setDrawer(sel)}>Details</Btn>
          </div>
          <div className="pt-stat-grid" style={{ margin: '14px 0' }}>
            <div><small>Modules</small><b>{Object.values(selMods).filter((m) => m !== 'Off').length} of 6</b></div>
            <div><small>Renewal</small><b>{sel.renewalDays} d</b></div>
            <div><small>Margin</small><b>{clientMargin(sel).marginPct.toFixed(0)}%</b></div>
          </div>
          <SectionLabel>Subscription</SectionLabel>
          {CAP_LIST.map((cap) => {
            const m = selMods[cap.id];
            return (
              <div key={cap.id} className="pt-sub-row">
                <span className="ico-box" style={{ '--tone': cap.tone, width: 26, height: 26 } as CSSProperties}>
                  <b style={{ fontSize: 10 }}>{cap.product.slice(4, 6).toUpperCase()}</b>
                </span>
                <span className="pt-sub-main">
                  <b>{cap.product}</b>
                  <span>{cap.services.filter((s) => sel.services.includes(s)).length} of {cap.services.length} services</span>
                </span>
                {m !== 'Off' && (
                  <select className="select" style={{ height: 24, fontSize: 11, padding: '0 4px' }} value={m} onChange={(e) => setMode(cap.id, e.target.value as ModMode)}>
                    {MOD_MODES.filter((x) => x !== 'Off').map((x) => <option key={x}>{x}</option>)}
                  </select>
                )}
                <Toggle on={m !== 'Off'} onChange={(v) => setMode(cap.id, v ? (sel.modules[cap.id] !== 'Off' ? sel.modules[cap.id] : 'Co-managed') : 'Off')} />
              </div>
            );
          })}
          <p className="muted" style={{ fontSize: 11.5, margin: '10px 0' }}>
            Switching a module off padlocks it in this client's side rail and puts a page describing it in its place: they can still see it exists and ask for it.
          </p>
          {pending.length > 0 && (
            <Callout kind="warn">
              {pending.length} change{pending.length > 1 ? 's' : ''} not yet applied.{' '}
              <button className="link" onClick={() => setConfirm('apply')}>Review and apply →</button>
            </Callout>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <Btn color={PT_TONE} onClick={() => open(sel)}>
              <Eye /> {sel.demoId === customerId ? 'Viewing this client' : 'Open client'}
            </Btn>
            <span className="spacer" />
            <Btn ghost danger onClick={() => setConfirm('remove')}>
              <Trash2 /> Remove client
            </Btn>
          </div>
        </Card>
      </div>

      {confirm === 'apply' && (
        <Modal
          title={`Apply subscription changes · ${sel.short}`}
          sub="Risk class: medium · changes entitlements and the client's side rail"
          onClose={() => setConfirm(null)}
          footer={<><Btn onClick={() => setConfirm(null)}>Cancel</Btn><Btn primary color={PT_TONE} onClick={() => { toast(`${pending.length} subscription change(s) submitted for ${sel.short}: entitlements update in about 2 minutes`); setOverrides((o) => ({ ...o, [sel.id]: {} })); setConfirm(null); }}>Apply changes</Btn></>}
        >
          <KV rows={pending.map(([k, v]) => [CAP_LIST.find((c) => c.id === k)!.product, `${sel.modules[k as CapabilityId]} → ${v}`])} />
          <div style={{ marginTop: 12 }}>
            <Callout>
              Turning a module on from Off needs HexaShield commercial approval (quote generated automatically). Mode changes and switching off are approved by you as partner admin and recorded in the client's audit ledger.
            </Callout>
          </div>
        </Modal>
      )}
      {confirm === 'remove' && (
        <Modal
          title={`Remove ${sel.name}?`}
          sub="Risk class: high · needs HexaShield deal desk countersignature"
          onClose={() => setConfirm(null)}
          footer={<><Btn onClick={() => setConfirm(null)}>Cancel</Btn><Btn danger onClick={() => { toast(`Offboarding request for ${sel.short} sent to the deal desk: data export prepared, nothing deleted yet`); setConfirm(null); }}>Request offboarding</Btn></>}
        >
          <p className="secondary" style={{ fontSize: 12.5 }}>
            Offboarding exports the client's evidence, cases and audit ledger, revokes your delegated access and hands the tenant back to HexaShield or the client. Nothing is deleted for 90 days.
          </p>
        </Modal>
      )}
      {drawer && <ClientDrawer c={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}
