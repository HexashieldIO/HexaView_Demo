// HexaInt · Executive Protection. Personal exposure of executives, board
// members and key people, impersonation and deepfakes, data-broker removals and
// travel risk. Advisory-level only: findings are summarised, never the
// underlying personal data. Everyone named is fictional customer data.
import type { CustomerId, CustomerProfile, Person, Severity } from '../types';
import { rng, type Rng } from '../../lib/rng';
import { headlines } from '../core';
import { vipExposure } from './int';
import { incidents } from './soc';

/* ---------------- Vocabulary ---------------- */
export const VIP_TIERS = ['Board', 'Executive', 'Key person', 'Security'] as const;
export type VipTier = (typeof VIP_TIERS)[number];
export const TIER_COLOR: Record<VipTier, string> = { Board: '#a07cfb', Executive: '#4f8cff', 'Key person': '#2dd4bf', Security: '#f5a83d' };

export const FINDING_KINDS = ['Leaked credential', 'Home address', 'Personal phone', 'Family & social', 'Data-broker listing', 'Impersonating account', 'Lookalike domain'] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];
export const FINDING_COLOR: Record<FindingKind, string> = {
  'Leaked credential': '#f8646f', 'Home address': '#f2643f', 'Personal phone': '#f5a83d', 'Family & social': '#ecc873',
  'Data-broker listing': '#68b1ff', 'Impersonating account': '#ef6aae', 'Lookalike domain': '#a07cfb',
};
export const FINDING_STATUSES = ['Open', 'Removal requested', 'Resolved', 'Monitoring'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export const FINDING_STATUS_COLOR: Record<FindingStatus, string> = { Open: 'var(--sev-high)', 'Removal requested': 'var(--sev-medium)', Resolved: 'var(--good)', Monitoring: 'var(--text-muted)' };

export const IMP_KINDS = ['Fake social profile', 'Voice clone', 'Deepfake video', 'Lookalike domain', 'Email spoof', 'CEO fraud / payment diversion', 'Messaging-app impersonation'] as const;
export type ImpKind = (typeof IMP_KINDS)[number];
export const IMP_COLOR: Record<ImpKind, string> = {
  'Fake social profile': '#ef6aae', 'Voice clone': '#a07cfb', 'Deepfake video': '#8f8cff', 'Lookalike domain': '#68b1ff',
  'Email spoof': '#f5a83d', 'CEO fraud / payment diversion': '#f8646f', 'Messaging-app impersonation': '#2dd4bf',
};
export const IMP_STATUSES = ['New', 'Takedown requested', 'Taken down', 'Intercepted', 'Monitoring'] as const;
export type ImpStatus = (typeof IMP_STATUSES)[number];
export const IMP_STATUS_COLOR: Record<ImpStatus, string> = { New: 'var(--sev-high)', 'Takedown requested': 'var(--sev-medium)', 'Taken down': 'var(--good)', Intercepted: 'var(--good)', Monitoring: 'var(--text-muted)' };

export const BROKER_CATS = ['People-search sites', 'Background-check services', 'Marketing data brokers', 'Property & public-records aggregators', 'Reverse phone lookup', 'Social profile aggregators'] as const;
export type BrokerCat = (typeof BROKER_CATS)[number];
export const BROKER_COLOR: Record<BrokerCat, string> = {
  'People-search sites': '#4f8cff', 'Background-check services': '#a07cfb', 'Marketing data brokers': '#2dd4bf',
  'Property & public-records aggregators': '#f5a83d', 'Reverse phone lookup': '#ef6aae', 'Social profile aggregators': '#93d65a',
};
export const REMOVAL_STATES = ['Found', 'Requested', 'Removed', 'Re-listed'] as const;
export type RemovalState = (typeof REMOVAL_STATES)[number];
export const REMOVAL_COLOR: Record<RemovalState, string> = { Found: 'var(--sev-high)', Requested: 'var(--sev-medium)', Removed: 'var(--good)', 'Re-listed': 'var(--bad)' };

export const THREAT_LEVELS = ['Low', 'Moderate', 'Elevated', 'High'] as const;
export type ThreatLevel = (typeof THREAT_LEVELS)[number];
export const THREAT_COLOR: Record<ThreatLevel, string> = { Low: 'var(--good)', Moderate: 'var(--sev-low)', Elevated: 'var(--sev-medium)', High: 'var(--bad)' };

/* ---------------- Types ---------------- */
export interface VipFinding {
  id: string;
  personId: string;
  kind: FindingKind;
  title: string;
  detail: string;
  source: string;
  sev: Severity;
  foundDays: number;
  status: FindingStatus;
}
export interface ProtectedPerson {
  id: string;
  name: string;
  role: string;
  tier: VipTier;
  tenantId: string;
  score: number;
  /** 12 weekly scores, oldest first. */
  trend: number[];
  delta: number;
  creds: number;
  home: boolean;
  phone: boolean;
  family: number;
  brokers: number;
  impersonations: number;
  lookalikes: number;
  deepfake: 'High' | 'Medium' | 'Low';
  publicProfile: 'High' | 'Medium' | 'Low';
  enrolledDays: number;
  family_enrolled: boolean;
  findings: VipFinding[];
}
export interface ImpItem {
  id: string;
  kind: ImpKind;
  personId: string;
  personName: string;
  title: string;
  channel: string;
  detail: string;
  sev: Severity;
  foundMin: number;
  status: ImpStatus;
  /** Followers for a profile, recipients for a mail campaign, views for a video. */
  reach: number;
  reachLabel: string;
  amount?: number;
  incidentId?: string;
  source: string;
  confidence: number;
}
export interface BrokerRecord {
  id: string;
  personId: string;
  personName: string;
  broker: string;
  cat: BrokerCat;
  exposes: string[];
  state: RemovalState;
  foundDays: number;
  requestedDays?: number;
  /** Days from request to removal (removed records only). */
  daysToRemove?: number;
  legal: string;
}
export interface Trip {
  id: string;
  personId: string;
  personName: string;
  destination: string;
  country: string;
  purpose: string;
  departsIn: number;
  nights: number;
  threat: ThreatLevel;
  publicItinerary: boolean;
  advisories: string[];
  controls: { label: string; done: boolean }[];
}

/* ---------------- Names & roles ---------------- */
const NAMES: Record<CustomerId, { first: string[]; last: string[] }> = {
  maritime: { first: ['Willem', 'Annelies', 'Jeroen', 'Margriet', 'Koen', 'Lotte', 'Bram', 'Saskia', 'Siti', 'Rafael', 'Mariana', 'Nadia', 'Olav', 'Henrike'], last: ['de Boer', 'Mulder', 'Smit', 'Verbeek', 'Dubois', 'Maes', 'Wouters', 'Abdullah', 'Oliveira', 'Lindqvist', 'Hartog', 'van Leeuwen'] },
  finserv: { first: ['Alistair', 'Fiona', 'Rupert', 'Harriet', 'Nikhil', 'Camilla', 'Edward', 'Priya', 'Laurent', 'Grace', 'Marcus', 'Imogen', 'Thomas', 'Serena'], last: ['Whitmore', 'Pemberton', 'Shah', 'Hargreaves', 'Bellamy', 'Okoro', 'Fairbairn', 'Dumont', 'Chen', 'Kingsley', 'Ashdown', 'Montague'] },
  media: { first: ['Tyler', 'Brooke', 'Marcus', 'Sienna', 'Darius', 'Harper', 'Elliot', 'Naomi', 'Rafael', 'Quinn', 'Zoe', 'Malcolm', 'Ava', 'Jasper'], last: ['Lane', 'Monroe', 'Vasquez', 'Kincaid', 'Holloway', 'Reyes', 'Sterling', 'Park', 'Fontaine', 'Ward', 'Calloway', 'Brooks'] },
  healthcare: { first: ['Robert', 'Linda', 'Kevin', 'Patricia', 'Anil', 'Monica', 'Gregory', 'Denise', 'Carlos', 'Rebecca', 'Steven', 'Lauren', 'Howard', 'Janet'], last: ['Halvorsen', 'McAllister', 'Patel', 'Brennan', 'Washington', 'Kowalczyk', 'Ramirez', 'Sutton', 'Gallagher', 'Nguyen', 'Sorensen', 'Price'] },
  automotive: { first: ['Matthias', 'Claudia', 'Stefan', 'Anja', 'Tobias', 'Birgit', 'László', 'Eszter', 'Alejandro', 'Sabine', 'Jürgen', 'Mónica', 'Florian', 'Ute'], last: ['Krämer', 'Weber', 'Neumann', 'Schulte', 'Kovács', 'Brandt', 'Hartmann', 'Szabó', 'Herrera', 'Lehmann', 'Fischer', 'Zimmermann'] },
};
const EXTRA_ROLES: Record<CustomerId, [string, VipTier][]> = {
  maritime: [['Chair of the Supervisory Board', 'Board'], ['Chief Operating Officer', 'Executive'], ['General Counsel', 'Executive'], ['Non-executive director', 'Board'], ['Chief Commercial Officer', 'Executive'], ['Designated Person Ashore', 'Key person'], ['Chief Technology Officer', 'Executive'], ['Head of Investor Relations', 'Key person'], ['Non-executive director', 'Board'], ['Group Treasurer', 'Key person'], ['Head of M&A', 'Key person'], ['Master, Halcyon Aurora', 'Key person'], ['Non-executive director', 'Board']],
  finserv: [['Chair', 'Board'], ['Senior Independent Director', 'Board'], ['Chief Risk Officer', 'Executive'], ['Group Treasurer', 'Executive'], ['Chief Operating Officer', 'Executive'], ['General Counsel', 'Executive'], ['Head of Payments Operations', 'Key person'], ['Head of Investor Relations', 'Key person'], ['Non-executive director', 'Board'], ['Non-executive director', 'Board'], ['Head of FX Trading', 'Key person'], ['Chief Data Officer', 'Executive'], ['Head of Financial Crime', 'Key person'], ['Non-executive director', 'Board'], ['Chief People Officer', 'Executive'], ['Head of Corporate Banking', 'Key person'], ['Chief Technology Officer', 'Executive'], ['Non-executive director', 'Board'], ['Head of SWIFT Operations', 'Key person'], ['Head of Wealth Advisory, Singapore', 'Key person'], ['Company Secretary', 'Key person'], ['Head of Treasury Operations', 'Key person'], ['Non-executive director', 'Board'], ['Chief Audit Executive', 'Executive']],
  media: [['Chair', 'Board'], ['Chief Content Officer', 'Executive'], ['Showrunner (talent services)', 'Key person'], ['Director (talent services)', 'Key person'], ['Head of Distribution', 'Executive'], ['Chief Financial Officer', 'Executive'], ['General Counsel', 'Executive'], ['Head of KestrelPlay', 'Executive'], ['Lead Actor (talent services)', 'Key person'], ['Head of Live Sports', 'Key person'], ['Non-executive director', 'Board'], ['Head of Publicity', 'Key person'], ['Composer (talent services)', 'Key person'], ['Head of Marketing', 'Executive'], ['Non-executive director', 'Board'], ['Producer (talent services)', 'Key person']],
  healthcare: [['Board Chair', 'Board'], ['Chief Operating Officer', 'Executive'], ['Chief Medical Officer', 'Executive'], ['General Counsel', 'Executive'], ['Chief Research Officer', 'Executive'], ['Trustee', 'Board'], ['Chief Compliance & Privacy Officer', 'Executive'], ['Chief of Surgery', 'Key person'], ['Trustee', 'Board'], ['Chief of Emergency Medicine', 'Key person'], ['VP Revenue Cycle', 'Key person'], ['Foundation President', 'Key person'], ['Trustee', 'Board'], ['Principal Investigator, genomics', 'Key person']],
  automotive: [['Chair of the Supervisory Board', 'Board'], ['Board Member, Production', 'Executive'], ['Board Member, R&D', 'Executive'], ['Board Member, Sales', 'Executive'], ['Head of Battery Plant', 'Key person'], ['General Counsel', 'Executive'], ['Works Council Chair', 'Board'], ['Head of Motorsport', 'Key person'], ['Supervisory Board Member', 'Board'], ['Head of Connected Vehicle', 'Key person'], ['Head of Procurement', 'Executive'], ['Plant Director, Puebla', 'Key person'], ['Supervisory Board Member', 'Board'], ['Head of Investor Relations', 'Key person'], ['Chief Engineer, EV platform', 'Key person'], ['Plant Director, Győr', 'Key person'], ['Head of Dealer Network', 'Key person'], ['Supervisory Board Member', 'Board'], ['Chief People Officer', 'Executive'], ['Head of Treasury', 'Key person']],
};

/** Region drives data-broker volume: US brokers list far more, EU removals are faster (GDPR Art. 17). */
const BROKER_PROFILE: Record<CustomerId, { min: number; max: number; days: [number, number]; legal: string }> = {
  maritime: { min: 0, max: 4, days: [6, 21], legal: 'GDPR Art. 17 erasure request' },
  finserv: { min: 1, max: 7, days: [8, 28], legal: 'UK GDPR Art. 17 erasure request' },
  media: { min: 6, max: 18, days: [14, 45], legal: 'CCPA / CPRA deletion request' },
  healthcare: { min: 4, max: 14, days: [12, 40], legal: 'State privacy law deletion request' },
  automotive: { min: 0, max: 5, days: [5, 20], legal: 'GDPR Art. 17 erasure request' },
};

function tierOf(p: Person, c: CustomerProfile): VipTier {
  if (p === c.people.board) return 'Board';
  if (p === c.people.ciso) return 'Security';
  if (/CEO|CFO|Chief|President|Head of Design/i.test(p.role)) return 'Executive';
  return 'Key person';
}
function tenantFor(role: string, c: CustomerProfile, r: Rng): string {
  for (const t of c.tenants) {
    const w = t.short.split(/[\s&,]+/)[0];
    if (w.length > 3 && role.includes(w)) return t.id;
  }
  if (/Group|Chair|Board|Supervisory|Trustee|Non-executive|Senior Independent|General Counsel|Investor|Treasurer|Chief/i.test(role)) return c.tenants[0].id;
  return r.pick(c.tenants).id;
}
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(dr|sir|capt|chief eng)\.?\s+/i, '').replace(/[^a-z]+/g, '');

/* ---------------- Findings ---------------- */
const CRED_TITLES = ['Personal webmail credential in a breach compilation', 'Reused password on a retail site breach', 'Social media credential in a combo list', 'Corporate address used on a hobby forum breach', 'Personal cloud storage credential in a stealer log', 'Fitness app account in a breach compilation'];
const FAMILY_TITLES = ['Spouse’s public profile reveals the family’s home town', 'Child’s school visible in public photos', 'Family holiday posted in real time by a relative', 'Relative’s public profile lists the executive’s mobile', 'Pet and home exterior visible in public photos', 'Partner’s professional profile links both employers'];

function makeFindings(c: CustomerProfile, p: { id: string; name: string; creds: number; home: boolean; phone: boolean; family: number; brokers: number; impersonations: number; lookalikes: number }, r: Rng): VipFinding[] {
  const out: VipFinding[] = [];
  let n = 0;
  const add = (kind: FindingKind, title: string, detail: string, source: string, sev: Severity) => {
    const status = r.weighted<FindingStatus>([['Open', 4], ['Removal requested', 3], ['Resolved', 3], ['Monitoring', 2]]);
    out.push({ id: `${p.id}-F${++n}`, personId: p.id, kind, title, detail, source, sev, foundDays: r.int(0, 120), status });
  };
  for (let i = 0; i < p.creds; i++) {
    const t = r.pick(CRED_TITLES);
    add('Leaked credential', t, `Password masked; HexaInt checked it against ${c.short} identity providers: ${r.chance(0.2) ? 'matches a pattern used on a corporate account, reset enforced' : 'no corporate reuse detected'}.`, r.pick(['Breach compilation', 'Infostealer log', 'Paste site', 'Combo list']), r.chance(0.25) ? 'high' : 'medium');
  }
  if (p.home) add('Home address', 'Home address published on public sites', 'Residential address appears on people-search and property-record aggregators. Summary only; the address is not stored in HexaView.', 'Data-broker sweep', 'high');
  if (p.phone) add('Personal phone', 'Personal mobile number exposed', 'Personal mobile appears in a marketing data set and a reverse-lookup site; raises vishing and SIM-swap risk.', 'Data-broker sweep', 'high');
  for (let i = 0; i < p.family; i++) add('Family & social', r.pick(FAMILY_TITLES), 'Advisory: brief the family on privacy settings; HexaInt does not monitor family accounts without consent.', 'Open-source social monitoring', 'medium');
  for (let i = 0; i < Math.min(p.brokers, 3); i++) add('Data-broker listing', `Profile on ${r.pick(BROKER_CATS).toLowerCase()}`, 'Name, age range, relatives and approximate location listed. Removal tracked under Data-broker & personal exposure.', 'Data-broker sweep', 'low');
  for (let i = 0; i < p.impersonations; i++) add('Impersonating account', `Impersonating profile on ${r.pick(['LinkedIn', 'X', 'Instagram', 'Facebook', 'WhatsApp', 'Telegram'])}`, 'Uses the executive’s photo and title; tracked under Impersonation & deepfakes.', 'HexaInt social monitoring', 'high');
  for (let i = 0; i < p.lookalikes; i++) add('Lookalike domain', `Personal-name domain registered: ${slug(p.name).slice(0, 10)}-${c.vocab.lookalikeBase.slice(0, 8)}.${r.pick(['com', 'net', 'co', 'info'])}`, 'Registered recently with mail (MX) records; could be used to send lures in the executive’s name.', 'CT logs · zone-file monitoring', 'high');
  return out;
}

/* ---------------- Protected people ---------------- */
function roster(c: CustomerProfile): ProtectedPerson[] {
  const r = rng(`vip-roster-${c.id}`);
  const base = vipExposure(c);
  const named: Person[] = [c.people.board, ...c.people.staff.filter((p) => p.vip), c.people.ciso];
  const total = headlines(c, 'all').int.vipsMonitored;
  const extra = EXTRA_ROLES[c.id];
  const pool = NAMES[c.id];
  const used = new Set(named.map((p) => p.name));
  const people: { name: string; role: string; tier: VipTier; seed?: (typeof base)[number] }[] = named.map((p, i) => ({ name: p.name, role: p.role, tier: tierOf(p, c), seed: base[i] }));
  let k = 0;
  while (people.length < total && k < extra.length * 3) {
    const [role, tier] = extra[k % extra.length];
    k++;
    let name = `${r.pick(pool.first)} ${r.pick(pool.last)}`;
    let guard = 0;
    while (used.has(name) && guard++ < 20) name = `${r.pick(pool.first)} ${r.pick(pool.last)}`;
    used.add(name);
    people.push({ name, role, tier });
  }
  const bp = BROKER_PROFILE[c.id];
  return people.map((p, i) => {
    const id = `VIP-${String(i + 1).padStart(2, '0')}`;
    const s = p.seed;
    const creds = s ? s.personalBreaches : r.int(0, 8);
    const phone = s ? s.phoneExposed : r.chance(0.45);
    const home = s ? s.homeAddress : r.chance(0.25);
    const impersonations = s ? s.impersonationAccounts : r.weighted([[0, 5], [1, 3], [2, 1]] as const);
    const deepfake = s ? s.deepfakeRisk : r.weighted<'High' | 'Medium' | 'Low'>([['High', 1], ['Medium', 3], ['Low', 5]]);
    const family = r.int(0, p.tier === 'Board' || p.tier === 'Executive' ? 3 : 2);
    const brokers = r.int(bp.min, bp.max) + (home ? 2 : 0);
    const lookalikes = r.chance(p.tier === 'Board' ? 0.5 : 0.18) ? r.int(1, 2) : 0;
    const publicProfile = p.tier === 'Board' || /Actor|Showrunner|Director \(talent|Chair/.test(p.role) ? 'High' : p.tier === 'Executive' ? 'Medium' : 'Low';
    const score = s ? s.riskScore : Math.min(96, 22 + creds * 4 + (phone ? 10 : 0) + (home ? 12 : 0) + impersonations * 6 + (deepfake === 'High' ? 14 : deepfake === 'Medium' ? 7 : 0) + family * 2 + Math.min(10, brokers));
    const delta = r.int(-9, 7);
    const trend = r.series(11, score - delta, 3, delta / 11, 5, 99).map((v) => Math.round(v));
    trend.push(score);
    const tenantId = tenantFor(p.role, c, r);
    const core = { id, name: p.name, creds, home, phone, family, brokers, impersonations, lookalikes };
    return {
      ...core,
      role: p.role,
      tier: p.tier,
      tenantId,
      score,
      trend,
      delta,
      deepfake,
      publicProfile,
      enrolledDays: r.int(40, 700),
      family_enrolled: r.chance(0.4),
      findings: makeFindings(c, core, r),
    } satisfies ProtectedPerson;
  });
}

/** Protected people in scope, anchored to the HexaInt `vipsMonitored` headline. */
export function protectedPeople(c: CustomerProfile, tenantId: string): ProtectedPerson[] {
  const all = roster(c);
  if (tenantId === 'all') return all.sort((a, b) => b.score - a.score);
  const n = headlines(c, tenantId).int.vipsMonitored;
  const group = c.tenants[0].id;
  const rank = (p: ProtectedPerson) => (p.tenantId === tenantId ? 0 : p.tenantId === group && (p.tier === 'Board' || p.tier === 'Security' || p.tier === 'Executive') ? 1 : 2);
  return all
    .slice()
    .sort((a, b) => rank(a) - rank(b) || b.score - a.score)
    .slice(0, n)
    .sort((a, b) => b.score - a.score);
}

export function scoreBand(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Critical', color: 'var(--sev-critical)' };
  if (score >= 60) return { label: 'High', color: 'var(--sev-high)' };
  if (score >= 40) return { label: 'Moderate', color: 'var(--sev-medium)' };
  return { label: 'Low', color: 'var(--good)' };
}

/* ---------------- Impersonation & deepfakes ---------------- */
const PLATFORMS = ['LinkedIn', 'X', 'Instagram', 'Facebook', 'TikTok'];
const FRAUD_LINE: Record<CustomerId, string[]> = {
  maritime: ['urgent change of bank details for a bunker supplier', 'release fee for a container held at customs', 'confidential acquisition deposit for a terminal concession', 'advance payment to a new crewing agency'],
  finserv: ['same-day CHAPS payment for a confidential acquisition', 'change of bank details for a market-data vendor', 'urgent FX settlement to a new counterparty', 'gift-card purchase for a client event'],
  media: ['talent fee to a new agency account', 'location deposit wired before the shoot', 'payment to a festival screening partner', 'change of bank details for a VFX vendor'],
  healthcare: ['change of direct-deposit details for a physician', 'urgent wire to a medical equipment supplier', 'grant payment to a research partner', 'payment to a locum staffing agency'],
  automotive: ['change of bank details for a Tier 1 supplier', 'urgent tooling payment for a pre-launch model', 'confidential deposit for a battery-materials deal', 'dealer incentive payout to a new account'],
};
const VOICE_LINE: Record<CustomerId, string> = {
  maritime: 'Cloned-voice call to a terminal finance clerk asking to release a held payment',
  finserv: 'Cloned-voice call to Treasury Operations requesting a same-day transfer',
  media: 'Cloned-voice voicemail to a production accountant approving a talent fee',
  healthcare: 'Cloned-voice call to the revenue-cycle team requesting a vendor wire',
  automotive: 'Cloned-voice call to a plant controller requesting an urgent supplier payment',
};
const DEEPFAKE_LINE: Record<CustomerId, string> = {
  maritime: 'Synthetic video of the CEO “announcing” a terminal strike settlement shared in a crypto promotion',
  finserv: 'Synthetic video of the Group Chief Executive endorsing an investment scheme',
  media: 'Synthetic clip of a lead actor promoting a pirated streaming site',
  healthcare: 'Synthetic video of the CEO endorsing an unapproved supplement',
  automotive: 'Synthetic video of the Chairman “unveiling” a pre-launch model in a giveaway scam',
};

export function impersonations(c: CustomerProfile, tenantId: string): ImpItem[] {
  const ppl = protectedPeople(c, tenantId);
  const r = rng(`vip-imp-${c.id}-${tenantId}`);
  const email = c.connectors.find((k) => k.category === 'Email' && k.vendor !== 'KnowBe4');
  const emailName = email ? `${email.vendor} ${email.product}` : 'Email gateway';
  const inc = incidents(c, tenantId, 90).filter((i) => i.techniques.some((t) => t === 'T1657' || t.startsWith('T1566') || t === 'T1621' || t === 'T1098'));
  const out: ImpItem[] = [];
  let n = 0;
  const id = () => `IMP-${String(++n).padStart(3, '0')}`;
  const top = ppl.filter((p) => p.tier !== 'Security').slice(0, 6);
  const cfo = ppl.find((p) => /CFO|Financial|Treasur/i.test(p.role)) ?? ppl[0];
  const ceo = ppl.find((p) => p.tier === 'Board') ?? ppl[0];

  for (const p of ppl) {
    for (let i = 0; i < p.impersonations; i++) {
      const plat = r.pick(PLATFORMS);
      out.push({
        id: id(), kind: 'Fake social profile', personId: p.id, personName: p.name, channel: plat,
        title: `Fake ${plat} profile using ${p.name}’s photo and title`,
        detail: `Profile created ${r.int(2, 40)} days ago; connecting with ${c.short} staff and suppliers and sending direct messages about ${r.pick(['investment opportunities', 'job offers', 'urgent favours', 'gift cards'])}.`,
        sev: r.chance(0.4) ? 'high' : 'medium', foundMin: r.int(60, 60 * 24 * 30),
        status: r.weighted<ImpStatus>([['New', 3], ['Takedown requested', 3], ['Taken down', 4], ['Monitoring', 1]]),
        reach: r.int(40, 2400), reachLabel: 'connections', source: 'HexaInt social monitoring', confidence: r.int(78, 99),
      });
    }
    if (p.lookalikes) {
      for (let i = 0; i < p.lookalikes; i++) out.push({
        id: id(), kind: 'Lookalike domain', personId: p.id, personName: p.name, channel: 'DNS',
        title: `${slug(p.name).slice(0, 10)}-${c.vocab.lookalikeBase.slice(0, 8)}.${r.pick(['com', 'net', 'co'])} registered with mail records`,
        detail: 'Personal-name lookalike registered through a privacy-protected registrar; MX records live, no web content yet. Typical precursor to executive-impersonation mail.',
        sev: 'high', foundMin: r.int(600, 60 * 24 * 20), status: r.weighted<ImpStatus>([['New', 2], ['Takedown requested', 3], ['Monitoring', 2]]),
        reach: 0, reachLabel: 'n/a', source: 'CT logs · zone-file monitoring', confidence: r.int(85, 99),
      });
    }
  }
  // Email spoofing and CEO fraud
  const nFraud = Math.max(2, Math.round(ppl.length / 4));
  for (let i = 0; i < nFraud; i++) {
    const who = i % 2 === 0 ? ceo : cfo;
    const link = inc.length ? inc[i % inc.length] : undefined;
    const intercepted = r.chance(0.7);
    out.push({
      id: id(), kind: 'CEO fraud / payment diversion', personId: who.id, personName: who.name, channel: 'Email',
      title: `Payment-diversion attempt in ${who.name}’s name: ${r.pick(FRAUD_LINE[c.id])}`,
      detail: `Display-name spoof from a free-mail account to ${r.int(1, 4)} finance staff. ${intercepted ? `Quarantined by ${emailName} before delivery.` : 'Delivered; recipient reported it with the report button and no payment was made.'}${link ? ` Correlated to HexaSOC incident ${link.id}.` : ''}`,
      sev: i === 0 ? 'critical' : 'high', foundMin: r.int(30, 60 * 24 * 25),
      status: intercepted ? 'Intercepted' : 'Monitoring', reach: r.int(1, 4), reachLabel: 'recipients',
      amount: r.int(4, 90) * 10000, incidentId: link?.id, source: emailName, confidence: r.int(90, 99),
    });
  }
  const nSpoof = r.int(2, 4);
  for (let i = 0; i < nSpoof; i++) {
    const who = r.pick(top);
    out.push({
      id: id(), kind: 'Email spoof', personId: who.id, personName: who.name, channel: 'Email',
      title: `Display-name spoof of ${who.name} to ${r.int(6, 80)} staff`,
      detail: `Sent from an external domain with ${who.name}’s display name; ${emailName} flagged the mismatch and applied an external-sender banner. DMARC on ${c.domain} is at reject, so exact-domain spoofing failed.`,
      sev: 'medium', foundMin: r.int(120, 60 * 24 * 28), status: r.weighted<ImpStatus>([['Intercepted', 3], ['Monitoring', 1]]),
      reach: r.int(6, 80), reachLabel: 'recipients', source: emailName, confidence: r.int(88, 99),
    });
  }
  // Voice and video
  const voiceTarget = ppl.find((p) => p.deepfake === 'High') ?? ceo;
  out.push({
    id: id(), kind: 'Voice clone', personId: voiceTarget.id, personName: voiceTarget.name, channel: 'Phone',
    title: `${VOICE_LINE[c.id]} (voice of ${voiceTarget.name})`,
    detail: 'Caller refused a call-back to the directory number; the employee followed the call-back procedure and reported it. Public keynote audio is the likely training source.',
    sev: 'high', foundMin: r.int(60 * 24 * 2, 60 * 24 * 21), status: 'Monitoring', reach: 1, reachLabel: 'call', incidentId: inc[0]?.id, source: 'Employee report · HexaSOC', confidence: r.int(70, 88),
  });
  out.push({
    id: id(), kind: 'Deepfake video', personId: ceo.id, personName: ceo.name, channel: r.pick(['YouTube', 'TikTok', 'X']),
    title: DEEPFAKE_LINE[c.id],
    detail: 'Synthetic video detected by HexaInt media monitoring; lip-sync artefacts and a cloned voice. Platform notified under its synthetic-media policy.',
    sev: 'high', foundMin: r.int(60 * 6, 60 * 24 * 12), status: r.pick<ImpStatus>(['Takedown requested', 'New']), reach: r.int(4000, 180000), reachLabel: 'views', source: 'HexaInt media monitoring', confidence: r.int(82, 97),
  });
  if (ppl.length > 6) out.push({
    id: id(), kind: 'Deepfake video', personId: voiceTarget.id, personName: voiceTarget.name, channel: 'Video call',
    title: `Video-call invite from a synthetic “${voiceTarget.name}” to the finance team`,
    detail: 'Invite to an external meeting platform; the account and room were newly created. Blocked by policy for external meeting links to finance staff.',
    sev: 'critical', foundMin: r.int(60 * 24, 60 * 24 * 9), status: 'Intercepted', reach: r.int(2, 6), reachLabel: 'invitees', source: emailName, confidence: r.int(75, 92),
  });
  const nMsg = r.int(1, 3);
  for (let i = 0; i < nMsg; i++) {
    const who = r.pick(top);
    out.push({
      id: id(), kind: 'Messaging-app impersonation', personId: who.id, personName: who.name, channel: r.pick(['WhatsApp', 'Signal', 'Telegram']),
      title: `Messages from a new number claiming to be ${who.name}`,
      detail: `“New phone, can you help with something confidential?” sent to ${r.int(3, 18)} staff whose numbers appear on data-broker sites.`,
      sev: 'medium', foundMin: r.int(60, 60 * 24 * 14), status: r.weighted<ImpStatus>([['New', 2], ['Monitoring', 2], ['Takedown requested', 1]]),
      reach: r.int(3, 18), reachLabel: 'recipients', source: 'Employee reports', confidence: r.int(70, 95),
    });
  }
  return out.sort((a, b) => a.foundMin - b.foundMin);
}

/** Weekly detections by kind for the impersonation trend chart (12 weeks). */
export function impTrend(c: CustomerProfile, tenantId: string): { labels: string[]; series: Record<ImpKind, number[]> } {
  const r = rng(`vip-imptrend-${c.id}-${tenantId}`);
  const labels = Array.from({ length: 12 }, (_, i) => (i === 11 ? 'This wk' : `W-${11 - i}`));
  const base: Record<ImpKind, number> = { 'Fake social profile': 2, 'Voice clone': 0.3, 'Deepfake video': 0.3, 'Lookalike domain': 0.8, 'Email spoof': 1.5, 'CEO fraud / payment diversion': 1, 'Messaging-app impersonation': 0.8 };
  const series = Object.fromEntries(IMP_KINDS.map((k) => [k, Array.from({ length: 12 }, (_, i) => Math.max(0, Math.round(base[k] * 0.45 * (0.6 + i / 14) + (r() - 0.45) * 1.4)))])) as Record<ImpKind, number[]>;
  return { labels, series };
}

/* ---------------- Data brokers ---------------- */
const BROKER_LETTERS = 'ABCDEFGHJKLMNPRS';
const BROKER_SHORT: Record<BrokerCat, string> = {
  'People-search sites': 'People-search site', 'Background-check services': 'Background-check service', 'Marketing data brokers': 'Marketing broker',
  'Property & public-records aggregators': 'Records aggregator', 'Reverse phone lookup': 'Reverse-lookup site', 'Social profile aggregators': 'Profile aggregator',
};
const EXPOSES: Record<BrokerCat, string[]> = {
  'People-search sites': ['Name', 'Age range', 'Relatives', 'City'],
  'Background-check services': ['Name', 'Address history', 'Relatives'],
  'Marketing data brokers': ['Personal email', 'Mobile', 'Household income band'],
  'Property & public-records aggregators': ['Home address', 'Property value'],
  'Reverse phone lookup': ['Mobile', 'Name'],
  'Social profile aggregators': ['Social handles', 'Photos', 'Employer'],
};
export function brokerRecords(c: CustomerProfile, tenantId: string): BrokerRecord[] {
  const ppl = protectedPeople(c, tenantId);
  const r = rng(`vip-brokers-${c.id}-${tenantId}`);
  const bp = BROKER_PROFILE[c.id];
  const out: BrokerRecord[] = [];
  let n = 0;
  for (const p of ppl) {
    for (let i = 0; i < p.brokers; i++) {
      const cat = r.weighted<BrokerCat>([['People-search sites', 5], ['Background-check services', 3], ['Marketing data brokers', 3], ['Property & public-records aggregators', p.home ? 3 : 1], ['Reverse phone lookup', p.phone ? 3 : 1], ['Social profile aggregators', 2]]);
      const state = r.weighted<RemovalState>([['Found', 2], ['Requested', 3], ['Removed', 6], ['Re-listed', 1]]);
      const foundDays = r.int(10, 200);
      const requestedDays = state === 'Found' ? undefined : r.int(1, Math.max(2, foundDays - 2));
      const daysToRemove = state === 'Removed' || state === 'Re-listed' ? r.int(bp.days[0], bp.days[1]) : undefined;
      out.push({
        id: `BRK-${String(++n).padStart(3, '0')}`, personId: p.id, personName: p.name,
        broker: `${BROKER_SHORT[cat]} ${BROKER_LETTERS[r.int(0, BROKER_LETTERS.length - 1)]}${r.int(1, 9)}`,
        cat, exposes: EXPOSES[cat], state, foundDays, requestedDays, daysToRemove, legal: bp.legal,
      });
    }
  }
  return out;
}

/** Monthly removals completed vs new listings found (6 months). */
export function removalTrend(c: CustomerProfile, tenantId: string, recs: BrokerRecord[]): { labels: string[]; found: number[]; removed: number[] } {
  const r = rng(`vip-remtrend-${c.id}-${tenantId}`);
  const labels = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const total = Math.max(6, recs.length);
  const found = labels.map((_, i) => Math.max(0, Math.round((total / 6) * (i === 0 ? 1.8 : 1 - i * 0.08) + (r() - 0.5) * 3)));
  const removed = labels.map((_, i) => Math.max(0, Math.round((total / 6) * (0.4 + i * 0.16) + (r() - 0.5) * 3)));
  return { labels, found, removed };
}

/* ---------------- Travel & events ---------------- */
const TRIPS: Record<CustomerId, { dest: string; country: string; purpose: string; threat: ThreatLevel; pub: boolean }[]> = {
  maritime: [
    { dest: 'Singapore', country: 'SG', purpose: 'Singapore Maritime Week · keynote', threat: 'Moderate', pub: true },
    { dest: 'Athens', country: 'GR', purpose: 'Posidonia exhibition', threat: 'Low', pub: true },
    { dest: 'Port Klang', country: 'MY', purpose: 'Straits Gateway terminal visit', threat: 'Moderate', pub: false },
    { dest: 'Shanghai', country: 'CN', purpose: 'Shipyard newbuild inspection', threat: 'High', pub: false },
    { dest: 'Santos', country: 'BR', purpose: 'Concession review with port authority', threat: 'Elevated', pub: false },
  ],
  finserv: [
    { dest: 'Davos', country: 'CH', purpose: 'World Economic Forum panel', threat: 'Elevated', pub: true },
    { dest: 'New York', country: 'US', purpose: 'Investor roadshow', threat: 'Moderate', pub: true },
    { dest: 'Singapore', country: 'SG', purpose: 'FinTech Festival · private wealth clients', threat: 'Moderate', pub: true },
    { dest: 'Dubai', country: 'AE', purpose: 'Sovereign fund meetings', threat: 'Elevated', pub: false },
    { dest: 'Hong Kong', country: 'HK', purpose: 'Regional board meeting', threat: 'High', pub: false },
    { dest: 'Luxembourg', country: 'LU', purpose: 'Aldersgate Europe board', threat: 'Low', pub: false },
  ],
  media: [
    { dest: 'Cannes', country: 'FR', purpose: 'Film festival premiere', threat: 'Elevated', pub: true },
    { dest: 'Toronto', country: 'CA', purpose: 'TIFF screening & press junket', threat: 'Moderate', pub: true },
    { dest: 'San Diego', country: 'US', purpose: 'Comic-Con panel', threat: 'Elevated', pub: true },
    { dest: 'Budapest', country: 'HU', purpose: 'Location shoot (unannounced title)', threat: 'Moderate', pub: false },
    { dest: 'London', country: 'GB', purpose: 'UK premiere, Leicester Square', threat: 'Elevated', pub: true },
  ],
  healthcare: [
    { dest: 'Las Vegas', country: 'US', purpose: 'HIMSS Global conference', threat: 'Moderate', pub: true },
    { dest: 'Verona, WI', country: 'US', purpose: 'Epic user group meeting', threat: 'Low', pub: false },
    { dest: 'Washington, DC', country: 'US', purpose: 'AHA leadership summit · Hill meetings', threat: 'Moderate', pub: true },
    { dest: 'Geneva', country: 'CH', purpose: 'Genomics research consortium', threat: 'Low', pub: false },
    { dest: 'Guatemala City', country: 'GT', purpose: 'Medical mission partnership', threat: 'Elevated', pub: false },
  ],
  automotive: [
    { dest: 'Shanghai', country: 'CN', purpose: 'Auto Shanghai · pre-launch reveal', threat: 'High', pub: true },
    { dest: 'Las Vegas', country: 'US', purpose: 'CES keynote', threat: 'Moderate', pub: true },
    { dest: 'Puebla', country: 'MX', purpose: 'Plant Puebla visit', threat: 'Elevated', pub: false },
    { dest: 'Győr', country: 'HU', purpose: 'E-drive supplier summit', threat: 'Low', pub: false },
    { dest: 'Seoul', country: 'KR', purpose: 'Battery-cell partner negotiations', threat: 'Elevated', pub: false },
    { dest: 'Munich', country: 'DE', purpose: 'IAA Mobility press day', threat: 'Moderate', pub: true },
  ],
};
const ADVISORY: Record<ThreatLevel, string[]> = {
  Low: ['Standard travel profile; corporate device permitted with full-disk encryption', 'Use the corporate VPN on hotel and venue Wi-Fi'],
  Moderate: ['Avoid venue and hotel Wi-Fi; use the travel eSIM hotspot', 'Do not plug into public charging points', 'Brief the executive assistant: no itinerary detail on social media'],
  Elevated: ['Carry a loaner laptop and phone; leave the primary devices at home', 'Device may be inspected at the border: carry only data needed for the trip', 'Expect targeted phishing that references the event; verify any change of plan by call-back'],
  High: ['Loaner devices only, wiped on return and not reconnected before inspection', 'No access to crown-jewel systems from abroad; conditional access restricted to email for the trip', 'Assume hotel rooms and business centres are not private; no sensitive discussions', 'Pre-brief with the CISO; HexaSOC watches the account for the trip duration'],
};
export function trips(c: CustomerProfile, tenantId: string): Trip[] {
  const ppl = protectedPeople(c, tenantId).filter((p) => p.tier !== 'Security');
  const r = rng(`vip-trips-${c.id}-${tenantId}`);
  const list = TRIPS[c.id];
  const n = Math.min(list.length, Math.max(2, Math.round(ppl.length / 3)));
  return r.pickN(list, n).map((t, i) => {
    const p = ppl[i % ppl.length];
    const ctl = [
      { label: 'Pre-travel briefing', done: r.chance(0.6) },
      { label: t.threat === 'High' || t.threat === 'Elevated' ? 'Loaner devices issued' : 'Device encryption verified', done: r.chance(0.5) },
      { label: 'Travel eSIM / VPN profile', done: r.chance(0.7) },
      { label: 'Account watch during travel (HexaSOC)', done: r.chance(0.4) },
    ];
    if (t.pub) ctl.push({ label: 'Public itinerary scrubbed', done: r.chance(0.3) });
    return {
      id: `TRV-${String(i + 1).padStart(2, '0')}`, personId: p.id, personName: p.name, destination: t.dest, country: t.country, purpose: t.purpose,
      departsIn: r.int(2, 55), nights: r.int(2, 7), threat: t.threat, publicItinerary: t.pub,
      advisories: [...ADVISORY[t.threat], ...(t.pub ? ['Event agenda names the executive publicly; expect lookalike event emails and fake social profiles around the dates'] : [])],
      controls: ctl,
    };
  }).sort((a, b) => a.departsIn - b.departsIn);
}
