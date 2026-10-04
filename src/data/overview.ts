import type { CustomerProfile, Severity } from './types';
import { vrHeadline } from './modules/vulnresponse';
import { forCustomer, type CustomerMap } from './customerMap';

export interface AttentionItem {
  sev: Severity;
  module: string; // module id from the registry
  title: string;
  detail: string;
  path: string;
  ageMin: number;
  tenant: string;
}

export interface FeedEvent {
  module: string;
  text: string;
  tenant: string;
  kind: 'detect' | 'action' | 'evidence' | 'intel' | 'loop' | 'custody' | 'test' | 'system';
}

const ATTENTION: Partial<CustomerMap<AttentionItem[]>> = {
  maritime: [
    { sev: 'critical', module: 'soc', title: 'Hands-on-keyboard activity on PKL-ENG-WS03', detail: 'Engineering workstation in the Port Klang Level 3 zone; HexaSOC isolated the IT NIC, OT side left untouched pending approval', path: '/soc/ir', ageMin: 38, tenant: 'pkl' },
    { sev: 'high', module: 'ot', title: 'Unscheduled PLC programme download to STS crane 14', detail: 'S7comm download from jump host outside change window, Maasvlakte quay 3', path: '/ot/visibility', ageMin: 72, tenant: 'rtm' },
    { sev: 'high', module: 'int', title: '4 crew VSAT portal credentials in a fresh stealer log', detail: 'Lumma infostealer, infected personal laptop, Halcyon Aurora', path: '/int/exposure', ageMin: 140, tenant: 'fleet' },
    { sev: 'high', module: 'fabric', title: 'KEV: CVE-2024-3400 on Santos GlobalProtect gateway', detail: 'Internet-facing, exploited in the wild, 3 days in SLA remaining', path: '/fabric/exposure', ageMin: 260, tenant: 'sts' },
    { sev: 'medium', module: 'loop', title: '9 vessel remote-access loops partial', detail: 'IACS E26 4.2.2: detection deployed in staging, awaiting approval', path: '/loop', ageMin: 400, tenant: 'fleet' },
    { sev: 'medium', module: 'ops', title: '3 write-back actions awaiting approval', detail: 'Deploy scheduled rule (Sentinel), block IP (Panorama), revoke sessions (Entra)', path: '/ops/actions', ageMin: 55, tenant: 'hq' },
    { sev: 'medium', module: 'comply', title: 'ISO 27001 surveillance audit in 34 days', detail: '27 evidence tasks overdue, 6 owned by Port Klang', path: '/comply/caas', ageMin: 1440, tenant: 'hq' },
    { sev: 'low', module: 'fabric', title: 'Veeam connector degraded: API field drift', detail: 'Backup evidence older than freshness window for 3 controls', path: '/fabric/integrations', ageMin: 190, tenant: 'hq' },
  ],
  finserv: [
    { sev: 'critical', module: 'soc', title: 'MFA fatigue then Okta session from new ASN: Treasury Ops user', detail: 'Session revoked by approval 4 min after detection; investigating SWIFT operator overlap', path: '/soc/ir', ageMin: 26, tenant: 'ukbank' },
    { sev: 'high', module: 'strike', title: 'Critical: BOLA on open-banking accounts API', detail: 'Found in pen test PT-2026-031; QSA on-site in 6 weeks', path: '/strike/pentest', ageMin: 300, tenant: 'ukbank' },
    { sev: 'high', module: 'int', title: '23 lookalike domains, 3 with live MX and cloned login', detail: 'aldersgate-secure[.]com hosting a credential harvest kit', path: '/int/darkweb', ageMin: 95, tenant: 'ukbank' },
    { sev: 'high', module: 'comply', title: 'DORA major-incident clock: initial notification due', detail: 'Payments latency incident classified major; 4-hour initial report window open', path: '/ops/warroom', ageMin: 118, tenant: 'pay' },
    { sev: 'medium', module: 'fabric', title: '14 standing Tier 0 admin accounts', detail: 'Not vaulted in CyberArk, 6 unused for 90+ days', path: '/fabric/identity', ageMin: 720, tenant: 'ukbank' },
    { sev: 'medium', module: 'ops', title: '5 write-back actions awaiting approval', detail: '2 high-risk (contain host, clear sessions) need a Tenant Admin', path: '/ops/actions', ageMin: 40, tenant: 'ukbank' },
    { sev: 'medium', module: 'comply', title: 'DORA Register of Information: 31 contracts missing LEI', detail: 'Submission to CSSF due in January', path: '/comply/tprm', ageMin: 2880, tenant: 'eu' },
    { sev: 'low', module: 'fabric', title: 'Veracode connector rate limited (429)', detail: 'AppSec evidence for PCI 6.2 going stale in 2 days', path: '/fabric/integrations', ageMin: 145, tenant: 'pay' },
  ],
  media: [
    { sev: 'critical', module: 'custody', title: 'Nightjar locked cut copied to personal cloud', detail: 'Freelance colourist, Soho edit bay 4; session revoked, forensic watermark traced', path: '/custody/revocation', ageMin: 22, tenant: 'post' },
    { sev: 'high', module: 'int', title: '"The Long Tide S2" stills offered on a leak forum', detail: 'Watermark ID matches Red Fern Localisation review session', path: '/int/darkweb', ageMin: 180, tenant: 'studios' },
    { sev: 'high', module: 'strike', title: '3 critical findings on screeners portal', detail: 'Review-link auth bypass, IDOR on screener IDs, outdated Next.js', path: '/strike/pentest', ageMin: 1440, tenant: 'studios' },
    { sev: 'high', module: 'soc', title: 'Okta admin sign-in from residential proxy', detail: 'Help-desk reset 12 min earlier; Scattered Spider pattern, sessions cleared', path: '/soc/mdr', ageMin: 64, tenant: 'studios' },
    { sev: 'medium', module: 'comply', title: 'TPN+ re-assessment in 41 days', detail: '34 tasks overdue; vendor attestations missing for 6 tier-1 vendors', path: '/comply/caas', ageMin: 2160, tenant: 'post' },
    { sev: 'medium', module: 'ai', title: 'ElevenLabs voice cloning used on talent audio', detail: 'Unsanctioned AI with talent likeness rights; 3 users in Marketing', path: '/ai/discovery', ageMin: 600, tenant: 'studios' },
    { sev: 'medium', module: 'fabric', title: 'Integration entitlement at 18 of 20', detail: 'Professional tier; Enterprise unlocks unlimited connectors and BYOK', path: '/ops/admin', ageMin: 4320, tenant: 'studios' },
    { sev: 'low', module: 'fabric', title: 'KnowBe4 connector paused', detail: 'API key rotation pending; awareness evidence stale', path: '/fabric/integrations', ageMin: 2880, tenant: 'studios' },
  ],
};

ATTENTION.healthcare = [
  { sev: 'critical', module: 'soc', title: 'Help-desk MFA reset then Citrix login from residential proxy: ICU charge nurse account', detail: 'Scattered Spider pattern; sessions revoked by approval, Epic access reviewed', path: '/soc/ir', ageMin: 31, tenant: 'mrmc' },
  { sev: 'high', module: 'ot', title: '1,140 legacy infusion pumps and imaging workstations on a flat clinical VLAN', detail: 'Community hospitals; Windows 7 imaging consoles reachable from guest Wi-Fi bridge', path: '/ot/visibility', ageMin: 210, tenant: 'community' },
  { sev: 'high', module: 'int', title: 'Patient portal credentials and 2 clinician logins in a Qilin-affiliate stealer log', detail: 'MyChart login cookies included; forced resets queued for approval', path: '/int/exposure', ageMin: 95, tenant: 'clinics' },
  { sev: 'high', module: 'fabric', title: 'KEV: CVE-2023-4966 on the Citrix gateway at Zanesville', detail: 'Internet-facing, exploited by healthcare ransomware crews; 2 days left in SLA', path: '/fabric/exposure', ageMin: 300, tenant: 'community' },
  { sev: 'medium', module: 'comply', title: 'HITRUST r2 validated assessment in 5 months', detail: '31 evidence tasks overdue; HIPAA risk analysis refresh due in January', path: '/comply/caas', ageMin: 1440, tenant: 'mrmc' },
  { sev: 'medium', module: 'ops', title: '4 write-back actions awaiting approval', detail: 'Contain host (CrowdStrike), revoke sessions (Entra), deploy rule (Sentinel), block sender (Mimecast)', path: '/ops/actions', ageMin: 45, tenant: 'mrmc' },
  { sev: 'medium', module: 'ai', title: 'ChatGPT used with patient identifiers by 9 clinicians', detail: 'Netskope-equivalent DLP via Defender; BAA not in place', path: '/ai/discovery', ageMin: 520, tenant: 'mrmc' },
  { sev: 'low', module: 'fabric', title: 'Epic Clarity extract late after upgrade', detail: 'Break-the-glass evidence stale for HIPAA 164.312(b)', path: '/fabric/integrations', ageMin: 150, tenant: 'mrmc' },
];
ATTENTION.automotive = [
  { sev: 'critical', module: 'ot', title: 'Unscheduled PLC download to body-shop press line 3', detail: 'From a KUKA service laptop via BeyondTrust session outside the change window, Ingolstadt', path: '/ot/visibility', ageMin: 27, tenant: 'ingolstadt' },
  { sev: 'critical', module: 'soc', title: 'Akira-style lateral movement on Puebla MES server', detail: 'HexaSOC contained IT side; OT conduit left untouched pending plant approval', path: '/soc/ir', ageMin: 52, tenant: 'puebla' },
  { sev: 'high', module: 'int', title: 'Supplier stealer log contains OTA signing portal credentials', detail: 'Tier 1 telematics supplier engineer; R156 key-use review opened', path: '/int/exposure', ageMin: 120, tenant: 'connected' },
  { sev: 'high', module: 'custody', title: 'Project Lumen design renders opened on an unmanaged device', detail: 'External design agency, Milan; watermark ID traced, supplier session revoked', path: '/custody/overview', ageMin: 85, tenant: 'group' },
  { sev: 'high', module: 'fabric', title: 'Vehicle API: 41k token-replay attempts against remote-unlock endpoint', detail: 'Upstream vSOC flagged; rate limits holding, no vehicles affected', path: '/fabric/exposure', ageMin: 160, tenant: 'connected' },
  { sev: 'medium', module: 'comply', title: 'UNECE R155 CSMS re-audit in 6 months', detail: '23 tasks overdue; TISAX AL3 renewal in February', path: '/comply/caas', ageMin: 1440, tenant: 'group' },
  { sev: 'medium', module: 'ops', title: '6 write-back actions awaiting approval', detail: '2 high-risk (terminate vendor session, revoke sessions) need a Tenant Admin', path: '/ops/actions', ageMin: 38, tenant: 'group' },
  { sev: 'low', module: 'fabric', title: 'Battery plant bundle arrives every 6 h (air-gapped)', detail: 'Last signed bundle 6 h ago; next import due 14:00', path: '/fabric/dataplanes', ageMin: 360, tenant: 'battery' },
];

const FEED: CustomerMap<FeedEvent[]> = {
  healthcare: [
    { module: 'soc', kind: 'detect', tenant: 'mrmc', text: 'HexaSOC closed 1,410 benign Imprivata badge-tap alerts (shift change)' },
    { module: 'ot', kind: 'detect', tenant: 'kids', text: 'Claroty xDome: new Philips IntelliVue monitor joined PICU VLAN' },
    { module: 'loop', kind: 'loop', tenant: 'mrmc', text: 'Loop closed: CTL-BKP-06 × T1490, Epic downtime restore validated' },
    { module: 'int', kind: 'intel', tenant: 'mrmc', text: 'Health-ISAC flash: Rhysida targeting Citrix in US hospitals' },
    { module: 'comply', kind: 'evidence', tenant: 'clinics', text: 'Evidence collected: BAA register review (HIPAA 164.308(b))' },
    { module: 'ops', kind: 'action', tenant: 'mrmc', text: 'Action verified: Sentinel rule "HV-T1621-MFA-fatigue" enabled' },
    { module: 'custody', kind: 'custody', tenant: 'research', text: 'Genomics cohort GX-2026 shared with partner university, hashes verified' },
    { module: 'strike', kind: 'test', tenant: 'community', text: 'HexaStrike purple test T1133 (Citrix): detection fired in 52 s' },
    { module: 'fabric', kind: 'system', tenant: 'community', text: 'Marion MPLS recovered: 3,200 buffered device events ingested' },
    { module: 'ai', kind: 'detect', tenant: 'mrmc', text: 'HexaAI: DAX ambient notes model card updated, risk re-assessed' },
  ],
  automotive: [
    { module: 'soc', kind: 'detect', tenant: 'group', text: 'HexaSOC closed 3,960 benign QRadar offenses (SAP batch window)' },
    { module: 'ot', kind: 'detect', tenant: 'gyor', text: 'Armis: new Siemens S7-1500 on e-drive line 2, matched change CHG0142201' },
    { module: 'loop', kind: 'loop', tenant: 'connected', text: 'Loop closed: CTL-OTA-01 × T1195.002, signing anomaly detection validated' },
    { module: 'int', kind: 'intel', tenant: 'group', text: 'Auto-ISAC: Black Basta campaign against European Tier 1 suppliers' },
    { module: 'comply', kind: 'evidence', tenant: 'group', text: 'Evidence collected: TISAX prototype protection walk-through (8.1)' },
    { module: 'ops', kind: 'action', tenant: 'ingolstadt', text: 'Action verified: BeyondTrust vendor session terminated (2 approvers)' },
    { module: 'custody', kind: 'custody', tenant: 'connected', text: 'OTA 24.9.3 rolled to 412k vehicles, package lineage intact' },
    { module: 'strike', kind: 'test', tenant: 'connected', text: 'HexaStrike: vehicle API BOLA retest passed' },
    { module: 'fabric', kind: 'system', tenant: 'battery', text: 'Battery plant signed bundle imported via data diode (6 h cycle)' },
    { module: 'soc', kind: 'detect', tenant: 'retail', text: 'Defender XDR: OAuth consent phishing against dealer accounts blocked' },
  ],
  maritime: [
    { module: 'soc', kind: 'detect', tenant: 'rtm', text: 'HexaSOC triage agent closed 212 benign alerts on gate OCR lanes (known maintenance)' },
    { module: 'ot', kind: 'detect', tenant: 'ant', text: 'New asset discovered: Siemens S7-1500 on crane network VLAN 310' },
    { module: 'loop', kind: 'loop', tenant: 'hq', text: 'Loop closed: CTL-ACC-01 × T1621 (MFA fatigue), validated by HexaStrike' },
    { module: 'int', kind: 'intel', tenant: 'hq', text: 'HexaInt: new Volt Typhoon advisory mapped to 6 of your techniques' },
    { module: 'comply', kind: 'evidence', tenant: 'rtm', text: 'Evidence collected: firewall rule review, Panorama snapshot (A.8.20)' },
    { module: 'ops', kind: 'action', tenant: 'hq', text: 'Action verified: Sentinel rule "HV-T1133-VPN-impossible-travel" enabled' },
    { module: 'custody', kind: 'custody', tenant: 'fleet', text: 'ENC weekly update delivered to 19 of 22 vessels, hashes verified' },
    { module: 'strike', kind: 'test', tenant: 'pkl', text: 'HexaStrike purple test T1219 (remote access software): detection fired in 41 s' },
    { module: 'fabric', kind: 'system', tenant: 'fleet', text: 'Halcyon Borealis back in LEO coverage: 1,840 buffered events ingested' },
    { module: 'soc', kind: 'detect', tenant: 'hq', text: 'Defender XDR: suspicious inbox rule on finance shared mailbox, auto-contained' },
  ],
  finserv: [
    { module: 'soc', kind: 'detect', tenant: 'markets', text: 'HexaSOC closed 1,904 benign Zscaler alerts (market-data CDN change)' },
    { module: 'loop', kind: 'loop', tenant: 'ukbank', text: 'Loop closed: CTL-PAM-02 × T1558.003 (Kerberoasting), validated' },
    { module: 'comply', kind: 'evidence', tenant: 'pay', text: 'Evidence collected: PCI 10.4 daily log review attestation' },
    { module: 'int', kind: 'intel', tenant: 'ukbank', text: 'FS-ISAC flash: Scattered Spider help-desk campaign against UK banks' },
    { module: 'ops', kind: 'action', tenant: 'ukbank', text: 'Action verified: Okta sessions cleared for 1 user (2 approvers)' },
    { module: 'custody', kind: 'custody', tenant: 'ukbank', text: 'Q3 Board pack: 14 directors opened, 0 forwards, 0 prints' },
    { module: 'strike', kind: 'test', tenant: 'eu', text: 'TLPT scoping: TIBER-EU threat intelligence report received' },
    { module: 'fabric', kind: 'system', tenant: 'eu', text: 'EU data plane: key rotation completed (customer HSM)' },
    { module: 'soc', kind: 'detect', tenant: 'wealth', text: 'CrowdStrike: credential dumping attempt blocked on SG-RM-LT112' },
    { module: 'ot', kind: 'detect', tenant: 'ukbank', text: 'Slough DC1: UPS firmware change detected, matched approved change CHG0081422' },
  ],
  media: [
    { module: 'custody', kind: 'custody', tenant: 'post', text: 'Nightjar VFX plates batch 31 delivered to Lumière VFX, 214 GB at 3.1 Gbps' },
    { module: 'soc', kind: 'detect', tenant: 'play', text: 'Cloudflare: credential-stuffing wave on KestrelPlay login, bot score blocked 98%' },
    { module: 'loop', kind: 'loop', tenant: 'studios', text: 'Loop closed: CTL-WAT-08 × T1567.002 (exfil to cloud storage)' },
    { module: 'int', kind: 'intel', tenant: 'studios', text: 'HexaInt: Ember Run title mentioned on 2 Telegram leak channels' },
    { module: 'comply', kind: 'evidence', tenant: 'post', text: 'Evidence collected: content network firewall export (TPN NS-2.0)' },
    { module: 'ops', kind: 'action', tenant: 'post', text: 'Action verified: supplier session revoked, Red Fern review link' },
    { module: 'strike', kind: 'test', tenant: 'play', text: 'ASM: new subdomain staging-cdn.kestrelplay.com exposed, ticket raised' },
    { module: 'ot', kind: 'detect', tenant: 'live', text: 'Atlanta: PTP grandmaster failover to GM-02, timing within tolerance' },
    { module: 'ai', kind: 'detect', tenant: 'studios', text: 'HexaAI: 3 new users of Midjourney on corporate devices' },
    { module: 'fabric', kind: 'system', tenant: 'studios', text: 'Custody agents: 412 online, 3 updated to 1.3.0' },
  ],
};

ATTENTION.insurance = [
  { sev: 'critical', module: 'soc', title: 'Help-desk MFA reset then Okta session from residential proxy: Claims adjuster account', detail: 'Scattered Spider pattern; sessions cleared by approval 5 min after detection, ClaimCenter disbursement access under review', path: '/soc/ir', ageMin: 29, tenant: 'claims' },
  { sev: 'high', module: 'int', title: '61 agent and broker AgentHub credentials in fresh stealer logs', detail: 'Lumma and RedLine infections at 9 independent agencies; forced resets queued in Okta', path: '/int/exposure', ageMin: 110, tenant: 'personal' },
  { sev: 'high', module: 'strike', title: 'Critical: IDOR on agent portal quote API exposes applicant driver PII', detail: 'Found in pen test PT-2026-044; NYDFS 500.17 72-hour notice not triggered (no evidence of access)', path: '/strike/pentest', ageMin: 340, tenant: 'personal' },
  { sev: 'high', module: 'fabric', title: 'KEV on mft.kingsbridgemutual.com managed file transfer server', detail: 'Internet-facing, Cl0p mass-exploitation pattern; Cloudflare virtual patch applied, 4 days left in SLA', path: '/fabric/exposure', ageMin: 260, tenant: 'group' },
  { sev: 'medium', module: 'comply', title: 'NYDFS 500.17(b) certification of compliance due 15 April', detail: '21 evidence tasks overdue; CISO report to the Board scheduled for the December meeting', path: '/comply/caas', ageMin: 1440, tenant: 'group' },
  { sev: 'medium', module: 'comply', title: 'EXL offshore claims team: 380 users with standing VPN access', detail: 'Tier 1 BPO; move to Island browser before the NAIC #668 third-party review', path: '/comply/tprm', ageMin: 2880, tenant: 'claims' },
  { sev: 'medium', module: 'ops', title: '4 write-back actions awaiting approval', detail: 'Clear sessions (Okta), contain host (CrowdStrike), add WAF rule (Cloudflare), deploy rule (Sentinel)', path: '/ops/actions', ageMin: 42, tenant: 'group' },
  { sev: 'low', module: 'fabric', title: 'Guidewire Cloud connector degraded: field drift after Palisades', detail: 'Disbursement-change evidence for NAIC MAR going stale in 2 days', path: '/fabric/integrations', ageMin: 140, tenant: 'personal' },
];
ATTENTION.defence = [
  { sev: 'critical', module: 'soc', title: 'Living-off-the-land activity on SPD-PDM-VLT01 (Volt Typhoon pattern)', detail: 'Defender XDR flagged netsh portproxy and ntdsutil on the engineering PDM vault; HexaSOC isolated the host, DFARS 7012 72-hour DIBNet clock running', path: '/soc/ir', ageMin: 46, tenant: 'engineering' },
  { sev: 'high', module: 'ot', title: 'Unscheduled programme upload to Haas VF-4SS mill, Building 3 cell 4', detail: 'BeyondTrust vendor session approved for diagnostics only; Armis saw a DNC transfer outside the change window', path: '/ot/visibility', ageMin: 95, tenant: 'manufacturing' },
  { sev: 'high', module: 'int', title: 'Proposal engineer’s GCC High credentials in a Lumma stealer log', detail: 'Infected personal laptop; Entra sessions revoked, no enclave sign-in from the stealer IP (FIDO2 enforced)', path: '/int/exposure', ageMin: 130, tenant: 'programs' },
  { sev: 'high', module: 'custody', title: 'ITAR drawing package opened from a non-US IP by a sub-tier machine shop', detail: 'TDP-2207 at Cumberland Precision; HexaCustody revoked the key in 4 min, Empowered Official Carla Jennings assessing a voluntary disclosure', path: '/custody/revocation', ageMin: 70, tenant: 'programs' },
  { sev: 'medium', module: 'comply', title: 'C3PAO Level 2 assessment in 132 days', detail: 'SPRS 88/110; 6 POA&M items open, 2 not POA&M-eligible under 32 CFR 170.21', path: '/comply/caas', ageMin: 1440, tenant: 'programs' },
  { sev: 'medium', module: 'ai', title: 'ChatGPT used with export-controlled drawing notes by 4 engineers', detail: 'Zscaler GenAI logs; content not CUI-labelled at source, Purview auto-label rule drafted', path: '/ai/discovery', ageMin: 540, tenant: 'engineering' },
  { sev: 'medium', module: 'ops', title: '3 write-back actions awaiting approval', detail: 'Terminate vendor session (BeyondTrust), revoke sessions (Entra GCC High), block URL category (Zscaler)', path: '/ops/actions', ageMin: 35, tenant: 'programs' },
  { sev: 'low', module: 'fabric', title: 'Exostar connector degraded: federation certificate rotated', detail: 'Supplier CMMC attestations older than the freshness window for 2 controls', path: '/fabric/integrations', ageMin: 220, tenant: 'corporate' },
];
ATTENTION.pharma = [
  { sev: 'critical', module: 'soc', title: 'Help-desk MFA reset then Okta session from residential proxy: clinical data manager', detail: 'Scattered Spider pattern; Medidata Rave bulk export attempted, sessions revoked by approval', path: '/soc/ir', ageMin: 29, tenant: 'clinops' },
  { sev: 'high', module: 'ot', title: 'Unscheduled DeltaV configuration download to bioreactor train B', detail: 'Emerson service laptop via BeyondTrust outside the change window, Valais; QA deviation DEV-2026-0418 opened', path: '/ot/visibility', ageMin: 64, tenant: 'valais' },
  { sev: 'high', module: 'custody', title: 'Unblinded RHN-4471 interim dataset opened outside the firewalled team', detail: 'CRO sub-site download; watermark traced, HexaCustody revoked the partner session in 41 s', path: '/custody/revocation', ageMin: 88, tenant: 'clinops' },
  { sev: 'high', module: 'int', title: 'APT29-style phishing kit cloning sso.rhenara.com', detail: '19 lookalikes; rhenara-trials[.]com has live MX and targets Cambridge vaccine researchers', path: '/int/darkweb', ageMin: 150, tenant: 'rnd' },
  { sev: 'high', module: 'fabric', title: 'KEV: CVE-2025-0282 on the Ivanti Connect Secure gateway at Cork', detail: 'Internet-facing, exploited by China-nexus actors; 3 days left in SLA', path: '/fabric/exposure', ageMin: 280, tenant: 'cork' },
  { sev: 'medium', module: 'comply', title: 'Swissmedic GMP inspection at Valais in 4 months', detail: '29 evidence tasks overdue; Annex 11 audit-trail review evidence stale while LabWare drift persists', path: '/comply/caas', ageMin: 1440, tenant: 'valais' },
  { sev: 'medium', module: 'ai', title: 'ChatGPT used with trial subject data by 7 clinical operations staff', detail: 'Netskope DLP: CRF extracts pasted into prompts; EU AI Act and GDPR assessment opened', path: '/ai/discovery', ageMin: 480, tenant: 'clinops' },
  { sev: 'medium', module: 'ops', title: '5 write-back actions awaiting approval', detail: 'Terminate vendor session (BeyondTrust), clear sessions (Okta), contain host (CrowdStrike), block sender (Proofpoint), deploy rule (Sentinel)', path: '/ops/actions', ageMin: 42, tenant: 'corporate' },
];
ATTENTION.sghospital = [
  { sev: 'critical', module: 'soc', title: 'Service-desk MFA reset then Citrix login from a residential proxy: ICU nurse manager account', detail: 'Scattered Spider pattern via the NCS desk; sessions revoked by approval, TrakCare access reviewed, MOH 2-hour notification assessment open', path: '/soc/ir', ageMin: 34, tenant: 'obh' },
  { sev: 'high', module: 'ot', title: '860 legacy lab analysers and imaging workstations on a flat clinical VLAN', detail: 'Orchid Bay Diagnostics, Science Park; Windows 10 LTSC imaging consoles reachable from the vendor support subnet', path: '/ot/visibility', ageMin: 220, tenant: 'labimg' },
  { sev: 'high', module: 'int', title: 'Patient app credentials and 2 clinician logins in a Qilin-affiliate stealer log', detail: 'patient.orchidbay.com.sg session cookies included; forced resets queued for approval', path: '/int/exposure', ageMin: 105, tenant: 'specialist' },
  { sev: 'high', module: 'fabric', title: 'KEV: FortiOS SSL-VPN flaw on the Punggol day surgery gateway', detail: 'Internet-facing; UNC3886 has exploited Fortinet edge devices in Singapore; 2 days left in SLA', path: '/fabric/exposure', ageMin: 310, tenant: 'daysurg' },
  { sev: 'medium', module: 'comply', title: 'NEHR contribution mandatory in 11 months (1 Sept 2027)', detail: 'NEHR readiness at 58% documented; 9 interface and audit-logging tasks overdue before the Synapxe onboarding gate', path: '/comply/caas', ageMin: 1440, tenant: 'obh' },
  { sev: 'medium', module: 'ops', title: '4 write-back actions awaiting approval', detail: 'Contain host (CrowdStrike), revoke sessions (Entra), deploy rule (Sentinel), quarantine VLAN (Forescout)', path: '/ops/actions', ageMin: 42, tenant: 'obh' },
  { sev: 'medium', module: 'ai', title: 'ChatGPT used with patient NRICs by 7 clinicians', detail: 'Purview DSPM for AI flagged sensitive prompts; AIHGle and PDPA review opened by the DPO', path: '/ai/discovery', ageMin: 540, tenant: 'specialist' },
  { sev: 'low', module: 'fabric', title: 'TrakCare audit extract late after 2025.1 upgrade', detail: 'Record-access evidence stale for HIA CS/DS 7.1 and NEHR readiness', path: '/fabric/integrations', ageMin: 155, tenant: 'obh' },
];
ATTENTION.studio = [
  { sev: 'critical', module: 'custody', title: 'Crown of Ash FYC screener ripped and seeded on a torrent tracker', detail: 'NexGuard extraction traced to an Indee screener session issued to an awards voter; 41 sibling sessions revoked by approval', path: '/custody/revocation', ageMin: 34, tenant: 'studios' },
  { sev: 'high', module: 'soc', title: 'Okta help-desk reset then admin sign-in from residential proxy', detail: 'Starfall+ SRE account; Scattered Spider pattern, sessions cleared and CyberArk credentials rotated', path: '/soc/ir', ageMin: 58, tenant: 'play' },
  { sev: 'high', module: 'ot', title: 'Unscheduled logic download to ride control PLC, Orlando', detail: 'EtherNet/IP programme change on a water ride from the OEM jump host outside the change window; Claroty and Dragos agree', path: '/ot/visibility', ageMin: 96, tenant: 'parks' },
  { sev: 'high', module: 'int', title: 'ShinyHunters claims Starfall+ subscriber data on BreachForums mirror', detail: 'Sample of 2,000 records; HexaInt validating the sample; SEC 8-K 1.05 materiality clock not yet started', path: '/int/darkweb', ageMin: 210, tenant: 'play' },
  { sev: 'medium', module: 'custody', title: 'Bluebird Dubbing Studios: 3 untracked copies of Hollow Coast S3 stems', detail: 'Rating 55; Island browser not yet enforced for freelance voice directors', path: '/custody/vendors', ageMin: 480, tenant: 'post' },
  { sev: 'medium', module: 'ai', title: 'Voice cloning web app used on talent dialogue', detail: 'Unsanctioned; 5 users in Marketing uploaded Sophie Caldwell ADR, no likeness consent on file', path: '/ai/discovery', ageMin: 720, tenant: 'corp' },
  { sev: 'medium', module: 'comply', title: 'TPN+ re-assessment for London VFX in 38 days', detail: '29 tasks overdue; vendor attestations missing for 7 tier-1 VFX and localisation vendors', path: '/comply/caas', ageMin: 2160, tenant: 'post' },
  { sev: 'low', module: 'fabric', title: 'Irdeto connector failing (401) after tenant migration', detail: 'Piracy notices for Starfall+ not ingested since Friday; vendor ticket open', path: '/fabric/integrations', ageMin: 610, tenant: 'play' },
];
FEED.insurance = [
  { module: 'soc', kind: 'detect', tenant: 'personal', text: 'HexaSOC closed 1,120 benign Cloudflare bot alerts (comparative-rater quote traffic)' },
  { module: 'loop', kind: 'loop', tenant: 'group', text: 'Loop closed: CTL-HD-02 × T1621 (MFA fatigue), validated by HexaStrike' },
  { module: 'comply', kind: 'evidence', tenant: 'personal', text: 'Evidence collected: PCI 11.6.1 payment-page change detection report (pay.kingsbridgemutual.com)' },
  { module: 'int', kind: 'intel', tenant: 'group', text: 'FS-ISAC insurance advisory: Scattered Spider help-desk social engineering against US insurers' },
  { module: 'ops', kind: 'action', tenant: 'claims', text: 'Action verified: Okta sessions cleared for 1 claims adjuster (2 approvers)' },
  { module: 'custody', kind: 'custody', tenant: 'group', text: '2027 treaty renewal pack shared with Munich Re: 6 opened, 0 forwards, 0 downloads' },
  { module: 'strike', kind: 'test', tenant: 'claims', text: 'HexaStrike purple test T1219 (remote access tool via BPO desktop): Vectra detection fired in 47 s' },
  { module: 'fabric', kind: 'system', tenant: 'specialty', text: 'Specialty data plane: 1.9.2 upgrade scheduled for Sunday 02:00 MST' },
  { module: 'soc', kind: 'detect', tenant: 'commercial', text: 'Abnormal: vendor email compromise against premium-finance partner blocked, bank-change request held' },
  { module: 'ot', kind: 'detect', tenant: 'group', text: 'Windsor DC1: UPS firmware change detected, matched approved change CHG0047719' },
  { module: 'ai', kind: 'detect', tenant: 'claims', text: 'Lakera Guard blocked 14 prompt-injection attempts in uploaded claim documents' },
];
FEED.defence = [
  { module: 'soc', kind: 'detect', tenant: 'programs', text: 'HexaSOC closed 214 benign Sentinel alerts (GCC High Conditional Access policy rollout)' },
  { module: 'ot', kind: 'detect', tenant: 'manufacturing', text: 'Armis: new Zeiss CMM workstation on Building 3 VLAN 40, matched change CHG0031877' },
  { module: 'loop', kind: 'loop', tenant: 'programs', text: 'Loop closed: CTL-CUI-01 × T1567.002, Purview CUI exfiltration rule validated by HexaStrike' },
  { module: 'int', kind: 'intel', tenant: 'engineering', text: 'DC3 DCISE: APT40 spear-phishing against avionics suppliers mapped to 5 of your techniques' },
  { module: 'comply', kind: 'evidence', tenant: 'programs', text: 'Evidence collected: FIPS 140-3 validation for enclave BitLocker (CMMC SC.L2-3.13.11)' },
  { module: 'ops', kind: 'action', tenant: 'manufacturing', text: 'Action verified: BeyondTrust vendor session terminated (2 approvers)' },
  { module: 'custody', kind: 'custody', tenant: 'programs', text: 'TDP-2207 rev F delivered to Lockheed Martin via PreVeil, hashes verified' },
  { module: 'strike', kind: 'test', tenant: 'programs', text: 'HexaStrike purple test T1621 (MFA fatigue) against GCC High: blocked by FIDO2 policy' },
  { module: 'fabric', kind: 'system', tenant: 'tucson', text: 'Tucson edge agent lagging: range WAN saturated by telemetry, buffering locally' },
  { module: 'loop', kind: 'loop', tenant: 'engineering', text: 'Loop partial: CTL-ITAR-10 × T1213, Teamcenter export detection staged in Sentinel' },
];
FEED.pharma = [
  { module: 'soc', kind: 'detect', tenant: 'corporate', text: 'HexaSOC closed 2,840 benign Sentinel alerts (SAP month-end batch window)' },
  { module: 'ot', kind: 'detect', tenant: 'valais', text: 'Claroty xDome: new chromatography skid controller on Valais downstream VLAN, matched change CHG0218834' },
  { module: 'loop', kind: 'loop', tenant: 'clinops', text: 'Loop closed: CTL-UNB-08 × T1213, unblinding-list access alert validated in Rave' },
  { module: 'int', kind: 'intel', tenant: 'rnd', text: 'Health-ISAC flash: APT41 targeting biologics process IP at European CDMOs' },
  { module: 'comply', kind: 'evidence', tenant: 'valais', text: 'Evidence collected: PAS-X e-signature audit-trail review (Part 11 11.10(e))' },
  { module: 'ops', kind: 'action', tenant: 'cork', text: 'Action verified: BeyondTrust Siemens session to filling line 3 terminated (2 approvers)' },
  { module: 'custody', kind: 'custody', tenant: 'corporate', text: 'eCTD sequence 0042 delivered to FDA ESG, hashes verified end to end' },
  { module: 'strike', kind: 'test', tenant: 'commercial', text: 'HexaStrike retest passed: IDOR on connect.rhenara.com patient-enrolment API fixed' },
  { module: 'fabric', kind: 'system', tenant: 'valais', text: 'Aseptic line AF-2 signed bundle imported via data diode (8 h cycle)' },
  { module: 'ai', kind: 'detect', tenant: 'rnd', text: 'Protect AI: unsafe pickle in a downloaded protein-folding checkpoint blocked before use' },
];
FEED.sghospital = [
  { module: 'soc', kind: 'detect', tenant: 'obh', text: 'HexaSOC closed 480 benign Imprivata badge-tap alerts (ward shift change)' },
  { module: 'ot', kind: 'detect', tenant: 'obh', text: 'Claroty xDome: new Philips IntelliVue monitor joined the ICU VLAN, matched work order' },
  { module: 'loop', kind: 'loop', tenant: 'obh', text: 'Loop closed: CTL-BKP-06 × T1490, TrakCare downtime restore validated' },
  { module: 'int', kind: 'intel', tenant: 'obh', text: 'SingCERT advisory: UNC3886 targeting Fortinet and VMware edge devices in Singapore CII' },
  { module: 'comply', kind: 'evidence', tenant: 'corp', text: 'Evidence collected: Cyber Essentials backup and update attestation (renewal pack)' },
  { module: 'ops', kind: 'action', tenant: 'obh', text: 'Action verified: Sentinel rule "HV-T1621-MFA-fatigue" enabled' },
  { module: 'custody', kind: 'custody', tenant: 'labimg', text: 'Imaging studies for overseas second opinion shared, hashes verified, access expires in 7 days' },
  { module: 'strike', kind: 'test', tenant: 'daysurg', text: 'HexaStrike purple test T1133 (FortiGate SSL-VPN): detection fired in 48 s' },
  { module: 'fabric', kind: 'system', tenant: 'labimg', text: 'Science Park uplink recovered: 1,140 buffered device events ingested' },
  { module: 'loop', kind: 'loop', tenant: 'specialist', text: 'Loop partial: CTL-OT-14 × T0836, pump drug-library change detection awaiting validation' },
];
FEED.studio = [
  { module: 'custody', kind: 'custody', tenant: 'post', text: 'Lodestar VFX plates batch 58 delivered to ILM via Signiant Jet, 1.8 TB at 9.4 Gbps' },
  { module: 'soc', kind: 'detect', tenant: 'play', text: 'Akamai: credential-stuffing wave on login.starfallplus.com, 2.1M attempts, 99% blocked' },
  { module: 'loop', kind: 'loop', tenant: 'studios', text: 'Loop closed: CTL-WAT-07 × T1567.002 (exfil to cloud storage)' },
  { module: 'int', kind: 'intel', tenant: 'studios', text: 'HexaInt: Lodestar teaser frames discussed on 3 Telegram leak channels' },
  { module: 'ot', kind: 'detect', tenant: 'parksasia', text: 'Osaka: show control system baseline deviation, matched approved change CHG0219843' },
  { module: 'comply', kind: 'evidence', tenant: 'parks', text: 'Evidence collected: PCI DSS 11.6.1 payment-page change detection for tickets.starfallresorts.com' },
  { module: 'ops', kind: 'action', tenant: 'studios', text: 'Action verified: 42 Indee screener sessions revoked, Crown of Ash FYC' },
  { module: 'strike', kind: 'test', tenant: 'play', text: 'ASM: new subdomain uat-billing.starfallplus.com exposed, ticket raised in ServiceNow' },
  { module: 'ai', kind: 'detect', tenant: 'corp', text: 'HexaAI: Lakera blocked prompt injection against the Starfall+ support assistant' },
  { module: 'loop', kind: 'loop', tenant: 'parks', text: 'Loop partial: CTL-OT-13 × T0886 (remote services), detection staged in Splunk ES' },
  { module: 'fabric', kind: 'system', tenant: 'studios', text: 'Custody agents: 2,860 online, 24 updated to 1.3.0' },
];

export function attention(c: CustomerProfile, tenantId = 'all'): AttentionItem[] {
  const items = forCustomer(ATTENTION, c) ?? [];
  const scoped = tenantId === 'all' ? items : items.filter((i) => i.tenant === tenantId);
  // Live critical-vulnerability response item (HexaInt), counts agree with /int/vulnresponse.
  const v = vrHeadline(c, tenantId);
  if (!v.affected) return scoped;
  const vuln: AttentionItem = {
    sev: 'critical', module: 'int',
    title: `Critical vulnerability ${v.adv.cve}: ${v.affected} assets affected, ${v.patched} patched`,
    detail: `${v.adv.product} · CVSS ${v.adv.cvss.toFixed(1)}${v.adv.exploited ? ' · exploited in the wild' : ''} · ${v.open} still exposed${v.internetOpen ? `, ${v.internetOpen} internet-facing` : ''}`,
    path: '/int/vulnresponse', ageMin: v.adv.publishedMinAgo, tenant: tenantId === 'all' ? v.tenant : tenantId,
  };
  return [vuln, ...scoped];
}
export function feed(c: CustomerProfile, tenantId = 'all'): FeedEvent[] {
  const items = forCustomer(FEED, c);
  return tenantId === 'all' ? items : items.filter((i) => i.tenant === tenantId);
}
