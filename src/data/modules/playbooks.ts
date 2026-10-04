// HexaSOC Playbook Builder: response playbooks as node graphs (trigger, enrich,
// decide, approve, act, notify). Every write-back goes through the HexaView
// action broker and its risk-class approval gates; OT is never written to.
// All data is derived from the customer profile (connectors, people, tenants,
// sector, frameworks) and the seeded RNG, never keyed by customer id.
import type { Connector, ConnectorCategory, CustomerProfile } from '../types';
import { rng, type Rng } from '../../lib/rng';
import { isStale } from '../customers';

/* =====================================================================
   Tool capabilities
   ===================================================================== */
export type Cap = 'siem' | 'edr' | 'identity' | 'email' | 'firewall' | 'sase' | 'itsm' | 'ot' | 'intel' | 'pam' | 'dlp' | 'vuln' | 'asset' | 'custody' | 'cloud' | 'grc';

export const CAP_LABEL: Record<Cap, string> = {
  siem: 'SIEM', edr: 'EDR / XDR', identity: 'Identity', email: 'Email security', firewall: 'Firewall', sase: 'SASE / SSE', itsm: 'ITSM', ot: 'OT monitoring',
  intel: 'Threat intel', pam: 'PAM', dlp: 'DLP', vuln: 'Vulnerability', asset: 'Asset / CMDB', custody: 'Custody', cloud: 'Cloud posture', grc: 'GRC',
};

const CAT_CAP: Partial<Record<ConnectorCategory, Cap>> = {
  SIEM: 'siem', 'EDR / XDR': 'edr', Identity: 'identity', Email: 'email', SASE: 'sase', ITSM: 'itsm', OT: 'ot', Intelligence: 'intel', PAM: 'pam',
  DLP: 'dlp', Vulnerability: 'vuln', 'Asset / CMDB': 'asset', Custody: 'custody', 'Cloud posture': 'cloud', GRC: 'grc',
};

export function capOf(k: Connector): Cap | null {
  if (k.env === 'ot' || k.category === 'OT') return 'ot';
  if (k.category === 'Network') return /swift/i.test(k.product) ? null : 'firewall';
  if (k.category === 'Email' && /awareness/i.test(k.product)) return null;
  return CAT_CAP[k.category] ?? null;
}

const HEALTH_RANK = { healthy: 0, degraded: 1, paused: 2, failing: 3 } as const;

/** Connected tools for the given capabilities: write-capable and healthy first. */
export function toolsFor(c: CustomerProfile, caps: readonly Cap[]): Connector[] {
  return c.connectors
    .filter((k) => {
      const cap = capOf(k);
      return cap !== null && caps.includes(cap);
    })
    .sort((a, b) => caps.indexOf(capOf(a)!) - caps.indexOf(capOf(b)!) || (b.write.length > 0 ? 1 : 0) - (a.write.length > 0 ? 1 : 0) || HEALTH_RANK[a.status] - HEALTH_RANK[b.status]);
}

export function toolName(k: Connector): string {
  return k.vendor === 'Generic' || k.vendor === 'HexaShield' ? k.product : `${k.vendor} ${k.product}`;
}

/* =====================================================================
   Node catalogue
   ===================================================================== */
export type NodeKind = 'trigger' | 'enrich' | 'condition' | 'approval' | 'action' | 'notify' | 'wait' | 'end';
export type Port = 'out' | 'yes' | 'no';
export type PbRisk = 'low' | 'medium' | 'high';
export const RISK_RANK: Record<PbRisk, number> = { low: 0, medium: 1, high: 2 };
export const RISK_APPROVERS: Record<PbRisk, number> = { low: 0, medium: 1, high: 2 };

export interface OpDef {
  id: string;
  kind: NodeKind;
  label: string;
  caps?: Cap[];
  risk?: PbRisk;
  /** Attempts to write to OT: always blocked by policy. */
  ot?: boolean;
  openc2?: { action: string; target: string };
  /** Analyst minutes this step takes by hand. */
  manualMin: number;
  /** Machine seconds this step takes in the playbook engine. */
  machineSec: number;
  params?: (c: CustomerProfile) => [key: string, label: string, def: string][];
  blurb: string;
}

const chatOf = (c: CustomerProfile) => (c.connectors.some((k) => k.vendor === 'Microsoft') ? 'Microsoft Teams' : 'Slack');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const OPS: OpDef[] = [
  // Triggers
  { id: 'trg.siem', kind: 'trigger', label: 'Detection rule fires', caps: ['siem'], manualMin: 4, machineSec: 1, blurb: 'Starts on a SIEM analytic rule or correlation search', params: () => [['rule', 'Rule', 'HV - Suspicious activity'], ['severity', 'Minimum severity', 'High']] },
  { id: 'trg.edr', kind: 'trigger', label: 'EDR alert', caps: ['edr'], manualMin: 4, machineSec: 1, blurb: 'Starts on an endpoint detection', params: () => [['alert', 'Alert', 'Ransomware behaviour'], ['severity', 'Minimum severity', 'High']] },
  { id: 'trg.identity', kind: 'trigger', label: 'Identity risk event', caps: ['identity'], manualMin: 4, machineSec: 1, blurb: 'Risky sign-in, impossible travel, MFA fatigue', params: () => [['signal', 'Signal', 'Impossible travel or MFA fatigue'], ['risk', 'Minimum user risk', 'Medium']] },
  { id: 'trg.email', kind: 'trigger', label: 'Phishing report or detection', caps: ['email'], manualMin: 4, machineSec: 1, blurb: 'User-reported phish or gateway detection', params: () => [['source', 'Source', 'Report button and gateway detections']] },
  { id: 'trg.dlp', kind: 'trigger', label: 'DLP policy violation', caps: ['dlp', 'siem'], manualMin: 4, machineSec: 1, blurb: 'Data-loss policy hit', params: () => [['policy', 'Policy', 'Bulk upload to unsanctioned destination']] },
  { id: 'trg.intel', kind: 'trigger', label: 'Threat intel match', caps: ['intel'], manualMin: 4, machineSec: 1, blurb: 'Leaked credential, lookalike domain or IOC sighting', params: () => [['match', 'Match type', 'Leaked credential']] },
  { id: 'trg.vuln', kind: 'trigger', label: 'Exploitable exposure found', caps: ['vuln', 'cloud'], manualMin: 4, machineSec: 1, blurb: 'Known-exploited vulnerability on an internet-facing asset', params: () => [['filter', 'Filter', 'KEV listed and internet-facing']] },
  { id: 'trg.ot', kind: 'trigger', label: 'OT anomaly (read-only feed)', caps: ['ot'], manualMin: 4, machineSec: 1, blurb: 'Alert from the OT monitoring feed; read-only', params: () => [['alert', 'Alert', 'Programme change outside change window']] },
  { id: 'trg.custody', kind: 'trigger', label: 'Watermark or custody alert', caps: ['custody'], manualMin: 4, machineSec: 1, blurb: 'Forensic watermark hit or custody breach', params: () => [['alert', 'Alert', 'Forensic watermark match']] },
  // Enrich
  { id: 'enr.identity', kind: 'enrich', label: 'User and sign-in context', caps: ['identity'], manualMin: 6, machineSec: 2, blurb: 'Groups, MFA methods, risky sign-ins' },
  { id: 'enr.edr', kind: 'enrich', label: 'Device and process tree', caps: ['edr'], manualMin: 8, machineSec: 3, blurb: 'Device, related alerts, process lineage' },
  { id: 'enr.intel', kind: 'enrich', label: 'Threat intel reputation', caps: ['intel'], manualMin: 5, machineSec: 2, blurb: 'Reputation, actor attribution, confidence' },
  { id: 'enr.asset', kind: 'enrich', label: 'Asset criticality', caps: ['asset', 'vuln', 'cloud'], manualMin: 6, machineSec: 2, blurb: 'Business service, owner, criticality 1–5' },
  { id: 'enr.siem', kind: 'enrich', label: 'Related events (24 h)', caps: ['siem'], manualMin: 10, machineSec: 4, blurb: 'Pivot search across the SIEM' },
  { id: 'enr.email', kind: 'enrich', label: 'Message trace and clicks', caps: ['email'], manualMin: 7, machineSec: 2, blurb: 'Recipients, clicks, attachments' },
  { id: 'enr.pam', kind: 'enrich', label: 'Privileged session check', caps: ['pam'], manualMin: 5, machineSec: 2, blurb: 'Vaulted account, live session, approver' },
  { id: 'enr.ot', kind: 'enrich', label: 'OT asset and zone context', caps: ['ot'], manualMin: 8, machineSec: 2, blurb: 'Zone, Purdue level, safety relevance (read-only)' },
  // Decide
  { id: 'cond', kind: 'condition', label: 'Condition', manualMin: 3, machineSec: 0, blurb: 'Branch on an expression (yes / no)', params: () => [['expr', 'Expression', 'confidence >= 85']] },
  { id: 'appr', kind: 'approval', label: 'Approval gate', manualMin: 0, machineSec: 0, blurb: 'Risk-class gate: who approves, auto-approve rules' },
  // Act (write-back)
  { id: 'act.edr.contain', kind: 'action', label: 'Contain host', caps: ['edr'], risk: 'high', openc2: { action: 'contain', target: 'device' }, manualMin: 12, machineSec: 6, blurb: 'Network-isolate the device via the EDR' },
  { id: 'act.edr.ioc', kind: 'action', label: 'Add IOC to blocklist', caps: ['edr'], risk: 'medium', openc2: { action: 'deny', target: 'file' }, manualMin: 6, machineSec: 3, blurb: 'Hash or domain, prevent mode, 90-day expiry' },
  { id: 'act.idp.revoke', kind: 'action', label: 'Revoke sessions', caps: ['identity'], risk: 'high', openc2: { action: 'deny', target: 'x-idp:user_session' }, manualMin: 8, machineSec: 3, blurb: 'Revoke refresh tokens and sign-in sessions' },
  { id: 'act.idp.disable', kind: 'action', label: 'Disable user', caps: ['identity'], risk: 'high', openc2: { action: 'deny', target: 'x-idp:user_account' }, manualMin: 6, machineSec: 2, blurb: 'Block sign-in for the account' },
  { id: 'act.idp.mfa', kind: 'action', label: 'Force MFA re-registration', caps: ['identity'], risk: 'medium', openc2: { action: 'update', target: 'x-idp:auth_methods' }, manualMin: 6, machineSec: 2, blurb: 'Remove methods, require re-enrolment' },
  { id: 'act.idp.reset', kind: 'action', label: 'Force password reset', caps: ['identity'], risk: 'medium', openc2: { action: 'update', target: 'x-idp:credential' }, manualMin: 5, machineSec: 2, blurb: 'Reset at next sign-in' },
  { id: 'act.idp.oauth', kind: 'action', label: 'Revoke OAuth app consent', caps: ['identity'], risk: 'high', openc2: { action: 'deny', target: 'x-idp:oauth_grant' }, manualMin: 10, machineSec: 3, blurb: 'Remove the grant and disable the app' },
  { id: 'act.fw.block', kind: 'action', label: 'Block address', caps: ['firewall', 'sase'], risk: 'medium', openc2: { action: 'deny', target: 'ipv4_net' }, manualMin: 8, machineSec: 4, blurb: 'Add to the HexaView block list' },
  { id: 'act.sase.url', kind: 'action', label: 'Block domain or URL', caps: ['sase', 'firewall'], risk: 'medium', openc2: { action: 'deny', target: 'uri' }, manualMin: 6, machineSec: 3, blurb: 'URL filtering block' },
  { id: 'act.email.quarantine', kind: 'action', label: 'Quarantine message (all mailboxes)', caps: ['email'], risk: 'medium', openc2: { action: 'contain', target: 'x-email:message' }, manualMin: 15, machineSec: 5, blurb: 'Pull every copy from every mailbox' },
  { id: 'act.email.block', kind: 'action', label: 'Block sender', caps: ['email'], risk: 'medium', openc2: { action: 'deny', target: 'email_addr' }, manualMin: 4, machineSec: 2, blurb: 'Add to blocked senders' },
  { id: 'act.pam.terminate', kind: 'action', label: 'Terminate privileged session', caps: ['pam'], risk: 'high', openc2: { action: 'stop', target: 'x-pam:remote_session' }, manualMin: 6, machineSec: 2, blurb: 'End the live session on the jump host' },
  { id: 'act.pam.rotate', kind: 'action', label: 'Rotate credential', caps: ['pam'], risk: 'high', openc2: { action: 'update', target: 'x-pam:credential' }, manualMin: 10, machineSec: 4, blurb: 'Rotate the vaulted secret' },
  { id: 'act.custody.revoke', kind: 'action', label: 'Revoke content access', caps: ['custody'], risk: 'high', openc2: { action: 'deny', target: 'x-hexacustody:access_grant' }, manualMin: 12, machineSec: 4, blurb: 'Revoke grant, wipe cached copies' },
  { id: 'act.siem.rule', kind: 'action', label: 'Enable detection rule', caps: ['siem'], risk: 'low', openc2: { action: 'set', target: 'x-siem:rule_state' }, manualMin: 10, machineSec: 3, blurb: 'Switch on a hunting rule for 7 days' },
  { id: 'act.itsm.ticket', kind: 'action', label: 'Open ITSM ticket', caps: ['itsm'], risk: 'low', openc2: { action: 'create', target: 'x-itsm:ticket' }, manualMin: 6, machineSec: 2, blurb: 'Ticket with evidence pack attached' },
  { id: 'act.ot.write', kind: 'action', label: 'Write to OT asset', caps: ['ot'], risk: 'high', ot: true, manualMin: 0, machineSec: 0, blurb: 'Isolate asset or push config: blocked by policy' },
  // Flow
  { id: 'ntf.chat', kind: 'notify', label: 'Notify channel', manualMin: 3, machineSec: 1, blurb: 'Post to the SOC channel', params: (c) => [['channel', 'Channel', `${chatOf(c)} · #soc-${slug(c.short)}`]] },
  { id: 'ntf.page', kind: 'notify', label: 'Page on-call', manualMin: 3, machineSec: 1, blurb: 'Page the duty analyst', params: (c) => [['who', 'Who', `SOC on-call (${c.people.socLead.name}'s rota)`]] },
  { id: 'ntf.clock', kind: 'notify', label: 'Start regulatory clock', caps: ['grc'], manualMin: 20, machineSec: 1, blurb: 'Open the notification clock in HexaComply', params: () => [['regime', 'Regime', 'Regulator'], ['deadline', 'Deadline', '72 h']] },
  { id: 'wait', kind: 'wait', label: 'Wait', manualMin: 0, machineSec: 0, blurb: 'Pause for a duration or acknowledgement', params: () => [['duration', 'Duration', '15 min']] },
  { id: 'end', kind: 'end', label: 'End', manualMin: 2, machineSec: 0, blurb: 'Close the case with an outcome', params: () => [['outcome', 'Outcome', 'Close as true positive']] },
];
export const OP: Record<string, OpDef> = Object.fromEntries(OPS.map((o) => [o.id, o]));

export const AUTO_RULES = [
  'Always ask',
  'Auto-approve when confidence ≥ 90% and asset criticality ≤ 3',
  'Auto-approve known-bad indicators (HexaInt confidence ≥ 95)',
  'Auto-approve if no response in 15 min out of hours',
];

/* =====================================================================
   Playbook model
   ===================================================================== */
export interface PbNode {
  id: string;
  kind: NodeKind;
  op: string;
  label: string;
  x: number;
  y: number;
  tool?: string;
  params: Record<string, string>;
  /** Approval gates: the risk class they approve. */
  risk?: PbRisk;
  auto?: string;
}
export interface PbEdge {
  id: string;
  from: string;
  to: string;
  port: Port;
}
export type PbStatus = 'active' | 'draft' | 'paused' | 'review';
export type PbCategory = 'Email' | 'Identity' | 'Endpoint' | 'Data' | 'Exposure' | 'OT' | 'Regulatory' | 'Sector';
export interface PbVersion {
  v: number;
  by: string;
  minAgo: number;
  /** Epoch ms for versions created in this session. */
  at?: number;
  note: string;
}
export interface Playbook {
  id: string;
  name: string;
  category: PbCategory;
  summary: string;
  status: PbStatus;
  tenants: string[] | 'all';
  runs30: number;
  autoClosedPct: number;
  medianSavedMin: number;
  manualMttrMin: number;
  autoMttrMin: number;
  editedBy: string;
  editedMinAgo: number;
  editedAt?: number;
  version: number;
  versions: PbVersion[];
  nodes: PbNode[];
  edges: PbEdge[];
  /** Edited since the last published version. */
  dirty?: boolean;
  submittedBy?: string;
}

export function paramDefaults(c: CustomerProfile, op: string): Record<string, string> {
  const d = OP[op]?.params?.(c) ?? [];
  return Object.fromEntries(d.map(([k, , v]) => [k, v]));
}

export function approvalsRequired(pb: Playbook): number {
  return Math.max(0, ...pb.nodes.filter((n) => n.kind === 'approval').map((n) => RISK_APPROVERS[n.risk ?? 'medium']));
}

export function triggerLabel(c: CustomerProfile, pb: Playbook): string {
  const t = pb.nodes.find((n) => n.kind === 'trigger');
  if (!t) return 'No trigger';
  const k = c.connectors.find((x) => x.id === t.tool);
  const what = t.params.rule ?? t.params.alert ?? t.params.signal ?? t.params.policy ?? t.params.match ?? t.params.filter ?? t.params.source ?? t.label;
  return `${what}${k ? ` · ${k.product}` : ''}`;
}

/* =====================================================================
   Graph builder used by the library templates
   ===================================================================== */
class G {
  nodes: PbNode[] = [];
  edges: PbEdge[] = [];
  private n = 0;
  private c: CustomerProfile;
  constructor(c: CustomerProfile) {
    this.c = c;
  }
  node(op: string, label?: string, params: Record<string, string> = {}, extra: Partial<PbNode> = {}): string {
    let opId = op;
    let def = OP[opId];
    let lbl = label ?? def.label;
    let tool = def.caps ? toolsFor(this.c, def.caps)[0]?.id : undefined;
    if (def.caps && !tool && !def.ot) {
      // Fall back to what this customer has connected, honestly labelled.
      if (def.kind === 'action') {
        opId = 'act.itsm.ticket';
        lbl = `Ticket: ${lbl.charAt(0).toLowerCase()}${lbl.slice(1)} (manual)`;
      } else if (def.kind === 'trigger') opId = 'trg.siem';
      else if (def.kind === 'enrich') opId = 'enr.siem';
      def = OP[opId];
      tool = def.caps ? toolsFor(this.c, def.caps)[0]?.id : undefined;
    }
    const id = `n${++this.n}`;
    this.nodes.push({ id, kind: def.kind, op: opId, label: lbl, x: 0, y: 0, tool, params: { ...paramDefaults(this.c, opId), ...params }, ...extra });
    return id;
  }
  link(a: string, b: string, port: Port = 'out') {
    this.edges.push({ id: `e${this.edges.length + 1}`, from: a, to: b, port });
  }
  chain(...ids: string[]) {
    for (let i = 0; i < ids.length - 1; i++) this.link(ids[i], ids[i + 1]);
  }
  gate(risk: PbRisk, label?: string, auto = AUTO_RULES[0]): string {
    return this.node('appr', label ?? `Approve (${risk} risk)`, {}, { risk, auto: risk === 'high' ? AUTO_RULES[0] : auto });
  }
}

interface Tpl {
  key: string;
  name: string;
  category: PbCategory;
  summary: string;
  volume: number;
  manualMttr: number;
  autoClosed: [number, number];
  status?: PbStatus;
  tenants?: string[] | 'all';
  build: (g: G) => void;
}

interface RegClock {
  re: RegExp;
  name: string;
  regime: string;
  deadline: string;
  cond: string;
}
const REG_CLOCKS: RegClock[] = [
  { re: /DORA/, name: 'DORA major ICT incident clock', regime: 'DORA Art. 19', deadline: '4 h initial notification', cond: 'clients_affected > 10% || critical_service_down > 2 h' },
  { re: /HIPAA/, name: 'HIPAA breach risk assessment', regime: 'HIPAA Breach Notification Rule', deadline: '60 days (HHS OCR)', cond: 'phi_records_exposed > 0 && not encrypted' },
  { re: /R155/, name: 'UNECE R155 vehicle incident report', regime: 'UNECE R155 7.3.7', deadline: 'Next monitoring report to the type-approval authority', cond: 'vehicles_affected > 0 && attack_confirmed' },
  { re: /DFARS/, name: 'DFARS 7012 cyber incident report', regime: 'DFARS 252.204-7012', deadline: '72 h to DoD via DIBNet', cond: 'cui_systems_affected || covered_defense_information_at_risk' },
  { re: /NYDFS/, name: 'NYDFS 500.17 cyber event notice', regime: 'NYDFS 23 NYCRR 500.17', deadline: '72 h notice', cond: 'material_harm || ransomware_deployed' },
  { re: /SEC 8-K/, name: 'SEC 8-K Item 1.05 materiality clock', regime: 'SEC Form 8-K Item 1.05', deadline: '4 business days after materiality', cond: 'material_impact_assessed == true' },
  { re: /TPN|MPA/, name: 'Studio notification: pre-release exposure', regime: 'TPN / studio contract', deadline: '24 h notice to the content owner', cond: 'title_status == "pre-release" && exposure_confirmed' },
  { re: /ISPS|IMO/, name: 'ISPS security incident report', regime: 'ISPS Code / IMO MSC-FAL.1', deadline: 'Report to PFSO and flag state without delay', cond: 'port_facility_affected || vessel_systems_affected' },
  { re: /PDPA/, name: 'PDPA data breach notification', regime: 'Singapore PDPA s26D', deadline: '3 calendar days to the PDPC', cond: 'affected_individuals >= 500 || significant_harm' },
  { re: /NIS2/, name: 'NIS2 significant incident early warning', regime: 'NIS2 Art. 23', deadline: '24 h early warning, 72 h notification', cond: 'service_disruption > 1 h || cross_border_impact' },
  { re: /GDPR/, name: 'GDPR personal data breach clock', regime: 'GDPR Art. 33', deadline: '72 h to the supervisory authority', cond: 'personal_data_breach && risk_to_individuals' },
];

function templates(c: CustomerProfile): Tpl[] {
  const p = c.people;
  const ot = c.connectors.filter((k) => capOf(k) === 'ot');
  const otTenants = c.tenants.filter((t) => t.env.includes('ot')).map((t) => t.id);
  const fwText = c.frameworks.map((f) => `${f.short} ${f.name}`).join(' ');
  const sector = `${c.sector} ${c.sectorLong}`;
  const out: Tpl[] = [];

  out.push({
    key: 'phish', name: 'Phishing triage and purge', category: 'Email', volume: 210, manualMttr: 55, autoClosed: [62, 78],
    summary: 'Scores reported and detected phish, pulls every copy, blocks the sender and closes benign reports automatically.',
    build: (g) => {
      const t = g.node('trg.email', 'Phish reported or detected');
      const e1 = g.node('enr.email');
      const e2 = g.node('enr.intel', 'Sender and URL reputation');
      const d = g.node('cond', 'Malicious and delivered?', { expr: 'verdict == "malicious" && delivered_to >= 1' });
      const a = g.gate('medium', 'Approve purge', AUTO_RULES[2]);
      const q = g.node('act.email.quarantine');
      const b = g.node('act.email.block');
      const tk = g.node('act.itsm.ticket', 'Ticket with evidence');
      const n = g.node('ntf.chat', 'Tell reporter and SOC');
      const e = g.node('end', 'Closed: true positive');
      const nb = g.node('ntf.chat', 'Thank reporter (benign)', { channel: 'Email reply to reporter' });
      const eb = g.node('end', 'Closed: benign', { outcome: 'Close as benign' });
      const ex = g.node('end', 'Escalated to analyst', { outcome: 'Escalate to analyst queue' });
      g.chain(t, e1, e2, d);
      g.link(d, a, 'yes');
      g.link(d, nb, 'no');
      g.link(nb, eb);
      g.link(a, q, 'yes');
      g.link(a, ex, 'no');
      g.chain(q, b, tk, n, e);
    },
  });
  out.push({
    key: 'mfa', name: 'Impossible travel and MFA fatigue', category: 'Identity', volume: 140, manualMttr: 70, autoClosed: [48, 66],
    summary: 'Checks sign-in context and push-denial bursts, then revokes sessions and forces MFA re-registration after two approvals.',
    build: (g) => {
      const t = g.node('trg.identity');
      const e1 = g.node('enr.identity');
      const e2 = g.node('enr.siem', 'Sign-ins and VPN (24 h)');
      const d = g.node('cond', 'Fatigue or travel confirmed?', { expr: 'mfa_denied_10m >= 5 || travel_kmh > 900' });
      const a = g.gate('high', 'Two-person approval');
      const r = g.node('act.idp.revoke');
      const m = g.node('act.idp.mfa');
      const n = g.node('ntf.page', 'Page on-call analyst');
      const tk = g.node('act.itsm.ticket');
      const e = g.node('end', 'Contained');
      const nv = g.node('ntf.chat', 'Ask user to verify', { channel: `${chatOf(c)} direct message to the user` });
      const ev = g.node('end', 'Closed: user verified', { outcome: 'Close as benign (user verified)' });
      const ex = g.node('end', 'Escalated to analyst', { outcome: 'Escalate to analyst queue' });
      g.chain(t, e1, e2, d);
      g.link(d, a, 'yes');
      g.link(d, nv, 'no');
      g.link(nv, ev);
      g.link(a, r, 'yes');
      g.link(a, ex, 'no');
      g.chain(r, m, n, tk, e);
    },
  });
  out.push({
    key: 'ransom', name: 'Ransomware precursor containment', category: 'Endpoint', volume: 36, manualMttr: 95, autoClosed: [22, 38],
    summary: `Catches ${c.vocab.threatActors[0] ?? 'ransomware'}-style precursors (shadow-copy deletion, mass rename, C2 beacons) and contains the host after two approvals.`,
    build: (g) => {
      const t = g.node('trg.edr', 'Ransomware precursor', { alert: 'Shadow copy deletion or mass rename' });
      const e1 = g.node('enr.edr');
      const e2 = g.node('enr.asset');
      const e3 = g.node('enr.intel', 'C2 and hash reputation');
      const d = g.node('cond', 'Precursor confirmed?', { expr: 'behaviour in ["vss_delete","mass_rename","c2_beacon"] && confidence >= 85' });
      const a = g.gate('high', 'Two-person approval');
      const ch = g.node('act.edr.contain');
      const ioc = g.node('act.edr.ioc');
      const fw = g.node('act.fw.block', 'Block C2 address');
      const pg = g.node('ntf.page');
      const tk = g.node('act.itsm.ticket', 'Major incident ticket');
      const e = g.node('end', 'Contained');
      const tk2 = g.node('act.itsm.ticket', 'Ticket for analyst review');
      const e2b = g.node('end', 'Queued for analyst', { outcome: 'Escalate to analyst queue' });
      g.chain(t, e1, e2, e3, d);
      g.link(d, a, 'yes');
      g.link(d, tk2, 'no');
      g.link(tk2, e2b);
      g.link(a, ch, 'yes');
      g.link(a, tk2, 'no');
      g.chain(ch, ioc, fw, pg, tk, e);
    },
  });
  out.push({
    key: 'leak', name: 'Leaked credential reset', category: 'Identity', volume: 64, manualMttr: 45, autoClosed: [70, 86],
    summary: 'When HexaInt finds a corporate credential in a breach dump or stealer log, it resets the password and re-enrols MFA.',
    build: (g) => {
      const t = g.node('trg.intel', 'Credential in leak or stealer log', { match: 'Leaked credential' });
      const e1 = g.node('enr.identity');
      const d = g.node('cond', 'Still valid?', { expr: 'account.enabled && password_last_set < leak.first_seen' });
      const a = g.gate('medium', 'Approve reset', AUTO_RULES[1]);
      const r = g.node('act.idp.reset');
      const m = g.node('act.idp.mfa');
      const n = g.node('ntf.chat', 'Tell user and manager', { channel: 'Email to user and line manager' });
      const e = g.node('end', 'Credential reset');
      const eb = g.node('end', 'Closed: already rotated', { outcome: 'Close as no action needed' });
      g.chain(t, e1, d);
      g.link(d, a, 'yes');
      g.link(d, eb, 'no');
      g.link(a, r, 'yes');
      g.link(a, eb, 'no');
      g.chain(r, m, n, e);
    },
  });
  out.push({
    key: 'oauth', name: 'Malicious OAuth app consent', category: 'Identity', volume: 18, manualMttr: 80, autoClosed: [30, 45],
    summary: 'Detects consent to unverified apps with mail or file scopes, revokes the grant and the user sessions.',
    build: (g) => {
      const t = g.node('trg.siem', 'Consent to unverified app', { rule: 'HV - Consent grant with Mail.Read / Files.ReadWrite.All' });
      const e1 = g.node('enr.identity');
      const e2 = g.node('enr.intel', 'App publisher reputation');
      const d = g.node('cond', 'Risky publisher?', { expr: 'publisher.verified == false && scopes.high_risk >= 1' });
      const a = g.gate('high', 'Two-person approval');
      const o = g.node('act.idp.oauth');
      const r = g.node('act.idp.revoke');
      const tk = g.node('act.itsm.ticket');
      const e = g.node('end', 'Grant removed');
      const eb = g.node('end', 'Closed: allowed app', { outcome: 'Close as benign' });
      g.chain(t, e1, e2, d);
      g.link(d, a, 'yes');
      g.link(d, eb, 'no');
      g.link(a, o, 'yes');
      g.link(a, tk, 'no');
      g.chain(o, r, tk, e);
    },
  });
  out.push({
    key: 'exfil', name: 'Data exfiltration via DLP', category: 'Data', volume: 52, manualMttr: 110, autoClosed: [35, 52],
    summary: `Correlates DLP hits with identity and SIEM context, blocks the destination and alerts ${p.grcLead.name.split(' ')[0]}'s team when personal or crown-jewel data is involved.`,
    build: (g) => {
      const t = g.node('trg.dlp');
      const e1 = g.node('enr.identity');
      const e2 = g.node('enr.siem', 'Uploads and shares (7 days)');
      const d = g.node('cond', 'Bulk and unsanctioned?', { expr: 'volume_gb > 2 && destination.sanctioned == false' });
      const a = g.gate('medium', 'Approve block');
      const u = g.node('act.sase.url', 'Block destination');
      const n = g.node('ntf.chat', `Notify ${p.grcLead.role}`, { channel: `${p.grcLead.name} · privacy and GRC` });
      const tk = g.node('act.itsm.ticket');
      const e = g.node('end', 'Blocked and handed to GRC');
      const eb = g.node('end', 'Closed: sanctioned transfer', { outcome: 'Close as benign' });
      g.chain(t, e1, e2, d);
      g.link(d, a, 'yes');
      g.link(d, eb, 'no');
      g.link(a, u, 'yes');
      g.link(a, tk, 'no');
      g.chain(u, n, tk, e);
    },
  });
  out.push({
    key: 'insider', name: 'Insider risk: leaver data hoarding', category: 'Data', volume: 9, manualMttr: 240, autoClosed: [10, 22], status: 'paused',
    summary: 'Leavers who mass-download sensitive files are held for HR confirmation, then the account is disabled with two approvals.',
    build: (g) => {
      const t = g.node('trg.siem', 'Leaver mass download', { rule: 'HV - Leaver downloads > 500 files' });
      const e1 = g.node('enr.identity', 'HR status and access');
      const e2 = g.node('enr.pam');
      const w = g.node('wait', 'Wait for HR confirmation', { duration: '30 min or HR acknowledgement' });
      const d = g.node('cond', 'HR confirms risk?', { expr: 'hr.confirmed == true' });
      const a = g.gate('high', 'Two-person approval');
      const dis = g.node('act.idp.disable');
      const n = g.node('ntf.chat', 'Notify HR and legal', { channel: 'HR business partner and legal (private channel)' });
      const e = g.node('end', 'Account disabled');
      const eb = g.node('end', 'Closed: no action', { outcome: 'Close as benign' });
      g.chain(t, e1, e2, w, d);
      g.link(d, a, 'yes');
      g.link(d, eb, 'no');
      g.link(a, dis, 'yes');
      g.link(a, eb, 'no');
      g.chain(dis, n, e);
    },
  });
  out.push({
    key: 'vuln', name: 'Exploited vulnerability on internet-facing asset', category: 'Exposure', volume: 26, manualMttr: 1440, autoClosed: [40, 60],
    summary: 'KEV-listed exposure on an internet-facing asset: blocks known exploit sources at the edge and opens a patch ticket with the owner.',
    build: (g) => {
      const t = g.node('trg.vuln');
      const e1 = g.node('enr.asset');
      const e2 = g.node('enr.intel', 'Exploitation in the wild');
      const d = g.node('cond', 'Actively exploited?', { expr: 'kev == true && internet_facing && epss >= 0.5' });
      const a = g.gate('medium', 'Approve edge block', AUTO_RULES[2]);
      const fw = g.node('act.fw.block', 'Block exploit sources');
      const tk = g.node('act.itsm.ticket', 'Emergency patch ticket');
      const n = g.node('ntf.chat', 'Notify asset owner');
      const e = g.node('end', 'Mitigated, patch tracked');
      const tk2 = g.node('act.itsm.ticket', 'Standard patch ticket');
      const e2b = g.node('end', 'Patch in normal cycle', { outcome: 'Close as tracked in ITSM' });
      g.chain(t, e1, e2, d);
      g.link(d, a, 'yes');
      g.link(d, tk2, 'no');
      g.link(tk2, e2b);
      g.link(a, fw, 'yes');
      g.link(a, tk, 'no');
      g.chain(fw, tk, n, e);
    },
  });
  if (ot.length) {
    const otName = c.vocab.otSystems[0] ?? 'OT asset';
    out.push({
      key: 'ot', name: 'OT anomaly: notify and ticket only', category: 'OT', volume: 22, manualMttr: 180, autoClosed: [0, 0], tenants: otTenants.length ? otTenants : 'all',
      summary: `Alerts on ${otName} and other OT assets reach ${p.otLead?.name ?? 'the OT lead'} and a ticket in seconds. HexaView never writes to OT; site engineers act under the OT playbook.`,
      build: (g) => {
        const t = g.node('trg.ot');
        const e1 = g.node('enr.ot');
        const e2 = g.node('enr.asset', 'Change window and owner');
        const d = g.node('cond', 'Safety zone or unplanned change?', { expr: 'zone.safety_relevant || change.outside_window' });
        const tk = g.node('act.itsm.ticket', 'P1 ticket for site engineering');
        const n = g.node('ntf.page', 'Page OT lead and site engineer', { who: `${p.otLead?.name ?? 'OT lead'} and the site engineer on duty` });
        const w = g.node('wait', 'Wait for engineer acknowledgement', { duration: '15 min, then escalate' });
        const e = g.node('end', 'Handed to site engineering', { outcome: 'Hand over to OT playbook (manual)' });
        const tk2 = g.node('act.itsm.ticket', 'P3 ticket for review');
        const e2b = g.node('end', 'Logged for OT review', { outcome: 'Close as tracked in ITSM' });
        g.chain(t, e1, e2, d);
        g.link(d, tk, 'yes');
        g.link(d, tk2, 'no');
        g.link(tk2, e2b);
        g.chain(tk, n, w, e);
      },
    });
  }

  // Regulatory clocks chosen from the customer's frameworks.
  const regs = REG_CLOCKS.filter((r) => r.re.test(fwText)).slice(0, 2);
  if (!regs.length) regs.push({ re: /./, name: 'Regulatory notification clock', regime: 'Applicable regulator', deadline: '72 h', cond: 'severity == "major"' });
  regs.forEach((rc, i) => {
    out.push({
      key: `reg-${i}`, name: rc.name, category: 'Regulatory', volume: 4, manualMttr: 300, autoClosed: [0, 10], status: i === 1 ? 'review' : undefined,
      summary: `Classifies major incidents against ${rc.regime}, starts the clock (${rc.deadline}) in HexaComply and briefs ${p.ciso.name}.`,
      build: (g) => {
        const t = g.node('trg.siem', 'Major incident declared', { rule: 'HexaSOC incident severity = Critical' });
        const e1 = g.node('enr.asset', 'Affected business services');
        const d = g.node('cond', 'Meets reporting threshold?', { expr: rc.cond });
        const cl = g.node('ntf.clock', undefined, { regime: rc.regime, deadline: rc.deadline });
        const n = g.node('ntf.page', `Brief ${p.ciso.role}`, { who: `${p.ciso.name} and ${p.grcLead.name}` });
        const tk = g.node('act.itsm.ticket', 'Regulatory filing task');
        const e = g.node('end', 'Clock running', { outcome: 'Hand over to incident commander' });
        const eb = g.node('end', 'Below threshold (recorded)', { outcome: 'Record classification rationale' });
        g.chain(t, e1, d);
        g.link(d, cl, 'yes');
        g.link(d, eb, 'no');
        g.chain(cl, n, tk, e);
      },
    });
  });

  // Sector-specific playbooks.
  if (/maritime|port|shipping/i.test(sector)) {
    out.push({
      key: 'sec-vessel', name: 'Vessel remote access outside change window', category: 'Sector', volume: 14, manualMttr: 90, autoClosed: [20, 35],
      summary: 'Vendor remote sessions to vessels outside an approved window are terminated at the PAM jump host. The vessel network itself is never touched.',
      build: (g) => {
        const t = g.node('trg.siem', 'Vessel remote session outside window', { rule: 'HV-T1133-VSL-REMOTE' });
        const e1 = g.node('enr.pam');
        const e2 = g.node('enr.ot', 'Vessel zone context');
        const d = g.node('cond', 'No approved change?', { expr: 'change_ticket == null && vendor_session.active' });
        const a = g.gate('high', 'Two-person approval');
        const x = g.node('act.pam.terminate');
        const n = g.node('ntf.page', 'Notify master and OT lead', { who: `Vessel master and ${p.otLead?.name ?? 'OT lead'}` });
        const tk = g.node('act.itsm.ticket');
        const e = g.node('end', 'Session ended');
        const eb = g.node('end', 'Closed: approved change', { outcome: 'Close as benign' });
        g.chain(t, e1, e2, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, x, 'yes');
        g.link(a, tk, 'no');
        g.chain(x, n, tk, e);
      },
    });
  } else if (/financ|bank/i.test(sector)) {
    out.push({
      key: 'sec-card', name: 'Card-testing bot burst', category: 'Sector', volume: 30, manualMttr: 75, autoClosed: [55, 70],
      summary: 'Bursts of low-value authorisations from rotating IPs are blocked at the edge and the fraud team is paged.',
      build: (g) => {
        const t = g.node('trg.siem', 'Card-testing burst', { rule: 'HV - Auth failures > 300/min on card switch' });
        const e1 = g.node('enr.intel', 'Bot infrastructure reputation');
        const d = g.node('cond', 'Bot pattern?', { expr: 'decline_rate > 0.85 && distinct_ips > 40' });
        const a = g.gate('medium', 'Approve edge block', AUTO_RULES[2]);
        const u = g.node('act.sase.url', 'Block bot C2 domain');
        const ioc = g.node('act.edr.ioc');
        const n = g.node('ntf.page', 'Page fraud operations', { who: 'Fraud operations duty manager' });
        const e = g.node('end', 'Blocked');
        const eb = g.node('end', 'Closed: genuine traffic', { outcome: 'Close as benign' });
        g.chain(t, e1, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, u, 'yes');
        g.link(a, n, 'no');
        g.chain(u, ioc, n, e);
      },
    });
  } else if (/media|entertain|film|studio/i.test(sector)) {
    out.push({
      key: 'sec-leak', name: 'Pre-release leak: watermark hit', category: 'Sector', volume: 6, manualMttr: 360, autoClosed: [0, 15],
      summary: `A forensic watermark match on leaked ${c.vocab.custodyLabel || 'content'} revokes the supplier's access and starts the studio notification.`,
      build: (g) => {
        const t = g.node('trg.custody');
        const e1 = g.node('enr.identity', 'Session and supplier context');
        const d = g.node('cond', 'Watermark traced to a session?', { expr: 'watermark.match_confidence >= 0.95' });
        const a = g.gate('high', 'Two-person approval');
        const r = g.node('act.custody.revoke');
        const n = g.node('ntf.page', 'Brief content security', { who: `${p.grcLead.name} (${p.grcLead.role})` });
        const tk = g.node('act.itsm.ticket');
        const e = g.node('end', 'Access revoked');
        const eb = g.node('end', 'Closed: no trace', { outcome: 'Record and monitor' });
        g.chain(t, e1, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, r, 'yes');
        g.link(a, tk, 'no');
        g.chain(r, n, tk, e);
      },
    });
  } else if (/health|hospital/i.test(sector)) {
    out.push({
      key: 'sec-helpdesk', name: 'Help-desk MFA reset abuse', category: 'Sector', volume: 12, manualMttr: 120, autoClosed: [15, 30],
      summary: 'An MFA method added after a help-desk reset, followed by remote access, is treated as account takeover.',
      build: (g) => {
        const t = g.node('trg.identity', 'MFA method added after reset', { signal: 'New authenticator within 1 h of help-desk reset' });
        const e1 = g.node('enr.siem', 'Remote access after reset');
        const e2 = g.node('enr.identity');
        const d = g.node('cond', 'Remote sign-in follows?', { expr: 'citrix_or_vpn_signin_within_2h && new_device' });
        const a = g.gate('high', 'Two-person approval');
        const r = g.node('act.idp.revoke');
        const m = g.node('act.idp.mfa');
        const n = g.node('ntf.page');
        const e = g.node('end', 'Account recovered');
        const eb = g.node('end', 'Closed: verified reset', { outcome: 'Close as benign' });
        g.chain(t, e1, e2, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, r, 'yes');
        g.link(a, n, 'no');
        g.chain(r, m, n, e);
      },
    });
    out.push({
      key: 'sec-ehr', name: 'EHR privacy: VIP record access', category: 'Sector', volume: 40, manualMttr: 200, autoClosed: [50, 65], status: 'draft',
      summary: 'Unexplained access to VIP or employee patient records goes to the privacy office with the access trail. No write-back.',
      build: (g) => {
        const t = g.node('trg.dlp', 'VIP or co-worker record opened', { policy: 'Access to flagged patient record without care relationship' });
        const e1 = g.node('enr.identity', 'Clinician role and department');
        const d = g.node('cond', 'No care relationship?', { expr: 'care_team.contains(user) == false' });
        const n = g.node('ntf.chat', 'Notify privacy office', { channel: `${p.grcLead.name} (${p.grcLead.role})` });
        const tk = g.node('act.itsm.ticket', 'Privacy investigation case');
        const e = g.node('end', 'With privacy office');
        const eb = g.node('end', 'Closed: care relationship', { outcome: 'Close as benign' });
        g.chain(t, e1, d);
        g.link(d, n, 'yes');
        g.link(d, eb, 'no');
        g.chain(n, tk, e);
      },
    });
  } else if (/auto|vehicle/i.test(sector)) {
    const vsoc = c.connectors.find((k) => /vehicle|vsoc/i.test(k.product));
    out.push({
      key: 'sec-vsoc', name: 'Vehicle SOC anomaly on OTA campaign', category: 'Sector', volume: 8, manualMttr: 260, autoClosed: [0, 10],
      summary: 'vSOC anomalies during an OTA campaign reach product security and the campaign owner. HexaView never writes to vehicles or OTA services.',
      build: (g) => {
        const t = g.node('trg.siem', 'vSOC anomaly during OTA', { rule: 'Fleet anomaly: ECU flash failures above baseline' }, vsoc ? { tool: vsoc.id } : {});
        const e1 = g.node('enr.asset', 'OTA campaign and model lines');
        const d = g.node('cond', 'Above fleet threshold?', { expr: 'vehicles_affected > 50 || signature_mismatch' });
        const n = g.node('ntf.page', 'Page product security (PSIRT)', { who: 'Vehicle PSIRT duty officer and OTA campaign owner' });
        const tk = g.node('act.itsm.ticket', 'PSIRT case');
        const e = g.node('end', 'With PSIRT', { outcome: 'Hand over to PSIRT (manual campaign hold)' });
        const eb = g.node('end', 'Within baseline', { outcome: 'Record and monitor' });
        g.chain(t, e1, d);
        g.link(d, n, 'yes');
        g.link(d, eb, 'no');
        g.chain(n, tk, e);
      },
    });
    out.push({
      key: 'sec-supplier', name: 'Supplier remote session into plant', category: 'Sector', volume: 16, manualMttr: 85, autoClosed: [20, 32], status: 'paused',
      summary: 'Robot and line suppliers connecting through PAM outside a change window: the PAM session is ended; plant OT is not touched.',
      build: (g) => {
        const t = g.node('trg.siem', 'Supplier session outside window', { rule: 'HV - PAM vendor session without change' });
        const e1 = g.node('enr.pam');
        const d = g.node('cond', 'No approved change?', { expr: 'change_ticket == null' });
        const a = g.gate('high', 'Two-person approval');
        const x = g.node('act.pam.terminate');
        const n = g.node('ntf.page', 'Notify plant OT lead', { who: p.otLead?.name ?? 'Plant OT lead' });
        const e = g.node('end', 'Session ended');
        const eb = g.node('end', 'Closed: approved change', { outcome: 'Close as benign' });
        g.chain(t, e1, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, x, 'yes');
        g.link(a, n, 'no');
        g.chain(x, n, e);
      },
    });
  } else if (/defen[cs]e|aerospace/i.test(sector)) {
    out.push({
      key: 'sec-cui', name: 'CUI upload to unapproved cloud', category: 'Sector', volume: 11, manualMttr: 150, autoClosed: [15, 30],
      summary: 'CUI or export-controlled files heading to non-FedRAMP destinations are blocked and the Facility Security Officer is briefed for the DFARS clock.',
      build: (g) => {
        const t = g.node('trg.dlp', 'CUI file to unapproved cloud', { policy: 'CUI / ITAR marking to non-FedRAMP destination' });
        const e1 = g.node('enr.identity', 'Person and export-control status');
        const d = g.node('cond', 'Controlled and unapproved?', { expr: 'file.marking in ["CUI","ITAR"] && destination.fedramp == false' });
        const a = g.gate('medium', 'Approve block');
        const u = g.node('act.sase.url', 'Block destination');
        const n = g.node('ntf.page', 'Brief the FSO', { who: `Facility Security Officer and ${p.grcLead.name}` });
        const tk = g.node('act.itsm.ticket');
        const e = g.node('end', 'Blocked, FSO briefed');
        const eb = g.node('end', 'Closed: approved transfer', { outcome: 'Close as benign' });
        g.chain(t, e1, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, u, 'yes');
        g.link(a, n, 'no');
        g.chain(u, n, tk, e);
      },
    });
  } else if (/pharma|life scien|biotech/i.test(sector)) {
    out.push({
      key: 'sec-gxp', name: 'GxP audit trail tampering', category: 'Sector', volume: 7, manualMttr: 300, autoClosed: [0, 12],
      summary: 'Audit trails disabled or edited on GxP systems open a deviation for Quality and page the system owner. Lab and manufacturing systems are never written to.',
      build: (g) => {
        const t = g.node('trg.siem', 'GxP audit trail changed', { rule: 'HV - Audit trail disabled or edited on validated system' });
        const e1 = g.node('enr.asset', 'Validated system and owner');
        const d = g.node('cond', 'Outside change control?', { expr: 'change_control.approved == false' });
        const n = g.node('ntf.page', 'Page QA and system owner', { who: `Quality assurance duty lead and ${p.otLead?.name ?? p.admin.name}` });
        const tk = g.node('act.itsm.ticket', 'Deviation / CAPA record');
        const e = g.node('end', 'With Quality', { outcome: 'Hand over to Quality (Annex 11 / Part 11)' });
        const eb = g.node('end', 'Within change control', { outcome: 'Record and monitor' });
        g.chain(t, e1, d);
        g.link(d, n, 'yes');
        g.link(d, eb, 'no');
        g.chain(n, tk, e);
      },
    });
  } else if (/insur/i.test(sector)) {
    out.push({
      key: 'sec-policy', name: 'Bulk policyholder data access', category: 'Sector', volume: 15, manualMttr: 160, autoClosed: [25, 40],
      summary: 'Claims or underwriting users exporting thousands of policyholder records lose their sessions pending review; privacy is briefed for NYDFS / GLBA.',
      build: (g) => {
        const t = g.node('trg.dlp', 'Bulk policyholder export', { policy: 'Export of > 5,000 policyholder records' });
        const e1 = g.node('enr.identity', 'Role and recent access');
        const e2 = g.node('enr.siem', 'Exports and shares (7 days)');
        const d = g.node('cond', 'Outside role baseline?', { expr: 'records_exported > baseline_p99 && !ticket_reference' });
        const a = g.gate('high', 'Two-person approval');
        const r = g.node('act.idp.revoke');
        const n = g.node('ntf.chat', 'Notify privacy office', { channel: `${p.grcLead.name} (${p.grcLead.role})` });
        const tk = g.node('act.itsm.ticket');
        const e = g.node('end', 'Sessions revoked, under review');
        const eb = g.node('end', 'Closed: business need', { outcome: 'Close as benign' });
        g.chain(t, e1, e2, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, r, 'yes');
        g.link(a, n, 'no');
        g.chain(r, n, tk, e);
      },
    });
  } else {
    out.push({
      key: 'sec-pam', name: 'Suspicious privileged session', category: 'Sector', volume: 14, manualMttr: 90, autoClosed: [20, 35],
      summary: 'Privileged sessions from unusual locations are terminated at the PAM jump host after two approvals.',
      build: (g) => {
        const t = g.node('trg.siem', 'Unusual privileged session', { rule: 'HV - Privileged session from new ASN' });
        const e1 = g.node('enr.pam');
        const d = g.node('cond', 'Unapproved?', { expr: 'change_ticket == null' });
        const a = g.gate('high', 'Two-person approval');
        const x = g.node('act.pam.terminate');
        const e = g.node('end', 'Session ended');
        const eb = g.node('end', 'Closed: approved', { outcome: 'Close as benign' });
        g.chain(t, e1, d);
        g.link(d, a, 'yes');
        g.link(d, eb, 'no');
        g.link(a, x, 'yes');
        g.link(a, eb, 'no');
        g.link(x, e);
      },
    });
  }

  // A draft with deliberate gaps so validation has something to say.
  out.push({
    key: 'lateral', name: 'Auto-contain lateral movement', category: 'Endpoint', volume: 0, manualMttr: 120, autoClosed: [0, 0], status: 'draft',
    summary: 'Work in progress: contains hosts that fan out over SMB / WinRM. Not yet gated; validation blocks submission.',
    build: (g) => {
      const t = g.node('trg.siem', 'Lateral movement fan-out', { rule: 'HV - SMB/WinRM to > 15 hosts in 10 min' });
      const e1 = g.node('enr.edr');
      const d = g.node('cond', 'Fan-out confirmed?', { expr: 'distinct_targets > 15 && account.is_service == false' });
      const ch = g.node('act.edr.contain');
      const tk = g.node('act.itsm.ticket');
      const e = g.node('end', 'Contained');
      g.node('ntf.page', 'Page on-call (not wired)');
      g.chain(t, e1, d);
      g.link(d, ch, 'yes');
      g.chain(ch, tk, e);
    },
  });
  return out;
}

/* =====================================================================
   Library
   ===================================================================== */
export function playbookLibrary(c: CustomerProfile): Playbook[] {
  const r = rng(`playbooks-${c.id}`);
  const size = Math.min(2.2, Math.max(0.5, Math.sqrt(c.employees / 9000)));
  const editors = [c.people.socLead.name, c.people.admin.name, ...c.people.staff.slice(0, 3).map((s) => s.name)];
  return templates(c).map((t, i) => {
    const g = new G(c);
    t.build(g);
    const nodes = autoLayout(g.nodes, g.edges);
    const status: PbStatus = t.status ?? 'active';
    const runs30 = status === 'draft' || status === 'review' ? 0 : Math.max(1, Math.round(t.volume * size * r.float(0.7, 1.3, 2) * (status === 'paused' ? 0.4 : 1)));
    const manualSum = nodes.reduce((s, n) => s + (OP[n.op]?.manualMin ?? 0), 0);
    const version = status === 'draft' ? 1 : r.int(2, 9);
    const by = t.category === 'OT' ? c.people.otLead?.name ?? editors[0] : t.category === 'Regulatory' ? c.people.grcLead.name : r.pick(editors);
    const editedMinAgo = r.int(60, 60 * 24 * 40);
    const notes = ['Initial version', 'Added threat intel enrichment', 'Tightened condition after false positives', 'Moved containment behind two-person gate', 'Ticket now carries evidence pack', 'Added benign auto-close branch', 'Re-pointed notify to new channel', 'Raised confidence threshold to 85', 'Added on-call page for out-of-hours'];
    const versions: PbVersion[] = Array.from({ length: version }, (_, v) => ({
      v: v + 1,
      by: v === version - 1 ? by : r.pick(editors),
      minAgo: editedMinAgo + (version - 1 - v) * r.int(1440 * 5, 1440 * 30),
      note: v === 0 ? 'Initial version' : notes[1 + ((v + i) % (notes.length - 1))],
    })).reverse();
    return {
      id: `PB-${String(101 + i)}`,
      name: t.name,
      category: t.category,
      summary: t.summary,
      status,
      tenants: t.tenants ?? 'all',
      runs30,
      autoClosedPct: t.autoClosed[1] === 0 ? 0 : r.int(t.autoClosed[0], t.autoClosed[1]),
      medianSavedMin: Math.max(4, Math.round(manualSum * r.float(0.55, 0.8, 2))),
      manualMttrMin: Math.round(t.manualMttr * r.float(0.85, 1.2, 2)),
      autoMttrMin: Math.max(2, Math.round(t.manualMttr * r.float(0.08, 0.3, 2))),
      editedBy: by,
      editedMinAgo,
      version,
      versions,
      nodes,
      edges: g.edges,
      dirty: status === 'draft' || status === 'review',
      submittedBy: status === 'review' ? by : undefined,
    };
  });
}

/* =====================================================================
   Runs
   ===================================================================== */
export type RunStatus = 'success' | 'failed' | 'awaiting' | 'denied';
export interface RunAction {
  label: string;
  tool: string;
  state: 'Verified' | 'Applied' | 'PendingApproval' | 'Failed' | 'RolledBack' | 'Rejected' | 'PolicyDenied';
  risk: PbRisk;
}
export interface PbRun {
  id: string;
  pbId: string;
  pbName: string;
  category: PbCategory;
  minAgo: number;
  at?: number;
  status: RunStatus;
  entity: string;
  tenantId: string;
  durationSec: number;
  savedMin: number;
  approvers: string[];
  actions: RunAction[];
  note: string;
  autoClosed: boolean;
  test?: boolean;
}

function entityFor(c: CustomerProfile, cat: PbCategory, r: Rng): string {
  const staff = c.people.staff.length ? c.people.staff : [c.people.socLead];
  const user = r.pick(staff);
  const host = `${c.vocab.hostPrefix}-${r.pick(['WS', 'LT', 'SRV', 'VDI'])}${r.int(100, 999)}`;
  switch (cat) {
    case 'Email': return `"${r.pick(['Invoice overdue', 'Shared document', 'DocuSign: action required', 'Payroll update', 'Voicemail received'])}" to ${r.int(2, 140)} recipients`;
    case 'Identity': return user.email;
    case 'Endpoint': return host;
    case 'Data': return `${user.name} → ${r.pick(['mega.nz', 'personal Google Drive', 'wetransfer.com', 'USB mass storage'])}`;
    case 'Exposure': return `${r.pick(c.vocab.externalHosts.length ? c.vocab.externalHosts : [`vpn.${c.domain}`])} · CVE-${r.pick(['2024-3400', '2023-4966', '2024-21762', '2023-46805', '2024-1709'])}`;
    case 'OT': return r.pick(c.vocab.otSystems.length ? c.vocab.otSystems : ['OT asset']);
    case 'Regulatory': return `MI-2026-0${r.int(10, 40)}`;
    default: return r.chance(0.5) ? user.email : host;
  }
}

export function playbookRuns(c: CustomerProfile, pbs: Playbook[], n = 90): PbRun[] {
  const r = rng(`playbooks-runs-${c.id}`);
  const live = pbs.filter((p) => p.runs30 > 0);
  if (!live.length) return [];
  const approverPool = [c.people.socLead.name, c.people.admin.name];
  const runs: PbRun[] = [];
  let seq = 48210;
  for (let i = 0; i < n; i++) {
    seq -= r.int(1, 9);
    const pb = r.weighted(live.map((p) => [p, p.runs30] as const));
    const minAgo = Math.round((i / n) ** 1.35 * 30 * 1440) + r.int(3, 50);
    const tenants = pb.tenants === 'all' ? c.tenants.map((t) => t.id) : pb.tenants;
    const tenantId = r.pick(tenants.length ? tenants : c.tenants.map((t) => t.id));
    const gate = approvalsRequired(pb);
    const acts = pb.nodes.filter((x) => x.kind === 'action');
    const benign = r.chance(pb.autoClosedPct / 100);
    let status: RunStatus = r.weighted<RunStatus>([['success', 90], ['failed', 4], ['denied', 3]]);
    if (minAgo < 720 && gate > 0 && !benign && pb.status === 'active' && r.chance(0.6)) status = 'awaiting';
    const state = (a: PbNode): RunAction['state'] => {
      const risk = OP[a.op]?.risk ?? 'low';
      if (status === 'awaiting') return risk === 'low' ? 'Verified' : 'PendingApproval';
      if (status === 'denied') return risk === 'low' ? 'Verified' : 'Rejected';
      if (status === 'failed') return risk === 'low' ? 'Verified' : r.chance(0.5) ? 'Failed' : 'RolledBack';
      return 'Verified';
    };
    const actions: RunAction[] = (benign ? acts.filter((a) => OP[a.op]?.risk === 'low').slice(0, 1) : acts).map((a) => ({
      label: a.label,
      tool: c.connectors.find((k) => k.id === a.tool)?.product ?? 'Not connected',
      state: state(a),
      risk: OP[a.op]?.risk ?? 'low',
    }));
    const needApproval = !benign && actions.some((a) => a.risk !== 'low');
    runs.push({
      id: `RUN-${String(seq).padStart(5, '0')}`,
      pbId: pb.id,
      pbName: pb.name,
      category: pb.category,
      minAgo,
      status,
      entity: entityFor(c, pb.category, r),
      tenantId,
      durationSec: status === 'awaiting' ? 0 : r.int(18, 95) + (needApproval ? r.int(120, 900) : 0),
      savedMin: status === 'success' ? Math.round(pb.medianSavedMin * r.float(0.7, 1.3, 2)) : status === 'failed' ? Math.round(pb.medianSavedMin * 0.3) : 0,
      approvers: needApproval && status !== 'awaiting' ? approverPool.slice(0, gate) : [],
      actions,
      note:
        status === 'failed' ? r.pick(['Verify failed: post-condition not met, rolled back automatically', 'Dispatch expired: data-plane heartbeat lost for 6 min', 'Connector returned 429 rate limit; retried 3 times'])
          : status === 'denied' ? `Approver declined: ${r.pick(['business-critical host during trading hours', 'user already verified by phone', 'change ticket found after the fact'])}`
            : status === 'awaiting' ? `Waiting for ${gate === 2 ? 'two approvers incl. a Tenant Admin' : 'one approver'} in the Action Centre`
              : benign ? 'Closed as benign by the playbook' : 'All write-backs verified',
      autoClosed: status === 'success' && benign,
    });
  }
  return runs.sort((a, b) => a.minAgo - b.minAgo);
}

/* =====================================================================
   Validation
   ===================================================================== */
export interface Issue {
  id: string;
  level: 'error' | 'warn';
  text: string;
  nodeId?: string;
}

function outgoing(edges: PbEdge[], id: string) {
  return edges.filter((e) => e.from === id);
}

export function validate(c: CustomerProfile, nodes: PbNode[], edges: PbEdge[]): Issue[] {
  const out: Issue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const triggers = nodes.filter((n) => n.kind === 'trigger');
  if (!triggers.length) out.push({ id: 'no-trigger', level: 'error', text: 'No trigger: add a Trigger node to start the playbook' });
  if (triggers.length > 1) out.push({ id: 'multi-trigger', level: 'warn', text: `${triggers.length} triggers: each starts its own run` });
  // Reachability from the trigger(s).
  const reach = new Set<string>();
  const stack = triggers.map((t) => t.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (reach.has(id)) continue;
    reach.add(id);
    outgoing(edges, id).forEach((e) => stack.push(e.to));
  }
  // Reachability without passing an approval (approval nodes only pass on their "denied" port).
  const ungated = new Set<string>();
  const st2 = triggers.map((t) => t.id);
  while (st2.length) {
    const id = st2.pop()!;
    if (ungated.has(id)) continue;
    ungated.add(id);
    const n = byId.get(id);
    outgoing(edges, id).forEach((e) => {
      if (n?.kind === 'approval' && e.port !== 'no') return;
      st2.push(e.to);
    });
  }
  // What each gate covers (downstream of its approved port).
  const covered = new Map<string, PbRisk>();
  nodes.filter((n) => n.kind === 'approval').forEach((gNode) => {
    const seen = new Set<string>();
    const s = outgoing(edges, gNode.id).filter((e) => e.port === 'yes').map((e) => e.to);
    while (s.length) {
      const id = s.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const prev = covered.get(id);
      const risk = gNode.risk ?? 'medium';
      if (!prev || RISK_RANK[risk] > RISK_RANK[prev]) covered.set(id, risk);
      outgoing(edges, id).forEach((e) => s.push(e.to));
    }
  });

  for (const n of nodes) {
    const def = OP[n.op];
    if (!def) continue;
    if (!reach.has(n.id) && n.kind !== 'trigger') out.push({ id: `disc-${n.id}`, level: 'error', nodeId: n.id, text: `Disconnected: "${n.label}" is not reachable from the trigger` });
    if (def.ot || (n.kind === 'action' && n.tool && c.connectors.find((k) => k.id === n.tool && capOf(k) === 'ot'))) {
      out.push({ id: `ot-${n.id}`, level: 'error', nodeId: n.id, text: `OT write blocked: "${n.label}" would write to OT. HexaView is read-only on OT by policy; use a ticket and notify the OT engineer instead` });
      continue;
    }
    if (def.caps) {
      const k = n.tool ? c.connectors.find((x) => x.id === n.tool) : undefined;
      if (!n.tool || !k) {
        const has = toolsFor(c, def.caps).length > 0;
        out.push({ id: `tool-${n.id}`, level: 'error', nodeId: n.id, text: has ? `"${n.label}" has no tool selected` : `"${n.label}" targets ${def.caps.map((x) => CAP_LABEL[x]).join(' / ')}, which ${c.short} has not connected` });
      } else {
        if (k.status !== 'healthy' || isStale(k)) out.push({ id: `deg-${n.id}`, level: 'warn', nodeId: n.id, text: `${k.product} is ${k.status === 'healthy' ? 'stale' : k.status}${k.note ? ` (${k.note})` : ''}: "${n.label}" may be delayed` });
        if (n.kind === 'action' && k.write.length === 0) out.push({ id: `ro-${n.id}`, level: 'warn', nodeId: n.id, text: `Write scope not enabled on ${k.product}: live runs raise an ITSM ticket for this step until it is enabled in Integration Fabric` });
      }
    }
    if (n.kind === 'action' && def.risk && def.risk !== 'low') {
      const gate = covered.get(n.id);
      if (ungated.has(n.id) && reach.has(n.id)) {
        out.push(def.risk === 'high'
          ? { id: `gate-${n.id}`, level: 'error', nodeId: n.id, text: `High-risk action "${n.label}" has no approval gate before it (needs 2 approvers incl. a Tenant Admin)` }
          : { id: `gate-${n.id}`, level: 'warn', nodeId: n.id, text: `Medium-risk action "${n.label}" has no gate: the Action Centre will hold it for one approver` });
      } else if (gate && RISK_RANK[gate] < RISK_RANK[def.risk]) {
        out.push({ id: `gate-${n.id}`, level: def.risk === 'high' ? 'error' : 'warn', nodeId: n.id, text: `"${n.label}" is ${def.risk} risk but its gate only approves ${gate} risk` });
      }
    }
    const outs = outgoing(edges, n.id);
    if (n.kind === 'condition' || n.kind === 'approval') {
      if (!outs.some((e) => e.port === 'yes')) out.push({ id: `yes-${n.id}`, level: 'warn', nodeId: n.id, text: `"${n.label}" has no ${n.kind === 'approval' ? 'approved' : 'yes'} branch` });
      if (!outs.some((e) => e.port === 'no')) out.push({ id: `no-${n.id}`, level: 'warn', nodeId: n.id, text: `"${n.label}" has no ${n.kind === 'approval' ? 'denied' : 'no'} branch` });
    } else if (n.kind !== 'end' && outs.length === 0 && reach.has(n.id)) {
      out.push({ id: `dead-${n.id}`, level: 'warn', nodeId: n.id, text: `Dead end after "${n.label}": add an End node` });
    }
  }
  if (!nodes.some((n) => n.kind === 'end')) out.push({ id: 'no-end', level: 'warn', text: 'No End node: runs will not record an outcome' });
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}

/* =====================================================================
   Layout
   ===================================================================== */
export const NODE_W = 188;
export const NODE_H = 66;
export const GRID = 20;
/** Top-to-bottom layout: depth runs down, branches spread across. */
export const COL_GAP = 224;
export const ROW_GAP = 116;

export function autoLayout(nodes: PbNode[], edges: PbEdge[]): PbNode[] {
  const ids = nodes.map((n) => n.id);
  const incoming = new Map(ids.map((id) => [id, 0]));
  edges.forEach((e) => incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1));
  const roots = nodes.filter((n) => n.kind === 'trigger' || !incoming.get(n.id)).map((n) => n.id);
  // Longest-path depth (bounded relaxation handles stray cycles).
  const depth = new Map<string, number>(roots.map((id) => [id, 0]));
  for (let iter = 0; iter < nodes.length; iter++) {
    let changed = false;
    for (const e of edges) {
      const d = depth.get(e.from);
      if (d === undefined) continue;
      if ((depth.get(e.to) ?? -1) < d + 1 && d + 1 < nodes.length) {
        depth.set(e.to, d + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Rows by DFS: first child keeps the parent's row, "no" branches drop below.
  const row = new Map<string, number>();
  const used = new Set<string>();
  let maxRow = -1;
  const portOrder: Record<Port, number> = { yes: 0, out: 1, no: 2 };
  const place = (id: string, want: number) => {
    if (row.has(id)) return;
    let rw = want;
    const col = depth.get(id) ?? 0;
    while (used.has(`${col}:${rw}`)) rw++;
    row.set(id, rw);
    used.add(`${col}:${rw}`);
    maxRow = Math.max(maxRow, rw);
    const kids = edges.filter((e) => e.from === id).sort((a, b) => portOrder[a.port] - portOrder[b.port]);
    kids.forEach((e, i) => place(e.to, i === 0 ? rw : maxRow + 1));
  };
  roots.forEach((id) => place(id, maxRow + 1));
  nodes.forEach((n) => {
    if (!row.has(n.id)) {
      depth.set(n.id, depth.get(n.id) ?? 0);
      place(n.id, maxRow + 1);
    }
  });
  return nodes.map((n) => ({ ...n, x: 40 + (row.get(n.id) ?? 0) * COL_GAP, y: 30 + (depth.get(n.id) ?? 0) * ROW_GAP }));
}

/* =====================================================================
   Simulation results (mock values for a test run)
   ===================================================================== */
export type Sample = 'tp' | 'benign';

export function simResult(c: CustomerProfile, node: PbNode, sample: Sample, r: Rng): string {
  const k = c.connectors.find((x) => x.id === node.tool);
  const user = c.people.staff[0] ?? c.people.socLead;
  const host = `${c.vocab.hostPrefix}-WS${r.int(100, 999)}`;
  const actor = c.vocab.threatActors[0] ?? 'Unknown actor';
  const tp = sample === 'tp';
  switch (node.op) {
    case 'trg.siem': case 'trg.edr': case 'trg.identity': case 'trg.email': case 'trg.dlp': case 'trg.intel': case 'trg.vuln': case 'trg.ot': case 'trg.custody':
      return `${k?.product ?? 'Source'} event ${r.hex(8)} · ${node.params.rule ?? node.params.alert ?? node.params.signal ?? node.params.policy ?? node.params.match ?? node.params.filter ?? node.label}`;
    case 'enr.identity': return `${user.email} · ${r.int(3, 14)} groups · MFA: ${tp ? `${r.int(6, 14)} pushes denied in 4 min` : 'FIDO2, no anomalies'}`;
    case 'enr.edr': return `${host} · ${tp ? 'vssadmin.exe delete shadows ← cmd.exe ← winword.exe' : 'signed binaries only'} · ${r.int(1, 6)} related alerts`;
    case 'enr.intel': return tp ? `185.220.${r.int(10, 250)}.${r.int(2, 250)} · ${actor} · confidence ${r.int(88, 98)}` : `No match in HexaInt or ISAC feeds · confidence ${r.int(5, 20)}`;
    case 'enr.asset': return `${c.vocab.crownJewels[0] ?? 'Business service'} · criticality ${tp ? 5 : 2}/5 · owner ${c.people.admin.name}`;
    case 'enr.siem': return `${r.int(40, 900)} related events · ${tp ? `${r.int(2, 9)} hosts touched` : 'single host, expected pattern'}`;
    case 'enr.email': return `${r.int(3, 140)} recipients · ${tp ? `${r.int(1, 9)} clicks` : '0 clicks'} · attachment ${tp ? 'HTML smuggling' : 'none'}`;
    case 'enr.pam': return `${tp ? 'Vendor session live, no change ticket' : 'Session under approved change CHG-' + r.int(10000, 99999)}`;
    case 'enr.ot': return `${c.vocab.otSystems[0] ?? 'OT asset'} · Purdue L${r.int(1, 2)} · ${tp ? 'safety-relevant zone' : 'non-safety zone'} (read-only)`;
    case 'cond': return `${node.params.expr ?? 'expression'} → ${tp ? 'TRUE' : 'FALSE'}`;
    case 'ntf.chat': return `Posted to ${node.params.channel ?? 'channel'}`;
    case 'ntf.page': return `Paged ${node.params.who ?? 'on-call'} · acknowledged in ${r.int(40, 180)} s`;
    case 'ntf.clock': return `Clock started: ${node.params.regime ?? 'regime'} · ${node.params.deadline ?? ''}`;
    case 'wait': return `Waited ${node.params.duration ?? '15 min'} (fast-forwarded in simulation)`;
    case 'end': return node.params.outcome ?? 'Closed';
    default: {
      const def = OP[node.op];
      if (def?.kind === 'action') return `${def.label} on ${k?.product ?? 'tool'} · target ${node.op.startsWith('act.idp') ? user.email : node.op.startsWith('act.email') ? `message ${r.hex(10)}` : node.op.includes('fw') || node.op.includes('sase') ? `185.220.${r.int(10, 250)}.${r.int(2, 250)}` : host}`;
      return 'Done';
    }
  }
}
