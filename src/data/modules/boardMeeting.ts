// Board / risk committee meeting workspace (Board module, "Board Meeting" tab).
// Everything here is derived from the customer profile (people, frameworks,
// tenants, insurance, third parties, vocabulary), the shared headlines and a
// seeded RNG. Nothing is keyed by customer id, so new customers work as-is.

import type { CustomerProfile, Person, FrameworkScope } from '../types';
import { rng } from '../../lib/rng';
import { headlines, resilienceIndex, riTrend, riDrivers } from '../core';
import { vrHeadline } from './vulnresponse';
import { scenarios } from './insurance';
import { NOW, daysAgo, daysAhead, fmtMoney, fmtNum, fmtDate } from '../../lib/format';

/** Cross-module helpers may not have data for every customer yet: never let that break the page. */
function safe<T>(f: () => T): T | null {
  try {
    const v = f();
    return v ?? null;
  } catch {
    return null;
  }
}

export type Rag = 'red' | 'amber' | 'green';
export const RAG_COLOR: Record<Rag, string> = { red: 'var(--bad)', amber: 'var(--sev-medium)', green: 'var(--good)' };
export const RAG_HEX: Record<Rag, string> = { red: '#e0345e', amber: '#f0a338', green: '#2dd4bf' };
export const RAG_LABEL: Record<Rag, string> = { red: 'Red', amber: 'Amber', green: 'Green' };

export interface Link { label: string; path: string; source: string }

/* ------------------------------------------------------------------ people */

export type DirectorKind = 'Chair' | 'Non-executive' | 'Executive' | 'In attendance';
export type TrainingStatus = 'Completed' | 'Due soon' | 'Overdue';
export interface Director {
  name: string;
  role: string;
  kind: DirectorKind;
  email: string;
  voting: boolean;
  attending: 'Confirmed' | 'Apologies' | 'Tentative';
  training: { status: TrainingStatus; date: Date; course: string; hours: number; provider: string };
}

const NED_POOL = [
  'Margaret Ellison', 'Thomas Brandt', 'Aiko Tanaka', 'Richard Osei', 'Claire Dubois', 'Henrik Lund', 'Sunita Rao', 'David Whitmore',
  'Elena Marchetti', 'Paul Kessler', 'Grace Mensah', 'Julian Ferreira', 'Anneliese Kraus', 'Robert Chen', 'Fiona MacLeod', 'Samuel Adeyemi',
];
const SECRETARY_POOL = ['Charlotte Hayes', 'Martin Vogt', 'Isabel Moreno', 'Nicholas Grant', 'Leonie Baumann', 'Hannah Lim'];

const slug = (n: string) => n.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');

export function cfoOf(c: CustomerProfile): Person {
  return c.people.staff.find((p) => /\bCFO\b|Chief Financial|Finance Director|Finanz/i.test(p.role))
    ?? { name: 'Group CFO (vacant)', role: 'Chief Financial Officer', email: `cfo@${c.domain}` };
}

/* ------------------------------------------------------------- regulation */

export interface Duty { reg: string; short: string; duty: string; personal: boolean; path: string }

const DUTY_RULES: { test: RegExp; reg: string; short: string; duty: string; personal: boolean }[] = [
  { test: /DORA/i, reg: 'DORA, Art. 5', short: 'DORA', personal: true, duty: 'The management body bears ultimate responsibility for ICT risk: it approves the digital operational resilience strategy, ICT third-party policy and budget, and must keep its own ICT-risk knowledge up to date.' },
  { test: /NIS ?2/i, reg: 'NIS2 Directive, Art. 20', short: 'NIS2', personal: true, duty: 'The management body must approve the cybersecurity risk-management measures, oversee their implementation and follow regular training. Members can be held personally liable for infringements and temporarily barred from management roles.' },
  { test: /NYDFS|23 NYCRR/i, reg: '23 NYCRR 500.4', short: 'NYDFS 500', personal: true, duty: 'The senior governing body must exercise oversight of cyber risk with sufficient expertise, receive the CISO’s annual report, and the CEO and CISO sign the annual certification of compliance.' },
  { test: /\bSEC\b|Form 8-K|10-K/i, reg: 'SEC cybersecurity disclosure rules', short: 'SEC', personal: false, duty: 'The 10-K must describe how the board oversees cyber risk, and material incidents must be disclosed on Form 8-K within four business days of determining materiality.' },
  { test: /CMMC|DFARS|NIST SP 800-171/i, reg: 'CMMC 2.0 (32 CFR 170)', short: 'CMMC', personal: true, duty: 'A senior affirming official must affirm continuing compliance in SPRS every year. A false affirmation exposes the company and individuals to False Claims Act liability.' },
  { test: /HIPAA/i, reg: 'HIPAA Security Rule', short: 'HIPAA', personal: false, duty: 'The organisation must designate a security official, keep an accurate risk analysis and act on it. OCR enforcement and settlements look first at governance and documented risk management.' },
  { test: /\bHIA\b|Health Information Act|Health Information Bill/i, reg: 'Health Information Act (Singapore)', short: 'HIA', personal: true, duty: 'Healthcare providers are accountable for safeguarding patient health information shared through national health records, with penalties for the organisation and for officers who consent to or neglect a breach.' },
  { test: /Cybersecurity Act|CCoP|\bCII\b/i, reg: 'Cybersecurity Act (Singapore) and CCoP', short: 'CSA CII', personal: false, duty: 'As an owner of critical information infrastructure, the company must comply with the Code of Practice, audit every two years and report prescribed incidents within hours.' },
  { test: /SYSC 15A|Op Res|Operational Resilience/i, reg: 'FCA/PRA operational resilience (SYSC 15A)', short: 'FCA Op Res', personal: true, duty: 'The board approves the operational resilience self-assessment, important business services and impact tolerances, and is accountable for remaining within tolerance in a severe but plausible scenario.' },
  { test: /R155/i, reg: 'UNECE R155', short: 'UNECE R155', personal: false, duty: 'Vehicle type approval depends on a certified Cyber Security Management System. Management commitment and monitoring of fleet cyber risk are audited by the approval authority.' },
  { test: /IMO|MSC\.428/i, reg: 'IMO MSC.428(98)', short: 'IMO', personal: false, duty: 'Cyber risk must be addressed in the safety management system and is verified at Document of Compliance audits; the company remains accountable for vessel cyber safety.' },
  { test: /\bTPN\b|MPA/i, reg: 'Studio content-security contracts (TPN, MPA)', short: 'TPN / MPA', personal: false, duty: 'Studio and distributor contracts make the company liable for pre-release leaks in its supply chain; boards are expected to oversee vendor content security.' },
];

export function boardDuties(c: CustomerProfile): Duty[] {
  const corpus = [
    ...c.frameworks.map((f) => `${f.name} ${f.short}`),
    ...c.tenants.flatMap((t) => t.regimes),
  ].join(' | ');
  const out: Duty[] = [];
  for (const d of DUTY_RULES) {
    if (d.test.test(corpus)) out.push({ reg: d.reg, short: d.short, duty: d.duty, personal: d.personal, path: '/comply/horizon?section=board' });
  }
  if (!out.length) {
    out.push({ reg: 'Directors’ general duties', short: 'Directors’ duties', personal: true, path: '/comply/horizon?section=board', duty: 'Directors’ duties of care, skill and diligence extend to overseeing cyber risk: courts and regulators expect the board to be informed, to challenge and to minute its decisions.' });
  }
  return out;
}

/** The framework that matters most to the board: one that puts duties on directors, else the first regulation. */
export function mainFramework(c: CustomerProfile): FrameworkScope | null {
  for (const d of DUTY_RULES) {
    if (!d.personal) continue;
    const f = c.frameworks.find((x) => d.test.test(`${x.name} ${x.short}`));
    if (f) return f;
  }
  return c.frameworks.find((f) => f.kind === 'Regulation') ?? c.frameworks[0] ?? null;
}

function trainingCourse(duties: Duty[]): string {
  if (duties.some((d) => d.short === 'NIS2')) return 'NIS2 Art. 20(2) management-body cyber training';
  if (duties.some((d) => d.short === 'DORA')) return 'DORA Art. 5(4) ICT risk training for the management body';
  if (duties.some((d) => d.short === 'CMMC')) return 'CMMC affirmation and CUI oversight for senior officials';
  if (duties.some((d) => d.short === 'NYDFS 500')) return 'NYDFS 500.4 board cyber oversight briefing';
  return 'Board cyber-risk governance and crisis decision-making';
}

/* ---------------------------------------------------------------- meeting */

export type PaperStage = 'drafted' | 'approved' | 'circulated';
export interface Paper { id: string; title: string; path: string; source: string; owner: Person; pages: number; drafted: boolean; approved: boolean; circulated: boolean }
export type Purpose = 'For approval' | 'For decision' | 'For discussion' | 'For noting';
export interface AgendaItem { n: number; title: string; purpose: Purpose; minutes: number; presenter: Person; papers: Paper[]; tone: string }

export interface Meeting {
  committee: string;
  isBoard: boolean;
  date: Date;
  daysTo: number;
  time: string;
  location: string;
  prevDate: Date;
  packDue: Date;
  directors: Director[];
  quorum: number;
  agenda: AgendaItem[];
  incidentsSince: { handled: number; major: number; notifiable: number; days: number };
  chair: Director;
  secretary: Director;
}

export function boardMeeting(c: CustomerProfile): Meeting {
  const r = rng(`board-${c.id}`);
  const h = headlines(c);
  const duties = boardDuties(c);
  const cfo = cfoOf(c);
  const corpus = c.frameworks.map((f) => f.short).join(' ') + c.tenants.flatMap((t) => t.regimes).join(' ');
  const riskCommittee = /DORA|NYDFS|Op Res|SEC|PRA/i.test(corpus) ? 'Board Risk Committee' : 'Audit & Risk Committee';
  const isBoard = r.chance(0.45);
  const committee = isBoard ? 'Board of Directors' : riskCommittee;
  const daysTo = r.int(9, 16);
  const date = daysAhead(daysTo);
  date.setHours(r.pick([9, 10, 14]), r.pick([0, 30]), 0, 0);
  const prevDate = daysAgo(r.int(78, 96));
  const packDue = daysAhead(daysTo - 7);
  const course = trainingCourse(duties);
  const hq = c.hq.split(',')[0];

  const people = new Set([c.people.board.name, cfo.name, c.people.ciso.name, c.people.grcLead.name]);
  const neds = r.shuffle(NED_POOL).filter((n) => !people.has(n)).slice(0, 4);
  const secName = r.pick(SECRETARY_POOL);

  const training = (forceOverdue = false): Director['training'] => {
    const status: TrainingStatus = forceOverdue ? 'Overdue' : r.weighted([['Completed', 0.66], ['Due soon', 0.16], ['Overdue', 0.18]] as const);
    const date = status === 'Completed' ? daysAgo(r.int(20, 320)) : status === 'Overdue' ? daysAgo(r.int(6, 58)) : daysAhead(r.int(5, 30));
    return { status, date, course, hours: r.pick([2, 3, 4]), provider: r.pick(['HexaShield board academy', 'Institute of Directors', 'External counsel briefing', 'HexaShield board academy']) };
  };

  const mk = (name: string, role: string, kind: DirectorKind, voting: boolean, email?: string, forceOverdue = false): Director => ({
    name, role, kind, voting, email: email ?? `${slug(name)}@${c.domain}`,
    attending: r.chance(0.12) && kind === 'Non-executive' ? 'Apologies' : r.chance(0.08) ? 'Tentative' : 'Confirmed',
    training: training(forceOverdue),
  });

  const overdueIdx = r.int(1, 3);
  const directors: Director[] = [
    mk(neds[0], 'Independent Non-executive Chair', 'Chair', true),
    mk(neds[1], `Chair, ${riskCommittee}`, 'Non-executive', true, undefined, overdueIdx === 1),
    mk(neds[2], 'Senior Independent Director', 'Non-executive', true, undefined, overdueIdx === 2),
    mk(neds[3], 'Non-executive Director (technology and cyber)', 'Non-executive', true, undefined, overdueIdx === 3),
    mk(c.people.board.name, c.people.board.role, 'Executive', isBoard, c.people.board.email),
    mk(cfo.name, cfo.role, 'Executive', isBoard, cfo.email),
    mk(c.people.ciso.name, c.people.ciso.role, 'In attendance', false, c.people.ciso.email),
    mk(c.people.grcLead.name, c.people.grcLead.role, 'In attendance', false, c.people.grcLead.email),
    mk(secName, 'Company Secretary', 'In attendance', false),
  ];
  directors[0].attending = 'Confirmed';
  const voting = directors.filter((d) => d.voting).length;
  const quorum = isBoard ? Math.ceil(voting / 2) : 2;

  const ciso = c.people.ciso;
  const grc = c.people.grcLead;
  const chairP: Person = { name: directors[0].name, role: directors[0].role, email: directors[0].email };
  const secP: Person = { name: secName, role: 'Company Secretary', email: directors[8].email };
  const main = mainFramework(c);

  let pid = 0;
  const paper = (title: string, path: string, source: string, owner: Person, stage: 0 | 1 | 2 | 3): Paper => ({
    id: `P${++pid}`, title, path, source, owner, pages: r.int(2, 9), drafted: stage >= 1, approved: stage >= 2, circulated: stage >= 3,
  });
  const st = (): 0 | 1 | 2 | 3 => r.weighted([[1, 0.35], [2, 0.4], [3, 0.15], [0, 0.1]] as const);

  const agenda: AgendaItem[] = [
    { n: 1, title: 'Welcome, apologies, declarations of interest and minutes of the last meeting', purpose: 'For approval', minutes: 5, presenter: chairP, tone: '#8593b4',
      papers: [paper(`Draft minutes, ${fmtDate(prevDate)}`, '/board/meeting?section=minutes', 'HexaView board workspace', secP, 3), paper('Matters arising and action log', '/board/meeting?section=actions', 'HexaView board workspace', secP, st())] },
    { n: 2, title: 'Cyber resilience report: Resilience Index and principal risks', purpose: 'For discussion', minutes: 20, presenter: ciso, tone: '#20b292',
      papers: [paper('Board cyber resilience report', '/board/view', 'HexaView Resilience Index', ciso, st())] },
    { n: 3, title: 'Incidents and critical vulnerabilities since the last meeting', purpose: 'For noting', minutes: 10, presenter: ciso, tone: '#e0345e',
      papers: [paper('Incident summary', '/soc/ir', 'HexaSOC case management', c.people.socLead, st()), paper('Critical vulnerability response', '/int/vulnresponse', 'HexaInt vulnerability response', ciso, st())] },
    { n: 4, title: 'Financial exposure and cyber insurance', purpose: 'For decision', minutes: 15, presenter: cfo, tone: '#0f9f8a',
      papers: [paper('Cyber risk quantification', '/insurance/quantification', 'HexaView loss model', cfo, st()), paper(`${c.insurance.carrier} renewal position`, '/insurance/policy', `${c.insurance.broker} policy schedule`, cfo, st())] },
    { n: 5, title: `Regulatory horizon and directors’ accountability${duties[0] ? ` (${duties.slice(0, 2).map((d) => d.short).join(', ')})` : ''}`, purpose: 'For discussion', minutes: 15, presenter: grc, tone: '#a07cfb',
      papers: [paper('Regulatory horizon board briefing', '/comply/horizon?section=board', 'HexaComply regulatory intelligence', grc, st()), ...(main ? [paper(`${main.short} compliance status`, `/comply/caas?section=frameworks&framework=${main.id}`, 'HexaComply', grc, st())] : [])] },
    { n: 6, title: 'Security programme status and budget', purpose: 'For decision', minutes: 15, presenter: ciso, tone: '#6366f1',
      papers: [paper('Programme status and roadmap', '/programme/overview', 'HexaView security programme', ciso, st())] },
    { n: 7, title: 'Value delivered and outcomes', purpose: 'For noting', minutes: 10, presenter: cfo, tone: '#4b7bd8',
      papers: [paper('Value and outcomes report', '/reports/value', 'HexaView reporting', cfo, st())] },
    { n: 8, title: 'Any other business and date of next meeting', purpose: 'For noting', minutes: 5, presenter: chairP, tone: '#8593b4', papers: [] },
  ];

  const sinceDays = Math.round((NOW.getTime() - prevDate.getTime()) / 86_400_000);
  const incidentsSince = {
    handled: h.soc.openIncidents * r.int(5, 8),
    major: h.soc.critical + r.int(0, 1),
    notifiable: r.int(0, 1),
    days: sinceDays,
  };

  return {
    committee, isBoard, date, daysTo, time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    location: `${hq} boardroom and secure video`, prevDate, packDue, directors, quorum, agenda, incidentsSince,
    chair: directors[0], secretary: directors[8],
  };
}

/* -------------------------------------------------------------- questions */

export interface Fact { label: string; value: string; path?: string }
export interface DirectorQuestion {
  id: string;
  theme: string;
  q: string;
  answer: string;
  rag: Rag;
  facts: Fact[];
  evidence: Link;
  followUp: string;
}

export function ransomwareDay(c: CustomerProfile) {
  const r = rng(`board-${c.id}-rw`);
  const share = r.float(0.2, 0.35, 2);
  const days = r.int(9, 21);
  const response = c.revenueM * 1e6 * r.float(0.0008, 0.0016, 5);
  // Keep the outage inside the modelled loss curve: a long outage sits below the 1-in-100 loss.
  const cap = headlines(c).insurance.tailLossM * 1e6 * 0.6;
  const perDay = Math.min((c.revenueM * 1e6 / 365) * share, Math.max(0, cap - response) / days);
  return { perDay, days, total: perDay * days + response, share, response };
}

export interface MoneyRisk { name: string; ale: number; tail: number; covered: number; path: string }
export function moneyRisks(c: CustomerProfile): MoneyRisk[] {
  const sc = safe(() => scenarios(c));
  if (sc && sc.length) {
    return sc.slice().sort((a, b) => b.ale - a.ale).slice(0, 4).map((s) => ({ name: s.name, ale: s.ale * 1e6, tail: s.max * 1e6, covered: s.coveredPct, path: '/insurance/quantification' }));
  }
  const h = headlines(c);
  const rw = ransomwareDay(c);
  return [
    { name: `Ransomware outage of ${c.vocab.businessServices[0] ?? 'core operations'}`, ale: h.insurance.expectedLossM * 0.45e6, tail: rw.total, covered: 0.6, path: '/insurance/quantification' },
    { name: `Outage at a critical supplier (${c.thirdParties[0]?.name ?? 'cloud provider'})`, ale: h.insurance.expectedLossM * 0.25e6, tail: h.insurance.tailLossM * 0.3e6, covered: 0.5, path: '/insurance/quantification' },
    { name: `Data breach involving ${c.vocab.crownJewels[0] ?? 'crown-jewel systems'}`, ale: h.insurance.expectedLossM * 0.2e6, tail: h.insurance.tailLossM * 0.25e6, covered: 0.7, path: '/insurance/quantification' },
  ];
}

export function directorQuestions(c: CustomerProfile): DirectorQuestion[] {
  const h = headlines(c);
  const ri = resilienceIndex(c);
  const trend = riTrend(c);
  const drivers = riDrivers(c);
  const money = (n: number) => fmtMoney(n, c.currency);
  const duties = boardDuties(c);
  const main = mainFramework(c);
  const vr = safe(() => vrHeadline(c));
  const rw = ransomwareDay(c);
  const tailPct = Math.round((h.insurance.tailLossM / Math.max(0.1, c.insurance.limitM)) * 100);
  const qs: DirectorQuestion[] = [];

  // 1. Vulnerability in the news
  if (vr && vr.adv) {
    const open = vr.open;
    qs.push({
      id: 'news', theme: 'Threats', q: 'Are we covered against the vulnerability in the news?',
      answer: vr.affected === 0
        ? `${vr.adv.cve} (${vr.adv.vendor} ${vr.adv.product}) does not affect us: HexaView matched it against every asset feed within minutes of disclosure and found no exposed versions.`
        : `${vr.adv.cve} in ${vr.adv.vendor} ${vr.adv.product} affects ${fmtNum(vr.affected)} of our assets. ${fmtNum(vr.patched)} are patched and ${fmtNum(vr.mitigated)} mitigated; ${open ? `${fmtNum(open)} are still open${vr.internetOpen ? `, ${fmtNum(vr.internetOpen)} of them internet-facing` : ''}.` : 'none remain open.'}`,
      rag: vr.affected === 0 || open === 0 ? 'green' : vr.internetOpen > 0 ? 'red' : 'amber',
      facts: [
        { label: 'Affected assets', value: fmtNum(vr.affected), path: '/int/vulnresponse' },
        { label: 'Patched or mitigated', value: fmtNum(vr.patched + vr.mitigated), path: '/int/vulnresponse' },
        { label: 'Still open', value: fmtNum(open), path: '/int/vulnresponse' },
        { label: 'CVSS', value: vr.adv.cvss.toFixed(1) + (vr.adv.kev ? ' · KEV' : '') },
      ],
      evidence: { label: 'Critical vulnerability response', path: '/int/vulnresponse', source: 'HexaInt · asset inventory and EDR feeds' },
      followUp: open ? 'When will the remaining assets be patched, and what compensating control covers them until then?' : 'How quickly did we know, and how did we confirm our suppliers were not affected?',
    });
  } else {
    qs.push({
      id: 'news', theme: 'Threats', q: 'Are we covered against the vulnerability in the news?',
      answer: `${fmtNum(h.strike.criticalFindings)} critical and ${fmtNum(h.strike.openFindings)} total exposure findings are open across ${fmtNum(h.strike.externalAssets)} internet-facing assets; new advisories are matched against the asset inventory as they are published.`,
      rag: h.strike.criticalFindings > 0 ? 'amber' : 'green',
      facts: [{ label: 'Critical findings', value: fmtNum(h.strike.criticalFindings), path: '/strike/pentest' }, { label: 'External assets', value: fmtNum(h.strike.externalAssets), path: '/strike/asm' }],
      evidence: { label: 'Critical vulnerability response', path: '/int/vulnresponse', source: 'HexaInt' },
      followUp: 'How long would it take us to confirm exposure to a new critical vulnerability?',
    });
  }

  // 2. Ransomware cost per day
  qs.push({
    id: 'ransomware', theme: 'Money', q: 'What would a ransomware outage cost us per day?',
    answer: `About ${money(rw.perDay)} a day in lost revenue and extra operating cost, while ${c.vocab.businessServices.slice(0, 2).join(' and ') || 'core operations'} run on manual workarounds or stop. A typical ${rw.days}-day recovery would cost around ${money(rw.total)} including response, against an expected annual cyber loss of ${money(h.insurance.expectedLossM * 1e6)}.`,
    rag: rw.total > c.insurance.limitM * 1e6 * 0.6 ? 'red' : rw.total > c.insurance.limitM * 1e6 * 0.3 ? 'amber' : 'green',
    facts: [
      { label: 'Cost per day', value: money(rw.perDay), path: '/insurance/quantification' },
      { label: `${rw.days}-day outage`, value: money(rw.total), path: '/insurance/quantification' },
      { label: 'Expected annual loss', value: money(h.insurance.expectedLossM * 1e6), path: '/insurance/quantification' },
    ],
    evidence: { label: 'Risk quantification', path: '/insurance/quantification', source: 'HexaView loss model (FAIR-style)' },
    followUp: 'How many days of outage can we tolerate before customers or regulators act, and have we tested restoring within that?',
  });

  // 3. Suppliers
  const tier1 = c.thirdParties.filter((t) => t.tier === 1).sort((a, b) => a.rating - b.rating);
  const weak = tier1.filter((t) => t.rating < 70);
  qs.push({
    id: 'suppliers', theme: 'Third parties', q: 'Which suppliers could take us down?',
    answer: `${fmtNum(tier1.length)} tier-1 suppliers have access to critical systems or data. ${weak.length ? `${weak.slice(0, 3).map((t) => `${t.name} (rating ${t.rating})`).join(', ')} ${weak.length === 1 ? 'is' : 'are'} below our threshold of 70.` : 'All are above our rating threshold of 70.'} ${fmtNum(h.comply.highRiskVendors)} of ${fmtNum(h.comply.vendors)} assessed vendors are rated high risk.`,
    rag: weak.some((t) => t.rating < 60) ? 'red' : weak.length ? 'amber' : 'green',
    facts: [
      { label: 'Tier-1 suppliers', value: fmtNum(tier1.length), path: '/comply/tprm' },
      { label: 'Below threshold', value: fmtNum(weak.length), path: '/comply/tprm?risk=high' },
      { label: 'High-risk vendors', value: fmtNum(h.comply.highRiskVendors), path: '/comply/tprm?risk=high' },
    ],
    evidence: { label: 'Third-party risk', path: '/comply/tprm?risk=high', source: 'HexaComply TPRM · security ratings' },
    followUp: tier1[0] ? `What is our exit or substitution plan if ${tier1[0].name} is unavailable for a week?` : 'Do we know our fourth-party concentration?',
  });

  // 4. Main framework
  if (main) {
    qs.push({
      id: 'compliance', theme: 'Compliance', q: `Are we compliant with ${main.short}?`,
      answer: `${main.documented}% of in-scope ${main.short} requirements have implemented controls with current evidence, and ${main.assured}% are proven to work by simulated attack. ${main.nextAudit ? `Next: ${main.nextAudit}.` : ''} ${h.comply.overdueTasks} compliance tasks are overdue across all frameworks.`,
      rag: main.documented >= 85 ? 'green' : main.documented >= 75 ? 'amber' : 'red',
      facts: [
        { label: 'Documented', value: `${main.documented}%`, path: `/comply/caas?section=frameworks&framework=${main.id}` },
        { label: 'Assured', value: `${main.assured}%`, path: `/loop?framework=${main.id}` },
        { label: 'Overdue tasks', value: fmtNum(h.comply.overdueTasks), path: '/comply/caas?section=tasks&overdue=1' },
      ],
      evidence: { label: `${main.short} in HexaComply`, path: `/comply/caas?section=frameworks&framework=${main.id}`, source: 'HexaComply · control evidence' },
      followUp: `Which ${main.short} gaps would a supervisor or auditor find first, and when will they close?`,
    });
  }

  // 5. Insurance limit
  qs.push({
    id: 'insurance', theme: 'Money', q: 'Is our cyber insurance limit adequate?',
    answer: tailPct > 100
      ? `Not for a severe year. Our 1-in-100-year loss is ${money(h.insurance.tailLossM * 1e6)} against a ${money(c.insurance.limitM * 1e6)} limit with ${c.insurance.carrier}, leaving ${money((h.insurance.tailLossM - c.insurance.limitM) * 1e6)} on the balance sheet. Renewal is in ${c.insurance.renewalDays} days.`
      : `Yes for modelled scenarios: the 1-in-100-year loss of ${money(h.insurance.tailLossM * 1e6)} is ${tailPct}% of our ${money(c.insurance.limitM * 1e6)} limit with ${c.insurance.carrier}. Renewal is in ${c.insurance.renewalDays} days.`,
    rag: tailPct > 130 ? 'red' : tailPct > 100 ? 'amber' : 'green',
    facts: [
      { label: 'Policy limit', value: money(c.insurance.limitM * 1e6), path: '/insurance/policy' },
      { label: '1-in-100 loss', value: money(h.insurance.tailLossM * 1e6), path: '/insurance/quantification' },
      { label: 'Retention', value: money(c.insurance.retentionK * 1e3), path: '/insurance/policy' },
      { label: 'Insurability', value: `${h.insurance.insurability}/100`, path: '/insurance/overview' },
    ],
    evidence: { label: 'Policy and renewal', path: '/insurance/policy', source: `${c.insurance.broker} · ${c.insurance.carrier} schedule` },
    followUp: 'Which exclusions (war, infrastructure, OT physical damage) would bite in our worst scenario?',
  });

  // 6. Accountability
  qs.push({
    id: 'accountability', theme: 'Governance', q: `What is the board’s own accountability${duties.length ? ` under ${duties.slice(0, 3).map((d) => d.short).join(', ')}` : ''}?`,
    answer: duties.slice(0, 2).map((d) => `${d.reg}: ${d.duty}`).join(' ') + (duties.length > 2 ? ` ${duties.length - 2} further regime${duties.length - 2 === 1 ? '' : 's'} apply.` : ''),
    rag: duties.some((d) => d.personal) ? 'amber' : 'green',
    facts: duties.slice(0, 4).map((d) => ({ label: d.short, value: d.personal ? 'Personal duty' : 'Corporate duty', path: d.path })),
    evidence: { label: 'Regulatory horizon board briefing', path: '/comply/horizon?section=board', source: 'HexaComply regulatory intelligence' },
    followUp: 'Is each director’s required training complete, and are our approvals of cyber measures minuted?',
  });

  // 7. Detection
  qs.push({
    id: 'detect', theme: 'Operations', q: 'How quickly would we know if we were breached?',
    answer: `Median time to detect is ${h.soc.mttdMin} minutes and to contain ${h.soc.mttrMin} minutes, with ${h.soc.slaPct}% of incidents inside SLA. Detections cover ${h.soc.attackCoveragePct}% of the ATT&CK techniques that matter for our threat actors (${c.vocab.threatActors.slice(0, 2).join(', ')}).`,
    rag: h.soc.attackCoveragePct >= 75 && h.soc.mttdMin <= 10 ? 'green' : h.soc.attackCoveragePct >= 60 ? 'amber' : 'red',
    facts: [
      { label: 'Time to detect', value: `${h.soc.mttdMin} min`, path: '/soc/mdr' },
      { label: 'Time to contain', value: `${h.soc.mttrMin} min`, path: '/soc/ir' },
      { label: 'ATT&CK coverage', value: `${h.soc.attackCoveragePct}%`, path: '/soc/attack' },
      { label: 'Open incidents', value: fmtNum(h.soc.openIncidents), path: '/soc/ir' },
    ],
    evidence: { label: 'Incidents and response', path: '/soc/ir', source: 'HexaSOC · 24/7 MDR' },
    followUp: 'Which of our priority techniques would we still miss, and when were detections last tested?',
  });

  // 8. Trend
  const qDelta = trend[11] - trend[8];
  const yDelta = trend[11] - trend[0];
  qs.push({
    id: 'trend', theme: 'Governance', q: 'Are we getting better, and how do we know?',
    answer: `The Resilience Index is ${ri.value}, ${qDelta >= 0 ? 'up' : 'down'} ${Math.abs(qDelta)} this quarter and ${yDelta >= 0 ? 'up' : 'down'} ${Math.abs(yDelta)} over 12 months. It is calculated from our own tools, and only rises when controls are proven to work against real attack techniques.`,
    rag: qDelta > 0 ? 'green' : qDelta === 0 ? 'amber' : 'red',
    facts: [
      { label: 'Resilience Index', value: String(ri.value), path: '/board/view' },
      { label: 'This quarter', value: `${qDelta >= 0 ? '+' : ''}${qDelta}`, path: '/board/view' },
      { label: '12 months', value: `${yDelta >= 0 ? '+' : ''}${yDelta}`, path: '/board/view' },
    ],
    evidence: { label: 'Board View', path: '/board/view', source: 'HexaView Resilience Index' },
    followUp: 'Which single investment would raise the Index most?',
  });

  // 9. Crown jewels
  qs.push({
    id: 'crown', theme: 'Threats', q: 'Are our most critical systems properly protected?',
    answer: `Our crown jewels are ${c.vocab.crownJewels.slice(0, 3).join(', ')}. Independent testing has ${h.strike.criticalFindings ? `${h.strike.criticalFindings} critical finding${h.strike.criticalFindings === 1 ? '' : 's'}` : 'no critical findings'} and ${h.strike.openFindings} findings open in total; ${h.strike.findingsToDetectionsPct}% of findings have been turned into detections, and fixes take ${h.strike.meanTimeToRemediateDays} days on average.`,
    rag: h.strike.criticalFindings >= 3 ? 'red' : h.strike.criticalFindings > 0 ? 'amber' : 'green',
    facts: [
      { label: 'Critical findings', value: fmtNum(h.strike.criticalFindings), path: '/strike/pentest' },
      { label: 'Open findings', value: fmtNum(h.strike.openFindings), path: '/strike/pentest' },
      { label: 'Mean time to fix', value: `${h.strike.meanTimeToRemediateDays} d`, path: '/strike/pentest' },
    ],
    evidence: { label: 'Penetration testing', path: '/strike/pentest', source: 'HexaStrike' },
    followUp: 'Who owns each critical finding, and what is the date it closes?',
  });

  // 10. People / credentials
  qs.push({
    id: 'people', theme: 'People', q: 'Are our people and executives the weak link?',
    answer: `${fmtNum(h.int.exposedCredentials)} employee credentials and ${fmtNum(h.int.stealerMachines)} infostealer-infected machines linked to us have appeared on criminal markets; ${fmtNum(h.int.vipsMonitored)} executives, including this board, are monitored for impersonation and exposure.`,
    rag: h.int.stealerMachines > 30 ? 'red' : h.int.stealerMachines > 10 ? 'amber' : 'green',
    facts: [
      { label: 'Exposed credentials', value: fmtNum(h.int.exposedCredentials), path: '/int/exposure' },
      { label: 'Infostealer machines', value: fmtNum(h.int.stealerMachines), path: '/int/exposure' },
      { label: 'Executives monitored', value: fmtNum(h.int.vipsMonitored), path: '/int/vip' },
    ],
    evidence: { label: 'Credential exposure', path: '/int/exposure', source: 'HexaInt · dark web and infostealer feeds' },
    followUp: 'Are exposed credentials forced to reset automatically, and do directors use phishing-resistant MFA?',
  });

  // 11. OT (only where there is operational technology)
  if (h.ot.otAssets > 0) {
    qs.push({
      id: 'ot', theme: 'Operations', q: `Could an attack stop ${c.vocab.businessServices[0] ?? 'our operations'}?`,
      answer: `We monitor ${fmtNum(h.ot.otAssets)} operational technology assets across ${fmtNum(h.ot.sites)} sites (${c.vocab.otSystems.slice(0, 2).join(', ')}), with ${h.ot.purdueCoveragePct}% network coverage. ${fmtNum(h.ot.otVulns)} OT vulnerabilities are known; most cannot be patched quickly, so segmentation and monitoring are the main defence.`,
      rag: h.ot.purdueCoveragePct >= 90 ? 'green' : h.ot.purdueCoveragePct >= 80 ? 'amber' : 'red',
      facts: [
        { label: 'OT assets', value: fmtNum(h.ot.otAssets), path: '/ot/assets' },
        { label: 'Coverage', value: `${h.ot.purdueCoveragePct}%`, path: '/ot/visibility' },
        { label: 'OT vulnerabilities', value: fmtNum(h.ot.otVulns), path: '/ot/vulns' },
      ],
      evidence: { label: 'HexaOT overview', path: '/ot/visibility', source: 'HexaOT passive monitoring' },
      followUp: 'Which sites still have IT-to-OT paths that bypass the DMZ?',
    });
  }

  // 12. Value
  const top3 = drivers.slice(0, 3);
  const gain = top3.reduce((s, d) => s + d.gain, 0);
  qs.push({
    id: 'value', theme: 'Money', q: 'Is our security spend buying measurable risk reduction?',
    answer: `The three highest-value actions would add about +${gain.toFixed(1)} points to the Index: ${top3.map((d) => d.text.split(/[,(:]/)[0].trim().toLowerCase()).join('; ')}. Insurance pricing reflects this: modelled premium change at renewal is ${h.insurance.premiumDeltaPct > 0 ? '+' : ''}${h.insurance.premiumDeltaPct}%.`,
    rag: h.insurance.premiumDeltaPct <= 0 ? 'green' : 'amber',
    facts: [
      { label: 'Index gain (top 3)', value: `+${gain.toFixed(1)}`, path: '/board/view' },
      { label: 'Premium change', value: `${h.insurance.premiumDeltaPct > 0 ? '+' : ''}${h.insurance.premiumDeltaPct}%`, path: '/insurance/policy' },
      { label: 'Controls attested', value: `${h.insurance.attestedControls}/${h.insurance.totalControls}`, path: '/insurance/overview' },
    ],
    evidence: { label: 'Value and outcomes', path: '/reports/value', source: 'HexaView reporting' },
    followUp: 'What did we stop doing, or decommission, as a result?',
  });

  return qs;
}

/* -------------------------------------------------------------- decisions */

export type DecisionStatus = 'Implemented' | 'In progress' | 'Overdue' | 'Approved' | 'Deferred' | 'Rejected';
export const DECISION_COLOR: Record<DecisionStatus, string> = {
  Implemented: 'var(--good)', 'In progress': 'var(--m-view)', Overdue: 'var(--bad)', Approved: 'var(--good)', Deferred: 'var(--sev-medium)', Rejected: 'var(--text-muted)',
};
export interface Decision {
  id: string;
  date: Date;
  forum: string;
  decision: string;
  rationale: string;
  owner: Person;
  status: DecisionStatus;
  link: Link;
  note?: string;
  inSession?: boolean;
}
export interface DecisionOption { id: string; label: string; cost: string; effect: string }
export interface DecisionRequest {
  id: string;
  title: string;
  context: string;
  options: DecisionOption[];
  recommended: string;
  why: string;
  owner: Person;
  paper: Link;
}

export function decisionLog(c: CustomerProfile, m: Meeting): Decision[] {
  const r = rng(`board-${c.id}-decisions`);
  const ri = resilienceIndex(c);
  const drivers = riDrivers(c);
  const main = mainFramework(c);
  const cfo = cfoOf(c);
  const money = (n: number) => fmtMoney(n, c.currency);
  const meetings = [m.prevDate, daysAgo(Math.round((NOW.getTime() - m.prevDate.getTime()) / 86_400_000) + 91), daysAgo(Math.round((NOW.getTime() - m.prevDate.getTime()) / 86_400_000) + 182), daysAgo(Math.round((NOW.getTime() - m.prevDate.getTime()) / 86_400_000) + 273)];
  const tier1 = c.thirdParties.filter((t) => t.tier === 1).sort((a, b) => a.rating - b.rating).slice(0, 2);
  const forum = m.committee;
  let n = 0;
  const id = () => `D-${String(meetings[3].getFullYear()).slice(2)}${String(++n).padStart(2, '0')}`;
  const out: Decision[] = [
    { id: id(), date: meetings[3], forum, decision: `Renewed cyber insurance with ${c.insurance.carrier} at a ${money(c.insurance.limitM * 1e6)} limit and ${money(c.insurance.retentionK * 1e3)} retention`, rationale: `Broker (${c.insurance.broker}) benchmarking showed the limit in line with peers; a higher limit was priced at a disproportionate premium.`, owner: cfo, status: 'Implemented', link: { label: 'Policy and renewal', path: '/insurance/policy', source: c.insurance.broker } },
    { id: id(), date: meetings[3], forum, decision: 'Mandated an annual executive ransomware tabletop exercise, with results reported to the board', rationale: 'Insurers and regulators expect a tested incident plan; last exercise found unclear decision rights on extortion payment.', owner: c.people.ciso, status: 'Implemented', link: { label: 'Crisis exercises', path: '/ops/exercises', source: 'HexaView crisis exercises' } },
    { id: id(), date: meetings[2], forum, decision: `Adopted a cyber risk appetite: Resilience Index at or above ${Math.min(95, Math.round((ri.value + 6) / 5) * 5)} and no critical internet-facing exposure older than 14 days`, rationale: 'Gives management a measurable tolerance the board can track each quarter from live data rather than self-assessment.', owner: c.people.ciso, status: 'In progress', link: { label: 'Board View', path: '/board/view', source: 'HexaView Resilience Index' } },
    ...(main ? [{ id: id(), date: meetings[2], forum, decision: `Approved the ${main.short} readiness programme and named ${c.people.grcLead.name} accountable owner`, rationale: `${main.short} applies to the group and places duties on management; documented coverage was below target at the time.`, owner: c.people.grcLead, status: (main.documented >= 85 ? 'Implemented' : r.chance(0.5) ? 'Overdue' : 'In progress') as DecisionStatus, link: { label: `${main.short} in HexaComply`, path: `/comply/caas?section=frameworks&framework=${main.id}`, source: 'HexaComply' } }] : []),
    { id: id(), date: meetings[1], forum, decision: `Funded: ${drivers[0].text}`, rationale: `Modelled as the largest single gain to the Resilience Index (+${drivers[0].gain.toFixed(1)}).`, owner: c.people.ciso, status: 'In progress', link: { label: drivers[0].module, path: drivers[0].path, source: 'HexaView' } },
    { id: id(), date: meetings[1], forum, decision: `Accepted residual risk on legacy dependencies of ${c.vocab.crownJewels[1] ?? c.vocab.crownJewels[0] ?? 'core systems'} until ${fmtDate(daysAhead(r.int(60, 160)))}, with compensating monitoring`, rationale: 'Replacement is scheduled in the platform roadmap; compensating detections were validated by HexaStrike.', owner: c.people.ciso, status: 'In progress', link: { label: 'Risk register', path: '/comply/caas?section=risks', source: 'HexaComply risk register' } },
    ...(tier1.length ? [{ id: id(), date: meetings[0], forum, decision: `Required exit and substitution plans for critical suppliers (${tier1.map((t) => t.name).join(', ')})`, rationale: 'Concentration and weak security ratings on suppliers that could stop core services.', owner: c.people.grcLead, status: (r.chance(0.5) ? 'Overdue' : 'In progress') as DecisionStatus, link: { label: 'Third-party risk', path: '/comply/tprm?risk=high', source: 'HexaComply TPRM' } }] : []),
    { id: id(), date: meetings[0], forum, decision: `Approved the incident-escalation policy: the CEO (${c.people.board.name}) is notified of any critical incident within 30 minutes`, rationale: 'Short regulatory notification clocks require executive decisions within hours.', owner: c.people.socLead, status: 'Implemented', link: { label: 'Incidents and response', path: '/soc/ir', source: 'HexaSOC' } },
  ];
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function decisionRequests(c: CustomerProfile): DecisionRequest[] {
  const r = rng(`board-${c.id}-requests`);
  const h = headlines(c);
  const money = (n: number) => fmtMoney(n, c.currency);
  const drivers = riDrivers(c).slice(0, 3);
  const cfo = cfoOf(c);
  const main = mainFramework(c);
  const duties = boardDuties(c);
  const tailPct = Math.round((h.insurance.tailLossM / Math.max(0.1, c.insurance.limitM)) * 100);
  const upLimit = Math.max(c.insurance.limitM * 1.25, Math.round(Math.min(h.insurance.tailLossM, c.insurance.limitM * 2) / 5) * 5);
  const extraPrem = c.insurance.premiumK * 1e3 * ((upLimit / c.insurance.limitM) - 1) * 0.55;
  const scale = c.revenueM / 1000;
  const costs = drivers.map(() => Math.round(r.float(0.25, 1.4, 2) * Math.max(0.4, scale) * 10) / 10 * 1e6);
  const total = costs.reduce((s, x) => s + x, 0);
  const out: DecisionRequest[] = [
    {
      id: 'limit', title: 'Cyber insurance limit at renewal', owner: cfo,
      context: `Renewal with ${c.insurance.carrier} is in ${c.insurance.renewalDays} days. The modelled 1-in-100-year loss is ${money(h.insurance.tailLossM * 1e6)} (${tailPct}% of the current ${money(c.insurance.limitM * 1e6)} limit).`,
      options: [
        { id: 'hold', label: `Hold the limit at ${money(c.insurance.limitM * 1e6)}`, cost: `Premium ${h.insurance.premiumDeltaPct > 0 ? '+' : ''}${h.insurance.premiumDeltaPct}%`, effect: tailPct > 100 ? `${money((h.insurance.tailLossM - c.insurance.limitM) * 1e6)} of a severe year stays on the balance sheet` : 'Severe year remains within cover' },
        { id: 'raise', label: `Increase the limit to ${money(upLimit * 1e6)}`, cost: `About +${money(extraPrem)} a year`, effect: `Covers ${Math.min(100, Math.round((upLimit / h.insurance.tailLossM) * 100))}% of the 1-in-100 loss` },
        { id: 'raise-ret', label: `Increase to ${money(upLimit * 1e6)} and double the retention`, cost: `About +${money(extraPrem * 0.6)} a year`, effect: `Retention rises to ${money(c.insurance.retentionK * 2e3)}; small losses self-insured` },
      ],
      recommended: tailPct > 100 ? 'raise-ret' : 'hold',
      why: tailPct > 100 ? 'Closes most of the tail gap at the lowest premium; attested controls support a higher retention.' : 'Cover already exceeds the modelled severe year; spend the premium on risk reduction instead.',
      paper: { label: 'Cyber risk quantification', path: '/insurance/quantification', source: 'HexaView loss model' },
    },
    {
      id: 'fund', title: 'Fund the three highest-value security actions', owner: c.people.ciso,
      context: `Together they add about +${drivers.reduce((s, d) => s + d.gain, 0).toFixed(1)} points to the Resilience Index (currently ${resilienceIndex(c).value}).`,
      options: [
        { id: 'all', label: 'Fund all three this financial year', cost: money(total), effect: `+${drivers.reduce((s, d) => s + d.gain, 0).toFixed(1)} Index points; ${drivers[0].module.toLowerCase()} gap closed first` },
        { id: 'first', label: `Fund only: ${drivers[0].text.split(/[,(:]/)[0]}`, cost: money(costs[0]), effect: `+${drivers[0].gain.toFixed(1)} Index points` },
        { id: 'defer', label: 'Defer to the next budget cycle', cost: money(0), effect: 'Index flat; exposure remains above appetite' },
      ],
      recommended: 'all', why: 'Best gain per unit of spend in the programme, and two of the three are also insurer-attested controls.',
      paper: { label: 'Programme status and roadmap', path: '/programme/overview', source: 'HexaView security programme' },
    },
  ];
  if (main) {
    const d = duties[0];
    out.push({
      id: 'attest', title: `${main.short}: management-body approval of cyber risk measures`, owner: c.people.grcLead,
      context: `${d ? `${d.reg} requires the management body to approve and oversee these measures. ` : ''}${main.documented}% of ${main.short} requirements are documented and ${main.assured}% assured; ${h.comply.overdueTasks} compliance tasks are overdue.`,
      options: [
        { id: 'approve', label: 'Approve the measures and the remediation plan as presented', cost: 'Within approved budget', effect: 'Approval minuted; evidence filed in HexaComply' },
        { id: 'conditions', label: 'Approve with conditions: monthly progress report to the committee', cost: 'Within approved budget', effect: 'Approval minuted with oversight conditions' },
        { id: 'defer', label: 'Defer pending independent assurance', cost: 'External review fee', effect: 'Approval delayed one cycle; regulatory exposure persists' },
      ],
      recommended: main.documented >= 85 ? 'approve' : 'conditions',
      why: main.documented >= 85 ? 'Coverage is at target and evidence is current.' : 'Coverage is below target; conditions give the board visible oversight while gaps close.',
      paper: { label: 'Regulatory horizon board briefing', path: '/comply/horizon?section=board', source: 'HexaComply' },
    });
  }
  return out;
}

/* ---------------------------------------------------------------- actions */

export type ActionStatus = 'Complete' | 'In progress' | 'Not started';
export interface BoardAction {
  id: string;
  raised: Date;
  forum: string;
  text: string;
  owner: Person;
  due: Date;
  status: ActionStatus;
  completedAt?: Date;
  evidence: Link;
}

export function boardActions(c: CustomerProfile, m: Meeting): BoardAction[] {
  const r = rng(`board-${c.id}-actions`);
  const h = headlines(c);
  const cfo = cfoOf(c);
  const main = mainFramework(c);
  const tp = c.thirdParties.filter((t) => t.tier === 1).sort((a, b) => a.rating - b.rating)[0];
  const earlier = daysAgo(Math.round((NOW.getTime() - m.prevDate.getTime()) / 86_400_000) + 91);
  const seeds: { text: string; owner: Person; evidence: Link; from: Date }[] = [
    { text: `Report closure of partial ${main?.short ?? 'control'} loops and show which detections were validated`, owner: c.people.ciso, evidence: { label: 'Closed-loop assurance', path: '/loop', source: 'HexaView closed loops' }, from: m.prevDate },
    { text: `Obtain broker benchmarking of the cyber limit and retention before renewal`, owner: cfo, evidence: { label: 'Policy and renewal', path: '/insurance/policy', source: c.insurance.broker }, from: m.prevDate },
    { text: 'Run the executive ransomware tabletop with the full leadership team and report lessons learned', owner: c.people.ciso, evidence: { label: 'Crisis exercises', path: '/ops/exercises', source: 'HexaView crisis exercises' }, from: earlier },
    { text: `Clear the ${h.comply.overdueTasks} overdue compliance tasks or re-plan them with dates`, owner: c.people.grcLead, evidence: { label: 'Overdue tasks', path: '/comply/caas?section=tasks&overdue=1', source: 'HexaComply' }, from: m.prevDate },
    { text: `Present concentration risk and exit plan for ${tp?.name ?? 'the most critical supplier'}`, owner: c.people.grcLead, evidence: { label: 'Third-party risk', path: '/comply/tprm?risk=high', source: 'HexaComply TPRM' }, from: earlier },
    { text: `Close critical penetration-test findings on ${c.vocab.crownJewels[0] ?? 'crown-jewel systems'}`, owner: c.people.socLead, evidence: { label: 'Penetration testing', path: '/strike/pentest', source: 'HexaStrike' }, from: m.prevDate },
    { text: 'All directors to complete the required cyber governance training and record attestation', owner: { name: m.secretary.name, role: m.secretary.role, email: m.secretary.email }, evidence: { label: 'Training attestation', path: '/board/meeting?section=minutes', source: 'HexaView board workspace' }, from: m.prevDate },
    { text: 'Confirm reset of exposed executive and director credentials found on criminal markets', owner: c.people.socLead, evidence: { label: 'Credential exposure', path: '/int/exposure', source: 'HexaInt' }, from: m.prevDate },
  ];
  const forced = new Set([r.int(0, 2), r.int(3, 5)]);
  return seeds.map((s, i): BoardAction => {
    const overdue = forced.has(i);
    const status: ActionStatus = overdue ? (r.chance(0.6) ? 'In progress' : 'Not started') : r.weighted([['Complete', 0.45], ['In progress', 0.4], ['Not started', 0.15]] as const);
    const due = overdue ? daysAgo(r.int(4, 30)) : status === 'Complete' ? daysAgo(r.int(2, 40)) : daysAhead(r.int(3, 45));
    return {
      id: `A-${String(i + 1).padStart(2, '0')}`, raised: s.from, forum: m.committee, text: s.text, owner: s.owner, due, status,
      completedAt: status === 'Complete' ? daysAgo(r.int(1, 20)) : undefined, evidence: s.evidence,
    };
  });
}

export function isOverdue(a: BoardAction): boolean {
  return a.status !== 'Complete' && a.due.getTime() < NOW.getTime();
}
