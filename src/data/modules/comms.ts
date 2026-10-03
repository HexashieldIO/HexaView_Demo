// Communications Hub data: the people a customer can talk to (licensed
// colleagues, external guests and HexaShield staff), DMs and group threads,
// team channels with HexaView bots, HexaShield support tickets and calls.
// All dummy, seeded per customer so it is stable across reloads, and wired to
// real record ids (incidents, approvals, loops, connectors) so cards navigate.
import type { CustomerId, CustomerProfile, Severity } from '../types';
import { rng } from '../../lib/rng';
import { loops } from '../core';
import { scopedConnectors, isStale } from '../customers';
import { incidents, HEXASOC_ANALYSTS } from './soc';
import { pendingActions, extraPeople, supportSessions, type Me, type SupportSession } from './ops';

/* =====================================================================
   People
   ===================================================================== */
export type Licence = 'Full' | 'Approver' | 'Viewer' | 'Guest' | 'HexaShield';
export type Presence = 'online' | 'away' | 'busy' | 'offline';
export type Party = 'colleague' | 'external' | 'hexashield';
export type Team =
  | 'Security leadership' | 'SOC' | 'OT engineering' | 'Risk & GRC' | 'Platform' | 'Finance' | 'Legal & privacy'
  | 'Board & executive' | 'Business & sites' | 'Insurance' | 'Audit' | 'Legal (external)' | 'Vendor' | 'HexaShield';

export const LICENCES: Licence[] = ['Full', 'Approver', 'Viewer', 'Guest', 'HexaShield'];
export const LICENCE_META: Record<Licence, { label: string; color: string; can: string }> = {
  Full: { label: 'Full', color: '#4f8cff', can: 'Every module their HexaView role allows, all channels, can start calls and share any record' },
  Approver: { label: 'Approver', color: '#a07cfb', can: 'Action Centre approvals, incidents, reports; chat and channels' },
  Viewer: { label: 'Viewer', color: '#2ec4a8', can: 'Board view, reports and insurance read-only; chat and invited channels' },
  Guest: { label: 'Guest / External', color: '#f5a83d', can: 'Shared channels and DMs only; sees only records explicitly shared with them; time-boxed' },
  HexaShield: { label: 'HexaShield staff', color: '#e879f9', can: 'Comms only; no standing data access (support sessions need Tenant Admin approval)' },
};
export const PRESENCE_COLOR: Record<Presence, string> = { online: '#22c55e', away: '#f5b946', busy: '#f0466e', offline: '#8593b4' };
export const PARTY_LABEL: Record<Party, string> = { colleague: 'Colleagues', external: 'External', hexashield: 'HexaShield' };

export interface CommsPerson {
  id: string;
  name: string;
  role: string;
  org: string;
  party: Party;
  team: Team;
  licence: Licence;
  presence: Presence;
  tz: string;
  tzOffset: number;
  tenantId?: string;
  lastActiveMin: number;
  modules: string[];
  email: string;
  vip?: boolean;
  bot?: boolean;
  guestExpiryDays?: number;
  status?: string;
  channels: string[];
}

const MODULES_BY_TEAM: Record<Team, string[]> = {
  'Security leadership': ['Command Centre', 'Board view', 'HexaSOC', 'Action Centre', 'Reports', 'Insurance'],
  SOC: ['HexaSOC', 'HexaInt', 'HexaMatrix', 'Action Centre', 'War Room'],
  'OT engineering': ['HexaOT (read-only)', 'Data planes', 'Fabric assets'],
  'Risk & GRC': ['HexaComply', 'Closed loop', 'Reports', 'Insurance', 'Audit ledger'],
  Platform: ['Administration', 'Integration fabric', 'Action Centre', 'Audit ledger'],
  Finance: ['Board view', 'Insurance', 'Reports'],
  'Legal & privacy': ['War Room', 'Audit ledger', 'Reports', 'HexaComply (privacy)'],
  'Board & executive': ['Board view', 'Reports'],
  'Business & sites': ['Command Centre (own site)', 'Reports'],
  Insurance: ['Shared evidence pack', 'Shared channels'],
  Audit: ['Shared evidence (read-only)', 'Shared channels'],
  'Legal (external)': ['Shared War Room notes', 'Shared channels'],
  Vendor: ['Shared vendor channel'],
  HexaShield: ['Comms', 'Support sessions (time-boxed, approved)'],
};

interface Extra { key: string; name: string; role: string; team: Team; licence: Licence; tenant?: string; vip?: boolean }
interface ExtSeed { key: string; name: string; role: string; org: string; team: Team; tz: [string, number]; expiry: number }
interface OrgSeed {
  domain: string;
  tz: [string, number];
  tenantTz: Record<string, [string, number]>;
  staff: [number, Licence, Team, string][]; // staff index, licence, team, tenant
  extras: Extra[];
  ext: ExtSeed[];
  hx: { csm: string; se: string };
  seats: Record<Licence, number>;
  synced: Record<Licence, number>;
}

const ORG: Record<CustomerId, OrgSeed> = {
  maritime: {
    domain: 'halcyonports.com',
    tz: ['Rotterdam', 2],
    tenantTz: { pkl: ['Port Klang', 8], sts: ['Santos', -3], fleet: ['At sea (UTC+3)', 3], ant: ['Antwerp', 2] },
    staff: [[0, 'Viewer', 'Finance', 'hq'], [1, 'Viewer', 'Business & sites', 'fleet'], [2, 'Viewer', 'Business & sites', 'rtm'], [3, 'Full', 'Platform', 'pkl'], [4, 'Full', 'OT engineering', 'sts'], [6, 'Viewer', 'OT engineering', 'rtm'], [7, 'Viewer', 'OT engineering', 'fleet']],
    extras: [
      { key: 'dpo', name: 'Annelies Verbruggen', role: 'Data Protection Officer', team: 'Legal & privacy', licence: 'Viewer' },
      { key: 'counsel', name: 'Maarten de Groot', role: 'General Counsel', team: 'Legal & privacy', licence: 'Viewer' },
      { key: 'ned', name: 'Dr. Ellen Vos', role: 'Chair, Audit & Risk Committee', team: 'Board & executive', licence: 'Viewer', vip: true },
      { key: 'risk', name: 'Yusuf Demir', role: 'Enterprise Risk Manager', team: 'Risk & GRC', licence: 'Approver' },
    ],
    ext: [
      { key: 'broker', name: 'Oliver Bennett', role: 'Account Executive, Cyber', org: 'Marsh Marine & Energy', team: 'Insurance', tz: ['London', 1], expiry: 90 },
      { key: 'claims', name: 'Katharina Weiss', role: 'Cyber Claims Manager', org: 'Beazley', team: 'Insurance', tz: ['London', 1], expiry: 180 },
      { key: 'auditor', name: extraFallback('maritime'), role: 'Lead Auditor, ISO 27001 surveillance', org: 'Northcote Assurance', team: 'Audit', tz: ['Utrecht', 2], expiry: 45 },
      { key: 'breach', name: 'Sarah Whitcombe', role: 'Partner, Cyber & Data Breach', org: 'Harlow Pierce LLP', team: 'Legal (external)', tz: ['London', 1], expiry: 365 },
      { key: 'v1', name: 'Mikko Laine', role: 'Remote Services Lead', org: 'Konecranes Remote Services', team: 'Vendor', tz: ['Hyvinkää', 3], expiry: 60 },
      { key: 'v2', name: 'Ingvild Hauge', role: 'Vessel Automation Service Engineer', org: 'Kongsberg Maritime', team: 'Vendor', tz: ['Kongsberg', 2], expiry: 60 },
      { key: 'v3', name: 'Kenneth Lau', role: 'Fleet IT Manager', org: 'Wallem Ship Management', team: 'Vendor', tz: ['Hong Kong', 8], expiry: 90 },
    ],
    hx: { csm: 'Rebecca Holt', se: 'Daan Hoekstra' },
    seats: { Full: 40, Approver: 15, Viewer: 30, Guest: 25, HexaShield: 10 },
    synced: { Full: 21, Approver: 7, Viewer: 12, Guest: 6, HexaShield: 0 },
  },
  finserv: {
    domain: 'aldersgate.co.uk',
    tz: ['London', 1],
    tenantTz: { markets: ['New York', -4], wealth: ['Singapore', 8], eu: ['Luxembourg', 2], pay: ['Manchester', 1] },
    staff: [[0, 'Viewer', 'Finance', 'ukbank'], [1, 'Viewer', 'Business & sites', 'markets'], [2, 'Viewer', 'Business & sites', 'eu'], [5, 'Full', 'Platform', 'pay'], [6, 'Full', 'Platform', 'ukbank'], [8, 'Approver', 'Platform', 'ukbank']],
    extras: [
      { key: 'dpo', name: 'Gareth Lloyd', role: 'Group Data Protection Officer', team: 'Legal & privacy', licence: 'Viewer' },
      { key: 'counsel', name: 'Imogen Clarke', role: 'Deputy General Counsel, Regulatory', team: 'Legal & privacy', licence: 'Approver' },
      { key: 'ned', name: 'Dame Alison Grey', role: 'Chair, Board Risk Committee', team: 'Board & executive', licence: 'Viewer', vip: true },
      { key: 'risk', name: 'Rohan Mehta', role: 'Operational Risk Manager', team: 'Risk & GRC', licence: 'Approver' },
    ],
    ext: [
      { key: 'broker', name: 'James Thornton', role: 'Cyber Practice Leader', org: 'Aon Financial Services', team: 'Insurance', tz: ['London', 1], expiry: 90 },
      { key: 'claims', name: 'Rachel Kim', role: 'Cyber Claims Director', org: 'AIG', team: 'Insurance', tz: ['London', 1], expiry: 180 },
      { key: 'auditor', name: extraFallback('finserv'), role: 'Senior Manager, IT Audit (PCI & SOX)', org: 'Ashby Kerr Audit LLP', team: 'Audit', tz: ['London', 1], expiry: 60 },
      { key: 'breach', name: 'Edward Pryce', role: 'Partner, Financial Regulation & Cyber', org: 'Fenwick Lowe LLP', team: 'Legal (external)', tz: ['London', 1], expiry: 365 },
      { key: 'v1', name: 'Arjun Rao', role: 'Delivery Security Lead', org: 'Infosys BPM', team: 'Vendor', tz: ['Bengaluru', 5.5], expiry: 90 },
      { key: 'v2', name: 'Lukas Meier', role: 'Client Security Liaison', org: 'Temenos', team: 'Vendor', tz: ['Geneva', 2], expiry: 90 },
      { key: 'v3', name: 'Dana Whitfield', role: 'Client Security Manager', org: 'FIS', team: 'Vendor', tz: ['Jacksonville', -4], expiry: 90 },
    ],
    hx: { csm: 'Victoria Ames', se: 'Tom Achebe' },
    seats: { Full: 120, Approver: 40, Viewer: 60, Guest: 40, HexaShield: 12 },
    synced: { Full: 84, Approver: 27, Viewer: 31, Guest: 14, HexaShield: 0 },
  },
  media: {
    domain: 'kestrelpictures.com',
    tz: ['Burbank', -7],
    tenantTz: { post: ['London (Soho)', 1], live: ['Atlanta', -4] },
    staff: [[0, 'Viewer', 'Business & sites', 'studios'], [2, 'Approver', 'Business & sites', 'post'], [3, 'Viewer', 'Business & sites', 'post'], [6, 'Full', 'OT engineering', 'live'], [8, 'Full', 'Platform', 'play']],
    extras: [
      { key: 'cfo', name: 'Gregory Lam', role: 'Chief Financial Officer', team: 'Finance', licence: 'Viewer', vip: true },
      { key: 'dpo', name: 'Nina Alvarez', role: 'Chief Privacy Officer', team: 'Legal & privacy', licence: 'Viewer' },
      { key: 'counsel', name: 'Ruth Feldman', role: 'SVP Business & Legal Affairs (studio legal)', team: 'Legal & privacy', licence: 'Approver' },
      { key: 'ned', name: 'Charles Whitmore', role: 'Board Director, Audit Committee Chair', team: 'Board & executive', licence: 'Viewer', vip: true },
      { key: 'risk', name: 'Jasmine Cho', role: 'Content Risk Analyst', team: 'Risk & GRC', licence: 'Full' },
    ],
    ext: [
      { key: 'broker', name: "Megan O'Neill", role: 'Media & Entertainment Cyber Lead', org: 'WTW Media & Entertainment', team: 'Insurance', tz: ['Los Angeles', -7], expiry: 90 },
      { key: 'claims', name: 'Paul Hendricks', role: 'Cyber Claims Specialist', org: 'Hiscox', team: 'Insurance', tz: ['New York', -4], expiry: 180 },
      { key: 'auditor', name: extraFallback('media'), role: 'TPN Assessor', org: 'Brightline Content Assurance', team: 'Audit', tz: ['Los Angeles', -7], expiry: 45 },
      { key: 'breach', name: 'Daniel Reyes', role: 'Partner, Media & IP Litigation', org: 'Calder Voss LLP', team: 'Legal (external)', tz: ['Los Angeles', -7], expiry: 365 },
      { key: 'v1', name: 'Carmen Ortega', role: 'Studio Operations Manager', org: 'Red Fern Localisation', team: 'Vendor', tz: ['Madrid', 2], expiry: 30 },
      { key: 'v2', name: 'Julien Tremblay', role: 'Pipeline Security Lead', org: 'Lumière VFX (Montréal)', team: 'Vendor', tz: ['Montréal', -4], expiry: 60 },
      { key: 'v3', name: 'Kyle Benson', role: 'Senior Producer', org: 'Apex Trailer House', team: 'Vendor', tz: ['Los Angeles', -7], expiry: 30 },
    ],
    hx: { csm: 'Aaron Fields', se: 'Lena Kraus' },
    seats: { Full: 25, Approver: 10, Viewer: 20, Guest: 30, HexaShield: 8 },
    synced: { Full: 11, Approver: 4, Viewer: 8, Guest: 15, HexaShield: 0 },
  },
  healthcare: {
    domain: 'mercyridgehealth.org',
    tz: ['Columbus', -4],
    tenantTz: {},
    staff: [[0, 'Approver', 'Business & sites', 'mrmc'], [1, 'Viewer', 'Finance', 'mrmc'], [2, 'Viewer', 'Business & sites', 'mrmc'], [3, 'Full', 'Platform', 'mrmc'], [4, 'Full', 'OT engineering', 'community'], [9, 'Full', 'OT engineering', 'mrmc']],
    extras: [
      { key: 'dpo', name: 'Denise Harper', role: 'Chief Privacy Officer (HIPAA)', team: 'Legal & privacy', licence: 'Approver' },
      { key: 'counsel', name: 'Robert Klein', role: 'General Counsel', team: 'Legal & privacy', licence: 'Viewer' },
      { key: 'ned', name: 'Dr. Helen Ramirez', role: 'Chair, Board Quality & Risk Committee', team: 'Board & executive', licence: 'Viewer', vip: true },
      { key: 'risk', name: 'Monica Reyes', role: 'Enterprise Risk Analyst', team: 'Risk & GRC', licence: 'Full' },
    ],
    ext: [
      { key: 'broker', name: 'Lauren Hughes', role: 'Healthcare Cyber Practice Leader', org: 'Gallagher Healthcare', team: 'Insurance', tz: ['Chicago', -5], expiry: 90 },
      { key: 'claims', name: 'Steven Price', role: 'Cyber Claims Manager', org: 'Beazley', team: 'Insurance', tz: ['New York', -4], expiry: 180 },
      { key: 'auditor', name: extraFallback('healthcare'), role: 'HITRUST External Assessor', org: 'Meridian Health Assurance', team: 'Audit', tz: ['Chicago', -5], expiry: 60 },
      { key: 'breach', name: 'Mark Feeney', role: 'Partner, Health Privacy & Breach Response', org: 'Holloway Grant LLP', team: 'Legal (external)', tz: ['Cleveland', -4], expiry: 365 },
      { key: 'v1', name: 'Kim Nguyen', role: 'Alaris Product Security Manager', org: 'BD (Becton Dickinson)', team: 'Vendor', tz: ['San Diego', -7], expiry: 60 },
      { key: 'v2', name: 'Laura Benson', role: 'Technical Services Lead', org: 'Epic Systems', team: 'Vendor', tz: ['Verona, WI', -5], expiry: 90 },
      { key: 'v3', name: 'Raymond Ortiz', role: 'Field Service Security Engineer', org: 'GE HealthCare', team: 'Vendor', tz: ['Chicago', -5], expiry: 60 },
    ],
    hx: { csm: 'Jordan Ellis', se: 'Priyanka Rao' },
    seats: { Full: 60, Approver: 20, Viewer: 40, Guest: 30, HexaShield: 10 },
    synced: { Full: 38, Approver: 11, Viewer: 22, Guest: 9, HexaShield: 0 },
  },
  automotive: {
    domain: 'vireo-motors.com',
    tz: ['Munich', 2],
    tenantTz: { puebla: ['Puebla', -6], gyor: ['Győr', 2] },
    staff: [[0, 'Viewer', 'Finance', 'group'], [1, 'Viewer', 'Business & sites', 'group'], [2, 'Full', 'Security leadership', 'connected'], [3, 'Full', 'Platform', 'gyor'], [4, 'Full', 'OT engineering', 'ingolstadt'], [6, 'Approver', 'Business & sites', 'connected'], [9, 'Viewer', 'OT engineering', 'battery']],
    extras: [
      { key: 'pm', name: 'Bernd Lorenz', role: 'Plant Manager, Ingolstadt', team: 'Business & sites', licence: 'Viewer', tenant: 'ingolstadt', vip: true },
      { key: 'dpo', name: 'Dr. Martin Seidel', role: 'Group Data Protection Officer', team: 'Legal & privacy', licence: 'Viewer' },
      { key: 'counsel', name: 'Claudia Neumann', role: 'Head of Legal, Cyber & IP', team: 'Legal & privacy', licence: 'Approver' },
      { key: 'ned', name: 'Prof. Renate Fuchs', role: 'Supervisory Board, Audit Committee Chair', team: 'Board & executive', licence: 'Viewer', vip: true },
      { key: 'risk', name: 'Daniel Lehmann', role: 'Enterprise Risk Manager', team: 'Risk & GRC', licence: 'Approver' },
    ],
    ext: [
      { key: 'broker', name: 'Florian Brandl', role: 'Cyber Practice Lead, Automotive', org: 'Aon Automotive', team: 'Insurance', tz: ['Munich', 2], expiry: 90 },
      { key: 'claims', name: 'Sabine Krüger', role: 'Cyber Claims Manager', org: 'Allianz', team: 'Insurance', tz: ['Munich', 2], expiry: 180 },
      { key: 'auditor', name: extraFallback('automotive'), role: 'TISAX Lead Assessor', org: 'Rhein Audit GmbH', team: 'Audit', tz: ['Cologne', 2], expiry: 45 },
      { key: 'breach', name: 'Dr. Alexander Roth', role: 'Partner, IT & Data Protection', org: 'Roth Lindner Rechtsanwälte', team: 'Legal (external)', tz: ['Frankfurt', 2], expiry: 365 },
      { key: 'v1', name: 'Sven Ludwig', role: 'Remote Service Lead, Body-in-White', org: 'KUKA Robotics', team: 'Vendor', tz: ['Augsburg', 2], expiry: 60 },
      { key: 'v2', name: 'Kai Wendt', role: 'PSIRT Liaison', org: 'Bosch Mobility', team: 'Vendor', tz: ['Stuttgart', 2], expiry: 90 },
      { key: 'v3', name: 'Megan Tate', role: 'Head of Security', org: 'DealerCore DMS', team: 'Vendor', tz: ['Dallas', -5], expiry: 60 },
    ],
    hx: { csm: 'Julia Stein', se: 'Nils Becker' },
    seats: { Full: 150, Approver: 50, Viewer: 80, Guest: 60, HexaShield: 14 },
    synced: { Full: 109, Approver: 31, Viewer: 46, Guest: 22, HexaShield: 0 },
  },
};

// Auditor names come from the ops module's EXTRA table so Admin and Comms agree.
function extraFallback(id: CustomerId): string {
  return { maritime: 'Lotte Smit', finserv: 'Olivia Hart', media: 'Grace Kim', healthcare: 'Patricia Hollis', automotive: 'Thomas Weber' }[id];
}

const BOT_DEF: { id: string; name: string; role: string }[] = [
  { id: 'bot-soc', name: 'HexaSOC bot', role: 'Posts new incidents and containment updates' },
  { id: 'bot-ot', name: 'HexaOT bot', role: 'Posts OT alerts (read-only by policy)' },
  { id: 'bot-comply', name: 'HexaComply bot', role: 'Posts loop breaks, evidence ageing and audit deadlines' },
  { id: 'bot-ins', name: 'Insurance bot', role: 'Posts evidence-pack changes and insurability moves' },
  { id: 'bot-view', name: 'HexaView', role: 'Platform notices, releases and approvals' },
  { id: 'bot-custody', name: 'HexaCustody bot', role: 'Posts custody anomalies and revocations' },
];

function initials(name: string): string {
  const parts = cleanName(name).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function cleanName(name: string): string {
  return name.replace(/^(Dr\.|Capt\.|Chief Eng\.|Sir|Dame|Prof\.)\s+/g, '').replace(/\s*\(.*\)$/, '');
}
export function firstName(name: string): string {
  return cleanName(name).split(' ')[0];
}
export { initials as personInitials };

function emailFor(name: string, domain: string): string {
  const n = cleanName(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').split(' ');
  return `${n[0]}.${n[n.length - 1]}@${domain}`;
}

/** Everyone the signed-in user can talk to, plus the HexaView bots (bot: true). */
export function commsPeople(c: CustomerProfile): CommsPerson[] {
  const o = ORG[c.id];
  const x = extraPeople(c);
  const p = c.people;
  const r = rng(`comms-people-${c.id}`);
  const out: CommsPerson[] = [];
  const presence = (fixed?: Presence): [Presence, number] => {
    const pr = fixed ?? r.weighted<Presence>([['online', 5], ['away', 2], ['busy', 2], ['offline', 2]]);
    const last = pr === 'online' ? r.int(0, 3) : pr === 'busy' ? r.int(1, 25) : pr === 'away' ? r.int(12, 70) : r.int(140, 3200);
    return [pr, last];
  };
  const tzFor = (tenant?: string): [string, number] => (tenant && o.tenantTz[tenant]) || o.tz;
  const add = (id: string, name: string, role: string, team: Team, licence: Licence, opts: { tenant?: string; vip?: boolean; email?: string; pr?: Presence; status?: string } = {}) => {
    const [pr, last] = presence(opts.pr);
    const [tz, off] = tzFor(opts.tenant);
    out.push({ id, name, role, org: c.name, party: 'colleague', team, licence, presence: pr, lastActiveMin: last, tz, tzOffset: off, tenantId: opts.tenant, modules: MODULES_BY_TEAM[team], email: opts.email ?? emailFor(name, o.domain), vip: opts.vip, status: opts.status, channels: [] });
  };
  add('ciso', p.ciso.name, p.ciso.role, 'Security leadership', 'Full', { email: p.ciso.email });
  add('soc', p.socLead.name, p.socLead.role, 'SOC', 'Full', { email: p.socLead.email, pr: 'online' });
  add('grc', p.grcLead.name, p.grcLead.role, 'Risk & GRC', 'Full', { email: p.grcLead.email });
  const ot = p.otLead ?? p.admin;
  add('ot', ot.name, ot.role, 'OT engineering', 'Full', { email: ot.email, pr: 'online' });
  add('admin', p.admin.name, `${p.admin.role} (Tenant Admin)`, 'Platform', 'Full', { email: p.admin.email });
  add('board', p.board.name, p.board.role, 'Board & executive', 'Viewer', { email: p.board.email, vip: true, pr: 'away' });
  add('approver', x.approver, 'Duty Approver, Cyber Defence', 'SOC', 'Approver');
  add('an1', x.analysts[0], 'Security Analyst (L2)', 'SOC', 'Full');
  add('an2', x.analysts[1], 'Threat Detection Engineer', 'SOC', 'Full');
  for (const [idx, lic, team, tenant] of o.staff) {
    const s = p.staff[idx];
    if (!s) continue;
    const isCfo = /CFO|Chief Financial/.test(s.role);
    add(isCfo ? 'cfo' : `st${idx}`, s.name, s.role, team, lic, { tenant, vip: s.vip, email: s.email });
  }
  for (const e of o.extras) add(e.key, e.name, e.role, e.team, e.licence, { tenant: e.tenant, vip: e.vip });

  for (const e of o.ext) {
    const [pr, last] = presence();
    out.push({ id: e.key, name: e.name, role: e.role, org: e.org, party: 'external', team: e.team, licence: 'Guest', presence: pr, lastActiveMin: last, tz: e.tz[0], tzOffset: e.tz[1], modules: MODULES_BY_TEAM[e.team], email: emailFor(e.name, `${e.org.toLowerCase().split(/[ (]/)[0].replace(/[^a-z]/g, '')}.com`), guestExpiryDays: e.expiry - r.int(3, 25), channels: [] });
  }

  const hx = (id: string, name: string, role: string, pr: Presence, tz: [string, number], status?: string) => {
    const [, last] = presence(pr);
    out.push({ id, name, role, org: 'HexaShield', party: 'hexashield', team: 'HexaShield', licence: 'HexaShield', presence: pr, lastActiveMin: last, tz: tz[0], tzOffset: tz[1], modules: MODULES_BY_TEAM.HexaShield, email: emailFor(name, 'hexashield.io'), status, channels: [] });
  };
  hx('hx-csm', o.hx.csm, 'Customer Success Manager (named)', 'online', ['London', 1], 'Service review Thu 10:00');
  hx('hx-desk', x.support.replace(/\s*\(HexaShield\)/, ''), 'HexaView Support Desk · platform admin', 'online', ['London', 1], 'On shift until 18:00');
  const soc = HEXASOC_ANALYSTS[{ maritime: 0, finserv: 2, media: 1, healthcare: 5, automotive: 3 }[c.id]];
  hx('hx-soc', soc.replace(/\s*\(.*\)/, ''), `HexaSOC ${soc.match(/\((.*)\)/)?.[1] ?? 'L2'} analyst · on duty`, 'online', ['Singapore (follow-the-sun)', 8], 'On duty · 24×7 rota');
  hx('hx-ir', 'Hannah Weiss', 'IR Retainer Lead (DFIR)', 'busy', ['Dublin', 1], 'On a bridge');
  hx('hx-se', o.hx.se, 'Solutions Engineer', 'away', ['Amsterdam', 2]);

  for (const b of BOT_DEF) out.push({ id: b.id, name: b.name, role: b.role, org: 'HexaView', party: 'hexashield', team: 'HexaShield', licence: 'HexaShield', presence: 'online', lastActiveMin: 0, tz: 'UTC', tzOffset: 0, modules: [], email: '', bot: true, channels: [] });

  // channel memberships (filled from the channel list so the directory agrees)
  const chs = channelSeeds(c);
  for (const ch of chs) for (const m of ch.members) out.find((q) => q.id === m)?.channels.push(`#${ch.name}`);
  return out;
}

/** Seats per licence type: named people in the directory plus users synced from the IdP. */
export function licenceUse(c: CustomerProfile, people: CommsPerson[]) {
  const o = ORG[c.id];
  return LICENCES.map((l) => {
    const named = people.filter((p) => !p.bot && p.licence === l).length;
    const used = named + o.synced[l];
    return { licence: l, named, synced: o.synced[l], used, seats: o.seats[l], free: Math.max(0, o.seats[l] - used) };
  });
}

/* =====================================================================
   HexaView records shared in conversations
   ===================================================================== */
export type RecordKind = 'incident' | 'approval' | 'loop' | 'report' | 'connector' | 'pack' | 'warroom' | 'ot' | 'custody' | 'finding';
export interface RecordRef {
  kind: RecordKind;
  id: string;
  title: string;
  sub: string;
  path: string;
  sev?: Severity;
  status?: string;
}
export const RECORD_META: Record<RecordKind, { label: string; color: string; module: string }> = {
  incident: { label: 'Incident', color: '#a07cfb', module: 'HexaSOC' },
  approval: { label: 'Approval', color: '#f97316', module: 'Action Centre' },
  loop: { label: 'Assurance loop', color: '#3ad0ae', module: 'Closed loop' },
  report: { label: 'Report', color: '#79a5f5', module: 'Reports' },
  connector: { label: 'Connector', color: '#38bdf8', module: 'Integration fabric' },
  pack: { label: 'Evidence pack', color: '#2ec4a8', module: 'Insurance' },
  warroom: { label: 'War Room', color: '#f0466e', module: 'Crisis War Room' },
  ot: { label: 'OT alert', color: '#f7a04a', module: 'HexaOT' },
  custody: { label: 'Custody event', color: '#ecc873', module: 'HexaCustody' },
  finding: { label: 'Finding', color: '#f8646f', module: 'HexaStrike' },
};
export type CardKey = 'inc' | 'inc2' | 'incI' | 'act' | 'loop' | 'report' | 'conn' | 'pack' | 'war' | 'ot' | 'custody' | 'finding';

const SECTOR_REC: Record<CustomerId, { report: [string, string]; pack: string; war: [string, string]; ot: [string, string, Severity]; custody: [string, string]; finding: [string, string] }> = {
  maritime: {
    report: ['Q4 Board cyber pack (draft)', 'Board · Resilience Index, crane incident, renewal position · 14 citations'],
    pack: 'Beazley / Munich Re renewal evidence pack',
    war: ['MI-2026-014 · Port Klang engineering workstation', 'Major incident · bridge open · HexaSOC + IR retainer'],
    ot: ['Unscheduled PLC programme download · STS crane 14', 'S7comm from HPS-JUMP-OT01 · Maasvlakte quay 3 · Level 1', 'high'],
    custody: ['ECDIS ENC weekly update (wk 40) held on 3 vessels', 'Signature check pending next satellite window'],
    finding: ['Konecranes jump host lacks phishing-resistant MFA', 'HexaStrike PT-2026-018 · high · vendor remote access'],
  },
  finserv: {
    report: ['Board Risk Committee cyber pack · Q3', 'DORA, op-res impact tolerances, Scattered Spider exposure · 22 citations'],
    pack: 'AIG / Chubb / Zurich renewal evidence pack',
    war: ['MI-2026-007 · Payments latency (DORA major)', 'Major incident · initial notification clock running'],
    ot: ['UPS bypass at Slough DC1 hall B', 'BMS alert · Data-centre facilities · read-only', 'medium'],
    custody: ['Treasury liquidity model shared with Kyriba', 'Custody chain intact · 4 recipients · watermark per recipient'],
    finding: ['BOLA on open-banking accounts API', 'HexaStrike PT-2026-031 · critical · PCI 6.2 / 11.4'],
  },
  media: {
    report: ['Content security board update · Nightjar', 'Leak containment, vendor exposure, TPN+ readiness · 11 citations'],
    pack: 'Hiscox / Coalition renewal evidence pack',
    war: ['MI-2026-019 · Nightjar locked cut exfiltration', 'Major incident · legal hold active · forensic watermark traced'],
    ot: ['Playout server firmware mismatch · Atlanta MCR', 'Grass Valley iTX node · unscheduled change · read-only', 'medium'],
    custody: ['Nightjar locked cut v7 copied to personal cloud', 'Soho edit bay 4 · revoked · watermark KP-NJ-7741'],
    finding: ['Screeners portal review-link authentication bypass', 'HexaStrike PT-2026-012 · critical · studios'],
  },
  healthcare: {
    report: ['Board Quality & Safety: cyber section · Q3', 'Downtime readiness, HPH CPGs, ransomware exposure · 16 citations'],
    pack: 'Beazley / Coalition renewal evidence pack',
    war: ['MI-2026-022 · Citrix access & Epic downtime readiness', 'Major incident · BCA workstations verified · HIPAA clock assessed'],
    ot: ['Infusion pumps reachable from guest Wi-Fi bridge', '1,140 devices on flat clinical VLAN · Community hospitals', 'high'],
    custody: ['Genomics cohort GX-2026 export to research partner', 'De-identified · watermark per recipient · 2 recipients'],
    finding: ['Alaris server running unsupported OS build', 'HexaStrike PT-2026-024 · high · FDA 524B obligations'],
  },
  automotive: {
    report: ['Supervisory Board cyber briefing · Q3', 'Plant OT, OTA integrity (R155/R156), TISAX AL3 · 19 citations'],
    pack: 'Allianz / Munich Re / AXA XL renewal evidence pack',
    war: ['MI-2026-031 · Ingolstadt body-shop line stop', 'Major incident · line restarted · root cause in progress'],
    ot: ['Robot cell programme change outside window · body shop line 2', 'PROFINET · KUKA KR QUANTEC cell 2-14 · Ingolstadt · Level 1', 'high'],
    custody: ['Project Lumen design renders shared with AutoVision', 'Pre-launch IP · 3 recipients · one opened from unmanaged device'],
    finding: ['Dealer DMS API allows VIN enumeration', 'HexaStrike PT-2026-040 · high · retail tenant'],
  },
};

export function commsRecords(c: CustomerProfile, tenantId: string, me: Me): Record<CardKey, RecordRef> {
  const s = SECTOR_REC[c.id];
  const open = incidents(c, tenantId, 1).filter((i) => i.status !== 'closed');
  const i1 = open[0];
  const i2 = open.find((i) => i !== i1 && (i.ot || i.leak || i.personal || i.card)) ?? open[1] ?? i1;
  const iI = open.find((i) => /MFA|Okta|Help-desk|token|spray|Impossible travel|credential|OAuth|badge/i.test(i.title)) ?? i1;
  const inc = (i: typeof i1 | undefined): RecordRef =>
    i ? { kind: 'incident', id: i.id, title: i.title, sub: `${i.status} · ${i.assignee} · ${i.alerts} alerts`, path: `/soc/ir?id=${i.id}`, sev: i.sev, status: i.status }
      : { kind: 'incident', id: 'HSOC', title: 'Open incidents', sub: 'No open incidents in this scope', path: '/soc/ir', sev: 'info' };
  const acts = pendingActions(c, tenantId, me);
  const pref: Record<CustomerId, RegExp> = { maritime: /vessel|remote access/i, finserv: /Okta|sessions/i, media: /Red Fern|supplier/i, healthcare: /contain/i, automotive: /KUKA/i };
  const a = acts.find((x) => pref[c.id].test(x.title)) ?? acts[0];
  const ls = loops(c, tenantId);
  const l = ls.find((x) => x.status === 'broken') ?? ls.find((x) => x.status === 'partial') ?? ls[0];
  const conns = scopedConnectors(c, tenantId);
  const k = conns.find((x) => x.status !== 'healthy' || isStale(x)) ?? conns[0] ?? c.connectors[0];
  return {
    inc: inc(i1),
    inc2: inc(i2),
    incI: inc(iI),
    act: a
      ? { kind: 'approval', id: a.id, title: a.title, sub: `${a.writeType} · ${a.risk} risk · ${a.approvals.length}/${a.approvalsNeeded} approvals`, path: `/ops/actions?id=${a.id}`, sev: a.risk === 'high' ? 'high' : a.risk === 'medium' ? 'medium' : 'low', status: 'Pending approval' }
      : { kind: 'approval', id: 'ACT', title: 'Action Centre', sub: 'No approvals pending', path: '/ops/actions' },
    loop: l
      ? { kind: 'loop', id: l.controlId, title: `${l.control}`, sub: `${l.framework} ${l.requirement} · ${l.technique} · ${l.status}`, path: `/loop?control=${encodeURIComponent(l.controlId)}`, sev: l.status === 'broken' ? 'high' : 'medium', status: l.status }
      : { kind: 'loop', id: 'LOOP', title: 'Closed-loop assurance', sub: 'All loops', path: '/loop' },
    report: { kind: 'report', id: 'RPT', title: s.report[0], sub: s.report[1], path: '/reports/library', status: 'Draft' },
    conn: { kind: 'connector', id: k.id, title: `${k.vendor === 'Generic' || k.vendor === 'HexaShield' ? '' : `${k.vendor} `}${k.product}`, sub: `${k.status}${isStale(k) ? ' · stale' : ''} · last sync ${k.lastSyncMin} min ago${k.note ? ` · ${k.note}` : ''}`, path: `/fabric/integrations?connector=${k.id}`, sev: k.status === 'failing' ? 'high' : k.status === 'healthy' ? 'info' : 'medium', status: k.status },
    pack: { kind: 'pack', id: 'PACK', title: s.pack, sub: `Renewal in ${c.insurance.renewalDays} days · broker ${c.insurance.broker} · live, cited`, path: '/insurance/pack?filter=gaps', status: 'Shared' },
    war: { kind: 'warroom', id: s.war[0].split(' ')[0], title: s.war[0], sub: s.war[1], path: '/ops/warroom', sev: 'critical', status: 'Active' },
    ot: { kind: 'ot', id: 'OT', title: s.ot[0], sub: s.ot[1], path: '/ot/alerts', sev: s.ot[2], status: 'Open · read-only' },
    custody: { kind: 'custody', id: 'CUS', title: s.custody[0], sub: s.custody[1], path: '/custody/revocation', sev: 'high', status: 'Tracked' },
    finding: { kind: 'finding', id: 'PT', title: s.finding[0], sub: s.finding[1], path: '/strike/pentest', sev: 'high', status: 'Open' },
  };
}

/* =====================================================================
   Conversations (DMs and group threads)
   ===================================================================== */
export interface FileRef { name: string; size: string }
export interface Message {
  id: string;
  from: string;
  text: string;
  minAgo: number;
  card?: RecordRef;
  file?: FileRef;
  thread?: Message[];
  system?: boolean;
}
export interface Conversation {
  id: string;
  kind: 'dm' | 'group' | 'support';
  title: string;
  members: string[];
  category: Party;
  pinned?: boolean;
  unread: number;
  tenantId?: string;
  topic: string;
  messages: Message[];
  replies: string[];
}

type M = [string, string, number, CardKey?, FileRef?];
interface ConvSeed { id: string; kind: Conversation['kind']; title?: string; with: string[]; cat: Party; pinned?: boolean; unread: number; tenant?: string; topic: string; msgs: M[]; replies: string[] }

const f = (name: string, size: string): FileRef => ({ name, size });

const CONV: Record<CustomerId, ConvSeed[]> = {
  maritime: [
    { id: 'm-crane', kind: 'dm', with: ['ot'], cat: 'colleague', pinned: true, unread: 2, tenant: 'rtm', topic: 'STS crane 14 PLC download', msgs: [
      ['ot', 'Heads up: HexaOT flagged an S7comm programme download to STS crane 14 on quay 3 at 06:12, outside the change window.', 96, 'ot'],
      ['ot', 'Source was HPS-JUMP-OT01. Konecranes had a remote session booked for crane 11, not 14.', 94],
      ['me', 'Is the crane still working cargo? I do not want anyone touching the PLC without Joost signing off.', 80],
      ['ot', 'Yes, it is discharging the Halcyon Aurora. OT stays read-only by policy, so no containment from HexaView on the controller. I compared block checksums with the golden image: OB1 and FB204 differ.', 71, undefined, f('RTM-STS-14_block_diff.pdf', '412 KB')],
      ['ot', 'HexaSOC has queued a related containment action in the Action Centre instead of touching the crane. It needs your approval.', 64, 'act'],
      ['ot', 'Can you approve before the 10:00 shift handover? Tomasz can stand the crane down at the next lashing break if we need to reload the golden programme.', 12],
    ], replies: ['Thanks. I will brief Joost and keep crane 14 on manual checks until the reload is done.', 'Konecranes confirm their engineer was only on crane 11. They are pulling session logs now.', 'Golden image reload is booked for the 14:00 lashing break. I will post the checksum match in #ot-terminals.'] },
    { id: 'm-pkl', kind: 'group', title: '{incId} · incident bridge', with: ['soc', 'hx-soc', 'st3'], cat: 'hexashield', pinned: true, unread: 4, topic: 'Incident with HexaSOC', msgs: [
      ['hx-soc', 'HexaSOC here. {incSev} incident opened: {inc}. Containment is running through the Action Centre; nothing in the OT zones has been touched.', 38, 'inc'],
      ['soc', 'Thanks. Aisha, can you check whether any planned change at the terminals explains this?', 35],
      ['st3', 'Nothing planned. The change calendar is clear for the last 48 hours and no vendor sessions were booked.', 31],
      ['hx-soc', 'Then we treat it as malicious. The same service account authenticated to two other hosts overnight. Recommend resetting it and vaulting it in CyberArk.', 22],
      ['soc', 'Raising the War Room. @{me} you will want to be on the bridge at 10:30.', 14],
      ['hx-soc', 'Bridge is open. HexaCustody is sealing the evidence so chain of custody holds for Beazley.', 6, 'war'],
    ], replies: ['Reset of svc_rtg_hist is queued in the Action Centre; it is medium risk so one approval is enough.', 'No lateral movement towards the RTG drives so far. Dragos-equivalent HexaOT sensors at Port Klang are quiet.', 'Forensic image of PKL-ENG-WS03 is complete; hash recorded in the ledger.'] },
    { id: 'm-csm', kind: 'dm', with: ['hx-csm'], cat: 'hexashield', pinned: true, unread: 1, topic: 'Weekly service review prep', msgs: [
      ['hx-csm', "Morning {me}. Thursday's service review agenda: MDR SLA (99.96%), the Port Klang edge upgrade and HexaOT sensor rollout for Santos phase 2.", 1560],
      ['me', 'Can we also cover the fleet collectors? Three vessels were outside LEO coverage again this week.', 1500],
      ['hx-csm', 'Yes. The data-plane team suggests a 15-minute batch window whenever a vessel is on Starlink. Proposal attached.', 300, undefined, f('Fleet_collector_batching_proposal.pdf', '1.2 MB')],
      ['hx-csm', 'Also, Port Klang edge is still one minor version behind. Support has asked for a 2-hour read-only session to help Aisha upgrade; it is waiting on Tenant Admin approval.', 45, 'conn'],
    ], replies: ['Noted. I will add the Starlink batching decision to Thursday.', 'I have asked Support to propose a maintenance window outside the Port Klang night shift.', 'Your renewal review with Marsh is on the 14th; I can join to walk the underwriter through the live pack.'] },
    { id: 'm-broker', kind: 'dm', with: ['broker'], cat: 'external', unread: 1, topic: 'Renewal evidence pack', msgs: [
      ['broker', "Hi {me}, Beazley's underwriter has questions ahead of renewal in {renewal} days: OT segmentation at the terminals, vendor remote access, and offline backups for Navis N4.", 2880],
      ['me', 'We can evidence all three from HexaView. I will share the live evidence pack rather than PDFs so they see current state.', 2790],
      ['broker', 'Perfect. Can you include the IACS E26/E27 position for the newbuilds? Munich Re are asking about it on the excess layer.', 1440],
      ['me', 'Here is the pack. Vessel controls are in section 4.', 1380, 'pack'],
      ['broker', 'Thanks. One gap they will spot: MFA on the Konecranes jump host still shows as partial. Any ETA?', 90, 'finding'],
    ], replies: ['Understood. If you can share the remediation ticket I will position it as in-flight with a date.', 'Beazley have indicated a flat-to-minus-6% outcome if the jump host MFA lands before binding.', 'I will set up the underwriter meeting; can you and your CSM both attend?'] },
    { id: 'm-auditor', kind: 'dm', with: ['auditor'], cat: 'external', unread: 0, topic: 'ISO 27001 surveillance sampling', msgs: [
      ['auditor', 'Ahead of the ISO 27001 surveillance audit I would like to sample A.8.16 monitoring activities and A.5.19 supplier security.', 4320],
      ['me', 'I can grant you read-only guest access to the evidence for those two controls. Everything is timestamped and hash-chained.', 4200],
      ['auditor', 'That works. I noticed one loop shows as broken for Port Klang. Is that in scope for the sample?', 1800, 'loop'],
      ['me', 'It is; we would rather you see it. The fix is a detection awaiting approval, with evidence attached.', 1740],
    ], replies: ['Thank you, transparency on the broken loop helps. I will note it as an improvement in progress.', 'Can you share the supplier review for Konecranes Remote Services as well?', 'Guest access works fine. Read-only confirmed.'] },
    { id: 'm-board', kind: 'group', title: 'Q4 board cyber update', with: ['board', 'cfo', 'ned'], cat: 'colleague', unread: 0, topic: 'Board pack', msgs: [
      ['board', 'Can the board pack lead with the crane incident and what it would have cost had quay 3 stopped?', 720],
      ['cfo', 'Finance view: one hour of quay 3 downtime is roughly $180k in lost moves plus demurrage exposure.', 690],
      ['me', 'Draft pack attached. The Resilience Index section is cited live from HexaView.', 600, 'report'],
      ['ned', 'Helpful. The Audit & Risk Committee will want to see the renewal position next to the insurability score.', 240],
    ], replies: ['Agreed, I will add the renewal timeline to page 2.', 'Please keep it to six pages; the board will read it on the plane.', 'Thank you. This is much clearer than last quarter.'] },
    { id: 'm-vendor', kind: 'dm', with: ['v1'], cat: 'external', unread: 1, topic: 'Remote access window, crane 11', msgs: [
      ['v1', 'Hello, Konecranes Remote Services here. We need a 3-hour window on crane 11 for the drive firmware update next Tuesday.', 2200],
      ['me', 'Fine, but sessions now go via CyberArk with recording, and only to the crane named in the change.', 2100],
      ['v1', 'Understood. Our engineer will use the new vendor account. Can you confirm the change number?', 200],
    ], replies: ['Thanks, CHG0041877 noted. Our engineer will connect at 09:00 CET.', 'We will send the firmware hash in advance so your OT team can verify it.', 'Confirmed, no access to crane 14 from our side.'] },
    { id: 'm-desk', kind: 'support', title: 'HexaView Support Desk', with: ['hx-desk'], cat: 'hexashield', unread: 0, topic: 'HS-SUP-30392 · Veeam connector drift', msgs: [
      ['hx-desk', 'Hi {me}, Support Desk here. Ticket HS-SUP-30392: the Veeam connector broke after the v12.2 upgrade (renamed field in the job sessions API).', 200],
      ['hx-desk', 'Thanks for approving the read-only session. Mapping fix is deployed to your tenant; next sync in 10 minutes.', 60, 'conn'],
      ['me', 'Great. Will the backup evidence for the three ISO controls refresh automatically?', 50],
      ['hx-desk', 'Yes, as soon as the sync completes. I will close the ticket once the freshness indicators turn green.', 44],
    ], replies: ['Sync completed; backup evidence is fresh again for A.8.13.', 'I have closed the support session early; access revoked and written to the ledger.', 'Anything else I can help with today?'] },
  ],
  finserv: [
    { id: 'f-dora', kind: 'group', title: 'DORA major incident · Payments latency', with: ['grc', 'counsel', 'hx-ir'], cat: 'colleague', pinned: true, unread: 3, tenant: 'pay', topic: 'Initial notification due', msgs: [
      ['grc', 'MI-2026-007 has been classified major under DORA Art. 18: card authorisation latency over impact tolerance for 2 h 10 min. Initial notification clock started at 09:42.', 118, 'war'],
      ['counsel', 'I have the CSSF and FCA templates open. I need the number of clients affected and whether any data was compromised before we file.', 110],
      ['hx-ir', 'IR lead here. No evidence of compromise so far: root cause is a failed certificate rotation on the FIS gateway. HexaSOC confirms no malicious activity in the window.', 92],
      ['grc', 'Affected: 412k authorisation attempts, 38k declined. Draft notification attached for review.', 75, undefined, f('DORA_initial_notification_draft_v3.docx', '86 KB')],
      ['counsel', 'Wording on "no data compromise" should read "no evidence of data compromise at this stage". @{me} can you sign off by 13:30?', 18],
    ], replies: ['Signed off from my side. Please file and post the reference number here.', 'Legal has filed the initial notification. Intermediate report due within 72 hours.', 'FIS have confirmed the certificate chain is fixed; latency back within tolerance.'] },
    { id: 'f-soc', kind: 'dm', with: ['soc'], cat: 'colleague', pinned: true, unread: 2, tenant: 'ukbank', topic: 'Identity incident', msgs: [
      ['soc', 'One for you: {incI}. Sessions were revoked 4 minutes after detection.', 26, 'incI'],
      ['soc', 'No payments were released, but given the access involved I want to clear all sessions and force a hardware-key re-enrolment.', 22],
      ['me', 'Agreed. Is that already in the Action Centre?', 20],
      ['soc', 'Yes, high risk so it needs you as Tenant Admin.', 18, 'act'],
    ], replies: ['Approved on my side. Sam has been called and is re-enrolling with a YubiKey now.', 'Scattered Spider pattern again; HexaInt has linked two lookalike domains to the same kit.', 'SWIFT CSP 4.1 evidence updated automatically after the re-enrolment.'] },
    { id: 'f-csm', kind: 'dm', with: ['hx-csm'], cat: 'hexashield', pinned: true, unread: 1, topic: 'Quarterly business review', msgs: [
      ['hx-csm', 'Hi {me}, QBR date is set for the 21st. Headline: MDR SLA 99.98%, 142 gated actions in 30 days, zero rollbacks on high-risk actions.', 2600],
      ['me', 'Please add the DORA Register of Information work; we still have 31 contracts without an LEI.', 2500],
      ['hx-csm', 'Done. Also flagging that the Veracode connector is being rate limited, which is ageing PCI 6.2 evidence.', 140, 'conn'],
    ], replies: ['I have asked Support to tune the back-off; the access request is in your Administration queue.', 'Our DORA specialist can join the QBR for the register discussion.', 'QBR deck draft will be in your inbox by Friday.'] },
    { id: 'f-broker', kind: 'dm', with: ['broker'], cat: 'external', unread: 1, topic: 'Renewal: ransomware sublimit', msgs: [
      ['broker', 'Morning {me}. AIG want evidence on SWIFT segregation and privileged access before they revisit the ransomware sublimit. Renewal is in {renewal} days.', 3000],
      ['me', 'Sharing the live evidence pack. Section 3 covers the SWIFT secure zone and CyberArk vaulting.', 2900, 'pack'],
      ['broker', 'Thank you. They also noted 14 standing Tier 0 admin accounts. Is there a plan?', 300],
    ], replies: ['A dated plan would help me argue for the higher sublimit.', 'Zurich on the excess layer have accepted the pack as is.', 'I will set up a call with the AIG underwriter next week.'] },
    { id: 'f-audit', kind: 'dm', with: ['auditor'], cat: 'external', unread: 0, topic: 'PCI DSS 4.0.1 ROC fieldwork', msgs: [
      ['auditor', 'For the PCI ROC fieldwork I would like to test requirement 10 logging coverage for the CDE and 6.4.3 script management.', 5000],
      ['me', 'Evidence for both is in HexaView with freshness timestamps. I have shared the loop for logging coverage.', 4900, 'loop'],
      ['auditor', 'Thank you. The critical BOLA finding on the open-banking API: will that be fixed before on-site?', 1300, 'finding'],
    ], replies: ['Understood. I will note the compensating WAF rule and the remediation date.', 'Sampling for 10.2 looks complete. Thank you.', 'Please keep my guest access open until the 30th.'] },
    { id: 'f-board', kind: 'group', title: 'Board Risk Committee pre-read', with: ['board', 'cfo', 'ned'], cat: 'colleague', unread: 0, topic: 'BRC pack', msgs: [
      ['ned', 'For the Board Risk Committee: I want one page on DORA readiness and one on the payments incident.', 900],
      ['cfo', 'Please quantify the payments incident: interchange lost and any customer redress.', 860],
      ['me', 'Pack attached; incident costs are in section 2, cited to the War Room record.', 700, 'report'],
      ['board', 'Thank you. Let us keep the Scattered Spider exposure slide; the FCA asked about it last time.', 300],
    ], replies: ['Agreed, I will add the redress estimate once Payments Ops confirm it.', 'Good work. Please circulate 48 hours before the meeting.', 'Can we show the trend in time to contain alongside peers?'] },
    { id: 'f-vendor', kind: 'dm', with: ['v1'], cat: 'external', unread: 1, topic: 'Leaver evidence, 1,100 named users', msgs: [
      ['v1', 'Hello, Infosys BPM delivery security. Our quarterly leaver attestation for the 1,100 named back-office users is ready.', 1800],
      ['me', 'Thanks. Please upload it to the shared channel rather than email so it lands in TPRM evidence.', 1700],
      ['v1', 'Done. 37 leavers this quarter, all disabled within 24 hours.', 240, undefined, f('Infosys_BPM_leavers_Q3_attestation.pdf', '640 KB')],
    ], replies: ['We can also provide the access review export if needed for DORA.', 'Noted on the LEI request; our legal entity identifier will follow by Friday.', 'Thank you, confirmed received.'] },
    { id: 'f-desk', kind: 'support', title: 'HexaView Support Desk', with: ['hx-desk'], cat: 'hexashield', unread: 0, topic: 'HS-SUP-41107 · Veracode 429s', msgs: [
      ['hx-desk', 'Hi {me}, ticket HS-SUP-41107: Veracode is returning HTTP 429 during the hourly sync. We would like a 2-hour read-only session to tune the back-off.', 40],
      ['me', 'Understood. Owen will approve it in Administration.', 35],
      ['hx-desk', 'Thank you. Nothing changes until the session is approved; I will post results here.', 30, 'conn'],
    ], replies: ['Back-off tuned to 30 s with jitter; next sync succeeded.', 'PCI 6.2 evidence freshness is back within window.', 'Session closed and access revoked.'] },
  ],
  media: [
    { id: 'd-leak', kind: 'group', title: 'Nightjar · locked cut leak', with: ['counsel', 'grc', 'st2'], cat: 'colleague', pinned: true, unread: 4, tenant: 'post', topic: 'Legal hold and containment', msgs: [
      ['grc', 'Nightjar locked cut v7 was copied to a personal cloud from Soho edit bay 4. Session revoked within 3 minutes; forensic watermark KP-NJ-7741 traced to a freelance colourist.', 22, 'custody'],
      ['st2', 'The colourist is on a 3-week contract. Edit bay 4 is locked and the drive is with security.', 19],
      ['counsel', 'Put a legal hold on everything relating to that session now. Please do not contact the colourist; HR and outside counsel will.', 16],
      ['grc', 'Legal hold applied in HexaCustody. The War Room is open with the watermark evidence attached.', 12, 'war'],
      ['counsel', '@{me} I need to know by end of day whether any frames reached a public forum; that decides whether we notify talent under their agreements.', 6],
    ], replies: ['HexaInt dark-web monitoring has no sighting of Nightjar frames so far. Watching 41 forums.', 'Outside counsel has drafted a preservation letter to the cloud provider.', 'Release date is not at risk on current evidence. I will update Jordan.'] },
    { id: 'd-ot', kind: 'dm', with: ['st6'], cat: 'colleague', unread: 1, tenant: 'live', topic: 'Atlanta playout edge', msgs: [
      ['st6', 'HexaOT flagged a firmware mismatch on one iTX playout node in the Atlanta MCR. Grass Valley were on a remote session yesterday.', 300, 'ot'],
      ['me', 'Was it a planned change?', 280],
      ['st6', 'Partly. The ticket covered node 3, not node 5. Also the Atlanta edge agent is degraded, so telemetry is 48 seconds behind.', 260, 'conn'],
    ], replies: ['Grass Valley confirm node 5 was updated by mistake. Same signed build, so no integrity risk.', 'Agent upgrade is booked for Sunday in the maintenance window.', 'We will keep playout on node 3 until the review is done.'] },
    { id: 'd-csm', kind: 'dm', with: ['hx-csm'], cat: 'hexashield', pinned: true, unread: 1, topic: 'Entitlement and TPN+', msgs: [
      ['hx-csm', 'Hi {me}, a heads-up: you are at 18 of 20 integrations on Professional. Two more vendors in the custody chain would hit the cap.', 4300],
      ['me', 'What does Enterprise add for us beyond connectors?', 4200],
      ['hx-csm', 'Unlimited connectors, BYOK and a dedicated stamp. For TPN+ the BYOK piece is the one assessors ask about.', 4100],
      ['hx-csm', 'Separately, the KnowBe4 connector is paused pending key rotation, which is ageing awareness evidence.', 70, 'conn'],
    ], replies: ['I will send a costed comparison before your TPN+ re-assessment.', 'Support can resume KnowBe4 within an hour of your approval.', 'Happy to join your next content security steering group.'] },
    { id: 'd-broker', kind: 'dm', with: ['broker'], cat: 'external', unread: 1, topic: 'Leak extension on renewal', msgs: [
      ['broker', 'Hi {me}, Hiscox want to understand the Nightjar event before quoting the content leak extension. Renewal is in {renewal} days.', 600],
      ['me', 'We can share the containment timeline and the vendor custody evidence. Here is the live pack.', 520, 'pack'],
      ['broker', 'Thanks. The underwriter noted 3 critical findings on the screeners portal. Is there a fix date?', 120, 'finding'],
    ], replies: ['A dated fix would keep the extension on the table.', 'Hiscox appreciated the watermark evidence; it shows the controls worked.', 'Coalition on the excess have no further questions.'] },
    { id: 'd-vendor', kind: 'dm', with: ['v1'], cat: 'external', unread: 2, topic: 'Watermark match, The Long Tide S2', msgs: [
      ['me', "Carmen, stills from The Long Tide S2 appeared on a leak forum. The watermark matches one of Red Fern's review sessions.", 200],
      ['v1', 'That is very concerning. Can you share the session ID? We will pull our access logs straight away.', 180],
      ['me', 'Sharing the custody event. Please keep the session details within this channel.', 170, 'custody'],
      ['v1', 'Our logs show the session was opened from an unmanaged device in Valencia. We have suspended that user.', 35],
    ], replies: ['Our investigation report will be with you within 48 hours as per the TPN agreement.', 'We have enforced managed-device-only access for all Kestrel titles.', 'Our CISO would like to join a call tomorrow.'] },
    { id: 'd-exec', kind: 'group', title: 'Exec: Nightjar release risk', with: ['board', 'st0', 'cfo'], cat: 'colleague', unread: 0, topic: 'Release decision', msgs: [
      ['board', 'Bottom line please: is the Nightjar release date at risk?', 180],
      ['me', 'Not on current evidence. The copy was revoked within 3 minutes and no frames have surfaced. Board update attached.', 150, 'report'],
      ['st0', 'Marketing has paused the trailer drop until we are sure.', 120],
      ['cfo', 'If we had to move the date, what is the exposure? I need a number for the lenders.', 60],
    ], replies: ['I will work with finance on a range; marketing spend at risk is the biggest line.', 'Thank you. Keep me posted twice a day until closed.', 'Trailer drop can resume Friday if nothing surfaces.'] },
    { id: 'd-desk', kind: 'support', title: 'HexaView Support Desk', with: ['hx-desk'], cat: 'hexashield', unread: 0, topic: 'HS-SUP-22040 · custody lineage gap', msgs: [
      ['hx-desk', 'Hi {me}, ticket HS-SUP-22040: we see a lineage gap on transfers to Lumière VFX where their Aspera node does not emit custody events.', 300],
      ['hx-desk', 'Workaround deployed: their transfers are now wrapped by the custody agent at our side. Gap closed for new transfers.', 90],
      ['me', 'Can you backfill the last 7 days?', 80],
    ], replies: ['Backfill complete for 412 transfers; 3 flagged for review.', 'Session closed; access revoked and logged.', 'I have linked the fix to the KB article for other Aspera vendors.'] },
  ],
  healthcare: [
    { id: 'h-epic', kind: 'group', title: 'Epic downtime readiness · Medical Center', with: ['st0', 'st3', 'soc'], cat: 'colleague', pinned: true, unread: 3, tenant: 'mrmc', topic: 'Downtime decision', msgs: [
      ['soc', 'Heads-up from HexaSOC: {incI}. Sessions revoked; Epic access for the account is under review.', 31, 'incI'],
      ['st0', 'From the clinical side: do we need to go to Epic downtime procedures? I need 30 minutes notice for the units.', 28],
      ['st3', 'Epic is healthy. BCA workstations on every unit printed their downtime reports at 06:00 and are current.', 24],
      ['soc', 'No sign the actor reached Epic itself. Recommend staying live and cutting Citrix to managed devices only.', 18, 'war'],
      ['st0', '@{me} I will hold the units on normal operations unless you tell me otherwise by 11:00.', 9],
    ], replies: ['Agreed, stay live. I will confirm at 11:00 after the next HexaSOC update.', 'Citrix managed-device policy is in the Action Centre for approval.', 'Nursing leadership has been briefed via the CNO.'] },
    { id: 'h-biomed', kind: 'dm', with: ['ot'], cat: 'colleague', unread: 1, tenant: 'community', topic: 'Infusion pumps on flat VLAN', msgs: [
      ['ot', 'HexaOT confirms 1,140 infusion pumps and imaging consoles on a flat clinical VLAN at the community hospitals, reachable from the guest Wi-Fi bridge.', 210, 'ot'],
      ['me', 'Can we isolate the guest bridge without touching the pumps?', 190],
      ['ot', 'Yes, it is a network change, not a device change. Medical devices stay read-only by policy. BD also has a patch for the Alaris server.', 170, 'finding'],
    ], replies: ['Change is approved by Biomed. Network team will apply it at 02:00 when census is lowest.', 'Pump library sync tested fine after the change in the lab.', 'FDA 524B paperwork from BD is attached to the vendor record.'] },
    { id: 'h-csm', kind: 'dm', with: ['hx-csm'], cat: 'hexashield', pinned: true, unread: 1, topic: 'HPH CPG roadmap', msgs: [
      ['hx-csm', 'Hi {me}, I have mapped your HHS HPH CPG gaps to HexaView capabilities; 6 of the 10 essential goals are now evidenced live.', 3000],
      ['me', 'The community hospitals edge is still degraded. That will drag the evidence freshness down.', 2900],
      ['hx-csm', 'Agreed. The MPLS link to Marion saturates during PACS transfers. We propose QoS on the collector traffic.', 120, 'conn'],
    ], replies: ['Network team has the QoS template; Support can verify after the change.', 'I will bring the HPH CPG roadmap to the next service review.', 'HITRUST assessor prep session can be booked through me.'] },
    { id: 'h-broker', kind: 'dm', with: ['broker'], cat: 'external', unread: 1, topic: 'Renewal: third-party dependency', msgs: [
      ['broker', 'Hi {me}, Beazley are focused on clearinghouse dependency after last year. What is the plan if Change Healthcare is down again? Renewal is in {renewal} days.', 2000],
      ['me', 'We now have a secondary clearinghouse contracted and tested. Evidence is in the live pack.', 1900, 'pack'],
      ['broker', 'Great. They also want MFA coverage for remote access including Citrix at Zanesville.', 300],
    ], replies: ['That would support a flat renewal despite the market.', 'I will tell the underwriter remediation is in progress with a date.', 'Coalition is fine on the excess layer.'] },
    { id: 'h-privacy', kind: 'dm', with: ['dpo'], cat: 'colleague', unread: 2, topic: 'ChatGPT with patient identifiers', msgs: [
      ['dpo', 'HexaAI found 9 clinicians pasting patient identifiers into ChatGPT. No BAA is in place. I need to run a HIPAA four-factor risk assessment.', 520],
      ['me', 'Agreed. The prompts are retained in Defender; we can give you the exact fields that were shared.', 500],
      ['dpo', 'Please share the closed-loop status for the AI usage control too. I will need it for the OCR file.', 60, 'loop'],
    ], replies: ['Four-factor assessment drafted: low probability of compromise, documented.', 'We will roll out the sanctioned Copilot with a BAA to clinicians next month.', 'Training reminder has gone to the 9 clinicians.'] },
    { id: 'h-board', kind: 'group', title: 'Board Quality & Safety: cyber', with: ['board', 'cfo', 'ned'], cat: 'colleague', unread: 0, topic: 'Board section', msgs: [
      ['ned', 'The committee wants to know how many days we could run on downtime procedures.', 1200],
      ['cfo', 'And the cost per day of an Epic outage. Our last estimate was $1.9M.', 1150],
      ['me', 'Both are in the draft cyber section, cited to the War Room exercise.', 1000, 'report'],
      ['board', 'Good. Please add the infusion pump segmentation progress; it is the patient safety story.', 400],
    ], replies: ['Added; segmentation completes at the community hospitals this month.', 'Thank you, this is clear for a non-technical board.', 'Please include the HPH CPG chart as well.'] },
    { id: 'h-desk', kind: 'support', title: 'HexaView Support Desk', with: ['hx-desk'], cat: 'hexashield', unread: 0, topic: 'HS-SUP-52190 · Epic Clarity schema', msgs: [
      ['hx-desk', 'Hi {me}, ticket HS-SUP-52190: after the Epic upgrade the Clarity extract is late because two audit tables were renamed.', 210],
      ['hx-desk', 'Mapping fixed under the approved session (audit metadata only, no ePHI). Next extract at 14:00.', 80, 'conn'],
      ['me', 'Thanks. Please confirm when FairWarning-equivalent privacy alerts are flowing again.', 70],
    ], replies: ['Privacy alerts are flowing; 3 new cases in the last hour.', 'Support session closed; access revoked and logged.', 'Anything else I can help with?'] },
  ],
  automotive: [
    { id: 'a-line', kind: 'group', title: 'Ingolstadt line stop · body shop L2', with: ['pm', 'st4', 'ot'], cat: 'colleague', pinned: true, unread: 4, tenant: 'ingolstadt', topic: 'Line stop and restart', msgs: [
      ['st4', 'Body shop line 2 stopped at 05:48. KUKA cell 2-14 faulted after a programme change that was not in the change window.', 140, 'ot'],
      ['pm', 'We have lost 47 minutes so far. Each minute on line 2 is about 1.4 cars and €9k. JIS sequence to Bosch and DHL is already adjusting.', 132],
      ['ot', 'HexaOT shows the change came via the KUKA remote service gateway. OT is read-only by policy; no containment from HexaView on the cell. War Room is open.', 120, 'war'],
      ['st4', 'We reloaded the signed backup programme on cell 2-14 and the line restarted at 06:41.', 95],
      ['ot', 'HexaSOC proposes suspending the KUKA remote account until the RCA is done. @{me} it needs your approval.', 40, 'act'],
      ['pm', 'Please do not suspend before the 14:00 shift; we need KUKA for the cell 2-11 recalibration.', 8],
    ], replies: ['Understood. We will scope the suspension to cell 2-14 only, effective after 14:00.', 'KUKA have opened their own investigation; their engineer used a shared account.', 'RCA meeting is booked for tomorrow 09:00 with KUKA.'] },
    { id: 'a-vsoc', kind: 'dm', with: ['st2'], cat: 'colleague', pinned: true, unread: 2, tenant: 'connected', topic: 'OTA signing integrity', msgs: [
      ['st2', 'VSOC check-in: an OTA signing request for 24.9.3 (ADAS) came from a build agent outside the release pipeline.', 220],
      ['st2', 'The HSM rejected it because the request lacked the second approver. R156 control worked as designed.', 210],
      ['me', 'Good. Do we know whose credentials started the request?', 190],
      ['st2', 'A Vector toolchain service account. Tobias has frozen the release train until we rotate it.', 90],
    ], replies: ['Rotation done; release train resumes tonight.', 'Logged as an R155 CSMS event for the type-approval file.', 'No vehicles received an unsigned package.'] },
    { id: 'a-csm', kind: 'dm', with: ['hx-csm'], cat: 'hexashield', pinned: true, unread: 1, topic: 'Air-gapped plant sync', msgs: [
      ['hx-csm', 'Hi {me}, quarterly review is next week. Topics: TISAX AL3 evidence, the air-gapped battery plant sync cadence, and Puebla HexaOT rollout.', 3400],
      ['me', 'Battery plant evidence is always 7 days stale because of the sneakernet transfer. Can we shorten that?', 3300],
      ['hx-csm', 'Yes: a data diode option lets you push signed telemetry out without inbound paths. The SE will send the design.', 160, 'conn'],
    ], replies: ['Data diode design and costs will be with you Friday.', 'TISAX assessor workshop can be scheduled through me.', 'Puebla sensors ship next week.'] },
    { id: 'a-broker', kind: 'dm', with: ['broker'], cat: 'external', unread: 1, topic: 'Renewal: plant BI exposure', msgs: [
      ['broker', 'Guten Morgen {me}. Allianz will ask about business interruption from plant OT after the line stop. Renewal is in {renewal} days.', 900],
      ['me', 'The line was down 53 minutes and restarted from a signed backup. Here is the live evidence pack.', 800, 'pack'],
      ['broker', 'Very helpful. They will also ask how the air-gapped battery plant is evidenced.', 120],
    ], replies: ['A short note from your OT lead on the air gap would be enough.', 'Munich Re on the excess layer are comfortable.', 'I will propose a waiting-period discussion for BI.'] },
    { id: 'a-ip', kind: 'dm', with: ['counsel'], cat: 'colleague', unread: 1, topic: 'Project Lumen renders', msgs: [
      ['counsel', 'HexaCustody says one Lumen design render was opened on an unmanaged device at AutoVision. Is that a breach of the NDA?', 400, 'custody'],
      ['me', 'Possibly; it violates the device clause. The file was revoked within 6 minutes.', 380],
      ['counsel', 'Please preserve the custody trail. I will write to AutoVision today.', 60],
    ], replies: ['Custody trail is under legal hold; ledger hash attached to the matter.', 'AutoVision have confirmed the device was a designer\'s home laptop.', 'Marco has paused external sharing for Lumen until Monday.'] },
    { id: 'a-board', kind: 'group', title: 'Supervisory Board pre-brief', with: ['board', 'cfo', 'ned'], cat: 'colleague', unread: 0, topic: 'Board briefing', msgs: [
      ['ned', 'The Audit Committee wants the line stop explained and the NIS2 reporting position.', 1500],
      ['cfo', 'Cost of the line stop was €480k including JIS penalties. Please use that figure.', 1400],
      ['me', 'Briefing attached; NIS2 early warning was not required as it was below the significance threshold.', 1300, 'report'],
      ['board', 'Fine. Keep the OTA integrity story; it shows the control working.', 500],
    ], replies: ['Will do. I will add one slide on R155 CSMS evidence.', 'Thank you. Clear and short.', 'Please circulate in German and English.'] },
    { id: 'a-desk', kind: 'support', title: 'HexaView Support Desk', with: ['hx-desk'], cat: 'hexashield', unread: 0, topic: 'HS-SUP-63110 · battery plant import', msgs: [
      ['hx-desk', 'Hi {me}, ticket HS-SUP-63110: the weekly signed bundle from the battery plant failed validation because the clock on the export host drifted 9 minutes.', 400],
      ['me', 'Plant IT has resynced NTP. Can you re-import?', 380],
      ['hx-desk', 'Re-imported and validated. Evidence for IEC 62443 SR 6.1 is current again.', 100, 'conn'],
    ], replies: ['Closed. I have added an NTP drift check to the bundle validator.', 'No support session was needed for this one.', 'Anything else today?'] },
  ],
};

const ALT: Record<string, string> = { ciso: 'soc', soc: 'ciso', grc: 'ciso', ot: 'soc', admin: 'ciso' };

/** Map of the signed-in user onto the directory id. */
export function meId(people: CommsPerson[], me: Me): string {
  return people.find((p) => p.name === me.name)?.id ?? 'ciso';
}

function fill(text: string, c: CustomerProfile, me: Me, recs?: Record<CardKey, RecordRef>): string {
  let t = text.replace(/\{me\}/g, firstName(me.name)).replace(/\{renewal\}/g, String(c.insurance.renewalDays));
  if (recs) {
    const sev = recs.inc.sev && recs.inc.sev !== 'info' ? recs.inc.sev : 'open';
    t = t.replace(/\{incSev\}/g, sev.charAt(0).toUpperCase() + sev.slice(1)).replace(/\{incId\}/g, recs.inc.id).replace(/\{incI\}/g, recs.incI.title.replace(/\.$/, '')).replace(/\{inc\}/g, recs.inc.title.replace(/\.$/, ''));
  }
  return t;
}

export function conversations(c: CustomerProfile, tenantId: string, me: Me, people: CommsPerson[]): Conversation[] {
  const mid = meId(people, me);
  const recs = commsRecords(c, tenantId, me);
  const res = (k: string) => (k === 'me' ? mid : k === mid ? ALT[k] ?? 'ciso' : k);
  const seeds = CONV[c.id].filter((s) => tenantId === 'all' || !s.tenant || s.tenant === tenantId || s.kind === 'support' || s.cat === 'hexashield');
  return seeds.map((s) => {
    const members = [...new Set([mid, ...s.with.map(res)])];
    const other = members.filter((m) => m !== mid);
    const title = s.title ? fill(s.title, c, me, recs) : people.find((p) => p.id === other[0])?.name ?? 'Conversation';
    return {
      id: s.id, kind: s.kind, title, members, category: s.cat, pinned: s.pinned, unread: s.unread, tenantId: s.tenant, topic: s.topic, replies: s.replies.map((t) => fill(t, c, me)),
      messages: s.msgs.map(([by, t, min, card, file], i) => ({ id: `${s.id}-${i}`, from: res(by), text: fill(t, c, me, recs), minAgo: min, card: card ? recs[card] : undefined, file })),
    };
  });
}

/* =====================================================================
   Channels
   ===================================================================== */
export type ChannelGroup = 'Functions' | 'Incident & crisis' | 'Executive' | 'Shared with external';
export interface Channel {
  id: string;
  name: string;
  group: ChannelGroup;
  purpose: string;
  members: string[];
  extraMembers: number;
  gate: Licence[];
  gateNote: string;
  sharedWith?: string;
  private?: boolean;
  unread: number;
  messages: Message[];
  replies: string[];
}

interface ChSeed { id: string; name: string; group: ChannelGroup; purpose: string; members: string[]; extra: number; gate: Licence[]; gateNote: string; shared?: string; priv?: boolean; unread: number; msgs: (M | [string, string, number, CardKey | undefined, FileRef | undefined, M[]])[]; replies: string[] }

const OT_CHANNEL: Record<CustomerId, string> = { maritime: 'ot-terminals', finserv: 'dc-facilities', media: 'broadcast-engineering', healthcare: 'biomed-clinical-eng', automotive: 'plant-ot' };
const VENDOR_CHANNEL: Record<CustomerId, string> = { maritime: 'ext-konecranes', finserv: 'ext-infosys-bpm', media: 'ext-red-fern', healthcare: 'ext-bd-alaris', automotive: 'ext-kuka' };

interface ChText { soc: M[]; socThread: M[]; ot: M[]; risk: M[]; ins: M[]; vendor: M[]; board: M[] }
const CH_TEXT: Record<CustomerId, ChText> = {
  maritime: {
    soc: [['bot-soc', 'New {incSev} incident: {inc}. HexaSOC triage started; any containment goes through the Action Centre.', 38, 'inc'], ['an1', 'Picking up the identity side; checking which accounts touched the host.', 30], ['hx-soc', 'HexaSOC: no movement towards the OT zones. Hunting continues across all four terminals.', 21]],
    socThread: [['soc', 'Anything similar at Antwerp or Santos?', 28], ['an2', 'Not so far. Both terminals are quiet in Sentinel.', 25], ['hx-soc', 'Added an analytic rule for the same pattern across the group.', 20]],
    ot: [['bot-ot', 'HexaOT · high: unscheduled PLC programme download to STS crane 14, Maasvlakte quay 3. Read-only by policy.', 96, 'ot'], ['st6', 'Crane 14 is on manual checks. Golden programme reload at the 14:00 lashing break.', 60], ['st4', 'Santos: we see the same Konecranes jump host pattern on RTG 7 last month. Worth checking.', 45]],
    risk: [['bot-comply', 'Loop broken: vendor remote access detection for IEC 62443 SR 1.13 at Port Klang.', 400, 'loop'], ['risk', 'Raising this at Thursday\'s risk committee; it touches our top risk (OT disruption).', 300], ['grc', 'ISO 27001 surveillance audit in 34 days; 27 evidence tasks overdue, 6 at Port Klang.', 200]],
    ins: [['bot-ins', 'Evidence pack refreshed: 21 of 26 controls attested. Gap: MFA on the vendor jump host.', 300, 'pack'], ['broker', 'Thanks all. Beazley will review on Monday.', 200], ['cfo', 'Target is flat or better on premium. Current modelling says minus 6%.', 100]],
    vendor: [['v1', 'Crane 11 drive firmware update scheduled Tuesday 09:00 CET via CyberArk.', 2200, undefined, f('Konecranes_FW_4.2.7_hash.txt', '2 KB')], ['ot', 'Approved for crane 11 only. Session will be recorded.', 2100], ['v1', 'Confirmed. Engineer: M. Virtanen, vendor account kcr-rs-07.', 300]],
    board: [['bot-view', 'Board pack draft is ready for review (14 citations).', 600, 'report'], ['ned', 'Please include the insurer view next to the Resilience Index.', 240]],
  },
  finserv: {
    soc: [['bot-soc', 'New {incSev} incident: {inc}. HexaSOC triage started; any containment goes through the Action Centre.', 26, 'inc'], ['an1', 'Checking whether SWIFT or the card platform is in the blast radius.', 20], ['hx-soc', 'HexaSOC: lookalike aldersgate-secure[.]com hosts a credential kit; takedown requested.', 12]],
    socThread: [['soc', 'Any other business units affected?', 18], ['an2', 'Not so far; Markets and Europe SA are clean.', 15], ['hx-soc', 'Correlation search deployed group-wide for the same indicators.', 10]],
    ot: [['bot-ot', 'HexaOT · medium: UPS bypass engaged at Slough DC1 hall B (BMS). Read-only by policy.', 300, 'ot'], ['ot', 'Planned maintenance by Equinix-side contractor; change ticket matches.', 250], ['st6', 'Mainframe unaffected; z/OS LPARs on hall A.', 200]],
    risk: [['bot-comply', 'Loop partial: logging coverage for PCI DSS 10.2 in the CDE.', 500, 'loop'], ['risk', 'DORA Register of Information still missing 31 LEIs; due to CSSF in January.', 400], ['counsel', 'I will chase the legal entities via procurement.', 300]],
    ins: [['bot-ins', 'Evidence pack refreshed: 24 of 26 controls attested.', 300, 'pack'], ['broker', 'AIG will revisit the ransomware sublimit next week.', 200], ['cfo', 'Board appetite is to keep retention at £5M.', 100]],
    vendor: [['v1', 'Q3 leaver attestation uploaded: 37 leavers, all disabled within 24 h.', 240, undefined, f('Infosys_BPM_leavers_Q3_attestation.pdf', '640 KB')], ['grc', 'Thanks, linked to TPRM evidence for DORA Art. 28.', 200], ['v1', 'LEI for our Indian entity to follow Friday.', 100]],
    board: [['bot-view', 'Board Risk Committee pack draft ready (22 citations).', 700, 'report'], ['ned', 'Please put DORA readiness first.', 300]],
  },
  media: {
    soc: [['bot-soc', 'New {incSev} incident: {inc}. HexaSOC triage started; any containment goes through the Action Centre.', 64, 'inc'], ['an1', 'Checking whether any pre-release content stores are in reach.', 50], ['hx-soc', 'HexaSOC: content vault access logs are clean so far; watermark monitoring raised to high.', 40]],
    socThread: [['soc', 'Is the Soho post network involved?', 48], ['an2', 'No, the Soho content network is isolated and quiet.', 44], ['hx-soc', 'Writing it up for the TPN evidence file as well.', 38]],
    ot: [['bot-ot', 'HexaOT · medium: firmware mismatch on iTX playout node 5, Atlanta MCR. Read-only by policy.', 300, 'ot'], ['st6', 'Grass Valley updated node 5 by mistake. Same signed build.', 250], ['ot', 'Keeping playout on node 3 until the review.', 200]],
    risk: [['bot-comply', 'Loop broken: vendor session watermarking for MPA CSBP DS-4.', 600, 'loop'], ['risk', 'Six tier-1 vendors still missing TPN attestations.', 400], ['grc', 'TPN+ re-assessment in 41 days; 34 tasks overdue.', 300]],
    ins: [['bot-ins', 'Evidence pack refreshed: 18 of 26 controls attested.', 520, 'pack'], ['broker', 'Hiscox will quote the leak extension once Nightjar is closed.', 120], ['cfo', 'Premium increase must stay under 5%.', 60]],
    vendor: [['me', 'Red Fern: watermark on The Long Tide S2 stills matches one of your review sessions.', 200, 'custody'], ['v1', 'User suspended. Unmanaged device in Valencia. Report within 48 h.', 35], ['v1', 'We have enforced managed-device-only access for all Kestrel titles.', 20]],
    board: [['bot-view', 'Content security board update ready (11 citations).', 150, 'report'], ['ned', 'Thank you; please include the vendor attestation status.', 60]],
  },
  healthcare: {
    soc: [['bot-soc', 'New {incSev} incident: {inc}. HexaSOC triage started; medical devices stay read-only by policy.', 31, 'inc'], ['an1', 'Epic audit shows no unusual chart access around the event.', 25], ['hx-soc', 'HexaSOC: hunting for the same indicators across the community hospitals.', 18]],
    socThread: [['soc', 'Any patient-facing systems affected?', 22], ['an2', 'No impact on Epic, PACS or the pump servers so far.', 18], ['hx-soc', 'We will brief the CMIO if that changes.', 14]],
    ot: [['bot-ot', 'HexaOT · high: infusion pumps reachable from guest Wi-Fi bridge, community hospitals. Read-only by policy.', 210, 'ot'], ['st4', 'Network change approved by Biomed for 02:00 tonight.', 150], ['st9', 'PACS transfers to Marion will be paused during the change.', 120]],
    risk: [['bot-comply', 'Loop broken: AI acceptable-use control (HIPAA 164.308) after ChatGPT findings.', 520, 'loop'], ['dpo', 'Four-factor risk assessment in progress.', 400], ['risk', 'HITRUST r2 in 5 months; 31 evidence tasks overdue.', 300]],
    ins: [['bot-ins', 'Evidence pack refreshed: 19 of 26 controls attested.', 1900, 'pack'], ['broker', 'Beazley focused on clearinghouse resilience; secondary is evidenced.', 300], ['cfo', 'We cannot absorb a premium rise above 3% this year.', 200]],
    vendor: [['v1', 'BD here: Alaris server patch 12.3.1 is validated. FDA 524B SBOM attached.', 400, undefined, f('BD_Alaris_12.3.1_SBOM.json', '214 KB')], ['ot', 'Thanks. Lab test booked Thursday; production rollout after.', 300], ['v1', 'Our field engineer is available for the night window.', 100]],
    board: [['bot-view', 'Board Quality & Safety cyber section ready (16 citations).', 1000, 'report'], ['ned', 'Please lead with downtime readiness.', 400]],
  },
  automotive: {
    soc: [['bot-soc', 'New {incSev} incident: {inc}. HexaSOC triage started; plant OT stays read-only by policy.', 220, 'inc'], ['an1', 'Checking whether the vehicle backend or OTA pipeline are in reach.', 200], ['hx-soc', 'HexaSOC: no further activity in the last hour; watching all four plants.', 150]],
    socThread: [['soc', 'Any link to the plants?', 190], ['an2', 'None so far. Ingolstadt and Győr are quiet.', 170], ['hx-soc', 'Logged as a CSMS event candidate for the R155 file.', 160]],
    ot: [['bot-ot', 'HexaOT · high: robot cell programme change outside window, body shop L2 cell 2-14. Read-only by policy.', 140, 'ot'], ['st4', 'Signed backup reloaded; line restarted 06:41.', 95], ['st3', 'Győr: no similar KUKA changes in the last 30 days.', 60]],
    risk: [['bot-comply', 'Loop partial: vendor remote access for IEC 62443 SR 1.13 (body shop).', 500, 'loop'], ['risk', 'TISAX AL3 re-assessment: 23 tasks overdue.', 400], ['grc', 'Data diode proposal would fix battery plant evidence freshness.', 300]],
    ins: [['bot-ins', 'Evidence pack refreshed: 21 of 26 controls attested.', 800, 'pack'], ['broker', 'Allianz will ask about plant BI after the line stop.', 120], ['cfo', 'Retention stays at €10M.', 80]],
    vendor: [['v1', 'KUKA here: our engineer used a shared account on cell 2-14. We apologise; investigation opened.', 200], ['ot', 'Please move to named accounts via the remote access gateway by Friday.', 150], ['v1', 'Agreed. Named accounts issued for all 14 engineers.', 30]],
    board: [['bot-view', 'Supervisory Board briefing ready (19 citations).', 1300, 'report'], ['ned', 'Please provide the German version as well.', 500]],
  },
};

function channelSeeds(c: CustomerProfile): ChSeed[] {
  const t = CH_TEXT[c.id];
  const vendorOrg = ORG[c.id].ext.find((e) => e.key === 'v1')?.org ?? 'Vendor';
  const fw = c.frameworks[0]?.short ?? 'ISO 27001';
  const s0 = t.soc[0];
  const socFirst: ChSeed['msgs'][number] = [s0[0], s0[1], s0[2], s0[3], s0[4], t.socThread];
  return [
    { id: 'soc-operations', name: 'soc-operations', group: 'Functions', purpose: `Day-to-day detection and response with HexaSOC. Bots post new incidents from ${c.connectors.find((k) => k.category === 'SIEM')?.product ?? 'the SIEM'}.`, members: ['soc', 'an1', 'an2', 'approver', 'ciso', 'hx-soc', 'admin'], extra: 14, gate: ['Full', 'Approver', 'HexaShield'], gateNote: 'Full and Approver licences; HexaShield SOC analysts by default', unread: 3, msgs: [socFirst, ...t.soc.slice(1)], replies: ['On it.', 'Agreed, I have added it to the shift handover.', 'HexaSOC has updated the incident timeline.'] },
    { id: OT_CHANNEL[c.id], name: OT_CHANNEL[c.id], group: 'Functions', purpose: 'OT and engineering discussions. HexaOT alerts are posted read-only; no write-back exists for OT by policy.', members: ['ot', 'st4', 'st6', 'st9', 'soc', 'hx-soc'].filter((k) => k !== 'st9' || c.id === 'healthcare'), extra: 9, gate: ['Full', 'Viewer'], gateNote: 'Licensed OT engineers and site leads; guests by invitation', unread: 2, msgs: t.ot, replies: ['Thanks, noted for the shift log.', 'We will confirm after the maintenance window.', 'No impact on operations so far.'] },
    { id: 'risk-committee', name: 'risk-committee', group: 'Executive', purpose: `Risk, GRC and privacy. HexaComply posts loop breaks and audit deadlines (${fw}).`, members: ['grc', 'risk', 'ciso', 'cfo', 'dpo', 'counsel'], extra: 4, gate: ['Full', 'Approver', 'Viewer'], gateNote: 'Licensed colleagues only; no guests', unread: 1, msgs: t.risk, replies: ['Added to the risk register.', 'I will take this to the committee.', 'Owner assigned; due in two weeks.'] },
    { id: 'incident-bridge', name: 'incident-bridge', group: 'Incident & crisis', purpose: 'Private channel for the active major incident. Mirrors the Crisis War Room; legal hold applies.', members: ['ciso', 'soc', 'hx-ir', 'hx-soc', 'counsel', 'breach'], extra: 2, gate: ['Full', 'HexaShield', 'Guest'], gateNote: 'Invite only · breach counsel as guest · legal hold', priv: true, unread: 2, msgs: [['bot-view', 'War Room opened. This channel is under legal hold and mirrored to the audit ledger.', 30, 'war'], ['hx-ir', 'IR retainer engaged. Next update at the top of the hour.', 20], ['breach', 'Please keep privileged analysis in this channel and label it "Privileged & Confidential".', 10]], replies: ['Understood.', 'Update posted to the War Room timeline.', 'Next bridge in 30 minutes.'] },
    { id: 'insurance-renewal', name: 'insurance-renewal', group: 'Shared with external', purpose: `Renewal with ${c.insurance.broker}. Live evidence pack shared; guests see only what is posted here.`, members: ['grc', 'cfo', 'ciso', 'broker', 'claims'], extra: 1, gate: ['Full', 'Viewer', 'Guest'], gateNote: 'Guests: broker and carrier contacts, expire after renewal', shared: c.insurance.broker, unread: 1, msgs: t.ins, replies: ['Thanks, received.', 'I will share this with the underwriter.', 'Noted for the renewal meeting.'] },
    { id: 'board-updates', name: 'board-updates', group: 'Executive', purpose: 'Board and executive updates, cited from HexaView.', members: ['board', 'ned', 'cfo', 'ciso'], extra: 6, gate: ['Full', 'Viewer'], gateNote: 'Board, executives and the CISO; no guests', unread: 0, msgs: t.board, replies: ['Thank you.', 'Noted.', 'Please send the final by Friday.'] },
    { id: VENDOR_CHANNEL[c.id], name: VENDOR_CHANNEL[c.id], group: 'Shared with external', purpose: `Shared channel with ${vendorOrg}. Guests cannot see any other channel or HexaView data.`, members: ['v1', 'ot', 'grc', 'admin'], extra: 2, gate: ['Full', 'Guest'], gateNote: `Guests from ${vendorOrg} only; 30-90 day expiry`, shared: vendorOrg, unread: 1, msgs: t.vendor, replies: ['Thanks, confirmed.', 'We will update you tomorrow.', 'Received.'] },
    { id: 'hexashield-service', name: 'hexashield-service', group: 'Shared with external', purpose: 'Your shared channel with HexaShield: service notices, releases and the CSM.', members: ['admin', 'ciso', 'hx-csm', 'hx-desk', 'hx-se'], extra: 3, gate: ['Full', 'HexaShield'], gateNote: 'HexaShield staff; no data access from this channel', shared: 'HexaShield', unread: 1, msgs: [['bot-view', 'HexaView 3.4 is live on your stamp: Communications Hub, faster loop evaluation, new OT read-only views.', 2880], ['hx-desk', 'Maintenance on the control plane Sunday 02:00 to 03:00 UTC. Data planes are unaffected.', 1440], ['hx-csm', 'Service review on Thursday; agenda is pinned.', 300]], replies: ['Thanks for the notice.', 'HexaShield will confirm completion here.', 'Noted.'] },
  ];
}

export function channels(c: CustomerProfile, me: Me, people: CommsPerson[]): Channel[] {
  const mid = meId(people, me);
  const recs = commsRecords(c, 'all', me);
  const res = (k: string) => (k === 'me' ? mid : k);
  const exists = (k: string) => k.startsWith('bot-') || people.some((p) => p.id === k);
  const toMsg = (id: string, i: number, m: ChSeed['msgs'][number]): Message => {
    const [by, t, min, card, file, thread] = m as [string, string, number, CardKey | undefined, FileRef | undefined, M[] | undefined];
    return {
      id: `${id}-${i}`, from: res(by), text: fill(t, c, me, recs), minAgo: min, card: card ? recs[card] : undefined, file,
      thread: thread?.map((x, j) => ({ id: `${id}-${i}-t${j}`, from: res(x[0]), text: fill(x[1], c, me), minAgo: x[2] })),
    };
  };
  return channelSeeds(c).map((s) => ({
    id: s.id, name: s.name, group: s.group, purpose: s.purpose, members: s.members.filter(exists), extraMembers: s.extra, gate: s.gate, gateNote: s.gateNote, sharedWith: s.shared, private: s.priv, unread: s.unread,
    messages: s.msgs.map((m, i) => toMsg(s.id, i, m)), replies: s.replies,
  }));
}

/* =====================================================================
   HexaShield Support
   ===================================================================== */
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export const PRIORITY_META: Record<Priority, { label: string; color: string; responseMin: number; resolveMin: number }> = {
  P1: { label: 'P1 · Critical', color: '#f0466e', responseMin: 15, resolveMin: 240 },
  P2: { label: 'P2 · High', color: '#ff6b4f', responseMin: 60, resolveMin: 480 },
  P3: { label: 'P3 · Medium', color: '#f5a83d', responseMin: 240, resolveMin: 2880 },
  P4: { label: 'P4 · Low', color: '#8593b4', responseMin: 1440, resolveMin: 7200 },
};
export type TicketStatus = 'New' | 'In progress' | 'Awaiting you' | 'Resolved';
export interface Ticket {
  id: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
  openedMin: number;
  respondedMin: number;
  owner: string;
  category: string;
  raisedBy: string;
  path?: string;
  needsAccess?: boolean;
  updates: { minAgo: number; by: string; text: string }[];
}

const EXTRA_TICKETS: Record<CustomerId, Omit<Ticket, 'id' | 'owner' | 'updates'>[]> = {
  maritime: [
    { title: 'Fleet collectors: 3 vessels missing LEO window data', priority: 'P2', status: 'In progress', openedMin: 300, respondedMin: 22, category: 'Data plane', raisedBy: 'admin', path: '/fabric/dataplanes' },
    { title: 'Report builder: board pack logo renders blurred in PDF', priority: 'P4', status: 'Awaiting you', openedMin: 4200, respondedMin: 300, category: 'Reports', raisedBy: 'grc', path: '/reports/library' },
    { title: 'Request: add Navis N4 crane events to OT asset context', priority: 'P3', status: 'New', openedMin: 90, respondedMin: 0, category: 'Feature request', raisedBy: 'ot' },
  ],
  finserv: [
    { title: 'DORA incident report export: CSSF template field mapping', priority: 'P2', status: 'In progress', openedMin: 95, respondedMin: 18, category: 'War Room', raisedBy: 'grc', path: '/ops/warroom' },
    { title: 'SSO: Entra group sync delayed for new joiners', priority: 'P3', status: 'Awaiting you', openedMin: 2600, respondedMin: 120, category: 'Identity & access', raisedBy: 'admin', path: '/ops/admin' },
    { title: 'Request: DORA Register of Information export in ITS format', priority: 'P4', status: 'New', openedMin: 400, respondedMin: 0, category: 'Feature request', raisedBy: 'risk' },
  ],
  media: [
    { title: 'Atlanta broadcast edge agent stuck on 1.8.9', priority: 'P2', status: 'In progress', openedMin: 330, respondedMin: 31, category: 'Data plane', raisedBy: 'admin', path: '/fabric/dataplanes' },
    { title: 'Custody revocation latency above 2 min for Soho', priority: 'P2', status: 'In progress', openedMin: 140, respondedMin: 12, category: 'HexaCustody', raisedBy: 'grc', path: '/custody/revocation' },
    { title: 'Request: TPN+ questionnaire auto-fill from evidence', priority: 'P4', status: 'New', openedMin: 3000, respondedMin: 0, category: 'Feature request', raisedBy: 'grc' },
  ],
  healthcare: [
    { title: 'Community hospitals edge: MPLS saturation during PACS transfers', priority: 'P2', status: 'In progress', openedMin: 395, respondedMin: 25, category: 'Data plane', raisedBy: 'admin', path: '/fabric/dataplanes' },
    { title: 'Board report: HPH CPG chart missing two goals', priority: 'P3', status: 'Awaiting you', openedMin: 2000, respondedMin: 200, category: 'Reports', raisedBy: 'grc', path: '/reports/library' },
    { title: 'Request: Joint Commission EM.02.01.01 downtime evidence mapping', priority: 'P4', status: 'New', openedMin: 300, respondedMin: 0, category: 'Feature request', raisedBy: 'risk' },
  ],
  automotive: [
    { title: 'Battery plant bundle failed validation (clock drift)', priority: 'P2', status: 'Resolved', openedMin: 400, respondedMin: 9, category: 'Data plane', raisedBy: 'admin', path: '/fabric/dataplanes' },
    { title: 'VSOC: vehicle telemetry ingest lag above 5 min', priority: 'P1', status: 'In progress', openedMin: 55, respondedMin: 6, category: 'Data plane', raisedBy: 'soc', path: '/fabric/dataplanes' },
    { title: 'Request: UNECE R155 CSMS report template', priority: 'P4', status: 'New', openedMin: 3100, respondedMin: 0, category: 'Feature request', raisedBy: 'grc' },
  ],
};

export function supportTickets(c: CustomerProfile, people: CommsPerson[]): { tickets: Ticket[]; sessions: SupportSession[] } {
  const r = rng(`comms-tickets-${c.id}`);
  const desk = people.find((p) => p.id === 'hx-desk')?.name ?? 'Support Desk';
  const se = people.find((p) => p.id === 'hx-se')?.name ?? 'Solutions Engineer';
  const sessions = supportSessions(c);
  const fromSessions: Ticket[] = sessions.filter((s) => s.status !== 'denied').map((s) => ({
    id: s.ticket, title: s.reason, priority: s.status === 'pending' ? 'P2' : 'P3', status: s.status === 'closed' ? 'Resolved' : s.status === 'pending' ? 'Awaiting you' : 'In progress',
    openedMin: s.requestedMinAgo + r.int(10, 60), respondedMin: r.int(5, 40), owner: s.engineer.replace(/\s*\(HexaShield\)/, ''), category: 'Connector / data plane', raisedBy: 'admin', path: s.status === 'pending' ? '/ops/admin' : '/fabric/integrations', needsAccess: s.status === 'pending',
    updates: [
      { minAgo: s.requestedMinAgo, by: s.engineer.replace(/\s*\(HexaShield\)/, ''), text: `Requested ${s.durationH} h support session: ${s.scope}` },
      ...(s.approvedBy ? [{ minAgo: Math.max(1, s.requestedMinAgo - 15), by: s.approvedBy, text: 'Approved support session (read-only, recorded)' }] : []),
    ],
  }));
  const extras: Ticket[] = EXTRA_TICKETS[c.id].map((t) => ({
    ...t, id: `HS-SUP-${r.int(30000, 69999)}`, owner: t.category === 'Feature request' ? se : desk,
    updates: [{ minAgo: t.openedMin, by: people.find((p) => p.id === t.raisedBy)?.name ?? 'You', text: 'Ticket raised from HexaView' }, ...(t.respondedMin ? [{ minAgo: t.openedMin - t.respondedMin, by: desk, text: 'Acknowledged; investigating' }] : [])],
  }));
  return { tickets: [...extras, ...fromSessions].sort((a, b) => (a.status === 'Resolved' ? 1 : 0) - (b.status === 'Resolved' ? 1 : 0) || a.priority.localeCompare(b.priority)), sessions };
}

export interface ServiceComponent { name: string; status: 'Operational' | 'Degraded' | 'Maintenance'; uptime: number; note?: string }
export function serviceStatus(c: CustomerProfile): ServiceComponent[] {
  const dp = c.dataPlanes.filter((d) => d.status !== 'healthy');
  return [
    { name: `HexaView portal (${c.stamp})`, status: 'Operational', uptime: 99.99 },
    { name: 'HexaCore API & canonical model', status: 'Operational', uptime: 99.98 },
    { name: 'HexaSOC 24×7 operations', status: 'Operational', uptime: 100 },
    { name: 'Action Centre dispatch & signing', status: 'Operational', uptime: 99.99 },
    { name: 'Connector framework', status: 'Operational', uptime: 99.95 },
    { name: `Customer data planes (${c.dataPlanes.length})`, status: dp.length ? 'Degraded' : 'Operational', uptime: dp.length ? 99.71 : 99.97, note: dp.length ? `${dp.map((d) => d.name).join(', ')}: ${dp[0].note ?? 'heartbeat delayed'}` : undefined },
    { name: 'Reports & notifications', status: 'Maintenance', uptime: 99.96, note: 'Scheduled Sunday 02:00 to 03:00 UTC' },
    { name: 'Communications Hub', status: 'Operational', uptime: 99.99 },
  ];
}

export const KB_ARTICLES: { title: string; cat: string; mins: number }[] = [
  { title: 'Approving a HexaShield support session (Tenant Admin)', cat: 'Access', mins: 3 },
  { title: 'Upgrading an on-prem data plane agent without downtime', cat: 'Data planes', mins: 6 },
  { title: 'Why a connector shows "stale" and how freshness is calculated', cat: 'Connectors', mins: 4 },
  { title: 'Risk classes and approvals for write-back actions', cat: 'Action Centre', mins: 5 },
  { title: 'Inviting external guests safely (licences, expiry, channels)', cat: 'Communications', mins: 4 },
  { title: 'Exporting the audit ledger for an auditor', cat: 'Audit', mins: 3 },
  { title: 'OT read-only policy: what HexaView will never do', cat: 'HexaOT', mins: 2 },
];

export function sectorKb(c: CustomerProfile): { title: string; cat: string; mins: number }[] {
  const m: Record<CustomerId, { title: string; cat: string; mins: number }[]> = {
    maritime: [{ title: 'Vessel edge collectors: store-and-forward over VSAT/LEO', cat: 'Fleet', mins: 5 }, { title: 'Mapping IACS UR E26/E27 to HexaView loops', cat: 'Compliance', mins: 7 }],
    finserv: [{ title: 'DORA major-incident reporting from the War Room', cat: 'Regulatory', mins: 6 }, { title: 'SWIFT CSCF evidence from Alliance Access logs', cat: 'Compliance', mins: 5 }],
    media: [{ title: 'Forensic watermark tracing with HexaCustody', cat: 'Custody', mins: 5 }, { title: 'TPN+ evidence mapping and vendor attestations', cat: 'Compliance', mins: 6 }],
    healthcare: [{ title: 'Medical device read-only monitoring and FDA 524B evidence', cat: 'HexaOT', mins: 6 }, { title: 'HHS HPH CPGs: essential goals evidence map', cat: 'Compliance', mins: 5 }],
    automotive: [{ title: 'Air-gapped plant: signed bundle import and validation', cat: 'Data planes', mins: 6 }, { title: 'UNECE R155/R156 evidence from the vehicle SOC', cat: 'Compliance', mins: 7 }],
  };
  return [...m[c.id], ...KB_ARTICLES];
}

/* =====================================================================
   Calls & bridges
   ===================================================================== */
export type CallKind = 'incident' | 'service' | 'risk' | 'insurance' | 'board' | 'vendor';
export const CALL_META: Record<CallKind, { label: string; color: string }> = {
  incident: { label: 'Incident bridge', color: '#f0466e' },
  service: { label: 'HexaShield service', color: '#e879f9' },
  risk: { label: 'Risk committee', color: '#3ad0ae' },
  insurance: { label: 'Insurance', color: '#2ec4a8' },
  board: { label: 'Board', color: '#79a5f5' },
  vendor: { label: 'Vendor', color: '#f5a83d' },
};
export interface ActionItem { text: string; owner: string; path: string; dueDays: number; done?: boolean }
export interface Call {
  id: string;
  title: string;
  kind: CallKind;
  status: 'live' | 'scheduled' | 'ended';
  /** Minutes from now: negative = started/ended that long ago. */
  startMin: number;
  durationMin: number;
  host: string;
  participants: string[];
  external: boolean;
  card?: RecordRef;
  recording?: { lengthMin: number; summary: string; decisions: string[]; actions: ActionItem[] };
}

const REC_TEXT: Record<CustomerId, { title: string; kind: CallKind; daysAgo: number; members: string[]; summary: string; decisions: string[]; actions: [string, string, string, number][] }[]> = {
  maritime: [
    { title: 'Weekly service review with HexaShield', kind: 'service', daysAgo: 7, members: ['ciso', 'admin', 'hx-csm', 'hx-se'], summary: 'MDR SLA held at 99.96%. Port Klang edge upgrade agreed for next week. Santos HexaOT phase 2 sensors shipped; installation waits on a crane maintenance window.', decisions: ['Move fleet collectors to a 15-minute batch on Starlink', 'Approve Port Klang upgrade window (Sunday 02:00 MYT)'], actions: [['Approve Port Klang support session', 'admin', '/ops/admin', 2], ['Confirm Santos install window', 'ot', '/ot/sites', 5], ['Review fleet data-plane batching', 'admin', '/fabric/dataplanes', 7]] },
    { title: 'Post-incident review: Antwerp phishing wave', kind: 'incident', daysAgo: 12, members: ['soc', 'hx-soc', 'hx-ir', 'an1'], summary: 'Contained in 41 minutes. 3 users clicked; no credentials used. Detection gap for QR-code phishing identified and closed with a new rule.', decisions: ['Keep the QR-code rule in production', 'Run awareness refresh at Antwerp'], actions: [['Validate QR-code detection loop', 'an2', '/loop', 3], ['Close incident and attach PIR', 'soc', '/soc/ir', 1]] },
    { title: 'Renewal kick-off with Marsh', kind: 'insurance', daysAgo: 20, members: ['grc', 'cfo', 'broker'], summary: 'Underwriters will focus on OT segmentation, vendor remote access and offline backups. Live evidence pack accepted in place of a questionnaire.', decisions: ['Share live pack instead of PDFs', 'Target binding 14 days before expiry'], actions: [['Close jump host MFA gap', 'ot', '/strike/pentest', 21], ['Refresh evidence pack', 'grc', '/insurance/pack', 7]] },
  ],
  finserv: [
    { title: 'Quarterly service review with HexaShield', kind: 'service', daysAgo: 6, members: ['ciso', 'admin', 'hx-csm', 'hx-se'], summary: '142 gated actions in 30 days with zero high-risk rollbacks. Veracode rate limiting is ageing PCI evidence. DORA register work scoped.', decisions: ['Tune Veracode back-off under a support session', 'HexaShield DORA specialist to join register workshop'], actions: [['Approve Veracode support session', 'admin', '/ops/admin', 1], ['Chase 31 missing LEIs', 'risk', '/comply/tprm', 30]] },
    { title: 'Post-incident review: payments latency', kind: 'incident', daysAgo: 1, members: ['grc', 'counsel', 'hx-ir', 'soc'], summary: 'Root cause: failed certificate rotation on the FIS gateway. No compromise. DORA initial notification filed on time; intermediate report due in 72 hours.', decisions: ['Add certificate expiry monitoring for third-party gateways', 'File intermediate report Thursday'], actions: [['Draft DORA intermediate report', 'grc', '/ops/warroom', 2], ['Deploy certificate expiry rule', 'an2', '/soc/detection', 5], ['Update FIS contract obligations', 'counsel', '/comply/tprm', 14]] },
    { title: 'Renewal call with Aon and AIG', kind: 'insurance', daysAgo: 15, members: ['grc', 'cfo', 'broker', 'claims'], summary: 'AIG wants SWIFT segregation and Tier 0 admin evidence before revisiting the ransomware sublimit.', decisions: ['Vault the 14 standing Tier 0 accounts before binding'], actions: [['Vault Tier 0 accounts in CyberArk', 'admin', '/fabric/identity', 21], ['Refresh evidence pack', 'grc', '/insurance/pack', 7]] },
  ],
  media: [
    { title: 'Service review with HexaShield', kind: 'service', daysAgo: 8, members: ['ciso', 'admin', 'hx-csm'], summary: 'Integration entitlement at 18 of 20. Enterprise tier discussed for BYOK ahead of TPN+. Atlanta agent upgrade slipped to the next maintenance window.', decisions: ['Prepare Enterprise tier comparison', 'Upgrade Atlanta agent Sunday'], actions: [['Review Enterprise proposal', 'ciso', '/ops/services', 10], ['Approve KnowBe4 support session', 'admin', '/ops/admin', 1]] },
    { title: 'Leak response: Nightjar day 1', kind: 'incident', daysAgo: 0, members: ['counsel', 'grc', 'st2', 'hx-ir'], summary: 'Copy revoked within 3 minutes; watermark traced; legal hold applied. No public sighting. Talent notification not yet required.', decisions: ['Pause trailer drop until Friday', 'Outside counsel to send preservation letter'], actions: [['Monitor leak forums twice daily', 'risk', '/int/darkweb', 3], ['Prepare talent notification draft', 'counsel', '/ops/warroom', 2]] },
    { title: 'Red Fern vendor escalation', kind: 'vendor', daysAgo: 2, members: ['grc', 'v1', 'risk'], summary: 'Red Fern confirmed an unmanaged device opened a review session. User suspended; managed-device-only now enforced.', decisions: ['Require Red Fern report within 48 h', 'Re-score Red Fern in TPRM'], actions: [['Re-assess Red Fern vendor risk', 'risk', '/comply/tprm', 7], ['Verify watermark coverage for all review links', 'grc', '/custody/lineage', 5]] },
  ],
  healthcare: [
    { title: 'Service review with HexaShield', kind: 'service', daysAgo: 7, members: ['ciso', 'admin', 'hx-csm', 'hx-se'], summary: '6 of 10 HPH CPG essential goals evidenced live. Community hospitals edge degraded by MPLS saturation; QoS proposed.', decisions: ['Apply QoS to collector traffic', 'Plan HITRUST assessor walkthrough'], actions: [['Apply QoS template on Marion link', 'admin', '/fabric/dataplanes', 7], ['Book HITRUST prep', 'grc', '/comply/caas', 14]] },
    { title: 'Downtime tabletop with HexaShield IR', kind: 'incident', daysAgo: 25, members: ['ciso', 'st0', 'st3', 'hx-ir'], summary: 'Simulated Epic outage. Units could run 72 hours on downtime procedures; pharmacy dispensing was the weakest link.', decisions: ['Add Omnicell offline mode to downtime kit', 'Repeat tabletop in Q1'], actions: [['Update downtime runbook', 'st3', '/comply/continuity', 30], ['Validate BCA workstation loop', 'soc', '/loop', 14]] },
    { title: 'Renewal call with Gallagher', kind: 'insurance', daysAgo: 18, members: ['grc', 'cfo', 'broker'], summary: 'Beazley focused on clearinghouse resilience and remote access MFA. Secondary clearinghouse evidence accepted.', decisions: ['Close Citrix MFA gap before binding'], actions: [['Enforce MFA on Zanesville Citrix', 'admin', '/fabric/exposure', 14], ['Refresh evidence pack', 'grc', '/insurance/pack', 7]] },
  ],
  automotive: [
    { title: 'Quarterly review with HexaShield', kind: 'service', daysAgo: 9, members: ['ciso', 'admin', 'hx-csm', 'hx-se'], summary: 'TISAX AL3 evidence on track. Battery plant evidence always 7 days stale; data diode option proposed. Puebla HexaOT rollout next month.', decisions: ['Evaluate data diode for battery plant', 'Ship Puebla sensors'], actions: [['Review data diode design', 'ot', '/fabric/dataplanes', 14], ['Confirm Puebla install dates', 'st3', '/ot/sites', 10]] },
    { title: 'Line stop RCA with KUKA', kind: 'vendor', daysAgo: 0, members: ['ot', 'st4', 'pm', 'v1'], summary: 'KUKA engineer used a shared account on cell 2-14 outside the change window. Line restarted from signed backup after 53 minutes.', decisions: ['Named accounts for all KUKA engineers', 'Change window enforced at the gateway'], actions: [['Approve scoped KUKA suspension', 'ciso', '/ops/actions', 1], ['Add gateway change-window policy', 'ot', '/ot/network', 7], ['Update vendor risk for KUKA', 'risk', '/comply/tprm', 14]] },
    { title: 'Renewal call with Aon and Allianz', kind: 'insurance', daysAgo: 14, members: ['grc', 'cfo', 'broker', 'claims'], summary: 'Allianz focused on plant business interruption and OTA integrity. Air-gap evidence requested.', decisions: ['OT lead to write air-gap note'], actions: [['Write air-gap evidence note', 'ot', '/insurance/pack', 7], ['Refresh evidence pack', 'grc', '/insurance/pack', 7]] },
  ],
};

/** Minutes from now until a local clock time `days` days away (negative days = past). */
function at(days: number, hour: number): number {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return Math.round((d.getTime() - Date.now()) / 60000);
}

/** Days until the next given weekday (0 = Sunday), 1-7 days ahead. */
function nextDow(dow: number): number {
  const d = (dow - new Date().getDay() + 7) % 7;
  return d === 0 ? 7 : d;
}

export function calls(c: CustomerProfile, me: Me, people: CommsPerson[]): Call[] {
  const mid = meId(people, me);
  const recs = commsRecords(c, 'all', me);
  const res = (k: string) => (k === mid ? ALT[k] ?? k : k);
  const ok = (ks: string[]) => [...new Set([mid, ...ks.map(res)])].filter((k) => people.some((p) => p.id === k));
  const war = SECTOR_REC[c.id].war[0];
  const live: Call[] = [
    { id: 'call-live', title: `Incident bridge · ${war}`, kind: 'incident', status: 'live', startMin: -18, durationMin: 60, host: 'hx-ir', participants: ok(['soc', 'hx-ir', 'hx-soc', 'an1', 'counsel']), external: false, card: recs.war },
    { id: 'call-svc', title: 'Weekly service review with HexaShield', kind: 'service', status: 'scheduled', startMin: at(nextDow(4), 10), durationMin: 45, host: 'hx-csm', participants: ok(['admin', 'hx-csm', 'hx-se']), external: true },
    { id: 'call-risk', title: 'Risk committee', kind: 'risk', status: 'scheduled', startMin: at(nextDow(2), 14), durationMin: 60, host: 'risk', participants: ok(['grc', 'risk', 'cfo', 'counsel', 'dpo']), external: false, card: recs.loop },
    { id: 'call-ins', title: `Insurance renewal meeting with ${c.insurance.broker}`, kind: 'insurance', status: 'scheduled', startMin: at(nextDow(3), 15), durationMin: 60, host: 'grc', participants: ok(['grc', 'cfo', 'broker', 'claims', 'hx-csm']), external: true, card: recs.pack },
    { id: 'call-board', title: 'Board pre-brief', kind: 'board', status: 'scheduled', startMin: at(nextDow(5), 9), durationMin: 30, host: mid, participants: ok(['board', 'ned', 'cfo']), external: false, card: recs.report },
    { id: 'call-vendor', title: `Vendor sync · ${ORG[c.id].ext.find((e) => e.key === 'v1')?.org}`, kind: 'vendor', status: 'scheduled', startMin: at(nextDow(1), 11), durationMin: 30, host: 'ot', participants: ok(['ot', 'v1', 'grc']), external: true },
  ];
  const past: Call[] = REC_TEXT[c.id].map((rr, i) => ({
    id: `rec-${i}`, title: rr.title, kind: rr.kind, status: 'ended', startMin: rr.daysAgo === 0 ? -150 - i * 60 : at(-rr.daysAgo, 10 + i * 2), durationMin: [45, 38, 52][i] ?? 40, host: rr.members[0] === mid ? res(rr.members[0]) : rr.members[0], participants: ok(rr.members), external: rr.members.some((m) => m.startsWith('hx-') || ['broker', 'claims', 'v1', 'auditor', 'breach'].includes(m)),
    recording: { lengthMin: [44, 37, 51][i] ?? 40, summary: rr.summary, decisions: rr.decisions, actions: rr.actions.map(([text, owner, path, due], j) => ({ text, owner: res(owner), path, dueDays: due, done: j === 0 && rr.daysAgo > 5 })) },
  }));
  return [...live, ...past];
}

/* =====================================================================
   Local time helper
   ===================================================================== */
export function localTime(offset: number): string {
  const d = new Date(Date.now() + (offset * 60 + new Date().getTimezoneOffset()) * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
