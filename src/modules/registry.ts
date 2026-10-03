import type { CapabilityId, ServiceId } from '../data/types';

// Single definition of HexaView's modules, their tabs and the twenty managed
// services. Sidebar, routes, Command Centre and the Service Catalogue all read
// from here.

export type NavGroupId = 'overview' | 'core' | 'platform' | 'fabric' | 'ops' | 'partner';

export interface ServiceDef {
  id: ServiceId;
  name: string;
  capability: CapabilityId;
  blurb: string;
  /** Route the service lives on. */
  path: string;
  sla?: string;
}

export interface ModuleTab {
  id: string;
  label: string;
  service?: ServiceId;
}

export interface ModuleDef {
  id: string;
  group: NavGroupId;
  /** Product name in caps on the rail, e.g. HEXASOC. */
  product: string;
  /** Human title, e.g. Managed SOC / MDR. */
  title: string;
  tagline: string;
  /** Brand icon file under /brand, or a lucide glyph name for the hex icon. */
  brandIcon?: string;
  glyph?: string;
  tone: string;
  basePath: string;
  scoreKey?: CapabilityId | 'ai' | 'insurance' | 'fabric';
  scoreLabel?: string;
  capability?: CapabilityId;
  tabs: ModuleTab[];
  isNew?: boolean;
}

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'core', label: 'Core capabilities' },
  { id: 'platform', label: 'Intelligence & assurance' },
  { id: 'fabric', label: 'Integration fabric' },
  { id: 'ops', label: 'Operations' },
  { id: 'partner', label: 'Partner / MSSP' },
];

export const MODULES: ModuleDef[] = [
  // ---------- Overview ----------
  { id: 'command', group: 'overview', product: 'Command Centre', title: 'Cyber Resilience Overview', tagline: 'Every capability, tenant and integration in one role-based view.', glyph: 'LayoutDashboard', tone: 'var(--m-view)', basePath: '/', tabs: [] },
  { id: 'board', group: 'overview', product: 'Board View', title: 'Board & Executive View', tagline: 'The Resilience Index, how it is made, and what would raise it most.', glyph: 'Presentation', tone: 'var(--m-view)', basePath: '/board', tabs: [] },
  { id: 'loop', group: 'overview', product: 'Closed-Loop Assurance', title: 'Closed-Loop Assurance', tagline: 'From policy to evidence to ATT&CK to detection to validation, proven live in one place.', glyph: 'RefreshCcwDot', tone: 'var(--m-view)', basePath: '/loop', tabs: [] },

  // ---------- Six core capabilities (twenty services) ----------
  {
    id: 'soc', group: 'core', product: 'HexaSOC', title: 'Managed SOC / MDR', capability: 'soc',
    tagline: '24/7 AI-agentic detection and response, hunting, forensics and detection engineering across every tool you run.',
    brandIcon: 'HexaSOC_icon.svg', tone: 'var(--m-soc)', basePath: '/soc', scoreKey: 'soc', scoreLabel: 'Detection & response',
    tabs: [
      { id: 'mdr', label: 'Overview · 24/7 MDR', service: 'mdr' },
      { id: 'ir', label: 'Incidents & Response', service: 'ir' },
      { id: 'attack', label: 'HexaMatrix', service: 'attack-coverage' },
      { id: 'tickets', label: 'Tickets', service: 'mdr' },
      { id: 'endpoint', label: 'Endpoint Vulnerabilities', service: 'mdr' },
      { id: 'recommendations', label: 'Recommendations', service: 'mdr' },
      { id: 'geomap', label: 'Geo Map', service: 'mdr' },
      { id: 'identity', label: 'Identity', service: 'mdr' },
      { id: 'entities', label: 'Entities', service: 'mdr' },
      { id: 'insight', label: 'Insight', service: 'mdr' },
      { id: 'hunting', label: 'Threat Hunting', service: 'hunting' },
      { id: 'forensics', label: 'Digital Forensics', service: 'forensics' },
      { id: 'detection', label: 'Detection Engineering', service: 'detection-eng' },
      { id: 'reports', label: 'Reports', service: 'mdr' },
    ],
  },
  {
    id: 'int', group: 'core', product: 'HexaInt', title: 'Cyber Intelligence', capability: 'int',
    tagline: 'What the outside world can see, take and imitate: dark web, OSINT, threat intel and exposed credentials.',
    brandIcon: 'HexaInt_icon.svg', tone: 'var(--m-int)', basePath: '/int', scoreKey: 'int', scoreLabel: 'Intel coverage',
    tabs: [
      { id: 'overview', label: 'Overview', service: 'darkweb' },
      { id: 'surface', label: 'Attack Surface', service: 'osint' },
      { id: 'exposure', label: 'Credential Exposure', service: 'exposure' },
      { id: 'darkweb', label: 'Brand & Dark Web', service: 'darkweb' },
      { id: 'supply', label: 'Supply Chain', service: 'osint' },
      { id: 'ioc', label: 'IOC', service: 'osint' },
      { id: 'osint', label: 'OSINT & Threat Intel', service: 'osint' },
    ],
  },
  {
    id: 'strike', group: 'core', product: 'HexaStrike', title: 'Offensive Security', capability: 'strike',
    tagline: 'Guard-railed penetration, red and purple teaming plus continuous attack surface management, every finding fed back as a detection.',
    brandIcon: 'HexaStrike_icon.svg', tone: 'var(--m-strike)', basePath: '/strike', scoreKey: 'strike', scoreLabel: 'Validated defence',
    tabs: [
      { id: 'pentest', label: 'Penetration Testing', service: 'pentest' },
      { id: 'redteam', label: 'Red Teaming', service: 'redteam' },
      { id: 'purple', label: 'Purple Teaming', service: 'purpleteam' },
      { id: 'asm', label: 'Attack Surface Management', service: 'asm' },
    ],
  },
  {
    id: 'ot', group: 'core', product: 'HexaOT', title: 'Operational Technology', capability: 'ot',
    tagline: 'Passive visibility, vulnerability management and safe testing for the systems that cannot go down. Read-only by design.',
    brandIcon: 'HexaOT_icon.svg', tone: 'var(--m-ot)', basePath: '/ot', scoreKey: 'ot', scoreLabel: 'OT coverage',
    tabs: [
      { id: 'visibility', label: 'Overview', service: 'ot-visibility' },
      { id: 'sites', label: 'Sites', service: 'ot-visibility' },
      { id: 'assets', label: 'Assets', service: 'ot-visibility' },
      { id: 'network', label: 'Network', service: 'ot-visibility' },
      { id: 'vulns', label: 'Vulnerabilities', service: 'ot-vuln' },
      { id: 'alerts', label: 'Alerts', service: 'ot-visibility' },
      { id: 'pentest', label: 'OT Penetration Testing', service: 'ot-pentest' },
    ],
  },
  {
    id: 'comply', group: 'core', product: 'HexaComply', title: 'Governance, Risk & Compliance', capability: 'comply',
    tagline: 'Compliance as a service across every framework, third-party risk built in, and AI governance for the models you run.',
    brandIcon: 'HexaComply_icon.svg', tone: 'var(--m-comply)', basePath: '/comply', scoreKey: 'comply', scoreLabel: 'Control assurance',
    tabs: [
      { id: 'overview', label: 'Overview', service: 'caas' },
      { id: 'caas', label: 'Compliance', service: 'caas' },
      { id: 'risks', label: 'Risk Register', service: 'caas' },
      { id: 'tprm', label: 'Third-Party Risk', service: 'tprm' },
      { id: 'continuity', label: 'Business Continuity', service: 'caas' },
      { id: 'aigov', label: 'AI Security & Governance', service: 'ai-gov' },
    ],
  },
  {
    id: 'custody', group: 'core', product: 'HexaCustody', title: 'Content Custody', capability: 'custody',
    tagline: 'Chain of custody and chain of evidence for your most valuable digital assets, with revocation at supplier, user and session level.',
    brandIcon: 'HexaCustody_icon.svg', tone: 'var(--m-custody)', basePath: '/custody', scoreKey: 'custody', scoreLabel: 'Custody integrity',
    tabs: [
      { id: 'overview', label: 'Overview', service: 'custody' },
      { id: 'lineage', label: 'Lineage', service: 'custody' },
      { id: 'telemetry', label: 'Threat & Telemetry', service: 'custody' },
      { id: 'evidence', label: 'Chain of Evidence', service: 'custody' },
      { id: 'revocation', label: 'Revocation', service: 'custody' },
      { id: 'vendors', label: 'Vendor Chain', service: 'custody' },
    ],
  },

  // ---------- New capabilities ----------
  {
    id: 'ai', group: 'platform', product: 'HexaAI', title: 'HexaAI', isNew: true,
    tagline: 'A cited, checkable copilot over your whole estate, discovery and runtime control of the AI you run, and agentic SOC as a dial.',
    brandIcon: 'HexaAI_icon.svg', tone: 'var(--m-ai)', basePath: '/ai', scoreKey: 'ai', scoreLabel: 'AI assurance',
    tabs: [
      { id: 'copilot', label: 'Copilot' },
      { id: 'discovery', label: 'AI Discovery & Runtime' },
      { id: 'agents', label: 'Agentic SOC' },
      { id: 'redteam', label: 'AI Red Teaming' },
    ],
  },
  {
    id: 'insurance', group: 'platform', product: 'Cyber Insurance', title: 'Cyber Insurance & Risk Quantification', isNew: true,
    tagline: 'Turn live posture into an insurer-ready pack, quantify loss in money, and walk into renewal with evidence.',
    glyph: 'ShieldCheck', tone: 'var(--m-insurance)', basePath: '/insurance', scoreKey: 'insurance', scoreLabel: 'Insurability',
    tabs: [
      { id: 'overview', label: 'Insurability' },
      { id: 'quantification', label: 'Risk Quantification' },
      { id: 'policy', label: 'Policy & Renewal' },
      { id: 'pack', label: 'Insurer Evidence Pack' },
      { id: 'claims', label: 'Claims Readiness' },
    ],
  },
  {
    id: 'reports', group: 'platform', product: 'Reporting', title: 'Reporting Centre', isNew: true,
    tagline: 'Board, regulator, auditor, insurer and customer reports, drafted from live data with every statement cited.',
    glyph: 'FileBarChart2', tone: 'var(--m-reports)', basePath: '/reports',
    tabs: [
      { id: 'library', label: 'Report Library' },
      { id: 'builder', label: 'Report Builder' },
      { id: 'scheduled', label: 'Scheduled & Distribution' },
      { id: 'history', label: 'Issued Reports' },
    ],
  },

  // ---------- Integration fabric ----------
  {
    id: 'fabric', group: 'fabric', product: 'HexaCore', title: 'Integration Fabric', isNew: true,
    tagline: 'Every security tool, cloud, data centre and OT network mapped into one canonical model. Read from all, write back with approval.',
    brandIcon: 'HexaCore_icon.svg', tone: 'var(--m-core)', basePath: '/fabric', scoreKey: 'fabric', scoreLabel: 'Data completeness',
    tabs: [
      { id: 'integrations', label: 'Integrations' },
      { id: 'dataplanes', label: 'Data Planes' },
      { id: 'assets', label: 'Unified Assets' },
      { id: 'exposure', label: 'Exposure & Vulnerabilities' },
      { id: 'identity', label: 'Identity' },
      { id: 'cloud', label: 'Cloud Posture' },
      { id: 'paths', label: 'Attack Paths' },
      { id: 'pipeline', label: 'Pipeline & Cost' },
    ],
  },

  {
    id: 'tooling', group: 'fabric', product: 'Security Tooling', title: 'Security Tooling', isNew: true,
    tagline: 'Every integrated security tool: what it is, what it is doing right now, and exactly how it is wired into HexaView.',
    glyph: 'Network', tone: 'var(--m-tooling)', basePath: '/tooling',
    tabs: [
      { id: 'overview', label: 'Tool Itinerary' },
      { id: 'topology', label: 'Architecture Topology' },
      { id: 'activity', label: 'Live Activity' },
      { id: 'matrix', label: 'Integration Matrix' },
      { id: 'lineage', label: 'Data Lineage' },
    ],
  },

  // ---------- Operations ----------
  {
    id: 'ops', group: 'ops', product: 'Operations', title: 'Platform Operations', isNew: true,
    tagline: 'Gated write-back, the tamper-evident audit ledger, crisis coordination and how your own tools are really performing.',
    glyph: 'Settings2', tone: 'var(--m-ops)', basePath: '/ops',
    tabs: [
      { id: 'actions', label: 'Action Centre' },
      { id: 'audit', label: 'Audit Ledger' },
      { id: 'warroom', label: 'Crisis War Room' },
      { id: 'scorecard', label: 'Tool Scorecard' },
      { id: 'benchmark', label: 'Peer Benchmark' },
      { id: 'trust', label: 'Trust Centre' },
      { id: 'services', label: 'Service Catalogue' },
      { id: 'admin', label: 'Administration' },
    ],
  },

  // ---------- Partner / MSSP (shown only in Partner account mode) ----------
  {
    id: 'partner', group: 'partner', product: 'Partner Console', title: 'Partner Console', isNew: true,
    tagline: 'Your side of the partnership: clients, health across your book, and what needs you today.',
    glyph: 'Handshake', tone: 'var(--m-partner)', basePath: '/partner',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'clients', label: 'Clients' },
      { id: 'provisioning', label: 'Provisioning' },
    ],
  },
  {
    id: 'psales', group: 'partner', product: 'Partner Sales', title: 'Deals & Quotes', isNew: true,
    tagline: 'Register and protect opportunities, price HexaView and services, and track your pipeline.',
    glyph: 'BadgeDollarSign', tone: 'var(--m-partner)', basePath: '/partner-sales',
    tabs: [
      { id: 'deals', label: 'Deal Registration' },
      { id: 'quotes', label: 'Quotes & Pricing' },
      { id: 'pipeline', label: 'Pipeline' },
    ],
  },
  {
    id: 'whitelabel', group: 'partner', product: 'White Label', title: 'White Label & Branding', isNew: true,
    tagline: 'Run HexaView under your own brand: theme, domain, emails, reports and the client login.',
    glyph: 'Palette', tone: 'var(--m-partner)', basePath: '/white-label',
    tabs: [
      { id: 'branding', label: 'Branding' },
      { id: 'domains', label: 'Domains & Login' },
      { id: 'templates', label: 'Report & Email Templates' },
    ],
  },
  {
    id: 'penable', group: 'partner', product: 'Enablement', title: 'Content & Enablement', isNew: true,
    tagline: 'Collateral, training and co-marketing to sell and deliver HexaShield capabilities.',
    glyph: 'GraduationCap', tone: 'var(--m-partner)', basePath: '/enablement',
    tabs: [
      { id: 'library', label: 'Content Library' },
      { id: 'training', label: 'Training & Certification' },
      { id: 'marketing', label: 'Co-marketing & MDF' },
    ],
  },
  {
    id: 'pbilling', group: 'partner', product: 'Billing', title: 'Billing & Commissions', isNew: true,
    tagline: 'Usage across your clients, invoices, margin and commissions in one place.',
    glyph: 'Receipt', tone: 'var(--m-partner)', basePath: '/partner-billing',
    tabs: [
      { id: 'usage', label: 'Usage & Metering' },
      { id: 'invoices', label: 'Invoices' },
      { id: 'commissions', label: 'Commissions' },
      { id: 'support', label: 'Partner Support' },
    ],
  },
];

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));

export const CAPABILITIES: { id: CapabilityId; name: string; product: string; moduleId: string }[] = [
  { id: 'soc', name: 'Managed SOC / MDR', product: 'HexaSOC', moduleId: 'soc' },
  { id: 'int', name: 'Cyber Intelligence', product: 'HexaInt', moduleId: 'int' },
  { id: 'strike', name: 'Offensive Security', product: 'HexaStrike', moduleId: 'strike' },
  { id: 'ot', name: 'Operational Technology', product: 'HexaOT', moduleId: 'ot' },
  { id: 'comply', name: 'Governance, Risk & Compliance', product: 'HexaComply', moduleId: 'comply' },
  { id: 'custody', name: 'Content Custody', product: 'HexaCustody', moduleId: 'custody' },
];

export const SERVICES: ServiceDef[] = [
  { id: 'mdr', name: '24/7 Managed Detection & Response', capability: 'soc', path: '/soc/mdr', sla: 'Critical: acknowledge 15 min, contain 60 min', blurb: 'Round-the-clock triage, investigation and guarded response by HexaSOC agents and analysts.' },
  { id: 'hunting', name: 'Threat Hunting', capability: 'soc', path: '/soc/hunting', sla: 'Monthly hypothesis cycle + ad hoc on new intel', blurb: 'Hypothesis-led hunts driven by HexaInt intelligence and ATT&CK gaps.' },
  { id: 'ir', name: 'Incident Response', capability: 'soc', path: '/soc/ir', sla: 'Retainer: remote in 1 h, on site in 24 h', blurb: 'Retained incident response from first call to lessons learned, with regulatory clocks tracked.' },
  { id: 'forensics', name: 'Digital Forensics', capability: 'soc', path: '/soc/forensics', sla: 'Triage image within 4 h of approval', blurb: 'Evidence-grade acquisition and analysis with an unbroken chain of custody.' },
  { id: 'detection-eng', name: 'Detection Engineering', capability: 'soc', path: '/soc/detection', sla: 'New rule from intel in 72 h', blurb: 'Detections as code, tested against your telemetry and written back to your SIEM and EDR.' },
  { id: 'attack-coverage', name: 'ATT&CK Coverage', capability: 'soc', path: '/soc/attack', sla: 'Coverage recalculated continuously', blurb: 'HexaMatrix coverage across ATT&CK Enterprise, ICS and ATLAS with a sector overlay.' },
  { id: 'darkweb', name: 'Dark Web Monitoring', capability: 'int', path: '/int/darkweb', sla: 'Critical leak alert within 1 h', blurb: 'Markets, forums, leak sites and ransomware blogs watched for your name, data and access.' },
  { id: 'osint', name: 'OSINT & Threat Intelligence', capability: 'int', path: '/int/osint', sla: 'Weekly sector brief + flash on campaigns', blurb: 'Actor tracking, campaigns and indicators relevant to your sector, fed to every module.' },
  { id: 'exposure', name: 'Credential & Executive Exposure', capability: 'int', path: '/int/exposure', sla: 'Stealer-log match within 1 h', blurb: 'Leaked credentials, stealer logs and executive digital footprint, matched to your identities.' },
  { id: 'pentest', name: 'Penetration Testing', capability: 'strike', path: '/strike/pentest', sla: 'Report within 5 days of test close', blurb: 'Infrastructure, web, API, cloud and mobile testing, findings tracked to retest.' },
  { id: 'redteam', name: 'Red Teaming', capability: 'strike', path: '/strike/redteam', sla: 'Objective-based, intelligence-led', blurb: 'Intelligence-led adversary emulation (CBEST / TIBER-EU style) against agreed objectives.' },
  { id: 'purpleteam', name: 'Purple Teaming', capability: 'strike', path: '/strike/purple', sla: 'Fortnightly sprints', blurb: 'Collaborative test-detect-tune cycles that turn offensive findings into live detections.' },
  { id: 'asm', name: 'Attack Surface Management', capability: 'strike', path: '/strike/asm', sla: 'Continuous discovery, daily diff', blurb: 'Continuous discovery and validation of everything you expose to the internet.' },
  { id: 'ot-visibility', name: 'OT & ICS Asset Visibility', capability: 'ot', path: '/ot/visibility', sla: 'Passive, zero-touch', blurb: 'Passive discovery of every controller, HMI and engineering station, by Purdue level and zone.' },
  { id: 'ot-vuln', name: 'OT Vulnerability Management', capability: 'ot', path: '/ot/vulns', sla: 'Risk-ranked within 24 h of advisory', blurb: 'ICS advisories matched to your firmware, ranked by reachability and consequence.' },
  { id: 'ot-pentest', name: 'OT Penetration Testing', capability: 'ot', path: '/ot/pentest', sla: 'Safety-case approved scope only', blurb: 'Guard-railed OT testing with change windows, safety approvals and human-on-the-loop.' },
  { id: 'caas', name: 'Compliance as a Service (ISMS)', capability: 'comply', path: '/comply/caas', sla: 'Evidence collected continuously', blurb: 'An operated ISMS across ISO 27001, NIS2, DORA, TPN and more, assessment to certification.' },
  { id: 'tprm', name: 'Third-Party Risk Management', capability: 'comply', path: '/comply/tprm', sla: 'Tier 1 vendors reassessed annually', blurb: 'Tiered supplier assessments, outside-in ratings and contract obligations in one register.' },
  { id: 'ai-gov', name: 'AI Security & Governance', capability: 'comply', path: '/comply/aigov', sla: 'AI inventory refreshed daily', blurb: 'ISO/IEC 42001, EU AI Act and NIST AI RMF governance for the AI you build and buy.' },
  { id: 'custody', name: 'Content Custody & Chain of Evidence', capability: 'custody', path: '/custody/overview', sla: 'Revocation propagates in < 60 s', blurb: 'Track every asset across organisations, with revocation at supplier, user and session level.' },
];

export const SERVICE_BY_ID: Record<ServiceId, ServiceDef> = Object.fromEntries(SERVICES.map((s) => [s.id, s])) as Record<ServiceId, ServiceDef>;

export function moduleForPath(pathname: string): ModuleDef {
  if (pathname === '/' || pathname === '') return MODULE_BY_ID.command;
  const seg = '/' + pathname.split('/').filter(Boolean)[0];
  return MODULES.find((m) => m.basePath === seg) ?? MODULE_BY_ID.command;
}
