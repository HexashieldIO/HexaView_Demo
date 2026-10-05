// Incident Response (L4) data model. Pure, seeded generators that build the
// starting state for one customer: SOC escalations waiting for L4, active
// incidents in different NIST SP 800-61 phases and closed incidents with issued
// reports. The in-session store (src/pages/incident/store.ts) persists this
// state and applies every change, writing hash-chained timeline entries.
import type { Connector, CustomerProfile, Person, Severity } from '../types';
import { rng, type Rng } from '../../lib/rng';
import { incidents as socIncidents, tickets as socTickets, regClocks, socTools, toolShort, HEXASOC_ANALYSTS, type Incident } from './soc';
import { forCustomer, type CustomerMap } from '../customerMap';

/* =====================================================================
   Vocabulary
   ===================================================================== */
export type IrType = 'ransomware' | 'bec' | 'breach' | 'insider' | 'ato' | 'ot' | 'ddos' | 'supply';
export const IR_TYPES: Record<IrType, { label: string; short: string; color: string }> = {
  ransomware: { label: 'Ransomware', short: 'Ransomware', color: 'var(--sev-critical)' },
  bec: { label: 'BEC / payment fraud', short: 'BEC', color: 'var(--sev-high)' },
  breach: { label: 'Data breach / exfiltration', short: 'Data breach', color: 'var(--m-int)' },
  insider: { label: 'Insider', short: 'Insider', color: 'var(--m-ai)' },
  ato: { label: 'Cloud account takeover', short: 'Account takeover', color: 'var(--m-core)' },
  ot: { label: 'OT safety event', short: 'OT safety', color: 'var(--m-ot)' },
  ddos: { label: 'DDoS', short: 'DDoS', color: 'var(--sev-medium)' },
  supply: { label: 'Supply-chain compromise', short: 'Supply chain', color: 'var(--m-comply)' },
};
export const IR_TYPE_IDS = Object.keys(IR_TYPES) as IrType[];

export type Sev = 1 | 2 | 3 | 4;
export const SEV_LABEL: Record<Sev, string> = { 1: 'SEV1', 2: 'SEV2', 3: 'SEV3', 4: 'SEV4' };
export const SEV_DESC: Record<Sev, string> = {
  1: 'Critical business impact, regulated data or safety at risk',
  2: 'Major impact on a crown-jewel system or tenant',
  3: 'Contained impact, limited scope',
  4: 'Minor, no business impact',
};
export const SEV_COLOR_IR: Record<Sev, string> = { 1: 'var(--sev-critical)', 2: 'var(--sev-high)', 3: 'var(--sev-medium)', 4: 'var(--sev-low)' };
export const SEV_TO_SOC: Record<Sev, Severity> = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' };
export const SOC_TO_SEV: Record<Severity, Sev> = { critical: 1, high: 2, medium: 3, low: 4, info: 4 };
/** Minutes IR has to accept an escalation, by recommended severity. */
export const ACCEPT_SLA: Record<Sev, number> = { 1: 15, 2: 30, 3: 60, 4: 240 };

export const PHASES = ['detect', 'contain', 'eradicate', 'recover', 'post'] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABEL: Record<Phase, string> = {
  detect: 'Detection & analysis',
  contain: 'Containment',
  eradicate: 'Eradication',
  recover: 'Recovery',
  post: 'Post-incident',
};
export const PHASE_SHORT: Record<Phase, string> = { detect: 'Detect', contain: 'Contain', eradicate: 'Eradicate', recover: 'Recover', post: 'Post-incident' };
export const PHASE_COLOR: Record<Phase, string> = {
  detect: '#f2643f',
  contain: '#e11d48',
  eradicate: '#a07cfb',
  recover: '#2dd4bf',
  post: '#4f8cff',
};

export const ROLE_NAMES = ['Incident Commander', 'Deputy', 'Scribe', 'Tech lead', 'Comms lead', 'Legal', 'Exec sponsor'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const STREAMS = ['Containment', 'Forensics', 'Recovery', 'Comms', 'Legal & regulatory', 'Business continuity'] as const;
export type Stream = (typeof STREAMS)[number];
export const STREAM_COLOR: Record<Stream, string> = {
  Containment: '#e11d48',
  Forensics: '#a07cfb',
  Recovery: '#2dd4bf',
  Comms: '#4f8cff',
  'Legal & regulatory': '#f5a83d',
  'Business continuity': '#93d65a',
};
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done';
export const TASK_COLS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];

export type TlType = 'alert' | 'automation' | 'escalation' | 'note' | 'decision' | 'containment' | 'evidence' | 'comms' | 'stakeholder' | 'phase' | 'notification' | 'report';
export const TL_TYPE: Record<TlType, { label: string; color: string; auto: boolean }> = {
  alert: { label: 'Alert', color: '#f2643f', auto: true },
  automation: { label: 'Automation', color: '#a07cfb', auto: true },
  escalation: { label: 'Escalation', color: '#f0a338', auto: false },
  note: { label: 'Analyst note', color: '#8a9bc0', auto: false },
  decision: { label: 'Decision', color: '#e11d48', auto: false },
  containment: { label: 'Containment', color: '#ef6aae', auto: true },
  evidence: { label: 'Evidence', color: '#2dd4bf', auto: true },
  comms: { label: 'Comms', color: '#4f8cff', auto: false },
  stakeholder: { label: 'Stakeholder', color: '#68b1ff', auto: false },
  phase: { label: 'Phase change', color: '#ecc873', auto: false },
  notification: { label: 'Notification', color: '#f5a83d', auto: false },
  report: { label: 'Report', color: '#93d65a', auto: false },
};

/* =====================================================================
   Records
   ===================================================================== */
export interface Alert { tool: string; title: string; t: number }
export interface PathStep { level: 'L1' | 'L2' | 'L3' | 'L4'; who: string; t: number; note: string }

/** What the SOC knows when it escalates; also the seed for a declared incident. */
export interface CaseSeed {
  title: string;
  type: IrType;
  sev: Sev;
  tenantId: string;
  assets: string[];
  users: string[];
  techniques: string[];
  alerts: Alert[];
  dataClasses: string[];
  services: string[];
  personal: boolean;
  ot: boolean;
  leak: boolean;
  card: boolean;
  actor?: string;
  socId?: string;
  ticketId?: string;
  summary: string;
  rootCause: string;
  records: number;
  impact: number;
  detectedAt: number;
  escalatedAt: number;
  path: PathStep[];
}

export type EscStatus = 'awaiting' | 'info' | 'accepted' | 'merged';
export interface Escalation extends CaseSeed {
  id: string;
  status: EscStatus;
  reason: string;
  notes: string;
  escalatedBy: string;
  slaMin: number;
  incidentId?: string;
  infoAsk?: string;
  guided?: boolean;
}

export interface Role { role: RoleName; name: string; org: string }
export interface Task { id: string; title: string; stream: Stream; owner: string; dueAt: number; status: TaskStatus }
export interface Decision { id: string; t: number; decision: string; rationale: string; by: string }
export type Raci = 'R' | 'A' | 'C' | 'I';
export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  org: string;
  group: 'internal' | 'external';
  kind: string;
  incidentRole: string;
  raci: Raci;
  channel: string;
  contact: string;
  notifiedAt?: number;
  ackAt?: number;
  privileged: boolean;
  nda: boolean;
}
export interface TimelineEntry {
  id: string;
  seq: number;
  t: number;
  actor: string;
  source: string;
  to?: string;
  type: TlType;
  phase: Phase;
  text: string;
  evidence?: string[];
  key: boolean;
  auto: boolean;
  prev: string;
  hash: string;
}
export type EvidenceType = 'Memory image' | 'Disk image' | 'Logs export' | 'EDR triage package' | 'Email sample' | 'Screenshots' | 'Cloud audit logs' | 'Network capture';
export interface CustodyHop { t: number; from: string; to: string; action: string }
export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  name: string;
  tool: string;
  collectedBy: string;
  t: number;
  sha256: string;
  bytes: number;
  location: string;
  legalHold: boolean;
  custody: CustodyHop[];
}
export type NoticeKind = 'regulator' | 'insurer' | 'law' | 'contract' | 'internal' | 'customer';
export type NoticeStatus = 'draft' | 'approved' | 'sent' | 'na';
export interface Notice {
  id: string;
  kind: NoticeKind;
  name: string;
  recipient: string;
  basis: string;
  startAt: number;
  dueAt: number | null;
  status: NoticeStatus;
  owner: string;
  channel: string;
  approvedBy?: string;
  approvedAt?: number;
  sentAt?: number;
}
export type ReportStatus = 'none' | 'generated' | 'requested' | 'signed' | 'issued';
export type IrAudience = 'Executive / Board' | 'Regulator' | 'Insurer / breach coach' | 'Customers' | 'Internal technical';
export const IR_AUDIENCES: IrAudience[] = ['Executive / Board', 'Regulator', 'Insurer / breach coach', 'Customers', 'Internal technical'];
export type IrSectionId = 'summary' | 'timeline' | 'scope' | 'root' | 'actions' | 'notices' | 'data' | 'lessons' | 'appendix';
export const IR_SECTIONS: { id: IrSectionId; label: string; hint: string }[] = [
  { id: 'summary', label: 'Executive summary', hint: 'What happened, impact and status in five sentences' },
  { id: 'timeline', label: 'Timeline of key events', hint: 'Pinned key events from the audited timeline' },
  { id: 'scope', label: 'Scope & impact', hint: 'Tenants, assets, business services and cost' },
  { id: 'root', label: 'Root cause & attack path', hint: 'Initial access to impact, mapped to MITRE ATT&CK' },
  { id: 'actions', label: 'Containment, eradication & recovery', hint: 'Actions taken by workstream' },
  { id: 'notices', label: 'Notifications made', hint: 'Regulators, insurer, contracts and law enforcement' },
  { id: 'data', label: 'Data affected', hint: 'Data classes, records and individuals' },
  { id: 'lessons', label: 'Lessons learned & actions', hint: 'From the post-incident review' },
  { id: 'appendix', label: 'Appendix: evidence list', hint: 'Evidence items with SHA-256 and custody' },
];
export const AUDIENCE_SECTIONS: Record<IrAudience, IrSectionId[]> = {
  'Executive / Board': ['summary', 'timeline', 'scope', 'notices', 'lessons'],
  Regulator: ['summary', 'timeline', 'scope', 'root', 'actions', 'notices', 'data', 'appendix'],
  'Insurer / breach coach': ['summary', 'timeline', 'scope', 'root', 'actions', 'data', 'appendix'],
  Customers: ['summary', 'data', 'actions'],
  'Internal technical': ['summary', 'timeline', 'root', 'actions', 'lessons', 'appendix'],
};
export interface Signature { name: string; t: number }
export interface ReportState {
  audience: IrAudience;
  sections: IrSectionId[];
  status: ReportStatus;
  version: number;
  generatedAt?: number;
  requestedAt?: number;
  legal?: Signature;
  ciso?: Signature;
  issuedAt?: number;
  hash?: string;
}
export type ActionDest = 'comply' | 'programme' | 'detection' | 'exercise';
export const DEST_META: Record<ActionDest, { label: string; to: string }> = {
  comply: { label: 'HexaComply task', to: '/comply/caas?section=tasks' },
  programme: { label: 'Security Programme', to: '/programme/initiatives' },
  detection: { label: 'Detection engineering', to: '/soc/detection' },
  exercise: { label: 'Exercise library', to: '/ops/exercises' },
};
export interface ReviewAction { id: string; title: string; owner: string; dueAt: number; dest: ActionDest; pushed: boolean; ref?: string; done?: boolean }
export type ReviewStatus = 'not_started' | 'scheduled' | 'in_progress' | 'complete';
export interface Review {
  status: ReviewStatus;
  scheduledAt?: number;
  completedAt?: number;
  facilitator: string;
  wentWell: string[];
  didnt: string[];
  rootCauses: string[];
  actions: ReviewAction[];
}

export interface IrIncident {
  id: string;
  title: string;
  type: IrType;
  sev: Sev;
  phase: Phase;
  status: 'active' | 'closed';
  commander: string;
  summary: string;
  rootCause: string;
  tenantIds: string[];
  sites: string[];
  assets: string[];
  users: string[];
  dataClasses: string[];
  services: string[];
  techniques: string[];
  actor?: string;
  socId?: string;
  ticketId?: string;
  escalationIds: string[];
  personal: boolean;
  ot: boolean;
  detectedAt: number;
  escalatedAt: number;
  declaredAt: number;
  phaseAt: Partial<Record<Phase, number>>;
  closedAt?: number;
  bridge: string;
  channels: string[];
  roles: Role[];
  tasks: Task[];
  decisions: Decision[];
  stakeholders: Stakeholder[];
  timeline: TimelineEntry[];
  evidence: EvidenceItem[];
  notices: Notice[];
  checks: Record<string, { t: number; by: string }>;
  report: ReportState;
  review: Review;
  stats: { hostsIsolated: number; accountsDisabled: number; records: number; impact: number };
  /** Minutes from initial access to the first detection. */
  dwellMin: number;
  guided?: boolean;
}

export interface Guided { step: number; escalationId: string; incidentId: string | null }
export interface IrState {
  v: 2;
  seededAt: number;
  seq: number;
  escalations: Escalation[];
  incidents: IrIncident[];
  focus: string | null;
  guided: Guided | null;
}

/* =====================================================================
   SHA-256 (synchronous, so the hash chain can be built and verified inline)
   ===================================================================== */
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
export function sha256(msg: string): string {
  const bytes = new TextEncoder().encode(msg);
  const l = bytes.length;
  const withPad = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(withPad);
  buf.set(bytes);
  buf[l] = 0x80;
  const bits = l * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(withPad - 4, bits >>> 0);
  dv.setUint32(withPad - 8, Math.floor(bits / 0x100000000));
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < withPad; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}

export const GENESIS = '0'.repeat(64);
export function entryHash(prev: string, e: Pick<TimelineEntry, 'seq' | 't' | 'actor' | 'source' | 'type' | 'text'>): string {
  return sha256(`${prev}|${e.seq}|${e.t}|${e.actor}|${e.source}|${e.type}|${e.text}`);
}
/** Recompute the chain; returns the seq of the first broken link, or null when intact. */
export function verifyChain(entries: TimelineEntry[]): { ok: boolean; brokenAt: number | null; checked: number } {
  const sorted = entries.slice().sort((a, b) => a.seq - b.seq);
  let prev = GENESIS;
  for (const e of sorted) {
    if (e.prev !== prev || entryHash(prev, e) !== e.hash) return { ok: false, brokenAt: e.seq, checked: sorted.length };
    prev = e.hash;
  }
  return { ok: true, brokenAt: null, checked: sorted.length };
}

/* =====================================================================
   Tools and people
   ===================================================================== */
export interface IrTools {
  siem: string;
  edr: string;
  idp: string;
  email: string;
  ot: string;
  net: string;
  custody: string;
  backup: string;
  itsm: string;
  hasEdr: boolean;
  hasOt: boolean;
}
const first = (c: CustomerProfile, cat: Connector['category']) => c.connectors.find((k) => k.category === cat);
export function irTools(c: CustomerProfile): IrTools {
  const t = socTools(c);
  const ot = first(c, 'OT');
  const custody = first(c, 'Custody');
  const backup = first(c, 'Backup');
  const itsm = first(c, 'ITSM');
  return {
    siem: t.siemShort,
    edr: t.edr ? t.edrShort : 'EDR',
    idp: t.idpShort,
    email: t.email ? toolShort(t.email) : 'Email gateway',
    ot: ot ? toolShort(ot) : 'HexaOT',
    net: t.net[0] ? toolShort(t.net[0]) : t.siemShort,
    custody: custody ? 'HexaCustody' : 'HexaCustody',
    backup: backup ? toolShort(backup) : 'Backup platform',
    itsm: itsm ? toolShort(itsm) : 'ITSM',
    hasEdr: !!t.edr,
    hasOt: !!ot,
  };
}

const allPeople = (c: CustomerProfile): Person[] => {
  const out: Person[] = [];
  const add = (p?: Person) => p && !out.some((x) => x.name === p.name) && out.push(p);
  Object.values(c.rolePeople ?? {}).forEach(add);
  [c.people.ciso, c.people.socLead, c.people.grcLead, c.people.otLead, c.people.admin, c.people.board].forEach(add);
  c.people.staff.forEach(add);
  return out;
};
const findPerson = (c: CustomerProfile, rx: RegExp): Person | undefined => allPeople(c).find((p) => rx.test(p.role));

export interface IrPeople {
  ciso: Person;
  soc: Person;
  grc: Person;
  privacy: Person;
  legal: Person;
  risk: Person;
  cloud: Person;
  ot?: Person;
  ceo: Person;
  cfo: Person;
  comms: Person;
  hr: Person;
  analyst: Person;
}
export function irPeople(c: CustomerProfile): IrPeople {
  const rp = c.rolePeople ?? {};
  const privacy = rp.privacy ?? c.people.grcLead;
  return {
    ciso: rp.ciso ?? c.people.ciso,
    soc: rp.socmanager ?? c.people.socLead,
    grc: rp.grc ?? c.people.grcLead,
    privacy,
    legal: findPerson(c, /general counsel|counsel|legal/i) ?? { ...privacy, role: `${privacy.role} (acting legal lead)` },
    risk: rp.risk ?? c.people.grcLead,
    cloud: rp.cloud ?? c.people.admin,
    ot: rp.ot ?? c.people.otLead,
    ceo: rp.executive ?? c.people.board,
    cfo: rp.finance ?? findPerson(c, /CFO|financial officer/i) ?? c.people.board,
    comms: findPerson(c, /communications|marketing|PR\b/i) ?? { name: 'Corporate communications (on call)', role: 'Communications & media relations', email: `press@${c.domain}` },
    hr: findPerson(c, /\bHR\b|people|human/i) ?? { name: 'HR business partner (on call)', role: 'Human resources', email: `hr@${c.domain}` },
    analyst: rp.analyst ?? c.people.socLead,
  };
}

const IR_TEAM = { lead: 'Hannah Weiss', dfir: 'Freya Lund', l3: 'Nadia Petrov', l3b: 'Aiko Tanaka', l2: 'Callum Reid', l2b: 'Mateus Silva' };
export const HEXA_IR_LEAD = `${IR_TEAM.lead} (HexaShield IR lead)`;

function lawEnforcement(c: CustomerProfile): string {
  const hq = c.hq;
  if (/Netherlands/.test(hq)) return 'Politie (Team High Tech Crime) · NCSC-NL';
  if (/United Kingdom/.test(hq)) return 'NCA National Cyber Crime Unit · Action Fraud';
  if (/Germany/.test(hq)) return 'LKA Bayern ZAC (cybercrime contact point)';
  if (/Switzerland/.test(hq)) return 'fedpol · Basel-Stadt cantonal police';
  if (/Singapore/.test(hq)) return 'Singapore Police Force (CCID) · CSA SingCERT';
  return 'FBI field office (IC3) · CISA';
}

/* =====================================================================
   Classification helpers
   ===================================================================== */
export function typeFromPlaybook(pb: string, inc?: Incident): IrType {
  if (/Ransomware/i.test(pb)) return 'ransomware';
  if (/BEC|Fraud|Payments|payment/i.test(pb)) return 'bec';
  if (/Insider/i.test(pb)) return 'insider';
  if (/Vendor|supply|MFT/i.test(pb)) return 'supply';
  if (/^OT|Vessel|Medical device|Vehicle|IT\/OT|ride/i.test(pb) || inc?.ot) return 'ot';
  if (/Identity|Cloud: privileged|session|MFA|password|credential stuffing/i.test(pb)) return 'ato';
  if (/API abuse/i.test(pb)) return 'ddos';
  if (/^Web:/i.test(pb)) return 'breach';
  if (/leak|exfil|DLP|ITAR|Privacy|IP theft|storage|skimming|data/i.test(pb)) return 'breach';
  return 'ransomware';
}

const DATA_CLASS: CustomerMap<{ personal: string; sector: string }> = {
  maritime: { personal: 'Employee & crew personal data', sector: 'Terminal operational & customs data' },
  finserv: { personal: 'Customer personal & account data', sector: 'Payment instructions' },
  media: { personal: 'Subscriber & talent personal data', sector: 'Pre-release content' },
  healthcare: { personal: 'ePHI (patient records)', sector: 'Medical device configuration' },
  automotive: { personal: 'Employee & vehicle-owner data', sector: 'Production & engineering data' },
  insurance: { personal: 'Policyholder & claimant NPI', sector: 'Claims and payment data' },
  defence: { personal: 'Employee PII', sector: 'CUI / ITAR technical data' },
  pharma: { personal: 'Clinical trial participant data', sector: 'GMP batch records' },
  sghospital: { personal: 'Patient health information', sector: 'Medical images & lab results' },
  studio: { personal: 'Guest, subscriber & talent data', sector: 'Pre-release content' },
};
export function dataClassesFor(c: CustomerProfile, inc: Pick<Incident, 'personal' | 'card' | 'leak' | 'ot'>): string[] {
  const d = forCustomer(DATA_CLASS, c);
  const out: string[] = [];
  if (inc.personal) out.push(d.personal);
  if (inc.card) out.push('Cardholder data (PCI)');
  if (inc.leak) out.push(d.sector);
  if (inc.ot) out.push('OT process data (no personal data)');
  if (!out.length) out.push('Credentials & system configuration');
  return out;
}

/* =====================================================================
   Guided scenarios (one per customer, sector-specific)
   ===================================================================== */
type AlertCat = 'siem' | 'edr' | 'idp' | 'email' | 'ot' | 'net' | 'custody';
interface GuidedSpec {
  title: string;
  type: IrType;
  tenant: string;
  summary: string;
  reason: string;
  notes: string;
  rootCause: string;
  tech: string[];
  hosts: string[];
  alerts: [AlertCat, string][];
  data: string[];
  svc: number[];
  actor: number;
  personal?: boolean;
  leak?: boolean;
  ot?: boolean;
  records: number;
  impactK: number;
}
const GUIDED: Record<CustomerProfile['id'], GuidedSpec> = {
  maritime: {
    title: 'Ransomware precursor on the Navis N4 app tier: beacon, shadow-copy deletion and lateral movement',
    type: 'ransomware', tenant: 'rtm',
    summary: 'A Cobalt Strike beacon on RTM-TOS-APP02 deleted volume shadow copies and moved laterally over SMB to the TOS database and a domain controller using the svc_n4backup account. Encryption has not started. Gate and berth operations depend on Navis N4.',
    reason: 'Pre-encryption behaviour on a crown-jewel system (Navis N4) with spread to a domain controller. Isolation of the TOS tier needs IR authority and a terminal decision on manual gate procedures.',
    notes: 'L3: beacon config matches LockBit 3.0 affiliate infrastructure seen by HexaInt last month. svc_n4backup has domain admin rights it should not have. No OT impact yet; the IT/OT conduit is held by the Palo Alto policy.',
    rootCause: 'Initial access through an unpatched Citrix gateway session reused by a third-party support account; over-privileged backup service account enabled lateral movement.',
    tech: ['T1190', 'T1059.001', 'T1490', 'T1021.002', 'T1003.001'],
    hosts: ['RTM-TOS-APP02', 'RTM-TOS-DB01', 'HPS-DC02'],
    alerts: [['edr', 'vssadmin delete shadows /all on RTM-TOS-APP02'], ['edr', 'Cobalt Strike beacon injected into w3wp.exe'], ['siem', 'SMB lateral movement to RTM-TOS-DB01 using svc_n4backup'], ['ot', 'New session attempt from IT to the STS crane zone (blocked at the conduit)']],
    data: ['Terminal operational & customs data', 'Employee & crew personal data'], svc: [0, 1, 2], actor: 2, personal: true, records: 4200, impactK: 3800,
  },
  finserv: {
    title: 'Payment diversion: compromised payments@ mailbox redirected a £1.84M supplier payment',
    type: 'bec', tenant: 'pay',
    summary: 'An adversary-in-the-middle phishing page captured a session for a payments operations engineer. An inbox rule hid replies from the supplier and a forged remittance changed the beneficiary IBAN; one SWIFT MT103 for £1.84M was released before the bank detected the change.',
    reason: 'Confirmed financial loss on a payment rail with DORA and PSD2 major-incident potential. Needs IR to coordinate SWIFT recall, regulator clocks and the insurer.',
    notes: 'L3: token replay from a new ASN 9 minutes after the click. Inbox rule "remit" forwards to a free-mail address. Recall request drafted with Treasury; funds traced to a mule account in Lithuania.',
    rootCause: 'Session-token theft via an AiTM phishing kit; payment change verified by email instead of a call-back to the supplier master-data number.',
    tech: ['T1566.002', 'T1539', 'T1114.002', 'T1657'],
    hosts: ['ALD-SWIFT-AA01', 'ALD-CTX-SF04'],
    alerts: [['idp', 'Session token replay from a new ASN for a payments operations engineer'], ['email', 'Inbox rule forwarding "remittance" mails to an external address'], ['siem', 'SWIFT MT103 to a first-time beneficiary IBAN above the £1M threshold']],
    data: ['Payment instructions', 'Customer personal & account data'], svc: [0, 5], actor: 2, personal: true, records: 380, impactK: 1840,
  },
  media: {
    title: 'Pre-release leak: Project Nightjar finale screener posted to a torrent tracker',
    type: 'breach', tenant: 'post',
    summary: 'A 1080p copy of the unreleased Project Nightjar finale appeared on a public tracker. NexGuard extraction maps the forensic watermark to a freelance editor account at a localisation vendor whose Okta session was used from two countries within 40 minutes.',
    reason: 'Pre-release content outside custody with licensor and talent notification duties. Needs takedown coordination, vendor access suspension and legal.',
    notes: 'L3: watermark payload KPG-SCR-4471 decoded with high confidence. 14 further screener downloads from the same session in the last 6 hours. Vendor TPN status is gold shield.',
    rootCause: 'Freelance vendor account without phishing-resistant MFA; screener links not bound to device; vendor download volume not rate-limited.',
    tech: ['T1078', 'T1213', 'T1567.002'],
    hosts: ['KPG-MAM-PRD', 'POST-AVID-NEXIS01'],
    alerts: [['custody', 'NexGuard watermark decoded from tracker frames: recipient session KPG-SCR-4471'], ['siem', 'Bulk screener downloads from a residential proxy'], ['idp', 'Freelance account sign-in from two countries in 40 minutes']],
    data: ['Pre-release content', 'Subscriber & talent personal data'], svc: [0, 2], actor: 4, leak: true, records: 1, impactK: 6500,
  },
  healthcare: {
    title: 'Ransomware on the Epic Citrix tier with spread toward the Alaris infusion server',
    type: 'ransomware', tenant: 'mrmc',
    summary: 'Rhysida-style encryption started on user profile shares behind MRH-CITRIX-SF03 after a gateway sign-in without MFA. SMB connections from the Citrix tier reached the Alaris infusion server segment. Epic remains available; clinicians are moving to downtime procedures on two units.',
    reason: 'Active encryption on a clinical access tier and medical-device exposure. Patient-safety and HIPAA decisions need IR and the CMIO.',
    notes: 'L3: 2,140 files renamed with a .rhys extension. Citrix gateway policy excluded one legacy group from MFA. Claroty shows the Alaris server reachable from the Citrix VLAN.',
    rootCause: 'Legacy Citrix group excluded from MFA; flat route from the Citrix tier to the medical-device server VLAN.',
    tech: ['T1133', 'T1078', 'T1486', 'T1490'],
    hosts: ['MRH-CITRIX-SF03', 'MRH-ALARIS-SRV', 'MRH-DC01'],
    alerts: [['edr', 'Mass file rename (.rhys) on profile shares behind MRH-CITRIX-SF03'], ['ot', 'Unexpected SMB from the Citrix tier to the Alaris infusion server'], ['idp', 'Citrix gateway sign-in without MFA from a VPS']],
    data: ['ePHI (patient records)', 'Medical device configuration'], svc: [0, 1, 2], actor: 0, personal: true, records: 18400, impactK: 9200,
  },
  automotive: {
    title: 'Ransomware precursor in Plant Ingolstadt: Quick Assist intrusion staging on MES servers',
    type: 'ransomware', tenant: 'ingolstadt',
    summary: 'After an email flood, a caller posing as IT support convinced a robotics engineer to start Quick Assist. AnyDesk was installed, a new local admin created and RDP used from ING-PLC-ENG04 to ING-MES-PRD01, where Rubrik backup agents were stopped.',
    reason: 'Black Basta pre-encryption pattern on a plant MES with JIT/JIS production at risk. Needs IR authority to isolate the MES and engage plant management.',
    notes: 'L3: AnyDesk ID linked to Black Basta tooling. Robot cells are monitored read-only; no controller changes seen. Production continuity plan needs the plant director.',
    rootCause: 'Help-desk impersonation through external Teams calls and Quick Assist; local admin rights on engineering workstations.',
    tech: ['T1566.004', 'T1219', 'T1021.001', 'T1490', 'T1489'],
    hosts: ['ING-MES-PRD01', 'ING-PLC-ENG04', 'VMG-DC02'],
    alerts: [['edr', 'Quick Assist session followed by AnyDesk installation on ING-PLC-ENG04'], ['siem', 'RDP to ING-MES-PRD01 with a newly created admin account'], ['edr', 'Backup agent service stopped on ING-MES-PRD01'], ['ot', 'Engineering workstation enumerating robot cells (read-only alert)']],
    data: ['Production & engineering data', 'Employee & vehicle-owner data'], svc: [0, 5], actor: 1, personal: true, records: 2600, impactK: 14500,
  },
  insurance: {
    title: 'Claims payment diversion: adjuster mailbox takeover redirected $612k in settlements',
    type: 'bec', tenant: 'claims',
    summary: 'A thread-hijacking email from a lookalike law-firm domain led an adjuster to a credential page. The attacker then changed payee bank details on seven bodily-injury claims in ClaimCenter; three payments totalling $612k were released.',
    reason: 'Financial loss on claims payments and NPI exposure with NYDFS 500.17 and NAIC #668 clocks. Needs IR, SIU and outside counsel.',
    notes: 'L3: Abnormal flagged the thread after delivery. Entra ID shows token replay from a hosting ASN. ClaimCenter audit lists 7 payee changes in 2 hours from the adjuster account.',
    rootCause: 'Thread-hijack phishing with an AiTM kit; ClaimCenter allowed payee changes without out-of-band verification.',
    tech: ['T1566.002', 'T1539', 'T1114.002', 'T1657'],
    hosts: ['KMI-CC-INT02', 'KMI-BC-PAY01'],
    alerts: [['email', 'Vendor-impersonation thread hijack on a bodily-injury settlement'], ['idp', 'Risky sign-in with token replay for a claims adjuster'], ['siem', 'Payee bank changes on 7 claims in 2 hours']],
    data: ['Policyholder & claimant NPI', 'Claims and payment data'], svc: [0, 3], actor: 2, personal: true, records: 1260, impactK: 612,
  },
  defence: {
    title: 'CUI exfiltration: guidance-housing technical data package pulled from Teamcenter to a foreign VPS',
    type: 'breach', tenant: 'engineering',
    summary: 'A contractor account with a stolen VPN credential exported 3,412 files from the guidance-housing technical data package in Teamcenter and uploaded 4.6 GB over TLS to a VPS in a non-US ASN. The files are marked CUI//SP-EXPT.',
    reason: 'CUI and ITAR technical data left the enclave. DFARS 7012 72-hour DIBNet clock, DDTC disclosure and prime notification need IR and the Empowered Official.',
    notes: 'L3: sign-in from a non-compliant device; Zscaler logged the upload but the destination category was uncategorised. Export volume is 40x the account baseline.',
    rootCause: 'Contractor VPN credential reused from a breached personal service; Teamcenter bulk export not limited by role.',
    tech: ['T1078', 'T1213', 'T1567.002', 'T1048.003'],
    hosts: ['SPD-TC-PRD01', 'SPD-PDM-VLT01', 'SPD-FS-CUI01'],
    alerts: [['siem', 'Teamcenter bulk export by a contractor account (3,412 files)'], ['net', '4.6 GB TLS upload to an uncategorised VPS in a non-US ASN'], ['idp', 'Sign-in from a non-compliant device to the CUI enclave']],
    data: ['CUI / ITAR technical data', 'Employee PII'], svc: [0, 4], actor: 0, leak: true, records: 3412, impactK: 2400,
  },
  pharma: {
    title: 'Ransomware precursor at the Valais plant: PAS-X MES and PI historian staged for encryption',
    type: 'ransomware', tenant: 'valais',
    summary: 'An exposed vendor portal on the plant DMZ was exploited and PowerShell used to create a domain admin outside change control. Shadow copies were deleted on VLS-PASX-APP01 and the PI historian; DeltaV control is unaffected and monitored read-only.',
    reason: 'Pre-encryption behaviour on GMP systems with batch release and data-integrity impact. Needs IR, the QP and the plant head.',
    notes: 'L3: tooling matches Black Basta. No changes to DeltaV recipes. Two batches in progress; the QP must decide on quarantine.',
    rootCause: 'Unpatched vendor portal on the plant DMZ; domain admin creation not alerted until after the fact.',
    tech: ['T1190', 'T1059.001', 'T1136.003', 'T1490', 'T1021.002'],
    hosts: ['VLS-PASX-APP01', 'VLS-PI-HIST01', 'RHN-DC02'],
    alerts: [['edr', 'Shadow copy deletion on VLS-PASX-APP01'], ['siem', 'New domain admin created outside change control'], ['ot', 'Unexpected engineering logins observed (read-only monitoring)']],
    data: ['GMP batch records', 'Clinical trial participant data'], svc: [0, 5], actor: 4, personal: true, records: 900, impactK: 7800,
  },
  sghospital: {
    title: 'Ransomware on TrakCare application servers with PACS share encryption',
    type: 'ransomware', tenant: 'obh',
    summary: 'A vendor remote-access account signed in over VPN and used RDP to reach OBH-TRAK-APP03. LockBit-style encryption started on the PACS image share; TrakCare is slowing and the main hospital moved radiology to downtime procedures.',
    reason: 'Clinical systems under attack with MOH 2-hour notification under the Health Information Act. Needs IR, the CMIO and the DPO.',
    notes: 'L3: 640 DICOM files renamed. Vendor account last used 9 months ago. Armis shows the infusion server segment receiving SMB from IT; blocked at ISE.',
    rootCause: 'Dormant vendor remote-access account without MFA; flat route from the vendor jump zone to clinical servers.',
    tech: ['T1133', 'T1078', 'T1486', 'T1021.002'],
    hosts: ['OBH-TRAK-APP03', 'OBH-PACS-01', 'OBH-DC01'],
    alerts: [['edr', 'Ransomware file-rename burst on OBH-PACS-01'], ['siem', 'Vendor VPN sign-in followed by RDP to the TrakCare tier'], ['ot', 'Infusion server segment receiving SMB from IT']],
    data: ['Patient health information', 'Medical images & lab results'], svc: [0, 1, 3], actor: 0, personal: true, records: 12800, impactK: 4600,
  },
  studio: {
    title: 'Pre-release leak: Project Lodestar VFX plates and an edit cut leaked from a vendor',
    type: 'breach', tenant: 'post',
    summary: 'A 3-minute cut of Project Lodestar with unfinished VFX surfaced on a leak forum. NexGuard ties the watermark to a VFX vendor account that pulled plates over Aspera outside its work order after a sign-in from a new country.',
    reason: 'Pre-release content outside custody with licensor, talent and co-financier duties, and possible SEC materiality. Needs IR, legal and content security.',
    notes: 'L3: 212 GB pulled over Aspera in 3 hours versus a 15 GB baseline. Vendor account had no phishing-resistant MFA. Forum post has 40k views.',
    rootCause: 'Compromised vendor credential; Aspera transfers not bound to work-order scope.',
    tech: ['T1199', 'T1078', 'T1567.002'],
    hosts: ['POST-RENDER-MGR', 'SFE-MAM-PRD'],
    alerts: [['custody', 'NexGuard: leaked clip watermark traced to a vendor session'], ['siem', 'Aspera bulk pull of Lodestar plates outside the work order'], ['idp', 'Vendor account sign-in from a new country']],
    data: ['Pre-release content', 'Guest, subscriber & talent data'], svc: [0, 1, 2], actor: 1, leak: true, records: 1, impactK: 18000,
  },
};

/* =====================================================================
   Playbooks
   ===================================================================== */
export interface PlaybookItem { id: string; text: string; auto?: boolean }
const PB: Record<IrType, Record<Phase, string[]>> = {
  ransomware: {
    detect: ['Confirm encryption or pre-encryption behaviour on {edr}', 'Identify patient zero and the initial access vector', 'Scope affected hosts and accounts in {siem}', 'Check immutable backups are intact in {backup}'],
    contain: ['*Isolate affected hosts with {edr}', '*Disable compromised accounts and revoke sessions in {idp}', 'Block C2 indicators at {net}', 'Decide on segmentation of crown-jewel systems'],
    eradicate: ['Remove persistence (scheduled tasks, services, GPOs)', 'Reset Tier-0 credentials and KRBTGT twice', 'Patch the initial access vector', '*Sweep the estate for indicators with {edr}'],
    recover: ['Restore from clean immutable backups ({backup})', 'Validate restored systems before reconnection', 'Return business services in priority order', 'Heightened monitoring for 30 days'],
    post: ['Hold the blameless review within 10 days', 'Push detections for missed techniques to HexaSOC', 'Update the ransomware tabletop in the exercise library'],
  },
  bec: {
    detect: ['Confirm the mailbox compromise and inbox rules', 'Identify fraudulent payments and beneficiaries', 'Pull sign-in history from {idp}', 'Search {email} for the phishing lure across mailboxes'],
    contain: ['*Revoke sessions and reset credentials in {idp}', '*Remove malicious inbox rules', 'Request payment recall through the bank and SWIFT', 'Hold pending payments to changed beneficiaries'],
    eradicate: ['*Purge the lure from all mailboxes via {email}', 'Enforce phishing-resistant MFA for payment roles', 'Review OAuth app consents'],
    recover: ['Re-verify supplier bank details by call-back', 'Release held payments after verification', 'Brief finance on the new verification control'],
    post: ['Review payment-change controls with finance', 'Add detections for token replay and inbox rules', 'Add a BEC scenario to the exercise library'],
  },
  breach: {
    detect: ['Confirm what left, when and where it went', 'Identify the account or system used', 'Preserve logs from {siem} and {custody}', 'Classify the data affected'],
    contain: ['*Suspend the account and revoke sessions in {idp}', 'Block the destination at {net}', 'Revoke shared links and transfer tokens', 'Request takedown of public copies'],
    eradicate: ['Close the access path (MFA, device binding, scope)', 'Rotate exposed credentials and keys', 'Confirm no further copies via watermark and custody lineage'],
    recover: ['Restore vendor or user access with tightened scope', 'Monitor for re-posting and secondary use', 'Confirm notification population'],
    post: ['Review data-loss controls with the data owner', 'Push detections for bulk export and unusual transfer', 'Update the data-breach tabletop'],
  },
  insider: {
    detect: ['Confirm activity against the user’s baseline', 'Engage HR and legal before any interview', 'Preserve endpoint and cloud evidence quietly'],
    contain: ['*Restrict the account without tipping off the user', 'Block removable media and personal cloud uploads', 'Recover company devices'],
    eradicate: ['Revoke all access and credentials', 'Identify data copied and request return or deletion'],
    recover: ['Re-assign the user’s responsibilities', 'Confirm data recovered or destroyed (attestation)'],
    post: ['Review joiner-mover-leaver controls', 'Tune insider-risk analytics'],
  },
  ato: {
    detect: ['Confirm the takeover in {idp} sign-in logs', 'List resources accessed with the stolen session', 'Check for persistence (MFA methods, app consents, keys)'],
    contain: ['*Revoke sessions and refresh tokens in {idp}', '*Reset credentials and remove attacker MFA methods', 'Block attacker infrastructure at {net}'],
    eradicate: ['Remove rogue OAuth apps, keys and roles', 'Enforce token protection and compliant-device access'],
    recover: ['Restore least-privilege access', 'Monitor the account for 14 days'],
    post: ['Review conditional access gaps', 'Add detections for token replay'],
  },
  ot: {
    detect: ['Confirm the event with {ot} (read-only)', 'Site OT lead confirms the process is in a safe state', 'Identify the engineering workstation or vendor session involved'],
    contain: ['Site engineers isolate the conduit (no HexaView write-back to OT)', 'Suspend vendor remote access at the jump host', 'Move to manual or degraded operations if required'],
    eradicate: ['Verify controller logic against the golden image', 'Rebuild affected engineering workstations', 'Rotate OT credentials'],
    recover: ['Return to normal operations under the site safety procedure', 'Monitor the zone with {ot} for 30 days'],
    post: ['Review IEC 62443 zone and conduit design', 'Add the scenario to the OT tabletop library'],
  },
  ddos: {
    detect: ['Confirm attack traffic and targeted services', 'Engage the scrubbing provider', 'Check for a smoke-screen intrusion'],
    contain: ['Enable always-on mitigation and rate limits', 'Geo or ASN blocking at {net}', 'Scale or fail over affected services'],
    eradicate: ['Tune WAF and bot rules', 'Close exposed origin addresses'],
    recover: ['Return traffic to normal routing', 'Customer comms on service restoration'],
    post: ['Review capacity and mitigation runbooks'],
  },
  supply: {
    detect: ['Confirm the compromised supplier or component', 'Identify every connection and credential the supplier holds', 'Check {siem} for activity from supplier infrastructure'],
    contain: ['*Suspend supplier access and tokens', 'Block supplier infrastructure at {net}', 'Quarantine affected software versions'],
    eradicate: ['Rotate shared credentials and keys', 'Verify integrity of delivered software or data', 'Obtain the supplier’s incident report'],
    recover: ['Restore supplier access with tighter scope', 'Re-assess the supplier in HexaComply TPRM'],
    post: ['Update the supplier contract security schedule', 'Add a supply-chain scenario to the exercise library'],
  },
};
export function playbookFor(type: IrType, t: IrTools): Record<Phase, PlaybookItem[]> {
  const out = {} as Record<Phase, PlaybookItem[]>;
  for (const ph of PHASES) {
    out[ph] = PB[type][ph].map((raw, i) => {
      const auto = raw.startsWith('*');
      const text = raw.replace(/^\*/, '').replace('{edr}', t.edr).replace('{idp}', t.idp).replace('{siem}', t.siem).replace('{net}', t.net).replace('{backup}', t.backup).replace('{email}', t.email).replace('{ot}', t.ot).replace('{custody}', t.custody);
      return { id: `${type}-${ph}-${i}`, text, auto };
    });
  }
  return out;
}

/* =====================================================================
   Builders
   ===================================================================== */
const MIN = 60_000;
type Mk = { r: Rng; c: CustomerProfile; tools: IrTools; ppl: IrPeople };

function toolFor(cat: AlertCat, t: IrTools): string {
  return cat === 'siem' ? t.siem : cat === 'edr' ? t.edr : cat === 'idp' ? t.idp : cat === 'email' ? t.email : cat === 'ot' ? t.ot : cat === 'net' ? t.net : t.custody;
}

/** Turn a SOC incident into a case seed (escalation or declared incident). */
function seedFromSoc(m: Mk, inc: Incident, now: number, ticketId?: string): CaseSeed {
  const { r, c, tools } = m;
  const type = typeFromPlaybook(inc.playbook, inc);
  const sev = SOC_TO_SEV[inc.sev];
  const detectedAt = now - inc.openedMin * MIN;
  const escalatedAt = Math.min(now - r.int(4, 70) * MIN, detectedAt + Math.max(10, Math.round(inc.openedMin * 0.5)) * MIN);
  const alerts: Alert[] = inc.sources.slice(0, 3).map((s, i) => ({ tool: s, title: i === 0 ? inc.title : r.pick([`Correlated detection on ${inc.hosts[0]}`, `${inc.alerts} related alerts grouped`, `Indicator ${inc.iocs[0]} seen on ${inc.hosts[inc.hosts.length - 1]}`]), t: detectedAt + i * r.int(2, 9) * MIN }));
  const dataClasses = dataClassesFor(c, inc);
  const svc = r.pickN(c.vocab.businessServices, inc.sev === 'critical' ? 2 : 1);
  const records = inc.personal ? r.int(400, 22000) : inc.leak ? r.int(1, 3000) : 0;
  const fx = c.currency === 'GBP' ? 0.8 : c.currency === 'EUR' || c.currency === 'CHF' ? 0.92 : c.currency === 'SGD' ? 1.34 : 1;
  const impact = Math.round((sev === 1 ? r.int(900, 6000) : sev === 2 ? r.int(120, 1200) : r.int(15, 140)) * 1000 * fx);
  const l2 = r.pick(HEXASOC_ANALYSTS.filter((a) => a.includes('L2')));
  const l3 = r.pick(HEXASOC_ANALYSTS.filter((a) => a.includes('L3')));
  const span = Math.max(6, (escalatedAt - detectedAt) / MIN);
  return {
    title: inc.title, type, sev, tenantId: inc.tenantId, assets: inc.hosts, users: inc.users, techniques: inc.techniques, alerts,
    dataClasses, services: svc, personal: inc.personal, ot: inc.ot, leak: inc.leak, card: inc.card, actor: inc.actor,
    socId: inc.id, ticketId,
    summary: `${inc.title}. ${inc.alerts} correlated alerts from ${inc.sources.join(', ')}; playbook "${inc.playbook}". Affected: ${inc.hosts.join(', ')}${inc.users.length ? `; user ${inc.users[0]}` : ''}.`,
    rootCause: r.pick(['Valid account without phishing-resistant MFA used from attacker infrastructure', 'Third-party remote access outside its approved window', 'Unpatched internet-facing service exploited', 'User executed a malicious attachment; second stage blocked late']),
    records, impact, detectedAt, escalatedAt,
    path: [
      { level: 'L1', who: 'HexaSOC Triage agent', t: detectedAt + 2 * MIN, note: `Grouped ${inc.alerts} alerts and scored ${inc.sev}` },
      { level: 'L2', who: l2, t: detectedAt + Math.round(span * 0.3) * MIN, note: 'Validated true positive; enrichment from HexaInt and CMDB' },
      { level: 'L3', who: l3, t: detectedAt + Math.round(span * 0.7) * MIN, note: `Scope exceeds SOC containment authority; ${tools.hasEdr ? `${tools.edr} containment pending approval` : 'no EDR coverage on the asset'}` },
    ],
  };
}

function seedFromGuided(m: Mk, g: GuidedSpec, now: number): CaseSeed {
  const { c, tools } = m;
  const tenantId = c.tenants.some((t) => t.id === g.tenant) ? g.tenant : c.tenants[0].id;
  const detectedAt = now - 46 * MIN;
  const escalatedAt = now - 3 * MIN;
  return {
    title: g.title, type: g.type, sev: 1, tenantId, assets: g.hosts, users: [c.people.staff[3]?.name ?? c.people.staff[0].name], techniques: g.tech,
    alerts: g.alerts.map(([cat, title], i) => ({ tool: toolFor(cat, tools), title, t: detectedAt + i * 6 * MIN })),
    dataClasses: g.data, services: g.svc.map((i) => c.vocab.businessServices[i]).filter(Boolean), personal: !!g.personal, ot: !!g.ot, leak: !!g.leak, card: false,
    actor: c.vocab.threatActors[g.actor], summary: g.summary, rootCause: g.rootCause, records: g.records, impact: g.impactK * 1000, detectedAt, escalatedAt,
    path: [
      { level: 'L1', who: 'HexaSOC Triage agent', t: detectedAt + 2 * MIN, note: `Grouped ${g.alerts.length} detections; scored critical` },
      { level: 'L2', who: 'Callum Reid (L2)', t: detectedAt + 14 * MIN, note: 'Validated true positive; enrichment added' },
      { level: 'L3', who: 'Nadia Petrov (L3)', t: detectedAt + 31 * MIN, note: g.notes },
    ],
  };
}

function makeEscalation(s: CaseSeed, id: string, reason: string, notes: string, guided = false): Escalation {
  const l3 = s.path.find((p) => p.level === 'L3')?.who ?? 'HexaSOC L3';
  return { ...s, id, status: 'awaiting', reason, notes, escalatedBy: l3, slaMin: ACCEPT_SLA[s.sev], guided };
}

/* ---------- Incident assembly ---------- */
export interface DeclareForm { title: string; type: IrType; sev: Sev; commander: string; scope: string }

function rolesFor(m: Mk, sev: Sev, type: IrType, commander: string): Role[] {
  const { c, ppl } = m;
  const org = c.short;
  return [
    { role: 'Incident Commander', name: commander, org: commander.includes('HexaShield') ? 'HexaShield' : org },
    { role: 'Deputy', name: `${IR_TEAM.lead}`, org: 'HexaShield IR' },
    { role: 'Scribe', name: `${IR_TEAM.l2} + HexaSOC Scribe agent`, org: 'HexaShield' },
    { role: 'Tech lead', name: type === 'ot' && ppl.ot ? ppl.ot.name : ppl.cloud.name, org },
    { role: 'Comms lead', name: ppl.comms.name, org },
    { role: 'Legal', name: ppl.legal.name, org },
    { role: 'Exec sponsor', name: sev === 1 ? ppl.ceo.name : ppl.cfo.name, org },
  ];
}

function stakeholdersFor(m: Mk, s: { sev: Sev; type: IrType; tenantIds: string[]; personal: boolean; ot: boolean; commander: string }, notices: Notice[]): Stakeholder[] {
  const { c, ppl, r } = m;
  const out: Stakeholder[] = [];
  let n = 1;
  const add = (x: Omit<Stakeholder, 'id' | 'contact' | 'privileged' | 'nda'> & { contact?: string; privileged?: boolean; nda?: boolean }) =>
    !out.some((o) => o.name === x.name) && out.push({ id: `SH-${n++}`, contact: x.contact ?? x.channel, privileged: x.privileged ?? false, nda: x.nda ?? x.group === 'external', ...x });
  const mail = (p: Person) => p.email;
  add({ name: s.commander, title: s.commander === ppl.ciso.name ? ppl.ciso.role : 'Incident commander', org: c.short, group: 'internal', kind: 'Security leadership', incidentRole: 'Incident commander', raci: 'A', channel: 'Bridge', contact: mail(ppl.ciso), privileged: true });
  if (s.commander !== ppl.ciso.name) add({ name: ppl.ciso.name, title: ppl.ciso.role, org: c.short, group: 'internal', kind: 'Security leadership', incidentRole: 'Accountable executive for security', raci: 'A', channel: 'Bridge', contact: mail(ppl.ciso), privileged: true });
  add({ name: ppl.soc.name, title: ppl.soc.role, org: c.short, group: 'internal', kind: 'Security operations', incidentRole: 'SOC liaison & containment approvals', raci: 'R', channel: 'Bridge', contact: mail(ppl.soc) });
  add({ name: s.ot && ppl.ot ? ppl.ot.name : ppl.cloud.name, title: s.ot && ppl.ot ? ppl.ot.role : ppl.cloud.role, org: c.short, group: 'internal', kind: 'IT / OT', incidentRole: 'Technical lead', raci: 'R', channel: 'Bridge', contact: mail(s.ot && ppl.ot ? ppl.ot : ppl.cloud) });
  add({ name: ppl.legal.name, title: ppl.legal.role, org: c.short, group: 'internal', kind: 'Legal', incidentRole: 'Legal lead; directs privilege', raci: 'A', channel: 'Signal (privileged)', contact: mail(ppl.legal), privileged: true });
  if (s.personal) add({ name: ppl.privacy.name, title: ppl.privacy.role, org: c.short, group: 'internal', kind: 'Privacy / DPO', incidentRole: 'Breach assessment & regulator notices', raci: 'R', channel: 'Teams channel', contact: mail(ppl.privacy), privileged: true });
  add({ name: ppl.grc.name, title: ppl.grc.role, org: c.short, group: 'internal', kind: 'GRC', incidentRole: 'Regulatory clocks & evidence', raci: 'R', channel: 'Teams channel', contact: mail(ppl.grc) });
  add({ name: ppl.comms.name, title: ppl.comms.role, org: c.short, group: 'internal', kind: 'Comms / PR', incidentRole: 'Internal & external statements', raci: 'R', channel: 'Teams channel', contact: mail(ppl.comms) });
  add({ name: ppl.hr.name, title: ppl.hr.role, org: c.short, group: 'internal', kind: 'HR', incidentRole: s.type === 'insider' ? 'Employee relations & interview' : 'Staff communications support', raci: s.type === 'insider' ? 'R' : 'I', channel: 'Email', contact: mail(ppl.hr) });
  add({ name: ppl.cfo.name, title: ppl.cfo.role, org: c.short, group: 'internal', kind: 'Finance', incidentRole: 'Insurance claim & financial exposure', raci: s.type === 'bec' ? 'R' : 'C', channel: 'Email', contact: mail(ppl.cfo) });
  add({ name: ppl.ceo.name, title: ppl.ceo.role, org: c.short, group: 'internal', kind: 'CEO / board', incidentRole: s.sev === 1 ? 'Executive sponsor; board liaison' : 'Kept informed', raci: s.sev === 1 ? 'C' : 'I', channel: 'Phone', contact: mail(ppl.ceo) });
  const owners = s.tenantIds.map((tid) => c.tenants.find((t) => t.id === tid)).filter(Boolean);
  owners.forEach((t) => {
    const p = c.people.staff.find((x) => t && (x.role.includes(t.short) || x.role.includes(t.city))) ?? r.pick(c.people.staff.filter((x) => x.vip).length ? c.people.staff.filter((x) => x.vip) : c.people.staff);
    if (!out.some((o) => o.name === p.name)) add({ name: p.name, title: p.role, org: c.short, group: 'internal', kind: 'Business owner', incidentRole: `Business owner · ${t?.short}`, raci: 'C', channel: 'Teams channel', contact: p.email });
  });
  if (s.ot && ppl.ot && !out.some((o) => o.name === ppl.ot?.name)) add({ name: ppl.ot.name, title: ppl.ot.role, org: c.short, group: 'internal', kind: 'OT lead', incidentRole: 'Safe-state decisions (OT read-only)', raci: 'R', channel: 'Bridge', contact: ppl.ot.email });
  // External
  add({ name: IR_TEAM.lead, title: 'IR lead', org: 'HexaShield IR', group: 'external', kind: 'HexaShield IR', incidentRole: 'Deputy commander & IR retainer', raci: 'R', channel: 'Bridge', contact: 'ir@hexashield.io', nda: true });
  add({ name: IR_TEAM.dfir, title: 'DFIR lead', org: 'HexaShield DFIR', group: 'external', kind: 'Forensics', incidentRole: 'Forensic collection & analysis', raci: 'R', channel: 'Bridge', contact: 'dfir@hexashield.io', privileged: true, nda: true });
  add({ name: 'Panel breach coach', title: `Outside counsel (via ${c.insurance.broker})`, org: 'Breach counsel', group: 'external', kind: 'Outside counsel', incidentRole: 'Breach coach; privilege over forensics', raci: 'C', channel: 'Signal (privileged)', contact: 'Panel hotline', privileged: true, nda: true });
  add({ name: c.insurance.carrier.split('/')[0].trim(), title: `Cyber insurer · limit ${c.currency === 'GBP' ? '£' : c.currency === 'EUR' ? '€' : c.currency === 'CHF' ? 'CHF ' : c.currency === 'SGD' ? 'S$' : '$'}${c.insurance.limitM}M`, org: 'Insurer', group: 'external', kind: 'Insurer', incidentRole: 'Notice of circumstance; panel vendors', raci: 'I', channel: 'Email (claims portal)', contact: `Claims notification via ${c.insurance.broker}` });
  add({ name: c.insurance.broker, title: 'Insurance broker', org: 'Broker', group: 'external', kind: 'Broker', incidentRole: 'Claim coordination', raci: 'I', channel: 'Phone', contact: c.insurance.broker });
  if (s.sev <= 2) add({ name: 'Crisis PR agency (retained)', title: 'Media relations', org: 'PR agency', group: 'external', kind: 'PR agency', incidentRole: 'Holding statements & media monitoring', raci: 'C', channel: 'Email', contact: 'Retainer hotline', nda: true });
  const regs = Array.from(new Set(notices.filter((x) => x.kind === 'regulator').map((x) => x.recipient))).slice(0, 3);
  regs.forEach((rg) => add({ name: rg, title: 'Regulator', org: 'Regulator', group: 'external', kind: 'Regulator', incidentRole: 'Receives statutory notification', raci: 'I', channel: 'Regulator portal', contact: rg, nda: false }));
  if (s.sev === 1 || s.type === 'bec') add({ name: lawEnforcement(c), title: 'Law enforcement', org: 'Law enforcement', group: 'external', kind: 'Law enforcement', incidentRole: 'Crime report; IoC sharing', raci: 'I', channel: 'Phone + portal', contact: lawEnforcement(c), nda: false });
  const sup = c.thirdParties.filter((t) => t.tier === 1).slice(0, s.type === 'supply' ? 2 : 1);
  sup.forEach((v) => add({ name: v.name, title: v.category, org: 'Key supplier', group: 'external', kind: 'Key supplier / customer', incidentRole: `Access: ${v.access}`, raci: 'I', channel: 'Email', contact: v.name }));
  return out;
}

function noticesFor(m: Mk, s: { id: string; sev: Sev; type: IrType; tenantIds: string[]; personal: boolean; leak: boolean; card: boolean; ot: boolean; techniques: string[]; title: string; assets: string[]; users: string[]; socId?: string }, startAt: number): Notice[] {
  const { c, ppl } = m;
  const out: Notice[] = [];
  let n = 1;
  const push = (x: Omit<Notice, 'id' | 'status'>) => out.push({ ...x, id: `${s.id}-N${n++}`, status: 'draft' });
  const tenantId = s.tenantIds[0];
  if (s.sev <= 2) {
    const fake = {
      id: s.socId ?? s.id, title: s.title, sev: s.sev === 1 ? 'critical' : 'high', status: 'investigating', tenantId, assignee: '', techniques: s.techniques, sources: [], openedMin: 0, durationMin: 0,
      hosts: s.assets, users: s.users, iocs: [], ot: s.ot, personal: s.personal, card: s.card, leak: s.leak, playbook: '', ttaMin: 0, alerts: 0,
    } as Incident;
    regClocks(c, fake).forEach((k) => {
      if (/Preserve images/.test(k.name)) return;
      push({ kind: /Prime|Licensor|partner|Reinsurer|Talent|CRO/i.test(k.name) ? 'contract' : 'regulator', name: k.name, recipient: k.regulator, basis: k.basis, startAt, dueAt: startAt + k.deadlineMin * MIN, owner: /DPA|GDPR|PDPC|HIPAA|revDSG|APPI|breach/i.test(k.name) ? ppl.privacy.name : ppl.grc.name, channel: 'Regulator portal' });
    });
  }
  push({ kind: 'insurer', name: 'Notice of circumstance to cyber insurer', recipient: `${c.insurance.carrier} via ${c.insurance.broker}`, basis: 'Policy condition: notify as soon as practicable, panel vendors only', startAt, dueAt: startAt + (s.sev === 1 ? 48 : 72) * 60 * MIN, owner: ppl.cfo.name, channel: 'Broker claims portal' });
  if (s.sev === 1) push({ kind: 'internal', name: 'Board notification', recipient: `${ppl.ceo.name} and the board risk committee`, basis: 'Board-approved incident escalation policy · SEV1 within 24 h', startAt, dueAt: startAt + 24 * 60 * MIN, owner: ppl.ciso.name, channel: 'Board portal' });
  if (s.sev <= 2 || s.type === 'bec') push({ kind: 'law', name: 'Crime report to law enforcement', recipient: lawEnforcement(c), basis: 'Voluntary; required by the insurer for extortion or fraud', startAt, dueAt: null, owner: ppl.soc.name, channel: 'Phone + portal' });
  if (s.type === 'supply' || s.type === 'breach' || s.type === 'ransomware') {
    const v = c.thirdParties.find((t) => t.tier === 1);
    if (v) push({ kind: 'contract', name: `Contractual notice to ${v.name}`, recipient: v.name, basis: 'Security schedule: notify within 72 h of an incident affecting shared systems', startAt, dueAt: startAt + 72 * 60 * MIN, owner: ppl.grc.name, channel: 'Email' });
  }
  push({ kind: 'internal', name: 'All-staff awareness message', recipient: `${c.short} staff in affected tenants`, basis: 'Internal comms plan', startAt, dueAt: null, owner: ppl.comms.name, channel: 'Comms Hub · Teams & email' });
  if (s.personal || s.type === 'bec' || s.leak) push({ kind: 'customer', name: s.leak ? 'Partner and licensor statement' : 'Customer / individual notification', recipient: s.leak ? 'Licensors, partners and talent representatives' : 'Affected individuals', basis: s.personal ? 'Breach notification law once the population is confirmed' : 'Contractual and reputational', startAt, dueAt: s.personal ? startAt + 30 * 1440 * MIN : null, owner: ppl.privacy.name, channel: 'Letter + email' });
  return out;
}

function tasksFor(m: Mk, s: { id: string; type: IrType; ot: boolean; personal: boolean; assets: string[] }, base: number): Task[] {
  const { tools, ppl, c } = m;
  const a = s.assets[0] ?? 'affected host';
  const list: [Stream, string, string, number][] = [
    ['Containment', s.ot ? `Site engineers isolate the conduit to ${a} (OT read-only)` : s.type === 'bec' || s.type === 'ato' ? `Revoke sessions and reset credentials in ${tools.idp}` : `Isolate ${a} with ${tools.edr}`, s.ot && ppl.ot ? ppl.ot.name : ppl.soc.name, 60],
    ['Containment', `Block indicators at ${tools.net} and in ${tools.siem}`, ppl.soc.name, 90],
    ['Forensics', `Collect triage package and memory from ${a}`, `${IR_TEAM.dfir} (HexaShield DFIR)`, 180],
    ['Forensics', 'Establish the initial access vector and attack path', `${IR_TEAM.l3} (HexaSOC L3)`, 480],
    ['Recovery', s.type === 'bec' ? 'Recall payment and re-verify beneficiaries' : `Validate clean restore points in ${tools.backup}`, ppl.cloud.name, 720],
    ['Comms', 'Holding statement and staff message ready for approval', ppl.comms.name, 240],
    ['Legal & regulatory', s.personal ? 'Breach risk assessment and notification population' : 'Assess notification thresholds', ppl.privacy.name, 1440],
    ['Legal & regulatory', 'Place legal hold on evidence and engage breach coach', ppl.legal.name, 360],
    ['Business continuity', `Activate continuity plan for ${c.vocab.businessServices[0]}`, ppl.risk.name, 120],
  ];
  return list.map(([stream, title, owner, due], i) => ({ id: `${s.id}-T${i + 1}`, title, stream, owner, dueAt: base + due * MIN, status: 'todo' as TaskStatus }));
}

function evidenceFor(m: Mk, s: { id: string; type: IrType; assets: string[]; ot: boolean }, at: (min: number) => number, upTo: number): EvidenceItem[] {
  const { r, tools, c } = m;
  const vault = `HexaCustody evidence vault · ${c.residency.split('(')[0].split('·')[0].trim()}`;
  const a = s.assets[0] ?? 'host';
  const items: [EvidenceType, string, string, number, number][] = [
    ['EDR triage package', `${a} triage package`, tools.edr, r.int(80, 900) * 1e6, 20],
    ['Logs export', `${tools.siem} export · incident window ±24 h`, tools.siem, r.int(1, 40) * 1e9, 35],
    ['Cloud audit logs', `${tools.idp} sign-in and audit logs`, tools.idp, r.int(20, 400) * 1e6, 50],
    [s.type === 'bec' || s.type === 'ato' ? 'Email sample' : 'Memory image', s.type === 'bec' || s.type === 'ato' ? 'Phishing lure and headers (.eml)' : `${a} memory image`, s.type === 'bec' || s.type === 'ato' ? tools.email : `${tools.edr} live response`, s.type === 'bec' ? r.int(80, 900) * 1e3 : r.int(16, 64) * 1e9, 80],
    ['Disk image', `${s.assets[1] ?? a} disk image (E01)`, 'HexaShield DFIR imager', r.int(200, 900) * 1e9, 240],
    ['Screenshots', 'Bridge decisions and console screenshots', 'HexaView war room', r.int(2, 30) * 1e6, 300],
    ['Network capture', `${tools.net} packet capture of the C2 window`, tools.net, r.int(1, 12) * 1e9, 420],
  ];
  return items
    .filter(([, , , , min]) => min <= upTo)
    .map(([type, name, tool, bytes, min], i) => {
      const t = at(min);
      const collector = i === 0 || type === 'Logs export' || type === 'Cloud audit logs' ? 'HexaSOC collection agent' : `${IR_TEAM.dfir} (HexaShield DFIR)`;
      const custody: CustodyHop[] = [
        { t, from: tool, to: collector, action: 'Collected; SHA-256 computed at source' },
        { t: t + r.int(2, 15) * MIN, from: collector, to: vault, action: 'Sealed into the evidence vault' },
      ];
      if (r.chance(0.5)) custody.push({ t: t + r.int(30, 240) * MIN, from: vault, to: `${IR_TEAM.dfir} (analysis copy)`, action: 'Working copy checked out; original stays sealed' });
      return { id: `${s.id}-E${i + 1}`, type, name, tool, collectedBy: collector, t, sha256: r.hex(64), bytes: Math.round(bytes), location: vault, legalHold: i < 3, custody };
    });
}

/** Append a hash-chained entry. */
export function chainAppend(list: TimelineEntry[], e: Omit<TimelineEntry, 'seq' | 'prev' | 'hash' | 'id' | 'key' | 'auto'> & { key?: boolean; auto?: boolean }, idPrefix: string): TimelineEntry[] {
  const last = list.reduce<TimelineEntry | null>((m, x) => (!m || x.seq > m.seq ? x : m), null);
  const seq = (last?.seq ?? 0) + 1;
  const prev = last?.hash ?? GENESIS;
  const base = { ...e, seq, key: e.key ?? false, auto: e.auto ?? TL_TYPE[e.type].auto };
  const hash = entryHash(prev, base);
  return [...list, { ...base, id: `${idPrefix}-A${String(seq).padStart(4, '0')}`, prev, hash }];
}

interface BuildOpts { id: string; declaredAt: number; stage: number; closed: boolean; commander: string; now: number; escalationId?: string; guided?: boolean }

/** Build a full incident record from a case seed, advanced to `stage` (index into PHASES). */
export function buildIncident(m: Mk, s: CaseSeed, o: BuildOpts): IrIncident {
  const { r, c, tools, ppl } = m;
  const tenantIds = [s.tenantId];
  const declaredAt = o.declaredAt;
  const end = o.closed ? declaredAt + r.int(3, 12) * 1440 * MIN : o.now;
  const span = Math.max(30, (end - declaredAt) / MIN);
  // Phase start times as fractions of the elapsed span.
  const fr = o.closed ? [0, 0.01, 0.06, 0.35, 0.9] : [0, 0.18, 0.55, 0.8, 0.95];
  const phaseAt: Partial<Record<Phase, number>> = {};
  PHASES.forEach((p, i) => { if (i <= o.stage) phaseAt[p] = declaredAt + Math.round(span * fr[i]) * MIN; });
  const at = (min: number) => declaredAt + min * MIN;
  const reached = (p: Phase) => phaseAt[p] !== undefined;
  const ph = (t: number): Phase => PHASES.slice().reverse().find((p) => (phaseAt[p] ?? Infinity) <= t) ?? 'detect';
  const tenant = c.tenants.find((t) => t.id === s.tenantId);
  const bridge = `Teams bridge “${o.id}” + ${c.id === 'defence' ? 'secure phone bridge (US persons)' : 'Signal fallback'}`;
  const notices = noticesFor(m, { id: o.id, sev: s.sev, type: s.type, tenantIds, personal: s.personal, leak: s.leak, card: s.card, ot: s.ot, techniques: s.techniques, title: s.title, assets: s.assets, users: s.users, socId: s.socId }, declaredAt);
  const stakeholders = stakeholdersFor(m, { sev: s.sev, type: s.type, tenantIds, personal: s.personal, ot: s.ot, commander: o.commander }, notices);
  const tasks = tasksFor(m, { id: o.id, type: s.type, ot: s.ot, personal: s.personal, assets: s.assets }, declaredAt);
  const evidence = evidenceFor(m, { id: o.id, type: s.type, assets: s.assets, ot: s.ot }, at, o.closed ? 9999 : Math.min(9999, (o.now - declaredAt) / MIN));
  const now = o.now;

  // Raw timeline entries before chaining.
  type Raw = Omit<TimelineEntry, 'seq' | 'prev' | 'hash' | 'id'>;
  const raw: Raw[] = [];
  const add = (t: number, type: TlType, actor: string, source: string, text: string, extra: Partial<Raw> = {}) => {
    if (t > now) return;
    raw.push({ t, type, actor, source, text, phase: ph(t), key: false, auto: TL_TYPE[type].auto, ...extra });
  };
  const socTo = s.socId ? `/soc/ir?id=${s.socId}&status=all` : '/soc/ir';
  s.alerts.forEach((a, i) => add(a.t, 'alert', a.tool, a.tool, a.title, { to: socTo, key: i === 0 }));
  add(s.detectedAt + 2 * MIN, 'automation', 'HexaSOC Triage agent', 'HexaSOC', `Opened ${s.socId ?? 'SOC case'}; grouped detections and matched the ${IR_TYPES[s.type].label} playbook`, { to: socTo });
  s.path.filter((p) => p.level !== 'L1').forEach((p) => add(p.t, 'note', p.who, 'HexaSOC', `${p.level}: ${p.note}`, { to: socTo }));
  add(s.escalatedAt, 'escalation', s.path[s.path.length - 1]?.who ?? 'HexaSOC L3', 'HexaSOC', `Escalated to L4 Incident Response (${SEV_LABEL[s.sev]} recommended)`, { to: '/incident-response/escalations', key: true });
  add(declaredAt - 2 * MIN, 'decision', IR_TEAM.lead, 'HexaView IR', `L4 accepted the escalation and recommended declaring an incident`);
  add(declaredAt, 'phase', o.commander, 'HexaView IR', `Incident ${o.id} declared · ${SEV_LABEL[s.sev]} · ${IR_TYPES[s.type].label} · commander ${o.commander}`, { key: true, to: '/incident-response/warroom' });
  add(declaredAt + 1 * MIN, 'automation', 'HexaView IR', 'HexaView IR', `War room opened; bridge ${bridge}; channels created in Comms Hub`, { to: '/comms/bridges' });
  add(declaredAt + 2 * MIN, 'automation', 'HexaSOC regulatory clock engine', 'HexaSOC', `${notices.filter((x) => x.dueAt).length} notification clocks started from the declaration time (${tenant?.regimes.join(', ') ?? 'tenant regimes'})`, { to: '/incident-response/notifications' });
  stakeholders.slice(0, 8).forEach((p, i) => {
    const tn = i < 3 ? Math.min(now, declaredAt + i * MIN) : declaredAt + (3 + i * r.int(2, 9)) * MIN;
    if (tn <= now) {
      p.notifiedAt = tn;
      if (i < 6 || o.closed || o.stage >= 2) p.ackAt = tn + r.int(2, 25) * MIN;
      add(tn, 'stakeholder', 'HexaView IR', 'Comms Hub', `${p.name} (${p.incidentRole}) notified via ${p.channel}${p.ackAt && p.ackAt <= now ? ' and joined' : ''}`, { to: '/comms/inbox' });
    }
  });
  if (o.closed || o.stage >= 2) stakeholders.forEach((p) => { if (!p.notifiedAt) { p.notifiedAt = phaseAt.contain ?? declaredAt; p.ackAt = (p.notifiedAt ?? declaredAt) + 40 * MIN; } });
  evidence.forEach((e) => add(e.t, 'evidence', e.collectedBy, e.tool, `${e.type} collected: ${e.name} · SHA-256 ${e.sha256.slice(0, 12)}…`, { evidence: [e.id], to: '/incident-response/evidence' }));

  const decisions: Decision[] = [];
  const decide = (t: number, decision: string, rationale: string, by: string, key = false) => {
    if (t > now) return;
    decisions.push({ id: `${o.id}-D${decisions.length + 1}`, t, decision, rationale, by });
    add(t, 'decision', by, 'War room', decision, { key, to: '/incident-response/warroom' });
  };
  decide(declaredAt + 6 * MIN, `Declare ${SEV_LABEL[s.sev]} and run the ${IR_TYPES[s.type].label} playbook`, SEV_DESC[s.sev], o.commander);
  decide(declaredAt + 14 * MIN, 'Engage the breach coach and run forensics under legal privilege', 'Protect privilege; insurer panel requirement', ppl.legal.name);

  let isolated = 0;
  let disabled = 0;
  if (reached('contain')) {
    const t0 = phaseAt.contain as number;
    add(t0, 'phase', o.commander, 'HexaView IR', `Phase advanced to ${PHASE_LABEL.contain}`, { key: true });
    if (s.ot) {
      add(t0 + 8 * MIN, 'note', ppl.ot?.name ?? 'Site OT lead', tools.ot, 'Site engineers isolated the conduit at the jump host; process confirmed in a safe state. No HexaView write-back to OT.', { key: true });
      decide(t0 + 4 * MIN, 'Hold OT in degraded mode; site engineers isolate the conduit', 'Safety first; OT is read-only for HexaView', ppl.ot?.name ?? o.commander, true);
    } else if (s.type === 'bec' || s.type === 'ato' || s.type === 'insider') {
      disabled = r.int(1, 4);
      add(t0 + 3 * MIN, 'containment', 'HexaView action broker', tools.idp, `Sessions revoked and ${disabled} account(s) disabled in ${tools.idp} (approved by ${ppl.soc.name})`, { key: true, to: '/soc/identity' });
      decide(t0 + 1 * MIN, s.type === 'bec' ? 'Hold all payments to changed beneficiaries and request recall' : 'Disable the account and revoke all sessions now', 'Stop further loss; operational impact accepted', o.commander, true);
    } else {
      isolated = Math.max(1, s.assets.length + r.int(0, 6));
      disabled = r.int(1, 3);
      add(t0 + 3 * MIN, 'containment', 'HexaView action broker', tools.edr, `${isolated} hosts network-isolated via ${tools.edr} (two approvals: ${ppl.soc.name}, ${c.people.admin.name})`, { key: true, to: '/soc/endpoint' });
      add(t0 + 6 * MIN, 'containment', 'HexaView action broker', tools.idp, `${disabled} compromised accounts disabled and sessions revoked in ${tools.idp}`, { to: '/soc/identity' });
      decide(t0 + 1 * MIN, `Isolate ${s.assets[0]} and adjacent systems`, 'Pre-encryption behaviour; business impact accepted by the exec sponsor', o.commander, true);
    }
    add(t0 + 9 * MIN, 'automation', 'HexaSOC playbook', 'HexaSOC Playbooks', `Indicators pushed to ${tools.net} block list and ${tools.siem} watchlist`, { to: '/soc/playbooks' });
    add(t0 + 20 * MIN, 'comms', ppl.comms.name, 'Comms Hub', 'Holding statement approved for reactive use; staff message sent to affected tenants', { to: '/comms/channels' });
  }
  if (reached('eradicate')) {
    const t0 = phaseAt.eradicate as number;
    add(t0, 'phase', o.commander, 'HexaView IR', `Phase advanced to ${PHASE_LABEL.eradicate}`, { key: true });
    add(t0 + 30 * MIN, 'note', `${IR_TEAM.l3} (HexaSOC L3)`, 'HexaSOC', `Root cause established: ${s.rootCause}`, { key: true });
    add(t0 + 90 * MIN, 'automation', 'HexaSOC hunt', tools.edr, `Estate-wide sweep for indicators: no further hits across ${r.int(800, 9000).toLocaleString('en-GB')} endpoints`, { to: '/soc/hunting' });
    decide(t0 + 60 * MIN, 'Reset Tier-0 credentials during the next maintenance window', 'Eliminate persistence; coordinated with operations', ppl.cloud.name);
  }
  if (reached('recover')) {
    const t0 = phaseAt.recover as number;
    add(t0, 'phase', o.commander, 'HexaView IR', `Phase advanced to ${PHASE_LABEL.recover}`, { key: true });
    add(t0 + 45 * MIN, 'note', ppl.cloud.name, tools.backup, `${s.services[0] ?? 'Primary service'} restored and validated; heightened monitoring for 30 days`, { key: true });
  }
  if (reached('post')) {
    const t0 = phaseAt.post as number;
    add(t0, 'phase', o.commander, 'HexaView IR', `Phase advanced to ${PHASE_LABEL.post}`, { key: true });
  }

  // Notices: progress by elapsed time.
  notices.forEach((x) => {
    if (o.closed) {
      x.status = x.kind === 'customer' && !s.personal ? 'na' : 'sent';
      x.approvedBy = x.kind === 'regulator' || x.kind === 'customer' ? ppl.legal.name : ppl.ciso.name;
      const win = (x.dueAt ?? x.startAt + 1440 * MIN) - x.startAt;
      x.sentAt = x.startAt + Math.round(win * Math.min(0.85, r.float(0.3, 0.8, 2) * (win > 10 * 1440 * MIN ? 0.25 : 1)));
      x.approvedAt = x.sentAt - r.int(10, 60) * MIN;
      add(x.sentAt, 'notification', x.owner, 'Comms Hub', `Sent: ${x.name} → ${x.recipient}`, { key: x.kind === 'regulator', to: '/incident-response/notifications' });
      return;
    }
    const total = x.dueAt ? x.dueAt - x.startAt : 1440 * MIN;
    const el = (now - x.startAt) / total;
    if (x.kind === 'insurer' && el > 0.08) { x.status = 'sent'; x.approvedBy = ppl.cfo.name; x.approvedAt = x.startAt + total * 0.05; x.sentAt = x.startAt + total * 0.07; }
    else if (x.kind === 'law' && o.stage >= 1) { x.status = 'sent'; x.approvedBy = o.commander; x.approvedAt = phaseAt.contain; x.sentAt = (phaseAt.contain ?? now) + 40 * MIN; }
    else if (x.dueAt && el > 0.6) { x.status = 'sent'; x.approvedBy = ppl.legal.name; x.approvedAt = x.startAt + total * 0.45; x.sentAt = x.startAt + total * 0.55; }
    else if (x.dueAt && el > 0.25) { x.status = 'approved'; x.approvedBy = ppl.legal.name; x.approvedAt = x.startAt + total * 0.2; }
    if (x.sentAt) add(x.sentAt, 'notification', x.owner, 'Comms Hub', `Sent: ${x.name} → ${x.recipient}`, { key: x.kind === 'regulator', to: '/incident-response/notifications' });
  });

  // Tasks: progress by stage.
  tasks.forEach((tk, i) => {
    if (o.closed) tk.status = 'done';
    else if (tk.stream === 'Containment') tk.status = o.stage >= 1 ? 'done' : i === 0 ? 'doing' : 'todo';
    else if (tk.stream === 'Forensics') tk.status = o.stage >= 2 ? 'done' : 'doing';
    else if (tk.stream === 'Recovery') tk.status = o.stage >= 3 ? 'done' : o.stage === 2 ? 'doing' : 'todo';
    else if (tk.stream === 'Comms') tk.status = o.stage >= 1 ? 'done' : 'doing';
    else if (tk.stream === 'Legal & regulatory') tk.status = o.stage >= 3 ? 'done' : i % 2 ? 'doing' : o.stage >= 1 ? 'blocked' : 'todo';
    else tk.status = o.stage >= 2 ? 'done' : 'doing';
  });

  // Playbook checks for phases already passed.
  const pb = playbookFor(s.type, tools);
  const checks: IrIncident['checks'] = {};
  PHASES.forEach((p, i) => {
    if (i > o.stage) return;
    const items = pb[p];
    const t0 = phaseAt[p] ?? declaredAt;
    const doneN = o.closed || i < o.stage ? items.length : Math.max(1, Math.floor(items.length * 0.5));
    items.slice(0, doneN).forEach((it, k) => { checks[it.id] = { t: Math.min(now, t0 + (k + 1) * 12 * MIN), by: it.auto ? 'HexaSOC playbook' : k % 2 ? IR_TEAM.lead : ppl.soc.name }; });
  });

  // Report and review.
  const report: ReportState = { audience: s.sev === 1 ? 'Executive / Board' : 'Internal technical', sections: AUDIENCE_SECTIONS[s.sev === 1 ? 'Executive / Board' : 'Internal technical'], status: 'none', version: 0 };
  const review: Review = { status: 'not_started', facilitator: `${IR_TEAM.lead} (HexaShield)`, wentWell: [], didnt: [], rootCauses: [], actions: [] };
  const closedAt = o.closed ? end : undefined;
  if (o.closed) {
    report.status = 'issued';
    report.version = r.int(2, 4);
    report.generatedAt = end - 3 * 1440 * MIN;
    report.requestedAt = report.generatedAt + 120 * MIN;
    report.legal = { name: ppl.legal.name, t: report.requestedAt + 300 * MIN };
    report.ciso = { name: ppl.ciso.name, t: report.requestedAt + 420 * MIN };
    report.issuedAt = report.ciso.t + 60 * MIN;
    add(report.issuedAt, 'report', ppl.ciso.name, 'HexaView Reporting', `Incident report v${report.version} issued to ${report.audience}; signed by ${ppl.legal.name} and ${ppl.ciso.name}`, { key: true, to: '/incident-response/report' });
    Object.assign(review, reviewFor(m, o.id, s, end, true));
    add(review.completedAt ?? end, 'report', review.facilitator, 'HexaView IR', `Post-incident review complete; ${review.actions.length} actions raised`, { to: '/incident-response/review' });
  } else if (o.stage >= 3) {
    report.status = 'generated';
    report.version = 1;
    report.generatedAt = now - r.int(30, 300) * MIN;
    Object.assign(review, reviewFor(m, o.id, s, now, false));
  }

  // Chain.
  raw.sort((a, b) => a.t - b.t);
  let timeline: TimelineEntry[] = [];
  raw.forEach((e) => { timeline = chainAppend(timeline, e, o.id); });

  return {
    id: o.id, title: s.title, type: s.type, sev: s.sev, phase: PHASES[o.stage], status: o.closed ? 'closed' : 'active', commander: o.commander,
    summary: s.summary, rootCause: s.rootCause, tenantIds, sites: [tenant ? `${tenant.name} (${tenant.city})` : s.tenantId], assets: s.assets, users: s.users,
    dataClasses: s.dataClasses, services: s.services, techniques: s.techniques, actor: s.actor, socId: s.socId, ticketId: s.ticketId,
    escalationIds: o.escalationId ? [o.escalationId] : [], personal: s.personal, ot: s.ot,
    detectedAt: s.detectedAt, escalatedAt: s.escalatedAt, declaredAt, phaseAt, closedAt, bridge,
    channels: [`#ir-${o.id.toLowerCase()}`, `#ir-${o.id.toLowerCase()}-exec`, `#ir-${o.id.toLowerCase()}-legal (privileged)`],
    roles: rolesFor(m, s.sev, s.type, o.commander), tasks, decisions, stakeholders, timeline, evidence, notices, checks, report, review,
    stats: { hostsIsolated: isolated, accountsDisabled: disabled, records: s.records, impact: s.impact }, dwellMin: r.int(s.sev === 1 ? 8 : 15, s.sev === 1 ? 140 : 600), guided: o.guided,
  };
}

function reviewFor(m: Mk, id: string, s: CaseSeed, t: number, done: boolean): Review {
  const { r, ppl, tools } = m;
  const actions: ReviewAction[] = [
    { id: `${id}-R1`, title: s.type === 'bec' ? 'Out-of-band verification for every beneficiary change' : 'Enforce phishing-resistant MFA on the access path used', owner: ppl.cloud.name, dueAt: t + 30 * 1440 * MIN, dest: 'comply', pushed: done },
    { id: `${id}-R2`, title: `Detection for ${s.techniques[0] ?? 'the initial technique'} in ${tools.siem}`, owner: ppl.soc.name, dueAt: t + 14 * 1440 * MIN, dest: 'detection', pushed: done },
    { id: `${id}-R3`, title: `Fund a ${IR_TYPES[s.type].short} resilience initiative`, owner: ppl.ciso.name, dueAt: t + 90 * 1440 * MIN, dest: 'programme', pushed: done && r.chance(0.7) },
    { id: `${id}-R4`, title: `Add this scenario to the ${IR_TYPES[s.type].short} tabletop`, owner: ppl.risk.name, dueAt: t + 45 * 1440 * MIN, dest: 'exercise', pushed: done && r.chance(0.6) },
  ];
  actions.forEach((a) => { if (a.pushed) { a.ref = a.dest === 'comply' ? `TSK-${r.int(1200, 1999)}` : a.dest === 'programme' ? `INI-${r.int(40, 99)}` : a.dest === 'detection' ? `DET-${r.int(300, 899)}` : `EX-${r.int(10, 60)}`; a.done = done && r.chance(0.5); } });
  return {
    status: done ? 'complete' : 'scheduled',
    scheduledAt: t + (done ? -2 : 5) * 1440 * MIN,
    completedAt: done ? t + 6 * 1440 * MIN : undefined,
    facilitator: `${IR_TEAM.lead} (HexaShield)`,
    wentWell: [`Escalation to L4 within the acceptance SLA`, `Containment through ${tools.edr === 'EDR' ? tools.idp : tools.edr} with approvals in minutes`, 'Single audited timeline used by every party'],
    didnt: [s.rootCause.split(';')[0], 'Stakeholder contact details out of date for one external party', 'Notification owner unclear for the first hour'],
    rootCauses: [r.pick(['Identity', 'Third party', 'Vulnerability management', 'Process']), r.pick(['Detection gap', 'Segmentation', 'Awareness'])],
    actions,
  };
}

/* =====================================================================
   Seed
   ===================================================================== */
export function guidedSpec(c: CustomerProfile): GuidedSpec {
  return GUIDED[c.id];
}

export function seedState(c: CustomerProfile, now = Date.now()): IrState {
  const r = rng(`ir-seed-${c.id}`);
  const m: Mk = { r, c, tools: irTools(c), ppl: irPeople(c) };
  const year = new Date(now).getFullYear();
  const socAll = socIncidents(c, 'all', 30);
  const open = socAll.filter((i) => i.status !== 'closed');
  const closedSoc = socAll.filter((i) => i.status === 'closed');
  const tks = socTickets(c, 'all').filter((t) => t.category === 'Report suspicious activity');

  // Active incidents: the most severe open SOC cases, one SEV1.
  const nActive = r.int(2, 3);
  const activeSoc = open.filter((i) => i.sev === 'critical' || i.sev === 'high').slice(0, nActive);
  while (activeSoc.length < 2 && open[activeSoc.length]) activeSoc.push(open[activeSoc.length]);
  let seq = r.int(380, 460);
  const stages = [1, 2, 3];
  const actives: IrIncident[] = activeSoc.map((inc, i) => {
    const seed = seedFromSoc(m, inc, now, tks.find((t) => t.linkedIncident === inc.id)?.id);
    seed.sev = i === 0 ? 1 : Math.max(2, seed.sev) as Sev;
    if (i === 0 && seed.type === 'ddos') seed.type = 'ransomware';
    const ageMin = i === 0 ? r.int(190, 420) : r.int(1500, 4300);
    const declaredAt = now - ageMin * MIN;
    seed.escalatedAt = declaredAt - r.int(8, 25) * MIN;
    seed.detectedAt = Math.min(seed.detectedAt, seed.escalatedAt - r.int(30, 90) * MIN);
    seed.path = seed.path.map((p, k) => ({ ...p, t: seed.detectedAt + Math.round(((seed.escalatedAt - seed.detectedAt) * (k + 1)) / 4) }));
    seed.alerts = seed.alerts.map((a, k) => ({ ...a, t: seed.detectedAt + k * 4 * MIN }));
    const commander = seed.sev === 1 ? m.ppl.ciso.name : r.chance(0.5) ? m.ppl.soc.name : HEXA_IR_LEAD;
    return buildIncident(m, seed, { id: `IR-${year}-${String(seq++).padStart(4, '0')}`, declaredAt, stage: stages[i] ?? 1, closed: false, commander, now });
  });

  // Escalations awaiting L4: next open SOC cases not already declared.
  const nEsc = r.int(3, 6);
  const used = new Set(activeSoc.map((i) => i.id));
  const escSoc = open.filter((i) => !used.has(i.id) && i.sev !== 'low').slice(0, nEsc);
  while (escSoc.length < 3) { const x = open.find((i) => !used.has(i.id) && !escSoc.includes(i)); if (!x) break; escSoc.push(x); }
  let escSeq = r.int(5100, 5900);
  const escalations: Escalation[] = escSoc.map((inc, i) => {
    const seed = seedFromSoc(m, inc, now, i === 0 ? tks[0]?.id : tks.find((t) => t.linkedIncident === inc.id)?.id);
    seed.escalatedAt = now - r.int(3, 55) * MIN;
    seed.detectedAt = Math.min(seed.detectedAt, seed.escalatedAt - r.int(25, 120) * MIN);
    seed.path = seed.path.map((p, k) => ({ ...p, t: seed.detectedAt + Math.round(((seed.escalatedAt - seed.detectedAt) * (k + 1)) / 4) }));
    seed.alerts = seed.alerts.map((a, k) => ({ ...a, t: seed.detectedAt + k * 5 * MIN }));
    const reason = r.pick([
      `Scope exceeds SOC authority: ${inc.hosts.length} assets on ${c.tenants.find((t) => t.id === inc.tenantId)?.short} and possible regulated data`,
      `Containment needs business sign-off on ${inc.hosts[0]}; recommend declaring an incident`,
      `${IR_TYPES[seed.type].label} indicators confirmed; notification clocks may apply`,
      `Repeat activity linked to ${inc.actor ?? 'a known intrusion set'}; needs coordinated response`,
    ]);
    return makeEscalation(seed, `ESC-${escSeq++}`, reason, `${seed.path[2]?.note}. ${inc.actor ? `Tradecraft overlap with ${inc.actor}.` : ''} Recommend ${SEV_LABEL[seed.sev]}.`);
  });

  // Closed incidents with issued reports.
  const nClosed = r.int(6, 10);
  const tp = closedSoc.filter((i) => i.disposition === 'True positive');
  const pool = [...tp.filter((i) => i.sev === 'critical' || i.sev === 'high'), ...tp.filter((i) => i.sev === 'medium'), ...closedSoc.filter((i) => i.disposition !== 'True positive' && i.sev !== 'low')];
  const chosen = Array.from(new Set(pool)).slice(0, nClosed).sort((a, b) => b.openedMin - a.openedMin);
  let cseq = seq - 80;
  const closed: IrIncident[] = chosen.map((inc) => {
    const seed = seedFromSoc(m, inc, now);
    const declaredAt = now - inc.openedMin * MIN + r.int(20, 90) * MIN;
    seed.escalatedAt = declaredAt - r.int(8, 30) * MIN;
    seed.detectedAt = seed.escalatedAt - r.int(20, 120) * MIN;
    seed.path = seed.path.map((p, k) => ({ ...p, t: seed.detectedAt + Math.round(((seed.escalatedAt - seed.detectedAt) * (k + 1)) / 4) }));
    seed.alerts = seed.alerts.map((a, k) => ({ ...a, t: seed.detectedAt + k * 4 * MIN }));
    const commander = seed.sev === 1 ? m.ppl.ciso.name : r.pick([m.ppl.soc.name, HEXA_IR_LEAD]);
    const inc2 = buildIncident(m, seed, { id: `IR-${year}-${String(cseq++).padStart(4, '0')}`, declaredAt, stage: 4, closed: true, commander, now });
    return inc2;
  });

  // Close times must not be in the future.
  closed.forEach((x) => { if ((x.closedAt ?? 0) > now) x.closedAt = now - 60 * MIN; });

  return { v: 2, seededAt: now, seq, escalations, incidents: [...actives, ...closed], focus: actives[0]?.id ?? null, guided: null };
}

/** The guided scenario's escalation, inserted at the top of the queue. */
export function guidedEscalation(c: CustomerProfile, seq: number, now = Date.now()): Escalation {
  const r = rng(`ir-guided-${c.id}-${seq}`);
  const m: Mk = { r, c, tools: irTools(c), ppl: irPeople(c) };
  const g = GUIDED[c.id];
  const s = seedFromGuided(m, g, now);
  return makeEscalation(s, `ESC-${6000 + (seq % 1000)}`, g.reason, g.notes, true);
}

/** Declare an incident from an accepted escalation. */
export function declareFromEscalation(c: CustomerProfile, esc: Escalation, f: DeclareForm, id: string, now = Date.now()): IrIncident {
  const r = rng(`ir-declare-${c.id}-${id}`);
  const m: Mk = { r, c, tools: irTools(c), ppl: irPeople(c) };
  const seed: CaseSeed = { ...esc, title: f.title, type: f.type, sev: f.sev };
  const inc = buildIncident(m, seed, { id, declaredAt: now, stage: 0, closed: false, commander: f.commander, now, escalationId: esc.id, guided: esc.guided });
  if (f.scope.trim()) inc.summary = `${inc.summary} Initial scope: ${f.scope.trim()}`;
  return inc;
}

export function commanderOptions(c: CustomerProfile): string[] {
  const p = irPeople(c);
  return Array.from(new Set([p.ciso.name, p.soc.name, HEXA_IR_LEAD, p.risk.name]));
}

/** Directory used by "Add stakeholder". */
export function stakeholderDirectory(c: CustomerProfile): Omit<Stakeholder, 'id'>[] {
  const ppl = irPeople(c);
  const internal = allPeople(c).map((p) => ({ name: p.name, title: p.role, org: c.short, group: 'internal' as const, kind: /CEO|Chief Executive|Chairman|President/i.test(p.role) ? 'CEO / board' : /counsel|legal/i.test(p.role) ? 'Legal' : /privacy|DPO|data protection/i.test(p.role) ? 'Privacy / DPO' : /CFO|financ/i.test(p.role) ? 'Finance' : /OT|plant|engineer|biomed|ride/i.test(p.role) ? 'IT / OT' : 'Business owner', incidentRole: 'Kept informed', raci: 'I' as Raci, channel: 'Teams channel', contact: p.email, privileged: false, nda: false }));
  const ext: Omit<Stakeholder, 'id'>[] = [
    { name: 'HexaShield Crisis Communications', title: 'Crisis comms adviser', org: 'HexaShield', group: 'external', kind: 'HexaShield IR', incidentRole: 'Statement drafting', raci: 'C', channel: 'Bridge', contact: 'ir@hexashield.io', privileged: false, nda: true },
    { name: 'Panel forensic accountants', title: `Loss quantification (via ${c.insurance.broker})`, org: 'Forensic accountants', group: 'external', kind: 'Forensics', incidentRole: 'Quantify business interruption loss', raci: 'C', channel: 'Email', contact: c.insurance.broker, privileged: true, nda: true },
    { name: 'Ransom negotiation specialist (panel)', title: 'Threat actor engagement adviser', org: 'Panel vendor', group: 'external', kind: 'Outside counsel', incidentRole: 'Advice only; no engagement without board approval', raci: 'C', channel: 'Signal (privileged)', contact: 'Via breach coach', privileged: true, nda: true },
    { name: lawEnforcement(c), title: 'Law enforcement', org: 'Law enforcement', group: 'external', kind: 'Law enforcement', incidentRole: 'Crime report; IoC sharing', raci: 'I', channel: 'Phone + portal', contact: lawEnforcement(c), privileged: false, nda: false },
    ...c.thirdParties.slice(0, 6).map((v) => ({ name: v.name, title: v.category, org: 'Supplier', group: 'external' as const, kind: 'Key supplier / customer', incidentRole: `Access: ${v.access}`, raci: 'I' as Raci, channel: 'Email', contact: v.name, privileged: false, nda: true })),
    { name: 'External auditor', title: 'Statutory auditor', org: 'Auditor', group: 'external', kind: 'Auditor', incidentRole: 'Informed of material incidents', raci: 'I', channel: 'Email', contact: 'Audit partner', privileged: false, nda: true },
  ];
  void ppl;
  return [...internal, ...ext];
}

export function playbookProgress(inc: IrIncident, t: IrTools): { done: number; total: number; byPhase: Record<Phase, { done: number; total: number }> } {
  const pb = playbookFor(inc.type, t);
  const byPhase = {} as Record<Phase, { done: number; total: number }>;
  let done = 0;
  let total = 0;
  PHASES.forEach((p) => {
    const d = pb[p].filter((it) => inc.checks[it.id]).length;
    byPhase[p] = { done: d, total: pb[p].length };
    done += d;
    total += pb[p].length;
  });
  return { done, total, byPhase };
}

/** Timing metrics for the review, in minutes. */
export function timings(inc: IrIncident): { id: string; label: string; min: number | null; target: number }[] {
  const d = (a?: number, b?: number) => (a !== undefined && b !== undefined ? Math.max(0, Math.round((b - a) / MIN)) : null);
  const firstNotice = inc.notices.filter((n) => n.sentAt && n.kind === 'regulator').map((n) => n.sentAt as number).sort((a, b) => a - b)[0];
  return [
    { id: 'detect', label: 'Time to detect (dwell)', min: inc.dwellMin, target: 60 },
    { id: 'escalate', label: 'Time to escalate (L1 → L4)', min: d(inc.detectedAt, inc.escalatedAt), target: 60 },
    { id: 'declare', label: 'Time to declare', min: d(inc.escalatedAt, inc.declaredAt), target: inc.sev === 1 ? 15 : 30 },
    { id: 'contain', label: 'Time to contain', min: d(inc.declaredAt, inc.phaseAt.eradicate ?? (inc.phaseAt.contain ? inc.phaseAt.contain + 45 * MIN : undefined)), target: inc.sev === 1 ? 240 : 480 },
    { id: 'eradicate', label: 'Time to eradicate', min: d(inc.declaredAt, inc.phaseAt.recover), target: 4320 },
    { id: 'recover', label: 'Time to recover', min: d(inc.declaredAt, inc.phaseAt.post ?? inc.closedAt), target: 10080 },
    { id: 'notify', label: 'Time to first regulator notice', min: d(inc.declaredAt, firstNotice), target: Math.min(1440, ...inc.notices.filter((n) => n.kind === 'regulator' && n.dueAt).map((n) => Math.round(((n.dueAt as number) - n.startAt) / MIN))) },
  ];
}

/** Escalate a HexaSOC case to L4 on demand (from HexaSOC › Incidents & Response). */
export function escalationFromSoc(c: CustomerProfile, socId: string, seq: number, now = Date.now()): Escalation | null {
  const inc = ['all', ...c.tenants.map((t) => t.id)].reduce<Incident | undefined>((hit, tid) => hit ?? socIncidents(c, tid, 90).find((i) => i.id === socId), undefined);
  if (!inc) return null;
  const r = rng(`ir-esc-soc-${c.id}-${socId}`);
  const m: Mk = { r, c, tools: irTools(c), ppl: irPeople(c) };
  const seed = seedFromSoc(m, inc, now);
  seed.escalatedAt = now;
  seed.detectedAt = Math.min(seed.detectedAt, now - 20 * MIN);
  seed.path = seed.path.map((p, k) => ({ ...p, t: seed.detectedAt + Math.round(((now - seed.detectedAt) * (k + 1)) / 4) }));
  return makeEscalation(seed, `ESC-${7000 + (seq % 1000)}`, `Escalated from HexaSOC by the analyst on ${inc.id}`, `${seed.path[2]?.note}. Recommend ${SEV_LABEL[seed.sev]}.`);
}
