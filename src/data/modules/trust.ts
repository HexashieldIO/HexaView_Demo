/* =====================================================================
   Trust Centre & Customer Assurance.
   Inbound security questionnaires from the customer's own customers, drafted
   from live evidence already in HexaView (HexaComply controls and evidence,
   policies, HexaStrike pen tests, HexaSOC metrics, insurance, certifications),
   every answer cited and human-approved before release. Plus the answer
   library, gated documents, access requests, NDAs and the access log.
   ===================================================================== */
import type { CustomerId, CustomerProfile, ConnectorCategory, FrameworkScope } from '../types';
import { rng } from '../../lib/rng';
import { headlines, type Headlines } from '../core';
import { lastPenTest } from './ops';
import { fmtDate, daysAgo, currencySymbol } from '../../lib/format';
import { forCustomer, type CustomerMap } from '../customerMap';

/* ---------------- Vocabulary ---------------- */
export type TrDomain =
  | 'Governance & policy' | 'Access control' | 'Encryption' | 'Vulnerability management' | 'Logging & monitoring'
  | 'Incident response' | 'BCP & resilience' | 'Vendor management' | 'Data residency & privacy' | 'AI use'
  | 'People & awareness' | 'Sector';

export const TR_DOMAINS: { id: TrDomain; code: string; color: string }[] = [
  { id: 'Governance & policy', code: 'GOV', color: '#4f8cff' },
  { id: 'Access control', code: 'IAM', color: '#2dd4bf' },
  { id: 'Encryption', code: 'CEK', color: '#a07cfb' },
  { id: 'Vulnerability management', code: 'TVM', color: '#f5a83d' },
  { id: 'Logging & monitoring', code: 'LOG', color: '#68b1ff' },
  { id: 'Incident response', code: 'SEF', color: '#f8646f' },
  { id: 'BCP & resilience', code: 'BCR', color: '#93d65a' },
  { id: 'Vendor management', code: 'STA', color: '#ecc873' },
  { id: 'Data residency & privacy', code: 'DSP', color: '#ef6aae' },
  { id: 'AI use', code: 'AIU', color: '#8a9bc0' },
  { id: 'People & awareness', code: 'HRS', color: '#5fd6bb' },
  { id: 'Sector', code: 'SEC', color: '#c792ea' },
];
export const TR_DOMAIN_COLOR = Object.fromEntries(TR_DOMAINS.map((d) => [d.id, d.color])) as Record<TrDomain, string>;

const SECTOR_LABEL: CustomerMap<string> = {
  maritime: 'OT, terminal & vessel security',
  finserv: 'DORA, payments & SWIFT',
  media: 'Content security (TPN / MPA)',
  healthcare: 'Clinical systems & medical devices',
  automotive: 'Vehicle, OTA & plant security',
};
export function trDomainLabel(c: CustomerProfile, d: TrDomain): string {
  return d === 'Sector' ? forCustomer(SECTOR_LABEL, c) : d;
}

export type TrStatus = 'Received' | 'Drafting' | 'In review' | 'Approved' | 'Sent';
export const TR_STATUSES: { id: TrStatus; color: string; sub: string }[] = [
  { id: 'Received', color: '#8593b4', sub: 'Parsed, not drafted yet' },
  { id: 'Drafting', color: '#f0a338', sub: 'Drafted, gaps with SMEs' },
  { id: 'In review', color: '#4f8cff', sub: 'Awaiting human approval' },
  { id: 'Approved', color: '#2dd4bf', sub: 'Every answer approved' },
  { id: 'Sent', color: '#93d65a', sub: 'Returned to the customer' },
];
export const TR_STATUS_COLOR = Object.fromEntries(TR_STATUSES.map((s) => [s.id, s.color])) as Record<TrStatus, string>;

export type TrQState = 'Needs input' | 'Drafted' | 'Flagged' | 'Approved';
export const TR_QSTATE_COLOR: Record<TrQState, string> = { 'Needs input': '#f8646f', Drafted: '#4f8cff', Flagged: '#f0a338', Approved: '#2dd4bf' };

export type TrFormatId = 'sig-lite' | 'sig-core' | 'caiq' | 'iso' | 'custom' | 'dora' | 'hipaa' | 'dspt' | 'tisax' | 'tpn' | 'bimco'
  | 'nydfs-tpsp' | 'reins' | 'cmmc' | 'dfars' | 'gxp' | 'hia' | 'insurer-sg';
export interface TrFormat { id: TrFormatId; name: string; short: string; file: 'XLSX' | 'Portal' | 'DOCX' | 'PDF'; range: [number, number]; blurb: string; sector?: CustomerId }
export const TR_FORMATS: TrFormat[] = [
  { id: 'sig-lite', name: 'SIG Lite (2025)', short: 'SIG Lite', file: 'XLSX', range: [118, 132], blurb: 'Standardised information-gathering questionnaire, lite tier' },
  { id: 'sig-core', name: 'SIG Core (2025)', short: 'SIG Core', file: 'XLSX', range: [610, 820], blurb: 'Full standardised questionnaire for critical suppliers' },
  { id: 'caiq', name: 'CSA CAIQ v4.0.3', short: 'CAIQ v4', file: 'XLSX', range: [258, 261], blurb: 'Cloud Controls Matrix consensus questionnaire' },
  { id: 'iso', name: 'ISO 27001-based supplier questionnaire', short: 'ISO 27001', file: 'DOCX', range: [84, 118], blurb: 'Annex A aligned, customer-specific wording' },
  { id: 'custom', name: 'Custom spreadsheet', short: 'Custom', file: 'XLSX', range: [42, 176], blurb: 'Free-form procurement spreadsheet, columns mapped on import' },
  { id: 'dora', name: 'DORA ICT third-party questionnaire (Art. 28-30)', short: 'DORA ICT TPP', file: 'Portal', range: [94, 138], blurb: 'ICT service provider due diligence for EU financial entities', sector: 'finserv' },
  { id: 'hipaa', name: 'HIPAA BAA security addendum', short: 'HIPAA BAA', file: 'DOCX', range: [56, 74], blurb: 'Business associate safeguards (45 CFR 164.308-316)', sector: 'healthcare' },
  { id: 'dspt', name: 'DSPT-style assurance (UK research partner)', short: 'DSPT-style', file: 'XLSX', range: [100, 114], blurb: 'Data Security & Protection Toolkit aligned assertions', sector: 'healthcare' },
  { id: 'tisax', name: 'VDA ISA 6.0 self-assessment (TISAX)', short: 'VDA ISA', file: 'XLSX', range: [78, 104], blurb: 'Information security, prototype protection and data protection modules', sector: 'automotive' },
  { id: 'tpn', name: 'TPN content security questionnaire (MPA CSBP)', short: 'TPN', file: 'Portal', range: [142, 188], blurb: 'Trusted Partner Network shield questionnaire for pre-release content', sector: 'media' },
  { id: 'bimco', name: 'BIMCO cyber clause & IACS UR E26/E27 annex', short: 'BIMCO / IACS', file: 'XLSX', range: [58, 84], blurb: 'Charter-party cyber clause plus class cyber-resilience annex', sector: 'maritime' },
  { id: 'nydfs-tpsp', name: 'NYDFS 500.11 third-party service provider questionnaire', short: 'NYDFS TPSP', file: 'XLSX', range: [64, 92], blurb: 'Due diligence on providers holding NPI: MFA, encryption, notice and access', sector: 'insurance' },
  { id: 'reins', name: 'Reinsurer and broker cyber underwriting questionnaire', short: 'Reinsurer cyber', file: 'Portal', range: [48, 70], blurb: 'Treaty renewal and cyber underwriting submission via the broker', sector: 'insurance' },
  { id: 'cmmc', name: 'Prime supplier CMMC / NIST SP 800-171 assessment', short: 'CMMC / 800-171', file: 'Portal', range: [110, 134], blurb: 'Prime contractor flow-down: SPRS score, CMMC level, POA&M and SSP evidence', sector: 'defence' },
  { id: 'dfars', name: 'DFARS 7012 flow-down and incident reporting affirmation', short: 'DFARS 7012', file: 'DOCX', range: [22, 36], blurb: 'Safeguarding, 72-hour reporting, media preservation and sub-tier flow-down', sector: 'defence' },
  { id: 'gxp', name: 'GxP supplier quality and data integrity questionnaire', short: 'GxP / Annex 11', file: 'XLSX', range: [86, 120], blurb: 'Computerised system validation, audit trails and quality agreement terms', sector: 'pharma' },
  { id: 'hia', name: 'HIA cybersecurity and data security assurance questionnaire', short: 'HIA CS/DS', file: 'XLSX', range: [60, 82], blurb: 'MOH essentials across cybersecurity, data security and common practices', sector: 'sghospital' },
  { id: 'insurer-sg', name: 'Insurer panel and partner cyber assurance questionnaire', short: 'Insurer panel', file: 'Portal', range: [40, 58], blurb: 'Panel hospital assurance for insurers and medical-tourism partners', sector: 'sghospital' },
];
export const TR_FORMAT_BY_ID = Object.fromEntries(TR_FORMATS.map((f) => [f.id, f])) as Record<TrFormatId, TrFormat>;
export function trFormatsFor(c: CustomerProfile): TrFormat[] {
  // A customer's own sector formats; customers without any read their template's.
  const own = TR_FORMATS.some((f) => f.sector === c.id);
  return TR_FORMATS.filter((f) => !f.sector || f.sector === (own ? c.id : c.dataKey));
}

/* ---------------- Evidence catalogue ---------------- */
export type TrEvKind = 'Certification' | 'Control' | 'Policy' | 'Pen test' | 'SOC metric' | 'Insurance' | 'Platform';
export const TR_EV_COLOR: Record<TrEvKind, string> = {
  Certification: '#2dd4bf', Control: '#4f8cff', Policy: '#a07cfb', 'Pen test': '#f8646f', 'SOC metric': '#68b1ff', Insurance: '#ecc873', Platform: '#93d65a',
};
export interface TrEvidence { key: string; kind: TrEvKind; label: string; detail: string; source: string; to: string; ageDays: number }

function tool(c: CustomerProfile, cat: ConnectorCategory, fallback: string): string {
  const k = c.connectors.find((x) => x.category === cat);
  return k ? `${k.vendor} ${k.product}` : fallback;
}

interface Ctx {
  c: CustomerProfile;
  h: Headlines;
  pt: ReturnType<typeof lastPenTest>;
  ptDate: string;
  certs: FrameworkScope[];
  certList: string;
  siem: string; edr: string; idp: string; pam: string; vuln: string; backup: string; email: string;
  insurer: string;
  limit: string;
  residency: string;
}
function ctx(c: CustomerProfile): Ctx {
  const h = headlines(c);
  const pt = lastPenTest(c);
  const certs = c.frameworks.filter((f) => f.kind === 'Certification' || f.kind === 'Attestation' || f.kind === 'Industry programme');
  const sym = currencySymbol(c.currency);
  return {
    c, h, pt, ptDate: fmtDate(daysAgo(pt.daysAgo)), certs, certList: certs.map((f) => f.short).join(', '),
    siem: tool(c, 'SIEM', 'the group SIEM'), edr: tool(c, 'EDR / XDR', 'EDR'), idp: tool(c, 'Identity', 'the corporate IdP'), pam: tool(c, 'PAM', 'the PAM vault'),
    vuln: tool(c, 'Vulnerability', 'the vulnerability scanner'), backup: tool(c, 'Backup', 'immutable backup'), email: tool(c, 'Email', 'the email gateway'),
    insurer: c.insurance.carrier.split(' (')[0].split(' /')[0], limit: `${sym}${c.insurance.limitM}M`, residency: c.residency.split('·')[0].trim(),
  };
}

const SECTOR_EV: CustomerMap<{ key: string; label: string; detail: (x: Ctx) => string; to: string; kind: TrEvKind }[]> = {
  maritime: [
    { key: 'sec:ot', kind: 'Platform', label: 'HexaOT · terminals & vessels', detail: (x) => `${x.h.ot.otAssets.toLocaleString('en-GB')} OT assets across ${x.h.ot.sites} sites, ${x.h.ot.purdueCoveragePct}% Purdue coverage`, to: '/ot/visibility' },
    { key: 'sec:e26', kind: 'Control', label: 'CTL-OT-02 · vendor remote access via PAM', detail: () => 'IACS UR E26 4.2.2 · IEC 62443 SR 1.13', to: '/comply/caas?section=frameworks&framework=iacs' },
  ],
  finserv: [
    { key: 'sec:dora', kind: 'Control', label: 'DORA register of information', detail: () => 'Art. 28 ICT third-party register, CSSF submission', to: '/comply/caas?section=frameworks&framework=dora' },
    { key: 'sec:swift', kind: 'Certification', label: 'SWIFT CSCF attestation', detail: () => 'KYC-SA attestation, independent assessment', to: '/comply/caas?section=frameworks&framework=swift' },
  ],
  media: [
    { key: 'sec:custody', kind: 'Platform', label: 'HexaCustody · pre-release chain', detail: (x) => `${x.h.custody.assetsUnderCustody.toLocaleString('en-GB')} assets under custody, ${x.h.custody.vendorsInChain} vendors in chain`, to: '/custody/overview' },
    { key: 'sec:wm', kind: 'Control', label: 'CTL-WAT-08 · forensic watermarking', detail: () => 'MPA CS-4.0 · screeners and review links', to: '/comply/caas?section=frameworks&framework=mpa' },
  ],
  healthcare: [
    { key: 'sec:md', kind: 'Platform', label: 'HexaOT · medical device inventory', detail: (x) => `${x.h.ot.otAssets.toLocaleString('en-GB')} connected medical devices, ${x.h.ot.purdueCoveragePct}% segmented`, to: '/ot/visibility' },
    { key: 'sec:ephi', kind: 'Control', label: 'CTL-LOG-07 · ePHI access audit', detail: () => 'HIPAA 164.312(b) · EHR and PACS access review', to: '/comply/caas?section=frameworks&framework=hipaa' },
  ],
  automotive: [
    { key: 'sec:vsoc', kind: 'SOC metric', label: 'Vehicle SOC · 2.1M connected vehicles', detail: () => 'UNECE R155 7.2.2.2(g) monitoring and response', to: '/soc/mdr' },
    { key: 'sec:ota', kind: 'Control', label: 'CTL-OTA-01 · OTA signing in HSM', detail: () => 'UNECE R156 7.1.1 · dual control', to: '/comply/caas?section=frameworks&framework=r156' },
  ],
};

const EV_CACHE = new Map<CustomerId, Record<string, TrEvidence>>();
export function trEvidence(c: CustomerProfile): Record<string, TrEvidence> {
  const hit = EV_CACHE.get(c.id);
  if (hit) return hit;
  const x = ctx(c);
  const r = rng(`tr-ev-${c.id}`);
  const out: Record<string, TrEvidence> = {};
  const add = (e: Omit<TrEvidence, 'ageDays'>, age?: number) => { out[e.key] = { ...e, ageDays: age ?? r.int(1, 40) }; };
  c.frameworks.forEach((f) => add({
    key: `fw:${f.id}`, kind: f.kind === 'Certification' || f.kind === 'Attestation' ? 'Certification' : 'Control', label: f.short,
    detail: `${f.documented}% of in-scope requirements evidenced${f.nextAudit ? ` · next: ${f.nextAudit}` : ''}`, source: 'HexaComply', to: `/comply/caas?section=frameworks&framework=${f.id}`,
  }));
  add({ key: 'ctl:mfa', kind: 'Control', label: 'MFA for remote & privileged access', detail: `${x.idp} conditional access · ${x.pam}`, source: `HexaComply · ${x.idp}`, to: '/fabric/identity' }, r.int(0, 3));
  add({ key: 'ctl:edr', kind: 'Control', label: 'EDR on endpoints and servers', detail: `${x.edr} · tamper protection on`, source: x.edr, to: '/soc/endpoint' }, 0);
  add({ key: 'ctl:bkp', kind: 'Control', label: 'Immutable backups, tested restore', detail: `${x.backup} · last restore test ${r.int(9, 40)} days ago`, source: x.backup, to: '/comply/caas?section=bia' });
  add({ key: 'ctl:vuln', kind: 'Control', label: 'Vulnerability remediation SLAs', detail: `${x.vuln} · mean time to remediate ${x.h.strike.meanTimeToRemediateDays} days`, source: x.vuln, to: '/soc/endpoint' }, r.int(0, 2));
  add({ key: 'ctl:log', kind: 'Control', label: 'Centralised logging & retention', detail: `${x.siem} · ${x.h.soc.detectionsLive} live detections`, source: x.siem, to: '/fabric/integrations' }, 0);
  add({ key: 'ctl:email', kind: 'Control', label: 'Email & phishing protection', detail: x.email, source: x.email, to: '/comply/human' });
  add({ key: 'pol:isp', kind: 'Policy', label: 'Information Security Policy v6.2', detail: `Approved by ${c.people.ciso.name}, annual review`, source: 'HexaComply · Drive', to: '/comply/caas?section=drive' }, r.int(60, 200));
  add({ key: 'pol:ir', kind: 'Policy', label: 'Incident Response Plan v4.1', detail: 'Tabletop exercised, regulator notification playbooks', source: 'HexaComply · Drive', to: '/comply/caas?section=incidents' }, r.int(30, 150));
  add({ key: 'pol:bcp', kind: 'Policy', label: 'Business Continuity & DR Plan', detail: 'BIA-driven RTO/RPO per business service', source: 'HexaComply · BIA', to: '/comply/caas?section=bia' }, r.int(40, 160));
  add({ key: 'pol:crypto', kind: 'Policy', label: 'Cryptography & Key Management Standard', detail: `AES-256 at rest, TLS 1.2+ in transit${c.byok ? ', customer-managed keys (BYOK)' : ''}`, source: 'HexaComply · Drive', to: '/comply/caas?section=drive' }, r.int(60, 220));
  add({ key: 'pol:priv', kind: 'Policy', label: 'Privacy notice & records of processing', detail: `Data residency ${x.residency}`, source: 'HexaComply · Drive', to: '/comply/caas?section=drive' }, r.int(30, 180));
  add({ key: 'pol:ai', kind: 'Policy', label: 'Acceptable AI Use Policy', detail: `${x.h.ai.aiSystems} AI systems inventoried · ${x.h.ai.humanApprovalPct}% human approval on agent actions`, source: 'HexaComply · AI management system', to: '/comply/aigov' }, r.int(20, 90));
  add({ key: 'pt', kind: 'Pen test', label: `Penetration test · ${x.ptDate}`, detail: `${x.pt.scope} · by ${x.pt.by}`, source: 'HexaStrike', to: '/strike/pentest' }, x.pt.daysAgo);
  add({ key: 'asm', kind: 'Pen test', label: 'External attack surface', detail: `${x.h.strike.externalAssets} internet-facing assets under continuous test`, source: 'HexaStrike ASM', to: '/strike/asm' }, 0);
  add({ key: 'soc:mdr', kind: 'SOC metric', label: '24/7 MDR performance', detail: `MTTD ${x.h.soc.mttdMin} min · MTTR ${x.h.soc.mttrMin} min · SLA ${x.h.soc.slaPct}%`, source: 'HexaSOC', to: '/soc/mdr' }, 0);
  add({ key: 'soc:ir', kind: 'SOC metric', label: 'Incident handling record', detail: `${x.h.soc.openIncidents} open incidents, all within SLA`, source: 'HexaSOC', to: '/soc/ir' }, 0);
  add({ key: 'soc:cov', kind: 'SOC metric', label: 'ATT&CK detection coverage', detail: `${x.h.soc.attackCoveragePct}% of priority techniques covered`, source: 'HexaMatrix', to: '/soc/attack' }, 0);
  add({ key: 'ins', kind: 'Insurance', label: `Cyber insurance · ${x.insurer}`, detail: `${x.limit} limit via ${c.insurance.broker}, renews in ${c.insurance.renewalDays} days`, source: 'Cyber Insurance', to: '/insurance/policy' }, r.int(120, 290));
  add({ key: 'tprm', kind: 'Platform', label: 'Third-party risk register', detail: `${x.h.comply.vendors} suppliers tiered, ${x.h.comply.highRiskVendors} high-risk under remediation`, source: 'HexaComply TPRM', to: '/comply/tprm' }, r.int(0, 5));
  add({ key: 'aw', kind: 'Platform', label: 'Awareness & phishing simulation', detail: 'Annual training, monthly simulations, role-based modules', source: 'HexaComply · Human risk', to: '/comply/human' }, r.int(3, 30));
  add({ key: 'res', kind: 'Platform', label: 'Data planes & residency', detail: `${c.dataPlanes.length} data planes · ${x.residency}${c.byok ? ' · BYOK' : ''}`, source: 'HexaCore', to: '/fabric/dataplanes' }, 0);
  add({ key: 'ai', kind: 'Platform', label: 'AI inventory & guardrails', detail: `${x.h.ai.aiSystems} AI systems, ${x.h.ai.shadowAi} shadow AI apps under review`, source: 'HexaAI Governance', to: '/ai-governance/inventory' }, r.int(0, 7));
  add({ key: 'loop', kind: 'Platform', label: 'Closed-loop assurance', detail: 'Control → evidence → detection → validation, proven live', source: 'HexaView', to: '/loop' }, 0);
  forCustomer(SECTOR_EV, c).forEach((e) => add({ key: e.key, kind: e.kind, label: e.label, detail: e.detail(x), source: e.kind === 'Platform' ? 'HexaView' : 'HexaComply', to: e.to }));
  EV_CACHE.set(c.id, out);
  return out;
}

/* ---------------- Answer library ---------------- */
type Role = 'ciso' | 'grc' | 'soc' | 'admin' | 'ot';
interface Tpl { key: string; domain: TrDomain; qs: string[]; a: (x: Ctx) => string; ev: (x: Ctx) => string[]; owner: Role }

const certEv = (x: Ctx) => x.certs.slice(0, 2).map((f) => `fw:${f.id}`);
const fwEv = (x: Ctx, ...ids: string[]) => ids.filter((id) => x.c.frameworks.some((f) => f.id === id)).map((id) => `fw:${id}`);

const GENERIC: Tpl[] = [
  { key: 'isp', domain: 'Governance & policy', owner: 'ciso', ev: (x) => ['pol:isp', ...certEv(x)],
    qs: ['Do you maintain a documented information security policy approved by management?', 'Is there a formal ISMS with defined scope, roles and annual management review?', 'Provide a copy or summary of your information security policy and its review cycle.'],
    a: (x) => `Yes. ${x.c.name} maintains an Information Security Policy (v6.2) approved by the ${x.c.people.ciso.role} and reviewed annually. The ISMS is aligned to ${x.certList}; ${x.h.comply.controlsMetPct}% of in-scope controls are currently met with fresh evidence in HexaComply.` },
  { key: 'certs', domain: 'Governance & policy', owner: 'grc', ev: (x) => x.certs.map((f) => `fw:${f.id}`),
    qs: ['List your current security certifications and attestations, with expiry dates.', 'Do you hold ISO/IEC 27001 certification? Provide the certificate and statement of applicability.', 'Which independent audits or attestations cover the services in scope?'],
    a: (x) => `${x.c.name} holds ${x.certList}. Certificates and the statement of applicability are available on our Trust Portal under NDA; next audits: ${x.certs.filter((f) => f.nextAudit).map((f) => `${f.short} (${f.nextAudit})`).join(', ') || 'per certification cycle'}.` },
  { key: 'risk', domain: 'Governance & policy', owner: 'grc', ev: (x) => ['loop', ...certEv(x).slice(0, 1)],
    qs: ['Describe your information security risk assessment methodology and frequency.', 'How are security risks tracked, owned and reported to senior management?'],
    a: (x) => `Risks are assessed at least annually and on material change, scored on likelihood × impact and tracked in the HexaComply risk register with named owners. A Resilience Index and closed-loop assurance view is reported to the board; ${x.c.people.board.name} receives the quarterly pack.` },
  { key: 'mfa', domain: 'Access control', owner: 'admin', ev: () => ['ctl:mfa', 'loop'],
    qs: ['Is multi-factor authentication enforced for all remote and privileged access?', 'Do you enforce MFA for administrative access to production systems?', 'Describe the authentication controls for workforce access to systems processing our data.'],
    a: (x) => `Yes. MFA is enforced through ${x.idp} for all workforce, remote and privileged access, with phishing-resistant methods for administrators. Privileged credentials are vaulted in ${x.pam}. The control is monitored continuously and its detections validated by HexaStrike.` },
  { key: 'pam', domain: 'Access control', owner: 'admin', ev: () => ['ctl:mfa'],
    qs: ['How are privileged accounts managed, reviewed and monitored?', 'Are administrator sessions recorded and credentials rotated?'],
    a: (x) => `Privileged accounts are vaulted in ${x.pam} with just-in-time elevation, session recording for production and OT access, and automatic rotation. Standing admin rights are reviewed monthly; access reviews for all users run quarterly.` },
  { key: 'jml', domain: 'Access control', owner: 'admin', ev: () => ['ctl:mfa', 'pol:isp'],
    qs: ['Describe your joiner, mover and leaver process. How quickly is access revoked on termination?', 'Are user access reviews performed periodically?'],
    a: (x) => `Joiner/mover/leaver is driven from HR into ${x.idp}; leaver access is revoked within 4 hours of termination (immediately for involuntary leavers). Quarterly access reviews are certified by system owners and evidenced in HexaComply.` },
  { key: 'enc-rest', domain: 'Encryption', owner: 'admin', ev: () => ['pol:crypto'],
    qs: ['Is customer data encrypted at rest? Specify algorithms and key management.', 'Describe encryption of data at rest, including backups.'],
    a: (x) => `Yes. Data at rest is encrypted with AES-256 across databases, object storage and backups. Keys are held in managed HSM-backed key vaults${x.c.byok ? ' with customer-managed keys (BYOK) for the HexaView data plane' : ''}, rotated annually and on suspected compromise.` },
  { key: 'enc-transit', domain: 'Encryption', owner: 'admin', ev: () => ['pol:crypto', 'asm'],
    qs: ['Is data encrypted in transit over public networks? Which TLS versions are supported?', 'Do you disable weak ciphers and legacy protocols?'],
    a: () => 'Yes. All external traffic uses TLS 1.2 or 1.3 with modern cipher suites; TLS 1.0/1.1 and weak ciphers are disabled. Internet-facing endpoints are checked continuously by HexaStrike attack surface management.' },
  { key: 'pentest', domain: 'Vulnerability management', owner: 'soc', ev: () => ['pt', 'asm'],
    qs: ['When was your last independent penetration test, and what was its scope?', 'Do you perform penetration testing at least annually? Can you share an executive summary?', 'Describe your application and infrastructure security testing programme.'],
    a: (x) => `The most recent independent penetration test was completed on ${x.ptDate} (${x.pt.scope}) by ${x.pt.by}. Testing runs at least annually and after major change, with ${x.h.strike.testsThisQuarter} tests this quarter. An executive summary is available on the Trust Portal under NDA.` },
  { key: 'patch', domain: 'Vulnerability management', owner: 'soc', ev: () => ['ctl:vuln', 'asm'],
    qs: ['What are your patching SLAs for critical and high vulnerabilities?', 'How do you identify and remediate vulnerabilities in your environment?'],
    a: (x) => `Assets are scanned continuously with ${x.vuln}. Known-exploited (KEV) vulnerabilities on internet-facing systems are fixed within 72 hours, other criticals within 14 days and highs within 30 days. Mean time to remediate is currently ${x.h.strike.meanTimeToRemediateDays} days.` },
  { key: 'edr', domain: 'Vulnerability management', owner: 'soc', ev: () => ['ctl:edr', 'soc:cov'],
    qs: ['Is anti-malware or EDR deployed on all endpoints and servers?', 'Describe endpoint protection and how coverage is verified.'],
    a: (x) => `Yes. ${x.edr} is deployed on all IT endpoints and servers with tamper protection enabled; coverage gaps are reported daily by HexaView. ${x.h.soc.attackCoveragePct}% of priority ATT&CK techniques have validated detections.` },
  { key: 'logging', domain: 'Logging & monitoring', owner: 'soc', ev: () => ['ctl:log', 'soc:mdr'],
    qs: ['Are security events logged centrally and monitored 24/7?', 'What is your log retention period and how are logs protected from tampering?'],
    a: (x) => `Yes. Security logs flow to ${x.siem} and are monitored 24/7 by HexaSOC managed detection and response (MTTD ${x.h.soc.mttdMin} min, MTTR ${x.h.soc.mttrMin} min). Logs are retained for at least 12 months, write-once, with integrity anchoring.` },
  { key: 'soc', domain: 'Logging & monitoring', owner: 'soc', ev: () => ['soc:mdr', 'soc:cov'],
    qs: ['Do you operate a security operations centre? Is it in-house or outsourced?', 'How do you detect and triage security alerts out of hours?'],
    a: (x) => `${x.c.name} runs a hybrid SOC: the in-house team led by ${x.c.people.socLead.name} works with HexaSOC 24/7 MDR. ${x.h.soc.autoTriagedPct}% of ${x.h.soc.alerts24h.toLocaleString('en-GB')} daily alerts are auto-triaged; analysts handle the remainder within a ${x.h.soc.slaPct}% SLA.` },
  { key: 'ir', domain: 'Incident response', owner: 'soc', ev: () => ['pol:ir', 'soc:ir'],
    qs: ['Do you have a documented incident response plan? How often is it tested?', 'Describe your incident response process and escalation paths.'],
    a: () => 'Yes. The Incident Response Plan (v4.1) defines severity levels, roles, escalation and regulator/customer notification. It is tested at least twice a year through tabletop exercises and HexaStrike purple-team scenarios, with lessons learned tracked to closure.' },
  { key: 'notify', domain: 'Incident response', owner: 'grc', ev: () => ['pol:ir'],
    qs: ['Within what timeframe will you notify us of a security incident affecting our data?', 'Will you notify customers of breaches, and through which channel?'],
    a: () => 'We notify affected customers without undue delay and in any case within 24 hours of confirming an incident that affects their data or service, through the named security contact and account team, followed by a written report within 72 hours.' },
  { key: 'bcp', domain: 'BCP & resilience', owner: 'grc', ev: () => ['pol:bcp', 'ctl:bkp'],
    qs: ['Do you maintain a business continuity and disaster recovery plan? When was it last tested?', 'What are your RTO and RPO for the services provided to us?'],
    a: (x) => `Yes. The Business Continuity & DR Plan is driven by a business impact analysis per service. Critical services target an RTO of 4 hours and an RPO of 15 minutes; DR is tested at least annually and backups restore-tested quarterly via ${x.backup}.` },
  { key: 'backup', domain: 'BCP & resilience', owner: 'admin', ev: () => ['ctl:bkp'],
    qs: ['Are backups immutable or offline, and are restores tested?', 'Describe your ransomware resilience measures.'],
    a: (x) => `Backups are immutable (WORM) and logically air-gapped in ${x.backup}, with privileged access separated from production identity. Restore tests run quarterly; ransomware scenarios are rehearsed and detections for T1490/T1486 are validated by HexaStrike.` },
  { key: 'insurance', domain: 'BCP & resilience', owner: 'grc', ev: () => ['ins'],
    qs: ['Do you carry cyber insurance? State the limit and provide a certificate of insurance.', 'Please confirm your professional indemnity and cyber liability cover.'],
    a: (x) => `Yes. ${x.c.name} carries cyber insurance led by ${x.insurer} with a ${x.limit} aggregate limit, placed through ${x.c.insurance.broker}. A certificate of insurance is available on request through the Trust Portal.` },
  { key: 'tprm', domain: 'Vendor management', owner: 'grc', ev: () => ['tprm'],
    qs: ['How do you assess and monitor the security of your own suppliers and sub-processors?', 'Do you maintain an inventory of fourth parties with access to customer data?'],
    a: (x) => `All ${x.h.comply.vendors} suppliers are tiered by criticality and data access in the HexaComply third-party register. Critical suppliers are assessed before onboarding and annually, monitored continuously with external ratings, and contractually bound to equivalent security terms.` },
  { key: 'subproc', domain: 'Vendor management', owner: 'grc', ev: () => ['tprm', 'pol:priv'],
    qs: ['List sub-processors that will store or process our data.', 'Will you notify us before engaging a new sub-processor?'],
    a: () => 'The current sub-processor list is published on the Trust Portal. We give at least 30 days\' notice of new sub-processors handling customer data and flow down equivalent data-protection obligations.' },
  { key: 'residency', domain: 'Data residency & privacy', owner: 'grc', ev: () => ['res', 'pol:priv'],
    qs: ['Where will our data be stored and processed? Can data residency be guaranteed?', 'Is any customer data transferred outside the region? Under which mechanism?'],
    a: (x) => `Customer data is stored and processed in ${x.residency}. Security telemetry is processed in a ${x.c.deployment.toLowerCase()} model, so raw data stays inside our boundary. Any transfer relies on approved mechanisms (SCCs / adequacy) recorded in our records of processing.` },
  { key: 'privacy', domain: 'Data residency & privacy', owner: 'grc', ev: () => ['pol:priv'],
    qs: ['Do you have a data protection officer and a privacy programme?', 'How do you handle data subject requests and data deletion at contract end?'],
    a: () => 'Yes. A named data protection lead owns the privacy programme, records of processing and DPIAs. Data subject requests are handled within statutory timelines; on contract end customer data is returned or deleted within 30 days, with a certificate of deletion on request.' },
  { key: 'ai', domain: 'AI use', owner: 'ciso', ev: () => ['pol:ai', 'ai'],
    qs: ['Do you use AI or machine learning on customer data? Is customer data used to train models?', 'Describe your governance of generative AI tools used by staff.', 'Do you have an AI acceptable use policy and an inventory of AI systems?'],
    a: (x) => `Customer data is never used to train third-party models. ${x.c.name} maintains an inventory of ${x.h.ai.aiSystems} AI systems under an Acceptable AI Use Policy aligned to ISO/IEC 42001; ${x.h.ai.shadowAi} unsanctioned AI apps are under review and blocked where they could receive customer data. Agentic actions require ${x.h.ai.humanApprovalPct}% human approval.` },
  { key: 'awareness', domain: 'People & awareness', owner: 'grc', ev: () => ['aw', 'ctl:email'],
    qs: ['Do all staff complete security awareness training? How often?', 'Do you run phishing simulations?'],
    a: (x) => `All staff complete security awareness training at induction and annually, with role-based modules for privileged and engineering roles. Monthly phishing simulations run through ${x.email}; repeat clickers receive targeted coaching.` },
  { key: 'screening', domain: 'People & awareness', owner: 'grc', ev: () => ['pol:isp'],
    qs: ['Are background checks performed on employees with access to customer data?', 'Are staff bound by confidentiality agreements?'],
    a: () => 'Yes. Background screening proportionate to role and local law is completed before access is granted, and all staff and contractors sign confidentiality agreements as part of their contract.' },
];

const SECTOR_TPL: CustomerMap<Tpl[]> = {
  maritime: [
    { key: 'm-e26', domain: 'Sector', owner: 'ot', ev: (x) => ['sec:e26', ...fwEv(x, 'iacs')],
      qs: ['Are newbuild and retrofitted vessels compliant with IACS UR E26 and E27?', 'Describe how cyber resilience of onboard systems is maintained across the fleet.'],
      a: (x) => `Yes. Newbuilds are delivered against IACS UR E26/E27 with class approval, and the existing fleet follows the same zone/conduit model. ${x.c.frameworks.find((f) => f.id === 'iacs')?.documented ?? 70}% of E26/E27 requirements are evidenced; vessel telemetry is monitored store-and-forward via HexaOT.` },
    { key: 'm-remote', domain: 'Sector', owner: 'ot', ev: () => ['sec:e26', 'ctl:mfa'],
      qs: ['How is vendor remote access to terminal OT (cranes, TOS, gate systems) controlled?', 'Is remote access to vessel OT brokered and recorded?'],
      a: (x) => `All vendor remote access to terminal and vessel OT is brokered through ${x.pam} jump hosts with MFA, time-bound approval and full session recording (IEC 62443 SR 1.13, IACS E26 4.2.2). Direct inbound access is not permitted.` },
    { key: 'm-ot', domain: 'Sector', owner: 'ot', ev: () => ['sec:ot'],
      qs: ['Do you maintain an inventory of OT assets and monitor OT networks?', 'How are IT and OT networks segregated at your terminals?'],
      a: (x) => `Yes. HexaOT maintains a live inventory of ${x.h.ot.otAssets.toLocaleString('en-GB')} OT assets across ${x.h.ot.sites} sites with passive monitoring. Terminals use a Level 3.5 DMZ between IT and OT (IEC 62443-3-3 SR 5.1); OT monitoring is read-only by policy.` },
    { key: 'm-bimco', domain: 'Sector', owner: 'grc', ev: (x) => fwEv(x, 'imo', 'isps'),
      qs: ['Will you accept the BIMCO Cyber Security Clause in the charter party?', 'Is cyber risk addressed in your Safety Management System per IMO MSC.428(98)?'],
      a: () => 'Yes. We accept the BIMCO Cyber Security Clause, and cyber risk management is incorporated into the Safety Management System in line with IMO MSC.428(98), verified at the DoC audit. ISPS port facility plans include the cyber annex.' },
  ],
  finserv: [
    { key: 'f-dora', domain: 'Sector', owner: 'grc', ev: () => ['sec:dora'],
      qs: ['Provide the information required for our DORA register of information (Art. 28).', 'Do you support the contractual provisions required under DORA Art. 30?'],
      a: (x) => `Yes. ${x.c.name} supports DORA Art. 30 contractual provisions, including service levels, audit and access rights, incident notification, exit and termination assistance. Register-of-information data (LEI, service descriptions, locations, sub-contracting chain) is pre-populated from HexaComply.` },
    { key: 'f-tlpt', domain: 'Sector', owner: 'soc', ev: () => ['pt'],
      qs: ['Will you participate in threat-led penetration testing (TLPT) where required?', 'Describe your red-team testing programme.'],
      a: (x) => `Yes. We run CBEST/TIBER-style intelligence-led red teaming (last cycle Q2) alongside annual penetration testing; the latest test completed ${x.ptDate}. We will participate in pooled TLPT where our service is in scope of a customer's critical functions.` },
    { key: 'f-pci', domain: 'Sector', owner: 'grc', ev: (x) => fwEv(x, 'pci', 'swift'),
      qs: ['Are you PCI DSS compliant for the services in scope? Provide your AOC.', 'Do you attest to the SWIFT Customer Security Controls Framework?'],
      a: (x) => `Yes. Aldersgate Payments is PCI DSS v4.0.1 Level 1 (Attestation of Compliance available under NDA, next QSA visit ${x.c.frameworks.find((f) => f.id === 'pci')?.nextAudit ?? 'annually'}) and attests annually to SWIFT CSCF with independent assessment.` },
    { key: 'f-exit', domain: 'Sector', owner: 'grc', ev: () => ['sec:dora', 'pol:bcp'],
      qs: ['Do you have documented exit plans for the services you provide to us?', 'How do you support impact tolerances under FCA/PRA operational resilience rules?'],
      a: () => 'Yes. Documented and tested exit plans exist for each important business service, with data return in agreed formats. Impact tolerances are mapped to our own important business services and tested in severe-but-plausible scenarios annually.' },
  ],
  media: [
    { key: 'p-tpn', domain: 'Sector', owner: 'grc', ev: (x) => fwEv(x, 'tpn', 'mpa'),
      qs: ['Do you hold a current TPN shield? Which status?', 'Are you assessed against the MPA Content Security Best Practices?'],
      a: (x) => `Yes. ${x.c.name} holds TPN Gold Shield status (${x.c.frameworks.find((f) => f.id === 'tpn')?.nextAudit ?? 'annual re-assessment'}) and is assessed against MPA CSBP; ${x.c.frameworks.find((f) => f.id === 'mpa')?.documented ?? 77}% of in-scope best practices are evidenced in HexaComply.` },
    { key: 'p-custody', domain: 'Sector', owner: 'grc', ev: () => ['sec:custody', 'sec:wm'],
      qs: ['How is pre-release content tracked and protected end to end, including at vendors?', 'Are screeners and review links forensically watermarked?'],
      a: (x) => `Pre-release content is tracked by HexaCustody agents from ingest to delivery (${x.h.custody.assetsUnderCustody.toLocaleString('en-GB')} assets in custody), including at ${x.h.custody.vendorsInChain} vendors. Screeners and review links carry session-based forensic watermarks and access can be revoked instantly.` },
    { key: 'p-net', domain: 'Sector', owner: 'admin', ev: () => ['pol:isp'],
      qs: ['Is the content production network isolated from the internet?', 'Are edit bays blocked from personal cloud storage and removable media?'],
      a: () => 'Yes. Content networks are isolated with no direct internet access (MPA DS-1.0, TPN NS-2.0). Edit bays block personal cloud storage, removable media and personal devices; transfers use the approved managed transfer service only.' },
    { key: 'p-leak', domain: 'Sector', owner: 'soc', ev: () => ['soc:ir', 'sec:custody'],
      qs: ['Describe your content leak response process.', 'How quickly can access to leaked or at-risk content be revoked?'],
      a: () => 'A dedicated content-leak playbook covers watermark extraction, source identification, takedown and studio notification within 24 hours. HexaCustody revokes keys to at-risk assets in seconds, across vendors.' },
  ],
  healthcare: [
    { key: 'h-baa', domain: 'Sector', owner: 'grc', ev: (x) => fwEv(x, 'hipaa', 'hitrust'),
      qs: ['Will you sign a Business Associate Agreement and comply with the HIPAA Security Rule?', 'Do you hold HITRUST certification?'],
      a: (x) => `Yes. ${x.c.name} complies with the HIPAA Security Rule (${x.c.frameworks.find((f) => f.id === 'hipaa')?.documented ?? 80}% of safeguards evidenced) and executes BAAs with partners. HITRUST CSF r2 is in place, with the next validated assessment ${x.c.frameworks.find((f) => f.id === 'hitrust')?.nextAudit ?? 'annually'}.` },
    { key: 'h-ephi', domain: 'Sector', owner: 'grc', ev: () => ['sec:ephi'],
      qs: ['How is access to ePHI logged and reviewed?', 'Do you monitor for inappropriate access to patient records?'],
      a: () => 'All access to ePHI in the EHR and PACS is logged (HIPAA 164.312(b)); privacy monitoring flags inappropriate access (VIP, family, co-worker records) for daily review. Break-the-glass access is reviewed within 24 hours.' },
    { key: 'h-md', domain: 'Sector', owner: 'ot', ev: () => ['sec:md'],
      qs: ['How are connected medical devices inventoried and segmented?', 'Describe your medical device security programme (FDA 524B, procurement requirements).'],
      a: (x) => `HexaOT maintains a live inventory of ${x.h.ot.otAssets.toLocaleString('en-GB')} connected medical devices with passive monitoring. Devices sit on segmented clinical VLANs without internet access; procurement requires an SBOM and FDA 524B evidence, and biomed vendor access is brokered and recorded.` },
    { key: 'h-downtime', domain: 'Sector', owner: 'grc', ev: () => ['pol:bcp', 'ctl:bkp'],
      qs: ['Describe EHR downtime procedures and recovery capability.', 'How would patient care continue during a ransomware event?'],
      a: (x) => `Clinical downtime procedures (read-only EHR, paper workflows, downtime PCs) are exercised quarterly. Epic and critical clinical systems have immutable backups in ${x.backup} with tested recovery, aligned to HHS HPH CPG 2.9.` },
  ],
  automotive: [
    { key: 'a-tisax', domain: 'Sector', owner: 'grc', ev: (x) => fwEv(x, 'tisax', 'iso27001'),
      qs: ['Do you hold a valid TISAX label? Which assessment level and objectives?', 'Provide your VDA ISA self-assessment results.'],
      a: (x) => `Yes. ${x.c.name} holds TISAX AL3 labels for information with very high protection needs, prototype protection and data protection (${x.c.frameworks.find((f) => f.id === 'tisax')?.nextAudit ?? 'renewal due'}). Results are shared via the ENX portal on request.` },
    { key: 'a-proto', domain: 'Sector', owner: 'grc', ev: () => ['pol:isp'],
      qs: ['How are prototypes, test vehicles and design data protected?', 'Describe controls for prototype protection (VDA ISA module 8).'],
      a: () => 'Prototype parts and vehicles are handled in access-controlled zones with camouflage, photography bans and registered transport. Design data in PLM is classified, access is need-to-know with MFA, and exfiltration is monitored (TISAX 8.1).' },
    { key: 'a-csms', domain: 'Sector', owner: 'ciso', ev: () => ['sec:vsoc', 'sec:ota'],
      qs: ['Do you operate a certified CSMS under UNECE R155 and an SUMS under R156?', 'How are connected vehicles monitored for cyber attacks?'],
      a: () => 'Yes. Our CSMS (R155) and SUMS (R156) are certified by the type-approval authority. A vehicle SOC monitors 2.1M connected vehicles; OTA packages are signed in an HSM under dual control and every campaign is traceable.' },
    { key: 'a-plant', domain: 'Sector', owner: 'ot', ev: (x) => ['ctl:mfa', ...fwEv(x, 'iec62443')],
      qs: ['How is supplier remote access to production equipment controlled?', 'Describe IT/OT segmentation at your plants.'],
      a: (x) => `Supplier remote access to robot cells and PLCs is brokered through ${x.pam} with MFA, approval and session recording (IEC 62443 SR 1.13, TISAX 4.1.3). Plants use a Level 3.5 DMZ; the battery cell plant is air-gapped with one-way data export.` },
  ],
};

/** Questions with no library match: these need a human. */
const NOVEL: { domain: TrDomain; q: string }[] = [
  { domain: 'Encryption', q: 'Describe your roadmap for post-quantum cryptography migration.' },
  { domain: 'Governance & policy', q: 'Do you hold a Cyber Essentials Plus certificate? If not, explain why.' },
  { domain: 'Vendor management', q: 'Is source-code escrow available for any software you supply to us?' },
  { domain: 'People & awareness', q: 'Do any staff with access to our data work from jurisdictions on our restricted list?' },
  { domain: 'Data residency & privacy', q: 'Confirm whether any support personnel can access our data from outside the EEA, and under what controls.' },
  { domain: 'AI use', q: 'Will any AI agent take autonomous actions in systems that hold our data? Describe the kill switch.' },
  { domain: 'BCP & resilience', q: 'Provide the results of your last full-site failover, including actual recovery times.' },
  { domain: 'Incident response', q: 'Have you suffered a reportable security incident in the last 36 months? Provide details.' },
  { domain: 'Logging & monitoring', q: 'Can you stream security events relating to our tenant into our own SIEM in near real time?' },
  { domain: 'Access control', q: 'Do you support SCIM provisioning and SAML federation with our identity provider for named users?' },
  { domain: 'Governance & policy', q: 'Please confirm your ESG and modern-slavery statement covers your security suppliers.' },
  { domain: 'Vulnerability management', q: 'Do you operate a public vulnerability disclosure or bug bounty programme?' },
];

export interface TrLibAnswer {
  id: string;
  key: string;
  domain: TrDomain;
  question: string;
  variants: string[];
  answer: string;
  /** Text as last approved, when it no longer matches current evidence. */
  answerStale?: string;
  ev: string[];
  owner: string;
  ownerRole: Role;
  reviewedDays: number;
  usage: number;
  usage90: number;
  stale: boolean;
  staleReason?: string;
  versions: { v: string; daysAgo: number; by: string; note: string }[];
}

function roleName(c: CustomerProfile, r: Role): string {
  return r === 'ciso' ? c.people.ciso.name : r === 'grc' ? c.people.grcLead.name : r === 'soc' ? c.people.socLead.name : r === 'ot' ? (c.people.otLead ?? c.people.admin).name : c.people.admin.name;
}

const STALE_REASONS: Record<string, (x: Ctx) => string> = {
  pentest: (x) => `HexaStrike completed a new penetration test on ${x.ptDate}; the approved answer still cites the previous test date.`,
  insurance: (x) => `Policy renewal is ${x.c.insurance.renewalDays} days out and the broker issued revised terms; confirm limit and carrier before reuse.`,
  bcp: () => 'The BIA was re-run after the last DR test: two business services now carry a tighter RTO than the answer states.',
  ai: (x) => `The AI inventory changed: ${x.h.ai.shadowAi} unsanctioned AI apps were discovered since the answer was approved.`,
  backup: (x) => `${x.backup} evidence is older than the 30-day freshness window on one tenant.`,
  certs: (x) => `${x.certs.find((f) => f.nextAudit)?.short ?? 'A certification'} audit date moved; the certificate list needs re-confirming.`,
};

const LIB_CACHE = new Map<CustomerId, TrLibAnswer[]>();
export function trLibrary(c: CustomerProfile): TrLibAnswer[] {
  const hit = LIB_CACHE.get(c.id);
  if (hit) return hit;
  const x = ctx(c);
  const r = rng(`tr-lib-${c.id}`);
  const tpls = [...GENERIC, ...forCustomer(SECTOR_TPL, c)];
  const staleKeys = new Set(r.pickN(Object.keys(STALE_REASONS), c.dataKey === 'finserv' ? 3 : 4));
  const editors = [c.people.grcLead.name, c.people.ciso.name, c.people.socLead.name, c.people.admin.name];
  const out = tpls.map((t, i) => {
    const stale = staleKeys.has(t.key);
    const reviewedDays = stale ? r.int(70, 160) : r.int(4, 85);
    const nv = r.int(2, 5);
    const versions = Array.from({ length: nv }, (_, k) => {
      const d = k === 0 ? reviewedDays : reviewedDays + k * r.int(60, 140);
      return { v: `v${nv - k}.${k === 0 ? 0 : r.int(0, 3)}`, daysAgo: d, by: k === 0 ? roleName(c, t.owner) : r.pick(editors), note: k === nv - 1 ? 'First approved from HexaComply evidence' : r.pick(['Evidence refreshed after audit', 'Wording tightened after customer follow-up', 'Updated tool names after migration', 'Added metrics from HexaView', 'Legal review of commitment language', 'Scope extended to new tenant']) };
    });
    const usage = r.int(6, 140);
    const answer = t.a(x);
    const answerStale = stale && t.key === 'pentest' ? answer.replace(x.ptDate, fmtDate(daysAgo(x.pt.daysAgo + 182))) : undefined;
    return {
      id: `ANS-${String(101 + i)}`, key: t.key, domain: t.domain, question: t.qs[0], variants: t.qs, answer, answerStale, ev: t.ev(x).filter((k) => !!trEvidence(c)[k]),
      owner: roleName(c, t.owner), ownerRole: t.owner, reviewedDays, usage, usage90: Math.round(usage * r.float(0.15, 0.4, 2)), stale, staleReason: stale ? STALE_REASONS[t.key](x) : undefined, versions,
    };
  });
  LIB_CACHE.set(c.id, out);
  return out;
}

/* ---------------- Questionnaires ---------------- */
export interface TrQuestionnaire {
  id: string;
  requester: string;
  requesterKind: string;
  contact: string;
  tenantId: string;
  format: TrFormatId;
  questions: number;
  receivedDaysAgo: number;
  dueInDays: number;
  status: TrStatus;
  dealValue: number;
  dealStage: string;
  owner: string;
  sentDaysAgo?: number;
  turnaroundDays?: number;
  imported?: boolean;
}

type ReqSeed = [string, string, string, TrFormatId, number]; // name, kind, tenant, format, deal value in M
const REQUESTERS: CustomerMap<ReqSeed[]> = {
  maritime: [
    ['Northwind Container Line', 'Shipping line (berth contract)', 'rtm', 'bimco', 6.4],
    ['Meridian Reefer Logistics', 'Shipper (reefer cargo)', 'fleet', 'sig-lite', 1.2],
    ['Norhaven Retail Group', 'Beneficial cargo owner', 'fleet', 'sig-core', 4.8],
    ['Pelorus Energy Trading', 'Energy trader (liquid bulk)', 'rtm', 'iso', 2.1],
    ['Zephyr Pharma Logistics', 'GDP cold-chain forwarder', 'fleet', 'custom', 0.9],
    ['Coastline Agri Exports', 'Agri exporter', 'sts', 'sig-lite', 0.7],
    ['Delta Coast Feeder Services', 'Feeder operator', 'pkl', 'bimco', 1.6],
    ['Harbourlight Customs Brokers', 'Customs broker (API integration)', 'hq', 'caiq', 0.4],
    ['Ostrander Steel Imports', 'Break-bulk importer', 'ant', 'custom', 1.1],
    ['Kittiwake Freight Forwarding', 'Freight forwarder', 'hq', 'sig-lite', 0.6],
    ['Lindenhall Vehicle Logistics', 'RoRo vehicle logistics', 'ant', 'iso', 2.7],
    ['Tasman Bay Lines', 'Shipping line (Asia loop)', 'pkl', 'bimco', 3.9],
    ['Bluefin Offshore Supply', 'Offshore charterer', 'fleet', 'bimco', 2.3],
    ['Graniteview Mining Exports', 'Bulk exporter', 'sts', 'custom', 1.4],
  ],
  finserv: [
    ['Eastmere Building Society', 'Payments processing client', 'pay', 'dora', 2.6],
    ['Larkspur Pension Trustees', 'Institutional client', 'markets', 'sig-core', 1.8],
    ['Halberd Retail Group', 'Merchant acquiring client', 'pay', 'sig-lite', 0.9],
    ['Corvid Treasury Services', 'Corporate banking client', 'ukbank', 'custom', 0.5],
    ['Fenwick Lane Capital', 'Prime brokerage client', 'markets', 'caiq', 1.3],
    ['Saltmarsh Insurance Group', 'Corporate banking client', 'ukbank', 'iso', 0.8],
    ['Banca Valdera S.p.A.', 'Correspondent bank (EU)', 'eu', 'dora', 3.4],
    ['Caisse Rhénane de Crédit', 'Payments processing client (EU)', 'eu', 'dora', 2.2],
    ['Orrin Pay Ltd', 'Banking-as-a-service partner', 'pay', 'caiq', 1.6],
    ['Tamsin & Rowe Family Office', 'Private banking client', 'wealth', 'sig-lite', 0.3],
    ['Quillon Asset Management', 'Custody & markets client', 'markets', 'sig-core', 2.9],
    ['Mardale Housing Group', 'Corporate banking client', 'ukbank', 'custom', 0.4],
    ['Lindqvist Treasury AB', 'Cash management client (EU)', 'eu', 'dora', 1.1],
    ['Pennant Travel plc', 'Merchant acquiring client', 'pay', 'sig-lite', 0.7],
  ],
  media: [
    ['Lumen Arc Streaming', 'Streaming licensee', 'studios', 'tpn', 5.2],
    ['Albatross Broadcasting Corp', 'Broadcast licensee', 'live', 'custom', 2.4],
    ['Cobalt Bay Studios', 'Co-production partner', 'post', 'tpn', 3.1],
    ['Saffron Screen Distribution', 'International distributor', 'studios', 'tpn', 1.9],
    ['Harrow & Vine Advertising', 'Ad-tier agency', 'play', 'sig-lite', 0.8],
    ['Northlight Cinemas', 'Theatrical exhibitor', 'studios', 'custom', 0.6],
    ['Talbot Sports Media', 'Sports rights holder', 'live', 'sig-lite', 4.4],
    ['Vespertine Pictures', 'VFX client studio', 'post', 'tpn', 1.7],
    ['Ardent Kids Network', 'Kids channel licensee', 'studios', 'caiq', 1.2],
    ['Glasshouse Music Group', 'Music rights partner', 'play', 'iso', 0.5],
    ['Marigold Streaming APAC', 'Streaming licensee (APAC)', 'play', 'caiq', 2.8],
    ['Redwing Airlines Inflight', 'Inflight entertainment licensee', 'studios', 'custom', 0.9],
  ],
  healthcare: [
    ['Buckeye Valley Health Plan', 'Payer (value-based contract)', 'mrmc', 'hipaa', 11.5],
    ['Corrin Therapeutics', 'Clinical trial sponsor', 'research', 'sig-lite', 2.2],
    ['Prairie Mutual Health Plan', 'Payer', 'clinics', 'hipaa', 6.8],
    ['Larchmont Genomics', 'Genomics research partner', 'research', 'caiq', 1.4],
    ['Tri-County Accountable Care', 'ACO partner', 'community', 'hipaa', 3.9],
    ['Summit Ridge University', 'Academic affiliate', 'research', 'iso', 0.8],
    ['Halvorsen Pharma Research', 'Clinical trial sponsor', 'research', 'sig-core', 4.6],
    ['Northfield Employer Health Coalition', 'Direct-to-employer contract', 'clinics', 'sig-lite', 2.9],
    ['Thamesbridge Clinical Research (UK)', 'UK research partner', 'research', 'dspt', 1.1],
    ['Keystone Workers Comp Mutual', 'Workers comp carrier', 'mrmc', 'custom', 1.7],
    ['Cardinal Valley Reference Labs', 'Reference lab partner', 'community', 'hipaa', 0.9],
    ['Westmark Paediatric Partners', 'Paediatric network partner', 'kids', 'custom', 1.3],
  ],
  automotive: [
    ['Nordwerk Fahrzeugbau AG', 'E-drive customer (OEM)', 'gyor', 'tisax', 38],
    ['Rheinflotte Fleet Services GmbH', 'Fleet telematics customer', 'connected', 'custom', 6.4],
    ['Ostrava Mobility Leasing a.s.', 'Leasing partner', 'retail', 'sig-lite', 4.1],
    ['Città Car Sharing S.p.A.', 'Car-sharing fleet', 'connected', 'caiq', 9.2],
    ['Helvet Fleet AG', 'Corporate fleet', 'connected', 'iso', 3.3],
    ['Kjelsberg Energy Storage AS', 'Battery cell customer', 'battery', 'tisax', 24],
    ['Lyonnaise de Location SAS', 'Rental fleet', 'retail', 'sig-lite', 5.6],
    ['Fahrwerk Ost Nutzfahrzeuge GmbH', 'Powertrain customer', 'gyor', 'tisax', 17],
    ['Vantor Autonomous Systems', 'R&D joint venture', 'group', 'tisax', 12],
    ['Meseta Rent-a-Car S.A.', 'Rental fleet (Iberia)', 'retail', 'sig-core', 7.8],
    ['Velora Ride-Hailing', 'Ride-hailing fleet', 'connected', 'caiq', 4.9],
    ['Aztlan Fleet Leasing', 'Fleet leasing (Mexico)', 'puebla', 'custom', 2.6],
  ],
};

const FIRST = ['Amelia', 'Jonas', 'Priya', 'Marco', 'Claire', 'Tomasz', 'Hannah', 'Rui', 'Fiona', 'Daniel', 'Sara', 'Lars', 'Nadia', 'Oliver', 'Ines', 'Kwame', 'Elena', 'Yusuf'];
const LAST = ['Whitfield', 'Brenner', 'Desai', 'Lombardi', 'Fournier', 'Nowak', 'Achterberg', 'Costa', 'MacLeod', 'Okafor', 'Lindgren', 'Varga', 'Haddad', 'Pryce', 'Sandoval', 'Mensah', 'Rossi', 'Kaya'];
const CONTACT_ROLE = ['Vendor Risk Manager', 'Procurement Lead', 'Third-Party Risk Analyst', 'Head of Supplier Assurance', 'Information Security Officer', 'Category Manager'];
const DEAL_STAGES = ['New business', 'Renewal', 'Expansion', 'Contract variation'];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14);
}

const QN_CACHE = new Map<CustomerId, TrQuestionnaire[]>();
export function trQuestionnairesBase(c: CustomerProfile): TrQuestionnaire[] {
  const hit = QN_CACHE.get(c.id);
  if (hit) return hit;
  const r = rng(`tr-qn-${c.id}`);
  const statuses: TrStatus[] = ['Received', 'Drafting', 'In review', 'In review', 'Approved', 'Sent', 'Sent', 'Sent', 'Drafting', 'In review', 'Sent', 'Received', 'Sent', 'In review'];
  const owners = [c.people.grcLead.name, c.people.grcLead.name, c.people.ciso.name, c.people.admin.name];
  const out = forCustomer(REQUESTERS, c).map(([name, kind, tenant, format, dealM], i) => {
    const f = TR_FORMAT_BY_ID[format];
    const status = statuses[i % statuses.length];
    const received = status === 'Sent' ? r.int(6, 80) : status === 'Received' ? r.int(0, 1) : r.int(1, 6);
    const turnaround = status === 'Sent' ? r.float(0.6, 2.6, 1) : undefined;
    const fn = r.pick(FIRST);
    const ln = r.pick(LAST);
    return {
      id: `SQ-${2410 + i * 7 + r.int(0, 5)}`, requester: name, requesterKind: kind, contact: `${fn} ${ln} · ${r.pick(CONTACT_ROLE)} · ${fn[0].toLowerCase()}.${ln.toLowerCase()}@${slug(name)}.example`,
      tenantId: c.tenants.some((t) => t.id === tenant) ? tenant : c.tenants[0].id, format, questions: r.int(f.range[0], f.range[1]),
      receivedDaysAgo: received, dueInDays: status === 'Sent' ? 0 : r.int(-1, 18), status, dealValue: Math.round(dealM * 1e6 * r.float(0.85, 1.15, 2)),
      dealStage: r.pick(DEAL_STAGES), owner: r.pick(owners), sentDaysAgo: status === 'Sent' ? Math.max(0, received - Math.ceil(turnaround ?? 1)) : undefined, turnaroundDays: turnaround,
    };
  });
  QN_CACHE.set(c.id, out);
  return out;
}

/* ---------------- Questions ---------------- */
export interface TrQuestion {
  id: string;
  n: number;
  domain: TrDomain;
  text: string;
  libId: string | null;
  answer: string;
  confidence: number;
  ev: string[];
  state: TrQState;
  assignee: string | null;
  edited?: boolean;
  approvedBy?: string;
}

const SME_ROLE: Record<TrDomain, Role> = {
  'Governance & policy': 'ciso', 'Access control': 'admin', Encryption: 'admin', 'Vulnerability management': 'soc', 'Logging & monitoring': 'soc', 'Incident response': 'soc',
  'BCP & resilience': 'grc', 'Vendor management': 'grc', 'Data residency & privacy': 'grc', 'AI use': 'ciso', 'People & awareness': 'grc', Sector: 'ot',
};
export function trSme(c: CustomerProfile, d: TrDomain): string {
  return roleName(c, SME_ROLE[d]);
}
export function trPeople(c: CustomerProfile): string[] {
  const p = c.people;
  return Array.from(new Set([p.grcLead.name, p.ciso.name, p.socLead.name, p.admin.name, ...(p.otLead ? [p.otLead.name] : []), ...p.staff.filter((s) => !s.vip).slice(0, 3).map((s) => s.name)]));
}

type GenMode = TrStatus | 'fresh' | 'undrafted';
const Q_CACHE = new Map<string, TrQuestion[]>();
export function trQuestionsBase(c: CustomerProfile, qn: TrQuestionnaire, mode: GenMode): TrQuestion[] {
  const ck = `${c.id}:${qn.id}:${mode}`;
  const hit = Q_CACHE.get(ck);
  if (hit) return hit;
  const r = rng(`tr-qs-${c.id}-${qn.id}`);
  const lib = trLibrary(c);
  const sectorLib = lib.filter((l) => l.domain === 'Sector');
  const fmt = TR_FORMAT_BY_ID[qn.format];
  const sectorW = fmt.sector ? 0.45 : 0.08;
  const novelP = qn.format === 'custom' ? 0.14 : fmt.sector ? 0.07 : 0.05;
  const counters: Record<string, number> = {};
  const approveP = r.float(0.3, 0.7, 2);
  const out: TrQuestion[] = [];
  for (let i = 0; i < qn.questions; i++) {
    const novel = r() < novelP;
    let domain: TrDomain;
    let text: string;
    let l: TrLibAnswer | null = null;
    if (novel) {
      const nq = r.pick(NOVEL);
      domain = nq.domain;
      text = nq.q;
    } else {
      l = r() < sectorW && sectorLib.length ? r.pick(sectorLib) : r.pick(lib);
      domain = l.domain;
      text = r.pick(l.variants);
    }
    const code = TR_DOMAINS.find((d) => d.id === domain)!.code;
    counters[code] = (counters[code] ?? 0) + 1;
    const id = `${code}-${String(counters[code]).padStart(2, '0')}`;
    let state: TrQState;
    let answer = l ? l.answer : '';
    let confidence = l ? r.int(84, 98) : r.int(22, 48);
    if (l?.stale) confidence -= r.int(16, 24);
    if (l && r() < 0.08) confidence -= r.int(10, 18); // wording only partially matches
    let assignee: string | null = null;
    if (mode === 'undrafted') { state = 'Needs input'; answer = ''; confidence = 0; }
    else if (mode === 'Approved' || mode === 'Sent') { state = 'Approved'; if (!l) { answer = `${trSme(c, domain)} confirmed: see attached response note.`; confidence = 100; } }
    else if (mode === 'In review') {
      if (l) state = r() < approveP ? 'Approved' : 'Drafted';
      else if (r() < 0.55) { state = 'Drafted'; answer = 'SME response: we can provide this on request; detailed statement attached for your review.'; confidence = r.int(60, 75); assignee = trSme(c, domain); }
      else { state = 'Flagged'; assignee = trSme(c, domain); }
    } else if (mode === 'Drafting') {
      if (l) state = r() < 0.08 ? 'Approved' : 'Drafted';
      else { state = r() < 0.5 ? 'Flagged' : 'Needs input'; assignee = state === 'Flagged' ? trSme(c, domain) : null; }
    } else {
      // fresh auto-draft (import or "draft now")
      state = l ? 'Drafted' : 'Needs input';
    }
    out.push({ id, n: i + 1, domain, text, libId: l?.id ?? null, answer, confidence: Math.max(0, Math.min(100, confidence)), ev: l ? l.ev : [], state, assignee, approvedBy: state === 'Approved' ? qn.owner : undefined });
  }
  Q_CACHE.set(ck, out);
  return out;
}

/* ---------------- Documents, requests, NDAs, access log ---------------- */
export type TrGate = 'Public' | 'Click-through NDA' | 'Signed NDA' | 'Approval required';
export const TR_GATE_COLOR: Record<TrGate, string> = { Public: '#93d65a', 'Click-through NDA': '#68b1ff', 'Signed NDA': '#a07cfb', 'Approval required': '#f0a338' };
export interface TrDoc { id: string; name: string; kind: string; gate: TrGate; source: string; to: string; updatedDays: number; validUntil?: string; views30: number }

const DOC_CACHE = new Map<CustomerId, TrDoc[]>();
export function trDocuments(c: CustomerProfile): TrDoc[] {
  const hit = DOC_CACHE.get(c.id);
  if (hit) return hit;
  const x = ctx(c);
  const r = rng(`tr-docs-${c.id}`);
  const docs: TrDoc[] = [];
  x.certs.forEach((f) => {
    const isReport = /SOC 2/.test(f.short);
    docs.push({
      id: `DOC-${f.id}`, name: isReport ? `${f.short} report` : f.kind === 'Industry programme' ? `${f.short} attestation / label` : `${f.short} certificate`, kind: isReport ? 'Audit report' : 'Certificate',
      gate: isReport ? 'Signed NDA' : f.id === 'pci' ? 'Click-through NDA' : 'Public', source: 'HexaComply', to: `/comply/caas?section=frameworks&framework=${f.id}`, updatedDays: r.int(20, 200),
      validUntil: f.nextAudit ? `Until ${f.nextAudit.split(', ').pop()}` : undefined, views30: r.int(4, 60),
    });
    if (f.id === 'iso27001') docs.push({ id: 'DOC-soa', name: 'ISO 27001 statement of applicability', kind: 'Audit report', gate: 'Signed NDA', source: 'HexaComply', to: '/comply/caas?section=frameworks&framework=iso27001', updatedDays: r.int(30, 160), views30: r.int(3, 30) });
  });
  docs.push(
    { id: 'DOC-pentest', name: `Penetration test executive summary (${x.ptDate})`, kind: 'Summary', gate: 'Approval required', source: 'HexaStrike', to: '/strike/pentest', updatedDays: x.pt.daysAgo, views30: r.int(8, 40) },
    { id: 'DOC-coi', name: `Certificate of cyber insurance (${x.insurer})`, kind: 'Certificate of insurance', gate: 'Click-through NDA', source: 'Cyber Insurance', to: '/insurance/policy', updatedDays: r.int(120, 280), views30: r.int(3, 22) },
    { id: 'DOC-bcp', name: 'Business continuity & DR summary', kind: 'Summary', gate: 'Click-through NDA', source: 'HexaComply · BIA', to: '/comply/caas?section=bia', updatedDays: r.int(30, 120), views30: r.int(4, 30) },
    { id: 'DOC-policies', name: 'Security policy pack (ISP, IR, crypto, access)', kind: 'Policy', gate: 'Click-through NDA', source: 'HexaComply · Drive', to: '/comply/caas?section=drive', updatedDays: r.int(20, 160), views30: r.int(6, 50) },
    { id: 'DOC-subproc', name: 'Sub-processor list', kind: 'Policy', gate: 'Public', source: 'HexaComply TPRM', to: '/comply/tprm', updatedDays: r.int(5, 40), views30: r.int(10, 70) },
    { id: 'DOC-dpa', name: 'Data processing addendum (template)', kind: 'Policy', gate: 'Public', source: 'Legal', to: '/comply/caas?section=drive', updatedDays: r.int(60, 300), views30: r.int(5, 40) },
    { id: 'DOC-sig', name: 'Pre-completed SIG Lite & CAIQ', kind: 'Questionnaire', gate: 'Signed NDA', source: 'Trust Centre answer library', to: '/trust/answers', updatedDays: r.int(3, 30), views30: r.int(6, 45) },
    { id: 'DOC-ai', name: 'AI use & governance statement', kind: 'Policy', gate: 'Public', source: 'HexaAI Governance', to: '/comply/aigov', updatedDays: r.int(10, 60), views30: r.int(4, 30) },
  );
  DOC_CACHE.set(c.id, docs);
  return docs;
}

export type TrNda = 'Click-through' | 'Signed' | 'Pending signature' | 'Not required';
export const TR_NDA_COLOR: Record<TrNda, string> = { 'Click-through': '#68b1ff', Signed: '#2dd4bf', 'Pending signature': '#f0a338', 'Not required': '#8593b4' };
export type TrReqStatus = 'Pending' | 'Approved' | 'Denied' | 'Expired';
export const TR_REQ_COLOR: Record<TrReqStatus, string> = { Pending: '#f0a338', Approved: '#2dd4bf', Denied: '#f8646f', Expired: '#8593b4' };
export interface TrRequest {
  id: string; org: string; orgKind: string; contact: string; email: string; docs: string[]; reason: string; nda: TrNda; status: TrReqStatus;
  requestedMinAgo: number; accessDays: number | null; tenantId: string; qnId?: string; decidedBy?: string;
}

const REQ_CACHE = new Map<CustomerId, TrRequest[]>();
export function trRequestsBase(c: CustomerProfile): TrRequest[] {
  const hit = REQ_CACHE.get(c.id);
  if (hit) return hit;
  const r = rng(`tr-req-${c.id}`);
  const docs = trDocuments(c).filter((d) => d.gate !== 'Public');
  const qns = trQuestionnairesBase(c);
  const EXTRA: CustomerMap<[string, string][]> = {
    maritime: [['Port of Callisto Authority', 'Port authority (prospect)'], ['Saltcrest Charterers', 'Charterer (prospect)'], ['Atlas Marine Underwriters', 'Insurer']],
    finserv: [['Wexford Building Society', 'Prospect (payments)'], ['Grafton Mutual', 'Prospect (BaaS)'], ['Ashcombe Audit LLP', 'External auditor']],
    media: [['Nimbus Kids Studios', 'Prospect (co-production)'], ['Ember Sound Post', 'Vendor onboarding'], ['Quarry Lane Distribution', 'Prospect (distribution)']],
    healthcare: [['Ridgeline Behavioral Health', 'Prospect (affiliation)'], ['Pinecrest Senior Living', 'Prospect (care partner)'], ['Ohio Hospital Risk Pool', 'Insurer']],
    automotive: [['Sudmark Logistik GmbH', 'Prospect (fleet)'], ['Orbiq Mobility BV', 'Prospect (car-sharing)'], ['Hanseatic Fleet Insurance', 'Insurer']],
  };
  const extra = forCustomer(EXTRA, c);
  const orgs: { org: string; kind: string; tenant: string; qnId?: string }[] = [
    ...qns.slice(0, 9).map((q) => ({ org: q.requester, kind: q.requesterKind, tenant: q.tenantId, qnId: q.id })),
    ...extra.map(([o, k]) => ({ org: o, kind: k, tenant: c.tenants[0].id })),
  ];
  const reasons = ['Procurement due diligence', 'Annual supplier review', 'Contract renewal', 'Follow-up to questionnaire answers', 'Board assurance request', 'Regulatory outsourcing review', 'Insurance underwriting'];
  const out: TrRequest[] = [];
  orgs.forEach((o, i) => {
    const n = r.int(1, 3);
    const picked = r.pickN(docs, n);
    const needsSigned = picked.some((d) => d.gate === 'Signed NDA' || d.gate === 'Approval required');
    const status: TrReqStatus = i < 4 ? 'Pending' : r.weighted<TrReqStatus>([['Approved', 6], ['Denied', 1], ['Expired', 1.5]]);
    const nda: TrNda = needsSigned ? (status === 'Pending' && r.chance(0.5) ? 'Pending signature' : 'Signed') : 'Click-through';
    const fn = r.pick(FIRST);
    const ln = r.pick(LAST);
    out.push({
      id: `AR-${String(3100 + i * 3 + r.int(0, 2))}`, org: o.org, orgKind: o.kind, contact: `${fn} ${ln}`, email: `${fn[0].toLowerCase()}.${ln.toLowerCase()}@${slug(o.org)}.example`,
      docs: picked.map((d) => d.id), reason: r.pick(reasons), nda, status, requestedMinAgo: status === 'Pending' ? r.int(20, 2880) : r.int(2880, 60 * 24 * 40),
      accessDays: status === 'Approved' ? r.int(3, 85) : status === 'Expired' ? 0 : null, tenantId: o.tenant, qnId: o.qnId,
      decidedBy: status === 'Pending' ? undefined : r.pick([c.people.grcLead.name, c.people.ciso.name]),
    });
  });
  REQ_CACHE.set(c.id, out);
  return out;
}

export interface TrAccess { id: string; minAgo: number; who: string; org: string; docId: string; action: 'Viewed' | 'Downloaded (watermarked)' | 'NDA accepted' | 'Access denied'; from: string; watermark: string }
const LOG_CACHE = new Map<CustomerId, TrAccess[]>();
export function trAccessLogBase(c: CustomerProfile): TrAccess[] {
  const hit = LOG_CACHE.get(c.id);
  if (hit) return hit;
  const r = rng(`tr-acl-${c.id}`);
  const reqs = trRequestsBase(c).filter((q) => q.status === 'Approved' || q.status === 'Expired');
  const pub = trDocuments(c).filter((d) => d.gate === 'Public' || d.gate === 'Click-through NDA');
  const cities = ['London, GB', 'Frankfurt, DE', 'Amsterdam, NL', 'New York, US', 'Chicago, US', 'Singapore, SG', 'Paris, FR', 'Milan, IT', 'Zurich, CH', 'Columbus, US', 'Los Angeles, US', 'Munich, DE'];
  const out: TrAccess[] = [];
  for (let i = 0; i < 46; i++) {
    const useReq = reqs.length && r() < 0.7;
    const rq = useReq ? r.pick(reqs) : null;
    const docId = rq ? r.pick(rq.docs) : r.pick(pub).id;
    const action = r.weighted<TrAccess['action']>([['Viewed', 6], ['Downloaded (watermarked)', 3], ['NDA accepted', rq ? 0.6 : 1.2], ['Access denied', 0.4]]);
    const fn = r.pick(FIRST);
    const ln = r.pick(LAST);
    out.push({ id: `ACL-${i}`, minAgo: r.int(5, 60 * 24 * 30), who: rq ? rq.contact : `${fn} ${ln}`, org: rq ? rq.org : r.pick(['Prospect (portal visitor)', 'Anonymous · verified email domain', 'Partner portal']), docId, action, from: r.pick(cities), watermark: `WM-${r.hex(6).toUpperCase()}` });
  }
  out.sort((a, b) => a.minAgo - b.minAgo);
  LOG_CACHE.set(c.id, out);
  return out;
}

/* ---------------- Portal & trend stats ---------------- */
const BASELINE: CustomerMap<number> = { maritime: 19, finserv: 27, media: 16, healthcare: 24, automotive: 31 };
export function trBaselineDays(c: CustomerProfile): number {
  return forCustomer(BASELINE, c);
}
/** Twelve months of mean turnaround (days), HexaView went live five months ago. */
export function trTurnaroundTrend(c: CustomerProfile): { months: string[]; days: number[]; liveIdx: number } {
  const r = rng(`tr-trend-${c.id}`);
  const base = forCustomer(BASELINE, c);
  const liveIdx = 7;
  const days = Array.from({ length: 12 }, (_, i) => (i < liveIdx ? Math.round((base + r.float(-3, 4)) * 10) / 10 : Math.round(Math.max(1, base * [0.32, 0.12, 0.08, 0.07, 0.06][i - liveIdx] + r.float(-0.3, 0.3)) * 10) / 10));
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1).toLocaleString('en-GB', { month: 'short' }));
  return { months, days, liveIdx };
}
export function trPortalStats(c: CustomerProfile): { visitors30: number; orgs30: number; docViews30: number; series: number[]; selfServePct: number } {
  const r = rng(`tr-portal-${c.id}`);
  const series = Array.from({ length: 30 }, (_, i) => r.int(14, 46) + (i % 7 < 5 ? r.int(6, 20) : 0));
  const visitors30 = series.reduce((s, v) => s + v, 0);
  return { visitors30, orgs30: Math.round(visitors30 / r.float(5.5, 8)), docViews30: trDocuments(c).reduce((s, d) => s + d.views30, 0), series, selfServePct: r.int(34, 52) };
}

/** Seeded activity (newest first) behind the in-session log. */
export function trSeedActivity(c: CustomerProfile): { minAgo: number; title: string; body: string; color: string; to: string }[] {
  const qns = trQuestionnairesBase(c);
  const lib = trLibrary(c);
  const reqs = trRequestsBase(c);
  const sent = qns.filter((q) => q.status === 'Sent');
  const stale = lib.filter((l) => l.stale);
  const out = [
    { minAgo: 14, title: `${qns[0].requester} questionnaire received`, body: `${TR_FORMAT_BY_ID[qns[0].format].short} · ${qns[0].questions} questions parsed`, color: TR_STATUS_COLOR.Received, to: `/trust/questionnaires?q=${qns[0].id}` },
    { minAgo: 52, title: `Access requested by ${reqs[0].org}`, body: `${reqs[0].docs.length} gated document${reqs[0].docs.length > 1 ? 's' : ''} · NDA ${reqs[0].nda.toLowerCase()}`, color: TR_REQ_COLOR.Pending, to: `/trust/requests?id=${reqs[0].id}` },
    { minAgo: 140, title: `${qns[2].requester}: ${Math.round(qns[2].questions * 0.4)} answers approved`, body: `Bulk approve of high-confidence drafts by ${qns[2].owner}`, color: TR_STATUS_COLOR['In review'], to: `/trust/questionnaires?q=${qns[2].id}` },
    ...(stale[0] ? [{ minAgo: 310, title: `Answer ${stale[0].id} marked stale`, body: stale[0].staleReason ?? '', color: '#f0a338', to: `/trust/answers?id=${stale[0].id}` }] : []),
    ...(sent[0] ? [{ minAgo: 60 * 24 * (sent[0].sentDaysAgo ?? 1) + 30, title: `${sent[0].requester} questionnaire returned`, body: `Turnaround ${sent[0].turnaroundDays} days · deal unblocked`, color: TR_STATUS_COLOR.Sent, to: `/trust/questionnaires?q=${sent[0].id}` }] : []),
    ...(sent[1] ? [{ minAgo: 60 * 24 * (sent[1].sentDaysAgo ?? 2) + 90, title: `${sent[1].requester} questionnaire returned`, body: `Turnaround ${sent[1].turnaroundDays} days`, color: TR_STATUS_COLOR.Sent, to: `/trust/questionnaires?q=${sent[1].id}` }] : []),
  ];
  return out.sort((a, b) => a.minAgo - b.minAgo);
}

/* =====================================================================
   In-session store: approvals, edits, imports, reviews and access decisions
   survive navigation between the five tabs, so counts agree everywhere.
   ===================================================================== */
interface QEdit { state?: TrQState; answer?: string; assignee?: string | null; edited?: boolean; by?: string }
interface Store {
  q: Record<string, QEdit>; // cid:qn:qid
  qn: Record<string, { sentAt?: number; drafted?: boolean }>; // cid:qn
  added: Partial<CustomerMap<TrQuestionnaire[]>>;
  lib: Record<string, { reviewedAt: number; by: string }>; // cid:ans
  req: Record<string, { status?: TrReqStatus; nda?: TrNda; at: number; by: string; accessDays?: number | null }>; // cid:req
  acl: Partial<CustomerMap<(TrAccess & { at: number })[]>>;
  log: { cid: CustomerId; at: number; title: string; body?: string; color: string; to: string }[];
}
let STORE: Store = { q: {}, qn: {}, added: {}, lib: {}, req: {}, acl: {}, log: [] };
let VERSION = 0;
const LISTENERS = new Set<() => void>();
function commit(fn: (s: Store) => Store) {
  STORE = fn(STORE);
  VERSION++;
  LISTENERS.forEach((l) => l());
}
export function trSubscribe(l: () => void): () => void {
  LISTENERS.add(l);
  return () => LISTENERS.delete(l);
}
export function trVersion(): number {
  return VERSION;
}
const minsSince = (at: number) => Math.max(0, Math.round((Date.now() - at) / 60000));
function log(c: CustomerProfile, title: string, body: string, color: string, to: string) {
  commit((s) => ({ ...s, log: [{ cid: c.id, at: Date.now(), title, body, color, to }, ...s.log] }));
}

/* ---- Derived views ---- */
export interface TrQnView extends TrQuestionnaire {
  qs: TrQuestion[];
  total: number;
  approved: number;
  drafted: number;
  flagged: number;
  needs: number;
  highConf: number;
  autoPct: number;
  drafted0: boolean;
}

function libStale(c: CustomerProfile, l: TrLibAnswer | undefined): boolean {
  return !!l && l.stale && !STORE.lib[`${c.id}:${l.id}`];
}

export function trQuestionnaires(c: CustomerProfile, tenantId = 'all'): TrQnView[] {
  const base = [...(STORE.added[c.id] ?? []), ...trQuestionnairesBase(c)];
  const lib = new Map(trLibrary(c).map((l) => [l.id, l]));
  return base
    .filter((q) => tenantId === 'all' || q.tenantId === tenantId)
    .map((q) => {
      const meta = STORE.qn[`${c.id}:${q.id}`] ?? {};
      const undrafted = q.status === 'Received' && !meta.drafted;
      const mode: GenMode = undrafted ? 'undrafted' : q.status === 'Received' || q.imported ? 'fresh' : q.status;
      const qs = trQuestionsBase(c, q, mode).map((x) => {
        const e = STORE.q[`${c.id}:${q.id}:${x.id}`];
        const l = x.libId ? lib.get(x.libId) : undefined;
        let confidence = x.confidence;
        let answer = x.answer;
        if (l && l.stale && !libStale(c, l) && x.state !== 'Approved') confidence = Math.min(98, confidence + 20);
        if (l && libStale(c, l) && l.answerStale && answer === l.answer) answer = l.answerStale;
        if (!e) return { ...x, answer, confidence };
        return { ...x, answer, ...e, confidence: e.edited ? 100 : confidence, assignee: e.assignee === undefined ? x.assignee : e.assignee, approvedBy: e.state === 'Approved' ? e.by : x.approvedBy };
      });
      const approved = qs.filter((x) => x.state === 'Approved').length;
      const drafted = qs.filter((x) => x.state === 'Drafted').length;
      const flagged = qs.filter((x) => x.state === 'Flagged').length;
      const needs = qs.filter((x) => x.state === 'Needs input').length;
      const highConf = qs.filter((x) => x.state === 'Drafted' && x.confidence >= 85).length;
      let status: TrStatus;
      if (meta.sentAt || q.status === 'Sent') status = 'Sent';
      else if (undrafted) status = 'Received';
      else if (approved === qs.length) status = 'Approved';
      else if (needs > 0) status = 'Drafting';
      else status = 'In review';
      const sentDaysAgo = meta.sentAt ? 0 : q.sentDaysAgo;
      const turnaroundDays = meta.sentAt ? Math.max(0.2, Math.round((q.receivedDaysAgo + minsSince(meta.sentAt) / 1440) * 10) / 10) : q.turnaroundDays;
      return {
        ...q, status, sentDaysAgo, turnaroundDays, qs, total: qs.length, approved, drafted, flagged, needs, highConf,
        autoPct: undrafted ? 0 : Math.round((qs.filter((x) => x.libId).length / Math.max(1, qs.length)) * 100), drafted0: !undrafted,
      };
    });
}

export function trLibraryView(c: CustomerProfile): (TrLibAnswer & { staleNow: boolean; reviewedNow: number; reviewer: string })[] {
  return trLibrary(c).map((l) => {
    const rv = STORE.lib[`${c.id}:${l.id}`];
    return { ...l, answer: l.stale && !rv && l.answerStale ? l.answerStale : l.answer, staleNow: l.stale && !rv, reviewedNow: rv ? minsSince(rv.reviewedAt) / 1440 : l.reviewedDays, reviewer: rv?.by ?? l.owner };
  });
}

export function trRequests(c: CustomerProfile, tenantId = 'all'): TrRequest[] {
  return trRequestsBase(c)
    .filter((q) => tenantId === 'all' || q.tenantId === tenantId || !c.tenants.some((t) => t.id === q.tenantId))
    .map((q) => {
      const e = STORE.req[`${c.id}:${q.id}`];
      return e ? { ...q, status: e.status ?? q.status, nda: e.nda ?? q.nda, decidedBy: e.by, accessDays: e.accessDays === undefined ? q.accessDays : e.accessDays, requestedMinAgo: q.requestedMinAgo } : q;
    });
}

export function trAccessLog(c: CustomerProfile): TrAccess[] {
  const live = (STORE.acl[c.id] ?? []).map((a) => ({ ...a, minAgo: minsSince(a.at) }));
  return [...live, ...trAccessLogBase(c)];
}

export function trActivity(c: CustomerProfile): { minAgo: number; title: string; body: string; color: string; to: string }[] {
  const live = STORE.log.filter((l) => l.cid === c.id).map((l) => ({ minAgo: minsSince(l.at), title: l.title, body: l.body ?? '', color: l.color, to: l.to }));
  return [...live, ...trSeedActivity(c)];
}

/* ---- Actions ---- */
export function trApprove(c: CustomerProfile, qn: TrQnView, ids: string[], by: string) {
  if (!ids.length) return;
  commit((s) => {
    const q = { ...s.q };
    ids.forEach((id) => { q[`${c.id}:${qn.id}:${id}`] = { ...q[`${c.id}:${qn.id}:${id}`], state: 'Approved', by }; });
    return { ...s, q };
  });
  log(c, `${qn.requester}: ${ids.length} answer${ids.length > 1 ? 's' : ''} approved`, `${ids.length > 3 ? 'Bulk approve' : ids.join(', ')} · by ${by}`, TR_QSTATE_COLOR.Approved, `/trust/questionnaires?q=${qn.id}`);
}
export function trEdit(c: CustomerProfile, qn: TrQnView, id: string, answer: string, by: string) {
  commit((s) => ({ ...s, q: { ...s.q, [`${c.id}:${qn.id}:${id}`]: { ...s.q[`${c.id}:${qn.id}:${id}`], answer, edited: true, state: 'Approved', by } } }));
  log(c, `${qn.requester}: answer ${id} edited and approved`, `By ${by} · edit kept with the questionnaire, library unchanged`, TR_QSTATE_COLOR.Approved, `/trust/questionnaires?q=${qn.id}&qid=${id}`);
}
export function trFlag(c: CustomerProfile, qn: TrQnView, id: string, assignee: string, by: string) {
  commit((s) => ({ ...s, q: { ...s.q, [`${c.id}:${qn.id}:${id}`]: { ...s.q[`${c.id}:${qn.id}:${id}`], state: 'Flagged', assignee, by } } }));
  log(c, `${qn.requester}: ${id} flagged for ${assignee}`, `Subject-matter expert input requested by ${by}`, TR_QSTATE_COLOR.Flagged, `/trust/questionnaires?q=${qn.id}&qid=${id}`);
}
export function trAssign(c: CustomerProfile, qn: TrQnView, id: string, assignee: string) {
  commit((s) => ({ ...s, q: { ...s.q, [`${c.id}:${qn.id}:${id}`]: { ...s.q[`${c.id}:${qn.id}:${id}`], assignee } } }));
}
export function trMarkSent(c: CustomerProfile, qn: TrQnView, by: string, file: string) {
  commit((s) => ({ ...s, qn: { ...s.qn, [`${c.id}:${qn.id}`]: { ...s.qn[`${c.id}:${qn.id}`], sentAt: Date.now() } } }));
  log(c, `${qn.requester} questionnaire returned`, `${file} sent by ${by} · ${qn.total} answers, all human-approved`, TR_STATUS_COLOR.Sent, `/trust/questionnaires?q=${qn.id}`);
}
export function trDraft(c: CustomerProfile, qn: TrQnView) {
  commit((s) => ({ ...s, qn: { ...s.qn, [`${c.id}:${qn.id}`]: { ...s.qn[`${c.id}:${qn.id}`], drafted: true } } }));
  log(c, `${qn.requester}: answers auto-drafted`, `${qn.total} questions mapped to the answer library and live evidence`, TR_STATUS_COLOR.Drafting, `/trust/questionnaires?q=${qn.id}`);
}
export function trImport(c: CustomerProfile, p: { requester: string; format: TrFormatId; questions: number; tenantId: string; dueInDays: number; dealValue: number; owner: string }): TrQuestionnaire {
  const n = (STORE.added[c.id]?.length ?? 0) + 1;
  const q: TrQuestionnaire = {
    id: `SQ-${2600 + n}`, requester: p.requester, requesterKind: 'Imported questionnaire', contact: 'Uploaded by your team', tenantId: p.tenantId, format: p.format, questions: p.questions,
    receivedDaysAgo: 0, dueInDays: p.dueInDays, status: 'Drafting', dealValue: p.dealValue, dealStage: 'New business', owner: p.owner, imported: true,
  };
  commit((s) => ({ ...s, added: { ...s.added, [c.id]: [q, ...(s.added[c.id] ?? [])] } }));
  log(c, `${p.requester} questionnaire imported`, `${TR_FORMAT_BY_ID[p.format].short} · ${p.questions} questions parsed and auto-drafted`, TR_STATUS_COLOR.Drafting, `/trust/questionnaires?q=${q.id}`);
  return q;
}
export function trReview(c: CustomerProfile, l: TrLibAnswer, by: string) {
  commit((s) => ({ ...s, lib: { ...s.lib, [`${c.id}:${l.id}`]: { reviewedAt: Date.now(), by } } }));
  log(c, `Answer ${l.id} re-approved`, `${l.question.slice(0, 70)}… · evidence re-checked by ${by}`, TR_QSTATE_COLOR.Approved, `/trust/answers?id=${l.id}`);
}
export function trDecide(c: CustomerProfile, q: TrRequest, status: TrReqStatus, by: string, accessDays: number | null) {
  commit((s) => ({ ...s, req: { ...s.req, [`${c.id}:${q.id}`]: { ...s.req[`${c.id}:${q.id}`], status, at: Date.now(), by, accessDays } } }));
  log(c, `Access ${status.toLowerCase()} for ${q.org}`, `${q.docs.length} document${q.docs.length > 1 ? 's' : ''}${accessDays ? ` · expires in ${accessDays} days` : ''} · by ${by}`, TR_REQ_COLOR[status], `/trust/requests?id=${q.id}`);
  if (status === 'Approved') {
    commit((s) => ({ ...s, acl: { ...s.acl, [c.id]: [{ id: `ACL-L${Date.now()}`, at: Date.now(), minAgo: 0, who: q.contact, org: q.org, docId: q.docs[0], action: 'NDA accepted', from: 'Email link', watermark: '—' }, ...(s.acl[c.id] ?? [])] } }));
  }
}
export function trSendNda(c: CustomerProfile, q: TrRequest, by: string) {
  commit((s) => ({ ...s, req: { ...s.req, [`${c.id}:${q.id}`]: { ...s.req[`${c.id}:${q.id}`], nda: 'Pending signature', at: Date.now(), by } } }));
  log(c, `NDA sent to ${q.org}`, `E-signature request to ${q.email} by ${by}`, TR_NDA_COLOR['Pending signature'], `/trust/requests?id=${q.id}`);
}
export function trMarkNdaSigned(c: CustomerProfile, q: TrRequest, by: string) {
  commit((s) => ({ ...s, req: { ...s.req, [`${c.id}:${q.id}`]: { ...s.req[`${c.id}:${q.id}`], nda: 'Signed', at: Date.now(), by } } }));
  log(c, `NDA signed by ${q.org}`, `Countersigned record filed · ${q.contact}`, TR_NDA_COLOR.Signed, `/trust/requests?id=${q.id}`);
}

/* =====================================================================
   Second-wave customers: their own entries in the tables above.
   ===================================================================== */
const fwPct = (x: Ctx, id: string, fallback: number) => x.c.frameworks.find((f) => f.id === id)?.documented ?? fallback;
const fwNext = (x: Ctx, id: string, fallback: string) => x.c.frameworks.find((f) => f.id === id)?.nextAudit ?? fallback;

Object.assign(SECTOR_LABEL, {
  insurance: 'Insurance regulation (NYDFS, NAIC) & NPI',
  defence: 'CMMC, DFARS & ITAR',
  pharma: 'GxP, clinical data & plant OT',
  sghospital: 'Health Information Act, NEHR & medical devices',
  studio: 'Content security (TPN / MPA) & parks',
});

SECTOR_EV.insurance = [
  { key: 'sec:nydfs', kind: 'Certification', label: 'NYDFS 500.17 annual certification', detail: (x) => `Certified for 2025; ${fwPct(x, 'nydfs', 86)}% of Part 500 requirements evidenced for the ${fwNext(x, 'nydfs', 'April')} filing`, to: '/comply/caas?section=frameworks&framework=nydfs' },
  { key: 'sec:tpsp', kind: 'Control', label: 'CTL-TPA-04 · BPO and TPA access brokered', detail: () => 'NYDFS 500.11 · NAIC #668 §4F · Island browser and BeyondTrust', to: '/comply/tprm' },
];
SECTOR_EV.defence = [
  { key: 'sec:sprs', kind: 'Certification', label: 'SPRS score and CMMC Level 2 status', detail: (x) => `SPRS 88/110, target 104 · C3PAO assessment ${fwNext(x, 'cmmc-l2', 'scheduled')}`, to: '/comply/caas?section=frameworks&framework=cmmc-l2' },
  { key: 'sec:cui', kind: 'Control', label: 'CTL-CUI-01 · CUI confined to the GCC High enclave', detail: () => 'CMMC AC.L2-3.1.3 · DFARS 7012(b) · Purview CUI labels', to: '/comply/caas?section=frameworks&framework=nist-171' },
];
SECTOR_EV.pharma = [
  { key: 'sec:gxp', kind: 'Control', label: 'CTL-AT-03 · GxP audit trails', detail: () => 'Part 11 11.10(e) · Annex 11 §9 · Vault, Rave, LabWare, PAS-X', to: '/comply/caas?section=frameworks&framework=part11' },
  { key: 'sec:custody', kind: 'Platform', label: 'HexaCustody · dossiers and trial data', detail: (x) => `${x.h.custody.assetsUnderCustody.toLocaleString('en-GB')} items under custody across ${x.h.custody.vendorsInChain} CRO and CMO partners`, to: '/custody/overview' },
];
SECTOR_EV.sghospital = [
  { key: 'sec:md', kind: 'Platform', label: 'HexaOT · medical device inventory', detail: (x) => `${x.h.ot.otAssets.toLocaleString('en-GB')} connected medical devices, ${x.h.ot.purdueCoveragePct}% segmented`, to: '/ot/visibility' },
  { key: 'sec:hia', kind: 'Control', label: 'CTL-IR-13 · MOH 2-hour notification', detail: () => 'Health Information Act · notifiable incident triage and 14-day report', to: '/comply/caas?section=frameworks&framework=hia' },
];
SECTOR_EV.studio = [
  { key: 'sec:custody', kind: 'Platform', label: 'HexaCustody · pre-release chain', detail: (x) => `${x.h.custody.assetsUnderCustody.toLocaleString('en-GB')} assets under custody, ${x.h.custody.vendorsInChain} vendors in chain`, to: '/custody/overview' },
  { key: 'sec:wm', kind: 'Control', label: 'CTL-WAT-07 · forensic watermarking', detail: () => 'MPA CS-4.0 · screeners, dailies and review links', to: '/comply/caas?section=frameworks&framework=mpa' },
];

SECTOR_TPL.insurance = [
  { key: 'i-nydfs', domain: 'Sector', owner: 'grc', ev: (x) => ['sec:nydfs', ...fwEv(x, 'nydfs', 'naic')],
    qs: ['Are you subject to NYDFS 23 NYCRR 500, and did you file the annual certification?', 'Describe your compliance with the NAIC Insurance Data Security Model Law in your domiciliary state.'],
    a: (x) => `Yes. ${x.c.name} files the NYDFS 500.17 certification each April, signed by the CEO and CISO, and certifies to the Connecticut Insurance Department under the state law based on NAIC #668. ${fwPct(x, 'nydfs', 86)}% of Part 500 requirements are evidenced in HexaComply.` },
  { key: 'i-npi', domain: 'Sector', owner: 'grc', ev: () => ['pol:crypto', 'sec:tpsp'],
    qs: ['How is nonpublic information (NPI) protected in transit, at rest and with service providers?', 'Do third-party administrators and BPO staff access policyholder data, and how is that controlled?'],
    a: () => 'NPI is encrypted at rest and in transit (NYDFS 500.15). Claims BPO and TPA users work through a managed enterprise browser and brokered privileged sessions; every provider holding NPI is assessed under NYDFS 500.11 and must notify us within 24 hours of a cybersecurity event.' },
  { key: 'i-cat', domain: 'Sector', owner: 'grc', ev: () => ['pol:bcp', 'ctl:bkp'],
    qs: ['How would claims handling and payments continue during a cyber event that coincides with a catastrophe?', 'What are your recovery objectives for the claims platform?'],
    a: (x) => `First notice of loss and claims payments target a 4-hour RTO; the contact centre has paper FNOL scripts and a manual disbursement fallback. Guidewire and mainframe data are protected by immutable backups in ${x.backup}, restore-tested quarterly.` },
  { key: 'i-fraud', domain: 'Sector', owner: 'soc', ev: () => ['ctl:email', 'soc:mdr'],
    qs: ['What controls prevent fraudulent changes to claim payees or premium refunds?', 'How do you protect against help-desk social engineering?'],
    a: () => 'Payee changes need a second approver and a call-back on the number on file; the help desk verifies identity before any MFA or password reset. SIU and HexaSOC monitor disbursement anomalies and impersonation attempts.' },
];
SECTOR_TPL.defence = [
  { key: 'd-cmmc', domain: 'Sector', owner: 'grc', ev: (x) => ['sec:sprs', ...fwEv(x, 'cmmc-l2', 'nist-171')],
    qs: ['What is your current SPRS score and the date of your last NIST SP 800-171 assessment?', 'What is your CMMC Level 2 status, and when is your C3PAO assessment?'],
    a: (x) => `Our SPRS score is 88 of 110, posted this year, with a POA&M targeting 104 by December. The CMMC Level 2 C3PAO assessment is ${fwNext(x, 'cmmc-l2', 'scheduled')}; ${fwPct(x, 'cmmc-l2', 84)}% of the 110 practices are documented with evidence in HexaComply.` },
  { key: 'd-7012', domain: 'Sector', owner: 'ciso', ev: (x) => ['pol:ir', ...fwEv(x, 'dfars-7012')],
    qs: ['Do you comply with DFARS 252.204-7012, including 72-hour cyber incident reporting?', 'Do you flow DFARS 7012 down to sub-tier suppliers that receive CUI?'],
    a: () => 'Yes. Cyber incidents affecting covered defence information are reported through DIBNet within 72 hours, images are preserved for 90 days and malware is submitted to DC3. The clause is flowed down to every sub-tier receiving CUI, and their SPRS and CMMC status is checked through Exostar.' },
  { key: 'd-cui', domain: 'Sector', owner: 'admin', ev: () => ['sec:cui', 'res'],
    qs: ['Where is CUI stored and processed, and does your cloud meet FedRAMP Moderate equivalency?', 'How do you restrict ITAR technical data to US persons?'],
    a: () => 'CUI is confined to a Microsoft 365 GCC High and Azure Government enclave (FedRAMP High). ITAR technical data in Teamcenter is restricted by a verified US-person attribute and Purview labels; transfers to primes go through PreVeil or custody-tracked TDP releases.' },
  { key: 'd-supply', domain: 'Sector', owner: 'grc', ev: () => ['tprm'],
    qs: ['How do you manage cybersecurity risk in your own supply chain (NIST SP 800-171 r3 03.17)?', 'Which sub-tiers receive our technical data packages?'],
    a: (x) => `All ${x.h.comply.vendors} suppliers are tiered; sub-tiers receiving CUI must show a current SPRS score and the required CMMC level before a TDP is released, and releases are tracked by HexaCustody.` },
];
SECTOR_TPL.pharma = [
  { key: 'r-gxp', domain: 'Sector', owner: 'grc', ev: (x) => ['sec:gxp', ...fwEv(x, 'gmp', 'part11', 'gamp5')],
    qs: ['Are your computerised systems validated and compliant with EU GMP Annex 11 and 21 CFR Part 11?', 'Describe how audit trails are reviewed for GxP-relevant data.'],
    a: (x) => `Yes. GxP systems are validated under GAMP 5 with secure, time-stamped audit trails reviewed periodically (Part 11 11.10(e), Annex 11 §9). ${fwPct(x, 'gmp', 82)}% of Annex 11 requirements are evidenced; the next inspection is ${fwNext(x, 'gmp', 'scheduled')}.` },
  { key: 'r-qa', domain: 'Sector', owner: 'grc', ev: () => ['tprm'],
    qs: ['Will you sign a quality agreement covering data integrity, change notification and audits?', 'How do you oversee CROs and CMOs that handle our data or materials?'],
    a: () => 'Yes. Every supplier handling GxP or trial data operates under a quality agreement with data-integrity, audit and change-notification terms. CROs and CMOs are assessed before onboarding, audited on a risk basis and reviewed quarterly for access.' },
  { key: 'r-trial', domain: 'Sector', owner: 'grc', ev: () => ['sec:custody', 'pol:priv'],
    qs: ['How are clinical trial data and unblinding information protected?', 'Where is patient-level trial data processed, and under which transfer mechanism?'],
    a: (x) => `Trial data stays in validated EDC and eTMF systems; unblinding keys and randomisation lists are restricted, logged and custody-tracked. Patient-level data is processed in ${x.residency} under GDPR and revDSG, with SCCs for any transfer.` },
  { key: 'r-ot', domain: 'Sector', owner: 'ot', ev: () => ['ctl:mfa'],
    qs: ['How is OEM remote access to manufacturing control systems controlled?', 'Describe IT/OT segmentation at your manufacturing sites.'],
    a: (x) => `OEM access to DCS, PLCs and filling lines is brokered through ${x.pam} with per-session approval and recording, reconciled to GxP change control. Plants use a Level 3.5 DMZ between IT and OT; OT monitoring is read-only.` },
];
SECTOR_TPL.sghospital = [
  { key: 's-hia', domain: 'Sector', owner: 'grc', ev: (x) => ['sec:hia', ...fwEv(x, 'hia', 'ce')],
    qs: ['Do you comply with the MOH Cybersecurity and Data Security Essentials under the Health Information Act?', 'Do you hold the CSA Cyber Essentials or Cyber Trust mark?'],
    a: (x) => `Yes. ${x.c.name} is implementing the MOH essentials across cybersecurity, data security and common practices (${fwPct(x, 'hia', 74)}% evidenced) and holds the CSA Cyber Essentials mark, with Cyber Trust targeted next.` },
  { key: 's-notify', domain: 'Sector', owner: 'ciso', ev: () => ['pol:ir', 'sec:hia'],
    qs: ['How quickly do you notify regulators and partners of a cybersecurity incident involving patient data?', 'Describe your incident notification obligations.'],
    a: () => 'Notifiable incidents are reported to MOH within 2 hours of assessment, followed by a detailed report within 14 days; notifiable personal data breaches are reported to the PDPC within 3 days. Partners whose data is affected are told without undue delay.' },
  { key: 's-xfer', domain: 'Sector', owner: 'grc', ev: () => ['pol:priv', 'res'],
    qs: ['Is patient data transferred outside Singapore, for example for second opinions?', 'How do you protect data shared with insurers and medical-tourism partners?'],
    a: () => 'Patient data is stored in Singapore. Transfers abroad, such as second opinions, follow a PDPA s26 procedure with contractual safeguards; insurer and partner exchanges run through authenticated portals and APIs.' },
  { key: 's-md', domain: 'Sector', owner: 'ot', ev: () => ['sec:md'],
    qs: ['How are connected medical devices secured?', 'Do you follow the HSA guidelines on medical device cybersecurity?'],
    a: (x) => `HexaOT keeps a live inventory of ${x.h.ot.otAssets.toLocaleString('en-GB')} connected medical devices. Devices sit on segmented clinical VLANs, OEM access is brokered and recorded, and tenders follow the HSA medical device cybersecurity guidelines.` },
];
SECTOR_TPL.studio = [
  { key: 'sf-tpn', domain: 'Sector', owner: 'grc', ev: (x) => fwEv(x, 'tpn', 'mpa'),
    qs: ['Do you hold a current TPN shield, and are your vendor sites assessed?', 'Are you assessed against the MPA Content Security Best Practices?'],
    a: (x) => `Yes. ${x.c.name} holds TPN Gold Shield status (${fwNext(x, 'tpn', 'annual re-assessment')}) and is assessed against MPA CSBP; ${fwPct(x, 'mpa', 83)}% of in-scope best practices are evidenced in HexaComply. Vendors receiving pre-release content must hold a current shield.` },
  { key: 'sf-custody', domain: 'Sector', owner: 'grc', ev: () => ['sec:custody', 'sec:wm'],
    qs: ['How is pre-release content tracked and protected end to end, including at vendors?', 'Are screeners, dailies and review links forensically watermarked?'],
    a: (x) => `Pre-release content is tracked by HexaCustody agents from ingest to delivery (${x.h.custody.assetsUnderCustody.toLocaleString('en-GB')} assets in custody across ${x.h.custody.vendorsInChain} vendors). Screeners, dailies and review links carry forensic watermarks and expire.` },
  { key: 'sf-leak', domain: 'Sector', owner: 'soc', ev: () => ['soc:ir', 'sec:custody'],
    qs: ['Describe your content leak response and how quickly access can be revoked.', 'How do you decide whether a security incident is material for disclosure?'],
    a: () => 'A content-leak playbook covers watermark extraction, source identification, takedown and licensor notification within 24 hours; HexaCustody revokes access in seconds. A disclosure committee assesses materiality for SEC Form 8-K Item 1.05.' },
  { key: 'sf-pci', domain: 'Sector', owner: 'grc', ev: (x) => fwEv(x, 'pci', 'soc2'),
    qs: ['Are Starfall+ and park payments PCI DSS compliant?', 'Do you hold a SOC 2 Type II report for the streaming platform?'],
    a: (x) => `Yes. Streaming, ticketing and merchandise payments are PCI DSS v4.0.1 Level 1 (next QSA visit ${fwNext(x, 'pci', 'annually')}), and Starfall+ has a SOC 2 Type II report available under NDA.` },
];

REQUESTERS.insurance = [
  ['Atlantic Re Partners', 'Reinsurer (property cat treaty)', 'group', 'reins', 4.2],
  ['Harborview Insurance Brokers', 'Wholesale broker (E&S)', 'specialty', 'nydfs-tpsp', 1.6],
  ['Greystone Credit Union', 'Affinity partner (auto & home)', 'personal', 'sig-lite', 2.3],
  ['Meridian Fleet Leasing', 'Commercial auto client', 'commercial', 'custom', 1.1],
  ['Brookfield Bank of New York', 'Bancassurance partner', 'life', 'nydfs-tpsp', 3.8],
  ['Northgate Mortgage Corp', 'Lender-placed insurance partner', 'personal', 'sig-core', 2.9],
  ['Copperline Logistics', 'Commercial lines client', 'commercial', 'iso', 0.8],
  ['Summit Benefit Advisors', 'Annuity distribution partner', 'life', 'sig-lite', 1.4],
  ['Pinecrest Property Managers', 'Commercial property client', 'commercial', 'custom', 0.6],
  ['Lakeshore Retirement Plans', 'Group annuity client', 'life', 'caiq', 1.9],
  ['Ironbridge Reinsurance', 'Reinsurer (casualty quota share)', 'group', 'reins', 3.1],
  ['Tidewater Auto Dealers Assoc.', 'Agency partner (auto)', 'personal', 'sig-lite', 0.7],
];
REQUESTERS.defence = [
  ['Lockheed Martin', 'Prime contractor (guidance housing TDP)', 'programs', 'cmmc', 18],
  ['RTX (Raytheon)', 'Prime contractor (seeker subsystem)', 'programs', 'cmmc', 24],
  ['Northrop Grumman', 'Prime contractor (test equipment)', 'engineering', 'dfars', 9.5],
  ['L3Harris Technologies', 'Prime contractor (avionics interface)', 'engineering', 'cmmc', 7.2],
  ['Aldrich Aerospace Integration', 'Tier-1 integrator', 'manufacturing', 'dfars', 3.4],
  ['Cumberland Precision Machining', 'Sub-tier supplier (reverse assessment)', 'manufacturing', 'custom', 0.4],
  ['US Army DEVCOM (via prime)', 'Government programme office', 'tucson', 'dfars', 5.6],
  ['Pinnacle Space Systems', 'Commercial space customer', 'engineering', 'sig-lite', 2.1],
  ['Vanguard Missile Integration', 'Prime contractor (new bid)', 'programs', 'cmmc', 12],
  ['Bluewater Naval Systems', 'Shipbuilder (sensor mounts)', 'manufacturing', 'iso', 1.8],
];
REQUESTERS.pharma = [
  ['Meridian Health Partners', 'US distributor (DSCSA)', 'commercial', 'sig-core', 14],
  ['Alpenland Kantonsspital Group', 'Hospital tender (CH)', 'corporate', 'custom', 3.2],
  ['NordBio Contract Research', 'CRO partner (Phase II)', 'clinops', 'gxp', 5.4],
  ['Celtic Fill & Finish Ltd', 'CMO partner (Cork overflow)', 'cork', 'gxp', 7.8],
  ['Riverside Specialty Pharmacy', 'Specialty pharmacy (patient services)', 'commercial', 'sig-lite', 2.6],
  ['Helvetia BioVentures', 'Licensing partner (biologic)', 'rnd', 'caiq', 22],
  ['Pan-European Health Procurement', 'National tender body', 'corporate', 'iso', 9.1],
  ['Rheinfracht Cold Chain AG', 'Cold-chain partner', 'cork', 'custom', 1.3],
  ['Atlas Clinical Imaging', 'Imaging core lab (trials)', 'clinops', 'gxp', 1.7],
  ['Saint-Rémy Genomics', 'Research collaboration', 'rnd', 'sig-lite', 0.9],
  ['Transatlantic Payer Alliance', 'US payer (patient support)', 'commercial', 'sig-core', 4.5],
  ['Dolomiti Vaccine Consortium', 'Co-development partner', 'valais', 'gxp', 11],
];
REQUESTERS.sghospital = [
  ['Great Eastern Life', 'Insurer (integrated shield panel)', 'corp', 'insurer-sg', 6.2],
  ['AIA Singapore', 'Insurer (panel hospital review)', 'corp', 'insurer-sg', 5.4],
  ['Prudential Singapore', 'Insurer (direct billing)', 'corp', 'insurer-sg', 4.1],
  ['Straits Wellness TPA', 'Third-party administrator (HIA assurance)', 'corp', 'hia', 1.1],
  ['Jakarta Medika Referral Network', 'Medical-tourism partner (Indonesia)', 'specialist', 'custom', 1.8],
  ['Saigon Care Connect', 'Medical-tourism partner (Vietnam)', 'specialist', 'sig-lite', 0.9],
  ['Pacific Corporate Health Scheme', 'Corporate health plan', 'obh', 'hia', 1.2],
  ['NovaTrial Asia', 'Clinical research sponsor', 'specialist', 'caiq', 2.3],
  ['Lion City Pathology Laboratories', 'Reference lab (reciprocal review)', 'labimg', 'iso', 0.6],
  ['Embassy Row Health Programme', 'Embassy health programme', 'obh', 'custom', 0.5],
];
REQUESTERS.studio = [
  ['Lumen Arc Streaming', 'Streaming licensee', 'studios', 'tpn', 48],
  ['Albatross Broadcasting Corp', 'Broadcast licensee', 'studios', 'tpn', 22],
  ['Saffron Screen Distribution', 'International distributor', 'post', 'tpn', 14],
  ['Marigold Streaming APAC', 'Streaming licensee (APAC)', 'play', 'caiq', 9.5],
  ['Harrow & Vine Advertising', 'Ad-tier agency', 'play', 'sig-lite', 3.2],
  ['Redwing Airlines Inflight', 'Inflight entertainment licensee', 'studios', 'tpn', 4.1],
  ['Brightwave Toys Inc.', 'Consumer products licensee', 'corp', 'sig-core', 12],
  ['Osaka Bay Resort Holdings', 'Resort joint-venture partner', 'parksasia', 'iso', 18],
  ['Celestia Cinemas', 'Theatrical exhibitor', 'studios', 'tpn', 6.8],
  ['Paragon Travel Group', 'Park ticketing reseller', 'parks', 'sig-lite', 2.7],
  ['Northshore Telecom', 'Starfall+ bundle partner', 'play', 'caiq', 16],
  ['Vista Kids Network', 'Kids channel licensee', 'studios', 'tpn', 3.6],
];
Object.assign(BASELINE, { insurance: 26, defence: 34, pharma: 29, sghospital: 21, studio: 18 });
