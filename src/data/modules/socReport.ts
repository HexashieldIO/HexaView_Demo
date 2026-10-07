// HexaSOC › Reports › Report builder. Period-aware SOC / MDR metrics and the
// cited document model behind the SOC report builder. Built on the Reporting
// Centre period engine (periodReport) so alert, incident, MTTA / MTTR and SLA
// numbers agree with /reports/builder for the same customer, scope and period,
// and on the HexaSOC generators so lists and names agree with the SOC tabs.
import type { Connector, CustomerProfile, Severity } from '../types';
import { rng } from '../../lib/rng';
import { NOW } from '../../lib/format';
import { headlines } from '../core';
import { scopedTenants, tenantShare } from '../customers';
import { parentId, TACTIC_COLOR } from '../attackFull';
import {
  periodReport, delta, type PeriodMetrics, type ReportPeriod, type PeriodKind, type Format, type Citation, type DocStatement,
} from './reports';
import {
  socTools, incidents, mdrData, hunts, detectionData, hexaMatrix, actorTechniques, techName, techTactic,
  endpointCves, deviceSummary, recommendations, identityUsers, socReports, HEXASOC_ANALYSTS, type Incident, type Hunt,
} from './soc';
import { playbookLibrary, approvalsRequired } from './playbooks';

/* =====================================================================
   Sections, audiences, presets
   ===================================================================== */
export type SocSectionId =
  | 'summary' | 'sla' | 'alerts' | 'incidents' | 'threats' | 'hunting' | 'detection' | 'automation' | 'posture' | 'recommendations' | 'analysts';

export const SOC_SECTIONS: { id: SocSectionId; label: string; hint: string; locked?: boolean; optional?: boolean }[] = [
  { id: 'summary', label: 'Executive summary', hint: 'Always first: the period in five numbers and three sentences', locked: true },
  { id: 'sla', label: 'Service levels', hint: 'MTTD / MTTA / MTTR against SLA, SLA met, trend across the period' },
  { id: 'alerts', label: 'Alert volume & triage', hint: 'Alerts by source tool, auto-triage, true vs false positives, noise' },
  { id: 'incidents', label: 'Incidents', hint: 'Raised and closed by severity, top incidents, containment, open at end' },
  { id: 'threats', label: 'Threats & actors', hint: 'ATT&CK tactics and techniques seen, sector actors, HexaMatrix change' },
  { id: 'hunting', label: 'Threat hunting', hint: 'Hunts run, findings, hypotheses and outcomes' },
  { id: 'detection', label: 'Detection engineering', hint: 'Rules added, tuned and retired; coverage gain; noisy rules fixed' },
  { id: 'automation', label: 'Automation & playbooks', hint: 'Playbook runs, auto-closed, analyst hours saved, approvals' },
  { id: 'posture', label: 'Endpoint & identity posture', hint: 'Endpoint vulnerabilities, Secure Score, risky sign-ins, MFA gaps' },
  { id: 'recommendations', label: 'Recommendations & next period', hint: 'Prioritised actions with owners and due dates' },
  { id: 'analysts', label: 'Analyst activity', hint: 'Optional: cases per analyst, escalations, handling time', optional: true },
];
export const SOC_SECTION_ORDER: SocSectionId[] = SOC_SECTIONS.map((s) => s.id);
export const DEFAULT_SOC_SECTIONS: SocSectionId[] = SOC_SECTIONS.filter((s) => !s.optional).map((s) => s.id);

export type SocAudience = 'SOC manager' | 'CISO' | 'Executive / Board' | 'Auditor' | 'Insurer' | 'Customer IT';
export const SOC_AUDIENCES: SocAudience[] = ['SOC manager', 'CISO', 'Executive / Board', 'Auditor', 'Insurer', 'Customer IT'];

export interface SocPreset {
  id: string;
  label: string;
  audience: SocAudience;
  period: PeriodKind;
  format: Format;
  sections: SocSectionId[];
  title: (short: string) => string;
}
export const SOC_PRESETS: SocPreset[] = [
  { id: 'ops-weekly', label: 'SOC weekly ops', audience: 'SOC manager', period: 'weekly', format: 'PDF', sections: ['summary', 'sla', 'alerts', 'incidents', 'hunting', 'detection', 'automation', 'analysts'], title: (s) => `${s} SOC weekly operations report` },
  { id: 'mdr-monthly', label: 'MDR monthly service review', audience: 'SOC manager', period: 'monthly', format: 'PPTX', sections: ['summary', 'sla', 'alerts', 'incidents', 'threats', 'hunting', 'detection', 'automation', 'recommendations'], title: (s) => `${s} MDR monthly service review` },
  { id: 'ciso-monthly', label: 'CISO monthly', audience: 'CISO', period: 'monthly', format: 'PDF', sections: ['summary', 'sla', 'incidents', 'threats', 'posture', 'recommendations'], title: (s) => `${s} CISO monthly security report` },
  { id: 'board-quarterly', label: 'Board quarterly security', audience: 'Executive / Board', period: 'quarterly', format: 'PPTX', sections: ['summary', 'sla', 'incidents', 'threats', 'recommendations'], title: (s) => `${s} board security update` },
  { id: 'postmortem', label: 'Incident post-mortem', audience: 'CISO', period: 'weekly', format: 'DOCX', sections: ['summary', 'incidents', 'threats', 'automation', 'recommendations'], title: (s) => `${s} incident post-mortem` },
  { id: 'insurer-annual', label: 'Insurer annual', audience: 'Insurer', period: 'annual', format: 'PDF', sections: ['summary', 'sla', 'incidents', 'detection', 'posture', 'recommendations'], title: (s) => `${s} annual SOC / MDR attestation for insurers` },
];

/* =====================================================================
   Period metrics
   ===================================================================== */
export const SLA = { mttd: 15, mtta: 15, mttr: 60 } as const;
const SEVS: Exclude<Severity, 'info'>[] = ['critical', 'high', 'medium', 'low'];
export const SEV_SLA: Record<Exclude<Severity, 'info'>, { ack: number; contain: number }> = {
  critical: { ack: 15, contain: 60 },
  high: { ack: 30, contain: 240 },
  medium: { ack: 60, contain: 1440 },
  low: { ack: 240, contain: 4320 },
};

function split(total: number, weights: number[]): number[] {
  const sw = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map((w) => (total * w) / sw);
  const out = raw.map((v) => Math.floor(v));
  let rem = total - out.reduce((s, n) => s + n, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0 && order.length; k++, rem--) out[order[k % order.length][1]]++;
  return out;
}
const ageDays = (d: Date) => Math.max(0, Math.round((NOW.getTime() - d.getTime()) / 86_400_000));
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface SocMetrics {
  days: number;
  alerts: number;
  autoTriaged: number;
  autoPct: number;
  escalated: number;
  tpAlerts: number;
  btpAlerts: number;
  fpAlerts: number;
  undAlerts: number;
  fpRate: number;
  bySource: { name: string; value: number; status: Connector['status'] }[];
  incidents: number;
  sev: Record<Exclude<Severity, 'info'>, number>;
  truePositives: number;
  benign: number;
  closed: number;
  openEnd: number;
  containMin: Record<Exclude<Severity, 'info'>, number>;
  breaches: number;
  mttd: number;
  mtta: number;
  mttr: number;
  slaPct: number;
  slaBySev: { sev: Exclude<Severity, 'info'>; ack: number; contain: number; met: number }[];
  coverageEnd: number;
  coverageStart: number;
  huntsRun: number;
  huntFindings: number;
  huntDetections: number;
  rulesAdded: number;
  rulesTuned: number;
  rulesRetired: number;
  noisyFixed: number;
  fpReductionPct: number;
  pbRuns: number;
  pbAutoClosed: number;
  hoursSaved: number;
  approvals: number;
  approvalMedianMin: number;
  vulnsCritical: number;
  vulnsHigh: number;
  kev: number;
  exposedDevices: number;
  secureScore: number;
  riskySignIns: number;
  mfaPct: number;
  mfaGaps: number;
  caFailed: number;
  escalations: number;
  s: {
    mttd: number[];
    mtta: number[];
    mttr: number[];
    fpRate: number[];
    auto: number[];
    escalated: number[];
    sources: number[][];
    raised: Record<Exclude<Severity, 'info'>, number[]>;
    closed: number[];
    pbRuns: number[];
  };
}

function metrics(c: CustomerProfile, tenantId: string, span: { key: string; start: Date; end: Date; days: number }, pm: PeriodMetrics): SocMetrics {
  const h = headlines(c, tenantId).soc;
  const r = rng(`socrep-${c.id}-${tenantId}-${span.key}`);
  const share = tenantShare(c, tenantId);
  const d = span.days;
  const ageEnd = ageDays(span.end);
  const ageStart = ageDays(span.start);
  const better = Math.min(1, ageEnd / 365);
  const nB = pm.s.mtta.length;
  const bucketAlerts = pm.s.low.map((v, i) => v + pm.s.medium[i] + pm.s.high[i] + pm.s.critical[i]);

  // Service levels
  const mttd = Math.max(1, r1(h.mttdMin * (1 + better * 0.5) * r.float(0.9, 1.1, 2)));
  const mttdS = pm.s.mtta.map((_, i) => Math.max(1, r1(mttd * (1.1 - (0.2 * i) / Math.max(1, nB - 1)) * r.float(0.88, 1.12, 2))));

  // Alerts and triage
  const alerts = pm.alerts;
  const autoTriaged = pm.autoTriaged;
  const escalated = Math.max(0, alerts - autoTriaged);
  const tpAlerts = Math.round(escalated * r.float(0.19, 0.23, 3));
  const btpAlerts = Math.round(escalated * r.float(0.32, 0.36, 3));
  const fpAlerts = Math.round(escalated * (0.39 + better * 0.04) * r.float(0.94, 1.04, 3));
  const undAlerts = Math.max(0, escalated - tpAlerts - btpAlerts - fpAlerts);
  const fpRate = r1((fpAlerts / Math.max(1, escalated)) * 100);
  const fpS = pm.s.mtta.map((_, i) => r1(fpRate * (1.1 - (0.2 * i) / Math.max(1, nB - 1)) * r.float(0.95, 1.05, 3)));
  const md = mdrData(c, tenantId, 30);
  const srcW = md.bySource.map((s) => s.value * r.float(0.9, 1.1, 2));
  const srcVals = split(alerts, srcW);
  const bySource = md.bySource.map((s, i) => ({ name: s.name, value: srcVals[i], status: s.status }));
  const sources = srcVals.map((v) => split(v, bucketAlerts.map((x) => x * r.float(0.85, 1.15, 2))));
  const autoS = split(autoTriaged, bucketAlerts);
  const escS = bucketAlerts.map((v, i) => Math.max(0, v - autoS[i]));

  // Incidents
  const inc = pm.incidents;
  const sev = { critical: pm.critical, high: pm.high, medium: pm.medium, low: Math.max(0, inc - pm.critical - pm.high - pm.medium) };
  const latest = ageEnd <= 31;
  const openEnd = latest ? h.openIncidents : Math.max(0, Math.round(h.openIncidents * r.float(0.8, 1.3, 2)));
  const closed = Math.max(0, inc - Math.round(openEnd * r.float(0.35, 0.6, 2)));
  const incW = pm.s.incidents.map((v) => v + 0.2);
  const raised = { critical: split(sev.critical, incW), high: split(sev.high, incW), medium: split(sev.medium, incW), low: split(sev.low, incW) };
  const closedS = split(closed, incW.map((w, i) => (incW[i - 1] ?? w) * 0.5 + w * 0.5));
  const mttr = pm.mttrMin;
  const containMin = {
    critical: Math.max(8, Math.round(mttr * r.float(0.6, 0.85, 2))),
    high: Math.round(mttr * r.float(0.95, 1.3, 2)),
    medium: Math.round(mttr * r.float(2.4, 3.4, 2)),
    low: Math.round(mttr * r.float(5, 8, 2)),
  };
  const slaPct = pm.slaPct;
  const slaBySev = SEVS.map((s, i) => ({ sev: s, ...SEV_SLA[s], met: Math.min(100, r1(i === 0 ? Math.min(100, slaPct + 0.05) : slaPct - i * r.float(0.05, 0.35, 2))) }));
  const breaches = Math.round(inc * (1 - slaPct / 100));

  // Coverage (HexaMatrix): today's coverage drifts down with age.
  const covAt = (age: number) => Math.max(20, r1(h.attackCoveragePct - Math.min(12, (age / 365) * 9)));

  // Hunting and detection engineering
  const huntsRun = Math.max(d >= 7 ? 1 : 0, pm.huntsRun);
  const huntFindings = Math.round(huntsRun * r.float(0.8, 1.9, 2));
  const huntDetections = Math.min(huntFindings, Math.round(huntsRun * r.float(0.35, 0.7, 2)));
  const rulesAdded = Math.max(d >= 7 ? 1 : 0, pm.detectionsShipped);
  const rulesTuned = Math.round(rulesAdded * r.float(1.2, 1.9, 2)) + (d >= 7 ? 1 : 0);
  const rulesRetired = Math.round(rulesAdded * r.float(0.15, 0.4, 2));
  const noisyFixed = Math.max(d >= 7 ? 1 : 0, Math.round(rulesTuned * r.float(0.3, 0.5, 2)));
  const fpReductionPct = Math.round(r.float(6, 21, 1) * Math.min(1, 0.4 + d / 60));

  // Automation (Playbook Builder library, scaled to the period and scope)
  const pbs = playbookLibrary(c).filter((p) => p.runs30 > 0 && (tenantId === 'all' || p.tenants === 'all' || p.tenants.includes(tenantId)));
  const k = (d / 30) * share * r.float(0.92, 1.08, 2) * (1 - better * 0.25);
  const pbRuns = Math.round(pbs.reduce((s, p) => s + p.runs30, 0) * k);
  const pbAutoClosed = Math.round(pbs.reduce((s, p) => s + p.runs30 * (p.autoClosedPct / 100), 0) * k);
  const hoursSaved = Math.round(pbs.reduce((s, p) => s + p.runs30 * p.medianSavedMin, 0) * k / 60);
  const approvals = Math.round(pbs.filter((p) => approvalsRequired(p) > 0).reduce((s, p) => s + p.runs30 * 0.35, 0) * k);
  const pbRunsS = split(pbRuns, bucketAlerts);

  // Posture: today's snapshot drifts with age so older periods compare honestly.
  const cves = endpointCves(c, tenantId);
  const drift = 1 + (ageEnd / 365) * 0.45;
  const vulnsCritical = Math.round(cves.filter((x) => x.sev === 'critical').length * drift);
  const vulnsHigh = Math.round(cves.filter((x) => x.sev === 'high').length * drift);
  const kev = Math.round(cves.filter((x) => x.kev && (x.sev === 'critical' || x.sev === 'high')).length * drift);
  const ds = deviceSummary(c, tenantId);
  const exposedDevices = Math.round(ds.high * drift);
  const secureScore = r1(Math.max(20, recommendations(c, tenantId).secureScore - (ageEnd / 365) * 7));
  const idu = identityUsers(c, tenantId);
  const riskySignIns = Math.max(0, Math.round((idu.risky * 2.2 + idu.caFailed * 0.6) * (d / 30) * r.float(0.85, 1.15, 2) * (1 + better * 0.3)));
  const mfaPct = r1(Math.max(80, idu.mfaPct - (ageEnd / 365) * 2.5));
  const mfaGaps = Math.round((idu.total * (100 - mfaPct)) / 100);

  return {
    days: d,
    alerts, autoTriaged, autoPct: Math.round((autoTriaged / Math.max(1, alerts)) * 100), escalated, tpAlerts, btpAlerts, fpAlerts, undAlerts, fpRate, bySource,
    incidents: inc, sev, truePositives: pm.truePositives, benign: pm.benign, closed, openEnd, containMin, breaches,
    mttd, mtta: pm.mttaMin, mttr, slaPct, slaBySev,
    coverageEnd: covAt(ageEnd), coverageStart: covAt(ageStart),
    huntsRun, huntFindings, huntDetections, rulesAdded, rulesTuned, rulesRetired, noisyFixed, fpReductionPct,
    pbRuns, pbAutoClosed, hoursSaved, approvals, approvalMedianMin: r.int(4, 19),
    vulnsCritical, vulnsHigh, kev, exposedDevices, secureScore, riskySignIns, mfaPct, mfaGaps, caFailed: idu.caFailed,
    escalations: sev.critical + sev.high + Math.round(sev.medium * 0.25),
    s: { mttd: mttdS, mtta: pm.s.mtta, mttr: pm.s.mttr, fpRate: fpS, auto: autoS, escalated: escS, sources, raised, closed: closedS, pbRuns: pbRunsS },
  };
}

/* =====================================================================
   Report data: metrics for the period and the previous one, plus the
   lists that give each section its names (incidents, techniques, actors,
   hunts, rules, playbooks, recommendations, analysts).
   ===================================================================== */
export interface SocTopIncident {
  inc: Incident;
  tactic: string;
  narrative: string;
}
export interface SocAction {
  priority: 'P1' | 'P2' | 'P3';
  title: string;
  why: string;
  owner: string;
  due: string;
  to: string;
  source: string;
}
export interface SocReportData {
  period: ReportPeriod;
  cur: SocMetrics;
  prev: SocMetrics;
  tools: ReturnType<typeof socTools>;
  topIncidents: SocTopIncident[];
  tactics: { name: string; count: number; color: string }[];
  techniques: { id: string; name: string; tactic: string; count: number; level: 'full' | 'partial' | 'none' }[];
  actors: { name: string; techniques: number; covered: number; pct: number }[];
  matrix: { full: number; partial: number; none: number; total: number; pct: number };
  huntList: Hunt[];
  noisyRules: { name: string; platform: string; fpPct: number; hits7d: number }[];
  topPlaybooks: { id: string; name: string; runs: number; autoPct: number; savedH: number; approvals: number }[];
  actions: SocAction[];
  analysts: { name: string; cases: number; escalations: number; medianMin: number }[];
  topCve?: { id: string; product: string; title: string; devices: number; kev: boolean };
  scope: string;
}

export function socReportData(c: CustomerProfile, tenantId: string, period: ReportPeriod): SocReportData {
  const { cur: pc, prev: pp } = periodReport(c, tenantId, period);
  const cur = metrics(c, tenantId, period, pc);
  const prev = metrics(c, tenantId, period.prev, pp);
  const tools = socTools(c, tenantId);
  const r = rng(`socrep-lists-${c.id}-${tenantId}-${period.key}`);
  const ts = scopedTenants(c, tenantId);
  const scope = tenantId === 'all' ? c.short : ts[0]?.name ?? c.short;

  // Incidents sample for the period (same generator as Incidents & Response).
  const sample = incidents(c, tenantId, Math.min(90, Math.max(1, period.days)));
  const order: Severity[] = ['critical', 'high', 'medium', 'low'];
  const ranked = sample.slice().sort((a, b) => order.indexOf(a.sev) - order.indexOf(b.sev) || b.alerts - a.alerts);
  const pickTop: Incident[] = [];
  for (const i of ranked) {
    if (pickTop.length >= 4) break;
    if (pickTop.some((x) => x.title === i.title)) continue;
    pickTop.push(i);
  }
  const fmtD = (m: number) => (m >= 1440 ? `${r1(m / 1440)} days` : m >= 90 ? `${r1(m / 60)} h` : `${Math.round(m)} min`);
  const topIncidents = pickTop.map((inc) => {
    const tactic = techTactic(inc.techniques[0] ?? '');
    const where = inc.hosts[0] ? ` on ${inc.hosts[0]}` : '';
    const narrative = inc.status === 'closed'
      ? `Detected by ${inc.sources.slice(0, 2).join(' and ')}${where}; acknowledged in ${inc.ttaMin} min and contained in ${fmtD(inc.durationMin)} using the “${inc.playbook}” playbook. Closed as ${(inc.disposition ?? 'true positive').toLowerCase()}${inc.actor ? `; tradecraft consistent with ${inc.actor}` : ''}.`
      : `Raised by ${inc.sources.slice(0, 2).join(' and ')}${where}; acknowledged in ${inc.ttaMin} min, now ${inc.status} after ${fmtD(inc.openedMin)} under the “${inc.playbook}” playbook${inc.actor ? `; tradecraft consistent with ${inc.actor}` : ''}.`;
    return { inc, tactic, narrative };
  });

  // Tactics and techniques, scaled from the sample to the period's incident count.
  const k = cur.incidents / Math.max(1, sample.length);
  const tac = new Map<string, number>();
  const tech = new Map<string, number>();
  for (const i of sample) {
    const seen = new Set<string>();
    for (const t of i.techniques) {
      seen.add(techTactic(t));
      tech.set(t, (tech.get(t) ?? 0) + 1);
    }
    for (const t of seen) tac.set(t, (tac.get(t) ?? 0) + 1);
  }
  const tactics = [...tac.entries()]
    .filter(([n]) => n !== 'Unmapped')
    .map(([name, n]) => ({ name, count: Math.max(1, Math.round(n * k)), color: TACTIC_COLOR[name] ?? '#4f8cff' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);
  const hm = hexaMatrix(c, tenantId);
  const techniques = [...tech.entries()]
    .map(([id, n]) => ({ id, name: techName(id), tactic: techTactic(id), count: Math.max(1, Math.round(n * k)), level: hm.byId.get(parentId(id))?.level ?? 'none' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const actors = c.vocab.threatActors.slice(0, 5).map((a) => {
    const ids = Array.from(new Set(actorTechniques(a).map(parentId)));
    const covered = ids.filter((id) => (hm.byId.get(id)?.level ?? 'none') !== 'none').length;
    return { name: a, techniques: ids.length, covered, pct: ids.length ? Math.round((covered / ids.length) * 100) : 0 };
  });

  // Hunts, rules, playbooks
  const huntList = hunts(c, tenantId, Math.min(90, period.days)).slice(0, 4);
  const det = detectionData(c, tenantId, 30);
  const noisyRules = det.rules
    .filter((x) => x.health === 'noisy' || x.stage === 'tuned')
    .sort((a, b) => b.fpPct - a.fpPct)
    .slice(0, 4)
    .map((x) => ({ name: x.name, platform: x.platform, fpPct: x.fpPct, hits7d: x.hits7d }));
  const share = tenantShare(c, tenantId);
  const pk = (period.days / 30) * share;
  const topPlaybooks = playbookLibrary(c)
    .filter((p) => p.runs30 > 0 && (tenantId === 'all' || p.tenants === 'all' || p.tenants.includes(tenantId)))
    .map((p) => ({ id: p.id, name: p.name, runs: Math.max(1, Math.round(p.runs30 * pk)), autoPct: p.autoClosedPct, savedH: Math.round((p.runs30 * pk * p.medianSavedMin) / 60), approvals: approvalsRequired(p) }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5);

  // Posture
  const cves = endpointCves(c, tenantId);
  const kevCve = cves.find((x) => x.kev) ?? cves[0];
  const topCve = kevCve ? { id: kevCve.id, product: kevCve.product, title: kevCve.title, devices: kevCve.devices.length, kev: kevCve.kev } : undefined;
  const recs = recommendations(c, tenantId).recs.filter((x) => x.status === 'open');

  // Recommendations for next period
  const gap = hm.recommendations[0];
  const focus = socReports(c, tenantId)[0]?.focus ?? [];
  const nextEnd = new Date(period.end.getTime() + Math.max(7, period.days) * 86_400_000);
  const due = (frac: number) => new Date(period.end.getTime() + Math.max(3, Math.round(Math.max(7, period.days) * frac)) * 86_400_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const actions: SocAction[] = [];
  if (gap) actions.push({ priority: 'P1', title: `Close the detection gap on ${gap.cell.tech.id} ${gap.cell.tech.name}`, why: `${gap.cell.level === 'none' ? 'No' : 'Partial'} coverage today; used by ${gap.actors.slice(0, 2).join(' and ') || c.vocab.threatActors[0]}.`, owner: 'HexaSOC Detection Engineering', due: due(0.5), to: '/soc/attack?coverage=none', source: 'HexaMatrix coverage engine' });
  if (topCve) actions.push({ priority: topCve.kev ? 'P1' : 'P2', title: `Patch ${topCve.id} (${topCve.product})`, why: `${topCve.kev ? 'On the CISA KEV list; ' : ''}${topCve.devices} devices exposed.`, owner: c.people.admin.name, due: due(0.3), to: '/soc/endpoint?severity=critical', source: `${tools.edrShort} vulnerability management` });
  if (cur.mfaGaps > 0) actions.push({ priority: 'P2', title: `Enrol the remaining ${cur.mfaGaps.toLocaleString('en-GB')} accounts in phishing-resistant MFA`, why: `MFA coverage is ${cur.mfaPct}%; ${cur.riskySignIns} risky sign-ins in the period.`, owner: c.people.admin.name, due: due(0.8), to: '/soc/identity?ca=Failed', source: tools.idpShort });
  if (recs[0]) actions.push({ priority: 'P2', title: recs[0].title, why: `+${recs[0].points} Secure Score points across ${recs[0].devices.toLocaleString('en-GB')} devices.`, owner: c.people.admin.name, due: due(0.9), to: '/soc/recommendations', source: `${tools.edrShort} Secure Score` });
  if (noisyRules[0]) actions.push({ priority: 'P3', title: `Tune “${noisyRules[0].name.replace(/ \(HexaSOC\)$/, '')}”`, why: `${noisyRules[0].fpPct}% false positives on ${noisyRules[0].platform}.`, owner: 'HexaSOC Detection Engineering', due: due(0.4), to: '/soc/detection', source: `${tools.siemShort} rule analytics` });
  focus.slice(0, 2).forEach((f, i) => actions.push({ priority: i ? 'P3' : 'P2', title: `Focus area: ${f}`, why: 'Sector priority agreed in the last service review.', owner: i ? c.people.socLead.name : c.people.ciso.name, due: nextEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), to: '/soc/hunting', source: 'HexaSOC service review' }));

  const PR = { P1: 0, P2: 1, P3: 2 } as const;
  actions.sort((a, b) => PR[a.priority] - PR[b.priority]);

  // Analysts
  const aw = HEXASOC_ANALYSTS.map(() => r.float(0.6, 1.4, 2));
  const caseSplit = split(cur.escalated > 0 ? Math.round(cur.incidents + cur.escalated * 0.08) : 0, aw);
  const escSplit = split(cur.escalations, aw.map((w, i) => w * (HEXASOC_ANALYSTS[i].includes('L3') || HEXASOC_ANALYSTS[i].includes('IR') ? 1.8 : 0.7)));
  const analysts = HEXASOC_ANALYSTS.map((name, i) => ({ name, cases: caseSplit[i], escalations: escSplit[i], medianMin: r.int(9, 38) })).sort((a, b) => b.cases - a.cases);

  return {
    period, cur, prev, tools, topIncidents, tactics, techniques, actors,
    matrix: { full: hm.full, partial: hm.partial, none: hm.none, total: hm.total, pct: hm.pct },
    huntList, noisyRules, topPlaybooks, actions, analysts, topCve, scope,
  };
}

/* =====================================================================
   Cited document model
   ===================================================================== */
export interface SocDocSection {
  id: SocSectionId;
  title: string;
  lead: string;
  statements: DocStatement[];
}
export interface SocDoc {
  sections: SocDocSection[];
  citations: Citation[];
}

const fmt = (n: number) => n.toLocaleString('en-GB');
const conn = (k?: Connector) => (k ? `${k.vendor && k.vendor !== 'Generic' && !k.product.startsWith(k.vendor) ? `${k.vendor} ` : ''}${k.product}` : '');

export function buildSocDoc(c: CustomerProfile, tenantId: string, ids: SocSectionId[], data: SocReportData, compare: boolean, audience: SocAudience): SocDoc {
  const { period, cur, prev, tools } = data;
  const r = rng(`socrep-doc-${c.id}-${tenantId}-${period.key}`);
  const cites: Citation[] = [];
  const cite = (id: string, source: string): number => {
    const ex = cites.find((x) => x.id === id);
    if (ex) return ex.n;
    const n = cites.length + 1;
    cites.push({ n, id, source, version: `v${r.int(3, 41)}`, retrievedMin: r.int(1, 55) });
    return n;
  };
  const st = (text: string, ...refs: number[]): DocStatement => ({ text, refs });
  const pk = period.key;
  const vs = (a: number, b: number, hib: boolean, mode: 'pct' | 'pts' = 'pct') => (compare ? ` (${delta(a, b, hib, mode).text} vs ${period.prev.label})` : '');
  const inP = `In ${period.kind === 'daily' || period.kind === 'custom' ? period.range : period.label}`;
  const siem = conn(tools.siem);
  const edr = conn(tools.edr) || 'EDR';
  const idp = tools.idps.map(conn).join(' / ') || 'identity provider';
  const scope = data.scope;
  const board = audience === 'Executive / Board' || audience === 'Insurer';

  const make: Record<SocSectionId, () => SocDocSection> = {
    summary: () => {
      const quieter = cur.alerts < prev.alerts;
      return {
        id: 'summary', title: 'Executive summary', lead: `The period at a glance for ${scope}, monitored 24/7 by HexaSOC through ${tools.siemShort}${tools.edr ? `, ${tools.edrShort}` : ''} and ${tools.idpShort}.`,
        statements: [
          st(`${inP}, HexaSOC triaged ${fmt(cur.alerts)} alerts${vs(cur.alerts, prev.alerts, false)}${compare ? `, ${quieter ? 'a quieter' : 'a busier'} period than ${period.prev.label}` : ''}; ${cur.autoPct}% were closed by HexaSOC agents with an explained verdict.`, cite(`siem:${tools.siem.id}/alerts@${pk}`, siem), cite(`hexasoc:alert-ledger@${pk}`, 'HexaSOC alert ledger')),
          st(`${fmt(cur.incidents)} incidents were raised (${cur.sev.critical} critical, ${cur.sev.high} high)${vs(cur.incidents, prev.incidents, false)}; ${fmt(cur.truePositives)} were confirmed true positives and ${board ? 'none caused a material business impact' : `${cur.openEnd} remained open at period end`}.`, cite(`hexasoc:cases@${pk}`, 'HexaSOC case store')),
          st(`${cur.slaPct}% of SLAs were met, with mean time to detect ${cur.mttd} min, acknowledge ${cur.mtta} min and contain ${cur.mttr} min against ${SLA.mttd} / ${SLA.mtta} / ${SLA.mttr} min targets.`, cite(`hexasoc:sla-ledger@${pk}`, 'HexaSOC SLA ledger')),
          st(`HexaMatrix ATT&CK coverage ${cur.coverageEnd >= cur.coverageStart ? 'rose' : 'moved'} from ${cur.coverageStart}% to ${cur.coverageEnd}%; ${cur.rulesAdded} detections were added and ${fmt(cur.hoursSaved)} analyst hours were saved by playbooks.`, cite(`hexamatrix:coverage@${tenantId}:${pk}`, 'HexaMatrix coverage engine'), cite(`hexasoc:playbooks@${pk}`, 'HexaSOC playbook engine')),
        ],
      };
    },
    sla: () => ({
      id: 'sla', title: 'Service levels', lead: 'How fast threats were detected, acknowledged and contained, against the contracted MDR service levels.',
      statements: [
        st(`Mean time to detect was ${cur.mttd} min${vs(cur.mttd, prev.mttd, false)}, mean time to acknowledge ${cur.mtta} min${vs(cur.mtta, prev.mtta, false)} and mean time to contain ${cur.mttr} min${vs(cur.mttr, prev.mttr, false)}.`, cite(`hexasoc:sla-ledger@${pk}`, 'HexaSOC SLA ledger')),
        st(`${cur.slaPct}% of incidents met their severity SLA${vs(cur.slaPct, prev.slaPct, true, 'pts')}${cur.breaches ? `; ${cur.breaches} ${cur.breaches === 1 ? 'breach was' : 'breaches were'} reviewed with ${c.people.socLead.name}` : '; there were no SLA breaches'}.`, cite(`hexasoc:sla-breaches@${pk}`, 'HexaSOC SLA ledger')),
        st(`Every critical incident was acknowledged inside ${SEV_SLA.critical.ack} min and contained in a median ${cur.containMin.critical} min (target ${SEV_SLA.critical.contain}).`, cite(`hexasoc:cases.critical@${pk}`, 'HexaSOC case store')),
      ],
    }),
    alerts: () => {
      const top = data.cur.bySource.slice().sort((a, b) => b.value - a.value)[0];
      return {
        id: 'alerts', title: 'Alert volume & triage', lead: `Where alerts came from, how many HexaSOC agents closed, and how much was noise.`,
        statements: [
          st(`${fmt(cur.alerts)} alerts were ingested${vs(cur.alerts, prev.alerts, false)}; ${top ? `${top.name} contributed the most (${fmt(top.value)}, ${Math.round((top.value / Math.max(1, cur.alerts)) * 100)}%)` : ''}.`, cite(`siem:${tools.siem.id}/alerts@${pk}`, siem), ...(tools.edr ? [cite(`edr:${tools.edr.id}/alerts@${pk}`, edr)] : [])),
          st(`HexaSOC agents auto-triaged ${fmt(cur.autoTriaged)} (${cur.autoPct}%)${vs(cur.autoPct, prev.autoPct, true, 'pts')}; analysts handled the other ${fmt(cur.escalated)}.`, cite(`hexasoc:agent-log@${pk}`, 'HexaSOC agent log')),
          st(`Of escalated alerts, ${fmt(cur.tpAlerts)} were true positives, ${fmt(cur.btpAlerts)} benign and ${fmt(cur.fpAlerts)} false positives: a ${cur.fpRate}% false-positive rate${vs(cur.fpRate, prev.fpRate, false, 'pts')}.`, cite(`hexasoc:dispositions@${pk}`, 'HexaSOC case store')),
        ],
      };
    },
    incidents: () => ({
      id: 'incidents', title: 'Incidents', lead: 'Incidents raised and closed by severity, the most significant ones and what was still open at period end.',
      statements: [
        st(`${fmt(cur.incidents)} incidents were raised${vs(cur.incidents, prev.incidents, false)} and ${fmt(cur.closed)} closed${vs(cur.closed, prev.closed, true)}; ${cur.openEnd} were open at period end${vs(cur.openEnd, prev.openEnd, false)}.`, cite(`hexasoc:cases@${pk}`, 'HexaSOC case store')),
        st(`Median containment was ${cur.containMin.critical} min for critical and ${cur.containMin.high} min for high-severity incidents${vs(cur.containMin.high, prev.containMin.high, false)}.`, cite(`hexasoc:containment@${pk}`, 'HexaSOC case store'), ...(tools.edr ? [cite(`edr:${tools.edr.id}/isolations@${pk}`, edr)] : [])),
        ...data.topIncidents.slice(0, 2).map((t) => st(`${t.inc.id} · ${t.inc.title}: ${t.narrative}`, cite(`case:${t.inc.id}`, 'HexaSOC case store'))),
      ],
    }),
    threats: () => {
      const tt = data.tactics[0];
      const te = data.techniques[0];
      const weakest = data.actors.slice().sort((a, b) => a.pct - b.pct)[0];
      return {
        id: 'threats', title: 'Threats & actors', lead: `The ATT&CK behaviour seen in incidents and how well HexaMatrix covers the actors that target ${c.sector.toLowerCase()}.`,
        statements: [
          st(`${tt ? `${tt.name} was the most frequent tactic (${tt.count} incidents)` : 'No tactic dominated'}${te ? `; the top technique was ${te.id} ${te.name} (${te.count})` : ''}.`, cite(`hexasoc:attack-mapping@${pk}`, 'HexaSOC case store · ATT&CK mapping')),
          st(`HexaMatrix coverage moved from ${cur.coverageStart}% to ${cur.coverageEnd}% across the period (${r1(cur.coverageEnd - cur.coverageStart) >= 0 ? '+' : ''}${r1(cur.coverageEnd - cur.coverageStart)} pts); ${data.matrix.full} techniques are fully and ${data.matrix.partial} partially covered.`, cite(`hexamatrix:coverage@${tenantId}:${pk}`, 'HexaMatrix coverage engine')),
          ...(weakest ? [st(`Of the sector actors tracked by HexaInt, ${weakest.name} is the least covered: ${weakest.covered} of ${weakest.techniques} known techniques (${weakest.pct}%).`, cite(`hexaint:actor/${weakest.name.replace(/\s+/g, '-').toLowerCase()}`, 'HexaInt threat intelligence'))] : []),
        ],
      };
    },
    hunting: () => {
      const h0 = data.huntList[0];
      return {
        id: 'hunting', title: 'Threat hunting', lead: 'Hypothesis-led hunts driven by HexaInt intelligence and HexaMatrix gaps.',
        statements: [
          st(`${cur.huntsRun} hunts were run${vs(cur.huntsRun, prev.huntsRun, true)}, producing ${cur.huntFindings} findings and ${cur.huntDetections} new detections.`, cite(`hexasoc:hunts@${pk}`, 'HexaSOC hunt ledger'), cite(`siem:${tools.siem.id}/hunt-queries@${pk}`, `${siem} (${tools.ql})`)),
          ...(h0 ? [st(`Lead hypothesis: ${h0.hypothesis.replace(/\.$/, '')} (${h0.status === 'active' ? 'still active' : h0.outcome?.toLowerCase() ?? 'concluded'}).`, cite(`hunt:${h0.id}`, 'HexaSOC hunt ledger'))] : []),
        ],
      };
    },
    detection: () => ({
      id: 'detection', title: 'Detection engineering', lead: `Detections as code, tested against ${scope}'s telemetry and deployed to ${tools.siemShort}${tools.edr ? ` and ${tools.edrShort}` : ''}.`,
      statements: [
        st(`${cur.rulesAdded} rules were added${vs(cur.rulesAdded, prev.rulesAdded, true)}, ${cur.rulesTuned} tuned and ${cur.rulesRetired} retired.`, cite(`hexasoc:detections-as-code@${pk}`, 'HexaSOC detection pipeline (CI)')),
        st(`${cur.noisyFixed} noisy rules were fixed, cutting false positives on those rules by ${cur.fpReductionPct}%; coverage gained ${r1(cur.coverageEnd - cur.coverageStart)} pts.`, cite(`siem:${tools.siem.id}/rule-analytics@${pk}`, `${siem} rule analytics`), cite(`hexamatrix:coverage@${tenantId}:${pk}`, 'HexaMatrix coverage engine')),
      ],
    }),
    automation: () => {
      const top = data.topPlaybooks[0];
      return {
        id: 'automation', title: 'Automation & playbooks', lead: 'What the Playbook Builder automations did, what they saved and where a human approved the action.',
        statements: [
          st(`${fmt(cur.pbRuns)} playbook runs${vs(cur.pbRuns, prev.pbRuns, true)} auto-closed ${fmt(cur.pbAutoClosed)} cases and saved ≈ ${fmt(cur.hoursSaved)} analyst hours.`, cite(`hexasoc:playbooks@${pk}`, 'HexaSOC playbook engine')),
          st(`${fmt(cur.approvals)} write-back actions needed a named approver (median ${cur.approvalMedianMin} min to approve); none touched OT, which is read-only by policy.`, cite(`hexaview:approvals@${pk}`, 'HexaView action broker · audit ledger')),
          ...(top ? [st(`The busiest playbook was “${top.name}” with ${fmt(top.runs)} runs, ${top.autoPct}% closed without an analyst.`, cite(`playbook:${top.id}`, 'HexaSOC Playbook Builder'))] : []),
        ],
      };
    },
    posture: () => ({
      id: 'posture', title: 'Endpoint & identity posture', lead: `Exposure that makes incidents more likely, from ${tools.edrShort} and ${tools.idpShort}.`,
      statements: [
        st(`${cur.vulnsCritical} critical and ${cur.vulnsHigh} high endpoint vulnerabilities are open${vs(cur.vulnsCritical + cur.vulnsHigh, prev.vulnsCritical + prev.vulnsHigh, false)}, ${cur.kev} of them on the CISA KEV list; ${fmt(cur.exposedDevices)} devices have high exposure.`, ...(tools.edr ? [cite(`edr:${tools.edr.id}/tvm@${pk}`, `${edr} vulnerability management`)] : [cite(`hexasoc:tvm@${pk}`, 'HexaSOC vulnerability view')])),
        st(`Secure Score stands at ${cur.secureScore}${vs(cur.secureScore, prev.secureScore, true, 'pts')}.`, cite(`edr:secure-score@${pk}`, `${tools.edrShort} Secure Score`)),
        st(`${fmt(cur.riskySignIns)} risky sign-ins were investigated${vs(cur.riskySignIns, prev.riskySignIns, false)}; MFA covers ${cur.mfaPct}% of accounts, leaving ${fmt(cur.mfaGaps)} without it.`, cite(`idp:signins@${pk}`, idp)),
      ],
    }),
    recommendations: () => ({
      id: 'recommendations', title: 'Recommendations & next period', lead: 'Prioritised actions for the next period, each with a named owner and due date.',
      statements: data.actions.slice(0, 3).map((a, i) => st(`${a.priority}: ${a.title}. ${a.why} Owner: ${a.owner}, due ${a.due}.`, cite(`action:${pk}:${i + 1}`, a.source))),
    }),
    analysts: () => {
      const top = data.analysts[0];
      return {
        id: 'analysts', title: 'Analyst activity', lead: 'Who handled the work in the HexaSOC team, and what was escalated to the customer.',
        statements: [
          st(`${data.analysts.length} HexaSOC analysts handled ${fmt(data.analysts.reduce((s, a) => s + a.cases, 0))} cases; ${top ? `${top.name} led with ${top.cases}` : ''}.`, cite(`hexasoc:roster@${pk}`, 'HexaSOC case store · roster')),
          st(`${fmt(cur.escalations)} cases were escalated to ${c.people.socLead.name}'s team${vs(cur.escalations, prev.escalations, false)}.`, cite(`hexasoc:escalations@${pk}`, 'HexaSOC case store')),
        ],
      };
    },
  };
  const ordered = SOC_SECTION_ORDER.filter((id) => id === 'summary' || ids.includes(id));
  return { sections: ordered.map((id) => make[id]()), citations: cites };
}
