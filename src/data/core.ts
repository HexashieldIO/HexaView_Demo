import type { CustomerId, CustomerProfile } from './types';
import { rng } from '../lib/rng';
import { groupRI, scopedTenants, tenantShare, scale } from './customers';
import { TECHNIQUE_BY_ID } from './reference';

/* =====================================================================
   Headline numbers. Every module page MUST anchor its own detail to these
   so the Command Centre, Board view and module pages agree with each other.
   Values are group-level; use headlines(c, tenantId) for the scoped version.
   ===================================================================== */
export interface Headlines {
  soc: { openIncidents: number; critical: number; high: number; mttdMin: number; mttaMin: number; mttrMin: number; slaPct: number; alerts24h: number; autoTriagedPct: number; attackCoveragePct: number; huntsActive: number; detectionsLive: number };
  int: { prioritisedItems: number; exposedCredentials: number; stealerMachines: number; lookalikeDomains: number; darkWebMentions: number; vipsMonitored: number };
  strike: { openFindings: number; criticalFindings: number; findingsToDetectionsPct: number; externalAssets: number; testsThisQuarter: number; meanTimeToRemediateDays: number };
  ot: { otAssets: number; sites: number; otAlerts: number; otVulns: number; sensors: number; purdueCoveragePct: number };
  comply: { controlsMetPct: number; frameworks: number; evidenceItems: number; overdueTasks: number; vendors: number; highRiskVendors: number; aiSystems: number };
  custody: { assetsUnderCustody: number; vendorsInChain: number; transfers7d: number; revocations30d: number; anomalies: number; agents: number };
  ai: { aiSystems: number; shadowAi: number; copilotQueries30d: number; agentActions7d: number; humanApprovalPct: number };
  insurance: { insurability: number; premiumDeltaPct: number; expectedLossM: number; tailLossM: number; attestedControls: number; totalControls: number };
  fabric: { connectors: number; healthy: number; dataPlanes: number; eventsPerDay: number; entities: number; assets: number; identities: number };
  ops: { pendingApprovals: number; actions30d: number; auditEvents30d: number; lastAnchorMin: number };
}

const BASE: Record<CustomerId, Omit<Headlines, 'fabric'>> = {
  maritime: {
    soc: { openIncidents: 14, critical: 1, high: 4, mttdMin: 7, mttaMin: 4, mttrMin: 41, slaPct: 99.96, alerts24h: 3870, autoTriagedPct: 94, attackCoveragePct: 68, huntsActive: 3, detectionsLive: 412 },
    int: { prioritisedItems: 31, exposedCredentials: 86, stealerMachines: 12, lookalikeDomains: 9, darkWebMentions: 17, vipsMonitored: 14 },
    strike: { openFindings: 23, criticalFindings: 2, findingsToDetectionsPct: 61, externalAssets: 384, testsThisQuarter: 6, meanTimeToRemediateDays: 19 },
    ot: { otAssets: 1912, sites: 26, otAlerts: 2140, otVulns: 3260, sensors: 31, purdueCoveragePct: 87 },
    comply: { controlsMetPct: 81, frameworks: 6, evidenceItems: 1284, overdueTasks: 27, vendors: 148, highRiskVendors: 9, aiSystems: 8 },
    custody: { assetsUnderCustody: 2310, vendorsInChain: 11, transfers7d: 640, revocations30d: 7, anomalies: 3, agents: 58 },
    ai: { aiSystems: 8, shadowAi: 5, copilotQueries30d: 1240, agentActions7d: 9180, humanApprovalPct: 100 },
    insurance: { insurability: 76, premiumDeltaPct: -6, expectedLossM: 4.8, tailLossM: 62, attestedControls: 21, totalControls: 26 },
    ops: { pendingApprovals: 3, actions30d: 64, auditEvents30d: 48210, lastAnchorMin: 3 },
  },
  finserv: {
    soc: { openIncidents: 22, critical: 1, high: 6, mttdMin: 4, mttaMin: 3, mttrMin: 33, slaPct: 99.98, alerts24h: 11240, autoTriagedPct: 96, attackCoveragePct: 79, huntsActive: 5, detectionsLive: 986 },
    int: { prioritisedItems: 44, exposedCredentials: 213, stealerMachines: 27, lookalikeDomains: 23, darkWebMentions: 38, vipsMonitored: 26 },
    strike: { openFindings: 31, criticalFindings: 1, findingsToDetectionsPct: 74, externalAssets: 912, testsThisQuarter: 11, meanTimeToRemediateDays: 14 },
    ot: { otAssets: 1180, sites: 9, otAlerts: 410, otVulns: 620, sensors: 12, purdueCoveragePct: 91 },
    comply: { controlsMetPct: 87, frameworks: 8, evidenceItems: 4620, overdueTasks: 18, vendors: 412, highRiskVendors: 14, aiSystems: 8 },
    custody: { assetsUnderCustody: 8840, vendorsInChain: 19, transfers7d: 2210, revocations30d: 24, anomalies: 5, agents: 940 },
    ai: { aiSystems: 8, shadowAi: 3, copilotQueries30d: 4810, agentActions7d: 28400, humanApprovalPct: 100 },
    insurance: { insurability: 84, premiumDeltaPct: -9, expectedLossM: 11.2, tailLossM: 185, attestedControls: 24, totalControls: 26 },
    ops: { pendingApprovals: 5, actions30d: 142, auditEvents30d: 118400, lastAnchorMin: 2 },
  },
  media: {
    soc: { openIncidents: 11, critical: 1, high: 3, mttdMin: 9, mttaMin: 6, mttrMin: 52, slaPct: 99.91, alerts24h: 2420, autoTriagedPct: 92, attackCoveragePct: 61, huntsActive: 1, detectionsLive: 268 },
    int: { prioritisedItems: 27, exposedCredentials: 64, stealerMachines: 15, lookalikeDomains: 14, darkWebMentions: 22, vipsMonitored: 18 },
    strike: { openFindings: 19, criticalFindings: 3, findingsToDetectionsPct: 52, externalAssets: 296, testsThisQuarter: 4, meanTimeToRemediateDays: 24 },
    ot: { otAssets: 640, sites: 3, otAlerts: 380, otVulns: 410, sensors: 6, purdueCoveragePct: 79 },
    comply: { controlsMetPct: 76, frameworks: 6, evidenceItems: 980, overdueTasks: 34, vendors: 63, highRiskVendors: 11, aiSystems: 8 },
    custody: { assetsUnderCustody: 14600, vendorsInChain: 63, transfers7d: 4180, revocations30d: 41, anomalies: 9, agents: 412 },
    ai: { aiSystems: 8, shadowAi: 6, copilotQueries30d: 690, agentActions7d: 6120, humanApprovalPct: 100 },
    insurance: { insurability: 71, premiumDeltaPct: 4, expectedLossM: 3.1, tailLossM: 38, attestedControls: 18, totalControls: 26 },
    ops: { pendingApprovals: 2, actions30d: 38, auditEvents30d: 21980, lastAnchorMin: 4 },
  },
  healthcare: {
    soc: { openIncidents: 18, critical: 1, high: 5, mttdMin: 6, mttaMin: 4, mttrMin: 44, slaPct: 99.94, alerts24h: 8620, autoTriagedPct: 95, attackCoveragePct: 66, huntsActive: 3, detectionsLive: 604 },
    int: { prioritisedItems: 36, exposedCredentials: 241, stealerMachines: 31, lookalikeDomains: 12, darkWebMentions: 29, vipsMonitored: 16 },
    strike: { openFindings: 27, criticalFindings: 2, findingsToDetectionsPct: 57, externalAssets: 468, testsThisQuarter: 5, meanTimeToRemediateDays: 26 },
    ot: { otAssets: 14600, sites: 7, otAlerts: 1760, otVulns: 9840, sensors: 19, purdueCoveragePct: 82 },
    comply: { controlsMetPct: 79, frameworks: 6, evidenceItems: 2380, overdueTasks: 31, vendors: 286, highRiskVendors: 13, aiSystems: 8 },
    custody: { assetsUnderCustody: 3920, vendorsInChain: 14, transfers7d: 980, revocations30d: 11, anomalies: 4, agents: 210 },
    ai: { aiSystems: 8, shadowAi: 4, copilotQueries30d: 2140, agentActions7d: 19800, humanApprovalPct: 100 },
    insurance: { insurability: 73, premiumDeltaPct: 3, expectedLossM: 6.9, tailLossM: 71, attestedControls: 19, totalControls: 26 },
    ops: { pendingApprovals: 4, actions30d: 88, auditEvents30d: 74300, lastAnchorMin: 3 },
  },
  automotive: {
    soc: { openIncidents: 26, critical: 2, high: 7, mttdMin: 5, mttaMin: 3, mttrMin: 37, slaPct: 99.97, alerts24h: 16480, autoTriagedPct: 96, attackCoveragePct: 74, huntsActive: 4, detectionsLive: 1124 },
    int: { prioritisedItems: 52, exposedCredentials: 388, stealerMachines: 44, lookalikeDomains: 31, darkWebMentions: 47, vipsMonitored: 22 },
    strike: { openFindings: 38, criticalFindings: 2, findingsToDetectionsPct: 69, externalAssets: 1460, testsThisQuarter: 14, meanTimeToRemediateDays: 17 },
    ot: { otAssets: 9800, sites: 34, otAlerts: 3920, otVulns: 7410, sensors: 46, purdueCoveragePct: 84 },
    comply: { controlsMetPct: 82, frameworks: 7, evidenceItems: 5180, overdueTasks: 23, vendors: 640, highRiskVendors: 21, aiSystems: 8 },
    custody: { assetsUnderCustody: 11200, vendorsInChain: 37, transfers7d: 3260, revocations30d: 29, anomalies: 6, agents: 1480 },
    ai: { aiSystems: 8, shadowAi: 5, copilotQueries30d: 5320, agentActions7d: 41200, humanApprovalPct: 100 },
    insurance: { insurability: 78, premiumDeltaPct: -4, expectedLossM: 21.4, tailLossM: 410, attestedControls: 21, totalControls: 26 },
    ops: { pendingApprovals: 6, actions30d: 171, auditEvents30d: 162800, lastAnchorMin: 2 },
  },
};

export function headlines(c: CustomerProfile, tenantId = 'all'): Headlines {
  const b = BASE[c.id];
  const s = tenantShare(c, tenantId);
  const healthy = c.connectors.filter((k) => k.status === 'healthy').length;
  const fabric = {
    connectors: c.connectors.length,
    healthy,
    dataPlanes: c.dataPlanes.length,
    eventsPerDay: c.dataPlanes.reduce((n, d) => n + d.eventsPerMin, 0) * 1440,
    entities: c.connectors.reduce((n, k) => n + k.records, 0),
    assets: Math.round(c.employees * 1.6 + b.ot.otAssets),
    identities: Math.round(c.employees * 1.35),
  };
  if (tenantId === 'all') return { ...b, fabric };
  const t = scopedTenants(c, tenantId)[0];
  const hasOt = t?.env.includes('ot');
  return {
    soc: { ...b.soc, openIncidents: scale(b.soc.openIncidents, s, 2), critical: s > 0.25 ? b.soc.critical : 0, high: scale(b.soc.high, s, 1), alerts24h: scale(b.soc.alerts24h, s, 40), huntsActive: Math.max(1, scale(b.soc.huntsActive, s)) },
    int: { ...b.int, prioritisedItems: scale(b.int.prioritisedItems, s, 3), exposedCredentials: scale(b.int.exposedCredentials, s, 4), stealerMachines: scale(b.int.stealerMachines, s, 1), darkWebMentions: scale(b.int.darkWebMentions, s, 1), vipsMonitored: scale(b.int.vipsMonitored, s, 2) },
    strike: { ...b.strike, openFindings: scale(b.strike.openFindings, s, 3), criticalFindings: s > 0.2 ? b.strike.criticalFindings : 0, externalAssets: scale(b.strike.externalAssets, s, 12), testsThisQuarter: Math.max(1, scale(b.strike.testsThisQuarter, s)) },
    ot: hasOt
      ? { ...b.ot, otAssets: scale(b.ot.otAssets, s * 1.6, 40), sites: Math.max(1, scale(b.ot.sites, s)), otAlerts: scale(b.ot.otAlerts, s * 1.6, 10), otVulns: scale(b.ot.otVulns, s * 1.6, 10), sensors: Math.max(1, scale(b.ot.sensors, s * 1.6)) }
      : { ...b.ot, otAssets: 0, sites: 0, otAlerts: 0, otVulns: 0, sensors: 0, purdueCoveragePct: 0 },
    comply: { ...b.comply, evidenceItems: scale(b.comply.evidenceItems, s, 40), overdueTasks: scale(b.comply.overdueTasks, s, 1), vendors: scale(b.comply.vendors, s, 8) },
    custody: { ...b.custody, assetsUnderCustody: scale(b.custody.assetsUnderCustody, s, 20), transfers7d: scale(b.custody.transfers7d, s, 5), revocations30d: scale(b.custody.revocations30d, s), anomalies: scale(b.custody.anomalies, s), agents: scale(b.custody.agents, s, 2) },
    ai: { ...b.ai, copilotQueries30d: scale(b.ai.copilotQueries30d, s, 20), agentActions7d: scale(b.ai.agentActions7d, s, 50) },
    insurance: b.insurance,
    fabric: { ...fabric, entities: scale(fabric.entities, s, 100), assets: scale(fabric.assets, s, 50), identities: scale(fabric.identities, s, 30), eventsPerDay: scale(fabric.eventsPerDay, s, 1000) },
    ops: { ...b.ops, pendingApprovals: Math.max(1, scale(b.ops.pendingApprovals, s)), actions30d: scale(b.ops.actions30d, s, 4), auditEvents30d: scale(b.ops.auditEvents30d, s, 500) },
  };
}

/* =====================================================================
   Resilience Index v1 (LLD 7.7). Weights are versioned; the UI always shows
   how the number is made.
   ===================================================================== */
export const RI_VERSION = 'ri-v1.2';
export const RI_WEIGHTS = [
  { key: 'loop', label: 'Loop assurance', weight: 0.3, measure: 'Closed loops over applicable loops; stale loops count half' },
  { key: 'coverage', label: 'Control coverage', weight: 0.2, measure: 'Mean documented coverage across enabled frameworks' },
  { key: 'exposure', label: 'Exposure', weight: 0.25, measure: 'One minus normalised open-finding exposure (severity × asset criticality × age)' },
  { key: 'detection', label: 'Detection health', weight: 0.15, measure: 'Enabled detections on healthy, fresh connectors × ATT&CK coverage of priority techniques' },
  { key: 'data', label: 'Data completeness', weight: 0.1, measure: 'Share of expected connector categories connected and healthy' },
] as const;
export type RiKey = (typeof RI_WEIGHTS)[number]['key'];

const RI_OFFSETS: Record<CustomerId, Record<RiKey, number>> = {
  maritime: { loop: -14, coverage: 1, exposure: 4, detection: 9, data: 12 },
  finserv: { loop: -11, coverage: 3, exposure: 2, detection: 7, data: 9 },
  media: { loop: -15, coverage: -1, exposure: 5, detection: 8, data: 13 },
  healthcare: { loop: -16, coverage: 2, exposure: 3, detection: 9, data: 12 },
  automotive: { loop: -12, coverage: 2, exposure: 3, detection: 8, data: 9 },
};

export interface RiBreakdown {
  value: number;
  components: { key: RiKey; label: string; weight: number; measure: string; score: number; contribution: number }[];
  provisional: boolean;
}

export function resilienceIndex(c: CustomerProfile, tenantId = 'all'): RiBreakdown {
  const base = groupRI(c, tenantId);
  const off = RI_OFFSETS[c.id];
  const components = RI_WEIGHTS.map((w) => {
    const score = Math.max(0, Math.min(100, base + off[w.key]));
    return { key: w.key, label: w.label, weight: w.weight, measure: w.measure, score, contribution: score * w.weight };
  });
  const value = Math.round(components.reduce((s, x) => s + x.contribution, 0));
  return { value, components, provisional: false };
}

/** Twelve monthly points ending at the current value (oldest first). */
export function riTrend(c: CustomerProfile, tenantId = 'all'): number[] {
  const now = resilienceIndex(c, tenantId).value;
  const r = rng(`ri-trend-${c.id}-${tenantId}`);
  const out: number[] = [];
  let v = now - r.int(9, 14);
  for (let i = 0; i < 11; i++) {
    v += (now - v) / (11 - i) + (r() - 0.45) * 2.2;
    out.push(Math.round(Math.min(100, v)));
  }
  out.push(now);
  return out;
}

/** "What would raise it most": the drivers shown on the Board view (LLD 7.7). */
export function riDrivers(c: CustomerProfile): { text: string; gain: number; module: string; path: string }[] {
  const common = {
    maritime: [
      { text: 'Close 9 partial loops on vessel remote-access controls (IACS E26) by deploying the two staged Sentinel rules', gain: 2.1, module: 'Closed loop', path: '/loop' },
      { text: 'Remediate 2 KEV-listed vulnerabilities on internet-facing terminal gateways (Port Klang, Santos)', gain: 1.6, module: 'Exposure', path: '/fabric/exposure' },
      { text: 'Re-validate T1133 and T1078 detections at Antwerp: last HexaStrike test is 104 days old', gain: 1.2, module: 'HexaStrike', path: '/strike/purple' },
      { text: 'Restore the Veeam connector (field drift since v12.2) so backup evidence is fresh again', gain: 0.9, module: 'Integrations', path: '/fabric/integrations' },
      { text: 'Bring Port Klang OT edge agent to 1.9.x and clear the sensor feed delay', gain: 0.6, module: 'Data planes', path: '/fabric/dataplanes' },
    ],
    finserv: [
      { text: 'Close 7 partial DORA Art. 9 loops by validating the new privileged-access detections in Splunk', gain: 1.8, module: 'Closed loop', path: '/loop' },
      { text: 'Retire 14 standing Tier 0 admin accounts surfaced by CyberArk and SailPoint', gain: 1.4, module: 'Identity', path: '/fabric/identity' },
      { text: 'Remediate the critical pen-test finding on the open-banking API (BOLA) before the QSA visit', gain: 1.1, module: 'HexaStrike', path: '/strike/pentest' },
      { text: 'Clear the Veracode rate limit so AppSec evidence for PCI 6.2 stops going stale', gain: 0.7, module: 'Integrations', path: '/fabric/integrations' },
      { text: 'Complete ICT third-party exit plans for 3 critical providers (DORA Art. 28)', gain: 0.6, module: 'Third-party risk', path: '/comply/tprm' },
    ],
    media: [
      { text: 'Close 11 partial loops on content-exfiltration controls (MPA, TPN) with the staged SecOps rules', gain: 2.4, module: 'Closed loop', path: '/loop' },
      { text: 'Enforce custody agents at Red Fern Localisation (rating 58, 2 untracked copies last week)', gain: 1.7, module: 'HexaCustody', path: '/custody/vendors' },
      { text: 'Fix 3 critical findings on screeners.kestrelpictures.com (auth bypass on review links)', gain: 1.5, module: 'HexaStrike', path: '/strike/pentest' },
      { text: 'Rotate the KnowBe4 API key so awareness evidence (ISO A.6.3) is fresh again', gain: 0.6, module: 'Integrations', path: '/fabric/integrations' },
      { text: 'Upgrade the Atlanta broadcast edge agent and restore the PTP timing feed', gain: 0.5, module: 'Data planes', path: '/fabric/dataplanes' },
    ],
    healthcare: [
      { text: 'Close 12 partial loops on remote-access and MFA controls (HPH CPGs 1.5, HIPAA 164.312) with the staged Sentinel rules', gain: 2.3, module: 'Closed loop', path: '/loop' },
      { text: 'Segment 1,140 legacy infusion pumps and imaging workstations still on the flat clinical VLAN at the community hospitals', gain: 1.8, module: 'HexaOT', path: '/ot/visibility' },
      { text: 'Enforce phishing-resistant MFA for the 214 help-desk reset-eligible accounts (Scattered Spider pattern)', gain: 1.3, module: 'Identity', path: '/fabric/identity' },
      { text: 'Restore the Epic Clarity extract so break-the-glass evidence stops going stale', gain: 0.8, module: 'Integrations', path: '/fabric/integrations' },
      { text: 'Upgrade the community-hospital edge agent and relieve the Marion MPLS link', gain: 0.6, module: 'Data planes', path: '/fabric/dataplanes' },
    ],
    automotive: [
      { text: 'Close 10 partial loops on vendor remote access to robot cells (IEC 62443 SR 1.13, TISAX 4.1.3) by validating BeyondTrust detections', gain: 2.0, module: 'Closed loop', path: '/loop' },
      { text: 'Remove the 3 IT-to-OT conduits at Puebla that bypass the Level 3.5 DMZ', gain: 1.7, module: 'HexaOT', path: '/ot/visibility' },
      { text: 'Rotate the OTA signing HSM operator credentials found in a supplier stealer log (R156 7.1.1)', gain: 1.2, module: 'HexaInt', path: '/int/exposure' },
      { text: 'Restore SAP Enterprise Threat Detection field mapping so supplier-master changes are monitored again', gain: 0.8, module: 'Integrations', path: '/fabric/integrations' },
      { text: 'Bring the Puebla plant edge agent two versions forward and off LTE failover', gain: 0.6, module: 'Data planes', path: '/fabric/dataplanes' },
    ],
  };
  return common[c.id];
}

/* =====================================================================
   Closed loops (LLD section 7). One loop per control × ATT&CK technique.
   ===================================================================== */
export type LinkKey = 'requirement' | 'control' | 'evidence' | 'technique' | 'detection' | 'validation';
export type LinkState = 'ok' | 'missing' | 'stale' | 'failed';
export type LoopStatus = 'closed' | 'partial' | 'broken' | 'stale' | 'not_applicable';

export interface LoopLink {
  state: LinkState;
  ref: string;
  source: string;
  daysAgo?: number;
}
export interface Loop {
  id: string;
  tenantId: string;
  controlId: string;
  control: string;
  framework: string;
  requirement: string;
  technique: string;
  techniqueName: string;
  status: LoopStatus;
  links: Record<LinkKey, LoopLink>;
  missing: LinkKey[];
  owner: string;
  evaluatedMinAgo: number;
}

export const LINK_ORDER: { key: LinkKey; label: string; from: string }[] = [
  { key: 'requirement', label: 'Requirement', from: 'Framework pack' },
  { key: 'control', label: 'Control', from: 'HexaComply · GRC' },
  { key: 'evidence', label: 'Evidence', from: 'GRC · snapshots' },
  { key: 'technique', label: 'ATT&CK technique', from: 'HexaMatrix' },
  { key: 'detection', label: 'Detection', from: 'SIEM · EDR' },
  { key: 'validation', label: 'Validation', from: 'HexaStrike · BAS' },
];

interface ControlSeed {
  id: string;
  name: string;
  req: string;
  techniques: string[];
}

const CONTROL_SEEDS: Partial<Record<CustomerId, ControlSeed[]>> = {
  maritime: [
    { id: 'CTL-ACC-01', name: 'MFA for all remote and privileged access', req: 'ISO 27001 A.8.5 · NIS2 21(2)(j)', techniques: ['T1078', 'T1110.003', 'T1621', 'T1133'] },
    { id: 'CTL-OT-02', name: 'Vendor remote access to OT brokered via PAM jump host', req: 'IACS UR E26 4.2.2 · IEC 62443 SR 1.13', techniques: ['T0886', 'T1133', 'T1219'] },
    { id: 'CTL-OT-03', name: 'Removable media control on vessel and crane engineering stations', req: 'IACS UR E26 4.3.3 · IMO MSC-FAL.1/Circ.3', techniques: ['T0847', 'T1204.002'] },
    { id: 'CTL-NET-04', name: 'IT/OT segmentation with Level 3.5 DMZ', req: 'IEC 62443-3-3 SR 5.1 · ISO 27001 A.8.22', techniques: ['T1021.002', 'T1570', 'T0866'] },
    { id: 'CTL-MAL-05', name: 'EDR on all IT endpoints and servers', req: 'ISO 27001 A.8.7', techniques: ['T1204.002', 'T1059.001', 'T1486'] },
    { id: 'CTL-LOG-06', name: 'Centralised logging with tamper protection', req: 'ISO 27001 A.8.15 · NIS2 21(2)(b)', techniques: ['T1070.001', 'T1562.001'] },
    { id: 'CTL-BKP-07', name: 'Immutable backups with tested restore for TOS and SAP', req: 'ISO 27001 A.8.13 · NIS2 21(2)(c)', techniques: ['T1490', 'T1486'] },
    { id: 'CTL-VUL-08', name: 'Internet-facing systems patched within 14 days (KEV 72 h)', req: 'ISO 27001 A.8.8 · NIS2 21(2)(e)', techniques: ['T1190', 'T1133'] },
    { id: 'CTL-PRV-09', name: 'Privileged accounts vaulted and rotated', req: 'ISO 27001 A.8.2', techniques: ['T1003.001', 'T1558.003', 'T1098'] },
    { id: 'CTL-EML-10', name: 'Email attachment sandboxing and link rewriting', req: 'ISO 27001 A.8.23', techniques: ['T1566.001', 'T1566.002'] },
    { id: 'CTL-SUP-11', name: 'Supplier access reviewed quarterly', req: 'ISO 27001 A.5.19 · NIS2 21(2)(d)', techniques: ['T1199', 'T1195.002'] },
    { id: 'CTL-OT-12', name: 'PLC programme change monitoring', req: 'IEC 62443 SR 3.4 · IACS UR E27', techniques: ['T0843', 'T0821', 'T0836'] },
    { id: 'CTL-CLD-13', name: 'Cloud workload hardening baseline (CIS)', req: 'ISO 27001 A.5.23', techniques: ['T1530', 'T1136.003', 'T1580'] },
    { id: 'CTL-GNSS-14', name: 'Navigation integrity monitoring (GNSS/AIS anomalies)', req: 'IMO MSC.428(98) · Maritime overlay', techniques: ['T0832', 'T0855'] },
  ],
  finserv: [
    { id: 'CTL-IAM-01', name: 'Phishing-resistant MFA for workforce and privileged users', req: 'DORA Art. 9(4)(d) · PCI 8.4 · NYDFS 500.12', techniques: ['T1078', 'T1621', 'T1110.003', 'T1539'] },
    { id: 'CTL-PAM-02', name: 'Tier 0 credentials vaulted, JIT and session-recorded', req: 'DORA Art. 9 · SWIFT 1.2 · ISO A.8.2', techniques: ['T1003.001', 'T1558.003', 'T1098', 'T1550.002'] },
    { id: 'CTL-SWF-03', name: 'SWIFT secure zone segregation and operator MFA', req: 'SWIFT CSCF 1.1, 4.2', techniques: ['T1021.001', 'T1657', 'T1078'] },
    { id: 'CTL-PAY-04', name: 'Cardholder data environment segmentation', req: 'PCI DSS 1.3, 1.4', techniques: ['T1021.002', 'T1570', 'T1046'] },
    { id: 'CTL-EDR-05', name: 'EDR with tamper protection on all endpoints and servers', req: 'PCI DSS 5.2 · ISO A.8.7', techniques: ['T1562.001', 'T1059.001', 'T1486', 'T1218.011'] },
    { id: 'CTL-LOG-06', name: 'Security logging, 12-month retention, daily review', req: 'PCI DSS 10.2, 10.4 · DORA Art. 10', techniques: ['T1070.001', 'T1562.001'] },
    { id: 'CTL-VUL-07', name: 'Critical internet-facing vulnerabilities fixed in 7 days', req: 'PCI DSS 6.3.3 · DORA Art. 9(4)(f)', techniques: ['T1190', 'T1133'] },
    { id: 'CTL-DLP-08', name: 'Data loss prevention on email, web and cloud storage', req: 'NYDFS 500.15 · GDPR Art. 32', techniques: ['T1567.002', 'T1048.003', 'T1114.002'] },
    { id: 'CTL-BCP-09', name: 'Cyber-resilient backups and recovery within impact tolerance', req: 'DORA Art. 12 · FCA SYSC 15A', techniques: ['T1490', 'T1486', 'T1489'] },
    { id: 'CTL-TPR-10', name: 'ICT third-party access monitored and time-bound', req: 'DORA Art. 28 · NIS2 21(2)(d)', techniques: ['T1199', 'T1133', 'T1219'] },
    { id: 'CTL-EML-11', name: 'Anti-phishing, DMARC reject and payment-fraud rules', req: 'ISO A.8.23 · DORA Art. 9', techniques: ['T1566.001', 'T1566.002', 'T1657'] },
    { id: 'CTL-CLD-12', name: 'Cloud control plane guardrails (SCPs, Azure Policy)', req: 'DORA Art. 9 · ISO A.5.23', techniques: ['T1530', 'T1136.003', 'T1580', 'T1550.001'] },
    { id: 'CTL-MF-13', name: 'Mainframe RACF privileged change monitoring', req: 'SOX ITGC · DORA Art. 9', techniques: ['T1098', 'T1565.001'] },
  ],
  media: [
    { id: 'CTL-CST-01', name: 'Pre-release content tracked by custody agent end to end', req: 'MPA CS-6.0 · TPN DS-1.0', techniques: ['T1567.002', 'T1530', 'T1048.003'] },
    { id: 'CTL-IAM-02', name: 'MFA on all content systems and review platforms', req: 'TPN AC-3.0 · ISO A.8.5', techniques: ['T1078', 'T1621', 'T1539'] },
    { id: 'CTL-NET-03', name: 'Isolated content network with no direct internet', req: 'MPA DS-1.0 · TPN NS-2.0', techniques: ['T1071.001', 'T1572', 'T1021.002'] },
    { id: 'CTL-DLP-04', name: 'Block personal cloud storage and removable media on edit bays', req: 'MPA DS-11 · TPN DL-1.0', techniques: ['T1567.002', 'T1560.001'] },
    { id: 'CTL-VEN-05', name: 'Vendor TPN assessment before receiving pre-release', req: 'TPN Vendor Mgmt · ISO A.5.19', techniques: ['T1199', 'T1195.002'] },
    { id: 'CTL-EDR-06', name: 'EDR on workstations, render and storage nodes', req: 'ISO A.8.7 · TPN AM-2.0', techniques: ['T1204.002', 'T1486', 'T1059.001'] },
    { id: 'CTL-LOG-07', name: 'Access logging on MAM, NEXIS and S3 content vault', req: 'MPA LG-1.0 · TPN LM-1.0', techniques: ['T1213', 'T1530', 'T1070.001'] },
    { id: 'CTL-WAT-08', name: 'Forensic watermarking on screeners and review links', req: 'MPA CS-4.0', techniques: ['T1567.002', 'T1041'] },
    { id: 'CTL-VUL-09', name: 'Internet-facing review and screener portals patched in 14 days', req: 'ISO A.8.8 · TPN VM-1.0', techniques: ['T1190', 'T1133'] },
    { id: 'CTL-PCI-10', name: 'Subscriber payment pages protected (script integrity)', req: 'PCI DSS 6.4.3, 11.6.1', techniques: ['T1190', 'T1059.003'] },
    { id: 'CTL-BKP-11', name: 'Immutable backup of masters and project files', req: 'ISO A.8.13 · DPP CtS', techniques: ['T1490', 'T1486'] },
    { id: 'CTL-OT-12', name: 'Broadcast IP (ST 2110) network monitored, vendor access brokered', req: 'DPP CtS Broadcast · ISO A.8.22', techniques: ['T0886', 'T0814', 'T1219'] },
  ],
};

CONTROL_SEEDS.healthcare = [
  { id: 'CTL-IAM-01', name: 'Phishing-resistant MFA for remote access, email and privileged users', req: 'HIPAA 164.312(d) · HPH CPG 1.5 · HITRUST 01.q', techniques: ['T1078', 'T1621', 'T1110.003', 'T1539'] },
  { id: 'CTL-HD-02', name: 'Help-desk identity verification before credential or MFA reset', req: 'HPH CPG 1.6 · NIST CSF PR.AA-02', techniques: ['T1078', 'T1098', 'T1621'] },
  { id: 'CTL-MD-03', name: 'Medical device network segmentation (clinical VLANs, no internet)', req: 'HPH CPG 2.7 · FDA 524B · NIST CSF PR.IR-01', techniques: ['T0886', 'T0866', 'T1021.002'] },
  { id: 'CTL-MD-04', name: 'Biomed vendor remote access brokered and recorded', req: 'HIPAA 164.312(b) · HPH CPG 2.2', techniques: ['T1133', 'T1219', 'T0886'] },
  { id: 'CTL-EDR-05', name: 'EDR on all servers and workstations incl. clinical workstations', req: 'HIPAA 164.308(a)(5)(ii)(B) · HPH CPG 2.4', techniques: ['T1486', 'T1059.001', 'T1562.001'] },
  { id: 'CTL-BKP-06', name: 'Immutable backups and tested Epic downtime recovery', req: 'HIPAA 164.308(a)(7) · HPH CPG 2.9', techniques: ['T1490', 'T1486', 'T1489'] },
  { id: 'CTL-LOG-07', name: 'Audit logging of ePHI access (EHR, PACS) with review', req: 'HIPAA 164.312(b) · HITRUST 09.aa', techniques: ['T1213', 'T1070.001', 'T1530'] },
  { id: 'CTL-VUL-08', name: 'Known exploited vulnerabilities remediated within 14 days', req: 'HPH CPG 1.1 · HIPAA 164.308(a)(1)', techniques: ['T1190', 'T1133'] },
  { id: 'CTL-EML-09', name: 'Email impersonation and attachment protection', req: 'HPH CPG 1.2 · HITRUST 09.j', techniques: ['T1566.001', 'T1566.002', 'T1657'] },
  { id: 'CTL-TPR-10', name: 'Business associate (BAA) access reviewed and time-bound', req: 'HIPAA 164.308(b) · HPH CPG 1.8', techniques: ['T1199', 'T1195.002'] },
  { id: 'CTL-DLP-11', name: 'Research data exfiltration controls (genomics, trials)', req: 'NIH data security · HIPAA 164.312(e)', techniques: ['T1567.002', 'T1048.003', 'T1560.001'] },
  { id: 'CTL-PRV-12', name: 'Privileged accounts vaulted, Tier 0 isolated', req: 'HPH CPG 2.3 · HITRUST 01.c', techniques: ['T1003.001', 'T1558.003', 'T1550.002'] },
];
CONTROL_SEEDS.automotive = [
  { id: 'CTL-OTA-01', name: 'OTA package signing in HSM with dual control', req: 'UNECE R156 7.1.1 · ISO/SAE 21434 RQ-10', techniques: ['T1195.002', 'T1078'] },
  { id: 'CTL-VSOC-02', name: 'Vehicle fleet monitoring and incident response (VSOC)', req: 'UNECE R155 7.2.2.2(g) · ISO/SAE 21434 RQ-08', techniques: ['T1190', 'T1078', 'T1071.001'] },
  { id: 'CTL-OT-03', name: 'Vendor remote access to robot cells via PAM with session recording', req: 'IEC 62443 SR 1.13 · TISAX 4.1.3', techniques: ['T0886', 'T1133', 'T1219'] },
  { id: 'CTL-OT-04', name: 'Plant IT/OT segmentation with Level 3.5 DMZ', req: 'IEC 62443-3-3 SR 5.1 · NIS2 21(2)(e)', techniques: ['T1021.002', 'T1570', 'T0866'] },
  { id: 'CTL-OT-05', name: 'PLC programme change detection on press and body lines', req: 'IEC 62443 SR 3.4 · TISAX 5.2.6', techniques: ['T0843', 'T0821', 'T0836'] },
  { id: 'CTL-IP-06', name: 'Prototype and design IP protection (TISAX prototype module)', req: 'TISAX 8.1 · ISO 27001 A.5.12', techniques: ['T1567.002', 'T1530', 'T1213'] },
  { id: 'CTL-IAM-07', name: 'Phishing-resistant MFA for workforce, suppliers and dealers', req: 'TISAX 4.1.2 · NIS2 21(2)(j)', techniques: ['T1078', 'T1621', 'T1110.003', 'T1539'] },
  { id: 'CTL-EDR-08', name: 'EDR on IT and plant Windows hosts (allow-listing where EDR not supported)', req: 'TISAX 5.2.3 · ISO 27001 A.8.7', techniques: ['T1486', 'T1059.001', 'T1562.001'] },
  { id: 'CTL-BKP-09', name: 'Immutable backups of MES, SAP and PLC projects with tested restore', req: 'NIS2 21(2)(c) · TISAX 5.2.8', techniques: ['T1490', 'T1486', 'T1489'] },
  { id: 'CTL-SUP-10', name: 'Supplier access to engineering data reviewed (TISAX label required)', req: 'TISAX 6.1.1 · NIS2 21(2)(d)', techniques: ['T1199', 'T1195.002'] },
  { id: 'CTL-API-11', name: 'Vehicle backend API authorisation and abuse monitoring', req: 'UNECE R155 Annex 5 · ISO/SAE 21434 RQ-09', techniques: ['T1190', 'T1550.001', 'T1078'] },
  { id: 'CTL-ERP-12', name: 'SAP critical transaction and supplier-master change monitoring', req: 'ISO 27001 A.8.16 · TISAX 5.2.4', techniques: ['T1098', 'T1565.001', 'T1657'] },
];

const DETECTION_SOURCE: Record<CustomerId, string[]> = {
  healthcare: ['Sentinel', 'CrowdStrike', 'Claroty xDome', 'FairWarning'],
  automotive: ['QRadar', 'Defender XDR', 'Armis', 'Upstream vSOC'],
  maritime: ['Sentinel', 'Defender XDR', 'Dragos', 'HexaOT'],
  finserv: ['Splunk ES', 'CrowdStrike', 'Zscaler', 'Netskope'],
  media: ['Google SecOps', 'SentinelOne', 'Netskope', 'Cloudflare'],
};

export function loops(c: CustomerProfile, tenantId = 'all'): Loop[] {
  const r = rng(`loops-${c.id}`);
  const seeds = CONTROL_SEEDS[c.id] ?? [];
  const owners = [c.people.grcLead.name, c.people.socLead.name, c.people.ciso.name, c.people.otLead?.name ?? c.people.admin.name, c.people.admin.name];
  const all: Loop[] = [];
  const fwShort = c.frameworks.map((f) => f.short);
  for (const t of c.tenants) {
    for (const s of seeds) {
      const isOtControl = s.techniques.some((x) => x.startsWith('T0'));
      if (isOtControl && !t.env.includes('ot')) continue;
      for (const tech of s.techniques) {
        if (!TECHNIQUE_BY_ID[tech]) continue;
        // Tenant RI shapes how many loops close.
        const pClosed = (t.ri - 40) / 60;
        const roll = r();
        let status: LoopStatus;
        if (roll < pClosed * 0.86) status = 'closed';
        else if (roll < pClosed * 0.86 + 0.07) status = 'stale';
        else if (roll < pClosed * 0.86 + 0.12) status = 'broken';
        else if (roll < pClosed * 0.86 + 0.14) status = 'not_applicable';
        else status = 'partial';
        const links: Record<LinkKey, LoopLink> = {
          requirement: { state: 'ok', ref: s.req.split(' · ')[0], source: 'Framework pack' },
          control: { state: 'ok', ref: s.id, source: 'HexaComply', daysAgo: r.int(3, 60) },
          evidence: { state: 'ok', ref: `EV-${r.int(1000, 9999)}`, source: r.pick(['HexaComply', 'Connector snapshot', 'Manual upload']), daysAgo: r.int(1, 80) },
          technique: { state: 'ok', ref: tech, source: 'HexaMatrix (Mappings Explorer)' },
          detection: { state: 'ok', ref: `${r.pick(DETECTION_SOURCE[c.id])} · HV-${tech.replace('.', '-')}-${r.int(1, 9)}`, source: r.pick(DETECTION_SOURCE[c.id]), daysAgo: r.int(0, 2) },
          validation: { state: 'ok', ref: `VAL-${r.int(10000, 99999)}`, source: 'HexaStrike', daysAgo: r.int(4, 85) },
        };
        let missing: LinkKey[] = [];
        if (status === 'partial') {
          missing = r.weighted<LinkKey[]>([
            [['validation'], 5], [['detection', 'validation'], 4], [['evidence'], 2], [['detection'], 2], [['evidence', 'validation'], 1], [['control', 'evidence', 'detection', 'validation'], 1],
          ]);
          for (const m of missing) links[m] = { ...links[m], state: 'missing', ref: '—', daysAgo: undefined };
        } else if (status === 'stale') {
          const k = r.pick<LinkKey>(['evidence', 'validation']);
          links[k] = { ...links[k], state: 'stale', daysAgo: r.int(95, 160) };
        } else if (status === 'broken') {
          const k = r.pick<LinkKey>(['detection', 'validation']);
          links[k] = { ...links[k], state: 'failed', ref: k === 'detection' ? `${links.detection.ref} (disabled)` : `${links.validation.ref} (did not fire)` };
        }
        all.push({
          id: `LP-${t.id.toUpperCase()}-${s.id.slice(4)}-${tech}`,
          tenantId: t.id,
          controlId: s.id,
          control: s.name,
          framework: fwShort.find((f) => s.req.includes(f.split(' ')[0])) ?? fwShort[0],
          requirement: s.req,
          technique: tech,
          techniqueName: TECHNIQUE_BY_ID[tech].name,
          status,
          links,
          missing,
          owner: r.pick(owners),
          evaluatedMinAgo: r.int(1, 240),
        });
      }
    }
  }
  return tenantId === 'all' ? all : all.filter((l) => l.tenantId === tenantId);
}

export function loopSummary(ls: Loop[]) {
  const by = (s: LoopStatus) => ls.filter((l) => l.status === s).length;
  const applicable = ls.filter((l) => l.status !== 'not_applicable').length;
  const closed = by('closed');
  const stale = by('stale');
  return {
    total: ls.length,
    applicable,
    closed,
    partial: by('partial'),
    broken: by('broken'),
    stale,
    na: by('not_applicable'),
    assuredPct: applicable ? Math.round(((closed + stale * 0.5) / applicable) * 100) : 0,
  };
}

export const LOOP_STATUS_COLOR: Record<LoopStatus, string> = {
  closed: 'var(--good)',
  partial: 'var(--sev-medium)',
  broken: 'var(--bad)',
  stale: 'var(--sev-low)',
  not_applicable: 'var(--sev-info)',
};
