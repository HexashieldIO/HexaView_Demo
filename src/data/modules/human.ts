// HexaComply · Human Risk & Awareness: the people side of the Resilience Index.
// Phishing simulations, training, risky users, policy acknowledgement and the
// security champions network. Pure, seeded per customer and tenant. Employee
// names are generated from generic pools; nobody is a real person.
import type { Connector, CustomerId, CustomerProfile, Health } from '../types';
import { rng, type Rng } from '../../lib/rng';
import { scopedTenants, tenantShare } from '../customers';
import { incidents } from './soc';

/* ---------------- Platform ---------------- */
export interface AwarenessPlatform { name: string; status: Health; lastSyncMin: number; stale: boolean; note?: string }
const PLATFORM: Record<CustomerId, string> = {
  maritime: 'Proofpoint Security Awareness',
  finserv: 'Proofpoint Security Awareness (ZenGuide)',
  media: 'KnowBe4 Security Awareness',
  healthcare: 'Mimecast Awareness Training',
  automotive: 'Proofpoint Security Awareness',
};
export function awarenessPlatform(c: CustomerProfile): AwarenessPlatform {
  const k: Connector | undefined = c.connectors.find((x) => x.vendor === 'KnowBe4');
  if (k) return { name: `${k.vendor} ${k.product}`, status: k.status, lastSyncMin: k.lastSyncMin, stale: k.lastSyncMin > k.intervalMin * 2 || k.status !== 'healthy', note: k.note };
  return { name: PLATFORM[c.id], status: 'healthy', lastSyncMin: 38, stale: false };
}
export function emailGateway(c: CustomerProfile): string {
  const k = c.connectors.find((x) => x.category === 'Email' && x.vendor !== 'KnowBe4');
  return k ? `${k.vendor} ${k.product}` : 'Email gateway';
}
export function identitySource(c: CustomerProfile): string {
  return c.connectors.filter((x) => x.category === 'Identity').map((x) => x.product).slice(0, 2).join(' · ') || 'Identity provider';
}

/* ---------------- Departments ---------------- */
export interface Dept { id: string; name: string; share: number; risk: number; tenants?: string[] }
const DEPTS: Record<CustomerId, Dept[]> = {
  maritime: [
    { id: 'ops', name: 'Terminal Operations', share: 0.3, risk: 1.2, tenants: ['rtm', 'ant', 'pkl', 'sts'] },
    { id: 'crew', name: 'Ship crew', share: 0.12, risk: 1.4, tenants: ['fleet'] },
    { id: 'eng', name: 'Engineering & Maintenance', share: 0.16, risk: 1.1, tenants: ['rtm', 'ant', 'pkl', 'sts', 'fleet'] },
    { id: 'fin', name: 'Finance & Procurement', share: 0.08, risk: 1.0, tenants: ['hq'] },
    { id: 'com', name: 'Commercial & Customer Service', share: 0.12, risk: 1.15, tenants: ['hq', 'rtm', 'ant'] },
    { id: 'customs', name: 'Customs & Documentation', share: 0.08, risk: 1.25, tenants: ['hq', 'rtm', 'ant', 'pkl', 'sts'] },
    { id: 'it', name: 'IT & Security', share: 0.06, risk: 0.6, tenants: ['hq'] },
    { id: 'hr', name: 'HR, Legal & Executive', share: 0.08, risk: 0.9, tenants: ['hq'] },
  ],
  finserv: [
    { id: 'retail', name: 'Retail Banking', share: 0.28, risk: 1.1, tenants: ['ukbank', 'eu'] },
    { id: 'contact', name: 'Contact Centre', share: 0.14, risk: 1.35, tenants: ['ukbank', 'pay'] },
    { id: 'pay', name: 'Payments Operations', share: 0.1, risk: 1.0, tenants: ['pay'] },
    { id: 'markets', name: 'Markets & Trading', share: 0.08, risk: 1.05, tenants: ['markets'] },
    { id: 'wealth', name: 'Private Wealth', share: 0.1, risk: 1.2, tenants: ['wealth'] },
    { id: 'fin', name: 'Finance & Treasury', share: 0.07, risk: 0.95, tenants: ['ukbank', 'eu'] },
    { id: 'tech', name: 'Technology', share: 0.15, risk: 0.7, tenants: ['ukbank', 'eu', 'markets', 'pay', 'wealth'] },
    { id: 'hr', name: 'HR, Legal & Executive', share: 0.08, risk: 0.9, tenants: ['ukbank'] },
  ],
  media: [
    { id: 'prod', name: 'Production', share: 0.24, risk: 1.3, tenants: ['studios'] },
    { id: 'post', name: 'Post & VFX', share: 0.2, risk: 1.15, tenants: ['post'] },
    { id: 'mkt', name: 'Marketing & Publicity', share: 0.1, risk: 1.35, tenants: ['studios', 'play'] },
    { id: 'dist', name: 'Distribution & Licensing', share: 0.08, risk: 1.1, tenants: ['studios', 'play'] },
    { id: 'eng', name: 'KestrelPlay Engineering', share: 0.14, risk: 0.65, tenants: ['play'] },
    { id: 'live', name: 'Live Broadcast', share: 0.14, risk: 1.0, tenants: ['live'] },
    { id: 'fin', name: 'Finance', share: 0.05, risk: 1.0, tenants: ['studios'] },
    { id: 'talent', name: 'Talent, Legal & Executive', share: 0.05, risk: 1.2, tenants: ['studios'] },
  ],
  healthcare: [
    { id: 'nursing', name: 'Nursing', share: 0.34, risk: 1.25 },
    { id: 'phys', name: 'Physicians & Residents', share: 0.14, risk: 1.3 },
    { id: 'clin', name: 'Clinical Support (lab, imaging)', share: 0.12, risk: 1.05 },
    { id: 'rev', name: 'Revenue Cycle & Billing', share: 0.1, risk: 1.15, tenants: ['mrmc', 'clinics'] },
    { id: 'pharm', name: 'Pharmacy', share: 0.05, risk: 0.95 },
    { id: 'research', name: 'Research', share: 0.07, risk: 1.1, tenants: ['research'] },
    { id: 'it', name: 'IT & Clinical Engineering', share: 0.08, risk: 0.65 },
    { id: 'admin', name: 'Administration & HR', share: 0.1, risk: 1.0 },
  ],
  automotive: [
    { id: 'plant', name: 'Plant Operations', share: 0.42, risk: 1.2, tenants: ['ingolstadt', 'gyor', 'battery', 'puebla'] },
    { id: 'rnd', name: 'R&D Engineering', share: 0.16, risk: 0.95, tenants: ['group'] },
    { id: 'design', name: 'Design Studio', share: 0.03, risk: 1.15, tenants: ['group'] },
    { id: 'vsec', name: 'Connected Vehicle & VSOC', share: 0.03, risk: 0.6, tenants: ['connected'] },
    { id: 'proc', name: 'Procurement & Supply Chain', share: 0.08, risk: 1.2, tenants: ['group', 'ingolstadt', 'gyor', 'puebla'] },
    { id: 'fin', name: 'Finance', share: 0.06, risk: 1.05, tenants: ['group'] },
    { id: 'sales', name: 'Sales & Dealer Network', share: 0.12, risk: 1.3, tenants: ['retail'] },
    { id: 'it', name: 'IT', share: 0.1, risk: 0.7, tenants: ['group'] },
  ],
};
export function departments(c: CustomerProfile, tenantId: string): (Dept & { headcount: number })[] {
  const ts = scopedTenants(c, tenantId).map((t) => t.id);
  const people = scopedTenants(c, tenantId).reduce((s, t) => s + t.people, 0);
  const list = DEPTS[c.id].filter((d) => !d.tenants || d.tenants.some((t) => ts.includes(t)));
  const tot = list.reduce((s, d) => s + d.share, 0);
  return list.map((d) => ({ ...d, headcount: Math.max(6, Math.round((d.share / tot) * people)) }));
}

/* ---------------- Names ---------------- */
const FIRST: Record<CustomerId, string[]> = {
  maritime: ['Daan', 'Sanne', 'Lucas', 'Eva', 'Thijs', 'Noor', 'Ruben', 'Fleur', 'Wout', 'Ines', 'Hafiz', 'Nurul', 'Thiago', 'Larissa', 'Mateus', 'Jens', 'Kim', 'Ravi', 'Marek', 'Joana'],
  finserv: ['Oliver', 'Amelia', 'Harry', 'Isla', 'Jack', 'Sophie', 'Arjun', 'Chloe', 'Callum', 'Megan', 'Ravi', 'Hannah', 'Liam', 'Zara', 'Mei', 'Kieran', 'Lucie', 'Tom', 'Aisha', 'Ben'],
  media: ['Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Logan', 'Maya', 'Diego', 'Kendall', 'Jasmine', 'Owen', 'Lena', 'Marcus', 'Sofia', 'Eli', 'Nina', 'Theo', 'Imani', 'Cole'],
  healthcare: ['Ashley', 'Brian', 'Crystal', 'Derek', 'Erin', 'Frank', 'Gina', 'Hector', 'Jenna', 'Keith', 'Latoya', 'Matt', 'Nicole', 'Omar', 'Paula', 'Ryan', 'Tasha', 'Victor', 'Wendy', 'Kyle'],
  automotive: ['Lukas', 'Lea', 'Jonas', 'Mia', 'Felix', 'Hannah', 'Maximilian', 'Laura', 'Bence', 'Réka', 'Dávid', 'Luis', 'Fernanda', 'Jorge', 'Katharina', 'Tim', 'Julia', 'Niklas', 'Zsófia', 'Paul'],
};
const LAST: Record<CustomerId, string[]> = {
  maritime: ['Jansen', 'de Jong', 'Visser', 'Peeters', 'Hendriks', 'Dekker', 'Claes', 'Goossens', 'Ismail', 'Tan', 'Souza', 'Ferreira', 'Kowalski', 'Bos', 'Vermeulen', 'Lim', 'Santos', 'Meijer'],
  finserv: ['Smith', 'Jones', 'Taylor', 'Brown', 'Patel', 'Walsh', 'Evans', 'Hughes', 'Khan', 'Murray', 'Clarke', 'Wright', 'Ng', 'Robinson', 'Dupont', 'Muller', 'Lee', 'Campbell'],
  media: ['Rivera', 'Kim', 'Bennett', 'Foster', 'Hayes', 'Coleman', 'Ortega', 'Perry', 'Russo', 'Hughes', 'Price', 'Sanders', 'Webb', 'Diaz', 'Long', 'Ford', 'Grant', 'Cruz'],
  healthcare: ['Miller', 'Davis', 'Wilson', 'Anderson', 'Thomas', 'Jackson', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Lewis', 'Walker', 'Young', 'Allen', 'King', 'Scott'],
  automotive: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Nagy', 'Tóth', 'Horváth', 'García', 'López', 'Hernández', 'Koch', 'Richter', 'Klein', 'Wolf'],
};
function personName(c: CustomerProfile, r: Rng): string {
  return `${r.pick(FIRST[c.id])} ${r.pick(LAST[c.id])}`;
}
const ROLES: Record<CustomerId, Record<string, string[]>> = {
  maritime: { ops: ['Crane operator', 'Shift supervisor', 'Yard planner', 'Gate clerk'], crew: ['Second officer', 'Chief officer', 'ETO', 'Third engineer'], eng: ['Crane technician', 'Electrical engineer', 'Reefer technician'], fin: ['Accounts payable clerk', 'Procurement officer', 'Treasury analyst'], com: ['Customer service agent', 'Key account manager', 'Booking agent'], customs: ['Customs broker', 'Documentation clerk'], it: ['Service desk analyst', 'Network engineer', 'Domain admin'], hr: ['HR advisor', 'Executive assistant', 'Legal counsel'] },
  finserv: { retail: ['Branch adviser', 'Mortgage adviser', 'Branch manager'], contact: ['Contact centre agent', 'Team leader', 'Fraud line agent'], pay: ['Payments operator', 'SWIFT operator', 'Reconciliation analyst'], markets: ['FX trader', 'Sales trader', 'Middle office analyst'], wealth: ['Relationship manager', 'Client service associate'], fin: ['Treasury analyst', 'Accounts payable lead'], tech: ['Platform engineer', 'Help-desk analyst', 'Cloud admin'], hr: ['Executive assistant', 'HR business partner', 'Paralegal'] },
  media: { prod: ['Production coordinator', 'Line producer', 'Location manager'], post: ['Editor', 'VFX compositor', 'Colourist'], mkt: ['Publicist', 'Social media manager', 'Marketing coordinator'], dist: ['Licensing manager', 'Delivery coordinator'], eng: ['Backend engineer', 'SRE', 'Data engineer'], live: ['Broadcast engineer', 'Playout operator', 'Producer'], fin: ['Production accountant', 'Payroll specialist'], talent: ['Talent coordinator', 'Executive assistant', 'Business affairs'] },
  healthcare: { nursing: ['Registered nurse', 'Charge nurse', 'Nurse manager'], phys: ['Resident physician', 'Attending physician', 'Hospitalist'], clin: ['Lab technologist', 'Radiology tech', 'Respiratory therapist'], rev: ['Billing specialist', 'Patient access rep', 'Coder'], pharm: ['Pharmacist', 'Pharmacy tech'], research: ['Research coordinator', 'Data manager', 'Lab scientist'], it: ['Epic analyst', 'Clinical engineer', 'Service desk analyst'], admin: ['Unit secretary', 'HR generalist', 'Executive assistant'] },
  automotive: { plant: ['Line supervisor', 'Maintenance technician', 'Shift engineer', 'Quality inspector'], rnd: ['Powertrain engineer', 'Software engineer', 'Test engineer'], design: ['Exterior designer', 'Clay modeller', 'CAD specialist'], vsec: ['VSOC analyst', 'OTA release engineer'], proc: ['Buyer', 'Supplier quality engineer', 'Logistics planner'], fin: ['Accounts payable clerk', 'Controller'], sales: ['Dealer account manager', 'Fleet sales manager', 'Dealer finance clerk'], it: ['Service desk analyst', 'SAP basis admin', 'Cloud engineer'] },
};

/* ---------------- Overview & trend ---------------- */
export interface HumanOverview {
  score: number;
  scoreDelta: number;
  riPillar: number;
  clickRate: number;
  submitRate: number;
  reportRate: number;
  ratio: number;
  completion: number;
  overdue: number;
  riskyUsers: number;
  mttrMin: number;
  months: string[];
  clickSeries: number[];
  reportSeries: number[];
  submitSeries: number[];
  completionSeries: number[];
  scoreSeries: number[];
  headcount: number;
}
const BASE: Record<CustomerId, { click: number; report: number; submit: number; completion: number; risky: number }> = {
  maritime: { click: 8.4, report: 31, submit: 2.9, completion: 86, risky: 0.009 },
  finserv: { click: 4.1, report: 58, submit: 1.1, completion: 96, risky: 0.006 },
  media: { click: 10.2, report: 24, submit: 3.8, completion: 74, risky: 0.014 },
  healthcare: { click: 9.1, report: 29, submit: 3.3, completion: 83, risky: 0.011 },
  automotive: { click: 6.2, report: 41, submit: 2.0, completion: 89, risky: 0.007 },
};
const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

export function humanOverview(c: CustomerProfile, tenantId: string): HumanOverview {
  const r = rng(`hr-ov-${c.id}-${tenantId}`);
  const b = BASE[c.id];
  const t = scopedTenants(c, tenantId);
  const headcount = t.reduce((s, x) => s + x.people, 0);
  const adj = tenantId === 'all' ? 1 : r.float(0.8, 1.25, 2);
  const click = +(b.click * adj).toFixed(1);
  const report = Math.round(b.report / adj);
  const submit = +(b.submit * adj).toFixed(1);
  const completion = Math.min(99, Math.round(b.completion / Math.sqrt(adj)));
  const clickSeries = MONTHS.map((_, i) => +(click * (1.7 - (i / 11) * 0.7) + (r() - 0.5) * 1.2).toFixed(1));
  clickSeries[11] = click;
  const reportSeries = MONTHS.map((_, i) => Math.round(report * (0.55 + (i / 11) * 0.45) + (r() - 0.5) * 4));
  reportSeries[11] = report;
  const submitSeries = clickSeries.map((v) => +(v * (submit / click) + (r() - 0.5) * 0.3).toFixed(1));
  submitSeries[11] = submit;
  const completionSeries = MONTHS.map((_, i) => Math.min(100, Math.round(completion * (0.78 + (i / 11) * 0.22) + (r() - 0.5) * 3)));
  completionSeries[11] = completion;
  const scoreOf = (cl: number, rep: number, comp: number) => Math.round(Math.max(8, Math.min(92, cl * 2.6 + (100 - rep) * 0.22 + (100 - comp) * 0.5 + 4)));
  const scoreSeries = MONTHS.map((_, i) => scoreOf(clickSeries[i], reportSeries[i], completionSeries[i]));
  const score = scoreSeries[11];
  const share = tenantShare(c, tenantId);
  const riskyUsers = Math.max(6, Math.round(Math.min(140, Math.round(c.employees * b.risky)) * share));
  return {
    score, scoreDelta: score - scoreSeries[8], riPillar: 100 - score,
    clickRate: click, submitRate: submit, reportRate: report, ratio: +(report / click).toFixed(1), completion,
    overdue: Math.round(headcount * (100 - completion) / 100 * 0.55), riskyUsers, mttrMin: r.int(4, 22),
    months: MONTHS, clickSeries, reportSeries, submitSeries, completionSeries, scoreSeries, headcount,
  };
}

/* ---------------- Phishing simulations ---------------- */
export type Channel = 'Email' | 'SMS' | 'QR code' | 'Voice' | 'Teams / chat';
export type CampaignStatus = 'Completed' | 'Running' | 'Scheduled';
export interface DeptResult { deptId: string; sent: number; clicked: number; submitted: number; reported: number }
export interface Campaign {
  id: string;
  name: string;
  theme: string;
  channel: Channel;
  difficulty: 1 | 2 | 3 | 4 | 5;
  launchedDays: number;
  status: CampaignStatus;
  sent: number;
  opened: number;
  clicked: number;
  submitted: number;
  reported: number;
  medianReportMin: number;
  byDept: DeptResult[];
  cues: string[];
  local?: boolean;
}
export const THEMES: Record<CustomerId, { theme: string; channel: Channel; d: 1 | 2 | 3 | 4 | 5; cues: string[] }[]> = {
  maritime: [
    { theme: 'Bill of lading amendment (attachment)', channel: 'Email', d: 3, cues: ['Lookalike carrier domain', 'Unexpected attachment', 'Urgent cut-off'] },
    { theme: 'Port state control inspection notice', channel: 'Email', d: 4, cues: ['Authority impersonation', 'Login to “PSC portal”'] },
    { theme: 'Crew change visa update', channel: 'Email', d: 3, cues: ['Personal-data request', 'Free-mail sender'] },
    { theme: 'Bunker invoice discrepancy', channel: 'Email', d: 4, cues: ['Bank-detail change', 'Reply-to mismatch'] },
    { theme: 'VSAT airtime top-up (QR on bridge notice)', channel: 'QR code', d: 3, cues: ['QR code to a login page', 'Unusual payment request'] },
    { theme: 'Customs hold: release fee', channel: 'SMS', d: 2, cues: ['Short link', 'Payment pressure'] },
    { theme: 'Microsoft 365 password expiry', channel: 'Email', d: 2, cues: ['Generic greeting', 'Credential page'] },
  ],
  finserv: [
    { theme: 'SWIFT payment recall request', channel: 'Email', d: 5, cues: ['Counterparty lookalike', 'Out-of-hours urgency'] },
    { theme: 'Bonus letter (DocuSign)', channel: 'Email', d: 4, cues: ['E-signature brand abuse', 'Credential page'] },
    { theme: 'Help-desk MFA re-enrolment call', channel: 'Voice', d: 5, cues: ['Caller asks for a code', 'Authority and urgency'] },
    { theme: 'Corporate card suspended', channel: 'SMS', d: 3, cues: ['Short link', 'Account threat'] },
    { theme: 'Client KYC refresh via shared drive', channel: 'Email', d: 4, cues: ['External share link', 'Client name in subject'] },
    { theme: 'Regulator consultation response', channel: 'Email', d: 4, cues: ['Authority impersonation', 'Macro attachment'] },
    { theme: 'Teams message from “IT”', channel: 'Teams / chat', d: 3, cues: ['External tenant', 'Remote-support tool link'] },
  ],
  media: [
    { theme: 'Awards-season screener link', channel: 'Email', d: 4, cues: ['Lookalike screener platform', 'Login to watch'] },
    { theme: 'Script revision v7 shared', channel: 'Email', d: 3, cues: ['File-share brand abuse', 'Credential page'] },
    { theme: 'Talent agency contract for signature', channel: 'Email', d: 4, cues: ['E-signature brand abuse', 'Unknown agency'] },
    { theme: 'Dailies review portal', channel: 'Email', d: 3, cues: ['New portal', 'Credential page'] },
    { theme: 'Casting call (attachment)', channel: 'Email', d: 2, cues: ['Executable in archive', 'Free-mail sender'] },
    { theme: 'Festival accreditation via QR', channel: 'QR code', d: 3, cues: ['QR code to a login page'] },
    { theme: 'Royalty statement available', channel: 'Email', d: 3, cues: ['Payment lure', 'Reply-to mismatch'] },
  ],
  healthcare: [
    { theme: 'Epic password expiry', channel: 'Email', d: 3, cues: ['Lookalike SSO page', 'Generic greeting'] },
    { theme: 'Patient lab results shared externally', channel: 'Email', d: 4, cues: ['PHI lure', 'External share link'] },
    { theme: 'Direct-deposit change (Workday)', channel: 'Email', d: 4, cues: ['Payroll lure', 'Credential page'] },
    { theme: 'Shift swap portal', channel: 'SMS', d: 3, cues: ['Short link', 'Personal phone'] },
    { theme: 'Medicare audit request', channel: 'Email', d: 4, cues: ['Authority impersonation', 'Attachment'] },
    { theme: 'Flu clinic sign-up QR (break room)', channel: 'QR code', d: 2, cues: ['QR code to a login page'] },
    { theme: 'Help-desk call: badge-tap reset', channel: 'Voice', d: 5, cues: ['Caller asks for a code', 'Authority and urgency'] },
  ],
  automotive: [
    { theme: 'Supplier portal: PPAP rejected', channel: 'Email', d: 4, cues: ['Supplier lookalike', 'Attachment'] },
    { theme: 'TISAX audit document request', channel: 'Email', d: 4, cues: ['Assessor impersonation', 'External share link'] },
    { theme: 'Prototype test-drive schedule', channel: 'Email', d: 3, cues: ['Confidential lure', 'Credential page'] },
    { theme: 'Dealer incentive programme', channel: 'Email', d: 3, cues: ['Payment lure', 'Reply-to mismatch'] },
    { theme: 'Payslip available (SAP)', channel: 'Email', d: 2, cues: ['Payroll lure', 'Generic greeting'] },
    { theme: 'Canteen menu QR (plant notice board)', channel: 'QR code', d: 2, cues: ['QR code to a login page'] },
    { theme: 'OTA release approval needed', channel: 'Teams / chat', d: 5, cues: ['External tenant', 'Urgent approval'] },
  ],
};

export function campaigns(c: CustomerProfile, tenantId: string): Campaign[] {
  const r = rng(`hr-camp-${c.id}-${tenantId}`);
  const ov = humanOverview(c, tenantId);
  const depts = departments(c, tenantId);
  const themes = THEMES[c.id];
  const n = 11;
  const out: Campaign[] = [];
  for (let i = 0; i < n; i++) {
    const th = themes[i % themes.length];
    const status: CampaignStatus = i === 0 ? 'Running' : 'Completed';
    const launchedDays = i === 0 ? r.int(1, 4) : 8 + i * r.int(18, 30);
    const age = Math.min(1, launchedDays / 330);
    const clickP = Math.max(0.01, (ov.clickRate / 100) * (1 + age * 0.45) * (0.7 + th.d * 0.1));
    const reportP = Math.min(0.9, (ov.reportRate / 100) * (1 - age * 0.35));
    const byDept: DeptResult[] = (th.channel === 'Voice' ? r.pickN(depts, 3) : depts).map((d) => {
      const sent = th.channel === 'Voice' ? r.int(10, 30) : Math.max(4, Math.round(d.headcount * r.float(0.25, 0.9, 2)));
      const clicked = Math.round(sent * Math.min(0.6, clickP * d.risk * r.float(0.7, 1.3, 2)) * (status === 'Running' ? 0.6 : 1));
      const submitted = Math.round(clicked * r.float(0.25, 0.5, 2));
      const reported = Math.round(sent * Math.min(0.85, reportP / d.risk * r.float(0.8, 1.2, 2)) * (status === 'Running' ? 0.6 : 1));
      return { deptId: d.id, sent, clicked, submitted, reported };
    });
    const sent = byDept.reduce((s, d) => s + d.sent, 0);
    const clicked = byDept.reduce((s, d) => s + d.clicked, 0);
    out.push({
      id: `SIM-${String(240 - i * 7).padStart(4, '0')}`,
      name: `${MONTHS[Math.max(0, 11 - Math.floor(launchedDays / 30))]} · ${th.theme.split(' (')[0]}`,
      theme: th.theme, channel: th.channel, difficulty: th.d, launchedDays, status, sent,
      opened: Math.round(sent * r.float(0.45, 0.75, 2)), clicked,
      submitted: byDept.reduce((s, d) => s + d.submitted, 0),
      reported: byDept.reduce((s, d) => s + d.reported, 0),
      medianReportMin: r.int(3, 40), byDept, cues: th.cues,
    });
  }
  return out;
}

/* ---------------- Training ---------------- */
export interface Course {
  id: string;
  title: string;
  kind: 'Core' | 'Sector' | 'Role-based' | 'Micro';
  audience: string;
  minutes: number;
  mandatory: boolean;
  refs: string[];
  assigned: number;
  completed: number;
  overdue: number;
  avgScore: number;
  /** % complete per department id. */
  byDept: Record<string, number>;
}
type CourseTpl = { title: string; kind: Course['kind']; audience: string; minutes: number; mandatory: boolean; refs: string[]; depts?: string[] };
const CORE: CourseTpl[] = [
  { title: 'Annual security awareness', kind: 'Core', audience: 'All staff', minutes: 35, mandatory: true, refs: ['ISO 27001 A.6.3'] },
  { title: 'Spotting and reporting phishing', kind: 'Core', audience: 'All staff', minutes: 15, mandatory: true, refs: ['ISO 27001 A.6.3', 'NIST CSF PR.AT-01'] },
  { title: 'Using AI tools safely', kind: 'Core', audience: 'All staff', minutes: 12, mandatory: false, refs: ['ISO 42001 A.4', 'AI acceptable use'] },
  { title: 'Privileged access: admin hygiene', kind: 'Role-based', audience: 'IT & admins', minutes: 25, mandatory: true, refs: ['ISO 27001 A.8.2'] },
  { title: 'Payment fraud and CEO fraud', kind: 'Role-based', audience: 'Finance & assistants', minutes: 20, mandatory: true, refs: ['ISO 27001 A.6.3'] },
  { title: 'Verify before you act: call-back rule', kind: 'Micro', audience: 'Assigned after a simulation click', minutes: 4, mandatory: false, refs: ['Coaching'] },
];
const SECTOR: Record<CustomerId, CourseTpl[]> = {
  maritime: [
    { title: 'Ship crew cyber hygiene: USB and removable media', kind: 'Sector', audience: 'Ship crew', minutes: 20, mandatory: true, refs: ['IMO MSC.428(98)', 'IACS UR E26'], depts: ['crew', 'eng'] },
    { title: 'ECDIS and bridge systems: chart updates safely', kind: 'Sector', audience: 'Deck officers', minutes: 25, mandatory: true, refs: ['IMO MSC-FAL.1/Circ.3', 'IACS UR E27'], depts: ['crew'] },
    { title: 'Terminal OT: no personal devices on crane networks', kind: 'Sector', audience: 'Terminal operations', minutes: 15, mandatory: true, refs: ['IEC 62443-2-1', 'ISPS'], depts: ['ops', 'eng'] },
    { title: 'Shipping documents fraud (B/L, customs)', kind: 'Sector', audience: 'Customs & commercial', minutes: 18, mandatory: false, refs: ['NIS2 Art. 21(2)(g)'], depts: ['customs', 'com', 'fin'] },
  ],
  finserv: [
    { title: 'Payment fraud: APP scams and mandate changes', kind: 'Sector', audience: 'Payments & contact centre', minutes: 25, mandatory: true, refs: ['DORA Art. 13(6)', 'PCI DSS 12.6'], depts: ['pay', 'contact', 'retail', 'fin'] },
    { title: 'Help-desk social engineering (Scattered Spider pattern)', kind: 'Sector', audience: 'Service desk & contact centre', minutes: 20, mandatory: true, refs: ['DORA Art. 13(6)', 'NYDFS 500.14'], depts: ['tech', 'contact'] },
    { title: 'Cardholder data handling', kind: 'Sector', audience: 'Payments', minutes: 15, mandatory: true, refs: ['PCI DSS 12.6.1'], depts: ['pay', 'contact'] },
    { title: 'Market abuse & information barriers', kind: 'Sector', audience: 'Markets & wealth', minutes: 30, mandatory: true, refs: ['FCA SYSC', 'NYDFS 500.14'], depts: ['markets', 'wealth'] },
  ],
  media: [
    { title: 'Pre-release content: leaks and screeners', kind: 'Sector', audience: 'Production, post & marketing', minutes: 20, mandatory: true, refs: ['TPN', 'MPA CSBP MS-1.0'], depts: ['prod', 'post', 'mkt', 'dist'] },
    { title: 'Working on set: devices, photos and NDAs', kind: 'Sector', audience: 'Production & talent', minutes: 15, mandatory: true, refs: ['MPA CSBP PS-14.0'], depts: ['prod', 'talent'] },
    { title: 'Content transfer and watermarking', kind: 'Sector', audience: 'Post & VFX', minutes: 18, mandatory: true, refs: ['TPN', 'DPP CtS'], depts: ['post', 'dist'] },
    { title: 'Social media and talent account security', kind: 'Sector', audience: 'Marketing & talent', minutes: 12, mandatory: false, refs: ['MPA CSBP MS-1.0'], depts: ['mkt', 'talent'] },
  ],
  healthcare: [
    { title: 'Clinical phishing: Epic, MyChart and lab-result lures', kind: 'Sector', audience: 'Clinical staff', minutes: 15, mandatory: true, refs: ['HIPAA 164.308(a)(5)', 'HPH CPG 1.3'], depts: ['nursing', 'phys', 'clin', 'pharm'] },
    { title: 'Patient data: minimum necessary and snooping', kind: 'Sector', audience: 'All workforce', minutes: 20, mandatory: true, refs: ['HIPAA 164.308(a)(5)', 'HITRUST 02.e'] },
    { title: 'Shared workstations and badge-tap sign-in', kind: 'Sector', audience: 'Clinical staff', minutes: 10, mandatory: true, refs: ['HIPAA 164.312(a)(1)'], depts: ['nursing', 'phys', 'clin'] },
    { title: 'Research data and genomics privacy', kind: 'Sector', audience: 'Research', minutes: 25, mandatory: true, refs: ['HIPAA', 'NIST CSF PR.AT-01'], depts: ['research'] },
  ],
  automotive: [
    { title: 'Engineering IP: prototypes, CAD and camouflage', kind: 'Sector', audience: 'R&D and design', minutes: 25, mandatory: true, refs: ['TISAX 8.1.1', 'TISAX 2.1.2'], depts: ['rnd', 'design', 'proc'] },
    { title: 'Plant floor: USB, laptops and OT networks', kind: 'Sector', audience: 'Plant operations', minutes: 15, mandatory: true, refs: ['IEC 62443-2-1', 'NIS2 Art. 21(2)(g)'], depts: ['plant'] },
    { title: 'Vehicle cybersecurity awareness (CSMS)', kind: 'Sector', audience: 'Engineering & VSOC', minutes: 30, mandatory: true, refs: ['UNECE R155', 'ISO/SAE 21434'], depts: ['rnd', 'vsec'] },
    { title: 'Supplier bank-detail fraud', kind: 'Sector', audience: 'Procurement & finance', minutes: 15, mandatory: true, refs: ['TISAX 2.1.2'], depts: ['proc', 'fin', 'sales'] },
  ],
};
const ROLE_DEPTS: Record<string, (c: CustomerProfile) => string[]> = {
  'IT & admins': (c) => DEPTS[c.id].filter((d) => /IT|Technology|Engineering$/.test(d.name)).map((d) => d.id),
  'Finance & assistants': (c) => DEPTS[c.id].filter((d) => /Finance|Payments|Revenue|Executive|Procurement/.test(d.name)).map((d) => d.id),
};
export function courses(c: CustomerProfile, tenantId: string): Course[] {
  const r = rng(`hr-courses-${c.id}-${tenantId}`);
  const ov = humanOverview(c, tenantId);
  const depts = departments(c, tenantId);
  const all = [...CORE.slice(0, 2), ...SECTOR[c.id], ...CORE.slice(2)];
  return all.map((t, i) => {
    const targets = t.depts ?? (ROLE_DEPTS[t.audience]?.(c) ?? null);
    const ds = targets ? depts.filter((d) => targets.includes(d.id)) : depts;
    const base = t.kind === 'Micro' ? 70 : t.mandatory ? ov.completion : ov.completion - 18;
    const byDept: Record<string, number> = {};
    let assigned = 0;
    let completed = 0;
    for (const d of ds) {
      const pct = Math.max(30, Math.min(100, Math.round(base - (d.risk - 1) * 22 + (r() - 0.5) * 12)));
      byDept[d.id] = pct;
      const a = t.kind === 'Micro' ? Math.max(2, Math.round(d.headcount * 0.02)) : d.headcount;
      assigned += a;
      completed += Math.round((a * pct) / 100);
    }
    const overdue = Math.round((assigned - completed) * (t.mandatory ? 0.6 : 0.2));
    return { id: `CRS-${String(i + 1).padStart(2, '0')}`, ...t, assigned, completed, overdue, avgScore: r.int(78, 94), byDept };
  }).filter((k) => k.assigned > 0);
}

export interface Learner { id: string; name: string; deptId: string; role: string; tenantId: string; courseId: string; daysOverdue: number; reminders: number; manager: string }
export function overdueLearners(c: CustomerProfile, tenantId: string, cs: Course[]): Learner[] {
  const r = rng(`hr-overdue-${c.id}-${tenantId}`);
  const depts = departments(c, tenantId);
  const ts = scopedTenants(c, tenantId);
  const out: Learner[] = [];
  const mand = cs.filter((x) => x.mandatory && x.overdue > 0);
  const n = Math.min(60, Math.max(12, Math.round(mand.reduce((s, x) => s + x.overdue, 0) / 12)));
  for (let i = 0; i < n; i++) {
    const course = r.pick(mand.length ? mand : cs);
    const dIds = Object.keys(course.byDept);
    const d = depts.find((x) => x.id === r.pick(dIds)) ?? r.pick(depts);
    const tId = d.tenants ? r.pick(d.tenants.filter((t) => ts.some((x) => x.id === t)).concat(ts.length === 1 ? [ts[0].id] : [])) ?? ts[0].id : r.pick(ts).id;
    out.push({ id: `L-${i + 1}`, name: personName(c, r), deptId: d.id, role: r.pick(ROLES[c.id][d.id] ?? ['Staff']), tenantId: tId ?? ts[0].id, courseId: course.id, daysOverdue: r.int(1, 75), reminders: r.int(0, 4), manager: personName(c, r) });
  }
  return out.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/* ---------------- Risky users ---------------- */
export type MfaState = 'Phishing-resistant' | 'Push / app' | 'SMS' | 'None';
export type TrainingState = 'Complete' | 'In progress' | 'Overdue';
export type UserAction = 'Enrol in coaching' | 'Enforce MFA' | 'Assign micro-training' | 'Remove standing admin' | 'Manager conversation';
export interface RiskyUser {
  id: string;
  name: string;
  deptId: string;
  role: string;
  tenantId: string;
  score: number;
  clicks12m: number;
  submits12m: number;
  reports12m: number;
  lastClickDays: number | null;
  training: TrainingState;
  overdueCourses: number;
  mfa: MfaState;
  privileged: boolean;
  stealerHit: boolean;
  incidents: { id: string; title: string }[];
  drivers: string[];
  actions: UserAction[];
}
export function riskyUsers(c: CustomerProfile, tenantId: string): RiskyUser[] {
  const r = rng(`hr-risky-${c.id}-${tenantId}`);
  const ov = humanOverview(c, tenantId);
  const depts = departments(c, tenantId);
  const ts = scopedTenants(c, tenantId);
  const inc = incidents(c, tenantId, 90).filter((i) => i.techniques.some((t) => t.startsWith('T1566') || t === 'T1657' || t === 'T1621' || t === 'T1204.002' || t === 'T1098'));
  const used = new Set<string>();
  const out: RiskyUser[] = [];
  for (let i = 0; i < ov.riskyUsers; i++) {
    const d = r.weighted(depts.map((x) => [x, x.share * x.risk * x.risk] as const));
    let name = personName(c, r);
    let g = 0;
    while (used.has(name) && g++ < 12) name = personName(c, r);
    used.add(name);
    const clicks = r.weighted([[1, 3], [2, 4], [3, 3], [4, 2], [5, 1]] as const);
    const submits = Math.min(clicks, r.weighted([[0, 3], [1, 4], [2, 2], [3, 1]] as const));
    const reports = r.int(0, 3);
    const training = r.weighted<TrainingState>([['Overdue', 4], ['In progress', 3], ['Complete', 3]]);
    const priv = d.id === 'it' || d.id === 'tech' || d.id === 'vsec' ? r.chance(0.55) : r.chance(0.08);
    const mfa = r.weighted<MfaState>([['None', priv ? 1 : 2], ['SMS', 3], ['Push / app', 5], ['Phishing-resistant', priv ? 3 : 1]]);
    const stealer = r.chance(0.12);
    const myInc = inc.length && r.chance(0.22) ? [r.pick(inc)].map((x) => ({ id: x.id, title: x.title })) : [];
    const score = Math.min(99, Math.round(30 + clicks * 7 + submits * 9 - reports * 4 + (training === 'Overdue' ? 10 : training === 'In progress' ? 4 : 0) + (mfa === 'None' ? 14 : mfa === 'SMS' ? 7 : 0) + (priv ? 8 : 0) + (stealer ? 10 : 0) + myInc.length * 8));
    const drivers: string[] = [];
    if (submits) drivers.push(`Entered credentials in ${submits} simulation${submits > 1 ? 's' : ''}`);
    else drivers.push(`Clicked ${clicks} simulation${clicks > 1 ? 's' : ''} in 12 months`);
    if (training === 'Overdue') drivers.push('Mandatory training overdue');
    if (mfa === 'None' || mfa === 'SMS') drivers.push(mfa === 'None' ? 'No MFA registered' : 'SMS-only MFA');
    if (priv) drivers.push('Holds privileged access');
    if (stealer) drivers.push('Corporate credential seen in an infostealer log');
    if (myInc.length) drivers.push('Involved in a real incident');
    const actions: UserAction[] = [];
    if (submits >= 1 || clicks >= 3) actions.push('Enrol in coaching');
    if (mfa === 'None' || mfa === 'SMS' || (priv && mfa !== 'Phishing-resistant')) actions.push('Enforce MFA');
    if (training !== 'Complete') actions.push('Assign micro-training');
    if (priv && (submits || stealer)) actions.push('Remove standing admin');
    if (clicks >= 4) actions.push('Manager conversation');
    const tId = d.tenants ? (d.tenants.filter((t) => ts.some((x) => x.id === t))[0] ?? ts[0].id) : r.pick(ts).id;
    out.push({
      id: `HU-${String(i + 1).padStart(3, '0')}`, name, deptId: d.id, role: r.pick(ROLES[c.id][d.id] ?? ['Staff']), tenantId: d.tenants && d.tenants.length > 1 ? r.pick(d.tenants.filter((t) => ts.some((x) => x.id === t))) ?? tId : tId,
      score, clicks12m: clicks, submits12m: submits, reports12m: reports, lastClickDays: r.int(2, 200), training, overdueCourses: training === 'Overdue' ? r.int(1, 3) : 0,
      mfa, privileged: priv, stealerHit: stealer, incidents: myInc, drivers, actions,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ---------------- Culture & policy ---------------- */
export interface Policy { id: string; name: string; version: string; publishedDays: number; audience: string; acknowledged: number; required: number; refs: string[] }
const SECTOR_POLICIES: Record<CustomerId, [string, string, string[]][]> = {
  maritime: [['Shipboard removable media & USB', 'Ship crew', ['IMO MSC.428(98)', 'IACS UR E26']], ['OT remote access & vendor laptops', 'Terminal & engineering', ['IEC 62443-2-1']]],
  finserv: [['Information barriers & market abuse', 'Markets & wealth', ['FCA SYSC 10']], ['Payment authorisation & call-back', 'Payments & finance', ['DORA Art. 9', 'PCI DSS 12']]],
  media: [['Pre-release content handling', 'Production, post & marketing', ['TPN', 'MPA CSBP']], ['Set photography & personal devices', 'Production & talent', ['MPA CSBP PS-14.0']]],
  healthcare: [['Patient privacy (HIPAA) attestation', 'All workforce', ['HIPAA 164.308(a)(5)']], ['Medical device & shared workstation use', 'Clinical staff', ['HIPAA 164.310(d)(1)', 'FDA 524B']]],
  automotive: [['Prototype & camouflage policy', 'R&D, design & plants', ['TISAX 8.1.1']], ['Plant floor removable media', 'Plant operations', ['IEC 62443-2-1']]],
};
export function policies(c: CustomerProfile, tenantId: string): Policy[] {
  const r = rng(`hr-pol-${c.id}-${tenantId}`);
  const hc = humanOverview(c, tenantId).headcount;
  const base: [string, string, string[]][] = [
    ['Information security policy', 'All staff', ['ISO 27001 A.5.1']],
    ['Acceptable use', 'All staff', ['ISO 27001 A.5.10']],
    ['AI acceptable use', 'All staff', ['ISO 42001', 'EU AI Act Art. 4']],
    ['Remote & hybrid working', 'All staff', ['ISO 27001 A.6.7']],
    ['Clean desk & screen', 'All staff', ['ISO 27001 A.7.7']],
    ['Privileged access standard', 'IT & admins', ['ISO 27001 A.8.2']],
    ...SECTOR_POLICIES[c.id],
  ];
  return base.map(([name, audience, refs], i) => {
    const required = audience === 'All staff' || audience === 'All workforce' ? hc : Math.round(hc * r.float(0.04, 0.35, 2));
    const fresh = r.int(5, 300);
    const pct = name.startsWith('AI') ? r.float(0.55, 0.75, 2) : fresh < 40 ? r.float(0.6, 0.85, 2) : r.float(0.86, 0.99, 2);
    return { id: `POL-${String(i + 1).padStart(2, '0')}`, name, version: `v${r.int(1, 5)}.${r.int(0, 9)}`, publishedDays: fresh, audience, acknowledged: Math.round(required * pct), required, refs };
  });
}

export interface Champion { id: string; name: string; deptId: string; role: string; tenantId: string; sinceMonths: number; reports90d: number; sessions: number; points: number; tier: 'Gold' | 'Silver' | 'Bronze' }
export function champions(c: CustomerProfile, tenantId: string): Champion[] {
  const r = rng(`hr-champ-${c.id}-${tenantId}`);
  const depts = departments(c, tenantId);
  const ts = scopedTenants(c, tenantId);
  const out: Champion[] = [];
  for (const d of depts) {
    const n = Math.max(1, Math.min(6, Math.round(d.headcount / 900) + r.int(0, 2)));
    for (let i = 0; i < n; i++) {
      const pts = r.int(40, 980);
      const tId = d.tenants ? (r.pick(d.tenants.filter((t) => ts.some((x) => x.id === t))) ?? ts[0].id) : r.pick(ts).id;
      out.push({ id: `CH-${out.length + 1}`, name: personName(c, r), deptId: d.id, role: r.pick(ROLES[c.id][d.id] ?? ['Staff']), tenantId: tId, sinceMonths: r.int(1, 30), reports90d: r.int(1, 24), sessions: r.int(0, 9), points: pts, tier: pts > 650 ? 'Gold' : pts > 300 ? 'Silver' : 'Bronze' });
    }
  }
  return out.sort((a, b) => b.points - a.points);
}

export interface CultureDim { key: string; label: string; score: number; prev: number }
export function cultureSurvey(c: CustomerProfile, tenantId: string): { dims: CultureDim[]; responses: number; rate: number } {
  const r = rng(`hr-culture-${c.id}-${tenantId}`);
  const ov = humanOverview(c, tenantId);
  const labels: [string, string][] = [['report', 'I know how to report something suspicious'], ['speak', 'I feel safe admitting a mistake'], ['lead', 'Leaders take security seriously'], ['policy', 'Policies make sense for my job'], ['own', 'Security is part of my job'], ['tools', 'Secure tools do not slow me down']];
  const dims = labels.map(([key, label]) => {
    const score = Math.round(Math.min(95, Math.max(40, 100 - ov.score * 0.55 + (r() - 0.5) * 18)));
    return { key, label, score, prev: Math.max(30, score - r.int(-4, 10)) };
  });
  const responses = Math.round(ov.headcount * r.float(0.28, 0.52, 2));
  return { dims, responses, rate: Math.round((responses / ov.headcount) * 100) };
}
