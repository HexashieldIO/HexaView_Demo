// HexaStrike (Offensive Security) data: penetration testing, red teaming,
// purple teaming and attack surface management. Pure, seeded per customer.
import type { CustomerProfile, Severity } from '../types';
import { rng } from '../../lib/rng';
import { headlines } from '../core';
import { scopedTenants } from '../customers';
import { CVES } from '../reference';
import { daysAgo, fmtDateShort } from '../../lib/format';
import { forCustomer, type CustomerMap } from '../customerMap';

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
  const map: CustomerMap<Finding[]> = {
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
    insurance: [
      mk({ id: 'PT-KM-001', title: 'Broken object-level authorisation on the AgentHub broker API', engType: 'API', target: 'agents.kingsbridgemutual.com', tenantId: 'personal', cvss: 9.3, owasp: OWASP[0], cwe: CWE[0], summary: 'Policy and book-of-business identifiers on the agent portal API are not scoped to the signed-in agency, so one agency can read another agency\'s policyholder records and quotes (tested against seeded agencies only).', recommendation: 'Bind every object to the authenticated agency server-side, add object-level authorisation and an abuse-detection rule; assess nonpublic-information exposure under NYDFS 500 and NAIC #668.' }),
      mk({ id: 'PT-KM-002', title: 'Payment-page script integrity gap in the premium CDE', engType: 'Web app', target: 'pay.kingsbridgemutual.com', tenantId: 'personal', cvss: 8.7, owasp: OWASP[7], cwe: CWE[4], sev: 'high', slaDays: 8, likelihood: 3, impact: 5, firstFixPriority: true, summary: 'The premium payment page loads third-party scripts without integrity or change monitoring, a precursor to payment-page skimming of cardholder data.', recommendation: 'Apply Subresource Integrity and a content-security policy, inventory and monitor payment-page scripts per PCI DSS 6.4.3 and 11.6.1.' }),
      mk({ id: 'PT-KM-003', title: 'Managed file transfer reachable with legacy authentication', engType: 'External infra', target: 'mft.kingsbridgemutual.com', tenantId: 'group', cvss: 8.1, owasp: OWASP[4], cwe: CWE[3], sev: 'high', slaDays: 10, likelihood: 3, impact: 4, summary: 'The claims and reinsurance file-transfer gateway exposes an older authentication path that bypasses the enforced MFA policy.', recommendation: 'Disable the legacy path, enforce MFA and allow-listing, and monitor the gateway for anomalous data movement.' }),
    ],
    defence: [
      mk({ id: 'PT-SP-001', title: 'Controlled Unclassified Information reachable outside the GCC High enclave', engType: 'Cloud config', target: 'suppliers.sentrypeakdefense.com', tenantId: 'programs', cvss: 9.1, owasp: OWASP[0], cwe: CWE[0], summary: 'A supplier-facing share path allowed a commercial-tenant account to reach a location holding CUI technical data, breaking the enclave boundary (verified read-only against seeded documents).', recommendation: 'Confine CUI to the GCC High enclave with Purview labels and flow control, remediate the share, and treat as a potential CUI spill under DFARS 252.204-7012.' }),
      mk({ id: 'PT-SP-002', title: 'ITAR technical data in Teamcenter accessible without a US-person attribute check', engType: 'Internal', target: 'SPD-TC-PRD01', tenantId: 'engineering', cvss: 8.6, owasp: OWASP[0], cwe: CWE[0], sev: 'high', slaDays: 9, likelihood: 3, impact: 5, firstFixPriority: true, summary: 'Item-level access control in the PLM did not enforce the US-person / export attribute for an export-controlled drawing set, so a non-US-person account context could view ITAR data.', recommendation: 'Enforce US-person attributes in Teamcenter ACLs and Entra, review the technology control plan, and record against the ITAR / EAR obligations.' }),
      mk({ id: 'PT-SP-003', title: 'Building 3 DNC programme server accepts an unmanaged service account', engType: 'Internal', target: 'B3-DNC-SRV01', tenantId: 'manufacturing', cvss: 8.2, owasp: OWASP[6], cwe: CWE[3], sev: 'high', slaDays: 12, likelihood: 3, impact: 4, summary: 'The distributed numerical control server storing CNC programmes was reachable from the shop-floor network with a shared service account (verified read-only; no programme was altered).', recommendation: 'Vault the account in Delinea, isolate the DNC and CMM hosts from corporate IT, and add CNC programme change monitoring.' }),
    ],
    pharma: [
      mk({ id: 'PT-RHN-001', title: 'GxP audit trail can be disabled on the LIMS by a privileged account', engType: 'Internal', target: 'BSL-LIMS-LW01', tenantId: 'valais', cvss: 9.0, owasp: OWASP[7], cwe: CWE[3], summary: 'A privileged application role on the laboratory system could switch off the attributable audit trail without a second approval, undermining data integrity on GxP records (observed in a validation copy).', recommendation: 'Remove the ability to disable audit trails, require dual control and reconcile to GxP change control per Part 11 11.10(e) and EU GMP Annex 11.' }),
      mk({ id: 'PT-RHN-002', title: 'Unblinding keys and randomisation lists reachable by over-broad access', engType: 'API', target: 'clinicaltrials.rhenara.com', tenantId: 'clinops', cvss: 8.9, owasp: OWASP[0], cwe: CWE[0], sev: 'high', slaDays: 7, likelihood: 3, impact: 5, firstFixPriority: true, summary: 'RTSM access scoping allowed a clinical-operations role wider reach to unblinding keys for an active Phase III study than the role should hold (tested against a blinded synthetic study).', recommendation: 'Restrict unblinding keys to named custodians, alert on access, custody-track transfers and review against EU CTR / GCP.' }),
      mk({ id: 'PT-RHN-003', title: 'DeltaV engineering workstation reachable from the IT network', engType: 'Internal', target: 'VLS-DELTAV-PROPLUS', tenantId: 'valais', cvss: 8.3, owasp: OWASP[4], cwe: CWE[4], sev: 'high', slaDays: 11, likelihood: 3, impact: 4, summary: 'A path from the corporate IT network reached a DeltaV engineering workstation on the Sierre plant, weakening IT/OT segmentation (reachability demonstrated; no process change attempted).', recommendation: 'Enforce the Level 3.5 DMZ, broker OEM access through PAM with session recording and alert on cross-zone connections.' }),
    ],
    sghospital: [
      mk({ id: 'PT-OBH-001', title: 'Broken object-level authorisation on the patient-portal FHIR API', engType: 'API', target: 'fhir.orchidbay.com.sg', tenantId: 'obh', cvss: 9.2, owasp: OWASP[0], cwe: CWE[0], summary: 'Patient resource identifiers on the third-party-app FHIR endpoint are not scoped to the authorised patient context, so one patient\'s token can read another patient\'s demographics and encounters (tested with synthetic patients only).', recommendation: 'Enforce patient context server-side, add object-level checks and an abuse-detection rule; assess PDPA s26D (PDPC 3-day) and MOH HIA notification if exploited.' }),
      mk({ id: 'PT-OBH-002', title: 'Default credentials on the infusion-pump management server', engType: 'Internal', target: 'OBH-ALARIS-SRV', tenantId: 'obh', cvss: 9.0, owasp: OWASP[6], cwe: CWE[3], summary: 'The BD Alaris drug-library management console accepted a vendor default account from the clinical VLAN. Verified read-only; no drug-library change was attempted (patient-safety gate).', recommendation: 'Rotate the vendor account, restrict the console to the biomed jump host, add it to CyberArk and coordinate with Biomedical Engineering and the vendor per HSA GL-04.' }),
      mk({ id: 'PT-OBH-003', title: 'Citrix StoreFront legacy authentication path bypasses MFA', engType: 'External infra', target: 'citrix.orchidbay.com.sg', tenantId: 'obh', cvss: 8.2, owasp: OWASP[6], cwe: CWE[3], sev: 'high', slaDays: 10, likelihood: 4, impact: 4, summary: 'An older authentication endpoint on the clinician remote-access portal remained enabled and bypasses the Entra ID MFA policy.', recommendation: 'Disable the legacy endpoint and enforce Conditional Access for all StoreFront paths.' }),
    ],
    studio: [
      mk({ id: 'PT-SFE-001', title: 'Review-link authentication bypass on the screeners portal', engType: 'Web app', target: 'screeners.starfallent.com', tenantId: 'studios', cvss: 9.4, owasp: OWASP[6], cwe: CWE[3], summary: 'Signed screener links can be replayed after expiry and are not bound to a viewer, exposing pre-release content ahead of release.', recommendation: 'Bind links to authenticated viewers, enforce short single-use expiry and forensic watermarking per MPA CSBP and TPN.' }),
      mk({ id: 'PT-SFE-002', title: 'Credential-stuffing resistance missing on Starfall+ sign-in', engType: 'Web app', target: 'login.starfallplus.com', tenantId: 'play', cvss: 8.8, owasp: OWASP[6], cwe: CWE[3], sev: 'high', slaDays: 7, likelihood: 4, impact: 4, firstFixPriority: true, summary: 'The consumer streaming login lacks rate limiting, bot management and breached-credential checks, enabling account-takeover at scale against subscribers.', recommendation: 'Enforce bot management and rate limiting at the edge, add breached-credential screening and step-up authentication on risky sign-ins.' }),
      mk({ id: 'PT-SFE-003', title: 'VFX vendor account reaches content shares without MFA', engType: 'Web app', target: 'aspera.starfallent.com', tenantId: 'post', cvss: 8.1, owasp: OWASP[6], cwe: CWE[3], sev: 'high', slaDays: 11, likelihood: 4, impact: 4, summary: 'A federated external VFX-vendor account could reach content-transfer shares with password-only sign-in, the common entry point for a pre-release leak.', recommendation: 'Require MFA or managed-device certificates and the Island enterprise browser for all vendor accounts, scoped to named projects.' }),
    ],
  };
  return forCustomer(map, c);
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
  const base: CustomerMap<Omit<RedCampaign, 'steps'>[]> = {
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
    insurance: [
      { id: 'RT-2026-01', name: 'Project Ledgerline', objective: 'From the agent & broker portal, reach the claims payment run and the premium CDE, and stage a mock disbursement in Guidewire ClaimCenter (no execution)', framework: 'Objective-based (NYDFS 500.17 aligned)', tenantId: 'claims', status: 'Debrief', daysAgo: 20, crownJewelReached: false, objectivesMet: 3, objectivesTotal: 5 },
    ],
    defence: [
      { id: 'RT-2026-01', name: 'Project Ironcote', objective: 'From a phished engineer, reach CUI in the GCC High enclave, ITAR data in Teamcenter and the Building 3 DNC server (observe only, safety-gated)', framework: 'Objective-based, intelligence-led (CUI & OT gated)', tenantId: 'engineering', status: 'Complete', daysAgo: 38, crownJewelReached: true, objectivesMet: 4, objectivesTotal: 6 },
    ],
    pharma: [
      { id: 'RT-2026-01', name: 'Project Edelweiss', objective: 'From the IT network, reach the RTSM unblinding keys, formulation IP and the Valais DeltaV DCS (observe only, GxP and OT safety-gated)', framework: 'TIBER-EU style, intelligence-led (OT safety-gated)', tenantId: 'valais', status: 'Debrief', daysAgo: 24, crownJewelReached: false, objectivesMet: 3, objectivesTotal: 6 },
    ],
    sghospital: [
      { id: 'RT-2026-01', name: 'Project Orchidgate', objective: 'From the guest Wi-Fi and a phished nurse, reach the TrakCare database, PACS archive and the Alaris pump server (synthetic data only, patient-safety gated)', framework: 'Objective-based, patient-safety gated (MOH HIA aligned)', tenantId: 'obh', status: 'Debrief', daysAgo: 27, crownJewelReached: false, objectivesMet: 3, objectivesTotal: 5 },
    ],
    studio: [
      { id: 'RT-2026-01', name: 'Project Nightreel', objective: 'From a VFX vendor account, reach the pre-release vault, the Starfall+ DRM licence servers and the Orlando ride-control network (observe only, OT safety-gated)', framework: 'Objective-based (MPA CSBP / TPN aligned)', tenantId: 'post', status: 'Debrief', daysAgo: 21, crownJewelReached: false, objectivesMet: 3, objectivesTotal: 6 },
    ],
  };
  const chain: CustomerMap<KillChainStep[]> = {
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
    insurance: [
      { phase: 'Initial access', technique: 'T1110.004', techniqueName: 'Credential Stuffing', action: 'Reused broker credentials against the AgentHub portal', outcome: 'achieved' },
      { phase: 'Credential access', technique: 'T1621', techniqueName: 'MFA Request Generation', action: 'Push fatigue against a claims-operations account', outcome: 'detected', ttdMin: 8 },
      { phase: 'Discovery', technique: 'T1087.002', techniqueName: 'Domain Account Discovery', action: 'Enumerated Guidewire and payment service accounts', outcome: 'detected', ttdMin: 24 },
      { phase: 'Lateral movement', technique: 'T1021.001', techniqueName: 'Remote Desktop Protocol', action: 'Pivoted toward the premium CDE segment', outcome: 'blocked', ttdMin: 15 },
      { phase: 'Objective', technique: 'T1657', techniqueName: 'Financial Theft', action: 'Attempted to stage a disbursement in ClaimCenter', outcome: 'blocked' },
    ],
    defence: [
      { phase: 'Initial access', technique: 'T1566.002', techniqueName: 'Spearphishing Link', action: 'Phished a design engineer with a capture-themed lure', outcome: 'achieved' },
      { phase: 'Execution', technique: 'T1204.002', techniqueName: 'Malicious File', action: 'Established a foothold on an engineering workstation', outcome: 'detected', ttdMin: 19 },
      { phase: 'Collection', technique: 'T1213', techniqueName: 'Data from Information Repositories', action: 'Located ITAR drawings in Teamcenter without a US-person check', outcome: 'achieved' },
      { phase: 'Lateral movement', technique: 'T1021.002', techniqueName: 'SMB/Windows Admin Shares', action: 'Moved toward the Building 3 DNC server', outcome: 'achieved' },
      { phase: 'Objective', technique: 'T1567.002', techniqueName: 'Exfiltration to Cloud Storage', action: 'Attempted to move CUI outside the GCC High enclave', outcome: 'blocked', ttdMin: 11 },
    ],
    pharma: [
      { phase: 'Initial access', technique: 'T1566.001', techniqueName: 'Spearphishing Attachment', action: 'Phished an IT administrator with an invoice lure', outcome: 'achieved' },
      { phase: 'Credential access', technique: 'T1003.001', techniqueName: 'LSASS Memory', action: 'Harvested credentials from a corporate server', outcome: 'detected', ttdMin: 16 },
      { phase: 'Collection', technique: 'T1213', techniqueName: 'Data from Information Repositories', action: 'Reached RTSM unblinding keys through over-broad access', outcome: 'detected', ttdMin: 29 },
      { phase: 'Lateral movement', technique: 'T1021.002', techniqueName: 'SMB/Windows Admin Shares', action: 'Crossed toward the Sierre plant Level 3.5 DMZ', outcome: 'achieved' },
      { phase: 'OT access', technique: 'T0886', techniqueName: 'Remote Services', action: 'Reached the DeltaV engineering network (observe only, safety-gated)', outcome: 'blocked', ttdMin: 7 },
    ],
    sghospital: [
      { phase: 'Initial access', technique: 'T1078', techniqueName: 'Valid Accounts', action: 'Joined the guest Wi-Fi and reused a shared clinical account', outcome: 'achieved' },
      { phase: 'Credential access', technique: 'T1621', techniqueName: 'MFA Request Generation', action: 'Push fatigue against the Citrix StoreFront login', outcome: 'detected', ttdMin: 10 },
      { phase: 'Lateral movement', technique: 'T1021.002', techniqueName: 'SMB/Windows Admin Shares', action: 'Moved toward the TrakCare and PACS servers', outcome: 'achieved' },
      { phase: 'Discovery', technique: 'T1087.002', techniqueName: 'Domain Account Discovery', action: 'Enumerated TrakCare and biomed service accounts', outcome: 'detected', ttdMin: 26 },
      { phase: 'Objective', technique: 'T1567.002', techniqueName: 'Exfiltration to Cloud Storage', action: 'Attempted a staged export of synthetic records', outcome: 'blocked' },
    ],
    studio: [
      { phase: 'Initial access', technique: 'T1199', techniqueName: 'Trusted Relationship', action: 'Used a compromised VFX-vendor account', outcome: 'achieved' },
      { phase: 'Collection', technique: 'T1530', techniqueName: 'Data from Cloud Storage', action: 'Located a locked cut in the pre-release vault', outcome: 'detected', ttdMin: 12 },
      { phase: 'Credential access', technique: 'T1552.001', techniqueName: 'Credentials In Files', action: 'Recovered a licence-server credential from a share', outcome: 'detected', ttdMin: 21 },
      { phase: 'Lateral movement', technique: 'T1021.001', techniqueName: 'Remote Desktop Protocol', action: 'Pivoted toward the Orlando ride-control network (observe only)', outcome: 'blocked', ttdMin: 9 },
      { phase: 'Objective', technique: 'T1567.002', techniqueName: 'Exfiltration to Cloud Storage', action: 'Attempted exfiltration of a master file', outcome: 'blocked' },
    ],
  };
  return forCustomer(base, c).map((b) => ({ ...b, daysAgo: b.daysAgo + r.int(0, 3), steps: forCustomer(chain, c) }));
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
  const map: CustomerMap<KevExposure[]> = {
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
    insurance: [
      { host: 'vpn.kingsbridgemutual.com', product: 'Palo Alto PAN-OS GlobalProtect', cve: 'CVE-2024-3400', title: 'Command injection in GlobalProtect', cvss: 10.0, tenantId: 'group', slaDays: 3 },
      { host: 'mft.kingsbridgemutual.com', product: 'Progress MOVEit Transfer', cve: 'CVE-2023-34362', title: 'SQL injection leading to RCE', cvss: 9.8, tenantId: 'claims', slaDays: 6 },
      { host: 'my.kingsbridgemutual.com', product: 'HexaShield-tracked web portal (PolicyView)', cve: 'CVE-2026-31044', title: 'Authentication bypass on an internet-facing portal', cvss: 9.3, tenantId: 'personal', slaDays: 5 },
      { host: 'api.kingsbridgemutual.com', product: 'HexaShield-tracked API gateway (BrokerBridge)', cve: 'CVE-2026-33820', title: 'Unauthenticated remote code execution on an API gateway', cvss: 9.4, tenantId: 'commercial', slaDays: 7 },
      { host: 'drive.kingsbridgemutual.com', product: 'HexaShield-tracked file-share appliance (DocVault)', cve: 'CVE-2026-37615', title: 'Pre-auth path traversal on a file-share appliance', cvss: 9.1, tenantId: 'life', slaDays: 9 },
      { host: 'specialty.kingsbridgemutual.com', product: 'HexaShield-tracked underwriting portal (SpecialtyDesk)', cve: 'CVE-2026-39120', title: 'Authentication bypass on an internet-facing portal', cvss: 9.0, tenantId: 'specialty', slaDays: 11 },
    ],
    defence: [
      { host: 'vpn.sentrypeakdefense.com', product: 'Palo Alto PAN-OS GlobalProtect', cve: 'CVE-2024-3400', title: 'Command injection in GlobalProtect', cvss: 10.0, tenantId: 'corporate', slaDays: 2 },
      { host: 'portal.sentrypeakdefense.com', product: 'HexaShield-tracked collaboration portal (ProgramLink)', cve: 'CVE-2026-42051', title: 'Authentication bypass on an internet-facing portal', cvss: 9.3, tenantId: 'programs', slaDays: 3 },
      { host: 'remote.sentrypeakdefense.com', product: 'HexaShield-tracked remote-access gateway (EngAccess)', cve: 'CVE-2026-43390', title: 'Unauthenticated remote code execution on a remote-access gateway', cvss: 9.4, tenantId: 'engineering', slaDays: 4 },
      { host: 'sftp.sentrypeakdefense.com', product: 'HexaShield-tracked MFT appliance (ShopTransfer)', cve: 'CVE-2026-44712', title: 'Pre-auth authentication bypass on a managed file-transfer appliance', cvss: 9.1, tenantId: 'manufacturing', slaDays: 8 },
      { host: 'test.sentrypeakdefense.com', product: 'HexaShield-tracked range portal (RangeLink)', cve: 'CVE-2026-45203', title: 'Authentication bypass on an internet-facing portal', cvss: 8.9, tenantId: 'tucson', slaDays: 10 },
    ],
    pharma: [
      { host: 'vpn.rhenara.com', product: 'Palo Alto PAN-OS GlobalProtect', cve: 'CVE-2024-3400', title: 'Command injection in GlobalProtect', cvss: 10.0, tenantId: 'corporate', slaDays: 3 },
      { host: 'suppliers.rhenara.com', product: 'HexaShield-tracked MFT appliance (SupplyBridge)', cve: 'CVE-2026-41187', title: 'Authentication bypass in a managed file-transfer appliance', cvss: 9.6, tenantId: 'commercial', slaDays: 7 },
      { host: 'hpc.rhenara.com', product: 'HexaShield-tracked research gateway (DiscoveryHub)', cve: 'CVE-2026-46118', title: 'Unauthenticated remote code execution on a research gateway', cvss: 9.3, tenantId: 'rnd', slaDays: 8 },
      { host: 'clinicaltrials.rhenara.com', product: 'HexaShield-tracked clinical portal (TrialConnect)', cve: 'CVE-2026-47522', title: 'Authentication bypass on an internet-facing portal', cvss: 9.2, tenantId: 'clinops', slaDays: 6 },
      { host: 'otaccess-vls.rhenara.com', product: 'HexaShield-tracked OEM remote-access edge (PlantAccess)', cve: 'CVE-2026-48110', title: 'Pre-auth authentication bypass on a remote-access appliance', cvss: 9.0, tenantId: 'valais', slaDays: 9 },
      { host: 'otaccess-crk.rhenara.com', product: 'HexaShield-tracked OEM remote-access edge (PlantAccess)', cve: 'CVE-2026-48110', title: 'Pre-auth authentication bypass on a remote-access appliance', cvss: 9.0, tenantId: 'cork', slaDays: 10 },
    ],
    sghospital: [
      { host: 'vpn.orchidbay.com.sg', product: 'Fortinet FortiOS SSL VPN', cve: 'CVE-2024-21762', title: 'Unauthenticated RCE (out-of-bounds write)', cvss: 9.8, tenantId: 'obh', slaDays: 4 },
      { host: 'citrix.orchidbay.com.sg', product: 'Citrix NetScaler Gateway', cve: 'CVE-2023-4966', title: '"Citrix Bleed" session token disclosure', cvss: 9.4, tenantId: 'specialist', slaDays: 6 },
      { host: 'telehealth.orchidbay.com.sg', product: 'HexaShield-tracked telehealth portal (CareConnect)', cve: 'CVE-2026-50140', title: 'Authentication bypass on an internet-facing portal', cvss: 9.1, tenantId: 'daysurg', slaDays: 7 },
      { host: 'research.orchidbay.com.sg', product: 'HexaShield-tracked imaging gateway (ImageShare)', cve: 'CVE-2026-51277', title: 'Pre-auth path traversal on an imaging gateway', cvss: 9.0, tenantId: 'labimg', slaDays: 9 },
      { host: 'app.orchidbay.com.sg', product: 'HexaShield-tracked corporate portal (OrchidDesk)', cve: 'CVE-2026-52614', title: 'Authentication bypass on an internet-facing portal', cvss: 8.9, tenantId: 'corp', slaDays: 11 },
    ],
    studio: [
      { host: 'vpn.starfallent.com', product: 'Palo Alto PAN-OS GlobalProtect', cve: 'CVE-2024-3400', title: 'Command injection in GlobalProtect', cvss: 10.0, tenantId: 'post', slaDays: 3 },
      { host: 'aspera.starfallent.com', product: 'IBM Aspera Faspex', cve: 'CVE-2022-47986', title: 'Unauthenticated RCE in the file-exchange service', cvss: 9.8, tenantId: 'studios', slaDays: 5 },
      { host: 'api.starfallplus.com', product: 'HexaShield-tracked streaming edge (EdgeCast)', cve: 'CVE-2026-55210', title: 'Request-routing authentication bypass on a streaming edge node', cvss: 9.3, tenantId: 'play', slaDays: 8 },
      { host: 'tickets.starfallresorts.com', product: 'HexaShield-tracked ticketing platform (StarPass)', cve: 'CVE-2026-56331', title: 'Authentication bypass on an internet-facing portal', cvss: 9.1, tenantId: 'parks', slaDays: 7 },
      { host: 'osaka.starfallresorts.com', product: 'HexaShield-tracked ticketing platform (StarPass)', cve: 'CVE-2026-56331', title: 'Authentication bypass on an internet-facing portal', cvss: 9.1, tenantId: 'parksasia', slaDays: 9 },
      { host: 'remote.starfallent.com', product: 'HexaShield-tracked remote-access gateway (CorpAccess)', cve: 'CVE-2026-57440', title: 'Unauthenticated remote code execution on a remote-access gateway', cvss: 9.2, tenantId: 'corp', slaDays: 10 },
    ],
  };
  void CVES;
  void r;
  return forCustomer(map, c).filter((k) => tenantId === 'all' || k.tenantId === tenantId);
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
