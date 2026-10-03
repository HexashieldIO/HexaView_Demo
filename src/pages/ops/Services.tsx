import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, ArrowRight, Briefcase, Crown } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { scopedTenants } from '../../data/customers';
import { SERVICES, CAPABILITIES, MODULE_BY_ID } from '../../modules/registry';
import { serviceUsage, LICENCE_TIERS } from '../../data/modules/ops';
import type { ServiceId, ServiceState } from '../../data/types';
import { Card, KpiStrip, Badge, Btn, Bar, Callout, StatusBadge, Ring } from '../../components/ui';
import { HexIcon } from '../../components/HexIcon';
import { Modal } from '../../components/Overlay';
import { fmtCompact, fmtNum } from '../../lib/format';
import { OPS_TONE, useParamFilter, FilterChip, HBars, scrollToId } from './parts';

const STATE_COLOR: Record<ServiceState | 'requested', string> = { active: 'var(--good)', trial: 'var(--sev-medium)', available: 'var(--sev-info)', requested: 'var(--m-core)' };

export default function Services() {
  const { customer } = useApp();
  return <ServicesInner key={customer.id} />;
}

function ServicesInner() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const nav = useNavigate();
  const days = rangeDays(timeRange);
  const tenants = scopedTenants(c, tenantId);
  const [requested, setRequested] = useState<Set<ServiceId>>(new Set());
  const [attach, setAttach] = useState<ServiceId | null>(null);
  const [stateF, setStateF] = useParamFilter('state');
  const pivotState = (st: string | null) => {
    setStateF(st);
    scrollToId('ops-svcs');
  };
  const svcSrc = 'HexaShield service catalogue · contract register';

  const stateOf = (id: ServiceId): ServiceState | 'requested' => (requested.has(id) ? 'requested' : c.services[id]);
  const count = (s: ServiceState) => SERVICES.filter((x) => c.services[x.id] === s).length;
  const quarterFrac = Math.min(1, days / 90);
  const attachSvc = SERVICES.find((s) => s.id === attach);

  const capUse = CAPABILITIES.map((cap) => {
    const svcs = SERVICES.filter((s) => s.capability === cap.id);
    const active = svcs.filter((s) => c.services[s.id] !== 'available').length;
    return { cap, active, total: svcs.length };
  });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''} on HexaView <b>{c.tier}</b>: the 20 HexaShield managed services across six capabilities, what you run today, what you are trialling, and consumption this quarter. Every service reads from and writes to the same HexaCore model.
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Active services', value: count('active'), unit: 'of 20', bar: (count('active') / 20) * 100, onClick: () => pivotState('active'), source: svcSrc },
          { label: 'In trial', value: count('trial'), toneColor: 'var(--sev-medium)', onClick: () => pivotState('trial'), source: svcSrc },
          { label: 'Available', value: count('available') - requested.size, unit: requested.size ? `${requested.size} requested` : 'to attach', onClick: () => pivotState('available'), source: svcSrc },
          { label: 'Licence', value: c.tier.split(' ')[0], unit: c.tier.includes('CNI') ? '/ CNI' : '', onClick: () => scrollToId('ops-tiers'), source: 'HexaView order form' },
          { label: 'Integrations', value: c.connectors.length, unit: c.integrationLimit ? `of ${c.integrationLimit}` : 'unlimited', bar: c.integrationLimit ? (c.connectors.length / c.integrationLimit) * 100 : undefined, to: '/fabric/integrations', source: 'HexaCore connector registry' },
          { label: 'Capabilities', value: capUse.filter((x) => x.active > 0).length, unit: 'of 6 in use', onClick: () => scrollToId('ops-cov'), source: svcSrc },
        ]}
      />

      {stateF && (
        <div className="row" style={{ gap: 8, margin: '-4px 0' }}>
          <span className="muted" style={{ fontSize: 12 }}>Showing services that are</span>
          <FilterChip label={stateF} onClear={() => setStateF(null)} />
        </div>
      )}
      <div id="ops-svcs" className="grid g3" style={{ scrollMarginTop: 80 }}>
        {CAPABILITIES.map((cap) => {
          const m = MODULE_BY_ID[cap.moduleId];
          const svcs = SERVICES.filter((s) => s.capability === cap.id);
          return (
            <Card key={cap.id} toneColor={m.tone} tinted title={<><HexIcon mod={m} size={22} /> {cap.product}</>} sub={cap.name}>
              <div className="stack" style={{ gap: 8 }}>
                {svcs.map((s) => {
                  const st = stateOf(s.id);
                  const u = serviceUsage(c, tenantId, s.id);
                  const usedInRange = Math.round(u.used * (u.allowance && u.unit.startsWith('%') ? 1 : quarterFrac));
                  return (
                    <div key={s.id} className={`ops-svc ${st === 'available' ? 'available' : ''}`} style={{ '--tone': m.tone, opacity: stateF && st !== stateF ? 0.32 : 1 } as CSSProperties}>
                      <div className="row" style={{ gap: 8 }}>
                        <b style={{ fontSize: 12.5, flex: 1 }}>{s.name}</b>
                        <StatusBadge value={st} map={STATE_COLOR} />
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>{s.sla}</div>
                      {st === 'active' || st === 'trial' ? (
                        <>
                          <div className="row" style={{ gap: 8, fontSize: 11.5 }}>
                            <button type="button" className="cc-link num" style={{ fontWeight: 700 }} onClick={() => nav(s.path)} title={`Source: ${cap.product} · click to open`}>{fmtCompact(u.used)}</button>
                            <span className="muted">{u.unit}{u.allowance ? ` of ${fmtNum(u.allowance)}` : ''} this quarter</span>
                            <span className="spacer" />
                            <button className="link" style={{ '--tone': m.tone } as CSSProperties} onClick={() => nav(s.path)}>Open <ArrowRight size={11} /></button>
                          </div>
                          {u.allowance ? <Bar value={u.used} max={u.allowance} color={u.used / u.allowance > 0.85 ? 'var(--sev-medium)' : m.tone} size="thin" /> : null}
                          <span className="muted" style={{ fontSize: 10.5 }}>{fmtCompact(usedInRange)} in {rangeLabel(timeRange).toLowerCase()}</span>
                        </>
                      ) : st === 'requested' ? (
                        <span className="muted" style={{ fontSize: 11.5 }}>Request sent to your account team; trial can start within 2 working days.</span>
                      ) : (
                        <div className="row" style={{ gap: 8 }}>
                          <span className="muted" style={{ fontSize: 11.5, flex: 1 }}>{s.blurb}</span>
                          <Btn sm color={m.tone} onClick={() => setAttach(s.id)}><Plus size={12} /> Attach to licence</Btn>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <div id="ops-tiers" style={{ scrollMarginTop: 80 }} />
      <Card title="HexaView licence tiers" sub={`You are on ${c.tier}. Indicative list prices; managed services are licensed separately.`} actions={<Badge color={OPS_TONE}><Crown size={11} /> {c.tier}</Badge>}>
        <div className="grid g3">
          {LICENCE_TIERS.map((t) => {
            const on = t.tier === c.tier;
            return (
              <div key={t.tier} className={`ops-tier ${on ? 'on' : ''}`}>
                <div className="row" style={{ gap: 8 }}>
                  <h4 style={{ flex: 1 }}>{t.tier}</h4>
                  {on && <Badge color={OPS_TONE} solid>Your plan</Badge>}
                </div>
                <div className="kpi-value" style={{ fontSize: 20 }}>{t.price}</div>
                <ul>
                  {t.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                {!on && LICENCE_TIERS.findIndex((x) => x.tier === t.tier) > LICENCE_TIERS.findIndex((x) => x.tier === c.tier) && (
                  <Btn sm primary color={OPS_TONE} onClick={() => toast(`Upgrade enquiry for ${t.tier} sent to your HexaShield account team`)}>Talk to us about {t.tier}</Btn>
                )}
              </div>
            );
          })}
        </div>
        {c.integrationLimit && (
          <div style={{ marginTop: 12 }}>
            <Callout kind="warn">
              {c.short} uses <b>{c.connectors.length} of {c.integrationLimit}</b> integrations on {c.tier}. Enterprise / CNI unlocks unlimited integrations, BYOK and customer-hosted data planes.
            </Callout>
          </div>
        )}
      </Card>

      <div className="grid g-2-1">
        <Card title="Professional services" sub="Typically 30–40% of first-year licence" actions={<Briefcase size={16} style={{ color: OPS_TONE }} />}>
          <div className="grid g2">
            {[
              ['Connector onboarding', 'Credentials, scopes and data-plane placement for each tool; read first, write-back enabled per action type.'],
              ['Model & data mapping', 'Map fields into the canonical model, resolve entities across tools, tune drift alerts.'],
              ['Dashboards & data viz', 'Role-based views for board, SOC, GRC and OT, using your own vocabulary.'],
              ['Validation & handover', 'HexaStrike validation of every loop, runbooks, admin training and sign-off.'],
            ].map(([t, d], i) => (
              <div key={t} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Ring value={(i + 1) * 25} size={34} stroke={4} color={OPS_TONE}>{i + 1}</Ring>
                <span style={{ fontSize: 12.5 }}>
                  <b>{t}</b>
                  <div className="muted" style={{ fontSize: 11.5 }}>{d}</div>
                </span>
              </div>
            ))}
          </div>
          <div className="card-foot">
            <span>Typical engagement 6–10 weeks · fixed-price statements of work</span>
            <span className="spacer" />
            <Btn sm onClick={() => toast('Scoping call requested with HexaShield professional services')}>Request scoping</Btn>
          </div>
        </Card>
        <div id="ops-cov" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Coverage by capability" sub="Services active or in trial · click to open the capability">
          <HBars
            labelWidth={120}
            max={1}
            items={capUse.map((x) => {
              const m = MODULE_BY_ID[x.cap.moduleId];
              return { key: x.cap.id, label: x.cap.product, sub: x.cap.name, value: x.active / Math.max(1, x.total), display: `${x.active}/${x.total}`, color: m.tone, onClick: () => nav(m.basePath) };
            })}
          />
        </Card>
        </div>
      </div>

      {attachSvc && (
        <Modal
          title={`Attach ${attachSvc.name}`}
          sub={`${CAPABILITIES.find((x) => x.id === attachSvc.capability)?.product} · ${c.tier}`}
          onClose={() => setAttach(null)}
          footer={
            <>
              <Btn onClick={() => setAttach(null)}>Cancel</Btn>
              <Btn primary color={OPS_TONE} onClick={() => { setRequested((s) => new Set(s).add(attachSvc.id)); toast(`${attachSvc.name} requested: your account team will confirm pricing and start a 30-day trial`); setAttach(null); }}>
                <Check size={14} /> Request attachment
              </Btn>
            </>
          }
        >
          <div className="stack" style={{ gap: 10, fontSize: 12.5 }}>
            <div>{attachSvc.blurb}</div>
            <div><b>SLA:</b> {attachSvc.sla}</div>
            <Callout kind="info">Attachment is a commercial request, not a platform change. A Tenant Admin confirms the order; data starts flowing into the existing HexaCore model with no new integration.</Callout>
          </div>
        </Modal>
      )}
    </>
  );
}
