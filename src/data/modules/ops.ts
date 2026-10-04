// Platform Operations data: gated write-back (Action Centre), the hash-chained
// audit ledger, crisis war room scenarios, tool scorecards, peer benchmarks,
// trust sharing, service consumption and administration. All dummy, seeded
// per customer and tenant so it is stable across reloads.
import type { CapabilityId, Connector, ConnectorCategory, CustomerId, CustomerProfile, ServiceId } from '../types';
import { rng } from '../../lib/rng';
import { headlines, resilienceIndex, loops, loopSummary } from '../core';
import { scopedConnectors, scopedTenants, tenantShare, scale } from '../customers';
import { forCustomer, type CustomerMap } from '../customerMap';
import { fxFromUsd } from '../../lib/format';

/* =====================================================================
   People and roles
   ===================================================================== */
export type HvRole = 'Analyst' | 'Approver' | 'Tenant Admin' | 'GRC' | 'Auditor' | 'Board viewer' | 'OT engineer' | 'Support (read-only)';
export const HV_ROLES: { role: HvRole; can: string }[] = [
  { role: 'Analyst', can: 'Investigate, request actions, use the copilot' },
  { role: 'Approver', can: 'Approve low and medium actions' },
  { role: 'Tenant Admin', can: 'Approve high actions, manage users, connectors and policy' },
  { role: 'GRC', can: 'Controls, evidence, frameworks; approve low GRC actions' },
  { role: 'Auditor', can: 'Read-only, ledger verification and export' },
  { role: 'Board viewer', can: 'Board view and reports only' },
  { role: 'OT engineer', can: 'OT views (read-only by policy), no write-back' },
  { role: 'Support (read-only)', can: 'HexaShield staff, time-boxed, approved per session' },
];

export interface Me {
  name: string;
  email: string;
  title: string;
  role: HvRole;
}

/** The signed-in persona, consistent with the avatar in the top bar. */
export function signedIn(c: CustomerProfile, persona: string): Me {
  const p = c.people;
  if (persona === 'master') return { ...pick(p.admin), title: 'Master user (Admin)', role: 'Tenant Admin' };
  if (persona === 'executive' || persona === 'ciso' || persona === 'finance') return { ...pick(p.ciso), role: 'Tenant Admin' };
  if (persona === 'analyst' || persona === 'socmanager' || persona === 'threat') return { ...pick(p.socLead), role: 'Approver' };
  if (persona === 'grc' || persona === 'risk' || persona === 'privacy') return { ...pick(p.grcLead), role: 'GRC' };
  if (persona === 'ot') return { ...pick(p.otLead ?? p.admin), role: 'OT engineer' };
  return { ...pick(p.admin), role: 'Tenant Admin' };
}
function pick(x: { name: string; email: string; role: string }) {
  return { name: x.name, email: x.email, title: x.role };
}

/** Extra named users who are not personas: duty approvers, analysts, auditors, support. */
const EXTRA: CustomerMap<{ approver: string; analysts: string[]; auditor: string; support: string; partner: string }> = {
  maritime: { approver: 'Kees Vermeulen', analysts: ['Nadia El Amrani', 'Thijs Mulder', 'Rizal Hakim'], auditor: 'Lotte Smit', support: 'J. Okonkwo (HexaShield)', partner: 'Northbridge Cyber' },
  finserv: { approver: 'Aisha Mensah', analysts: ['Rhys Morgan', 'Chen Wei', 'Dominika Nowak'], auditor: 'Olivia Hart', support: 'M. Ferreira (HexaShield)', partner: 'Castlegate Managed Security' },
  media: { approver: 'Diego Alvarez', analysts: ['Tasha Reed', 'Sam Patel', 'Noor Haddad'], auditor: 'Grace Kim', support: 'L. Andersson (HexaShield)', partner: 'Silverscreen Secure' },
  healthcare: { approver: 'Marcus Bell', analysts: ['Keisha Robinson', 'Daniel Ortiz', 'Mei Chen'], auditor: 'Patricia Hollis', support: 'A. Delgado (HexaShield)', partner: 'Buckeye Health Cyber' },
  automotive: { approver: 'Stefan Richter', analysts: ['Lea Zimmermann', 'Murat Yılmaz', 'Anna Kowalczyk'], auditor: 'Thomas Weber', support: 'C. Hartmann (HexaShield)', partner: 'Isar Cyber Defence GmbH' },
  insurance: { approver: 'Colleen Murphy', analysts: ['Tyrone Jackson', 'Mei-Ling Wu', 'Patrick Sullivan'], auditor: 'Deborah Klein', support: 'S. Novak (HexaShield)', partner: 'Charter Oak Cyber Partners' },
  defence: { approver: 'Wesley Grant', analysts: ['Kayla Simmons', 'Marcus Webb', 'Jordan Ellis'], auditor: 'Patricia Lowe', support: 'T. Bennett (HexaShield, US person)', partner: 'Rocket City Managed Security' },
  pharma: { approver: 'Simon Baumann', analysts: ['Lea Fischer', 'Aoife Byrne', 'Matteo Russo'], auditor: 'Corinne Vogel', support: 'P. Gruber (HexaShield)', partner: 'Rheinknie Cyber AG' },
  sghospital: { approver: 'Kelvin Lau', analysts: ['Siti Aminah', 'Ravi Shankar', 'Joanne Lim'], auditor: 'Patricia Goh', support: 'W. Tan (HexaShield)', partner: 'Merlion Health Cyber' },
  studio: { approver: 'Victor Morales', analysts: ['Kiara Johnson', 'Ethan Park', 'Lucia Romero'], auditor: 'Harold Benson', support: 'N. Price (HexaShield)', partner: 'Cahuenga Secure' },
};
export function extraPeople(c: CustomerProfile) {
  return forCustomer(EXTRA, c);
}

/* =====================================================================
   Action Centre (LLD 8): risk classes, OpenC2 envelopes, lifecycle
   ===================================================================== */
export type Risk = 'low' | 'medium' | 'high' | 'critical';
export const RISK_COLOR: Record<Risk, string> = { low: 'var(--sev-low)', medium: 'var(--sev-medium)', high: 'var(--sev-high)', critical: 'var(--sev-critical)' };
export const RISK_RULES: Record<Risk, { approvers: number; who: string; expiryH: number | null; examples: string }> = {
  low: { approvers: 1, who: '1 approver', expiryH: 24, examples: 'Enable / disable rule, update control status' },
  medium: { approvers: 1, who: '1 approver with the Approver role', expiryH: 24, examples: 'Deploy rule, add IOC, block address' },
  high: { approvers: 2, who: '2 approvers incl. a Tenant Admin', expiryH: 4, examples: 'Revoke sessions, contain host, irreversible changes' },
  critical: { approvers: 0, who: 'Not available', expiryH: null, examples: 'Not offered by HexaView' },
};

export function riskOf(write: string): Risk {
  const w = write.toLowerCase();
  if (/revoke|clear sessions|contain|rotate|terminate/.test(w)) return 'high';
  if (/deploy|add|block|quarantine|watermark/.test(w)) return 'medium';
  return 'low';
}

export function openc2For(write: string): { action: string; target: string } {
  const w = write.toLowerCase();
  if (w.includes('revoke access')) return { action: 'deny', target: 'x-hexacustody:access_grant' };
  if (/revoke|clear sessions/.test(w)) return { action: 'deny', target: 'x-idp:user_session' };
  if (w.includes('contain host')) return { action: 'contain', target: 'device' };
  if (w.includes('terminate session')) return { action: 'stop', target: 'x-pam:remote_session' };
  if (w.includes('block sender')) return { action: 'deny', target: 'email_addr' };
  if (w.includes('rotate')) return { action: 'update', target: 'x-pam:credential' };
  if (w.includes('deploy')) return { action: 'create', target: 'x-siem:analytic_rule' };
  if (w.includes('enable')) return { action: 'set', target: 'x-siem:rule_state' };
  if (w.includes('url category')) return { action: 'deny', target: 'uri' };
  if (w.includes('app instance')) return { action: 'deny', target: 'x-sse:app_instance' };
  if (w.includes('waf')) return { action: 'deny', target: 'x-waf:rule' };
  if (w.includes('quarantine')) return { action: 'contain', target: 'x-email:message' };
  if (w.includes('block list') || w.includes('address')) return { action: 'deny', target: 'ipv4_net' };
  if (w.includes('blocklist')) return { action: 'deny', target: 'file' };
  if (w.includes('ioc') || w.includes('indicator')) return { action: 'deny', target: 'domain_name' };
  if (w.includes('control status')) return { action: 'update', target: 'x-grc:control' };
  if (w.includes('evidence')) return { action: 'create', target: 'x-grc:evidence' };
  if (w.includes('watermark')) return { action: 'set', target: 'x-custody:watermark_policy' };
  if (w.includes('schedule')) return { action: 'start', target: 'x-validation:test' };
  return { action: 'create', target: 'x-itsm:ticket' };
}

export const LIFECYCLE_STATES = [
  'Requested', 'PolicyDenied', 'PendingApproval', 'Approved', 'Rejected', 'Expired', 'Dispatched', 'AgentRefused', 'DispatchExpired',
  'Executing', 'Failed', 'Applied', 'Verified', 'VerifyFailed', 'RollingBack', 'RolledBack', 'RollbackFailed',
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];
export const HAPPY_PATH: LifecycleState[] = ['Requested', 'PendingApproval', 'Approved', 'Dispatched', 'Executing', 'Applied', 'Verified'];
/** Layout for the lifecycle diagram: column, row. */
export const LIFECYCLE_LAYOUT: Record<LifecycleState, [number, number]> = {
  Requested: [0, 0], PendingApproval: [1, 0], Approved: [2, 0], Dispatched: [3, 0], Executing: [4, 0], Applied: [5, 0], Verified: [6, 0],
  PolicyDenied: [0, 1], Rejected: [1, 1], Expired: [2, 1], AgentRefused: [3, 1], Failed: [4, 1], VerifyFailed: [5, 1], RollbackFailed: [6, 1],
  DispatchExpired: [3, 2], RollingBack: [5, 2], RolledBack: [6, 2],
};
export const LIFECYCLE_EDGES: [LifecycleState, LifecycleState][] = [
  ['Requested', 'PendingApproval'], ['Requested', 'PolicyDenied'], ['PendingApproval', 'Approved'], ['PendingApproval', 'Rejected'], ['PendingApproval', 'Expired'],
  ['Approved', 'Dispatched'], ['Dispatched', 'AgentRefused'], ['Dispatched', 'Executing'], ['Executing', 'Failed'], ['Executing', 'Applied'],
  ['Applied', 'Verified'], ['Applied', 'VerifyFailed'], ['VerifyFailed', 'RollingBack'], ['RollingBack', 'RolledBack'], ['RollingBack', 'RollbackFailed'],
];
export const TERMINAL_BAD: LifecycleState[] = ['PolicyDenied', 'Rejected', 'Expired', 'AgentRefused', 'DispatchExpired', 'Failed', 'VerifyFailed', 'RollbackFailed'];
// DispatchExpired is reached from Dispatched as well.
LIFECYCLE_EDGES.push(['Dispatched', 'DispatchExpired']);

export interface Approval {
  name: string;
  role: HvRole;
  minAgo: number;
}
export interface PendingAction {
  id: string;
  envelopeId: string;
  connector: Connector;
  writeType: string;
  tenantId: string;
  openc2: { action: string; target: string; args: string };
  title: string;
  risk: Risk;
  diff: [string, string, string][];
  requestedBy: string;
  requestedByRole: HvRole | 'HexaAI agent';
  viaAgent: boolean;
  approvalsNeeded: number;
  approvals: Approval[];
  createdMinAgo: number;
  expiresInMin: number;
  policyBundle: string;
  reason: string;
  linked: string;
  keyId: string;
}

interface PendingSeed {
  conn: string;
  write: string;
  tenant: string;
  target: string;
  title: string;
  diff: [string, string, string][];
  reason: string;
  linked: string;
  by: 'me' | 'analyst' | 'agent' | 'grc';
  received?: number;
  created: number;
}

const PENDING: CustomerMap<PendingSeed[]> = {
  maritime: [
    {
      conn: 'c-paloalto', write: 'Add address to block list', tenant: 'pkl', target: '185.220.101.47/32', title: 'Block C2 address at the Port Klang perimeter', by: 'agent', created: 55,
      diff: [['Address group', 'HV-Blocklist (212 entries)', 'HV-Blocklist (213 entries)'], ['Entry', '—', '185.220.101.47/32 · tag hv-ir-pkl'], ['Device group', '—', 'Panorama "Port Klang" (PKL-EDGE-FW01/02)'], ['Commit', '—', 'Partial commit, device group only']],
      reason: 'Beaconing from PKL-ENG-WS03 to known LockBit affiliate infrastructure', linked: 'IR-2026-0412',
    },
    {
      conn: 'c-sentinel', write: 'Deploy scheduled rule', tenant: 'fleet', target: 'HV-T1133-VSL-REMOTE', title: 'Deploy rule: vessel remote access outside change window', by: 'me', created: 72,
      diff: [['Analytic rule', '—', 'HV-T1133-VSL-REMOTE (scheduled, every 15 min)'], ['Severity', '—', 'High'], ['Entity mapping', '—', 'Account, Host, IP'], ['Workspace', '—', 'law-hps-sec-weu']],
      reason: 'Closes 9 partial IACS UR E26 4.2.2 loops on vessel remote access', linked: 'LP-FLEET-OT-02-T1133',
    },
    {
      conn: 'c-entra', write: 'Revoke sessions', tenant: 'pkl', target: 'a.rahman@halcyonports.com', title: 'Revoke all sessions: Terminal IT Manager, Port Klang', by: 'analyst', received: 1, created: 41,
      diff: [['Refresh tokens', '4 active (3 devices)', '0 (revoked)'], ['Sign-in sessions', 'Valid', 'Re-authentication required'], ['Group membership', 'Standard', '+ "IR containment" (blocks legacy auth)']],
      reason: 'Account used interactively on PKL-ENG-WS03 at 03:12 local, outside normal pattern', linked: 'IR-2026-0412',
    },
  ],
  finserv: [
    {
      conn: 'c-crowdstrike', write: 'Add IOC', tenant: 'pay', target: 'cdn-authcheck[.]net', title: 'Add IOC: card-testing bot C2 domain', by: 'agent', created: 34,
      diff: [['IOC type', '—', 'domain'], ['Value', '—', 'cdn-authcheck[.]net'], ['Action', '—', 'Prevent (block + detect)'], ['Host groups', '—', 'Payments CDE, Windows & Linux'], ['Expiry', '—', '90 days']],
      reason: 'Domain seen in the card-testing traffic behind the payments latency incident', linked: 'MI-2026-007',
    },
    {
      conn: 'c-splunk', write: 'Enable / disable correlation search', tenant: 'ukbank', target: 'HV - Privileged access outside JIT window', title: 'Enable correlation search: privileged access outside JIT window', by: 'me', created: 88,
      diff: [['Correlation search', 'Disabled', 'Enabled'], ['Schedule', '—', '*/10 * * * *'], ['Notable severity', '—', 'High'], ['App', 'SplunkEnterpriseSecuritySuite', 'unchanged']],
      reason: 'Closes 7 partial DORA Art. 9 loops (CTL-PAM-02)', linked: 'LP-UKBANK-PAM-02-T1098',
    },
    {
      conn: 'c-okta', write: 'Clear sessions', tenant: 'ukbank', target: '3 Infosys BPM back-office users', title: 'Clear Okta sessions for 3 outsourced back-office users', by: 'analyst', received: 1, created: 40,
      diff: [['Users', '3 (Infosys BPM, Pune)', 'unchanged'], ['Active sessions', '7', '0'], ['Remembered factors', 'Yes', 'Forgotten'], ['OAuth tokens', '12', 'Revoked']],
      reason: 'Same ASN as the MFA-fatigue session on the Treasury Ops user', linked: 'IR-2026-1187',
    },
    {
      conn: 'c-crowdstrike', write: 'Contain host (approval: high)', tenant: 'ukbank', target: 'ALD-CTX-SF04', title: 'Network-contain Citrix StoreFront ALD-CTX-SF04', by: 'agent', created: 22,
      diff: [['Network state', 'Normal', 'Contained (Falcon cloud only)'], ['Sessions', '214 user sessions', 'Dropped; users redirected to SF03'], ['Duration', '—', 'Until lifted by approval']],
      reason: 'Suspicious DLL side-load and outbound beacon every 60 s', linked: 'IR-2026-1191',
    },
    {
      conn: 'c-zscaler', write: 'Block URL category', tenant: 'eu', target: 'Newly Registered Domains', title: 'Block newly registered domains for Europe S.A.', by: 'grc', created: 130,
      diff: [['URL filtering rule', 'Caution', 'Block'], ['Category', 'Newly Registered Domains', 'unchanged'], ['Scope', '—', 'Location group "LU-Office", 2,100 users']],
      reason: '23 lookalike domains registered in 30 days; DORA Art. 9 protection measure', linked: 'INT-LOOKALIKE-23',
    },
  ],
  media: [
    {
      conn: 'c-hexacustody', write: 'Revoke access (supplier / user / session)', tenant: 'post', target: 'Red Fern Localisation · The Long Tide S2', title: 'Revoke supplier access: Red Fern Localisation on The Long Tide S2', by: 'analyst', received: 1, created: 30,
      diff: [['Supplier grant', 'Active (14 users)', 'Revoked'], ['Assets', 'S2 scripts 5–8, locked cuts E01–E04', 'Inaccessible; cached copies wiped by agent'], ['Review links', '6 live', '0 live']],
      reason: 'Watermark on leaked stills matches a Red Fern review session', linked: 'WR-NIGHTJAR-01',
    },
    {
      conn: 'c-secops', write: 'Enable / disable rule', tenant: 'post', target: 'hv_personal_cloud_upload_edit_bay', title: 'Enable rule: personal cloud upload from edit bays', by: 'me', created: 64,
      diff: [['YARA-L rule', 'Disabled', 'Enabled (live)'], ['Alerting', 'Off', 'On, severity High'], ['Scope', '—', 'Soho content network (VLAN 210–219)']],
      reason: 'Closes 11 partial MPA DS-11 loops; would have fired on the Nightjar copy', linked: 'LP-POST-DLP-04-T1567.002',
    },
  ],
  healthcare: [
    {
      conn: 'c-crowdstrike', write: 'Contain host (approval: high)', tenant: 'community', target: 'COM-MAR-WS114', title: 'Network-contain ICU nursing workstation COM-MAR-WS114 (Marion)', by: 'agent', created: 28,
      diff: [['Network state', 'Normal', 'Contained (Falcon cloud only)'], ['Clinical sign-off', '—', 'House supervisor, Marion (spare WOW in place)'], ['Epic sessions', '1 Hyperspace session', 'Dropped; nurse moved to BCA PC'], ['Duration', '—', 'Until lifted by approval']],
      reason: 'Rhysida loader beaconing every 45 s; same hash as COM-ZAN-FS01', linked: 'MI-2026-022',
    },
    {
      conn: 'c-entra', write: 'Revoke sessions', tenant: 'community', target: 'j.harmon@mercyridgehealth.org', title: 'Revoke all sessions: Marion IT analyst (help-desk MFA reset)', by: 'analyst', received: 1, created: 44,
      diff: [['Refresh tokens', '6 active (4 devices)', '0 (revoked)'], ['Authentication methods', 'Authenticator added 2 days ago', 'Removed; FIDO2 re-enrolment in person'], ['Group membership', 'Standard', '+ "IR containment" (blocks legacy auth)']],
      reason: 'Help-desk MFA reset by a caller impersonating this analyst; account then used on Citrix at 02:47', linked: 'MI-2026-022',
    },
    {
      conn: 'c-crowdstrike', write: 'Add IOC', tenant: 'community', target: 'update-msedge[.]top', title: 'Add IOC: Rhysida C2 domain', by: 'agent', created: 61,
      diff: [['IOC type', '—', 'domain'], ['Value', '—', 'update-msedge[.]top'], ['Action', '—', 'Prevent (block + detect)'], ['Host groups', '—', 'All hospitals, Windows servers & workstations'], ['Expiry', '—', '90 days']],
      reason: 'Domain contacted by the loader on COM-ZAN-FS01 and 3 Marion workstations', linked: 'MI-2026-022',
    },
    {
      conn: 'c-sentinel', write: 'Deploy scheduled rule', tenant: 'mrmc', target: 'HV-T1556-HELPDESK-MFA-RESET', title: 'Deploy rule: MFA method added after help-desk reset, then Citrix sign-in', by: 'me', created: 96,
      diff: [['Analytic rule', '—', 'HV-T1556-HELPDESK-MFA-RESET (scheduled, every 10 min)'], ['Severity', '—', 'High'], ['Entity mapping', '—', 'Account, IP, Host'], ['Workspace', '—', 'law-mrh-sec-cus']],
      reason: 'Closes 12 partial HPH CPG 1.5 / HIPAA 164.312(d) loops; would have fired 2 days before the encryption', linked: 'LP-MRMC-IAM-03-T1556',
    },
    {
      conn: 'c-mimecast', write: 'Block sender', tenant: 'clinics', target: 'billing@mercyridgehea1th.org', title: 'Block lookalike sender targeting patients and clinics', by: 'grc', created: 140,
      diff: [['Blocked senders policy', '41 entries', '42 entries'], ['Entry', '—', '*@mercyridgehea1th.org'], ['Scope', '—', 'All inbound, incl. clinic shared mailboxes']],
      reason: 'Lookalike domain sending fake "downtime payment" notices to patients', linked: 'INT-LOOKALIKE-12',
    },
  ],
  automotive: [
    {
      conn: 'c-beyondtrust', write: 'Terminate session', tenant: 'ingolstadt', target: 'kuka-svc-ing · jump item ING-JUMP-OT01', title: 'Terminate KUKA remote-service session to ING-JUMP-OT01', by: 'analyst', received: 1, created: 33,
      diff: [['Session', 'Active 2 h 41 min', 'Terminated'], ['Jump item', 'ING-JUMP-OT01 (enabled)', 'Disabled until re-approved'], ['Vendor account', 'kuka-svc-ing', 'Locked; recording preserved']],
      reason: 'Session outside the agreed maintenance window; credential seen in a supplier stealer log', linked: 'MI-2026-019',
    },
    {
      conn: 'c-defender', write: 'Add custom indicator', tenant: 'ingolstadt', target: 'sha256:7d1e…b09f', title: 'Block Akira encryptor hash across plants and group IT', by: 'agent', created: 52,
      diff: [['Indicator type', '—', 'File hash (SHA-256)'], ['Value', '—', '7d1e4c…b09f'], ['Action', '—', 'Block and remediate'], ['Device groups', '—', 'Plants L3/L4, Group IT, Dealer IT'], ['Expiry', '—', 'Never']],
      reason: 'Encryptor recovered from ING-MES-PRD01; not yet seen at Győr or Puebla', linked: 'MI-2026-019',
    },
    {
      conn: 'c-entra', write: 'Revoke sessions', tenant: 'ingolstadt', target: 'p.maier@vireo-motors.com', title: 'Revoke all sessions: Plant IT administrator, Ingolstadt', by: 'analyst', created: 58,
      diff: [['Refresh tokens', '5 active (3 devices)', '0 (revoked)'], ['Sign-in sessions', 'Valid', 'Re-authentication required'], ['Privileged roles', 'Plant IT admin (PIM eligible)', 'Eligibility suspended']],
      reason: 'Account used for SMB writes from ING-PLC-ENG04 to the MES tier at 04:18', linked: 'MI-2026-019',
    },
    {
      conn: 'c-qradar', write: 'Enable / disable rule', tenant: 'gyor', target: 'HV - SMB writes from L3 engineering to MES', title: 'Enable rule: SMB writes from Level 3 engineering to MES (Győr)', by: 'me', created: 75,
      diff: [['QRadar rule', 'Disabled (test)', 'Enabled'], ['Offense severity', '—', '8'], ['Scope', '—', 'Győr L3 log sources (Armis, Windows, plant firewall)']],
      reason: 'Would have caught the Ingolstadt pattern 40 min earlier; closes 6 IEC 62443 SR 6.2 loops', linked: 'LP-GYOR-OT-06-T1021.002',
    },
    {
      conn: 'c-proofpoint', write: 'Quarantine message', tenant: 'group', target: '23 messages "Revised JIS call-off schedule"', title: 'Quarantine supplier-themed phishing about the line stop', by: 'agent', created: 88,
      diff: [['Messages', '23 delivered (logistics & purchasing)', 'Quarantined'], ['Sender', '—', 'calloff@vireo-supplier-portal[.]com'], ['Clicks before action', '2', 'Users enrolled in reset']],
      reason: 'Opportunistic phishing exploiting the Ingolstadt line stop', linked: 'INT-LOOKALIKE-31',
    },
    {
      conn: 'c-zscaler', write: 'Block URL category', tenant: 'retail', target: 'Newly Registered Domains', title: 'Block newly registered domains for the dealer network', by: 'grc', created: 150,
      diff: [['URL filtering rule', 'Caution', 'Block'], ['Category', 'Newly Registered Domains', 'unchanged'], ['Scope', '—', 'Location group "Dealer-DE-AT", 3,300 users']],
      reason: '31 lookalike domains registered in 30 days; dealer finance staff targeted', linked: 'INT-LOOKALIKE-31',
    },
    {
      conn: 'c-hexacustody', write: 'Revoke access', tenant: 'group', target: 'AutoVision Design Studio · Project Lumen renders', title: 'Revoke supplier access: AutoVision on Project Lumen design freeze', by: 'grc', created: 190,
      diff: [['Supplier grant', 'Active (6 users)', 'Revoked'], ['Assets', 'Lumen design-freeze renders (412 files)', 'Inaccessible; cached copies wiped by agent'], ['TISAX prototype protection', 'AL3 label', 'unchanged']],
      reason: 'Renders opened from an unmanaged device in Milan; TISAX prototype-protection breach risk', linked: 'CUS-LUMEN-07',
    },
  ],
  insurance: [
    {
      conn: 'c-crowdstrike', write: 'Contain host (approval: high)', tenant: 'group', target: 'KMI-MFT-01', title: 'Network-contain the managed file transfer server KMI-MFT-01', by: 'agent', created: 26,
      diff: [['Network state', 'Normal', 'Contained (Falcon cloud only)'], ['Partner transfers', '41 scheduled jobs (EXL, Broadridge, One Inc)', 'Paused; partners moved to the Cohesity-restored standby'], ['Duration', '—', 'Until lifted by approval']],
      reason: 'Web shell in the MFT web tier and 38 GB outbound to an unfamiliar host in 3 hours', linked: 'MI-2026-044',
    },
    {
      conn: 'c-island', write: 'Revoke browser session', tenant: 'claims', target: 'EXL Pune adjuster pod 4 (11 users)', title: 'Revoke Island sessions for EXL adjuster pod 4', by: 'analyst', received: 1, created: 38,
      diff: [['Island sessions', '11 active (ClaimCenter, claims documents)', '0 (revoked)'], ['Copy, print & download', 'Restricted', 'Blocked pending SIU review'], ['Okta group', 'exl-claims-adjusters', 'unchanged']],
      reason: '23 claimant payee bank-detail changes in 40 minutes from one pod; matches the SIU payee-fraud pattern', linked: 'SIU-2026-0381',
    },
    {
      conn: 'c-sentinel', write: 'Deploy scheduled rule', tenant: 'group', target: 'HV-T1098-HELPDESK-RESET-PIM', title: 'Deploy rule: help-desk MFA reset followed by PIM activation', by: 'me', created: 74,
      diff: [['Analytic rule', '—', 'HV-T1098-HELPDESK-RESET-PIM (scheduled, every 10 min)'], ['Severity', '—', 'High'], ['Entity mapping', '—', 'Account, IP, Host'], ['Workspace', '—', 'law-kmi-sec-eus2']],
      reason: 'Closes 8 partial NYDFS 500.7 / CTL-HD-02 loops on help-desk identity verification', linked: 'LP-GROUP-HD-02-T1098',
    },
    {
      conn: 'c-cloudflare', write: 'Add WAF rule (approval: medium)', tenant: 'personal', target: 'agents.kingsbridgemutual.com /login', title: 'Add WAF rule: challenge credential stuffing on AgentHub', by: 'grc', created: 120,
      diff: [['WAF custom rule', '—', 'Managed challenge on /login from residential-proxy ASNs'], ['Rate limit', '—', '10 attempts per 5 min per IP'], ['Zone', '—', 'agents.kingsbridgemutual.com']],
      reason: '41,000 failed agent logins from 2,300 IPs overnight; 64 agent credentials found in stealer logs', linked: 'INT-AGENTHUB-12',
    },
  ],
  defence: [
    {
      conn: 'c-entra', write: 'Revoke sessions', tenant: 'programs', target: 'erin.kowalski@sentrypeakdefense.com', title: 'Revoke all GCC High sessions: Contracts & Subcontracts Manager', by: 'analyst', received: 1, created: 34,
      diff: [['Refresh tokens', '3 active (2 devices)', '0 (revoked)'], ['Sign-in sessions', 'Valid', 'Re-authentication with FIPS YubiKey required'], ['Conditional Access', 'Standard', '+ "IR containment" (compliant device, US locations only)']],
      reason: 'Session cookie replayed from a non-US VPS after an AiTM phishing click on an RTX-themed lure', linked: 'MI-2026-052',
    },
    {
      conn: 'c-beyondtrust', write: 'Terminate session', tenant: 'manufacturing', target: 'haas-svc-b3 · jump item SPD-JUMP-OT01', title: 'Terminate Haas remote-service session to the Building 3 jump host', by: 'agent', created: 52,
      diff: [['Session', 'Active 1 h 52 min', 'Terminated'], ['Jump item', 'SPD-JUMP-OT01 (enabled)', 'Disabled until re-approved'], ['Vendor account', 'haas-svc-b3', 'Locked; recording preserved']],
      reason: 'Session outside the agreed maintenance window; DNC programme share listed from the jump host', linked: 'IR-2026-0233',
    },
    {
      conn: 'c-sentinel', write: 'Deploy scheduled rule', tenant: 'programs', target: 'HV-T1539-GCCH-NONUS-TOKEN', title: 'Deploy rule: GCC High token used from a non-US network', by: 'me', created: 81,
      diff: [['Analytic rule', '—', 'HV-T1539-GCCH-NONUS-TOKEN (scheduled, every 5 min)'], ['Severity', '—', 'High'], ['Entity mapping', '—', 'Account, IP, CloudApplication'], ['Workspace', '—', 'law-spd-gcch-usgv']],
      reason: 'Closes 6 partial NIST 800-171 3.1.12 / 3.5.3 loops; would have fired 40 minutes before the CUI site access', linked: 'LP-PROGRAMS-IAM-01-T1539',
    },
  ],
  pharma: [
    {
      conn: 'c-crowdstrike', write: 'Contain host (approval: high)', tenant: 'valais', target: 'VLS-MES-WS07', title: 'Network-contain PAS-X MES workstation VLS-MES-WS07 (Valais building 12)', by: 'agent', created: 24,
      diff: [['Network state', 'Normal', 'Contained (Falcon cloud only)'], ['QA sign-off', '—', 'Batch record step paused; QA on-call informed (deviation DEV-26-0412)'], ['Batch in progress', 'RHN-2290 API batch 26V118', 'Held at step 14, no data loss'], ['Duration', '—', 'Until lifted by approval']],
      reason: 'Black Basta loader beaconing every 60 s; same hash as the encrypted VLS file server', linked: 'MI-2026-061',
    },
    {
      conn: 'c-beyondtrust', write: 'Terminate session', tenant: 'valais', target: 'emerson-svc-vls · VLS-DELTAV-PROPLUS', title: 'Terminate Emerson remote session to DeltaV ProfessionalPLUS (Valais)', by: 'analyst', received: 1, created: 31,
      diff: [['Session', 'Active 47 min', 'Terminated'], ['Jump item', 'VLS-DELTAV-PROPLUS (enabled)', 'Disabled until a GxP change record is linked'], ['Vendor account', 'emerson-svc-vls', 'Locked; recording preserved for QA']],
      reason: 'OEM session open during the incident with no linked ServiceNow GxP change', linked: 'MI-2026-061',
    },
    {
      conn: 'c-paloalto', write: 'Add address to block list', tenant: 'valais', target: '91.92.247.18/32', title: 'Block Black Basta C2 at the Valais perimeter', by: 'agent', created: 48,
      diff: [['Address group', 'HV-Blocklist (318 entries)', 'HV-Blocklist (319 entries)'], ['Entry', '—', '91.92.247.18/32 · tag hv-ir-vls'], ['Device group', '—', 'Panorama "Valais" (VLS-EDGE-FW01/02)'], ['Commit', '—', 'Partial commit, device group only']],
      reason: 'C2 contacted by the loader on VLS-MES-WS07 and the plant file server', linked: 'MI-2026-061',
    },
    {
      conn: 'c-okta', write: 'Clear sessions', tenant: 'clinops', target: '4 ICON CRA accounts (study RHN-4471)', title: 'Clear Okta sessions for 4 ICON monitor accounts', by: 'analyst', created: 66,
      diff: [['Users', '4 (ICON plc, partner portal)', 'unchanged'], ['Active sessions', '9', '0'], ['Remembered factors', 'Yes', 'Forgotten'], ['Rave access', 'Read, 14 sites', 'Re-authentication required']],
      reason: 'Bulk Rave export pattern from a new ASN; unblinding lists not touched', linked: 'IR-2026-0718',
    },
    {
      conn: 'c-sentinel', write: 'Deploy scheduled rule', tenant: 'valais', target: 'HV-T1133-OEM-OUTSIDE-GXP-CHANGE', title: 'Deploy rule: OEM remote session without a GxP change record', by: 'me', created: 92,
      diff: [['Analytic rule', '—', 'HV-T1133-OEM-OUTSIDE-GXP-CHANGE (scheduled, every 15 min)'], ['Severity', '—', 'High'], ['Entity mapping', '—', 'Account, Host'], ['Workspace', '—', 'law-rhn-sec-chn']],
      reason: 'Closes 9 partial EU GMP Annex 11 §12 loops on vendor access to computerised systems', linked: 'LP-VALAIS-OT-03-T1133',
    },
  ],
  sghospital: [
    {
      conn: 'c-crowdstrike', write: 'Contain host (approval: high)', tenant: 'obh', target: 'OBH-TRAK-APP03', title: 'Network-contain TrakCare application server OBH-TRAK-APP03', by: 'agent', created: 27,
      diff: [['Network state', 'Normal', 'Contained (Falcon cloud only)'], ['Clinical sign-off', '—', 'CMIO and A&E consultant on duty (downtime procedures in force)'], ['TrakCare sessions', '412 clinician sessions', 'Moved to APP01/APP02'], ['Duration', '—', 'Until lifted by approval']],
      reason: 'Qilin encryptor staged on the application tier; same hash as the encrypted file share', linked: 'MI-2026-027',
    },
    {
      conn: 'c-cyberark', write: 'Terminate vendor session (approval: high)', tenant: 'obh', target: 'isc-support-sg · OBH-TRAK-DB01', title: 'Terminate InterSystems vendor session to the TrakCare database', by: 'analyst', received: 1, created: 39,
      diff: [['Vendor PAM session', 'Active 2 h 14 min', 'Terminated'], ['Vendor account', 'isc-support-sg', 'Locked; recording preserved'], ['Approval policy', 'Standing', 'Per-session approval required']],
      reason: 'Session opened at 02:31 SGT with no approved change; credential seen in a stealer log', linked: 'MI-2026-027',
    },
    {
      conn: 'c-crowdstrike', write: 'Add IOC', tenant: 'obh', target: 'cdn-trakupdate[.]com', title: 'Add IOC: Qilin C2 domain', by: 'agent', created: 58,
      diff: [['IOC type', '—', 'domain'], ['Value', '—', 'cdn-trakupdate[.]com'], ['Action', '—', 'Prevent (block + detect)'], ['Host groups', '—', 'All campuses, Windows servers & workstations'], ['Expiry', '—', '90 days']],
      reason: 'Domain contacted by the encryptor on OBH-TRAK-APP03 and two ward workstations', linked: 'MI-2026-027',
    },
    {
      conn: 'c-sentinel', write: 'Deploy scheduled rule', tenant: 'obh', target: 'HV-T1133-VENDOR-PAM-OFF-WINDOW', title: 'Deploy rule: vendor PAM session outside its approved window', by: 'me', created: 88,
      diff: [['Analytic rule', '—', 'HV-T1133-VENDOR-PAM-OFF-WINDOW (scheduled, every 10 min)'], ['Severity', '—', 'High'], ['Entity mapping', '—', 'Account, Host'], ['Workspace', '—', 'law-obh-sec-sea']],
      reason: 'Closes 7 partial HIA CS/DS access-control loops; would have fired 2 hours before encryption', linked: 'LP-OBH-IAM-04-T1133',
    },
    {
      conn: 'c-mimecast', write: 'Block sender', tenant: 'corp', target: '*@orchidbay-billing.com', title: 'Block lookalike sender targeting patients and insurers', by: 'grc', created: 140,
      diff: [['Blocked senders policy', '27 entries', '28 entries'], ['Entry', '—', '*@orchidbay-billing.com'], ['Scope', '—', 'All inbound, incl. patient billing shared mailboxes']],
      reason: 'Lookalike domain sending fake "outstanding bill" notices to patients during the outage', linked: 'INT-LOOKALIKE-08',
    },
  ],
  studio: [
    {
      conn: 'c-hexacustody', write: 'Revoke access (supplier / user / session)', tenant: 'post', target: 'Northlight Pixel (Vancouver) · Crown of Ash', title: 'Revoke supplier access: Northlight Pixel on Crown of Ash', by: 'analyst', received: 1, created: 29,
      diff: [['Supplier grant', 'Active (22 users)', 'Revoked'], ['Assets', 'Crown of Ash locked cut v22, VFX plates batches 31–40', 'Inaccessible; cached copies wiped by agent'], ['Review links', '9 live', '0 live']],
      reason: 'NexGuard watermark on the leaked clip traces to a Northlight review session', linked: 'MI-2026-038',
    },
    {
      conn: 'c-aspera', write: 'Revoke package link', tenant: 'post', target: 'aspera.starfallent.com · 14 Northlight packages', title: 'Revoke 14 Aspera package links shared with Northlight Pixel', by: 'agent', created: 34,
      diff: [['Package links', '14 active', '0 active'], ['Node API key', 'northlight-node-01 (2 years old)', 'Disabled'], ['Pending transfers', '3 queued', 'Cancelled']],
      reason: 'The vendor node key used to pull the locked cut was also used from an unknown host', linked: 'MI-2026-038',
    },
    {
      conn: 'c-okta', write: 'Clear sessions', tenant: 'studios', target: 'freelance-vfx-2291', title: 'Clear Okta sessions for freelancer freelance-vfx-2291', by: 'analyst', created: 41,
      diff: [['Active sessions', '3 (2 devices)', '0'], ['Factors', 'Okta Verify added yesterday', 'Reset; re-enrol in person'], ['App assignments', 'Aspera, Frame.io, Moxion', 'Suspended pending review']],
      reason: 'Help-desk factor reset followed by 41 plate downloads from a new device', linked: 'MI-2026-038',
    },
    {
      conn: 'c-secops', write: 'Deploy YARA-L rule', tenant: 'post', target: 'hv_aspera_bulk_pull_new_host', title: 'Deploy rule: bulk Aspera pull from a new host', by: 'me', created: 70,
      diff: [['YARA-L rule', '—', 'hv_aspera_bulk_pull_new_host (live)'], ['Alerting', '—', 'On, severity High'], ['Scope', '—', 'Aspera on Cloud and Signiant logs, all titles']],
      reason: 'Closes 12 partial MPA DS-11 / TPN loops; would have fired on the first Northlight pull', linked: 'LP-POST-DLP-02-T1567.002',
    },
    {
      conn: 'c-markmonitor', write: 'Request takedown', tenant: 'studios', target: '7 URLs (Telegram, 2 forums, 4 mirrors)', title: 'Request takedown of 7 Crown of Ash leak URLs', by: 'grc', created: 96,
      diff: [['Takedown requests', '—', '7 URLs submitted'], ['Evidence', '—', 'NexGuard decode report, screenshots, hashes'], ['SLA', '—', '2 h per URL (internal target)']],
      reason: 'Clip views passing 40k; mirrors appearing every 20 minutes', linked: 'MI-2026-038',
    },
    {
      conn: 'c-hexacustody', write: 'Watermark policy', tenant: 'studios', target: 'Crown of Ash · awards screeners (FYC)', title: 'Raise watermark policy to per-viewer on Crown of Ash screeners', by: 'grc', created: 150,
      diff: [['Watermark mode', 'Per-session', 'Per-viewer (NexGuard)'], ['Screener links', '2,140 live (Indee)', 'Re-issued with viewer marks'], ['Download', 'Allowed for guild members', 'Stream only']],
      reason: 'Faster attribution if the FYC screener leaks during awards season', linked: 'MI-2026-038',
    },
  ],
};

const POLICY_BUNDLE: CustomerMap<string> = {
  maritime: 'pb-2026.09.4', finserv: 'pb-2026.10.1', media: 'pb-2026.09.2', healthcare: 'pb-2026.09.3', automotive: 'pb-2026.10.2',
  insurance: 'pb-2026.10.3', defence: 'pb-2026.09.6', pharma: 'pb-2026.10.1', sghospital: 'pb-2026.09.5', studio: 'pb-2026.10.4',
};
/** Customer key store holding the action-signing key when the customer brings its own key. */
const SIGNING_KV: CustomerMap<string> = {
  maritime: 'kv-hps-weu', finserv: 'luna-ald-01', media: 'kv-kst-use2', healthcare: 'kv-mrh-cus', automotive: 'kv-vmg-gwc',
  insurance: 'kv-kmi-eus2', defence: 'mhsm-spd-usgv', pharma: 'luna-rhn-bsl01', sghospital: 'kv-obh-sea', studio: 'kv-sfe-wus2',
};
export function policyBundle(c: CustomerProfile): string {
  return forCustomer(POLICY_BUNDLE, c);
}
export function signingKey(c: CustomerProfile): string {
  const kv = forCustomer(SIGNING_KV, c);
  return c.byok ? `hsm://${kv}/hv-actions-es256` : 'hsm://hexashield-stamp/tenant-' + c.id + '/hv-actions-es256';
}

export function pendingActions(c: CustomerProfile, tenantId: string, me: Me): PendingAction[] {
  const n = headlines(c, tenantId).ops.pendingApprovals;
  const rank = (s: PendingSeed) => (tenantId === 'all' ? 0 : (s.tenant === tenantId ? 0 : 2) + (s.by === 'me' ? 1 : 0));
  const seeds = [...forCustomer(PENDING, c)].sort((a, b) => rank(a) - rank(b));
  const x = forCustomer(EXTRA, c);
  const r = rng(`ops-pending-${c.id}-${tenantId}`);
  return seeds.slice(0, n).map((s, i) => {
    const conn = c.connectors.find((k) => k.id === s.conn) ?? c.connectors[0];
    const risk = riskOf(s.write);
    const oc = openc2For(s.write);
    const requestedBy = s.by === 'me' ? me.name : s.by === 'agent' ? `HexaAI triage agent (for ${x.analysts[0]})` : s.by === 'grc' ? c.people.grcLead.name : x.analysts[1];
    const approvals: Approval[] = s.received ? [{ name: x.approver, role: 'Approver', minAgo: Math.max(2, s.created - 12) }] : [];
    const expiry = (RISK_RULES[risk].expiryH ?? 0) * 60;
    return {
      id: `ACT-${r.int(10000, 99999)}`,
      envelopeId: `env_${r.hex(8)}-${r.hex(4)}`,
      connector: conn,
      writeType: s.write,
      tenantId: tenantId === 'all' ? s.tenant : tenantId,
      openc2: { ...oc, args: s.target },
      title: s.title,
      risk,
      diff: s.diff,
      requestedBy,
      requestedByRole: s.by === 'agent' ? 'HexaAI agent' : s.by === 'me' ? me.role : s.by === 'grc' ? 'GRC' : 'Analyst',
      viaAgent: s.by === 'agent',
      approvalsNeeded: RISK_RULES[risk].approvers,
      approvals,
      createdMinAgo: s.created + i,
      expiresInMin: expiry - s.created,
      policyBundle: policyBundle(c),
      reason: s.reason,
      linked: s.linked,
      keyId: signingKey(c),
    };
  });
}

/** Outcome of a completed action (its terminal lifecycle state). */
export type Outcome = 'Verified' | 'RolledBack' | 'PolicyDenied' | 'Rejected' | 'Expired' | 'AgentRefused' | 'DispatchExpired' | 'Failed';
export const OUTCOME_COLOR: Record<Outcome, string> = {
  Verified: 'var(--good)', RolledBack: 'var(--sev-medium)', PolicyDenied: 'var(--sev-info)', Rejected: 'var(--sev-low)',
  Expired: 'var(--sev-info)', AgentRefused: 'var(--sev-high)', DispatchExpired: 'var(--sev-info)', Failed: 'var(--bad)',
};
export interface HistoryAction {
  id: string;
  minAgo: number;
  title: string;
  writeType: string;
  connector: Connector;
  tenantId: string;
  risk: Risk;
  outcome: Outcome;
  requestedBy: string;
  approvers: string[];
  durationSec: number;
  note: string;
}

const HISTORY_TARGETS: CustomerMap<string[]> = {
  maritime: ['HV-T1078-OT-JUMP', 'HV-T1486-MASS-RENAME', '45.137.21.9/32', 'crew.portal user', 'CTL-BKP-07', 'HV-T1219-ANYDESK', 'sha256:9f2c…e1a4', 'IR containment group'],
  finserv: ['HV - Kerberoasting burst', 'HV - SWIFT operator off-hours', 'sha256:44be…a91c', 'Treasury Ops user', 'CTL-IAM-01', 'LD8 jump host', 'phish msg <a3f9@…>', 'Newly Registered Domains'],
  media: ['hv_s3_vault_bulk_get', 'hv_aspera_new_peer', 'leak-mirror[.]to', 'Freelance colourist session', 'CTL-WAT-08', 'review link rv-88213', 'WAF rule: screener token replay', 'Pixel Forge grant'],
  healthcare: ['HV-T1556-HELPDESK-MFA-RESET', 'HV-T1486-EPIC-SHARE-RENAME', 'update-msedge[.]top', 'Help-desk reset user', 'CTL-MFA-03', 'COM-MAR-WS114', 'phish msg <mychart-billing@…>', 'mercyridgehea1th[.]org', 'HV-FairWarning VIP chart access', 'GE remote-service session'],
  automotive: ['HV - SMB writes L3 → MES', 'HV - Vendor jump outside window', 'sha256:7d1e…b09f', 'KUKA service session', 'CTL-OTA-02', 'ING-PLC-ENG04 (IT NIC)', 'phish msg <calloff@…>', 'vireo-motors-dealer[.]com', 'Dürr paint-cell session', 'HV - DMS bulk customer export'],
  insurance: ['HV - RACF SPECIAL outside change window', 'HV-T1098-HELPDESK-RESET-PIM', 'KMI-MFT-01', 'claims-docshare[.]net', 'EXL adjuster pod 4', 'CTL-HD-02', 'Cognizant support session', 'phish msg <renewal-notice@…>', 'kingsbridge-mutual-claims[.]com', 'AgentHub /login WAF rule'],
  defence: ['HV-T1539-GCCH-NONUS-TOKEN', 'HV - Bulk clone of export-controlled repo', 'haas-svc-b3 session', 'sharepoint-rtx-subk[.]com', 'CTL-IAM-01 (CMMC IA.L2-3.5.3)', 'SPD-JUMP-OT01', 'phish msg <subcontract-mod@…>', 'cumberland-sftp', 'PreVeil share: TDP-2207', 'CUI label: SP-EXPT'],
  pharma: ['HV-T1133-OEM-OUTSIDE-GXP-CHANGE', 'HV - Rave bulk export by CRO account', '91.92.247.18/32', 'emerson-svc-vls session', 'CTL-GXP-AUD-04', 'VLS-MES-WS07', 'phish msg <edelweiss-dataroom@…>', 'rhenara-clinical[.]com', 'ICON CRA sessions', 'Netskope: ChatGPT upload of trial data'],
  sghospital: ['HV-T1133-VENDOR-PAM-OFF-WINDOW', 'HV - TrakCare IRIS bulk export', 'cdn-trakupdate[.]com', 'isc-support-sg session', 'CTL-IAM-02 (HIA CS/DS)', 'OBH-TRAK-APP03', 'phish msg <outstanding-bill@…>', 'orchidbay-billing[.]com', 'BD Alaris remote session', 'FairWarning VIP record access'],
  studio: ['hv_aspera_bulk_pull_new_host', 'hv_frameio_link_forward', 'leak-mirror[.]cc', 'freelance-vfx-2291', 'CTL-WAT-03', 'Northlight Pixel grant', 'Crown of Ash screener link', 'WAF rule: screener token replay', 'intamin-svc-orl session', 'starfallplus-login[.]help'],
};

export function actionHistory(c: CustomerProfile, tenantId: string): HistoryAction[] {
  const n30 = headlines(c, tenantId).ops.actions30d;
  const r = rng(`ops-history-${c.id}-${tenantId}`);
  const conns = scopedConnectors(c, tenantId).filter((k) => k.write.length && k.env !== 'ot');
  const tenants = scopedTenants(c, tenantId);
  const x = forCustomer(EXTRA, c);
  const requesters = [...x.analysts, c.people.socLead.name, c.people.grcLead.name, 'HexaAI triage agent'];
  const approvers = [x.approver, c.people.ciso.name, c.people.admin.name, c.people.socLead.name];
  const out: HistoryAction[] = [];
  for (let i = 0; i < n30 * 3; i++) {
    const inLast30 = i < n30;
    const minAgo = inLast30 ? r.int(30, 30 * 1440) : r.int(30 * 1440, 90 * 1440);
    const k = r.pick(conns);
    const w = r.pick(k.write);
    const risk = riskOf(w);
    const outcome = r.weighted<Outcome>([['Verified', 72], ['RolledBack', 5], ['PolicyDenied', 6], ['Rejected', 6], ['Expired', 4], ['AgentRefused', 2], ['DispatchExpired', 2], ['Failed', 3]]);
    const req = r.pick(requesters);
    const nAppr = outcome === 'PolicyDenied' || outcome === 'Expired' ? 0 : RISK_RULES[risk].approvers;
    const apprs = r.pickN(approvers.filter((a) => a !== req), nAppr);
    if (risk === 'high' && apprs.length === 2 && !apprs.includes(c.people.ciso.name) && !apprs.includes(c.people.admin.name)) apprs[1] = c.people.admin.name;
    const note = {
      Verified: 'Post-condition read back from the tool matched the envelope',
      RolledBack: 'Verification failed; previous state restored from the snapshot',
      PolicyDenied: r.pick(['Action type not enabled for this tenant', 'Change freeze window active', 'Target outside the allowed scope']),
      Rejected: 'Approver rejected: ' + r.pick(['duplicate of an existing rule', 'business impact too high during peak', 'insufficient evidence']),
      Expired: 'No approval inside the expiry window',
      AgentRefused: 'Data-plane agent local veto: ' + r.pick(['signature from an unexpected key', 'target matches the local deny list', 'envelope replayed (nonce seen)']),
      DispatchExpired: 'Data plane unreachable inside the dispatch window',
      Failed: 'Tool API returned an error: ' + r.pick(['403 insufficient scope', '409 conflict', '503 service unavailable']),
    }[outcome];
    out.push({
      id: `ACT-${r.int(10000, 99999)}`,
      minAgo,
      title: `${w} · ${r.pick(forCustomer(HISTORY_TARGETS, c))}`,
      writeType: w,
      connector: k,
      tenantId: r.pick(tenants).id,
      risk,
      outcome,
      requestedBy: req,
      approvers: apprs,
      durationSec: outcome === 'Verified' || outcome === 'RolledBack' ? r.int(8, 140) : 0,
      note,
    });
  }
  return out.sort((a, b) => a.minAgo - b.minAgo);
}

export interface ActionType {
  key: string;
  connector: Connector;
  write: string;
  risk: Risk;
  openc2: { action: string; target: string };
  enabled: boolean;
  used30d: number;
  ot: boolean;
}

export function actionTypes(c: CustomerProfile, tenantId: string): ActionType[] {
  const r = rng(`ops-types-${c.id}-${tenantId}`);
  const out: ActionType[] = [];
  for (const k of scopedConnectors(c, tenantId)) {
    for (const w of k.write) {
      const risk = riskOf(w);
      // Write-back is off by default; this customer has switched on a subset during onboarding.
      const enabled = risk === 'low' ? r.chance(0.8) : risk === 'medium' ? r.chance(0.6) : r.chance(0.45);
      out.push({ key: `${k.id}:${w}`, connector: k, write: w, risk, openc2: openc2For(w), enabled, used30d: enabled ? r.int(0, 24) : 0, ot: false });
    }
    if (k.env === 'ot') out.push({ key: `${k.id}:ot`, connector: k, write: 'Any write action', risk: 'critical', openc2: { action: '—', target: '—' }, enabled: false, used30d: 0, ot: true });
  }
  return out;
}

export function regoPolicy(c: CustomerProfile): string {
  const tenantRule = forCustomer(REGO_TENANT_RULE, c);
  return regoBody(c, tenantRule);
}

const REGO_TENANT_RULE: CustomerMap<string> = {
    maritime: `# Vessels: no dispatch while a vessel is outside its LEO window
deny contains "vessel offline: envelope would queue past expiry" if {
  input.tenant == "fleet"
  not data.fleet.online[input.target.vessel]
}`,
    finserv: `# Payments CDE: high-risk actions blocked during card scheme peak
deny contains "payments peak freeze" if {
  input.tenant == "pay"
  input.action.risk == "high"
  time.clock(time.now_ns())[0] in {11, 12, 18, 19}
  not input.incident.major
}`,
    media: `# Custody revocations must name the title and supplier grant
deny contains "custody revoke needs title + grant" if {
  input.action.type == "revoke_access"
  not input.target.title
}`,
    healthcare: `# Patient-care areas: no host containment without a clinical sign-off
deny contains "clinical sign-off required for patient-care hosts" if {
  input.action.type == "contain_host"
  "patient-care" in input.target.tags
  not input.context.clinical_signoff
}

# Medical devices are OT: never a write-back target (FDA 524B, vendor support)
deny contains "medical device is read-only" if {
  input.target.class == "medical_device"
}`,
    automotive: `# Plants: high-risk writes held during a declared line freeze unless a major incident is open
deny contains "plant line freeze" if {
  input.tenant in {"ingolstadt", "gyor", "puebla"}
  input.action.risk == "high"
  data.plants[input.tenant].freeze_active
  not input.incident.major
}

# OTA signing (UNECE R156) is never a write-back target
deny contains "OTA signing service is out of scope" if {
  startswith(input.target.host, "VMG-OTA-SIGN")
}`,
    insurance: `# Mainframe policy admin: no write-back during the z/OS batch window or quarter-end close
deny contains "mainframe batch window or close freeze" if {
  startswith(input.target.host, "KMI-ZOS")
  data.calendar.zos_batch_window_active
}
deny contains "quarter-end close freeze (claims payments)" if {
  input.tenant == "claims"
  input.action.risk == "high"
  data.calendar.quarter_end_freeze
  not input.incident.major
}`,
    defence: `# CUI enclave: only US-person approvers, and nothing leaves GCC High
deny contains "approver is not a verified US person (ITAR)" if {
  input.tenant == "programs"
  some a in input.approvals
  not data.people[a.subject].us_person
}

# Building 3 shop floor and Tucson range are OT: never a write-back target
deny contains "shop-floor and range systems are read-only" if {
  input.tenant in {"manufacturing", "tucson"}
  input.connector.category == "OT"
}`,
    pharma: `# GMP sites: high-risk actions need a linked GxP change or deviation record
deny contains "GxP change or deviation reference required" if {
  input.tenant in {"valais", "cork"}
  input.action.risk == "high"
  not input.context.gxp_record
}

# The air-gapped aseptic line is never reachable for write-back
deny contains "aseptic line AF-2 is out of scope" if {
  input.connector.data_plane == "dp-aseptic"
}`,
    sghospital: `# Patient-care hosts: no containment without clinical sign-off (CMIO or consultant on duty)
deny contains "clinical sign-off required for patient-care hosts" if {
  input.action.type == "contain_host"
  "patient-care" in input.target.tags
  not input.context.clinical_signoff
}

# Medical devices are OT: never a write-back target (HSA GL-04, vendor support)
deny contains "medical device is read-only" if {
  input.target.class == "medical_device"
}`,
    studio: `# Custody revocations must name the title and supplier grant
deny contains "custody revoke needs title + grant" if {
  input.action.type == "revoke_access"
  not input.target.title
}

# Ride and show control is safety-critical OT: never a write-back target
deny contains "ride & show control is read-only" if {
  input.tenant in {"parks", "parksasia"}
  input.connector.category == "OT"
}`,
};

function regoBody(c: CustomerProfile, tenantRule: string): string {
  return `package hexaview.writeback.${c.id}
# bundle ${policyBundle(c)} · signed ES256 · evaluated in the control plane
# AND again by the data-plane agent before execution (local veto)
import rego.v1

default allow := false

allow if {
  enabled[input.action.type]
  not ot_target
  count(deny) == 0
  approvals_ok
}

enabled contains t if some t in data.tenants[input.tenant].enabled_actions

# OT is read-only by policy: no write action can target an OT connector
ot_target if input.connector.env == "ot"

deny contains "requester cannot approve own action" if {
  some a in input.approvals
  a.subject == input.requester.subject
}

deny contains "critical actions are not available" if input.action.risk == "critical"

approvals_ok if {
  input.action.risk == "low"
  count(input.approvals) >= 1
}
approvals_ok if {
  input.action.risk == "medium"
  count([a | some a in input.approvals; "Approver" in a.roles]) >= 1
}
approvals_ok if {
  input.action.risk == "high"
  count(input.approvals) >= 2
  some a in input.approvals
  "Tenant Admin" in a.roles
  time.now_ns() < input.requested_at_ns + (4 * 3600 * 1e9)
}

${tenantRule}
`;
}

/* =====================================================================
   Audit ledger (hash-chained, anchored every 5 minutes)
   ===================================================================== */
export type ActorType = 'user' | 'service' | 'agent' | 'hexashield_support';
export const ACTOR_COLOR: Record<ActorType, string> = { user: 'var(--m-core)', service: 'var(--sev-info)', agent: 'var(--m-ai)', hexashield_support: 'var(--sev-high)' };
export const EVENT_TYPES: { type: string; actor: ActorType; weight: number; tableWeight: number }[] = [
  { type: 'connector.sync_completed', actor: 'service', weight: 31, tableWeight: 10 },
  { type: 'agent.triage_decision', actor: 'agent', weight: 14, tableWeight: 8 },
  { type: 'evidence.collected', actor: 'service', weight: 13, tableWeight: 9 },
  { type: 'loop.status_changed', actor: 'service', weight: 9, tableWeight: 8 },
  { type: 'user.login', actor: 'user', weight: 8, tableWeight: 6 },
  { type: 'case.updated', actor: 'user', weight: 7, tableWeight: 6 },
  { type: 'copilot.conversation', actor: 'user', weight: 5, tableWeight: 6 },
  { type: 'report.generated', actor: 'service', weight: 3, tableWeight: 3 },
  { type: 'share_link.viewed', actor: 'user', weight: 2.4, tableWeight: 3 },
  { type: 'action.requested', actor: 'user', weight: 1.6, tableWeight: 5 },
  { type: 'action.approved', actor: 'user', weight: 1.4, tableWeight: 5 },
  { type: 'action.verified', actor: 'agent', weight: 1.3, tableWeight: 4 },
  { type: 'policy.bundle_published', actor: 'user', weight: 0.4, tableWeight: 1.5 },
  { type: 'connector.created', actor: 'user', weight: 0.3, tableWeight: 1.5 },
  { type: 'support_access.started', actor: 'hexashield_support', weight: 0.2, tableWeight: 1.5 },
  { type: 'ledger.exported', actor: 'user', weight: 0.15, tableWeight: 1 },
];

export interface AuditEvent {
  seq: number;
  minAgo: number;
  actorType: ActorType;
  actor: string;
  type: string;
  target: string;
  tenantId: string;
  prevHash: string;
  hash: string;
  anchor: string;
}

export function auditTotals(c: CustomerProfile, tenantId: string, days: number): { type: string; actor: ActorType; count: number }[] {
  const total = Math.round(headlines(c, tenantId).ops.auditEvents30d * (days / 30));
  const wsum = EVENT_TYPES.reduce((s, e) => s + e.weight, 0);
  const r = rng(`ops-audit-tot-${c.id}-${tenantId}-${days}`);
  const rows = EVENT_TYPES.map((e) => ({ type: e.type, actor: e.actor, count: Math.max(1, Math.round((total * e.weight * r.float(0.9, 1.1, 3)) / wsum)) }));
  // Make the parts add up exactly to the headline-derived total.
  const diff = total - rows.reduce((s, x) => s + x.count, 0);
  rows[0].count += diff;
  return rows;
}

export function auditEvents(c: CustomerProfile, tenantId: string, days: number): AuditEvent[] {
  const r = rng(`ops-audit-${c.id}-${tenantId}`);
  const x = forCustomer(EXTRA, c);
  const tenants = scopedTenants(c, tenantId);
  const conns = scopedConnectors(c, tenantId);
  const users = [c.people.ciso.name, c.people.socLead.name, c.people.grcLead.name, c.people.admin.name, x.approver, ...x.analysts, x.auditor];
  const agents = ['agent:hexaai-triage', 'agent:hexaai-evidence', 'agent:dp-' + (c.dataPlanes[0]?.id ?? 'core')];
  const ctrlIds = loops(c, tenantId).slice(0, 40);
  const n = 220;
  const span = Math.max(1, days) * 1440;
  const minutes = Array.from({ length: n }, () => r.int(0, span)).sort((a, b) => b - a); // oldest first
  const baseSeq = 1_000_000 + Math.round(headlines(c, 'all').ops.auditEvents30d * 7.3);
  const out: AuditEvent[] = [];
  let prev = r.hex(64);
  minutes.forEach((m, i) => {
    const e = r.weighted(EVENT_TYPES.map((t) => [t, t.tableWeight] as const));
    const actor = e.actor === 'user' ? r.pick(users) : e.actor === 'service' ? `svc:${r.pick(conns).id.replace('c-', 'connector-')}` : e.actor === 'agent' ? r.pick(agents) : x.support;
    const k = r.pick(conns);
    const lp = ctrlIds.length ? r.pick(ctrlIds) : undefined;
    const target = {
      'connector.sync_completed': `${k.vendor} ${k.product}`,
      'agent.triage_decision': `alert ${r.id('AL', 6)} → ${r.pick(['benign', 'escalated', 'merged into case'])}`,
      'evidence.collected': `${lp?.controlId ?? 'CTL'} · EV-${r.int(1000, 9999)}`,
      'loop.status_changed': lp ? `${lp.id} → ${lp.status}` : 'loop',
      'user.login': `SSO · ${r.pick(['FIDO2', 'Authenticator push', 'Passkey'])}`,
      'case.updated': `${r.id('IR-2026', 4)} · ${r.pick(['note added', 'severity changed', 'assigned'])}`,
      'copilot.conversation': `conv_${r.hex(6)} · ${r.int(2, 14)} turns, ${r.int(1, 9)} citations`,
      'report.generated': r.pick(['Board pack draft', 'Regulator evidence pack', 'Weekly SOC report', 'Insurer pack']),
      'share_link.viewed': `share ${r.hex(6)} · ${r.pick(['insurer', 'regulator', 'customer', 'partner'])}`,
      'action.requested': `ACT-${r.int(10000, 99999)} · ${r.pick(conns.filter((q) => q.write.length).map((q) => q.product)) ?? k.product}`,
      'action.approved': `ACT-${r.int(10000, 99999)} · approval ${r.int(1, 2)}/${r.int(1, 2)}`,
      'action.verified': `ACT-${r.int(10000, 99999)} · post-condition matched`,
      'policy.bundle_published': policyBundle(c),
      'connector.created': `${k.vendor} ${k.product} (${k.version})`,
      'support_access.started': `session sa_${r.hex(6)} · read-only · ${r.int(1, 4)} h`,
      'ledger.exported': `range ${r.int(1, 30)} d · signed JSONL`,
    }[e.type] ?? k.product;
    const hash = r.hex(64);
    out.push({
      seq: baseSeq - (n - i) * r.int(3, 9),
      minAgo: m,
      actorType: e.actor,
      actor,
      type: e.type,
      target,
      tenantId: r.pick(tenants).id,
      prevHash: prev,
      hash,
      anchor: `anc-${Math.floor((span - m) / 5)}`,
    });
    prev = hash;
  });
  // Sequence numbers increase over time.
  let s = baseSeq - n * 6;
  for (const ev of out) {
    s += r.int(4, 40);
    ev.seq = s;
  }
  return out.reverse();
}

export interface Anchor {
  id: string;
  minAgo: number;
  merkleRoot: string;
  entries: number;
  firstSeq: number;
  lastSeq: number;
  storage: string;
}

/** Where ledger anchors are written (immutable, in the customer's region). */
const ANCHOR_STORE: CustomerMap<string> = {
  finserv: 'Azure immutable blob (WORM, UK South)',
  maritime: 'Azure immutable blob (WORM, West Europe)',
  media: 'S3 Object Lock (compliance mode, us-east-2)',
  healthcare: 'Azure immutable blob (WORM, Central US)',
  automotive: 'Azure immutable blob (WORM, Germany West Central)',
  insurance: 'Azure immutable blob (WORM, East US 2)',
  defence: 'Azure Government immutable blob (WORM, US Gov Virginia)',
  pharma: 'Azure immutable blob (WORM, Switzerland North)',
  sghospital: 'Azure immutable blob (WORM, Southeast Asia)',
  studio: 'S3 Object Lock (compliance mode, us-west-2)',
};
export function anchors(c: CustomerProfile, tenantId: string, lastSeq: number): Anchor[] {
  const h = headlines(c, tenantId).ops;
  const r = rng(`ops-anchor-${c.id}-${tenantId}`);
  const per5 = Math.max(1, Math.round(h.auditEvents30d / (30 * 288)));
  const storage = forCustomer(ANCHOR_STORE, c);
  let hi = lastSeq;
  return Array.from({ length: 8 }, (_, i) => {
    const entries = Math.max(1, per5 + r.int(-Math.ceil(per5 / 3), Math.ceil(per5 / 3)));
    const a = { id: `anc_${r.hex(10)}`, minAgo: h.lastAnchorMin + i * 5, merkleRoot: r.hex(64), entries, firstSeq: hi - entries + 1, lastSeq: hi, storage };
    hi -= entries;
    return a;
  });
}

export interface SupportSession {
  id: string;
  engineer: string;
  reason: string;
  requestedMinAgo: number;
  approvedBy: string | null;
  scope: string;
  durationH: number;
  status: 'pending' | 'active' | 'closed' | 'denied';
  ticket: string;
}

export function supportSessions(c: CustomerProfile): SupportSession[] {
  const x = forCustomer(EXTRA, c);
  const ta = c.people.admin.name;
  const items: CustomerMap<Omit<SupportSession, 'id' | 'engineer'>[]> = {
    maritime: [
      { reason: 'Port Klang edge agent 1.8.7 → 1.9.2 upgrade assistance', requestedMinAgo: 25, approvedBy: null, scope: 'Read-only · data plane dp-pkl-ot health', durationH: 2, status: 'pending', ticket: 'HS-SUP-30418' },
      { reason: 'Veeam connector field drift after v12.2 upgrade', requestedMinAgo: 190, approvedBy: ta, scope: 'Read-only · connector c-veeam config & logs', durationH: 4, status: 'active', ticket: 'HS-SUP-30392' },
      { reason: 'Sentinel rule deployment dry-run review', requestedMinAgo: 4 * 1440, approvedBy: ta, scope: 'Read-only · Action Centre envelopes', durationH: 1, status: 'closed', ticket: 'HS-SUP-30117' },
      { reason: 'Bulk export of fleet syslog for analysis', requestedMinAgo: 9 * 1440, approvedBy: null, scope: 'Requested export rights', durationH: 8, status: 'denied', ticket: 'HS-SUP-29870' },
    ],
    finserv: [
      { reason: 'Veracode connector 429 rate limiting: back-off tuning', requestedMinAgo: 40, approvedBy: null, scope: 'Read-only · connector c-veracode', durationH: 2, status: 'pending', ticket: 'HS-SUP-41107' },
      { reason: 'DORA incident report template mapping check', requestedMinAgo: 95, approvedBy: null, scope: 'Read-only · War Room MI-2026-007 metadata (no PII)', durationH: 1, status: 'pending', ticket: 'HS-SUP-41109' },
      { reason: 'Splunk ES saved-search sync failure', requestedMinAgo: 2 * 1440, approvedBy: ta, scope: 'Read-only · connector c-splunk', durationH: 3, status: 'closed', ticket: 'HS-SUP-40982' },
      { reason: 'Mainframe SMF collector CEF mapping', requestedMinAgo: 6 * 1440, approvedBy: ta, scope: 'Read-only · edge collector dp-dc', durationH: 4, status: 'closed', ticket: 'HS-SUP-40711' },
    ],
    media: [
      { reason: 'KnowBe4 API key rotation: connector resume', requestedMinAgo: 70, approvedBy: null, scope: 'Read-only · connector c-knowbe4', durationH: 1, status: 'pending', ticket: 'HS-SUP-22061' },
      { reason: 'Custody agent lineage gap on Lumière VFX transfers', requestedMinAgo: 300, approvedBy: ta, scope: 'Read-only · HexaCustody events (metadata only)', durationH: 4, status: 'active', ticket: 'HS-SUP-22040' },
      { reason: 'Atlanta broadcast edge agent upgrade plan', requestedMinAgo: 5 * 1440, approvedBy: ta, scope: 'Read-only · data plane dp-atl', durationH: 2, status: 'closed', ticket: 'HS-SUP-21877' },
    ],
    healthcare: [
      { reason: 'MI-2026-022: assist DFIR with Falcon telemetry export (no ePHI)', requestedMinAgo: 35, approvedBy: null, scope: 'Read-only · War Room MI-2026-022 metadata, CrowdStrike detections', durationH: 4, status: 'pending', ticket: 'HS-SUP-52214' },
      { reason: 'Epic Clarity extract late after Epic upgrade: connector schema check', requestedMinAgo: 210, approvedBy: ta, scope: 'Read-only · connector c-epic mapping (audit metadata only)', durationH: 2, status: 'active', ticket: 'HS-SUP-52190' },
      { reason: 'Community-hospital edge agent 1.8.8 → 1.9.2 upgrade plan', requestedMinAgo: 3 * 1440, approvedBy: ta, scope: 'Read-only · data plane dp-community', durationH: 2, status: 'closed', ticket: 'HS-SUP-51987' },
      { reason: 'Request to view FairWarning snooping cases for tuning', requestedMinAgo: 8 * 1440, approvedBy: null, scope: 'Requested access to case detail (contains ePHI)', durationH: 3, status: 'denied', ticket: 'HS-SUP-51702' },
    ],
    automotive: [
      { reason: 'MI-2026-019: Armis boundary data for Ingolstadt L3 forensics', requestedMinAgo: 30, approvedBy: null, scope: 'Read-only · connector c-armis, Ingolstadt boundaries', durationH: 4, status: 'pending', ticket: 'HS-SUP-61408' },
      { reason: 'Puebla edge agent 1.8.6 → 1.9.2 upgrade over LTE failover', requestedMinAgo: 120, approvedBy: null, scope: 'Read-only · data plane dp-puebla health', durationH: 2, status: 'pending', ticket: 'HS-SUP-61399' },
      { reason: 'SAP ETD field drift after S/4 support pack', requestedMinAgo: 260, approvedBy: ta, scope: 'Read-only · connector c-sap mapping & logs', durationH: 3, status: 'active', ticket: 'HS-SUP-61370' },
      { reason: 'Battery-plant bundle import verification (data diode)', requestedMinAgo: 4 * 1440, approvedBy: ta, scope: 'Read-only · offline stamp dp-battery signatures (on site, escorted)', durationH: 4, status: 'closed', ticket: 'HS-SUP-61102' },
    ],
    insurance: [
      { reason: 'MI-2026-044: help DFIR scope MFT exfiltration (transfer metadata only, no NPI)', requestedMinAgo: 32, approvedBy: null, scope: 'Read-only · War Room MI-2026-044 metadata, CrowdStrike and Vectra detections', durationH: 4, status: 'pending', ticket: 'HS-SUP-71204' },
      { reason: 'Guidewire Cloud connector field drift after a platform release', requestedMinAgo: 180, approvedBy: ta, scope: 'Read-only · connector c-guidewire mapping & logs', durationH: 3, status: 'active', ticket: 'HS-SUP-71188' },
      { reason: 'z/OS SMF type 80 collector CEF mapping on the data-centre plane', requestedMinAgo: 3 * 1440, approvedBy: ta, scope: 'Read-only · edge collector dp-dc', durationH: 2, status: 'closed', ticket: 'HS-SUP-70961' },
      { reason: 'Request to view claims documents behind a Varonis alert for tuning', requestedMinAgo: 7 * 1440, approvedBy: null, scope: 'Requested access to file contents (contains NPI)', durationH: 2, status: 'denied', ticket: 'HS-SUP-70744' },
    ],
    defence: [
      { reason: 'MI-2026-052: Sentinel (Azure Government) query support for token replay scoping', requestedMinAgo: 28, approvedBy: null, scope: 'Read-only · War Room MI-2026-052 metadata; US-person engineer only, no CUI content', durationH: 3, status: 'pending', ticket: 'HS-SUP-80412' },
      { reason: 'Veeam shop-floor connector timeouts from the Building 3 edge', requestedMinAgo: 240, approvedBy: ta, scope: 'Read-only · connector c-veeam on dp-ot', durationH: 2, status: 'active', ticket: 'HS-SUP-80391' },
      { reason: 'Exostar connector re-authentication after certificate renewal', requestedMinAgo: 5 * 1440, approvedBy: ta, scope: 'Read-only · connector c-exostar config', durationH: 1, status: 'closed', ticket: 'HS-SUP-80127' },
      { reason: 'Offshore follow-the-sun engineer requested enclave access', requestedMinAgo: 9 * 1440, approvedBy: null, scope: 'Requested access to dp-gcch (not a US person: ITAR)', durationH: 4, status: 'denied', ticket: 'HS-SUP-79880' },
    ],
    pharma: [
      { reason: 'MI-2026-061: Claroty and DeltaV Event Chronicle export for Valais forensics', requestedMinAgo: 36, approvedBy: null, scope: 'Read-only · connectors c-claroty, c-deltav (Valais boundaries)', durationH: 4, status: 'pending', ticket: 'HS-SUP-90533' },
      { reason: 'Varonis connector failing after a collector certificate expiry', requestedMinAgo: 150, approvedBy: null, scope: 'Read-only · connector c-varonis', durationH: 2, status: 'pending', ticket: 'HS-SUP-90521' },
      { reason: 'Rave audit-trail connector schema change (Medidata release)', requestedMinAgo: 300, approvedBy: ta, scope: 'Read-only · connector c-rave mapping (audit metadata only)', durationH: 3, status: 'active', ticket: 'HS-SUP-90498' },
      { reason: 'Aseptic line AF-2 bundle signature verification (data diode)', requestedMinAgo: 4 * 1440, approvedBy: ta, scope: 'Read-only · offline stamp dp-aseptic signatures (on site, gowned, escorted)', durationH: 4, status: 'closed', ticket: 'HS-SUP-90211' },
    ],
    sghospital: [
      { reason: 'MI-2026-027: help DFIR with Falcon telemetry export (no patient data)', requestedMinAgo: 30, approvedBy: null, scope: 'Read-only · War Room MI-2026-027 metadata, CrowdStrike detections', durationH: 4, status: 'pending', ticket: 'HS-SUP-63318' },
      { reason: 'TrakCare audit connector degraded after the HealthShare upgrade', requestedMinAgo: 200, approvedBy: ta, scope: 'Read-only · connector c-trakcare mapping (audit metadata only)', durationH: 2, status: 'active', ticket: 'HS-SUP-63290' },
      { reason: 'GuardDuty connector failing: cross-account role trust check', requestedMinAgo: 2 * 1440, approvedBy: ta, scope: 'Read-only · connector c-guardduty config', durationH: 1, status: 'closed', ticket: 'HS-SUP-63101' },
      { reason: 'Request to view FairWarning case detail for tuning', requestedMinAgo: 8 * 1440, approvedBy: null, scope: 'Requested access to case detail (contains patient data; HIA)', durationH: 3, status: 'denied', ticket: 'HS-SUP-62870' },
    ],
    studio: [
      { reason: 'MI-2026-038: NexGuard decode and custody lineage for the Crown of Ash leak', requestedMinAgo: 26, approvedBy: null, scope: 'Read-only · HexaCustody events and NexGuard results (metadata only)', durationH: 4, status: 'pending', ticket: 'HS-SUP-84017' },
      { reason: 'Irdeto connector failing: API token expired', requestedMinAgo: 110, approvedBy: null, scope: 'Read-only · connector c-irdeto', durationH: 1, status: 'pending', ticket: 'HS-SUP-84009' },
      { reason: 'Moxion dailies connector lag after the Autodesk platform move', requestedMinAgo: 330, approvedBy: ta, scope: 'Read-only · connector c-moxion', durationH: 2, status: 'active', ticket: 'HS-SUP-83981' },
      { reason: 'Osaka resort edge agent 1.8.9 → 1.9.2 upgrade (data stays in Japan)', requestedMinAgo: 6 * 1440, approvedBy: ta, scope: 'Read-only · data plane dp-osaka health', durationH: 2, status: 'closed', ticket: 'HS-SUP-83702' },
    ],
  };
  const r = rng(`ops-support-${c.id}`);
  const engineers = [x.support, 'R. Iyer (HexaShield)', 'K. Brandt (HexaShield)'];
  return forCustomer(items, c).map((s, i) => ({ ...s, id: `sa_${r.hex(6)}`, engineer: engineers[i % engineers.length] }));
}

/* =====================================================================
   Crisis War Room scenarios (one live major incident per customer)
   ===================================================================== */
export type TaskStatus = 'done' | 'in_progress' | 'blocked' | 'todo';
export interface WarClock {
  name: string;
  body: string;
  /** Deadline in minutes from incident declaration (null = not applicable). */
  dueMin: number | null;
  /** Minutes from declaration when the clock started. */
  startMin: number;
  status: 'submitted' | 'running' | 'not_applicable' | 'conditional';
  submittedMin?: number;
}
export interface WarScenario {
  id: string;
  title: string;
  tenantId: string;
  severity: 'critical' | 'high';
  phase: string;
  declaredMinAgo: number;
  summary: string;
  commander: string;
  bridge: string;
  timeline: { t: number; title: string; body: string; kind: 'detect' | 'decide' | 'contain' | 'comms' | 'recover' }[];
  tasks: { id: string; title: string; owner: string; dueMin: number; status: TaskStatus; stream: string }[];
  clocks: WarClock[];
  comms: { t: number; channel: 'internal' | 'regulator' | 'customers' | 'press' | 'partners' | 'law enforcement'; to: string; subject: string; by: string; status: 'sent' | 'draft' | 'approved' }[];
  decisions: { t: number; decision: string; by: string; rationale: string }[];
  participants: { name: string; role: string; org: string; joinedMin: number; on: boolean }[];
  services: { name: string; status: 'down' | 'degraded' | 'recovering' | 'operational'; recovery: number; rto: string; note: string }[];
  ioc: string[];
}

const staffOf = (c: CustomerProfile, part: string, fb: string) => c.people.staff.find((s) => s.name.includes(part))?.name ?? fb;

/** Live major incident per customer with its own estate; template customers use warroom's branches. */
const OWN_WARROOMS: Partial<Record<CustomerId, (c: CustomerProfile) => WarScenario>> = {
  insurance: (c) => {
    const p = c.people;
    const bs = c.vocab.businessServices;
    const gc = staffOf(c, 'Hannah', 'General Counsel');
    const cco = staffOf(c, 'Steven', 'Chief Claims Officer');
    const cfo = staffOf(c, 'Michael', 'Chief Financial Officer');
    return {
      id: 'MI-2026-044', title: 'Cl0p data theft from the managed file transfer server', tenantId: 'group', severity: 'critical', phase: 'Containment → notification', declaredMinAgo: 264,
      summary: 'A web shell in the managed file transfer server KMI-MFT-01 was used to pull claims documents, including bodily-injury medical records and files under litigation hold, plus the EXL and Broadridge transfer folders. Nothing was encrypted. Guidewire, the z/OS mainframe and the premium payment CDE are unaffected. Treated as a NYDFS 500.17 cybersecurity event and a likely multi-state NPI breach.',
      commander: p.ciso.name, bridge: 'Teams bridge "MI-044 MFT" + Signal fallback',
      timeline: [
        { t: 0, title: 'Web shell detected on KMI-MFT-01', body: 'CrowdStrike Falcon detection on the MFT web tier; HexaSOC auto-triage escalated to critical', kind: 'detect' },
        { t: 8, title: 'Major incident declared', body: `${p.ciso.name} declared MI-2026-044; bridge opened`, kind: 'decide' },
        { t: 19, title: 'Exfiltration host blocked at the perimeter', body: 'Palo Alto block on the destination; scheduled partner jobs paused', kind: 'contain' },
        { t: 41, title: 'Scope: 38 GB pulled over 3 hours', body: 'Vectra and MFT logs: claims-documents, EXL and Broadridge folders', kind: 'detect' },
        { t: 75, title: 'Containment of KMI-MFT-01 requested', body: 'High-risk action, 0 of 2 approvals', kind: 'decide' },
        { t: 96, title: 'Litigation-hold files confirmed in scope', body: 'Doyle v. Kingsbridge claim files affected; General Counsel engaged outside counsel', kind: 'detect' },
        { t: 130, title: 'Partner transfers moved to the standby MFT', body: 'Cohesity-restored standby; EXL and One Inc jobs resume', kind: 'recover' },
        { t: 170, title: 'Extortion note received via the claims mailbox', body: 'HexaInt matched the Cl0p leak-site pattern; nothing posted yet', kind: 'detect' },
        { t: 210, title: 'Reportable cybersecurity event determined', body: `${p.grcLead.name}: NPI of New York residents in scope (NYDFS 500.17)`, kind: 'decide' },
        { t: 240, title: 'FBI briefed; IoCs shared with FS-ISAC', body: 'Via the FS-ISAC insurance community TAXII feed', kind: 'comms' },
      ],
      tasks: [
        { id: 'T1', title: 'Forensic image of KMI-MFT-01 and web-tier logs', owner: 'HexaShield DFIR', dueMin: 360, status: 'in_progress', stream: 'Investigation' },
        { id: 'T2', title: 'Identify affected individuals and states (claims NPI)', owner: `${gc} + privacy office`, dueMin: 4320, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T3', title: 'NYDFS 500.17 notice via the DFS portal', owner: p.grcLead.name, dueMin: 4530, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T4', title: 'Rebuild the MFT tier; rotate all partner credentials', owner: p.admin.name, dueMin: 600, status: 'in_progress', stream: 'Recovery' },
        { id: 'T5', title: 'Confirm Guidewire, z/OS and the CDE are unaffected', owner: p.socLead.name, dueMin: 180, status: 'done', stream: 'Investigation' },
        { id: 'T6', title: 'Notify EXL, Broadridge and One Inc (contractual)', owner: cco, dueMin: 1440, status: 'todo', stream: 'Partners' },
        { id: 'T7', title: 'Litigation hold: preserve and brief outside counsel', owner: gc, dueMin: 2880, status: 'todo', stream: 'Legal' },
        { id: 'T8', title: 'Insurer notification via Marsh FINPRO', owner: cfo, dueMin: 2880, status: 'done', stream: 'Legal & insurance' },
      ],
      clocks: [
        { name: 'NYDFS 500.17 (72 h)', body: 'Notice to DFS within 72 h of determining a cybersecurity event has occurred', dueMin: 210 + 4320, startMin: 210, status: 'running' },
        { name: 'Connecticut Insurance Department', body: 'Insurance Data Security Law: notify the Commissioner within 3 business days', dueMin: 210 + 4320, startMin: 210, status: 'running' },
        { name: 'Domiciliary regulators (Ohio, Iowa)', body: 'NAIC #668 state adoptions: notify within 72 h', dueMin: 210 + 4320, startMin: 210, status: 'running' },
        { name: 'State AG & individual notices', body: 'State breach laws (30–60 days) once affected individuals are identified', dueMin: 210 + 43200, startMin: 210, status: 'conditional' },
        { name: 'FBI / CISA', body: 'Expected for extortion; IoCs via FS-ISAC', dueMin: 1440, startMin: 8, status: 'submitted', submittedMin: 240 },
        { name: 'Insurer (Beazley via Marsh FINPRO)', body: 'Notice of circumstance; policy condition 48 h', dueMin: 2880, startMin: 8, status: 'submitted', submittedMin: 150 },
        { name: 'SEC Form 8-K Item 1.05', body: 'Not applicable: mutual insurer with no listed securities', dueMin: null, startMin: 0, status: 'not_applicable' },
      ],
      comms: [
        { t: 10, channel: 'internal', to: 'Executive leadership & Board chair', subject: 'MI-2026-044 declared: data theft from the MFT server', by: p.ciso.name, status: 'sent' },
        { t: 60, channel: 'partners', to: 'EXL, Broadridge, One Inc', subject: 'Transfers paused; switch to the standby MFT endpoint', by: cco, status: 'sent' },
        { t: 150, channel: 'partners', to: 'Beazley via Marsh FINPRO', subject: 'Cyber policy notice of circumstance', by: cfo, status: 'sent' },
        { t: 240, channel: 'law enforcement', to: 'FBI New Haven & CISA', subject: 'Extortion notification with IoCs', by: p.socLead.name, status: 'sent' },
        { t: 250, channel: 'regulator', to: 'NYDFS (cybersecurity portal)', subject: 'Notice of cybersecurity event under 500.17', by: p.grcLead.name, status: 'approved' },
        { t: 255, channel: 'regulator', to: 'Connecticut Insurance Department', subject: 'Notice under the Insurance Data Security Law', by: p.grcLead.name, status: 'draft' },
        { t: 260, channel: 'press', to: 'Holding statement (reactive)', subject: '"We are investigating unauthorised access to a file transfer system; claims and policy services continue"', by: 'Corporate communications', status: 'approved' },
      ],
      decisions: [
        { t: 19, decision: 'Block the exfiltration host and pause partner transfers', by: p.ciso.name, rationale: 'Stop data loss; partners can wait hours, not days' },
        { t: 96, decision: 'Treat litigation-hold files as in scope; engage outside counsel', by: gc, rationale: 'Preservation and privilege duties' },
        { t: 130, decision: 'Run partner transfers from the clean standby, not the compromised server', by: p.ciso.name, rationale: 'FNOL and claim payments depend on EXL and One Inc files' },
        { t: 170, decision: 'No engagement with the extortion actor', by: p.board.name, rationale: 'Group policy; data theft only, no encryption' },
        { t: 210, decision: 'Determine a reportable cybersecurity event (NYDFS 500.17)', by: p.grcLead.name, rationale: 'NPI of New York residents in the stolen folders' },
      ],
      participants: [
        { name: p.ciso.name, role: 'Incident commander', org: 'Kingsbridge', joinedMin: 8, on: true },
        { name: p.socLead.name, role: 'Security operations', org: 'Kingsbridge', joinedMin: 4, on: true },
        { name: p.grcLead.name, role: 'Regulatory notifications', org: 'Kingsbridge', joinedMin: 30, on: true },
        { name: gc, role: 'Legal & litigation hold', org: 'Kingsbridge', joinedMin: 90, on: true },
        { name: cco, role: 'Claims operations & partners', org: 'Kingsbridge Claims', joinedMin: 45, on: false },
        { name: 'HexaShield DFIR (3)', role: 'Forensics & IR retainer', org: 'HexaShield', joinedMin: 20, on: true },
        { name: 'Outside counsel (privacy & litigation)', role: 'Breach counsel', org: 'Law firm', joinedMin: 110, on: true },
        { name: 'Marsh FINPRO', role: 'Broker liaison', org: 'Broker', joinedMin: 160, on: false },
      ],
      services: [
        { name: bs[0], status: 'degraded', recovery: 75, rto: '12 h', note: 'Partner files via the standby MFT; claim payments on schedule' },
        { name: bs[1], status: 'operational', recovery: 100, rto: '—', note: 'AgentHub and Guidewire unaffected' },
        { name: bs[2], status: 'degraded', recovery: 85, rto: '24 h', note: 'Broadridge print & mail files delayed' },
        { name: bs[3], status: 'operational', recovery: 100, rto: '—', note: 'CDE unaffected; One Inc files on the standby' },
        { name: bs[4], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
        { name: bs[5], status: 'operational', recovery: 100, rto: '—', note: 'Surge plan unaffected; EXL capacity confirmed' },
      ],
      ioc: ['claims-docshare[.]net', 'Web shell on the MFT web tier (sha256 c41b…7e09)', 'Cl0p extortion note via the claims mailbox'],
    };
  },
  defence: (c) => {
    const p = c.people;
    const bs = c.vocab.businessServices;
    const eo = staffOf(c, 'Carla', 'Empowered Official');
    const fso = staffOf(c, 'Holly', 'Facility Security Officer');
    const vpp = staffOf(c, 'Gregory', 'VP Programs');
    return {
      id: 'MI-2026-052', title: 'AiTM phishing hijack of a GCC High session: CUI accessed', tenantId: 'programs', severity: 'critical', phase: 'Investigation → DFARS reporting', declaredMinAgo: 228,
      summary: 'An RTX-themed adversary-in-the-middle lure captured a session cookie for the Contracts & Subcontracts Manager. The token was replayed from a non-US VPS against the CUI enclave in GCC High and used to open two programme SharePoint sites holding ITAR drawing sets. Handled as a DFARS 252.204-7012 cyber incident: 72-hour DIBNet report, 90-day image preservation and prime notification. Building 3 and the Tucson range are unaffected.',
      commander: p.ciso.name, bridge: 'Teams (GCC High) bridge "MI-052" + secure phone bridge · US persons only',
      timeline: [
        { t: 0, title: 'Token used from a non-US network', body: 'Entra ID Protection high-risk sign-in correlated in Sentinel (Azure Government); HexaSOC escalated', kind: 'detect' },
        { t: 7, title: 'Major incident declared', body: `${p.ciso.name} declared MI-2026-052; need-to-know list applied`, kind: 'decide' },
        { t: 12, title: 'Non-US locations blocked for all enclave apps', body: 'Conditional Access policy change, approved by the CISO', kind: 'contain' },
        { t: 35, title: 'AiTM lure identified', body: 'Fake subcontract modification from a lookalike SharePoint domain; 6 recipients, 1 click', kind: 'detect' },
        { t: 62, title: 'CUI access confirmed', body: 'Purview audit: 2 programme sites opened, 41 CUI//SP-EXPT files previewed', kind: 'detect' },
        { t: 90, title: 'Empowered Official engaged', body: `${eo} assessing a possible unauthorised export of technical data`, kind: 'decide' },
        { t: 120, title: 'Images and logs preserved for DC3', body: '90-day retention under DFARS 7012(e)', kind: 'recover' },
        { t: 160, title: 'RTX supply-chain security notified', body: 'Per the subcontract flow-down', kind: 'comms' },
        { t: 200, title: 'Session revocation requested', body: 'High-risk action, 1 of 2 approvals', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'DIBNet incident report (medium assurance certificate)', owner: p.grcLead.name, dueMin: 4320, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T2', title: 'Preserve images and packet capture for 90 days', owner: 'HexaShield DFIR (US persons)', dueMin: 360, status: 'in_progress', stream: 'Investigation' },
        { id: 'T3', title: 'Enumerate CUI files accessed (Purview, SharePoint audit)', owner: p.socLead.name, dueMin: 240, status: 'in_progress', stream: 'Investigation' },
        { id: 'T4', title: 'ITAR assessment and possible voluntary disclosure to DDTC', owner: eo, dueMin: 2880, status: 'in_progress', stream: 'Legal' },
        { id: 'T5', title: 'Notify affected primes per flow-down clauses', owner: vpp, dueMin: 4320, status: 'todo', stream: 'Partners' },
        { id: 'T6', title: 'Enforce token protection and compliant-device access in GCC High', owner: p.admin.name, dueMin: 480, status: 'in_progress', stream: 'Containment' },
        { id: 'T7', title: 'Confirm no access from the commercial tenant or Building 3', owner: p.otLead?.name ?? p.socLead.name, dueMin: 240, status: 'done', stream: 'Investigation' },
        { id: 'T8', title: 'Update SSP and POA&M; review SPRS score impact', owner: p.grcLead.name, dueMin: 10080, status: 'todo', stream: 'Compliance' },
      ],
      clocks: [
        { name: 'DFARS 7012 DIBNet report (72 h)', body: 'Rapidly report to DoD via DIBNet within 72 h of discovery', dueMin: 4320, startMin: 7, status: 'running' },
        { name: 'Prime notification (flow-down)', body: 'Subcontract flow-down of DFARS 7012(m): notify the prime', dueMin: 4320, startMin: 7, status: 'submitted', submittedMin: 160 },
        { name: 'Media preservation (90 days)', body: 'Preserve images of affected systems for at least 90 days; provide to DC3 on request', dueMin: 129600, startMin: 120, status: 'running' },
        { name: 'DDTC voluntary disclosure (ITAR §127.12)', body: 'Initial notification promptly if an unauthorised export is likely; full disclosure within 60 days', dueMin: 86400, startMin: 90, status: 'conditional' },
        { name: 'FBI (Huntsville)', body: 'Expected for nation-state activity against the defence industrial base', dueMin: 1440, startMin: 7, status: 'submitted', submittedMin: 180 },
        { name: 'Insurer (Beazley via Marsh McLennan Agency)', body: 'Notice of circumstance; policy condition 48 h', dueMin: 2880, startMin: 7, status: 'running' },
        { name: 'C3PAO', body: 'Not a reporting obligation; brief Redstone Cyber Assessors before the Level 2 reassessment', dueMin: null, startMin: 0, status: 'not_applicable' },
      ],
      comms: [
        { t: 9, channel: 'internal', to: 'CEO, FSO and Empowered Official', subject: 'MI-2026-052 declared: GCC High session hijack', by: p.ciso.name, status: 'sent' },
        { t: 40, channel: 'internal', to: 'All CUI enclave users', subject: 'Do not open "subcontract modification" emails; use the Report button', by: p.socLead.name, status: 'sent' },
        { t: 160, channel: 'partners', to: 'RTX supply-chain cyber team', subject: 'Cyber incident affecting covered defence information', by: vpp, status: 'sent' },
        { t: 180, channel: 'law enforcement', to: 'FBI Huntsville', subject: 'Notification with IoCs', by: p.socLead.name, status: 'sent' },
        { t: 210, channel: 'regulator', to: 'DoD via DIBNet', subject: 'DFARS 252.204-7012 cyber incident report', by: p.grcLead.name, status: 'draft' },
        { t: 220, channel: 'regulator', to: 'DDTC (initial notification)', subject: 'Possible unauthorised export of technical data', by: eo, status: 'draft' },
        { t: 225, channel: 'partners', to: 'Lockheed Martin, Northrop Grumman, L3Harris', subject: 'Courtesy notice: no impact to your programmes identified', by: vpp, status: 'approved' },
      ],
      decisions: [
        { t: 12, decision: 'Block non-US locations for every enclave app', by: p.ciso.name, rationale: 'Contain token replay while sessions are reviewed' },
        { t: 62, decision: 'Handle as a DFARS 7012 cyber incident', by: p.grcLead.name, rationale: 'CUI//SP-EXPT files previewed from a non-US IP' },
        { t: 90, decision: 'Engage the Empowered Official on ITAR exposure', by: p.ciso.name, rationale: 'Technical data viewed from abroad may be an export' },
        { t: 140, decision: 'No public statement; need-to-know only', by: p.board.name, rationale: 'Prime contract terms and programme sensitivity' },
        { t: 200, decision: 'Revoke all sessions and re-issue the YubiKey in person', by: p.socLead.name, rationale: `Token theft; re-enrolment witnessed by ${fso}` },
      ],
      participants: [
        { name: p.ciso.name, role: 'Incident commander', org: 'Sentry Peak', joinedMin: 7, on: true },
        { name: p.socLead.name, role: 'Security operations', org: 'Sentry Peak', joinedMin: 3, on: true },
        { name: p.grcLead.name, role: 'DFARS & CMMC reporting', org: 'Sentry Peak', joinedMin: 25, on: true },
        { name: eo, role: 'Empowered Official (ITAR)', org: 'Sentry Peak', joinedMin: 88, on: true },
        { name: fso, role: 'Facility Security Officer', org: 'Sentry Peak', joinedMin: 15, on: true },
        { name: vpp, role: 'Prime liaison', org: 'Sentry Peak', joinedMin: 140, on: false },
        { name: 'HexaShield DFIR (2, US persons)', role: 'Forensics & IR retainer', org: 'HexaShield', joinedMin: 30, on: true },
        { name: 'Marsh McLennan Agency', role: 'Broker liaison', org: 'Broker', joinedMin: 190, on: false },
      ],
      services: [
        { name: bs[0], status: 'degraded', recovery: 80, rto: '48 h', note: 'Enclave work continues under heightened access controls' },
        { name: bs[1], status: 'operational', recovery: 100, rto: '—', note: 'Building 3 not affected' },
        { name: bs[2], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
        { name: bs[3], status: 'operational', recovery: 100, rto: '—', note: 'Tucson not affected' },
        { name: bs[4], status: 'degraded', recovery: 60, rto: '72 h', note: 'RTX capture volume II access restricted pending review' },
        { name: bs[5], status: 'operational', recovery: 100, rto: '—', note: 'Costpoint not affected' },
      ],
      ioc: ['sharepoint-rtx-subk[.]com (AiTM kit)', 'Non-US VPS reverse proxy 45.86.x.x', 'Lure: "Subcontract Modification 07 – action required"'],
    };
  },
  pharma: (c) => {
    const p = c.people;
    const bs = c.vocab.businessServices;
    const qp = staffOf(c, 'Reto', 'Qualified Person');
    const mfg = staffOf(c, 'Fabian', 'Head of Global Manufacturing & Supply');
    const cfo = staffOf(c, 'Isabelle', 'Chief Financial Officer');
    return {
      id: 'MI-2026-061', title: 'Ransomware at the Valais plant: batch release on hold', tenantId: 'valais', severity: 'critical', phase: 'Containment → recovery', declaredMinAgo: 274,
      summary: 'A Black Basta affiliate encrypted the Valais plant file server and four PAS-X MES client workstations after entering through a phished engineer and an unpatched VPN appliance. API production in building 12 is in a controlled hold and QP release from Valais is suspended pending a data-integrity review. DeltaV controllers and the air-gapped aseptic line AF-2 are unaffected (Claroty and HexaOT passive only). Cork, clinical systems and SAP are unaffected.',
      commander: p.ciso.name, bridge: 'Teams bridge "MI-061 VLS" + plant crisis room (building 4)',
      timeline: [
        { t: 0, title: 'Mass encryption on the Valais file server', body: 'CrowdStrike Falcon ransomware detection; HexaSOC auto-triage escalated to critical', kind: 'detect' },
        { t: 6, title: 'Major incident declared', body: `${p.ciso.name} declared MI-2026-061; plant crisis team convened`, kind: 'decide' },
        { t: 14, title: 'Level 3.5 conduits closed at Valais', body: 'Plant isolated from group IT; DeltaV continues on local control', kind: 'contain' },
        { t: 25, title: 'Building 12 API batches on controlled hold', body: 'Batch 26V118 held at step 14; deviation DEV-26-0412 raised', kind: 'contain' },
        { t: 48, title: 'QP release from Valais suspended', body: 'No batch certified until electronic batch-record integrity is confirmed', kind: 'decide' },
        { t: 80, title: 'Entry point: phished engineer and VPN appliance', body: 'Proofpoint click two days earlier; KEV-listed VPN flaw unpatched', kind: 'detect' },
        { t: 120, title: 'Clean restore point confirmed', body: 'Rubrik immutable snapshot from 03:00 verified clean', kind: 'recover' },
        { t: 165, title: 'NCSC report filed', body: 'Via the NCSC reporting portal (ISA 24-hour duty)', kind: 'comms' },
        { t: 205, title: 'MES client rebuild started in a validated clean room', body: 'Körber engineers on the bridge; IQ/OQ scripts ready', kind: 'recover' },
        { t: 250, title: 'Containment of VLS-MES-WS07 requested', body: 'High-risk action with QA sign-off, 0 of 2 approvals', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'Restore the file server and PAS-X clients from Rubrik; execute IQ/OQ', owner: 'Plant IT + Körber Pharma', dueMin: 720, status: 'in_progress', stream: 'Recovery' },
        { id: 'T2', title: 'Data-integrity review of batch records since 00:00 (ALCOA+)', owner: qp, dueMin: 1440, status: 'in_progress', stream: 'Quality' },
        { id: 'T3', title: 'Impact assessment of held batches and open deviations', owner: mfg, dueMin: 1440, status: 'in_progress', stream: 'Quality' },
        { id: 'T4', title: 'Confirm DeltaV and AF-2 unaffected (Claroty, HexaOT passive)', owner: p.otLead?.name ?? 'OT security', dueMin: 120, status: 'done', stream: 'Investigation' },
        { id: 'T5', title: 'Supply continuity: Cork stock and CDMO capacity (Lonza)', owner: mfg, dueMin: 2880, status: 'todo', stream: 'Supply chain' },
        { id: 'T6', title: 'Swissmedic GMP notification (supply impact)', owner: p.grcLead.name, dueMin: 4320, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T7', title: 'Patch the VPN appliance; rotate VPN and vendor credentials', owner: p.socLead.name, dueMin: 300, status: 'blocked', stream: 'Containment' },
        { id: 'T8', title: 'revDSG / GDPR assessment of employee data on the file server', owner: 'Group Data Protection Officer', dueMin: 4320, status: 'in_progress', stream: 'Regulatory' },
      ],
      clocks: [
        { name: 'NCSC Switzerland (24 h)', body: 'Information Security Act: cyber attack on critical infrastructure reported within 24 h of discovery', dueMin: 1440, startMin: 6, status: 'submitted', submittedMin: 165 },
        { name: 'Swissmedic (GMP inspectorate)', body: 'Significant GMP event with potential supply impact', dueMin: 4320, startMin: 48, status: 'running' },
        { name: 'FDA (field alert / shortage)', body: 'Only if distributed US product quality or supply is affected', dueMin: null, startMin: 48, status: 'conditional' },
        { name: 'EMA / national competent authorities', body: 'Shortage notification only if supply of an authorised product is at risk', dueMin: null, startMin: 48, status: 'conditional' },
        { name: 'FDPIC (revDSG)', body: 'Data breach likely to result in high risk: notify as soon as possible', dueMin: 4320, startMin: 80, status: 'conditional' },
        { name: 'Insurer (Swiss Re Corporate Solutions via Marsh)', body: 'Notice of circumstance within 48 h', dueMin: 2880, startMin: 6, status: 'submitted', submittedMin: 140 },
      ],
      comms: [
        { t: 8, channel: 'internal', to: 'Executive Committee', subject: 'MI-2026-061 declared: Valais plant ransomware', by: p.ciso.name, status: 'sent' },
        { t: 30, channel: 'internal', to: 'Valais plant staff', subject: 'Do not log on to MES clients; paper batch-record contingency in force', by: mfg, status: 'sent' },
        { t: 140, channel: 'partners', to: 'Swiss Re Corporate Solutions via Marsh Switzerland', subject: 'Cyber policy notice of circumstance', by: cfo, status: 'sent' },
        { t: 165, channel: 'regulator', to: 'NCSC Switzerland', subject: 'Cyber attack on a pharmaceutical manufacturer', by: p.grcLead.name, status: 'sent' },
        { t: 200, channel: 'regulator', to: 'Swissmedic inspectorate', subject: 'GMP event: Valais batch release suspended', by: qp, status: 'draft' },
        { t: 230, channel: 'partners', to: 'Lonza (CDMO)', subject: 'Confidential: Valais hold and capacity enquiry', by: mfg, status: 'approved' },
        { t: 260, channel: 'press', to: 'Holding statement (reactive)', subject: '"An IT incident is affecting one of our production sites; patient supply is being protected"', by: 'Group communications', status: 'approved' },
      ],
      decisions: [
        { t: 14, decision: 'Close Valais Level 3.5 conduits; keep DeltaV on local control', by: p.ciso.name, rationale: 'Contain spread without an unsafe stop of running unit operations' },
        { t: 25, decision: 'Controlled hold of building 12 batches', by: qp, rationale: 'Batch-record integrity cannot be assured' },
        { t: 48, decision: 'Suspend QP certification from Valais', by: qp, rationale: 'Annex 16: no release without data integrity' },
        { t: 120, decision: 'Restore from the 03:00 snapshot; rebuild MES clients under change control', by: p.ciso.name, rationale: 'Fastest validated route back to GMP' },
        { t: 150, decision: 'No engagement with the ransom actor', by: p.board.name, rationale: 'Group policy; sanctions risk; backups verified' },
      ],
      participants: [
        { name: p.ciso.name, role: 'Incident commander', org: 'Rhenara', joinedMin: 6, on: true },
        { name: p.socLead.name, role: 'Cyber Defence Centre', org: 'Rhenara', joinedMin: 3, on: true },
        { name: p.otLead?.name ?? 'OT security', role: 'OT security (plants)', org: 'Rhenara', joinedMin: 10, on: true },
        { name: qp, role: 'Qualified Person', org: 'Rhenara Valais', joinedMin: 22, on: true },
        { name: mfg, role: 'Manufacturing & supply', org: 'Rhenara', joinedMin: 30, on: true },
        { name: p.grcLead.name, role: 'GxP & regulator notifications', org: 'Rhenara', joinedMin: 40, on: true },
        { name: 'HexaShield DFIR (3)', role: 'Forensics & IR retainer', org: 'HexaShield', joinedMin: 20, on: true },
        { name: 'Körber Pharma (PAS-X)', role: 'MES recovery', org: 'Vendor', joinedMin: 190, on: true },
        { name: 'Marsh Switzerland', role: 'Broker liaison', org: 'Broker', joinedMin: 150, on: false },
      ],
      services: [
        { name: bs[0], status: 'down', recovery: 10, rto: '72 h', note: 'Valais release suspended; Cork releasing from stock' },
        { name: bs[1], status: 'operational', recovery: 100, rto: '—', note: 'Cork unaffected; AF-2 air-gapped' },
        { name: bs[2], status: 'operational', recovery: 100, rto: '—', note: 'Rave, eTMF and CTMS unaffected' },
        { name: bs[3], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
        { name: bs[4], status: 'operational', recovery: 100, rto: '—', note: 'Argus unaffected' },
        { name: bs[5], status: 'degraded', recovery: 85, rto: '2 weeks', note: 'Safety stock covers about 6 weeks' },
      ],
      ioc: ['91.92.247.18 (C2)', 'Black Basta note: readme.txt', 'Loader on VLS-MES-WS07 (sha256 5ab0…e21c)'],
    };
  },
  sghospital: (c) => {
    const p = c.people;
    const bs = c.vocab.businessServices;
    const cmio = staffOf(c, 'Rachel', 'Chief Medical Information Officer');
    const cno = staffOf(c, 'Nurul', 'Chief Nursing Officer');
    const cmo = staffOf(c, 'Arun', 'Chief Medical Officer');
    const trak = staffOf(c, 'Benjamin', 'TrakCare Application Lead');
    const cfo = staffOf(c, 'Kenneth', 'Group Chief Financial Officer');
    return {
      id: 'MI-2026-027', title: 'Ransomware on the TrakCare application tier: downtime procedures in force', tenantId: 'obh', severity: 'critical', phase: 'Containment → recovery', declaredMinAgo: 246,
      summary: 'A Qilin affiliate used a stolen InterSystems vendor credential to reach the TrakCare application tier and encrypted a clinical file share and one application server. The main hospital and specialist centres are on downtime procedures (read-only TrakCare print-outs, paper orders); A&E is on reduced intake. The IRIS database, PACS, the Alaris pump server and all medical devices are unaffected (Claroty and Armis passive only). NEHR contribution is paused.',
      commander: p.ciso.name, bridge: 'Teams bridge "MI-027 TrakCare" + hospital emergency operations centre',
      timeline: [
        { t: 0, title: 'Mass encryption on the clinical file share', body: 'CrowdStrike Falcon ransomware detection; HexaSOC auto-triage escalated to critical', kind: 'detect' },
        { t: 6, title: 'Major incident declared', body: `${p.ciso.name} declared MI-2026-027; emergency operations centre opened`, kind: 'decide' },
        { t: 11, title: 'TrakCare downtime procedures activated', body: 'Read-only print-outs, paper orders and medication charts on every ward', kind: 'contain' },
        { t: 38, title: 'Entry point: InterSystems vendor credential', body: 'CyberArk Vendor PAM session at 02:31 SGT; credential seen in a stealer log', kind: 'detect' },
        { t: 62, title: 'A&E on reduced intake', body: 'SCDF informed; priority-1 ambulance cases still accepted', kind: 'decide' },
        { t: 95, title: 'MOH notified inside the 2-hour window', body: 'Initial notification under the Health Information Act', kind: 'comms' },
        { t: 130, title: 'Clean restore point confirmed', body: 'Cohesity immutable snapshot from 01:00 verified clean', kind: 'recover' },
        { t: 180, title: 'NEHR contribution paused; Synapxe informed', body: 'Resumes after integrity checks on queued records', kind: 'comms' },
        { t: 220, title: 'Containment of OBH-TRAK-APP03 requested', body: 'High-risk action with clinical sign-off, 0 of 2 approvals', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'Restore the file share and APP03 from Cohesity; re-validate TrakCare', owner: `${trak} + InterSystems`, dueMin: 720, status: 'in_progress', stream: 'Recovery' },
        { id: 'T2', title: 'Back-load paper orders and medication charts after recovery', owner: cno, dueMin: 1440, status: 'todo', stream: 'Clinical' },
        { id: 'T3', title: 'Confirm medical devices unaffected (Claroty, Armis passive)', owner: p.otLead?.name ?? 'Biomedical engineering', dueMin: 120, status: 'done', stream: 'Investigation' },
        { id: 'T4', title: 'MOH HIA incident report (14 days)', owner: p.grcLead.name, dueMin: 20160, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T5', title: 'PDPA breach assessment for the encrypted share', owner: 'Data Protection Officer', dueMin: 4320, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T6', title: 'Forensic images: OBH-TRAK-APP03 and the clinical file share', owner: 'HexaShield DFIR', dueMin: 360, status: 'in_progress', stream: 'Investigation' },
        { id: 'T7', title: 'Per-session approval for every vendor PAM account', owner: p.socLead.name, dueMin: 300, status: 'blocked', stream: 'Containment' },
        { id: 'T8', title: 'Hold insurer claims; inform Great Eastern, AIA and Prudential', owner: cfo, dueMin: 1440, status: 'todo', stream: 'Business' },
      ],
      clocks: [
        { name: 'MOH notification (HIA, 2 h)', body: 'Cybersecurity incident affecting a licensed healthcare service: notify MOH within 2 hours', dueMin: 120, startMin: 6, status: 'submitted', submittedMin: 95 },
        { name: 'MOH HIA incident report (14 days)', body: 'Full report with root cause, impact and remediation', dueMin: 20160, startMin: 6, status: 'running' },
        { name: 'PDPC (PDPA, 3 days)', body: 'Notify within 3 calendar days of assessing a notifiable data breach', dueMin: 140 + 4320, startMin: 140, status: 'conditional' },
        { name: 'Affected patients (PDPA)', body: 'On or after notifying PDPC, if significant harm is likely', dueMin: null, startMin: 140, status: 'conditional' },
        { name: 'Synapxe (NEHR)', body: 'Inform before pausing contribution; resume after integrity checks', dueMin: 240, startMin: 6, status: 'submitted', submittedMin: 180 },
        { name: 'CSA SingCERT', body: 'Voluntary report with IoCs (not a designated CII owner)', dueMin: 1440, startMin: 6, status: 'submitted', submittedMin: 160 },
        { name: 'Insurer (Chubb via Marsh Singapore)', body: 'Notice of circumstance within 48 h', dueMin: 2880, startMin: 6, status: 'running' },
      ],
      comms: [
        { t: 8, channel: 'internal', to: 'Group CEO & Medical Board', subject: 'MI-2026-027 declared: TrakCare downtime', by: p.ciso.name, status: 'sent' },
        { t: 15, channel: 'internal', to: 'All wards and clinics', subject: 'Downtime procedures in force: print-outs, paper orders, no USB', by: cno, status: 'sent' },
        { t: 95, channel: 'regulator', to: 'Ministry of Health', subject: 'Initial notification of a cybersecurity incident (HIA)', by: p.grcLead.name, status: 'sent' },
        { t: 160, channel: 'partners', to: 'CSA SingCERT', subject: 'Voluntary incident report with IoCs', by: p.socLead.name, status: 'sent' },
        { t: 180, channel: 'partners', to: 'Synapxe', subject: 'NEHR contribution paused', by: cmio, status: 'sent' },
        { t: 200, channel: 'customers', to: 'Patients with appointments today (SMS)', subject: 'Appointments continue; please expect delays', by: 'Patient services', status: 'approved' },
        { t: 235, channel: 'press', to: 'Holding statement (reactive)', subject: '"We are managing an IT incident; patient care continues safely"', by: 'Corporate communications', status: 'approved' },
      ],
      decisions: [
        { t: 11, decision: 'Activate TrakCare downtime procedures at all campuses', by: cmio, rationale: 'Stop spread; keep clinical data available read-only' },
        { t: 62, decision: 'Reduced A&E intake (priority-1 ambulance cases only)', by: cmo, rationale: 'Paper orders and slower laboratory turnaround' },
        { t: 130, decision: 'Restore from the 01:00 snapshot', by: p.ciso.name, rationale: 'Verified clean by HexaShield DFIR' },
        { t: 150, decision: 'No engagement with the ransom actor', by: p.board.name, rationale: 'Group policy; sanctions risk; backups verified' },
        { t: 220, decision: 'Contain OBH-TRAK-APP03 with clinical sign-off', by: p.socLead.name, rationale: 'Encryptor staged; sessions moved to APP01 and APP02' },
      ],
      participants: [
        { name: p.ciso.name, role: 'Incident commander', org: 'Orchid Bay', joinedMin: 6, on: true },
        { name: p.socLead.name, role: 'Security operations', org: 'Orchid Bay', joinedMin: 3, on: true },
        { name: p.grcLead.name, role: 'HIA & PDPA notifications', org: 'Orchid Bay', joinedMin: 20, on: true },
        { name: cmio, role: 'Clinical systems', org: 'Orchid Bay', joinedMin: 9, on: true },
        { name: cno, role: 'Clinical operations (downtime)', org: 'Orchid Bay', joinedMin: 12, on: true },
        { name: p.otLead?.name ?? 'Biomedical engineering', role: 'Medical device safety', org: 'Orchid Bay', joinedMin: 18, on: false },
        { name: 'HexaShield DFIR (3)', role: 'Forensics & IR retainer', org: 'HexaShield', joinedMin: 22, on: true },
        { name: 'InterSystems duty engineer', role: 'TrakCare recovery', org: 'Vendor', joinedMin: 70, on: true },
        { name: 'Marsh Singapore', role: 'Broker liaison', org: 'Broker', joinedMin: 160, on: false },
      ],
      services: [
        { name: bs[0], status: 'degraded', recovery: 60, rto: '12 h', note: 'Reduced intake; priority-1 ambulance cases accepted' },
        { name: bs[1], status: 'degraded', recovery: 65, rto: '24 h', note: 'Paper medication charts from print-outs' },
        { name: bs[2], status: 'degraded', recovery: 70, rto: '24 h', note: 'Elective lists at Novena postponed; day surgery running' },
        { name: bs[3], status: 'degraded', recovery: 85, rto: '12 h', note: 'PACS unaffected; urgent reports by phone' },
        { name: bs[4], status: 'recovering', recovery: 75, rto: '12 h', note: 'LIS results by print-out and runner' },
        { name: bs[5], status: 'down', recovery: 15, rto: '72 h', note: 'Insurer claims held' },
      ],
      ioc: ['cdn-trakupdate[.]com', 'Qilin note: README-RECOVER.txt', 'isc-support-sg (vendor PAM account)'],
    };
  },
  studio: (c) => {
    const p = c.people;
    const bs = c.vocab.businessServices;
    const x = forCustomer(EXTRA, c);
    const post = staffOf(c, 'Ben Hollis', 'Head of Post & VFX');
    const pres = staffOf(c, 'Olivia', 'President, Starfall Studios');
    const awards = staffOf(c, 'Laura Kim', 'Awards & Screeners Manager');
    const cfo = staffOf(c, 'Daniel', 'Chief Financial Officer');
    return {
      id: 'MI-2026-038', title: 'Pre-release leak of Crown of Ash (locked cut v22)', tenantId: 'post', severity: 'critical', phase: 'Investigation & takedown', declaredMinAgo: 196,
      summary: 'A 2-minute clip of the Crown of Ash locked cut v22 surfaced on a Telegram leak channel and four forum mirrors. The NexGuard watermark traces to a Northlight Pixel (Vancouver) review session, and HexaCustody shows the same cut pulled through the vendor\'s Aspera node key from a host outside its network. Release is nine weeks out and awards screeners are live on Indee.',
      commander: p.grcLead.name, bridge: 'Google Meet "CoA WR" (need-to-know) + Slack incident channel',
      timeline: [
        { t: 0, title: 'Clip found on a Telegram leak channel', body: 'HexaInt leak monitoring (Irdeto connector failing), 18k views at detection', kind: 'detect' },
        { t: 5, title: 'War room declared', body: `${p.grcLead.name} as commander; need-to-know list applied`, kind: 'decide' },
        { t: 19, title: 'NexGuard watermark decoded', body: 'Session mark WM-31877: Northlight Pixel review session, Vancouver', kind: 'detect' },
        { t: 34, title: 'Takedown requests issued', body: 'MarkMonitor: Telegram, 4 mirrors and 2 forums', kind: 'contain' },
        { t: 58, title: 'Aspera pull from an unknown host', body: 'Vendor node key used outside Northlight\'s address ranges; key disabled by pre-approved playbook', kind: 'detect' },
        { t: 90, title: 'Freelancer factor reset flagged', body: 'Help-desk reset then 41 Lodestar plate downloads from a new device', kind: 'detect' },
        { t: 120, title: 'Northlight and studio partners briefed', body: 'Co-financier and distributors informed under NDA', kind: 'comms' },
        { t: 160, title: 'All Crown of Ash review links rotated', body: 'Frame.io and Moxion links expired and re-issued', kind: 'contain' },
        { t: 185, title: 'Supplier revocation for Northlight staged', body: 'High-risk action, 1 of 2 approvals', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'Preserve Aspera, Okta and custody logs; request the vendor host image', owner: 'HexaShield DFIR', dueMin: 300, status: 'in_progress', stream: 'Investigation' },
        { id: 'T2', title: 'Takedown: remaining mirrors', owner: x.analysts[0], dueMin: 240, status: 'in_progress', stream: 'Containment' },
        { id: 'T3', title: 'TPN incident disclosure; re-assess Northlight Pixel', owner: p.grcLead.name, dueMin: 1440, status: 'todo', stream: 'Regulatory' },
        { id: 'T4', title: 'Notice of breach to Northlight under the vendor agreement', owner: 'Legal (content & IP)', dueMin: 720, status: 'in_progress', stream: 'Legal' },
        { id: 'T5', title: 'Referral to law enforcement (FBI IC3, RCMP)', owner: 'Legal (content & IP)', dueMin: 1440, status: 'todo', stream: 'Legal' },
        { id: 'T6', title: 'Re-issue FYC screeners with per-viewer marks', owner: awards, dueMin: 480, status: 'in_progress', stream: 'Containment' },
        { id: 'T7', title: 'SEC materiality assessment (8-K Item 1.05)', owner: `General Counsel + ${cfo}`, dueMin: 2880, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T8', title: 'Marketing: trailer timing decision', owner: pres, dueMin: 900, status: 'blocked', stream: 'Business' },
      ],
      clocks: [
        { name: 'Studio partners (contractual)', body: 'Co-financier & distributors: notify within 24 h', dueMin: 1440, startMin: 5, status: 'submitted', submittedMin: 125 },
        { name: 'TPN disclosure', body: 'Content security incident disclosure to TPN', dueMin: 4320, startMin: 5, status: 'running' },
        { name: 'SEC Form 8-K Item 1.05', body: 'Within 4 business days of a materiality determination (assessment under way)', dueMin: null, startMin: 5, status: 'conditional' },
        { name: 'Law enforcement referral', body: 'FBI IC3 (US) / RCMP (Canada): internal target 24 h', dueMin: 1440, startMin: 5, status: 'running' },
        { name: 'CCPA / PIPEDA', body: 'Only if personal data is in the leaked material (cast & crew)', dueMin: 4320, startMin: 19, status: 'conditional' },
        { name: 'Insurer (AIG via Marsh Media & Entertainment)', body: 'Policy condition: notify within 72 h', dueMin: 4320, startMin: 5, status: 'running' },
        { name: 'Takedown SLA (per URL)', body: 'Internal target: 2 h per new URL', dueMin: 274, startMin: 34, status: 'running' },
      ],
      comms: [
        { t: 7, channel: 'internal', to: 'Need-to-know list (11)', subject: 'Crown of Ash war room opened', by: p.grcLead.name, status: 'sent' },
        { t: 34, channel: 'partners', to: 'Telegram, forum hosts, mirrors', subject: 'Copyright takedown notices (MarkMonitor)', by: x.analysts[0], status: 'sent' },
        { t: 120, channel: 'partners', to: 'Northlight Pixel leadership', subject: 'Notice of security incident under the vendor agreement', by: p.grcLead.name, status: 'sent' },
        { t: 125, channel: 'partners', to: 'Co-financier & international distributors', subject: 'Confidential: pre-release leak, Crown of Ash', by: pres, status: 'sent' },
        { t: 170, channel: 'law enforcement', to: 'FBI IC3 (referral pack)', subject: 'Unauthorised distribution of a pre-release film', by: 'Legal (content & IP)', status: 'draft' },
        { t: 180, channel: 'press', to: 'Holding statement (reactive only)', subject: '"We are aware of unauthorised footage and are taking action"', by: 'Corporate communications', status: 'approved' },
        { t: 190, channel: 'internal', to: 'All vendors on Crown of Ash', subject: 'Transfers via HexaCustody packages only, effective now', by: post, status: 'approved' },
      ],
      decisions: [
        { t: 5, decision: 'Treat as a major content security incident', by: p.ciso.name, rationale: 'Locked cut of a tentpole title, public exposure' },
        { t: 34, decision: 'Takedown first, attribution second', by: p.grcLead.name, rationale: 'Views rising about 2k every 10 minutes' },
        { t: 58, decision: 'Disable the vendor Aspera node key immediately', by: 'Custody policy (pre-approved)', rationale: 'Pre-approved playbook for active exfiltration' },
        { t: 160, decision: 'Move Crown of Ash screeners to per-viewer marks', by: p.grcLead.name, rationale: 'Faster attribution during awards season' },
        { t: 185, decision: 'Suspend Northlight access to all Starfall titles pending review', by: p.ciso.name, rationale: 'Vendor control failure; the agreement allows suspension' },
      ],
      participants: [
        { name: p.grcLead.name, role: 'Incident commander', org: 'Starfall', joinedMin: 5, on: true },
        { name: p.ciso.name, role: 'CISO', org: 'Starfall', joinedMin: 7, on: true },
        { name: p.socLead.name, role: 'Cyber Defence Centre', org: 'Starfall', joinedMin: 5, on: true },
        { name: post, role: 'Head of Post & VFX', org: 'Starfall Post', joinedMin: 25, on: true },
        { name: awards, role: 'Awards & screeners', org: 'Starfall Studios', joinedMin: 60, on: true },
        { name: pres, role: 'Studio leadership', org: 'Starfall Studios', joinedMin: 110, on: false },
        { name: 'HexaShield DFIR (2)', role: 'Forensics', org: 'HexaShield', joinedMin: 30, on: true },
        { name: 'Legal (content & IP)', role: 'Legal', org: 'Starfall', joinedMin: 45, on: true },
      ],
      services: [
        { name: bs[0], status: 'degraded', recovery: 70, rto: '24 h', note: 'Crown of Ash editorial locked down; other titles running' },
        { name: bs[1], status: 'degraded', recovery: 60, rto: '72 h', note: 'Northlight shots moving to DNEG and in-house London' },
        { name: bs[2], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
        { name: bs[3], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
        { name: bs[4], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
        { name: bs[5], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
      ],
      ioc: ['WM-31877 (NexGuard session mark)', 'Vendor Aspera node key used from 185.243.x.x', 't.me/… (leak channel, 4 mirrors)'],
    };
  },
};

export function warroom(c: CustomerProfile): WarScenario {
  const own = OWN_WARROOMS[c.id];
  if (own) return own(c);
  const p = c.people;
  const x = forCustomer(EXTRA, c);
  const bs = c.vocab.businessServices;
  if (c.dataKey === 'maritime') {
    const pkl = p.staff.find((s) => s.name.startsWith('Aisha'))?.name ?? 'Aisha Rahman';
    return {
      id: 'MI-2026-031', title: 'Ransomware at Straits Gateway Terminal (Port Klang)', tenantId: 'pkl', severity: 'critical', phase: 'Containment → recovery', declaredMinAgo: 292,
      summary: 'LockBit 3.0 affiliate encrypted the Navis N4 TOS application tier and two gate OCR lane controllers. Quay cranes on manual, gate on paper process. OT controllers unaffected (passive monitoring only).',
      commander: p.ciso.name, bridge: 'Teams bridge "MI-2026-031 PKL" + Signal fallback',
      timeline: [
        { t: 0, title: 'Mass file rename on RTM-TOS replica and PKL-TOS-APP01', body: 'Defender XDR T1486 alert; HexaSOC auto-triage escalated to critical', kind: 'detect' },
        { t: 9, title: 'Major incident declared', body: `${p.ciso.name} declared MI-2026-031, bridge opened`, kind: 'decide' },
        { t: 17, title: 'IT/OT conduit at Level 3.5 closed', body: 'Firewall change by terminal IT, OT side left running; crane PLCs untouched', kind: 'contain' },
        { t: 34, title: 'Gate switched to manual paper process', body: 'Cargotec OCR lanes 1–6 isolated; truck queue 2.1 km', kind: 'contain' },
        { t: 52, title: 'Charterers notified of berth delays', body: 'Three services re-sequenced; Halcyon Aurora held at anchorage', kind: 'comms' },
        { t: 96, title: 'Ransom note recovered: LockBit 3.0 affiliate', body: 'HexaInt matched leak-site entry pattern; no data posted yet', kind: 'detect' },
        { t: 140, title: 'Clean restore point confirmed', body: 'Veeam immutable copy from 02:00 local verified clean', kind: 'recover' },
        { t: 205, title: 'TOS database restore started in isolated VLAN', body: 'Navis (Kaleris) engineers on bridge', kind: 'recover' },
        { t: 254, title: 'Hands-on-keyboard on PKL-ENG-WS03', body: 'HexaSOC isolated the IT NIC; OT side untouched pending approval', kind: 'detect' },
        { t: 270, title: 'Session revocation for Terminal IT Manager requested', body: 'High-risk action, 1 of 2 approvals', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'Restore Navis N4 TOS from immutable backup', owner: 'Navis (Kaleris) + terminal IT', dueMin: 480, status: 'in_progress', stream: 'Recovery' },
        { id: 'T2', title: 'Rebuild gate OCR lane controllers 1–6', owner: 'Cargotec Gate OCR', dueMin: 600, status: 'in_progress', stream: 'Recovery' },
        { id: 'T3', title: 'Forensic image of PKL-TOS-APP01 and PKL-ENG-WS03', owner: 'HexaShield DFIR', dueMin: 360, status: 'in_progress', stream: 'Investigation' },
        { id: 'T4', title: 'Confirm OT controllers unaffected (passive baseline)', owner: p.otLead?.name ?? 'OT lead', dueMin: 120, status: 'done', stream: 'Investigation' },
        { id: 'T5', title: 'Reset privileged credentials, Port Klang domain', owner: pkl, dueMin: 330, status: 'blocked', stream: 'Containment' },
        { id: 'T6', title: 'Port authority situation report #2', owner: 'PFSO Port Klang', dueMin: 300, status: 'todo', stream: 'Comms' },
        { id: 'T7', title: 'Charterer and shipper update (berth window)', owner: 'Commercial ops', dueMin: 360, status: 'todo', stream: 'Comms' },
        { id: 'T8', title: 'Insurer notification via broker', owner: p.staff[0]?.name ?? 'CFO', dueMin: 240, status: 'done', stream: 'Legal & insurance' },
      ],
      clocks: [
        { name: 'NIS2 early warning (24 h)', body: 'Not applicable: Port Klang is outside the EU. Group NIS2 entities not impacted', dueMin: null, startMin: 0, status: 'not_applicable' },
        { name: 'NACSA notification (Cyber Security Act 2024)', body: 'If NCII-designated (maritime transport): 6 h initial', dueMin: 360, startMin: 9, status: 'running' },
        { name: 'Port Klang Authority', body: 'Operational disruption to port services', dueMin: 120, startMin: 9, status: 'submitted', submittedMin: 61 },
        { name: 'Charterers & shippers', body: 'Contractual notice of berth/gate delay (24 h)', dueMin: 1440, startMin: 9, status: 'running' },
        { name: 'Flag state (vessels alongside)', body: 'Halcyon Aurora & Borealis: ISPS security incident report', dueMin: 1440, startMin: 34, status: 'running' },
        { name: 'PDPA Commissioner (Malaysia)', body: 'Only if personal data affected: 72 h', dueMin: 4320, startMin: 96, status: 'conditional' },
        { name: 'Insurer (Beazley via Marsh)', body: 'As soon as practicable; policy condition 48 h', dueMin: 2880, startMin: 9, status: 'submitted', submittedMin: 180 },
      ],
      comms: [
        { t: 12, channel: 'internal', to: 'Executive committee', subject: 'MI-2026-031 declared: Port Klang TOS encrypted', by: p.ciso.name, status: 'sent' },
        { t: 52, channel: 'customers', to: 'Charterers on PKL services (3)', subject: 'Berth window delay, gate on manual process', by: 'Commercial ops', status: 'sent' },
        { t: 61, channel: 'regulator', to: 'Port Klang Authority (LPK)', subject: 'Notification of operational disruption', by: 'PFSO Port Klang', status: 'sent' },
        { t: 180, channel: 'partners', to: 'Beazley via Marsh Marine & Energy', subject: 'Cyber policy notification of circumstance', by: p.staff[0]?.name ?? 'CFO', status: 'sent' },
        { t: 230, channel: 'regulator', to: 'NACSA', subject: 'Initial incident notification (CSA 2024)', by: p.grcLead.name, status: 'approved' },
        { t: 260, channel: 'press', to: 'Holding statement (on request only)', subject: '"Systems disruption at Port Klang, operations continuing manually"', by: 'Group communications', status: 'approved' },
        { t: 285, channel: 'internal', to: 'All Port Klang staff', subject: 'Do not power on terminals; use paper gate process', by: pkl, status: 'draft' },
      ],
      decisions: [
        { t: 17, decision: 'Close the Level 3.5 conduit; keep cranes running on local control', by: p.ciso.name, rationale: 'Contain IT spread without stopping quay operations' },
        { t: 34, decision: 'Gate to manual paper process', by: 'Terminal Director', rationale: 'OCR lanes depend on encrypted TOS tier' },
        { t: 96, decision: 'No engagement with the ransom actor', by: p.board.name, rationale: 'Clean immutable backups available; group policy' },
        { t: 140, decision: 'Restore from 02:00 immutable copy, accept 3 h data loss', by: p.ciso.name, rationale: 'Earlier copies verified clean by HexaShield DFIR' },
        { t: 270, decision: 'Request session revocation for Terminal IT Manager', by: p.socLead.name, rationale: 'Credential used on PKL-ENG-WS03 at 03:12' },
      ],
      participants: [
        { name: p.ciso.name, role: 'Incident commander', org: 'Halcyon', joinedMin: 9, on: true },
        { name: p.socLead.name, role: 'SOC lead', org: 'Halcyon', joinedMin: 9, on: true },
        { name: p.otLead?.name ?? '', role: 'OT safety', org: 'Halcyon', joinedMin: 14, on: true },
        { name: pkl, role: 'Terminal IT', org: 'Halcyon Port Klang', joinedMin: 11, on: false },
        { name: 'HexaShield DFIR (3)', role: 'Forensics & IR retainer', org: 'HexaShield', joinedMin: 22, on: true },
        { name: 'Navis (Kaleris) duty engineer', role: 'TOS recovery', org: 'Vendor', joinedMin: 160, on: true },
        { name: p.grcLead.name, role: 'Regulatory & notifications', org: 'Halcyon', joinedMin: 40, on: true },
        { name: 'Marsh Marine & Energy', role: 'Broker liaison', org: 'Broker', joinedMin: 190, on: false },
      ],
      services: [
        { name: bs[0], status: 'degraded', recovery: 55, rto: '12 h', note: 'Cranes on local control, berth plan by hand' },
        { name: bs[1], status: 'down', recovery: 20, rto: '8 h', note: 'Paper process at 30% throughput' },
        { name: bs[2], status: 'operational', recovery: 100, rto: '—', note: 'Not deployed at Port Klang' },
        { name: bs[3], status: 'degraded', recovery: 60, rto: '24 h', note: 'Manifests via Portbase fallback' },
        { name: bs[4], status: 'operational', recovery: 100, rto: '—', note: 'Fleet unaffected; 2 vessels held' },
        { name: bs[5], status: 'recovering', recovery: 75, rto: '48 h', note: 'SAP unaffected; TOS events queued' },
      ],
      ioc: ['185.220.101.47', 'svchost32.exe (sha256 9f2c…e1a4)', 'LockBit 3.0 note: Restore-My-Files.txt'],
    };
  }
  if (c.dataKey === 'healthcare') {
    const staff = (first: string, fb: string) => p.staff.find((s) => s.name.includes(first))?.name ?? fb;
    const cno = staff('Angela', 'Chief Nursing Officer');
    const epic = staff('Kevin', 'Epic Technical Lead');
    const rev = staff('Erin', 'Revenue Cycle Manager');
    return {
      id: 'MI-2026-022', title: 'Ransomware at the Community Hospitals: EDs on ambulance diversion', tenantId: 'community', severity: 'critical', phase: 'Containment → recovery', declaredMinAgo: 318,
      summary: 'A Rhysida affiliate encrypted file servers and the Citrix tier that serves Epic Hyperspace at Zanesville, Marion and Chillicothe, two days after a fraudulent help-desk MFA reset. Zanesville and Marion EDs are on ambulance diversion and all three sites run Epic downtime procedures (BCA PCs, paper orders). Epic core in Columbus and all medical devices unaffected (Claroty and HexaOT passive only).',
      commander: p.ciso.name, bridge: 'Teams bridge "MI-022 Code Grey" + hospital command centre (HICS)',
      timeline: [
        { t: 0, title: 'Mass encryption on COM-ZAN-FS01 and the Citrix StoreFront', body: 'CrowdStrike Falcon ransomware detection; HexaSOC auto-triage escalated to critical', kind: 'detect' },
        { t: 7, title: 'Major incident declared, Code Grey (IT downtime)', body: `${p.ciso.name} declared MI-2026-022; HICS command centre opened`, kind: 'decide' },
        { t: 15, title: 'Citrix access cut at the community sites', body: 'Hyperspace sessions dropped; Epic ODB in Columbus isolated from the community network', kind: 'contain' },
        { t: 22, title: 'Epic downtime procedures activated', body: 'BCA PCs printing MAR and census; paper orders and downtime forms on every unit', kind: 'contain' },
        { t: 31, title: 'Zanesville and Marion EDs on ambulance diversion', body: 'Regional EMS informed; stroke, STEMI and trauma routed to Columbus', kind: 'comms' },
        { t: 58, title: 'Initial access: help-desk MFA reset', body: 'Caller impersonated a Marion IT analyst two days earlier (Scattered Spider pattern)', kind: 'detect' },
        { t: 96, title: '41 GB exfiltrated to cloud storage before encryption', body: 'Share held scanned consent forms and lab requisitions: presumptive ePHI breach', kind: 'detect' },
        { t: 150, title: 'FBI and HHS HC3 briefed', body: 'IoCs shared via Health-ISAC', kind: 'comms' },
        { t: 210, title: 'Clean restore point confirmed', body: 'Cohesity immutable snapshot from 01:00 verified clean', kind: 'recover' },
        { t: 290, title: 'Containment of Marion ICU workstation requested', body: 'High-risk action with clinical sign-off, 0 of 2 approvals', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'Restore Citrix tier and file servers from Cohesity immutable copy', owner: `Infrastructure + ${epic}`, dueMin: 720, status: 'in_progress', stream: 'Recovery' },
        { id: 'T2', title: 'Lift ambulance diversion at Zanesville ED', owner: 'ED Medical Director, Zanesville', dueMin: 480, status: 'blocked', stream: 'Clinical' },
        { id: 'T3', title: 'Back-load paper orders and MAR into Epic after recovery', owner: cno, dueMin: 1440, status: 'todo', stream: 'Clinical' },
        { id: 'T4', title: 'Confirm medical devices unaffected (Claroty, HexaOT passive)', owner: p.otLead?.name ?? 'Biomed', dueMin: 120, status: 'done', stream: 'Investigation' },
        { id: 'T5', title: 'HIPAA breach risk assessment (4-factor, 45 CFR 164.402)', owner: p.grcLead.name, dueMin: 4320, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T6', title: 'Forensic images: COM-ZAN-FS01, MRH-CITRIX-SF03', owner: 'HexaShield DFIR', dueMin: 360, status: 'in_progress', stream: 'Investigation' },
        { id: 'T7', title: 'Re-verify all help-desk resets in 14 days; enforce FIDO2 for IT staff', owner: p.socLead.name, dueMin: 420, status: 'in_progress', stream: 'Containment' },
        { id: 'T8', title: 'Hold claims and notify Change Healthcare and payers', owner: rev, dueMin: 1440, status: 'todo', stream: 'Business' },
      ],
      clocks: [
        { name: 'CMS / Ohio Dept of Health: diversion', body: 'Diversion logged with regional EMS and ODH; emergency preparedness plan (42 CFR 482.15) activated', dueMin: 60, startMin: 31, status: 'submitted', submittedMin: 41 },
        { name: 'FBI / HHS HC3', body: 'Expected for ransomware; IoCs via Health-ISAC', dueMin: 1440, startMin: 7, status: 'submitted', submittedMin: 150 },
        { name: 'Insurer (Beazley via Gallagher)', body: 'Notice of circumstance as soon as practicable; policy condition 48 h', dueMin: 2880, startMin: 7, status: 'submitted', submittedMin: 120 },
        { name: 'HIPAA: individual notice (60 days)', body: '45 CFR 164.404: without unreasonable delay, no later than 60 days from discovery', dueMin: 86400, startMin: 96, status: 'running' },
        { name: 'HHS OCR breach report', body: '500+ individuals: notify the Secretary within 60 days of discovery via the OCR portal', dueMin: 86400, startMin: 96, status: 'conditional' },
        { name: 'Media notice (164.406)', body: 'More than 500 residents of a state: prominent media outlets within 60 days', dueMin: 86400, startMin: 96, status: 'conditional' },
        { name: 'Ohio Attorney General', body: 'R.C. 1349.19: residents within 45 days; HIPAA-compliant notice deemed compliant; AG courtesy notice', dueMin: 64800, startMin: 96, status: 'conditional' },
        { name: 'Joint Commission', body: 'Voluntary sentinel-event self-report only if patient harm; EM chapter plan in effect', dueMin: null, startMin: 7, status: 'not_applicable' },
      ],
      comms: [
        { t: 9, channel: 'internal', to: 'Executive team & Board chair', subject: 'MI-2026-022 declared: community hospitals on Epic downtime', by: p.ciso.name, status: 'sent' },
        { t: 31, channel: 'partners', to: 'Regional EMS & Central Ohio Trauma System', subject: 'Ambulance diversion: Zanesville and Marion EDs', by: 'House supervisor', status: 'sent' },
        { t: 40, channel: 'internal', to: 'All community hospital staff', subject: 'Downtime procedures in effect: BCA PCs, paper orders, no USB', by: cno, status: 'sent' },
        { t: 41, channel: 'regulator', to: 'Ohio Department of Health', subject: 'Diversion status and emergency operations plan activation', by: 'Emergency management', status: 'sent' },
        { t: 150, channel: 'law enforcement', to: 'FBI Cincinnati & HHS HC3', subject: 'Ransomware notification with IoCs', by: p.socLead.name, status: 'sent' },
        { t: 200, channel: 'press', to: 'Holding statement (reactive)', subject: '"Our community hospitals are using downtime procedures; patient care continues"', by: 'Marketing & communications', status: 'approved' },
        { t: 260, channel: 'customers', to: 'Patients with appointments (MyChart, SMS)', subject: 'Clinic appointments at community sites rescheduled', by: 'Patient access', status: 'draft' },
        { t: 300, channel: 'regulator', to: 'HHS OCR (breach portal)', subject: 'Breach report: pending 4-factor risk assessment', by: p.grcLead.name, status: 'draft' },
      ],
      decisions: [
        { t: 7, decision: 'Declare Code Grey; cut Citrix access at community sites', by: p.ciso.name, rationale: 'Stop spread; Epic core in Columbus unaffected' },
        { t: 31, decision: 'Ambulance diversion at Zanesville and Marion', by: 'Chief Medical Officer', rationale: 'No electronic orders, PACS or lab results at the bedside' },
        { t: 96, decision: 'Treat as presumptive ePHI breach; HIPAA 60-day clock from discovery', by: p.grcLead.name, rationale: 'Exfiltrated share held consent forms and lab requisitions' },
        { t: 140, decision: 'No engagement with the ransom actor', by: p.board.name, rationale: 'Immutable backups verified; OFAC risk; FBI guidance' },
        { t: 290, decision: 'Contain COM-MAR-WS114 with clinical sign-off', by: p.socLead.name, rationale: 'ICU nursing workstation; spare WOW in place' },
      ],
      participants: [
        { name: p.ciso.name, role: 'Incident commander', org: 'Mercy Ridge', joinedMin: 7, on: true },
        { name: p.socLead.name, role: 'Security operations', org: 'Mercy Ridge', joinedMin: 4, on: true },
        { name: p.grcLead.name, role: 'Privacy officer & notifications', org: 'Mercy Ridge', joinedMin: 30, on: true },
        { name: cno, role: 'Clinical operations (downtime)', org: 'Mercy Ridge', joinedMin: 18, on: true },
        { name: epic, role: 'Epic recovery', org: 'Mercy Ridge', joinedMin: 15, on: true },
        { name: p.otLead?.name ?? 'Biomed', role: 'Medical device safety', org: 'Mercy Ridge', joinedMin: 20, on: false },
        { name: 'HexaShield DFIR (3)', role: 'Forensics & IR retainer', org: 'HexaShield', joinedMin: 25, on: true },
        { name: 'Epic TS duty engineer', role: 'EHR recovery', org: 'Vendor', joinedMin: 90, on: true },
        { name: 'Gallagher Healthcare', role: 'Broker liaison', org: 'Broker', joinedMin: 130, on: false },
      ],
      services: [
        { name: bs[0], status: 'degraded', recovery: 40, rto: '8 h', note: 'Zanesville & Marion on diversion; walk-ins triaged on paper' },
        { name: bs[1], status: 'degraded', recovery: 65, rto: '24 h', note: 'Paper MAR from BCA print-outs; barcode scanning down' },
        { name: bs[2], status: 'degraded', recovery: 55, rto: '12 h', note: 'Community modalities store locally; urgent reads by phone' },
        { name: bs[3], status: 'recovering', recovery: 70, rto: '12 h', note: 'Results by fax and runner' },
        { name: bs[4], status: 'degraded', recovery: 50, rto: '24 h', note: 'Elective cases at community sites postponed' },
        { name: bs[5], status: 'down', recovery: 10, rto: '72 h', note: 'Claims held; clearinghouse notified' },
      ],
      ioc: ['update-msedge[.]top', 'Rhysida note: CriticalBreachDetected.pdf', 'AnyDesk on COM-ZAN-FS01 (T1219)'],
    };
  }
  if (c.dataKey === 'automotive') {
    const staff = (first: string, fb: string) => p.staff.find((s) => s.name.includes(first))?.name ?? fb;
    const vcs = staff('Yuki', 'Head of Vehicle Cybersecurity');
    const sqe = staff('Elena', 'Supplier Quality Engineer');
    const robo = staff('Andreas', 'Robotics Maintenance Lead');
    return {
      id: 'MI-2026-019', title: 'Ransomware halts assembly at Plant Ingolstadt', tenantId: 'ingolstadt', severity: 'critical', phase: 'Containment → recovery', declaredMinAgo: 236,
      summary: 'An Akira affiliate entered through a KUKA remote-service account and encrypted the MES application tier and 14 Level 3 engineering workstations at Ingolstadt. Body shop and assembly lines 1–3 are in a controlled stop (≈ 1,100 vehicles a day). PLCs and robots are unaffected but cannot receive build orders, so JIT/JIS call-offs to suppliers are suspended. Battery plant air-gapped and unaffected; no impact on vehicles or OTA.',
      commander: p.ciso.name, bridge: 'Teams bridge "MI-019 ING" + plant crisis room (Halle B)',
      timeline: [
        { t: 0, title: 'Mass encryption on ING-MES-PRD01', body: 'Defender XDR ransomware alert; Armis saw SMB writes from ING-PLC-ENG04', kind: 'detect' },
        { t: 6, title: 'Major incident declared', body: `${p.ciso.name} declared MI-2026-019; plant crisis team convened`, kind: 'decide' },
        { t: 14, title: 'Controlled stop of lines 1–3', body: 'Body shop and assembly halted; paint shop finishing bodies in process', kind: 'contain' },
        { t: 21, title: 'Level 3.5 conduits closed at all plants', body: 'Győr and Puebla isolated from Ingolstadt; ZPA plant apps suspended', kind: 'contain' },
        { t: 40, title: 'JIT/JIS call-offs suspended', body: 'DHL and 37 sequenced suppliers notified; trucks held at the consolidation centre', kind: 'comms' },
        { t: 72, title: 'Entry point: KUKA remote-service account', body: 'BeyondTrust session outside window; credential in a supplier stealer log', kind: 'detect' },
        { t: 110, title: 'Clean MES restore point confirmed', body: 'Rubrik snapshot from 03:00 verified; PLC golden projects intact', kind: 'recover' },
        { t: 150, title: 'NIS2 early warning sent to BSI', body: 'Via the BSI reporting portal', kind: 'comms' },
        { t: 185, title: 'MES restore started in an isolated clean room', body: 'Siemens DI engineers on the bridge', kind: 'recover' },
        { t: 220, title: 'Termination of KUKA session requested', body: 'High-risk action, 1 of 2 approvals', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'Restore MES (Opcenter) from Rubrik in a clean room', owner: 'Plant IT + Siemens DI', dueMin: 600, status: 'in_progress', stream: 'Recovery' },
        { id: 'T2', title: 'Re-image 14 Level 3 engineering workstations', owner: 'Plant IT Ingolstadt', dueMin: 720, status: 'in_progress', stream: 'Recovery' },
        { id: 'T3', title: 'Verify PLC and robot programs against golden projects', owner: robo, dueMin: 360, status: 'in_progress', stream: 'Investigation' },
        { id: 'T4', title: 'Confirm no impact on OTA signing and vehicle backend (R155/R156)', owner: vcs, dueMin: 240, status: 'done', stream: 'Investigation' },
        { id: 'T5', title: 'Re-plan JIS sequence with DHL, seats and cockpit suppliers', owner: sqe, dueMin: 480, status: 'in_progress', stream: 'Supply chain' },
        { id: 'T6', title: 'NIS2 incident notification (72 h) to BSI', owner: p.grcLead.name, dueMin: 4320, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T7', title: 'Rotate all vendor remote-access credentials (BeyondTrust)', owner: p.socLead.name, dueMin: 300, status: 'blocked', stream: 'Containment' },
        { id: 'T8', title: 'Dealer comms: new delivery dates for ~5,400 orders', owner: 'Head of Sales Germany', dueMin: 1440, status: 'todo', stream: 'Comms' },
      ],
      clocks: [
        { name: 'JIS suppliers & DHL (contractual)', body: 'Call-off suspension notice under the logistics agreement: 2 h', dueMin: 120, startMin: 14, status: 'submitted', submittedMin: 40 },
        { name: 'NIS2 early warning to BSI (24 h)', body: 'BSIG (NIS2UmsuCG): early warning within 24 h of awareness', dueMin: 1440, startMin: 6, status: 'submitted', submittedMin: 150 },
        { name: 'NIS2 incident notification (72 h)', body: 'Severity, impact and IoCs to BSI within 72 h', dueMin: 4320, startMin: 6, status: 'running' },
        { name: 'NIS2 final report (1 month)', body: 'Root cause, mitigations and cross-border impact', dueMin: 43200, startMin: 6, status: 'running' },
        { name: 'Insurer (Allianz via Aon)', body: 'Notice of circumstance within 48 h', dueMin: 2880, startMin: 6, status: 'submitted', submittedMin: 130 },
        { name: 'GDPR (BayLDA, 72 h)', body: 'Only if employee or customer personal data is confirmed exfiltrated', dueMin: 4320, startMin: 72, status: 'conditional' },
        { name: 'KBA (UNECE R155 type approval)', body: 'Only if vehicle types or the OTA backend are affected; otherwise courtesy notice and CSMS monitoring report', dueMin: null, startMin: 6, status: 'conditional' },
        { name: 'Ad hoc disclosure (MAR Art. 17)', body: 'If production loss is price-sensitive: publish without delay', dueMin: null, startMin: 14, status: 'conditional' },
      ],
      comms: [
        { t: 8, channel: 'internal', to: 'Management Board', subject: 'MI-2026-019 declared: Ingolstadt lines 1–3 stopped', by: p.ciso.name, status: 'sent' },
        { t: 40, channel: 'partners', to: 'DHL Supply Chain & 37 JIS suppliers', subject: 'Call-off suspension, Ingolstadt lines 1–3', by: sqe, status: 'sent' },
        { t: 60, channel: 'internal', to: 'Ingolstadt plant staff (works council informed)', subject: 'Shift 2 on paid standby; do not connect laptops to plant network', by: 'Plant Director Ingolstadt', status: 'sent' },
        { t: 150, channel: 'regulator', to: 'BSI (NIS2 early warning)', subject: 'Significant incident: manufacturing of motor vehicles', by: p.grcLead.name, status: 'sent' },
        { t: 190, channel: 'regulator', to: 'KBA (type-approval authority)', subject: 'Courtesy notice: no vehicle or OTA impact', by: vcs, status: 'draft' },
        { t: 205, channel: 'customers', to: 'Dealers (Germany, Austria)', subject: 'Delivery date changes for affected orders', by: 'Head of Sales Germany', status: 'approved' },
        { t: 230, channel: 'press', to: 'Holding statement (reactive)', subject: '"A cyber incident has temporarily interrupted production at our Ingolstadt plant"', by: 'Group communications', status: 'approved' },
        { t: 235, channel: 'law enforcement', to: 'LKA Bayern (ZAC cybercrime)', subject: 'Criminal complaint with IoCs', by: 'Legal', status: 'draft' },
      ],
      decisions: [
        { t: 14, decision: 'Controlled stop of lines 1–3', by: 'Plant Director Ingolstadt', rationale: 'No build sequence from MES; wrong-build and JIS mismatch risk' },
        { t: 21, decision: 'Close Level 3.5 conduits at all plants', by: p.ciso.name, rationale: 'Contain spread to Győr and Puebla; battery plant already air-gapped' },
        { t: 72, decision: 'Suspend all vendor remote access group-wide', by: p.socLead.name, rationale: 'KUKA account used outside the maintenance window' },
        { t: 110, decision: 'Restore MES from 03:00 snapshot; rebuild L3 workstations', by: p.ciso.name, rationale: 'Fastest safe route; PLC golden projects verified' },
        { t: 140, decision: 'No engagement with the ransom actor', by: p.board.name, rationale: 'Backups verified; group policy; sanctions risk' },
      ],
      participants: [
        { name: p.ciso.name, role: 'Incident commander', org: 'Vireo', joinedMin: 6, on: true },
        { name: p.socLead.name, role: 'Cyber Defence Center', org: 'Vireo', joinedMin: 3, on: true },
        { name: p.otLead?.name ?? 'OT lead', role: 'OT security (plants)', org: 'Vireo', joinedMin: 10, on: true },
        { name: p.grcLead.name, role: 'NIS2 & regulator notifications', org: 'Vireo', joinedMin: 35, on: true },
        { name: vcs, role: 'Vehicle cybersecurity (CSMS)', org: 'Vireo', joinedMin: 50, on: true },
        { name: 'Plant Director Ingolstadt', role: 'Production', org: 'Vireo', joinedMin: 12, on: true },
        { name: 'HexaShield DFIR (4)', role: 'Forensics & IR retainer', org: 'HexaShield', joinedMin: 20, on: true },
        { name: 'Siemens DI recovery team', role: 'MES recovery', org: 'Vendor', joinedMin: 160, on: true },
        { name: 'Aon Automotive', role: 'Broker liaison', org: 'Broker', joinedMin: 140, on: false },
      ],
      services: [
        { name: bs[0], status: 'down', recovery: 15, rto: '36 h', note: 'Lines 1–3 stopped; ≈ 1,100 vehicles a day lost' },
        { name: bs[1], status: 'operational', recovery: 100, rto: '—', note: 'Air-gapped; not affected' },
        { name: bs[2], status: 'operational', recovery: 100, rto: '—', note: 'Signing service verified clean; releases frozen 24 h' },
        { name: bs[3], status: 'operational', recovery: 100, rto: '—', note: 'Vehicle backend normal (Upstream vSOC)' },
        { name: bs[4], status: 'degraded', recovery: 80, rto: '48 h', note: 'Delivery dates moving for ≈ 5,400 orders' },
        { name: bs[5], status: 'degraded', recovery: 45, rto: '24 h', note: 'JIS call-offs suspended; trucks held' },
      ],
      ioc: ['Akira note: akira_readme.txt', 'rclone.exe to 194.165.16[.]x (T1567.002)', 'kuka-svc-ing (BeyondTrust vendor account)'],
    };
  }
  if (c.dataKey === 'finserv') {
    return {
      id: 'MI-2026-007', title: 'Card authorisation latency at Aldersgate Payments', tenantId: 'pay', severity: 'critical', phase: 'Mitigation', declaredMinAgo: 141,
      summary: 'Card authorisation p99 latency rose from 180 ms to 4.2 s after a card-testing bot surge saturated the HSM gateway pool. Classified a major ICT-related incident under DORA by Aldersgate Europe S.A. (shared payments service) and reportable to the FCA/PRA and under PSD2.',
      commander: p.grcLead.name, bridge: 'Zoom bridge "MI-007" + Symphony war room',
      timeline: [
        { t: 0, title: 'Authorisation latency SLO breach', body: 'p99 4.2 s vs 400 ms objective; Splunk ITSI and Falcon telemetry', kind: 'detect' },
        { t: 8, title: 'Card-testing pattern identified', body: '1.9M low-value auths from 4,100 IPs; BIN ranges rotating', kind: 'detect' },
        { t: 23, title: 'Classified major ICT-related incident (DORA Art. 18)', body: 'Clients affected > 10%, duration > 1 h, critical service', kind: 'decide' },
        { t: 31, title: 'Bot mitigation rule at e-commerce gateway', body: 'Rate limits by BIN and device fingerprint', kind: 'contain' },
        { t: 55, title: 'HSM gateway pool scaled from 6 to 10', body: 'PAY-HSM-GW05–10 brought online', kind: 'recover' },
        { t: 78, title: 'Card schemes informed', body: 'Visa and Mastercard operational contacts', kind: 'comms' },
        { t: 102, title: 'Latency p99 back to 900 ms', body: 'Still above objective; stand-in processing on 8% of traffic', kind: 'recover' },
        { t: 118, title: 'IOC for bot C2 domain staged', body: 'CrowdStrike Add IOC awaiting approval', kind: 'decide' },
      ],
      tasks: [
        { id: 'T1', title: 'DORA initial notification to CSSF', owner: p.grcLead.name, dueMin: 263, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T2', title: 'FCA/PRA notification (SUP 15, PRA Fundamental Rule 7)', owner: 'Head of Regulatory Affairs', dueMin: 180, status: 'in_progress', stream: 'Regulatory' },
        { id: 'T3', title: 'PSD2 major operational incident report (FCA)', owner: p.grcLead.name, dueMin: 263, status: 'todo', stream: 'Regulatory' },
        { id: 'T4', title: 'Confirm no PAN or PIN exposure (PCI DSS)', owner: 'Payments CISO', dueMin: 300, status: 'in_progress', stream: 'Investigation' },
        { id: 'T5', title: 'Tune bot rules to restore legitimate e-commerce', owner: x.analysts[0], dueMin: 200, status: 'in_progress', stream: 'Mitigation' },
        { id: 'T6', title: 'Merchant comms for top 40 merchants', owner: 'Merchant services', dueMin: 240, status: 'todo', stream: 'Comms' },
        { id: 'T7', title: 'Impact tolerance assessment (Card acquiring IBS)', owner: 'Chief Operating Officer', dueMin: 240, status: 'blocked', stream: 'Op resilience' },
        { id: 'T8', title: 'Scale HSM pool and confirm capacity', owner: p.staff.find((s) => s.name.startsWith('Laura'))?.name ?? 'Payments Ops', dueMin: 90, status: 'done', stream: 'Mitigation' },
      ],
      clocks: [
        { name: 'DORA initial notification (4 h)', body: 'Within 4 h of classification, no later than 24 h of detection (CSSF)', dueMin: 23 + 240, startMin: 23, status: 'running' },
        { name: 'DORA intermediate report (72 h)', body: 'Within 72 h of the initial notification', dueMin: 23 + 240 + 4320, startMin: 23, status: 'running' },
        { name: 'DORA final report (1 month)', body: 'Within 1 month of the intermediate report', dueMin: 23 + 240 + 4320 + 43200, startMin: 23, status: 'running' },
        { name: 'FCA / PRA notification', body: 'Principle 11 / Fundamental Rule 7: without delay', dueMin: 180, startMin: 23, status: 'running' },
        { name: 'PSD2 major incident (PSRs 2017 reg. 99)', body: 'Initial report to the FCA within 4 h of classification', dueMin: 23 + 240, startMin: 23, status: 'running' },
        { name: 'Impact tolerance: Card acquiring', body: 'Maximum tolerable disruption 4 h (SYSC 15A)', dueMin: 240, startMin: 0, status: 'running' },
        { name: 'Card schemes', body: 'Visa / Mastercard operational notification', dueMin: 1440, startMin: 8, status: 'submitted', submittedMin: 78 },
      ],
      comms: [
        { t: 25, channel: 'internal', to: 'Group ExCo & Board Risk Committee chair', subject: 'MI-007 major incident: card authorisation latency', by: p.grcLead.name, status: 'sent' },
        { t: 78, channel: 'partners', to: 'Visa & Mastercard operations', subject: 'Degraded authorisation performance, acquirer BINs', by: 'Payments Ops', status: 'sent' },
        { t: 110, channel: 'customers', to: 'Top 40 merchants', subject: 'Intermittent card authorisation delays', by: 'Merchant services', status: 'approved' },
        { t: 120, channel: 'regulator', to: 'FCA supervisor & PRA', subject: 'Notification of operational incident (draft)', by: 'Head of Regulatory Affairs', status: 'draft' },
        { t: 128, channel: 'regulator', to: 'CSSF (DORA initial notification)', subject: 'Major ICT-related incident, initial notification', by: p.grcLead.name, status: 'draft' },
        { t: 132, channel: 'press', to: 'Press office holding line', subject: '"Some customers may see delays paying by card"', by: 'Group communications', status: 'approved' },
      ],
      decisions: [
        { t: 23, decision: 'Classify as major ICT-related incident (DORA Art. 18)', by: p.grcLead.name, rationale: 'Critical service, clients affected, duration > 1 h' },
        { t: 31, decision: 'Apply aggressive bot rules, accept some false declines', by: p.ciso.name, rationale: 'Protect authorisation capacity for genuine traffic' },
        { t: 55, decision: 'Activate stand-in processing for 8% of volume', by: 'Chief Operating Officer', rationale: 'Stay inside the 4 h impact tolerance' },
        { t: 118, decision: 'Stage IOC block for bot C2 domain', by: p.socLead.name, rationale: 'Domain seen in loader on 2 merchant-facing hosts' },
      ],
      participants: [
        { name: p.grcLead.name, role: 'Incident commander', org: 'Aldersgate', joinedMin: 20, on: true },
        { name: p.ciso.name, role: 'Group CISO', org: 'Aldersgate', joinedMin: 22, on: true },
        { name: p.socLead.name, role: 'Cyber defence', org: 'Aldersgate', joinedMin: 5, on: true },
        { name: 'Payments CISO', role: 'Payments security', org: 'Aldersgate Payments', joinedMin: 10, on: true },
        { name: 'Chief Operating Officer', role: 'Op resilience owner', org: 'Aldersgate', joinedMin: 40, on: false },
        { name: 'HexaShield MDR (2)', role: 'Detection & bot analysis', org: 'HexaShield', joinedMin: 12, on: true },
        { name: 'FIS duty manager', role: 'Card processing', org: 'Vendor', joinedMin: 60, on: true },
        { name: 'Head of Regulatory Affairs', role: 'Regulator liaison', org: 'Aldersgate', joinedMin: 30, on: true },
      ],
      services: [
        { name: bs[0], status: 'operational', recovery: 100, rto: '—', note: 'Faster Payments unaffected' },
        { name: bs[1], status: 'degraded', recovery: 70, rto: '4 h (tolerance)', note: 'p99 900 ms; 8% via stand-in' },
        { name: bs[2], status: 'degraded', recovery: 85, rto: '2 h', note: 'Card top-ups slow' },
        { name: bs[3], status: 'operational', recovery: 100, rto: '—', note: 'No dependency' },
        { name: bs[4], status: 'operational', recovery: 100, rto: '—', note: 'No dependency' },
        { name: bs[5], status: 'recovering', recovery: 90, rto: '6 h', note: 'Settlement files delayed 40 min' },
      ],
      ioc: ['cdn-authcheck[.]net', '4,100 IPs (residential proxy ASNs)', 'BIN ranges 4462 79xx, 5355 21xx'],
    };
  }
  return {
    id: 'MI-2026-014', title: 'Pre-release leak of Project Nightjar', tenantId: 'post', severity: 'critical', phase: 'Investigation & takedown', declaredMinAgo: 205,
    summary: 'A 94-second clip of the Nightjar locked cut (v14) appeared on a Telegram leak channel and a forum mirror. The forensic watermark traces to Soho edit bay 4; the custody agent then caught a copy of the locked cut to personal cloud storage from the same session.',
    commander: p.grcLead.name, bridge: 'Google Meet "Nightjar WR" (need-to-know)',
    timeline: [
      { t: 0, title: 'Clip found on Telegram leak channel', body: 'HexaInt leak monitoring, 11.2k views at detection', kind: 'detect' },
      { t: 6, title: 'War room declared', body: `${p.grcLead.name} as commander; need-to-know list applied`, kind: 'decide' },
      { t: 21, title: 'Forensic watermark decoded', body: 'Session watermark WM-88213: Soho edit bay 4, freelance colourist', kind: 'detect' },
      { t: 38, title: 'Takedown notices issued', body: 'Telegram, forum host and 2 mirrors', kind: 'contain' },
      { t: 64, title: 'Studio partners briefed', body: 'Co-financier and distribution partner informed under NDA', kind: 'comms' },
      { t: 110, title: 'All Nightjar review links rotated', body: 'Watermark policy raised to per-viewer on screeners', kind: 'contain' },
      { t: 183, title: 'Custody agent: locked cut copied to personal cloud', body: 'Same session; access revoked in 41 s', kind: 'detect' },
      { t: 190, title: 'Supplier revocation for Red Fern staged', body: 'Related stills leak; high-risk action awaiting approval', kind: 'decide' },
    ],
    tasks: [
      { id: 'T1', title: 'Preserve and image edit bay 4 workstation', owner: 'HexaShield DFIR', dueMin: 300, status: 'in_progress', stream: 'Investigation' },
      { id: 'T2', title: 'Takedown: remaining mirrors (3)', owner: x.analysts[0], dueMin: 240, status: 'in_progress', stream: 'Containment' },
      { id: 'T3', title: 'Legal hold and interview, freelance colourist', owner: 'Legal (employment & IP)', dueMin: 480, status: 'todo', stream: 'Legal' },
      { id: 'T4', title: 'TPN incident disclosure', owner: p.grcLead.name, dueMin: 1440, status: 'todo', stream: 'Regulatory' },
      { id: 'T5', title: 'Referral to law enforcement (IP crime unit)', owner: 'Legal', dueMin: 720, status: 'in_progress', stream: 'Legal' },
      { id: 'T6', title: 'Assess personal data in leaked material (GDPR)', owner: 'DPO', dueMin: 600, status: 'in_progress', stream: 'Regulatory' },
      { id: 'T7', title: 'Rotate Nightjar screener and review links', owner: p.admin.name, dueMin: 120, status: 'done', stream: 'Containment' },
      { id: 'T8', title: 'Marketing plan: trailer #2 timing decision', owner: p.staff[0]?.name ?? 'Production', dueMin: 900, status: 'blocked', stream: 'Business' },
    ],
    clocks: [
      { name: 'Studio partners (contractual)', body: 'Co-financier & distributor: notify within 24 h', dueMin: 1440, startMin: 6, status: 'submitted', submittedMin: 64 },
      { name: 'TPN disclosure', body: 'Content security incident disclosure to TPN', dueMin: 4320, startMin: 6, status: 'running' },
      { name: 'Law enforcement referral', body: 'IP crime unit (UK) / FBI IC3 (US): internal target 12 h', dueMin: 720, startMin: 6, status: 'running' },
      { name: 'GDPR / UK GDPR (72 h)', body: 'Only if personal data is in the leaked material (cast & crew)', dueMin: 4320, startMin: 21, status: 'conditional' },
      { name: 'Insurer (Hiscox via WTW)', body: 'Policy condition: notify within 72 h', dueMin: 4320, startMin: 6, status: 'running' },
      { name: 'Takedown SLA (per URL)', body: 'Internal target: 2 h per new URL', dueMin: 240, startMin: 120, status: 'running' },
    ],
    comms: [
      { t: 8, channel: 'internal', to: 'Need-to-know list (9)', subject: 'Nightjar war room opened', by: p.grcLead.name, status: 'sent' },
      { t: 38, channel: 'partners', to: 'Telegram, forum host, mirrors', subject: 'Copyright takedown notices', by: x.analysts[0], status: 'sent' },
      { t: 64, channel: 'partners', to: 'Co-financier & distribution partner', subject: 'Confidential: pre-release leak, Nightjar', by: p.staff[0]?.name ?? 'Production', status: 'sent' },
      { t: 150, channel: 'law enforcement', to: 'IP crime unit (referral pack)', subject: 'Referral: unauthorised distribution of pre-release film', by: 'Legal', status: 'draft' },
      { t: 170, channel: 'press', to: 'Holding statement (reactive only)', subject: '"We are aware of unauthorised footage and are acting"', by: 'Corporate communications', status: 'approved' },
      { t: 195, channel: 'internal', to: 'Soho post staff', subject: 'Reminder: no personal cloud on the content network', by: p.staff.find((s) => s.name.startsWith('Oliver'))?.name ?? 'Head of Post', status: 'draft' },
    ],
    decisions: [
      { t: 6, decision: 'Treat as a major content security incident', by: p.ciso.name, rationale: 'Locked cut of a tentpole title, public exposure' },
      { t: 38, decision: 'Takedown first, attribution second', by: p.grcLead.name, rationale: 'View count rising 1k per 10 min' },
      { t: 110, decision: 'Move all Nightjar screeners to per-viewer watermarking', by: p.grcLead.name, rationale: 'Faster attribution if it recurs' },
      { t: 183, decision: 'Revoke the colourist session immediately (no approval wait)', by: 'Custody policy (pre-approved)', rationale: 'Pre-approved playbook for active exfiltration' },
    ],
    participants: [
      { name: p.grcLead.name, role: 'Incident commander', org: 'Kestrel', joinedMin: 6, on: true },
      { name: p.ciso.name, role: 'CISO', org: 'Kestrel', joinedMin: 8, on: true },
      { name: p.socLead.name, role: 'SecOps', org: 'Kestrel', joinedMin: 6, on: true },
      { name: p.staff.find((s) => s.name.startsWith('Oliver'))?.name ?? 'Head of Post', role: 'Head of Post, Soho', org: 'Kestrel Post', joinedMin: 25, on: true },
      { name: p.staff[0]?.name ?? 'Production', role: 'Production', org: 'Kestrel Studios', joinedMin: 40, on: false },
      { name: 'HexaShield DFIR (2)', role: 'Forensics', org: 'HexaShield', joinedMin: 30, on: true },
      { name: 'Legal (IP & employment)', role: 'Legal', org: 'Kestrel', joinedMin: 45, on: true },
      { name: 'DPO', role: 'Privacy', org: 'Kestrel', joinedMin: 90, on: false },
    ],
    services: [
      { name: bs[0], status: 'degraded', recovery: 60, rto: '24 h', note: 'Nightjar editorial paused; other titles running' },
      { name: bs[1], status: 'degraded', recovery: 70, rto: '24 h', note: 'Edit bay 4 quarantined' },
      { name: bs[2], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
      { name: bs[3], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
      { name: bs[4], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
      { name: bs[5], status: 'operational', recovery: 100, rto: '—', note: 'Not affected' },
    ],
    ioc: ['WM-88213 (session watermark)', 't.me/… (leak channel, 3 mirrors)', 'personal Dropbox account (hashed)'],
  };
}

/* =====================================================================
   Tool Scorecard
   ===================================================================== */
const CAT_TAGS: Partial<Record<ConnectorCategory, string[]>> = {
  SIEM: ['log analytics', 'detection rules', 'case management', 'threat intel'],
  'EDR / XDR': ['endpoint detection', 'response', 'vuln assessment', 'threat intel'],
  Identity: ['identity', 'risk-based access', 'sessions'],
  PAM: ['privileged access', 'sessions', 'credential vault'],
  'Cloud posture': ['cloud posture', 'vuln assessment', 'inventory', 'attack paths'],
  Vulnerability: ['vuln assessment', 'inventory'],
  Network: ['network control', 'threat intel'],
  SASE: ['network control', 'web filtering', 'dlp', 'private access'],
  Email: ['email security', 'threat intel'],
  ITSM: ['case management', 'inventory'],
  Backup: ['backup', 'anomaly detection'],
  DLP: ['dlp', 'web filtering', 'genai usage'],
  AppSec: ['app vulns', 'vuln assessment'],
  OT: ['ot visibility', 'inventory', 'vuln assessment'],
  'Asset / CMDB': ['inventory'],
  Ratings: ['third-party risk'],
};
const CAT_COST: Partial<Record<ConnectorCategory, number>> = {
  SIEM: 620, 'EDR / XDR': 290, Identity: 180, PAM: 210, 'Cloud posture': 165, Vulnerability: 140, Network: 130, SASE: 260,
  Email: 115, ITSM: 240, Backup: 130, DLP: 150, AppSec: 170, OT: 220, 'Asset / CMDB': 60, Ratings: 70,
};
const CAT_COV: Partial<Record<ConnectorCategory, number>> = {
  SIEM: 72, 'EDR / XDR': 66, Identity: 34, PAM: 28, 'Cloud posture': 30, Vulnerability: 18, Network: 30, SASE: 38,
  Email: 22, ITSM: 8, Backup: 12, DLP: 26, AppSec: 14, OT: 46, 'Asset / CMDB': 6, Ratings: 5,
};

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export const GRADE_COLOR: Record<Grade, string> = { A: 'var(--good)', B: '#68b1ff', C: 'var(--sev-medium)', D: 'var(--sev-high)', F: 'var(--bad)' };
export type Reco = 'Renew' | 'Tune' | 'Consolidate' | 'Replace';
export const RECO_COLOR: Record<Reco, string> = { Renew: 'var(--good)', Tune: 'var(--sev-medium)', Consolidate: 'var(--m-core)', Replace: 'var(--bad)' };

export interface ToolScore {
  k: Connector;
  coverage: number;
  efficacy: number;
  validations: number;
  passed: number;
  snr: number;
  dataQuality: number;
  cost: number;
  composite: number;
  grade: Grade;
  valueIdx: number;
  renewalDays: number;
  reco: Reco;
  recoWhy: string;
  tags: string[];
}

export function gradeOf(n: number): Grade {
  return n >= 85 ? 'A' : n >= 75 ? 'B' : n >= 65 ? 'C' : n >= 55 ? 'D' : 'F';
}

export function ownTools(c: CustomerProfile, tenantId: string): Connector[] {
  return scopedConnectors(c, tenantId).filter((k) => k.vendor !== 'HexaShield' && k.vendor !== 'Generic');
}

export function overlapPct(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const inter = a.filter((t) => b.includes(t)).length;
  return Math.round((inter / Math.min(a.length, b.length)) * 100);
}

export function toolScores(c: CustomerProfile, tenantId: string, days: number): ToolScore[] {
  const tools = ownTools(c, tenantId);
  const sizeF = Math.pow(c.employees / 7400, 0.55) * (c.currency === 'USD' ? 1 : fxFromUsd(c.currency));
  const out = tools.map((k) => {
    const r = rng(`ops-score-${c.id}-${k.id}`);
    const rr = rng(`ops-score-${c.id}-${k.id}-${tenantId}-${days}`);
    const coverage = Math.min(95, Math.round((CAT_COV[k.category] ?? 15) + r.int(-6, 10)));
    const validations = Math.max(1, Math.round(r.int(6, 40) * Math.max(0.2, days / 30)) + rr.int(0, 2));
    const passRate = r.float(0.55, 0.96, 2) - (k.status !== 'healthy' ? 0.12 : 0);
    const passed = Math.round(validations * passRate);
    const efficacy = Math.round((passed / validations) * 100);
    const snr = Math.round(r.int(48, 93) - (k.category === 'SIEM' || k.category === 'Network' ? 8 : 0));
    const stalePenalty = k.lastSyncMin > k.intervalMin * 2 ? 18 : 0;
    const dataQuality = Math.max(30, 98 - k.drift * 7 - stalePenalty - (k.status === 'degraded' ? 10 : k.status === 'paused' ? 25 : k.status === 'failing' ? 35 : 0) - r.int(0, 5));
    const cost = Math.round((CAT_COST[k.category] ?? 100) * sizeF * r.float(0.8, 1.25, 2)) * 1000;
    const composite = Math.round(coverage * 0.25 + efficacy * 0.3 + snr * 0.2 + dataQuality * 0.25);
    return { k, coverage, efficacy, validations, passed, snr, dataQuality, cost, composite, grade: gradeOf(composite), valueIdx: 0, renewalDays: r.int(20, 400), reco: 'Renew' as Reco, recoWhy: '', tags: CAT_TAGS[k.category] ?? [] };
  });
  const vpc = out.map((t) => t.composite / (t.cost / 100000));
  const maxV = Math.max(...vpc, 1);
  out.forEach((t, i) => {
    t.valueIdx = Math.round((vpc[i] / maxV) * 100);
    const twin = out.find((o) => o !== t && overlapPct(o.tags, t.tags) >= 75 && o.composite > t.composite);
    if (t.composite < 58) {
      t.reco = 'Replace';
      t.recoWhy = `Grade ${t.grade}; efficacy ${t.efficacy}% in validations`;
    } else if (twin && t.valueIdx < 60) {
      t.reco = 'Consolidate';
      t.recoWhy = `${overlapPct(twin.tags, t.tags)}% capability overlap with ${twin.k.product}, which scores higher`;
    } else if (t.snr < 62 || t.dataQuality < 75) {
      t.reco = 'Tune';
      t.recoWhy = t.dataQuality < 75 ? `Data quality ${t.dataQuality}: ${t.k.note ?? 'drift or stale sync'}` : `Signal-to-noise ${t.snr}%: noisy rules inflate triage load`;
    } else {
      t.reco = 'Renew';
      t.recoWhy = `Strong value: ${t.composite} composite at ${Math.round(t.cost / 1000)}k a year`;
    }
  });
  return out;
}

/* =====================================================================
   Peer benchmark (anonymised, opt-in)
   ===================================================================== */
const PEERS: CustomerMap<{ n: number; label: string; median: number; q1: number; q3: number; p90: number }> = {
  maritime: { n: 23, label: 'ports, terminals & shipping lines', median: 69, q1: 61, q3: 77, p90: 83 },
  finserv: { n: 41, label: 'banks, payments & wealth firms', median: 77, q1: 71, q3: 83, p90: 88 },
  media: { n: 17, label: 'studios, post houses & streamers', median: 66, q1: 58, q3: 74, p90: 81 },
  healthcare: { n: 29, label: 'health systems & hospital groups', median: 67, q1: 59, q3: 75, p90: 82 },
  automotive: { n: 19, label: 'vehicle OEMs & tier-1 suppliers', median: 72, q1: 65, q3: 80, p90: 86 },
  insurance: { n: 33, label: 'P&C, specialty & life insurers', median: 74, q1: 67, q3: 81, p90: 86 },
  defence: { n: 26, label: 'defence primes & sub-tier suppliers', median: 68, q1: 59, q3: 76, p90: 83 },
  pharma: { n: 21, label: 'research-based pharma & biotech', median: 73, q1: 66, q3: 80, p90: 86 },
  sghospital: { n: 14, label: 'APAC private hospital groups', median: 65, q1: 57, q3: 73, p90: 80 },
  studio: { n: 12, label: 'major studios, streamers & resort operators', median: 70, q1: 62, q3: 77, p90: 84 },
};
/** Peer distributions per metric: [median, q1 (worse quartile), q3 (better quartile)]. */
const BENCH: CustomerMap<{ mfa: number; patch: number; mttr: number[]; mttd: number[]; patchP: number[]; mfaP: number[]; loop: number[]; attack: number[] }> = {
  maritime: { mfa: 91, patch: 17, mttr: [74, 110, 45], mttd: [14, 26, 8], patchP: [24, 35, 15], mfaP: [86, 78, 93], loop: [49, 38, 61], attack: [58, 47, 69] },
  finserv: { mfa: 99, patch: 9, mttr: [52, 78, 34], mttd: [8, 15, 5], patchP: [13, 19, 8], mfaP: [97, 94, 99], loop: [58, 49, 68], attack: [71, 63, 80] },
  media: { mfa: 94, patch: 21, mttr: [81, 120, 50], mttd: [16, 30, 9], patchP: [26, 38, 17], mfaP: [89, 82, 95], loop: [44, 33, 57], attack: [52, 43, 63] },
  healthcare: { mfa: 88, patch: 22, mttr: [70, 105, 46], mttd: [13, 24, 8], patchP: [31, 45, 20], mfaP: [84, 76, 92], loop: [45, 35, 56], attack: [55, 45, 66] },
  automotive: { mfa: 95, patch: 15, mttr: [58, 85, 38], mttd: [10, 18, 6], patchP: [18, 27, 11], mfaP: [93, 88, 97], loop: [52, 42, 63], attack: [64, 54, 74] },
  insurance: { mfa: 99, patch: 11, mttr: [55, 82, 36], mttd: [9, 16, 5], patchP: [15, 22, 9], mfaP: [96, 92, 99], loop: [55, 45, 65], attack: [67, 58, 76] },
  defence: { mfa: 100, patch: 14, mttr: [66, 98, 42], mttd: [12, 22, 7], patchP: [21, 32, 13], mfaP: [97, 93, 100], loop: [47, 37, 58], attack: [57, 47, 68] },
  pharma: { mfa: 98, patch: 13, mttr: [57, 84, 37], mttd: [9, 17, 6], patchP: [19, 28, 12], mfaP: [95, 90, 98], loop: [53, 43, 64], attack: [65, 56, 75] },
  sghospital: { mfa: 96, patch: 19, mttr: [72, 108, 47], mttd: [13, 24, 8], patchP: [27, 40, 17], mfaP: [90, 83, 96], loop: [43, 33, 54], attack: [54, 44, 65] },
  studio: { mfa: 95, patch: 16, mttr: [62, 92, 40], mttd: [11, 20, 6], patchP: [22, 33, 14], mfaP: [91, 85, 96], loop: [49, 39, 60], attack: [61, 52, 71] },
};
/** How much custody counts in each sector's peer group (radar median offset for the custody axis). */
const CUSTODY_PEER_BIAS: CustomerMap<number> = { maritime: -10, finserv: -10, media: 0, healthcare: -10, automotive: -10, insurance: -8, defence: -2, pharma: 0, sghospital: -10, studio: 0 };
export function peerInfo(c: CustomerProfile) {
  return forCustomer(PEERS, c);
}

export function percentileOf(you: number, median: number, q3: number): number {
  const spread = Math.max(1, Math.abs(q3 - median));
  // q3 sits on the "better" side of the median, so the sign of (q3 - median) encodes direction.
  const z = (you - median) / (q3 >= median ? spread : -spread);
  return Math.max(2, Math.min(98, Math.round(50 + z * 25)));
}

export interface BenchMetric {
  key: string;
  label: string;
  unit: string;
  you: number;
  median: number;
  q1: number;
  q3: number;
  higherBetter: boolean;
  pct: number;
}

export function benchmark(c: CustomerProfile, tenantId: string, days: number) {
  const pi = forCustomer(PEERS, c);
  const ri = resilienceIndex(c, tenantId).value;
  const h = headlines(c, tenantId);
  const ls = loopSummary(loops(c, tenantId));
  const r = rng(`ops-bench-${c.id}-${tenantId}-${days}`);
  const j = (n: number, f = 0.06) => Math.round(n * (1 + (r() - 0.5) * f) * 10) / 10;
  const b = forCustomer(BENCH, c);
  const q = (v: number[]) => ({ median: v[0], q1: v[1], q3: v[2] });
  const raw: Omit<BenchMetric, 'pct'>[] = [
    { key: 'ri', label: 'Resilience Index', unit: '', you: ri, median: pi.median, q1: pi.q1, q3: pi.q3, higherBetter: true },
    { key: 'mttr', label: 'Mean time to contain', unit: 'min', you: j(h.soc.mttrMin), ...q(b.mttr), higherBetter: false },
    { key: 'mttd', label: 'Mean time to detect', unit: 'min', you: j(h.soc.mttdMin), ...q(b.mttd), higherBetter: false },
    { key: 'patch', label: 'Critical patch latency', unit: 'days', you: j(b.patch), ...q(b.patchP), higherBetter: false },
    { key: 'mfa', label: 'MFA coverage (workforce)', unit: '%', you: Math.min(100, j(b.mfa, 0.02)), ...q(b.mfaP), higherBetter: true },
    { key: 'loop', label: 'Loop assurance', unit: '%', you: ls.assuredPct, ...q(b.loop), higherBetter: true },
    { key: 'attack', label: 'ATT&CK coverage (priority)', unit: '%', you: h.soc.attackCoveragePct, ...q(b.attack), higherBetter: true },
  ];
  const metrics: BenchMetric[] = raw.map((m) => ({ ...m, pct: percentileOf(m.you, m.median, m.q3) }));
  const caps: { id: CapabilityId; label: string }[] = [
    { id: 'soc', label: 'Detection & response' }, { id: 'int', label: 'Intelligence' }, { id: 'strike', label: 'Validated defence' },
    { id: 'ot', label: 'OT security' }, { id: 'comply', label: 'Control assurance' }, { id: 'custody', label: 'Custody' },
  ];
  const t0 = scopedTenants(c, tenantId)[0];
  const radar = caps.map((cp) => {
    const you = tenantId === 'all' || !t0 ? c.scores[cp.id] : Math.round(c.scores[cp.id] * 0.6 + t0.ri * 0.4);
    const rr = rng(`ops-bench-cap-${c.id}-${cp.id}`);
    const median = Math.round(pi.median + rr.int(-8, 6) + (cp.id === 'custody' ? forCustomer(CUSTODY_PEER_BIAS, c) : 0));
    return { ...cp, you, median, top: Math.min(98, median + rr.int(9, 15)) };
  });
  const tr = rng(`ops-bench-trend-${c.id}`);
  const medianTrend = Array.from({ length: 12 }, (_, i) => Math.round(pi.median - 4 + (i * 4) / 11 + (tr() - 0.5) * 1.5));
  return { peers: pi, ri, metrics, radar, medianTrend, q3Trend: medianTrend.map((v) => v + (pi.q3 - pi.median)) };
}

/* =====================================================================
   Trust Centre
   ===================================================================== */
export interface ShareLink {
  id: string;
  recipient: string;
  kind: 'partner' | 'regulator' | 'insurer' | 'customer';
  scope: string[];
  expiresDays: number;
  createdDaysAgo: number;
  views: number;
  lastViewMin: number | null;
  status: 'active' | 'expired' | 'revoked';
  viewLog: { who: string; minAgo: number; from: string }[];
}

export function trustTier(ri: number): { tier: string; color: string } {
  if (ri >= 85) return { tier: 'Gold', color: '#ecc873' };
  if (ri >= 75) return { tier: 'Silver', color: '#b7c2db' };
  return { tier: 'Bronze', color: '#d08b5b' };
}

export function shareLinks(c: CustomerProfile, tenantId: string): ShareLink[] {
  const r = rng(`ops-share-${c.id}-${tenantId}`);
  const seeds: CustomerMap<[string, ShareLink['kind'], string[]][]> = {
    maritime: [
      ['Northwind Container Line (charterer)', 'customer', ['RI', 'ISO 27001', 'IACS E26/27']],
      ['Beazley via Marsh Marine & Energy', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['Port of Rotterdam Authority', 'regulator', ['NIS2', 'ISPS', 'RI']],
      ['Bureau Veritas Marine (class)', 'partner', ['IACS E26/27', 'IEC 62443']],
      ['Meridian Reefer Logistics (shipper)', 'customer', ['RI', 'ISO 27001']],
    ],
    finserv: [
      ['AIG via Aon Financial Services', 'insurer', ['RI', 'Attestations', 'Pen test date', 'SOC 2']],
      ['Bank of England / PRA supervisory team', 'regulator', ['FCA Op Res', 'DORA', 'RI']],
      ['CSSF (Aldersgate Europe)', 'regulator', ['DORA', 'NIS2']],
      ['Harbour Retail Group (corporate client)', 'customer', ['RI', 'ISO 27001', 'PCI DSS']],
      ['Fintech partner: LedgerLane', 'partner', ['RI', 'SOC 2', 'Pen test date']],
    ],
    media: [
      ['Co-financier: Bluewater Media Partners', 'partner', ['RI', 'TPN', 'MPA CSBP']],
      ['Distribution partner: Northlight Streaming', 'customer', ['RI', 'TPN', 'Pen test date']],
      ['Hiscox via WTW Media & Entertainment', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['TPN assessor portal', 'regulator', ['TPN']],
      ['Lumière VFX (vendor reciprocity)', 'partner', ['RI', 'TPN']],
    ],
    healthcare: [
      ['Beazley via Gallagher Healthcare', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['Buckeye Health Plan (payer contract)', 'customer', ['RI', 'HITRUST', 'HIPAA']],
      ['HHS OCR (compliance review)', 'regulator', ['HIPAA', 'HPH CPGs', 'RI']],
      ['Central Ohio Accountable Care Network', 'partner', ['RI', 'HITRUST']],
      ['Synapse Pathology Labs (BAA reciprocity)', 'partner', ['RI', 'HIPAA']],
    ],
    automotive: [
      ['Allianz via Aon Automotive', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['KBA (type-approval authority)', 'regulator', ['UNECE R155', 'UNECE R156', 'ISO/SAE 21434']],
      ['BSI (NIS2 supervision)', 'regulator', ['NIS2', 'RI']],
      ['Nordpool Mobility (fleet & leasing customer)', 'customer', ['RI', 'TISAX', 'ISO 27001']],
      ['Bosch Mobility (supplier reciprocity)', 'partner', ['RI', 'TISAX']],
    ],
    insurance: [
      ['Beazley via Marsh FINPRO', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['NYDFS (examination team)', 'regulator', ['NYDFS 500', 'RI']],
      ['Munich Re (treaty reinsurer)', 'partner', ['RI', 'NIST CSF 2.0', 'SOC 2']],
      ['Lakeshore Independent Agents Alliance', 'customer', ['RI', 'SOC 2']],
      ['EXL (BPO reciprocity)', 'partner', ['RI', 'SOC 2', 'PCI DSS']],
    ],
    defence: [
      ['RTX supply-chain cyber team', 'customer', ['RI', 'CMMC L2', 'NIST 800-171', 'SPRS score']],
      ['Lockheed Martin supplier assurance', 'customer', ['RI', 'CMMC L2', 'DFARS 7012']],
      ['Redstone Cyber Assessors (C3PAO)', 'regulator', ['CMMC L2', 'NIST 800-171']],
      ['Beazley via Marsh McLennan Agency', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['Cumberland Precision Machining (flow-down)', 'partner', ['RI', 'DFARS 7012']],
    ],
    pharma: [
      ['Swiss Re Corporate Solutions via Marsh', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['Swissmedic GMP inspectorate', 'regulator', ['EU GMP Annex 11', 'Part 11', 'RI']],
      ['IQVIA (CRO reciprocity)', 'partner', ['RI', 'ISO 27001', 'GxP']],
      ['Global health alliance partner (supply agreement)', 'customer', ['RI', 'ISO 27001', 'NIS2']],
      ['Lonza (CDMO tech transfer)', 'partner', ['RI', 'ISO 27001']],
    ],
    sghospital: [
      ['Chubb via Marsh Singapore', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['Ministry of Health (HIA compliance)', 'regulator', ['HIA CS/DS', 'RI']],
      ['Synapxe (NEHR onboarding)', 'partner', ['NEHR readiness', 'Cyber Trust']],
      ['Great Eastern Life (integrated shield plans)', 'customer', ['RI', 'PDPA', 'ISO 27001']],
      ['Lion City Pathology Laboratories', 'partner', ['RI', 'Cyber Essentials']],
    ],
    studio: [
      ['AIG via Marsh Media & Entertainment', 'insurer', ['RI', 'Attestations', 'Pen test date']],
      ['TPN assessor portal', 'regulator', ['TPN', 'MPA CSBP']],
      ['Co-financier: Meridian Film Partners', 'partner', ['RI', 'TPN']],
      ['Global distribution partner (SVOD licensee)', 'customer', ['RI', 'TPN', 'Pen test date']],
      ['DNEG (vendor reciprocity)', 'partner', ['RI', 'TPN']],
    ],
  };
  const viewers = ['security@', 'risk@', 'procurement@', 'underwriting@', 'supervision@'];
  return forCustomer(seeds, c).map(([recipient, kind, scope], i) => {
    const status: ShareLink['status'] = i === 4 ? 'expired' : 'active';
    const views = status === 'expired' ? r.int(2, 6) : r.int(1, 28);
    const created = r.int(4, 120);
    return {
      id: `sh_${r.hex(8)}`, recipient, kind, scope,
      expiresDays: status === 'expired' ? -r.int(1, 20) : r.int(3, 90),
      createdDaysAgo: created, views,
      lastViewMin: views ? r.int(20, 9000) : null, status,
      viewLog: Array.from({ length: Math.min(views, 6) }, () => ({ who: `${r.pick(viewers)}${recipient.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}…`, minAgo: r.int(20, created * 1440), from: r.pick(['GB', 'NL', 'US', 'LU', 'SG', 'DE', 'FR']) })).sort((a, b) => a.minAgo - b.minAgo),
    };
  });
}

const LAST_PEN_TEST: CustomerMap<{ daysAgo: number; scope: string; by: string }> = {
  maritime: { daysAgo: 47, scope: 'External, terminal DMZ & vessel remote access', by: 'HexaStrike' },
  finserv: { daysAgo: 23, scope: 'Open-banking APIs, internet perimeter, CBEST-style red team (Q2)', by: 'HexaStrike' },
  media: { daysAgo: 61, scope: 'Screener & review portals, KestrelPlay API', by: 'HexaStrike' },
  healthcare: { daysAgo: 34, scope: 'Internet perimeter, MyChart & FHIR APIs, Citrix gateway', by: 'HexaStrike' },
  automotive: { daysAgo: 19, scope: 'Connected-vehicle & OTA APIs, dealer portal, plant DMZ (Level 3.5)', by: 'HexaStrike' },
  insurance: { daysAgo: 29, scope: 'AgentHub & policyholder portals, claims API, MFT, help-desk social engineering test', by: 'HexaStrike' },
  defence: { daysAgo: 41, scope: 'GCC High enclave (AiTM & token theft), VPN, Building 3 vendor access', by: 'HexaStrike' },
  pharma: { daysAgo: 26, scope: 'CRO partner portal, Rhenara Connect API, Valais Level 3.5 DMZ', by: 'HexaStrike' },
  sghospital: { daysAgo: 52, scope: 'Patient portal & FHIR API, Citrix gateway, vendor PAM paths', by: 'HexaStrike' },
  studio: { daysAgo: 17, scope: 'Screener & review portals, Starfall+ API, Aspera and park ticketing', by: 'HexaStrike' },
};
export function lastPenTest(c: CustomerProfile): { daysAgo: number; scope: string; by: string } {
  return forCustomer(LAST_PEN_TEST, c);
}

/** Workspace SSO defaults shown in Administration. */
const SSO_DEFAULTS: CustomerMap<{ phishingResistant: boolean; sessionH: number; keyRotatedDaysAgo: number; keyNextDays: number }> = {
  maritime: { phishingResistant: false, sessionH: 12, keyRotatedDaysAgo: 63, keyNextDays: 302 },
  finserv: { phishingResistant: true, sessionH: 8, keyRotatedDaysAgo: 41, keyNextDays: 324 },
  media: { phishingResistant: false, sessionH: 12, keyRotatedDaysAgo: 63, keyNextDays: 302 },
  healthcare: { phishingResistant: false, sessionH: 12, keyRotatedDaysAgo: 63, keyNextDays: 302 },
  automotive: { phishingResistant: true, sessionH: 12, keyRotatedDaysAgo: 63, keyNextDays: 302 },
  insurance: { phishingResistant: true, sessionH: 8, keyRotatedDaysAgo: 52, keyNextDays: 313 },
  defence: { phishingResistant: true, sessionH: 8, keyRotatedDaysAgo: 34, keyNextDays: 331 },
  pharma: { phishingResistant: true, sessionH: 10, keyRotatedDaysAgo: 77, keyNextDays: 288 },
  sghospital: { phishingResistant: false, sessionH: 12, keyRotatedDaysAgo: 0, keyNextDays: 0 },
  studio: { phishingResistant: false, sessionH: 10, keyRotatedDaysAgo: 46, keyNextDays: 319 },
};
export function ssoDefaults(c: CustomerProfile) {
  return forCustomer(SSO_DEFAULTS, c);
}

/* =====================================================================
   Service catalogue consumption
   ===================================================================== */
export function serviceUsage(c: CustomerProfile, tenantId: string, id: ServiceId): { used: number; allowance: number | null; unit: string } {
  const h = headlines(c, tenantId);
  const s = tenantShare(c, tenantId);
  const r = rng(`ops-svc-${c.id}-${tenantId}-${id}`);
  const map: Record<ServiceId, { used: number; allowance: number | null; unit: string }> = {
    mdr: { used: scale(h.soc.alerts24h * 75, 1), allowance: null, unit: 'alerts triaged' },
    hunting: { used: Math.max(1, scale(h.soc.huntsActive * 3, 1)), allowance: 12, unit: 'hunts' },
    ir: { used: scale(r.int(30, 90), s, 4), allowance: 160, unit: 'retainer hours' },
    forensics: { used: scale(r.int(4, 14), s, 1), allowance: 20, unit: 'images' },
    'detection-eng': { used: scale(r.int(20, 60), s, 2), allowance: null, unit: 'rules delivered' },
    'attack-coverage': { used: h.soc.attackCoveragePct, allowance: 100, unit: '% priority techniques' },
    darkweb: { used: h.int.darkWebMentions * 3, allowance: null, unit: 'mentions triaged' },
    osint: { used: 13, allowance: 13, unit: 'weekly briefs' },
    exposure: { used: h.int.exposedCredentials, allowance: null, unit: 'credentials matched' },
    pentest: { used: scale(r.int(12, 40), s, 2), allowance: 45, unit: 'test days' },
    redteam: { used: scale(r.int(5, 20), s, 1), allowance: 25, unit: 'engagement days' },
    purpleteam: { used: Math.max(1, scale(6, s)), allowance: 6, unit: 'sprints' },
    asm: { used: h.strike.externalAssets, allowance: null, unit: 'assets monitored' },
    'ot-visibility': { used: h.ot.otAssets, allowance: null, unit: 'OT assets' },
    'ot-vuln': { used: scale(r.int(20, 80), s, 2), allowance: null, unit: 'advisories matched' },
    'ot-pentest': { used: scale(r.int(3, 12), s, 1), allowance: 15, unit: 'test days' },
    caas: { used: Math.round(h.comply.evidenceItems / 4), allowance: null, unit: 'evidence items' },
    tprm: { used: scale(r.int(20, 60), s, 2), allowance: Math.round(h.comply.vendors / 2), unit: 'assessments' },
    'ai-gov': { used: h.ai.aiSystems, allowance: 25, unit: 'AI systems governed' },
    custody: { used: h.custody.assetsUnderCustody, allowance: null, unit: 'assets under custody' },
  };
  return map[id];
}

export const LICENCE_TIERS = [
  { tier: 'Essentials', items: ['Up to 5 integrations', 'Standard views and dashboards', 'Community connectors', 'Email support', 'HexaShield-hosted, multi-tenant'] },
  { tier: 'Professional', items: ['~20 integrations', 'HexaAI copilot (cited)', 'Two-way write-back with approvals', 'Closed-loop assurance', 'Priority support'] },
  { tier: 'Enterprise / CNI', items: ['Unlimited integrations', 'Multi-tenant hierarchy & BYOK', 'Customer-hosted or air-gapped data planes', 'SSO / SCIM, granular roles', 'Named customer success manager', 'Contractual SLAs & assurance pack'] },
] as const;

/* =====================================================================
   Administration
   ===================================================================== */
export interface AdminUser {
  name: string;
  email: string;
  role: HvRole;
  title: string;
  tenants: string;
  mfa: string;
  lastActiveMin: number;
  source: string;
}

export function idpFor(c: CustomerProfile): string {
  return c.connectors.some((k) => k.vendor === 'Okta') ? 'Okta Workforce Identity' : 'Microsoft Entra ID';
}

export function adminUsers(c: CustomerProfile, tenantId: string): AdminUser[] {
  const r = rng(`ops-users-${c.id}`);
  const x = forCustomer(EXTRA, c);
  const p = c.people;
  const dom = c.domain;
  const mk = (name: string, email: string, role: HvRole, title: string, tenants = 'All tenants'): AdminUser => ({
    name, email, role, title, tenants,
    mfa: role === 'Support (read-only)' ? 'HexaShield FIDO2 + approval' : r.pick(['FIDO2 security key', 'Passkey', 'Authenticator (number match)']),
    lastActiveMin: r.int(1, 4000), source: role === 'Support (read-only)' ? 'HexaShield staff IdP' : `SSO · ${idpFor(c)}`,
  });
  const email = (n: string) => `${n.toLowerCase().replace(/[^a-z ]/g, '').split(' ').join('.')}@${dom}`;
  const t = (i: number) => c.tenants[i % c.tenants.length].short;
  const users = [
    mk(p.ciso.name, p.ciso.email, 'Tenant Admin', p.ciso.role),
    mk(p.admin.name, p.admin.email, 'Tenant Admin', p.admin.role),
    mk(p.socLead.name, p.socLead.email, 'Approver', p.socLead.role),
    mk(x.approver, email(x.approver), 'Approver', 'Duty security manager'),
    ...x.analysts.map((a, i) => mk(a, email(a), 'Analyst', 'Security analyst', i === 2 ? t(3) : 'All tenants')),
    mk(p.grcLead.name, p.grcLead.email, 'GRC', p.grcLead.role),
    mk(x.auditor, email(x.auditor), 'Auditor', 'Internal audit', 'All tenants (read-only)'),
    mk(p.board.name, p.board.email, 'Board viewer', p.board.role),
    mk(p.staff[0].name, p.staff[0].email, 'Board viewer', p.staff[0].role),
    ...(p.otLead ? [mk(p.otLead.name, p.otLead.email, 'OT engineer', p.otLead.role, c.tenants.filter((tt) => tt.env.includes('ot')).map((tt) => tt.short).join(', '))] : []),
    mk(x.support, 'support@hexashield.io', 'Support (read-only)', 'HexaShield support engineer', 'Per approved session'),
  ];
  if (tenantId === 'all') return users;
  const tn = c.tenants.find((tt) => tt.id === tenantId)?.short ?? '';
  return users.filter((u) => u.tenants.startsWith('All') || u.tenants.includes(tn) || u.tenants.startsWith('Per'));
}
