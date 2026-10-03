// Security Tooling: an itinerary of every security tool integrated into
// HexaView, what each one is doing, and how it is wired into the fabric
// (tool → data plane → gateway → HexaCore canonical model → modules).
// Derived from the customer's connector list; seeded so it is stable.
import type { Connector, ConnectorCategory, CustomerProfile, Env, Health } from '../types';
import { rng } from '../../lib/rng';
import { scopedConnectors } from '../customers';
import { connName, connShort, effHealth } from './fabric';

export type CsfFunction = 'Govern' | 'Identify' | 'Protect' | 'Detect' | 'Respond' | 'Recover';
export const CSF: CsfFunction[] = ['Govern', 'Identify', 'Protect', 'Detect', 'Respond', 'Recover'];
export const CSF_HEX: Record<CsfFunction, string> = { Govern: '#93d65a', Identify: '#68b1ff', Protect: '#3fd0f0', Detect: '#a07cfb', Respond: '#f8646f', Recover: '#f7a04a' };

/** Canonical entities in HexaCore (LLD 4.2). */
export const ENTITIES = ['asset', 'identity', 'finding', 'detection', 'case', 'control', 'evidence', 'indicator', 'validation', 'event'] as const;
export type Entity = (typeof ENTITIES)[number];
export const ENTITY_LABEL: Record<Entity, string> = {
  asset: 'Assets', identity: 'Identities', finding: 'Findings', detection: 'Detections', case: 'Cases',
  control: 'Controls', evidence: 'Evidence', indicator: 'Indicators', validation: 'Validations', event: 'Events',
};
export const ENTITY_HEX: Record<Entity, string> = {
  asset: '#68b1ff', identity: '#8f8cff', finding: '#f5a83d', detection: '#a07cfb', case: '#f8646f',
  control: '#93d65a', evidence: '#2dd4bf', indicator: '#ef6aae', validation: '#3fd0f0', event: '#8a9bc0',
};

/** HexaView modules a tool's data lands in (registry module ids). */
export const MODULE_LABEL: Record<string, string> = {
  soc: 'HexaSOC', int: 'HexaInt', strike: 'HexaStrike', ot: 'HexaOT', comply: 'HexaComply', custody: 'HexaCustody',
  ai: 'HexaAI', insurance: 'Insurance', fabric: 'HexaCore', loop: 'Closed loop', ops: 'Operations', reports: 'Reporting',
};

interface CatProfile {
  csf: CsfFunction[];
  entities: Entity[];
  modules: string[];
  method: string;
  auth: string;
  ocsf: string[];
  verbs: string[]; // what the tool is doing, used to build its activity
  role: string; // one line: what it does in this estate
}

const CAT: Record<ConnectorCategory, CatProfile> = {
  SIEM: { csf: ['Detect', 'Respond'], entities: ['detection', 'case', 'event'], modules: ['soc', 'loop', 'reports'], method: 'REST API poll + incident webhook', auth: 'OAuth 2.0 client credentials', ocsf: ['Detection Finding (2004)', 'Incident Finding (2005)'], verbs: ['correlated', 'raised incident for', 'enriched', 'suppressed duplicate on', 'fired rule on'], role: 'Correlates logs and raises the incidents HexaSOC works' },
  'EDR / XDR': { csf: ['Protect', 'Detect', 'Respond'], entities: ['asset', 'detection', 'finding'], modules: ['soc', 'fabric', 'insurance'], method: 'Streaming API (event hub)', auth: 'Service principal (certificate)', ocsf: ['Device Inventory (5001)', 'Detection Finding (2004)', 'Vulnerability Finding (2002)'], verbs: ['blocked process on', 'quarantined file on', 'flagged behaviour on', 'scanned', 'updated sensor on'], role: 'Protects endpoints and servers; detections and inventory feed the SOC' },
  Identity: { csf: ['Protect', 'Detect'], entities: ['identity', 'event'], modules: ['fabric', 'soc', 'insurance'], method: 'Graph / REST API + sign-in log stream', auth: 'OAuth 2.0 (least-privilege app)', ocsf: ['User Inventory (5003)', 'Authentication (3002)'], verbs: ['challenged MFA for', 'flagged risky sign-in for', 'synced', 'disabled stale account', 'evaluated policy for'], role: 'Who people are, how they sign in and where risk is' },
  PAM: { csf: ['Protect', 'Detect'], entities: ['identity', 'event'], modules: ['fabric', 'comply', 'ot'], method: 'REST API poll', auth: 'API key in customer vault', ocsf: ['Account Change (3001)', 'Authorize Session (3003)'], verbs: ['brokered session for', 'rotated credential on', 'recorded vendor session on', 'denied checkout for'], role: 'Brokers and records privileged and vendor access' },
  'Cloud posture': { csf: ['Identify', 'Protect'], entities: ['asset', 'finding'], modules: ['fabric', 'comply'], method: 'REST API poll', auth: 'Read-only role (federated)', ocsf: ['Compliance Finding (2003)', 'Cloud Resources Inventory (5023)'], verbs: ['assessed', 'flagged misconfiguration in', 'scored', 'found public exposure in'], role: 'Cloud inventory, misconfigurations and compliance posture' },
  Vulnerability: { csf: ['Identify'], entities: ['asset', 'finding'], modules: ['fabric', 'strike', 'insurance'], method: 'REST API export (incremental)', auth: 'API key in customer vault', ocsf: ['Vulnerability Finding (2002)', 'Device Inventory (5001)'], verbs: ['scanned', 'found KEV on', 'confirmed fix on', 'rescored'], role: 'Finds and ranks vulnerabilities across the estate' },
  OT: { csf: ['Identify', 'Detect'], entities: ['asset', 'detection', 'finding'], modules: ['ot', 'soc'], method: 'Passive sensor feed via edge agent', auth: 'mTLS (on-site edge)', ocsf: ['Device Inventory (5001)', 'Detection Finding (2004)'], verbs: ['observed new device', 'baselined traffic on', 'flagged unexpected command to', 'mapped conduit for'], role: 'Passive visibility of operational technology; read-only by policy' },
  GRC: { csf: ['Govern'], entities: ['control', 'evidence'], modules: ['comply', 'loop', 'reports'], method: 'Bidirectional API', auth: 'OAuth 2.0 client credentials', ocsf: ['OSCAL implemented-requirement', 'OSCAL observation'], verbs: ['collected evidence for', 'updated control', 'scoped requirement', 'assigned task for'], role: 'Frameworks, controls and evidence: the governance spine of the loop' },
  Intelligence: { csf: ['Identify', 'Detect'], entities: ['indicator'], modules: ['int', 'soc'], method: 'TAXII 2.1 collection / API', auth: 'API token', ocsf: ['STIX 2.1 indicator', 'STIX intrusion-set'], verbs: ['published indicator for', 'matched sighting on', 'aged out', 'attributed'], role: 'Threat intelligence that sharpens every other tool' },
  Email: { csf: ['Protect', 'Detect'], entities: ['finding', 'event'], modules: ['soc', 'insurance'], method: 'REST API poll + SIEM forward', auth: 'API token', ocsf: ['Email Activity (4009)', 'Detection Finding (2004)'], verbs: ['blocked phish to', 'rewrote URL for', 'sandboxed attachment for', 'quarantined message to'], role: 'Stops phishing and impersonation before the inbox' },
  Network: { csf: ['Protect', 'Detect'], entities: ['event', 'detection'], modules: ['soc', 'fabric'], method: 'Syslog / CEF via edge agent', auth: 'mTLS (edge)', ocsf: ['Network Activity (4001)'], verbs: ['denied flow from', 'inspected session to', 'logged threat on', 'applied policy to'], role: 'Perimeter and segmentation enforcement' },
  SASE: { csf: ['Protect', 'Detect'], entities: ['event', 'finding'], modules: ['soc', 'ai', 'fabric'], method: 'Streaming log API', auth: 'OAuth 2.0 client credentials', ocsf: ['HTTP Activity (4002)', 'Data Security Finding'], verbs: ['blocked category for', 'brokered private access for', 'inspected upload by', 'flagged GenAI use by'], role: 'Web, private access and data controls for users anywhere' },
  ITSM: { csf: ['Respond'], entities: ['case'], modules: ['ops', 'soc'], method: 'Bidirectional API', auth: 'OAuth 2.0 (integration user)', ocsf: ['Incident Finding (2005)'], verbs: ['opened ticket for', 'assigned', 'closed change', 'escalated'], role: 'Tickets and change: where remediation is tracked' },
  Validation: { csf: ['Identify', 'Detect'], entities: ['validation', 'finding'], modules: ['strike', 'loop'], method: 'Native (HexaShield)', auth: 'Platform identity', ocsf: ['HexaView validation'], verbs: ['tested technique', 'validated detection for', 'retested', 'scheduled campaign for'], role: 'Proves detections and controls actually work' },
  Custody: { csf: ['Protect', 'Detect'], entities: ['event', 'evidence'], modules: ['custody', 'soc'], method: 'Agent telemetry (signed)', auth: 'Device certificate', ocsf: ['File Activity (1001)'], verbs: ['tagged', 'tracked transfer of', 'verified hash for', 'revoked access to'], role: 'Chain of custody for your most valuable files' },
  Backup: { csf: ['Recover'], entities: ['evidence', 'asset'], modules: ['insurance', 'comply'], method: 'REST API poll', auth: 'API key in customer vault', ocsf: ['HexaView backup evidence'], verbs: ['completed immutable backup of', 'tested restore of', 'flagged anomaly in', 'locked snapshot of'], role: 'Immutable copies and tested recovery' },
  DLP: { csf: ['Protect', 'Detect'], entities: ['finding', 'event'], modules: ['ai', 'custody', 'soc'], method: 'REST API poll', auth: 'OAuth 2.0 client credentials', ocsf: ['Data Security Finding'], verbs: ['blocked upload by', 'flagged sensitive data from', 'alerted on access by', 'classified'], role: 'Finds sensitive data leaving where it should not' },
  AppSec: { csf: ['Identify', 'Protect'], entities: ['finding'], modules: ['strike', 'comply'], method: 'REST API poll', auth: 'API token', ocsf: ['Vulnerability Finding (2002)'], verbs: ['scanned build of', 'found flaw in', 'passed policy for', 'flagged secret in'], role: 'Flaws in the code you build' },
  AI: { csf: ['Govern', 'Detect'], entities: ['finding', 'asset'], modules: ['ai'], method: 'REST API poll', auth: 'API token', ocsf: ['HexaView AI usage'], verbs: ['discovered model', 'flagged prompt to', 'evaluated'], role: 'AI usage and model risk' },
  HexaShield: { csf: ['Detect'], entities: ['event'], modules: ['fabric'], method: 'Native (HexaShield)', auth: 'Platform identity', ocsf: ['HexaView'], verbs: ['processed'], role: 'HexaShield platform' },
  'Asset / CMDB': { csf: ['Identify'], entities: ['asset'], modules: ['fabric', 'ot'], method: 'REST API / database extract', auth: 'Read-only service account', ocsf: ['Device Inventory (5001)'], verbs: ['synced record for', 'reconciled', 'retired', 'updated owner of'], role: 'Business context: what an asset is and who owns it' },
  Ratings: { csf: ['Govern', 'Identify'], entities: ['finding'], modules: ['comply', 'insurance'], method: 'REST API poll (daily)', auth: 'API token', ocsf: ['HexaView vendor rating'], verbs: ['rescored supplier', 'flagged issue at', 'added supplier'], role: 'Outside-in risk ratings of your suppliers' },
};

export interface ToolProfile {
  k: Connector;
  name: string;
  short: string;
  monogram: string;
  health: Health;
  csf: CsfFunction[];
  entities: Entity[];
  modules: string[];
  method: string;
  auth: string;
  ocsf: string[];
  role: string;
  verbs: string[];
  eventsPerMin: number;
  /** 24 hourly points of activity, oldest first. */
  hourly: number[];
  actions30d: number;
  readOnly: boolean;
}

function profileFor(c: CustomerProfile, k: Connector): ToolProfile {
  const p = CAT[k.category];
  const r = rng(`tool-${c.id}-${k.id}`);
  const base = Math.max(2, Math.round(k.records / (k.intervalMin * 6)));
  const eventsPerMin = k.status === 'paused' ? 0 : Math.round(base * r.float(0.6, 1.6, 2));
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const day = 0.55 + 0.45 * Math.sin(((i - 6) / 24) * Math.PI * 2 * 0.5 + 0.2) ** 2;
    return Math.max(0, Math.round(eventsPerMin * 60 * day * r.float(0.7, 1.3, 2)));
  });
  const words = (k.vendor === 'Generic' || k.vendor === 'HexaShield' ? k.product : k.vendor).split(/[\s/()]+/).filter(Boolean);
  const monogram = (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
  const readOnly = k.write.length === 0 || k.env === 'ot';
  return {
    k, name: connName(k), short: connShort(k), monogram, health: effHealth(k),
    csf: p.csf, entities: p.entities, modules: p.modules, method: p.method, auth: p.auth, ocsf: p.ocsf, role: k.note && /read-only/i.test(k.note) ? `${p.role}` : p.role,
    verbs: p.verbs, eventsPerMin, hourly, actions30d: readOnly ? 0 : r.int(2, 40), readOnly,
  };
}

/** Every integrated tool for the tenant scope (HexaShield's own platforms excluded unless asked). */
export function toolProfiles(c: CustomerProfile, tenantId: string, includeHexa = true): ToolProfile[] {
  return scopedConnectors(c, tenantId)
    .filter((k) => includeHexa || k.vendor !== 'HexaShield')
    .map((k) => profileFor(c, k));
}

export interface ToolEvent {
  id: string;
  tool: ToolProfile;
  text: string;
  entity: Entity;
  write: boolean;
  secAgo: number;
}

/** A rolling activity stream: what the tools are doing right now. `tick` advances it. */
export function activityStream(c: CustomerProfile, tools: ToolProfile[], tick: number, n = 14): ToolEvent[] {
  const live = tools.filter((t) => t.eventsPerMin > 0);
  if (!live.length) return [];
  const objects = [...c.vocab.servers, ...c.vocab.crownJewels, ...c.people.staff.map((p) => p.name), ...c.vocab.otSystems, ...c.vocab.externalHosts];
  const out: ToolEvent[] = [];
  for (let i = 0; i < n; i++) {
    const seq = tick - i;
    const r = rng(`act-${c.id}-${seq}`);
    // Busier tools speak more often.
    const tool = r.weighted(live.map((t) => [t, Math.sqrt(t.eventsPerMin) + 1] as const));
    const verb = r.pick(tool.verbs);
    const obj = tool.k.category === 'OT' ? r.pick(c.vocab.otSystems) : tool.k.category === 'Intelligence' ? r.pick(c.vocab.threatActors) : r.pick(objects);
    const write = !tool.readOnly && r.chance(0.08);
    out.push({
      id: `${seq}`,
      tool,
      text: write ? `Write-back: ${tool.k.write[0].toLowerCase()} (approved, verified)` : `${verb} ${obj}`,
      entity: r.pick(tool.entities),
      write,
      secAgo: i * 3 + r.int(0, 2),
    });
  }
  return out;
}

export function csfCoverage(tools: ToolProfile[]): { fn: CsfFunction; tools: ToolProfile[] }[] {
  return CSF.map((fn) => ({ fn, tools: tools.filter((t) => t.csf.includes(fn)) }));
}

export function envOf(t: ToolProfile): Env {
  return t.k.env;
}
