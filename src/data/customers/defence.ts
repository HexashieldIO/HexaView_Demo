import type { CustomerProfile } from '../types';

// Fictional US defence sub-contractor (~550 people): avionics and guidance
// subsystems, test equipment and precision machined parts for the primes.
// CUI lives in a Microsoft 365 GCC High / Azure Government enclave; the shop
// floor sits in a separate building and there is a small test range in Tucson.
// CMMC 2.0 Level 2, NIST SP 800-171, DFARS 7012/7019/7020/7021 and ITAR/EAR bite.
export const defence: CustomerProfile = {
  id: 'defence',
  dataKey: 'automotive',
  name: 'Sentry Peak Defense Systems',
  short: 'Sentry Peak',
  initials: 'SP',
  colour: '#4d7c0f',
  sector: 'Defence industrial base',
  sectorLong: 'Avionics and guidance subsystems, test equipment and precision machined parts for defence primes',
  hq: 'Huntsville, Alabama, USA',
  tier: 'Professional',
  deployment: 'Customer-hosted data planes in Azure Government (GCC High) and on-prem; no CUI in HexaShield-hosted services, BYOK',
  stamp: 'Dedicated stamp · Azure Government (US Gov Virginia), US-person operated',
  residency: 'US persons only, CUI stays in GCC High',
  byok: true,
  currency: 'USD',
  domain: 'sentrypeakdefense.com',
  tagline: 'CUI, ITAR data and the shop floor in one assessed picture, ready for the C3PAO.',
  estateSummary: '550 people · GCC High CUI enclave · 2 sites · 410 OT & test assets · SPRS 88/110',
  revenueM: 210,
  employees: 550,
  tenants: [
    { id: 'programs', name: 'Programs CUI Enclave (GCC High)', short: 'CUI enclave', kind: 'Program management, CUI & ITAR data, proposals', city: 'Huntsville', country: 'US', lat: 34.73, lon: -86.66, criticality: 5, env: ['cloud', 'saas'], dataPlaneId: 'dp-gcch', people: 140, ri: 78, regimes: ['CMMC L2', 'NIST 800-171', 'DFARS 7012', 'ITAR'] },
    { id: 'engineering', name: 'Engineering & Design (CAD/PLM)', short: 'Engineering', kind: 'Avionics, guidance & firmware engineering; Teamcenter, NX, Ansys, MATLAB', city: 'Huntsville', country: 'US', lat: 34.74, lon: -86.68, criticality: 5, env: ['onprem', 'cloud'], dataPlaneId: 'dp-hsv', people: 120, ri: 72, regimes: ['CMMC L2', 'ITAR', 'EAR', 'NIST 800-172'] },
    { id: 'manufacturing', name: 'Precision Manufacturing (Building 3)', short: 'Building 3', kind: 'CNC machining, CMM inspection, ATE & environmental test', city: 'Huntsville', country: 'US', lat: 34.69, lon: -86.73, criticality: 4, env: ['ot', 'onprem'], dataPlaneId: 'dp-ot', people: 170, ri: 68, regimes: ['CMMC L2', 'AS9100D', 'ITAR'] },
    { id: 'corporate', name: 'Corporate & Finance (commercial M365, Costpoint)', short: 'Corporate', kind: 'Finance, HR, contracts, DCAA-audited accounting', city: 'Huntsville', country: 'US', lat: 34.73, lon: -86.59, criticality: 3, env: ['saas', 'cloud'], dataPlaneId: 'dp-comm', people: 85, ri: 80, regimes: ['DFARS 7019/7020', 'DCAA', 'SOC 2 (vendors)'] },
    { id: 'tucson', name: 'Tucson Test Range & Integration', short: 'Tucson', kind: 'Flight & range test, integration lab', city: 'Tucson', country: 'US', lat: 32.22, lon: -110.97, criticality: 3, env: ['onprem', 'ot'], dataPlaneId: 'dp-tucson', people: 35, ri: 66, regimes: ['CMMC L2', 'ITAR'] },
  ],
  dataPlanes: [
    { id: 'dp-gcch', name: 'CUI enclave data plane', placement: 'Customer Azure', region: 'Azure Government (US Gov Virginia) · GCC High', status: 'healthy', agentVersion: '1.9.2', heartbeatSecAgo: 3, eventsPerMin: 6400, vault: 'Azure Government Key Vault Managed HSM (BYOK, FIPS 140-3 L3)', note: 'US-person operators only; CUI never leaves GCC High' },
    { id: 'dp-comm', name: 'Corporate data plane', placement: 'Customer Azure', region: 'Azure East US 2 (commercial, non-CUI)', status: 'healthy', agentVersion: '1.9.2', heartbeatSecAgo: 4, eventsPerMin: 2100, vault: 'Customer Key Vault (BYOK)' },
    { id: 'dp-hsv', name: 'Huntsville engineering edge', placement: 'On-prem Kubernetes', region: 'Huntsville data centre, enclave on-prem segment', status: 'healthy', agentVersion: '1.9.2', heartbeatSecAgo: 5, eventsPerMin: 3800, vault: 'Sealed local store (FIPS mode)' },
    { id: 'dp-ot', name: 'Building 3 shop-floor edge', placement: 'On-prem Docker', region: 'Building 3 Level 3.5 DMZ', status: 'healthy', agentVersion: '1.9.1', heartbeatSecAgo: 9, eventsPerMin: 1200, vault: 'Sealed local store', note: 'Passive SPAN only; no write path into machine networks' },
    { id: 'dp-tucson', name: 'Tucson test-range edge', placement: 'On-prem Docker', region: 'Tucson integration lab server room', status: 'degraded', agentVersion: '1.8.6', heartbeatSecAgo: 240, eventsPerMin: 380, vault: 'Sealed local store', note: 'Two versions behind; range WAN link saturated by test telemetry since 06:40' },
  ],
  connectors: [
    // SIEM
    { id: 'c-sentinel', vendor: 'Microsoft', product: 'Sentinel (Azure Government)', category: 'SIEM', env: 'cloud', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Incidents', 'Analytics rules', 'Data connectors', 'Watchlists'], write: ['Enable / disable rule', 'Deploy scheduled rule'], status: 'healthy', lastSyncMin: 2, intervalMin: 5, records: 18400, drift: 0, version: '1.6.1' },
    // EDR / XDR
    { id: 'c-defender', vendor: 'Microsoft', product: 'Defender XDR (GCC High)', category: 'EDR / XDR', env: 'cloud', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering', 'corporate', 'tucson'], read: ['Devices', 'Alerts', 'Vulnerabilities', 'Advanced hunting'], write: ['Isolate device', 'Add custom indicator'], status: 'healthy', lastSyncMin: 3, intervalMin: 5, records: 9200, drift: 0, version: '1.3.2' },
    { id: 'c-crowdstrike', vendor: 'CrowdStrike', product: 'Falcon (GovCloud) for Linux & HPC', category: 'EDR / XDR', env: 'cloud', dataPlaneId: 'dp-hsv', tenants: ['engineering', 'tucson'], read: ['Hosts', 'Detections', 'Spotlight vulnerabilities'], write: ['Contain host'], status: 'healthy', lastSyncMin: 4, intervalMin: 10, records: 2600, drift: 0, version: '1.4.0', note: 'Covers RHEL simulation nodes and test-range Linux where MDE is not deployed' },
    // Identity
    { id: 'c-entra', vendor: 'Microsoft', product: 'Entra ID (GCC High)', category: 'Identity', env: 'cloud', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering', 'manufacturing', 'tucson'], read: ['Users', 'Groups', 'Risky sign-ins', 'Conditional Access', 'US-person attribute'], write: ['Revoke sessions', 'Disable user'], status: 'healthy', lastSyncMin: 4, intervalMin: 10, records: 1340, drift: 0, version: '1.6.0' },
    { id: 'c-entra-comm', vendor: 'Microsoft', product: 'Entra ID (commercial)', category: 'Identity', env: 'cloud', dataPlaneId: 'dp-comm', tenants: ['corporate'], read: ['Users', 'Risky sign-ins', 'Conditional Access', 'App consents'], write: ['Revoke sessions'], status: 'healthy', lastSyncMin: 5, intervalMin: 10, records: 720, drift: 0, version: '1.6.0' },
    { id: 'c-yubico', vendor: 'Yubico', product: 'YubiEnterprise (FIPS YubiKeys)', category: 'Identity', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Key inventory', 'Assignments', 'Shipments'], write: [], status: 'healthy', lastSyncMin: 220, intervalMin: 360, records: 1180, drift: 0, version: '1.0.2' },
    { id: 'c-keyfactor', vendor: 'Keyfactor', product: 'Command (PKI & certificate lifecycle)', category: 'Identity', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: 'all', read: ['Certificates', 'Expiring certs', 'CA health'], write: ['Renew certificate'], status: 'healthy', lastSyncMin: 31, intervalMin: 60, records: 4300, drift: 0, version: '1.1.0' },
    // PAM
    { id: 'c-delinea', vendor: 'Delinea', product: 'Secret Server (on-prem)', category: 'PAM', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: 'all', read: ['Privileged accounts', 'Checkouts', 'Session recordings', 'Rotation status'], write: ['Rotate secret', 'Terminate session'], status: 'healthy', lastSyncMin: 8, intervalMin: 15, records: 940, drift: 0, version: '1.2.1' },
    { id: 'c-beyondtrust', vendor: 'BeyondTrust', product: 'Privileged Remote Access (machine-tool vendors)', category: 'PAM', env: 'onprem', dataPlaneId: 'dp-ot', tenants: ['manufacturing', 'tucson'], read: ['Vendor sessions', 'Jump items', 'Session recordings'], write: ['Terminate session'], status: 'healthy', lastSyncMin: 9, intervalMin: 15, records: 610, drift: 0, version: '1.0.1' },
    // Cloud posture
    { id: 'c-defcloud', vendor: 'Microsoft', product: 'Defender for Cloud (Azure Government)', category: 'Cloud posture', env: 'cloud', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering', 'corporate'], read: ['Recommendations', 'Secure score', 'NIST 800-171 regulatory view', 'Attack paths'], write: [], status: 'healthy', lastSyncMin: 22, intervalMin: 30, records: 3100, drift: 0, version: '1.2.0' },
    // Vulnerability
    { id: 'c-tenablesc', vendor: 'Tenable', product: 'Security Center (on-prem, ACAS-aligned)', category: 'Vulnerability', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: 'all', read: ['Assets', 'Vulnerabilities', 'VPR', 'STIG compliance scans'], write: [], status: 'healthy', lastSyncMin: 44, intervalMin: 60, records: 21800, drift: 0, version: '1.3.0' },
    // OT
    { id: 'c-armis', vendor: 'Armis', product: 'Centrix for OT/IoT', category: 'OT', env: 'ot', dataPlaneId: 'dp-ot', tenants: ['manufacturing', 'tucson'], read: ['Assets', 'Alerts', 'Vulnerabilities', 'Boundaries'], write: [], status: 'healthy', lastSyncMin: 7, intervalMin: 15, records: 410, drift: 0, version: '1.2.0', note: 'Read-only by policy' },
    { id: 'c-hexaot', vendor: 'HexaShield', product: 'HexaOT sensors (Building 3 & test range)', category: 'OT', env: 'ot', dataPlaneId: 'dp-ot', tenants: ['manufacturing', 'tucson'], read: ['Assets', 'Alerts', 'Process zones', 'DNC transfers'], write: [], status: 'healthy', lastSyncMin: 5, intervalMin: 15, records: 380, drift: 0, version: '2.2.0', note: 'Read-only by policy' },
    // Network
    { id: 'c-paloalto', vendor: 'Palo Alto Networks', product: 'NGFW & Panorama', category: 'Network', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: 'all', read: ['Threat logs', 'Rule base', 'Zones', 'GlobalProtect sessions'], write: ['Block IP', 'Add to dynamic address group'], status: 'healthy', lastSyncMin: 6, intervalMin: 10, records: 12600, drift: 0, version: '1.4.0' },
    { id: 'c-ise', vendor: 'Cisco', product: 'Identity Services Engine', category: 'Network', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['engineering', 'manufacturing', 'corporate'], read: ['Endpoints', 'Posture', 'Authorisation profiles'], write: ['Quarantine endpoint (ANC)'], status: 'healthy', lastSyncMin: 11, intervalMin: 15, records: 2900, drift: 0, version: '1.1.2' },
    { id: 'c-corelight', vendor: 'Corelight', product: 'Open NDR sensors (enclave & Building 3 uplink)', category: 'Network', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['engineering', 'manufacturing', 'programs'], read: ['Zeek logs', 'Notices', 'Suricata alerts'], write: [], status: 'healthy', lastSyncMin: 3, intervalMin: 5, records: 48200, drift: 0, version: '1.0.4' },
    // SASE
    { id: 'c-zscaler', vendor: 'Zscaler', product: 'ZIA / ZPA Government (FedRAMP High)', category: 'SASE', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Web threats', 'Private access policies', 'DLP incidents', 'GenAI usage'], write: ['Block URL category'], status: 'healthy', lastSyncMin: 7, intervalMin: 15, records: 16800, drift: 0, version: '1.2.2' },
    // Email
    { id: 'c-mdo', vendor: 'Microsoft', product: 'Defender for Office 365 (GCC High)', category: 'Email', env: 'saas', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering', 'manufacturing', 'tucson'], read: ['Threats', 'Clicks', 'Quarantine'], write: ['Quarantine message'], status: 'healthy', lastSyncMin: 5, intervalMin: 15, records: 7400, drift: 0, version: '1.1.0' },
    { id: 'c-proofpoint', vendor: 'Proofpoint', product: 'Email Protection (commercial domain)', category: 'Email', env: 'saas', dataPlaneId: 'dp-comm', tenants: ['corporate'], read: ['Threats', 'Clicks', 'VAP'], write: ['Quarantine message'], status: 'healthy', lastSyncMin: 6, intervalMin: 15, records: 5200, drift: 0, version: '1.0.3' },
    { id: 'c-preveil', vendor: 'PreVeil', product: 'Email & Drive (CUI exchange with primes)', category: 'Email', env: 'saas', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering'], read: ['Secure messages', 'Shared folders', 'External recipients', 'Admin approvals'], write: ['Revoke share'], status: 'healthy', lastSyncMin: 12, intervalMin: 30, records: 3600, drift: 0, version: '1.0.1' },
    // DLP
    { id: 'c-purview', vendor: 'Microsoft', product: 'Purview Information Protection & DLP (CUI labels)', category: 'DLP', env: 'saas', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering', 'manufacturing', 'tucson'], read: ['Sensitivity labels', 'DLP incidents', 'CUI//SP-EXPT label usage', 'Activity explorer'], write: ['Apply label'], status: 'healthy', lastSyncMin: 9, intervalMin: 15, records: 8900, drift: 0, version: '1.3.0' },
    // AI
    { id: 'c-purview-ai', vendor: 'Microsoft', product: 'Purview DSPM for AI', category: 'AI', env: 'saas', dataPlaneId: 'dp-comm', tenants: ['corporate', 'engineering'], read: ['Copilot interactions', 'Unsanctioned GenAI', 'Sensitive prompts'], write: [], status: 'healthy', lastSyncMin: 18, intervalMin: 30, records: 1240, drift: 0, version: '0.9.0', note: 'Commercial tenant only; GCC High coverage pending feature parity' },
    // ITSM
    { id: 'c-servicenow', vendor: 'ServiceNow', product: 'ITSM (Government Community Cloud)', category: 'ITSM', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Incidents', 'Changes', 'CMDB'], write: ['Create ticket'], status: 'healthy', lastSyncMin: 5, intervalMin: 10, records: 14200, drift: 0, version: '1.5.0' },
    { id: 'c-jira', vendor: 'Atlassian', product: 'Jira Software Data Center (engineering)', category: 'ITSM', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['engineering', 'manufacturing'], read: ['Issues', 'Engineering change orders', 'Releases'], write: ['Create issue'], status: 'degraded', lastSyncMin: 95, intervalMin: 30, records: 6800, drift: 3, version: '0.9.4', note: 'Field drift after Jira DC 9.12 upgrade (ECO custom fields renamed)' },
    // Backup
    { id: 'c-rubrik', vendor: 'Rubrik', product: 'Security Cloud – Government', category: 'Backup', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['programs', 'engineering', 'corporate'], read: ['Snapshots', 'Anomaly detection', 'Recovery tests', 'Sensitive data discovery'], write: [], status: 'healthy', lastSyncMin: 26, intervalMin: 60, records: 1900, drift: 0, version: '1.0.1', note: 'Includes Teamcenter vault and M365 GCC High backups' },
    { id: 'c-veeam', vendor: 'Veeam', product: 'Backup & Replication (shop floor & test range)', category: 'Backup', env: 'onprem', dataPlaneId: 'dp-tucson', tenants: ['manufacturing', 'tucson'], read: ['Jobs', 'Restore points', 'SureBackup results'], write: [], status: 'degraded', lastSyncMin: 410, intervalMin: 120, records: 640, drift: 0, version: '1.0.2', note: 'Range WAN link saturated by test telemetry; sync lagging since 06:40' },
    // GRC
    { id: 'c-hexacomply', vendor: 'HexaShield', product: 'HexaComply (CMMC / 800-171 SSP & POA&M)', category: 'GRC', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Frameworks', 'Controls', 'Evidence', 'SSP', 'POA&M', 'SPRS score'], write: ['Update control status', 'Attach evidence'], status: 'healthy', lastSyncMin: 3, intervalMin: 5, records: 2600, drift: 0, version: '2.0.1' },
    { id: 'c-exostar', vendor: 'Exostar', product: 'Managed Access Gateway & Partner Information Manager', category: 'GRC', env: 'saas', dataPlaneId: 'dp-comm', tenants: ['programs', 'corporate'], read: ['Prime portal access', 'Supplier CMMC / SPRS attestations', 'Supplier questionnaires'], write: [], status: 'degraded', lastSyncMin: 1580, intervalMin: 720, records: 310, drift: 0, version: '1.0.0', note: 'Federation certificate rotated by Exostar; re-authorisation pending' },
    { id: 'c-knowbe4', vendor: 'KnowBe4', product: 'Security Awareness Training (CUI & insider threat modules)', category: 'GRC', env: 'saas', dataPlaneId: 'dp-comm', tenants: 'all', read: ['Training completion', 'Phishing tests', 'Risk scores'], write: ['Enrol user'], status: 'healthy', lastSyncMin: 140, intervalMin: 720, records: 560, drift: 0, version: '1.0.3' },
    // Intelligence
    { id: 'c-hexaint', vendor: 'HexaShield', product: 'HexaInt', category: 'Intelligence', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Indicators', 'Exposures', 'Dark web'], write: [], status: 'healthy', lastSyncMin: 2, intervalMin: 5, records: 6400, drift: 0, version: '2.1.0' },
    { id: 'c-dib-taxii', vendor: 'Generic', product: 'TAXII 2.1 (DC3 DCISE, NDISAC, CISA AIS)', category: 'Intelligence', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Indicators', 'Intrusion sets', 'Advisories'], write: [], status: 'healthy', lastSyncMin: 28, intervalMin: 60, records: 11200, drift: 0, version: '1.0.0' },
    // Validation
    { id: 'c-hexastrike', vendor: 'HexaShield', product: 'HexaStrike', category: 'Validation', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Validation results', 'Findings'], write: ['Schedule test'], status: 'healthy', lastSyncMin: 10, intervalMin: 15, records: 1100, drift: 0, version: '2.0.0' },
    { id: 'c-attackiq', vendor: 'AttackIQ', product: 'Enterprise (on-prem appliance)', category: 'Validation', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['programs', 'engineering', 'corporate'], read: ['Assessment results', 'Scenario library', 'MITRE coverage'], write: ['Run assessment'], status: 'paused', lastSyncMin: 4320, intervalMin: 1440, records: 840, drift: 0, version: '1.1.0', note: 'Paused by the Security Platform Owner during the C3PAO readiness review' },
    // Custody
    { id: 'c-hexacustody', vendor: 'HexaShield', product: 'HexaCustody agents (TDPs to primes & sub-tiers)', category: 'Custody', env: 'saas', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering', 'manufacturing'], read: ['Custody events', 'Transfers', 'Export markings', 'Recipient US-person status'], write: ['Revoke access'], status: 'healthy', lastSyncMin: 1, intervalMin: 5, records: 4800, drift: 0, version: '1.3.0' },
    // AppSec
    { id: 'c-ghas', vendor: 'GitHub', product: 'Enterprise Server Advanced Security (flight software)', category: 'AppSec', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['engineering'], read: ['Code scanning', 'Secret scanning', 'Dependency review', 'SBOM'], write: [], status: 'healthy', lastSyncMin: 24, intervalMin: 60, records: 2300, drift: 0, version: '1.0.0' },
    { id: 'c-coverity', vendor: 'Black Duck', product: 'Coverity static analysis (DO-178C / MISRA)', category: 'AppSec', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['engineering'], read: ['Defects', 'MISRA violations', 'Snapshots'], write: [], status: 'healthy', lastSyncMin: 50, intervalMin: 120, records: 3900, drift: 0, version: '1.0.2' },
    // Asset / CMDB
    { id: 'c-axonius', vendor: 'Axonius', product: 'Federal Systems asset inventory', category: 'Asset / CMDB', env: 'saas', dataPlaneId: 'dp-gcch', tenants: 'all', read: ['Devices', 'Users', 'Coverage gaps', 'CUI asset tags'], write: [], status: 'degraded', lastSyncMin: 150, intervalMin: 60, records: 2700, drift: 0, version: '1.1.1', note: 'Rate limited (429) since 07:10' },
    { id: 'c-intune', vendor: 'Microsoft', product: 'Intune (GCC High)', category: 'Asset / CMDB', env: 'cloud', dataPlaneId: 'dp-gcch', tenants: ['programs', 'engineering', 'tucson'], read: ['Managed devices', 'Compliance state', 'BitLocker (FIPS) status'], write: ['Retire device'], status: 'healthy', lastSyncMin: 14, intervalMin: 30, records: 920, drift: 0, version: '1.2.0' },
    { id: 'c-teamcenter', vendor: 'Siemens', product: 'Teamcenter PLM (ITAR item audit)', category: 'Asset / CMDB', env: 'onprem', dataPlaneId: 'dp-hsv', tenants: ['engineering', 'programs'], read: ['ITAR / EAR classified items', 'Access changes', 'Exports & downloads'], write: [], status: 'healthy', lastSyncMin: 17, intervalMin: 30, records: 38600, drift: 0, version: '1.0.3' },
    { id: 'c-costpoint', vendor: 'Deltek', product: 'Costpoint GovCloud (finance & timekeeping)', category: 'Asset / CMDB', env: 'saas', dataPlaneId: 'dp-comm', tenants: ['corporate', 'programs'], read: ['Privileged role changes', 'Vendor master changes', 'Timesheet audit trail'], write: [], status: 'degraded', lastSyncMin: 140, intervalMin: 60, records: 5100, drift: 2, version: '0.9.1', note: 'API token expires in 3 days; field drift after Costpoint 8.2 update' },
    // Ratings
    { id: 'c-scorecard', vendor: 'SecurityScorecard', product: 'Supply-chain ratings', category: 'Ratings', env: 'saas', dataPlaneId: 'dp-comm', tenants: 'all', read: ['Supplier ratings', 'Issues'], write: [], status: 'healthy', lastSyncMin: 300, intervalMin: 1440, records: 240, drift: 0, version: '1.0.0' },
  ],
  frameworks: [
    { id: 'cmmc-l2', name: 'CMMC 2.0 Level 2 (C3PAO certification)', short: 'CMMC L2', kind: 'Certification', requirements: 110, inScope: 110, documented: 84, assured: 58, nextAudit: 'C3PAO Level 2 assessment, Feb', owner: 'Director of Compliance & CMMC' },
    { id: 'nist-171', name: 'NIST SP 800-171 r2 (SPRS 88/110)', short: 'NIST 800-171', kind: 'Standard', requirements: 110, inScope: 110, documented: 86, assured: 60, nextAudit: 'SPRS score update (target 104), Dec', owner: 'Director of Compliance & CMMC' },
    { id: 'nist-171r3', name: 'NIST SP 800-171 r3 transition', short: '800-171 r3', kind: 'Standard', requirements: 97, inScope: 97, documented: 52, assured: 31, owner: 'Director of Compliance & CMMC' },
    { id: 'dfars-7012', name: 'DFARS 252.204-7012 (safeguarding CDI, 72-hour reporting)', short: 'DFARS 7012', kind: 'Contractual', requirements: 14, inScope: 14, documented: 93, assured: 71, owner: 'Director of Cybersecurity & CISO' },
    { id: 'dfars-7019', name: 'DFARS 252.204-7019 / 7020 / 7021 (SPRS & CMMC clauses)', short: 'DFARS 7019-7021', kind: 'Contractual', requirements: 9, inScope: 9, documented: 89, assured: 64, owner: 'Contracts & Subcontracts Manager' },
    { id: 'itar-ear', name: 'ITAR (22 CFR 120-130) & EAR technology control plan', short: 'ITAR / EAR', kind: 'Regulation', requirements: 38, inScope: 36, documented: 81, assured: 49, nextAudit: 'Annual TCP self-audit, Jan', owner: 'Empowered Official & Trade Compliance Manager' },
    { id: 'nist-172', name: 'NIST SP 800-172 enhanced requirements (selected programs)', short: 'NIST 800-172', kind: 'Standard', requirements: 35, inScope: 14, documented: 46, assured: 22, owner: 'Director of Cybersecurity & CISO' },
    { id: 'as9100', name: 'AS9100D / ISO 9001:2015 quality management', short: 'AS9100D', kind: 'Certification', requirements: 104, inScope: 96, documented: 88, assured: 40, nextAudit: 'Registrar surveillance audit, Mar', owner: 'Director of Quality' },
  ],
  services: {
    mdr: 'active', hunting: 'trial', ir: 'active', forensics: 'active', 'detection-eng': 'available', 'attack-coverage': 'active',
    darkweb: 'active', osint: 'active', exposure: 'active',
    pentest: 'active', redteam: 'available', purpleteam: 'trial', asm: 'active',
    'ot-visibility': 'active', 'ot-vuln': 'active', 'ot-pentest': 'available',
    caas: 'active', tprm: 'active', 'ai-gov': 'trial',
    custody: 'active',
  },
  integrationLimit: 45,
  people: {
    ciso: { name: 'Dana Whitfield', role: 'Director of Cybersecurity & CISO', email: 'dana.whitfield@sentrypeakdefense.com' },
    socLead: { name: 'Darnell Hayes', role: 'Security Operations Manager', email: 'darnell.hayes@sentrypeakdefense.com' },
    grcLead: { name: 'Rebecca Lyle', role: 'Director of Compliance & CMMC', email: 'rebecca.lyle@sentrypeakdefense.com' },
    otLead: { name: 'Travis Hollingsworth', role: 'Manufacturing Systems & OT Security Lead', email: 'travis.hollingsworth@sentrypeakdefense.com' },
    admin: { name: 'Kevin Odom', role: 'Security Platform Owner', email: 'kevin.odom@sentrypeakdefense.com' },
    board: { name: 'Raymond Castellano', role: 'President & Chief Executive Officer', email: 'raymond.castellano@sentrypeakdefense.com', vip: true },
    staff: [
      { name: 'Linda Pruitt', role: 'Chief Financial Officer', email: 'linda.pruitt@sentrypeakdefense.com', vip: true },
      { name: 'Gregory Ames', role: 'Vice President, Programs', email: 'gregory.ames@sentrypeakdefense.com', vip: true },
      { name: 'Dr. Anita Raman', role: 'Chief Technology Officer (guidance & avionics)', email: 'anita.raman@sentrypeakdefense.com', vip: true },
      { name: 'Shawn McAllister', role: 'Vice President, Operations & Manufacturing', email: 'shawn.mcallister@sentrypeakdefense.com', vip: true },
      { name: 'Carla Jennings', role: 'Empowered Official & Trade Compliance Manager', email: 'carla.jennings@sentrypeakdefense.com' },
      { name: 'Derek Washington', role: 'IT Infrastructure Manager', email: 'derek.washington@sentrypeakdefense.com' },
      { name: 'Erin Kowalski', role: 'Contracts & Subcontracts Manager', email: 'erin.kowalski@sentrypeakdefense.com' },
      { name: 'Jamal Henderson', role: 'CNC Programming Lead, Building 3', email: 'jamal.henderson@sentrypeakdefense.com' },
      { name: 'Tessa Moreno', role: 'Test Range Manager, Tucson', email: 'tessa.moreno@sentrypeakdefense.com' },
      { name: 'Brian Nguyen', role: 'PLM Administrator (Teamcenter)', email: 'brian.nguyen@sentrypeakdefense.com' },
      { name: 'Holly Burkett', role: 'Facility Security Officer', email: 'holly.burkett@sentrypeakdefense.com' },
    ],
  },
  rolePeople: {
    master: { name: 'Kevin Odom', role: 'Security Platform Owner', email: 'kevin.odom@sentrypeakdefense.com' },
    executive: { name: 'Raymond Castellano', role: 'President & Chief Executive Officer', email: 'raymond.castellano@sentrypeakdefense.com', vip: true },
    ciso: { name: 'Dana Whitfield', role: 'Director of Cybersecurity & CISO', email: 'dana.whitfield@sentrypeakdefense.com' },
    finance: { name: 'Linda Pruitt', role: 'Chief Financial Officer', email: 'linda.pruitt@sentrypeakdefense.com', vip: true },
    socmanager: { name: 'Darnell Hayes', role: 'Security Operations Manager', email: 'darnell.hayes@sentrypeakdefense.com' },
    analyst: { name: 'Andre Sims', role: 'Senior SOC Analyst', email: 'andre.sims@sentrypeakdefense.com' },
    threat: { name: 'Megan Calloway', role: 'Threat Intelligence Lead', email: 'megan.calloway@sentrypeakdefense.com' },
    grc: { name: 'Rebecca Lyle', role: 'Director of Compliance & CMMC', email: 'rebecca.lyle@sentrypeakdefense.com' },
    risk: { name: 'Philip Garner', role: 'Head of Enterprise Risk & Resilience', email: 'philip.garner@sentrypeakdefense.com' },
    privacy: { name: 'Natalie Brooks', role: 'Chief Privacy Officer & CUI Program Manager', email: 'natalie.brooks@sentrypeakdefense.com' },
    ot: { name: 'Travis Hollingsworth', role: 'Manufacturing Systems & OT Security Lead', email: 'travis.hollingsworth@sentrypeakdefense.com' },
    cloud: { name: 'Victor Ramirez', role: 'Cloud & Infrastructure Security Lead (GCC High)', email: 'victor.ramirez@sentrypeakdefense.com' },
    admin: { name: 'Lauren Tate', role: 'Security Platform Engineer', email: 'lauren.tate@sentrypeakdefense.com' },
  },
  thirdParties: [
    { name: 'Lockheed Martin', category: 'Prime contractor (customer)', tier: 1, access: 'CUI TDP exchange via Exostar & PreVeil, flow-down DFARS 7012', rating: 88, country: 'US' },
    { name: 'RTX (Raytheon)', category: 'Prime contractor (customer)', tier: 1, access: 'Guidance subsystem specs, supplier portal', rating: 86, country: 'US' },
    { name: 'Northrop Grumman', category: 'Prime contractor (customer)', tier: 1, access: 'Test equipment specs, CUI drawings', rating: 87, country: 'US' },
    { name: 'L3Harris Technologies', category: 'Prime contractor (customer)', tier: 1, access: 'Avionics interface control documents', rating: 84, country: 'US' },
    { name: 'Microsoft (GCC High via Carahsoft)', category: 'Cloud provider (FedRAMP High)', tier: 1, access: 'Hosts the CUI enclave (M365 GCC High, Azure Government)', rating: 90, country: 'US' },
    { name: 'Exostar', category: 'Supplier identity & collaboration portal', tier: 1, access: 'Prime portal federation, supplier attestations', rating: 79, country: 'US' },
    { name: 'Deltek', category: 'ERP SaaS (Costpoint GovCloud)', tier: 1, access: 'Finance, timekeeping, contract data', rating: 81, country: 'US' },
    { name: 'Redstone Cyber Assessors', category: 'C3PAO (fictional)', tier: 2, access: 'Assessment evidence (read-only, time-bound)', rating: 83, country: 'US' },
    { name: 'Siemens Digital Industries Software', category: 'PLM & CAD tooling', tier: 2, access: 'Teamcenter support (US-person staff only)', rating: 78, country: 'US' },
    { name: 'Haas Automation', category: 'CNC machine OEM', tier: 2, access: 'Remote diagnostics via BeyondTrust (Building 3)', rating: 70, country: 'US' },
    { name: 'Cumberland Precision Machining', category: 'Sub-tier machine shop (fictional)', tier: 1, access: 'ITAR drawings & TDPs via HexaCustody', rating: 58, country: 'US' },
    { name: 'Valley Anodize & Finishing', category: 'Sub-tier finishing supplier (fictional)', tier: 2, access: 'Process specs, part drawings (CUI)', rating: 54, country: 'US' },
    { name: 'Desert Sky Telemetry', category: 'Range telemetry services (fictional)', tier: 2, access: 'Tucson range network, test data', rating: 62, country: 'US' },
    { name: 'Expeditors International', category: 'Freight forwarder (export shipments)', tier: 2, access: 'Export documentation, EEI / AES filings', rating: 80, country: 'US' },
    { name: 'Ansys', category: 'Simulation software', tier: 3, access: 'Licence server telemetry', rating: 82, country: 'US' },
  ],
  vocab: {
    hostPrefix: 'SPD',
    servers: ['SPD-DC01', 'SPD-DC02', 'SPD-TC-PRD01', 'SPD-PDM-VLT01', 'SPD-LIC-FLEX01', 'SPD-FS-CUI01', 'SPD-GHE-01', 'SPD-JUMP-OT01', 'B3-DNC-SRV01', 'B3-CMM-WS02', 'B3-HIST-01', 'TUS-TEST-DAQ01'],
    crownJewels: ['CUI enclave (M365 GCC High tenant)', 'ITAR technical data in Teamcenter PLM', 'Guidance subsystem flight software repository', 'DNC server & CNC programmes (Building 3)', 'Automated test equipment & calibration data', 'Deltek Costpoint (DCAA-audited finance)', 'SSP, POA&M & SPRS evidence'],
    businessServices: ['Avionics & guidance subsystem delivery', 'Precision machining for primes', 'Test equipment build & calibration', 'Range test campaigns (Tucson)', 'Proposals & capture (CUI volumes)', 'DCAA-compliant finance & timekeeping'],
    threatActors: ['APT40', 'APT41', 'Volt Typhoon', 'APT29', 'Lazarus Group', 'LockBit affiliates'],
    otSystems: ['Haas VF-4SS CNC mill', 'DMG Mori NLX 2500 lathe', 'Zeiss CONTURA CMM', 'DNC programme server', 'Thermotron environmental chamber', 'Vibration shaker table controller', 'Avionics ATE bench (NI PXI)', 'Allen-Bradley ControlLogix (heat treat)', 'AVEVA historian', 'Range telemetry receiver (Tucson)', 'Building management system (HVAC, compressed air)'],
    otProtocols: ['MTConnect', 'EtherNet/IP', 'Modbus/TCP', 'OPC UA', 'DNC serial-over-IP', 'BACnet/IP'],
    custodyLabel: 'CUI technical data, ITAR drawings & proposal volumes',
    custodyItems: ['TDP-2207 guidance housing (ITAR, USML Cat. XII)', 'Seeker gimbal drawing set rev F (CUI//SP-EXPT)', 'ATE qualification test report QTR-118', 'System Security Plan v4.2 & POA&M', 'Proposal volume II (technical), RTX capture', 'Flight software build 3.7.1 (export-controlled)', 'Environmental test data, Tucson campaign 26-04', 'First article inspection reports (AS9102)'],
    aiSystems: ['Microsoft 365 Copilot (commercial tenant; GCC High pending)', 'Azure OpenAI in Azure Government (CUI-scoped pilot)', 'GitHub Copilot (blocked in CUI enclave)', 'CMM inspection anomaly model', 'Predictive spindle maintenance (Building 3)', 'Proposal drafting assistant (non-CUI)', 'ChatGPT (unsanctioned, engineering)', 'DeepSeek (unsanctioned, blocked by Zscaler)'],
    lookalikeBase: 'sentrypeakdefense',
    externalHosts: ['www.sentrypeakdefense.com', 'vpn.sentrypeakdefense.com', 'portal.sentrypeakdefense.com', 'sftp.sentrypeakdefense.com', 'careers.sentrypeakdefense.com', 'autodiscover.sentrypeakdefense.com', 'suppliers.sentrypeakdefense.com', 'remote.sentrypeakdefense.com', 'test.sentrypeakdefense.com', 'status.sentrypeakdefense.com'],
    cloudAccounts: [
      { provider: 'Azure', name: 'spd-gcch-cui-prod', tenant: 'programs' },
      { provider: 'Azure', name: 'spd-gcch-sentinel', tenant: 'programs' },
      { provider: 'Azure', name: 'spd-gcch-eng-hpc', tenant: 'engineering' },
      { provider: 'Azure', name: 'spd-gcch-ot-historian', tenant: 'manufacturing' },
      { provider: 'Azure', name: 'spd-commercial-corp', tenant: 'corporate' },
      { provider: 'AWS', name: 'spd-govcloud-range-data', tenant: 'tucson' },
    ],
  },
  insurance: { carrier: 'Beazley (primary) / Coalition (excess)', broker: 'Marsh McLennan Agency', limitM: 10, retentionK: 250, premiumK: 285, renewalDays: 96 },
  scores: { soc: 82, int: 80, strike: 74, ot: 69, comply: 78, custody: 84, ai: 66, insurance: 72, fabric: 81 },
};
