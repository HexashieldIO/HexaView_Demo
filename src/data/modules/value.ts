import type { CustomerId, CustomerProfile, ServiceId } from '../types';
import { rng } from '../../lib/rng';
import { NOW } from '../../lib/format';
import { headlines } from '../core';
import { tenantShare, scopedTenants } from '../customers';
import { toolScores } from './ops';

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

const HOURLY: Record<CustomerId, number> = { maritime: 92, finserv: 84, media: 96, healthcare: 88, automotive: 86 };
const MARKET: Record<CustomerId, number> = { maritime: 3, finserv: 1, media: 9, healthcare: 11, automotive: 4 };

export function defaultAssumptions(c: CustomerProfile): ValueAssumptions {
  return { hourly: HOURLY[c.id], minPerAlert: 2, minPerAgentAction: 3, hoursPerQuestionnaire: 14, hoursPerEvidence: 1.5, realisation: 45, marketPremiumPct: MARKET[c.id] };
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
const CONTRACT: Record<CustomerId, number> = { maritime: 1_840_000, finserv: 3_350_000, media: 1_120_000, healthcare: 2_580_000, automotive: 6_150_000 };
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
const K: Record<CustomerId, SectorK> = {
  maritime: { elReduction: 0.34, incidentsPerOpen: 29, questionnaires: 48, otDowntimeHours: 41, otHourCost: 24_000, custodyEvents: 6, custodyEventValue: 38_000, atoCost: 72_000, exposureDayCost: 420 },
  finserv: { elReduction: 0.31, incidentsPerOpen: 33, questionnaires: 164, otDowntimeHours: 6, otHourCost: 210_000, custodyEvents: 14, custodyEventValue: 64_000, atoCost: 118_000, exposureDayCost: 610 },
  media: { elReduction: 0.37, incidentsPerOpen: 27, questionnaires: 71, otDowntimeHours: 9, otHourCost: 85_000, custodyEvents: 23, custodyEventValue: 96_000, atoCost: 54_000, exposureDayCost: 380 },
  healthcare: { elReduction: 0.33, incidentsPerOpen: 30, questionnaires: 58, otDowntimeHours: 28, otHourCost: 36_000, custodyEvents: 5, custodyEventValue: 52_000, atoCost: 96_000, exposureDayCost: 470 },
  automotive: { elReduction: 0.32, incidentsPerOpen: 31, questionnaires: 132, otDowntimeHours: 19, otHourCost: 138_000, custodyEvents: 17, custodyEventValue: 88_000, atoCost: 101_000, exposureDayCost: 560 },
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

const STORIES: Record<CustomerId, Omit<Story, 'value'>[]> = {
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
};
const STORY_VALUE: Record<CustomerId, number[]> = {
  maritime: [1_900_000, 2_400_000, 310_000, 650_000, 87_000, 140_000],
  finserv: [2_800_000, 1_100_000, 260_000, 900_000, 1_700_000, 410_000],
  media: [3_200_000, 480_000, 1_400_000, 120_000, 520_000, 160_000],
  healthcare: [2_600_000, 940_000, 380_000, 690_000, 210_000, 640_000],
  automotive: [4_100_000, 2_300_000, 1_600_000, 330_000, 3_800_000, 2_700_000],
};

export function valueModel(c: CustomerProfile, tenantId: string, a: ValueAssumptions): ValueModel {
  const h = headlines(c, tenantId);
  const k = K[c.id];
  const share = tenantShare(c, tenantId);
  const r = rng(`value-${c.id}`);
  const rate = a.hourly;
  const real = a.realisation / 100;
  const svcState = (s: ServiceId | null) => (s ? c.services[s] : 'active');

  /* ---------- cost ---------- */
  const contract = CONTRACT[c.id] * share;
  const costLines = COST_SPLIT.map((x) => ({ label: x.label, cap: x.cap, value: Math.round(contract * x.w), trial: svcState(VCAP_BY_ID[x.cap].service) === 'trial' }));
  const cost = costLines.reduce((s, x) => s + x.value, 0);

  /* ---------- loss avoided (CRQ) ---------- */
  const elNow = h.insurance.expectedLossM * 1e6 * share;
  const elBefore = elNow / (1 - k.elReduction);
  const lossAvoided = elBefore - elNow;
  const lossShare: Record<CapKey, number> = { soc: 0.38, int: 0.12, strike: 0.16, ot: 0.14, comply: 0.04, custody: c.id === 'media' ? 0.12 : 0.08, ai: 0.04, view: 0.04 };
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
    { key: 'custody', cap: 'custody', label: c.id === 'media' ? 'Pre-release leaks prevented' : c.id === 'automotive' ? 'Design IP and OTA lineage protected' : 'Sensitive data custody enforced', value: custodyVal, formula: `${k.custodyEvents} contained events × value at risk${svcState('custody') === 'trial' ? ' × 40% (trial)' : ''}`, source: 'HexaCustody revocations and anomalies', to: '/custody/revocation' },
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
  const stories = STORIES[c.id]
    .map((s, i) => ({ ...s, value: STORY_VALUE[c.id][i] }))
    .filter((s) => tenantId === 'all' || s.tenantId === 'all' || tIds.includes(s.tenantId));

  const net = total - cost;
  return {
    share, cost, costLines, lines, byCap, total, roi: cost ? total / cost : 0, net, paybackMonths: Math.max(1, Math.round((cost / Math.max(1, total)) * 12 * 10) / 10),
    hoursSaved, hoursBreakdown, lossAvoided, elBefore, elNow, premiumSaving, premium, premiumDeltaPct, toolSaving, toolCount,
    incidentsContained, openIncidents, mttr, mttrBefore, questionnaires, audits: auditsSupported, quarters, beforeAfter: ba, stories,
  };
}
