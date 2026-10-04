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
import { forCustomer, type CustomerMap } from '../customerMap';

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
interface Stem {
  kind: string; code: string; sites: string[]; tenants?: string[]; internet: number; versions: string[];
  /** Real site names per tenant (multi-site customers); falls back to `sites`. */
  siteByTenant?: Record<string, string[]>;
}
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

const HEADLINE: CustomerMap<AdvSeed> = {
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
  insurance: {
    cve: 'CVE-2026-43702', vendor: 'Bramwell Software', product: 'Bramwell SecureXchange MFT', family: 'Managed file transfer',
    weakness: 'Unauthenticated injection in the transfer web service', cvss: 9.9, kev: true, exploited: true, minAgo: 349,
    summary: 'A flaw in the transfer server’s web service lets an unauthenticated attacker read, alter and delete stored files and transfer records. FS-ISAC reports a mass-exploitation campaign by an extortion crew against insurers and third-party claims administrators. A fixed release is available.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 7, tooling: 0, ot: 0 },
    versions: '2024.2 to 2026.1.4', fixedIn: '2026.1.5',
    mitigation: 'Take the web interface off the internet behind Zscaler ZPA so TPAs, EXL and Broadridge keep access through named accounts, rotate the service-account keys and review downloads of claims and policyholder files since disclosure.',
    remediation: ['Preserve the transfer server logs and database before changing anything (possible NYDFS 500.17 72-hour notice and NAIC #668 state notices).', 'Upgrade to 2026.1.5 under an emergency change in ServiceNow (CAB chair approval).', 'Rotate the SFTP keys and service accounts used by EXL, CCC and Broadridge; re-issue partner access through named accounts only.', 'Ask HexaCustody and Varonis to list claims and policyholder files downloaded since disclosure.', 'Request a HexaStrike external validation check and attach the Qualys rescan as evidence.'],
    stems: {
      core: { kind: 'MFT transfer node', code: 'MFT', sites: ['Windsor DC1', 'Phoenix DC2 (colo)', 'AWS us-east-1', 'Azure East US 2'], tenants: ['group', 'claims', 'personal', 'life', 'commercial'], internet: 0.45, versions: ['2025.2.1', '2025.4.0', '2026.1.4'], siteByTenant: { group: ['Windsor DC1', 'Phoenix DC2 (colo)'], claims: ['Azure East US 2', 'Windsor DC1'], personal: ['AWS us-east-1'], life: ['Windsor DC1'], commercial: ['Azure East US 2'] } },
    },
    supplierRe: /claims|BPO|servicing|print|payments|estimating|EXL|Broadridge|CCC|One Inc|Cognizant|Majesco/i, supplierN: 4, outreach: 8,
  },
  defence: {
    cve: 'CVE-2026-44263', vendor: 'Talgarth Networks', product: 'Talgarth PerimeterOne VPN', family: 'VPN / remote-access gateway',
    weakness: 'Pre-authentication remote code execution in the portal service', cvss: 9.9, kev: true, exploited: true, minAgo: 361,
    summary: 'A flaw in the appliance’s portal service lets an unauthenticated attacker on the internet run code on the gateway and reach the networks behind it. CISA and DC3 DCISE report exploitation by a state-sponsored group against defence industrial base suppliers. Fixed builds and an integrity-check tool are available.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 2, tooling: 3, ot: 0 },
    versions: '7.2 to 7.5.3', fixedIn: '7.5.4',
    mitigation: 'Limit the portal to US-person staff on managed devices through Zscaler ZPA Government, run the vendor integrity-check tool, end every active session and rotate the gateway’s LDAP bind account and certificate after patching.',
    remediation: ['Run the vendor integrity-check tool and image each appliance before changing anything (DFARS 7012: preserve images for 90 days and report within 72 hours via DIBNet if compromise is found).', 'Upgrade to 7.5.4 under an emergency change in ServiceNow GCC (CISO approval).', 'End all active VPN sessions; rotate the LDAP bind account and re-issue the gateway certificate from Keyfactor.', 'Hunt in Sentinel (Azure Government) for unexpected admin logins and new connections into the CUI enclave since disclosure.', 'Request a HexaStrike external validation check and attach the Tenable Security Center rescan as evidence.'],
    stems: {
      core: { kind: 'VPN portal node (VM)', code: 'VPN-PRT', sites: ['Huntsville data centre', 'Azure Government (US Gov Virginia)'], tenants: ['programs', 'engineering', 'corporate'], internet: 0.5, versions: ['7.4.1', '7.5.3'], siteByTenant: { programs: ['Azure Government (US Gov Virginia)'], engineering: ['Huntsville data centre'], corporate: ['Azure East US 2 (commercial)'] } },
      tooling: { kind: 'PerimeterOne appliance (remote-access tier)', code: 'VPN', sites: ['Enclave DMZ', 'Corporate DMZ', 'Range DMZ'], tenants: ['programs', 'corporate', 'tucson'], internet: 1, versions: ['7.4.1', '7.5.2', '7.5.3'], siteByTenant: { programs: ['Enclave DMZ'], corporate: ['Corporate DMZ'], tucson: ['Range DMZ'] } },
    },
    supplierRe: /sub-tier|telemetry|Exostar|PLM|machin|finishing|C3PAO|freight/i, supplierN: 3, outreach: 7,
  },
  pharma: {
    cve: 'CVE-2026-42894', vendor: 'Velden Systems', product: 'Velden ProcessBridge OPC UA Gateway', family: 'OT data gateway (OPC UA)',
    weakness: 'Authentication bypass in the gateway configuration service', cvss: 9.9, kev: true, exploited: true, minAgo: 377,
    summary: 'A flaw in the gateway’s configuration service lets an unauthenticated attacker on the plant network change data mappings, read process values and write set-points to connected controllers. Health-ISAC and NCSC Switzerland report exploitation attempts against life-sciences manufacturers. A fixed build is available but must pass GxP change control before installation.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 3, tooling: 0, ot: 12 },
    versions: '4.0 to 4.6.2', fixedIn: '4.6.3',
    mitigation: 'Restrict the configuration service to the Level 3.5 engineering jump hosts, switch gateways to read-only mode where batch execution allows, and alert on mapping changes and PAS-X audit-trail gaps until patched.',
    remediation: ['Confirm the build on each gateway from the Claroty and Dragos passive fingerprints (no active scanning in GMP areas).', 'Raise a GxP change in ServiceNow with a computerised-system validation impact assessment; Head of IT Quality approval required.', 'Install 4.6.3 at the next campaign changeover; re-run the DeltaV and PAS-X interface qualification scripts afterwards.', 'Review PAS-X and DeltaV audit trails for set-point or mapping changes since disclosure and tell the Qualified Person of any batch impact.', 'Request a HexaStrike validation check and attach the passive re-fingerprint as evidence.'],
    stems: {
      core: { kind: 'MES & historian integration server', code: 'OPC-INT', sites: ['Plant DMZ (Level 3.5)', 'Basel data centre'], tenants: ['valais', 'cork', 'corporate'], internet: 0, versions: ['4.5.1', '4.6.2'], siteByTenant: { valais: ['Sierre plant DMZ (Level 3.5)'], cork: ['Ringaskiddy plant DMZ (Level 3.5)'], corporate: ['Basel data centre'] } },
      ot: { kind: 'ProcessBridge gateway appliance', code: 'OPCGW', sites: ['Production building', 'Process control room', 'Utilities & CIP', 'Packaging hall', 'QC laboratory'], tenants: ['valais', 'cork'], internet: 0, versions: ['4.2.0', '4.5.1', '4.6.2'], siteByTenant: { valais: ['Bioreactor suite (2,000 L)', 'Purification & chromatography', 'API synthesis building', 'Utilities & CIP/SIP', 'QC laboratory'], cork: ['Filling isolator line', 'Lyophiliser hall', 'Serialisation & aggregation', 'Utilities & CIP/SIP'] } },
    },
    supplierRe: /DCS|Automation|MES|Emerson|Siemens|Körber|CDMO|Lonza|Samsung|fill-finish|Catalent/i, supplierN: 4, outreach: 7,
  },
  sghospital: {
    cve: 'CVE-2026-43126', vendor: 'Sorrell Imaging', product: 'Sorrell RouteMaster DICOM Gateway', family: 'Imaging gateway (DICOM / PACS)',
    weakness: 'Authentication bypass in the web administration service', cvss: 9.9, kev: true, exploited: true, minAgo: 383,
    summary: 'A flaw in the gateway’s administration service lets an unauthenticated attacker on the network change routing rules, read imaging studies with patient identifiers and send studies to an outside node. CSA SingCERT and H-ISAC report exploitation by ransomware groups against hospitals in the region. A fixed build is available.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 4, tooling: 0, ot: 7 },
    versions: '6.0 to 6.3.4', fixedIn: '6.3.5',
    mitigation: 'Restrict the administration service to the PACS team’s jump host, block outbound DICOM to unknown nodes at the FortiGate and alert on routing-rule changes until patched.',
    remediation: ['Confirm the build on each gateway (InsightVM credentialed scan for servers; Claroty passive fingerprint for modality-side units).', 'Upgrade the PACS-side gateways to 6.3.5 in the radiology downtime window; tell the PACS Administrator and the TrakCare interface team.', 'For modality-side units, install only the OEM-validated build (HSA GL-04); until then restrict them by VLAN ACL.', 'Review routing changes and outbound study transfers since disclosure; if patient data left the network, start the MOH 2-hour and PDPC 3-day assessments.', 'Request a HexaStrike validation check and attach the rescan as evidence.'],
    stems: {
      core: { kind: 'PACS gateway server', code: 'DCMGW', sites: ['Novena campus DC', 'Tai Seng DR site', 'Azure Southeast Asia'], tenants: ['obh', 'labimg', 'specialist'], internet: 0.1, versions: ['6.2.0', '6.3.1', '6.3.4'], siteByTenant: { obh: ['Novena campus DC', 'Tai Seng DR site'], labimg: ['Science Park comms room'], specialist: ['Azure Southeast Asia'] } },
      ot: { kind: 'Modality-side DICOM gateway', code: 'MODGW', sites: ['CT suite', 'MRI suite', 'General X-ray', 'Radiation oncology', 'Interventional radiology'], tenants: ['obh', 'labimg', 'specialist', 'daysurg'], internet: 0, versions: ['6.0.2', '6.2.0'], siteByTenant: { obh: ['CT suite', 'MRI suite', 'General X-ray', 'Interventional radiology'], labimg: ['Science Park CT', 'Science Park MRI', 'Mammography'], specialist: ['Radiation oncology', 'Heart centre cath lab'], daysurg: ['Day surgery imaging room'] } },
    },
    supplierRe: /imaging|PACS|laborator|Philips|GE HealthCare|Siemens Healthineers|InterSystems|Synapxe|telehealth/i, supplierN: 4, outreach: 7,
  },
  studio: {
    cve: 'CVE-2026-43958', vendor: 'Quillon Media', product: 'Quillon StreamPort Transfer Server', family: 'Accelerated file transfer',
    weakness: 'Unauthenticated path traversal in the transfer web service', cvss: 9.9, kev: true, exploited: true, minAgo: 344,
    summary: 'A flaw in the transfer server’s web service lets an unauthenticated attacker read and overwrite files in any transfer share, including pre-release media. Extortion crews are using it against studios and VFX houses, and the MPA has issued a member alert. A fixed release is available.',
    verdict: 'Affected', phase: 'Active response', counts: { core: 6, tooling: 0, ot: 3 },
    versions: '5.0 to 5.8.1', fixedIn: '5.8.2',
    mitigation: 'Put the web service behind Cloudflare Zero Trust so VFX vendors keep access through named accounts, rotate the transfer service keys and ask HexaCustody to review pre-release transfers since disclosure.',
    remediation: ['Move the web service behind Cloudflare Zero Trust; ILM, Weta FX, DNEG and Northlight Pixel keep named-account access.', 'Upgrade to 5.8.2 and restart the transfer service (Jira change for Studios and Post; ServiceNow for Starfall+ and the resorts).', 'Rotate the S3 and service-account keys the server uses and revoke open share links.', 'Ask HexaCustody and NexGuard to review transfers of pre-release titles since disclosure; brief the SEC 8-K materiality group if content left.', 'For park show media servers, install the show-control vendor’s validated build at the next overnight maintenance; until then keep them inside the show DMZ.'],
    stems: {
      core: { kind: 'Transfer server node', code: 'XFER', sites: ['AWS us-west-2', 'Soho machine room', 'Burbank data centre'], tenants: ['studios', 'post', 'play', 'corp'], internet: 0.45, versions: ['5.6.0', '5.7.2', '5.8.1'], siteByTenant: { studios: ['AWS us-west-2', 'Burbank data centre'], post: ['Soho machine room', 'AWS eu-west-2'], play: ['AWS us-east-1'], corp: ['New York data centre'] } },
      ot: { kind: 'Show media server content loader', code: 'SHOWMS', sites: ['Show control room', 'Projection dome', 'Night spectacular control'], tenants: ['parks', 'parksasia'], internet: 0, versions: ['5.6.0'], siteByTenant: { parks: ['Show control room', 'Projection dome', 'Night spectacular control'], parksasia: ['Show control room', 'Projection dome'] } },
    },
    supplierRe: /VFX|Colour|Locali|Dubbing|Screener|Trailer|Mastering|Projection|Christie/i, supplierN: 5, outreach: 8,
  },
};

/** Host-name prefix per tenant, from each customer's own naming (template customers keep tenant-id codes). */
const HOST_CODE: CustomerMap<Record<string, string>> = {
  maritime: {}, finserv: {}, media: {}, healthcare: {}, automotive: {},
  insurance: { group: 'KMI', personal: 'KMI-PL', commercial: 'KMI-CL', claims: 'KMI-CC', life: 'KMI-LA', specialty: 'KMI-ES' },
  defence: { programs: 'SPD-CUI', engineering: 'SPD-ENG', manufacturing: 'B3', corporate: 'SPD', tucson: 'TUS' },
  pharma: { corporate: 'BSL', rnd: 'RND', clinops: 'DUB', valais: 'VLS', cork: 'CRK', commercial: 'RHN-US' },
  sghospital: { obh: 'OBH', specialist: 'SPC', daysurg: 'DSC', labimg: 'LAB', corp: 'OBH-CORP' },
  studio: { studios: 'SFE', post: 'POST', play: 'PLUS', parks: 'PARKS', parksasia: 'PARKS-OSA', corp: 'SFE-NY' },
};

/** Keep one internet-facing asset open on the headline advisory (only where the headline story is internet-facing). */
const KEEP_OPEN: CustomerMap<boolean> = {
  maritime: false, finserv: true, media: true, healthcare: false, automotive: false,
  insurance: true, defence: true, pharma: false, sghospital: false, studio: true,
};

/** Who applies fixes to OT assets (HexaView is read-only on OT). */
const OT_TEMPLATE_NOTE = 'OT is read-only by policy: HexaView tracks status; plant or terminal engineers apply the fix.';
const OT_NOTE: CustomerMap<string> = {
  maritime: OT_TEMPLATE_NOTE, finserv: OT_TEMPLATE_NOTE, media: OT_TEMPLATE_NOTE, healthcare: OT_TEMPLATE_NOTE, automotive: OT_TEMPLATE_NOTE,
  insurance: 'Facilities systems are read-only by policy: HexaView tracks status; data-centre facilities engineering applies the fix in a planned maintenance window.',
  defence: 'OT is read-only by policy: HexaView tracks status; Building 3 or Tucson engineers apply the fix at a planned machine stop.',
  pharma: 'Validated GMP system, read-only by policy: HexaView tracks status; site automation engineers apply the fix under GxP change control.',
  sghospital: 'Clinical device, read-only by policy: HexaView tracks status; Biomedical Engineering applies the OEM-validated fix.',
  studio: 'Ride and show systems are read-only by policy: HexaView tracks status; ride and show control engineers applythe fix outside park hours.',
};

/** One-line "who fixes it" for the OT asset drawer. */
const OT_TEMPLATE_FIXER = 'Plant or terminal engineers apply the fix in a maintenance window.';
const OT_FIXER: CustomerMap<string> = {
  maritime: OT_TEMPLATE_FIXER, finserv: OT_TEMPLATE_FIXER, media: OT_TEMPLATE_FIXER, healthcare: OT_TEMPLATE_FIXER, automotive: OT_TEMPLATE_FIXER,
  insurance: 'Data-centre facilities engineering applies the fix in a planned maintenance window.',
  defence: 'Building 3 or Tucson engineers apply the fix at a planned machine stop or range stand-down.',
  pharma: 'Site automation engineers apply the fix under GxP change control at a campaign changeover.',
  sghospital: 'Biomedical Engineering applies the OEM-validated fix (HSA GL-04) in a clinical downtime window.',
  studio: 'Ride and show control engineers apply the fix outside park hours, through the ride safety change process.',
};
export function vrOtFixer(c: CustomerProfile): string {
  return forCustomer(OT_FIXER, c);
}

const RECENT: CustomerMap<AdvSeed[]> = {
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
  insurance: [
    { cve: 'CVE-2026-41964', vendor: 'Pennant Labs', product: 'Pennant AgentGate Portal Server', family: 'Agent & broker portal gateway', weakness: 'Authorisation bypass in the quote API', cvss: 9.2, kev: false, exploited: false, minAgo: 4 * D + 180, verdict: 'Affected', phase: 'Monitoring', counts: { core: 3 }, summary: 'A missing authorisation check lets a signed-in agent retrieve quotes and policyholder details belonging to other agencies. Two AgentHub nodes are patched; the third is shielded by a Cloudflare API Shield rule until the month-end quote-and-bind freeze lifts.' },
    { cve: 'CVE-2026-40832', vendor: 'Holbrook Systems', product: 'Holbrook PrintStream Composer', family: 'Document composition (policy print)', weakness: 'Path traversal exposing templates and spool files', cvss: 9.0, kev: false, exploited: false, minAgo: 10 * D + 200, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Older composer builds expose document templates and print spool files to unauthenticated users. The Windsor print & mail plant runs 10.2, which is not affected; Broadridge confirmed its overflow site does not use the product.' },
    { cve: 'CVE-2026-42381', vendor: 'Larch Analytics', product: 'Larch Telematics Ingest Broker', family: 'Telematics data ingestion', weakness: 'Unsafe deserialisation in the ingest API', cvss: 9.4, kev: false, exploited: false, minAgo: 650, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 2, summary: 'The broker accepts crafted trip payloads that can run code on the server. Two hosts in the telematics data lake account respond like the product; a credentialed Qualys check is running and Cambridge Mobile Telematics has been asked which build feeds them.' },
    { cve: 'CVE-2026-39718', vendor: 'Tamsin Security', product: 'Tamsin LogForward collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 25 * D + 90, verdict: 'Affected', phase: 'Closed', counts: { tooling: 4 }, summary: 'Four collectors forwarding z/OS SMF and Guidewire logs into Splunk ran a vulnerable listener. All were upgraded within 30 hours and the NYDFS 500.6 audit-trail evidence was refreshed.' },
    { cve: 'CVE-2026-38227', vendor: 'Quarry Point', product: 'Quarry Point ClaimDesk Photo Intake', family: 'Claims photo upload service', weakness: 'Unauthenticated file upload', cvss: 9.1, kev: false, exploited: true, minAgo: 37 * D + 300, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Photo-intake servers used for first notice of loss accept unauthenticated uploads. Kingsbridge’s photo estimating runs through CCC, which confirmed its platform does not use the product.' },
  ],
  defence: [
    { cve: 'CVE-2026-41629', vendor: 'Corlis Machine Data', product: 'Corlis DNC Programme Server', family: 'DNC programme distribution', weakness: 'Missing authentication on the programme upload service', cvss: 9.6, kev: false, exploited: false, minAgo: 4 * D + 420, verdict: 'Affected', phase: 'Monitoring', counts: { core: 1, ot: 3 }, summary: 'The DNC server accepts programme uploads without authentication, so anyone on the shop-floor network could replace a CNC programme. The Building 3 server and two cell controllers are patched; the last cell is mitigated by a conduit rule until the weekend machine stop.' },
    { cve: 'CVE-2026-40514', vendor: 'Hollis Test Systems', product: 'Hollis TestExec ATE Runtime', family: 'Automated test executive', weakness: 'Unsafe handling of test sequence files', cvss: 9.0, kev: false, exploited: false, minAgo: 12 * D + 80, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Crafted sequence files can run code on test stations. Sentry Peak’s avionics ATE benches use an in-house test executive; confirmed against the Armis and HexaOT inventories for Building 3 and Tucson.' },
    { cve: 'CVE-2026-42947', vendor: 'Ravelin Data', product: 'Ravelin Telemetry Ground Station', family: 'Range telemetry processing', weakness: 'Command injection in the web console', cvss: 9.3, kev: false, exploited: false, minAgo: 600, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 2, summary: 'The ground-station console lets an unauthenticated user run system commands. Two Tucson range hosts respond like the product; Desert Sky Telemetry is confirming the build and HexaOT is fingerprinting passively.' },
    { cve: 'CVE-2026-39391', vendor: 'Ostler Software', product: 'Ostler SecureFile Exchange', family: 'Secure file exchange', weakness: 'Authentication bypass on shared links', cvss: 9.1, kev: true, exploited: true, minAgo: 26 * D + 150, verdict: 'Affected', phase: 'Closed', counts: { core: 2 }, stems: { core: { kind: 'File exchange node', code: 'SFX', sites: ['Huntsville data centre'], tenants: ['programs'], internet: 0.5, versions: ['3.2.0'] } }, summary: 'Shared links on the legacy file-exchange server could be opened without signing in. Both nodes were patched within 20 hours and retired in favour of PreVeil; the DFARS 7012 review found no CUI accessed.' },
    { cve: 'CVE-2026-38066', vendor: 'Brackley Software', product: 'Brackley PDM Vault', family: 'Engineering data vault (PDM)', weakness: 'Privilege escalation through the replication service', cvss: 9.0, kev: false, exploited: false, minAgo: 40 * D + 500, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'A flaw lets a low-privilege user take over vault administration. Sentry Peak’s PDM vault is a different product and ITAR technical data sits in Teamcenter; Cumberland Precision Machining confirmed it does not run the vault.' },
  ],
  pharma: [
    { cve: 'CVE-2026-41257', vendor: 'Aldwych Informatics', product: 'Aldwych LabView Reporting Client', family: 'LIMS web reporting client', weakness: 'Audit-trail bypass through the bulk-edit API', cvss: 9.1, kev: false, exploited: false, minAgo: 5 * D + 140, verdict: 'Affected', phase: 'Monitoring', counts: { core: 3 }, summary: 'A flaw lets a signed-in analyst change results through the bulk-edit API without an audit-trail entry. Basel and Cork are patched; Valais QC is mitigated by disabling bulk edit until the validated build clears CSV testing.' },
    { cve: 'CVE-2026-40149', vendor: 'Tolland Clinical', product: 'Tolland TrialGate RTSM Connector', family: 'Randomisation & supply connector', weakness: 'Insecure direct object reference on randomisation lists', cvss: 9.3, kev: false, exploited: false, minAgo: 11 * D + 420, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Older connector builds expose randomisation lists to any authenticated site user. Rhenara uses Medidata RTSM directly; Medidata, IQVIA and Parexel confirmed they do not run the connector.' },
    { cve: 'CVE-2026-42618', vendor: 'Brisco Serialisation', product: 'Brisco SerialLink Line Controller', family: 'Serialisation & aggregation (Level 3)', weakness: 'Missing authentication on the line-master API', cvss: 9.5, kev: false, exploited: false, minAgo: 590, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 3, summary: 'The line-master API accepts commissioning requests without authentication. Three Cork packaging-line servers expose a similar API; Dragos is fingerprinting them passively and Catalent has been asked about its overflow line.' },
    { cve: 'CVE-2026-39587', vendor: 'Fenmore', product: 'Fenmore EventShip collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 24 * D + 330, verdict: 'Affected', phase: 'Closed', counts: { tooling: 3 }, summary: 'Three collectors forwarding plant DMZ and SAP logs into Sentinel ran a vulnerable listener. All were upgraded within 28 hours and the Annex 11 audit-trail review evidence was refreshed.' },
    { cve: 'CVE-2026-38455', vendor: 'Quenby Bio', product: 'Quenby ELN Sync Service', family: 'Electronic lab notebook sync', weakness: 'Unauthenticated access to notebook exports', cvss: 9.0, kev: false, exploited: true, minAgo: 42 * D + 90, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'The sync service exposes notebook exports to unauthenticated requests. The Cambridge ELN uses a different sync path; WuXi AppTec confirmed it does not run the service.' },
  ],
  sghospital: [
    { cve: 'CVE-2026-41803', vendor: 'Ashcombe Health', product: 'Ashcombe ClinView Portal', family: 'Clinician web portal', weakness: 'Session reuse after single sign-on', cvss: 9.1, kev: false, exploited: false, minAgo: 4 * D + 260, verdict: 'Affected', phase: 'Monitoring', counts: { core: 3 }, summary: 'A session flaw lets an attacker reuse a clinician’s portal session after badge-tap sign-on. Two portal nodes are patched; the Tanglin node is restricted to the clinical VLAN until the TrakCare upgrade weekend.' },
    { cve: 'CVE-2026-40367', vendor: 'Harrowgate Systems', product: 'Harrowgate TubeNet Controller', family: 'Pneumatic tube system controller', weakness: 'Hard-coded maintenance credential', cvss: 9.0, kev: false, exploited: false, minAgo: 9 * D + 300, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Older tube-system controllers ship a fixed maintenance password. The Novena and Tanglin systems run the current generation; confirmed by Claroty and the vendor.' },
    { cve: 'CVE-2026-42513', vendor: 'Wynford Medical', product: 'Wynford DoseLib Sync', family: 'Infusion drug-library distribution', weakness: 'Unauthenticated drug-library change', cvss: 9.4, kev: false, exploited: false, minAgo: 620, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 2, summary: 'The sync service accepts drug-library changes without authentication. Two servers on the Novena clinical VLAN match the product family; Biomedical Engineering is checking with BD and Fresenius Kabi whether their pump servers embed it.' },
    { cve: 'CVE-2026-39824', vendor: 'Brightline Logix', product: 'Brightline LogShip collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 21 * D + 400, verdict: 'Affected', phase: 'Closed', counts: { tooling: 3 }, summary: 'Three collectors forwarding FortiGate and TrakCare audit logs into Sentinel ran a vulnerable listener. All were upgraded within 26 hours and the HIA CS/DS logging evidence was refreshed.' },
    { cve: 'CVE-2026-38519', vendor: 'Tamar Health', product: 'Tamar TeleConsult Bridge', family: 'Telehealth video gateway', weakness: 'Predictable meeting tokens', cvss: 9.0, kev: false, exploited: true, minAgo: 35 * D + 200, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Predictable tokens let an outsider join video consultations. Orchid Bay’s telehealth runs on CareLink, which confirmed the bridge is not in its stack.' },
  ],
  studio: [
    { cve: 'CVE-2026-41376', vendor: 'Thornbury Licensing', product: 'Thornbury FlexKey Licence Server', family: 'Floating licence server (VFX tools)', weakness: 'Remote code execution in the vendor daemon', cvss: 9.5, kev: false, exploited: false, minAgo: 5 * D + 30, verdict: 'Affected', phase: 'Monitoring', counts: { core: 3 }, summary: 'The licence server’s vendor daemon accepts crafted requests that run code on the host. London and Burbank are patched; the render-burst licence node is isolated on the content network until Lodestar batch 58 finishes rendering.' },
    { cve: 'CVE-2026-40698', vendor: 'Marston Ticketing', product: 'Marston GateFlow Turnstile Controller', family: 'Park turnstile & ticket gates', weakness: 'Hard-coded service credential', cvss: 9.1, kev: false, exploited: false, minAgo: 13 * D + 120, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Older turnstile controllers ship a fixed service password. The Orlando and Osaka gates run controllers from a different maker integrated with accesso; confirmed by Armis.' },
    { cve: 'CVE-2026-42736', vendor: 'Corbin Show Systems', product: 'Corbin CueMaster Show Controller', family: 'Show control system', weakness: 'Missing authentication on the cue API', cvss: 9.6, kev: false, exploited: false, minAgo: 560, verdict: 'Investigating', phase: 'Active response', counts: {}, candidates: 3, summary: 'The show controller accepts cue commands without authentication. Three Osaka show-control nodes expose a similar API; Claroty is fingerprinting them passively (read-only by policy) and ride & show engineering is checking with the integrator.' },
    { cve: 'CVE-2026-39264', vendor: 'Tamberlane', product: 'Tamberlane LogPipe collector', family: 'SIEM log collector (security tooling)', weakness: 'Remote code execution in the syslog listener', cvss: 9.8, kev: true, exploited: true, minAgo: 22 * D + 210, verdict: 'Affected', phase: 'Closed', counts: { tooling: 4 }, summary: 'Four collectors forwarding Soho content-network and resort firewall logs into Google SecOps and Splunk ran a vulnerable listener. All were upgraded within 22 hours; TPN and PCI logging evidence was refreshed.' },
    { cve: 'CVE-2026-38712', vendor: 'Ferrier Commerce', product: 'Ferrier CheckoutKit', family: 'Payment page script library', weakness: 'Script injection on hosted checkout pages', cvss: 9.0, kev: false, exploited: true, minAgo: 34 * D + 500, verdict: 'Not affected', phase: 'Closed', counts: {}, summary: 'Checkout pages built on the library can be injected with card-skimming script. Starfall+ and park retail checkouts use Adyen hosted fields, and Adyen confirmed the library is not in use; the PCI DSS 6.4.3 script inventory was updated.' },
  ],
};

/** Default stems for recent advisories, per sector and source. */
const DEFAULT_STEMS: CustomerMap<Partial<Record<VrAssetSource, Omit<Stem, 'kind'>>>> = {
  maritime: { core: { code: 'SRV', sites: ['Group DC Rotterdam', 'Azure West Europe'], tenants: ['hq', 'rtm'], internet: 0.1, versions: ['3.1.0'] }, tooling: { code: 'LOG', sites: ['Group DC Rotterdam', 'Maasvlakte DMZ', 'Antwerp DMZ'], internet: 0, versions: ['4.2.0'] }, ot: { code: 'VST', sites: ['Bridge network', 'Comms room'], tenants: ['fleet'], internet: 0, versions: ['3.1.4', '3.2.0'] } },
  finserv: { core: { code: 'PAY', sites: ['Slough DC1', 'Basildon DC2'], tenants: ['pay', 'ukbank'], internet: 0, versions: ['6.3.1'] }, tooling: { code: 'LOG', sites: ['Slough DC1', 'Basildon DC2', 'AWS eu-central-1'], internet: 0, versions: ['4.2.0'] } },
  media: { core: { code: 'RQM', sites: ['Soho machine room', 'AWS us-west-2'], tenants: ['post', 'studios'], internet: 0, versions: ['11.2'] }, tooling: { code: 'LOG', sites: ['Soho machine room', 'AWS us-west-2'], internet: 0, versions: ['4.2.0'] } },
  healthcare: { core: { code: 'PACS', sites: ['Columbus DC', 'Research data centre'], tenants: ['mrmc', 'research'], internet: 0.3, versions: ['8.0.4'] }, tooling: { code: 'LOG', sites: ['Columbus DC', 'Azure Central US'], internet: 0, versions: ['4.2.0'] } },
  automotive: { core: { code: 'MES', sites: ['Ingolstadt plant DMZ', 'Győr plant DMZ', 'Puebla server room'], tenants: ['ingolstadt', 'gyor', 'puebla'], internet: 0, versions: ['5.0.2'] }, tooling: { code: 'LOG', sites: ['Ingolstadt plant DMZ', 'Azure Germany West Central'], internet: 0, versions: ['4.2.0'] }, ot: { code: 'MESC', sites: ['Final assembly'], tenants: ['puebla', 'gyor'], internet: 0, versions: ['5.0.2'] } },
  // OT only where the customer has it: insurance facilities sit in `group`; defence Building 3 / Tucson; pharma Valais / Cork; hospital clinical sites; studio resorts.
  insurance: {
    core: { code: 'APP', sites: ['Azure East US 2'], tenants: ['personal', 'commercial', 'specialty'], internet: 0.3, versions: ['8.4.1'], siteByTenant: { personal: ['AWS us-east-1'], commercial: ['Azure East US 2'], specialty: ['Azure West US 3'] } },
    tooling: { code: 'LOG', sites: ['Windsor CT DC1'], tenants: ['group', 'personal', 'claims'], internet: 0, versions: ['4.2.0'], siteByTenant: { group: ['Windsor CT DC1', 'Phoenix DC2 (colo)'], personal: ['AWS us-east-1'], claims: ['Azure East US 2'] } },
    ot: { code: 'FAC', sites: ['Windsor DC1 data hall', 'Print & mail plant'], tenants: ['group'], internet: 0, versions: ['2.6.1'] },
  },
  defence: {
    core: { code: 'DNC', sites: ['Building 3 DNC server room'], tenants: ['manufacturing'], internet: 0, versions: ['4.1.2'] },
    tooling: { code: 'LOG', sites: ['Huntsville data centre'], tenants: ['programs', 'engineering', 'manufacturing'], internet: 0, versions: ['4.2.0'], siteByTenant: { programs: ['Azure Government (US Gov Virginia)'], engineering: ['Huntsville data centre'], manufacturing: ['Building 3 Level 3.5 DMZ'] } },
    ot: { code: 'CELL', sites: ['5-axis machining cell', 'Turning cell', 'Vertical mill cell'], tenants: ['manufacturing'], internet: 0, versions: ['4.1.0', '4.1.2'] },
  },
  pharma: {
    core: { code: 'LIMS', sites: ['QC laboratory'], tenants: ['corporate', 'cork', 'valais'], internet: 0, versions: ['11.3.2'], siteByTenant: { corporate: ['Basel QC laboratory'], cork: ['Ringaskiddy QC laboratory'], valais: ['Sierre QC laboratory'] } },
    tooling: { code: 'LOG', sites: ['Azure Switzerland North'], tenants: ['corporate', 'valais', 'cork'], internet: 0, versions: ['4.2.0'], siteByTenant: { corporate: ['Azure Switzerland North', 'Basel data centre'], valais: ['Sierre plant DMZ (Level 3.5)'], cork: ['Ringaskiddy plant DMZ (Level 3.5)'] } },
    ot: { code: 'SER', sites: ['Serialisation & aggregation'], tenants: ['cork'], internet: 0, versions: ['3.2.1'] },
  },
  sghospital: {
    core: { code: 'PRT', sites: ['Novena campus DC'], tenants: ['obh', 'specialist'], internet: 0.2, versions: ['6.1.4'], siteByTenant: { obh: ['Novena campus DC', 'Tai Seng DR site'], specialist: ['Tanglin server room'] } },
    tooling: { code: 'LOG', sites: ['Novena campus DC'], tenants: ['obh', 'corp'], internet: 0, versions: ['4.2.0'], siteByTenant: { obh: ['Novena campus DC'], corp: ['Azure Southeast Asia'] } },
    ot: { code: 'MED', sites: ['Clinical VLAN'], tenants: ['obh', 'specialist', 'daysurg'], internet: 0, versions: ['2.4.0'], siteByTenant: { obh: ['ICU', 'Emergency department'], specialist: ['Heart centre'], daysurg: ['Day surgery theatres'] } },
  },
  studio: {
    core: { code: 'LIC', sites: ['Soho machine room'], tenants: ['post', 'studios'], internet: 0, versions: ['11.18.2'], siteByTenant: { post: ['Soho machine room', 'AWS eu-west-2 (render burst)'], studios: ['Burbank data centre'] } },
    tooling: { code: 'LOG', sites: ['Soho machine room'], tenants: ['post', 'play', 'parks', 'parksasia'], internet: 0, versions: ['4.2.0'], siteByTenant: { post: ['Soho machine room'], play: ['AWS us-east-1'], parks: ['Orlando resort data centre'], parksasia: ['Osaka resort operations centre'] } },
    ot: { code: 'SHOW', sites: ['Show control room'], tenants: ['parks', 'parksasia'], internet: 0, versions: ['2.9.0'] },
  },
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
  const seeds = [forCustomer(HEADLINE, c), ...forCustomer(RECENT, c)];
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
      const def = forCustomer(DEFAULT_STEMS, c)[src];
      const stem: Stem | undefined = s.stems?.[src] ?? (def ? { kind: `${a.family.replace(/ \(security tooling\)/, '')} ${src === 'ot' ? 'controller' : 'host'}`, ...def } : undefined);
      if (!stem) return;
      const tenantPool: Tenant[] = c.tenants.filter((t) => (stem.tenants ? stem.tenants.includes(t.id) : src === 'ot' ? t.env.includes('ot') : true));
      const pool = tenantPool.length ? tenantPool : c.tenants;
      const own = owners(c, src);
      for (let i = 0; i < n; i++) {
        const t = pool[i % pool.length];
        const site = c.dataKey === 'maritime' && t.id === 'fleet' ? ar.pick(VESSELS) : `${t.short} · ${ar.pick(stem.siteByTenant?.[t.id] ?? stem.sites)}`;
        const code = forCustomer(HOST_CODE, c)[t.id] ?? t.id.slice(0, 3).toUpperCase();
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
          note: airGapped ? 'Air-gapped plant: evidence arrives by offline import from the sealed HexaOT store.' : src === 'ot' ? forCustomer(OT_NOTE, c) : undefined,
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
      // Keep exactly one internet-facing asset open on the live advisory where the headline is internet-facing (the urgent story).
      const keepOpen = a.headline && x.internet && i === order.findIndex((o) => o.internet && o.source !== 'ot') && forCustomer(KEEP_OPEN, c);
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
