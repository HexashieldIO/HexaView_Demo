// HexaInt · Critical Vulnerability Response.
// A critical advisory drops; customers ask "do you use it, and is it patched?".
// Advisories are matched against HexaCore unified assets and scanners, the
// Security Tooling inventory, HexaOT assets and the Third-Party Risk register.
// Vulnerable products are fictional. Advisory-level descriptions only.
//
// Seeded per customer with rng; tenant scoping filters assets and suppliers.
// A tiny module-level store holds in-session edits (status changes, tickets,
// scans, outreach replies) so every section, the Command Centre attention
// item and the notification all agree while the demo runs.
import type { CustomerId, CustomerProfile, Env, Severity, Tenant } from '../types';
import { rng, type Rng } from '../../lib/rng';
import { tpSuppliers } from './tprm';

/* =====================================================================
   Types
   ===================================================================== */
export type VrVerdict = 'Affected' | 'Not affected' | 'Investigating';
export type VrPhase = 'Active response' | 'Monitoring' | 'Closed';
export type VrSource = 'core' | 'tooling' | 'ot' | 'tprm';
export type VrAssetSource = Exclude<VrSource, 'tprm'>;
export type VrStatus = 'Unpatched' | 'Mitigated' | 'Patched' | 'Not applicable';
export type VrReply = 'Not affected' | 'Affected – patched' | 'Affected – patching' | 'No response';
export type VrValidation = 'Passed' | 'Failed' | 'Scheduled' | 'Not run';

export const VR_STATUSES: VrStatus[] = ['Unpatched', 'Mitigated', 'Patched', 'Not applicable'];
export const VR_STATUS_COLOR: Record<VrStatus, string> = { Unpatched: 'var(--sev-critical)', Mitigated: 'var(--sev-medium)', Patched: 'var(--good)', 'Not applicable': 'var(--text-muted)' };
export const VR_STATUS_HEX: Record<VrStatus, string> = { Unpatched: '#e0345e', Mitigated: '#f0a338', Patched: '#2dd4bf', 'Not applicable': '#8593b4' };
export const VR_VERDICT_COLOR: Record<VrVerdict, string> = { Affected: 'var(--sev-critical)', 'Not affected': 'var(--good)', Investigating: 'var(--sev-medium)' };
export const VR_PHASE_COLOR: Record<VrPhase, string> = { 'Active response': 'var(--sev-critical)', Monitoring: 'var(--sev-medium)', Closed: 'var(--text-muted)' };
export const VR_REPLIES: VrReply[] = ['Not affected', 'Affected – patched', 'Affected – patching', 'No response'];
export const VR_REPLY_COLOR: Record<VrReply | 'Not asked' | 'Awaiting reply', string> = {
  'Not affected': 'var(--good)', 'Affected – patched': 'var(--m-matrix)', 'Affected – patching': 'var(--sev-high)', 'No response': 'var(--sev-critical)', 'Not asked': 'var(--text-muted)', 'Awaiting reply': 'var(--sev-medium)',
};
export const VR_VALIDATION_COLOR: Record<VrValidation, string> = { Passed: 'var(--good)', Failed: 'var(--bad)', Scheduled: 'var(--sev-medium)', 'Not run': 'var(--text-muted)' };
export const VR_SOURCE_META: Record<VrSource, { label: string; short: string; hex: string; color: string }> = {
  core: { label: 'HexaCore assets & scanners', short: 'HexaCore', hex: '#3fd0f0', color: 'var(--m-core)' },
  tooling: { label: 'Security Tooling inventory', short: 'Security Tooling', hex: '#38bdf8', color: 'var(--m-tooling)' },
  ot: { label: 'HexaOT assets', short: 'HexaOT', hex: '#f7a04a', color: 'var(--m-ot)' },
  tprm: { label: 'Third-Party Risk suppliers', short: 'Third parties', hex: '#93d65a', color: 'var(--m-comply)' },
};

export interface VrAdvisory {
  id: string;
  cve: string;
  vendor: string;
  product: string;
  family: string;
  weakness: string;
  cvss: number;
  vector: string;
  kev: boolean;
  exploited: boolean;
  publishedMinAgo: number;
  summary: string;
  affectedVersions: string;
  fixedIn: string;
  mitigation: string;
  remediation: string[];
  verdict: VrVerdict;
  phase: VrPhase;
  headline: boolean;
  feed: string;
  /** Candidate hosts still being checked (Investigating). */
  candidates: number;
  /** Minutes after disclosure the first match landed. */
  matchedAfterMin: number;
}

export interface VrAsset {
  id: string;
  advId: string;
  name: string;
  kind: string;
  source: VrAssetSource;
  tool: string;
  env: Env;
  tenantId: string;
  tenantName: string;
  site: string;
  ip: string;
  version: string;
  internet: boolean;
  airGapped: boolean;
  owner: string;
  slaHours: number;
  /** Minutes from now until the SLA is due (negative = overdue). */
  dueInMin: number;
  matchedAfterMin: number;
  status: VrStatus;
  /** Minutes since the status last changed (null = never changed since match). */
  statusMinAgo: number | null;
  ticket: string | null;
  scan: { minAgo: number; tool: string; hash: string; result: string } | null;
  scanRequested: boolean;
  validation: VrValidation;
  validationRequested: boolean;
  detections: number;
  note?: string;
  byUser?: boolean;
}

export interface VrSupplier {
  id: string;
  name: string;
  mono: string;
  tier: 1 | 2 | 3;
  category: string;
  contact: string;
  /** Recorded in the TPRM technology register as running the product. */
  runsProduct: boolean;
  why: string;
  asked: boolean;
  askedMinAgo: number | null;
  reply: VrReply | null;
  repliedMinAgo: number | null;
  chases: number;
  note: string;
}

export interface VrDetection { id: string; title: string; minAgo: number; asset: string; tool: string; sev: Severity; outcome: string }
export interface VrCheck { id: string; asset: string; check: string; result: VrValidation; minAgo: number | null }
export interface VrEvent { minAgo: number; title: string; body?: string; color?: string; by?: string }

/* =====================================================================
   Seeds per sector
   ===================================================================== */
interface Stem { kind: string; code: string; sites: string[]; tenants?: string[]; internet: number; versions: string[] }
interface AdvSeed {
  cve: string; vendor: string; product: string; family: string; weakness: string; cvss: number; kev: boolean; exploited: boolean;
  minAgo: number; summary: string; verdict: VrVerdict; phase: VrPhase;
  counts: Partial<Record<VrAssetSource, number>>; candidates?: number;
  versions?: string; fixedIn?: string; mitigation?: string; remediation?: string[];
  stems?: Partial<Record<VrAssetSource, Stem>>;
  supplierRe?: RegExp; supplierN?: number; outreach?: number;
}

const D = 1440;
const VECTOR = 'Network · no authentication · no user interaction · scope changed';

const HEADLINE: Record<CustomerId, AdvSeed> = {
  maritime: {
    cve: 'CVE-2026-41877', vendor: 'Tessaro Industrial', product: 'Tessaro RemoteLink OT Gateway', family: 'OT remote-access gateway',
    weakness: 'Authentication bypass leading to remote command execution', cvss: 9.9, kev: true, exploited: true, minAgo: 372,
    summary: 'A flaw in the gateway’s web management service lets an unauthenticated attacker who can reach it take full control of the appliance, and through it the OT equipment behind it. The vendor confirms limited exploitation against port and logistics operators. Fixed firmware is available.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 4, tooling: 0, ot: 14 },
    versions: '5.0 to 5.4.2', fixedIn: '5.4.3 (hotfix HF-2026-11)',
    mitigation: 'Block the management interface from untrusted networks, force vendor sessions through the CyberArk broker and disable the gateway’s direct cloud relay until patched.',
    remediation: ['Confirm the firmware version on the appliance (HexaOT passive fingerprint or console).', 'Apply firmware 5.4.3 in the next crane or vessel maintenance window; terminal change board approval required.', 'Until then, restrict the management interface to the Level 3.5 jump host and disable the cloud relay.', 'Rotate the gateway admin and vendor service accounts after the update.', 'Request a HexaStrike validation check and attach the HexaOT re-fingerprint as evidence.'],
    stems: {
      core: { kind: 'Gateway management server', code: 'RLG-MGR', sites: ['Group DC Rotterdam', 'Azure West Europe', 'Terminal server room'], tenants: ['hq', 'rtm', 'ant', 'pkl'], internet: 0.25, versions: ['5.3.1', '5.4.0', '5.4.2'] },
      ot: { kind: 'RemoteLink gateway appliance', code: 'RLG', sites: ['Quay crane LAN', 'Yard automation zone', 'Gate complex', 'Reefer stack', 'Substation'], tenants: ['rtm', 'ant', 'pkl', 'sts', 'fleet'], internet: 0.08, versions: ['5.1.4', '5.2.0', '5.3.1', '5.4.2'] },
    },
    supplierRe: /remote|automation|OEM|crane|Konecranes|Kongsberg|Vanderlande|Marine equipment|Reefer/i, supplierN: 3, outreach: 7,
  },
  finserv: {
    cve: 'CVE-2026-40213', vendor: 'Corvane Networks', product: 'Corvane EdgeGate SSL VPN', family: 'VPN / remote-access gateway',
    weakness: 'Pre-authentication remote code execution', cvss: 9.9, kev: true, exploited: true, minAgo: 356,
    summary: 'A memory-safety flaw in the gateway’s portal service allows an unauthenticated attacker on the internet to run code on the appliance and take over active VPN sessions. FS-ISAC confirms exploitation against European banks. The vendor has released fixed builds and an integrity-check tool.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 6, tooling: 4, ot: 0 },
    versions: '9.1 to 9.6.4', fixedIn: '9.6.5',
    mitigation: 'Restrict the portal to known partner ranges where possible, run the vendor integrity-check tool, and terminate every active session and rotate VPN service credentials after patching.',
    remediation: ['Run the vendor integrity-check tool and preserve its output before changing anything.', 'Upgrade to 9.6.5 under an emergency change (CAB chair approval).', 'Terminate all active VPN sessions and rotate service-account and LDAP bind credentials.', 'Review gateway logs since disclosure with HexaSOC for unexpected admin logins.', 'Request a HexaStrike external validation check and attach the Qualys rescan as evidence.'],
    stems: {
      core: { kind: 'VPN portal node (VM)', code: 'VPN-PRT', sites: ['Slough DC1', 'Basildon DC2', 'AWS eu-central-1', 'AWS us-east-1'], internet: 0.5, versions: ['9.4.2', '9.5.1', '9.6.4'] },
      tooling: { kind: 'EdgeGate appliance (remote-access tier)', code: 'EGW', sites: ['Slough DC1 DMZ', 'Basildon DC2 DMZ', 'Luxembourg DMZ', 'New York DMZ'], internet: 1, versions: ['9.5.1', '9.6.2', '9.6.4'] },
    },
    supplierRe: /outsourc|maintenance|core banking|card|Infosys|Sopra|Temenos|FIS|consult|Software vendor|IT managed/i, supplierN: 4, outreach: 8,
  },
  media: {
    cve: 'CVE-2026-43391', vendor: 'Larkspur Software', product: 'Larkspur FileStream MFT', family: 'Managed file transfer',
    weakness: 'Unauthenticated injection in the web transfer interface', cvss: 9.9, kev: true, exploited: true, minAgo: 341,
    summary: 'A flaw in the transfer server’s web interface lets an unauthenticated attacker read and alter stored files and transfer records. Extortion crews have used it to steal data at scale from media and entertainment companies. A patched release is available.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 7, tooling: 0, ot: 2 },
    versions: '2025.1 to 2026.2.3', fixedIn: '2026.2.4',
    mitigation: 'Take the web interface off the internet or put it behind Cloudflare Zero Trust, rotate service-account keys and review transfer logs for unexpected downloads since disclosure.',
    remediation: ['Move the web interface behind Cloudflare Zero Trust (vendor partners keep access via named accounts).', 'Upgrade to 2026.2.4 and restart the transfer service.', 'Rotate the S3 and service-account keys the transfer server uses.', 'Ask HexaCustody to review transfers of pre-release titles since disclosure.', 'Request a HexaStrike validation check and attach the Tenable rescan as evidence.'],
    stems: {
      core: { kind: 'MFT transfer node', code: 'MFT', sites: ['AWS us-west-2', 'Soho machine room', 'Burbank DC', 'Atlanta broadcast centre'], internet: 0.45, versions: ['2025.4.1', '2026.1.0', '2026.2.3'] },
      ot: { kind: 'Playout ingest relay (embedded MFT)', code: 'ING-MFT', sites: ['Atlanta MCR', 'Atlanta ingest bay'], tenants: ['live'], internet: 0, versions: ['2025.4.1'] },
    },
    supplierRe: /VFX|post|Locali|dailies|Trailer|Distribution|Sound|Animation|Archive|Marketing/i, supplierN: 5, outreach: 8,
  },
  healthcare: {
    cve: 'CVE-2026-42650', vendor: 'Halden Health Systems', product: 'Halden InterLink integration engine', family: 'Clinical integration engine (HL7 / FHIR)',
    weakness: 'Authentication bypass in the administration API', cvss: 9.9, kev: true, exploited: true, minAgo: 388,
    summary: 'A flaw in the engine’s administration API lets an unauthenticated attacker on the network take control of interface channels, read the HL7 messages flowing through them and change routing. Health-ISAC and HHS HC3 report exploitation against US hospital systems. A fixed build is available.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 6, tooling: 0, ot: 9 },
    versions: '7.0 to 7.8.1', fixedIn: '7.8.2',
    mitigation: 'Restrict the admin API to the integration team’s jump host, rotate channel credentials and turn on message-integrity alerts for lab and pharmacy feeds until patched.',
    remediation: ['Confirm the engine build on each node (InsightVM credentialed scan or admin console).', 'Upgrade to 7.8.2 in the integration downtime window; notify Epic interface team and Lab.', 'For device gateways, apply the OEM-validated build only (FDA-cleared configuration); until then restrict the API by VLAN ACL.', 'Rotate channel and admin credentials; review channel routing changes since disclosure.', 'Request a HexaStrike validation check and attach the rescan as evidence.'],
    stems: {
      core: { kind: 'Integration engine node', code: 'HL7-ENG', sites: ['Columbus DC', 'Azure Central US', 'Zanesville comms room'], tenants: ['mrmc', 'kids', 'community', 'research'], internet: 0.15, versions: ['7.6.0', '7.7.2', '7.8.1'] },
      ot: { kind: 'Device integration gateway (pumps & monitors)', code: 'DIG', sites: ['ICU', 'Emergency department', 'Med-surg ward', 'NICU', 'Infusion centre'], tenants: ['mrmc', 'kids', 'community'], internet: 0, versions: ['7.4.3', '7.6.0'] },
    },
    supplierRe: /laborator|pathology|imaging|monitor|infusion|pharmacy|Epic|telehealth|EHR|health record/i, supplierN: 4, outreach: 7,
  },
  automotive: {
    cve: 'CVE-2026-44108', vendor: 'Strelitz Automation', product: 'Strelitz NovaLink PLC runtime', family: 'PLC firmware / remote-service module',
    weakness: 'Missing authentication on the remote-service channel', cvss: 9.9, kev: true, exploited: true, minAgo: 365,
    summary: 'A flaw in the controller firmware’s remote-service module lets an unauthenticated attacker who can reach the controller change its programme or stop it. Auto-ISAC and BSI report exploitation attempts against European manufacturers. Fixed firmware is available but must be installed during a planned line stop.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 3, tooling: 0, ot: 18 },
    versions: 'V3.0 to V3.4.1', fixedIn: 'V3.4.2',
    mitigation: 'Disable the remote-service module where it is not needed, enforce conduits so only the BeyondTrust jump hosts can reach controllers, and alert on programme changes until firmware is updated at the next line stop.',
    remediation: ['Confirm firmware on each controller from the Armis passive fingerprint (no active scanning on the line).', 'Disable the remote-service module where not needed (plant OT engineer, change ticket).', 'Install V3.4.2 at the next planned line stop; re-verify the PLC programme checksum afterwards.', 'Restrict the conduit to BeyondTrust jump hosts only; keep vendor sessions recorded.', 'Request a HexaStrike validation check and attach the Armis re-fingerprint as evidence.'],
    stems: {
      core: { kind: 'Engineering workstation (NovaLink tools)', code: 'ENG', sites: ['Ingolstadt engineering office', 'Győr engineering office', 'Puebla engineering office'], tenants: ['ingolstadt', 'gyor', 'puebla'], internet: 0, versions: ['V3.2.0', 'V3.4.1'] },
      ot: { kind: 'NovaLink PLC controller', code: 'PLC', sites: ['Body shop press line', 'Paint shop', 'Final assembly', 'E-drive line', 'Cell formation', 'Module assembly'], tenants: ['ingolstadt', 'gyor', 'battery', 'puebla'], internet: 0, versions: ['V3.1.2', 'V3.3.0', 'V3.4.1'] },
    },
    supplierRe: /robot|PLC|paint|automation|KUKA|Siemens|Dürr|Magna|assembly|MES/i, supplierN: 4, outreach: 7,
  },
};

const RECENT: Record<CustomerId, AdvSeed[]> = {
  maritime: [
    { cve: 'CVE-2026-41552', vendor: 'Brightfield Marine', product: 'Brightfield VSAT Terminal Manager', family: 'Satellite terminal management', weakness: 'Command injection in the web console', cvss: 9.6, kev: false, exploited: false, minAgo: 3 * D + 220, verdict: 'Affected', phase: 'Monitoring', counts: { ot: 6 }, summary: 'The terminal manager’s web console lets a low-privilege user run system commands on the terminal. Fixed in 3.2.1; vessels are patched as satellite windows allow.' },
    { cve: 'CVE-2026-40981', vendor: 'Quayline Systems', product: 'Quayline Gate OCR Server', family: 'Gate automation', weakness: 'Path traversal exposing configuration', cvss: 9.1, kev: false, exploited: false, minAgo: 9 * D + 300, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Gate OCR server 7.x exposes configuration files to unauthenticated users. Halcyon runs 8.2 at every gate, which is not affected.' },
    { cve: 'CVE-2026-42204', vendor: 'Norvik Data', product: 'Norvik Historian', family: 'OT data historian', weakness: 'Unsafe deserialisation in the collector service', cvss: 9.4, kev: false, exploited: false, minAgo: 760, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 3, summary: 'The historian collector accepts crafted data that can run code on the server. Versions at Antwerp and Port Klang are not reported by passive monitoring; a credentialed check has been requested.' },
    { cve: 'CVE-2026-39870', vendor: 'Varnel', product: 'Varnel LogRelay collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 27 * D + 140, verdict: 'Affected', phase: 'Closed', counts: { tooling: 3 }, summary: 'Log collectors forwarding terminal firewall logs to Sentinel ran a vulnerable listener. All three collectors were upgraded within 30 hours and validated by HexaStrike.' },
    { cve: 'CVE-2026-38815', vendor: 'Keelson Nautical', product: 'Keelson ECDIS Chart Server', family: 'Bridge navigation software', weakness: 'Unauthenticated file upload', cvss: 9.3, kev: false, exploited: false, minAgo: 41 * D + 600, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Chart servers on some vessel classes accept unauthenticated uploads. The Halcyon fleet uses a different ECDIS stack; confirmed against the HexaOT vessel inventory.' },
  ],
  finserv: [
    { cve: 'CVE-2026-41120', vendor: 'Ledgerline', product: 'Ledgerline Payment Hub', family: 'Payment message gateway', weakness: 'Authorisation bypass in the REST API', cvss: 9.1, kev: false, exploited: false, minAgo: 4 * D + 90, verdict: 'Affected', phase: 'Monitoring', counts: { core: 3 }, summary: 'A missing authorisation check lets an authenticated API client view other clients’ payment batches. Two of three hub nodes are patched; the third is mitigated by an API gateway rule until the Faster Payments freeze lifts.' },
    { cve: 'CVE-2026-40577', vendor: 'Aurex Security', product: 'Aurex HSM Admin Console', family: 'HSM management', weakness: 'Authentication bypass in the admin console', cvss: 9.8, kev: false, exploited: false, minAgo: 11 * D + 400, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Admin consoles for a family of payment HSMs can be reached without credentials. Aldersgate uses a different HSM family; confirmed by the Payments infrastructure team.' },
    { cve: 'CVE-2026-42311', vendor: 'Tallis Software', product: 'Tallis AppStream Gateway', family: 'Application delivery gateway', weakness: 'Session token disclosure', cvss: 9.3, kev: true, exploited: true, minAgo: 690, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 2, summary: 'The gateway can leak session tokens from memory to unauthenticated requests. Two hosts in the Wealth estate respond like the product; a credentialed Qualys scan is running.' },
    { cve: 'CVE-2026-39642', vendor: 'Varnel', product: 'Varnel LogRelay collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 23 * D + 200, verdict: 'Affected', phase: 'Closed', counts: { tooling: 5 }, summary: 'Five collectors forwarding mainframe and SWIFT logs into Splunk ran a vulnerable listener. All were upgraded inside the 24-hour SLA and the DORA log-integrity evidence refreshed.' },
    { cve: 'CVE-2026-38104', vendor: 'Orrin', product: 'Orrin Mainframe Connect', family: 'Mainframe terminal emulation', weakness: 'Credential exposure in session files', cvss: 9.0, kev: false, exploited: false, minAgo: 44 * D + 120, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Terminal emulator session files store credentials in a recoverable form. Aldersgate’s z/OS access goes through a different emulator; confirmed by CrowdStrike software inventory.' },
  ],
  media: [
    { cve: 'CVE-2026-41733', vendor: 'Corvid Systems', product: 'Corvid Render Queue Manager', family: 'Render farm scheduler', weakness: 'Unauthenticated job submission', cvss: 9.4, kev: false, exploited: false, minAgo: 5 * D + 60, verdict: 'Affected', phase: 'Monitoring', counts: { core: 4 }, summary: 'The render queue manager accepts jobs from unauthenticated clients, which can run commands on render nodes. Three managers are patched; one is isolated on the content network until the Nightjar deliverable ships.' },
    { cve: 'CVE-2026-40355', vendor: 'Marlowe Media', product: 'Marlowe Review Link Server', family: 'Screener and review platform', weakness: 'Insecure direct object reference on review links', cvss: 9.1, kev: false, exploited: true, minAgo: 12 * D + 300, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Review links can be enumerated to reach other productions’ screeners. Kestrel’s screener portal is built in-house and not affected; two vendors were asked and confirmed patched.' },
    { cve: 'CVE-2026-42877', vendor: 'Ostrander Broadcast', product: 'Ostrander Playout Controller', family: 'Broadcast playout automation', weakness: 'Missing authentication on the control API', cvss: 9.6, kev: false, exploited: false, minAgo: 540, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 2, summary: 'The playout controller API accepts commands without authentication. Two Atlanta playout servers expose a similar API; HexaOT is fingerprinting them passively (read-only by policy).' },
    { cve: 'CVE-2026-39518', vendor: 'Varnel', product: 'Varnel LogRelay collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 23 * D + 500, verdict: 'Affected', phase: 'Closed', counts: { tooling: 3 }, summary: 'Three collectors forwarding Soho content-network logs into Chronicle ran a vulnerable listener. Upgraded within 20 hours; TPN evidence refreshed.' },
    { cve: 'CVE-2026-37962', vendor: 'Penrose Digital', product: 'Penrose Asset Vault MAM', family: 'Media asset management', weakness: 'Stored script injection leading to admin takeover', cvss: 9.0, kev: false, exploited: false, minAgo: 38 * D + 200, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'A stored script flaw lets a contributor take over MAM administrator sessions. Kestrel’s MAM is a different product; Lumière VFX runs it and confirmed it was patched.' },
  ],
  healthcare: [
    { cve: 'CVE-2026-41388', vendor: 'Calder Imaging', product: 'Calder PACS Web Viewer', family: 'Imaging viewer (PACS)', weakness: 'Authentication bypass on study links', cvss: 9.3, kev: false, exploited: false, minAgo: 4 * D + 300, verdict: 'Affected', phase: 'Monitoring', counts: { core: 3 }, summary: 'Study links in the web viewer can be opened without signing in, exposing images and patient demographics. Two viewers are patched; the research viewer is restricted to the VPN pending the vendor build.' },
    { cve: 'CVE-2026-40726', vendor: 'Ardent Clinical', product: 'Ardent Nurse-Call Server', family: 'Nurse-call platform', weakness: 'Hard-coded service credential', cvss: 9.1, kev: false, exploited: false, minAgo: 10 * D + 100, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'A service account with a fixed password ships with older nurse-call servers. Mercy Ridge runs a newer generation at every site; confirmed by Claroty.' },
    { cve: 'CVE-2026-42513', vendor: 'Wexley Medical', product: 'Wexley Pump Library Server', family: 'Infusion drug-library server', weakness: 'Unauthenticated configuration change', cvss: 9.4, kev: false, exploited: false, minAgo: 610, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 3, summary: 'The drug-library server accepts configuration changes without authentication. Three servers in the community hospitals match the product family; Biomed is confirming versions with the OEM.' },
    { cve: 'CVE-2026-39702', vendor: 'Varnel', product: 'Varnel LogRelay collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 22 * D + 260, verdict: 'Affected', phase: 'Closed', counts: { tooling: 4 }, summary: 'Four collectors forwarding Epic and Citrix logs into Sentinel ran a vulnerable listener. All were upgraded within 26 hours; HIPAA audit-log evidence refreshed.' },
    { cve: 'CVE-2026-38340', vendor: 'Fenwick Health', product: 'Fenwick Telehealth Bridge', family: 'Telehealth video gateway', weakness: 'Session hijack through predictable tokens', cvss: 9.0, kev: false, exploited: true, minAgo: 36 * D + 400, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Predictable tokens let an attacker join video visits. Mercy Ridge does not run the bridge; TeleMed Partners confirmed it is not in their stack.' },
  ],
  automotive: [
    { cve: 'CVE-2026-41905', vendor: 'Torvald Software', product: 'Torvald MES Connector', family: 'MES integration middleware', weakness: 'Unsafe deserialisation leading to code execution', cvss: 9.5, kev: false, exploited: false, minAgo: 4 * D + 500, verdict: 'Affected', phase: 'Monitoring', counts: { core: 4, ot: 2 }, summary: 'The MES connector accepts crafted messages that run code on the server. Ingolstadt and Győr are patched; Puebla is mitigated by a conduit rule until its weekend line stop.' },
    { cve: 'CVE-2026-40488', vendor: 'Elmira Systems', product: 'Elmira OTA Signing Service', family: 'OTA package signing', weakness: 'Signature-check bypass', cvss: 9.2, kev: false, exploited: false, minAgo: 13 * D + 250, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'A flaw lets crafted update packages pass signature checks. Vireo signs OTA packages with an in-house HSM service; confirmed not affected for R156 records.' },
    { cve: 'CVE-2026-42760', vendor: 'Kessler Robotics', product: 'Kessler Robot Remote Service', family: 'Robot remote-service module', weakness: 'Unauthenticated remote session', cvss: 9.6, kev: true, exploited: true, minAgo: 580, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 4, summary: 'The robot remote-service module accepts sessions without authentication. Four robot cells in Puebla report a similar service; Armis is fingerprinting them passively.' },
    { cve: 'CVE-2026-39455', vendor: 'Varnel', product: 'Varnel LogRelay collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 24 * D + 300, verdict: 'Affected', phase: 'Closed', counts: { tooling: 3 }, summary: 'Three collectors forwarding plant DMZ logs into QRadar ran a vulnerable listener. Upgraded within 22 hours; TISAX and R155 monitoring evidence refreshed.' },
    { cve: 'CVE-2026-38590', vendor: 'Brandt Web', product: 'Brandt Dealer Portal Framework', family: 'Dealer portal framework', weakness: 'Authentication bypass on partner login', cvss: 9.1, kev: false, exploited: false, minAgo: 39 * D + 150, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Partner logins in the portal framework can be bypassed. The Vireo dealer portal is built on a different framework; DealerCore DMS confirmed it is not affected.' },
  ],
};

/** Default stems for recent advisories, per sector and source. */
const DEFAULT_STEMS: Record<CustomerId, Partial<Record<VrAssetSource, Omit<Stem, 'kind'>>>> = {
  maritime: { core: { code: 'SRV', sites: ['Group DC Rotterdam', 'Azure West Europe'], tenants: ['hq', 'rtm'], internet: 0.1, versions: ['3.1.0'] }, tooling: { code: 'LOG', sites: ['Group DC Rotterdam', 'Maasvlakte DMZ', 'Antwerp DMZ'], internet: 0, versions: ['4.2.0'] }, ot: { code: 'VST', sites: ['Bridge network', 'Comms room'], tenants: ['fleet'], internet: 0, versions: ['3.1.4', '3.2.0'] } },
  finserv: { core: { code: 'PAY', sites: ['Slough DC1', 'Basildon DC2'], tenants: ['pay', 'ukbank'], internet: 0, versions: ['6.3.1'] }, tooling: { code: 'LOG', sites: ['Slough DC1', 'Basildon DC2', 'AWS eu-central-1'], internet: 0, versions: ['4.2.0'] } },
  media: { core: { code: 'RQM', sites: ['Soho machine room', 'AWS us-west-2'], tenants: ['post', 'studios'], internet: 0, versions: ['11.2'] }, tooling: { code: 'LOG', sites: ['Soho machine room', 'AWS us-west-2'], internet: 0, versions: ['4.2.0'] } },
  healthcare: { core: { code: 'PACS', sites: ['Columbus DC', 'Research data centre'], tenants: ['mrmc', 'research'], internet: 0.3, versions: ['8.0.4'] }, tooling: { code: 'LOG', sites: ['Columbus DC', 'Azure Central US'], internet: 0, versions: ['4.2.0'] } },
  automotive: { core: { code: 'MES', sites: ['Ingolstadt plant DMZ', 'Győr plant DMZ', 'Puebla server room'], tenants: ['ingolstadt', 'gyor', 'puebla'], internet: 0, versions: ['5.0.2'] }, tooling: { code: 'LOG', sites: ['Ingolstadt plant DMZ', 'Azure Germany West Central'], internet: 0, versions: ['4.2.0'] }, ot: { code: 'MESC', sites: ['Final assembly'], tenants: ['puebla', 'gyor'], internet: 0, versions: ['5.0.2'] } },
};

const VESSELS = ['Halcyon Aurora', 'Halcyon Borealis', 'Halcyon Meridian', 'Halcyon Tide', 'Halcyon Solent', 'Halcyon Kestrel', 'Halcyon Fjord'];

/* =====================================================================
   Helpers
   ===================================================================== */
const conn = (c: CustomerProfile, re: RegExp) => c.connectors.find((k) => re.test(k.category));
const connName = (k?: { vendor: string; product: string }) => (k ? (k.vendor === 'Generic' || k.vendor === 'HexaShield' ? k.product : `${k.vendor} ${k.product}`) : '');

export function vrScanner(c: CustomerProfile): string {
  return connName(conn(c, /^Vulnerability$/)) || 'HexaCore scanner';
}
export function vrEdr(c: CustomerProfile): string {
  return connName(conn(c, /EDR/)) || 'EDR';
}
export function vrSiem(c: CustomerProfile): string {
  return connName(c.connectors.find((k) => k.category === 'SIEM' && !/Vehicle/.test(k.product))) || 'SIEM';
}
export function vrItsm(c: CustomerProfile): { name: string; ticket: (n: number) => string } {
  const k = conn(c, /ITSM/);
  const jira = k?.vendor === 'Atlassian';
  return { name: connName(k) || 'ITSM', ticket: (n) => (jira ? `SEC-${4100 + n}` : `CHG00${41200 + n}`) };
}
function otTool(c: CustomerProfile, tenantId: string): string {
  const ks = c.connectors.filter((k) => k.category === 'OT' && (k.tenants === 'all' || k.tenants.includes(tenantId)));
  return connName(ks[0] ?? c.connectors.find((k) => k.category === 'OT')) || 'HexaOT sensors';
}
function owners(c: CustomerProfile, src: VrAssetSource): string[] {
  const p = c.people;
  const staff = p.staff.filter((s) => (src === 'ot' ? /Engineer|Maintenance|Plant|Biomed|Broadcast|Terminal|Fleet|Chief/i : /IT|Infrastructure|Platform|Service|Engineer|Network|Cloud|Desk/i).test(s.role)).map((s) => s.name);
  if (src === 'ot') return [...(p.otLead ? [p.otLead.name] : []), ...staff].slice(0, 4).concat(p.admin.name).slice(0, 4);
  if (src === 'tooling') return [p.socLead.name, p.admin.name];
  return [p.admin.name, ...staff].slice(0, 4);
}
const advId = (cve: string) => cve.replace('CVE-', 'CVE');
const SLA_H = (internet: boolean, src: VrAssetSource, kev: boolean) => (src === 'ot' ? 168 : internet ? (kev ? 24 : 48) : kev ? 72 : 120);

function toAdvisory(s: AdvSeed, headline: boolean, r: Rng, c: CustomerProfile): VrAdvisory {
  const taxii = connName(c.connectors.find((k) => /TAXII/.test(k.product)));
  return {
    id: advId(s.cve), cve: s.cve, vendor: s.vendor, product: s.product, family: s.family, weakness: s.weakness, cvss: s.cvss,
    vector: s.cvss >= 9.5 ? VECTOR : 'Network · low privileges · no user interaction',
    kev: s.kev, exploited: s.exploited, publishedMinAgo: s.minAgo, summary: s.summary,
    affectedVersions: s.versions ?? 'All versions before the fixed release', fixedIn: s.fixedIn ?? 'Vendor fixed release',
    mitigation: s.mitigation ?? 'Apply the vendor fix; until then restrict network access to the affected service.',
    remediation: s.remediation ?? ['Confirm the installed version.', 'Apply the vendor fix in the next change window.', 'Restrict access to the affected service until patched.', 'Rescan and attach the confirmation as evidence.'],
    verdict: s.verdict, phase: s.phase, headline, feed: `HexaInt advisory collection${taxii ? ` · ${taxii}` : ' · vendor PSIRT feeds'} · NVD · CISA KEV`,
    candidates: s.candidates ?? 0, matchedAfterMin: headline ? r.int(3, 7) : r.int(8, 40),
  };
}

/* =====================================================================
   Builders (group-level, cached per customer)
   ===================================================================== */
interface Base { advisories: VrAdvisory[]; assets: VrAsset[]; seeds: Map<string, AdvSeed> }
const CACHE = new Map<CustomerId, Base>();

function build(c: CustomerProfile): Base {
  const hit = CACHE.get(c.id);
  if (hit) return hit;
  const r = rng(`vulnresponse-${c.id}`);
  const seeds = [HEADLINE[c.id], ...RECENT[c.id]];
  const advisories = seeds.map((s, i) => toAdvisory(s, i === 0, r, c));
  const seedMap = new Map(advisories.map((a, i) => [a.id, seeds[i]]));
  const itsm = vrItsm(c);
  const scanner = vrScanner(c);
  let ticketN = 0;
  const assets: VrAsset[] = [];
  advisories.forEach((a, ai) => {
    const s = seeds[ai];
    const ar = rng(`vulnresponse-${c.id}-${a.id}`);
    const rows: VrAsset[] = [];
    (['tooling', 'core', 'ot'] as VrAssetSource[]).forEach((src) => {
      const n = s.counts[src] ?? 0;
      if (!n) return;
      const def = DEFAULT_STEMS[c.id][src];
      const stem: Stem | undefined = s.stems?.[src] ?? (def ? { kind: `${a.family.replace(/ \(security tooling\)/, '')} ${src === 'ot' ? 'controller' : 'host'}`, ...def } : undefined);
      if (!stem) return;
      const tenantPool: Tenant[] = c.tenants.filter((t) => (stem.tenants ? stem.tenants.includes(t.id) : src === 'ot' ? t.env.includes('ot') : true));
      const pool = tenantPool.length ? tenantPool : c.tenants;
      const own = owners(c, src);
      for (let i = 0; i < n; i++) {
        const t = pool[i % pool.length];
        const site = c.id === 'maritime' && t.id === 'fleet' ? ar.pick(VESSELS) : `${t.short} · ${ar.pick(stem.sites)}`;
        const code = t.id.slice(0, 3).toUpperCase();
        const internet = stem.internet >= 1 ? true : ar.chance(stem.internet);
        const airGapped = /Air-gapped/.test(c.dataPlanes.find((d) => d.id === t.dataPlaneId)?.placement ?? '');
        const tool = src === 'ot' ? otTool(c, t.id) : src === 'tooling' ? 'Security Tooling inventory' : ar.chance(0.6) ? scanner : vrEdr(c);
        const sla = SLA_H(internet, src, a.kev);
        rows.push({
          id: `${a.id}-${String(rows.length + 1).padStart(3, '0')}`,
          advId: a.id,
          name: `${code}-${stem.code}-${String(ar.int(1, 24)).padStart(2, '0')}`,
          kind: stem.kind,
          source: src,
          tool,
          env: src === 'ot' ? 'ot' : /AWS|Azure|GCP/.test(site) ? 'cloud' : 'onprem',
          tenantId: t.id,
          tenantName: t.short,
          site,
          ip: internet ? `${ar.pick(['185.42', '194.9', '91.198', '212.71'])}.${ar.int(10, 250)}.${ar.int(2, 250)}` : `10.${ar.int(10, 90)}.${ar.int(0, 250)}.${ar.int(2, 250)}`,
          version: ar.pick(stem.versions),
          internet: internet && !airGapped,
          airGapped,
          owner: ar.pick(own),
          slaHours: sla,
          dueInMin: sla * 60 - a.publishedMinAgo,
          matchedAfterMin: a.matchedAfterMin + ar.int(0, src === 'ot' ? 26 : 9),
          status: 'Unpatched',
          statusMinAgo: null,
          ticket: null,
          scan: null,
          scanRequested: false,
          validation: 'Not run',
          validationRequested: false,
          detections: 0,
          note: airGapped ? 'Air-gapped plant: evidence arrives by offline import from the sealed HexaOT store.' : src === 'ot' ? 'OT is read-only by policy: HexaView tracks status; plant or terminal engineers apply the fix.' : undefined,
        });
      }
    });

    // Assign statuses: internet-facing first, then by source (IT before OT).
    const order = rows.slice().sort((x, y) => Number(y.internet) - Number(x.internet) || (x.source === 'ot' ? 1 : 0) - (y.source === 'ot' ? 1 : 0));
    const total = order.length;
    const closed = a.phase === 'Closed';
    const nPatched = closed ? total - (total > 3 ? 1 : 0) : a.phase === 'Monitoring' ? total - 1 : Math.round(total * ar.float(0.5, 0.6, 2));
    const nNa = closed && total > 3 ? 1 : a.headline && total > 8 ? 1 : 0;
    const nMit = closed ? 0 : a.phase === 'Monitoring' ? 1 : Math.max(2, Math.round(total * 0.2));
    order.forEach((x, i) => {
      // Keep exactly one internet-facing asset open on the live advisory for finserv and media (the urgent story).
      const keepOpen = a.headline && x.internet && i === order.findIndex((o) => o.internet && o.source !== 'ot') && (c.id === 'finserv' || c.id === 'media');
      let st: VrStatus = 'Unpatched';
      if (keepOpen) st = 'Unpatched';
      else if (i < nPatched) st = x.source === 'ot' && a.headline && ar.chance(0.4) ? 'Mitigated' : 'Patched';
      else if (i < nPatched + nMit) st = 'Mitigated';
      else if (i < nPatched + nMit + nNa) st = 'Not applicable';
      x.status = st;
      const window = Math.max(30, a.publishedMinAgo - x.matchedAfterMin - 8);
      x.statusMinAgo = st === 'Unpatched' ? null : Math.max(4, Math.round(a.publishedMinAgo - x.matchedAfterMin - ar.float(0.15, 0.95, 2) * window));
      if (st !== 'Unpatched' || ar.chance(0.6)) x.ticket = itsm.ticket(++ticketN + ai * 40);
      if (st === 'Patched') {
        const m = Math.max(2, (x.statusMinAgo ?? 30) - ar.int(3, 25));
        x.scan = { minAgo: m, tool: x.source === 'ot' ? x.tool : x.source === 'tooling' ? scanner : x.tool, hash: `sha256:${ar.hex(12)}…${ar.hex(6)}`, result: x.source === 'ot' ? `Firmware re-fingerprinted at ${a.fixedIn.split(' ')[0]} (passive)` : `Version ${a.fixedIn.split(' ')[0]} confirmed · plugin check passed` };
        x.version = a.fixedIn.split(' ')[0];
        x.validation = x.internet || ar.chance(0.5) ? 'Passed' : 'Not run';
      } else if (st === 'Mitigated') {
        x.validation = ar.chance(0.5) ? 'Scheduled' : 'Not run';
        x.note = x.source === 'ot' ? 'Compensating control: management interface restricted to the jump host; firmware at next maintenance window.' : 'Compensating control: access restricted at the firewall; patch scheduled.';
      } else if (st === 'Not applicable') {
        x.note = 'Vulnerable module disabled in configuration; confirmed by credentialed scan.';
        x.scan = { minAgo: Math.max(5, (x.statusMinAgo ?? 60) - 10), tool: scanner, hash: `sha256:${ar.hex(12)}…${ar.hex(6)}`, result: 'Vulnerable module not enabled' };
      } else {
        x.validation = x.internet ? 'Failed' : 'Not run';
      }
      if (a.headline || a.phase !== 'Closed') x.detections = x.internet ? ar.int(1, 4) : ar.chance(0.25) ? 1 : 0;
    });
    assets.push(...rows);
  });
  const base = { advisories, assets, seeds: seedMap };
  CACHE.set(c.id, base);
  return base;
}

/* =====================================================================
   In-session store (edits survive navigation within the session)
   ===================================================================== */
interface AssetEdit { status?: VrStatus; statusAt?: number; ticket?: string; scanAt?: number; valAt?: number }
interface StoreState {
  assets: Record<string, AssetEdit>;
  outreach: Record<string, number>; // `${cid}:${adv}` -> sent at
  replies: Record<string, { reply: VrReply; at: number }>; // `${cid}:${adv}:${sup}`
  chases: Record<string, number[]>;
  log: { cid: CustomerId; adv: string; at: number; title: string; body?: string; color?: string; by?: string }[];
  saved: Record<string, number>; // `${cid}:${adv}:${audience}` -> saved at
  ticketN: number;
}
let STATE: StoreState = { assets: {}, outreach: {}, replies: {}, chases: {}, log: [], saved: {}, ticketN: 0 };
let VERSION = 0;
const LISTENERS = new Set<() => void>();
function commit(fn: (s: StoreState) => StoreState) {
  STATE = fn(STATE);
  VERSION++;
  LISTENERS.forEach((l) => l());
}
export function vrSubscribe(l: () => void): () => void {
  LISTENERS.add(l);
  return () => LISTENERS.delete(l);
}
export function vrVersion(): number {
  return VERSION;
}
const minsSince = (at: number) => Math.max(0, Math.round((Date.now() - at) / 60000));
const akey = (cid: string, assetId: string) => `${cid}:${assetId}`;

function addLog(cid: CustomerId, adv: string, title: string, body?: string, color?: string, by?: string) {
  commit((s) => ({ ...s, log: [{ cid, adv, at: Date.now(), title, body, color, by }, ...s.log] }));
}

export function vrSetStatus(c: CustomerProfile, a: VrAsset, status: VrStatus, by: string) {
  commit((s) => ({ ...s, assets: { ...s.assets, [akey(c.id, a.id)]: { ...s.assets[akey(c.id, a.id)], status, statusAt: Date.now() } } }));
  addLog(c.id, a.advId, `${a.name} marked ${status.toLowerCase()}`, `${a.kind} · ${a.site}`, VR_STATUS_COLOR[status], by);
}
export function vrRaiseTicket(c: CustomerProfile, a: VrAsset, by: string): string {
  const itsm = vrItsm(c);
  const id = itsm.ticket(900 + STATE.ticketN + 1);
  commit((s) => ({ ...s, ticketN: s.ticketN + 1, assets: { ...s.assets, [akey(c.id, a.id)]: { ...s.assets[akey(c.id, a.id)], ticket: id } } }));
  addLog(c.id, a.advId, `Ticket ${id} raised in ${itsm.name}`, `${a.name} · owner ${a.owner}`, 'var(--m-matrix)', by);
  return id;
}
export function vrRequestScan(c: CustomerProfile, a: VrAsset, by: string) {
  commit((s) => ({ ...s, assets: { ...s.assets, [akey(c.id, a.id)]: { ...s.assets[akey(c.id, a.id)], scanAt: Date.now() } } }));
  addLog(c.id, a.advId, `Validation scan requested for ${a.name}`, a.source === 'ot' ? `Passive re-fingerprint via ${a.tool} (read-only)` : `${vrScanner(c)} credentialed check + HexaStrike validation`, 'var(--m-strike)', by);
}
export function vrRequestValidation(c: CustomerProfile, adv: VrAdvisory, n: number, by: string) {
  addLog(c.id, adv.id, `HexaStrike validation requested for ${n} asset${n === 1 ? '' : 's'}`, `Safe, non-exploiting version and exposure checks for ${adv.cve}`, 'var(--m-strike)', by);
}
export function vrSendOutreach(c: CustomerProfile, adv: VrAdvisory, sups: VrSupplier[], by: string) {
  const key = `${c.id}:${adv.id}`;
  commit((s) => ({ ...s, outreach: { ...s.outreach, [key]: Date.now() } }));
  addLog(c.id, adv.id, `"Are you affected?" questionnaire sent to ${sups.length} suppliers`, sups.map((x) => x.name).join(', '), 'var(--m-comply)', by);
  // Replies arrive over the next few seconds (demo pacing); the seeded "No response" ones stay silent.
  const seeded = seedReplies(c, adv, sups);
  sups.forEach((sp, i) => {
    const rep = seeded.get(sp.id);
    if (!rep || rep === 'No response') return;
    setTimeout(() => vrRecordReply(c, adv, sp, rep), 1600 + i * 1300);
  });
}
export function vrRecordReply(c: CustomerProfile, adv: VrAdvisory, sp: VrSupplier, reply: VrReply) {
  commit((s) => ({ ...s, replies: { ...s.replies, [`${c.id}:${adv.id}:${sp.id}`]: { reply, at: Date.now() } } }));
  addLog(c.id, adv.id, `${sp.name} replied: ${reply}`, undefined, VR_REPLY_COLOR[reply]);
}
export function vrChase(c: CustomerProfile, adv: VrAdvisory, sp: VrSupplier, by: string) {
  const k = `${c.id}:${adv.id}:${sp.id}`;
  commit((s) => ({ ...s, chases: { ...s.chases, [k]: [...(s.chases[k] ?? []), Date.now()] } }));
  addLog(c.id, adv.id, `Chased ${sp.name}`, `Reminder to ${sp.contact}; escalated to the supplier relationship owner`, 'var(--sev-medium)', by);
  const seeded = seedReplies(c, adv, [sp]).get(sp.id);
  // A chase usually shakes a reply loose.
  if ((STATE.chases[k]?.length ?? 0) >= 1) setTimeout(() => vrRecordReply(c, adv, sp, seeded === 'No response' || !seeded ? 'Affected – patching' : seeded), 2600);
}
export function vrSaveStatement(c: CustomerProfile, adv: VrAdvisory, audience: string, by: string) {
  commit((s) => ({ ...s, saved: { ...s.saved, [`${c.id}:${adv.id}:${audience}`]: Date.now() } }));
  addLog(c.id, adv.id, `Exposure statement (${audience}) saved to Reporting`, 'Signed SHA-256 and filed under Issued Reports', 'var(--m-reports)', by);
}
export function vrStatementSaved(c: CustomerProfile, adv: VrAdvisory, audience: string): number | null {
  const at = STATE.saved[`${c.id}:${adv.id}:${audience}`];
  return at ? minsSince(at) : null;
}

/* =====================================================================
   Public read API
   ===================================================================== */
export function vrAdvisories(c: CustomerProfile): VrAdvisory[] {
  return build(c).advisories;
}
export function vrAdvisory(c: CustomerProfile, id?: string | null): VrAdvisory {
  const all = build(c).advisories;
  return all.find((a) => a.id === id || a.cve === id) ?? all[0];
}

/** Assets matched for an advisory, tenant-scoped, with in-session edits applied. */
export function vrAssets(c: CustomerProfile, tenantId: string, adv: VrAdvisory): VrAsset[] {
  return build(c).assets
    .filter((a) => a.advId === adv.id && (tenantId === 'all' || a.tenantId === tenantId))
    .map((a) => {
      const e = STATE.assets[akey(c.id, a.id)];
      if (!e) return a;
      const out: VrAsset = { ...a, byUser: true };
      if (e.status) {
        out.status = e.status;
        out.statusMinAgo = minsSince(e.statusAt ?? Date.now());
        if (e.status === 'Patched') {
          out.version = adv.fixedIn.split(' ')[0];
          out.validation = a.validation === 'Passed' ? 'Passed' : 'Scheduled';
          out.scan = out.scan ?? { minAgo: out.statusMinAgo, tool: a.source === 'ot' ? a.tool : vrScanner(c), hash: `sha256:${rng(a.id).hex(12)}…${rng(a.id + 'x').hex(6)}`, result: a.source === 'ot' ? 'Re-fingerprint queued (passive, read-only)' : 'Rescan queued · confirmation pending' };
        }
        if (e.status === 'Mitigated') out.note = a.note && /Compensating/.test(a.note) ? a.note : 'Compensating control recorded in session; patch still required.';
      }
      if (e.ticket) out.ticket = e.ticket;
      if (e.scanAt) { out.scanRequested = true; out.validationRequested = true; if (out.validation === 'Not run' || out.validation === 'Failed') out.validation = 'Scheduled'; }
      return out;
    });
}

export interface VrTally { total: number; Unpatched: number; Mitigated: number; Patched: number; 'Not applicable': number; resolved: number; internetOpen: number; overdue: number; bySource: Record<VrAssetSource, number> }
export function vrTally(rows: VrAsset[]): VrTally {
  const t: VrTally = { total: rows.length, Unpatched: 0, Mitigated: 0, Patched: 0, 'Not applicable': 0, resolved: 0, internetOpen: 0, overdue: 0, bySource: { core: 0, tooling: 0, ot: 0 } };
  rows.forEach((r) => {
    t[r.status]++;
    t.bySource[r.source]++;
    if (r.internet && r.status === 'Unpatched') t.internetOpen++;
    if (r.status === 'Unpatched' && r.dueInMin < 0) t.overdue++;
  });
  t.resolved = t.Patched + t['Not applicable'];
  return t;
}

/** Verdict for the current scope (an affected advisory may not touch the selected tenant). */
export function vrScopedVerdict(adv: VrAdvisory, rows: VrAsset[], tenantId: string): VrVerdict {
  if (adv.verdict === 'Affected' && tenantId !== 'all' && rows.length === 0) return 'Not affected';
  return adv.verdict;
}

/** Sources that were checked for an advisory and how many records each holds. */
export function vrCoverage(c: CustomerProfile, tenantId: string): { source: VrSource; checked: number; unit: string; tools: string[] }[] {
  const scoped = c.connectors.filter((k) => tenantId === 'all' || k.tenants === 'all' || k.tenants.includes(tenantId));
  const coreTools = scoped.filter((k) => ['Vulnerability', 'EDR / XDR', 'Cloud posture', 'Asset / CMDB'].includes(k.category));
  const otTools = scoped.filter((k) => k.category === 'OT');
  const r = rng(`vr-cov-${c.id}-${tenantId}`);
  const share = tenantId === 'all' ? 1 : 0.25;
  return [
    { source: 'core', checked: Math.round((c.employees * 1.6) * share) + r.int(10, 90), unit: 'assets', tools: coreTools.map(connName) },
    { source: 'tooling', checked: scoped.filter((k) => k.vendor !== 'HexaShield').length, unit: 'tools', tools: ['Security Tooling inventory'] },
    { source: 'ot', checked: otTools.length ? otTools.reduce((n, k) => n + k.records, 0) : 0, unit: 'OT assets', tools: otTools.map(connName) },
    { source: 'tprm', checked: tpSuppliers(c, tenantId).length, unit: 'suppliers', tools: [connName(c.connectors.find((k) => k.category === 'GRC')) || 'HexaComply'] },
  ];
}

function seedReplies(c: CustomerProfile, adv: VrAdvisory, sups: VrSupplier[]): Map<string, VrReply> {
  const out = new Map<string, VrReply>();
  sups.forEach((s) => {
    const r = rng(`vr-reply-${c.id}-${adv.id}-${s.id}`);
    const rep: VrReply = s.runsProduct ? r.weighted<VrReply>([['Affected – patched', 4], ['Affected – patching', 4], ['No response', 2]]) : r.weighted<VrReply>([['Not affected', 6], ['No response', 2], ['Affected – patched', 1]]);
    out.set(s.id, rep);
  });
  return out;
}

/** Suppliers relevant to an advisory (TPRM register), with outreach state applied. */
export function vrSuppliers(c: CustomerProfile, tenantId: string, adv: VrAdvisory): VrSupplier[] {
  const seed = build(c).seeds.get(adv.id);
  const all = tpSuppliers(c, tenantId);
  const re = seed?.supplierRe ?? new RegExp(adv.family.split(/[ /]/)[0], 'i');
  const r = rng(`vr-sup-${c.id}-${adv.id}`);
  const nRun = seed?.supplierN ?? (adv.verdict === 'Not affected' && adv.phase === 'Closed' ? r.int(0, 2) : r.int(1, 2));
  const nAsk = Math.max(nRun, seed?.outreach ?? (nRun ? nRun + r.int(1, 3) : 0));
  const scored = all
    .map((s) => ({ s, m: re.test(`${s.name} ${s.v.category} ${s.v.access} ${s.service}`) ? 1 : 0, k: r() }))
    .sort((a, b) => b.m - a.m || a.s.v.tier - b.s.v.tier || a.k - b.k)
    .slice(0, nAsk);
  const key = `${c.id}:${adv.id}`;
  const historic = adv.phase !== 'Active response';
  const sentAt = STATE.outreach[key];
  const asked = historic ? nAsk > 0 : !!sentAt;
  const rows: VrSupplier[] = scored.map(({ s }, i) => ({
    id: s.id, name: s.name, mono: s.mono, tier: s.v.tier, category: s.v.category, contact: s.contact,
    runsProduct: i < nRun,
    why: i < nRun ? `Runs ${adv.product} for ${s.v.access.toLowerCase()} (TPRM technology register)` : `${s.v.category}: ${s.v.access.toLowerCase()}; product use unknown`,
    asked, askedMinAgo: historic ? adv.publishedMinAgo - 90 - i * 3 : sentAt ? minsSince(sentAt) : null,
    reply: null, repliedMinAgo: null, chases: (STATE.chases[`${key}:${s.id}`] ?? []).length, note: '',
  }));
  const seeded = seedReplies(c, adv, rows);
  rows.forEach((x, i) => {
    const live = STATE.replies[`${key}:${x.id}`];
    if (live) { x.reply = live.reply; x.repliedMinAgo = minsSince(live.at); }
    else if (historic) { x.reply = seeded.get(x.id) === 'No response' && adv.phase === 'Closed' ? 'Not affected' : seeded.get(x.id) ?? 'Not affected'; x.repliedMinAgo = adv.publishedMinAgo - 300 - i * 120; }
    x.note = x.reply === 'Affected – patching' ? 'Patch scheduled; compensating controls in place on their side' : x.reply === 'Affected – patched' ? 'Patched; evidence (version screenshot) attached' : x.reply === 'Not affected' ? 'Confirmed product not in use' : '';
  });
  return rows;
}

export function vrDetections(c: CustomerProfile, adv: VrAdvisory, rows: VrAsset[]): VrDetection[] {
  const r = rng(`vr-det-${c.id}-${adv.id}`);
  const siem = vrSiem(c);
  const edr = vrEdr(c);
  const out: VrDetection[] = [];
  rows.filter((a) => a.detections > 0).forEach((a) => {
    for (let i = 0; i < a.detections; i++) {
      const internetish = a.internet;
      const title = internetish
        ? r.pick([`Scanning for ${adv.cve} from a known scanner network`, `Request matching ${adv.cve} detection signature (blocked)`, `Mass probing of ${adv.family.toLowerCase()} endpoints`])
        : r.pick([`Unexpected admin session on ${a.kind.toLowerCase()}`, `Configuration change outside change window`, `New outbound connection from ${a.name}`]);
      out.push({
        id: r.id('DET', 5), title, minAgo: r.int(5, Math.max(10, adv.publishedMinAgo - 5)), asset: a.name,
        tool: a.source === 'ot' ? a.tool : internetish ? siem : edr,
        sev: internetish ? (a.status === 'Unpatched' ? 'high' : 'medium') : 'medium',
        outcome: internetish ? (a.status === 'Unpatched' ? 'Blocked at perimeter · asset still exposed' : 'Blocked · asset already fixed') : 'Investigated by HexaSOC · benign (approved change)',
      });
    }
  });
  return out.sort((a, b) => a.minAgo - b.minAgo);
}

export function vrChecks(adv: VrAdvisory, rows: VrAsset[]): VrCheck[] {
  const r = rng(`vr-chk-${adv.id}`);
  return rows
    .filter((a) => a.validation !== 'Not run' || a.internet)
    .map((a) => ({
      id: `VAL-${adv.cve.slice(-5)}-${a.id.slice(-3)}`,
      asset: a.name,
      check: a.internet ? 'External exposure and version check (non-exploiting)' : a.source === 'ot' ? 'Passive firmware verification (read-only)' : 'Authenticated version check',
      result: a.validation === 'Not run' ? ('Scheduled' as VrValidation) : a.validation,
      minAgo: a.validation === 'Passed' || a.validation === 'Failed' ? r.int(4, Math.max(8, (a.statusMinAgo ?? 60) - 2)) : null,
    }));
}

/** Burn-down since disclosure: open / mitigated / resolved per bucket. */
export function vrBurndown(adv: VrAdvisory, rows: VrAsset[]): { labels: string[]; open: number[]; mitigated: number[]; resolved: number[]; bucketMin: number } {
  const span = adv.publishedMinAgo;
  const bucketMin = span <= 12 * 60 ? 30 : span <= 2 * D ? 120 : span <= 10 * D ? 12 * 60 : D;
  const n = Math.max(2, Math.ceil(span / bucketMin));
  const labels: string[] = [];
  const open: number[] = [];
  const mitigated: number[] = [];
  const resolved: number[] = [];
  for (let i = 0; i <= n; i++) {
    const m = Math.min(span, i * bucketMin); // minutes after disclosure
    labels.push(i === n ? 'Now' : bucketMin < D && bucketMin < 720 ? `+${(m / 60) % 1 ? (m / 60).toFixed(1) : m / 60} h` : `+${Math.round(m / D * 10) / 10} d`);
    let o = 0, mi = 0, re = 0;
    rows.forEach((a) => {
      if (a.matchedAfterMin > m) return;
      const changedAt = a.statusMinAgo === null ? Infinity : span - a.statusMinAgo;
      const st = changedAt <= m || i === n ? a.status : 'Unpatched';
      if (st === 'Unpatched') o++;
      else if (st === 'Mitigated') mi++;
      else re++;
    });
    open.push(o);
    mitigated.push(mi);
    resolved.push(re);
  }
  return { labels, open, mitigated, resolved, bucketMin };
}

/** Timeline for the statement and the advisory, seeded milestones plus session events. */
export function vrTimeline(c: CustomerProfile, adv: VrAdvisory, rows: VrAsset[], sups: VrSupplier[]): VrEvent[] {
  const ev: VrEvent[] = [];
  const P = adv.publishedMinAgo;
  ev.push({ minAgo: P, title: `${adv.cve} published`, body: `${adv.vendor} advisory · CVSS ${adv.cvss.toFixed(1)}${adv.kev ? ' · added to CISA KEV' : ''}`, color: 'var(--sev-critical)' });
  ev.push({ minAgo: P - 2, title: 'HexaInt ingested the advisory', body: adv.feed, color: 'var(--m-int)' });
  if (rows.length) {
    const first = Math.min(...rows.map((a) => a.matchedAfterMin));
    const last = Math.max(...rows.map((a) => a.matchedAfterMin));
    ev.push({ minAgo: P - first, title: `First match: ${rows.length} asset${rows.length === 1 ? '' : 's'} identified`, body: `HexaCore, Security Tooling and HexaOT matched within ${last} min of disclosure`, color: 'var(--m-core)' });
  } else if (adv.verdict === 'Investigating') {
    ev.push({ minAgo: P - adv.matchedAfterMin, title: `${adv.candidates} candidate hosts need a version check`, body: 'Credentialed check requested', color: 'var(--sev-medium)' });
  } else {
    ev.push({ minAgo: P - adv.matchedAfterMin, title: 'No matching assets found', body: 'All sources checked: HexaCore, Security Tooling, HexaOT and the TPRM register', color: 'var(--good)' });
  }
  const changed = rows.filter((a) => a.statusMinAgo !== null && !a.byUser).sort((a, b) => (b.statusMinAgo ?? 0) - (a.statusMinAgo ?? 0));
  const firstFix = changed[0];
  if (firstFix) ev.push({ minAgo: firstFix.statusMinAgo ?? 0, title: `First asset ${firstFix.status.toLowerCase()}: ${firstFix.name}`, body: firstFix.ticket ? `Ticket ${firstFix.ticket}` : undefined, color: VR_STATUS_COLOR[firstFix.status] });
  const internet = rows.filter((a) => a.internet && a.status !== 'Unpatched' && a.statusMinAgo !== null);
  if (internet.length) ev.push({ minAgo: Math.min(...internet.map((a) => a.statusMinAgo ?? 0)), title: `${internet.length} internet-facing asset${internet.length === 1 ? '' : 's'} fixed or mitigated`, color: 'var(--good)' });
  if (sups.length && sups[0].askedMinAgo !== null && adv.phase !== 'Active response') ev.push({ minAgo: sups[0].askedMinAgo, title: `Supplier questionnaire sent to ${sups.length}`, color: 'var(--m-comply)' });
  STATE.log.filter((l) => l.cid === c.id && l.adv === adv.id).forEach((l) => ev.push({ minAgo: minsSince(l.at), title: l.title, body: l.body, color: l.color, by: l.by }));
  return ev.sort((a, b) => b.minAgo - a.minAgo);
}

/** Small summary used by the Command Centre attention queue, notifications and HexaInt Overview. */
export function vrHeadline(c: CustomerProfile, tenantId = 'all') {
  const adv = vrAdvisories(c)[0];
  const rows = vrAssets(c, tenantId, adv);
  const t = vrTally(rows);
  return { adv, affected: t.total, patched: t.Patched, mitigated: t.Mitigated, open: t.Unpatched, internetOpen: t.internetOpen, tenant: rows[0]?.tenantId ?? c.tenants[0].id };
}
