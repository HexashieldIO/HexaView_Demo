// HexaShield services retainer: the draw-down service catalogue. Rates are
// indicative and set by HexaShield; amounts are USD. Each service says where it
// is delivered in HexaView so the retainer can deep-link to it.
import type { CustomerProfile } from '../types';

export type ServiceCategory = 'Offensive security' | 'Incident response' | 'Advisory & GRC' | 'Threat & detection' | 'People';
export const SERVICE_CATEGORIES: ServiceCategory[] = ['Offensive security', 'Incident response', 'Advisory & GRC', 'Threat & detection', 'People'];
export const CATEGORY_COLOR: Record<ServiceCategory, string> = {
  'Offensive security': '#f8646f', 'Incident response': '#f5a83d', 'Advisory & GRC': '#a07cfb', 'Threat & detection': '#4f8cff', People: '#2dd4bf',
};

export type ServiceUnit = 'engagement' | 'hour' | 'day' | 'fixed fee';
export interface RetainerService {
  id: string;
  category: ServiceCategory;
  name: string;
  unit: ServiceUnit;
  /** Indicative USD rate per unit — set by HexaShield. */
  usd: number;
  /** Typical size, e.g. "5 days" or "1 engagement". */
  typical: string;
  typicalQty: number;
  /** Where it is delivered in HexaView. */
  link: string;
  note?: string;
}

export const RATE_NOTE = 'indicative — set by HexaShield';
/** Rate for IR retainer hours (shared with the IR module). */
export const IR_HOUR_USD = 350;
export const IR_SLA = 'Priority response: 1 h remote, 24 h on-site';

const BASE: RetainerService[] = [
  // Offensive security
  { id: 'ai-pt', category: 'Offensive security', name: 'AI penetration testing', unit: 'engagement', usd: 1_899, typical: '1 web app test (priced by the AI quote model)', typicalQty: 1, link: '/strike/aipentest?section=pricing' },
  { id: 'manual-pt', category: 'Offensive security', name: 'Manual penetration testing', unit: 'day', usd: 1_600, typical: '5 days', typicalQty: 5, link: '/strike/pentest' },
  { id: 'red-team', category: 'Offensive security', name: 'Red team engagement', unit: 'fixed fee', usd: 45_000, typical: '1 objective-based campaign', typicalQty: 1, link: '/strike/redteam' },
  { id: 'purple-team', category: 'Offensive security', name: 'Purple team exercise', unit: 'day', usd: 1_800, typical: '3 days', typicalQty: 3, link: '/strike/purple' },
  { id: 'code-review', category: 'Offensive security', name: 'Source code review', unit: 'engagement', usd: 6_500, typical: '1 codebase', typicalQty: 1, link: '/strike/aipentest?section=scoping&types=Source%20code%20review' },
  // Incident response
  { id: 'ir-hours', category: 'Incident response', name: 'IR retainer hours', unit: 'hour', usd: IR_HOUR_USD, typical: '20 hours', typicalQty: 20, link: '/incident-response/warroom', note: IR_SLA },
  { id: 'ir-callout', category: 'Incident response', name: 'Emergency on-site call-out', unit: 'fixed fee', usd: 4_500, typical: '1 call-out', typicalQty: 1, link: '/incident-response/warroom' },
  { id: 'forensics', category: 'Incident response', name: 'Digital forensics investigation', unit: 'day', usd: 2_200, typical: '4 days', typicalQty: 4, link: '/incident-response/evidence' },
  { id: 'ransom-support', category: 'Incident response', name: 'Ransomware negotiation support', unit: 'day', usd: 2_500, typical: '2 days', typicalQty: 2, link: '/incident-response/warroom' },
  { id: 'ir-readiness', category: 'Incident response', name: 'IR readiness assessment', unit: 'fixed fee', usd: 8_000, typical: '1 assessment', typicalQty: 1, link: '/incident-response/playbooks' },
  { id: 'tabletop', category: 'Incident response', name: 'Tabletop exercise', unit: 'fixed fee', usd: 6_500, typical: '1 facilitated exercise', typicalQty: 1, link: '/ops/exercises' },
  // Advisory & GRC
  { id: 'vciso', category: 'Advisory & GRC', name: 'vCISO hours', unit: 'hour', usd: 300, typical: '16 hours a month', typicalQty: 16, link: '/programme/overview' },
  { id: 'risk-assessment', category: 'Advisory & GRC', name: 'Cyber risk assessment', unit: 'fixed fee', usd: 9_000, typical: '1 assessment', typicalQty: 1, link: '/insurance/quantification' },
  { id: 'policy-pack', category: 'Advisory & GRC', name: 'Policy pack development', unit: 'fixed fee', usd: 7_500, typical: '1 policy set', typicalQty: 1, link: '/comply/caas?section=frameworks' },
  { id: 'tprm-assessment', category: 'Advisory & GRC', name: 'Third-party risk assessment', unit: 'engagement', usd: 1_200, typical: '5 vendors (per vendor)', typicalQty: 5, link: '/comply/tprm' },
  { id: 'board-briefing', category: 'Advisory & GRC', name: 'Board security briefing', unit: 'fixed fee', usd: 3_500, typical: '1 briefing', typicalQty: 1, link: '/board/meeting' },
  // Threat & detection
  { id: 'threat-hunt', category: 'Threat & detection', name: 'Threat hunt', unit: 'engagement', usd: 9_500, typical: '1 hypothesis-led hunt', typicalQty: 1, link: '/soc/hunting' },
  { id: 'compromise-assessment', category: 'Threat & detection', name: 'Compromise assessment', unit: 'fixed fee', usd: 14_000, typical: '1 assessment', typicalQty: 1, link: '/soc/hunting' },
  { id: 'detection-sprint', category: 'Threat & detection', name: 'Detection engineering sprint', unit: 'day', usd: 1_700, typical: '5 days', typicalQty: 5, link: '/soc/detection' },
  { id: 'cloud-review', category: 'Threat & detection', name: 'Cloud security review', unit: 'fixed fee', usd: 11_000, typical: '1 review', typicalQty: 1, link: '/fabric/cloud' },
  { id: 'ot-assessment', category: 'Threat & detection', name: 'OT security assessment', unit: 'fixed fee', usd: 18_000, typical: '1 site assessment', typicalQty: 1, link: '/ot/visibility' },
  // People
  { id: 'awareness', category: 'People', name: 'Security awareness training session', unit: 'fixed fee', usd: 2_500, typical: '1 session', typicalQty: 1, link: '/comply/human' },
  { id: 'phishing', category: 'People', name: 'Phishing simulation campaign', unit: 'fixed fee', usd: 4_000, typical: '1 campaign', typicalQty: 1, link: '/comply/human' },
];

const COMPLIANCE_TARGETS: [RegExp, string][] = [
  [/iso\s?27001/i, 'ISO 27001'], [/soc\s?2/i, 'SOC 2'], [/cmmc/i, 'CMMC'], [/nis2/i, 'NIS2'], [/\bhia\b|healthcare information/i, 'HIA'], [/\btpn\b/i, 'TPN'],
];

/** Frameworks the customer actually holds that a readiness assessment can target. */
export function readinessFrameworks(c: CustomerProfile): string[] {
  const names = c.frameworks.map((f) => `${f.short} ${f.name}`);
  const found = COMPLIANCE_TARGETS.filter(([re]) => names.some((n) => re.test(n))).map(([, label]) => label);
  return found.length ? found : ['ISO 27001'];
}

/** The catalogue for a customer: OT assessment only where they run OT; readiness per framework. */
export function servicesFor(c: CustomerProfile): RetainerService[] {
  const hasOt = c.tenants.some((t) => t.env.includes('ot'));
  const readiness = readinessFrameworks(c).slice(0, 3).map((fw): RetainerService => ({
    id: `readiness-${fw.toLowerCase().replace(/[^a-z0-9]+/g, '')}`, category: 'Advisory & GRC', name: `Compliance readiness assessment — ${fw}`,
    unit: 'fixed fee', usd: 12_000, typical: '1 assessment', typicalQty: 1, link: '/comply/caas?section=frameworks',
  }));
  const list = BASE.filter((s) => s.id !== 'ot-assessment' || hasOt);
  const at = list.findIndex((s) => s.id === 'risk-assessment');
  return [...list.slice(0, at), ...readiness, ...list.slice(at)];
}

export function serviceById(c: CustomerProfile, id: string): RetainerService | undefined {
  return servicesFor(c).find((s) => s.id === id);
}

export const unitLabel = (u: ServiceUnit, qty: number) => (u === 'hour' ? (qty === 1 ? 'hour' : 'hours') : u === 'day' ? (qty === 1 ? 'day' : 'days') : u === 'engagement' ? (qty === 1 ? 'engagement' : 'engagements') : 'fixed fee');
