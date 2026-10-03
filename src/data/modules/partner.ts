// Partner / MSSP data: Northwind Cyber Partners, a fictional HexaShield
// Platinum MSSP whose client book is the five demo customers plus a set of
// smaller generated clients. Everything here is partner-side (USD), stable
// across reloads (seeded) and independent of the selected customer.

import type { CapabilityId, CustomerId, ServiceId, Tier } from '../types';
import { CUSTOMER_LIST } from '../customers';
import { headlines, resilienceIndex, riTrend, riDrivers } from '../core';
import { rng } from '../../lib/rng';

/* =====================================================================
   The partner
   ===================================================================== */
export const PARTNER = {
  name: 'Northwind Cyber Partners',
  short: 'Northwind',
  initials: 'NW',
  partnerId: 'HXP-0417',
  level: 'Platinum MSSP',
  hq: 'Manchester, United Kingdom',
  regions: ['UK & Ireland', 'EU (Frankfurt stamp)', 'North America'],
  since: 'March 2023',
  socs: ['Manchester (24/7)', 'Austin (follow-the-sun)'],
  channelManager: { name: 'Sam Whitfield', role: 'HexaShield Channel Account Manager', email: 'sam.whitfield@hexashield.io' },
  partnerSe: { name: 'Nadia Kerr', role: 'HexaShield Partner Solutions Engineer', email: 'nadia.kerr@hexashield.io' },
  dealDesk: 'dealdesk@hexashield.io',
  fiscalYear: 'FY27',
  /** Partner buy discounts off HexaShield list. */
  discount: { licence: 30, services: 25, dealReg: 5, referralFee: 10 },
  mdfAllocation: 120000,
};

export interface PartnerPerson {
  id: string;
  name: string;
  role: string;
  team: 'Leadership' | 'Sales' | 'Pre-sales' | 'SOC' | 'OT' | 'GRC' | 'Customer success' | 'Marketing' | 'Platform';
  email: string;
}
const P = (name: string, role: string, team: PartnerPerson['team']): PartnerPerson => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name, role, team,
  email: `${name.split(' ')[0].toLowerCase()}.${name.split(' ').slice(-1)[0].toLowerCase().replace(/[^a-z]/g, '')}@northwindcyber.com`,
});
export const STAFF: PartnerPerson[] = [
  P('Priya Raman', 'Managing Director', 'Leadership'),
  P('Tom Ellery', 'Head of Sales', 'Sales'),
  P('Grace Okafor', 'Account Executive, Regulated', 'Sales'),
  P('Daniel Moretti', 'Account Executive, Industrial', 'Sales'),
  P('Hannah Lindqvist', 'Solutions Architect', 'Pre-sales'),
  P('Kwame Asante', 'Solutions Engineer', 'Pre-sales'),
  P('Marcus Chen', 'SOC Lead', 'SOC'),
  P('Aisha Bello', 'SOC Analyst L2', 'SOC'),
  P("Liam O'Connor", 'SOC Analyst L1', 'SOC'),
  P('Sofia Herrera', 'OT Security Engineer', 'OT'),
  P('Owen Price', 'GRC Consultant', 'GRC'),
  P('Freya Watts', 'Customer Success Manager', 'Customer success'),
  P('Ravi Patel', 'Customer Success Manager', 'Customer success'),
  P('Elena Novak', 'Partner Marketing Manager', 'Marketing'),
  P('Jack Turner', 'Platform Engineer', 'Platform'),
];

/* =====================================================================
   Pricing (HexaView tiers, the twenty services, professional services)
   ===================================================================== */
export const TIERS: { id: Tier; listUsd: number; integrations: number | null; blurb: string; features: string[] }[] = [
  { id: 'Essentials', listUsd: 22500, integrations: 5, blurb: 'Single pane over the core stack', features: ['Up to 5 integrations', 'Command Centre & Resilience Index', 'Read-only connectors', 'HexaShield-hosted, multi-tenant', 'Standard reports'] },
  { id: 'Professional', listUsd: 81000, integrations: 20, blurb: 'Bidirectional, AI-assisted operations', features: ['~20 integrations', 'HexaAI copilot (cited)', 'Gated write-back to tools', 'Closed-loop assurance', 'Customer-hosted data plane option'] },
  { id: 'Enterprise / CNI', listUsd: 225000, integrations: null, blurb: 'Sovereign, regulated and critical infrastructure', features: ['Unlimited integrations', 'BYOK and dedicated stamp', 'Customer-hosted or air-gapped', 'OT edge and store-and-forward', 'Regulator & insurer packs'] },
];
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<Tier, (typeof TIERS)[number]>;

/** Annual list price of each managed service at the 1k–5k employee band (USD). */
export const SERVICE_LIST_USD: Record<ServiceId, number> = {
  mdr: 96000, hunting: 36000, ir: 42000, forensics: 18000, 'detection-eng': 30000, 'attack-coverage': 14000,
  darkweb: 24000, osint: 20000, exposure: 16000,
  pentest: 28000, redteam: 85000, purpleteam: 48000, asm: 22000,
  'ot-visibility': 54000, 'ot-vuln': 32000, 'ot-pentest': 46000,
  caas: 40000, tprm: 26000, 'ai-gov': 24000,
  custody: 38000,
};
export const SIZE_BANDS = [
  { id: 's', label: '< 1,000 staff', factor: 0.6, max: 1000 },
  { id: 'm', label: '1,000–5,000', factor: 1, max: 5000 },
  { id: 'l', label: '5,000–20,000', factor: 1.6, max: 20000 },
  { id: 'xl', label: '20,000+', factor: 2.4, max: Infinity },
] as const;
export type SizeBand = (typeof SIZE_BANDS)[number]['id'];
export function bandFor(employees: number): SizeBand {
  return SIZE_BANDS.find((b) => employees < b.max)?.id ?? 'xl';
}
export const EXTRA_INTEGRATION_USD = 2400;

export interface QuoteInput {
  tier: Tier;
  band: SizeBand;
  integrations: number;
  services: ServiceId[];
  psPct: number;
  termYears: 1 | 3;
  customerDiscountPct: number;
  dealRegistered: boolean;
}
export interface QuoteLine {
  label: string;
  kind: 'licence' | 'service' | 'ps';
  list: number;
  sell: number;
  cost: number;
}
export interface QuoteResult {
  lines: QuoteLine[];
  listY1: number;
  sellY1: number;
  costY1: number;
  marginY1: number;
  marginPct: number;
  tcv: number;
  licenceList: number;
  servicesList: number;
  psList: number;
  partnerDiscountLicence: number;
  partnerDiscountServices: number;
}
export function priceQuote(q: QuoteInput): QuoteResult {
  const t = TIER_BY_ID[q.tier];
  const f = SIZE_BANDS.find((b) => b.id === q.band)!.factor;
  const extra = t.integrations === null ? 0 : Math.max(0, q.integrations - t.integrations);
  const termF = q.termYears === 3 ? 0.93 : 1;
  const cd = q.customerDiscountPct / 100;
  const dLic = (PARTNER.discount.licence + (q.dealRegistered ? PARTNER.discount.dealReg : 0)) / 100;
  const dSvc = (PARTNER.discount.services + (q.dealRegistered ? PARTNER.discount.dealReg : 0)) / 100;
  const lines: QuoteLine[] = [];
  const lic = t.listUsd * termF;
  lines.push({ label: `HexaView ${q.tier} platform licence`, kind: 'licence', list: lic, sell: lic * (1 - cd), cost: lic * (1 - dLic) });
  if (extra) {
    const v = extra * EXTRA_INTEGRATION_USD * termF;
    lines.push({ label: `${extra} additional integration${extra > 1 ? 's' : ''}`, kind: 'licence', list: v, sell: v * (1 - cd), cost: v * (1 - dLic) });
  }
  for (const s of q.services) {
    const v = SERVICE_LIST_USD[s] * f * termF;
    lines.push({ label: s, kind: 'service', list: v, sell: v * (1 - cd), cost: v * (1 - dSvc) });
  }
  const licenceList = lines.filter((l) => l.kind === 'licence').reduce((s, l) => s + l.list, 0);
  const psList = licenceList * (q.psPct / 100);
  // Professional services are delivered by the partner: sold at list less customer discount, cost is partner labour (~55%).
  lines.push({ label: `Professional services (onboarding, ${q.psPct}% of first-year licence)`, kind: 'ps', list: psList, sell: psList * (1 - cd), cost: psList * 0.55 });
  const listY1 = lines.reduce((s, l) => s + l.list, 0);
  const sellY1 = lines.reduce((s, l) => s + l.sell, 0);
  const costY1 = lines.reduce((s, l) => s + l.cost, 0);
  const recurringSell = lines.filter((l) => l.kind !== 'ps').reduce((s, l) => s + l.sell, 0);
  return {
    lines, listY1, sellY1, costY1, marginY1: sellY1 - costY1, marginPct: sellY1 ? ((sellY1 - costY1) / sellY1) * 100 : 0,
    tcv: sellY1 + recurringSell * (q.termYears - 1),
    licenceList, servicesList: lines.filter((l) => l.kind === 'service').reduce((s, l) => s + l.list, 0), psList,
    partnerDiscountLicence: dLic * 100, partnerDiscountServices: dSvc * 100,
  };
}

/* =====================================================================
   Client book
   ===================================================================== */
export type ModMode = 'Fully managed' | 'Co-managed' | 'Advisory' | 'Off';
export const MOD_MODES: ModMode[] = ['Fully managed', 'Co-managed', 'Advisory', 'Off'];
export const MODE_COLOR: Record<ModMode, string> = { 'Fully managed': 'var(--m-partner)', 'Co-managed': 'var(--m-matrix)', Advisory: 'var(--sev-info)', Off: 'var(--neutral-fill)' };
export type ClientStatus = 'active' | 'onboarding' | 'at-risk' | 'trial';
export const STATUS_COLOR: Record<ClientStatus, string> = { active: 'var(--good)', onboarding: 'var(--m-matrix)', 'at-risk': 'var(--bad)', trial: 'var(--sev-medium)' };
export const STATUS_LABEL: Record<ClientStatus, string> = { active: 'Active', onboarding: 'Onboarding', 'at-risk': 'At risk', trial: 'Trial' };
export const CAP_LIST: { id: CapabilityId; product: string; tone: string; services: ServiceId[] }[] = [
  { id: 'soc', product: 'HexaSOC', tone: 'var(--m-soc)', services: ['mdr', 'hunting', 'ir', 'forensics', 'detection-eng', 'attack-coverage'] },
  { id: 'int', product: 'HexaInt', tone: 'var(--m-int)', services: ['darkweb', 'osint', 'exposure'] },
  { id: 'strike', product: 'HexaStrike', tone: 'var(--m-strike)', services: ['pentest', 'redteam', 'purpleteam', 'asm'] },
  { id: 'ot', product: 'HexaOT', tone: 'var(--m-ot)', services: ['ot-visibility', 'ot-vuln', 'ot-pentest'] },
  { id: 'comply', product: 'HexaComply', tone: 'var(--m-comply)', services: ['caas', 'tprm', 'ai-gov'] },
  { id: 'custody', product: 'HexaCustody', tone: 'var(--m-custody)', services: ['custody'] },
];
export const CAP_BY_ID = Object.fromEntries(CAP_LIST.map((c) => [c.id, c])) as Record<CapabilityId, (typeof CAP_LIST)[number]>;

export interface PartnerClient {
  id: string;
  demoId?: CustomerId;
  name: string;
  short: string;
  initials: string;
  colour: string;
  sector: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  tier: Tier;
  status: ClientStatus;
  modules: Record<CapabilityId, ModMode>;
  services: ServiceId[];
  integrations: number;
  integrationLimit: number | null;
  healthyIntegrations: number;
  ri: number;
  riTrend: number[];
  openIncidents: number;
  critical: number;
  health: number;
  healthNotes: string[];
  topAction: string;
  renewalDays: number;
  arrUsd: number;
  sinceMonths: number;
  employees: number;
  csm: string;
  owner: string;
  deployment: string;
  residency: string;
  eventsPerDay: number;
  copilotTokensM: number;
  users: number;
  tenants: number;
  frameworks: string[];
}

function modesFromServices(active: ServiceId[], trial: ServiceId[]): Record<CapabilityId, ModMode> {
  const out = {} as Record<CapabilityId, ModMode>;
  for (const cap of CAP_LIST) {
    const a = cap.services.filter((s) => active.includes(s)).length;
    const t = cap.services.filter((s) => trial.includes(s)).length;
    out[cap.id] = a / cap.services.length >= 0.75 ? 'Fully managed' : a > 0 ? 'Co-managed' : t > 0 ? 'Advisory' : 'Off';
  }
  return out;
}
export function arrFor(tier: Tier, services: ServiceId[], employees: number, integrations: number): number {
  const t = TIER_BY_ID[tier];
  const f = SIZE_BANDS.find((b) => b.id === bandFor(employees))!.factor;
  const extra = t.integrations === null ? 0 : Math.max(0, integrations - t.integrations);
  return Math.round((t.listUsd + extra * EXTRA_INTEGRATION_USD + services.reduce((s, x) => s + SERVICE_LIST_USD[x] * f, 0)) / 100) * 100;
}

const DEMO_EXTRA: Record<CustomerId, { city: string; country: string; lat: number; lon: number; renewalDays: number; sinceMonths: number; csm: string; owner: string; status: ClientStatus }> = {
  maritime: { city: 'Rotterdam', country: 'NL', lat: 51.92, lon: 4.48, renewalDays: 142, sinceMonths: 31, csm: 'Freya Watts', owner: 'Daniel Moretti', status: 'active' },
  finserv: { city: 'London', country: 'GB', lat: 51.51, lon: -0.09, renewalDays: 268, sinceMonths: 27, csm: 'Ravi Patel', owner: 'Grace Okafor', status: 'active' },
  media: { city: 'Burbank', country: 'US', lat: 34.18, lon: -118.31, renewalDays: 47, sinceMonths: 19, csm: 'Freya Watts', owner: 'Grace Okafor', status: 'at-risk' },
  healthcare: { city: 'Columbus', country: 'US', lat: 39.96, lon: -83.0, renewalDays: 201, sinceMonths: 14, csm: 'Ravi Patel', owner: 'Grace Okafor', status: 'active' },
  automotive: { city: 'Munich', country: 'DE', lat: 48.14, lon: 11.58, renewalDays: 318, sinceMonths: 6, csm: 'Freya Watts', owner: 'Daniel Moretti', status: 'active' },
};

interface SmallSeed {
  name: string; short: string; sector: string; city: string; country: string; lat: number; lon: number; colour: string;
  tier: Tier; status: ClientStatus; employees: number; services: ServiceId[]; trial?: ServiceId[]; frameworks: string[]; issue: string;
  deployment: string; residency: string;
}
const SMALL: SmallSeed[] = [
  { name: 'Brackenfield Water', short: 'Brackenfield', sector: 'Water utility', city: 'Leeds', country: 'GB', lat: 53.8, lon: -1.55, colour: '#0284c7', tier: 'Professional', status: 'active', employees: 2300, services: ['mdr', 'ir', 'ot-visibility', 'ot-vuln', 'caas'], frameworks: ['NIS (UK)', 'CAF', 'IEC 62443'], issue: 'Two telemetry outstations still on default vendor credentials (CAF B2.a)', deployment: 'HexaShield-hosted + OT edge', residency: 'UK South' },
  { name: 'Ostara Logistics', short: 'Ostara', sector: 'Logistics', city: 'Hamburg', country: 'DE', lat: 53.55, lon: 9.99, colour: '#7c3aed', tier: 'Professional', status: 'active', employees: 3900, services: ['mdr', 'hunting', 'exposure', 'asm', 'tprm'], frameworks: ['NIS2', 'ISO 27001', 'TISAX'], issue: 'Warehouse WMS vendor VPN without MFA, flagged by ASM', deployment: 'Customer Azure data plane', residency: 'EU Frankfurt' },
  { name: 'Pemberton Law LLP', short: 'Pemberton', sector: 'Legal', city: 'London', country: 'GB', lat: 51.52, lon: -0.11, colour: '#9f1239', tier: 'Essentials', status: 'active', employees: 640, services: ['mdr', 'darkweb', 'exposure'], frameworks: ['Cyber Essentials Plus', 'ISO 27001'], issue: '14 partner credentials in a stealer log from a personal device', deployment: 'HexaShield-hosted', residency: 'UK South' },
  { name: 'Calder Valley Schools Trust', short: 'Calder Valley', sector: 'Education', city: 'Halifax', country: 'GB', lat: 53.72, lon: -1.86, colour: '#15803d', tier: 'Essentials', status: 'onboarding', employees: 1450, services: ['mdr', 'caas'], frameworks: ['DfE standards', 'Cyber Essentials'], issue: 'Onboarding: Google Workspace and Sophos connectors pending consent', deployment: 'HexaShield-hosted', residency: 'UK South' },
  { name: 'Lumen Biotherapeutics', short: 'Lumen Bio', sector: 'Life sciences', city: 'Cambridge', country: 'US', lat: 42.37, lon: -71.11, colour: '#0891b2', tier: 'Professional', status: 'active', employees: 1800, services: ['mdr', 'ir', 'pentest', 'caas', 'ai-gov', 'custody'], frameworks: ['FDA 21 CFR Part 11', 'SOC 2', 'ISO 42001'], issue: 'Trial-data custody: 1 untracked copy at a CRO in the last 7 days', deployment: 'Customer AWS data plane', residency: 'US East' },
  { name: 'Saltmarsh Energy', short: 'Saltmarsh', sector: 'Energy', city: 'Aberdeen', country: 'GB', lat: 57.15, lon: -2.09, colour: '#ca8a04', tier: 'Enterprise / CNI', status: 'active', employees: 5600, services: ['mdr', 'hunting', 'ir', 'ot-visibility', 'ot-vuln', 'ot-pentest', 'caas', 'tprm'], frameworks: ['NIS (UK)', 'CAF', 'IEC 62443', 'ISO 27019'], issue: 'Offshore platform historian unreachable for 3 days (VSAT store-and-forward)', deployment: 'Customer-hosted + offshore edge', residency: 'UK South' },
  { name: 'Greyfriars Retail', short: 'Greyfriars', sector: 'Retail', city: 'Edinburgh', country: 'GB', lat: 55.95, lon: -3.19, colour: '#db2777', tier: 'Professional', status: 'at-risk', employees: 8200, services: ['mdr', 'pentest', 'asm', 'darkweb'], trial: ['caas'], frameworks: ['PCI DSS 4.0', 'ISO 27001'], issue: 'Renewal in 38 days; SLA miss on a P1 in August still unresolved with the client', deployment: 'HexaShield-hosted', residency: 'UK South' },
  { name: 'Tamsin Aerospace Components', short: 'Tamsin Aero', sector: 'Aerospace', city: 'Toulouse', country: 'FR', lat: 43.6, lon: 1.44, colour: '#475569', tier: 'Professional', status: 'trial', employees: 2700, services: ['ot-visibility'], trial: ['mdr', 'tprm'], frameworks: ['CMMC L2', 'NIS2', 'EN 9100'], issue: 'Proof of value ends in 12 days: 2 success criteria still open', deployment: 'Customer-hosted (on-prem Kubernetes)', residency: 'EU Paris' },
  { name: 'Kingsmere Housing Group', short: 'Kingsmere', sector: 'Public sector', city: 'Birmingham', country: 'GB', lat: 52.49, lon: -1.89, colour: '#ea580c', tier: 'Essentials', status: 'active', employees: 1100, services: ['mdr', 'exposure'], frameworks: ['Cyber Essentials Plus', 'PSN'], issue: 'Integration cap reached (5 of 5): CrowdStrike connector queued', deployment: 'HexaShield-hosted', residency: 'UK South' },
  { name: 'Harbour & Vale Insurance', short: 'Harbour & Vale', sector: 'Insurance', city: 'Bristol', country: 'GB', lat: 51.45, lon: -2.59, colour: '#2563eb', tier: 'Professional', status: 'onboarding', employees: 2100, services: ['mdr', 'caas', 'tprm'], frameworks: ['DORA', 'ISO 27001', 'PRA SS1/21'], issue: 'Onboarding: Splunk Cloud data plane awaiting firewall change', deployment: 'Customer AWS data plane', residency: 'UK London' },
];

let BOOK: PartnerClient[] | null = null;
export function clientBook(): PartnerClient[] {
  if (BOOK) return BOOK;
  const demo: PartnerClient[] = CUSTOMER_LIST.map((c) => {
    const h = headlines(c);
    const ri = resilienceIndex(c).value;
    const active = (Object.keys(c.services) as ServiceId[]).filter((s) => c.services[s] === 'active');
    const trial = (Object.keys(c.services) as ServiceId[]).filter((s) => c.services[s] === 'trial');
    const x = DEMO_EXTRA[c.id];
    const healthy = c.connectors.filter((k) => k.status === 'healthy').length;
    const notes: string[] = [];
    if (h.soc.critical) notes.push(`${h.soc.critical} critical incident${h.soc.critical > 1 ? 's' : ''} open`);
    const degraded = c.connectors.filter((k) => k.status !== 'healthy');
    if (degraded.length) notes.push(`${degraded.length} integration${degraded.length > 1 ? 's' : ''} degraded (${degraded.slice(0, 2).map((k) => k.product).join(', ')})`);
    if (x.renewalDays < 90) notes.push(`Renewal in ${x.renewalDays} days`);
    const health = Math.round(ri * 0.55 + (healthy / c.connectors.length) * 100 * 0.25 + (x.renewalDays < 90 ? 8 : 18) - h.soc.critical * 2);
    return {
      id: c.id, demoId: c.id, name: c.name, short: c.short, initials: c.initials, colour: c.colour, sector: c.sector,
      city: x.city, country: x.country, lat: x.lat, lon: x.lon, tier: c.tier, status: x.status,
      modules: modesFromServices(active, trial), services: active,
      integrations: c.connectors.length, integrationLimit: c.integrationLimit, healthyIntegrations: healthy,
      ri, riTrend: riTrend(c), openIncidents: h.soc.openIncidents, critical: h.soc.critical,
      health: Math.min(96, health), healthNotes: notes, topAction: riDrivers(c)[0].text,
      renewalDays: x.renewalDays, arrUsd: arrFor(c.tier, active, c.employees, c.connectors.length), sinceMonths: x.sinceMonths, employees: c.employees,
      csm: x.csm, owner: x.owner, deployment: c.deployment, residency: c.residency,
      eventsPerDay: h.fabric.eventsPerDay, copilotTokensM: Math.round(h.ai.copilotQueries30d * 0.0042 * 10) / 10, users: Math.round(c.employees * 0.006) + 18,
      tenants: c.tenants.length, frameworks: c.frameworks.map((f) => f.short),
    };
  });
  const small: PartnerClient[] = SMALL.map((s, i) => {
    const r = rng(`partner-client-${s.short}`);
    const limit = TIER_BY_ID[s.tier].integrations;
    const integrations = s.status === 'onboarding' ? r.int(2, 4) : limit === null ? r.int(24, 38) : limit === 5 ? 5 : r.int(12, 21);
    const healthy = Math.max(1, integrations - r.int(0, s.status === 'at-risk' ? 3 : 1));
    const ri = s.status === 'onboarding' ? r.int(52, 61) : s.status === 'at-risk' ? r.int(60, 68) : s.status === 'trial' ? r.int(58, 66) : r.int(68, 84);
    const trend: number[] = [];
    let v = ri - r.int(4, 11);
    for (let k = 0; k < 11; k++) {
      v += (ri - v) / (11 - k) + (r() - 0.45) * 1.8;
      trend.push(Math.round(v));
    }
    trend.push(ri);
    const openIncidents = s.status === 'onboarding' ? r.int(0, 2) : Math.max(1, Math.round(s.employees / 900) + r.int(0, 3));
    const critical = s.status === 'at-risk' || r.chance(0.15) ? 1 : 0;
    const renewalDays = s.status === 'at-risk' ? 38 : s.status === 'trial' ? 12 : s.status === 'onboarding' ? 350 + i : r.int(60, 330);
    const notes: string[] = [];
    if (critical) notes.push('1 critical incident open');
    if (healthy < integrations) notes.push(`${integrations - healthy} integration${integrations - healthy > 1 ? 's' : ''} degraded`);
    if (renewalDays < 90) notes.push(s.status === 'trial' ? `Proof of value ends in ${renewalDays} days` : `Renewal in ${renewalDays} days`);
    if (s.status === 'onboarding') notes.push('Go-live checklist in progress');
    const health = Math.round(ri * 0.55 + (healthy / integrations) * 25 + (renewalDays < 90 ? 6 : 18) - critical * 4);
    return {
      id: s.short.toLowerCase().replace(/[^a-z]+/g, '-'), name: s.name, short: s.short,
      initials: s.name.split(' ').filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join(''),
      colour: s.colour, sector: s.sector, city: s.city, country: s.country, lat: s.lat, lon: s.lon, tier: s.tier, status: s.status,
      modules: modesFromServices(s.services, s.trial ?? []), services: s.services,
      integrations, integrationLimit: limit, healthyIntegrations: healthy,
      ri, riTrend: trend, openIncidents, critical, health: Math.min(95, health), healthNotes: notes, topAction: s.issue,
      renewalDays, arrUsd: arrFor(s.tier, s.services, s.employees, integrations), sinceMonths: s.status === 'onboarding' || s.status === 'trial' ? 0 : r.int(5, 30), employees: s.employees,
      csm: i % 2 ? 'Freya Watts' : 'Ravi Patel', owner: i % 3 ? 'Grace Okafor' : 'Daniel Moretti',
      deployment: s.deployment, residency: s.residency,
      eventsPerDay: Math.round(s.employees * r.int(900, 1600)), copilotTokensM: s.tier === 'Essentials' ? 0 : r.float(0.4, 4.2), users: r.int(4, 22),
      tenants: s.tier === 'Enterprise / CNI' ? r.int(3, 5) : r.int(1, 2), frameworks: s.frameworks,
    };
  });
  BOOK = [...demo, ...small];
  return BOOK;
}

export function bookTotals(book: PartnerClient[]) {
  const arr = book.reduce((s, c) => s + c.arrUsd, 0);
  const margin = book.reduce((s, c) => s + clientMargin(c).margin, 0);
  const modules = book.reduce((s, c) => s + Object.values(c.modules).filter((m) => m !== 'Off').length, 0);
  const wRi = Math.round(book.reduce((s, c) => s + c.ri * c.arrUsd, 0) / Math.max(1, arr));
  return {
    clients: book.length,
    active: book.filter((c) => c.status === 'active').length,
    onboarding: book.filter((c) => c.status === 'onboarding').length,
    atRisk: book.filter((c) => c.status === 'at-risk').length,
    trial: book.filter((c) => c.status === 'trial').length,
    arr, margin, modules, wRi,
    incidents: book.reduce((s, c) => s + c.openIncidents, 0),
    critical: book.reduce((s, c) => s + c.critical, 0),
    renewals90: book.filter((c) => c.renewalDays <= 90 && c.status !== 'onboarding').length,
    integrations: book.reduce((s, c) => s + c.integrations, 0),
  };
}

/** Partner margin on a client's annual run rate (licence at partner discount, services at services discount). */
export function clientMargin(c: PartnerClient) {
  const t = TIER_BY_ID[c.tier];
  const f = SIZE_BANDS.find((b) => b.id === bandFor(c.employees))!.factor;
  const extra = t.integrations === null ? 0 : Math.max(0, c.integrations - t.integrations);
  const lic = t.listUsd + extra * EXTRA_INTEGRATION_USD;
  const svc = c.services.reduce((s, x) => s + SERVICE_LIST_USD[x] * f, 0);
  // Clients are on average sold at 3% below list.
  const sell = (lic + svc) * 0.97;
  const cost = lic * (1 - PARTNER.discount.licence / 100) + svc * (1 - PARTNER.discount.services / 100);
  return { licence: lic, services: svc, sell, cost, margin: sell - cost, marginPct: ((sell - cost) / sell) * 100 };
}

/* =====================================================================
   Provisioning
   ===================================================================== */
export type ProvKind = 'New tenant' | 'Add module' | 'Add integration' | 'Data plane' | 'Change mode' | 'Seat change' | 'Offboard module';
export interface ProvRequest {
  id: string;
  clientId: string;
  kind: ProvKind;
  detail: string;
  requestedBy: string;
  ageHours: number;
  status: 'queued' | 'in-progress' | 'awaiting-client' | 'done' | 'failed';
  step: number;
  steps: string[];
  approval: 'auto' | 'partner admin' | 'HexaShield';
}
export function provisioningQueue(): ProvRequest[] {
  const b = clientBook();
  const id = (s: string) => b.find((c) => c.short === s)?.id ?? b[0].id;
  return [
    { id: 'PRV-3318', clientId: id('Calder Valley'), kind: 'Add integration', detail: 'Google Workspace (read: audit logs, users; write: suspend user)', requestedBy: 'Jack Turner', ageHours: 5, status: 'awaiting-client', step: 2, steps: ['Requested', 'Consent sent', 'Client consent', 'Credentials in vault', 'First sync'], approval: 'auto' },
    { id: 'PRV-3317', clientId: id('Harbour & Vale'), kind: 'Data plane', detail: 'Customer-hosted data plane on AWS eu-west-2 (Splunk Cloud, Defender, Okta)', requestedBy: 'Jack Turner', ageHours: 26, status: 'awaiting-client', step: 2, steps: ['Requested', 'Helm chart issued', 'Firewall egress to stamp', 'Heartbeat', 'Connectors bound'], approval: 'partner admin' },
    { id: 'PRV-3315', clientId: id('Tamsin Aero'), kind: 'Add module', detail: 'HexaSOC 24/7 MDR (trial to paid on PoV success)', requestedBy: 'Daniel Moretti', ageHours: 31, status: 'queued', step: 0, steps: ['Requested', 'Commercials', 'Entitlement', 'Runbooks', 'Live'], approval: 'HexaShield' },
    { id: 'PRV-3312', clientId: id('Vireo'), kind: 'New tenant', detail: 'New tenant: Debrecen e-axle plant (HU), OT edge + IEC 62443 pack', requestedBy: 'Daniel Moretti', ageHours: 52, status: 'in-progress', step: 3, steps: ['Requested', 'Tenant created', 'Data plane', 'Connectors', 'Baseline', 'Live'], approval: 'partner admin' },
    { id: 'PRV-3309', clientId: id('Kingsmere'), kind: 'Add integration', detail: 'CrowdStrike Falcon (blocked: Essentials cap of 5 reached)', requestedBy: 'Ravi Patel', ageHours: 70, status: 'failed', step: 1, steps: ['Requested', 'Entitlement check', 'Consent', 'First sync'], approval: 'auto' },
    { id: 'PRV-3306', clientId: id('Mercy Ridge'), kind: 'Change mode', detail: 'HexaStrike from Advisory to Co-managed (purple teaming)', requestedBy: 'Grace Okafor', ageHours: 96, status: 'in-progress', step: 2, steps: ['Requested', 'SOW signed', 'Entitlement', 'Live'], approval: 'HexaShield' },
    { id: 'PRV-3301', clientId: id('Kestrel'), kind: 'Seat change', detail: '+12 analyst seats for awards-season war room', requestedBy: 'Freya Watts', ageHours: 120, status: 'done', step: 3, steps: ['Requested', 'Approved', 'Seats live'], approval: 'auto' },
    { id: 'PRV-3297', clientId: id('Saltmarsh'), kind: 'Data plane', detail: 'Offshore edge agent v1.9.4 rollout to 3 platforms (store-and-forward)', requestedBy: 'Sofia Herrera', ageHours: 140, status: 'in-progress', step: 2, steps: ['Requested', 'Change window', 'Rollout', 'Heartbeat'], approval: 'partner admin' },
    { id: 'PRV-3290', clientId: id('Aldersgate'), kind: 'Add module', detail: 'HexaCustody for M&A data rooms (2 tenants)', requestedBy: 'Grace Okafor', ageHours: 210, status: 'done', step: 4, steps: ['Requested', 'Commercials', 'Entitlement', 'Agents', 'Live'], approval: 'HexaShield' },
    { id: 'PRV-3284', clientId: id('Ostara'), kind: 'Offboard module', detail: 'Retire legacy MSSP log forwarding after cutover', requestedBy: 'Jack Turner', ageHours: 260, status: 'done', step: 2, steps: ['Requested', 'Data exported', 'Removed'], approval: 'partner admin' },
  ];
}

export const ONBOARDING_STEPS = ['Kick-off', 'Tenant & SSO', 'Data plane', 'Connectors', 'Baseline & tuning', 'Runbooks', 'Go-live'];
export function onboardingProgress(c: PartnerClient): number {
  if (c.status === 'onboarding') return c.short === 'Calder Valley' ? 3 : 2;
  if (c.status === 'trial') return 4;
  return ONBOARDING_STEPS.length;
}

/* =====================================================================
   Deal registration
   ===================================================================== */
export type DealStage = 'Discovery' | 'Qualifying' | 'Proposal' | 'Negotiation' | 'Closed won' | 'Closed lost';
export const STAGES: DealStage[] = ['Discovery', 'Qualifying', 'Proposal', 'Negotiation', 'Closed won', 'Closed lost'];
export const STAGE_PROB: Record<DealStage, number> = { Discovery: 10, Qualifying: 25, Proposal: 50, Negotiation: 75, 'Closed won': 100, 'Closed lost': 0 };
export type RegStatus = 'approved' | 'pending' | 'expiring' | 'expired' | 'rejected' | 'renewal';
export const REG_COLOR: Record<RegStatus, string> = { approved: 'var(--good)', pending: 'var(--sev-medium)', expiring: 'var(--bad)', expired: 'var(--sev-info)', rejected: 'var(--sev-critical)', renewal: 'var(--m-matrix)' };
export const REG_LABEL: Record<RegStatus, string> = { approved: 'Approved', pending: 'Pending review', expiring: 'Expiring', expired: 'Expired', rejected: 'Rejected', renewal: 'Renewal requested' };

export interface Deal {
  id: string;
  opportunity: string;
  endClient: string;
  sector: string;
  existingClientId?: string;
  modules: CapabilityId[];
  tier: Tier;
  valueUsd: number;
  stage: DealStage;
  reg: RegStatus;
  submittedDaysAgo: number;
  /** Days until protection ends (negative = ended). null = not protected. */
  protectedDays: number | null;
  owner: string;
  se?: string;
  competitor: string;
  closeQuarter: string;
  deskHoursLeft?: number;
  conflict?: string;
  note?: string;
  kind: 'new logo' | 'upsell' | 'renewal';
}
export function deals(): Deal[] {
  return [
    { id: 'DR-2058', opportunity: 'Meridian Foods: Managed SOC', endClient: 'Meridian Foods Ltd', sector: 'Food manufacturing', modules: ['soc', 'comply'], tier: 'Professional', valueUsd: 214000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 22, protectedDays: 68, owner: 'Tom Ellery', se: 'Nadia Kerr', competitor: 'Incumbent MSSP (log forwarding only)', closeQuarter: 'Q4 2026', kind: 'new logo' },
    { id: 'DR-2057', opportunity: 'Harbour & Vale: Compliance as a service', endClient: 'Harbour & Vale Insurance', sector: 'Insurance', existingClientId: 'harbour-vale', modules: ['comply'], tier: 'Professional', valueUsd: 66000, stage: 'Qualifying', reg: 'pending', submittedDaysAgo: 1, protectedDays: null, owner: 'Grace Okafor', competitor: 'Big Four advisory', closeQuarter: 'Q4 2026', deskHoursLeft: 30, kind: 'upsell' },
    { id: 'DR-2056', opportunity: 'Tamsin Aero: MDR + TPRM after PoV', endClient: 'Tamsin Aerospace Components', sector: 'Aerospace', existingClientId: 'tamsin-aero', modules: ['soc', 'comply', 'ot'], tier: 'Professional', valueUsd: 238000, stage: 'Negotiation', reg: 'approved', submittedDaysAgo: 47, protectedDays: 43, owner: 'Daniel Moretti', se: 'Nadia Kerr', competitor: 'OT-native vendor', closeQuarter: 'Q4 2026', kind: 'upsell' },
    { id: 'DR-2054', opportunity: 'Castell Insurance: Penetration testing', endClient: 'Castell Insurance', sector: 'Insurance', modules: ['strike'], tier: 'Essentials', valueUsd: 48000, stage: 'Proposal', reg: 'expiring', submittedDaysAgo: 81, protectedDays: 9, owner: 'Grace Okafor', competitor: 'Boutique CREST tester', closeQuarter: 'Q4 2026', kind: 'new logo', note: 'Renew before expiry or the opportunity opens up to other partners.' },
    { id: 'DR-2052', opportunity: 'Northgate NHS Trust: Medical-device OT visibility', endClient: 'Northgate NHS Foundation Trust', sector: 'Healthcare', modules: ['ot', 'soc'], tier: 'Enterprise / CNI', valueUsd: 412000, stage: 'Discovery', reg: 'pending', submittedDaysAgo: 2, protectedDays: null, owner: 'Grace Okafor', competitor: 'Medical IoT specialist', closeQuarter: 'Q2 2027', deskHoursLeft: 6, conflict: 'Possible overlap: HexaShield direct has an open lead at Northgate (NHS framework). Deal desk is reviewing.', kind: 'new logo' },
    { id: 'DR-2049', opportunity: 'Aldersgate: DORA red team (TLPT)', endClient: 'Aldersgate Financial Group', sector: 'Financial Services', existingClientId: 'finserv', modules: ['strike'], tier: 'Enterprise / CNI', valueUsd: 172000, stage: 'Negotiation', reg: 'approved', submittedDaysAgo: 35, protectedDays: 55, owner: 'Grace Okafor', se: 'Nadia Kerr', competitor: 'Specialist red-team firm', closeQuarter: 'Q4 2026', kind: 'upsell' },
    { id: 'DR-2047', opportunity: 'Kestrel: Renewal + purple teaming', endClient: 'Kestrel Pictures Group', sector: 'Media & Entertainment', existingClientId: 'media', modules: ['soc', 'strike', 'custody'], tier: 'Professional', valueUsd: 486000, stage: 'Negotiation', reg: 'approved', submittedDaysAgo: 30, protectedDays: 60, owner: 'Grace Okafor', se: 'Nadia Kerr', competitor: 'Studio in-house SOC build', closeQuarter: 'Q4 2026', kind: 'renewal', note: 'Renewal at risk: client wants SLA credits for the August P1.' },
    { id: 'DR-2045', opportunity: 'Vireo: Vehicle SOC expansion (NA fleet)', endClient: 'Vireo Motor Group', sector: 'Automotive', existingClientId: 'automotive', modules: ['soc', 'int'], tier: 'Enterprise / CNI', valueUsd: 690000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 18, protectedDays: 72, owner: 'Daniel Moretti', se: 'Nadia Kerr', competitor: 'Automotive VSOC pure-play', closeQuarter: 'Q1 2027', kind: 'upsell' },
    { id: 'DR-2043', opportunity: 'Halcyon: HexaCustody for bills of lading', endClient: 'Halcyon Ports & Shipping', sector: 'Maritime', existingClientId: 'maritime', modules: ['custody'], tier: 'Enterprise / CNI', valueUsd: 128000, stage: 'Qualifying', reg: 'renewal', submittedDaysAgo: 88, protectedDays: 2, owner: 'Daniel Moretti', competitor: 'None identified', closeQuarter: 'Q1 2027', deskHoursLeft: 14, kind: 'upsell' },
    { id: 'DR-2040', opportunity: 'Mercy Ridge: AI governance (ambient scribe)', endClient: 'Mercy Ridge Health', sector: 'Healthcare', existingClientId: 'healthcare', modules: ['comply'], tier: 'Enterprise / CNI', valueUsd: 96000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 26, protectedDays: 64, owner: 'Grace Okafor', competitor: 'GRC platform vendor', closeQuarter: 'Q4 2026', kind: 'upsell' },
    { id: 'DR-2038', opportunity: 'Brightwater Rail: OT monitoring', endClient: 'Brightwater Rail Freight', sector: 'Rail', modules: ['ot', 'soc'], tier: 'Enterprise / CNI', valueUsd: 356000, stage: 'Discovery', reg: 'rejected', submittedDaysAgo: 12, protectedDays: null, owner: 'Daniel Moretti', competitor: 'OT-native vendor', closeQuarter: 'Q2 2027', conflict: 'Registered by another partner (protected until 14 Dec 2026). You can co-sell with HexaShield approval.', kind: 'new logo' },
    { id: 'DR-2035', opportunity: 'Ostara: Threat hunting + ASM', endClient: 'Ostara Logistics', sector: 'Logistics', existingClientId: 'ostara', modules: ['soc', 'strike'], tier: 'Professional', valueUsd: 74000, stage: 'Closed won', reg: 'approved', submittedDaysAgo: 96, protectedDays: -6, owner: 'Daniel Moretti', competitor: 'None identified', closeQuarter: 'Q3 2026', kind: 'upsell' },
    { id: 'DR-2031', opportunity: 'Saltmarsh: OT penetration test (offshore)', endClient: 'Saltmarsh Energy', sector: 'Energy', existingClientId: 'saltmarsh', modules: ['ot'], tier: 'Enterprise / CNI', valueUsd: 92000, stage: 'Closed won', reg: 'approved', submittedDaysAgo: 120, protectedDays: -30, owner: 'Daniel Moretti', competitor: 'Specialist ICS tester', closeQuarter: 'Q3 2026', kind: 'upsell' },
    { id: 'DR-2027', opportunity: 'Ferncliffe Council: MDR', endClient: 'Ferncliffe Borough Council', sector: 'Public sector', modules: ['soc'], tier: 'Essentials', valueUsd: 88000, stage: 'Closed lost', reg: 'expired', submittedDaysAgo: 140, protectedDays: -50, owner: 'Tom Ellery', competitor: 'Framework incumbent', closeQuarter: 'Q3 2026', kind: 'new logo', note: 'Lost on price under the public-sector framework.' },
    { id: 'DR-2024', opportunity: 'Lumen Bio: Custody for trial data', endClient: 'Lumen Biotherapeutics', sector: 'Life sciences', existingClientId: 'lumen-bio', modules: ['custody', 'comply'], tier: 'Professional', valueUsd: 58000, stage: 'Closed won', reg: 'approved', submittedDaysAgo: 150, protectedDays: -60, owner: 'Grace Okafor', competitor: 'DRM vendor', closeQuarter: 'Q2 2026', kind: 'upsell' },
    { id: 'DR-2020', opportunity: 'Pemberton: Executive exposure', endClient: 'Pemberton Law LLP', sector: 'Legal', existingClientId: 'pemberton', modules: ['int'], tier: 'Essentials', valueUsd: 21000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 40, protectedDays: 50, owner: 'Tom Ellery', competitor: 'Identity-protection vendor', closeQuarter: 'Q4 2026', kind: 'upsell' },
  ];
}

/** Names the deal desk would flag when a partner registers a deal. */
export const PROTECTED_NAMES: { match: string; result: 'other-partner' | 'direct' ; detail: string }[] = [
  { match: 'brightwater', result: 'other-partner', detail: 'Registered by another partner, protected until 14 Dec 2026.' },
  { match: 'northgate', result: 'direct', detail: 'HexaShield direct has an open lead under the NHS framework.' },
  { match: 'atlas', result: 'other-partner', detail: 'Registered by another partner, protected until 2 Feb 2027.' },
  { match: 'cityline', result: 'direct', detail: 'HexaShield named strategic account: co-sell only.' },
];

export function conflictCheck(name: string): { state: 'clear' | 'existing' | 'own' | 'other-partner' | 'direct'; text: string } {
  const n = name.trim().toLowerCase();
  if (n.length < 3) return { state: 'clear', text: 'Type the end client name to run the conflict check.' };
  const p = PROTECTED_NAMES.find((x) => n.includes(x.match));
  if (p) return { state: p.result, text: p.detail };
  const own = deals().find((d) => d.endClient.toLowerCase().includes(n) && d.stage !== 'Closed won' && d.stage !== 'Closed lost');
  if (own) return { state: 'own', text: `You already have ${own.id} open for ${own.endClient} (${REG_LABEL[own.reg].toLowerCase()}). Add scope to it instead?` };
  const c = clientBook().find((x) => x.name.toLowerCase().includes(n) || x.short.toLowerCase().includes(n));
  if (c) return { state: 'existing', text: `${c.name} is already your client: this registers as an upsell and is auto-approved for existing scope.` };
  return { state: 'clear', text: 'No conflicts found across partner registrations or HexaShield direct accounts.' };
}

/* =====================================================================
   Quotes
   ===================================================================== */
export interface SavedQuote {
  id: string;
  client: string;
  dealId?: string;
  tier: Tier;
  services: number;
  sellUsd: number;
  marginPct: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Expired';
  daysAgo: number;
  owner: string;
}
export function savedQuotes(): SavedQuote[] {
  return [
    { id: 'Q-3391', client: 'Vireo Motor Group', dealId: 'DR-2045', tier: 'Enterprise / CNI', services: 6, sellUsd: 688400, marginPct: 29.1, status: 'Sent', daysAgo: 3, owner: 'Daniel Moretti' },
    { id: 'Q-3388', client: 'Meridian Foods Ltd', dealId: 'DR-2058', tier: 'Professional', services: 4, sellUsd: 211900, marginPct: 30.4, status: 'Sent', daysAgo: 6, owner: 'Tom Ellery' },
    { id: 'Q-3384', client: 'Kestrel Pictures Group', dealId: 'DR-2047', tier: 'Professional', services: 11, sellUsd: 482100, marginPct: 26.8, status: 'Draft', daysAgo: 8, owner: 'Grace Okafor' },
    { id: 'Q-3379', client: 'Tamsin Aerospace Components', dealId: 'DR-2056', tier: 'Professional', services: 4, sellUsd: 236500, marginPct: 31.2, status: 'Sent', daysAgo: 12, owner: 'Daniel Moretti' },
    { id: 'Q-3371', client: 'Aldersgate Financial Group', dealId: 'DR-2049', tier: 'Enterprise / CNI', services: 1, sellUsd: 171200, marginPct: 22.6, status: 'Sent', daysAgo: 19, owner: 'Grace Okafor' },
    { id: 'Q-3366', client: 'Ostara Logistics', dealId: 'DR-2035', tier: 'Professional', services: 2, sellUsd: 73800, marginPct: 24.9, status: 'Accepted', daysAgo: 41, owner: 'Daniel Moretti' },
    { id: 'Q-3352', client: 'Ferncliffe Borough Council', dealId: 'DR-2027', tier: 'Essentials', services: 1, sellUsd: 86000, marginPct: 18.4, status: 'Expired', daysAgo: 92, owner: 'Tom Ellery' },
  ];
}

/* =====================================================================
   Pipeline history
   ===================================================================== */
export function bookingsHistory(): { month: number; won: number; lost: number; created: number }[] {
  const r = rng('partner-bookings');
  return Array.from({ length: 12 }, (_, i) => ({ month: i, won: Math.round(r.int(60, 240) * (0.8 + i / 30)) * 1000, lost: r.int(10, 110) * 1000, created: Math.round(r.int(220, 520) * (0.85 + i / 25)) * 1000 }));
}

/* =====================================================================
   Enablement
   ===================================================================== */
export type ContentType = 'Battlecard' | 'Sector one-pager' | 'Deck' | 'Case study' | 'Demo script' | 'Datasheet' | 'Proposal template' | 'Video';
export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  product: string;
  sector?: string;
  summary: string;
  bullets: string[];
  format: string;
  pages?: number;
  updatedDays: number;
  downloads: number;
  cobrand: boolean;
  isNew?: boolean;
}
export const CONTENT_TYPES: ContentType[] = ['Battlecard', 'Sector one-pager', 'Deck', 'Case study', 'Demo script', 'Datasheet', 'Proposal template', 'Video'];
export function contentLibrary(): ContentItem[] {
  const r = rng('partner-content');
  const items: Omit<ContentItem, 'id' | 'downloads'>[] = [
    { title: 'Co-Managed SOC', type: 'Datasheet', product: 'HexaSOC', summary: 'Your team and ours, one operation.', bullets: ['24/7 MDR with 15-minute critical acknowledgement', 'Bidirectional: detections written back to the client SIEM and EDR', 'Agentic triage with human approval on every response action'], format: 'PDF · A4 · navy / light', pages: 2, updatedDays: 9, cobrand: true },
    { title: 'Managed OT & IoT Security Monitoring', type: 'Datasheet', product: 'HexaOT', summary: 'Security for systems that cannot go down.', bullets: ['Passive discovery by Purdue level and zone', 'Read-only by policy: no actions in OT', 'IEC 62443, IACS E26/E27 and FDA 524B mappings'], format: 'PDF · A4 · navy / light', pages: 2, updatedDays: 14, cobrand: true },
    { title: 'Managed Threat Intelligence & Dark-Web Monitoring', type: 'Datasheet', product: 'HexaInt', summary: 'Signal, not noise.', bullets: ['Stealer-log matches in 1 hour', 'Executive exposure and lookalike domains', 'Intel fed to hunting and detection engineering'], format: 'PDF · A4 · navy / light', pages: 2, updatedDays: 21, cobrand: true },
    { title: 'Penetration Testing', type: 'Datasheet', product: 'HexaStrike', summary: 'See your estate the way attackers do.', bullets: ['Infrastructure, web, API, cloud and mobile', 'Every finding becomes a detection', 'Retest tracked to closure'], format: 'PDF · A4 · navy / light', pages: 2, updatedDays: 30, cobrand: true },
    { title: 'Third-Party & Supply-Chain Risk Management', type: 'Datasheet', product: 'HexaComply', summary: 'Your risk does not stop at your perimeter.', bullets: ['Tiered assessments with outside-in ratings', 'DORA Art. 28 and NIS2 Art. 21 registers', 'Contract obligations tracked to evidence'], format: 'PDF · A4 · navy / light', pages: 2, updatedDays: 18, cobrand: true },
    { title: 'Managed Content Custody & Attribution', type: 'Datasheet', product: 'HexaCustody', summary: 'See your assets end to end, trace any leak to source.', bullets: ['Chain of custody across suppliers', 'Revocation in under 60 seconds', 'Forensic watermark attribution'], format: 'PDF · A4 · navy / light', pages: 2, updatedDays: 25, cobrand: true },
    { title: 'Maritime: ports, terminals and fleets', type: 'Sector one-pager', product: 'HexaView', sector: 'Maritime', summary: 'One view from crane PLC to vessel VSAT.', bullets: ['IACS E26/E27 and IMO MSC-FAL.1/Circ.3 evidence', 'Vessel edge with store-and-forward', 'Reference: Halcyon Ports & Shipping'], format: 'PDF · A4', pages: 1, updatedDays: 6, cobrand: true, isNew: true },
    { title: 'Financial services: DORA-ready by design', type: 'Sector one-pager', product: 'HexaView', sector: 'Financial Services', summary: 'ICT risk, TLPT and third parties in one evidence trail.', bullets: ['DORA Art. 9, 24–27, 28 mapped to live controls', 'Mainframe and SWIFT CSP coverage', 'Reference: Aldersgate Financial Group'], format: 'PDF · A4', pages: 1, updatedDays: 11, cobrand: true },
    { title: 'Media & entertainment: protect the release', type: 'Sector one-pager', product: 'HexaView', sector: 'Media & Entertainment', summary: 'Pre-release content, vendors and custody, end to end.', bullets: ['TPN and MPA controls with evidence', 'Vendor chain and screener protection', 'Reference: Kestrel Pictures Group'], format: 'PDF · A4', pages: 1, updatedDays: 16, cobrand: true },
    { title: 'Healthcare: patient safety is cyber safety', type: 'Sector one-pager', product: 'HexaView', sector: 'Healthcare', summary: 'Epic, 14,600 medical devices and HHS HPH CPGs in one view.', bullets: ['HIPAA, HITRUST and FDA 524B evidence', 'Medical devices treated as OT (read-only)', 'Reference: Mercy Ridge Health'], format: 'PDF · A4', pages: 1, updatedDays: 4, cobrand: true, isNew: true },
    { title: 'Automotive: plant, product and vehicle', type: 'Sector one-pager', product: 'HexaView', sector: 'Automotive', summary: 'UNECE R155/R156, TISAX and a vehicle SOC on one platform.', bullets: ['Air-gapped plants supported', 'OTA signing and VSOC telemetry', 'Reference: Vireo Motor Group'], format: 'PDF · A4', pages: 1, updatedDays: 8, cobrand: true, isNew: true },
    { title: 'HexaView vs. stand-alone SIEM + MSSP', type: 'Battlecard', product: 'HexaView', summary: 'Win against "we already have a SIEM and a provider".', bullets: ['Keep their SIEM: HexaView reads and writes back to it', 'Closed-loop assurance proves controls work', 'Objection: "another pane of glass" → it replaces the swivel-chair'], format: 'PDF · 2 pages', pages: 2, updatedDays: 7, cobrand: false },
    { title: 'HexaView vs. GRC platforms', type: 'Battlecard', product: 'HexaComply', summary: 'Documented is not assured.', bullets: ['Evidence pulled live from the tools, not uploaded', 'ATT&CK-mapped loops show controls actually detect', 'Insurer and regulator packs from the same data'], format: 'PDF · 2 pages', pages: 2, updatedDays: 19, cobrand: false },
    { title: 'HexaOT vs. OT-native visibility vendors', type: 'Battlecard', product: 'HexaOT', summary: 'Visibility is table stakes; the loop is the difference.', bullets: ['Ingests existing OT sensors rather than replacing them', 'Same pane as IT, cloud and compliance', 'Managed by people who run OT SOCs'], format: 'PDF · 2 pages', pages: 2, updatedDays: 23, cobrand: false },
    { title: 'Agentic SOC: handling the AI objection', type: 'Battlecard', product: 'HexaAI', summary: 'Agentic SOC as a dial, with 100% human approval on actions.', bullets: ['Every copilot answer is cited and checkable', 'Write-back gated by risk class and approvals', 'ISO/IEC 42001 controls on our own AI'], format: 'PDF · 2 pages', pages: 2, updatedDays: 3, cobrand: false, isNew: true },
    { title: 'HexaView partner pitch deck', type: 'Deck', product: 'HexaView', summary: 'The 20-minute first-meeting story.', bullets: ['Problem: tools, not outcomes', 'Single pane, bidirectional, closed loop', 'Proof: five sector references'], format: 'PPTX · 22 slides', pages: 22, updatedDays: 10, cobrand: true },
    { title: 'Board briefing: the Resilience Index', type: 'Deck', product: 'HexaView', summary: 'For the CFO and board: one explainable number.', bullets: ['How the index is made and weighted', 'What would raise it most', 'Insurance and regulatory impact'], format: 'PPTX · 12 slides', pages: 12, updatedDays: 28, cobrand: true },
    { title: 'Technical deep dive: data planes and BYOK', type: 'Deck', product: 'HexaCore', summary: 'For architects and security engineers.', bullets: ['Customer-hosted and air-gapped placements', 'Vaults, keys and tenant isolation', 'Connector read/write scopes'], format: 'PPTX · 30 slides', pages: 30, updatedDays: 35, cobrand: false },
    { title: 'Halcyon Ports: one pane for 26 terminals', type: 'Case study', product: 'HexaOT', sector: 'Maritime', summary: 'From 11 consoles to one, with vessel coverage at sea.', bullets: ['RI up 12 points in a year', 'MTTR 41 minutes', '1,912 OT assets under passive watch'], format: 'PDF · 3 pages', pages: 3, updatedDays: 40, cobrand: true },
    { title: 'Aldersgate: DORA evidence without the spreadsheets', type: 'Case study', product: 'HexaComply', sector: 'Financial Services', summary: '4,620 evidence items collected continuously.', bullets: ['87% controls met, loop-proven', 'TLPT findings turned into detections', 'Register of ICT providers live'], format: 'PDF · 3 pages', pages: 3, updatedDays: 52, cobrand: true },
    { title: 'Kestrel: stopping the screener leak', type: 'Case study', product: 'HexaCustody', sector: 'Media & Entertainment', summary: '14,600 assets tracked across 63 vendors.', bullets: ['Leak traced to source in 9 minutes', 'Vendor revoked in under 60 s', 'TPN assessment passed first time'], format: 'PDF · 3 pages', pages: 3, updatedDays: 61, cobrand: true },
    { title: 'Mercy Ridge: medical devices as OT', type: 'Case study', product: 'HexaOT', sector: 'Healthcare', summary: 'Segmentation priorities from 14,600 devices.', bullets: ['HPH CPG essentials met', 'Help-desk social engineering detected', 'Epic break-the-glass evidence automated'], format: 'PDF · 3 pages', pages: 3, updatedDays: 12, cobrand: true, isNew: true },
    { title: 'Vireo: from plant floor to vehicle SOC', type: 'Case study', product: 'HexaSOC', sector: 'Automotive', summary: '2.1M connected vehicles, 4 plants, one SOC.', bullets: ['R155 CSMS evidence from live data', 'Air-gapped battery plant covered', 'OTA signing anomalies in minutes'], format: 'PDF · 3 pages', pages: 3, updatedDays: 9, cobrand: true, isNew: true },
    { title: 'Demo script: Command Centre in 10 minutes', type: 'Demo script', product: 'HexaView', summary: 'The click path that wins the first meeting.', bullets: ['Resilience Index → Board view', 'Open incident → write-back with approval', 'Closed-loop assurance on one framework'], format: 'DOCX · 6 pages', pages: 6, updatedDays: 5, cobrand: false },
    { title: 'Demo script: OT for a sceptical engineer', type: 'Demo script', product: 'HexaOT', summary: 'Read-only, passive, and safe.', bullets: ['Purdue view and zones', 'Advisory matched to firmware', 'Why there are no action buttons'], format: 'DOCX · 4 pages', pages: 4, updatedDays: 17, cobrand: false },
    { title: 'Demo script: partner white label', type: 'Demo script', product: 'Partner', summary: 'Show the client their portal under your brand.', bullets: ['Theme and domain live preview', 'Branded monthly report', 'Client switcher across your book'], format: 'DOCX · 3 pages', pages: 3, updatedDays: 2, cobrand: false, isNew: true },
    { title: 'MDR proposal template', type: 'Proposal template', product: 'HexaSOC', summary: 'Pre-approved scope, SLAs and pricing tables.', bullets: ['SLA schedule and service credits', 'Responsibilities matrix (RACI)', 'Pricing pulled from your quote'], format: 'DOCX · 14 pages', pages: 14, updatedDays: 15, cobrand: true },
    { title: 'Compliance as a service SOW', type: 'Proposal template', product: 'HexaComply', summary: 'Assessment to certification in one SOW.', bullets: ['Framework options', 'Evidence collection approach', 'Auditor liaison'], format: 'DOCX · 10 pages', pages: 10, updatedDays: 33, cobrand: true },
    { title: 'Two-minute product overview', type: 'Video', product: 'HexaView', summary: 'For email follow-ups and your website.', bullets: ['White-labelled version available', 'Subtitles in 6 languages', 'MP4 · 1080p'], format: 'MP4 · 2:04', updatedDays: 44, cobrand: true },
    { title: 'Closed-loop assurance explained', type: 'Video', product: 'HexaView', summary: 'Policy to evidence to detection to validation.', bullets: ['Animated walkthrough', 'For GRC and audit buyers', 'MP4 · 1080p'], format: 'MP4 · 3:40', updatedDays: 58, cobrand: false },
  ];
  return items.map((it, i) => ({ ...it, id: `LIB-${String(100 + i)}`, downloads: r.int(12, 420) }));
}

export interface Track {
  id: string;
  name: string;
  short: string;
  audience: string;
  modules: number;
  hours: number;
  required: number;
}
export const TRACKS: Track[] = [
  { id: 'sales', name: 'HexaView Sales Associate', short: 'Sales', audience: 'Sales & leadership', modules: 6, hours: 5, required: 4 },
  { id: 'tech', name: 'HexaView Technical Professional', short: 'Technical', audience: 'Pre-sales & platform', modules: 10, hours: 14, required: 3 },
  { id: 'soc', name: 'HexaSOC Delivery Specialist', short: 'HexaSOC', audience: 'SOC', modules: 12, hours: 18, required: 3 },
  { id: 'ot', name: 'HexaOT Specialist', short: 'HexaOT', audience: 'OT engineering', modules: 8, hours: 12, required: 1 },
  { id: 'comply', name: 'HexaComply Practitioner', short: 'HexaComply', audience: 'GRC', modules: 8, hours: 10, required: 1 },
  { id: 'wl', name: 'White-label & Tenant Admin', short: 'Admin', audience: 'Platform', modules: 5, hours: 4, required: 2 },
];
export type CertState = 'certified' | 'expiring' | 'in-progress' | 'not-started' | 'expired';
export const CERT_COLOR: Record<CertState, string> = { certified: 'var(--good)', expiring: 'var(--sev-medium)', 'in-progress': 'var(--m-matrix)', 'not-started': 'var(--track)', expired: 'var(--bad)' };
export const CERT_LABEL: Record<CertState, string> = { certified: 'Certified', expiring: 'Expiring', 'in-progress': 'In progress', 'not-started': 'Not started', expired: 'Expired' };
export interface CertCell { state: CertState; pct: number; days: number; score?: number }
export function certifications(): Record<string, Record<string, CertCell>> {
  const relevance: Record<PartnerPerson['team'], string[]> = {
    Leadership: ['sales'], Sales: ['sales', 'tech'], 'Pre-sales': ['sales', 'tech', 'ot', 'comply', 'wl'], SOC: ['tech', 'soc'], OT: ['tech', 'ot', 'soc'],
    GRC: ['comply', 'sales'], 'Customer success': ['sales', 'tech', 'wl'], Marketing: ['sales'], Platform: ['tech', 'wl', 'soc'],
  };
  const out: Record<string, Record<string, CertCell>> = {};
  for (const p of STAFF) {
    const r = rng(`cert-${p.id}`);
    out[p.id] = {};
    for (const t of TRACKS) {
      const rel = relevance[p.team].includes(t.id);
      const state: CertState = !rel
        ? r.chance(0.12) ? 'in-progress' : 'not-started'
        : r.weighted<CertState>([['certified', 6], ['expiring', 1.2], ['in-progress', 2.2], ['expired', 0.6], ['not-started', 0.6]]);
      out[p.id][t.id] = {
        state,
        pct: state === 'certified' || state === 'expiring' || state === 'expired' ? 100 : state === 'in-progress' ? r.int(15, 85) : 0,
        days: state === 'expiring' ? r.int(9, 45) : state === 'certified' ? r.int(90, 680) : state === 'expired' ? r.int(5, 80) : 0,
        score: state === 'certified' || state === 'expiring' ? r.int(78, 98) : undefined,
      };
    }
  }
  return out;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'Webinar' | 'Event' | 'ABM' | 'Paid social' | 'Email nurture' | 'Roundtable';
  sector: string;
  status: 'Live' | 'Planned' | 'Completed';
  budget: number;
  mdf: number;
  leads: number;
  mqls: number;
  pipelineUsd: number;
  wonUsd: number;
  startDays: number;
  owner: string;
}
export function campaigns(): Campaign[] {
  return [
    { id: 'CMP-118', name: 'DORA in 90 days: TLPT and third parties', type: 'Webinar', sector: 'Financial Services', status: 'Completed', budget: 9000, mdf: 4500, leads: 214, mqls: 41, pipelineUsd: 612000, wonUsd: 172000, startDays: -62, owner: 'Elena Novak' },
    { id: 'CMP-121', name: 'Ports & terminals OT roundtable, Rotterdam', type: 'Roundtable', sector: 'Maritime', status: 'Completed', budget: 16000, mdf: 8000, leads: 38, mqls: 19, pipelineUsd: 840000, wonUsd: 128000, startDays: -45, owner: 'Elena Novak' },
    { id: 'CMP-124', name: 'HPH CPGs for community hospitals', type: 'Email nurture', sector: 'Healthcare', status: 'Live', budget: 6000, mdf: 3000, leads: 166, mqls: 27, pipelineUsd: 412000, wonUsd: 0, startDays: -20, owner: 'Elena Novak' },
    { id: 'CMP-126', name: 'Infosecurity Europe stand (shared with HexaShield)', type: 'Event', sector: 'Cross-sector', status: 'Completed', budget: 42000, mdf: 21000, leads: 512, mqls: 88, pipelineUsd: 1460000, wonUsd: 214000, startDays: -110, owner: 'Elena Novak' },
    { id: 'CMP-129', name: 'R155 / R156 for tier-1 suppliers', type: 'ABM', sector: 'Automotive', status: 'Live', budget: 18000, mdf: 9000, leads: 24, mqls: 14, pipelineUsd: 930000, wonUsd: 0, startDays: -12, owner: 'Elena Novak' },
    { id: 'CMP-131', name: 'Protect the release: awards-season screeners', type: 'Paid social', sector: 'Media & Entertainment', status: 'Live', budget: 7500, mdf: 3750, leads: 92, mqls: 12, pipelineUsd: 180000, wonUsd: 0, startDays: -8, owner: 'Elena Novak' },
    { id: 'CMP-134', name: 'Water & energy CAF refresh breakfast, Leeds', type: 'Roundtable', sector: 'Utilities', status: 'Planned', budget: 11000, mdf: 5500, leads: 0, mqls: 0, pipelineUsd: 0, wonUsd: 0, startDays: 24, owner: 'Elena Novak' },
    { id: 'CMP-137', name: 'Agentic SOC, explained for CISOs', type: 'Webinar', sector: 'Cross-sector', status: 'Planned', budget: 5000, mdf: 2500, leads: 0, mqls: 0, pipelineUsd: 0, wonUsd: 0, startDays: 38, owner: 'Elena Novak' },
  ];
}
export interface MdfClaim {
  id: string;
  campaignId: string;
  amount: number;
  status: 'Approved' | 'Paid' | 'Submitted' | 'Needs proof' | 'Pre-approved';
  daysAgo: number;
  proof: string[];
}
export function mdfClaims(): MdfClaim[] {
  return [
    { id: 'MDF-0841', campaignId: 'CMP-126', amount: 21000, status: 'Paid', daysAgo: 70, proof: ['Stand invoice', 'Lead list (512)', 'Photos'] },
    { id: 'MDF-0852', campaignId: 'CMP-118', amount: 4500, status: 'Paid', daysAgo: 48, proof: ['Platform invoice', 'Attendee report'] },
    { id: 'MDF-0857', campaignId: 'CMP-121', amount: 8000, status: 'Approved', daysAgo: 30, proof: ['Venue invoice', 'Attendee list', 'Agenda'] },
    { id: 'MDF-0863', campaignId: 'CMP-124', amount: 3000, status: 'Submitted', daysAgo: 6, proof: ['Agency invoice'] },
    { id: 'MDF-0866', campaignId: 'CMP-129', amount: 9000, status: 'Needs proof', daysAgo: 4, proof: ['Agency invoice'] },
    { id: 'MDF-0870', campaignId: 'CMP-131', amount: 3750, status: 'Submitted', daysAgo: 2, proof: ['LinkedIn invoice', 'Creative'] },
    { id: 'MDF-0872', campaignId: 'CMP-134', amount: 5500, status: 'Pre-approved', daysAgo: 1, proof: ['Plan & budget'] },
    { id: 'MDF-0873', campaignId: 'CMP-137', amount: 2500, status: 'Pre-approved', daysAgo: 1, proof: ['Plan & budget'] },
  ];
}

/* =====================================================================
   Billing: usage, invoices, commissions, support
   ===================================================================== */
export interface UsageRow {
  client: PartnerClient;
  integrations: number;
  limit: number | null;
  eventsM: number;
  copilotM: number;
  services: number;
  seats: number;
  storageTb: number;
  overageUsd: number;
  series: number[];
}
export function usage(): UsageRow[] {
  return clientBook().map((c) => {
    const r = rng(`usage-${c.id}`);
    const eventsM = Math.round((c.eventsPerDay * 30) / 1e5) / 10;
    const over = c.integrationLimit !== null ? Math.max(0, c.integrations - c.integrationLimit) : 0;
    const series = r.series(12, eventsM * 0.7, eventsM * 0.05, eventsM * 0.03, eventsM * 0.4).map((v, i, a) => (i === a.length - 1 ? eventsM : v));
    return {
      client: c, integrations: c.integrations, limit: c.integrationLimit, eventsM, copilotM: c.copilotTokensM, services: c.services.length,
      seats: c.users, storageTb: Math.round(eventsM * 0.0021 * 10) / 10 + r.float(0.2, 2), overageUsd: over * (EXTRA_INTEGRATION_USD / 12) + (c.tier === 'Essentials' && c.copilotTokensM > 0 ? 400 : 0),
      series,
    };
  });
}

export interface Invoice {
  id: string;
  direction: 'payable' | 'receivable';
  counterparty: string;
  clientId?: string;
  period: string;
  amountUsd: number;
  status: 'Paid' | 'Due' | 'Overdue' | 'Draft' | 'Disputed';
  dueDays: number;
  lines: { label: string; amount: number }[];
}
export function invoices(): Invoice[] {
  const book = clientBook();
  const months = ['Oct 2026', 'Sep 2026', 'Aug 2026'];
  const out: Invoice[] = [];
  months.forEach((m, mi) => {
    const lic = book.reduce((s, c) => s + clientMargin(c).licence * (1 - PARTNER.discount.licence / 100), 0) / 12;
    const svc = book.reduce((s, c) => s + clientMargin(c).services * (1 - PARTNER.discount.services / 100), 0) / 12;
    const over = usage().reduce((s, u) => s + u.overageUsd, 0);
    out.push({
      id: `HXS-INV-${26100 - mi * 37}`, direction: 'payable', counterparty: 'HexaShield Ltd', period: m,
      amountUsd: Math.round(lic + svc + over), status: mi === 0 ? 'Due' : 'Paid', dueDays: mi === 0 ? 27 : -30 * mi,
      lines: [{ label: 'HexaView platform licences (wholesale, 30% partner discount)', amount: Math.round(lic) }, { label: 'Managed services delivered by HexaShield (25% partner discount)', amount: Math.round(svc) }, { label: 'Integration and copilot overage', amount: Math.round(over) }],
    });
  });
  book.forEach((c, i) => {
    const r = rng(`inv-${c.id}`);
    const monthly = clientMargin(c).sell / 12;
    const status: Invoice['status'] = c.status === 'onboarding' ? 'Draft' : c.short === 'Greyfriars' ? 'Disputed' : c.short === 'Kingsmere' || c.short === 'Pemberton' ? 'Overdue' : i % 3 === 0 ? 'Due' : 'Paid';
    out.push({
      id: `NW-${4400 + i * 3}`, direction: 'receivable', counterparty: c.name, clientId: c.id, period: 'Oct 2026',
      amountUsd: Math.round(monthly + (c.status === 'onboarding' ? c.arrUsd * 0.3 : 0)), status, dueDays: status === 'Overdue' ? -r.int(6, 21) : status === 'Paid' ? -r.int(1, 9) : r.int(4, 28),
      lines: [
        { label: `HexaView ${c.tier} (monthly)`, amount: Math.round(clientMargin(c).licence * 0.97 / 12) },
        { label: `${c.services.length} managed services (monthly)`, amount: Math.round(clientMargin(c).services * 0.97 / 12) },
        ...(c.status === 'onboarding' ? [{ label: 'Onboarding professional services (milestone 1)', amount: Math.round(c.arrUsd * 0.3) }] : []),
      ],
    });
  });
  return out;
}

export interface CommissionLine {
  quarter: string;
  resaleMargin: number;
  servicesMargin: number;
  referralFees: number;
  rebate: number;
  spif: number;
  status: 'Paid' | 'Accruing' | 'Approved';
}
export function commissions(): CommissionLine[] {
  const book = clientBook();
  const annualMargin = book.reduce((s, c) => s + clientMargin(c).margin, 0);
  const r = rng('partner-commission');
  return ['Q4 FY26', 'Q1 FY27', 'Q2 FY27', 'Q3 FY27'].map((q, i) => {
    const g = 0.82 + i * 0.06;
    return {
      quarter: q,
      resaleMargin: Math.round((annualMargin / 4) * 0.62 * g),
      servicesMargin: Math.round((annualMargin / 4) * 0.38 * g),
      referralFees: r.int(6, 22) * 1000,
      rebate: Math.round((annualMargin / 4) * 0.06 * g),
      spif: [5000, 7500, 2500, 10000][i],
      status: i === 3 ? 'Accruing' : i === 2 ? 'Approved' : 'Paid',
    };
  });
}
export const SPIFS = [
  { name: 'HexaOT new logo', rule: 'US$2,500 per new OT client signed', earned: 2, value: 5000, ends: 'Dec 2026' },
  { name: 'Agentic SOC upgrade', rule: 'US$1,500 per Essentials → Professional upgrade', earned: 1, value: 1500, ends: 'Nov 2026' },
  { name: 'Multi-year commit', rule: '+2% margin on 3-year terms', earned: 3, value: 3500, ends: 'Mar 2027' },
];

export interface Ticket {
  id: string;
  title: string;
  clientId?: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  category: 'Platform' | 'Connector' | 'Billing' | 'Deal desk' | 'White label' | 'Service delivery' | 'Enablement';
  status: 'Open' | 'With HexaShield' | 'Awaiting partner' | 'Resolved';
  ageHours: number;
  slaHours: number;
  owner: string;
  assignee: string;
  updates: { who: string; text: string; hoursAgo: number }[];
}
export function tickets(): Ticket[] {
  const id = (s: string) => clientBook().find((c) => c.short === s)?.id;
  return [
    { id: 'PS-7781', title: 'Kestrel: P1 SLA credit calculation for the August incident', clientId: id('Kestrel'), priority: 'P2', category: 'Billing', status: 'With HexaShield', ageHours: 30, slaHours: 24, owner: 'Freya Watts', assignee: 'HexaShield Billing', updates: [{ who: 'Freya Watts', text: 'Client is asking for 10% credit; our calc says 4%. Need HexaShield view before renewal call on Friday.', hoursAgo: 30 }, { who: 'HexaShield Billing', text: 'Reviewing against the MDR SLA schedule; response by end of day.', hoursAgo: 6 }] },
    { id: 'PS-7779', title: 'Kingsmere: raise Essentials integration cap or upgrade path', clientId: id('Kingsmere'), priority: 'P3', category: 'Deal desk', status: 'Awaiting partner', ageHours: 52, slaHours: 48, owner: 'Ravi Patel', assignee: 'Deal desk', updates: [{ who: 'Deal desk', text: 'Essentials is capped at 5. Options: add-on integration (US$2,400/yr) or Professional with a 12% first-year step-down. Which should we quote?', hoursAgo: 20 }] },
    { id: 'PS-7776', title: 'Vireo: Debrecen tenant stuck at data plane step', clientId: id('Vireo'), priority: 'P2', category: 'Platform', status: 'With HexaShield', ageHours: 18, slaHours: 8, owner: 'Jack Turner', assignee: 'Nadia Kerr', updates: [{ who: 'Jack Turner', text: 'Edge agent registers then drops heartbeat after 4 min. Logs attached.', hoursAgo: 18 }, { who: 'Nadia Kerr', text: 'Proxy is stripping the mTLS header. Workaround sent; fix in agent 1.9.5.', hoursAgo: 3 }] },
    { id: 'PS-7772', title: 'White-label: custom domain TLS renewal for portal.northwindcyber.com', priority: 'P3', category: 'White label', status: 'Resolved', ageHours: 70, slaHours: 48, owner: 'Jack Turner', assignee: 'HexaShield Platform', updates: [{ who: 'HexaShield Platform', text: 'Certificate renewed and auto-renew re-enabled after CAA record fix.', hoursAgo: 40 }] },
    { id: 'PS-7770', title: 'Halcyon: Veeam connector field drift since v12.2', clientId: id('Halcyon'), priority: 'P3', category: 'Connector', status: 'With HexaShield', ageHours: 96, slaHours: 72, owner: 'Marcus Chen', assignee: 'Connector team', updates: [{ who: 'Connector team', text: 'Mapping update scheduled in connector release 2026.10.2.', hoursAgo: 12 }] },
    { id: 'PS-7766', title: 'Greyfriars: escalation on missed P1 acknowledgement', clientId: id('Greyfriars'), priority: 'P1', category: 'Service delivery', status: 'Open', ageHours: 3, slaHours: 4, owner: 'Tom Ellery', assignee: 'HexaShield Service Delivery', updates: [{ who: 'Tom Ellery', text: 'Client exec wants a joint RCA before the renewal decision. Need a HexaShield SDM on the call.', hoursAgo: 3 }] },
    { id: 'PS-7761', title: 'Deal registration DR-2052 overlap with HexaShield direct', priority: 'P3', category: 'Deal desk', status: 'With HexaShield', ageHours: 40, slaHours: 48, owner: 'Grace Okafor', assignee: 'Deal desk', updates: [{ who: 'Deal desk', text: 'Checking with the direct NHS team; decision inside the 2-business-day window.', hoursAgo: 10 }] },
    { id: 'PS-7755', title: 'Mercy Ridge: copilot token usage spike in September', clientId: id('Mercy Ridge'), priority: 'P4', category: 'Billing', status: 'Resolved', ageHours: 160, slaHours: 120, owner: 'Ravi Patel', assignee: 'HexaShield Billing', updates: [{ who: 'HexaShield Billing', text: 'Spike traced to a scheduled board-pack generation loop; tokens credited.', hoursAgo: 110 }] },
    { id: 'PS-7749', title: 'Request: Spanish translation of the OT datasheet', priority: 'P4', category: 'Enablement', status: 'Resolved', ageHours: 220, slaHours: 240, owner: 'Elena Novak', assignee: 'Partner marketing', updates: [{ who: 'Partner marketing', text: 'Published in the Content Library.', hoursAgo: 90 }] },
    { id: 'PS-7744', title: 'Tamsin Aero: PoV success criteria sign-off template', clientId: id('Tamsin Aero'), priority: 'P3', category: 'Deal desk', status: 'Resolved', ageHours: 260, slaHours: 48, owner: 'Daniel Moretti', assignee: 'Nadia Kerr', updates: [{ who: 'Nadia Kerr', text: 'Template shared; added OT-specific criteria.', hoursAgo: 240 }] },
  ];
}
export const PRIORITY_COLOR: Record<Ticket['priority'], string> = { P1: 'var(--sev-critical)', P2: 'var(--sev-high)', P3: 'var(--sev-medium)', P4: 'var(--sev-info)' };
