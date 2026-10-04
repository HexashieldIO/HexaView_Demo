import type { CustomerProfile, ServiceId } from '../types';
import { rng } from '../../lib/rng';
import { NOW } from '../../lib/format';
import { headlines } from '../core';
import { tenantShare, scopedTenants } from '../customers';
import { toolScores } from './ops';
import { forCustomer, type CustomerMap } from '../customerMap';

/* =====================================================================
   Value & Outcomes: what HexaView and HexaShield services delivered against
   what they cost, in the customer's currency. Every value line names its
   formula, its inputs and its source so the number survives a CFO review.
   Anchored to headlines(c) for incidents, MTTR, automation and loss.
   ===================================================================== */

export type CapKey = 'soc' | 'int' | 'strike' | 'ot' | 'comply' | 'custody' | 'ai' | 'view';

export const VALUE_CAPS: { id: CapKey; label: string; color: string; hex: string; service: ServiceId | null; to: string }[] = [
  { id: 'soc', label: 'HexaSOC', color: 'var(--m-soc)', hex: '#a07cfb', service: 'mdr', to: '/soc/mdr' },
  { id: 'int', label: 'HexaInt', color: 'var(--m-int)', hex: '#ef6aae', service: 'darkweb', to: '/int/overview' },
  { id: 'strike', label: 'HexaStrike', color: 'var(--m-strike)', hex: '#f8646f', service: 'pentest', to: '/strike/pentest' },
  { id: 'ot', label: 'HexaOT', color: 'var(--m-ot)', hex: '#f7a04a', service: 'ot-visibility', to: '/ot/visibility' },
  { id: 'comply', label: 'HexaComply', color: 'var(--m-comply)', hex: '#93d65a', service: 'caas', to: '/comply/overview' },
  { id: 'custody', label: 'HexaCustody', color: 'var(--m-custody)', hex: '#ecc873', service: 'custody', to: '/custody/overview' },
  { id: 'ai', label: 'HexaAI', color: 'var(--m-ai)', hex: '#8f8cff', service: null, to: '/ai/agents' },
  { id: 'view', label: 'HexaView platform', color: 'var(--m-view)', hex: '#3ad0ae', service: null, to: '/' },
];
export const VCAP_BY_ID = Object.fromEntries(VALUE_CAPS.map((v) => [v.id, v])) as Record<CapKey, (typeof VALUE_CAPS)[number]>;

export interface ValueAssumptions {
  /** Loaded analyst cost per hour, customer currency. */
  hourly: number;
  /** Minutes an analyst spends triaging one alert by hand. */
  minPerAlert: number;
  /** Minutes of analyst work one agentic SOC action replaces. */
  minPerAgentAction: number;
  /** Hours to answer one customer security questionnaire by hand. */
  hoursPerQuestionnaire: number;
  /** Hours to collect one audit evidence item by hand. */
  hoursPerEvidence: number;
  /** Share of hours saved counted as realised value (%). */
  realisation: number;
  /** Cyber insurance market rate change at renewal (%). */
  marketPremiumPct: number;
}

const HOURLY: CustomerMap<number> = {
  maritime: 92, finserv: 84, media: 96, healthcare: 88, automotive: 86,
  insurance: 88, defence: 97, pharma: 132, sghospital: 94, studio: 104,
};
const MARKET: CustomerMap<number> = {
  maritime: 3, finserv: 1, media: 9, healthcare: 11, automotive: 4,
  insurance: 2, defence: 9, pharma: 4, sghospital: 12, studio: 8,
};

export function defaultAssumptions(c: CustomerProfile): ValueAssumptions {
  return { hourly: forCustomer(HOURLY, c), minPerAlert: 2, minPerAgentAction: 3, hoursPerQuestionnaire: 14, hoursPerEvidence: 1.5, realisation: 45, marketPremiumPct: forCustomer(MARKET, c) };
}

export const ASSUMPTION_META: { key: keyof ValueAssumptions; label: string; unit: string; step: number; min: number; max: number; money?: boolean; hint: string }[] = [
  { key: 'hourly', label: 'Loaded analyst cost', unit: '/ hour', step: 1, min: 20, max: 400, money: true, hint: 'Salary, benefits, tooling and overhead per productive hour' },
  { key: 'minPerAlert', label: 'Manual triage per alert', unit: 'min', step: 0.5, min: 0.5, max: 20, hint: 'Time an analyst would spend on an alert HexaSOC auto-triages' },
  { key: 'minPerAgentAction', label: 'Work per agentic SOC action', unit: 'min', step: 0.5, min: 0.5, max: 30, hint: 'Enrichment, lookup or containment step an agent performs' },
  { key: 'hoursPerQuestionnaire', label: 'Questionnaire by hand', unit: 'h', step: 1, min: 1, max: 80, hint: 'Customer security questionnaire answered without the answer library' },
  { key: 'hoursPerEvidence', label: 'Evidence item by hand', unit: 'h', step: 0.25, min: 0.25, max: 10, hint: 'Screenshot, export, chase and file one audit evidence item' },
  { key: 'realisation', label: 'Realisation rate', unit: '%', step: 5, min: 5, max: 100, hint: 'Share of hours saved that turn into real capacity or avoided hires' },
  { key: 'marketPremiumPct', label: 'Market rate change', unit: '%', step: 1, min: -20, max: 40, hint: 'Peer premium movement at renewal, from the broker' },
];

/* Annual contract cost (HexaView licence + HexaShield services), customer currency. */
const CONTRACT: CustomerMap<number> = {
  maritime: 1_840_000, finserv: 3_350_000, media: 1_120_000, healthcare: 2_580_000, automotive: 6_150_000,
  insurance: 1_560_000, defence: 690_000, pharma: 5_400_000, sghospital: 1_180_000, studio: 7_900_000,
};
const COST_SPLIT: { label: string; cap: CapKey; w: number }[] = [
  { label: 'HexaView platform licence', cap: 'view', w: 0.22 },
  { label: 'HexaSOC 24/7 MDR & IR retainer', cap: 'soc', w: 0.34 },
  { label: 'HexaInt intelligence & exposure', cap: 'int', w: 0.08 },
  { label: 'HexaStrike testing', cap: 'strike', w: 0.1 },
  { label: 'HexaOT visibility', cap: 'ot', w: 0.1 },
  { label: 'HexaComply compliance & TPRM', cap: 'comply', w: 0.08 },
  { label: 'HexaCustody', cap: 'custody', w: 0.05 },
  { label: 'HexaAI (copilot & agentic SOC)', cap: 'ai', w: 0.03 },
];

interface SectorK {
  /** Annual expected-loss reduction since onboarding (share of the before value). */
  elReduction: number;
  incidentsPerOpen: number;
  questionnaires: number;
  otDowntimeHours: number;
  otHourCost: number;
  custodyEvents: number;
  custodyEventValue: number;
  atoCost: number;
  exposureDayCost: number;
}
const K: CustomerMap<SectorK> = {
  maritime: { elReduction: 0.34, incidentsPerOpen: 29, questionnaires: 48, otDowntimeHours: 41, otHourCost: 24_000, custodyEvents: 6, custodyEventValue: 38_000, atoCost: 72_000, exposureDayCost: 420 },
  finserv: { elReduction: 0.31, incidentsPerOpen: 33, questionnaires: 164, otDowntimeHours: 6, otHourCost: 210_000, custodyEvents: 14, custodyEventValue: 64_000, atoCost: 118_000, exposureDayCost: 610 },
  media: { elReduction: 0.37, incidentsPerOpen: 27, questionnaires: 71, otDowntimeHours: 9, otHourCost: 85_000, custodyEvents: 23, custodyEventValue: 96_000, atoCost: 54_000, exposureDayCost: 380 },
  healthcare: { elReduction: 0.33, incidentsPerOpen: 30, questionnaires: 58, otDowntimeHours: 28, otHourCost: 36_000, custodyEvents: 5, custodyEventValue: 52_000, atoCost: 96_000, exposureDayCost: 470 },
  automotive: { elReduction: 0.32, incidentsPerOpen: 31, questionnaires: 132, otDowntimeHours: 19, otHourCost: 138_000, custodyEvents: 17, custodyEventValue: 88_000, atoCost: 101_000, exposureDayCost: 560 },
  // Data-centre and print-plant downtime is cheap next to claims and quote-and-bind outages; ATO on agent and policyholder portals is costly.
  insurance: { elReduction: 0.32, incidentsPerOpen: 32, questionnaires: 96, otDowntimeHours: 7, otHourCost: 64_000, custodyEvents: 9, custodyEventValue: 71_000, atoCost: 104_000, exposureDayCost: 540 },
  // Building 3 line stops delay prime deliveries; each contained CUI/ITAR custody event avoids a DFARS 7012 report and a DDTC disclosure.
  defence: { elReduction: 0.3, incidentsPerOpen: 28, questionnaires: 74, otDowntimeHours: 22, otHourCost: 38_000, custodyEvents: 12, custodyEventValue: 118_000, atoCost: 86_000, exposureDayCost: 470 },
  // Valais and Cork batch losses dominate; trial data and dossier custody events carry high value at risk (CHF).
  pharma: { elReduction: 0.33, incidentsPerOpen: 31, questionnaires: 142, otDowntimeHours: 16, otHourCost: 210_000, custodyEvents: 19, custodyEventValue: 164_000, atoCost: 112_000, exposureDayCost: 620 },
  // Medical-device and theatre BMS downtime diverts patients; patient record and imaging custody events avoid PDPC and MOH notifications (SGD).
  sghospital: { elReduction: 0.31, incidentsPerOpen: 29, questionnaires: 46, otDowntimeHours: 24, otHourCost: 31_000, custodyEvents: 6, custodyEventValue: 58_000, atoCost: 74_000, exposureDayCost: 410 },
  // Ride and show downtime at Orlando and Osaka is expensive; pre-release leak events carry box-office value at risk.
  studio: { elReduction: 0.37, incidentsPerOpen: 27, questionnaires: 118, otDowntimeHours: 14, otHourCost: 120_000, custodyEvents: 31, custodyEventValue: 142_000, atoCost: 61_000, exposureDayCost: 450 },
};

/** Share of the CRQ loss reduction credited to HexaCustody: higher where custody is the crown jewel. */
const CUSTODY_LOSS_SHARE: CustomerMap<number> = {
  maritime: 0.08, finserv: 0.08, media: 0.12, healthcare: 0.08, automotive: 0.08,
  insurance: 0.08, defence: 0.11, pharma: 0.12, sghospital: 0.09, studio: 0.13,
};
/** What HexaCustody's contained events protected, in the customer's own terms. */
const CUSTODY_VALUE_LABEL: CustomerMap<string> = {
  maritime: 'Sensitive data custody enforced',
  finserv: 'Sensitive data custody enforced',
  media: 'Pre-release leaks prevented',
  healthcare: 'Sensitive data custody enforced',
  automotive: 'Design IP and OTA lineage protected',
  insurance: 'Claims files and policyholder data custody enforced',
  defence: 'CUI and ITAR technical data custody enforced',
  pharma: 'Trial data, dossiers and process IP protected',
  sghospital: 'Patient record and imaging custody enforced',
  studio: 'Pre-release leaks prevented',
};

export interface ValueLine {
  key: string;
  cap: CapKey;
  label: string;
  value: number;
  formula: string;
  source: string;
  to: string;
  hours?: number;
}
export interface BeforeAfter {
  key: string;
  label: string;
  before: number;
  after: number;
  unit: string;
  better: 'lower' | 'higher';
  source: string;
  to: string;
}
export interface Story {
  id: string;
  title: string;
  body: string;
  cap: CapKey;
  metric: string;
  value: number;
  daysAgo: number;
  tenantId: string;
  to: string;
  source: string;
}
export interface ValueModel {
  share: number;
  cost: number;
  costLines: { label: string; cap: CapKey; value: number; trial: boolean }[];
  lines: ValueLine[];
  byCap: { cap: CapKey; value: number; cost: number; lines: ValueLine[] }[];
  total: number;
  roi: number;
  net: number;
  paybackMonths: number;
  hoursSaved: number;
  hoursBreakdown: { label: string; hours: number; source: string; to: string }[];
  lossAvoided: number;
  elBefore: number;
  elNow: number;
  premiumSaving: number;
  premium: number;
  premiumDeltaPct: number;
  toolSaving: number;
  toolCount: number;
  incidentsContained: number;
  openIncidents: number;
  mttr: number;
  mttrBefore: number;
  questionnaires: number;
  audits: number;
  quarters: { label: string; value: number; cost: number }[];
  beforeAfter: BeforeAfter[];
  stories: Story[];
}

function quarterLabels(n: number): string[] {
  const out: string[] = [];
  const q0 = Math.floor(NOW.getMonth() / 3);
  for (let i = n; i >= 1; i--) {
    const qi = q0 - i;
    const y = NOW.getFullYear() + Math.floor(qi / 4);
    const q = ((qi % 4) + 4) % 4;
    out.push(`Q${q + 1} ${String(y).slice(2)}`);
  }
  return out;
}

const STORIES: CustomerMap<Omit<Story, 'value'>[]> = {
  maritime: [
    { id: 'st-1', title: 'Ransomware precursor contained in 14 min at Maasvlakte', body: 'Cobalt Strike beacon on RTM-GATE-SRV02 isolated by HexaSOC before encryption; gate kept running.', cap: 'soc', metric: '14 min to contain', daysAgo: 23, tenantId: 'rtm', to: '/soc/ir', source: 'HexaSOC case · Defender XDR' },
    { id: 'st-2', title: 'Port Klang TOS restored in 31 h against a 72 h estimate', body: 'MI-2026-031 run from the HexaView war room: immutable restore, conduit closed in 17 min, cranes never stopped.', cap: 'view', metric: '41 h of berth time saved', daysAgo: 1, tenantId: 'pkl', to: '/ops/warroom', source: 'War room MI-2026-031 · Veeam' },
    { id: 'st-3', title: '86 exposed crew and vendor credentials reset before use', body: 'Stealer-log hits matched to Entra ID accounts and reset through HexaView write-back within a day.', cap: 'int', metric: '86 accounts protected', daysAgo: 12, tenantId: 'all', to: '/int/exposure', source: 'HexaInt · Entra ID' },
    { id: 'st-4', title: 'Unscheduled crane PLC download caught at Maasvlakte', body: 'Dragos alert correlated with a missing work order; crane held out of service until logic verified.', cap: 'ot', metric: '1 safety incident avoided', daysAgo: 47, tenantId: 'rtm', to: '/ot/alerts', source: 'Dragos · HexaOT' },
    { id: 'st-5', title: 'Premium down 6% at renewal with Beazley', body: 'Insurer evidence pack built from attested controls; underwriters credited MFA, EDR and immutable backups.', cap: 'view', metric: '6% premium reduction', daysAgo: 120, tenantId: 'all', to: '/insurance/policy', source: 'Insurer evidence pack · Marsh' },
    { id: 'st-6', title: 'IACS E26 class evidence for two newbuilds in 9 days', body: 'Asset inventory, zones and remote-access evidence cited automatically for Bureau Veritas.', cap: 'comply', metric: '5 weeks faster', daysAgo: 45, tenantId: 'fleet', to: '/comply/caas', source: 'HexaComply · IACS E26/27 pack' },
  ],
  finserv: [
    { id: 'st-1', title: 'Help-desk social engineering stopped at the MFA reset', body: 'Scattered Spider-style caller blocked; new FIDO device revoked in Okta and Entra ID in one approved action.', cap: 'soc', metric: '11 min to contain', daysAgo: 19, tenantId: 'ukbank', to: '/soc/ir', source: 'HexaSOC · Okta · Entra ID' },
    { id: 'st-2', title: 'Critical BOLA flaw on the open-banking API fixed before the QSA visit', body: 'HexaStrike finding turned into a Splunk detection and a fix in 8 days.', cap: 'strike', metric: 'Fixed in 8 days', daysAgo: 34, tenantId: 'pay', to: '/strike/pentest', source: 'HexaStrike · Splunk ES' },
    { id: 'st-3', title: 'DORA Register of Information: 412 ICT contracts mapped', body: 'TPRM records, LEIs and criticality assembled for CSSF from the vendor register.', cap: 'comply', metric: '6 weeks of effort saved', daysAgo: 60, tenantId: 'eu', to: '/comply/tprm', source: 'HexaComply · ServiceNow IRM' },
    { id: 'st-4', title: '213 exposed credentials rotated, 9 privileged', body: 'Stealer-log matches pushed to CyberArk rotation and Okta session clear.', cap: 'int', metric: '9 Tier 0 accounts saved', daysAgo: 8, tenantId: 'all', to: '/int/exposure', source: 'HexaInt · CyberArk' },
    { id: 'st-5', title: 'Agentic SOC triages 96% of 11,000 daily alerts', body: 'Agents enrich, de-duplicate and close benign alerts with full audit trail; analysts handle the 4%.', cap: 'ai', metric: '96% auto-triaged', daysAgo: 3, tenantId: 'all', to: '/ai/agents', source: 'HexaAI agentic SOC · audit ledger' },
    { id: 'st-6', title: 'Three overlapping tools retired after the scorecard', body: 'Validation results showed duplicate coverage; contracts not renewed.', cap: 'view', metric: 'Licence spend rationalised', daysAgo: 90, tenantId: 'all', to: '/ops/scorecard', source: 'Tool scorecard · contract register' },
  ],
  media: [
    { id: 'st-1', title: 'Nightjar screener leak traced to source in 18 min', body: 'Forensic watermark matched to a vendor review link; all links for the title revoked before wider spread.', cap: 'custody', metric: 'Premiere protected', daysAgo: 16, tenantId: 'studios', to: '/custody/revocation', source: 'HexaCustody · watermark index' },
    { id: 'st-2', title: 'Review-link token abuse blocked at the edge', body: 'Cloudflare emergency rule deployed from HexaView in 6 minutes; 37 dailies protected.', cap: 'soc', metric: '6 min to block', daysAgo: 29, tenantId: 'studios', to: '/soc/ir', source: 'HexaSOC · Cloudflare' },
    { id: 'st-3', title: 'Red Fern custody revoked: 118 assets pulled back', body: 'Vendor breach intake to revocation in under an hour for two unreleased titles.', cap: 'custody', metric: '118 assets secured', daysAgo: 52, tenantId: 'post', to: '/custody/vendors', source: 'HexaCustody vendor chain' },
    { id: 'st-4', title: 'TPN Gold Shield evidence assembled in 4 days', body: 'Site, application and vendor evidence cited from live controls and custody proofs.', cap: 'comply', metric: '3 weeks faster', daysAgo: 70, tenantId: 'all', to: '/comply/caas', source: 'HexaComply · TPN pack' },
    { id: 'st-5', title: 'Screener portal auth bypass fixed in 6 days', body: 'Critical HexaStrike finding retested and closed; detection added in Google SecOps.', cap: 'strike', metric: '3 critical findings closed', daysAgo: 40, tenantId: 'studios', to: '/strike/pentest', source: 'HexaStrike · Google SecOps' },
    { id: 'st-6', title: '14 lookalike domains taken down before the premiere campaign', body: 'Phishing kits targeting subscribers removed before launch marketing.', cap: 'int', metric: '14 takedowns', daysAgo: 22, tenantId: 'play', to: '/int/darkweb', source: 'HexaInt brand protection' },
  ],
  healthcare: [
    { id: 'st-1', title: 'Ransomware precursor contained in 14 min at the Medical Center', body: 'Cobalt Strike on a radiology workstation isolated by HexaSOC; PACS and Epic unaffected.', cap: 'soc', metric: '14 min to contain', daysAgo: 21, tenantId: 'mrmc', to: '/soc/ir', source: 'HexaSOC · Falcon Insight' },
    { id: 'st-2', title: 'Help-desk MFA reset fraud stopped before Epic access', body: 'Entra ID new-device registration revoked automatically; FairWarning confirmed no records viewed.', cap: 'soc', metric: '0 records exposed', daysAgo: 37, tenantId: 'mrmc', to: '/soc/identity', source: 'Sentinel · Entra ID · FairWarning' },
    { id: 'st-3', title: '1,140 legacy infusion pumps and imaging stations risk-ranked', body: 'Medical device inventory unified from Claroty and HexaOT; segmentation plan funded.', cap: 'ot', metric: '1,140 devices prioritised', daysAgo: 64, tenantId: 'community', to: '/ot/assets', source: 'Claroty xDome · HexaOT' },
    { id: 'st-4', title: '241 exposed clinician credentials reset', body: 'Stealer-log hits for clinicians and research staff reset before Citrix use.', cap: 'int', metric: '241 accounts protected', daysAgo: 11, tenantId: 'all', to: '/int/exposure', source: 'HexaInt · Entra ID' },
    { id: 'st-5', title: 'HITRUST evidence collection cut from 9 weeks to 3', body: 'Requirement statements cited to live control evidence and sampled populations.', cap: 'comply', metric: '6 weeks saved', daysAgo: 80, tenantId: 'all', to: '/comply/caas', source: 'HexaComply · HITRUST r2' },
    { id: 'st-6', title: 'Premium rise held to 3% against an 11% market', body: 'Attested controls and modelled loss shared with Beazley via Gallagher.', cap: 'view', metric: '8 pts below market', daysAgo: 150, tenantId: 'all', to: '/insurance/policy', source: 'Insurer evidence pack' },
  ],
  automotive: [
    { id: 'st-1', title: 'Vehicle API abuse stopped across 12,000 cars in 9 min', body: 'Upstream vSOC and backend logs correlated; leaked OAuth client revoked through HexaView.', cap: 'soc', metric: '9 min to contain', daysAgo: 26, tenantId: 'connected', to: '/soc/ir', source: 'HexaSOC · Upstream vSOC' },
    { id: 'st-2', title: 'Out-of-window robot integrator session blocked at Puebla', body: 'BeyondTrust session terminated before programme download completed on the body line.', cap: 'ot', metric: 'Line stop avoided', daysAgo: 44, tenantId: 'puebla', to: '/ot/alerts', source: 'Armis · BeyondTrust' },
    { id: 'st-3', title: 'OTA signing operator credentials rotated after a stealer-log hit', body: 'Supplier stealer log matched an HSM operator; dual-control rotation done the same day.', cap: 'int', metric: 'R156 risk closed', daysAgo: 15, tenantId: 'connected', to: '/int/exposure', source: 'HexaInt · Entra ID' },
    { id: 'st-4', title: 'TISAX AL3 evidence: 401 controls cited automatically', body: 'VDA ISA controls and prototype protection evidence assembled for ENX.', cap: 'comply', metric: '7 weeks faster', daysAgo: 58, tenantId: 'group', to: '/comply/caas', source: 'HexaComply · TISAX pack' },
    { id: 'st-5', title: 'Ransomware precursor contained in 14 min at Győr', body: 'Rubrik anomaly and Defender XDR beacon correlated; plant IT isolated before MES encryption.', cap: 'soc', metric: '14 min to contain', daysAgo: 33, tenantId: 'gyor', to: '/soc/ir', source: 'HexaSOC · Rubrik · Defender XDR' },
    { id: 'st-6', title: 'Design IP exfiltration attempt blocked on pre-launch models', body: 'HexaCustody flagged a bulk export of CAD data to a personal cloud; access revoked.', cap: 'custody', metric: 'Pre-launch IP protected', daysAgo: 71, tenantId: 'group', to: '/custody/telemetry', source: 'HexaCustody · Zscaler' },
  ],
  insurance: [
    { id: 'st-1', title: 'Help-desk MFA reset fraud stopped before ClaimCenter access', body: 'Scattered Spider-style caller posing as a Charlotte adjuster; the new device was revoked in Okta and Entra ID in one approved action.', cap: 'soc', metric: '9 min to contain', daysAgo: 18, tenantId: 'claims', to: '/soc/ir', source: 'HexaSOC · Okta · Entra ID' },
    { id: 'st-2', title: 'Fake body-shop disbursement of $1.4M held before release', body: 'Abnormal flagged a compromised repair-vendor mailbox changing bank details; the One Inc payment was held and SIU opened a case.', cap: 'soc', metric: '$1.4M disbursement held', daysAgo: 33, tenantId: 'claims', to: '/soc/ir', source: 'HexaSOC · Abnormal · One Inc' },
    { id: 'st-3', title: '131 exposed agent and employee credentials reset', body: 'Stealer-log hits from independent agency PCs matched to federated AgentHub accounts; sessions cleared and passwords reset within a day.', cap: 'int', metric: '131 accounts protected', daysAgo: 10, tenantId: 'all', to: '/int/exposure', source: 'HexaInt · Okta · Entra ID' },
    { id: 'st-4', title: 'NYDFS 500.17 certification evidence assembled in 6 days', body: 'Controls, the CISO report to the Board (500.4) and remediation status cited to live evidence for the April certification.', cap: 'comply', metric: '5 weeks faster', daysAgo: 62, tenantId: 'all', to: '/comply/caas', source: 'HexaComply · NYDFS 500 pack' },
    { id: 'st-5', title: 'Critical MFT flaw on KMI-MFT-01 closed ahead of a Cl0p campaign', body: 'HexaStrike finding patched, retested and turned into a Splunk ES detection in 5 days; reinsurer and TPA feeds kept running.', cap: 'strike', metric: 'Fixed in 5 days', daysAgo: 41, tenantId: 'group', to: '/strike/pentest', source: 'HexaStrike · Splunk ES' },
    { id: 'st-6', title: 'Premium down 5% at renewal against a rising market', body: 'Insurer evidence pack built from attested controls for Marsh FINPRO; underwriters credited phishing-resistant MFA, EDR and tested Guidewire restores.', cap: 'view', metric: '7 pts below market', daysAgo: 300, tenantId: 'all', to: '/insurance/policy', source: 'Insurer evidence pack · Marsh FINPRO' },
  ],
  defence: [
    { id: 'st-1', title: 'Living-off-the-land activity on the enclave edge contained in 12 min', body: 'Volt Typhoon-style tradecraft correlated across Defender XDR (GCC High) and Corelight; host isolated and the DIBNet report drafted inside the 72-hour window.', cap: 'soc', metric: '12 min to contain', daysAgo: 24, tenantId: 'programs', to: '/soc/ir', source: 'HexaSOC · Defender XDR · Corelight' },
    { id: 'st-2', title: 'Out-of-window machine-tool vendor session blocked in Building 3', body: 'BeyondTrust session terminated before a programme download to the DNC server; the Haas cell stayed in production.', cap: 'ot', metric: 'Line stop avoided', daysAgo: 46, tenantId: 'manufacturing', to: '/ot/alerts', source: 'HexaOT · Armis · BeyondTrust' },
    { id: 'st-3', title: 'TDP-2207 opened outside an authorised enclave, revoked in 4 min', body: 'HexaCustody saw the ITAR guidance-housing package opened on an unmanaged sub-tier workstation; access revoked and the Empowered Official notified.', cap: 'custody', metric: 'ITAR disclosure avoided', daysAgo: 15, tenantId: 'programs', to: '/custody/revocation', source: 'HexaCustody · PreVeil' },
    { id: 'st-4', title: 'SPRS score raised from 88 to 104 ahead of the C3PAO assessment', body: 'POA&M items closed with cited evidence; SSP v4.2 control narratives linked to live loops for Redstone Cyber Assessors.', cap: 'comply', metric: '+16 SPRS points', daysAgo: 58, tenantId: 'all', to: '/comply/caas', source: 'HexaComply · CMMC L2 SSP & POA&M' },
    { id: 'st-5', title: '38 exposed engineer and supplier-portal credentials reset', body: 'Stealer-log hits included Exostar accounts used for prime collaboration; FIPS YubiKeys re-enrolled the same day.', cap: 'int', metric: '38 accounts protected', daysAgo: 12, tenantId: 'all', to: '/int/exposure', source: 'HexaInt · Entra ID (GCC High)' },
    { id: 'st-6', title: 'Export-controlled drawings kept out of an unsanctioned chatbot', body: 'Purview DSPM for AI caught CUI-labelled content pasted into ChatGPT; Zscaler block applied and engineers moved to the Azure Government pilot.', cap: 'ai', metric: '0 CUI disclosed', daysAgo: 37, tenantId: 'engineering', to: '/ai/agents', source: 'HexaAI · Purview DSPM for AI · Zscaler' },
  ],
  pharma: [
    { id: 'st-1', title: 'RHN-4471 unblinding keys pulled back from a CRO mis-share', body: 'HexaCustody flagged RTSM randomisation lists sent to an unauthorised CRO mailbox; revoked in 6 minutes and blinding preserved.', cap: 'custody', metric: 'Trial integrity preserved', daysAgo: 19, tenantId: 'clinops', to: '/custody/revocation', source: 'HexaCustody · Medidata RTSM' },
    { id: 'st-2', title: 'Ransomware precursor contained in 11 min at Valais', body: 'Beacon on a PAS-X MES terminal isolated by HexaSOC before electronic batch records were touched; batch release continued.', cap: 'soc', metric: '11 min to contain', daysAgo: 27, tenantId: 'valais', to: '/soc/ir', source: 'HexaSOC · CrowdStrike Falcon' },
    { id: 'st-3', title: 'Unapproved DeltaV download caught on the bioreactor suite', body: 'Engineering-workstation change outside change control flagged by HexaOT; the QP held the 2,000 L batch until the recipe was verified.', cap: 'ot', metric: '1 biologics batch saved', daysAgo: 52, tenantId: 'valais', to: '/ot/alerts', source: 'HexaOT · DeltaV Event Chronicle' },
    { id: 'st-4', title: 'Annex 11 and Part 11 inspection evidence assembled in 5 days', body: 'Audit trails, e-signature controls and periodic reviews cited to live evidence for the Swissmedic GMP inspection.', cap: 'comply', metric: '4 weeks faster', daysAgo: 74, tenantId: 'all', to: '/comply/caas', source: 'HexaComply · GxP Annex 11 pack' },
    { id: 'st-5', title: '272 exposed researcher and CRO-portal credentials reset', body: 'Stealer-log hits across Basel, Cambridge MA and Dublin matched to Entra ID and Okta accounts and reset before use.', cap: 'int', metric: '272 accounts protected', daysAgo: 9, tenantId: 'all', to: '/int/exposure', source: 'HexaInt · Entra ID · Okta' },
    { id: 'st-6', title: 'Trial data kept out of unsanctioned ChatGPT in clinical ops', body: 'Prompt DLP coached and blocked pastes of patient-level data; users moved to the sanctioned Copilot with GxP guardrails.', cap: 'ai', metric: '0 trial records exposed', daysAgo: 31, tenantId: 'clinops', to: '/ai/agents', source: 'HexaAI · prompt DLP' },
  ],
  sghospital: [
    { id: 'st-1', title: 'Ransomware precursor contained in 13 min on a radiology workstation', body: 'LockBit-style beacon isolated by HexaSOC at Science Park; PACS and TrakCare unaffected and no diversion of A&E.', cap: 'soc', metric: '13 min to contain', daysAgo: 22, tenantId: 'labimg', to: '/soc/ir', source: 'HexaSOC · CrowdStrike Falcon' },
    { id: 'st-2', title: 'Infusion pump server path from the guest network closed', body: 'HexaOT found a reachable route to the BD Alaris server; Biomedical Engineering re-segmented the VLAN within the week.', cap: 'ot', metric: 'Patient-safety risk closed', daysAgo: 49, tenantId: 'obh', to: '/ot/assets', source: 'HexaOT · Claroty xDome' },
    { id: 'st-3', title: 'HIA cybersecurity requirements evidence ready six weeks early', body: 'HIA CS/DS and NEHR readiness controls cited to live evidence for the MOH licence review.', cap: 'comply', metric: '6 weeks faster', daysAgo: 66, tenantId: 'all', to: '/comply/caas', source: 'HexaComply · HIA & NEHR pack' },
    { id: 'st-4', title: '68 exposed clinician credentials reset', body: 'Stealer-log hits for doctors, nurses and research staff reset before TrakCare or remote access use.', cap: 'int', metric: '68 accounts protected', daysAgo: 11, tenantId: 'all', to: '/int/exposure', source: 'HexaInt · Entra ID' },
    { id: 'st-5', title: 'Second-opinion imaging studies pulled back from an unauthorised viewer', body: 'HexaCustody saw an overseas share opened beyond the named radiologist; access revoked and the PDPA assessment closed with no notification.', cap: 'custody', metric: 'PDPC notification avoided', daysAgo: 38, tenantId: 'labimg', to: '/custody/revocation', source: 'HexaCustody · PACS' },
    { id: 'st-6', title: 'Premium rise held to 5% against a 12% market', body: 'Attested controls and modelled loss shared with Chubb via Marsh Singapore.', cap: 'view', metric: '7 pts below market', daysAgo: 220, tenantId: 'all', to: '/insurance/policy', source: 'Insurer evidence pack · Marsh Singapore' },
  ],
  studio: [
    { id: 'st-1', title: 'Crown of Ash awards screener leak traced in 11 min', body: 'NexGuard forensic watermark matched an Indee screener link; every link for the title revoked before wider spread.', cap: 'custody', metric: 'Awards campaign protected', daysAgo: 14, tenantId: 'studios', to: '/custody/revocation', source: 'HexaCustody · NexGuard · Indee' },
    { id: 'st-2', title: 'Lodestar VFX plates pulled back from a breached vendor', body: 'Vendor breach intake at Northlight Pixel to revocation in 38 minutes; 214 plates and turnovers secured.', cap: 'custody', metric: '214 assets secured', daysAgo: 47, tenantId: 'post', to: '/custody/vendors', source: 'HexaCustody vendor chain' },
    { id: 'st-3', title: 'Help-desk social engineering stopped before Starfall+ admin access', body: 'Scattered Spider-style caller blocked at the MFA reset; the rogue device was revoked and AWS console sessions cleared.', cap: 'soc', metric: '8 min to contain', daysAgo: 21, tenantId: 'play', to: '/soc/ir', source: 'HexaSOC · Google SecOps' },
    { id: 'st-4', title: 'Unscheduled show-control change caught before Orlando park opening', body: 'Dragos alert correlated with a missing work order; the attraction held until the ride and show logic was verified.', cap: 'ot', metric: 'Ride availability protected', daysAgo: 56, tenantId: 'parks', to: '/ot/alerts', source: 'HexaOT · Dragos' },
    { id: 'st-5', title: '46 lookalike domains taken down before The Hollow Coast S3 launch', body: 'Phishing kits targeting Starfall+ subscribers and StarPass guests removed before launch marketing.', cap: 'int', metric: '46 takedowns', daysAgo: 25, tenantId: 'play', to: '/int/darkweb', source: 'HexaInt brand protection' },
    { id: 'st-6', title: 'TPN and MPA evidence for 14 VFX and dubbing vendors in 4 days', body: 'Site, application and vendor evidence cited from live controls and custody proofs for the TPN+ re-assessment.', cap: 'comply', metric: '3 weeks faster', daysAgo: 72, tenantId: 'all', to: '/comply/caas', source: 'HexaComply · TPN pack' },
  ],
};
const STORY_VALUE: CustomerMap<number[]> = {
  maritime: [1_900_000, 2_400_000, 310_000, 650_000, 87_000, 140_000],
  finserv: [2_800_000, 1_100_000, 260_000, 900_000, 1_700_000, 410_000],
  media: [3_200_000, 480_000, 1_400_000, 120_000, 520_000, 160_000],
  healthcare: [2_600_000, 940_000, 380_000, 690_000, 210_000, 640_000],
  automotive: [4_100_000, 2_300_000, 1_600_000, 330_000, 3_800_000, 2_700_000],
  insurance: [2_100_000, 1_400_000, 340_000, 260_000, 1_900_000, 185_500],
  defence: [2_600_000, 1_200_000, 3_400_000, 480_000, 140_000, 900_000],
  pharma: [6_800_000, 2_900_000, 3_800_000, 420_000, 610_000, 1_100_000],
  sghospital: [1_900_000, 1_200_000, 380_000, 210_000, 640_000, 42_700],
  studio: [12_000_000, 4_800_000, 2_600_000, 1_900_000, 620_000, 540_000],
};

export function valueModel(c: CustomerProfile, tenantId: string, a: ValueAssumptions): ValueModel {
  const h = headlines(c, tenantId);
  const k = forCustomer(K, c);
  const share = tenantShare(c, tenantId);
  const r = rng(`value-${c.id}`);
  const rate = a.hourly;
  const real = a.realisation / 100;
  const svcState = (s: ServiceId | null) => (s ? c.services[s] : 'active');

  /* ---------- cost ---------- */
  const contract = forCustomer(CONTRACT, c) * share;
  const costLines = COST_SPLIT.map((x) => ({ label: x.label, cap: x.cap, value: Math.round(contract * x.w), trial: svcState(VCAP_BY_ID[x.cap].service) === 'trial' }));
  const cost = costLines.reduce((s, x) => s + x.value, 0);

  /* ---------- loss avoided (CRQ) ---------- */
  const elNow = h.insurance.expectedLossM * 1e6 * share;
  const elBefore = elNow / (1 - k.elReduction);
  const lossAvoided = elBefore - elNow;
  const lossShare: Record<CapKey, number> = { soc: 0.38, int: 0.12, strike: 0.16, ot: 0.14, comply: 0.04, custody: forCustomer(CUSTODY_LOSS_SHARE, c), ai: 0.04, view: 0.04 };
  const lsum = Object.values(lossShare).reduce((s, v) => s + v, 0);

  /* ---------- hours ---------- */
  const alertsYear = h.soc.alerts24h * 365;
  const triageHours = (alertsYear * (h.soc.autoTriagedPct / 100) * a.minPerAlert) / 60;
  const agentHours = (h.ai.agentActions7d * 52 * a.minPerAgentAction) / 60;
  const evidenceHours = h.comply.evidenceItems * a.hoursPerEvidence * 0.7;
  const questionnaires = Math.max(4, Math.round(k.questionnaires * share));
  const qHours = questionnaires * a.hoursPerQuestionnaire * 0.72;
  const reportHours = Math.round((c.frameworks.length * 26 + 52 * 6) * Math.max(0.3, share));
  const hoursBreakdown = [
    { label: 'Alert triage automated (HexaSOC)', hours: triageHours, source: `${h.soc.autoTriagedPct}% of ${Math.round(alertsYear).toLocaleString('en-GB')} alerts a year × ${a.minPerAlert} min`, to: '/soc/mdr' },
    { label: 'Agentic SOC actions (HexaAI)', hours: agentHours, source: `${h.ai.agentActions7d.toLocaleString('en-GB')} actions a week × ${a.minPerAgentAction} min`, to: '/ai/agents' },
    { label: 'Audit evidence collected automatically', hours: evidenceHours, source: `${h.comply.evidenceItems.toLocaleString('en-GB')} evidence items × ${a.hoursPerEvidence} h × 70%`, to: '/comply/caas' },
    { label: 'Questionnaires answered from the library', hours: qHours, source: `${questionnaires} questionnaires × ${a.hoursPerQuestionnaire} h × 72%`, to: '/trust/questionnaires' },
    { label: 'Board, regulator and service reports drafted', hours: reportHours, source: 'Reporting Centre: cited drafts replace manual assembly', to: '/reports/history' },
  ];
  const hoursSaved = hoursBreakdown.reduce((s, x) => s + x.hours, 0);

  /* ---------- incidents and times ---------- */
  const openIncidents = h.soc.openIncidents;
  const incidentsContained = Math.round(openIncidents * k.incidentsPerOpen);
  const mttr = h.soc.mttrMin;
  const mttrBefore = Math.round(mttr * (3.9 + r.float(0, 0.8, 2)));

  /* ---------- premium and tools ---------- */
  const premium = c.insurance.premiumK * 1000;
  const premiumDeltaPct = h.insurance.premiumDeltaPct;
  const premiumSaving = Math.max(0, (premium * (a.marketPremiumPct - premiumDeltaPct)) / 100) * share;
  const scores = toolScores(c, tenantId, 30);
  const toolSaving = scores.filter((t) => t.reco === 'Consolidate').reduce((s, t) => s + t.cost * 0.8, 0) + scores.filter((t) => t.reco === 'Replace').reduce((s, t) => s + t.cost * 0.25, 0);
  const toolCount = scores.filter((t) => t.reco === 'Consolidate' || t.reco === 'Replace').length;

  /* ---------- value lines ---------- */
  const strikeClosed = Math.round(h.strike.openFindings * 3.1);
  const mttrDaysBefore = Math.round(h.strike.meanTimeToRemediateDays * 2.1);
  const credsFixed = Math.round(h.int.exposedCredentials * 0.92);
  const custodyVal = k.custodyEvents * k.custodyEventValue * share * (svcState('custody') === 'trial' ? 0.4 : 1);
  const otHours = Math.round(k.otDowntimeHours * share);
  const auditsSupported = Math.max(1, Math.round((c.frameworks.length + 2) * Math.max(0.4, share)));
  const auditDayRate = rate * 15;
  const vendorsAssessed = Math.round(h.comply.vendors * 0.6);
  const L = (cap: CapKey) => (lossAvoided * lossShare[cap]) / lsum;
  const lines: ValueLine[] = ([
    { key: 'soc-triage', cap: 'soc', label: 'Analyst hours released by automated triage', value: triageHours * rate * real, hours: triageHours, formula: `${Math.round(triageHours).toLocaleString('en-GB')} h × ${a.realisation}% × loaded rate`, source: 'HexaSOC auto-triage metrics', to: '/soc/mdr' },
    { key: 'soc-loss', cap: 'soc', label: 'Expected loss reduced by faster containment', value: L('soc'), formula: `Share of CRQ loss reduction; MTTR ${mttrBefore} → ${mttr} min`, source: 'Risk quantification (FAIR)', to: '/insurance/quantification' },
    { key: 'ai-agents', cap: 'ai', label: 'Agentic SOC work performed', value: agentHours * rate * real, hours: agentHours, formula: `${Math.round(agentHours).toLocaleString('en-GB')} h × ${a.realisation}% × loaded rate`, source: 'HexaAI agent action ledger', to: '/ai/agents' },
    { key: 'ai-loss', cap: 'ai', label: 'Copilot-assisted investigations', value: L('ai'), formula: 'Share of CRQ loss reduction', source: 'Risk quantification (FAIR)', to: '/insurance/quantification' },
    { key: 'int-ato', cap: 'int', label: 'Account takeovers avoided', value: credsFixed * 0.04 * k.atoCost * share, formula: `${credsFixed} credentials reset × 4% exploitation × ATO cost`, source: 'HexaInt credential exposure', to: '/int/exposure' },
    { key: 'int-loss', cap: 'int', label: 'Phishing and brand abuse reduced', value: L('int'), formula: `Share of CRQ loss reduction; ${h.int.lookalikeDomains} lookalike domains handled`, source: 'Risk quantification (FAIR)', to: '/int/darkweb' },
    { key: 'strike-exp', cap: 'strike', label: 'Exposure windows shortened', value: strikeClosed * Math.max(0, mttrDaysBefore - h.strike.meanTimeToRemediateDays) * k.exposureDayCost * share, formula: `${strikeClosed} findings × (${mttrDaysBefore} → ${h.strike.meanTimeToRemediateDays} days) × exposure cost/day`, source: 'HexaStrike findings', to: '/strike/pentest' },
    { key: 'strike-loss', cap: 'strike', label: 'Validated detections (findings → detections)', value: L('strike'), formula: `Share of CRQ loss reduction; ${h.strike.findingsToDetectionsPct}% of findings became detections`, source: 'Risk quantification (FAIR)', to: '/strike/purple' },
    { key: 'ot-down', cap: 'ot', label: 'OT downtime avoided', value: otHours * k.otHourCost, formula: `${otHours} h × downtime cost/h`, source: 'HexaOT alerts · site incident log', to: '/ot/alerts' },
    { key: 'ot-loss', cap: 'ot', label: 'OT exposure reduced', value: L('ot'), formula: `Share of CRQ loss reduction; ${h.ot.purdueCoveragePct}% Purdue coverage`, source: 'Risk quantification (FAIR)', to: '/ot/visibility' },
    { key: 'comply-ev', cap: 'comply', label: 'Audit evidence collected automatically', value: evidenceHours * rate * real, hours: evidenceHours, formula: `${Math.round(evidenceHours).toLocaleString('en-GB')} h × ${a.realisation}% × loaded rate`, source: 'HexaComply evidence store', to: '/comply/caas' },
    { key: 'comply-audit', cap: 'comply', label: 'External audit and assessor days avoided', value: auditsSupported * 11 * auditDayRate, formula: `${auditsSupported} audits × 11 assessor and preparation days × day rate`, source: 'HexaComply audit packs · cited evidence', to: '/comply/caas' },
    { key: 'comply-tprm', cap: 'comply', label: 'Supplier assessments automated', value: vendorsAssessed * 5 * rate * real, hours: vendorsAssessed * 5, formula: `${vendorsAssessed} suppliers × 5 h × ${a.realisation}% × loaded rate`, source: 'HexaComply third-party risk', to: '/comply/tprm' },
    { key: 'comply-q', cap: 'comply', label: 'Questionnaires accelerated', value: qHours * rate * real, hours: qHours, formula: `${questionnaires} questionnaires × ${a.hoursPerQuestionnaire} h × 72% saved`, source: 'Trust Centre answer library', to: '/trust/questionnaires' },
    { key: 'custody', cap: 'custody', label: forCustomer(CUSTODY_VALUE_LABEL, c), value: custodyVal, formula: `${k.custodyEvents} contained events × value at risk${svcState('custody') === 'trial' ? ' × 40% (trial)' : ''}`, source: 'HexaCustody revocations and anomalies', to: '/custody/revocation' },
    { key: 'custody-loss', cap: 'custody', label: 'Data exfiltration risk reduced', value: L('custody'), formula: 'Share of CRQ loss reduction', source: 'Risk quantification (FAIR)', to: '/insurance/quantification' },
    { key: 'view-premium', cap: 'view', label: 'Insurance premium below market', value: premiumSaving, formula: `Premium × (market ${a.marketPremiumPct > 0 ? '+' : ''}${a.marketPremiumPct}% − ours ${premiumDeltaPct > 0 ? '+' : ''}${premiumDeltaPct}%)`, source: `Policy & renewal · ${c.insurance.broker}`, to: '/insurance/policy' },
    { key: 'view-tools', cap: 'view', label: 'Tool spend rationalised', value: toolSaving, formula: `${toolCount} tools to consolidate or replace (scorecard)`, source: 'Tool scorecard · contract register', to: '/ops/scorecard?reco=Consolidate,Replace' },
    { key: 'view-reports', cap: 'view', label: 'Reports drafted with citations', value: reportHours * rate * real, hours: reportHours, formula: `${reportHours.toLocaleString('en-GB')} h × ${a.realisation}% × loaded rate`, source: 'Reporting Centre history', to: '/reports/history' },
    { key: 'view-loss', cap: 'view', label: 'Closed-loop assurance', value: L('view'), formula: 'Share of CRQ loss reduction', source: 'Risk quantification (FAIR)', to: '/loop' },
  ] satisfies ValueLine[]).map((l): ValueLine => ({ ...l, value: Math.round(l.value) }));

  const byCap = VALUE_CAPS.map((v) => ({
    cap: v.id,
    lines: lines.filter((l) => l.cap === v.id),
    value: lines.filter((l) => l.cap === v.id).reduce((s, l) => s + l.value, 0),
    cost: costLines.filter((x) => x.cap === v.id).reduce((s, x) => s + x.value, 0),
  }));
  const total = lines.reduce((s, l) => s + l.value, 0);

  /* ---------- quarters: adoption ramp; last four = this year's value ---------- */
  const ramp = [0.3, 0.55, 0.86, 0.94, 1.02, 1.18];
  const labels = quarterLabels(ramp.length);
  const quarters = labels.map((label, i) => ({ label, value: Math.round((total / 4) * ramp[i] * (1 + (r() - 0.5) * 0.06)), cost: Math.round((cost / 4) * (i === 0 ? 1.35 : 1)) }));

  /* ---------- before / after ---------- */
  const b = (x: number, f: number) => Math.round(x * f);
  const ba: BeforeAfter[] = [
    { key: 'mttd', label: 'Mean time to detect', before: b(h.soc.mttdMin, 4.6), after: h.soc.mttdMin, unit: 'min', better: 'lower', source: 'HexaSOC case timestamps', to: '/soc/mdr' },
    { key: 'mtta', label: 'Mean time to acknowledge', before: b(h.soc.mttaMin, 6.2), after: h.soc.mttaMin, unit: 'min', better: 'lower', source: 'HexaSOC case timestamps', to: '/soc/mdr' },
    { key: 'mttr', label: 'Mean time to contain', before: mttrBefore, after: mttr, unit: 'min', better: 'lower', source: 'HexaSOC case timestamps', to: '/soc/ir' },
    { key: 'auto', label: 'Alerts auto-triaged', before: Math.round(h.soc.autoTriagedPct * 0.3), after: h.soc.autoTriagedPct, unit: '%', better: 'higher', source: 'HexaSOC auto-triage', to: '/soc/mdr' },
    { key: 'attack', label: 'ATT&CK coverage', before: h.soc.attackCoveragePct - 23, after: h.soc.attackCoveragePct, unit: '%', better: 'higher', source: 'HexaMatrix', to: '/soc/attack' },
    { key: 'controls', label: 'Controls met', before: h.comply.controlsMetPct - 17, after: h.comply.controlsMetPct, unit: '%', better: 'higher', source: 'HexaComply', to: '/comply/caas' },
    { key: 'remed', label: 'Time to remediate findings', before: mttrDaysBefore, after: h.strike.meanTimeToRemediateDays, unit: 'days', better: 'lower', source: 'HexaStrike', to: '/strike/pentest' },
    { key: 'quest', label: 'Questionnaire turnaround', before: 21 + r.int(0, 6), after: 3 + r.int(0, 2), unit: 'days', better: 'lower', source: 'Trust Centre', to: '/trust/questionnaires' },
  ];

  /* ---------- outcome stories ---------- */
  const tIds = scopedTenants(c, tenantId).map((t) => t.id);
  const stories = forCustomer(STORIES, c)
    .map((s, i) => ({ ...s, value: forCustomer(STORY_VALUE, c)[i] }))
    .filter((s) => tenantId === 'all' || s.tenantId === 'all' || tIds.includes(s.tenantId));

  const net = total - cost;
  return {
    share, cost, costLines, lines, byCap, total, roi: cost ? total / cost : 0, net, paybackMonths: Math.max(1, Math.round((cost / Math.max(1, total)) * 12 * 10) / 10),
    hoursSaved, hoursBreakdown, lossAvoided, elBefore, elNow, premiumSaving, premium, premiumDeltaPct, toolSaving, toolCount,
    incidentsContained, openIncidents, mttr, mttrBefore, questionnaires, audits: auditsSupported, quarters, beforeAfter: ba, stories,
  };
}
