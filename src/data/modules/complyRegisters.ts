// HexaComply · Compliance workspace registers (original HexaComply "Compliance" tab):
// Stream (control workflows + training), Drive, risk/asset record detail, the
// governance-side vendor register and the GRC incident register. Everything is
// derived from the customer profile with a seeded RNG, so it is stable per
// customer and tenant and agrees with the compliance chain in comply.ts.
import type { CustomerId, CustomerProfile } from '../types';
import { rng } from '../../lib/rng';
import { scopedConnectors } from '../customers';
import {
  WORKFLOW_QUESTIONS, vendors,
  type ComplyControl, type ComplyTask, type EvidenceItem, type RiskItem, type RegAsset, type DomainId, type CiaLevel,
} from './comply';

/* =====================================================================
   Stream: control workflows (questions that establish each control)
   ===================================================================== */
export type WfState = 'next' | 'progress' | 'done';
export interface WorkflowQ { lead: string; q: string; checks: string[] }
export interface Workflow {
  id: string;
  controlId: string;
  ref: string;
  name: string;
  fwId: string;
  fwShort: string;
  group: string;
  groupName: string;
  domain: DomainId;
  owner: string;
  questions: WorkflowQ[];
  state: WfState;
  /** Questions already answered before this session. */
  answered: number;
}

/** Nine workflows per framework, drawn from its in-scope controls. */
export function streamWorkflows(controls: ComplyControl[]): Workflow[] {
  const out: Workflow[] = [];
  const fwIds = [...new Set(controls.map((x) => x.fwId))];
  for (const fw of fwIds) {
    // A realistic mix per framework: a few waiting, more in progress, some already answered.
    const pool = controls.filter((x) => x.fwId === fw && x.status !== 'Not applicable');
    const take = (s: ComplyControl['status'], n: number) => pool.filter((x) => x.status === s).slice(0, n);
    let list = [...take('Not started', 2), ...take('In progress', 4), ...take('Compliant', 3)];
    if (list.length < 9) list = [...list, ...pool.filter((x) => !list.includes(x)).slice(0, 9 - list.length)];
    list.sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
    for (const x of list) {
      const qs = WORKFLOW_QUESTIONS[x.domain];
      const state: WfState = x.status === 'Compliant' ? 'done' : x.status === 'In progress' ? 'progress' : 'next';
      out.push({
        id: `WF-${x.id}`, controlId: x.id, ref: x.ref, name: x.name, fwId: x.fwId, fwShort: x.fwShort, group: x.group, groupName: x.groupName, domain: x.domain, owner: x.owner,
        questions: qs, state, answered: state === 'done' ? qs.length : state === 'progress' ? 1 : 0,
      });
    }
  }
  return out;
}

/* ---------------- Training assigned to you ---------------- */
export interface CourseStep { title: string; body: string; points?: string[] }
export interface Course { id: string; title: string; kind: 'Mandatory' | 'Role-based'; minutes: number; dueDays: number; done: boolean; audience: string; steps: CourseStep[] }

const SECTOR_COURSES: Record<CustomerId, Omit<Course, 'id' | 'done' | 'dueDays'>[]> = {
  maritime: [
    { title: 'Cyber risk on board: IMO MSC.428 for officers', kind: 'Role-based', minutes: 12, audience: 'Deck and engine officers', steps: [
      { title: 'Why the SMS covers cyber', body: 'Since 2021 cyber risk must be addressed in the Safety Management System. Port State Control can ask to see how.', points: ['DoC verification includes cyber', 'The Master can stop operations'] },
      { title: 'ECDIS and bridge systems', body: 'Chart updates arrive on USB or over VSAT. Only use the scanned kiosk on board, never a personal stick.' },
      { title: 'Spotting GNSS / AIS spoofing', body: 'Positions that jump, ships appearing inland or a sudden loss of fix are signs. Cross-check with radar and log it.', points: ['Note time and position', 'Report to the DPA'] },
      { title: 'Reporting from sea', body: 'If something looks wrong, call the fleet duty officer. Store-and-forward links mean we may not see it ashore for 30 minutes.' },
    ] },
    { title: 'Vendor remote access to crane and terminal OT', kind: 'Role-based', minutes: 9, audience: 'Terminal engineering', steps: [
      { title: 'One way in', body: 'Vendors such as Konecranes connect only through the PAM jump host, per session, with an approved ticket.' },
      { title: 'Approving a session', body: 'Check the change window, the crane affected and that a local engineer is watching the session.', points: ['Ticket reference', 'Named engineer', 'Time limit'] },
      { title: 'During and after', body: 'Sessions are recorded. Revoke the session when the work ends; do not leave it open for the next shift.' },
      { title: 'When to stop a session', body: 'Unexpected logic downloads or PLC mode changes mean you end the session and call OT security.' },
    ] },
  ],
  finserv: [
    { title: 'DORA incident classification and reporting clocks', kind: 'Role-based', minutes: 11, audience: 'Operations and resilience staff', steps: [
      { title: 'What counts as major', body: 'DORA classifies ICT incidents by clients affected, duration, geography, data loss, criticality and economic impact.' },
      { title: 'The clocks', body: 'Initial notification within 4 hours of classification (and no later than 24 hours from detection), intermediate within 72 hours, final within a month.', points: ['4 h initial', '72 h intermediate', '1 month final'] },
      { title: 'Who decides', body: 'The incident manager proposes; the Head of Operational Resilience confirms the classification and signs the submission.' },
      { title: 'Keeping the record', body: 'Every decision, time and source goes into the incident record. Supervisors ask for it.' },
    ] },
    { title: 'Payment fraud and help-desk impersonation', kind: 'Mandatory', minutes: 8, audience: 'All staff', steps: [
      { title: 'How the calls sound', body: 'Attackers pose as executives or IT and ask for an MFA reset or an urgent payment change. They are calm and well informed.' },
      { title: 'Verify on a known number', body: 'Never act on the number or link in the request. Call back using the directory.', points: ['Call-back on file number', 'Second approver for payee changes'] },
      { title: 'SWIFT and payment changes', body: 'Beneficiary changes always need dual control in the payment system, whatever the seniority of the requester.' },
      { title: 'Report it', body: 'Use the Report button in Outlook or call the Cyber Defence line. Early reports stop losses.' },
    ] },
  ],
  media: [
    { title: 'Handling pre-release content', kind: 'Mandatory', minutes: 10, audience: 'Production and post staff', steps: [
      { title: 'What is pre-release', body: 'Locked cuts, dailies, plates, stems, scripts and key art before release. A single leak can cost a release window.' },
      { title: 'Watermarks and custody', body: 'Every copy carries a forensic watermark tied to you. Custody records who received what, and when.' },
      { title: 'Approved transfer only', body: 'Use the content portal or the approved accelerator. Never personal cloud, email or USB.', points: ['No personal Dropbox / Drive', 'No screen recording'] },
      { title: 'If something leaks', body: 'Tell Content Security immediately. Do not try to trace it yourself; the watermark does that.' },
    ] },
    { title: 'TPN vendor onboarding for producers', kind: 'Role-based', minutes: 8, audience: 'Producers and coordinators', steps: [
      { title: 'Check the shield first', body: 'Before a vendor receives pre-release media they need a current TPN Gold or Blue Shield, or an approved exception.' },
      { title: 'Request access, not files', body: 'Grant time-limited portal access rather than sending files. Access expires with the job.' },
      { title: 'Freelancers count too', body: 'Freelance colourists and editors are vendors. They sign the content NDA and use managed devices.' },
      { title: 'Close out', body: 'At wrap, revoke access and confirm deletion of working copies in writing.' },
    ] },
  ],
  healthcare: [
    { title: 'HIPAA privacy and security essentials', kind: 'Mandatory', minutes: 12, audience: 'All workforce members', steps: [
      { title: 'Minimum necessary', body: 'Only open the records you need for the patient in front of you. FairWarning reviews every chart access.' },
      { title: 'Snooping is a breach', body: 'Looking up a colleague, a neighbour or a VIP without a care reason is reportable and leads to sanctions.', points: ['Access is logged', 'Break-the-glass is reviewed'] },
      { title: 'Sending PHI', body: 'Use secure messaging or encrypted email. Never text PHI from a personal phone.' },
      { title: 'Report quickly', body: 'Lost devices and misdirected faxes or emails must be reported to Privacy within 24 hours.' },
    ] },
    { title: 'Medical device security for clinical engineering', kind: 'Role-based', minutes: 10, audience: 'Biomed and imaging staff', steps: [
      { title: 'Devices are on the network', body: 'Infusion pumps, monitors and modalities talk to servers. Many run old operating systems we cannot patch.' },
      { title: 'Vendor service sessions', body: 'GE, Philips and BD connect through the biomed jump host only, with a ServiceNow work order.' },
      { title: 'Procurement: FDA 524B', body: 'New devices need an SBOM and a vulnerability management plan from the manufacturer before purchase.', points: ['SBOM on file', 'Patch commitment'] },
      { title: 'If a device misbehaves', body: 'Take it out of use, tag it and call Biomed. Patient safety first; security is told in parallel.' },
    ] },
  ],
  automotive: [
    { title: 'Prototype protection (TISAX AL3)', kind: 'Mandatory', minutes: 11, audience: 'Design, R&D and test staff', steps: [
      { title: 'What is protected', body: 'Pre-launch vehicles, parts, renders, clay models and test data. Partners audit us against VDA ISA prototype controls.' },
      { title: 'Camouflage and photos', body: 'No photos in prototype areas. Test vehicles on public roads stay camouflaged.', points: ['Camera stickers on phones', 'Visitor escort'] },
      { title: 'Sharing with suppliers', body: 'Only send prototype data to suppliers with a valid TISAX AL3 label, through the supplier portal.' },
      { title: 'Report a loss', body: 'Lost parts, leaked renders or unknown photographers are reported to Security Governance at once.' },
    ] },
    { title: 'Vehicle cybersecurity under UNECE R155 / R156', kind: 'Role-based', minutes: 10, audience: 'Engineering and OTA teams', steps: [
      { title: 'The CSMS', body: 'Type approval depends on a working Cyber Security Management System, re-audited by the KBA every three years.' },
      { title: 'TARA for every change', body: 'A threat analysis and risk assessment (ISO/SAE 21434) is updated for each relevant design change.' },
      { title: 'Software updates (SUMS)', body: 'OTA campaigns need a signed release, a RXSWIN record and a rollback plan before release.', points: ['Code signing', 'Rollback tested'] },
      { title: 'Field monitoring', body: 'The vehicle SOC watches the fleet. Engineers must respond to VSOC findings within the agreed SLA.' },
    ] },
  ],
};

export function trainingCourses(c: CustomerProfile): Course[] {
  const common: Omit<Course, 'id' | 'done' | 'dueDays'>[] = [
    { title: `Security awareness ${new Date().getFullYear()}: phishing and reporting`, kind: 'Mandatory', minutes: 9, audience: `Everyone at ${c.short}`, steps: [
      { title: 'What phishing looks like now', body: `Messages are well written and often look internal. Attackers reference real ${c.short} projects and people.` },
      { title: 'Check before you click', body: 'Hover over links, check the sender domain and be wary of urgency.', points: [`Our domain is ${c.domain}`, 'Lookalike domains swap letters'] },
      { title: 'MFA prompts you did not start', body: 'Deny them and report. Repeated prompts mean someone has your password.' },
      { title: 'Reporting', body: 'Use the Report button. You will never be blamed for reporting something that turns out to be safe.' },
    ] },
    { title: 'Acceptable use of AI tools', kind: 'Mandatory', minutes: 6, audience: `Everyone at ${c.short}`, steps: [
      { title: 'Sanctioned tools', body: `Only use AI tools approved in the ${c.short} AI register. Others may keep what you paste.` },
      { title: 'What never goes in', body: 'Customer data, credentials and confidential documents never go into unapproved AI tools.' },
      { title: 'Check the output', body: 'AI output can be wrong. You remain responsible for anything you send or publish.' },
    ] },
  ];
  const all = [...common, ...SECTOR_COURSES[c.id]];
  const r = rng(`training-${c.id}`);
  return all.map((x, i) => ({ ...x, id: `TRN-${String(i + 1).padStart(3, '0')}`, done: i === 1, dueDays: i === 1 ? -r.int(20, 60) : r.int(6, 40) }));
}

/* =====================================================================
   Drive: every document the company holds
   ===================================================================== */
export type DriveStatus = 'accepted' | 'uploaded' | 'scanning' | 'failed';
export type DriveType = 'PDF' | 'PNG' | 'DOCX' | 'XLSX' | 'CSV';
export interface DriveItem {
  id: string;
  parent: string | null;
  kind: 'folder' | 'file';
  name: string;
  filename?: string;
  type?: DriveType;
  sizeKb?: number;
  status?: DriveStatus;
  createdDays: number;
  modifiedDays: number;
  taskId?: string;
  taskRef?: string;
  expiresDays?: number;
  /** System folder (e.g. Evidences): rows are managed by HexaComply. */
  system?: boolean;
}

const POLICIES = ['Information security policy', 'Acceptable use policy', 'Access control policy', 'Incident response policy', 'Business continuity policy', 'Supplier security policy', 'Data classification & handling standard'];
const SECTOR_FOLDER: Record<CustomerId, [string, string[], string[]]> = {
  maritime: ['Vessel & terminal OT', ['Fleet OT asset inventory', 'Crane network zone diagram', 'ECDIS update procedure', 'Konecranes remote access agreement'], ['Ship cyber security plan', 'PFSP cyber annex', 'Removable media standard (vessels)']],
  finserv: ['Operational resilience', ['Important business services map', 'Impact tolerance board paper', 'Severe-but-plausible scenario results', 'ICT third-party exit plans'], ['DORA ICT risk framework', 'SWIFT CSP architecture type A1', 'PCI DSS scope statement']],
  media: ['Content security', ['Watermark vendor specification', 'TPN Gold Shield certificate', 'Custody delivery log (Nightjar)', 'Freelancer NDA template'], ['Pre-release handling standard', 'Screening room security procedure', 'Live playout DR runbook']],
  healthcare: ['Clinical & medical devices', ['Medical device inventory (xDome export)', 'Biomed remote access procedure', 'FDA 524B procurement checklist', 'Epic downtime drill report'], ['HIPAA risk analysis method', 'Business associate management procedure', 'Breach notification procedure']],
  automotive: ['Vehicle cybersecurity (CSMS)', ['TARA register extract (ISO/SAE 21434)', 'OTA release checklist', 'VSOC monitoring concept', 'KBA CSMS certificate'], ['Prototype protection handbook', 'Plant zone & conduit standard', 'SUMS process description']],
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

export function driveTree(c: CustomerProfile, tasks: ComplyTask[], evidence: EvidenceItem[]): DriveItem[] {
  const r = rng(`drive-${c.id}`);
  const out: DriveItem[] = [];
  const idp = scopedConnectors(c, 'all').find((k) => k.category === 'Identity')?.product ?? 'Identity provider';
  const folder = (id: string, name: string, system = false) => out.push({ id, parent: null, kind: 'folder', name, createdDays: r.int(200, 700), modifiedDays: r.int(1, 60), system });
  const file = (parent: string | null, name: string, type: DriveType, status: DriveStatus = 'accepted', extra: Partial<DriveItem> = {}) => {
    const created = r.int(4, 400);
    out.push({ id: `DOC-${String(out.length + 1).padStart(4, '0')}`, parent, kind: 'file', name, filename: `${slug(name)}.${type.toLowerCase()}`, type, sizeKb: type === 'PNG' ? r.int(180, 2400) : type === 'PDF' ? r.int(90, 6200) : r.int(24, 900), status, createdDays: created, modifiedDays: r.int(0, created), ...extra });
  };
  const [secName, secFiles, secDrafts] = SECTOR_FOLDER[c.id];
  folder('f-iam', 'Access and identity management');
  folder('f-ev', 'Evidences', true);
  folder('f-pol', 'Policy library');
  folder('f-sec', secName);
  folder('f-legacy', 'Imported legacy documents');
  folder('f-rev', 'Reviewed documents');
  const draftFw = c.frameworks.slice(0, 2);
  draftFw.forEach((f) => folder(`f-dr-${f.id}`, `${f.short} drafts`));

  ['Joiner-mover-leaver procedure', `${idp} conditional access export`, 'Privileged access review (last quarter)', 'MFA enrolment report', 'Access control policy (signed)'].forEach((n, i) => file('f-iam', n, i === 1 ? 'CSV' : i === 3 ? 'XLSX' : 'PDF'));
  [...POLICIES, ...secDrafts].forEach((n) => file('f-pol', n, 'DOCX', r.chance(0.9) ? 'accepted' : 'uploaded'));
  secFiles.forEach((n, i) => file('f-sec', n, i === 1 ? 'PNG' : i === 0 ? 'XLSX' : 'PDF'));
  ['Risk register 2024 (spreadsheet)', 'Previous auditor report', 'Old asset list', 'Network diagram (scanned)', 'Legacy BCP', 'Vendor list export'].forEach((n, i) => file('f-legacy', n, i === 0 || i === 2 || i === 5 ? 'XLSX' : i === 3 ? 'PNG' : 'PDF', i === 3 ? 'failed' : 'accepted'));
  ['Management review minutes (signed)', 'Internal audit report', 'Penetration test summary', 'Board risk appetite statement'].forEach((n) => file('f-rev', n, 'PDF'));
  draftFw.forEach((f) => ['Scope statement', 'Gap assessment', 'Control narrative'].forEach((n, i) => file(`f-dr-${f.id}`, `${f.short} ${n.toLowerCase()}`, i === 1 ? 'XLSX' : 'DOCX', i === 2 ? 'uploaded' : 'accepted')));
  // Evidences: the files attached to evidence items, with the task they satisfy and their expiry.
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const evPick = r.shuffle(evidence.filter((e) => !e.automated && ['approved', 'submitted', 'processing', 'more_info', 'failed'].includes(e.state))).slice(0, 45);
  evPick.forEach((e) => {
    const t = taskById.get(e.taskId);
    const label = e.title.replace(/^[^:]+:\s*/, '');
    const status: DriveStatus = e.state === 'approved' ? 'accepted' : e.state === 'processing' ? 'scanning' : e.state === 'failed' ? 'failed' : 'uploaded';
    file('f-ev', `${label.charAt(0).toUpperCase()}${label.slice(1)} · ${e.controlRef}`, r.weighted<DriveType>([['PDF', 6], ['PNG', 2], ['XLSX', 1.5], ['CSV', 1]]), status, { taskId: e.taskId, taskRef: t?.ref, expiresDays: e.expiresDays });
  });
  ['Company overview', 'Organisation chart', 'ISMS scope statement'].forEach((n, i) => file(null, `${c.short} ${n.toLowerCase()}`, i === 1 ? 'PNG' : 'PDF'));
  return out;
}

/* =====================================================================
   Risk record detail (scenario, dimension assessments, treatment)
   ===================================================================== */
export const RISK_DIMS: Record<CustomerId, string[]> = {
  maritime: ['Financial', 'Regulatory', 'Reputational', 'Operational', 'Customer'],
  finserv: ['Financial', 'Regulatory', 'Reputational', 'Operational', 'Customer'],
  media: ['Financial', 'Regulatory', 'Reputational', 'Operational', 'Customer'],
  healthcare: ['Financial', 'Regulatory', 'Reputational', 'Operational', 'Patient'],
  automotive: ['Financial', 'Regulatory', 'Reputational', 'Operational', 'Customer'],
};
const PROPOSED: [RegExp, string][] = [
  [/multi-factor/, 'Enforce phishing-resistant MFA for every privileged and remote account'],
  [/flat network/, 'Segment critical systems into zones with default-deny conduits'],
  [/patches|outdated/, 'Bring endpoints into the 14-day patch SLA; isolate what cannot be patched'],
  [/orphaned|offboarding/, 'Automate leaver deprovisioning from the HR feed'],
  [/over-privileged/, 'Quarterly role review; remove standing admin rights'],
  [/secrets/, 'Secret scanning in pipelines and rotation of exposed keys'],
  [/third-party due diligence/, 'Tiered supplier assessment before access is granted'],
  [/backups not tested/, 'Quarterly restore tests against RTO, results recorded'],
  [/logging gaps/, 'Onboard critical systems to the SIEM with 12-month retention'],
  [/shared administrator/, 'Vault shared admin credentials in PAM with check-out'],
  [/end-of-support/, 'Replace or ring-fence end-of-support systems; compensating monitoring'],
  [/firewall/, 'Firewall rule review with change approval and drift alerting'],
  [/contract terms/, 'Add security, audit and breach-notification clauses at renewal'],
  [/egress/, 'Egress filtering through the secure web gateway'],
];
const FUNCTIONS: Record<CustomerId, string[]> = {
  maritime: ['Security operations', 'Terminal OT engineering', 'Fleet technical', 'Group IT infrastructure', 'Procurement & vendor management', 'Finance'],
  finserv: ['Cyber defence', 'Operational resilience', 'Payments operations', 'Technology infrastructure', 'Third-party risk', 'Financial crime'],
  media: ['Content security', 'Security operations', 'Post-production IT', 'Broadcast engineering', 'Platform engineering', 'Vendor management'],
  healthcare: ['Security operations', 'Clinical engineering (Biomed)', 'Epic technical team', 'Infrastructure & cloud', 'Privacy office', 'Supply chain'],
  automotive: ['Cyber defence center', 'Plant OT security', 'Vehicle cybersecurity', 'Group IT infrastructure', 'Supplier quality & purchasing', 'R&D IT'],
};
const CIA_N: Record<CiaLevel, number> = { L: 1, M: 2, H: 3 };
export interface RiskDetail {
  threatId: string;
  riskDays: number;
  cia: [CiaLevel, CiaLevel, CiaLevel];
  totalCrit: number;
  inh: number[];
  res: number[] | null;
  existing: string[];
  proposed: string;
  responsible: string;
  boardReport: boolean;
  comment: string;
  uniqueId: string;
  cutPct: number | null;
  assetCategory: string;
}
function dims(r: ReturnType<typeof rng>, top: number): number[] {
  const v = Array.from({ length: 5 }, () => Math.max(1, top - r.int(0, 2)));
  v[r.int(0, 4)] = top;
  return v;
}
export function riskDetail(c: CustomerProfile, x: RiskItem, assets: RegAsset[]): RiskDetail {
  const r = rng(`riskd-${c.id}-${x.id}`);
  const conns = scopedConnectors(c, 'all');
  const lvl = (): CiaLevel => r.weighted<CiaLevel>([['L', 1], ['M', 3], ['H', 3]]);
  const cia: [CiaLevel, CiaLevel, CiaLevel] = [lvl(), lvl(), lvl()];
  const ctlPool = [
    ...conns.filter((k) => ['EDR / XDR', 'Identity', 'PAM', 'Backup', 'SIEM', 'OT', 'Email', 'SASE'].includes(k.category)).map((k) => `${k.category === 'EDR / XDR' ? 'Endpoint detection' : k.category === 'Identity' ? 'Conditional access & MFA' : k.category === 'PAM' ? 'Privileged session brokering' : k.category === 'Backup' ? 'Immutable backups' : k.category === 'SIEM' ? 'Central logging & detection' : k.category === 'OT' ? 'OT network monitoring' : k.category === 'Email' ? 'Email threat filtering' : 'Secure web gateway'} (${k.product})`),
    'Security awareness training', 'Supplier assessment before onboarding',
  ];
  const existing = x.controls.length ? [...x.controls, ...r.pickN(ctlPool, 1)] : r.pickN(ctlPool, r.int(1, 3));
  const proposed = PROPOSED.find(([re]) => re.test(x.vulnerability))?.[1] ?? 'Review control design with the risk owner';
  const cutPct = x.residualScore === null ? null : Math.round(((x.residualScore - x.inherentScore) / x.inherentScore) * 100);
  const asset = assets.find((a) => a.base === x.asset);
  return {
    threatId: `THR-${String(rng(`thr-${c.id}-${x.threat}`).int(1, 64)).padStart(3, '0')}`,
    riskDays: r.int(20, 540),
    cia,
    totalCrit: cia.reduce((s, v) => s + CIA_N[v], 0),
    inh: dims(r, x.inherent.i),
    res: x.residual ? dims(r, x.residual.i) : null,
    existing,
    proposed,
    responsible: r.pick(FUNCTIONS[c.id]),
    boardReport: x.curated || x.level === 'High',
    comment: x.treatment === 'Accept' ? 'Accepted within risk appetite; re-confirm at the next quarterly review.' : x.treatment === 'Transfer' ? `Financial impact transferred to cyber insurance (${c.insurance.carrier}).` : x.treatment === 'Avoid' ? 'Activity discontinued or redesigned to remove the exposure.' : x.treatment === 'Not set' ? 'Treatment decision pending with the risk owner.' : 'Treatment plan agreed; residual is a target until the proposed control is in place.',
    uniqueId: `${c.vocab.hostPrefix}-RSK-${x.id.slice(2)}`,
    cutPct,
    assetCategory: x.config === 'Asset risk' ? asset?.category ?? 'Applications & Databases' : x.asset,
  };
}

/* =====================================================================
   Asset record detail
   ===================================================================== */
export interface AssetDetail {
  exposure: boolean;
  regulations: string[];
  manager: string;
  location: string;
  issuedDays: number;
  decommissionDays: number | null;
  retention: string;
  disposal: string;
  backup: string;
  continuity: string;
  interdeps: string[];
  documentation: string;
  legacy: boolean;
  unique: boolean;
}
export function assetDetail(c: CustomerProfile, a: RegAsset, all: RegAsset[]): AssetDetail {
  const r = rng(`astd-${c.id}-${a.id}`);
  const t = c.tenants.find((x) => x.id === a.tenant);
  const regs = [...new Set([...(t?.regimes ?? []), ...r.pickN(c.frameworks.map((f) => f.short), 2)])].slice(0, 4);
  const physical = a.cls === 'Physical';
  const peers = all.filter((x) => x.tenant === a.tenant && x.id !== a.id && x.category !== a.category && x.criticality !== 'Non-Critical');
  return {
    exposure: a.category === 'SaaS' || a.category === 'Outsourced Services' || r.chance(a.category === 'Applications & Databases' ? 0.4 : 0.15),
    regulations: regs,
    manager: r.pick([c.people.admin.name, c.people.socLead.name, ...c.people.staff.slice(3, 9).map((p) => p.name)]),
    location: a.category === 'SaaS' ? 'Vendor cloud (contracted region)' : a.category === 'Outsourced Services' ? 'Supplier premises' : `${t?.name ?? c.hq}${t?.city ? ` · ${t.city}` : ''}`,
    issuedDays: r.int(200, 3200),
    decommissionDays: a.status === 'Retired' ? -r.int(10, 300) : a.supportEndDays !== null && a.supportEndDays < 0 ? r.int(30, 400) : null,
    retention: a.category === 'Information' || a.category === 'Documentation' ? r.pick(['7 years', '10 years', '6 years after contract end', 'Life of the asset + 2 years']) : 'Not applicable',
    disposal: physical ? r.pick(['Certified wipe (NIST 800-88) and recycling', 'Physical destruction with certificate', 'Return to lessor after wipe']) : a.category === 'Information' ? 'Secure deletion; certificate retained' : 'Account and data deletion confirmed by supplier',
    backup: a.category === 'People' || a.category === 'Hardware' ? 'Not applicable' : r.weighted([['Backed up · immutable copy', 4], ['Backed up', 3], ['Not backed up', a.criticality === 'Critical' ? 0.6 : 1.5]]),
    continuity: a.criticality === 'Critical' ? `Restore within ${r.pick(['4 h', '8 h', '24 h'])}; manual workaround documented` : a.criticality === 'Moderate' ? 'Restore within 72 h' : 'Best effort',
    interdeps: r.pickN(peers, r.int(1, 3)).map((x) => `${x.id} ${x.base}`),
    documentation: r.pick(['Runbook in Drive › Policy library', 'Vendor documentation on file', 'Architecture diagram in Drive', 'Not documented']),
    legacy: a.status === 'Legacy' || (a.supportEndDays !== null && a.supportEndDays < 0),
    unique: r.chance(0.15),
  };
}

/* =====================================================================
   Vendor register (governance side)
   ===================================================================== */
export type VendorClass = 'Restricted' | 'Confidential' | 'Internal' | 'Public';
export type RecordedRisk = 'High' | 'Medium' | 'Low';
export type Clauses = 'Contract + NDA' | 'In contract' | 'NDA' | 'None';
export type RegStatus = 'Draft' | 'AI Draft' | 'Confirmed';
export interface VendorRec {
  id: string;
  name: string;
  category: string;
  tier: 1 | 2 | 3;
  country: string;
  contact: { name: string; email: string };
  services: string;
  info: string[];
  classification: VendorClass;
  risk: RecordedRisk;
  clauses: Clauses;
  nextReviewDays: number;
  status: RegStatus;
  startDays: number;
  endDays: number;
  slas: string;
  compliance: string[];
  rights: string;
  duration: string;
  methods: string;
  certs: string[];
  mitigation: string;
  monitoring: string;
  incident: string;
  lastReviewDays: number;
  reviewer: string;
  tenants: string[];
  local?: boolean;
}
const FIRST: Record<CustomerId, string[]> = {
  maritime: ['Jeroen', 'Annika', 'Mikko', 'Siti', 'Rafael', 'Kees', 'Liesbeth', 'Wei', 'Thomas', 'Ana'],
  finserv: ['James', 'Charlotte', 'Rohan', 'Hannah', 'Callum', 'Sophie', 'Daniel', 'Amira', 'Oliver', 'Grace'],
  media: ['Tyler', 'Camille', 'Jordan', 'Isabel', 'Noah', 'Marisol', 'Dev', 'Sienna', 'Owen', 'Lucía'],
  healthcare: ['Brian', 'Melissa', 'Carlos', 'Jennifer', 'Derek', 'Ashley', 'Kumar', 'Rebecca', 'Travis', 'Monica'],
  automotive: ['Stefan', 'Julia', 'Matthias', 'Lena', 'Florian', 'Katharina', 'Zoltán', 'Mariana', 'Uwe', 'Petra'],
};
const LAST: Record<CustomerId, string[]> = {
  maritime: ['Visser', 'Lindqvist', 'Virtanen', 'Abdullah', 'Souza', 'de Boer', 'Maes', 'Lim', 'Jensen', 'Costa'],
  finserv: ['Harrington', 'Pemberton', 'Mehta', 'Clarke', 'MacLeod', 'Turner', 'Webb', 'Hassan', 'Bennett', 'Shaw'],
  media: ['Brooks', 'Laurent', 'Reyes', 'Navarro', 'Fischer', 'Ortega', 'Patel', 'Hughes', 'Sullivan', 'Molina'],
  healthcare: ['Kowalczyk', 'Henderson', 'Ramirez', 'Walsh', 'Coleman', 'Morgan', 'Iyer', 'Foster', 'Russell', 'Bishop'],
  automotive: ['Weber', 'Schmitt', 'Neumann', 'Zimmermann', 'Huber', 'Wolf', 'Kovács', 'Ortiz', 'Becker', 'Lang'],
};
const SECTOR_REQ: Record<CustomerId, (personal: boolean, ot: boolean) => string[]> = {
  maritime: (p, ot) => [...(ot ? ['IACS UR E27 (supplier systems)', 'IEC 62443-2-4'] : []), 'NIS2 supply-chain clauses', ...(p ? ['GDPR Art. 28 processor terms'] : [])],
  finserv: (p) => ['DORA Art. 30 contractual provisions', 'FCA SYSC 8 outsourcing', ...(p ? ['UK GDPR Art. 28 processor terms'] : [])],
  media: (p) => ['TPN Gold Shield', 'MPA CSBP content handling', ...(p ? ['CCPA service-provider terms'] : [])],
  healthcare: (p, ot) => [...(p ? ['HIPAA Business Associate Agreement'] : []), ...(ot ? ['FDA 524B SBOM & patch commitment'] : []), 'HITRUST third-party requirements'],
  automotive: (p, ot) => ['TISAX label (VDA ISA)', ...(ot ? ['IEC 62443-2-4 service provider'] : []), ...(p ? ['GDPR Art. 28 processor terms'] : []), 'UNECE R155 supplier interface'],
};
export function vendorRegister(c: CustomerProfile, tenantId: string): VendorRec[] {
  const r = rng(`vreg-${c.id}`);
  const reviewers = [c.people.grcLead.name, c.people.ciso.name, ...c.people.staff.slice(3, 6).map((p) => p.name)];
  return vendors(c, tenantId).map((v) => {
    const personal = v.dataAccess.some((d) => /Personal|PHI|Payments/.test(d));
    const ot = v.dataAccess.some((d) => /OT|Medical device/.test(d)) || !!v.otRemote;
    const restricted = v.dataAccess.some((d) => /PHI|Pre-release|Prototype|Payments/.test(d));
    const classification: VendorClass = restricted ? 'Restricted' : personal || v.dataAccess.includes('Confidential') || ot ? 'Confidential' : v.tier === 3 ? r.weighted<VendorClass>([['Internal', 3], ['Public', 1]]) : 'Internal';
    const risk: RecordedRisk = v.highRisk ? 'High' : v.gapScore >= 45 || v.tier === 1 ? 'Medium' : 'Low';
    const nda = r.chance(v.tier === 1 ? 0.85 : 0.6);
    const inContract = v.obligations.rightToAudit || v.tier === 1 || r.chance(0.6);
    const clauses: Clauses = inContract && nda ? 'Contract + NDA' : inContract ? 'In contract' : nda ? 'NDA' : 'None';
    const fn = r.pick(FIRST[c.id]);
    const ln = r.pick(LAST[c.id]);
    const dom = v.name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'vendor';
    const certs = [
      ...(r.chance(v.tier === 1 ? 0.8 : 0.45) ? ['ISO/IEC 27001'] : []),
      ...(r.chance(0.4) ? ['SOC 2 Type II'] : []),
      ...(v.tisax && v.tisax !== 'No label' ? [`TISAX ${v.tisax}`] : []),
      ...(v.tpn && v.tpn !== 'Not assessed' ? [`TPN ${v.tpn}`] : []),
      ...(c.id === 'healthcare' && r.chance(0.3) ? ['HITRUST r2'] : []),
      ...(c.id === 'finserv' && v.cif ? ['ISAE 3402 Type II'] : []),
    ];
    return {
      id: `VEN-${v.id.slice(4)}`, name: v.name, category: v.category, tier: v.tier, country: v.country,
      contact: { name: `${fn} ${ln}`, email: `${fn.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.${ln.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@${dom}.com` },
      services: v.access, info: v.dataAccess, classification, risk, clauses,
      nextReviewDays: v.dueInDays,
      status: v.assessment === 'Not started' || v.assessment === 'Sent' ? r.weighted<RegStatus>([['Draft', 2], ['AI Draft', 1.5]]) : r.weighted<RegStatus>([['Confirmed', 8], ['AI Draft', 1]]),
      startDays: r.int(200, 2400), endDays: v.contractEndDays,
      slas: v.tier === 1 ? r.pick(['99.9% availability · P1 response 30 min', '99.95% availability · P1 response 15 min', '24×7 support · P1 response 1 h']) : r.pick(['Business-hours support · P1 response 4 h', 'Best effort', 'Next business day']),
      compliance: SECTOR_REQ[c.id](personal, ot),
      rights: ot ? 'Remote maintenance on named systems' : personal ? 'Processing of personal data on our instructions' : v.tier === 1 ? 'Administrative access to hosted service' : 'Named user access, no admin',
      duration: ot ? 'Per session, approved ticket' : v.tier === 1 ? 'Contract term, reviewed quarterly' : 'Contract term',
      methods: ot ? 'PAM jump host, session recording' : r.pick(['SSO with MFA, joiner/leaver feed', 'Dedicated tenant, customer-managed keys', 'Supplier portal with MFA']),
      certs: certs.length ? certs : ['None on file'],
      mitigation: v.highRisk ? r.pick(['Compensating monitoring on the supplier connection', 'Contract renegotiation in progress', 'Exit plan drafted']) : 'Standard contractual controls',
      monitoring: v.tier === 1 ? 'Continuous ratings + annual assessment' : v.tier === 2 ? 'Annual questionnaire' : 'Biennial review',
      incident: `Within ${v.obligations.breachNotifyHrs} h, in writing, to ${c.people.grcLead.name}`,
      lastReviewDays: v.lastAssessedDays, reviewer: r.pick(reviewers), tenants: v.tenants,
    };
  });
}

/* =====================================================================
   GRC incident register (operational and compliance incidents)
   ===================================================================== */
export type GrcIncStatus = 'Open' | 'Under investigation' | 'Contained' | 'Resolved' | 'Closed';
export type GrcCause = 'Human error' | 'System failure' | 'Third party' | 'Malicious act' | 'Process gap' | 'Physical / environmental';
export interface GrcIncident {
  id: string;
  title: string;
  cause: GrcCause;
  causeDetail: string;
  reportedBy: string;
  startedDays: number;
  /** Hours the incident lasted; null while ongoing. */
  durationH: number | null;
  personal: boolean;
  breach: boolean;
  status: GrcIncStatus;
  description: string;
  tenant: string;
  asset?: string;
  vendor?: string;
  regulator?: string;
  timeline: { days: number; text: string }[];
  updatedDays: number;
}
type IncSeed = [title: string, cause: GrcCause, detail: string, personal: boolean, breach: boolean, status: GrcIncStatus, description: string, asset: number | null, vendor: number | null, regulator: string | null];
const INC_SEEDS: Record<CustomerId, IncSeed[]> = {
  maritime: [
    ['Crew list e-mailed to wrong agent at Port Klang', 'Human error', 'Autocomplete picked a similarly named agency', true, true, 'Closed', 'Crew passports and visas for Halcyon Aurora were sent to the wrong ship agent. Agent confirmed deletion in writing.', null, null, 'Dutch DPA (AP)'],
    ['VSAT outage left Halcyon Pioneer without remote monitoring for 19 h', 'Third party', 'Satellite provider ground-station failure', false, false, 'Resolved', 'No telemetry ashore for 19 hours; vessel operated normally on board. Store-and-forward backlog replayed on reconnection.', null, null, null],
    ['Unapproved USB used on bridge ECDIS', 'Process gap', 'Chart update kiosk unavailable during port call', false, false, 'Closed', 'An officer loaded chart updates from a personal USB stick. Scanned afterwards: clean. Kiosk availability added to port-call checklist.', 6, null, null],
    ['Gate OCR lane down at Santos for 6 h', 'System failure', 'Controller disk failure', false, false, 'Resolved', 'Trucks were processed manually at the gate. Spare controller fitted; failure not security-related.', null, null, null],
    ['Konecranes remote session left open overnight', 'Third party', 'Vendor engineer did not log off; session not revoked', false, false, 'Contained', 'Brokered session to STS crane 14 remained open 11 hours after the work order closed. No commands issued. Session timeout reduced to 2 h.', 0, 0, null],
    ['Freight invoice fraud attempt (changed bank details)', 'Malicious act', 'Spoofed forwarder domain', false, false, 'Closed', 'Finance received a request to change a forwarder\'s bank account. Call-back verification stopped the payment.', null, 2, null],
    ['Terminal badge data exported to personal drive', 'Human error', 'Contractor took a working copy home', true, false, 'Under investigation', 'Stevedoring contractor exported gate badge records to a personal OneDrive. Copy deleted; DPO assessing whether notification is needed.', null, null, null],
    ['Substation RTU alarm flood at Maasvlakte', 'System failure', 'Firmware fault after maintenance', false, false, 'Open', 'Repeated alarms from the 10 kV substation RTU after vendor maintenance. Operations on manual watch while vendor investigates.', 1, null, null],
  ],
  finserv: [
    ['Customer statements posted to wrong addresses', 'Third party', 'Print vendor mail-merge offset', true, true, 'Closed', '1,240 wealth statements were sent to the previous customer\'s address. Vendor fixed the merge; customers notified.', null, null, 'ICO'],
    ['Faster Payments delayed 2.5 h (within tolerance)', 'System failure', 'Mainframe batch overrun', false, false, 'Closed', 'Outbound payments queued for 2 h 30 min, within the 4 h impact tolerance. Lessons learned fed into the SYSC 15A self-assessment.', 0, null, null],
    ['Trader screenshot of client order shared on chat app', 'Human error', 'Personal messaging app on managed phone', true, false, 'Resolved', 'A trader shared a client order screenshot in an unapproved chat. Message recalled; recorded-communications rule reinforced.', null, null, null],
    ['Cloud provider region degradation (UK South)', 'Third party', 'Provider storage incident', false, false, 'Resolved', 'Online banking latency for 47 minutes. Classified as not major under DORA criteria; recorded in the RoI incident log.', null, 0, null],
    ['Unauthorised standing order changes via help desk', 'Malicious act', 'Social engineering of password reset', true, true, 'Contained', 'Three customer accounts had payees added after a fraudulent help-desk reset. Funds recalled; DORA major-incident assessment completed.', null, null, 'FCA / PRA'],
    ['SWIFT alliance server patch missed in window', 'Process gap', 'Change ticket not linked to CSCF control 2.2', false, false, 'Closed', 'Quarterly security update applied 11 days late. No exploitation; change process updated.', null, null, null],
    ['Branch CCTV recorder failed at Leeds', 'Physical / environmental', 'Power supply failure', false, false, 'Resolved', 'No recordings for 3 days at one branch. Replaced; no incidents in the gap.', null, null, null],
    ['Data room access granted to departed advisor', 'Process gap', 'Leaver not removed from deal room group', true, false, 'Under investigation', 'A departed advisor kept access to a deal data room for 23 days. Access logs show two logins; legal reviewing.', null, null, null],
  ],
  media: [
    ['Trailer cut leaked on social media 3 days early', 'Third party', 'Marketing agency workstation', false, false, 'Contained', 'A rough trailer cut appeared on social media. Forensic watermark traced it to an agency workstation; vendor access suspended.', 3, 4, null],
    ['Freelancer kept dailies after wrap', 'Process gap', 'Access not revoked at end of contract', false, false, 'Closed', 'A freelance colourist still had review-portal access 30 days after wrap. Revoked; confirmed deletion of local copies.', null, null, null],
    ['KestrelPlay subscriber emails exposed in support ticket', 'Human error', 'Export attached to public ticket', true, true, 'Closed', 'A support agent attached a CSV of 3,100 subscriber emails to a ticket visible to a vendor. Notified under CCPA.', null, null, 'California AG'],
    ['Live playout switched to DR for 4 minutes', 'System failure', 'Primary playout server crash', false, false, 'Resolved', 'Primary iTX server crashed during a live event; DR gallery took over in 4 minutes. Rights penalties avoided.', null, null, null],
    ['Script pages printed and left in screening room', 'Human error', 'Clean-desk breach', false, false, 'Closed', 'Pages of a pre-release script were found after a screening. Recovered; screening checklist updated.', null, null, null],
    ['Dubbing vendor e-mailed locked cut via personal account', 'Third party', 'Vendor bypassed content portal', false, false, 'Under investigation', 'Red Fern Localisation sent a locked cut to a sub-contractor from a personal mailbox. TPN review requested.', null, 1, null],
    ['Card-testing attack on sign-up page', 'Malicious act', 'Bot traffic with stolen cards', true, false, 'Contained', 'Thousands of low-value authorisations from bots. Rate limiting and CAPTCHA added; no stored card data affected.', null, null, null],
    ['Edit bay air-conditioning failure, Soho', 'Physical / environmental', 'CRAC unit failure', false, false, 'Resolved', 'Edit bays shut down for 5 hours to protect storage. Work moved to the second floor.', null, null, null],
  ],
  healthcare: [
    ['Employee viewed neighbour\'s chart without a care reason', 'Human error', 'Curiosity access flagged by FairWarning', true, true, 'Closed', 'FairWarning flagged access to a neighbour\'s record. Sanctions applied; patient notified under the Breach Notification Rule.', 0, null, 'HHS OCR (annual log)'],
    ['Change Healthcare claims outage', 'Third party', 'Clearinghouse ransomware', false, false, 'Resolved', 'Claims and eligibility checks unavailable for 19 days. Cash flow covered by alternate clearinghouse and advance payments.', null, 4, null],
    ['Lost unencrypted USB with imaging study', 'Human error', 'Physician copied DICOM study to personal USB', true, true, 'Closed', 'A USB stick with one patient\'s imaging study was lost in the car park. Patient notified; USB write-blocking extended to radiology.', 1, null, 'HHS OCR (annual log)'],
    ['Infusion pump library sync failed at Community hospitals', 'System failure', 'Alaris server certificate expired', false, false, 'Resolved', 'Pumps fell back to their previous drug library for 9 hours. Pharmacy checked high-risk infusions manually.', 2, 3, null],
    ['Epic downtime 3 h (unplanned)', 'System failure', 'Storage controller failover', false, false, 'Closed', 'Units ran on downtime procedures and BCA workstations for 3 hours. No patient harm reported.', 0, 0, null],
    ['Vendor remote session to CT scanner without work order', 'Third party', 'GE service engineer connected outside process', false, false, 'Under investigation', 'A GE service session to a CT console started without a ServiceNow work order. Session recorded; vendor asked to explain.', null, 1, null],
    ['Misdirected fax of lab results to a pharmacy', 'Human error', 'Wrong speed-dial number', true, true, 'Closed', 'Lab results for two patients were faxed to a community pharmacy. Pharmacy confirmed destruction; patients notified.', 3, null, 'HHS OCR (annual log)'],
    ['Telehealth platform session recordings misconfigured', 'Third party', 'Recording retention set to public link', true, false, 'Open', 'TeleMed Partners stored visit recordings behind shareable links. No access observed yet; BAA status under review.', null, 10, null],
  ],
  automotive: [
    ['Pre-launch renders leaked from supplier portal', 'Third party', 'Design supplier account compromised', false, false, 'Contained', 'Renders of an unreleased model appeared on a forum. Traced to a supplier account without MFA; TISAX exception revoked.', 5, null, null],
    ['Ingolstadt press line stopped 46 minutes', 'System failure', 'PLC CPU fault on press line 3', false, false, 'Resolved', 'Line stop of 46 minutes at about €22k per minute. Hardware fault, not security; spare CPU stock reviewed.', null, null, null],
    ['OTA campaign paused after signing key alert', 'Process gap', 'Release signed with test key in staging', false, false, 'Closed', 'An OTA release candidate was signed with a staging key. Caught by the SUMS release gate before any vehicle received it.', null, null, null],
    ['Dealer portal exposed customer finance documents', 'Third party', 'DMS vendor misconfiguration', true, true, 'Closed', 'Finance documents for 412 customers were reachable without login for 2 days. Vendor fixed; notified to the BayLDA.', null, null, 'BayLDA (Bavarian DPA)'],
    ['Prototype vehicle photographed on public road', 'Physical / environmental', 'Camouflage panel detached', false, false, 'Closed', 'A test vehicle lost a camouflage panel; photos appeared online. Prototype protection procedures re-briefed.', null, null, null],
    ['Robot vendor laptop connected to body-shop network', 'Third party', 'Direct connection bypassing jump host', false, false, 'Under investigation', 'A KUKA service laptop was plugged straight into the body-shop network. OT monitoring flagged it; laptop quarantined.', 0, null, null],
    ['HR payroll file sent to wrong plant mailbox', 'Human error', 'Distribution list error', true, false, 'Resolved', 'Salary data for Győr staff went to the Puebla HR mailbox. Recalled and deleted; no further sharing.', null, null, null],
    ['Battery plant data diode transfer failed for 2 days', 'System failure', 'Diode proxy service crash', false, false, 'Resolved', 'Air-gapped plant logs could not reach the central SOC for 48 hours. Logs replayed after restart; no gaps.', null, null, null],
  ],
};
export function grcIncidents(c: CustomerProfile, tenantId: string): GrcIncident[] {
  const r = rng(`grcinc-${c.id}`);
  const people = [c.people.grcLead, c.people.socLead, c.people.admin, ...(c.people.otLead ? [c.people.otLead] : []), ...c.people.staff];
  const tIds = c.tenants.map((t) => t.id);
  const all = INC_SEEDS[c.id].map(([title, cause, causeDetail, personal, breach, status, description, assetIdx, vendorIdx, regulator], i): GrcIncident => {
    const started = r.int(3 + i * 9, 20 + i * 14);
    const open = status === 'Open' || status === 'Under investigation';
    const durationH = open ? null : r.weighted<number>([[r.int(1, 12), 3], [r.int(12, 72), 2], [r.int(72, 400), 1]]);
    const asset = assetIdx !== null ? c.vocab.crownJewels[assetIdx % c.vocab.crownJewels.length] : undefined;
    const vendor = vendorIdx !== null ? c.thirdParties[vendorIdx % c.thirdParties.length]?.name : undefined;
    const reporter = r.pick(people).name;
    const tl: { days: number; text: string }[] = [{ days: started, text: `Reported by ${reporter}` }, { days: Math.max(0, started - 0.2), text: `Triaged by ${c.people.grcLead.name}; cause recorded as ${cause.toLowerCase()}` }];
    if (breach && regulator) tl.push({ days: Math.max(0, started - 2), text: `Notified to ${regulator}` });
    if (status !== 'Open') tl.push({ days: Math.max(0, started - (durationH ?? 30) / 24), text: status === 'Under investigation' ? 'Investigation opened; evidence preserved' : 'Contained' });
    if (status === 'Resolved' || status === 'Closed') tl.push({ days: Math.max(0, started - (durationH ?? 24) / 24 - 1), text: 'Resolved; root cause and actions recorded' });
    if (status === 'Closed') tl.push({ days: Math.max(0, started - (durationH ?? 24) / 24 - r.int(3, 12)), text: 'Closed after review' });
    return {
      id: `INC-GRC-${String(i + 1).padStart(3, '0')}`, title, cause, causeDetail, reportedBy: reporter, startedDays: started, durationH, personal, breach, status, description,
      tenant: r.pick(tIds), asset, vendor, regulator: regulator ?? undefined, timeline: tl, updatedDays: Math.max(0, Math.round(tl[tl.length - 1].days)),
    };
  });
  return tenantId === 'all' ? all : all.filter((x) => x.tenant === tenantId);
}
