import type { CustomerId, CustomerProfile, Severity } from './types';

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

const ATTENTION: Record<CustomerId, AttentionItem[]> = {
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

const FEED: Record<CustomerId, FeedEvent[]> = {
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

export function attention(c: CustomerProfile, tenantId = 'all'): AttentionItem[] {
  const items = ATTENTION[c.id];
  return tenantId === 'all' ? items : items.filter((i) => i.tenant === tenantId);
}
export function feed(c: CustomerProfile, tenantId = 'all'): FeedEvent[] {
  const items = FEED[c.id];
  return tenantId === 'all' ? items : items.filter((i) => i.tenant === tenantId);
}
