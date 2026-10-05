import type { CSSProperties, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { MODULE_BY_ID, SERVICE_BY_ID } from '../modules/registry';
import { useApp } from '../state/AppContext';
import { HexIcon } from './HexIcon';
import { Badge, Btn, Callout, Ring } from './ui';
import { scopedTenants } from '../data/customers';
import { TabRail } from './TabRail';

/**
 * Module header band (icon, title, tagline, score ring) with tab navigation,
 * matching the v2 demo. Tabs are links to `${basePath}/${tab}`.
 */
export function ModuleLayout({ moduleId, tabId, children, scoreOverride }: { moduleId: string; tabId?: string; children: ReactNode; scoreOverride?: number }) {
  const mod = MODULE_BY_ID[moduleId];
  const { customer, tenantId, toast } = useApp();
  const tab = mod.tabs.find((t) => t.id === tabId);
  const svc = tab?.service ? SERVICE_BY_ID[tab.service] : undefined;
  const svcState = tab?.service ? customer.services[tab.service] : undefined;
  let score = scoreOverride ?? (mod.scoreKey ? customer.scores[mod.scoreKey] : undefined);
  // A single tenant nudges the score toward its own Resilience Index so tenants differ.
  if (score !== undefined && tenantId !== 'all' && scoreOverride === undefined) {
    const t = scopedTenants(customer, tenantId)[0];
    if (t) score = Math.round(score * 0.6 + t.ri * 0.4);
  }

  return (
    <>
      <div className="mod-head" style={{ '--tone': mod.tone } as CSSProperties}>
        <div className="mod-head-top">
          <div className="mod-ico">
            <HexIcon mod={mod} size={44} />
          </div>
          <div className="mod-title">
            <h2>
              {mod.title}
              <small>
                {mod.product}
                {mod.product.startsWith('Hexa') ? '™' : ''}
              </small>
              {mod.isNew && <Badge color={mod.tone}>New module</Badge>}
            </h2>
            <p>{mod.tagline}</p>
          </div>
          {score !== undefined && (
            <div className="mod-score">
              <div className="mod-score-label">
                {mod.scoreLabel}
                <span>out of 100</span>
              </div>
              <Ring value={score} size={46} stroke={5} color={mod.tone} />
            </div>
          )}
        </div>
        {mod.tabs.length > 0 && (
          <TabRail label={`${mod.product} sections`}>
            {mod.tabs.map((t) => {
              const st = t.service ? customer.services[t.service] : undefined;
              return (
                <NavLink key={t.id} to={`${mod.basePath}/${t.id}`} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {t.label}
                  {st === 'trial' && <span className="svc-tag">Trial</span>}
                  {st === 'available' && <Lock size={11} style={{ opacity: 0.55 }} />}
                </NavLink>
              );
            })}
          </TabRail>
        )}
      </div>
      {svc && svcState !== 'active' && (
        <Callout kind={svcState === 'trial' ? 'info' : 'warn'} color={svcState === 'trial' ? mod.tone : undefined}>
          {svcState === 'trial' ? (
            <>
              <b>{svc.name} is on a 30-day trial</b> for {customer.short}. Everything below is live from your connected tools; the trial converts to your HexaView licence with one click.
            </>
          ) : (
            <>
              <b>{svc.name} is not in {customer.short}&rsquo;s subscription.</b> You are looking at a preview built from your own connected data. Attach it to your HexaView licence and HexaShield runs it for you, feeding the same single pane.{' '}
              <span style={{ display: 'inline-flex', marginLeft: 6 }}>
                <Btn sm primary color={mod.tone} onClick={() => toast(`Request sent: ${svc.name} quote for ${customer.short}`)}>
                  Request this service
                </Btn>
              </span>
            </>
          )}
        </Callout>
      )}
      {children}
    </>
  );
}
