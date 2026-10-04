// HexaCustody data: content in motion, triage, chain of evidence, grants and
// revocations, and the vendor chain. Everything derives from the customer
// profile and is anchored to headlines(c, tenantId).custody.
import type { CustomerProfile, Severity, ThirdParty } from '../types';
import { rng } from '../../lib/rng';
import { headlines, type Headlines } from '../core';
import { scopedTenants } from '../customers';
import { forCustomer, type CustomerMap } from '../customerMap';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function distribute(total: number, weights: number[]): number[] {
  const w = weights.reduce((s, x) => s + x, 0) || 1;
  const raw = weights.map((x) => (x / w) * total);
  const out = raw.map(Math.floor);
  let rem = total - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0 && order.length; k = (k + 1) % order.length, rem--) out[order[k][1]]++;
  return out;
}

function sha(r: ReturnType<typeof rng>): string {
  return r.hex(64);
}

export const COUNTRY_LL: Record<string, [number, number]> = {
  US: [37.8, -97], CA: [49.5, -79], GB: [52.5, -1.5], ES: [40.4, -3.7], IN: [19.1, 72.9], FI: [60.2, 24.9], NO: [59.9, 10.7], FR: [48.9, 2.35],
  NL: [52.37, 4.9], HK: [22.3, 114.2], CH: [47.4, 8.5], SG: [1.35, 103.8], LU: [49.6, 6.1], DE: [52.5, 13.4], AU: [-33.9, 151.2], NZ: [-41.3, 174.8],
  KR: [37.6, 127], JP: [35.7, 139.7], IE: [53.3, -6.3], BE: [50.85, 4.35], MY: [3.1, 101.7], BR: [-23.5, -46.6], IT: [45.5, 9.2], ZA: [-33.9, 18.4],
  PL: [52.2, 21], MX: [19.4, -99.1], CZ: [50.1, 14.4], HU: [47.5, 19.04], SE: [59.3, 18.1], DK: [55.7, 12.6], PH: [14.6, 121], TH: [13.75, 100.5],
  AE: [25.2, 55.3], PT: [38.7, -9.1], CO: [4.7, -74.1], AR: [-34.6, -58.4], TW: [25, 121.5], RO: [44.4, 26.1],
};

/* ------------------------------------------------------------------ */
/* Scope                                                               */
/* ------------------------------------------------------------------ */

export interface CustodyScope {
  h: Headlines['custody'];
  label: string;
  items: string[];
  integrityPct: number;
  sources: { name: string; status: CustomerProfile['connectors'][number]['status']; lastSyncMin: number; intervalMin: number }[];
  tenantName: string;
}

const INTEGRITY: CustomerMap<number> = {
  maritime: 99.1, finserv: 99.7, media: 98.4, healthcare: 98.9, automotive: 99.3,
  insurance: 99.5, defence: 99.6, pharma: 99.4, sghospital: 98.7, studio: 98.6,
};

export function custodyScope(c: CustomerProfile, tenantId: string): CustodyScope {
  const h = headlines(c, tenantId).custody;
  const r = rng(`custody-scope-${c.id}-${tenantId}`);
  const extra = c.connectors.filter((k) => ['Custody', 'DLP', 'Identity'].includes(k.category) && (k.tenants === 'all' || tenantId === 'all' || k.tenants.includes(tenantId))).slice(0, 4);
  return {
    h,
    label: c.vocab.custodyLabel,
    items: c.vocab.custodyItems,
    integrityPct: tenantId === 'all' ? forCustomer(INTEGRITY, c) : Math.min(99.9, Math.round((forCustomer(INTEGRITY, c) + r.float(-0.4, 0.4, 1)) * 10) / 10),
    sources: extra.map((k) => ({ name: k.vendor === 'HexaShield' ? k.product : `${k.vendor} ${k.product}`, status: k.status, lastSyncMin: k.lastSyncMin, intervalMin: k.intervalMin })),
    tenantName: tenantId === 'all' ? `${c.short} group` : scopedTenants(c, tenantId)[0]?.name ?? tenantId,
  };
}

/* ------------------------------------------------------------------ */
/* Content in motion (sankey)                                          */
/* ------------------------------------------------------------------ */

type Triple = [string, string, string, number, boolean]; // project, action, destination, weight, sanctioned

const FLOWS: CustomerMap<Triple[]> = {
  maritime: [
    ['ECDIS ENC updates', 'Signed push (store & forward)', 'Fleet vessels (22)', 34, true],
    ['ECDIS ENC updates', 'USB copy', 'Unmanaged USB', 1.2, false],
    ['Vessel automation firmware', 'OEM portal transfer', 'Kongsberg Maritime', 7, true],
    ['Vessel automation firmware', 'Signed push (store & forward)', 'Fleet vessels (22)', 6, true],
    ['Vessel automation firmware', 'Download', 'Crew personal devices', 0.6, false],
    ['Crane PLC programmes', 'OEM portal transfer', 'Konecranes Remote Services', 5, true],
    ['Crane PLC programmes', 'Download', 'Terminal engineering', 6, true],
    ['Stowage & DG manifests', 'Signed push (store & forward)', 'Fleet vessels (22)', 14, true],
    ['Stowage & DG manifests', 'Email attachment', 'Wallem Ship Management', 9, true],
    ['Stowage & DG manifests', 'Email attachment', 'Personal email', 0.8, false],
    ['Class & PSC documents', 'OEM portal transfer', 'Bureau Veritas Marine', 6, true],
    ['Class & PSC documents', 'Download', 'Terminal engineering', 2, true],
  ],
  finserv: [
    ['Board papers', 'Board portal access', 'Board members', 22, true],
    ['Board papers', 'Download to managed device', 'Group executives', 9, true],
    ['Board papers', 'Copy to unmanaged device', 'Unmanaged device', 0.7, false],
    ['Project Kestrel data room', 'Data-room view', 'Holloway & Pryce LLP', 12, true],
    ['Project Kestrel data room', 'Data-room view', 'Ferrier Advisory', 10, true],
    ['Project Kestrel data room', 'Download to managed device', 'Ferrier Advisory', 3, true],
    ['Project Kestrel data room', 'Forward to personal email', 'Personal email', 0.6, false],
    ['Regulatory submissions', 'Regulator gateway upload', 'PRA / CSSF portals', 8, true],
    ['Regulatory submissions', 'Download to managed device', 'Group executives', 5, true],
    ['Regulatory submissions', 'Forward to personal email', 'Personal email', 0.4, false],
    ['Wealth client exports', 'Download to managed device', 'Infosys BPM', 6, true],
    ['Wealth client exports', 'Copy to unmanaged device', 'Unmanaged device', 0.5, false],
    ['Research pre-publication', 'Download to managed device', 'Bloomberg (publishing)', 4, true],
  ],
  media: [
    ['Project Nightjar', 'Accelerated transfer', 'Lumière VFX', 16, true],
    ['Project Nightjar', 'Accelerated transfer', 'Northgate Sound', 6, true],
    ['Project Nightjar', 'Review link', 'Cinesite Review Cloud', 9, true],
    ['Project Nightjar', 'Check-out to edit bay', 'Soho edit bays', 10, true],
    ['Project Nightjar', 'Personal cloud sync', 'Personal cloud', 0.7, false],
    ['The Long Tide S2', 'Accelerated transfer', 'Red Fern Localisation', 9, true],
    ['The Long Tide S2', 'Download', 'Unknown device', 0.6, false],
    ['The Long Tide S2', 'Review link', 'Cinesite Review Cloud', 7, true],
    ['Ember Run', 'Review link', 'Apex Trailer House', 8, true],
    ['Ember Run', 'Download', 'Apex Trailer House', 3, true],
    ['Ember Run', 'USB copy', 'Unmanaged USB', 0.5, false],
    ['Salt & Iron', 'Check-out to edit bay', 'Soho edit bays', 7, true],
    ['Salt & Iron', 'Review link', 'Cinesite Review Cloud', 5, true],
    ['Glasshouse', 'Accelerated transfer', 'Deluxe Distribution', 8, true],
  ],
  healthcare: [
    ['Genomics cohort GX-2026', 'Accelerated transfer', 'Research HPC (AWS enclave)', 14, true],
    ['Genomics cohort GX-2026', 'Download to managed device', 'Research Institute workstations', 6, true],
    ['Genomics cohort GX-2026', 'Personal cloud sync', 'Personal cloud', 0.5, false],
    ['Oncology trial MR-ONC-14', 'Secure share (EDC)', 'Medidata Rave (sponsor)', 10, true],
    ['Oncology trial MR-ONC-14', 'Email attachment', 'Personal email', 0.4, false],
    ['Imaging studies (second opinion)', 'DICOM transfer', 'Second Opinion Radiology Group', 12, true],
    ['Imaging studies (second opinion)', 'CD / USB burn', 'Unmanaged USB', 0.6, false],
    ['Clinical exports (Epic Clarity)', 'Download to managed device', 'Quality & analytics team', 9, true],
    ['Clinical exports (Epic Clarity)', 'Secure share (EDC)', 'Payer negotiation room', 4, true],
    ['Clinical exports (Epic Clarity)', 'Copy to unmanaged device', 'Unmanaged device', 0.5, false],
    ['Board & OCR evidence packs', 'Board portal access', 'Board members', 6, true],
    ['Board & OCR evidence packs', 'Secure share (EDC)', 'Outside counsel', 3, true],
  ],
  automotive: [
    ['Project Lumen design', 'Watermarked review link', 'AutoVision Design Studio', 10, true],
    ['Project Lumen design', 'Check-out to design studio', 'Munich design studio', 12, true],
    ['Project Lumen design', 'Screen capture', 'Personal device', 0.5, false],
    ['OTA packages (R156)', 'Signed release', 'Vireo Connect OTA backend', 16, true],
    ['OTA packages (R156)', 'Supplier build exchange', 'Continental Automotive', 6, true],
    ['OTA packages (R156)', 'Copy outside pipeline', 'Unmanaged build server', 0.4, false],
    ['Engineering IP for suppliers', 'Supplier portal exchange', 'Bosch Mobility', 11, true],
    ['Engineering IP for suppliers', 'Supplier portal exchange', 'CATL', 5, true],
    ['Engineering IP for suppliers', 'Personal cloud sync', 'Personal cloud', 0.6, false],
    ['Homologation & launch', 'Secure share', 'Type-approval authority (KBA)', 5, true],
    ['Homologation & launch', 'Watermarked review link', 'Press (embargoed)', 4, true],
    ['Homologation & launch', 'Email attachment', 'Personal email', 0.4, false],
  ],
  insurance: [
    ['Claims files & policyholder data', 'Secure share (Island browser)', 'EXL (claims BPO)', 15, true],
    ['Claims files & policyholder data', 'Estimate & photo exchange', 'CCC Intelligent Solutions', 9, true],
    ['Claims files & policyholder data', 'Litigation hold production', 'Whitcombe & Shaw LLP', 5, true],
    ['Claims files & policyholder data', 'Download to managed device', 'SIU investigators', 6, true],
    ['Claims files & policyholder data', 'Email attachment', 'Personal email', 0.6, false],
    ['Claims files & policyholder data', 'Copy to unmanaged device', 'Unmanaged device', 0.4, false],
    ['Reinsurance renewal 2027', 'Bordereaux & submission upload', 'Munich Re', 7, true],
    ['Reinsurance renewal 2027', 'Bordereaux & submission upload', 'Swiss Re', 6, true],
    ['Reinsurance renewal 2027', 'Broker data-room view', 'Aon Reinsurance Solutions', 5, true],
    ['Reinsurance renewal 2027', 'Forward to personal email', 'Personal email', 0.4, false],
    ['Actuarial & cat modelling', 'Download to managed device', 'Actuarial & cat-modelling team', 6, true],
    ['Actuarial & cat modelling', 'Secure share', 'Milliman (reserve opinion)', 3, true],
    ['Actuarial & cat modelling', 'Personal cloud sync', 'Personal cloud', 0.4, false],
    ['Board, ORSA & regulatory filings', 'Board portal access', 'Mutual Board of Directors', 8, true],
    ['Board, ORSA & regulatory filings', 'Regulator portal upload', 'NYDFS & CT Insurance Dept portals', 4, true],
    ['Project Harbourlight data room', 'Data-room view', 'Whitcombe & Shaw LLP', 4, true],
    ['Project Harbourlight data room', 'Data-room view', 'Calloway Hart Partners', 3, true],
  ],
  defence: [
    ['Guidance housing TDPs (ITAR)', 'PreVeil encrypted share', 'Lockheed Martin', 9, true],
    ['Guidance housing TDPs (ITAR)', 'Exostar partner exchange', 'Cumberland Precision Machining', 8, true],
    ['Guidance housing TDPs (ITAR)', 'DNC release to shop floor', 'Building 3 CNC cells', 10, true],
    ['Guidance housing TDPs (ITAR)', 'Email attachment (commercial tenant)', 'Commercial M365 mailbox', 0.5, false],
    ['Seeker gimbal programme', 'PreVeil encrypted share', 'RTX (Raytheon)', 7, true],
    ['Seeker gimbal programme', 'Exostar partner exchange', 'Valley Anodize & Finishing', 3, true],
    ['Seeker gimbal programme', 'USB copy', 'Unmanaged USB', 0.4, false],
    ['Qualification & test data', 'Accelerated transfer (GovCloud)', 'Tucson test range', 7, true],
    ['Qualification & test data', 'Secure share', 'Desert Sky Telemetry', 3, true],
    ['Qualification & test data', 'PreVeil encrypted share', 'Northrop Grumman', 4, true],
    ['Flight software releases', 'Signed release (GitHub Enterprise)', 'L3Harris Technologies', 4, true],
    ['Flight software releases', 'Copy outside pipeline', 'Unmanaged build host', 0.3, false],
    ['CMMC & proposal volumes', 'Assessor evidence portal', 'Redstone Cyber Assessors', 4, true],
    ['CMMC & proposal volumes', 'PreVeil encrypted share', 'RTX (Raytheon)', 4, true],
    ['CMMC & proposal volumes', 'Personal cloud sync', 'Personal cloud', 0.3, false],
  ],
  pharma: [
    ['Trial RHN-4471 (Phase III)', 'EDC secure share', 'Medidata Rave (sponsor EDC)', 14, true],
    ['Trial RHN-4471 (Phase III)', 'Accelerated transfer (SDTM)', 'IQVIA biostatistics', 10, true],
    ['Trial RHN-4471 (Phase III)', 'Restricted unblinding release', 'Independent DMC statistician', 2, true],
    ['Trial RHN-4471 (Phase III)', 'Email attachment', 'Personal email', 0.5, false],
    ['Study RHN-3810 eTMF', 'eTMF export', 'ICON plc', 9, true],
    ['Study RHN-3810 eTMF', 'eTMF export', 'Parexel', 5, true],
    ['Study RHN-3810 eTMF', 'Copy to unmanaged device', 'Unmanaged device', 0.4, false],
    ['Regulatory submissions (eCTD)', 'ESG gateway submission', 'FDA (Electronic Submissions Gateway)', 8, true],
    ['Regulatory submissions (eCTD)', 'CESP / IRIS submission', 'EMA (IRIS portal)', 6, true],
    ['Regulatory submissions (eCTD)', 'Portal submission', 'Swissmedic (eGov portal)', 4, true],
    ['Regulatory submissions (eCTD)', 'Accelerated transfer', 'Kessler Regulatory Publishing', 5, true],
    ['Process IP & tech transfer', 'Accelerated transfer', 'Samsung Biologics', 9, true],
    ['Process IP & tech transfer', 'Accelerated transfer', 'Lonza', 7, true],
    ['Process IP & tech transfer', 'Supplier portal exchange', 'Catalent', 3, true],
    ['Process IP & tech transfer', 'Personal cloud sync', 'Personal cloud', 0.5, false],
    ['Publications & business development', 'Data-room view', 'Alpenglow Therapeutics (Edelweiss)', 5, true],
    ['Publications & business development', 'Watermarked review link', 'Journal editorial office', 3, true],
    ['Publications & business development', 'Forward to personal email', 'Personal email', 0.3, false],
  ],
  sghospital: [
    ['NEHR & HIA submissions', 'HealthConnect batch upload', 'Synapxe (NEHR)', 16, true],
    ['NEHR & HIA submissions', 'Regulator portal upload', 'MOH (HIA reporting portal)', 3, true],
    ['Insurer claims exports', 'SFTP (managed)', 'Great Eastern Life', 9, true],
    ['Insurer claims exports', 'SFTP (managed)', 'AIA Singapore', 8, true],
    ['Insurer claims exports', 'Secure share', 'Prudential Singapore', 5, true],
    ['Insurer claims exports', 'Email attachment', 'Personal email', 0.5, false],
    ['Imaging studies (second opinion)', 'DICOM transfer', 'Harbourview Teleradiology (Sydney)', 7, true],
    ['Imaging studies (second opinion)', 'CD / USB burn', 'Unmanaged USB', 0.6, false],
    ['Imaging studies (second opinion)', 'Patient portal release', 'Patients (MyOrchid app)', 4, true],
    ['Research datasets', 'Accelerated transfer', 'Straits Clinical Research Partners', 6, true],
    ['Research datasets', 'Download to managed device', 'Clinical Research Unit', 4, true],
    ['Research datasets', 'Personal cloud sync', 'Personal cloud', 0.4, false],
    ['Board & PDPC evidence packs', 'Board portal access', 'Board members', 3, true],
    ['Board & PDPC evidence packs', 'Secure share', 'External counsel', 2, true],
  ],
  studio: [
    ['Crown of Ash', 'Check-out to edit bay', 'Burbank editorial (Avid)', 12, true],
    ['Crown of Ash', 'Accelerated transfer', 'Company 3', 9, true],
    ['Crown of Ash', 'Watermarked screener (Indee)', 'Awards voters (FYC)', 10, true],
    ['Crown of Ash', 'Review link', 'Silverline Trailer Co.', 5, true],
    ['Crown of Ash', 'Screen capture', 'Personal device', 0.6, false],
    ['Lodestar', 'Accelerated transfer (Aspera)', 'Industrial Light & Magic', 15, true],
    ['Lodestar', 'Accelerated transfer (Signiant)', 'DNEG', 8, true],
    ['Lodestar', 'Accelerated transfer (Signiant)', 'Northlight Pixel (Vancouver)', 5, true],
    ['Lodestar', 'Personal cloud sync', 'Personal cloud', 0.7, false],
    ['The Hollow Coast S3', 'Accelerated transfer', 'Iyuno', 9, true],
    ['The Hollow Coast S3', 'Accelerated transfer', 'Bluebird Dubbing Studios', 6, true],
    ['The Hollow Coast S3', 'Dailies (Moxion)', 'Production & network executives', 8, true],
    ['The Hollow Coast S3', 'Download', 'Unknown device', 0.5, false],
    ['Skyward Kids 2', 'Review link (Frame.io)', 'Weta FX', 6, true],
    ['Skyward Kids 2', 'USB copy', 'Unmanaged USB', 0.4, false],
    ['Nightglass', 'IMF delivery', 'Deluxe', 8, true],
    ['Nightglass', 'IMF delivery', 'Starfall+ encoding pipeline', 7, true],
    ['Nightglass', 'Licensee delivery', 'International licensees', 5, true],
  ],
};

export interface CustodyFlow { project: string; action: string; dest: string; count: number; sanctioned: boolean }

export function custodyFlows(c: CustomerProfile, tenantId: string, days: number): CustodyFlow[] {
  const h = headlines(c, tenantId).custody;
  const total = Math.max(12, Math.round((h.transfers7d * days) / 7));
  const r = rng(`custody-flows-${c.id}-${tenantId}`);
  const seeds = forCustomer(FLOWS, c);
  const counts = distribute(total, seeds.map((s) => s[3] * r.float(0.8, 1.2, 2)));
  return seeds.map((s, i) => ({ project: s[0], action: s[1], dest: s[2], count: Math.max(s[4] ? 1 : 1, counts[i]), sanctioned: s[4] }));
}

/* ------------------------------------------------------------------ */
/* Triage (anomalies)                                                  */
/* ------------------------------------------------------------------ */

export interface CustodyAnomaly {
  id: string;
  sev: Severity;
  title: string;
  asset: string;
  actor: string;
  org: string;
  machine: string;
  action: string;
  destination: string;
  tenantId: string;
  ageMin: number;
  detail: string;
  evidence: string[];
  recommended: string;
}

type AnomSeed = Omit<CustodyAnomaly, 'id' | 'ageMin'> & { age: number };

const ANOMALIES: CustomerMap<AnomSeed[]> = {
  healthcare: [
    { sev: 'high', title: 'Genomics cohort synced to a personal OneDrive', asset: 'Genomics cohort GX-2026 (de-identified)', actor: 'Postdoctoral researcher', org: 'Mercy Ridge Research Institute', machine: 'RES-WS-0412', action: 'Personal cloud sync', destination: 'OneDrive (personal account)', tenantId: 'research', age: 64, detail: '18.4 GB of de-identified genomic variants synced from a lab workstation to a personal OneDrive outside the data-use agreement.', evidence: ['Custody agent file event (sync client write)', 'Netskope: unsanctioned instance upload', 'Entra ID sign-in from RES-WS-0412', 'Watermark WM-3C1E-82D0 bound to this copy'], recommended: 'Revoke the user grant, recall the copy and notify the IRB and privacy office.' },
    { sev: 'high', title: 'Imaging study burned to CD for an unverified requester', asset: 'Imaging studies for second opinion', actor: 'Radiology front desk', org: 'Mercy Ridge Medical Center', machine: 'MRMC-RAD-BURN02', action: 'CD / USB burn', destination: 'Unmanaged media', tenantId: 'mrmc', age: 210, detail: 'A CT study with PHI was burned to disc for a requester whose authorisation form is missing from Epic.', evidence: ['Custody agent media-write event', 'Epic release-of-information log (no ROI record)'], recommended: 'Confirm the requester with HIM; log a potential disclosure for the privacy office.' },
    { sev: 'medium', title: 'Clarity extract with PHI opened on an unmanaged laptop', asset: 'Epic Clarity extract (quality reporting)', actor: 'Quality analyst', org: 'Mercy Ridge Medical Center', machine: 'Personal laptop (no agent)', action: 'Copy to unmanaged device', destination: 'Unmanaged device', tenantId: 'mrmc', age: 760, detail: 'A quality-reporting extract was opened from a personal laptop over VPN; the agent blocked a save to local disk.', evidence: ['VPN session log', 'Custody agent policy decision'], recommended: 'Re-issue via the analytics VDI only.' },
    { sev: 'medium', title: 'Trial dataset emailed to a sponsor contact outside the EDC', asset: 'Oncology trial MR-ONC-14 datasets', actor: 'Study coordinator', org: 'Mercy Ridge Research Institute', machine: 'RES-WS-0218', action: 'Email attachment', destination: 'Sponsor personal address', tenantId: 'research', age: 1400, detail: 'Dataset attached to an email to a sponsor monitor rather than shared through Medidata.', evidence: ['Proofpoint outbound log', 'Custody agent mail event'], recommended: 'Recall where possible; remind the study team of the EDC route.' },
    { sev: 'low', title: 'Custody agent silent at Second Opinion Radiology Group for 19 h', asset: 'Imaging studies for second opinion', actor: 'Agent heartbeat', org: 'Second Opinion Radiology Group', machine: 'SORG-PACS-GW', action: 'Heartbeat gap', destination: '—', tenantId: 'clinics', age: 1140, detail: 'No heartbeat from the partner gateway holding 31 studies; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Ask the partner to restore the agent before new studies are sent.' },
  ],
  automotive: [
    { sev: 'critical', title: 'Screen capture of Lumen design-freeze renders at the external studio', asset: 'Project Lumen (2028 EV) design freeze renders', actor: 'Freelance visualiser', org: 'AutoVision Design Studio', machine: 'AV-WS-07', action: 'Screen capture', destination: 'Personal device', tenantId: 'group', age: 42, detail: 'Eleven screen captures of the front three-quarter render taken at 23:10 and synced to a personal phone; forensic watermark visible in each.', evidence: ['Custody agent screen-capture event', 'Watermark WM-91AF-0C2B bound to this session', 'Okta session for the freelancer'], recommended: 'Revoke the supplier session, preserve evidence and brief Design Security before any leak surfaces.' },
    { sev: 'high', title: 'OTA package hash mismatch at staging (R156 integrity)', asset: 'OTA package 24.9.3 (ADAS) signed build', actor: 'OTA staging pipeline', org: 'Vireo Connect', machine: 'VMG-OTA-STG02', action: 'Integrity check before release', destination: 'OTA backend', tenantId: 'connected', age: 130, detail: 'The package in staging does not match the signed build hash; release to 410,000 vehicles held automatically under UNECE R156.', evidence: ['Signed build manifest', 'Hash computed at staging', 'Release hold recorded by the OTA release manager'], recommended: 'Quarantine the package and rebuild from the signed source; investigate the staging host.' },
    { sev: 'high', title: 'Battery cell spec VC-7 synced to a personal cloud', asset: 'Battery cell spec VC-7 (confidential)', actor: 'Process engineer', org: 'Cell Plant Salzgitter', machine: 'SZG-ENG-LT14', action: 'Personal cloud sync', destination: 'Personal cloud', tenantId: 'battery', age: 400, detail: 'Cell chemistry specification synced from an office laptop to a personal Google Drive.', evidence: ['Custody agent file event', 'Netskope: unsanctioned instance upload'], recommended: 'Revoke the user grant and recall the copy; Works Council process applies.' },
    { sev: 'medium', title: 'Teamcenter export opened by an unregistered Bosch user', asset: 'Teamcenter export for Bosch (ECU)', actor: 'Unknown Bosch account', org: 'Bosch Mobility', machine: 'BOSCH-LT-unknown', action: 'Open file', destination: 'Bosch Mobility', tenantId: 'group', age: 880, detail: 'Supplier portal export opened by an account not on the programme team list.', evidence: ['Supplier portal audit log', 'Custody agent open event'], recommended: 'Confirm with the Bosch programme lead; restrict to named users.' },
    { sev: 'medium', title: 'Supplier pricing workbook forwarded to a personal email', asset: 'Supplier pricing (sourcing round)', actor: 'Purchasing analyst', org: 'Vireo Group IT & R&D', machine: 'VMG-WS-3391', action: 'Email attachment', destination: 'Personal email', tenantId: 'group', age: 1600, detail: 'Sourcing-round pricing forwarded to a personal address; watermark policy quarantined the attachment.', evidence: ['Proofpoint outbound log', 'Custody agent mail event'], recommended: 'Line manager review; compliance notified (antitrust sensitivity).' },
    { sev: 'medium', title: 'Embargoed press kit opened from an unexpected country', asset: 'Press launch media kit (embargoed)', actor: 'Press portal account', org: 'Vireo Retail & Dealer Network', machine: 'Press portal', action: 'Stream', destination: 'Press portal', tenantId: 'retail', age: 2300, detail: 'Embargoed kit viewed from an IP in a country where the journalist has no assignment.', evidence: ['Press portal log'], recommended: 'Step-up verification on next access.' },
    { sev: 'low', title: 'Custody agent silent at CATL for 31 h', asset: 'Battery cell spec VC-7 (confidential)', actor: 'Agent heartbeat', org: 'CATL', machine: 'CATL-ENG-GW', action: 'Heartbeat gap', destination: '—', tenantId: 'group', age: 1860, detail: 'No heartbeat from the partner gateway holding 9 documents; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Hold new deliveries until the agent reports.' },
  ],
  media: [
    { sev: 'critical', title: 'Nightjar locked cut copied to personal cloud', asset: 'Project Nightjar – locked cut v14', actor: 'Ravi Kapoor (freelance colourist)', org: 'Kestrel Post & VFX', machine: 'POST-BASELIGHT-02', action: 'Personal cloud sync', destination: 'Dropbox (personal account)', tenantId: 'post', age: 38, detail: '41.6 GB ProRes file synced from the grading suite to a personal Dropbox account at 02:14, outside the booked session.', evidence: ['Custody agent file event (sync client write)', 'Netskope: unsanctioned instance upload', 'Okta session for ravi.k from POST-BASELIGHT-02', 'Forensic watermark WM-7F2A-19C4 bound to this copy'], recommended: 'Revoke the session and the user grant; preserve evidence; brief Content Security.' },
    { sev: 'high', title: 'Ember Run trailer #2 opened on an unregistered device', asset: 'Ember Run – trailer #2 (unreleased)', actor: 'Contractor at Apex Trailer House', org: 'Apex Trailer House', machine: 'Unregistered MacBook (no agent)', action: 'Review link opened', destination: 'Unknown device', tenantId: 'studios', age: 140, detail: 'Watermarked review link opened from a device with no custody agent, from an IP outside Apex\'s registered ranges.', evidence: ['Review link telemetry', 'Device fingerprint not in vendor register'], recommended: 'Expire the review link and re-issue to named users only.' },
    { sev: 'high', title: 'Untracked copy of Long Tide S2 scripts at Red Fern Localisation', asset: 'The Long Tide S2 – scripts 5–8', actor: 'Red Fern project share', org: 'Red Fern Localisation', machine: 'RF-NAS-02', action: 'Copy outside custody', destination: 'Vendor NAS (no agent)', tenantId: 'studios', age: 300, detail: 'Two copies appeared on a vendor NAS without custody agent coverage; hashes match the released script set.', evidence: ['Hash match from vendor attestation scan', 'No agent heartbeat from RF-NAS-02'], recommended: 'Require agent install before next delivery; revoke supplier grant if not resolved in 48 h.' },
    { sev: 'medium', title: 'Salt & Iron dailies link forwarded outside the allow-list', asset: 'Salt & Iron – dailies D42', actor: 'Production coordinator', org: 'Kestrel Studios', machine: 'STU-DIT-CART07', action: 'Review link forward', destination: 'Gmail address', tenantId: 'studios', age: 420, detail: 'Dailies link forwarded to a personal Gmail address; stream blocked at first play.', evidence: ['Review link telemetry', 'Google Workspace sharing audit'], recommended: 'Confirm with production; no further action if intended recipient verified.' },
    { sev: 'medium', title: 'Nightjar key art exported without a forensic watermark', asset: 'Nightjar – key art (embargoed)', actor: 'Hannah Cole', org: 'Kestrel Studios', machine: 'KPG-MKT-WS14', action: 'Export', destination: 'Local disk', tenantId: 'studios', age: 610, detail: 'PSD export bypassed the watermark policy through a plug-in not on the approved list.', evidence: ['Custody agent export event', 'Watermark policy check failed'], recommended: 'Re-export through the approved pipeline; block the plug-in.' },
    { sev: 'medium', title: 'Bulk download of Glasshouse IMF master outside delivery window', asset: 'Glasshouse – IMF master (UHD)', actor: 'Deluxe delivery service account', org: 'Deluxe Distribution', machine: 'DLX-XFER-03', action: 'Accelerated transfer', destination: 'Deluxe Distribution', tenantId: 'studios', age: 900, detail: '2.1 TB pulled 3 days before the booked delivery window.', evidence: ['Transfer log', 'Delivery schedule (MAM)'], recommended: 'Confirm with Deluxe; tighten grant window.' },
    { sev: 'low', title: 'Custody agent silent at Pixel Forge Animation for 26 h', asset: 'Asset library (Pixel Forge)', actor: 'Agent heartbeat', org: 'Pixel Forge Animation', machine: 'PF-WS-11', action: 'Heartbeat gap', destination: '—', tenantId: 'post', age: 1560, detail: 'No heartbeat from one workstation holding 14 assets; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Ask vendor to restore the agent; hold new deliveries.' },
    { sev: 'medium', title: 'Screener streamed from a new country with no travel record', asset: 'Ember Run – trailer #2 (unreleased)', actor: 'Awards screener account', org: 'Kestrel Studios', machine: 'Screener portal', action: 'Stream', destination: 'Screener portal', tenantId: 'play', age: 2100, detail: 'Screener streamed from Singapore; account holder has no travel booking.', evidence: ['Screener portal log', 'Travel system lookup'], recommended: 'Step-up verification on next play.' },
    { sev: 'low', title: 'Expired grant used by a Northgate Sound session (blocked)', asset: 'The Long Tide S2E01 – final mix', actor: 'Northgate mix engineer', org: 'Northgate Sound', machine: 'NG-PT-04', action: 'Open file', destination: '—', tenantId: 'live', age: 2900, detail: 'Session tried to open the final mix 2 h after the grant expired; the agent blocked it.', evidence: ['Custody agent policy decision'], recommended: 'None; working as intended.' },
  ],
  maritime: [
    { sev: 'high', title: 'K-Chief firmware package hash mismatch on Halcyon Vega', asset: 'K-Chief 600 firmware 3.4.2', actor: 'Vessel edge collector', org: 'Halcyon Line Fleet', machine: 'HCY-VEG-EDGE', action: 'Integrity check before install', destination: 'Engine control (K-Chief)', tenantId: 'fleet', age: 95, detail: 'Package on board does not match the Kongsberg-signed SHA-256 (IACS UR E27 software integrity). Installation held by the chief engineer.', evidence: ['OEM-signed manifest', 'On-board hash computed by edge collector', 'Chief engineer hold recorded'], recommended: 'Quarantine the package and re-send the signed build over the next satellite window.' },
    { sev: 'medium', title: 'ENC update copied to a crew USB on Halcyon Tempest', asset: 'ECDIS ENC weekly update (wk 40)', actor: '2nd officer', org: 'Halcyon Line Fleet', machine: 'HCY-TEM-BRG-PC', action: 'USB copy', destination: 'Unmanaged USB', tenantId: 'fleet', age: 640, detail: 'Chart update copied to an unregistered USB stick outside the weekly ENC window.', evidence: ['Custody agent USB event', 'Bridge PC removable-media log'], recommended: 'Remind crew of the media procedure; scan the stick at the kiosk.' },
    { sev: 'medium', title: 'Stowage plan forwarded to a personal email address', asset: 'Stowage plan HCY-AURORA-112E', actor: 'Planning clerk', org: 'Group HQ', machine: 'HPS-WS-2231', action: 'Email attachment', destination: 'Personal email', tenantId: 'hq', age: 1300, detail: 'Stowage plan with dangerous-goods positions forwarded to a personal address.', evidence: ['Custody agent mail event', 'Proofpoint outbound log'], recommended: 'Recall where possible; review with the line manager.' },
    { sev: 'low', title: 'Class survey report opened outside Bureau Veritas', asset: 'Class survey report – Halcyon Borealis', actor: 'Unknown viewer', org: 'Bureau Veritas Marine', machine: 'Portal', action: 'View', destination: 'Third-party portal', tenantId: 'hq', age: 2600, detail: 'Report link opened from an address outside the class society.', evidence: ['Portal access log'], recommended: 'Confirm with Bureau Veritas.' },
  ],
  finserv: [
    { sev: 'high', title: 'Q3 Board pack opened on an unmanaged device', asset: 'Q3 Board pack (Group)', actor: 'Non-executive director', org: 'Aldersgate Bank UK plc', machine: 'Personal iPad (no agent)', action: 'Copy to unmanaged device', destination: 'Unmanaged device', tenantId: 'ukbank', age: 75, detail: 'Board pack downloaded from the portal to a personal tablet without the managed reader.', evidence: ['Board portal log', 'Custody agent: copy left managed boundary'], recommended: 'Revoke the session; re-issue through the managed reader.' },
    { sev: 'high', title: 'Project Kestrel data room bulk export by adviser', asset: 'Project Kestrel M&A data room', actor: 'Analyst, Ferrier Advisory', org: 'Ferrier Advisory', machine: 'FA-LT-0412', action: 'Download to managed device', destination: 'Ferrier Advisory', tenantId: 'markets', age: 260, detail: '312 documents exported in 9 minutes, 6× the adviser\'s usual rate.', evidence: ['Data room audit log', 'Custody agent volume baseline'], recommended: 'Pause the adviser grant pending deal-team confirmation.' },
    { sev: 'medium', title: 'ICAAP draft forwarded to a personal email', asset: 'ICAAP 2026 draft', actor: 'Treasury analyst', org: 'Aldersgate Bank UK plc', machine: 'ALD-WS-8812', action: 'Forward to personal email', destination: 'Personal email', tenantId: 'ukbank', age: 980, detail: 'Draft forwarded to a personal address; blocked by watermark policy, copy quarantined.', evidence: ['Proofpoint outbound log', 'Custody agent mail event'], recommended: 'Line manager review.' },
    { sev: 'medium', title: 'Wealth SG client export copied to USB', asset: 'Client portfolio exports (Wealth SG)', actor: 'Relationship manager', org: 'Aldersgate Private Wealth', machine: 'WLT-SG-LT-221', action: 'Copy to unmanaged device', destination: 'Unmanaged device', tenantId: 'wealth', age: 1720, detail: 'Client export copied to a USB stick (MAS TRM data handling).', evidence: ['Custody agent USB event', 'Netskope endpoint DLP'], recommended: 'Recover the device; notify compliance.' },
    { sev: 'medium', title: 'Research note opened before the publication embargo', asset: 'Research note: UK Banks pre-publication', actor: 'Sales trader', org: 'Aldersgate Markets Inc.', machine: 'MKT-WS-0921', action: 'Open file', destination: '—', tenantId: 'markets', age: 2400, detail: 'Note opened by a sales trader 3 h before publication (information barrier).', evidence: ['Custody agent open event', 'Information barrier list'], recommended: 'Refer to compliance surveillance.' },
  ],
  insurance: [
    { sev: 'high', title: 'Litigation-hold claim files bulk-pulled by an EXL processor', asset: 'Claims files under litigation hold (Doyle v. Kingsbridge)', actor: 'Claims processor, EXL (Pune)', org: 'EXL', machine: 'EXL-VDI-PUN-0412', action: 'Mass download', destination: 'EXL (claims BPO)', tenantId: 'claims', age: 52, detail: '1,240 ClaimCenter documents, including policyholder PII and medical records, pulled through the Island browser in 14 minutes, nine times the processor\'s baseline. Three files are under the Doyle v. Kingsbridge litigation hold.', evidence: ['Island Enterprise Browser download log', 'Guidewire ClaimCenter document-access audit', 'Custody agent volume baseline (EXL processors)', 'Watermark WM-4B71-C2E0 bound to this session'], recommended: 'Suspend the processor grant, confirm with the EXL delivery lead and preserve the copies for Legal (litigation hold).' },
    { sev: 'high', title: 'Reinsurance submission forwarded to a personal Gmail', asset: '2027 reinsurance treaty renewal (Munich Re / Swiss Re)', actor: 'Reinsurance analyst', org: 'Kingsbridge Mutual Group Services', machine: 'KMI-LT-2207', action: 'Forward to personal email', destination: 'Personal email (Gmail)', tenantId: 'group', age: 310, detail: 'Treaty submission workbook with loss triangles and cedent exposure data forwarded to a personal address the night before the Munich Re meeting; the custody policy quarantined the attachment.', evidence: ['Proofpoint outbound log', 'Custody agent mail event', 'Purview label: Kingsbridge Confidential – Reinsurance'], recommended: 'Line manager review with Brian McAllister; confirm the copy was never opened outside the estate.' },
    { sev: 'medium', title: 'Hurricane cat-model outputs synced to a personal Dropbox', asset: 'Hurricane season 2026 cat model outputs', actor: 'Catastrophe modeller', org: 'Kingsbridge Commercial Insurance Company', machine: 'KMI-ACT-WS11', action: 'Personal cloud sync', destination: 'Dropbox (personal account)', tenantId: 'commercial', age: 980, detail: '6.2 GB of event-loss tables and PML outputs synced from an actuarial workstation to a personal Dropbox; Netskope blocked the second half of the upload.', evidence: ['Custody agent file event (sync client write)', 'Netskope: unsanctioned instance upload'], recommended: 'Revoke the user grant and recall the copy; remind the cat team of the sanctioned Milliman share.' },
    { sev: 'medium', title: 'ORSA summary opened on a director\'s personal tablet', asset: 'ORSA Summary Report 2026', actor: 'Board director (Mutual Board)', org: 'Kingsbridge Mutual Group Services', machine: 'Personal iPad (no agent)', action: 'Copy to unmanaged device', destination: 'Unmanaged device', tenantId: 'group', age: 1500, detail: 'The ORSA summary was saved from the board portal to a personal tablet without the managed reader, ahead of filing with the Connecticut Insurance Department.', evidence: ['Board portal log', 'Custody agent: copy left managed boundary'], recommended: 'Revoke the session and re-issue through the managed reader.' },
    { sev: 'low', title: 'Custody agent silent at Swiss Re for 22 h', asset: '2027 reinsurance treaty renewal (Munich Re / Swiss Re)', actor: 'Agent heartbeat', org: 'Swiss Re', machine: 'SRE-UW-GW', action: 'Heartbeat gap', destination: '—', tenantId: 'group', age: 1320, detail: 'No heartbeat from the reinsurer gateway holding 18 submission files; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Ask Swiss Re to restore the agent before the next bordereaux drop.' },
    { sev: 'low', title: 'Policyholder telematics extract opened after grant expiry (blocked)', asset: 'Claims files under litigation hold (Doyle v. Kingsbridge)', actor: 'Analyst, Cambridge Mobile Telematics', org: 'Cambridge Mobile Telematics', machine: 'CMT-ANL-07', action: 'Open file', destination: '—', tenantId: 'personal', age: 2600, detail: 'A crash-reconstruction extract was opened two hours after its grant expired; the agent refused the key.', evidence: ['Custody agent policy decision'], recommended: 'None; working as intended.' },
  ],
  defence: [
    { sev: 'high', title: 'ITAR drawing set opened by an unregistered sub-tier user', asset: 'Seeker gimbal drawing set rev F (CUI//SP-EXPT)', actor: 'Unregistered account, Valley Anodize', org: 'Valley Anodize & Finishing', machine: 'VAF-SHOP-PC02', action: 'Open file', destination: 'Valley Anodize & Finishing', tenantId: 'engineering', age: 88, detail: 'An export-controlled drawing set shared for anodise masking was opened by an account that is not on the Exostar access list and has no US-person attestation on file. Carla Jennings (Empowered Official) has been paged.', evidence: ['Exostar Partner Information Manager audit', 'Custody agent open event', 'Teamcenter ITAR item export record', 'Watermark WM-58D2-A7F1 bound to this copy'], recommended: 'Revoke the supplier session, preserve evidence and run the ITAR voluntary-disclosure assessment with Trade Compliance.' },
    { sev: 'high', title: 'CUI TDP attached from the commercial tenant', asset: 'TDP-2207 guidance housing (ITAR, USML Cat. XII)', actor: 'Buyer, Subcontracts', org: 'Corporate & Finance (commercial M365, Costpoint)', machine: 'SPD-LT-0318', action: 'Email attachment', destination: 'Commercial M365 mailbox', tenantId: 'corporate', age: 240, detail: 'A TDP zip carrying CUI//SP-EXPT markings was attached to an RFQ email from the commercial tenant instead of PreVeil; Purview blocked delivery and the custody agent quarantined the draft.', evidence: ['Purview DLP policy match (CUI label)', 'Custody agent mail event', 'Defender for Office 365 message trace'], recommended: 'Re-send via PreVeil and log a CUI spillage review for the commercial mailbox (DFARS 252.204-7012).' },
    { sev: 'medium', title: 'Tucson environmental test data copied to USB', asset: 'Environmental test data, Tucson campaign 26-04', actor: 'Test technician', org: 'Tucson Test Range & Integration', machine: 'TUS-TEST-DAQ01', action: 'USB copy', destination: 'Unmanaged USB', tenantId: 'tucson', age: 760, detail: '3.1 GB of vibration and thermal-cycle data copied from the DAQ host to an unregistered USB stick at the range.', evidence: ['Custody agent USB event', 'Intune device-control log'], recommended: 'Recover and scan the stick; use the GovCloud transfer for range data.' },
    { sev: 'medium', title: 'Flight software build copied outside the release pipeline', asset: 'Flight software build 3.7.1 (export-controlled)', actor: 'Firmware engineer', org: 'Engineering & Design (CAD/PLM)', machine: 'SPD-ENG-WS44', action: 'Copy outside pipeline', destination: 'Unmanaged build host', tenantId: 'engineering', age: 1700, detail: 'A signed build artefact was copied to a lab host that is not enrolled in the custody agent or Intune.', evidence: ['Custody agent file event', 'GitHub Enterprise release audit'], recommended: 'Enrol or wipe the host; re-baseline the release hash.' },
    { sev: 'low', title: 'Custody agent silent at Cumberland Precision for 20 h', asset: 'TDP-2207 guidance housing (ITAR, USML Cat. XII)', actor: 'Agent heartbeat', org: 'Cumberland Precision Machining', machine: 'CPM-CAM-GW', action: 'Heartbeat gap', destination: '—', tenantId: 'manufacturing', age: 1200, detail: 'No heartbeat from the sub-tier CAM gateway holding 6 TDP revisions; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Hold the next TDP release until the agent reports.' },
  ],
  pharma: [
    { sev: 'critical', title: 'RTSM randomisation list exported outside the unblinded team', asset: 'Unblinding keys & RTSM randomisation lists, RHN-4471', actor: 'Clinical data manager (blinded role)', org: 'Rhenara Global Clinical Operations', machine: 'DUB-CDM-WS17', action: 'Export', destination: 'Local disk', tenantId: 'clinops', age: 46, detail: 'A randomisation list for the Phase III RHN-4471 study was exported from Medidata RTSM by a user in a blinded role. Unblinding risk to the primary endpoint; Dr. Priya Raman and the study statistician have been alerted.', evidence: ['Medidata Rave RTSM audit trail (Part 11)', 'Custody agent export event', 'Okta role assignment (blinded)', 'Watermark WM-2E90-71BC bound to this copy'], recommended: 'Revoke the user grant, quarantine the copy, open a GCP deviation and assess unblinding impact with the DMC.' },
    { sev: 'high', title: 'Tech-transfer pack synced to a personal cloud', asset: 'Biologics tech-transfer pack to Samsung Biologics', actor: 'Process development scientist', org: 'Valais API & Biologics Plant', machine: 'VLS-PD-LT09', action: 'Personal cloud sync', destination: 'Google Drive (personal account)', tenantId: 'valais', age: 190, detail: '2.4 GB of upstream process parameters, cell-line history and PPQ protocols synced to a personal Google Drive the week before the scientist\'s resignation takes effect.', evidence: ['Custody agent file event (sync client write)', 'Netskope: unsanctioned instance upload', 'Workday: resignation recorded'], recommended: 'Revoke the user grant, recall the copy and brief Legal (trade-secret preservation).' },
    { sev: 'high', title: 'eTMF export opened by a CRO account outside the study team', asset: 'eTMF export to ICON, study RHN-3810', actor: 'Unknown ICON account', org: 'ICON plc', machine: 'ICON-VDI-DUB-221', action: 'Open file', destination: 'ICON plc', tenantId: 'clinops', age: 420, detail: 'The RHN-3810 eTMF export was opened by an ICON account that is not on the study delegation log; investigator CVs and patient-identifiable site documents are in scope.', evidence: ['Okta CRO partner-portal sign-in', 'Veeva Vault eTMF audit trail', 'Custody agent open event'], recommended: 'Confirm with the ICON study lead; restrict the grant to named delegates.' },
    { sev: 'medium', title: 'eCTD sequence hash changed after QA sign-off', asset: 'eCTD sequence 0042 (FDA BLA, rhenatumab)', actor: 'Regulatory publisher', org: 'Kessler Regulatory Publishing', machine: 'KRP-PUB-03', action: 'Integrity check before submission', destination: 'FDA (Electronic Submissions Gateway)', tenantId: 'corporate', age: 900, detail: 'Module 3 leaf files in sequence 0042 no longer match the hash recorded at QA sign-off; the ESG submission was held automatically.', evidence: ['QA sign-off manifest (Veeva)', 'Hash computed before ESG upload', 'Submission hold recorded'], recommended: 'Re-publish from the signed source and re-run the QA check before submission.' },
    { sev: 'medium', title: 'Embargoed Phase II results forwarded to a personal address', asset: 'Pre-publication Phase II results (journal embargo)', actor: 'Medical affairs manager', org: 'Rhenara Commercial Operations (EU & US)', machine: 'MOR-MA-LT33', action: 'Forward to personal email', destination: 'Personal email', tenantId: 'commercial', age: 1400, detail: 'Topline efficacy tables under journal embargo were forwarded to a personal address (market-sensitive under MAR / SIX ad hoc rules); watermark policy quarantined the copy.', evidence: ['Proofpoint outbound log', 'Custody agent mail event'], recommended: 'Line manager and Compliance review; confirm no onward disclosure.' },
    { sev: 'low', title: 'Custody agent silent at WuXi AppTec for 28 h', asset: 'Project Edelweiss in-licensing data room', actor: 'Agent heartbeat', org: 'WuXi AppTec', machine: 'WUXI-CHEM-GW', action: 'Heartbeat gap', destination: '—', tenantId: 'rnd', age: 1680, detail: 'No heartbeat from the CRO gateway holding 12 compound dossiers; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Hold new compound transfers until the agent reports.' },
  ],
  sghospital: [
    { sev: 'high', title: 'Imaging study burned to CD for an unverified overseas requester', asset: 'Imaging studies for overseas second opinion', actor: 'Radiology front desk', org: 'Orchid Bay Diagnostics (Laboratory & Imaging)', machine: 'LAB-RAD-BURN01', action: 'CD / USB burn', destination: 'Unmanaged media', tenantId: 'labimg', age: 120, detail: 'An MRI study with patient identifiers was burned to disc for a courier whose consent and release form is missing from TrakCare; the request names an overseas clinic not on the partner list.', evidence: ['Custody agent media-write event', 'TrakCare release-of-information log (no record)', 'PACS export audit (Philips)'], recommended: 'Stop the courier hand-off, confirm consent with Medical Records and log a potential PDPA disclosure for the DPO.' },
    { sev: 'medium', title: 'Insurer claims export emailed outside the SFTP route', asset: 'Insurer claims export (Great Eastern, AIA)', actor: 'Billing executive', org: 'Orchid Bay Corporate & Shared Services', machine: 'OBH-BIL-WS07', action: 'Email attachment', destination: 'Insurer claims officer (personal address)', tenantId: 'corp', age: 640, detail: 'A claims export with diagnosis codes for 214 patients was attached to an email to a named insurer officer instead of the managed SFTP drop.', evidence: ['Mimecast outbound log', 'Custody agent mail event', 'Purview label: Patient Confidential'], recommended: 'Recall the email, re-send via SFTP and record the incident for the HIA data-security log.' },
    { sev: 'medium', title: 'Research dataset synced to a personal OneDrive', asset: 'Clinical research dataset CR-HEART-22', actor: 'Clinical research coordinator', org: 'Orchid Bay Specialist Centres (Cancer, Heart, Women & Children)', machine: 'SPC-CRU-LT04', action: 'Personal cloud sync', destination: 'OneDrive (personal account)', tenantId: 'specialist', age: 1300, detail: 'A coded cardiology dataset synced to a personal OneDrive outside the IRB-approved environment.', evidence: ['Custody agent file event', 'Defender for Cloud Apps: unsanctioned instance'], recommended: 'Revoke the user grant and recall the copy; notify the IRB.' },
    { sev: 'low', title: 'Custody agent silent at Harbourview Teleradiology for 18 h', asset: 'Imaging studies for overseas second opinion', actor: 'Agent heartbeat', org: 'Harbourview Teleradiology', machine: 'HBV-PACS-GW', action: 'Heartbeat gap', destination: '—', tenantId: 'labimg', age: 1080, detail: 'No heartbeat from the partner gateway holding 23 studies; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Ask the partner to restore the agent before new studies are sent.' },
  ],
  studio: [
    { sev: 'critical', title: 'Crown of Ash locked cut synced to a personal cloud', asset: 'Crown of Ash – locked cut v22', actor: 'Freelance assistant editor', org: 'Starfall Studios & Production', machine: 'STU-AVID-BAY14', action: 'Personal cloud sync', destination: 'Dropbox (personal account)', tenantId: 'studios', age: 34, detail: '58.3 GB DNxHR file synced from a Burbank edit bay to a personal Dropbox at 01:52, outside the booked session. NexGuard watermark bound to the bay session.', evidence: ['Custody agent file event (sync client write)', 'Netskope: unsanctioned instance upload', 'Okta session from STU-AVID-BAY14', 'Forensic watermark WM-C41A-7D09 bound to this copy'], recommended: 'Revoke the session and user grant, preserve evidence and brief Rebecca Lindgren (Content Security).' },
    { sev: 'critical', title: 'NexGuard hit: awards screener frames on a piracy forum', asset: 'Crown of Ash – awards screener (FYC)', actor: 'Awards voter screener account', org: 'Indee', machine: 'Screener portal', action: 'Screen capture', destination: 'Piracy forum (Telegram channel)', tenantId: 'studios', age: 95, detail: 'NexGuard decoded the session watermark from 12 frames posted to a Telegram channel; it maps to one FYC voter account streaming from a home device in Los Angeles.', evidence: ['NAGRA NexGuard detection report', 'Indee playback log (session-bound watermark)', 'Irdeto piracy intelligence (stale feed)'], recommended: 'Revoke the voter account, notify Laura Kim (Awards) and send a takedown via MarkMonitor.' },
    { sev: 'high', title: 'Lodestar plates copied to an ILM NAS without an agent', asset: 'Lodestar – VFX plates batch 58 (ILM)', actor: 'ILM project share', org: 'Industrial Light & Magic', machine: 'ILM-NAS-SF07', action: 'Copy outside custody', destination: 'Vendor NAS (no agent)', tenantId: 'post', age: 210, detail: 'Two copies of batch 58 appeared on a vendor NAS without custody agent coverage; hashes match the delivered EXR sequence.', evidence: ['Hash match from vendor attestation scan', 'No agent heartbeat from ILM-NAS-SF07', 'Aspera transfer receipt'], recommended: 'Require the agent on the NAS before batch 59; revoke the supplier grant if unresolved in 48 h.' },
    { sev: 'high', title: 'Lodestar teaser opened on an unregistered device', asset: 'Lodestar – teaser trailer (embargoed)', actor: 'Contractor at Silverline Trailer Co.', org: 'Silverline Trailer Co.', machine: 'Unregistered MacBook (no agent)', action: 'Review link opened', destination: 'Unknown device', tenantId: 'corp', age: 330, detail: 'A Frame.io review link for the embargoed teaser was opened from a device with no custody agent, from an IP outside Silverline\'s registered ranges.', evidence: ['Frame.io review-link telemetry', 'Device fingerprint not in vendor register'], recommended: 'Expire the review link and re-issue to named users only.' },
    { sev: 'high', title: 'Hollow Coast S3 scripts at a dubbing vendor without an agent', asset: 'The Hollow Coast S3 – scripts 1–4', actor: 'Bluebird project share', org: 'Bluebird Dubbing Studios', machine: 'BB-NAS-MAD02', action: 'Copy outside custody', destination: 'Vendor NAS (no agent)', tenantId: 'play', age: 470, detail: 'Scripts 1–4 were copied to a Madrid NAS that is not covered by the custody agent; hashes match the localisation release.', evidence: ['Hash match from vendor attestation scan', 'No agent heartbeat from BB-NAS-MAD02'], recommended: 'Require agent install before next delivery; Emma Fairbairn to confirm the dubbing scope.' },
    { sev: 'high', title: 'Hollow Coast S3E01 final mix downloaded by an unknown device', asset: 'The Hollow Coast S3E01 – final mix', actor: 'Iyuno account (shared)', org: 'Iyuno', machine: 'Unknown device (no agent)', action: 'Download', destination: 'Unknown device', tenantId: 'play', age: 560, detail: 'The 5.1 printmaster was downloaded through Signiant by a shared Iyuno account onto a device that has never enrolled.', evidence: ['Signiant Media Shuttle transfer log', 'Custody agent: recipient not enrolled'], recommended: 'Disable the shared account; reissue named grants.' },
    { sev: 'medium', title: 'Moxion dailies link forwarded to a personal Gmail', asset: 'The Hollow Coast S3E01 – final mix', actor: 'Production coordinator', org: 'Starfall Studios & Production', machine: 'STU-DIT-CART12', action: 'Review link forward', destination: 'Gmail address', tenantId: 'studios', age: 720, detail: 'A dailies link was forwarded to a personal Gmail; the stream was blocked at first play.', evidence: ['Moxion link telemetry (degraded sync)', 'Google Workspace sharing audit'], recommended: 'Confirm with production; no further action if the recipient is verified.' },
    { sev: 'medium', title: 'Skyward Kids 2 animatic copied to USB in Vancouver', asset: 'Skyward Kids 2 – animatic reel', actor: 'Storyboard artist (contract)', org: 'Northlight Pixel (Vancouver)', machine: 'NLP-WS-033', action: 'USB copy', destination: 'Unmanaged USB', tenantId: 'post', age: 980, detail: 'Animatic reel copied to a USB stick at the vendor; the agent recorded the write and bound the watermark.', evidence: ['Custody agent USB event'], recommended: 'Recover the stick; remind the vendor of the MPA removable-media control.' },
    { sev: 'medium', title: 'Nightglass IMF master pulled outside the delivery window', asset: 'Nightglass – IMF master (Dolby Vision)', actor: 'Deluxe delivery service account', org: 'Deluxe', machine: 'DLX-XFER-07', action: 'Accelerated transfer', destination: 'Deluxe', tenantId: 'play', age: 1180, detail: '3.4 TB pulled four days before the booked delivery window for international licensees.', evidence: ['Aspera transfer log', 'Delivery schedule (MAM)'], recommended: 'Confirm with Deluxe; tighten the grant window.' },
    { sev: 'medium', title: 'Key art exported without a forensic watermark', asset: 'Lodestar – teaser trailer (embargoed)', actor: 'Marketing designer', org: 'Starfall Consumer Products & Corporate', machine: 'SFE-MKT-WS21', action: 'Export', destination: 'Local disk', tenantId: 'corp', age: 1500, detail: 'Teaser stills were exported through a plug-in that bypasses the watermark policy.', evidence: ['Custody agent export event', 'Watermark policy check failed'], recommended: 'Re-export through the approved pipeline; block the plug-in.' },
    { sev: 'medium', title: 'FYC screener streamed from a new country', asset: 'Crown of Ash – awards screener (FYC)', actor: 'Awards screener account', org: 'Indee', machine: 'Screener portal', action: 'Stream', destination: 'Screener portal', tenantId: 'studios', age: 1900, detail: 'Screener streamed from Jakarta; the voter has no travel record and two concurrent sessions.', evidence: ['Indee playback log', 'Concurrent-session check'], recommended: 'Step-up verification on next play.' },
    { sev: 'low', title: 'Custody agent silent at Weta FX for 24 h', asset: 'Skyward Kids 2 – animatic reel', actor: 'Agent heartbeat', org: 'Weta FX', machine: 'WETA-WS-118', action: 'Heartbeat gap', destination: '—', tenantId: 'post', age: 1440, detail: 'No heartbeat from one workstation holding 22 shots; copies cannot be verified while it is silent.', evidence: ['Agent heartbeat log'], recommended: 'Ask Weta to restore the agent; hold new deliveries.' },
    { sev: 'low', title: 'Expired grant used by a Company 3 colour session (blocked)', asset: 'Crown of Ash – locked cut v22', actor: 'Company 3 colourist', org: 'Company 3', machine: 'C3-BASELIGHT-05', action: 'Open file', destination: '—', tenantId: 'post', age: 2300, detail: 'Session tried to open the locked cut 90 min after the grant expired; the agent blocked it.', evidence: ['Custody agent policy decision'], recommended: 'None; working as intended.' },
    { sev: 'low', title: 'Script library export from an unusual location', asset: 'The Hollow Coast S3 – scripts 1–4', actor: 'Writers\' room assistant', org: 'Starfall Studios & Production', machine: 'SFE-SCRIPT-VAULT', action: 'Download', destination: 'Managed laptop', tenantId: 'studios', age: 2800, detail: 'Scripts downloaded from the script vault from a hotel network in Toronto; the device is managed and watermarked.', evidence: ['Script vault audit', 'Zscaler location'], recommended: 'Confirm travel with the showrunner\'s office.' },
  ],
};

export function custodyAnomalies(c: CustomerProfile, tenantId: string): CustodyAnomaly[] {
  const n = headlines(c, tenantId).custody.anomalies;
  const r = rng(`custody-anom-${c.id}-${tenantId}`);
  const seeds = forCustomer(ANOMALIES, c);
  // Scoped: the tenant's own anomalies first, then (if the headline needs more) lower-severity
  // generic ones re-homed to the tenant, so a tenant never inherits another's flagship incident.
  const rank: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const ordered = tenantId === 'all'
    ? seeds
    : [...seeds.filter((s) => s.tenantId === tenantId), ...seeds.filter((s) => s.tenantId !== tenantId).sort((a, b) => rank[a.sev] - rank[b.sev]).map((s) => ({ ...s, tenantId }))];
  return ordered.slice(0, n).map((s) => ({ ...s, id: `CUS-${r.int(10000, 99999)}`, ageMin: s.age }));
}

/* ------------------------------------------------------------------ */
/* Events over time and transfer acceleration                          */
/* ------------------------------------------------------------------ */

export function custodyEvents(c: CustomerProfile, tenantId: string, days: number): { buckets: number; hourly: boolean; transfers: number[]; blocked: number[]; anomalies: number[] } {
  const h = headlines(c, tenantId).custody;
  const r = rng(`custody-events-${c.id}-${tenantId}-${days}`);
  const hourly = days === 1;
  const buckets = hourly ? 24 : days;
  const perBucket = (h.transfers7d / 7) / (hourly ? 24 : 1);
  const transfers: number[] = [];
  const blocked: number[] = [];
  const anomalies: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const diurnal = hourly ? 0.35 + Math.sin(((i - 6) / 24) * Math.PI * 2) * 0.5 + 0.5 : 1;
    const weekly = !hourly && (i % 7 === 5 || i % 7 === 6) ? 0.55 : 1;
    transfers.push(Math.max(0, Math.round(perBucket * diurnal * weekly * r.float(0.75, 1.25, 2))));
    blocked.push(Math.max(0, Math.round(perBucket * 0.03 * diurnal * r.float(0.3, 1.8, 2))));
    anomalies.push(r.chance(hourly ? 0.12 : 0.35) ? r.int(1, 2) : 0);
  }
  return { buckets, hourly, transfers, blocked, anomalies };
}

export interface AccelStats { throughputGbps: number; acceleratedPct: number; largest: string; median: string; saved: string; note: string }

type Rng = ReturnType<typeof rng>;
const ACCEL: CustomerMap<(r: Rng) => AccelStats> = {
  media: (r) => ({ throughputGbps: r.float(3.2, 4.4, 1), acceleratedPct: r.int(82, 91), largest: `${r.float(3.1, 4.6, 1)} TB`, median: `${r.int(6, 11)} min`, saved: `${r.int(1100, 1600)} h`, note: 'UDP-based acceleration with per-recipient watermarking and agent hand-off at both ends' }),
  maritime: (r) => ({ throughputGbps: r.float(0.04, 0.09, 2), acceleratedPct: r.int(91, 97), largest: `${r.int(2, 4)}.${r.int(1, 9)} GB`, median: `${r.int(12, 24)} min`, saved: `${r.int(82, 94)}% satellite bandwidth`, note: 'Delta sync and resumable store-and-forward over VSAT / LEO; packages verified against OEM-signed hashes on board' }),
  healthcare: (r) => ({ throughputGbps: r.float(1.1, 2.4, 1), acceleratedPct: r.int(61, 74), largest: `${r.int(2, 6)}.${r.int(1, 9)} TB`, median: `${r.int(3, 9)} min`, saved: `${r.int(300, 520)} h`, note: 'Genomics cohorts and DICOM studies move accelerated into the research enclave and to reading partners; every copy re-hashed and watermarked per recipient' }),
  automotive: (r) => ({ throughputGbps: r.float(2.2, 3.6, 1), acceleratedPct: r.int(70, 84), largest: `${r.int(1, 3)}.${r.int(1, 9)} TB`, median: `${r.int(2, 7)} min`, saved: `${r.int(600, 980)} h`, note: 'CAD exports to suppliers and signed OTA builds move accelerated; OTA packages are hash-verified against the signed build at every hop (UNECE R156)' }),
  finserv: (r) => ({ throughputGbps: r.float(0.6, 1.2, 1), acceleratedPct: r.int(34, 48), largest: `${r.int(6, 14)}.${r.int(1, 9)} GB`, median: `${r.int(20, 50)} s`, saved: `${r.int(140, 260)} h`, note: 'Most custody events are views and small documents; acceleration is used for data-room bulk loads and regulatory packs' }),
  insurance: (r) => ({ throughputGbps: r.float(0.5, 1.1, 1), acceleratedPct: r.int(38, 52), largest: `${r.int(18, 46)}.${r.int(1, 9)} GB`, median: `${r.int(25, 70)} s`, saved: `${r.int(160, 280)} h`, note: 'Claim files reach EXL through the Island browser and defence counsel as litigation-hold productions; bordereaux and cat-model outputs go to reinsurers as accelerated, per-recipient watermarked packages' }),
  defence: (r) => ({ throughputGbps: r.float(0.4, 0.9, 1), acceleratedPct: r.int(44, 58), largest: `${r.int(60, 240)} GB`, median: `${r.int(1, 4)} min`, saved: `${r.int(120, 220)} h`, note: 'TDPs and drawing sets leave the GCC High enclave only through PreVeil or Exostar with FIPS-validated encryption; range data moves accelerated into AWS GovCloud and every copy keeps its CUI marking' }),
  pharma: (r) => ({ throughputGbps: r.float(1.4, 2.6, 1), acceleratedPct: r.int(64, 78), largest: `${r.int(1, 4)}.${r.int(1, 9)} TB`, median: `${r.int(2, 8)} min`, saved: `${r.int(420, 760)} h`, note: 'SDTM/ADaM datasets, eTMF exports and tech-transfer packs move accelerated to CROs and CDMOs; eCTD sequences are hash-checked against the QA sign-off manifest before any gateway submission (Part 11 / Annex 11)' }),
  sghospital: (r) => ({ throughputGbps: r.float(0.6, 1.4, 1), acceleratedPct: r.int(48, 62), largest: `${r.int(80, 640)} GB`, median: `${r.int(1, 5)} min`, saved: `${r.int(90, 180)} h`, note: 'NEHR batches go to Synapxe over HealthConnect and DICOM studies to reading partners; patient data stays in the Singapore data planes and every outbound copy is hashed and watermarked per recipient (HIA data security)' }),
  studio: (r) => ({ throughputGbps: r.float(4.6, 6.8, 1), acceleratedPct: r.int(86, 94), largest: `${r.float(4.2, 7.9, 1)} TB`, median: `${r.int(5, 12)} min`, saved: `${r.int(2100, 3200)} h`, note: 'Aspera and Signiant move plates, mixes and IMF masters to VFX, dubbing and delivery vendors with per-recipient NexGuard watermarking; screeners stream session-watermarked through Indee' }),
};

export function accelStats(c: CustomerProfile, tenantId: string): AccelStats {
  return forCustomer(ACCEL, c)(rng(`custody-accel-${c.id}-${tenantId}`));
}

/* ------------------------------------------------------------------ */
/* Chain of evidence                                                   */
/* ------------------------------------------------------------------ */

export interface LineageLink {
  seq: number;
  minAgo: number;
  org: string;
  user: string;
  machine: string;
  action: string;
  sha256: string;
  transformed: boolean;
  signature: string;
  watermark: string;
  flag?: string;
}

export interface CustodyAsset {
  id: string;
  name: string;
  project: string;
  classification: string;
  sizeLabel: string;
  holders: number;
  copies: number;
  integrity: 'verified' | 'flagged';
  lineage: LineageLink[];
}

type Step = [string, string, string, string, boolean]; // org, user, machine, action, transforms content

const STEPS: CustomerMap<Step[]> = {
  healthcare: [
    ['Mercy Ridge Research Institute', 'Dr. Omar Haddad', 'RES-GENOMICS-HPC', 'Check-in to custody vault (master)', false],
    ['Mercy Ridge Research Institute', 'Honest broker', 'RES-DEID-01', 'De-identified and re-hashed', true],
    ['Mercy Ridge Research Institute', 'IRB office', 'RES-IRB-WS02', 'Release approved (IRB)', false],
    ['Medidata Rave (sponsor)', 'Sponsor data manager', 'EDC portal', 'Secure share · received', false],
    ['Mercy Ridge Medical Center', 'Ben Carter', 'MRH-PACS-01', 'DICOM export (anonymised)', true],
    ['Second Opinion Radiology Group', 'Reading radiologist', 'SORG-PACS-GW', 'DICOM transfer · received', false],
    ['Synapse Pathology Labs', 'Lab informatics', 'SYN-LIS-02', 'Secure share · received', false],
  ],
  automotive: [
    ['Vireo Group IT & R&D', 'Marco Bianchi', 'VMG-PLM-TC01', 'Check-in to Teamcenter vault (master)', false],
    ['Vireo Group IT & R&D', 'Design review board', 'VMG-DSN-WALL01', 'Design freeze approved', true],
    ['AutoVision Design Studio', 'Visualisation lead', 'AV-RENDER-03', 'Accelerated transfer · received', false],
    ['AutoVision Design Studio', 'Visualisation lead', 'AV-RENDER-03', 'Renders delivered (derivative)', true],
    ['Bosch Mobility', 'ECU integration team', 'BOSCH-SFX-01', 'Supplier portal exchange · received', false],
    ['Vireo Connect', 'Tobias Krämer', 'VMG-OTA-SIGN01', 'Signed release (R156 integrity)', true],
    ['Continental Automotive', 'TCU release engineering', 'CONTI-BUILD-02', 'Supplier build exchange · received', false],
  ],
  media: [
    ['Kestrel Studios', 'Leo Martinez', 'POST-AVID-NEXIS01', 'Check-in to custody vault (master)', false],
    ['Kestrel Post & VFX', 'Ravi Kapoor', 'POST-BASELIGHT-02', 'Check-out to grade', false],
    ['Kestrel Post & VFX', 'Ravi Kapoor', 'POST-BASELIGHT-02', 'Check-in (graded)', true],
    ['Northgate Sound', 'Mix engineer', 'NG-PT-04', 'Accelerated transfer · received', false],
    ['Kestrel Post & VFX', 'Oliver Grant', 'POST-AVID-NEXIS01', 'Check-in (final mix married)', true],
    ['Cinesite Review Cloud', 'Review service', 'Review platform', 'Watermarked review stream', false],
    ['Red Fern Localisation', 'Sara Lindqvist (coord.)', 'RF-XFER-01', 'Accelerated transfer · subtitle master', false],
    ['Deluxe Distribution', 'Delivery service', 'DLX-XFER-03', 'Accelerated transfer · mastering', false],
  ],
  maritime: [
    ['Kongsberg Maritime', 'OEM release engineering', 'KM-SIGN-01', 'Signed build published', false],
    ['Group HQ & Shared Services', 'Rahul Menon', 'HPS-JUMP-OT01', 'Received and hash-verified (OEM signature)', false],
    ['Group HQ & Shared Services', 'Fleet IT', 'HPS-CUSTODY-GW', 'Approved for fleet distribution', false],
    ['Halcyon Line Fleet', 'Vessel edge collector', 'HCY-AUR-EDGE', 'Store & forward over LEO · received', false],
    ['Halcyon Line Fleet', 'Chief Eng. Arjun Patel', 'HCY-AUR-ENG-WS', 'Integrity check before install', false],
    ['Halcyon Line Fleet', 'Chief Eng. Arjun Patel', 'HCY-AUR-ENG-WS', 'Installed under change ticket', false],
    ['Bureau Veritas Marine', 'Class surveyor', 'BV portal', 'Evidence pack shared for survey', false],
  ],
  finserv: [
    ['Aldersgate Bank UK plc', 'Company Secretariat', 'ALD-WS-0101', 'Check-in to custody vault', false],
    ['Aldersgate Bank UK plc', 'Catherine Ashworth', 'ALD-LT-CISO', 'Review and annotate', true],
    ['Aldersgate Bank UK plc', 'Company Secretariat', 'ALD-WS-0101', 'Final version locked', true],
    ['Blackfriars Board Portal', 'Portal service', 'Board portal', 'Published to board portal (per-reader watermark)', false],
    ['Holloway & Pryce LLP', 'Partner, Corporate', 'HP-LT-221', 'Data-room view', false],
    ['Aldersgate Bank UK plc', 'Priya Natarajan', 'ALD-LT-OPRES', 'Download to managed device', false],
    ['PRA / CSSF portals', 'Regulator gateway', 'Gateway', 'Regulator gateway upload', false],
  ],
  insurance: [
    ['Kingsbridge Claims Services LLC', 'Steven Park', 'KMI-CC-INT02', 'Check-in to custody vault (ClaimCenter export)', false],
    ['Kingsbridge Claims Services LLC', 'Carlos Ramirez', 'KMI-SIU-FS01', 'PII minimised and re-hashed (SIU redaction)', true],
    ['Kingsbridge Mutual Group Services', 'Hannah Moretti', 'KMI-LT-GC01', 'Release approved (Legal, litigation hold checked)', false],
    ['EXL', 'Claims processor', 'EXL-VDI-PUN-0412', 'Secure share via Island browser · received', false],
    ['Kingsbridge Mutual Group Services', 'Brian McAllister', 'KMI-LT-RE04', 'Bordereaux compiled (derivative)', true],
    ['Munich Re', 'Treaty underwriter', 'MR-UW-PORTAL', 'Submission upload · received', false],
    ['Swiss Re', 'Treaty underwriter', 'SRE-UW-GW', 'Submission upload · received', false],
  ],
  defence: [
    ['Engineering & Design (CAD/PLM)', 'Brian Nguyen', 'SPD-TC-PRD01', 'Check-in to Teamcenter ITAR vault (master)', false],
    ['Programs CUI Enclave (GCC High)', 'Carla Jennings', 'SPD-FS-CUI01', 'Export authorisation recorded (Empowered Official)', false],
    ['Programs CUI Enclave (GCC High)', 'Erin Kowalski', 'SPD-FS-CUI01', 'TDP packaged and CUI-marked (derivative)', true],
    ['Lockheed Martin', 'Supplier quality engineer', 'Exostar MAG', 'PreVeil encrypted share · received', false],
    ['Cumberland Precision Machining', 'CAM programmer', 'CPM-CAM-GW', 'Exostar partner exchange · received', false],
    ['Precision Manufacturing (Building 3)', 'Jamal Henderson', 'B3-DNC-SRV01', 'CNC programme released to DNC (derivative)', true],
    ['Valley Anodize & Finishing', 'Finishing planner', 'VAF-SHOP-PC02', 'Masking drawings · received', false],
  ],
  pharma: [
    ['Rhenara Global Clinical Operations', 'Emily Walsh', 'DUB-CTMS-INT01', 'Check-in to custody vault (Part 11 master)', false],
    ['Rhenara Global Clinical Operations', 'Dr. Priya Raman', 'DUB-CTMS-INT01', 'Database lock approved (e-signature)', false],
    ['IQVIA', 'Lead biostatistician', 'IQV-SAS-GRID04', 'Accelerated transfer (SDTM) · received', false],
    ['IQVIA', 'Lead biostatistician', 'IQV-SAS-GRID04', 'Analysis datasets delivered (ADaM, derivative)', true],
    ['Rhenara Group Functions', 'Regulatory affairs', 'RHN-VEEVA-BRIDGE', 'eCTD sequence compiled and QA-signed (derivative)', true],
    ['Kessler Regulatory Publishing', 'Publishing lead', 'KRP-PUB-03', 'Accelerated transfer · received', false],
    ['FDA / EMA / Swissmedic gateways', 'Submission gateway', 'ESG · IRIS · eGov', 'Gateway submission · acknowledged', false],
  ],
  sghospital: [
    ['Orchid Bay Hospital (Novena campus)', 'Benjamin Goh', 'OBH-TRAK-DB01', 'Check-in to custody vault (TrakCare extract)', false],
    ['Orchid Bay Diagnostics (Laboratory & Imaging)', 'Weijie Ho', 'OBH-PACS-01', 'DICOM export (identifiers pseudonymised)', true],
    ['Orchid Bay Hospital (Novena campus)', 'Medical Records Office', 'OBH-MRO-WS02', 'Release approved (patient consent on file)', false],
    ['Harbourview Teleradiology', 'Reading radiologist', 'HBV-PACS-GW', 'DICOM transfer · received', false],
    ['Synapxe', 'HealthConnect gateway', 'NEHR gateway', 'NEHR batch upload · acknowledged', false],
    ['Orchid Bay Corporate & Shared Services', 'Billing operations', 'OBH-BIL-WS07', 'Claims export compiled (derivative)', true],
    ['Great Eastern Life', 'Claims operations', 'GE-SFTP-01', 'SFTP drop · received', false],
  ],
  studio: [
    ['Starfall Studios & Production', 'Ryan Castillo', 'STU-AVID-BAY14', 'Check-in to pre-release vault (master)', false],
    ['Starfall Post & VFX', 'Ben Hollis', 'POST-NEXIS-LDN01', 'Check-out to conform', false],
    ['Industrial Light & Magic', 'Comp supervisor', 'ILM-RENDER-SF02', 'Aspera transfer · received', false],
    ['Industrial Light & Magic', 'Comp supervisor', 'ILM-RENDER-SF02', 'Final comps delivered (derivative)', true],
    ['Company 3', 'Senior colourist', 'C3-BASELIGHT-05', 'Graded master (derivative)', true],
    ['Indee', 'Screener service', 'Screener platform', 'Session-watermarked screener stream', false],
    ['Iyuno', 'Localisation coordinator', 'IYU-XFER-02', 'Signiant transfer · subtitle master', false],
    ['Deluxe', 'Delivery service', 'DLX-XFER-07', 'Accelerated transfer · IMF mastering', false],
  ],
};

const CLASS: CustomerMap<string[]> = {
  healthcare: ['PHI · Restricted', 'De-identified research data', 'Confidential (board & legal)'],
  automotive: ['Secret (pre-launch)', 'Strictly confidential (TISAX very high)', 'Confidential (supplier IP)'],
  media: ['Pre-release · Restricted', 'Pre-release · Highly restricted', 'Embargoed marketing'],
  maritime: ['Safety-critical software (E27)', 'Operational · Restricted', 'Regulatory'],
  finserv: ['Board confidential', 'Strictly confidential (inside information)', 'Regulatory · Restricted'],
  insurance: ['Policyholder NPI · Restricted (GLBA)', 'Kingsbridge Confidential (board & actuarial)', 'Privileged · litigation hold'],
  defence: ['CUI//SP-EXPT (ITAR)', 'CUI//SP-CTI', 'CUI (Basic) · proposal-sensitive'],
  pharma: ['GxP record · Part 11', 'Blinded / unblinded trial data', 'Strictly confidential (process IP)', 'Market-sensitive (embargo)'],
  sghospital: ['Patient Confidential (HIA)', 'Pseudonymised research data', 'Restricted (board & regulator)'],
  studio: ['Pre-release · Highly restricted', 'Pre-release · Restricted', 'Embargoed marketing', 'Awards screener (FYC)'],
};
const PROJECT_OF: CustomerMap<(name: string) => string> = {
  healthcare: (n) => (n.includes('Genomics') ? 'Genomics cohort GX-2026' : n.includes('Oncology') || n.includes('IRB') ? 'Oncology trial MR-ONC-14' : n.includes('Imaging') ? 'Imaging studies (second opinion)' : n.includes('Clarity') || n.includes('Payer') ? 'Clinical exports (Epic Clarity)' : 'Board & OCR evidence packs'),
  automotive: (n) => (n.includes('Lumen') || n.includes('Prototype') ? 'Project Lumen design' : n.includes('OTA') ? 'OTA packages (R156)' : n.includes('Homologation') || n.includes('Press') ? 'Homologation & launch' : 'Engineering IP for suppliers'),
  media: (n) => (n.includes('Nightjar') ? 'Project Nightjar' : n.includes('Long Tide') ? 'The Long Tide S2' : n.includes('Ember') ? 'Ember Run' : n.includes('Salt') ? 'Salt & Iron' : 'Glasshouse'),
  maritime: (n) => (n.includes('ENC') ? 'ECDIS ENC updates' : n.includes('firmware') || n.includes('PLC logic') ? 'Vessel automation firmware' : n.includes('Crane') ? 'Crane PLC programmes' : n.includes('Stowage') || n.includes('manifest') ? 'Stowage & DG manifests' : 'Class & PSC documents'),
  finserv: (n) => (n.includes('Board') || n.includes('Annual') ? 'Board papers' : n.includes('Kestrel') ? 'Project Kestrel data room' : n.includes('Wealth') ? 'Wealth client exports' : n.includes('Research') ? 'Research pre-publication' : 'Regulatory submissions'),
  insurance: (n) => (n.includes('Claims') ? 'Claims files & policyholder data' : n.includes('reinsurance') ? 'Reinsurance renewal 2027' : n.includes('Harbourlight') ? 'Project Harbourlight data room' : n.includes('reserve') || n.includes('cat model') ? 'Actuarial & cat modelling' : 'Board, ORSA & regulatory filings'),
  defence: (n) => (n.includes('TDP') || n.includes('First article') ? 'Guidance housing TDPs (ITAR)' : n.includes('gimbal') ? 'Seeker gimbal programme' : n.includes('Flight software') ? 'Flight software releases' : n.includes('test') ? 'Qualification & test data' : 'CMMC & proposal volumes'),
  pharma: (n) => (n.includes('RHN-4471') ? 'Trial RHN-4471 (Phase III)' : n.includes('eTMF') ? 'Study RHN-3810 eTMF' : n.includes('eCTD') || n.includes('MAA') ? 'Regulatory submissions (eCTD)' : n.includes('tech-transfer') ? 'Process IP & tech transfer' : 'Publications & business development'),
  sghospital: (n) => (n.includes('NEHR') || n.includes('HIA') ? 'NEHR & HIA submissions' : n.includes('Insurer') ? 'Insurer claims exports' : n.includes('Imaging') ? 'Imaging studies (second opinion)' : n.includes('dataset') ? 'Research datasets' : 'Board & PDPC evidence packs'),
  studio: (n) => (n.includes('Crown of Ash') ? 'Crown of Ash' : n.includes('Hollow Coast') ? 'The Hollow Coast S3' : n.includes('Lodestar') ? 'Lodestar' : n.includes('Skyward') ? 'Skyward Kids 2' : 'Nightglass'),
};

const HASH_FLAG: CustomerMap<string> = {
  maritime: 'Hash does not match the OEM-signed build: install held',
  finserv: 'Hash does not match the locked version: publication held',
  media: 'Hash does not match the delivered master: delivery held',
  healthcare: 'Hash does not match the released dataset: share held',
  automotive: 'Hash does not match the signed build: release held (R156)',
  insurance: 'Hash does not match the approved filing: submission held',
  defence: 'Hash does not match the released TDP revision: transfer held',
  pharma: 'Hash does not match the QA-signed eCTD manifest: gateway submission held',
  sghospital: 'Hash does not match the released extract: transfer held',
  studio: 'Hash does not match the delivered master: delivery held',
};
const SIZE: CustomerMap<(r: Rng) => string> = {
  media: (r) => `${r.float(0.4, 4.2, 1)} ${r.chance(0.5) ? 'TB' : 'GB'}`,
  maritime: (r) => `${r.int(40, 2900)} MB`,
  healthcare: (r) => `${r.float(0.3, 24, 1)} GB`,
  automotive: (r) => `${r.float(0.2, 9.5, 1)} GB`,
  finserv: (r) => `${r.int(2, 480)} MB`,
  insurance: (r) => `${r.int(4, 900)} MB`,
  defence: (r) => `${r.float(0.1, 6.4, 1)} GB`,
  pharma: (r) => `${r.float(0.4, 38, 1)} GB`,
  sghospital: (r) => `${r.float(0.2, 18, 1)} GB`,
  studio: (r) => `${r.float(0.3, 6.8, 1)} ${r.chance(0.55) ? 'TB' : 'GB'}`,
};

export function custodyAssets(c: CustomerProfile, tenantId: string): CustodyAsset[] {
  const tenantKey = tenantId === 'all' ? c.tenants[0].id : tenantId;
  const anomalies = forCustomer(ANOMALIES, c);
  return c.vocab.custodyItems.map((name, ai) => {
    const r = rng(`custody-asset-${c.id}-${name}`);
    const steps = forCustomer(STEPS, c);
    const n = Math.min(steps.length, r.int(5, steps.length));
    const chosen = steps.slice(0, n);
    let hash = sha(r);
    let t = r.int(4000, 26000);
    const keyId = `hc-${tenantKey}-${r.hex(6)}`;
    const lineage: LineageLink[] = chosen.map((s, i) => {
      if (s[4]) hash = sha(r);
      t = Math.max(30, t - r.int(200, 3600));
      return {
        seq: i + 1, minAgo: t, org: s[0], user: s[1], machine: s[2], action: s[3], sha256: hash, transformed: s[4] && i > 0,
        signature: `Ed25519 · ${keyId} · ${r.hex(16)}`,
        watermark: c.dataKey === 'maritime' ? `PKG-${r.hex(4).toUpperCase()}-${r.hex(4).toUpperCase()}` : `WM-${r.hex(4).toUpperCase()}-${r.hex(4).toUpperCase()}`,
      };
    });
    const an = anomalies.find((a) => a.asset === name);
    if (an) {
      const last = lineage[lineage.length - 1];
      lineage.push({
        seq: lineage.length + 1, minAgo: an.age, org: an.org, user: an.actor, machine: an.machine, action: an.action, sha256: an.title.includes('hash') ? sha(r) : last.sha256, transformed: false,
        signature: `Ed25519 · ${keyId} · ${r.hex(16)}`, watermark: last.watermark.replace(/.{4}$/, r.hex(4).toUpperCase()),
        flag: an.title.includes('hash') ? forCustomer(HASH_FLAG, c) : `Unsanctioned hand-off: ${an.destination}`,
      });
    }
    return {
      id: `CA-${c.vocab.hostPrefix}-${String(ai + 1).padStart(3, '0')}`,
      name,
      project: forCustomer(PROJECT_OF, c)(name),
      classification: r.pick(forCustomer(CLASS, c)),
      sizeLabel: forCustomer(SIZE, c)(r),
      holders: new Set(lineage.map((l) => l.org)).size,
      copies: lineage.length + r.int(0, 4),
      integrity: an ? 'flagged' : 'verified',
      lineage,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Grants and revocations                                              */
/* ------------------------------------------------------------------ */

export type GrantScope = 'supplier' | 'user' | 'session';
export interface Grant {
  id: string;
  scope: GrantScope;
  target: string;
  detail: string;
  asset: string;
  grantedBy: string;
  expiresInHours: number;
  ageHours: number;
  uses: number;
  risk: 'medium' | 'high';
}

export interface Revocation {
  id: string;
  scope: GrantScope;
  target: string;
  asset: string;
  reason: string;
  by: string;
  approvers: string[];
  daysAgo: number;
  propagationSec: number;
  note?: string;
}

const REASONS: CustomerMap<string[]> = {
  healthcare: ['Study closed', 'Second opinion delivered', 'Researcher left', 'Unsanctioned copy detected', 'BAA lapsed', 'Device lost or stolen'],
  automotive: ['Design review concluded', 'Sourcing round closed', 'Unsanctioned copy detected', 'Supplier contract ended', 'Leaver', 'TISAX label expired'],
  media: ['Unsanctioned copy detected', 'Vendor delivery complete', 'Freelancer contract ended', 'Review window closed', 'Device lost or stolen', 'Leak investigation hold', 'TPN assessment lapsed'],
  maritime: ['Vessel crew change', 'OEM maintenance complete', 'Hash mismatch quarantine', 'Supplier contract ended', 'Device lost or stolen'],
  finserv: ['Deal team change', 'Board meeting concluded', 'Adviser mandate ended', 'Information barrier breach', 'Leaver', 'Device lost or stolen'],
  insurance: ['Claim closed', 'Litigation hold released', 'TPA processor offboarded', 'Treaty placement concluded', 'Unsanctioned copy detected', 'Leaver', 'Device lost or stolen'],
  defence: ['Purchase order closed', 'TDP revision superseded', 'Sub-tier CMMC status lapsed', 'Non-US person access attempt', 'Unsanctioned copy detected', 'Proposal submitted', 'Leaver'],
  pharma: ['Database lock reached', 'CRO contract ended', 'Unblinding risk', 'Tech transfer complete', 'Unsanctioned copy detected', 'Leaver (resignation)', 'Data-room access window closed'],
  sghospital: ['Second opinion delivered', 'Patient consent withdrawn', 'Study closed', 'Insurer claim settled', 'Unsanctioned copy detected', 'Device lost or stolen'],
  studio: ['Unsanctioned copy detected', 'Vendor delivery complete', 'Freelancer contract ended', 'Awards voting closed', 'NexGuard leak trace', 'Review window closed', 'TPN assessment lapsed', 'Device lost or stolen'],
};

const SESSION_CITIES: CustomerMap<string[]> = {
  maritime: ['Rotterdam', 'Singapore', 'Hamburg', 'Port Klang', 'Oslo'],
  finserv: ['London', 'Luxembourg', 'New York', 'Singapore', 'Edinburgh'],
  media: ['Burbank', 'London', 'Montréal', 'Madrid', 'Singapore', 'New York'],
  healthcare: ['Columbus', 'Cleveland', 'Cincinnati', 'Pittsburgh', 'Chicago'],
  automotive: ['Munich', 'Stuttgart', 'Wolfsburg', 'Salzgitter', 'Stuttgart', 'Prague'],
  insurance: ['Hartford', 'Columbus', 'Chicago', 'Charlotte', 'Pune', 'Munich', 'Zurich'],
  defence: ['Huntsville', 'Tucson', 'Fort Worth', 'Tucson', 'Huntsville'],
  pharma: ['Basel', 'Dublin', 'Cambridge, MA', 'Sierre', 'Cork', 'Incheon', 'Durham, NC'],
  sghospital: ['Singapore', 'Singapore', 'Sydney', 'Kuala Lumpur'],
  studio: ['Burbank', 'London', 'Vancouver', 'San Francisco', 'Wellington', 'Madrid', 'Seoul'],
};

function vendorNames(c: CustomerProfile): string[] {
  return vendorChain(c).map((v) => v.name);
}

export function custodyGrants(c: CustomerProfile, tenantId: string): Grant[] {
  const r = rng(`custody-grants-${c.id}-${tenantId}`);
  const h = headlines(c, tenantId).custody;
  const n = Math.max(8, Math.min(36, Math.round(h.agents / 12)));
  const vendors = vendorNames(c);
  const staff = c.people.staff.map((p) => p.name);
  const items = c.vocab.custodyItems;
  const approvers = [c.people.grcLead.name, c.people.ciso.name, c.people.admin.name];
  const out: Grant[] = [];
  for (let i = 0; i < n; i++) {
    const scope = r.weighted<GrantScope>([['supplier', 3], ['user', 4], ['session', 3]]);
    const v = r.pick(vendors.slice(0, Math.min(vendors.length, 18)));
    const asset = r.pick(items);
    const target = scope === 'supplier' ? v : scope === 'user' ? (r.chance(0.5) ? r.pick(staff) : `${r.pick(['j', 'm', 's', 'a', 'k', 'r'])}.${r.pick(['nguyen', 'patel', 'garcia', 'cohen', 'li', 'smith', 'okafor'])}@${v.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10)}.com`) : `SES-${r.hex(6).toUpperCase()} · ${r.pick(staff)}`;
    out.push({
      id: `GR-${r.int(10000, 99999)}`,
      scope,
      target,
      detail: scope === 'supplier' ? `All ${r.int(3, 40)} users and ${r.int(1, 12)} agents at ${v}` : scope === 'user' ? `${r.int(1, 6)} devices` : `${r.pick(['macOS', 'Windows 11', 'iPadOS', 'Linux workstation'])} · ${r.pick(forCustomer(SESSION_CITIES, c))}`,
      asset: scope === 'supplier' ? forCustomer(PROJECT_OF, c)(asset) : asset,
      grantedBy: r.pick(approvers),
      expiresInHours: scope === 'session' ? r.int(1, 12) : scope === 'user' ? r.int(6, 24 * 21) : r.int(24 * 3, 24 * 60),
      ageHours: r.int(1, 24 * 40),
      uses: r.int(2, scope === 'supplier' ? 900 : 120),
      risk: scope === 'supplier' ? 'high' : 'medium',
    });
  }
  // Make sure the live anomaly actors have grants to revoke.
  for (const a of custodyAnomalies(c, tenantId).filter((x) => x.sev === 'critical' || x.sev === 'high').slice(0, 2)) {
    out.unshift({
      id: `GR-${r.int(10000, 99999)}`,
      scope: a.machine.includes('no agent') || a.org === c.name ? 'session' : 'user',
      target: a.actor,
      detail: `${a.machine} · linked to ${a.id}`,
      asset: a.asset,
      grantedBy: approvers[0],
      expiresInHours: r.int(4, 72),
      ageHours: r.int(10, 200),
      uses: r.int(10, 80),
      risk: 'medium',
    });
  }
  return out;
}

export function custodyRevocations(c: CustomerProfile, tenantId: string): Revocation[] {
  const h = headlines(c, tenantId).custody;
  const r = rng(`custody-revs-${c.id}-${tenantId}`);
  const vendors = vendorNames(c);
  const staff = c.people.staff.map((p) => p.name);
  const by = [c.people.grcLead.name, c.people.socLead.name, c.people.admin.name];
  const out: Revocation[] = [];
  for (let i = 0; i < h.revocations30d; i++) {
    const scope = r.weighted<GrantScope>([['supplier', 1], ['user', 4], ['session', 5]]);
    let prop = scope === 'session' ? r.int(4, 22) : scope === 'user' ? r.int(8, 41) : r.int(19, 57);
    let note: string | undefined;
    if (c.dataKey === 'maritime' && i === 2) {
      prop = 4 * 3600 + 720;
      note = 'Vessel out of LEO coverage: revocation queued on shore and enforced by the on-board agent offline policy; confirmed on reconnect';
    } else if (i === 5 && scope !== 'session') {
      prop = r.int(61, 78);
      note = 'One vendor agent offline at the time; enforced on next heartbeat';
    }
    out.push({
      id: `RV-${r.int(10000, 99999)}`,
      scope,
      target: scope === 'supplier' ? r.pick(vendors) : scope === 'user' ? r.pick(staff) : `SES-${r.hex(6).toUpperCase()}`,
      asset: r.pick(c.vocab.custodyItems),
      reason: r.pick(forCustomer(REASONS, c)),
      by: r.pick(by),
      approvers: scope === 'supplier' ? [c.people.grcLead.name, c.people.ciso.name] : [r.pick(by)],
      daysAgo: r.float(0.1, 29.9, 1),
      propagationSec: prop,
      note,
    });
  }
  return out.sort((a, b) => b.daysAgo - a.daysAgo);
}

/* ------------------------------------------------------------------ */
/* Vendor chain                                                        */
/* ------------------------------------------------------------------ */

export type TpnStatus = 'Gold Shield' | 'Blue Shield' | 'Assessment due' | 'Not assessed';

export interface ChainVendor {
  id: string;
  name: string;
  category: string;
  country: string;
  lat: number;
  lon: number;
  tier: 1 | 2 | 3;
  rating: number;
  access: string;
  custodyScore: number;
  agentCoverage: number;
  agents: number;
  untrackedCopies: number;
  assurance: string;
  tpn?: TpnStatus;
  volumeGb30d: number;
  transfers30d: number;
  assetsHeld: number;
  users: number;
  lastTransferMin: number;
}

const EXTRA_FINSERV: ThirdParty[] = [
  { name: 'Holloway & Pryce LLP', category: 'External counsel', tier: 1, access: 'Project Kestrel data room', rating: 77, country: 'GB' },
  { name: 'Ferrier Advisory', category: 'M&A adviser', tier: 1, access: 'Project Kestrel data room', rating: 69, country: 'GB' },
  { name: 'Blackfriars Board Portal', category: 'Board portal SaaS', tier: 1, access: 'Board papers', rating: 83, country: 'GB' },
  { name: 'Kingsmere Audit LLP', category: 'External auditor', tier: 1, access: 'ICAAP, annual report drafts', rating: 81, country: 'GB' },
  { name: 'Northwind Investor Relations', category: 'Financial printer', tier: 2, access: 'Annual report pre-release', rating: 72, country: 'GB' },
  { name: 'Rhône Avocats', category: 'EU counsel', tier: 2, access: 'Regulatory submissions (CSSF)', rating: 74, country: 'LU' },
  { name: 'Stratus Translation', category: 'Regulatory translation', tier: 3, access: 'Regulatory submissions', rating: 64, country: 'DE' },
];

const SECTOR_PARTS: Partial<CustomerMap<{ a: string[]; cats: [string, string, string][]; countries: string[] }>> = {
  healthcare: {
    a: ['Buckeye', 'Scioto', 'Olentangy', 'Lakeshore', 'Heartland', 'Riverside', 'Summit', 'Keystone', 'Meridian', 'Cardinal'],
    cats: [['Radiology Partners', 'Teleradiology reading group', 'Imaging studies'], ['Clinical Research', 'Contract research organisation', 'Trial datasets'], ['Analytics', 'Quality analytics vendor', 'Clarity extracts'], ['Biobank', 'Biobank & genomics core', 'Genomic data']],
    countries: ['US', 'US', 'US', 'US', 'CA', 'GB', 'IN'],
  },
  automotive: {
    a: ['Hessler', 'Brandt', 'Lindner', 'Moravia', 'Alpen', 'Rhein', 'Danube', 'Baltic', 'Silesia', 'Neckar', 'Bavaria', 'Tatra', 'Isar', 'Main', 'Oder', 'Lechfeld', 'Vltava', 'Pannonia', 'Sierra', 'Querétaro'],
    cats: [['Engineering', 'Engineering services', 'CAD data'], ['Tooling', 'Tooling & dies', 'Tool designs'], ['Prototyping', 'Prototype build', 'Pre-launch parts data'], ['Testing', 'Homologation testing', 'Test reports'], ['Software', 'ECU software supplier', 'Software builds'], ['Design', 'Design studio', 'Renders'], ['Electronics', 'Electronics supplier', 'Schematics'], ['Interiors', 'Interior systems', 'CAD data'], ['Castings', 'Castings & forgings', 'Part drawings']],
    countries: ['DE', 'DE', 'DE', 'CZ', 'PL', 'HU', 'AT', 'IT', 'ES', 'MX', 'CN', 'KR', 'JP', 'US', 'RO', 'PT', 'FR'],
  },
};
const EXTRA_HEALTH: ThirdParty[] = [
  { name: 'Second Opinion Radiology Group', category: 'Teleradiology partner', tier: 1, access: 'Imaging studies for second opinion', rating: 73, country: 'US' },
  { name: 'Medidata (Dassault Systèmes)', category: 'Trial EDC platform', tier: 1, access: 'Oncology trial datasets', rating: 85, country: 'US' },
];

const MEDIA_PARTS = {
  a: ['Silverline', 'Bluefin', 'Northlight', 'Cobalt', 'Halftone', 'Meridian', 'Paper Moon', 'Kinetic', 'Lantern', 'Granite', 'Saltwater', 'Ironbark', 'Polaris', 'Mosaic', 'Foxglove', 'Tidewater', 'Obsidian', 'Amberline', 'Cedar', 'Hollow Pine', 'Quill', 'Vantage', 'Red Kite', 'Wildframe', 'Starling', 'Bright Harbour', 'Lumen', 'Echo Park', 'Copperhead', 'Sable'],
  cats: [
    ['VFX', 'VFX vendor', 'Plates & renders'], ['Post', 'Editorial & conform', 'Locked cuts'], ['Sound', 'Audio post', 'Stems & mixes'], ['Subtitling', 'Dubbing & subtitles', 'Locked cuts, scripts'],
    ['Colour', 'Colour grading', 'Graded masters'], ['Animation', 'Animation vendor', 'Asset library'], ['Creative', 'Marketing agency', 'Trailer cuts & key art'], ['Media Labs', 'QC & compliance', 'Masters for QC'],
    ['Studios', 'Previs & virtual production', 'Previs scenes'], ['Archive', 'Archive & preservation', 'Masters (LTO)'], ['Dubbing', 'Dubbing & subtitles', 'Scripts & stems'], ['Delivery', 'Mastering & delivery', 'IMF packages'],
  ] as [string, string, string][],
  countries: ['US', 'US', 'US', 'CA', 'CA', 'GB', 'GB', 'GB', 'IN', 'IN', 'ES', 'DE', 'FR', 'IT', 'AU', 'NZ', 'KR', 'JP', 'PL', 'MX', 'CZ', 'HU', 'SE', 'IE', 'PH', 'TH', 'BR', 'ZA', 'PT', 'CO', 'TW', 'RO'],
};

SECTOR_PARTS.defence = {
  a: ['Tennessee Valley', 'Redstone', 'Cahaba', 'Wheeler', 'Guntersville', 'Sand Mountain', 'Cullman', 'Decatur', 'Bankhead', 'Copper State', 'Sonoran', 'Saguaro', 'Pinal', 'Rocket City'],
  cats: [['Precision Machining', 'Sub-tier machine shop', 'TDP drawings (CUI)'], ['Heat Treat', 'Heat treatment', 'Process specs (CUI)'], ['NDT Labs', 'Non-destructive testing', 'Inspection reports'], ['Cable & Harness', 'Harness assembly', 'Wiring diagrams (CUI)'], ['Test Services', 'Environmental test lab', 'Test procedures'], ['Coatings', 'Coatings & plating', 'Masking drawings'], ['PCB Assembly', 'Electronics assembly', 'Board schematics (CUI)']],
  countries: ['US'],
};
SECTOR_PARTS.pharma = {
  a: ['Aare', 'Jura', 'Birs', 'Limmat', 'Emme', 'Saane', 'Ticino', 'Shannon', 'Liffey', 'Lagan', 'Charles River', 'Merrimack', 'Neckar', 'Rhône', 'Léman', 'Vistula', 'Ebro', 'Scheldt', 'Han River', 'Kallang'],
  cats: [['Clinical Sites', 'Clinical research site network', 'Trial datasets'], ['Bioanalytics', 'Central & bioanalytical lab', 'Sample results'], ['Biometrics', 'Biostatistics & programming CRO', 'Analysis datasets (SDTM/ADaM)'], ['Regulatory', 'Regulatory publishing & eCTD', 'Submission sequences'], ['Medical Writing', 'Medical writing', 'CSR drafts'], ['Translations', 'Regulatory translation', 'Labelling & SmPC'], ['Pharma Services', 'Contract manufacturing (CMO)', 'Batch records & process IP'], ['Analytical', 'Analytical testing lab', 'Methods & CoAs'], ['Imaging Core', 'Imaging core lab', 'Trial imaging'], ['Safety Services', 'Pharmacovigilance BPO', 'ICSRs & safety narratives']],
  countries: ['CH', 'CH', 'DE', 'IE', 'US', 'US', 'GB', 'IN', 'PL', 'ES', 'FR', 'BE', 'NL', 'KR', 'SG'],
};
SECTOR_PARTS.studio = {
  a: ['Bluefin', 'Cobalt', 'Halftone', 'Paper Moon', 'Kinetic', 'Lantern', 'Granite', 'Saltwater', 'Ironbark', 'Polaris', 'Mosaic', 'Foxglove', 'Tidewater', 'Obsidian', 'Amberline', 'Cedar', 'Hollow Pine', 'Quill', 'Vantage', 'Red Kite', 'Wildframe', 'Starling', 'Bright Harbour', 'Echo Park', 'Copperhead', 'Sable', 'Marquee', 'Firelight'],
  cats: [
    ['VFX', 'VFX vendor', 'Plates & renders'], ['Post', 'Editorial & conform', 'Locked cuts'], ['Sound', 'Audio post', 'Stems & mixes'], ['Subtitles', 'Subtitling & captioning', 'Scripts & timed text'],
    ['Colour', 'Colour grading', 'Graded masters'], ['Animation', 'Animation vendor', 'Animatics & asset library'], ['Creative', 'Trailer & marketing agency', 'Trailer cuts & key art'], ['Media Labs', 'QC & compliance', 'Masters for QC'],
    ['Virtual Production', 'Previs & virtual production', 'Previs scenes'], ['Dubbing', 'Dubbing & voice', 'Scripts & stems'], ['Pictures Distribution', 'Distributor / licensee', 'IMF deliverables'], ['Cinemas', 'Theatrical exhibitor', 'DCPs & KDMs'], ['Screenings', 'Festival & awards screening', 'Screeners'], ['Press', 'Publicity agency', 'Embargoed press kits'],
  ] as [string, string, string][],
  countries: ['US', 'US', 'US', 'US', 'CA', 'CA', 'GB', 'GB', 'NZ', 'AU', 'IN', 'ES', 'DE', 'FR', 'IT', 'KR', 'JP', 'MX', 'BR', 'IE', 'PL'],
};

/** Third parties in the custody chain, most custody-relevant first. */
function pickParties(c: CustomerProfile, extra: ThirdParty[], order: string[]): ThirdParty[] {
  const picked = order.map((p) => c.thirdParties.find((t) => t.name.startsWith(p))).filter((t): t is ThirdParty => !!t);
  return [...extra, ...picked];
}
const CHAIN_BASE: CustomerMap<(c: CustomerProfile) => ThirdParty[]> = {
  maritime: (c) => c.thirdParties.filter((t) => !t.name.startsWith('Atos')),
  finserv: (c) => [...EXTRA_FINSERV, ...c.thirdParties],
  healthcare: (c) => [...EXTRA_HEALTH, ...c.thirdParties],
  media: (c) => c.thirdParties,
  automotive: (c) => c.thirdParties,
  insurance: (c) => pickParties(c, [
    { name: 'Whitcombe & Shaw LLP', category: 'Coverage & litigation counsel', tier: 1, access: 'Claims files under litigation hold, Harbourlight data room', rating: 78, country: 'US' },
    { name: 'Aon Reinsurance Solutions', category: 'Reinsurance broker', tier: 1, access: 'Treaty submissions & bordereaux', rating: 82, country: 'US' },
    { name: 'Milliman', category: 'Actuarial consultant (reserve opinion)', tier: 1, access: 'Reserve study & cat-model outputs', rating: 80, country: 'US' },
    { name: 'Calloway Hart Partners', category: 'M&A adviser (Project Harbourlight)', tier: 2, access: 'Project Harbourlight data room', rating: 71, country: 'US' },
    { name: 'Diligent Boards', category: 'Board portal SaaS', tier: 1, access: 'Board packs & ORSA', rating: 84, country: 'US' },
  ], ['EXL', 'CCC', 'Munich Re', 'Swiss Re', 'Guidewire', 'Cambridge Mobile', 'Duck Creek', 'Majesco', 'Cognizant', 'One Inc', 'Broadridge', 'LexisNexis', 'Verisk']),
  defence: (c) => pickParties(c, [], ['Lockheed', 'RTX', 'Northrop', 'L3Harris', 'Cumberland', 'Valley Anodize', 'Desert Sky', 'Exostar', 'Redstone', 'Expeditors', 'Siemens', 'Haas', 'Microsoft', 'Deltek', 'Ansys']),
  pharma: (c) => {
    const [a, b, d, ...rest] = pickParties(c, [], ['IQVIA', 'Parexel', 'ICON', 'Medidata', 'Veeva', 'Lonza', 'Samsung', 'WuXi', 'Catalent', 'Accenture', 'DHL', 'Syneos', 'Körber', 'Emerson', 'Siemens']);
    return [a, b, d,
      { name: 'Kessler Regulatory Publishing', category: 'eCTD publishing vendor', tier: 1, access: 'eCTD sequences (FDA, EMA, Swissmedic)', rating: 79, country: 'DE' },
      { name: 'Alpenglow Therapeutics', category: 'In-licensing counterparty (Project Edelweiss)', tier: 2, access: 'Edelweiss data room', rating: 66, country: 'US' },
      { name: 'Aare Biometrics', category: 'Independent DMC statistician', tier: 1, access: 'Unblinded interim datasets, RHN-4471', rating: 77, country: 'CH' },
      ...rest];
  },
  sghospital: (c) => {
    const [syn, ge, aia, pru, lion, phil, iron] = pickParties(c, [], ['Synapxe', 'Great Eastern', 'AIA', 'Prudential', 'Lion City', 'Philips', 'Iron Mountain']);
    return [syn, ge, aia, pru,
      { name: 'Harbourview Teleradiology', category: 'Overseas second-opinion radiology', tier: 1, access: 'Imaging studies for second opinion', rating: 72, country: 'AU' },
      { name: 'Straits Clinical Research Partners', category: 'Contract research organisation', tier: 2, access: 'Research datasets (CR-HEART-22, ONC-SG-07)', rating: 74, country: 'SG' },
      lion, phil, iron].filter((t): t is ThirdParty => !!t);
  },
  studio: (c) => pickParties(c, [], ['Industrial Light', 'Weta', 'DNEG', 'Northlight', 'Company 3', 'Iyuno', 'Bluebird', 'Indee', 'Silverline', 'Deluxe', 'Amazon Web Services']),
};

const VOLUME: CustomerMap<(r: Rng, t: ThirdParty) => number> = {
  media: (r, t) => r.int(80, t.tier === 1 ? 42000 : 9000),
  maritime: (r) => r.int(2, 180),
  healthcare: (r, t) => r.int(5, t.tier === 1 ? 2400 : 300),
  automotive: (r, t) => r.int(20, t.tier === 1 ? 9000 : 1200),
  finserv: (r) => r.int(1, 60),
  insurance: (r, t) => r.int(2, t.tier === 1 ? 420 : 80),
  defence: (r, t) => r.int(4, t.tier === 1 ? 900 : 160),
  pharma: (r, t) => r.int(20, t.tier === 1 ? 6400 : 900),
  sghospital: (r, t) => r.int(3, t.tier === 1 ? 1600 : 200),
  studio: (r, t) => r.int(120, t.tier === 1 ? 58000 : 12000),
};
const ASSURANCE: CustomerMap<(r: Rng, t: ThirdParty) => string> = {
  media: () => 'TPN',
  automotive: (r, t) => r.weighted<string>([['TISAX AL3', t.tier === 1 ? 5 : 2], ['TISAX AL2', 3], ['TISAX assessment due', 1]]),
  healthcare: (r) => r.pick(['HITRUST r2', 'SOC 2 Type II', 'BAA + questionnaire', 'HITRUST r2']),
  finserv: (r) => r.pick(['ISO 27001', 'SOC 2 Type II', 'ISO 27001 + SOC 2', 'Questionnaire only']),
  maritime: (r) => r.pick(['ISO 27001', 'IACS E27 type approval', 'Questionnaire only', 'ISO 27001']),
  insurance: (r) => r.pick(['SOC 2 Type II', 'ISO 27001 + SOC 2', 'NYDFS 500.11 TPSP review', 'SOC 2 Type II', 'Questionnaire only']),
  defence: (r, t) => r.weighted<string>([['CMMC L2 (C3PAO certified)', t.tier === 1 ? 5 : 2], ['CMMC L2 self-assessment', 3], ['SPRS score posted, assessment due', 1.5], ['DFARS 7012 flow-down only', t.tier === 3 ? 2 : 0.5]]),
  pharma: (r, t) => r.weighted<string>([['GxP vendor audit (QA)', t.tier === 1 ? 5 : 2], ['Quality agreement + audit', 3], ['ISO 27001', 2], ['SOC 2 Type II', 1.5], ['Questionnaire only', t.tier === 3 ? 2 : 0.4]]),
  sghospital: (r) => r.pick(['CSA Cyber Trust mark', 'ISO 27001', 'HIA data-security attestation', 'CSA Cyber Essentials mark', 'PDPA DPA + questionnaire']),
  studio: () => 'TPN',
};

export function vendorChain(c: CustomerProfile): ChainVendor[] {
  const total = headlines(c).custody.vendorsInChain;
  const base: ThirdParty[] = forCustomer(CHAIN_BASE, c)(c);
  const parts = forCustomer(SECTOR_PARTS, c) ?? MEDIA_PARTS;
  const r = rng(`custody-vendors-${c.id}`);
  const list: ThirdParty[] = base.slice(0, total);
  const used = new Set(list.map((t) => t.name));
  let k = 0;
  while (list.length < total && k < 500) {
    k++;
    const a = r.pick(parts.a);
    const [suffix, category, access] = r.pick(parts.cats);
    const name = `${a} ${suffix}`;
    if (used.has(name)) continue;
    used.add(name);
    list.push({ name, category, tier: r.weighted<1 | 2 | 3>([[1, 2], [2, 5], [3, 3]]), access, rating: r.int(52, 92), country: r.pick(parts.countries) });
  }
  return list.map((t, i) => {
    const [la, lo] = COUNTRY_LL[t.country] ?? [20, 0];
    const isRedFern = t.name === 'Red Fern Localisation';
    const coverage = isRedFern ? 71 : Math.min(100, Math.max(55, Math.round(t.rating * 0.55 + r.int(40, 52))));
    const untracked = isRedFern ? 2 : coverage >= 97 ? 0 : r.weighted<number>([[0, 6], [1, 2], [2, 1], [3, 0.4]]);
    const score = Math.max(30, Math.min(99, Math.round(coverage * 0.6 + t.rating * 0.4 - untracked * 6)));
    const volume = forCustomer(VOLUME, c)(r, t);
    return {
      id: `VND-${String(i + 1).padStart(3, '0')}`,
      name: t.name,
      category: t.category,
      country: t.country,
      lat: la + r.float(-2.2, 2.2, 2),
      lon: lo + r.float(-3, 3, 2),
      tier: t.tier,
      rating: t.rating,
      access: t.access,
      custodyScore: score,
      agentCoverage: coverage,
      agents: Math.max(1, Math.round((t.tier === 1 ? r.int(6, 40) : r.int(1, 12)) * (c.dataKey === 'finserv' ? 2 : 1))),
      untrackedCopies: untracked,
      assurance: forCustomer(ASSURANCE, c)(r, t),
      tpn: c.dataKey === 'media' ? (isRedFern ? 'Assessment due' : r.weighted<TpnStatus>([['Gold Shield', t.rating > 75 ? 6 : 2], ['Blue Shield', 4], ['Assessment due', 1.5], ['Not assessed', t.tier === 3 ? 2 : 0.6]])) : undefined,
      volumeGb30d: volume,
      transfers30d: r.int(t.tier === 1 ? 60 : 8, t.tier === 1 ? 900 : 200),
      assetsHeld: r.int(t.tier === 1 ? 40 : 4, t.tier === 1 ? 900 : 160),
      users: r.int(3, t.tier === 1 ? 140 : 40),
      lastTransferMin: r.weighted<number>([[r.int(1, 90), 5], [r.int(90, 1440), 3], [r.int(1440, 20000), 1]]),
    };
  });
}

/* ================================================================== */
/* Lineage (per-asset tree of derivatives and copies across orgs)      */
/* ================================================================== */

export type LKind = 'CREATED' | 'DUPLICATE' | 'DERIVATIVE' | 'COPY' | 'TRANSFER' | 'ARCHIVE';
export type LState = 'verified' | 'broken' | 'revoked' | 'untracked';
export interface LNode {
  id: string; parent?: string; depth: number; kind: LKind; org: string; location: string; user: string; machine: string;
  minAgo: number; sha256: string; watermark: string; state: LState; leftEstate: boolean; note?: string; lastVerifiedMin: number;
}
export interface LEvent { kind: string; minAgo: number; text: string; who: string; sev?: 'critical' | 'high' | 'medium'; nodeId?: string }
export type AssetTagState = 'Verified' | 'Signature broken' | 'Left the estate' | 'Untagged';
export interface LineageView {
  asset: CustodyAsset; status: AssetTagState; nodes: LNode[]; events: LEvent[];
  projectId: string; signingKey: string; algorithm: string; originalSha: string; createdBy: string; createdMinAgo: number; orgs: number; leftEstate: number;
}

const VAULT: CustomerMap<string> = {
  maritime: 'Custody vault · fleet software',
  finserv: 'Custody vault · board & deal room',
  media: 'Custody vault · Avid NEXIS master',
  healthcare: 'Custody vault · research & imaging',
  automotive: 'Teamcenter vault · master',
  insurance: 'Custody vault · claims & board',
  defence: 'Teamcenter ITAR vault · GCC High',
  pharma: 'GxP custody vault · Part 11 master',
  sghospital: 'Custody vault · TrakCare & PACS extracts',
  studio: 'Pre-release vault · S3 Object Lock',
};
const ARCHIVE: CustomerMap<string> = {
  maritime: 'Cold archive · class evidence',
  finserv: 'Records archive (10-year retention)',
  media: 'LTO archive · Iron Mountain',
  healthcare: 'Research archive (retention 7 years)',
  automotive: 'PLM archive · homologation retention',
  insurance: 'Records archive (claim life + 10 years)',
  defence: 'CUI archive (contract close-out + 6 years)',
  pharma: 'GxP archive (25-year trial master file retention)',
  sghospital: 'Medical records archive (HIA retention)',
  studio: 'LTO archive · studio vault (Burbank)',
};

function kindOf(action: string): LKind {
  if (/received|transfer|share|exchange|upload|portal|stream/i.test(action)) return 'TRANSFER';
  return 'COPY';
}

export function lineageViews(c: CustomerProfile, tenantId: string): LineageView[] {
  const assets = custodyAssets(c, tenantId);
  return assets.map((a, ai) => {
    const r = rng(`custody-lineage-${c.id}-${a.id}`);
    const L = a.lineage;
    const first = L[0];
    const keyId = first.signature.split(' · ')[1] ?? 'hc-key';
    const createdMin = first.minAgo + r.int(30, 600);
    const nodes: LNode[] = [];
    const events: LEvent[] = [];
    const root: LNode = { id: 'n0', depth: 0, kind: 'CREATED', org: first.org, location: 'Origin', user: first.user, machine: first.machine, minAgo: createdMin, sha256: first.sha256, watermark: '—', state: 'verified', leftEstate: false, lastVerifiedMin: r.int(5, 120) };
    nodes.push(root);
    events.push({ kind: 'CREATED', minAgo: createdMin, text: `Custody tag written, signed with ${keyId}`, who: `${first.user} · ${first.machine}`, nodeId: root.id });
    const vault: LNode = { id: 'n1', parent: 'n0', depth: 1, kind: 'DUPLICATE', org: first.org, location: forCustomer(VAULT, c), user: first.user, machine: first.machine, minAgo: first.minAgo, sha256: first.sha256, watermark: first.watermark, state: 'verified', leftEstate: false, lastVerifiedMin: r.int(1, 60) };
    nodes.push(vault);
    events.push({ kind: 'DUPLICATE', minAgo: first.minAgo, text: `Checked in to ${forCustomer(VAULT, c)}`, who: `${first.user} · ${first.machine}`, nodeId: vault.id });
    let trunk = vault;
    L.slice(1).forEach((l, i) => {
      const id = `n${nodes.length}`;
      if (l.transformed) {
        const n: LNode = { id, parent: trunk.id, depth: trunk.depth + 1, kind: 'DERIVATIVE', org: l.org, location: `${l.action.replace(/ \(.*\)$/, '')}`, user: l.user, machine: l.machine, minAgo: l.minAgo, sha256: l.sha256, watermark: l.watermark, state: 'verified', leftEstate: false, lastVerifiedMin: r.int(1, 240), note: 'New content: re-hashed and re-signed' };
        nodes.push(n);
        events.push({ kind: 'DERIVATIVE', minAgo: l.minAgo, text: `${l.action} — new hash, signature chained to the parent`, who: `${l.user} · ${l.machine}`, nodeId: id });
        trunk = n;
        return;
      }
      if (l.flag) {
        const broken = /hash/i.test(l.flag);
        const n: LNode = { id, parent: trunk.id, depth: trunk.depth + 1, kind: 'COPY', org: l.org, location: `${l.action} · ${l.machine}`, user: l.user, machine: l.machine, minAgo: l.minAgo, sha256: l.sha256, watermark: l.watermark, state: broken ? 'broken' : 'untracked', leftEstate: !broken, lastVerifiedMin: l.minAgo, note: l.flag };
        nodes.push(n);
        events.push({ kind: 'VERIFY_FAILED', minAgo: l.minAgo + r.int(20, 300), text: broken ? 'Tagged hash does not match the bytes on disk' : 'Copy left the sanctioned list; watermark still bound', who: `Custody agent · ${l.machine}`, sev: 'high', nodeId: id });
        events.push({ kind: broken ? 'INTEGRITY_HOLD' : 'LEFT_ESTATE', minAgo: l.minAgo, text: l.flag, who: `${l.user} · ${l.machine}`, sev: 'critical', nodeId: id });
        return;
      }
      const n: LNode = { id, parent: trunk.id, depth: trunk.depth + 1, kind: kindOf(l.action), org: l.org, location: l.action.replace(/ · received$/, ''), user: l.user, machine: l.machine, minAgo: l.minAgo, sha256: l.sha256, watermark: l.watermark, state: 'verified', leftEstate: false, lastVerifiedMin: r.int(1, 600) };
      nodes.push(n);
      events.push({ kind: n.kind, minAgo: l.minAgo, text: `${l.action} (${l.org})`, who: `${l.user} · ${l.machine}`, nodeId: id });
      if (i === 1 && r.chance(0.7)) {
        const rid = `n${nodes.length}`;
        const rv = r.int(30, Math.max(60, l.minAgo - 10));
        nodes.push({ id: rid, parent: n.id, depth: n.depth + 1, kind: 'COPY', org: l.org, location: `Working copy · ${l.machine}`, user: l.user, machine: l.machine, minAgo: Math.max(rv + 5, l.minAgo - r.int(20, 200)), sha256: l.sha256, watermark: l.watermark.replace(/.{4}$/, r.hex(4).toUpperCase()), state: 'revoked', leftEstate: false, lastVerifiedMin: rv, note: 'Grant revoked: copy unreadable' });
        events.push({ kind: 'REVOKED', minAgo: rv, text: 'Grant revoked; copy key withdrawn', who: c.people.grcLead.name, sev: 'medium', nodeId: rid });
      }
    });
    const arch = `n${nodes.length}`;
    nodes.push({ id: arch, parent: vault.id, depth: 2, kind: 'ARCHIVE', org: first.org, location: forCustomer(ARCHIVE, c), user: 'Retention service', machine: 'archive', minAgo: Math.max(10, first.minAgo - r.int(60, 900)), sha256: first.sha256, watermark: '—', state: 'verified', leftEstate: false, lastVerifiedMin: r.int(60, 1440) });
    events.push({ kind: 'ARCHIVE', minAgo: nodes[nodes.length - 1].minAgo, text: `Retention copy to ${forCustomer(ARCHIVE, c)}`, who: 'Retention service', nodeId: arch });
    const status: AssetTagState = nodes.some((n) => n.state === 'broken') ? 'Signature broken' : nodes.some((n) => n.leftEstate) ? 'Left the estate' : ai === 6 ? 'Untagged' : 'Verified';
    return {
      asset: a, status, nodes, events: events.sort((x, y) => y.minAgo - x.minAgo),
      projectId: `PRJ-${String(ai + 1).padStart(2, '0')}-${r.hex(4).toUpperCase()}`,
      signingKey: keyId, algorithm: 'Ed25519 / SHA-256', originalSha: first.sha256, createdBy: first.user, createdMinAgo: createdMin,
      orgs: new Set(nodes.map((n) => n.org)).size, leftEstate: nodes.filter((n) => n.leftEstate).length,
    };
  });
}

/* ================================================================== */
/* Threat & telemetry                                                  */
/* ================================================================== */

export interface EgressVector { name: string; attempts: number; blocked: number }
const VECTORS: [string, number, number][] = [
  ['USB / removable media', 72, 0.57], ['Unsanctioned cloud', 58, 0.81], ['External share', 51, 0.75], ['Mass duplication', 44, 0.27], ['Tag stripping', 29, 0.31], ['Print / screen capture', 23, 0.26],
];
const VECTOR_TILT: CustomerMap<number[]> = {
  maritime: [1.6, 0.6, 0.7, 0.8, 0.6, 0.5],
  finserv: [0.8, 1.1, 1.3, 0.7, 0.6, 1.4],
  media: [1.0, 1.2, 1.1, 1.2, 1.1, 0.9],
  healthcare: [1.4, 1.2, 0.9, 0.7, 0.6, 1.1],
  automotive: [0.9, 1.1, 1.2, 1.0, 0.8, 1.5],
  insurance: [0.7, 1.0, 1.4, 1.1, 0.5, 1.0],
  defence: [1.5, 0.7, 1.2, 0.8, 0.9, 1.3],
  pharma: [1.1, 1.3, 1.1, 0.9, 0.7, 1.0],
  sghospital: [1.5, 1.1, 1.0, 0.6, 0.5, 1.2],
  studio: [1.0, 1.3, 1.1, 1.3, 1.2, 1.1],
};

export function egressVectors(c: CustomerProfile, tenantId: string, days: number): EgressVector[] {
  const h = headlines(c, tenantId).custody;
  const r = rng(`custody-egress-${c.id}-${tenantId}-${days}`);
  const scaleF = Math.max(0.15, (h.transfers7d / 2000) * (days / 7));
  return VECTORS.map(([name, base, rate], i) => {
    const attempts = Math.max(3, Math.round(base * forCustomer(VECTOR_TILT, c)[i] * scaleF * r.float(0.85, 1.15, 2)));
    return { name, attempts, blocked: Math.min(attempts, Math.round(attempts * Math.min(0.95, rate * r.float(0.9, 1.1, 2)))) };
  });
}

export type AgentState = 'Healthy' | 'Degraded' | 'Stale' | 'Offline';
export interface CustodyAgent { host: string; group: string; state: AgentState; platform: string; version: string; events: number; queued: number; lastSeenMin: number; org: string }

const GROUPS: CustomerMap<string[]> = {
  maritime: ['Fleet IT', 'Vessel edge', 'Terminal engineering', 'Group HQ', 'OEM partners'],
  finserv: ['Company Secretariat', 'Deal team', 'Treasury', 'Wealth', 'Advisers'],
  media: ['Post', 'VFX vendors', 'Marketing', 'Executive', 'Contractors'],
  healthcare: ['Research', 'Radiology', 'Quality & analytics', 'Executive', 'Partners (BAA)'],
  automotive: ['Design studio', 'R&D engineering', 'OTA release', 'Suppliers (TISAX)', 'Executive'],
  insurance: ['Claims & SIU', 'Actuarial', 'Reinsurance', 'Board & Legal', 'TPA & BPO partners', 'Reinsurer partners'],
  defence: ['Programs (CUI enclave)', 'Engineering', 'Building 3 shop floor', 'Tucson range', 'Prime partners', 'Sub-tier suppliers'],
  pharma: ['Clinical operations', 'Regulatory affairs', 'Valais & Cork manufacturing', 'Research', 'CRO partners', 'CDMO partners'],
  sghospital: ['Radiology & imaging', 'Medical records', 'Billing & claims', 'Clinical research', 'Partners (insurers & labs)'],
  studio: ['Editorial', 'Post & VFX', 'Marketing & awards', 'Starfall+ delivery', 'VFX vendors', 'Localisation vendors', 'Contractors'],
};
export const AGENT_CURRENT = '4.2.1';

export function custodyAgents(c: CustomerProfile, tenantId: string): { list: CustodyAgent[]; counts: Record<AgentState, number>; total: number } {
  const h = headlines(c, tenantId).custody;
  const r = rng(`custody-agents-${c.id}-${tenantId}`);
  const total = h.agents;
  const off = Math.max(1, Math.round(total * 0.02));
  const stale = Math.max(1, Math.round(total * 0.035));
  const deg = Math.max(1, Math.round(total * 0.06));
  const counts: Record<AgentState, number> = { Healthy: total - off - stale - deg, Degraded: deg, Stale: stale, Offline: off };
  const groups = forCustomer(GROUPS, c);
  const vendors = vendorChain(c).map((v) => v.name);
  const n = Math.min(total, 60);
  const states: AgentState[] = [...Array(Math.min(off, 3)).fill('Offline'), ...Array(Math.min(stale, 4)).fill('Stale'), ...Array(Math.min(deg, 6)).fill('Degraded')];
  const list: CustodyAgent[] = [];
  for (let i = 0; i < n; i++) {
    const state = states[i] ?? 'Healthy';
    const group = r.pick(groups);
    const external = /partner|vendor|supplier|contractor|adviser|OEM/i.test(group);
    const prefix = external ? r.pick(vendors).replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() : c.vocab.hostPrefix;
    list.push({
      host: `${prefix}-${r.pick(['WS', 'LT', 'GW', 'RENDER', 'NAS', 'MAC'])}-${String(r.int(1, 499)).padStart(3, '0')}`,
      group, state, org: external ? r.pick(vendors) : c.name,
      platform: r.pick(['Windows 11 23H2', 'Windows 11 22H2', 'macOS 15.2', 'macOS 14.6', 'Ubuntu 24.04', 'Windows Server 2022']),
      version: state === 'Healthy' ? AGENT_CURRENT : r.pick(['4.2.0', '4.1.7', '4.0.9', '3.9.4']),
      events: state === 'Offline' ? 0 : r.int(state === 'Healthy' ? 60 : 20, 520),
      queued: state === 'Healthy' ? 0 : state === 'Offline' ? 0 : r.int(20, 160),
      lastSeenMin: state === 'Offline' ? r.int(1500, 4300) : state === 'Stale' ? r.int(180, 600) : state === 'Degraded' ? r.int(20, 60) : r.int(0, 6),
    });
  }
  return { list, counts, total };
}

export interface Offender { who: string; type: 'USER' | 'DEVICE'; group: string; org: string; anomalies: number; vector: string; lastSeenMin: number }
export function topOffenders(c: CustomerProfile, tenantId: string, days: number): Offender[] {
  const anomalies = custodyAnomalies(c, tenantId);
  const vectors = egressVectors(c, tenantId, days);
  const r = rng(`custody-offenders-${c.id}-${tenantId}-${days}`);
  const groups = forCustomer(GROUPS, c);
  const vecFor = (action: string) => (/usb|cd|removable|media/i.test(action) ? 'USB / removable media' : /cloud|sync/i.test(action) ? 'Unsanctioned cloud' : /screen|print|capture/i.test(action) ? 'Print / screen capture' : /email|forward|share|link/i.test(action) ? 'External share' : /hash|integrity/i.test(action) ? 'Tag stripping' : 'Mass duplication');
  const out: Offender[] = [];
  for (const a of anomalies) {
    out.push({ who: a.actor, type: 'USER', group: r.pick(groups), org: a.org, anomalies: r.int(9, 31), vector: vecFor(a.action), lastSeenMin: a.ageMin });
    if (out.length < 8 && !/no agent|Portal|portal/.test(a.machine)) out.push({ who: a.machine, type: 'DEVICE', group: r.pick(groups), org: a.org, anomalies: r.int(6, 27), vector: vecFor(a.action), lastSeenMin: a.ageMin });
  }
  const staff = c.people.staff;
  while (out.length < 8) {
    const p = r.pick(staff);
    if (out.some((o) => o.who === p.name)) continue;
    out.push({ who: p.name, type: 'USER', group: r.pick(groups), org: c.name, anomalies: r.int(3, 12), vector: r.pick(vectors).name, lastSeenMin: r.int(60, 4000) });
  }
  return out.slice(0, 8).sort((a, b) => b.anomalies - a.anomalies);
}

/* ------------------------------------------------------------------ */
/* Sector note under "content in motion"                               */
/* ------------------------------------------------------------------ */

export const CUSTODY_NOTE: CustomerMap<string | null> = {
  maritime: 'Vessel software is hash-verified against the OEM signature before install, giving the software-integrity evidence IACS UR E27 asks for.',
  automotive: 'OTA packages are hash-verified against the signed build at every hop, giving the software-integrity evidence UNECE R156 asks for.',
  healthcare: 'ePHI never leaves the customer data planes: custody events carry hashes and watermarks, not content.',
  finserv: null,
  media: null,
  insurance: 'Policyholder NPI and claim files never leave the Kingsbridge data planes: custody events carry hashes and watermarks, giving the third-party service provider evidence NYDFS 500.11 and NAIC #668 ask for.',
  defence: 'CUI never leaves the GCC High enclave unencrypted: every TDP hand-off to a prime or sub-tier is logged with its export authorisation, giving the evidence DFARS 252.204-7012 and ITAR 120.54 ask for.',
  pharma: 'Every hand-off of a GxP record is hashed, signed and time-stamped, so the custody chain doubles as the Part 11 / Annex 11 audit trail for trial data, eCTD sequences and batch records.',
  sghospital: 'Patient records never leave the Singapore data planes: custody events carry hashes and watermarks, not content, as the HIA data-security requirements expect.',
  studio: 'Every copy of pre-release content carries a per-recipient NexGuard watermark, so a leaked frame traces back to the vendor, user and session within minutes (TPN / MPA content-security evidence).',
};
