// Notification Centre feed: everything that wants the signed-in user's
// attention, assembled from the same sources the modules use so counts agree
// (Action Centre approvals, the attention queue, connector and data-plane
// health, audit deadlines, reports and insurance renewal).
import type { CustomerProfile, Persona, Severity } from './types';
import { attention } from './overview';
import { vrHeadline } from './modules/vulnresponse';
import { pendingActions, signedIn } from './modules/ops';
import { isStale } from './customers';
import { MODULE_BY_ID } from '../modules/registry';

export type NotifCategory = 'approval' | 'incident' | 'compliance' | 'intel' | 'system' | 'report';

export const CATEGORY_META: Record<NotifCategory, { label: string; color: string }> = {
  approval: { label: 'Approvals', color: '#f97316' },
  incident: { label: 'Incidents & alerts', color: '#f0466e' },
  compliance: { label: 'Compliance', color: '#93d65a' },
  intel: { label: 'Intelligence', color: '#ef6aae' },
  system: { label: 'Integrations & health', color: '#38bdf8' },
  report: { label: 'Reports & insurance', color: '#79a5f5' },
};

export interface Notif {
  id: string;
  cat: NotifCategory;
  sev: Severity;
  title: string;
  body: string;
  path: string;
  action: string;
  minAgo: number;
  tenant?: string;
  module: string;
}

const MODULE_CAT: Record<string, NotifCategory> = {
  soc: 'incident', ot: 'incident', custody: 'incident', strike: 'incident', ai: 'incident',
  int: 'intel', comply: 'compliance', loop: 'compliance', fabric: 'system', ops: 'approval',
};

export function notifications(c: CustomerProfile, tenantId: string, persona: Persona): Notif[] {
  const out: Notif[] = [];
  const me = signedIn(c, persona);

  for (const a of pendingActions(c, tenantId, me)) {
    const mine = a.requestedBy === me.name;
    out.push({
      id: `appr-${a.id}`,
      cat: 'approval',
      sev: a.risk === 'high' ? 'high' : a.risk === 'medium' ? 'medium' : 'low',
      title: mine ? `Your request is awaiting approval: ${a.title}` : `Approval needed: ${a.title}`,
      body: `${a.writeType} via ${a.connector.vendor === 'Generic' ? a.connector.product : `${a.connector.vendor} ${a.connector.product}`} · ${a.risk} risk · ${a.approvals.length}/${a.approvalsNeeded} approvals · expires in ${Math.max(1, Math.round(a.expiresInMin / 60))} h`,
      path: `/ops/actions?id=${a.id}`,
      action: mine ? 'View request' : 'Review & approve',
      minAgo: a.createdMinAgo,
      tenant: a.tenantId,
      module: 'ops',
    });
  }

  // Priority: live critical vulnerability response (HexaInt). Listed once, here, ahead of the attention queue copy.
  const vr = vrHeadline(c, tenantId);
  if (vr.affected) {
    out.push({
      id: `vuln-${vr.adv.id}`,
      cat: 'intel',
      sev: 'critical',
      title: `Critical vulnerability ${vr.adv.cve} (CVSS ${vr.adv.cvss.toFixed(1)}): ${vr.affected} assets affected, ${vr.patched} patched`,
      body: `${vr.adv.product}${vr.adv.exploited ? ', exploited in the wild' : ''}. ${vr.open} still exposed${vr.internetOpen ? ` (${vr.internetOpen} internet-facing)` : ''}; customers may ask for an exposure statement.`,
      path: '/int/vulnresponse',
      action: 'Open response',
      minAgo: vr.adv.publishedMinAgo,
      tenant: tenantId === 'all' ? vr.tenant : tenantId,
      module: 'int',
    });
  }

  for (const [i, a] of attention(c, tenantId).entries()) {
    if (a.module === 'ops') continue; // approvals are listed individually above
    if (a.path === '/int/vulnresponse') continue; // listed as a priority notification above
    out.push({
      id: `att-${i}-${a.module}`,
      cat: MODULE_CAT[a.module] ?? 'incident',
      sev: a.sev,
      title: a.title,
      body: a.detail,
      path: a.path,
      action: `Open ${MODULE_BY_ID[a.module]?.product ?? 'record'}`,
      minAgo: a.ageMin,
      tenant: a.tenant,
      module: a.module,
    });
  }

  for (const k of c.connectors) {
    if (tenantId !== 'all' && k.tenants !== 'all' && !k.tenants.includes(tenantId)) continue;
    if (k.status === 'healthy' && !isStale(k)) continue;
    const name = k.vendor === 'Generic' || k.vendor === 'HexaShield' ? k.product : `${k.vendor} ${k.product}`;
    out.push({
      id: `conn-${k.id}`,
      cat: 'system',
      sev: k.status === 'failing' ? 'high' : k.status === 'paused' ? 'low' : 'medium',
      title: `${name} is ${k.status === 'healthy' ? 'stale' : k.status}`,
      body: k.note ?? `Last successful sync ${k.lastSyncMin} min ago; tiles that depend on it are labelled stale.`,
      path: `/fabric/integrations?connector=${k.id}`,
      action: 'Open connector',
      minAgo: Math.min(k.lastSyncMin, 600),
      module: 'fabric',
    });
  }
  for (const d of c.dataPlanes) {
    if (d.status === 'healthy') continue;
    out.push({
      id: `dp-${d.id}`,
      cat: 'system',
      sev: 'medium',
      title: `Data plane degraded: ${d.name}`,
      body: d.note ?? `${d.placement}, ${d.region}; agent ${d.agentVersion}.`,
      path: `/fabric/dataplanes?plane=${d.id}`,
      action: 'Open data plane',
      minAgo: Math.round(d.heartbeatSecAgo / 60) + 5,
      module: 'fabric',
    });
  }

  for (const [i, f] of c.frameworks.filter((x) => x.nextAudit).slice(0, 3).entries()) {
    out.push({
      id: `fw-${f.id}`,
      cat: 'compliance',
      sev: i === 0 ? 'medium' : 'low',
      title: `${f.short}: ${f.nextAudit}`,
      body: `Documented ${f.documented}% · assured ${f.assured}%. Owner: ${f.owner}.`,
      path: `/comply/caas?framework=${f.id}`,
      action: 'Open framework',
      minAgo: 720 + i * 900,
      module: 'comply',
    });
  }

  out.push(
    {
      id: 'rep-board',
      cat: 'report',
      sev: 'info',
      title: 'Board pack draft is ready for your sign-off',
      body: `Drafted by the copilot from live data, every statement cited. Approver: ${c.people.ciso.name}.`,
      path: '/reports/library',
      action: 'Review draft',
      minAgo: 95,
      module: 'reports',
    },
    {
      id: 'rep-msr',
      cat: 'report',
      sev: 'info',
      title: 'Monthly service review issued',
      body: 'Signed (SHA-256) and delivered to the distribution list.',
      path: '/reports/history',
      action: 'Open report',
      minAgo: 1500,
      module: 'reports',
    },
    {
      id: 'ins-renewal',
      cat: 'report',
      sev: c.insurance.renewalDays < 60 ? 'medium' : 'low',
      title: `Cyber insurance renewal in ${c.insurance.renewalDays} days`,
      body: `${c.insurance.carrier} via ${c.insurance.broker}. The insurer evidence pack is up to date.`,
      path: '/insurance/policy',
      action: 'Open renewal',
      minAgo: 1440,
      module: 'insurance',
    },
  );

  const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return out.sort((a, b) => (a.cat === 'approval' ? -1 : 0) - (b.cat === 'approval' ? -1 : 0) || rank[a.sev] - rank[b.sev] || a.minAgo - b.minAgo);
}
