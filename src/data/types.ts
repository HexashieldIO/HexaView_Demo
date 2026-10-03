// Shared types for the HexaView demo data model. Loosely follows the canonical
// model in the LLD (HS-ARCH-HXV-004 section 4): organisation > tenant > data plane
// > connector instance, with assets, identities, findings, detections, cases,
// controls, evidence, techniques, validations and loops underneath.

export type CustomerId = 'maritime' | 'finserv' | 'media';
export type Tier = 'Essentials' | 'Professional' | 'Enterprise / CNI';
export type Env = 'cloud' | 'onprem' | 'ot' | 'saas';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Health = 'healthy' | 'degraded' | 'failing' | 'paused';
export type Persona = 'executive' | 'analyst' | 'grc' | 'ot' | 'admin';
export type Currency = 'USD' | 'GBP' | 'EUR';

export type CapabilityId = 'soc' | 'int' | 'strike' | 'ot' | 'comply' | 'custody';

export type ServiceId =
  | 'mdr' | 'hunting' | 'ir' | 'forensics' | 'detection-eng' | 'attack-coverage'
  | 'darkweb' | 'osint' | 'exposure'
  | 'pentest' | 'redteam' | 'purpleteam' | 'asm'
  | 'ot-visibility' | 'ot-vuln' | 'ot-pentest'
  | 'caas' | 'tprm' | 'ai-gov'
  | 'custody';

export type ServiceState = 'active' | 'trial' | 'available';

export interface Tenant {
  id: string;
  name: string;
  short: string;
  kind: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  /** 1 (low) to 5 (crown jewel); weights the group Resilience Index roll-up. */
  criticality: number;
  env: Env[];
  dataPlaneId: string;
  people: number;
  /** Tenant Resilience Index (0-100). */
  ri: number;
  /** Regulators or frameworks that bite on this tenant specifically. */
  regimes: string[];
}

export type Placement = 'HexaShield-hosted' | 'Customer Azure' | 'Customer AWS' | 'Customer GCP' | 'On-prem Kubernetes' | 'On-prem Docker' | 'Air-gapped' | 'Vessel edge (store & forward)';

export interface DataPlane {
  id: string;
  name: string;
  placement: Placement;
  region: string;
  status: Health;
  agentVersion: string;
  heartbeatSecAgo: number;
  eventsPerMin: number;
  /** Credential store the agent uses. */
  vault: string;
  note?: string;
}

export type ConnectorCategory =
  | 'SIEM' | 'EDR / XDR' | 'Identity' | 'PAM' | 'Cloud posture' | 'Vulnerability' | 'OT' | 'GRC' | 'Intelligence'
  | 'Email' | 'Network' | 'SASE' | 'ITSM' | 'Validation' | 'Custody' | 'Backup' | 'DLP' | 'AppSec' | 'AI' | 'HexaShield' | 'Asset / CMDB' | 'Ratings';

export interface Connector {
  id: string;
  vendor: string;
  product: string;
  category: ConnectorCategory;
  env: Env;
  dataPlaneId: string;
  tenants: string[] | 'all';
  read: string[];
  write: string[];
  status: Health;
  /** Minutes since last successful sync. */
  lastSyncMin: number;
  /** Sync interval in minutes; stale when lastSync > 2x interval. */
  intervalMin: number;
  records: number;
  drift: number;
  version: string;
  note?: string;
}

export interface FrameworkScope {
  id: string;
  name: string;
  short: string;
  kind: 'Regulation' | 'Certification' | 'Attestation' | 'Standard' | 'Industry programme' | 'Contractual';
  requirements: number;
  inScope: number;
  /** % in-scope requirements whose controls are implemented with fresh evidence. */
  documented: number;
  /** % requirements with ATT&CK mappings whose loops are all closed. */
  assured: number;
  nextAudit?: string;
  owner: string;
}

export interface Person {
  name: string;
  role: string;
  email: string;
  vip?: boolean;
}

export interface ThirdParty {
  name: string;
  category: string;
  tier: 1 | 2 | 3;
  access: string;
  rating: number;
  country: string;
}

export interface CustomerProfile {
  id: CustomerId;
  name: string;
  short: string;
  initials: string;
  colour: string;
  sector: string;
  sectorLong: string;
  hq: string;
  tier: Tier;
  deployment: string;
  stamp: string;
  residency: string;
  byok: boolean;
  currency: Currency;
  domain: string;
  tagline: string;
  /** Short line used under the Command Centre headline. */
  estateSummary: string;
  revenueM: number;
  employees: number;
  tenants: Tenant[];
  dataPlanes: DataPlane[];
  connectors: Connector[];
  frameworks: FrameworkScope[];
  services: Record<ServiceId, ServiceState>;
  /** Integration entitlement (null = unlimited). */
  integrationLimit: number | null;
  people: {
    ciso: Person;
    socLead: Person;
    grcLead: Person;
    otLead?: Person;
    admin: Person;
    board: Person;
    staff: Person[];
  };
  thirdParties: ThirdParty[];
  vocab: {
    hostPrefix: string;
    servers: string[];
    crownJewels: string[];
    businessServices: string[];
    threatActors: string[];
    otSystems: string[];
    otProtocols: string[];
    custodyLabel: string;
    custodyItems: string[];
    aiSystems: string[];
    lookalikeBase: string;
    externalHosts: string[];
    cloudAccounts: { provider: 'Azure' | 'AWS' | 'GCP'; name: string; tenant: string }[];
  };
  insurance: {
    carrier: string;
    broker: string;
    limitM: number;
    retentionK: number;
    premiumK: number;
    renewalDays: number;
  };
  /** Scores per capability (0-100) used by the Command Centre and module headers. */
  scores: Record<CapabilityId | 'ai' | 'insurance' | 'fabric', number>;
}
