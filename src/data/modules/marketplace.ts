// HexaCore integrations Marketplace: the catalogue of connectors a customer can
// browse, evaluate and install, plus gap analysis ("recommended for you").
//
// Installed state is never keyed by customer: it is derived by matching each
// listing's keys against the customer's own `c.connectors` (vendor + product),
// so it follows whatever tools a customer profile carries. Connectors that no
// listing recognises surface as private listings so nothing installed is hidden.

import type { Connector, ConnectorCategory, CustomerProfile, Env } from '../types';
import { rng } from '../../lib/rng';

export type MktCategory =
  | 'SIEM' | 'EDR / XDR' | 'Identity' | 'PAM' | 'Email' | 'Awareness' | 'Network & firewall' | 'SASE / SSE'
  | 'Cloud / CNAPP' | 'Cloud & SaaS platforms' | 'Vulnerability' | 'Exposure / CAASM' | 'OT / IoT' | 'Medical devices'
  | 'DLP & data' | 'AppSec' | 'AI security' | 'GRC' | 'Ratings & TPRM' | 'ITSM' | 'Backup & resilience' | 'Threat intel'
  | 'Validation / BAS' | 'Media & content' | 'Healthcare' | 'Defence' | 'Pharma & life sciences' | 'Automotive'
  | 'Maritime & logistics' | 'Financial services' | 'Standards' | 'HexaShield' | 'Private'
  | 'NDR' | 'ITDR' | 'SOAR & automation' | 'Mobile & endpoint management' | 'Patch & software management' | 'Browser security' | 'Secrets & key management' | 'PKI & certificates' | 'Software supply chain' | 'API security' | 'Container & Kubernetes' | 'SaaS security (SSPM)' | 'DSPM' | 'DNS & web security' | 'WAF, DDoS & edge' | 'Fraud & bot protection' | 'Digital risk & brand' | 'Insider risk & UEBA' | 'Forensics & IR' | 'Asset & CMDB' | 'Observability & log pipelines' | 'Collaboration & messaging' | 'Physical security' | 'Privacy & consent';

export const MKT_CATEGORIES: MktCategory[] = [
  'SIEM', 'SOAR & automation', 'Observability & log pipelines', 'Insider risk & UEBA', 'EDR / XDR', 'NDR',
  'Mobile & endpoint management', 'Patch & software management', 'Forensics & IR', 'Identity', 'ITDR', 'PAM',
  'Secrets & key management', 'PKI & certificates', 'Email', 'Awareness', 'Network & firewall', 'SASE / SSE',
  'Browser security', 'DNS & web security', 'WAF, DDoS & edge', 'Fraud & bot protection', 'Cloud / CNAPP', 'Container & Kubernetes',
  'SaaS security (SSPM)', 'Cloud & SaaS platforms', 'Collaboration & messaging', 'Vulnerability', 'Exposure / CAASM', 'Asset & CMDB',
  'OT / IoT', 'Physical security', 'Medical devices', 'DLP & data', 'DSPM', 'AppSec',
  'Software supply chain', 'API security', 'AI security', 'GRC', 'Privacy & consent', 'Ratings & TPRM',
  'ITSM', 'Backup & resilience', 'Threat intel', 'Digital risk & brand', 'Validation / BAS', 'Media & content',
  'Healthcare', 'Defence', 'Pharma & life sciences', 'Automotive', 'Maritime & logistics', 'Financial services',
  'Standards', 'HexaShield', 'Private',
];

export type ConnMethod = 'API' | 'Webhook' | 'Syslog' | 'Agent' | 'Sensor' | 'TAXII' | 'Kafka' | 'File drop';
export type Cert = 'HexaView-certified' | 'Partner-built' | 'Community';
export type Power = 'HexaSOC' | 'HexaInt' | 'HexaStrike' | 'HexaOT' | 'HexaComply' | 'HexaCustody' | 'HexaAI';
export type Risk = 'low' | 'medium' | 'high';
export type Sector = 'maritime' | 'finance' | 'media' | 'health' | 'auto' | 'defence' | 'pharma' | 'insurance';

export const POWERS: Power[] = ['HexaSOC', 'HexaInt', 'HexaStrike', 'HexaOT', 'HexaComply', 'HexaCustody', 'HexaAI'];
export const POWER_COLOR: Record<Power, string> = {
  HexaSOC: 'var(--m-soc)', HexaInt: 'var(--m-int)', HexaStrike: 'var(--m-strike)', HexaOT: 'var(--m-ot)',
  HexaComply: 'var(--m-comply)', HexaCustody: 'var(--m-custody)', HexaAI: 'var(--m-ai)',
};
export const POWER_PATH: Record<Power, string> = {
  HexaSOC: '/soc', HexaInt: '/int', HexaStrike: '/strike', HexaOT: '/ot', HexaComply: '/comply', HexaCustody: '/custody', HexaAI: '/ai-governance',
};
export const CERT_COLOR: Record<Cert, string> = { 'HexaView-certified': 'var(--m-core)', 'Partner-built': 'var(--m-matrix)', Community: 'var(--m-ai)' };
export const RISK_COLOR: Record<Risk, string> = { low: 'var(--good)', medium: 'var(--sev-medium)', high: 'var(--sev-high)' };

export interface WriteAction {
  name: string;
  risk: Risk;
  /** Approval gate applied by the Action Centre before the intent is signed. */
  gate: string;
}

export interface Listing {
  id: string;
  vendor: string;
  product: string;
  name: string;
  category: MktCategory;
  /** Category used when the install becomes a connector (and for gap analysis). */
  connCategory: ConnectorCategory;
  envs: Env[];
  read: string[];
  write: WriteAction[];
  methods: ConnMethod[];
  cert: Cert;
  setupMin: number;
  /** 0-100 popularity across HexaView tenants. */
  popularity: number;
  installs: number;
  rating: number;
  reviews: number;
  powers: Power[];
  frameworks: string[];
  scopes: string[];
  ocsf: string[];
  blurb: string;
  sectors: Sector[];
  version: string;
  updatedDays: number;
  /** Match keys: each is a list of whole-word tokens that must all appear in "vendor product"; `!x` excludes. */
  keys: string[][];
  /** Synthesised from an installed connector that no catalogue listing recognises. */
  custom?: boolean;
}

/* ---------------------------------------------------------------------
   Category defaults
   --------------------------------------------------------------------- */

const G = {
  auto: 'Auto-approved by policy · logged',
  lead: 'SOC lead approval',
  owner: 'Asset owner approval',
  two: 'Two-person approval (SOC lead + asset owner)',
  cab: 'Change board (CAB) approval',
  grc: 'GRC lead approval',
} as const;
const w = (name: string, risk: Risk, gate?: string): WriteAction => ({ name, risk, gate: gate ?? (risk === 'low' ? G.auto : risk === 'medium' ? G.lead : G.two) });

interface CatDef {
  conn: ConnectorCategory;
  envs: Env[];
  methods: ConnMethod[];
  read: string[];
  write: WriteAction[];
  powers: Power[];
  frameworks: string[];
  scopes: string[];
  ocsf: string[];
  setup: number;
  blurb: string;
}

const CAT: Record<MktCategory, CatDef> = {
  SIEM: { conn: 'SIEM', envs: ['cloud'], methods: ['API'], read: ['Analytic rules', 'Alerts / notables', 'Incidents', 'Log source health'], write: [w('Deploy detection rule', 'medium'), w('Enable / disable rule', 'medium'), w('Add incident comment', 'low')], powers: ['HexaSOC', 'HexaStrike', 'HexaComply'], frameworks: ['ISO 27001', 'NIS2', 'NIST CSF', 'SOC 2', 'PCI DSS', 'DORA', 'HIPAA'], scopes: ['rules:read', 'incidents:read', 'workspace:query', 'rules:write (gated)'], ocsf: ['Detection Finding (2004)', 'Incident Finding (2005)'], setup: 25, blurb: 'Detections, incidents and log-source health; detections-as-code written back under approval.' },
  'EDR / XDR': { conn: 'EDR / XDR', envs: ['cloud'], methods: ['API'], read: ['Devices', 'Alerts', 'Detections', 'Vulnerabilities', 'Sensor health'], write: [w('Isolate host', 'high'), w('Add custom indicator', 'medium'), w('Run live-response script', 'high')], powers: ['HexaSOC', 'HexaStrike', 'HexaComply'], frameworks: ['ISO 27001', 'NIST CSF', 'NIS2', 'HIPAA', 'PCI DSS', 'TISAX'], scopes: ['devices:read', 'alerts:read', 'indicators:write (gated)', 'response:isolate (gated)'], ocsf: ['Device Inventory Info (5001)', 'Detection Finding (2004)', 'Process Activity (1007)'], setup: 15, blurb: 'Endpoint inventory, detections and sensor coverage, with guarded containment.' },
  Identity: { conn: 'Identity', envs: ['saas'], methods: ['API', 'Webhook'], read: ['Users', 'Groups', 'Sign-ins', 'Risky users', 'MFA methods'], write: [w('Revoke sessions', 'medium'), w('Force password reset', 'medium'), w('Disable account', 'high')], powers: ['HexaSOC', 'HexaInt', 'HexaComply'], frameworks: ['ISO 27001', 'NIST CSF', 'SOC 2', 'DORA', 'HIPAA', 'NIS2'], scopes: ['users:read', 'groups:read', 'auditlogs:read', 'sessions:revoke (gated)'], ocsf: ['Authentication (3002)', 'Account Change (3001)', 'User Inventory Info (5003)'], setup: 15, blurb: 'Identities, sign-in risk and MFA posture joined to leaked-credential intel.' },
  PAM: { conn: 'PAM', envs: ['saas', 'onprem'], methods: ['API', 'Syslog'], read: ['Privileged accounts', 'Sessions', 'Vaulted credential metadata', 'Vendor access'], write: [w('Rotate credential', 'medium'), w('Terminate privileged session', 'high')], powers: ['HexaSOC', 'HexaOT', 'HexaComply'], frameworks: ['IEC 62443', 'SWIFT CSP', 'PCI DSS', 'ISO 27001', 'TISAX', 'NIS2'], scopes: ['accounts:read', 'sessions:read', 'credentials:rotate (gated)'], ocsf: ['Authentication (3002)', 'Authorize Session (3003)'], setup: 40, blurb: 'Privileged accounts, vendor sessions and rotation status. Secrets never leave the vault.' },
  Email: { conn: 'Email', envs: ['saas'], methods: ['API'], read: ['Threats', 'Clicks', 'Quarantine', 'Most-attacked people'], write: [w('Purge message from mailboxes', 'medium'), w('Block sender', 'low')], powers: ['HexaSOC', 'HexaInt'], frameworks: ['ISO 27001', 'NIST CSF', 'HIPAA', 'NIS2'], scopes: ['threats:read', 'messages:read-metadata', 'messages:purge (gated)'], ocsf: ['Email Activity (4009)', 'Detection Finding (2004)'], setup: 10, blurb: 'Phishing, BEC and click telemetry joined to the people most targeted.' },
  Awareness: { conn: 'Email', envs: ['saas'], methods: ['API'], read: ['Training completion', 'Phish-simulation results', 'Human risk scores'], write: [w('Enrol user in training', 'low')], powers: ['HexaComply', 'HexaSOC'], frameworks: ['ISO 27001', 'NIS2', 'HIPAA', 'PCI DSS', 'DORA'], scopes: ['training:read', 'phishing:read', 'enrolments:write'], ocsf: ['User Inventory Info (5003)'], setup: 10, blurb: 'Training and phish-simulation evidence for human-risk controls.' },
  'Network & firewall': { conn: 'Network', envs: ['onprem'], methods: ['API', 'Syslog'], read: ['Rules', 'Threat logs', 'Zones', 'Objects & NAT'], write: [w('Add address to block list', 'medium'), w('Push rule change', 'high', G.cab)], powers: ['HexaSOC', 'HexaStrike', 'HexaOT'], frameworks: ['PCI DSS', 'IEC 62443', 'NIS2', 'ISO 27001', 'SWIFT CSP'], scopes: ['config:read', 'logs:read', 'dynamic-list:write (gated)'], ocsf: ['Network Activity (4001)', 'Detection Finding (2004)'], setup: 35, blurb: 'Rule base, zones and threat logs; segmentation evidence for audits.' },
  'SASE / SSE': { conn: 'SASE', envs: ['saas'], methods: ['API', 'Syslog'], read: ['Web transactions', 'Private-app access', 'Policies', 'DLP incidents'], write: [w('Block URL or category', 'medium'), w('Revoke user access', 'medium')], powers: ['HexaSOC', 'HexaCustody', 'HexaComply'], frameworks: ['NIS2', 'ISO 27001', 'TPN', 'NIST CSF', 'SOC 2'], scopes: ['logs:read', 'policy:read', 'policy:write (gated)'], ocsf: ['HTTP Activity (4002)', 'Network Activity (4001)'], setup: 20, blurb: 'Zero-trust access and web egress telemetry, with gated block lists.' },
  'Cloud / CNAPP': { conn: 'Cloud posture', envs: ['cloud'], methods: ['API'], read: ['Issues', 'Inventory', 'Attack paths', 'Identities & entitlements', 'Compliance posture'], write: [w('Create remediation ticket', 'low'), w('Apply auto-remediation', 'high', G.owner)], powers: ['HexaSOC', 'HexaStrike', 'HexaComply'], frameworks: ['ISO 27001', 'SOC 2', 'DORA', 'PCI DSS', 'NIS2', 'CIS Benchmarks'], scopes: ['inventory:read', 'issues:read', 'graph:query'], ocsf: ['Compliance Finding (2003)', 'Vulnerability Finding (2002)'], setup: 20, blurb: 'Cloud posture, attack paths and entitlements across accounts and subscriptions.' },
  'Cloud & SaaS platforms': { conn: 'Cloud posture', envs: ['cloud'], methods: ['API'], read: ['Audit logs', 'Configuration', 'Identities', 'Admin activity'], write: [w('Disable access key', 'high')], powers: ['HexaSOC', 'HexaComply'], frameworks: ['ISO 27001', 'SOC 2', 'NIS2', 'DORA'], scopes: ['audit:read', 'config:read'], ocsf: ['API Activity (6003)', 'Account Change (3001)'], setup: 15, blurb: 'Platform audit trails and configuration as first-class evidence.' },
  Vulnerability: { conn: 'Vulnerability', envs: ['cloud', 'onprem'], methods: ['API'], read: ['Assets', 'Vulnerabilities', 'Scan coverage', 'Exploitability'], write: [w('Launch rescan', 'low'), w('Accept risk / exception', 'medium', G.grc)], powers: ['HexaStrike', 'HexaSOC', 'HexaComply'], frameworks: ['ISO 27001', 'PCI DSS', 'NIS2', 'NIST CSF', 'DORA', 'HIPAA'], scopes: ['assets:read', 'vulns:read', 'scans:launch (gated)'], ocsf: ['Vulnerability Finding (2002)', 'Device Inventory Info (5001)'], setup: 20, blurb: 'Vulnerabilities and scan coverage, ranked by exploitability and crown-jewel reach.' },
  'Exposure / CAASM': { conn: 'Asset / CMDB', envs: ['cloud', 'onprem'], methods: ['API'], read: ['Asset inventory', 'Coverage gaps', 'Ownership', 'Unmanaged devices'], write: [w('Tag asset', 'low')], powers: ['HexaStrike', 'HexaComply', 'HexaSOC'], frameworks: ['ISO 27001', 'NIST CSF', 'NIS2', 'CIS Controls'], scopes: ['assets:read', 'queries:read'], ocsf: ['Device Inventory Info (5001)'], setup: 20, blurb: 'A complete asset picture and the tools each asset is missing.' },
  'OT / IoT': { conn: 'OT', envs: ['ot'], methods: ['Sensor', 'API'], read: ['Assets', 'Alerts', 'Vulnerabilities', 'Zones & conduits', 'Protocol baselines'], write: [], powers: ['HexaOT', 'HexaSOC', 'HexaComply'], frameworks: ['IEC 62443', 'NIS2', 'NIST CSF', 'NERC CIP'], scopes: ['assets:read', 'alerts:read', 'vulns:read'], ocsf: ['Device Inventory Info (5001)', 'Detection Finding (2004)'], setup: 120, blurb: 'Passive OT/IoT discovery and detection. Read-only by policy: no actions reach the plant.' },
  'Medical devices': { conn: 'OT', envs: ['ot'], methods: ['Sensor', 'API'], read: ['Medical devices', 'Clinical risk', 'FDA recalls', 'Network behaviour'], write: [], powers: ['HexaOT', 'HexaComply', 'HexaSOC'], frameworks: ['HIPAA', 'HPH CPGs', 'FDA 524B', 'HITRUST'], scopes: ['devices:read', 'alerts:read', 'recalls:read'], ocsf: ['Device Inventory Info (5001)', 'Detection Finding (2004)'], setup: 90, blurb: 'Clinical device inventory and risk, matched to recalls. Read-only by policy.' },
  'DLP & data': { conn: 'DLP', envs: ['saas'], methods: ['API'], read: ['Sensitive data inventory', 'DLP incidents', 'Access entitlements', 'Labels'], write: [w('Revoke sharing link', 'medium'), w('Apply sensitivity label', 'low')], powers: ['HexaCustody', 'HexaComply', 'HexaAI'], frameworks: ['HIPAA', 'PCI DSS', 'TPN', 'GDPR', 'ISO 27001'], scopes: ['incidents:read', 'classification:read', 'sharing:revoke (gated)'], ocsf: ['Data Security Finding (2006)'], setup: 30, blurb: 'Where sensitive data lives, who can reach it and what is leaving.' },
  AppSec: { conn: 'AppSec', envs: ['saas'], methods: ['API', 'Webhook'], read: ['Repositories', 'Findings', 'SBOM', 'Secrets'], write: [w('Open issue', 'low'), w('Comment on pull request', 'low')], powers: ['HexaStrike', 'HexaComply'], frameworks: ['ISO 27001', 'SOC 2', 'PCI DSS', 'ISO/SAE 21434', 'FDA 524B'], scopes: ['repos:read', 'findings:read', 'issues:write'], ocsf: ['Vulnerability Finding (2002)'], setup: 15, blurb: 'Code, dependency and secrets findings tied to the services they ship.' },
  'AI security': { conn: 'AI', envs: ['saas', 'cloud'], methods: ['API'], read: ['AI apps & models', 'Prompt-risk events', 'Shadow AI usage', 'Model inventory'], write: [w('Block AI application', 'medium')], powers: ['HexaAI', 'HexaComply'], frameworks: ['ISO 42001', 'EU AI Act', 'NIST AI RMF'], scopes: ['inventory:read', 'events:read', 'policy:write (gated)'], ocsf: ['Application Activity (6001)'], setup: 20, blurb: 'AI inventory, prompt-risk events and shadow AI for HexaAI governance.' },
  GRC: { conn: 'GRC', envs: ['saas'], methods: ['API'], read: ['Controls', 'Risks', 'Policies', 'Evidence requests'], write: [w('Attach evidence', 'low'), w('Update control status', 'medium', G.grc)], powers: ['HexaComply'], frameworks: ['ISO 27001', 'SOC 2', 'NIS2', 'DORA', 'HIPAA', 'PCI DSS'], scopes: ['controls:read', 'evidence:write'], ocsf: ['Compliance Finding (2003)'], setup: 30, blurb: 'Two-way control and evidence sync, so audits see live HexaView proof.' },
  'Ratings & TPRM': { conn: 'Ratings', envs: ['saas'], methods: ['API'], read: ['Vendor ratings', 'Findings', 'Questionnaires'], write: [w('Request reassessment', 'low')], powers: ['HexaComply', 'HexaInt'], frameworks: ['DORA', 'NIS2', 'ISO 27001', 'TISAX', 'TPN'], scopes: ['portfolio:read', 'findings:read'], ocsf: ['Compliance Finding (2003)'], setup: 10, blurb: 'Outside-in ratings and supplier findings for third-party risk.' },
  ITSM: { conn: 'ITSM', envs: ['saas'], methods: ['API', 'Webhook'], read: ['Incidents', 'Changes', 'CMDB', 'Problems'], write: [w('Create ticket', 'low'), w('Update ticket', 'low'), w('Raise emergency change', 'medium', G.cab)], powers: ['HexaSOC', 'HexaComply', 'HexaStrike'], frameworks: ['ISO 27001', 'SOC 2', 'DORA', 'NIS2'], scopes: ['incident:read', 'incident:write', 'cmdb:read'], ocsf: ['Incident Finding (2005)'], setup: 15, blurb: 'Tickets, changes and CMDB ownership; HexaView raises and closes work where your teams live.' },
  'Backup & resilience': { conn: 'Backup', envs: ['onprem', 'cloud'], methods: ['API'], read: ['Jobs', 'Immutability', 'Restore tests', 'Anomaly alerts'], write: [w('Trigger immutable snapshot', 'medium'), w('Start restore test', 'low')], powers: ['HexaSOC', 'HexaComply'], frameworks: ['DORA', 'NIS2', 'HIPAA', 'ISO 27001', 'NIST CSF'], scopes: ['jobs:read', 'restorepoints:read', 'snapshots:create (gated)'], ocsf: ['Compliance Finding (2003)'], setup: 25, blurb: 'Backup coverage, immutability and restore proof for resilience controls.' },
  'Threat intel': { conn: 'Intelligence', envs: ['saas'], methods: ['API', 'TAXII'], read: ['Indicators', 'Actors', 'Campaigns', 'Vulnerability intel'], write: [w('Submit sighting', 'low')], powers: ['HexaInt', 'HexaSOC'], frameworks: ['ISO 27001', 'NIS2', 'DORA', 'NIST CSF'], scopes: ['intel:read', 'sightings:write'], ocsf: ['Threat intelligence (enrichment)'], setup: 10, blurb: 'Actor, campaign and indicator intelligence feeding hunts and detections.' },
  'Validation / BAS': { conn: 'Validation', envs: ['saas', 'onprem'], methods: ['API', 'Agent'], read: ['Validation results', 'Prevented / detected per technique', 'Attack paths'], write: [w('Schedule assessment', 'medium'), w('Re-run scenario', 'low')], powers: ['HexaStrike', 'HexaSOC', 'HexaComply'], frameworks: ['DORA', 'TIBER-EU', 'ISO 27001', 'NIST CSF', 'CBEST'], scopes: ['results:read', 'assessments:schedule (gated)'], ocsf: ['Detection Finding (2004)'], setup: 45, blurb: 'Continuous control validation that closes the "validated" link of every loop.' },
  'Media & content': { conn: 'Custody', envs: ['saas', 'onprem'], methods: ['API', 'Webhook'], read: ['Transfers', 'Recipients', 'Watermark sessions', 'Access logs'], write: [w('Revoke share', 'medium'), w('Expire link', 'low')], powers: ['HexaCustody', 'HexaComply'], frameworks: ['TPN', 'MPA CSBP', 'ISO 27001'], scopes: ['transfers:read', 'shares:revoke (gated)'], ocsf: ['File Hosting Activity (6006)'], setup: 30, blurb: 'Pre-release content movement and custody events for TPN evidence.' },
  Healthcare: { conn: 'Asset / CMDB', envs: ['onprem', 'saas'], methods: ['API', 'Syslog'], read: ['EHR access audit', 'Break-the-glass events', 'Patient-record access'], write: [], powers: ['HexaSOC', 'HexaComply'], frameworks: ['HIPAA', 'HITRUST', 'HPH CPGs'], scopes: ['audit:read'], ocsf: ['API Activity (6003)', 'Authentication (3002)'], setup: 60, blurb: 'Clinical system audit trails for privacy monitoring and HIPAA evidence.' },
  Defence: { conn: 'GRC', envs: ['cloud', 'saas'], methods: ['API'], read: ['CUI access logs', 'Audit logs', 'Supplier attestations'], write: [], powers: ['HexaComply', 'HexaSOC', 'HexaCustody'], frameworks: ['CMMC 2.0', 'NIST 800-171', 'ITAR', 'DFARS 7012'], scopes: ['audit:read', 'attestations:read'], ocsf: ['API Activity (6003)'], setup: 45, blurb: 'Controlled Unclassified Information enclaves and supplier attestations.' },
  'Pharma & life sciences': { conn: 'GRC', envs: ['saas', 'onprem'], methods: ['API'], read: ['Audit trails (21 CFR Part 11)', 'Document-control events', 'Validated-system changes'], write: [], powers: ['HexaComply', 'HexaCustody'], frameworks: ['GxP', '21 CFR Part 11', 'EU Annex 11', 'ISO 27001'], scopes: ['audit:read'], ocsf: ['API Activity (6003)'], setup: 60, blurb: 'GxP audit trails from validated systems, read-only to protect validation.' },
  Automotive: { conn: 'SIEM', envs: ['cloud'], methods: ['API'], read: ['Vehicle security events', 'OTA campaign status', 'Fleet anomalies'], write: [w('Pause OTA campaign', 'high', G.two)], powers: ['HexaSOC', 'HexaOT', 'HexaComply'], frameworks: ['UNECE R155', 'UNECE R156', 'ISO/SAE 21434', 'TISAX'], scopes: ['events:read', 'campaigns:read'], ocsf: ['Detection Finding (2004)'], setup: 60, blurb: 'Vehicle SOC and OTA telemetry for R155/R156 monitoring evidence.' },
  'Maritime & logistics': { conn: 'OT', envs: ['ot', 'onprem'], methods: ['API', 'Syslog'], read: ['Vessel network events', 'Equipment register', 'Satellite-link health'], write: [], powers: ['HexaOT', 'HexaSOC'], frameworks: ['IMO', 'IACS E26/27', 'ISPS', 'NIS2'], scopes: ['events:read', 'assets:read'], ocsf: ['Network Activity (4001)', 'Device Inventory Info (5001)'], setup: 60, blurb: 'Vessel and terminal context, store-and-forward over VSAT/LEO.' },
  'Financial services': { conn: 'Network', envs: ['onprem'], methods: ['Syslog', 'API'], read: ['Messaging logs', 'Operator activity', 'Fraud signals'], write: [], powers: ['HexaSOC', 'HexaComply'], frameworks: ['SWIFT CSP', 'DORA', 'PCI DSS', 'NYDFS 500'], scopes: ['logs:read'], ocsf: ['API Activity (6003)', 'Authentication (3002)'], setup: 45, blurb: 'Payment-system and core-banking telemetry for CSP and DORA evidence.' },
  Standards: { conn: 'Asset / CMDB', envs: ['cloud', 'onprem', 'ot', 'saas'], methods: ['API'], read: ['Any OCSF-mapped event'], write: [], powers: ['HexaSOC', 'HexaComply'], frameworks: ['ISO 27001', 'NIST CSF'], scopes: ['ingest:write'], ocsf: ['Any OCSF 1.x class'], setup: 10, blurb: 'Standards-native ingestion for anything without a dedicated connector.' },
  HexaShield: { conn: 'HexaShield', envs: ['saas'], methods: ['API'], read: ['Findings', 'Evidence'], write: [], powers: ['HexaSOC'], frameworks: ['ISO 27001'], scopes: ['platform:read'], ocsf: ['Detection Finding (2004)'], setup: 5, blurb: 'First-party HexaShield service feed.' },
  Private: { conn: 'Asset / CMDB', envs: ['onprem'], methods: ['API'], read: ['Mapped records'], write: [], powers: ['HexaSOC'], frameworks: [], scopes: ['tenant-private'], ocsf: ['Custom mapping'], setup: 30, blurb: 'Private connector built for this organisation; not listed publicly.' },
  // ---- Added categories (enterprise estates of 30 to 50 tools) ----
  'NDR': { conn: 'Network', envs: ['onprem', 'cloud'], methods: ['Sensor', 'API'], read: ['Network detections', 'Flow metadata', 'Hosts and roles', 'Encrypted-traffic analytics'], write: [w('Quarantine host on the network', 'high'), w('Add detection exclusion', 'low')], powers: ['HexaSOC', 'HexaOT', 'HexaStrike'], frameworks: ['ISO 27001', 'NIST CSF', 'NIS2', 'IEC 62443'], scopes: ['detections:read', 'hosts:read', 'response:write (gated)'], ocsf: ['Network Activity (4001)', 'Detection Finding (2004)'], setup: 45, blurb: 'Network detection and response: lateral movement, C2 and exfiltration seen on the wire.' },
  'ITDR': { conn: 'Identity', envs: ['saas', 'onprem'], methods: ['API'], read: ['Identity threats', 'AD and Entra attack paths', 'Risky and dormant accounts', 'Kerberos and NTLM anomalies'], write: [w('Disable account', 'high'), w('Force password reset', 'medium')], powers: ['HexaSOC', 'HexaStrike', 'HexaComply'], frameworks: ['ISO 27001', 'NIST CSF', 'SOC 2', 'NIS2'], scopes: ['identity:read', 'response:write (gated)'], ocsf: ['Identity & Access Management (3001)'], setup: 25, blurb: 'Identity threat detection and response across Active Directory, Entra ID and the IdP.' },
  'SOAR & automation': { conn: 'SIEM', envs: ['saas', 'cloud'], methods: ['API', 'Webhook'], read: ['Playbooks', 'Playbook runs', 'Cases', 'Automation outcomes'], write: [w('Run playbook', 'medium'), w('Pause playbook', 'low')], powers: ['HexaSOC'], frameworks: ['ISO 27001', 'NIST CSF', 'SOC 2'], scopes: ['playbooks:read', 'runs:read', 'runs:write (gated)'], ocsf: ['Incident Finding (2005)'], setup: 30, blurb: 'Security orchestration and case management; HexaView reads outcomes and triggers approved playbooks.' },
  'Mobile & endpoint management': { conn: 'EDR / XDR', envs: ['saas'], methods: ['API'], read: ['Managed devices', 'Compliance state', 'Mobile threats', 'App inventory'], write: [w('Lock device', 'medium'), w('Wipe device', 'high'), w('Mark device non-compliant', 'low')], powers: ['HexaSOC', 'HexaComply'], frameworks: ['ISO 27001', 'NIST CSF', 'HIPAA', 'CMMC'], scopes: ['devices:read', 'actions:write (gated)'], ocsf: ['Device Inventory Info (5001)'], setup: 20, blurb: 'UEM, MDM and mobile threat defence: device compliance as evidence and response on lost or compromised devices.' },
  'Patch & software management': { conn: 'Vulnerability', envs: ['onprem', 'cloud'], methods: ['API', 'Agent'], read: ['Patch compliance', 'Software inventory', 'Missing updates', 'Deployment status'], write: [w('Deploy approved patch', 'medium'), w('Schedule maintenance window', 'low')], powers: ['HexaSOC', 'HexaComply', 'HexaStrike'], frameworks: ['ISO 27001', 'CIS Controls', 'Cyber Essentials', 'PCI DSS'], scopes: ['inventory:read', 'deployments:write (gated)'], ocsf: ['Device Inventory Info (5001)'], setup: 25, blurb: 'Patch state and software inventory, closing the loop from vulnerability to verified fix.' },
  'Browser security': { conn: 'SASE', envs: ['saas'], methods: ['API', 'Agent'], read: ['Browser sessions', 'Extensions', 'Data movement events', 'Risky sites'], write: [w('Block extension', 'medium'), w('Apply data-control policy', 'medium')], powers: ['HexaSOC', 'HexaAI', 'HexaComply'], frameworks: ['ISO 27001', 'NIST CSF', 'SOC 2'], scopes: ['events:read', 'policy:write (gated)'], ocsf: ['Web Resources Activity (6001)'], setup: 20, blurb: 'Enterprise browser and browser-extension controls: last-mile data protection and session visibility.' },
  'Secrets & key management': { conn: 'PAM', envs: ['cloud', 'saas'], methods: ['API'], read: ['Secrets inventory', 'Leaked secrets', 'Key usage', 'Rotation status'], write: [w('Rotate secret', 'medium'), w('Revoke key', 'high')], powers: ['HexaSOC', 'HexaStrike', 'HexaComply'], frameworks: ['ISO 27001', 'PCI DSS', 'SOC 2', 'DORA'], scopes: ['secrets:read', 'rotate:write (gated)'], ocsf: ['Inventory Info (5001)'], setup: 20, blurb: 'Vaults, KMS/HSM and secret scanning: where secrets live, which leaked, and rotation as a gated action.' },
  'PKI & certificates': { conn: 'PAM', envs: ['onprem', 'cloud'], methods: ['API'], read: ['Certificates', 'Expiry and weak crypto', 'Issuing CAs', 'Machine identities'], write: [w('Renew certificate', 'low'), w('Revoke certificate', 'high')], powers: ['HexaSOC', 'HexaComply', 'HexaOT'], frameworks: ['ISO 27001', 'PCI DSS', 'NIS2', 'IEC 62443'], scopes: ['certs:read', 'lifecycle:write (gated)'], ocsf: ['Inventory Info (5001)'], setup: 25, blurb: 'Certificate and machine-identity lifecycle: no surprise expiries, weak keys found before auditors do.' },
  'Software supply chain': { conn: 'AppSec', envs: ['cloud', 'saas'], methods: ['API', 'Webhook'], read: ['SBOMs', 'Dependencies and licences', 'Malicious packages', 'Build provenance and signing'], write: [w('Block package version', 'medium'), w('Fail build on policy', 'medium')], powers: ['HexaStrike', 'HexaComply', 'HexaSOC'], frameworks: ['NIST SSDF', 'EU CRA', 'ISO 27001', 'FDA 524B'], scopes: ['sbom:read', 'policy:write (gated)'], ocsf: ['Vulnerability Finding (2002)'], setup: 25, blurb: 'Open-source and build-pipeline risk, SBOMs and provenance feeding HexaCore software supply chain views.' },
  'API security': { conn: 'AppSec', envs: ['cloud'], methods: ['API', 'Sensor'], read: ['API inventory', 'Shadow and zombie APIs', 'API attacks', 'Sensitive data in APIs'], write: [w('Block API client', 'medium')], powers: ['HexaSOC', 'HexaStrike', 'HexaComply'], frameworks: ['OWASP API Top 10', 'PCI DSS', 'ISO 27001'], scopes: ['apis:read', 'enforcement:write (gated)'], ocsf: ['API Activity (6003)'], setup: 30, blurb: 'API discovery, posture and runtime protection.' },
  'Container & Kubernetes': { conn: 'Cloud posture', envs: ['cloud'], methods: ['API', 'Agent'], read: ['Clusters and workloads', 'Runtime alerts', 'Image vulnerabilities', 'Admission policy violations'], write: [w('Kill workload', 'high'), w('Quarantine image', 'medium')], powers: ['HexaSOC', 'HexaStrike', 'HexaComply'], frameworks: ['CIS Kubernetes', 'ISO 27001', 'SOC 2', 'PCI DSS'], scopes: ['clusters:read', 'runtime:write (gated)'], ocsf: ['Detection Finding (2004)'], setup: 30, blurb: 'Kubernetes and container posture plus runtime detection.' },
  'SaaS security (SSPM)': { conn: 'Cloud posture', envs: ['saas'], methods: ['API'], read: ['SaaS misconfigurations', 'Third-party app grants', 'Over-shared data', 'Identity posture per app'], write: [w('Revoke OAuth grant', 'medium'), w('Restore secure setting', 'medium')], powers: ['HexaSOC', 'HexaComply', 'HexaAI'], frameworks: ['ISO 27001', 'SOC 2', 'NIST CSF'], scopes: ['posture:read', 'remediation:write (gated)'], ocsf: ['Compliance Finding (2003)'], setup: 20, blurb: 'Posture across the SaaS estate (M365, Salesforce, Workday, GitHub and more) with OAuth app control.' },
  'DSPM': { conn: 'DLP', envs: ['cloud', 'saas'], methods: ['API'], read: ['Data stores', 'Sensitive data classes', 'Access paths', 'Shadow data'], write: [w('Restrict access to data store', 'medium')], powers: ['HexaComply', 'HexaCustody', 'HexaAI'], frameworks: ['GDPR', 'HIPAA', 'PCI DSS', 'ISO 27001', 'DORA'], scopes: ['data:read', 'access:write (gated)'], ocsf: ['Data Security Finding (2006)'], setup: 25, blurb: 'Data security posture: where sensitive data lives across cloud and SaaS, and who can reach it.' },
  'DNS & web security': { conn: 'Network', envs: ['saas'], methods: ['API'], read: ['DNS queries', 'Blocked domains', 'Newly seen domains', 'Category policy'], write: [w('Block domain', 'low'), w('Unblock domain', 'medium')], powers: ['HexaSOC', 'HexaInt'], frameworks: ['ISO 27001', 'NIST CSF', 'Cyber Essentials'], scopes: ['dns:read', 'policy:write (gated)'], ocsf: ['DNS Activity (4003)'], setup: 10, blurb: 'Protective DNS and secure web gateway telemetry, with domain blocks pushed from HexaInt indicators.' },
  'WAF, DDoS & edge': { conn: 'Network', envs: ['saas', 'cloud'], methods: ['API'], read: ['WAF events', 'DDoS events', 'Rate-limit and bot signals', 'Edge certificates'], write: [w('Add WAF rule', 'medium'), w('Block IP range', 'medium')], powers: ['HexaSOC', 'HexaStrike'], frameworks: ['PCI DSS', 'ISO 27001', 'DORA'], scopes: ['events:read', 'rules:write (gated)'], ocsf: ['HTTP Activity (4002)'], setup: 15, blurb: 'Web application firewall, DDoS and edge protection for internet-facing services.' },
  'Fraud & bot protection': { conn: 'Network', envs: ['saas'], methods: ['API', 'Webhook'], read: ['Account takeover signals', 'Bot traffic', 'Payment fraud risk', 'Device reputation'], write: [w('Step-up challenge user', 'low'), w('Block session', 'medium')], powers: ['HexaSOC', 'HexaInt'], frameworks: ['PCI DSS', 'PSD2', 'ISO 27001'], scopes: ['signals:read', 'actions:write (gated)'], ocsf: ['Authentication (3002)'], setup: 20, blurb: 'Customer-facing fraud, bot and account-takeover signals correlated with identity and intel.' },
  'Digital risk & brand': { conn: 'Intelligence', envs: ['saas'], methods: ['API'], read: ['Lookalike domains', 'Impersonating accounts', 'Leaked data', 'Executive exposure'], write: [w('Request takedown', 'low')], powers: ['HexaInt', 'HexaSOC'], frameworks: ['ISO 27001', 'NIST CSF'], scopes: ['findings:read', 'takedowns:write (gated)'], ocsf: ['Detection Finding (2004)'], setup: 15, blurb: 'Brand, domain and executive protection outside the perimeter, feeding HexaInt.' },
  'Insider risk & UEBA': { conn: 'SIEM', envs: ['saas', 'cloud'], methods: ['API'], read: ['Risky users', 'Behaviour anomalies', 'Departing-employee activity', 'Peer-group deviations'], write: [w('Add user to watchlist', 'low'), w('Open insider case', 'low')], powers: ['HexaSOC', 'HexaComply'], frameworks: ['ISO 27001', 'NIST CSF', 'SOC 2'], scopes: ['users:read', 'cases:write (gated)'], ocsf: ['Detection Finding (2004)'], setup: 25, blurb: 'User and entity behaviour analytics and insider-risk programmes.' },
  'Forensics & IR': { conn: 'EDR / XDR', envs: ['onprem', 'cloud'], methods: ['API', 'Agent'], read: ['Evidence collections', 'Artefacts and timelines', 'Case notes', 'Chain of custody'], write: [w('Collect triage package', 'medium'), w('Preserve evidence', 'low')], powers: ['HexaSOC', 'HexaCustody', 'HexaComply'], frameworks: ['ISO 27037', 'ISO 27001', 'NIST CSF'], scopes: ['cases:read', 'collection:write (gated)'], ocsf: ['Incident Finding (2005)'], setup: 30, blurb: 'Digital forensics and incident response tooling; evidence lands in the HexaCustody chain of evidence.' },
  'Asset & CMDB': { conn: 'Asset / CMDB', envs: ['saas', 'onprem'], methods: ['API'], read: ['Configuration items', 'Owners and business services', 'Criticality', 'Relationships'], write: [w('Update CI owner', 'low'), w('Raise data-quality task', 'low')], powers: ['HexaSOC', 'HexaComply', 'HexaOT'], frameworks: ['ISO 27001', 'ISO 20000', 'NIS2', 'DORA'], scopes: ['cmdb:read', 'cmdb:write (gated)'], ocsf: ['Inventory Info (5001)'], setup: 25, blurb: 'CMDB and IT asset management: ownership and business-service context for every asset HexaCore sees.' },
  'Observability & log pipelines': { conn: 'SIEM', envs: ['cloud', 'saas'], methods: ['API', 'Kafka'], read: ['Pipeline health', 'Source volumes', 'Routing and filtering', 'Dropped events'], write: [w('Reroute source', 'medium'), w('Pause noisy source', 'low')], powers: ['HexaSOC'], frameworks: ['ISO 27001', 'SOC 2', 'NIST CSF'], scopes: ['pipelines:read', 'routes:write (gated)'], ocsf: ['Application Activity (6001)'], setup: 20, blurb: 'Telemetry pipelines and observability platforms: cost-aware routing and proof nothing is being dropped.' },
  'Collaboration & messaging': { conn: 'Email', envs: ['saas'], methods: ['API', 'Webhook'], read: ['External sharing', 'Connected apps', 'Message and file risk', 'Guest accounts'], write: [w('Remove external share', 'medium'), w('Post to channel', 'low')], powers: ['HexaSOC', 'HexaComply', 'HexaCustody'], frameworks: ['ISO 27001', 'SOC 2', 'GDPR'], scopes: ['activity:read', 'sharing:write (gated)'], ocsf: ['Application Activity (6001)'], setup: 15, blurb: 'Collaboration suites and chat: sharing risk, guest access and in-channel response notifications.' },
  'Physical security': { conn: 'OT', envs: ['onprem', 'cloud'], methods: ['API', 'Syslog'], read: ['Badge events', 'Door and alarm status', 'Camera health and analytics', 'Visitor logs'], write: [w('Lock door group', 'high'), w('Suspend badge', 'medium')], powers: ['HexaSOC', 'HexaOT', 'HexaComply'], frameworks: ['ISO 27001', 'NIS2', 'ISPS', 'SOC 2'], scopes: ['events:read', 'access:write (gated)'], ocsf: ['Entity Management (3004)'], setup: 35, blurb: 'Physical access control and video: badge-and-login correlation and site security evidence.' },
  'Privacy & consent': { conn: 'GRC', envs: ['saas'], methods: ['API'], read: ['Data maps', 'DSARs', 'Consent records', 'Privacy assessments'], write: [w('Open DSAR task', 'low')], powers: ['HexaComply', 'HexaCustody'], frameworks: ['GDPR', 'CCPA', 'PDPA', 'HIPAA', 'LGPD'], scopes: ['privacy:read', 'tasks:write (gated)'], ocsf: ['Compliance Finding (2003)'], setup: 20, blurb: 'Privacy operations: data maps, subject requests and consent evidence for regulators.' },
};

/* ---------------------------------------------------------------------
   Catalogue
   --------------------------------------------------------------------- */

interface Opt {
  /** keys: "token|token|!exclude"; default `${vendor}|${first product word}` */
  k?: string[];
  /** c = certified, p = partner, m = community */
  c?: 'c' | 'p' | 'm';
  e?: Env[];
  m?: ConnMethod[];
  r?: string[];
  w?: WriteAction[];
  cc?: ConnectorCategory;
  pop?: number;
  d?: string;
  s?: Sector[];
  pw?: Power[];
  f?: string[];
}
type Spec = [vendor: string, product: string, cat: MktCategory, o?: Opt];

const C = 'c' as const;
const M = 'm' as const;

const SPECS: Spec[] = [
  // SIEM
  ['Splunk', 'Enterprise Security', 'SIEM', { c: C, pop: 96, e: ['onprem', 'cloud'], k: ['splunk|enterprise security'], d: 'Correlation searches and notables; toggle and deploy searches under approval.' }],
  ['Microsoft', 'Sentinel', 'SIEM', { c: C, pop: 97, k: ['microsoft|sentinel'], d: 'Analytic rules and incidents; deploy and toggle scheduled rules (gated).' }],
  ['Google', 'Security Operations (SecOps)', 'SIEM', { c: C, pop: 84, k: ['google|security operations', 'google|secops'], d: 'YARA-L rules, detections and cases from Google SecOps.' }],
  ['Elastic', 'Security', 'SIEM', { c: C, pop: 78, e: ['cloud', 'onprem'], d: 'Detection rules, alerts and cases from Elastic Security.' }],
  ['IBM', 'QRadar SIEM', 'SIEM', { c: C, pop: 80, e: ['onprem'], k: ['qradar|!soar'], d: 'Offences, rules and log-source health from QRadar.' }],
  ['Sumo Logic', 'Cloud SIEM', 'SIEM', { pop: 58, k: ['sumo logic'] }],
  ['Exabeam', 'New-Scale SIEM', 'SIEM', { pop: 55 }],
  ['Securonix', 'Unified Defense SIEM', 'SIEM', { pop: 44 }],
  ['LogRhythm', 'SIEM', 'SIEM', { pop: 46, e: ['onprem'] }],
  ['Rapid7', 'InsightIDR', 'SIEM', { pop: 52, k: ['insightidr'] }],
  ['Wazuh', 'Open Source SIEM / XDR', 'SIEM', { c: M, pop: 41, e: ['onprem'], w: [] }],
  ['Cribl', 'Stream (telemetry pipeline)', 'SIEM', { pop: 49, w: [], r: ['Pipelines', 'Routes', 'Source health'], d: 'Telemetry pipeline health, so you know which logs reach which SIEM.' }],
  ['Splunk', 'SOAR', 'SIEM', { pop: 50, k: ['splunk|soar'], r: ['Playbooks', 'Containers', 'Action runs'], w: [w('Run playbook', 'medium')] }],
  ['Palo Alto Networks', 'Cortex XSIAM', 'SIEM', { c: C, pop: 64, k: ['xsiam'] }],

  // EDR / XDR
  ['CrowdStrike', 'Falcon Insight XDR', 'EDR / XDR', { c: C, pop: 95, k: ['crowdstrike|insight', 'crowdstrike|falcon|!identity|!intelligence|!cloud security'] }],
  ['Microsoft', 'Defender XDR', 'EDR / XDR', { c: C, pop: 97, k: ['microsoft|defender xdr', 'microsoft|defender for endpoint'] }],
  ['SentinelOne', 'Singularity XDR', 'EDR / XDR', { c: C, pop: 86, k: ['sentinelone'] }],
  ['Sophos', 'Intercept X / XDR', 'EDR / XDR', { c: C, pop: 66 }],
  ['Trellix', 'Endpoint Security (HX)', 'EDR / XDR', { pop: 52 }],
  ['VMware', 'Carbon Black Cloud', 'EDR / XDR', { pop: 55, k: ['carbon black'] }],
  ['Palo Alto Networks', 'Cortex XDR', 'EDR / XDR', { c: C, pop: 72, k: ['cortex xdr'] }],
  ['Trend Micro', 'Vision One', 'EDR / XDR', { pop: 58 }],
  ['Cisco', 'Secure Endpoint', 'EDR / XDR', { pop: 45, k: ['cisco|secure endpoint'] }],
  ['Jamf', 'Protect (macOS)', 'EDR / XDR', { pop: 36, d: 'macOS endpoint detections and compliance for creative and engineering fleets.', s: ['media'] }],
  ['Microsoft', 'Intune', 'Exposure / CAASM', { c: C, pop: 74, k: ['microsoft|intune'], r: ['Managed devices', 'Compliance state', 'Configuration profiles'], w: [w('Retire device', 'high'), w('Sync device', 'low')] }],

  // Identity
  ['Okta', 'Workforce Identity Cloud', 'Identity', { c: C, pop: 92, k: ['okta|workforce', 'okta|!governance'] }],
  ['Microsoft', 'Entra ID', 'Identity', { c: C, pop: 98, k: ['microsoft|entra'] }],
  ['Ping Identity', 'PingOne / PingFederate', 'Identity', { c: C, pop: 54, k: ['ping identity', 'pingone', 'pingfederate'] }],
  ['SailPoint', 'Identity Security Cloud', 'Identity', { c: C, pop: 66, r: ['Identities', 'Access certifications', 'Entitlements', 'Orphan accounts'], w: [w('Launch access review', 'low'), w('Revoke entitlement', 'medium', G.owner)] }],
  ['Saviynt', 'Enterprise Identity Cloud', 'Identity', { pop: 34, k: ['saviynt'] }],
  ['CrowdStrike', 'Falcon Identity Protection', 'Identity', { c: C, pop: 52, k: ['crowdstrike|identity'] }],
  ['Microsoft', 'Active Directory (on-prem)', 'Identity', { c: C, pop: 88, e: ['onprem'], m: ['Agent', 'API'], k: ['active directory'], r: ['Users', 'Groups', 'GPOs', 'Kerberos events', 'Tier 0 assets'] }],
  ['Silverfort', 'Identity Security', 'Identity', { pop: 33, e: ['onprem', 'saas'] }],
  ['Duo', 'Duo MFA (Cisco)', 'Identity', { pop: 58, k: ['duo'] }],
  ['Imprivata', 'OneSign (badge-tap SSO)', 'Identity', { c: C, pop: 30, e: ['onprem'], k: ['imprivata|onesign'], s: ['health'], d: 'Clinician tap-and-go sign-ins and shared workstation sessions.' }],
  ['IBM', 'RACF (z/OS via SMF)', 'Identity', { pop: 18, e: ['onprem'], m: ['Syslog'], k: ['racf'], s: ['finance', 'insurance'], w: [], d: 'Mainframe security events from SMF records over syslog.' }],

  ['Keyfactor', 'Command (PKI & certificate lifecycle)', 'PKI & certificates', { pop: 30, k: ['keyfactor'], r: ['Certificates', 'Expiry', 'Issuing CAs', 'Weak keys'], w: [w('Renew certificate', 'medium')], f: ['21 CFR Part 11', 'PCI DSS'] }],
  ['Yubico', 'YubiEnterprise (FIPS keys)', 'Identity', { pop: 20, k: ['yubico', 'yubienterprise'], r: ['Hardware keys', 'Assignments', 'Shipments'], w: [], s: ['defence', 'finance'] }],
  ['Workday', 'HCM (joiner, mover, leaver)', 'Identity', { pop: 42, k: ['workday'], r: ['Workers', 'Org changes', 'Terminations'], w: [], d: 'HR source of truth: leavers with live accounts become HexaView findings within the hour.' }],
  ['Cisco', 'Identity Services Engine (NAC)', 'Network & firewall', { c: C, pop: 44, k: ['cisco|identity services'], r: ['Endpoints', 'Posture', 'Authorisation sessions'], w: [w('Quarantine endpoint (ANC)', 'high')] }],

  // PAM
  ['CyberArk', 'Privilege Cloud', 'PAM', { c: C, pop: 80, k: ['cyberark|privilege cloud'] }],
  ['CyberArk', 'Privileged Access Manager (self-hosted)', 'PAM', { c: C, pop: 62, e: ['onprem'], k: ['cyberark|privileged access manager'] }],
  ['BeyondTrust', 'Privileged Remote Access', 'PAM', { c: C, pop: 56, e: ['onprem'], k: ['beyondtrust|remote access'], d: 'Vendor remote sessions with recording metadata; the vendor-access control behind most OT findings.' }],
  ['BeyondTrust', 'Password Safe', 'PAM', { pop: 44, k: ['beyondtrust|password safe'] }],
  ['Delinea', 'Secret Server', 'PAM', { c: C, pop: 50 }],
  ['HashiCorp', 'Vault', 'Secrets & key management', { pop: 52, e: ['cloud', 'onprem'], r: ['Secret engines', 'Auth methods', 'Audit device events'], w: [w('Revoke lease', 'medium')] }],
  ['Cyolo', 'Secure Remote Access for OT', 'PAM', { pop: 24, e: ['ot', 'onprem'], w: [], s: ['maritime', 'auto', 'pharma'] }],

  // Email
  ['Proofpoint', 'Email Protection & TAP', 'Email', { c: C, pop: 88, k: ['proofpoint|email', 'proofpoint|tap'] }],
  ['Mimecast', 'Email Security', 'Email', { c: C, pop: 72 }],
  ['Abnormal Security', 'Behavioural Email Security', 'Email', { c: C, pop: 62, k: ['abnormal'], w: [w('Remediate message', 'medium'), w('Mark as safe', 'low')] }],
  ['Microsoft', 'Defender for Office 365', 'Email', { c: C, pop: 90, k: ['defender for office'] }],
  ['Google', 'Workspace (Gmail & Drive)', 'Email', { c: C, pop: 70, k: ['google|workspace'], r: ['Gmail threats', 'Drive sharing', 'Admin audit', 'Users'] }],
  ['Check Point', 'Harmony Email & Collaboration', 'Email', { pop: 34, k: ['check point|harmony'] }],
  ['Valimail', 'DMARC Enforce', 'Email', { pop: 22, r: ['DMARC reports', 'Sending services', 'Lookalike domains'], w: [] }],

  // Awareness
  ['KnowBe4', 'Security Awareness & PhishER', 'Awareness', { c: C, pop: 78, k: ['knowbe4'] }],
  ['Proofpoint', 'Security Awareness (ZenGuide)', 'Awareness', { pop: 40, k: ['proofpoint|awareness'] }],
  ['Hoxhunt', 'Human Risk Platform', 'Awareness', { pop: 30 }],

  // Network & firewall
  ['Palo Alto Networks', 'Strata NGFW (Panorama)', 'Network & firewall', { c: C, pop: 90, k: ['palo alto|ngfw', 'palo alto|panorama'] }],
  ['Fortinet', 'FortiGate (FortiManager)', 'Network & firewall', { c: C, pop: 84, k: ['fortigate', 'fortimanager'] }],
  ['Check Point', 'Quantum NGFW', 'Network & firewall', { c: C, pop: 66, k: ['check point|quantum'] }],
  ['Cisco', 'Secure Firewall (FMC)', 'Network & firewall', { c: C, pop: 62, k: ['cisco|firewall'] }],
  ['Infoblox', 'BloxOne Threat Defense (DNS)', 'Network & firewall', { pop: 42, e: ['onprem', 'cloud'], r: ['DNS queries', 'Threat hits', 'IPAM'], w: [w('Add domain to RPZ', 'medium')] }],
  ['Corelight', 'Open NDR (Zeek)', 'NDR', { c: C, pop: 44, m: ['Sensor', 'API'], w: [], r: ['Network metadata', 'Detections', 'Encrypted-traffic insights'] }],
  ['ExtraHop', 'RevealX NDR', 'Network & firewall', { pop: 40, m: ['Sensor', 'API'], w: [] }],
  ['Vectra AI', 'Vectra AI Platform', 'Network & firewall', { pop: 46, k: ['vectra'], m: ['Sensor', 'API'] }],
  ['Darktrace', 'ActiveAI Security Platform', 'Network & firewall', { pop: 54, m: ['Sensor', 'API'] }],
  ['F5', 'BIG-IP Advanced WAF', 'Network & firewall', { pop: 36, k: ['f5|big ip'] }],
  ['Akamai', 'App & API Protector', 'Network & firewall', { pop: 38 }],

  // SASE / SSE
  ['Zscaler', 'Internet Access (ZIA)', 'SASE / SSE', { c: C, pop: 86, k: ['zscaler|zia'] }],
  ['Zscaler', 'Private Access (ZPA)', 'SASE / SSE', { c: C, pop: 78, k: ['zscaler|zpa'] }],
  ['Netskope', 'One SSE', 'SASE / SSE', { c: C, pop: 72, k: ['netskope|sse'] }],
  ['Palo Alto Networks', 'Prisma Access', 'SASE / SSE', { c: C, pop: 68, k: ['prisma access'] }],
  ['Cloudflare', 'Zero Trust (Access & Gateway)', 'SASE / SSE', { c: C, pop: 66, k: ['cloudflare|zero trust'] }],
  ['Cloudflare', 'WAF & DDoS', 'SASE / SSE', { pop: 58, k: ['cloudflare|waf'] }],
  ['Cato Networks', 'SASE Cloud', 'SASE / SSE', { pop: 40, k: ['cato'] }],
  ['Cisco', 'Umbrella / Secure Access', 'SASE / SSE', { pop: 46, k: ['umbrella', 'cisco|secure access'] }],
  ['Island', 'Enterprise Browser', 'SASE / SSE', { pop: 22, k: ['island'], s: ['finance', 'media'] }],

  // Cloud / CNAPP
  ['Wiz', 'Cloud Security', 'Cloud / CNAPP', { c: C, pop: 90, k: ['wiz'] }],
  ['Palo Alto Networks', 'Prisma Cloud', 'Cloud / CNAPP', { c: C, pop: 74, k: ['prisma cloud'] }],
  ['Orca Security', 'Cloud Security Platform', 'Cloud / CNAPP', { c: C, pop: 52, k: ['orca'] }],
  ['AWS', 'Security Hub', 'Cloud / CNAPP', { c: C, pop: 82, k: ['aws|security hub'] }],
  ['AWS', 'GuardDuty', 'Cloud / CNAPP', { c: C, pop: 78, k: ['aws|guardduty'], r: ['Findings', 'Malware scans', 'Runtime threats'], w: [w('Archive finding', 'low')] }],
  ['Microsoft', 'Defender for Cloud', 'Cloud / CNAPP', { c: C, pop: 84, k: ['defender for cloud'] }],
  ['Google', 'Security Command Center', 'Cloud / CNAPP', { c: C, pop: 58, k: ['security command center', 'google|scc'] }],
  ['CrowdStrike', 'Falcon Cloud Security', 'Cloud / CNAPP', { pop: 46, k: ['crowdstrike|cloud security'] }],
  ['Sysdig', 'Secure (CNAPP)', 'Cloud / CNAPP', { pop: 38 }],
  ['Aqua Security', 'Aqua Platform', 'Cloud / CNAPP', { pop: 34, k: ['aqua'] }],
  ['AWS', 'Inspector', 'Cloud / CNAPP', { pop: 50, k: ['aws|inspector'] }],

  // Cloud & SaaS platforms
  ['AWS', 'CloudTrail & Organizations', 'Cloud & SaaS platforms', { c: C, pop: 88, k: ['aws|cloudtrail'] }],
  ['Microsoft', 'Azure Activity & Resource Graph', 'Cloud & SaaS platforms', { c: C, pop: 80, k: ['azure activity', 'resource graph'] }],
  ['Google', 'Cloud Audit Logs (GCP)', 'Cloud & SaaS platforms', { c: C, pop: 60, k: ['google|cloud audit', 'gcp|audit'] }],
  ['Microsoft', '365 (Unified Audit Log)', 'Cloud & SaaS platforms', { c: C, pop: 92, e: ['saas'], k: ['microsoft 365|!gcc', 'm365', 'unified audit log'], cc: 'DLP', r: ['Unified audit log', 'SharePoint & OneDrive sharing', 'Teams external access', 'Mailbox rules'], w: [w('Remove inbox forwarding rule', 'medium')] }],
  ['Salesforce', 'Shield & Event Monitoring', 'Cloud & SaaS platforms', { pop: 54, e: ['saas'], cc: 'DLP', r: ['Login history', 'Report exports', 'Permission sets', 'API usage'], w: [w('Freeze user', 'medium')] }],
  ['Slack', 'Enterprise Grid Audit Logs', 'Cloud & SaaS platforms', { pop: 48, e: ['saas'], cc: 'DLP', r: ['Audit logs', 'External channels', 'App installs'], w: [w('Remove external member', 'medium')] }],
  ['GitHub', 'Enterprise Audit Log', 'Cloud & SaaS platforms', { pop: 50, e: ['saas'], k: ['github|audit'], cc: 'AppSec' }],
  ['Box', 'Shield & Enterprise Events', 'Cloud & SaaS platforms', { pop: 34, e: ['saas'], cc: 'DLP', s: ['media', 'pharma'] }],
  ['AppOmni', 'SaaS Security Posture', 'Cloud & SaaS platforms', { pop: 28, e: ['saas'], cc: 'Cloud posture' }],

  // Vulnerability
  ['Tenable', 'Vulnerability Management', 'Vulnerability', { c: C, pop: 90, k: ['tenable|vulnerability', 'tenable io', 'tenable|security center'] }],
  ['Qualys', 'VMDR', 'Vulnerability', { c: C, pop: 84, k: ['qualys|vmdr'] }],
  ['Rapid7', 'InsightVM', 'Vulnerability', { c: C, pop: 72, e: ['onprem', 'cloud'], k: ['insightvm'] }],
  ['Microsoft', 'Defender Vulnerability Management', 'Vulnerability', { pop: 58, k: ['defender vulnerability'] }],
  ['Tenable', 'Attack Surface Management', 'Vulnerability', { pop: 34, k: ['tenable|attack surface'] }],
  ['Censys', 'Attack Surface Management', 'Vulnerability', { pop: 30, k: ['censys'] }],

  // Exposure / CAASM
  ['runZero', 'Asset Discovery', 'Exposure / CAASM', { c: C, pop: 54, k: ['runzero'], e: ['onprem', 'cloud', 'ot'], d: 'Unauthenticated discovery across IT, OT and IoT; finds what every other tool misses.' }],
  ['Axonius', 'Asset Cloud', 'Exposure / CAASM', { c: C, pop: 60 }],
  ['ServiceNow', 'CMDB & Discovery', 'Exposure / CAASM', { c: C, pop: 74, k: ['servicenow|cmdb'] }],
  ['Lansweeper', 'IT Asset Management', 'Exposure / CAASM', { pop: 30 }],
  ['Navis', 'N4 TOS (asset context)', 'Maritime & logistics', { pop: 12, k: ['navis'], s: ['maritime'], cc: 'Asset / CMDB', d: 'Terminal operating system: cranes, gates and yard equipment as asset context.' }],
  ['SAP', 'S/4HANA & Enterprise Threat Detection', 'Exposure / CAASM', { pop: 28, e: ['onprem'], k: ['sap|threat detection', 'sap|s 4hana'], r: ['ERP security events', 'Privileged transactions', 'Critical authorisations'] }],

  // OT / IoT
  ['Claroty', 'xDome (OT/IoT)', 'OT / IoT', { c: C, pop: 72, k: ['claroty|xdome|!healthcare', 'claroty|ctd'] }],
  ['Armis', 'Centrix for OT/IoT', 'OT / IoT', { c: C, pop: 70, k: ['armis|!medical'] }],
  ['Dragos', 'Platform', 'OT / IoT', { c: C, pop: 70, k: ['dragos'] }],
  ['Forescout', 'eyeInspect & Platform', 'OT / IoT', { c: C, pop: 54, k: ['forescout'] }],
  ['Microsoft', 'Defender for IoT', 'OT / IoT', { c: C, pop: 60, k: ['microsoft|defender for iot|!sentinel'] }],
  ['TXOne Networks', 'Edge & Element', 'OT / IoT', { pop: 30, k: ['txone'] }],
  ['Tenable', 'OT Security', 'OT / IoT', { pop: 40, k: ['tenable|ot'] }],
  ['Siemens', 'SINEC Security Inspector', 'OT / IoT', { pop: 22, k: ['siemens|sinec'], s: ['auto', 'pharma'] }],
  ['Schneider Electric', 'EcoStruxure (BMS & power)', 'OT / IoT', { pop: 30, k: ['ecostruxure'], s: ['finance', 'health'] }],
  ['Rockwell Automation', 'FactoryTalk AssetCentre', 'OT / IoT', { pop: 24, k: ['rockwell', 'factorytalk'], s: ['auto', 'pharma'] }],
  ['Siemens', 'SIMATIC PCS 7 / WinCC audit', 'OT / IoT', { pop: 18, k: ['siemens|simatic', 'siemens|wincc'], s: ['pharma', 'auto'] }],
  ['Emerson', 'DeltaV Event Chronicle', 'OT / IoT', { pop: 14, k: ['deltav'], s: ['pharma'] }],
  ['AVEVA', 'PI System (process historian)', 'OT / IoT', { pop: 22, k: ['aveva', 'pi system'], s: ['pharma', 'auto'], r: ['Tag changes', 'Historian audit', 'Interface health'] }],
  ['Asimily', 'IoMT Risk Platform', 'Medical devices', { pop: 22, k: ['asimily'] }],

  // Medical devices
  ['Claroty', 'xDome for Healthcare (Medigate)', 'Medical devices', { c: C, pop: 58, k: ['claroty|healthcare', 'medigate'], s: ['health'] }],
  ['Cylera', 'MedCommand', 'Medical devices', { c: C, pop: 34, k: ['cylera'], s: ['health'] }],
  ['Armis', 'Centrix for Medical Devices', 'Medical devices', { pop: 34, k: ['armis|medical'], s: ['health'] }],
  ['Ordr', 'Connected Device Security', 'Medical devices', { pop: 26, k: ['ordr'], s: ['health'] }],

  // DLP & data
  ['Microsoft', 'Purview (DLP & Information Protection)', 'DLP & data', { c: C, pop: 86, k: ['microsoft|purview|!ai'] }],
  ['Varonis', 'Data Security Platform', 'DLP & data', { c: C, pop: 60, e: ['onprem', 'saas'] }],
  ['Cyera', 'Data Security Posture (DSPM)', 'DLP & data', { c: C, pop: 46 }],
  ['Netskope', 'Cloud DLP', 'DLP & data', { pop: 44, k: ['netskope|dlp'] }],
  ['Forcepoint', 'DLP', 'DLP & data', { pop: 42 }],
  ['BigID', 'Data Intelligence', 'DLP & data', { pop: 32 }],
  ['Imprivata', 'FairWarning (EHR access monitoring)', 'Healthcare', { c: C, pop: 34, k: ['fairwarning'], cc: 'DLP', s: ['health'] }],
  ['Code42', 'Incydr (insider risk)', 'DLP & data', { pop: 30, k: ['code42', 'incydr'], s: ['media', 'pharma'] }],
  ['Thales', 'CipherTrust Data Security', 'DLP & data', { pop: 24, k: ['ciphertrust'], s: ['finance', 'defence'] }],

  // AppSec
  ['GitHub', 'Advanced Security', 'AppSec', { c: C, pop: 66, k: ['github|advanced security'] }],
  ['Snyk', 'Code & Open Source', 'AppSec', { c: C, pop: 62, k: ['snyk'] }],
  ['Veracode', 'Application Security', 'AppSec', { c: C, pop: 48, k: ['veracode'] }],
  ['Checkmarx', 'One', 'AppSec', { pop: 44 }],
  ['GitLab', 'Ultimate Security', 'AppSec', { pop: 40 }],
  ['Black Duck', 'SCA & SBOM', 'AppSec', { pop: 34, k: ['black duck'], s: ['auto', 'health'] }],
  ['SonarSource', 'SonarQube', 'AppSec', { c: M, pop: 36, k: ['sonarqube', 'sonarsource'] }],
  ['Cybellum', 'Product Security (SBOM for devices)', 'AppSec', { pop: 16, s: ['auto', 'health'] }],

  // AI security
  ['Netskope', 'SkopeAI (GenAI governance)', 'AI security', { pop: 36, k: ['netskope|skopeai'] }],
  ['Protect AI', 'AI-SPM & Guardian', 'AI security', { pop: 30, k: ['protect ai'] }],
  ['HiddenLayer', 'AISec Platform', 'AI security', { pop: 24 }],
  ['Lakera', 'Guard', 'AI security', { pop: 22 }],
  ['Prompt Security', 'GenAI Security', 'AI security', { pop: 20, k: ['prompt security'] }],
  ['Microsoft', 'Purview AI Hub (DSPM for AI)', 'AI security', { c: C, pop: 40, k: ['purview ai', 'dspm for ai'] }],
  ['Wiz', 'AI-SPM', 'AI security', { pop: 34, k: ['wiz|ai'] }],
  ['Credo AI', 'Responsible AI Governance', 'AI security', { pop: 16, k: ['credo'], cc: 'GRC' }],
  ['Harmonic Security', 'Harmonic (GenAI data protection)', 'AI security', { c: C, pop: 38, k: ['harmonic'], m: ['API', 'Agent'], r: ['Sensitive data in prompts', 'Shadow AI apps and accounts', 'User nudges and coaching events', 'AI usage by team'], w: [w('Block upload of sensitive data to an AI app', 'medium'), w('Coach or warn the user in the browser', 'low')], d: 'Browser-level visibility of every GenAI app in use and the sensitive data sent to it; blocks or coaches in the moment.' }],
  ['Palo Alto Networks', 'Prisma AIRS (AI runtime security)', 'AI security', { c: C, pop: 42, k: ['prisma airs', 'palo alto|ai runtime'], e: ['cloud', 'saas'], r: ['AI apps, models and agents', 'Prompt-injection and data-leak detections', 'Model scan findings', 'AI red-team results'], w: [w('Block an AI app or model endpoint', 'medium'), w('Quarantine a model artefact', 'high')], d: 'AI posture, model scanning, runtime prompt and response inspection and automated AI red teaming.' }],
  ['Cisco', 'AI Defense', 'AI security', { pop: 34, k: ['cisco|ai defense'], r: ['AI application inventory', 'Runtime guardrail violations', 'Model validation findings'], w: [w('Apply guardrail policy to an AI app', 'medium')], d: 'Discovers AI apps and models, validates them and enforces runtime guardrails.' }],
  ['Zenity', 'AI agent security', 'AI security', { c: C, pop: 30, k: ['zenity'], r: ['Copilot and agent inventory', 'Agent permissions and data access', 'Risky agent actions', 'Low-code app findings'], w: [w('Disable an AI agent or connector', 'high'), w('Remove excessive agent permissions', 'medium')], d: 'Security for AI agents and copilots: what they can reach, what they did, and guardrails on what they may do next.' }],
  ['Noma Security', 'AI security & governance', 'AI security', { pop: 28, k: ['noma'], e: ['cloud', 'saas'], r: ['AI and agent inventory (AI-BOM)', 'AI supply-chain risks', 'Runtime detections'], d: 'AI-BOM across data and AI pipelines, with posture, supply-chain and runtime protection.' }],
  ['Pillar Security', 'AI security platform', 'AI security', { pop: 22, k: ['pillar security'], r: ['AI asset discovery', 'Guardrail events', 'Red-team findings'], d: 'Discovery, adaptive guardrails and continuous red teaming across the AI lifecycle.' }],
  ['Lasso Security', 'GenAI & agent security', 'AI security', { pop: 22, k: ['lasso security'], r: ['GenAI usage', 'Shadow AI', 'Prompt and response policy violations'], w: [w('Block a GenAI interaction by policy', 'medium')], d: 'Monitors and controls employee and application use of LLMs and AI agents.' }],
  ['Aim Security', 'GenAI security', 'AI security', { pop: 20, k: ['aim security'], r: ['AI app discovery', 'Sensitive-data exposure in prompts', 'Copilot risk findings'], d: 'Secure adoption of public GenAI, enterprise copilots and home-grown AI apps.' }],
  ['WitnessAI', 'Secure AI enablement', 'AI security', { pop: 18, k: ['witnessai', 'witness ai'], m: ['API', 'Agent'], r: ['AI activity by user and app', 'Intent-based policy events', 'Data-protection events'], d: 'Network-level observability and policy for every AI interaction across the enterprise.' }],
  ['F5', 'AI Guardrails (CalypsoAI)', 'AI security', { pop: 20, k: ['calypsoai', 'f5|ai guardrails'], e: ['cloud', 'onprem'], r: ['Inference-time guardrail events', 'Agentic red-team results'], d: 'Inference-time defence and red teaming for models and agents in production.' }],
  ['Mindgard', 'AI red teaming', 'AI security', { pop: 14, k: ['mindgard'], m: ['API'], r: ['Automated AI red-team findings', 'Model risk scores'], w: [], pw: ['HexaAI', 'HexaStrike', 'HexaComply'], d: 'Continuous automated red teaming of models and AI applications; findings feed HexaStrike and HexaAI.' }],
  ['Straiker', 'Agentic AI defense', 'AI security', { pop: 14, k: ['straiker'], r: ['Agent attack simulations', 'Runtime agent detections'], d: 'Attack simulation and runtime protection for agentic AI applications.' }],
  ['Cranium', 'AI exposure management', 'AI security', { pop: 12, k: ['cranium'], cc: 'GRC', r: ['AI system inventory', 'Third-party AI exposure', 'AI compliance evidence'], f: ['ISO 42001', 'EU AI Act', 'NIST AI RMF'], d: 'Maps first- and third-party AI systems and produces compliance evidence for AI governance.' }],

  // GRC
  ['ServiceNow', 'Integrated Risk Management (IRM)', 'GRC', { c: C, pop: 66, k: ['servicenow|irm', 'servicenow|integrated risk'] }],
  ['Archer', 'Archer IRM', 'GRC', { c: C, pop: 48 }],
  ['OneTrust', 'GRC & Privacy', 'GRC', { c: C, pop: 54, k: ['onetrust'] }],
  ['Vanta', 'Trust Management', 'GRC', { pop: 46 }],
  ['Drata', 'Compliance Automation', 'GRC', { pop: 40 }],
  ['AuditBoard', 'Connected Risk', 'GRC', { pop: 34 }],
  ['Generic', 'OSCAL (SSP & assessment results)', 'Standards', { c: C, pop: 30, k: ['oscal'], cc: 'GRC' }],

  // Ratings & TPRM
  ['BitSight', 'Security Ratings & TPRM', 'Ratings & TPRM', { c: C, pop: 60, k: ['bitsight'] }],
  ['SecurityScorecard', 'Supply-chain ratings', 'Ratings & TPRM', { c: C, pop: 56, k: ['securityscorecard'] }],
  ['UpGuard', 'Vendor Risk', 'Ratings & TPRM', { pop: 30 }],
  ['Black Kite', 'Third-Party Cyber Risk', 'Ratings & TPRM', { pop: 22, k: ['black kite'] }],
  ['ENX', 'TISAX label register', 'Ratings & TPRM', { pop: 10, k: ['enx', 'tisax'], s: ['auto'], m: ['File drop', 'API'] }],

  // ITSM
  ['ServiceNow', 'ITSM', 'ITSM', { c: C, pop: 94, k: ['servicenow|itsm'] }],
  ['ServiceNow', 'Security Incident Response (SecOps)', 'ITSM', { c: C, pop: 58, k: ['servicenow|secops', 'servicenow|security incident'] }],
  ['Atlassian', 'Jira Service Management', 'ITSM', { c: C, pop: 80, k: ['jira'] }],
  ['BMC', 'Helix ITSM', 'ITSM', { pop: 32, k: ['bmc|helix'] }],
  ['Ivanti', 'Neurons for ITSM', 'ITSM', { pop: 28, k: ['ivanti|itsm'] }],
  ['PagerDuty', 'Incident Response', 'ITSM', { pop: 46, r: ['Incidents', 'On-call schedules', 'Escalations'], w: [w('Page on-call responder', 'low')] }],

  // Backup & resilience
  ['Veeam', 'Backup & Replication', 'Backup & resilience', { c: C, pop: 82 }],
  ['Rubrik', 'Security Cloud', 'Backup & resilience', { c: C, pop: 66 }],
  ['Cohesity', 'DataProtect', 'Backup & resilience', { c: C, pop: 56 }],
  ['Commvault', 'Cloud (Metallic)', 'Backup & resilience', { c: C, pop: 50 }],
  ['Druva', 'Data Security Cloud', 'Backup & resilience', { pop: 30 }],
  ['Dell', 'PowerProtect Cyber Recovery', 'Backup & resilience', { pop: 30, k: ['powerprotect'] }],
  ['AWS', 'Backup', 'Backup & resilience', { pop: 40, k: ['aws|backup'], e: ['cloud'] }],

  // Threat intel
  ['Recorded Future', 'Intelligence Cloud', 'Threat intel', { c: C, pop: 72, k: ['recorded future'] }],
  ['Google', 'Threat Intelligence (Mandiant)', 'Threat intel', { c: C, pop: 66, k: ['mandiant', 'google|threat intelligence'] }],
  ['Flashpoint', 'Ignite', 'Threat intel', { pop: 40 }],
  ['MISP', 'MISP instance', 'Threat intel', { c: M, pop: 46, e: ['onprem'], m: ['API'] }],
  ['Generic', 'STIX / TAXII 2.1 (ISAC feeds)', 'Standards', { c: C, pop: 74, k: ['taxii'], cc: 'Intelligence', m: ['TAXII'], r: ['Indicators', 'Intrusion sets', 'Reports'] }],
  ['CrowdStrike', 'Falcon Intelligence', 'Threat intel', { pop: 48, k: ['crowdstrike|intelligence'] }],
  ['OpenCTI', 'OpenCTI platform', 'Threat intel', { c: M, pop: 34, e: ['onprem'] }],
  ['abuse.ch', 'URLhaus & ThreatFox', 'Threat intel', { c: M, pop: 38, k: ['abuse ch', 'threatfox'], w: [] }],
  ['CISA', 'KEV catalogue', 'Threat intel', { c: C, pop: 80, k: ['cisa|kev'], w: [], r: ['Known exploited vulnerabilities', 'Due dates'] }],

  // Validation / BAS
  ['Pentera', 'Automated Security Validation', 'Validation / BAS', { c: C, pop: 54 }],
  ['AttackIQ', 'Flex & Enterprise', 'Validation / BAS', { c: C, pop: 46, k: ['attackiq'] }],
  ['SafeBreach', 'Exposure Validation', 'Validation / BAS', { c: C, pop: 42 }],
  ['Cymulate', 'Exposure Management & Validation', 'Validation / BAS', { c: C, pop: 48 }],
  ['Picus Security', 'Security Validation Platform', 'Validation / BAS', { pop: 38, k: ['picus'] }],
  ['XM Cyber', 'Continuous Exposure Management', 'Validation / BAS', { pop: 34, k: ['xm cyber'] }],
  ['Horizon3.ai', 'NodeZero', 'Validation / BAS', { pop: 30, k: ['nodezero', 'horizon3'] }],
  ['Red Canary', 'Atomic Red Team', 'Validation / BAS', { c: M, pop: 32, e: ['onprem'], k: ['atomic red'] }],

  // Media & content
  ['IBM', 'Aspera on Cloud', 'Media & content', { c: C, pop: 30, k: ['aspera'], s: ['media'] }],
  ['Signiant', 'Media Shuttle & Jet', 'Media & content', { c: C, pop: 28, s: ['media'] }],
  ['Adobe', 'Frame.io', 'Media & content', { pop: 26, k: ['frame io'], s: ['media'] }],
  ['Avid', 'MediaCentral', 'Media & content', { pop: 18, k: ['avid'], e: ['onprem'], s: ['media'] }],
  ['MediaSilo', 'Secure Screeners', 'Media & content', { pop: 16, s: ['media'] }],
  ['NAGRA', 'NexGuard Forensic Watermarking', 'Media & content', { pop: 18, k: ['nexguard'], s: ['media'], r: ['Watermark sessions', 'Leak detections', 'Session-to-recipient map'] }],
  ['Irdeto', 'Piracy intelligence & ContentArmor', 'Media & content', { pop: 14, k: ['irdeto'], s: ['media'], r: ['Piracy detections', 'Takedowns', 'Watermark extractions'] }],
  ['MarkMonitor', 'Brand Protection', 'Threat intel', { pop: 20, k: ['markmonitor'], s: ['media'], r: ['Lookalike domains', 'Infringing listings', 'Takedowns'], w: [w('Request takedown', 'medium', G.grc)] }],
  ['Deadline','Render farm scheduler (AWS Thinkbox)', 'Media & content', { c: M, pop: 10, k: ['thinkbox'], e: ['onprem'], s: ['media'], cc: 'Asset / CMDB' }],

  // Healthcare
  ['Epic', 'Epic (audit trail via Clarity)', 'Healthcare', { c: C, pop: 34, k: ['epic'], s: ['health'] }],
  ['Oracle Health', 'Millennium (Cerner) audit', 'Healthcare', { pop: 24, k: ['cerner', 'oracle health'], s: ['health'] }],
  ['InterSystems', 'TrakCare / HealthShare audit', 'Healthcare', { pop: 16, k: ['intersystems', 'trakcare'], s: ['health'] }],
  ['Protenus', 'Healthcare Compliance Analytics', 'Healthcare', { pop: 14, s: ['health'] }],
  ['Imprivata', 'Privileged Access for Healthcare', 'Healthcare', { pop: 12, k: ['imprivata|privileged'], s: ['health'], cc: 'PAM' }],

  // Defence
  ['Microsoft', '365 GCC High', 'Defence', { c: C, pop: 18, k: ['microsoft 365 gcc high', 'm365 gcc high'], s: ['defence'] }],
  ['PreVeil', 'Encrypted Email & Drive (CUI)', 'Defence', { pop: 12, k: ['preveil'], s: ['defence'] }],
  ['Exostar', 'Supplier Risk & Identity', 'Defence', { pop: 12, k: ['exostar'], s: ['defence'] }],
  ['Siemens', 'Teamcenter PLM (export-controlled items)', 'Defence', { pop: 14, k: ['teamcenter'], s: ['defence', 'auto'], r: ['ITAR-tagged items', 'Access audit', 'Export classifications'] }],
  ['Deltek', 'Costpoint GovCloud', 'Defence', { pop: 10, k: ['costpoint'], s: ['defence'] }],
  ['Kiteworks', 'Private Data Network', 'Defence', { pop: 16, s: ['defence', 'pharma'] }],
  ['Titus', 'Classification (Fortra)', 'Defence', { pop: 12, k: ['titus'], s: ['defence'], cc: 'DLP' }],
  ['Splunk', 'Enterprise Security (air-gapped bundle)', 'Defence', { pop: 10, e: ['onprem'], k: ['splunk|air gapped'], m: ['File drop'], s: ['defence'], cc: 'SIEM' }],

  // Pharma & life sciences
  ['Veeva', 'Vault (QMS & Clinical)', 'Pharma & life sciences', { c: C, pop: 18, k: ['veeva'], s: ['pharma'] }],
  ['LabWare', 'LIMS', 'Pharma & life sciences', { pop: 12, s: ['pharma'] }],
  ['MasterControl', 'Quality Excellence', 'Pharma & life sciences', { pop: 12, s: ['pharma'] }],
  ['Benchling', 'R&D Cloud', 'Pharma & life sciences', { pop: 12, s: ['pharma'] }],
  ['Körber', 'Werum PAS-X MES (audit trail)', 'Pharma & life sciences', { pop: 10, k: ['werum', 'pas x'], s: ['pharma'] }],
  ['Vaisala', 'viewLinc environmental monitoring', 'Pharma & life sciences', { pop: 10, k: ['viewlinc'], e: ['ot', 'onprem'], s: ['pharma'] }],
  ['Medidata', 'Rave (clinical trials)', 'Pharma & life sciences', { pop: 12, s: ['pharma', 'health'] }],

  // Automotive
  ['Upstream', 'Vehicle SOC (vSOC)', 'Automotive', { c: C, pop: 16, s: ['auto'] }],
  ['VicOne', 'xNexus vSOC', 'Automotive', { pop: 10, s: ['auto'] }],
  ['Argus', 'Fleet Protection (Continental)', 'Automotive', { pop: 10, k: ['argus'], s: ['auto'] }],
  ['Excelfore', 'eSync OTA', 'Automotive', { pop: 8, s: ['auto'], k: ['esync', 'excelfore'] }],

  // Maritime & logistics
  ['Kongsberg', 'Vessel Insight', 'Maritime & logistics', { pop: 10, s: ['maritime'] }],
  ['Inmarsat', 'Fleet Secure Endpoint', 'Maritime & logistics', { pop: 10, s: ['maritime'] }],
  ['Marlink', 'Cyber Detection (VSAT)', 'Maritime & logistics', { pop: 10, s: ['maritime'] }],

  // Financial services
  ['SWIFT', 'Alliance Access (CSP logs)', 'Financial services', { c: C, pop: 18, k: ['swift|alliance'], s: ['finance'] }],
  ['FIS', 'Core banking audit', 'Financial services', { pop: 10, k: ['fis'], s: ['finance'] }],
  ['Featurespace', 'ARIC fraud signals', 'Financial services', { pop: 8, s: ['finance', 'insurance'] }],
  ['Guidewire', 'InsuranceSuite / Guidewire Cloud audit', 'Financial services', { pop: 8, k: ['guidewire'], s: ['insurance'] }],

  // Standards
  ['Generic', 'OCSF push (HTTPS / Kafka)', 'Standards', { c: C, pop: 70, k: ['generic|ocsf'], m: ['API', 'Kafka'] }],
  ['Generic', 'Syslog / CEF / LEEF collector', 'Standards', { c: C, pop: 82, k: ['generic|syslog'], m: ['Syslog'], cc: 'Network', e: ['onprem', 'ot'] }],
  ['Generic', 'SCIM 2.0 directory', 'Standards', { c: C, pop: 40, k: ['scim'], cc: 'Identity', e: ['saas'] }],
  ['Generic', 'Inbound webhook (JSON)', 'Standards', { c: C, pop: 52, k: ['webhook'], m: ['Webhook'] }],
  ['Generic', 'Amazon Security Lake (OCSF)', 'Standards', { c: C, pop: 36, k: ['security lake'], e: ['cloud'] }],

  // HexaShield first-party
  ['HexaShield', 'HexaOT sensors', 'HexaShield', { c: C, pop: 60, k: ['hexaot'], e: ['ot'], m: ['Sensor'], cc: 'OT', pw: ['HexaOT', 'HexaSOC', 'HexaComply'], r: ['Assets', 'Alerts', 'Vulnerabilities', 'Zones'], f: ['IEC 62443', 'NIS2', 'IACS E26/27', 'HPH CPGs'], d: 'HexaShield passive OT sensors, including store-and-forward and air-gapped modes. Read-only by policy.' }],
  ['HexaShield', 'HexaInt', 'HexaShield', { c: C, pop: 80, k: ['hexaint'], cc: 'Intelligence', pw: ['HexaInt', 'HexaSOC'], r: ['Indicators', 'Exposures', 'Dark web'], f: ['NIS2', 'DORA'] }],
  ['HexaShield', 'HexaStrike', 'HexaShield', { c: C, pop: 72, k: ['hexastrike'], cc: 'Validation', pw: ['HexaStrike', 'HexaSOC'], r: ['Validation results', 'Findings'], w: [w('Schedule test', 'medium')], f: ['DORA', 'TIBER-EU', 'ISO 27001'] }],
  ['HexaShield', 'HexaComply', 'HexaShield', { c: C, pop: 76, k: ['hexacomply'], cc: 'GRC', pw: ['HexaComply'], r: ['Frameworks', 'Controls', 'Evidence', 'Third-party risk'], w: [w('Attach evidence', 'low'), w('Update control status', 'medium', G.grc)], f: ['ISO 27001', 'NIS2', 'DORA', 'HIPAA', 'TPN'] }],
  ['HexaShield', 'HexaCustody agent', 'HexaShield', { c: C, pop: 40, k: ['hexacustody'], cc: 'Custody', pw: ['HexaCustody', 'HexaComply'], r: ['Custody events', 'Transfers'], w: [w('Revoke access', 'medium')], f: ['TPN', 'MPA CSBP', 'ITAR'] }],
  ['HexaShield', 'HexaAI inventory agent', 'HexaShield', { c: C, pop: 30, k: ['hexaai'], cc: 'AI', pw: ['HexaAI', 'HexaComply'], r: ['AI systems', 'Model cards', 'Usage'], f: ['ISO 42001', 'EU AI Act'] }],
  // ---- Expanded catalogue: more leading vendors per category ----
  ['Splunk', 'Cloud Platform', 'SIEM', { pop: 70 }],
  ['CrowdStrike', 'Falcon Next-Gen SIEM', 'SIEM', { pop: 66, k: ['crowdstrike|siem'] }],
  ['SentinelOne', 'Singularity AI SIEM', 'SIEM', { pop: 50, k: ['sentinelone|siem'] }],
  ['Microsoft', 'Defender XDR advanced hunting', 'SIEM', { pop: 60, k: ['defender|advanced hunting'] }],
  ['Fortinet', 'FortiSIEM', 'SIEM', { pop: 46 }],
  ['Trellix', 'Helix', 'SIEM', { pop: 34 }],
  ['Devo', 'Security Data Platform', 'SIEM', { pop: 34 }],
  ['Panther', 'Cloud-native SIEM', 'SIEM', { pop: 26 }],
  ['Hunters', 'SOC Platform', 'SIEM', { pop: 22 }],
  ['Anvilogic', 'Detection platform', 'SIEM', { pop: 18 }],
  ['Graylog', 'Security', 'SIEM', { pop: 26 }],
  ['ManageEngine', 'Log360', 'SIEM', { pop: 28 }],
  ['Gurucul', 'Next-Gen SIEM', 'SIEM', { pop: 20 }],
  ['Microsoft', 'Sentinel data lake', 'SIEM', { pop: 34, k: ['sentinel|data lake'] }],
  ['ESET', 'PROTECT / Inspect', 'EDR / XDR', { pop: 40 }],
  ['Bitdefender', 'GravityZone', 'EDR / XDR', { pop: 42 }],
  ['Cybereason', 'Defense Platform', 'EDR / XDR', { pop: 30 }],
  ['WatchGuard', 'EPDR', 'EDR / XDR', { pop: 22 }],
  ['Kaspersky', 'EDR Expert', 'EDR / XDR', { pop: 20 }],
  ['Elastic', 'Defend', 'EDR / XDR', { pop: 28, k: ['elastic|defend'] }],
  ['Huntress', 'Managed EDR', 'EDR / XDR', { pop: 34 }],
  ['Fortinet', 'FortiEDR', 'EDR / XDR', { pop: 30 }],
  ['ForgeRock (Ping)', 'Identity Platform', 'Identity', { pop: 30 }],
  ['IBM', 'Security Verify', 'Identity', { pop: 26 }],
  ['OneLogin', 'Workforce Identity', 'Identity', { pop: 24 }],
  ['JumpCloud', 'Directory Platform', 'Identity', { pop: 30 }],
  ['Omada', 'Identity Cloud', 'Identity', { pop: 18 }],
  ['Google', 'Cloud Identity', 'Identity', { pop: 36 }],
  ['Auth0 (Okta)', 'Customer Identity', 'Identity', { pop: 36, k: ['auth0'] }],
  ['RSA', 'SecurID', 'Identity', { pop: 32 }],
  ['HYPR', 'Passwordless', 'Identity', { pop: 18 }],
  ['Yubico', 'YubiKey enterprise', 'Identity', { pop: 24, k: ['yubico'] }],
  ['Delinea', 'Privileged Remote Access', 'PAM', { pop: 26 }],
  ['WALLIX', 'Bastion', 'PAM', { pop: 22 }],
  ['Keeper Security', 'KeeperPAM', 'PAM', { pop: 24 }],
  ['StrongDM', 'Infrastructure access', 'PAM', { pop: 22 }],
  ['Teleport', 'Access Platform', 'PAM', { pop: 22 }],
  ['ManageEngine', 'PAM360', 'PAM', { pop: 22 }],
  ['One Identity', 'Safeguard', 'PAM', { pop: 20 }],
  ['Netwrix', 'Privilege Secure', 'PAM', { pop: 18 }],
  ['Senhasegura', 'PAM', 'PAM', { pop: 14 }],
  ['Microsoft', 'Exchange Online Protection', 'Email', { pop: 54, k: ['exchange online'] }],
  ['Cisco', 'Secure Email', 'Email', { pop: 34 }],
  ['Barracuda', 'Email Protection', 'Email', { pop: 32 }],
  ['Sublime Security', 'Email Security', 'Email', { pop: 20 }],
  ['Material Security', 'Workspace Security', 'Email', { pop: 16 }],
  ['IRONSCALES', 'Email Security', 'Email', { pop: 22 }],
  ['Trend Micro', 'Email Security', 'Email', { pop: 24 }],
  ['Red Sift', 'OnDMARC', 'Email', { pop: 18 }],
  ['Avanan', 'Cloud Email Security', 'Email', { pop: 16 }],
  ['Mimecast', 'Awareness Training', 'Awareness', { pop: 26 }],
  ['SANS', 'Security Awareness', 'Awareness', { pop: 22 }],
  ['Infosec IQ', 'Awareness & phishing', 'Awareness', { pop: 18 }],
  ['Living Security', 'Human Risk', 'Awareness', { pop: 14 }],
  ['CybSafe', 'Human Risk', 'Awareness', { pop: 16 }],
  ['Riot', 'Security awareness', 'Awareness', { pop: 12 }],
  ['Arctic Wolf', 'Managed Security Awareness', 'Awareness', { pop: 16 }],
  ['NINJIO', 'Awareness', 'Awareness', { pop: 12 }],
  ['Terranova Security (Fortra)', 'Awareness', 'Awareness', { pop: 12 }],
  ['Curricula (Huntress)', 'Awareness', 'Awareness', { pop: 10 }],
  ['Juniper Networks', 'SRX & Mist', 'Network & firewall', { pop: 34 }],
  ['Sophos', 'Firewall', 'Network & firewall', { pop: 30 }],
  ['SonicWall', 'NSa / NSsp', 'Network & firewall', { pop: 28 }],
  ['WatchGuard', 'Firebox', 'Network & firewall', { pop: 20 }],
  ['Forcepoint', 'NGFW', 'Network & firewall', { pop: 18 }],
  ['Barracuda', 'CloudGen Firewall', 'Network & firewall', { pop: 18 }],
  ['Aruba (HPE)', 'ClearPass / Central', 'Network & firewall', { pop: 32, k: ['aruba'] }],
  ['Cisco', 'Meraki', 'Network & firewall', { pop: 36 }],
  ['Arista', 'Networks / CloudVision', 'Network & firewall', { pop: 26 }],
  ['Extreme Networks', 'ExtremeCloud', 'Network & firewall', { pop: 18 }],
  ['AlgoSec', 'Firewall policy management', 'Network & firewall', { pop: 22 }],
  ['Tufin', 'Orchestration Suite', 'Network & firewall', { pop: 22 }],
  ['FireMon', 'Security Manager', 'Network & firewall', { pop: 16 }],
  ['Illumio', 'Zero Trust Segmentation', 'Network & firewall', { pop: 30 }],
  ['Akamai', 'Guardicore Segmentation', 'Network & firewall', { pop: 24 }],
  ['Zero Networks', 'Segment', 'Network & firewall', { pop: 14 }],
  ['Fortinet', 'FortiSASE', 'SASE / SSE', { pop: 26 }],
  ['Versa Networks', 'Unified SASE', 'SASE / SSE', { pop: 18 }],
  ['iboss', 'Zero Trust SSE', 'SASE / SSE', { pop: 16 }],
  ['Skyhigh Security', 'SSE', 'SASE / SSE', { pop: 18 }],
  ['Check Point', 'Harmony SASE', 'SASE / SSE', { pop: 20 }],
  ['Broadcom', 'Symantec Web Security', 'SASE / SSE', { pop: 18 }],
  ['Twingate', 'Zero Trust Access', 'SASE / SSE', { pop: 18 }],
  ['Ivanti', 'Connect Secure', 'SASE / SSE', { pop: 26 }],
  ['Microsoft', 'Entra Global Secure Access', 'SASE / SSE', { pop: 24, k: ['global secure access'] }],
  ['SentinelOne', 'Singularity Cloud Security', 'Cloud / CNAPP', { pop: 26, k: ['sentinelone|cloud security'] }],
  ['Lacework (Fortinet)', 'FortiCNAPP', 'Cloud / CNAPP', { pop: 22, k: ['lacework'] }],
  ['Aqua Security', 'Platform', 'Cloud / CNAPP', { pop: 26 }],
  ['Upwind', 'Cloud Security', 'Cloud / CNAPP', { pop: 18 }],
  ['Check Point', 'CloudGuard', 'Cloud / CNAPP', { pop: 22 }],
  ['Tenable', 'Cloud Security', 'Cloud / CNAPP', { pop: 24, k: ['tenable|cloud'] }],
  ['Trend Micro', 'Cloud One', 'Cloud / CNAPP', { pop: 20 }],
  ['Uptycs', 'CNAPP', 'Cloud / CNAPP', { pop: 14 }],
  ['Sweet Security', 'Cloud runtime', 'Cloud / CNAPP', { pop: 12 }],
  ['Oracle', 'Cloud Guard', 'Cloud / CNAPP', { pop: 14 }],
  ['Oracle', 'Cloud Infrastructure audit', 'Cloud & SaaS platforms', { pop: 22, k: ['oracle|cloud infrastructure'] }],
  ['IBM', 'Cloud Security and Compliance Center', 'Cloud & SaaS platforms', { pop: 14, k: ['ibm|compliance center'] }],
  ['Alibaba Cloud', 'Security Center', 'Cloud & SaaS platforms', { pop: 12 }],
  ['Workday', 'Audit trail', 'Cloud & SaaS platforms', { pop: 26 }],
  ['SAP', 'Enterprise Threat Detection', 'Cloud & SaaS platforms', { pop: 26 }],
  ['ServiceNow', 'Platform audit', 'Cloud & SaaS platforms', { pop: 22, k: ['servicenow|audit'] }],
  ['Atlassian', 'Cloud audit log', 'Cloud & SaaS platforms', { pop: 26 }],
  ['GitLab', 'Audit events', 'Cloud & SaaS platforms', { pop: 22 }],
  ['Dropbox', 'Business audit', 'Cloud & SaaS platforms', { pop: 16 }],
  ['Zoom', 'Admin activity', 'Cloud & SaaS platforms', { pop: 18 }],
  ['Snowflake', 'Trust Center', 'Cloud & SaaS platforms', { pop: 22 }],
  ['Databricks', 'Audit logs', 'Cloud & SaaS platforms', { pop: 20 }],
  ['Okta', 'Workflows', 'Cloud & SaaS platforms', { pop: 14 }],
  ['Tenable', 'Nessus Professional', 'Vulnerability', { pop: 40, k: ['nessus'] }],
  ['CrowdStrike', 'Falcon Spotlight', 'Vulnerability', { pop: 30, k: ['spotlight'] }],
  ['Greenbone', 'OpenVAS', 'Vulnerability', { pop: 20 }],
  ['Nucleus Security', 'Vulnerability Management', 'Vulnerability', { pop: 18 }],
  ['Vulcan Cyber (Tenable)', 'Exposure Management', 'Vulnerability', { pop: 16 }],
  ['Kenna (Cisco)', 'Vulnerability Management', 'Vulnerability', { pop: 16 }],
  ['ArmorCode', 'ASPM & RBVM', 'Vulnerability', { pop: 14 }],
  ['Brinqa', 'Cyber Risk Graph', 'Vulnerability', { pop: 12 }],
  ['Invicti', 'DAST', 'Vulnerability', { pop: 18 }],
  ['Burp Suite (PortSwigger)', 'Enterprise DAST', 'Vulnerability', { pop: 20 }],
  ['Intruder', 'Vulnerability scanning', 'Vulnerability', { pop: 14 }],
  ['Palo Alto Networks', 'Cortex Xpanse', 'Exposure / CAASM', { pop: 26, k: ['xpanse'] }],
  ['Microsoft', 'Defender EASM', 'Exposure / CAASM', { pop: 22, k: ['defender easm'] }],
  ['CyCognito', 'External exposure', 'Exposure / CAASM', { pop: 18 }],
  ['Panaseer', 'Continuous Controls Monitoring', 'Exposure / CAASM', { pop: 16 }],
  ['JupiterOne', 'Cyber asset graph', 'Exposure / CAASM', { pop: 18 }],
  ['Noetic (Rapid7)', 'Cyber asset management', 'Exposure / CAASM', { pop: 12 }],
  ['Sevco Security', 'Asset intelligence', 'Exposure / CAASM', { pop: 12 }],
  ['XM Cyber', 'Exposure Management', 'Exposure / CAASM', { pop: 22 }],
  ['Cymulate', 'Exposure Management', 'Exposure / CAASM', { pop: 14 }],
  ['Shodan', 'Monitor', 'Exposure / CAASM', { pop: 16 }],
  ['Fortinet', 'FortiGate Rugged / OT', 'OT / IoT', { pop: 22, k: ['fortigate|rugged'] }],
  ['Siemens', 'SINEC Security Monitor', 'OT / IoT', { pop: 18 }],
  ['Rockwell Automation', 'FactoryTalk / Verve', 'OT / IoT', { pop: 18 }],
  ['Honeywell', 'Forge Cybersecurity+', 'OT / IoT', { pop: 16 }],
  ['Schneider Electric', 'EcoStruxure Cybersecurity', 'OT / IoT', { pop: 16, k: ['ecostruxure|cyber'] }],
  ['TXOne Networks', 'OT Defense', 'OT / IoT', { pop: 18 }],
  ['Asimily', 'IoT risk', 'OT / IoT', { pop: 14 }],
  ['Shieldworkz', 'OT monitoring', 'OT / IoT', { pop: 10 }],
  ['Phosphorus', 'xIoT', 'OT / IoT', { pop: 12 }],
  ['Ordr', 'Connected devices', 'OT / IoT', { pop: 16 }],
  ['Cisco', 'Cyber Vision', 'OT / IoT', { pop: 22 }],
  ['Waterfall Security', 'Unidirectional gateways', 'OT / IoT', { pop: 14 }],
  ['Opswat', 'MetaDefender OT', 'OT / IoT', { pop: 16 }],
  ['Ordr', 'Clinical devices', 'Medical devices', { pop: 14 }],
  ['Forescout', 'Healthcare', 'Medical devices', { pop: 12 }],
  ['Palo Alto Networks', 'Medical IoT Security', 'Medical devices', { pop: 14 }],
  ['Philips', 'Patient monitoring audit', 'Medical devices', { pop: 10 }],
  ['GE HealthCare', 'Device audit', 'Medical devices', { pop: 10 }],
  ['MedCrypt', 'Device security', 'Medical devices', { pop: 8 }],
  ['Symantec (Broadcom)', 'DLP', 'DLP & data', { pop: 28 }],
  ['Digital Guardian (Fortra)', 'DLP', 'DLP & data', { pop: 20 }],
  ['Proofpoint', 'Enterprise DLP', 'DLP & data', { pop: 22 }],
  ['Zscaler', 'Data Protection', 'DLP & data', { pop: 22, k: ['zscaler|data protection'] }],
  ['Nightfall AI', 'Data leak prevention', 'DLP & data', { pop: 14 }],
  ['Teramind', 'Insider DLP', 'DLP & data', { pop: 12 }],
  ['Imperva (Thales)', 'Data Security Fabric', 'DLP & data', { pop: 18 }],
  ['Egnyte', 'Secure & Govern', 'DLP & data', { pop: 14 }],
  ['Snyk', 'Developer Security', 'AppSec', { pop: 44 }],
  ['Synopsys / Black Duck', 'Polaris & Black Duck', 'AppSec', { pop: 30, k: ['black duck'] }],
  ['Semgrep', 'AppSec Platform', 'AppSec', { pop: 22 }],
  ['Mend.io', 'Application security', 'AppSec', { pop: 20 }],
  ['Contrast Security', 'Runtime security', 'AppSec', { pop: 16 }],
  ['Wiz', 'Code', 'AppSec', { pop: 18, k: ['wiz|code'] }],
  ['OX Security', 'ASPM', 'AppSec', { pop: 12 }],
  ['Cycode', 'ASPM', 'AppSec', { pop: 14 }],
  ['Apiiro', 'ASPM', 'AppSec', { pop: 14 }],
  ['HCL', 'AppScan', 'AppSec', { pop: 16 }],
  ['Archer', 'Integrated Risk Management', 'GRC', { pop: 30 }],
  ['MetricStream', 'Connected GRC', 'GRC', { pop: 20 }],
  ['LogicGate', 'Risk Cloud', 'GRC', { pop: 18 }],
  ['Hyperproof', 'Compliance operations', 'GRC', { pop: 16 }],
  ['Secureframe', 'Compliance automation', 'GRC', { pop: 16 }],
  ['SAP', 'GRC', 'GRC', { pop: 18 }],
  ['Diligent', 'HighBond', 'GRC', { pop: 16 }],
  ['IBM', 'OpenPages', 'GRC', { pop: 16 }],
  ['Prevalent (Mitratech)', 'Third-Party Risk', 'Ratings & TPRM', { pop: 18 }],
  ['Panorays', 'Third-party cyber risk', 'Ratings & TPRM', { pop: 16 }],
  ['RiskRecon (Mastercard)', 'Ratings', 'Ratings & TPRM', { pop: 18 }],
  ['ProcessUnity', 'Third-Party Risk', 'Ratings & TPRM', { pop: 14 }],
  ['Whistic', 'Vendor assessment', 'Ratings & TPRM', { pop: 14 }],
  ['OneTrust', 'Third-Party Risk', 'Ratings & TPRM', { pop: 22, k: ['onetrust|third-party'] }],
  ['CyberGRX (ProcessUnity)', 'Exchange', 'Ratings & TPRM', { pop: 12 }],
  ['Interos', 'Supply-chain risk', 'Ratings & TPRM', { pop: 12 }],
  ['Freshworks', 'Freshservice', 'ITSM', { pop: 22 }],
  ['ManageEngine', 'ServiceDesk Plus', 'ITSM', { pop: 22 }],
  ['Zendesk', 'Service', 'ITSM', { pop: 18 }],
  ['TOPdesk', 'Service management', 'ITSM', { pop: 14 }],
  ['Opsgenie (Atlassian)', 'Alerting', 'ITSM', { pop: 20 }],
  ['Splunk', 'On-Call', 'ITSM', { pop: 14 }],
  ['xMatters (Everbridge)', 'Incident alerting', 'ITSM', { pop: 14 }],
  ['Veeam', 'Data Platform', 'Backup & resilience', { pop: 44 }],
  ['Cohesity', 'Data Cloud', 'Backup & resilience', { pop: 30 }],
  ['Zerto (HPE)', 'Resilience', 'Backup & resilience', { pop: 18 }],
  ['Acronis', 'Cyber Protect', 'Backup & resilience', { pop: 18 }],
  ['Veritas (Cohesity)', 'NetBackup', 'Backup & resilience', { pop: 22 }],
  ['IBM', 'Storage Defender', 'Backup & resilience', { pop: 14 }],
  ['Keepit', 'SaaS backup', 'Backup & resilience', { pop: 12 }],
  ['Everbridge', 'Critical Event Management', 'Backup & resilience', { pop: 16 }],
  ['Mandiant (Google)', 'Threat Intelligence', 'Threat intel', { pop: 40 }],
  ['Microsoft', 'Defender Threat Intelligence', 'Threat intel', { pop: 30, k: ['defender threat intelligence'] }],
  ['Intel 471', 'TITAN', 'Threat intel', { pop: 18 }],
  ['Silobreaker', 'Intelligence platform', 'Threat intel', { pop: 12 }],
  ['ThreatConnect', 'Threat Intelligence Platform', 'Threat intel', { pop: 18 }],
  ['Anomali', 'ThreatStream', 'Threat intel', { pop: 18 }],
  ['ThreatQuotient', 'ThreatQ', 'Threat intel', { pop: 14 }],
  ['EclecticIQ', 'Intelligence Center', 'Threat intel', { pop: 12 }],
  ['Cyware', 'Threat intel platform', 'Threat intel', { pop: 14 }],
  ['OpenCTI (Filigran)', 'Threat intel platform', 'Threat intel', { pop: 18 }],
  ['MISP', 'Threat sharing', 'Threat intel', { pop: 22 }],
  ['VirusTotal (Google)', 'Enterprise', 'Threat intel', { pop: 30 }],
  ['GreyNoise', 'Intelligence', 'Threat intel', { pop: 16 }],
  ['Spur', 'IP context', 'Threat intel', { pop: 10 }],
  ['abuse.ch', 'Feeds', 'Threat intel', { pop: 14 }],
  ['AttackIQ', 'Breach & attack simulation', 'Validation / BAS', { pop: 26 }],
  ['XM Cyber', 'Attack path validation', 'Validation / BAS', { pop: 18 }],
  ['Scythe', 'Adversary emulation', 'Validation / BAS', { pop: 12 }],
  ['Mandiant (Google)', 'Security Validation', 'Validation / BAS', { pop: 16 }],
  ['Atomic Red Team (Red Canary)', 'Tests', 'Validation / BAS', { pop: 18 }],
  ['Prelude', 'Detect', 'Validation / BAS', { pop: 12 }],
  ['Hadrian', 'Offensive security', 'Validation / BAS', { pop: 12 }],
  ['Vectra AI', 'Platform', 'NDR', { pop: 34 }],
  ['ExtraHop', 'RevealX', 'NDR', { pop: 30 }],
  ['Cisco', 'Secure Network Analytics', 'NDR', { pop: 24 }],
  ['Arista', 'NDR', 'NDR', { pop: 16 }],
  ['Fortinet', 'FortiNDR', 'NDR', { pop: 14 }],
  ['Trellix', 'NDR', 'NDR', { pop: 12 }],
  ['Stamus Networks', 'Security Platform', 'NDR', { pop: 10 }],
  ['NetWitness', 'Network', 'NDR', { pop: 12 }],
  ['Gigamon', 'Deep Observability', 'NDR', { pop: 18 }],
  ['Plixer', 'Scrutinizer', 'NDR', { pop: 10 }],
  ['Microsoft', 'Defender for Identity', 'ITDR', { pop: 40, k: ['defender for identity'] }],
  ['Semperis', 'Directory Services Protector', 'ITDR', { pop: 22 }],
  ['SentinelOne', 'Singularity Identity', 'ITDR', { pop: 16, k: ['sentinelone|identity'] }],
  ['Netwrix', 'Identity Threat Detection', 'ITDR', { pop: 14 }],
  ['Quest', 'Security Guardian', 'ITDR', { pop: 12 }],
  ['Varonis', 'Identity Threat Detection', 'ITDR', { pop: 14 }],
  ['Oort (Cisco)', 'Identity Intelligence', 'ITDR', { pop: 10 }],
  ['Push Security', 'Identity attack detection', 'ITDR', { pop: 12 }],
  ['Palo Alto Networks', 'Cortex XSOAR', 'SOAR & automation', { pop: 40, k: ['xsoar'] }],
  ['Microsoft', 'Sentinel playbooks (Logic Apps)', 'SOAR & automation', { pop: 30, k: ['logic apps'] }],
  ['Google', 'SecOps SOAR', 'SOAR & automation', { pop: 22, k: ['secops|soar'] }],
  ['Tines', 'Automation', 'SOAR & automation', { pop: 26 }],
  ['Torq', 'Hyperautomation', 'SOAR & automation', { pop: 18 }],
  ['Swimlane', 'Turbine', 'SOAR & automation', { pop: 16 }],
  ['Fortinet', 'FortiSOAR', 'SOAR & automation', { pop: 14 }],
  ['IBM', 'QRadar SOAR', 'SOAR & automation', { pop: 16, k: ['qradar|soar'] }],
  ['D3 Security', 'Smart SOAR', 'SOAR & automation', { pop: 10 }],
  ['Blink', 'Ops automation', 'SOAR & automation', { pop: 8 }],
  ['n8n', 'Workflow automation', 'SOAR & automation', { pop: 10 }],
  ['Jamf', 'Pro & Protect', 'Mobile & endpoint management', { pop: 34 }],
  ['VMware (Omnissa)', 'Workspace ONE', 'Mobile & endpoint management', { pop: 26, k: ['workspace one'] }],
  ['Ivanti', 'Neurons for UEM / MobileIron', 'Mobile & endpoint management', { pop: 22 }],
  ['Kandji', 'Apple device management', 'Mobile & endpoint management', { pop: 16 }],
  ['ManageEngine', 'Endpoint Central', 'Mobile & endpoint management', { pop: 22 }],
  ['Lookout', 'Mobile Endpoint Security', 'Mobile & endpoint management', { pop: 18 }],
  ['Zimperium', 'Mobile Threat Defense', 'Mobile & endpoint management', { pop: 16 }],
  ['Google', 'Android Enterprise', 'Mobile & endpoint management', { pop: 18 }],
  ['IBM', 'MaaS360', 'Mobile & endpoint management', { pop: 12 }],
  ['Hexnode', 'UEM', 'Mobile & endpoint management', { pop: 10 }],
  ['Kolide (1Password)', 'Device trust', 'Mobile & endpoint management', { pop: 12 }],
  ['Microsoft', 'Configuration Manager (SCCM)', 'Patch & software management', { pop: 44, k: ['configuration manager'] }],
  ['Microsoft', 'Windows Autopatch', 'Patch & software management', { pop: 22 }],
  ['Tanium', 'Autonomous Endpoint Management', 'Patch & software management', { pop: 30 }],
  ['Ivanti', 'Neurons Patch Management', 'Patch & software management', { pop: 20 }],
  ['NinjaOne', 'Patch management', 'Patch & software management', { pop: 20 }],
  ['Automox', 'Autonomous IT', 'Patch & software management', { pop: 16 }],
  ['ManageEngine', 'Patch Manager Plus', 'Patch & software management', { pop: 18 }],
  ['BigFix (HCL)', 'Lifecycle', 'Patch & software management', { pop: 16 }],
  ['Action1', 'Patch management', 'Patch & software management', { pop: 12 }],
  ['Kaseya', 'VSA', 'Patch & software management', { pop: 14 }],
  ['ConnectWise', 'Automate', 'Patch & software management', { pop: 14 }],
  ['Red Hat', 'Satellite', 'Patch & software management', { pop: 14 }],
  ['Google', 'Chrome Enterprise Premium', 'Browser security', { pop: 26, k: ['chrome enterprise'] }],
  ['Talon (Palo Alto)', 'Prisma Access Browser', 'Browser security', { pop: 20, k: ['prisma access browser'] }],
  ['LayerX', 'Browser security', 'Browser security', { pop: 14 }],
  ['Menlo Security', 'Secure Enterprise Browser', 'Browser security', { pop: 16 }],
  ['Seraphic', 'Browser security', 'Browser security', { pop: 10 }],
  ['Microsoft', 'Edge for Business', 'Browser security', { pop: 18, k: ['edge for business'] }],
  ['Surf Security', 'Zero-trust browser', 'Browser security', { pop: 8 }],
  ['SquareX', 'Browser detection & response', 'Browser security', { pop: 10 }],
  ['Keep Aware', 'Browser security', 'Browser security', { pop: 8 }],
  ['AWS', 'Secrets Manager & KMS', 'Secrets & key management', { pop: 30, k: ['secrets manager'] }],
  ['Microsoft', 'Azure Key Vault', 'Secrets & key management', { pop: 30, k: ['key vault'] }],
  ['Google', 'Cloud KMS & Secret Manager', 'Secrets & key management', { pop: 20 }],
  ['CyberArk', 'Conjur & Secrets Hub', 'Secrets & key management', { pop: 20, k: ['conjur'] }],
  ['Akeyless', 'Secrets management', 'Secrets & key management', { pop: 14 }],
  ['1Password', 'Business & Secrets Automation', 'Secrets & key management', { pop: 22 }],
  ['Bitwarden', 'Secrets Manager', 'Secrets & key management', { pop: 14 }],
  ['GitGuardian', 'Secrets detection', 'Secrets & key management', { pop: 20 }],
  ['Thales', 'Luna HSM', 'Secrets & key management', { pop: 18 }],
  ['Entrust', 'nShield HSM', 'Secrets & key management', { pop: 16 }],
  ['Doppler', 'SecretOps', 'Secrets & key management', { pop: 10 }],
  ['Venafi (CyberArk)', 'Machine identity management', 'PKI & certificates', { pop: 26 }],
  ['DigiCert', 'Trust Lifecycle Manager', 'PKI & certificates', { pop: 26 }],
  ['Sectigo', 'Certificate Manager', 'PKI & certificates', { pop: 18 }],
  ['AppViewX', 'CERT+', 'PKI & certificates', { pop: 12 }],
  ['Entrust', 'PKIaaS', 'PKI & certificates', { pop: 14 }],
  ['Microsoft', 'Active Directory Certificate Services', 'PKI & certificates', { pop: 26, k: ['certificate services'] }],
  ['GlobalSign', 'Atlas', 'PKI & certificates', { pop: 12 }],
  ['Smallstep', 'Certificate manager', 'PKI & certificates', { pop: 8 }],
  ['HID', 'PKI', 'PKI & certificates', { pop: 10 }],
  ['Sonatype', 'Lifecycle & Firewall', 'Software supply chain', { pop: 24 }],
  ['JFrog', 'Xray & Curation', 'Software supply chain', { pop: 24 }],
  ['Socket', 'Supply-chain security', 'Software supply chain', { pop: 16 }],
  ['Chainguard', 'Images', 'Software supply chain', { pop: 16 }],
  ['Anchore', 'Enterprise', 'Software supply chain', { pop: 14 }],
  ['Endor Labs', 'Software supply chain', 'Software supply chain', { pop: 14 }],
  ['ReversingLabs', 'Spectra Assure', 'Software supply chain', { pop: 14 }],
  ['Legit Security', 'ASPM', 'Software supply chain', { pop: 10 }],
  ['Phylum (Veracode)', 'Package firewall', 'Software supply chain', { pop: 8 }],
  ['Kusari', 'Supply-chain insights', 'Software supply chain', { pop: 6 }],
  ['Sigstore', 'Signing & provenance', 'Software supply chain', { pop: 12 }],
  ['Finite State', 'Product security', 'Software supply chain', { pop: 10 }],
  ['Salt Security', 'API Protection', 'API security', { pop: 20 }],
  ['Noname (Akamai)', 'API Security', 'API security', { pop: 18 }],
  ['Traceable (Harness)', 'API security', 'API security', { pop: 16 }],
  ['Cequence', 'Unified API Protection', 'API security', { pop: 14 }],
  ['42Crunch', 'API security audit', 'API security', { pop: 12 }],
  ['Wallarm', 'API security', 'API security', { pop: 12 }],
  ['Imperva (Thales)', 'API Security', 'API security', { pop: 14 }],
  ['Cloudflare', 'API Shield', 'API security', { pop: 14 }],
  ['F5', 'Distributed Cloud API Security', 'API security', { pop: 14 }],
  ['Kong', 'Gateway security', 'API security', { pop: 14 }],
  ['Red Hat', 'Advanced Cluster Security', 'Container & Kubernetes', { pop: 20 }],
  ['Sysdig', 'Secure for Kubernetes', 'Container & Kubernetes', { pop: 18, k: ['sysdig|kubernetes'] }],
  ['Aqua Security', 'Kubernetes security', 'Container & Kubernetes', { pop: 16, k: ['aqua|kubernetes'] }],
  ['Palo Alto Networks', 'Prisma Cloud Compute', 'Container & Kubernetes', { pop: 18, k: ['prisma cloud compute'] }],
  ['Microsoft', 'Defender for Containers', 'Container & Kubernetes', { pop: 22, k: ['defender for containers'] }],
  ['AWS', 'GuardDuty EKS protection', 'Container & Kubernetes', { pop: 16, k: ['guardduty|eks'] }],
  ['Google', 'GKE Security Posture', 'Container & Kubernetes', { pop: 14 }],
  ['Kubescape (ARMO)', 'Kubernetes security', 'Container & Kubernetes', { pop: 10 }],
  ['NeuVector (SUSE)', 'Container security', 'Container & Kubernetes', { pop: 10 }],
  ['Falco', 'Runtime security', 'Container & Kubernetes', { pop: 16 }],
  ['Kyverno', 'Policy engine', 'Container & Kubernetes', { pop: 12 }],
  ['Open Policy Agent', 'Gatekeeper', 'Container & Kubernetes', { pop: 12 }],
  ['AppOmni', 'SaaS Security', 'SaaS security (SSPM)', { pop: 18 }],
  ['Obsidian Security', 'SaaS security', 'SaaS security (SSPM)', { pop: 16 }],
  ['Adaptive Shield (CrowdStrike)', 'SSPM', 'SaaS security (SSPM)', { pop: 16 }],
  ['Valence Security', 'SaaS security', 'SaaS security (SSPM)', { pop: 10 }],
  ['Grip Security', 'SaaS identity', 'SaaS security (SSPM)', { pop: 10 }],
  ['Reco', 'Dynamic SaaS security', 'SaaS security (SSPM)', { pop: 12 }],
  ['DoControl', 'SaaS data security', 'SaaS security (SSPM)', { pop: 10 }],
  ['Wing Security', 'SaaS security', 'SaaS security (SSPM)', { pop: 8 }],
  ['Microsoft', 'Defender for Cloud Apps', 'SaaS security (SSPM)', { pop: 30, k: ['defender for cloud apps'] }],
  ['Netskope', 'SSPM', 'SaaS security (SSPM)', { pop: 12, k: ['netskope|sspm'] }],
  ['Cyera', 'Data Security Platform', 'DSPM', { pop: 22 }],
  ['BigID', 'DSPM', 'DSPM', { pop: 18, k: ['bigid|dspm'] }],
  ['Sentra', 'Cloud data security', 'DSPM', { pop: 14 }],
  ['Securiti', 'Data Command Center', 'DSPM', { pop: 16 }],
  ['Wiz', 'DSPM', 'DSPM', { pop: 16, k: ['wiz|dspm'] }],
  ['Palo Alto Networks', 'Prisma Cloud DSPM', 'DSPM', { pop: 12, k: ['prisma cloud|dspm'] }],
  ['Normalyze (Proofpoint)', 'DSPM', 'DSPM', { pop: 10 }],
  ['Dig Security (Palo Alto)', 'DSPM', 'DSPM', { pop: 8 }],
  ['Rubrik', 'DSPM (Laminar)', 'DSPM', { pop: 12, k: ['rubrik|dspm'] }],
  ['Concentric AI', 'Semantic Intelligence', 'DSPM', { pop: 10 }],
  ['Microsoft', 'Purview DSPM', 'DSPM', { pop: 18, k: ['purview|dspm'] }],
  ['Cisco', 'Umbrella', 'DNS & web security', { pop: 34 }],
  ['Infoblox', 'Threat Defense', 'DNS & web security', { pop: 22, k: ['infoblox|threat defense'] }],
  ['Cloudflare', 'Gateway DNS', 'DNS & web security', { pop: 20, k: ['cloudflare|gateway'] }],
  ['DNSFilter', 'Protective DNS', 'DNS & web security', { pop: 12 }],
  ['Akamai', 'Secure Internet Access', 'DNS & web security', { pop: 12 }],
  ['Quad9', 'Protective DNS', 'DNS & web security', { pop: 10 }],
  ['EfficientIP', 'DNS Guardian', 'DNS & web security', { pop: 10 }],
  ['BlueCat', 'DNS', 'DNS & web security', { pop: 12 }],
  ['NCSC', 'Protective DNS (UK public sector)', 'DNS & web security', { pop: 8 }],
  ['Zscaler', 'Internet Access DNS', 'DNS & web security', { pop: 10, k: ['zscaler|dns'] }],
  ['Imperva (Thales)', 'Cloud WAF', 'WAF, DDoS & edge', { pop: 20, k: ['imperva|waf'] }],
  ['AWS', 'WAF & Shield', 'WAF, DDoS & edge', { pop: 24, k: ['aws|waf'] }],
  ['Microsoft', 'Azure Front Door & WAF', 'WAF, DDoS & edge', { pop: 20, k: ['front door'] }],
  ['Fastly', 'Next-Gen WAF', 'WAF, DDoS & edge', { pop: 16 }],
  ['Radware', 'Cloud WAF & DDoS', 'WAF, DDoS & edge', { pop: 16 }],
  ['NETSCOUT', 'Arbor DDoS', 'WAF, DDoS & edge', { pop: 16 }],
  ['Fortinet', 'FortiWeb', 'WAF, DDoS & edge', { pop: 14 }],
  ['Barracuda', 'WAF', 'WAF, DDoS & edge', { pop: 10 }],
  ['Google', 'Cloud Armor', 'WAF, DDoS & edge', { pop: 14 }],
  ['HUMAN Security', 'Bot defense', 'Fraud & bot protection', { pop: 16 }],
  ['Akamai', 'Bot Manager & Account Protector', 'Fraud & bot protection', { pop: 16 }],
  ['Cloudflare', 'Bot Management', 'Fraud & bot protection', { pop: 14 }],
  ['Kasada', 'Bot defense', 'Fraud & bot protection', { pop: 10 }],
  ['DataDome', 'Bot & fraud protection', 'Fraud & bot protection', { pop: 12 }],
  ['Arkose Labs', 'Account takeover', 'Fraud & bot protection', { pop: 12 }],
  ['BioCatch', 'Behavioural biometrics', 'Fraud & bot protection', { pop: 14 }],
  ['Feedzai', 'Fraud prevention', 'Fraud & bot protection', { pop: 12 }],
  ['Sardine', 'Fraud & compliance', 'Fraud & bot protection', { pop: 10 }],
  ['Sift', 'Digital trust', 'Fraud & bot protection', { pop: 12 }],
  ['ThreatMetrix (LexisNexis)', 'Digital identity', 'Fraud & bot protection', { pop: 14 }],
  ['Transmit Security', 'Mosaic', 'Fraud & bot protection', { pop: 12 }],
  ['ZeroFox', 'External cybersecurity', 'Digital risk & brand', { pop: 20 }],
  ['Digital Shadows (ReliaQuest)', 'GreyMatter DRP', 'Digital risk & brand', { pop: 14 }],
  ['Proofpoint', 'Digital risk protection', 'Digital risk & brand', { pop: 12 }],
  ['BrandShield', 'Brand protection', 'Digital risk & brand', { pop: 10 }],
  ['Netcraft', 'Takedown', 'Digital risk & brand', { pop: 16 }],
  ['Cyberint (Check Point)', 'Argos', 'Digital risk & brand', { pop: 12 }],
  ['SOCRadar', 'Extended threat intel', 'Digital risk & brand', { pop: 14 }],
  ['PhishLabs (Fortra)', 'Digital risk', 'Digital risk & brand', { pop: 12 }],
  ['Bolster', 'Brand protection', 'Digital risk & brand', { pop: 10 }],
  ['Doppel', 'Impersonation defence', 'Digital risk & brand', { pop: 10 }],
  ['DeleteMe', 'Executive data removal', 'Digital risk & brand', { pop: 10 }],
  ['Constella', 'Identity risk intelligence', 'Digital risk & brand', { pop: 10 }],
  ['Microsoft', 'Purview Insider Risk Management', 'Insider risk & UEBA', { pop: 22, k: ['insider risk'] }],
  ['Proofpoint', 'Insider Threat Management', 'Insider risk & UEBA', { pop: 16 }],
  ['DTEX Systems', 'InTERCEPT', 'Insider risk & UEBA', { pop: 14 }],
  ['Securonix', 'UEBA', 'Insider risk & UEBA', { pop: 12, k: ['securonix|ueba'] }],
  ['Exabeam', 'UEBA', 'Insider risk & UEBA', { pop: 12, k: ['exabeam|ueba'] }],
  ['Forcepoint', 'Insider Threat', 'Insider risk & UEBA', { pop: 10 }],
  ['Teramind', 'Insider risk', 'Insider risk & UEBA', { pop: 10 }],
  ['Gurucul', 'UEBA', 'Insider risk & UEBA', { pop: 8 }],
  ['Splunk', 'User Behavior Analytics', 'Insider risk & UEBA', { pop: 12, k: ['splunk|ueba'] }],
  ['Velociraptor (Rapid7)', 'DFIR', 'Forensics & IR', { pop: 20 }],
  ['Magnet Forensics', 'AXIOM Cyber', 'Forensics & IR', { pop: 18 }],
  ['Cellebrite', 'Enterprise Solutions', 'Forensics & IR', { pop: 14 }],
  ['Exterro', 'FTK & Forensic Toolkit', 'Forensics & IR', { pop: 12 }],
  ['OpenText', 'EnCase Forensic', 'Forensics & IR', { pop: 14 }],
  ['Cado Security (Darktrace)', 'Cloud forensics', 'Forensics & IR', { pop: 10 }],
  ['Binalyze', 'AIR', 'Forensics & IR', { pop: 12 }],
  ['Belkasoft', 'Evidence Center', 'Forensics & IR', { pop: 8 }],
  ['Volatility', 'Memory forensics', 'Forensics & IR', { pop: 10 }],
  ['KAPE (Kroll)', 'Triage collection', 'Forensics & IR', { pop: 12 }],
  ['Axonius', 'Asset Management', 'Asset & CMDB', { pop: 30, k: ['axonius|asset'] }],
  ['Flexera', 'One', 'Asset & CMDB', { pop: 18 }],
  ['Device42 (Freshworks)', 'Discovery & CMDB', 'Asset & CMDB', { pop: 14 }],
  ['BMC', 'Helix Discovery', 'Asset & CMDB', { pop: 14 }],
  ['Ivanti', 'Neurons for ITAM', 'Asset & CMDB', { pop: 12 }],
  ['ManageEngine', 'AssetExplorer', 'Asset & CMDB', { pop: 12 }],
  ['Snipe-IT', 'Asset management', 'Asset & CMDB', { pop: 10 }],
  ['Cribl', 'Stream & Lake', 'Observability & log pipelines', { pop: 30 }],
  ['Datadog', 'Cloud SIEM & Logs', 'Observability & log pipelines', { pop: 30 }],
  ['Splunk', 'Observability Cloud', 'Observability & log pipelines', { pop: 18, k: ['splunk|observability'] }],
  ['Elastic', 'Observability', 'Observability & log pipelines', { pop: 16, k: ['elastic|observability'] }],
  ['Dynatrace', 'Platform', 'Observability & log pipelines', { pop: 20 }],
  ['New Relic', 'Observability', 'Observability & log pipelines', { pop: 16 }],
  ['Grafana Labs', 'Loki & Cloud', 'Observability & log pipelines', { pop: 18 }],
  ['Sumo Logic', 'Log analytics', 'Observability & log pipelines', { pop: 14, k: ['sumo logic|log'] }],
  ['Edge Delta', 'Telemetry pipelines', 'Observability & log pipelines', { pop: 10 }],
  ['Observo AI', 'Data pipelines', 'Observability & log pipelines', { pop: 8 }],
  ['Tenzir', 'Security data pipelines', 'Observability & log pipelines', { pop: 8 }],
  ['Confluent', 'Kafka', 'Observability & log pipelines', { pop: 16 }],
  ['Microsoft', 'Teams', 'Collaboration & messaging', { pop: 50, k: ['microsoft|teams'] }],
  ['Slack (Salesforce)', 'Enterprise Grid', 'Collaboration & messaging', { pop: 40, k: ['slack'] }],
  ['Zoom', 'Workplace', 'Collaboration & messaging', { pop: 24 }],
  ['Atlassian', 'Confluence', 'Collaboration & messaging', { pop: 22 }],
  ['Box', 'Content Cloud', 'Collaboration & messaging', { pop: 20 }],
  ['Dropbox', 'Business', 'Collaboration & messaging', { pop: 16 }],
  ['Webex (Cisco)', 'Suite', 'Collaboration & messaging', { pop: 16 }],
  ['Mattermost', 'Enterprise', 'Collaboration & messaging', { pop: 10 }],
  ['Wire', 'Secure messaging', 'Collaboration & messaging', { pop: 8 }],
  ['Symphony', 'Regulated messaging', 'Collaboration & messaging', { pop: 10 }],
  ['Smarsh', 'Communications archiving', 'Collaboration & messaging', { pop: 12 }],
  ['Genetec', 'Security Center', 'Physical security', { pop: 20 }],
  ['Verkada', 'Command', 'Physical security', { pop: 18 }],
  ['Johnson Controls', 'C·CURE & Software House', 'Physical security', { pop: 16 }],
  ['LenelS2 (Honeywell)', 'OnGuard', 'Physical security', { pop: 16 }],
  ['HID', 'Origo & SAFE', 'Physical security', { pop: 14 }],
  ['Axis Communications', 'Camera Station', 'Physical security', { pop: 14 }],
  ['Milestone', 'XProtect', 'Physical security', { pop: 14 }],
  ['Brivo', 'Access', 'Physical security', { pop: 10 }],
  ['Gallagher', 'Command Centre', 'Physical security', { pop: 12 }],
  ['Avigilon (Motorola)', 'Unity & Alta', 'Physical security', { pop: 12 }],
  ['Envoy', 'Visitors', 'Physical security', { pop: 10 }],
  ['Openpath (Motorola)', 'Access', 'Physical security', { pop: 8 }],
  ['OneTrust', 'Privacy Automation', 'Privacy & consent', { pop: 26, k: ['onetrust|privacy'] }],
  ['TrustArc', 'Privacy Platform', 'Privacy & consent', { pop: 16 }],
  ['Securiti', 'Privacy Ops', 'Privacy & consent', { pop: 14, k: ['securiti|privacy'] }],
  ['Transcend', 'Data privacy infrastructure', 'Privacy & consent', { pop: 10 }],
  ['BigID', 'Privacy suite', 'Privacy & consent', { pop: 12, k: ['bigid|privacy'] }],
  ['Osano', 'Consent & privacy', 'Privacy & consent', { pop: 10 }],
  ['Ketch', 'Privacy & consent', 'Privacy & consent', { pop: 8 }],
  ['DataGrail', 'Privacy', 'Privacy & consent', { pop: 10 }],
  ['Usercentrics', 'Consent management', 'Privacy & consent', { pop: 10 }],
  ['Didomi', 'Consent', 'Privacy & consent', { pop: 8 }],
  ['SWIFT', 'Customer Security Programme attestation', 'Financial services', { pop: 16, k: ['swift|csp'] }],
  ['Temenos', 'Transact audit', 'Financial services', { pop: 10 }],
  ['Finastra', 'Platform audit', 'Financial services', { pop: 8 }],
  ['NICE Actimize', 'Fraud & AML', 'Financial services', { pop: 12 }],
  ['Nasdaq Verafin', 'Fraud detection', 'Financial services', { pop: 10 }],
  ['Bloomberg', 'Terminal entitlements', 'Financial services', { pop: 10 }],
  ['Murex', 'Audit', 'Financial services', { pop: 8 }],
  ['Exostar', 'Managed Access Gateway', 'Defence', { pop: 14, k: ['exostar'] }],
  ['Summit 7', 'CMMC compliance', 'Defence', { pop: 10 }],
  ['Totem Technologies', 'CMMC tools', 'Defence', { pop: 8 }],
  ['Virtru', 'Data-centric security', 'Defence', { pop: 12 }],
  ['IQVIA', 'Clinical data audit', 'Pharma & life sciences', { pop: 12 }],
  ['Benchling', 'R&D platform', 'Pharma & life sciences', { pop: 12 }],
  ['Dotmatics', 'Scientific R&D', 'Pharma & life sciences', { pop: 8 }],
  ['Thermo Fisher', 'SampleManager LIMS', 'Pharma & life sciences', { pop: 10 }],
  ['Argus Cyber Security (Continental)', 'Vehicle security', 'Automotive', { pop: 12 }],
  ['ETAS (Bosch)', 'ESCRYPT', 'Automotive', { pop: 10 }],
  ['Karamba Security', 'Embedded security', 'Automotive', { pop: 8 }],
  ['Vector', 'Security for ECUs', 'Automotive', { pop: 8 }],
  ['C2A Security', 'EVSec', 'Automotive', { pop: 6 }],
  ['KVH', 'Cyber security for vessels', 'Maritime & logistics', { pop: 8 }],
  ['Wärtsilä', 'Fleet operations audit', 'Maritime & logistics', { pop: 8 }],
  ['DNV', 'Cyber secure class notation', 'Maritime & logistics', { pop: 10 }],
  ['Navis', 'N4 terminal audit', 'Maritime & logistics', { pop: 8 }],
  ['CargoSmart', 'Logistics platform audit', 'Maritime & logistics', { pop: 6 }],
  ['Aspera (IBM)', 'High-speed transfer', 'Media & content', { pop: 18, k: ['aspera'] }],
  ['Frame.io (Adobe)', 'Review & approval', 'Media & content', { pop: 16, k: ['frame.io'] }],
  ['Irdeto', 'Content protection', 'Media & content', { pop: 12 }],
  ['Moxion (Autodesk)', 'Dailies', 'Media & content', { pop: 10, k: ['moxion'] }],
  ['Indee', 'Secure screeners', 'Media & content', { pop: 10, k: ['indee'] }],
  ['Friend MTS', 'Anti-piracy', 'Media & content', { pop: 10 }],
];

/* ---------------------------------------------------------------------
   Build
   --------------------------------------------------------------------- */

export function norm(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function parseKeys(vendor: string, product: string, k?: string[]): string[][] {
  if (k) return k.map((x) => x.split('|').map((t) => t.trim()));
  const first = product.split(/[\s(/]+/).find((t) => t.length > 1) ?? product;
  return [[vendor, first].map((t) => t.toLowerCase())];
}
function displayName(vendor: string, product: string): string {
  if (vendor === 'Generic' || vendor === 'HexaShield') return product;
  if (product.toLowerCase().startsWith(vendor.toLowerCase())) return product;
  return `${vendor} ${product}`;
}

const CERT_MAP = { c: 'HexaView-certified', p: 'Partner-built', m: 'Community' } as const;

function build(spec: Spec, i: number): Listing {
  const [vendor, product, category, o = {}] = spec;
  const d = CAT[category];
  const id = slug(`${vendor}-${product}`).slice(0, 48) || `l-${i}`;
  const r = rng(`mkt-listing-${id}`);
  const pop = o.pop ?? r.int(14, 50);
  const cert: Cert = CERT_MAP[o.c ?? 'p'];
  const envs = o.e ?? d.envs;
  const ot = envs.length === 1 && envs[0] === 'ot';
  const write = ot ? [] : (o.w ?? d.write);
  const readBase = o.r ?? d.read;
  const methods = o.m ?? d.methods;
  const setupMin = Math.max(5, Math.round((d.setup * (methods.includes('Sensor') ? 1.2 : 1) * r.float(0.7, 1.3, 2)) / 5) * 5);
  return {
    id,
    vendor,
    product,
    name: displayName(vendor, product),
    category,
    connCategory: o.cc ?? d.conn,
    envs,
    read: readBase,
    write,
    methods,
    cert,
    setupMin,
    popularity: pop,
    installs: Math.round(pop * pop * 0.42 + r.int(3, 40)),
    rating: Math.min(4.9, Math.round((3.7 + pop / 100 * 0.9 + r.float(-0.2, 0.25, 2)) * 10) / 10),
    reviews: Math.round(pop * r.float(0.8, 2.4, 2)) + 2,
    powers: o.pw ?? d.powers,
    frameworks: [...new Set([...(o.f ?? []), ...d.frameworks])],
    scopes: write.length ? d.scopes : d.scopes.filter((s) => !s.includes('(gated)')),
    ocsf: d.ocsf,
    blurb: o.d ?? d.blurb,
    sectors: o.s ?? [],
    version: `${r.int(1, 3)}.${r.int(0, 9)}.${r.int(0, 12)}`,
    updatedDays: r.int(1, cert === 'Community' ? 140 : 45),
    keys: parseKeys(vendor, product, o.k),
  };
}

/** The public catalogue (same for every customer). */
export const CATALOGUE_LISTINGS: Listing[] = (() => {
  const seen = new Set<string>();
  return SPECS.map(build).map((l) => {
    let id = l.id;
    let n = 2;
    while (seen.has(id)) id = `${l.id}-${n++}`;
    seen.add(id);
    return { ...l, id };
  });
})();

/* ---------------------------------------------------------------------
   Matching against a customer's connectors
   --------------------------------------------------------------------- */

export function keyMatches(keys: string[][], name: string): boolean {
  const n = norm(name);
  return keys.some((ks) => ks.every((t) => (t.startsWith('!') ? !n.includes(norm(t.slice(1))) : n.includes(norm(t)))));
}
export function connectorFullName(k: { vendor: string; product: string }): string {
  return `${k.vendor} ${k.product}`;
}
export function listingMatchesConnector(l: Listing, k: Connector): boolean {
  return keyMatches(l.keys, connectorFullName(k));
}

const CONN_TO_MKT: Record<ConnectorCategory, MktCategory> = {
  SIEM: 'SIEM', 'EDR / XDR': 'EDR / XDR', Identity: 'Identity', PAM: 'PAM', 'Cloud posture': 'Cloud / CNAPP', Vulnerability: 'Vulnerability',
  OT: 'OT / IoT', GRC: 'GRC', Intelligence: 'Threat intel', Email: 'Email', Network: 'Network & firewall', SASE: 'SASE / SSE', ITSM: 'ITSM',
  Validation: 'Validation / BAS', Custody: 'Media & content', Backup: 'Backup & resilience', DLP: 'DLP & data', AppSec: 'AppSec', AI: 'AI security',
  HexaShield: 'HexaShield', 'Asset / CMDB': 'Exposure / CAASM', Ratings: 'Ratings & TPRM',
};

/** Private listing for a connector the public catalogue does not recognise. */
function privateListing(k: Connector): Listing {
  const base = CAT[CONN_TO_MKT[k.category]] ?? CAT.Private;
  const name = k.vendor === 'Generic' || k.vendor === 'HexaShield' ? k.product : `${k.vendor} ${k.product}`;
  return {
    id: `private-${slug(name)}`,
    vendor: k.vendor,
    product: k.product,
    name,
    category: 'Private',
    connCategory: k.category,
    envs: [k.env],
    read: k.read.length ? k.read : base.read,
    write: k.write.map((x) => w(x, 'medium')),
    methods: k.env === 'ot' ? ['Sensor'] : base.methods,
    cert: 'Community',
    setupMin: base.setup,
    popularity: 4,
    installs: 1,
    rating: 0,
    reviews: 0,
    powers: base.powers,
    frameworks: base.frameworks,
    scopes: base.scopes,
    ocsf: base.ocsf,
    blurb: `Private connector built for this organisation (${k.category}). Maintained by HexaShield professional services.`,
    sectors: [],
    version: k.version,
    updatedDays: 30,
    keys: [[...norm(name).trim().split(' ').slice(0, 3)]],
    custom: true,
  };
}

export interface CatalogueView {
  listings: Listing[];
  /** listing id → customer connectors it matched. */
  installed: Map<string, Connector[]>;
}

/** Public catalogue plus private listings, with installed state derived from c.connectors. */
export function catalogueFor(c: CustomerProfile): CatalogueView {
  const installed = new Map<string, Connector[]>();
  const unmatched: Connector[] = [];
  for (const k of c.connectors) {
    const hits = CATALOGUE_LISTINGS.filter((l) => listingMatchesConnector(l, k));
    if (!hits.length) unmatched.push(k);
    for (const l of hits) installed.set(l.id, [...(installed.get(l.id) ?? []), k]);
  }
  const priv = new Map<string, Listing>();
  for (const k of unmatched) {
    const l = privateListing(k);
    if (!priv.has(l.id)) priv.set(l.id, l);
    installed.set(l.id, [...(installed.get(l.id) ?? []), k]);
  }
  return { listings: [...CATALOGUE_LISTINGS, ...priv.values()], installed };
}

/* ---------------------------------------------------------------------
   Sector and relevance
   --------------------------------------------------------------------- */

export function sectorsOf(c: CustomerProfile): Sector[] {
  const s = `${c.sector} ${c.sectorLong}`.toLowerCase();
  const f = c.frameworks.map((x) => `${x.short} ${x.name}`).join(' ').toLowerCase();
  const out: Sector[] = [];
  if (/maritime|\bports?\b|shipping|vessel/.test(s) || /\bimo\b|iacs/.test(f)) out.push('maritime');
  if (/financ|bank|payment|wealth|broker/.test(s) || /dora|swift|nydfs/.test(f)) out.push('finance');
  if (/insur|underwrit|reinsur/.test(s)) out.push('insurance');
  if (/media|entertain|film|studio|broadcast|streaming/.test(s) || /\btpn\b|mpa/.test(f)) out.push('media');
  if (/defen[cs]e|aerospace|munition/.test(s) || /cmmc|itar|800-171|dfars/.test(f)) out.push('defence');
  if (/pharma|life science|biotech|biolog/.test(s) || /gxp|part 11|annex 11|gmp/.test(f)) out.push('pharma');
  if (/health|hospital|\bclinics?\b|medical/.test(s) || /hipaa|hitrust/.test(f)) {
    if (!out.includes('pharma') || /hospital/.test(s)) out.push('health');
  }
  if (/automo|vehicle|motor/.test(s) || /r155|21434|tisax/.test(f)) out.push('auto');
  return out;
}

/** Frameworks this listing evidences that the customer is actually in scope for. */
export function frameworkHits(c: CustomerProfile, l: Listing): string[] {
  const mine = c.frameworks.map((f) => ({ short: f.short.toLowerCase(), name: f.name.toLowerCase() }));
  return l.frameworks.filter((fw) => {
    const x = fw.toLowerCase();
    return mine.some((m) => m.short.includes(x) || x.includes(m.short) || m.name.includes(x));
  });
}

/* ---------------------------------------------------------------------
   Gap analysis: "Recommended for you"
   --------------------------------------------------------------------- */

/** Minimal connector shape used for gap analysis (real connectors + in-session installs). */
export interface CoverageItem {
  vendor: string;
  product: string;
  category: ConnectorCategory;
  env: Env;
  tenants: string[] | 'all';
}

export interface Gap {
  id: string;
  title: string;
  why: string;
  /** What the gap stops HexaView doing. */
  consequence: string;
  categories: MktCategory[];
  severity: 'high' | 'medium' | 'low';
  loops: number;
  /** Percentage points of data completeness gained. */
  completeness: number;
  drivers: string[];
  tenant?: string;
  /** Best candidate listings (ids), sector-relevant first. */
  candidates: string[];
}

const active = (c: CustomerProfile, ...ids: (keyof CustomerProfile['services'])[]) => ids.some((id) => c.services[id] === 'active' || c.services[id] === 'trial');
const fwHas = (c: CustomerProfile, re: RegExp) => c.frameworks.some((f) => re.test(`${f.short} ${f.name}`));
const has = (cov: CoverageItem[], ...cats: ConnectorCategory[]) => cov.some((k) => cats.includes(k.category));
const hasName = (cov: CoverageItem[], re: RegExp) => cov.some((k) => re.test(`${k.vendor} ${k.product}`));

function rankCandidates(c: CustomerProfile, cats: MktCategory[], exclude: Set<string>, prefer?: (l: Listing) => boolean): string[] {
  const sectors = sectorsOf(c);
  return CATALOGUE_LISTINGS
    .filter((l) => cats.includes(l.category) && !exclude.has(l.id) && l.vendor !== 'HexaShield')
    .map((l) => ({
      l,
      s: l.popularity + (l.sectors.some((s) => sectors.includes(s)) ? 60 : l.sectors.length ? -40 : 0) + (prefer?.(l) ? 80 : 0)
        + (l.cert === 'HexaView-certified' ? 12 : 0) + frameworkHits(c, l).length * 4,
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.l.id);
}

export function computeGaps(c: CustomerProfile, cov: CoverageItem[], installedIds: Set<string>): Gap[] {
  const r = rng(`mkt-gaps-${c.id}`);
  const gaps: Gap[] = [];
  const add = (g: Omit<Gap, 'candidates' | 'loops' | 'completeness'> & { loops: [number, number]; completeness: [number, number] }, prefer?: (l: Listing) => boolean) => {
    gaps.push({ ...g, loops: r.int(g.loops[0], g.loops[1]), completeness: r.int(g.completeness[0], g.completeness[1]), candidates: rankCandidates(c, g.categories, installedIds, prefer) });
  };
  const fw = (re: RegExp) => c.frameworks.filter((f) => re.test(`${f.short} ${f.name}`)).map((f) => f.short);

  if (active(c, 'mdr') && !has(cov, 'SIEM')) add({ id: 'siem', title: 'No SIEM connected', why: 'Managed Detection & Response is active but HexaSOC cannot read or deploy detections.', consequence: 'The "detected" link of every loop stays unknown.', categories: ['SIEM'], severity: 'high', drivers: ['24/7 MDR', 'Detection Engineering'], loops: [30, 60], completeness: [12, 20] });
  if (active(c, 'mdr') && !has(cov, 'EDR / XDR')) add({ id: 'edr', title: 'No endpoint telemetry', why: 'MDR is active with no EDR/XDR feed, so containment cannot be orchestrated.', consequence: 'No isolate-host write-back; endpoint coverage unknown.', categories: ['EDR / XDR'], severity: 'high', drivers: ['24/7 MDR', 'Incident Response'], loops: [20, 40], completeness: [10, 16] });
  if (!has(cov, 'Identity')) add({ id: 'idp', title: 'No identity provider', why: 'Leaked credentials and risky sign-ins cannot be joined to real accounts.', consequence: 'Credential exposure findings cannot be actioned.', categories: ['Identity'], severity: 'high', drivers: ['Credential & Executive Exposure'], loops: [14, 26], completeness: [8, 12] });
  if (active(c, 'mdr') && !has(cov, 'Email')) add({ id: 'email', title: 'No email security feed', why: 'Phishing is the top initial-access vector; HexaSOC sees no email threats.', consequence: 'T1566 loops cannot show detection.', categories: ['Email'], severity: 'medium', drivers: ['24/7 MDR'], loops: [6, 12], completeness: [4, 7] });

  const thirdPartyBas = cov.some((k) => k.category === 'Validation' && k.vendor !== 'HexaShield');
  if (active(c, 'attack-coverage', 'purpleteam') && !thirdPartyBas) add({ id: 'bas', title: 'Validation loop cannot close continuously', why: 'HexaStrike engagements validate controls periodically; without a BAS tool nothing re-tests between engagements.', consequence: 'Loops drift to "stale" when detections change.', categories: ['Validation / BAS'], severity: 'high', drivers: ['ATT&CK Coverage', 'Purple Teaming', ...fw(/DORA|TIBER|CBEST/)], loops: [18, 42], completeness: [5, 9] });

  // OT sites without an OT sensor
  const otTenants = c.tenants.filter((t) => t.env.includes('ot'));
  for (const t of otTenants) {
    const covered = cov.some((k) => k.category === 'OT' && (k.tenants === 'all' || k.tenants.includes(t.id)));
    if (!covered) {
      const medical = /hospital|clinic|medical|health/i.test(`${t.kind} ${t.name}`) || sectorsOf(c).includes('health');
      add({ id: `ot-${t.id}`, tenant: t.id, title: `${t.short}: OT site without a sensor`, why: `${t.short} (${t.kind}) runs OT but no passive sensor reports its assets.`, consequence: 'OT assets, zones and advisories for this site are unknown, not zero.', categories: medical ? ['Medical devices', 'OT / IoT'] : ['OT / IoT'], severity: t.criticality >= 4 ? 'high' : 'medium', drivers: ['OT & ICS Asset Visibility', ...t.regimes.slice(0, 2)], loops: [8, 22], completeness: [6, 11] });
    }
  }

  // Tenants an existing tool category does not reach (only when the group has that category at all)
  const reach = (cat: ConnectorCategory, envs: Env[]) =>
    has(cov, cat) ? c.tenants.filter((t) => t.env.some((e) => envs.includes(e)) && !cov.some((k) => k.category === cat && (k.tenants === 'all' || k.tenants.includes(t.id)))) : [];
  const edrMiss = reach('EDR / XDR', ['onprem', 'cloud']);
  if (edrMiss.length) add({ id: 'edr-reach', title: `${edrMiss.length} tenant${edrMiss.length > 1 ? 's' : ''} without endpoint coverage`, why: `${edrMiss.map((t) => t.short).join(', ')} ${edrMiss.length > 1 ? 'are' : 'is'} outside every EDR/XDR connector's scope.`, consequence: 'Endpoint detections and containment are unavailable there.', categories: ['EDR / XDR'], severity: edrMiss.some((t) => t.criticality >= 4) ? 'high' : 'medium', drivers: ['24/7 MDR', ...edrMiss.flatMap((t) => t.regimes).slice(0, 2)], loops: [6, 18], completeness: [3, 7] });
  const bkMiss = reach('Backup', ['onprem', 'cloud']);
  if (bkMiss.length) add({ id: 'backup-reach', title: `${bkMiss.length} tenant${bkMiss.length > 1 ? 's' : ''} without backup evidence`, why: `${bkMiss.map((t) => t.short).join(', ')} ${bkMiss.length > 1 ? 'have' : 'has'} no backup or immutability telemetry.`, consequence: 'Recovery controls there can be documented but not assured.', categories: ['Backup & resilience'], severity: 'medium', drivers: ['Incident Response', ...fw(/DORA|NIS2|HIPAA|HPH|GxP|Annex 11/)].slice(0, 3), loops: [3, 9], completeness: [2, 5] });

  // Cloud providers without coverage
  const cnapp = hasName(cov, /wiz|prisma cloud|orca|cnapp|sysdig|lacework|aqua/i);
  const providers = [...new Set(c.vocab.cloudAccounts.map((a) => a.provider))];
  for (const p of providers) {
    const covered = cnapp || (p === 'AWS' && hasName(cov, /^aws /i)) || (p === 'Azure' && hasName(cov, /defender for cloud|azure/i)) || (p === 'GCP' && hasName(cov, /google.*(command|scc|cloud audit)/i));
    if (!covered) {
      const n = c.vocab.cloudAccounts.filter((a) => a.provider === p).length;
      add({ id: `cloud-${p}`, title: `${n} ${p} account${n > 1 ? 's' : ''} without posture coverage`, why: `${c.vocab.cloudAccounts.filter((a) => a.provider === p).map((a) => a.name).slice(0, 3).join(', ')} are not read by any posture tool.`, consequence: 'Misconfigurations and attack paths in these accounts are invisible.', categories: ['Cloud / CNAPP', 'Cloud & SaaS platforms'], severity: 'medium', drivers: ['Attack Surface Management', ...fw(/SOC 2|ISO 27001|DORA/)].slice(0, 3), loops: [6, 16], completeness: [4, 8] }, (l) => l.vendor === (p === 'GCP' ? 'Google' : p === 'Azure' ? 'Microsoft' : 'AWS') || /wiz/i.test(l.vendor));
    }
  }

  if ((fwHas(c, /DORA|NIS2|HIPAA|HPH|ISO 27001/) || active(c, 'ir')) && !has(cov, 'Backup')) add({ id: 'backup', title: 'No backup or recovery evidence', why: 'Resilience controls need proof of immutable backups and tested restores.', consequence: 'Recovery controls can be documented but never assured.', categories: ['Backup & resilience'], severity: 'medium', drivers: ['Incident Response', ...fw(/DORA|NIS2|HIPAA|HPH/)], loops: [4, 10], completeness: [3, 6] });
  if (!has(cov, 'ITSM')) add({ id: 'itsm', title: 'No ITSM for write-back', why: 'Findings cannot become tickets with owners and due dates.', consequence: 'Remediation loops stay open with no accountable owner.', categories: ['ITSM'], severity: 'medium', drivers: ['Vulnerability response', 'Compliance as a Service'], loops: [10, 20], completeness: [2, 4] });
  if (active(c, 'tprm') && !has(cov, 'Ratings')) add({ id: 'ratings', title: 'Third-party risk without outside-in ratings', why: 'TPRM is active but supplier posture relies on questionnaires alone.', consequence: 'Tier 1 supplier risk is self-attested only.', categories: ['Ratings & TPRM'], severity: 'low', drivers: ['Third-Party Risk Management', ...fw(/DORA|NIS2|TISAX|TPN/)], loops: [3, 8], completeness: [2, 5] });
  if (active(c, 'ai-gov') && !has(cov, 'AI')) add({ id: 'ai', title: 'AI governance without AI telemetry', why: 'HexaAI inventories AI by declaration; no tool reports shadow AI or prompt risk.', consequence: 'EU AI Act and ISO 42001 controls lack runtime evidence.', categories: ['AI security'], severity: 'medium', drivers: ['AI Security & Governance'], loops: [4, 10], completeness: [3, 6] });
  if ((active(c, 'custody') || fwHas(c, /TPN|HIPAA|PCI|ITAR|GxP|Part 11/)) && !has(cov, 'DLP')) add({ id: 'dlp', title: 'No data-loss telemetry', why: 'Sensitive data movement is not observed outside HexaCustody-tracked assets.', consequence: 'Exfiltration loops (T1567, T1048) cannot show detection.', categories: ['DLP & data'], severity: 'medium', drivers: [...(active(c, 'custody') ? ['Content Custody'] : []), ...fw(/TPN|HIPAA|PCI|ITAR|GxP|Part 11/)], loops: [5, 12], completeness: [3, 6] });
  if (active(c, 'asm', 'pentest', 'ot-vuln') && !has(cov, 'Vulnerability')) add({ id: 'vuln', title: 'No vulnerability scanner', why: 'Exposure findings cannot be matched to authenticated scan results.', consequence: 'Patch SLAs are measured on pentest findings only.', categories: ['Vulnerability'], severity: 'high', drivers: ['Attack Surface Management', 'Penetration Testing'], loops: [12, 26], completeness: [6, 10] });
  if (fwHas(c, /IEC 62443|SWIFT|PCI|TISAX/) && !has(cov, 'PAM')) add({ id: 'pam', title: 'Privileged and vendor access unobserved', why: 'Remote vendor sessions are the most common route into OT and payment systems.', consequence: 'Privileged-access controls cannot be assured.', categories: ['PAM'], severity: 'medium', drivers: fw(/IEC 62443|SWIFT|PCI|TISAX/), loops: [6, 14], completeness: [3, 5] });
  if (c.tenants.length >= 4 && !has(cov, 'Asset / CMDB')) add({ id: 'caasm', title: 'No authoritative asset inventory', why: `${c.tenants.length} tenants and no CAASM/CMDB source; coverage gaps cannot be computed.`, consequence: 'Tool coverage per asset is estimated, not measured.', categories: ['Exposure / CAASM'], severity: 'low', drivers: ['HexaCore asset graph'], loops: [3, 8], completeness: [5, 9] });

  if (active(c, 'osint', 'hunting') && !hasName(cov, /recorded future|mandiant|google threat intelligence|flashpoint|intel 471|falcon intelligence|misp|opencti|threatstream/i)) add({ id: 'cti', title: 'No commercial intelligence federated', why: 'HexaInt and ISAC feeds are connected, but your own intelligence subscriptions are not federated into hunts.', consequence: 'Indicators you already pay for never reach detections.', categories: ['Threat intel'], severity: 'low', drivers: ['OSINT & Threat Intelligence', 'Threat Hunting'], loops: [3, 8], completeness: [1, 3] }, (l) => /recorded future|google|flashpoint|crowdstrike/i.test(l.vendor));
  if (fwHas(c, /ISO 27001|HIPAA|PCI|NIS2|DORA|SOC 2|Cyber Essentials/) && !hasName(cov, /knowbe4|hoxhunt|awareness|zenguide|sosafe/i)) add({ id: 'awareness', title: 'Human-risk controls lack evidence', why: 'Training completion and phish-simulation results are not flowing in, so awareness controls are attested manually.', consequence: 'ISO 27001 A.6.3 and similar controls stay "documented" only.', categories: ['Awareness'], severity: 'low', drivers: fw(/ISO 27001|HIPAA|PCI|NIS2|DORA|SOC 2/).slice(0, 3), loops: [2, 6], completeness: [1, 3] });

  // Sector packs
  const sec = sectorsOf(c);
  if (sec.includes('health') && !hasName(cov, /epic|cerner|oracle health|meditech|fairwarning|protenus|trakcare|intersystems/i)) add({ id: 'ehr', title: 'EHR access is not monitored', why: 'Patient-record access and break-the-glass events are not in HexaView.', consequence: 'HIPAA 164.312(b) audit-control loops cannot close.', categories: ['Healthcare'], severity: 'high', drivers: fw(/HIPAA|HITRUST|HPH/), loops: [6, 14], completeness: [4, 7] });
  if (sec.includes('media') && !has(cov, 'Custody') && !hasName(cov, /aspera|signiant|frame io|mediashuttle/i)) add({ id: 'media', title: 'Content transfers are not tracked', why: 'Pre-release content moves through transfer tools HexaView cannot see.', consequence: 'TPN content-security controls rely on attestations.', categories: ['Media & content'], severity: 'high', drivers: fw(/TPN|MPA/), loops: [6, 14], completeness: [4, 8] });
  if (sec.includes('auto') && !hasName(cov, /upstream|vsoc|vicone|argus/i)) add({ id: 'vsoc', title: 'No vehicle SOC feed', why: 'UNECE R155 requires monitoring of the vehicle fleet for attacks.', consequence: 'R155 monitoring evidence is manual.', categories: ['Automotive'], severity: 'high', drivers: fw(/R155|R156|21434/), loops: [6, 12], completeness: [5, 9] });
  if (sec.includes('defence') && !hasName(cov, /gcc high|preveil|exostar|kiteworks/i)) add({ id: 'cui', title: 'CUI enclave not connected', why: 'Controlled Unclassified Information lives in an enclave HexaView does not read.', consequence: 'CMMC / NIST 800-171 access-control practices lack evidence.', categories: ['Defence'], severity: 'high', drivers: fw(/CMMC|800-171|ITAR|DFARS/), loops: [8, 16], completeness: [5, 9] });
  if (sec.includes('pharma') && !hasName(cov, /veeva|labware|mastercontrol|benchling|medidata|empower/i)) add({ id: 'gxp', title: 'GxP systems without audit-trail feed', why: 'Validated systems (QMS, LIMS) keep Part 11 audit trails HexaView does not ingest.', consequence: 'Data-integrity controls cannot be assured.', categories: ['Pharma & life sciences'], severity: 'medium', drivers: fw(/GxP|Part 11|Annex 11|GMP/), loops: [4, 10], completeness: [3, 6] });
  if (sec.includes('finance') && fwHas(c, /SWIFT/) && !hasName(cov, /swift/i)) add({ id: 'swift', title: 'SWIFT environment not monitored', why: 'Customer Security Programme controls need operator and messaging logs.', consequence: 'CSP 6.4 logging loops cannot close.', categories: ['Financial services'], severity: 'high', drivers: fw(/SWIFT/), loops: [4, 9], completeness: [3, 5] });

  const sevW = { high: 3, medium: 2, low: 1 };
  return gaps.sort((a, b) => sevW[b.severity] - sevW[a.severity] || b.loops - a.loops);
}

/* ---------------------------------------------------------------------
   Reviews (deterministic, per listing)
   --------------------------------------------------------------------- */

export interface Review { who: string; org: string; stars: number; text: string; daysAgo: number }

const REVIEW_TEXT = [
  'Connected in under an hour; contract tests caught a field rename after the vendor upgrade before it broke anything.',
  'Write-back through the Action Centre is the reason we picked HexaView. Approvals map cleanly to our CAB.',
  'Data lands in OCSF with ownership already joined from the CMDB. Saves our analysts a pivot per alert.',
  'Rate limiting is handled well; we never got throttled even during the initial backfill.',
  'Scopes are least-privilege out of the box. Our identity team signed it off first time.',
  'Would like more granular tenant mapping, but support turned round a manifest tweak within a day.',
  'Evidence flows straight into our ISO surveillance audit pack. Auditors liked the freshness stamps.',
  'Initial sync was slow on a large estate; incremental syncs are fine.',
];
const REVIEW_ORGS = ['Regional bank', 'Port operator', 'Hospital network', 'Broadcaster', 'Tier 1 supplier', 'Insurer', 'Logistics group', 'University hospital', 'Defence prime', 'Pharma manufacturer'];
const REVIEW_ROLES = ['SOC lead', 'Security engineer', 'CISO', 'GRC manager', 'Platform owner', 'OT security lead'];

export function reviewsFor(l: Listing): Review[] {
  if (l.custom) return [];
  const r = rng(`mkt-reviews-${l.id}`);
  const texts = r.pickN(REVIEW_TEXT, 3);
  return texts.map((text) => ({
    who: r.pick(REVIEW_ROLES),
    org: r.pick(REVIEW_ORGS),
    stars: Math.max(3, Math.min(5, Math.round(l.rating + r.float(-0.8, 0.6, 1)))),
    text,
    daysAgo: r.int(3, 160),
  }));
}

/** Stars histogram (5 → 1) consistent with the rating. */
export function ratingSpread(l: Listing): number[] {
  const r = rng(`mkt-spread-${l.id}`);
  const top = Math.round(l.reviews * Math.max(0.3, (l.rating - 3.4) / 1.6));
  const four = Math.round((l.reviews - top) * r.float(0.55, 0.75, 2));
  const three = Math.round((l.reviews - top - four) * 0.7);
  const two = Math.max(0, Math.round((l.reviews - top - four - three) * 0.6));
  const one = Math.max(0, l.reviews - top - four - three - two);
  return [top, four, three, two, one];
}

/** Ordered setup steps for the listing. */
export function setupSteps(l: Listing): { title: string; body: string }[] {
  const steps: { title: string; body: string }[] = [];
  if (l.methods.includes('Sensor')) steps.push({ title: 'Place the sensor', body: 'Deploy the passive sensor on a SPAN / TAP at Purdue level 2-3; no traffic is injected.' });
  if (l.methods.includes('Agent')) steps.push({ title: 'Deploy the collector', body: 'Install the HexaCore collector on the chosen data plane (Helm chart or signed container).' });
  if (l.methods.includes('API')) steps.push({ title: 'Create a least-privilege API client', body: `In ${l.vendor === 'Generic' ? 'the source system' : l.vendor}, create a service principal with only the scopes listed under Permissions.` });
  if (l.methods.includes('Syslog')) steps.push({ title: 'Point syslog at the edge collector', body: 'Forward CEF/LEEF over TLS 6514 to the data-plane collector; no inbound internet path is required.' });
  if (l.methods.includes('Webhook')) steps.push({ title: 'Register the webhook', body: 'Paste the signed HexaCore endpoint; payloads are HMAC-verified on the data plane.' });
  if (l.methods.includes('TAXII')) steps.push({ title: 'Add the TAXII collection', body: 'Provide the discovery URL and collection id; credentials are stored in the data-plane vault.' });
  if (l.methods.includes('File drop')) steps.push({ title: 'Configure the signed bundle drop', body: 'For air-gapped sites, export signed bundles to the transfer diode or approved removable media.' });
  steps.push({ title: 'Store the secret in your vault', body: 'Credentials are referenced by vault path; they never leave the customer boundary.' });
  steps.push({ title: 'Run contract tests', body: 'HexaCore records the response schemas and runs sandbox contract tests before the first live sync.' });
  steps.push({ title: 'First sync and mapping review', body: 'Records map to OCSF; review the field mapping and ownership joins, then enable the schedule.' });
  if (l.write.length) steps.push({ title: 'Opt in to write-back (optional)', body: 'Write-back actions are disabled until an admin enables them and assigns approval gates.' });
  return steps;
}
