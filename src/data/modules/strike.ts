// HexaStrike (Offensive Security) data: penetration testing, red teaming,
// purple teaming and attack surface management. Pure, seeded per customer.
import type { CustomerProfile, CustomerId, Severity } from '../types';
import { rng } from '../../lib/rng';
import { headlines } from '../core';
import { scopedTenants } from '../customers';
import { CVES } from '../reference';
import { daysAgo, fmtDateShort } from '../../lib/format';

export function edrName(c: CustomerProfile): string {
  const k = c.connectors.find((x) => x.category === 'EDR / XDR');
  return k ? `${k.vendor} ${k.product}` : 'EDR';
}
export function siemName(c: CustomerProfile): string {
  const k = c.connectors.find((x) => x.category === 'SIEM');
  return k ? `${k.vendor} ${k.product}` : 'SIEM';
}

/* =====================================================================
   Pentest findings & engagements
   ===================================================================== */
export type EngType = 'External infra' | 'Web app' | 'API' | 'Cloud config' | 'Mobile' | 'Internal';

export interface Engagement {
  id: string;
  type: EngType;
  name: string;
  tenantId: string;
  status: 'Scheduled' | 'In progress' | 'Reporting' | 'Closed';
  startedDays: number;
  findings: number;
  critical: number;
  scope: string;
}

export interface Finding {
  id: string;
  title: string;
  engType: EngType;
  target: string;
  sev: Severity;
  cvss: number;
  owasp: string;
  cwe: string;
  likelihood: number; // 1..5
  impact: number; // 1..5
  status: 'Open' | 'Fix in progress' | 'Retest' | 'Resolved' | 'Risk accepted';
  slaDays: number; // days remaining (negative = overdue)
  detection: boolean; // covered by a detection
  tenantId: string;
  summary: string;
  recommendation: string;
  firstFixPriority?: boolean;
}

const OWASP = ['A01 Broken Access Control', 'A02 Cryptographic Failures', 'A03 Injection', 'A04 Insecure Design', 'A05 Security Misconfiguration', 'A06 Vulnerable Components', 'A07 Auth Failures', 'A08 Data Integrity Failures'];
const CWE = ['CWE-639 Authorization Bypass (IDOR)', 'CWE-89 SQL Injection', 'CWE-79 XSS', 'CWE-287 Improper Authentication', 'CWE-16 Configuration', 'CWE-1104 Unmaintained Components', 'CWE-200 Information Exposure', 'CWE-352 CSRF'];

function flagship(c: CustomerProfile): Finding[] {
  // The named critical findings required per sector.
  const mk = (f: Partial<Finding> & { id: string; title: string; target: string; tenantId: string; summary: string; recommendation: string }): Finding => ({
    engType: 'API', sev: 'critical', cvss: 9.3, owasp: OWASP[0], cwe: CWE[0], likelihood: 4, impact: 5, status: 'Open', slaDays: 4, detection: false, firstFixPriority: true, ...f,
  });
  const map: Record<CustomerId, Finding[]> = {
    finserv: [
      mk({ id: 'PT-F-001', title: 'BOLA on the open-banking accounts API', engType: 'API', target: 'openbanking.aldersgate.co.uk', tenantId: 'ukbank', cvss: 9.3, owasp: OWASP[0], cwe: CWE[0], summary: 'Broken Object Level Authorization: account identifiers in the AISP accounts endpoint are not scoped to the authenticated consent, allowing cross-account data access.', recommendation: 'Enforce consent-to-account binding server-side; add object-level authorization checks and an abuse-detection rule.' }),
      mk({ id: 'PT-F-002', title: 'SQL injection in the lending pre-approval service', engType: 'Web app', target: 'business.aldersgate.co.uk', tenantId: 'ukbank', cvss: 8.6, owasp: OWASP[2], cwe: CWE[1], sev: 'high', slaDays: 9, likelihood: 3, impact: 5, firstFixPriority: true, summary: 'A parameter in the pre-approval flow is concatenated into a query.', recommendation: 'Parameterise queries; deploy a WAF virtual patch pending fix.' }),
    ],
    media: [
      mk({ id: 'PT-M-001', title: 'Review-link authentication bypass on the screeners portal', engType: 'Web app', target: 'screeners.kestrelpictures.com', tenantId: 'studios', cvss: 9.4, owasp: OWASP[6], cwe: CWE[3], summary: 'Signed review links can be replayed after expiry and are not bound to a viewer, exposing pre-release content.', recommendation: 'Bind links to authenticated viewers, enforce short expiry and single use, and watermark on access.' }),
      mk({ id: 'PT-M-002', title: 'IDOR on screener identifiers', engType: 'Web app', target: 'screeners.kestrelpictures.com', tenantId: 'studios', cvss: 8.8, owasp: OWASP[0], cwe: CWE[0], summary: 'Sequential screener IDs allow enumeration of other titles.', recommendation: 'Use unguessable identifiers and per-object authorization.' }),
      mk({ id: 'PT-M-003', title: 'Outdated Next.js with known middleware bypass', engType: 'Web app', target: 'review.kestrelpictures.com', tenantId: 'studios', cvss: 8.1, owasp: OWASP[5], cwe: CWE[5], summary: 'The review app runs a Next.js version vulnerable to a middleware authorization bypass.', recommendation: 'Upgrade Next.js and re-test authorization middleware.' }),
    ],
    maritime: [
      mk({ id: 'PT-H-001', title: 'Gate OCR / booking portal authorization flaw', engType: 'Web app', target: 'booking.halcyonports.com', tenantId: 'rtm', cvss: 9.0, owasp: OWASP[0], cwe: CWE[0], summary: 'The gate booking portal allows a haulier account to view and amend other hauliers\' container collection bookings, and OCR override requests are insufficiently authorised.', recommendation: 'Add tenant-scoped authorization on booking objects; require dual control for OCR overrides.' }),
    ],
    healthcare: [
      mk({ id: 'PT-MR-001', title: 'BOLA on the patient-portal FHIR API exposes other patients\' records', engType: 'API', target: 'fhir.mercyridgehealth.org', tenantId: 'clinics', cvss: 9.3, owasp: OWASP[0], cwe: CWE[0], summary: 'Patient resource IDs on the third-party-app FHIR endpoint are not scoped to the authorised patient context, so one patient\'s token can read another patient\'s demographics and encounters (tested with synthetic patients only).', recommendation: 'Enforce SMART-on-FHIR patient context server-side; add object-level checks and an abuse-detection rule in Sentinel. Assess HIPAA breach notification if exploited.' }),
      mk({ id: 'PT-MR-002', title: 'Default credentials on the infusion-pump server web console', engType: 'Internal', target: 'MRH-ALARIS-SRV', tenantId: 'mrmc', cvss: 9.1, owasp: OWASP[6], cwe: CWE[3], summary: 'The pump-library management console accepted a vendor default account from the clinical VLAN. Verified read-only; no drug-library change was attempted (patient-safety gate).', recommendation: 'Rotate the vendor account, restrict the console to the biomed jump host, and add the server to CyberArk. Coordinate with Clinical Engineering and the vendor.' }),
      mk({ id: 'PT-MR-003', title: 'Citrix StoreFront accepts a legacy authentication path without MFA', engType: 'External infra', target: 'citrix.mercyridgehealth.org', tenantId: 'mrmc', cvss: 8.2, owasp: OWASP[6], cwe: CWE[3], sev: 'high', slaDays: 11, likelihood: 4, impact: 4, summary: 'An older authentication endpoint remained enabled and bypasses the Entra ID MFA policy.', recommendation: 'Disable the legacy endpoint; enforce Conditional Access for all StoreFront paths.' }),
    ],
    automotive: [
      mk({ id: 'PT-VM-001', title: 'Vehicle API accepts replayed tokens for remote functions', engType: 'API', target: 'api.vireoconnect.com', tenantId: 'connected', cvss: 9.2, owasp: OWASP[6], cwe: CWE[3], summary: 'Access tokens for the connected-car app are not bound to the device and remain valid after logout, so a captured token can replay remote lock/unlock and location requests on a test vehicle.', recommendation: 'Bind tokens to device keys (DPoP), shorten lifetimes, revoke on logout and add a replay detection in the vehicle SOC. Record as a CSMS risk (R155 Annex 5).' }),
      mk({ id: 'PT-VM-002', title: 'IDOR on the dealer portal exposes customer finance applications', engType: 'Web app', target: 'dealer.vireo-motors.com', tenantId: 'retail', cvss: 9.0, owasp: OWASP[0], cwe: CWE[0], summary: 'Sequential application IDs let one dealer user open other dealers\' customer finance applications.', recommendation: 'Per-object authorisation scoped to dealer; unguessable IDs; GDPR impact assessment.' }),
      mk({ id: 'PT-VM-003', title: 'Supplier portal allows external accounts without MFA', engType: 'Web app', target: 'supplier.vireo-motors.com', tenantId: 'group', cvss: 7.9, owasp: OWASP[6], cwe: CWE[3], sev: 'high', slaDays: 13, likelihood: 4, impact: 4, summary: 'Supplier accounts federated from smaller suppliers fall back to password-only sign-in.', recommendation: 'Require MFA or managed-device certificates for all supplier accounts with PLM or OTA reach.' }),
    ],
  };
  return map[c.id];
}

export function findings(c: CustomerProfile, tenantId = 'all'): Finding[] {
  const r = rng(`strike-find-${c.id}-${tenantId}`);
  const h = headlines(c, tenantId);
  const flags = flagship(c).filter((f) => tenantId === 'all' || f.tenantId === tenantId);
  const target = Math.max(flags.length, h.strike.openFindings);
  const engTypes: EngType[] = ['External infra', 'Web app', 'API', 'Cloud config', 'Mobile', 'Internal'];
  const titles = [
    'Missing security headers and weak TLS configuration',
    'Verbose error messages leak stack traces',
    'Overly permissive IAM role (wildcard actions)',
    'Public cloud storage bucket with listing enabled',
    'Default credentials on an admin interface',
    'Stored XSS in a user profile field',
    'CSRF on a state-changing endpoint',
    'Unauthenticated information disclosure endpoint',
    'Weak password policy and no lockout',
    'Session token not invalidated on logout',
    'Outdated component with known CVE',
    'SSRF via webhook configuration',
    'Rate limiting absent on authentication',
    'Mobile app stores secrets in plaintext',
    'Internal SMB share world-readable',
  ];
  const out: Finding[] = [...flags];
  const sevRemaining = h.strike.criticalFindings - flags.filter((f) => f.sev === 'critical').length;
  for (let i = out.length; i < target; i++) {
    const needCrit = i - flags.length < Math.max(0, sevRemaining);
    const sev: Severity = needCrit ? 'critical' : r.weighted<Severity>([['high', 4], ['medium', 6], ['low', 4], ['info', 1]]);
    const cvss = sev === 'critical' ? r.float(9, 9.9, 1) : sev === 'high' ? r.float(7, 8.9, 1) : sev === 'medium' ? r.float(4, 6.9, 1) : sev === 'low' ? r.float(0.1, 3.9, 1) : 0;
    const likelihood = sev === 'critical' ? r.int(3, 5) : sev === 'high' ? r.int(2, 4) : r.int(1, 3);
    const impact = sev === 'critical' ? 5 : sev === 'high' ? r.int(3, 5) : r.int(1, 4);
    const status = r.weighted<Finding['status']>([['Open', 5], ['Fix in progress', 4], ['Retest', 2], ['Resolved', 2], ['Risk accepted', 1]]);
    out.push({
      id: `PT-${String(1000 + i)}`,
      title: titles[i % titles.length],
      engType: r.pick(engTypes),
      target: r.pick(c.vocab.externalHosts),
      sev,
      cvss,
      owasp: r.pick(OWASP),
      cwe: r.pick(CWE),
      likelihood,
      impact,
      status,
      slaDays: sev === 'critical' ? r.int(-2, 6) : sev === 'high' ? r.int(-3, 20) : r.int(5, 80),
      detection: r.chance(h.strike.findingsToDetectionsPct / 100),
      tenantId: tenantId === 'all' ? r.pick(c.tenants).id : tenantId,
      summary: 'Identified during a HexaStrike engagement; validated and reproduced by the tester.',
      recommendation: 'Remediate per guidance and schedule a retest; a detection can be generated from this finding.',
      firstFixPriority: sev === 'critical' || (sev === 'high' && likelihood >= 3),
    });
  }
  return out;
}

export function engagements(c: CustomerProfile, tenantId = 'all'): Engagement[] {
  const r = rng(`strike-eng-${c.id}-${tenantId}`);
  const fs = findings(c, tenantId);
  const types: EngType[] = ['External infra', 'Web app', 'API', 'Cloud config', 'Mobile', 'Internal'];
  const scopeByType: Record<EngType, string> = {
    'External infra': `Internet-facing hosts (${c.vocab.externalHosts.length} in scope)`,
    'Web app': 'Primary customer-facing applications',
    'API': 'REST / GraphQL APIs and partner integrations',
    'Cloud config': `${c.vocab.cloudAccounts.length} cloud accounts (CIS benchmark)`,
    'Mobile': 'iOS and Android apps',
    'Internal': 'Assumed-breach internal network',
  };
  const tenants = scopedTenants(c, tenantId);
  return types.map((t, i) => {
    const typeFindings = fs.filter((f) => f.engType === t);
    const tid = tenants[i % tenants.length].id;
    return {
      id: `ENG-2026-${String(10 + i)}`,
      type: t,
      name: `${t} test — ${c.tenants.find((x) => x.id === tid)?.short ?? c.short}`,
      tenantId: tid,
      status: r.weighted<Engagement['status']>([['Closed', 3], ['Reporting', 2], ['In progress', 2], ['Scheduled', 1]]),
      startedDays: r.int(3, 120),
      findings: typeFindings.length,
      critical: typeFindings.filter((f) => f.sev === 'critical').length,
      scope: scopeByType[t],
    };
  });
}

/* =====================================================================
   Red teaming
   ===================================================================== */
export type StageOutcome = 'achieved' | 'detected' | 'blocked';
export interface KillChainStep {
  phase: string;
  technique: string; // id
  techniqueName: string;
  action: string;
  outcome: StageOutcome;
  ttdMin?: number; // time to detect
}
export interface RedCampaign {
  id: string;
  name: string;
  objective: string;
  framework: string;
  tenantId: string;
  status: 'Scoping' | 'Active' | 'Debrief' | 'Complete';
  daysAgo: number;
  crownJewelReached: boolean;
  objectivesMet: number;
  objectivesTotal: number;
  steps: KillChainStep[];
}

export function redCampaigns(c: CustomerProfile): RedCampaign[] {
  const r = rng(`strike-red-${c.id}`);
  const base: Record<CustomerId, Omit<RedCampaign, 'steps'>[]> = {
    finserv: [
      { id: 'RT-2026-01', name: 'Project Northwall', objective: 'Reach the SWIFT secure zone and stage a fraudulent payment (no execution)', framework: 'CBEST / TIBER-EU (intelligence-led)', tenantId: 'ukbank', status: 'Debrief', daysAgo: 18, crownJewelReached: false, objectivesMet: 3, objectivesTotal: 5 },
    ],
    maritime: [
      { id: 'RT-2026-01', name: 'Project Tidelock', objective: 'From a phished shore-side user, reach the STS crane control network', framework: 'Objective-based (safety-gated)', tenantId: 'rtm', status: 'Complete', daysAgo: 34, crownJewelReached: true, objectivesMet: 4, objectivesTotal: 5 },
    ],
    media: [
      { id: 'RT-2026-01', name: 'Project Quietreel', objective: 'Exfiltrate a pre-release master without triggering custody controls', framework: 'Objective-based', tenantId: 'post', status: 'Debrief', daysAgo: 22, crownJewelReached: false, objectivesMet: 2, objectivesTotal: 4 },
    ],
    healthcare: [
      { id: 'RT-2026-01', name: 'Project Bedside', objective: 'From a phished clinician, reach the Epic Chronicles database and stage a mock ePHI export (synthetic data only)', framework: 'Objective-based, patient-safety gated (HHS 405(d) aligned)', tenantId: 'mrmc', status: 'Debrief', daysAgo: 26, crownJewelReached: false, objectivesMet: 3, objectivesTotal: 5 },
    ],
    automotive: [
      { id: 'RT-2026-01', name: 'Project Ironline', objective: 'Via a compromised supplier account, reach the OTA signing service and the Ingolstadt MES (observe only, no changes)', framework: 'TIBER-DE style, intelligence-led (OT safety-gated)', tenantId: 'group', status: 'Complete', daysAgo: 40, crownJewelReached: true, objectivesMet: 4, objectivesTotal: 6 },
    ],
  };
  const chain: Record<CustomerId, KillChainStep[]> = {
    finserv: [
      { phase: 'Initial access', technique: 'T1566.002', techniqueName: 'Spearphishing Link', action: 'Phished a Treasury Ops user via a themed portal', outcome: 'achieved' },
      { phase: 'Credential access', technique: 'T1621', techniqueName: 'MFA Request Generation', action: 'MFA fatigue to approve a push', outcome: 'detected', ttdMin: 6 },
      { phase: 'Discovery', technique: 'T1087.002', techniqueName: 'Domain Account Discovery', action: 'Enumerated privileged groups', outcome: 'detected', ttdMin: 22 },
      { phase: 'Lateral movement', technique: 'T1021.001', techniqueName: 'Remote Desktop Protocol', action: 'Pivoted toward the payments jump host', outcome: 'blocked', ttdMin: 14 },
      { phase: 'Objective', technique: 'T1657', techniqueName: 'Financial Theft', action: 'Attempted to reach the SWIFT secure zone', outcome: 'blocked' },
    ],
    maritime: [
      { phase: 'Initial access', technique: 'T1566.001', techniqueName: 'Spearphishing Attachment', action: 'Phished a shore-side terminal planner', outcome: 'achieved' },
      { phase: 'Execution', technique: 'T1204.002', techniqueName: 'Malicious File', action: 'Established a foothold on an IT workstation', outcome: 'detected', ttdMin: 31 },
      { phase: 'Lateral movement', technique: 'T1021.002', techniqueName: 'SMB/Windows Admin Shares', action: 'Moved toward the Level 3.5 DMZ', outcome: 'achieved' },
      { phase: 'OT access', technique: 'T0886', techniqueName: 'Remote Services', action: 'Reached the crane engineering network via a jump host gap', outcome: 'achieved' },
      { phase: 'Objective', technique: 'T0855', techniqueName: 'Unauthorized Command Message', action: 'Demonstrated reachability to crane PLC (no command sent, safety-gated)', outcome: 'detected', ttdMin: 48 },
    ],
    media: [
      { phase: 'Initial access', technique: 'T1199', techniqueName: 'Trusted Relationship', action: 'Compromised a post-production vendor review account', outcome: 'achieved' },
      { phase: 'Collection', technique: 'T1530', techniqueName: 'Data from Cloud Storage', action: 'Located a locked cut in the content vault', outcome: 'detected', ttdMin: 12 },
      { phase: 'Defense evasion', technique: 'T1070.001', techniqueName: 'Clear Windows Event Logs', action: 'Attempted to clear access traces', outcome: 'blocked', ttdMin: 9 },
      { phase: 'Objective', technique: 'T1567.002', techniqueName: 'Exfiltration to Cloud Storage', action: 'Attempted exfiltration of a master file', outcome: 'blocked' },
    ],
    healthcare: [
      { phase: 'Initial access', technique: 'T1566.002', techniqueName: 'Spearphishing Link', action: 'Phished a nurse manager with a payroll-update lure', outcome: 'achieved' },
      { phase: 'Credential access', technique: 'T1621', techniqueName: 'MFA Request Generation', action: 'Push fatigue against the Citrix StoreFront login', outcome: 'detected', ttdMin: 9 },
      { phase: 'Lateral movement', technique: 'T1078', techniqueName: 'Valid Accounts', action: 'Used a shared nursing-station account to reach clinical file shares', outcome: 'achieved' },
      { phase: 'Discovery', technique: 'T1087.002', techniqueName: 'Domain Account Discovery', action: 'Enumerated Epic service accounts', outcome: 'detected', ttdMin: 27 },
      { phase: 'Objective', technique: 'T1567.002', techniqueName: 'Exfiltration to Cloud Storage', action: 'Attempted a staged export of synthetic records to cloud storage', outcome: 'blocked' },
    ],
    automotive: [
      { phase: 'Initial access', technique: 'T1199', techniqueName: 'Trusted Relationship', action: 'Used a supplier-portal account taken from a stealer log (supplied by HexaInt)', outcome: 'achieved' },
      { phase: 'Credential access', technique: 'T1539', techniqueName: 'Steal Web Session Cookie', action: 'Replayed a supplier session against the PLM gateway', outcome: 'detected', ttdMin: 18 },
      { phase: 'Lateral movement', technique: 'T1021.001', techniqueName: 'Remote Desktop Protocol', action: 'Pivoted from the PLM jump host into the plant DMZ', outcome: 'achieved' },
      { phase: 'OT access', technique: 'T0886', techniqueName: 'Remote Services', action: 'Reached the MES line-controller network via an engineering workstation (observe only)', outcome: 'achieved' },
      { phase: 'Objective', technique: 'T1553.002', techniqueName: 'Code Signing', action: 'Requested an OTA signing operation; HSM dual control refused it', outcome: 'blocked', ttdMin: 4 },
    ],
  };
  return base[c.id].map((b) => ({ ...b, daysAgo: b.daysAgo + r.int(0, 3), steps: chain[c.id] }));
}

/* =====================================================================
   Purple teaming
   ===================================================================== */
export type PurpleResult = 'blocked' | 'detected' | 'logged' | 'missed';
export const PURPLE_COLOR: Record<PurpleResult, string> = {
  blocked: 'var(--good)',
  detected: '#68b1ff',
  logged: 'var(--sev-low)',
  missed: 'var(--bad)',
};
export interface PurpleTechnique {
  technique: string;
  name: string;
  result: PurpleResult;
  ttdMin?: number;
  ruleAction: 'New rule' | 'Tuned' | 'No change';
}
export interface PurpleSprint {
  id: string;
  label: string;
  daysAgo: number;
  tested: number;
  blocked: number;
  detected: number;
  logged: number;
  missed: number;
  rulesTuned: number;
  rulesCreated: number;
  coverageBefore: number;
  coverageAfter: number;
  techniques: PurpleTechnique[];
}

export function purpleSprints(c: CustomerProfile): PurpleSprint[] {
  const r = rng(`strike-purple-${c.id}`);
  const techPool = ['T1566.001', 'T1078', 'T1133', 'T1621', 'T1558.003', 'T1003.001', 'T1021.001', 'T1219', 'T1486', 'T1490', 'T1567.002', 'T1562.001', 'T1550.002', 'T1190', 'T1570'];
  const names: Record<string, string> = {
    'T1566.001': 'Spearphishing Attachment', 'T1078': 'Valid Accounts', 'T1133': 'External Remote Services', 'T1621': 'MFA Request Generation', 'T1558.003': 'Kerberoasting', 'T1003.001': 'LSASS Memory', 'T1021.001': 'Remote Desktop Protocol', 'T1219': 'Remote Access Software', 'T1486': 'Data Encrypted for Impact', 'T1490': 'Inhibit System Recovery', 'T1567.002': 'Exfiltration to Cloud Storage', 'T1562.001': 'Disable or Modify Tools', 'T1550.002': 'Pass the Hash', 'T1190': 'Exploit Public-Facing Application', 'T1570': 'Lateral Tool Transfer',
  };
  const sprints: PurpleSprint[] = [];
  let coverage = headlines(c).soc.attackCoveragePct - 14;
  for (let s = 5; s >= 0; s--) {
    const tested = r.int(6, 10);
    const picks = r.pickN(techPool, tested);
    const techniques: PurpleTechnique[] = picks.map((t) => {
      const result = r.weighted<PurpleResult>([['blocked', 4], ['detected', 4], ['logged', 2], ['missed', 2]]);
      return {
        technique: t,
        name: names[t] ?? t,
        result,
        ttdMin: result === 'detected' || result === 'blocked' ? r.int(1, 45) : undefined,
        ruleAction: result === 'missed' ? 'New rule' : result === 'logged' ? r.pick(['New rule', 'Tuned']) : r.weighted(['No change', 'Tuned'].map((x, i) => [x as 'No change' | 'Tuned', i === 0 ? 3 : 1])),
      };
    });
    const by = (x: PurpleResult) => techniques.filter((t) => t.result === x).length;
    const created = techniques.filter((t) => t.ruleAction === 'New rule').length;
    const tuned = techniques.filter((t) => t.ruleAction === 'Tuned').length;
    const before = Math.round(coverage);
    coverage += created * 1.6 + tuned * 0.6 + r.float(0, 1.2, 1);
    sprints.push({
      id: `PS-${s}`,
      label: fmtDateShort(daysAgo(s * 14)),
      daysAgo: s * 14,
      tested,
      blocked: by('blocked'),
      detected: by('detected'),
      logged: by('logged'),
      missed: by('missed'),
      rulesTuned: tuned,
      rulesCreated: created,
      coverageBefore: before,
      coverageAfter: Math.round(coverage),
      techniques,
    });
  }
  return sprints;
}

/* =====================================================================
   Attack surface management
   ===================================================================== */
export type AssetType = 'Domains' | 'Subdomains' | 'IPs' | 'Certificates' | 'Cloud buckets' | 'APIs' | 'Login portals';
export interface AsmBreakdown {
  type: AssetType;
  count: number;
  new7d: number;
  changed7d: number;
}
export function asmBreakdown(c: CustomerProfile, tenantId = 'all'): AsmBreakdown[] {
  const r = rng(`strike-asm-${c.id}-${tenantId}`);
  const total = headlines(c, tenantId).strike.externalAssets;
  const dist: { type: AssetType; w: number }[] = [
    { type: 'Subdomains', w: 0.4 },
    { type: 'IPs', w: 0.22 },
    { type: 'Certificates', w: 0.14 },
    { type: 'APIs', w: 0.08 },
    { type: 'Login portals', w: 0.06 },
    { type: 'Cloud buckets', w: 0.06 },
    { type: 'Domains', w: 0.04 },
  ];
  return dist.map((d) => {
    const count = Math.max(1, Math.round(total * d.w));
    return { type: d.type, count, new7d: r.int(0, Math.max(1, Math.round(count * 0.04))), changed7d: r.int(0, Math.max(1, Math.round(count * 0.06))) };
  });
}

export interface RiskyService {
  service: string;
  host: string;
  port: number;
  exposure: string;
  sev: Severity;
  tenantId: string;
}
export function riskyServices(c: CustomerProfile, tenantId = 'all'): RiskyService[] {
  const r = rng(`strike-risky-${c.id}-${tenantId}`);
  const kinds: { service: string; port: number; sev: Severity; exposure: string }[] = [
    { service: 'RDP', port: 3389, sev: 'critical', exposure: 'Remote Desktop exposed to the internet' },
    { service: 'SSH', port: 22, sev: 'high', exposure: 'SSH open with password auth' },
    { service: 'Admin panel', port: 8443, sev: 'high', exposure: 'Admin console reachable without allow-listing' },
    { service: 'VPN gateway', port: 443, sev: 'medium', exposure: 'VPN portal needs patch review' },
    { service: 'Database', port: 5432, sev: 'critical', exposure: 'Database port reachable from the internet' },
    { service: 'SMB', port: 445, sev: 'high', exposure: 'File sharing exposed externally' },
    { service: 'Telnet', port: 23, sev: 'critical', exposure: 'Cleartext management protocol exposed' },
  ];
  const tenants = scopedTenants(c, tenantId);
  const n = Math.min(kinds.length, Math.max(3, Math.round(headlines(c, tenantId).strike.externalAssets / 90)));
  const out: RiskyService[] = [];
  for (let i = 0; i < n; i++) {
    const k = kinds[i % kinds.length];
    out.push({ ...k, host: r.pick(c.vocab.externalHosts), tenantId: tenants[i % tenants.length].id });
  }
  return out;
}

export interface CertExpiry {
  host: string;
  daysToExpiry: number;
  issuer: string;
  tenantId: string;
}
export function certExpiries(c: CustomerProfile, tenantId = 'all'): CertExpiry[] {
  const r = rng(`strike-cert-${c.id}-${tenantId}`);
  const issuers = ["Let's Encrypt", 'DigiCert', 'Sectigo', 'GlobalSign', 'Amazon'];
  const tenants = scopedTenants(c, tenantId);
  return c.vocab.externalHosts.slice(0, 8).map((host, i) => ({
    host,
    daysToExpiry: i < 2 ? r.int(-3, 10) : i < 4 ? r.int(10, 30) : r.int(30, 300),
    issuer: r.pick(issuers),
    tenantId: tenants[i % tenants.length].id,
  }));
}

export interface AsmAsset {
  id: string;
  host: string;
  type: AssetType;
  ip: string;
  tech: string;
  firstSeenDays: number;
  sev: Severity;
  kev?: string;
  ports: number[];
  tenantId: string;
  note: string;
}
export function asmAssets(c: CustomerProfile, tenantId = 'all'): AsmAsset[] {
  const r = rng(`strike-asmassets-${c.id}-${tenantId}`);
  const techs = ['nginx', 'Apache', 'IIS', 'Next.js', 'Cloudflare', 'AWS ALB', 'Palo Alto GlobalProtect', 'Citrix NetScaler', 'F5 BIG-IP', 'Express'];
  const tenants = scopedTenants(c, tenantId);
  const hosts = c.vocab.externalHosts;
  const kevAssets = kevExposures(c, tenantId);
  const out: AsmAsset[] = [];
  for (let i = 0; i < hosts.length; i++) {
    const kev = kevAssets.find((k) => k.host === hosts[i]);
    out.push({
      id: `AS-${String(500 + i)}`,
      host: hosts[i],
      type: hosts[i].includes('api') ? 'APIs' : hosts[i].includes('vpn') || hosts[i].includes('portal') || hosts[i].includes('online') || hosts[i].includes('trade') ? 'Login portals' : 'Subdomains',
      ip: `${r.int(20, 210)}.${r.int(0, 255)}.${r.int(0, 255)}.${r.int(1, 254)}`,
      tech: kev ? kev.product : r.pick(techs),
      firstSeenDays: r.int(1, 400),
      sev: kev ? 'critical' : r.weighted<Severity>([['high', 2], ['medium', 4], ['low', 4], ['info', 2]]),
      kev: kev?.cve,
      ports: r.pickN([443, 80, 22, 8443, 3389, 8080], r.int(1, 3)).sort((a, b) => a - b),
      tenantId: tenants[i % tenants.length].id,
      note: kev ? `KEV-listed vulnerability on an internet-facing service: ${kev.title}` : 'Discovered by continuous ASM scanning.',
    });
  }
  return out;
}

export interface KevExposure {
  host: string;
  product: string;
  cve: string;
  title: string;
  cvss: number;
  tenantId: string;
  slaDays: number;
}
export function kevExposures(c: CustomerProfile, tenantId = 'all'): KevExposure[] {
  const r = rng(`strike-kev-${c.id}`);
  const map: Record<CustomerId, KevExposure[]> = {
    maritime: [
      { host: 'citrix.pkl.halcyonports.com', product: 'Palo Alto PAN-OS GlobalProtect', cve: 'CVE-2024-3400', title: 'Command injection in GlobalProtect', cvss: 10.0, tenantId: 'sts', slaDays: 3 },
      { host: 'vpn.halcyonports.com', product: 'Fortinet FortiOS SSL VPN', cve: 'CVE-2024-21762', title: 'Unauthenticated RCE', cvss: 9.8, tenantId: 'hq', slaDays: 9 },
    ],
    finserv: [
      { host: 'vpn.aldersgate.co.uk', product: 'Citrix NetScaler ADC/Gateway', cve: 'CVE-2023-4966', title: '"Citrix Bleed" session token disclosure', cvss: 9.4, tenantId: 'ukbank', slaDays: 5 },
    ],
    media: [
      { host: 'aspera.kestrelpictures.com', product: 'Progress MOVEit Transfer', cve: 'CVE-2023-34362', title: 'SQL injection leading to RCE', cvss: 9.8, tenantId: 'studios', slaDays: 7 },
    ],
    healthcare: [
      { host: 'citrix.mercyridgehealth.org', product: 'Citrix NetScaler Gateway', cve: 'CVE-2023-4966', title: '"Citrix Bleed" session token disclosure', cvss: 9.4, tenantId: 'mrmc', slaDays: 4 },
      { host: 'vpn.mercyridgehealth.org', product: 'Fortinet FortiOS SSL VPN', cve: 'CVE-2024-21762', title: 'Unauthenticated RCE (out-of-bounds write)', cvss: 9.8, tenantId: 'community', slaDays: 8 },
    ],
    automotive: [
      { host: 'vpn.vireo-motors.com', product: 'Fortinet FortiOS SSL VPN (Puebla)', cve: 'CVE-2024-21762', title: 'Unauthenticated RCE (out-of-bounds write)', cvss: 9.8, tenantId: 'puebla', slaDays: 2 },
      { host: 'supplier.vireo-motors.com', product: 'Progress MOVEit Transfer', cve: 'CVE-2023-34362', title: 'SQL injection leading to RCE', cvss: 9.8, tenantId: 'group', slaDays: 6 },
    ],
  };
  void CVES;
  void r;
  return map[c.id].filter((k) => tenantId === 'all' || k.tenantId === tenantId);
}

export function discoveryTrend(c: CustomerProfile, tenantId = 'all'): { labels: string[]; data: number[] } {
  const r = rng(`strike-disc-${c.id}-${tenantId}`);
  const total = headlines(c, tenantId).strike.externalAssets;
  const labels: string[] = [];
  const data: number[] = [];
  let v = total * 0.8;
  for (let i = 11; i >= 0; i--) {
    const dd = new Date();
    dd.setMonth(dd.getMonth() - i);
    labels.push(dd.toLocaleDateString('en-GB', { month: 'short' }));
    v += (total - v) / (i + 1) + r.float(-total * 0.01, total * 0.03, 0);
    data.push(Math.max(0, Math.round(v)));
  }
  data[data.length - 1] = total;
  return { labels, data };
}
