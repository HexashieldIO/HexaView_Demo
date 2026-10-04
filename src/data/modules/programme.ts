// Security Programme & Roadmap. The plan to improve posture: initiatives,
// budget burn, milestones and maturity against a target, and how each
// initiative moves the Resilience Index.
//
// Everything is derived from the customer profile (frameworks, people,
// tenants, connectors, vocabulary, sector text, scores) and a seeded RNG, so
// it works for any customer without per-customer tables. Status changes made
// in the demo live in a small in-session store shared by every tab.

import type { CustomerProfile, FrameworkScope, Person } from '../types';
import { rng } from '../../lib/rng';
import { headlines, resilienceIndex, riTrend } from '../core';
import { NOW } from '../../lib/format';

/* =====================================================================
   Vocabulary
   ===================================================================== */
export type WsId = 'identity' | 'detection' | 'ot' | 'data' | 'thirdparty' | 'resilience' | 'governance' | 'ai';
export interface Workstream { id: WsId; label: string; short: string; hex: string }
export const WORKSTREAMS: Workstream[] = [
  { id: 'identity', label: 'Identity', short: 'Identity', hex: '#4f8cff' },
  { id: 'detection', label: 'Detection & response', short: 'Detect & respond', hex: '#2dd4bf' },
  { id: 'ot', label: 'OT / IoT security', short: 'OT / IoT', hex: '#f5a83d' },
  { id: 'data', label: 'Data protection', short: 'Data', hex: '#a07cfb' },
  { id: 'thirdparty', label: 'Third-party', short: 'Third-party', hex: '#ef6aae' },
  { id: 'resilience', label: 'Resilience / BCP', short: 'Resilience', hex: '#93d65a' },
  { id: 'governance', label: 'Governance / compliance', short: 'Governance', hex: '#68b1ff' },
  { id: 'ai', label: 'AI security', short: 'AI security', hex: '#ecc873' },
];
export const WS_BY_ID = Object.fromEntries(WORKSTREAMS.map((w) => [w.id, w])) as Record<WsId, Workstream>;

export type PgStatus = 'Not started' | 'On track' | 'At risk' | 'Late' | 'Complete' | 'On hold';
export const PG_STATUSES: PgStatus[] = ['On track', 'At risk', 'Late', 'Not started', 'Complete', 'On hold'];
export const STATUS_HEX: Record<PgStatus, string> = {
  'On track': '#2dd4bf',
  'At risk': '#f0a338',
  Late: '#f8646f',
  'Not started': '#8593b4',
  Complete: '#4f8cff',
  'On hold': '#a07cfb',
};
export type Rag = 'green' | 'amber' | 'red' | 'grey' | 'blue';
export const RAG_HEX: Record<Rag, string> = { green: '#2dd4bf', amber: '#f0a338', red: '#f8646f', grey: '#8593b4', blue: '#4f8cff' };
export function ragOf(s: PgStatus): Rag {
  return s === 'On track' ? 'green' : s === 'At risk' || s === 'On hold' ? 'amber' : s === 'Late' ? 'red' : s === 'Complete' ? 'blue' : 'grey';
}
export const isLive = (s: PgStatus) => s === 'On track' || s === 'At risk' || s === 'Late' || s === 'On hold';

/* NIST CSF 2.0 functions and categories. */
export type CsfFn = 'GV' | 'ID' | 'PR' | 'DE' | 'RS' | 'RC';
export const CSF_FUNCTIONS: { id: CsfFn; label: string; hex: string }[] = [
  { id: 'GV', label: 'Govern', hex: '#68b1ff' },
  { id: 'ID', label: 'Identify', hex: '#a07cfb' },
  { id: 'PR', label: 'Protect', hex: '#4f8cff' },
  { id: 'DE', label: 'Detect', hex: '#2dd4bf' },
  { id: 'RS', label: 'Respond', hex: '#f5a83d' },
  { id: 'RC', label: 'Recover', hex: '#93d65a' },
];
export const CSF_CATS: { id: string; fn: CsfFn; label: string }[] = [
  { id: 'GV.OC', fn: 'GV', label: 'Organisational context' },
  { id: 'GV.RM', fn: 'GV', label: 'Risk management strategy' },
  { id: 'GV.RR', fn: 'GV', label: 'Roles & responsibilities' },
  { id: 'GV.PO', fn: 'GV', label: 'Policy' },
  { id: 'GV.OV', fn: 'GV', label: 'Oversight' },
  { id: 'GV.SC', fn: 'GV', label: 'Supply chain risk' },
  { id: 'ID.AM', fn: 'ID', label: 'Asset management' },
  { id: 'ID.RA', fn: 'ID', label: 'Risk assessment' },
  { id: 'ID.IM', fn: 'ID', label: 'Improvement' },
  { id: 'PR.AA', fn: 'PR', label: 'Identity & access control' },
  { id: 'PR.AT', fn: 'PR', label: 'Awareness & training' },
  { id: 'PR.DS', fn: 'PR', label: 'Data security' },
  { id: 'PR.PS', fn: 'PR', label: 'Platform security' },
  { id: 'PR.IR', fn: 'PR', label: 'Infrastructure resilience' },
  { id: 'DE.CM', fn: 'DE', label: 'Continuous monitoring' },
  { id: 'DE.AE', fn: 'DE', label: 'Adverse event analysis' },
  { id: 'RS.MA', fn: 'RS', label: 'Incident management' },
  { id: 'RS.AN', fn: 'RS', label: 'Incident analysis' },
  { id: 'RS.CO', fn: 'RS', label: 'Reporting & communication' },
  { id: 'RS.MI', fn: 'RS', label: 'Incident mitigation' },
  { id: 'RC.RP', fn: 'RC', label: 'Recovery plan execution' },
  { id: 'RC.CO', fn: 'RC', label: 'Recovery communication' },
];
export const CSF_CAT_BY_ID = Object.fromEntries(CSF_CATS.map((x) => [x.id, x])) as Record<string, (typeof CSF_CATS)[number]>;

/* =====================================================================
   Programme calendar: 24 months from the start of the quarter three
   quarters ago, so the demo always sits roughly 9 months in.
   ===================================================================== */
export const PG_MONTHS = 24;
export const PG_START = new Date(NOW.getFullYear(), Math.floor(NOW.getMonth() / 3) * 3 - 9, 1);
export const TODAY_M = (() => {
  const m = (NOW.getFullYear() - PG_START.getFullYear()) * 12 + NOW.getMonth() - PG_START.getMonth();
  const dim = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate();
  return m + (NOW.getDate() - 1) / dim;
})();
export function monthDate(m: number): Date {
  const whole = Math.floor(m);
  const d = new Date(PG_START.getFullYear(), PG_START.getMonth() + whole, 1);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(1 + Math.min(dim - 1, Math.round((m - whole) * dim)));
  return d;
}
export function monthLabel(m: number, withYear = false): string {
  return monthDate(m).toLocaleDateString('en-GB', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
}
export function monthYear(m: number): string {
  return monthDate(m).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
export function quarterLabel(q: number): string {
  const d = monthDate(q * 3);
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`;
}
export const QUARTERS = Array.from({ length: PG_MONTHS / 3 }, (_, i) => i);
export const CUR_Q = Math.floor(TODAY_M / 3);

/* =====================================================================
   Sector flavour from profile text (never keyed by customer id)
   ===================================================================== */
export interface Flavour {
  health: boolean; fin: boolean; insurance: boolean; defence: boolean; pharma: boolean; media: boolean; auto: boolean; maritime: boolean; hasOT: boolean; hasCloud: boolean;
}
export function flavour(c: CustomerProfile): Flavour {
  const s = `${c.sector} ${c.sectorLong}`.toLowerCase();
  const fws = c.frameworks.map((f) => `${f.short} ${f.name}`).join(' ').toLowerCase();
  return {
    health: /health|hospital|medical|clinic/.test(s),
    fin: /financ|bank|payment|capital|wealth/.test(s),
    insurance: /insur|reinsur|underwrit/.test(s),
    defence: /defen[cs]e|aerospace|military/.test(s) || /cmmc|itar|dfars/.test(fws),
    pharma: /pharma|life science|biotech|drug/.test(s) || /gxp|annex 11|part 11/.test(fws),
    media: /media|studio|entertain|film|broadcast|animation|game/.test(s),
    auto: /automotive|vehicle|motor/.test(s),
    maritime: /maritime|port|shipping|terminal/.test(s),
    hasOT: c.tenants.some((t) => t.env.includes('ot')) || c.connectors.some((k) => k.category === 'OT'),
    hasCloud: c.tenants.some((t) => t.env.includes('cloud')),
  };
}

function fwMatch(c: CustomerProfile, re: RegExp): FrameworkScope | undefined {
  return c.frameworks.find((f) => re.test(`${f.id} ${f.short} ${f.name}`));
}

/* =====================================================================
   Initiative templates
   ===================================================================== */
type OwnerKey = 'ciso' | 'soc' | 'grc' | 'ot' | 'admin' | 'staff';
interface Tpl {
  key: string;
  ws: WsId;
  title: string;
  desc: string;
  csf: string[];
  fw: RegExp;
  modules: { label: string; path: string }[];
  weight: number;
  ri: number;
  owner: OwnerKey;
  deps?: string[];
  milestones?: string[];
  dur?: [number, number];
  start?: [number, number];
  tenantEnv?: 'ot' | 'cloud';
  /** Template key this one replaces when both apply (framework-specific beats generic). */
  replaces?: string;
}

const GENERIC_FW = /27001|nist|csf|nis2|cpg|essentials|800-|cmmc|dora|hitrust/i;

function templates(c: CustomerProfile): Tpl[] {
  const f = flavour(c);
  const h = headlines(c);
  const v = c.vocab;
  const cj = v.crownJewels[0] ?? 'crown-jewel systems';
  const cj2 = v.crownJewels[1] ?? cj;
  const svc = v.businessServices[0] ?? 'critical services';
  const ot0 = v.otSystems[0] ?? 'plant control systems';
  const covTarget = Math.min(92, h.soc.attackCoveragePct + 14);
  const tier1 = c.thirdParties.filter((t) => t.tier === 1).length || Math.max(3, Math.round(h.comply.highRiskVendors / 2));
  const otSites = h.ot.sites;
  const idp = c.connectors.find((k) => k.category === 'Identity')?.product ?? 'the identity provider';
  const pam = c.connectors.find((k) => k.category === 'PAM')?.product;
  const backup = c.connectors.find((k) => k.category === 'Backup')?.product;
  const dlp = c.connectors.find((k) => k.category === 'DLP')?.product;
  const out: Tpl[] = [
    /* Identity */
    { key: 'id-mfa', ws: 'identity', title: 'Phishing-resistant MFA for privileged and remote access', desc: `Move every admin, remote-access and help-desk-resettable account in ${idp} to FIDO2 / number-matching, and retire SMS and voice factors.`, csf: ['PR.AA'], fw: GENERIC_FW, modules: [{ label: 'Identity', path: '/fabric/identity' }, { label: 'HexaInt credential exposure', path: '/int/exposure' }], weight: 1.1, ri: 1.6, owner: 'admin', milestones: ['Conditional Access policy design approved', 'Privileged cohort enrolled', 'Remote-access cohort enrolled', 'Legacy factors disabled'], dur: [5, 9], start: [0, 4] },
    { key: 'id-pam', ws: 'identity', title: 'Tier 0 vaulting and just-in-time admin', desc: `Vault standing domain and cloud admin accounts${pam ? ` in ${pam}` : ''}, enforce just-in-time elevation and session recording for ${cj}.`, csf: ['PR.AA', 'PR.PS'], fw: GENERIC_FW, modules: [{ label: 'Identity', path: '/fabric/identity' }, { label: 'Attack paths', path: '/fabric/paths' }], weight: 1.3, ri: 1.4, owner: 'admin', milestones: ['Tier 0 inventory reconciled', 'Vault onboarding wave 1', 'Just-in-time elevation live', 'Standing admins removed'], dur: [6, 10], start: [1, 6] },
    { key: 'id-jml', ws: 'identity', title: 'Joiner-mover-leaver automation and access recertification', desc: 'Drive provisioning from HR, automate leaver revocation inside 4 hours and run quarterly recertification for privileged and sensitive groups.', csf: ['PR.AA', 'GV.RR'], fw: GENERIC_FW, modules: [{ label: 'Identity', path: '/fabric/identity' }], weight: 0.8, ri: 0.7, owner: 'grc', dur: [6, 11], start: [6, 13] },
    /* Detection & response */
    { key: 'det-cov', ws: 'detection', title: `Raise ATT&CK coverage of priority techniques to ${covTarget}%`, desc: `Close detection gaps against the techniques used by ${v.threatActors.slice(0, 2).join(' and ')}; today ${h.soc.attackCoveragePct}% of priority techniques have a live, tested detection.`, csf: ['DE.CM', 'DE.AE'], fw: GENERIC_FW, modules: [{ label: 'HexaMatrix', path: '/soc/attack' }, { label: 'Detection engineering', path: '/soc/detection' }], weight: 1.2, ri: 2.0, owner: 'soc', milestones: ['Priority technique list agreed', 'Wave 1 detections deployed', 'Wave 2 detections deployed', 'Coverage target validated'], dur: [8, 13], start: [0, 5] },
    { key: 'det-soar', ws: 'detection', title: 'Automated triage and containment playbooks', desc: `Automate tier-1 triage, enrichment and approved containment for the top 12 alert types (${h.soc.autoTriagedPct}% auto-triaged today).`, csf: ['RS.MA', 'RS.MI', 'RS.AN'], fw: GENERIC_FW, modules: [{ label: 'Playbook builder', path: '/soc/playbooks' }, { label: 'Incidents & response', path: '/soc/ir' }], weight: 0.9, ri: 1.0, owner: 'soc', deps: ['det-cov'], dur: [5, 8], start: [5, 11] },
    { key: 'det-purple', ws: 'detection', title: 'Quarterly purple-team validation of crown-jewel detections', desc: `Prove detections fire for attack paths into ${cj} and ${cj2}; failures become detection-engineering tickets.`, csf: ['DE.CM', 'ID.IM'], fw: GENERIC_FW, modules: [{ label: 'HexaStrike purple teaming', path: '/strike/purple' }, { label: 'Closed-loop assurance', path: '/loop' }], weight: 0.7, ri: 1.2, owner: 'soc', deps: ['det-cov'], dur: [9, 14], start: [6, 10] },
    { key: 'det-exp', ws: 'detection', title: 'Exposure management: KEV fixes inside 14 days on internet-facing assets', desc: `Risk-based patch SLAs across ${h.strike.externalAssets} external assets, with HexaStrike re-test before closure.`, csf: ['ID.RA', 'PR.PS'], fw: GENERIC_FW, modules: [{ label: 'Exposure & vulnerabilities', path: '/fabric/exposure' }, { label: 'Attack surface management', path: '/strike/asm' }], weight: 0.8, ri: 1.3, owner: 'soc', dur: [6, 10], start: [2, 8] },
    /* Data */
    { key: 'data-dlp', ws: 'data', title: `Data classification and DLP for ${cj}`, desc: `Label sensitive data at creation and enforce DLP${dlp ? ` through ${dlp}` : ''} on email, endpoint and SaaS sharing.`, csf: ['PR.DS', 'ID.AM'], fw: /27001|gdpr|hipaa|pci|soc 2|tpn|mpa|privacy/i, modules: [{ label: 'Unified assets', path: '/fabric/assets' }], weight: 1.0, ri: 0.9, owner: 'grc', dur: [7, 12], start: [3, 10] },
    { key: 'data-keys', ws: 'data', title: 'Key management and encryption for crown-jewel stores', desc: `Customer-managed keys${c.byok ? ' (BYOK already live for HexaView)' : ''}, rotation and access logging for ${cj2}.`, csf: ['PR.DS'], fw: /27001|pci|hipaa|dora|soc 2/i, modules: [{ label: 'Cloud posture', path: '/fabric/cloud' }], weight: 0.6, ri: 0.5, owner: 'admin', dur: [4, 7], start: [10, 16] },
    /* Third-party */
    { key: 'tp-tier1', ws: 'thirdparty', title: `Continuous assurance for ${tier1} tier-1 suppliers`, desc: `Replace annual questionnaires with continuous ratings, evidence requests and contract clauses for the ${h.comply.highRiskVendors} high-risk vendors.`, csf: ['GV.SC'], fw: /dora|nis2|27001|soc 2|tpn|hipaa|tisax|cmmc/i, modules: [{ label: 'Third-party risk', path: '/comply/tprm' }, { label: 'Supply chain intel', path: '/int/supply' }], weight: 0.8, ri: 0.9, owner: 'grc', dur: [6, 10], start: [1, 7] },
    { key: 'tp-sbom', ws: 'thirdparty', title: 'Software supply chain: SBOM intake and vendor patch SLAs', desc: 'Require SBOMs for new critical software, monitor components for KEV-listed vulnerabilities and track vendor fix commitments.', csf: ['GV.SC', 'ID.RA'], fw: /524b|r155|21434|62443|cmmc|nis2|ssdf/i, modules: [{ label: 'SBOM', path: '/fabric/sbom' }], weight: 0.6, ri: 0.6, owner: 'grc', dur: [5, 9], start: [9, 15] },
    /* Resilience */
    { key: 'res-backup', ws: 'resilience', title: `Immutable backups and tested restore for ${cj}`, desc: `Immutable, isolated copies${backup ? ` in ${backup}` : ''} with quarterly timed restores against recovery objectives.`, csf: ['RC.RP', 'PR.DS', 'PR.IR'], fw: GENERIC_FW, modules: [{ label: 'Integrations', path: '/fabric/integrations' }, { label: 'Crisis exercises', path: '/ops/exercises' }], weight: 1.0, ri: 1.1, owner: 'admin', milestones: ['Immutability enabled on tier 1', 'Isolated recovery vault built', 'First timed restore', 'Restore evidence automated'], dur: [5, 9], start: [0, 6] },
    { key: 'res-ex', ws: 'resilience', title: 'Board and operational crisis exercise programme', desc: `Quarterly tabletop and technical exercises covering ${svc}, with lessons tracked to closure.`, csf: ['RS.CO', 'RC.CO', 'ID.IM'], fw: /dora|nis2|op res|hipaa|cpg|27001|imo/i, modules: [{ label: 'Crisis exercises', path: '/ops/exercises' }, { label: 'Crisis war room', path: '/ops/warroom' }], weight: 0.4, ri: 0.6, owner: 'ciso', dur: [12, 18], start: [0, 4] },
    { key: 'res-bia', ws: 'resilience', title: `Business impact analysis and recovery objectives for ${svc}`, desc: `Agree impact tolerances, RTO and RPO for the ${v.businessServices.length} business services and map them to supporting systems.`, csf: ['GV.OC', 'RC.RP', 'ID.RA'], fw: /dora|op res|nis2|22301|27001|hipaa/i, modules: [{ label: 'Business impact analysis', path: '/comply/caas?section=bia' }], weight: 0.4, ri: 0.5, owner: 'grc', dur: [4, 7], start: [0, 5] },
    /* Governance */
    { key: 'gov-risk', ws: 'governance', title: 'Quantified cyber risk register and board risk appetite', desc: `Express the top risks in ${c.currency} loss terms, agree appetite with ${c.people.board.name} and report movement quarterly.`, csf: ['GV.RM', 'GV.OV', 'ID.RA'], fw: GENERIC_FW, modules: [{ label: 'Risk quantification', path: '/insurance/quantification' }, { label: 'Board view', path: '/board' }], weight: 0.5, ri: 0.6, owner: 'ciso', dur: [5, 8], start: [0, 3] },
    { key: 'gov-policy', ws: 'governance', title: 'Policy framework refresh and named control owners', desc: 'Rationalise policies onto one control set, assign a named owner to every control and automate evidence collection.', csf: ['GV.PO', 'GV.RR'], fw: GENERIC_FW, modules: [{ label: 'HexaComply frameworks', path: '/comply/caas?section=frameworks' }], weight: 0.4, ri: 0.7, owner: 'grc', dur: [5, 9], start: [0, 6] },
    { key: 'gov-human', ws: 'governance', title: 'Role-based awareness and phishing simulation', desc: 'Targeted training for finance, executives, help desk and engineers, with simulation results feeding the human-risk score.', csf: ['PR.AT'], fw: GENERIC_FW, modules: [{ label: 'Human risk & awareness', path: '/comply/human' }], weight: 0.3, ri: 0.4, owner: 'grc', dur: [10, 16], start: [2, 8] },
    /* AI */
    { key: 'ai-gov', ws: 'ai', title: 'AI management system and model inventory', desc: `Inventory the ${h.ai.aiSystems} AI systems in use, risk-assess each and stand up an ISO/IEC 42001-aligned management system.`, csf: ['GV.PO', 'ID.AM', 'GV.OV'], fw: /42001|ai act|nist ai/i, modules: [{ label: 'AI governance', path: '/ai-governance/overview' }, { label: 'AI management system', path: '/comply/aigov' }], weight: 0.5, ri: 0.5, owner: 'grc', dur: [6, 10], start: [4, 10] },
    { key: 'ai-shadow', ws: 'ai', title: `Shadow AI controls and Copilot data guardrails`, desc: `Block or sanction the ${h.ai.shadowAi} unsanctioned AI tools seen in traffic and apply sensitivity-label guardrails before wider Copilot rollout.`, csf: ['PR.DS', 'DE.CM'], fw: /42001|ai act|gdpr|27001/i, modules: [{ label: 'AI discovery & runtime', path: '/ai/discovery' }, { label: 'Guardrails', path: '/ai-governance/policy' }], weight: 0.5, ri: 0.5, owner: 'admin', deps: ['data-dlp'], dur: [4, 8], start: [11, 17] },
  ];

  if (f.hasOT) {
    const otTitle = f.health
      ? 'Medical device segmentation: infusion pumps, imaging and PACS'
      : f.auto
        ? 'Plant zones and conduits: remove IT-to-OT bypasses'
        : f.maritime
          ? 'Vessel and terminal network segregation (IACS E26/E27)'
          : f.pharma
            ? 'Manufacturing and lab network segmentation (Purdue zones)'
            : `Zones and conduits segmentation for ${ot0}`;
    out.push(
      { key: 'ot-seg', ws: 'ot', title: otTitle, desc: `Enforce zone and conduit policy so ${ot0} and similar assets are reachable only through the Level 3.5 DMZ or approved jump hosts.`, csf: ['PR.IR', 'PR.PS'], fw: /62443|iacs|524b|cpg|tisax|nis2|hitrust|gmp|gxp/i, modules: [{ label: 'HexaOT network', path: '/ot/network' }, { label: 'HexaOT sites', path: '/ot/sites' }], weight: 1.6, ri: 1.8, owner: 'ot', deps: ['ot-vis'], milestones: ['Zone model approved', 'Pilot site enforced', 'Wave 1 sites enforced', 'All sites enforced', 'Conduit evidence to HexaComply'], dur: [10, 14], start: [3, 7], tenantEnv: 'ot' },
      { key: 'ot-vis', ws: 'ot', title: `Passive OT${f.health ? ' and medical device' : ''} visibility across all ${otSites || 'operational'} sites`, desc: `Sensor coverage today is ${h.ot.purdueCoveragePct}% of Purdue levels; extend passive monitoring to every site and feed asset inventory to HexaOT.`, csf: ['ID.AM', 'DE.CM'], fw: /62443|iacs|524b|cpg|nis2|tisax/i, modules: [{ label: 'HexaOT overview', path: '/ot/visibility' }, { label: 'HexaOT assets', path: '/ot/assets' }], weight: 1.2, ri: 1.0, owner: 'ot', dur: [6, 9], start: [0, 2], tenantEnv: 'ot' },
      { key: 'ot-remote', ws: 'ot', title: 'Recorded, approved vendor remote access to OT', desc: 'Route all OEM and integrator access through brokered, time-boxed sessions with recording; remove persistent VPNs and modems.', csf: ['PR.AA', 'GV.SC'], fw: /62443|iacs|tisax|524b|cpg/i, modules: [{ label: 'HexaOT alerts', path: '/ot/alerts' }, { label: 'Third-party risk', path: '/comply/tprm' }], weight: 0.9, ri: 1.1, owner: 'ot', deps: ['id-pam'], dur: [5, 8], start: [7, 12], tenantEnv: 'ot' },
    );
    if (h.ot.otAssets >= 1000) out.push({ key: 'ot-vuln', ws: 'ot', title: `Risk-based OT vulnerability and firmware programme (${h.ot.otVulns.toLocaleString('en-GB')} open)`, desc: 'Prioritise OT vulnerabilities by exploitability and process impact, schedule firmware in maintenance windows and apply compensating controls where patching is impossible.', csf: ['ID.RA', 'PR.PS'], fw: /62443|iacs|524b|cpg/i, modules: [{ label: 'HexaOT vulnerabilities', path: '/ot/vulns' }], weight: 0.9, ri: 0.8, owner: 'ot', deps: ['ot-vis'], dur: [8, 12], start: [9, 14], tenantEnv: 'ot' });
  }

  /* Framework- and sector-driven initiatives. */
  const add = (re: RegExp, t: (fw: FrameworkScope) => Omit<Tpl, 'fw'>) => {
    const fw = fwMatch(c, re);
    if (fw) out.push({ ...t(fw), fw: new RegExp(fw.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
  };
  add(/cmmc/i, (fw) => ({ key: 'fw-cmmc', ws: 'governance', title: `${fw.short}: close POA&M items before the C3PAO assessment`, desc: 'Close open plan-of-action items against NIST SP 800-171 practices, prove FCI/CUI boundary and collect assessor-ready evidence.', csf: ['GV.OV', 'ID.IM', 'PR.AA'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 1.0, ri: 1.1, owner: 'grc', milestones: ['POA&M baselined', 'High-weight practices closed', 'Mock assessment', 'SPRS score submitted', 'C3PAO assessment'], dur: [9, 13], start: [0, 3] }));
  add(/itar|cui enclave/i, (fw) => ({ key: 'fw-itar', ws: 'data', title: `Controlled-data enclave for ${fw.short} technical data`, desc: 'Move export-controlled design data into a segmented enclave with US-person access checks and full audit logging.', csf: ['PR.DS', 'PR.AA'], modules: [{ label: 'Unified assets', path: '/fabric/assets' }], weight: 1.1, ri: 0.8, owner: 'admin', dur: [7, 11], start: [2, 7] }));
  add(/gxp|annex 11|part 11/i, (fw) => ({ key: 'fw-gxp', ws: 'data', title: `GxP validated systems: security controls and audit trails (${fw.short})`, desc: 'Validate security tooling that touches GxP systems, prove audit-trail integrity and keep change control evidence inspection-ready.', csf: ['PR.DS', 'PR.PS', 'GV.PO'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.9, ri: 0.7, owner: 'grc', milestones: ['Validation master plan', 'IQ/OQ of security tooling', 'Audit-trail review automated', 'Inspection dry run'], dur: [8, 12], start: [1, 6] }));
  add(/tpn/i, (fw) => ({ key: 'fw-tpn', ws: 'thirdparty', title: `${fw.short}: Gold Shield across post-production vendors`, desc: 'Bring every vendor that touches pre-release content to TPN Gold Shield, with custody agents and watermarking enforced on transfers.', csf: ['GV.SC', 'PR.DS'], modules: [{ label: 'HexaCustody vendors', path: '/custody/vendors' }, { label: 'Third-party risk', path: '/comply/tprm' }], weight: 0.8, ri: 1.2, owner: 'grc', replaces: 'tp-tier1', dur: [7, 11], start: [0, 5] }));
  add(/dora/i, (fw) => ({ key: 'fw-dora', ws: 'governance', title: `${fw.short}: register of information and threat-led testing (TLPT)`, desc: 'Complete the ICT third-party register, exit strategies for critical providers and the first TLPT cycle with the lead overseer.', csf: ['GV.SC', 'GV.OV', 'ID.IM'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }, { label: 'HexaStrike red teaming', path: '/strike/redteam' }], weight: 1.0, ri: 1.0, owner: 'grc', dur: [10, 14], start: [0, 4] }));
  add(/pci/i, (fw) => ({ key: 'fw-pci', ws: 'data', title: `${fw.short}: future-dated requirements (6.4.3, 11.6.1, 8.4.2)`, desc: 'Script inventory and integrity monitoring on payment pages, MFA into the CDE for all access and targeted risk analyses.', csf: ['PR.DS', 'DE.CM', 'PR.AA'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.6, ri: 0.6, owner: 'grc', dur: [4, 7], start: [0, 4] }));
  add(/r155|r156|21434/i, (fw) => ({ key: 'fw-vsoc', ws: 'detection', title: `Vehicle SOC monitoring and OTA signing hardening (${fw.short})`, desc: 'Extend detection to fleet telemetry for R155 Annex 5 threats and move OTA signing operators to hardware-backed, dual-control access.', csf: ['DE.CM', 'PR.AA', 'RS.MA'], modules: [{ label: 'HexaSOC', path: '/soc/mdr' }, { label: 'SBOM', path: '/fabric/sbom' }], weight: 1.3, ri: 1.2, owner: 'soc', dur: [8, 12], start: [2, 7] }));
  add(/tisax/i, (fw) => ({ key: 'fw-tisax', ws: 'governance', title: `${fw.short}: prototype protection re-assessment`, desc: 'Close findings on prototype handling, physical zones and supplier access ahead of the AL3 re-assessment.', csf: ['GV.SC', 'PR.DS'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.5, ri: 0.5, owner: 'grc', dur: [5, 8], start: [6, 12] }));
  add(/hitrust/i, (fw) => ({ key: 'fw-hitrust', ws: 'governance', title: `${fw.short}: corrective action plans closed before validated assessment`, desc: 'Close open CAPs, raise maturity scores on policy and procedure and collect evidence for the r2 validated assessment.', csf: ['GV.PO', 'ID.IM'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.6, ri: 0.7, owner: 'grc', dur: [6, 9], start: [1, 5] }));
  add(/524b|medical device/i, (fw) => ({ key: 'fw-524b', ws: 'thirdparty', title: `${fw.short}: security requirements in device procurement`, desc: 'Require SBOMs, patch commitments and MDS2 forms from device manufacturers before purchase; track legacy devices out of support.', csf: ['GV.SC', 'ID.AM'], modules: [{ label: 'SBOM', path: '/fabric/sbom' }, { label: 'Third-party risk', path: '/comply/tprm' }], weight: 0.5, ri: 0.6, owner: 'grc', replaces: 'tp-sbom', dur: [5, 8], start: [3, 9] }));
  add(/iacs|e26/i, (fw) => ({ key: 'fw-iacs', ws: 'governance', title: `${fw.short} conformity for newbuilds and class renewals`, desc: 'Agree the E26 vessel asset inventory, E27 supplier evidence and survey-ready documentation with the classification society.', csf: ['ID.AM', 'GV.SC'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }, { label: 'HexaOT sites', path: '/ot/sites' }], weight: 0.6, ri: 0.6, owner: 'ot', dur: [6, 10], start: [4, 9] }));
  add(/swift/i, (fw) => ({ key: 'fw-swift', ws: 'governance', title: `${fw.short}: secure zone uplift and independent assessment`, desc: 'Tighten the SWIFT secure zone, operator MFA and transaction monitoring ahead of the annual attestation.', csf: ['PR.IR', 'PR.AA'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.5, ri: 0.5, owner: 'grc', dur: [4, 6], start: [8, 12] }));
  add(/nydfs|23 nycrr/i, (fw) => ({ key: 'fw-nydfs', ws: 'governance', title: `${fw.short} amendments: asset inventory and CEO / CISO certification`, desc: 'Meet the amended Part 500 asset inventory, privileged access and annual certification requirements.', csf: ['ID.AM', 'GV.OV'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.4, ri: 0.4, owner: 'grc', dur: [4, 7], start: [10, 15] }));
  add(/nis2/i, (fw) => ({ key: 'fw-nis2', ws: 'governance', title: `${fw.short}: 24-hour early warning and management-body training`, desc: 'Run the 24 h / 72 h / 1 month reporting clocks end to end and train management-body members as the directive requires.', csf: ['RS.CO', 'GV.RR', 'GV.OV'], modules: [{ label: 'Regulatory horizon', path: '/comply/horizon' }, { label: 'Crisis exercises', path: '/ops/exercises' }], weight: 0.4, ri: 0.5, owner: 'ciso', dur: [4, 7], start: [5, 10] }));
  add(/27001/i, (fw) => ({ key: 'fw-iso', ws: 'governance', title: `${fw.short}: surveillance audit readiness`, desc: 'Close nonconformities, refresh the Statement of Applicability and keep Annex A evidence fresh through continuous collection.', csf: ['GV.PO', 'ID.IM'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.3, ri: 0.4, owner: 'grc', dur: [3, 6], start: [12, 17] }));
  add(/soc ?2/i, (fw) => ({ key: 'fw-soc2', ws: 'governance', title: `${fw.short}: continuous control monitoring`, desc: 'Automate evidence for the trust services criteria so the Type II window needs no manual sampling.', csf: ['GV.OV', 'ID.IM'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.3, ri: 0.4, owner: 'grc', dur: [4, 7], start: [14, 18] }));
  add(/cpg|performance goals/i, (fw) => ({ key: 'fw-cpg', ws: 'governance', title: `${fw.short}: enhanced goals attained`, desc: 'Move from essential to enhanced performance goals: asset inventory, third-party incident reporting and network segmentation.', csf: ['GV.OV', 'ID.AM'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.3, ri: 0.4, owner: 'grc', dur: [6, 9], start: [12, 16] }));
  add(/essentials/i, (fw) => ({ key: 'fw-ess', ws: 'governance', title: `${fw.short}: certification and next-level mark`, desc: 'Close gaps against the scheme, gather evidence and complete the assessment for the next mark.', csf: ['GV.OV', 'PR.PS'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.3, ri: 0.4, owner: 'grc', dur: [4, 7], start: [3, 9] }));
  add(/gdpr|pdpa|privacy|hipaa/i, (fw) => ({ key: 'fw-priv', ws: 'data', title: `${fw.short}: risk analysis and records of processing refresh`, desc: 'Refresh the enterprise risk analysis and records of processing, and clear the backlog of impact assessments for new systems.', csf: ['GV.RM', 'ID.RA', 'PR.DS'], modules: [{ label: 'HexaComply risks', path: '/comply/caas?section=risks' }], weight: 0.4, ri: 0.4, owner: 'grc', dur: [4, 7], start: [5, 11] }));
  add(/solvency|naic|insurance data/i, (fw) => ({ key: 'fw-ins', ws: 'governance', title: `${fw.short}: ICT and cyber risk reporting to the supervisor`, desc: 'Produce board-approved cyber risk reporting and incident notification evidence in the supervisor’s format.', csf: ['GV.OV', 'RS.CO'], modules: [{ label: 'HexaComply', path: '/comply/caas?section=frameworks' }], weight: 0.4, ri: 0.4, owner: 'grc', dur: [5, 8], start: [6, 11] }));

  /* Sector extras that are not tied to one framework. */
  if (f.fin || f.health || f.insurance) out.push({ key: 'id-helpdesk', ws: 'identity', title: 'Help-desk identity verification hardening', desc: 'Video or in-person verification before MFA or password resets for privileged and finance users, closing the social-engineering pattern used by Scattered Spider.', csf: ['PR.AA', 'PR.AT'], fw: GENERIC_FW, modules: [{ label: 'Identity', path: '/fabric/identity' }, { label: 'Human risk', path: '/comply/human' }], weight: 0.3, ri: 0.8, owner: 'admin', dur: [2, 4], start: [1, 4] });
  if (f.media) out.push({ key: 'data-leak', ws: 'data', title: 'Pre-release leak prevention: forensic watermarking on every screener', desc: 'Session-based forensic watermarks on all review links and screeners, with automated takedown and source tracing.', csf: ['PR.DS', 'DE.CM'], fw: /tpn|mpa|dpp/i, modules: [{ label: 'HexaCustody', path: '/custody/overview' }, { label: 'Brand & dark web', path: '/int/darkweb' }], weight: 0.7, ri: 0.9, owner: 'grc', dur: [5, 8], start: [2, 7] });
  if (f.fin) out.push({ key: 'res-tol', ws: 'resilience', title: 'Important business services within impact tolerance under severe scenarios', desc: 'Scenario-test each important business service against its tolerance and remediate vulnerabilities found.', csf: ['RC.RP', 'GV.OC'], fw: /op res|dora|sysc/i, modules: [{ label: 'Crisis exercises', path: '/ops/exercises' }], weight: 0.6, ri: 0.6, owner: 'ciso', dur: [6, 9], start: [8, 13] });
  if (f.defence) out.push({ key: 'det-insider', ws: 'detection', title: 'Insider threat programme for cleared and programme staff', desc: 'Behavioural analytics on access to controlled programmes with HR and security referral workflow.', csf: ['DE.AE', 'DE.CM'], fw: /cmmc|nispom|800-171/i, modules: [{ label: 'HexaSOC identity', path: '/soc/identity' }], weight: 0.7, ri: 0.7, owner: 'soc', dur: [6, 9], start: [6, 12] });
  if (f.pharma) out.push({ key: 'data-ip', ws: 'data', title: 'Research IP protection for trial and formulation data', desc: 'Monitor and restrict bulk access to clinical-trial and formulation repositories, with partner data-room controls.', csf: ['PR.DS', 'DE.CM'], fw: /27001|gxp|part 11|gdpr/i, modules: [{ label: 'HexaInt dark web', path: '/int/darkweb' }], weight: 0.7, ri: 0.7, owner: 'grc', dur: [6, 9], start: [5, 10] });

  /* Replace generic with framework-specific where both apply; dedupe by key. */
  const replaced = new Set(out.map((t) => t.replaces).filter(Boolean) as string[]);
  const seen = new Set<string>();
  let kept = out.filter((t) => !replaced.has(t.key) && !seen.has(t.key) && (seen.add(t.key), true));
  // Keep the register to a credible size: shed the least distinctive items first.
  const shed = ['fw-soc2', 'fw-iso', 'data-keys', 'gov-human', 'fw-nydfs', 'id-jml', 'fw-cpg', 'tp-sbom', 'fw-swift', 'res-bia'];
  for (const k of shed) {
    if (kept.length <= 26) break;
    kept = kept.filter((t) => t.key !== k);
  }
  return kept.slice(0, 26);
}

/* =====================================================================
   Initiatives
   ===================================================================== */
export interface PgMilestone { id: string; title: string; m: number; done: boolean; gate: boolean }
export interface PgRisk { id: string; title: string; level: 'High' | 'Medium' | 'Low'; mitigation: string; raised?: boolean; by?: string }
export interface PgDecision { when: number; text: string; by: string }
export interface PgEvidence { title: string; source: string; ageDays: number }
export interface PgChange { id: string; kind: 'Scope' | 'Budget' | 'Schedule'; text: string; delta: string; status: 'Pending' | 'Approved'; by: string; at: number }
export interface Initiative {
  id: string;
  key: string;
  ws: WsId;
  title: string;
  desc: string;
  owner: Person;
  sponsor: Person;
  start: number;
  end: number;
  status: PgStatus;
  pct: number;
  budget: number;
  spent: number;
  forecast: number;
  capexShare: number;
  riGain: number;
  lossReduction: number;
  frameworks: FrameworkScope[];
  csf: string[];
  modules: { label: string; path: string }[];
  deps: string[];
  milestones: PgMilestone[];
  risks: PgRisk[];
  issues: string[];
  decisions: PgDecision[];
  evidence: PgEvidence[];
  changes: PgChange[];
  tenantId: string;
  note?: string;
}

function ownerFor(c: CustomerProfile, k: OwnerKey, r: ReturnType<typeof rng>): Person {
  const p = c.people;
  if (k === 'ciso') return p.ciso;
  if (k === 'soc') return p.socLead;
  if (k === 'grc') return p.grcLead;
  if (k === 'ot') return p.otLead ?? p.admin;
  if (k === 'admin') return r.chance(0.7) ? p.admin : p.socLead;
  return p.staff.length ? r.pick(p.staff) : p.admin;
}

const PHASES = ['Scope and design signed off', 'Pilot complete', 'Rollout wave 1', 'Rollout complete', 'Evidence accepted and closed'];

function riskTexts(c: CustomerProfile, t: Initiative): PgRisk[] {
  const r = rng(`programme-risk-${c.id}-${t.key}`);
  const tp = c.thirdParties.length ? r.pick(c.thirdParties).name : 'the integrator';
  const svc = r.pick(c.vocab.businessServices.length ? c.vocab.businessServices : ['peak trading']);
  const legacy = r.pick([...(t.ws === 'ot' ? c.vocab.otSystems : []), ...c.vocab.crownJewels, ...c.vocab.servers.slice(0, 4)].filter(Boolean).concat('legacy platforms'));
  const svc2 = r.pick(c.vocab.businessServices.length ? c.vocab.businessServices : ['operations']);
  const pool: PgRisk[] = [
    { id: '', title: `Supplier delivery: ${tp} capacity or lead time slips the rollout`, level: 'Medium', mitigation: 'Weekly supplier checkpoint; second-source quote held' },
    { id: '', title: `Change freeze around ${svc} limits deployment windows`, level: 'Medium', mitigation: 'Pre-agreed maintenance windows with service owners' },
    { id: '', title: `Key-person dependency on ${t.owner.name}`, level: 'Low', mitigation: 'Deputy named; runbooks in HexaComply' },
    { id: '', title: `Pushback from ${svc2} teams on user friction delays enforcement`, level: 'Medium', mitigation: 'Phased enforcement with executive sponsor communications' },
    { id: '', title: `${legacy} cannot meet the control; compensating controls needed`, level: 'High', mitigation: 'Risk acceptance with compensating monitoring, reviewed quarterly' },
    { id: '', title: 'Licence and contract approval slower than planned', level: 'Low', mitigation: 'Procurement fast-track agreed with finance' },
  ];
  const n = t.status === 'Late' ? 3 : t.status === 'At risk' ? 2 : t.status === 'Complete' ? 0 : r.int(0, 1) + (t.status === 'Not started' ? 0 : 1);
  return r.pickN(pool, n).map((x, i) => ({ ...x, id: `${t.id}-R${i + 1}`, level: t.status === 'Late' && i === 0 ? 'High' : x.level }));
}

/** Seeded, store-free initiatives for a customer (group-wide). */
function baseInitiatives(c: CustomerProfile): Initiative[] {
  const r = rng(`programme-${c.id}`);
  const tpls = templates(c);
  const otTenants = c.tenants.filter((t) => t.env.includes('ot'));
  const total = Math.max(2.5e6, Math.min(80e6, c.revenueM * 1e6 * r.float(0.0028, 0.0042, 4)));
  const wSum = tpls.reduce((s, t) => s + t.weight, 0);

  // Schedule: respect dependencies by placing dependants after their prerequisites.
  const sched = new Map<string, { start: number; end: number }>();
  const place = (t: Tpl): { start: number; end: number } => {
    const got = sched.get(t.key);
    if (got) return got;
    const [s0, s1] = t.start ?? [0, 14];
    const [d0, d1] = t.dur ?? [5, 10];
    let start = r.int(s0, s1);
    for (const d of t.deps ?? []) {
      const dt = tpls.find((x) => x.key === d);
      if (dt) start = Math.max(start, place(dt).start + 2);
    }
    start = Math.min(start, PG_MONTHS - 4);
    const end = Math.min(PG_MONTHS, start + r.int(d0, d1));
    const v = { start, end };
    sched.set(t.key, v);
    return v;
  };
  tpls.forEach(place);

  const ordered = [...tpls].sort((a, b) => WORKSTREAMS.findIndex((w) => w.id === a.ws) - WORKSTREAMS.findIndex((w) => w.id === b.ws) || sched.get(a.key)!.start - sched.get(b.key)!.start);
  const idOf = new Map(ordered.map((t, i) => [t.key, `PRG-${String(i + 1).padStart(2, '0')}`]));

  const list = ordered.map((t): Initiative => {
    const { start, end } = sched.get(t.key)!;
    const id = idOf.get(t.key)!;
    const span = end - start;
    const expected = Math.max(0, Math.min(1, (TODAY_M - start) / span));
    let status: PgStatus;
    if (start > TODAY_M) status = 'Not started';
    else if (end <= TODAY_M) status = r.chance(0.74) ? 'Complete' : 'Late';
    else status = r.weighted<PgStatus>([['On track', 60], ['At risk', 23], ['Late', 12], ['On hold', 5]]);
    const pct = status === 'Complete' ? 100 : status === 'Not started' ? 0
      : Math.round(Math.max(4, Math.min(96, expected * 100 * (status === 'On track' ? r.float(0.92, 1.12, 2) : status === 'At risk' ? r.float(0.68, 0.86, 2) : status === 'On hold' ? r.float(0.4, 0.6, 2) : r.float(0.55, 0.8, 2)))));
    const budget = Math.round((total * (t.weight / wSum) * r.float(0.85, 1.15, 2)) / 5000) * 5000;
    const plannedToDate = budget * expected;
    const burn = status === 'Complete' ? r.float(0.92, 1.12, 2) : status === 'On track' ? r.float(0.86, 1.04, 2) : status === 'Not started' ? 0 : r.float(1.02, 1.28, 2);
    const spent = status === 'Complete' ? Math.round(budget * burn) : Math.round(plannedToDate * burn);
    const forecast = status === 'Complete' ? spent : Math.round(spent + (budget - plannedToDate) * (status === 'On track' ? r.float(0.92, 1.05, 2) : status === 'Not started' ? r.float(0.95, 1.08, 2) : r.float(1.04, 1.22, 2)));
    const capexShare = Math.min(0.85, Math.max(0.15, (t.ws === 'ot' || t.ws === 'detection' || t.ws === 'identity' ? 0.55 : t.ws === 'governance' ? 0.2 : 0.4) + r.float(-0.12, 0.12, 2)));

    const phases = t.milestones ?? PHASES.slice(0, r.int(3, 5));
    const ms: PgMilestone[] = phases.map((title, i) => {
      const m = Math.round((start + (span * (i + 1)) / phases.length) * 4) / 4;
      return { id: `${id}-M${i + 1}`, title, m, done: status === 'Complete' || m <= TODAY_M, gate: i === phases.length - 1 };
    });
    if (status === 'Late' || status === 'At risk') {
      // The most recent past milestone slipped (still open, now overdue).
      const past = ms.filter((x) => x.m <= TODAY_M);
      const slip = past[past.length - 1];
      if (slip && status === 'Late') slip.done = false;
    }
    if (status === 'Late' && end <= TODAY_M) ms[ms.length - 1].done = false;

    const tenantId = t.tenantEnv === 'ot' && otTenants.length > 1 && r.chance(0.35) ? r.pick(otTenants).id : 'all';
    const frameworks = c.frameworks.filter((fw) => t.fw.test(`${fw.id} ${fw.short} ${fw.name}`)).slice(0, 3);
    const tool = c.connectors.length ? r.pick(c.connectors) : null;
    const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';

    const ini: Initiative = {
      id, key: t.key, ws: t.ws, title: t.title, desc: t.desc,
      owner: ownerFor(c, t.owner, r), sponsor: t.weight >= 1.2 ? c.people.board : c.people.ciso,
      start, end, status, pct, budget, spent, forecast, capexShare,
      riGain: t.ri * r.float(0.8, 1.2, 2), lossReduction: 0,
      frameworks: frameworks.length ? frameworks : c.frameworks.slice(0, 1),
      csf: t.csf, modules: t.modules,
      deps: (t.deps ?? []).map((d) => idOf.get(d)).filter((x): x is string => !!x),
      milestones: ms, risks: [], issues: [], decisions: [], evidence: [], changes: [], tenantId,
    };
    ini.risks = riskTexts(c, ini);
    if (status === 'Late' || status === 'At risk') ini.issues.push(status === 'Late' ? `${ms.find((x) => !x.done && x.m <= TODAY_M)?.title ?? 'Final milestone'} missed; recovery plan due to steering` : `Burn ${Math.round((spent / Math.max(1, plannedToDate)) * 100)}% of plan to date; scope review requested`);
    if (status === 'On hold') ini.issues.push('Paused pending budget re-approval at the next steering committee');
    if (pct > 0) ini.decisions.push({ when: Math.max(start, TODAY_M - r.int(2, 6)) , text: `Approach approved at security steering committee (${t.ws === 'ot' ? 'OT change board' : 'CAB'} sign-off)`, by: ini.sponsor.name });
    if (pct > 40) ini.decisions.push({ when: Math.max(start + 1, TODAY_M - r.float(0.3, 1.5)), text: r.pick(['Phase 2 scope confirmed; exceptions go to risk acceptance', 'Vendor selected after proof of concept', 'Enforcement date agreed with business owners']), by: ini.owner.name });
    if (pct > 0) ini.evidence.push({ title: `${phases[0]}: signed record`, source: grc, ageDays: Math.max(1, Math.round((TODAY_M - ms[0].m) * 30)) });
    if (pct > 30 && tool) ini.evidence.push({ title: `${tool.product} configuration export`, source: `${tool.vendor} ${tool.product}`, ageDays: r.int(1, 20) });
    if (pct >= 100) ini.evidence.push({ title: 'Closure report and benefits statement', source: grc, ageDays: r.int(3, 60) });
    return ini;
  });

  // Gains still to come sum to the planned uplift; completed initiatives are already in today's RI.
  const ri = resilienceIndex(c).value;
  const uplift = Math.min(94, ri + r.int(9, 13)) - ri;
  const open = list.filter((i) => i.status !== 'Complete');
  const g = open.reduce((s, i) => s + i.riGain, 0) || 1;
  open.forEach((i) => { i.riGain = Math.round(((i.riGain / g) * uplift) * 10) / 10; });
  list.filter((i) => i.status === 'Complete').forEach((i) => { i.riGain = Math.round(i.riGain * 0.6 * 10) / 10; });
  const loss = headlines(c).insurance.expectedLossM * 1e6 * r.float(0.32, 0.45, 2);
  const lg = list.reduce((s, i) => s + i.riGain, 0) || 1;
  list.forEach((i) => { i.lossReduction = Math.round(((i.riGain / lg) * loss * r.float(0.8, 1.2, 2)) / 1000) * 1000; });
  return list;
}

/* =====================================================================
   In-session store (shared by every tab, survives navigation, not reloads)
   ===================================================================== */
interface Patch { status?: PgStatus; pct?: number; note?: string }
interface Store {
  patch: Record<string, Patch>; // cid:id
  ms: Record<string, boolean>; // cid:milestoneId
  risks: Record<string, PgRisk[]>; // cid:id
  changes: Record<string, PgChange[]>; // cid:id
  log: { cid: string; at: number; id: string; text: string; color: string }[];
}
let STORE: Store = { patch: {}, ms: {}, risks: {}, changes: {}, log: [] };
let VERSION = 0;
const LISTENERS = new Set<() => void>();
function commit(fn: (s: Store) => Store) {
  STORE = fn(STORE);
  VERSION++;
  LISTENERS.forEach((l) => l());
}
export function pgSubscribe(l: () => void): () => void {
  LISTENERS.add(l);
  return () => { LISTENERS.delete(l); };
}
export function pgVersion(): number {
  return VERSION;
}

export function pgUpdateStatus(c: CustomerProfile, id: string, status: PgStatus, pct: number, note: string, by: string) {
  commit((s) => ({
    ...s,
    patch: { ...s.patch, [`${c.id}:${id}`]: { status, pct, note } },
    log: [{ cid: c.id, at: Date.now(), id, text: `${by} set ${id} to ${status} · ${pct}%${note ? ` · “${note}”` : ''}`, color: STATUS_HEX[status] }, ...s.log],
  }));
}
export function pgToggleMilestone(c: CustomerProfile, ini: Initiative, msId: string, done: boolean, by: string) {
  const m = ini.milestones.find((x) => x.id === msId);
  commit((s) => ({
    ...s,
    ms: { ...s.ms, [`${c.id}:${msId}`]: done },
    log: [{ cid: c.id, at: Date.now(), id: ini.id, text: `${by} marked “${m?.title ?? msId}” ${done ? 'complete' : 'reopened'}`, color: done ? '#2dd4bf' : '#f0a338' }, ...s.log],
  }));
}
export function pgRaiseRisk(c: CustomerProfile, ini: Initiative, title: string, level: PgRisk['level'], mitigation: string, by: string) {
  const k = `${c.id}:${ini.id}`;
  commit((s) => {
    const cur = s.risks[k] ?? [];
    const risk: PgRisk = { id: `${ini.id}-R${ini.risks.length + 1}`, title, level, mitigation, raised: true, by };
    return { ...s, risks: { ...s.risks, [k]: [...cur, risk] }, log: [{ cid: c.id, at: Date.now(), id: ini.id, text: `${by} raised a ${level.toLowerCase()} risk on ${ini.id}: ${title}`, color: level === 'High' ? '#f8646f' : '#f0a338' }, ...s.log] };
  });
}
export function pgRequestChange(c: CustomerProfile, ini: Initiative, kind: PgChange['kind'], text: string, delta: string, by: string) {
  const k = `${c.id}:${ini.id}`;
  commit((s) => {
    const cur = s.changes[k] ?? [];
    const ch: PgChange = { id: `CR-${ini.id.slice(4)}${String.fromCharCode(65 + cur.length)}`, kind, text, delta, status: 'Pending', by, at: Date.now() };
    return { ...s, changes: { ...s.changes, [k]: [...cur, ch] }, log: [{ cid: c.id, at: Date.now(), id: ini.id, text: `${by} requested a ${kind.toLowerCase()} change on ${ini.id} (${delta})`, color: '#a07cfb' }, ...s.log] };
  });
}
export function pgLog(c: CustomerProfile) {
  return STORE.log.filter((l) => l.cid === c.id);
}

const BASE_CACHE = new WeakMap<CustomerProfile, Initiative[]>();
/** Initiatives with in-session changes applied, scoped to the tenant filter. */
export function initiatives(c: CustomerProfile, tenantId = 'all'): Initiative[] {
  let base = BASE_CACHE.get(c);
  if (!base) {
    base = baseInitiatives(c);
    BASE_CACHE.set(c, base);
  }
  return base
    .filter((i) => tenantId === 'all' || i.tenantId === 'all' || i.tenantId === tenantId)
    .map((i) => {
      const p = STORE.patch[`${c.id}:${i.id}`];
      const milestones = i.milestones.map((m) => {
        const v = STORE.ms[`${c.id}:${m.id}`];
        return v === undefined ? m : { ...m, done: v };
      });
      const risks = [...i.risks, ...(STORE.risks[`${c.id}:${i.id}`] ?? [])];
      const changes = STORE.changes[`${c.id}:${i.id}`] ?? [];
      if (!p) return { ...i, milestones, risks, changes };
      const pct = p.pct ?? i.pct;
      // Re-estimate spend when progress is changed so the budget tab stays coherent.
      const spent = p.status === 'Complete' ? Math.max(i.spent, Math.round(i.forecast)) : i.spent;
      return { ...i, status: p.status ?? i.status, pct, spent, note: p.note, milestones, risks, changes };
    });
}

/* =====================================================================
   Derived views
   ===================================================================== */
export function overdueMilestones(list: Initiative[]) {
  return list.flatMap((i) => i.milestones.filter((m) => !m.done && m.m < TODAY_M).map((m) => ({ i, m })));
}
export function upcomingMilestones(list: Initiative[], months = 1) {
  return list.flatMap((i) => i.milestones.filter((m) => !m.done && m.m >= TODAY_M && m.m <= TODAY_M + months).map((m) => ({ i, m }))).sort((a, b) => a.m.m - b.m.m);
}

/** Planned spend profile for an initiative, spread evenly over its months. */
function plannedIn(i: Initiative, m0: number, m1: number): number {
  const a = Math.max(i.start, m0);
  const b = Math.min(i.end, m1);
  return b > a ? (i.budget * (b - a)) / (i.end - i.start) : 0;
}
/** Actual spend lands in months already elapsed; forecast spend covers what remains. */
function actualIn(i: Initiative, m0: number, m1: number): number {
  const elapsedEnd = Math.min(i.end, TODAY_M);
  if (i.spent <= 0 || elapsedEnd <= i.start) return 0;
  const a = Math.max(i.start, m0);
  const b = Math.min(elapsedEnd, m1);
  return b > a ? (i.spent * (b - a)) / (elapsedEnd - i.start) : 0;
}
function forecastIn(i: Initiative, m0: number, m1: number): number {
  const rem = Math.max(0, i.forecast - i.spent);
  if (rem <= 0) return 0;
  const from = Math.max(TODAY_M, i.start);
  const to = Math.max(from + 1, i.status === 'Late' && i.end <= TODAY_M ? TODAY_M + 3 : i.end);
  const a = Math.max(from, m0);
  const b = Math.min(to, m1);
  return b > a ? (rem * (b - a)) / (to - from) : 0;
}
export function budgetByQuarter(list: Initiative[]) {
  return QUARTERS.map((q) => {
    const m0 = q * 3;
    const m1 = m0 + 3;
    return {
      q, label: quarterLabel(q),
      planned: list.reduce((s, i) => s + plannedIn(i, m0, m1), 0),
      actual: list.reduce((s, i) => s + actualIn(i, m0, m1), 0),
      forecast: list.reduce((s, i) => s + forecastIn(i, m0, m1), 0),
    };
  });
}
export function burnByMonth(list: Initiative[]) {
  return Array.from({ length: PG_MONTHS }, (_, m) => ({
    m,
    planned: list.reduce((s, i) => s + plannedIn(i, m, m + 1), 0),
    actual: list.reduce((s, i) => s + actualIn(i, m, m + 1), 0),
    forecast: list.reduce((s, i) => s + forecastIn(i, m, m + 1), 0),
  }));
}

export function totals(list: Initiative[]) {
  const budget = list.reduce((s, i) => s + i.budget, 0);
  const spent = list.reduce((s, i) => s + i.spent, 0);
  const forecast = list.reduce((s, i) => s + i.forecast, 0);
  const plannedToDate = list.reduce((s, i) => s + plannedIn(i, 0, TODAY_M), 0);
  const capex = list.reduce((s, i) => s + i.forecast * i.capexShare, 0);
  return { budget, spent, forecast, plannedToDate, capex, opex: forecast - capex };
}

/** Resilience Index trajectory: history to today, then the plan with a widening confidence band. */
export function riProjection(c: CustomerProfile, tenantId: string, list: Initiative[]) {
  const today = resilienceIndex(c, tenantId).value;
  const hist = riTrend(c, tenantId);
  const tm = Math.floor(TODAY_M);
  const points: { m: number; hist?: number; plan?: number; lo?: number; hi?: number }[] = [];
  for (let m = 0; m <= PG_MONTHS; m++) {
    if (m <= tm) {
      const idx = hist.length - 1 - (tm - m);
      points.push({ m, hist: hist[Math.max(0, idx)] });
    }
  }
  points[points.length - 1].hist = today;
  // Gains land as rollouts finish (S-curve per initiative).
  const raw = (m: number) => list.filter((i) => i.status !== 'Complete').reduce((s, i) => {
    const from = Math.max(TODAY_M, i.start);
    const to = Math.max(from + 0.5, i.status === 'Late' && i.end <= TODAY_M ? TODAY_M + 3 : i.end);
    const frac = m <= from ? 0 : m >= to ? 1 : (m - from) / (to - from);
    return s + i.riGain * frac * frac * (3 - 2 * frac);
  }, 0);

  const risky = list.filter((i) => i.status === 'At risk' || i.status === 'Late' || i.status === 'On hold');
  const riskShare = list.length ? risky.length / list.length : 0;
  for (let m = tm; m <= PG_MONTHS; m++) {
    const g = raw(Math.max(m, TODAY_M));
    const plan = Math.min(100, today + g);
    const spread = ((m - TODAY_M) / (PG_MONTHS - TODAY_M)) * (1.2 + riskShare * 4);
    const row = points.find((p) => p.m === m) ?? (points.push({ m }), points[points.length - 1]);
    row.plan = Math.round(plan * 10) / 10;
    row.lo = Math.round(Math.max(0, plan - spread * 1.4) * 10) / 10;
    row.hi = Math.round(Math.min(100, plan + spread * 0.6) * 10) / 10;
  }
  const end = points[points.length - 1];
  return { today, target: Math.round(end.plan ?? today), lo: Math.round(end.lo ?? today), hi: Math.round(end.hi ?? today), points };
}

/* =====================================================================
   Maturity (NIST CSF 2.0 tiers 1-4)
   ===================================================================== */
export interface CatMaturity { id: string; fn: CsfFn; label: string; current: number; target: number; projected: number; initiatives: string[] }
export function maturity(c: CustomerProfile, list: Initiative[]): { cats: CatMaturity[]; fns: { id: CsfFn; label: string; hex: string; current: number; target: number; projected: number }[] } {
  const r = rng(`programme-maturity-${c.id}`);
  const base = 1.5 + ((c.scores.comply + c.scores.soc) / 200) * 1.5;
  const fnBias: Record<CsfFn, number> = { GV: r.float(-0.2, 0.3, 2), ID: r.float(-0.3, 0.2, 2), PR: r.float(0, 0.4, 2), DE: (c.scores.soc - 75) / 40, RS: r.float(-0.2, 0.3, 2), RC: r.float(-0.5, 0.1, 2) };
  const cats = CSF_CATS.map((k) => {
    const touching = list.filter((i) => i.csf.includes(k.id));
    const current = Math.round(Math.max(1.1, Math.min(3.6, base + fnBias[k.fn] + r.float(-0.45, 0.45, 2))) * 10) / 10;
    const lift = r.chance(0.22) ? r.float(0, 0.2, 2) : r.float(0.5, 1.1, 2);
    const target = touching.length ? Math.min(4, Math.max(current, 2.5, Math.round((current + lift) * 2) / 2)) : Math.max(current, Math.round(Math.max(2.5, current + r.float(-0.2, 0.6, 2)) * 2) / 2);
    // Each touching initiative closes a share of the gap in proportion to its progress-to-be.
    const cover = touching.length ? Math.min(1, 0.55 + touching.length * 0.18) : 0.05;
    const doneShare = touching.length ? touching.reduce((s, i) => s + i.pct / 100, 0) / touching.length : 0;
    const gap = Math.max(0, target - current);
    const projected = Math.round((current + gap * cover) * 10) / 10;
    // Today's figure already includes progress on initiatives in flight.
    const cur = Math.round(Math.min(projected, current + gap * cover * doneShare * 0.5) * 10) / 10;
    return { id: k.id, fn: k.fn, label: k.label, current: cur, target, projected, initiatives: touching.map((i) => i.id) };
  });
  const fns = CSF_FUNCTIONS.map((f) => {
    const cs = cats.filter((x) => x.fn === f.id);
    const avg = (k: 'current' | 'target' | 'projected') => Math.round((cs.reduce((s, x) => s + x[k], 0) / cs.length) * 10) / 10;
    return { ...f, current: avg('current'), target: avg('target'), projected: avg('projected') };
  });
  return { cats, fns };
}

/* Main framework maturity: domain breakdown where the scheme is well known. */
export interface FwDomain { id: string; label: string; current: number; target: number; projected: number }
export interface FwMaturity { fw: FrameworkScope; scheme: string; unit: '%' | 'level'; levelNow?: string; levelTarget?: string; domains: FwDomain[]; initiatives: string[] }
const CMMC_DOMAINS = ['AC Access control', 'AT Awareness', 'AU Audit', 'CM Configuration', 'IA Identification', 'IR Incident response', 'MA Maintenance', 'MP Media protection', 'PS Personnel', 'PE Physical', 'RA Risk assessment', 'CA Security assessment', 'SC System & comms', 'SI System integrity'];
const ISO_DOMAINS = ['Clauses 4-10 (ISMS)', 'A.5 Organisational', 'A.6 People', 'A.7 Physical', 'A.8 Technological'];
const IEC_DOMAINS = ['FR1 Identification & authentication', 'FR2 Use control', 'FR3 System integrity', 'FR4 Data confidentiality', 'FR5 Restricted data flow', 'FR6 Timely response', 'FR7 Resource availability'];
const HIPAA_DOMAINS = ['Administrative safeguards', 'Physical safeguards', 'Technical safeguards', 'Organisational requirements', 'Policies & documentation'];
const DORA_DOMAINS = ['ICT risk management', 'Incident reporting', 'Resilience testing', 'Third-party risk', 'Information sharing'];
const TISAX_DOMAINS = ['Information security', 'Prototype protection', 'Data protection'];
export function frameworkMaturity(c: CustomerProfile, list: Initiative[]): FwMaturity | null {
  const pick = fwMatch(c, /cmmc/i) ?? fwMatch(c, /essentials/i) ?? fwMatch(c, /27001/i) ?? fwMatch(c, /hipaa|hitrust/i) ?? fwMatch(c, /dora/i) ?? fwMatch(c, /tisax/i) ?? fwMatch(c, /62443/i) ?? c.frameworks[0];
  if (!pick) return null;
  const r = rng(`programme-fw-${c.id}-${pick.id}`);
  const txt = `${pick.short} ${pick.name}`;
  const linked = list.filter((i) => i.frameworks.some((f) => f.id === pick.id));
  const progress = linked.length ? linked.reduce((s, i) => s + i.pct, 0) / linked.length / 100 : 0;
  const names = /cmmc/i.test(txt) ? CMMC_DOMAINS : /27001/i.test(txt) ? ISO_DOMAINS : /62443/i.test(txt) ? IEC_DOMAINS : /hipaa|hitrust/i.test(txt) ? HIPAA_DOMAINS : /dora/i.test(txt) ? DORA_DOMAINS : /tisax/i.test(txt) ? TISAX_DOMAINS : CSF_FUNCTIONS.map((f) => f.label);
  const domains = names.map((n, i) => {
    const current = Math.round(Math.max(35, Math.min(97, pick.documented + r.int(-16, 10))));
    const target = 100;
    const projected = Math.round(Math.min(target, current + (target - current) * (0.55 + r.float(0, 0.4, 2))));
    return { id: `d${i}`, label: n, current, target, projected };
  });
  const cmmc = /cmmc/i.test(txt);
  const ess = /essentials/i.test(txt);
  return {
    fw: pick,
    scheme: cmmc ? 'CMMC 2.0 Level 2 practice families (NIST SP 800-171)' : ess ? `${pick.short} assessment domains` : `${pick.short} domains · requirements implemented with fresh evidence`,
    unit: '%',
    levelNow: cmmc ? `SPRS ${Math.round(110 - (100 - pick.documented) * 2.4)} / 110` : ess ? 'Current mark' : undefined,
    levelTarget: cmmc ? 'Level 2 (C3PAO)' : ess ? 'Next mark' : undefined,
    domains: domains.map((d) => ({ ...d, current: Math.round(Math.min(d.projected, d.current + (d.projected - d.current) * progress * 0.3)) })),
    initiatives: linked.map((i) => i.id),
  };
}

/* =====================================================================
   Workstream roll-up and plan risks
   ===================================================================== */
export function workstreamHealth(list: Initiative[]) {
  return WORKSTREAMS.map((w) => {
    const xs = list.filter((i) => i.ws === w.id);
    const budget = xs.reduce((s, i) => s + i.budget, 0);
    const spent = xs.reduce((s, i) => s + i.spent, 0);
    const forecast = xs.reduce((s, i) => s + i.forecast, 0);
    const counts = Object.fromEntries(PG_STATUSES.map((s) => [s, xs.filter((i) => i.status === s).length])) as Record<PgStatus, number>;
    const pct = xs.length ? Math.round(xs.reduce((s, i) => s + i.pct, 0) / xs.length) : 0;
    const riGain = Math.round(xs.filter((i) => i.status !== 'Complete').reduce((s, i) => s + i.riGain, 0) * 10) / 10;
    const rag: Rag = !xs.length ? 'grey' : counts.Late > 0 || forecast > budget * 1.12 ? 'red' : counts['At risk'] + counts['On hold'] > 0 || forecast > budget * 1.04 ? 'amber' : 'green';
    return { w, xs, budget, spent, forecast, counts, pct, riGain, rag };
  });
}

export interface PlanRisk { id: string; title: string; level: PgRisk['level']; ini: Initiative; mitigation: string; raised?: boolean }
export function planRisks(list: Initiative[]): PlanRisk[] {
  const order = { High: 0, Medium: 1, Low: 2 };
  return list
    .filter((i) => i.status !== 'Complete')
    .flatMap((i) => i.risks.map((r) => ({ id: r.id, title: r.title, level: r.level, ini: i, mitigation: r.mitigation, raised: r.raised })))
    .sort((a, b) => order[a.level] - order[b.level] || (b.raised ? 1 : 0) - (a.raised ? 1 : 0) || b.ini.riGain - a.ini.riGain);
}
