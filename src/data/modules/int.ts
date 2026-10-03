// HexaInt (Cyber Intelligence) data: dark web, OSINT / threat intel and
// credential & executive exposure. Pure, seeded per customer and tenant.
// All content is fictional demo data; snippets are redacted summaries only.
import type { CustomerProfile, CustomerId, Severity, Connector } from '../types';
import { rng } from '../../lib/rng';
import { headlines } from '../core';
import { scopedTenants } from '../customers';
import type { TimeRange } from '../../state/AppContext';
import { dayLabels, hourLabels, fmtDateShort, daysAgo } from '../../lib/format';

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
  const map: Record<CustomerId, MT[]> = {
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
  };
  return map[c.id];
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
  const data: Record<CustomerId, RansomGroup[]> = {
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
  };
  // stable jitter so peers feel per-customer
  return data[c.id].map((g) => ({ ...g, lastSeenDays: g.lastSeenDays + r.int(0, 2) }));
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
  const homo = base.replace('o', '0').replace(/l(?!.*l)/, '1');
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
  const common: Advisory[] = [
    { id: 'A1', source: 'CISA KEV', title: 'Palo Alto GlobalProtect command injection added to KEV', ref: 'CVE-2024-3400', sev: 'critical', daysAgo: r.int(2, 20), affectsEstate: c.id === 'maritime', note: 'Internet-facing GlobalProtect; patch within KEV due date.' },
    { id: 'A2', source: 'CISA KEV', title: 'Ivanti Connect Secure RCE exploited in the wild', ref: 'CVE-2025-0282', sev: 'critical', daysAgo: r.int(3, 25), affectsEstate: false, note: 'No Ivanti ICS appliances found in estate.' },
    { id: 'A3', source: 'Vendor', title: 'Microsoft SharePoint "ToolShell" deserialisation RCE', ref: 'CVE-2025-53770', sev: 'critical', daysAgo: r.int(1, 10), affectsEstate: c.id !== 'media', note: 'On-prem SharePoint; verify exposure and patch.' },
    { id: 'A4', source: 'Sector ISAC', title: `${isac}: active campaign against the sector`, ref: `${isac}-2026-${r.int(100, 999)}`, sev: 'high', daysAgo: r.int(1, 7), affectsEstate: true, note: 'Mapped to techniques in your coverage matrix.' },
  ];
  const sector: Record<CustomerId, Advisory[]> = {
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
  };
  return [...common, ...sector[c.id]];
}

export function isacName(c: CustomerProfile): string {
  const m: Record<CustomerId, string> = { maritime: 'Maritime ISAC', finserv: 'FS-ISAC', media: 'ME-ISAC', healthcare: 'Health-ISAC', automotive: 'Auto-ISAC' };
  return m[c.id];
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
  const map: Record<CustomerId, SectorBriefItem[]> = {
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
  };
  return { week: `Week ${isoWeek()}, ${isac} + HexaInt`, items: map[c.id] };
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
];
const HOME_GEO: Record<CustomerId, [string, number][]> = {
  maritime: [['Netherlands', 9], ['Belgium', 5], ['Singapore', 4], ['Brazil', 4], ['Philippines', 4], ['India', 2], ['Poland', 1]],
  finserv: [['United Kingdom', 10], ['India', 4], ['Poland', 2], ['Singapore', 2], ['United States', 2], ['Spain', 1], ['Nigeria', 1]],
  media: [['United States', 8], ['United Kingdom', 6], ['Canada', 3], ['India', 2], ['Brazil', 1], ['Spain', 1]],
  healthcare: [['United States', 14], ['India', 3], ['Philippines', 3], ['Canada', 1], ['Mexico', 1], ['Vietnam', 1]],
  automotive: [['Germany', 9], ['Hungary', 5], ['Mexico', 5], ['Poland', 3], ['India', 2], ['Italy', 2], ['United States', 2], ['Brazil', 1]],
};
const SURNAMES: Record<CustomerId, string[]> = {
  maritime: ['vermeer', 'okafor', 'lindqvist', 'marino', 'petrov', 'dekker', 'santos', 'tan', 'reyes', 'jansen', 'devries', 'costa'],
  finserv: ['hughes', 'patel', 'clarke', 'khan', 'morgan', 'osei', 'fraser', 'walsh', 'nowak', 'chen', 'bell', 'reid'],
  media: ['rivera', 'cohen', 'blake', 'ito', 'nash', 'ford', 'greene', 'park', 'diaz', 'quinn', 'lowe', 'shah'],
  healthcare: ['miller', 'johnson', 'garcia', 'brooks', 'kim', 'reyes', 'patel', 'hayes', 'cruz', 'nguyen', 'turner', 'ward'],
  automotive: ['mueller', 'schmidt', 'fischer', 'weber', 'kovacs', 'horvath', 'garcia', 'lopez', 'wagner', 'becker', 'szabo', 'hoffmann'],
};
const FUNCTIONAL: Record<CustomerId, string[]> = {
  maritime: ['finance', 'helpdesk', 'crewing', 'gate-ops'],
  finserv: ['treasury-ops', 'servicedesk', 'payments-support', 'kyc-team'],
  media: ['post-coord', 'servicedesk', 'publicity', 'screeners'],
  healthcare: ['servicedesk', 'pharmacy', 'revcycle', 'radiology-pacs', 'nursing-float'],
  automotive: ['servicedesk', 'dealer-support', 'ota-release', 'supplier-quality', 'plant-it-gyor'],
};
/** Where the stolen logins were used: corporate apps first, then sector SaaS, then personal sites. */
function credApps(c: CustomerProfile): { app: string; kind: ExposedCred['appKind']; w: number }[] {
  const corp = c.vocab.externalHosts.filter((h) => !/^www\.|careers|press/.test(h)).slice(0, 4).map((app, i) => ({ app, kind: 'Corporate' as const, w: 6 - i }));
  const sector: Record<CustomerId, string[]> = {
    maritime: ['navis.com (N4 TOS portal)', 'inttra.com', 'kongsberg.com (K-Fleet)'],
    finserv: ['swift.com', 'bloomberg.com', 'workday.com'],
    media: ['frame.io', 'box.com', 'pix.com'],
    healthcare: ['userweb.epic.com', 'availity.com', 'workday.com', 'ukg.com (timeclock)'],
    automotive: ['supplier gateway (PLM)', 'service.ariba.com', 'dealercore-dms.com', '3dexperience.3ds.com'],
  };
  const idp = idpOf(c);
  const sso = idp?.vendor === 'Okta' ? 'okta.com' : 'login.microsoftonline.com';
  return [
    { app: sso, kind: 'Corporate', w: 14 },
    ...corp,
    ...sector[c.id].map((app) => ({ app, kind: 'Third-party SaaS' as const, w: 4 })),
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
  const geoW = HOME_GEO[c.id];
  // accounts
  const named = [...c.people.staff.map((p) => p.email), c.people.socLead.email, c.people.admin.email];
  const nAcc = Math.max(4, Math.round(total / 4.2));
  const accounts: { email: string; privileged: boolean; tenantId: string }[] = [];
  const sur = SURNAMES[c.id];
  const fn = FUNCTIONAL[c.id];
  for (let i = 0; i < nAcc; i++) {
    let email: string;
    if (i % 3 === 2 && Math.floor(i / 3) < fn.length) email = `${fn[Math.floor(i / 3)]}@${dom}`;
    else if (i % 2 === 0 && i < named.length) email = named[i];
    else email = `${LETTERS[r.int(0, LETTERS.length - 1)]}.${sur[i % sur.length]}${i >= sur.length ? Math.floor(i / sur.length) + 1 : ''}@${dom}`;
    if (accounts.some((a) => a.email === email)) email = `${LETTERS[r.int(0, LETTERS.length - 1)]}.${sur[(i + 5) % sur.length]}${i}@${dom}`;
    const local = email.split('@')[0];
    accounts.push({ email, privileged: r.chance(0.14) || /servicedesk|helpdesk|ota-release|plant-it/.test(local), tenantId: tenants[i % tenants.length].id });
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
  { test: /^vpn|citrix/, ports: [[443, 'https'], [80, 'http']], vulns: [['Authentication bypass in VPN appliance web interface', 'critical', true], ['Session token disclosure in gateway memory', 'high', false]], tech: 'SSL-VPN appliance' },
  { test: /^files|aspera|sharepoint/, ports: [[443, 'https'], [22, 'ssh'], [3306, 'mysql']], vulns: [['Database service reachable from the public internet', 'critical', false], ['SSH allows password authentication', 'medium', false]], tech: 'Managed file transfer' },
  { test: /^dev|staging/, ports: [[443, 'https'], [8080, 'http-proxy']], vulns: [['Unauthenticated build-job listing in CI server', 'high', false]], tech: 'CI server' },
  { test: /^mail/, ports: [[25, 'smtp'], [587, 'submission'], [443, 'https']], vulns: [['Stored cross-site scripting in webmail message view', 'high', true]], tech: 'Exchange / OWA' },
  { test: /^api|fhir|openbanking/, ports: [[443, 'https']], vulns: [['Broken object-level authorisation on a public API route', 'high', false], ['Verbose error responses disclose framework version', 'low', false]], tech: 'API gateway' },
  { test: /^ota/, ports: [[443, 'https']], vulns: [['Campaign-metadata endpoint exposes build manifests without auth', 'medium', false]], tech: 'OTA backend (CloudFront)' },
  { test: /^mychart|portal|online|booking|screeners|review|connect|dealer|supplier|crew|trade/, ports: [[443, 'https']], vulns: [['Outdated TLS configuration and missing security headers', 'medium', false]], tech: 'Customer portal' },
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
   names here are fictional; contracts live in the HexaComply vendor register.
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
const SUPPLIERS: Record<CustomerId, SupSeed[]> = {
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
  return SUPPLIERS[c.id].map((s, i) => {
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
  const sector: Record<CustomerId, IocSeed[]> = {
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
  };
  return [
    ...sector[c.id],
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
  const sector: Record<CustomerId, ArtSeed[]> = {
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
  };
  return [...sector[c.id], ...shared]
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
