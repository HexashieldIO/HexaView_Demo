import type { CustomerProfile } from '../types';
import { rng } from '../../lib/rng';
import { NOW } from '../../lib/format';
import { headlines, loops, loopSummary, resilienceIndex, riTrend, riDrivers, RI_VERSION } from '../core';
import { attention } from '../overview';
import { scopedTenants, tenantShare } from '../customers';
import { type CustomerMap } from '../customerMap';
import { forCustomer } from '../customerMap';

/* =====================================================================
   Reporting Centre: reporting periods, period-scaled metrics, templates,
   schedules, issued reports and the cited document model used by the
   previews and the builder.
   ===================================================================== */

export type Audience = 'Board' | 'Executive' | 'Regulator' | 'Auditor' | 'Insurer' | 'Customer';
export type Format = 'PDF' | 'PPTX' | 'DOCX';
export type SectionId = 'ri' | 'capability' | 'incidents' | 'loops' | 'frameworks' | 'exposure' | 'ot' | 'custody' | 'ai' | 'insurance' | 'risks';

export const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: 'ri', label: 'Resilience Index & trend', hint: 'Hex score, trend across the period, top drivers' },
  { id: 'capability', label: 'Capability scores', hint: 'Six capabilities plus AI, insurance, fabric' },
  { id: 'incidents', label: 'Alerts, incidents & response', hint: 'Volumes by severity, MTTA / MTTR, SLA' },
  { id: 'loops', label: 'Closed-loop assurance', hint: 'Closed, partial, broken, stale' },
  { id: 'frameworks', label: 'Framework coverage', hint: 'Documented vs assured per framework' },
  { id: 'exposure', label: 'Exposure & testing', hint: 'Findings opened / closed, credentials, lookalikes' },
  { id: 'ot', label: 'Operational technology', hint: 'Assets, sites, alerts, Purdue coverage' },
  { id: 'custody', label: 'Content & data custody', hint: 'Transfers, revocations, anomalies' },
  { id: 'ai', label: 'AI governance', hint: 'Shadow AI, prompt DLP, agent actions' },
  { id: 'insurance', label: 'Cyber insurance', hint: 'Insurability, premium, modelled loss' },
  { id: 'risks', label: 'Top risks', hint: 'Ranked attention items with owners' },
];

/** Customers whose custom reports lead with content and data custody rather than OT or exposure. */
const CUSTODY_FIRST: CustomerMap<boolean> = {
  maritime: false, finserv: false, media: true, healthcare: false, automotive: true,
  insurance: false, defence: true, pharma: true, sghospital: false, studio: true,
};
/** Default sections for a new custom report. */
export function defaultSections(c: CustomerProfile, hasOt: boolean): SectionId[] {
  return ['ri', 'capability', 'incidents', 'loops', 'frameworks', forCustomer(CUSTODY_FIRST, c) ? 'custody' : hasOt ? 'ot' : 'exposure', 'ai', 'risks'];
}

/* =====================================================================
   Reporting periods
   ===================================================================== */
export type PeriodKind = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half' | 'annual' | 'custom';
export const PERIOD_KINDS: { id: PeriodKind; label: string; adj: string }[] = [
  { id: 'daily', label: 'Daily', adj: 'daily' },
  { id: 'weekly', label: 'Weekly', adj: 'weekly' },
  { id: 'monthly', label: 'Monthly', adj: 'monthly' },
  { id: 'quarterly', label: 'Quarterly', adj: 'quarterly' },
  { id: 'half', label: 'Half-yearly', adj: 'half-yearly' },
  { id: 'annual', label: 'Annual', adj: 'annual' },
  { id: 'custom', label: 'Custom', adj: 'custom-period' },
];

export interface PeriodSpan {
  start: Date;
  /** Inclusive last day. */
  end: Date;
  days: number;
  /** Name of the period, e.g. "September 2026", "Q3 2026", "Week 39 2026". */
  label: string;
  /** Date range, e.g. "1 – 30 Sep 2026". */
  range: string;
}
export interface ReportPeriod extends PeriodSpan {
  kind: PeriodKind;
  key: string;
  prev: PeriodSpan & { key: string };
  bucketUnit: 'hour' | 'day' | 'week' | 'month';
  /** Buckets across the period for charts: label and weight (days or hours). */
  buckets: { label: string; weight: number }[];
}
export interface PeriodState {
  kind: PeriodKind;
  from: string;
  to: string;
  compare: boolean;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a: Date, b: Date) => Math.round((day0(b).getTime() - day0(a).getTime()) / 86_400_000);
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
function fmtRange(a: Date, b: Date): string {
  if (diffDays(a, b) === 0) return `${a.getDate()} ${MON[a.getMonth()]} ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${a.getDate()} ${MON[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear()}`;
  return `${a.getDate()} – ${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear()}`;
}
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7);
}

/** The n-th most recent *complete* period of a kind (offset 0 = last complete one). */
function spanFor(kind: Exclude<PeriodKind, 'custom'>, offset: number, now: Date = NOW): PeriodSpan {
  const today = day0(now);
  let start: Date;
  let end: Date;
  let label: string;
  if (kind === 'daily') {
    start = addDays(today, -1 - offset);
    end = start;
    label = `${start.getDate()} ${MONTH_LONG[start.getMonth()]} ${start.getFullYear()}`;
  } else if (kind === 'weekly') {
    const dow = (today.getDay() + 6) % 7; // Monday = 0
    start = addDays(today, -dow - 7 * (offset + 1));
    end = addDays(start, 6);
    label = `Week ${isoWeek(start)} · ${start.getFullYear()}`;
  } else if (kind === 'monthly') {
    start = new Date(today.getFullYear(), today.getMonth() - 1 - offset, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    label = `${MONTH_LONG[start.getMonth()]} ${start.getFullYear()}`;
  } else if (kind === 'quarterly') {
    const q = Math.floor(today.getMonth() / 3);
    start = new Date(today.getFullYear(), (q - 1 - offset) * 3, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    label = `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
  } else if (kind === 'half') {
    const hIdx = Math.floor(today.getMonth() / 6);
    start = new Date(today.getFullYear(), (hIdx - 1 - offset) * 6, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 6, 0);
    label = `H${start.getMonth() < 6 ? 1 : 2} ${start.getFullYear()}`;
  } else {
    // Financial year ending September (last complete FY).
    const fyEndYear = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1;
    start = new Date(fyEndYear - 1 - offset, 9, 1);
    end = new Date(fyEndYear - offset, 9, 0);
    label = `FY ${fyEndYear - offset}`;
  }
  return { start, end, days: diffDays(start, end) + 1, label, range: fmtRange(start, end) };
}

function bucketsFor(start: Date, days: number): Pick<ReportPeriod, 'bucketUnit' | 'buckets'> {
  if (days <= 1) return { bucketUnit: 'hour', buckets: Array.from({ length: 24 }, (_, i) => ({ label: `${String(i).padStart(2, '0')}:00`, weight: 1 })) };
  if (days <= 31) return { bucketUnit: 'day', buckets: Array.from({ length: days }, (_, i) => { const d = addDays(start, i); return { label: `${d.getDate()} ${MON[d.getMonth()]}`, weight: 1 }; }) };
  if (days <= 120) {
    const n = Math.ceil(days / 7);
    return { bucketUnit: 'week', buckets: Array.from({ length: n }, (_, i) => { const d = addDays(start, i * 7); return { label: `wk ${d.getDate()} ${MON[d.getMonth()]}`, weight: Math.min(7, days - i * 7) }; }) };
  }
  const out: { label: string; weight: number }[] = [];
  let d = new Date(start.getFullYear(), start.getMonth(), 1);
  const end = addDays(start, days - 1);
  while (d <= end) {
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const a = d < start ? start : d;
    const b = mEnd > end ? end : mEnd;
    out.push({ label: `${MON[d.getMonth()]}${d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''}`, weight: diffDays(a, b) + 1 });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return { bucketUnit: 'month', buckets: out };
}

export function defaultCustom(): { from: string; to: string } {
  const to = addDays(day0(NOW), -1);
  return { from: isoDay(addDays(to, -44)), to: isoDay(to) };
}

/** Resolve a period choice into dates, labels, the previous comparable period and chart buckets. */
export function resolvePeriod(kind: PeriodKind, offset = 0, custom?: { from: string; to: string }): ReportPeriod {
  let cur: PeriodSpan;
  let prev: PeriodSpan;
  if (kind === 'custom') {
    const cd = custom ?? defaultCustom();
    let a = parseDay(cd.from);
    let b = parseDay(cd.to);
    if (b < a) [a, b] = [b, a];
    const days = diffDays(a, b) + 1;
    cur = { start: a, end: b, days, label: fmtRange(a, b), range: fmtRange(a, b) };
    const pb = addDays(a, -1);
    const pa = addDays(pb, -(days - 1));
    prev = { start: pa, end: pb, days, label: fmtRange(pa, pb), range: fmtRange(pa, pb) };
  } else {
    cur = spanFor(kind, offset);
    prev = spanFor(kind, offset + 1);
  }
  const key = `${kind}:${isoDay(cur.start)}:${cur.days}`;
  return { kind, ...cur, key, prev: { ...prev, key: `${kind}:${isoDay(prev.start)}:${prev.days}` }, ...bucketsFor(cur.start, cur.days) };
}

export function periodFromState(s: PeriodState): ReportPeriod {
  return resolvePeriod(s.kind, 0, s.kind === 'custom' ? { from: s.from, to: s.to } : undefined);
}

export function initialPeriodState(kind: PeriodKind = 'monthly', compare = true): PeriodState {
  return { kind, ...defaultCustom(), compare };
}

/* =====================================================================
   Period-scaled metrics. Rates come from the shared headlines so every
   period agrees with the dashboards; noise is seeded by the period key so
   a given period always shows the same numbers, and the previous period
   is computed the same way for honest deltas.
   ===================================================================== */
export interface PeriodMetrics {
  alerts: number;
  autoTriaged: number;
  incidents: number;
  critical: number;
  high: number;
  medium: number;
  truePositives: number;
  benign: number;
  mttaMin: number;
  mttrMin: number;
  slaPct: number;
  detectionsShipped: number;
  huntsRun: number;
  testsRun: number;
  findingsOpened: number;
  findingsClosed: number;
  credsExposed: number;
  lookalikes: number;
  otAlerts: number;
  evidenceCollected: number;
  transfers: number;
  revocations: number;
  custodyAnomalies: number;
  promptDlp: number;
  shadowAiNew: number;
  agentActions: number;
  copilotQueries: number;
  ri: number;
  loopsAssuredPct: number;
  /** Per-bucket series. */
  s: {
    critical: number[];
    high: number[];
    medium: number[];
    low: number[];
    incidents: number[];
    mtta: number[];
    mttr: number[];
    opened: number[];
    closed: number[];
    otAlerts: number[];
    transfers: number[];
    agentActions: number[];
    ri: number[];
  };
}

function split(total: number, weights: number[]): number[] {
  const sw = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map((w) => (total * w) / sw);
  const out = raw.map((v) => Math.floor(v));
  let rem = total - out.reduce((s, n) => s + n, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0 && order.length; k++, rem--) out[order[k % order.length][1]]++;
  return out;
}

/** RI at a date by interpolating the 12-month trend (index 11 = today). */
function riAt(c: CustomerProfile, tenantId: string, d: Date): number {
  const tr = riTrend(c, tenantId);
  const monthsAgo = Math.max(0, diffDays(d, NOW) / 30.4);
  const x = Math.max(0, 11 - monthsAgo);
  const i = Math.floor(x);
  const f = x - i;
  const v = i >= 11 ? tr[11] : tr[i] + (tr[i + 1] - tr[i]) * f;
  return Math.round(v * 10) / 10;
}

function metricsFor(c: CustomerProfile, tenantId: string, span: PeriodSpan & { key: string }, buckets: { weight: number }[]): PeriodMetrics {
  const h = headlines(c, tenantId);
  const r = rng(`rep-pm-${c.id}-${tenantId}-${span.key}`);
  const d = span.days;
  const n = (perDay: number, jitter = 0.12) => Math.max(0, Math.round(perDay * d * (1 + (r() - 0.5) * 2 * jitter)));
  const alerts = n(h.soc.alerts24h, 0.1);
  const incidents = Math.max(h.soc.openIncidents > 0 ? 1 : 0, n(h.soc.openIncidents * 0.32));
  const critical = Math.round(incidents * r.float(0.015, 0.035, 3));
  const high = Math.round(incidents * r.float(0.1, 0.16, 3));
  const medium = Math.round(incidents * r.float(0.3, 0.4, 3));
  const truePositives = Math.max(critical + Math.round(high * 0.6), Math.round(incidents * r.float(0.11, 0.17, 3)));
  const age = diffDays(span.end, NOW);
  const better = Math.min(1, age / 365); // older periods were slower
  const mttaMin = Math.max(1, Math.round(h.soc.mttaMin * (1 + better * 0.6) * r.float(0.88, 1.12, 2) * 10) / 10);
  const mttrMin = Math.max(5, Math.round(h.soc.mttrMin * (1 + better * 0.45) * r.float(0.9, 1.12, 2)));
  const ws = buckets.map((b) => b.weight * (0.7 + r() * 0.6));
  const sevSplit = (total: number) => split(total, ws.map((w) => w * (0.8 + r() * 0.4)));
  const lowAlerts = Math.round(alerts * 0.62);
  const medAlerts = Math.round(alerts * 0.27);
  const highAlerts = Math.round(alerts * 0.095);
  const critAlerts = Math.max(0, alerts - lowAlerts - medAlerts - highAlerts);
  const hasOt = h.ot.otAssets > 0;
  const findingsOpened = n((h.strike.openFindings / 30) * 0.8, 0.25);
  const transfers = n(h.custody.transfers7d / 7);
  const agentActions = n(h.ai.agentActions7d / 7, 0.08);
  const otAlerts = hasOt ? n(h.ot.otAlerts / 30, 0.2) : 0;
  const riEnd = riAt(c, tenantId, span.end);
  const riStart = riAt(c, tenantId, span.start);
  return {
    alerts,
    autoTriaged: Math.round((alerts * h.soc.autoTriagedPct) / 100),
    incidents,
    critical,
    high,
    medium,
    truePositives,
    benign: incidents - truePositives,
    mttaMin,
    mttrMin,
    slaPct: Math.min(100, Math.round((h.soc.slaPct - better * 0.08 + (r() - 0.5) * 0.04) * 100) / 100),
    detectionsShipped: n((h.soc.detectionsLive / 365) * 0.9, 0.3),
    huntsRun: n(h.soc.huntsActive * 0.11, 0.3),
    testsRun: n(h.strike.testsThisQuarter / 91, 0.3),
    findingsOpened,
    findingsClosed: Math.round(findingsOpened * r.float(0.92, 1.25, 2)),
    credsExposed: n(h.int.exposedCredentials / 90, 0.3),
    lookalikes: n(h.int.lookalikeDomains / 60, 0.4),
    otAlerts,
    evidenceCollected: n(h.comply.evidenceItems / 90, 0.15),
    transfers,
    revocations: n(h.custody.revocations30d / 30, 0.35),
    custodyAnomalies: n((h.custody.anomalies / 30) * 1.2, 0.5),
    promptDlp: n(h.ai.shadowAi * 11, 0.25),
    shadowAiNew: Math.max(0, Math.round(h.ai.shadowAi * Math.min(1, d / 90) * r.float(0.4, 1.1, 2))),
    agentActions,
    copilotQueries: n(h.ai.copilotQueries30d / 30, 0.15),
    ri: riEnd,
    loopsAssuredPct: Math.max(1, Math.round(loopSummary(loops(c, tenantId)).assuredPct - better * 9 + (r() - 0.5) * 2)),
    s: {
      critical: sevSplit(critAlerts),
      high: sevSplit(highAlerts),
      medium: sevSplit(medAlerts),
      low: sevSplit(lowAlerts),
      incidents: sevSplit(incidents),
      mtta: buckets.map((_, i) => Math.max(1, Math.round(mttaMin * (1.12 - (0.24 * i) / Math.max(1, buckets.length - 1)) * r.float(0.9, 1.1, 2) * 10) / 10)),
      mttr: buckets.map((_, i) => Math.max(5, Math.round(mttrMin * (1.1 - (0.2 * i) / Math.max(1, buckets.length - 1)) * r.float(0.9, 1.1, 2)))),
      opened: sevSplit(findingsOpened),
      closed: sevSplit(Math.round(findingsOpened * 1.08)),
      otAlerts: sevSplit(otAlerts),
      transfers: sevSplit(transfers),
      agentActions: sevSplit(agentActions),
      ri: buckets.map((_, i) => Math.round((riStart + ((riEnd - riStart) * (i + 1)) / buckets.length + (r() - 0.5) * 0.6) * 10) / 10),
    },
  };
}

export interface PeriodReport {
  period: ReportPeriod;
  cur: PeriodMetrics;
  prev: PeriodMetrics;
}
export function periodReport(c: CustomerProfile, tenantId: string, period: ReportPeriod): PeriodReport {
  const cur = metricsFor(c, tenantId, { ...period, key: period.key }, period.buckets);
  const prevB = bucketsFor(period.prev.start, period.prev.days).buckets;
  const prev = metricsFor(c, tenantId, period.prev, prevB);
  return { period, cur, prev };
}

/** Period-over-period change as text plus whether it is good news. */
export function delta(cur: number, prev: number, higherIsBetter: boolean, mode: 'pct' | 'pts' = 'pct'): { text: string; good: boolean; flat: boolean } {
  if (mode === 'pts') {
    const dv = Math.round((cur - prev) * 10) / 10;
    if (Math.abs(dv) < 0.05) return { text: 'no change', good: true, flat: true };
    return { text: `${dv > 0 ? '↑' : '↓'} ${Math.abs(dv)} pts`, good: dv > 0 === higherIsBetter, flat: false };
  }
  if (!prev) return { text: cur ? 'new' : 'no change', good: !higherIsBetter ? cur === 0 : true, flat: !cur };
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return { text: 'no change', good: true, flat: true };
  return { text: `${p > 0 ? '↑' : '↓'} ${Math.abs(p)}%`, good: p > 0 === higherIsBetter, flat: false };
}

/* =====================================================================
   Templates
   ===================================================================== */
export type Frequency = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Annual' | 'Event-driven' | 'On demand';

export interface ReportTemplate {
  id: string;
  title: string;
  audience: Audience;
  framework?: string;
  regulator?: string;
  owner: string;
  frequency: Frequency;
  /** Period a fresh run covers by default. */
  period: PeriodKind;
  lastGeneratedDays: number | null;
  pages: number;
  citations: number;
  format: Format;
  description: string;
  sections: SectionId[];
  deadline?: string;
  status: 'ready' | 'draft' | 'due';
  /** Tenant the report is scoped to ('all' = group). */
  scope?: string;
}

export const FREQ_PERIOD: Record<Frequency, PeriodKind> = {
  Daily: 'daily', Weekly: 'weekly', Monthly: 'monthly', Quarterly: 'quarterly', 'Half-yearly': 'half', Annual: 'annual', 'Event-driven': 'custom', 'On demand': 'quarterly',
};

type TplSeed = Omit<ReportTemplate, 'period'> & { period?: PeriodKind };
const withPeriod = (t: TplSeed): ReportTemplate => ({ ...t, period: t.period ?? FREQ_PERIOD[t.frequency] });

export function reportTemplates(c: CustomerProfile): ReportTemplate[] {
  const p = c.people;
  const ot = p.otLead?.name ?? p.grcLead.name;
  const common: TplSeed[] = [
    { id: 'board', title: 'Board cyber pack', audience: 'Board', owner: p.ciso.name, frequency: 'Quarterly', lastGeneratedDays: 38, pages: 14, citations: 62, format: 'PPTX', description: 'Resilience Index, how it is made, top risks and what would raise it most. Plain English, every number cited.', sections: ['ri', 'capability', 'incidents', 'loops', 'insurance', 'risks'], status: 'draft' },
    { id: 'msr', title: 'Monthly service review', audience: 'Executive', owner: p.socLead.name, frequency: 'Monthly', lastGeneratedDays: 3, pages: 22, citations: 118, format: 'PDF', description: 'HexaShield managed-service performance: SLAs, incidents, hunts, detections shipped, tests run.', sections: ['incidents', 'loops', 'exposure', 'capability'], status: 'ready' },
    { id: 'weekly', title: 'Weekly SOC digest', audience: 'Executive', owner: p.socLead.name, frequency: 'Weekly', lastGeneratedDays: 5, pages: 6, citations: 34, format: 'PDF', description: 'One-page week in review: alert and incident volumes, response times, notable cases and what changed.', sections: ['incidents', 'exposure', 'risks'], status: 'ready' },
    { id: 'iso', title: 'Auditor evidence pack · ISO/IEC 27001:2022', audience: 'Auditor', framework: 'ISO 27001', owner: p.grcLead.name, frequency: 'On demand', lastGeneratedDays: 51, pages: 96, citations: 412, format: 'PDF', description: 'Statement of Applicability with control-by-control evidence, sampled populations and loop proofs.', sections: ['frameworks', 'loops', 'exposure', 'risks'], status: 'ready' },
    { id: 'insurer', title: 'Insurer evidence pack', audience: 'Insurer', owner: p.ciso.name, frequency: 'Annual', lastGeneratedDays: 300, pages: 18, citations: 74, format: 'PDF', description: `Attested controls mapped to the ${c.insurance.carrier.split(' ')[0]} questionnaire, modelled loss and claims readiness for ${c.insurance.broker}.`, sections: ['insurance', 'capability', 'loops', 'exposure'], deadline: `Renewal in ${c.insurance.renewalDays} days`, status: 'due' },
    { id: 'trust', title: 'Customer trust report', audience: 'Customer', owner: p.grcLead.name, frequency: 'Quarterly', lastGeneratedDays: 64, pages: 8, citations: 31, format: 'PDF', description: 'Shareable summary of certifications, control coverage and incident posture for customers and partners.', sections: ['frameworks', 'capability', 'incidents'], status: 'ready' },
    { id: 'vuln-exposure', title: 'Critical vulnerability exposure statement', audience: 'Customer', owner: p.ciso.name, frequency: 'Event-driven', period: 'daily', lastGeneratedDays: 0, pages: 4, citations: 26, format: 'PDF', description: 'Are we affected, what was found, what was done and where it stands now, with timeline, evidence trail and CISO sign-off. Drafted from HexaInt Critical Vulnerability Response for customers, the board, regulators or insurers.', sections: ['exposure', 'incidents', 'risks'], status: 'draft' },
  ];
  const reg: CustomerMap<TplSeed[]> = {
    finserv: [
      { id: 'dora-incident', title: 'DORA major ICT incident report', audience: 'Regulator', framework: 'DORA', regulator: 'CSSF · FCA/PRA', owner: p.grcLead.name, frequency: 'Event-driven', period: 'daily', lastGeneratedDays: 0, pages: 6, citations: 27, format: 'DOCX', description: 'Initial (4 h), intermediate (72 h) and final (1 month) reports on the ITS template, pre-filled from INC-ALD-2291.', sections: ['incidents', 'risks'], deadline: 'Initial notification window open', status: 'due', scope: 'pay' },
      { id: 'dora-roi', title: 'DORA Register of Information', audience: 'Regulator', framework: 'DORA', regulator: 'CSSF', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 270, pages: 41, citations: 412, format: 'DOCX', description: 'ICT third-party arrangements (RT.01–RT.07) with LEIs, criticality and exit plans; 31 contracts still missing an LEI.', sections: ['frameworks', 'risks'], deadline: 'Submission due January', status: 'draft' },
      { id: 'nis2', title: 'NIS2 incident notification', audience: 'Regulator', framework: 'NIS2', regulator: 'ILR (Luxembourg)', owner: p.grcLead.name, frequency: 'Event-driven', period: 'weekly', lastGeneratedDays: 140, pages: 4, citations: 14, format: 'DOCX', description: 'Early warning (24 h), notification (72 h) and final report for Aldersgate Europe S.A.', sections: ['incidents'], status: 'ready', scope: 'eu' },
      { id: 'nydfs', title: 'NYDFS 23 NYCRR 500 certification', audience: 'Regulator', framework: 'NYDFS 500', regulator: 'NYDFS', owner: p.ciso.name, frequency: 'Annual', lastGeneratedDays: 171, pages: 28, citations: 136, format: 'PDF', description: 'Annual certification of compliance for Aldersgate Markets Inc., with CISO report to the board (500.4).', sections: ['frameworks', 'loops', 'incidents', 'exposure'], deadline: 'Due 15 April', status: 'ready', scope: 'markets' },
      { id: 'pci', title: 'PCI DSS v4.0.1 ROC evidence', audience: 'Auditor', framework: 'PCI DSS', regulator: 'QSA', owner: c.people.staff[5].name, frequency: 'Annual', lastGeneratedDays: 330, pages: 140, citations: 690, format: 'PDF', description: 'Requirement-by-requirement evidence for the QSA, including 10.4 daily log review and 6.2 AppSec attestations.', sections: ['frameworks', 'loops', 'exposure'], deadline: 'QSA on-site in December', status: 'due' },
    ],
    maritime: [
      { id: 'imo', title: 'IMO MSC.428(98) SMS cyber evidence', audience: 'Regulator', framework: 'IMO', regulator: 'Flag state · DoC auditor', owner: ot, frequency: 'Annual', lastGeneratedDays: 220, pages: 34, citations: 158, format: 'PDF', description: 'Cyber risk management in the Safety Management System for all 22 vessels, aligned to MSC-FAL.1/Circ.3.', sections: ['ot', 'loops', 'frameworks', 'risks'], deadline: 'DoC verification in February', status: 'ready', scope: 'fleet' },
      { id: 'iacs', title: 'IACS UR E26/E27 class evidence', audience: 'Auditor', framework: 'IACS E26/27', regulator: 'Bureau Veritas Marine', owner: ot, frequency: 'On demand', lastGeneratedDays: 45, pages: 52, citations: 241, format: 'PDF', description: 'Asset inventory, zones and conduits, remote-access and change-control evidence for class surveys of 2 newbuilds.', sections: ['ot', 'loops', 'exposure'], deadline: 'Class survey: 2 newbuilds', status: 'draft', scope: 'fleet' },
      { id: 'nis2', title: 'NIS2 incident notification', audience: 'Regulator', framework: 'NIS2', regulator: 'CSIRT NL · CCB Belgium', owner: p.ciso.name, frequency: 'Event-driven', period: 'weekly', lastGeneratedDays: 96, pages: 4, citations: 16, format: 'DOCX', description: 'Early warning (24 h), notification (72 h) and final report for Maasvlakte and Antwerp terminals.', sections: ['incidents', 'ot'], status: 'ready', scope: 'rtm' },
    ],
    media: [
      { id: 'tpn', title: 'TPN assessment pack', audience: 'Auditor', framework: 'TPN', regulator: 'TPN+ assessor', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 330, pages: 64, citations: 302, format: 'PDF', description: 'Site, application and vendor evidence for the TPN+ Gold Shield re-assessment, with custody chain proofs.', sections: ['frameworks', 'custody', 'loops', 'exposure'], deadline: 'Re-assessment in 41 days', status: 'due' },
      { id: 'mpa', title: 'MPA content security control evidence', audience: 'Customer', framework: 'MPA CSBP', regulator: 'Studio partners', owner: p.grcLead.name, frequency: 'Quarterly', lastGeneratedDays: 71, pages: 38, citations: 188, format: 'PDF', description: 'MPA CSBP control evidence for distribution and co-production partners, including watermarking and custody.', sections: ['custody', 'frameworks', 'loops'], status: 'ready' },
      { id: 'soc2', title: 'SOC 2 Type II evidence · KestrelPlay', audience: 'Auditor', framework: 'SOC 2', regulator: 'Service auditor', owner: c.people.staff[8].name, frequency: 'Annual', lastGeneratedDays: 190, pages: 72, citations: 344, format: 'PDF', description: 'Trust Services Criteria evidence for the streaming platform, population samples from Okta, AWS and Snyk.', sections: ['frameworks', 'loops', 'exposure', 'incidents'], deadline: 'Period ends 31 Dec', status: 'ready', scope: 'play' },
    ],
    healthcare: [
      { id: 'hipaa-ra', title: 'HIPAA Security Rule risk analysis', audience: 'Regulator', framework: 'HIPAA', regulator: 'HHS OCR (on request) · Board audit committee', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 262, pages: 58, citations: 296, format: 'DOCX', description: 'Enterprise-wide risk analysis under 45 CFR 164.308(a)(1): ePHI systems, threats, likelihood and impact, with Epic, PACS and 14,600 medical devices in scope.', sections: ['frameworks', 'loops', 'exposure', 'ot', 'risks'], deadline: 'Annual refresh due January', status: 'due' },
      { id: 'ocr-breach', title: 'HHS OCR breach report (500+ individuals)', audience: 'Regulator', framework: 'HIPAA', regulator: 'HHS OCR breach portal', owner: p.grcLead.name, frequency: 'Event-driven', period: 'weekly', lastGeneratedDays: 0, pages: 9, citations: 41, format: 'DOCX', description: 'Breach notification under 45 CFR 164.408, pre-filled from INC-MRH-1194 forensics: individuals affected, PHI types, safeguards in place, plus individual and media notice drafts.', sections: ['incidents', 'risks'], deadline: '60-day clock: 41 days left', status: 'draft', scope: 'mrmc' },
      { id: 'hitrust', title: 'HITRUST r2 validated assessment evidence', audience: 'Auditor', framework: 'HITRUST', regulator: 'HITRUST external assessor', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 300, pages: 120, citations: 612, format: 'PDF', description: 'Requirement statements with maturity scoring evidence (policy, procedure, implemented, measured, managed) and sampled populations.', sections: ['frameworks', 'loops', 'exposure', 'ot'], deadline: 'r2 assessment in March', status: 'draft' },
      { id: 'joint-commission', title: 'Joint Commission emergency management & IT continuity', audience: 'Auditor', framework: 'Joint Commission', regulator: 'The Joint Commission surveyors', owner: ot, frequency: 'Annual', lastGeneratedDays: 180, pages: 26, citations: 104, format: 'PDF', description: 'EM continuity-of-operations evidence: Epic downtime drills, backup restore tests, medical-device outage procedures and cyber incident exercises.', sections: ['incidents', 'ot', 'loops', 'risks'], deadline: 'Unannounced survey window open', status: 'ready' },
    ],
    automotive: [
      { id: 'r155-kba', title: 'UNECE R155 CSMS monitoring report', audience: 'Regulator', framework: 'UNECE R155', regulator: 'KBA (Kraftfahrt-Bundesamt)', owner: c.people.staff[2].name, frequency: 'Annual', lastGeneratedDays: 190, pages: 44, citations: 238, format: 'PDF', description: 'R155 7.4.1 report on monitoring activities: vehicle SOC detections, attacks on the fleet, new threats and vulnerabilities, and mitigations for all approved vehicle types.', sections: ['incidents', 'exposure', 'loops', 'frameworks', 'risks'], deadline: 'CSMS re-audit (KBA) in April', status: 'due', scope: 'connected' },
      { id: 'r156-sums', title: 'UNECE R156 SUMS report', audience: 'Regulator', framework: 'UNECE R156', regulator: 'KBA type-approval', owner: c.people.staff[6].name, frequency: 'Quarterly', lastGeneratedDays: 9, pages: 22, citations: 117, format: 'PDF', description: 'Software update campaigns, RXSWIN changes, signing ceremonies and package lineage from commit to vehicle, with failed-install analysis.', sections: ['custody', 'loops', 'frameworks', 'risks'], status: 'ready', scope: 'connected' },
      { id: 'tisax', title: 'TISAX AL3 assessment evidence pack', audience: 'Auditor', framework: 'TISAX', regulator: 'ENX audit provider', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 330, pages: 88, citations: 401, format: 'PDF', description: 'VDA ISA 6 controls incl. prototype protection: evidence per control, supplier labels and design-IP custody proofs.', sections: ['frameworks', 'custody', 'loops', 'exposure'], deadline: 'AL3 renewal in February', status: 'due', scope: 'group' },
      { id: 'nis2', title: 'NIS2 incident notification', audience: 'Regulator', framework: 'NIS2', regulator: 'BSI (Germany) · NCSC-HU', owner: p.ciso.name, frequency: 'Event-driven', period: 'weekly', lastGeneratedDays: 58, pages: 5, citations: 19, format: 'DOCX', description: 'Early warning (24 h), notification (72 h) and final report for the Ingolstadt and Győr plants as essential entities.', sections: ['incidents', 'ot'], status: 'ready', scope: 'ingolstadt' },
    ],
    insurance: [
      { id: 'nydfs', title: 'NYDFS 500.17(b) certification of compliance', audience: 'Regulator', framework: 'NYDFS 500', regulator: 'NYDFS', owner: p.ciso.name, frequency: 'Annual', lastGeneratedDays: 171, pages: 32, citations: 148, format: 'PDF', description: 'Annual certification for Kingsbridge Mutual signed by the CEO and CISO, with the CISO report to the Mutual Board (500.4), asset inventory and any remediation timetable for gaps.', sections: ['frameworks', 'loops', 'incidents', 'exposure'], deadline: 'Due 15 April', status: 'ready' },
      { id: 'nydfs-notice', title: 'NYDFS 500.17(a) and CT IDSL cybersecurity event notice', audience: 'Regulator', framework: 'NYDFS 500', regulator: 'NYDFS portal · Connecticut Insurance Department', owner: p.ciso.name, frequency: 'Event-driven', period: 'daily', lastGeneratedDays: 0, pages: 6, citations: 24, format: 'DOCX', description: '72-hour notice to NYDFS and the Connecticut Insurance Department, 24-hour extortion-payment notice where relevant and the follow-up report, pre-filled from the open Claims & SIU case and NAIC #668 event fields.', sections: ['incidents', 'risks'], deadline: '72-hour notification window open', status: 'due', scope: 'claims' },
      { id: 'naic-board', title: 'Information security programme report to the Board (NAIC #668)', audience: 'Board', framework: 'NAIC #668', regulator: 'Mutual Board · Connecticut Insurance Department (on exam)', owner: p.ciso.name, frequency: 'Annual', lastGeneratedDays: 205, pages: 16, citations: 71, format: 'PPTX', description: 'Annual written report under the Insurance Data Security Model Law: programme status, material risks, third-party service providers (EXL, Guidewire, CCC), events and recommended changes.', sections: ['ri', 'frameworks', 'incidents', 'insurance', 'risks'], deadline: 'Board meeting in December', status: 'draft' },
      { id: 'pci', title: 'PCI DSS v4.0.1 ROC evidence · premium payments CDE', audience: 'Auditor', framework: 'PCI DSS', regulator: 'QSA', owner: 'Grace Whitfield', frequency: 'Annual', lastGeneratedDays: 320, pages: 128, citations: 640, format: 'PDF', description: 'Requirement-by-requirement evidence for the premium payment gateway and One Inc integration, incl. 6.4.3 and 11.6.1 payment-page script integrity and 10.4 daily log review.', sections: ['frameworks', 'loops', 'exposure'], deadline: 'QSA on-site in January', status: 'due', scope: 'personal' },
      { id: 'mar', title: 'NAIC Model Audit Rule ITGC evidence', audience: 'Auditor', framework: 'NAIC MAR', regulator: 'External auditor', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 95, pages: 54, citations: 266, format: 'PDF', description: 'IT general controls over financial reporting: z/OS RACF access reviews, reserving-model and Guidewire change management, privileged access and job scheduling, with sampled populations.', sections: ['frameworks', 'loops', 'risks'], deadline: 'Interim fieldwork in November', status: 'draft' },
    ],
    defence: [
      { id: 'sprs', title: 'CMMC Level 2 SPRS score and POA&M', audience: 'Regulator', framework: 'CMMC L2', regulator: 'DoD SPRS (via PIEE)', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 150, pages: 24, citations: 186, format: 'PDF', description: 'NIST SP 800-171 DoD assessment score (110-point methodology), POA&M with 180-day closure dates and SSP v4.2 references, for the annual affirmation by the senior official.', sections: ['frameworks', 'loops', 'risks'], deadline: 'Annual affirmation due in March', status: 'ready', scope: 'programs' },
      { id: 'c3pao', title: 'CMMC Level 2 C3PAO assessment evidence pack', audience: 'Auditor', framework: 'CMMC L2', regulator: 'Redstone Cyber Assessors (C3PAO)', owner: p.grcLead.name, frequency: 'On demand', lastGeneratedDays: 40, pages: 132, citations: 718, format: 'PDF', description: '110 NIST 800-171 requirements and 320 assessment objectives with examine, interview and test evidence, enclave boundary diagrams and controls inherited from GCC High.', sections: ['frameworks', 'loops', 'exposure', 'ot'], deadline: 'C3PAO assessment in January', status: 'due' },
      { id: 'dfars-7012', title: 'DFARS 252.204-7012 cyber incident report', audience: 'Regulator', framework: 'DFARS 7012', regulator: 'DoD DC3 (DIBNet) · affected primes', owner: p.ciso.name, frequency: 'Event-driven', period: 'daily', lastGeneratedDays: 24, pages: 7, citations: 31, format: 'DOCX', description: '72-hour DIBNet report, 90-day image preservation record and DC3 malware submission, with notices to affected primes (Lockheed Martin, RTX) and the contracting officer.', sections: ['incidents', 'risks'], deadline: 'DIBNet 72-hour window', status: 'ready', scope: 'programs' },
      { id: 'itar', title: 'ITAR technical data access and transfer report', audience: 'Executive', framework: 'ITAR / EAR', regulator: 'Empowered Official · DDTC (if a disclosure is needed)', owner: 'Carla Jennings', frequency: 'Quarterly', lastGeneratedDays: 25, pages: 18, citations: 94, format: 'PDF', description: 'US-person access to ITAR data in Teamcenter and the CUI enclave, TDP transfers to primes and sub-tiers with custody proofs, and potential disclosures for Empowered Official review.', sections: ['custody', 'frameworks', 'risks'], status: 'ready', scope: 'programs' },
      { id: 'prime-flowdown', title: 'Prime cyber flow-down attestation (DFARS 7012, 7019–7021)', audience: 'Customer', framework: 'DFARS 7019-7021', regulator: 'Lockheed Martin · RTX · Northrop Grumman · L3Harris', owner: 'Erin Kowalski', frequency: 'Quarterly', lastGeneratedDays: 33, pages: 10, citations: 48, format: 'PDF', description: 'Supplier attestation for the primes via Exostar: SPRS score, CMMC status, incident history and flow-down to sub-tier machine shops and finishers.', sections: ['frameworks', 'incidents', 'custody'], status: 'ready' },
    ],
    pharma: [
      { id: 'annex11', title: 'GxP computerised systems inspection pack (Annex 11 / Part 11)', audience: 'Regulator', framework: 'EU GMP Annex 11', regulator: 'Swissmedic · FDA · HPRA inspectors', owner: p.grcLead.name, frequency: 'On demand', lastGeneratedDays: 74, pages: 112, citations: 584, format: 'PDF', description: 'Validated-state evidence for DeltaV, PAS-X, Veeva Vault and Medidata Rave: audit trails, e-signatures, access reviews, ALCOA+ data-integrity controls and periodic reviews.', sections: ['frameworks', 'loops', 'ot', 'custody'], deadline: 'Swissmedic GMP inspection at Valais in February', status: 'due' },
      { id: 'aiact', title: 'EU AI Act system register and high-risk conformity file', audience: 'Regulator', framework: 'EU AI Act', regulator: 'Notified body · FDPIC (revDSG)', owner: 'Dr. Julia Hartmann', frequency: 'Annual', lastGeneratedDays: 120, pages: 38, citations: 176, format: 'DOCX', description: 'AI inventory with risk classification (MolGen, pharmacovigilance case-intake NLP, site-selection model), technical documentation, human oversight and post-market monitoring, mapped to GAMP 5.', sections: ['ai', 'frameworks', 'risks'], deadline: 'Gap-closure plan to the Board in Q1', status: 'draft' },
      { id: 'ectd', title: 'Regulatory submission custody report (eCTD)', audience: 'Regulator', framework: 'Part 11', regulator: 'FDA · EMA · Swissmedic', owner: p.grcLead.name, frequency: 'Quarterly', lastGeneratedDays: 28, pages: 22, citations: 118, format: 'PDF', description: 'Custody chain for eCTD sequence 0042 (FDA BLA, rhenatumab) and the RHN-2290 MAA dossier: who handled each module, hash verification at submission and gateway receipts.', sections: ['custody', 'frameworks', 'loops'], status: 'ready' },
      { id: 'ctr-breach', title: 'Clinical trial serious breach notification (EU CTR Art. 52)', audience: 'Regulator', framework: 'EU CTR / GCP', regulator: 'CTIS · national competent authorities', owner: 'Dr. Priya Raman', frequency: 'Event-driven', period: 'daily', lastGeneratedDays: 19, pages: 6, citations: 28, format: 'DOCX', description: 'Seven-day assessment of whether the RHN-4471 randomisation-list mis-share is a serious breach, with custody revocation proof, blinding impact and CRO corrective actions.', sections: ['custody', 'incidents', 'risks'], status: 'ready', scope: 'clinops' },
      { id: 'nis2', title: 'NIS2 and Swiss NCSC incident notification', audience: 'Regulator', framework: 'NIS2', regulator: 'NCSC Ireland · Swiss NCSC', owner: p.ciso.name, frequency: 'Event-driven', period: 'weekly', lastGeneratedDays: 88, pages: 5, citations: 19, format: 'DOCX', description: 'Early warning (24 h), notification (72 h) and final report for the Cork fill-finish site as an essential entity, plus the 24-hour cyberattack report to the Swiss NCSC.', sections: ['incidents', 'ot'], status: 'ready', scope: 'cork' },
    ],
    sghospital: [
      { id: 'hia', title: 'Health Information Act cybersecurity and data security assurance', audience: 'Regulator', framework: 'HIA CS/DS', regulator: 'Ministry of Health (MOH)', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 160, pages: 46, citations: 238, format: 'PDF', description: 'HIA cybersecurity and data security requirements for TrakCare, PACS, the laboratory system and the medical-device estate: controls, evidence and residual risks, signed off by the Group CEO.', sections: ['frameworks', 'loops', 'ot', 'risks'], deadline: 'MOH licence review in January', status: 'due' },
      { id: 'hia-incident', title: 'MOH cybersecurity incident report (HIA)', audience: 'Regulator', framework: 'HIA CS/DS', regulator: 'MOH · CSA (SingCERT)', owner: p.ciso.name, frequency: 'Event-driven', period: 'daily', lastGeneratedDays: 22, pages: 6, citations: 26, format: 'DOCX', description: 'Immediate notification to MOH and the 14-day detailed incident report, pre-filled from the HexaSOC case with clinical-service and patient-impact assessment.', sections: ['incidents', 'risks'], status: 'ready', scope: 'labimg' },
      { id: 'pdpa', title: 'PDPA data breach assessment and PDPC notification', audience: 'Regulator', framework: 'PDPA', regulator: 'PDPC', owner: 'Deepa Krishnan', frequency: 'Event-driven', period: 'weekly', lastGeneratedDays: 38, pages: 8, citations: 34, format: 'DOCX', description: 'Assessment of whether a breach is notifiable, PDPC notice within 3 calendar days and patient notices, with custody revocation evidence for the overseas second-opinion imaging share.', sections: ['custody', 'incidents', 'risks'], status: 'ready', scope: 'labimg' },
      { id: 'nehr', title: 'NEHR readiness and contribution assurance', audience: 'Regulator', framework: 'NEHR readiness', regulator: 'MOH · Synapxe', owner: 'Benjamin Goh', frequency: 'Quarterly', lastGeneratedDays: 21, pages: 20, citations: 102, format: 'PDF', description: 'HealthConnect contribution interface controls, weekly NEHR submission batch integrity (NB-2026-W40), access logging and Synapxe connection conditions.', sections: ['frameworks', 'custody', 'loops'], status: 'ready' },
      { id: 'aihgle', title: 'Clinical AI governance report (AIHGle)', audience: 'Executive', framework: 'AIHGle', regulator: 'MOH · HSA (AI medical devices)', owner: 'Dr. Rachel Ong', frequency: 'Half-yearly', lastGeneratedDays: 70, pages: 16, citations: 66, format: 'PDF', description: 'Clinical AI inventory (chest X-ray triage, sepsis early warning, ambient notes), HSA registration status, clinician oversight, performance monitoring and unsanctioned AI use.', sections: ['ai', 'risks'], status: 'draft' },
    ],
    studio: [
      { id: 'tpn', title: 'TPN assessment pack', audience: 'Auditor', framework: 'TPN', regulator: 'TPN+ assessor', owner: p.grcLead.name, frequency: 'Annual', lastGeneratedDays: 320, pages: 78, citations: 356, format: 'PDF', description: 'Site, application and vendor evidence for the TPN+ Gold Shield re-assessment of Burbank, Soho and Vancouver, with custody chain proofs for ILM, Weta FX and DNEG.', sections: ['frameworks', 'custody', 'loops', 'exposure'], deadline: 'Re-assessment in 52 days', status: 'due' },
      { id: 'mpa', title: 'MPA content security control evidence', audience: 'Customer', framework: 'MPA CSBP', regulator: 'Co-production and distribution partners', owner: p.grcLead.name, frequency: 'Quarterly', lastGeneratedDays: 64, pages: 42, citations: 204, format: 'PDF', description: 'MPA CSBP evidence incl. NexGuard forensic watermarking, Indee screener controls and Signiant and Aspera transfer custody.', sections: ['custody', 'frameworks', 'loops'], status: 'ready' },
      { id: 'sec-8k', title: 'SEC Form 8-K Item 1.05 materiality assessment', audience: 'Regulator', framework: 'SEC 8-K 1.05', regulator: 'SEC (EDGAR) · Disclosure Committee', owner: p.ciso.name, frequency: 'Event-driven', period: 'daily', lastGeneratedDays: 21, pages: 8, citations: 36, format: 'DOCX', description: 'Materiality determination for the Disclosure Committee and a draft Item 1.05 disclosure within four business days, with impact on Starfall+, the parks and the release slate.', sections: ['incidents', 'risks', 'insurance'], status: 'ready', scope: 'play' },
      { id: '10k', title: 'Form 10-K Item 1C cybersecurity disclosure', audience: 'Board', framework: 'SEC 8-K 1.05', regulator: 'SEC · Audit Committee', owner: p.ciso.name, frequency: 'Annual', lastGeneratedDays: 280, pages: 12, citations: 58, format: 'DOCX', description: 'Risk management, strategy and governance narrative for Item 1C (Regulation S-K 106), cited to the programme, board oversight and vendor risk processes.', sections: ['ri', 'frameworks', 'risks'], deadline: 'Draft to the Audit Committee in January', status: 'due' },
      { id: 'pci', title: 'PCI DSS v4.0.1 ROC evidence · Starfall+ and parks', audience: 'Auditor', framework: 'PCI DSS', regulator: 'QSA', owner: 'Chris Delgado', frequency: 'Annual', lastGeneratedDays: 310, pages: 136, citations: 662, format: 'PDF', description: 'Requirement evidence for Starfall+ subscriptions (Adyen) and park ticketing (accesso), incl. 6.4.3 and 11.6.1 payment-page script integrity.', sections: ['frameworks', 'loops', 'exposure'], deadline: 'QSA on-site in December', status: 'due', scope: 'play' },
    ],
  };
  // Crisis exercise programme and value evidence (Operations → Crisis Exercises, Reporting → Value & Outcomes).
  const programmeTpl: TplSeed[] = [
    { id: 'exercise-aar', title: 'Crisis exercise after-action report', audience: 'Executive', owner: p.grcLead.name, frequency: 'Event-driven', period: 'quarterly', lastGeneratedDays: 9, pages: 12, citations: 48, format: 'PDF', description: 'Scenario, timeline of injects and decisions, scores by capability (detect, decide, communicate, recover, notify), lessons learned and owned actions, with evidence pushed to HexaComply for the regulator or auditor.', sections: ['incidents', 'frameworks', 'risks'], status: 'ready' },
    { id: 'value', title: 'Value & outcomes summary', audience: 'Board', owner: p.ciso.name, frequency: 'Quarterly', lastGeneratedDays: 87, pages: 6, citations: 39, format: 'PPTX', description: 'What HexaView and HexaShield services delivered against cost: incidents contained, hours saved, loss avoided, premium and tool savings, ROI multiple and top outcome stories, for the board and renewal.', sections: ['capability', 'incidents', 'insurance', 'risks'], status: 'due', deadline: 'Due before the HexaView renewal review' },
  ];
  return [...common.slice(0, 3), ...forCustomer(reg, c), ...common.slice(3), ...programmeTpl].map(withPeriod);
}

/* =====================================================================
   Cited document model
   ===================================================================== */
export interface Citation {
  n: number;
  id: string;
  source: string;
  version: string;
  retrievedMin: number;
}
export interface DocStatement {
  text: string;
  refs: number[];
}
export interface DocSection {
  id: SectionId;
  title: string;
  lead: string;
  statements: DocStatement[];
}
export interface ReportDoc {
  sections: DocSection[];
  citations: Citation[];
  summary: string[];
}

const fmt = (n: number) => n.toLocaleString('en-GB');

export function buildDoc(c: CustomerProfile, tenantId: string, ids: SectionId[], period: ReportPeriod = resolvePeriod('monthly'), compare = true): ReportDoc {
  const r = rng(`rep-doc-${c.id}-${tenantId}-${period.key}`);
  const h = headlines(c, tenantId);
  const ri = resilienceIndex(c, tenantId);
  const { cur, prev } = periodReport(c, tenantId, period);
  const ls = loopSummary(loops(c, tenantId));
  const ts = scopedTenants(c, tenantId);
  const hasOt = ts.some((t) => t.env.includes('ot')) && h.ot.otAssets > 0;
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
  const fwWeak = c.frameworks.slice().sort((a, b) => a.assured - b.assured)[0];
  const fwStrong = c.frameworks.slice().sort((a, b) => b.assured - a.assured)[0];
  const top = attention(c, tenantId).slice(0, 4);
  const drv = riDrivers(c)[0];
  const inP = `In ${period.kind === 'daily' || period.kind === 'custom' ? period.range : period.label}`;
  const make: Record<SectionId, () => DocSection> = {
    ri: () => ({ id: 'ri', title: 'Resilience Index', lead: 'How resilient the estate is at the end of the period, how it moved and what would raise it most.', statements: [
      st(`The Resilience Index closed the period at ${cur.ri} (${RI_VERSION})${compare ? `, ${cur.ri >= prev.ri ? 'up' : 'down'} ${Math.abs(Math.round((cur.ri - prev.ri) * 10) / 10)} points on ${period.prev.label}` : ''}; today it stands at ${ri.value}.`, cite(`ri:${RI_VERSION}@${tenantId}:${pk}`, 'HexaView RI engine')),
      st(`The largest single improvement available is to ${drv.text.charAt(0).toLowerCase()}${drv.text.slice(1)} (+${drv.gain}).`, cite('driver:1', 'HexaView RI simulator')),
    ] }),
    capability: () => ({ id: 'capability', title: 'Capability scores', lead: 'Scores per HexaShield capability at period end.', statements: [
      st(`Detection and response scores ${c.scores.soc}; validated defence (offensive testing) scores ${c.scores.strike}; governance scores ${c.scores.comply}.`, cite('metric:scores.capability', 'HexaView module scores')),
    ] }),
    incidents: () => ({ id: 'incidents', title: 'Alerts, incidents and response', lead: `Alert volume by severity across the period, how incidents were classified and how fast they were handled.`, statements: [
      st(`${inP}, ${fmt(cur.alerts)} alerts were triaged${vs(cur.alerts, prev.alerts, false)}, ${Math.round((cur.autoTriaged / Math.max(1, cur.alerts)) * 100)}% of them by HexaSOC agents.`, cite(`metric:soc.alerts@${pk}`, 'HexaSOC alert store')),
      st(`${fmt(cur.incidents)} incidents were raised${vs(cur.incidents, prev.incidents, false)}: ${cur.critical} critical and ${cur.high} high; ${fmt(cur.truePositives)} were confirmed true positives and all were contained.`, cite(`metric:soc.incidents@${pk}`, 'HexaSOC case store')),
      st(`Mean time to acknowledge was ${cur.mttaMin} minutes${vs(cur.mttaMin, prev.mttaMin, false)} and mean time to resolve ${cur.mttrMin} minutes${vs(cur.mttrMin, prev.mttrMin, false)}; ${cur.slaPct}% of SLAs were met.`, cite(`metric:soc.sla@${pk}`, 'HexaSOC SLA ledger')),
      st(`${h.ai.humanApprovalPct}% of agent write-backs to customer tools were approved by a named human.`, cite('metric:ai.agents', 'HexaSOC agent log')),
    ] }),
    loops: () => ({ id: 'loops', title: 'Closed-loop assurance', lead: 'Whether each control is proven end to end: requirement, control, evidence, technique, detection and validation.', statements: [
      st(`${cur.loopsAssuredPct}% of applicable control loops were assured at period end${vs(cur.loopsAssuredPct, prev.loopsAssuredPct, true, 'pts')}: ${ls.closed} closed, ${ls.partial} partial, ${ls.broken} broken and ${ls.stale} stale today.`, cite(`loopset:all@${tenantId}:${pk}`, 'HexaView closed-loop engine')),
    ] }),
    frameworks: () => ({ id: 'frameworks', title: 'Framework coverage', lead: 'Documented coverage against what is actually proven by closed loops.', statements: [
      st(`${fwStrong.short} is the best-assured framework at ${fwStrong.assured}% loop-proven (${fwStrong.documented}% documented).`, cite(`framework:${fwStrong.id}`, 'HexaComply framework pack')),
      st(`${fwWeak.short} is the weakest at ${fwWeak.assured}% assured${fwWeak.nextAudit ? `, ahead of the ${fwWeak.nextAudit}` : ''}.`, cite(`framework:${fwWeak.id}`, 'HexaComply framework pack')),
      st(`${fmt(cur.evidenceCollected)} evidence items were collected in the period${vs(cur.evidenceCollected, prev.evidenceCollected, true)}; ${h.comply.overdueTasks} tasks are overdue today.`, cite(`metric:comply.evidence@${pk}`, 'HexaComply evidence ledger')),
    ] }),
    exposure: () => ({ id: 'exposure', title: 'Exposure and testing', lead: 'Offensive-testing findings, internet exposure and credential leaks across the period.', statements: [
      st(`${cur.findingsOpened} findings were opened and ${cur.findingsClosed} closed${vs(cur.findingsClosed, prev.findingsClosed, true)}; ${h.strike.findingsToDetectionsPct}% of findings have become detections.`, cite(`metric:strike.findings@${pk}`, 'HexaStrike')),
      st(`${cur.credsExposed} newly exposed credentials and ${cur.lookalikes} lookalike domains were found${vs(cur.credsExposed, prev.credsExposed, false)}, across ${fmt(h.strike.externalAssets)} monitored internet-facing assets.`, cite(`metric:int.exposure@${pk}`, 'HexaInt · ASM')),
    ] }),
    ot: () => ({ id: 'ot', title: 'Operational technology', lead: 'Passive OT monitoring; OT is read-only by policy.', statements: hasOt ? [
      st(`${fmt(h.ot.otAssets)} OT assets across ${h.ot.sites} sites are monitored by ${h.ot.sensors} sensors with ${h.ot.purdueCoveragePct}% Purdue coverage; ${fmt(cur.otAlerts)} OT alerts were raised in the period${vs(cur.otAlerts, prev.otAlerts, false)}.`, cite(`metric:ot.alerts@${pk}`, 'HexaOT · OT sensors')),
      st('No automated action touched OT networks: every OT recommendation was decided by a human.', cite('policy:ot-read-only', 'HexaView policy register')),
    ] : [st('No operational technology is in scope for this tenant.', cite('metric:ot.assets', 'HexaOT'))] }),
    custody: () => ({ id: 'custody', title: c.vocab.custodyLabel, lead: 'Who handled protected assets, and what was revoked.', statements: [
      st(`${fmt(cur.transfers)} custody transfers were recorded${vs(cur.transfers, prev.transfers, true)} across ${h.custody.vendorsInChain} vendors, covering ${fmt(h.custody.assetsUnderCustody)} assets.`, cite(`metric:custody.transfers@${pk}`, 'HexaCustody ledger')),
      st(`${cur.revocations} revocations were issued and ${cur.custodyAnomalies} anomalies raised in the period.`, cite(`metric:custody.revocations@${pk}`, 'HexaCustody ledger')),
    ] }),
    ai: () => ({ id: 'ai', title: 'AI governance', lead: 'AI in use, sensitive data in prompts and what the SOC agents did.', statements: [
      st(`${h.ai.aiSystems} AI systems are governed; ${cur.shadowAiNew} unsanctioned AI apps were newly seen in the period.`, cite(`metric:ai.inventory@${pk}`, 'HexaAI discovery')),
      st(`${fmt(cur.promptDlp)} prompts were blocked or coached by DLP${vs(cur.promptDlp, prev.promptDlp, false)}; agents took ${fmt(cur.agentActions)} actions and the copilot answered ${fmt(cur.copilotQueries)} questions.`, cite(`metric:ai.runtime@${pk}`, 'HexaAI runtime')),
    ] }),
    insurance: () => ({ id: 'insurance', title: 'Cyber insurance', lead: 'Insurability against the carrier questionnaire and modelled loss.', statements: [
      st(`Insurability is ${h.insurance.insurability} with ${h.insurance.attestedControls} of ${h.insurance.totalControls} insurer controls attested.`, cite('metric:insurance.insurability', 'Cyber Insurance module')),
      st(`Modelled expected annual loss is ${h.insurance.expectedLossM}M and the 1-in-100 tail is ${h.insurance.tailLossM}M (${c.currency}).`, cite('metric:insurance.loss', 'Risk quantification model')),
    ] }),
    risks: () => ({ id: 'risks', title: 'Top risks', lead: 'Ranked items that need a decision, with owners.', statements: top.map((a) => st(`${a.title} (${a.sev}).`, cite(`incident:${a.module}-${a.tenant}-${a.ageMin}`, a.module.toUpperCase()))) }),
  };
  const sections = ids.map((id) => make[id]());
  const tr = (a: number, b: number, word: string, hib: boolean) => {
    const d = delta(a, b, hib);
    return d.flat ? `${word} held steady` : `${word} ${d.text.startsWith('↑') ? 'rose' : 'fell'} ${d.text.slice(2)}`;
  };
  const summary = [
    `${period.label} ${compare ? `was ${cur.alerts < prev.alerts ? 'a quieter' : 'a busier'} period than ${period.prev.label}` : 'is summarised below'} for ${tenantId === 'all' ? c.short : ts[0]?.name ?? c.short}. ${compare ? `${tr(cur.alerts, prev.alerts, 'Alert volume', false)} and ${tr(cur.incidents, prev.incidents, 'incidents raised', false)}; ` : ''}${fmt(cur.truePositives)} true positives were all contained, with ${cur.slaPct}% of SLAs met.`,
    `Response times ${compare ? (cur.mttrMin <= prev.mttrMin ? 'improved' : 'slipped') : 'are shown below'}: mean time to acknowledge was ${cur.mttaMin} minutes and to resolve ${cur.mttrMin} minutes. The Resilience Index closed the period at ${cur.ri}.`,
  ];
  return { sections, citations: cites, summary };
}

/* =====================================================================
   Issued reports
   ===================================================================== */
export interface IssuedReport {
  id: string;
  templateId: string;
  title: string;
  audience: Audience;
  period: string;
  periodKind: PeriodKind;
  periodRange: string;
  version: string;
  issuedDays: number;
  approver: string;
  author: string;
  sha256: string;
  citations: number;
  downloads: number;
  recipients: number;
  format: Format;
  sizeMb: number;
  tenant: string;
  anchorBlock: number;
}

export function issuedReports(c: CustomerProfile, tenantId: string): IssuedReport[] {
  const r = rng(`rep-issued-${c.id}`);
  const tpls = reportTemplates(c);
  const approvers = [c.people.ciso.name, c.people.grcLead.name, c.people.socLead.name];
  const out: IssuedReport[] = [];
  let seq = 112;
  const lag: Partial<Record<PeriodKind, number>> = { daily: 0, weekly: 1, monthly: 3, quarterly: 10, half: 14, annual: 21 };
  for (const t of tpls) {
    const n = t.frequency === 'Weekly' ? 52 : t.frequency === 'Monthly' ? 12 : t.frequency === 'Quarterly' ? 4 : t.frequency === 'Event-driven' ? 2 : t.frequency === 'On demand' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const kind: PeriodKind = t.frequency === 'Event-driven' ? 'weekly' : t.period === 'custom' ? 'quarterly' : t.period;
      const offset = t.frequency === 'Event-driven' ? i * r.int(8, 16) + Math.floor((t.lastGeneratedDays ?? 0) / 7) : t.frequency === 'On demand' ? i * 2 : t.frequency === 'Annual' ? Math.floor((t.lastGeneratedDays ?? 0) / 400) + i : i;
      const p = resolvePeriod(kind, offset);
      const issuedDays = Math.max(0, diffDays(p.end, NOW) - 1 + (t.frequency === 'Event-driven' ? r.int(0, 3) : lag[kind] ?? 3));
      if (issuedDays > 365) continue;
      out.push({
        id: `RPT-${c.initials}-${String(seq++).padStart(4, '0')}`,
        templateId: t.id,
        title: t.title,
        audience: t.audience,
        period: t.frequency === 'Event-driven' ? `Incident ${c.initials}-${r.int(1000, 9999)}` : p.label,
        periodKind: kind,
        periodRange: p.range,
        version: `v1.${r.int(0, 3)}`,
        issuedDays,
        approver: t.audience === 'Board' || t.audience === 'Insurer' ? c.people.ciso.name : r.pick(approvers),
        author: t.owner,
        sha256: r.hex(64),
        citations: Math.round(t.citations * r.float(0.85, 1.1, 2)),
        downloads: r.int(t.audience === 'Board' ? 12 : 2, t.audience === 'Customer' ? 140 : 40),
        recipients: t.audience === 'Board' ? r.int(9, 16) : t.audience === 'Customer' ? r.int(40, 160) : r.int(2, 12),
        format: t.format,
        sizeMb: r.float(0.6, Math.max(1, t.pages / 6), 1),
        tenant: t.scope ?? 'all',
        anchorBlock: 18_400_000 + r.int(0, 900_000),
      });
    }
  }
  const sorted = out.sort((a, b) => a.issuedDays - b.issuedDays);
  return tenantId === 'all' ? sorted : sorted.filter((x) => x.tenant === 'all' || x.tenant === tenantId);
}

/* =====================================================================
   Schedules & delivery
   ===================================================================== */
export const COVERAGE_OPTIONS = ['Previous full period', 'Period to date', 'Rolling 30 days', 'Rolling 90 days', 'Rolling 12 months'] as const;
export type Coverage = (typeof COVERAGE_OPTIONS)[number];

export interface Schedule {
  id: string;
  templateId: string;
  report: string;
  cadence: PeriodKind;
  frequency: string;
  coverage: Coverage;
  recipients: string;
  recipientCount: number;
  channel: string;
  format: Format;
  nextRunDays: number;
  approver: string;
  paused?: boolean;
  lastStatus: 'delivered' | 'failed' | 'awaiting approval';
}

export const CADENCE_TEXT: Record<Exclude<PeriodKind, 'custom'>, string> = {
  daily: 'Daily, 06:00',
  weekly: 'Weekly, Monday 07:00',
  monthly: 'Monthly, 3rd working day',
  quarterly: 'Quarterly, 10 days after close',
  half: 'Half-yearly, 15 days after close',
  annual: 'Annual, 21 days after FY close',
};

/** What a scheduled run covers, as a concrete range for the next run. */
export function coverageRange(cadence: PeriodKind, coverage: Coverage): string {
  if (coverage === 'Previous full period') return resolvePeriod(cadence === 'custom' ? 'monthly' : cadence).range;
  const end = addDays(day0(NOW), -1);
  if (coverage === 'Period to date') {
    const p = resolvePeriod(cadence === 'custom' ? 'monthly' : cadence);
    const start = addDays(p.end, 1);
    return fmtRange(start <= end ? start : end, end);
  }
  const days = coverage === 'Rolling 30 days' ? 30 : coverage === 'Rolling 90 days' ? 90 : 365;
  return fmtRange(addDays(end, -(days - 1)), end);
}

export function schedules(c: CustomerProfile, tenantId: string): Schedule[] {
  const r = rng(`rep-sched-${c.id}-${tenantId}`);
  const dom = c.domain;
  const lists: Record<string, [string, number, string]> = {
    board: [`board-cyber@${dom}`, 14, 'Email · custody-protected link'],
    msr: [`security-leadership@${dom}`, 9, 'Email · PDF'],
    weekly: [`secops-leads@${dom}`, 7, 'Email · PDF'],
    iso: [`audit-portal (${c.people.grcLead.name.split(' ').slice(-1)[0]})`, 3, 'Auditor portal'],
    insurer: [`${c.insurance.broker.split(' ')[0].toLowerCase()}-broking@external`, 4, 'Secure share'],
    trust: [`trust-centre@${dom}`, 1, 'Trust centre publish'],
    nydfs: ['nydfs-portal (manual upload)', 1, 'Regulator portal'],
    'dora-roi': ['cssf-eDesk (manual upload)', 1, 'Regulator portal'],
    pci: ['qsa-team@external', 3, 'Secure share'],
    imo: [`fleet-dpa@${dom}`, 6, 'Email · PDF'],
    iacs: ['bureau-veritas-survey@external', 2, 'Secure share'],
    tpn: ['tpn-plus-assessor@external', 2, 'TPN+ platform'],
    mpa: [`studio-partners@${dom}`, 18, 'Email · custody-protected link'],
    soc2: ['service-auditor@external', 3, 'Auditor portal'],
    'hipaa-ra': [`audit-committee@${dom}`, 8, 'Email · custody-protected link'],
    hitrust: ['hitrust-assessor@external', 3, 'HITRUST MyCSF upload'],
    'joint-commission': [`em-committee@${dom}`, 11, 'Email · PDF'],
    'r155-kba': ['kba-typgenehmigung (manual upload)', 1, 'Regulator portal'],
    'r156-sums': [`csms-board@${dom}`, 6, 'Email · custody-protected link'],
    tisax: ['enx-audit-provider@external', 2, 'Secure share'],
    'naic-board': [`board-cyber@${dom}`, 12, 'Email · custody-protected link'],
    mar: ['external-auditor@external', 4, 'Auditor portal'],
    sprs: ['sprs-piee (manual upload)', 1, 'Regulator portal'],
    c3pao: ['c3pao-assessor@external', 3, 'Secure share (CUI enclave)'],
    itar: [`empowered-official@${dom}`, 3, 'PreVeil · CUI'],
    'prime-flowdown': ['exostar-pim (supplier portal)', 4, 'Supplier portal'],
    annex11: ['gmp-inspection-room@external', 4, 'Secure share'],
    aiact: [`ai-governance-board@${dom}`, 9, 'Email · custody-protected link'],
    ectd: [`regulatory-affairs@${dom}`, 7, 'Email · custody-protected link'],
    hia: ['moh-licensing (manual upload)', 1, 'Regulator portal'],
    nehr: ['synapxe-nehr-assurance@external', 3, 'Secure share'],
    aihgle: [`clinical-ai-committee@${dom}`, 10, 'Email · PDF'],
    '10k': [`audit-committee@${dom}`, 7, 'Email · custody-protected link'],
  };
  const tpls = reportTemplates(c).filter((t) => t.frequency !== 'Event-driven');
  const out = tpls.map((t, i) => {
    const l = lists[t.id] ?? [`reports@${dom}`, 5, 'Email · PDF'];
    const cadence: PeriodKind = t.frequency === 'On demand' ? 'quarterly' : t.period === 'custom' ? 'monthly' : t.period;
    return {
      id: `SCH-${c.initials}-${100 + i}`,
      templateId: t.id,
      report: t.title,
      cadence,
      frequency: t.frequency === 'On demand' ? 'Quarterly (pre-audit)' : CADENCE_TEXT[cadence as Exclude<PeriodKind, 'custom'>],
      coverage: (t.id === 'trust' ? 'Rolling 12 months' : t.frequency === 'On demand' ? 'Rolling 90 days' : 'Previous full period') as Coverage,
      recipients: l[0],
      recipientCount: l[1],
      channel: l[2],
      format: t.format,
      nextRunDays: cadence === 'weekly' ? r.int(1, 6) : cadence === 'monthly' ? r.int(20, 28) : cadence === 'quarterly' ? r.int(5, 60) : r.int(30, 200),
      approver: t.audience === 'Board' || t.audience === 'Insurer' || t.audience === 'Regulator' ? c.people.ciso.name : t.owner,
      lastStatus: r.weighted<Schedule['lastStatus']>([['delivered', 8], ['awaiting approval', 2], ['failed', 0.6]]),
    } as Schedule;
  });
  // Per-tenant digests make the list feel lived-in.
  const ts = scopedTenants(c, tenantId);
  for (const t of ts.slice(0, 3)) {
    out.push({ id: `SCH-${c.initials}-${200 + out.length}`, templateId: 'weekly', report: `Daily security brief · ${t.short}`, cadence: 'daily', frequency: CADENCE_TEXT.daily, coverage: 'Previous full period', recipients: `secops-${t.id}@${dom}`, recipientCount: r.int(4, 12), channel: 'Email · PDF', format: 'PDF', nextRunDays: 1, approver: c.people.socLead.name, lastStatus: 'delivered' });
  }
  return out;
}

export function deliveryHistory(c: CustomerProfile, tenantId: string, days: number) {
  const r = rng(`rep-deliv-${c.id}-${tenantId}-${days}`);
  const share = tenantShare(c, tenantId);
  const weekly = days >= 30;
  const n = weekly ? Math.ceil(days / 7) : Math.max(7, days);
  const per = (weekly ? 7 : 1) * 2.4 * Math.max(0.35, share);
  const delivered = Array.from({ length: n }, () => Math.max(0, Math.round(per * (0.6 + r() * 0.9))));
  const failed: number[] = delivered.map(() => (r.chance(0.12) ? 1 : 0));
  const awaiting = delivered.map((_, i) => (i >= n - 2 && r.chance(0.7) ? r.int(1, 2) : 0));
  return { n, weekly, delivered, failed, awaiting };
}
