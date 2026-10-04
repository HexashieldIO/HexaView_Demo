// HexaCore Integration Fabric: data generators for the eight fabric tabs.
// Everything is derived from the customer profile (connectors, data planes,
// tenants, vocabulary) and anchored to headlines() so numbers agree with the
// Command Centre. Seeded RNG keeps it stable per customer and tenant.
import type { Connector, ConnectorCategory, CustomerId, CustomerProfile, Env, Health, Severity } from '../types';
import { rng } from '../../lib/rng';
import { dayLabels, hourLabels, fxFromUsd } from '../../lib/format';
import { headlines } from '../core';
import { isStale, scale, scopedConnectors, scopedTenants, tenantShare } from '../customers';
import { CVES, ICS_CVES, TECHNIQUE_BY_ID, type CveRef } from '../reference';
import { forCustomer } from '../customerMap';
import { type CustomerMap } from '../customerMap';

/* =====================================================================
   Shared helpers
   ===================================================================== */
export const ENVS: Env[] = ['cloud', 'onprem', 'ot', 'saas'];
export const ENV_LABEL: Record<Env, string> = { cloud: 'Cloud', onprem: 'On-prem', ot: 'OT', saas: 'SaaS' };
export const ENV_HEX: Record<Env, string> = { cloud: '#3fd0f0', onprem: '#68b1ff', ot: '#f7a04a', saas: '#8f8cff' };

const SHORT_BY_VENDOR: Record<string, (k: Connector) => string> = {
  Microsoft: (k) => k.product,
  HexaShield: (k) => k.product.replace(/ \(.*\)$/, ''),
  Generic: (k) => k.product.split(' (')[0],
  AWS: (k) => `AWS ${k.product}`,
  Google: (k) => (k.product.startsWith('Security Operations') ? 'Google SecOps' : `Google ${k.product}`),
  'Palo Alto Networks': (k) => k.product.split(' (')[0],
  IBM: (k) => (k.product.includes('QRadar') ? 'QRadar' : 'z/OS RACF'),
  SWIFT: () => 'SWIFT Alliance',
  'Schneider Electric': () => 'EcoStruxure BMS',
  Atlassian: () => 'Jira',
};

/** Short display name for a connector ("Sentinel", "CrowdStrike", "AWS Security Hub"). */
export function connShort(k: Connector): string {
  const f = SHORT_BY_VENDOR[k.vendor];
  return f ? f(k) : k.vendor;
}
/** Full display name ("Microsoft Sentinel", "Dragos Platform"). */
export function connName(k: Connector): string {
  if (k.vendor === 'Generic' || k.vendor === 'HexaShield') return k.product;
  return `${k.vendor} ${k.product}`;
}
/** Health shown to users: a healthy-but-stale connector is shown as degraded (LLD 6.5). */
export function effHealth(k: Connector): Health {
  return k.status === 'healthy' && isStale(k) ? 'degraded' : k.status;
}
export function srcItems(ks: Connector[]): { name: string; status: Health }[] {
  return ks.map((k) => ({ name: connShort(k), status: effHealth(k) }));
}
export function byCat(ks: Connector[], ...cats: ConnectorCategory[]): Connector[] {
  return ks.filter((k) => cats.includes(k.category));
}
function servesTenant(k: Connector, tenantId: string): boolean {
  return k.tenants === 'all' || k.tenants.includes(tenantId);
}
/** "A, B and C" */
export function joinList(xs: string[]): string {
  const u = [...new Set(xs)];
  if (u.length <= 1) return u[0] ?? '';
  return `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}`;
}
/** Split a total into integer parts by weights, preserving the total. */
function split(total: number, weights: number[]): number[] {
  const w = weights.reduce((s, x) => s + x, 0) || 1;
  const out = weights.map((x) => Math.floor((total * x) / w));
  let rem = total - out.reduce((s, x) => s + x, 0);
  const order = weights.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]);
  for (let i = 0; rem > 0; i = (i + 1) % order.length, rem--) out[order[i][1]]++;
  return out;
}
export function seriesLabels(days: number): string[] {
  return days === 1 ? hourLabels(24) : dayLabels(days);
}
function nPoints(days: number): number {
  return days === 1 ? 24 : days;
}
export function sevOfCvss(cvss: number): Severity {
  return cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low';
}
export function techName(id: string): string {
  return TECHNIQUE_BY_ID[id]?.name ?? id;
}

/* =====================================================================
   1. Integrations: connector health (LLD 6.5) and marketplace
   ===================================================================== */
const OCSF: Record<ConnectorCategory, string[]> = {
  SIEM: ['Detection Finding (2004)', 'Incident Finding (2005)'],
  'EDR / XDR': ['Device Inventory Info (5001)', 'Detection Finding (2004)', 'Vulnerability Finding (2002)'],
  Identity: ['User Inventory Info (5003)', 'Authentication (3002)'],
  PAM: ['User Inventory Info (5003)', 'Account Change (3001)'],
  'Cloud posture': ['Compliance Finding (2003)', 'Cloud Resources Inventory Info (5023)'],
  Vulnerability: ['Vulnerability Finding (2002)', 'Device Inventory Info (5001)'],
  OT: ['Device Inventory Info (5001)', 'Detection Finding (2004)', 'Network Activity (4001)'],
  GRC: ['Compliance Finding (2003)'],
  Intelligence: ['OSINT Inventory Info (5021)'],
  Email: ['Email Activity (4009)', 'Detection Finding (2004)'],
  Network: ['Network Activity (4001)', 'Detection Finding (2004)'],
  SASE: ['HTTP Activity (4002)', 'Network Activity (4001)'],
  ITSM: ['Incident Finding (2005)', 'Device Inventory Info (5001)'],
  Validation: ['Detection Finding (2004)'],
  Custody: ['File System Activity (1001)'],
  Backup: ['Application Lifecycle (6002)'],
  DLP: ['Data Security Finding (2006)'],
  AppSec: ['Vulnerability Finding (2002)'],
  AI: ['API Activity (6003)'],
  HexaShield: ['Detection Finding (2004)'],
  'Asset / CMDB': ['Device Inventory Info (5001)'],
  Ratings: ['Compliance Finding (2003)'],
};

export interface ConnectorHealth {
  k: Connector;
  stale: boolean;
  health: Health;
  lastSuccessMin: number;
  recordsLastSync: number;
  errorRate1h: number;
  rateLimited1h: number;
  authExpiresDays: number | null;
  authType: string;
  drift: { unknown: number; missing: number; typeMismatch: number };
  manifestVersion: string;
  runtimeVersion: string;
  contract: { name: string; pass: boolean; detail: string }[];
  lastError?: string;
  spark: number[];
  ocsf: string[];
  syncs24h: number;
  secretRef: string;
}

function authFor(k: Connector): string {
  if (k.vendor === 'Microsoft') return 'oauth2_client_credentials (Entra app, certificate)';
  if (k.vendor === 'HexaShield') return 'platform_token (internal, mTLS)';
  if (k.vendor === 'Generic') return k.product.startsWith('TAXII') ? 'taxii_basic (API root key)' : 'mtls_client_cert';
  if (['Okta', 'CrowdStrike', 'Wiz', 'SentinelOne'].includes(k.vendor)) return 'oauth2_client_credentials';
  if (k.env === 'onprem' || k.env === 'ot') return 'api_key (local vault)';
  return 'api_token';
}

export function connectorHealth(c: CustomerProfile, k: Connector): ConnectorHealth {
  const r = rng(`fab-health-${c.id}-${k.id}`);
  const stale = isStale(k);
  const dp = c.dataPlanes.find((d) => d.id === k.dataPlaneId);
  const syncs24h = Math.max(1, Math.round(1440 / k.intervalMin));
  const perSync = Math.max(1, Math.round((k.records / Math.min(Math.max(syncs24h, 6), 48)) * r.float(0.15, 0.4, 2)));
  const rateNote = /rate limit|429/i.test(k.note ?? '');
  const driftNote = /drift/i.test(k.note ?? '') || k.drift > 0;
  const paused = k.status === 'paused';
  const errorRate1h = paused ? 0 : k.status === 'healthy' ? (stale ? r.float(1, 3) : r.float(0, 0.4, 2)) : r.float(3, 11);
  const rateLimited1h = rateNote ? r.int(40, 90) : k.status === 'healthy' ? r.int(0, 1) : r.int(0, 4);
  const authExpiresDays = k.vendor === 'HexaShield' ? null : paused ? 2 : r.int(6, 330);
  const unknown = driftNote ? Math.max(1, Math.ceil(k.drift / 2)) + r.int(0, 2) : r.int(0, 1);
  const missing = k.drift >= 3 ? 1 : 0;
  const typeMismatch = k.drift >= 2 ? Math.max(1, Math.floor(k.drift / 2)) : 0;
  const spark = Array.from({ length: 24 }, (_, i) => {
    let v = perSync * r.float(0.75, 1.25, 2);
    if (paused) v = 0;
    else if (k.status !== 'healthy' && i > 17) v *= r.float(0.05, 0.4, 2);
    else if (stale && i > 20) v = 0;
    return Math.round(v);
  });
  const contract = [
    { name: 'Auth handshake & scope check', pass: !paused, detail: paused ? 'API key rotation pending; credential not presented' : 'Scopes match manifest' },
    { name: 'Response schema conformance', pass: k.drift === 0, detail: k.drift ? `${k.drift} fields differ from recorded response_schemas` : 'All responses validate' },
    { name: `OCSF mapping (${OCSF[k.category][0]})`, pass: k.drift < 3, detail: k.drift >= 3 ? 'Required field unmapped after vendor upgrade' : 'Required attributes populated' },
    { name: 'Pagination & cursor resume', pass: true, detail: 'Cursor resumes without gaps or duplicates' },
    { name: 'Rate-limit back-off', pass: !rateNote, detail: rateNote ? 'Back-off ceiling reached; vendor quota exhausted' : 'Honours Retry-After' },
    { name: 'Idempotent upsert replay', pass: true, detail: 'Replay of last batch produced 0 changes' },
  ];
  if (k.write.length) contract.push({ name: 'Write-back dry run (sandbox)', pass: k.status !== 'failing', detail: `Dry run of "${k.write[0]}" against vendor sandbox` });
  let lastError: string | undefined;
  if (paused) lastError = `401 Unauthorized from ${k.vendor.toLowerCase()} API · credential secret_ref=vault://… [REDACTED] · ${k.note ?? ''}`;
  else if (rateNote) lastError = `429 Too Many Requests · Retry-After: 600 · endpoint /api/v1/[REDACTED] · ${rateLimited1h} throttled calls in the last hour`;
  else if (k.status === 'degraded' && driftNote) lastError = `Schema drift: field 'result' type string to object; 'session.id' missing (vendor ${k.note?.match(/v[\d.]+/)?.[0] ?? 'upgrade'}) · payload withheld`;
  else if (k.status === 'degraded') lastError = `Upstream timeout after 30 s from collector relay (${dp?.name ?? 'edge'}) · ${k.note ?? 'retrying with back-off'}`;
  else if (stale) lastError = `Last scheduled sync skipped: previous run still in progress · no payload recorded`;
  return {
    k, stale, health: effHealth(k), lastSuccessMin: k.lastSyncMin, recordsLastSync: paused ? 0 : perSync,
    errorRate1h, rateLimited1h, authExpiresDays, authType: authFor(k),
    drift: { unknown, missing, typeMismatch },
    manifestVersion: k.version, runtimeVersion: `hv-agent ${dp?.agentVersion ?? '1.9.2'}`,
    contract, lastError, spark, ocsf: OCSF[k.category], syncs24h,
    secretRef: k.vendor === 'HexaShield' ? 'internal (no customer secret)' : `${dp?.vault.split(' (')[0] ?? 'vault'} :: ${k.id.replace('c-', '')}-creds`,
  };
}

export function manifestYaml(c: CustomerProfile, k: Connector): string {
  const h = connectorHealth(c, k);
  const slug = `${k.vendor}.${k.product}`.toLowerCase().replace(/[^a-z0-9.]+/g, '_').replace(/_+$/, '');
  const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const lines = [
    `connector: ${slug}`,
    `manifest_version: ${k.version}`,
    `category: ${snake(k.category)}`,
    `data_plane: ${k.dataPlaneId}`,
    `auth:`,
    `  type: ${h.authType.split(' ')[0]}`,
    `  secret_ref: vault://${k.dataPlaneId}/${k.id.replace('c-', '')}  # never leaves the data plane`,
    `schedule:`,
    `  interval: ${k.intervalMin >= 60 ? `${k.intervalMin / 60}h` : `${k.intervalMin}m`}`,
    `  mode: incremental`,
    `  tombstone_after: 3`,
    `read:`,
    ...k.read.map((x) => `  - ${snake(x)}`),
    `write:${k.write.length ? '' : ' []  # read-only'}`,
    ...k.write.map((x) => `  - action: ${snake(x.replace(/\(.*\)/, ''))}\n    gated: true  # approval policy, LLD 8.2`),
    `map_to: ocsf-1.3`,
    ...h.ocsf.map((x) => `  - ${x}`),
    `egress: hv-gateway (mTLS, outbound 443)`,
  ];
  if (k.env === 'ot') lines.push('policy: read_only  # OT targets never accept actions');
  return lines.join('\n');
}

export type CatalogueKind = 'Standards-native' | 'First-party' | 'Community / partner';
export interface CatalogueItem {
  id: string;
  name: string;
  kind: CatalogueKind;
  category: string;
  envs: string;
  blurb: string;
  match?: string;
  writeBack: boolean;
}
export const CATALOGUE: CatalogueItem[] = [
  { id: 'ocsf', name: 'OCSF push (HTTPS / Kafka)', kind: 'Standards-native', category: 'Any', envs: 'Cloud · on-prem · OT', blurb: 'Send OCSF 1.x events straight into the canonical model; no mapping needed.', match: 'ocsf push', writeBack: false },
  { id: 'taxii', name: 'STIX / TAXII 2.1', kind: 'Standards-native', category: 'Intelligence', envs: 'SaaS', blurb: 'Pull indicators and intrusion sets from ISACs and partners.', match: 'taxii', writeBack: false },
  { id: 'oscal', name: 'OSCAL (SSP, assessment results)', kind: 'Standards-native', category: 'GRC', envs: 'SaaS', blurb: 'Import control catalogues, SSPs and assessment results as evidence.', writeBack: false },
  { id: 'syslog', name: 'Syslog / CEF / LEEF', kind: 'Standards-native', category: 'Network · OT · legacy', envs: 'On-prem · OT · vessel', blurb: 'Edge collector on the data plane for appliances without an API.', match: 'syslog', writeBack: false },
  { id: 'scim', name: 'SCIM 2.0 directory', kind: 'Standards-native', category: 'Identity', envs: 'SaaS', blurb: 'Users and groups from any SCIM-capable directory.', writeBack: false },
  { id: 'sentinel', name: 'Microsoft Sentinel', kind: 'First-party', category: 'SIEM', envs: 'Cloud', blurb: 'Analytic rules and incidents; deploy and toggle rules (gated).', match: 'sentinel', writeBack: true },
  { id: 'splunk', name: 'Splunk Enterprise Security', kind: 'First-party', category: 'SIEM', envs: 'On-prem · cloud', blurb: 'Correlation searches and notables; toggle searches (gated).', match: 'splunk', writeBack: true },
  { id: 'secops', name: 'Google Security Operations', kind: 'First-party', category: 'SIEM', envs: 'Cloud', blurb: 'YARA-L rules, detections and cases.', match: 'security operations', writeBack: true },
  { id: 'defender', name: 'Microsoft Defender XDR', kind: 'First-party', category: 'EDR / XDR', envs: 'Cloud', blurb: 'Devices, alerts and TVM; add custom indicators (gated).', match: 'defender xdr', writeBack: true },
  { id: 'crowdstrike', name: 'CrowdStrike Falcon', kind: 'First-party', category: 'EDR / XDR', envs: 'Cloud', blurb: 'Hosts, detections, Spotlight; IOC and containment (gated).', match: 'crowdstrike', writeBack: true },
  { id: 's1', name: 'SentinelOne Singularity', kind: 'First-party', category: 'EDR / XDR', envs: 'Cloud', blurb: 'Agents, threats and app vulnerabilities.', match: 'sentinelone', writeBack: true },
  { id: 'entra', name: 'Microsoft Entra ID', kind: 'First-party', category: 'Identity', envs: 'Cloud', blurb: 'Users, risky sign-ins, Conditional Access; revoke sessions (high risk).', match: 'entra', writeBack: true },
  { id: 'okta', name: 'Okta Workforce Identity', kind: 'First-party', category: 'Identity', envs: 'SaaS', blurb: 'Users, policies, System Log; clear sessions (gated).', match: 'okta', writeBack: true },
  { id: 'cyberark', name: 'CyberArk PAM', kind: 'First-party', category: 'PAM', envs: 'SaaS · on-prem', blurb: 'Vaulted accounts, sessions and rotations.', match: 'cyberark', writeBack: true },
  { id: 'wiz', name: 'Wiz', kind: 'First-party', category: 'Cloud posture', envs: 'Cloud', blurb: 'Issues, inventory and attack paths across AWS, Azure and GCP.', match: 'wiz', writeBack: false },
  { id: 'prisma', name: 'Prisma Cloud', kind: 'First-party', category: 'Cloud posture', envs: 'Cloud', blurb: 'Alerts, compliance posture and inventory.', match: 'prisma', writeBack: false },
  { id: 'mdc', name: 'Microsoft Defender for Cloud', kind: 'First-party', category: 'Cloud posture', envs: 'Cloud', blurb: 'Secure score, recommendations, regulatory compliance.', match: 'defender for cloud', writeBack: false },
  { id: 'awssh', name: 'AWS Security Hub', kind: 'First-party', category: 'Cloud posture', envs: 'Cloud', blurb: 'Findings and standards across AWS Organizations.', match: 'security hub', writeBack: false },
  { id: 'tenable', name: 'Tenable Vulnerability Management', kind: 'First-party', category: 'Vulnerability', envs: 'Cloud · on-prem', blurb: 'Assets and vulnerabilities with VPR.', match: 'tenable', writeBack: false },
  { id: 'qualys', name: 'Qualys VMDR', kind: 'First-party', category: 'Vulnerability', envs: 'Cloud · on-prem', blurb: 'Assets, detections and TruRisk.', match: 'qualys', writeBack: false },
  { id: 'rapid7', name: 'Rapid7 InsightVM', kind: 'First-party', category: 'Vulnerability', envs: 'Cloud · on-prem', blurb: 'Assets, vulnerabilities and remediation projects.', match: 'rapid7', writeBack: false },
  { id: 'dragos', name: 'Dragos Platform', kind: 'First-party', category: 'OT', envs: 'OT', blurb: 'OT assets, zones, alerts and vulnerabilities. Read-only by policy.', match: 'dragos', writeBack: false },
  { id: 'claroty', name: 'Claroty xDome', kind: 'First-party', category: 'OT', envs: 'OT', blurb: 'Cyber-physical asset inventory and risk. Read-only by policy.', match: 'claroty', writeBack: false },
  { id: 'servicenow', name: 'ServiceNow ITSM / SecOps', kind: 'First-party', category: 'ITSM', envs: 'SaaS', blurb: 'Incidents, CMDB; create and update tickets (low risk).', match: 'servicenow', writeBack: true },
  { id: 'jira', name: 'Jira Service Management', kind: 'First-party', category: 'ITSM', envs: 'SaaS', blurb: 'Issues and assets; create issues (low risk).', match: 'jira', writeBack: true },
  { id: 'zscaler', name: 'Zscaler ZIA / ZPA', kind: 'First-party', category: 'SASE', envs: 'SaaS', blurb: 'Web threats, private access, DLP.', match: 'zscaler', writeBack: true },
  { id: 'netskope', name: 'Netskope SSE', kind: 'First-party', category: 'DLP', envs: 'SaaS', blurb: 'App and GenAI usage, DLP incidents.', match: 'netskope', writeBack: true },
  { id: 'proofpoint', name: 'Proofpoint Email Protection', kind: 'First-party', category: 'Email', envs: 'SaaS', blurb: 'Threats, clicks and Very Attacked People.', match: 'proofpoint', writeBack: true },
  { id: 'paloalto', name: 'Palo Alto Strata NGFW', kind: 'First-party', category: 'Network', envs: 'On-prem', blurb: 'Rules, threat logs, zones; block-list updates (gated).', match: 'strata', writeBack: true },
  { id: 'veeam', name: 'Veeam Backup & Replication', kind: 'First-party', category: 'Backup', envs: 'On-prem', blurb: 'Jobs, immutability and restore tests as resilience evidence.', match: 'veeam', writeBack: false },
  { id: 'rubrik', name: 'Rubrik Security Cloud', kind: 'First-party', category: 'Backup', envs: 'On-prem · cloud', blurb: 'Snapshots, anomaly detection, recovery tests.', match: 'rubrik', writeBack: false },
  { id: 'axonius', name: 'Axonius', kind: 'Community / partner', category: 'Asset / CMDB', envs: 'SaaS', blurb: 'Cyber asset inventory as an additional resolution source.', writeBack: false },
  { id: 'snyk', name: 'Snyk', kind: 'Community / partner', category: 'AppSec', envs: 'SaaS', blurb: 'Code and open-source issues per project.', match: 'snyk', writeBack: false },
  { id: 'veracode', name: 'Veracode', kind: 'Community / partner', category: 'AppSec', envs: 'SaaS', blurb: 'Application flaws and policy compliance.', match: 'veracode', writeBack: false },
  { id: 'knowbe4', name: 'KnowBe4', kind: 'Community / partner', category: 'Awareness', envs: 'SaaS', blurb: 'Phish-prone % and training completion as evidence.', match: 'knowbe4', writeBack: false },
  { id: 'bitsight', name: 'BitSight', kind: 'Community / partner', category: 'Ratings', envs: 'SaaS', blurb: 'Third-party security ratings and findings.', match: 'bitsight', writeBack: false },
  { id: 'abnormal', name: 'Abnormal Security', kind: 'Community / partner', category: 'Email', envs: 'SaaS', blurb: 'BEC and vendor-fraud detections.', writeBack: false },
  { id: 'vectra', name: 'Vectra AI', kind: 'Community / partner', category: 'NDR', envs: 'On-prem · cloud', blurb: 'Network detections and prioritised entities.', writeBack: false },
];
export function catalogueConnected(c: CustomerProfile, it: CatalogueItem): boolean {
  if (!it.match) return false;
  const m = it.match;
  return c.connectors.some((k) => connName(k).toLowerCase().includes(m));
}

/* =====================================================================
   2. Data planes
   ===================================================================== */
export function planesInScope(c: CustomerProfile, tenantId: string) {
  if (tenantId === 'all') return c.dataPlanes;
  const ids = new Set(scopedConnectors(c, tenantId).map((k) => k.dataPlaneId));
  const t = c.tenants.find((x) => x.id === tenantId);
  if (t) ids.add(t.dataPlaneId);
  return c.dataPlanes.filter((d) => ids.has(d.id));
}

/** Events/min per point for one data plane over the range. */
export function planeSeries(c: CustomerProfile, dpId: string, days: number): number[] {
  const d = c.dataPlanes.find((x) => x.id === dpId);
  if (!d) return [];
  const r = rng(`fab-dp-${c.id}-${dpId}-${days}`);
  const n = nPoints(days);
  const isFleet = d.placement === 'Vessel edge (store & forward)';
  return Array.from({ length: n }, (_, i) => {
    const diurnal = days === 1 ? 0.75 + 0.35 * Math.sin(((i - 6) / 24) * Math.PI * 2) : 0.9 + r() * 0.2;
    let v = d.eventsPerMin * diurnal * r.float(0.88, 1.12, 2);
    if (isFleet) v = (i % 3 === 0 ? 2.4 : 0.3) * d.eventsPerMin * r.float(0.7, 1.3, 2);
    if (d.status === 'degraded' && i >= n - 3) v *= 0.55;
    return Math.round(v);
  });
}

export interface Vessel {
  name: string;
  imo: string;
  type: string;
  link: 'LEO' | 'VSAT' | 'Out of coverage';
  region: string;
  bufferedEvents: number;
  bufferPct: number;
  lastSyncMin: number;
  nextWindowMin: number;
}
const VESSELS = [
  ['Halcyon Aurora', 'ULCV 24,000 TEU'], ['Halcyon Borealis', 'ULCV 24,000 TEU'], ['Halcyon Meridian', 'Neo-Panamax 14,000 TEU'], ['Halcyon Zenith', 'Neo-Panamax 14,000 TEU'],
  ['Halcyon Solace', 'Post-Panamax 9,400 TEU'], ['Halcyon Tradewind', 'Post-Panamax 9,400 TEU'], ['Halcyon Equinox', 'Neo-Panamax 13,800 TEU'], ['Halcyon Mistral', 'Feeder 2,700 TEU'],
  ['Halcyon Sirocco', 'Feeder 2,700 TEU'], ['Halcyon Polaris', 'ULCV 23,500 TEU'], ['Halcyon Vega', 'Neo-Panamax 15,000 TEU'], ['Halcyon Lyra', 'Post-Panamax 8,800 TEU'],
  ['Halcyon Orion', 'ULCV 24,000 TEU'], ['Halcyon Cassia', 'Feeder 1,900 TEU'], ['Halcyon Juniper', 'Feeder 1,900 TEU'], ['Halcyon Atlas', 'Neo-Panamax 14,000 TEU'],
  ['Halcyon Nereid', 'Post-Panamax 9,000 TEU'], ['Halcyon Calypso', 'Post-Panamax 9,000 TEU'], ['Halcyon Halley', 'Neo-Panamax 13,000 TEU'], ['Halcyon Sable', 'Feeder 2,400 TEU'],
  ['Halcyon Tamsin', 'Feeder 2,400 TEU'], ['Halcyon Kepler', 'ULCV 23,000 TEU (newbuild, E26/E27)'],
] as const;
const SEA_REGIONS = ['North Sea', 'English Channel', 'Bay of Biscay', 'Western Med', 'Suez approach', 'Red Sea', 'Arabian Sea', 'Strait of Malacca', 'South China Sea', 'South Atlantic', 'Cape of Good Hope', 'Indian Ocean'];

export function vessels(c: CustomerProfile): Vessel[] {
  if (c.dataKey !== 'maritime') return [];
  const r = rng(`fab-vessels-${c.id}`);
  const outIdx = new Set([4, 11, 19]);
  return VESSELS.map(([name, type], i) => {
    const out = outIdx.has(i);
    const link: Vessel['link'] = out ? 'Out of coverage' : r.chance(0.7) ? 'LEO' : 'VSAT';
    const lastSyncMin = out ? r.int(180, 820) : link === 'LEO' ? r.int(2, 28) : r.int(20, 60);
    const buffered = out ? Math.round(lastSyncMin * r.int(14, 22)) : r.int(0, 900);
    return {
      name, imo: `IMO ${9700000 + r.int(10000, 99999)}`, type, link,
      region: out ? r.pick(['South Atlantic', 'Indian Ocean', 'Cape of Good Hope']) : r.pick(SEA_REGIONS),
      bufferedEvents: buffered, bufferPct: Math.min(96, Math.round((buffered / 20000) * 100)),
      lastSyncMin, nextWindowMin: out ? r.int(25, 140) : link === 'LEO' ? r.int(1, 30) : r.int(10, 30),
    };
  });
}

export interface KeyItem {
  name: string;
  purpose: string;
  location: string;
  owner: 'Customer' | 'HexaShield';
  rotatedDaysAgo: number;
  rotationDays: number;
  algo: string;
}
export function keyInventory(c: CustomerProfile): KeyItem[] {
  const r = rng(`fab-keys-${c.id}`);
  const vault = c.dataPlanes[0]?.vault ?? 'Key Vault';
  const custHsm = c.byok ? vault : 'HexaShield-managed Key Vault (per tenant)';
  return [
    { name: 'Tenant key-encryption key (KEK)', purpose: 'Wraps per-file evidence and archive data keys (LLD 4.8)', location: custHsm, owner: c.byok ? 'Customer' : 'HexaShield', rotatedDaysAgo: r.int(20, 80), rotationDays: 365, algo: 'RSA-HSM 3072' },
    { name: 'Database TDE protector', purpose: 'Tenant schema encryption at rest', location: custHsm, owner: c.byok ? 'Customer' : 'HexaShield', rotatedDaysAgo: r.int(40, 160), rotationDays: 365, algo: 'RSA-HSM 2048' },
    { name: 'Audit ledger signing key', purpose: 'Signs ledger anchors and evidence hashes', location: 'HexaShield HSM (control plane)', owner: 'HexaShield', rotatedDaysAgo: r.int(5, 60), rotationDays: 90, algo: 'ECDSA P-384' },
    { name: 'Data plane mTLS client certificates', purpose: 'Agent to hv-gateway channel, one per data plane', location: 'Data plane sealed store', owner: 'Customer', rotatedDaysAgo: r.int(1, 25), rotationDays: 30, algo: 'ECDSA P-256' },
    { name: 'Action intent signing key', purpose: 'Control plane signs write-back intents; agent verifies before executing', location: 'HexaShield HSM (control plane)', owner: 'HexaShield', rotatedDaysAgo: r.int(5, 80), rotationDays: 90, algo: 'Ed25519' },
    { name: 'Connector secret envelope', purpose: 'Vendor API credentials, stored only on the data plane', location: vault, owner: 'Customer', rotatedDaysAgo: r.int(10, 70), rotationDays: 90, algo: 'AES-256-GCM' },
  ];
}

export const DEPLOYMENT_MODELS = [
  { id: 'saas', name: 'Multi-tenant SaaS', control: 'HexaShield shared stamp', data: 'HexaShield-hosted data plane, per-tenant keys', fit: 'Fast start, Professional tier' },
  { id: 'dedicated', name: 'Dedicated stamp', control: 'Single-customer control plane stamp, in-region', data: 'Customer-hosted data planes, BYOK in customer HSM', fit: 'Regulated groups, Enterprise' },
  { id: 'hosted', name: 'Customer-hosted data plane', control: 'HexaShield control plane (shared or dedicated)', data: 'Agent in customer cloud, DC or OT DMZ; outbound 443 only', fit: 'Hybrid estates, OT, residency' },
  { id: 'airgap', name: 'Air-gapped / store & forward', control: 'HexaShield control plane, batched sync', data: 'Edge collectors buffer locally; signed bundles when a link is available', fit: 'Vessels, remote sites, CNI' },
] as const;
const DEPLOY_HIGHLIGHTS: CustomerMap<string[]> = {
  maritime: ['hosted', 'airgap'],
  finserv: ['dedicated', 'hosted'],
  healthcare: ['dedicated', 'hosted'],
  automotive: ['dedicated', 'hosted', 'airgap'],
  media: ['saas', 'hosted'],
  insurance: ['dedicated', 'hosted'],
  defence: ['dedicated', 'hosted'],
  pharma: ['dedicated', 'hosted', 'airgap'],
  sghospital: ['saas', 'hosted'],
  studio: ['dedicated', 'hosted'],
};
export function deploymentHighlights(c: CustomerProfile): string[] {
  return forCustomer(DEPLOY_HIGHLIGHTS, c);
}

/* =====================================================================
   3. Unified assets (entity resolution, LLD 4.5-4.6)
   ===================================================================== */
export type GapKey = 'edr' | 'scan' | 'cmdb' | 'owner';
export const GAP_LABEL: Record<GapKey, string> = { edr: 'No EDR', scan: 'Not vuln-scanned', cmdb: 'Missing from CMDB', owner: 'Unknown owner' };

type TypeMix = Record<Env, [string, number][]>;
const TYPE_MIX: CustomerMap<TypeMix> = {
  maritime: {
    cloud: [['Cloud VM', 0.42], ['Container workload', 0.33], ['Managed database', 0.1], ['Storage account / bucket', 0.15]],
    onprem: [['Workstation & laptop', 0.52], ['Windows server', 0.12], ['Linux server', 0.07], ['Network device', 0.09], ['Terminal handheld (RDT)', 0.14], ['Gate & CCTV IoT', 0.06]],
    ot: [['PLC (crane, RTG, AGV)', 0.3], ['HMI & SCADA server', 0.12], ['Engineering workstation', 0.05], ['Reefer monitoring gateway', 0.21], ['Vessel OT (bridge & engine)', 0.22], ['Substation RTU & drives', 0.1]],
    saas: [['SaaS application', 1]],
  },
  finserv: {
    cloud: [['Cloud VM', 0.34], ['Container workload', 0.4], ['Managed database', 0.12], ['Storage account / bucket', 0.14]],
    onprem: [['Workstation & laptop', 0.56], ['VDI desktop', 0.13], ['Windows server', 0.12], ['Linux server', 0.1], ['Network device', 0.085], ['Mainframe LPAR & HSM', 0.005]],
    ot: [['ATM (NCR SelfServ)', 0.45], ['BMS & CRAC controller', 0.2], ['UPS & generator', 0.1], ['Physical access controller', 0.15], ['CCTV NVR', 0.1]],
    saas: [['SaaS application', 1]],
  },
  media: {
    cloud: [['Cloud VM', 0.3], ['Container workload', 0.42], ['S3 content bucket', 0.16], ['Managed database', 0.12]],
    onprem: [['Workstation & edit bay', 0.48], ['Render node', 0.3], ['Laptop (production)', 0.08], ['Server', 0.07], ['Storage (NEXIS / Isilon)', 0.02], ['Network device', 0.05]],
    ot: [['ST 2110 router & switch', 0.2], ['Camera CCU', 0.2], ['Encoder & decoder', 0.15], ['Playout server', 0.1], ['PTP grandmaster', 0.03], ['Studio BMS & DMX gateway', 0.32]],
    saas: [['SaaS application', 1]],
  },
  healthcare: {
    cloud: [['Cloud VM', 0.36], ['Container workload', 0.24], ['Managed database', 0.16], ['Storage account / bucket', 0.24]],
    onprem: [['Workstation & laptop', 0.44], ['Clinical shared workstation (badge-tap)', 0.22], ['Windows server', 0.12], ['Linux server', 0.06], ['Network device', 0.08], ['Thin client & WOW cart', 0.08]],
    ot: [['Infusion pump (BD Alaris)', 0.34], ['Patient monitor (Philips)', 0.22], ['Imaging modality (CT, MRI, X-ray)', 0.05], ['Imaging & lab workstation', 0.08], ['Lab analyser', 0.06], ['Nurse call & RTLS', 0.12], ['BMS & medical gas', 0.08], ['Pharmacy cabinet', 0.05]],
    saas: [['SaaS application', 1]],
  },
  automotive: {
    cloud: [['Cloud VM', 0.24], ['Container workload', 0.46], ['Managed database', 0.12], ['Storage account / bucket', 0.18]],
    onprem: [['Workstation & laptop', 0.58], ['CAD / engineering workstation', 0.1], ['Windows server', 0.12], ['Linux server', 0.08], ['Network device', 0.07], ['Shop-floor terminal', 0.05]],
    ot: [['PLC (press, body, conveyor)', 0.28], ['Welding & paint robot', 0.18], ['HMI & SCADA (WinCC)', 0.12], ['Torque & tooling controller', 0.1], ['AGV / AMR', 0.07], ['Vision quality camera', 0.08], ['End-of-line test bench', 0.05], ['Battery formation rack', 0.12]],
    saas: [['SaaS application', 1]],
  },
  insurance: {
    cloud: [['Cloud VM', 0.3], ['Container workload', 0.38], ['Managed database', 0.14], ['Storage account / bucket', 0.18]],
    onprem: [['Workstation & laptop', 0.54], ['VDI desktop (claims & BPO)', 0.14], ['Windows server', 0.12], ['Linux server', 0.09], ['Network device', 0.08], ['Mainframe LPAR & print server', 0.03]],
    ot: [['UPS & generator controller', 0.14], ['CRAC & BMS controller', 0.22], ['Physical access controller', 0.2], ['Print & mail inserter', 0.1], ['Production printer (Xerox iGen)', 0.08], ['Contact-centre IVR / ACD', 0.08], ['CCTV NVR', 0.18]],
    saas: [['SaaS application', 1]],
  },
  defence: {
    cloud: [['Cloud VM', 0.3], ['Container workload', 0.2], ['Managed database', 0.14], ['Storage account / blob (GCC High)', 0.36]],
    onprem: [['Workstation & laptop', 0.46], ['CAD / engineering workstation', 0.18], ['Windows server', 0.1], ['Linux server & HPC node', 0.1], ['Network device', 0.08], ['Shop-floor terminal', 0.08]],
    ot: [['CNC machine (Haas, DMG Mori)', 0.3], ['CMM & inspection station', 0.08], ['DNC & programme server', 0.04], ['Environmental test chamber', 0.1], ['ATE bench (NI PXI)', 0.14], ['PLC (heat treat, ControlLogix)', 0.1], ['Range telemetry receiver', 0.06], ['BMS & compressed air', 0.18]],
    saas: [['SaaS application', 1]],
  },
  pharma: {
    cloud: [['Cloud VM', 0.3], ['Container workload', 0.3], ['Managed database', 0.16], ['Storage account / bucket', 0.24]],
    onprem: [['Workstation & laptop', 0.52], ['Lab instrument PC (GxP)', 0.14], ['Windows server', 0.12], ['Linux server & HPC node', 0.08], ['Network device', 0.08], ['MES terminal (PAS-X)', 0.06]],
    ot: [['DCS controller & workstation (DeltaV, PCS 7)', 0.18], ['Bioreactor & chromatography skid', 0.14], ['Lyophiliser & autoclave PLC', 0.12], ['Cleanroom EMS sensor (viewLinc)', 0.2], ['HVAC / BMS controller', 0.12], ['Serialisation & aggregation line', 0.1], ['Aseptic filling isolator', 0.04], ['Process historian & HMI', 0.1]],
    saas: [['SaaS application', 1]],
  },
  sghospital: {
    cloud: [['Cloud VM', 0.34], ['Container workload', 0.26], ['Managed database', 0.16], ['Storage account / bucket', 0.24]],
    onprem: [['Workstation & laptop', 0.42], ['Clinical shared workstation (badge-tap)', 0.24], ['Windows server', 0.12], ['Linux server', 0.06], ['Network device', 0.08], ['Thin client & COW', 0.08]],
    ot: [['Infusion pump (BD Alaris, Agilia)', 0.36], ['Patient monitor (Philips IntelliVue)', 0.22], ['Imaging modality (CT, MRI, linac)', 0.05], ['Imaging & lab workstation', 0.08], ['Lab analyser (Roche cobas)', 0.06], ['Nurse call & RTLS', 0.1], ['BMS & medical gas', 0.08], ['Pneumatic tube controller', 0.05]],
    saas: [['SaaS application', 1]],
  },
  studio: {
    cloud: [['Cloud VM', 0.26], ['Container workload', 0.44], ['S3 content bucket', 0.18], ['Managed database', 0.12]],
    onprem: [['Workstation & edit bay', 0.4], ['Render node', 0.3], ['Laptop (production)', 0.08], ['Server', 0.07], ['Storage (NEXIS)', 0.02], ['Network device', 0.05], ['Park POS & kiosk', 0.08]],
    ot: [['Ride control PLC (safety-rated)', 0.12], ['Show control & animatronics', 0.1], ['Turnstile & ticket gate', 0.22], ['Projection & LED media server', 0.12], ['ST 2110 router & switch', 0.06], ['Park BMS & fire panel', 0.2], ['Water ride pump VFD', 0.08], ['Wearable & queue beacon', 0.1]],
    saas: [['SaaS application', 1]],
  },
};
const ENV_SPLIT: CustomerMap<Record<'cloud' | 'onprem' | 'saas', number>> = {
  maritime: { cloud: 0.14, onprem: 0.78, saas: 0.08 },
  finserv: { cloud: 0.3, onprem: 0.63, saas: 0.07 },
  media: { cloud: 0.3, onprem: 0.62, saas: 0.08 },
  healthcare: { cloud: 0.16, onprem: 0.76, saas: 0.08 },
  automotive: { cloud: 0.24, onprem: 0.69, saas: 0.07 },
  insurance: { cloud: 0.32, onprem: 0.6, saas: 0.08 },
  defence: { cloud: 0.22, onprem: 0.7, saas: 0.08 },
  pharma: { cloud: 0.26, onprem: 0.66, saas: 0.08 },
  sghospital: { cloud: 0.18, onprem: 0.74, saas: 0.08 },
  studio: { cloud: 0.36, onprem: 0.55, saas: 0.09 },
};
/** Entity-resolution queue: pending merge suggestions (group roll-up) and the share merged automatically. */
const MERGES: CustomerMap<{ pending: number; autoPct: number }> = {
  finserv: { pending: 214, autoPct: 96.4 },
  maritime: { pending: 168, autoPct: 93.1 },
  media: { pending: 74, autoPct: 95.2 },
  healthcare: { pending: 392, autoPct: 91.8 },
  automotive: { pending: 486, autoPct: 94.6 },
  insurance: { pending: 186, autoPct: 95.8 },
  defence: { pending: 58, autoPct: 93.4 },
  pharma: { pending: 412, autoPct: 94.1 },
  sghospital: { pending: 141, autoPct: 92.6 },
  studio: { pending: 538, autoPct: 95 },
};

export interface AssetSummary {
  total: number;
  rawObservations: number;
  byEnv: Record<Env, number>;
  byType: { type: string; env: Env; count: number }[];
  overlap: { label: string; count: number }[];
  gaps: Record<GapKey, number>;
  pendingMerges: number;
  autoMergedPct: number;
}
export function assetSummary(c: CustomerProfile, tenantId: string): AssetSummary {
  const h = headlines(c, tenantId);
  const ts = scopedTenants(c, tenantId);
  const has = (e: Env) => ts.some((t) => t.env.includes(e));
  const total = h.fabric.assets;
  const ot = has('ot') ? Math.min(h.ot.otAssets, Math.round(total * 0.8)) : 0;
  const sp = forCustomer(ENV_SPLIT, c);
  const envs = (['cloud', 'onprem', 'saas'] as const).filter(has);
  const parts = split(total - ot, envs.map((e) => sp[e]));
  const byEnv: Record<Env, number> = { cloud: 0, onprem: 0, ot, saas: 0 };
  envs.forEach((e, i) => (byEnv[e] = parts[i]));
  const byType: AssetSummary['byType'] = [];
  for (const e of ENVS) {
    if (!byEnv[e]) continue;
    const mix = forCustomer(TYPE_MIX, c)[e];
    split(byEnv[e], mix.map((m) => m[1])).forEach((n, i) => byType.push({ type: mix[i][0], env: e, count: n }));
  }
  const ov = split(total, [0.15, 0.33, 0.33, 0.19]);
  const it = byEnv.onprem + byEnv.cloud;
  const r = rng(`fab-assets-sum-${c.id}-${tenantId}`);
  return {
    total,
    rawObservations: Math.round(total * 2.58),
    byEnv,
    byType,
    overlap: [
      { label: '1 source', count: ov[0] },
      { label: '2 sources', count: ov[1] },
      { label: '3 sources', count: ov[2] },
      { label: '4+ sources', count: ov[3] },
    ],
    gaps: {
      edr: Math.round(it * r.float(0.035, 0.07, 3)),
      scan: Math.round((it + byEnv.ot) * r.float(0.06, 0.11, 3)),
      cmdb: Math.round(total * r.float(0.08, 0.13, 3)),
      owner: Math.round(total * r.float(0.04, 0.07, 3)),
    },
    pendingMerges: scale(forCustomer(MERGES, c).pending, tenantShare(c, tenantId), 6),
    autoMergedPct: forCustomer(MERGES, c).autoPct,
  };
}

export interface Observation {
  source: string;
  category: string;
  status: Health;
  key: string;
  value: string;
  lastSeenMin: number;
  fields: [string, string][];
}
export interface AssetEntity {
  id: string;
  name: string;
  type: string;
  env: Env;
  tenantId: string;
  tenantShort: string;
  criticality: number;
  owner: string | null;
  crownJewel?: string;
  ip: string;
  os: string;
  findings: { critical: number; high: number; medium: number; low: number };
  gaps: GapKey[];
  obs: Observation[];
  risk: number;
  zone: string;
}

const OS_BY_TYPE = (t: string, r: ReturnType<typeof rng>): string => {
  if (/workstation|laptop|vdi|edit bay/i.test(t)) return r.pick(['Windows 11 23H2', 'Windows 11 24H2', 'Windows 10 22H2', 'macOS 14.6']);
  if (/windows server|^server/i.test(t)) return r.pick(['Windows Server 2022', 'Windows Server 2019', 'Windows Server 2016']);
  if (/linux|render|container/i.test(t)) return r.pick(['Ubuntu 22.04', 'RHEL 9.4', 'RHEL 8.8', 'Rocky 9']);
  if (/cloud vm/i.test(t)) return r.pick(['Ubuntu 22.04', 'Windows Server 2022', 'Amazon Linux 2023']);
  if (/plc/i.test(t)) return r.pick(['Siemens S7-1500 FW 3.0', 'Rockwell ControlLogix 33.x', 'Siemens S7-1200 FW 4.5']);
  if (/hmi|scada/i.test(t)) return r.pick(['WinCC 7.5 / Win 10 LTSC', 'Windows 7 Embedded', 'Windows Server 2012 R2']);
  if (/infusion|monitor|imaging|lab analyser|modality/i.test(t)) return r.pick(['Vendor firmware 9.33', 'Windows 7 Embedded (FDA-cleared)', 'Windows 10 IoT LTSC', 'Embedded Linux 4.14']);
  if (/robot|torque|agv|formation|test bench|camera/i.test(t)) return r.pick(['KUKA KSS 8.7', 'Vendor firmware 4.2', 'Windows 7 Embedded', 'Windows 10 IoT LTSC']);
  if (/network|router|switch/i.test(t)) return r.pick(['PAN-OS 11.1', 'Cisco IOS XE 17.9', 'Arista EOS 4.31', 'FortiOS 7.2']);
  if (/atm/i.test(t)) return 'Windows 10 IoT Enterprise';
  if (/mainframe/i.test(t)) return 'z/OS 3.1';
  if (/bucket|storage|database|saas/i.test(t)) return 'n/a (managed service)';
  return r.pick(['Embedded Linux', 'Vendor firmware', 'VxWorks 6.9']);
};

/** Cloud regions per customer: per-provider pools for accounts, a mixed list for asset observations, and the home AWS region / GCP zone. */
interface RegionPools { Azure: string[]; AWS: string[]; GCP: string[]; mixed: string[]; awsHome: string; gcpZone: string }
const TEMPLATE_REGIONS: RegionPools = {
  Azure: ['West Europe', 'North Europe', 'UK South', 'UK West', 'Southeast Asia'], AWS: ['eu-west-1', 'eu-central-1', 'us-east-1', 'us-west-2'], GCP: ['europe-west4', 'us-central1', 'asia-southeast1'],
  mixed: ['West Europe', 'eu-west-1', 'eu-central-1', 'us-east-1', 'UK South'], awsHome: 'eu-west-1', gcpZone: 'europe-west4-a',
};
const CLOUD_REGIONS: CustomerMap<RegionPools> = {
  maritime: TEMPLATE_REGIONS, finserv: TEMPLATE_REGIONS, media: TEMPLATE_REGIONS, healthcare: TEMPLATE_REGIONS, automotive: TEMPLATE_REGIONS,
  insurance: { Azure: ['East US 2', 'East US', 'Central US'], AWS: ['us-east-1', 'us-east-2', 'us-west-2'], GCP: ['us-east4', 'us-central1'], mixed: ['East US 2', 'us-east-1', 'us-east-2', 'Central US'], awsHome: 'us-east-1', gcpZone: 'us-east4-a' },
  defence: { Azure: ['US Gov Virginia', 'US Gov Arizona'], AWS: ['us-gov-west-1', 'us-gov-east-1'], GCP: ['us-east4'], mixed: ['US Gov Virginia', 'US Gov Arizona', 'us-gov-west-1'], awsHome: 'us-gov-west-1', gcpZone: 'us-east4-a' },
  pharma: { Azure: ['Switzerland North', 'West Europe', 'North Europe'], AWS: ['eu-central-2', 'eu-west-1', 'us-east-1'], GCP: ['europe-west6', 'us-east4'], mixed: ['Switzerland North', 'eu-central-2', 'West Europe', 'eu-west-1', 'us-east-1'], awsHome: 'eu-central-2', gcpZone: 'europe-west6-a' },
  sghospital: { Azure: ['Southeast Asia'], AWS: ['ap-southeast-1'], GCP: ['asia-southeast1'], mixed: ['Southeast Asia', 'ap-southeast-1'], awsHome: 'ap-southeast-1', gcpZone: 'asia-southeast1-a' },
  studio: { Azure: ['East US 2', 'Japan East', 'West US 2'], AWS: ['us-west-2', 'us-east-1', 'ap-northeast-1'], GCP: ['us-west1', 'asia-northeast1'], mixed: ['us-west-2', 'us-east-1', 'East US 2', 'Japan East'], awsHome: 'us-west-2', gcpZone: 'us-west1-a' },
};

export function assetEntities(c: CustomerProfile, tenantId: string, n = 150): AssetEntity[] {
  const r = rng(`fab-assets-${c.id}-${tenantId}`);
  const reg = forCustomer(CLOUD_REGIONS, c);
  const sum = assetSummary(c, tenantId);
  const ts = scopedTenants(c, tenantId);
  const conns = scopedConnectors(c, tenantId);
  const people = [c.people.socLead, c.people.otLead ?? c.people.admin, c.people.admin, ...c.people.staff].map((p) => p.name);
  const envWeights = ENVS.map((e) => [e, sum.byEnv[e] + (sum.byEnv[e] ? sum.total * 0.05 : 0)] as const).filter(([, w]) => w > 0);
  const servers = c.vocab.servers;
  const out: AssetEntity[] = [];
  for (let i = 0; i < n; i++) {
    const env = r.weighted(envWeights);
    const mix = forCustomer(TYPE_MIX, c)[env];
    const type = r.weighted(mix.map((m) => [m[0], m[1]] as const));
    const tCands = ts.filter((t) => t.env.includes(env));
    const tenant = tCands.length ? r.pick(tCands) : ts[0];
    const tc = conns.filter((k) => servesTenant(k, tenant.id));
    const prefix = tenant.id.toUpperCase().slice(0, 3);
    let name: string;
    let crownJewel: string | undefined;
    if (i < servers.length && env !== 'ot' && env !== 'saas') {
      name = servers[i];
      if (r.chance(0.5)) crownJewel = r.pick(c.vocab.crownJewels);
    } else if (env === 'ot') {
      const sys = r.pick(c.vocab.otSystems);
      name = `${prefix}-${sys.split(' (')[0].replace(/[^A-Za-z0-9]+/g, '-').toUpperCase().slice(0, 14)}-${String(r.int(1, 48)).padStart(2, '0')}`;
      if (r.chance(0.15)) crownJewel = r.pick(c.vocab.crownJewels);
    } else if (env === 'cloud') {
      const acct = c.vocab.cloudAccounts.find((a) => a.tenant === tenant.id) ?? c.vocab.cloudAccounts[0];
      name = `${acct.name.split(' ')[0]}/${type.includes('bucket') || type.includes('Storage') ? 'st' : type.includes('database') ? 'db' : type.includes('Container') ? 'aks' : 'vm'}-${r.hex(4)}`;
    } else if (env === 'saas') {
      name = r.pick(['Salesforce', 'Workday', 'Slack', 'Box', 'DocuSign', 'Miro', 'Zoom', 'GitHub', 'Atlassian Cloud', 'Frame.io', 'Adobe CC', 'Coupa']) + ` (${tenant.short})`;
    } else {
      name = `${c.vocab.hostPrefix}-${type.startsWith('Work') || type.startsWith('Laptop') || type.startsWith('VDI') ? 'WS' : type.startsWith('Render') ? 'RND' : type.startsWith('Network') ? 'NET' : 'SRV'}-${String(r.int(100, 9999)).padStart(4, '0')}`;
    }
    const ip = env === 'saas' ? '-' : `10.${r.int(10, 250)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const mac = Array.from({ length: 6 }, () => r.hex(2)).join(':');
    const obs: Observation[] = [];
    const gaps: GapKey[] = [];
    const add = (k: Connector | undefined, key: string, value: string, fields: [string, string][]) => {
      if (!k) return;
      obs.push({ source: connShort(k), category: k.category, status: effHealth(k), key, value, lastSeenMin: Math.max(k.lastSyncMin, r.int(1, k.intervalMin * 3)), fields });
    };
    const edr = byCat(tc, 'EDR / XDR')[0];
    const vuln = byCat(tc, 'Vulnerability')[0];
    const cmdb = byCat(tc, 'ITSM', 'Asset / CMDB')[0];
    const cloud = byCat(tc, 'Cloud posture');
    const ot = byCat(tc, 'OT')[0];
    const idp = tc.find((k) => k.id === 'c-entra');
    const netDevice = /network|router|switch/i.test(type);
    const managedSvc = /bucket|storage|database|saas/i.test(type);
    const endpointish = !netDevice && !managedSvc && env !== 'ot';
    if (env === 'cloud') {
      const provider = c.vocab.cloudAccounts.find((a) => name.startsWith(a.name.split(' ')[0]))?.provider ?? 'AWS';
      const rid = provider === 'Azure' ? `/subscriptions/${r.hex(8)}/resourceGroups/rg-prod/providers/${managedSvc ? 'Microsoft.Storage/storageAccounts' : 'Microsoft.Compute/virtualMachines'}/${name.split('/')[1]}` : provider === 'GCP' ? `//compute.googleapis.com/projects/${name.split('/')[0]}/zones/${reg.gcpZone}/instances/${name.split('/')[1]}` : `arn:aws:${managedSvc ? 's3' : 'ec2'}:${reg.awsHome}:${r.int(100000000000, 999999999999)}:${managedSvc ? '' : 'instance/i-'}${r.hex(12)}`;
      for (const k of cloud.slice(0, 2)) add(k, 'Cloud resource ID', rid, [['Provider', provider], ['Region', r.pick(reg.mixed)], ['Public', r.chance(0.1) ? 'Yes' : 'No']]);
      if (!cloud.length) gaps.push('scan');
    }
    if (endpointish) {
      if (edr && r.chance(0.94)) add(edr, 'EDR agent ID', r.hex(32), [['Sensor version', `${r.int(6, 7)}.${r.int(1, 19)}.${r.int(1000, 9999)}`], ['Policy', r.pick(['Prevent', 'Prevent', 'Detect only'])], ['Last check-in', `${r.int(1, 30)} min`]]);
      else gaps.push('edr');
      if (vuln && r.chance(0.9)) add(vuln, r.chance(0.5) ? 'MAC address' : 'FQDN', r.chance(0.5) ? mac : `${name.toLowerCase()}.${c.domain}`, [['Last scan', `${r.int(1, 9)} d ago`], ['Scan type', r.pick(['Credentialed', 'Agent', 'Unauthenticated'])], ['Open vulns', String(r.int(0, 60))]]);
      else if (env !== 'cloud') gaps.push('scan');
      if (idp && /work|laptop|vdi|edit/i.test(type)) add(idp, 'Device object ID', `${r.hex(8)}-${r.hex(4)}-${r.hex(4)}-${r.hex(12)}`, [['Join type', r.pick(['Entra joined', 'Hybrid joined'])], ['Compliant', r.chance(0.9) ? 'Yes' : 'No']]);
    }
    if (env === 'ot') {
      if (ot) add(ot, 'MAC address', mac, [['Purdue level', r.pick(['L1', 'L1', 'L2', 'L2', 'L3'])], ['Vendor', type.split(' ')[0]], ['Protocols', r.pickN(c.vocab.otProtocols, 2).join(', ')], ['Firmware', OS_BY_TYPE(type, r)]]);
      const navis = tc.find((k) => k.id === 'c-navis');
      if (navis && r.chance(0.7)) add(navis, 'Serial number', `SN-${r.hex(10).toUpperCase()}`, [['Equipment', type], ['Asset tag', `EQ-${r.int(10000, 99999)}`]]);
      if (!ot || r.chance(0.18)) gaps.push('scan');
    }
    if (netDevice) {
      const fw = byCat(tc, 'Network')[0];
      add(fw, 'IP + MAC', `${ip} / ${mac}`, [['Role', r.pick(['Edge firewall', 'Core switch', 'Distribution switch', 'WAN router'])]]);
      if (vuln && r.chance(0.8)) add(vuln, 'FQDN', `${name.toLowerCase()}.${c.domain}`, [['Last scan', `${r.int(1, 12)} d ago`]]);
      else gaps.push('scan');
    }
    if (cmdb && env !== 'saas' && r.chance(env === 'ot' ? 0.72 : 0.88)) add(cmdb, 'Serial number', `${r.pick(['CZ', 'MX', 'SG', 'VM'])}${r.hex(8).toUpperCase()}`, [['CI class', env === 'cloud' ? 'cmdb_ci_cloud_resource' : env === 'ot' ? 'cmdb_ci_ot_device' : 'cmdb_ci_computer'], ['Support group', r.pick(['Infra Ops', 'EUC', 'Terminal IT', 'Cloud Platform', 'OT Engineering'])]]);
    else if (env !== 'saas') gaps.push('cmdb');
    if (env === 'saas') {
      const sase = byCat(tc, 'SASE', 'DLP')[0];
      add(sase, 'App instance ID', `${name.split(' ')[0].toLowerCase()}-${r.hex(6)}`, [['Sanctioned', 'Yes'], ['Users (30 d)', String(r.int(40, 2400))]]);
      add(idp ?? byCat(tc, 'Identity')[0], 'SSO app ID', r.hex(16), [['SSO', 'SAML'], ['MFA enforced', r.chance(0.85) ? 'Yes' : 'No']]);
    }
    const owner = r.chance(0.08) ? null : r.pick(people);
    if (!owner) gaps.push('owner');
    const crit = crownJewel ? 5 : env === 'ot' ? r.int(3, 5) : r.weighted([[1, 2], [2, 4], [3, 4], [4, 2], [5, 1]] as const);
    const findings = { critical: r.chance(0.12) ? r.int(1, 3) : 0, high: r.int(0, 9), medium: r.int(0, 30), low: r.int(0, 40) };
    const risk = Math.round(Math.min(100, (findings.critical * 18 + findings.high * 4 + findings.medium * 0.5) * (0.4 + crit * 0.15) + gaps.length * 6));
    out.push({
      id: `ent-${r.hex(10)}`, name, type, env, tenantId: tenant.id, tenantShort: tenant.short, criticality: crit, owner, crownJewel, ip,
      os: OS_BY_TYPE(type, r), findings, gaps: [...new Set(gaps)], obs, risk,
      zone: env === 'ot' ? r.pick(['Level 1 control', 'Level 2 supervisory', 'Level 3 operations', 'Level 3.5 DMZ']) : env === 'cloud' ? 'Cloud VNet / VPC' : env === 'saas' ? 'Internet (SaaS)' : r.pick(['Corporate LAN', 'Server VLAN', 'DMZ', 'Management']),
    });
  }
  return out.sort((a, b) => b.risk - a.risk);
}

export interface MergeSuggestion {
  id: string;
  a: { name: string; source: string; key: string };
  b: { name: string; source: string; key: string };
  shared: string;
  confidence: number;
  reason: string;
}
export function mergeSuggestions(c: CustomerProfile, tenantId: string): MergeSuggestion[] {
  const r = rng(`fab-merge-${c.id}-${tenantId}`);
  const conns = scopedConnectors(c, tenantId);
  const edr = byCat(conns, 'EDR / XDR')[0];
  const vuln = byCat(conns, 'Vulnerability')[0];
  const cmdb = byCat(conns, 'ITSM', 'Asset / CMDB')[0];
  const ot = byCat(conns, 'OT')[0];
  const s = (k?: Connector) => (k ? connShort(k) : 'Syslog');
  const sv = c.vocab.servers;
  const out: MergeSuggestion[] = [
    { id: 'm1', a: { name: sv[3], source: s(edr), key: 'Hostname' }, b: { name: `${sv[3].toLowerCase()}.${c.domain}`, source: s(vuln), key: 'FQDN' }, shared: 'Hostname + domain, same IP in the same 24 h window', confidence: 0.91, reason: 'Weak keys only (hostname, IP); no shared serial' },
    { id: 'm2', a: { name: `${c.vocab.hostPrefix}-WS-${r.int(1000, 9999)}`, source: s(cmdb), key: 'Serial number' }, b: { name: `${c.vocab.hostPrefix}-LT-${r.int(1000, 9999)}`, source: s(edr), key: 'EDR agent ID' }, shared: `Serial ${r.pick(['CZ', 'MX'])}${r.hex(8).toUpperCase()} reported by both`, confidence: 0.97, reason: 'Device renamed after reimage; serial matches' },
    { id: 'm3', a: { name: sv[5], source: s(vuln), key: 'IP' }, b: { name: `${sv[5]}-old`, source: s(cmdb), key: 'Hostname' }, shared: 'IP reuse within 6 h after decommission', confidence: 0.58, reason: 'Possible IP reuse: recommend split, not merge' },
  ];
  if (ot) out.push({ id: 'm4', a: { name: c.vocab.otSystems[0], source: s(ot), key: 'MAC address' }, b: { name: `${c.vocab.otSystems[0].split(' (')[0]} #${r.int(2, 14)}`, source: s(cmdb), key: 'Asset tag' }, shared: `MAC on asset register matches sensor`, confidence: 0.95, reason: 'MAC is decisive for OT (LLD 4.6)' });
  out.push({ id: 'm5', a: { name: sv[7], source: s(edr), key: 'EDR agent ID' }, b: { name: sv[7], source: s(edr), key: 'EDR agent ID' }, shared: 'Two agent IDs, same hardware UUID', confidence: 0.88, reason: 'Agent reinstalled; old sensor still reporting' });
  out.push({ id: 'm6', a: { name: c.vocab.externalHosts[1], source: 'HexaInt', key: 'FQDN' }, b: { name: c.vocab.externalHosts[1], source: s(byCat(conns, 'Cloud posture')[0]), key: 'Cloud resource ID' }, shared: 'Public DNS resolves to the cloud load balancer', confidence: 0.83, reason: 'External attack surface asset linked to its cloud resource' });
  return out;
}

/* =====================================================================
   4. Exposure & vulnerabilities
   ===================================================================== */
export type VulnStatus = 'Open' | 'Ticketed' | 'In remediation' | 'Risk accepted';
export interface VulnRow {
  id: string;
  cve: CveRef;
  sev: Severity;
  env: Env;
  affected: number;
  sources: string[];
  rawFindings: number;
  oldestDays: number;
  slaDays: number;
  overdue: boolean;
  tenantShort: string;
  owner: string;
  status: VulnStatus;
  ticket?: string;
  assets: string[];
  fix: string;
  internetFacing: boolean;
}
export const SLA_DAYS: Record<Severity, number> = { critical: 14, high: 30, medium: 90, low: 180, info: 365 };

export function vulnSources(c: CustomerProfile, tenantId: string): Connector[] {
  return scopedConnectors(c, tenantId).filter((k) => k.category === 'Vulnerability' || k.category === 'Cloud posture' || k.category === 'AppSec' || (k.category === 'OT' && k.read.includes('Vulnerabilities')) || k.read.includes('Vulnerabilities'));
}

export interface ExposureSummary {
  unique: number;
  raw: number;
  bySev: Record<Severity, number>;
  kev: number;
  epssHigh: number;
  overdue: number;
  internet: number;
  byEnv: { env: Env; sev: Record<Severity, number> }[];
  ageing: { bucket: string; sev: Record<Severity, number> }[];
  burn: { labels: string[]; open: number[]; opened: number[]; closed: number[] };
  mttrDays: number;
}
export function exposureSummary(c: CustomerProfile, tenantId: string): ExposureSummary {
  const h = headlines(c, tenantId);
  const r = rng(`fab-exp-sum-${c.id}-${tenantId}`);
  const unique = Math.round(h.fabric.assets * 0.55 + h.ot.otVulns * 0.35);
  const sevParts = split(unique, [0.018, 0.14, 0.46, 0.382]);
  const bySev: Record<Severity, number> = { critical: sevParts[0], high: sevParts[1], medium: sevParts[2], low: sevParts[3], info: 0 };
  const sum = assetSummary(c, tenantId);
  const envW = ENVS.map((e) => sum.byEnv[e] * (e === 'ot' ? 1.4 : e === 'saas' ? 0.2 : 1));
  const byEnv = ENVS.map((env, i) => ({ env, sev: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>, w: envW[i] }));
  for (const s of ['critical', 'high', 'medium', 'low'] as Severity[]) split(bySev[s], envW).forEach((n, i) => (byEnv[i].sev[s] = n));
  const buckets = ['0-7 d', '8-14 d', '15-30 d', '31-60 d', '61-90 d', '90+ d'];
  const ageW: Record<Severity, number[]> = {
    critical: [0.42, 0.28, 0.16, 0.08, 0.04, 0.02], high: [0.22, 0.2, 0.26, 0.17, 0.08, 0.07],
    medium: [0.12, 0.1, 0.18, 0.2, 0.16, 0.24], low: [0.06, 0.06, 0.12, 0.16, 0.16, 0.44], info: [1, 0, 0, 0, 0, 0],
  };
  const ageing = buckets.map((bucket) => ({ bucket, sev: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number> }));
  for (const s of ['critical', 'high', 'medium', 'low'] as Severity[]) split(bySev[s], ageW[s]).forEach((n, i) => (ageing[i].sev[s] = n));
  const overdue = ageing[2].sev.critical + ageing[3].sev.critical + ageing[4].sev.critical + ageing[5].sev.critical + ageing[3].sev.high + ageing[4].sev.high + ageing[5].sev.high + ageing[5].sev.medium;
  const labels = Array.from({ length: 12 }, (_, i) => `W${String(((40 - 11 + i) % 52) + 1).padStart(2, '0')}`);
  const open: number[] = [];
  const opened: number[] = [];
  const closed: number[] = [];
  let v = Math.round(unique * r.float(1.22, 1.35, 2));
  for (let i = 0; i < 12; i++) {
    const o = Math.round(unique * r.float(0.05, 0.08, 3));
    const target = i === 11 ? unique : v - (v - unique) / (12 - i);
    const cl = Math.max(0, Math.round(v + o - target));
    v = i === 11 ? unique : Math.round(target);
    opened.push(o);
    closed.push(cl);
    open.push(v);
  }
  return {
    unique, raw: Math.round(unique * 1.68), bySev, kev: Math.max(1, Math.round(unique * 0.011)), epssHigh: Math.round(unique * 0.024),
    overdue, internet: Math.max(2, Math.round(h.strike.externalAssets * 0.06)),
    byEnv: byEnv.filter((x) => x.w > 0).map(({ env, sev }) => ({ env, sev })), ageing, burn: { labels, open, opened, closed },
    mttrDays: h.strike.meanTimeToRemediateDays,
  };
}

export function vulnRows(c: CustomerProfile, tenantId: string): VulnRow[] {
  const r = rng(`fab-vulns-${c.id}-${tenantId}`);
  const ts = scopedTenants(c, tenantId);
  const share = tenantShare(c, tenantId);
  const srcs = vulnSources(c, tenantId);
  const hasOt = ts.some((t) => t.env.includes('ot'));
  const itsm = byCat(scopedConnectors(c, tenantId), 'ITSM')[0];
  const owners = [c.people.socLead.name, c.people.admin.name, c.people.otLead?.name ?? c.people.grcLead.name, ...c.people.staff.filter((p) => !p.vip).map((p) => p.name)];
  const itCves = r.pickN(CVES, 16);
  const otCves = hasOt ? (c.dataKey === 'maritime' ? ICS_CVES : r.pickN(ICS_CVES, 3)) : [];
  const edge = /PAN-OS|Citrix|Fortinet|FortiGate|Ivanti|IOS XE|ScreenConnect|MOVEit|Cleo/;
  const rows: VulnRow[] = [];
  const mk = (cve: CveRef, env: Env) => {
    const sev = sevOfCvss(cve.cvss);
    const envSrcs = srcs.filter((k) => (env === 'ot' ? k.category === 'OT' || k.category === 'Vulnerability' : env === 'cloud' ? k.category !== 'OT' : k.category === 'Vulnerability' || k.category === 'EDR / XDR'));
    const pick = r.pickN(envSrcs.length ? envSrcs : srcs, r.int(1, Math.min(3, Math.max(1, envSrcs.length))));
    const affected = scale(env === 'ot' ? r.int(4, 120) : edge.test(cve.product) ? r.int(1, 6) : r.int(3, 340), share, 1);
    const oldestDays = r.int(1, sev === 'critical' ? 40 : 160);
    const slaDays = cve.kev && edge.test(cve.product) ? 3 : SLA_DAYS[sev];
    const status: VulnStatus = env === 'ot' ? r.pick(['Open', 'Risk accepted', 'Ticketed'] as const) : r.weighted([['Open', 4], ['Ticketed', 3], ['In remediation', 2], ['Risk accepted', 1]] as const);
    const tenant = r.pick(ts.filter((t) => t.env.includes(env)).length ? ts.filter((t) => t.env.includes(env)) : ts);
    const assetPool = env === 'ot' ? c.vocab.otSystems.map((s, i) => `${tenant.id.toUpperCase().slice(0, 3)}-${s.split(' (')[0].replace(/[^A-Za-z0-9]+/g, '-').toUpperCase().slice(0, 12)}-${String(i + 1).padStart(2, '0')}`) : edge.test(cve.product) ? c.vocab.externalHosts : c.vocab.servers;
    rows.push({
      id: `${cve.id}-${env}`, cve, sev, env, affected, sources: pick.map(connShort), rawFindings: Math.round(affected * pick.length * r.float(1, 1.4, 2)),
      oldestDays, slaDays, overdue: oldestDays > slaDays && status !== 'Risk accepted', tenantShort: tenant.short, owner: r.pick(owners), status,
      ticket: status === 'Ticketed' || status === 'In remediation' ? (itsm?.vendor === 'Atlassian' ? `SEC-${r.int(1200, 4800)}` : `${c.dataKey === 'finserv' ? 'SIR' : 'INC'}${r.int(10000, 99999)}`) : undefined,
      assets: r.pickN(assetPool, Math.min(assetPool.length, Math.min(affected, 5))),
      fix: env === 'ot' ? 'Vendor-approved firmware in next maintenance window; compensating segmentation until then' : edge.test(cve.product) ? 'Apply vendor hotfix and rotate session tokens / credentials' : 'Deploy vendor patch via standard change',
      internetFacing: edge.test(cve.product) || (env === 'cloud' && r.chance(0.3)),
    });
  };
  for (const cve of itCves) mk(cve, edge.test(cve.product) ? 'onprem' : r.chance(0.45) ? 'cloud' : 'onprem');
  for (const cve of otCves) mk(cve, 'ot');
  return rows.sort((a, b) => Number(b.cve.kev) - Number(a.cve.kev) || b.cve.epss * b.affected - a.cve.epss * a.affected);
}

/* =====================================================================
   5. Identity
   ===================================================================== */
interface IdProfile { mfa: number; phish: number; humanPct: number; privileged: number; standing: number; dormantPct: number; guests: number; oldSecrets: number; sod: number | null; risky: number }
const ID_PROFILE: CustomerMap<IdProfile> = {
  maritime: { mfa: 91.4, phish: 38, humanPct: 0.79, privileged: 412, standing: 46, dormantPct: 0.062, guests: 640, oldSecrets: 63, sod: null, risky: 27 },
  finserv: { mfa: 99.3, phish: 81, humanPct: 0.74, privileged: 1840, standing: 14, dormantPct: 0.028, guests: 1180, oldSecrets: 41, sod: 37, risky: 52 },
  media: { mfa: 94.2, phish: 29, humanPct: 0.83, privileged: 214, standing: 23, dormantPct: 0.071, guests: 920, oldSecrets: 28, sod: null, risky: 19 },
  healthcare: { mfa: 97.2, phish: 31, humanPct: 0.81, privileged: 2100, standing: 38, dormantPct: 0.084, guests: 1900, oldSecrets: 74, sod: null, risky: 41 },
  automotive: { mfa: 99.1, phish: 72, humanPct: 0.77, privileged: 3600, standing: 41, dormantPct: 0.045, guests: 4800, oldSecrets: 96, sod: null, risky: 63 },
  insurance: { mfa: 99.0, phish: 64, humanPct: 0.76, privileged: 920, standing: 22, dormantPct: 0.034, guests: 1460, oldSecrets: 38, sod: 29, risky: 34 },
  defence: { mfa: 99.8, phish: 93, humanPct: 0.82, privileged: 148, standing: 9, dormantPct: 0.021, guests: 64, oldSecrets: 14, sod: 11, risky: 7 },
  pharma: { mfa: 98.4, phish: 58, humanPct: 0.78, privileged: 2900, standing: 34, dormantPct: 0.052, guests: 6200, oldSecrets: 88, sod: 46, risky: 58 },
  sghospital: { mfa: 96.1, phish: 34, humanPct: 0.8, privileged: 380, standing: 27, dormantPct: 0.071, guests: 520, oldSecrets: 31, sod: null, risky: 18 },
  studio: { mfa: 95.4, phish: 41, humanPct: 0.84, privileged: 3100, standing: 48, dormantPct: 0.088, guests: 14800, oldSecrets: 112, sod: null, risky: 71 },
};
/** Why standing admin accounts persist, per customer (Identity page callout). */
const STANDING_NOTE: CustomerMap<string> = {
  maritime: 'Removing them is a top Resilience Index driver.',
  finserv: 'Tier 0 is close to zero-standing already.',
  media: 'Removing them is a top Resilience Index driver.',
  healthcare: 'Most are biomedical OEM accounts outside CyberArk.',
  automotive: 'Most are robot-OEM jump items in BeyondTrust.',
  insurance: 'Most sit with Cognizant application support and the mainframe systems team; move them to CyberArk just-in-time.',
  defence: 'Most are Delinea break-glass and OT jump accounts; CMMC AC.L2-3.1.6 expects non-privileged accounts for daily work.',
  pharma: 'Most are OEM and MES integrator accounts at Valais and Cork; GxP change control should gate every elevation.',
  sghospital: 'Most are NCS outsourced service-desk and biomedical OEM accounts; broker them through CyberArk Vendor PAM.',
  studio: 'Most are post-production and ride-systems admins; move them to CyberArk just-in-time with Okta step-up.',
};
export function standingAdminNote(c: CustomerProfile): string {
  return forCustomer(STANDING_NOTE, c);
}
export interface IdentitySummary { total: number; human: number; service: number; mfaPct: number; phishPct: number; privileged: number; standing: number; dormant: number; guests: number; oldSecrets: number; sod: number | null; risky: number }
export function identitySummary(c: CustomerProfile, tenantId: string): IdentitySummary {
  const h = headlines(c, tenantId);
  const p = forCustomer(ID_PROFILE, c);
  const s = tenantShare(c, tenantId);
  const t = scopedTenants(c, tenantId)[0];
  const adj = tenantId === 'all' || !t ? 0 : (t.ri - 80) / 10;
  const human = Math.round(h.fabric.identities * p.humanPct);
  return {
    total: h.fabric.identities, human, service: h.fabric.identities - human,
    mfaPct: Math.min(99.9, +(p.mfa + adj * 0.6).toFixed(1)), phishPct: Math.max(5, Math.round(p.phish + adj * 3)),
    privileged: scale(p.privileged, s, 8), standing: scale(p.standing, s, 1), dormant: Math.round(human * p.dormantPct), guests: scale(p.guests, s, 5),
    oldSecrets: scale(p.oldSecrets, s, 2), sod: p.sod === null ? null : scale(p.sod, s, 1), risky: scale(p.risky, s, 2),
  };
}
export function identitySources(c: CustomerProfile, tenantId: string): Connector[] {
  return scopedConnectors(c, tenantId).filter((k) => k.category === 'Identity' || k.category === 'PAM' || (c.dataKey === 'media' && k.id === 'c-gws'));
}
type MfaMethod = { method: string; pct: number; phish: boolean };
const M = (method: string, pct: number, phish: boolean): MfaMethod => ({ method, pct, phish });
const MFA_METHODS: CustomerMap<MfaMethod[]> = {
  finserv: [M('FIDO2 security key', 34, true), M('Windows Hello for Business', 31, true), M('Okta FastPass', 16, true), M('Authenticator push (number match)', 15, false), M('SMS / voice (legacy, Wealth SG)', 3, false), M('None', 1, false)],
  maritime: [M('Windows Hello for Business', 24, true), M('FIDO2 security key', 9, true), M('Passkey (Authenticator)', 5, true), M('Authenticator push (number match)', 44, false), M('SMS / voice (vessel crew)', 9, false), M('None', 9, false)],
  healthcare: [M('Windows Hello for Business', 21, true), M('FIDO2 security key', 6, true), M('Passkey (Authenticator)', 4, true), M('Authenticator push (number match)', 51, false), M('SMS / voice (affiliated physicians)', 15, false), M('None', 3, false)],
  automotive: [M('Windows Hello for Business', 46, true), M('FIDO2 security key', 21, true), M('Passkey (Authenticator)', 5, true), M('Authenticator push (number match)', 24, false), M('SMS (dealer staff)', 3, false), M('None', 1, false)],
  media: [M('Okta FastPass', 18, true), M('FIDO2 security key', 8, true), M('Passkey', 3, true), M('Okta Verify push', 52, false), M('SMS (freelancers)', 13, false), M('None', 6, false)],
  insurance: [M('Windows Hello for Business', 28, true), M('FIDO2 security key (IT, claims payments, mainframe)', 22, true), M('Okta FastPass (agents & brokers)', 14, true), M('Authenticator push (number match)', 29, false), M('SMS / voice (independent agents, legacy)', 6, false), M('None', 1, false)],
  defence: [M('FIPS YubiKey (FIDO2 / PIV)', 71, true), M('Windows Hello for Business (GCC High)', 22, true), M('Authenticator push (commercial tenant only)', 7, false)],
  pharma: [M('Windows Hello for Business', 34, true), M('FIDO2 security key (GMP & privileged)', 14, true), M('Okta FastPass (US & CRO partners)', 10, true), M('Authenticator push (number match)', 33, false), M('SMS (CRO site staff)', 7, false), M('None', 2, false)],
  sghospital: [M('Windows Hello for Business', 20, true), M('FIDO2 security key', 8, true), M('Passkey (Authenticator)', 6, true), M('Authenticator push (number match)', 46, false), M('SMS OTP (visiting consultants)', 16, false), M('None', 4, false)],
  studio: [M('Okta FastPass', 24, true), M('FIDO2 security key (talent & content security)', 11, true), M('Passkey', 6, true), M('Okta Verify push', 41, false), M('SMS (freelancers & seasonal park staff)', 14, false), M('None', 4, false)],
};
export function mfaMethods(c: CustomerProfile): MfaMethod[] {
  return forCustomer(MFA_METHODS, c);
}
/** Risky sign-ins per day at group level (scaled by tenant share and range). */
const SIGNIN_BASE: CustomerMap<number> = { finserv: 38, maritime: 22, media: 16, healthcare: 31, automotive: 46, insurance: 34, defence: 9, pharma: 52, sghospital: 14, studio: 68 };
export function riskySignins(c: CustomerProfile, tenantId: string, days: number) {
  const r = rng(`fab-signins-${c.id}-${tenantId}-${days}`);
  const s = tenantShare(c, tenantId);
  const n = nPoints(days);
  const base = forCustomer(SIGNIN_BASE, c) * s * (days === 1 ? 1 / 24 : 1);
  const high: number[] = [], medium: number[] = [], low: number[] = [];
  for (let i = 0; i < n; i++) {
    const spike = i === n - Math.max(2, Math.round(n / 5)) ? 3 : 1;
    high.push(Math.round(base * 0.12 * spike * r.float(0.3, 1.6) + (r.chance(0.2) ? 1 : 0)));
    medium.push(Math.round(base * 0.38 * r.float(0.5, 1.5) * spike));
    low.push(Math.round(base * r.float(0.6, 1.4)));
  }
  return { labels: seriesLabels(days), high, medium, low };
}

export interface ItdrDetection { id: string; title: string; technique: string; user: string; source: string; sev: Severity; ageMin: number; detail: string }
type ItdrSeed = Omit<ItdrDetection, 'id' | 'ageMin'>;
/** Service account named in the Kerberoasting detection. */
const KERBEROAST_SVC: CustomerMap<string> = {
  finserv: 't24_batch', maritime: 'veeam', media: 'mam_sync', healthcare: 'epic_interconnect', automotive: 'mes_opcua_bridge',
  insurance: 'guidewire_cc_batch', defence: 'teamcenter_sync', pharma: 'pasx_opcua_bridge', sghospital: 'trakcare_ens', studio: 'aspera_node',
};
const staffName = (c: CustomerProfile, part: string, i: number) => (c.people.staff.find((p) => p.name.includes(part)) ?? c.people.staff[i % c.people.staff.length]).name;
/** Sector-specific ITDR detections: `first` lead the list, `last` close it. */
const ITDR_EXTRA: CustomerMap<(c: CustomerProfile) => { first?: ItdrSeed[]; last?: ItdrSeed[] }> = {
  maritime: () => ({}),
  media: () => ({}),
  finserv: () => ({ last: [{ title: 'RACF SPECIAL attribute granted to a batch ID', technique: 'T1098', user: 'BATCHP07', source: 'z/OS RACF', sev: 'critical', detail: 'Change outside the mainframe change window (SMF type 80)' }] }),
  healthcare: (c) => ({ first: [{ title: 'Badge-tap session reused across two nursing units', technique: 'T1550', user: c.people.staff[8].name, source: 'Imprivata', sev: 'medium', detail: 'Same Imprivata session token seen on WOW carts in ICU and Med-Surg within 2 minutes' }] }),
  automotive: () => ({ first: [{ title: 'Robot-OEM jump item used outside its approved window', technique: 'T1133', user: 'kuka-service07', source: 'BeyondTrust', sev: 'high', detail: 'Session to Ingolstadt body-shop cell 4 at 02:14 with no linked maintenance order' }] }),
  insurance: () => ({
    first: [{ title: 'EXL adjuster changed claimant payee details from an unmanaged browser', technique: 'T1078', user: 'exl-adj-pune114', source: 'Island', sev: 'high', detail: '23 payee bank-detail changes in ClaimCenter in 40 minutes; Island policy bypassed via a personal Chrome profile' }],
    last: [{ title: 'RACF SPECIAL attribute granted to a policy-admin batch ID', technique: 'T1098', user: 'KMIBAT09', source: 'z/OS RACF', sev: 'critical', detail: 'Granted on KMI-ZOS-PRD1 outside the mainframe change window (SMF type 80); no linked ServiceNow change' }],
  }),
  defence: (c) => ({
    first: [{ title: 'GCC High session token replayed from a non-US network', technique: 'T1539', user: staffName(c, 'Erin', 6), source: 'Entra ID (GCC High)', sev: 'critical', detail: 'Token issued after a YubiKey sign-in in Huntsville reused from a VPS abroad 6 minutes later; CUI enclave access blocked by Conditional Access' }],
    last: [{ title: 'Machine-tool vendor jump item used outside its approved window', technique: 'T1133', user: 'haas-svc-b3', source: 'BeyondTrust', sev: 'high', detail: 'Session to SPD-JUMP-OT01 at 01:52 with no linked work order; DNC programme share listed' }],
  }),
  pharma: (c) => ({
    first: [{ title: 'CRO monitor account bulk-exported Rave data from a new ASN', technique: 'T1078', user: 'icon-cra-0417', source: 'Okta', sev: 'high', detail: 'ICON CRA signed in through the Okta partner portal from an unfamiliar network and exported 14 RHN-4471 site datasets' }],
    last: [{ title: 'Part 11 e-signature certificate used from two workstations at once', technique: 'T1649', user: staffName(c, 'Reto', 6), source: 'Keyfactor', sev: 'medium', detail: 'Signing certificate presented from a Valais QA PC and a Basel laptop within 3 minutes during batch release' }],
  }),
  sghospital: (c) => ({
    first: [{ title: 'Badge-tap session reused across two wards', technique: 'T1550', user: staffName(c, 'Joel', 11), source: 'Imprivata', sev: 'medium', detail: 'Same Imprivata session seen on shared workstations in ICU and Ward 7 within 2 minutes' }],
    last: [{ title: 'Vendor PAM session to the TrakCare database outside its window', technique: 'T1133', user: 'isc-support-sg', source: 'CyberArk', sev: 'high', detail: 'InterSystems support session to OBH-TRAK-DB01 at 02:31 SGT with no approved change' }],
  }),
  studio: () => ({
    first: [{ title: 'Freelancer added a new Okta factor, then pulled Aspera packages', technique: 'T1098', user: 'freelance-vfx-2291', source: 'Okta', sev: 'high', detail: 'Factor reset by help desk, then 41 Lodestar plate downloads from a new device within the hour' }],
    last: [{ title: 'Seasonal park account re-activated without a rehire record', technique: 'T1078', user: 'orl-seasonal-0884', source: 'Entra ID', sev: 'medium', detail: 'Account unused for 211 days signed in to StarPass back office from a home network' }],
  }),
};
export function itdrDetections(c: CustomerProfile, tenantId: string, days: number): ItdrDetection[] {
  const r = rng(`fab-itdr-${c.id}-${tenantId}`);
  const srcs = identitySources(c, tenantId);
  const sname = (pref: string) => connShort(srcs.find((k) => connShort(k).includes(pref)) ?? srcs[0] ?? c.connectors[0]);
  const edrName = c.connectors.some((k) => k.category === 'EDR / XDR') ? connShort(c.connectors.find((k) => k.category === 'EDR / XDR')!) : sname('');
  const ppl = c.people.staff;
  const idpPref = srcs.some((k) => connShort(k).includes('Okta')) ? 'Okta' : 'Entra';
  const pamPref = srcs.some((k) => k.category === 'PAM') ? connShort(srcs.find((k) => k.category === 'PAM')!) : idpPref;
  const svcName = forCustomer(KERBEROAST_SVC, c);
  const lib: Omit<ItdrDetection, 'id' | 'ageMin'>[] = [
    { title: 'MFA fatigue: repeated push prompts then approved', technique: 'T1621', user: ppl[4].name, source: sname(idpPref), sev: 'high', detail: 'Approved from an unfamiliar ASN; session revoked pending review' },
    { title: 'Password spray across many accounts from residential proxies', technique: 'T1110.003', user: 'Multiple (212)', source: sname('Entra'), sev: 'medium', detail: 'Smart lockout engaged; a few accounts still allow legacy auth' },
    { title: 'Kerberoasting: RC4 service tickets requested for several SPNs', technique: 'T1558.003', user: `svc_${svcName}`, source: edrName, sev: 'high', detail: 'Requested from a workstation that never queried these SPNs before' },
    { title: 'Help-desk MFA reset followed by new device enrolment', technique: 'T1098', user: ppl[0].name, source: sname(idpPref), sev: c.dataKey === 'finserv' || c.dataKey === 'healthcare' ? 'critical' : 'high', detail: 'Caller passed knowledge-based checks; pattern matches known social-engineering crews' },
    { title: 'Token replay: one session seen from two countries', technique: 'T1539', user: ppl[1].name, source: sname('Entra'), sev: 'high', detail: 'Same session identifier from two cities within minutes' },
    { title: 'Privileged role assigned outside PIM / change window', technique: 'T1098', user: c.people.admin.name, source: sname(pamPref), sev: 'medium', detail: 'Administrator role granted permanently; no linked change record' },
    { title: 'Dormant vendor account re-activated and signed in', technique: 'T1078', user: `${c.thirdParties[0].name.split(' ')[0].toLowerCase()}-support01`, source: sname(pamPref), sev: 'high', detail: `${c.thirdParties[0].name} account unused for 143 days` },
    { title: 'OAuth app granted broad mailbox read consent', technique: 'T1550.001', user: ppl[5].name, source: sname('Entra'), sev: 'medium', detail: 'Unverified publisher; consent by a non-admin via a misconfigured policy' },
  ];
  const extra = forCustomer(ITDR_EXTRA, c)(c);
  if (extra.first) lib.unshift(...extra.first);
  if (extra.last) lib.push(...extra.last);
  const n = Math.min(lib.length, Math.max(4, Math.round(lib.length * Math.min(1, 0.5 + days / 30))));
  return lib.slice(0, n).map((d, i) => ({ ...d, id: `ITDR-${r.int(1000, 9999)}`, ageMin: Math.round(((i + 1) * days * 1440) / (n + 2) * r.float(0.4, 1, 2)) }));
}

export interface SvcAccount { name: string; secretAgeDays: number; lastUsedDays: number; owner: string | null; vaulted: boolean; privileged: boolean; source: string; system: string }
export function serviceAccounts(c: CustomerProfile, tenantId: string): SvcAccount[] {
  const r = rng(`fab-svc-${c.id}-${tenantId}`);
  const srcs = identitySources(c, tenantId);
  const names: CustomerMap<[string, string][]> = {
    maritime: [['svc_veeam', 'Veeam B&R'], ['svc_navis_n4', 'Navis N4 TOS'], ['svc_sap_rfc', 'SAP S/4HANA'], ['sp-edi-gateway', 'EDI gateway (AWS)'], ['svc_ocr_lanes', 'Gate OCR'], ['svc_historian', 'ANT historian'], ['sp-booking-api', 'Booking portal'], ['svc_scan_tenable', 'Tenable scanner']],
    finserv: [['svc_t24_batch', 'Temenos T24'], ['svc_swift_aa', 'SWIFT Alliance Access'], ['BATCHP07', 'z/OS batch'], ['sp-cde-tokeniser', 'Card tokenisation (Azure)'], ['svc_oms_fix', 'Markets OMS FIX gateway'], ['svc_sql_lend', 'Lending SQL'], ['iam-markets-quant-ci', 'AWS CI role (Markets)'], ['svc_rubrik', 'Rubrik']],
    media: [['svc_mam_sync', 'MAM'], ['svc_aspera', 'Aspera transfer'], ['svc_render_mgr', 'Render manager'], ['iam-content-vault-ci', 'AWS content vault CI'], ['svc_avid_ldap', 'Avid NEXIS'], ['sa-render-burst', 'GCP render burst'], ['svc_playout_api', 'Playout automation'], ['svc_jira_bot', 'Jira automation']],
    healthcare: [['svc_epic_interconnect', 'Epic Interconnect'], ['svc_clarity_etl', 'Epic Clarity ETL'], ['svc_pacs_dicom', 'PACS DICOM router'], ['svc_alaris_sync', 'Alaris pump server'], ['svc_hl7_engine', 'HL7 interface engine'], ['sp-mychart-api', 'MyChart API (Azure)'], ['iam-genomics-pipeline', 'AWS genomics pipeline'], ['svc_cohesity', 'Cohesity']],
    automotive: [['svc_mes_opcua_bridge', 'MES OPC UA bridge'], ['svc_sap_rfc_pp', 'SAP S/4 production'], ['svc_tc_export', 'Teamcenter export'], ['iam-ota-signer', 'OTA signing (AWS KMS)'], ['svc_dms_sync', 'DealerCore DMS sync'], ['iam-vehicle-api-ci', 'Vehicle API CI role'], ['svc_rubrik_plc', 'Rubrik PLC backup'], ['sa-sim-hpc', 'GCP simulation HPC']],
    insurance: [['svc_guidewire_cc_batch', 'Guidewire ClaimCenter batch'], ['KMIBAT09', 'z/OS batch (policy admin)'], ['svc_bc_payments', 'BillingCenter payments (One Inc)'], ['svc_mft_sftp', 'Managed file transfer'], ['sp-agenthub-api', 'AgentHub API (Azure)'], ['iam-telematics-ingest', 'Telematics lake ingest (AWS)'], ['svc_actuarial_sql', 'Actuarial reserving SQL'], ['svc_rubrik', 'Rubrik']],
    defence: [['svc_teamcenter_sync', 'Teamcenter PLM'], ['svc_dnc_transfer', 'Building 3 DNC server'], ['svc_costpoint_api', 'Deltek Costpoint GovCloud'], ['svc_ghes_ci', 'GitHub Enterprise Server CI'], ['svc_flexlm', 'FlexLM licences (Ansys, NX)'], ['sp-gcch-sentinel', 'Sentinel (Azure Government)'], ['svc_aveva_hist', 'AVEVA historian'], ['iam-range-data-sync', 'Tucson range data (GovCloud)']],
    pharma: [['svc_pasx_opcua_bridge', 'PAS-X MES OPC UA bridge'], ['svc_deltav_pi', 'DeltaV to PI interface'], ['svc_sap_rfc_qm', 'SAP S/4HANA QM (batch release)'], ['svc_veeva_bridge', 'Veeva Vault integration'], ['svc_labware_lims', 'LabWare LIMS'], ['iam-rave-export', 'Rave EDC export (AWS)'], ['sp-molgen-train', 'MolGen training pipeline (Azure)'], ['svc_serial_l4', 'Serialisation L4 (Cork)']],
    sghospital: [['svc_trakcare_ens', 'TrakCare HealthShare ensemble'], ['svc_nehr_contrib', 'NEHR contribution (HealthConnect)'], ['svc_pacs_dicom', 'PACS DICOM router'], ['svc_alaris_sync', 'Alaris pump server'], ['svc_lis_hl7', 'LIS HL7 interface'], ['sp-patient-portal', 'Patient portal API (Azure)'], ['iam-imaging-ai', 'Chest X-ray AI (AWS)'], ['svc_cohesity', 'Cohesity']],
    studio: [['svc_aspera_node', 'Aspera on Cloud node'], ['svc_mam_sync', 'Media asset management'], ['svc_deadline_render', 'Render manager (Deadline)'], ['iam-content-vault-ci', 'Pre-release vault CI (AWS)'], ['svc_signiant_jet', 'Signiant Jet'], ['iam-starfallplus-drm', 'Starfall+ DRM licences (AWS)'], ['svc_ridectl_hist', 'Ride control historian (Orlando)'], ['svc_starpass_api', 'StarPass ticketing API']],
  };
  const people = [c.people.admin.name, c.people.socLead.name, ...c.people.staff.filter((p) => !p.vip).map((p) => p.name)];
  return forCustomer(names, c).map(([name, system]) => ({
    name, system, secretAgeDays: r.int(180, 1460), lastUsedDays: r.int(0, 40), owner: r.chance(0.2) ? null : r.pick(people),
    vaulted: r.chance(0.45), privileged: r.chance(0.55), source: srcs.length ? connShort(r.pick(srcs)) : '-',
  })).sort((a, b) => b.secretAgeDays - a.secretAgeDays);
}

export interface SodConflict { rule: string; process: string; users: number; source: string; regime: string }
interface SodSpec { hint: string; source: string; sub: string; rules: [Omit<SodConflict, 'users'>, number][] }
const R = (rule: string, process: string, source: string, regime: string, w: number): [Omit<SodConflict, 'users'>, number] => [{ rule, process, source, regime }, w];
/** Segregation-of-duties rule sets (null: not tracked for this customer). Weights split the headline count. */
const SOD: CustomerMap<SodSpec | null> = {
  maritime: null, media: null, healthcare: null, automotive: null, sghospital: null, studio: null,
  finserv: {
    hint: 'SailPoint', source: 'SailPoint IdentityIQ · z/OS RACF', sub: 'Toxic entitlement combinations from SailPoint — regulated financial controls',
    rules: [
      R('Create beneficiary + approve payment', 'Faster Payments / CHAPS', 'SailPoint', 'PRA SS1/21 · SOX', 9),
      R('Trade entry + trade confirmation', 'Equities OMS (Markets)', 'SailPoint', 'NYDFS 500.7 · SEC', 7),
      R('Vendor master create + AP invoice approve', 'Procure-to-pay', 'SailPoint', 'SOX ITGC', 6),
      R('RACF SPECIAL + audit log administration', 'Mainframe z/OS ledger', 'z/OS RACF', 'DORA Art. 9 · SOX', 3),
      R('SWIFT message create + release', 'SWIFT Alliance Access', 'SailPoint', 'SWIFT CSCF 5.1', 5),
      R('Card limit change + limit approval', 'Card authorisation switch', 'SailPoint', 'PCI DSS 7.2', 7),
    ],
  },
  insurance: {
    hint: 'SailPoint · z/OS RACF', source: 'SailPoint Identity Security Cloud · z/OS RACF', sub: 'Toxic entitlement combinations in claims, billing and the mainframe — NAIC MAR and NYDFS 500.7 controls',
    rules: [
      R('Create claimant payee + approve claim payment', 'ClaimCenter payments (One Inc)', 'SailPoint', 'NAIC MAR · SOX ITGC', 8),
      R('Set reserve + approve reserve change', 'ClaimCenter reserving', 'SailPoint', 'NAIC MAR (reserving controls)', 6),
      R('Issue policy + apply premium refund', 'BillingCenter', 'SailPoint', 'NAIC MAR · PCI DSS 7.2', 5),
      R('RACF SPECIAL + audit log administration', 'Mainframe policy admin (z/OS)', 'z/OS RACF', 'NYDFS 500.7 · NAIC MAR', 3),
      R('Vendor master create + AP invoice approve', 'Procure-to-pay', 'SailPoint', 'SOX ITGC', 4),
      R('SIU case close + claim payment release', 'Claims & SIU', 'SailPoint', 'NYDFS 500.7 · state fraud statutes', 3),
    ],
  },
  defence: {
    hint: 'Costpoint · Entra (GCC High)', source: 'Deltek Costpoint · Entra ID (GCC High) · Teamcenter', sub: 'Toxic entitlement combinations in DCAA-audited finance, export control and the CUI enclave',
    rules: [
      R('Timesheet entry + timesheet approval (own charge numbers)', 'Costpoint timekeeping', 'Deltek Costpoint', 'DCAA timekeeping · DFARS 252.242-7006', 5),
      R('Vendor create + AP payment approve', 'Costpoint procure-to-pay', 'Deltek Costpoint', 'DFARS 252.242-7006 (accounting system)', 3),
      R('Export licence entry + shipment release', 'Trade compliance (ITAR / EAR)', 'Entra ID (GCC High)', 'ITAR 22 CFR 120–130', 2),
      R('ITAR item administration + bulk export of item data', 'Teamcenter PLM', 'Teamcenter', 'ITAR · NIST 800-171 3.1.3', 2),
      R('Audit log administration + privileged administration', 'Sentinel (Azure Government)', 'Entra ID (GCC High)', 'NIST 800-171 3.3.9 · 3.1.4', 2),
    ],
  },
  pharma: {
    hint: 'SailPoint · SAP · Okta', source: 'SailPoint Identity Security Cloud · SAP S/4HANA · Okta', sub: 'Toxic entitlement combinations in GxP systems — batch records, release, LIMS, RTSM unblinding and DCS recipes',
    rules: [
      R('Execute batch record step + QA review of the same batch', 'PAS-X electronic batch records', 'SailPoint', 'EU GMP Annex 11 §12 · Part 11.10(g)', 10),
      R('Create batch + QP certification (release)', 'SAP S/4HANA QM', 'SailPoint', 'EU GMP Annex 16 · Part 11', 7),
      R('LIMS result entry + result approval', 'LabWare LIMS', 'SailPoint', 'Part 11.10(g) · ALCOA+ data integrity', 9),
      R('Unblinded RTSM role + blinded study-team role', 'Medidata Rave RTSM', 'Okta', 'ICH E6(R3) · EU CTR', 5),
      R('Vendor master create + AP invoice approve', 'Procure-to-pay (SAP)', 'SailPoint', 'Swiss CO internal control system', 6),
      R('DeltaV configuration + recipe approval', 'DeltaV DCS (Valais)', 'SailPoint', 'GAMP 5 · Annex 11 §10', 4),
    ],
  },
};
export function sodMeta(c: CustomerProfile): Omit<SodSpec, 'rules'> | null {
  const s = forCustomer(SOD, c);
  return s ? { hint: s.hint, source: s.source, sub: s.sub } : null;
}
export function sodConflicts(c: CustomerProfile, tenantId: string): SodConflict[] {
  const spec = forCustomer(SOD, c);
  if (!spec) return [];
  const total = identitySummary(c, tenantId).sod ?? 0;
  const parts = split(total, spec.rules.map((x) => x[1]));
  return spec.rules.map(([x], i) => ({ ...x, users: parts[i] })).filter((x) => x.users > 0);
}

export interface RiskyIdentity { id: string; name: string; upn: string; kind: 'Human' | 'Service' | 'Guest / vendor'; tenantShort: string; risk: Severity; signals: string[]; mfa: string; privileged: boolean; lastSignInMin: number; sources: string[]; role: string }
export function riskyIdentities(c: CustomerProfile, tenantId: string): RiskyIdentity[] {
  const r = rng(`fab-riskyid-${c.id}-${tenantId}`);
  const ts = scopedTenants(c, tenantId);
  const srcs = identitySources(c, tenantId).map(connShort);
  const methods = mfaMethods(c);
  const sigLib = ['Impossible travel', 'Unfamiliar sign-in properties', 'MFA fatigue', 'Leaked credentials (HexaInt)', 'Anonymous IP / Tor', 'Infostealer log match', 'New device + MFA reset', 'Token anomaly', 'Admin role standing', 'Dormant 90+ days', 'Password spray target'];
  const ppl = [c.people.ciso, c.people.socLead, c.people.admin, c.people.board, ...c.people.staff];
  const out: RiskyIdentity[] = ppl.map((p) => {
    const t = r.pick(ts);
    const risk = r.weighted([['high', 3], ['medium', 5], ['low', 3]] as const) as Severity;
    return {
      id: `id-${r.hex(8)}`, name: p.name, upn: p.email, kind: 'Human' as const, tenantShort: t.short, risk: p.vip && r.chance(0.5) ? 'high' : risk,
      signals: r.pickN(sigLib, r.int(1, 3)), mfa: r.weighted(methods.map((m) => [m.method, m.pct] as const)), privileged: p === c.people.admin || p === c.people.socLead || r.chance(0.15),
      lastSignInMin: r.int(2, 4000), sources: r.pickN(srcs.length ? srcs : ['Directory'], Math.min(2, Math.max(1, srcs.length))), role: p.role,
    };
  });
  for (const tp of c.thirdParties.slice(0, 4)) {
    out.push({
      id: `id-${r.hex(8)}`, name: `${tp.name.split(' ')[0]} support account`, upn: `${tp.name.split(' ')[0].toLowerCase()}-support01@${c.domain}`, kind: 'Guest / vendor', tenantShort: r.pick(ts).short,
      risk: tp.rating < 70 ? 'high' : 'medium', signals: r.pickN(['Dormant 90+ days', 'Shared credential suspected', 'No MFA on vendor IdP', 'Access outside window'], 2), mfa: tp.rating < 65 ? 'None' : 'Authenticator push',
      privileged: tp.tier === 1, lastSignInMin: r.int(60, 200000), sources: srcs.slice(0, 2), role: tp.access,
    });
  }
  for (const s of serviceAccounts(c, tenantId).slice(0, 4)) {
    out.push({ id: `id-${r.hex(8)}`, name: s.name, upn: `${s.name}@${c.domain}`, kind: 'Service', tenantShort: r.pick(ts).short, risk: s.privileged && !s.vaulted ? 'high' : 'medium', signals: [`Secret ${s.secretAgeDays} d old`, s.vaulted ? 'Vaulted' : 'Not vaulted'], mfa: 'n/a (non-interactive)', privileged: s.privileged, lastSignInMin: s.lastUsedDays * 1440 + 30, sources: [s.source], role: s.system });
  }
  const rank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  return out.sort((a, b) => rank[b.risk] - rank[a.risk]);
}

/* =====================================================================
   6. Cloud posture
   ===================================================================== */
export interface ToxicCombo { title: string; resource: string; factors: string[]; sev: Severity }
export interface DataStore { name: string; classification: string; records: string; publicAccess: boolean; encrypted: string }
export interface CloudAccount {
  name: string;
  provider: 'Azure' | 'AWS' | 'GCP';
  tenantId: string;
  tenantShort: string;
  sources: Connector[];
  score: number | null;
  findings: Record<Severity, number>;
  cis: number;
  publicExposed: number;
  resources: number;
  regions: string[];
  toxic: ToxicCombo[];
  dataStores: DataStore[];
  failing: { id: string; title: string; failed: number }[];
  trend: number[];
}
const CIS: Record<'Azure' | 'AWS' | 'GCP', { bench: string; controls: [string, string][] }> = {
  Azure: { bench: 'CIS Microsoft Azure Foundations 2.1', controls: [['1.1.1', 'MFA enabled for all privileged users'], ['3.1', 'Secure transfer required on storage accounts'], ['4.1.1', 'SQL server auditing enabled'], ['6.1', 'RDP access from the internet restricted'], ['6.2', 'SSH access from the internet restricted'], ['8.5', 'Key Vault recoverable (purge protection)'], ['5.1.1', 'Diagnostic settings exist for activity logs']] },
  AWS: { bench: 'CIS AWS Foundations 3.0', controls: [['1.5', 'MFA enabled for the root user'], ['1.14', 'Access keys rotated within 90 days'], ['2.1.1', 'S3 buckets deny HTTP requests'], ['2.1.4', 'S3 Block Public Access enabled'], ['3.1', 'CloudTrail enabled in all regions'], ['5.2', 'No security group opens admin ports to the internet'], ['2.2.1', 'EBS default encryption enabled']] },
  GCP: { bench: 'CIS Google Cloud Platform 2.0', controls: [['1.4', 'Only GCP-managed service account keys'], ['3.6', 'SSH restricted from the internet'], ['4.4', 'OS Login enabled'], ['5.1', 'Cloud Storage buckets not publicly accessible'], ['6.4', 'Cloud SQL requires SSL'], ['7.1', 'BigQuery datasets not publicly accessible'], ['2.1', 'Cloud Audit Logging configured']] },
};
export function cisBenchmark(p: 'Azure' | 'AWS' | 'GCP'): string {
  return CIS[p].bench;
}
const STORES: CustomerMap<[string, string][]> = {
  maritime: [['Booking customer DB', 'PII'], ['EDI message archive', 'Commercial'], ['Crew records', 'PII (crew, passports)'], ['Fleet telemetry lake', 'Operational'], ['Customs manifest store', 'Regulated'], ['Finance exports', 'Financial']],
  finserv: [['Customer data warehouse', 'PII · Restricted'], ['Card token vault (CDE)', 'PCI'], ['Trade blotter archive', 'MNPI'], ['KYC document store', 'PII · Restricted'], ['Model training extracts', 'Confidential'], ['Regulatory reporting lake', 'Restricted']],
  media: [['Pre-release masters vault', 'Content: pre-release'], ['Subscriber DB', 'PII · payment tokens'], ['Dailies proxies', 'Content: pre-release'], ['Render outputs', 'Content: WIP'], ['Marketing key art', 'Embargoed'], ['Viewing analytics', 'PII (pseudonymised)']],
  healthcare: [['MyChart patient portal DB', 'ePHI'], ['Genomics cohort GX-2026', 'ePHI (de-identified)'], ['Clinical trial datasets', 'ePHI · 21 CFR Part 11'], ['Imaging archive replica', 'ePHI (DICOM)'], ['Telehealth recordings', 'ePHI'], ['Revenue-cycle exports', 'ePHI · PCI']],
  automotive: [['Vehicle telemetry lake', 'Personal data (location)'], ['OTA package repository', 'Restricted · R156'], ['Owner accounts DB', 'PII'], ['Simulation results', 'Confidential (TISAX)'], ['Dealer finance data', 'PII · financial'], ['Design render archive', 'Strictly confidential (pre-launch)']],
  insurance: [['ClaimCenter reporting replica', 'NPI · claims (incl. medical)'], ['Premium payment tokens (CDE)', 'PCI'], ['Telematics trip lake (UBI)', 'Personal data (location, driving)'], ['Actuarial reserving extracts', 'Confidential · MNPI'], ['Claims document repository', 'NPI · litigation hold'], ['Agent & broker commissions', 'Financial']],
  defence: [['CUI document library (GCC High)', 'CUI · ITAR'], ['Engineering HPC scratch', 'CUI//SP-EXPT'], ['Historian replica (Building 3)', 'Operational · CUI'], ['Range telemetry archive', 'CUI · export-controlled'], ['Costpoint finance exports', 'Financial · DCAA'], ['Proposal volumes (capture)', 'CUI · proprietary']],
  pharma: [['Rave EDC exports (RHN-4471)', 'Clinical · pseudonymised'], ['Pharmacovigilance case store', 'Health data (GDPR Art. 9)'], ['Compound library & assay data', 'Trade secret'], ['MolGen training sets', 'Trade secret · IP'], ['Manufacturing analytics lake', 'GxP · ALCOA+'], ['Patient-services CRM (US)', 'PHI (HIPAA)']],
  sghospital: [['Patient portal DB', 'Patient data (HIA)'], ['Chest X-ray AI training set', 'Patient data (de-identified)'], ['Clinical research dataset CR-HEART-22', 'Patient data · research'], ['Telehealth recordings', 'Patient data (HIA)'], ['Insurer claims exports', 'Patient data · financial'], ['Oncology registry ONC-SG-07', 'Patient data (de-identified)']],
  studio: [['Pre-release vault (Object Lock)', 'Content: pre-release'], ['Starfall+ subscriber DB', 'PII · payment tokens'], ['Dailies proxies', 'Content: pre-release'], ['Render outputs (burst)', 'Content: WIP'], ['StarPass guest profiles', 'PII · biometric (opt-in)'], ['Viewing analytics', 'PII (pseudonymised)']],
};
function coversProvider(k: Connector, p: 'Azure' | 'AWS' | 'GCP'): boolean {
  if (/Defender for Cloud/.test(k.product)) return p === 'Azure';
  if (/Security Hub/.test(k.product)) return p === 'AWS';
  return true;
}
export function cloudAccounts(c: CustomerProfile, tenantId: string): CloudAccount[] {
  const posture = byCat(c.connectors, 'Cloud posture');
  return c.vocab.cloudAccounts
    .filter((a) => tenantId === 'all' || a.tenant === tenantId)
    .map((a) => {
      const r = rng(`fab-cloud-${c.id}-${a.name}`);
      const sources = posture.filter((k) => servesTenant(k, a.tenant) && coversProvider(k, a.provider));
      const tenant = c.tenants.find((t) => t.id === a.tenant);
      const resources = r.int(220, 4800);
      const covered = sources.length > 0;
      const score = covered ? r.int(58, 88) : null;
      const findings: Record<Severity, number> = covered ? { critical: r.int(0, 6), high: r.int(6, 48), medium: r.int(40, 220), low: r.int(60, 380), info: 0 } : { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      const stores = r.pickN(forCustomer(STORES, c), r.int(2, 4));
      const cis = CIS[a.provider];
      const toxic: ToxicCombo[] = [];
      if (covered) {
        const tox = [
          { title: `Internet-exposed VM with a KEV-listed CVE and an identity that can read "${stores[0][0]}"`, factors: ['Public IP', 'KEV CVE', 'Over-privileged identity', 'Sensitive data'], sev: 'critical' as Severity },
          { title: `Storage holding ${stores[0][1]} data reachable from a public endpoint without private link`, factors: ['Public endpoint', 'Sensitive data', 'No private link'], sev: 'high' as Severity },
          { title: 'CI/CD role with a long-lived access key can assume production admin', factors: ['Access key > 90 d', 'Admin trust', 'No MFA condition'], sev: 'high' as Severity },
          { title: 'Container with a critical CVE running privileged in a cluster with a public API server', factors: ['Critical CVE', 'Privileged pod', 'Public API server'], sev: 'high' as Severity },
        ];
        toxic.push(...r.pickN(tox, r.int(1, 3)).map((t) => ({ ...t, resource: `${a.name}/${r.pick(['vm', 'st', 'aks', 'role', 'fn'])}-${r.hex(4)}` })));
      }
      return {
        name: a.name, provider: a.provider, tenantId: a.tenant, tenantShort: tenant?.short ?? a.tenant, sources, score, findings,
        cis: covered ? r.int(61, 93) : 0, publicExposed: covered ? r.int(1, 26) : 0, resources,
        regions: r.pickN(forCustomer(CLOUD_REGIONS, c)[a.provider], 2),
        toxic,
        dataStores: stores.map(([name, classification]) => ({ name, classification, records: `${r.int(1, 900)}${r.pick(['k', 'M'])} objects`, publicAccess: r.chance(0.12), encrypted: c.byok ? 'CMK (customer HSM)' : 'Provider-managed key' })),
        failing: covered ? r.pickN(cis.controls, 4).map(([id, title]) => ({ id, title, failed: r.int(1, 64) })).sort((x, y) => y.failed - x.failed) : [],
        trend: covered ? (() => { let v = (score ?? 70) - r.int(4, 12); return Array.from({ length: 12 }, (_, i) => (i === 11 ? (score ?? 70) : (v = Math.min(100, v + r.float(-1, 2))))).map(Math.round); })() : [],
      };
    });
}

/* =====================================================================
   7. Attack paths (defensive: entry points to crown jewels, choke points)
   ===================================================================== */
export type PathNodeKind = 'entry' | 'identity' | 'host' | 'ot' | 'jewel';
export interface PathNode { id: string; label: string; kind: PathNodeKind; sub: string }
export interface AttackPath { id: string; name: string; steps: string[]; techniques: string[]; tenants: string[]; likelihood: 'High' | 'Medium' | 'Low'; actor: string; evidence: string }
export interface ChokePoint { node: PathNode; paths: number; fix: string; effort: string; owner: string }

interface PathSpec { nodes: PathNode[]; paths: Omit<AttackPath, 'id'>[]; fixes: Record<string, [string, string]> }

/** Extra wording for the Attack paths intro, naming the routes that matter most for each customer. */
const PATHS_NOTE: CustomerMap<string> = {
  maritime: ', including IT→OT routes to the crane PLCs',
  finserv: '', media: '', healthcare: '', automotive: '',
  insurance: ', including help-desk routes to the z/OS mainframe and BPO access into ClaimCenter',
  defence: ', including vendor routes into the Building 3 DNC server and phishing routes into the CUI enclave',
  pharma: ', including OEM routes to the Valais DeltaV DCS and CRO access into Rave EDC',
  sghospital: ', including biomedical routes to the infusion pump server and vendor access into TrakCare',
  studio: ', including VFX-vendor routes into the pre-release vault and OEM access to ride control',
};
export function pathsIntroNote(c: CustomerProfile): string {
  return forCustomer(PATHS_NOTE, c);
}

const PN = (id: string, label: string, kind: PathNodeKind, sub: string): PathNode => ({ id, label, kind, sub });
const tpBy = (c: CustomerProfile, prefix: string) => c.thirdParties.find((t) => t.name.startsWith(prefix)) ?? c.thirdParties[0];
const personBy = (c: CustomerProfile, part: string) => c.people.staff.find((p) => p.name.includes(part)) ?? c.people.staff[0];

/** Attack-path graphs for customers with their own estate; template customers use pathSpec's branches. */
const OWN_PATHS: Partial<Record<CustomerId, (c: CustomerProfile) => PathSpec>> = {
  insurance: (c) => {
    const v = c.vocab;
    const cj = v.crownJewels;
    const exl = tpBy(c, 'EXL');
    const cmt = tpBy(c, 'Cambridge Mobile');
    const mf = personBy(c, 'Jennifer');
    const bill = personBy(c, 'Grace');
    return {
      nodes: [
        PN('e-exl', exl.name, 'entry', `Claims BPO · ${exl.access}`),
        PN('e-help', `${mf.name} (impersonated)`, 'entry', `Help-desk pretext call: caller claims to be the ${mf.role}`),
        PN('e-mft', v.externalHosts[9], 'entry', 'Internet-facing managed file transfer'),
        PN('e-agents', v.externalHosts[2], 'entry', 'Agent & broker portal (Okta federation)'),
        PN('e-phish', `${bill.name} (phished)`, 'entry', bill.role),
        PN('e-cmt', cmt.name, 'entry', `Telematics partner · ${cmt.access}`),
        PN('i-exl', 'exl-claims-adjusters', 'identity', 'BPO adjusters with ClaimCenter payment authority up to $25k'),
        PN('i-help', 'Service desk MFA reset role', 'identity', 'Can reset Entra MFA for 1,140 users incl. mainframe staff'),
        PN('i-pim', 'Entra Privileged Role Administrator', 'identity', 'PIM-eligible; activation needs no approval'),
        PN('i-racf', 'RACF SPECIAL (TSO user)', 'identity', 'Mainframe security administration'),
        PN('i-agent', 'Independent agent logins', 'identity', '3,100 agent and broker accounts; 6% on SMS OTP'),
        PN('i-cmt', 'iam-telematics-ingest', 'identity', 'Cross-account role with read on the whole lake'),
        PN('h-cc', v.servers[4], 'host', 'ClaimCenter integration server'),
        PN('h-jump', v.servers[11], 'host', 'Tier 0 jump host'),
        PN('h-zos', v.servers[2], 'host', 'z/OS production LPAR (CICS / DB2)'),
        PN('h-mft', v.servers[7], 'host', 'MFT server (DMZ)'),
        PN('h-pay', v.servers[5], 'host', 'BillingCenter payments server (CDE)'),
        PN('j-gw', cj[0], 'jewel', 'Crown jewel'),
        PN('j-mf', cj[1], 'jewel', 'Crown jewel (mainframe)'),
        PN('j-docs', cj[6], 'jewel', 'Crown jewel (litigation hold)'),
        PN('j-agent', cj[5], 'jewel', 'Crown jewel'),
        PN('j-pay', cj[3], 'jewel', 'Crown jewel (PCI CDE)'),
        PN('j-tele', cj[4], 'jewel', 'Crown jewel (UBI driving data)'),
      ],
      paths: [
        { name: 'Help-desk social engineering reaches the z/OS mainframe', steps: ['e-help', 'i-help', 'i-pim', 'h-jump', 'i-racf', 'h-zos', 'j-mf'], techniques: ['T1660', 'T1098', 'T1078.004', 'T1021.001', 'T1486'], tenants: ['group', 'personal', 'commercial', 'life'], likelihood: 'High', actor: 'Scattered Spider', evidence: 'Entra audit: MFA reset then PIM activation · CyberArk session · z/OS RACF SMF type 80' },
        { name: 'BPO adjuster access reaches ClaimCenter payments (claims fraud)', steps: ['e-exl', 'i-exl', 'h-cc', 'j-gw'], techniques: ['T1199', 'T1078', 'T1565.001', 'T1657'], tenants: ['claims'], likelihood: 'High', actor: 'FIN7', evidence: 'Island browser session logs · Okta System Log · ClaimCenter payee audit (One Inc)' },
        { name: 'MFT flaw reaches claims documents under litigation hold', steps: ['e-mft', 'h-mft', 'j-docs'], techniques: ['T1190', 'T1505.003', 'T1048.003'], tenants: ['group', 'claims'], likelihood: 'Medium', actor: 'Cl0p', evidence: 'Qualys VMDR: MFT version · Vectra: large outbound from the DMZ · Varonis file access' },
        { name: 'Credential stuffing on AgentHub reaches quote & bind', steps: ['e-agents', 'i-agent', 'j-agent'], techniques: ['T1110.004', 'T1078', 'T1565.001'], tenants: ['personal', 'commercial', 'specialty'], likelihood: 'Medium', actor: 'FIN7', evidence: 'Cloudflare Bot Management · Okta broker federation sign-ins · HexaInt: agent credentials in stealer logs' },
        { name: 'Phished billing analyst reaches the premium payment gateway', steps: ['e-phish', 'i-pim', 'h-pay', 'j-pay'], techniques: ['T1566.001', 'T1078.004', 'T1021.001', 'T1657'], tenants: ['personal'], likelihood: 'Medium', actor: 'Black Basta', evidence: 'Proofpoint TAP click · CrowdStrike lateral movement · PCI segmentation test' },
        { name: 'Telematics partner key reaches the UBI driving-data lake', steps: ['e-cmt', 'i-cmt', 'j-tele'], techniques: ['T1199', 'T1552.001', 'T1530'], tenants: ['personal'], likelihood: 'Low', actor: 'ALPHV/BlackCat affiliates', evidence: 'Wiz attack-path graph · GuardDuty: anomalous S3 listing from the partner role' },
      ],
      fixes: {
        'i-help': ['Callback to the manager on record plus video verification for MFA resets; alert on reset-then-PIM activation', 'Low · 1 week'],
        'i-pim': ['Require approval and FIDO2 on PIM activation of Privileged Role Administrator', 'Low · 3 days'],
        'h-jump': ['Single Tier 0 jump host with phishing-resistant MFA and CyberArk session recording', 'Medium · 2 weeks'],
        'i-racf': ['Split RACF SPECIAL from AUDITOR; approve changes only in the mainframe change window', 'Medium · 3 weeks'],
        'h-zos': ['Stream SMF type 80 to Splunk in real time and alert on privileged RACF changes', 'Low · 1 week'],
        'i-exl': ['Lower BPO payment authority and require SIU review for payee changes', 'Low · 1 week'],
        'h-cc': ['Restrict ClaimCenter payee edits to Island-managed sessions with dual control', 'Medium · 2 weeks'],
        'h-mft': ['Patch the MFT server, remove the DMZ web console and alert on bulk downloads', 'Low · next change window'],
        'i-agent': ['Move independent agents to Okta FastPass and retire SMS OTP', 'Medium · 1 quarter'],
        'h-pay': ['Reassert CDE segmentation and allow admin only from the PCI jump host', 'Medium · 2 weeks'],
        'i-cmt': ['Scope the partner role to its own prefix and rotate to short-lived credentials', 'Low · 3 days'],
      },
    };
  },
  defence: (c) => {
    const v = c.vocab;
    const cj = v.crownJewels;
    const haas = tpBy(c, 'Haas');
    const range = tpBy(c, 'Desert Sky');
    const sub = tpBy(c, 'Cumberland');
    const contracts = personBy(c, 'Erin');
    const plm = personBy(c, 'Brian');
    return {
      nodes: [
        PN('e-phish', `${contracts.name} (spear-phished)`, 'entry', `${contracts.role}: fake prime subcontract modification`),
        PN('e-haas', haas.name, 'entry', `Machine-tool OEM remote service · ${haas.access}`),
        PN('e-vpn', v.externalHosts[1], 'entry', 'Remote access VPN (commercial tenant)'),
        PN('e-sftp', `${sub.name} via ${v.externalHosts[3]}`, 'entry', `Sub-tier supplier · ${sub.access}`),
        PN('e-help', `${plm.name} (impersonated)`, 'entry', 'Help-desk pretext call: "lost YubiKey"'),
        PN('e-range', range.name, 'entry', `Range telemetry services · ${range.access}`),
        PN('i-aitm', 'Stolen session cookie (AiTM)', 'identity', 'Token replayed from a VPS against GCC High'),
        PN('i-cuiown', 'CUI enclave site owner', 'identity', 'Owner of 38 programme SharePoint sites'),
        PN('i-haas', 'haas-svc-b3', 'identity', 'BeyondTrust jump item with standing approval'),
        PN('i-da', 'Domain Admins (SPD)', 'identity', 'Standing members incl. 2 service accounts'),
        PN('i-sub', 'cumberland-sftp', 'identity', 'Shared sub-tier SFTP account, password only'),
        PN('i-help', 'Service desk Temporary Access Pass role', 'identity', 'Can issue Entra Temporary Access Passes'),
        PN('h-jump', v.servers[7], 'host', 'OT jump host (Building 3 DMZ)'),
        PN('h-dnc', v.servers[8], 'host', 'DNC programme server, Level 2'),
        PN('h-dc', v.servers[0], 'host', 'Domain controller'),
        PN('h-tc', v.servers[2], 'host', 'Teamcenter PLM server'),
        PN('h-fs', v.servers[5], 'host', 'CUI file server'),
        PN('h-ghe', v.servers[6], 'host', 'GitHub Enterprise Server (flight software)'),
        PN('h-daq', v.servers[11], 'host', 'Test data acquisition server (Tucson)'),
        PN('ot-cnc', v.otSystems[0], 'ot', 'CNC mills, Level 1'),
        PN('j-cui', cj[0], 'jewel', 'Crown jewel (CUI)'),
        PN('j-itar', cj[1], 'jewel', 'Crown jewel (ITAR)'),
        PN('j-fsw', cj[2], 'jewel', 'Crown jewel (export-controlled)'),
        PN('j-dnc', cj[3], 'jewel', 'Crown jewel (OT)'),
        PN('j-ate', cj[4], 'jewel', 'Crown jewel'),
      ],
      paths: [
        { name: 'Prime-themed phishing reaches the CUI enclave (GCC High)', steps: ['e-phish', 'i-aitm', 'i-cuiown', 'j-cui'], techniques: ['T1566.002', 'T1557', 'T1539', 'T1213.002'], tenants: ['programs'], likelihood: 'High', actor: 'APT40', evidence: 'Defender for Office 365 (GCC High): AiTM URL · Entra sign-in from a non-US VPS · Purview CUI label access' },
        { name: 'Machine-tool vendor access reaches the DNC server and CNC programmes', steps: ['e-haas', 'i-haas', 'h-jump', 'h-dnc', 'ot-cnc', 'j-dnc'], techniques: ['T1133', 'T1078', 'T1021.001', 'T0843', 'T0831'], tenants: ['manufacturing'], likelihood: 'High', actor: 'Volt Typhoon', evidence: 'BeyondTrust session logs · Armis: DNC server reachable from the jump host · Corelight: MTConnect from Level 3' },
        { name: 'VPN flaw reaches ITAR technical data in Teamcenter', steps: ['e-vpn', 'h-dc', 'i-da', 'h-tc', 'j-itar'], techniques: ['T1190', 'T1003.001', 'T1021.002', 'T1213', 'T1048.003'], tenants: ['engineering', 'corporate'], likelihood: 'Medium', actor: 'APT41', evidence: 'Tenable SC: KEV on the VPN · Defender: credential access on the DC · Teamcenter ITAR item audit' },
        { name: 'Sub-tier SFTP account reaches CUI drawing sets', steps: ['e-sftp', 'i-sub', 'h-fs', 'j-itar'], techniques: ['T1199', 'T1078', 'T1039', 'T1567'], tenants: ['programs', 'manufacturing'], likelihood: 'Medium', actor: 'Lazarus Group', evidence: 'SFTP logs · Purview: CUI//SP-EXPT label read by a service account · SecurityScorecard rating drop' },
        { name: 'Help-desk social engineering reaches flight software', steps: ['e-help', 'i-help', 'h-ghe', 'j-fsw'], techniques: ['T1660', 'T1098', 'T1078', 'T1213.003'], tenants: ['engineering'], likelihood: 'Medium', actor: 'APT29', evidence: 'Entra audit: Temporary Access Pass issued · GHES audit log: bulk clone of guidance repositories' },
        { name: 'Range telemetry vendor reaches test data and ATE calibration', steps: ['e-range', 'h-daq', 'j-ate'], techniques: ['T1199', 'T1021.004', 'T1005'], tenants: ['tucson'], likelihood: 'Low', actor: 'APT40', evidence: 'HexaOT: SSH from the vendor subnet to TUS-TEST-DAQ01 · Veeam: unusual restore' },
      ],
      fixes: {
        'i-aitm': ['Token protection and compliant-device Conditional Access for every GCC High app', 'Low · 1 week'],
        'i-cuiown': ['Quarterly access review of CUI site owners; remove standing owner rights from contracts staff', 'Low · 2 weeks'],
        'i-haas': ['Approval-required, recorded sessions for every machine-tool vendor jump item', 'Low · 1 week'],
        'h-jump': ['Allow only named DNC and MTConnect flows from the jump host; block SMB to Level 2', 'Medium · next shutdown'],
        'h-dnc': ['Hash-monitor CNC programmes on the DNC server (read-only) and alert on unapproved changes', 'Medium · 2 weeks'],
        'h-dc': ['Tier 0 isolation, LSA protection and Credential Guard', 'Medium · 3 weeks'],
        'i-da': ['Remove standing Domain Admin; elevate through Delinea with FIPS YubiKey', 'Medium · 3 weeks'],
        'h-tc': ['Restrict ITAR item export to the Empowered Official workflow and alert on bulk export', 'Low · 2 weeks'],
        'i-sub': ['Replace the shared SFTP login with named PreVeil accounts per sub-tier user', 'Low · 1 week'],
        'h-fs': ['Move TDP exchange to PreVeil; retire the CUI SFTP drop', 'Medium · 1 quarter'],
        'i-help': ['Require in-person verification with the FSO for Temporary Access Passes', 'Low · 3 days'],
        'h-ghe': ['Alert on bulk clone of export-controlled repositories and require FIDO2 for GHES', 'Low · 1 week'],
      },
    };
  },
  pharma: (c) => {
    const v = c.vocab;
    const cj = v.crownJewels;
    const cro = tpBy(c, 'ICON');
    const oem = tpBy(c, 'Emerson');
    const qp = personBy(c, 'Reto');
    const bd = personBy(c, 'Laura');
    return {
      nodes: [
        PN('e-cro', cro.name, 'entry', `CRO partner portal · ${cro.access}`),
        PN('e-oem', oem.name, 'entry', `DCS OEM remote service · ${oem.access}`),
        PN('e-help', `${qp.name} (impersonated)`, 'entry', 'Help-desk pretext call: QP locked out before batch release'),
        PN('e-phish', `${bd.name} (spear-phished)`, 'entry', bd.role),
        PN('e-supp', v.externalHosts[5], 'entry', 'Supplier portal (external chemistry partners)'),
        PN('e-vpn', v.externalHosts[4], 'entry', 'Remote access VPN'),
        PN('i-cro', 'CRO monitor accounts (Okta)', 'identity', 'Partner CRAs with Rave read across 14 studies'),
        PN('i-oem', 'emerson-svc-vls', 'identity', 'BeyondTrust jump item with standing approval'),
        PN('i-help', 'Service desk MFA reset role (Accenture)', 'identity', 'Outsourced desk can reset MFA for GMP users'),
        PN('i-da', 'Tier 0: Domain Admins (RHN)', 'identity', 'Standing members incl. 4 service accounts'),
        PN('i-guest', 'wuxi-chem-ext', 'identity', 'Guest with read on assay shares'),
        PN('h-ctms', v.servers[13], 'host', 'CTMS integration server (Dublin)'),
        PN('h-hist', v.servers[8], 'host', 'PI historian (Level 3)'),
        PN('h-deltav', v.servers[6], 'host', 'DeltaV ProfessionalPLUS (Level 2)'),
        PN('h-sap', v.servers[2], 'host', 'SAP S/4HANA production'),
        PN('h-veeva', v.servers[3], 'host', 'Veeva Vault integration bridge'),
        PN('h-hpc', v.servers[11], 'host', 'Research HPC (structure prediction)'),
        PN('h-dc', v.servers[0], 'host', 'Domain controller'),
        PN('h-serial', v.servers[9], 'host', 'Serialisation Level 3 server (Cork)'),
        PN('ot-dcs', v.otSystems[0], 'ot', 'DeltaV controllers, Level 1'),
        PN('j-rave', cj[0], 'jewel', 'Crown jewel (clinical)'),
        PN('j-ectd', cj[1], 'jewel', 'Crown jewel (regulatory)'),
        PN('j-deltav', cj[3], 'jewel', 'Crown jewel (GMP, OT)'),
        PN('j-mol', cj[4], 'jewel', 'Crown jewel (discovery IP)'),
        PN('j-serial', cj[5], 'jewel', 'Crown jewel (supply)'),
        PN('j-sap', cj[6], 'jewel', 'Crown jewel'),
      ],
      paths: [
        { name: 'CRO partner account reaches Rave EDC and unblinding keys', steps: ['e-cro', 'i-cro', 'h-ctms', 'j-rave'], techniques: ['T1199', 'T1078', 'T1213', 'T1530'], tenants: ['clinops'], likelihood: 'High', actor: 'APT41', evidence: 'Okta System Log: CRO sign-ins from a new ASN · Rave audit trail: bulk export · Netskope' },
        { name: 'DCS OEM remote access reaches DeltaV and electronic batch records', steps: ['e-oem', 'i-oem', 'h-hist', 'h-deltav', 'ot-dcs', 'j-deltav'], techniques: ['T1133', 'T1078', 'T1021.001', 'T0886', 'T0836'], tenants: ['valais'], likelihood: 'High', actor: 'Black Basta', evidence: 'BeyondTrust session outside the GMP change window · Claroty: DeltaV reachable from Level 3 · DeltaV Event Chronicle' },
        { name: 'Help-desk social engineering reaches SAP batch release', steps: ['e-help', 'i-help', 'i-da', 'h-sap', 'j-sap'], techniques: ['T1660', 'T1098', 'T1003.001', 'T1565.001'], tenants: ['corporate', 'valais', 'cork', 'commercial'], likelihood: 'Medium', actor: 'Scattered Spider', evidence: 'Entra audit: MFA reset then new device · SAP ETD: QM role used from a new terminal' },
        { name: 'Spear-phished deal team reaches eCTD dossiers', steps: ['e-phish', 'h-veeva', 'j-ectd'], techniques: ['T1566.002', 'T1078', 'T1213'], tenants: ['corporate', 'clinops'], likelihood: 'Medium', actor: 'APT29', evidence: 'Proofpoint TAP click · Veeva Vault audit trail · Purview label access' },
        { name: 'Supplier portal guest reaches discovery models', steps: ['e-supp', 'i-guest', 'h-hpc', 'j-mol'], techniques: ['T1199', 'T1078', 'T1039', 'T1567.002'], tenants: ['rnd'], likelihood: 'Medium', actor: 'APT41', evidence: 'Entra guest sign-ins · Protect AI model scan · Varonis (failing: last data 2 days old)' },
        { name: 'VPN flaw reaches Cork serialisation (supply stop)', steps: ['e-vpn', 'h-dc', 'i-da', 'h-serial', 'j-serial'], techniques: ['T1190', 'T1003.001', 'T1021.002', 'T1486'], tenants: ['cork'], likelihood: 'Medium', actor: 'FIN11 / Cl0p', evidence: 'InsightVM: KEV on the VPN · CrowdStrike: credential access · Cisco ISE: L3 serialisation VLAN' },
      ],
      fixes: {
        'i-cro': ['Scope CRO accounts to their own studies and require Okta FastPass for Rave', 'Low · 2 weeks'],
        'h-ctms': ['Alert on bulk Rave exports through the CTMS integration and require a data transfer agreement ID', 'Low · 1 week'],
        'i-oem': ['Approval-required OEM sessions tied to a GxP change record', 'Low · 1 week'],
        'h-hist': ['One-way replication from the PI historian to Level 4', 'High · 1 quarter'],
        'h-deltav': ['Restrict ProfessionalPLUS access to named engineering sessions; monitor configuration changes (read-only)', 'Medium · next campaign break'],
        'i-help': ['Video verification and QA callback for MFA resets on GMP accounts', 'Low · 1 week'],
        'i-da': ['Remove standing Domain Admin; elevate through CyberArk with FIDO2', 'Medium · 3 weeks'],
        'h-sap': ['Restrict QM release transactions to the QA workstation pool; SAP ETD alert on new terminals', 'Low · 2 weeks'],
        'h-veeva': ['Limit the Vault bridge to service scopes; alert on dossier downloads outside submission windows', 'Low · 1 week'],
        'i-guest': ['Move partner chemistry exchange to HexaCustody packages; remove share read', 'Low · 3 days'],
        'h-hpc': ['Segment research HPC from guest-accessible shares', 'Medium · 4 weeks'],
        'h-dc': ['Tier 0 isolation and Credential Guard; block VPN pools from Tier 0', 'Medium · 3 weeks'],
        'h-serial': ['Allow only Level 4 serialisation flows to the Cork Level 3 server', 'Medium · next line changeover'],
      },
    };
  },
  sghospital: (c) => {
    const v = c.vocab;
    const cj = v.crownJewels;
    const isc = tpBy(c, 'InterSystems');
    const bd = tpBy(c, 'BD');
    const trak = personBy(c, 'Benjamin');
    return {
      nodes: [
        PN('e-isc', isc.name, 'entry', `EHR vendor support · ${isc.access}`),
        PN('e-bd', bd.name, 'entry', `Infusion OEM remote service · ${bd.access}`),
        PN('e-help', `${trak.name} (impersonated)`, 'entry', 'Help-desk pretext call to the NCS service desk'),
        PN('e-citrix', v.externalHosts[4], 'entry', 'Citrix gateway (remote clinicians)'),
        PN('e-fhir', v.externalHosts[8], 'entry', 'FHIR API for partner apps'),
        PN('i-isc', 'isc-support-sg', 'identity', 'Vendor account in CyberArk with standing approval'),
        PN('i-bd', 'bd-alaris-svc', 'identity', 'OEM account on the biomed jump host'),
        PN('i-help', 'NCS service desk MFA reset role', 'identity', 'Can reset MFA for 260 privileged accounts'),
        PN('i-da', 'Domain Admins (OBH)', 'identity', 'Standing members incl. 2 service accounts'),
        PN('i-hs', 'svc_nehr_contrib', 'identity', 'NEHR contribution service account'),
        PN('h-trakapp', v.servers[3], 'host', 'TrakCare application server'),
        PN('h-trakdb', v.servers[2], 'host', 'TrakCare IRIS database'),
        PN('h-jump', v.servers[11], 'host', 'Biomed jump host'),
        PN('h-alaris', v.servers[6], 'host', 'Alaris pump server'),
        PN('h-dc', v.servers[0], 'host', 'Domain controller'),
        PN('h-pacs', v.servers[5], 'host', 'PACS server'),
        PN('h-ens', v.servers[4], 'host', 'HealthShare ensemble (interface engine)'),
        PN('ot-pump', v.otSystems[0], 'ot', 'Infusion pumps on the clinical VLAN'),
        PN('j-trak', cj[0], 'jewel', 'Crown jewel'),
        PN('j-pacs', cj[1], 'jewel', 'Crown jewel'),
        PN('j-alaris', cj[2], 'jewel', 'Crown jewel (clinical device)'),
        PN('j-nehr', cj[4], 'jewel', 'Crown jewel (national record)'),
      ],
      paths: [
        { name: 'EHR vendor PAM session reaches the TrakCare IRIS database', steps: ['e-isc', 'i-isc', 'h-trakapp', 'h-trakdb', 'j-trak'], techniques: ['T1199', 'T1078', 'T1021.001', 'T1486'], tenants: ['obh', 'specialist'], likelihood: 'High', actor: 'Qilin', evidence: 'CyberArk Vendor PAM: session outside the window · TrakCare audit · CrowdStrike on OBH-TRAK-APP03' },
        { name: 'Biomed jump host reaches the Alaris pump server', steps: ['e-bd', 'i-bd', 'h-jump', 'h-alaris', 'ot-pump', 'j-alaris'], techniques: ['T1133', 'T1078', 'T1021.001', 'T0886', 'T0814'], tenants: ['obh', 'daysurg'], likelihood: 'High', actor: 'LockBit 3.0 affiliates', evidence: 'Armis: jump host reaches the pump VLAN · Claroty: Alaris firmware 9.33 · Forescout' },
        { name: 'Help-desk social engineering reaches TrakCare', steps: ['e-help', 'i-help', 'i-da', 'h-dc', 'j-trak'], techniques: ['T1660', 'T1098', 'T1003.001', 'T1486'], tenants: ['obh', 'specialist', 'corp'], likelihood: 'Medium', actor: 'Scattered Spider', evidence: 'Entra audit · ServiceNow reset ticket without callback · Defender for Identity' },
        { name: 'Citrix gateway flaw reaches the PACS imaging archive', steps: ['e-citrix', 'h-pacs', 'j-pacs'], techniques: ['T1190', 'T1021.001', 'T1005'], tenants: ['labimg'], likelihood: 'Medium', actor: 'Mustang Panda', evidence: 'InsightVM: KEV on the Citrix gateway · Vectra: DICOM export to an unusual destination' },
        { name: 'FHIR API abuse reaches the NEHR contribution interface', steps: ['e-fhir', 'i-hs', 'h-ens', 'j-nehr'], techniques: ['T1190', 'T1528', 'T1213'], tenants: ['obh', 'corp'], likelihood: 'Low', actor: 'UNC3886', evidence: 'Tenable WAS: FHIR scope issue · HealthShare audit · Synapxe HealthConnect gateway logs' },
      ],
      fixes: {
        'i-isc': ['Per-session approval for InterSystems support in CyberArk Vendor PAM', 'Low · 1 week'],
        'h-trakapp': ['Restrict RDP to the TrakCare tier to the vendor PAM proxy only', 'Low · 3 days'],
        'h-trakdb': ['Alert on IRIS bulk export and privileged journal changes', 'Low · 1 week'],
        'i-bd': ['Move the BD account into CyberArk Vendor PAM with recording', 'Low · 2 weeks'],
        'h-jump': ['Allow only named OEM sessions from the biomed jump host; block SMB to the pump server', 'Low · 1 week'],
        'h-alaris': ['Restrict pump traffic to the Alaris server via Forescout policy (monitoring only on the pumps)', 'Medium · biomed window'],
        'i-help': ['NCS service desk: callback to the line manager and video check before MFA resets', 'Low · 1 week'],
        'i-da': ['Remove standing Domain Admin; Tier 0 via CyberArk just-in-time', 'Medium · 3 weeks'],
        'h-dc': ['Tier 0 isolation and Credential Guard on clinical workstations', 'Medium · 3 weeks'],
        'i-hs': ['Scope the NEHR service account to HealthConnect submission only; rotate quarterly', 'Low · 3 days'],
        'h-ens': ['Restrict FHIR scopes and add rate limits on the interface engine', 'Low · 2 weeks'],
      },
    };
  },
  studio: (c) => {
    const v = c.vocab;
    const cj = v.crownJewels;
    const vfx = tpBy(c, 'Northlight');
    const oem = tpBy(c, 'Intamin');
    const sre = personBy(c, 'Chris');
    const editor = personBy(c, 'Ryan');
    return {
      nodes: [
        PN('e-vfx', vfx.name, 'entry', `VFX vendor · ${vfx.access}`),
        PN('e-help', `${sre.name} (impersonated)`, 'entry', 'Help-desk pretext call: lost phone, new Okta factor'),
        PN('e-phish', `${editor.name} (phished)`, 'entry', editor.role),
        PN('e-screener', v.externalHosts[1], 'entry', 'Screener portal (awards season)'),
        PN('e-oem', oem.name, 'entry', `Ride OEM remote service · ${oem.access}`),
        PN('e-tickets', v.externalHosts[9], 'entry', 'StarPass ticketing site'),
        PN('i-aspera', 'Aspera node API key (vendor)', 'identity', 'Long-lived key with read on 3 title buckets'),
        PN('i-okta', 'Okta help-desk admin', 'identity', 'Can reset factors for any workforce user'),
        PN('i-aws', 'AWS SSO: starfallplus-prod admin', 'identity', 'Permission set assigned to the whole SRE group'),
        PN('i-mam', 'svc_mam_sync', 'identity', 'MAM service account with vault read'),
        PN('i-oem', 'intamin-svc-orl', 'identity', 'Standing vendor account in CyberArk'),
        PN('h-mam', v.servers[1], 'host', 'Media asset management'),
        PN('h-api', v.servers[6], 'host', 'Starfall+ API gateway'),
        PN('h-nexis', v.servers[4], 'host', 'Avid NEXIS (Soho)'),
        PN('h-jump', v.servers[11], 'host', 'Parks OT jump host'),
        PN('h-hmi', v.servers[8], 'host', 'Ride control HMI'),
        PN('h-tkt', v.servers[10], 'host', 'Ticketing gateway'),
        PN('ot-ride', v.otSystems[0], 'ot', 'Safety-rated ride PLCs, Level 1'),
        PN('j-vault', cj[0], 'jewel', 'Crown jewel: pre-release content'),
        PN('j-nexis', cj[1], 'jewel', 'Crown jewel'),
        PN('j-subs', cj[2], 'jewel', 'Crown jewel: 60M subscribers'),
        PN('j-ride', cj[4], 'jewel', 'Crown jewel (OT, guest safety)'),
        PN('j-pass', cj[5], 'jewel', 'Crown jewel'),
        PN('j-mam', cj[6], 'jewel', 'Crown jewel: scripts'),
      ],
      paths: [
        { name: 'VFX vendor Aspera key reaches the pre-release vault', steps: ['e-vfx', 'i-aspera', 'h-mam', 'j-vault'], techniques: ['T1199', 'T1552.001', 'T1530', 'T1567.002'], tenants: ['studios', 'post'], likelihood: 'High', actor: 'ShinyHunters', evidence: 'Aspera transfer logs · HexaCustody: package outside custody · NexGuard watermark' },
        { name: 'Help-desk social engineering reaches Starfall+ subscribers', steps: ['e-help', 'i-okta', 'i-aws', 'h-api', 'j-subs'], techniques: ['T1660', 'T1098', 'T1078.004', 'T1530'], tenants: ['play', 'corp'], likelihood: 'High', actor: 'Scattered Spider', evidence: 'Okta System Log: factor reset then new device · AWS CloudTrail: AssumeRole from a new IP' },
        { name: 'Phished editor reaches NEXIS and the render farm', steps: ['e-phish', 'h-nexis', 'j-nexis'], techniques: ['T1566.002', 'T1021.001', 'T1039', 'T1486'], tenants: ['post'], likelihood: 'Medium', actor: 'LAPSUS$', evidence: 'SentinelOne: credential theft on an edit bay · NEXIS access logs' },
        { name: 'Screener token replay reaches the script library', steps: ['e-screener', 'i-mam', 'h-mam', 'j-mam'], techniques: ['T1190', 'T1550.001', 'T1213', 'T1567.002'], tenants: ['studios'], likelihood: 'Medium', actor: 'NullBulge', evidence: 'Cloudflare WAF: token replay · Indee link analytics · MAM audit' },
        { name: 'Ride OEM remote access reaches ride control (IT to OT)', steps: ['e-oem', 'i-oem', 'h-jump', 'h-hmi', 'ot-ride', 'j-ride'], techniques: ['T1133', 'T1078', 'T1021.001', 'T0886', 'T0814'], tenants: ['parks', 'parksasia'], likelihood: 'Medium', actor: 'ALPHV/BlackCat affiliates', evidence: 'CyberArk session logs · Dragos: HMI reachable from the jump host · Claroty zone map' },
        { name: 'Ticketing site skimmer reaches StarPass payment pages', steps: ['e-tickets', 'h-tkt', 'j-pass'], techniques: ['T1190', 'T1059.007', 'T1056.003'], tenants: ['parks', 'parksasia'], likelihood: 'Low', actor: 'Lazarus Group', evidence: 'Akamai page integrity · HexaInt: skimmer domain registered · Adyen anomaly alerts' },
      ],
      fixes: {
        'i-aspera': ['Replace vendor node keys with expiring HexaCustody packages per title', 'Low · 1 week'],
        'h-mam': ['Scope MAM reads per title and alert on bulk vault pulls', 'Low · 1 week'],
        'i-okta': ['Video verification and manager approval for factor resets; alert on reset-then-new-device', 'Low · 1 week'],
        'i-aws': ['Narrow the permission set and require Okta FastPass step-up for production', 'Low · 3 days'],
        'h-api': ['Enforce object-level authorisation and rate limits on the Starfall+ API', 'Medium · 2 weeks'],
        'h-nexis': ['Custody agents on every edit bay; block personal cloud from the content network', 'Medium · 2 weeks'],
        'i-mam': ['Rotate and vault the MAM secret; scope it to review renditions only', 'Low · 3 days'],
        'i-oem': ['Approval-required OEM sessions tied to a ride maintenance work order', 'Low · 1 week'],
        'h-jump': ['Allow only named engineering protocols from the parks jump host, with recording', 'Medium · next maintenance night'],
        'h-hmi': ['Monitor HMI and PLC program changes (read-only); ride safety systems stay untouched', 'Medium · next maintenance night'],
        'h-tkt': ['Page-integrity monitoring and CSP on payment pages', 'Low · 2 weeks'],
      },
    };
  },
};

function pathSpec(c: CustomerProfile): PathSpec {
  const own = OWN_PATHS[c.id];
  if (own) return own(c);
  const v = c.vocab;
  const st = c.people.staff;
  const tp = c.thirdParties;
  const N = (id: string, label: string, kind: PathNodeKind, sub: string): PathNode => ({ id, label, kind, sub });
  if (c.dataKey === 'maritime') {
    return {
      nodes: [
        N('e-vpn', v.externalHosts[0], 'entry', 'Internet-facing VPN gateway'),
        N('e-citrix', v.externalHosts[7], 'entry', 'Port Klang Citrix gateway'),
        N('e-phish', `${st[9].name} (phished)`, 'entry', st[9].role),
        N('e-vendor', tp[0].name, 'entry', `Vendor remote access · ${tp[0].access}`),
        N('e-wallem', tp[9].name, 'entry', tp[9].access),
        N('i-veeam', 'svc_veeam', 'identity', 'Backup service account with excess rights'),
        N('i-da', 'Domain Admins (HPS)', 'identity', 'Standing members incl. service accounts'),
        N('i-kc', 'kc-remote01', 'identity', 'Shared vendor account in CyberArk'),
        N('i-fleet', 'fleet-erp-admin', 'identity', 'Ship-management ERP admin role'),
        N('h-dc', v.servers[0], 'host', 'Domain controller'),
        N('h-tosdb', v.servers[2], 'host', 'TOS database server'),
        N('h-sap', v.servers[6], 'host', 'SAP application server'),
        N('h-pklws', v.servers[8], 'host', 'Engineering workstation, Port Klang'),
        N('h-jump', v.servers[11], 'host', 'OT jump host (Level 3.5 DMZ)'),
        N('h-hist', v.servers[4], 'host', 'Historian (Level 3)'),
        N('ot-plc', v.otSystems[0], 'ot', 'STS crane PLCs, Level 1'),
        N('j-tos', v.crownJewels[0], 'jewel', 'Crown jewel'),
        N('j-crane', v.crownJewels[1], 'jewel', 'Crown jewel (OT)'),
        N('j-sap', v.crownJewels[4], 'jewel', 'Crown jewel'),
        N('j-ecdis', v.crownJewels[5], 'jewel', 'Crown jewel (vessel OT)'),
      ],
      paths: [
        { name: 'VPN exposure to the terminal operating system', steps: ['e-vpn', 'h-dc', 'i-da', 'h-tosdb', 'j-tos'], techniques: ['T1190', 'T1003.001', 'T1021.002', 'T1486'], tenants: ['hq', 'rtm', 'ant'], likelihood: 'Medium', actor: 'LockBit 3.0 affiliates', evidence: 'Tenable: gateway version · Defender: DC exposure · cloud AD graph' },
        { name: 'Phished analyst reaches SAP via admin tier', steps: ['e-phish', 'i-veeam', 'i-da', 'h-sap', 'j-sap'], techniques: ['T1566.002', 'T1558.003', 'T1021.001', 'T1657'], tenants: ['hq'], likelihood: 'High', actor: 'Black Basta', evidence: 'Proofpoint click · Entra sign-in · service-account ticket anomaly' },
        { name: 'Vendor remote access to crane PLCs (IT to OT)', steps: ['e-vendor', 'i-kc', 'h-jump', 'h-hist', 'ot-plc', 'j-crane'], techniques: ['T1133', 'T1078', 'T0886', 'T0843', 'T0831'], tenants: ['rtm', 'ant'], likelihood: 'High', actor: 'Sandworm (APT44)', evidence: 'CyberArk session logs · Dragos zone map · firewall rule allows L3.5 to L1' },
        { name: 'Gateway flaw at Port Klang reaches cranes (IT to OT)', steps: ['e-citrix', 'h-pklws', 'h-jump', 'ot-plc', 'j-crane'], techniques: ['T1190', 'T1539', 'T1021.001', 'T0843'], tenants: ['pkl'], likelihood: 'Medium', actor: 'Volt Typhoon', evidence: 'HexaInt: KEV CVE on PKL gateway · HexaOT: S7comm from engineering WS' },
        { name: 'Ship-manager compromise reaches vessel bridge systems', steps: ['e-wallem', 'i-fleet', 'j-ecdis'], techniques: ['T1199', 'T1078', 'T0886'], tenants: ['fleet'], likelihood: 'Medium', actor: 'APT41', evidence: 'Vessel firewall syslog · manager VPN in allow-list across the fleet' },
        { name: 'Phished analyst reaches the TOS via admin tier', steps: ['e-phish', 'h-dc', 'i-da', 'h-tosdb', 'j-tos'], techniques: ['T1566.001', 'T1003.001', 'T1021.002', 'T1486'], tenants: ['hq', 'rtm'], likelihood: 'Medium', actor: 'LockBit 3.0 affiliates', evidence: 'Defender: credential-access alert history · ServiceNow CMDB tiers' },
      ],
      fixes: {
        'i-da': ['Remove standing Domain Admin; move to JIT via CyberArk and take service accounts out of the group', 'Medium · 2 weeks'],
        'h-jump': ['Allow only PAM-brokered, MFA, recorded sessions and block direct L3.5 to L1 except named engineering flows', 'Medium · 1 change window'],
        'h-dc': ['Tier 0 isolation: block interactive logon from lower tiers, enable LSA protection and Credential Guard', 'Medium · 3 weeks'],
        'i-veeam': ['Move to a group-managed service account with AES-only Kerberos and drop admin rights', 'Low · 2 days'],
        'i-kc': ['Replace the shared vendor account with named, time-bound identities', 'Low · 1 week'],
        'h-tosdb': ['Restrict SMB / WinRM to the TOS admin jump host only', 'Low · 3 days'],
        'h-hist': ['Add a one-way data broker for historian replication', 'High · quarter'],
        'ot-plc': ['Enable controller access protection and program-change alerting (read-only monitoring)', 'Medium · next outage'],
        'i-fleet': ['Conditional Access: require a compliant device and phishing-resistant MFA for the ship-manager portal', 'Low · 1 week'],
        'h-pklws': ['Remove the dual-homed NIC and route via the jump host', 'Low · 2 days'],
        'h-sap': ['Restrict RDP to the SAP basis team privileged workstation', 'Low · 2 days'],
      },
    };
  }
  if (c.dataKey === 'finserv') {
    return {
      nodes: [
        N('e-vpn', v.externalHosts[4], 'entry', 'Remote access VPN'),
        N('e-ob', v.externalHosts[8], 'entry', 'Open-banking API (PSD2)'),
        N('e-help', `${st[8].name} (vished)`, 'entry', `${st[8].role}: help-desk pretext call`),
        N('e-treasury', `${st[4].name} (spear-phished)`, 'entry', st[4].role),
        N('e-infosys', tp[5].name, 'entry', tp[5].access),
        N('i-okta', 'Help-desk super admin', 'identity', 'Can reset MFA for any user'),
        N('i-t0', 'Tier 0: Domain Admins', 'identity', 'Standing privileged accounts'),
        N('i-t24', 'svc_t24_batch', 'identity', 'Service account with SPN'),
        N('i-racf', 'RACF SPECIAL user', 'identity', 'Mainframe security admin'),
        N('h-ctx', v.servers[7], 'host', 'Citrix StoreFront'),
        N('h-jump', v.servers[11], 'host', 'Tier 0 jump host'),
        N('h-swift', v.servers[3], 'host', 'SWIFT Alliance Access server'),
        N('h-t24', v.servers[4], 'host', 'Core banking application'),
        N('h-oms', v.servers[6], 'host', 'Markets order management server'),
        N('h-zos', v.servers[2], 'host', 'Mainframe z/OS LPAR'),
        N('j-swift', v.crownJewels[0], 'jewel', 'Crown jewel'),
        N('j-t24', v.crownJewels[1], 'jewel', 'Crown jewel'),
        N('j-switch', v.crownJewels[2], 'jewel', 'Crown jewel'),
        N('j-ledger', v.crownJewels[3], 'jewel', 'Crown jewel'),
        N('j-oms', v.crownJewels[4], 'jewel', 'Crown jewel'),
      ],
      paths: [
        { name: 'Help-desk social engineering reaches the payment network', steps: ['e-help', 'i-okta', 'i-t0', 'h-jump', 'h-swift', 'j-swift'], techniques: ['T1660', 'T1098', 'T1550.002', 'T1021.001', 'T1657'], tenants: ['ukbank', 'pay'], likelihood: 'High', actor: 'Scattered Spider', evidence: 'Okta System Log MFA reset · CyberArk session · SWIFT secure-zone logons' },
        { name: 'Open-banking API flaw reaches core banking', steps: ['e-ob', 'i-t24', 'h-t24', 'j-t24'], techniques: ['T1190', 'T1078', 'T1213', 'T1565.001'], tenants: ['ukbank'], likelihood: 'Medium', actor: 'FIN7', evidence: 'HexaStrike pen-test finding (object-level auth) · Splunk API anomalies' },
        { name: 'Spear-phished treasury user reaches the card switch', steps: ['e-treasury', 'i-t0', 'h-jump', 'j-switch'], techniques: ['T1566.001', 'T1558.003', 'T1021.002', 'T1657'], tenants: ['pay'], likelihood: 'Medium', actor: 'Lazarus Group (APT38)', evidence: 'Proofpoint TAP click · CrowdStrike lateral movement · PAM gaps' },
        { name: 'Vendor access reaches the mainframe ledger', steps: ['e-infosys', 'i-racf', 'h-zos', 'j-ledger'], techniques: ['T1199', 'T1078', 'T1098'], tenants: ['ukbank'], likelihood: 'Low', actor: 'TA505', evidence: 'z/OS RACF SMF type 80 · third-party access review (DORA Art. 28)' },
        { name: 'VPN exposure reaches the order management system', steps: ['e-vpn', 'h-ctx', 'i-t0', 'h-oms', 'j-oms'], techniques: ['T1190', 'T1021.001', 'T1003.001', 'T1565.001'], tenants: ['markets'], likelihood: 'Medium', actor: 'Cl0p', evidence: 'Qualys VMDR on the gateway · Splunk notable · OMS access graph' },
      ],
      fixes: {
        'i-okta': ['Require manager + security verification and a cooling-off on help-desk MFA resets; alert on reset-then-enrol', 'Low · 1 week'],
        'i-t0': ['Eliminate standing Tier 0; enforce JIT, PAW and session recording via CyberArk', 'Medium · 3 weeks'],
        'h-jump': ['Single Tier 0 jump host with phishing-resistant MFA; block all other admin paths', 'Medium · 2 weeks'],
        'i-t24': ['Rotate to a managed identity, scope to core-banking APIs only', 'Low · 3 days'],
        'h-swift': ['Reassert SWIFT secure-zone segregation and operator MFA (CSCF 1.1, 4.2)', 'Medium · 2 weeks'],
        'i-racf': ['Split RACF SPECIAL from audit administration; approve changes in the mainframe change window', 'Medium · 3 weeks'],
        'h-ctx': ['Patch and rotate session tokens; enforce device posture on the VPN', 'Low · 1 week'],
        'h-zos': ['Monitor privileged RACF changes in real time and alert the SOC', 'Low · 1 week'],
        'h-oms': ['Restrict OMS admin to a bastion and require change tickets', 'Low · 3 days'],
      },
    };
  }
  if (c.dataKey === 'healthcare') {
    return {
      nodes: [
        N('e-citrix', v.externalHosts[3], 'entry', 'Citrix gateway (community hospitals NetScaler)'),
        N('e-help', `${st[5].name} (vished)`, 'entry', `${st[5].role}: help-desk MFA reset pretext`),
        N('e-oem', tp[1].name, 'entry', `OEM remote service · ${tp[1].access}`),
        N('e-phish', `${st[8].name} (phished)`, 'entry', st[8].role),
        N('e-fhir', v.externalHosts[8], 'entry', 'FHIR API for third-party apps'),
        N('i-help', 'Service desk MFA reset role', 'identity', 'Can reset MFA for 214 privileged accounts'),
        N('i-da', 'Domain Admins (MRH)', 'identity', 'Standing members incl. 3 service accounts'),
        N('i-oem', 'ge-service-vpn', 'identity', 'Standing OEM account outside CyberArk'),
        N('i-interconnect', 'svc_epic_interconnect', 'identity', 'Epic integration service account'),
        N('h-dc', v.servers[0], 'host', 'Domain controller'),
        N('h-ctx', v.servers[6], 'host', 'Citrix StoreFront'),
        N('h-com', v.servers[8], 'host', 'Community hospital file server (flat VLAN)'),
        N('h-jump', v.servers[11], 'host', 'Biomed jump host'),
        N('ot-pump', v.otSystems[0], 'ot', 'Infusion pumps on the flat clinical VLAN'),
        N('ot-ct', v.otSystems[2], 'ot', 'Imaging modality (Windows 7 workstation)'),
        N('j-epic', v.crownJewels[0], 'jewel', 'Crown jewel'),
        N('j-pacs', v.crownJewels[1], 'jewel', 'Crown jewel'),
        N('j-alaris', v.crownJewels[2], 'jewel', 'Crown jewel (clinical device)'),
        N('j-genomics', v.crownJewels[5], 'jewel', 'Crown jewel (research ePHI)'),
      ],
      paths: [
        { name: 'Help-desk social engineering reaches Epic (ransomware with diversion)', steps: ['e-help', 'i-help', 'i-da', 'h-dc', 'j-epic'], techniques: ['T1660', 'T1098', 'T1003.001', 'T1486'], tenants: ['mrmc', 'kids', 'community'], likelihood: 'High', actor: 'Scattered Spider', evidence: 'Entra audit: MFA reset then new device · CrowdStrike: DC credential access history' },
        { name: 'NetScaler flaw at the community hospitals reaches infusion pumps', steps: ['e-citrix', 'h-ctx', 'h-com', 'ot-pump', 'j-alaris'], techniques: ['T1190', 'T1021.001', 'T0886', 'T0814'], tenants: ['community'], likelihood: 'High', actor: 'Qilin', evidence: 'InsightVM: KEV on NetScaler · Claroty: pumps share the user VLAN at Marion' },
        { name: 'OEM remote service reaches imaging and PACS', steps: ['e-oem', 'i-oem', 'h-jump', 'ot-ct', 'j-pacs'], techniques: ['T1133', 'T1078', 'T0866', 'T1486'], tenants: ['mrmc', 'kids'], likelihood: 'Medium', actor: 'Rhysida', evidence: 'Site-to-site VPN logs · Claroty: Windows 7 imaging workstation reachable from jump host' },
        { name: 'Phished nurse reaches Epic via shared workstation session', steps: ['e-phish', 'h-ctx', 'i-da', 'h-dc', 'j-epic'], techniques: ['T1566.002', 'T1550', 'T1021.001', 'T1486'], tenants: ['mrmc'], likelihood: 'Medium', actor: 'INC Ransom', evidence: 'Mimecast click · Imprivata session reuse · Sentinel lateral movement' },
        { name: 'FHIR app token abuse reaches genomics research data', steps: ['e-fhir', 'i-interconnect', 'j-genomics'], techniques: ['T1528', 'T1530', 'T1567.002'], tenants: ['research', 'clinics'], likelihood: 'Low', actor: 'ALPHV/BlackCat affiliates', evidence: 'AWS Security Hub: bucket policy allows Interconnect role · FHIR scopes broader than needed' },
      ],
      fixes: {
        'i-help': ['Require video or in-person verification for MFA resets and alert on reset-then-enrol', 'Low · 1 week'],
        'i-da': ['Remove standing Domain Admin; Tier 0 via CyberArk JIT only', 'Medium · 3 weeks'],
        'h-dc': ['Tier 0 isolation, LSA protection and Credential Guard on clinical workstations', 'Medium · 3 weeks'],
        'h-ctx': ['Patch the NetScalers, terminate sessions and enforce device posture', 'Low · next downtime window'],
        'h-com': ['Segment the community-hospital VLAN using Claroty device policies', 'Medium · 6 weeks'],
        'i-oem': ['Broker OEM access through CyberArk Vendor PAM with per-session approval', 'Low · 2 weeks'],
        'h-jump': ['Restrict the biomed jump host to named OEM sessions; block SMB to imaging', 'Low · 1 week'],
        'ot-pump': ['Monitor pump traffic and restrict to the Alaris server only (read-only enforcement via network)', 'Medium · biomed window'],
        'i-interconnect': ['Scope the Interconnect role to Epic APIs only; remove S3 read on research buckets', 'Low · 3 days'],
      },
    };
  }
  if (c.dataKey === 'automotive') {
    return {
      nodes: [
        N('e-dealer', v.externalHosts[4], 'entry', 'Dealer portal VPN (KEV open)'),
        N('e-agency', tp[11].name, 'entry', `Design agency · ${tp[11].access}`),
        N('e-kuka', tp[2].name, 'entry', `Robot OEM remote service · ${tp[2].access}`),
        N('e-help', `${st[8].name} (vished)`, 'entry', `${st[8].role}: help-desk pretext call`),
        N('e-api', v.externalHosts[2], 'entry', 'Connected-vehicle backend API'),
        N('i-kuka', 'kuka-service07', 'identity', 'Standing robot-OEM jump item'),
        N('i-da', 'Tier 0: Domain Admins (VMG)', 'identity', 'Standing privileged accounts'),
        N('i-agency', 'autovision-ext03', 'identity', 'Agency guest with Teamcenter read'),
        N('i-ota', 'iam-ota-signer', 'identity', 'AWS role that can call the signing key'),
        N('h-dc', v.servers[0], 'host', 'Domain controller'),
        N('h-pue', v.servers[7], 'host', 'Puebla MES app server (conduit bypasses DMZ)'),
        N('h-jump', v.servers[11], 'host', 'OT jump host (Level 3.5)'),
        N('h-plm', v.servers[6], 'host', 'Teamcenter PLM server'),
        N('h-apigw', v.servers[9], 'host', 'Vehicle API gateway'),
        N('ot-robot', v.otSystems[0], 'ot', 'Body-shop welding robots, Level 1'),
        N('ot-plc', v.otSystems[1], 'ot', 'Press line PLCs (Puebla)'),
        N('j-mes', v.crownJewels[2], 'jewel', 'Crown jewel'),
        N('j-robot', v.crownJewels[3], 'jewel', 'Crown jewel (OT)'),
        N('j-plm', v.crownJewels[1], 'jewel', 'Crown jewel (design IP)'),
        N('j-ota', v.crownJewels[0], 'jewel', 'Crown jewel (R156)'),
        N('j-api', v.crownJewels[6], 'jewel', 'Crown jewel (2.1M vehicles)'),
      ],
      paths: [
        { name: 'Dealer VPN flaw reaches plant MES (plant shutdown)', steps: ['e-dealer', 'h-dc', 'i-da', 'h-pue', 'ot-plc', 'j-mes'], techniques: ['T1190', 'T1003.001', 'T1021.002', 'T0886', 'T1486'], tenants: ['retail', 'puebla', 'group'], likelihood: 'High', actor: 'Black Basta', evidence: 'Qualys: KEV on dealer VPN · Armis: 3 conduits at Puebla bypass the DMZ' },
        { name: 'Robot-OEM standing access reaches body-shop cells', steps: ['e-kuka', 'i-kuka', 'h-jump', 'ot-robot', 'j-robot'], techniques: ['T1133', 'T1078', 'T0886', 'T0831'], tenants: ['ingolstadt'], likelihood: 'High', actor: 'Akira', evidence: 'BeyondTrust: jump item without approval · Armis: robot controller reachable from L3.5' },
        { name: 'Design agency account reaches pre-launch designs (IP theft)', steps: ['e-agency', 'i-agency', 'h-plm', 'j-plm'], techniques: ['T1199', 'T1078', 'T1213', 'T1567.002'], tenants: ['group'], likelihood: 'Medium', actor: 'APT41', evidence: 'Entra guest sign-ins · Teamcenter export volume · HexaCustody watermark' },
        { name: 'Help-desk social engineering reaches the OTA signing key', steps: ['e-help', 'i-da', 'i-ota', 'j-ota'], techniques: ['T1660', 'T1098', 'T1552.004'], tenants: ['group', 'connected'], likelihood: 'Medium', actor: 'Scattered Spider', evidence: 'Entra audit · AWS CloudTrail: KMS key policy trusts a broad admin role' },
        { name: 'Vehicle API flaw reaches remote vehicle commands', steps: ['e-api', 'h-apigw', 'j-api'], techniques: ['T1190', 'T1078', 'T1565.001'], tenants: ['connected'], likelihood: 'Medium', actor: 'Organised crime (keyless theft)', evidence: 'Upstream vSOC: API abuse pattern · HexaStrike: object-level authorisation test' },
      ],
      fixes: {
        'i-da': ['Eliminate standing Tier 0; JIT via Entra PIM with FIDO2', 'Medium · 3 weeks'],
        'h-dc': ['Tier 0 isolation and Credential Guard; block dealer VPN pools from AD', 'Medium · 2 weeks'],
        'h-pue': ['Close the 3 Puebla conduits and force traffic through the Level 3.5 DMZ', 'Medium · 1 change window'],
        'i-kuka': ['Approval-required sessions for all robot-OEM jump items', 'Low · 1 week'],
        'h-jump': ['Restrict L3.5 to L1 flows to named engineering protocols with recording', 'Medium · next outage'],
        'i-agency': ['Move agency access to HexaCustody watermarked review sessions; remove Teamcenter read', 'Low · 3 days'],
        'i-ota': ['Dual-control HSM signing with vSOC alert on key use outside release windows', 'High · quarter'],
        'h-apigw': ['Enforce object-level authorisation and per-VIN rate limits on the API gateway', 'Low · 2 weeks'],
      },
    };
  }
  return {
    nodes: [
      N('e-screener', v.externalHosts[1], 'entry', 'Internet-facing screener portal'),
      N('e-review', v.externalHosts[7], 'entry', 'Dailies review platform'),
      N('e-vendor', tp[1].name, 'entry', `Vendor access · ${tp[1].access}`),
      N('e-phish', `${st[9].name} (phished)`, 'entry', st[9].role),
      N('i-okta', 'Help-desk admin (Okta)', 'identity', 'Can reset MFA'),
      N('i-mam', 'svc_mam_sync', 'identity', 'MAM service account'),
      N('i-ci', 'iam-content-vault-ci', 'identity', 'AWS CI role for the content vault'),
      N('h-review', v.servers[6], 'host', 'MAM / review server'),
      N('h-nexis', v.servers[2], 'host', 'Avid NEXIS storage (Soho)'),
      N('h-playout', v.servers[4], 'host', 'Playout automation (Atlanta)'),
      N('ot-2110', v.otSystems[1], 'ot', 'ST 2110 broadcast network'),
      N('j-masters', v.crownJewels[0], 'jewel', 'Crown jewel: pre-release masters'),
      N('j-nexis', v.crownJewels[1], 'jewel', 'Crown jewel'),
      N('j-playout', v.crownJewels[5], 'jewel', 'Crown jewel'),
      N('j-subs', v.crownJewels[4], 'jewel', 'Crown jewel: subscriber data'),
    ],
    paths: [
      { name: 'Screener portal flaw reaches pre-release masters', steps: ['e-screener', 'i-mam', 'h-review', 'j-masters'], techniques: ['T1190', 'T1078', 'T1530', 'T1567.002'], tenants: ['studios'], likelihood: 'High', actor: 'Leak forums ("pre-release" brokers)', evidence: 'HexaStrike: auth bypass on review links · Cloudflare WAF spikes' },
      { name: 'Vendor compromise reaches NEXIS content store', steps: ['e-vendor', 'i-mam', 'h-nexis', 'j-nexis'], techniques: ['T1199', 'T1078', 'T1039', 'T1048.003'], tenants: ['post'], likelihood: 'High', actor: 'ShinyHunters', evidence: 'Custody agent gaps at the vendor · NEXIS access logs' },
      { name: 'Help-desk social engineering reaches the content vault', steps: ['e-phish', 'i-okta', 'i-ci', 'j-masters'], techniques: ['T1566.002', 'T1660', 'T1552.001', 'T1530'], tenants: ['studios', 'play'], likelihood: 'Medium', actor: 'Scattered Spider', evidence: 'Okta System Log · AWS CloudTrail on the CI role' },
      { name: 'Phished engineer reaches live playout (IT to broadcast)', steps: ['e-phish', 'h-playout', 'ot-2110', 'j-playout'], techniques: ['T1566.001', 'T1021.001', 'T0886', 'T0814'], tenants: ['live'], likelihood: 'Medium', actor: 'Akira', evidence: 'HexaOT (broadcast) · playout automation access' },
      { name: 'Review platform exposure reaches subscriber data', steps: ['e-review', 'i-ci', 'j-subs'], techniques: ['T1190', 'T1552.001', 'T1530'], tenants: ['play'], likelihood: 'Medium', actor: 'LAPSUS$-style extortion crews', evidence: 'Wiz attack-path graph · Snyk IaC finding' },
    ],
    fixes: {
      'i-mam': ['Scope the MAM service account to specific buckets; rotate and vault its secret', 'Low · 3 days'],
      'i-okta': ['Harden help-desk MFA resets with verification and alerting', 'Low · 1 week'],
      'i-ci': ['Replace long-lived keys with short-lived OIDC federation; least-privilege the CI role', 'Medium · 2 weeks'],
      'h-review': ['Patch the review portal and enforce watermarking and MFA on all links', 'Low · 1 week'],
      'h-nexis': ['Enforce custody agents for every vendor hand-off; block personal cloud storage on edit bays', 'Medium · 2 weeks'],
      'h-playout': ['Broker playout access through a bastion; segment broadcast IP from corporate', 'Medium · 1 change window'],
      'ot-2110': ['Monitor the ST 2110 network and broker vendor access (read-only)', 'Medium · next window'],
      'e-screener': ['Retire legacy screener links; move to watermarked, expiring review sessions', 'Low · 1 week'],
    },
  };
}

export function attackPaths(c: CustomerProfile, tenantId: string): { nodes: PathNode[]; paths: AttackPath[] } {
  const spec = pathSpec(c);
  const paths = spec.paths
    .map((p, i) => ({ ...p, id: `AP-${String(i + 1).padStart(2, '0')}` }))
    .filter((p) => tenantId === 'all' || p.tenants.includes(tenantId));
  const used = new Set<string>();
  for (const p of paths) for (const s of p.steps) used.add(s);
  return { nodes: spec.nodes.filter((n) => used.has(n.id)), paths };
}

export function chokePoints(c: CustomerProfile, tenantId: string): ChokePoint[] {
  const spec = pathSpec(c);
  const { nodes, paths } = attackPaths(c, tenantId);
  const owners: Record<PathNodeKind, string> = {
    entry: c.people.socLead.name, identity: c.people.admin.name, host: c.people.socLead.name,
    ot: c.people.otLead?.name ?? c.people.admin.name, jewel: c.people.ciso.name,
  };
  const counts = new Map<string, number>();
  for (const p of paths) {
    const mid = p.steps.slice(1, -1);
    for (const s of new Set(mid)) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return [...counts.entries()]
    .filter(([id]) => spec.fixes[id] && byId[id])
    .map(([id, paths]) => {
      const [fix, effort] = spec.fixes[id];
      const node = byId[id];
      return { node, paths, fix, effort, owner: owners[node.kind] };
    })
    .sort((a, b) => b.paths - a.paths || (a.effort > b.effort ? 1 : -1));
}

/* =====================================================================
   8. Pipeline & cost (ingest tiering, SIEM saving, metering LLD 4.8)
   ===================================================================== */
export interface IngestSource { name: string; category: ConnectorCategory; env: Env; gbDay: number; kept: number; dropped: number; routed: { hot: number; warm: number; cold: number } }
export interface PipelineSummary {
  ingestGbDay: number;
  normalisedGbDay: number;
  droppedPct: number;
  sources: IngestSource[];
  tiers: { tier: 'Hot (searchable)' | 'Warm (90 d)' | 'Cold (archive)'; gbDay: number; retention: string; costPerGb: number }[];
  filters: { label: string; pct: number; note: string }[];
  siem: { beforeMonthly: number; afterMonthly: number; savingYear: number; beforeSeries: number[]; afterSeries: number[] };
}

const CAT_GB: Partial<Record<ConnectorCategory, number>> = {
  SIEM: 0.9, 'EDR / XDR': 2.2, Identity: 0.5, PAM: 0.2, 'Cloud posture': 0.6, Vulnerability: 0.3,
  OT: 0.4, GRC: 0.05, Intelligence: 0.4, Email: 0.6, Network: 3.4, SASE: 2.8, ITSM: 0.2,
  Validation: 0.1, Custody: 0.3, Backup: 0.1, DLP: 1.1, AppSec: 0.1, 'Asset / CMDB': 0.1, Ratings: 0.02, AI: 0.2, HexaShield: 0.2,
};

export function pipelineSummary(c: CustomerProfile, tenantId: string): PipelineSummary {
  const r = rng(`fab-pipe-${c.id}-${tenantId}`);
  const conns = scopedConnectors(c, tenantId);
  const share = tenantShare(c, tenantId);
  const sources: IngestSource[] = conns.map((k) => {
    const base = (CAT_GB[k.category] ?? 0.3) * (0.6 + r() * 0.9) * (k.env === 'ot' ? 0.5 : 1);
    const gbDay = +(base * (tenantId === 'all' ? 1 : Math.max(0.2, share))).toFixed(2);
    const noisy = k.category === 'Network' || k.category === 'SASE' || k.category === 'EDR / XDR';
    const droppedPct = noisy ? r.float(0.35, 0.6) : k.category === 'SIEM' ? r.float(0.1, 0.25) : r.float(0.03, 0.15);
    const dropped = +(gbDay * droppedPct).toFixed(2);
    const kept = +(gbDay - dropped).toFixed(2);
    const hot = +(kept * (k.category === 'SIEM' || k.category === 'EDR / XDR' || k.category === 'Identity' ? r.float(0.5, 0.8) : r.float(0.2, 0.45))).toFixed(2);
    const warm = +((kept - hot) * r.float(0.5, 0.8)).toFixed(2);
    const cold = +(kept - hot - warm).toFixed(2);
    return { name: connShort(k), category: k.category, env: k.env, gbDay, kept, dropped, routed: { hot, warm, cold } };
  }).sort((a, b) => b.gbDay - a.gbDay);
  const ingestGbDay = +sources.reduce((s, x) => s + x.gbDay, 0).toFixed(1);
  const normalisedGbDay = +sources.reduce((s, x) => s + x.kept, 0).toFixed(1);
  const droppedPct = Math.round(((ingestGbDay - normalisedGbDay) / ingestGbDay) * 100);
  const hot = +sources.reduce((s, x) => s + x.routed.hot, 0).toFixed(1);
  const warm = +sources.reduce((s, x) => s + x.routed.warm, 0).toFixed(1);
  const cold = +sources.reduce((s, x) => s + x.routed.cold, 0).toFixed(1);
  const curMul = fxFromUsd(c.currency);
  const beforeMonthly = Math.round(ingestGbDay * 30 * 3.1 * curMul);
  const afterMonthly = Math.round(hot * 30 * 3.1 * curMul + warm * 30 * 0.6 * curMul + cold * 30 * 0.08 * curMul);
  const beforeSeries = Array.from({ length: 12 }, (_, i) => Math.round(beforeMonthly * (0.9 + i * 0.02) * r.float(0.96, 1.05, 3)));
  const afterSeries = beforeSeries.map((b, i) => Math.round((i < 2 ? b : afterMonthly) * r.float(0.97, 1.03, 3)));
  return {
    ingestGbDay, normalisedGbDay, droppedPct, sources,
    tiers: [
      { tier: 'Hot (searchable)', gbDay: hot, retention: '30 days in PostgreSQL', costPerGb: +(3.1 * curMul).toFixed(2) },
      { tier: 'Warm (90 d)', gbDay: warm, retention: '90 days, hourly Parquet to ADLS Gen2', costPerGb: +(0.6 * curMul).toFixed(2) },
      { tier: 'Cold (archive)', gbDay: cold, retention: 'Per-tier lifecycle, cooler Blob tiers', costPerGb: +(0.08 * curMul).toFixed(2) },
    ],
    filters: [
      { label: 'De-duplicated across tools', pct: 34, note: 'Same event seen by EDR, SIEM and network collapsed to one observation' },
      { label: 'Dropped as low-value noise', pct: 28, note: 'Verbose debug, allowed-traffic and heartbeat events filtered at the edge' },
      { label: 'Routed to warm / cold', pct: 24, note: 'Kept for forensics and compliance, not in hot search' },
      { label: 'Kept hot & normalised', pct: 14, note: 'Security-relevant, searchable and mapped to OCSF' },
    ],
    siem: { beforeMonthly, afterMonthly, savingYear: (beforeMonthly - afterMonthly) * 12, beforeSeries, afterSeries },
  };
}

export interface MeterMetric { metric: string; label: string; value: number; unit: string; entitlement: number | null; trend: number[]; note: string }
/** Contractual caps on metered items (null: unlimited on the customer's tier). */
const ENTITLEMENTS: CustomerMap<{ tenants: number | null; copilotTokens: number | null }> = {
  maritime: { tenants: null, copilotTokens: null },
  finserv: { tenants: null, copilotTokens: null },
  media: { tenants: 6, copilotTokens: 60_000_000 },
  healthcare: { tenants: null, copilotTokens: null },
  automotive: { tenants: null, copilotTokens: null },
  insurance: { tenants: null, copilotTokens: null },
  defence: { tenants: 6, copilotTokens: 15_000_000 },
  pharma: { tenants: null, copilotTokens: null },
  sghospital: { tenants: 6, copilotTokens: 20_000_000 },
  studio: { tenants: null, copilotTokens: null },
};
export function meterMetrics(c: CustomerProfile, tenantId: string): MeterMetric[] {
  const ent = forCustomer(ENTITLEMENTS, c);
  const h = headlines(c, tenantId);
  const r = rng(`fab-meter-${c.id}-${tenantId}`);
  const conns = scopedConnectors(c, tenantId);
  const activeInt = conns.filter((k) => k.status !== 'paused').length;
  const tenantsCount = scopedTenants(c, tenantId).length;
  const copTokens = h.ai.copilotQueries30d * r.int(900, 1600);
  const ser = (end: number, jitter = 0.08) => { let v = end * (1 - r.float(0.08, 0.2)); return Array.from({ length: 12 }, (_, i) => (i === 11 ? end : Math.round((v = v + (end - v) / (12 - i) + (r() - 0.5) * end * jitter)))); };
  return [
    { metric: 'active_integrations', label: 'Active integrations', value: activeInt, unit: 'daily max', entitlement: c.integrationLimit, trend: ser(activeInt, 0.03), note: 'Daily maximum of connectors in a non-paused state' },
    { metric: 'tenants', label: 'Tenants', value: tenantsCount, unit: 'isolation boundaries', entitlement: ent.tenants, trend: Array.from({ length: 12 }, () => tenantsCount), note: 'Each tenant is a billing and isolation boundary' },
    { metric: 'events_normalised', label: 'Events normalised', value: h.fabric.eventsPerDay, unit: '/ day', entitlement: null, trend: ser(h.fabric.eventsPerDay), note: 'Canonical OCSF events written after de-dup and filtering' },
    { metric: 'entities', label: 'Entities resolved', value: h.fabric.entities, unit: 'canonical', entitlement: null, trend: ser(h.fabric.entities, 0.04), note: 'Merged assets, identities, findings and more' },
    { metric: 'copilot_tokens', label: 'Copilot tokens', value: copTokens, unit: 'in + out, 30 d', entitlement: ent.copilotTokens, trend: ser(copTokens, 0.12), note: 'Input + output tokens for the assistant' },
    { metric: 'actions_executed', label: 'Actions executed', value: h.ops.actions30d, unit: '30 d', entitlement: null, trend: ser(h.ops.actions30d, 0.1), note: 'Approved write-backs applied through the gateway' },
    { metric: 'evidence_storage_bytes', label: 'Evidence stored', value: Math.round(h.comply.evidenceItems * r.int(1_200_000, 5_400_000)), unit: 'bytes', entitlement: null, trend: ser(h.comply.evidenceItems * 3_000_000, 0.05), note: 'Immutable evidence vault (version-level immutability)' },
  ];
}

/* =====================================================================
   Air-gapped planes (signed bundles) and the vehicle cloud plane
   ===================================================================== */
export interface Bundle { id: string; exportedMin: number; importedMin: number; events: number; sizeMb: number; sha: string; verified: boolean; via: string }
/** What sits behind the air gap and how often it exports a signed bundle. */
const AIRGAP_INFO: CustomerMap<{ site: string; everyH: number }> = {
  maritime: { site: 'the air-gapped site', everyH: 6 },
  finserv: { site: 'the air-gapped site', everyH: 6 },
  media: { site: 'the air-gapped site', everyH: 6 },
  healthcare: { site: 'the air-gapped site', everyH: 6 },
  automotive: { site: 'the battery plant', everyH: 6 },
  pharma: { site: 'aseptic filling line AF-2 (Annex 1 Grade A/B)', everyH: 8 },
};
export function airGapInfo(c: CustomerProfile): { site: string; everyH: number } {
  return forCustomer(AIRGAP_INFO, c);
}
/** Signed bundle history for an air-gapped data plane (newest first). */
export function airGapBundles(c: CustomerProfile, dpId: string, n = 12): Bundle[] {
  const d = c.dataPlanes.find((x) => x.id === dpId);
  if (!d || d.placement !== 'Air-gapped') return [];
  const r = rng(`fab-bundles-${c.id}-${dpId}`);
  const lastExport = Math.round(d.heartbeatSecAgo / 60);
  const every = airGapInfo(c).everyH * 60;
  return Array.from({ length: n }, (_, i) => {
    const exportedMin = lastExport + i * every;
    return {
      id: `BND-${String(4280 - i).padStart(5, '0')}`, exportedMin, importedMin: exportedMin - r.int(4, 18),
      events: r.int(1_050_000, 1_480_000), sizeMb: r.int(380, 620), sha: r.hex(64),
      verified: true, via: 'Data diode (one-way) to Group data plane',
    };
  });
}
export function airGapPlanes(c: CustomerProfile) {
  return c.dataPlanes.filter((d) => d.placement === 'Air-gapped');
}

export interface FleetRegion { region: string; vehicles: number; online: number; anomalies24h: number; otaPending: number }
export interface FleetSummary { vehicles: number; online: number; anomalies24h: number; campaigns: { name: string; ecu: string; progress: number; vehicles: number; status: 'Rolling out' | 'Paused' | 'Complete' }[]; regions: FleetRegion[]; vsocIncidents: number }
/** Connected-vehicle fleet figures for the vehicle cloud plane (Upstream vSOC); null when the customer has none. */
export function vehicleFleet(c: CustomerProfile): FleetSummary | null {
  if (!c.connectors.some((k) => k.id === 'c-upstream')) return null;
  const r = rng(`fab-fleet-${c.id}`);
  const regs: [string, number][] = [['Germany', 0.31], ['Rest of EU', 0.27], ['United Kingdom', 0.08], ['North America', 0.2], ['China', 0.09], ['Rest of world', 0.05]];
  const total = 2_100_000;
  const regions = regs.map(([region, w]) => {
    const vehicles = Math.round(total * w);
    return { region, vehicles, online: Math.round(vehicles * r.float(0.61, 0.72, 3)), anomalies24h: r.int(8, 140), otaPending: Math.round(vehicles * r.float(0.04, 0.12, 3)) };
  });
  return {
    vehicles: total, online: regions.reduce((s, x) => s + x.online, 0), anomalies24h: regions.reduce((s, x) => s + x.anomalies24h, 0), vsocIncidents: 4,
    regions,
    campaigns: [
      { name: 'OTA 24.9.3 (ADAS camera)', ecu: 'ADAS domain controller', progress: 64, vehicles: 820_000, status: 'Rolling out' },
      { name: 'OTA 24.8.1 (telematics security fix)', ecu: 'TCU (Continental)', progress: 97, vehicles: 1_640_000, status: 'Rolling out' },
      { name: 'OTA 24.7.4 (BMS calibration)', ecu: 'Battery management', progress: 100, vehicles: 410_000, status: 'Complete' },
      { name: 'OTA 24.9.0 (infotainment)', ecu: 'Head unit', progress: 22, vehicles: 1_100_000, status: 'Paused' },
    ],
  };
}
