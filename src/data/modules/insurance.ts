// Cyber Insurance & Risk Quantification module data. Everything here anchors to
// headlines(c).insurance (insurability, premium delta, expected loss, 1-in-100 loss,
// attested controls) and to c.insurance (carrier, broker, limit, retention, premium).
// Money values are in millions of c.currency unless a field name says otherwise.

import type { Connector, CustomerProfile, Health } from '../types';
import { headlines } from '../core';
import { isStale } from '../customers';
import { rng } from '../../lib/rng';
import { forCustomer, type CustomerMap } from '../customerMap';
import { currencySymbol } from '../../lib/format';

/* =====================================================================
   Insurer key controls (12 controls, 26 control tests)
   ===================================================================== */
export type ControlId = 'mfa' | 'edr' | 'backup' | 'pam' | 'patch' | 'email' | 'ir' | 'logging' | 'tprm' | 'seg' | 'awareness' | 'eol';
export type ControlStatus = 'attested' | 'partial' | 'gap';

export interface ControlTest {
  id: string;
  q: string;
  a: string;
  ok: boolean;
  evidenceRef: string;
}
export interface SourceRef {
  id: string;
  name: string;
  status: Health;
  lastSyncMin: number;
  stale: boolean;
}
export interface KeyControl {
  id: ControlId;
  name: string;
  why: string;
  weight: 1 | 2 | 3;
  metric: string;
  tests: ControlTest[];
  ok: number;
  lastOk: number;
  status: ControlStatus;
  lastStatus: ControlStatus;
  sources: SourceRef[];
  gapNote?: string;
  fix?: string;
}

const CONTROL_META: Record<ControlId, { name: string; why: string; weight: 1 | 2 | 3 }> = {
  mfa: { name: 'MFA on email, remote and privileged access', why: 'Credential abuse is the leading initial access vector in ransomware claims; most carriers decline without it.', weight: 3 },
  edr: { name: 'EDR coverage with 24×7 response', why: 'EDR plus a monitored response service shortens dwell time, the biggest driver of claim severity.', weight: 3 },
  backup: { name: 'Immutable, isolated and tested backups', why: 'Determines whether ransomware becomes a business-interruption claim and an extortion payment.', weight: 3 },
  pam: { name: 'Privileged access management', why: 'Domain-wide encryption almost always follows privileged credential theft.', weight: 2 },
  patch: { name: 'Patch cadence for critical and KEV vulnerabilities', why: 'Many wordings now carry unpatched-vulnerability coinsurance; exploited edge devices drive frequency.', weight: 3 },
  email: { name: 'Email security and payment-fraud controls', why: 'Phishing and BEC are the most frequent cyber claims by count.', weight: 2 },
  ir: { name: 'Incident response plan, tested', why: 'Tested plans and a pre-agreed retainer cut response cost and BI duration.', weight: 2 },
  logging: { name: 'Security logging and retention', why: 'Without logs, forensics cannot scope a breach; notification costs and fines rise.', weight: 1 },
  tprm: { name: 'Third-party and supply-chain risk', why: 'Dependent BI and supply-chain compromise are growing loss drivers and accumulation risks.', weight: 2 },
  seg: { name: 'Network and OT/IT segmentation', why: 'Segmentation limits blast radius; for OT it decides whether an IT event stops operations.', weight: 2 },
  awareness: { name: 'Security awareness and phishing simulation', why: 'Underwriters ask for completion rates and click rates as a culture signal.', weight: 1 },
  eol: { name: 'End-of-life systems', why: 'Unsupported systems cannot be patched; several carriers exclude losses originating from them.', weight: 1 },
};

/** [question, answer] per control test; the first `ok` tests pass, the rest fail. */
interface ControlSeed {
  metric: string;
  tests: [string, string][];
  ok: number;
  lastOk: number;
  sources: string[];
  gapNote?: string;
  fix?: string;
}

const CONTROL_SEEDS: CustomerMap<Record<ControlId, ControlSeed>> = {
  maritime: {
    mfa: {
      metric: 'MFA 98.6% of 7,400 users, from Entra ID', ok: 3, lastOk: 2, sources: ['c-entra', 'c-cyberark'],
      tests: [
        ['Is MFA enforced for all email access, including mobile and webmail?', 'Yes. Conditional Access policy CA-001 enforces MFA for 98.6% of 7,400 users; the remaining 104 are workload identities with legacy auth blocked.'],
        ['Is MFA enforced for all remote access (VPN, VDI, RDP)?', 'Yes. 100% of GlobalProtect VPN and Citrix (Port Klang) sessions require MFA; no direct RDP exposed (HexaStrike ASM).'],
        ['Is MFA enforced for all privileged and administrative accounts?', 'Yes. 1,260 privileged accounts in CyberArk Privilege Cloud require MFA at check-out; Entra PIM for cloud roles.'],
      ],
    },
    edr: {
      metric: 'Defender XDR on 99.1% of 5,960 IT endpoints; HexaSOC 24×7', ok: 2, lastOk: 2, sources: ['c-defender', 'c-hexaot'],
      tests: [
        ['What percentage of endpoints and servers run EDR?', '99.1% of 5,960 IT endpoints and servers (Defender XDR). OT and vessel networks are monitored passively by HexaOT sensors.'],
        ['Is EDR monitored 24×7 with authority to contain?', 'Yes. HexaSOC MDR 24×7 with pre-approved isolation for IT assets; median time to contain 41 min.'],
      ],
    },
    backup: {
      metric: 'Immutable Veeam repos for TOS and SAP; last restore test 104 days ago', ok: 1, lastOk: 1, sources: ['c-veeam'],
      gapNote: 'Veeam connector degraded since the v12.2 upgrade (API field drift), so restore-test and isolation evidence is stale.',
      fix: 'Restore the Veeam connector and run an isolated restore test for Navis N4 and SAP; HexaView re-attests automatically.',
      tests: [
        ['Are backups immutable (WORM / object lock)?', 'Yes. Hardened Linux repositories with immutability for Navis N4 TOS, SAP S/4HANA and group file services.'],
        ['Are backups isolated from the production domain (separate credentials, offline or air-gapped copy)?', 'Partial. Separate credentials confirmed in June; current evidence is stale because the Veeam connector is degraded.'],
        ['Have you tested restoring critical systems in the last 90 days?', 'No current evidence. Last successful restore test of Navis N4 was 104 days ago.'],
      ],
    },
    pam: {
      metric: '1,260 privileged accounts vaulted; 100% OT vendor sessions recorded', ok: 2, lastOk: 1, sources: ['c-cyberark'],
      tests: [
        ['Are privileged credentials vaulted and rotated?', 'Yes. 1,260 privileged accounts in CyberArk Privilege Cloud, rotated every 24 h for Tier 0.'],
        ['Is third-party remote access to OT brokered and recorded?', 'Yes. Konecranes, Kongsberg and Vanderlande sessions are brokered via HPS-JUMP-OT01 and recorded (100% of 214 sessions in 90 days).'],
      ],
    },
    patch: {
      metric: 'Critical patch median 9 days; 2 KEV open on terminal gateways (23 days)', ok: 1, lastOk: 1, sources: ['c-tenable', 'c-defender', 'c-hexastrike'],
      gapNote: '2 CISA KEV vulnerabilities open on internet-facing gateways at Port Klang and Santos for 23 days; many wordings apply coinsurance after 30–45 days.',
      fix: 'Patch the two gateways and let HexaStrike re-test; the KEV question turns green on the next sync.',
      tests: [
        ['What is your patch window for critical vulnerabilities?', 'Median 9 days for critical CVSS ≥9 on IT assets over the last 90 days (Tenable, Defender TVM).'],
        ['Are any CISA KEV vulnerabilities open on internet-facing systems?', 'Yes, 2. citrix.pkl and the Santos gate gateway, open 23 days; compensating WAF rules in place.'],
      ],
    },
    email: {
      metric: 'Proofpoint sandbox on 100% of mailboxes; DMARC p=reject', ok: 2, lastOk: 2, sources: ['c-proofpoint'],
      tests: [
        ['Do you sandbox attachments and rewrite URLs on inbound email?', 'Yes. Proofpoint TAP on 100% of mailboxes, including vessel mailboxes via store-and-forward.'],
        ['Do you enforce DMARC and verify payment-detail changes out of band?', 'Yes. DMARC p=reject on 6 domains; finance call-back procedure for bunker and freight supplier bank changes.'],
      ],
    },
    ir: {
      metric: 'IR plan v4.2 tabletop 61 days ago (OT ransomware); HexaShield retainer', ok: 2, lastOk: 1, sources: ['c-hexacomply', 'c-servicenow'],
      tests: [
        ['Do you have a documented incident response plan tested in the last 12 months?', 'Yes. IR plan v4.2 with OT annex; executive tabletop (terminal ransomware) held 61 days ago.'],
        ['Do you have an incident response retainer?', 'Yes. HexaShield DFIR retainer, 120 hours, 1-hour response SLA, on the carrier panel.'],
      ],
    },
    logging: {
      metric: '412 live Sentinel detections; 400-day immutable retention', ok: 2, lastOk: 2, sources: ['c-sentinel'],
      tests: [
        ['Are security logs centralised and retained for at least 12 months?', 'Yes. Microsoft Sentinel, 90 days hot and 400 days immutable archive.'],
        ['Are logs protected from tampering?', 'Yes. Immutable archive tier and HexaView hash-anchored audit ledger.'],
      ],
    },
    tprm: {
      metric: '148 vendors assessed; 9 high-risk with remediation plans', ok: 2, lastOk: 1, sources: ['c-hexacomply', 'c-cyberark'],
      tests: [
        ['Do you assess the security of critical vendors?', 'Yes. 148 vendors in HexaComply TPRM; tier 1 assessed annually, 9 high-risk on remediation plans.'],
        ['Is vendor access time-bound and monitored?', 'Yes. OT vendor access via PAM jump host with approval per session.'],
      ],
    },
    seg: {
      metric: 'Level 3.5 DMZ at 3 of 4 terminals; Port Klang crane network flat', ok: 1, lastOk: 0, sources: ['c-dragos', 'c-hexaot', 'c-paloalto'],
      gapNote: 'Port Klang crane VLAN still shares a flat layer 2 with terminal office IT; HexaOT feed from Port Klang is delayed.',
      fix: 'Complete the Port Klang Level 3.5 DMZ (change CHG-4471) and restore the delayed sensor feed.',
      tests: [
        ['Is OT separated from IT by a DMZ with deny-by-default rules?', 'Yes at Maasvlakte, Antwerp and Santos (Panorama zones, Dragos-validated conduits).'],
        ['Is segmentation in place at every operational site?', 'No. Port Klang crane network is in remediation; target date 6 weeks.'],
      ],
    },
    awareness: {
      metric: 'Training completion 96%; phish click rate 4.1%', ok: 2, lastOk: 2, sources: ['c-proofpoint', 'c-hexacomply'],
      tests: [
        ['What is your annual security training completion rate?', '96% of shore staff; 88% of seafarers (completed on board, synced at port).'],
        ['Do you run phishing simulations?', 'Yes. Quarterly; latest click rate 4.1% (down from 7.9%).'],
      ],
    },
    eol: {
      metric: '41 EOL IT hosts (none internet-facing); 9 vessels on Windows 7 ECDIS', ok: 1, lastOk: 1, sources: ['c-defender', 'c-tenable', 'c-hexaot'],
      gapNote: '9 vessels run ECDIS on Windows 7 Embedded; the OEM upgrade is tied to dry-dock windows.',
      fix: 'Schedule the ECDIS upgrade at the next 4 dry-docks and document compensating controls in the pack.',
      tests: [
        ['Do you maintain an inventory of end-of-life systems?', 'Yes. 41 EOL IT hosts tracked in Defender TVM and ServiceNow CMDB; none internet-facing.'],
        ['Are all EOL systems isolated or under extended support?', 'No. 9 vessel ECDIS units on Windows 7 Embedded with USB control only; upgrade at dry-dock.'],
      ],
    },
  },
  finserv: {
    mfa: {
      metric: 'Phishing-resistant MFA for 99.4% of 18,200 users, from Okta', ok: 3, lastOk: 2, sources: ['c-okta', 'c-entra'],
      tests: [
        ['Is MFA enforced for all email access?', 'Yes. FIDO2 / Okta FastPass for 99.4% of 18,200 users; SMS and voice factors disabled.'],
        ['Is MFA enforced for all remote access?', 'Yes. 100% of Zscaler ZPA sessions require device posture and phishing-resistant MFA.'],
        ['Is MFA enforced for all privileged accounts?', 'Yes. 100% of CyberArk and Entra PIM privileged elevation requires FIDO2.'],
      ],
    },
    edr: {
      metric: 'Falcon on 99.7% of 31,400 endpoints and servers; HexaSOC 24×7', ok: 2, lastOk: 2, sources: ['c-crowdstrike'],
      tests: [
        ['What percentage of endpoints and servers run EDR?', '99.7% of 31,400 endpoints and servers (CrowdStrike Falcon) with tamper protection on.'],
        ['Is EDR monitored 24×7 with authority to contain?', 'Yes. HexaSOC MDR 24×7; median time to contain 33 min.'],
      ],
    },
    backup: {
      metric: 'Rubrik immutable backups; restore test 12 days ago, RTO 3 h 40 m vs 4 h tolerance', ok: 3, lastOk: 3, sources: ['c-veeam'],
      tests: [
        ['Are backups immutable?', 'Yes. Rubrik Security Cloud SLA Gold with retention lock for T24, card switch and mainframe exports.'],
        ['Are backups isolated from the production domain?', 'Yes. Separate identity plane and cyber vault in a separate Azure tenant.'],
        ['Have you tested restoring critical systems within impact tolerance?', 'Yes. T24 restore test 12 days ago: 3 h 40 m against a 4 h impact tolerance (FCA SYSC 15A).'],
      ],
    },
    pam: {
      metric: 'CyberArk JIT for Tier 0; 14 standing Tier 0 admin accounts open', ok: 1, lastOk: 0, sources: ['c-cyberark', 'c-sailpoint'],
      gapNote: '14 standing Tier 0 admin accounts surfaced by CyberArk and SailPoint have not moved to just-in-time access.',
      fix: 'Retire or convert the 14 standing Tier 0 accounts to JIT; HexaView re-attests on the next SailPoint sync.',
      tests: [
        ['Are privileged credentials vaulted, rotated and session-recorded?', 'Yes. CyberArk PAM vaults 4,820 privileged accounts with session recording for Tier 0 and SWIFT.'],
        ['Have you eliminated standing domain or Tier 0 admin rights?', 'No. 14 standing Tier 0 admin accounts remain; conversion to JIT planned this quarter.'],
      ],
    },
    patch: {
      metric: 'Critical external fixes median 4.2 days; KEV 48 h SLA met 100%', ok: 2, lastOk: 2, sources: ['c-qualys', 'c-hexastrike'],
      tests: [
        ['What is your patch window for critical vulnerabilities?', 'Median 4.2 days for internet-facing critical (Qualys TruRisk ≥ 850).'],
        ['Are any CISA KEV vulnerabilities open on internet-facing systems?', 'None. 100% of KEV fixed within the 48 h SLA in the last 12 months, validated by HexaStrike.'],
      ],
    },
    email: {
      metric: 'DMARC p=reject on 41 domains; payment-fraud rules on finance mailboxes', ok: 2, lastOk: 2, sources: ['c-proofpoint'],
      tests: [
        ['Do you sandbox attachments and rewrite URLs?', 'Yes. Proofpoint TAP on 100% of mailboxes, with VIP and VAP protection for 26 executives.'],
        ['Do you verify payment instructions and supplier bank changes out of band?', 'Yes. Dual control and call-back for treasury and supplier changes; Proofpoint impostor rules on finance.'],
      ],
    },
    ir: {
      metric: 'DORA major-incident playbook tested 34 days ago; TLPT completed', ok: 2, lastOk: 1, sources: ['c-servicenow', 'c-hexastrike'],
      tests: [
        ['Do you have an incident response plan tested in the last 12 months?', 'Yes. DORA major ICT incident playbook exercised 34 days ago with the Executive Committee.'],
        ['Have you completed threat-led penetration testing?', 'Yes. TLPT (TIBER-EU aligned) completed by HexaStrike; 3 findings remediated.'],
      ],
    },
    logging: {
      metric: '986 Splunk ES detections; 13-month retention', ok: 2, lastOk: 2, sources: ['c-splunk'],
      tests: [
        ['Are security logs centralised and retained for at least 12 months?', 'Yes. Splunk ES, 13 months (PCI 10.5.1, DORA Art. 10).'],
        ['Are logs reviewed daily and protected from tampering?', 'Yes. Automated daily review by HexaSOC; SmartStore with object lock.'],
      ],
    },
    tprm: {
      metric: '412 ICT providers in DORA Register; exit plans missing for 3 critical providers', ok: 1, lastOk: 1, sources: ['c-bitsight', 'c-hexacomply'],
      gapNote: 'DORA Art. 28 exit plans are missing for 3 critical ICT providers, including the primary cloud region.',
      fix: 'Complete exit plans for the 3 critical providers and attach them to the DORA Register of Information.',
      tests: [
        ['Do you maintain a register of ICT third parties with continuous ratings?', 'Yes. 412 providers in the DORA Register of Information; BitSight ratings refreshed daily.'],
        ['Do you have tested exit and substitution plans for critical providers?', 'Partial. Exit plans missing for 3 of 11 critical ICT providers.'],
      ],
    },
    seg: {
      metric: 'SWIFT secure zone and CDE segmented; DC BMS isolated', ok: 2, lastOk: 2, sources: ['c-swift', 'c-zscaler', 'c-facilities'],
      tests: [
        ['Are SWIFT and the cardholder data environment segregated?', 'Yes. SWIFT secure zone (CSCF 1.1) and CDE segmentation validated by HexaStrike every 6 months.'],
        ['Are data-centre facility systems (BMS) separated from IT?', 'Yes. EcoStruxure BMS isolated; monitored read-only by policy.'],
      ],
    },
    awareness: {
      metric: 'Monthly phishing simulations; click rate 2.3%; treasury BEC drills', ok: 2, lastOk: 2, sources: ['c-proofpoint'],
      tests: [
        ['What is your annual security training completion rate?', '99% of staff, tracked for the SM&CR annual attestation.'],
        ['Do you run phishing and payment-fraud simulations?', 'Yes. Monthly; click rate 2.3%. Quarterly BEC drills for treasury and finance.'],
      ],
    },
    eol: {
      metric: 'No EOL internet-facing systems; z/OS 3.1 in support', ok: 2, lastOk: 2, sources: ['c-qualys', 'c-mainframe'],
      tests: [
        ['Do you maintain an inventory of end-of-life systems?', 'Yes. Qualys tracks 22 EOL internal hosts, all with extended support.'],
        ['Are any EOL systems internet-facing?', 'None. Mainframe z/OS 3.1 is in vendor support.'],
      ],
    },
  },
  media: {
    mfa: {
      metric: 'Okta MFA for 97.8% of 3,100 users; 22 freelancer NEXIS accounts without MFA', ok: 2, lastOk: 2, sources: ['c-okta', 'c-gws'],
      gapNote: '22 freelancer accounts on Avid NEXIS and the dailies platform use local credentials without MFA.',
      fix: 'Federate the freelancer accounts through Okta with MFA, or disable them after the Nightjar lock.',
      tests: [
        ['Is MFA enforced for all email access?', 'Yes. Google Workspace with Okta MFA for 97.8% of 3,100 users.'],
        ['Is MFA enforced for all remote access?', 'Yes. Cloudflare Zero Trust requires Okta MFA for all remote edit and review sessions.'],
        ['Is MFA enforced for all privileged and content-system accounts?', 'No. 22 freelancer accounts on Avid NEXIS and the dailies platform lack MFA.'],
      ],
    },
    edr: {
      metric: 'SentinelOne on 98.9% of workstations, render and storage nodes', ok: 2, lastOk: 2, sources: ['c-s1'],
      tests: [
        ['What percentage of endpoints and servers run EDR?', '98.9% of workstations, render nodes and storage gateways (SentinelOne).'],
        ['Is EDR monitored 24×7 with authority to contain?', 'Yes. HexaSOC MDR 24×7; median time to contain 52 min.'],
      ],
    },
    backup: {
      metric: 'No backup connector; manual evidence 41 days old; S3 Object Lock on masters', ok: 1, lastOk: 2, sources: ['c-awssh', 'c-hexacomply'],
      gapNote: 'No backup tool is connected, so isolation and restore evidence is a manual upload from 41 days ago. Insurers weight this heavily for post-production ransomware.',
      fix: 'Connect the backup platform for NEXIS and project files, and run a tested restore of an active title.',
      tests: [
        ['Are backups immutable?', 'Yes for pre-release masters (S3 Object Lock, compliance mode). Avid NEXIS project backups are not immutable.'],
        ['Are backups isolated from the production domain?', 'Unknown. Manual attestation 41 days old; no connector to verify.'],
        ['Have you tested restoring critical systems in the last 90 days?', 'No current evidence for NEXIS or the render farm.'],
      ],
    },
    pam: {
      metric: 'Okta privileged access + AWS IAM Identity Center JIT', ok: 2, lastOk: 1, sources: ['c-okta', 'c-awssh'],
      tests: [
        ['Are privileged credentials vaulted and time-bound?', 'Yes. Okta Privileged Access for servers; AWS IAM Identity Center JIT for the content vault.'],
        ['Is privileged activity logged and reviewed?', 'Yes. Google SecOps alerting on vault admin actions; reviewed weekly.'],
      ],
    },
    patch: {
      metric: 'Critical patch median 24 days; 3 critical findings on screeners portal', ok: 1, lastOk: 1, sources: ['c-tenable', 'c-hexastrike'],
      gapNote: '3 critical findings (review-link auth bypass) are open on screeners.kestrelpictures.com.',
      fix: 'Fix the screener portal auth bypass and deploy the staged Cloudflare WAF rule; HexaStrike re-tests automatically.',
      tests: [
        ['What is your patch window for critical vulnerabilities?', 'Median 24 days across 296 external assets (Tenable).'],
        ['Are any critical or KEV vulnerabilities open on internet-facing systems?', 'Yes. 3 critical findings on screeners.kestrelpictures.com (auth bypass on review links).'],
      ],
    },
    email: {
      metric: 'Workspace advanced phishing; DMARC p=quarantine', ok: 2, lastOk: 2, sources: ['c-gws', 'c-cloudflare'],
      tests: [
        ['Do you sandbox attachments and rewrite URLs?', 'Yes. Google Workspace security sandbox and Cloudflare Area 1 link isolation.'],
        ['Do you verify payment-detail changes out of band?', 'Yes. Production accounting call-back for vendor bank changes above $10k.'],
      ],
    },
    ir: {
      metric: 'Leak response and ransomware playbooks tested 88 days ago', ok: 2, lastOk: 2, sources: ['c-jira', 'c-hexacomply'],
      tests: [
        ['Do you have an incident response plan tested in the last 12 months?', 'Yes. Pre-release leak and post-production ransomware tabletop 88 days ago.'],
        ['Do you have an incident response retainer?', 'Yes. HexaShield DFIR retainer with leak takedown support.'],
      ],
    },
    logging: {
      metric: 'Google SecOps 12-month retention; MAM, NEXIS and S3 access logged', ok: 2, lastOk: 2, sources: ['c-secops'],
      tests: [
        ['Are security logs centralised and retained for at least 12 months?', 'Yes. Google SecOps, 12 months.'],
        ['Is access to pre-release content logged?', 'Yes. MAM, NEXIS and S3 vault access logged; HexaCustody records every hand-off.'],
      ],
    },
    tprm: {
      metric: '63 vendors in chain; 51 TPN Gold; Red Fern rated 58 with 2 untracked copies', ok: 1, lastOk: 1, sources: ['c-hexacustody', 'c-hexacomply'],
      gapNote: 'Red Fern Localisation (rating 58) produced 2 untracked copies last week; custody agents not enforced there.',
      fix: 'Enforce HexaCustody agents at Red Fern and Apex Trailer House before the next locked-cut hand-off.',
      tests: [
        ['Do you assess vendors before they receive sensitive content?', 'Yes. TPN assessment required; 51 of 63 vendors hold TPN Gold Shield.'],
        ['Is content held by vendors tracked and revocable?', 'Partial. HexaCustody covers 61 of 63 vendors; Red Fern and Apex not enforced.'],
      ],
    },
    seg: {
      metric: 'Isolated content network enforced; Atlanta ST 2110 monitoring degraded', ok: 1, lastOk: 1, sources: ['c-cloudflare', 'c-netskope', 'c-hexaot'],
      gapNote: 'HexaOT broadcast sensors at Atlanta are degraded (agent upgrade pending), so playout network evidence is incomplete.',
      fix: 'Upgrade the Atlanta broadcast edge agent and restore PTP timing telemetry.',
      tests: [
        ['Is the content network isolated from the internet and corporate IT?', 'Yes. Edit bays on an isolated content network (MPA DS-1.0), egress via Netskope only.'],
        ['Is the broadcast / playout network separated and monitored?', 'Partial. Separated, but HexaOT monitoring is degraded at Atlanta.'],
      ],
    },
    awareness: {
      metric: 'Stale: KnowBe4 paused; last phish-prone 6.8%', ok: 0, lastOk: 2, sources: ['c-knowbe4'],
      gapNote: 'The KnowBe4 connector is paused for API key rotation, so training and phishing evidence is stale.',
      fix: 'Rotate the KnowBe4 API key; completion and phish-prone figures refresh on the next sync.',
      tests: [
        ['What is your annual security training completion rate?', 'Unknown. KnowBe4 connector paused; last value 91% (stale).'],
        ['Do you run phishing simulations?', 'Unknown. Last phish-prone rate 6.8% (stale); freelancers not enrolled.'],
      ],
    },
    eol: {
      metric: '6 EOL macOS edit bays isolated on the content VLAN', ok: 2, lastOk: 1, sources: ['c-s1', 'c-tenable'],
      tests: [
        ['Do you maintain an inventory of end-of-life systems?', 'Yes. 6 EOL macOS edit bays (certified Avid builds) tracked in Tenable.'],
        ['Are EOL systems isolated?', 'Yes. Isolated on the content VLAN, no internet egress.'],
      ],
    },
  },
  healthcare: {
    mfa: {
      metric: 'MFA 97.2% of 21,500 workforce; 214 help-desk reset-eligible accounts on push only', ok: 2, lastOk: 2, sources: ['c-entra', 'c-imprivata'],
      gapNote: '214 accounts can have MFA reset by the service desk on a phone call with knowledge-based checks only, the pattern Scattered Spider used against health systems.',
      fix: 'Require video or in-person verification for help-desk MFA resets and move the 214 accounts to phishing-resistant methods.',
      tests: [
        ['Is MFA enforced for all email access, including mobile and webmail?', 'Yes. Entra Conditional Access enforces MFA for 97.2% of 21,500 users; clinical shared workstations use Imprivata badge-tap plus PIN.'],
        ['Is MFA enforced for all remote access (VPN, Citrix, Epic Hyperdrive remote)?', 'Yes. 100% of Citrix and VPN sessions require MFA, including 1,900 affiliated physicians.'],
        ['Is the MFA reset process resistant to social engineering?', 'No. 214 privileged and finance accounts can be reset by the service desk on a phone call; verification is knowledge-based only.'],
      ],
    },
    edr: {
      metric: 'Falcon on 98.8% of 18,400 endpoints and servers; HexaSOC 24×7', ok: 2, lastOk: 2, sources: ['c-crowdstrike', 'c-claroty'],
      tests: [
        ['What percentage of endpoints and servers run EDR?', '98.8% of 18,400 endpoints and servers (CrowdStrike Falcon). 14,600 medical devices are monitored passively by Claroty xDome and HexaOT, never with agents.'],
        ['Is EDR monitored 24×7 with authority to contain?', 'Yes. HexaSOC MDR 24×7; isolation pre-approved for IT assets, never for clinical devices. Median time to contain 44 min.'],
      ],
    },
    backup: {
      metric: 'Cohesity immutable for Epic and PACS; Epic downtime restore test 47 days ago (RTO 9 h vs 6 h target)', ok: 2, lastOk: 2, sources: ['c-cohesity', 'c-epic'],
      gapNote: 'The last Epic Chronicles restore test took 9 h against the 6 h clinical recovery objective; hospitals would run on downtime procedures longer than planned.',
      fix: 'Pre-stage the Epic ODB restore on the clean-room cluster and re-run the test; HexaView re-attests from Cohesity on the next sync.',
      tests: [
        ['Are backups immutable (WORM / object lock)?', 'Yes. Cohesity DataProtect with DataLock for Epic Chronicles, Clarity, PACS and the lab system.'],
        ['Are backups isolated from the production domain?', 'Yes. Separate Cohesity admin domain with quorum approval and a FortKnox vault copy.'],
        ['Have you restored critical clinical systems within the recovery objective?', 'No. Epic restore test 47 days ago completed in 9 h against a 6 h objective.'],
      ],
    },
    pam: {
      metric: 'CyberArk vaults 2,100 privileged accounts; 38 biomed vendor accounts still standing', ok: 1, lastOk: 1, sources: ['c-cyberark', 'c-imprivata'],
      gapNote: '38 medical-device vendor service accounts (GE, Philips, BD) have standing remote access outside CyberArk session brokering.',
      fix: 'Broker the 38 OEM accounts through CyberArk Vendor PAM with per-session approval; HexaView re-attests when sessions appear in CyberArk.',
      tests: [
        ['Are privileged credentials vaulted and rotated?', 'Yes. 2,100 privileged accounts in CyberArk Privilege Cloud, Tier 0 rotated every 24 h.'],
        ['Is third-party remote access to medical devices brokered and recorded?', 'No. 38 OEM service accounts connect over legacy site-to-site VPNs without session recording.'],
      ],
    },
    patch: {
      metric: 'Critical IT patch median 11 days; 2 KEV on Citrix NetScaler at community hospitals (19 days)', ok: 1, lastOk: 1, sources: ['c-insightvm', 'c-crowdstrike', 'c-hexastrike'],
      gapNote: '2 CISA KEV vulnerabilities are open on the community-hospital NetScaler gateways for 19 days; the unpatched-vulnerability clause applies coinsurance at 45 days.',
      fix: 'Patch the Zanesville and Marion NetScalers in the next downtime window and terminate sessions; HexaStrike re-tests automatically.',
      tests: [
        ['What is your patch window for critical vulnerabilities?', 'Median 11 days for IT assets (InsightVM). Medical devices follow FDA-cleared OEM patch schedules.'],
        ['Are any CISA KEV vulnerabilities open on internet-facing systems?', 'Yes, 2. NetScaler gateways at Zanesville and Marion, open 19 days; WAF signatures applied.'],
      ],
    },
    email: {
      metric: 'Mimecast on 100% of mailboxes; DMARC p=reject; payroll diversion rules', ok: 2, lastOk: 2, sources: ['c-mimecast'],
      tests: [
        ['Do you sandbox attachments and rewrite URLs on inbound email?', 'Yes. Mimecast Targeted Threat Protection on 100% of mailboxes, including affiliated physicians.'],
        ['Do you verify payroll and supplier bank changes out of band?', 'Yes. Call-back for supplier changes and a 72 h hold on direct-deposit changes after the 2024 payroll diversion attempts.'],
      ],
    },
    ir: {
      metric: 'Ransomware-with-diversion tabletop 38 days ago; downtime procedures drilled per unit', ok: 2, lastOk: 2, sources: ['c-hexacomply', 'c-servicenow'],
      tests: [
        ['Do you have an IR plan tested in the last 12 months?', 'Yes. Ransomware with ED diversion tabletop 38 days ago with the CNO, CMIO and incident command (HICS).'],
        ['Do you have an incident response retainer?', 'Yes. HexaShield DFIR retainer, 160 hours, on the Beazley panel; clinical downtime support included.'],
      ],
    },
    logging: {
      metric: '604 Sentinel detections; 400-day retention; Epic break-the-glass audit via Clarity', ok: 2, lastOk: 2, sources: ['c-sentinel', 'c-fairwarning'],
      tests: [
        ['Are security logs centralised and retained for at least 12 months?', 'Yes. Microsoft Sentinel, 90 days hot and 400 days archive (HIPAA 164.312(b)).'],
        ['Is access to ePHI monitored for inappropriate use?', 'Yes. Imprivata FairWarning reviews Epic access daily; VIP and employee-record access alerts within 1 h.'],
      ],
    },
    tprm: {
      metric: '286 vendors with BAAs; clearinghouse single point of failure (Change Healthcare)', ok: 1, lastOk: 0, sources: ['c-hexacomply', 'c-servicenow'],
      gapNote: '92% of claims flow through one clearinghouse; no tested alternate submission route exists, so a 2024-style outage stops cash flow.',
      fix: 'Contract and test a secondary clearinghouse route for the top 5 payers; attach the test record to the TPRM control.',
      tests: [
        ['Do you hold BAAs and assess critical vendors?', 'Yes. 286 vendors with signed BAAs in HexaComply; tier 1 reassessed annually.'],
        ['Do you have a tested alternative for critical revenue-cycle vendors?', 'No. 92% of claims route through Change Healthcare (Optum); alternate route not yet tested.'],
      ],
    },
    seg: {
      metric: 'Medical devices segmented at the Medical Center; 1,140 still flat at community hospitals', ok: 1, lastOk: 1, sources: ['c-claroty', 'c-hexaot'],
      gapNote: '1,140 infusion pumps, imaging workstations and monitors at the community hospitals share a flat clinical VLAN with user workstations; the HexaOT Marion feed is delayed.',
      fix: 'Apply Claroty-derived segmentation policies at Zanesville, Marion and Chillicothe and restore the Marion sensor feed.',
      tests: [
        ['Are medical devices separated from the general network?', 'Yes at the Medical Center and Children\'s: 14 device zones with deny-by-default policies validated by Claroty.'],
        ['Is segmentation in place at every hospital?', 'No. 1,140 devices at the 3 community hospitals remain on a flat clinical VLAN.'],
      ],
    },
    awareness: {
      metric: 'Training completion 94%; phish click rate 5.2% (clinical staff 7.1%)', ok: 2, lastOk: 2, sources: ['c-mimecast', 'c-hexacomply'],
      tests: [
        ['What is your annual security training completion rate?', '94% of workforce including residents; HIPAA privacy and security modules combined.'],
        ['Do you run phishing simulations?', 'Yes. Monthly; click rate 5.2% overall, 7.1% among night-shift clinical staff.'],
      ],
    },
    eol: {
      metric: '312 EOL Windows 7 / XP imaging and lab workstations (FDA-cleared, cannot patch)', ok: 1, lastOk: 1, sources: ['c-claroty', 'c-insightvm'],
      gapNote: '312 FDA-cleared imaging and lab workstations run Windows 7 or XP; the OEMs have not validated upgrades.',
      fix: 'Document compensating controls (micro-segmentation, allow-listing) per device class in the pack and set OEM upgrade dates.',
      tests: [
        ['Do you maintain an inventory of end-of-life systems?', 'Yes. Claroty xDome and InsightVM track 312 EOL clinical workstations and 41 EOL servers.'],
        ['Are all EOL systems isolated or under extended support?', 'No. 118 of the 312 still sit on the flat community-hospital VLAN.'],
      ],
    },
  },
  automotive: {
    mfa: {
      metric: 'Phishing-resistant MFA for 96% of 64,000 users; FIDO2 for all plant engineers', ok: 3, lastOk: 2, sources: ['c-entra', 'c-beyondtrust'],
      tests: [
        ['Is MFA enforced for all email access?', 'Yes. Entra Conditional Access with Windows Hello or FIDO2 for 96% of users; remaining 4% on number-match push.'],
        ['Is MFA enforced for all remote access, including supplier and dealer portals?', 'Yes. Zscaler ZPA and the dealer portal require MFA for all 1,140 dealers and 640 suppliers.'],
        ['Is MFA enforced for privileged and OTA signing accounts?', 'Yes. Entra PIM with FIDO2; OTA signing ceremonies require two hardware tokens (R156).'],
      ],
    },
    edr: {
      metric: 'Defender XDR on 99.2% of 58,900 IT endpoints; vSOC on 2.1M vehicles', ok: 2, lastOk: 2, sources: ['c-defender', 'c-upstream', 'c-armis'],
      tests: [
        ['What percentage of endpoints and servers run EDR?', '99.2% of 58,900 IT endpoints and servers. Plant OT monitored passively by Armis and HexaOT; vehicles by the Upstream vSOC.'],
        ['Is EDR monitored 24×7 with authority to contain?', 'Yes. HexaSOC MDR 24×7 with the Cyber Defence Center; median time to contain 37 min.'],
      ],
    },
    backup: {
      metric: 'Rubrik immutable for SAP, MES and PLC projects; plant restore test 21 days ago', ok: 3, lastOk: 3, sources: ['c-rubrik'],
      tests: [
        ['Are backups immutable?', 'Yes. Rubrik retention lock for SAP S/4HANA, MES, Teamcenter and 4,800 PLC project files.'],
        ['Are backups isolated from the production domain?', 'Yes. Separate Rubrik identity plane; the battery plant keeps an offline copy on site.'],
        ['Have you tested restoring production systems?', 'Yes. Ingolstadt MES restore test 21 days ago: line restart in 7 h 20 m against 8 h tolerance.'],
      ],
    },
    pam: {
      metric: 'BeyondTrust brokers 6,300 vendor sessions; 41 robot-OEM accounts with standing access', ok: 1, lastOk: 1, sources: ['c-beyondtrust', 'c-entra'],
      gapNote: '41 KUKA and Dürr service accounts keep standing jump-item access to body-shop and paint cells instead of per-session approval.',
      fix: 'Switch the 41 robot-OEM jump items to approval-required sessions in BeyondTrust; HexaView re-attests from session logs.',
      tests: [
        ['Are privileged credentials vaulted and session-recorded?', 'Yes. BeyondTrust PRA records 100% of 6,300 vendor sessions in 90 days.'],
        ['Is vendor access to OT approved per session?', 'No. 41 robot-OEM accounts have standing access to body-shop and paint cells.'],
      ],
    },
    patch: {
      metric: 'Critical IT patch median 8 days; 1 KEV on the dealer VPN (12 days)', ok: 1, lastOk: 1, sources: ['c-qualys', 'c-hexastrike'],
      gapNote: '1 CISA KEV vulnerability is open on the dealer VPN concentrator for 12 days.',
      fix: 'Patch the dealer VPN concentrator and rotate dealer session tokens; HexaStrike re-tests automatically.',
      tests: [
        ['What is your patch window for critical vulnerabilities?', 'Median 8 days for internet-facing critical (Qualys TruRisk ≥ 850).'],
        ['Are any CISA KEV vulnerabilities open on internet-facing systems?', 'Yes, 1. dealer VPN concentrator, open 12 days; virtual patch on Zscaler.'],
      ],
    },
    email: {
      metric: 'Proofpoint on 100% of mailboxes; supplier bank-change verification', ok: 2, lastOk: 2, sources: ['c-proofpoint', 'c-sap'],
      tests: [
        ['Do you sandbox attachments and rewrite URLs?', 'Yes. Proofpoint TAP on 100% of mailboxes; VAP protection for 22 executives.'],
        ['Do you verify supplier bank changes out of band?', 'Yes. SAP supplier-master changes require call-back and four-eyes approval; SAP ETD alerts on bypass.'],
      ],
    },
    ir: {
      metric: 'Plant ransomware and vehicle fleet incident exercises in the last 90 days', ok: 2, lastOk: 2, sources: ['c-hexacomply', 'c-servicenow', 'c-upstream'],
      tests: [
        ['Do you have an incident response plan tested in the last 12 months?', 'Yes. Plant-wide ransomware exercise (Ingolstadt) 52 days ago; vehicle fleet incident drill with the vSOC 80 days ago (R155 7.2.2.4).'],
        ['Do you have an incident response retainer?', 'Yes. HexaShield DFIR retainer, 400 hours, on the Allianz panel; OT recovery partner pre-approved.'],
      ],
    },
    logging: {
      metric: '1,124 detections in QRadar; 13-month retention; vehicle events in the vSOC', ok: 2, lastOk: 2, sources: ['c-qradar', 'c-upstream'],
      tests: [
        ['Are security logs centralised and retained for at least 12 months?', 'Yes. QRadar, 13 months; vehicle security events retained 3 years for R155 monitoring.'],
        ['Are logs protected from tampering?', 'Yes. Immutable archive and the HexaView hash-anchored ledger; air-gapped plant logs arrive as signed bundles.'],
      ],
    },
    tprm: {
      metric: '640 suppliers rated; 21 high-risk; DealerCore DMS rated 59', ok: 1, lastOk: 1, sources: ['c-scorecard', 'c-hexacomply'],
      gapNote: 'DealerCore DMS (1,140 dealers) is rated 59 and a 2024-style dealer SaaS outage would stop vehicle sales and service; 6 tier-1 suppliers lack ransomware recovery evidence.',
      fix: 'Agree recovery commitments with DealerCore and obtain recovery evidence from the 6 just-in-sequence suppliers.',
      tests: [
        ['Do you rate and assess critical suppliers (TISAX labels)?', 'Yes. 640 suppliers rated by SecurityScorecard; 412 hold TISAX labels.'],
        ['Do critical suppliers provide tested recovery plans?', 'Partial. 6 of 31 just-in-sequence suppliers and DealerCore have not provided recovery evidence.'],
      ],
    },
    seg: {
      metric: 'Level 3.5 DMZ at 3 plants; air-gapped battery plant; 3 IT-to-OT conduits at Puebla', ok: 1, lastOk: 1, sources: ['c-armis', 'c-hexaot', 'c-zscaler'],
      gapNote: '3 IT-to-OT conduits at Puebla bypass the Level 3.5 DMZ and the Puebla edge agent is two versions behind.',
      fix: 'Close the 3 Puebla conduits (change CHG-91822) and upgrade the Puebla data plane.',
      tests: [
        ['Is OT separated from IT by a DMZ with deny-by-default rules?', 'Yes at Ingolstadt and Győr; the battery plant is fully air-gapped with a data diode.'],
        ['Is segmentation in place at every plant?', 'No. 3 conduits at Puebla bypass the DMZ; remediation in 5 weeks.'],
      ],
    },
    awareness: {
      metric: 'Training completion 92%; phish click rate 3.4%', ok: 2, lastOk: 2, sources: ['c-proofpoint', 'c-hexacomply'],
      tests: [
        ['What is your annual security training completion rate?', '92% of office staff; shop-floor staff trained in shift briefings (78%).'],
        ['Do you run phishing simulations?', 'Yes. Quarterly; click rate 3.4% (down from 6.0%).'],
      ],
    },
    eol: {
      metric: '230 EOL HMIs and test benches on Windows 7 / XP across plants', ok: 1, lastOk: 1, sources: ['c-armis', 'c-qualys'],
      gapNote: '230 HMIs and end-of-line test benches run Windows 7 or XP; replacement follows model-year retooling.',
      fix: 'Document allow-listing and segmentation per cell and schedule replacement with retooling.',
      tests: [
        ['Do you maintain an inventory of end-of-life systems?', 'Yes. Armis and Qualys track 230 EOL OT hosts and 57 EOL IT hosts.'],
        ['Are all EOL systems isolated?', 'No. 34 EOL HMIs at Puebla sit behind the conduits that bypass the DMZ.'],
      ],
    },
  },
};

export const CONTROL_STATUS_COLOR: Record<ControlStatus, string> = {
  attested: 'var(--good)',
  partial: 'var(--sev-medium)',
  gap: 'var(--bad)',
};

function statusOf(ok: number, total: number): ControlStatus {
  return ok >= total ? 'attested' : ok === 0 ? 'gap' : 'partial';
}

const SHORT_NAMES: Record<string, string> = {
  'c-mainframe': 'Mainframe RACF', 'c-swift': 'SWIFT Alliance', 'c-facilities': 'EcoStruxure BMS', 'c-hexaot': 'HexaOT',
  'c-hexacustody': 'HexaCustody', 'c-awssh': 'AWS Security Hub', 'c-paloalto': 'Panorama', 'c-secops': 'Google SecOps', 'c-gws': 'Google Workspace',
};
function shortName(k: Connector): string {
  if (SHORT_NAMES[k.id]) return SHORT_NAMES[k.id];
  if (['Generic', 'HexaShield', 'Microsoft', 'Google'].includes(k.vendor)) return k.product;
  return k.vendor;
}

export function sourceRef(c: CustomerProfile, id: string): SourceRef | null {
  const k: Connector | undefined = c.connectors.find((x) => x.id === id);
  if (!k) return null;
  return { id: k.id, name: shortName(k), status: k.status, lastSyncMin: k.lastSyncMin, stale: isStale(k) || k.status === 'paused' };
}

export function keyControls(c: CustomerProfile): KeyControl[] {
  const r = rng(`ins-controls-${c.id}`);
  const seeds = forCustomer(CONTROL_SEEDS, c);
  return (Object.keys(CONTROL_META) as ControlId[]).map((id) => {
    const s = seeds[id];
    const meta = CONTROL_META[id];
    const tests: ControlTest[] = s.tests.map(([q, a], i) => ({ id: `${id.toUpperCase()}-${i + 1}`, q, a, ok: i < s.ok, evidenceRef: `EV-${r.int(10000, 99999)}` }));
    return {
      id, ...meta, metric: s.metric, tests, ok: s.ok, lastOk: s.lastOk,
      status: statusOf(s.ok, tests.length), lastStatus: statusOf(s.lastOk, tests.length),
      sources: s.sources.map((x) => sourceRef(c, x)).filter((x): x is SourceRef => !!x),
      gapNote: s.gapNote, fix: s.fix,
    };
  });
}

/* =====================================================================
   Insurability profile, premium drivers and renewal comparison
   ===================================================================== */
export interface PremiumDriver {
  label: string;
  pts: number;
  kind: 'market' | 'control' | 'history';
  controlId?: ControlId;
  fixable?: boolean;
}

const DRIVERS: CustomerMap<PremiumDriver[]> = {
  maritime: [
    { label: 'Market: marine and CNI cyber rates', pts: 2.5, kind: 'market' },
    { label: 'MFA fully attested (email, remote, privileged)', pts: -3, kind: 'control', controlId: 'mfa' },
    { label: 'EDR with HexaSOC 24×7 response', pts: -2.5, kind: 'control', controlId: 'edr' },
    { label: 'OT vendor access brokered via PAM', pts: -1.5, kind: 'control', controlId: 'pam' },
    { label: 'IR plan tested with OT annex; panel retainer', pts: -2, kind: 'control', controlId: 'ir' },
    { label: 'Backup restore evidence stale (Veeam)', pts: 1.5, kind: 'control', controlId: 'backup', fixable: true },
    { label: '2 KEV open on terminal gateways', pts: 1, kind: 'control', controlId: 'patch', fixable: true },
    { label: 'Port Klang OT segmentation incomplete', pts: 0.5, kind: 'control', controlId: 'seg', fixable: true },
    { label: 'No claims above retention for 3 years', pts: -2.5, kind: 'history' },
  ],
  finserv: [
    { label: 'Market: financial institutions cyber softening', pts: -4, kind: 'market' },
    { label: 'Phishing-resistant MFA (FIDO2) everywhere', pts: -2, kind: 'control', controlId: 'mfa' },
    { label: 'EDR with HexaSOC 24×7 response', pts: -1.5, kind: 'control', controlId: 'edr' },
    { label: 'Cyber vault restore within impact tolerance', pts: -1.5, kind: 'control', controlId: 'backup' },
    { label: 'TLPT completed; DORA playbook exercised', pts: -1, kind: 'control', controlId: 'ir' },
    { label: '13-month logging with daily review', pts: -2, kind: 'control', controlId: 'logging' },
    { label: '14 standing Tier 0 admin accounts', pts: 1, kind: 'control', controlId: 'pam', fixable: true },
    { label: 'DORA exit plans missing for 3 critical ICT providers', pts: 0.5, kind: 'control', controlId: 'tprm', fixable: true },
    { label: 'Social-engineering claim paid in 2024', pts: 1.5, kind: 'history' },
  ],
  media: [
    { label: 'Market: media sector after leak losses', pts: 1.5, kind: 'market' },
    { label: 'Chain of custody on pre-release (HexaCustody)', pts: -2, kind: 'control', controlId: 'tprm' },
    { label: 'MFA on email and remote access', pts: -1.5, kind: 'control', controlId: 'mfa' },
    { label: 'EDR with HexaSOC 24×7 response', pts: -1, kind: 'control', controlId: 'edr' },
    { label: 'No live backup evidence for NEXIS and render farm', pts: 2, kind: 'control', controlId: 'backup', fixable: true },
    { label: 'Awareness evidence stale (KnowBe4 paused)', pts: 1.5, kind: 'control', controlId: 'awareness', fixable: true },
    { label: '3 critical findings on screeners portal', pts: 1.5, kind: 'control', controlId: 'patch', fixable: true },
    { label: 'Red Fern custody gap (rating 58)', pts: 1, kind: 'control', controlId: 'tprm', fixable: true },
    { label: 'Open leak notice of circumstances (2025)', pts: 1, kind: 'history' },
  ],
  healthcare: [
    { label: 'Market: healthcare after clearinghouse and ransomware losses', pts: 4, kind: 'market' },
    { label: 'MFA on email and remote access, badge-tap SSO', pts: -2.5, kind: 'control', controlId: 'mfa' },
    { label: 'EDR with HexaSOC 24×7 response', pts: -2, kind: 'control', controlId: 'edr' },
    { label: 'Diversion tabletop and downtime drills', pts: -1.5, kind: 'control', controlId: 'ir' },
    { label: '1,140 medical devices on a flat VLAN', pts: 1.5, kind: 'control', controlId: 'seg', fixable: true },
    { label: 'Single clearinghouse dependency (Change Healthcare)', pts: 1, kind: 'control', controlId: 'tprm', fixable: true },
    { label: '312 EOL imaging and lab workstations', pts: 1, kind: 'control', controlId: 'eol', fixable: true },
    { label: '38 standing biomed vendor accounts', pts: 1, kind: 'control', controlId: 'pam', fixable: true },
    { label: '2024 clearinghouse BI claim paid', pts: 0.5, kind: 'history' },
  ],
  automotive: [
    { label: 'Market: manufacturing cyber softening', pts: -2, kind: 'market' },
    { label: 'Phishing-resistant MFA, FIDO2 for OTA signing', pts: -2, kind: 'control', controlId: 'mfa' },
    { label: 'EDR plus vehicle SOC (vSOC)', pts: -1.5, kind: 'control', controlId: 'edr' },
    { label: 'MES and PLC restore tested within tolerance', pts: -2, kind: 'control', controlId: 'backup' },
    { label: 'Plant and fleet incident exercises', pts: -1, kind: 'control', controlId: 'ir' },
    { label: '3 IT-to-OT conduits at Puebla', pts: 1.5, kind: 'control', controlId: 'seg', fixable: true },
    { label: '41 robot-OEM accounts with standing access', pts: 1, kind: 'control', controlId: 'pam', fixable: true },
    { label: 'Dealer SaaS (DealerCore) rated 59', pts: 1, kind: 'control', controlId: 'tprm', fixable: true },
    { label: '230 EOL HMIs and test benches', pts: 0.5, kind: 'control', controlId: 'eol', fixable: true },
    { label: '2024 supplier outage contingent BI claim', pts: 0.5, kind: 'history' },
  ],
};

export interface InsurabilityProfile {
  score: number;
  lastScore: number;
  premiumDeltaPct: number;
  attested: number;
  total: number;
  lastAttested: number;
  currentPremium: number;
  modelledPremium: number;
  achievableDeltaPct: number;
  achievablePremium: number;
  drivers: PremiumDriver[];
  dimensions: { label: string; now: number; last: number }[];
}

const LAST_SCORE: CustomerMap<number> = { maritime: 68, finserv: 79, media: 74, healthcare: 69, automotive: 73 };

export function insurability(c: CustomerProfile): InsurabilityProfile {
  const h = headlines(c).insurance;
  const ctl = keyControls(c);
  const drivers = forCustomer(DRIVERS, c);
  const fixable = drivers.filter((d) => d.fixable).reduce((s, d) => s + d.pts, 0);
  const prem = c.insurance.premiumK / 1000;
  const achievable = h.premiumDeltaPct - fixable - 1; // closing gaps also unlocks a better tier
  const dimScore = (ids: ControlId[], useLast: boolean) => {
    const sel = ctl.filter((x) => ids.includes(x.id));
    const tot = sel.reduce((s, x) => s + x.tests.length, 0);
    const ok = sel.reduce((s, x) => s + (useLast ? x.lastOk : x.ok), 0);
    return Math.round((ok / tot) * 70 + 25 + (useLast ? 0 : 3));
  };
  const dims: [string, ControlId[]][] = [
    ['Identity', ['mfa', 'pam']],
    ['Detection & response', ['edr', 'logging', 'ir']],
    ['Resilience', ['backup']],
    ['Exposure', ['patch', 'eol']],
    ['People & email', ['email', 'awareness']],
    ['Supply chain & OT', ['tprm', 'seg']],
  ];
  return {
    score: h.insurability,
    lastScore: forCustomer(LAST_SCORE, c),
    premiumDeltaPct: h.premiumDeltaPct,
    attested: h.attestedControls,
    total: h.totalControls,
    lastAttested: ctl.reduce((s, x) => s + x.lastOk, 0),
    currentPremium: prem,
    modelledPremium: prem * (1 + h.premiumDeltaPct / 100),
    achievableDeltaPct: achievable,
    achievablePremium: prem * (1 + achievable / 100),
    drivers,
    dimensions: dims.map(([label, ids]) => ({ label, now: Math.min(98, dimScore(ids, false)), last: Math.min(98, dimScore(ids, true)) })),
  };
}

/** Insurability score history (12 months, oldest first) ending at the headline. */
export function insurabilityTrend(c: CustomerProfile): number[] {
  const now = headlines(c).insurance.insurability;
  const start = forCustomer(LAST_SCORE, c) - (c.dataKey === 'media' ? -2 : 3);
  const r = rng(`ins-trend-${c.id}`);
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    const v = start + ((now - start) * i) / 11 + (i > 0 && i < 11 ? (r() - 0.5) * 3 : 0);
    out.push(Math.round(v));
  }
  out[11] = now;
  return out;
}

/* =====================================================================
   Renewal timeline
   ===================================================================== */
export interface Milestone {
  label: string;
  detail: string;
  daysBeforeInception: number;
  inDays: number;
  done: boolean;
}

export function renewalMilestones(c: CustomerProfile): Milestone[] {
  const R = c.insurance.renewalDays;
  const items: [string, string, number][] = [
    ['Evidence pack refreshed', 'HexaView regenerates the insurer pack from live connectors and signs it', 75],
    ['Broker submission', `${c.insurance.broker} submits proposal form and evidence pack to market`, 50],
    ['Underwriter meeting', `${c.people.ciso.name} presents posture and roadmap to ${c.insurance.carrier.split(' ')[0]}`, 32],
    ['Quotes received', 'Primary and excess terms, sublimits and subjectivities returned', 18],
    ['Subjectivities cleared', 'Outstanding control evidence supplied to satisfy pre-bind conditions', 9],
    ['Bind', 'Firm order to bind; policy documents issued', 3],
    ['Inception', 'New policy period starts', 0],
  ];
  return items.map(([label, detail, d]) => ({ label, detail, daysBeforeInception: d, inDays: R - d, done: R - d < 0 }));
}

/* =====================================================================
   Cyber risk quantification (FAIR-style)
   ===================================================================== */
export interface Scenario {
  id: string;
  name: string;
  category: 'Ransomware' | 'BEC / payment fraud' | 'Data breach' | 'OT disruption' | 'Third-party outage' | 'Content leak' | 'Insider' | 'State-backed' | 'Availability' | 'Regulatory' | 'IP theft' | 'Vehicle fleet';
  freq: number; // events / year (scaled so ALE sums to the headline)
  min: number;
  ml: number;
  max: number;
  mean: number;
  ale: number;
  tenants: string[];
  actors: string[];
  techniques: string[];
  controls: ControlId[];
  cover: string;
  coveredPct: number;
  mix: { bi: number; response: number; extortion: number; liability: number; fraud: number };
  narrative: string;
}

type ScenarioSeed = Omit<Scenario, 'mean' | 'ale'>;

const mix = (bi: number, response: number, extortion: number, liability: number, fraud: number) => ({ bi, response, extortion, liability, fraud });

const SCENARIOS: CustomerMap<ScenarioSeed[]> = {
  maritime: [
    { id: 'rw', name: 'Ransomware on terminal IT and Navis N4 TOS', category: 'Ransomware', freq: 0.12, min: 1.5, ml: 9, max: 55, tenants: ['hq', 'rtm', 'ant'], actors: ['LockBit 3.0 affiliates', 'Black Basta'], techniques: ['T1133', 'T1078', 'T1486', 'T1490'], controls: ['mfa', 'edr', 'backup', 'patch'], cover: 'Extortion + BI (12 h waiting period)', coveredPct: 0.72, mix: mix(0.62, 0.14, 0.12, 0.08, 0.04), narrative: 'Encryption of TOS and gate systems halts berthing and gate-in at a terminal. Port BI accrues per hour of stopped quay moves; vessels divert to competing terminals.' },
    { id: 'ot', name: 'OT disruption of quay cranes and AGVs', category: 'OT disruption', freq: 0.06, min: 2, ml: 14, max: 70, tenants: ['rtm', 'ant', 'pkl', 'sts'], actors: ['Sandworm (APT44)', 'CyberAv3ngers', 'Volt Typhoon'], techniques: ['T0886', 'T0843', 'T0836', 'T1021.002'], controls: ['seg', 'pam', 'tprm'], cover: 'BI; physical damage excluded (CL380 buy-back $10M)', coveredPct: 0.55, mix: mix(0.78, 0.1, 0, 0.07, 0.05), narrative: 'A compromised vendor jump path or flat crane VLAN lets an attacker stop STS cranes and the AGV fleet. Terminal throughput drops to zero; contractual penalties with shipping lines follow.' },
    { id: 'offhire', name: 'Vessel off-hire after ECDIS or engine-control malware', category: 'OT disruption', freq: 0.08, min: 0.4, ml: 2.2, max: 12, tenants: ['fleet'], actors: ['Commodity malware via USB', 'APT41'], techniques: ['T1204.002', 'T0847', 'T0866'], controls: ['eol', 'seg', 'edr'], cover: 'Cyber off-hire endorsement ($7.5M, 72 h deductible)', coveredPct: 0.6, mix: mix(0.8, 0.12, 0, 0.05, 0.03), narrative: 'Malware on Windows 7 ECDIS forces paper-chart navigation and a port-state detention. Charter hire stops while the vessel is off-hire.' },
    { id: 'bec', name: 'BEC on bunker and freight supplier payments', category: 'BEC / payment fraud', freq: 0.35, min: 0.1, ml: 0.8, max: 4, tenants: ['hq'], actors: ['BEC crews (West Africa)', 'Scattered Spider'], techniques: ['T1566.002', 'T1114.002', 'T1657'], controls: ['email', 'awareness', 'mfa'], cover: 'Social engineering fraud sublimit ($1M)', coveredPct: 0.35, mix: mix(0, 0.08, 0, 0.02, 0.9), narrative: 'A spoofed bunker supplier changes bank details by email; a large fuel payment goes to a mule account.' },
    { id: 'breach', name: 'Crew and customer data breach (GDPR, LGPD)', category: 'Data breach', freq: 0.1, min: 0.2, ml: 1.4, max: 8, tenants: ['hq', 'sts'], actors: ['ShinyHunters-style data extortion'], techniques: ['T1530', 'T1567.002', 'T1078'], controls: ['mfa', 'logging', 'tprm'], cover: 'Breach response + regulatory (where insurable)', coveredPct: 0.82, mix: mix(0.05, 0.35, 0.1, 0.5, 0), narrative: 'Crew passports, medical records and booking customer data exfiltrated from a SaaS crewing platform; notification under GDPR and LGPD.' },
    { id: 'tp', name: 'Third-party outage (Navis SaaS, Portbase, satellite)', category: 'Third-party outage', freq: 0.15, min: 0.3, ml: 2, max: 14, tenants: ['rtm', 'ant', 'fleet'], actors: ['Supply-chain compromise', 'Provider failure'], techniques: ['T1195.002', 'T1199'], controls: ['tprm'], cover: 'Dependent BI ($15M, 12 h)', coveredPct: 0.6, mix: mix(0.85, 0.08, 0, 0.04, 0.03), narrative: 'A port community system or TOS provider outage halts customs and gate processes across terminals.' },
    { id: 'insider', name: 'Insider misuse at gate and customs (cargo theft enablement)', category: 'Insider', freq: 0.08, min: 0.1, ml: 0.9, max: 6, tenants: ['rtm', 'ant'], actors: ['Organised crime (drug trafficking)'], techniques: ['T1078', 'T1565.001'], controls: ['pam', 'logging'], cover: 'Partly; crime policy responds to theft', coveredPct: 0.3, mix: mix(0.2, 0.25, 0, 0.35, 0.2), narrative: 'Bribed staff release container PINs and alter gate records, enabling cargo theft and regulatory sanctions.' },
    { id: 'wiper', name: 'State-backed wiper spillover (NotPetya-type)', category: 'State-backed', freq: 0.015, min: 10, ml: 45, max: 180, tenants: ['hq', 'rtm', 'ant', 'pkl', 'sts', 'fleet'], actors: ['Sandworm (APT44)', 'Volt Typhoon'], techniques: ['T1195.002', 'T1485', 'T1561'], controls: ['backup', 'seg', 'edr'], cover: 'Subject to war / state-backed exclusion (LMA 5567A)', coveredPct: 0.2, mix: mix(0.7, 0.15, 0, 0.1, 0.05), narrative: 'A destructive attack aimed at another state spreads through a shared supplier update and wipes group IT and terminal systems worldwide.' },
  ],
  finserv: [
    { id: 'rw', name: 'Ransomware on core banking and payments', category: 'Ransomware', freq: 0.05, min: 8, ml: 45, max: 220, tenants: ['ukbank', 'pay', 'eu'], actors: ['ALPHV/BlackCat affiliates', 'Scattered Spider'], techniques: ['T1078', 'T1621', 'T1486', 'T1490'], controls: ['mfa', 'pam', 'edr', 'backup'], cover: 'Extortion + BI (8 h waiting period)', coveredPct: 0.7, mix: mix(0.55, 0.15, 0.1, 0.2, 0), narrative: 'Help-desk social engineering leads to domain compromise and encryption; Faster Payments and card acquiring breach FCA impact tolerances.' },
    { id: 'swift', name: 'Fraudulent SWIFT payment (Lazarus-style)', category: 'BEC / payment fraud', freq: 0.03, min: 5, ml: 30, max: 110, tenants: ['ukbank', 'pay'], actors: ['Lazarus Group (APT38)'], techniques: ['T1021.001', 'T1657', 'T1070.001'], controls: ['seg', 'pam', 'logging'], cover: 'Bankers blanket bond (crime); cyber responds to response costs only', coveredPct: 0.25, mix: mix(0.05, 0.1, 0, 0.1, 0.75), narrative: 'Attackers reach Alliance Access in the secure zone and inject fraudulent MT103 messages over a weekend.' },
    { id: 'bec', name: 'BEC on treasury and supplier payments', category: 'BEC / payment fraud', freq: 0.4, min: 0.2, ml: 1.5, max: 9, tenants: ['ukbank', 'markets', 'wealth'], actors: ['FIN7', 'BEC crews'], techniques: ['T1566.002', 'T1114.002', 'T1657'], controls: ['email', 'awareness'], cover: 'Social engineering sublimit (£5M)', coveredPct: 0.45, mix: mix(0, 0.08, 0, 0.02, 0.9), narrative: 'An impersonated supplier or executive diverts a treasury payment; recovery is partial.' },
    { id: 'breach', name: 'Customer data breach (6.2M records)', category: 'Data breach', freq: 0.06, min: 6, ml: 38, max: 200, tenants: ['ukbank', 'eu', 'markets', 'wealth'], actors: ['Cl0p', 'ShinyHunters'], techniques: ['T1190', 'T1530', 'T1567.002'], controls: ['patch', 'logging', 'tprm'], cover: 'Breach response, liability, regulatory (fines where insurable)', coveredPct: 0.68, mix: mix(0.05, 0.3, 0.05, 0.6, 0), narrative: 'A file-transfer zero-day exposes customer data across entities; GDPR, ICO, NYDFS and SEC Reg S-P notifications; class action in the US.' },
    { id: 'cloud', name: 'Critical ICT provider outage (Azure UK South)', category: 'Third-party outage', freq: 0.1, min: 2, ml: 12, max: 80, tenants: ['ukbank', 'pay'], actors: ['Provider failure', 'Supply-chain compromise'], techniques: ['T1199', 'T1195.002'], controls: ['tprm', 'backup'], cover: 'Dependent BI (£50M, 10 h); system failure', coveredPct: 0.55, mix: mix(0.85, 0.08, 0, 0.07, 0), narrative: 'A regional cloud outage takes down online banking and payments beyond impact tolerance; DORA major incident reporting.' },
    { id: 'ddos', name: 'DDoS on online and mobile banking', category: 'Availability', freq: 0.2, min: 0.3, ml: 1.8, max: 10, tenants: ['ukbank', 'eu'], actors: ['Hacktivist (pro-Russia)'], techniques: ['T1498', 'T1499'], controls: ['seg'], cover: 'BI (8 h waiting period)', coveredPct: 0.4, mix: mix(0.7, 0.2, 0.05, 0.05, 0), narrative: 'Sustained application-layer DDoS degrades digital channels for a day; customer redress and regulator interest.' },
    { id: 'insider', name: 'Insider data theft (Markets and Wealth client lists)', category: 'Insider', freq: 0.1, min: 0.5, ml: 4, max: 30, tenants: ['markets', 'wealth'], actors: ['Departing staff', 'Recruited insider'], techniques: ['T1567.002', 'T1048.003', 'T1213'], controls: ['logging', 'pam'], cover: 'Breach response and liability', coveredPct: 0.6, mix: mix(0.1, 0.25, 0, 0.65, 0), narrative: 'A departing banker exfiltrates high-net-worth client data to a competitor; MAS and PDPA notification in Singapore.' },
  ],
  media: [
    { id: 'leak', name: 'Pre-release content leak (Project Nightjar)', category: 'Content leak', freq: 0.25, min: 0.5, ml: 4, max: 30, tenants: ['studios', 'post'], actors: ['Leak forums ("pre-release" brokers)', 'LAPSUS$-style extortion crews'], techniques: ['T1567.002', 'T1530', 'T1199'], controls: ['tprm', 'patch', 'mfa'], cover: 'Response + media liability; lost box office excluded ($5M leak buy-back)', coveredPct: 0.3, mix: mix(0.6, 0.15, 0.1, 0.15, 0), narrative: 'A locked cut leaks from a localisation vendor two weeks before release; marketing re-plan, takedown costs and lost opening-weekend revenue.' },
    { id: 'rw', name: 'Ransomware on post-production (Soho NEXIS and render farm)', category: 'Ransomware', freq: 0.1, min: 1, ml: 6, max: 28, tenants: ['post', 'studios'], actors: ['Akira', 'Scattered Spider'], techniques: ['T1078', 'T1486', 'T1490'], controls: ['backup', 'mfa', 'edr', 'awareness'], cover: 'Extortion + BI (10 h waiting period)', coveredPct: 0.65, mix: mix(0.6, 0.15, 0.15, 0.1, 0), narrative: 'Encryption of NEXIS and render nodes stops VFX and finishing on 3 titles; delivery dates slip and completion bonds are triggered.' },
    { id: 'breach', name: 'KestrelPlay subscriber data breach (4.1M accounts, PCI)', category: 'Data breach', freq: 0.08, min: 1, ml: 7, max: 40, tenants: ['play'], actors: ['ShinyHunters', 'Magecart groups'], techniques: ['T1190', 'T1059.003', 'T1530'], controls: ['patch', 'logging'], cover: 'Breach response, liability, PCI fines ($2M)', coveredPct: 0.75, mix: mix(0.1, 0.3, 0.05, 0.55, 0), narrative: 'Skimming script on payment pages or a cloud data store exposure; CCPA, UK GDPR and PCI brand assessments.' },
    { id: 'bec', name: 'BEC on production payments', category: 'BEC / payment fraud', freq: 0.3, min: 0.05, ml: 0.4, max: 2.5, tenants: ['studios'], actors: ['BEC crews'], techniques: ['T1566.002', 'T1657'], controls: ['email', 'awareness'], cover: 'Social engineering sublimit ($500k)', coveredPct: 0.4, mix: mix(0, 0.1, 0, 0, 0.9), narrative: 'A spoofed location or equipment vendor redirects a production payment.' },
    { id: 'tp', name: 'Third-party outage (CDN, dailies platform)', category: 'Third-party outage', freq: 0.15, min: 0.2, ml: 1.2, max: 6, tenants: ['play', 'studios'], actors: ['Provider failure'], techniques: ['T1199'], controls: ['tprm'], cover: 'Dependent BI ($5M, 10 h)', coveredPct: 0.55, mix: mix(0.85, 0.1, 0, 0.05, 0), narrative: 'A CDN or review-platform outage during a premiere weekend causes churn and subscriber credits.' },
    { id: 'live', name: 'Live sports playout disruption (ST 2110)', category: 'OT disruption', freq: 0.05, min: 0.5, ml: 3, max: 15, tenants: ['live'], actors: ['Hacktivists', 'Commodity ransomware'], techniques: ['T0814', 'T0886', 'T1219'], controls: ['seg', 'pam'], cover: 'BI; rights-holder penalties partly excluded', coveredPct: 0.45, mix: mix(0.7, 0.1, 0, 0.2, 0), narrative: 'Playout chain disruption during a live fixture triggers rights-holder penalties and advertiser make-goods.' },
    { id: 'insider', name: 'Insider leak by editor or freelancer', category: 'Insider', freq: 0.12, min: 0.1, ml: 1, max: 8, tenants: ['post', 'studios'], actors: ['Disgruntled freelancer'], techniques: ['T1052.001', 'T1567.002'], controls: ['tprm', 'awareness'], cover: 'Response + media liability; lost revenue excluded', coveredPct: 0.3, mix: mix(0.55, 0.2, 0, 0.25, 0), narrative: 'A freelancer copies dailies to personal cloud storage; watermark traces the leak but footage is already public.' },
  ],
  healthcare: [
    { id: 'rw', name: 'Ransomware on Epic and hospital IT with ED diversion', category: 'Ransomware', freq: 0.09, min: 4, ml: 22, max: 95, tenants: ['mrmc', 'kids', 'community'], actors: ['Rhysida', 'Qilin', 'Scattered Spider'], techniques: ['T1660', 'T1078', 'T1486', 'T1490'], controls: ['mfa', 'edr', 'backup', 'patch'], cover: 'Extortion + BI (8 h waiting period); diversion revenue loss measured per day', coveredPct: 0.62, mix: mix(0.58, 0.16, 0.1, 0.14, 0.02), narrative: 'Help-desk social engineering leads to domain compromise and encryption of Epic and PACS. The emergency department goes on diversion, elective surgery is cancelled and clinicians run on paper for up to three weeks.' },
    { id: 'ephi', name: 'ePHI breach and exfiltration (1.9M patient records)', category: 'Data breach', freq: 0.07, min: 2, ml: 11, max: 60, tenants: ['mrmc', 'clinics', 'research'], actors: ['ALPHV/BlackCat affiliates', 'INC Ransom'], techniques: ['T1190', 'T1567.002', 'T1530'], controls: ['patch', 'logging', 'tprm'], cover: 'Breach response, notification, class-action defence', coveredPct: 0.74, mix: mix(0.04, 0.34, 0.08, 0.54, 0), narrative: 'Data theft through an exposed file-transfer appliance; HHS breach portal listing, notification to 1.9M patients, credit monitoring and a consolidated class action.' },
    { id: 'device', name: 'Medical device disruption (infusion pumps, imaging)', category: 'OT disruption', freq: 0.05, min: 1, ml: 6, max: 34, tenants: ['mrmc', 'kids', 'community'], actors: ['Commodity ransomware spillover', 'Qilin'], techniques: ['T0866', 'T0886', 'T0814', 'T1021.002'], controls: ['seg', 'eol', 'pam'], cover: 'BI only; bodily injury excluded (medical malpractice and GL respond)', coveredPct: 0.4, mix: mix(0.72, 0.14, 0, 0.12, 0.02), narrative: 'Malware on the flat community-hospital VLAN reaches EOL imaging workstations and the Alaris pump server; biomed takes devices offline and CT and MRI capacity falls by half.' },
    { id: 'ocr', name: 'HHS OCR enforcement and state AG action after a HIPAA failure', category: 'Regulatory', freq: 0.06, min: 0.5, ml: 3, max: 16, tenants: ['mrmc', 'clinics'], actors: ['Regulatory follow-on to a breach'], techniques: ['T1078'], controls: ['logging', 'mfa', 'tprm'], cover: 'Regulatory defence and fines where insurable (sublimit $5M)', coveredPct: 0.5, mix: mix(0, 0.3, 0, 0.7, 0), narrative: 'OCR finds no enterprise-wide risk analysis for the community hospitals; resolution agreement, civil money penalty and a two-year corrective action plan.' },
    { id: 'clearing', name: 'Clearinghouse outage stops claims (Change-Healthcare-style)', category: 'Third-party outage', freq: 0.12, min: 1.5, ml: 9, max: 48, tenants: ['mrmc', 'kids', 'community', 'clinics'], actors: ['ALPHV/BlackCat affiliates (at provider)', 'Provider failure'], techniques: ['T1199', 'T1195.002'], controls: ['tprm'], cover: 'Dependent BI ($5M, 12 h); cash-flow financing not covered', coveredPct: 0.3, mix: mix(0.86, 0.08, 0, 0.04, 0.02), narrative: 'Ransomware at the clearinghouse stops claims, eligibility checks and prior authorisations for weeks; revenue is delayed rather than lost, but cash-flow strain is severe.' },
    { id: 'bec', name: 'Payroll diversion and supplier BEC', category: 'BEC / payment fraud', freq: 0.4, min: 0.05, ml: 0.5, max: 3, tenants: ['mrmc', 'clinics'], actors: ['BEC crews', 'Scattered Spider'], techniques: ['T1566.002', 'T1114.002', 'T1657'], controls: ['email', 'awareness', 'mfa'], cover: 'Social engineering sublimit ($1M)', coveredPct: 0.45, mix: mix(0, 0.08, 0, 0.02, 0.9), narrative: 'Clinician direct-deposit details are changed through a cloned SSO page; a supplier invoice is redirected.' },
    { id: 'insider', name: 'Insider snooping on VIP and employee records', category: 'Insider', freq: 0.2, min: 0.05, ml: 0.4, max: 3, tenants: ['mrmc', 'kids'], actors: ['Curious or malicious workforce member'], techniques: ['T1078', 'T1213'], controls: ['logging', 'awareness'], cover: 'Breach response and liability', coveredPct: 0.7, mix: mix(0, 0.3, 0, 0.7, 0), narrative: 'Staff browse a local celebrity\'s chart after an ED visit; FairWarning flags it, but notification and OCR reporting follow.' },
  ],
  automotive: [
    { id: 'plant', name: 'Plant shutdown after ransomware on MES and plant IT', category: 'Ransomware', freq: 0.08, min: 12, ml: 70, max: 380, tenants: ['ingolstadt', 'gyor', 'puebla', 'group'], actors: ['Black Basta', 'Akira'], techniques: ['T1133', 'T1078', 'T1486', 'T1490'], controls: ['mfa', 'edr', 'backup', 'seg'], cover: 'Extortion + BI (12 h waiting period); €14M per production day at Ingolstadt', coveredPct: 0.58, mix: mix(0.74, 0.1, 0.08, 0.04, 0.04), narrative: 'Encryption of MES and plant IT stops just-in-sequence call-offs; Ingolstadt halts after one shift and Győr follows when engine supply runs out. BI accrues at roughly €14M per production day.' },
    { id: 'fleet', name: 'OTA or connected-vehicle fleet incident (2.1M cars)', category: 'Vehicle fleet', freq: 0.03, min: 8, ml: 55, max: 410, tenants: ['connected'], actors: ['APT41', 'Organised crime (keyless theft)'], techniques: ['T1195.002', 'T1552.004', 'T1190'], controls: ['pam', 'patch', 'logging'], cover: 'Partly: response and liability; product recall excluded', coveredPct: 0.25, mix: mix(0.3, 0.12, 0.05, 0.53, 0), narrative: 'A stolen OTA signing key or a backend API flaw lets attackers unlock or disable vehicles remotely; R155 notification to the type-approval authority, a fleet-wide campaign and recall costs.' },
    { id: 'ip', name: 'Design and battery IP theft (Project Lumen, VC-7 cells)', category: 'IP theft', freq: 0.06, min: 2, ml: 18, max: 140, tenants: ['group', 'battery'], actors: ['APT41', 'Volt Typhoon'], techniques: ['T1078', 'T1213', 'T1567.002'], controls: ['mfa', 'tprm', 'logging'], cover: 'Response only; loss of IP value excluded', coveredPct: 0.15, mix: mix(0.1, 0.2, 0, 0.7, 0), narrative: 'A state-aligned group exfiltrates pre-launch design renders and cell chemistry from Teamcenter via a design agency account; competitive advantage is lost before launch.' },
    { id: 'dealer', name: 'Dealer SaaS outage (DealerCore DMS)', category: 'Third-party outage', freq: 0.14, min: 2, ml: 14, max: 90, tenants: ['retail'], actors: ['BlackSuit (dealer SaaS attacks)', 'Provider failure'], techniques: ['T1199', 'T1486'], controls: ['tprm'], cover: 'Dependent BI (€20M, 12 h)', coveredPct: 0.5, mix: mix(0.82, 0.08, 0.02, 0.08, 0), narrative: 'Ransomware at the dealer management provider stops sales, finance and service bookings at 1,140 dealers for two weeks, as happened across North America in 2024.' },
    { id: 'supplier', name: 'Tier-1 supplier ransomware halts just-in-sequence supply', category: 'Third-party outage', freq: 0.18, min: 3, ml: 20, max: 160, tenants: ['ingolstadt', 'gyor', 'puebla'], actors: ['Akira', 'Black Basta'], techniques: ['T1199', 'T1486'], controls: ['tprm'], cover: 'Contingent BI (€25M, 24 h) for named suppliers', coveredPct: 0.35, mix: mix(0.9, 0.04, 0, 0.04, 0.02), narrative: 'A seat or wiring-harness supplier is encrypted; with hours of buffer stock, assembly lines stop within a shift.' },
    { id: 'battery', name: 'Battery plant process disruption (formation and ageing)', category: 'OT disruption', freq: 0.025, min: 5, ml: 30, max: 220, tenants: ['battery'], actors: ['Volt Typhoon', 'Insider via removable media'], techniques: ['T0847', 'T0836', 'T0831'], controls: ['seg', 'eol', 'pam'], cover: 'BI; property damage (thermal event) under the property policy', coveredPct: 0.35, mix: mix(0.8, 0.1, 0, 0.08, 0.02), narrative: 'Malware brought in on an engineering laptop alters formation parameters; cells are scrapped and the air-gapped plant is down while lines are re-validated.' },
    { id: 'bec', name: 'Supplier bank-change fraud via SAP', category: 'BEC / payment fraud', freq: 0.3, min: 0.2, ml: 1.5, max: 12, tenants: ['group'], actors: ['BEC crews', 'Scattered Spider'], techniques: ['T1566.002', 'T1657'], controls: ['email', 'awareness'], cover: 'Social engineering sublimit (€2.5M)', coveredPct: 0.4, mix: mix(0, 0.06, 0, 0.04, 0.9), narrative: 'A spoofed parts supplier changes bank details in SAP supplier master; a large payment run goes to a mule account.' },
  ],
};

const pert = (s: { min: number; ml: number; max: number }) => (s.min + 4 * s.ml + s.max) / 6;

export function scenarios(c: CustomerProfile): Scenario[] {
  const target = headlines(c).insurance.expectedLossM;
  const raw = forCustomer(SCENARIOS, c);
  const rawAle = raw.reduce((s, x) => s + x.freq * pert(x), 0);
  const k = target / rawAle;
  return raw.map((x) => {
    const freq = x.freq * k;
    const mean = pert(x);
    return { ...x, freq, mean, ale: freq * mean };
  });
}

/* ---- Loss exceedance curve: P(annual loss > x) = p0 · exp(-(x/s)^k) ---- */
function gamma(z: number): number {
  const g = 7;
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
}

export interface Lec {
  p0: number;
  k: number;
  s: number;
  mean: number;
  tail: number;
  exceed: (x: number) => number;
  quantile: (p: number) => number;
}

export function lec(p0: number, mean: number, tail: number): Lec {
  const target = Math.log(p0 / 0.01);
  const sOf = (k: number) => mean / (p0 * gamma(1 + 1 / k));
  const f = (k: number) => (tail / sOf(k)) ** k - target;
  // Pick the shape that best matches mean and tail, then pin the scale so the
  // 1-in-100 quantile equals the headline exactly.
  let k = 0.5, best = Infinity;
  for (let kk = 0.2; kk <= 3; kk += 0.005) {
    const v = Math.abs(f(kk));
    if (v < best) { best = v; k = kk; }
  }
  const s = tail / target ** (1 / k);

  return {
    p0, k, s, mean, tail,
    exceed: (x: number) => p0 * Math.exp(-((Math.max(0, x) / s) ** k)),
    quantile: (p: number) => (p >= p0 ? 0 : s * Math.log(p0 / p) ** (1 / k)),
  };
}

const P0: CustomerMap<number> = { maritime: 0.62, finserv: 0.78, media: 0.56, healthcare: 0.72, automotive: 0.74 };

export function currentLec(c: CustomerProfile): Lec {
  const h = headlines(c).insurance;
  return lec(forCustomer(P0, c), h.expectedLossM, h.tailLossM);
}

export function lecFor(c: CustomerProfile, newMean: number): Lec {
  const h = headlines(c).insurance;
  const ratio = newMean / h.expectedLossM;
  return lec(forCustomer(P0, c) * (0.85 + 0.15 * ratio), newMean, h.tailLossM * ratio ** 0.8);
}

/* ---- Control investment what-if ---- */
export interface Investment {
  id: string;
  name: string;
  controlId: ControlId;
  costM: number;
  effects: { scenario: string; freq?: number; mag?: number }[];
  recommended: boolean;
  premiumPts: number;
}

const INVESTMENTS: CustomerMap<Investment[]> = {
  maritime: [
    { id: 'i-bkp', name: 'Fix Veeam connector and run quarterly isolated restore tests (TOS, SAP)', controlId: 'backup', costM: 0.18, effects: [{ scenario: 'rw', mag: 0.35 }, { scenario: 'wiper', mag: 0.2 }], recommended: true, premiumPts: 1.5 },
    { id: 'i-seg', name: 'Complete Port Klang Level 3.5 DMZ for the crane network', controlId: 'seg', costM: 0.65, effects: [{ scenario: 'ot', freq: 0.4 }, { scenario: 'wiper', mag: 0.1 }], recommended: true, premiumPts: 0.5 },
    { id: 'i-kev', name: 'KEV patch SLA of 72 h on terminal gateways with HexaStrike re-test', controlId: 'patch', costM: 0.12, effects: [{ scenario: 'rw', freq: 0.25 }, { scenario: 'ot', freq: 0.1 }], recommended: true, premiumPts: 1 },
    { id: 'i-ecdis', name: 'Upgrade 9 Windows 7 ECDIS units and add HexaOT fleet sensors', controlId: 'eol', costM: 0.9, effects: [{ scenario: 'offhire', freq: 0.45 }], recommended: false, premiumPts: 0.5 },
    { id: 'i-bec', name: 'Payment call-back automation and Proofpoint impostor rules', controlId: 'email', costM: 0.06, effects: [{ scenario: 'bec', freq: 0.5 }], recommended: false, premiumPts: 0.3 },
  ],
  finserv: [
    { id: 'i-t0', name: 'Convert 14 standing Tier 0 admins to CyberArk JIT', controlId: 'pam', costM: 0.25, effects: [{ scenario: 'rw', freq: 0.2 }, { scenario: 'insider', freq: 0.3 }, { scenario: 'swift', freq: 0.1 }], recommended: true, premiumPts: 1 },
    { id: 'i-exit', name: 'DORA exit plans and multi-region failover for critical ICT providers', controlId: 'tprm', costM: 0.8, effects: [{ scenario: 'cloud', mag: 0.3 }], recommended: true, premiumPts: 0.5 },
    { id: 'i-swift', name: 'SWIFT out-of-band confirmation and Lazarus detection pack', controlId: 'seg', costM: 0.4, effects: [{ scenario: 'swift', freq: 0.4 }], recommended: false, premiumPts: 0.3 },
    { id: 'i-api', name: 'Remediate open-banking API BOLA and clear Veracode backlog', controlId: 'patch', costM: 0.3, effects: [{ scenario: 'breach', freq: 0.25 }], recommended: true, premiumPts: 0.4 },
    { id: 'i-tok', name: 'Tokenise customer PII in the data warehouse', controlId: 'logging', costM: 1.6, effects: [{ scenario: 'breach', mag: 0.35 }, { scenario: 'insider', mag: 0.3 }], recommended: false, premiumPts: 0.6 },
  ],
  media: [
    { id: 'i-kb4', name: 'Re-enable KnowBe4 and enrol freelancers in phishing simulations', controlId: 'awareness', costM: 0.05, effects: [{ scenario: 'rw', freq: 0.15 }, { scenario: 'bec', freq: 0.3 }], recommended: true, premiumPts: 1.5 },
    { id: 'i-bkp', name: 'Immutable backup for NEXIS and project files with tested restore', controlId: 'backup', costM: 0.35, effects: [{ scenario: 'rw', mag: 0.45 }], recommended: true, premiumPts: 2 },
    { id: 'i-cst', name: 'Enforce HexaCustody agents at Red Fern and Apex Trailer House', controlId: 'tprm', costM: 0.12, effects: [{ scenario: 'leak', freq: 0.35 }, { scenario: 'insider', freq: 0.2 }], recommended: true, premiumPts: 1 },
    { id: 'i-scr', name: 'Fix screener portal auth bypass and deploy WAF rule', controlId: 'patch', costM: 0.08, effects: [{ scenario: 'leak', freq: 0.2 }, { scenario: 'breach', freq: 0.1 }], recommended: true, premiumPts: 1.5 },
    { id: 'i-pci', name: 'Script integrity on KestrelPlay payment pages (PCI 6.4.3)', controlId: 'patch', costM: 0.1, effects: [{ scenario: 'breach', freq: 0.3 }], recommended: false, premiumPts: 0.3 },
  ],
  healthcare: [
    { id: 'i-seg', name: 'Segment 1,140 medical devices at the community hospitals (Claroty policies)', controlId: 'seg', costM: 0.55, effects: [{ scenario: 'device', freq: 0.5 }, { scenario: 'rw', mag: 0.15 }], recommended: true, premiumPts: 1.5 },
    { id: 'i-help', name: 'Verified help-desk MFA resets and FIDO2 for 214 accounts', controlId: 'mfa', costM: 0.09, effects: [{ scenario: 'rw', freq: 0.3 }, { scenario: 'bec', freq: 0.3 }], recommended: true, premiumPts: 1 },
    { id: 'i-clear', name: 'Secondary clearinghouse route tested for the top 5 payers', controlId: 'tprm', costM: 0.2, effects: [{ scenario: 'clearing', mag: 0.55 }], recommended: true, premiumPts: 1 },
    { id: 'i-epic', name: 'Epic clean-room restore to meet the 6 h recovery objective', controlId: 'backup', costM: 0.4, effects: [{ scenario: 'rw', mag: 0.3 }], recommended: true, premiumPts: 0.8 },
    { id: 'i-vpam', name: 'Broker 38 OEM vendor accounts through CyberArk Vendor PAM', controlId: 'pam', costM: 0.12, effects: [{ scenario: 'device', freq: 0.25 }, { scenario: 'ephi', freq: 0.1 }], recommended: false, premiumPts: 1 },
  ],
  automotive: [
    { id: 'i-pue', name: 'Close the 3 Puebla IT-to-OT conduits and upgrade the edge plane', controlId: 'seg', costM: 0.8, effects: [{ scenario: 'plant', freq: 0.25 }], recommended: true, premiumPts: 1.5 },
    { id: 'i-robot', name: 'Approval-required sessions for 41 robot-OEM accounts (BeyondTrust)', controlId: 'pam', costM: 0.15, effects: [{ scenario: 'plant', freq: 0.15 }, { scenario: 'battery', freq: 0.2 }], recommended: true, premiumPts: 1 },
    { id: 'i-hsm', name: 'OTA signing keys in dual-control HSM with vSOC key-use alerts', controlId: 'pam', costM: 1.2, effects: [{ scenario: 'fleet', freq: 0.45 }], recommended: true, premiumPts: 0.5 },
    { id: 'i-dealer', name: 'DealerCore recovery commitments and manual sales fallback', controlId: 'tprm', costM: 0.6, effects: [{ scenario: 'dealer', mag: 0.4 }], recommended: false, premiumPts: 1 },
    { id: 'i-jis', name: 'Recovery evidence and buffer stock for 31 JIS suppliers', controlId: 'tprm', costM: 2.4, effects: [{ scenario: 'supplier', mag: 0.35 }], recommended: false, premiumPts: 0.5 },
  ],
};

export function investments(c: CustomerProfile): Investment[] {
  return forCustomer(INVESTMENTS, c);
}

/** Apply selected investments; returns per-scenario ALE after the improvements. */
export function applyInvestments(sc: Scenario[], inv: Investment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sc) {
    let f = s.freq;
    let m = s.mean;
    for (const i of inv) for (const e of i.effects) if (e.scenario === s.id) {
      if (e.freq) f *= 1 - e.freq;
      if (e.mag) m *= 1 - e.mag;
    }
    out[s.id] = f * m;
  }
  return out;
}

/* =====================================================================
   Policy: sublimits, tower, exclusions, history, market
   ===================================================================== */
export interface Sublimit {
  name: string;
  limitM: number | null;
  waiting?: string;
  retention?: string;
  note: string;
  scenarios: string[];
  kind: 'full' | 'sublimit' | 'endorsement' | 'excluded';
}

const SUBLIMITS: CustomerMap<Sublimit[]> = {
  maritime: [
    { name: 'Incident response and forensics', limitM: 50, retention: 'Nil for panel vendors', note: 'HexaShield DFIR is on the carrier panel', scenarios: ['rw', 'breach', 'ot'], kind: 'full' },
    { name: 'Ransomware and cyber extortion', limitM: 25, note: '50% coinsurance above $10M; OFAC screening required', scenarios: ['rw'], kind: 'sublimit' },
    { name: 'Business interruption (network security failure)', limitM: 50, waiting: '12 h', note: 'Port BI measured on lost quay moves and gate transactions', scenarios: ['rw', 'ot'], kind: 'full' },
    { name: 'Dependent BI (IT providers)', limitM: 15, waiting: '12 h', note: 'Named: Navis, Portbase, Atos', scenarios: ['tp'], kind: 'sublimit' },
    { name: 'Contingent BI (OT suppliers and port community)', limitM: 5, waiting: '24 h', note: 'Konecranes, Vanderlande remote services', scenarios: ['ot', 'tp'], kind: 'sublimit' },
    { name: 'Cyber off-hire (vessels)', limitM: 7.5, waiting: '72 h deductible', note: 'Endorsement; per vessel cap $1.5M', scenarios: ['offhire'], kind: 'endorsement' },
    { name: 'OT physical damage (CL380 buy-back)', limitM: 10, note: 'Buy-back of the Institute Cyber Attack Exclusion on hull and property', scenarios: ['ot', 'wiper'], kind: 'endorsement' },
    { name: 'Social engineering fraud', limitM: 1, note: 'Requires documented call-back verification', scenarios: ['bec'], kind: 'sublimit' },
    { name: 'Regulatory fines and penalties (where insurable)', limitM: 10, note: 'NIS2, GDPR, LGPD', scenarios: ['breach'], kind: 'sublimit' },
  ],
  finserv: [
    { name: 'Incident response and forensics', limitM: 150, retention: 'Nil for first 48 h', note: 'Panel or pre-approved vendors only', scenarios: ['rw', 'breach', 'insider'], kind: 'full' },
    { name: 'Ransomware and cyber extortion', limitM: 75, note: 'Board approval and sanctions screening required', scenarios: ['rw'], kind: 'sublimit' },
    { name: 'Business interruption (network security failure)', limitM: 150, waiting: '8 h', note: 'Measured against FCA impact tolerances', scenarios: ['rw', 'ddos'], kind: 'full' },
    { name: 'Dependent BI (critical ICT providers)', limitM: 50, waiting: '10 h', note: 'Azure, AWS, FIS, Temenos named', scenarios: ['cloud'], kind: 'sublimit' },
    { name: 'System failure (non-malicious)', limitM: 50, waiting: '12 h', note: 'Covers own-system outages', scenarios: ['cloud'], kind: 'sublimit' },
    { name: 'Social engineering fraud', limitM: 5, note: 'Funds transfer fraud sits in the bankers blanket bond', scenarios: ['bec', 'swift'], kind: 'sublimit' },
    { name: 'Regulatory fines and penalties (where insurable)', limitM: 25, note: 'FCA and PRA fines uninsurable in the UK; DORA, GDPR elsewhere per law', scenarios: ['breach', 'insider'], kind: 'sublimit' },
    { name: 'PCI fines and assessments', limitM: 10, note: 'Card brand assessments for Aldersgate Payments', scenarios: ['breach'], kind: 'sublimit' },
    { name: 'Privacy liability and defence', limitM: 150, note: 'Including US class actions (Markets)', scenarios: ['breach', 'insider'], kind: 'full' },
  ],
  media: [
    { name: 'Incident response and forensics', limitM: 25, retention: 'Nil for panel vendors', note: 'Includes leak takedown and watermark analysis', scenarios: ['rw', 'leak', 'breach'], kind: 'full' },
    { name: 'Ransomware and cyber extortion', limitM: 10, note: 'Includes content-leak extortion demands', scenarios: ['rw', 'leak'], kind: 'sublimit' },
    { name: 'Business interruption (network security failure)', limitM: 25, waiting: '10 h', note: 'Post-production delay measured on delivery-date slippage', scenarios: ['rw', 'live'], kind: 'full' },
    { name: 'Dependent BI', limitM: 5, waiting: '10 h', note: 'CDN, dailies platform, render cloud', scenarios: ['tp'], kind: 'sublimit' },
    { name: 'Pre-release content leak (buy-back)', limitM: 5, note: 'Response, takedown and re-marketing; lost box office excluded', scenarios: ['leak', 'insider'], kind: 'endorsement' },
    { name: 'Media liability', limitM: 10, note: 'Defamation and IP claims arising from a security failure', scenarios: ['leak'], kind: 'sublimit' },
    { name: 'Social engineering fraud', limitM: 0.5, note: 'Call-back required above $10k', scenarios: ['bec'], kind: 'sublimit' },
    { name: 'Regulatory fines and penalties (where insurable)', limitM: 5, note: 'CCPA, UK GDPR', scenarios: ['breach'], kind: 'sublimit' },
    { name: 'PCI fines and assessments', limitM: 2, note: 'KestrelPlay payment pages', scenarios: ['breach'], kind: 'sublimit' },
  ],
  healthcare: [
    { name: 'Incident response and forensics', limitM: 40, retention: 'Nil for panel vendors', note: 'HexaShield DFIR on the Beazley panel', scenarios: ['rw', 'ephi', 'device'], kind: 'full' },
    { name: 'Ransomware and cyber extortion', limitM: 10, note: 'OFAC screening; 50% coinsurance above $5M', scenarios: ['rw'], kind: 'sublimit' },
    { name: 'Business interruption incl. diversion', limitM: 40, waiting: '8 h', note: 'Diversion and cancelled procedures measured per day', scenarios: ['rw', 'device'], kind: 'full' },
    { name: 'Dependent BI (clearinghouse and IT providers)', limitM: 5, waiting: '12 h', note: 'Change Healthcare, Epic hosting named', scenarios: ['clearing'], kind: 'sublimit' },
    { name: 'Privacy liability and notification', limitM: 40, note: 'Includes class-action defence', scenarios: ['ephi', 'insider'], kind: 'full' },
    { name: 'Regulatory defence and penalties (HIPAA, state AG)', limitM: 5, note: 'Where insurable by law', scenarios: ['ocr', 'ephi'], kind: 'sublimit' },
    { name: 'Social engineering fraud', limitM: 1, note: 'Call-back required for supplier and payroll changes', scenarios: ['bec'], kind: 'sublimit' },
    { name: 'Bodily injury from device compromise', limitM: null, note: 'Excluded: responds under medical malpractice and GL', scenarios: ['device'], kind: 'excluded' },
  ],
  automotive: [
    { name: 'Incident response and forensics', limitM: 120, retention: 'Nil for first 48 h', note: 'Panel or pre-approved OT recovery partners', scenarios: ['plant', 'fleet', 'ip'], kind: 'full' },
    { name: 'Ransomware and cyber extortion', limitM: 40, note: 'Board approval and sanctions screening', scenarios: ['plant'], kind: 'sublimit' },
    { name: 'Business interruption (plants)', limitM: 120, waiting: '12 h', note: 'Lost production per day per plant, incl. extra shifts', scenarios: ['plant', 'battery'], kind: 'full' },
    { name: 'Dependent BI (IT and dealer SaaS)', limitM: 20, waiting: '12 h', note: 'DealerCore, T-Systems named', scenarios: ['dealer'], kind: 'sublimit' },
    { name: 'Contingent BI (named JIS suppliers)', limitM: 25, waiting: '24 h', note: '31 just-in-sequence suppliers scheduled', scenarios: ['supplier'], kind: 'sublimit' },
    { name: 'Vehicle cyber incident (fleet response)', limitM: 15, note: 'Endorsement: vSOC response and OTA remediation; recall excluded', scenarios: ['fleet'], kind: 'endorsement' },
    { name: 'Social engineering fraud', limitM: 2.5, note: 'SAP supplier-master four-eyes required', scenarios: ['bec'], kind: 'sublimit' },
    { name: 'Loss of IP value', limitM: null, note: 'Excluded: only response costs are covered', scenarios: ['ip'], kind: 'excluded' },
  ],
};

export function sublimits(c: CustomerProfile): Sublimit[] {
  return forCustomer(SUBLIMITS, c);
}

export interface TowerLayer {
  carrier: string;
  attachM: number;
  limitM: number;
  role: string;
  premiumK: number;
}

/** Tower layers per customer: [carrier, attachment, limit, role, share of premium]. */
const TOWERS: CustomerMap<[string, number, number, string, number][]> = {
  finserv: [['AIG', 0, 25, 'Primary', 0.46], ['Chubb', 25, 50, '1st excess', 0.33], ['Zurich', 75, 75, '2nd excess', 0.21]],
  automotive: [['Allianz', 0, 40, 'Primary', 0.5], ['Munich Re', 40, 40, '1st excess', 0.3], ['AXA XL', 80, 40, '2nd excess', 0.2]],
  healthcare: [['Beazley', 0, 20, 'Primary', 0.64], ['Coalition', 20, 20, 'Excess', 0.36]],
  maritime: [['Beazley (60%) / Munich Re (40%)', 0, 25, 'Primary (quota share)', 0.68], ['Munich Re', 25, 25, 'Excess', 0.32]],
  media: [['Hiscox', 0, 10, 'Primary', 0.7], ['Coalition', 10, 15, 'Excess', 0.3]],
  insurance: [['Beazley', 0, 25, 'Primary', 0.5], ['AXA XL', 25, 25, '1st excess', 0.3], ['Chubb (50%) / Travelers (50%)', 50, 25, '2nd excess (quota share)', 0.2]],
  defence: [['Beazley', 0, 5, 'Primary', 0.7], ['Coalition', 5, 5, 'Excess', 0.3]],
  pharma: [['Swiss Re Corporate Solutions', 0, 50, 'Primary', 0.62], ['Beazley', 50, 100, 'Excess', 0.38]],
  sghospital: [['Chubb', 0, 10, 'Primary', 0.72], ['Beazley', 10, 5, 'Excess', 0.28]],
  studio: [['AIG', 0, 50, 'Lead primary', 0.38], ['Beazley', 50, 100, '1st excess', 0.32], ['Chubb', 150, 200, '2nd excess', 0.3]],
};

export function tower(c: CustomerProfile): TowerLayer[] {
  const p = c.insurance.premiumK;
  return forCustomer(TOWERS, c).map(([carrier, attachM, limitM, role, share]) => ({ carrier, attachM, limitM, role, premiumK: Math.round(p * share) }));
}

export interface Exclusion {
  name: string;
  wording: string;
  risk: 'high' | 'medium' | 'low';
  impact: string;
  evidence: string;
}

const COMMON_EXCLUSIONS = (c: CustomerProfile): Exclusion[] => [
  { name: 'War and state-backed cyber operations', wording: 'LMA 5567A-style war, cyber war and cyber operation exclusion', risk: c.dataKey === 'maritime' ? 'high' : 'medium', impact: 'Losses from a cyber operation by or on behalf of a state that impairs a state\'s essential services may be excluded, including spillover.', evidence: 'HexaInt attribution notes and intrusion-set mapping are preserved so the attribution question can be argued with evidence.' },
  { name: 'Unpatched known vulnerability', wording: 'Coinsurance rises to 50% where loss arises from a CVE with a patch available for more than 45 days', risk: c.dataKey === 'finserv' ? 'low' : 'medium', impact: forCustomer({ maritime: '2 KEV vulnerabilities on terminal gateways are at 23 days; the clause bites at 45.', media: 'Screener portal findings are 24 days old; the clause bites at 45.', healthcare: '2 KEV vulnerabilities on community-hospital NetScalers are at 19 days; the clause bites at 45.', automotive: '1 KEV on the dealer VPN is at 12 days; the clause bites at 45.', finserv: 'No internet-facing critical older than 7 days today.', insurance: 'The KEV flaw on the MFT server is at 11 days; the clause bites at 45.', defence: '9 Linux hosts at the Tucson range carry criticals at 38 days; the clause bites at 45.', pharma: 'No internet-facing critical older than 9 days; plant OT patches follow validated change windows.', sghospital: 'The FortiGate SSL-VPN KEV is at 27 days; the clause bites at 45.', studio: 'Osaka resort scan uploads lag by 3 hours; no internet-facing critical older than 14 days.' } as CustomerMap<string>, c), evidence: 'HexaView timestamps patch state per asset daily, so the age of a CVE at time of loss is provable.' },
  { name: 'Infrastructure failure', wording: 'Failure of power, telecoms or internet backbone not under the insured\'s control', risk: 'low', impact: 'Satellite, CDN and utility outages are excluded unless caused by a cyber event on a named provider.', evidence: 'Connector health history shows whether an outage was provider-side.' },
  { name: 'Betterment', wording: 'Costs to improve systems beyond their pre-loss state', risk: 'low', impact: 'Upgrades made during recovery (e.g. replacing EOL systems) are not recoverable.', evidence: 'Asset snapshot at time of loss defines the pre-loss state.' },
];

const SECTOR_EXCLUSIONS: CustomerMap<Exclusion[]> = {
  maritime: [
    { name: 'Institute Cyber Attack Exclusion (CL380)', wording: 'Hull, cargo and property policies exclude loss caused by a computer used as a means of inflicting harm', risk: 'high', impact: 'Physical damage to cranes or vessels from a cyber event falls between the marine and cyber policies; $10M buy-back purchased.', evidence: 'HexaOT and Dragos evidence of OT state supports the buy-back claim.' },
    { name: 'Bodily injury and pollution', wording: 'Bodily injury, property damage and pollution excluded', risk: 'medium', impact: 'A cyber-caused collision, crane drop or ballast discharge falls to P&I and property.', evidence: 'OT read-only monitoring evidence supports P&I notification.' },
  ],
  finserv: [
    { name: 'Funds transfer and trading loss', wording: 'Loss of funds, securities or trading losses excluded (covered by the bankers blanket bond)', risk: 'medium', impact: 'Fraudulent SWIFT payments recover under the bond, not cyber. The two policies must be coordinated.', evidence: 'SWIFT Alliance Access logs and CSP evidence prepared for both insurers.' },
    { name: 'Uninsurable fines', wording: 'Fines uninsurable by law, including FCA and PRA penalties', risk: 'medium', impact: 'UK regulatory fines cannot be recovered; DORA and GDPR fines only where local law allows.', evidence: 'Regulatory notifications and timelines logged to support the defence.' },
  ],
  media: [
    { name: 'Loss of future revenue from leaked content', wording: 'Lost profits, box office or licensing income from disclosure of content excluded', risk: 'high', impact: 'The largest component of a pre-release leak is not covered; only response and re-marketing under the $5M buy-back.', evidence: 'HexaCustody chain of custody and watermark analysis prove the vendor source for subrogation.' },
    { name: 'Intellectual property infringement', wording: 'IP infringement, except media liability arising from a security failure', risk: 'medium', impact: 'Claims from rights holders after a leak may be excluded.', evidence: 'Custody records show reasonable security under talent and distribution contracts.' },
  ],
  healthcare: [
    { name: 'Bodily injury and medical malpractice', wording: 'Bodily injury, sickness or death excluded, including from a compromised medical device', risk: 'high', impact: 'Patient harm from diversion or a disrupted infusion pump falls to the malpractice and GL policies, which may carry their own cyber exclusions.', evidence: 'Claroty device state and HexaOT timelines show what each device did and when, for both insurers.' },
    { name: 'Regulatory fines uninsurable by law', wording: 'Fines and penalties where uninsurable; HIPAA civil money penalties covered only where state law permits', risk: 'medium', impact: 'OCR penalties may be partly uninsurable; corrective action plan costs are not covered.', evidence: 'Risk analysis, BAAs and access-review evidence logged continuously to show reasonable diligence.' },
  ],
  automotive: [
    { name: 'Product recall and vehicle defects', wording: 'Costs to recall, repair or replace products, including vehicles, excluded', risk: 'high', impact: 'A fleet-wide OTA fix is covered only as response under the vehicle endorsement; a physical recall falls to the product recall policy.', evidence: 'vSOC and OTA lineage records show the cyber cause, supporting allocation between policies.' },
    { name: 'Loss of intellectual property value', wording: 'Loss of value of trade secrets or IP excluded', risk: 'high', impact: 'Theft of Project Lumen designs or VC-7 cell chemistry is not compensated; only investigation costs are.', evidence: 'HexaCustody and Teamcenter access records support legal action against the source.' },
  ],
};

export function exclusions(c: CustomerProfile): Exclusion[] {
  return [...forCustomer(SECTOR_EXCLUSIONS, c), ...COMMON_EXCLUSIONS(c)];
}

export interface PolicyYear {
  year: string;
  premiumK: number;
  limitM: number;
  retentionK: number;
  modelled?: boolean;
}

const HISTORY: CustomerMap<[number, number, number][]> = {
  maritime: [[820, 25, 500], [1310, 35, 1000], [1520, 50, 1000], [1480, 50, 1000]],
  finserv: [[3900, 100, 2500], [6100, 100, 5000], [6800, 150, 5000], [6500, 150, 5000]],
  media: [[380, 15, 250], [610, 20, 500], [720, 25, 500], [670, 25, 500]],
  healthcare: [[1100, 20, 1000], [2300, 25, 1500], [2900, 35, 2000], [2800, 40, 2000]],
  automotive: [[2600, 75, 5000], [4700, 100, 10000], [5900, 120, 10000], [5600, 120, 10000]],
};

export function policyHistory(c: CustomerProfile): PolicyYear[] {
  const h = headlines(c).insurance;
  const y0 = new Date().getFullYear() - 4;
  const rows: PolicyYear[] = forCustomer(HISTORY, c).map(([p, l, r], i) => ({ year: `${y0 + i}`, premiumK: p, limitM: l, retentionK: r }));
  rows.push({ year: `${y0 + 4}`, premiumK: c.insurance.premiumK, limitM: c.insurance.limitM, retentionK: c.insurance.retentionK });
  rows.push({ year: `${y0 + 5} (modelled)`, premiumK: Math.round(c.insurance.premiumK * (1 + h.premiumDeltaPct / 100)), limitM: c.insurance.limitM, retentionK: c.insurance.retentionK, modelled: true });
  return rows;
}

export function marketIndex(): { q: string; pct: number }[] {
  const now = new Date();
  const vals = [34, 22, 11, -2, -6, -8, -6, -7, -5, -4, -3, -2];
  return vals.map((pct, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i) * 3, 1);
    return { q: `Q${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`, pct };
  });
}

export const PEERS: CustomerMap<{ label: string; rol: number; limitToRevenue: number; retentionPct: number }[]> = {
  maritime: [
    { label: 'Halcyon', rol: 2.9, limitToRevenue: 1.76, retentionPct: 2 },
    { label: 'Peer median (ports & shipping)', rol: 3.4, limitToRevenue: 1.4, retentionPct: 2.5 },
    { label: 'Top quartile', rol: 2.6, limitToRevenue: 2.2, retentionPct: 1.5 },
  ],
  finserv: [
    { label: 'Aldersgate', rol: 4.1, limitToRevenue: 2.17, retentionPct: 3.3 },
    { label: 'Peer median (tier 2 banks)', rol: 4.6, limitToRevenue: 1.9, retentionPct: 4 },
    { label: 'Top quartile', rol: 3.7, limitToRevenue: 2.6, retentionPct: 2.8 },
  ],
  media: [
    { label: 'Kestrel', rol: 2.8, limitToRevenue: 2.02, retentionPct: 2 },
    { label: 'Peer median (studios & streaming)', rol: 2.6, limitToRevenue: 2.3, retentionPct: 2 },
    { label: 'Top quartile', rol: 2.2, limitToRevenue: 3.1, retentionPct: 1.6 },
  ],
  healthcare: [
    { label: 'Mercy Ridge', rol: 6.9, limitToRevenue: 0.98, retentionPct: 5 },
    { label: 'Peer median (health systems)', rol: 7.4, limitToRevenue: 0.9, retentionPct: 5.5 },
    { label: 'Top quartile', rol: 6.1, limitToRevenue: 1.4, retentionPct: 4 },
  ],
  automotive: [
    { label: 'Vireo', rol: 4.5, limitToRevenue: 0.31, retentionPct: 8.3 },
    { label: 'Peer median (European OEMs)', rol: 4.8, limitToRevenue: 0.28, retentionPct: 10 },
    { label: 'Top quartile', rol: 4.1, limitToRevenue: 0.4, retentionPct: 6.5 },
  ],
};

/* =====================================================================
   Insurer evidence pack (control tests + general underwriting questions)
   ===================================================================== */
export type Confidence = 'high' | 'medium' | 'low';
export type AnswerStatus = 'answered' | 'partial' | 'gap';

export interface PackItem {
  id: string;
  section: string;
  q: string;
  a: string;
  status: AnswerStatus;
  confidence: Confidence;
  sources: SourceRef[];
  refreshedMin: number;
  controlId?: ControlId;
  evidenceRef: string;
}

const SECTION: Record<ControlId, string> = {
  mfa: 'Identity & access', pam: 'Identity & access', edr: 'Detection & response', logging: 'Detection & response', ir: 'Detection & response',
  backup: 'Resilience', patch: 'Vulnerability management', eol: 'Vulnerability management', email: 'Email & people', awareness: 'Email & people',
  tprm: 'Third parties & OT', seg: 'Third parties & OT',
};

const RECORDS: CustomerMap<string> = {
  maritime: 'About 180,000 personal records (crew, employees, booking customers); no payment card data stored.',
  finserv: '6.2M customer records including 2.1M card PANs (tokenised in the CDE) and Wealth client KYC data.',
  media: '4.1M KestrelPlay subscribers; card data handled by a PCI-compliant processor; talent and crew PII.',
  healthcare: '1.9M patient records (ePHI) in Epic, 410k MyChart accounts, 62k genomics research subjects; patient payments via a PCI-compliant processor.',
  automotive: '2.1M connected-vehicle owners and location histories, 3.4M dealer customer records, 64,000 employees; card data held by payment providers.',
};
const PRIOR: CustomerMap<string> = {
  maritime: '1 claim in 5 years above retention (2022 dependent BI, Navis outage). 2 incidents below retention since.',
  finserv: '1 social-engineering claim paid in 2024 (£1.4M after retention). No ransomware events.',
  media: '1 open notice of circumstances (2025 trailer leak); 1 claim paid in 2024 (credential stuffing).',
  healthcare: '1 dependent BI claim paid in 2024 (clearinghouse outage, $1.1M after retention); 1 ransomware attempt contained without claim.',
  automotive: '1 contingent BI claim paid in 2024 (seat supplier ransomware, €3.8M after retention); dealer SaaS outage below retention.',
};

export function evidencePack(c: CustomerProfile): PackItem[] {
  const r = rng(`ins-pack-${c.id}`);
  const ctl = keyControls(c);
  const items: PackItem[] = [];
  const hd = headlines(c);
  const hc = sourceRef(c, 'c-hexacomply');
  items.push(
    { id: 'GEN-1', section: 'Company profile', q: 'Annual revenue, employees and countries of operation', a: `Revenue ${currencySymbol(c.currency)}${(c.revenueM / 1000).toFixed(2)}bn; ${c.employees.toLocaleString('en-GB')} employees; ${new Set(c.tenants.map((t) => t.country)).size} countries; ${c.tenants.length} operating entities.`, status: 'answered', confidence: 'high', sources: hc ? [hc] : [], refreshedMin: 1440 * 3, evidenceRef: `EV-${r.int(10000, 99999)}` },
    { id: 'GEN-2', section: 'Company profile', q: 'How many personal and payment records do you hold?', a: forCustomer(RECORDS, c), status: 'answered', confidence: 'medium', sources: [sourceRef(c, 'c-netskope') ?? sourceRef(c, 'c-hexacustody'), hc].filter((x): x is SourceRef => !!x), refreshedMin: 1440 * 9, evidenceRef: `EV-${r.int(10000, 99999)}` },
    { id: 'GEN-3', section: 'Governance', q: 'Who owns cyber risk and how often is the board briefed?', a: `${c.people.ciso.name} (${c.people.ciso.role}); quarterly board report generated by HexaView with the Resilience Index and loss quantification.`, status: 'answered', confidence: 'high', sources: hc ? [hc] : [], refreshedMin: 1440 * 21, evidenceRef: `EV-${r.int(10000, 99999)}` },
    { id: 'GEN-4', section: 'Detection & response', q: 'Do you have 24×7 security monitoring? Median time to detect and contain?', a: `Yes. HexaSOC MDR 24×7; median time to detect ${hd.soc.mttdMin} min, to contain ${hd.soc.mttrMin} min; ${hd.soc.slaPct}% SLA met.`, status: 'answered', confidence: 'high', sources: [sourceRef(c, c.connectors.find((k) => k.category === 'SIEM')?.id ?? '')].filter((x): x is SourceRef => !!x), refreshedMin: 5, evidenceRef: `EV-${r.int(10000, 99999)}` },
    { id: 'GEN-5', section: 'Vulnerability management', q: 'What is your external attack surface and how is it tested?', a: `${hd.strike.externalAssets} internet-facing assets under HexaStrike ASM; ${hd.strike.testsThisQuarter} tests this quarter; ${hd.strike.criticalFindings} critical findings open.`, status: hd.strike.criticalFindings > 1 ? 'partial' : 'answered', confidence: 'high', sources: [sourceRef(c, 'c-hexastrike')].filter((x): x is SourceRef => !!x), refreshedMin: 14, evidenceRef: `EV-${r.int(10000, 99999)}` },
    { id: 'GEN-6', section: 'Claims history', q: 'Cyber incidents, claims or circumstances in the last 5 years', a: forCustomer(PRIOR, c), status: 'answered', confidence: 'high', sources: [sourceRef(c, c.connectors.find((k) => k.category === 'ITSM')?.id ?? '')].filter((x): x is SourceRef => !!x), refreshedMin: 1440 * 2, evidenceRef: `EV-${r.int(10000, 99999)}` },
  );
  for (const k of ctl) {
    const worst = k.sources.some((s) => s.stale) ? 'stale' : k.sources.some((s) => s.status !== 'healthy') ? 'degraded' : 'ok';
    const refreshed = Math.max(...k.sources.map((s) => s.lastSyncMin), 1);
    for (const t of k.tests) {
      const status: AnswerStatus = t.ok ? 'answered' : k.ok === 0 ? 'gap' : 'partial';
      const confidence: Confidence = worst === 'stale' || (!t.ok && /Unknown|manual|stale/i.test(t.a)) ? 'low' : worst === 'degraded' || !t.ok ? 'medium' : 'high';
      items.push({ id: t.id, section: SECTION[k.id], q: t.q, a: t.a, status, confidence, sources: k.sources, refreshedMin: refreshed, controlId: k.id, evidenceRef: t.evidenceRef });
    }
  }
  return items;
}

/* =====================================================================
   Claims readiness
   ===================================================================== */
export interface Obligation {
  party: string;
  trigger: string;
  deadline: string;
  hours: number;
  basis: string;
  ready: boolean;
}

const OBLIGATIONS: CustomerMap<Omit<Obligation, 'ready'>[]> = {
  maritime: [
    { party: 'NIS2 CSIRT (NCSC-NL, CCB Belgium)', trigger: 'Significant incident', deadline: 'Early warning 24 h; notification 72 h', hours: 24, basis: 'NIS2 Art. 23' },
    { party: 'Dutch DPA / Belgian DPA', trigger: 'Personal data breach', deadline: '72 h', hours: 72, basis: 'GDPR Art. 33' },
    { party: 'Port facility security officer and port authority', trigger: 'Security incident affecting the port facility', deadline: 'Immediately', hours: 1, basis: 'ISPS Code' },
    { party: 'Flag state and USCG National Response Center', trigger: 'Cyber incident affecting vessel safety (US waters)', deadline: 'Without delay', hours: 2, basis: 'IMO MSC.428(98) · 33 CFR 101.305' },
    { party: 'ANPD (Brazil)', trigger: 'Personal data breach at Santos', deadline: '3 working days', hours: 72, basis: 'LGPD Art. 48' },
  ],
  finserv: [
    { party: 'FCA / PRA', trigger: 'Major operational incident', deadline: 'Initial 4 h after classification (max 24 h from detection)', hours: 4, basis: 'DORA Art. 19 · SUP 15' },
    { party: 'CSSF (Luxembourg)', trigger: 'Major ICT-related incident', deadline: 'Initial 4 h; intermediate 72 h; final 1 month', hours: 4, basis: 'DORA Art. 19' },
    { party: 'ICO', trigger: 'Personal data breach', deadline: '72 h', hours: 72, basis: 'UK GDPR Art. 33' },
    { party: 'NYDFS', trigger: 'Cybersecurity event / ransom payment', deadline: '72 h; ransom payment 24 h', hours: 24, basis: '23 NYCRR 500.17' },
    { party: 'MAS', trigger: 'Relevant incident (Wealth SG)', deadline: '1 h', hours: 1, basis: 'MAS Notice on Technology Risk Management' },
    { party: 'Card schemes and acquirer', trigger: 'Suspected cardholder data compromise', deadline: 'Immediately', hours: 1, basis: 'PCI DSS 12.10 · scheme rules' },
  ],
  media: [
    { party: 'SEC (Form 8-K Item 1.05)', trigger: 'Material cybersecurity incident', deadline: '4 business days after materiality', hours: 96, basis: 'SEC cyber disclosure rule' },
    { party: 'California AG and consumers', trigger: 'Breach of 500+ California residents', deadline: 'Most expedient time', hours: 72, basis: 'Cal. Civ. Code 1798.82' },
    { party: 'ICO (Kestrel Post, Soho)', trigger: 'Personal data breach', deadline: '72 h', hours: 72, basis: 'UK GDPR Art. 33' },
    { party: 'Card brands via acquirer', trigger: 'Suspected compromise of KestrelPlay payments', deadline: 'Immediately', hours: 1, basis: 'PCI DSS 12.10' },
    { party: 'Distribution and talent partners', trigger: 'Leak of pre-release content', deadline: '24 h', hours: 24, basis: 'Distribution agreements · MPA / TPN' },
  ],
  healthcare: [
    { party: 'HHS OCR', trigger: 'Breach of unsecured PHI (500+ individuals)', deadline: '60 days from discovery', hours: 1440, basis: 'HIPAA Breach Notification Rule 164.408' },
    { party: 'Affected patients and media', trigger: 'Breach of unsecured PHI', deadline: 'Without unreasonable delay, max 60 days', hours: 1440, basis: 'HIPAA 164.404 / 164.406' },
    { party: 'Ohio Attorney General', trigger: "Breach of Ohio residents' personal information", deadline: '45 days', hours: 1080, basis: 'Ohio Rev. Code 1349.19' },
    { party: 'FBI and CISA (via HHS HC3)', trigger: 'Ransomware or significant cyber incident', deadline: '72 h (CIRCIA); ransom payment 24 h', hours: 24, basis: 'CIRCIA · HHS HPH guidance' },
    { party: 'Regional EMS and state health department', trigger: 'Emergency department diversion', deadline: 'Immediately', hours: 1, basis: 'Ohio EMS diversion protocol' },
    { party: 'FDA (via OEM) and device manufacturers', trigger: 'Cyber event affecting a medical device', deadline: 'Promptly', hours: 24, basis: 'FDA 524B · MDR 21 CFR 803' },
  ],
  automotive: [
    { party: 'BSI (Germany)', trigger: 'Significant incident at an important entity', deadline: 'Early warning 24 h; notification 72 h', hours: 24, basis: 'NIS2 Art. 23 · NIS2UmsuCG' },
    { party: 'KBA (type-approval authority)', trigger: 'Cyber attack affecting vehicle types in the field', deadline: 'Without delay', hours: 24, basis: 'UNECE R155 7.2.2.4' },
    { party: 'Bavarian DPA (BayLDA) and other EU DPAs', trigger: 'Personal data breach (drivers, dealers)', deadline: '72 h', hours: 72, basis: 'GDPR Art. 33' },
    { party: 'NCSC Hungary', trigger: 'Significant incident at Győr', deadline: 'Early warning 24 h', hours: 24, basis: 'NIS2 Art. 23' },
    { party: 'ENX Association (TISAX)', trigger: 'Incident affecting partner prototype data', deadline: 'Without delay', hours: 24, basis: 'TISAX participant obligations · VDA ISA 1.6' },
    { party: 'JIS suppliers and logistics partners', trigger: 'Production stop affecting call-offs', deadline: '4 h', hours: 4, basis: 'Supply agreements' },
  ],
};

export function obligations(c: CustomerProfile): Obligation[] {
  const ins: Omit<Obligation, 'ready'>[] = [
    { party: `${c.insurance.carrier.split(' ')[0]} (insurer)`, trigger: 'Discovery of an actual or suspected cyber event', deadline: 'As soon as practicable; within 72 h', hours: 72, basis: 'Policy condition 8.1 (notice)' },
    { party: `${c.insurance.broker} (broker)`, trigger: 'Any notification to the insurer', deadline: 'Same time as insurer', hours: 72, basis: 'Broker agreement' },
  ];
  return [...ins, ...forCustomer(OBLIGATIONS, c)].map((o, i) => ({ ...o, ready: !(c.dataKey === 'media' && i === 6) }));
}

export interface PanelVendor {
  role: string;
  firm: string;
  onPanel: boolean;
  engagement: string;
  sla: string;
  status: 'ready' | 'action';
}

export function panel(c: CustomerProfile): PanelVendor[] {
  const counsel = forCustomer({ maritime: 'Hollis Wren LLP (Rotterdam, London)', finserv: 'Ashby Crane LLP (London, New York)', media: 'Marlowe & Vance LLP (Los Angeles)', healthcare: 'Barrow Kline LLP (Columbus, Washington DC)', automotive: 'Lindqvist Rauch Partners (Munich, Frankfurt)', insurance: 'Whitcombe Harte LLP (Hartford, New York)', defence: 'Calloway Brandt LLP (Huntsville, Washington DC)', pharma: 'Rieder Lüthi Partners (Basel, Dublin)', sghospital: 'Tan Ong & Partners LLC (Singapore)', studio: 'Marlowe & Vance LLP (Los Angeles, New York)' } as CustomerMap<string>, c);
  const base: PanelVendor[] = [
    { role: 'Incident response and forensics', firm: 'HexaShield DFIR', onPanel: true, engagement: `Retainer: ${forCustomer({ finserv: 240, automotive: 400, healthcare: 160, insurance: 200, defence: 80, pharma: 320, sghospital: 100, studio: 400 } as Partial<CustomerMap<number>>, c) ?? 120} h, ${forCustomer({ finserv: 188, maritime: 74, automotive: 312, healthcare: 131, insurance: 164, defence: 71, pharma: 266, sghospital: 88, studio: 318 } as Partial<CustomerMap<number>>, c) ?? 96} h remaining`, sla: '1 h response, on site 24 h', status: 'ready' },
    { role: 'Breach counsel', firm: counsel, onPanel: true, engagement: 'Engagement letter signed; privilege protocol agreed', sla: '2 h', status: 'ready' },
    { role: 'Crisis communications', firm: 'Northlight Crisis Partners', onPanel: true, engagement: 'Holding statements pre-drafted for top scenarios', sla: '4 h', status: 'ready' },
    { role: 'Ransom negotiation and sanctions screening', firm: 'Meridian Negotiation Group', onPanel: true, engagement: 'Panel vendor; OFAC / OFSI screening included', sla: '4 h', status: 'ready' },
    { role: 'Notification and call centre', firm: 'ClearNotice Services', onPanel: true, engagement: c.dataKey === 'maritime' ? 'Panel; no pre-staged templates yet' : 'Templates pre-staged per jurisdiction', sla: '48 h', status: c.dataKey === 'maritime' ? 'action' : 'ready' },
    { role: 'Forensic accountants (BI quantification)', firm: 'Harrow Lane Forensic Accounting', onPanel: true, engagement: 'Panel; BI template shared', sla: '72 h', status: 'ready' },
  ];
  const sector: PanelVendor[] = forCustomer({
    healthcare: [{ role: 'Clinical downtime and device recovery', firm: 'Biomed OEM recovery (GE, Philips, BD)', onPanel: false, engagement: 'Not on carrier panel: consent needed for OEM recovery costs', sla: 'Contracted 12 h', status: 'action' as const }],
    automotive: [{ role: 'OT and plant recovery', firm: 'Siemens Digital Industries recovery team', onPanel: true, engagement: 'Pre-approved; PLC project restore runbook tested', sla: '6 h on site', status: 'ready' as const }, { role: 'Vehicle security response', firm: 'Upstream vSOC incident team', onPanel: false, engagement: 'Not on carrier panel: consent requested 9 days ago', sla: '1 h', status: 'action' as const }],
    maritime: [{ role: 'OT restoration (cranes)', firm: 'Konecranes Remote Services', onPanel: false, engagement: 'Not on carrier panel: pre-approval requested 12 days ago', sla: 'Contracted 8 h', status: 'action' as const }],
    finserv: [{ role: 'Payment recall and fraud recovery', firm: 'Treasury fraud desk + SWIFT gpi Stop and Recall', onPanel: true, engagement: 'Runbook tested in Q2', sla: '30 min', status: 'ready' as const }],
    media: [{ role: 'Anti-piracy takedown and watermark analysis', firm: 'Fieldmark Anti-Piracy', onPanel: false, engagement: 'Not on carrier panel: consent needed before engagement', sla: '2 h', status: 'action' as const }],
    insurance: [{ role: 'Claims surge and catastrophe adjusting support', firm: 'Independent adjusting partners (EXL surge team)', onPanel: false, engagement: 'Not on carrier panel: consent needed for surge staffing costs', sla: 'Contracted 24 h', status: 'action' as const }],
    defence: [{ role: 'CUI incident support and DIBNet reporting', firm: 'HexaShield DFIR (US-person team, GCC High)', onPanel: true, engagement: 'Pre-approved; US-person responders and DC3 submission runbook', sla: '2 h', status: 'ready' as const }],
    pharma: [{ role: 'GxP recovery and data-integrity assessment', firm: 'Validation partner (CSV and data-integrity specialists)', onPanel: false, engagement: 'Not on carrier panel: consent needed for revalidation costs', sla: 'Contracted 24 h', status: 'action' as const }],
    sghospital: [{ role: 'Clinical downtime and device recovery', firm: 'Biomed OEM recovery (GE HealthCare, Philips, BD)', onPanel: false, engagement: 'Not on carrier panel: consent needed for OEM recovery costs', sla: 'Contracted 12 h', status: 'action' as const }],
    studio: [{ role: 'Anti-piracy takedown and watermark analysis', firm: 'Fieldmark Anti-Piracy', onPanel: true, engagement: 'Added to the panel at renewal; takedown runbook shared', sla: '2 h', status: 'ready' as const }],
  } as CustomerMap<PanelVendor[]>, c);
  return [...base, ...sector];
}

export interface VaultItem {
  artefact: string;
  source: SourceRef | null;
  retention: string;
  immutable: boolean;
  sizeTB: number;
  anchoredMin: number;
  ready: boolean;
}

const VAULT_EXTRA: CustomerMap<(c: CustomerProfile) => VaultItem[]> = {
  maritime: (c) => [{ artefact: 'OT packet captures and asset state (terminals, fleet)', source: sourceRef(c, 'c-hexaot'), retention: '30 days rolling, frozen on legal hold', immutable: true, sizeTB: 12, anchoredMin: 31, ready: false }],
  finserv: (c) => [{ artefact: 'SWIFT Alliance Access journal and CSP logs', source: sourceRef(c, 'c-swift'), retention: '5 years', immutable: true, sizeTB: 3.1, anchoredMin: 5, ready: true }],
  healthcare: (c) => [{ artefact: 'Epic access audit and break-the-glass events', source: sourceRef(c, 'c-epic'), retention: '6 years (HIPAA)', immutable: true, sizeTB: 4.2, anchoredMin: 150, ready: false }, { artefact: 'Medical device state and network captures', source: sourceRef(c, 'c-claroty'), retention: '30 days rolling, frozen on legal hold', immutable: true, sizeTB: 9.6, anchoredMin: 8, ready: true }],
  automotive: (c) => [{ artefact: 'Vehicle security events and OTA lineage', source: sourceRef(c, 'c-upstream'), retention: '3 years (R155)', immutable: true, sizeTB: 38, anchoredMin: 2, ready: true }, { artefact: 'Air-gapped battery plant bundles (signed)', source: sourceRef(c, 'c-hexaot'), retention: '1 year, bundle every 6 h', immutable: true, sizeTB: 2.4, anchoredMin: 360, ready: true }],
  media: (c) => [{ artefact: 'Chain of custody and watermark records', source: sourceRef(c, 'c-hexacustody'), retention: 'Title life + 3 years', immutable: true, sizeTB: 1.8, anchoredMin: 1, ready: true }],
  insurance: (c) => [{ artefact: 'Guidewire ClaimCenter and BillingCenter audit history', source: sourceRef(c, 'c-guidewire'), retention: '7 years (NAIC MAR)', immutable: true, sizeTB: 6.4, anchoredMin: 140, ready: false }, { artefact: 'Mainframe RACF and SMF records', source: sourceRef(c, 'c-mainframe'), retention: '5 years (NYDFS 500.6)', immutable: true, sizeTB: 2.2, anchoredMin: 9, ready: true }],
  defence: (c) => [{ artefact: 'CUI enclave images and memory captures (DFARS 7012(e))', source: sourceRef(c, 'c-defender'), retention: '90 days minimum, frozen on legal hold', immutable: true, sizeTB: 3.6, anchoredMin: 3, ready: true }, { artefact: 'Teamcenter ITAR access and export history', source: sourceRef(c, 'c-teamcenter'), retention: '5 years (ITAR 122.5)', immutable: true, sizeTB: 0.9, anchoredMin: 17, ready: true }],
  pharma: (c) => [{ artefact: 'GxP audit trails (Vault, Rave, LabWare, PAS-X)', source: sourceRef(c, 'c-labware'), retention: 'Product life + 1 year (Annex 11)', immutable: true, sizeTB: 7.8, anchoredMin: 190, ready: false }, { artefact: 'Plant DCS event chronicles and OT captures', source: sourceRef(c, 'c-claroty'), retention: '30 days rolling, frozen on legal hold', immutable: true, sizeTB: 11.2, anchoredMin: 8, ready: true }],
  sghospital: (c) => [{ artefact: 'TrakCare and NEHR access audit', source: sourceRef(c, 'c-trakcare'), retention: '6 years (HIA)', immutable: true, sizeTB: 2.6, anchoredMin: 155, ready: false }, { artefact: 'Medical device state and network captures', source: sourceRef(c, 'c-claroty'), retention: '30 days rolling, frozen on legal hold', immutable: true, sizeTB: 4.1, anchoredMin: 8, ready: true }],
  studio: (c) => [{ artefact: 'Chain of custody and watermark records', source: sourceRef(c, 'c-hexacustody'), retention: 'Title life + 3 years', immutable: true, sizeTB: 6.2, anchoredMin: 1, ready: true }, { artefact: 'Ride and show control captures (Orlando, Osaka)', source: sourceRef(c, 'c-claroty'), retention: '30 days rolling, frozen on legal hold', immutable: true, sizeTB: 14, anchoredMin: 7, ready: true }],
};

export function vault(c: CustomerProfile): VaultItem[] {
  const anchor = headlines(c).ops.lastAnchorMin;
  const siem = c.connectors.find((k) => k.category === 'SIEM')?.id ?? '';
  const edr = c.connectors.find((k) => k.category === 'EDR / XDR')?.id ?? '';
  const idp = c.connectors.find((k) => k.category === 'Identity')?.id ?? '';
  const email = c.connectors.find((k) => k.category === 'Email')?.id ?? '';
  const backup = c.connectors.find((k) => k.category === 'Backup')?.id ?? '';
  const rows: VaultItem[] = [
    { artefact: 'SIEM detections and raw security logs', source: sourceRef(c, siem), retention: c.dataKey === 'finserv' || c.dataKey === 'automotive' ? '13 months' : c.dataKey === 'maritime' || c.dataKey === 'healthcare' ? '400 days' : '12 months', immutable: true, sizeTB: forCustomer({ finserv: 412, maritime: 168, media: 74, healthcare: 236, automotive: 520, insurance: 286, defence: 38, pharma: 610, sghospital: 64, studio: 940 } as CustomerMap<number>, c), anchoredMin: anchor, ready: true },
    { artefact: 'EDR telemetry and process trees', source: sourceRef(c, edr), retention: '180 days', immutable: true, sizeTB: forCustomer({ finserv: 96, maritime: 31, media: 18, healthcare: 58, automotive: 140, insurance: 64, defence: 9, pharma: 180, sghospital: 21, studio: 230 } as CustomerMap<number>, c), anchoredMin: anchor + 2, ready: true },
    { artefact: 'Identity sign-ins and admin audit', source: sourceRef(c, idp), retention: '2 years', immutable: true, sizeTB: c.dataKey === 'finserv' ? 22 : 6, anchoredMin: anchor + 1, ready: true },
    { artefact: 'Email message trace and threat events', source: sourceRef(c, email), retention: '1 year', immutable: true, sizeTB: c.dataKey === 'finserv' ? 15 : 4, anchoredMin: anchor + 3, ready: true },
    { artefact: 'Backup catalogue and immutability state', source: backup ? sourceRef(c, backup) : null, retention: '1 year', immutable: !!backup, sizeTB: 0.4, anchoredMin: backup ? (c.connectors.find((k) => k.id === backup)?.lastSyncMin ?? 60) : 0, ready: c.dataKey === 'finserv' || c.dataKey === 'automotive' },
    { artefact: 'Control attestation history (point-in-time)', source: sourceRef(c, 'c-hexacomply'), retention: '7 years', immutable: true, sizeTB: 0.2, anchoredMin: anchor, ready: true },
  ];
  rows.push(...forCustomer(VAULT_EXTRA, c)(c));
  return rows;
}

export interface BiLine {
  service: string;
  metric: string;
  hourlyLossK: number;
  waitingH: number;
  source: string;
  extraExpense: string;
}

export function biTemplate(c: CustomerProfile): BiLine[] {
  const perHour = (c.revenueM * 1000) / 8760;
  const defs: CustomerMap<[string, string, number, string, string][]> = {
    maritime: [
      ['Vessel berthing & discharge', 'Quay crane moves per hour vs baseline', 0.34, 'Navis N4 TOS', 'Overtime, diverted vessel charges'],
      ['Gate-in / gate-out', 'Gate transactions per hour', 0.12, 'Navis N4 TOS · Gate OCR', 'Manual gate staff, truck waiting penalties'],
      ['Yard automation', 'AGV moves completed', 0.1, 'HexaOT · AGV controller', 'Manual straddle carriers'],
      ['Customs clearance', 'Manifests processed (Portbase)', 0.06, 'ServiceNow · Portbase', 'Customs broker surge fees'],
      ['Fleet navigation & propulsion', 'Vessel days off-hire', 0.22, 'Fleet ops · HexaOT fleet', 'Port-state detention, charter penalties'],
      ['Billing & invoicing', 'Invoices issued (SAP)', 0.04, 'SAP S/4HANA', 'Delayed cash collection financing'],
    ],
    finserv: [
      ['Retail payments (Faster Payments)', 'Payments processed vs forecast', 0.22, 'Splunk ES · payment switch', 'Customer redress, overtime'],
      ['Card acquiring', 'Authorisations per minute', 0.2, 'Card switch telemetry', 'Merchant compensation, scheme fees'],
      ['Online & mobile banking', 'Active sessions vs baseline', 0.12, 'Splunk ES · CDN', 'Contact centre surge'],
      ['Equities trading', 'Orders routed (OMS)', 0.18, 'OMS · Bloomberg', 'Manual trading desk costs'],
      ['Wealth onboarding', 'Accounts opened', 0.03, 'ServiceNow', 'Deferred onboarding'],
      ['Treasury & liquidity', 'Settlement breaks', 0.05, 'Kyriba · SWIFT', 'Intraday liquidity costs'],
    ],
    media: [
      ['Dailies & editorial', 'Editorial hours lost per title', 0.08, 'MAM · HexaCustody', 'Crew standby, facility rental'],
      ['VFX & finishing', 'Render core-hours vs schedule', 0.16, 'Render farm scheduler (OCSF)', 'Cloud render burst, overtime'],
      ['Mastering & delivery', 'Delivery-date slippage', 0.1, 'Jira · Deluxe Distribution', 'Late-delivery penalties'],
      ['Streaming playback', 'Concurrent streams vs baseline', 0.3, 'KestrelPlay telemetry', 'Subscriber credits, churn offers'],
      ['Subscriber billing', 'Successful renewals', 0.18, 'Payment processor', 'Retry and dunning costs'],
      ['Live sports playout', 'Minutes off-air', 0.2, 'HexaOT broadcast', 'Rights-holder penalties, make-goods'],
    ],
    healthcare: [
      ['Emergency department (diversion)', 'Ambulance arrivals diverted vs baseline', 0.22, 'Epic ADT · EMS feed', 'Agency staff, transfer costs'],
      ['Elective surgery', 'Cases cancelled per day', 0.26, 'Epic OpTime', 'Overtime to clear backlog'],
      ['Imaging & radiology', 'Studies read per hour', 0.14, 'PACS · Claroty xDome utilisation', 'Outsourced reads (teleradiology)'],
      ['Laboratory results', 'Results released per hour', 0.08, 'Lab information system', 'Reference lab send-outs'],
      ['Pharmacy & medication administration', 'Doses scanned (BCMA)', 0.06, 'Omnicell · Epic MAR', 'Manual double checks'],
      ['Claims & revenue cycle', 'Claims submitted per day', 0.18, 'Clearinghouse · Epic Resolute', 'Bridge financing, manual billing staff'],
    ],
    automotive: [
      ['Vehicle production, Ingolstadt', 'Vehicles off the line vs plan (≈ 1,100 / day)', 0.24, 'MES · SAP PP', 'Extra shifts, expedited freight'],
      ['Powertrain & e-drive, Győr', 'Units built vs JIS call-off', 0.12, 'MES (Győr) · Armis', 'Weekend shifts'],
      ['Assembly, Puebla', 'Vehicles off the line vs plan', 0.1, 'MES (Puebla)', 'Overtime, air freight'],
      ['Battery cells, Salzgitter', 'Cells through formation per hour', 0.08, 'HexaOT bundles (air-gapped)', 'Scrapped cells, re-validation'],
      ['Connected services & OTA', 'Active vehicle sessions vs baseline', 0.05, 'Upstream vSOC · vehicle cloud', 'Customer goodwill, call centre'],
      ['Dealer sales & service', 'Orders and service bookings', 0.16, 'DealerCore DMS', 'Manual contracts, dealer compensation'],
    ],
    insurance: [
      ['First notice of loss & claims payments', 'Claims paid per hour vs baseline', 0.3, 'Guidewire ClaimCenter · One Inc', 'Surge adjusters, manual cheque runs'],
      ['Quote & bind', 'Quotes bound per hour', 0.2, 'Guidewire PolicyCenter · AgentHub', 'Agent goodwill, manual binders'],
      ['Premium billing & payments', 'Premium collected per day', 0.18, 'Guidewire BillingCenter · One Inc', 'Grace-period extensions, lockbox fees'],
      ['Policy issuance & renewals', 'Renewals issued per day', 0.12, 'Guidewire PolicyCenter · print & mail', 'Overtime, print vendor surge'],
      ['Mainframe legacy book', 'Batch jobs completed', 0.1, 'z/OS SMF · Splunk ES', 'Recovery-site LPAR costs'],
      ['Annuity servicing', 'Payouts processed', 0.04, 'Majesco L&A', 'Manual payout schedule'],
    ],
    defence: [
      ['Precision machining (Building 3)', 'Machine hours lost vs schedule', 0.34, 'Armis · DNC server', 'Overtime, expedited outside machining'],
      ['Programme deliveries to primes', 'Milestones slipped', 0.26, 'Costpoint · programme schedules', 'Late-delivery penalties'],
      ['Engineering & flight software', 'Engineering hours lost', 0.18, 'GitHub Enterprise · Teamcenter', 'Contract engineers'],
      ['Range test campaigns', 'Campaign days lost', 0.1, 'Tucson range telemetry', 'Range re-booking costs'],
      ['Finance & timekeeping', 'Billing days delayed', 0.05, 'Costpoint GovCloud', 'Manual timekeeping staff'],
      ['Proposals & capture', 'Bid deadlines at risk', 0.04, 'M365 GCC High', 'Proposal surge support'],
    ],
    pharma: [
      ['Batch release (Valais)', 'Batches released per day vs plan', 0.3, 'PAS-X · LabWare', 'Paper batch records, QA overtime'],
      ['Aseptic fill-finish (Cork)', 'Vials filled per hour', 0.22, 'HexaOT · filling line PLCs', 'Media fills, revalidation'],
      ['Serialised supply & cold chain', 'Packs shipped per day', 0.18, 'Serialisation L3 · SAP', 'Manual aggregation, expedited freight'],
      ['Clinical trial conduct', 'Patient visits completed', 0.12, 'Medidata Rave · Veeva eTMF', 'Paper CRFs, CRO surge fees'],
      ['Regulatory submissions', 'Submission days slipped', 0.08, 'eCTD publishing · Veeva RIM', 'Agency meeting rescheduling'],
      ['Discovery research', 'Compute hours lost', 0.04, 'HPC scheduler · ELN', 'Cloud burst compute'],
    ],
    sghospital: [
      ['A&E (diversion)', 'Ambulance arrivals diverted vs baseline', 0.24, 'TrakCare ADT', 'Agency staff, transfer costs'],
      ['Elective surgery & day surgery', 'Cases cancelled per day', 0.28, 'Theatre scheduling', 'Overtime to clear backlog'],
      ['Imaging & radiology', 'Studies read per hour', 0.14, 'PACS · Claroty utilisation', 'Outsourced reads'],
      ['Laboratory results', 'Results released per hour', 0.1, 'LIS · Lion City Pathology', 'Reference lab send-outs'],
      ['International patients', 'Admissions deferred', 0.12, 'TrakCare · referral partners', 'Re-booking and travel costs'],
      ['Billing & insurer claims', 'Claims submitted per day', 0.12, 'Patient billing · insurer portals', 'Manual claims staff'],
    ],
    studio: [
      ['Starfall+ streaming', 'Concurrent streams vs baseline', 0.3, 'Starfall+ telemetry · Akamai', 'Subscriber credits, churn offers'],
      ['Subscriptions & payments', 'Successful renewals', 0.16, 'Billing platform · Adyen', 'Retry and dunning costs'],
      ['Park operations (Orlando, Osaka)', 'Guests admitted and rides operating', 0.28, 'StarPass · Claroty xDome', 'Guest refunds, extra staff'],
      ['VFX & finishing', 'Render core-hours vs schedule', 0.1, 'Render scheduler (OCSF)', 'Cloud render burst'],
      ['Mastering & delivery', 'Delivery-date slippage', 0.08, 'Aspera · Deluxe', 'Late-delivery penalties'],
      ['Consumer products e-commerce', 'Orders per hour', 0.08, 'E-commerce platform', 'Marketplace fees'],
    ],
  };
  const wait = forCustomer({ maritime: 12, automotive: 12, finserv: 8, healthcare: 8, media: 10, insurance: 8, defence: 12, pharma: 12, sghospital: 8, studio: 10 } as CustomerMap<number>, c);
  return forCustomer(defs, c).map(([service, metric, share, source, extraExpense]) => ({ service, metric, hourlyLossK: Math.round(perHour * share * 3.2), waitingH: wait, source, extraExpense }));
}

export interface PriorEvent {
  date: string;
  title: string;
  category: string;
  lossM: number;
  claimed: 'Claim paid' | 'Below retention' | 'Notice of circumstances' | 'No claim' | 'Open';
  paidM: number;
  lesson: string;
}

const PRIORS: CustomerMap<Omit<PriorEvent, 'date'>[]> = {
  maritime: [
    { title: 'BEC: fraudulent bank change by spoofed bunker supplier', category: 'BEC / payment fraud', lossM: 0.42, claimed: 'Below retention', paidM: 0, lesson: 'Call-back procedure made mandatory; Proofpoint impostor rules added.' },
    { title: 'Port Klang gate OCR outage (malware on lane controller)', category: 'OT disruption', lossM: 0.9, claimed: 'Notice of circumstances', paidM: 0, lesson: 'Triggered the Port Klang segmentation project.' },
    { title: 'Ransomware attempt on Antwerp file server, contained in 38 min', category: 'Ransomware', lossM: 0.12, claimed: 'No claim', paidM: 0, lesson: 'Validated HexaSOC isolation authority.' },
    { title: 'USB malware on Halcyon Aurora ECDIS, 19 h delay', category: 'OT disruption', lossM: 0.35, claimed: 'No claim', paidM: 0, lesson: 'Cyber off-hire endorsement purchased at next renewal.' },
    { title: 'Navis cloud outage (dependent BI)', category: 'Third-party outage', lossM: 1.6, claimed: 'Claim paid', paidM: 0.6, lesson: 'Dependent BI sublimit raised to $15M.' },
  ],
  finserv: [
    { title: 'BEC: fraudulent supplier bank change in treasury', category: 'BEC / payment fraud', lossM: 6.4, claimed: 'Claim paid', paidM: 1.4, lesson: 'Dual control extended to all supplier changes; BEC drills quarterly.' },
    { title: 'DDoS on online banking (4 h degraded)', category: 'Availability', lossM: 0.9, claimed: 'No claim', paidM: 0, lesson: 'Always-on scrubbing contract renegotiated.' },
    { title: 'Third-party file-transfer zero-day at payroll provider', category: 'Data breach', lossM: 1.2, claimed: 'Notice of circumstances', paidM: 0, lesson: 'Provider moved to critical tier; BitSight monitoring added.' },
    { title: 'Wealth client list exfiltration attempt (blocked by Netskope)', category: 'Insider', lossM: 0.1, claimed: 'No claim', paidM: 0, lesson: 'DLP rules extended to personal cloud uploads.' },
  ],
  media: [
    { title: 'Ember Run trailer #1 leaked 9 days early via agency', category: 'Content leak', lossM: 1.8, claimed: 'Open', paidM: 0, lesson: 'Custody agents now mandatory for marketing agencies; lost revenue element disputed.' },
    { title: 'Credential stuffing on KestrelPlay (38k accounts)', category: 'Data breach', lossM: 0.6, claimed: 'Claim paid', paidM: 0.1, lesson: 'Bot management and breached-password checks deployed.' },
    { title: 'Ransomware on a Soho freelancer laptop, contained', category: 'Ransomware', lossM: 0.08, claimed: 'No claim', paidM: 0, lesson: 'Freelancer device posture required by Cloudflare Zero Trust.' },
    { title: 'BEC on a location vendor payment', category: 'BEC / payment fraud', lossM: 0.35, claimed: 'Below retention', paidM: 0, lesson: 'Call-back threshold lowered to $10k.' },
  ],
  healthcare: [
    { title: 'Clearinghouse outage delayed claims for 5 weeks (Change Healthcare)', category: 'Third-party outage', lossM: 3.1, claimed: 'Claim paid', paidM: 1.1, lesson: 'Secondary clearinghouse route started; dependent BI sublimit raised to $5M.' },
    { title: 'Payroll diversion on 14 clinician accounts', category: 'BEC / payment fraud', lossM: 0.21, claimed: 'Below retention', paidM: 0, lesson: '72 h hold on direct-deposit changes and Imprivata re-verification.' },
    { title: 'Ransomware attempt at Marion community hospital, contained in 51 min', category: 'Ransomware', lossM: 0.4, claimed: 'No claim', paidM: 0, lesson: 'Triggered the community-hospital segmentation project.' },
    { title: 'Snooping on a VIP patient record (12 staff)', category: 'Insider', lossM: 0.15, claimed: 'Notice of circumstances', paidM: 0, lesson: 'FairWarning VIP alerting reduced to 1 h; sanctions policy enforced.' },
  ],
  automotive: [
    { title: 'Seat supplier ransomware stopped Ingolstadt for 2.5 days', category: 'Third-party outage', lossM: 21, claimed: 'Claim paid', paidM: 3.8, lesson: 'Contingent BI extended to 31 named JIS suppliers; buffer stock reviewed.' },
    { title: 'Dealer SaaS outage (9 days, 1,140 dealers)', category: 'Third-party outage', lossM: 6.2, claimed: 'Below retention', paidM: 0, lesson: 'Manual sales fallback and DealerCore recovery commitments negotiated.' },
    { title: 'Relay-attack theft ring targeting keyless models', category: 'Vehicle fleet', lossM: 1.4, claimed: 'No claim', paidM: 0, lesson: 'UWB key fob and vSOC anomaly rule shipped by OTA.' },
    { title: 'Supplier bank-change fraud in SAP (blocked at payment run)', category: 'BEC / payment fraud', lossM: 0.3, claimed: 'No claim', paidM: 0, lesson: 'SAP ETD alert on supplier-master changes outside four-eyes.' },
    { title: 'Phished design-agency account accessed Teamcenter renders', category: 'IP theft', lossM: 0.9, claimed: 'Notice of circumstances', paidM: 0, lesson: 'Agency access moved to HexaCustody watermarked sessions.' },
  ],
};

export function priorEvents(c: CustomerProfile): PriorEvent[] {
  const months = [7, 15, 26, 38, 49];
  const now = new Date();
  return forCustomer(PRIORS, c).map((p, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - months[i], 10 + i * 3);
    return { ...p, date: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) };
  });
}

export interface WalkStep {
  t: string;
  title: string;
  ready: 'ready' | 'partial' | 'manual';
  has: string;
  artefact: string;
}

export function walkthrough(c: CustomerProfile, sc: Scenario): WalkStep[] {
  const ctl = keyControls(c);
  const gaps = ctl.filter((k) => sc.controls.includes(k.id) && k.status !== 'attested');
  const backup = ctl.find((k) => k.id === 'backup')!;
  const siem = c.connectors.find((k) => k.category === 'SIEM');
  const bi = biTemplate(c);
  const obl = obligations(c);
  const tightest = obl.slice(2).sort((a, b) => a.hours - b.hours)[0];
  return [
    { t: 'T+0', title: 'Detect and declare', ready: 'ready', has: `HexaSOC raises the incident in ${siem?.product ?? 'the SIEM'} and HexaView builds the timeline, affected assets (${sc.tenants.length} tenants) and ATT&CK techniques (${sc.techniques.join(', ')}).`, artefact: 'Incident timeline (auto)' },
    { t: 'T+1 h', title: 'Notify insurer and broker', ready: 'ready', has: `Notification letter pre-filled: carrier ${c.insurance.carrier.split(' ')[0]}, broker ${c.insurance.broker}, policy limit ${c.insurance.limitM}M, retention, first known facts.`, artefact: 'Notice of loss (draft)' },
    { t: 'T+2 h', title: 'Engage panel vendors', ready: panel(c).some((p) => p.status === 'action') ? 'partial' : 'ready', has: `HexaShield DFIR retainer activated and breach counsel engaged under privilege. ${panel(c).filter((p) => !p.onPanel).map((p) => `${p.firm} needs insurer consent.`).join(' ')}`, artefact: 'Panel engagement log' },
    { t: `T+${tightest.hours} h`, title: 'Regulatory clocks', ready: 'ready', has: `${obl.length - 2} regulator and contractual deadlines computed; tightest is ${tightest.party} (${tightest.deadline}).`, artefact: 'Notification tracker' },
    { t: 'T+6 h', title: 'Preserve evidence', ready: vault(c).every((v) => v.ready) ? 'ready' : 'partial', has: `Legal hold applied across ${vault(c).length} evidence sets in the forensic vault; hashes anchored to the audit ledger.${vault(c).some((v) => !v.ready) ? ` Gaps: ${vault(c).filter((v) => !v.ready).map((v) => v.artefact.toLowerCase()).join('; ')}.` : ''}`, artefact: 'Chain-of-custody manifest' },
    { t: 'T+12 h', title: 'Restore and recover', ready: backup.status === 'attested' ? 'ready' : 'partial', has: backup.status === 'attested' ? 'Immutable restore points identified for affected systems; last tested restore within tolerance.' : `Restore points exist but ${backup.gapNote ?? 'restore evidence is incomplete'}`, artefact: 'Recovery plan' },
    { t: 'T+24 h', title: 'Start BI loss tracking', ready: 'ready', has: `BI template opened with ${bi.length} business services and hourly loss rates from live metrics; waiting period ${bi[0].waitingH} h tracked automatically.`, artefact: 'BI loss worksheet' },
    { t: 'T+72 h', title: 'Prove controls were in place', ready: gaps.length ? 'partial' : 'ready', has: gaps.length ? `Point-in-time attestation exported. Weak spots an adjuster will probe: ${gaps.map((g) => g.name.toLowerCase()).join('; ')}.` : 'Point-in-time attestation for every relevant control exported, rebutting unpatched-vulnerability and misrepresentation arguments.', artefact: 'Control attestation at time of loss' },
    { t: 'T+30 d', title: 'Proof of loss', ready: 'manual', has: 'Forensic report, BI worksheet, invoices and attestation compiled into the claim submission; forensic accountants sign off quantum.', artefact: 'Sworn proof of loss' },
  ];
}

/** Hex SHA-256-looking digest for the signed pack (stable per customer and version). */
export function packDigest(c: CustomerProfile, version: number): string {
  return rng(`ins-pack-sha-${c.id}-${version}`).hex(64);
}

/* =====================================================================
   Second-wave customers: their own entries in the tables above.
   Control test passes sum to headlines().insurance.attestedControls and
   premium drivers sum to headlines().insurance.premiumDeltaPct.
   ===================================================================== */
CONTROL_SEEDS.insurance = {
  mfa: { metric: 'MFA for 99.2% of 2,050 staff and 9,400 agents (Okta, Entra ID)', ok: 3, lastOk: 2, sources: ['c-okta', 'c-entra'], tests: [
    ['Is MFA enforced for all email access?', 'Yes. Entra Conditional Access enforces MFA for all mailboxes; legacy authentication is blocked.'],
    ['Is MFA enforced for all remote access, including agents and brokers?', 'Yes. 9,400 agents and brokers federate through Okta with MFA on AgentHub; VPN and Citrix require MFA.'],
    ['Is MFA enforced for privileged access?', 'Yes. CyberArk check-out requires FIDO2 keys for Tier 0 and mainframe administrators.'],
  ] },
  edr: { metric: 'CrowdStrike Falcon on 99.4% of 6,800 endpoints and servers; HexaSOC 24×7', ok: 2, lastOk: 2, sources: ['c-crowdstrike', 'c-splunk'], tests: [
    ['What percentage of endpoints and servers run EDR?', '99.4% of 6,800 endpoints and servers run CrowdStrike Falcon; z/OS is monitored through SMF in Splunk.'],
    ['Is EDR monitored 24×7 with authority to contain?', 'Yes. HexaSOC MDR with pre-approved host containment; median time to contain 38 min.'],
  ] },
  backup: { metric: 'Rubrik immutable snapshots for Guidewire integrations and mainframe; restore test 33 days ago', ok: 3, lastOk: 2, sources: ['c-veeam', 'c-cohesity'], tests: [
    ['Are backups immutable?', 'Yes. Rubrik immutable snapshots and a cyber vault copy of mainframe datasets.'],
    ['Are backups isolated from the production domain?', 'Yes. Separate identity domain and MFA for backup administration.'],
    ['Have critical systems been restored in the last 90 days?', 'Yes. ClaimCenter integration tier and premium batch restored 33 days ago within the 8 h RTO.'],
  ] },
  pam: { metric: '1,140 privileged accounts vaulted; 22 standing Tier 0 accounts remain', ok: 1, lastOk: 1, sources: ['c-cyberark', 'c-beyondtrust'],
    gapNote: '22 Tier 0 accounts still have standing access outside CyberArk just-in-time elevation.',
    fix: 'Convert the 22 standing Tier 0 accounts to just-in-time elevation; HexaView re-attests on the next CyberArk sync.',
    tests: [
      ['Are privileged credentials vaulted and rotated?', 'Yes. 1,140 privileged accounts in CyberArk, rotated daily for Tier 0.'],
      ['Is standing privileged access eliminated?', 'No. 22 Tier 0 accounts keep standing access pending the just-in-time rollout.'],
    ] },
  patch: { metric: 'Critical patch median 8 days; 1 KEV open on the MFT server (11 days)', ok: 1, lastOk: 1, sources: ['c-qualys', 'c-tenable', 'c-hexastrike'],
    gapNote: 'A CISA KEV vulnerability is open on mft.kingsbridgemutual.com, the server that exchanges claims files and bordereaux.',
    fix: 'Patch the MFT server and let HexaStrike re-test; the KEV question turns green on the next sync.',
    tests: [
      ['What is your patch window for critical vulnerabilities?', 'Median 8 days for critical vulnerabilities over the last 90 days (Qualys, Tenable).'],
      ['Are any CISA KEV vulnerabilities open on internet-facing systems?', 'Yes, 1. The managed file transfer server, open 11 days; access restricted to partner IPs.'],
    ] },
  email: { metric: 'Proofpoint and Abnormal on 100% of mailboxes; DMARC p=reject', ok: 2, lastOk: 2, sources: ['c-proofpoint', 'c-abnormal'], tests: [
    ['Do you sandbox attachments and rewrite URLs?', 'Yes. Proofpoint TAP on all mailboxes, with Abnormal for vendor and claimant impersonation.'],
    ['Do you verify payee and bank-detail changes out of band?', 'Yes. Dual approval in ClaimCenter and call-back on the number on file for any payee change.'],
  ] },
  ir: { metric: 'IR plan tested 26 days ago (catastrophe-week ransomware); HexaShield retainer', ok: 2, lastOk: 2, sources: ['c-hexacomply', 'c-servicenow'], tests: [
    ['Is the incident response plan tested every 12 months?', 'Yes. Executive tabletop 26 days ago; NYDFS 500.16 exercise evidence filed.'],
    ['Do you have an incident response retainer?', 'Yes. HexaShield DFIR, 200 hours, on the carrier panel.'],
  ] },
  logging: { metric: '548 live detections in Splunk ES and Sentinel; 13-month retention', ok: 2, lastOk: 2, sources: ['c-splunk', 'c-sentinel'], tests: [
    ['Are logs centralised and kept for at least 12 months?', 'Yes. Splunk ES and Sentinel, 13 months with immutable archive (NYDFS 500.6).'],
    ['Are logs protected from tampering?', 'Yes. Immutable archive and the HexaView hash-anchored ledger.'],
  ] },
  tprm: { metric: '238 providers tiered; 590 offshore BPO users still on standing VPN', ok: 1, lastOk: 1, sources: ['c-hexacomply', 'c-island', 'c-bitsight'],
    gapNote: 'EXL and Cognizant users reach claims and policy systems over standing VPN; Island browser rollout is half complete.',
    fix: 'Move the remaining BPO users to Island browser and BeyondTrust brokered sessions.',
    tests: [
      ['Do you assess third-party service providers holding NPI?', 'Yes. 238 providers tiered under NYDFS 500.11; 11 high-risk on remediation plans.'],
      ['Is provider access time-bound and monitored?', 'Partly. 590 offshore BPO users still use standing VPN access.'],
    ] },
  seg: { metric: 'Payment CDE and mainframe in separate zones; facilities OT isolated', ok: 2, lastOk: 2, sources: ['c-paloalto', 'c-hexaot'], tests: [
    ['Is the payment environment segmented?', 'Yes. Premium payment CDE in a separate zone, tested by the QSA.'],
    ['Are data-centre facilities systems isolated from corporate IT?', 'Yes. BMS, UPS and print-plant controllers sit behind a monitored DMZ (HexaOT, read-only).'],
  ] },
  awareness: { metric: 'Training completion 94%; phish click rate 5.6% (feed stale)', ok: 1, lastOk: 2, sources: ['c-knowbe4'],
    gapNote: 'The KnowBe4 token expires in 3 days and the last two pulls were rejected, so completion evidence is stale.',
    fix: 'Renew the KnowBe4 API token; completion and click-rate evidence refreshes automatically.',
    tests: [
      ['What is your annual training completion rate?', '94% of staff at the last successful sync; agents complete a separate module.'],
      ['Do you run phishing simulations?', 'Evidence stale. Monthly simulations run, but the last two results could not be pulled.'],
    ] },
  eol: { metric: '18 EOL hosts, none internet-facing; isolated actuarial batch server', ok: 2, lastOk: 1, sources: ['c-qualys', 'c-axonius'], tests: [
    ['Do you maintain an inventory of end-of-life systems?', 'Yes. 18 EOL hosts tracked in Axonius and ServiceNow.'],
    ['Are EOL systems isolated or under extended support?', 'Yes. All are isolated; the actuarial batch host has extended support until migration.'],
  ] },
};
CONTROL_SEEDS.defence = {
  mfa: { metric: 'FIPS YubiKeys for 100% of 1,180 enclave and privileged identities', ok: 3, lastOk: 3, sources: ['c-entra', 'c-yubico'], tests: [
    ['Is MFA enforced for all email access?', 'Yes. Phishing-resistant MFA on both GCC High and commercial tenants.'],
    ['Is MFA enforced for all remote access?', 'Yes. Zscaler ZPA with FIDO2 YubiKeys; no inbound VPN to the enclave.'],
    ['Is MFA enforced for privileged access?', 'Yes. Delinea check-out requires a FIPS YubiKey.'],
  ] },
  edr: { metric: 'Defender XDR and CrowdStrike on 99% of IT and engineering hosts; HexaSOC 24×7', ok: 2, lastOk: 2, sources: ['c-defender', 'c-crowdstrike'], tests: [
    ['What percentage of endpoints run EDR?', '99% of IT and engineering hosts; shop-floor OT is monitored passively by Armis and HexaOT.'],
    ['Is EDR monitored 24×7 with authority to contain?', 'Yes. HexaSOC MDR by US-person analysts, with pre-approved containment.'],
  ] },
  backup: { metric: 'Rubrik immutable for enclave and PLM; shop floor and range evidence stale', ok: 2, lastOk: 2, sources: ['c-rubrik', 'c-veeam'],
    gapNote: 'Veeam sync for Building 3 and the Tucson range has lagged since 06:40, so restore evidence for DNC and test data is stale.',
    fix: 'Clear the range WAN backlog and run a DNC server restore test; HexaView re-attests automatically.',
    tests: [
      ['Are backups immutable?', 'Yes. Rubrik immutable snapshots for the enclave, Teamcenter and M365 GCC High.'],
      ['Are backups isolated from the production domain?', 'Yes. Separate administration with FIPS MFA.'],
      ['Have critical systems been restored in the last 90 days?', 'Partly. Teamcenter restored 92 days ago; DNC and range restore evidence is stale.'],
    ] },
  pam: { metric: '940 privileged accounts in Delinea; OEM sessions brokered by BeyondTrust', ok: 2, lastOk: 1, sources: ['c-delinea', 'c-beyondtrust'], tests: [
    ['Are privileged credentials vaulted and rotated?', 'Yes. 940 accounts in Delinea Secret Server with rotation.'],
    ['Is vendor remote access brokered and recorded?', 'Yes. Machine-tool OEM sessions run through BeyondTrust with recording.'],
  ] },
  patch: { metric: 'Critical patch median 12 days; 9 range Linux hosts at 38 days', ok: 1, lastOk: 1, sources: ['c-tenablesc', 'c-defender'],
    gapNote: '9 Linux hosts at the Tucson range carry critical vulnerabilities for 38 days because test campaigns block patch windows.',
    fix: 'Patch the range hosts in the next campaign gap and let Tenable re-scan.',
    tests: [
      ['What is your patch window for critical vulnerabilities?', 'Median 12 days across IT and engineering (Tenable Security Center).'],
      ['Are all critical vulnerabilities fixed within 30 days?', 'No. 9 range Linux hosts are at 38 days.'],
    ] },
  email: { metric: 'Defender for Office 365 and Proofpoint; CUI email via PreVeil', ok: 2, lastOk: 2, sources: ['c-mdo', 'c-proofpoint', 'c-preveil'], tests: [
    ['Do you sandbox attachments and rewrite URLs?', 'Yes. Defender for Office 365 (GCC High) and Proofpoint (commercial).'],
    ['Do you verify payment-detail changes out of band?', 'Yes. Costpoint vendor-master changes need dual approval and a call-back.'],
  ] },
  ir: { metric: 'IR plan with DIBNet annex; last drill reached a reportable decision at 61 h', ok: 1, lastOk: 1, sources: ['c-hexacomply', 'c-servicenow'],
    gapNote: 'The last DIBNet drill took 61 of the 72 hours to reach a reportable decision, and image preservation is untested at the range.',
    fix: 'Re-run the DIBNet drill with the new decision matrix and test image preservation in Tucson.',
    tests: [
      ['Is the incident response plan tested every 12 months?', 'Yes. Tabletop 33 days ago covering CUI exfiltration.'],
      ['Can you meet the 72-hour DoD reporting deadline with margin?', 'Not yet. The drill reached a decision at 61 h.'],
    ] },
  logging: { metric: '318 detections in Sentinel (GCC High); 1-year retention', ok: 2, lastOk: 2, sources: ['c-sentinel'], tests: [
    ['Are logs centralised and retained?', 'Yes. Sentinel in Azure Government, 90 days hot and 1 year archive.'],
    ['Are logs protected from tampering?', 'Yes. Immutable archive and HexaView hash anchoring.'],
  ] },
  tprm: { metric: '96 suppliers; 2 sub-tiers with ITAR drawings lack a CMMC position', ok: 1, lastOk: 1, sources: ['c-hexacomply', 'c-exostar', 'c-scorecard'],
    gapNote: 'Cumberland Precision Machining and Valley Anodize hold ITAR drawings without a verified CMMC Level 2 position; Exostar attestations are stale.',
    fix: 'Re-authorise the Exostar federation and hold TDP releases to both sub-tiers until their SPRS scores are verified.',
    tests: [
      ['Do you assess suppliers before sharing CUI?', 'Yes. DFARS 7012 flow-down and SPRS checks for every sub-tier.'],
      ['Do all sub-tiers holding CUI have a verified CMMC position?', 'No. Two sub-tiers are pending.'],
    ] },
  seg: { metric: 'Enclave isolated; Building 3 DNC and CMM hosts share a corporate VLAN', ok: 1, lastOk: 0, sources: ['c-paloalto', 'c-armis', 'c-hexaot'],
    gapNote: 'The DNC server and CMM workstations in Building 3 still sit on a VLAN reachable from corporate IT.',
    fix: 'Move DNC and CMM hosts behind the Building 3 DMZ (change CHG-2207).',
    tests: [
      ['Is the CUI enclave separated from other networks?', 'Yes. GCC High enclave with ZPA-only access.'],
      ['Is shop-floor OT separated from corporate IT?', 'No. Building 3 segmentation is in progress.'],
    ] },
  awareness: { metric: 'CUI and insider-threat training 97%; phish click rate 4.4%', ok: 2, lastOk: 2, sources: ['c-knowbe4'], tests: [
    ['What is your annual training completion rate?', '97%, including CUI handling and insider-threat modules.'],
    ['Do you run phishing simulations?', 'Yes. Monthly, with prime-themed lures; click rate 4.4%.'],
  ] },
  eol: { metric: 'Windows 7 CMM workstation and an XP DNC serial bridge in production', ok: 0, lastOk: 0, sources: ['c-armis', 'c-tenablesc'],
    gapNote: 'A Windows 7 CMM workstation and a Windows XP DNC serial bridge are still in production on Building 3.',
    fix: 'Replace both with the vendor-supported versions during the planned machine shutdown, or isolate them in their own zone.',
    tests: [
      ['Are any end-of-life systems in production?', 'Yes. A Windows 7 CMM workstation and a Windows XP DNC serial bridge.'],
      ['Are EOL systems isolated?', 'No. Both are on the Building 3 VLAN pending segmentation.'],
    ] },
};
CONTROL_SEEDS.pharma = {
  mfa: { metric: 'MFA for 30,000 staff; 380 CRO partner accounts without phishing-resistant MFA', ok: 2, lastOk: 2, sources: ['c-entra', 'c-okta'],
    gapNote: '380 CRO partner accounts federated through Okta still use push MFA rather than FIDO2.',
    fix: 'Enforce FIDO2 for CRO partner accounts in Okta; HexaView re-attests on the next sync.',
    tests: [
      ['Is MFA enforced for all email access?', 'Yes. Entra Conditional Access for all staff.'],
      ['Is MFA enforced for privileged access?', 'Yes. CyberArk with FIDO2 for administrators.'],
      ['Is phishing-resistant MFA enforced for third-party access?', 'No. 380 CRO accounts use push MFA.'],
    ] },
  edr: { metric: 'CrowdStrike on 99.3% of IT hosts; allow-listing on validated plant hosts', ok: 2, lastOk: 2, sources: ['c-crowdstrike', 'c-sentinel'], tests: [
    ['What percentage of endpoints run EDR?', '99.3% of IT endpoints and servers; validated plant hosts use allow-listing with Claroty and Dragos monitoring.'],
    ['Is EDR monitored 24×7?', 'Yes. HexaSOC MDR with the Cyber Defence Centre in Basel.'],
  ] },
  backup: { metric: 'Rubrik immutable for SAP, LIMS, Vault exports and PAS-X; restore test 41 days ago', ok: 3, lastOk: 3, sources: ['c-rubrik'], tests: [
    ['Are backups immutable?', 'Yes. Rubrik immutable snapshots for GxP and business systems.'],
    ['Are backups isolated?', 'Yes. Separate administration domain.'],
    ['Have critical systems been restored in the last 90 days?', 'Yes. PAS-X batch records restored 41 days ago within RTO.'],
  ] },
  pam: { metric: 'CyberArk Privilege Cloud; OEM access to DCS via BeyondTrust', ok: 2, lastOk: 2, sources: ['c-cyberark', 'c-beyondtrust'], tests: [
    ['Are privileged credentials vaulted?', 'Yes. CyberArk Privilege Cloud with rotation.'],
    ['Is OEM remote access brokered and recorded?', 'Yes. Emerson, Siemens and Körber sessions via BeyondTrust with recording.'],
  ] },
  patch: { metric: 'Critical patch median 9 days; plant patches in validated windows', ok: 2, lastOk: 2, sources: ['c-insightvm', 'c-crowdstrike'], tests: [
    ['What is your patch window for critical vulnerabilities?', 'Median 9 days on IT; plant systems follow validated change windows with compensating controls.'],
    ['Are any KEV vulnerabilities open on internet-facing systems?', 'No. None open today.'],
  ] },
  email: { metric: 'Proofpoint and Abnormal; DMARC p=reject on 14 domains', ok: 2, lastOk: 2, sources: ['c-proofpoint', 'c-abnormal'], tests: [
    ['Do you sandbox attachments and rewrite URLs?', 'Yes. Proofpoint TAP on all mailboxes.'],
    ['Do you verify payment-detail changes out of band?', 'Yes. Licensing and supplier payments need dual approval and call-back.'],
  ] },
  ir: { metric: 'IR plan with GxP annex; tabletop 77 days ago; HexaShield retainer', ok: 2, lastOk: 2, sources: ['c-hexacomply', 'c-servicenow'], tests: [
    ['Is the incident response plan tested every 12 months?', 'Yes. Plant ransomware tabletop 77 days ago.'],
    ['Do you have an incident response retainer?', 'Yes. HexaShield DFIR, 320 hours.'],
  ] },
  logging: { metric: '948 Sentinel detections; R&D file-share monitoring down since 03:40', ok: 1, lastOk: 2, sources: ['c-sentinel', 'c-varonis'],
    gapNote: 'The Varonis collector on BSL-FS02 has been down since 03:40, so R&D file-share access is not logged.',
    fix: 'Rebuild the Varonis collector; HexaView re-attests when events resume.',
    tests: [
      ['Are logs centralised and retained for 12 months?', 'Yes. Sentinel with 13-month retention.'],
      ['Is access to sensitive data stores logged?', 'Partly. R&D file shares are unmonitored while the collector is down.'],
    ] },
  tprm: { metric: '520 suppliers; quality agreements tracked for GxP suppliers', ok: 2, lastOk: 1, sources: ['c-hexacomply', 'c-bitsight'], tests: [
    ['Do you assess CROs, CMOs and critical suppliers?', 'Yes. 520 suppliers tiered; 17 high-risk on remediation plans.'],
    ['Are partner accounts reviewed?', 'Yes. Quarterly CRO and CMO access reviews.'],
  ] },
  seg: { metric: 'Level 3.5 DMZ at Valais; 2 IT-to-OT conduits bypass the Cork DMZ', ok: 1, lastOk: 1, sources: ['c-claroty', 'c-dragos', 'c-paloalto'],
    gapNote: 'Two IT-to-OT conduits at Cork reach the serialisation lines without passing the Level 3.5 DMZ; the Dragos feed is delayed.',
    fix: 'Close the two Cork conduits and restore the Dragos feed off the backup WAN link.',
    tests: [
      ['Is OT separated from IT with a DMZ?', 'Yes at Valais (DeltaV and PCS 7 behind the DMZ).'],
      ['Is segmentation complete at every plant?', 'No. Two conduits at Cork bypass the DMZ.'],
    ] },
  awareness: { metric: 'Training completion 93% incl. GxP data integrity; click rate 6.8%', ok: 2, lastOk: 2, sources: ['c-knowbe4'], tests: [
    ['What is your annual training completion rate?', '93%, including the GxP data-integrity module.'],
    ['Do you run phishing simulations?', 'Yes. Monthly; click rate 6.8%.'],
  ] },
  eol: { metric: 'Windows 7 lyophiliser HMI and legacy PLCs under validated isolation', ok: 1, lastOk: 1, sources: ['c-claroty', 'c-insightvm'],
    gapNote: 'A Windows 7 lyophiliser HMI at Cork cannot be upgraded until revalidation in 2027.',
    fix: 'Keep the HMI isolated with allow-listing and document the revalidation plan in the pack.',
    tests: [
      ['Do you maintain an EOL inventory?', 'Yes. Claroty and InsightVM inventories, reconciled monthly.'],
      ['Are all EOL systems isolated or supported?', 'No. One Windows 7 lyophiliser HMI awaits revalidation.'],
    ] },
};
CONTROL_SEEDS.sghospital = {
  mfa: { metric: 'MFA for remote and email access; 96 reset-eligible accounts without phishing-resistant MFA', ok: 2, lastOk: 2, sources: ['c-entra', 'c-imprivata'],
    gapNote: '96 accounts, including NCS service-desk agents, can still have MFA reset by phone.',
    fix: 'Enforce phishing-resistant MFA and verified resets for the 96 accounts.',
    tests: [
      ['Is MFA enforced for all email and remote access?', 'Yes. Entra Conditional Access and Zscaler ZPA.'],
      ['Is MFA enforced for privileged access?', 'Yes. CyberArk Privilege Cloud with MFA.'],
      ['Are help-desk resets protected against social engineering?', 'No. 96 accounts can be reset by phone.'],
    ] },
  edr: { metric: 'CrowdStrike on 98.8% of servers and clinical workstations; HexaSOC 24×7', ok: 2, lastOk: 2, sources: ['c-crowdstrike', 'c-sentinel'], tests: [
    ['What percentage of endpoints run EDR?', '98.8% of servers and workstations; medical devices are monitored by Claroty and Armis.'],
    ['Is EDR monitored 24×7?', 'Yes. HexaSOC MDR with pre-approved isolation for IT hosts.'],
  ] },
  backup: { metric: 'Cohesity immutable for TrakCare and PACS; downtime drill 6.5 h vs 4 h', ok: 2, lastOk: 2, sources: ['c-cohesity', 'c-veeam'],
    gapNote: 'The last TrakCare downtime drill recovered in 6.5 hours against a 4-hour target.',
    fix: 'Run a clean-room TrakCare restore to meet the 4-hour objective.',
    tests: [
      ['Are backups immutable?', 'Yes. Cohesity immutable snapshots for TrakCare, PACS and the LIS.'],
      ['Are backups isolated?', 'Yes. Separate administration and a DR copy in the secondary site.'],
      ['Can critical systems be restored within target?', 'No. TrakCare recovery took 6.5 h against 4 h.'],
    ] },
  pam: { metric: 'CyberArk vaulting; 31 OEM accounts with standing remote access', ok: 1, lastOk: 1, sources: ['c-cyberark'],
    gapNote: '31 imaging and lab OEM accounts keep standing remote access rather than per-session approval.',
    fix: 'Move OEM accounts to CyberArk Vendor PAM with approval per session.',
    tests: [
      ['Are privileged credentials vaulted?', 'Yes. CyberArk Privilege Cloud.'],
      ['Is OEM remote access approved per session?', 'No. 31 OEM accounts have standing access.'],
    ] },
  patch: { metric: 'Critical patch median 13 days; FortiGate SSL-VPN KEV at 27 days', ok: 1, lastOk: 1, sources: ['c-insightvm', 'c-tenable'],
    gapNote: 'A CISA KEV vulnerability on the FortiGate SSL-VPN has been open for 27 days.',
    fix: 'Upgrade the FortiGate firmware with ST Engineering and let HexaStrike re-test.',
    tests: [
      ['What is your patch window for critical vulnerabilities?', 'Median 13 days for IT systems.'],
      ['Are any KEV vulnerabilities open on internet-facing systems?', 'Yes, 1. FortiGate SSL-VPN, open 27 days.'],
    ] },
  email: { metric: 'Mimecast and Abnormal; insurer and vendor impersonation rules', ok: 2, lastOk: 2, sources: ['c-mimecast', 'c-abnormal'], tests: [
    ['Do you sandbox attachments and rewrite URLs?', 'Yes. Mimecast on all mailboxes.'],
    ['Do you verify payment-detail changes out of band?', 'Yes. Refunds and supplier changes need call-back.'],
  ] },
  ir: { metric: 'IR plan with MOH annex; 2-hour notification drill reached MOH at 3 h 10 min', ok: 1, lastOk: 1, sources: ['c-hexacomply', 'c-servicenow'],
    gapNote: 'The last drill reached MOH notification at 3 h 10 min against the 2-hour requirement.',
    fix: 'Re-run the MOH notification drill with the new templates and an out-of-hours decision owner.',
    tests: [
      ['Is the incident response plan tested every 12 months?', 'Yes. TrakCare ransomware tabletop 24 days ago.'],
      ['Can you meet the 2-hour MOH notification requirement?', 'Not yet. The drill took 3 h 10 min.'],
    ] },
  logging: { metric: '386 detections in Sentinel; FairWarning record-access monitoring', ok: 2, lastOk: 2, sources: ['c-sentinel', 'c-fairwarning'], tests: [
    ['Are logs centralised and retained for 12 months?', 'Yes. Sentinel with 12-month retention.'],
    ['Is access to patient records monitored?', 'Yes. FairWarning reviews TrakCare access daily.'],
  ] },
  tprm: { metric: '142 suppliers; CareLink and Lion City Pathology without current assessments', ok: 1, lastOk: 1, sources: ['c-hexacomply', 'c-bitsight'],
    gapNote: 'CareLink Telehealth (rating 57) and Lion City Pathology (63) hold patient data without a current assessment.',
    fix: 'Complete both assessments and add 24-hour breach notice clauses.',
    tests: [
      ['Do you assess suppliers that hold patient data?', 'Yes. 142 suppliers tiered; 9 high-risk on remediation plans.'],
      ['Are all critical suppliers assessed in the last 12 months?', 'No. Two are overdue.'],
    ] },
  seg: { metric: 'Clinical VLANs at Novena; 860 lab and imaging devices flat at Science Park', ok: 1, lastOk: 1, sources: ['c-claroty', 'c-fortigate', 'c-hexaot'],
    gapNote: '860 lab analysers and imaging workstations at Orchid Bay Diagnostics share a flat network.',
    fix: 'Apply Claroty segmentation policies at Science Park through FortiGate.',
    tests: [
      ['Are medical devices on segmented networks?', 'Yes at Novena and the specialist centres.'],
      ['Is segmentation complete at every site?', 'No. Science Park devices are on a flat network.'],
    ] },
  awareness: { metric: 'Training completion 81%; click rate 8.7%', ok: 2, lastOk: 2, sources: ['c-knowbe4'], tests: [
    ['What is your annual training completion rate?', '81% of staff; clinical shifts complete short modules.'],
    ['Do you run phishing simulations?', 'Yes. Monthly; click rate 8.7%.'],
  ] },
  eol: { metric: 'Windows 7 lab analyser PCs and legacy pump firmware', ok: 1, lastOk: 1, sources: ['c-claroty', 'c-insightvm'],
    gapNote: 'Lab analyser PCs at Science Park run Windows 7 and cannot be upgraded until the OEM releases new software.',
    fix: 'Isolate the analyser PCs and document the OEM upgrade plan.',
    tests: [
      ['Do you maintain an EOL inventory?', 'Yes. Claroty and InsightVM, reconciled monthly.'],
      ['Are all EOL systems isolated?', 'No. Lab analyser PCs await segmentation.'],
    ] },
};
CONTROL_SEEDS.studio = {
  mfa: { metric: 'MFA for 70,000 identities; 1,240 accounts still reset by phone', ok: 2, lastOk: 2, sources: ['c-okta', 'c-entra'],
    gapNote: '1,240 Okta accounts can still have MFA reset by the help desk without strong verification.',
    fix: 'Require verified resets for the 1,240 accounts; HexaView re-attests on the next Okta sync.',
    tests: [
      ['Is MFA enforced for all email and remote access?', 'Yes. Okta and Entra ID for all staff and freelancers.'],
      ['Is MFA enforced for privileged access?', 'Yes. CyberArk with FIDO2.'],
      ['Are help-desk resets protected against social engineering?', 'No. 1,240 accounts are still reset by phone.'],
    ] },
  edr: { metric: 'SentinelOne and CrowdStrike on 99% of endpoints, render and park POS', ok: 2, lastOk: 2, sources: ['c-s1', 'c-crowdstrike'], tests: [
    ['What percentage of endpoints run EDR?', '99% of workstations, render nodes and park POS.'],
    ['Is EDR monitored 24×7?', 'Yes. HexaSOC MDR with the Cyber Defence Centre.'],
  ] },
  backup: { metric: 'Rubrik immutable for masters and MAM; resort backups re-authenticating', ok: 2, lastOk: 2, sources: ['c-rubrik', 'c-cohesity'],
    gapNote: 'The Cohesity cluster for the resorts needs re-authentication after a certificate rotation, so resort restore evidence is stale.',
    fix: 'Re-authenticate the Cohesity connector and run a ticketing restore test.',
    tests: [
      ['Are backups immutable?', 'Yes. Rubrik immutable snapshots for masters, MAM and Starfall+ data.'],
      ['Are backups isolated?', 'Yes. Separate administration domain.'],
      ['Have critical systems been restored in the last 90 days?', 'Partly. Masters restored 41 days ago; resort evidence is stale.'],
    ] },
  pam: { metric: 'CyberArk Privilege Cloud for 4,800 privileged accounts', ok: 2, lastOk: 2, sources: ['c-cyberark'], tests: [
    ['Are privileged credentials vaulted?', 'Yes. CyberArk with rotation.'],
    ['Is standing admin access eliminated?', 'Yes. Just-in-time elevation for Tier 0.'],
  ] },
  patch: { metric: 'Critical patch median 7 days; no KEV older than 14 days', ok: 2, lastOk: 2, sources: ['c-tenable', 'c-qualys'], tests: [
    ['What is your patch window for critical vulnerabilities?', 'Median 7 days across studios and Starfall+.'],
    ['Are any KEV vulnerabilities open on internet-facing systems?', 'No. None older than 14 days.'],
  ] },
  email: { metric: 'Workspace and Defender for Office 365 with Abnormal; DMARC p=reject', ok: 2, lastOk: 2, sources: ['c-abnormal', 'c-proofpoint'], tests: [
    ['Do you sandbox attachments and rewrite URLs?', 'Yes, across Google Workspace and Microsoft 365.'],
    ['Do you verify payment-detail changes out of band?', 'Yes. Production payments need call-back.'],
  ] },
  ir: { metric: 'IR plan with leak and 8-K annexes; tabletop 15 days ago', ok: 2, lastOk: 2, sources: ['c-hexacomply', 'c-servicenow'], tests: [
    ['Is the incident response plan tested every 12 months?', 'Yes. Leak and materiality tabletop 15 days ago.'],
    ['Do you have an incident response retainer?', 'Yes. HexaShield DFIR, 400 hours.'],
  ] },
  logging: { metric: '1,380 detections in Google SecOps and Splunk; 12-month retention', ok: 2, lastOk: 2, sources: ['c-secops', 'c-splunk'], tests: [
    ['Are logs centralised and retained for 12 months?', 'Yes. Google SecOps for corporate and studios, Splunk for parks.'],
    ['Are logs protected from tampering?', 'Yes. Immutable storage and HexaView hash anchoring.'],
  ] },
  tprm: { metric: '1,180 vendors; 2 receive pre-release content without custody agents', ok: 1, lastOk: 1, sources: ['c-hexacomply', 'c-bitsight', 'c-scorecard'],
    gapNote: 'Bluebird Dubbing Studios and Northlight Pixel receive scripts and plates without HexaCustody agents.',
    fix: 'Enforce custody agents and Island browser at both vendors.',
    tests: [
      ['Do you assess vendors that receive pre-release content?', 'Yes. TPN status checked for every content vendor.'],
      ['Is pre-release content tracked at every vendor?', 'No. Two vendors are not yet on custody agents.'],
    ] },
  seg: { metric: 'Isolated content network; 38 OEM paths into ride control outside brokered sessions', ok: 1, lastOk: 1, sources: ['c-claroty', 'c-panorama', 'c-hexaot'],
    gapNote: '38 OEM remote-access paths reach ride and show control in Orlando and Osaka outside CyberArk.',
    fix: 'Move the OEM paths behind CyberArk brokered sessions after the Halloween freeze.',
    tests: [
      ['Is the content network isolated?', 'Yes (MPA DS-1.0).'],
      ['Is ride and show control isolated from vendor networks?', 'No. 38 OEM paths remain.'],
    ] },
  awareness: { metric: 'Training completion 78%; click rate 9.6%', ok: 2, lastOk: 1, sources: ['c-knowbe4'], tests: [
    ['What is your annual training completion rate?', '78% across 70,000 staff, including seasonal park staff.'],
    ['Do you run phishing simulations?', 'Yes. Monthly, with screener and talent-themed lures.'],
  ] },
  eol: { metric: 'Legacy ride HMIs isolated; colour-grading workstation replaced this quarter', ok: 2, lastOk: 1, sources: ['c-claroty', 'c-tenable'], tests: [
    ['Do you maintain an EOL inventory?', 'Yes. Claroty and Tenable, reconciled monthly.'],
    ['Are all EOL systems isolated or supported?', 'Yes. Ride HMIs on Windows XP Embedded are isolated in their own zones.'],
  ] },
};

DRIVERS.insurance = [
  { label: 'Market: insurer and financial institutions cyber softening', pts: -3, kind: 'market' },
  { label: 'MFA for staff, agents and brokers', pts: -2, kind: 'control', controlId: 'mfa' },
  { label: 'EDR with HexaSOC 24×7 response', pts: -1.5, kind: 'control', controlId: 'edr' },
  { label: 'Tested Guidewire and mainframe restore', pts: -1.5, kind: 'control', controlId: 'backup' },
  { label: 'Catastrophe-week ransomware tabletop', pts: -1, kind: 'control', controlId: 'ir' },
  { label: '22 standing Tier 0 accounts', pts: 1, kind: 'control', controlId: 'pam', fixable: true },
  { label: 'KEV open on the MFT server', pts: 1.5, kind: 'control', controlId: 'patch', fixable: true },
  { label: '590 BPO users on standing VPN', pts: 0.5, kind: 'control', controlId: 'tprm', fixable: true },
  { label: 'Awareness evidence stale (KnowBe4 token)', pts: 0.5, kind: 'control', controlId: 'awareness', fixable: true },
  { label: 'Payee-fraud loss below retention (2025)', pts: 0.5, kind: 'history' },
];
DRIVERS.defence = [
  { label: 'Market: defence industrial base rates firming', pts: 2, kind: 'market' },
  { label: 'FIPS phishing-resistant MFA everywhere', pts: -2, kind: 'control', controlId: 'mfa' },
  { label: 'EDR with HexaSOC 24×7 response', pts: -1.5, kind: 'control', controlId: 'edr' },
  { label: 'OEM access brokered via BeyondTrust', pts: -1, kind: 'control', controlId: 'pam' },
  { label: 'CUI and insider-threat training', pts: -0.5, kind: 'control', controlId: 'awareness' },
  { label: 'Shop-floor and range restore evidence stale', pts: 1, kind: 'control', controlId: 'backup', fixable: true },
  { label: 'Building 3 DNC and CMM not segmented', pts: 2, kind: 'control', controlId: 'seg', fixable: true },
  { label: 'Windows 7 / XP systems in production', pts: 1.5, kind: 'control', controlId: 'eol', fixable: true },
  { label: 'Sub-tiers without a CMMC position', pts: 1, kind: 'control', controlId: 'tprm', fixable: true },
  { label: 'DIBNet drill decision at 61 h', pts: 1, kind: 'control', controlId: 'ir', fixable: true },
  { label: 'Sub-tier incident notice (2025)', pts: 1.5, kind: 'history' },
];
DRIVERS.pharma = [
  { label: 'Market: life sciences cyber softening', pts: -2.5, kind: 'market' },
  { label: 'EDR and allow-listing with HexaSOC 24×7', pts: -2, kind: 'control', controlId: 'edr' },
  { label: 'Tested GxP restore (PAS-X, LIMS)', pts: -2, kind: 'control', controlId: 'backup' },
  { label: 'Plant ransomware tabletop with GxP annex', pts: -1.5, kind: 'control', controlId: 'ir' },
  { label: 'OEM access to DCS brokered and recorded', pts: -1, kind: 'control', controlId: 'pam' },
  { label: '380 CRO accounts without FIDO2', pts: 1, kind: 'control', controlId: 'mfa', fixable: true },
  { label: '2 IT-to-OT conduits at Cork', pts: 1.5, kind: 'control', controlId: 'seg', fixable: true },
  { label: 'Windows 7 lyophiliser HMI', pts: 0.5, kind: 'control', controlId: 'eol', fixable: true },
  { label: 'R&D file-share monitoring down', pts: 0.5, kind: 'control', controlId: 'logging', fixable: true },
  { label: 'CMO breach notice of circumstances (2025)', pts: 0.5, kind: 'history' },
];
DRIVERS.sghospital = [
  { label: 'Market: APAC healthcare after hospital ransomware losses', pts: 3.5, kind: 'market' },
  { label: 'MFA on email and remote access', pts: -1.5, kind: 'control', controlId: 'mfa' },
  { label: 'EDR with HexaSOC 24×7 response', pts: -2, kind: 'control', controlId: 'edr' },
  { label: 'Email impersonation protection', pts: -1, kind: 'control', controlId: 'email' },
  { label: 'Record-access monitoring (FairWarning)', pts: -1, kind: 'control', controlId: 'logging' },
  { label: '860 lab and imaging devices on a flat network', pts: 1.5, kind: 'control', controlId: 'seg', fixable: true },
  { label: 'MOH 2-hour drill missed', pts: 1, kind: 'control', controlId: 'ir', fixable: true },
  { label: 'FortiGate KEV at 27 days', pts: 1, kind: 'control', controlId: 'patch', fixable: true },
  { label: '31 OEM accounts with standing access', pts: 0.5, kind: 'control', controlId: 'pam', fixable: true },
  { label: 'Windows 7 lab analyser PCs', pts: 0.5, kind: 'control', controlId: 'eol', fixable: true },
  { label: 'Two patient-data suppliers unassessed', pts: 0.5, kind: 'control', controlId: 'tprm', fixable: true },
  { label: 'Misdirected export notified to PDPC (2025)', pts: 2, kind: 'history' },
];
DRIVERS.studio = [
  { label: 'Market: media & entertainment flat', pts: -1.5, kind: 'market' },
  { label: 'EDR with HexaSOC 24×7 response', pts: -1.5, kind: 'control', controlId: 'edr' },
  { label: 'Leak and 8-K tabletop exercised', pts: -1.5, kind: 'control', controlId: 'ir' },
  { label: 'Centralised logging across studios and parks', pts: -1, kind: 'control', controlId: 'logging' },
  { label: 'KEV fixed within 14 days', pts: -1, kind: 'control', controlId: 'patch' },
  { label: '1,240 accounts reset by phone', pts: 1, kind: 'control', controlId: 'mfa', fixable: true },
  { label: 'Two content vendors without custody agents', pts: 1.5, kind: 'control', controlId: 'tprm', fixable: true },
  { label: '38 OEM paths into ride control', pts: 1, kind: 'control', controlId: 'seg', fixable: true },
  { label: 'Resort backup evidence stale (Cohesity)', pts: 0.5, kind: 'control', controlId: 'backup', fixable: true },
  { label: 'No claim above retention in 3 years', pts: -0.5, kind: 'history' },
];
Object.assign(LAST_SCORE, { insurance: 76, defence: 68, pharma: 77, sghospital: 70, studio: 76 });
Object.assign(P0, { insurance: 0.7, defence: 0.48, pharma: 0.76, sghospital: 0.6, studio: 0.82 });

SCENARIOS.insurance = [
  { id: 'rw', name: 'Ransomware on Guidewire integrations and claims during a catastrophe', category: 'Ransomware', freq: 0.08, min: 3, ml: 18, max: 90, tenants: ['claims', 'group', 'personal'], actors: ['Black Basta', 'ALPHV/BlackCat affiliates'], techniques: ['T1078', 'T1621', 'T1486', 'T1490'], controls: ['mfa', 'edr', 'backup', 'pam'], cover: 'Extortion + BI (8 h waiting period)', coveredPct: 0.74, mix: mix(0.48, 0.18, 0.14, 0.14, 0.06), narrative: 'Encryption of integration servers and the claims document store stops FNOL and payments in a landfall week; claims leakage and regulatory scrutiny follow.' },
  { id: 'mft', name: 'Mass NPI exfiltration through the MFT server (Cl0p pattern)', category: 'Data breach', freq: 0.07, min: 2, ml: 12, max: 70, tenants: ['group', 'claims'], actors: ['Cl0p'], techniques: ['T1190', 'T1048.003', 'T1567.002'], controls: ['patch', 'logging'], cover: 'Privacy liability, notification and regulatory defence', coveredPct: 0.8, mix: mix(0.05, 0.25, 0.05, 0.6, 0.05), narrative: 'A zero-day in the file-transfer server exposes claimant files and bordereaux; notification across states and class actions drive cost.' },
  { id: 'payee', name: 'Claims disbursement and payee-change fraud', category: 'BEC / payment fraud', freq: 0.45, min: 0.05, ml: 0.6, max: 4, tenants: ['claims', 'personal'], actors: ['Scattered Spider', 'BEC crews'], techniques: ['T1621', 'T1098', 'T1657'], controls: ['email', 'mfa', 'awareness'], cover: 'Social engineering ($2.5M sublimit)', coveredPct: 0.55, mix: mix(0, 0.1, 0, 0.05, 0.85), narrative: 'A reset adjuster account redirects total-loss payments; recovery is partial and SIU investigation costs add up.' },
  { id: 'bpo', name: 'Offshore BPO insider or compromise exposes claimant data', category: 'Insider', freq: 0.12, min: 0.3, ml: 2.5, max: 18, tenants: ['claims'], actors: ['Compromised BPO workstation', 'Malicious insider'], techniques: ['T1078', 'T1052.001', 'T1567.002'], controls: ['tprm', 'logging'], cover: 'Privacy liability and notification', coveredPct: 0.75, mix: mix(0.05, 0.2, 0, 0.7, 0.05), narrative: 'A BPO user exports a claims queue; notification and regulator follow-up cost more than the data itself.' },
  { id: 'gw', name: 'Guidewire Cloud outage beyond tolerance', category: 'Third-party outage', freq: 0.1, min: 0.5, ml: 4, max: 25, tenants: ['claims', 'personal', 'commercial'], actors: ['Provider failure', 'Supply-chain compromise'], techniques: ['T1199'], controls: ['tprm', 'backup'], cover: 'Dependent BI ($10M sublimit, 12 h waiting)', coveredPct: 0.5, mix: mix(0.8, 0.1, 0, 0.05, 0.05), narrative: 'A platform outage halts quote, bind and FNOL; agents move business elsewhere during the outage.' },
  { id: 'portal', name: 'Agent portal account takeover and fraudulent binds', category: 'BEC / payment fraud', freq: 0.2, min: 0.05, ml: 0.4, max: 3, tenants: ['commercial', 'specialty'], actors: ['Credential-stuffing crews'], techniques: ['T1110.004', 'T1078'], controls: ['mfa'], cover: 'Social engineering and fraud', coveredPct: 0.5, mix: mix(0, 0.15, 0, 0.15, 0.7), narrative: 'Stolen agent credentials are used to bind fraudulent policies and divert commissions.' },
  { id: 'wiper', name: 'Systemic cloud or state-backed event across the US market', category: 'State-backed', freq: 0.015, min: 8, ml: 35, max: 160, tenants: ['group', 'personal', 'commercial', 'claims', 'life', 'specialty'], actors: ['Volt Typhoon', 'Provider-wide outage'], techniques: ['T1195.002', 'T1485'], controls: ['backup', 'seg'], cover: 'Subject to war and infrastructure exclusions', coveredPct: 0.3, mix: mix(0.7, 0.15, 0, 0.1, 0.05), narrative: 'A systemic event hits cloud and payments providers at once; war and infrastructure wording decide recovery.' },
];
SCENARIOS.defence = [
  { id: 'cui', name: 'State-backed theft of CUI from the GCC High enclave', category: 'State-backed', freq: 0.05, min: 0.5, ml: 3, max: 14, tenants: ['programs', 'engineering'], actors: ['APT40', 'APT41', 'Volt Typhoon'], techniques: ['T1078', 'T1213', 'T1567.002'], controls: ['mfa', 'logging', 'ir'], cover: 'Response and regulatory defence; loss of contracts excluded', coveredPct: 0.35, mix: mix(0.3, 0.4, 0, 0.25, 0.05), narrative: 'Exfiltration of guidance drawings triggers DIBNet reporting, a DoD damage assessment and possible loss of award eligibility.' },
  { id: 'rw', name: 'Ransomware spreads to the Building 3 DNC server', category: 'Ransomware', freq: 0.08, min: 0.4, ml: 2.5, max: 10, tenants: ['manufacturing', 'corporate'], actors: ['LockBit affiliates', 'Akira'], techniques: ['T1133', 'T1486', 'T1490'], controls: ['seg', 'backup', 'edr'], cover: 'Extortion + BI (12 h waiting period)', coveredPct: 0.7, mix: mix(0.6, 0.2, 0.12, 0.05, 0.03), narrative: 'Encryption reaches CNC programmes; machining stops and prime deliveries slip with late-delivery penalties.' },
  { id: 'cmmc', name: 'Lost awards after a failed C3PAO assessment', category: 'Regulatory', freq: 0.06, min: 0.5, ml: 3, max: 12, tenants: ['programs'], actors: ['Regulatory follow-on to control gaps'], techniques: ['T1078'], controls: ['ir', 'seg', 'eol'], cover: 'Not insured: lost contracts are excluded', coveredPct: 0.05, mix: mix(0.9, 0.05, 0, 0.05, 0), narrative: 'Open POA&M items prevent Level 2 certification; new DoD awards are lost until certification is achieved.' },
  { id: 'subtier', name: 'Sub-tier compromise leaks ITAR drawings', category: 'Third-party outage', freq: 0.1, min: 0.2, ml: 1.2, max: 6, tenants: ['programs', 'manufacturing'], actors: ['Ransomware at a sub-tier shop'], techniques: ['T1199', 'T1567.002'], controls: ['tprm'], cover: 'Response and regulatory defence', coveredPct: 0.45, mix: mix(0.4, 0.3, 0, 0.25, 0.05), narrative: 'Drawings held by a sub-tier are stolen; voluntary disclosure, re-sourcing and prime scrutiny follow.' },
  { id: 'bec', name: 'Payment fraud on supplier and payroll changes', category: 'BEC / payment fraud', freq: 0.3, min: 0.02, ml: 0.15, max: 0.8, tenants: ['corporate'], actors: ['BEC crews'], techniques: ['T1566.002', 'T1657'], controls: ['email', 'awareness'], cover: 'Social engineering ($250k sublimit)', coveredPct: 0.6, mix: mix(0, 0.1, 0, 0, 0.9), narrative: 'A spoofed supplier changes bank details in Costpoint; call-back procedures limit losses.' },
  { id: 'range', name: 'Test-range campaign disrupted by a network compromise', category: 'OT disruption', freq: 0.05, min: 0.1, ml: 0.8, max: 4, tenants: ['tucson'], actors: ['Commodity malware', 'Insider'], techniques: ['T0886', 'T1133'], controls: ['patch', 'seg'], cover: 'BI (12 h waiting period)', coveredPct: 0.6, mix: mix(0.75, 0.2, 0, 0.05, 0), narrative: 'Range telemetry systems are compromised mid-campaign; the campaign is re-flown at extra cost.' },
];
SCENARIOS.pharma = [
  { id: 'rw', name: 'Ransomware halts batch release at Valais and Cork', category: 'Ransomware', freq: 0.06, min: 8, ml: 45, max: 260, tenants: ['valais', 'cork', 'corporate'], actors: ['Black Basta', 'FIN11 / Cl0p'], techniques: ['T1133', 'T1078', 'T1486', 'T1490'], controls: ['backup', 'edr', 'seg'], cover: 'Extortion + BI (12 h waiting period)', coveredPct: 0.66, mix: mix(0.62, 0.14, 0.1, 0.1, 0.04), narrative: 'SAP, LIMS and PAS-X are encrypted; batch release stops and medicine supply in several markets is at risk.' },
  { id: 'ip', name: 'Discovery and process IP theft (APT41)', category: 'IP theft', freq: 0.05, min: 2, ml: 15, max: 120, tenants: ['rnd'], actors: ['APT41', 'APT29'], techniques: ['T1078', 'T1213', 'T1567.002'], controls: ['logging', 'mfa'], cover: 'Response costs only; loss of IP value excluded', coveredPct: 0.15, mix: mix(0.2, 0.6, 0, 0.15, 0.05), narrative: 'Compound libraries and biologics process data are stolen; only investigation and response are insured.' },
  { id: 'trial', name: 'Clinical trial data breach and unblinding', category: 'Data breach', freq: 0.06, min: 1, ml: 8, max: 45, tenants: ['clinops'], actors: ['Compromised CRO account', 'ShinyHunters-style extortion'], techniques: ['T1078', 'T1530', 'T1567.002'], controls: ['mfa', 'tprm'], cover: 'Privacy liability, notification and regulatory defence', coveredPct: 0.7, mix: mix(0.25, 0.2, 0.05, 0.45, 0.05), narrative: 'Patient-level trial data is exposed through a partner account; a Phase III readout may be delayed.' },
  { id: 'gxp', name: 'GxP data-integrity event after an OT compromise', category: 'OT disruption', freq: 0.04, min: 3, ml: 20, max: 110, tenants: ['valais', 'cork'], actors: ['OEM remote access abuse', 'Commodity malware via removable media'], techniques: ['T0886', 'T0836', 'T1565.001'], controls: ['seg', 'pam'], cover: 'BI and product contamination (endorsement)', coveredPct: 0.5, mix: mix(0.7, 0.2, 0, 0.08, 0.02), narrative: 'An unexplained DCS change puts batches in doubt; batches are rejected and the line revalidated.' },
  { id: 'cmo', name: 'CMO or CRO outage stops supply or trial conduct', category: 'Third-party outage', freq: 0.12, min: 1, ml: 9, max: 60, tenants: ['cork', 'clinops'], actors: ['Ransomware at a partner'], techniques: ['T1199', 'T1486'], controls: ['tprm'], cover: 'Dependent BI (named partners, CHF 20M sublimit)', coveredPct: 0.45, mix: mix(0.8, 0.12, 0, 0.05, 0.03), narrative: 'A contract manufacturer is encrypted; fill-finish capacity is lost for weeks.' },
  { id: 'bec', name: 'Licensing payment redirect (BEC)', category: 'BEC / payment fraud', freq: 0.3, min: 0.2, ml: 2, max: 18, tenants: ['corporate'], actors: ['BEC crews', 'Scattered Spider'], techniques: ['T1566.002', 'T1657'], controls: ['email', 'awareness'], cover: 'Social engineering (CHF 5M sublimit)', coveredPct: 0.5, mix: mix(0, 0.1, 0, 0, 0.9), narrative: 'A spoofed partner changes bank details before a milestone payment.' },
];
SCENARIOS.sghospital = [
  { id: 'rw', name: 'Ransomware forces TrakCare downtime and A&E diversion', category: 'Ransomware', freq: 0.08, min: 0.8, ml: 5, max: 26, tenants: ['obh', 'specialist'], actors: ['LockBit 3.0 affiliates', 'Qilin'], techniques: ['T1133', 'T1078', 'T1486', 'T1490'], controls: ['mfa', 'edr', 'backup', 'patch'], cover: 'Extortion + BI incl. diversion (8 h waiting)', coveredPct: 0.68, mix: mix(0.55, 0.18, 0.12, 0.12, 0.03), narrative: 'TrakCare and PACS are encrypted; elective cases are postponed and A&E diverts ambulances.' },
  { id: 'phi', name: 'Patient record breach incl. VIP and medical-tourism patients', category: 'Data breach', freq: 0.08, min: 0.3, ml: 2, max: 12, tenants: ['obh', 'specialist', 'corp'], actors: ['Data-extortion crews', 'Insider'], techniques: ['T1190', 'T1530', 'T1567.002'], controls: ['logging', 'tprm'], cover: 'Privacy liability, notification and regulatory defence', coveredPct: 0.75, mix: mix(0.05, 0.25, 0.05, 0.6, 0.05), narrative: 'Records are leaked; MOH and PDPC notifications, patient communication and reputational recovery drive cost.' },
  { id: 'device', name: 'Medical device disruption (pumps, lab, imaging)', category: 'OT disruption', freq: 0.05, min: 0.3, ml: 1.8, max: 10, tenants: ['obh', 'labimg'], actors: ['Ransomware spillover', 'OEM remote access abuse'], techniques: ['T0866', 'T0836', 'T1133'], controls: ['seg', 'pam', 'eol'], cover: 'BI; bodily injury excluded', coveredPct: 0.5, mix: mix(0.7, 0.2, 0, 0.08, 0.02), narrative: 'Lab analysers and imaging are taken offline at Science Park; results and reads are outsourced.' },
  { id: 'nehr', name: 'NEHR or HealthConnect interface outage', category: 'Third-party outage', freq: 0.12, min: 0.05, ml: 0.4, max: 2.5, tenants: ['obh'], actors: ['Provider failure'], techniques: ['T1199'], controls: ['tprm'], cover: 'Dependent BI (S$2M sublimit)', coveredPct: 0.4, mix: mix(0.7, 0.2, 0, 0.1, 0), narrative: 'Contribution and lookups fail; clinicians work without shared records and messages are replayed later.' },
  { id: 'reg', name: 'MOH enforcement after a missed notification', category: 'Regulatory', freq: 0.05, min: 0.05, ml: 0.5, max: 3, tenants: ['obh', 'corp'], actors: ['Regulatory follow-on to an incident'], techniques: ['T1078'], controls: ['ir'], cover: 'Regulatory defence where insurable', coveredPct: 0.4, mix: mix(0, 0.3, 0, 0.7, 0), narrative: 'A late 2-hour notification draws MOH enforcement under the Health Information Act.' },
  { id: 'bec', name: 'Insurer-themed refund and supplier fraud', category: 'BEC / payment fraud', freq: 0.3, min: 0.01, ml: 0.12, max: 0.8, tenants: ['corp'], actors: ['BEC crews'], techniques: ['T1566.002', 'T1657'], controls: ['email', 'awareness'], cover: 'Social engineering (S$500k sublimit)', coveredPct: 0.6, mix: mix(0, 0.1, 0, 0, 0.9), narrative: 'Fake insurer portals and supplier emails divert refunds and payments.' },
];
SCENARIOS.studio = [
  { id: 'leak', name: 'Pre-release leak of a tentpole (Crown of Ash)', category: 'Content leak', freq: 0.2, min: 2, ml: 18, max: 140, tenants: ['studios', 'post'], actors: ['Leak forums', 'LAPSUS$-style extortion crews'], techniques: ['T1567.002', 'T1530', 'T1199'], controls: ['tprm', 'seg'], cover: 'Response and leak buy-back ($25M); lost revenue excluded', coveredPct: 0.2, mix: mix(0.65, 0.15, 0.05, 0.1, 0.05), narrative: 'A locked cut leaks weeks before release; lost box office is excluded and only response and re-marketing are insured.' },
  { id: 'rw', name: 'Ransomware on post-production and render', category: 'Ransomware', freq: 0.08, min: 3, ml: 22, max: 120, tenants: ['post', 'studios'], actors: ['Scattered Spider', 'Akira'], techniques: ['T1078', 'T1621', 'T1486', 'T1490'], controls: ['mfa', 'backup', 'edr'], cover: 'Extortion + BI (10 h waiting period)', coveredPct: 0.7, mix: mix(0.6, 0.15, 0.15, 0.06, 0.04), narrative: 'NEXIS and the render farm are encrypted during final delivery; release dates slip.' },
  { id: 'subs', name: 'Starfall+ subscriber data breach (60M accounts)', category: 'Data breach', freq: 0.06, min: 5, ml: 40, max: 260, tenants: ['play'], actors: ['ShinyHunters', 'Magecart groups'], techniques: ['T1190', 'T1530', 'T1059.003'], controls: ['patch', 'logging', 'mfa'], cover: 'Privacy liability, PCI and notification', coveredPct: 0.75, mix: mix(0.1, 0.2, 0.05, 0.6, 0.05), narrative: 'Subscriber data is stolen; CCPA notices, PCI assessments and class actions follow.' },
  { id: 'park', name: 'Park operations disrupted by a ride or ticketing incident', category: 'OT disruption', freq: 0.05, min: 2, ml: 14, max: 90, tenants: ['parks', 'parksasia'], actors: ['OEM remote access abuse', 'Hacktivists'], techniques: ['T0886', 'T0843', 'T1133'], controls: ['seg', 'pam'], cover: 'BI (12 h waiting); bodily injury excluded', coveredPct: 0.55, mix: mix(0.8, 0.12, 0, 0.06, 0.02), narrative: 'Rides are safe-stopped and ticketing fails at peak season; guest refunds and lost attendance follow.' },
  { id: 'cdn', name: 'CDN or cloud outage during a premiere', category: 'Third-party outage', freq: 0.12, min: 1, ml: 6, max: 40, tenants: ['play'], actors: ['Provider failure'], techniques: ['T1199'], controls: ['tprm'], cover: 'Dependent BI ($20M sublimit)', coveredPct: 0.45, mix: mix(0.85, 0.1, 0, 0.05, 0), narrative: 'A provider outage interrupts streaming for a launch weekend; subscribers churn.' },
  { id: 'ato', name: 'Help-desk takeover and talent likeness misuse', category: 'Insider', freq: 0.15, min: 0.2, ml: 2, max: 15, tenants: ['studios'], actors: ['Scattered Spider', 'NullBulge'], techniques: ['T1621', 'T1098', 'T1567.002'], controls: ['mfa', 'awareness'], cover: 'Media liability and response', coveredPct: 0.5, mix: mix(0.1, 0.3, 0.1, 0.45, 0.05), narrative: 'A reset account is used to steal talent files and post a deepfake statement.' },
];

INVESTMENTS.insurance = [
  { id: 'i-mft', name: 'Patch the MFT server and adopt a 72 h KEV SLA with HexaStrike re-test', controlId: 'patch', costM: 0.08, effects: [{ scenario: 'mft', freq: 0.5 }, { scenario: 'rw', freq: 0.1 }], recommended: true, premiumPts: 1.5 },
  { id: 'i-t0', name: 'Convert 22 standing Tier 0 accounts to CyberArk just-in-time', controlId: 'pam', costM: 0.2, effects: [{ scenario: 'rw', freq: 0.2 }, { scenario: 'bpo', freq: 0.1 }], recommended: true, premiumPts: 1 },
  { id: 'i-bpo', name: 'Move 590 BPO users to Island browser and brokered sessions', controlId: 'tprm', costM: 0.35, effects: [{ scenario: 'bpo', freq: 0.45 }], recommended: true, premiumPts: 0.5 },
  { id: 'i-hd', name: 'Verified help-desk resets and payee-change call-back automation', controlId: 'email', costM: 0.1, effects: [{ scenario: 'payee', freq: 0.5 }, { scenario: 'portal', freq: 0.2 }], recommended: true, premiumPts: 0.5 },
  { id: 'i-gw', name: 'Guidewire exit and manual FNOL fallback tested quarterly', controlId: 'backup', costM: 0.6, effects: [{ scenario: 'gw', mag: 0.35 }, { scenario: 'rw', mag: 0.15 }], recommended: false, premiumPts: 0.3 },
];
INVESTMENTS.defence = [
  { id: 'i-seg', name: 'Segment the Building 3 DNC server and CMM hosts', controlId: 'seg', costM: 0.18, effects: [{ scenario: 'rw', freq: 0.4 }, { scenario: 'cmmc', freq: 0.2 }], recommended: true, premiumPts: 2 },
  { id: 'i-eol', name: 'Replace the Windows 7 CMM workstation and XP DNC bridge', controlId: 'eol', costM: 0.12, effects: [{ scenario: 'rw', freq: 0.15 }, { scenario: 'cmmc', freq: 0.2 }], recommended: true, premiumPts: 1.5 },
  { id: 'i-sub', name: 'Hold TDP releases until sub-tier SPRS is verified (Exostar)', controlId: 'tprm', costM: 0.04, effects: [{ scenario: 'subtier', freq: 0.45 }], recommended: true, premiumPts: 1 },
  { id: 'i-ir', name: 'DIBNet decision matrix and image-preservation kit for the range', controlId: 'ir', costM: 0.05, effects: [{ scenario: 'cui', mag: 0.2 }, { scenario: 'cmmc', freq: 0.15 }], recommended: true, premiumPts: 1 },
  { id: 'i-bkp', name: 'Fix range WAN backlog and test DNC restores quarterly', controlId: 'backup', costM: 0.06, effects: [{ scenario: 'rw', mag: 0.3 }, { scenario: 'range', mag: 0.2 }], recommended: false, premiumPts: 1 },
];
INVESTMENTS.pharma = [
  { id: 'i-cork', name: 'Close the 2 Cork IT-to-OT conduits and upgrade the plant edge', controlId: 'seg', costM: 0.6, effects: [{ scenario: 'rw', freq: 0.2 }, { scenario: 'gxp', freq: 0.3 }], recommended: true, premiumPts: 1.5 },
  { id: 'i-fido', name: 'FIDO2 for 380 CRO partner accounts', controlId: 'mfa', costM: 0.15, effects: [{ scenario: 'trial', freq: 0.4 }, { scenario: 'ip', freq: 0.1 }], recommended: true, premiumPts: 1 },
  { id: 'i-var', name: 'Restore R&D file-share monitoring and add exfiltration alerts', controlId: 'logging', costM: 0.08, effects: [{ scenario: 'ip', freq: 0.3 }], recommended: true, premiumPts: 0.5 },
  { id: 'i-paper', name: 'Twice-yearly paper-batch drills at both plants', controlId: 'ir', costM: 0.12, effects: [{ scenario: 'rw', mag: 0.25 }], recommended: true, premiumPts: 0.5 },
  { id: 'i-hmi', name: 'Revalidate and replace the Windows 7 lyophiliser HMI', controlId: 'eol', costM: 0.9, effects: [{ scenario: 'gxp', freq: 0.15 }], recommended: false, premiumPts: 0.5 },
];
INVESTMENTS.sghospital = [
  { id: 'i-seg', name: 'Segment 860 lab and imaging devices at Science Park', controlId: 'seg', costM: 0.35, effects: [{ scenario: 'device', freq: 0.5 }, { scenario: 'rw', mag: 0.1 }], recommended: true, premiumPts: 1.5 },
  { id: 'i-moh', name: 'MOH notification templates and out-of-hours decision owner', controlId: 'ir', costM: 0.02, effects: [{ scenario: 'reg', freq: 0.6 }], recommended: true, premiumPts: 1 },
  { id: 'i-fgt', name: 'Upgrade FortiGate firmware and adopt a 72 h KEV SLA', controlId: 'patch', costM: 0.04, effects: [{ scenario: 'rw', freq: 0.3 }], recommended: true, premiumPts: 1 },
  { id: 'i-vpam', name: 'Move 31 OEM accounts to CyberArk Vendor PAM', controlId: 'pam', costM: 0.08, effects: [{ scenario: 'device', freq: 0.25 }, { scenario: 'phi', freq: 0.1 }], recommended: true, premiumPts: 0.5 },
  { id: 'i-trak', name: 'Clean-room TrakCare restore to meet the 4 h objective', controlId: 'backup', costM: 0.25, effects: [{ scenario: 'rw', mag: 0.3 }], recommended: false, premiumPts: 0.5 },
];
INVESTMENTS.studio = [
  { id: 'i-cst', name: 'Enforce custody agents at Bluebird Dubbing Studios and Northlight Pixel', controlId: 'tprm', costM: 0.1, effects: [{ scenario: 'leak', freq: 0.3 }], recommended: true, premiumPts: 1.5 },
  { id: 'i-hd', name: 'Verified help-desk resets for 1,240 Okta accounts', controlId: 'mfa', costM: 0.12, effects: [{ scenario: 'rw', freq: 0.25 }, { scenario: 'ato', freq: 0.4 }], recommended: true, premiumPts: 1 },
  { id: 'i-ride', name: 'Broker 38 OEM paths into ride control through CyberArk', controlId: 'seg', costM: 0.45, effects: [{ scenario: 'park', freq: 0.4 }], recommended: true, premiumPts: 1 },
  { id: 'i-cohesity', name: 'Re-authenticate resort backups and test ticketing restore', controlId: 'backup', costM: 0.05, effects: [{ scenario: 'park', mag: 0.2 }], recommended: true, premiumPts: 0.5 },
  { id: 'i-pci', name: 'Script integrity on Starfall+ and ticketing checkouts', controlId: 'patch', costM: 0.15, effects: [{ scenario: 'subs', freq: 0.25 }], recommended: false, premiumPts: 0.3 },
];

SUBLIMITS.insurance = [
  { name: 'Incident response and forensics', limitM: 75, retention: 'Nil for panel vendors', note: 'HexaShield DFIR on the Beazley panel', scenarios: ['rw', 'mft', 'bpo'], kind: 'full' },
  { name: 'Ransomware and cyber extortion', limitM: 25, note: 'OFAC screening; board approval for any payment', scenarios: ['rw'], kind: 'sublimit' },
  { name: 'Business interruption', limitM: 75, waiting: '8 h', note: 'Claims and billing outage measured per day', scenarios: ['rw', 'wiper'], kind: 'full' },
  { name: 'Dependent BI (Guidewire, One Inc, cloud)', limitM: 10, waiting: '12 h', note: 'Guidewire Cloud and One Inc named', scenarios: ['gw'], kind: 'sublimit' },
  { name: 'Privacy liability and notification', limitM: 75, note: 'Multi-state notification and class-action defence', scenarios: ['mft', 'bpo'], kind: 'full' },
  { name: 'Regulatory defence and penalties (NYDFS, state DOIs)', limitM: 10, note: 'Where insurable by law', scenarios: ['mft', 'bpo'], kind: 'sublimit' },
  { name: 'Social engineering and payee fraud', limitM: 2.5, note: 'Call-back and dual approval required', scenarios: ['payee', 'portal'], kind: 'sublimit' },
];
SUBLIMITS.defence = [
  { name: 'Incident response and forensics (US-person responders)', limitM: 10, retention: 'Nil for panel vendors', note: 'Includes DIBNet forensics and 90-day image preservation', scenarios: ['cui', 'rw', 'subtier'], kind: 'full' },
  { name: 'Ransomware and cyber extortion', limitM: 2.5, note: 'OFAC screening; DoD contracting officer informed', scenarios: ['rw'], kind: 'sublimit' },
  { name: 'Business interruption', limitM: 10, waiting: '12 h', note: 'Lost machining and range days measured per day', scenarios: ['rw', 'range'], kind: 'full' },
  { name: 'Regulatory defence (DFARS, ITAR)', limitM: 1, note: 'Fines and penalties only where insurable', scenarios: ['cui', 'subtier'], kind: 'sublimit' },
  { name: 'Social engineering fraud', limitM: 0.25, note: 'Costpoint vendor-master dual approval', scenarios: ['bec'], kind: 'sublimit' },
  { name: 'Loss of contracts or award eligibility', limitM: null, note: 'Excluded: consequential loss of DoD business', scenarios: ['cmmc'], kind: 'excluded' },
];
SUBLIMITS.pharma = [
  { name: 'Incident response and forensics', limitM: 150, retention: 'Nil for panel vendors', note: 'HexaShield DFIR on the Swiss Re CS panel', scenarios: ['rw', 'trial', 'ip'], kind: 'full' },
  { name: 'Ransomware and cyber extortion', limitM: 40, note: 'Sanctions screening; board approval', scenarios: ['rw'], kind: 'sublimit' },
  { name: 'Business interruption (plants)', limitM: 150, waiting: '12 h', note: 'Lost batch release per day per plant', scenarios: ['rw', 'gxp'], kind: 'full' },
  { name: 'Dependent BI (named CMOs and CROs)', limitM: 20, waiting: '24 h', note: 'Lonza, Catalent, Samsung Biologics, IQVIA named', scenarios: ['cmo'], kind: 'sublimit' },
  { name: 'Product contamination from a cyber event', limitM: 25, note: 'Endorsement: rejected batches after a GxP data-integrity event', scenarios: ['gxp'], kind: 'endorsement' },
  { name: 'Privacy liability (GDPR, revDSG, HIPAA)', limitM: 75, note: 'Trial participants and patient-services data', scenarios: ['trial'], kind: 'full' },
  { name: 'Social engineering fraud', limitM: 5, note: 'Dual approval for licensing payments', scenarios: ['bec'], kind: 'sublimit' },
  { name: 'Loss of IP value', limitM: null, note: 'Excluded: only response costs are covered', scenarios: ['ip'], kind: 'excluded' },
];
SUBLIMITS.sghospital = [
  { name: 'Incident response and forensics', limitM: 15, retention: 'Nil for panel vendors', note: 'HexaShield DFIR on the Chubb panel', scenarios: ['rw', 'phi', 'device'], kind: 'full' },
  { name: 'Ransomware and cyber extortion', limitM: 5, note: 'Sanctions screening; board approval', scenarios: ['rw'], kind: 'sublimit' },
  { name: 'Business interruption incl. diversion', limitM: 15, waiting: '8 h', note: 'Diversion and cancelled procedures measured per day', scenarios: ['rw', 'device'], kind: 'full' },
  { name: 'Dependent BI (NEHR, IT providers)', limitM: 2, waiting: '12 h', note: 'Synapxe and NCS named', scenarios: ['nehr'], kind: 'sublimit' },
  { name: 'Privacy liability and notification (PDPA, HIA)', limitM: 15, note: 'Includes medical-tourism patients abroad', scenarios: ['phi'], kind: 'full' },
  { name: 'Regulatory defence (MOH, PDPC)', limitM: 1, note: 'Penalties only where insurable', scenarios: ['reg', 'phi'], kind: 'sublimit' },
  { name: 'Social engineering fraud', limitM: 0.5, note: 'Call-back for refunds and supplier changes', scenarios: ['bec'], kind: 'sublimit' },
  { name: 'Bodily injury from device compromise', limitM: null, note: 'Excluded: responds under medical malpractice', scenarios: ['device'], kind: 'excluded' },
];
SUBLIMITS.studio = [
  { name: 'Incident response and forensics', limitM: 350, retention: 'Nil for panel vendors', note: 'HexaShield DFIR on the AIG panel', scenarios: ['rw', 'subs', 'leak'], kind: 'full' },
  { name: 'Ransomware and cyber extortion', limitM: 100, note: 'Sanctions screening; disclosure committee informed', scenarios: ['rw'], kind: 'sublimit' },
  { name: 'Business interruption (studios, streaming, parks)', limitM: 350, waiting: '10 h', note: 'Lost subscriptions, attendance and delivery delays', scenarios: ['rw', 'park'], kind: 'full' },
  { name: 'Dependent BI (CDN, cloud, ticketing)', limitM: 20, waiting: '12 h', note: 'Akamai, AWS and accesso named', scenarios: ['cdn'], kind: 'sublimit' },
  { name: 'Content leak buy-back', limitM: 25, note: 'Endorsement: response and re-marketing after a pre-release leak', scenarios: ['leak'], kind: 'endorsement' },
  { name: 'Privacy liability and PCI', limitM: 350, note: 'Starfall+ subscribers and park guests', scenarios: ['subs'], kind: 'full' },
  { name: 'Media liability', limitM: 50, note: 'Defamation and likeness claims after a takeover', scenarios: ['ato'], kind: 'sublimit' },
  { name: 'Lost box office and licensing revenue', limitM: null, note: 'Excluded: future revenue from leaked content', scenarios: ['leak'], kind: 'excluded' },
];

SECTOR_EXCLUSIONS.insurance = [
  { name: 'Systemic and widespread events', wording: 'Losses from a widespread event affecting multiple insureds or a major cloud or payments provider subject to a sublimit or exclusion', risk: 'high', impact: 'A Guidewire Cloud or hyperscaler-wide outage may fall under the widespread-event sublimit rather than full BI.', evidence: 'Connector health history shows the provider-side root cause and duration.' },
  { name: 'Uninsurable regulatory penalties', wording: 'Fines and penalties uninsurable by law, including some state insurance department penalties', risk: 'medium', impact: 'NYDFS penalties may not be recoverable; defence costs are.', evidence: 'Point-in-time attestation supports the certification defence.' },
];
SECTOR_EXCLUSIONS.defence = [
  { name: 'Loss of contracts and award eligibility', wording: 'Consequential loss including loss of government contracts excluded', risk: 'high', impact: 'Lost DoD awards after a failed CMMC assessment or CUI incident are not insured.', evidence: 'SPRS history and POA&M progress support the remediation narrative with primes.' },
  { name: 'Export-control penalties', wording: 'Fines and penalties for ITAR or EAR violations excluded', risk: 'high', impact: 'Civil penalties after a spill of technical data are uninsurable; voluntary disclosure costs may be covered.', evidence: 'Teamcenter export history and US-person checks show reasonable controls.' },
];
SECTOR_EXCLUSIONS.pharma = [
  { name: 'Product recall and product liability', wording: 'Costs of recall and bodily injury from products excluded', risk: 'high', impact: 'A recall after a GxP data-integrity event falls to the product recall policy; only the contamination endorsement responds.', evidence: 'Audit-trail records show which batches were affected.' },
  { name: 'Loss of intellectual property value', wording: 'Loss of value of trade secrets or IP excluded', risk: 'high', impact: 'Stolen compound libraries or process IP are not compensated.', evidence: 'HexaCustody and Varonis records support investigation scope.' },
];
SECTOR_EXCLUSIONS.sghospital = [
  { name: 'Bodily injury and medical malpractice', wording: 'Bodily injury, sickness or death excluded, including from a compromised medical device', risk: 'high', impact: 'Patient harm during diversion or a pump incident falls to the medical malpractice policy.', evidence: 'Read-only device monitoring evidence supports both policies.' },
  { name: 'Uninsurable penalties', wording: 'Fines and penalties where uninsurable under Singapore law', risk: 'medium', impact: 'MOH and PDPC financial penalties may not be recoverable; defence costs are.', evidence: 'Notification timestamps show compliance with the 2-hour and 3-day clocks.' },
];
SECTOR_EXCLUSIONS.studio = [
  { name: 'Loss of future revenue from leaked content', wording: 'Lost profits, box office or licensing income from disclosure of content excluded', risk: 'high', impact: 'The largest part of a tentpole leak is uninsured; only response and the $25M buy-back respond.', evidence: 'Custody and watermark records support the buy-back claim.' },
  { name: 'Bodily injury at parks', wording: 'Bodily injury and property damage excluded', risk: 'medium', impact: 'Guest injury after a ride incident falls to general liability.', evidence: 'Ride control monitoring is read-only and preserved for both policies.' },
];
HISTORY.insurance = [[1300, 50, 2000], [2200, 50, 2500], [2800, 75, 2500], [2700, 75, 2500]];
HISTORY.defence = [[90, 3, 100], [170, 5, 150], [240, 10, 250], [270, 10, 250]];
HISTORY.pharma = [[2400, 100, 2500], [4600, 100, 5000], [6500, 150, 5000], [6400, 150, 5000]];
HISTORY.sghospital = [[210, 5, 250], [390, 10, 500], [560, 15, 500], [590, 15, 500]];
HISTORY.studio = [[6200, 250, 15000], [11800, 300, 25000], [15600, 350, 25000], [15100, 350, 25000]];
PEERS.insurance = [
  { label: 'Kingsbridge', rol: 3.5, limitToRevenue: 2.2, retentionPct: 3.3 },
  { label: 'Peer median (US P&C mutuals)', rol: 3.9, limitToRevenue: 1.8, retentionPct: 4 },
  { label: 'Top quartile', rol: 3.2, limitToRevenue: 2.6, retentionPct: 2.8 },
];
PEERS.defence = [
  { label: 'Sentry Peak', rol: 2.9, limitToRevenue: 4.8, retentionPct: 2.5 },
  { label: 'Peer median (DIB sub-tiers)', rol: 3.4, limitToRevenue: 3.5, retentionPct: 3 },
  { label: 'Top quartile', rol: 2.6, limitToRevenue: 5.5, retentionPct: 2 },
];
PEERS.pharma = [
  { label: 'Rhenara', rol: 4.1, limitToRevenue: 0.63, retentionPct: 3.3 },
  { label: 'Peer median (large pharma)', rol: 4.4, limitToRevenue: 0.55, retentionPct: 4 },
  { label: 'Top quartile', rol: 3.8, limitToRevenue: 0.8, retentionPct: 2.8 },
];
PEERS.sghospital = [
  { label: 'Orchid Bay', rol: 4.1, limitToRevenue: 1.9, retentionPct: 3.3 },
  { label: 'Peer median (APAC private hospitals)', rol: 4.6, limitToRevenue: 1.5, retentionPct: 4 },
  { label: 'Top quartile', rol: 3.7, limitToRevenue: 2.4, retentionPct: 2.5 },
];
PEERS.studio = [
  { label: 'Starfall', rol: 4.2, limitToRevenue: 0.67, retentionPct: 7.1 },
  { label: 'Peer median (diversified media)', rol: 4.5, limitToRevenue: 0.6, retentionPct: 8 },
  { label: 'Top quartile', rol: 3.9, limitToRevenue: 0.85, retentionPct: 6 },
];
Object.assign(RECORDS, {
  insurance: '4.6M policyholder and claimant records (NPI incl. driver records and medical bills), 260k telematics profiles; premium cards tokenised by One Inc.',
  defence: 'About 2,400 employee and contractor records; CUI and ITAR technical data rather than consumer data; no card data stored.',
  pharma: '31,400 trial participants (pseudonymised), 1.1M patient-services enrolees in the US, 30,000 employees; no card data stored.',
  sghospital: '1.2M patient records incl. NRIC numbers, 18,000 international patients; card payments via a PCI-compliant processor.',
  studio: '60M Starfall+ subscribers, 9M park guest profiles and StarPass wearables, talent and crew records; cards tokenised by Adyen.',
});
Object.assign(PRIOR, {
  insurance: 'No claims above retention in 5 years; 1 payee-fraud loss below retention (2025) and 1 BPO data incident notified to NYDFS.',
  defence: '1 notice of circumstances (2025 sub-tier ransomware with possible CUI exposure); no claims paid.',
  pharma: '1 notice of circumstances (2025 CMO document-system breach); 1 BEC loss below retention.',
  sghospital: '1 PDPC notification in 2025 (misdirected export, no claim); 1 contained ransomware attempt without claim.',
  studio: 'No claims above retention in 3 years; 1 trailer leak handled under the buy-back without claim.',
});
OBLIGATIONS.insurance = [
  { party: 'NYDFS', trigger: 'Cybersecurity event or ransom payment', deadline: '72 h; ransom payment 24 h', hours: 24, basis: '23 NYCRR 500.17' },
  { party: 'Connecticut Insurance Department', trigger: 'Cybersecurity event affecting nonpublic information', deadline: '3 business days', hours: 72, basis: 'Conn. Gen. Stat. 38a-38 (NAIC #668)' },
  { party: 'Ohio and Iowa insurance departments', trigger: 'Cybersecurity event affecting state residents', deadline: '3 business days', hours: 72, basis: 'State adoptions of NAIC #668' },
  { party: 'Affected policyholders and state AGs', trigger: 'Breach of personal information', deadline: 'Most expedient time (state law)', hours: 720, basis: 'State breach notification laws' },
  { party: 'Card brands via acquirer', trigger: 'Suspected compromise of premium payments', deadline: 'Immediately', hours: 1, basis: 'PCI DSS 12.10' },
  { party: 'Reinsurers (Munich Re, Swiss Re)', trigger: 'Cyber event affecting treaty data or claims operations', deadline: '48 h', hours: 48, basis: 'Treaty notification clauses' },
];
OBLIGATIONS.defence = [
  { party: 'DoD via DIBNet', trigger: 'Cyber incident affecting covered defence information', deadline: '72 h', hours: 72, basis: 'DFARS 252.204-7012(c)' },
  { party: 'DC3', trigger: 'Malicious software isolated', deadline: 'With the DIBNet report', hours: 72, basis: 'DFARS 252.204-7012(d)' },
  { party: 'Prime contractors', trigger: 'Incident affecting their CUI or deliveries', deadline: 'Promptly; target 24 h', hours: 24, basis: 'Subcontract flow-down clauses' },
  { party: 'DDTC (State Department)', trigger: 'Possible unauthorised export of ITAR technical data', deadline: 'Initial voluntary disclosure within 60 days of discovery', hours: 1440, basis: 'ITAR 22 CFR 127.12' },
  { party: 'Affected employees and state AG (Alabama)', trigger: 'Breach of employee personal information', deadline: '45 days', hours: 1080, basis: 'Alabama Data Breach Notification Act' },
];
OBLIGATIONS.pharma = [
  { party: 'NCSC Ireland', trigger: 'Significant incident at Cork or Dublin', deadline: 'Early warning 24 h; notification 72 h', hours: 24, basis: 'NIS2 Art. 23 (Irish transposition)' },
  { party: 'Irish DPC and Swiss FDPIC', trigger: 'Personal data breach (trial or employee data)', deadline: '72 h (GDPR); as soon as possible (revDSG)', hours: 72, basis: 'GDPR Art. 33 · revDSG Art. 24' },
  { party: 'EU member states (CTIS)', trigger: 'Serious breach of a trial protocol or GCP', deadline: '7 days', hours: 168, basis: 'EU CTR Art. 52' },
  { party: 'Swissmedic, HPRA and FDA', trigger: 'Supply disruption or data-integrity impact on released product', deadline: 'Without delay', hours: 24, basis: 'GMP and shortage reporting rules' },
  { party: 'NCSC Switzerland', trigger: 'Cyber attack on critical infrastructure in Switzerland', deadline: '24 h', hours: 24, basis: 'Swiss Information Security Act reporting duty' },
  { party: 'Licensing and co-development partners', trigger: 'Incident affecting shared IP or data', deadline: '48 h', hours: 48, basis: 'Partner agreements' },
];
OBLIGATIONS.sghospital = [
  { party: 'Ministry of Health', trigger: 'Notifiable cybersecurity or data incident', deadline: '2 h after assessment; detailed report within 14 days', hours: 2, basis: 'Health Information Act' },
  { party: 'PDPC', trigger: 'Notifiable data breach', deadline: '3 calendar days after assessment', hours: 72, basis: 'PDPA s26D' },
  { party: 'Affected patients', trigger: 'Notifiable data breach likely to cause significant harm', deadline: 'On or after notifying PDPC', hours: 72, basis: 'PDPA s26D(2)' },
  { party: 'CSA / SingCERT', trigger: 'Significant cyber incident', deadline: 'As soon as practicable', hours: 24, basis: 'CSA incident reporting guidance' },
  { party: 'HSA and device manufacturers', trigger: 'Cyber event affecting a medical device', deadline: 'Promptly', hours: 48, basis: 'HSA medical device adverse event reporting' },
  { party: 'Insurer panel partners', trigger: 'Incident affecting claims or eligibility exchange', deadline: '24 h', hours: 24, basis: 'Panel hospital agreements' },
];
OBLIGATIONS.studio = [
  { party: 'SEC (Form 8-K Item 1.05)', trigger: 'Material cybersecurity incident', deadline: '4 business days after materiality', hours: 96, basis: 'SEC cyber disclosure rule' },
  { party: 'California AG and consumers', trigger: 'Breach of 500+ California residents', deadline: 'Most expedient time', hours: 72, basis: 'Cal. Civ. Code 1798.82' },
  { party: 'Licensors, distributors and talent', trigger: 'Leak of pre-release content', deadline: '24 h', hours: 24, basis: 'Distribution agreements · MPA / TPN' },
  { party: 'Card brands via acquirer', trigger: 'Suspected compromise of Starfall+ or park payments', deadline: 'Immediately', hours: 1, basis: 'PCI DSS 12.10' },
  { party: 'Japan PPC', trigger: 'Personal data breach at the Osaka resort', deadline: 'Preliminary report promptly (about 3–5 days)', hours: 120, basis: 'APPI Art. 26' },
  { party: 'ICO (London post)', trigger: 'Personal data breach', deadline: '72 h', hours: 72, basis: 'UK GDPR Art. 33' },
];
PRIORS.insurance = [
  { title: 'Payee change on a total-loss claim via spoofed claimant email', category: 'BEC / payment fraud', lossM: 0.38, claimed: 'Below retention', paidM: 0, lesson: 'Dual approval for all payee changes in ClaimCenter.' },
  { title: 'BPO user copied a claims queue to USB', category: 'Insider', lossM: 0.6, claimed: 'Notice of circumstances', paidM: 0, lesson: 'Removable media blocked; Island browser rollout started.' },
  { title: 'Guidewire Cloud regression slowed FNOL during a hail event', category: 'Third-party outage', lossM: 0.9, claimed: 'No claim', paidM: 0, lesson: 'Paper FNOL scripts added to the contact centre BCP.' },
  { title: 'Ransomware attempt on a claims file server, contained in 34 min', category: 'Ransomware', lossM: 0.1, claimed: 'No claim', paidM: 0, lesson: 'Confirmed HexaSOC containment authority.' },
];
PRIORS.defence = [
  { title: 'Sub-tier machine shop ransomware with possible CUI exposure', category: 'Third-party outage', lossM: 0.4, claimed: 'Notice of circumstances', paidM: 0, lesson: 'Sub-tier SPRS verification before TDP release.' },
  { title: 'Costpoint vendor-bank change attempt', category: 'BEC / payment fraud', lossM: 0.05, claimed: 'No claim', paidM: 0, lesson: 'Call-back threshold lowered to $5k.' },
  { title: 'Phishing via a look-alike prime RFQ portal', category: 'Data breach', lossM: 0.02, claimed: 'No claim', paidM: 0, lesson: 'FIDO2 enforced on the commercial tenant too.' },
  { title: 'Range telemetry network outage during a campaign', category: 'OT disruption', lossM: 0.18, claimed: 'Below retention', paidM: 0, lesson: 'Local recording added for range data.' },
];
PRIORS.pharma = [
  { title: 'CMO document-system breach (tech-transfer pack exposed)', category: 'Third-party outage', lossM: 1.4, claimed: 'Notice of circumstances', paidM: 0, lesson: 'Security incident clauses added to all CMO quality agreements.' },
  { title: 'Licensing milestone payment redirect attempt', category: 'BEC / payment fraud', lossM: 0.9, claimed: 'Below retention', paidM: 0, lesson: 'Call-back verification for all partner bank changes.' },
  { title: 'Ransomware attempt on a Basel file server, contained in 29 min', category: 'Ransomware', lossM: 0.3, claimed: 'No claim', paidM: 0, lesson: 'Validated isolation authority for the Cyber Defence Centre.' },
  { title: 'Cold-chain excursion after a logger failure', category: 'Third-party outage', lossM: 0.6, claimed: 'No claim', paidM: 0, lesson: 'Redundant loggers for biologics shipments.' },
];
PRIORS.sghospital = [
  { title: 'Misdirected export of patient records to an overseas partner', category: 'Data breach', lossM: 0.08, claimed: 'No claim', paidM: 0, lesson: 'PDPA s26 transfer procedure and DLP rules for exports.' },
  { title: 'Ransomware attempt on a day-surgery file server, contained in 44 min', category: 'Ransomware', lossM: 0.15, claimed: 'No claim', paidM: 0, lesson: 'Triggered the MOH 2-hour drill programme.' },
  { title: 'Insurer-themed phishing hit the billing team', category: 'BEC / payment fraud', lossM: 0.02, claimed: 'No claim', paidM: 0, lesson: 'Impersonation rules added for insurer domains.' },
  { title: 'Alaris drug-library sync failure (expired certificate)', category: 'OT disruption', lossM: 0.05, claimed: 'No claim', paidM: 0, lesson: 'Certificate expiry monitoring for device servers.' },
];
PRIORS.studio = [
  { title: 'Lodestar teaser leaked 2 days early via agency workstation', category: 'Content leak', lossM: 2.4, claimed: 'Below retention', paidM: 0, lesson: 'Custody agents mandatory for marketing agencies.' },
  { title: 'Card-testing bots on the ticketing site', category: 'BEC / payment fraud', lossM: 0.4, claimed: 'No claim', paidM: 0, lesson: 'Bot management rules tightened for checkouts.' },
  { title: 'Support export exposed 4,800 subscriber emails', category: 'Data breach', lossM: 0.3, claimed: 'No claim', paidM: 0, lesson: 'Exports blocked from vendor-visible tickets.' },
  { title: 'Show-control fault closed an Orlando attraction for 2 h 40 min', category: 'OT disruption', lossM: 0.7, claimed: 'No claim', paidM: 0, lesson: 'OEM patch and change window agreed.' },
];
