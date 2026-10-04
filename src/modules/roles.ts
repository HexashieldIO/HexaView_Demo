import type { CustomerProfile, Persona, Person } from '../data/types';

// Role-based user profiles. Each role has a landing page, a workspace of
// shortcuts (sidebar + Command Centre), the person it signs in as for the
// selected customer, its licence, what it may do and which modules it sees.

export type RoleGroup = 'Master' | 'Leadership' | 'Security operations' | 'Governance & risk' | 'Engineering & platform';

export interface RoleDef {
  id: Persona;
  label: string;
  group: RoleGroup;
  description: string;
  landing: string;
  workspace: [string, string][];
  person: (c: CustomerProfile) => Person;
  /** Profile title shown instead of the person's job title (e.g. Master user). */
  title?: string;
  licence: 'Master (Admin)' | 'Full' | 'Approver' | 'Analyst' | 'Viewer';
  /** Approval and administration rights (LLD 8.2 / 10.2). */
  rights: string[];
  /** Module ids this role works in; 'all' = every module. */
  access: 'all' | string[];
}

const findStaff = (c: CustomerProfile, re: RegExp): Person | undefined => c.people.staff.find((p) => re.test(p.role));

export const ROLES: RoleDef[] = [
  {
    id: 'master', label: 'Master user (Admin)', group: 'Master', title: 'Master user (Admin)',
    description: 'Unrestricted: every module, every tenant, every setting and approval',
    landing: '/',
    workspace: [['Command Centre', '/'], ['Users, roles & licences', '/ops/admin'], ['Action Centre', '/ops/actions'], ['Integrations', '/fabric/integrations'], ['Audit ledger', '/ops/audit'], ['Notifications', '/ops/notifications']],
    person: (c) => c.rolePeople?.master ?? c.people.admin,
    licence: 'Master (Admin)',
    rights: ['See every module and tenant', 'Approve low, medium and high-risk write-back (as Tenant Admin)', 'Enable or disable action types per tenant', 'Invite users, assign roles and licences', 'Approve HexaShield support access', 'Manage SSO, MFA, BYOK and data planes', 'Configure integrations and notification policy', 'Export the audit ledger and evidence'],
    access: 'all',
  },
  {
    id: 'executive', label: 'Board & executive', group: 'Leadership',
    description: 'Resilience Index, top risks and financial exposure in plain English',
    landing: '/board',
    workspace: [['Board view', '/board'], ['Cyber insurance', '/insurance/overview'], ['Board pack (draft, cited)', '/reports/library'], ['Peer benchmark', '/ops/benchmark']],
    person: (c) => c.rolePeople?.executive ?? c.people.board,
    licence: 'Viewer',
    rights: ['Read-only summaries', 'Approve board reports for release'],
    access: ['trust', 'programme', 'command', 'board', 'loop', 'aisec', 'insurance', 'reports', 'ops', 'comms'],
  },
  {
    id: 'ciso', label: 'CISO / Head of security', group: 'Leadership',
    description: 'The whole estate: every capability, tenant and integration',
    landing: '/',
    workspace: [['Command Centre', '/'], ['Closed-loop assurance', '/loop'], ['Action Centre', '/ops/actions'], ['Tool scorecard', '/ops/scorecard'], ['Communications Hub', '/comms/inbox']],
    person: (c) => c.rolePeople?.ciso ?? c.people.ciso,
    licence: 'Full',
    rights: ['See every module and tenant', 'Approve low, medium and high-risk write-back', 'Approve board and regulator reports', 'Approve HexaShield support access'],
    access: 'all',
  },
  {
    id: 'finance', label: 'CFO, finance & insurance', group: 'Leadership',
    description: 'Loss in money, premium impact, renewal and tool spend',
    landing: '/insurance/overview',
    workspace: [['Insurability', '/insurance/overview'], ['Risk quantification', '/insurance/quantification'], ['Policy & renewal', '/insurance/policy'], ['Tool scorecard (cost)', '/ops/scorecard'], ['Pipeline & cost', '/fabric/pipeline']],
    person: (c) => c.rolePeople?.finance ?? findStaff(c, /CFO|Financial Officer|Finance/i) ?? c.people.board,
    licence: 'Viewer',
    rights: ['Read-only', 'Share insurer evidence packs with the broker'],
    access: ['programme', 'command', 'board', 'insurance', 'reports', 'ops', 'fabric', 'comms'],
  },
  {
    id: 'socmanager', label: 'SOC manager', group: 'Security operations',
    description: 'SLAs, queues, detections and the team running them',
    landing: '/soc/mdr',
    workspace: [['SOC overview', '/soc/mdr'], ['Incidents', '/soc/ir?status=open'], ['Detection engineering', '/soc/detection'], ['Agentic SOC dial', '/ai/agents'], ['Approvals inbox', '/ops/actions']],
    person: (c) => c.rolePeople?.socmanager ?? c.people.socLead,
    licence: 'Approver',
    rights: ['Approve low and medium-risk write-back', 'Second approver on high-risk actions', 'Set agent autonomy (not OT)'],
    access: ['command', 'loop', 'soc', 'int', 'strike', 'ai', 'aisec', 'fabric', 'tooling', 'ops', 'reports', 'comms'],
  },
  {
    id: 'analyst', label: 'SOC analyst', group: 'Security operations',
    description: 'Open incidents, investigation and the copilot',
    landing: '/soc/ir',
    workspace: [['Open incidents', '/soc/ir?status=open'], ['HexaMatrix', '/soc/attack'], ['Threat hunting', '/soc/hunting'], ['Ask the copilot', '/ai/copilot'], ['IOC', '/int/ioc']],
    person: (c) => c.rolePeople?.analyst ?? c.people.socLead,
    licence: 'Analyst',
    rights: ['Request write-back actions (cannot approve own)', 'Use the copilot', 'Update incidents and hunts'],
    access: ['command', 'soc', 'int', 'strike', 'ai', 'fabric', 'comms'],
  },
  {
    id: 'threat', label: 'Threat intelligence', group: 'Security operations',
    description: 'Dark web, exposure, actors and indicators',
    landing: '/int/overview',
    workspace: [['HexaInt overview', '/int/overview'], ['Credential exposure', '/int/exposure'], ['Brand & dark web', '/int/darkweb'], ['OSINT & actors', '/int/osint'], ['Attack surface', '/strike/asm'], ['Critical vuln response', '/int/vulnresponse']],
    person: (c) => c.rolePeople?.threat ?? c.people.socLead,
    licence: 'Analyst',
    rights: ['Request IOC pushes and takedowns', 'Publish intel briefs'],
    access: ['command', 'int', 'soc', 'strike', 'comms'],
  },
  {
    id: 'grc', label: 'GRC & audit', group: 'Governance & risk',
    description: 'Frameworks, controls, evidence and audit trail',
    landing: '/comply/overview',
    workspace: [['HexaComply overview', '/comply/overview'], ['Compliance registers', '/comply/caas'], ['Closed loop', '/loop'], ['Audit ledger', '/ops/audit'], ['Regulator reports', '/reports/library']],
    person: (c) => c.rolePeople?.grc ?? c.people.grcLead,
    licence: 'Approver',
    rights: ['Approve control status changes', 'Scope requirements (SoA)', 'Export evidence and the audit ledger'],
    access: ['trust', 'programme', 'command', 'board', 'loop', 'comply', 'aisec', 'custody', 'reports', 'ops', 'comms'],
  },
  {
    id: 'risk', label: 'Risk & resilience', group: 'Governance & risk',
    description: 'Risk register, continuity, third parties and crisis',
    landing: '/comply/caas?section=risks',
    workspace: [['Risk register', '/comply/caas?section=risks'], ['Business continuity', '/comply/caas?section=bia'], ['Third-party risk', '/comply/tprm'], ['Crisis war room', '/ops/warroom'], ['Risk quantification', '/insurance/quantification']],
    person: (c) => c.rolePeople?.risk ?? c.people.grcLead,
    licence: 'Full',
    rights: ['Accept and treat risks', 'Run crisis war rooms', 'Approve vendor assessments'],
    access: ['trust', 'programme', 'command', 'board', 'comply', 'insurance', 'ops', 'reports', 'comms'],
  },
  {
    id: 'privacy', label: 'Privacy & legal', group: 'Governance & risk',
    description: 'Breach clocks, notifications, custody and AI governance',
    landing: '/ops/warroom',
    workspace: [['Crisis war room (clocks)', '/ops/warroom'], ['Chain of evidence', '/custody/evidence'], ['AI management system (ISO 42001)', '/comply/aigov'], ['Claims readiness', '/insurance/claims'], ['Regulator reports', '/reports/library']],
    person: (c) => c.rolePeople?.privacy ?? c.people.grcLead,
    licence: 'Full',
    rights: ['Submit regulatory notifications', 'Place legal holds on evidence', 'Approve AI systems'],
    access: ['trust', 'command', 'comply', 'aisec', 'custody', 'insurance', 'ops', 'reports', 'comms'],
  },
  {
    id: 'ot', label: 'OT engineer', group: 'Engineering & platform',
    description: 'Sites, assets by Purdue level and OT alerts. Read-only',
    landing: '/ot/visibility',
    workspace: [['OT overview', '/ot/visibility'], ['Sites & sensors', '/ot/sites'], ['OT alerts', '/ot/alerts'], ['OT vulnerabilities', '/ot/vulns'], ['Network & conduits', '/ot/network']],
    person: (c) => c.rolePeople?.ot ?? c.people.otLead ?? c.people.admin,
    licence: 'Analyst',
    rights: ['Read-only OT views (no write-back to OT, ever)', 'Acknowledge OT alerts', 'Approve OT test windows'],
    access: ['command', 'ot', 'fabric', 'tooling', 'comms'],
  },
  {
    id: 'cloud', label: 'Cloud & IT operations', group: 'Engineering & platform',
    description: 'Cloud posture, identity, exposure and attack paths',
    landing: '/fabric/cloud',
    workspace: [['Cloud posture', '/fabric/cloud'], ['Identity', '/fabric/identity'], ['Exposure & vulns', '/fabric/exposure'], ['Attack paths', '/fabric/paths'], ['Unified assets', '/fabric/assets']],
    person: (c) => c.rolePeople?.cloud ?? c.people.admin,
    licence: 'Analyst',
    rights: ['Raise remediation tickets', 'Request identity actions'],
    access: ['command', 'fabric', 'tooling', 'strike', 'soc', 'comms'],
  },
  {
    id: 'admin', label: 'Platform admin', group: 'Engineering & platform',
    description: 'Integrations, data planes, users, licences and tooling',
    landing: '/fabric/integrations',
    workspace: [['Integrations', '/fabric/integrations'], ['Security tooling', '/tooling/topology'], ['Data planes', '/fabric/dataplanes'], ['Users & entitlements', '/ops/admin'], ['Notifications', '/ops/notifications']],
    person: (c) => c.rolePeople?.admin ?? c.people.admin,
    licence: 'Full',
    rights: ['Configure integrations and data planes', 'Invite users and assign roles', 'Enable action types per tenant'],
    access: ['command', 'fabric', 'tooling', 'ops', 'comms'],
  },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Persona, RoleDef>;
export const ROLE_IDS = ROLES.map((r) => r.id);
export const ROLE_GROUPS: RoleGroup[] = ['Master', 'Leadership', 'Security operations', 'Governance & risk', 'Engineering & platform'];

export function initialsOf(name: string): string {
  return name.split(' ').filter((w) => /^[A-Z]/.test(w) && !/^(Dr|Sir|Capt|Chief)\.?$/.test(w)).slice(0, 2).map((w) => w[0]).join('');
}

export function canAccess(role: RoleDef, moduleId: string): boolean {
  return role.access === 'all' || role.access.includes(moduleId);
}
