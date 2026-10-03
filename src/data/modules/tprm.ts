// HexaComply · Third-Party Risk workspace (original HexaComply TPRM parity).
// Every supplier in the vendor register is scored against up to twelve checks on its own
// record, grouped into five domains. Higher is worse. Built on top of the vendor register in
// comply.ts (read-only) so totals and high-risk counts agree with headlines().
import type { CustomerId, CustomerProfile } from '../types';
import { vendors, ratingsSource, type Vendor } from './comply';
import { headlines } from '../core';
import { rng } from '../../lib/rng';
import { daysAgo, daysAhead, isoDate } from '../../lib/format';

/* =====================================================================
   Domains and the twelve checks
   ===================================================================== */
export const TP_DOMAINS = ['Cyber security', 'Data privacy', 'Business continuity', 'Incident reporting', 'Oversight & review'] as const;
export type TpDomain = (typeof TP_DOMAINS)[number];

export const TP_DOMAIN_META: Record<TpDomain, { blurb: string; reads: string[]; hex: string }> = {
  'Cyber security': { blurb: 'Security terms in the contract, certification held, and how access is controlled.', reads: ['Security clauses', 'Certifications', 'Access rights', 'Access controls'], hex: '#4f8cff' },
  'Data privacy': { blurb: 'What we share with them, how it is classified, and the agreement covering it.', reads: ['Information shared', 'Classification', 'Compliance requirements'], hex: '#a78bfa' },
  'Business continuity': { blurb: 'Service levels agreed, and what we would fall back on.', reads: ['Service level agreements', 'Mitigation measures'], hex: '#f5a83d' },
  'Incident reporting': { blurb: 'The agreed route for telling us something has gone wrong.', reads: ['Incident reporting', 'Notification window'], hex: '#f8646f' },
  'Oversight & review': { blurb: 'Whether the relationship is monitored, and whether the review is current.', reads: ['Monitoring schedule', 'Review date', 'Record status'], hex: '#2dd4bf' },
};

export type TpCheckId = 'cert' | 'nda' | 'access' | 'dpa' | 'class' | 'sla' | 'mitig' | 'route' | 'window' | 'monitor' | 'review' | 'confirm';
export interface TpCheck { id: TpCheckId; domain: TpDomain; label: string }
/** The twelve register checks, in domain order. */
export const TP_CHECKS: TpCheck[] = [
  { id: 'cert', domain: 'Cyber security', label: 'Independent certification on file' },
  { id: 'nda', domain: 'Cyber security', label: 'NDA alongside the security terms' },
  { id: 'access', domain: 'Cyber security', label: 'Access controls recorded' },
  { id: 'dpa', domain: 'Data privacy', label: 'Processing agreement for regulated data' },
  { id: 'class', domain: 'Data privacy', label: 'Information shared is classified' },
  { id: 'sla', domain: 'Business continuity', label: 'Service level agreed' },
  { id: 'mitig', domain: 'Business continuity', label: 'Mitigation recorded against the risk' },
  { id: 'route', domain: 'Incident reporting', label: 'Agreed incident reporting route' },
  { id: 'window', domain: 'Incident reporting', label: 'Notification window within policy' },
  { id: 'monitor', domain: 'Oversight & review', label: 'Monitoring schedule set' },
  { id: 'review', domain: 'Oversight & review', label: 'Review is current' },
  { id: 'confirm', domain: 'Oversight & review', label: 'Register entry confirmed' },
];
export const TP_CHECK_BY_ID = Object.fromEntries(TP_CHECKS.map((k) => [k.id, k])) as Record<TpCheckId, TpCheck>;

/* =====================================================================
   Types
   ===================================================================== */
export type TpLevel = 'High' | 'Medium' | 'Low';
export const TP_LEVEL_COLOR: Record<TpLevel, string> = { High: 'var(--sev-critical)', Medium: 'var(--sev-medium)', Low: 'var(--good)' };
export type TpState = Vendor['state'];
export const TP_STATES: TpState[] = ['Active', 'Under review', 'Pending docs', 'Escalated', 'Archived'];
export const TP_STATE_COLOR: Record<TpState, string> = { Active: 'var(--good)', 'Under review': 'var(--m-matrix)', 'Pending docs': 'var(--sev-medium)', Escalated: 'var(--bad)', Archived: 'var(--text-muted)' };

export interface TpGap {
  key: string;
  supplierId: string;
  supplierName: string;
  check: TpCheckId;
  domain: TpDomain;
  title: string;
  guidance: string;
  /** Supplier score at generation, used to order recommendations worst first. */
  score: number;
}

export interface TpRenewal { kind: 'date' | 'open' | 'overdue'; date?: string; days: number }

export interface TpSupplier {
  v: Vendor;
  id: string;
  name: string;
  mono: string;
  service: string;
  contact: string;
  score: number;
  level: TpLevel;
  applicable: number;
  failed: number;
  domains: Record<TpDomain, number | null>;
  results: Partial<Record<TpCheckId, boolean>>;
  gaps: TpGap[];
  renewal: TpRenewal;
  inScope: string[];
  classification: string;
  certifications: string[];
  monitoring: string;
  recordedRisk: TpLevel;
  contractStart: string;
  lastReview: string;
  nextReview: string;
  state: TpState;
  live: boolean;
  slas: string;
  incidentRoute: string;
  accessControls: string;
  seedTasked: TpCheckId[];
}

export type TpPriority = 'High' | 'Medium' | 'Low';
export const TP_PRIORITY_COLOR: Record<TpPriority, string> = { High: 'var(--sev-critical)', Medium: 'var(--sev-medium)', Low: 'var(--sev-info)' };
export interface TpTask {
  id: string;
  gapKey: string;
  supplierId: string;
  supplierName: string;
  check: TpCheckId;
  domain: TpDomain;
  title: string;
  priority: TpPriority;
  owner: string;
  raisedDaysAgo: number;
  dueInDays: number;
  done: boolean;
  completedDaysAgo?: number;
  note?: string;
  byUser?: boolean;
}

export type QaCol = 'Draft' | 'Sent' | 'Submitted' | 'Approved' | 'Rejected';
export const QA_COLS: { id: QaCol; sub: string; color: string }[] = [
  { id: 'Draft', sub: 'Not sent yet', color: 'var(--text-muted)' },
  { id: 'Sent', sub: 'With the supplier', color: 'var(--m-matrix)' },
  { id: 'Submitted', sub: 'Back with us, unreviewed', color: 'var(--sev-medium)' },
  { id: 'Approved', sub: 'Reviewed and accepted', color: 'var(--good)' },
  { id: 'Rejected', sub: 'Sent back for more', color: 'var(--bad)' },
];
export type QSetId = 'initial' | 'annual' | 'critical' | 'privacy';
export interface QSet { id: QSetId; name: string; questions: number; blurb: string; domains: TpDomain[]; annex: string; sample: string[]; use: string }
export interface TpQuestionnaire { id: string; supplierId: string; set: QSetId; col: QaCol; sentDaysAgo: number | null; dueInDays: number | null; returnedDaysAgo: number | null }

export type TpLogType = 'Created' | 'Updated' | 'Status changed' | 'Closed' | 'Removed';
export const TP_LOG_TYPES: TpLogType[] = ['Created', 'Updated', 'Status changed', 'Closed', 'Removed'];
export const TP_LOG_COLOR: Record<TpLogType, string> = { Created: 'var(--good)', Updated: 'var(--m-matrix)', 'Status changed': 'var(--sev-medium)', Closed: 'var(--m-comply)', Removed: 'var(--bad)' };
export interface TpLogEntry { id: string; minutesAgo: number; supplierId: string; supplierName: string; event: string; type: TpLogType; by: string }

/* =====================================================================
   Sector vocabulary
   ===================================================================== */
const CONTACT_FIRST: Record<CustomerId, string[]> = {
  maritime: ['Jeroen', 'Sanne', 'Lars', 'Ingrid', 'Ahmad', 'Mei Ling', 'Tomas', 'Fenna', 'Ricardo', 'Hamid', 'Eline', 'Bram'],
  finserv: ['Oliver', 'Hannah', 'Rajesh', 'Claire', 'Marcus', 'Aisha', 'Tom', 'Sophie', 'Daniel', 'Freya', 'Nikhil', 'Laura'],
  media: ['Jordan', 'Casey', 'Avery', 'Morgan', 'Riley', 'Dana', 'Quinn', 'Robin', 'Sam', 'Taylor', 'Jamie', 'Alex'],
  healthcare: ['Megan', 'Tyler', 'Brandon', 'Ashley', 'Nicole', 'Derek', 'Kayla', 'Justin', 'Monica', 'Travis', 'Heather', 'Luis'],
  automotive: ['Lukas', 'Anna', 'Jonas', 'Lea', 'Felix', 'Marie', 'Tobias', 'Katrin', 'Stefan', 'Eva', 'Miroslav', 'Paula'],
};
const CONTACT_LAST: Record<CustomerId, string[]> = {
  maritime: ['de Vries', 'Peeters', 'Hansen', 'Lindqvist', 'Tan', 'Rahman', 'Costa', 'Bakker', 'Jensen', 'Verhoeven'],
  finserv: ['Hughes', 'Patel', 'Clarke', 'Okafor', 'Reid', 'Shah', 'Fletcher', 'Moreau', 'Kaur', 'Whitfield'],
  media: ['Osei', 'Marino', 'Fernandez', 'Lindqvist', 'Tanaka', 'Verhoeven', 'Brooks', 'Nakamura', 'Ellis', 'Romero'],
  healthcare: ['Miller', 'Johnson', 'Kowalski', 'Nguyen', 'Brennan', 'Okonkwo', 'Schmidt', 'Reyes', 'Hayes', 'Patterson'],
  automotive: ['Müller', 'Schneider', 'Fischer', 'Weber', 'Becker', 'Novák', 'Horváth', 'Kowalczyk', 'Richter', 'Hoffmann'],
};

function regimes(c: CustomerProfile, v: Vendor): string[] {
  const d = v.dataAccess;
  const out: string[] = [];
  switch (c.id) {
    case 'finserv':
      if (v.cif) out.push('DORA CIF');
      if (d.includes('Payments')) out.push('PCI DSS');
      if (d.includes('Personal data')) out.push('GDPR');
      if (v.tier === 1 && /cloud|core|card|outsourc|coloc/i.test(v.category)) out.push('PRA SS2/21');
      break;
    case 'healthcare':
      if (d.includes('PHI')) out.push('HIPAA');
      if (d.includes('Medical device')) out.push('FDA 524B');
      if (d.includes('PHI') && v.tier <= 2) out.push('HITRUST');
      if (d.includes('Payments')) out.push('PCI DSS');
      break;
    case 'automotive':
      if (d.includes('Prototype')) out.push('TISAX');
      if (d.includes('OT')) out.push('IEC 62443');
      if (d.includes('Vehicle data') || /telematics|OTA|ECU/i.test(v.access + v.category)) out.push('UNECE R155');
      if (d.includes('Personal data') || d.includes('Vehicle data')) out.push('GDPR');
      if (v.tier === 1 && !d.includes('Prototype')) out.push('NIS2');
      break;
    case 'media':
      if (d.includes('Pre-release')) out.push('TPN');
      if (d.includes('Personal data')) out.push('GDPR / CCPA');
      if (d.includes('Payments')) out.push('PCI DSS');
      break;
    case 'maritime':
      if (d.includes('OT')) out.push(/vessel|engine|cargo|VSAT|LEO|ship/i.test(v.access + v.category) ? 'IACS E27' : 'IEC 62443');
      if (/gate|guard|CCTV|badge|security/i.test(v.access + v.category)) out.push('ISPS');
      if (d.includes('Personal data')) out.push('GDPR');
      if (v.tier <= 2 && !d.includes('OT')) out.push('NIS2');
      break;
  }
  if (v.tier === 1) out.push('Critical');
  return out;
}

function classification(v: Vendor): string {
  const d = v.dataAccess.join(' ');
  if (/Pre-release|Prototype|PHI|Payments/.test(d)) return 'Restricted';
  if (/Personal|Vehicle/.test(d)) return 'Confidential · personal data';
  if (/OT|Medical device/.test(d)) return 'Confidential · operational';
  if (/Confidential/.test(d)) return 'Confidential';
  return 'Internal';
}

const regulated = (v: Vendor) => v.dataAccess.some((d) => /Personal|PHI|Payments|Vehicle/.test(d));

/** Sector wording of a failed check: title + guidance sentence (the gap catalogue). */
function gapText(c: CustomerProfile, v: Vendor, id: TpCheckId): { title: string; guidance: string } {
  const pam = c.connectors.find((k) => k.category === 'PAM')?.product ?? 'the PAM jump host';
  const src = ratingsSource(c);
  switch (id) {
    case 'cert':
      if (c.id === 'automotive' && v.dataAccess.includes('Prototype')) return { title: v.tisax === 'No label' || !v.tisax ? 'Receives prototype data without a TISAX label' : `TISAX label ${v.tisax.toLowerCase()} for prototype protection`, guidance: 'VDA ISA requires an AL3 label with prototype protection before prototype data is shared. Hold OFTP2 transfers until it is assessed.' };
      if (c.id === 'media' && v.dataAccess.includes('Pre-release')) return { title: 'Receives pre-release content without a current TPN shield', guidance: 'Ask for a TPN+ assessment. Custody policy can hold deliveries to this vendor until the shield is current.' };
      if (c.id === 'healthcare' && v.dataAccess.includes('PHI')) return { title: 'No HITRUST or SOC 2 report on file', guidance: 'Request the current HITRUST r2 or SOC 2 Type II report, or record why the business associate is out of scope for one.' };
      if (c.id === 'finserv' && v.cif) return { title: 'No independent assurance for a critical ICT provider', guidance: 'DORA Art. 28 expects ISO 27001 or SOC 2 Type II evidence, or a pooled audit, before relying on the provider.' };
      if (c.id === 'maritime' && v.dataAccess.includes('OT')) return { title: 'No IEC 62443-2-4 or IACS E27 evidence on file', guidance: 'Ask for the service-provider certificate or the type-approval evidence for the systems they maintain.' };
      return { title: 'No third-party certification on file', guidance: 'Request the current ISO 27001 or SOC 2 report, or record why the supplier is out of scope for one.' };
    case 'nda':
      return { title: 'Security terms in place, but no NDA', guidance: 'The contract carries security terms. Add an NDA so confidentiality survives the contract ending.' };
    case 'access':
      if (v.otRemote && c.id === 'healthcare') return { title: 'Remote device service with no session recording on file', guidance: `OEM sessions to clinical devices must be brokered and recorded in ${pam}. Medical devices are read-only in HexaView by policy.` };
      if (v.otRemote) return { title: 'Remote OT access with no access controls recorded', guidance: `Sessions must run through ${pam} with recording and named accounts. OT is read-only in HexaView by policy.` };
      return { title: 'System access with no access controls recorded', guidance: 'They hold access and the register does not say how it is controlled. Confirm SSO, MFA and the review cycle.' };
    case 'dpa':
      if (c.id === 'healthcare' && v.dataAccess.includes('PHI')) return { title: v.baa === 'Expired' ? 'Business Associate Agreement has expired' : 'PHI shared without a signed Business Associate Agreement', guidance: 'HIPAA 164.308(b) requires a BAA before ePHI is disclosed. Route the HexaShield BAA template to legal.' };
      if (c.id === 'automotive' && v.dataAccess.includes('Vehicle data')) return { title: 'No processing agreement for vehicle and driver data', guidance: 'Connected-car data is personal data under GDPR. A processor agreement with sub-processor terms is needed before the next transfer.' };
      if (c.id === 'finserv' && v.dataAccess.includes('Payments')) return { title: 'No PCI DSS responsibility matrix for cardholder data', guidance: 'Agree which PCI DSS 4.0 requirements the provider owns (Req. 12.8.5) and get its AOC.' };
      if (c.id === 'media') return { title: 'No processing agreement for personal data', guidance: 'They process talent or subscriber data on our behalf, so a GDPR / CCPA processor agreement is required before the next transfer.' };
      return { title: 'No processing agreement for personal data', guidance: 'They process personal data on our behalf, so a GDPR processor agreement is required before the next transfer.' };
    case 'class':
      return { title: 'Information shared is not classified', guidance: 'Record what we share and its classification, so the right handling rules follow it to the supplier.' };
    case 'sla':
      if (c.id === 'maritime' && v.dataAccess.includes('OT')) return { title: 'No service level for OT fault response', guidance: 'Nothing commits them to a response time when a crane, AGV or vessel system is down. Agree one with the terminal.' };
      if (c.id === 'healthcare' && v.otRemote) return { title: 'No uptime commitment for a clinical system', guidance: 'Agree response and restore times aligned to the clinical downtime procedure for this device.' };
      return { title: 'No service level agreed', guidance: 'Nothing commits the supplier to a recovery time. Agree one, or record what we would do without them.' };
    case 'mitig':
      if (c.id === 'finserv' && v.cif) return { title: 'No tested exit strategy for a critical ICT provider', guidance: 'DORA Art. 28(8) requires a documented and tested exit plan for ICT services supporting critical or important functions.' };
      if (c.id === 'automotive' && /JIT|JIS|sequenc|parts|cell/i.test(v.access + v.category)) return { title: 'No fallback recorded for a line-feeding supplier', guidance: 'A stop here stops the line. Record the dual source, buffer stock or the recovery plan we rely on.' };
      return { title: 'No mitigation recorded against a medium-or-higher risk', guidance: 'The recorded risk level has no measures beside it. Note the fallback, or the compensating control we rely on.' };
    case 'route':
      return { title: 'No agreed route for reporting an incident', guidance: 'Set a named contact and a notification deadline — 72 hours in writing is the usual ask.' };
    case 'window':
      if (c.id === 'finserv') return { title: `Incident notification window is ${v.obligations.breachNotifyHrs} h`, guidance: 'DORA major-incident timelines need the provider to tell us within 4 hours of classification. Tighten the clause at renewal.' };
      if (c.id === 'healthcare') return { title: `Breach notice window is ${v.obligations.breachNotifyHrs} h`, guidance: 'The BAA should require notice of a breach of unsecured PHI within 24 hours so the 60-day HIPAA clock can be met.' };
      if (c.id === 'automotive' || c.id === 'maritime') return { title: `Incident notification window is ${v.obligations.breachNotifyHrs} h`, guidance: 'NIS2 early warning is due within 24 hours, so the supplier must tell us sooner. Policy is notice within 24 hours in writing.' };
      return { title: `Breach notification window is ${v.obligations.breachNotifyHrs} h`, guidance: 'Policy requires notice within 24 hours in writing, with a named contact.' };
    case 'monitor':
      if (src.connector) return { title: `Not enrolled in ${src.name} monitoring`, guidance: `Add the supplier to the ${src.name} portfolio so rating drops raise an alert, and set a review cadence.` };
      return { title: 'No monitoring schedule set', guidance: 'Nothing brings this supplier back around for a look. Set a cadence proportionate to what they hold.' };
    case 'review':
      return { title: 'Review overdue', guidance: 'The next review date has passed. Re-run the assessment before relying on the current risk level.' };
    case 'confirm':
      if (c.id === 'finserv' && v.lei === false) return { title: 'No Legal Entity Identifier on the register', guidance: 'DORA Register of Information template RT.05 needs an LEI for every ICT third-party provider. Enrich it from GLEIF.' };
      return { title: 'Register entry not confirmed', guidance: 'The record is still a draft, so nothing in it has been signed off. Confirm it or complete what is missing.' };
  }
}

/* =====================================================================
   Scoring
   ===================================================================== */
function domainScores(results: Partial<Record<TpCheckId, boolean>>) {
  const domains = {} as Record<TpDomain, number | null>;
  TP_DOMAINS.forEach((d) => {
    const ks = TP_CHECKS.filter((k) => k.domain === d && results[k.id] !== undefined);
    domains[d] = ks.length ? Math.round((ks.filter((k) => results[k.id] === false).length / ks.length) * 100) : null;
  });
  const vals = Object.values(domains).filter((x): x is number => x !== null);
  const score = vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : 0;
  return { domains, score };
}

/** Facts on the record that the score enforcement must not overturn. */
function isFact(c: CustomerProfile, v: Vendor, id: TpCheckId): boolean {
  if (id === 'review' || id === 'window') return true;
  if (id === 'confirm') return true;
  if (id === 'dpa' && c.id === 'healthcare' && v.dataAccess.includes('PHI')) return true;
  if (id === 'cert' && ((c.id === 'automotive' && v.dataAccess.includes('Prototype')) || (c.id === 'media' && v.dataAccess.includes('Pre-release')))) return true;
  return false;
}

function buildSupplier(c: CustomerProfile, v: Vendor, ratingsConnector: boolean): TpSupplier {
  const r = rng(`tprm-${c.id}-${v.id}`);
  const f = (100 - v.rating) / 100 + (v.highRisk ? 0.3 : 0) + (v.tier === 1 ? 0.05 : 0);
  const res: Partial<Record<TpCheckId, boolean>> = {};
  const pass = (p: number) => !r.chance(Math.max(0, Math.min(0.95, p)));
  // Cyber security
  if (v.tier <= 2 || v.dataAccess.some((d) => /Prototype|Pre-release|PHI|OT/.test(d))) {
    if (c.id === 'automotive' && v.dataAccess.includes('Prototype')) res.cert = v.tisax === 'AL3 valid';
    else if (c.id === 'media' && v.dataAccess.includes('Pre-release')) res.cert = !(v.tpn === 'Not assessed' || v.tpn === 'Expired');
    else res.cert = !(v.findings > 5 || v.rating < 64) && pass(0.14 + f * 0.45);
  }
  res.nda = pass(0.2 + f * 0.4);
  if (!/physical|badge|shred/i.test(v.access + v.category)) res.access = v.otRemote ? v.obligations.rightToAudit && pass(0.1 + f * 0.4) : pass(0.16 + f * 0.45);
  // Data privacy
  if (regulated(v)) res.dpa = c.id === 'healthcare' && v.dataAccess.includes('PHI') ? v.baa === 'Signed' : pass(0.18 + f * 0.42);
  res.class = pass(0.14 + f * 0.36);
  // Business continuity
  if (v.tier <= 2) res.sla = pass(0.2 + f * 0.45);
  if (v.highRisk || v.rating < 72 || v.tier === 1) res.mitig = c.id === 'finserv' && v.cif ? v.obligations.exitPlan : pass(v.highRisk ? 0.55 : 0.28 + f * 0.3);
  // Incident reporting
  res.route = pass(0.18 + f * 0.42);
  res.window = v.obligations.breachNotifyHrs <= 24;
  // Oversight & review
  res.monitor = ratingsConnector ? !r.chance(v.tier === 3 ? 0.5 : v.tier === 2 ? 0.18 : 0.06) : pass(0.24 + f * 0.4);
  res.review = v.assessment !== 'Overdue';
  res.confirm = !(v.assessment === 'Not started' || v.assessment === 'Sent' || (c.id === 'finserv' && v.lei === false));

  // Keep the score consistent with the high-risk headline: high-risk suppliers score at least 62,
  // everyone else at most 58.
  let { score } = domainScores(res);
  const order = r.shuffle(TP_CHECKS.map((k) => k.id));
  if (v.highRisk) {
    for (const id of order) {
      if (score >= 62) break;
      if (res[id] === true && !isFact(c, v, id)) { res[id] = false; score = domainScores(res).score; }
    }
  } else {
    const soft = order.filter((id) => !isFact(c, v, id));
    for (const id of [...soft, ...order.filter((id) => isFact(c, v, id) && id !== 'review' && id !== 'confirm' && id !== 'dpa' && id !== 'cert')]) {
      if (score <= 58) break;
      if (res[id] === false) { res[id] = true; score = domainScores(res).score; }
    }
  }
  const { domains } = domainScores(res);
  score = domainScores(res).score;
  if (v.highRisk) score = Math.max(62, score);
  else score = Math.min(58, score);

  const failedIds = TP_CHECKS.filter((k) => res[k.id] === false).map((k) => k.id);
  const gaps: TpGap[] = failedIds.map((id) => ({ key: `${v.id}:${id}`, supplierId: v.id, supplierName: v.name, check: id, domain: TP_CHECK_BY_ID[id].domain, score, ...gapText(c, v, id) }));
  const level: TpLevel = v.highRisk ? 'High' : score >= 34 ? 'Medium' : 'Low';

  const live = v.state !== 'Archived';
  const open = r.chance(0.16) && v.tier > 1;
  const renewal: TpRenewal = !live && r.chance(0.7)
    ? { kind: 'overdue', days: -r.int(12, 140) }
    : open ? { kind: 'open', days: 9999 } : { kind: 'date', date: isoDate(daysAhead(v.contractEndDays)), days: v.contractEndDays };

  const certs: string[] = [];
  if (res.cert !== false) {
    if (c.id === 'automotive' && v.tisax && v.tisax !== 'No label' && v.tisax !== 'Expired') certs.push(`TISAX ${v.tisax.replace(' valid', '')}`);
    if (c.id === 'media' && v.tpn && v.tpn !== 'Not assessed' && v.tpn !== 'Expired') certs.push(`TPN ${v.tpn}`);
    if (c.id === 'healthcare' && v.dataAccess.includes('PHI')) certs.push(r.chance(0.5) ? 'HITRUST r2' : 'SOC 2 Type II');
    if (c.id === 'maritime' && v.dataAccess.includes('OT')) certs.push(r.chance(0.5) ? 'IEC 62443-2-4' : 'IACS E27 type approval');
    if (res.cert === true || r.chance(0.5)) certs.push(r.pick(['ISO 27001:2022', 'SOC 2 Type II', 'ISO 27001:2022', 'Cyber Essentials Plus']));
  }
  const src = ratingsSource(c);
  const contactR = rng(`tprm-contact-${c.id}-${v.id}`);
  const seedTasked = failedIds.filter(() => r.chance(v.highRisk ? 0.32 : score >= 45 ? 0.06 : 0.015));
  return {
    v,
    id: v.id,
    name: v.name,
    mono: v.name.replace(/[()/,.&-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    service: v.category,
    contact: `${contactR.pick(CONTACT_FIRST[c.id])} ${contactR.pick(CONTACT_LAST[c.id])}`,
    score,
    level,
    applicable: Object.keys(res).length,
    failed: failedIds.length,
    domains,
    results: res,
    gaps,
    renewal,
    inScope: regimes(c, v),
    classification: classification(v),
    certifications: certs,
    monitoring: res.monitor ? (src.connector ? `Continuous · ${src.name}` : v.tier === 1 ? 'Quarterly review' : v.tier === 2 ? 'Six-monthly review' : 'Annual review') : '—',
    recordedRisk: v.highRisk ? 'High' : v.tier === 1 || score >= 45 ? 'Medium' : 'Low',
    contractStart: isoDate(daysAgo(r.int(200, 1600))),
    lastReview: isoDate(daysAgo(v.lastAssessedDays)),
    nextReview: isoDate(daysAhead(v.dueInDays)),
    state: v.state,
    live,
    slas: res.sla === false ? '—' : v.tier === 1 ? r.pick(['99.95% · 4 h restore', '99.9% · P1 response 30 min', '99.9% · 8 h restore']) : v.tier === 2 ? r.pick(['99.5% · next business day', 'P1 response 2 h']) : 'Best endeavours',
    incidentRoute: res.route === false ? '—' : `Named contact · ${v.obligations.breachNotifyHrs} h in writing`,
    accessControls: res.access === false ? '—' : res.access === undefined ? 'No system access' : v.otRemote ? `Brokered via ${c.connectors.find((k) => k.category === 'PAM')?.product ?? 'PAM'} · recorded` : r.pick(['SSO + MFA · quarterly review', 'Named accounts · MFA', 'SSO via identity provider · MFA']),
    seedTasked,
  };
}

/* =====================================================================
   Public builders
   ===================================================================== */
export function tpSuppliers(c: CustomerProfile, tenantId: string): TpSupplier[] {
  const src = ratingsSource(c);
  return vendors(c, tenantId).map((v) => buildSupplier(c, v, src.connector));
}

export function tpOwners(c: CustomerProfile): string[] {
  const p = c.people;
  return [p.grcLead.name, ...(p.otLead ? [p.otLead.name] : []), ...p.staff.slice(0, 3).map((s) => s.name), p.ciso.name];
}

export function tpPriority(s: TpSupplier, g: { domain: TpDomain }): TpPriority {
  if (s.level === 'High') return g.domain === 'Cyber security' || g.domain === 'Data privacy' ? 'High' : 'Medium';
  if (s.level === 'Medium') return s.v.tier === 1 ? 'Medium' : 'Low';
  return 'Low';
}

export function tpTasks(c: CustomerProfile, tenantId: string, sup: TpSupplier[]): TpTask[] {
  const r = rng(`tprm-tasks-${c.id}-${tenantId}`);
  const owners = tpOwners(c);
  const out: Omit<TpTask, 'id'>[] = [];
  sup.forEach((s) => {
    s.gaps.filter((g) => s.seedTasked.includes(g.check)).forEach((g) => {
      const raised = r.int(1, 60);
      out.push({ gapKey: g.key, supplierId: s.id, supplierName: s.name, check: g.check, domain: g.domain, title: g.title, priority: tpPriority(s, g), owner: s.v.otRemote && c.people.otLead && g.domain === 'Cyber security' ? c.people.otLead.name : r.pick(owners), raisedDaysAgo: raised, dueInDays: r.int(-12, 45), done: false });
    });
  });
  // Completed tasks: gaps that were closed (the check now passes).
  const nDone = Math.max(3, Math.round(out.length * 0.35));
  const passing = sup.filter((s) => s.live).flatMap((s) => TP_CHECKS.filter((k) => s.results[k.id] === true && !['review', 'window'].includes(k.id)).map((k) => ({ s, k })));
  r.pickN(passing, nDone).forEach(({ s, k }) => {
    const raised = r.int(20, 120);
    out.push({ gapKey: `${s.id}:${k.id}:closed`, supplierId: s.id, supplierName: s.name, check: k.id, domain: k.domain, title: gapText(c, s.v, k.id).title, priority: tpPriority(s, k), owner: r.pick(owners), raisedDaysAgo: raised, dueInDays: 0, done: true, completedDaysAgo: r.int(1, Math.max(2, raised - 5)) });
  });
  return out.sort((a, b) => b.raisedDaysAgo - a.raisedDaysAgo).map((t, i) => ({ ...t, id: `TP-${String(i + 1).padStart(3, '0')}` }));
}

export function tpQuestionSets(c: CustomerProfile): QSet[] {
  const annex: Record<CustomerId, Record<QSetId, string>> = {
    finserv: { initial: 'DORA RoI data capture (RT.05, RT.06)', annual: 'PRA SS2/21 outsourcing review', critical: 'DORA ICT annex · exit & substitutability', privacy: 'UK GDPR / GDPR Art. 28 · PCI DSS 12.8' },
    healthcare: { initial: 'HIPAA business associate intake', annual: 'HITRUST inheritance check', critical: 'MDS2 + FDA 524B device annex', privacy: 'BAA and ePHI flow addendum' },
    automotive: { initial: 'VDA ISA self-assessment (TISAX scope)', annual: 'TISAX label & prototype protection refresh', critical: 'UNECE R155 supplier CSMS + IEC 62443-2-4', privacy: 'GDPR connected-vehicle data addendum' },
    media: { initial: 'TPN+ self-assessment', annual: 'MPA content security refresh', critical: 'TPN Gold Shield pre-release annex', privacy: 'GDPR / CCPA talent & subscriber data' },
    maritime: { initial: 'NIS2 supplier intake', annual: 'IMO / ISPS supplier refresh', critical: 'IEC 62443-2-4 & IACS E27 OT annex', privacy: 'GDPR crew & port-user data addendum' },
  };
  const a = annex[c.id];
  return [
    { id: 'initial', name: 'Initial assessment', questions: 25, blurb: 'Onboarding baseline: what they do for us, what they hold, and the controls around it.', domains: [...TP_DOMAINS], annex: a.initial, use: 'New suppliers and records still in draft', sample: ['What information will you hold or process on our behalf?', 'Which independent certifications do you hold, and when do they expire?', 'How is access to our systems controlled and reviewed?'] },
    { id: 'annual', name: 'Annual assessment', questions: 16, blurb: 'The yearly refresh: what has changed since the last review, and whether evidence is still current.', domains: ['Cyber security', 'Business continuity', 'Oversight & review'], annex: a.annual, use: 'Tier 2 and 3 suppliers at their review date', sample: ['Have there been any security incidents affecting our data in the last 12 months?', 'Have your sub-processors or hosting locations changed?', 'Please attach your current certificate or audit report.'] },
    { id: 'critical', name: 'Critical-supplier review', questions: 31, blurb: 'Deep review for suppliers whose failure would stop a critical service.', domains: [...TP_DOMAINS], annex: a.critical, use: 'Tier 1 and critical suppliers', sample: ['Describe your recovery objectives for the services you provide to us, and when you last tested them.', 'How would we exit, and to whom could the service move?', 'Within what time will you notify us of an incident, and through whom?'] },
    { id: 'privacy', name: 'Data privacy addendum', questions: 9, blurb: 'Bolt-on for suppliers that process regulated data on our behalf.', domains: ['Data privacy', 'Incident reporting'], annex: a.privacy, use: 'Suppliers processing personal or regulated data', sample: ['Where is our data stored and processed?', 'Which sub-processors touch our data?', 'How quickly will you notify us of a personal data breach?'] },
  ];
}

export function tpQuestionnaires(c: CustomerProfile, tenantId: string, sup: TpSupplier[]): TpQuestionnaire[] {
  const r = rng(`tprm-qa-${c.id}-${tenantId}`);
  const out: TpQuestionnaire[] = [];
  sup.forEach((s, i) => {
    const v = s.v;
    if (!s.live) return;
    let col: QaCol | null = null;
    if (v.assessment === 'Not started') col = 'Draft';
    else if (v.assessment === 'Sent' || v.assessment === 'In progress' || v.assessment === 'Overdue') col = 'Sent';
    else if (v.assessment === 'Under review') col = r.chance(0.22) ? 'Rejected' : 'Submitted';
    else if (v.assessment === 'Complete' && v.lastAssessedDays < 75) col = 'Approved';
    if (!col) return;
    const set: QSetId = col === 'Draft' && s.state === 'Pending docs' ? 'initial' : v.tier === 1 || s.inScope.includes('DORA CIF') ? 'critical' : regulated(v) && r.chance(0.55) ? 'privacy' : 'annual';
    const sent = col === 'Draft' ? null : r.int(6, 50);
    out.push({
      id: `QA-${100 + i * 3 + r.int(0, 2)}`,
      supplierId: s.id,
      set,
      col,
      sentDaysAgo: sent,
      dueInDays: col === 'Sent' ? (v.assessment === 'Overdue' ? -r.int(1, 30) : r.int(0, 34)) : col === 'Rejected' ? r.int(5, 21) : null,
      returnedDaysAgo: col === 'Submitted' || col === 'Approved' || col === 'Rejected' ? r.int(1, Math.max(2, (sent ?? 10) - 2)) : null,
    });
  });
  return out;
}

const LOG_TEMPLATES: Record<CustomerId, string[]> = {
  finserv: ['LEI added from GLEIF lookup', 'Exit plan attached — tabletop on 14 Aug', 'Marked as supporting a critical or important function', 'Sub-outsourcing chain updated (RT.05.02)'],
  healthcare: ['BAA countersigned by legal', 'MDS2 form uploaded for device fleet', 'Remote access moved to CyberArk brokered sessions', 'PHI data flow updated'],
  automotive: ['TISAX AL3 label recorded (prototype protection)', 'OFTP2 partner certificate renewed', 'Robot cell remote access moved behind PAM', 'Supplier CSMS evidence for R155 attached'],
  media: ['TPN Gold Shield recorded', 'Forensic watermark profile assigned', 'Pre-release delivery route moved to Aspera', 'Custody agent enforced on vendor workstations'],
  maritime: ['Jump-host route confirmed for crane PLC maintenance', 'IACS E27 evidence uploaded for newbuild systems', 'VSAT terminal firmware baseline recorded', 'ISPS gate access list refreshed'],
};

export function tpChangeLog(c: CustomerProfile, tenantId: string, sup: TpSupplier[], tasks: TpTask[]): TpLogEntry[] {
  const r = rng(`tprm-log-${c.id}-${tenantId}`);
  const n = Math.max(18, Math.min(64, Math.round(sup.length * 0.14)));
  const people = tpOwners(c);
  const out: Omit<TpLogEntry, 'id'>[] = [];
  const done = tasks.filter((t) => t.done);
  for (let i = 0; i < n; i++) {
    const s = r.pick(sup);
    const type = r.weighted<TpLogType>([['Updated', 5], ['Status changed', 4], ['Created', 1.5], ['Closed', done.length ? 2 : 0], ['Removed', 0.8]]);
    let event = '';
    switch (type) {
      case 'Created': event = `Added to the register — ${s.service.toLowerCase()}`; break;
      case 'Updated': event = r.chance(0.5) ? r.pick(LOG_TEMPLATES[c.id]) : r.pick([`Contact changed to ${s.contact}`, `Contract end set to ${s.renewal.date ?? 'open-ended'}`, `Certification uploaded — ${s.certifications[0] ?? 'ISO 27001:2022'}`, `Classification set to ${s.classification.toLowerCase()}`, 'Service level agreement attached']); break;
      case 'Status changed': event = s.state === 'Pending docs' ? 'Moved to Pending docs — certification requested' : s.state === 'Escalated' ? `Escalated — ${s.gaps[0]?.title.toLowerCase() ?? 'review overdue'}` : s.state === 'Active' ? 'Moved to Active — assessment approved' : s.state === 'Archived' ? 'Moved to Archived — contract ended' : 'Moved to Under review — questionnaire returned'; break;
      case 'Closed': { const t = r.pick(done); out.push({ minutesAgo: (t.completedDaysAgo ?? 3) * 1440 + r.int(0, 600), supplierId: t.supplierId, supplierName: t.supplierName, event: `Task ${t.id} completed — ${t.title}`, type, by: t.owner }); continue; }
      case 'Removed': event = r.pick([`Sub-processor removed — ${s.v.fourthParties[0] ?? 'legacy host'}`, 'Access right removed after review', 'Duplicate contact removed']); break;
    }
    out.push({ minutesAgo: r.int(30, 60 * 24 * 45), supplierId: s.id, supplierName: s.name, event, type, by: r.pick(people) });
  }
  return out.sort((a, b) => a.minutesAgo - b.minutesAgo).map((e, i) => ({ ...e, id: `CL-${String(n - i).padStart(4, '0')}` }));
}

/** Portfolio and per-domain exposure from live suppliers (mean, higher is worse). */
export function tpExposure(sup: TpSupplier[]) {
  const live = sup.filter((s) => s.live);
  const portfolio = live.length ? Math.round(live.reduce((a, s) => a + s.score, 0) / live.length) : 0;
  const domains = TP_DOMAINS.map((d) => {
    const scored = live.filter((s) => s.domains[d] !== null);
    const score = scored.length ? Math.round(scored.reduce((a, s) => a + (s.domains[d] ?? 0), 0) / scored.length) : 0;
    const worst = scored.filter((s) => (s.domains[d] ?? 0) > 0).sort((a, b) => (b.domains[d] ?? 0) - (a.domains[d] ?? 0) || b.score - a.score);
    return { d, score, level: tpLevelOf(score), gaps: live.reduce((a, s) => a + s.gaps.filter((g) => g.domain === d).length, 0), highRisk: scored.filter((s) => (s.domains[d] ?? 0) >= 67).length, worst, scored: scored.length };
  });
  return { live, portfolio, domains };
}

export function tpLevelOf(score: number): TpLevel {
  return score >= 65 ? 'High' : score >= 34 ? 'Medium' : 'Low';
}

/** Sanity: register size and high-risk count match the headline. */
export function tpHeadlineCheck(c: CustomerProfile, tenantId: string, sup: TpSupplier[]) {
  const h = headlines(c, tenantId).comply;
  return { total: sup.length === h.vendors, high: sup.filter((s) => s.level === 'High').length === h.highRiskVendors };
}
