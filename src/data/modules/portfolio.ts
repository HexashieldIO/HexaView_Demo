// Portfolio & M&A data for the Partner Console. A portfolio lens over many
// companies, used by private-equity sponsors, insurers, groups and MSSPs:
// the five demo customers (full tenants) plus lighter-weight portfolio
// companies, cyber due diligence on acquisition targets, a first-100-days
// integration plan and benchmarks. Partner-side, USD, seeded and stable.

import type { CustomerId } from '../types';
import { CUSTOMER_LIST } from '../customers';
import { headlines, resilienceIndex, riTrend, riDrivers } from '../core';
import { rng } from '../../lib/rng';

export const FX_TO_USD = { USD: 1, GBP: 1.27, EUR: 1.08 } as const;

/* =====================================================================
   Portfolio companies
   ===================================================================== */
export type PfStatus = 'healthy' | 'watch' | 'critical' | 'integrating';
export const PF_STATUS_COLOR: Record<PfStatus, string> = { healthy: 'var(--good)', watch: 'var(--sev-medium)', critical: 'var(--bad)', integrating: 'var(--m-matrix)' };
export const PF_STATUS_HEX: Record<PfStatus, string> = { healthy: '#22c55e', watch: '#f0a338', critical: '#f0466e', integrating: '#38bdf8' };
export const PF_STATUS_LABEL: Record<PfStatus, string> = { healthy: 'Healthy', watch: 'Watch', critical: 'Critical', integrating: 'Integrating' };

export const DIMENSIONS = ['Identity', 'Endpoint', 'Cloud', 'OT / IoT', 'Third parties', 'Recovery', 'Compliance'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export interface PortfolioCo {
  id: string;
  demoId?: CustomerId;
  name: string;
  short: string;
  initials: string;
  colour: string;
  sector: string;
  country: string;
  ownership: 'Platform' | 'Add-on' | 'Majority' | 'Minority' | 'Group subsidiary';
  holdingMonths: number;
  revenueM: number; // USD
  evM: number; // USD enterprise value
  insuredLimitM: number; // USD cyber limit
  employees: number;
  ri: number;
  trend: number[];
  delta: number;
  topRisk: string;
  insurability: number;
  openCritical: number;
  expectedLossM: number;
  frameworks: { short: string; pct: number }[];
  dims: Record<Dimension, number>;
  status: PfStatus;
  onHexaView: boolean;
  owner: string;
  /** Day of the 100-day plan for newly acquired companies. */
  day?: number;
}

const DEMO_META: Record<CustomerId, { ownership: PortfolioCo['ownership']; holdingMonths: number; multiple: number; owner: string }> = {
  maritime: { ownership: 'Platform', holdingMonths: 38, multiple: 1.7, owner: 'Grace Okafor' },
  finserv: { ownership: 'Minority', holdingMonths: 22, multiple: 2.3, owner: 'Grace Okafor' },
  media: { ownership: 'Majority', holdingMonths: 29, multiple: 2.1, owner: 'Daniel Moretti' },
  healthcare: { ownership: 'Platform', holdingMonths: 17, multiple: 1.4, owner: 'Grace Okafor' },
  automotive: { ownership: 'Minority', holdingMonths: 44, multiple: 0.62, owner: 'Daniel Moretti' },
};

const EXTRA: { name: string; short: string; colour: string; sector: string; country: string; ownership: PortfolioCo['ownership']; revenueM: number; employees: number; multiple: number; topRisk: string; frameworks: string[]; ri: number; status: PfStatus; ot: boolean; day?: number; holdingMonths: number }[] = [
  { name: 'Brindle Freight Forwarding', short: 'Brindle', colour: '#0e7490', sector: 'Logistics', country: 'NL', ownership: 'Add-on', revenueM: 420, employees: 1900, multiple: 1.1, topRisk: 'Shared admin accounts on the customs-declaration platform; no MFA for brokers', frameworks: ['ISO 27001', 'NIS2'], ri: 66, status: 'watch', ot: true, holdingMonths: 14 },
  { name: 'Calder Precision Components', short: 'Calder', colour: '#7c3aed', sector: 'Manufacturing', country: 'GB', ownership: 'Platform', revenueM: 310, employees: 1400, multiple: 1.3, topRisk: 'Flat plant network: engineering workstations reach CNC controllers directly', frameworks: ['Cyber Essentials+', 'IEC 62443'], ri: 61, status: 'critical', ot: true, holdingMonths: 26 },
  { name: 'Northgate Dental Partners', short: 'Northgate', colour: '#0891b2', sector: 'Healthcare', country: 'US', ownership: 'Platform', revenueM: 540, employees: 3600, multiple: 1.6, topRisk: '212 practice-management servers still on an end-of-life OS', frameworks: ['HIPAA', 'PCI DSS'], ri: 64, status: 'watch', ot: false, holdingMonths: 31 },
  { name: 'Silverline Payments', short: 'Silverline', colour: '#2563eb', sector: 'Fintech', country: 'IE', ownership: 'Majority', revenueM: 190, employees: 640, multiple: 6.5, topRisk: 'DORA register of information incomplete for 9 ICT providers', frameworks: ['DORA', 'PCI DSS', 'ISO 27001'], ri: 79, status: 'healthy', ot: false, holdingMonths: 19 },
  { name: 'Ardent Cold Storage', short: 'Ardent', colour: '#0f766e', sector: 'Food logistics', country: 'US', ownership: 'Add-on', revenueM: 260, employees: 1100, multiple: 1.2, topRisk: 'Refrigeration controllers reachable from the vendor VPN with default credentials', frameworks: ['NIST CSF', 'FSMA'], ri: 63, status: 'watch', ot: true, holdingMonths: 9 },
  { name: 'Fennick Software', short: 'Fennick', colour: '#9333ea', sector: 'Software (SaaS)', country: 'GB', ownership: 'Majority', revenueM: 85, employees: 420, multiple: 7.2, topRisk: 'Leaked CI/CD token in a public repository (rotated, scope under review)', frameworks: ['SOC 2', 'ISO 27001'], ri: 82, status: 'healthy', ot: false, holdingMonths: 33 },
  { name: 'Halberd Energy Services', short: 'Halberd', colour: '#b45309', sector: 'Energy services', country: 'NO', ownership: 'Platform', revenueM: 720, employees: 2800, multiple: 1.4, topRisk: 'Remote access to offshore control systems via a third-party jump host without session recording', frameworks: ['IEC 62443', 'NIS2', 'ISO 27001'], ri: 70, status: 'watch', ot: true, holdingMonths: 41 },
  { name: 'Marlowe Insurance Brokers', short: 'Marlowe', colour: '#be185d', sector: 'Insurance broking', country: 'GB', ownership: 'Add-on', revenueM: 140, employees: 900, multiple: 3.1, topRisk: 'Business email compromise attempts up 3x; DMARC still at p=none', frameworks: ['FCA SYSC', 'ISO 27001'], ri: 74, status: 'healthy', ot: false, holdingMonths: 12 },
  { name: 'Linden Marine Services', short: 'Linden', colour: '#1d4ed8', sector: 'Maritime services', country: 'GB', ownership: 'Add-on', revenueM: 180, employees: 760, multiple: 1.5, topRisk: 'No EDR on 40% of endpoints; vessel-agency mailboxes outside the group tenant', frameworks: ['ISO 27001'], ri: 58, status: 'integrating', ot: true, day: 41, holdingMonths: 1 },
  { name: 'Corvel Precision Castings', short: 'Corvel', colour: '#a16207', sector: 'Manufacturing', country: 'CZ', ownership: 'Add-on', revenueM: 230, employees: 1250, multiple: 1.1, topRisk: 'Unknown identity estate: three Active Directory forests, no PAM', frameworks: ['TISAX', 'ISO 9001'], ri: 52, status: 'integrating', ot: true, day: 12, holdingMonths: 0 },
];

function trendTo(r: ReturnType<typeof rng>, ri: number, spread: number): number[] {
  const out: number[] = [];
  let v = ri - spread;
  for (let k = 0; k < 11; k++) {
    v += (ri - v) / (11 - k) + (r() - 0.45) * 1.8;
    out.push(Math.round(v));
  }
  out.push(ri);
  return out;
}

function dimsFor(seed: string, ri: number, ot: boolean): Record<Dimension, number> {
  const r = rng(`pf-dims-${seed}`);
  const out = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    let v = ri + r.int(-14, 12);
    if (d === 'OT / IoT') v = ot ? ri - r.int(4, 16) : ri + r.int(-4, 6);
    out[d] = Math.max(28, Math.min(97, v));
  }
  return out;
}

let PF: PortfolioCo[] | null = null;
export function portfolio(): PortfolioCo[] {
  if (PF) return PF;
  const demo: PortfolioCo[] = CUSTOMER_LIST.map((c) => {
    const h = headlines(c);
    const ri = resilienceIndex(c).value;
    const trend = riTrend(c);
    const m = DEMO_META[c.id];
    const fx = FX_TO_USD[c.currency];
    const rev = c.revenueM * fx;
    const crit = h.soc.critical + h.strike.criticalFindings;
    const status: PfStatus = ri < 68 || crit >= 4 ? 'critical' : ri < 76 ? 'watch' : 'healthy';
    return {
      id: c.id, demoId: c.id, name: c.name, short: c.short, initials: c.initials, colour: c.colour, sector: c.sector, country: c.hq.split(', ').slice(-1)[0],
      ownership: m.ownership, holdingMonths: m.holdingMonths, revenueM: Math.round(rev), evM: Math.round(rev * m.multiple), insuredLimitM: Math.round(c.insurance.limitM * fx),
      employees: c.employees, ri, trend, delta: trend[11] - trend[8], topRisk: riDrivers(c)[0].text, insurability: h.insurance.insurability,
      openCritical: crit, expectedLossM: Math.round(h.insurance.expectedLossM * fx * 10) / 10,
      frameworks: c.frameworks.map((f) => ({ short: f.short, pct: f.documented })),
      dims: dimsFor(c.id, ri, c.tenants.some((t) => t.env.includes('ot'))), status, onHexaView: true, owner: m.owner,
    };
  });
  const extra: PortfolioCo[] = EXTRA.map((x) => {
    const r = rng(`pf-co-${x.short}`);
    const trend = trendTo(r, x.ri, x.status === 'integrating' ? r.int(5, 8) : r.int(3, 9));
    return {
      id: x.short.toLowerCase(), name: x.name, short: x.short, initials: x.name.split(' ').slice(0, 2).map((w) => w[0]).join(''), colour: x.colour, sector: x.sector, country: x.country,
      ownership: x.ownership, holdingMonths: x.holdingMonths, revenueM: x.revenueM, evM: Math.round(x.revenueM * x.multiple), insuredLimitM: Math.max(5, Math.round(x.revenueM / 25 / 5) * 5),
      employees: x.employees, ri: x.ri, trend, delta: trend[11] - trend[8], topRisk: x.topRisk,
      insurability: Math.max(40, Math.min(92, x.ri + r.int(-6, 6))), openCritical: x.ri < 60 ? r.int(4, 7) : x.ri < 70 ? r.int(1, 4) : r.int(0, 1),
      expectedLossM: Math.round(x.revenueM * (100 - x.ri) * 0.00055 * 10) / 10,
      frameworks: x.frameworks.map((f) => ({ short: f, pct: Math.max(30, Math.min(95, x.ri + r.int(-12, 10))) })),
      dims: dimsFor(x.short, x.ri, x.ot), status: x.status, onHexaView: x.status !== 'integrating' || (x.day ?? 0) > 30, owner: r.pick(['Grace Okafor', 'Daniel Moretti', 'Owen Price']), day: x.day,
    };
  });
  PF = [...demo, ...extra];
  return PF;
}

export function portfolioTotals(cos: PortfolioCo[]) {
  const ev = cos.reduce((s, c) => s + c.evM, 0);
  const wRi = Math.round(cos.reduce((s, c) => s + c.ri * c.evM, 0) / ev);
  return {
    count: cos.length,
    ev,
    wRi,
    below: cos.filter((c) => c.ri < 70).length,
    critical: cos.reduce((s, c) => s + c.openCritical, 0),
    insurability: Math.round(cos.reduce((s, c) => s + c.insurability, 0) / cos.length),
    expectedLossM: Math.round(cos.reduce((s, c) => s + c.expectedLossM, 0) * 10) / 10,
    integrating: cos.filter((c) => c.status === 'integrating').length,
    improving: cos.filter((c) => c.delta > 0).length,
  };
}

/* =====================================================================
   Benchmark metrics
   ===================================================================== */
export interface BenchMetric {
  id: string;
  label: string;
  unit: string;
  higherBetter: boolean;
  source: string;
}
export const BENCH_METRICS: BenchMetric[] = [
  { id: 'ri', label: 'Resilience Index', unit: '', higherBetter: true, source: 'HexaView Resilience Index' },
  { id: 'mttr', label: 'Mean time to respond', unit: 'h', higherBetter: false, source: 'HexaSOC case management' },
  { id: 'patch', label: 'Critical patch latency', unit: 'd', higherBetter: false, source: 'Vulnerability scanners via HexaCore' },
  { id: 'mfa', label: 'Phishing-resistant MFA', unit: '%', higherBetter: true, source: 'Identity provider via HexaCore' },
  { id: 'edr', label: 'EDR coverage', unit: '%', higherBetter: true, source: 'EDR / XDR via HexaCore' },
  { id: 'phish', label: 'Phishing click rate', unit: '%', higherBetter: false, source: 'Awareness platform' },
  { id: 'backup', label: 'Restores tested (90 d)', unit: '%', higherBetter: true, source: 'Backup platform' },
  { id: 'insurability', label: 'Insurability', unit: '', higherBetter: true, source: 'HexaView insurer model' },
];

export function benchValues(co: PortfolioCo): Record<string, number> {
  const r = rng(`pf-bench-${co.id}`);
  const q = co.ri / 100;
  const demo = co.demoId ? CUSTOMER_LIST.find((c) => c.id === co.demoId) : undefined;
  const h = demo ? headlines(demo) : null;
  return {
    ri: co.ri,
    mttr: h ? Math.round((h.soc.mttrMin / 60) * 10) / 10 : Math.round((9 - q * 7 + r.float(0, 2)) * 10) / 10,
    patch: h ? h.strike.meanTimeToRemediateDays : Math.round(48 - q * 36 + r.int(0, 8)),
    mfa: Math.min(99, Math.round(q * 100 - 8 + r.int(-6, 10))),
    edr: Math.min(100, Math.round(60 + q * 40 + r.int(-6, 4))),
    phish: Math.round((9 - q * 6 + r.float(0, 2)) * 10) / 10,
    backup: Math.min(100, Math.round(q * 100 - 12 + r.int(-8, 12))),
    insurability: co.insurability,
  };
}

/** Sector peer medians from the HexaShield benchmark (anonymised, opted-in tenants). */
export function peerMedian(sector: string): { n: number; v: Record<string, number> } {
  const r = rng(`pf-peer-${sector}`);
  const base = r.int(66, 74) / 100;
  return {
    n: r.int(18, 64),
    v: {
      ri: Math.round(base * 100), mttr: Math.round((9 - base * 7 + 0.9) * 10) / 10, patch: Math.round(48 - base * 36 + 4),
      mfa: Math.round(base * 100 - 6), edr: Math.round(60 + base * 40 - 1), phish: Math.round((9 - base * 6 + 1) * 10) / 10,
      backup: Math.round(base * 100 - 10), insurability: Math.round(base * 100 + 1),
    },
  };
}

/* =====================================================================
   Due diligence targets
   ===================================================================== */
export type DdCategory = 'Attack surface' | 'Leaked credentials' | 'Dark web' | 'Breach history' | 'Certifications' | 'Email & domain' | 'Questionnaire';
export const DD_CATEGORIES: DdCategory[] = ['Attack surface', 'Leaked credentials', 'Dark web', 'Breach history', 'Certifications', 'Email & domain', 'Questionnaire'];
export type DdSev = 'critical' | 'high' | 'medium' | 'low';

export interface DdFinding {
  id: string;
  category: DdCategory;
  sev: DdSev;
  title: string;
  detail: string;
  source: string;
  fixLowK: number;
  fixHighK: number;
  redFlag?: boolean;
}

export interface DdTarget {
  id: string;
  name: string;
  short: string;
  colour: string;
  sector: string;
  hq: string;
  employees: number;
  revenueM: number;
  dealValueM: number;
  stage: 'Teaser' | 'LOI signed' | 'Exclusivity' | 'Confirmatory DD';
  dealLead: string;
  signingIn: number;
  domains: number;
  externalAssets: number;
  outsideIn: number;
  peer: number;
  certifications: { name: string; state: 'valid' | 'expired' | 'claimed' | 'none' }[];
  questionnaire: { section: string; answered: number; total: number; flagged: number }[];
  findings: DdFinding[];
  breaches: { year: number; what: string; records?: string }[];
  darkWeb: { mentions: number; credentials: number; stealerHosts: number };
  summary: string;
}

const F = (id: string, category: DdCategory, sev: DdSev, title: string, detail: string, source: string, lo: number, hi: number, redFlag?: boolean): DdFinding => ({ id, category, sev, title, detail, source, fixLowK: lo, fixHighK: hi, redFlag });

export const DD_TARGETS: DdTarget[] = [
  {
    id: 'brightwater', name: 'Brightwater Cold Chain B.V.', short: 'Brightwater', colour: '#0e7490', sector: 'Temperature-controlled logistics', hq: 'Venlo, Netherlands',
    employees: 2300, revenueM: 510, dealValueM: 640, stage: 'Confirmatory DD', dealLead: 'Priya Raman', signingIn: 26, domains: 14, externalAssets: 412, outsideIn: 58, peer: 69,
    certifications: [{ name: 'ISO/IEC 27001', state: 'expired' }, { name: 'GDP (pharma logistics)', state: 'valid' }, { name: 'TAPA FSR', state: 'valid' }, { name: 'NIS2 registration', state: 'none' }],
    questionnaire: [
      { section: 'Governance', answered: 14, total: 14, flagged: 2 }, { section: 'Identity & access', answered: 17, total: 18, flagged: 5 }, { section: 'Endpoint & server', answered: 11, total: 12, flagged: 2 },
      { section: 'Network & OT', answered: 8, total: 15, flagged: 4 }, { section: 'Data protection', answered: 10, total: 10, flagged: 1 }, { section: 'Third parties', answered: 6, total: 11, flagged: 2 },
      { section: 'Incident response', answered: 9, total: 9, flagged: 1 }, { section: 'Backup & recovery', answered: 7, total: 8, flagged: 3 },
    ],
    findings: [
      F('BW-01', 'Attack surface', 'critical', 'Warehouse-management system login exposed on the internet, unpatched (vendor advisory, CVSS 9.8)', 'wms.brightwater-cc.nl serves an admin portal on a version with a known authentication bypass; two instances, one in Venlo, one in Antwerp.', 'HexaInt outside-in scan', 60, 140, true),
      F('BW-02', 'Attack surface', 'high', 'RDP open on 6 hosts, including a refrigeration-monitoring server', 'Port 3389 reachable on hosts in the 185.x range registered to the target; one host banner names the cold-store SCADA historian.', 'HexaInt outside-in scan', 25, 60, true),
      F('BW-03', 'Leaked credentials', 'high', '148 employee credentials in breach corpora; 31 from 2025 stealer logs', 'Includes finance and IT administrators; 9 match the SSO domain format and are less than 90 days old.', 'HexaInt credential monitoring', 20, 45),
      F('BW-04', 'Dark web', 'medium', 'Initial-access broker listing matching the target profile', 'A forum post offers "VPN access, Dutch cold-chain logistics, ~2,000 staff, €500M revenue". Not confirmed; profile overlap is high.', 'HexaInt dark-web monitoring', 30, 80, true),
      F('BW-05', 'Breach history', 'high', 'Ransomware incident in 2023, disclosed to the Dutch DPA', 'Two-day outage at the Venlo hub; root cause analysis not provided in the data room. Insurance claim paid.', 'Public disclosure · data room', 0, 0),
      F('BW-06', 'Certifications', 'medium', 'ISO 27001 certificate lapsed in March; recertification not booked', 'Certificate registry shows withdrawn status. Customers in pharma logistics contractually require it.', 'Certificate registry', 40, 70),
      F('BW-07', 'Email & domain', 'medium', 'DMARC at p=none on 9 of 14 domains; 4 look-alike domains registered', 'Look-alikes include brightwater-coldchain.com registered six weeks ago with an MX record.', 'HexaInt domain monitoring', 8, 15),
      F('BW-08', 'Questionnaire', 'high', 'No segmentation between office IT and refrigeration control', 'Answer to NW-07 confirms a flat network at 5 of 7 sites; vendor remote access via TeamViewer.', 'Questionnaire NW-07', 180, 320, true),
      F('BW-09', 'Questionnaire', 'medium', 'Backups not immutable; last restore test 14 months ago', 'Answer to BR-03 and BR-05.', 'Questionnaire BR-03', 45, 90),
    ],
    breaches: [{ year: 2023, what: 'Ransomware, Venlo hub outage (2 days), DPA notified', records: 'Employee HR data (~1,900)' }, { year: 2021, what: 'Business email compromise, supplier invoice fraud', records: '€184k loss' }],
    darkWeb: { mentions: 11, credentials: 148, stealerHosts: 7 },
    summary: 'Material cyber debt in OT segmentation and internet-facing systems, a 2023 ransomware event with no root-cause evidence, and a likely access-broker listing. Fixable inside the first 100 days, but priced risk is warranted.',
  },
  {
    id: 'oakfield', name: 'Oakfield Diagnostics, Inc.', short: 'Oakfield', colour: '#0891b2', sector: 'Clinical diagnostics laboratories', hq: 'Raleigh, North Carolina',
    employees: 1700, revenueM: 330, dealValueM: 410, stage: 'LOI signed', dealLead: 'Tom Ellery', signingIn: 54, domains: 6, externalAssets: 188, outsideIn: 71, peer: 66,
    certifications: [{ name: 'HITRUST r2', state: 'valid' }, { name: 'SOC 2 Type II', state: 'valid' }, { name: 'CAP / CLIA', state: 'valid' }, { name: 'ISO 27001', state: 'none' }],
    questionnaire: [
      { section: 'Governance', answered: 14, total: 14, flagged: 0 }, { section: 'Identity & access', answered: 18, total: 18, flagged: 2 }, { section: 'Endpoint & server', answered: 12, total: 12, flagged: 1 },
      { section: 'Network & OT', answered: 13, total: 15, flagged: 2 }, { section: 'Data protection', answered: 10, total: 10, flagged: 1 }, { section: 'Third parties', answered: 9, total: 11, flagged: 1 },
      { section: 'Incident response', answered: 9, total: 9, flagged: 0 }, { section: 'Backup & recovery', answered: 8, total: 8, flagged: 1 },
    ],
    findings: [
      F('OK-01', 'Attack surface', 'high', 'Patient results portal on an outdated web framework', 'results.oakfielddx.com runs a framework release out of support since 2024; no known exploit in use, WAF in front.', 'HexaInt outside-in scan', 40, 90),
      F('OK-02', 'Attack surface', 'medium', 'Lab analysers reachable through a vendor support VPN without MFA', 'Questionnaire and scan agree: one vendor concentrator with single-factor access to analyser network.', 'HexaInt outside-in scan · questionnaire', 20, 45),
      F('OK-03', 'Leaked credentials', 'medium', '57 credentials in breach corpora; none in recent stealer logs', 'All pre-2023; passwords rotated per the target. Low residual risk.', 'HexaInt credential monitoring', 5, 10),
      F('OK-04', 'Breach history', 'high', 'Third-party billing vendor breach (2024) affected 212k patients', 'The breach was at the vendor, but the OCR notification and class action name Oakfield; litigation ongoing.', 'HHS OCR breach portal · public filings', 0, 0, true),
      F('OK-05', 'Certifications', 'low', 'HITRUST r2 valid until next August; scope excludes two acquired labs', 'Plan to extend scope at the interim assessment.', 'HITRUST registry', 30, 60),
      F('OK-06', 'Email & domain', 'low', 'DMARC enforced (p=reject) on all domains', 'Good practice; no action.', 'HexaInt domain monitoring', 0, 0),
      F('OK-07', 'Questionnaire', 'medium', 'Two acquired labs still on their own email and identity tenants', 'Integration started; 9 months behind plan.', 'Questionnaire IA-11', 60, 120),
    ],
    breaches: [{ year: 2024, what: 'Billing vendor breach, OCR notification and class action', records: '212,000 patients' }],
    darkWeb: { mentions: 4, credentials: 57, stealerHosts: 0 },
    summary: 'Above-peer security posture with valid HITRUST and SOC 2. The main exposure is legal: an open class action from a 2024 vendor breach. Recommend a specific indemnity rather than a price adjustment.',
  },
  {
    id: 'tessera', name: 'Tessera Payments GmbH', short: 'Tessera', colour: '#4f46e5', sector: 'Payment processing (fintech)', hq: 'Berlin, Germany',
    employees: 540, revenueM: 120, dealValueM: 1100, stage: 'Exclusivity', dealLead: 'Priya Raman', signingIn: 38, domains: 9, externalAssets: 264, outsideIn: 64, peer: 74,
    certifications: [{ name: 'PCI DSS v4.0.1', state: 'valid' }, { name: 'ISO/IEC 27001', state: 'claimed' }, { name: 'SOC 2 Type II', state: 'none' }, { name: 'DORA register', state: 'claimed' }],
    questionnaire: [
      { section: 'Governance', answered: 12, total: 14, flagged: 3 }, { section: 'Identity & access', answered: 16, total: 18, flagged: 3 }, { section: 'Endpoint & server', answered: 12, total: 12, flagged: 0 },
      { section: 'Cloud & DevOps', answered: 15, total: 16, flagged: 4 }, { section: 'Data protection', answered: 9, total: 10, flagged: 1 }, { section: 'Third parties', answered: 5, total: 11, flagged: 3 },
      { section: 'Incident response', answered: 7, total: 9, flagged: 2 }, { section: 'Backup & recovery', answered: 8, total: 8, flagged: 0 },
    ],
    findings: [
      F('TS-01', 'Attack surface', 'critical', 'Staging API exposes merchant test data and an unauthenticated debug endpoint', 'api-staging.tessera-pay.de returns stack traces and a /debug/vars endpoint; merchant IDs in responses look production-like.', 'HexaInt outside-in scan', 30, 70, true),
      F('TS-02', 'Leaked credentials', 'critical', 'Cloud access key for the payments account in a public code repository', 'Key belongs to a CI user; committed 19 days ago by a contractor. Target says it was rotated; CloudTrail evidence requested.', 'HexaInt code-leak monitoring', 40, 120, true),
      F('TS-03', 'Dark web', 'high', 'Card-testing service advertises Tessera merchants as "low friction"', 'Three posts in carding forums; fraud rate data requested from the target.', 'HexaInt dark-web monitoring', 60, 150),
      F('TS-04', 'Certifications', 'high', 'ISO 27001 claimed on the website; no certificate found', 'Target states certification audit is booked for next quarter.', 'Certificate registry', 50, 90, true),
      F('TS-05', 'Questionnaire', 'high', 'DORA register of information incomplete; 6 critical ICT providers without exit plans', 'BaFin supervisory dialogue expected; remediation effort material for a 540-person firm.', 'Questionnaire TP-04', 120, 240),
      F('TS-06', 'Email & domain', 'medium', '11 look-alike domains, 3 hosting payment-page clones', 'Takedowns not requested by the target.', 'HexaInt domain monitoring', 10, 25),
      F('TS-07', 'Breach history', 'low', 'No public breaches or regulatory notifications found', 'Covers BaFin, EDPB and press sources since 2019.', 'Public sources', 0, 0),
    ],
    breaches: [],
    darkWeb: { mentions: 19, credentials: 34, stealerHosts: 3 },
    summary: 'Strong product engineering but immature governance for a regulated payments firm: a leaked cloud key, an unverified ISO 27001 claim and DORA gaps. Recommend escrow tied to evidence of key rotation and certification.',
  },
];

export const DD_SEV_W: Record<DdSev, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function ddImpact(t: DdTarget) {
  const lo = t.findings.reduce((s, f) => s + f.fixLowK, 0);
  const hi = t.findings.reduce((s, f) => s + f.fixHighK, 0);
  const flags = t.findings.filter((f) => f.redFlag).length;
  const breachRisk = t.breaches.length ? 1 : 0;
  // Price adjustment: mid remediation cost plus a risk premium for red flags.
  const premium = flags * 0.0006 * t.dealValueM * 1000;
  const adjustK = Math.round(((lo + hi) / 2 + premium) / 10) * 10;
  const escrowPct = Math.min(2.5, 0.2 + flags * 0.15 + breachRisk * 0.25);
  const escrowK = Math.round((t.dealValueM * 1000 * escrowPct) / 100 / 50) * 50;
  const answered = t.questionnaire.reduce((s, q) => s + q.answered, 0);
  const total = t.questionnaire.reduce((s, q) => s + q.total, 0);
  return { lo, hi, flags, adjustK, adjustPct: (adjustK / (t.dealValueM * 1000)) * 100, escrowPct, escrowK, answered, total, qPct: Math.round((answered / total) * 100), flagged: t.questionnaire.reduce((s, q) => s + q.flagged, 0) };
}

/* =====================================================================
   First 100 days
   ===================================================================== */
export type MsStatus = 'done' | 'in-progress' | 'at-risk' | 'not-started';
export const MS_COLOR: Record<MsStatus, string> = { done: 'var(--good)', 'in-progress': 'var(--m-matrix)', 'at-risk': 'var(--bad)', 'not-started': 'var(--text-muted)' };
export const MS_LABEL: Record<MsStatus, string> = { done: 'Done', 'in-progress': 'In progress', 'at-risk': 'At risk', 'not-started': 'Not started' };
export const PHASES = [
  { id: 0, label: 'Day 0', sub: 'Close & contain' },
  { id: 30, label: 'Day 30', sub: 'Connect & see' },
  { id: 60, label: 'Day 60', sub: 'Baseline & fix' },
  { id: 100, label: 'Day 100', sub: 'Assure & hand over' },
] as const;

export interface Milestone {
  id: string;
  phase: 0 | 30 | 60 | 100;
  due: number;
  title: string;
  detail: string;
  owner: string;
  module: string;
  path: string;
  riGain: number;
  status: MsStatus;
}

const MS_TEMPLATE: Omit<Milestone, 'status' | 'id'>[] = [
  { phase: 0, due: 2, title: 'Cyber condition precedent signed off', detail: 'Leaked credentials rotated, exposed admin portals closed, emergency contacts exchanged.', owner: 'Priya Raman', module: 'Deal team', path: '/partner/portfolio?section=diligence', riGain: 1 },
  { phase: 0, due: 5, title: 'Break-glass and privileged accounts inventoried', detail: 'All domain admins, cloud owners and vendor accounts listed and owners confirmed.', owner: 'Jack Turner', module: 'Identity', path: '/fabric/identity', riGain: 1.5 },
  { phase: 0, due: 7, title: 'HexaInt outside-in monitoring switched on', detail: 'Domains, IP ranges, brands and VIPs added to credential and dark-web monitoring.', owner: 'Aisha Bello', module: 'HexaInt', path: '/int/overview', riGain: 0.8 },
  { phase: 0, due: 10, title: 'Incident retainer and escalation path live', detail: 'The acquired company is added to the group IR retainer and the 24/7 SOC runbook.', owner: 'Marcus Chen', module: 'HexaSOC', path: '/soc/ir', riGain: 0.6 },
  { phase: 30, due: 18, title: 'Connect identity to HexaCore', detail: 'Entra ID / Active Directory read connector, sign-in risk and MFA posture flowing.', owner: 'Jack Turner', module: 'HexaCore', path: '/fabric/integrations', riGain: 2.2 },
  { phase: 30, due: 24, title: 'Deploy EDR to all servers and endpoints', detail: 'Group EDR rolled out; legacy AV removed; coverage reported daily.', owner: 'Marcus Chen', module: 'HexaCore', path: '/fabric/integrations', riGain: 3.1 },
  { phase: 30, due: 28, title: 'Forward logs to the group SIEM via HexaCore', detail: 'Firewall, VPN, identity and EDR telemetry onboarded; detections enabled.', owner: 'Aisha Bello', module: 'HexaSOC', path: '/soc/detection', riGain: 2.4 },
  { phase: 30, due: 30, title: 'Asset inventory reconciled', detail: 'CMDB, EDR and scanner views reconciled; unknown assets triaged.', owner: 'Jack Turner', module: 'HexaCore', path: '/fabric/exposure', riGain: 1 },
  { phase: 60, due: 38, title: 'Baseline Resilience Index published', detail: 'First full RI with all connectors live; agreed as the 100-day starting point.', owner: 'Freya Watts', module: 'HexaView', path: '/', riGain: 0 },
  { phase: 60, due: 45, title: 'Close critical external findings', detail: 'Every critical finding from due diligence remediated and re-tested by HexaStrike.', owner: 'Kwame Asante', module: 'HexaStrike', path: '/strike/pentest', riGain: 3.4 },
  { phase: 60, due: 52, title: 'Enforce phishing-resistant MFA for admins and remote access', detail: 'FIDO2 for privileged users; conditional access for VPN and vendor access.', owner: 'Jack Turner', module: 'Identity', path: '/fabric/identity', riGain: 2.6 },
  { phase: 60, due: 60, title: 'Segment OT and vendor remote access', detail: 'Site networks split from office IT; vendor sessions brokered and recorded.', owner: 'Sofia Herrera', module: 'HexaOT', path: '/ot/visibility', riGain: 2.8 },
  { phase: 100, due: 72, title: 'Immutable backups and a tested restore', detail: 'Crown-jewel systems restored in a test window; evidence filed.', owner: 'Owen Price', module: 'HexaComply', path: '/comply/caas?section=tasks', riGain: 2 },
  { phase: 100, due: 80, title: 'Map controls to group frameworks', detail: 'Group control set applied in HexaComply; gaps raised as tasks.', owner: 'Owen Price', module: 'HexaComply', path: '/comply/caas?section=frameworks', riGain: 1.2 },
  { phase: 100, due: 90, title: 'Tabletop exercise with the new leadership team', detail: 'Ransomware scenario with the acquired executive team and the sponsor.', owner: 'Marcus Chen', module: 'HexaSOC', path: '/soc/ir', riGain: 0.8 },
  { phase: 100, due: 100, title: '100-day report to the investment committee', detail: 'Resilience Index movement, residual risks and the 12-month plan.', owner: 'Priya Raman', module: 'Board report', path: '/board', riGain: 0 },
];

export function hundredDayPlan(co: PortfolioCo): Milestone[] {
  const day = co.day ?? 0;
  const r = rng(`pf-100-${co.id}`);
  return MS_TEMPLATE.map((m, i) => {
    let status: MsStatus;
    if (m.due < day - 4) status = r.chance(0.86) ? 'done' : 'at-risk';
    else if (m.due <= day + 8) status = r.chance(0.7) ? 'in-progress' : m.due < day ? 'at-risk' : 'in-progress';
    else status = 'not-started';
    return { ...m, riGain: Math.round(m.riGain * 6) / 10, id: `${co.id}-m${i + 1}`, status };
  });
}

/** Planned vs actual Resilience Index across the 100 days (every 5 days). */
export function riskCurve(co: PortfolioCo, plan: Milestone[]) {
  const day = co.day ?? 0;
  const start = co.ri - Math.round(day / 12) - 2;
  const target = Math.min(84, start + Math.round(plan.reduce((s, m) => s + m.riGain, 0)));
  const r = rng(`pf-curve-${co.id}`);
  const days: number[] = [];
  const planned: number[] = [];
  const actual: (number | null)[] = [];
  const crit: (number | null)[] = [];
  const crit0 = co.openCritical + 6;
  for (let d = 0; d <= 100; d += 5) {
    days.push(d);
    const s = 1 / (1 + Math.exp(-(d - 45) / 14));
    planned.push(Math.round((start + (target - start) * s) * 10) / 10);
    if (d <= day) {
      const frac = day ? d / day : 1;
      actual.push(Math.round((start + (co.ri - start) * frac + (d && d < day ? (r() - 0.5) * 1.2 : 0)) * 10) / 10);
      crit.push(Math.max(co.openCritical, Math.round(crit0 - (crit0 - co.openCritical) * frac)));
    } else {
      actual.push(null);
      crit.push(null);
    }
  }
  return { days, planned, actual, crit, start, target };
}
