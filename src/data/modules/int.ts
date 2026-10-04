// HexaInt (Cyber Intelligence) data: dark web, OSINT / threat intel and
// credential & executive exposure. Pure, seeded per customer and tenant.
// All content is fictional demo data; snippets are redacted summaries only.
import type { CustomerProfile, Severity, Connector } from '../types';
import { rng } from '../../lib/rng';
import { headlines } from '../core';
import { scopedTenants } from '../customers';
import type { TimeRange } from '../../state/AppContext';
import { dayLabels, hourLabels, fmtDateShort, daysAgo } from '../../lib/format';
import { forCustomer, type CustomerMap } from '../customerMap';

/* ---------------- shared helpers ---------------- */

/** Chart buckets for the selected time range (hourly, daily or weekly). */
export function buckets(t: TimeRange): { labels: string[]; days: number; unit: string } {
  if (t === '24h') return { labels: hourLabels(24), days: 1 / 24, unit: 'hour' };
  if (t === '7d') return { labels: dayLabels(7), days: 1, unit: 'day' };
  if (t === '30d') return { labels: dayLabels(30), days: 1, unit: 'day' };
  const labels: string[] = [];
  for (let i = 12; i >= 0; i--) labels.push(fmtDateShort(daysAgo(i * 7)));
  return { labels, days: 7, unit: 'week' };
}

export function defang(d: string): string {
  return d.replace(/\.(?=[^.]+$)/, '[.]');
}

export function connectorOf(c: CustomerProfile, cat: Connector['category'], tenantId = 'all'): Connector | undefined {
  const ks = c.connectors.filter((k) => k.category === cat && (tenantId === 'all' || k.tenants === 'all' || k.tenants.includes(tenantId)));
  return ks[0];
}
export function edrOf(c: CustomerProfile): Connector | undefined {
  return connectorOf(c, 'EDR / XDR');
}
export function siemOf(c: CustomerProfile): Connector | undefined {
  return connectorOf(c, 'SIEM');
}
/** Primary workforce identity provider (Okta where present, else Entra ID). */
export function idpOf(c: CustomerProfile): Connector | undefined {
  return (
    c.connectors.find((k) => k.category === 'Identity' && k.vendor === 'Okta') ??
    c.connectors.find((k) => k.category === 'Identity' && k.product === 'Entra ID') ??
    c.connectors.find((k) => k.category === 'Identity')
  );
}
export function taxiiOf(c: CustomerProfile): Connector | undefined {
  return c.connectors.find((k) => k.category === 'Intelligence' && k.vendor === 'Generic');
}

/* =====================================================================
   Dark web monitoring
   ===================================================================== */
export const DW_SOURCES = ['Markets', 'Forums', 'Ransomware leak sites', 'Telegram', 'Paste sites'] as const;
export type DwSource = (typeof DW_SOURCES)[number];
export const DW_SOURCE_COLOR: Record<DwSource, string> = {
  Markets: '#ef6aae',
  Forums: '#a07cfb',
  'Ransomware leak sites': '#f8646f',
  Telegram: '#68b1ff',
  'Paste sites': '#ecc873',
};

export interface Mention {
  id: string;
  source: DwSource;
  venue: string;
  sev: Severity;
  category: string;
  title: string;
  snippet: string;
  actor: string;
  asset: string;
  action: string;
  minutesAgo: number;
  tenantId: string;
  status: 'New' | 'Triaging' | 'Actioned' | 'Monitoring';
  confidence: number;
  /** Original-style feed grouping: does it name you, a supplier, or just your sector? */
  scope: MentionScope;
}
export const MENTION_SCOPES = ['Direct mention', 'Supply chain', 'Sector'] as const;
export type MentionScope = (typeof MENTION_SCOPES)[number];
export const SCOPE_COLOR: Record<MentionScope, string> = { 'Direct mention': '#f8646f', 'Supply chain': '#f5a83d', Sector: '#8a9bc0' };

type MT = Omit<Mention, 'id' | 'minutesAgo' | 'tenantId' | 'status' | 'confidence' | 'scope'> & { tenant?: string; scope?: MentionScope };

function scopeOf(t: MT): MentionScope {
  if (t.scope) return t.scope;
  if (/peer|third|vendor|supplier/i.test(`${t.category} ${t.asset}`)) return 'Supply chain';
  if (/Targeting|Insider|OT intelligence/i.test(t.category)) return 'Sector';
  return 'Direct mention';
}

function mentionTemplates(c: CustomerProfile): MT[] {
  const ci = c.vocab.custodyItems;
  const map: CustomerMap<MT[]> = {
    maritime: [
      { source: 'Forums', venue: 'Access-broker forum (RU)', sev: 'critical', category: 'Network access for sale', title: 'Broker advertising remote access to an unnamed EU container terminal operator', snippet: 'Post offers "VPN + domain foothold" at a large European ports group matching Halcyon by revenue band and terminal footprint. Specifics redacted by HexaInt analyst.', actor: 'Initial-access broker (forum rep ~40)', asset: 'vpn.halcyonports.com', action: 'Force VPN MFA re-registration, hunt for the referenced access, rotate OT jump-host credentials in CyberArk.', tenant: 'hq' },
      { source: 'Telegram', venue: 'Hacktivist channel', sev: 'high', category: 'Targeting / threat', title: 'Channel names Halcyon terminals in a port-disruption "call to action"', snippet: 'Hacktivist channel lists several European ports, including Halcyon sites, as desirable targets. No capability demonstrated; posture only.', actor: 'Pro-state hacktivist collective', asset: 'Maasvlakte, Antwerp terminals', action: 'Raise monitoring on internet-facing terminal assets; brief terminal SOCs.', tenant: 'rtm' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', title: 'Rival terminal operator posted as a victim on a ransomware leak site', snippet: 'A sector peer appears on a leak-site countdown. Halcyon not named; shared supplier overlap noted (Navis TOS).', actor: 'LockBit 3.0 affiliate', asset: 'Supply-chain overlap: Navis N4 TOS', action: 'Confirm TOS patch level; review shared-vendor remote access.', tenant: 'hq' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'high', category: 'Credentials for sale', title: 'Crew VSAT portal logins listed in a fresh stealer-log batch', snippet: `Batch includes ${c.vocab.hostPrefix} crew-portal sessions captured from an infected personal device. Values held in evidence, not shown.`, actor: 'Stealer-log vendor', asset: 'crew.halcyonports.com', action: 'Reset affected crew accounts, revoke VSAT portal sessions.', tenant: 'fleet' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Config / data leak', title: 'Pasted config fragment references a Halcyon internal hostname', snippet: 'A paste contains an internal host naming pattern and an expired API token. Token already rotated.', actor: 'Unattributed', asset: 'api.halcyonports.com', action: 'Confirm token revoked; scan repos for similar leakage.', tenant: 'hq' },
      { source: 'Forums', venue: 'OT-focused forum', sev: 'medium', category: 'OT intelligence', title: 'Discussion of crane-vendor remote-access tooling, Halcyon vendor named', snippet: `Thread discusses ${ci[3] ?? 'crane PLC programmes'} and a named crane OEM's remote tooling. Informational.`, actor: 'OT enthusiasts / researchers', asset: 'STS crane control network', action: 'Verify vendor access is brokered via PAM jump host (CTL-OT-02).', tenant: 'rtm' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', title: 'Fake "Halcyon logistics invoice" lure shared in a fraud channel', snippet: 'A phishing kit impersonating Halcyon billing is circulating. Lookalike domain tracked separately.', actor: 'BEC crew', asset: 'Billing & invoicing', action: 'Push lure indicators to Proofpoint; request domain takedown.', tenant: 'hq' },
    ],
    finserv: [
      { source: 'Forums', venue: 'Access-broker forum', sev: 'critical', category: 'Network access for sale', title: 'Broker advertising access to an unnamed UK banking group', snippet: 'Listing describes "internal access, finance vertical, UK" matching Aldersgate by size band. Analyst assesses medium-high relevance; specifics redacted.', actor: 'Initial-access broker', asset: 'vpn.aldersgate.co.uk', action: 'Hunt for the described access, force privileged MFA re-enrolment, brief fraud teams.', tenant: 'ukbank' },
      { source: 'Markets', venue: 'Card-shop / BIN marketplace', sev: 'high', category: 'Card data for sale', title: 'Card-shop listing references BINs issued by Aldersgate Payments', snippet: 'A card shop advertises a batch tagged with BIN ranges that include Aldersgate-issued cards. No confirmed CDE compromise; likely third-party skimming.', actor: 'Carding marketplace vendor', asset: 'Card authorisation switch · BINs 4xxxxx', action: 'Alert fraud ops to flag affected BIN ranges; review merchant skimming telemetry.', tenant: 'pay' },
      { source: 'Forums', venue: 'Fraud forum', sev: 'high', category: 'Fraud kit', title: 'Phishing / OTP-relay kit templated for Aldersgate online banking', snippet: 'A fraud kit sold on a forum includes a cloned Aldersgate login and an OTP-relay flow. Lookalike domain tracked in the domains card.', actor: 'Phishing-kit developer', asset: 'online.aldersgate.co.uk', action: 'Request takedown of the cloned page; push indicators to Proofpoint and Zscaler.', tenant: 'ukbank' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', title: 'A peer bank supplier posted on a ransomware leak site', snippet: 'A shared BPO/outsourcer appears as a victim. Aldersgate uses the same provider for back-office; exposure under assessment.', actor: 'ALPHV/BlackCat affiliate', asset: 'Third party: Infosys BPM', action: 'Engage vendor; review time-bound third-party access (DORA Art. 28).', tenant: 'eu' },
      { source: 'Telegram', venue: 'Extortion channel', sev: 'medium', category: 'Targeting / threat', title: 'Scattered-Spider-style help-desk social-engineering chatter names UK banks', snippet: 'Channel discusses help-desk reset social engineering against UK financial institutions generally. No Aldersgate-specific capability.', actor: 'Scattered Spider-aligned', asset: 'Service desk · Okta', action: 'Harden help-desk verification; alert on admin resets from new ASNs.', tenant: 'ukbank' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Data leak', title: 'Pasted sample claims to contain Aldersgate customer emails', snippet: 'A small sample is posted as "proof". HexaInt assesses it as recycled from an unrelated prior breach, not a fresh Aldersgate incident.', actor: 'Unattributed', asset: 'Customer data warehouse', action: 'Confirm provenance; prepare holding statement if escalated.', tenant: 'ukbank' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'medium', category: 'Credentials for sale', title: 'Corporate SSO sessions for Aldersgate staff in a stealer-log batch', snippet: 'Batch includes Okta session artefacts from infected devices. Counts summarised in the Exposure tab.', actor: 'Stealer-log vendor', asset: 'Okta · corporate SSO', action: 'Force reset and revoke sessions for matched identities.', tenant: 'ukbank' },
    ],
    media: [
      { source: 'Ransomware leak sites', venue: 'Leak forum ("pre-release" board)', sev: 'critical', category: 'Content leak', title: `Stills attributed to "${ci[1] ?? 'an unreleased title'}" offered on a leak forum`, snippet: `Low-resolution stills tagged with a Kestrel title are offered for sale. Forensic watermark traced to a named vendor review session.`, actor: 'Pre-release content broker', asset: ci[1] ?? 'Pre-release master', action: 'Revoke the implicated supplier review link; begin takedown and legal referral.', tenant: 'studios' },
      { source: 'Telegram', venue: 'Piracy / leak channel', sev: 'high', category: 'Title targeting', title: `"${(c.vocab.custodyItems[2] ?? 'A trailer')}" named in leak channels ahead of release`, snippet: 'Two channels mention an embargoed Kestrel title and solicit insiders. No asset confirmed leaked yet.', actor: 'Piracy release group', asset: c.vocab.custodyItems[2] ?? 'Embargoed trailer', action: 'Raise custody monitoring on the title; brief marketing and talent handlers.', tenant: 'studios' },
      { source: 'Forums', venue: 'Insider-recruitment thread', sev: 'high', category: 'Insider solicitation', title: 'Thread soliciting studio insiders for pre-release content', snippet: 'A forum post seeks employees or freelancers at major studios willing to exfiltrate pre-release material. Kestrel named among examples.', actor: 'Extortion / brokerage crew', asset: 'Pre-release masters (S3 vault)', action: 'Reinforce custody controls on high-value titles; awareness nudge to post teams.', tenant: 'post' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', title: 'A post-production vendor posted as a ransomware victim', snippet: 'A VFX/post vendor used across the sector appears on a leak site. Kestrel shares a tier-1 vendor of similar profile.', actor: 'Akira affiliate', asset: 'Vendor chain', action: 'Confirm which titles the vendor holds; pre-emptively review access.', tenant: 'post' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'medium', category: 'Credentials for sale', title: 'KestrelPlay and Okta logins in a stealer-log batch', snippet: 'Batch includes streaming-platform admin and corporate SSO artefacts from infected devices. Counts in the Exposure tab.', actor: 'Stealer-log vendor', asset: 'Okta · KestrelPlay admin', action: 'Force reset and revoke sessions for matched identities.', tenant: 'studios' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Data leak', title: 'Pasted snippet references a Kestrel review-platform URL and token', snippet: 'A paste includes a dailies review URL and an expired token. Token invalidated; URL rotated.', actor: 'Unattributed', asset: 'review.kestrelpictures.com', action: 'Confirm rotation; scan for similar exposed links.', tenant: 'studios' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', title: 'Fake "KestrelPlay subscription refund" scam shared in a fraud channel', snippet: 'A phishing lure impersonating KestrelPlay billing is circulating. Lookalike domain tracked separately.', actor: 'Consumer-fraud crew', asset: 'Subscriber billing', action: 'Request takedown; warn subscribers via trust-and-safety.', tenant: 'play' },
    ],
    healthcare: [
      { source: 'Forums', venue: 'Access-broker forum', sev: 'critical', category: 'Network access for sale', scope: 'Direct mention', title: 'Broker advertising Citrix access to a Midwest multi-hospital system', snippet: 'Listing describes remote access to a "multi-hospital system, Midwest, Epic shop" matching Mercy Ridge by bed count and region. Specifics redacted by the HexaInt analyst.', actor: 'Initial-access broker', asset: 'citrix.mercyridgehealth.org', action: 'Force MFA re-registration on Citrix StoreFront, hunt for the described access with CrowdStrike, rotate service accounts in CyberArk.', tenant: 'mrmc' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'high', category: 'Credentials for sale', scope: 'Direct mention', title: 'MyChart proxy and staff Citrix sessions in a fresh stealer-log batch', snippet: 'Batch includes patient-portal proxy sessions and staff Citrix cookies captured from infected home devices. Values held in evidence, not shown.', actor: 'Stealer-log vendor', asset: 'mychart.mercyridgehealth.org', action: 'Revoke sessions in Entra ID, force reset for matched staff, invalidate portal proxy sessions.', tenant: 'clinics' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', scope: 'Sector', title: 'Neighbouring health system posted on a ransomware leak site', snippet: 'A regional health system appears on a leak-site countdown with claimed patient data. Mercy Ridge is not named; a shared reference-lab interface is noted.', actor: 'Rhysida', asset: 'Supply-chain overlap: Synapse Pathology Labs (HL7)', action: 'Confirm HL7 interface credentials are unique; review the lab VPN tunnel and segmentation.', tenant: 'mrmc' },
      { source: 'Telegram', venue: 'Data-broker channel', sev: 'high', category: 'Data leak', scope: 'Supply chain', title: 'Seller claims a clinic appointment list referencing Mercy Ridge', snippet: 'A small redacted sample claims appointment data from Mercy Ridge clinics. HexaInt assesses it as scraped from a third-party scheduling widget, not the EHR.', actor: 'Data broker (low reputation)', asset: 'TeleMed Partners scheduling API', action: 'Engage TeleMed Partners under the BAA; prepare a HIPAA breach risk assessment if confirmed.', tenant: 'clinics' },
      { source: 'Forums', venue: 'Insider-recruitment thread', sev: 'medium', category: 'Insider solicitation', scope: 'Sector', title: 'Thread recruiting hospital service-desk staff for MFA resets', snippet: 'A post offers payment to US hospital service-desk staff for MFA resets on request, the social-engineering pattern behind recent health-sector intrusions. Mercy Ridge is not named.', actor: 'Scattered Spider-aligned', asset: 'Service desk · Entra ID', action: 'Enforce call-back verification for MFA resets; alert on resets from new ASNs.', tenant: 'mrmc' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Config / data leak', scope: 'Direct mention', title: 'Pasted interface-engine template references a Mercy Ridge hostname', snippet: 'A paste contains an HL7 interface connection template with an internal host naming pattern. The credentials in it were already rotated.', actor: 'Unattributed', asset: 'MRH-EPIC-CLAR02', action: 'Confirm rotation; scan public repositories for similar interface templates.', tenant: 'mrmc' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', scope: 'Direct mention', title: 'Fake "Mercy Ridge billing" text-message lure circulating', snippet: 'An SMS lure impersonating patient billing links to a lookalike payment page. The lookalike domain is tracked separately.', actor: 'Consumer-fraud crew', asset: 'pay.mercyridgehealth.org', action: 'Request takedown; warn patients through a MyChart banner.', tenant: 'clinics' },
    ],
    automotive: [
      { source: 'Forums', venue: 'Access-broker forum', sev: 'critical', category: 'Network access for sale', scope: 'Direct mention', title: 'Broker advertising VPN access to a German automotive group', snippet: 'Listing offers "VPN + engineering share access" at a German automotive group of Vireo\'s size band, matched to a supplier-portal account pattern. Specifics redacted.', actor: 'Initial-access broker', asset: 'supplier.vireo-motors.com', action: 'Force MFA re-enrolment for supplier-portal accounts, hunt in QRadar, review BeyondTrust vendor sessions.', tenant: 'group' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'critical', category: 'Credentials for sale', scope: 'Supply chain', title: 'OTA release-portal session from a Tier 1 supplier engineer in a stealer log', snippet: 'A supplier engineer\'s infected laptop leaked sessions for the OTA release portal and the PLM supplier gateway. Values held in evidence, not shown.', actor: 'Stealer-log vendor', asset: 'ota.vireoconnect.com', action: 'Revoke the supplier sessions, rotate OTA portal credentials and confirm no signing-HSM operator access (R156 7.1.1).', tenant: 'connected' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', scope: 'Supply chain', title: 'Dealer-management SaaS provider listed on a leak site', snippet: 'A dealer-software vendor of the type behind the 2024 sector-wide dealer outage appears on a leak-site board. Vireo dealers run DealerCore DMS; overlap under assessment.', actor: 'BlackSuit (dealer SaaS attacks)', asset: 'Third party: DealerCore DMS', action: 'Engage DealerCore; prepare the dealer manual-sales fallback; restrict DMS API keys.', tenant: 'retail' },
      { source: 'Forums', venue: 'Tuning / research forum', sev: 'high', category: 'Vehicle API abuse', scope: 'Direct mention', title: 'Thread sharing an unofficial client for the Vireo Connect API', snippet: 'Users discuss reverse-engineering the Vireo Connect app API to unlock remote functions. No exploit is shared; token-binding and rate-limit questions are raised.', actor: 'Tuning / research community', asset: 'api.vireoconnect.com', action: 'Brief the vehicle SOC; verify token binding and rate limits; add API-abuse detections.', tenant: 'connected' },
      { source: 'Telegram', venue: 'Hacktivist channel', sev: 'medium', category: 'Targeting / threat', scope: 'Sector', title: 'Hacktivist channel names European car plants in a call to action', snippet: 'Channel lists several European automotive plants, including Ingolstadt, as targets. No capability demonstrated; posture only.', actor: 'Hacktivist collective', asset: 'Ingolstadt and Győr plants', action: 'Raise DDoS readiness for public sites; brief plant OT security.', tenant: 'ingolstadt' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Data leak', scope: 'Supply chain', title: 'Pasted CAD export metadata references a Vireo pre-launch project', snippet: 'A paste lists file names from a PLM export for "Project Lumen". No geometry is included; traced to an external design-agency share.', actor: 'Unattributed', asset: 'AutoVision Design Studio share', action: 'Revoke the agency share in HexaCustody; review TISAX prototype-protection controls.', tenant: 'group' },
      { source: 'Markets', venue: 'Fraud marketplace', sev: 'low', category: 'Brand abuse', scope: 'Direct mention', title: 'Discounted "Vireo Connect" feature-unlock subscriptions resold', snippet: 'Listings sell cheap feature-unlock subscriptions, assessed as fraud with stolen payment cards rather than a platform compromise.', actor: 'Fraud resellers', asset: 'shop.vireo-motors.com', action: 'Notify the e-commerce fraud team; request marketplace takedown.', tenant: 'retail' },
    ],
    insurance: [
      { source: 'Forums', venue: 'Access-broker forum', sev: 'critical', category: 'Network access for sale', scope: 'Direct mention', title: 'Broker selling VPN access to a "top-30 US mutual P&C carrier"', snippet: 'Listing offers VPN access plus a claims-adjuster account at a Northeast mutual insurer matching Kingsbridge by premium band. Analyst assesses high relevance; specifics redacted.', actor: 'Initial-access broker (forum rep ~60)', asset: 'vpn.kingsbridgemutual.com', action: 'Force MFA re-registration on the VPN, hunt for the described access in Splunk ES and CrowdStrike, review claims-adjuster sign-ins.', tenant: 'claims' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'high', category: 'Credentials for sale', scope: 'Supply chain', title: 'Independent-agent AgentHub sessions in a fresh stealer-log batch', snippet: 'Three independent agency workstations leaked saved logins and session cookies for the Kingsbridge AgentHub quote-and-bind portal. Values held in evidence, not shown.', actor: 'Stealer-log vendor', asset: 'agents.kingsbridgemutual.com', action: 'Revoke the agency sessions in Okta, force reset, and require device posture for AgentHub bind authority.', tenant: 'commercial' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', scope: 'Sector', title: 'Regional P&C carrier posted on a leak site with claimed policyholder data', snippet: 'A Midwest insurer appears on a countdown with a sample of claim files. Kingsbridge is not named; a shared claims-estimating platform is noted.', actor: 'Black Basta', asset: 'Supply-chain overlap: CCC Intelligent Solutions', action: 'Confirm CCC integration keys are unique to Kingsbridge; review claims-file export volumes.', tenant: 'claims' },
      { source: 'Telegram', venue: 'BEC crew channel', sev: 'high', category: 'Fraud kit', scope: 'Direct mention', title: 'Claims-payment redirection template naming Kingsbridge adjusters', snippet: 'A BEC crew shares a template that asks body shops and contractors to "update remittance details" for Kingsbridge claim payments. No mailbox compromise evidenced.', actor: 'BEC crew (West Africa-based)', asset: 'Claims payments (One Inc disbursements)', action: 'Push lure indicators to Abnormal and Proofpoint; enforce call-back on payee bank changes in ClaimCenter.', tenant: 'claims' },
      { source: 'Forums', venue: 'Fraud forum', sev: 'medium', category: 'Credential stuffing', scope: 'Direct mention', title: 'Credential-stuffing config targeting the policyholder portal', snippet: 'A shared config for a stuffing tool targets my.kingsbridgemutual.com login and MFA-enrolment endpoints. Cloudflare Bot Management is blocking the current pattern.', actor: 'Account-takeover crew', asset: 'my.kingsbridgemutual.com', action: 'Tighten Cloudflare bot rules on the login route; alert Auth0 on impossible-travel enrolments.', tenant: 'personal' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Config / data leak', scope: 'Direct mention', title: 'Pasted MFT job script references a Kingsbridge transfer host', snippet: 'A paste includes a scheduled-transfer script naming mft.kingsbridgemutual.com and a reinsurance bordereau path. The embedded key was already rotated.', actor: 'Unattributed', asset: 'KMI-MFT-01', action: 'Confirm key rotation; scan public repositories for Kingsbridge transfer scripts.', tenant: 'group' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', scope: 'Direct mention', title: 'Fake "Kingsbridge premium refund" text lure circulating', snippet: 'An SMS lure promises a premium refund and links to a lookalike payment page. The lookalike domain is tracked separately.', actor: 'Consumer-fraud crew', asset: 'pay.kingsbridgemutual.com', action: 'Request takedown; post a policyholder warning on the portal.', tenant: 'personal' },
    ],
    defence: [
      { source: 'Forums', venue: 'Access-broker forum', sev: 'critical', category: 'Network access for sale', scope: 'Direct mention', title: 'Broker advertising access to an "Alabama defence subcontractor"', snippet: 'Listing offers a supplier-portal foothold at a DIB machining and avionics subcontractor in north Alabama matching Sentry Peak. Analyst assesses high relevance; specifics redacted.', actor: 'Initial-access broker', asset: 'suppliers.sentrypeakdefense.com', action: 'Hunt in Sentinel for the described access, rotate supplier-portal credentials, brief the FSO and prepare for a possible DFARS 7012 report.', tenant: 'corporate' },
      { source: 'Forums', venue: 'State-aligned recruiting thread', sev: 'high', category: 'Targeting / threat', scope: 'Sector', title: 'Thread seeking "guidance and seeker" engineers at US primes and subs', snippet: 'Fake-recruiter persona solicits avionics and guidance engineers for "consulting" with document-heavy interviews, the pattern linked to state espionage. Sentry Peak engineers named among targets.', actor: 'APT40-aligned persona', asset: 'Engineering staff (LinkedIn)', action: 'Brief engineering on fake-recruiter lures; alert on PreVeil and Teamcenter bulk exports.', tenant: 'engineering' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', scope: 'Supply chain', title: 'Precision machining sub-tier posted on a leak site with drawings', snippet: 'A sub-tier machine shop supplying several primes appears on a leak site with sample drawings. Sentry Peak uses a supplier of similar profile for overflow work.', actor: 'LockBit affiliates', asset: 'Supply-chain overlap: Cumberland Precision Machining', action: 'Confirm which TDPs the supplier holds in HexaCustody; request incident confirmation under the subcontract flow-down.', tenant: 'manufacturing' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'high', category: 'Credentials for sale', scope: 'Direct mention', title: 'Commercial-tenant Microsoft 365 session for a Sentry Peak manager', snippet: 'An infected personal device leaked a commercial-tenant session and a saved Exostar login. The CUI enclave (GCC High) requires FIPS YubiKeys and was not reachable. Values held in evidence.', actor: 'Stealer-log vendor', asset: 'login.microsoftonline.com (commercial)', action: 'Revoke sessions in the commercial Entra tenant, reset the Exostar account, confirm no GCC High sign-in attempts.', tenant: 'corporate' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Config / data leak', scope: 'Direct mention', title: 'Pasted DNC transfer script references a Building 3 host', snippet: 'A paste contains a DNC programme-transfer script naming B3-DNC-SRV01. No programme content included; traced to a former contractor’s public repository.', actor: 'Unattributed', asset: 'B3-DNC-SRV01', action: 'Confirm the shop-floor service account was rotated; request repository removal.', tenant: 'manufacturing' },
      { source: 'Telegram', venue: 'Hacktivist channel', sev: 'medium', category: 'Targeting / threat', scope: 'Sector', title: 'Channel lists US defence test ranges in a disruption "call to action"', snippet: 'A hacktivist channel names several southwestern test ranges, including the Tucson area. No capability demonstrated; posture only.', actor: 'Pro-state hacktivist collective', asset: 'test.sentrypeakdefense.com', action: 'Raise DDoS readiness on public hosts; brief the Tucson range manager.', tenant: 'tucson' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', scope: 'Direct mention', title: 'Fake Sentry Peak job offers used to harvest clearance details', snippet: 'Scam posts advertise Sentry Peak roles and ask applicants for clearance level and SF-86 details. Careers lookalike tracked separately.', actor: 'Recruitment-fraud crew', asset: 'careers.sentrypeakdefense.com', action: 'Request takedown; publish a careers-page warning with the FSO contact.', tenant: 'corporate' },
    ],
    pharma: [
      { source: 'Forums', venue: 'Access-broker forum', sev: 'critical', category: 'Network access for sale', scope: 'Direct mention', title: 'Broker selling VPN access to a "Swiss biologics manufacturer"', snippet: 'Listing offers VPN plus domain-user access at a Swiss pharmaceutical group with biologics plants in Valais and Ireland, matching Rhenara. Specifics redacted by the HexaInt analyst.', actor: 'Initial-access broker (forum rep ~55)', asset: 'vpn.rhenara.com', action: 'Force MFA re-registration on the VPN, hunt in Sentinel and CrowdStrike, confirm the plant DMZ jump hosts were not touched.', tenant: 'corporate' },
      { source: 'Forums', venue: 'Espionage-tasking thread', sev: 'high', category: 'Targeting / threat', scope: 'Sector', title: 'Request for biologics process-development documents from European pharma', snippet: 'A thread seeks cell-line and purification process documents for monoclonal antibodies from European manufacturers. Rhenara named among examples; pattern consistent with APT41 tasking.', actor: 'APT41-linked broker', asset: 'Biologics formulation & process IP', action: 'Raise HexaCustody monitoring on tech-transfer packs; alert on bulk exports from R&D shares.', tenant: 'rnd' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', scope: 'Supply chain', title: 'Mid-size CRO posted on a leak site with claimed trial data', snippet: 'A contract research organisation appears with sample site-monitoring reports. Rhenara is not named; CRO data-transfer patterns are under review across IQVIA, ICON and Parexel.', actor: 'Black Basta', asset: 'Supply-chain overlap: CRO data transfers', action: 'Confirm Rhenara studies held by the CRO type; review eTMF and Rave export logs.', tenant: 'clinops' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'high', category: 'Credentials for sale', scope: 'Direct mention', title: 'CRO partner-portal and Veeva Vault sessions in a stealer log', snippet: 'An infected CRO monitor laptop leaked sessions for the Rhenara partner portal and a Veeva Vault eTMF account. Values held in evidence, not shown.', actor: 'Stealer-log vendor', asset: 'connect.rhenara.com', action: 'Revoke the partner sessions in Okta, re-enrol the CRO account, confirm no unblinded data access in Rave.', tenant: 'clinops' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Config / data leak', scope: 'Direct mention', title: 'Pasted OPC UA client config references a Valais historian', snippet: 'A paste contains an OPC UA client configuration naming VLS-PI-HIST01. Certificate thumbprint only; traced to an integrator’s troubleshooting post.', actor: 'Unattributed', asset: 'VLS-PI-HIST01', action: 'Rotate the historian client certificate; remind integrators of the confidentiality clause.', tenant: 'valais' },
      { source: 'Telegram', venue: 'Counterfeit-medicines channel', sev: 'medium', category: 'Brand abuse', scope: 'Direct mention', title: 'Counterfeit Rhenara oncology packs advertised with cloned serial codes', snippet: 'Sellers offer packs bearing Rhenara branding and serial numbers that fail EU FMD verification. Cork serialisation master data is not implicated.', actor: 'Counterfeit-medicines network', asset: 'Serialisation master data (EU FMD / DSCSA)', action: 'Report to Swissmedic and HPRA; feed serials to the brand-protection team.', tenant: 'cork' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', scope: 'Direct mention', title: 'Fake Rhenara patient-support programme lure', snippet: 'A message lure offers "co-pay assistance" and links to a cloned HCP portal page. Lookalike domain tracked separately.', actor: 'Consumer-fraud crew', asset: 'hcp.rhenara.com', action: 'Request takedown; brief the US patient-services hotline.', tenant: 'commercial' },
    ],
    sghospital: [
      { source: 'Forums', venue: 'Access-broker forum', sev: 'critical', category: 'Network access for sale', scope: 'Direct mention', title: 'Broker advertising Citrix access to a "private hospital group, Singapore"', snippet: 'Listing offers remote-access credentials at a Singapore private hospital group running TrakCare, matching Orchid Bay by bed count. Specifics redacted by the HexaInt analyst.', actor: 'Initial-access broker', asset: 'citrix.orchidbay.com.sg', action: 'Force MFA re-registration on Citrix, hunt in Sentinel and CrowdStrike, prepare the MOH 2-hour notification decision.', tenant: 'obh' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'high', category: 'Credentials for sale', scope: 'Direct mention', title: 'Visiting-consultant TrakCare and Citrix sessions in a stealer log', snippet: 'A visiting consultant’s home PC leaked Citrix cookies and a saved TrakCare launch link. Values held in evidence, not shown.', actor: 'Stealer-log vendor', asset: 'citrix.orchidbay.com.sg', action: 'Revoke sessions in Entra ID, force reset, and review the consultant’s TrakCare access in FairWarning.', tenant: 'specialist' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', scope: 'Sector', title: 'Regional hospital in Southeast Asia posted with claimed patient records', snippet: 'A private hospital in the region appears on a countdown. Orchid Bay is not named; a shared imaging-equipment service provider is noted.', actor: 'Qilin', asset: 'Supply-chain overlap: imaging vendor remote service', action: 'Confirm vendor remote sessions go through CyberArk Vendor PAM; review PACS segmentation.', tenant: 'labimg' },
      { source: 'Telegram', venue: 'Data-broker channel', sev: 'high', category: 'Data leak', scope: 'Supply chain', title: 'Seller claims telehealth appointment records referencing Orchid Bay', snippet: 'A small redacted sample claims telehealth bookings from Orchid Bay. HexaInt assesses it as scraped from the CareLink appointment chatbot integration, not TrakCare.', actor: 'Data broker (low reputation)', asset: 'telehealth.orchidbay.com.sg', action: 'Engage CareLink Telehealth; start the PDPA assessment (PDPC notification within 3 calendar days if notifiable).', tenant: 'daysurg' },
      { source: 'Forums', venue: 'APT tradecraft forum', sev: 'medium', category: 'Targeting / threat', scope: 'Sector', title: 'Discussion of Singapore healthcare as a target after the 2018 precedent', snippet: 'A thread revisits the 2018 SingHealth intrusion and lists private hospital groups as softer targets. No capability shared; posture only.', actor: 'UNC3886-aligned commentators', asset: 'TrakCare EHR (IRIS database)', action: 'Re-validate privileged-access paths to OBH-TRAK-DB01; brief the CSA liaison.', tenant: 'obh' },
      { source: 'Paste sites', venue: 'Public paste site', sev: 'medium', category: 'Config / data leak', scope: 'Direct mention', title: 'Pasted HL7 interface config references an Orchid Bay lab host', snippet: 'A paste contains an HL7 route configuration naming LAB-LIS-01. Credentials in it were already rotated; traced to an integrator forum post.', actor: 'Unattributed', asset: 'LAB-LIS-01', action: 'Confirm rotation; remind integrators of the data-handling clause.', tenant: 'labimg' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', scope: 'Direct mention', title: 'Fake "Orchid Bay bill payment" SMS lure circulating', snippet: 'An SMS lure impersonating patient billing links to a lookalike PayNow page. The lookalike domain is tracked separately.', actor: 'Scam syndicate', asset: 'pay.orchidbay.com.sg', action: 'Request takedown; report to the ScamShield team and warn patients via the app.', tenant: 'corp' },
    ],
    studio: [
      { source: 'Ransomware leak sites', venue: 'Leak forum ("pre-release" board)', sev: 'critical', category: 'Content leak', scope: 'Direct mention', title: `Frames from "${ci[0] ?? 'an unreleased feature'}" offered on a leak forum`, snippet: 'Low-resolution frames tagged as a Starfall feature are offered for sale. The NexGuard forensic watermark traces to a vendor review session.', actor: 'Pre-release content broker', asset: ci[0] ?? 'Pre-release master', action: 'Revoke the implicated Frame.io review link, open a NexGuard trace, begin takedown and legal referral.', tenant: 'studios' },
      { source: 'Markets', venue: 'Stealer-log marketplace', sev: 'critical', category: 'Credentials for sale', scope: 'Supply chain', title: 'VFX vendor artist’s Aspera and Okta sessions in a stealer log', snippet: 'An artist workstation at Northlight Pixel leaked sessions for the Starfall Aspera share and Okta. Values held in evidence, not shown.', actor: 'Stealer-log vendor', asset: 'aspera.starfallent.com', action: 'Revoke the vendor sessions, rotate Aspera share keys and confirm which Lodestar plates were reachable.', tenant: 'post' },
      { source: 'Forums', venue: 'Insider-recruitment thread', sev: 'high', category: 'Insider solicitation', scope: 'Sector', title: 'Thread seeking post and localisation staff with screener access', snippet: 'A post offers payment for awards screeners and dubbing scripts from major studios. Starfall titles named among wanted items.', actor: 'Extortion / brokerage crew', asset: 'Awards screeners (FYC)', action: 'Raise HexaCustody monitoring on FYC screeners; awareness nudge to localisation vendors.', tenant: 'studios' },
      { source: 'Forums', venue: 'Account-takeover forum', sev: 'high', category: 'Credential stuffing', scope: 'Direct mention', title: 'Starfall+ account checker shared with fresh combolists', snippet: 'A checker config targets login.starfallplus.com and resells working subscriber accounts. Akamai bot rules are blocking the current pattern.', actor: 'Account-takeover crew', asset: 'login.starfallplus.com', action: 'Tighten Akamai bot rules; force reset for matched subscribers and alert on device-limit spikes.', tenant: 'play' },
      { source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'high', category: 'Sector peer breached', scope: 'Supply chain', title: 'Dubbing vendor posted as a ransomware victim', snippet: 'A localisation and dubbing house used across the sector appears on a leak site. Starfall shares a dubbing vendor of similar profile.', actor: 'ALPHV/BlackCat affiliates', asset: 'Vendor chain: localisation', action: 'Confirm which titles the vendor holds; pre-emptively rotate Signiant access.', tenant: 'post' },
      { source: 'Telegram', venue: 'Hacktivist channel', sev: 'medium', category: 'OT intelligence', scope: 'Sector', title: 'Channel shares screenshots of theme-park ride HMIs found online', snippet: 'A channel posts HMI screenshots from amusement operators. None match Starfall resorts; Claroty xDome confirms no ride-control HMIs are internet-reachable.', actor: 'Hacktivist collective', asset: 'Ride & show control networks', action: 'Re-run external exposure checks on PARKS- ranges; brief ride and show engineering.', tenant: 'parks' },
      { source: 'Telegram', venue: 'Fraud channel', sev: 'low', category: 'Brand abuse', scope: 'Direct mention', title: 'Fake discounted StarPass resort tickets sold in a fraud channel', snippet: 'Sellers offer cut-price park tickets bought with stolen cards; a lookalike ticketing domain is tracked separately.', actor: 'Ticket-fraud crew', asset: 'tickets.starfallresorts.com', action: 'Notify accesso and Adyen fraud teams; request takedown.', tenant: 'parksasia' },
    ],
  };
  return forCustomer(map, c);
}

export function darkwebMentions(c: CustomerProfile, tenantId = 'all'): Mention[] {
  const r = rng(`int-dw-${c.id}`);
  const templates = mentionTemplates(c);
  const statuses: Mention['status'][] = ['New', 'Triaging', 'Actioned', 'Monitoring'];
  const target = Math.max(templates.length, headlines(c).int.darkWebMentions);
  const gen = genericMentions(c);
  const out: Mention[] = [];
  for (let i = 0; i < target; i++) {
    const t = i < templates.length ? templates[i] : gen[(i - templates.length) % gen.length](i);
    const tid = t.tenant ?? c.tenants[i % c.tenants.length].id;
    if (tenantId !== 'all' && tid !== tenantId) continue;
    out.push({
      ...t,
      scope: scopeOf(t),
      id: `DW-${String(1000 + i)}`,
      tenantId: tid,
      minutesAgo: i < templates.length ? r.int(20, 600) : r.int(600, 60 * 24 * 20),
      status: i < 3 ? 'New' : r.pick(statuses),
      confidence: r.int(55, 96),
    });
  }
  return out.filter((m) => tenantId === 'all' || m.tenantId === tenantId);
}

/** Recurring, lower-signal mention patterns that fill the feed beyond the named items. */
function genericMentions(c: CustomerProfile): ((i: number) => MT)[] {
  const r = rng(`int-dwgen-${c.id}`);
  const tp = c.thirdParties;
  const host = (i: number) => c.vocab.externalHosts[i % c.vocab.externalHosts.length];
  const tenant = (i: number) => c.tenants[i % c.tenants.length].id;
  return [
    (i) => ({ source: 'Markets', venue: 'Stealer-log marketplace', sev: 'medium', category: 'Credentials for sale', scope: 'Direct mention', title: `Stealer-log batch #${r.int(2100, 9800)} includes ${r.int(2, 9)} ${c.domain} logins`, snippet: `Saved browser logins for ${host(i)} found in a bulk log release. Matched records are in Credential Exposure; values held in evidence, not shown.`, actor: 'Stealer-log vendor', asset: host(i), action: 'Force reset and revoke sessions for the matched identities.', tenant: tenant(i) }),
    (i) => ({ source: 'Paste sites', venue: 'Combolist index', sev: 'low', category: 'Credential dump', scope: 'Direct mention', title: `Combolist index lists ${c.domain} among ${r.int(40, 400)} corporate domains`, snippet: 'Recycled email:password pairs, mostly from older third-party breaches. New pairs are matched against your identity provider.', actor: 'Combolist aggregator', asset: c.domain, action: 'Check matches for reuse; enforce banned-password list.', tenant: tenant(i) }),
    (i) => {
      const v = tp[i % tp.length];
      return { source: 'Forums', venue: 'Breach forum', sev: v.tier === 1 ? 'medium' : 'low', category: 'Supplier chatter', scope: 'Supply chain', title: `Forum thread discusses access at a ${v.category.toLowerCase()} provider`, snippet: `An unverified post describes access to a provider of the same type and region as one of your suppliers (${v.category}). No ${c.short} data referenced.`, actor: 'Forum user (low reputation)', asset: `Supplier type: ${v.category}`, action: 'Track in Supply Chain; ask the supplier to confirm if corroborated.', tenant: tenant(i) };
    },
    (i) => ({ source: 'Telegram', venue: 'Sector chatter channel', sev: 'low', category: 'Targeting / threat', scope: 'Sector', title: `${c.sector} organisations listed in a target-survey post`, snippet: `A channel shares a list of ${c.sector.toLowerCase()} organisations with exposed services. ${c.short} appears by sector only.`, actor: 'Opportunistic scanner crew', asset: host(i + 2), action: 'Confirm the exposure listed is closed in Attack Surface.', tenant: tenant(i) }),
    (i) => ({ source: 'Ransomware leak sites', venue: 'Leak-site victim board', sev: 'medium', category: 'Sector peer breached', scope: 'Sector', title: `Another ${c.sector.toLowerCase()} organisation posted as a victim`, snippet: 'A sector peer is listed with a countdown. No shared supplier identified yet; tracked for technique overlap.', actor: c.vocab.threatActors[i % c.vocab.threatActors.length], asset: 'Sector peer', action: 'Compare published techniques with HexaMatrix coverage.', tenant: tenant(i) }),
  ];
}

/** Stacked mentions-over-time series, one array per source. */
export function mentionTrend(c: CustomerProfile, tenantId: string, tr: TimeRange): { labels: string[]; series: Record<DwSource, number[]> } {
  const r = rng(`int-dwtrend-${c.id}-${tenantId}-${tr}`);
  const { labels } = buckets(tr);
  const h = headlines(c, tenantId);
  const weight: Record<DwSource, number> = { Markets: 0.28, Forums: 0.24, 'Ransomware leak sites': 0.14, Telegram: 0.22, 'Paste sites': 0.12 };
  const perBucket = Math.max(1, Math.round((h.int.darkWebMentions * (tr === '24h' ? 0.6 : 1.4)) / labels.length));
  const series = {} as Record<DwSource, number[]>;
  for (const s of DW_SOURCES) {
    series[s] = labels.map((_, i) => {
      const trend = 1 + (i / labels.length) * 0.4;
      return Math.max(0, Math.round(perBucket * weight[s] * trend * r.float(0.3, 1.8, 2)));
    });
  }
  return { labels, series };
}

/* ---------------- ransomware groups active against the sector ---------------- */
export interface RansomGroup {
  name: string;
  active: boolean;
  sectorVictims90d: number;
  lastSeenDays: number;
  tactics: string[];
  note: string;
  peers: string[];
}
export function ransomGroups(c: CustomerProfile): RansomGroup[] {
  const r = rng(`int-ransom-${c.id}`);
  const data: CustomerMap<RansomGroup[]> = {
    maritime: [
      { name: 'LockBit 3.0 affiliates', active: true, sectorVictims90d: 6, lastSeenDays: 4, tactics: ['T1486', 'T1490', 'T1133'], note: 'Most prolific against logistics and ports; double extortion.', peers: ['DP terminal peer (EU)', 'Regional feeder line', 'Inland logistics operator'] },
      { name: 'Black Basta', active: true, sectorVictims90d: 3, lastSeenDays: 11, tactics: ['T1486', 'T1566.001', 'T1021.001'], note: 'Qakbot-style access, targets shipping and manufacturing.', peers: ['Bulk carrier operator', 'Port authority (APAC)'] },
      { name: 'Akira', active: true, sectorVictims90d: 2, lastSeenDays: 19, tactics: ['T1133', 'T1486', 'T1490'], note: 'VPN-focused initial access; mid-market shipping.', peers: ['Ship management firm'] },
      { name: 'Cl0p', active: false, sectorVictims90d: 1, lastSeenDays: 70, tactics: ['T1190', 'T1567.002'], note: 'Mass-exploitation campaigns (MFT); opportunistic.', peers: ['Freight forwarder'] },
    ],
    finserv: [
      { name: 'ALPHV/BlackCat affiliates', active: true, sectorVictims90d: 5, lastSeenDays: 6, tactics: ['T1486', 'T1567.002', 'T1133'], note: 'Targets financial services and their outsourcers.', peers: ['Payments processor', 'Wealth manager', 'Insurer (EU)'] },
      { name: 'Cl0p', active: true, sectorVictims90d: 4, lastSeenDays: 9, tactics: ['T1190', 'T1567.002'], note: 'Supply-chain MFT exploitation; many finance victims.', peers: ['Fund administrator', 'Pensions provider'] },
      { name: 'LockBit 3.0 affiliates', active: true, sectorVictims90d: 3, lastSeenDays: 13, tactics: ['T1486', 'T1490'], note: 'Broad targeting incl. banks and brokers.', peers: ['Broker-dealer (US)'] },
      { name: 'Akira', active: true, sectorVictims90d: 2, lastSeenDays: 21, tactics: ['T1133', 'T1486'], note: 'VPN initial access against mid-size finance.', peers: ['Credit union'] },
    ],
    media: [
      { name: 'Akira', active: true, sectorVictims90d: 4, lastSeenDays: 8, tactics: ['T1133', 'T1486', 'T1490'], note: 'Active against media, post-production and gaming.', peers: ['Post-production house', 'Animation studio'] },
      { name: 'LAPSUS$-style extortion crews', active: true, sectorVictims90d: 3, lastSeenDays: 10, tactics: ['T1621', 'T1078', 'T1567.002'], note: 'Data-theft extortion, insider recruitment.', peers: ['Streaming platform', 'Talent agency'] },
      { name: 'ShinyHunters', active: true, sectorVictims90d: 3, lastSeenDays: 15, tactics: ['T1190', 'T1530'], note: 'Cloud-storage data theft and resale.', peers: ['VFX vendor', 'Localisation vendor'] },
      { name: 'Black Basta', active: false, sectorVictims90d: 1, lastSeenDays: 64, tactics: ['T1486', 'T1566.001'], note: 'Occasional media targeting.', peers: ['Broadcast operator'] },
    ],
    healthcare: [
      { name: 'Rhysida', active: true, sectorVictims90d: 5, lastSeenDays: 5, tactics: ['T1133', 'T1486', 'T1567.002'], note: 'Repeat hospital victims; data-theft extortion with EHR downtime.', peers: ['Regional health system (Midwest)', "Children's hospital (US)", 'Medical-records vendor'] },
      { name: 'Qilin', active: true, sectorVictims90d: 4, lastSeenDays: 9, tactics: ['T1078', 'T1486', 'T1490'], note: 'Pathology and lab providers hit; peers diverted ambulances.', peers: ['Pathology services provider', 'Imaging centre group'] },
      { name: 'INC Ransom', active: true, sectorVictims90d: 3, lastSeenDays: 14, tactics: ['T1190', 'T1486'], note: 'Edge-appliance exploitation against US and UK health providers.', peers: ['Community hospital network'] },
      { name: 'ALPHV/BlackCat affiliates', active: false, sectorVictims90d: 1, lastSeenDays: 82, tactics: ['T1133', 'T1486', 'T1567.002'], note: 'The 2024 claims-clearinghouse attack reshaped sector risk; brand dormant, affiliates moved on.', peers: ['Claims clearinghouse'] },
    ],
    automotive: [
      { name: 'Akira', active: true, sectorVictims90d: 5, lastSeenDays: 6, tactics: ['T1133', 'T1486', 'T1490'], note: 'VPN-led intrusions at automotive suppliers; line stoppages downstream.', peers: ['Tier 2 seat supplier (DE)', 'Wiring-harness maker', 'Dealer group (US)'] },
      { name: 'Black Basta', active: true, sectorVictims90d: 3, lastSeenDays: 12, tactics: ['T1566.001', 'T1021.001', 'T1486'], note: 'Manufacturing and automotive suppliers; fast to encryption.', peers: ['Tier 1 electronics supplier', 'Inbound logistics provider'] },
      { name: 'BlackSuit (dealer SaaS attacks)', active: true, sectorVictims90d: 2, lastSeenDays: 17, tactics: ['T1199', 'T1486', 'T1567.002'], note: 'Supply-chain attacks on dealer software took thousands of dealers offline in 2024.', peers: ['Dealer-management SaaS'] },
      { name: 'LockBit 3.0 affiliates', active: false, sectorVictims90d: 1, lastSeenDays: 66, tactics: ['T1486', 'T1490'], note: 'Reduced after law-enforcement disruption; occasional parts suppliers.', peers: ['Aftermarket parts distributor'] },
    ],
    insurance: [
      { name: 'Black Basta', active: true, sectorVictims90d: 4, lastSeenDays: 5, tactics: ['T1219', 'T1078', 'T1486'], note: 'Help-desk vishing and remote-support tooling against carriers and MGAs; claims files used for extortion.', peers: ['Regional P&C carrier (Midwest)', 'Managing general agent (TX)', 'Third-party claims administrator'] },
      { name: 'Cl0p', active: true, sectorVictims90d: 3, lastSeenDays: 10, tactics: ['T1190', 'T1567.002'], note: 'MFT mass exploitation; insurers and their bordereau and reinsurance transfers are recurring victims.', peers: ['Life & annuity administrator', 'Policy print-and-mail vendor'] },
      { name: 'Scattered Spider', active: true, sectorVictims90d: 3, lastSeenDays: 13, tactics: ['T1621', 'T1078', 'T1098'], note: 'A 2025 wave against US insurers used service-desk resets to reach Okta and VMware estates.', peers: ['US auto insurer', 'Life insurer (Midwest)'] },
      { name: 'LockBit affiliates', active: false, sectorVictims90d: 1, lastSeenDays: 71, tactics: ['T1133', 'T1486', 'T1490'], note: 'Reduced after disruption; occasional independent agencies.', peers: ['Independent insurance agency'] },
    ],
    defence: [
      { name: 'LockBit affiliates', active: true, sectorVictims90d: 4, lastSeenDays: 7, tactics: ['T1133', 'T1486', 'T1567.002'], note: 'Machine shops and sub-tier suppliers; stolen drawings published as leverage.', peers: ['Sub-tier machine shop (OH)', 'Composite structures supplier', 'Defence electronics distributor'] },
      { name: 'Akira', active: true, sectorVictims90d: 3, lastSeenDays: 12, tactics: ['T1133', 'T1486', 'T1490'], note: 'VPN-led intrusions into small DIB manufacturers without phishing-resistant MFA.', peers: ['Avionics harness maker', 'Test-equipment integrator'] },
      { name: 'Black Basta', active: true, sectorVictims90d: 2, lastSeenDays: 19, tactics: ['T1219', 'T1078', 'T1486'], note: 'Help-desk vishing into aerospace manufacturers; fast to encryption.', peers: ['Aerospace fastener supplier'] },
      { name: 'Cl0p', active: false, sectorVictims90d: 1, lastSeenDays: 88, tactics: ['T1190', 'T1567.002'], note: 'MFT exploitation hit several primes’ suppliers; no current campaign.', peers: ['Logistics provider (defence freight)'] },
    ],
    pharma: [
      { name: 'Black Basta', active: true, sectorVictims90d: 4, lastSeenDays: 6, tactics: ['T1219', 'T1078', 'T1486'], note: 'European pharma and CDMOs hit; batch-release and QC systems encrypted.', peers: ['CDMO (Switzerland)', 'Generic manufacturer (DE)', 'Clinical-supply packager'] },
      { name: 'Cl0p', active: true, sectorVictims90d: 3, lastSeenDays: 11, tactics: ['T1190', 'T1567.002'], note: 'MFT mass exploitation; CRO and clinical-data transfers exposed.', peers: ['Contract research organisation', 'Pharmacovigilance outsourcer'] },
      { name: 'Qilin', active: true, sectorVictims90d: 2, lastSeenDays: 16, tactics: ['T1078', 'T1486', 'T1490'], note: 'Life-sciences labs and diagnostics; data theft before encryption.', peers: ['Bioanalytical lab'] },
      { name: 'LockBit 3.0 affiliates', active: false, sectorVictims90d: 1, lastSeenDays: 74, tactics: ['T1486', 'T1490'], note: 'Reduced after disruption; occasional packaging suppliers.', peers: ['Pharma packaging supplier'] },
    ],
    sghospital: [
      { name: 'Qilin', active: true, sectorVictims90d: 4, lastSeenDays: 5, tactics: ['T1078', 'T1486', 'T1490'], note: 'Hospitals and pathology providers across APAC; laboratory and imaging services disrupted.', peers: ['Private hospital (Malaysia)', 'Diagnostic lab chain (Australia)', 'Specialist clinic group (SG)'] },
      { name: 'LockBit 3.0 affiliates', active: true, sectorVictims90d: 3, lastSeenDays: 9, tactics: ['T1133', 'T1486', 'T1490'], note: 'Still active against Southeast Asian healthcare despite the 2024 disruption.', peers: ['Hospital group (Indonesia)', 'Dental chain (SG)'] },
      { name: 'Akira', active: true, sectorVictims90d: 2, lastSeenDays: 15, tactics: ['T1133', 'T1486'], note: 'VPN appliances without MFA at medical centres and aged-care operators.', peers: ['Medical centre group (MY)'] },
      { name: 'Rhysida', active: false, sectorVictims90d: 1, lastSeenDays: 63, tactics: ['T1133', 'T1486', 'T1567.002'], note: 'Hospital victims mostly outside the region this quarter.', peers: ['Hospital (Australia)'] },
    ],
    studio: [
      { name: 'ShinyHunters', active: true, sectorVictims90d: 5, lastSeenDays: 4, tactics: ['T1078', 'T1530', 'T1567.002'], note: 'Vishing into SaaS tenants and cloud storage; subscriber and ticketing data resold.', peers: ['Streaming service', 'Ticketing platform', 'Entertainment retailer'] },
      { name: 'Scattered Spider', active: true, sectorVictims90d: 3, lastSeenDays: 8, tactics: ['T1621', 'T1078', 'T1098'], note: 'Help-desk resets into entertainment and resort operators; the 2023 casino attacks set the template.', peers: ['Resort and casino operator', 'Hospitality group'] },
      { name: 'Akira', active: true, sectorVictims90d: 3, lastSeenDays: 13, tactics: ['T1133', 'T1486', 'T1490'], note: 'Post-production and VFX houses; render storage encrypted ahead of deliveries.', peers: ['VFX house (London)', 'Animation studio'] },
      { name: 'ALPHV/BlackCat affiliates', active: false, sectorVictims90d: 1, lastSeenDays: 79, tactics: ['T1133', 'T1486', 'T1567.002'], note: 'Brand dormant; former affiliates now operate under other programmes.', peers: ['Dubbing vendor'] },
    ],
  };
  // stable jitter so peers feel per-customer
  return forCustomer(data, c).map((g) => ({ ...g, lastSeenDays: g.lastSeenDays + r.int(0, 2) }));
}

/* ---------------- lookalike / impersonation domains ---------------- */
export const LOOK_STATUSES = ['Live — login page', 'Live — parked', 'Live — mail only', 'Live — redirect', 'Registered — no DNS', 'Taken down'] as const;
export type LookStatus = (typeof LOOK_STATUSES)[number];
export const LOOK_STATUS_COLOR: Record<LookStatus, string> = {
  'Live — login page': '#f8646f', 'Live — parked': '#f5a83d', 'Live — mail only': '#ef6aae', 'Live — redirect': '#f2643f', 'Registered — no DNS': '#8a9bc0', 'Taken down': '#2dd4bf',
};
export interface Lookalike {
  domain: string;
  impersonates: string;
  kind: string;
  registered: number; // days ago
  foundDays: number;
  registrar: string;
  mx: boolean;
  livePage: 'Parked' | 'Login clone' | 'Redirect' | 'No content' | 'Mail only';
  status: LookStatus;
  risk: Severity;
  takedown: 'None' | 'Requested' | 'In progress' | 'Taken down';
  tenantId: string;
}
export function lookalikes(c: CustomerProfile, tenantId = 'all'): Lookalike[] {
  const r = rng(`int-look-${c.id}`);
  const n = headlines(c).int.lookalikeDomains;
  const base = c.vocab.lookalikeBase;
  const glyph = base.replace('o', '0').replace(/l(?!.*l)/, '1');
  // Bases with no o/l (e.g. rhenara) need a typo instead, or the "lookalike" is the real domain.
  const homo = glyph !== base ? glyph : /n/.test(base) ? base.replace('n', 'nn') : `${base}s`;
  const variants: { make: (b: string) => string; kind: string }[] = [
    { make: () => `${homo}.com`, kind: 'Typo / homoglyph' },
    { make: (b) => `${b}-support.com`, kind: 'Hyphen + keyword' },
    { make: (b) => `${b}-invoices.com`, kind: 'Invoice fraud' },
    { make: (b) => `${b}-login.net`, kind: 'Phishing lure' },
    { make: (b) => `${b}.co`, kind: 'Alt TLD' },
    { make: (b) => `${b}-secure.com`, kind: 'Hyphen + keyword' },
    { make: (b) => `my${b}.com`, kind: 'Prefix' },
    { make: (b) => `${b}-hr.com`, kind: 'Recruitment lure' },
    { make: (b) => `${b}pay.com`, kind: 'Payments lure' },
    { make: (b) => `${b}-portal.com`, kind: 'Hyphen + keyword' },
    { make: (b) => `${b}s.com`, kind: 'Plural / typo' },
    { make: (b) => `${b}.app`, kind: 'Alt TLD' },
  ];
  const altTlds = ['net', 'org', 'info', 'online', 'site', 'xyz', 'top', 'shop'];
  const registrars = ['NameCheap, Inc. (US)', 'GoDaddy.com, LLC (US)', 'Porkbun LLC (US)', 'Reg.ru (RU)', 'Hostinger Operations (LT)', 'Alibaba Cloud (CN)', 'NameSilo, LLC (US)', 'Tucows Domains (CA)'];
  const out: Lookalike[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const v = variants[i % variants.length];
    const round = Math.floor(i / variants.length);
    let d = v.make(base);
    if (round > 0) d = d.replace(/\.[a-z.]+$/, `.${altTlds[(i + round) % altTlds.length]}`);
    for (let k = 2; seen.has(d); k++) d = d.replace(/^([^.]+?)(\d*)\./, `$1${k}.`);
    seen.add(d);
    const page = i === 0 ? 'Login clone' : i === 2 ? 'Mail only' : r.weighted<Lookalike['livePage']>([['Parked', 4], ['Login clone', 2], ['Redirect', 2], ['No content', 3], ['Mail only', 1]]);
    const mx = page === 'Mail only' || r.chance(0.35);
    const takedown: Lookalike['takedown'] = i === 0 ? 'In progress' : i < 3 ? 'Requested' : r.weighted<Lookalike['takedown']>([['None', 5], ['Requested', 1], ['Taken down', 2]]);
    const status: LookStatus = takedown === 'Taken down' ? 'Taken down' : page === 'Login clone' ? 'Live — login page' : page === 'Parked' ? 'Live — parked' : page === 'Mail only' ? 'Live — mail only' : page === 'Redirect' ? 'Live — redirect' : 'Registered — no DNS';
    const dangerous = status === 'Live — login page' || status === 'Live — mail only' || (mx && page === 'Redirect');
    const registered = i < 3 ? r.int(2, 14) : r.int(5, 240);
    out.push({
      domain: defang(d),
      impersonates: c.domain,
      kind: v.kind,
      registered,
      foundDays: Math.max(0, registered - r.int(1, 3)),
      registrar: r.pick(registrars),
      mx,
      livePage: page,
      status,
      risk: status === 'Taken down' ? 'info' : dangerous ? (i < 2 ? 'critical' : 'high') : page === 'Parked' || page === 'No content' ? 'low' : 'medium',
      takedown,
      tenantId: c.tenants[i % c.tenants.length].id,
    });
  }
  return out.filter((l) => tenantId === 'all' || l.tenantId === tenantId || i0(l));
}
/** Brand lookalikes are group-wide; keep the first few visible in every tenant view. */
function i0(l: Lookalike): boolean {
  return l.risk === 'critical';
}

/* =====================================================================
   OSINT & threat intel
   ===================================================================== */
export interface ActorProfile {
  name: string;
  aka: string;
  origin: string;
  motivation: string;
  sectors: string[];
  activity: 'High' | 'Medium' | 'Low';
  lastSeenDays: number;
  techniques: string[]; // ATT&CK ids
  summary: string;
}
export function actorProfiles(c: CustomerProfile): ActorProfile[] {
  const r = rng(`int-actors-${c.id}`);
  const LIB: Record<string, Omit<ActorProfile, 'lastSeenDays'>> = {
    'Sandworm (APT44)': { name: 'Sandworm (APT44)', aka: 'Seashell Blizzard, Voodoo Bear', origin: 'Russia (GRU)', motivation: 'Destructive / state', sectors: ['Energy', 'Maritime', 'Government'], activity: 'High', techniques: ['T1190', 'T1133', 'T0866', 'T0831', 'T1486'], summary: 'State destructive operator with OT/ICS capability; relevant to port and vessel control systems.' },
    'Volt Typhoon': { name: 'Volt Typhoon', aka: 'Vanguard Panda', origin: 'China (PRC)', motivation: 'Pre-positioning / state', sectors: ['Transportation', 'Maritime', 'Comms'], activity: 'High', techniques: ['T1078', 'T1133', 'T1021.001', 'T1070.001', 'T1595'], summary: 'Living-off-the-land pre-positioning in critical infrastructure; stealthy, uses valid accounts.' },
    'LockBit 3.0 affiliates': { name: 'LockBit 3.0 affiliates', aka: 'LockBit Black', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Logistics', 'Manufacturing', 'Maritime'], activity: 'High', techniques: ['T1133', 'T1486', 'T1490', 'T1021.001'], summary: 'Prolific ransomware affiliates; frequent logistics and ports victims.' },
    'CyberAv3ngers': { name: 'CyberAv3ngers', aka: 'IRGC-linked', origin: 'Iran (IRGC)', motivation: 'Hacktivist / state', sectors: ['Water', 'Maritime', 'OT'], activity: 'Medium', techniques: ['T0883', 'T0886', 'T0836', 'T0814'], summary: 'Targets internet-exposed OT devices (e.g. PLCs) for disruption and messaging.' },
    'APT41': { name: 'APT41', aka: 'Winnti, Barium', origin: 'China', motivation: 'Espionage + financial', sectors: ['Logistics', 'Tech', 'Finance'], activity: 'Medium', techniques: ['T1190', 'T1505.003', 'T1078', 'T1567.002'], summary: 'Dual espionage/criminal operator; supply-chain and web-facing exploitation.' },
    'Black Basta': { name: 'Black Basta', aka: '—', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Manufacturing', 'Logistics'], activity: 'Medium', techniques: ['T1566.001', 'T1021.001', 'T1486'], summary: 'Qakbot-lineage ransomware; phishing to rapid encryption.' },
    'Lazarus Group (APT38)': { name: 'Lazarus Group (APT38)', aka: 'Hidden Cobra', origin: 'North Korea', motivation: 'Financial / state', sectors: ['Banking', 'Crypto', 'Defense'], activity: 'High', techniques: ['T1566.001', 'T1078', 'T1657', 'T1567.002', 'T1059.001'], summary: 'State financial-theft operator; SWIFT and payment-system intrusions.' },
    'FIN7': { name: 'FIN7', aka: 'Carbanak', origin: 'Cybercrime', motivation: 'Financial', sectors: ['Banking', 'Retail', 'Hospitality'], activity: 'Medium', techniques: ['T1566.001', 'T1059.001', 'T1218.011', 'T1486'], summary: 'Sophisticated financially motivated crew; now also ransomware-adjacent.' },
    'Scattered Spider': { name: 'Scattered Spider', aka: 'UNC3944, Octo Tempest', origin: 'Cybercrime (EN-speaking)', motivation: 'Financial / extortion', sectors: ['Finance', 'Telecom', 'Media'], activity: 'High', techniques: ['T1621', 'T1078', 'T1199', 'T1539', 'T1098'], summary: 'Help-desk social engineering, MFA fatigue and SIM-swap; fast to domain takeover.' },
    'ALPHV/BlackCat affiliates': { name: 'ALPHV/BlackCat affiliates', aka: 'Noberus', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Finance', 'Healthcare'], activity: 'Medium', techniques: ['T1133', 'T1486', 'T1567.002'], summary: 'Rust-based RaaS; data-theft extortion against finance and outsourcers.' },
    'TA505': { name: 'TA505', aka: 'Hive0065', origin: 'Cybercrime', motivation: 'Financial', sectors: ['Finance', 'Retail'], activity: 'Low', techniques: ['T1566.001', 'T1204.002', 'T1486'], summary: 'Large-scale malspam distributor and ransomware precursor.' },
    'Cl0p': { name: 'Cl0p', aka: 'TA505-linked', origin: 'Cybercrime', motivation: 'Financial / extortion', sectors: ['Finance', 'Many'], activity: 'Medium', techniques: ['T1190', 'T1567.002'], summary: 'Mass-exploitation of managed-file-transfer products for data theft.' },
    'ShinyHunters': { name: 'ShinyHunters', aka: '—', origin: 'Cybercrime', motivation: 'Financial / data theft', sectors: ['Media', 'Tech', 'Retail'], activity: 'Medium', techniques: ['T1190', 'T1530', 'T1567.002'], summary: 'Cloud-storage breach and data resale.' },
    'LAPSUS$-style extortion crews': { name: 'LAPSUS$-style extortion crews', aka: '—', origin: 'Cybercrime (youth)', motivation: 'Extortion / notoriety', sectors: ['Media', 'Tech'], activity: 'Medium', techniques: ['T1621', 'T1078', 'T1199', 'T1567.002'], summary: 'MFA fatigue, insider recruitment and source/content theft.' },
    'Leak forums ("pre-release" brokers)': { name: 'Leak forums ("pre-release" brokers)', aka: 'Scene / release groups', origin: 'Cybercrime (distributed)', motivation: 'Piracy / financial', sectors: ['Media'], activity: 'High', techniques: ['T1199', 'T1530', 'T1567.002', 'T1041'], summary: 'Broker and distribute pre-release content; recruit vendor/insider access.' },
    'Akira': { name: 'Akira', aka: '—', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Media', 'Manufacturing', 'Automotive'], activity: 'High', techniques: ['T1133', 'T1486', 'T1490'], summary: 'VPN-focused initial access then double extortion.' },
    'Rhysida': { name: 'Rhysida', aka: 'Vice Society lineage', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Healthcare', 'Education', 'Government'], activity: 'High', techniques: ['T1133', 'T1078', 'T1486', 'T1567.002'], summary: 'Repeatedly hits hospitals; steals patient data then encrypts, forcing EHR downtime procedures.' },
    'Qilin': { name: 'Qilin', aka: 'Agenda', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Healthcare', 'Pathology', 'Manufacturing'], activity: 'High', techniques: ['T1078', 'T1486', 'T1490', 'T1562.001'], summary: 'Pathology and lab-service attacks that disrupted transfusions and diagnostics at peer hospitals.' },
    'INC Ransom': { name: 'INC Ransom', aka: '—', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Healthcare', 'Public sector'], activity: 'Medium', techniques: ['T1190', 'T1486', 'T1567.002'], summary: 'Exploits edge appliances, then data theft and encryption against health providers.' },
    'BlackSuit (dealer SaaS attacks)': { name: 'BlackSuit (dealer SaaS attacks)', aka: 'Royal lineage', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Automotive retail', 'Manufacturing'], activity: 'Medium', techniques: ['T1199', 'T1486', 'T1567.002', 'T1490'], summary: 'Supply-chain attacks on dealer-management software that took thousands of dealerships offline.' },
    'Lazarus Group': { name: 'Lazarus Group', aka: 'Hidden Cobra, APT38', origin: 'North Korea', motivation: 'Financial / state', sectors: ['Media', 'Crypto', 'Defense'], activity: 'Medium', techniques: ['T1566.001', 'T1078', 'T1567.002', 'T1059.001'], summary: 'State operator with a history of destructive attacks on a film studio and fake-recruiter lures.' },
    'LockBit affiliates': { name: 'LockBit affiliates', aka: 'LockBit Black / 5.0', origin: 'Cybercrime (RaaS)', motivation: 'Financial / extortion', sectors: ['Manufacturing', 'Insurance', 'Defense supply chain'], activity: 'Medium', techniques: ['T1133', 'T1486', 'T1490', 'T1567.002'], summary: 'Affiliates regrouped after the 2024 disruption; small suppliers and agencies are the usual victims.' },
    'APT40': { name: 'APT40', aka: 'Leviathan, Gingham Typhoon', origin: 'China (MSS)', motivation: 'Espionage / state', sectors: ['Defense', 'Maritime', 'Engineering'], activity: 'High', techniques: ['T1190', 'T1566.001', 'T1505.003', 'T1078', 'T1560.001'], summary: 'Targets defence and engineering IP; fast exploitation of edge devices and fake-recruiter approaches to engineers.' },
    'APT29': { name: 'APT29', aka: 'Midnight Blizzard, Cozy Bear', origin: 'Russia (SVR)', motivation: 'Espionage / state', sectors: ['Government', 'Defense', 'Pharma'], activity: 'Medium', techniques: ['T1078', 'T1098', 'T1550.001', 'T1566.002'], summary: 'Cloud-identity tradecraft: OAuth app abuse and password spraying against Microsoft tenants; historically targeted vaccine research.' },
    'FIN11 / Cl0p': { name: 'FIN11 / Cl0p', aka: 'TA505-linked', origin: 'Cybercrime', motivation: 'Financial / extortion', sectors: ['Pharma', 'Finance', 'Many'], activity: 'Medium', techniques: ['T1190', 'T1567.002', 'T1657'], summary: 'Mass exploitation of managed-file-transfer products, then data-theft extortion without encryption.' },
    'Mustang Panda': { name: 'Mustang Panda', aka: 'Earth Preta, TA416', origin: 'China', motivation: 'Espionage / state', sectors: ['Government', 'Healthcare', 'Southeast Asia'], activity: 'High', techniques: ['T1566.001', 'T1204.002', 'T1027', 'T1071.001'], summary: 'Southeast Asia-focused espionage; lure documents and USB-borne loaders using DLL side-loading.' },
    'UNC3886': { name: 'UNC3886', aka: '—', origin: 'China-nexus', motivation: 'Espionage / state', sectors: ['Critical infrastructure', 'Telecom', 'Singapore'], activity: 'High', techniques: ['T1190', 'T1505.003', 'T1078', 'T1070.001'], summary: 'Named by Singapore in 2025 for attacks on critical infrastructure; exploits hypervisors, firewalls and other appliances without EDR.' },
    'LAPSUS$': { name: 'LAPSUS$', aka: 'DEV-0537, Strawberry Tempest', origin: 'Cybercrime (youth)', motivation: 'Extortion / notoriety', sectors: ['Media', 'Gaming', 'Tech'], activity: 'Medium', techniques: ['T1621', 'T1078', 'T1199', 'T1567.002'], summary: 'MFA fatigue, SIM swaps and paid insiders; leaks source code and unreleased content for notoriety.' },
    'NullBulge': { name: 'NullBulge', aka: '—', origin: 'Hacktivist / cybercrime', motivation: 'Ideological / extortion', sectors: ['Media', 'Gaming', 'AI'], activity: 'Low', techniques: ['T1195.002', 'T1213', 'T1567.002'], summary: 'Poisons creative and AI tool add-ons, then leaks internal chat and content from entertainment companies.' },
  };
  return c.vocab.threatActors
    .map((name) => LIB[name])
    .filter((x): x is Omit<ActorProfile, 'lastSeenDays'> => Boolean(x))
    .map((a) => ({ ...a, lastSeenDays: a.activity === 'High' ? r.int(1, 12) : a.activity === 'Medium' ? r.int(10, 40) : r.int(40, 120) }));
}

export interface Advisory {
  id: string;
  source: 'CISA KEV' | 'Sector ISAC' | 'Vendor';
  title: string;
  ref: string;
  sev: Severity;
  daysAgo: number;
  affectsEstate: boolean;
  note: string;
}
export function advisories(c: CustomerProfile): Advisory[] {
  const r = rng(`int-adv-${c.id}`);
  const isac = isacName(c);
  // Which estates actually run the affected product (GlobalProtect gateways; on-prem SharePoint).
  const globalProtect: CustomerMap<boolean> = { maritime: true, finserv: false, media: false, healthcare: false, automotive: false, insurance: true, defence: false, pharma: false, sghospital: false, studio: false };
  const sharePoint: CustomerMap<boolean> = { maritime: true, finserv: true, media: false, healthcare: true, automotive: true, insurance: true, defence: false, pharma: true, sghospital: true, studio: false };
  const common: Advisory[] = [
    { id: 'A1', source: 'CISA KEV', title: 'Palo Alto GlobalProtect command injection added to KEV', ref: 'CVE-2024-3400', sev: 'critical', daysAgo: r.int(2, 20), affectsEstate: forCustomer(globalProtect, c), note: 'Internet-facing GlobalProtect; patch within KEV due date.' },
    { id: 'A2', source: 'CISA KEV', title: 'Ivanti Connect Secure RCE exploited in the wild', ref: 'CVE-2025-0282', sev: 'critical', daysAgo: r.int(3, 25), affectsEstate: false, note: 'No Ivanti ICS appliances found in estate.' },
    { id: 'A3', source: 'Vendor', title: 'Microsoft SharePoint "ToolShell" deserialisation RCE', ref: 'CVE-2025-53770', sev: 'critical', daysAgo: r.int(1, 10), affectsEstate: forCustomer(sharePoint, c), note: 'On-prem SharePoint; verify exposure and patch.' },
    { id: 'A4', source: 'Sector ISAC', title: `${isac}: active campaign against the sector`, ref: `${isac.split(/[\s/+]/)[0]}-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 7), affectsEstate: true, note: 'Mapped to techniques in your coverage matrix.' },
  ];
  const sector: CustomerMap<Advisory[]> = {
    maritime: [
      { id: 'M1', source: 'Sector ISAC', title: 'Maritime ISAC: GPS/AIS spoofing cluster in a transit chokepoint', ref: 'MAR-2026-044', sev: 'high', daysAgo: r.int(1, 9), affectsEstate: true, note: 'Relevant to vessel navigation integrity (IMO MSC.428).' },
      { id: 'M2', source: 'Vendor', title: 'Rockwell ControlLogix out-of-bounds write advisory', ref: 'CVE-2023-3595', sev: 'high', daysAgo: r.int(10, 40), affectsEstate: true, note: 'Check crane and RTU controllers.' },
    ],
    finserv: [
      { id: 'F1', source: 'Sector ISAC', title: 'FS-ISAC flash: help-desk social-engineering wave on UK banks', ref: 'FS-2026-311', sev: 'high', daysAgo: r.int(1, 6), affectsEstate: true, note: 'Harden help-desk identity verification.' },
      { id: 'F2', source: 'Vendor', title: 'Citrix NetScaler session-token disclosure ("Citrix Bleed")', ref: 'CVE-2023-4966', sev: 'high', daysAgo: r.int(15, 45), affectsEstate: false, note: 'No NetScaler in current inventory.' },
    ],
    media: [
      { id: 'E1', source: 'Sector ISAC', title: 'ME-ISAC: insider-recruitment targeting post-production vendors', ref: 'ME-2026-076', sev: 'high', daysAgo: r.int(1, 8), affectsEstate: true, note: 'Reinforce custody and vendor access controls.' },
      { id: 'E2', source: 'Vendor', title: 'Next.js middleware authorisation bypass', ref: 'CVE-2025-29927', sev: 'high', daysAgo: r.int(5, 30), affectsEstate: true, note: 'Check screener/review portals built on Next.js.' },
    ],
    healthcare: [
      { id: 'H1', source: 'Sector ISAC', title: 'Health-ISAC + HHS HC3: social engineering of hospital IT service desks', ref: `HISAC-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 6), affectsEstate: true, note: 'Callers impersonate clinicians to reset MFA; enforce call-back verification.' },
      { id: 'H2', source: 'Vendor', title: 'Citrix NetScaler session-token disclosure ("Citrix Bleed")', ref: 'CVE-2023-4966', sev: 'high', daysAgo: r.int(15, 45), affectsEstate: true, note: 'citrix.mercyridgehealth.org is patched; confirm old sessions were killed.' },
      { id: 'H3', source: 'Sector ISAC', title: 'CISA medical advisory: patient-monitor central station weaknesses', ref: `ICSMA-26-${r.int(100, 300)}-01`, sev: 'medium', daysAgo: r.int(4, 20), affectsEstate: true, note: 'Matches IntelliVue gateways in Claroty xDome; compensating segmentation in place.' },
    ],
    automotive: [
      { id: 'V1', source: 'Sector ISAC', title: 'Auto-ISAC: infostealer wave against supplier-portal and OTA users', ref: `AUTOISAC-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 6), affectsEstate: true, note: 'Matches stealer-log sessions for ota.vireoconnect.com in Credential Exposure.' },
      { id: 'V2', source: 'Vendor', title: 'Fortinet FortiOS SSL-VPN out-of-bounds write exploited', ref: 'CVE-2024-21762', sev: 'critical', daysAgo: r.int(8, 30), affectsEstate: true, note: 'Puebla plant gateway still on an affected build; patch window agreed.' },
      { id: 'V3', source: 'Vendor', title: 'Siemens ProductCERT advisory for S7-1500 CPU firmware', ref: `SSA-${r.int(100000, 999999)}`, sev: 'medium', daysAgo: r.int(5, 25), affectsEstate: true, note: 'Press-line PLCs in Ingolstadt; OT is read-only, raised to plant engineering.' },
    ],
    insurance: [
      { id: 'I1', source: 'Sector ISAC', title: 'FS-ISAC insurance community: service-desk vishing wave against US carriers', ref: `FSISAC-INS-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 6), affectsEstate: true, note: 'Callers impersonate adjusters to reset Okta MFA; enforce call-back and manager approval.' },
      { id: 'I2', source: 'Vendor', title: 'Managed-file-transfer pre-auth flaw under mass exploitation', ref: 'CVE-2026-21487', sev: 'critical', daysAgo: r.int(3, 18), affectsEstate: true, note: 'mft.kingsbridgemutual.com runs an affected build; patched in the emergency window, logs under review for NYDFS 500.17.' },
      { id: 'I3', source: 'Vendor', title: 'Guidewire Cloud security bulletin: API token scope hardening', ref: `GW-SB-2026-${r.int(10, 99)}`, sev: 'medium', daysAgo: r.int(6, 30), affectsEstate: true, note: 'Re-scope ClaimCenter integration tokens used by CCC and One Inc.' },
    ],
    defence: [
      { id: 'D1', source: 'Sector ISAC', title: 'DC3 DCISE + ND-ISAC: state actors targeting DIB engineers with fake recruiter lures', ref: `DCISE-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 6), affectsEstate: true, note: 'Indicators pushed to Sentinel and Defender XDR (GCC High); brief engineering and the FSO.' },
      { id: 'D2', source: 'CISA KEV', title: 'Cisco ISE unauthenticated remote code execution', ref: 'CVE-2025-20281', sev: 'critical', daysAgo: r.int(6, 28), affectsEstate: true, note: 'Two ISE nodes front the engineering and Building 3 NAC; patched, POA&M entry closed in HexaComply.' },
      { id: 'D3', source: 'Vendor', title: 'Siemens Teamcenter access-control advisory', ref: `SSA-${r.int(100000, 999999)}`, sev: 'medium', daysAgo: r.int(5, 25), affectsEstate: true, note: 'ITAR item-level access in Teamcenter; verify ACLs and audit export-controlled item reads.' },
    ],
    pharma: [
      { id: 'P1', source: 'Sector ISAC', title: 'Health-ISAC + NCSC Switzerland: APT41 activity against biologics process development', ref: `HISAC-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 7), affectsEstate: true, note: 'Matches R&D share access patterns; indicators pushed to Sentinel and CrowdStrike.' },
      { id: 'P2', source: 'Vendor', title: 'Emerson DeltaV workstation privilege-escalation advisory', ref: `ICSA-26-${r.int(100, 300)}-02`, sev: 'medium', daysAgo: r.int(5, 25), affectsEstate: true, note: 'Valais DeltaV operator stations; patch through GxP change control, Claroty compensating monitoring in place.' },
      { id: 'P3', source: 'Vendor', title: 'Siemens SIMATIC PCS 7 / WinCC advisory', ref: `SSA-${r.int(100000, 999999)}`, sev: 'medium', daysAgo: r.int(8, 35), affectsEstate: true, note: 'PCS 7 engineering stations in Valais; vendor-validated patch scheduled for the next shutdown.' },
    ],
    sghospital: [
      { id: 'S1', source: 'Sector ISAC', title: 'CSA SingCERT + MOH: ransomware groups targeting Singapore healthcare', ref: `SingCERT-AL-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 6), affectsEstate: true, note: 'Indicators pushed to Sentinel and CrowdStrike; MOH 2-hour notification playbook rehearsed.' },
      { id: 'S2', source: 'Vendor', title: 'Fortinet FortiOS SSL-VPN heap overflow exploited', ref: 'CVE-2024-21762', sev: 'critical', daysAgo: r.int(8, 30), affectsEstate: true, note: 'Punggol day-surgery FortiGate was on an affected build; patched and sessions reset.' },
      { id: 'S3', source: 'Sector ISAC', title: 'CISA medical advisory: infusion pump server weaknesses', ref: `ICSMA-26-${r.int(100, 300)}-01`, sev: 'medium', daysAgo: r.int(4, 20), affectsEstate: true, note: 'Matches the BD Alaris server (OBH-ALARIS-SRV) in Claroty xDome; HSA GL-04 vendor patch requested.' },
    ],
    studio: [
      { id: 'T1', source: 'Sector ISAC', title: 'ME-ISAC: vishing campaign against studio SaaS tenants and vendor help desks', ref: `ME-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 6), affectsEstate: true, note: 'Matches Okta reset attempts at two VFX vendors; enforce call-back verification.' },
      { id: 'T2', source: 'Vendor', title: 'Next.js middleware authorisation bypass', ref: 'CVE-2025-29927', sev: 'high', daysAgo: r.int(5, 30), affectsEstate: true, note: 'screeners.starfallent.com and the press site run Next.js; both patched.' },
      { id: 'T3', source: 'Vendor', title: 'Rockwell GuardLogix safety controller advisory', ref: `ICSA-26-${r.int(100, 300)}-04`, sev: 'medium', daysAgo: r.int(6, 28), affectsEstate: true, note: 'Ride-control PLCs at Orlando; safety-rated zones are isolated, patch during the annual ride rehab.' },
    ],
  };
  return [...common, ...forCustomer(sector, c)];
}

export function isacName(c: CustomerProfile): string {
  const m: CustomerMap<string> = {
    maritime: 'Maritime ISAC', finserv: 'FS-ISAC', media: 'ME-ISAC', healthcare: 'Health-ISAC', automotive: 'Auto-ISAC',
    insurance: 'FS-ISAC', defence: 'ND-ISAC / DIB CS (DC3)', pharma: 'Health-ISAC + NCSC Switzerland', sghospital: 'Health-ISAC / CSA SingCERT / Synapxe', studio: 'ME-ISAC',
  };
  return forCustomer(m, c);
}

export interface IocStat {
  type: string;
  ingested: number;
  sightings: number;
}
export function iocStats(c: CustomerProfile, tenantId = 'all'): { total: number; sightings: number; byType: IocStat[] } {
  const r = rng(`int-ioc-${c.id}-${tenantId}`);
  const taxii = taxiiOf(c);
  const base = taxii?.records ?? 30000;
  const dist: { type: string; w: number; sw: number }[] = [
    { type: 'IP address', w: 0.3, sw: 0.5 },
    { type: 'Domain', w: 0.26, sw: 0.22 },
    { type: 'URL', w: 0.18, sw: 0.12 },
    { type: 'File hash', w: 0.16, sw: 0.1 },
    { type: 'Email / sender', w: 0.07, sw: 0.04 },
    { type: 'TTP / intrusion set', w: 0.03, sw: 0.02 },
  ];
  let total = 0;
  let sightings = 0;
  const byType = dist.map((d) => {
    const ingested = Math.round(base * d.w * r.float(0.85, 1.15, 2));
    const s = Math.max(0, Math.round(ingested * 0.01 * d.sw * r.float(0.6, 1.6, 2)));
    total += ingested;
    sightings += s;
    return { type: d.type, ingested, sightings: s };
  });
  return { total, sightings, byType };
}

export interface SectorBriefItem {
  heading: string;
  body: string;
}
export function sectorBrief(c: CustomerProfile): { week: string; items: SectorBriefItem[] } {
  const isac = isacName(c);
  const map: CustomerMap<SectorBriefItem[]> = {
    healthcare: [
      { heading: 'Ransomware', body: 'Rhysida and Qilin remain the leading threats to US hospitals; 9 sector victims posted in 90 days, several with ambulance diversion.' },
      { heading: 'Identity', body: 'Service-desk social engineering for MFA resets continues; patient-portal and Citrix sessions keep appearing in stealer logs.' },
      { heading: 'Third parties', body: 'Clearinghouse, pathology and scheduling vendors are the soft underbelly; review BAAs and interface credentials.' },
      { heading: 'Recommendation', body: 'Rehearse EHR downtime, enforce call-back MFA resets and close the Citrix session exposure.' },
    ],
    automotive: [
      { heading: 'Ransomware', body: 'Akira and Black Basta are hitting Tier 1 and Tier 2 suppliers; supplier outages stop JIT/JIS lines within hours.' },
      { heading: 'Dealers', body: 'Dealer-management SaaS remains a single point of failure for sales and service after the 2024 outage.' },
      { heading: 'Connected vehicles', body: 'Supplier engineers with OTA and PLM portal access are prime stealer-log targets; API scraping of vehicle apps rising.' },
      { heading: 'Recommendation', body: 'Bind supplier sessions to managed devices, test the dealer fallback and patch plant VPN gateways.' },
    ],
    maritime: [
      { heading: 'Ransomware', body: 'LockBit affiliates remain the leading threat to ports and logistics; 6 sector victims posted in 90 days.' },
      { heading: 'OT / ICS', body: 'Continued probing of internet-exposed PLCs and remote-access gateways by state-aligned actors.' },
      { heading: 'Navigation', body: 'Elevated GPS/AIS interference reported in two transit chokepoints; monitor integrity alarms.' },
      { heading: 'Recommendation', body: 'Prioritise KEV patching of terminal VPN gateways and re-validate vessel remote-access detections.' },
    ],
    finserv: [
      { heading: 'Social engineering', body: 'Scattered-Spider-style help-desk resets continue against UK banks; verify identity proofing.' },
      { heading: 'Supply chain', body: 'MFT mass-exploitation (Cl0p) still driving third-party data theft in finance.' },
      { heading: 'Fraud', body: 'Card-shop activity referencing issuer BIN ranges; coordinate with fraud operations.' },
      { heading: 'Recommendation', body: 'Harden help-desk verification and complete DORA third-party access reviews.' },
    ],
    media: [
      { heading: 'Content leaks', body: 'Pre-release brokers actively recruiting studio and vendor insiders; leak-forum chatter up.' },
      { heading: 'Extortion', body: 'LAPSUS$-style crews using MFA fatigue and data-theft extortion against media.' },
      { heading: 'Vendors', body: 'Akira and ShinyHunters hitting post-production and cloud-storage providers.' },
      { heading: 'Recommendation', body: 'Reinforce custody on high-value titles and tighten vendor review-link controls.' },
    ],
    insurance: [
      { heading: 'Social engineering', body: 'Service-desk vishing against US carriers continues; callers pose as adjusters and agents to reset MFA.' },
      { heading: 'Payments fraud', body: 'BEC crews are redirecting claim payments to body shops and contractors; payee bank changes are the weak point.' },
      { heading: 'Third parties', body: 'MFT exploitation and claims-platform vendors keep exposing policyholder data; NAIC #668 and NYDFS 500.17 notice clocks apply.' },
      { heading: 'Recommendation', body: 'Enforce call-back on payee changes in ClaimCenter, patch the MFT host and bind AgentHub sessions to managed devices.' },
    ],
    defence: [
      { heading: 'Espionage', body: 'APT40 and APT41 are targeting guidance and avionics engineers with fake recruiter approaches and edge-device exploits.' },
      { heading: 'Pre-positioning', body: 'Volt Typhoon living-off-the-land activity in US critical infrastructure; DIB networks with OT are in scope.' },
      { heading: 'Supply chain', body: 'Sub-tier machine shops are being ransomed and their drawings published; flow-down of DFARS 7012 incident reporting matters.' },
      { heading: 'Recommendation', body: 'Keep CUI inside GCC High, watch Teamcenter ITAR exports and rehearse the 72-hour DIBNet report.' },
    ],
    pharma: [
      { heading: 'Espionage', body: 'APT41 tasking seeks biologics process and formulation IP; APT29 continues cloud-identity attacks on research tenants.' },
      { heading: 'Ransomware', body: 'Black Basta and Qilin are hitting CDMOs and labs; batch release and QC are the operational choke points.' },
      { heading: 'Clinical data', body: 'CRO data transfers and partner-portal sessions are the main exposure for trial data and unblinding keys.' },
      { heading: 'Recommendation', body: 'Watch tech-transfer packs in HexaCustody, rehearse the NIS2 24-hour early warning and bind CRO access to managed devices.' },
    ],
    sghospital: [
      { heading: 'Ransomware', body: 'Qilin and LockBit affiliates are active against Southeast Asian hospitals and labs; imaging and LIS are prime targets.' },
      { heading: 'State actors', body: 'UNC3886 and Mustang Panda remain focused on Singapore critical infrastructure and regional healthcare.' },
      { heading: 'Medical devices', body: 'Legacy imaging consoles and pump servers stay the soft spot; HSA GL-04 patches lag vendor releases.' },
      { heading: 'Recommendation', body: 'Rehearse the MOH 2-hour notification, monitor TrakCare privacy with FairWarning and close Citrix session exposure.' },
    ],
    studio: [
      { heading: 'Content leaks', body: 'Pre-release brokers are buying VFX and dubbing vendor access; awards screeners are the most-requested items.' },
      { heading: 'Extortion', body: 'ShinyHunters and Scattered Spider are vishing into SaaS tenants and resort operators.' },
      { heading: 'Consumers', body: 'Starfall+ account-checker configs and fake StarPass ticket sales are circulating on fraud forums.' },
      { heading: 'Recommendation', body: 'Tighten vendor review links, keep ride control isolated and prepare SEC 8-K materiality evidence early.' },
    ],
  };
  return { week: `Week ${isoWeek()}, ${isac} + HexaInt`, items: forCustomer(map, c) };
}
function isoWeek(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

/* =====================================================================
   Credential & executive exposure
   One generator builds the infected machines AND the credential records so
   every count on the Overview, Exposure and drawers agrees with headlines().
   ===================================================================== */
export interface StealerMachine {
  id: string;
  malware: 'Lumma' | 'RedLine' | 'Vidar' | 'StealC' | 'Raccoon';
  host: string;
  managed: boolean;
  owner: string;
  country: string;
  lat: number;
  lon: number;
  corpAccounts: number;
  credCount: number;
  ssoCookies: boolean;
  avPresent: boolean;
  capturedDays: number;
  tenantId: string;
}
export type CredSource = 'Infostealer' | 'Combolist';
export const CRED_RESPONSES = ['Reset forced', 'Investigating', 'No action — personal service'] as const;
export type CredResponse = (typeof CRED_RESPONSES)[number];
export interface ExposedCred {
  id: string;
  account: string;
  privileged: boolean;
  machineId: string | null;
  machine: string | null;
  country: string | null;
  usedOn: string;
  appKind: 'Corporate' | 'Third-party SaaS' | 'Personal';
  source: CredSource;
  foundDays: number;
  stolenDays: number;
  response: CredResponse;
  tenantId: string;
}

const GEO: { country: string; lat: number; lon: number }[] = [
  { country: 'Netherlands', lat: 52.1, lon: 5.1 },
  { country: 'United Kingdom', lat: 51.5, lon: -0.1 },
  { country: 'India', lat: 19.0, lon: 72.8 },
  { country: 'Brazil', lat: -23.5, lon: -46.6 },
  { country: 'Philippines', lat: 14.6, lon: 121.0 },
  { country: 'United States', lat: 39.9, lon: -83.0 },
  { country: 'Malaysia', lat: 3.1, lon: 101.7 },
  { country: 'Spain', lat: 40.4, lon: -3.7 },
  { country: 'Nigeria', lat: 6.5, lon: 3.4 },
  { country: 'Singapore', lat: 1.35, lon: 103.8 },
  { country: 'Germany', lat: 50.1, lon: 10.4 },
  { country: 'Poland', lat: 52.2, lon: 21.0 },
  { country: 'Belgium', lat: 51.2, lon: 4.4 },
  { country: 'Hungary', lat: 47.5, lon: 19.0 },
  { country: 'Mexico', lat: 19.4, lon: -99.1 },
  { country: 'Canada', lat: 43.7, lon: -79.4 },
  { country: 'Italy', lat: 45.5, lon: 9.2 },
  { country: 'Vietnam', lat: 21.0, lon: 105.8 },
  { country: 'Switzerland', lat: 47.0, lon: 7.9 },
  { country: 'Ireland', lat: 52.5, lon: -7.6 },
  { country: 'Japan', lat: 34.7, lon: 135.5 },
  { country: 'Indonesia', lat: -6.2, lon: 106.8 },
];
const HOME_GEO: CustomerMap<[string, number][]> = {
  maritime: [['Netherlands', 9], ['Belgium', 5], ['Singapore', 4], ['Brazil', 4], ['Philippines', 4], ['India', 2], ['Poland', 1]],
  finserv: [['United Kingdom', 10], ['India', 4], ['Poland', 2], ['Singapore', 2], ['United States', 2], ['Spain', 1], ['Nigeria', 1]],
  media: [['United States', 8], ['United Kingdom', 6], ['Canada', 3], ['India', 2], ['Brazil', 1], ['Spain', 1]],
  healthcare: [['United States', 14], ['India', 3], ['Philippines', 3], ['Canada', 1], ['Mexico', 1], ['Vietnam', 1]],
  automotive: [['Germany', 9], ['Hungary', 5], ['Mexico', 5], ['Poland', 3], ['India', 2], ['Italy', 2], ['United States', 2], ['Brazil', 1]],
  insurance: [['United States', 15], ['India', 4], ['Philippines', 3], ['Mexico', 1], ['Canada', 1]],
  defence: [['United States', 12], ['Mexico', 1]],
  pharma: [['Switzerland', 8], ['Ireland', 5], ['United States', 5], ['India', 3], ['Germany', 2], ['Poland', 1], ['Italy', 1]],
  sghospital: [['Singapore', 12], ['Malaysia', 4], ['India', 3], ['Philippines', 2], ['Indonesia', 2]],
  studio: [['United States', 12], ['United Kingdom', 5], ['Japan', 4], ['Canada', 3], ['India', 2], ['Spain', 1]],
};
const SURNAMES: CustomerMap<string[]> = {
  maritime: ['vermeer', 'okafor', 'lindqvist', 'marino', 'petrov', 'dekker', 'santos', 'tan', 'reyes', 'jansen', 'devries', 'costa'],
  finserv: ['hughes', 'patel', 'clarke', 'khan', 'morgan', 'osei', 'fraser', 'walsh', 'nowak', 'chen', 'bell', 'reid'],
  media: ['rivera', 'cohen', 'blake', 'ito', 'nash', 'ford', 'greene', 'park', 'diaz', 'quinn', 'lowe', 'shah'],
  healthcare: ['miller', 'johnson', 'garcia', 'brooks', 'kim', 'reyes', 'patel', 'hayes', 'cruz', 'nguyen', 'turner', 'ward'],
  automotive: ['mueller', 'schmidt', 'fischer', 'weber', 'kovacs', 'horvath', 'garcia', 'lopez', 'wagner', 'becker', 'szabo', 'hoffmann'],
  insurance: ['sullivan', 'murphy', 'jackson', 'nguyen', 'rossi', 'oconnor', 'patel', 'harris', 'baker', 'mitchell', 'flores', 'lindgren'],
  defence: ['hollis', 'pruett', 'barnes', 'mccoy', 'tate', 'jenkins', 'crawford', 'ellis', 'fowler', 'gaines', 'randall', 'sims'],
  pharma: ['mueller', 'favre', 'zimmermann', 'bonvin', 'kellerhals', 'byrne', 'murphy', 'oconnell', 'kelly', 'sullivan', 'brennan', 'carter'],
  sghospital: ['tan', 'lim', 'ng', 'wong', 'chua', 'goh', 'abdullah', 'rahman', 'ismail', 'kumar', 'pillai', 'subramaniam'],
  studio: ['morgan', 'castillo', 'bennett', 'hughes', 'fletcher', 'yamamoto', 'sato', 'nakamura', 'reed', 'okafor', 'shaw', 'kimura'],
};
const FUNCTIONAL: CustomerMap<string[]> = {
  maritime: ['finance', 'helpdesk', 'crewing', 'gate-ops'],
  finserv: ['treasury-ops', 'servicedesk', 'payments-support', 'kyc-team'],
  media: ['post-coord', 'servicedesk', 'publicity', 'screeners'],
  healthcare: ['servicedesk', 'pharmacy', 'revcycle', 'radiology-pacs', 'nursing-float'],
  automotive: ['servicedesk', 'dealer-support', 'ota-release', 'supplier-quality', 'plant-it-gyor'],
  insurance: ['servicedesk', 'claims-payments', 'agency-support', 'premium-billing', 'siu-intake'],
  defence: ['servicedesk', 'subcontracts', 'b3-dnc-admin', 'range-ops'],
  pharma: ['servicedesk', 'qa-batch-release', 'gmp-it-valais', 'pv-intake', 'cro-liaison'],
  sghospital: ['servicedesk', 'pharmacy', 'patient-billing', 'radiology-pacs', 'biomed'],
  studio: ['servicedesk', 'screeners', 'post-coord-ldn', 'plus-support', 'ride-ops-orlando'],
};
/** Where the stolen logins were used: corporate apps first, then sector SaaS, then personal sites. */
function credApps(c: CustomerProfile): { app: string; kind: ExposedCred['appKind']; w: number }[] {
  const corp = c.vocab.externalHosts.filter((h) => !/^www\.|careers|press/.test(h)).slice(0, 4).map((app, i) => ({ app, kind: 'Corporate' as const, w: 6 - i }));
  const sector: CustomerMap<string[]> = {
    maritime: ['navis.com (N4 TOS portal)', 'inttra.com', 'kongsberg.com (K-Fleet)'],
    finserv: ['swift.com', 'bloomberg.com', 'workday.com'],
    media: ['frame.io', 'box.com', 'pix.com'],
    healthcare: ['userweb.epic.com', 'availity.com', 'workday.com', 'ukg.com (timeclock)'],
    automotive: ['supplier gateway (PLM)', 'service.ariba.com', 'dealercore-dms.com', '3dexperience.3ds.com'],
    insurance: ['guidewire.net (ClaimCenter)', 'ccc-one.com', 'oneinc.com (payments)', 'lexisnexis.com (risk)'],
    defence: ['exostar.com (MAG)', 'preveil.com', 'costpointgovcloud.com', 'piee.eb.mil (vendor)'],
    pharma: ['veevavault.com', 'imedidata.com (Rave)', 'iqvia.com (partner portal)', 'workday.com'],
    sghospital: ['nehr portal (Synapxe)', 'carelink-telehealth.sg', 'workday.com', 'corppass.gov.sg'],
    studio: ['frame.io', 'asperafiles.com', 'signiant.com (Media Shuttle)', 'moxion.io'],
  };
  const idp = idpOf(c);
  const sso = idp?.vendor === 'Okta' ? 'okta.com' : 'login.microsoftonline.com';
  return [
    { app: sso, kind: 'Corporate', w: 14 },
    ...corp,
    ...forCustomer(sector, c).map((app) => ({ app, kind: 'Third-party SaaS' as const, w: 4 })),
    { app: 'accounts.google.com', kind: 'Third-party SaaS', w: 5 },
    { app: 'github.com', kind: 'Third-party SaaS', w: 3 },
    { app: 'atlassian.net', kind: 'Third-party SaaS', w: 3 },
    { app: 'salesforce.com', kind: 'Third-party SaaS', w: 2 },
    { app: 'dropbox.com', kind: 'Third-party SaaS', w: 2 },
    { app: 'linkedin.com', kind: 'Personal', w: 3 },
    { app: 'netflix.com', kind: 'Personal', w: 1 },
  ];
}

const LETTERS = 'abcdefghjklmnprstw';

export function credExposure(c: CustomerProfile, tenantId = 'all'): { machines: StealerMachine[]; creds: ExposedCred[] } {
  const r = rng(`int-cred-${c.id}-${tenantId}`);
  const h = headlines(c, tenantId);
  const tenants = scopedTenants(c, tenantId);
  const total = h.int.exposedCredentials;
  const nMach = h.int.stealerMachines;
  const dom = c.domain;
  const pfx = c.vocab.hostPrefix;
  const geoW = forCustomer(HOME_GEO, c);
  // accounts
  const named = [...c.people.staff.map((p) => p.email), c.people.socLead.email, c.people.admin.email];
  const nAcc = Math.max(4, Math.round(total / 4.2));
  const accounts: { email: string; privileged: boolean; tenantId: string }[] = [];
  const sur = forCustomer(SURNAMES, c);
  const fn = forCustomer(FUNCTIONAL, c);
  for (let i = 0; i < nAcc; i++) {
    let email: string;
    if (i % 3 === 2 && Math.floor(i / 3) < fn.length) email = `${fn[Math.floor(i / 3)]}@${dom}`;
    else if (i % 2 === 0 && i < named.length) email = named[i];
    else email = `${LETTERS[r.int(0, LETTERS.length - 1)]}.${sur[i % sur.length]}${i >= sur.length ? Math.floor(i / sur.length) + 1 : ''}@${dom}`;
    if (accounts.some((a) => a.email === email)) email = `${LETTERS[r.int(0, LETTERS.length - 1)]}.${sur[(i + 5) % sur.length]}${i}@${dom}`;
    const local = email.split('@')[0];
    accounts.push({ email, privileged: r.chance(0.14) || /servicedesk|helpdesk|ota-release|plant-it|claims-payments|dnc-admin|gmp-it|biomed|ride-ops/.test(local), tenantId: tenants[i % tenants.length].id });
  }
  // machines
  const families: StealerMachine['malware'][] = ['Lumma', 'RedLine', 'Vidar', 'StealC', 'Raccoon'];
  const machines: StealerMachine[] = [];
  for (let i = 0; i < nMach; i++) {
    const country = r.weighted(geoW);
    const g = GEO.find((x) => x.country === country) ?? GEO[0];
    const owner = accounts[(i * 3) % accounts.length];
    const managed = r.chance(0.45);
    const initials = owner.email.split('@')[0].replace(/[^a-z]/g, '').slice(0, 7).toUpperCase();
    machines.push({
      id: `SM-${String(2000 + i)}`,
      malware: r.weighted([[families[0], 5], [families[1], 4], [families[2], 3], [families[3], 3], [families[4], 1]]),
      host: managed ? `${pfx}-LT-${String(r.int(10, 9999)).padStart(4, '0')}` : r.chance(0.15) ? `KIOSK-${r.pick(['RECEPTION', 'LOBBY', 'GATE', 'FLOOR2'])}` : `HOME-PC-${initials}`,
      managed,
      owner: owner.email,
      country: g.country,
      lat: g.lat + r.float(-1.2, 1.2, 2),
      lon: g.lon + r.float(-1.2, 1.2, 2),
      corpAccounts: 0,
      credCount: 0,
      ssoCookies: r.chance(0.46),
      avPresent: managed ? r.chance(0.85) : r.chance(0.35),
      capturedDays: r.int(1, 300),
      tenantId: owner.tenantId,
    });
  }
  // credentials
  const apps = credApps(c);
  const appW = apps.map((a) => [a, a.w] as const);
  const creds: ExposedCred[] = [];
  for (let i = 0; i < total; i++) {
    const stealer = machines.length > 0 && r.chance(0.7);
    const m = stealer ? machines[Math.min(machines.length - 1, Math.floor(Math.pow(r(), 1.6) * machines.length))] : null;
    const acc = (m && r.chance(0.75) ? accounts.find((a) => a.email === m.owner) : undefined) ?? r.pick(accounts);
    const a = r.weighted(appW);
    // more recent finds: skew towards the last few months
    const foundDays = Math.floor(Math.pow(r(), 1.35) * 360);
    const stolenDays = foundDays + (stealer ? r.int(1, 6) : r.int(10, 90));
    const response: CredResponse = a.kind === 'Personal' ? 'No action — personal service' : foundDays <= 10 && r.chance(0.55) ? 'Investigating' : 'Reset forced';
    creds.push({
      id: `CR-${String(5000 + i)}`,
      account: acc.email,
      privileged: acc.privileged,
      machineId: m?.id ?? null,
      machine: m?.host ?? null,
      country: m?.country ?? null,
      usedOn: a.app,
      appKind: a.kind,
      source: stealer ? 'Infostealer' : 'Combolist',
      foundDays,
      stolenDays,
      response,
      tenantId: m?.tenantId ?? acc.tenantId,
    });
  }
  creds.sort((x, y) => x.foundDays - y.foundDays);
  for (const m of machines) {
    const mine = creds.filter((k) => k.machineId === m.id);
    m.credCount = mine.length;
    m.corpAccounts = new Set(mine.map((k) => k.account)).size;
  }
  return { machines, creds };
}

export function stealerMachines(c: CustomerProfile, tenantId = 'all'): StealerMachine[] {
  return credExposure(c, tenantId).machines;
}

/** Credentials found per month by source, built from the credential records. */
export function credsPerMonth(c: CustomerProfile, tenantId: string): { labels: string[]; stealer: number[]; combo: number[]; total: number } {
  const { creds } = credExposure(c, tenantId);
  const labels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const dd = new Date();
    dd.setDate(1);
    dd.setMonth(dd.getMonth() - i);
    labels.push(dd.toLocaleDateString('en-GB', { month: 'short' }));
  }
  const stealer = labels.map(() => 0);
  const combo = labels.map(() => 0);
  for (const k of creds) {
    const idx = 11 - Math.min(11, Math.floor(k.foundDays / 30.4));
    if (k.source === 'Infostealer') stealer[idx]++;
    else combo[idx]++;
  }
  return { labels, stealer, combo, total: creds.length };
}

/** Group a list by a key and count, largest first. */
export function tally<T>(rows: T[], key: (r: T) => string | null): { key: string; n: number }[] {
  const m = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
}

export function geoOf(country: string): { lat: number; lon: number } {
  return GEO.find((g) => g.country === country) ?? { lat: 0, lon: 0 };
}

export interface IdpMatch {
  id: string;
  user: string;
  email: string;
  dept: string;
  privileged: boolean;
  source: 'Stealer log' | 'Combolist' | 'Breach dump';
  password: 'Plaintext' | 'Reused' | 'Hashed';
  sessionCookie: boolean;
  mfa: 'Phishing-resistant' | 'App / push' | 'SMS' | 'None';
  risk: Severity;
  tenantId: string;
}
export function idpMatches(c: CustomerProfile, tenantId = 'all'): IdpMatch[] {
  const r = rng(`int-idp-${c.id}-${tenantId}`);
  const idp = idpOf(c);
  const staff = c.people.staff;
  const n = Math.min(10, Math.max(4, Math.round(headlines(c, tenantId).int.exposedCredentials / 12)));
  const depts = ['Finance', 'Operations', 'IT', 'Treasury', 'Payments', 'Post', 'Marketing', 'Service Desk', 'Engineering'];
  const out: IdpMatch[] = [];
  for (let i = 0; i < n; i++) {
    const p = staff[i % staff.length];
    const priv = r.chance(0.35);
    const pw = r.weighted<IdpMatch['password']>([['Plaintext', 4], ['Reused', 4], ['Hashed', 2]]);
    const cookie = r.chance(0.4);
    const mfa = r.weighted<IdpMatch['mfa']>([['Phishing-resistant', 3], ['App / push', 4], ['SMS', 2], ['None', 1]]);
    out.push({
      id: `IM-${String(3000 + i)}`,
      user: i < staff.length ? p.name : `${r.pick(['A.', 'J.', 'S.', 'M.', 'R.'])} ${r.pick(['Khan', 'Smith', 'Mendes', 'Lind', 'Ortega'])}`,
      email: i < staff.length ? p.email : `user${i}@${c.domain}`,
      dept: r.pick(depts),
      privileged: priv,
      source: r.pick(['Stealer log', 'Combolist', 'Breach dump']),
      password: pw,
      sessionCookie: cookie,
      mfa,
      risk: (cookie && pw === 'Plaintext') || (priv && mfa === 'None') ? 'critical' : priv || cookie ? 'high' : pw === 'Hashed' ? 'low' : 'medium',
      tenantId: tenantId === 'all' ? r.pick(c.tenants).id : tenantId,
    });
  }
  // sort worst first
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  out.sort((a, b) => order.indexOf(a.risk) - order.indexOf(b.risk));
  void idp;
  return out;
}

export interface VipExposure {
  name: string;
  role: string;
  riskScore: number;
  personalBreaches: number;
  phoneExposed: boolean;
  homeAddress: boolean;
  impersonationAccounts: number;
  deepfakeRisk: 'High' | 'Medium' | 'Low';
  notes: string;
}
export function vipExposure(c: CustomerProfile): VipExposure[] {
  const r = rng(`int-vip-${c.id}`);
  const vips = [c.people.board, ...c.people.staff.filter((p) => p.vip), c.people.ciso];
  return vips.map((p) => {
    const breaches = r.int(1, 11);
    const phone = r.chance(0.6);
    const home = r.chance(0.3);
    const imp = r.int(0, 4);
    const deep = r.weighted<VipExposure['deepfakeRisk']>([['High', 2], ['Medium', 3], ['Low', 4]]);
    const score = Math.min(98, 28 + breaches * 4 + (phone ? 10 : 0) + (home ? 12 : 0) + imp * 6 + (deep === 'High' ? 14 : deep === 'Medium' ? 7 : 0));
    return {
      name: p.name,
      role: p.role,
      riskScore: score,
      personalBreaches: breaches,
      phoneExposed: phone,
      homeAddress: home,
      impersonationAccounts: imp,
      deepfakeRisk: deep,
      notes: imp > 0 ? `${imp} impersonation profile${imp > 1 ? 's' : ''} on social platforms tracked.` : 'No active impersonation profiles found.',
    };
  });
}

/* =====================================================================
   External attack surface (HexaInt's own outside-in scanner, enriched
   with NVD CVSS and FIRST EPSS). CVE identifiers are fictional demo data.
   ===================================================================== */
export const OWNERSHIP = ['Confirmed', 'Unmanaged — owner unknown', 'Decommission planned'] as const;
export type Ownership = (typeof OWNERSHIP)[number];
export interface SurfaceCve {
  id: string;
  title: string;
  host: string;
  cvss: number;
  epss: number;
  kev: boolean;
  sev: Severity;
}
export interface SurfaceHost {
  id: string;
  host: string;
  ip: string;
  location: string;
  ports: { port: number; svc: string }[];
  cves: SurfaceCve[];
  worst: Severity | null;
  kev: boolean;
  epss: number;
  ownership: Ownership;
  firstSeenDays: number;
  tech: string;
  tenantId: string;
}

interface HostRule { test: RegExp; ports: [number, string][]; vulns: [string, Severity, boolean][]; tech: string }
const HOST_RULES: HostRule[] = [
  { test: /^legacy/, ports: [[80, 'http'], [3389, 'ms-wbt-server']], vulns: [['Remote desktop pre-authentication remote code execution', 'critical', true], ['Unsupported web server with directory listing', 'medium', false]], tech: 'IIS 8.5' },
  { test: /^vpn|citrix|^remote\./, ports: [[443, 'https'], [80, 'http']], vulns: [['Authentication bypass in VPN appliance web interface', 'critical', true], ['Session token disclosure in gateway memory', 'high', false]], tech: 'SSL-VPN appliance' },
  { test: /^files|aspera|sharepoint|^mft|^sftp/, ports: [[443, 'https'], [22, 'ssh'], [3306, 'mysql']], vulns: [['Database service reachable from the public internet', 'critical', false], ['SSH allows password authentication', 'medium', false]], tech: 'Managed file transfer' },
  { test: /^dev|staging/, ports: [[443, 'https'], [8080, 'http-proxy']], vulns: [['Unauthenticated build-job listing in CI server', 'high', false]], tech: 'CI server' },
  { test: /^mail/, ports: [[25, 'smtp'], [587, 'submission'], [443, 'https']], vulns: [['Stored cross-site scripting in webmail message view', 'high', true]], tech: 'Exchange / OWA' },
  { test: /^api|fhir|openbanking/, ports: [[443, 'https']], vulns: [['Broken object-level authorisation on a public API route', 'high', false], ['Verbose error responses disclose framework version', 'low', false]], tech: 'API gateway' },
  { test: /^ota/, ports: [[443, 'https']], vulns: [['Campaign-metadata endpoint exposes build manifests without auth', 'medium', false]], tech: 'OTA backend (CloudFront)' },
  { test: /^mychart|portal|online|booking|screeners|review|connect|dealer|supplier|crew|trade|agents|claims|hcp|patient|tickets|login|^my\./, ports: [[443, 'https']], vulns: [['Outdated TLS configuration and missing security headers', 'medium', false]], tech: 'Customer portal' },
  { test: /^pay|shop/, ports: [[443, 'https']], vulns: [['Third-party script loaded without integrity check on checkout', 'low', false]], tech: 'Hosted storefront' },
  { test: /^gate|live-ingest|telehealth/, ports: [[443, 'https'], [8443, 'https-alt']], vulns: [['Admin console reachable without allow-listing', 'high', false]], tech: 'Edge appliance' },
];
const DEFAULT_RULE: HostRule = { test: /.*/, ports: [[443, 'https']], vulns: [], tech: 'CDN-fronted website' };

export function surfaceHosts(c: CustomerProfile, tenantId = 'all'): SurfaceHost[] {
  const r = rng(`int-surface-${c.id}`);
  const base = c.domain;
  const hosts = [...c.vocab.externalHosts, `legacy-portal.${base}`, `dev-staging.${base}`, `files.${base}`];
  const cloud = c.vocab.cloudAccounts;
  const out: SurfaceHost[] = [];
  hosts.forEach((host, i) => {
    const rule = HOST_RULES.find((x) => x.test.test(host)) ?? DEFAULT_RULE;
    const ownership: Ownership = host.startsWith('legacy') ? 'Decommission planned' : /^(dev|files)/.test(host) ? 'Unmanaged — owner unknown' : r.chance(0.08) ? 'Unmanaged — owner unknown' : 'Confirmed';
    const cl = cloud[i % Math.max(1, cloud.length)];
    const location = /^(vpn|mail|citrix|legacy|gate)/.test(host) ? (host.startsWith('legacy') ? 'On-premise DMZ' : 'On-premise edge') : /^files/.test(host) ? 'Third-party hosting' : /^(pay|shop)/.test(host) ? 'SaaS — hosted storefront' : cl ? `${cl.provider} — ${cl.name}` : 'CDN';
    const cves: SurfaceCve[] = rule.vulns.map(([title, sev, kev]) => {
      const cvss = sev === 'critical' ? r.float(9.0, 9.8, 1) : sev === 'high' ? r.float(7.5, 8.9, 1) : sev === 'medium' ? r.float(5.0, 6.9, 1) : r.float(2.5, 4.4, 1);
      const epss = sev === 'critical' ? r.int(60, 94) : sev === 'high' ? r.int(30, 60) : sev === 'medium' ? r.int(4, 18) : r.int(1, 4);
      return { id: `CVE-2026-${r.int(10200, 29800)}`, title, host, cvss, epss, kev, sev };
    });
    const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
    const worst = cves.length ? cves.map((v) => v.sev).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] : null;
    const tenant = c.tenants.find((t) => host.includes(t.id)) ?? c.tenants[i % c.tenants.length];
    out.push({
      id: `H-${String(100 + i)}`,
      host,
      ip: `${i % 2 ? '203.0.113' : '198.51.100'}.${r.int(10, 250)}`,
      location,
      ports: rule.ports.map(([port, svc]) => ({ port, svc })),
      cves,
      worst,
      kev: cves.some((v) => v.kev),
      epss: cves.length ? Math.max(...cves.map((v) => v.epss)) : 0,
      ownership,
      firstSeenDays: r.int(3, 900),
      tech: rule.tech,
      tenantId: tenant.id,
    });
  });
  return out.filter((h) => tenantId === 'all' || h.tenantId === tenantId);
}

/* =====================================================================
   Supply chain watchlist (outside-in signals on suppliers). All supplier
   names mix real suppliers (from each profile) and fictional ones; contracts live in the HexaComply vendor register.
   ===================================================================== */
export type SupplierFindingKind = 'Leak-site mention' | 'Leaked credentials' | 'Infected machine' | 'Lookalike domain' | 'Vendor breach';
export const SUPPLIER_KIND_COLOR: Record<SupplierFindingKind, string> = {
  'Leak-site mention': '#f8646f', 'Leaked credentials': '#ef6aae', 'Infected machine': '#f5a83d', 'Lookalike domain': '#a07cfb', 'Vendor breach': '#f2643f',
};
export interface SupplierFinding { kind: SupplierFindingKind; title: string; body: string; sev: Severity; source: string; daysAgo: number; count: number }
export interface WatchedSupplier {
  id: string;
  name: string;
  domain: string;
  service: string;
  tier: 'Critical' | 'High' | 'Medium';
  access: string;
  status: 'Exposed' | 'Watch' | 'Clear';
  findings: SupplierFinding[];
  creds: number;
  machines: number;
  mentions: number;
  monitoredSinceDays: number;
  lastCheckedMin: number;
}
type SupSeed = [name: string, domain: string, service: string, tier: WatchedSupplier['tier'], access: string, kinds: SupplierFindingKind[]];
const SUPPLIERS: CustomerMap<SupSeed[]> = {
  maritime: [
    ['BlueWake VSAT', 'bluewake-vsat.com', 'Vessel satellite connectivity', 'Critical', 'Remote management of fleet VSAT terminals', ['Leaked credentials', 'Infected machine', 'Leak-site mention']],
    ['PortGate OCR', 'portgate-ocr.io', 'Gate OCR & truck appointment SaaS', 'Critical', 'API into the terminal operating system', ['Leaked credentials', 'Lookalike domain']],
    ['Harbourline Crewing', 'harbourline-crew.com', 'Crew agency & payroll', 'High', 'Crew HR data, crew portal SSO', ['Vendor breach', 'Leaked credentials']],
    ['Kranservice Nord', 'kranservice-nord.de', 'Crane maintenance contractor', 'High', 'Vendor remote access to crane PLCs (via PAM)', ['Infected machine']],
    ['TideCall EDI', 'tidecall-edi.com', 'Customs & manifest EDI', 'Critical', 'Manifest and customs messages', ['Leak-site mention']],
    ['Meridian Ship Management', 'meridian-shipmgmt.com', 'Third-party ship management', 'High', 'Planned maintenance system access', []],
    ['SeaLedger Accounting', 'sealedger.co', 'Accounting & audit', 'Medium', 'Finance exports', []],
    ['Anchorage Payroll', 'anchorage-payroll.com', 'Shore payroll processor', 'Medium', 'Employee bank details', []],
  ],
  finserv: [
    ['LedgerBridge Payments', 'ledgerbridge.io', 'Payment gateway', 'Critical', 'Card and faster-payments routing', ['Leaked credentials', 'Leak-site mention', 'Infected machine']],
    ['TrustDesk', 'trustdesk.help', 'Help-desk SaaS', 'High', 'Service-desk tickets incl. reset requests', ['Leaked credentials', 'Infected machine']],
    ['Clearwell KYC', 'clearwell-kyc.com', 'KYC & identity verification', 'Critical', 'Customer ID documents', ['Vendor breach']],
    ['CallSphere', 'callsphere-cx.com', 'Outsourced contact centre', 'High', 'Customer account servicing', ['Lookalike domain', 'Leaked credentials']],
    ['Northvault Backup', 'northvault.cloud', 'Cloud backup', 'Critical', 'Encrypted backups of core banking', ['Leak-site mention']],
    ['Lumis Credit Data', 'lumis-credit.com', 'Credit reference data', 'High', 'Bureau lookups', []],
    ['Kinross Print & Mail', 'kinross-print.co.uk', 'Statement print & mail', 'Medium', 'Customer statements', []],
    ['Fairgate Card Services', 'fairgate-cards.com', 'Card personalisation', 'High', 'Card embossing files', []],
  ],
  media: [
    ['PostHouse-3', 'posthouse3.tv', 'Post-production', 'High', 'Locked cuts and dailies', ['Infected machine', 'Leak-site mention']],
    ['FrameVault VFX', 'framevault-vfx.com', 'VFX vendor', 'Critical', 'Pre-release plates and shots', ['Leaked credentials', 'Infected machine']],
    ['SubtitleWorks', 'subtitleworks.net', 'Localisation & subtitling', 'High', 'Scripts and screeners', ['Leaked credentials', 'Lookalike domain']],
    ['ReelSafe Screeners', 'reelsafe.io', 'Screener distribution', 'Critical', 'Awards screeners to voters', ['Vendor breach']],
    ['Cuemaster Audio', 'cuemaster-audio.com', 'Audio post', 'Medium', 'Stems and mixes', ['Leak-site mention']],
    ['StageLight Talent', 'stagelight-talent.com', 'Talent agency', 'Medium', 'Contracts and schedules', []],
    ['Distrib Digital', 'distrib-digital.com', 'Digital delivery (DCP)', 'High', 'Final masters to cinemas', []],
    ['BoxSeat Ticketing', 'boxseat-tix.com', 'Event ticketing', 'Medium', 'Premiere guest lists', []],
  ],
  healthcare: [
    ['ClaimPath EDI', 'claimpath-edi.com', 'Claims clearinghouse', 'Critical', 'Claims and eligibility (837/270)', ['Leak-site mention', 'Leaked credentials']],
    ['TeleMed Partners', 'telemedpartners.com', 'Telehealth platform', 'High', 'Video visits and scheduling API', ['Leaked credentials', 'Infected machine', 'Lookalike domain']],
    ['Synapse Pathology Labs', 'synapse-path.com', 'Reference laboratory', 'Critical', 'HL7 orders and results interface', ['Infected machine']],
    ['MedTranscribe Pro', 'medtranscribe.pro', 'Medical transcription', 'High', 'Dictation audio and notes (ePHI)', ['Leaked credentials', 'Vendor breach']],
    ['CareBridge Staffing', 'carebridge-staffing.com', 'Agency nurse staffing', 'Medium', 'Temporary Epic and badge access', ['Leaked credentials']],
    ['BioServ Clinical Engineering', 'bioserv-ce.com', 'Biomed ISO contractor', 'High', 'Remote service to infusion pumps (via PAM)', []],
    ['Parkline Teleradiology', 'parkline-rad.com', 'After-hours reads', 'High', 'PACS viewer accounts', []],
    ['NorthStar Revenue Partners', 'northstar-rcm.com', 'Billing outsourcing', 'Medium', 'Patient financial data', []],
  ],
  automotive: [
    ['DealerCore DMS', 'dealercore-dms.com', 'Dealer management SaaS', 'Critical', '1,140 dealers, customer and finance data', ['Leak-site mention', 'Leaked credentials']],
    ['TelemaX Connect', 'telemax-connect.com', 'Telematics SIM & MVNO', 'Critical', 'Vehicle connectivity and SIM provisioning', ['Leaked credentials', 'Infected machine']],
    ['Kessler Präzisionsteile', 'kessler-praezision.de', 'Tier 2 machined parts', 'High', 'JIT call-offs and supplier portal', ['Infected machine', 'Leaked credentials']],
    ['AutoVision Design Studio', 'autovision-design.it', 'External design agency', 'High', 'Pre-launch design renders', ['Leaked credentials', 'Lookalike domain']],
    ['RoboServ Instandhaltung', 'roboserv.de', 'Robot maintenance contractor', 'High', 'Vendor remote access to body-shop cells (via PAM)', ['Vendor breach']],
    ['ChargeGrid Mobility', 'chargegrid.eu', 'Charging-network partner', 'Medium', 'Roaming and billing APIs', []],
    ['Stahlwerk Logistik', 'stahlwerk-logistik.de', 'Inbound JIT logistics', 'High', 'Call-off EDI', []],
    ['FinLease Autobank', 'finlease-autobank.de', 'Captive finance partner', 'Medium', 'Customer finance applications', []],
  ],
  insurance: [
    ['One Inc', 'oneinc.com', 'Claims & premium payments platform', 'Critical', 'Claim disbursements and payee bank details', ['Lookalike domain', 'Leaked credentials']],
    ['EXL', 'exlservice.com', 'Claims & policy-servicing BPO', 'Critical', 'Claims handling via Island browser; policyholder PII', ['Leaked credentials', 'Infected machine']],
    ['CCC Intelligent Solutions', 'cccis.com', 'Auto claims estimating (STP)', 'High', 'ClaimCenter integration and photo estimates', ['Leaked credentials']],
    ['Cognizant', 'cognizant.com', 'Application maintenance (Guidewire)', 'High', 'Privileged access via BeyondTrust', ['Infected machine', 'Leaked credentials']],
    ['Majesco', 'majesco.com', 'Life & annuity policy admin', 'High', 'Life policy and beneficiary data', ['Vendor breach']],
    ['Cambridge Mobile Telematics', 'cmtelematics.com', 'Usage-based insurance telematics', 'Medium', 'Driving data feeds to the telematics lake', []],
    ['Broadridge', 'broadridge.com', 'Policyholder print & communications', 'Medium', 'Statements and policy documents', []],
    ['Munich Re', 'munichre.com', 'Reinsurance', 'Medium', 'Bordereaux via MFT', []],
  ],
  defence: [
    ['Cumberland Precision Machining', 'cumberland-precision.com', 'Overflow machining sub-tier', 'Critical', 'Receives TDPs and CNC programmes (via HexaCustody)', ['Leak-site mention', 'Leaked credentials', 'Infected machine']],
    ['Desert Sky Telemetry', 'desertskytelemetry.com', 'Range telemetry services (Tucson)', 'High', 'Test data and range network access', ['Leaked credentials', 'Lookalike domain']],
    ['Valley Anodize & Finishing', 'valleyanodize.com', 'Surface finishing sub-tier', 'High', 'Part drawings (CUI) and travellers', ['Infected machine']],
    ['Exostar', 'exostar.com', 'Supplier identity & collaboration', 'Critical', 'Prime portal access (MAG) and partner data', ['Lookalike domain']],
    ['Haas Automation', 'haascnc.com', 'CNC machine-tool OEM service', 'High', 'Vendor remote access to Building 3 (via BeyondTrust)', []],
    ['Deltek', 'deltek.com', 'Costpoint GovCloud (finance)', 'High', 'DCAA-audited finance and timekeeping', []],
    ['Siemens Digital Industries Software', 'sw.siemens.com', 'Teamcenter PLM vendor', 'High', 'PLM support with ITAR controls', []],
    ['Expeditors International', 'expeditors.com', 'Export freight forwarding', 'Medium', 'Export licences and shipment data', []],
  ],
  pharma: [
    ['Parexel', 'parexel.com', 'Contract research organisation', 'Critical', 'Rave EDC and eTMF access for three studies', ['Leaked credentials', 'Infected machine']],
    ['WuXi AppTec', 'wuxiapptec.com', 'Discovery chemistry & testing', 'High', 'Compound data and assay results', ['Lookalike domain']],
    ['Samsung Biologics', 'samsungbiologics.com', 'Biologics CDMO', 'Critical', 'Tech-transfer packs (via HexaCustody)', ['Leaked credentials']],
    ['Catalent', 'catalent.com', 'Clinical supply & packaging', 'High', 'Clinical labels and randomisation-linked kits', ['Vendor breach']],
    ['Syneos Health', 'syneoshealth.com', 'CRO & commercial services', 'High', 'Site monitoring and HCP data', ['Leaked credentials']],
    ['Körber Pharma', 'koerber-pharma.com', 'PAS-X MES vendor', 'High', 'Vendor remote access to Valais MES (via BeyondTrust)', []],
    ['IQVIA', 'iqvia.com', 'CRO & real-world data', 'Critical', 'Trial data management', []],
    ['DHL Supply Chain', 'dhl.com', 'Cold-chain distribution', 'Medium', 'Serialised shipment data', []],
  ],
  sghospital: [
    ['CareLink Telehealth', 'carelink-telehealth.sg', 'Telehealth & appointment chatbot', 'High', 'Appointment and teleconsult data', ['Leaked credentials', 'Lookalike domain', 'Infected machine']],
    ['Lion City Pathology Laboratories', 'lioncitypath.com.sg', 'Reference laboratory', 'Critical', 'HL7 orders and results interface', ['Infected machine', 'Leaked credentials']],
    ['NCS', 'ncs.co', 'IT managed services', 'High', 'Infrastructure admin (via CyberArk)', ['Leaked credentials']],
    ['Philips', 'philips.com.sg', 'Patient-monitoring vendor service', 'High', 'Remote service to IntelliVue (via Vendor PAM)', []],
    ['GE HealthCare', 'gehealthcare.com', 'CT service & imaging', 'High', 'Remote service to CT scanners', ['Vendor breach']],
    ['InterSystems', 'intersystems.com', 'TrakCare EHR vendor', 'Critical', 'Application support for TrakCare and HealthShare', []],
    ['Synapxe', 'synapxe.sg', 'National HealthTech agency (NEHR)', 'Critical', 'NEHR contribution gateway', []],
    ['Iron Mountain', 'ironmountain.com.sg', 'Records storage & shredding', 'Medium', 'Paper medical records', []],
  ],
  studio: [
    ['Northlight Pixel (Vancouver)', 'northlightpixel.com', 'VFX vendor', 'Critical', 'Lodestar plates and shots via Aspera', ['Leaked credentials', 'Infected machine', 'Lookalike domain']],
    ['Bluebird Dubbing Studios', 'bluebirddubbing.com', 'Dubbing & localisation', 'High', 'Scripts and dub stems via Signiant', ['Leak-site mention', 'Leaked credentials']],
    ['Silverline Trailer Co.', 'silverlinetrailers.com', 'Trailer & marketing editorial', 'High', 'Embargoed trailer cuts', ['Infected machine']],
    ['Indee', 'indee.tv', 'Screener distribution platform', 'Critical', 'Awards screeners to voters', ['Leaked credentials']],
    ['Iyuno', 'iyuno.com', 'Subtitling & localisation', 'High', 'Pre-release masters for subtitling', []],
    ['Company 3', 'company3.com', 'Colour & finishing', 'High', 'Locked cuts and DI', []],
    ['accesso', 'accesso.com', 'Park ticketing & queuing', 'High', 'StarPass ticketing and guest data', ['Vendor breach']],
    ['Intamin', 'intamin.com', 'Ride manufacturer', 'High', 'Vendor remote access to ride control (via CyberArk)', []],
  ],
};
function supplierFinding(r: ReturnType<typeof rng>, kind: SupplierFindingKind, s: SupSeed, c: CustomerProfile): SupplierFinding {
  const [name, domain] = s;
  const n = r.int(2, 9);
  switch (kind) {
    case 'Leak-site mention': return { kind, title: `Named on a ransomware leak site`, body: `A post claims ${r.int(20, 400)} GB of ${name} internal data. No ${c.short} asset referenced yet; HexaSOC is watching for follow-up posts.`, sev: 'high', source: 'Leak-site monitoring', daysAgo: r.int(2, 40), count: 1 };
    case 'Leaked credentials': return { kind, title: `${n} ${name} staff logins in a fresh stealer log`, body: `${Math.min(n, r.int(1, 3))} overlap with a shared portal your teams use. Reset requested from the supplier.`, sev: n > 5 ? 'high' : 'medium', source: 'Corporate credential leaks', daysAgo: r.int(1, 30), count: n };
    case 'Infected machine': return { kind, title: `${name} support machine infected`, body: 'Same log as the leaked logins: the machine that leaked them. The supplier has been asked to reimage it.', sev: 'medium', source: 'Infostealer logs', daysAgo: r.int(1, 30), count: 1 };
    case 'Lookalike domain': return { kind, title: `Lookalike of ${domain} registered`, body: `A domain imitating ${domain} has mail records, the invoice-redirection pattern. Finance alerted to verify bank-detail changes by phone.`, sev: 'medium', source: 'Domain monitoring', daysAgo: r.int(3, 50), count: 1 };
    case 'Vendor breach': return { kind, title: `${name} disclosed a security incident`, body: 'Public disclosure of unauthorised access to account records. No evidence of impact to your tenant; the vendor questionnaire has been reopened in HexaComply.', sev: 'medium', source: 'Public disclosure', daysAgo: r.int(5, 60), count: 1 };
  }
}
export function supplierWatch(c: CustomerProfile): WatchedSupplier[] {
  const r = rng(`int-supply-${c.id}`);
  return forCustomer(SUPPLIERS, c).map((s, i) => {
    const findings = s[5].map((k) => supplierFinding(r, k, s, c)).sort((a, b) => a.daysAgo - b.daysAgo);
    const hasHigh = findings.some((f) => f.sev === 'high' || f.sev === 'critical');
    return {
      id: `SUP-${String(i + 1).padStart(2, '0')}`,
      name: s[0], domain: s[1], service: s[2], tier: s[3], access: s[4],
      status: findings.length === 0 ? 'Clear' : hasHigh || findings.length > 2 ? 'Exposed' : 'Watch',
      findings,
      creds: findings.filter((f) => f.kind === 'Leaked credentials').reduce((n, f) => n + f.count, 0),
      machines: findings.filter((f) => f.kind === 'Infected machine').length,
      mentions: findings.filter((f) => f.kind === 'Leak-site mention' || f.kind === 'Vendor breach').length,
      monitoredSinceDays: r.int(60, 420),
      lastCheckedMin: r.int(5, 240),
    };
  });
}

/* =====================================================================
   Indicators of compromise pushed to the customer's controls.
   IPs use documentation ranges; domains and hashes are fictional.
   ===================================================================== */
export const IOC_TYPES = ['IP', 'Domain', 'URL', 'MD5', 'SHA1', 'SHA256'] as const;
export type IocType = (typeof IOC_TYPES)[number];
export const IOC_THREATS = ['Command and control', 'Phishing', 'Malware delivery', 'Credential theft', 'Anonymiser', 'Reconnaissance'] as const;
export type IocThreat = (typeof IOC_THREATS)[number];
export interface Ioc {
  id: string;
  value: string;
  type: IocType;
  threat: IocThreat;
  desc: string;
  tlp: 'TLP:CLEAR' | 'TLP:GREEN' | 'TLP:AMBER' | 'TLP:AMBER+STRICT';
  hits: number;
  signals: number;
  incidents: number;
  attributedTo: string;
  attrKind: 'Intrusion set' | 'Malware' | 'Infrastructure' | 'Tool' | 'Identity';
  credsTaken: number;
  stealerLogs: number;
  lastSeenMin: number;
  blocked: boolean;
  feed: string;
  pushedTo: string[];
}
interface IocSeed { type: IocType; threat: IocThreat; desc: string; attr: string; kind: Ioc['attrKind']; tlp: Ioc['tlp']; seenP: number; creds?: boolean }
function iocSeeds(c: CustomerProfile): IocSeed[] {
  const a0 = c.vocab.threatActors[0];
  const a1 = c.vocab.threatActors[1] ?? a0;
  const a2 = c.vocab.threatActors[2] ?? a0;
  const sector: CustomerMap<IocSeed[]> = {
    maritime: [
      { type: 'Domain', threat: 'Phishing', desc: 'Crew-portal credential harvesting page themed as a VSAT login', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'IP', threat: 'Reconnaissance', desc: 'Scanner sweeping port-community and TOS login pages', attr: a1, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.8 },
    ],
    finserv: [
      { type: 'URL', threat: 'Phishing', desc: 'OTP-relay page cloning online banking login', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'Domain', threat: 'Credential theft', desc: 'Help-desk themed SSO lure used in reset social engineering', attr: 'Scattered Spider', kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.7, creds: true },
    ],
    media: [
      { type: 'URL', threat: 'Phishing', desc: 'Fake screener-review page harvesting vendor SSO logins', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'Domain', threat: 'Malware delivery', desc: 'Fake "codec pack" download aimed at post-production staff', attr: a1, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.6 },
    ],
    healthcare: [
      { type: 'URL', threat: 'Phishing', desc: 'Payroll-diversion page imitating the clinician self-service portal', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'IP', threat: 'Credential theft', desc: 'Password-spray source against Citrix StoreFront (Health-ISAC shared)', attr: a0, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.95 },
      { type: 'Domain', threat: 'Command and control', desc: 'C2 used by the remote-access tool seen in peer hospital intrusions', attr: a1, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.4 },
    ],
    automotive: [
      { type: 'URL', threat: 'Phishing', desc: 'Supplier-portal login clone sent as a "new JIT call-off" notice', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'Domain', threat: 'Credential theft', desc: 'Stealer-log exfiltration endpoint behind OTA-portal session theft', attr: 'Lumma Stealer', kind: 'Malware', tlp: 'TLP:AMBER', seenP: 0.85, creds: true },
      { type: 'IP', threat: 'Reconnaissance', desc: 'Scraper enumerating vehicle-app API routes (Auto-ISAC shared)', attr: 'API scraping infrastructure', kind: 'Infrastructure', tlp: 'TLP:GREEN', seenP: 0.9 },
    ],
    insurance: [
      { type: 'URL', threat: 'Phishing', desc: 'AgentHub login clone sent to independent agents as a "commission statement"', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'Domain', threat: 'Credential theft', desc: 'Lookalike of the claims-payments provider used to request payee bank changes', attr: 'BEC crew (claims payments)', kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.75, creds: true },
      { type: 'IP', threat: 'Credential theft', desc: 'Credential-stuffing source against the policyholder portal (FS-ISAC shared)', attr: 'Account-takeover infrastructure', kind: 'Infrastructure', tlp: 'TLP:GREEN', seenP: 0.95 },
    ],
    defence: [
      { type: 'URL', threat: 'Phishing', desc: 'Fake recruiter document portal sent to guidance engineers', attr: 'APT40', kind: 'Intrusion set', tlp: 'TLP:AMBER+STRICT', seenP: 0.6, creds: true },
      { type: 'IP', threat: 'Reconnaissance', desc: 'SOHO-router relay node scanning DIB VPN and NAC portals (DC3 DCISE shared)', attr: 'Volt Typhoon', kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.7 },
      { type: 'Domain', threat: 'Phishing', desc: 'Exostar sign-in clone used against supplier-portal users', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER', seenP: 0.8, creds: true },
    ],
    pharma: [
      { type: 'URL', threat: 'Phishing', desc: 'Partner-portal login clone sent to CRO monitors as a "site visit report"', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'Domain', threat: 'Command and control', desc: 'C2 used in espionage against biologics research (NCSC Switzerland shared)', attr: 'APT41', kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.35 },
      { type: 'IP', threat: 'Credential theft', desc: 'Password spray against Entra ID research tenants (Health-ISAC shared)', attr: 'APT29', kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.85 },
    ],
    sghospital: [
      { type: 'URL', threat: 'Phishing', desc: 'Patient bill-payment page cloning the Orchid Bay PayNow flow', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'IP', threat: 'Credential theft', desc: 'Password-spray source against Citrix (CSA SingCERT shared)', attr: a0, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.9 },
      { type: 'Domain', threat: 'Malware delivery', desc: 'Lure-document host themed as an MOH circular', attr: 'Mustang Panda', kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.45 },
    ],
    studio: [
      { type: 'URL', threat: 'Phishing', desc: 'Fake screener-review page harvesting awards-voter and vendor logins', attr: 'This organisation', kind: 'Identity', tlp: 'TLP:AMBER+STRICT', seenP: 0.9, creds: true },
      { type: 'IP', threat: 'Credential theft', desc: 'Account-checker source against Starfall+ sign-in (Akamai shared)', attr: 'Account-takeover infrastructure', kind: 'Infrastructure', tlp: 'TLP:GREEN', seenP: 0.95 },
      { type: 'Domain', threat: 'Malware delivery', desc: 'Trojanised render-plugin download aimed at VFX artists', attr: 'NullBulge', kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.5 },
    ],
  };
  return [
    ...forCustomer(sector, c),
    { type: 'IP', threat: 'Command and control', desc: `C2 node linked to ${a0} tooling`, attr: a0, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.5 },
    { type: 'IP', threat: 'Credential theft', desc: 'Password-spray source in a bulletproof-hosting range', attr: 'Bulletproof hosting AS204915', kind: 'Infrastructure', tlp: 'TLP:GREEN', seenP: 0.85 },
    { type: 'Domain', threat: 'Phishing', desc: 'Staging and credential-harvesting domain', attr: a2, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.6, creds: true },
    { type: 'MD5', threat: 'Malware delivery', desc: 'First-stage dropper', attr: a0, kind: 'Intrusion set', tlp: 'TLP:AMBER', seenP: 0.1 },
    { type: 'SHA256', threat: 'Malware delivery', desc: 'Packed loader variant', attr: 'Loader family (tracked)', kind: 'Malware', tlp: 'TLP:AMBER', seenP: 0.1 },
    { type: 'SHA1', threat: 'Command and control', desc: 'Renamed remote-support tool bundled with the dropper', attr: 'Legitimate remote support suite', kind: 'Tool', tlp: 'TLP:GREEN', seenP: 0.4 },
    { type: 'IP', threat: 'Anonymiser', desc: 'Residential-proxy exit used for sign-in attempts', attr: 'Proxy network', kind: 'Infrastructure', tlp: 'TLP:CLEAR', seenP: 0.7 },
    { type: 'URL', threat: 'Malware delivery', desc: 'Fake browser-update page serving an infostealer', attr: 'Lumma Stealer', kind: 'Malware', tlp: 'TLP:GREEN', seenP: 0.35 },
    { type: 'Domain', threat: 'Reconnaissance', desc: 'Domain used to host a port-scanning toolkit', attr: 'Opportunistic scanners', kind: 'Infrastructure', tlp: 'TLP:CLEAR', seenP: 0.5 },
  ];
}
const RANGE_N: Record<TimeRange, number> = { '24h': 8, '7d': 14, '30d': 22, '90d': 30 };
export function iocFeed(c: CustomerProfile, tenantId: string, tr: TimeRange): Ioc[] {
  const r = rng(`int-iocfeed-${c.id}-${tenantId}-${tr}`);
  const seeds = iocSeeds(c);
  const n = RANGE_N[tr];
  const maxMin = { '24h': 1440, '7d': 10080, '30d': 43200, '90d': 129600 }[tr];
  const siem = siemOf(c);
  const edr = edrOf(c);
  const email = connectorOf(c, 'Email');
  const sase = connectorOf(c, 'SASE');
  const taxii = taxiiOf(c);
  const dom = c.vocab.lookalikeBase.replace(/-/g, '');
  const words = ['update-checker', 'portal-verify', 'sso-auth', 'cdn-static', 'secure-docs', 'invoice-view', 'it-support', 'login-session', 'files-share', 'telemetry-api'];
  const tlds = ['net', 'com', 'info', 'online', 'top', 'site'];
  const out: Ioc[] = [];
  for (let i = 0; i < n; i++) {
    const s = seeds[i % seeds.length];
    const word = words[(i * 3) % words.length];
    const value =
      s.type === 'IP' ? `${r.pick(['203.0.113', '198.51.100', '192.0.2'])}.${r.int(2, 250)}` :
      s.type === 'Domain' ? defang(`${s.attr === 'This organisation' ? `${dom}-${word}` : word}.${r.pick(tlds)}`) :
      s.type === 'URL' ? `hxxps://${s.attr === 'This organisation' ? `${dom}-${word}` : word}[.]${r.pick(tlds)}/${r.pick(['login', 'verify', 'update', 'auth/start'])}` :
      r.hex(s.type === 'MD5' ? 32 : s.type === 'SHA1' ? 40 : 64);
    const seen = r.chance(s.seenP);
    const blocked = s.type === 'MD5' || s.type === 'SHA1' || s.type === 'SHA256' ? !seen || r.chance(0.8) : r.chance(0.7);
    const hits = seen ? r.int(2, s.threat === 'Credential theft' || s.threat === 'Reconnaissance' ? 180 : 60) : 0;
    const credsTaken = s.creds && seen ? r.int(1, 7) : 0;
    const pushedTo = [siem, edr, s.type === 'Domain' || s.type === 'URL' ? email : undefined, s.type !== 'MD5' && s.type !== 'SHA1' && s.type !== 'SHA256' ? sase : undefined]
      .filter((k): k is Connector => Boolean(k)).map((k) => `${k.vendor === 'Generic' ? '' : `${k.vendor} `}${k.product}`);
    out.push({
      id: `IOC-${String(7000 + i)}`,
      value,
      type: s.type,
      threat: s.threat,
      desc: s.desc,
      tlp: s.tlp,
      hits,
      signals: seen ? r.int(1, 3) : 0,
      incidents: seen && hits > 10 ? r.int(1, 3) : 0,
      attributedTo: s.attr === 'This organisation' ? `${c.short} (impersonated)` : s.attr,
      attrKind: s.kind,
      credsTaken,
      stealerLogs: credsTaken ? r.int(20, 240) : 0,
      lastSeenMin: Math.round(Math.pow(r(), 1.4) * maxMin),
      blocked,
      feed: i % 3 === 0 && taxii ? `${isacName(c)} TAXII` : i % 3 === 1 ? 'HexaInt research' : 'Vendor threat intel',
      pushedTo,
    });
  }
  return out.sort((a, b) => b.hits - a.hits);
}

/* =====================================================================
   OSINT updates: incident write-ups, advisories, phishing notes and patch
   priorities published by HexaShield for this customer.
   ===================================================================== */
export const ARTICLE_CATS = ['Incident Report', 'Advisory', 'Phishing', 'Patch Update'] as const;
export type ArticleCat = (typeof ARTICLE_CATS)[number];
export const ARTICLE_COLOR: Record<ArticleCat, string> = { 'Incident Report': '#f8646f', Advisory: '#a07cfb', Phishing: '#f5a83d', 'Patch Update': '#4f8cff' };
export interface ArticleSection { heading: string; paras?: string[]; bullets?: string[] }
export interface Article {
  id: string;
  cat: ArticleCat;
  title: string;
  summary: string;
  daysAgo: number;
  readMin: number;
  author: string;
  sections: ArticleSection[];
  related?: { label: string; to: string };
}
type ArtSeed = Omit<Article, 'id' | 'author'>;

export function osintArticles(c: CustomerProfile): Article[] {
  const edr = edrOf(c);
  const idp = idpOf(c);
  const email = connectorOf(c, 'Email');
  const edrN = edr ? `${edr.vendor} ${edr.product}` : 'your EDR';
  const idpN = idp ? (idp.vendor === 'Microsoft' ? 'Entra ID' : `${idp.vendor} ${idp.product}`) : 'your identity provider';
  const mailN = email ? `${email.vendor} ${email.product}` : 'your email gateway';
  const isac = isacName(c);
  const shared: ArtSeed[] = [
    {
      cat: 'Patch Update', title: 'This month’s patch priorities: browser sandbox escapes first', daysAgo: 6, readMin: 3,
      summary: `Three critical browser vulnerabilities lead the list across ${fmtCount(c.employees)} endpoints; two are on the CISA KEV list.`,
      sections: [
        { heading: 'What to patch first', bullets: ['Chromium-based browsers: sandbox escape and type confusion (KEV-listed)', 'VPN and remote-access appliances on the internet edge', 'Server-side document preview components'] },
        { heading: 'Your estate', paras: [`${edrN} reports the vulnerable browser build on roughly a quarter of managed endpoints; auto-update is pending a restart on most of them.`] },
        { heading: 'Recommendations', bullets: ['Force browser restarts through endpoint management within 72 hours', 'Track the edge appliances in Attack Surface until the KEV due date passes'] },
      ],
      related: { label: 'Open Attack Surface (KEV)', to: '/int/surface?kev=1' },
    },
    {
      cat: 'Phishing', title: 'Phishing kit imitating Microsoft 365 sign-in pages', daysAgo: 41, readMin: 2,
      summary: `A commodity kit with convincing sign-in branding is circulating. ${mailN} and conditional access kept your tenant clean.`,
      sections: [
        { heading: 'What we saw', paras: ['The kit proxies the real sign-in page to capture session cookies, which bypasses push-based MFA. Lures arrived as shared-document and voicemail notifications.'] },
        { heading: 'Actions taken', bullets: [`Kit domains pushed to ${mailN} and web filtering`, `Sign-ins from the kit's hosting ranges blocked in ${idpN}`, 'Two users who clicked had sessions revoked; no token reuse observed'] },
        { heading: 'Recommendations', bullets: ['Move privileged users to phishing-resistant MFA (FIDO2)', 'Keep the report-phish button prominent; 61% of reports arrived within 10 minutes'] },
      ],
      related: { label: 'See pushed indicators', to: '/int/ioc?threat=Phishing' },
    },
  ];
  const sector: CustomerMap<ArtSeed[]> = {
    maritime: [
      { cat: 'Incident Report', title: 'Password spray on the terminal VPN, handled by HexaSOC', daysAgo: 12, readMin: 5, summary: 'A spray against vpn.halcyonports.com followed a temporary firewall change that removed geo-restrictions.', sections: [{ heading: 'Incident details', bullets: ['Automated attempts against common crew and shore usernames', 'Sources already present in the HexaInt indicator feed', 'Root cause: emergency rule opened the VPN to all countries'] }, { heading: 'Actions taken', bullets: ['Sources blocked; the rule was reverted to the approved geo-policy', 'Targeted accounts forced to re-authenticate; MFA verified', 'No successful login observed'] }, { heading: 'Recommendations', bullets: ['Route emergency firewall changes through the SOC notification channel', 'Use the pre-approved remote-access fallback template'] }], related: { label: 'Related credentials', to: '/int/exposure' } },
      { cat: 'Advisory', title: `${isac}: GNSS interference cluster in a transit chokepoint`, daysAgo: 4, readMin: 4, summary: 'Spoofing and jamming reports clustered near a major chokepoint; relevant to fleet navigation integrity.', sections: [{ heading: 'Summary', paras: ['Vessels reported position jumps and AIS anomalies over several days. No cyber intrusion is implied; this is radio-frequency interference.'] }, { heading: 'For your fleet', bullets: ['Brief bridge teams on cross-checking GNSS with radar and visual fixes', 'Log integrity alarms to the fleet SOC via the vessel edge'] }] },
      { cat: 'Advisory', title: 'Ransomware affiliates targeting logistics remote access', daysAgo: 23, readMin: 3, summary: 'Affiliates are buying VPN access to ports and logistics operators; indicators are live across your estate.', sections: [{ heading: 'What changed', paras: ['Access-broker listings for "EU logistics" rose this month. One listing matched Halcyon by profile and is tracked on Brand & Dark Web.'] }, { heading: 'Actions', bullets: ['Indicators pushed to the SIEM and EDR', 'Hunt for the described access completed with no hits'] }], related: { label: 'Open the dark-web item', to: '/int/darkweb?scope=Direct%20mention' } },
    ],
    finserv: [
      { cat: 'Incident Report', title: 'Help-desk social-engineering attempt stopped at call-back', daysAgo: 9, readMin: 4, summary: 'A caller impersonating a treasury user asked for an MFA reset; call-back verification stopped it.', sections: [{ heading: 'Incident details', bullets: ['Caller had the user’s staff ID and manager name from public sources', 'Request came from a new ASN outside the UK', 'Pattern matches the Scattered Spider playbook'] }, { heading: 'Actions taken', bullets: ['Reset refused; user contacted via known number', 'Okta admin-reset alerting tightened', 'Fraud ops briefed'] }], related: { label: 'Related indicators', to: '/int/ioc?threat=Credential%20theft' } },
      { cat: 'Advisory', title: `${isac} flash: card-shop activity referencing issuer BIN ranges`, daysAgo: 5, readMin: 3, summary: 'A card shop advertises batches tagged with BIN ranges that include Aldersgate-issued cards.', sections: [{ heading: 'Assessment', paras: ['Likely third-party skimming, not a CDE compromise. Fraud operations have flagged affected ranges.'] }] },
      { cat: 'Phishing', title: 'OTP-relay kit cloning online banking', daysAgo: 17, readMin: 3, summary: 'A fraud kit relays one-time passcodes in real time from a cloned login.', sections: [{ heading: 'Actions taken', bullets: ['Takedown requested for the cloned page', 'Indicators pushed to Proofpoint and Zscaler', 'Customer-facing warning published'] }], related: { label: 'Lookalike domains', to: '/int/darkweb' } },
    ],
    media: [
      { cat: 'Incident Report', title: 'Review-link replay attempt on the screeners portal', daysAgo: 11, readMin: 4, summary: 'An expired review link was replayed from a new country; custody controls blocked playback.', sections: [{ heading: 'Incident details', bullets: ['Link originated from a vendor review session', 'Watermark identified the vendor seat', 'No content left the platform'] }, { heading: 'Actions taken', bullets: ['Vendor link revoked in HexaCustody', 'Pen-test finding on link binding prioritised'] }], related: { label: 'Open HexaStrike finding', to: '/strike/pentest?sev=critical' } },
      { cat: 'Advisory', title: `${isac}: insider recruitment targeting post-production vendors`, daysAgo: 6, readMin: 3, summary: 'Leak brokers are soliciting studio and vendor staff for pre-release material.', sections: [{ heading: 'What to do', bullets: ['Remind post teams of reporting channels', 'Raise custody monitoring on titles inside 60 days of release'] }] },
      { cat: 'Phishing', title: 'Fake codec-pack lure aimed at editors', daysAgo: 28, readMin: 2, summary: 'Editors received "missing codec" prompts leading to an infostealer download.', sections: [{ heading: 'Actions taken', bullets: ['Download domains blocked', 'Two machines reimaged; credentials reset'] }], related: { label: 'Stealer logs', to: '/int/exposure?source=Infostealer' } },
    ],
    healthcare: [
      { cat: 'Incident Report', title: 'Service-desk MFA reset attempt impersonating a physician', daysAgo: 8, readMin: 5, summary: 'A caller posing as an ED physician asked the service desk to reset MFA; call-back verification stopped it.', sections: [{ heading: 'Incident details', bullets: ['Caller used a real physician’s name and NPI from public directories', 'Call came out of hours, during a busy ED shift change', 'Pattern matches the social engineering in Health-ISAC alerts'] }, { heading: 'Actions taken', bullets: ['Reset refused; physician confirmed via the hospital directory number', `Admin-reset alerts in ${idpN} tightened`, 'Service-desk script updated'] }, { heading: 'Recommendations', bullets: ['Badge-tap or video verification for all MFA resets', 'Brief night-shift service-desk staff'] }], related: { label: 'Related indicators', to: '/int/ioc?threat=Credential%20theft' } },
      { cat: 'Advisory', title: `${isac} + HHS HC3: ransomware groups disrupting pathology and imaging`, daysAgo: 3, readMin: 4, summary: 'Peer hospitals lost lab and imaging services for weeks; indicators are live across your estate.', sections: [{ heading: 'Why it matters', paras: ['Recent attacks hit outsourced pathology providers, forcing blood-product rationing and ambulance diversion at the hospitals they serve.'] }, { heading: 'For Mercy Ridge', bullets: ['Synapse Pathology Labs interface credentials rotated', 'EHR and lab downtime procedures rehearsed this quarter', 'Indicators pushed to Sentinel and CrowdStrike'] }], related: { label: 'Supply chain watchlist', to: '/int/supply' } },
      { cat: 'Phishing', title: 'Payroll-diversion lure imitating clinician self-service', daysAgo: 14, readMin: 3, summary: 'Nurses received "update your direct deposit" emails linking to a clone of the HR portal.', sections: [{ heading: 'Actions taken', bullets: [`Lure domains blocked in ${mailN}`, 'Three users who entered details had sessions revoked and deposits frozen pending checks', 'Payroll now requires call-back for bank changes'] }], related: { label: 'See the lookalike', to: '/int/darkweb' } },
    ],
    automotive: [
      { cat: 'Incident Report', title: 'Supplier engineer’s OTA-portal session found in a stealer log', daysAgo: 7, readMin: 5, summary: 'A Tier 1 engineer’s home laptop leaked sessions for the OTA release portal; no signing access was possible.', sections: [{ heading: 'Incident details', bullets: ['Infostealer on an unmanaged personal device', 'Session cookies for the OTA portal and PLM supplier gateway', 'Account had release-viewer rights only; signing requires HSM operator approval'] }, { heading: 'Actions taken', bullets: [`Sessions revoked in ${idpN}; supplier account re-enrolled`, 'Supplier asked to reimage the device and confirm scope', 'R156 evidence pack updated in HexaComply'] }, { heading: 'Recommendations', bullets: ['Require managed or compliant devices for OTA and PLM supplier access', 'Bind supplier sessions to device certificates'] }], related: { label: 'Open the credential records', to: '/int/exposure?source=Infostealer' } },
      { cat: 'Advisory', title: `${isac}: dealer-software supply-chain attacks`, daysAgo: 4, readMin: 4, summary: 'Attacks on dealer-management SaaS can take sales and service offline across the network.', sections: [{ heading: 'Why it matters', paras: ['A 2024 attack on a dealer-software provider stopped sales at thousands of dealerships for about two weeks.'] }, { heading: 'For Vireo', bullets: ['DealerCore DMS on the supplier watchlist with an open leak-site mention', 'Manual-sales fallback tested with 40 pilot dealers', 'DMS API keys scoped and rotated'] }], related: { label: 'Supply chain watchlist', to: '/int/supply?status=Exposed' } },
      { cat: 'Advisory', title: 'Vehicle-app API scraping wave', daysAgo: 19, readMin: 3, summary: 'Scrapers are enumerating connected-car API routes; the vehicle SOC sees elevated token-replay attempts.', sections: [{ heading: 'Actions taken', bullets: ['Scraper ranges pushed to the API gateway and WAF', 'Rate limits tightened on remote-function endpoints', 'HexaStrike API test scheduled'] }], related: { label: 'Attack surface', to: '/int/surface' } },
    ],
    insurance: [
      { cat: 'Incident Report', title: 'Claims-payment redirection attempt stopped before disbursement', daysAgo: 6, readMin: 5, summary: 'A spoofed body-shop email asked a Charlotte adjuster to change the payee bank account on a large auto claim.', sections: [{ heading: 'Incident details', bullets: ['Sender used a lookalike of the body shop’s domain registered four days earlier', 'Request referenced a real claim number taken from an earlier, legitimate email thread', 'Pattern matches the BEC template seen on a Telegram fraud channel'] }, { heading: 'Actions taken', bullets: [`Message pulled from all mailboxes by ${mailN}`, 'Payee change rejected in ClaimCenter; shop confirmed by phone on file', 'One Inc disbursement held and released to the verified account'] }, { heading: 'Recommendations', bullets: ['Require call-back to a known number for every payee bank change', 'Add a 24-hour hold on first payment to a changed account'] }], related: { label: 'See the lookalike', to: '/int/darkweb?view=domains' } },
      { cat: 'Advisory', title: `${isac}: service-desk vishing wave against US carriers`, daysAgo: 3, readMin: 4, summary: 'Callers posing as adjusters and agents are asking service desks to reset MFA; several carriers saw Okta and VMware takeovers.', sections: [{ heading: 'Why it matters', paras: ['The same crew moved from retail to insurance in 2025; once in Okta they reached hypervisors within hours.'] }, { heading: 'For Kingsbridge', bullets: [`Admin-reset alerts in ${idpN} tightened`, 'Service-desk script now requires manager approval for privileged resets', 'NYDFS 500.17 72-hour notice playbook rehearsed with Legal'] }], related: { label: 'Related indicators', to: '/int/ioc?threat=Credential%20theft' } },
      { cat: 'Phishing', title: 'Commission-statement lure aimed at independent agents', daysAgo: 15, readMin: 3, summary: 'Agents received fake commission statements linking to an AgentHub login clone.', sections: [{ heading: 'Actions taken', bullets: ['Takedown requested for the clone', 'Seven agency sessions revoked and re-enrolled', 'Agency-support bulletin issued to 1,900 agencies'] }], related: { label: 'Credential records', to: '/int/exposure?source=Infostealer' } },
    ],
    defence: [
      { cat: 'Incident Report', title: 'Fake recruiter approach to a guidance engineer', daysAgo: 7, readMin: 5, summary: 'An engineer was invited to a paid "consulting interview" and asked to download a design-challenge document.', sections: [{ heading: 'Incident details', bullets: ['Persona claimed to recruit for a European aerospace firm', 'Document link pointed to a newly registered file-sharing domain', 'Tradecraft matches APT40 reporting from DC3 DCISE'] }, { heading: 'Actions taken', bullets: [`Domain blocked in ${mailN} and Zscaler`, 'Engineer’s endpoint checked by Defender XDR; nothing executed', 'FSO informed; no CUI involved, so no DFARS 7012 report required'] }, { heading: 'Recommendations', bullets: ['Brief engineering on recruiter lures and reporting to the FSO', 'Keep engineers’ public profiles free of programme names'] }], related: { label: 'Related indicators', to: '/int/ioc?threat=Phishing' } },
      { cat: 'Advisory', title: `${isac}: Volt Typhoon relay infrastructure scanning DIB edges`, daysAgo: 4, readMin: 4, summary: 'Compromised home routers are being used to scan VPN and NAC portals at defence suppliers.', sections: [{ heading: 'Why it matters', paras: ['Pre-positioning in networks with OT gives the actor a way to disrupt production later; small suppliers are an easier route in.'] }, { heading: 'For Sentry Peak', bullets: ['Relay IPs pushed to Palo Alto and Sentinel', 'Cisco ISE patched; POA&M updated in HexaComply', 'Building 3 jump host reviewed for unusual sign-ins'] }], related: { label: 'Attack surface', to: '/int/surface' } },
      { cat: 'Advisory', title: 'Sub-tier machine shop ransomed with drawings published', daysAgo: 18, readMin: 3, summary: 'A sub-tier supplier of the type Sentry Peak uses for overflow work had drawings posted on a leak site.', sections: [{ heading: 'Actions taken', bullets: ['TDPs held by Cumberland Precision Machining listed from HexaCustody', 'Supplier asked to confirm scope under the DFARS 7012 flow-down', 'Prime contracting officers briefed'] }], related: { label: 'Supply chain watchlist', to: '/int/supply?status=Exposed' } },
    ],
    pharma: [
      { cat: 'Incident Report', title: 'CRO monitor’s partner-portal session found in a stealer log', daysAgo: 8, readMin: 5, summary: 'A CRO monitor’s infected laptop leaked sessions for the partner portal and Veeva Vault eTMF.', sections: [{ heading: 'Incident details', bullets: ['Infostealer on a CRO-managed laptop outside Rhenara control', 'Sessions for connect.rhenara.com and an eTMF account', 'No unblinded data access possible from the account’s role'] }, { heading: 'Actions taken', bullets: [`Sessions revoked in ${idpN}; account re-enrolled`, 'Rave and eTMF audit trails reviewed; no unusual exports', 'CRO asked to reimage the device under the quality agreement'] }, { heading: 'Recommendations', bullets: ['Require managed devices for CRO access to clinical systems', 'Alert on eTMF bulk downloads by partner accounts'] }], related: { label: 'Open the credential records', to: '/int/exposure?source=Infostealer' } },
      { cat: 'Advisory', title: `${isac}: APT41 tasking against biologics process development`, daysAgo: 3, readMin: 4, summary: 'Espionage actors are seeking cell-line and purification process documents from European manufacturers.', sections: [{ heading: 'Why it matters', paras: ['Process IP for biologics takes years to develop and is hard to protect once copied; tech-transfer packs to CDMOs are a known exposure.'] }, { heading: 'For Rhenara', bullets: ['Tech-transfer pack to Samsung Biologics under HexaCustody watch', 'R&D share bulk-access alerts added in Varonis and Sentinel', 'NIS2 early-warning (24 h) and Swissmedic contacts confirmed'] }], related: { label: 'Threat actors', to: '/int/osint' } },
      { cat: 'Phishing', title: 'Fake GMP audit request aimed at Valais quality staff', daysAgo: 21, readMin: 3, summary: 'Quality staff received a "regulatory inspection pre-read" linking to a credential-harvesting page.', sections: [{ heading: 'Actions taken', bullets: [`Lure domains blocked in ${mailN}`, 'Two users reset; no MES or LIMS access from the sessions', 'GxP data-integrity awareness module re-issued'] }], related: { label: 'See pushed indicators', to: '/int/ioc?threat=Phishing' } },
    ],
    sghospital: [
      { cat: 'Incident Report', title: 'Visiting consultant’s Citrix session found in a stealer log', daysAgo: 5, readMin: 5, summary: 'A visiting consultant’s home PC leaked Citrix cookies and a TrakCare launch link.', sections: [{ heading: 'Incident details', bullets: ['Infostealer on a personal device used for remote reviews', 'Citrix session cookies and saved TrakCare launch link', 'FairWarning showed no unusual record access from the account'] }, { heading: 'Actions taken', bullets: [`Sessions revoked in ${idpN}; MFA re-registered`, 'Assessed against MOH and PDPA thresholds: not a notifiable incident', 'Consultant moved to a managed device via Imprivata'] }, { heading: 'Recommendations', bullets: ['Require device posture for Citrix from personal devices', 'Brief visiting consultants on home-device hygiene'] }], related: { label: 'Open the credential records', to: '/int/exposure?source=Infostealer' } },
      { cat: 'Advisory', title: `${isac}: ransomware groups targeting Singapore healthcare`, daysAgo: 2, readMin: 4, summary: 'Qilin and LockBit affiliates are hitting hospitals and labs in the region; indicators are live across your estate.', sections: [{ heading: 'Why it matters', paras: ['Attacks on lab and imaging providers have forced hospitals in the region to divert patients and run manual processes for weeks.'] }, { heading: 'For Orchid Bay', bullets: ['MOH 2-hour notification decision tree rehearsed', 'Lion City Pathology interface credentials rotated', 'Indicators pushed to Sentinel and CrowdStrike'] }], related: { label: 'Supply chain watchlist', to: '/int/supply' } },
      { cat: 'Phishing', title: 'Fake PayNow bill lure sent to patients', daysAgo: 12, readMin: 3, summary: 'Patients received SMS messages linking to a clone of the Orchid Bay bill-payment page.', sections: [{ heading: 'Actions taken', bullets: ['Takedown requested for the clone', 'Reported to ScamShield and SingCERT', 'Patient-app banner warns that Orchid Bay never sends payment links by SMS'] }], related: { label: 'See the lookalike', to: '/int/darkweb?view=domains' } },
    ],
    studio: [
      { cat: 'Incident Report', title: 'VFX vendor artist’s Aspera session found in a stealer log', daysAgo: 6, readMin: 5, summary: 'An artist at Northlight Pixel leaked sessions for the Starfall Aspera share and Okta.', sections: [{ heading: 'Incident details', bullets: ['Infostealer on a vendor workstation outside Starfall control', 'Session cookies for aspera.starfallent.com and Okta', 'Share scope limited to Lodestar plates batch 58'] }, { heading: 'Actions taken', bullets: [`Sessions revoked in ${idpN}; share keys rotated`, 'Aspera transfer logs reviewed; no downloads after the capture date', 'Vendor asked to reimage the workstation under the TPN agreement'] }, { heading: 'Recommendations', bullets: ['Route vendor access through Island browser only', 'Watermark every plate batch sent to vendors'] }], related: { label: 'Open the credential records', to: '/int/exposure?source=Infostealer' } },
      { cat: 'Advisory', title: `${isac}: vishing against studio SaaS tenants`, daysAgo: 3, readMin: 4, summary: 'Callers posing as IT are persuading vendor and studio staff to approve rogue SaaS connections.', sections: [{ heading: 'Why it matters', paras: ['Recent extortion cases started with a phone call and ended with subscriber data resold; materiality decisions for an SEC 8-K followed within days.'] }, { heading: 'For Starfall', bullets: ['Connected-app approvals restricted to admins', 'Starfall+ subscriber export alerts added', 'SEC 8-K materiality evidence pack prepared in advance'] }], related: { label: 'Related indicators', to: '/int/ioc?threat=Credential%20theft' } },
      { cat: 'Phishing', title: 'Fake awards-screener invitations', daysAgo: 16, readMin: 3, summary: 'Awards voters and talent reps received invitations to a cloned screener portal.', sections: [{ heading: 'Actions taken', bullets: [`Lure domains blocked in ${mailN}`, 'Indee notified; real screener links re-issued with device binding', 'Three voters’ sessions revoked'] }], related: { label: 'See the lookalike', to: '/int/darkweb?view=domains' } },
    ],
  };
  return [...forCustomer(sector, c), ...shared]
    .map((a, i) => ({ ...a, id: `ART-${c.id.slice(0, 3).toUpperCase()}-${i + 1}`, author: a.cat === 'Incident Report' ? 'HexaShield SOC' : 'HexaInt analyst team' }))
    .sort((a, b) => a.daysAgo - b.daysAgo);
}
function fmtCount(n: number): string {
  return n.toLocaleString('en-GB');
}

/* =====================================================================
   Overview roll-up: what each source is holding.
   ===================================================================== */
export interface SourceHolding {
  key: string;
  title: string;
  value: number;
  max: number;
  hot: number;
  hotLabel: string;
  detail: string;
  to: string;
  source: string;
}
export function sourceHoldings(c: CustomerProfile, tenantId: string): SourceHolding[] {
  const hosts = surfaceHosts(c, tenantId);
  const { machines, creds } = credExposure(c, tenantId);
  const looks = lookalikes(c, tenantId);
  const mentions = darkwebMentions(c, tenantId);
  const sup = supplierWatch(c);
  const findings = hosts.reduce((n, h) => n + h.cves.length, 0);
  const kev = hosts.reduce((n, h) => n + h.cves.filter((v) => v.kev).length, 0);
  const ports = hosts.reduce((n, h) => n + h.ports.length, 0);
  const accounts = new Set(creds.map((k) => k.account)).size;
  const apps = new Set(creds.map((k) => k.usedOn)).size;
  const live = looks.filter((l) => l.status.startsWith('Live')).length;
  const direct = mentions.filter((m) => m.scope === 'Direct mention').length;
  const withF = sup.filter((s) => s.findings.length > 0).length;
  const newF = sup.reduce((n, s) => n + s.findings.filter((f) => f.daysAgo <= 30).length, 0);
  const noAv = machines.filter((m) => !m.avPresent).length;
  const countries = new Set(machines.map((m) => m.country)).size;
  const stealerCreds = creds.filter((k) => k.source === 'Infostealer').length;
  return [
    { key: 'surface', title: 'Attack surface', value: findings, max: Math.max(findings, hosts.length * 2), hot: kev, hotLabel: 'on the KEV list', detail: `${findings} findings · ${hosts.length} hosts · ${ports} open ports`, to: '/int/surface', source: 'HexaInt external scanner · NVD · FIRST EPSS' },
    { key: 'creds', title: 'Leaked credentials', value: creds.length, max: creds.length, hot: stealerCreds, hotLabel: 'from stealer logs', detail: `${accounts} accounts · ${machines.length} machines · ${apps} apps affected`, to: '/int/exposure', source: 'HexaInt stealer-log and combolist collection' },
    { key: 'stealer', title: 'Stealer logs', value: machines.length, max: machines.length, hot: noAv, hotLabel: 'with no antivirus', detail: `${machines.filter((m) => m.ssoCookies).length} with SSO cookies · ${countries} countries`, to: '/int/exposure?view=machines', source: 'HexaInt infostealer log collection' },
    { key: 'brand', title: 'Brand imitation', value: looks.length, max: looks.length, hot: live, hotLabel: 'live now', detail: `${looks.length} lookalikes · ${looks.filter((l) => l.registered <= 30).length} new in 30 days`, to: '/int/darkweb?view=domains', source: 'HexaInt domain monitoring (CT logs, zone files)' },
    { key: 'dark', title: 'Dark web', value: mentions.length, max: mentions.length, hot: direct, hotLabel: 'naming you directly', detail: `${mentions.filter((m) => m.sev === 'critical' || m.sev === 'high').length} high or critical · ${mentions.filter((m) => m.status === 'New').length} untriaged`, to: '/int/darkweb?scope=Direct%20mention', source: 'HexaInt dark-web collection' },
    { key: 'supply', title: 'Supplier watchlist', value: sup.length, max: sup.length, hot: withF, hotLabel: 'with findings', detail: `${sup.length} monitored · ${newF} new findings in 30 days`, to: '/int/supply', source: 'HexaInt supplier exposure monitoring' },
  ];
}
