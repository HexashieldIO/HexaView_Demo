import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, RotateCcw, Send } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, BarRow, Btn, Callout, KV, Legend, SectionLabel, StatusBadge, Timeline } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import {
  CAP_LIST, MODE_COLOR, MOD_MODES, ONBOARDING_STEPS, TIERS, clientBook, onboardingProgress, provisioningQueue,
  type ModMode, type ProvRequest,
} from '../../data/modules/partner';
import type { CapabilityId, Tier } from '../../data/types';
import { fmtAgo } from '../../lib/format';
import { ClientAvatar, Field, PT_TONE, Seg, Steps, Toggle, money } from './parts';
import { arrFor } from '../../data/modules/partner';

const REQ_COLOR = { queued: 'var(--sev-info)', 'in-progress': 'var(--m-matrix)', 'awaiting-client': 'var(--sev-medium)', done: 'var(--good)', failed: 'var(--bad)' };
const SECTORS = ['Maritime', 'Financial Services', 'Media & Entertainment', 'Healthcare', 'Automotive', 'Utilities', 'Retail', 'Public sector', 'Legal', 'Life sciences', 'Logistics', 'Education'];
const PLACEMENTS: { id: string; label: string; minTier: Tier }[] = [
  { id: 'hosted', label: 'HexaShield-hosted (multi-tenant)', minTier: 'Essentials' },
  { id: 'azure', label: 'Customer Azure data plane', minTier: 'Professional' },
  { id: 'aws', label: 'Customer AWS data plane', minTier: 'Professional' },
  { id: 'k8s', label: 'On-prem Kubernetes', minTier: 'Professional' },
  { id: 'dedicated', label: 'Dedicated stamp + BYOK', minTier: 'Enterprise / CNI' },
  { id: 'airgap', label: 'Air-gapped (offline updates)', minTier: 'Enterprise / CNI' },
];
const TIER_RANK: Record<Tier, number> = { Essentials: 0, Professional: 1, 'Enterprise / CNI': 2 };

export default function PartnerProvisioning() {
  const [params, setParams] = useSearchParams();
  const { toast } = useApp();
  const nav = useNavigate();
  const book = useMemo(() => clientBook(), []);
  const queue = useMemo(() => provisioningQueue(), []);
  const [req, setReq] = useState<ProvRequest | null>(queue.find((r) => r.id === params.get('req')) ?? null);
  const [showNew, setShowNew] = useState(params.get('new') === '1');
  const focus = params.get('client');
  const clientOf = (id: string) => book.find((c) => c.id === id)!;

  const open = queue.filter((r) => r.status !== 'done');
  const onboarding = book.filter((c) => c.status === 'onboarding' || c.status === 'trial');
  const capped = book.filter((c) => c.integrationLimit !== null && c.integrations >= c.integrationLimit);

  // New client form
  const [nc, setNc] = useState({ name: '', sector: 'Utilities', tier: 'Professional' as Tier, placement: 'hosted', region: 'UK South', employees: 2500, sso: true });
  const [ncMods, setNcMods] = useState<Record<CapabilityId, ModMode>>({ soc: 'Fully managed', int: 'Off', strike: 'Off', ot: 'Off', comply: 'Co-managed', custody: 'Off' });
  const ncServices = CAP_LIST.flatMap((cap) => (ncMods[cap.id] === 'Off' ? [] : ncMods[cap.id] === 'Fully managed' ? cap.services : cap.services.slice(0, 1)));
  const ncArr = arrFor(nc.tier, ncServices, nc.employees, nc.tier === 'Essentials' ? 5 : 15);
  const closeNew = () => {
    setShowNew(false);
    const p = new URLSearchParams(params);
    p.delete('new');
    setParams(p, { replace: true });
  };

  return (
    <>
      <p className="page-intro">
        Tenants, modules, integrations and data planes for every client, provisioned from one place. Requests run through the HexaShield provisioning service; anything that changes commercials goes to the deal desk, everything else you approve as partner admin.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Open requests', value: open.length, onClick: () => setReq(open[0]), source: 'HexaShield provisioning service' },
          { label: 'Waiting on client', value: queue.filter((r) => r.status === 'awaiting-client').length, onClick: () => setReq(queue.find((r) => r.status === 'awaiting-client')!), source: 'Provisioning service · consent tracker' },
          { label: 'Blocked', value: queue.filter((r) => r.status === 'failed').length, hint: 'entitlement', onClick: () => setReq(queue.find((r) => r.status === 'failed')!), source: 'Entitlement service' },
          { label: 'Onboarding & trial', value: onboarding.length, to: '/partner/clients?status=onboarding', source: 'HexaView partner tenant registry' },
          { label: 'Median time to live', value: 11, unit: 'days', delta: { text: '−4 d vs FY26', good: true }, source: 'Provisioning service · go-live timestamps' },
          { label: 'At integration cap', value: capped.length, hint: 'upsell', to: '/partner-sales/quotes', source: 'Entitlement service' },
        ]}
      />

      <div className="row">
        <span className="secondary" style={{ fontSize: 12.5 }}>Provision a new client tenant in minutes: tier, placement, residency and modules.</span>
        <span className="spacer" />
        <Btn primary color={PT_TONE} onClick={() => setShowNew(true)}>
          <Plus /> Provision new client
        </Btn>
      </div>

      <Card title="Provisioning requests" count={queue.length} sub="Every change to a client tenant, with its step and who approves it" flush>
        <DataTable
          rows={queue}
          rowKey={(r) => r.id}
          onRowClick={setReq}
          columns={[
            { key: 'id', header: 'Request', sort: (r) => r.id, render: (r) => <><div className="t-main mono" style={{ fontSize: 11.5 }}>{r.id}</div><div className="t-sub">{fmtAgo(r.ageHours * 60)}</div></> },
            { key: 'client', header: 'Client', sort: (r) => clientOf(r.clientId).short, render: (r) => <div className="row" style={{ gap: 7 }}><ClientAvatar c={clientOf(r.clientId)} size={22} /><span className="t-main">{clientOf(r.clientId).short}</span></div> },
            { key: 'kind', header: 'Change', sort: (r) => r.kind, render: (r) => <><div className="t-main" style={{ fontWeight: 500 }}>{r.kind}</div><div className="t-sub" style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detail}</div></> },
            { key: 'steps', header: 'Progress', render: (r) => <div style={{ width: 200 }}><Steps compact steps={r.steps} step={r.status === 'done' ? r.steps.length : r.step} failed={r.status === 'failed'} /></div> },
            { key: 'appr', header: 'Approval', sort: (r) => r.approval, render: (r) => <span className="t-sub">{r.approval}</span> },
            { key: 'st', header: 'Status', sort: (r) => r.status, render: (r) => <StatusBadge value={r.status} map={REQ_COLOR} /> },
          ]}
        />
      </Card>

      <div className="grid g-3-2">
        <Card title="Entitlement matrix" sub="Every client × capability, by delivery model · click a cell to manage that client" toneColor={PT_TONE} actions={<Legend items={MOD_MODES.map((m) => ({ label: m, color: MODE_COLOR[m] }))} />}>
          <div className="pt-matrix" style={{ gridTemplateColumns: `150px repeat(${CAP_LIST.length}, 1fr)` }}>
            <span />
            {CAP_LIST.map((cap) => <span key={cap.id} className="pt-mh" style={{ color: cap.tone }}>{cap.product.replace('Hexa', '')}</span>)}
            {book.map((c) => (
              <div key={c.id} style={{ display: 'contents' }}>
                <span className="pt-mr" style={{ color: focus === c.id ? 'var(--m-partner)' : undefined }}>{c.short}</span>
                {CAP_LIST.map((cap) => {
                  const m = c.modules[cap.id];
                  return (
                    <button
                      key={cap.id}
                      className="pt-cell"
                      title={`${c.short} · ${cap.product}: ${m}`}
                      onClick={() => nav(`/partner/clients?client=${c.id}`)}
                      style={{ background: m === 'Off' ? 'var(--surface-sunken)' : `color-mix(in srgb, ${MODE_COLOR[m]} ${m === 'Fully managed' ? 70 : m === 'Co-managed' ? 55 : 30}%, transparent)`, color: m === 'Off' ? 'var(--text-muted)' : '#fff', outline: focus === c.id ? '1px solid var(--m-partner)' : undefined }}
                    >
                      {m === 'Off' ? '·' : m === 'Fully managed' ? 'FM' : m === 'Co-managed' ? 'CM' : 'ADV'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Onboarding tracker" count={onboarding.length} sub="New and trial clients to go-live">
            <div className="stack" style={{ gap: 16 }}>
              {onboarding.map((c) => (
                <button key={c.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '4px 0 12px' }} onClick={() => nav(`/partner/clients?client=${c.id}`)}>
                  <div className="row" style={{ gap: 8 }}>
                    <ClientAvatar c={c} size={24} />
                    <b style={{ fontSize: 12.5, flex: 1 }}>{c.name}</b>
                    <Badge color={c.status === 'trial' ? 'var(--sev-medium)' : 'var(--m-matrix)'}>{c.status === 'trial' ? `PoV · ${c.renewalDays} d left` : 'Onboarding'}</Badge>
                  </div>
                  <Steps steps={ONBOARDING_STEPS} step={onboardingProgress(c)} />
                  <span className="muted" style={{ fontSize: 11 }}>{c.topAction}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Integration capacity" sub="Connected vs. entitled · capped clients are upsell candidates">
            {book.filter((c) => c.integrationLimit !== null).map((c) => (
              <BarRow key={c.id} label={c.short} sub={c.tier} value={c.integrations} max={c.integrationLimit ?? 1} color={c.integrations >= (c.integrationLimit ?? 99) ? 'var(--bad)' : PT_TONE} display={`${c.integrations}/${c.integrationLimit}`} />
            ))}
            <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Enterprise / CNI clients have unlimited integrations and are not shown.</p>
          </Card>
        </div>
      </div>

      {req && (() => {
        const c = clientOf(req.clientId);
        const step = req.status === 'done' ? req.steps.length : req.step;
        return (
          <Drawer
            title={`${req.id} · ${req.kind}`}
            sub={`${c.name} · requested by ${req.requestedBy} ${fmtAgo(req.ageHours * 60)}`}
            icon={<ClientAvatar c={c} size={34} />}
            onClose={() => setReq(null)}
            footer={
              req.status === 'failed' ? <><Btn primary color={PT_TONE} onClick={() => { nav('/partner-sales/quotes'); }}>Quote an upgrade</Btn><Btn onClick={() => { toast(`${req.id} retried`); setReq(null); }}><RotateCcw /> Retry</Btn></>
                : req.status === 'awaiting-client' ? <Btn primary color={PT_TONE} onClick={() => { toast(`Reminder sent to ${c.short}'s admin for ${req.id}`); setReq(null); }}><Send /> Nudge client</Btn>
                : undefined
            }
          >
            <div style={{ margin: '4px 0 18px' }}><Steps steps={req.steps} step={step} failed={req.status === 'failed'} /></div>
            <KV rows={[['Change', req.detail], ['Status', <StatusBadge value={req.status} map={REQ_COLOR} />], ['Approval', req.approval], ['Client tier', c.tier], ['Integrations', `${c.integrations}${c.integrationLimit ? ` of ${c.integrationLimit}` : ' (unlimited)'}`], ['Data plane', c.deployment], ['Residency', c.residency]]} />
            <SectionLabel>History</SectionLabel>
            <Timeline items={req.steps.slice(0, Math.min(step + 1, req.steps.length)).map((s, i) => ({ time: fmtAgo(Math.max(1, req.ageHours - i * (req.ageHours / Math.max(1, step + 1))) * 60), title: s, body: i === step && req.status === 'failed' ? 'Blocked: Essentials includes 5 integrations; this would be the 6th.' : i === step ? 'Current step' : 'Completed', color: i === step && req.status === 'failed' ? 'var(--bad)' : i === step ? PT_TONE : 'var(--good)' }))} />
          </Drawer>
        );
      })()}

      {showNew && (
        <Modal
          title="Provision new client"
          sub="Creates the tenant, SSO and a data plane; modules switch on as soon as commercials clear"
          onClose={closeNew}
          footer={<><Btn onClick={closeNew}>Cancel</Btn><Btn primary color={PT_TONE} disabled={nc.name.trim().length < 2} onClick={() => { toast(`Tenant for ${nc.name} queued: ${nc.tier}, ${PLACEMENTS.find((p) => p.id === nc.placement)?.label}, ${nc.region}. Welcome email goes out under your brand.`); closeNew(); }}>Provision tenant</Btn></>}
        >
          <div className="pt-form">
            <Field label="Client name" full><input className="input" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="e.g. Brightwater Rail Freight" autoFocus /></Field>
            <Field label="Sector"><select className="select" value={nc.sector} onChange={(e) => setNc({ ...nc, sector: e.target.value })}>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Employees"><input className="input" type="number" value={nc.employees} onChange={(e) => setNc({ ...nc, employees: Number(e.target.value) || 0 })} /></Field>
            <Field label="Tier" full>
              <Seg options={TIERS.map((t) => ({ id: t.id, label: `${t.id} · ${money(t.listUsd)}` }))} value={nc.tier} onChange={(v) => setNc({ ...nc, tier: v, placement: TIER_RANK[PLACEMENTS.find((p) => p.id === nc.placement)!.minTier] > TIER_RANK[v] ? 'hosted' : nc.placement })} />
            </Field>
            <Field label="Data plane placement" hint="Air-gapped and dedicated stamps need Enterprise / CNI">
              <select className="select" value={nc.placement} onChange={(e) => setNc({ ...nc, placement: e.target.value })}>
                {PLACEMENTS.map((p) => <option key={p.id} value={p.id} disabled={TIER_RANK[p.minTier] > TIER_RANK[nc.tier]}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Residency / stamp">
              <select className="select" value={nc.region} onChange={(e) => setNc({ ...nc, region: e.target.value })}>{['UK South', 'EU Frankfurt', 'EU Paris', 'US East', 'US West', 'Middle East (UAE)'].map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <div className="pt-field full">
              <span className="pt-label">Modules and delivery model</span>
              {CAP_LIST.map((cap) => (
                <div key={cap.id} className="pt-sub-row" style={{ padding: '6px 0' }}>
                  <span className="dot" style={{ background: cap.tone }} />
                  <span className="pt-sub-main"><b>{cap.product}</b></span>
                  {ncMods[cap.id] !== 'Off' && (
                    <select className="select" style={{ height: 24, fontSize: 11 }} value={ncMods[cap.id]} onChange={(e) => setNcMods({ ...ncMods, [cap.id]: e.target.value as ModMode })}>
                      {MOD_MODES.filter((m) => m !== 'Off').map((m) => <option key={m}>{m}</option>)}
                    </select>
                  )}
                  <Toggle on={ncMods[cap.id] !== 'Off'} onChange={(v) => setNcMods({ ...ncMods, [cap.id]: v ? 'Co-managed' : 'Off' })} />
                </div>
              ))}
            </div>
            <div className="pt-field full">
              <div className="row"><Toggle on={nc.sso} onChange={(v) => setNc({ ...nc, sso: v })} /><span style={{ fontSize: 12.5 }}>Federate the client's own IdP (SAML / OIDC) and enforce MFA</span></div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Callout color={PT_TONE}>
              Indicative run rate <b>{money(ncArr)}</b>/yr at list for {ncServices.length} services. <button className="link" onClick={() => nav('/partner-sales/quotes')}>Build a full quote →</button>
            </Callout>
          </div>
        </Modal>
      )}
    </>
  );
}
