// Annual retainer for HexaStrike AI engine engagements (mock, Stripe TEST MODE).
// A client prepays a USD retainer; engagements then draw down from it instead
// of being charged to a card. Pure and seeded per customer.
import type { CustomerProfile } from '../types';
import { NOW, fxFromUsd } from '../../lib/format';
import { seedEngagements, typicalQuote, typesLabel, type AiptEngagement } from './aipentest';
import { IR_HOUR_USD, serviceById, readinessFrameworks, type ServiceCategory } from './retainer';
import { seedState } from './incident';

/* ---------------------------------------------------------------- currency */

/** Indicative GBP list price → USD (the inverse of the GBP rate used for AI pricing). */
export const gbpToUsd = (gbp: number) => Math.round(gbp / 0.79);
/** USD → customer currency, for showing the local equivalent alongside. */
export const usdToCustomer = (usd: number, currency: string) => Math.round(usd * fxFromUsd(currency));

/* ---------------------------------------------------------------- tiers */

export interface RetainerTier {
  id: string;
  usd: number;
  /** Indicative bonus credit (configurable by HexaShield). */
  bonusPct: number;
  perks: string[];
}

export const RETAINER_TIERS: RetainerTier[] = [
  { id: 'r10', usd: 10_000, bonusPct: 0, perks: ['Standard scheduling', 'Draw down per engagement'] },
  { id: 'r25', usd: 25_000, bonusPct: 3, perks: ['Priority scheduling', 'Draw down per engagement'] },
  { id: 'r50', usd: 50_000, bonusPct: 5, perks: ['Priority scheduling', 'One free retest per engagement', 'Dedicated engagement lead'] },
  { id: 'r100', usd: 100_000, bonusPct: 8, perks: ['Priority scheduling', 'One free retest per engagement', 'Dedicated engagement lead', 'Quarterly offensive-security review'] },
];
export const tierFor = (usd: number) => RETAINER_TIERS.find((t) => t.usd === usd) ?? RETAINER_TIERS[0];

/** Roughly how many typical web app tests a tier covers (baseline quote in USD). */
export function typicalCoverage(usd: number): { n: number; unitUsd: number; irHours: number } {
  const unitUsd = gbpToUsd(typicalQuote('Web application', 'GBP').gbp);
  return { n: Math.floor(usd / unitUsd), unitUsd, irHours: Math.floor(usd / IR_HOUR_USD) };
}

/* ---------------------------------------------------------------- retainer */

export type LedgerStatus = 'Committed' | 'Drawn' | 'Released';
export interface LedgerEntry {
  id: string;
  at: number;              // epoch ms
  /** What it was drawn against: an engagement, incident or service-request ID. */
  engId: string;
  label: string;           // test types or service name
  usd: number;
  /** Catalogue service (defaults to AI penetration testing for older entries). */
  serviceId?: string;
  category?: ServiceCategory;
  qty?: number;
  note?: string;
  /** Planned delivery date for a service request (ISO). */
  date?: string;
  /** Stored status. AI PT entries show as Drawn once the engagement has started; other services once delivered. */
  status: 'Committed' | 'Drawn' | 'Released';
}
export interface Retainer {
  tierUsd: number;
  bonusUsd: number;
  topUps: { usd: number; at: number }[];
  startDate: string;       // ISO YYYY-MM-DD
  paidAt: number;
  method: 'card' | 'invoice';
  methodLabel: string;     // masked card or "Invoice · bank transfer"
  autoRenew: boolean;
  /** IR hours reserved up front on higher tiers (drawn first by IR work). */
  irReservedHours?: number;
  ledger: LedgerEntry[];
}

/** IR hours reserved by tier (higher tiers only). */
export const IR_RESERVED_BY_TIER: Record<number, number> = { 50_000: 20, 100_000: 40 };

const STARTED = ['Testing', 'Reporting', 'Complete', 'Retest'];
export function ledgerStatus(l: LedgerEntry, engs: AiptEngagement[]): LedgerStatus {
  if (l.status !== 'Committed') return l.status;
  if ((l.serviceId ?? 'ai-pt') !== 'ai-pt') return 'Committed';
  const e = engs.find((x) => x.id === l.engId);
  return e && STARTED.includes(e.status) ? 'Drawn' : 'Committed';
}

export const categoryOf = (l: LedgerEntry): ServiceCategory => l.category ?? 'Offensive security';

/** Spend (drawn + committed) per service category. */
export function spendByCategory(r: Retainer): { category: ServiceCategory; usd: number }[] {
  const m = new Map<ServiceCategory, number>();
  for (const l of r.ledger) if (l.status !== 'Released') m.set(categoryOf(l), (m.get(categoryOf(l)) ?? 0) + l.usd);
  return [...m.entries()].map(([category, usd]) => ({ category, usd })).sort((a, b) => b.usd - a.usd);
}

/** IR hours: reserved bucket, used, and how many more the available balance would buy. */
export function irHours(r: Retainer, available: number) {
  const used = r.ledger.filter((l) => l.serviceId === 'ir-hours' && l.status !== 'Released').reduce((s, l) => s + (l.qty ?? 0), 0);
  const reserved = r.irReservedHours ?? 0;
  return { reserved, used, reservedLeft: Math.max(0, reserved - used), affordable: Math.floor(available / IR_HOUR_USD) };
}

export interface RetainerTotals { total: number; drawn: number; committed: number; available: number; pctLeft: number; renewal: Date; daysToRenewal: number }
export function retainerTotals(r: Retainer, engs: AiptEngagement[]): RetainerTotals {
  const total = r.tierUsd + r.bonusUsd + r.topUps.reduce((s, t) => s + t.usd, 0);
  let drawn = 0;
  let committed = 0;
  for (const l of r.ledger) {
    const st = ledgerStatus(l, engs);
    if (st === 'Drawn') drawn += l.usd;
    else if (st === 'Committed') committed += l.usd;
  }
  const available = Math.max(0, total - drawn - committed);
  const start = new Date(`${r.startDate}T00:00:00`);
  const renewal = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  return { total, drawn, committed, available, pctLeft: total ? (available / total) * 100 : 0, renewal, daysToRenewal: Math.max(0, Math.ceil((renewal.getTime() - NOW.getTime()) / 864e5)) };
}

/** Engagement cost in USD for a draw-down. */
export const engUsd = (e: AiptEngagement) => gbpToUsd(e.priceGbp);

/** How an engagement was paid: from the retainer, card, or split. */
export function paymentSource(e: AiptEngagement, r: Retainer | null): 'Retainer' | 'Card' | 'Split' | null {
  if (!e.paid) return null;
  const onRetainer = r?.ledger.some((l) => l.engId === e.id && l.status !== 'Released');
  if (onRetainer) return e.paidVia === 'Split' ? 'Split' : 'Retainer';
  return 'Card';
}

/** Month-by-month remaining balance over the retainer year, with a run-rate forecast. */
export function burnDown(r: Retainer, engs: AiptEngagement[]) {
  const t = retainerTotals(r, engs);
  const start = new Date(`${r.startDate}T00:00:00`);
  const labels: string[] = [];
  const actual: (number | null)[] = [];
  const forecast: (number | null)[] = [];
  const used = (until: number) => r.ledger.filter((l) => l.status !== 'Released' && l.at <= until).reduce((s, l) => s + l.usd, 0);
  const topped = (until: number) => r.topUps.filter((x) => x.at <= until).reduce((s, x) => s + x.usd, 0);
  // At least a month of history, so a brand-new retainer does not forecast from one day.
  const elapsedDays = Math.max(30, (NOW.getTime() - start.getTime()) / 864e5);
  const spent = t.total - t.available;
  const perDay = spent / elapsedDays;
  const runOutDays = perDay > 0 ? t.available / perDay : Infinity;
  const runOut = Number.isFinite(runOutDays) ? new Date(NOW.getTime() + runOutDays * 864e5) : null;
  let nowIdx = 0;
  for (let m = 0; m <= 12; m++) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, start.getDate());
    labels.push(d.toLocaleDateString('en-GB', { month: 'short' }));
    const base = r.tierUsd + r.bonusUsd;
    if (d.getTime() <= NOW.getTime()) {
      actual.push(Math.max(0, base + topped(d.getTime()) - used(d.getTime())));
      forecast.push(null);
      nowIdx = m;
    } else {
      actual.push(null);
      forecast.push(Math.max(0, Math.round(t.available - perDay * ((d.getTime() - NOW.getTime()) / 864e5))));
    }
  }
  // Join the forecast to today's actual so the dashed line starts where the solid one ends.
  forecast[nowIdx] = actual[nowIdx];
  return { labels, actual, forecast, runOut, perDay };
}

/* ---------------------------------------------------------------- seeds */

const SEEDED: Partial<Record<string, { usd: number; daysAgo: number; fill: number }>> = {
  finserv: { usd: 50_000, daysAgo: 210, fill: 0.55 },
  pharma: { usd: 100_000, daysAgo: 150, fill: 0.4 },
  defence: { usd: 25_000, daysAgo: 240, fill: 0.6 },
  studio: { usd: 25_000, daysAgo: 120, fill: 0.5 },
  insurance: { usd: 10_000, daysAgo: 300, fill: 0.95 },
};

/** A seeded active retainer (or null) with draw-downs from the customer's paid engagements. */
const seededCache = new Map<string, Retainer | null>();
export function seedRetainer(c: CustomerProfile): Retainer | null {
  if (!seededCache.has(c.id)) seededCache.set(c.id, buildSeed(c));
  return seededCache.get(c.id)!;
}

function buildSeed(c: CustomerProfile): Retainer | null {
  const cfg = SEEDED[c.id];
  if (!cfg) return null;
  const tier = tierFor(cfg.usd);
  const startMs = NOW.getTime() - cfg.daysAgo * 864e5;
  const start = new Date(startMs);
  const r: Retainer = {
    tierUsd: tier.usd, bonusUsd: Math.round((tier.usd * tier.bonusPct) / 100), topUps: [],
    startDate: new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    paidAt: startMs, method: cfg.usd >= 50_000 ? 'invoice' : 'card', methodLabel: cfg.usd >= 50_000 ? 'Invoice · bank transfer' : 'Visa •••• 4242', autoRenew: cfg.usd >= 25_000,
    irReservedHours: IR_RESERVED_BY_TIER[tier.usd], ledger: [],
  };
  const cap = (r.tierUsd + r.bonusUsd) * cfg.fill;
  const day = 864e5;
  const daysAgo = (d: number) => NOW.getTime() - d * day;
  // Services delivered more than two weeks ago are Drawn; recent requests are still Committed.
  const svc = (id: string, qty: number, d: number, ref: string, note?: string): LedgerEntry | null => {
    const s = serviceById(c, id);
    if (!s) return null;
    return { id: `RL-${id}-${ref}`, at: daysAgo(d), engId: ref, label: s.name, usd: s.usd * qty, serviceId: s.id, category: s.category, qty, note, status: d > 14 ? 'Drawn' : 'Committed' };
  };
  const candidates: LedgerEntry[] = [];
  // AI penetration testing engagements paid in the retainer year.
  for (const e of seedEngagements(c).filter((x) => x.paid && x.createdDays < cfg.daysAgo)) {
    candidates.push({ id: `RL-${e.id}`, at: daysAgo(e.createdDays), engId: e.id, label: typesLabel(e.types), usd: engUsd(e), serviceId: 'ai-pt', category: 'Offensive security', status: 'Committed' });
  }
  // IR hours against the customer's real incidents.
  const ir = seedState(c, NOW.getTime()).incidents;
  ir.slice(0, 3).forEach((inc, i) => {
    const d = Math.max(1, Math.round((NOW.getTime() - inc.detectedAt) / day));
    const e = svc('ir-hours', [14, 8, 6][i], Math.min(d, cfg.daysAgo - 5), inc.id, inc.title);
    if (e) candidates.push(e);
  });
  const fw = readinessFrameworks(c)[0];
  [
    svc('tabletop', 1, Math.round(cfg.daysAgo * 0.7), 'EX-TT-01', 'Ransomware tabletop for the executive team'),
    svc('vciso', 12, Math.round(cfg.daysAgo * 0.5), 'VCISO-Q1', 'Quarterly vCISO hours'),
    svc(`readiness-${fw.toLowerCase().replace(/[^a-z0-9]+/g, '')}`, 1, Math.round(cfg.daysAgo * 0.35), `GRC-${fw.replace(/\W+/g, '')}`, `${fw} readiness assessment`),
  ].forEach((e) => e && candidates.push(e));
  // A realistic mix first (one AI PT, IR hours, tabletop, readiness, vCISO), then the remaining AI PT work.
  const aipt = candidates.filter((e) => e.serviceId === 'ai-pt').sort((a, b) => a.at - b.at);
  const order = [...aipt.slice(0, 1), ...candidates.filter((e) => e.serviceId === 'ir-hours'), ...candidates.filter((e) => e.serviceId !== 'ai-pt' && e.serviceId !== 'ir-hours'), ...aipt.slice(1)];
  let used = 0;
  for (const e of order) {
    if (used + e.usd > cap) continue;
    used += e.usd;
    r.ledger.push(e);
  }
  r.ledger.sort((a, b) => a.at - b.at);
  // Top up with recent vCISO hours so each retainer sits near its intended level.
  const gap = cap - used;
  if (gap >= 600) {
    const e = svc('vciso', Math.floor(gap / 300), 6, 'VCISO-RECENT', 'Recent vCISO hours');
    if (e) r.ledger.push(e);
  }
  return r;
}
