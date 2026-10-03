// HexaComply (GRC), Board view and Closed-loop data generation.
// Every count anchors to headlines(c, tenantId) so this module agrees with the
// Command Centre. Seeded RNG keeps data stable per customer and tenant.
import type { ConnectorCategory, CustomerId, CustomerProfile, FrameworkScope, Severity } from '../types';
import { rng } from '../../lib/rng';
import { headlines, loops, loopSummary, resilienceIndex, riTrend, type Loop } from '../core';
import { scopedTenants, groupRI, scopedConnectors, isStale } from '../customers';
import { CVES } from '../reference';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** RI difference between the scoped tenant and the group, used to nudge percentages. */
function tenantDelta(c: CustomerProfile, tenantId: string): number {
  if (tenantId === 'all') return 0;
  const t = scopedTenants(c, tenantId)[0];
  return t ? t.ri - groupRI(c) : 0;
}

/* =====================================================================
   Compliance as a Service
   ===================================================================== */
const AUDIT_DAYS: Record<CustomerId, Record<string, number>> = {
  maritime: { iso27001: 34, imo: 128, iacs: 71, isps: 96 },
  finserv: { dora: 104, pci: 63, swift: 77, iso27001: 162, nydfs: 188, soc2: 89 },
  media: { tpn: 41, iso27001: 112 },
  healthcare: { hipaa: 104, hitrust: 152, pci: 128 },
  automotive: { r155: 196, tisax: 131, iso27001: 71 },
};

export interface FrameworkStatus {
  fw: FrameworkScope;
  documented: number;
  assured: number;
  compliant: number;
  inProgress: number;
  notStarted: number;
  outOfScope: number;
  controls: number;
  evidence: number;
  auditInDays?: number;
  trend: number[];
}

export function frameworkStatus(c: CustomerProfile, tenantId: string): FrameworkStatus[] {
  const d = tenantDelta(c, tenantId);
  const h = headlines(c, tenantId);
  const totalReq = c.frameworks.reduce((s, f) => s + f.inScope, 0);
  return c.frameworks.map((f) => {
    const r = rng(`fw-${c.id}-${tenantId}-${f.id}`);
    const documented = Math.round(clamp(f.documented + d * 0.6));
    const assured = Math.round(clamp(f.assured + d * 0.7));
    const compliant = Math.round((f.inScope * documented) / 100);
    const rest = f.inScope - compliant;
    const inProgress = Math.round(rest * r.float(0.55, 0.78, 2));
    const trend = r.series(6, documented - r.int(6, 11), 1.6, 1.7, 40, 100).map(Math.round);
    trend[5] = documented;
    return {
      fw: f, documented, assured, compliant, inProgress, notStarted: rest - inProgress,
      outOfScope: f.requirements - f.inScope,
      controls: Math.round(f.inScope * r.float(1.3, 1.9, 2)),
      evidence: Math.round((h.comply.evidenceItems * f.inScope) / totalReq),
      auditInDays: f.nextAudit ? AUDIT_DAYS[c.id][f.id] ?? r.int(40, 200) : undefined,
      trend,
    };
  });
}

export const CSF_FUNCTIONS = ['Govern', 'Identify', 'Protect', 'Detect', 'Respond', 'Recover'] as const;
const CSF_OFFSET: Record<CustomerId, number[]> = {
  maritime: [2, -3, 1, 4, 3, -9],
  finserv: [6, 2, 3, 5, 2, -2],
  media: [-2, -4, -6, 1, 0, -3],
  healthcare: [1, -2, -1, 3, 2, -8],
  automotive: [3, -1, 2, 4, 1, -5],
};
export function csfCoverage(c: CustomerProfile, tenantId: string) {
  const fs = frameworkStatus(c, tenantId);
  const base = fs.reduce((s, f) => s + f.documented, 0) / fs.length;
  const r = rng(`csf-${c.id}-${tenantId}`);
  return CSF_FUNCTIONS.map((name, i) => ({
    name,
    actual: Math.round(clamp(base + CSF_OFFSET[c.id][i] + r.float(-2, 2))),
    target: name === 'Govern' || name === 'Protect' ? 90 : 85,
  }));
}

export type TaskSev = 'critical' | 'high' | 'medium' | 'low';
export const TASK_SEVS: TaskSev[] = ['critical', 'high', 'medium', 'low'];

export const EVIDENCE_STATES = [
  { key: 'draft', label: 'Draft', color: 'var(--sev-info)', w: 4 },
  { key: 'submitted', label: 'Submitted', color: 'var(--m-matrix)', w: 5 },
  { key: 'processing', label: 'Processing', color: 'var(--m-core)', w: 3 },
  { key: 'more_info', label: 'More info', color: 'var(--sev-medium)', w: 2.5 },
  { key: 'approved', label: 'Approved', color: 'var(--good)', w: 76 },
  { key: 'rejected', label: 'Rejected', color: 'var(--sev-high)', w: 1.5 },
  { key: 'expired', label: 'Expired', color: 'var(--sev-low)', w: 6 },
  { key: 'failed', label: 'Failed collection', color: 'var(--bad)', w: 2 },
] as const;

export function evidencePipeline(c: CustomerProfile, tenantId: string) {
  const total = headlines(c, tenantId).comply.evidenceItems;
  const r = rng(`ev-${c.id}-${tenantId}`);
  const ws = EVIDENCE_STATES.map((e) => e.w * r.float(0.8, 1.2, 2));
  const wt = ws.reduce((a, b) => a + b, 0);
  const counts = ws.map((w) => Math.floor((total * w) / wt));
  counts[4] += total - counts.reduce((a, b) => a + b, 0);
  const autoPct = r.int(71, 86);
  return { total, autoPct, states: EVIDENCE_STATES.map((e, i) => ({ ...e, count: counts[i] })) };
}

export type RiskLevel = 'Low' | 'Medium' | 'High';
export interface RiskItem {
  id: string;
  title: string;
  category: string;
  owner: string;
  tenant: string;
  inherent: { l: number; i: number };
  /** null = not yet scored after treatment (shown honestly, never as zero). */
  residual: { l: number; i: number } | null;
  treatment: 'Mitigate' | 'Transfer' | 'Accept' | 'Avoid' | 'Not set';
  controls: string[];
  reviewDays: number;
  threat: string;
  vulnerability: string;
  consequence: string;
  asset: string;
  config: 'Asset risk' | 'Category risk';
  inherentScore: number;
  residualScore: number | null;
  level: RiskLevel;
  residualLevel: RiskLevel | null;
  /** Days until the treatment is due (negative = past due); null when no treatment date. */
  dueDays: number | null;
  lossK: number;
  curated: boolean;
}

/** Score on the original 0–100 scale: likelihood × impact × 4. */
export function riskScore(l: number, i: number): number {
  return l * i * 4;
}
export function riskLevel(score: number): RiskLevel {
  return score >= 80 ? 'High' : score >= 40 ? 'Medium' : 'Low';
}
export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = { High: 'var(--sev-critical)', Medium: 'var(--sev-medium)', Low: 'var(--good)' };
export const L_LABELS = ['Very low', 'Low', 'Medium', 'High', 'Very high'];

const RISKS: Record<CustomerId, [string, string, string, number, number, number, number, RiskItem['treatment'], string[]][]> = {
  maritime: [
    ['Ransomware halts terminal operating system (Navis N4)', 'Cyber · availability', 'rtm', 4, 5, 2, 4, 'Mitigate', ['CTL-BKP-07', 'CTL-MAL-05']],
    ['Unauthorised vendor remote access to STS crane PLCs', 'OT · third party', 'rtm', 4, 5, 2, 3, 'Mitigate', ['CTL-OT-02', 'CTL-SUP-11']],
    ['GNSS / AIS spoofing affects vessel navigation', 'OT · safety', 'fleet', 3, 5, 2, 4, 'Mitigate', ['CTL-GNSS-14']],
    ['Compromise of vessel IT via crew personal devices', 'Cyber · OT', 'fleet', 4, 3, 3, 3, 'Mitigate', ['CTL-NET-04', 'CTL-MAL-05']],
    ['KEV exploited on internet-facing terminal gateway', 'Cyber · exposure', 'sts', 4, 4, 2, 3, 'Mitigate', ['CTL-VUL-08']],
    ['Business email compromise on freight invoices', 'Fraud', 'hq', 4, 3, 2, 2, 'Mitigate', ['CTL-EML-10', 'CTL-ACC-01']],
    ['PLC logic changed outside change window', 'OT · integrity', 'ant', 3, 5, 2, 4, 'Mitigate', ['CTL-OT-12']],
    ['NIS2 reporting deadline missed during incident', 'Regulatory', 'hq', 2, 4, 1, 3, 'Mitigate', ['CTL-LOG-06']],
    ['Loss of satellite connectivity to fleet', 'Availability', 'fleet', 3, 3, 3, 2, 'Accept', []],
    ['Cyber loss above insured limit', 'Financial', 'hq', 2, 5, 2, 4, 'Transfer', []],
    ['Removable media introduces malware to ECDIS', 'OT · safety', 'fleet', 3, 4, 2, 3, 'Mitigate', ['CTL-OT-03']],
    ['Privileged AD credentials harvested at Port Klang', 'Cyber · identity', 'pkl', 3, 4, 2, 3, 'Mitigate', ['CTL-PRV-09']],
  ],
  finserv: [
    ['Fraudulent SWIFT payment via compromised operator', 'Fraud · payments', 'ukbank', 3, 5, 1, 4, 'Mitigate', ['CTL-SWF-03', 'CTL-IAM-01']],
    ['Help-desk social engineering leads to Tier 0 takeover', 'Cyber · identity', 'ukbank', 4, 5, 2, 4, 'Mitigate', ['CTL-PAM-02', 'CTL-IAM-01']],
    ['Card data compromise in the CDE', 'Cyber · data', 'pay', 3, 5, 1, 4, 'Mitigate', ['CTL-PAY-04', 'CTL-EDR-05']],
    ['Critical ICT provider outage beyond impact tolerance', 'Operational resilience', 'eu', 3, 5, 2, 4, 'Mitigate', ['CTL-TPR-10', 'CTL-BCP-09']],
    ['Ransomware encrypts core banking and backups', 'Cyber · availability', 'ukbank', 3, 5, 1, 5, 'Mitigate', ['CTL-BCP-09', 'CTL-EDR-05']],
    ['Open-banking API exposes customer accounts (BOLA)', 'Cyber · exposure', 'ukbank', 4, 4, 3, 4, 'Mitigate', ['CTL-VUL-07']],
    ['DORA major-incident reporting late or incomplete', 'Regulatory', 'eu', 2, 4, 1, 3, 'Mitigate', ['CTL-LOG-06']],
    ['Insider exfiltrates client portfolios (Wealth SG)', 'Data · insider', 'wealth', 3, 4, 2, 3, 'Mitigate', ['CTL-DLP-08']],
    ['Unauthorised mainframe ledger change', 'Integrity', 'ukbank', 2, 5, 1, 4, 'Mitigate', ['CTL-MF-13']],
    ['Market-abuse data leak from trading floor', 'Conduct', 'markets', 2, 4, 2, 3, 'Mitigate', ['CTL-DLP-08']],
    ['Cyber loss above tower limit', 'Financial', 'ukbank', 1, 5, 1, 4, 'Transfer', []],
    ['Concentration on a single hyperscaler', 'Operational resilience', 'eu', 3, 4, 3, 4, 'Accept', []],
  ],
  media: [
    ['Pre-release title leaks from a vendor', 'Content · third party', 'post', 4, 5, 3, 4, 'Mitigate', ['CTL-CST-01', 'CTL-VEN-05']],
    ['Screener portal auth bypass exposes unreleased cuts', 'Cyber · exposure', 'studios', 4, 5, 3, 4, 'Mitigate', ['CTL-VUL-09', 'CTL-WAT-08']],
    ['Help-desk social engineering (Scattered Spider)', 'Cyber · identity', 'studios', 4, 4, 2, 4, 'Mitigate', ['CTL-IAM-02']],
    ['Ransomware on Avid NEXIS halts editorial', 'Cyber · availability', 'post', 3, 5, 2, 4, 'Mitigate', ['CTL-BKP-11', 'CTL-EDR-06']],
    ['Subscriber card data skimmed on payment page', 'Cyber · data', 'play', 3, 4, 1, 4, 'Mitigate', ['CTL-PCI-10']],
    ['Live playout disrupted during a sports event', 'Availability', 'live', 2, 5, 2, 4, 'Mitigate', ['CTL-OT-12']],
    ['Unsanctioned AI uses talent likeness', 'Legal · AI', 'studios', 3, 4, 2, 3, 'Mitigate', []],
    ['Edit-bay content copied to personal cloud', 'Content · insider', 'post', 4, 4, 2, 3, 'Mitigate', ['CTL-DLP-04']],
    ['TPN status lapses for a tier-1 vendor', 'Contractual', 'post', 3, 3, 2, 3, 'Mitigate', ['CTL-VEN-05']],
    ['Credential stuffing drives account takeover on KestrelPlay', 'Fraud', 'play', 4, 3, 2, 2, 'Mitigate', ['CTL-IAM-02']],
    ['Cyber loss above insured limit', 'Financial', 'studios', 2, 5, 2, 4, 'Transfer', []],
  ],
  healthcare: [
    ['Ransomware forces Epic downtime across the hospitals and ambulance diversion', 'Cyber · patient safety', 'mrmc', 4, 5, 2, 4, 'Mitigate', ['CTL-BKP-06', 'CTL-EDR-05']],
    ['Help-desk social engineering resets clinician MFA (Scattered Spider pattern)', 'Cyber · identity', 'mrmc', 4, 4, 2, 3, 'Mitigate', ['CTL-HD-02', 'CTL-IAM-01']],
    ['Legacy infusion pumps on the flat clinical VLAN are tampered with', 'Medical device · safety', 'community', 3, 5, 2, 4, 'Mitigate', ['CTL-MD-03']],
    ['Biomed vendor remote access abused to reach imaging modalities', 'Medical device · third party', 'mrmc', 3, 4, 2, 3, 'Mitigate', ['CTL-MD-04', 'CTL-TPR-10']],
    ['Clearinghouse outage halts claims and cash flow (Change Healthcare-type event)', 'Third party · financial', 'clinics', 4, 4, 3, 3, 'Mitigate', ['CTL-TPR-10']],
    ['Workforce snooping on VIP patient records in Epic', 'Privacy · insider', 'mrmc', 4, 3, 2, 3, 'Mitigate', ['CTL-LOG-07']],
    ['Genomics research cohort exfiltrated from the research cloud', 'Data · research', 'research', 3, 4, 2, 3, 'Mitigate', ['CTL-DLP-11']],
    ['Known exploited vulnerability on the Citrix gateway used for initial access', 'Cyber · exposure', 'mrmc', 4, 4, 2, 3, 'Mitigate', ['CTL-VUL-08']],
    ['HIPAA breach notification (60 days) missed or incomplete', 'Regulatory', 'mrmc', 2, 4, 1, 3, 'Mitigate', ['CTL-LOG-07']],
    ['Business email compromise redirects supplier payments', 'Fraud', 'clinics', 4, 3, 2, 2, 'Mitigate', ['CTL-EML-09']],
    ['Loss of theatre HVAC and medical-gas alarm monitoring', 'OT · safety', 'kids', 2, 5, 2, 4, 'Mitigate', ['CTL-MD-03']],
    ['Cyber loss above insured limit', 'Financial', 'mrmc', 2, 5, 2, 4, 'Transfer', []],
  ],
  automotive: [
    ['Ransomware stops Ingolstadt assembly and breaks JIT/JIS supply', 'Cyber · availability', 'ingolstadt', 4, 5, 2, 4, 'Mitigate', ['CTL-BKP-09', 'CTL-EDR-08']],
    ['OTA signing key compromise pushes a malicious update to the fleet', 'Vehicle · safety', 'connected', 2, 5, 1, 5, 'Mitigate', ['CTL-OTA-01']],
    ['Vehicle backend API abuse enables remote unlock or tracking', 'Vehicle · privacy', 'connected', 3, 5, 2, 4, 'Mitigate', ['CTL-API-11', 'CTL-VSOC-02']],
    ['Robot OEM remote access used to pivot into the body shop', 'OT · third party', 'ingolstadt', 3, 5, 2, 3, 'Mitigate', ['CTL-OT-03']],
    ['IT-to-OT conduits at Puebla bypass the Level 3.5 DMZ', 'OT · segmentation', 'puebla', 4, 4, 2, 4, 'Mitigate', ['CTL-OT-04']],
    ['Pre-launch design IP stolen by a state-backed group (APT41)', 'IP · espionage', 'group', 3, 5, 2, 4, 'Mitigate', ['CTL-IP-06']],
    ['Dealer DMS SaaS outage halts sales and service (BlackSuit pattern)', 'Third party · availability', 'retail', 3, 4, 3, 3, 'Mitigate', ['CTL-SUP-10']],
    ['Battery formation process manipulated, causing a thermal event', 'OT · safety', 'battery', 2, 5, 1, 5, 'Mitigate', ['CTL-OT-05']],
    ['Supplier without a valid TISAX label receives prototype data', 'Third party · IP', 'group', 4, 3, 2, 3, 'Mitigate', ['CTL-SUP-10']],
    ['SAP supplier-master change redirects a payment run', 'Fraud', 'group', 3, 4, 2, 3, 'Mitigate', ['CTL-ERP-12']],
    ['R155 type approval at risk from CSMS audit findings', 'Regulatory', 'connected', 2, 5, 1, 4, 'Mitigate', ['CTL-VSOC-02']],
    ['Cyber loss above tower limit', 'Financial', 'group', 1, 5, 1, 4, 'Transfer', []],
  ],
};

const RISK_TOTAL: Record<CustomerId, number> = { maritime: 236, finserv: 284, media: 208, healthcare: 266, automotive: 298 };
const RISK_THREATS: Record<CustomerId, string[]> = {
  maritime: ['Ransomware', 'Vendor remote-access abuse', 'GNSS / AIS spoofing', 'Business email compromise (BEC)', 'Insider misuse', 'Malware via removable media', 'Satellite link outage', 'Edge appliance intrusion', 'Cloud misconfiguration', 'Supply-chain compromise'],
  finserv: ['Ransomware', 'Payment fraud', 'Help-desk social engineering', 'Insider data theft', 'Third-party ICT outage', 'Edge appliance intrusion', 'Credential stuffing', 'DDoS on digital channels', 'Cloud misconfiguration', 'Market-abuse data leak'],
  media: ['Pre-release leak', 'Ransomware', 'Help-desk social engineering', 'Vendor content mishandling', 'Account takeover', 'Review-portal intrusion', 'Insider copy to personal cloud', 'Live playout disruption', 'Card skimming', 'Unsanctioned AI use'],
  healthcare: ['Ransomware', 'Help-desk social engineering', 'Medical device tampering', 'Biomed vendor remote access abuse', 'Workforce snooping on records', 'Clearinghouse outage', 'Edge appliance intrusion', 'Research data exfiltration', 'Business email compromise (BEC)', 'Lost or stolen device'],
  automotive: ['Ransomware', 'Industrial espionage', 'OTA supply-chain compromise', 'Vehicle API abuse', 'Robot vendor remote access abuse', 'Supplier data mishandling', 'Edge appliance intrusion', 'Dealer SaaS outage', 'SAP payment fraud', 'PLC logic manipulation'],
};
const RISK_VULNS = ['no multi-factor authentication for privileged users', 'flat network (no segmentation)', 'outdated endpoint OS / missing patches', 'orphaned accounts / incomplete offboarding', 'over-privileged roles', 'secrets stored in code repositories', 'third-party due diligence insufficient', 'backups not tested', 'logging gaps on critical systems', 'shared administrator credentials', 'end-of-support systems still in production', 'misconfigured firewall rules', 'weak supplier contract terms', 'no egress filtering'];
const RISK_CONSEQ: Record<CustomerId, string[]> = {
  maritime: ['vessel and terminal operations halted', 'safety incident at berth', 'regulatory sanctions (NIS2)', 'demurrage and contractual penalties', 'reputational damage with shipping lines'],
  finserv: ['supervisory sanctions or fines', 'customer detriment beyond impact tolerance', 'direct financial loss', 'loss of payment-scheme membership', 'reputational damage / negative media coverage'],
  media: ['pre-release title leaked', 'loss of studio vendor trust', 'subscriber churn', 'contractual penalties with distributors', 'reputational damage / negative media coverage'],
  healthcare: ['patient harm or delayed care', 'ambulance diversion and lost revenue', 'OCR enforcement and HIPAA penalties', 'breach notification to patients', 'loss of research grants'],
  automotive: ['line stop and missed JIT deliveries', 'vehicle recall or type-approval suspension', 'loss of design IP', 'TISAX label withdrawn by OEM partners', 'regulatory sanctions (NIS2)'],
};
const RISK_LOSS_K: Record<CustomerId, number> = { maritime: 38, finserv: 64, media: 26, healthcare: 52, automotive: 120 };

function riskGroup(c: CustomerProfile): RiskItem[] {
  const owners = [c.people.ciso.name, c.people.grcLead.name, c.people.socLead.name, c.people.otLead?.name ?? c.people.admin.name, c.people.staff[0].name, c.people.admin.name];
  const r = rng(`risk-${c.id}`);
  const mk = (base: Omit<RiskItem, 'inherentScore' | 'residualScore' | 'level' | 'residualLevel' | 'lossK'>): RiskItem => {
    const inherentScore = riskScore(base.inherent.l, base.inherent.i);
    const residualScore = base.residual ? riskScore(base.residual.l, base.residual.i) : null;
    return { ...base, inherentScore, residualScore, level: riskLevel(inherentScore), residualLevel: residualScore === null ? null : riskLevel(residualScore), lossK: Math.round((residualScore ?? inherentScore) * RISK_LOSS_K[c.id] * r.float(0.6, 1.5)) };
  };
  const out: RiskItem[] = RISKS[c.id].map(([title, category, tenant, il, ii, rl, ri, treatment, controls], i) => mk({
    id: `R-${String(i + 1).padStart(4, '0')}`, title, category, tenant, owner: r.pick(owners),
    inherent: { l: il, i: ii }, residual: { l: rl, i: ri }, treatment, controls, reviewDays: r.int(5, 120),
    threat: category, vulnerability: r.pick(RISK_VULNS), consequence: r.pick(RISK_CONSEQ[c.id]),
    asset: c.vocab.crownJewels[i % c.vocab.crownJewels.length], config: 'Asset risk',
    dueDays: treatment === 'Mitigate' ? r.int(-40, 160) : null, curated: true,
  }));
  const assets = [...c.vocab.crownJewels, ...c.vocab.servers.slice(0, 6), ...c.vocab.otSystems.slice(0, 5)];
  const cats = ['People', 'Information', 'Software', 'Hardware', 'Suppliers', 'Facilities'];
  const tIds = c.tenants.map((t) => t.id);
  for (let i = out.length; i < RISK_TOTAL[c.id]; i++) {
    const threat = r.pick(RISK_THREATS[c.id]);
    const vuln = r.pick(RISK_VULNS);
    const conseq = r.pick(RISK_CONSEQ[c.id]);
    const il = r.weighted<number>([[1, 0.4], [2, 1.6], [3, 3.2], [4, 2.6], [5, 0.9]]);
    const ii = r.weighted<number>([[1, 0.3], [2, 1.4], [3, 3.4], [4, 2.8], [5, 0.9]]);
    const treatment = r.weighted<RiskItem['treatment']>([['Mitigate', 46], ['Accept', 26], ['Transfer', 11], ['Avoid', 9], ['Not set', 8]]);
    const scored = treatment !== 'Not set' && r.chance(0.84);
    const cut = treatment === 'Mitigate' ? r.int(1, 2) : treatment === 'Avoid' ? 2 : treatment === 'Transfer' ? 1 : 0;
    const residual = scored ? { l: Math.max(1, il - cut), i: Math.max(1, ii - (treatment === 'Transfer' ? 1 : cut > 1 && r.chance(0.4) ? 1 : 0)) } : null;
    const isAsset = r.chance(0.45);
    out.push(mk({
      id: `R-${String(i + 1).padStart(4, '0')}`,
      title: `${threat} exploiting ${vuln} leading to ${conseq}.`,
      category: threat, tenant: r.pick(tIds), owner: r.pick(owners),
      inherent: { l: il, i: ii }, residual, treatment, controls: [], reviewDays: r.int(3, 200),
      threat, vulnerability: vuln, consequence: conseq,
      asset: isAsset ? r.pick(assets) : r.pick(cats), config: isAsset ? 'Asset risk' : 'Category risk',
      dueDays: treatment === 'Mitigate' || treatment === 'Avoid' ? (r.chance(0.55) ? r.int(-130, 200) : null) : null, curated: false,
    }));
  }
  return out;
}

export function riskRegister(c: CustomerProfile, tenantId: string): RiskItem[] {
  const all = riskGroup(c);
  return tenantId === 'all' ? all : all.filter((x) => x.tenant === tenantId || x.category === 'Financial' || x.category === 'Regulatory');
}

export interface OverdueItem {
  id: string;
  title: string;
  kind: 'Evidence' | 'Remediation' | 'Review' | 'Policy';
  framework: string;
  control: string;
  owner: string;
  ownerEmail: string;
  tenant: string;
  daysOverdue: number;
  sev: TaskSev;
}

const OVERDUE_TEMPLATES: Record<CustomerId, [OverdueItem['kind'], string, string][]> = {
  maritime: [
    ['Evidence', 'Quarterly vendor access review: Konecranes', 'CTL-SUP-11'], ['Evidence', 'Restore test report for TOS database', 'CTL-BKP-07'],
    ['Remediation', 'Patch GlobalProtect gateway (CVE-2024-3400)', 'CTL-VUL-08'], ['Evidence', 'USB control policy export from ECDIS stations', 'CTL-OT-03'],
    ['Review', 'Annual review of OT zone and conduit diagram', 'CTL-NET-04'], ['Policy', 'Update Cyber Risk Management section in SMS', 'CTL-OT-02'],
    ['Evidence', 'PAM session recordings sample (vendor access)', 'CTL-OT-02'], ['Remediation', 'Enrol 41 crew accounts in MFA', 'CTL-ACC-01'],
    ['Evidence', 'Log retention configuration screenshot (Sentinel)', 'CTL-LOG-06'], ['Review', 'Privileged account recertification Q3', 'CTL-PRV-09'],
  ],
  finserv: [
    ['Evidence', 'DORA ICT risk framework annual review sign-off', 'CTL-BCP-09'], ['Remediation', 'Fix BOLA on open-banking API', 'CTL-VUL-07'],
    ['Evidence', 'PCI 10.4 daily log review attestation (Sept)', 'CTL-LOG-06'], ['Review', 'SailPoint access certification: Treasury Ops', 'CTL-PAM-02'],
    ['Evidence', 'SWIFT secure zone architecture diagram v2025', 'CTL-SWF-03'], ['Policy', 'Third-party exit strategy: Temenos', 'CTL-TPR-10'],
    ['Remediation', 'Vault 14 standing Tier 0 accounts in CyberArk', 'CTL-PAM-02'], ['Evidence', 'Scenario test results vs impact tolerance', 'CTL-BCP-09'],
    ['Evidence', 'Veracode SAST policy compliance export', 'CTL-VUL-07'], ['Review', 'RACF privileged user review', 'CTL-MF-13'],
  ],
  media: [
    ['Evidence', 'TPN attestation: Red Fern Localisation', 'CTL-VEN-05'], ['Remediation', 'Fix review-link auth bypass on screeners portal', 'CTL-VUL-09'],
    ['Evidence', 'Edit-bay USB block policy export', 'CTL-DLP-04'], ['Evidence', 'Content network firewall rule review', 'CTL-NET-03'],
    ['Policy', 'Update watermarking standard for review links', 'CTL-WAT-08'], ['Evidence', 'Security awareness completion (KnowBe4 paused)', 'CTL-IAM-02'],
    ['Review', 'Vendor access recertification: Lumière VFX', 'CTL-VEN-05'], ['Evidence', 'MAM access log sample for Nightjar', 'CTL-LOG-07'],
    ['Remediation', 'Enable script integrity monitoring on checkout', 'CTL-PCI-10'], ['Evidence', 'Immutable backup restore test for masters', 'CTL-BKP-11'],
  ],
  healthcare: [
    ['Evidence', 'HIPAA risk analysis refresh sign-off (164.308(a)(1))', 'CTL-VUL-08'], ['Remediation', 'Segment 1,140 legacy infusion pumps at the community hospitals', 'CTL-MD-03'],
    ['Evidence', 'Epic downtime drill report and BCA workstation check', 'CTL-BKP-06'], ['Review', 'BAA inventory reconciliation: vendors without a signed BAA', 'CTL-TPR-10'],
    ['Evidence', 'FairWarning snooping case review log (Q3)', 'CTL-LOG-07'], ['Remediation', 'Phishing-resistant MFA for 214 reset-eligible accounts', 'CTL-HD-02'],
    ['Evidence', 'GE HealthCare remote session recordings sample', 'CTL-MD-04'], ['Policy', 'Update help-desk identity verification procedure', 'CTL-HD-02'],
    ['Evidence', 'Cohesity immutable snapshot configuration export', 'CTL-BKP-06'], ['Review', 'Privileged account recertification: Epic Chronicles DBAs', 'CTL-PRV-12'],
  ],
  automotive: [
    ['Evidence', 'TISAX prototype protection evidence: Ingolstadt pre-series hall', 'CTL-IP-06'], ['Remediation', 'Remove 3 IT-to-OT conduits bypassing the Puebla DMZ', 'CTL-OT-04'],
    ['Evidence', 'R156 SUMS: software identification records for OTA 24.9.3', 'CTL-OTA-01'], ['Evidence', 'vSOC monthly fleet monitoring report for the KBA', 'CTL-VSOC-02'],
    ['Review', 'Supplier TISAX label check: AutoVision Design Studio', 'CTL-SUP-10'], ['Evidence', 'BeyondTrust session recordings for KUKA access', 'CTL-OT-03'],
    ['Policy', 'ISO/SAE 21434 TARA update for the in-car voice assistant', 'CTL-API-11'], ['Remediation', 'Rotate OTA HSM operator credentials', 'CTL-OTA-01'],
    ['Evidence', 'Rubrik restore test: MES Ingolstadt', 'CTL-BKP-09'], ['Review', 'SAP critical-access (SoD) review Q3', 'CTL-ERP-12'],
  ],
};


export interface SoaRow {
  id: string;
  name: string;
  applicable: boolean;
  decidedBy: 'Client' | 'HexaShield override';
  justification: string;
  implemented: 'Implemented' | 'Partially' | 'Planned' | '—';
}

const ANNEX_A: [string, string][] = [
  ['A.5.7', 'Threat intelligence'], ['A.5.19', 'Information security in supplier relationships'], ['A.5.23', 'Information security for use of cloud services'],
  ['A.5.30', 'ICT readiness for business continuity'], ['A.6.3', 'Information security awareness, education and training'], ['A.7.4', 'Physical security monitoring'],
  ['A.7.10', 'Storage media'], ['A.8.5', 'Secure authentication'], ['A.8.7', 'Protection against malware'], ['A.8.8', 'Management of technical vulnerabilities'],
  ['A.8.13', 'Information backup'], ['A.8.15', 'Logging'], ['A.8.16', 'Monitoring activities'], ['A.8.22', 'Segregation of networks'],
  ['A.8.25', 'Secure development life cycle'], ['A.8.28', 'Secure coding'], ['A.8.30', 'Outsourced development'], ['A.8.31', 'Separation of development, test and production environments'],
];

const SOA_SPECIAL: Record<CustomerId, Record<string, { applicable: boolean; by: SoaRow['decidedBy']; why: string }>> = {
  maritime: {
    'A.8.28': { applicable: true, by: 'HexaShield override', why: 'Client proposed exclusion; overridden because the berth planning optimiser and crane predictive maintenance model are developed in-house.' },
    'A.8.30': { applicable: true, by: 'Client', why: 'Kongsberg and Vanderlande develop control logic deployed to vessels and AGVs.' },
    'A.7.4': { applicable: true, by: 'HexaShield override', why: 'ISPS-regulated terminals: physical monitoring is in scope for every terminal, not only HQ.' },
    'A.8.25': { applicable: false, by: 'Client', why: 'No commercial software products are developed; in-house models covered by A.8.28.' },
  },
  finserv: {
    'A.7.10': { applicable: true, by: 'HexaShield override', why: 'Client proposed exclusion (cloud-first); overridden because mainframe tape and SWIFT HSM media remain in Slough DC1.' },
    'A.8.30': { applicable: true, by: 'Client', why: 'Sopra Steria maintains the lending platform code under contract.' },
    'A.7.4': { applicable: false, by: 'Client', why: 'Physical monitoring inherited from Equinix colocation (SOC 2 report reviewed annually).' },
  },
  media: {
    'A.8.25': { applicable: true, by: 'HexaShield override', why: 'Client proposed exclusion for Studios; overridden because KestrelPlay apps and the screeners portal are built in-house.' },
    'A.7.10': { applicable: true, by: 'Client', why: 'Camera cards, shuttle drives and LTO carry pre-release content (MPA DS-11).' },
    'A.8.31': { applicable: true, by: 'HexaShield override', why: 'Screeners portal staging shared production credentials; separation required.' },
    'A.5.30': { applicable: false, by: 'Client', why: 'Covered by Live & Sports business continuity plan under DPP CtS; tracked there.' },
  },
  healthcare: {
    'A.7.10': { applicable: true, by: 'HexaShield override', why: 'Client proposed exclusion; overridden because PACS media exports and imaging CDs still carry ePHI.' },
    'A.8.30': { applicable: true, by: 'Client', why: 'Epic and Nuance build integrations under contract.' },
    'A.8.25': { applicable: false, by: 'Client', why: 'No commercial software is built; research code is covered by A.8.28 under the NIH data security plan.' },
  },
  automotive: {
    'A.7.4': { applicable: true, by: 'HexaShield override', why: 'TISAX prototype protection requires monitored pre-series halls at every plant, not only Munich.' },
    'A.8.25': { applicable: true, by: 'Client', why: 'Vehicle software and the OTA backend are developed in-house under ISO/SAE 21434.' },
    'A.7.10': { applicable: true, by: 'Client', why: 'Prototype data travels on removable media to test tracks and homologation labs.' },
    'A.8.31': { applicable: true, by: 'HexaShield override', why: 'Client proposed exclusion for plants; overridden because MES test and production share a VLAN at Puebla.' },
  },
};

const SOA_GENERIC_WHY: Record<string, string> = {
  'A.5.7': 'Sector ISAC feeds and HexaInt consumed by the SOC',
  'A.5.19': 'Material supplier dependencies across the group',
  'A.5.23': 'Production workloads on Azure, AWS and GCP',
  'A.5.30': 'Business services with defined recovery objectives',
  'A.6.3': 'All workforce including contractors',
  'A.8.5': 'All interactive and privileged access',
  'A.8.7': 'All IT endpoints and servers',
  'A.8.8': 'All internet-facing and internal assets',
  'A.8.13': 'Crown-jewel systems with recovery objectives',
  'A.8.15': 'Centralised logging required for detection and forensics',
  'A.8.16': '24/7 monitoring through HexaSOC',
  'A.8.22': 'Segregated zones incl. OT and payment environments',
  'A.8.25': 'In-house development in scope',
  'A.8.28': 'In-house code in scope',
  'A.8.30': 'Third-party development under contract',
  'A.8.31': 'Separate environments for in-house systems',
  'A.7.4': 'Monitored sites in scope',
  'A.7.10': 'Removable and archival media in use',
};

export function soaRows(c: CustomerProfile): SoaRow[] {
  const r = rng(`soa-${c.id}`);
  return ANNEX_A.map(([id, name]) => {
    const sp = SOA_SPECIAL[c.id][id];
    const applicable = sp ? sp.applicable : true;
    return {
      id, name, applicable,
      decidedBy: sp?.by ?? 'Client',
      justification: sp?.why ?? SOA_GENERIC_WHY[id] ?? 'Applicable to the ISMS scope',
      implemented: applicable ? r.weighted<SoaRow['implemented']>([['Implemented', 7], ['Partially', 3], ['Planned', 1]]) : '—',
    };
  });
}

/* =====================================================================
   Third-party risk
   ===================================================================== */
export type AssessStatus = 'Complete' | 'In progress' | 'Under review' | 'Sent' | 'Overdue' | 'Not started';
export type TpnStatus = 'Gold Shield' | 'Blue Shield' | 'Self-reported' | 'Not assessed' | 'Expired';

export interface Vendor {
  id: string;
  name: string;
  category: string;
  tier: 1 | 2 | 3;
  access: string;
  country: string;
  rating: number;
  ratingDelta: number;
  tenants: string[];
  assessment: AssessStatus;
  dueInDays: number;
  lastAssessedDays: number;
  dataAccess: string[];
  obligations: { rightToAudit: boolean; breachNotifyHrs: number; subprocessorApproval: boolean; cyberInsurance: boolean; exitPlan: boolean };
  fourthParties: string[];
  hosting?: 'Azure' | 'AWS' | 'GCP' | 'On-prem';
  highRisk: boolean;
  findings: number;
  contractEndDays: number;
  spendK: number;
  cif?: boolean;
  lei?: boolean;
  tpn?: TpnStatus;
  otRemote?: boolean;
  baa?: BaaStatus;
  tisax?: TisaxLabel;
  /** Original-style supplier score: failed checks out of 12, weighted (higher is worse). */
  gapScore: number;
  gaps: VendorGap[];
  state: 'Active' | 'Under review' | 'Pending docs' | 'Escalated' | 'Archived';
  generated: boolean;
}

export interface VendorGap { area: 'Cyber security' | 'Data privacy' | 'Business continuity' | 'Incident reporting' | 'Oversight & review'; title: string; fix: string; tasked: boolean }

const VENDOR_POOL: Record<CustomerId, { cats: [string, string, string[]][]; a: string[]; b: string[] }> = {
  maritime: {
    cats: [
      ['Marine equipment OEM', 'Remote diagnostics', ['OT']], ['Freight forwarder', 'Booking API', ['Commercial']], ['Stevedoring contractor', 'Gate & yard badges', ['Personal data']],
      ['IT managed service', 'Service desk tooling', ['Confidential']], ['Customs broker', 'Manifest exchange', ['Commercial', 'Personal data']], ['Crew agency', 'Crew HR records', ['Personal data']],
      ['Bunker supplier', 'Ordering portal', ['Commercial']], ['Engineering consultancy', 'Drawings repository', ['Confidential']], ['SaaS (HR & payroll)', 'Employee records', ['Personal data']],
      ['Telecoms carrier', 'WAN & MPLS', ['Network']], ['Security guarding', 'CCTV & access control', ['OT', 'Personal data']], ['Reefer monitoring', 'Reefer telemetry', ['OT']],
    ],
    a: ['Nordhavn', 'Meridian', 'Scaldis', 'Ostend', 'Harbourline', 'Baltic', 'Tidewater', 'Keel', 'Anchor', 'Lagoon', 'Polaris', 'Straits', 'Mersey', 'Kattegat', 'Helix', 'Brightwater', 'Pelagic', 'Coastal'],
    b: ['Marine', 'Logistics', 'Systems', 'Shipping Services', 'Engineering', 'Technical', 'Automation', 'Port Services', 'Crewing', 'Telecom'],
  },
  finserv: {
    cats: [
      ['SaaS (HR & payroll)', 'Employee records', ['Personal data']], ['Market data', 'Pricing feeds', ['Confidential']], ['KYC / AML screening', 'Customer PII API', ['Personal data']],
      ['Payment scheme', 'Scheme connectivity', ['Payments']], ['Software vendor', 'Licensed application', ['Confidential']], ['Consultancy', 'Project workspace', ['Confidential']],
      ['Print & mail', 'Customer statements', ['Personal data']], ['Collections agency', 'Debtor data', ['Personal data']], ['Cloud SaaS (CRM)', 'Client records', ['Personal data', 'Confidential']],
      ['Telecoms carrier', 'Network & voice', ['Network']], ['Card manufacturer', 'Card personalisation data', ['Payments', 'Personal data']], ['Legal services', 'Matter files', ['Confidential']],
    ],
    a: ['Lombard', 'Sterling', 'Cheapside', 'Threadneedle', 'Meridian', 'Northbridge', 'Fenchurch', 'Kingsway', 'Bishopsgate', 'Ludgate', 'Holborn', 'Aurum', 'Tavistock', 'Cornhill', 'Ashby', 'Clearwater', 'Vantage', 'Moorgate', 'Regent', 'Larkspur'],
    b: ['Data', 'Technologies', 'Partners', 'Analytics', 'Solutions', 'Services', 'Systems', 'Capital Tech', 'Consulting', 'Software', 'Payments', 'Labs'],
  },
  media: {
    cats: [
      ['VFX vendor', 'Pre-release plates', ['Pre-release']], ['Post-production facility', 'Locked cuts', ['Pre-release']], ['Localisation vendor', 'Scripts & cuts', ['Pre-release']],
      ['Marketing agency', 'Key art & trailers', ['Pre-release']], ['Equipment rental', 'Camera cards', ['Pre-release']], ['Casting service', 'Talent data', ['Personal data']],
      ['Payroll (production)', 'Crew payroll', ['Personal data']], ['Music licensing', 'Stems', ['Pre-release']], ['Streaming tech SaaS', 'Subscriber analytics', ['Personal data']],
    ],
    a: ['Lantern', 'Silverline', 'Crane Street', 'Halide', 'Northlight', 'Copperfield', 'Mirage', 'Bluebird', 'Fable', 'Kinetic'],
    b: ['Pictures', 'Post', 'Studios', 'Sound', 'Digital', 'Media', 'FX', 'Labs'],
  },
  healthcare: {
    cats: [
      ['Medical device OEM', 'Remote device service', ['Medical device']], ['Reference laboratory', 'HL7 results interface', ['PHI']], ['Revenue cycle vendor', 'Claims & remittance', ['PHI', 'Payments']],
      ['Clinical staffing agency', 'Clinician credentialing', ['Personal data']], ['Transcription service', 'Dictation audio', ['PHI']], ['Telehealth SaaS', 'Video visits', ['PHI']],
      ['Pharmacy services', 'Medication orders', ['PHI']], ['IT managed service', 'Service desk tooling', ['Confidential']], ['Facilities & medical waste', 'Badge access', ['Personal data']],
      ['Research CRO', 'Trial datasets', ['PHI']], ['Patient engagement SaaS', 'Appointment reminders', ['PHI']], ['Teleradiology group', 'Overnight reads', ['PHI']],
    ],
    a: ['Buckeye', 'Riverside', 'Summit', 'Keystone', 'Harbor', 'Lakeview', 'Cardinal', 'Prairie', 'Scioto', 'Olentangy', 'Bluegrass', 'Northfield', 'Crestview', 'Granite', 'Beacon', 'Hocking'],
    b: ['Health Services', 'Medical', 'Diagnostics', 'Clinical Systems', 'Imaging', 'Care Partners', 'Labs', 'Billing Solutions', 'Biomed', 'Staffing'],
  },
  automotive: {
    cats: [
      ['Tier 1 parts supplier', 'Engineering data exchange (OFTP2)', ['Prototype', 'Confidential']], ['Tier 2 component supplier', 'JIT call-off EDI', ['Confidential']], ['Robot & automation integrator', 'Remote cell service', ['OT']],
      ['Sequencing logistics provider', 'JIS sequencing EDI', ['Confidential']], ['Engineering service provider', 'Teamcenter workspace', ['Prototype']], ['Design agency', 'Pre-launch renders', ['Prototype']],
      ['Dealer group', 'DMS & customer data', ['Personal data']], ['Mobility SaaS', 'Connected-car app services', ['Personal data', 'Vehicle data']], ['Test & homologation lab', 'Prototype vehicles', ['Prototype']],
      ['IT managed service', 'Service desk tooling', ['Confidential']], ['Tooling maker', 'Die & mould data', ['Prototype']], ['Battery materials supplier', 'Cell spec exchange', ['Confidential']],
    ],
    a: ['Allgäu', 'Rhein', 'Donau', 'Isar', 'Neckar', 'Brenner', 'Vulkan', 'Kessel', 'Falken', 'Lech', 'Spessart', 'Taunus', 'Elbe', 'Alpen', 'Mosel', 'Weser', 'Harz', 'Ries'],
    b: ['Automotive', 'Präzision', 'Systems', 'Engineering', 'Logistik', 'Components', 'Tech', 'Werke', 'Mobility', 'Tooling'],
  },
};

const FOURTH: Record<CustomerId, string[]> = {
  maritime: ['Microsoft Azure', 'AWS', 'Siemens', 'TeamViewer', 'Inmarsat', 'Salesforce', 'Equinix', 'Cloudflare'],
  finserv: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Equinix', 'Salesforce', 'Twilio', 'Snowflake', 'Akamai', 'Okta'],
  media: ['AWS', 'Google Cloud', 'Aspera (IBM)', 'Frame.io', 'Akamai', 'Dropbox', 'Box', 'Signiant'],
  healthcare: ['Microsoft Azure', 'AWS', 'Change Healthcare', 'Twilio', 'Iron Mountain', 'Okta', 'Salesforce Health Cloud', 'Zoom for Healthcare'],
  automotive: ['AWS', 'Microsoft Azure', 'SAP', 'T-Systems', 'Siemens', 'Bosch IoT Suite', 'HERE Technologies', 'Salesforce'],
};

const COUNTRY_POOL: Record<CustomerId, string[]> = {
  maritime: ['NL', 'BE', 'GB', 'DE', 'SG', 'BR', 'MY', 'DK', 'NO', 'IN'],
  finserv: ['GB', 'GB', 'LU', 'US', 'IE', 'IN', 'DE', 'FR', 'SG', 'CA'],
  media: ['US', 'US', 'GB', 'CA', 'FR', 'IN', 'AU', 'NZ', 'ES', 'DE'],
  healthcare: ['US', 'US', 'US', 'US', 'US', 'IN', 'CA', 'PH', 'IE', 'US'],
  automotive: ['DE', 'DE', 'DE', 'AT', 'HU', 'CZ', 'MX', 'PL', 'IT', 'FR'],
};

export type BaaStatus ='Signed' | 'Missing' | 'Expired' | 'Not required';
export type TisaxLabel = 'AL3 valid' | 'AL2 valid' | 'Expiring' | 'Expired' | 'No label';

export function ratingsSource(c: CustomerProfile): { name: string; connector: boolean; status: 'healthy' | 'degraded' | 'failing' | 'paused'; lastSyncMin: number; stale: boolean } {
  const k = c.connectors.find((x) => x.category === 'Ratings');
  if (k) return { name: `${k.vendor} ${k.product}`, connector: true, status: k.status, lastSyncMin: k.lastSyncMin, stale: isStale(k) };
  return { name: 'HexaInt outside-in scan', connector: false, status: 'healthy', lastSyncMin: 180, stale: false };
}

function vendorsGroup(c: CustomerProfile): Vendor[] {
  const r = rng(`vendors-${c.id}`);
  const total = headlines(c).comply.vendors;
  const pool = VENDOR_POOL[c.id];
  const tIds = c.tenants.map((t) => t.id);
  const out: Vendor[] = [];
  const statuses: [AssessStatus, number][] = [['Complete', 52], ['In progress', 12], ['Under review', 8], ['Sent', 9], ['Overdue', 7], ['Not started', 6]];
  const mkVendor = (name: string, category: string, tier: 1 | 2 | 3, access: string, rating: number, country: string, data: string[], generated: boolean, idx: number): Vendor => {
    const assessment = r.weighted(statuses);
    const cloud = /Azure/.test(name) ? 'Azure' : /Amazon|AWS/.test(name) ? 'AWS' : undefined;
    const hosting = cloud ?? r.weighted<Vendor['hosting']>([['AWS', 4], ['Azure', 4], ['GCP', 1.5], ['On-prem', 2]]);
    const v: Vendor = {
      id: `VND-${String(1000 + idx)}`, name, category, tier, access, country, rating,
      ratingDelta: r.int(-9, 6),
      tenants: tier === 1 && !generated ? (r.chance(0.5) ? tIds : r.pickN(tIds, r.int(1, 3))) : r.pickN(tIds, r.int(1, 2)),
      assessment,
      dueInDays: assessment === 'Overdue' ? -r.int(3, 70) : assessment === 'Complete' ? r.int(60, 330) : r.int(4, 75),
      lastAssessedDays: r.int(30, 420),
      dataAccess: data,
      obligations: { rightToAudit: tier === 1 ? r.chance(0.85) : r.chance(0.5), breachNotifyHrs: r.pick([24, 24, 48, 72, 72]), subprocessorApproval: r.chance(0.7), cyberInsurance: r.chance(0.75), exitPlan: tier === 1 ? r.chance(0.8) : r.chance(0.35) },
      fourthParties: r.pickN(FOURTH[c.id], r.int(1, 4)),
      hosting,
      highRisk: false,
      findings: r.int(0, tier === 1 ? 9 : 5),
      contractEndDays: r.int(20, 900),
      spendK: tier === 1 ? r.int(400, 9000) : tier === 2 ? r.int(80, 800) : r.int(5, 120),
      gapScore: 0,
      gaps: [],
      state: 'Active',
      generated,
    };
    if (c.id === 'healthcare') v.baa = data.includes('PHI') ? r.weighted<BaaStatus>([['Signed', 14], ['Missing', 0.8], ['Expired', 0.6]]) : 'Not required';
    if (c.id === 'automotive') v.tisax = data.includes('Prototype') ? r.weighted<TisaxLabel>([['AL3 valid', 10], ['AL2 valid', 1], ['Expiring', 1.1], ['Expired', 0.4], ['No label', 0.5]]) : r.weighted<TisaxLabel>([['AL2 valid', 3], ['No label', 3], ['AL3 valid', 1], ['Expiring', 0.6]]);
    if (c.id === 'finserv') {
      v.cif = tier === 1 || (tier === 2 && r.chance(0.35));
      v.lei = r.chance(0.86);
    }
    if (c.id === 'media') v.tpn = data.includes('Pre-release') ? r.weighted<TpnStatus>([['Gold Shield', 5], ['Blue Shield', 3], ['Self-reported', 2], ['Not assessed', 1.5], ['Expired', 1]]) : r.weighted<TpnStatus>([['Not assessed', 3], ['Self-reported', 2], ['Blue Shield', 1]]);
    if (c.id === 'maritime' || c.id === 'automotive') v.otRemote = data.includes('OT');
    if (c.id === 'healthcare') v.otRemote = data.includes('Medical device');
    return v;
  };
  c.thirdParties.forEach((tp, i) => {
    const data = c.id === 'maritime'
      ? (/PLC|crane|automation|AGV|engine|cargo|VSAT|LEO|OCR/i.test(tp.access + tp.category) ? ['OT'] : ['Confidential'])
      : c.id === 'media'
        ? (/pre-release|cut|stems|plates|dailies|masters|trailer|asset|script/i.test(tp.access) ? ['Pre-release'] : /subscri|payment/i.test(tp.access) ? ['Personal data', 'Payments'] : ['Confidential'])
        : c.id === 'healthcare'
          ? (/pump|imaging|modalit|monitor|gateway|lab line|cabinet|dispens/i.test(tp.access + tp.category) ? ['Medical device', 'PHI'] : /records storage/i.test(tp.category) ? ['PHI'] : /claims|results|dictation|video|patient|billing|hosted|clarity/i.test(tp.access + tp.category) ? ['PHI'] : ['Confidential'])
          : c.id === 'automotive'
            ? (/robot|PLC|paint|MES|TIA/i.test(tp.access + tp.category) ? ['OT'] : /design|renders|ECU|engineering|cell chemistry|toolchain|firmware/i.test(tp.access + tp.category) ? ['Prototype', 'Confidential'] : /dealer|customer/i.test(tp.access) ? ['Personal data'] : ['Confidential'])
            : (/PII|customer|card|payments/i.test(tp.access) ? ['Personal data', 'Payments'] : ['Confidential']);
    out.push(mkVendor(tp.name, tp.category, tp.tier, tp.access, tp.rating, tp.country, data, false, i));
  });
  const used = new Set(out.map((v) => v.name));
  let i = out.length;
  let guard = 0;
  while (out.length < total && guard < 5000) {
    guard++;
    const name = `${r.pick(pool.a)} ${r.pick(pool.b)}`;
    if (used.has(name)) continue;
    used.add(name);
    const [cat, access, data] = r.pick(pool.cats);
    const tier = r.weighted<1 | 2 | 3>([[1, 1.2], [2, 4], [3, 6]]);
    out.push(mkVendor(name, cat, tier, access, r.int(48, 92), r.pick(COUNTRY_POOL[c.id]), data, true, i++));
  }
  // Fallback name suffixes if the pool runs dry.
  while (out.length < total) {
    const [cat, access, data] = r.pick(pool.cats);
    out.push(mkVendor(`${r.pick(pool.a)} ${r.pick(pool.b)} ${out.length}`, cat, 3, access, r.int(55, 90), 'GB', data, true, i++));
  }
  // OT vendor remote access is always highlighted for maritime.
  if (c.id === 'maritime') out.forEach((v) => { if (/Konecranes|Kongsberg/.test(v.name)) v.otRemote = true; });
  if (c.id === 'healthcare') out.forEach((v) => { if (/TeleMed/.test(v.name)) v.baa = 'Missing'; if (/Cerner Rev/.test(v.name)) v.baa = 'Expired'; if (/Epic|GE Health|Philips|BD/.test(v.name)) v.baa = 'Signed'; });
  if (c.id === 'automotive') out.forEach((v) => { if (/AutoVision/.test(v.name)) v.tisax = 'No label'; if (/CATL/.test(v.name)) v.tisax = 'Expiring'; if (/Bosch|Continental|Vector|T-Systems|Magna/.test(v.name)) v.tisax = 'AL3 valid'; });
  // High risk: worst residual (tier × rating × findings) up to the headline count.
  const nHigh = headlines(c).comply.highRiskVendors;
  const score = (v: Vendor) => (4 - v.tier) * 30 + (100 - v.rating) + v.findings * 3 + (v.assessment === 'Overdue' ? 15 : 0);
  out.slice().sort((a, b) => score(b) - score(a)).slice(0, nHigh).forEach((v) => (v.highRisk = true));
  const g = rng(`vendor-gaps-${c.id}`);
  out.forEach((v) => {
    v.gaps = vendorGaps(c, v, g);
    const w = v.gaps.length * 7 + (4 - v.tier) * 6 + Math.round((100 - v.rating) / 4) + (v.highRisk ? 10 : 0);
    v.gapScore = clamp(w, 8, 96);
    v.state = v.highRisk && v.assessment === 'Overdue' ? 'Escalated' : v.highRisk ? g.weighted([['Escalated', 1], ['Under review', 2]]) : v.assessment === 'Complete' ? g.weighted([['Active', 6], ['Under review', 1], ['Archived', 0.4]]) : v.assessment === 'Sent' || v.assessment === 'Not started' ? 'Pending docs' : 'Under review';
  });
  return out;
}

/** The twelve register checks behind a supplier's score (original HexaComply TPRM). */
function vendorGaps(c: CustomerProfile, v: Vendor, r: ReturnType<typeof rng>): VendorGap[] {
  const out: VendorGap[] = [];
  const add = (area: VendorGap['area'], title: string, fix: string) => out.push({ area, title, fix, tasked: r.chance(0.4) });
  const personal = v.dataAccess.some((d) => /Personal|PHI|Payments/.test(d));
  if (v.findings > 4 || v.rating < 64) add('Cyber security', 'No third-party certification on file', 'Request the current ISO 27001 or SOC 2 report, or record why the supplier is out of scope for one.');
  if (r.chance(v.tier === 1 ? 0.15 : 0.3)) add('Cyber security', 'Security terms in place, but no NDA', 'Add an NDA so confidentiality survives the contract ending.');
  if (c.id === 'healthcare' && (v.baa === 'Missing' || v.baa === 'Expired')) add('Data privacy', v.baa === 'Missing' ? 'PHI shared without a signed Business Associate Agreement' : 'Business Associate Agreement has expired', 'HIPAA 164.308(b) requires a BAA before ePHI is disclosed. Route the HexaShield BAA template to legal.');
  else if (personal && r.chance(0.22)) add('Data privacy', 'No processing agreement for personal data', 'They process personal data on our behalf, so a processor agreement is required before the next transfer.');
  if (!v.obligations.subprocessorApproval) add('Data privacy', 'Sub-processors can change without approval', 'Add a sub-processor notification and objection clause.');
  if (v.tier === 1 && !v.obligations.exitPlan) add('Business continuity', 'No tested exit plan for a tier-1 supplier', 'Document substitutability and an exit plan, then test it once a year.');
  if (v.highRisk && r.chance(0.6)) add('Business continuity', 'No mitigation recorded against a medium-or-higher risk', 'Note the fallback, or the compensating control we rely on.');
  if (v.obligations.breachNotifyHrs > 24) add('Incident reporting', `Breach notification window is ${v.obligations.breachNotifyHrs} h`, 'Policy requires notice within 24 hours in writing, with a named contact.');
  if (r.chance(0.18)) add('Incident reporting', 'No agreed route for reporting an incident', 'Set a named contact and a notification deadline.');
  if (v.assessment === 'Overdue') add('Oversight & review', 'Review overdue', 'The next review date has passed. Re-run the assessment before relying on the current risk level.');
  if (!v.obligations.rightToAudit) add('Oversight & review', 'No right to audit', 'Negotiate an audit clause at renewal, or rely on independent assurance reports.');
  if (v.assessment === 'Not started' || v.assessment === 'Sent') add('Oversight & review', 'Register entry not confirmed', 'The record is still a draft, so nothing in it has been signed off.');
  if (c.id === 'automotive' && v.dataAccess.includes('Prototype') && v.tisax !== 'AL3 valid') add('Cyber security', v.tisax === 'No label' ? 'Receives prototype data without a TISAX label' : `TISAX label ${v.tisax?.toLowerCase()} for prototype protection`, 'VDA ISA 8.x requires an AL3 label with prototype protection before prototype data is shared. Block OFTP2 transfers until assessed.');
  if (c.id === 'media' && v.dataAccess.includes('Pre-release') && (v.tpn === 'Not assessed' || v.tpn === 'Expired')) add('Cyber security', 'Receives pre-release content without a current TPN shield', 'Custody policy can block delivery until the vendor is assessed.');
  if (c.id === 'finserv' && v.lei === false) add('Oversight & review', 'No Legal Entity Identifier on the register', 'DORA RoI RT.05 requires an LEI for every ICT third-party provider.');
  if (v.otRemote && !v.obligations.rightToAudit) add('Cyber security', 'Remote access to OT without an audit clause', 'Sessions are brokered through PAM; add the right to audit session recordings.');
  if (!v.obligations.cyberInsurance && v.tier < 3) add('Business continuity', 'Cyber insurance not evidenced', 'Request the certificate of insurance at renewal.');
  return out.slice(0, 12);
}

export function vendors(c: CustomerProfile, tenantId: string): Vendor[] {
  const all = vendorsGroup(c);
  if (tenantId === 'all') return all;
  const n = headlines(c, tenantId).comply.vendors;
  // Keep every high-risk vendor visible at tenant scope so the headline agrees.
  const highs = all.filter((v) => v.highRisk);
  const others = [...all.filter((v) => !v.highRisk && v.tenants.includes(tenantId)), ...all.filter((v) => !v.highRisk && !v.tenants.includes(tenantId))];
  return [...highs, ...others.slice(0, Math.max(0, n - highs.length))];
}

export function doraRegister(c: CustomerProfile) {
  const vs = vendorsGroup(c);
  const cif = vs.filter((v) => v.cif);
  return {
    contracts: 214,
    ictProviders: vs.length,
    cifProviders: cif.length,
    missingLei: 31,
    exitPlansMissing: 3,
    exitPlansCritical: cif.filter((v) => v.tier === 1).length,
    subcontractingMapped: 78,
    submission: 'CSSF via ESA template (RT.01–RT.09)',
    dueInDays: 104,
    functions: [
      { name: 'Retail payments (Faster Payments)', providers: 9, critical: true },
      { name: 'Card acquiring', providers: 7, critical: true },
      { name: 'Core banking (T24)', providers: 6, critical: true },
      { name: 'Online & mobile banking', providers: 11, critical: true },
      { name: 'Treasury & liquidity', providers: 4, critical: false },
      { name: 'Wealth onboarding', providers: 5, critical: false },
    ],
  };
}

/* =====================================================================
   AI governance (GRC side)
   ===================================================================== */
export type EuAiClass = 'Prohibited' | 'High' | 'Limited' | 'Minimal';
export interface AiSystemGov {
  id: string;
  name: string;
  source: 'In-house' | 'Vendor' | 'SaaS' | 'Unsanctioned';
  role: 'Provider' | 'Deployer';
  euClass: EuAiClass;
  basis: string;
  obligations: string[];
  owner: string;
  approval: 'Approved' | 'Conditional' | 'Pending' | 'Rejected' | 'Not submitted';
  impact: 'Complete' | 'In progress' | 'Not started' | 'Not required';
  modelCard: 'Published' | 'Draft' | 'Missing' | 'Vendor-supplied';
  iso42001: number;
  risk: Severity;
  tenant: string;
  users: number;
  lastReviewDays: number;
  dataTypes: string[];
}

const OBLIGATIONS: Record<EuAiClass, string[]> = {
  Prohibited: ['Art. 5: may not be placed on the market or used'],
  High: ['Art. 9 risk management system', 'Art. 10 data governance', 'Art. 12 record keeping', 'Art. 14 human oversight', 'Art. 15 accuracy & robustness', 'Art. 26 deployer duties / FRIA (Art. 27)'],
  Limited: ['Art. 50 transparency to users', 'Mark synthetic content', 'Art. 4 AI literacy'],
  Minimal: ['Art. 4 AI literacy', 'Voluntary codes of conduct'],
};

function classify(name: string): { cls: EuAiClass; basis: string; source: AiSystemGov['source']; role: AiSystemGov['role'] } {
  const src: AiSystemGov['source'] = /unsanctioned/i.test(name) ? 'Unsanctioned' : /in-house/i.test(name) ? 'In-house' : /vendor|Red Fern/i.test(name) ? 'Vendor' : 'SaaS';
  const role: AiSystemGov['role'] = src === 'In-house' ? 'Provider' : 'Deployer';
  if (/sepsis/i.test(name)) return { cls: 'High', basis: 'Annex I: clinical decision support that is medical-device software (MDR / FDA CDS guidance)', source: src, role };
  if (/radiology/i.test(name)) return { cls: 'High', basis: 'Annex I: AI in a medical device (MDR Class IIa); vendor CE- and FDA 510(k)-cleared', source: src, role };
  if (/prior-auth/i.test(name)) return { cls: 'High', basis: 'Annex III 5(a): access to essential healthcare services and benefits', source: src, role };
  if (/DAX|ambient/i.test(name)) return { cls: 'Limited', basis: 'Art. 50: drafts clinical notes from recorded consultations; clinician sign-off required', source: src, role };
  if (/in-car|voice assistant/i.test(name)) return { cls: 'Limited', basis: 'Art. 50(1): interacts with drivers; vehicle type approval (R155) also applies', source: src, role };
  if (/quality inspection/i.test(name)) return { cls: 'Minimal', basis: 'Industrial visual inspection; no Annex III use case', source: src, role };
  if (/genomics|research LLM/i.test(name)) return { cls: 'Minimal', basis: 'Scientific research use (Art. 2(6)); IRB and NIH data security still apply', source: src, role };
  if (/supplier risk/i.test(name)) return { cls: 'Minimal', basis: 'Scores companies, not natural persons; no Annex III use case', source: src, role };
  if (/generative design/i.test(name)) return { cls: 'Minimal', basis: 'Engineering design assistance; outputs reviewed by engineers', source: src, role };
  if (/credit/i.test(name)) return { cls: 'High', basis: 'Annex III 5(b): creditworthiness of natural persons', source: src, role };
  if (/predictive maintenance/i.test(name)) return { cls: 'High', basis: 'Annex I: safety component of machinery (Reg. 2023/1230)', source: src, role };
  if (/chatbot|client service/i.test(name)) return { cls: 'Limited', basis: 'Art. 50(1): interacts directly with customers', source: src, role };
  if (/voice|ElevenLabs|dubbing/i.test(name)) return { cls: 'Limited', basis: 'Art. 50(4): synthetic audio of real people (deep fake)', source: src, role };
  if (/Midjourney|Runway|previs/i.test(name)) return { cls: 'Limited', basis: 'Art. 50(2): generated images and video must be marked', source: src, role };
  if (/fraud/i.test(name)) return { cls: 'Minimal', basis: 'Annex III 5(b) carve-out: fraud detection', source: src, role };
  if (/AML/i.test(name)) return { cls: 'Minimal', basis: 'Not listed in Annex III; covered by PRA SS1/23 model risk', source: src, role };
  if (/OCR|vision/i.test(name)) return { cls: 'Minimal', basis: 'Licence plate and container code reading; no biometric use', source: src, role };
  if (/Copilot|Gemini|ChatGPT|Claude|DeepSeek/i.test(name)) return { cls: 'Minimal', basis: 'General-purpose AI used as a deployer; Art. 4 literacy applies', source: src, role };
  return { cls: 'Minimal', basis: 'Internal optimisation; no Annex III use case', source: src, role };
}

const PROHIBITED_INTAKE: Record<CustomerId, string> = {
  maritime: 'Crane cab operator emotion detection (intake)',
  finserv: 'Contact-centre agent emotion analytics (intake)',
  media: 'Edit-bay staff emotion monitoring (intake)',
  healthcare: 'Nurse fatigue emotion detection on ward cameras (intake)',
  automotive: 'Line-worker emotion monitoring on assembly cameras (intake)',
};

export function aiRegister(c: CustomerProfile, tenantId: string): AiSystemGov[] {
  const r = rng(`aigov-${c.id}`);
  const owners = [c.people.ciso.name, c.people.grcLead.name, c.people.admin.name, ...c.people.staff.slice(0, 4).map((p) => p.name)];
  const tIds = c.tenants.map((t) => t.id);
  const list: AiSystemGov[] = c.vocab.aiSystems.map((name, i) => {
    const k = classify(name);
    const unsanctioned = k.source === 'Unsanctioned';
    const approval: AiSystemGov['approval'] = unsanctioned ? 'Not submitted' : k.cls === 'High' ? r.pick(['Conditional', 'Pending'] as const) : r.weighted<AiSystemGov['approval']>([['Approved', 6], ['Conditional', 2], ['Pending', 1.5]]);
    return {
      id: `AI-${String(i + 1).padStart(3, '0')}`,
      name, source: k.source, role: k.role, euClass: k.cls, basis: k.basis, obligations: OBLIGATIONS[k.cls],
      owner: unsanctioned ? 'Unassigned' : r.pick(owners), approval,
      impact: unsanctioned ? 'Not started' : k.cls === 'High' ? r.pick(['Complete', 'In progress'] as const) : k.cls === 'Limited' ? r.pick(['Complete', 'In progress', 'Not started'] as const) : r.pick(['Complete', 'Not required', 'Not required'] as const),
      modelCard: k.source === 'In-house' ? r.pick(['Published', 'Draft'] as const) : unsanctioned ? 'Missing' : r.pick(['Vendor-supplied', 'Vendor-supplied', 'Missing'] as const),
      iso42001: unsanctioned ? r.int(5, 20) : r.int(45, 92),
      risk: unsanctioned ? 'high' : k.cls === 'High' ? 'high' : k.cls === 'Limited' ? 'medium' : 'low',
      tenant: r.pick(tIds),
      users: unsanctioned ? r.int(3, 140) : r.int(12, 4200),
      lastReviewDays: r.int(4, 160),
      dataTypes: r.pickN(['Personal data', 'Confidential', 'Operational telemetry', 'Customer data', 'Source code', 'Images / video', 'Audio'], r.int(1, 3)),
    };
  });
  list.push({
    id: 'AI-INT-01', name: PROHIBITED_INTAKE[c.id], source: 'Vendor', role: 'Deployer', euClass: 'Prohibited',
    basis: 'Art. 5(1)(f): emotion recognition in the workplace', obligations: OBLIGATIONS.Prohibited, owner: c.people.grcLead.name,
    approval: 'Rejected', impact: 'Complete', modelCard: 'Missing', iso42001: 0, risk: 'critical', tenant: tIds[0], users: 0, lastReviewDays: 63, dataTypes: ['Biometric', 'Personal data'],
  });
  return tenantId === 'all' ? list : list.filter((s) => s.tenant === tenantId || s.source === 'SaaS' || s.euClass === 'Prohibited');
}

export const ISO42001_GROUPS = [
  ['A.2', 'Policies related to AI', 4], ['A.3', 'Internal organisation', 3], ['A.4', 'Resources for AI systems', 6],
  ['A.5', 'Assessing impacts of AI systems', 5], ['A.6', 'AI system life cycle', 9], ['A.7', 'Data for AI systems', 5],
  ['A.8', 'Information for interested parties', 4], ['A.9', 'Use of AI systems', 3], ['A.10', 'Third-party and customer relationships', 3],
] as const;

export function iso42001Progress(c: CustomerProfile, tenantId: string) {
  const r = rng(`42001-${c.id}-${tenantId}`);
  const base = c.scores.ai + tenantDelta(c, tenantId) * 0.5;
  return ISO42001_GROUPS.map(([id, name, total]) => {
    const pct = clamp(base + r.float(-22, 14)) / 100;
    const implemented = Math.round(total * pct);
    const partial = Math.min(total - implemented, r.int(0, 2));
    return { id, name, total, implemented, partial, missing: total - implemented - partial };
  });
}

export function nistAiRmf(c: CustomerProfile, tenantId: string) {
  const r = rng(`rmf-${c.id}-${tenantId}`);
  const base = c.scores.ai / 20;
  return (['Govern', 'Map', 'Measure', 'Manage'] as const).map((fn) => ({
    fn,
    current: Math.round(clamp(base + r.float(-0.9, 0.5), 1, 5) * 10) / 10,
    target: fn === 'Govern' ? 4.5 : 4,
  }));
}

export function aiPolicyAck(c: CustomerProfile, tenantId: string) {
  const r = rng(`ack-${c.id}`);
  return scopedTenants(c, tenantId).map((t) => ({ tenant: t, pct: Math.round(clamp(t.ri + r.int(-6, 12), 40, 99)), people: t.people }));
}

/* =====================================================================
   Board view
   ===================================================================== */
export interface Citation {
  id: string;
  kind: string;
  label: string;
  source: string;
  rows: [string, string][];
  path?: string;
}
export interface BoardRisk {
  text: string;
  sev: Severity;
  tenants: string[];
  cites: Citation[];
}

export function boardRisks(c: CustomerProfile, tenantId: string): BoardRisk[] {
  const h = headlines(c);
  const fw = (id: string) => c.frameworks.find((f) => f.id === id);
  const fwCite = (id: string): Citation => {
    const f = fw(id)!;
    return { id: `FW-${f.id.toUpperCase()}`, kind: 'Framework', label: f.short, source: 'HexaComply', rows: [['Framework', f.name], ['Documented', `${f.documented}%`], ['Assured', `${f.assured}%`], ['Owner', f.owner], ['Next audit', f.nextAudit ?? '—']], path: '/comply/caas' };
  };
  const vendorCite = (name: string): Citation => {
    const v = c.thirdParties.find((x) => x.name.startsWith(name))!;
    return { id: `VND-${v.name.split(' ')[0].toUpperCase()}`, kind: 'Vendor', label: v.name, source: 'HexaComply TPRM', rows: [['Category', v.category], ['Tier', String(v.tier)], ['Access', v.access], ['Outside-in rating', String(v.rating)], ['Country', v.country]], path: '/comply/tprm' };
  };
  const connCite = (id: string): Citation => {
    const k = c.connectors.find((x) => x.id === id)!;
    return { id: k.id.toUpperCase(), kind: 'Connector', label: `${k.vendor} ${k.product}`, source: 'HexaCore integrations', rows: [['Status', k.status], ['Last sync', `${k.lastSyncMin} min ago`], ['Expected interval', `${k.intervalMin} min`], ['Note', k.note ?? '—']], path: '/fabric/integrations' };
  };
  const cveCite = (id: string, host: string): Citation => {
    const v = CVES.find((x) => x.id === id)!;
    return { id: v.id, kind: 'Vulnerability', label: v.id, source: 'Tenable / Qualys · CISA KEV', rows: [['Product', v.product], ['Title', v.title], ['CVSS', String(v.cvss)], ['KEV listed', v.kev ? 'Yes' : 'No'], ['EPSS', v.epss.toFixed(2)], ['Asset', host]], path: '/fabric/exposure' };
  };
  const loopCite = (ctl: string, n: number, fwk: string): Citation => ({ id: `LOOPS-${ctl}`, kind: 'Loop set', label: `${n} loops · ${ctl}`, source: 'HexaView closed loop', rows: [['Control', ctl], ['Framework', fwk], ['Partial loops', String(n)], ['Missing link', 'Detection staged, validation pending']], path: '/loop' });
  const tenantCite = (id: string): Citation => {
    const t = c.tenants.find((x) => x.id === id)!;
    const dp = c.dataPlanes.find((d) => d.id === t.dataPlaneId);
    return { id: `TEN-${t.id.toUpperCase()}`, kind: 'Tenant', label: `${t.short} · RI ${t.ri}`, source: 'HexaView', rows: [['Tenant', t.name], ['Resilience Index', String(t.ri)], ['Data plane', dp ? `${dp.name} (${dp.status})` : '—'], ['Regimes', t.regimes.join(', ')]], path: '/' };
  };
  const incCite = (title: string, tenant: string, path: string): Citation => ({ id: `INC-${tenant.toUpperCase()}`, kind: 'Incident', label: title, source: 'HexaSOC', rows: [['Title', title], ['Tenant', c.tenants.find((t) => t.id === tenant)?.name ?? tenant], ['Status', 'Contained, under investigation']], path });

  const map: Record<CustomerId, () => BoardRisk[]> = {
    maritime: () => [
      { sev: 'high', tenants: ['fleet', 'rtm', 'ant'], text: `Vessel and crane remote access is documented but not yet proven: 9 loops on IACS E26 controls are partial because the new detections are staged but not validated.`, cites: [loopCite('CTL-OT-02', 9, 'IACS UR E26 4.2.2'), fwCite('iacs'), vendorCite('Konecranes')] },
      { sev: 'high', tenants: ['sts', 'pkl'], text: `Two internet-facing terminal gateways carry vulnerabilities that criminals are actively exploiting; Santos has 3 days left in its patch window.`, cites: [cveCite('CVE-2024-3400', 'STS GlobalProtect gateway'), tenantCite('sts')] },
      { sev: 'high', tenants: ['pkl'], text: `Port Klang is the weakest terminal (Resilience Index 72): an engineering workstation was hands-on-keyboard compromised and its monitoring agent is a version behind.`, cites: [tenantCite('pkl'), incCite('Hands-on-keyboard activity on PKL-ENG-WS03', 'pkl', '/soc/ir')] },
      { sev: 'medium', tenants: ['rtm', 'fleet'], text: `${h.comply.highRiskVendors} suppliers are rated high risk; OT vendors with remote access (Konecranes, Kongsberg) score lowest outside-in.`, cites: [vendorCite('Konecranes'), vendorCite('Kongsberg')] },
      { sev: 'medium', tenants: ['hq', 'rtm', 'ant'], text: `Backup evidence for the terminal operating system is stale because the Veeam integration broke after an upgrade, weakening our ransomware recovery claim.`, cites: [connCite('c-veeam'), fwCite('iso27001')] },
    ],
    finserv: () => [
      { sev: 'high', tenants: ['ukbank'], text: `Help-desk social engineering remains our most likely route to a serious breach: 14 standing Tier 0 admin accounts are not yet vaulted, and an MFA-fatigue attempt reached Treasury Operations this week.`, cites: [incCite('MFA fatigue then Okta session from new ASN', 'ukbank', '/soc/ir'), connCite('c-cyberark')] },
      { sev: 'high', tenants: ['ukbank'], text: `A critical flaw in the open-banking API (customer accounts reachable by ID manipulation) must be fixed before the PCI assessor arrives in December.`, cites: [{ id: 'PT-2026-031', kind: 'Finding', label: 'PT-2026-031 BOLA', source: 'HexaStrike', rows: [['Severity', 'Critical'], ['Asset', 'openbanking.aldersgate.co.uk'], ['Found', 'Pen test, 12 days ago'], ['Owner', c.people.ciso.name]], path: '/strike/pentest' }, fwCite('pci')] },
      { sev: 'high', tenants: ['eu'], text: `Our DORA Register of Information is incomplete: 31 ICT contracts lack a Legal Entity Identifier and 3 critical providers have no tested exit plan, ahead of the CSSF submission in January.`, cites: [fwCite('dora'), vendorCite('Temenos'), vendorCite('Microsoft Azure')] },
      { sev: 'medium', tenants: ['pay'], text: `Payments (Resilience Index 76) lags the group; application security evidence for PCI 6.2 is going stale because the Veracode feed is rate limited.`, cites: [tenantCite('pay'), connCite('c-veracode')] },
      { sev: 'medium', tenants: ['ukbank', 'eu', 'markets'], text: `${h.comply.highRiskVendors} third parties are rated high risk, led by outsourced operations at Infosys BPM with 1,100 named users on our systems.`, cites: [vendorCite('Infosys'), connCite('c-bitsight')] },
    ],
    media: () => [
      { sev: 'critical', tenants: ['post', 'studios'], text: `Pre-release content is leaking through the vendor chain: a Nightjar cut was copied to personal cloud this week and Long Tide stills traced to Red Fern Localisation appeared on a leak forum.`, cites: [{ id: 'CUS-NIGHTJAR', kind: 'Custody event', label: 'Nightjar locked cut v14', source: 'HexaCustody', rows: [['Event', 'Copy to personal cloud'], ['Who', 'Freelance colourist, Soho bay 4'], ['Action', 'Session revoked, watermark traced']], path: '/custody/revocation' }, vendorCite('Red Fern')] },
      { sev: 'high', tenants: ['studios'], text: `The screeners portal has 3 critical flaws, including a way to open review links without signing in.`, cites: [{ id: 'PT-SCR-03', kind: 'Finding', label: '3 critical · screeners portal', source: 'HexaStrike', rows: [['Asset', 'screeners.kestrelpictures.com'], ['Issues', 'Auth bypass, IDOR, outdated Next.js'], ['Owner', c.people.ciso.name]], path: '/strike/pentest' }, fwCite('mpa')] },
      { sev: 'high', tenants: ['post'], text: `TPN re-assessment is 41 days away with ${h.comply.overdueTasks} compliance tasks overdue and vendor attestations missing for 6 tier-1 vendors.`, cites: [fwCite('tpn'), vendorCite('Lumière')] },
      { sev: 'medium', tenants: ['studios'], text: `Unsanctioned AI voice cloning (ElevenLabs) has been used on talent audio, creating likeness-rights exposure.`, cites: [{ id: 'AI-ELEVEN', kind: 'AI system', label: 'ElevenLabs voice (unsanctioned)', source: 'HexaAI discovery · Netskope', rows: [['Users', '3 in Marketing'], ['EU AI Act', 'Limited risk, Art. 50(4)'], ['Status', 'Not submitted for approval']], path: '/comply/aigov' }] },
      { sev: 'medium', tenants: ['post'], text: `Kestrel Post & VFX (Resilience Index 71) is the weakest business unit; security awareness evidence is stale because the KnowBe4 feed is paused.`, cites: [tenantCite('post'), connCite('c-knowbe4')] },
    ],
    healthcare: () => [
      { sev: 'critical', tenants: ['mrmc', 'kids', 'community'], text: `A ransomware attack would force Epic into downtime across all five hospitals. Backups are immutable, but our last full downtime drill ran 7 hours against a 4-hour target, and 12 loops on remote-access and MFA controls are still unproven.`, cites: [loopCite('CTL-IAM-01', 12, 'HPH CPG 1.5 · HIPAA 164.312(d)'), connCite('c-cohesity'), fwCite('cpg')] },
      { sev: 'high', tenants: ['community'], text: `1,140 legacy infusion pumps and imaging workstations at the community hospitals still sit on a flat clinical network, and the monitoring feed from Marion is delayed.`, cites: [tenantCite('community'), connCite('c-hexaot'), fwCite('fda')] },
      { sev: 'high', tenants: ['mrmc', 'clinics'], text: `Help-desk impersonation is the attack route most used against US hospitals this year: 214 accounts can still have MFA reset by phone without stronger identity checks.`, cites: [{ id: 'CTL-HD-02', kind: 'Control', label: 'CTL-HD-02 help-desk verification', source: 'HexaComply', rows: [['Requirement', 'HPH CPG 1.6 · NIST CSF PR.AA-02'], ['Status', 'Partially implemented'], ['Accounts exposed', '214'], ['Owner', c.people.grcLead.name]], path: '/comply/caas' }, cveCite('CVE-2023-4966', 'citrix.mercyridgehealth.org')] },
      { sev: 'medium', tenants: ['clinics', 'mrmc'], text: `${h.comply.highRiskVendors} suppliers are high risk; two that handle patient data (TeleMed Partners and Cerner Rev Cycle Outsourcing) have no valid Business Associate Agreement on file.`, cites: [vendorCite('TeleMed'), vendorCite('Cerner Rev'), fwCite('hipaa')] },
      { sev: 'medium', tenants: ['mrmc', 'kids'], text: `Evidence that access to patient records is reviewed is going stale because the nightly Epic audit extract has been late since the upgrade.`, cites: [connCite('c-epic'), fwCite('hitrust')] },
    ],
    automotive: () => [
      { sev: 'critical', tenants: ['ingolstadt', 'puebla', 'gyor'], text: `A ransomware attack on plant IT would stop the lines within hours because parts arrive just in time and in sequence. Puebla still has 3 network routes from office IT into the plant that bypass the security zone.`, cites: [tenantCite('puebla'), connCite('c-armis'), fwCite('iec62443')] },
      { sev: 'high', tenants: ['connected'], text: `The keys that sign over-the-air updates for 2.1 million vehicles are well protected, but an HSM operator credential appeared in a supplier's stealer log and must be rotated before the R156 audit.`, cites: [fwCite('r156'), { id: 'EXP-OTA-HSM', kind: 'Exposure', label: 'HSM operator credential in stealer log', source: 'HexaInt', rows: [['Asset', 'VMG-OTA-SIGN01'], ['Found', 'Supplier stealer log, 6 days ago'], ['Action', 'Rotation scheduled, dual control'], ['Owner', c.people.staff[2].name]], path: '/int/exposure' }] },
      { sev: 'high', tenants: ['ingolstadt'], text: `Robot and paint-shop vendors reach production cells remotely; 10 loops on vendor-access controls are documented but not yet proven by a simulated attack.`, cites: [loopCite('CTL-OT-03', 10, 'IEC 62443 SR 1.13 · TISAX 4.1.3'), vendorCite('KUKA'), connCite('c-beyondtrust')] },
      { sev: 'medium', tenants: ['group'], text: `TISAX AL3 renewal is in February; one design agency (AutoVision) still receives pre-launch renders without a TISAX label.`, cites: [fwCite('tisax'), vendorCite('AutoVision')] },
      { sev: 'medium', tenants: ['group', 'retail'], text: `${h.comply.highRiskVendors} suppliers are high risk, led by the dealer management SaaS that holds data for 1,140 dealers; supplier-master monitoring in SAP is degraded.`, cites: [vendorCite('DealerCore'), connCite('c-sap')] },
    ],
  };
  const all = map[c.id]();
  if (tenantId === 'all') return all;
  const mine = all.filter((x) => x.tenants.includes(tenantId));
  return [...mine, ...all.filter((x) => !x.tenants.includes(tenantId))].slice(0, 5);
}

export function quarterCompare(c: CustomerProfile, tenantId: string) {
  const trend = riTrend(c, tenantId);
  const h = headlines(c, tenantId);
  const ls = loopSummary(loops(c, tenantId));
  const r = rng(`qoq-${c.id}-${tenantId}`);
  const row = (label: string, now: number, prev: number, unit: string, higherIsBetter: boolean, dp = 0) => ({ label, now, prev, unit, higherIsBetter, dp });
  return [
    row('Resilience Index', trend[11], trend[8], '', true),
    row('Assured coverage (loops closed)', ls.assuredPct, ls.assuredPct - r.int(4, 9), '%', true),
    row('Controls met', h.comply.controlsMetPct, h.comply.controlsMetPct - r.int(2, 5), '%', true),
    row('Median time to contain', h.soc.mttrMin, h.soc.mttrMin + r.int(6, 17), ' min', false),
    row('Critical and high incidents open', h.soc.critical + h.soc.high, h.soc.critical + h.soc.high + r.int(-1, 4), '', false),
    row('Critical pen-test findings open', h.strike.criticalFindings, h.strike.criticalFindings + r.int(0, 3), '', false),
    row('Compliance tasks overdue', h.comply.overdueTasks, h.comply.overdueTasks + r.int(-4, 9), '', false),
    row('High-risk suppliers', h.comply.highRiskVendors, h.comply.highRiskVendors + r.int(-2, 3), '', false),
    row('ATT&CK coverage of priority techniques', h.soc.attackCoveragePct, h.soc.attackCoveragePct - r.int(2, 6), '%', true),
  ];
}

export function boardSummary(c: CustomerProfile, tenantId: string) {
  const ri = resilienceIndex(c, tenantId);
  const trend = riTrend(c, tenantId);
  const risks = boardRisks(c, tenantId);
  const h = headlines(c, tenantId);
  const ls = loopSummary(loops(c, tenantId));
  const scope = tenantId === 'all' ? c.name : c.tenants.find((t) => t.id === tenantId)?.name ?? c.name;
  const paragraphs: { text: string; cites: Citation[] }[] = [
    { text: `${scope}'s Resilience Index is ${ri.value}, up ${trend[11] - trend[8]} points this quarter and ${trend[11] - trend[0]} over twelve months. ${ls.closed} of ${ls.applicable} control loops are proven end to end (${ls.assuredPct}% assured).`, cites: [{ id: 'RI', kind: 'Index', label: `RI ${ri.value}`, source: 'HexaView ri-v1.2', rows: ri.components.map((x) => [x.label, `${x.score} × ${x.weight} = ${x.contribution.toFixed(1)}`] as [string, string]) }] },
    { text: `The three main risks are: ${risks.slice(0, 3).map((x, i) => `(${i + 1}) ${x.text.split(/[:;]/)[0].replace(/\.$/, '')}`).join('; ')}.`, cites: risks.slice(0, 3).flatMap((x) => x.cites.slice(0, 1)) },
    { text: `Expected annual cyber loss is modelled at ${h.insurance.expectedLossM}M with a 1-in-100-year loss of ${h.insurance.tailLossM}M against a ${c.insurance.limitM}M policy limit (${c.insurance.carrier}).`, cites: [{ id: 'CRQ', kind: 'Quantification', label: 'Loss model', source: 'HexaView insurance readiness', rows: [['Expected annual loss', `${h.insurance.expectedLossM}M`], ['1-in-100 loss', `${h.insurance.tailLossM}M`], ['Policy limit', `${c.insurance.limitM}M`], ['Broker', c.insurance.broker]] }] },
    { text: `Management asks the board to note the position and endorse the top three improvement actions, which together would add about ${riDriverGain(c)} points to the Index.`, cites: [] },
  ];
  return { preparedFor: c.people.board, approver: c.people.ciso, reviewer: c.people.grcLead, paragraphs };
}

function riDriverGain(c: CustomerProfile): string {
  const map: Record<CustomerId, string> = { maritime: '4.9', finserv: '4.3', media: '5.6', healthcare: '5.4', automotive: '4.9' };
  return map[c.id];
}

/* =====================================================================
   Closed loop helpers
   ===================================================================== */
export function siemFor(c: CustomerProfile) {
  const k = c.connectors.find((x) => x.category === 'SIEM')!;
  const lang = /Sentinel/.test(k.product) ? 'KQL' : /Splunk/.test(k.vendor) ? 'SPL' : /QRadar/.test(k.product) ? 'AQL' : 'YARA-L 2.0';
  const name = k.vendor === 'Generic' ? k.product : `${k.vendor} ${k.product}`;
  const short = k.product.includes('Chronicle') ? 'Google SecOps' : k.vendor === 'Splunk' ? 'Splunk ES' : /QRadar/.test(k.product) ? 'QRadar' : k.product;
  return { name, short, lang, connector: k };
}

export interface RuleSuggestion {
  id: string;
  name: string;
  lang: string;
  query: string;
  source: string;
  fidelity: 'High' | 'Medium';
  fpPerWeek: number;
  coverage: string;
  dataSources: string[];
}

export function ruleSuggestions(c: CustomerProfile, technique: string, techniqueName: string): RuleSuggestion[] {
  const s = siemFor(c);
  const r = rng(`rules-${c.id}-${technique}`);
  const slug = techniqueName.replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '');
  const q = (variant: number) => {
    if (s.lang === 'KQL') return variant === 0
      ? `SigninLogs\n| where ResultType == 0\n| join kind=inner (AuditLogs) on CorrelationId\n| where TechniqueHint == "${technique}"\n| summarize count() by UserPrincipalName, IPAddress, bin(TimeGenerated, 15m)`
      : variant === 1 ? `DeviceProcessEvents\n| where ProcessCommandLine has_any (dynamic(["${technique}"]))\n| extend HV_Technique = "${technique}"` : `CommonSecurityLog\n| where DeviceVendor == "Palo Alto Networks"\n| where Activity has "${slug}"`;
    if (s.lang === 'SPL') return variant === 0
      ? `| tstats summariesonly=t count from datamodel=Authentication where Authentication.action=success by Authentication.user, Authentication.src\n| \`hv_${technique.replace('.', '_')}_filter\``
      : variant === 1 ? `index=edr sourcetype=crowdstrike:event technique="${technique}"\n| stats count by ComputerName, UserName` : `index=proxy sourcetype=zscaler:web\n| search tag="${slug}" | stats dc(url) by user`;
    if (s.lang === 'AQL') return variant === 0
      ? `SELECT username, sourceip, COUNT(*) AS hits\nFROM events\nWHERE QIDNAME(qid) ILIKE '%logon success%'\n  AND "HV Technique" = '${technique}'\nGROUP BY username, sourceip\nLAST 15 MINUTES`
      : variant === 1 ? `SELECT hostname, username, "Process CommandLine"\nFROM events\nWHERE LOGSOURCETYPENAME(devicetype) = 'Microsoft Defender XDR'\n  AND "Process CommandLine" ILIKE '%${technique}%'\nLAST 1 HOURS` : `SELECT sourceip, destinationip, COUNT(*)\nFROM flows\nWHERE APPLICATIONNAME(applicationid) ILIKE '%${slug}%'\nGROUP BY sourceip, destinationip LAST 1 HOURS`;
    return variant === 0
      ? `rule hv_${technique.replace('.', '_').toLowerCase()} {\n  meta: technique = "${technique}"\n  events: $e.metadata.event_type = "USER_LOGIN"\n  condition: $e\n}`
      : variant === 1 ? `rule hv_${slug.toLowerCase()}_edr {\n  events: $e.principal.process.command_line = /${technique}/\n  condition: $e\n}` : `rule hv_${slug.toLowerCase()}_netskope {\n  events: $e.metadata.product_name = "Netskope"\n  condition: $e\n}`;
  };
  return [
    { id: `HV-${technique}-01`, name: `${techniqueName}: behavioural correlation`, source: 'HexaShield detection library', fidelity: 'High', fpPerWeek: r.int(0, 2), coverage: 'Full technique', dataSources: ['Identity sign-ins', 'Audit logs'] },
    { id: `SIGMA-${r.hex(6)}`, name: `${techniqueName} (Sigma, converted)`, source: 'Sigma community · reviewed by HexaSOC', fidelity: 'Medium', fpPerWeek: r.int(2, 8), coverage: 'Common procedures', dataSources: ['EDR process events'] },
    { id: `${s.short.replace(/\s/g, '')}-CH-${r.int(100, 999)}`, name: `${s.short} content hub: ${techniqueName.toLowerCase()}`, source: `${s.short} vendor content`, fidelity: 'Medium', fpPerWeek: r.int(3, 12), coverage: 'Single procedure', dataSources: ['Network / proxy logs'] },
  ].map((x, i) => ({ ...x, lang: s.lang, query: q(i) })) as RuleSuggestion[];
}

export interface LoopTransition {
  minAgo: number;
  loopId: string;
  control: string;
  technique: string;
  tenant: string;
  from: Loop['status'];
  to: Loop['status'];
  actor: string;
  reason: string;
  auditId: string;
}

export function loopTransitions(c: CustomerProfile, tenantId: string, days: number): LoopTransition[] {
  const ls = loops(c, tenantId);
  const r = rng(`lt-${c.id}-${tenantId}`);
  const n = Math.min(40, Math.max(6, Math.round(days * 1.6)));
  const reasons: [Loop['status'], Loop['status'], string, string][] = [
    ['partial', 'closed', 'HexaStrike validation passed, detection fired', 'HexaStrike'],
    ['closed', 'stale', 'Evidence older than 90-day freshness window', 'Loop engine'],
    ['stale', 'closed', 'Evidence refreshed from connector snapshot', 'HexaComply'],
    ['closed', 'broken', 'Detection disabled in SIEM', 'Loop engine'],
    ['broken', 'closed', 'Rule re-enabled after approved action', c.people.socLead.name],
    ['partial', 'partial', 'Detection deployed, validation scheduled', c.people.socLead.name],
    ['closed', 'stale', 'Validation older than 90 days', 'Loop engine'],
  ];
  const out: LoopTransition[] = [];
  for (let i = 0; i < n; i++) {
    const l = r.pick(ls);
    const [from, to, reason, actor] = r.pick(reasons);
    out.push({ minAgo: Math.round(((i + r.float(0.1, 0.9)) / n) * days * 1440), loopId: l.id, control: l.controlId, technique: l.technique, tenant: l.tenantId, from, to, reason, actor, auditId: `AUD-${r.hex(8)}` });
  }
  return out;
}

export function loopSources(c: CustomerProfile, tenantId: string) {
  const ks = scopedConnectors(c, tenantId).filter((k) => ['SIEM', 'EDR / XDR', 'GRC', 'Validation'].includes(k.category));
  return ks.map((k) => ({ name: k.product, status: k.status, stale: isStale(k), lastSyncMin: k.lastSyncMin }));
}

/* =====================================================================
   Compliance chain (original HexaComply registers):
   frameworks → requirements → controls → tasks → evidence.
   Control statuses agree with frameworkStatus(); overdue tasks agree with
   headlines().comply.overdueTasks; evidence states agree with evidencePipeline().
   ===================================================================== */
export type DomainId = 'gov' | 'asset' | 'people' | 'physical' | 'access' | 'ops' | 'network' | 'dev' | 'supplier' | 'incident' | 'bc' | 'privacy' | 'ot';
export const DOMAINS: Record<DomainId, { label: string; topics: string[] }> = {
  gov: { label: 'Governance & risk', topics: ['Information security policy', 'Roles and responsibilities', 'Segregation of duties', 'Management review', 'Contact with authorities', 'Threat intelligence', 'Security in project management', 'Risk assessment methodology', 'Risk treatment plan', 'Internal audit programme', 'Legal and regulatory requirements', 'Security metrics reporting'] },
  asset: { label: 'Asset management', topics: ['Asset inventory', 'Acceptable use of assets', 'Return of assets', 'Information classification', 'Labelling of information', 'Media handling', 'Secure disposal', 'Configuration management'] },
  people: { label: 'People', topics: ['Screening', 'Terms of employment', 'Security awareness training', 'Disciplinary process', 'Termination responsibilities', 'Confidentiality agreements', 'Remote working'] },
  physical: { label: 'Physical', topics: ['Physical perimeters', 'Entry controls', 'Securing secure areas', 'Equipment siting', 'Clear desk and screen', 'Cabling security', 'Equipment maintenance'] },
  access: { label: 'Identity & access', topics: ['Access control policy', 'Identity management', 'Authentication information', 'Access rights review', 'Privileged access rights', 'Secure authentication', 'Multi-factor authentication', 'Session management', 'Remote access'] },
  ops: { label: 'Operations', topics: ['Malware protection', 'Technical vulnerability management', 'Logging', 'Monitoring activities', 'Clock synchronisation', 'Change management', 'Capacity management', 'Information backup', 'Patch management', 'Hardening baseline'] },
  network: { label: 'Network & crypto', topics: ['Network security', 'Segregation of networks', 'Web filtering', 'Security of network services', 'Encryption in transit', 'Use of cryptography', 'Key management', 'Wireless security'] },
  dev: { label: 'Development', topics: ['Secure development life cycle', 'Application security requirements', 'Secure coding', 'Security testing', 'Outsourced development', 'Separation of environments', 'Code review', 'Software bill of materials'] },
  supplier: { label: 'Suppliers', topics: ['Supplier security policy', 'Security in supplier agreements', 'ICT supply chain', 'Supplier service monitoring', 'Cloud services security', 'Supplier offboarding'] },
  incident: { label: 'Incident', topics: ['Incident management planning', 'Assessment of security events', 'Response to incidents', 'Learning from incidents', 'Collection of evidence', 'Regulatory notification', 'Crisis communications'] },
  bc: { label: 'Continuity', topics: ['Business continuity planning', 'ICT readiness for continuity', 'Redundancy of facilities', 'Recovery testing', 'Business impact analysis', 'Exercise programme'] },
  privacy: { label: 'Privacy', topics: ['Protection of personal data', 'Data minimisation', 'Retention schedule', 'Data subject requests', 'Data protection impact assessment'] },
  ot: { label: 'OT & devices', topics: ['OT asset inventory', 'Zones and conduits', 'OT remote access', 'Safety instrumented systems', 'PLC change control', 'OT patch compatibility', 'Removable media in OT', 'OT network monitoring'] },
};

type GroupSpec = [ref: string, name: string, domains: DomainId[], prefix: string];
type SeedSpec = [ref: string, name: string, group: number];
const FW_CATALOG: Record<string, { groups: GroupSpec[]; seeds: SeedSpec[] }> = {
  iso27001: {
    groups: [['A.5', 'Organizational controls', ['gov', 'asset', 'supplier', 'incident', 'bc', 'privacy'], 'A.5.'], ['A.6', 'People controls', ['people'], 'A.6.'], ['A.7', 'Physical controls', ['physical'], 'A.7.'], ['A.8', 'Technological controls', ['access', 'ops', 'network', 'dev'], 'A.8.']],
    seeds: [['A.5.1', 'Policies for information security', 0], ['A.5.7', 'Threat intelligence', 0], ['A.5.15', 'Access control', 0], ['A.5.19', 'Information security in supplier relationships', 0], ['A.5.23', 'Information security for use of cloud services', 0], ['A.5.30', 'ICT readiness for business continuity', 0], ['A.6.1', 'Screening', 1], ['A.6.3', 'Information security awareness, education and training', 1], ['A.7.4', 'Physical security monitoring', 2], ['A.8.5', 'Secure authentication', 3], ['A.8.7', 'Protection against malware', 3], ['A.8.8', 'Management of technical vulnerabilities', 3], ['A.8.13', 'Information backup', 3], ['A.8.15', 'Logging', 3], ['A.8.16', 'Monitoring activities', 3], ['A.8.22', 'Segregation of networks', 3], ['A.8.24', 'Use of cryptography', 3], ['A.8.32', 'Change management', 3]],
  },
  nis2: {
    groups: [['Art. 21(2)(a–c)', 'Risk management, incidents and continuity', ['gov', 'incident', 'bc'], '21(2)(a–c).'], ['Art. 21(2)(d–f)', 'Supply chain, acquisition and effectiveness', ['supplier', 'dev', 'gov'], '21(2)(d–f).'], ['Art. 21(2)(g–j)', 'Hygiene, access and authentication', ['people', 'network', 'access'], '21(2)(g–j).'], ['Art. 23', 'Reporting obligations', ['incident'], '23.']],
    seeds: [['21(2)(a)', 'Policies on risk analysis and information system security', 0], ['21(2)(b)', 'Incident handling', 0], ['21(2)(c)', 'Business continuity, backup management and crisis management', 0], ['21(2)(d)', 'Supply chain security', 1], ['21(2)(e)', 'Security in acquisition, development and maintenance, incl. vulnerability handling', 1], ['21(2)(f)', 'Policies to assess the effectiveness of risk-management measures', 1], ['21(2)(g)', 'Basic cyber hygiene practices and cybersecurity training', 2], ['21(2)(h)', 'Cryptography and encryption', 2], ['21(2)(i)', 'HR security, access control policies and asset management', 2], ['21(2)(j)', 'Multi-factor authentication and secured communications', 2], ['23(4)(a)', 'Early warning to the CSIRT within 24 hours', 3], ['23(4)(b)', 'Incident notification within 72 hours', 3], ['23(4)(d)', 'Final report within one month', 3]],
  },
  dora: {
    groups: [['Ch. II', 'ICT risk management (Art. 5–16)', ['gov', 'asset', 'access', 'ops', 'bc'], 'Art. 9.'], ['Ch. III', 'ICT incident management (Art. 17–23)', ['incident'], 'Art. 17.'], ['Ch. IV', 'Resilience testing (Art. 24–27)', ['dev', 'ops'], 'Art. 25.'], ['Ch. V', 'ICT third-party risk (Art. 28–44)', ['supplier'], 'Art. 28.'], ['Ch. VI', 'Information sharing (Art. 45)', ['gov'], 'Art. 45.']],
    seeds: [['Art. 5', 'Governance and organisation', 0], ['Art. 6', 'ICT risk management framework', 0], ['Art. 8', 'Identification of ICT assets and dependencies', 0], ['Art. 9', 'Protection and prevention', 0], ['Art. 10', 'Detection of anomalous activities', 0], ['Art. 11', 'Response and recovery', 0], ['Art. 12', 'Backup policies and recovery methods', 0], ['Art. 17', 'ICT-related incident management process', 1], ['Art. 19', 'Reporting of major ICT-related incidents', 1], ['Art. 24', 'Digital operational resilience testing programme', 2], ['Art. 26', 'Threat-led penetration testing (TLPT)', 2], ['Art. 28', 'ICT third-party risk principles', 3], ['Art. 28(3)', 'Register of Information', 3], ['Art. 30', 'Key contractual provisions', 3]],
  },
  pci: {
    groups: [['Req 1–2', 'Network security controls & configuration', ['network', 'ops'], '2.'], ['Req 3–4', 'Protect account data', ['network', 'privacy'], '3.'], ['Req 5–6', 'Vulnerability management & secure software', ['ops', 'dev'], '6.'], ['Req 7–9', 'Access control & physical', ['access', 'physical'], '8.'], ['Req 10–11', 'Logging, monitoring & testing', ['ops', 'dev'], '11.'], ['Req 12', 'Policy & programme', ['gov', 'supplier', 'incident', 'people'], '12.']],
    seeds: [['1.3', 'Network access to and from the CDE is restricted', 0], ['3.5', 'PAN is secured wherever it is stored', 1], ['5.2', 'Malicious software is prevented or detected', 2], ['6.3.3', 'Critical patches installed within one month', 2], ['6.4.3', 'Payment page scripts are managed', 2], ['8.4', 'Multi-factor authentication is implemented', 3], ['10.2', 'Audit logs are implemented', 4], ['10.4', 'Audit logs are reviewed', 4], ['11.3', 'Vulnerability scans are performed', 4], ['11.6.1', 'Payment page change and tamper detection', 4], ['12.8', 'Third-party service provider risk is managed', 5], ['12.10', 'Incident response plan', 5]],
  },
  swift: {
    groups: [['Obj. 1', 'Restrict internet access & segregate critical systems', ['network', 'access'], '1.'], ['Obj. 2', 'Reduce attack surface & vulnerabilities', ['ops'], '2.'], ['Obj. 3', 'Physically secure the environment', ['physical'], '3.'], ['Obj. 4', 'Prevent compromise of credentials', ['access'], '4.'], ['Obj. 5', 'Manage identities & segregate privileges', ['access', 'people'], '5.'], ['Obj. 6', 'Detect anomalous activity', ['ops', 'incident'], '6.'], ['Obj. 7', 'Plan for incident response & sharing', ['incident', 'bc'], '7.']],
    seeds: [['1.1', 'SWIFT environment protection', 0], ['1.2', 'Operating system privileged account control', 0], ['2.2', 'Security updates', 1], ['2.9', 'Transaction business controls', 1], ['3.1', 'Physical security', 2], ['4.1', 'Password policy', 3], ['4.2', 'Multi-factor authentication', 3], ['5.1', 'Logical access control', 4], ['6.1', 'Malware protection', 5], ['6.4', 'Logging and monitoring', 5], ['7.1', 'Cyber incident response planning', 6]],
  },
  nydfs: {
    groups: [['500.2–500.4', 'Programme, policy & governance', ['gov'], '500.3.'], ['500.5–500.11', 'Testing, access & third parties', ['ops', 'access', 'supplier', 'dev'], '500.7.'], ['500.12–500.16', 'MFA, training, encryption & response', ['access', 'people', 'network', 'incident', 'bc'], '500.14.'], ['500.17', 'Notices & certification', ['incident'], '500.17.']],
    seeds: [['500.2', 'Cybersecurity programme', 0], ['500.4', 'CISO and board reporting', 0], ['500.5', 'Vulnerability management', 1], ['500.7', 'Access privileges and management', 1], ['500.11', 'Third-party service provider policy', 1], ['500.12', 'Multi-factor authentication', 2], ['500.14', 'Monitoring and training', 2], ['500.15', 'Encryption of nonpublic information', 2], ['500.16', 'Incident response and business continuity', 2], ['500.17(a)', '72-hour notice of cybersecurity event', 3], ['500.17(b)', 'Annual certification of compliance', 3]],
  },
  oprisk: {
    groups: [['15A.2', 'Important business services & impact tolerances', ['bc', 'gov'], 'IBS.'], ['15A.4', 'Mapping', ['asset', 'supplier'], 'MAP.'], ['15A.5', 'Scenario testing', ['bc'], 'ST.'], ['15A.6', 'Self-assessment & lessons learned', ['gov', 'incident'], 'SA.'], ['15A.8', 'Communications', ['incident'], 'COM.']],
    seeds: [['15A.2.1', 'Identify important business services', 0], ['15A.2.5', 'Set impact tolerances', 0], ['15A.4.1', 'Map people, processes, technology, facilities and information', 1], ['15A.5.3', 'Test ability to stay within tolerance in severe but plausible scenarios', 2], ['15A.6.1', 'Written self-assessment', 3], ['15A.8.1', 'Internal and external communication plans', 4]],
  },
  soc2: {
    groups: [['CC1–CC4', 'Control environment and risk', ['gov', 'people'], 'CC2.'], ['CC5–CC8', 'Access, operations and change', ['access', 'ops', 'dev'], 'CC6.'], ['CC9, A1, C1', 'Vendors, availability and confidentiality', ['supplier', 'bc', 'privacy'], 'A1.']],
    seeds: [['CC1.1', 'Integrity and ethical values', 0], ['CC3.2', 'Risk identification and analysis', 0], ['CC6.1', 'Logical access security', 1], ['CC6.6', 'Boundary protection', 1], ['CC7.2', 'Monitoring of system components', 1], ['CC7.4', 'Incident response', 1], ['CC8.1', 'Change authorisation', 1], ['CC9.2', 'Vendor risk management', 2], ['A1.2', 'Backup and recovery of system data', 2], ['C1.1', 'Confidential information identified and protected', 2]],
  },
  imo: {
    groups: [['Identify', 'Identify (MSC-FAL.1/Circ.3)', ['asset', 'gov'], 'ID.'], ['Protect', 'Protect', ['access', 'network', 'people', 'ot'], 'PR.'], ['Detect', 'Detect', ['ops'], 'DE.'], ['Respond', 'Respond', ['incident'], 'RS.'], ['Recover', 'Recover', ['bc'], 'RC.']],
    seeds: [['MSC.428', 'Cyber risk addressed in the Safety Management System', 0], ['ID.1', 'Shipboard OT and IT asset inventory', 0], ['PR.3', 'ECDIS and navigation system hardening', 1], ['PR.5', 'Crew cyber awareness', 1], ['DE.2', 'Onboard network monitoring', 2], ['RS.1', 'Vessel cyber incident response plan', 3], ['RC.1', 'Recovery of critical shipboard systems', 4]],
  },
  iacs: {
    groups: [['E26 §4.1', 'Identify', ['asset', 'ot'], 'E26 4.1.'], ['E26 §4.2', 'Protect', ['ot', 'access', 'network'], 'E26 4.2.'], ['E26 §4.3', 'Detect', ['ot', 'ops'], 'E26 4.3.'], ['E26 §4.4–4.5', 'Respond and recover', ['incident', 'bc'], 'E26 4.4.'], ['E27', 'System and equipment requirements', ['ot', 'dev'], 'E27 '],],
    seeds: [['E26 4.1.1', 'Vessel asset inventory', 0], ['E26 4.2.2', 'Remote access management', 1], ['E26 4.2.4', 'Network segmentation', 1], ['E26 4.3.1', 'Network operation monitoring', 2], ['E26 4.3.3', 'Removable media control', 2], ['E26 4.4.1', 'Incident response plan', 3], ['E26 4.5.1', 'Recovery plan', 3], ['E27 2.1', 'Supplier security capabilities', 4]],
  },
  iec62443: {
    groups: [['FR1–FR2', 'Identification, authentication & use control', ['access', 'ot'], 'SR 1.'], ['FR3–FR4', 'System integrity & data confidentiality', ['ot', 'network'], 'SR 3.'], ['FR5', 'Restricted data flow (zones & conduits)', ['network', 'ot'], 'SR 5.'], ['FR6–FR7', 'Timely response & resource availability', ['ops', 'bc', 'incident'], 'SR 6.'], ['2-1', 'Security programme (CSMS)', ['gov', 'people', 'supplier'], '2-1 4.']],
    seeds: [['SR 1.1', 'Human user identification and authentication', 0], ['SR 1.13', 'Access via untrusted networks', 0], ['SR 2.4', 'Mobile code', 0], ['SR 3.2', 'Malicious code protection', 1], ['SR 3.4', 'Software and information integrity', 1], ['SR 5.1', 'Network segmentation', 2], ['SR 5.2', 'Zone boundary protection', 2], ['SR 6.2', 'Continuous monitoring', 3], ['SR 7.3', 'Control system backup', 3], ['2-1 4.3.2', 'Risk assessment for the IACS', 4]],
  },
  isps: {
    groups: [['A/15–16', 'Port facility security assessment & plan', ['gov', 'physical'], 'PFSP.'], ['A/14', 'Access to the port facility', ['physical', 'access'], 'ACC.'], ['Cyber annex', 'Cyber annex', ['ot', 'network', 'incident'], 'CYB.']],
    seeds: [['A/15', 'Port facility security assessment (cyber elements)', 0], ['A/16.3', 'Measures to prevent unauthorised access', 0], ['A/14.2', 'Monitoring of restricted areas', 1], ['CYB.1', 'Gate and access-control system protection', 2], ['CYB.2', 'Reporting security incidents to the PFSO', 2]],
  },
  tpn: {
    groups: [['MS', 'Management system', ['gov', 'people', 'supplier'], 'MS-'], ['PS', 'Physical security', ['physical'], 'PS-'], ['DS', 'Digital security', ['access', 'network', 'ops', 'dev'], 'DS-'], ['CS', 'Content security', ['asset', 'privacy'], 'CS-']],
    seeds: [['MS-1.0', 'Executive security awareness', 0], ['MS-4.0', 'Incident management', 0], ['PS-1.0', 'Entry and exit points', 1], ['PS-14.0', 'Camera and recording devices', 1], ['DS-1.0', 'Isolated content network', 2], ['DS-3.0', 'MFA for content systems', 2], ['DS-11.0', 'Removable media', 2], ['CS-4.0', 'Forensic watermarking', 3], ['CS-6.0', 'Content tracking', 3]],
  },
  mpa: {
    groups: [['MG', 'Management', ['gov', 'people', 'incident'], 'MG-'], ['PS', 'Physical security', ['physical'], 'PS-'], ['DS', 'Digital security', ['access', 'network', 'ops', 'dev', 'asset'], 'DS-']],
    seeds: [['MG-1.0', 'Executive security awareness and oversight', 0], ['MG-4.0', 'Incident response', 0], ['PS-7.0', 'Screening rooms', 1], ['DS-1.0', 'WAN and perimeter security', 2], ['DS-5.0', 'Internet access from content networks', 2], ['DS-11.0', 'Content transfer systems', 2], ['DS-13.0', 'Logging and monitoring', 2]],
  },
  dpp: {
    groups: [['Gov', 'Governance', ['gov', 'people'], 'GOV-'], ['Prod', 'Production security', ['asset', 'network', 'supplier'], 'PRD-'], ['Bcast', 'Broadcast security', ['ot', 'ops', 'bc'], 'BCS-']],
    seeds: [['GOV-1', 'Security governance and ownership', 0], ['PRD-3', 'Supplier security requirements', 1], ['BCS-2', 'Broadcast IP network monitoring', 2], ['BCS-5', 'Broadcast vendor remote access', 2]],
  },
  hipaa: {
    groups: [['164.308', 'Administrative safeguards', ['gov', 'people', 'incident', 'bc', 'supplier'], '164.308 IS-'], ['164.310', 'Physical safeguards', ['physical', 'asset'], '164.310 IS-'], ['164.312', 'Technical safeguards', ['access', 'ops', 'network'], '164.312 IS-'], ['164.314–316', 'Organisational requirements & documentation', ['supplier', 'gov'], '164.316 IS-']],
    seeds: [['164.308(a)(1)(ii)(A)', 'Risk analysis', 0], ['164.308(a)(1)(ii)(B)', 'Risk management', 0], ['164.308(a)(1)(ii)(D)', 'Information system activity review', 0], ['164.308(a)(3)', 'Workforce security', 0], ['164.308(a)(5)', 'Security awareness and training', 0], ['164.308(a)(6)', 'Security incident procedures', 0], ['164.308(a)(7)', 'Contingency plan (backup, disaster recovery, emergency mode)', 0], ['164.308(b)(1)', 'Business associate contracts', 0], ['164.310(a)(1)', 'Facility access controls', 1], ['164.310(d)(1)', 'Device and media controls', 1], ['164.312(a)(1)', 'Access control (unique user ID, emergency access)', 2], ['164.312(b)', 'Audit controls', 2], ['164.312(c)(1)', 'Integrity of ePHI', 2], ['164.312(d)', 'Person or entity authentication', 2], ['164.312(e)(1)', 'Transmission security', 2], ['164.314(a)', 'Business associate contract requirements', 3], ['164.316(b)', 'Documentation and retention', 3]],
  },
  hitrust: {
    groups: [['00–01', 'Programme & access control', ['gov', 'access'], '01.'], ['02–05', 'HR, risk, policy & organisation', ['people', 'gov', 'supplier'], '05.'], ['06–08', 'Compliance, assets & physical', ['asset', 'physical', 'privacy'], '07.'], ['09', 'Communications & operations', ['ops', 'network'], '09.'], ['10–13', 'Development, incidents, continuity & privacy', ['dev', 'incident', 'bc', 'privacy'], '11.']],
    seeds: [['01.c', 'Privilege management', 0], ['01.j', 'User authentication for external connections', 0], ['01.q', 'User identification and authentication', 0], ['02.e', 'Information security awareness and training', 1], ['03.b', 'Performing risk assessments', 1], ['05.k', 'Addressing security in third-party agreements', 1], ['07.a', 'Inventory of assets', 2], ['09.aa', 'Audit logging', 3], ['09.j', 'Controls against malicious code', 3], ['09.m', 'Network controls', 3], ['10.m', 'Control of technical vulnerabilities', 4], ['11.a', 'Reporting information security events', 4], ['12.c', 'Developing and implementing continuity plans', 4]],
  },
  cpg: {
    groups: [['Essential', 'Essential goals', ['access', 'ops', 'supplier', 'people', 'incident'], '1.'], ['Enhanced', 'Enhanced goals', ['asset', 'network', 'ops', 'bc', 'supplier'], '2.']],
    seeds: [['1.1', 'Mitigate known vulnerabilities', 0], ['1.2', 'Email security', 0], ['1.3', 'Basic cybersecurity training', 0], ['1.4', 'Strong encryption', 0], ['1.5', 'Multifactor authentication', 0], ['1.6', 'Revoke and verify credentials (incl. help-desk resets)', 0], ['1.7', 'Basic incident planning and preparedness', 0], ['1.8', 'Vendor and supplier cybersecurity requirements', 0], ['1.9', 'Unique credentials', 0], ['1.10', 'Separate user and privileged accounts', 0], ['2.1', 'Asset inventory', 1], ['2.2', 'Third-party access and vulnerability disclosure', 1], ['2.3', 'Privileged access isolation', 1], ['2.4', 'Detect and respond to relevant threats', 1], ['2.5', 'Cybersecurity testing', 1], ['2.6', 'Third-party incident reporting', 1], ['2.7', 'Network segmentation', 1], ['2.8', 'Centralised log collection', 1], ['2.9', 'Centralised incident planning, backup and recovery', 1], ['2.10', 'Configuration management', 1]],
  },
  nistcsf: {
    groups: [['GV', 'Govern', ['gov', 'supplier'], 'GV.RR-'], ['ID', 'Identify', ['asset', 'gov'], 'ID.IM-'], ['PR', 'Protect', ['access', 'people', 'network', 'ops'], 'PR.PS-'], ['DE', 'Detect', ['ops'], 'DE.CM-'], ['RS', 'Respond', ['incident'], 'RS.AN-'], ['RC', 'Recover', ['bc'], 'RC.CO-']],
    seeds: [['GV.OC-01', 'Organisational mission informs risk management', 0], ['GV.RM-01', 'Risk management objectives agreed', 0], ['GV.SC-01', 'Supply chain risk management programme', 0], ['ID.AM-01', 'Hardware inventories maintained', 1], ['ID.RA-01', 'Vulnerabilities identified and recorded', 1], ['PR.AA-01', 'Identities and credentials managed', 2], ['PR.AA-02', 'Identities proofed before credentials are issued or reset', 2], ['PR.AT-01', 'Personnel awareness and training', 2], ['PR.DS-01', 'Data at rest protected', 2], ['PR.IR-01', 'Networks protected from unauthorised access', 2], ['DE.CM-01', 'Networks monitored for adverse events', 3], ['DE.AE-02', 'Adverse events analysed', 3], ['RS.MA-01', 'Incident response plan executed', 4], ['RS.CO-02', 'Stakeholders notified of incidents', 4], ['RC.RP-01', 'Recovery plan executed', 5]],
  },
  fda: {
    groups: [['Pre-market', 'Pre-market cybersecurity (524B) in procurement', ['dev', 'supplier'], 'PROC-'], ['Post-market', 'Post-market vulnerability management', ['ops', 'incident', 'supplier'], 'PM-'], ['Deployment', 'Clinical deployment controls', ['ot', 'network', 'access'], 'DEP-']],
    seeds: [['524B(b)(3)', 'SBOM provided at procurement', 0], ['PROC-2', 'MDS2 form reviewed before purchase', 0], ['PM-1', 'Manufacturer vulnerability disclosure policy on file', 1], ['PM-3', 'Patch and update plan in the purchase contract', 1], ['DEP-1', 'Device placed on a segmented clinical VLAN', 2], ['DEP-2', 'Default credentials removed at installation', 2]],
  },
  r155: {
    groups: [['7.2.2', 'CSMS processes', ['gov', 'supplier', 'dev'], '7.2.2.'], ['7.2.2.2', 'Risk identification & assessment', ['gov', 'dev'], 'RA-'], ['7.3', 'Vehicle type requirements', ['dev', 'network', 'access'], '7.3.'], ['Annex 5', 'Threats & mitigations', ['dev', 'ops', 'incident'], 'A5-'], ['7.2.2.2(g)', 'Monitoring & response (VSOC)', ['ops', 'incident'], 'MON-']],
    seeds: [['7.2.2.1', 'CSMS covers development, production and post-production', 0], ['7.2.2.2(a)', 'Processes for managing cyber security', 0], ['7.2.2.2(b)', 'Risk identification for vehicle types', 1], ['7.2.2.2(g)', 'Monitor, detect and respond to cyber attacks on vehicles', 4], ['7.2.2.4', 'Supplier dependencies managed', 0], ['7.3.4', 'Vehicle type risk assessment', 2], ['7.3.7', 'Testing of the vehicle type', 2], ['A5 4.3.1', 'Back-end server threats mitigated', 3], ['A5 4.3.4', 'Update procedure threats mitigated', 3]],
  },
  r156: {
    groups: [['7.1.1', 'SUMS processes', ['gov', 'dev'], '7.1.1.'], ['7.1.2', 'Security of the update process', ['dev', 'network', 'access'], '7.1.2.'], ['7.1.3', 'Over-the-air updates', ['dev', 'ops', 'bc'], '7.1.3.'], ['7.2', 'Vehicle type requirements', ['dev'], '7.2.']],
    seeds: [['7.1.1.1', 'RXSWIN record keeping', 0], ['7.1.1.4', 'Identify target vehicles and compatibility', 0], ['7.1.2.1', 'Protect update delivery against manipulation', 1], ['7.1.2.2', 'Protect the update signing process (HSM, dual control)', 1], ['7.1.3.1', 'Vehicle safety during OTA update', 2], ['7.1.3.3', 'Recover from a failed update', 2]],
  },
  iso21434: {
    groups: [['Cl. 5–6', 'Organisational & project cybersecurity', ['gov', 'people'], 'RQ-05-'], ['Cl. 7', 'Distributed activities (suppliers)', ['supplier'], 'RQ-07-'], ['Cl. 8', 'Continual activities', ['ops', 'incident'], 'RQ-08-'], ['Cl. 9–11', 'Concept, development & validation', ['dev'], 'RQ-10-'], ['Cl. 12–14', 'Production, operations & decommissioning', ['ops', 'bc', 'asset'], 'RQ-13-'], ['Cl. 15', 'TARA methods', ['gov', 'dev'], 'RQ-15-']],
    seeds: [['RQ-05-01', 'Cybersecurity policy', 0], ['RQ-07-01', 'Supplier capability evaluation', 1], ['RQ-08-01', 'Cybersecurity monitoring', 2], ['RQ-08-07', 'Vulnerability analysis', 2], ['RQ-09-01', 'Item definition', 3], ['RQ-10-01', 'Cybersecurity specifications', 3], ['RQ-11-01', 'Validation of cybersecurity goals', 3], ['RQ-13-01', 'Incident response for vehicles in the field', 4], ['RQ-15-01', 'Asset identification (TARA)', 5]],
  },
  tisax: {
    groups: [['1', 'IS policies & organisation', ['gov'], '1.'], ['2–4', 'HR, physical & identity', ['people', 'physical', 'access'], '4.'], ['5', 'IT & cyber security', ['ops', 'network', 'dev', 'asset'], '5.'], ['6', 'Supplier relationships', ['supplier'], '6.'], ['7', 'Compliance', ['privacy', 'gov'], '7.'], ['8', 'Prototype protection', ['physical', 'asset'], '8.']],
    seeds: [['1.2.1', 'Information security management system', 0], ['1.3.1', 'Identification of information assets', 0], ['2.1.2', 'Security awareness', 1], ['3.1.1', 'Security zones', 1], ['4.1.2', 'User authentication', 1], ['4.1.3', 'Vendor and service-provider access', 1], ['5.2.3', 'Protection against malware', 2], ['5.2.4', 'Event logging', 2], ['5.2.6', 'Technical vulnerabilities', 2], ['5.2.8', 'Backup and recovery', 2], ['6.1.1', 'Information security with suppliers', 3], ['7.1.1', 'Legal and contractual requirements', 4], ['8.1.1', 'Physical and environmental security for prototypes', 5], ['8.2.1', 'Contracts with business partners (prototypes)', 5], ['8.4.1', 'Handling of test vehicles', 5]],
  },
};
const GENERIC_CATALOG = { groups: [['G1', 'Core requirements', ['gov', 'access', 'ops', 'incident'], 'REQ-']] as GroupSpec[], seeds: [] as SeedSpec[] };

export type ControlStatus = 'Compliant' | 'In progress' | 'Not started' | 'Not applicable';
export const CONTROL_STATUS_COLOR: Record<ControlStatus, string> = { Compliant: '#0e9a6a', 'In progress': '#e0a03a', 'Not started': '#d9534f', 'Not applicable': '#7e8aa0' };
export interface ComplyControl {
  id: string;
  ref: string;
  name: string;
  fwId: string;
  fwShort: string;
  group: string;
  groupName: string;
  domain: DomainId;
  status: ControlStatus;
  decidedBy?: 'Client override' | 'HexaShield override';
  justification?: string;
  reviewOverdue?: boolean;
  owner: string;
  updatedDays: number;
  /** HexaComply control in the loop engine, when this requirement is mapped. */
  loopControl?: string;
}
export interface RequirementGroup {
  id: string;
  fwId: string;
  fwShort: string;
  ref: string;
  name: string;
  controls: number;
  inScope: number;
  compliant: number;
  covered: boolean;
}

const NA_WHY = [
  'No in-scope systems of this type in the environment.',
  'Function fully outsourced; covered under supplier controls.',
  'Deferred by management decision pending platform migration.',
  'Inherited from the hosting provider (assurance report reviewed annually).',
  'Not applicable to the certified scope boundary.',
];

function ownersOf(c: CustomerProfile): string[] {
  return [c.people.grcLead.name, c.people.ciso.name, c.people.socLead.name, c.people.admin.name, ...(c.people.otLead ? [c.people.otLead.name] : []), ...c.people.staff.slice(3, 8).map((p) => p.name)];
}

export function complianceControls(c: CustomerProfile, tenantId: string): ComplyControl[] {
  const statuses = frameworkStatus(c, tenantId);
  const owners = ownersOf(c);
  const lps = loops(c);
  const out: ComplyControl[] = [];
  for (const fs of statuses) {
    const f = fs.fw;
    const cat = FW_CATALOG[f.id] ?? GENERIC_CATALOG;
    const r = rng(`ctl-${c.id}-${f.id}`);
    const list: { ref: string; name: string; g: number; domain: DomainId }[] = [];
    const used = new Set<string>();
    const usedNames = new Set<string>();
    for (const [ref, name, g] of cat.seeds) {
      if (list.length >= f.requirements) break;
      list.push({ ref, name, g, domain: cat.groups[g][2][0] });
      used.add(ref);
      usedNames.add(name);
    }
    const counters = cat.groups.map(() => 1);
    const topicIdx = new Map<string, number>();
    let gi = 0;
    let guard = 0;
    while (list.length < f.requirements && guard++ < 2000) {
      const g = gi % cat.groups.length;
      gi++;
      const [, , doms, prefix] = cat.groups[g];
      const dom = doms[(counters[g] - 1) % doms.length];
      const k = `${g}-${dom}`;
      const ti = topicIdx.get(k) ?? 0;
      topicIdx.set(k, ti + 1);
      const topics = DOMAINS[dom].topics;
      let name = topics[ti % topics.length];
      if (ti >= topics.length || usedNames.has(name)) name = `${name} (${['OT and plant', 'cloud services', 'third parties', 'remote sites', 'privileged users'][Math.floor(ti / topics.length + list.length) % 5]})`;
      if (usedNames.has(name)) name = `${name} · ${list.length}`;
      let ref = `${prefix}${counters[g]}`;
      while (used.has(ref)) { counters[g]++; ref = `${prefix}${counters[g]}`; }
      counters[g]++;
      used.add(ref);
      usedNames.add(name);
      list.push({ ref, name, g, domain: dom });
    }
    // Statuses: exact counts from frameworkStatus (out of scope first, from generated items).
    const order = r.shuffle(list.map((_, i) => i));
    const naIdx = new Set(order.filter((i) => i >= Math.min(cat.seeds.length, 3)).slice(0, fs.outOfScope));
    const rest = order.filter((i) => !naIdx.has(i));
    const st = new Map<number, ControlStatus>();
    naIdx.forEach((i) => st.set(i, 'Not applicable'));
    rest.forEach((i, k) => st.set(i, k < fs.compliant ? 'Compliant' : k < fs.compliant + fs.inProgress ? 'In progress' : 'Not started'));
    list.forEach((x, i) => {
      const status = st.get(i) ?? 'Not started';
      const lp = lps.find((l) => l.requirement.includes(x.ref) && l.requirement.includes(f.short.split(' ')[0]));
      out.push({
        id: `${f.id}:${x.ref}`, ref: x.ref, name: x.name, fwId: f.id, fwShort: f.short,
        group: cat.groups[x.g][0], groupName: cat.groups[x.g][1], domain: x.domain, status,
        decidedBy: status === 'Not applicable' ? (r.chance(0.45) ? 'HexaShield override' : 'Client override') : undefined,
        justification: status === 'Not applicable' ? r.pick(NA_WHY) : undefined,
        reviewOverdue: status === 'Not applicable' ? r.chance(0.15) : undefined,
        owner: r.pick(owners), updatedDays: r.int(1, 120), loopControl: lp?.controlId,
      });
    });
  }
  return out;
}

export function requirementGroups(c: CustomerProfile, tenantId: string, controls = complianceControls(c, tenantId)): RequirementGroup[] {
  const out: RequirementGroup[] = [];
  for (const f of c.frameworks) {
    const cat = FW_CATALOG[f.id] ?? GENERIC_CATALOG;
    for (const [ref, name] of cat.groups) {
      const cs = controls.filter((x) => x.fwId === f.id && x.group === ref);
      const inScope = cs.filter((x) => x.status !== 'Not applicable').length;
      const compliant = cs.filter((x) => x.status === 'Compliant').length;
      out.push({ id: `${f.id}:${ref}`, fwId: f.id, fwShort: f.short, ref, name, controls: cs.length, inScope, compliant, covered: inScope > 0 && compliant / inScope >= 0.8 });
    }
  }
  return out;
}

export function domainCoverage(controls: ComplyControl[]) {
  return (Object.keys(DOMAINS) as DomainId[])
    .map((d) => {
      const cs = controls.filter((x) => x.domain === d && x.status !== 'Not applicable');
      return { id: d, label: DOMAINS[d].label, n: cs.length, pct: cs.length ? Math.round((cs.filter((x) => x.status === 'Compliant').length / cs.length) * 100) : 0, target: d === 'access' || d === 'gov' || d === 'ot' ? 90 : 85 };
    })
    .filter((x) => x.n >= 3);
}

/* ---------------- Tasks ---------------- */
export type TaskStatus = 'Awaiting evidence' | 'Evidence submitted' | 'Evidence in review' | 'More information requested' | 'Completed — evidence approved' | 'Evidence expiring' | 'Not applicable';
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  'Awaiting evidence': 'var(--sev-high)', 'Evidence submitted': 'var(--m-matrix)', 'Evidence in review': 'var(--m-core)', 'More information requested': 'var(--sev-medium)',
  'Completed — evidence approved': 'var(--good)', 'Evidence expiring': 'var(--sev-low)', 'Not applicable': 'var(--sev-info)',
};
/** Original "Tasks by state" grouping. */
export const TASK_STATES = ['Compliant', 'In progress', 'Not started', 'Not applicable'] as const;
export type TaskState = (typeof TASK_STATES)[number];
export function taskState(s: TaskStatus): TaskState {
  return s === 'Completed — evidence approved' || s === 'Evidence expiring' ? 'Compliant' : s === 'Awaiting evidence' ? 'Not started' : s === 'Not applicable' ? 'Not applicable' : 'In progress';
}
export const TASK_STATE_COLOR: Record<TaskState, string> = { Compliant: '#0e9a6a', 'In progress': '#e0a03a', 'Not started': '#d9534f', 'Not applicable': '#7e8aa0' };
export const TASK_SEV_HEX: Record<TaskSev, string> = { critical: '#a3184e', high: '#d2512f', medium: '#eaa831', low: '#7e8aa0' };

export interface ComplyTask {
  id: string;
  ref: string;
  title: string;
  controlId: string;
  controlRef: string;
  fwId: string;
  fwShort: string;
  owner: string;
  ownerEmail: string;
  tenant: string;
  sev: TaskSev;
  status: TaskStatus;
  evidence: number;
  updatedDays: number;
  dueDays: number;
  overdue: boolean;
  kind: OverdueItem['kind'];
  loopControl?: string;
  decidedBy?: ComplyControl['decidedBy'];
}

const TASK_VERBS: [string, OverdueItem['kind']][] = [['Provide policy for', 'Policy'], ['Demonstrate implementation of', 'Evidence'], ['Attach latest report for', 'Evidence'], ['Evidence quarterly review of', 'Review'], ['Confirm testing of', 'Evidence'], ['Remediate gaps in', 'Remediation']];

export function complianceTasks(c: CustomerProfile, tenantId: string, controls = complianceControls(c, tenantId)): ComplyTask[] {
  const r = rng(`ctasks-${c.id}-${tenantId}`);
  const people = [c.people.grcLead, c.people.socLead, c.people.admin, ...(c.people.otLead ? [c.people.otLead] : []), ...c.people.staff.slice(3, 9)];
  const tenants = scopedTenants(c, tenantId);
  const out: ComplyTask[] = [];
  let n = 0;
  for (const ctl of controls) {
    const k = tenantId === 'all' ? r.weighted<number>([[1, 5], [2, 4], [3, 1]]) : r.weighted<number>([[1, 7], [2, 3]]);
    for (let j = 0; j < k; j++) {
      const [verb, kind] = r.pick(TASK_VERBS);
      const status: TaskStatus = ctl.status === 'Not applicable' ? 'Not applicable'
        : ctl.status === 'Compliant' ? r.weighted<TaskStatus>([['Completed — evidence approved', 9], ['Evidence expiring', 1]])
          : ctl.status === 'Not started' ? r.weighted<TaskStatus>([['Awaiting evidence', 8], ['More information requested', 1]])
            : r.weighted<TaskStatus>([['Evidence submitted', 3], ['Evidence in review', 2], ['More information requested', 1.5], ['Awaiting evidence', 3], ['Completed — evidence approved', 2]]);
      const p = r.pick(people);
      out.push({
        id: `TSK-${String(1000 + n++)}`, ref: `${ctl.ref}.${j + 1}`, title: `${verb} ${/^[A-Z][a-z]/.test(ctl.name) ? ctl.name.charAt(0).toLowerCase() + ctl.name.slice(1) : ctl.name}`,
        controlId: ctl.id, controlRef: ctl.ref, fwId: ctl.fwId, fwShort: ctl.fwShort, owner: p.name, ownerEmail: p.email, tenant: r.pick(tenants).id,
        sev: r.weighted<TaskSev>([['critical', 1.2], ['high', 3], ['medium', 4], ['low', 2.5]]), status, evidence: 0, updatedDays: r.int(1, 110),
        dueDays: r.int(3, 120), overdue: false, kind, loopControl: ctl.loopControl, decidedBy: ctl.decidedBy,
      });
    }
  }
  // Exactly the headline number of overdue tasks, drawn from work still waiting on evidence.
  const nOver = headlines(c, tenantId).comply.overdueTasks;
  const pool = r.shuffle(out.filter((t) => t.status === 'Awaiting evidence' || t.status === 'More information requested'));
  const tpl = OVERDUE_TEMPLATES[c.id];
  const sevs = r.shuffle<TaskSev>([...Array(Math.ceil(nOver * 0.06)).fill('critical'), ...Array(Math.ceil(nOver * 0.28)).fill('high'), ...Array(nOver).fill('medium')]);
  pool.slice(0, nOver).forEach((t, i) => {
    t.overdue = true;
    t.dueDays = -r.int(1, 64);
    t.sev = sevs[i] ?? 'medium';
    if (i < tpl.length) {
      t.title = tpl[i][1];
      t.kind = tpl[i][0];
      t.loopControl = tpl[i][2];
    }
  });
  return out;
}

export function taskMatrix(c: CustomerProfile, tenantId: string, tasks = complianceTasks(c, tenantId)) {
  const m = Object.fromEntries(TASK_STATES.map((s) => [s, { critical: 0, high: 0, medium: 0, low: 0 }])) as Record<TaskState, Record<TaskSev, number>>;
  tasks.forEach((t) => { m[taskState(t.status)][t.sev]++; });
  return m;
}

export function overdueItems(c: CustomerProfile, tenantId: string): OverdueItem[] {
  return complianceTasks(c, tenantId)
    .filter((t) => t.overdue)
    .map((t) => ({ id: t.id, title: t.title, kind: t.kind, framework: t.fwShort, control: t.loopControl ?? t.controlRef, owner: t.owner, ownerEmail: t.ownerEmail, tenant: t.tenant, daysOverdue: -t.dueDays, sev: t.sev }))
    .sort((a, b) => TASK_SEVS.indexOf(a.sev) - TASK_SEVS.indexOf(b.sev) || b.daysOverdue - a.daysOverdue);
}

/* ---------------- Evidence ---------------- */
export type EvidenceKey = (typeof EVIDENCE_STATES)[number]['key'];
export interface EvidenceItem {
  id: string;
  title: string;
  source: string;
  automated: boolean;
  state: EvidenceKey;
  taskId: string;
  controlRef: string;
  fwShort: string;
  collectedDays: number;
  expiresDays: number;
  hash: string;
}

const DOMAIN_SOURCES: Record<DomainId, ConnectorCategory[]> = {
  gov: ['GRC'], asset: ['Asset / CMDB', 'ITSM'], people: ['GRC'], physical: [], access: ['Identity', 'PAM'], ops: ['EDR / XDR', 'Vulnerability', 'SIEM'],
  network: ['SASE', 'Network', 'Cloud posture'], dev: ['AppSec', 'Validation'], supplier: ['Ratings', 'GRC'], incident: ['SIEM', 'ITSM'], bc: ['Backup'], privacy: ['DLP'], ot: ['OT'],
};
const ARTEFACT: Record<DomainId, string[]> = {
  gov: ['policy approval record', 'management review minutes', 'risk committee pack'], asset: ['asset inventory export', 'CMDB reconciliation report'], people: ['training completion report', 'screening attestation'],
  physical: ['site access log sample', 'CCTV retention screenshot'], access: ['MFA registration report', 'conditional access policy export', 'privileged account review'], ops: ['patch compliance report', 'EDR coverage report', 'log retention configuration', 'analytic rule export'],
  network: ['firewall rule review', 'segmentation test result', 'TLS configuration scan'], dev: ['SAST policy compliance export', 'pen-test report', 'BAS validation result'], supplier: ['supplier assurance report', 'contract clause extract'],
  incident: ['incident response test record', 'notification timeline'], bc: ['restore test report', 'immutability configuration', 'exercise report'], privacy: ['DPIA record', 'DLP policy export'], ot: ['OT asset inventory export', 'zone and conduit diagram', 'remote session recording sample'],
};

export function evidenceRegister(c: CustomerProfile, tenantId: string, tasks = complianceTasks(c, tenantId), controls = complianceControls(c, tenantId)): EvidenceItem[] {
  const ev = evidencePipeline(c, tenantId);
  const r = rng(`evreg-${c.id}-${tenantId}`);
  const ctlById = new Map(controls.map((x) => [x.id, x]));
  const conns = scopedConnectors(c, tenantId);
  const pools = {
    done: tasks.filter((t) => taskState(t.status) === 'Compliant'),
    prog: tasks.filter((t) => taskState(t.status) === 'In progress'),
    start: tasks.filter((t) => t.status === 'Awaiting evidence'),
    more: tasks.filter((t) => t.status === 'More information requested'),
  };
  const any = tasks.filter((t) => t.status !== 'Not applicable');
  const pickPool = (k: EvidenceKey) => {
    const p = k === 'approved' ? (r.chance(0.85) ? pools.done : pools.prog) : k === 'expired' ? pools.done : k === 'more_info' ? pools.more : k === 'draft' ? pools.start : pools.prog;
    return p.length ? p : any;
  };
  const out: EvidenceItem[] = [];
  let n = 0;
  for (const s of ev.states) {
    for (let i = 0; i < s.count; i++) {
      const t = r.pick(pickPool(s.key));
      if (!t) continue;
      t.evidence++;
      const ctl = ctlById.get(t.controlId);
      const dom = ctl?.domain ?? 'gov';
      const cats = DOMAIN_SOURCES[dom];
      const k = cats.length ? conns.find((x) => cats.includes(x.category) && r.chance(0.7)) : undefined;
      const auto = !!k && r.chance(ev.autoPct / 100 + 0.1);
      out.push({
        id: `EV-${String(10000 + n++)}`,
        title: `${auto && k ? k.product : 'Manual upload'}: ${r.pick(ARTEFACT[dom])}`,
        source: auto && k ? `${k.vendor === 'Generic' || k.vendor === 'HexaShield' ? '' : `${k.vendor} `}${k.product}` : r.pick(['Manual upload', 'HexaComply questionnaire', 'Email to evidence inbox']),
        automated: auto,
        state: s.key, taskId: t.id, controlRef: t.controlRef, fwShort: t.fwShort,
        collectedDays: s.key === 'expired' ? r.int(366, 520) : r.int(0, 300),
        expiresDays: s.key === 'expired' ? -r.int(1, 90) : r.int(5, 365),
        hash: r.hex(12),
      });
    }
  }
  return out;
}

/* ---------------- Control workflows (original "Stream") ---------------- */
export const WORKFLOW_QUESTIONS: Record<DomainId, { lead: string; q: string; checks: string[] }[]> = {
  gov: [{ lead: 'A policy nobody has read is a policy in name only.', q: 'Is the policy approved by management and acknowledged by staff in the last 12 months?', checks: ['Named owner and approval date', 'Acknowledgement tracked', 'Review cycle defined'] }, { lead: 'Risk decisions need a trail.', q: 'Are risk acceptance decisions recorded with an owner and an expiry?', checks: ['Risk owner named', 'Acceptance expires', 'Re-review scheduled'] }],
  asset: [{ lead: 'You cannot protect what you have not listed.', q: 'Is there a complete inventory with an owner for every asset?', checks: ['Owner per asset', 'Criticality recorded', 'Support end date recorded'] }, { lead: 'A scheme that never appears on a file is a scheme in name only.', q: 'Do you have a classification scheme, and do people apply it in practice?', checks: ['Defined levels', 'Guidance on which level applies', 'Labels visible in systems'] }],
  people: [{ lead: 'Training only counts if people finish it.', q: 'Has the workforce completed security awareness training in the last 12 months?', checks: ['Completion above 95%', 'Phishing simulation run', 'Role-based training for admins'] }, { lead: 'Leavers are a common route back in.', q: 'Are accounts disabled on the day someone leaves?', checks: ['HR feed to identity system', 'Same-day disable', 'Monthly reconciliation'] }],
  physical: [{ lead: 'Physical access is still access.', q: 'Are secure areas protected by badge access with logs kept for at least 90 days?', checks: ['Badge readers on secure areas', 'Logs retained', 'Visitor escort policy'] }, { lead: 'Cameras that nobody reviews deter nobody.', q: 'Is CCTV in secure areas reviewed after alarms?', checks: ['Coverage of entry points', 'Retention period set', 'Alarm-triggered review'] }],
  access: [{ lead: 'Most breaches start with a stolen password.', q: 'Is MFA enforced for all remote, email and privileged access?', checks: ['Remote access covered', 'Privileged accounts covered', 'Phishing-resistant methods for admins'] }, { lead: 'Access drifts unless someone looks.', q: 'Are access rights reviewed at least quarterly for critical systems?', checks: ['Reviewer named per system', 'Removals actioned', 'Evidence of the review kept'] }],
  ops: [{ lead: 'Known exploited vulnerabilities are the ones that get used.', q: 'Are KEV-listed vulnerabilities on internet-facing systems fixed within 14 days?', checks: ['KEV feed consumed', 'SLA tracked', 'Exceptions risk-accepted'] }, { lead: 'Logs you cannot search do not help in an incident.', q: 'Are security logs centralised and retained for at least 12 months?', checks: ['Critical sources onboarded', 'Retention configured', 'Tamper protection'] }],
  network: [{ lead: 'Flat networks let ransomware spread in minutes.', q: 'Are critical systems segmented from user networks with default-deny rules?', checks: ['Zones defined', 'Default deny between zones', 'Rules reviewed annually'] }, { lead: 'Encryption is only as good as its keys.', q: 'Is data encrypted in transit and are keys managed centrally?', checks: ['TLS 1.2+ enforced', 'Key ownership defined', 'Rotation schedule'] }],
  dev: [{ lead: 'Security found late costs most to fix.', q: 'Is code scanned before release and are critical findings blocked?', checks: ['SAST in pipeline', 'Release gate on critical', 'Dependency scanning'] }, { lead: 'Tests prove what reviews assume.', q: 'Are critical applications pen-tested at least annually?', checks: ['Scope agreed', 'Findings tracked to retest', 'Report retained'] }],
  supplier: [{ lead: 'Your supplier\'s weakness becomes yours.', q: 'Are suppliers assessed before they get access to data or systems?', checks: ['Tiering applied', 'Questionnaire or report reviewed', 'Contract security clauses'] }, { lead: 'Access granted for a project often outlives it.', q: 'Is supplier access time-bound and reviewed?', checks: ['Expiry on accounts', 'Sessions recorded where privileged', 'Quarterly review'] }],
  incident: [{ lead: 'Regulators count hours, not days.', q: 'Does the incident plan include the regulatory notification clocks that apply to you?', checks: ['Clocks listed per regulator', 'Decision owner named', 'Templates ready'] }, { lead: 'A plan never exercised is a hope.', q: 'Has the incident plan been exercised in the last 12 months?', checks: ['Tabletop held', 'Lessons recorded', 'Actions tracked'] }],
  bc: [{ lead: 'A backup you have never restored is a theory.', q: 'Have critical systems been restored from backup in the last 6 months?', checks: ['Restore within RTO', 'Immutable copy exists', 'Result recorded'] }, { lead: 'Recovery order matters when everything is down.', q: 'Is there a recovery order based on the business impact analysis?', checks: ['BIA current', 'Dependencies mapped', 'RTO/RPO agreed by owners'] }],
  privacy: [{ lead: 'Data you do not keep cannot leak.', q: 'Is there a retention schedule and is it applied?', checks: ['Schedule approved', 'Automated deletion where possible', 'Exceptions logged'] }, { lead: 'High-risk processing needs a DPIA.', q: 'Are DPIAs completed before new high-risk processing starts?', checks: ['Trigger criteria defined', 'DPO consulted', 'Residual risk accepted'] }],
  ot: [{ lead: 'Vendors are the most common way into plant networks.', q: 'Is all vendor remote access to OT brokered, approved per session and recorded?', checks: ['Jump host or PAM', 'Per-session approval', 'Recordings retained'] }, { lead: 'Logic changes outside a change window are a red flag.', q: 'Are PLC and controller programme changes detected and reconciled with change tickets?', checks: ['Change detection in place', 'Ticket reconciliation', 'Alert to OT lead'] }],
};

/* =====================================================================
   Business continuity: BIA register, exercises, asset register.
   ===================================================================== */
export type BiaStatus = 'Draft' | 'AI Draft' | 'Confirmed';
export interface BiaService {
  id: string;
  name: string;
  owner: string;
  tenant: string;
  /** Financial, operational (patient/vehicle/vessel safety where relevant), regulatory, reputational · 1–3. */
  impacts: [number, number, number, number];
  criticality: number;
  priority: 'Immediate' | 'High' | 'Medium' | 'Low';
  rtoH: number;
  rpoH: number;
  /** Maximum tolerable period of disruption (impact tolerance). */
  mtpdH: number;
  testedRtoH: number | null;
  lastTestDays: number | null;
  testResult: 'Pass' | 'Partial' | 'Fail' | 'Not tested';
  spof: string | null;
  systems: string[];
  suppliers: string[];
  sites: string[];
  frameworks: string[];
  nextReviewDays: number;
  status: BiaStatus;
  strategy: string;
  metrics: [string, string][];
}

type BiaSeed = [name: string, tenant: string, impacts: [number, number, number, number], rto: number, rpo: number, mtpd: number, tested: number | null, spof: string | null, systems: string[], suppliers: string[], strategy: string, metrics: [string, string][]];
const BIA_SEEDS: Record<CustomerId, BiaSeed[]> = {
  maritime: [
    ['Vessel berthing & crane operations', 'rtm', [3, 3, 2, 3], 4, 0.25, 12, 6, 'Navis N4 TOS (single production instance)', ['Navis N4 TOS', 'Crane PLC network', 'Berth planning optimiser'], ['Konecranes', 'Navis'], 'Warm standby TOS in Antwerp; manual crane sequencing sheets for 8 h', [['Moves per hour at risk', '1,450'], ['Demurrage per vessel-day', '€38k']]],
    ['Gate & truck appointment system', 'rtm', [2, 3, 1, 2], 8, 1, 24, 7, null, ['Gate OCR', 'Truck appointment portal', 'Customs EDI'], ['Harbourline Systems'], 'Manual gate with paper transit documents', [['Trucks per hour', '620']]],
    ['Customs & manifest exchange', 'hq', [2, 2, 3, 2], 12, 4, 48, null, 'Single EDI gateway at HQ', ['Customs EDI gateway', 'SAP S/4'], ['Customs broker network'], 'Fallback to customs web portal', [['Declarations per day', '3,900']]],
    ['Vessel navigation & bridge systems', 'fleet', [2, 3, 3, 3], 1, 0, 2, 1.5, null, ['ECDIS', 'Integrated bridge system', 'VSAT / LEO link'], ['Kongsberg', 'Inmarsat'], 'Paper charts and manual watchkeeping (SMS procedure)', [['Vessels in fleet', '38']]],
    ['Billing & invoicing', 'hq', [3, 1, 2, 2], 48, 24, 120, 30, null, ['SAP S/4', 'Billing engine'], ['IT managed service'], 'Delayed invoicing; no customer impact for 5 days', [['Daily invoice value', '€2.4M']]],
    ['Reefer monitoring', 'ant', [2, 2, 1, 2], 2, 0.5, 6, 3, 'Single reefer telemetry server', ['Reefer telemetry', 'Yard OT network'], ['Reefer monitoring vendor'], 'Manual reefer rounds every 2 h', [['Reefers on terminal', '4,100']]],
    ['Email & collaboration', 'hq', [2, 1, 1, 2], 24, 4, 72, 12, null, ['Microsoft 365', 'Entra ID'], ['Microsoft'], 'Teams via mobile; out-of-band contact list', []],
    ['Backup & restore service', 'hq', [3, 2, 2, 2], 24, 0.25, 72, 31, 'Veeam integration broken since upgrade', ['Veeam', 'Immutable storage'], ['IT managed service'], 'Immutable copies; restore runbooks', []],
  ],
  finserv: [
    ['Retail payments (Faster Payments)', 'ukbank', [3, 3, 3, 3], 2, 0, 4, 2.5, null, ['Payments hub', 'Core banking (T24)', 'Entra ID / Okta'], ['Payment scheme', 'Microsoft Azure'], 'Active-active across two Azure regions', [['Impact tolerance (FCA)', '4 h'], ['Payments per hour', '210k']]],
    ['Card acquiring', 'pay', [3, 3, 3, 3], 2, 0, 6, 3.5, 'Single HSM cluster for PIN translation', ['Acquiring platform', 'HSM cluster', 'Fraud engine'], ['Card scheme', 'Card manufacturer'], 'Stand-in processing by scheme for 2 h', [['Impact tolerance (FCA)', '6 h']]],
    ['Core banking (T24)', 'ukbank', [3, 3, 3, 3], 4, 0.25, 8, 6, null, ['Temenos T24', 'Oracle RAC', 'Mainframe ledger'], ['Temenos'], 'Hot standby in Slough DC2; cyber vault restore', [['Impact tolerance (FCA)', '8 h']]],
    ['Online & mobile banking', 'ukbank', [3, 3, 2, 3], 2, 0.25, 6, 2, null, ['Digital banking platform', 'Open-banking API', 'Okta CIAM'], ['Microsoft Azure', 'Akamai'], 'Multi-region; read-only mode', [['Impact tolerance (FCA)', '6 h'], ['Active users', '1.9M']]],
    ['SWIFT payments', 'ukbank', [3, 2, 3, 3], 4, 0, 12, 4, 'SWIFT Alliance Access in DC1', ['SWIFT Alliance', 'Secure zone'], ['SWIFT'], 'Second Alliance instance; manual MT fallback via service bureau', [['Daily value', '£4.1bn']]],
    ['Trading & market data', 'markets', [3, 2, 3, 2], 1, 0, 4, 1, null, ['Order management system', 'Market data feeds'], ['Market data'], 'Hot standby in NY4', []],
    ['Wealth onboarding', 'wealth', [2, 1, 2, 2], 24, 4, 72, null, null, ['KYC platform', 'CRM'], ['KYC / AML screening'], 'Manual onboarding queue', []],
    ['Treasury & liquidity', 'ukbank', [3, 2, 3, 2], 8, 1, 24, 10, null, ['Treasury system', 'SWIFT'], ['Temenos'], 'Spreadsheet liquidity model with dual sign-off', []],
  ],
  media: [
    ['Editorial & conform (Avid NEXIS)', 'post', [3, 3, 1, 2], 8, 1, 48, 14, 'Single NEXIS cluster in Soho', ['Avid NEXIS', 'MAM', 'Render farm'], ['Equipment rental'], 'Mirror to Burbank; immutable masters', [['Projects in edit', '14']]],
    ['KestrelPlay streaming', 'play', [3, 3, 2, 3], 1, 0.25, 4, 1.5, null, ['Streaming platform', 'CDN', 'Subscriber DB'], ['Akamai', 'AWS'], 'Multi-region with CDN failover', [['Concurrent streams (peak)', '410k']]],
    ['Live sports playout', 'live', [3, 3, 2, 3], 0.1, 0, 0.5, 0.25, 'Primary playout gallery in Atlanta', ['ST 2110 broadcast network', 'Playout automation', 'PTP timing'], ['Broadcast vendor'], 'Disaster-recovery gallery with 5-minute switch', [['Rights penalty per minute off air', '$120k']]],
    ['Screeners portal', 'studios', [2, 2, 1, 3], 24, 4, 72, 20, null, ['Screeners portal', 'Watermarking service'], ['Marketing agency'], 'Disable portal; send watermarked links manually', []],
    ['Subscriber billing', 'play', [3, 1, 3, 2], 12, 1, 48, 8, null, ['Billing platform', 'Payment gateway'], ['Payment gateway'], 'Grace period on renewals', []],
    ['Content delivery to vendors', 'post', [2, 2, 2, 3], 12, 1, 48, null, 'Aspera transfer node', ['Aspera / Signiant', 'HexaCustody agents'], ['Localisation vendor', 'VFX vendor'], 'Encrypted drive shuttle under custody', []],
    ['VFX render pipeline', 'post', [2, 2, 1, 1], 24, 8, 96, 30, null, ['Render farm', 'Shared storage'], ['VFX vendor'], 'Burst to cloud render', []],
    ['Email & collaboration', 'studios', [2, 1, 1, 2], 24, 4, 72, 10, null, ['Google Workspace', 'Okta'], ['Google'], 'Out-of-band contact tree', []],
  ],
  healthcare: [
    ['Epic EHR (clinical documentation & orders)', 'mrmc', [3, 3, 3, 3], 4, 0.25, 8, 7, 'Single Chronicles production database (ODB)', ['Epic Chronicles (ODB)', 'Epic Clarity', 'Imprivata badge-tap SSO', 'Citrix'], ['Epic Systems', 'Cohesity'], 'Epic downtime procedures: BCA read-only workstations on every unit, paper order sets, downtime registration', [['Last downtime drill', '7 h vs 4 h target'], ['BCA workstations', '312'], ['Patients in house', '1,620']]],
    ['Emergency department', 'mrmc', [3, 3, 3, 3], 1, 0.25, 2, 1.5, null, ['Epic ASAP', 'Patient monitoring (IntelliVue)', 'Nurse call', 'Pneumatic tube'], ['Philips Healthcare'], 'Paper triage, runners for results; ambulance diversion decision at 2 h', [['ED visits per day', '410'], ['Diversion trigger', '2 h without EHR']]],
    ['Medication administration & pharmacy', 'mrmc', [2, 3, 3, 3], 2, 0.25, 4, 3, 'Alaris pump server', ['Omnicell cabinets', 'BD Alaris server', 'Epic Willow'], ['BD (Becton Dickinson)', 'Omnicell'], 'Override access on cabinets; pump drug library cached on device', [['Doses per day', '38,000']]],
    ['Laboratory results', 'mrmc', [2, 3, 2, 2], 4, 0.5, 8, 5, null, ['Laboratory information system', 'Atellica lab line', 'HL7 interface engine'], ['Synapse Pathology Labs', 'Siemens Healthineers'], 'Phoned critical results; printed reports to units', [['Results per day', '24,000']]],
    ['Imaging & radiology (PACS)', 'mrmc', [2, 3, 2, 2], 8, 1, 24, 9, 'Single PACS archive', ['PACS & imaging archive', 'CT / MRI modalities', 'Teleradiology link'], ['GE HealthCare', 'Teleradiology group'], 'Modality local storage; overnight reads to teleradiology', [['Studies per day', '2,300']]],
    ['Surgery scheduling & theatres', 'kids', [3, 3, 2, 2], 8, 1, 24, null, null, ['Epic OpTime', 'Theatre HVAC / BMS', 'Medical gas alarms'], ['Siemens Healthineers'], 'Printed theatre lists; elective cancellations after 12 h', [['Cases per day', '180']]],
    ['Patient billing & claims', 'clinics', [3, 1, 2, 2], 72, 24, 168, 48, 'Change Healthcare clearinghouse', ['Epic Resolute', 'Clearinghouse EDI', 'PCI payment zone'], ['Change Healthcare (Optum)', 'Cerner Rev Cycle Outsourcing'], 'Second clearinghouse contract; hold claims up to 7 days', [['Daily claims value', '$11.2M']]],
    ['Telehealth & MyChart portal', 'clinics', [2, 2, 2, 3], 12, 1, 48, 6, null, ['MyChart', 'Telehealth platform'], ['TeleMed Partners'], 'Phone visits; status page', [['Video visits per day', '1,900']]],
    ['Genomics research computing', 'research', [2, 1, 3, 2], 72, 24, 336, null, null, ['Genomics HPC', 'AWS research accounts'], ['Research CRO'], 'Pause pipelines; immutable cohort copies', []],
  ],
  automotive: [
    ['Vehicle production Ingolstadt (JIT/JIS)', 'ingolstadt', [3, 3, 2, 3], 2, 0.25, 4, 3.5, 'MES line controller (single site instance)', ['MES Ingolstadt', 'SAP S/4 call-offs', 'Body-shop robot cells', 'Conveyor PLCs'], ['DHL Supply Chain', 'KUKA Robotics', 'Siemens Digital Industries'], 'Line buffers cover 2.5 h; JIS sequence re-broadcast from Győr MES; manual torque logging', [['Line-stop cost per minute', '€22k'], ['JIT buffer', '2.5 h'], ['Vehicles per day', '1,240']]],
    ['Battery cell production (air-gapped)', 'battery', [3, 3, 3, 2], 8, 1, 24, 6, 'Formation & ageing control servers', ['Battery formation racks', 'Local MES', 'Local HSM'], ['CATL'], 'Safe-state cells; offline restore from data-diode bundle', [['Cells in formation', '410k'], ['Thermal safe-state time', '20 min']]],
    ['OTA software updates (R156)', 'connected', [2, 3, 3, 3], 24, 0, 72, 12, 'OTA signing HSM (dual control)', ['OTA backend', 'Signing HSM', 'Vehicle backend APIs'], ['Continental Automotive'], 'Pause campaigns; rollback packages pre-signed', [['Vehicles reachable OTA', '2.1M'], ['Campaign rollback', '< 4 h']]],
    ['Connected-car services & app', 'connected', [2, 2, 3, 3], 4, 0.25, 12, 3, null, ['Vehicle backend APIs', 'Mobile app backend', 'Upstream vSOC'], ['AWS'], 'Multi-AZ; remote functions degrade to read-only', [['Active app users', '1.3M']]],
    ['Powertrain & e-drive production Győr', 'gyor', [3, 3, 2, 2], 4, 0.5, 8, 5, null, ['MES Győr', 'SCADA HMI (WinCC)', 'End-of-line test benches'], ['Siemens Digital Industries'], 'Bank e-drives from buffer; re-sequence Ingolstadt', [['Line-stop cost per minute', '€9k']]],
    ['Dealer sales & service', 'retail', [3, 1, 2, 3], 24, 4, 72, null, 'DealerCore DMS (single SaaS tenant)', ['DealerCore DMS', 'Dealer portal'], ['DealerCore DMS'], 'Offline order forms; parts lookup via portal', [['Dealers', '1,140']]],
    ['Parts logistics & EDI call-offs', 'group', [3, 3, 2, 2], 4, 0.5, 8, 4, null, ['SAP S/4', 'OFTP2 / EDI gateway'], ['DHL Supply Chain', 'Bosch Mobility'], 'Fax/e-mail call-off fallback agreed with tier-1 suppliers', [['Suppliers on EDI', '1,800']]],
    ['PLM / CAD (Teamcenter)', 'group', [2, 2, 1, 2], 24, 4, 96, 20, null, ['PLM / CAD vault (Teamcenter)', 'Azure PLM cloud'], ['Siemens Digital Industries'], 'Read-only replica; local checkouts', []],
    ['Puebla assembly', 'puebla', [3, 3, 1, 2], 4, 0.5, 12, 9, 'WAN link (on LTE failover since 06:10)', ['MES Puebla', 'Conveyor PLCs'], ['Siemens Digital Industries'], 'Local MES cache for 6 h', [['Line-stop cost per minute', '€11k']]],
  ],
};

export function biaRegister(c: CustomerProfile, tenantId: string): BiaService[] {
  const r = rng(`bia-${c.id}`);
  const owners = ownersOf(c);
  const fws = c.frameworks.map((f) => f.short);
  const all = BIA_SEEDS[c.id].map(([name, tenant, impacts, rto, rpo, mtpd, tested, spof, systems, suppliers, strategy, metrics], i): BiaService => {
    const crit = impacts.reduce((a, b) => a * b, 1);
    const testResult: BiaService['testResult'] = tested === null ? 'Not tested' : tested <= rto ? 'Pass' : tested <= mtpd ? 'Partial' : 'Fail';
    return {
      id: `BIA-${String(i + 1).padStart(3, '0')}`, name, owner: r.pick(owners), tenant, impacts, criticality: crit,
      priority: crit >= 36 ? 'Immediate' : crit >= 18 ? 'High' : crit >= 8 ? 'Medium' : 'Low',
      rtoH: rto, rpoH: rpo, mtpdH: mtpd, testedRtoH: tested, lastTestDays: tested === null ? null : r.int(20, 300), testResult, spof, systems, suppliers,
      sites: [c.tenants.find((t) => t.id === tenant)?.city ?? c.hq],
      frameworks: r.pickN(fws, r.int(1, 3)), nextReviewDays: i % 3 === 1 ? -r.int(8, 140) : r.int(10, 300),
      status: r.weighted<BiaStatus>([['Confirmed', 6], ['Draft', 2], ['AI Draft', 2]]), strategy, metrics,
    };
  });
  return tenantId === 'all' ? all : all.filter((b) => b.tenant === tenantId);
}

export interface Exercise { id: string; date: number; type: string; scope: string; result: 'Pass' | 'Partial' | 'Fail'; findings: number; note: string }
const EXERCISES: Record<CustomerId, Omit<Exercise, 'id'>[]> = {
  maritime: [
    { date: 38, type: 'Restore test', scope: 'Navis N4 TOS database', result: 'Partial', findings: 3, note: 'Restored in 6 h against a 4 h RTO; Veeam catalogue rebuilt manually.' },
    { date: 96, type: 'Tabletop', scope: 'Ransomware across Rotterdam and Antwerp', result: 'Pass', findings: 5, note: 'NIS2 24-hour early warning drafted in 3 h.' },
    { date: 152, type: 'Failover', scope: 'VSAT to LEO on 6 vessels', result: 'Pass', findings: 1, note: 'Automatic failover in 40 s.' },
    { date: 240, type: 'Manual operations drill', scope: 'Gate without OCR, Santos', result: 'Partial', findings: 4, note: 'Throughput fell to 38% of normal.' },
  ],
  finserv: [
    { date: 21, type: 'Scenario test (SYSC 15A)', scope: 'Faster Payments, severe cyber scenario', result: 'Pass', findings: 2, note: 'Recovered in 2.5 h within the 4 h impact tolerance.' },
    { date: 74, type: 'Cyber vault restore', scope: 'Core banking ledger', result: 'Pass', findings: 3, note: 'Clean-room restore validated by Internal Audit.' },
    { date: 133, type: 'Tabletop', scope: 'DORA major incident reporting', result: 'Partial', findings: 6, note: 'Initial notification drafted in 5 h against 4 h target.' },
    { date: 210, type: 'Failover', scope: 'Card acquiring HSM cluster', result: 'Partial', findings: 2, note: 'Single HSM cluster remains a SPOF.' },
  ],
  media: [
    { date: 44, type: 'DR switch', scope: 'Live playout to DR gallery', result: 'Pass', findings: 1, note: 'Switched in 4 min 10 s.' },
    { date: 118, type: 'Restore test', scope: 'Avid NEXIS project volumes', result: 'Partial', findings: 3, note: 'Restored in 14 h; RTO is 8 h.' },
    { date: 190, type: 'Tabletop', scope: 'Pre-release leak via vendor', result: 'Pass', findings: 4, note: 'Revocation propagated in 52 s.' },
  ],
  healthcare: [
    { date: 29, type: 'Epic downtime drill', scope: 'Medical Center, all units, 4 h planned downtime', result: 'Partial', findings: 7, note: 'Full recovery took 7 h; BCA workstations missing on 3 units; downtime registration backlog 2 h.' },
    { date: 81, type: 'Tabletop (Health-ISAC scenario)', scope: 'Ransomware with ambulance diversion', result: 'Pass', findings: 5, note: 'Diversion decision made at 1 h 40 min; HHS and FBI notification paths confirmed.' },
    { date: 140, type: 'Restore test', scope: 'PACS archive (30 days of studies)', result: 'Pass', findings: 1, note: 'Restored in 9 h within the 24 h tolerance.' },
    { date: 205, type: 'Clearinghouse failover', scope: 'Claims to secondary clearinghouse', result: 'Partial', findings: 3, note: 'Second contract live, but 18% of payers not yet enrolled.' },
    { date: 260, type: 'Medical device isolation drill', scope: 'Infusion pumps on community VLAN', result: 'Fail', findings: 6, note: 'Isolation would have stopped pump library updates on 3 wards; segmentation project raised.' },
  ],
  automotive: [
    { date: 17, type: 'Line-stop simulation', scope: 'Ingolstadt MES loss, JIS re-sequencing from Győr', result: 'Pass', findings: 2, note: 'Line restarted in 3 h 30 min; buffer covered 2 h 30 min.' },
    { date: 63, type: 'OTA rollback test', scope: 'Campaign 24.9.2 on 5,000 test-fleet vehicles', result: 'Pass', findings: 1, note: 'Rollback complete in 3 h 10 min.' },
    { date: 121, type: 'Air-gapped restore', scope: 'Battery formation control servers from diode bundle', result: 'Partial', findings: 3, note: 'Restored in 6 h; bundle signature check added manual step.' },
    { date: 178, type: 'Tabletop', scope: 'Ransomware across plants with NIS2 and KBA reporting', result: 'Pass', findings: 6, note: 'BSI early warning drafted in 2 h.' },
    { date: 244, type: 'Supplier EDI outage drill', scope: 'Call-offs by fax/e-mail with top 40 suppliers', result: 'Partial', findings: 4, note: '7 suppliers could not receive fallback call-offs.' },
  ],
};
export function exercises(c: CustomerProfile): Exercise[] {
  return EXERCISES[c.id].map((e, i) => ({ ...e, id: `EXR-${String(i + 1).padStart(3, '0')}` }));
}

export type AssetCategory = 'Applications & Databases' | 'Documentation' | 'Hardware' | 'IT/Communication & Other Equipment' | 'Information' | 'Infrastructure' | 'Outsourced Services' | 'People' | 'SaaS' | 'Software';
export const ASSET_CATEGORIES: AssetCategory[] = ['Applications & Databases', 'Documentation', 'Hardware', 'IT/Communication & Other Equipment', 'Information', 'Infrastructure', 'Outsourced Services', 'People', 'SaaS', 'Software'];
export type AssetClass = 'Physical' | 'Digital' | 'HR' | 'Logical';
export type AssetStatus = 'Active' | 'Planned' | 'Retired' | 'Legacy' | 'Draft';
export type CiaLevel = 'L' | 'M' | 'H';
export interface RegAsset {
  id: string;
  name: string;
  /** The pool name the asset was raised from (used to link risks and BIA dependencies). */
  base: string;
  category: AssetCategory;
  sub: string;
  cls: AssetClass;
  criticality: 'Critical' | 'Moderate' | 'Non-Critical';
  cia: [CiaLevel, CiaLevel, CiaLevel];
  supportEndDays: number | null;
  status: AssetStatus;
  owner: string;
  tenant: string;
  department: string;
}
const ASSET_TOTAL: Record<CustomerId, number> = { maritime: 304, finserv: 348, media: 262, healthcare: 336, automotive: 350 };
/** Sector OT / equipment sub-category label. */
export const EQUIPMENT_SUB: Record<CustomerId, string> = {
  maritime: 'Port & vessel OT', finserv: 'Branch, ATM & data-centre facilities', media: 'Broadcast & playout equipment', healthcare: 'Connected medical device', automotive: 'Plant OT / ICS',
};
const DOCS: Record<CustomerId, string[]> = {
  maritime: ['Ship Security Plan (cyber annex)', 'Port Facility Security Plan', 'Safety Management System manual', 'Crane OT network diagrams', 'Vessel cyber incident response plan', 'Terminal BCP'],
  finserv: ['Register of Information (DORA RoI)', 'Impact tolerance statements', 'SWIFT CSCF attestation pack', 'PCI DSS network diagrams', 'ICT third-party exit plans', 'Operational resilience self-assessment'],
  media: ['TPN self-assessment questionnaire', 'Content security policy', 'Vendor delivery specifications', 'Watermarking procedures', 'Live playout DR runbook', 'Pre-release handling standard'],
  healthcare: ['HIPAA risk analysis', 'Epic downtime procedures', 'Business Associate Agreements file', 'Medical device security standard', 'Emergency operations plan', 'Breach notification procedure'],
  automotive: ['CSMS manual (UNECE R155)', 'SUMS process (UNECE R156)', 'TARA records (ISO/SAE 21434)', 'TISAX ISA self-assessment', 'Plant zone & conduit diagrams', 'Prototype protection handbook'],
};
const SOFTWARE: Record<CustomerId, string[]> = {
  maritime: ['Windows 11 Enterprise image', 'ECDIS chart update client', 'Crane HMI runtime', 'Microsoft 365 Apps', 'Berth planning optimiser client'],
  finserv: ['Windows 11 Enterprise image', 'Bloomberg Terminal client', 'z/OS system software', 'Microsoft 365 Apps', 'Murex client'],
  media: ['macOS edit-bay image', 'Avid Media Composer', 'DaVinci Resolve', 'Adobe Creative Cloud', 'Forensic watermark SDK'],
  healthcare: ['Windows 11 clinical workstation image', 'Epic Hyperspace client', 'Citrix Workspace', 'PACS viewer', 'Microsoft 365 Apps'],
  automotive: ['Windows 11 Enterprise image', 'Siemens TIA Portal', 'CATIA V6 client', 'Vector CANoe', 'SAP GUI'],
};
const EOS_SEEDS: Record<CustomerId, [string, AssetCategory, number][]> = {
  maritime: [['Windows 7 crane HMI (STS crane 14)', 'IT/Communication & Other Equipment', -380], ['ECDIS on Windows XP Embedded (Halcyon Pioneer)', 'IT/Communication & Other Equipment', -520], ['Cisco ASA 5512 at Santos gate', 'Hardware', -210], ['Navis N4 2.x reporting server', 'Applications & Databases', -96]],
  finserv: [['Windows Server 2012 R2 reconciliation host', 'Infrastructure', -410], ['Oracle 12c (wealth CRM)', 'Applications & Databases', -260], ['Branch Cisco ISR 2900 routers (41)', 'Hardware', -330], ['Legacy SWIFT HSM firmware', 'Hardware', -64]],
  media: [['Avid Media Composer 2018 edit bays (12)', 'Software', -300], ['Windows 7 colour-grading workstation', 'Hardware', -720], ['Broadcast router firmware (SDI)', 'IT/Communication & Other Equipment', -140]],
  healthcare: [['Windows 7 imaging workstations (GE CT console)', 'IT/Communication & Other Equipment', -980], ['BD Alaris PC units, legacy firmware (1,140)', 'IT/Communication & Other Equipment', -120], ['Windows Server 2012 R2 Clarity reporting', 'Infrastructure', -410], ['Philips IntelliVue gateway v.K', 'IT/Communication & Other Equipment', -64], ["Nurse call server (Children's)", 'IT/Communication & Other Equipment', -38]],
  automotive: [['Windows XP press-line HMI (Ingolstadt P3)', 'IT/Communication & Other Equipment', -1400], ['Siemens S7-300 controllers, body shop (64)', 'IT/Communication & Other Equipment', -240], ['WinCC 7.3 SCADA (Győr)', 'IT/Communication & Other Equipment', -500], ['Windows Server 2012 R2 MES Puebla', 'Infrastructure', -410], ['Torque controllers firmware 4.x (Atlas Copco)', 'IT/Communication & Other Equipment', -90]],
};
const SUBS: Record<Exclude<AssetCategory, 'IT/Communication & Other Equipment' | 'Outsourced Services'>, string[]> = {
  'Applications & Databases': ['Line-of-business application', 'Database', 'Integration / middleware'],
  Documentation: ['Plan', 'Policy & procedure', 'Design documentation'],
  Hardware: ['End-user device', 'Network device', 'Server hardware', 'Storage'],
  Information: ['Confidential information', 'Personal data', 'Intellectual property'],
  Infrastructure: ['Server', 'Virtualisation host', 'Cloud account'],
  People: ['Key person', 'Privileged user group', 'Workforce group'],
  SaaS: ['Security tooling', 'Business SaaS'],
  Software: ['Endpoint software', 'Operating system image', 'Engineering tooling'],
};
export function assetRegister(c: CustomerProfile, tenantId: string): RegAsset[] {
  const r = rng(`assets-v2-${c.id}`);
  const owners = ownersOf(c);
  const depts = ['Company-wide IT', 'Finance & reporting', 'Operations', 'Engineering', 'Sales & marketing', 'HR & payroll', 'Security', 'Customer support'];
  const tIds = c.tenants.map((t) => t.id);
  const otTenants = c.tenants.filter((t) => t.env.includes('ot')).map((t) => t.id);
  const hw = ['Laptops', 'Mobile devices', 'Network switches', 'Wireless controllers', 'Firewalls', 'Storage arrays', 'Printers'];
  const pools: [AssetCategory, string[], AssetClass, number][] = [
    ['Applications & Databases', c.vocab.crownJewels, 'Digital', 3],
    ['Infrastructure', [...c.vocab.servers, ...c.vocab.cloudAccounts.map((a) => `${a.provider} ${a.name}`)], 'Physical', 3],
    ['IT/Communication & Other Equipment', c.vocab.otSystems, 'Physical', otTenants.length ? 3 : 1],
    ['SaaS', c.connectors.filter((k) => k.env === 'saas').map((k) => k.product), 'Digital', 1.6],
    ['Outsourced Services', c.thirdParties.map((t) => t.name), 'Logical', 1.4],
    ['Information', c.vocab.custodyItems, 'Logical', 1.5],
    ['Documentation', DOCS[c.id], 'Logical', 1],
    ['Hardware', hw, 'Physical', 2.4],
    ['Software', SOFTWARE[c.id], 'Digital', 1.4],
    ['People', [c.people.ciso.role, c.people.socLead.role, c.people.grcLead.role, 'Domain administrators', 'Service desk agents', 'Contractors'], 'HR', 0.8],
  ];
  const subOf = (cat: AssetCategory, name: string): string =>
    cat === 'IT/Communication & Other Equipment' ? EQUIPMENT_SUB[c.id]
      : cat === 'Outsourced Services' ? c.thirdParties.find((t) => t.name === name)?.category ?? 'Managed service'
        : cat === 'Hardware' ? (/Laptop|Mobile|Printer/.test(name) ? 'End-user device' : /Storage/.test(name) ? 'Storage' : 'Network device')
          : cat === 'Infrastructure' ? (/^(AWS|Azure|GCP) /.test(name) ? 'Cloud account' : r.pick(['Server', 'Virtualisation host']))
            : r.pick(SUBS[cat]);
  const lvl = (): CiaLevel => r.weighted<CiaLevel>([['L', 2], ['M', 4], ['H', 3]]);
  const out: RegAsset[] = EOS_SEEDS[c.id].map(([name, category, d], i) => ({
    id: `AST-${String(i + 1).padStart(4, '0')}`, name, base: name, category,
    sub: category === 'IT/Communication & Other Equipment' ? EQUIPMENT_SUB[c.id] : category === 'Hardware' ? 'Network device' : category === 'Software' ? 'Engineering tooling' : category === 'Infrastructure' ? 'Server' : 'Database',
    cls: category === 'Software' || category === 'Applications & Databases' ? 'Digital' : 'Physical', criticality: 'Critical', cia: ['M', 'H', 'H'], supportEndDays: d, status: 'Legacy',
    owner: c.people.otLead?.name ?? c.people.admin.name, tenant: category === 'IT/Communication & Other Equipment' && otTenants.length ? r.pick(otTenants) : r.pick(tIds), department: 'Operations',
  }));
  for (let i = out.length; i < ASSET_TOTAL[c.id]; i++) {
    const [category, names, cls] = r.weighted(pools.filter((p) => p[3] > 0 && p[1].length).map((p) => [p, p[3]] as const));
    const dept = r.pick(depts);
    const base = r.pick(names);
    const eos = (category === 'Hardware' || category === 'Infrastructure' || category === 'IT/Communication & Other Equipment' || category === 'Software') && r.chance(0.6) ? r.int(-500, 1400) : null;
    const crit = category === 'Applications & Databases' || category === 'IT/Communication & Other Equipment'
      ? r.weighted<RegAsset['criticality']>([['Critical', 4], ['Moderate', 4], ['Non-Critical', 1]])
      : r.weighted<RegAsset['criticality']>([['Critical', 1.5], ['Moderate', 5], ['Non-Critical', 3.5]]);
    out.push({
      id: `AST-${String(i + 1).padStart(4, '0')}`, name: `${base} — ${dept} (#${String(i + 1).padStart(3, '0')})`, base, category, sub: subOf(category, base), cls,
      criticality: crit, cia: [lvl(), lvl(), lvl()], supportEndDays: eos,
      status: r.weighted<AssetStatus>([['Active', 14], ['Legacy', 2.2], ['Planned', 1], ['Retired', 1]]), owner: r.pick(owners),
      tenant: category === 'IT/Communication & Other Equipment' && otTenants.length ? r.pick(otTenants) : r.pick(tIds), department: dept,
    });
  }
  return tenantId === 'all' ? out : out.filter((a) => a.tenant === tenantId);
}

/* ---------------- Attention queue & scope exclusions ---------------- */
export interface AttentionItem {
  id: string;
  kind: 'Asset' | 'Risk' | 'BIA' | 'Task';
  title: string;
  meta: string;
  daysOver: number;
  path: string;
}
export function attentionQueue(c: CustomerProfile, tenantId: string): AttentionItem[] {
  const assets = assetRegister(c, tenantId).filter((a) => a.supportEndDays !== null && a.supportEndDays < 0 && (a.status === 'Active' || a.status === 'Legacy'));
  const risks = riskRegister(c, tenantId).filter((x) => x.dueDays !== null && x.dueDays < 0);
  const bias = biaRegister(c, tenantId).filter((b) => b.nextReviewDays < 0);
  const tasks = overdueItems(c, tenantId);
  return [
    ...assets.map((a) => ({ id: a.id, kind: 'Asset' as const, title: `Past support end — ${a.id} ${a.name}`, meta: `Support ended ${-(a.supportEndDays ?? 0)} days ago · still ${a.status}`, daysOver: -(a.supportEndDays ?? 0), path: `/comply/caas?section=assets&lifecycle=eos&id=${a.id}` })),
    ...risks.map((x) => ({ id: x.id, kind: 'Risk' as const, title: `Treatment past due — ${x.id}: ${x.title}`, meta: `${x.treatment.toLowerCase()} · owner ${x.owner}`, daysOver: -(x.dueDays ?? 0), path: `/comply/caas?section=risks&lifecycle=pastdue&id=${x.id}` })),
    ...bias.map((b) => ({ id: b.id, kind: 'BIA' as const, title: `BIA review overdue — ${b.name}`, meta: `${b.id} · owner ${b.owner}`, daysOver: -b.nextReviewDays, path: `/comply/caas?section=bia&lifecycle=overdue&id=${b.id}` })),
    ...tasks.map((t) => ({ id: t.id, kind: 'Task' as const, title: `Task overdue — ${t.title}`, meta: `${t.framework} · ${t.control} · ${t.owner}`, daysOver: t.daysOverdue, path: `/comply/caas?section=tasks&overdue=1&id=${t.id}` })),
  ].sort((a, b) => b.daysOver - a.daysOver);
}
