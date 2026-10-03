// HexaSOC (Managed SOC / MDR) data generation. Pure, seeded functions so every
// customer and tenant gets stable, sector-specific data that agrees with the
// headline numbers in core.ts.
import type { Connector, CustomerId, CustomerProfile, Health, Severity } from '../types';
import { rng } from '../../lib/rng';
import { headlines } from '../core';
import { scopedConnectors, scopedTenants, tenantShare, scale } from '../customers';
import { TACTICS, TECHNIQUES, ICS_TECHNIQUES, ATLAS_TECHNIQUES, TECHNIQUE_BY_ID, type Technique } from '../reference';
import { FULL_TECHNIQUES, FULL_BY_ID, parentId, type FullTechnique } from '../attackFull';

/* =====================================================================
   Tools
   ===================================================================== */
const SHORT: Record<string, string> = {
  'c-sentinel': 'Sentinel', 'c-defender': 'Defender XDR', 'c-entra': 'Entra ID', 'c-okta': 'Okta', 'c-splunk': 'Splunk ES',
  'c-crowdstrike': 'CrowdStrike Falcon', 'c-secops': 'Google SecOps', 'c-s1': 'SentinelOne', 'c-proofpoint': 'Proofpoint',
  'c-gws': 'Google Workspace', 'c-dragos': 'Dragos', 'c-hexaot': 'HexaOT', 'c-zscaler': 'Zscaler', 'c-netskope': 'Netskope',
  'c-cloudflare': 'Cloudflare', 'c-paloalto': 'Palo Alto NGFW', 'c-syslog-fleet': 'Vessel firewalls (CEF)', 'c-cyberark': 'CyberArk',
  'c-mainframe': 'z/OS RACF', 'c-swift': 'SWIFT Alliance', 'c-hexacustody': 'HexaCustody', 'c-awssh': 'AWS Security Hub', 'c-wiz': 'Wiz',
  'c-mdc': 'Defender for Cloud', 'c-prisma': 'Prisma Cloud', 'c-facilities': 'EcoStruxure BMS', 'c-servicenow': 'ServiceNow',
  'c-jira': 'Jira SM', 'c-hexaint': 'HexaInt', 'c-tenable': 'Tenable', 'c-qualys': 'Qualys',
  'c-qradar': 'QRadar', 'c-upstream': 'Upstream vSOC', 'c-armis': 'Armis Centrix', 'c-claroty': 'Claroty xDome', 'c-imprivata': 'Imprivata OneSign',
  'c-fairwarning': 'FairWarning', 'c-mimecast': 'Mimecast', 'c-beyondtrust': 'BeyondTrust PRA', 'c-insightvm': 'InsightVM', 'c-sap': 'SAP ETD',
  'c-epic': 'Epic Clarity', 'c-cohesity': 'Cohesity', 'c-rubrik': 'Rubrik', 'c-ghas': 'GitHub Advanced Security', 'c-scorecard': 'SecurityScorecard',
};
export function toolShort(k: Connector): string {
  return SHORT[k.id] ?? k.product;
}
export function toolById(c: CustomerProfile, id: string): Connector | undefined {
  return c.connectors.find((k) => k.id === id);
}

export type QL = 'KQL' | 'SPL' | 'YARA-L' | 'AQL';
export interface SocTools {
  siem: Connector;
  edr?: Connector;
  idps: Connector[];
  email?: Connector;
  net: Connector[];
  ot: Connector[];
  ql: QL;
  qlLong: string;
  siemShort: string;
  edrShort: string;
  idpShort: string;
}

export function socTools(c: CustomerProfile, tenantId = 'all'): SocTools {
  const ks = scopedConnectors(c, tenantId);
  const siem = (c.connectors.find((k) => k.category === 'SIEM' && k.id !== 'c-upstream') ?? c.connectors.find((k) => k.category === 'SIEM')) as Connector;
  const edr = ks.find((k) => k.category === 'EDR / XDR');
  const idps = ks.filter((k) => k.id === 'c-entra' || k.id === 'c-okta');
  const email = ks.find((k) => k.category === 'Email' && k.id !== 'c-knowbe4');
  const net = ks.filter((k) => k.category === 'Network' || k.category === 'SASE' || k.category === 'DLP');
  const ot = ks.filter((k) => k.category === 'OT');
  const ql: QL = siem.id === 'c-sentinel' ? 'KQL' : siem.id === 'c-splunk' ? 'SPL' : siem.id === 'c-qradar' ? 'AQL' : 'YARA-L';
  const qlLong = ql === 'KQL' ? 'Kusto Query Language (Sentinel)' : ql === 'SPL' ? 'Splunk Search Processing Language' : ql === 'AQL' ? 'Ariel Query Language (QRadar)' : 'YARA-L 2.0 (Google SecOps)';
  return {
    siem, edr, idps, email, net, ot, ql, qlLong,
    siemShort: toolShort(siem),
    edrShort: edr ? toolShort(edr) : 'EDR',
    idpShort: idps.map(toolShort).join(' / ') || 'IdP',
  };
}

/** Customer-facing tool line for page intros, e.g. "Sentinel, Defender XDR and Entra ID". */
export function toolLine(c: CustomerProfile, tenantId: string, extra: string[] = []): string {
  const t = socTools(c, tenantId);
  const names = [t.siemShort, ...(t.edr ? [t.edrShort] : []), ...t.idps.map(toolShort), ...(t.email ? [toolShort(t.email)] : []), ...extra];
  const uniq = Array.from(new Set(names));
  return uniq.length > 1 ? `${uniq.slice(0, -1).join(', ')} and ${uniq[uniq.length - 1]}` : uniq[0];
}

export const HEXASOC_ANALYSTS = ['Nadia Petrov (L3)', 'Callum Reid (L2)', 'Aiko Tanaka (L3)', 'Mateus Silva (L2)', 'Hannah Weiss (IR lead)', 'Omar Farouk (L2)', 'Freya Lund (DFIR)'];
const VESSELS = ['Halcyon Aurora', 'Halcyon Borealis', 'Halcyon Meridian', 'Halcyon Tradewind', 'Halcyon Solstice', 'Halcyon Zephyr'];

export function fmtBytes(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
}

/* =====================================================================
   Incidents
   ===================================================================== */
export type IncStatus = 'new' | 'triage' | 'investigating' | 'containing' | 'recovering' | 'closed';
export type Disposition = 'True positive' | 'Benign true positive' | 'False positive' | 'Undetermined';

export interface Incident {
  id: string;
  title: string;
  sev: Severity;
  status: IncStatus;
  tenantId: string;
  assignee: string;
  techniques: string[];
  sources: string[];
  /** Minutes since the incident was opened. */
  openedMin: number;
  /** Open: minutes open. Closed: minutes from open to close. */
  durationMin: number;
  closedMin?: number;
  disposition?: Disposition;
  hosts: string[];
  users: string[];
  iocs: string[];
  ot: boolean;
  personal: boolean;
  card: boolean;
  leak: boolean;
  playbook: string;
  actor?: string;
  ttaMin: number;
  alerts: number;
}

interface IncTpl {
  title: string;
  sev: Severity[];
  tech: string[];
  src: string[];
  tenants?: string[];
  ot?: boolean;
  personal?: boolean;
  card?: boolean;
  leak?: boolean;
  host?: string;
  playbook: string;
  actor?: number;
}

const INC_TPL: Record<CustomerId, IncTpl[]> = {
  maritime: [
    { title: 'Unauthorised program download to STS crane PLC ({ot})', sev: ['critical', 'high'], tech: ['T0843', 'T0821'], src: ['c-dragos', 'c-hexaot', 'c-sentinel'], tenants: ['rtm', 'ant'], ot: true, playbook: 'OT: unauthorised controller change', actor: 0 },
    { title: 'Shadow copy deletion on HPS-SAP-PRD (ransomware precursor)', sev: ['critical', 'high'], tech: ['T1490', 'T1486'], src: ['c-defender', 'c-sentinel'], tenants: ['hq'], host: 'HPS-SAP-PRD', playbook: 'Ransomware: pre-encryption', actor: 2 },
    { title: 'Encoded PowerShell on RTM-TOS-APP02 (Navis N4 app tier)', sev: ['high', 'critical'], tech: ['T1059.001', 'T1027'], src: ['c-defender', 'c-sentinel'], tenants: ['rtm'], host: 'RTM-TOS-APP02', playbook: 'Endpoint: suspicious script' },
    { title: 'Konecranes remote session outside approved window via HPS-JUMP-OT01', sev: ['high', 'medium'], tech: ['T1133', 'T0886'], src: ['c-cyberark', 'c-paloalto', 'c-sentinel'], tenants: ['rtm', 'ant', 'pkl'], host: 'HPS-JUMP-OT01', ot: true, playbook: 'Vendor remote access breach' },
    { title: 'Password spray against vpn.halcyonports.com from residential proxies', sev: ['high', 'medium'], tech: ['T1110.003', 'T1090.003'], src: ['c-entra', 'c-paloalto', 'c-sentinel'], tenants: ['hq'], playbook: 'Identity: password spray', actor: 1 },
    { title: 'MFA fatigue: repeated push denials for {vip}', sev: ['high', 'medium'], tech: ['T1621', 'T1078'], src: ['c-entra', 'c-sentinel'], tenants: ['hq', 'rtm'], playbook: 'Identity: MFA fatigue' },
    { title: 'GNSS position jump and AIS/ECDIS mismatch on {vessel}', sev: ['high', 'medium'], tech: ['T0832', 'T0855'], src: ['c-hexaot', 'c-syslog-fleet'], tenants: ['fleet'], ot: true, playbook: 'Vessel: navigation integrity' },
    { title: 'Unknown USB device on engine-room workstation, {vessel}', sev: ['medium', 'high'], tech: ['T0847', 'T1204.002'], src: ['c-hexaot', 'c-syslog-fleet'], tenants: ['fleet'], ot: true, playbook: 'Vessel: removable media' },
    { title: 'Phishing: fake bill of lading attachment opened by {user}', sev: ['medium', 'high'], tech: ['T1566.001', 'T1204.002'], src: ['c-proofpoint', 'c-defender', 'c-sentinel'], tenants: ['hq', 'rtm', 'ant', 'pkl', 'sts'], playbook: 'Phishing: malicious attachment' },
    { title: 'Kerberoasting from PKL-ENG-WS03 against SAP service accounts', sev: ['high', 'medium'], tech: ['T1558.003', 'T1087.002'], src: ['c-defender', 'c-sentinel'], tenants: ['pkl'], host: 'PKL-ENG-WS03', playbook: 'AD: credential theft', actor: 5 },
    { title: 'Beaconing from Santos SCADA HMI segment to a rare domain', sev: ['high', 'medium'], tech: ['T1071.001', 'T1572'], src: ['c-hexaot', 'c-paloalto', 'c-sentinel'], tenants: ['sts'], host: 'STS-SCADA-HMI2', ot: true, playbook: 'Network: C2 beaconing' },
    { title: 'BEC: payment redirection request to the Finance Controller', sev: ['high', 'medium'], tech: ['T1657', 'T1566.002'], src: ['c-proofpoint', 'c-entra', 'c-sentinel'], tenants: ['hq'], personal: true, playbook: 'BEC: payment fraud' },
    { title: 'Web shell indicators on booking.halcyonports.com', sev: ['high', 'critical'], tech: ['T1505.003', 'T1190'], src: ['c-defender', 'c-wiz', 'c-sentinel'], tenants: ['hq'], playbook: 'Web: compromised application', actor: 5 },
    { title: 'Unexpected Modbus write to AGV fleet controller', sev: ['high', 'medium'], tech: ['T0855', 'T0836'], src: ['c-dragos', 'c-sentinel'], tenants: ['rtm'], host: 'RTM-AGV-CTRL', ot: true, playbook: 'OT: unauthorised command' },
    { title: 'Customs manifest EDI anomaly on the Portbase interface', sev: ['medium', 'low'], tech: ['T1565.001'], src: ['c-sentinel'], tenants: ['rtm', 'hq'], playbook: 'Data integrity: manifest' },
    { title: 'Defender tamper protection disabled on {host}', sev: ['medium'], tech: ['T1562.001'], src: ['c-defender', 'c-sentinel'], tenants: ['hq', 'ant', 'pkl', 'sts'], playbook: 'Endpoint: defence evasion' },
    { title: 'Impossible travel: {user} signed in from Lagos and Rotterdam', sev: ['medium', 'low'], tech: ['T1078'], src: ['c-entra', 'c-sentinel'], tenants: ['hq', 'rtm', 'ant'], personal: true, playbook: 'Identity: suspicious sign-in' },
    { title: 'Gate OCR lane controller scanning the Level 2 network', sev: ['medium', 'low'], tech: ['T0846', 'T1046'], src: ['c-dragos', 'c-hexaot'], tenants: ['rtm', 'ant'], ot: true, playbook: 'OT: discovery activity' },
    { title: 'VSAT terminal admin login from unknown IP, {vessel}', sev: ['medium', 'high'], tech: ['T1133', 'T0886'], src: ['c-syslog-fleet', 'c-hexaot'], tenants: ['fleet'], ot: true, playbook: 'Vessel: remote access' },
  ],
  finserv: [
    { title: 'Help-desk social engineering: MFA reset for a Tier 0 admin requested by phone', sev: ['critical', 'high'], tech: ['T1078', 'T1098'], src: ['c-okta', 'c-servicenow', 'c-splunk'], tenants: ['ukbank', 'markets'], playbook: 'Identity: help-desk social engineering', actor: 2 },
    { title: 'SWIFT Alliance operator login outside business hours', sev: ['critical', 'high'], tech: ['T1078', 'T1021.001'], src: ['c-swift', 'c-cyberark', 'c-splunk'], tenants: ['ukbank', 'pay'], host: 'ALD-SWIFT-AA01', playbook: 'Payments: SWIFT secure zone', actor: 0 },
    { title: 'Outbound connection to Lazarus-linked infrastructure from the PAY-HSM-GW01 segment', sev: ['critical', 'high'], tech: ['T1071.001'], src: ['c-crowdstrike', 'c-zscaler', 'c-splunk'], tenants: ['pay'], host: 'PAY-HSM-GW01', card: true, playbook: 'Network: C2 beaconing', actor: 0 },
    { title: 'MFA fatigue: 23 Okta Verify pushes to {user} in 9 minutes', sev: ['high', 'medium'], tech: ['T1621', 'T1078'], src: ['c-okta', 'c-splunk'], playbook: 'Identity: MFA fatigue', actor: 2 },
    { title: 'BEC: supplier bank-detail change request to Treasury Operations', sev: ['high', 'medium'], tech: ['T1657', 'T1566.002'], src: ['c-proofpoint', 'c-splunk'], tenants: ['ukbank', 'eu', 'pay'], personal: true, playbook: 'BEC: payment fraud' },
    { title: 'Kerberoasting against the ALD-SQL-LEND service account', sev: ['high', 'medium'], tech: ['T1558.003'], src: ['c-crowdstrike', 'c-splunk'], tenants: ['ukbank'], host: 'ALD-SQL-LEND', playbook: 'AD: credential theft' },
    { title: 'LSASS memory access on ALD-CTX-SF04 (Citrix)', sev: ['high', 'critical'], tech: ['T1003.001'], src: ['c-crowdstrike', 'c-splunk'], tenants: ['ukbank', 'eu'], host: 'ALD-CTX-SF04', playbook: 'Endpoint: credential dumping', actor: 3 },
    { title: 'RACF SPECIAL attribute granted outside change window on z/OS', sev: ['high', 'medium'], tech: ['T1098'], src: ['c-mainframe', 'c-servicenow', 'c-splunk'], tenants: ['ukbank', 'pay'], host: 'ALD-ZOS-PRD1', playbook: 'Mainframe: privileged change' },
    { title: 'DNS tunnelling pattern from the cardholder data environment', sev: ['high', 'critical'], tech: ['T1048.003', 'T1572'], src: ['c-zscaler', 'c-crowdstrike', 'c-splunk'], tenants: ['pay'], card: true, personal: true, playbook: 'Data exfiltration: CDE' },
    { title: 'Illicit OAuth consent: app requested Mail.Read for {user}', sev: ['medium', 'high'], tech: ['T1550.001', 'T1114.002'], src: ['c-entra', 'c-splunk'], personal: true, playbook: 'Cloud: illicit consent grant' },
    { title: 'Session token replay for {user} from a new ASN', sev: ['medium', 'high'], tech: ['T1539', 'T1078'], src: ['c-okta', 'c-zscaler', 'c-splunk'], tenants: ['markets', 'ukbank', 'wealth'], playbook: 'Identity: session hijack', actor: 2 },
    { title: 'MOVEit-style exploitation attempts against managed file transfer', sev: ['high', 'medium'], tech: ['T1190'], src: ['c-zscaler', 'c-splunk'], tenants: ['ukbank', 'eu'], playbook: 'Web: exploitation attempt', actor: 5 },
    { title: 'Client portfolio export uploaded to personal cloud storage', sev: ['medium', 'high'], tech: ['T1567.002'], src: ['c-netskope', 'c-splunk'], tenants: ['wealth', 'markets'], personal: true, playbook: 'DLP: data exfiltration' },
    { title: 'AWS root user API activity in ald-eu-prod', sev: ['high', 'medium'], tech: ['T1078', 'T1136.003'], src: ['c-awssh', 'c-splunk'], tenants: ['eu'], playbook: 'Cloud: privileged misuse' },
    { title: 'Rundll32 loading an unsigned DLL on the equities trading desk', sev: ['medium', 'high'], tech: ['T1218.011'], src: ['c-crowdstrike', 'c-splunk'], tenants: ['markets'], host: 'MKT-OMS-PRD', playbook: 'Endpoint: defence evasion', actor: 1 },
    { title: 'Password spray against online.aldersgate.co.uk', sev: ['medium', 'low'], tech: ['T1110.003'], src: ['c-okta', 'c-splunk'], tenants: ['ukbank'], playbook: 'Identity: password spray' },
    { title: 'Falcon sensor uninstall attempt on {host}', sev: ['medium'], tech: ['T1562.001'], src: ['c-crowdstrike', 'c-splunk'], playbook: 'Endpoint: defence evasion' },
    { title: 'Mass mailbox search via eDiscovery by a non-legal user', sev: ['medium', 'low'], tech: ['T1114.002'], src: ['c-entra', 'c-splunk'], tenants: ['ukbank', 'eu'], personal: true, playbook: 'Insider: data collection' },
    { title: 'Privileged role assigned in Entra ID outside PIM', sev: ['medium', 'low'], tech: ['T1098'], src: ['c-entra', 'c-splunk'], playbook: 'Identity: privilege change' },
  ],
  media: [
    { title: 'Pre-release cut uploaded to personal cloud from an edit bay ({title})', sev: ['critical', 'high'], tech: ['T1567.002', 'T1560.001'], src: ['c-hexacustody', 'c-netskope', 'c-secops'], tenants: ['post', 'studios'], leak: true, playbook: 'Content leak: exfiltration', actor: 4 },
    { title: 'Watermark match: {title} frames posted to a leak forum', sev: ['critical', 'high'], tech: ['T1567.002', 'T1041'], src: ['c-hexaint', 'c-hexacustody', 'c-secops'], tenants: ['studios', 'post'], leak: true, playbook: 'Content leak: external sighting', actor: 4 },
    { title: 'ESXi encryptor indicators on the render farm hypervisor', sev: ['critical', 'high'], tech: ['T1486', 'T1490'], src: ['c-s1', 'c-secops'], tenants: ['post'], host: 'POST-RENDER-MGR', playbook: 'Ransomware: pre-encryption', actor: 3 },
    { title: 'Help-desk social engineering: Okta MFA reset for a VFX supervisor', sev: ['high', 'critical'], tech: ['T1078', 'T1098'], src: ['c-okta', 'c-jira', 'c-secops'], tenants: ['post', 'studios'], playbook: 'Identity: help-desk social engineering', actor: 1 },
    { title: 'Screener link opened from 14 countries in 2 hours', sev: ['high', 'medium'], tech: ['T1213', 'T1539'], src: ['c-cloudflare', 'c-secops'], tenants: ['studios'], leak: true, playbook: 'Content leak: screener abuse' },
    { title: 'Red Fern Localisation bulk download from aspera.kestrelpictures.com', sev: ['high', 'medium'], tech: ['T1199', 'T1530'], src: ['c-hexacustody', 'c-cloudflare', 'c-secops'], tenants: ['studios', 'post'], leak: true, playbook: 'Vendor: abnormal access' },
    { title: 'Credential stuffing against KestrelPlay sign-in', sev: ['high', 'medium'], tech: ['T1110.003'], src: ['c-cloudflare', 'c-secops'], tenants: ['play'], personal: true, playbook: 'Identity: credential stuffing', actor: 0 },
    { title: 'Unexpected script change on the KestrelPlay payment page', sev: ['high', 'critical'], tech: ['T1059.003', 'T1190'], src: ['c-cloudflare', 'c-secops'], tenants: ['play'], card: true, personal: true, playbook: 'Web: client-side skimming' },
    { title: 'MFA fatigue on a talent services account ({user})', sev: ['medium', 'high'], tech: ['T1621'], src: ['c-okta', 'c-secops'], tenants: ['studios'], playbook: 'Identity: MFA fatigue', actor: 2 },
    { title: 'Phishing: fake casting call attachment opened by {user}', sev: ['medium', 'low'], tech: ['T1566.001', 'T1204.002'], src: ['c-gws', 'c-s1', 'c-secops'], tenants: ['studios', 'play', 'live'], playbook: 'Phishing: malicious attachment' },
    { title: 'Script folder shared externally from Google Drive', sev: ['medium', 'low'], tech: ['T1213', 'T1567.002'], src: ['c-gws', 'c-netskope', 'c-secops'], tenants: ['studios'], leak: true, playbook: 'DLP: external sharing' },
    { title: 'Grass Valley remote support session without a ticket', sev: ['medium', 'high'], tech: ['T1219', 'T0886'], src: ['c-hexaot', 'c-secops'], tenants: ['live'], host: 'LIVE-PLAYOUT-A', ot: true, playbook: 'Vendor remote access breach' },
    { title: 'PTP grandmaster offset spike on LIVE-PTP-GM01', sev: ['medium', 'low'], tech: ['T0814'], src: ['c-hexaot'], tenants: ['live'], host: 'LIVE-PTP-GM01', ot: true, playbook: 'Broadcast: timing integrity' },
    { title: 'SentinelOne agent disabled on {host}', sev: ['medium'], tech: ['T1562.001'], src: ['c-s1', 'c-secops'], playbook: 'Endpoint: defence evasion' },
    { title: 'Public-read policy applied to kpg-content-vault prefix', sev: ['high', 'medium'], tech: ['T1530'], src: ['c-awssh', 'c-wiz', 'c-secops'], tenants: ['studios'], leak: true, playbook: 'Cloud: storage exposure' },
    { title: 'Impossible travel: freelance colourist signed in from Lagos and London', sev: ['low', 'medium'], tech: ['T1078'], src: ['c-okta', 'c-secops'], tenants: ['post'], playbook: 'Identity: suspicious sign-in' },
  ],
  healthcare: [
    { title: 'Help-desk MFA reset for a nurse manager followed by Epic Hyperspace sign-in from a new ASN', sev: ['critical', 'high'], tech: ['T1078', 'T1098', 'T1621'], src: ['c-entra', 'c-servicenow', 'c-sentinel'], tenants: ['mrmc', 'kids'], personal: true, playbook: 'Identity: help-desk social engineering', actor: 3 },
    { title: 'Rhysida precursors on MRH-CITRIX-SF03 (Epic Citrix StoreFront): AnyDesk + shadow copy deletion', sev: ['critical', 'high'], tech: ['T1219', 'T1490', 'T1486'], src: ['c-crowdstrike', 'c-sentinel'], tenants: ['mrmc'], host: 'MRH-CITRIX-SF03', personal: true, playbook: 'Ransomware: pre-encryption', actor: 0 },
    { title: 'Citrix NetScaler session hijack attempts (CVE-2023-4966 pattern) on citrix.mercyridgehealth.org', sev: ['high', 'critical'], tech: ['T1190', 'T1539'], src: ['c-sentinel', 'c-crowdstrike'], tenants: ['mrmc', 'clinics'], playbook: 'Web: exploitation attempt', actor: 5 },
    { title: 'Unexpected drug-library push to BD Alaris infusion pumps from a non-biomed host', sev: ['high', 'critical'], tech: ['T0843', 'T0836'], src: ['c-claroty', 'c-sentinel'], tenants: ['mrmc', 'kids'], host: 'MRH-ALARIS-SRV', ot: true, playbook: 'Medical device: unauthorised change' },
    { title: 'GE HealthCare remote service session to CT scanner outside the biomed work order', sev: ['high', 'medium'], tech: ['T1133', 'T0886'], src: ['c-cyberark', 'c-claroty', 'c-sentinel'], tenants: ['mrmc', 'kids'], ot: true, playbook: 'Vendor remote access breach' },
    { title: 'FairWarning: VIP patient record opened by {user} without a care relationship', sev: ['high', 'medium'], tech: ['T1213', 'T1078'], src: ['c-fairwarning', 'c-epic', 'c-sentinel'], tenants: ['mrmc', 'kids', 'community'], personal: true, playbook: 'Privacy: inappropriate EHR access' },
    { title: 'Payroll diversion: direct-deposit change for {user} after Workday sign-in from a proxy', sev: ['high', 'medium'], tech: ['T1657', 'T1078'], src: ['c-entra', 'c-mimecast', 'c-sentinel'], personal: true, playbook: 'BEC: payroll diversion', actor: 3 },
    { title: 'Genomics bucket mrri-genomics bulk download to an unmanaged device', sev: ['high', 'medium'], tech: ['T1530', 'T1567.002'], src: ['c-awssh', 'c-hexacustody', 'c-sentinel'], tenants: ['research'], personal: true, playbook: 'Data exfiltration: research data' },
    { title: 'Phishing: fake Epic MyChart password reset opened by {user}', sev: ['medium', 'high'], tech: ['T1566.002', 'T1204.002'], src: ['c-mimecast', 'c-crowdstrike', 'c-sentinel'], playbook: 'Phishing: credential harvest' },
    { title: 'Kerberoasting from a shared clinical workstation against Epic Interconnect service accounts', sev: ['high', 'medium'], tech: ['T1558.003', 'T1087.002'], src: ['c-crowdstrike', 'c-sentinel'], tenants: ['mrmc', 'community'], playbook: 'AD: credential theft', actor: 1 },
    { title: 'Philips IntelliVue gateway talking to an external IP from the clinical VLAN', sev: ['medium', 'high'], tech: ['T1071.001', 'T0883'], src: ['c-claroty', 'c-sentinel'], tenants: ['mrmc', 'kids'], ot: true, playbook: 'Medical device: unexpected egress' },
    { title: 'Imprivata badge-tap session reused on two nursing stations 40 km apart', sev: ['medium', 'low'], tech: ['T1078', 'T1550.001'], src: ['c-imprivata', 'c-sentinel'], tenants: ['mrmc', 'community'], playbook: 'Identity: suspicious sign-in' },
    { title: 'Falcon sensor removed from radiology reading workstation {host}', sev: ['medium'], tech: ['T1562.001'], src: ['c-crowdstrike', 'c-sentinel'], tenants: ['mrmc', 'kids', 'community'], playbook: 'Endpoint: defence evasion' },
    { title: 'Windows 7 imaging workstation (Siemens MAGNETOM console) scanning the PACS subnet', sev: ['medium', 'low'], tech: ['T0846', 'T1046'], src: ['c-hexaot', 'c-claroty'], tenants: ['community', 'mrmc'], ot: true, playbook: 'Medical device: discovery activity' },
    { title: 'Password spray against vpn.mercyridgehealth.org from residential proxies', sev: ['medium', 'high'], tech: ['T1110.003', 'T1090.003'], src: ['c-entra', 'c-sentinel'], tenants: ['mrmc', 'clinics'], playbook: 'Identity: password spray', actor: 4 },
    { title: 'Telehealth API returning other patients’ appointments (BOLA probe)', sev: ['medium', 'high'], tech: ['T1190', 'T1213'], src: ['c-mdc', 'c-sentinel'], tenants: ['clinics'], personal: true, playbook: 'Web: API abuse' },
    { title: 'Omnicell cabinet admin login from an unregistered workstation', sev: ['low', 'medium'], tech: ['T1078'], src: ['c-cyberark', 'c-sentinel'], tenants: ['mrmc', 'kids'], ot: true, playbook: 'Medical device: privileged access' },
    { title: 'Mass mailbox rule forwarding PHI to an external address for {user}', sev: ['medium', 'high'], tech: ['T1114.003', 'T1567.002'], src: ['c-entra', 'c-mimecast', 'c-sentinel'], personal: true, playbook: 'BEC: mailbox compromise' },
  ],
  automotive: [
    { title: 'Black Basta precursors at Plant Ingolstadt: Cobalt Strike beacon on ING-MES-PRD01 and vssadmin delete', sev: ['critical', 'high'], tech: ['T1071.001', 'T1490', 'T1486'], src: ['c-defender', 'c-qradar'], tenants: ['ingolstadt'], host: 'ING-MES-PRD01', playbook: 'Ransomware: plant pre-encryption', actor: 1 },
    { title: 'Unauthorised program download to press-line PLC ({ot}) from ING-PLC-ENG04', sev: ['critical', 'high'], tech: ['T0843', 'T0821'], src: ['c-armis', 'c-qradar'], tenants: ['ingolstadt', 'gyor'], host: 'ING-PLC-ENG04', ot: true, playbook: 'OT: unauthorised controller change' },
    { title: 'OTA signing HSM operator credential used from a supplier network (VMG-OTA-SIGN01)', sev: ['critical', 'high'], tech: ['T1078', 'T1195.002'], src: ['c-entra', 'c-hexacustody', 'c-qradar'], tenants: ['connected', 'group'], host: 'VMG-OTA-SIGN01', playbook: 'Vehicle: OTA signing integrity', actor: 0 },
    { title: 'Vehicle API abuse: 41,000 remote-unlock calls from rotating tokens on api.vireoconnect.com', sev: ['high', 'critical'], tech: ['T1190', 'T1550.001'], src: ['c-upstream', 'c-wiz', 'c-qradar'], tenants: ['connected'], personal: true, playbook: 'Vehicle: backend API abuse' },
    { title: 'KUKA remote service session to a body-shop robot cell outside the approved window', sev: ['high', 'medium'], tech: ['T1133', 'T0886'], src: ['c-beyondtrust', 'c-armis', 'c-qradar'], tenants: ['ingolstadt', 'gyor', 'puebla'], ot: true, playbook: 'Vendor remote access breach' },
    { title: 'Help-desk MFA reset for a Teamcenter admin requested by phone (Scattered Spider pattern)', sev: ['high', 'medium'], tech: ['T1078', 'T1098', 'T1621'], src: ['c-entra', 'c-servicenow', 'c-qradar'], tenants: ['group'], playbook: 'Identity: help-desk social engineering', actor: 3 },
    { title: 'Project Lumen design renders synced to personal cloud from the Munich design studio', sev: ['high', 'medium'], tech: ['T1567.002', 'T1213'], src: ['c-zscaler', 'c-hexacustody', 'c-qradar'], tenants: ['group'], leak: true, playbook: 'IP leak: design exfiltration', actor: 0 },
    { title: 'SAP supplier-master bank details changed outside a change record', sev: ['high', 'medium'], tech: ['T1565.001', 'T1657'], src: ['c-sap', 'c-qradar'], tenants: ['group', 'ingolstadt', 'gyor'], playbook: 'Fraud: supplier bank change' },
    { title: 'Dealer DMS credential stuffing against dealer.vireo-motors.com', sev: ['medium', 'high'], tech: ['T1110.004', 'T1078'], src: ['c-zscaler', 'c-qradar'], tenants: ['retail'], personal: true, playbook: 'Identity: credential stuffing', actor: 4 },
    { title: 'Puebla MES host reaching the internet directly, bypassing the Level 3.5 DMZ', sev: ['high', 'medium'], tech: ['T1071.001', 'T1572'], src: ['c-armis', 'c-qradar'], tenants: ['puebla'], host: 'PUE-MES-APP02', ot: true, playbook: 'Network: IT/OT conduit breach' },
    { title: 'Volt Typhoon-style LOTL on plant domain controllers (ntdsutil, netsh portproxy)', sev: ['high', 'medium'], tech: ['T1003.003', 'T1090.001', 'T1047'], src: ['c-defender', 'c-qradar'], tenants: ['gyor', 'ingolstadt'], playbook: 'AD: living off the land', actor: 5 },
    { title: 'Phishing: fake supplier PPAP portal attachment opened by {user}', sev: ['medium', 'high'], tech: ['T1566.001', 'T1204.002'], src: ['c-proofpoint', 'c-defender', 'c-qradar'], playbook: 'Phishing: malicious attachment' },
    { title: 'Vehicle SOC: CAN anomaly cluster on 312 vehicles after third-party OBD dongle install', sev: ['medium', 'high'], tech: ['T0855', 'T0830'], src: ['c-upstream'], tenants: ['connected'], playbook: 'Vehicle: fleet anomaly' },
    { title: 'GitHub secret scanning: AWS key for vireo-ota-backend pushed to a public fork', sev: ['high', 'medium'], tech: ['T1552.001', 'T1078.004'], src: ['c-ghas', 'c-wiz', 'c-qradar'], tenants: ['connected', 'group'], playbook: 'Cloud: exposed secret' },
    { title: 'Air-gapped battery plant bundle shows new USB device on a formation-rack HMI', sev: ['medium', 'low'], tech: ['T0847', 'T1091'], src: ['c-hexaot'], tenants: ['battery'], ot: true, playbook: 'OT: removable media' },
    { title: 'Defender tamper protection disabled on {host}', sev: ['medium'], tech: ['T1562.001'], src: ['c-defender', 'c-qradar'], tenants: ['group', 'ingolstadt', 'gyor', 'puebla', 'retail'], playbook: 'Endpoint: defence evasion' },
    { title: 'AGV fleet controller receiving Modbus writes from an office VLAN', sev: ['medium', 'low'], tech: ['T0855', 'T0836'], src: ['c-armis', 'c-qradar'], tenants: ['gyor', 'puebla'], ot: true, playbook: 'OT: unauthorised command' },
    { title: 'Impossible travel: {user} signed in from Shenzhen and Munich within 2 h', sev: ['low', 'medium'], tech: ['T1078'], src: ['c-entra', 'c-qradar'], tenants: ['group', 'retail'], playbook: 'Identity: suspicious sign-in' },
  ],
};

const OT_TARGET: Record<CustomerId, string[]> = {
  maritime: ['RTM-STS-14', 'RTM-STS-09', 'ANT-STS-03', 'ANT-STS-07'],
  finserv: ['DC-CRAH-04', 'DC-UPS-B2'],
  media: ['LIVE-PLAYOUT-A', 'LIVE-PTP-GM01'],
  healthcare: ['ICU-PUMP-0412', 'NICU-MON-07'],
  automotive: ['ING-PRESS-S7-03', 'ING-PRESS-S7-07', 'GYR-EDRIVE-S7-11'],
};

function fill(s: string, c: CustomerProfile, r: ReturnType<typeof rng>, ctx: { host: string; user: string; vip: string }): string {
  return s
    .replace('{host}', ctx.host)
    .replace('{user}', ctx.user)
    .replace('{vip}', ctx.vip)
    .replace('{vessel}', r.pick(VESSELS))
    .replace('{ot}', r.pick(OT_TARGET[c.id]))
    .replace('{title}', r.pick(c.vocab.custodyItems).split(' – ')[0]);
}

function weightedTenant(c: CustomerProfile, allowed: string[], r: ReturnType<typeof rng>): string {
  const ts = c.tenants.filter((t) => allowed.includes(t.id));
  return r.weighted(ts.map((t) => [t.id, t.people * t.criticality] as const));
}

const ORDER_SEV: Severity[] = ['critical', 'high', 'medium', 'low'];

/** Exactly headlines.soc.openIncidents open incidents, plus recently closed ones for the range. */
export function incidents(c: CustomerProfile, tenantId: string, days: number): Incident[] {
  const h = headlines(c, tenantId).soc;
  const r = rng(`soc-incidents-${c.id}-${tenantId}`);
  const share = tenantShare(c, tenantId);
  const tenantIds = scopedTenants(c, tenantId).map((t) => t.id);
  const tpls = INC_TPL[c.id].filter((t) => !t.tenants || t.tenants.some((x) => tenantIds.includes(x)));
  const allowedFor = (t: IncTpl) => (t.tenants ?? c.tenants.map((x) => x.id)).filter((x) => tenantIds.includes(x));
  const staffUsers = c.people.staff;
  const vips = staffUsers.filter((p) => p.vip);
  const year = new Date().getFullYear();
  let seq = r.int(1200, 1800);

  const sevs: Severity[] = [];
  for (let i = 0; i < h.critical; i++) sevs.push('critical');
  for (let i = 0; i < h.high; i++) sevs.push('high');
  const rest = Math.max(0, h.openIncidents - sevs.length);
  for (let i = 0; i < rest; i++) sevs.push(i < Math.ceil(rest * 0.62) ? 'medium' : 'low');

  const make = (sev: Severity, open: boolean): Incident => {
    const cands = tpls.filter((t) => t.sev.includes(sev));
    const tpl = r.pick(cands.length ? cands : tpls);
    const tid = weightedTenant(c, allowedFor(tpl), r);
    const host = tpl.host ?? (tpl.ot ? r.pick(c.vocab.otSystems) : r.pick(c.vocab.servers));
    const user = r.pick(staffUsers);
    const vip = r.pick(vips.length ? vips : staffUsers);
    const title = fill(tpl.title, c, r, { host, user: user.name, vip: vip.name });
    const srcs = tpl.src.filter((id) => {
      const k = toolById(c, id);
      return k && (k.tenants === 'all' || k.tenants.includes(tid));
    });
    const sources = (srcs.length ? srcs : [socTools(c).siem.id]).map((id) => toolShort(toolById(c, id) as Connector));
    const hosts = Array.from(new Set([host, ...(r.chance(0.5) ? [r.pick(c.vocab.servers)] : [])]));
    const users = title.includes(user.name) ? [user.name] : title.includes(vip.name) ? [vip.name] : r.chance(0.6) ? [r.pick(staffUsers).name] : [];
    const iocs = [
      `${r.pick([185, 45, 91, 103, 194, 141])}.${r.int(10, 250)}.${r.int(1, 250)}.${r.int(2, 250)}`,
      ...(r.chance(0.6) ? [`${c.vocab.lookalikeBase}-${r.pick(['secure', 'sso', 'portal', 'docs', 'verify'])}[.]${r.pick(['com', 'net', 'co', 'io'])}`] : []),
      ...(r.chance(0.5) ? [`sha256:${r.hex(12)}…`] : []),
    ];
    const tta = sev === 'critical' ? r.int(1, 4) : sev === 'high' ? r.int(2, 9) : r.int(4, 24);
    let status: IncStatus;
    let openedMin: number;
    let durationMin: number;
    let closedMin: number | undefined;
    let disposition: Disposition | undefined;
    if (open) {
      status = sev === 'critical' ? r.pick<IncStatus>(['containing', 'investigating']) : r.weighted<IncStatus>([['new', 1], ['triage', 2], ['investigating', 4], ['containing', 2], ['recovering', 1.5]]);
      openedMin = sev === 'critical' ? r.int(35, 280) : sev === 'high' ? r.int(50, 1900) : r.int(120, 5600);
      durationMin = openedMin;
    } else {
      status = 'closed';
      durationMin = sev === 'critical' ? r.int(28, 160) : sev === 'high' ? r.int(30, 600) : r.int(40, 2400);
      closedMin = r.int(30, Math.max(60, days * 1440 - 60));
      openedMin = closedMin + durationMin;
      disposition = r.weighted<Disposition>([['True positive', 6], ['Benign true positive', 3], ['False positive', 1.4], ['Undetermined', 0.5]]);
    }
    return {
      id: `HSOC-${year}-${String(seq++).padStart(4, '0')}`,
      title, sev, status, tenantId: tid,
      assignee: status === 'new' ? 'HexaSOC Triage agent' : r.chance(0.14) ? c.people.socLead.name : r.pick(HEXASOC_ANALYSTS),
      techniques: tpl.tech, sources, openedMin, durationMin, closedMin, disposition,
      hosts, users, iocs, ot: !!tpl.ot, personal: !!tpl.personal, card: !!tpl.card, leak: !!tpl.leak,
      playbook: tpl.playbook,
      actor: tpl.actor !== undefined ? c.vocab.threatActors[tpl.actor] : undefined,
      ttaMin: tta,
      alerts: r.int(sev === 'critical' ? 8 : 2, sev === 'critical' ? 46 : 22),
    };
  };

  const open = sevs.map((s) => make(s, true));
  const closedBase = days <= 1 ? 6 : days <= 7 ? 25 : days <= 30 ? 48 : 96;
  const closedN = Math.max(3, scale(closedBase, Math.sqrt(share)));
  const closed: Incident[] = [];
  for (let i = 0; i < closedN; i++) closed.push(make(r.weighted<Severity>([['critical', 0.5], ['high', 3], ['medium', 6], ['low', 4]]), false));
  open.sort((a, b) => ORDER_SEV.indexOf(a.sev) - ORDER_SEV.indexOf(b.sev) || a.openedMin - b.openedMin);
  closed.sort((a, b) => (a.closedMin ?? 0) - (b.closedMin ?? 0));
  return [...open, ...closed];
}

export interface IncidentEvent {
  min: number;
  title: string;
  body: string;
  kind: 'detect' | 'agent' | 'analyst' | 'action' | 'customer' | 'close';
}

export function incidentTimeline(c: CustomerProfile, inc: Incident): IncidentEvent[] {
  const r = rng(`soc-tl-${inc.id}-${c.id}`);
  const t0 = inc.openedMin;
  const ev: IncidentEvent[] = [];
  ev.push({ min: t0 + r.int(2, 9), title: `First signal from ${inc.sources[0]}`, body: `${inc.alerts} correlated alerts · ${inc.techniques.join(', ')}`, kind: 'detect' });
  ev.push({ min: t0, title: 'HexaSOC Triage agent opened the incident', body: `Grouped alerts, scored ${inc.sev}, matched playbook "${inc.playbook}"`, kind: 'agent' });
  ev.push({ min: t0 - 1, title: 'Enrichment agent added context', body: `HexaInt reputation, asset criticality from CMDB, ${inc.users.length ? `identity risk for ${inc.users[0]}` : 'owner lookup'}${inc.actor ? `, overlap with ${inc.actor} tradecraft` : ''}`, kind: 'agent' });
  ev.push({ min: t0 - inc.ttaMin, title: `Acknowledged by ${inc.assignee === 'HexaSOC Triage agent' ? 'HexaSOC on-shift analyst' : inc.assignee}`, body: `Time to acknowledge ${inc.ttaMin} min`, kind: 'analyst' });
  const elapsed = inc.status === 'closed' ? inc.durationMin : inc.openedMin;
  if (elapsed > 20) ev.push({ min: t0 - Math.round(elapsed * 0.25), title: `Customer notified: ${c.people.socLead.name}`, body: 'Via ServiceNow / Teams bridge with the incident summary and next steps', kind: 'customer' });
  if (inc.status !== 'new' && inc.status !== 'triage' && elapsed > 30) {
    ev.push({
      min: t0 - Math.round(elapsed * 0.4),
      title: inc.ot ? 'OT engineer engaged (read-only monitoring, no automated action)' : `Containment requested via ${inc.sources[0]}`,
      body: inc.ot ? 'Site OT lead confirmed process safe; vendor access suspended at the PAM jump host by site staff' : 'Write-back approved by the tenant admin; HexaView audit ledger entry anchored',
      kind: 'action',
    });
  }
  if (inc.status === 'recovering' || inc.status === 'closed') ev.push({ min: t0 - Math.round(elapsed * 0.7), title: 'Root cause confirmed', body: r.pick(['Initial access via valid account without phishing-resistant MFA', 'Vendor credential reused outside approved window', 'User executed attachment; EDR blocked the second stage', 'Misconfiguration introduced in last change window']), kind: 'analyst' });
  if (inc.status === 'closed') ev.push({ min: inc.closedMin ?? 0, title: `Closed as ${inc.disposition}`, body: 'Lessons learned logged; detection tuning ticket raised with Detection Engineering', kind: 'close' });
  return ev.sort((a, b) => b.min - a.min);
}

/* =====================================================================
   Regulatory clocks
   ===================================================================== */
export interface RegClock {
  name: string;
  regulator: string;
  deadlineMin: number;
  elapsedMin: number;
  basis: string;
  filed: boolean;
}

const DPA: Record<string, string> = { NL: 'Autoriteit Persoonsgegevens', BE: 'APD/GBA', LU: 'CNPD', GB: 'ICO', DE: 'BayLDA (Bavaria)', ES: 'AEPD', HU: 'NAIH', EU: 'Lead DPA (BayLDA)' };
const NIS2_AUTH: Record<string, string> = { NL: 'NCSC-NL (CSIRT)', BE: 'CCB (Belgium)', LU: 'ILR / CSSF', DE: 'BSI', HU: 'NKI (Hungary)' };

export function regClocks(c: CustomerProfile, inc: Incident): RegClock[] {
  if (inc.sev !== 'critical' && inc.sev !== 'high') return [];
  const t = c.tenants.find((x) => x.id === inc.tenantId);
  if (!t) return [];
  const filed = inc.status === 'closed';
  const el = filed ? inc.durationMin : inc.openedMin;
  const out: RegClock[] = [];
  const add = (name: string, regulator: string, deadlineMin: number, basis: string) => out.push({ name, regulator, deadlineMin, elapsedMin: el, basis, filed: filed || el > deadlineMin * 1.6 });
  const rg = t.regimes;
  if (rg.includes('DORA')) {
    add('DORA initial notification', 'CSSF', 240, 'Art. 19 · within 4 h of classification as major (max 24 h of detection)');
    add('DORA intermediate report', 'CSSF', 72 * 60, 'Art. 19 · within 72 h of the initial notification');
    add('DORA final report', 'CSSF', 30 * 1440, 'Art. 19 · within 1 month of the intermediate report');
  } else if (rg.includes('NIS2')) {
    add('NIS2 early warning', NIS2_AUTH[t.country] ?? 'National CSIRT', 24 * 60, 'Art. 23(4)(a) · significant incident, 24 h');
    add('NIS2 incident notification', NIS2_AUTH[t.country] ?? 'National CSIRT', 72 * 60, 'Art. 23(4)(b) · 72 h');
    add('NIS2 final report', NIS2_AUTH[t.country] ?? 'National CSIRT', 30 * 1440, 'Art. 23(4)(d) · 1 month');
  }
  if (inc.personal && DPA[t.country]) add('GDPR breach notification', DPA[t.country], 72 * 60, `${t.country === 'GB' ? 'UK GDPR' : 'GDPR'} Art. 33 · 72 h of awareness`);
  if (inc.personal && rg.includes('LGPD')) add('LGPD breach notice', 'ANPD', 3 * 1440, 'Resolution 15/2024 · 3 business days');
  if (rg.includes('NYDFS 500')) add('NYDFS cybersecurity event notice', 'NYDFS', 72 * 60, '23 NYCRR 500.17 · 72 h');
  if (rg.includes('MAS TRM')) add('MAS incident notification', 'Monetary Authority of Singapore', 60, 'MAS Notice 655 / TRM · within 1 h of discovery');
  if (rg.includes('FCA/PRA Op Res') && inc.sev === 'critical') add('FCA / PRA notification', 'FCA & PRA', 24 * 60, 'PRIN 11 · SUP 15.3 · without undue delay');
  if (rg.includes('PSD2')) add('PSD2 major incident initial report', 'FCA', 240, 'PSRs reg. 99 · EBA guidelines, 4 h of classification');
  if (inc.card) add('Card brand notification', 'Acquirer / card brands', 24 * 60, 'PCI DSS 12.10 · brand rules, 24 h');
  if (rg.includes('ISPS')) add('ISPS security incident report', 'PFSO → port authority', 24 * 60, 'ISPS Code A/16 · port facility security plan');
  if (t.id === 'fleet') {
    add('Flag state & DPA notification', 'Flag administration (via DPA)', 24 * 60, 'IMO MSC.428(98) · ISM Code SMS');
    add('USCG NRC report (if in US waters)', 'US Coast Guard NRC', 12 * 60, '33 CFR 101.305 · without delay');
  }
  if (c.id === 'media' && inc.sev === 'critical') add('SEC Form 8-K Item 1.05', 'SEC (after materiality determination)', 4 * 1440, '4 business days from materiality determination');
  if (inc.personal && rg.includes('HIPAA')) {
    add('HIPAA breach notification', 'HHS Office for Civil Rights', 60 * 1440, '45 CFR 164.408 · without unreasonable delay, max 60 days');
    add('Ohio breach notice to residents', 'Ohio Attorney General', 45 * 1440, 'ORC 1349.19 · 45 days');
  }
  if (c.id === 'healthcare' && inc.sev === 'critical') add('Health-ISAC / HHS HC3 voluntary report', 'HHS HC3 · CISA', 72 * 60, 'CIRCIA (pending) · HPH CPG incident reporting');
  if (c.id === 'automotive' && (t.id === 'connected' || inc.title.includes('OTA'))) add('Type-approval authority notification', 'KBA (Kraftfahrt-Bundesamt)', 7 * 1440, 'UNECE R155 7.4 · CSMS monitoring report, without undue delay');
  if (inc.leak) add('Licensor / studio notification', 'Content owners (contractual)', 24 * 60, 'Distribution & co-production agreements · MPA CSBP');
  return out;
}

/* =====================================================================
   MDR overview
   ===================================================================== */
export interface MdrData {
  alerts: number;
  autoClosed: number;
  autoFp: number;
  escalated: number;
  analystClosed: number;
  incidents: number;
  bySource: { name: string; status: Health; value: number }[];
  buckets: string[];
  series: { name: string; data: number[] }[];
  disposition: { name: Disposition; value: number }[];
  tactics: { name: string; value: number }[];
  assets: { name: string; alerts: number; crown: boolean; sev: Severity }[];
  users: { name: string; role: string; alerts: number; vip: boolean }[];
  watched: { name: string; category: string; status: Health; lastSyncMin: number; intervalMin: number; eps: number; note?: string; coverage: number }[];
  agents: { name: string; role: string; count: number; unit: string; detail: string }[];
  agentFeed: { agent: string; text: string; min: number }[];
  mttTrend: { mttd: number[]; mtta: number[]; mttr: number[] };
}

function bucketLabels(days: number): string[] {
  const now = new Date();
  if (days <= 1) return Array.from({ length: 24 }, (_, i) => `${String((now.getHours() - 23 + i + 48) % 24).padStart(2, '0')}:00`);
  const n = days <= 7 ? 7 : days <= 30 ? 30 : 13;
  const step = days <= 30 ? 1 : 7;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getTime() - (n - 1 - i) * step * 86400000);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
}

const TACTIC_SKEW: Record<CustomerId, Record<string, number>> = {
  maritime: { 'Initial Access': 1.4, 'Lateral Movement': 1.2, Discovery: 1.3, Impact: 1.1, 'Command and Control': 1.2 },
  finserv: { 'Credential Access': 1.6, 'Initial Access': 1.4, Persistence: 1.2, Impact: 1.1, 'Privilege Escalation': 1.2 },
  media: { Exfiltration: 1.8, Collection: 1.6, 'Initial Access': 1.3, 'Credential Access': 1.2 },
  healthcare: { 'Initial Access': 1.6, 'Credential Access': 1.5, Impact: 1.3, Collection: 1.2, 'Lateral Movement': 1.1 },
  automotive: { 'Initial Access': 1.4, 'Lateral Movement': 1.3, Exfiltration: 1.4, Impact: 1.2, 'Command and Control': 1.3, Discovery: 1.2 },
};

export function mdrData(c: CustomerProfile, tenantId: string, days: number): MdrData {
  const h = headlines(c, tenantId).soc;
  const r = rng(`soc-mdr-${c.id}-${tenantId}-${days}`);
  const tools = socTools(c, tenantId);
  const alerts = Math.round(h.alerts24h * days * (days > 1 ? r.float(0.93, 1.05, 2) : 1));
  const autoClosed = Math.round((alerts * h.autoTriagedPct) / 100);
  const autoFp = Math.round(autoClosed * 0.38);
  const escalated = alerts - autoClosed;
  const incidentsN = Math.max(h.openIncidents, Math.round(escalated * 0.045));
  const analystClosed = escalated - incidentsN;

  const srcConns: Connector[] = [tools.siem, ...(tools.edr ? [tools.edr] : []), ...tools.idps, ...(tools.email ? [tools.email] : []), ...tools.net.slice(0, 2), ...tools.ot];
  const weights = srcConns.map((k) => (k.category === 'SIEM' ? 2.2 : k.category === 'EDR / XDR' ? 3 : k.category === 'Identity' ? 2 : k.category === 'OT' ? 1.6 : 1.2) * r.float(0.7, 1.3, 2));
  const wsum = weights.reduce((s, x) => s + x, 0);
  const bySource = srcConns.map((k, i) => ({ name: toolShort(k), status: k.status, value: Math.round((alerts * weights[i]) / wsum) }));
  const buckets = bucketLabels(days);
  const series = bySource.map((s) => {
    const per = s.value / buckets.length;
    return { name: s.name, data: buckets.map((_, i) => Math.max(0, Math.round(per * (days <= 1 ? 0.65 + 0.55 * Math.sin(((i - 6) / 24) * Math.PI * 2) ** 2 : 1) * r.float(0.7, 1.35, 2)))) };
  });

  const disposition: { name: Disposition; value: number }[] = [
    { name: 'True positive', value: Math.round(escalated * 0.21) },
    { name: 'Benign true positive', value: Math.round(escalated * 0.34) },
    { name: 'False positive', value: Math.round(escalated * 0.39) },
    { name: 'Undetermined', value: Math.round(escalated * 0.06) },
  ];

  const skew = TACTIC_SKEW[c.id];
  const tactics = TACTICS.map((t) => ({ name: t.short, value: Math.round(escalated * 0.08 * (skew[t.name] ?? 0.8) * r.float(0.6, 1.4, 2)) }));

  const crown = new Set([c.vocab.servers[2], c.vocab.servers[3], c.vocab.servers[6]]);
  const assets = r.pickN(c.vocab.servers, 8).map((s) => ({ name: s, alerts: Math.round(escalated * r.float(0.02, 0.09, 3)), crown: crown.has(s) || r.chance(0.2), sev: r.weighted<Severity>([['critical', 1], ['high', 3], ['medium', 4], ['low', 2]]) })).sort((a, b) => b.alerts - a.alerts);
  const ppl = [c.people.board, ...c.people.staff];
  const users = r.pickN(ppl, 8).map((p) => ({ name: p.name, role: p.role, alerts: Math.round(escalated * r.float(0.01, 0.06, 3) * (p.vip ? 1.6 : 1)), vip: !!p.vip })).sort((a, b) => b.alerts - a.alerts);

  const watched = [tools.siem, ...(tools.edr ? [tools.edr] : []), ...tools.idps, ...(tools.email ? [tools.email] : []), ...tools.net, ...tools.ot].map((k) => ({
    name: `${k.vendor === 'Generic' ? '' : `${k.vendor} `}${k.product}`,
    category: k.category,
    status: k.status,
    lastSyncMin: k.lastSyncMin,
    intervalMin: k.intervalMin,
    eps: Math.round((k.records / 60) * r.float(0.4, 1.6, 2) * tenantShare(c, tenantId)),
    note: k.note,
    coverage: k.status === 'healthy' ? r.int(94, 100) : r.int(71, 88),
  }));

  const agents = [
    { name: 'Triage agent', role: 'Groups, de-duplicates and scores every alert', count: autoClosed, unit: 'alerts auto-closed', detail: `${h.autoTriagedPct}% of volume, every verdict explained and sampled by analysts` },
    { name: 'Enrichment agent', role: 'Adds intel, asset and identity context', count: Math.round(alerts * 1.35), unit: 'enrichments', detail: 'HexaInt reputation, CMDB criticality, identity risk, prior incidents' },
    { name: 'Response agent', role: 'Proposes containment; humans approve', count: Math.max(2, Math.round(incidentsN * 1.7)), unit: 'actions proposed', detail: '100% human-approved before write-back (LLD 8.2)' },
    { name: 'Watch agent', role: 'VIP, crown-jewel and vendor watchlists', count: Math.round(alerts * 0.06), unit: 'watch hits', detail: `${ppl.filter((p) => p.vip).length} VIPs, ${c.vocab.crownJewels.length} crown jewels, ${c.thirdParties.filter((t) => t.tier === 1).length} tier-1 vendors` },
  ];
  const feedTpl: [string, string][] = [
    ['Triage agent', `Closed ${r.int(30, 140)} duplicate ${tools.edrShort} alerts on ${r.pick(c.vocab.servers)} (same parent process, known patch job)`],
    ['Enrichment agent', `Tagged ${r.pick(c.vocab.servers)} as crown jewel (${r.pick(c.vocab.crownJewels)}) and raised priority`],
    ['Watch agent', `VIP watch: new device sign-in for ${r.pick(c.people.staff.filter((p) => p.vip)).name} verified by phone`],
    ['Response agent', `Proposed session revocation in ${tools.idpShort}; awaiting ${c.people.admin.name}`],
    ['Triage agent', `Suppressed ${r.int(12, 60)} ${tools.siemShort} alerts from an approved vulnerability scan window`],
    ['Enrichment agent', `Matched IOC to ${r.pick(c.vocab.threatActors)} infrastructure (HexaInt, confidence high)`],
    ['Watch agent', `Vendor watch: ${r.pick(c.thirdParties).name} session started inside the approved window`],
  ];
  const agentFeed = feedTpl.map(([agent, text], i) => ({ agent, text, min: i * r.int(3, 11) + r.int(1, 4) }));

  const trend = (end: number, startMul: number) => {
    const out: number[] = [];
    let v = end * startMul;
    for (let i = 0; i < 29; i++) {
      v += (end - v) / (29 - i) + (r() - 0.5) * end * 0.18;
      out.push(Math.max(1, Math.round(v * 10) / 10));
    }
    out.push(end);
    return out;
  };
  return {
    alerts, autoClosed, autoFp, escalated, analystClosed, incidents: incidentsN, bySource, buckets, series, disposition, tactics, assets, users, watched, agents, agentFeed,
    mttTrend: { mttd: trend(h.mttdMin, 1.5), mtta: trend(h.mttaMin, 1.4), mttr: trend(h.mttrMin, 1.35) },
  };
}

/* =====================================================================
   Query library (rule bodies and hunt queries in the customer's language)
   ===================================================================== */
type QSet = { kql: string; spl: string; yl: string };
const Q: Record<string, QSet> = {
  T1621: {
    kql: `SigninLogs
| where TimeGenerated > ago(1h)
| where ResultType in (500121, 50074)   // MFA denied or not completed
| summarize Denied = count(), IPs = dcount(IPAddress), Apps = make_set(AppDisplayName, 5)
    by UserPrincipalName, bin(TimeGenerated, 10m)
| where Denied >= 5
| join kind=leftouter (IdentityInfo | project UserPrincipalName = AccountUPN, Department, IsVip = Tags has "VIP") on UserPrincipalName`,
    spl: `index=okta sourcetype="OktaIM2:log" eventType="system.push.send_factor_verify_push" OR outcome.result="REJECTED"
| bin _time span=10m
| stats count(eval(outcome.result="REJECTED")) as denied dc(client.ipAddress) as ips by actor.alternateId _time
| where denied >= 5
| lookup vip_watchlist user AS actor.alternateId OUTPUT is_vip`,
    yl: `rule hv_mfa_push_fatigue {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1621"
    severity = "HIGH"
  events:
    $e.metadata.product_name = "Okta"
    $e.metadata.product_event_type = "system.push.send_factor_verify_push"
    $e.security_result.action = "BLOCK"
    $e.target.user.email_addresses = $user
  match:
    $user over 10m
  condition:
    #e >= 5
}`,
  },
  'T1110.003': {
    kql: `SigninLogs
| where TimeGenerated > ago(1h)
| where ResultType in (50126, 50053, 50055)
| summarize Users = dcount(UserPrincipalName), Attempts = count() by IPAddress, AutonomousSystemNumber, bin(TimeGenerated, 15m)
| where Users >= 20 and Attempts / Users < 3
| extend ProxyType = iff(AutonomousSystemNumber in (residential_asn_list), "residential proxy", "hosting")`,
    spl: `index=okta eventType="user.session.start" outcome.result=FAILURE
| bin _time span=15m
| stats dc(actor.alternateId) as users count as attempts by client.ipAddress client.geographicalContext.country _time
| where users >= 20 AND attempts/users < 3`,
    yl: `rule hv_password_spray {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1110.003"
  events:
    $e.metadata.event_type = "USER_LOGIN"
    $e.security_result.action = "BLOCK"
    $e.principal.ip = $ip
    $e.target.user.userid = $u
  match:
    $ip over 15m
  outcome:
    $users = count_distinct($u)
  condition:
    $e and $users >= 20
}`,
  },
  'T1059.001': {
    kql: `DeviceProcessEvents
| where TimeGenerated > ago(24h)
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where ProcessCommandLine has_any ("-enc", "-EncodedCommand", "FromBase64String", "IEX", "DownloadString")
| where InitiatingProcessFileName !in~ ("ccmexec.exe", "SenseIR.exe")
| project TimeGenerated, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName`,
    spl: `index=crowdstrike event_simpleName=ProcessRollup2 (FileName=powershell.exe OR FileName=pwsh.exe)
  (CommandLine="*-enc*" OR CommandLine="*FromBase64String*" OR CommandLine="*IEX*")
| where NOT ParentBaseFileName IN ("ccmexec.exe")
| table _time ComputerName UserName CommandLine ParentBaseFileName`,
    yl: `rule hv_encoded_powershell {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1059.001"
  events:
    $p.metadata.event_type = "PROCESS_LAUNCH"
    re.regex($p.target.process.file.full_path, \`(?i)\\\\(powershell|pwsh)\\.exe$\`)
    re.regex($p.target.process.command_line, \`(?i)(-enc|frombase64string|iex)\`)
  condition:
    $p
}`,
  },
  'T1003.001': {
    kql: `DeviceEvents
| where ActionType == "OpenProcessApiCall"
| where FileName =~ "lsass.exe"
| extend Access = tostring(parse_json(AdditionalFields).DesiredAccess)
| where Access in ("0x1010", "0x1410", "0x1fffff")
| where InitiatingProcessFileName !in~ ("MsMpEng.exe", "csrss.exe", "wininit.exe")`,
    spl: `index=crowdstrike event_simpleName=ProcessAccess TargetFileName="*\\\\lsass.exe"
  GrantedAccess IN ("0x1010","0x1410","0x1fffff")
| where NOT ImageFileName IN ("*\\\\MsMpEng.exe","*\\\\csrss.exe")
| stats count by ComputerName ImageFileName GrantedAccess`,
    yl: `rule hv_lsass_access {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1003.001"
  events:
    $e.metadata.event_type = "PROCESS_OPEN"
    $e.target.process.file.full_path = /lsass\\.exe$/ nocase
    not $e.principal.process.file.full_path = /(MsMpEng|csrss)\\.exe$/ nocase
  condition:
    $e
}`,
  },
  'T1558.003': {
    kql: `SecurityEvent
| where EventID == 4769
| where TicketEncryptionType == "0x17"          // RC4
| where ServiceName !endswith "$" and ServiceName != "krbtgt"
| summarize Services = dcount(ServiceName) by TargetUserName, IpAddress, bin(TimeGenerated, 30m)
| where Services >= 5`,
    spl: `index=wineventlog EventCode=4769 Ticket_Encryption_Type=0x17 Service_Name!="*$" Service_Name!=krbtgt
| bin _time span=30m
| stats dc(Service_Name) as services values(Service_Name) as spns by Account_Name Client_Address _time
| where services >= 5`,
    yl: `rule hv_kerberoasting_rc4 {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1558.003"
  events:
    $e.metadata.product_event_type = "4769"
    $e.extensions.auth.auth_details = "0x17"
    $e.principal.user.userid = $u
    $e.target.application = $svc
  match:
    $u over 30m
  outcome:
    $spns = count_distinct($svc)
  condition:
    $e and $spns >= 5
}`,
  },
  T1490: {
    kql: `DeviceProcessEvents
| where (FileName =~ "vssadmin.exe" and ProcessCommandLine has_all ("delete", "shadows"))
     or (FileName =~ "wmic.exe" and ProcessCommandLine has_all ("shadowcopy", "delete"))
     or (FileName =~ "bcdedit.exe" and ProcessCommandLine has "recoveryenabled no")
| project TimeGenerated, DeviceName, AccountName, ProcessCommandLine`,
    spl: `index=crowdstrike event_simpleName=ProcessRollup2
  ((FileName=vssadmin.exe CommandLine="*delete*shadows*") OR (FileName=wmic.exe CommandLine="*shadowcopy*delete*") OR (FileName=bcdedit.exe CommandLine="*recoveryenabled*no*"))
| table _time ComputerName UserName CommandLine`,
    yl: `rule hv_inhibit_recovery {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1490"
    severity = "CRITICAL"
  events:
    $p.metadata.event_type = "PROCESS_LAUNCH"
    re.regex($p.target.process.command_line, \`(?i)(vssadmin.*delete.*shadows|shadowcopy.*delete|recoveryenabled\\s+no)\`)
  condition:
    $p
}`,
  },
  'T1567.002': {
    kql: `CloudAppEvents
| where ActionType in ("FileUploaded", "FileSyncUploadedFull")
| where Application in ("Dropbox", "Google Drive (personal)", "WeTransfer", "MEGA")
| summarize Bytes = sum(tolong(RawEventData.FileSize)), Files = count() by AccountDisplayName, Application, bin(TimeGenerated, 1h)
| where Bytes > 500000000`,
    spl: `index=netskope activity=Upload app IN ("Dropbox","Google Drive","WeTransfer","MEGA") instance_id!="corp*"
| bin _time span=1h
| stats sum(file_size) as bytes count as files by user app _time
| where bytes > 500000000`,
    yl: `rule hv_personal_cloud_exfil {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1567.002"
  events:
    $e.metadata.event_type = "NETWORK_HTTP"
    $e.target.application = /(dropbox|wetransfer|mega|drive\\.google)/ nocase
    $e.network.sent_bytes > 0
    $e.principal.user.userid = $u
  match:
    $u over 1h
  outcome:
    $bytes = sum($e.network.sent_bytes)
  condition:
    $e and $bytes > 500000000
}`,
  },
  T1078: {
    kql: `SigninLogs
| where ResultType == 0
| project TimeGenerated, UserPrincipalName, IPAddress, Lat = toreal(LocationDetails.geoCoordinates.latitude), Lon = toreal(LocationDetails.geoCoordinates.longitude)
| sort by UserPrincipalName asc, TimeGenerated asc
| extend PrevLat = prev(Lat), PrevLon = prev(Lon), PrevTime = prev(TimeGenerated), PrevUser = prev(UserPrincipalName)
| where UserPrincipalName == PrevUser
| extend Km = geo_distance_2points(Lon, Lat, PrevLon, PrevLat) / 1000, Hours = datetime_diff('minute', TimeGenerated, PrevTime) / 60.0
| where Km / max_of(Hours, 0.1) > 900`,
    spl: `index=okta eventType="user.session.start" outcome.result=SUCCESS
| iplocation client.ipAddress
| sort 0 actor.alternateId _time
| streamstats current=f last(lat) as plat last(lon) as plon last(_time) as ptime by actor.alternateId
| eval km=haversine(lat,lon,plat,plon), hrs=(_time-ptime)/3600
| where km/max(hrs,0.1) > 900`,
    yl: `rule hv_impossible_travel {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1078"
  events:
    $a.metadata.event_type = "USER_LOGIN"
    $b.metadata.event_type = "USER_LOGIN"
    $a.target.user.userid = $u
    $b.target.user.userid = $u
    $a.principal.ip_geo_artifact.location.country_or_region != $b.principal.ip_geo_artifact.location.country_or_region
    $a.metadata.event_timestamp.seconds < $b.metadata.event_timestamp.seconds
  match:
    $u over 2h
  condition:
    $a and $b
}`,
  },
  T1098: {
    kql: `AuditLogs
| where OperationName in ("Add member to role", "Add eligible member to role", "Reset user password", "User registered security info")
| where Result == "success"
| extend Target = tostring(TargetResources[0].userPrincipalName), Role = tostring(TargetResources[0].modifiedProperties[1].newValue)
| where Role has_any ("Global Administrator", "Privileged Role Administrator", "Security Administrator") or OperationName has "security info"`,
    spl: `(index=okta eventType IN ("user.mfa.factor.reset_all","group.user_membership.add","user.account.privilege.grant"))
 OR (index=mainframe sourcetype="racf:smf" event="ALTUSER" attributes="*SPECIAL*")
| lookup change_windows host OUTPUT approved
| where approved!="yes"
| table _time actor.alternateId target{}.alternateId eventType event attributes`,
    yl: `rule hv_privileged_change_outside_window {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1098"
  events:
    $e.metadata.event_type = "USER_CHANGE_PERMISSIONS"
    $e.target.user.attribute.roles.name = /(admin|super|special)/ nocase
    not $e.principal.user.userid in %approved_change_actors
  condition:
    $e
}`,
  },
  T1133: {
    kql: `CommonSecurityLog
| where DeviceVendor in ("CyberArk", "Palo Alto Networks")
| where Activity has_any ("PSM session start", "GlobalProtect")
| extend Vendor = tostring(split(SourceUserName, "@")[1])
| join kind=leftanti (_GetWatchlist('ApprovedVendorWindows') | where now() between (todatetime(StartUtc) .. todatetime(EndUtc))) on $left.Vendor == $right.SearchKey
| project TimeGenerated, SourceUserName, DestinationHostName, Activity`,
    spl: `index=cyberark sourcetype="cyberark:psm" action="session start"
| lookup approved_vendor_windows vendor AS src_user_domain OUTPUT start end
| where isnull(start) OR _time<start OR _time>end
| table _time src_user dest action`,
    yl: `rule hv_vendor_access_outside_window {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1133"
  events:
    $e.metadata.event_type = "USER_LOGIN"
    $e.target.hostname = /JUMP|PLAYOUT/ nocase
    $e.principal.user.userid = $u
    not $u in %approved_vendor_window
  condition:
    $e
}`,
  },
  'T1566.001': {
    kql: `EmailAttachmentInfo
| where FileType in ("html", "iso", "img", "lnk", "one", "zip")
| join kind=inner (EmailEvents | where DeliveryAction == "Delivered") on NetworkMessageId
| join kind=inner (DeviceFileEvents | where ActionType == "FileCreated") on SHA256
| project TimeGenerated, RecipientEmailAddress, SenderFromDomain, FileName, DeviceName`,
    spl: `index=proofpoint sourcetype="pps_messagelog" final_action=deliver attachment_type IN ("html","iso","lnk","one","zip")
| join message_id [search index=crowdstrike event_simpleName=NewExecutableWritten]
| table _time recipient sender attachment_name ComputerName`,
    yl: `rule hv_attachment_to_execution {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T1566.001"
  events:
    $m.metadata.event_type = "EMAIL_TRANSACTION"
    $m.about.file.sha256 = $h
    $p.metadata.event_type = "PROCESS_LAUNCH"
    $p.target.process.file.sha256 = $h
  match:
    $h over 30m
  condition:
    $m and $p
}`,
  },
  T0843: {
    kql: `SecurityAlert
| where ProductName in ("Dragos Platform", "HexaOT")
| where AlertName has_any ("Program Download", "Controller Mode Change", "Online Edit")
| extend Zone = tostring(parse_json(ExtendedProperties).zone), Asset = tostring(parse_json(Entities)[0].HostName)
| join kind=leftanti (_GetWatchlist('OTChangeWindows')) on $left.Asset == $right.SearchKey`,
    spl: `index=ot sourcetype IN ("dragos:alert","hexaot:alert") signature IN ("*Program Download*","*Mode Change*")
| lookup ot_change_windows asset OUTPUT approved
| where approved!="yes"`,
    yl: `rule hv_ot_program_download {
  meta:
    author = "HexaSOC Detection Engineering"
    mitre_attack_technique = "T0843"
  events:
    $e.metadata.product_name = "HexaOT"
    $e.security_result.rule_name = /program download|mode change/ nocase
  condition:
    $e
}`,
  },
};
const Q_ALIAS: Record<string, string> = { T0886: 'T1133', T1219: 'T1133', T0821: 'T0843', T0855: 'T0843', T0836: 'T0843', T1539: 'T1078', T1530: 'T1567.002', 'T1048.003': 'T1567.002', T1213: 'T1567.002', 'T1566.002': 'T1566.001', 'T1204.002': 'T1566.001', T1486: 'T1490', 'T1550.002': 'T1003.001', T1027: 'T1059.001' };

const AQL_WHERE: Record<string, string> = {
  T1621: `QIDNAME(qid) ILIKE '%MFA%denied%'\nGROUP BY username HAVING COUNT(*) >= 5`,
  'T1110.003': `QIDNAME(qid) ILIKE '%logon failure%'\nGROUP BY sourceip HAVING UNIQUECOUNT(username) >= 20`,
  'T1059.001': `LOWER("Process Name") IN ('powershell.exe', 'pwsh.exe')\n  AND ("Command" ILIKE '%-enc%' OR "Command" ILIKE '%FromBase64String%')`,
  'T1003.001': `"Target Process Name" = 'lsass.exe'\n  AND "Granted Access" IN ('0x1010', '0x1410', '0x1fffff')`,
  T1490: `"Command" ILIKE '%vssadmin%delete%shadows%' OR "Command" ILIKE '%recoveryenabled%no%'`,
  T1078: `QIDNAME(qid) ILIKE '%login succeeded%'\n  AND REFERENCESETCONTAINS('HexaSOC impossible travel', username)`,
  T1133: `LOGSOURCETYPENAME(devicetype) = 'BeyondTrust PRA'\n  AND NOT REFERENCESETCONTAINS('Approved vendor windows', username)`,
  T0843: `LOGSOURCETYPENAME(devicetype) IN ('Armis Centrix', 'HexaOT')\n  AND QIDNAME(qid) ILIKE '%program download%'`,
  'T1567.002': `"URL Category" IN ('Personal cloud storage', 'File sharing')\nGROUP BY username HAVING SUM("Bytes Sent") > 500000000`,
};

function aqlFor(techId: string, label: string): string {
  const key = AQL_WHERE[techId] ? techId : Q_ALIAS[techId];
  const name = TECHNIQUE_BY_ID[techId]?.name ?? techId;
  const where = (key && AQL_WHERE[key]) ?? `"MITRE Technique" = '${techId}'`;
  return `/* HexaSOC · ${label} · ATT&CK ${techId} ${name} */\nSELECT DATEFORMAT(starttime, 'yyyy-MM-dd HH:mm') AS time, username, sourceip,\n       LOGSOURCENAME(logsourceid) AS source, QIDNAME(qid) AS event, COUNT(*) AS events\nFROM events\nWHERE ${where}\nLAST 60 MINUTES`;
}

export function queryFor(ql: QL, techId: string, label: string): string {
  if (ql === 'AQL') return aqlFor(techId, label);
  const key = Q[techId] ? techId : Q_ALIAS[techId];
  const t = TECHNIQUE_BY_ID[techId];
  if (key && Q[key]) {
    const s = Q[key];
    const body = ql === 'KQL' ? s.kql : ql === 'SPL' ? s.spl : s.yl;
    const head = ql === 'YARA-L' ? '' : `${ql === 'KQL' ? '//' : '```'} HexaSOC · ${label} · ATT&CK ${techId}${ql === 'SPL' ? ' ```' : ''}\n`;
    return head + body;
  }
  const slug = techId.toLowerCase().replace('.', '_');
  const name = t?.name ?? techId;
  if (ql === 'KQL') return `// HexaSOC · ${label} · ATT&CK ${techId} ${name}\nunion SecurityAlert, DeviceEvents, SigninLogs\n| where TimeGenerated > ago(1h)\n| where tostring(AdditionalFields) has "${techId}" or AlertName has "${name}"\n| summarize Events = count(), Entities = dcount(DeviceName) by AlertName, bin(TimeGenerated, 15m)\n| where Events >= 1`;
  if (ql === 'SPL') return `\`\`\` HexaSOC · ${label} · ATT&CK ${techId} \`\`\`\n| tstats summariesonly=true count from datamodel=Endpoint.Processes where Processes.annotations.mitre_attack="${techId}" by Processes.dest Processes.user Processes.process_name\n| \`drop_dm_object_name(Processes)\`\n| where count > 0`;
  return `rule hv_${slug} {\n  meta:\n    author = "HexaSOC Detection Engineering"\n    description = "${label}"\n    mitre_attack_technique = "${techId}"\n  events:\n    $e.metadata.event_type = "PROCESS_LAUNCH"\n    $e.security_result.rule_labels["mitre"] = "${techId}"\n    $e.principal.hostname = $host\n  match:\n    $host over 15m\n  condition:\n    $e\n}`;
}

/* =====================================================================
   Threat actors → techniques (HexaInt profiles, simplified)
   ===================================================================== */
const ACTOR_TECH: Record<string, string[]> = {
  'Sandworm (APT44)': ['T1190', 'T1133', 'T1078', 'T1059.001', 'T1484.001', 'T1562.001', 'T1070.001', 'T1486', 'T1489', 'T1490', 'T1021.002', 'T1570', 'T0843', 'T0855', 'T0816', 'T0814', 'T0831', 'T0826'],
  'Volt Typhoon': ['T1190', 'T1133', 'T1078', 'T1047', 'T1059.003', 'T1003.001', 'T1087.002', 'T1046', 'T1482', 'T1021.001', 'T1090.003', 'T1070.001', 'T1560.001', 'T1505.003', 'T0883', 'T0886'],
  'LockBit 3.0 affiliates': ['T1133', 'T1078', 'T1190', 'T1059.001', 'T1047', 'T1562.001', 'T1003.001', 'T1021.002', 'T1570', 'T1486', 'T1490', 'T1489', 'T1567.002', 'T1219', 'T1484.001'],
  'Black Basta': ['T1566.002', 'T1204.002', 'T1621', 'T1219', 'T1059.001', 'T1003.001', 'T1558.003', 'T1021.001', 'T1570', 'T1486', 'T1490', 'T1567.002', 'T1562.001'],
  CyberAv3ngers: ['T1110.003', 'T0883', 'T0886', 'T0859', 'T0836', 'T0832', 'T0826', 'T0814'],
  APT41: ['T1190', 'T1505.003', 'T1059.001', 'T1053.005', 'T1547.001', 'T1003.001', 'T1550.002', 'T1021.002', 'T1560.001', 'T1041', 'T1027', 'T1195.002'],
  'Lazarus Group (APT38)': ['T1566.001', 'T1204.002', 'T1059.001', 'T1027', 'T1070.001', 'T1003.001', 'T1021.001', 'T1657', 'T1565.001', 'T1071.001', 'T1041', 'T1486', 'T1195.002'],
  FIN7: ['T1566.001', 'T1204.002', 'T1059.001', 'T1218.011', 'T1547.001', 'T1053.005', 'T1003.001', 'T1021.001', 'T1071.001', 'T1567.002', 'T1486'],
  'Scattered Spider': ['T1589', 'T1566.002', 'T1621', 'T1078', 'T1098', 'T1136.003', 'T1219', 'T1550.001', 'T1539', 'T1530', 'T1213', 'T1567.002', 'T1486', 'T1562.001', 'T1580'],
  'ALPHV/BlackCat affiliates': ['T1078', 'T1133', 'T1059.001', 'T1047', 'T1562.001', 'T1003.001', 'T1021.002', 'T1570', 'T1486', 'T1490', 'T1489', 'T1567.002'],
  TA505: ['T1566.001', 'T1204.002', 'T1059.003', 'T1218.011', 'T1071.001', 'T1027', 'T1041', 'T1190'],
  Cl0p: ['T1190', 'T1505.003', 'T1059.001', 'T1560.001', 'T1567.002', 'T1041', 'T1486', 'T1048.003'],
  ShinyHunters: ['T1589', 'T1078', 'T1110.003', 'T1530', 'T1213', 'T1567.002', 'T1539', 'T1550.001'],
  'LAPSUS$-style extortion crews': ['T1589', 'T1621', 'T1078', 'T1098', 'T1199', 'T1213', 'T1530', 'T1567.002', 'T1489'],
  Akira: ['T1133', 'T1078', 'T1110.003', 'T1003.001', 'T1021.001', 'T1570', 'T1486', 'T1490', 'T1567.002', 'T1562.001'],
  'Leak forums ("pre-release" brokers)': ['T1199', 'T1078', 'T1530', 'T1213', 'T1567.002', 'T1041', 'T1048.003'],
  Rhysida: ['T1566.001', 'T1133', 'T1078', 'T1219', 'T1059.001', 'T1047', 'T1003.001', 'T1021.001', 'T1570', 'T1562.001', 'T1070.001', 'T1486', 'T1490', 'T1567.002'],
  Qilin: ['T1133', 'T1078', 'T1558.003', 'T1003.001', 'T1484.001', 'T1021.002', 'T1562.001', 'T1486', 'T1490', 'T1489', 'T1567.002'],
  'INC Ransom': ['T1190', 'T1133', 'T1110.003', 'T1219', 'T1003.001', 'T1021.001', 'T1560.001', 'T1567.002', 'T1486', 'T1490'],
  'BlackSuit (dealer SaaS attacks)': ['T1199', 'T1078', 'T1539', 'T1219', 'T1059.001', 'T1021.001', 'T1486', 'T1490', 'T1489', 'T1567.002'],
};
export function actorTechniques(actor: string): string[] {
  if (ACTOR_TECH[actor]) return ACTOR_TECH[actor];
  if (actor.startsWith('Lazarus')) return ACTOR_TECH['Lazarus Group (APT38)'];
  return [];
}

/* =====================================================================
   ATT&CK coverage (HexaMatrix)
   ===================================================================== */
export type CovLevel = 'none' | 'logged' | 'detected' | 'validated';
export type Matrix = 'enterprise' | 'ics' | 'atlas';
export interface CovCell {
  tech: Technique;
  level: CovLevel;
  rules: number;
  validatedDaysAgo?: number;
  sources: string[];
}

const MATRIX_PCT: Record<CustomerId, Record<Exclude<Matrix, 'enterprise'>, number>> = {
  maritime: { ics: 58, atlas: 25 },
  finserv: { ics: 31, atlas: 50 },
  media: { ics: 39, atlas: 38 },
  healthcare: { ics: 47, atlas: 34 },
  automotive: { ics: 61, atlas: 41 },
};

export function matrixTechniques(m: Matrix): Technique[] {
  return m === 'enterprise' ? TECHNIQUES : m === 'ics' ? ICS_TECHNIQUES : ATLAS_TECHNIQUES;
}
export function matrixTactics(m: Matrix): string[] {
  if (m === 'enterprise') return TACTICS.map((t) => t.name);
  return Array.from(new Set(matrixTechniques(m).map((t) => t.tactic)));
}

export function coverage(c: CustomerProfile, tenantId: string, m: Matrix): { cells: CovCell[]; pct: number } {
  const h = headlines(c, tenantId).soc;
  const pct = m === 'enterprise' ? h.attackCoveragePct : MATRIX_PCT[c.id][m];
  const r = rng(`soc-cov-${c.id}-${tenantId}-${m}`);
  const techs = matrixTechniques(m);
  const tools = socTools(c, tenantId);
  // Techniques the customer's own actors use are more likely covered (the SOC tunes for them), but not all.
  const actorSet = new Set(c.vocab.threatActors.flatMap(actorTechniques));
  const scored = techs.map((t) => ({ t, s: r() + (actorSet.has(t.id) ? 0.18 : 0) })).sort((a, b) => b.s - a.s);
  const k = Math.round((pct / 100) * techs.length);
  const live = h.detectionsLive;
  const cells: CovCell[] = scored.map(({ t }, i) => {
    let level: CovLevel;
    if (i < k) level = r.chance(0.42) ? 'validated' : 'detected';
    else level = r.chance(0.55) ? 'logged' : 'none';
    const srcs: string[] = [];
    if (level !== 'none') {
      if (m === 'ics') srcs.push(...(tools.ot.length ? tools.ot.map(toolShort) : ['No OT sensor']));
      else if (m === 'atlas') srcs.push(c.id === 'finserv' ? 'Netskope SkopeAI' : c.id === 'automotive' ? 'Zscaler GenAI controls' : 'HexaAI guardrails');
      else srcs.push(tools.siemShort, ...(r.chance(0.6) && tools.edr ? [tools.edrShort] : []), ...(t.tactic === 'Credential Access' || t.tactic === 'Initial Access' ? tools.idps.slice(0, 1).map(toolShort) : []));
    }
    return {
      tech: t,
      level,
      rules: level === 'detected' || level === 'validated' ? Math.max(1, Math.round((live / (techs.length * 0.7)) * r.float(0.3, 1.8, 2) * (m === 'enterprise' ? 1 : 0.15))) : 0,
      validatedDaysAgo: level === 'validated' ? r.int(3, 88) : undefined,
      sources: Array.from(new Set(srcs)),
    };
  });
  const order = new Map(techs.map((t, i) => [t.id, i]));
  cells.sort((a, b) => (order.get(a.tech.id) ?? 0) - (order.get(b.tech.id) ?? 0));
  return { cells, pct };
}

/* =====================================================================
   Detection engineering
   ===================================================================== */
export type RuleStage = 'draft' | 'tested' | 'staged' | 'deployed' | 'tuned';
export type RuleHealth = 'healthy' | 'noisy' | 'silent' | 'broken';
export interface Rule {
  id: string;
  name: string;
  tech: string;
  tactic: string;
  platform: string;
  stage: RuleStage;
  health: RuleHealth;
  sev: Severity;
  hits7d: number;
  fpPct: number;
  lastFiredMin: number | null;
  origin: 'Intel (HexaInt)' | 'Hunt' | 'Purple team' | 'Incident lesson' | 'Baseline pack';
  author: string;
  changedDaysAgo: number;
  version: string;
  ci: 'passed' | 'failed' | 'running';
  body: string;
  tenants: string;
}

const VARIANTS = ['anomalous volume', 'rare parent process', 'known-bad indicator match', 'behavioural sequence', 'first seen for entity', 'off-hours activity', 'threshold breach', 'privileged context'];

export interface DetectionData {
  rules: Rule[];
  live: number;
  pipeline: { stage: RuleStage; count: number }[];
  health: { health: RuleHealth; count: number }[];
  fpTrend: { labels: string[]; fp: number[]; tuned: number[] };
  byTactic: { tactic: string; rules: number; covered: number; total: number }[];
  ci: { id: string; title: string; status: 'passed' | 'failed' | 'running'; min: number; author: string; checks: string }[];
  intel: { advisory: string; actor: string; receivedH: number; ruleId?: string; deployedH?: number; status: 'deployed' | 'in test' | 'drafting' }[];
}

const ISAC: Record<CustomerId, string> = { finserv: 'FS-ISAC advisory', maritime: 'Maritime ISAC bulletin', media: 'HexaInt leak watch', healthcare: 'Health-ISAC / HHS HC3 alert', automotive: 'Auto-ISAC advisory' };

export function detectionData(c: CustomerProfile, tenantId: string, days: number): DetectionData {
  const h = headlines(c, tenantId).soc;
  const r = rng(`soc-det-${c.id}-${tenantId}`);
  const tools = socTools(c, tenantId);
  const live = h.detectionsLive;
  const hasOt = scopedTenants(c, tenantId).some((t) => t.env.includes('ot'));
  const techs = [...TECHNIQUES, ...(hasOt ? ICS_TECHNIQUES.slice(0, 10) : [])];
  const platforms = [tools.siemShort, ...(tools.edr ? [tools.edrShort] : []), ...(hasOt && tools.ot.length ? [toolShort(tools.ot[0])] : [])];
  const authors = ['HexaSOC Detection Engineering', 'HexaSOC Detection Engineering', 'HexaSOC Detection Engineering', `${c.people.socLead.name} (customer)`, 'HexaAI draft (human-reviewed)'];
  const tenantLabel = tenantId === 'all' ? 'All tenants' : scopedTenants(c, tenantId)[0]?.short ?? tenantId;
  const rules: Rule[] = [];
  const n = 84;
  for (let i = 0; i < n; i++) {
    const t = r.pick(techs);
    const stage = r.weighted<RuleStage>([['deployed', 10], ['tuned', 5], ['staged', 1.6], ['tested', 1.4], ['draft', 1.6]]);
    const isLive = stage === 'deployed' || stage === 'tuned';
    const health: RuleHealth = isLive ? r.weighted<RuleHealth>([['healthy', 14], ['noisy', 2.2], ['silent', 1.6], ['broken', 0.6]]) : 'healthy';
    const isOt = t.matrix === 'ics';
    const platform = isOt && platforms.length > 2 ? platforms[2] : r.pick(platforms.slice(0, 2));
    const ql: QL = platform === tools.siemShort ? tools.ql : tools.ql;
    const name = `${t.name}: ${r.pick(VARIANTS)}`;
    const hits = !isLive ? 0 : health === 'silent' ? 0 : health === 'noisy' ? r.int(400, 2400) : r.int(0, 140);
    rules.push({
      id: `HV-${t.id.replace('.', '-')}-${String(r.int(1, 12)).padStart(2, '0')}`,
      name, tech: t.id, tactic: t.tactic, platform, stage, health,
      sev: r.weighted<Severity>([['critical', 1], ['high', 4], ['medium', 5], ['low', 2]]),
      hits7d: hits,
      fpPct: health === 'noisy' ? r.int(38, 81) : hits ? r.int(0, 14) : 0,
      lastFiredMin: !isLive || health === 'silent' ? null : r.int(3, 9000),
      origin: r.weighted<Rule['origin']>([['Baseline pack', 5], ['Intel (HexaInt)', 3], ['Hunt', 2], ['Purple team', 2], ['Incident lesson', 1.4]]),
      author: r.pick(authors),
      changedDaysAgo: r.int(0, 120),
      version: `${r.int(1, 4)}.${r.int(0, 9)}.${r.int(0, 9)}`,
      ci: stage === 'draft' ? r.pick(['running', 'failed', 'passed'] as const) : health === 'broken' ? 'failed' : 'passed',
      body: queryFor(ql, t.id, name),
      tenants: tenantLabel,
    });
  }
  rules.sort((a, b) => a.changedDaysAgo - b.changedDaysAgo);
  const tuned = Math.round(live * 0.31);
  const pipeline: { stage: RuleStage; count: number }[] = [
    { stage: 'draft', count: Math.round(live * 0.045) + r.int(2, 6) },
    { stage: 'tested', count: Math.round(live * 0.03) + r.int(1, 4) },
    { stage: 'staged', count: Math.round(live * 0.018) + r.int(1, 3) },
    { stage: 'deployed', count: live - tuned },
    { stage: 'tuned', count: tuned },
  ];
  const noisy = Math.round(live * 0.052);
  const silent = Math.round(live * 0.071);
  const broken = Math.max(1, Math.round(live * 0.009));
  const health = [
    { health: 'healthy' as RuleHealth, count: live - noisy - silent - broken },
    { health: 'noisy' as RuleHealth, count: noisy },
    { health: 'silent' as RuleHealth, count: silent },
    { health: 'broken' as RuleHealth, count: broken },
  ];
  const nWeeks = days <= 7 ? 8 : days <= 30 ? 12 : 13;
  const labels = Array.from({ length: nWeeks }, (_, i) => `W-${nWeeks - 1 - i}`).map((l) => (l === 'W-0' ? 'This wk' : l));
  const fp: number[] = [];
  let v = r.float(18, 26, 1);
  for (let i = 0; i < nWeeks; i++) {
    v = Math.max(4, v - r.float(0.2, 1.6, 1) + (r() - 0.6));
    fp.push(Math.round(v * 10) / 10);
  }
  const tunedSeries = labels.map(() => r.int(4, 19));
  const cov = coverage(c, tenantId, 'enterprise').cells;
  const byTactic = TACTICS.map((tc) => {
    const cs = cov.filter((x) => x.tech.tactic === tc.name);
    return { tactic: tc.short, rules: cs.reduce((s, x) => s + x.rules, 0), covered: cs.filter((x) => x.level === 'detected' || x.level === 'validated').length, total: cs.length };
  });
  const ci = Array.from({ length: 8 }, (_, i) => {
    const rr = rules[i];
    const st: 'passed' | 'failed' | 'running' = i === 0 ? 'running' : r.weighted([['passed', 8], ['failed', 1.4]] as const);
    return {
      id: `#${r.int(1800, 2600)}`,
      title: `${r.pick(['feat', 'tune', 'fix', 'feat'])}(${rr.tech}): ${rr.name.toLowerCase()}`,
      status: st,
      min: i * r.int(20, 140) + r.int(2, 12),
      author: rr.author.replace(' (customer)', ''),
      checks: st === 'failed' ? r.pick(['Replay test: 0 hits on attack sample', 'Schema check: field renamed upstream', 'Performance budget exceeded (34 s)']) : `Lint · schema · replay (${r.int(3, 12)} samples) · perf ${r.int(2, 14)} s`,
    };
  });
  const intel = c.vocab.threatActors.slice(0, 5).map((a, i) => {
    const receivedH = r.int(4, 160);
    const status = i === 0 ? 'drafting' : i === 1 ? 'in test' : 'deployed';
    const tech = r.pick(actorTechniques(a).length ? actorTechniques(a) : ['T1078']);
    return {
      advisory: `${r.pick(['HexaInt flash', ISAC[c.id], 'CISA advisory'])}: ${a} · ${TECHNIQUE_BY_ID[tech]?.name ?? tech}`,
      actor: a,
      receivedH,
      ruleId: status === 'drafting' ? undefined : `HV-${tech.replace('.', '-')}-${String(r.int(1, 12)).padStart(2, '0')}`,
      deployedH: status === 'deployed' ? r.int(9, 70) : undefined,
      status: status as 'deployed' | 'in test' | 'drafting',
    };
  });
  return { rules, live, pipeline, health, fpTrend: { labels, fp, tuned: tunedSeries }, byTactic, ci, intel };
}

/* =====================================================================
   Threat hunting
   ===================================================================== */
export type HuntOutcome = 'Findings → incident' | 'No evidence found' | 'Detection created' | 'Hygiene issue raised';
export interface Hunt {
  id: string;
  name: string;
  hypothesis: string;
  actor: string;
  techniques: string[];
  status: 'active' | 'concluded';
  outcome?: HuntOutcome;
  trigger: string;
  analyst: string;
  tenantId: string;
  startedDaysAgo: number;
  durationDays: number;
  progress: number;
  sources: string[];
  eventsScanned: number;
  hits: number;
  findings: number;
  detections: number;
  query: string;
  results: { entity: string; detail: string; verdict: 'Malicious' | 'Suspicious' | 'Benign' | 'Needs owner' }[];
}

interface HuntTpl {
  name: string;
  hyp: string;
  actor: number;
  tech: string[];
  trigger: string;
  tenants?: string[];
}

const HUNT_TPL: Record<CustomerId, HuntTpl[]> = {
  maritime: [
    { name: 'Living-off-the-land on terminal Windows servers', hyp: 'Volt Typhoon-style actors are using built-in tools (wmic, ntdsutil, netsh portproxy) on TOS and historian servers to persist without malware.', actor: 1, tech: ['T1047', 'T1059.003', 'T1003.001', 'T1090.003'], trigger: 'CISA advisory AA24-038A + HexaInt', tenants: ['rtm', 'ant', 'hq'] },
    { name: 'Crane PLC logic changes outside change windows', hyp: 'A Sandworm-style intrusion would push logic to STS crane PLCs from an engineering workstation outside approved maintenance windows.', actor: 0, tech: ['T0843', 'T0821', 'T0886'], trigger: 'ATT&CK ICS gap (HexaMatrix)', tenants: ['rtm', 'ant'] },
    { name: 'Vessel VSAT management plane exposure', hyp: 'Satellite terminal admin interfaces on vessels are reachable and being probed by internet scanners.', actor: 4, tech: ['T0883', 'T1133'], trigger: 'HexaStrike ASM finding', tenants: ['fleet'] },
    { name: 'Ransomware staging via RMM tools', hyp: 'LockBit 3.0 affiliates stage with AnyDesk/ScreenConnect before encrypting SAP and file servers.', actor: 2, tech: ['T1219', 'T1570', 'T1490'], trigger: 'HexaInt flash: ScreenConnect CVE-2024-1709', tenants: ['hq', 'pkl', 'sts'] },
    { name: 'Web shells on internet-facing booking portal', hyp: 'APT41 has dropped web shells on IIS/Java front ends after exploiting public-facing apps.', actor: 5, tech: ['T1505.003', 'T1190'], trigger: 'Purple team retest', tenants: ['hq'] },
    { name: 'Kerberoastable service accounts in group AD', hyp: 'Black Basta-style operators request RC4 tickets for SAP and TOS service accounts.', actor: 3, tech: ['T1558.003', 'T1087.002'], trigger: 'Incident lesson HSOC-PKL', tenants: ['hq', 'pkl'] },
    { name: 'Modbus write commands from non-engineering hosts', hyp: 'CyberAv3ngers-style actors issue Modbus writes to AGV and reefer controllers from IT-zone hosts.', actor: 4, tech: ['T0855', 'T0836'], trigger: 'Dragos WorldView advisory', tenants: ['rtm', 'sts'] },
    { name: 'GNSS spoofing indicators across fleet telemetry', hyp: 'Position jumps coincide with known spoofing hot-spots (Black Sea, Strait of Hormuz) rather than sensor faults.', actor: 0, tech: ['T0832', 'T0855'], trigger: 'Maritime ISAC bulletin', tenants: ['fleet'] },
  ],
  finserv: [
    { name: 'Help-desk MFA resets followed by new device enrolment', hyp: 'Scattered Spider is social-engineering the service desk to reset MFA, then enrolling attacker devices within an hour.', actor: 2, tech: ['T1078', 'T1098', 'T1621'], trigger: 'FS-ISAC advisory + HexaInt' },
    { name: 'SWIFT operator anomalies against Lazarus playbook', hyp: 'APT38-style operators would access Alliance Access from unusual jump hosts and alter message templates.', actor: 0, tech: ['T1021.001', 'T1657', 'T1565.001'], trigger: 'SWIFT CSP advisory', tenants: ['ukbank', 'pay'] },
    { name: 'Rundll32 and JS loaders on trading desks', hyp: 'FIN7 loaders (rundll32, mshta) are executing from user profile paths on Markets endpoints.', actor: 1, tech: ['T1218.011', 'T1204.002', 'T1547.001'], trigger: 'ATT&CK gap (HexaMatrix)', tenants: ['markets'] },
    { name: 'MFT exploitation and staging (Cl0p)', hyp: 'Managed file transfer servers show web shell drops and bulk archive staging consistent with Cl0p campaigns.', actor: 5, tech: ['T1190', 'T1505.003', 'T1560.001'], trigger: 'CISA KEV: CVE-2024-55956 (Cleo)', tenants: ['ukbank', 'eu'] },
    { name: 'OAuth illicit consent in Entra ID', hyp: 'Third-party apps with Mail.Read / Files.Read.All were consented by users after phishing.', actor: 2, tech: ['T1550.001', 'T1114.002'], trigger: 'HexaInt phishing kit telemetry' },
    { name: 'RACF privilege drift on z/OS', hyp: 'SPECIAL/OPERATIONS attributes are being granted outside ServiceNow change records.', actor: 3, tech: ['T1098', 'T1565.001'], trigger: 'Internal audit request', tenants: ['ukbank', 'pay'] },
    { name: 'Card data egress via DNS from CDE', hyp: 'Long TXT/NULL DNS queries from CDE hosts indicate tunnelling of track data.', actor: 4, tech: ['T1048.003', 'T1572'], trigger: 'PCI QSA pre-visit', tenants: ['pay'] },
    { name: 'AWS IAM persistence in EU accounts', hyp: 'New IAM users or access keys created by federated roles outside Terraform pipelines.', actor: 2, tech: ['T1136.003', 'T1098', 'T1580'], trigger: 'Purple team retest', tenants: ['eu', 'markets'] },
  ],
  media: [
    { name: 'Pre-release content staging before exfiltration', hyp: 'Leak brokers stage locked cuts in archives on edit bays before uploading to personal cloud.', actor: 4, tech: ['T1560.001', 'T1567.002'], trigger: 'HexaInt leak watch: Nightjar chatter', tenants: ['post', 'studios'] },
    { name: 'Okta help-desk resets for content staff', hyp: 'Scattered Spider targets VFX and editorial staff with help-desk resets to reach NEXIS and the MAM.', actor: 1, tech: ['T1078', 'T1098', 'T1621'], trigger: 'Industry advisory (MPA)' },
    { name: 'Screener link abuse and token sharing', hyp: 'Screener links are being shared, with sessions replayed from multiple countries.', actor: 0, tech: ['T1539', 'T1213'], trigger: 'Watermark hit on Telegram', tenants: ['studios'] },
    { name: 'Vendor over-collection from Aspera', hyp: 'Tier 1 vendors are pulling more titles than their work orders allow.', actor: 4, tech: ['T1199', 'T1530'], trigger: 'HexaCustody anomaly', tenants: ['studios', 'post'] },
    { name: 'ESXi targeting on render infrastructure', hyp: 'Akira operators enumerate and stage on vCenter/ESXi hosts in the Soho render farm.', actor: 3, tech: ['T1486', 'T1490', 'T1021.001'], trigger: 'CISA advisory AA24-109A', tenants: ['post'] },
    { name: 'Credential stuffing against KestrelPlay', hyp: 'ShinyHunters-sourced combo lists are being replayed against subscriber login.', actor: 0, tech: ['T1110.003', 'T1078'], trigger: 'Cloudflare bot score shift', tenants: ['play'] },
  ],
  healthcare: [
    { name: 'Help-desk resets followed by Epic sign-in from new devices', hyp: 'Scattered Spider is phoning the service desk as clinicians, resetting MFA and reaching Epic and payroll within the hour.', actor: 3, tech: ['T1078', 'T1098', 'T1621'], trigger: 'HHS HC3 sector alert + Health-ISAC' },
    { name: 'Remote-access tooling staged on Citrix and Epic print servers', hyp: 'Rhysida affiliates stage AnyDesk/ScreenConnect on Citrix VDAs before encrypting Epic downtime and file servers.', actor: 0, tech: ['T1219', 'T1570', 'T1490'], trigger: 'CISA advisory AA23-319A (Rhysida)', tenants: ['mrmc', 'community'] },
    { name: 'Infusion pump library changes outside biomed work orders', hyp: 'Drug-library or firmware pushes to Alaris pumps come from hosts other than the biomed jump server or outside ServiceNow work orders.', actor: 1, tech: ['T0843', 'T0836', 'T0886'], trigger: 'HexaMatrix ICS gap', tenants: ['mrmc', 'kids'] },
    { name: 'Legacy imaging consoles reaching the internet', hyp: 'Windows 7 modality consoles on flat VLANs at community hospitals have outbound paths that ransomware could use.', actor: 4, tech: ['T0883', 'T1071.001'], trigger: 'Claroty xDome risk report', tenants: ['community', 'mrmc'] },
    { name: 'Snooping on VIP and employee medical records', hyp: 'Staff are opening VIP or co-worker charts in Epic without a treatment relationship, beyond what FairWarning has alerted.', actor: 3, tech: ['T1213', 'T1078'], trigger: 'Privacy office request', tenants: ['mrmc', 'kids', 'community'] },
    { name: 'Genomics data staged for exfiltration', hyp: 'Research users stage cohort data in archives on HPC scratch before moving it to personal cloud.', actor: 2, tech: ['T1560.001', 'T1567.002', 'T1530'], trigger: 'NIH data security review', tenants: ['research'] },
    { name: 'Kerberoastable Epic and interface-engine service accounts', hyp: 'Qilin-style operators request RC4 tickets for Epic Interconnect and Rhapsody service accounts.', actor: 1, tech: ['T1558.003', 'T1087.002'], trigger: 'Purple team retest', tenants: ['mrmc', 'community'] },
  ],
  automotive: [
    { name: 'PLC logic changes outside plant change windows', hyp: 'A Volt Typhoon-style or ransomware actor would push logic to press and body-shop PLCs from engineering stations outside approved windows.', actor: 5, tech: ['T0843', 'T0821', 'T0886'], trigger: 'HexaMatrix ICS gap', tenants: ['ingolstadt', 'gyor', 'puebla'] },
    { name: 'OTA signing pipeline integrity', hyp: 'APT41 targets automotive software supply chains; any signing request not originating from the release pipeline is suspect.', actor: 0, tech: ['T1195.002', 'T1078', 'T1553.002'], trigger: 'Auto-ISAC advisory', tenants: ['connected', 'group'] },
    { name: 'Vehicle backend API enumeration', hyp: 'Researchers or criminals are enumerating VINs against the remote-command API with stolen app tokens.', actor: 4, tech: ['T1190', 'T1550.001'], trigger: 'Upstream vSOC fleet anomaly', tenants: ['connected'] },
    { name: 'Black Basta staging via Teams vishing and Quick Assist', hyp: 'Black Basta affiliates call employees as IT support over Teams and start Quick Assist before dropping loaders.', actor: 1, tech: ['T1566.004', 'T1219', 'T1059.001'], trigger: 'Microsoft threat intel + HexaInt' },
    { name: 'Design IP leaving through sanctioned SaaS', hyp: 'Pre-launch renders and CAD exports are being shared from Teamcenter to external design agencies outside the TISAX prototype process.', actor: 0, tech: ['T1213', 'T1567.002'], trigger: 'TISAX prototype protection audit', tenants: ['group'] },
    { name: 'IT-to-OT conduits bypassing the DMZ at Puebla', hyp: 'Flat routes from office VLANs to Level 2 cells exist and are being used by non-engineering hosts.', actor: 2, tech: ['T1021.001', 'T1570', 'T0866'], trigger: 'Armis boundary report', tenants: ['puebla', 'gyor'] },
    { name: 'Dealer SaaS session theft (BlackSuit pattern)', hyp: 'Dealer DMS sessions are being hijacked to pivot into finance and customer data after the industry-wide DMS outage campaign.', actor: 4, tech: ['T1539', 'T1078', 'T1199'], trigger: 'Industry incident (dealer SaaS)', tenants: ['retail'] },
  ],
};

export function hunts(c: CustomerProfile, tenantId: string, days: number): Hunt[] {
  const h = headlines(c, tenantId).soc;
  const r = rng(`soc-hunts-${c.id}-${tenantId}`);
  const tools = socTools(c, tenantId);
  const tenantIds = scopedTenants(c, tenantId).map((t) => t.id);
  const tpls = HUNT_TPL[c.id].filter((t) => !t.tenants || t.tenants.some((x) => tenantIds.includes(x)));
  const pool = tpls.length ? tpls : HUNT_TPL[c.id];
  const historyN = days <= 7 ? 5 : days <= 30 ? 8 : 14;
  const out: Hunt[] = [];
  const total = h.huntsActive + historyN;
  for (let i = 0; i < total; i++) {
    const tpl = pool[i % pool.length];
    const active = i < h.huntsActive;
    const allowed = (tpl.tenants ?? c.tenants.map((t) => t.id)).filter((x) => tenantIds.includes(x));
    const tid = allowed.length ? r.pick(allowed) : tenantIds[0];
    const actor = c.vocab.threatActors[tpl.actor] ?? c.vocab.threatActors[0];
    const outcome = active ? undefined : r.weighted<HuntOutcome>([['Detection created', 4], ['No evidence found', 3], ['Hygiene issue raised', 2.5], ['Findings → incident', 1.2]]);
    const scanned = r.int(40, 900) * 1e6 * (c.id === 'finserv' ? 2.4 : c.id === 'automotive' ? 3.1 : c.id === 'healthcare' ? 1.6 : 1);
    const hits = r.int(3, 240);
    const findings = active ? r.int(0, 4) : outcome === 'No evidence found' ? 0 : r.int(1, 9);
    const srcs = [tools.siemShort, ...(tools.edr ? [tools.edrShort] : []), ...(tpl.tech.some((t) => t.startsWith('T0')) ? tools.ot.map(toolShort) : tools.idps.slice(0, 1).map(toolShort))];
    const ents = [...c.vocab.servers, ...c.people.staff.map((p) => p.name)];
    const cycle = Math.floor(i / pool.length);
    out.push({
      id: `HNT-${String(r.int(100, 999))}`,
      name: cycle ? `${tpl.name} (re-run ${cycle + 1})` : tpl.name,
      hypothesis: tpl.hyp,
      actor,
      techniques: tpl.tech,
      status: active ? 'active' : 'concluded',
      outcome,
      trigger: tpl.trigger,
      analyst: r.pick(HEXASOC_ANALYSTS),
      tenantId: tid,
      startedDaysAgo: active ? r.int(1, 12) : r.int(8, Math.max(14, days + 10)) + i * 3,
      durationDays: r.int(3, 14),
      progress: active ? r.int(18, 82) : 100,
      sources: Array.from(new Set(srcs)),
      eventsScanned: Math.round(scanned),
      hits,
      findings,
      detections: outcome === 'Detection created' ? r.int(1, 3) : active ? 0 : r.chance(0.3) ? 1 : 0,
      query: queryFor(tools.ql, tpl.tech[0], tpl.name),
      results: Array.from({ length: Math.min(6, Math.max(2, findings + 2)) }, (_, j) => ({
        entity: r.pick(ents),
        detail: r.pick([`${tpl.tech[0]} pattern, ${r.int(2, 40)} events`, 'Matched on parent/child lineage', 'First seen in 90 days', 'Known admin tool, approved change', `Hit on ${actor} infrastructure`]),
        verdict: j < findings ? r.pick(['Malicious', 'Suspicious', 'Needs owner'] as const) : 'Benign',
      })),
    });
  }
  return out;
}

/* =====================================================================
   Forensics
   ===================================================================== */
export interface CustodyStep {
  min: number;
  actor: string;
  action: string;
  note: string;
}
export interface Evidence {
  id: string;
  caseId: string;
  type: string;
  name: string;
  sha256: string;
  size: number;
  collectedBy: string;
  collectedMin: number;
  sealedMin: number;
  source: string;
  custody: CustodyStep[];
  verified: boolean;
}
export interface ForensicCase {
  id: string;
  title: string;
  incident: string;
  tenantId: string;
  status: 'acquisition' | 'analysis' | 'reporting' | 'closed';
  progress: number;
  lead: string;
  openedDaysAgo: number;
  legalHold: boolean;
  questions: string[];
  evidence: Evidence[];
  timeline: { source: string; hour: number; count: number; label: string }[];
}

const EV_TYPES: Record<CustomerId, { type: string; source: string; min: number; max: number; tenants?: string[] }[]> = {
  maritime: [
    { type: 'Disk image (E01)', source: 'Defender XDR live response + FTK Imager', min: 120e9, max: 900e9 },
    { type: 'Memory capture (raw)', source: 'Defender XDR live response (WinPmem)', min: 8e9, max: 64e9 },
    { type: 'M365 unified audit log export', source: 'Purview audit (Entra ID)', min: 80e6, max: 2.4e9 },
    { type: 'Entra ID sign-in export', source: 'Entra ID', min: 20e6, max: 600e6 },
    { type: 'Azure managed disk snapshot', source: 'Azure (hps-prod-weu)', min: 128e9, max: 512e9 },
    { type: 'VDR extract (S-VDR)', source: 'Vessel VDR via chief engineer', min: 4e9, max: 40e9, tenants: ['fleet'] },
    { type: 'ECDIS log bundle', source: 'Bridge ECDIS export (USB, sealed bag)', min: 200e6, max: 3e9, tenants: ['fleet'] },
    { type: 'PLC project backup', source: 'TIA Portal export via Dragos', min: 20e6, max: 300e6, tenants: ['rtm', 'ant'] },
    { type: 'Firewall PCAP', source: 'Palo Alto Panorama', min: 1e9, max: 30e9 },
  ],
  finserv: [
    { type: 'Disk image (E01)', source: 'CrowdStrike RTR + FTK Imager', min: 120e9, max: 1.2e12 },
    { type: 'Memory capture (raw)', source: 'CrowdStrike RTR (WinPmem)', min: 16e9, max: 128e9 },
    { type: 'Okta System Log export', source: 'Okta', min: 50e6, max: 1.8e9 },
    { type: 'M365 unified audit log export', source: 'Purview audit (Entra ID)', min: 100e6, max: 3e9 },
    { type: 'AWS EBS snapshot', source: 'AWS (ald-eu-prod)', min: 100e9, max: 1e12 },
    { type: 'CloudTrail export', source: 'AWS CloudTrail Lake', min: 200e6, max: 6e9 },
    { type: 'SWIFT Alliance journal extract', source: 'SWIFT Alliance Access (secure zone)', min: 30e6, max: 900e6, tenants: ['ukbank', 'pay'] },
    { type: 'RACF SMF records', source: 'z/OS SMF type 80', min: 100e6, max: 4e9, tenants: ['ukbank', 'pay'] },
    { type: 'CyberArk PSM session recording', source: 'CyberArk PAM', min: 200e6, max: 5e9 },
  ],
  media: [
    { type: 'Okta System Log export', source: 'Okta', min: 30e6, max: 900e6 },
    { type: 'Google Workspace Drive audit', source: 'Google Workspace', min: 40e6, max: 1.2e9 },
    { type: 'SentinelOne Deep Visibility export', source: 'SentinelOne', min: 200e6, max: 8e9 },
    { type: 'Disk image (E01), edit bay', source: 'SentinelOne remote shell + FTK Imager', min: 500e9, max: 2e12 },
    { type: 'S3 server access logs', source: 'AWS (kpg-content-vault)', min: 300e6, max: 12e9 },
    { type: 'Aspera transfer logs', source: 'IBM Aspera (aspera.kestrelpictures.com)', min: 20e6, max: 400e6 },
    { type: 'Watermark extraction report', source: 'HexaCustody forensic watermark service', min: 2e6, max: 60e6 },
    { type: 'Memory capture (raw)', source: 'SentinelOne remote shell', min: 16e9, max: 96e9 },
  ],
  healthcare: [
    { type: 'Disk image (E01)', source: 'CrowdStrike RTR + FTK Imager', min: 120e9, max: 900e9 },
    { type: 'Memory capture (raw)', source: 'CrowdStrike RTR (WinPmem)', min: 16e9, max: 96e9 },
    { type: 'Entra ID sign-in export', source: 'Entra ID', min: 20e6, max: 700e6 },
    { type: 'Epic access log (Clarity extract)', source: 'Epic Clarity (break-the-glass, chart access)', min: 40e6, max: 2e9, tenants: ['mrmc', 'kids', 'community', 'clinics'] },
    { type: 'FairWarning case export', source: 'FairWarning (Imprivata)', min: 2e6, max: 80e6, tenants: ['mrmc', 'kids', 'community', 'clinics'] },
    { type: 'Citrix NetScaler logs', source: 'NetScaler ADC (syslog)', min: 300e6, max: 6e9 },
    { type: 'Medical device packet capture', source: 'Claroty xDome (passive, read-only)', min: 500e6, max: 20e9, tenants: ['mrmc', 'kids', 'community'] },
    { type: 'CloudTrail export', source: 'AWS CloudTrail (mrri-genomics)', min: 100e6, max: 3e9, tenants: ['research'] },
    { type: 'CyberArk PSM session recording', source: 'CyberArk Privilege Cloud', min: 200e6, max: 4e9 },
  ],
  automotive: [
    { type: 'Disk image (E01)', source: 'Defender XDR live response + FTK Imager', min: 120e9, max: 1.2e12 },
    { type: 'Memory capture (raw)', source: 'Defender XDR live response (WinPmem)', min: 16e9, max: 128e9 },
    { type: 'PLC project backup (TIA Portal)', source: 'Rubrik PLC project snapshot + Armis', min: 20e6, max: 400e6, tenants: ['ingolstadt', 'gyor', 'puebla'] },
    { type: 'BeyondTrust session recording', source: 'BeyondTrust PRA', min: 200e6, max: 5e9 },
    { type: 'Plant network PCAP', source: 'Armis Centrix (span, read-only)', min: 1e9, max: 40e9, tenants: ['ingolstadt', 'gyor', 'puebla'] },
    { type: 'Signed offline bundle', source: 'Battery plant data diode export (HexaOT)', min: 2e9, max: 30e9, tenants: ['battery'] },
    { type: 'OTA signing HSM audit log', source: 'VMG-OTA-SIGN01 HSM audit', min: 5e6, max: 200e6, tenants: ['connected', 'group'] },
    { type: 'Vehicle SOC case export', source: 'Upstream vSOC (pseudonymised VINs)', min: 50e6, max: 2e9, tenants: ['connected'] },
    { type: 'CloudTrail export', source: 'AWS CloudTrail (vireo-connect-prod)', min: 200e6, max: 8e9, tenants: ['connected'] },
    { type: 'SAP Security Audit Log', source: 'SAP S/4HANA (SM20) via SAP ETD', min: 100e6, max: 3e9, tenants: ['group', 'ingolstadt', 'gyor', 'puebla'] },
  ],
};

const TL_SOURCES: Record<CustomerId, string[]> = {
  maritime: ['$MFT', 'EVTX', 'Prefetch', 'Entra sign-ins', 'Defender timeline', 'Firewall', 'VDR / ECDIS'],
  finserv: ['$MFT', 'EVTX', 'Prefetch', 'Okta System Log', 'CrowdStrike', 'CloudTrail', 'SWIFT journal'],
  media: ['$MFT', 'Okta System Log', 'Drive audit', 'SentinelOne', 'S3 access', 'Aspera', 'Watermark'],
  healthcare: ['$MFT', 'EVTX', 'Entra sign-ins', 'CrowdStrike', 'Epic access log', 'NetScaler', 'Claroty xDome'],
  automotive: ['$MFT', 'EVTX', 'Entra sign-ins', 'Defender timeline', 'BeyondTrust', 'Armis', 'SAP SM20'],
};

export function forensicCases(c: CustomerProfile, tenantId: string): ForensicCase[] {
  const r = rng(`soc-dfir-${c.id}-${tenantId}`);
  const incs = incidents(c, tenantId, 90).filter((i) => i.sev === 'critical' || i.sev === 'high');
  const nCases = Math.max(2, scale(({ finserv: 8, maritime: 7, media: 5, healthcare: 6, automotive: 9 } as Record<CustomerId, number>)[c.id], Math.sqrt(tenantShare(c, tenantId))));
  const leads = ['Freya Lund (DFIR)', 'Hannah Weiss (IR lead)', 'Aiko Tanaka (L3)'];
  const out: ForensicCase[] = [];
  const used = new Set<string>();
  for (let i = 0; i < nCases && i < incs.length + 3; i++) {
    const inc = incs.find((x) => !used.has(x.title)) ?? incs[i % Math.max(1, incs.length)];
    if (!inc) break;
    used.add(inc.title);
    const status = i === 0 ? 'acquisition' : i < 3 ? 'analysis' : i < 4 ? 'reporting' : r.pick(['closed', 'analysis', 'closed'] as const);
    const id = `DF-${new Date().getFullYear()}-${String(r.int(10, 99)).padStart(3, '0')}${i}`;
    const types = EV_TYPES[c.id].filter((t) => !t.tenants || t.tenants.includes(inc.tenantId));
    const nEv = r.int(3, 6);
    const lead = r.pick(leads);
    const opened = status === 'closed' ? r.int(20, 80) : r.int(1, 18);
    const evidence: Evidence[] = Array.from({ length: nEv }, (_, j) => {
      const t = types[(j + r.int(0, types.length - 1)) % types.length];
      const collectedMin = opened * 1440 - r.int(30, 600) - j * 90;
      const sealedMin = collectedMin - r.int(4, 40);
      const host = inc.hosts[j % inc.hosts.length] ?? r.pick(c.vocab.servers);
      const collector = j % 2 ? 'HexaSOC collection agent' : lead;
      const steps: CustodyStep[] = [
        { min: collectedMin, actor: collector, action: 'Acquired', note: `${t.source} · write-blocked, ${host}` },
        { min: collectedMin - 2, actor: 'HexaSOC collection agent', action: 'Hashed (SHA-256)', note: 'Hash computed at source and again on receipt; values match' },
        { min: sealedMin, actor: 'HexaSOC evidence vault', action: 'Sealed in immutable vault', note: `WORM object lock (compliance mode), ${c.residency.split(' ·')[0]}` },
      ];
      if (status !== 'acquisition') steps.push({ min: sealedMin - r.int(60, 900), actor: lead, action: 'Checked out for analysis (read-only copy)', note: 'Working copy mounted in isolated DFIR workspace' });
      if (status === 'reporting' || status === 'closed') steps.push({ min: sealedMin - r.int(1000, 4000), actor: lead, action: 'Re-verified and returned', note: 'SHA-256 re-verified; no change' });
      const hold = r.chance(0.5);
      if (hold) steps.push({ min: sealedMin - r.int(20, 200), actor: c.people.grcLead.name, action: 'Legal hold applied', note: 'Retention extended pending counsel review' });
      steps.sort((a, b) => b.min - a.min);
      return {
        id: `EV-${r.int(10000, 99999)}`,
        caseId: id,
        type: t.type,
        name: `${host.replace(/[^A-Za-z0-9-]/g, '_')}_${t.type.split(' ')[0].toLowerCase()}_${r.hex(4)}`,
        sha256: r.hex(64),
        size: Math.round(r.float(t.min, t.max, 0)),
        collectedBy: collector,
        collectedMin,
        sealedMin,
        source: t.source,
        custody: steps,
        verified: true,
      };
    });
    const srcs = TL_SOURCES[c.id];
    const timeline: ForensicCase['timeline'] = [];
    for (const s of srcs) {
      const n = r.int(5, 12);
      for (let k = 0; k < n; k++) {
        const hour = Math.round(r.float(-72, 6, 1) * 10) / 10;
        timeline.push({ source: s, hour, count: r.int(1, 380), label: r.pick(['File created', 'Process start', 'Logon', 'Token issued', 'Object read', 'Network connection', 'Config change', 'Archive written']) });
      }
    }
    out.push({
      id,
      title: inc.title,
      incident: inc.id,
      tenantId: inc.tenantId,
      status,
      progress: status === 'acquisition' ? r.int(10, 30) : status === 'analysis' ? r.int(35, 75) : status === 'reporting' ? r.int(80, 95) : 100,
      lead,
      openedDaysAgo: opened,
      legalHold: evidence.some((e) => e.custody.some((s) => s.action === 'Legal hold applied')),
      questions: [
        'How did the actor get in, and when (patient zero)?',
        inc.leak ? (c.id === 'automotive' ? 'Which design files and versions left custody, and to whom?' : 'Which titles and versions left custody, and to whom?') : inc.ot ? (c.id === 'healthcare' ? 'Did any change reach a medical device or affect patient care?' : 'Did any command reach a controller or affect the process?') : inc.personal && c.id === 'healthcare' ? 'Was ePHI accessed or acquired (HIPAA four-factor risk assessment)?' : 'Was data accessed or exfiltrated?',
        'Is the actor still present anywhere in the estate?',
      ],
      evidence,
      timeline,
    });
  }
  return out;
}

/* =====================================================================
   IR retainer & playbooks
   ===================================================================== */
export function irRetainer(c: CustomerProfile, tenantId: string) {
  const r = rng(`soc-ret-${c.id}`);
  const hours = ({ finserv: 600, maritime: 400, media: 200, healthcare: 400, automotive: 800 } as Record<CustomerId, number>)[c.id];
  const used = Math.round(hours * r.float(0.28, 0.55, 2));
  const share = tenantShare(c, tenantId);
  return {
    hours, used, usedScoped: Math.round(used * share),
    renewsDays: r.int(60, 220),
    remoteSla: '1 h',
    onsiteSla: c.id === 'maritime' ? '24 h (port), 48 h (vessel at next port call)' : c.id === 'automotive' ? '24 h (EU plants), 48 h (Puebla)' : '24 h',
    tabletops: r.int(1, 3),
    lastTabletopDays: r.int(20, 110),
  };
}

const PLAYBOOKS: Record<CustomerId, string[]> = {
  maritime: ['Ransomware: pre-encryption', 'OT: unauthorised controller change', 'Vessel: navigation integrity', 'Vendor remote access breach', 'Identity: MFA fatigue', 'Phishing: malicious attachment', 'BEC: payment fraud'],
  finserv: ['Identity: help-desk social engineering', 'Payments: SWIFT secure zone', 'BEC: payment fraud', 'Data exfiltration: CDE', 'Identity: MFA fatigue', 'Endpoint: credential dumping', 'Cloud: illicit consent grant'],
  media: ['Content leak: exfiltration', 'Content leak: external sighting', 'Identity: help-desk social engineering', 'Vendor: abnormal access', 'Ransomware: pre-encryption', 'Web: client-side skimming'],
  healthcare: ['Ransomware: pre-encryption', 'Identity: help-desk social engineering', 'Medical device: unauthorised change', 'Privacy: inappropriate EHR access', 'BEC: payroll diversion', 'Vendor remote access breach', 'Data exfiltration: research data'],
  automotive: ['Ransomware: plant pre-encryption', 'OT: unauthorised controller change', 'Vehicle: OTA signing integrity', 'Vehicle: backend API abuse', 'IP leak: design exfiltration', 'Identity: help-desk social engineering', 'Fraud: supplier bank change'],
};
export function playbooks(c: CustomerProfile, incs: Incident[]) {
  const r = rng(`soc-pb-${c.id}`);
  return PLAYBOOKS[c.id].map((p) => ({
    name: p,
    runs: incs.filter((i) => i.playbook === p).length,
    steps: r.int(7, 18),
    automated: r.int(35, 70),
    lastTested: r.int(10, 140),
  }));
}

export function mttrTrend(c: CustomerProfile, tenantId: string): { labels: string[]; mttr: number[]; target: number } {
  const h = headlines(c, tenantId).soc;
  const r = rng(`soc-mttr-${c.id}-${tenantId}`);
  const labels: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) labels.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleDateString('en-GB', { month: 'short' }));
  const out: number[] = [];
  let v = h.mttrMin * r.float(1.6, 2.1, 2);
  for (let i = 0; i < 11; i++) {
    v += (h.mttrMin - v) / (11 - i) + (r() - 0.5) * 8;
    out.push(Math.round(v));
  }
  out.push(h.mttrMin);
  return { labels, mttr: out, target: 60 };
}

/* =====================================================================
   Technique names across Enterprise (incl. sub-techniques), ICS and ATLAS
   ===================================================================== */
export function techName(id: string): string {
  return TECHNIQUE_BY_ID[id]?.name ?? FULL_BY_ID[parentId(id)]?.name ?? id;
}
export function techTactic(id: string): string {
  return TECHNIQUE_BY_ID[id]?.tactic ?? FULL_BY_ID[parentId(id)]?.tactics[0] ?? 'Unmapped';
}

/* =====================================================================
   HexaMatrix: full ATT&CK Enterprise coverage (original v2 design)
   ===================================================================== */
export type FullCov = 'full' | 'partial' | 'none';
export interface MatrixRule {
  id: string;
  name: string;
  platform: string;
  sev: Severity;
  hits7d: number;
  enabled: boolean;
  validatedDaysAgo?: number;
}
export interface FullCell {
  tech: FullTechnique;
  level: FullCov;
  rules: MatrixRule[];
  sources: string[];
  validatedDaysAgo?: number;
  /** Incidents in the last 90 days that used this technique. */
  incidents: number;
  why?: string;
}

const RULE_VARIANTS = ['behavioural sequence', 'rare parent process', 'threat-intel indicator match', 'first seen for entity', 'anomalous volume', 'off-hours privileged context', 'known tool signature', 'correlation across sources'];

/** Sector-specific rule names for the techniques that matter most to each customer. */
const SECTOR_RULES: Record<CustomerId, Record<string, string[]>> = {
  maritime: {
    T1133: ['Vendor session to OT jump host outside approved window', 'VSAT terminal admin login from unregistered IP'],
    T1078: ['Impossible travel for port operations staff', 'Crew account sign-in while vessel at sea'],
    T1566: ['Bill of lading / customs lure with HTML smuggling', 'Shipping-line invoice lookalike domain delivered'],
    T1486: ['Mass file rename on TOS and SAP file shares'],
    T1219: ['AnyDesk or ScreenConnect on terminal operating system hosts'],
    T1190: ['Exploit attempt against booking portal (IIS/Java)'],
  },
  finserv: {
    T1078: ['SWIFT Alliance operator login outside business hours', 'Okta session from new ASN for Tier 0 admin'],
    T1621: ['Okta Verify push fatigue (≥5 denials in 10 min)'],
    T1098: ['RACF SPECIAL attribute outside change window', 'Entra ID privileged role outside PIM'],
    T1657: ['Treasury payment-detail change after BEC indicator'],
    T1048: ['DNS tunnelling from cardholder data environment'],
    T1003: ['LSASS access on Citrix session hosts'],
  },
  media: {
    T1567: ['Pre-release content upload to personal cloud', 'Locked cut uploaded to WeTransfer from edit bay'],
    T1530: ['Public-read policy on content vault prefix', 'Vendor bulk download from Aspera beyond work order'],
    T1213: ['Screener link opened from many countries', 'Script folder shared externally'],
    T1560: ['Archive of locked cuts created on edit bay'],
    T1110: ['Credential stuffing against KestrelPlay sign-in'],
  },
  healthcare: {
    T1078: ['Epic Hyperspace sign-in from new ASN after MFA reset', 'Imprivata badge-tap session reused across hospitals', 'Workday direct-deposit change after risky sign-in'],
    T1098: ['Help-desk MFA reset for clinical user without call-back', 'Privileged role added to Epic security class outside change'],
    T1213: ['FairWarning: VIP chart opened without care relationship', 'Bulk chart access by a single clinician (snooping)'],
    T1219: ['AnyDesk / ScreenConnect on Citrix VDA or Epic print server'],
    T1490: ['Shadow copy deletion on Epic downtime (BCA) PCs'],
    T1486: ['Mass encryption pattern on clinical file shares'],
    T1133: ['Biomed vendor session to modality outside work order', 'NetScaler session without device posture'],
    T1190: ['Citrix NetScaler session hijack (CVE-2023-4966 pattern)', 'Telehealth API object-level authorisation probe'],
    T1566: ['MyChart password-reset lure delivered', 'Payroll / benefits lure to nursing staff'],
    T1530: ['Genomics S3 bulk read to unmanaged device'],
    T1558: ['RC4 Kerberos tickets for Epic Interconnect accounts'],
  },
  automotive: {
    T1078: ['OTA signing HSM operator login from non-release network', 'Supplier account sign-in from sanctioned country'],
    T1195: ['OTA package signed outside the release pipeline', 'Unsigned ECU build promoted to staging'],
    T1190: ['Vehicle remote-command API abuse (token rotation)', 'Dealer portal exploit attempt'],
    T1133: ['KUKA / Dürr remote session outside plant change window', 'BeyondTrust jump to robot cell without ticket'],
    T1567: ['Pre-launch design render sync to personal cloud', 'Teamcenter export to unapproved agency'],
    T1565: ['SAP supplier-master bank change without change record'],
    T1486: ['Encryption burst on MES and SAP file servers'],
    T1490: ['vssadmin delete shadows on plant Windows hosts'],
    T1003: ['ntdsutil IFM on plant domain controller'],
    T1550: ['Vehicle app token replay from many VINs'],
    T1552: ['Cloud key committed to vehicle-software repository'],
  },
};

const MATRIX_SEED_TECHS: Record<CustomerId, string[]> = {
  maritime: ['T1133', 'T1078', 'T1219', 'T1190', 'T1566', 'T1486', 'T1490', 'T1059', 'T1003', 'T1558', 'T1071', 'T1657', 'T1110', 'T1621', 'T1562', 'T1021'],
  finserv: ['T1078', 'T1621', 'T1098', 'T1539', 'T1550', 'T1003', 'T1558', 'T1021', 'T1657', 'T1565', 'T1114', 'T1048', 'T1190', 'T1486', 'T1566', 'T1110'],
  media: ['T1567', 'T1530', 'T1213', 'T1199', 'T1078', 'T1621', 'T1098', 'T1539', 'T1560', 'T1041', 'T1486', 'T1110', 'T1566', 'T1562'],
  healthcare: ['T1078', 'T1098', 'T1621', 'T1213', 'T1219', 'T1490', 'T1486', 'T1133', 'T1190', 'T1566', 'T1530', 'T1558', 'T1003', 'T1657', 'T1110', 'T1562', 'T1059'],
  automotive: ['T1078', 'T1195', 'T1190', 'T1133', 'T1567', 'T1565', 'T1486', 'T1490', 'T1003', 'T1550', 'T1552', 'T1219', 'T1566', 'T1021', 'T1071', 'T1059', 'T1110'],
};

export function hexaMatrix(c: CustomerProfile, tenantId: string) {
  const h = headlines(c, tenantId).soc;
  const r = rng(`soc-hexamatrix-${c.id}-${tenantId}`);
  const tools = socTools(c, tenantId);
  const techs = FULL_TECHNIQUES;
  const actorSet = new Set(c.vocab.threatActors.flatMap(actorTechniques).map(parentId));
  const seed = new Set(MATRIX_SEED_TECHS[c.id]);
  const incs = incidents(c, tenantId, 90);
  const incCount = new Map<string, number>();
  for (const i of incs) for (const t of i.techniques) incCount.set(parentId(t), (incCount.get(parentId(t)) ?? 0) + 1);
  // Score: sector seeds and actor techniques first, Recon / Resource Dev last (mostly pre-compromise, hard to see).
  const scored = techs
    .map((t) => {
      const pre = t.tactics.every((x) => x === 'Reconnaissance' || x === 'Resource Development');
      return { t, s: r() + (seed.has(t.id) ? 2 : 0) + (actorSet.has(t.id) ? 0.35 : 0) + (incCount.has(t.id) ? 1 : 0) - (pre ? 0.55 : 0) };
    })
    .sort((a, b) => b.s - a.s);
  const k = Math.round((h.attackCoveragePct / 100) * techs.length);
  const kFull = Math.round(k * 0.62);
  const platforms = [tools.siemShort, ...(tools.edr ? [tools.edrShort] : []), ...tools.idps.map(toolShort), ...(tools.email ? [toolShort(tools.email)] : []), ...tools.net.slice(0, 2).map(toolShort)];
  const sector = SECTOR_RULES[c.id];
  const cells: FullCell[] = scored.map(({ t }, i) => {
    const level: FullCov = i < kFull ? 'full' : i < k ? 'partial' : 'none';
    const n = level === 'full' ? r.int(3, 11) : level === 'partial' ? r.int(1, 3) : 0;
    const named = sector[t.id] ?? [];
    const rules: MatrixRule[] = Array.from({ length: n }, (_, j) => {
      const platform = t.tactics.includes('Credential Access') && tools.idps.length && j % 3 === 1 ? toolShort(tools.idps[0]) : platforms[(j + i) % Math.min(platforms.length, 3)];
      const label = named[j] ?? `${t.name}: ${RULE_VARIANTS[(i + j) % RULE_VARIANTS.length]}`;
      return {
        id: `HV-${t.id}-${String(j + 1).padStart(2, '0')}`,
        name: `${platform} - ${label} (HexaSOC)`,
        platform,
        sev: r.weighted<Severity>([['critical', 1], ['high', 4], ['medium', 5], ['low', 2]]),
        hits7d: r.chance(0.4) ? 0 : r.int(1, 180),
        enabled: level === 'full' ? true : r.chance(0.7),
        validatedDaysAgo: level === 'full' && r.chance(0.55) ? r.int(3, 88) : undefined,
      };
    });
    const sources = level === 'none' ? [] : Array.from(new Set(rules.map((x) => x.platform)));
    const why =
      level === 'partial'
        ? r.pick(['Rules cover some sub-techniques only', 'Rule live on part of the estate only', 'Telemetry gap on one data source', 'Rule disabled for tuning'])
        : level === 'none'
          ? t.tactics.every((x) => x === 'Reconnaissance' || x === 'Resource Development')
            ? 'Pre-compromise behaviour: watched through HexaInt, not detectable in your telemetry'
            : r.pick(['No rule written yet', 'No telemetry source collects this behaviour', 'Out of scope for current connectors'])
          : undefined;
    return { tech: t, level, rules, sources, validatedDaysAgo: rules.find((x) => x.validatedDaysAgo !== undefined)?.validatedDaysAgo, incidents: incCount.get(t.id) ?? 0, why };
  });
  const byId = new Map(cells.map((x) => [x.tech.id, x]));
  const full = cells.filter((x) => x.level === 'full').length;
  const partial = cells.filter((x) => x.level === 'partial').length;
  const none = cells.length - full - partial;
  // Recommendations: actor techniques with no coverage, ranked by actors using them.
  const recommendations = cells
    .filter((x) => x.level !== 'full' && (actorSet.has(x.tech.id) || seed.has(x.tech.id)))
    .map((x) => ({ cell: x, actors: c.vocab.threatActors.filter((a) => actorTechniques(a).map(parentId).includes(x.tech.id)) }))
    .sort((a, b) => b.actors.length - a.actors.length || (a.cell.level === 'none' ? -1 : 1))
    .slice(0, 8);
  const feeding = [tools.siem, ...(tools.edr ? [tools.edr] : []), ...tools.idps];
  const health = Math.round((feeding.filter((x) => x.status === 'healthy').length / Math.max(1, feeding.length)) * 1000) / 10;
  return { cells, byId, full, partial, none, total: cells.length, pct: Math.round(((full + partial) / cells.length) * 1000) / 10, recommendations, health, feeding, rulesTotal: cells.reduce((s, x) => s + x.rules.length, 0) };
}

/* =====================================================================
   Tickets (requests the customer raises with the SOC)
   ===================================================================== */
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved';
export type TicketPriority = 'Urgent' | 'High' | 'Normal' | 'Low';
export interface Ticket {
  id: string;
  title: string;
  body: string;
  category: 'Report suspicious activity' | 'Access & permissions' | 'Device & hardware' | 'Reports & questions' | 'Change request' | 'Vendor & third party';
  channel: 'Portal' | 'Phone' | 'Email' | 'Teams';
  priority: TicketPriority;
  status: TicketStatus;
  requester: string;
  requesterRole: string;
  tenantId: string;
  openedMin: number;
  updatedMin: number;
  firstResponseMin: number;
  slaMin: number;
  linkedIncident?: string;
  assignee: string;
  thread: { who: string; text: string; min: number; soc: boolean }[];
}

type TT = [string, Ticket['category'], TicketPriority, string, string, string?];
const TICKET_TPL: Record<CustomerId, TT[]> = {
  maritime: [
    ['Suspicious "port dues" invoice email to the Rotterdam finance team', 'Report suspicious activity', 'High', 'Three people received an invoice from a domain one letter off our agent in Rotterdam. One opened the PDF.', 'Sender domain registered 4 days ago; PDF contains a link to a credential page. Blocked sender and purged 11 copies.', 'rtm'],
    ['Allow Konecranes engineer access to STS-14 PLC on Thursday 06:00-10:00', 'Change request', 'Normal', 'Crane maintenance window agreed with ops. Please open the CyberArk jump for the named engineer only.', 'Window created in CyberArk and the vendor watchlist; session will be recorded and monitored live.', 'rtm'],
    ['Crew laptop on Halcyon Meridian showing pop-ups after port call', 'Device & hardware', 'High', 'Second engineer reports pop-ups and a slow laptop since connecting to shore Wi-Fi in Santos.', 'Adware family identified; laptop isolated on the vessel firewall until next VSAT window for clean-up.', 'fleet'],
    ['USB stick found in the Antwerp gate house', 'Report suspicious activity', 'Normal', 'Security guard found an unlabelled USB drive near the OCR lane controller.', 'Do not plug in. Courier to the Antwerp IT room; we will image it in the isolated DFIR workstation.', 'ant'],
    ['New starter (planner) needs TOS and SAP access by Monday', 'Access & permissions', 'Normal', 'Joining the Port Klang planning team.', 'Access packages assigned in Entra ID; TOS role requested from the Navis admin.', 'pkl'],
    ['Question on the true-positive count in the September report', 'Reports & questions', 'Low', 'Board pack says 9 TPs but the dashboard shows 11.', 'Two incidents were re-classified after the report was generated; the October report will show the delta.', 'hq'],
    ['Please block WhatsApp Web on bridge workstations fleet-wide', 'Change request', 'Normal', 'Masters asked for it after the last audit.', 'Policy staged on the vessel firewalls; applied at each vessel’s next VSAT sync.', 'fleet'],
    ['Phone call claiming to be IT asking for VPN code', 'Report suspicious activity', 'Urgent', 'Our HR manager got a call asking for her MFA code. She did not give it.', 'Matches an active vishing campaign; account sign-ins reviewed, no misuse. Sessions revoked as a precaution.', 'hq'],
    ['Onboard new stevedoring contractor to the vendor portal', 'Vendor & third party', 'Normal', 'Contract starts next month; they need read access to the berth plan.', 'Third-party assessment requested from HexaComply before access is granted.', 'sts'],
  ],
  finserv: [
    ['Customer reports a text claiming to be our fraud team', 'Report suspicious activity', 'High', 'Retail customer forwarded an SMS with a link to a fake online-banking page.', 'Lookalike domain taken down via HexaInt; IOC added to Zscaler block list.', 'ukbank'],
    ['Allow a vendor IP for the SFTP endpoint used by the card processor', 'Change request', 'Normal', 'New processor IP range from the migration plan.', 'Range verified against the processor’s published list; change raised in ServiceNow for CAB.', 'pay'],
    ['Trader’s laptop lost on the train', 'Device & hardware', 'Urgent', 'Equities trader left a laptop on the 18:12 from Liverpool Street.', 'Remote lock and wipe sent via Intune; Okta sessions revoked; device was BitLocker-protected.', 'markets'],
    ['Need break-glass access to SWIFT Alliance for the payments run', 'Access & permissions', 'High', 'Primary operator off sick.', 'Temporary role granted via CyberArk for 8 hours with dual control; session recorded.', 'pay'],
    ['Heads-up: mailbox forwarding rule set on payments@', 'Report suspicious activity', 'High', 'We noticed an auto-forward to an external Gmail address.', 'Rule removed, sign-in from a new ASN confirmed, incident opened.', 'ukbank'],
    ['DORA register: please confirm which incidents were major last quarter', 'Reports & questions', 'Normal', 'Compliance needs it for the ICT incident register.', 'One incident met the DORA major threshold; classification evidence attached.', 'eu'],
    ['Onboard a new cloud HSM provider', 'Vendor & third party', 'Normal', 'Procurement wants to start the DORA Art. 28 assessment.', 'Questionnaire sent; exit-plan template attached for the critical-provider review.', 'pay'],
    ['Wealth adviser cannot approve Okta push from abroad', 'Access & permissions', 'Low', 'Adviser travelling in Singapore.', 'Travel location registered; adviser moved to FIDO2 key enrolment.', 'wealth'],
  ],
  media: [
    ['Screener link for our next release shared on a forum', 'Report suspicious activity', 'Urgent', 'A colleague saw our screener link posted on a Discord server.', 'Link revoked in HexaCustody; watermark extraction requested from the posted frames.', 'studios'],
    ['Onboard a new post-production vendor to the custody chain', 'Vendor & third party', 'Normal', 'Localisation house for the Spanish dub.', 'TPN status checked (gold shield); custody agent rollout scheduled.', 'post'],
    ['Edit bay workstation will not boot after update', 'Device & hardware', 'High', 'Bay 4 in Soho stuck on a black screen.', 'SentinelOne rollback applied; machine back online, no threat found.', 'post'],
    ['Freelance colourist needs NEXIS access for 3 weeks', 'Access & permissions', 'Normal', 'Starts Monday on the series finale.', 'Time-bound access package in Okta; custody watermarking enforced.', 'post'],
    ['Phishing email impersonating our casting agency', 'Report suspicious activity', 'High', 'Several actors’ agents got a casting call with an ISO attachment.', 'Attachment detonated: loader; sender blocked; 23 copies purged from Google Workspace.', 'studios'],
    ['Why did the custody score drop last week?', 'Reports & questions', 'Low', 'Saw the drop on the board view.', 'Two untracked copies at a vendor; resolved after their agent update.', 'studios'],
    ['Playout vendor needs remote access on Sunday night', 'Change request', 'Normal', 'Grass Valley firmware upgrade on playout A.', 'Session approved for the window; live monitoring by HexaSOC.', 'live'],
  ],
  healthcare: [
    ['ICU charge nurse got a call from "IT" asking her to approve an MFA prompt', 'Report suspicious activity', 'Urgent', 'Grace on ICU says a caller knew her employee ID and asked her to tap Approve. She refused.', 'Matches Scattered Spider vishing against hospitals. No sign-in followed; account flagged for phishing-resistant MFA enrolment and help-desk call-back enforced.', 'mrmc'],
    ['Suspicious "Epic downtime survey" email sent to all clinic managers', 'Report suspicious activity', 'High', 'Looks like it came from our Epic team but the link goes to a strange site.', 'Credential-harvest page on a lookalike domain; Mimecast blocked sender, 214 copies purged, 3 clicks reset.', 'clinics'],
    ['GE HealthCare needs remote access to CT 2 for a tube replacement', 'Change request', 'Normal', 'Biomed work order WO-88412, Saturday 07:00-11:00.', 'CyberArk vendor window created and linked to the biomed work order; session will be recorded and watched live.', 'mrmc'],
    ['Workstation on wheels (WOW-3E-14) left logged in with Epic open', 'Device & hardware', 'Normal', 'Found on 3 East with a patient chart open and no badge tap.', 'Imprivata tap-out timeout was 30 min on that cart; corrected to 2 min fleet-wide via policy.', 'mrmc'],
    ['New research coordinator needs REDCap and genomics share access', 'Access & permissions', 'Normal', 'IRB-approved study MR-ONC-14.', 'Access granted through the IRB-linked access package; time-bound to study end.', 'research'],
    ['OCR asked for our risk-analysis evidence: can the SOC export last quarter’s incidents?', 'Reports & questions', 'High', 'Privacy office is assembling the HIPAA risk-analysis refresh.', 'Export prepared with incident classification and the four-factor breach assessments; shared via HexaComply evidence.', 'mrmc'],
    ['Lost iPad used for patient check-in at Marion clinic', 'Device & hardware', 'Urgent', 'Front-desk iPad missing since yesterday.', 'Intune remote wipe issued; device was encrypted and had no local ePHI. Logged as a security incident, not a breach.', 'community'],
    ['Payroll says an employee’s direct deposit changed without them asking', 'Report suspicious activity', 'Urgent', 'Respiratory therapist did not get paid this week.', 'Workday sign-in from a residential proxy after an MFA reset; incident opened and payroll change reversed.', 'mrmc'],
    ['Philips asks to whitelist a new IP for IntelliVue gateway updates', 'Vendor & third party', 'Normal', 'Philips field service email with the new update server range.', 'Range verified with Philips PSIRT; firewall change raised for the clinical VLAN egress allow-list.', 'kids'],
    ['Telehealth vendor wants a copy of our pen-test report', 'Vendor & third party', 'Low', 'TeleMed Partners asked as part of the BAA renewal.', 'Executive summary shared under NDA; full report not shared per policy.', 'clinics'],
  ],
  automotive: [
    ['Robotics lead got a Teams call from "Microsoft support" asking to start Quick Assist', 'Report suspicious activity', 'Urgent', 'Andreas in Ingolstadt body shop received an external Teams call after an email flood.', 'Black Basta vishing pattern. External Teams calls from new tenants now blocked; mailbox flood filtered; no session started.', 'ingolstadt'],
    ['KUKA needs remote access to robot cell B-14 for a servo replacement', 'Change request', 'Normal', 'Line stop planned Saturday 22:00-02:00, change CHG-44871.', 'BeyondTrust jump item enabled for the window and linked to the change; session recorded and watched live.', 'ingolstadt'],
    ['Supplier asks us to update their bank details for the next payment run', 'Report suspicious activity', 'High', 'Email from a known Tier 2 supplier, but the sender domain looks slightly different.', 'Lookalike domain confirmed; SAP vendor-master change blocked; supplier called back on the master-data number.', 'group'],
    ['Engineering laptop with Teamcenter cache stolen from a car in Turin', 'Device & hardware', 'Urgent', 'Design engineer at a supplier review.', 'BitLocker confirmed; Intune wipe sent; Teamcenter and Entra sessions revoked; TISAX incident report started.', 'group'],
    ['Dealer group needs API access to the warranty portal', 'Access & permissions', 'Normal', 'Large dealer group integrating their DMS.', 'Client credentials issued with scoped warranty read; dealer added to API abuse monitoring.', 'retail'],
    ['Battery plant needs this month’s offline bundle reviewed early', 'Reports & questions', 'High', 'Plant manager wants assurance before the audit on Friday.', 'Bundle imported via the data diode and reviewed; 1 removable-media alert, closed as approved maintenance.', 'battery'],
    ['OTA release 24.9.3 needs sign-off that the signing ceremony was clean', 'Reports & questions', 'High', 'R156 evidence for the type-approval file.', 'HSM audit log reviewed: dual control satisfied, no off-pipeline signing. Evidence attached to HexaComply.', 'connected'],
    ['Puebla MES engineer needs internet access for a vendor update', 'Change request', 'Normal', 'MES vendor patch download.', 'Declined direct internet; package staged through the DMZ update server instead.', 'puebla'],
    ['Vehicle owner reports their car unlocked by itself overnight', 'Report suspicious activity', 'High', 'Raised via dealer service desk, VIN supplied.', 'Upstream vSOC shows remote-unlock calls from a token reused across many VINs; linked to the API abuse incident.', 'connected'],
    ['New design agency needs access to pre-launch renders', 'Vendor & third party', 'Normal', 'AutoVision Design Studio for Project Lumen.', 'TISAX prototype label required first; assessment requested via HexaComply.', 'group'],
  ],
};

export function tickets(c: CustomerProfile, tenantId: string): Ticket[] {
  const r = rng(`soc-tickets-${c.id}-${tenantId}`);
  const ids = scopedTenants(c, tenantId).map((t) => t.id);
  const tpl = TICKET_TPL[c.id].filter((t) => !t[5] || ids.includes(t[5]));
  const pool = tpl.length ? tpl : TICKET_TPL[c.id].slice(0, 3);
  const incs = incidents(c, tenantId, 30);
  const staff = c.people.staff;
  let seq = r.int(2100, 2900);
  return pool.map(([title, category, priority, body, reply, tid], i) => {
    const status = r.weighted<TicketStatus>([['open', 2], ['in_progress', 2.4], ['waiting', 1.6], ['resolved', 4]]);
    const who = i === 0 ? c.people.socLead : r.pick(staff);
    const openedMin = r.int(40, 14 * 1440) + i * 90;
    const slaMin = priority === 'Urgent' ? 15 : priority === 'High' ? 60 : priority === 'Normal' ? 240 : 1440;
    const first = Math.round(slaMin * r.float(0.15, 1.05, 2));
    const linked = category === 'Report suspicious activity' && r.chance(0.6) ? r.pick(incs).id : undefined;
    const assignee = r.pick(HEXASOC_ANALYSTS);
    const thread = [
      { who: who.name, text: body, min: openedMin, soc: false },
      { who: 'HexaSOC Triage agent', text: `Received via ${['portal', 'phone', 'email', 'Teams'][i % 4]}. Classified as "${category}", priority ${priority}. Routed to ${assignee.split(' (')[0]}.`, min: openedMin - 1, soc: true },
      ...(status !== 'open' ? [{ who: assignee.split(' (')[0], text: reply, min: openedMin - first, soc: true }] : []),
      ...(status === 'waiting' ? [{ who: assignee.split(' (')[0], text: `Waiting on ${who.name.split(' ')[0]}: please confirm the details above so we can close this out.`, min: openedMin - first - r.int(30, 600), soc: true }] : []),
      ...(status === 'resolved' ? [{ who: who.name, text: 'Thanks, all good from our side.', min: openedMin - first - r.int(60, 1200), soc: false }] : []),
    ].filter((x) => x.min > 0);
    return {
      id: `REQ-${seq++}`,
      title, body, category, priority, status,
      channel: (['Portal', 'Phone', 'Email', 'Teams'] as const)[i % 4],
      requester: who.name, requesterRole: who.role,
      tenantId: tid && ids.includes(tid) ? tid : ids[0],
      openedMin, updatedMin: Math.max(1, openedMin - first - r.int(0, 600)), firstResponseMin: first, slaMin,
      linkedIncident: linked, assignee, thread,
    };
  }).sort((a, b) => a.openedMin - b.openedMin);
}

/* =====================================================================
   Endpoint vulnerabilities (from the EDR / VM connector)
   ===================================================================== */
export interface EndpointCve {
  id: string;
  product: string;
  title: string;
  desc: string;
  remediation: string;
  cvss: number;
  sev: Severity;
  kev: boolean;
  exploit: boolean;
  epss: number;
  publishedDays: number;
  devices: string[];
  software: string[];
  category: 'Browser' | 'OS' | 'Office' | 'Remote access' | 'Server' | 'Third-party app' | 'Clinical app' | 'Engineering tool';
}

type CveSeed = [string, string, string, number, boolean, number, EndpointCve['category'], string, string];
// [id, product, title, cvss, kev, publishedDays, category, impact, remediation]
const CVE_COMMON: CveSeed[] = [
  ['CVE-2025-2783', 'Google Chrome (Windows)', 'Mojo sandbox escape', 8.3, true, 190, 'Browser', 'A crafted page can escape the Chrome sandbox on Windows; exploited in the wild (Operation ForumTroll).', 'Update Chrome to 134.0.6998.177 or later.'],
  ['CVE-2024-7971', 'Google Chrome', 'V8 type confusion RCE', 8.8, true, 400, 'Browser', 'Remote code execution in the renderer from a crafted page; exploited in the wild.', 'Update Chrome to 128.0.6613.84 or later.'],
  ['CVE-2025-29824', 'Windows CLFS driver', 'Use-after-free elevation of privilege', 7.8, true, 175, 'OS', 'Local attacker gains SYSTEM; used by ransomware operators after initial access.', 'Apply the April 2025 Windows cumulative update.'],
  ['CVE-2024-38063', 'Windows TCP/IP (IPv6)', 'Remote code execution via IPv6 packets', 9.8, false, 420, 'OS', 'Unauthenticated RCE by sending crafted IPv6 packets to a host.', 'Apply the August 2024 cumulative update; disable IPv6 where not needed.'],
  ['CVE-2024-21413', 'Microsoft Outlook', '"MonikerLink" protected-view bypass', 9.8, true, 600, 'Office', 'A link in an email can leak NTLM credentials and run code without Protected View.', 'Apply the February 2024 Office security update.'],
  ['CVE-2025-24054', 'Windows NTLM', 'NTLM hash disclosure via .library-ms file', 6.5, true, 200, 'OS', 'Opening a folder with a crafted file leaks the user’s NTLM hash to an attacker.', 'Apply the March 2025 update; restrict outbound SMB and NTLM.'],
  ['CVE-2025-0411', '7-Zip', 'Mark-of-the-Web bypass', 7.0, true, 250, 'Third-party app', 'Files extracted from crafted archives lose MotW, so SmartScreen does not warn.', 'Update 7-Zip to 24.09 or later.'],
  ['CVE-2023-38831', 'WinRAR', 'Code execution when opening archive', 7.8, true, 780, 'Third-party app', 'A crafted archive runs code when a user opens a benign-looking file.', 'Update WinRAR to 6.23 or later; prefer the built-in archive tool.'],
  ['CVE-2024-24691', 'Zoom Desktop Client (Windows)', 'Improper input validation, privilege escalation', 9.6, false, 610, 'Third-party app', 'A network attacker may escalate privileges through the Zoom client.', 'Update Zoom Workplace to 5.16.5 or later.'],
  ['CVE-2023-21608', 'Adobe Acrobat Reader DC', 'Use-after-free code execution', 7.8, true, 990, 'Office', 'Opening a crafted PDF runs code as the user.', 'Update Acrobat Reader DC to the current release.'],
];
const CVE_SECTOR: Record<CustomerId, CveSeed[]> = {
  maritime: [
    ['CVE-2024-3400', 'Palo Alto PAN-OS GlobalProtect', 'Command injection in GlobalProtect', 10.0, true, 540, 'Remote access', 'Unauthenticated command execution on the firewall that fronts terminal VPN access.', 'Upgrade PAN-OS to a fixed hotfix release.'],
    ['CVE-2024-40711', 'Veeam Backup & Replication', 'Deserialisation RCE', 9.8, true, 390, 'Server', 'Unauthenticated RCE on the backup server; abused by Akira and Fog ransomware.', 'Upgrade to Veeam B&R 12.2.0.334 or later.'],
    ['CVE-2024-1709', 'ConnectWise ScreenConnect', 'Authentication bypass', 10.0, true, 590, 'Remote access', 'Attacker creates an admin account on the remote-support server used by crane vendors.', 'Upgrade ScreenConnect to 23.9.8 or later; prefer the PAM jump host.'],
  ],
  finserv: [
    ['CVE-2023-4966', 'Citrix NetScaler ADC/Gateway', '"Citrix Bleed" session token disclosure', 9.4, true, 720, 'Remote access', 'Session tokens leak from memory, letting attackers hijack authenticated sessions without MFA.', 'Upgrade NetScaler and kill all active sessions.'],
    ['CVE-2024-55956', 'Cleo Harmony / VLTrader', 'Unauthenticated file write', 9.8, true, 300, 'Server', 'Managed file transfer servers are exploited by Cl0p for mass data theft.', 'Upgrade Cleo to 5.8.0.24 or later; restrict the Autorun folder.'],
    ['CVE-2023-48788', 'Fortinet FortiClient EMS', 'SQL injection RCE', 9.8, true, 560, 'Server', 'Unauthenticated SQL injection leads to code execution on the endpoint management server.', 'Upgrade FortiClient EMS to 7.2.3 or later.'],
  ],
  media: [
    ['CVE-2024-37085', 'VMware ESXi', 'Active Directory integration auth bypass', 6.8, true, 450, 'Server', 'Members of a re-created "ESX Admins" group get full admin on render-farm hypervisors.', 'Upgrade ESXi to 8.0 U3; change the AD admin group setting.'],
    ['CVE-2024-4577', 'PHP-CGI on Windows', 'Argument injection RCE', 9.8, true, 480, 'Server', 'Remote code execution on review-portal servers running PHP in CGI mode.', 'Upgrade PHP to 8.3.8 / 8.2.20 / 8.1.29.'],
    ['CVE-2024-27198', 'JetBrains TeamCity', 'Authentication bypass', 9.8, true, 580, 'Engineering tool', 'Full admin control of the build server that packages the streaming apps.', 'Upgrade TeamCity to 2023.11.4 or later.'],
  ],
  healthcare: [
    ['CVE-2023-4966', 'Citrix NetScaler ADC/Gateway', '"Citrix Bleed" session token disclosure', 9.4, true, 720, 'Remote access', 'Session tokens leak, letting attackers hijack Epic Citrix sessions without MFA; exploited against US hospitals.', 'Upgrade NetScaler to 14.1-8.50 / 13.1-49.15 and kill all active and persistent sessions.'],
    ['CVE-2025-5777', 'Citrix NetScaler ADC/Gateway', '"CitrixBleed 2" out-of-bounds read', 9.3, true, 100, 'Remote access', 'Memory over-read leaks session tokens from the gateway that publishes Epic Hyperspace.', 'Upgrade to 14.1-43.56 / 13.1-58.32 and terminate ICA and PCoIP sessions.'],
    ['CVE-2024-6286', 'Citrix Workspace app for Windows', 'Local privilege escalation', 8.5, false, 450, 'Clinical app', 'A local user on a shared clinical workstation can gain SYSTEM through the Workspace app.', 'Update Citrix Workspace app to 2403.1 / 2402 LTSR or later.'],
    ['CVE-2024-40711', 'Veeam Backup & Replication', 'Deserialisation RCE', 9.8, true, 390, 'Server', 'Unauthenticated RCE on backup servers; a favourite of ransomware crews targeting hospitals.', 'Upgrade to Veeam B&R 12.2.0.334 or later.'],
    ['CVE-2024-1709', 'ConnectWise ScreenConnect', 'Authentication bypass', 10.0, true, 590, 'Remote access', 'A clinic IT vendor’s ScreenConnect instance can be taken over to push tools into the estate.', 'Upgrade to 23.9.8 or later; move vendor access to CyberArk.'],
  ],
  automotive: [
    ['CVE-2024-26169', 'Windows Error Reporting service', 'Elevation of privilege', 7.8, true, 570, 'OS', 'Used by Black Basta to reach SYSTEM before deploying ransomware.', 'Apply the March 2024 cumulative update.'],
    ['CVE-2024-27198', 'JetBrains TeamCity', 'Authentication bypass', 9.8, true, 580, 'Engineering tool', 'Full admin control of the build server that compiles vehicle software; APT41-linked exploitation reported.', 'Upgrade TeamCity to 2023.11.4 or later; rotate build secrets.'],
    ['CVE-2024-21762', 'Fortinet FortiOS SSL VPN', 'Out-of-bounds write, unauthenticated RCE', 9.8, true, 600, 'Remote access', 'Pre-auth RCE on the SSL VPN used by suppliers at Puebla.', 'Upgrade FortiOS to a fixed release; disable SSL VPN if unused.'],
    ['CVE-2023-24932', 'Windows Boot Manager', 'Secure Boot bypass (BlackLotus)', 6.7, false, 880, 'OS', 'Bootkits can persist below EDR on plant engineering stations.', 'Apply the boot manager revocations (DBX) after testing on HMI images.'],
    ['CVE-2024-6387', 'OpenSSH (glibc Linux)', '"regreSSHion" signal handler race', 8.1, false, 460, 'Server', 'Remote unauthenticated code execution on Linux build and telematics gateway hosts.', 'Upgrade OpenSSH to 9.8p1 or set LoginGraceTime 0.'],
  ],
};

export function endpointCves(c: CustomerProfile, tenantId: string): EndpointCve[] {
  const r = rng(`soc-cve-${c.id}-${tenantId}`);
  const share = tenantShare(c, tenantId);
  const devs = endpointDevices(c, tenantId);
  const seeds = [...CVE_SECTOR[c.id], ...CVE_COMMON];
  return seeds.map(([id, product, title, cvss, kev, pub, category, impact, rem]) => {
    const sev: Severity = cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low';
    const affected = category === 'Remote access' || category === 'Server' || category === 'Engineering tool' ? r.int(1, 4) : Math.max(2, Math.round(r.int(6, 48) * share * (category === 'Browser' ? 3 : 1)));
    const pool = devs.filter((d) => (category === 'Server' || category === 'Remote access' || category === 'Engineering tool' ? d.kind.includes('Server') || d.kind.includes('server') || d.kind.includes('Gateway') : !d.kind.includes('Server')));
    return {
      id, product, title, cvss, sev, kev, category,
      exploit: kev || r.chance(0.3),
      epss: kev ? r.float(0.6, 0.97, 2) : r.float(0.02, 0.4, 2),
      publishedDays: pub,
      desc: `${title} in ${product}. Impact: ${impact}`,
      remediation: rem,
      devices: r.pickN(pool.length ? pool : devs, Math.min(affected, 12)).map((d) => d.host).concat(affected > 12 ? [`+${affected - 12} more`] : []),
      software: [product],
    };
  }).sort((a, b) => b.cvss - a.cvss);
}

/* =====================================================================
   Entities (devices onboarded to the EDR)
   ===================================================================== */
export type Exposure = 'High' | 'Medium' | 'Low' | 'None';
export interface Device {
  host: string;
  kind: string;
  os: string;
  tenantId: string;
  exposure: Exposure;
  online: boolean;
  onboarded: boolean;
  sensor: boolean;
  lastSeenMin: number;
  ip: string;
  owner: string;
  vulns: number;
  alerts: number;
  crown: boolean;
  tags: string[];
}

type DevSeed = [string, string, string[]];
const DEVICE_KINDS: Record<CustomerId, DevSeed[]> = {
  maritime: [['WS', 'Office workstation', ['Windows 11 23H2', 'Windows 11 24H2']], ['ENG', 'Crane engineering workstation', ['Windows 10 LTSC 2019']], ['BRG', 'Bridge workstation (vessel)', ['Windows 10 22H2']], ['SRV', 'Server', ['Windows Server 2022', 'Windows Server 2019']], ['LNX', 'Linux server', ['Ubuntu 22.04 LTS', 'RHEL 9.4']], ['LT', 'Laptop', ['Windows 11 24H2']]],
  finserv: [['WS', 'Office workstation', ['Windows 11 24H2']], ['TRD', 'Trading desk workstation', ['Windows 11 23H2']], ['CTX', 'Citrix session host', ['Windows Server 2022']], ['SRV', 'Server', ['Windows Server 2022', 'Windows Server 2019']], ['LNX', 'Linux server', ['RHEL 9.4', 'RHEL 8.10']], ['MAC', 'Laptop (macOS)', ['macOS 15 Sequoia']]],
  media: [['EDT', 'Edit bay workstation', ['Windows 11 23H2', 'macOS 15 Sequoia']], ['RND', 'Render node', ['Rocky Linux 9.4']], ['WS', 'Office workstation', ['Windows 11 24H2']], ['SRV', 'Server', ['Windows Server 2022']], ['MAC', 'Laptop (macOS)', ['macOS 15 Sequoia', 'macOS 14 Sonoma']]],
  healthcare: [['WOW', 'Workstation on wheels (clinical)', ['Windows 10 22H2', 'Windows 11 23H2']], ['NS', 'Nursing station (shared, Imprivata)', ['Windows 11 23H2']], ['RAD', 'Radiology reading workstation', ['Windows 11 24H2']], ['CTX', 'Epic Citrix VDA', ['Windows Server 2022']], ['SRV', 'Server', ['Windows Server 2022', 'Windows Server 2019', 'Windows Server 2016']], ['LT', 'Clinician laptop', ['Windows 11 24H2']], ['KSK', 'Patient check-in kiosk', ['Windows 10 IoT Enterprise']], ['HPC', 'Genomics HPC node', ['Rocky Linux 9.4']]],
  automotive: [['WS', 'Office workstation', ['Windows 11 24H2']], ['ENG', 'Engineering workstation (TIA Portal)', ['Windows 10 LTSC 2021', 'Windows 11 IoT LTSC']], ['HMI', 'Plant HMI (WinCC)', ['Windows 10 LTSC 2019']], ['CAD', 'CAD / Teamcenter workstation', ['Windows 11 23H2']], ['SRV', 'Server', ['Windows Server 2022', 'Windows Server 2019']], ['BLD', 'Vehicle software build server', ['Ubuntu 22.04 LTS']], ['GW', 'Telematics API gateway', ['Amazon Linux 2023']], ['LT', 'Laptop', ['Windows 11 24H2']]],
};

export function endpointDevices(c: CustomerProfile, tenantId: string): Device[] {
  const r = rng(`soc-devices-${c.id}-${tenantId}`);
  const ts = scopedTenants(c, tenantId).filter((t) => !t.env.every((e) => e === 'ot'));
  const tlist = ts.length ? ts : scopedTenants(c, tenantId);
  const kinds = DEVICE_KINDS[c.id];
  const staff = [c.people.ciso, c.people.socLead, c.people.grcLead, c.people.admin, ...c.people.staff];
  const out: Device[] = [];
  const crown = new Set(c.vocab.servers.slice(0, 8));
  for (const s of c.vocab.servers) {
    const t = r.pick(tlist);
    out.push(mkDevice(r, s, 'Server', r.pick(['Windows Server 2022', 'Windows Server 2019']), t.id, crown.has(s), 'IT operations'));
  }
  const n = Math.max(24, Math.round(64 * Math.sqrt(tenantShare(c, tenantId))));
  for (let i = 0; i < n; i++) {
    const [pre, kind, oses] = r.pick(kinds);
    const t = r.pick(tlist);
    const host = `${t.id.slice(0, 3).toUpperCase()}-${pre}-${String(r.int(1, 480)).padStart(3, '0')}`;
    out.push(mkDevice(r, host, kind, r.pick(oses), t.id, false, kind.includes('shared') || kind.includes('kiosk') || kind.includes('HMI') ? 'Shared device' : r.pick(staff).name));
  }
  return out.sort((a, b) => ['High', 'Medium', 'Low', 'None'].indexOf(a.exposure) - ['High', 'Medium', 'Low', 'None'].indexOf(b.exposure));
}

function mkDevice(r: ReturnType<typeof rng>, host: string, kind: string, os: string, tenantId: string, crown: boolean, owner: string): Device {
  const legacy = /Windows 10|2016|LTSC 2019/.test(os);
  const exposure = r.weighted<Exposure>([['High', legacy || crown ? 3 : 1.2], ['Medium', 3], ['Low', 2], ['None', 1.4]]);
  const onboarded = r.chance(kind.includes('HMI') ? 0.55 : 0.95);
  const online = r.chance(0.86);
  return {
    host, kind, os, tenantId, exposure, online, onboarded,
    sensor: onboarded && r.chance(0.95),
    lastSeenMin: online ? r.int(1, 40) : r.int(300, 12000),
    ip: `10.${r.int(10, 90)}.${r.int(0, 254)}.${r.int(2, 250)}`,
    owner,
    vulns: exposure === 'None' ? r.int(0, 2) : exposure === 'Low' ? r.int(2, 9) : exposure === 'Medium' ? r.int(8, 24) : r.int(18, 61),
    alerts: r.chance(0.25) ? r.int(1, 9) : 0,
    crown,
    tags: [...(crown ? ['Crown jewel'] : []), ...(legacy ? ['Legacy OS'] : []), ...(!onboarded ? ['No EDR'] : [])],
  };
}

/** Estate-level endpoint totals (the table shows a working sample). */
export function deviceSummary(c: CustomerProfile, tenantId: string) {
  const share = tenantShare(c, tenantId);
  const r = rng(`soc-devsum-${c.id}-${tenantId}`);
  const total = Math.round(c.employees * 1.25 * share);
  const onboarded = Math.round(total * r.float(0.93, 0.98, 3));
  const high = Math.round(total * r.float(0.05, 0.09, 3));
  const medium = Math.round(total * r.float(0.18, 0.26, 3));
  const none = Math.round(total * r.float(0.2, 0.3, 3));
  const offline = Math.round(total * r.float(0.03, 0.07, 3));
  const threats = headlines(c, tenantId).soc.openIncidents > 0 ? r.int(1, 4) : 0;
  return { total, onboarded, notOnboarded: total - onboarded, high, medium, low: total - high - medium - none, none, offline, threats };
}

/* =====================================================================
   Recommendations (secure-score style configuration gaps)
   ===================================================================== */
export interface Recommendation {
  id: string;
  title: string;
  desc: string;
  category: 'Accounts' | 'Application' | 'Network' | 'OS' | 'Security controls' | 'Clinical' | 'Plant';
  sub: string;
  points: number;
  devices: number;
  effort: 'Low' | 'Medium' | 'High';
  userImpact: 'Low' | 'Medium' | 'High';
  via: string;
  techniques: string[];
  status: 'open' | 'in_progress' | 'risk_accepted';
}

type RecSeed = [string, string, Recommendation['category'], string, number, Recommendation['effort'], Recommendation['userImpact'], string[]];
const REC_COMMON: RecSeed[] = [
  ['Remove local administrator rights from standard users', 'Day-to-day work with admin rights multiplies the impact of malware and credential theft.', 'Accounts', 'Privileged access', 9, 'Medium', 'Medium', ['T1078', 'T1548']],
  ['Disable NTLM authentication on workstations', 'NTLM enables pass-the-hash and relay attacks; Kerberos should be enforced wherever possible.', 'Network', 'Authentication', 8, 'High', 'Medium', ['T1550.002', 'T1557']],
  ['Require SMB signing on all servers', 'Servers accepting unsigned SMB are exposed to relay and man-in-the-middle attacks.', 'Network', 'File services', 6, 'Low', 'Low', ['T1557', 'T1021.002']],
  ['Enable attack surface reduction rule: block credential stealing from LSASS', 'Stops most commodity credential dumpers before they read LSASS memory.', 'Security controls', 'Attack surface reduction', 7, 'Low', 'Low', ['T1003.001']],
  ['Turn on tamper protection for every onboarded device', 'Prevents attackers from switching off the EDR sensor after gaining admin rights.', 'Security controls', 'EDR', 6, 'Low', 'Low', ['T1562.001']],
  ['Set account lockout threshold to 10 or fewer attempts', 'Slows password guessing and spraying against domain accounts.', 'Accounts', 'Password policy', 5, 'Low', 'Low', ['T1110.003']],
  ['Enable BitLocker on all portable devices', 'Unencrypted laptops expose all local data if lost or stolen.', 'OS', 'Encryption', 6, 'Medium', 'Low', ['T1005']],
  ['Disable the Remote Registry service', 'Reduces the remote attack surface for configuration changes and reconnaissance.', 'OS', 'Services', 4, 'Low', 'Low', ['T1012', 'T1112']],
];
const REC_SECTOR: Record<CustomerId, RecSeed[]> = {
  maritime: [
    ['Block USB mass storage on crane and bridge engineering stations', 'Removable media is the main route onto vessels and crane networks (IACS E26 4.3.3).', 'OS', 'Removable media', 9, 'Medium', 'Medium', ['T1091', 'T0847']],
    ['Restrict RDP from vessel networks to the PAM jump host only', 'Vessel-to-shore RDP bypasses the brokered access path.', 'Network', 'Remote access', 7, 'Medium', 'Low', ['T1021.001', 'T1133']],
  ],
  finserv: [
    ['Enforce FIDO2 for all Tier 0 and SWIFT operators', 'Push-based MFA can be fatigued or socially engineered (Scattered Spider).', 'Accounts', 'MFA', 10, 'Medium', 'Medium', ['T1621', 'T1078']],
    ['Enable Credential Guard on Citrix session hosts', 'Isolates LSASS secrets on the hosts traders and operations share.', 'Security controls', 'Credential protection', 8, 'Medium', 'Low', ['T1003.001']],
  ],
  media: [
    ['Block personal cloud storage clients on edit bays', 'Edit bays should only reach sanctioned transfer services (MPA DS-11).', 'Application', 'Data loss prevention', 9, 'Low', 'Medium', ['T1567.002']],
    ['Disable macOS AirDrop on content workstations', 'AirDrop can move locked cuts off-network with no log.', 'OS', 'Wireless', 6, 'Low', 'Low', ['T1011']],
  ],
  healthcare: [
    ['Set Imprivata tap-out and inactivity lock to 2 minutes on shared clinical workstations', 'Carts left logged into Epic expose charts to passers-by and enable session misuse.', 'Clinical', 'Shared workstations', 9, 'Low', 'Medium', ['T1078', 'T1213']],
    ['Remove internet access from imaging modality consoles and pump servers', 'Legacy Windows consoles on clinical VLANs should only reach PACS and vendor jump hosts (HPH CPG 2.7).', 'Network', 'Clinical VLANs', 10, 'High', 'Low', ['T0883', 'T1071.001']],
    ['Require phishing-resistant MFA for help-desk-resettable accounts', 'Help-desk resets are the entry point in most recent hospital ransomware cases.', 'Accounts', 'MFA', 10, 'Medium', 'Medium', ['T1621', 'T1098']],
    ['Enable Credential Guard on Epic Citrix VDAs', 'Protects clinician credentials on shared session hosts.', 'Security controls', 'Credential protection', 7, 'Medium', 'Low', ['T1003.001']],
    ['Block legacy TLS 1.0/1.1 on clinic Windows 10 kiosks', 'Check-in kiosks still negotiate weak TLS with the patient portal.', 'OS', 'Cryptography', 4, 'Low', 'Low', ['T1557']],
  ],
  automotive: [
    ['Block USB mass storage on plant engineering stations except signed maintenance keys', 'Removable media is the main path into cells and the air-gapped battery plant (IEC 62443 SR 2.3).', 'Plant', 'Removable media', 10, 'Medium', 'Medium', ['T1091', 'T0847']],
    ['Application allow-listing on WinCC HMIs where EDR is not supported', 'HMIs on LTSC 2019 cannot run the full EDR sensor; allow-listing closes the gap.', 'Plant', 'Application control', 9, 'High', 'Low', ['T1204.002', 'T1059']],
    ['Disable external Teams calls and chats from unknown tenants', 'Black Basta vishing starts with external Teams calls posing as IT support.', 'Application', 'Collaboration', 8, 'Low', 'Low', ['T1566.004', 'T1219']],
    ['Remove Quick Assist from managed devices', 'Remote support should go through the brokered tool, not Quick Assist.', 'Application', 'Remote support', 7, 'Low', 'Low', ['T1219']],
    ['Enforce code signing for all scripts on vehicle-software build servers', 'Unsigned scripts in CI can tamper with ECU builds before OTA signing.', 'Security controls', 'Supply chain', 8, 'Medium', 'Low', ['T1195.002', 'T1059']],
  ],
};

export function recommendations(c: CustomerProfile, tenantId: string) {
  const r = rng(`soc-recs-${c.id}-${tenantId}`);
  const share = tenantShare(c, tenantId);
  const tools = socTools(c, tenantId);
  const sum = deviceSummary(c, tenantId);
  const seeds = [...REC_SECTOR[c.id], ...REC_COMMON];
  const recs: Recommendation[] = seeds.map(([title, desc, category, sub, points, effort, userImpact, techniques], i) => ({
    id: `scid-${r.int(10, 140)}`,
    title, desc, category, sub, points, effort, userImpact, techniques,
    devices: Math.max(1, Math.round(sum.total * r.float(0.004, 0.06, 3) * (category === 'Clinical' || category === 'Plant' ? 0.6 : 1))),
    via: category === 'Network' ? 'Group Policy / firewall change' : category === 'Plant' ? `${c.people.otLead?.name ?? 'OT lead'} (site change, read-only for HexaView)` : `${tools.edrShort} / Intune policy`,
    status: (i % 7 === 3 ? 'in_progress' : i % 9 === 5 ? 'risk_accepted' : 'open') as Recommendation['status'],
  })).sort((a, b) => b.points - a.points);
  const maxScore = 100;
  const secureScore = Math.round((maxScore - recs.filter((x) => x.status !== 'risk_accepted').reduce((s, x) => s + x.points, 0) * 0.28) * 10) / 10;
  return { recs, secureScore, affected: Math.round(recs.reduce((s, x) => s + x.devices, 0) * 0.55), share };
}

/* =====================================================================
   Geo map: blocked connection attempts at the perimeter
   ===================================================================== */
const GEO: { cc: string; name: string; lat: number; lon: number; w: number }[] = [
  { cc: 'US', name: 'United States', lat: 39, lon: -98, w: 10 }, { cc: 'CN', name: 'China', lat: 35, lon: 104, w: 8 }, { cc: 'RU', name: 'Russia', lat: 56, lon: 38, w: 7 },
  { cc: 'NL', name: 'Netherlands', lat: 52.3, lon: 4.9, w: 5 }, { cc: 'SG', name: 'Singapore', lat: 1.35, lon: 103.8, w: 4.5 }, { cc: 'DE', name: 'Germany', lat: 50.1, lon: 8.7, w: 4 },
  { cc: 'FR', name: 'France', lat: 48.9, lon: 2.35, w: 3.6 }, { cc: 'BR', name: 'Brazil', lat: -23.5, lon: -46.6, w: 3.4 }, { cc: 'IN', name: 'India', lat: 19, lon: 72.8, w: 3.2 },
  { cc: 'VN', name: 'Vietnam', lat: 10.8, lon: 106.7, w: 2.8 }, { cc: 'KR', name: 'South Korea', lat: 37.5, lon: 127, w: 2.4 }, { cc: 'GB', name: 'United Kingdom', lat: 51.5, lon: -0.1, w: 2.4 },
  { cc: 'IR', name: 'Iran', lat: 35.7, lon: 51.4, w: 2.2 }, { cc: 'HK', name: 'Hong Kong', lat: 22.3, lon: 114.2, w: 2.1 }, { cc: 'BG', name: 'Bulgaria', lat: 42.7, lon: 23.3, w: 1.8 },
  { cc: 'UA', name: 'Ukraine', lat: 50.45, lon: 30.5, w: 1.6 }, { cc: 'RO', name: 'Romania', lat: 44.4, lon: 26.1, w: 1.5 }, { cc: 'KP', name: 'North Korea', lat: 39, lon: 125.7, w: 0.6 },
  { cc: 'ID', name: 'Indonesia', lat: -6.2, lon: 106.8, w: 1.6 }, { cc: 'TR', name: 'Turkey', lat: 41, lon: 29, w: 1.4 }, { cc: 'NG', name: 'Nigeria', lat: 6.5, lon: 3.4, w: 1 },
  { cc: 'JP', name: 'Japan', lat: 35.7, lon: 139.7, w: 1.4 }, { cc: 'CA', name: 'Canada', lat: 43.7, lon: -79.4, w: 1.3 }, { cc: 'AR', name: 'Argentina', lat: -34.6, lon: -58.4, w: 0.8 },
  { cc: 'ZA', name: 'South Africa', lat: -26.2, lon: 28, w: 0.8 }, { cc: 'MX', name: 'Mexico', lat: 19.4, lon: -99.1, w: 1.1 }, { cc: 'TW', name: 'Taiwan', lat: 25, lon: 121.5, w: 1 },
];
const PROTOCOLS: { name: string; port: number; w: number }[] = [
  { name: 'Telnet', port: 23, w: 9 }, { name: 'SSH', port: 22, w: 7 }, { name: 'HTTPS', port: 443, w: 6 }, { name: 'RDP', port: 3389, w: 5 }, { name: 'SMB', port: 445, w: 4.5 },
  { name: 'HTTP', port: 80, w: 4 }, { name: 'HTTP-alt', port: 8080, w: 2.4 }, { name: 'SIP', port: 5060, w: 1.6 }, { name: 'Modbus/TCP', port: 502, w: 1.2 }, { name: 'MSSQL', port: 1433, w: 1.4 },
  { name: 'DNS', port: 53, w: 1.2 }, { name: 'AMT', port: 16992, w: 0.6 },
];
const GEO_EXTRA: Record<CustomerId, { name: string; port: number; w: number; note: string }[]> = {
  maritime: [{ name: 'VSAT management', port: 8443, w: 2.2, note: 'Satellite terminal admin UI' }, { name: 'S7comm', port: 102, w: 0.8, note: 'Probes for crane PLCs' }],
  finserv: [{ name: 'SWIFT FIN (LAU)', port: 48002, w: 0.4, note: 'Never exposed: scans only' }, { name: 'IKE / IPsec', port: 500, w: 1.6, note: 'VPN concentrators' }],
  media: [{ name: 'Aspera FASP', port: 33001, w: 1.6, note: 'Content transfer gateway' }, { name: 'RTMP', port: 1935, w: 1.2, note: 'Live encoder ingest' }],
  healthcare: [{ name: 'DICOM', port: 104, w: 1.8, note: 'Scans for exposed PACS' }, { name: 'HL7 MLLP', port: 2575, w: 1.1, note: 'Interface engine probes' }, { name: 'Citrix ICA', port: 1494, w: 1.4, note: 'Epic Citrix gateway' }],
  automotive: [{ name: 'OPC UA', port: 4840, w: 1.6, note: 'Plant MES probes' }, { name: 'MQTT', port: 8883, w: 2.4, note: 'Telematics broker' }, { name: 'S7comm', port: 102, w: 1.0, note: 'Probes for plant PLCs' }],
};

export function geoThreats(c: CustomerProfile, tenantId: string, days: number) {
  const r = rng(`soc-geo-${c.id}-${tenantId}-${days}`);
  const share = tenantShare(c, tenantId);
  const sizeMul = ({ maritime: 1, finserv: 2.6, media: 0.9, healthcare: 1.5, automotive: 3.2 } as Record<CustomerId, number>)[c.id];
  const blocked = Math.round(42000 * sizeMul * share * days * r.float(0.85, 1.15, 2));
  const tw = GEO.reduce((s, g) => s + g.w, 0);
  const countries = GEO.map((g) => ({ ...g, count: Math.round((blocked * g.w * r.float(0.6, 1.4, 2)) / tw / 3) })).sort((a, b) => b.count - a.count);
  const protos = [...PROTOCOLS.map((p) => ({ ...p, note: '' })), ...GEO_EXTRA[c.id]];
  const pw = protos.reduce((s, p) => s + p.w, 0);
  const protocols = protos.map((p) => ({ ...p, count: Math.round((blocked * p.w * r.float(0.6, 1.4, 2)) / pw / 4) })).sort((a, b) => b.count - a.count);
  const targets = c.vocab.externalHosts.slice(0, 6).map((h, i) => ({ host: h, ip: `${r.pick([20, 52, 104, 145, 185])}.${r.int(10, 250)}.${r.int(0, 250)}.${r.int(2, 250)}`, count: Math.round(blocked * [0.31, 0.22, 0.16, 0.12, 0.1, 0.09][i]) }));
  const tenantsGeo = scopedTenants(c, tenantId);
  const feed = Array.from({ length: 14 }, (_, i) => {
    const g = r.weighted(countries.map((x) => [x, x.w] as const));
    const p = r.weighted(protocols.map((x) => [x, x.w] as const));
    const tg = r.pick(targets);
    return {
      sec: i * r.int(2, 9),
      srcIp: `${r.pick([45, 91, 103, 185, 194, 198, 203, 141, 162])}.${r.int(10, 250)}.${r.int(0, 250)}.${r.int(2, 250)}`,
      cc: g.cc, country: g.name, dest: tg.host, destIp: tg.ip, proto: p.name, port: p.port,
      action: r.chance(0.94) ? 'DENY' : 'DROP',
      reason: r.pick(['Geo policy', 'Threat intel (HexaInt)', 'IPS signature', 'Port not published', 'Rate limit', 'Known scanner']),
    };
  });
  const perimeter = c.connectors.filter((k) => k.category === 'Network' || k.category === 'SASE' || k.id === 'c-cloudflare').map((k) => `${k.vendor} ${k.product}`);
  return {
    blocked,
    locations: Math.round(blocked * r.float(0.045, 0.06, 3)),
    countries: Math.min(160, 96 + Math.round(Math.log10(blocked + 10) * 9)),
    activePorts: Math.round(blocked * r.float(0.08, 0.11, 3)),
    list: countries, protocols, targets, feed, tenants: tenantsGeo,
    perimeter: perimeter.length ? perimeter : [`${socTools(c, tenantId).siemShort} (firewall logs)`],
  };
}

/* =====================================================================
   Identity: users, sync source, Conditional Access, risk
   ===================================================================== */
export interface IdUser {
  name: string;
  upn: string;
  role: string;
  tenantId: string;
  source: 'Hybrid' | 'Cloud only' | 'Guest (B2B)' | 'Shared / kiosk';
  enabled: boolean;
  ca: 'Passed' | 'Not applied' | 'Failed';
  mfa: 'FIDO2 / passkey' | 'Authenticator push' | 'Number matching' | 'SMS' | 'Badge tap (Imprivata)' | 'None';
  risk: 'none' | 'low' | 'medium' | 'high';
  privileged: boolean;
  vip: boolean;
  lastApp: string;
  lastLoc: string;
  lastMin: number;
  signins7d: number;
  failed7d: number;
}

const ID_APPS: Record<CustomerId, string[]> = {
  maritime: ['Navis N4 (TOS)', 'SAP S/4HANA', 'Outlook Web', 'Microsoft Teams', 'CyberArk PVWA', 'Windows Sign In'],
  finserv: ['Okta Dashboard', 'Bloomberg Terminal SSO', 'SWIFT Alliance Web', 'Outlook Web', 'Salesforce FSC', 'Windows Sign In'],
  media: ['Okta Dashboard', 'Avid NEXIS', 'Frame.io', 'Google Workspace', 'Aspera on Cloud', 'Windows Sign In'],
  healthcare: ['Epic Hyperspace (Citrix)', 'Workday', 'Outlook Web', 'Microsoft Teams', 'Imprivata OneSign', 'PACS viewer', 'Windows Sign In'],
  automotive: ['Teamcenter PLM', 'SAP S/4HANA', 'Outlook Web', 'Microsoft Teams', 'BeyondTrust PRA', 'Supplier portal', 'Windows Sign In'],
};
const ID_EXTRA: Record<CustomerId, [string, string, IdUser['source']][]> = {
  maritime: [['Svc-Navis-Integration', 'Service account', 'Hybrid'], ['Konecranes Field Engineer', 'Vendor (B2B guest)', 'Guest (B2B)'], ['Bridge Officer (shared)', 'Vessel shared logon', 'Shared / kiosk']],
  finserv: [['Svc-SWIFT-Batch', 'Service account', 'Hybrid'], ['Accenture Contractor', 'Vendor (B2B guest)', 'Guest (B2B)'], ['Trading Floor Kiosk', 'Shared kiosk', 'Shared / kiosk']],
  media: [['Svc-MAM-Ingest', 'Service account', 'Cloud only'], ['Red Fern Localisation', 'Vendor (B2B guest)', 'Guest (B2B)'], ['Edit Bay 4 (shared)', 'Shared workstation', 'Shared / kiosk']],
  healthcare: [['Svc-Epic-Interconnect', 'Service account', 'Hybrid'], ['GE HealthCare Field Engineer', 'Biomed vendor (B2B guest)', 'Guest (B2B)'], ['3 East Nursing Station', 'Shared clinical workstation', 'Shared / kiosk'], ['Agency Nurse (travel)', 'Contract clinician', 'Cloud only'], ['Svc-Alaris-Gateway', 'Medical device service account', 'Hybrid']],
  automotive: [['Svc-OTA-Pipeline', 'Service account (release pipeline)', 'Cloud only'], ['KUKA Service Engineer', 'Robot OEM (B2B guest)', 'Guest (B2B)'], ['Bosch ECU Engineer', 'Tier 1 supplier (B2B guest)', 'Guest (B2B)'], ['Line 3 Shift Lead (shared)', 'Plant shared logon', 'Shared / kiosk'], ['Dealer Admin (Lyon)', 'Dealer user', 'Guest (B2B)']],
};
const LOCS: Record<CustomerId, string[]> = {
  maritime: ['Rotterdam, NL', 'Antwerp, BE', 'Port Klang, MY', 'Santos, BR', 'London, GB', 'At sea (VSAT)'],
  finserv: ['London, GB', 'Edinburgh, GB', 'Luxembourg, LU', 'New York, US', 'Singapore, SG', 'Remote'],
  media: ['London, GB', 'Los Angeles, US', 'Atlanta, US', 'Vancouver, CA', 'Remote'],
  healthcare: ['Columbus, OH', 'Zanesville, OH', 'Marion, OH', 'Chillicothe, OH', 'Dublin, OH', 'Remote'],
  automotive: ['Munich, DE', 'Ingolstadt, DE', 'Győr, HU', 'Puebla, MX', 'Salzgitter, DE', 'Stuttgart, DE', 'Remote'],
};

export function identityUsers(c: CustomerProfile, tenantId: string): { users: IdUser[]; total: number; hybrid: number; cloud: number; guests: number; enabled: number; disabled: number; caFailed: number; risky: number; mfaPct: number; privileged: number; methods: { name: string; value: number }[] } {
  const r = rng(`soc-identity-${c.id}-${tenantId}`);
  const tids = scopedTenants(c, tenantId).map((t) => t.id);
  const domain = c.domain;
  const ppl = [c.people.board, c.people.ciso, c.people.socLead, c.people.grcLead, ...(c.people.otLead ? [c.people.otLead] : []), c.people.admin, ...c.people.staff];
  const apps = ID_APPS[c.id];
  const locs = LOCS[c.id];
  const mk = (name: string, role: string, src: IdUser['source'], vip: boolean, privileged: boolean, email?: string): IdUser => {
    const risk = r.weighted<IdUser['risk']>([['none', 7], ['low', 2], ['medium', 1.1], ['high', src === 'Guest (B2B)' ? 0.8 : 0.35]]);
    const mfa: IdUser['mfa'] = src === 'Shared / kiosk' ? (c.id === 'healthcare' ? 'Badge tap (Imprivata)' : 'None') : privileged ? r.pick(['FIDO2 / passkey', 'Number matching'] as const) : r.weighted<IdUser['mfa']>([['Number matching', 5], ['Authenticator push', 3], ['FIDO2 / passkey', 2], ['SMS', src === 'Guest (B2B)' ? 2 : 0.7]]);
    const ca: IdUser['ca'] = risk === 'high' && r.chance(0.6) ? 'Failed' : src === 'Shared / kiosk' || r.chance(0.12) ? 'Not applied' : 'Passed';
    return {
      name, role, source: src, tenantId: r.pick(tids),
      upn: email ?? `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@${domain}`,
      enabled: r.chance(0.93), ca, mfa, risk, privileged, vip,
      lastApp: r.pick(apps), lastLoc: r.pick(locs), lastMin: r.int(1, 4000),
      signins7d: r.int(6, 260), failed7d: risk === 'high' ? r.int(8, 60) : r.int(0, 6),
    } as IdUser;
  };
  const users: IdUser[] = [
    ...ppl.map((p, i) => mk(p.name, p.role, i % 5 === 3 ? 'Cloud only' : 'Hybrid', !!p.vip || i === 0, /CISO|Admin|Administrator|Platform|Security Operations|Cyber Defence/i.test(p.role), p.email)),
    ...ID_EXTRA[c.id].map(([n, role, src]) => mk(n, role, src, false, role.includes('Service'))),
  ];
  const share = tenantShare(c, tenantId);
  const total = Math.round(c.employees * 1.35 * share);
  const guests = Math.round(total * r.float(0.04, 0.09, 3));
  const cloud = Math.round(total * r.float(0.12, 0.22, 3));
  const disabled = Math.round(total * r.float(0.05, 0.09, 3));
  const mfaPct = r.float(c.id === 'healthcare' ? 91 : 95, 99.4, 1);
  const methods = [
    { name: 'Number matching', value: r.int(42, 55) },
    { name: 'FIDO2 / passkey', value: r.int(8, c.id === 'finserv' ? 30 : 18) },
    { name: 'Authenticator push', value: r.int(12, 22) },
    ...(c.id === 'healthcare' ? [{ name: 'Badge tap (Imprivata)', value: r.int(14, 22) }] : []),
    { name: 'SMS', value: r.int(2, 7) },
  ];
  return {
    users, total, hybrid: total - cloud - guests, cloud, guests, enabled: total - disabled, disabled,
    caFailed: Math.round(total * r.float(0.003, 0.009, 4)), risky: Math.round(total * r.float(0.002, 0.006, 4)) + users.filter((u) => u.risk === 'high').length,
    mfaPct, privileged: Math.round(total * 0.011), methods,
  };
}

/* =====================================================================
   Insight: advisories, incident write-ups and patch notes from the SOC
   ===================================================================== */
export type InsightCat = 'Incident report' | 'Advisory' | 'Phishing' | 'Patch update' | 'Threat brief';
export interface Insight {
  id: string;
  cat: InsightCat;
  daysAgo: number;
  read: number;
  title: string;
  summary: string;
  body: string[];
  actions: string[];
  techniques: string[];
  author: string;
}

type InsSeed = [InsightCat, number, string, string, string[], string[], string[]];
const INSIGHTS: Record<CustomerId, InsSeed[]> = {
  maritime: [
    ['Incident report', 4, 'Out-of-window crane vendor session contained at Rotterdam', 'A Konecranes engineer reached an STS crane PLC outside the approved window. The session was cut at the jump host by site staff within 11 minutes; no logic change reached the controller.', ['HexaOT flagged an engineering session on the crane network at 02:14 with no matching window in CyberArk.', 'The on-shift analyst confirmed the vendor identity with Konecranes, while the site OT lead suspended the jump item (OT stays read-only for HexaView).', 'Dragos confirmed no program download occurred. The vendor had reused a shared account from a previous job.'], ['Move the vendor to named accounts in CyberArk', 'Enable the staged "vendor session outside window" rule at Antwerp'], ['T1133', 'T0886']],
    ['Advisory', 12, 'GNSS interference hotspots: Black Sea and Strait of Hormuz', 'Spoofing incidents rose this month. Bridge teams should cross-check ECDIS against radar and visual fixes in these regions.', ['HexaInt and the Maritime ISAC report a rise in GNSS spoofing that places vessels at inland airports.', 'Your fleet logged 3 position jumps; all correlated with known interference areas, not onboard compromise.'], ['Brief masters before transits', 'Keep the AIS/ECDIS mismatch rule enabled fleet-wide'], ['T0832', 'T0855']],
    ['Phishing', 20, 'Bill-of-lading lures with HTML smuggling', 'A campaign is sending fake bills of lading that assemble a malicious ZIP in the browser. Proofpoint caught 96%; the rest were stopped at execution by Defender.', ['Lures reference real vessel names scraped from AIS.', 'Two users opened the attachment; Defender blocked the second stage.'], ['Report lookalike-domain emails with the Report button', 'Block HTML attachments from external senders'], ['T1566.001', 'T1027']],
    ['Patch update', 27, 'October patch priorities: PAN-OS and Veeam first', 'The GlobalProtect gateway and the Veeam server carry KEV-listed flaws that ransomware crews exploit. Patch those before the monthly Windows cycle.', ['Both systems are internet-reachable or hold backups, so they rank above the browser updates.'], ['Upgrade PAN-OS this week', 'Upgrade Veeam B&R to 12.2'], ['T1190']],
    ['Threat brief', 36, 'Volt Typhoon and ports: what living-off-the-land looks like in a terminal', 'State actors pre-position in transport networks using built-in tools. This brief shows the four hunts we run against your TOS and historian servers.', ['No evidence of Volt Typhoon activity was found in the last cycle.'], ['Keep PowerShell script-block logging on terminal servers'], ['T1047', 'T1003.001']],
  ],
  finserv: [
    ['Incident report', 3, 'Help-desk social-engineering attempt on a Tier 0 admin stopped', 'A caller impersonated a platform engineer to get an MFA reset. The service desk call-back control held; Okta shows no follow-on sign-in.', ['The caller knew the employee ID and manager’s name, both available from LinkedIn and a 2023 breach.', 'HexaSOC correlated the ServiceNow ticket with Okta factor-reset attempts and blocked the reset.'], ['Keep call-back verification for all privileged resets', 'Move Tier 0 to FIDO2 keys'], ['T1078', 'T1098']],
    ['Advisory', 10, 'Cleo and MOVEit-style MFT exploitation wave', 'Cl0p-linked actors are again mass-exploiting file transfer servers. Your Cleo instance is patched; one test server was not.', ['The test server held no customer data but was internet-facing.'], ['Decommission the test MFT server', 'Monitor Autorun folder writes'], ['T1190', 'T1505.003']],
    ['Phishing', 18, 'Fake "secure message" lures targeting Wealth clients', 'Clients received emails mimicking our secure-message portal. HexaInt took down 4 domains within 6 hours.', ['No staff accounts were affected; the lure targeted customers.'], ['Remind clients we never ask for one-time codes'], ['T1566.002', 'T1598']],
    ['Patch update', 25, 'Patch priorities: NetScaler, FortiClient EMS, Chrome', 'Two remote-access products carry KEV flaws. NetScaler sessions must be killed after the upgrade.', ['Citrix Bleed-style token theft bypasses MFA, so the session reset is not optional.'], ['Upgrade NetScaler and kill sessions', 'Upgrade FortiClient EMS'], ['T1190', 'T1539']],
    ['Threat brief', 33, 'Lazarus and SWIFT: what changed this year', 'APT38 tradecraft now leans on fake job offers to developers. This brief maps the techniques to your SWIFT secure zone controls.', ['All CSCF mandatory controls remain in place; two advisory controls are partially met.'], ['Run the SWIFT tabletop with Operations'], ['T1566.001', 'T1021.001']],
  ],
  media: [
    ['Incident report', 5, 'Screener leak traced by watermark to a single review account', 'Frames posted to a leak forum carried a watermark that matched one reviewer account. Access was revoked in under 2 minutes across all screeners.', ['HexaInt spotted the post; HexaCustody extracted the watermark and named the session.'], ['Enforce device binding on screener links'], ['T1567.002', 'T1213']],
    ['Advisory', 13, 'Akira targets ESXi in post-production', 'Akira operators are hitting render farms through VPNs without MFA, then encrypting ESXi datastores.', ['Your render farm ESXi hosts are patched; one still uses the default AD admin group.'], ['Change the ESXi AD admin group'], ['T1486', 'T1133']],
    ['Phishing', 21, 'Casting-call lures with ISO attachments', 'Agents and talent services received fake casting calls carrying loaders inside ISO files.', ['23 copies were purged from Google Workspace.'], ['Block ISO attachments from external senders'], ['T1566.001', 'T1204.002']],
    ['Patch update', 28, 'Patch priorities: TeamCity and PHP review portal', 'The build server and the review portal carry KEV-listed flaws.', ['Both are internet-facing.'], ['Upgrade TeamCity', 'Upgrade PHP'], ['T1190']],
  ],
  healthcare: [
    ['Incident report', 3, 'Help-desk MFA reset abused to reach Epic: contained in 26 minutes', 'An attacker phoned the service desk as a nurse manager, got an MFA reset and signed into Epic Hyperspace from a new ASN. HexaSOC revoked sessions and locked the account before any chart was exported.', ['Entra ID flagged the sign-in as risky; the HexaSOC Triage agent correlated it with a ServiceNow reset ticket opened 9 minutes earlier.', 'FairWarning showed 4 charts opened, none exported. Privacy completed the HIPAA four-factor assessment: low probability of compromise, no notification required.', 'The caller used details from a 2024 stealer log on a personal device.'], ['Enforce video or in-person verification for clinical MFA resets', 'Enrol help-desk-resettable accounts in phishing-resistant MFA'], ['T1078', 'T1098', 'T1621']],
    ['Advisory', 9, 'Rhysida and Qilin are hitting US hospitals through Citrix and VPN', 'Both groups are exploiting unpatched gateways and remote-access tools, then encrypting Epic downtime PCs and file servers. HHS HC3 has issued a sector alert.', ['Your NetScaler is patched for Citrix Bleed; CitrixBleed 2 is patched on the primary pair but not the DR pair.', 'We added hunts for AnyDesk and ScreenConnect on Citrix VDAs and Epic print servers.'], ['Patch the DR NetScaler pair this week', 'Confirm Epic downtime (BCA) PCs are on immutable backup'], ['T1190', 'T1219', 'T1486']],
    ['Phishing', 16, 'Fake MyChart and payroll lures to nursing staff', 'Lures promise shift bonuses or warn of MyChart password expiry. Mimecast blocked most; 3 users entered credentials and were reset within minutes.', ['The lookalike domains were taken down by HexaInt.'], ['Report suspicious email with the Mimecast button', 'Never approve an MFA prompt you did not start'], ['T1566.002', 'T1657']],
    ['Patch update', 23, 'Patch priorities: NetScaler, Citrix Workspace app, Veeam', 'Remote-access and backup systems come before the monthly Windows cycle. Clinical workstation updates follow the Epic validation calendar.', ['Shared clinical workstations need the Workspace app fix because any user can sign in to them.'], ['Upgrade NetScaler DR pair', 'Roll Workspace app 2403.1 to carts after Epic validation'], ['T1190', 'T1068']],
    ['Threat brief', 31, 'Medical devices and ransomware: what actually reaches the pumps', 'Ransomware rarely targets infusion pumps directly, but takes down the servers they depend on. This brief maps your Alaris, PACS and nurse-call dependencies.', ['Claroty shows 1,140 legacy devices still on flat clinical VLANs at the community hospitals.'], ['Segment the community hospital clinical VLANs', 'Test Alaris downtime procedures with nursing'], ['T0883', 'T0886', 'T1486']],
    ['Incident report', 40, 'Inappropriate access to a VIP patient record', 'FairWarning flagged a staff member opening a local news anchor’s chart without a care relationship. HR and Privacy handled it under the sanctions policy.', ['The access was read-only; no data left Epic.'], ['Re-run VIP privacy training for the ED registration team'], ['T1213']],
  ],
  automotive: [
    ['Incident report', 2, 'Black Basta precursors at Plant Ingolstadt stopped before encryption', 'A Cobalt Strike beacon and a shadow-copy deletion on ING-MES-PRD01 were caught by Defender. The host was contained with plant approval; the line kept running on the secondary MES node.', ['Initial access was a Teams vishing call that led to Quick Assist on an engineer’s laptop.', 'The response agent proposed containment; Mateo Hernández approved it after confirming the MES fail-over.', 'No PLC change was observed by Armis during the incident.'], ['Block external Teams calls from unknown tenants', 'Remove Quick Assist from managed devices'], ['T1566.004', 'T1219', 'T1490']],
    ['Advisory', 8, 'Vehicle API abuse wave: remote-unlock enumeration', 'Attackers are replaying leaked app tokens against connected-car APIs across the industry. Upstream vSOC shows the same pattern on api.vireoconnect.com.', ['Rate limits held, but 312 vehicles received unexpected commands.', 'Token binding to the app instance closes the gap; it is staged for the 24.10 app release.'], ['Ship token binding in app 24.10', 'Notify affected owners through dealers'], ['T1190', 'T1550.001']],
    ['Phishing', 15, 'Supplier bank-change fraud using lookalike domains', 'Fraudsters impersonate Tier 2 suppliers to change bank details in SAP. Two attempts were blocked by the call-back control.', ['SAP ETD flagged the vendor-master change requests.'], ['Always call back on the master-data number', 'Keep the SAP field-drift fix on track'], ['T1657', 'T1565.001']],
    ['Patch update', 22, 'Patch priorities: TeamCity, FortiOS SSL VPN, Windows Error Reporting', 'The vehicle-software build server and the supplier VPN carry KEV-listed flaws. Plant HMIs follow the plant change calendar.', ['CVE-2024-26169 is used by Black Basta for privilege escalation.'], ['Upgrade TeamCity and rotate build secrets', 'Upgrade FortiOS at Puebla'], ['T1190', 'T1068']],
    ['Threat brief', 30, 'APT41 and automotive software supply chains', 'APT41 targets build systems and signing keys. This brief maps the techniques to your OTA pipeline and R156 controls.', ['Your HSM requires dual control; one operator credential appeared in a supplier stealer log and has been rotated.'], ['Review OTA signing ceremony evidence monthly'], ['T1195.002', 'T1078']],
    ['Advisory', 44, 'Air-gapped battery plant: what the offline bundles told us this quarter', 'Every 6-hour bundle from Salzgitter was imported and analysed. One removable-media event was approved maintenance; no other anomalies.', ['The data diode and signed bundles give evidence for IEC 62443 SR 6.2 without a network path out.'], ['Keep USB keys signed and registered'], ['T0847', 'T1091']],
  ],
};

export function insights(c: CustomerProfile): Insight[] {
  const r = rng(`soc-insight-${c.id}`);
  return INSIGHTS[c.id].map(([cat, daysAgo, title, summary, body, actions, techniques], i) => ({
    id: `INS-${r.int(100, 999)}${i}`,
    cat, daysAgo, title, summary, body, actions, techniques,
    read: Math.max(2, Math.round((summary.length + body.join(' ').length) / 260)),
    author: cat === 'Incident report' ? HEXASOC_ANALYSTS[4] : cat === 'Patch update' ? 'HexaSOC Vulnerability desk' : 'HexaInt analyst team',
  })).sort((a, b) => a.daysAgo - b.daysAgo);
}

/* =====================================================================
   Reports: monthly and quarterly SOC reports
   ===================================================================== */
export interface SocReport {
  id: string;
  kind: 'Monthly' | 'Quarterly';
  title: string;
  period: string;
  generatedDaysAgo: number;
  alerts: number;
  incidents: number;
  truePositives: number;
  benign: number;
  mttd: number;
  mttr: number;
  slaPct: number;
  coveragePct: number;
  alertDeltaPct: number;
  summary: string;
  highlights: string[];
  focus: string[];
  tactics: { tactic: string; count: number }[];
}

const REPORT_FOCUS: Record<CustomerId, string[]> = {
  maritime: ['Vendor remote access to cranes and vessels', 'Removable media on board', 'Ransomware readiness for TOS and SAP'],
  finserv: ['Help-desk and MFA social engineering', 'SWIFT secure zone', 'DORA major-incident classification'],
  media: ['Pre-release content custody', 'Vendor access to content', 'Subscriber credential stuffing'],
  healthcare: ['Help-desk reset abuse and Epic access', 'Ransomware readiness for Epic downtime', 'Medical device segmentation', 'HIPAA breach assessments'],
  automotive: ['Plant ransomware readiness', 'OTA signing integrity (R156)', 'Vehicle API abuse (R155)', 'Design IP (TISAX prototype)'],
};

export function socReports(c: CustomerProfile, tenantId: string): SocReport[] {
  const h = headlines(c, tenantId).soc;
  const r = rng(`soc-reports-${c.id}-${tenantId}`);
  const out: SocReport[] = [];
  const now = new Date();
  const focus = REPORT_FOCUS[c.id];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const alerts = Math.round(h.alerts24h * 30 * r.float(0.88, 1.08, 2));
    const incidentsN = Math.round(alerts * (1 - h.autoTriagedPct / 100) * r.float(0.04, 0.055, 3));
    const tps = Math.max(2, Math.round(incidentsN * r.float(0.12, 0.22, 2)));
    const delta = r.int(-12, 9);
    const tactics = ['Initial Access', 'Credential Access', 'Execution', 'Defense Evasion', 'Lateral Movement', 'Impact'].map((t) => ({ tactic: t, count: r.int(1, Math.max(3, Math.round(incidentsN / 4))) })).sort((a, b) => b.count - a.count);
    const lead = r.pick(c.vocab.threatActors);
    out.push({
      id: `RPT-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      kind: 'Monthly',
      title: `Security Operations Report: ${month}`,
      period: month,
      generatedDaysAgo: Math.max(1, Math.round((now.getTime() - new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()) / 86400000) + 1),
      alerts, incidents: incidentsN, truePositives: tps, benign: alerts - tps,
      mttd: Math.max(2, h.mttdMin + r.int(-1, 3)), mttr: Math.max(15, h.mttrMin + r.int(-6, 14)),
      slaPct: Math.min(100, h.slaPct - r.float(0, 0.08, 2)), coveragePct: Math.max(30, h.attackCoveragePct - i + r.int(-1, 1)),
      alertDeltaPct: delta,
      summary: `${month.split(' ')[0]} was ${delta < 0 ? 'quieter' : 'busier'} than the month before across ${c.short}: alert volume ${delta < 0 ? 'fell' : 'rose'} ${Math.abs(delta)}% while every incident was triaged inside the agreed SLA. ${tps} alerts were confirmed as true positives and contained without business impact; the most significant involved ${focus[i % focus.length].toLowerCase()}. ${lead} tradecraft remained the main sector threat we tuned for.`,
      highlights: [
        `${fmtCompactLocal(alerts)} alerts triaged, ${h.autoTriagedPct}% closed by HexaSOC agents with an explained verdict`,
        `${incidentsN} incidents raised, ${tps} true positives, none with business impact`,
        `ATT&CK coverage at ${Math.max(30, h.attackCoveragePct - i)}% (${i === 1 ? '+1' : '+' + r.int(0, 2)} pts); ${r.int(3, 11)} new detections from hunts and intel`,
        `MTTD ${Math.max(2, h.mttdMin + r.int(-1, 3))} min · MTTR ${Math.max(15, h.mttrMin + r.int(-6, 14))} min against SLA 15 / 60 min`,
      ],
      focus: [focus[(i + 1) % focus.length], focus[(i + 2) % focus.length]],
      tactics,
    });
  }
  // Two quarterlies built from the monthlies.
  for (let q = 0; q < 2; q++) {
    const ms = out.slice(q * 3, q * 3 + 3);
    const qEnd = new Date(now.getFullYear(), now.getMonth() - q * 3 - 1, 1);
    const qn = Math.floor(qEnd.getMonth() / 3) + 1;
    const label = `Q${qn} ${qEnd.getFullYear()}`;
    const sumBy = (k: 'alerts' | 'incidents' | 'truePositives' | 'benign') => ms.reduce((s, x) => s + x[k], 0);
    out.push({
      ...ms[0],
      id: `RPT-Q${qn}-${qEnd.getFullYear()}-${q}`,
      kind: 'Quarterly',
      title: `Security Operations Report: ${label}`,
      period: label,
      generatedDaysAgo: ms[0].generatedDaysAgo + 4,
      alerts: sumBy('alerts'), incidents: sumBy('incidents'), truePositives: sumBy('truePositives'), benign: sumBy('benign'),
      summary: `The quarter closed with ${sumBy('truePositives')} confirmed true positives out of ${fmtCompactLocal(sumBy('alerts'))} alerts across ${c.short}. Detection and response times stayed inside SLA every month, and coverage of the techniques used by ${c.vocab.threatActors.slice(0, 2).join(' and ')} improved. Board-level focus for next quarter: ${focus.slice(0, 2).join(' and ').toLowerCase()}.`,
    });
  }
  return out;
}

function fmtCompactLocal(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n.toLocaleString('en-GB');
}
