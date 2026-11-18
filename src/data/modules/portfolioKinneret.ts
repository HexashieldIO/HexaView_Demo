// Portfolio & M&A seed data for the Kinneret Business Cyber partner (shown when
// the selected customer is `telco`): Kinneret Telecom Group's lens over its
// group companies, joint ventures and minority investments, plus acquisition
// targets. All names are fictional. Staff are named by their Northwind seat and
// resolved with staffAlias() in portfolio.ts. USD, like the rest of the tab.
// Types only from portfolio.ts: a value import would be a runtime cycle.

import type { DdCategory, DdFinding, DdSev, DdTarget, PfSeed } from './portfolio';

export const KT_EXTRA: PfSeed[] = [
  { name: 'Gilboa Tower Infrastructure', short: 'Gilboa', colour: '#0e7490', sector: 'Passive infrastructure (towers)', country: 'IL', ownership: 'Group subsidiary', revenueM: 210, employees: 320, multiple: 7, topRisk: 'Site-controller management network reachable from a maintenance contractor VPN without per-user MFA', frameworks: ['ISO 27001', 'INCD CDM', 'IEC 62443'], ri: 67, status: 'watch', ot: true, holdingMonths: 46 },
  { name: 'Lachish Data Centres', short: 'Lachish', colour: '#4f46e5', sector: 'Data-centre joint venture', country: 'IL', ownership: 'Majority', revenueM: 140, employees: 180, multiple: 8, topRisk: 'Building management and chiller plant share a flat network with the customer-portal servers at the second campus', frameworks: ['SOC 2', 'ISO 27001', 'IEC 62443'], ri: 78, status: 'healthy', ot: true, holdingMonths: 31 },
  { name: 'Kinneret Pay', short: 'KinPay', colour: '#0891b2', sector: 'Payments & mobile wallet', country: 'IL', ownership: 'Group subsidiary', revenueM: 95, employees: 210, multiple: 4.2, topRisk: 'Wallet API tokens for 3 merchant integrators have not been rotated in 14 months', frameworks: ['PCI DSS', 'Privacy Protection Regulations', 'ISO 27001'], ri: 81, status: 'healthy', ot: false, holdingMonths: 52 },
  { name: 'Meron Connected Systems', short: 'Meron', colour: '#7c3aed', sector: 'IoT & smart metering', country: 'IL', ownership: 'Group subsidiary', revenueM: 60, employees: 150, multiple: 2.4, topRisk: '38,000 smart-meter gateways run a firmware release that is out of vendor support', frameworks: ['ISO 27001', 'IEC 62443', 'INCD CDM'], ri: 64, status: 'watch', ot: true, holdingMonths: 27 },
  { name: 'Kition Carrier Services', short: 'Kition', colour: '#b45309', sector: 'Wholesale PoP & transit', country: 'CY', ownership: 'Majority', revenueM: 34, employees: 70, multiple: 5, topRisk: 'Out-of-band management of the Limassol PoP reachable from the office network; NIS2 registration still pending', frameworks: ['NIS2', 'ISO 27001', 'ISO 27011'], ri: 69, status: 'watch', ot: true, holdingMonths: 22 },
  { name: 'Dekel Customer Operations', short: 'Dekel', colour: '#be185d', sector: 'Contact-centre outsourcing', country: 'IL', ownership: 'Minority', revenueM: 55, employees: 1900, multiple: 0.9, topRisk: 'Agents can change a SIM or an account owner without step-up verification on 2 client programmes', frameworks: ['Privacy Protection Regulations', 'PCI DSS', 'ISO 27001'], ri: 58, status: 'critical', ot: false, holdingMonths: 18 },
  { name: 'Alumot Networks', short: 'Alumot', colour: '#9333ea', sector: 'Network analytics software (SaaS)', country: 'IL', ownership: 'Minority', revenueM: 28, employees: 140, multiple: 9, topRisk: 'Production cloud account shares an identity tenant with the R&D sandbox; 6 standing administrator roles', frameworks: ['SOC 2', 'ISO 27001'], ri: 80, status: 'healthy', ot: false, holdingMonths: 14 },
  { name: 'Hermon Fibre Networks', short: 'Hermon', colour: '#1d4ed8', sector: 'Regional fibre ISP', country: 'IL', ownership: 'Add-on', revenueM: 48, employees: 260, multiple: 3.1, topRisk: 'No EDR on the provisioning servers; home gateways managed with one shared administrator account', frameworks: ['Privacy Protection Regulations', 'ISO 27011'], ri: 55, status: 'integrating', ot: true, day: 38, holdingMonths: 1 },
  { name: 'Rimon Security Labs', short: 'Rimon', colour: '#a16207', sector: 'Cyber security services', country: 'IL', ownership: 'Add-on', revenueM: 12, employees: 85, multiple: 4.5, topRisk: 'Client penetration-test evidence held on consultant laptops outside any managed tenant', frameworks: ['ISO 27001', 'SOC 2'], ri: 60, status: 'integrating', ot: false, day: 11, holdingMonths: 0 },
];

const F = (id: string, category: DdCategory, sev: DdSev, title: string, detail: string, source: string, lo: number, hi: number, redFlag?: boolean): DdFinding => ({ id, category, sev, title, detail, source, fixLowK: lo, fixHighK: hi, redFlag });

export const KT_DD_TARGETS: DdTarget[] = [
  {
    id: 'tzafit', name: 'Tzafit Broadband Ltd', short: 'Tzafit', colour: '#0e7490', sector: 'Regional fibre and fixed-wireless ISP', hq: 'Karmiel, Israel',
    employees: 310, revenueM: 62, dealValueM: 190, stage: 'Confirmatory DD', dealLead: 'Priya Raman', signingIn: 24, domains: 7, externalAssets: 236, outsideIn: 57, peer: 68,
    certifications: [{ name: 'ISO/IEC 27001', state: 'expired' }, { name: 'Ministry of Communications licence', state: 'valid' }, { name: 'PCI DSS (SAQ D)', state: 'claimed' }, { name: 'ISO 22301', state: 'none' }],
    questionnaire: [
      { section: 'Governance', answered: 13, total: 14, flagged: 3 }, { section: 'Identity & access', answered: 16, total: 18, flagged: 5 }, { section: 'Endpoint & server', answered: 11, total: 12, flagged: 2 },
      { section: 'Network & OT', answered: 9, total: 15, flagged: 4 }, { section: 'Data protection', answered: 9, total: 10, flagged: 2 }, { section: 'Third parties', answered: 6, total: 11, flagged: 2 },
      { section: 'Incident response', answered: 8, total: 9, flagged: 1 }, { section: 'Backup & recovery', answered: 7, total: 8, flagged: 3 },
    ],
    findings: [
      F('TZ-01', 'Attack surface', 'critical', 'Home-gateway management (TR-069) service exposed to the internet on an unsupported release', 'acs.tzafit-broadband.co.il answers from any address; the auto-configuration server version left vendor support in 2024. It manages about 41,000 home gateways.', 'HexaInt outside-in scan', 70, 160, true),
      F('TZ-02', 'Attack surface', 'high', 'Network-management and monitoring consoles reachable from the internet', 'Two monitoring dashboards and one router web console respond on public addresses registered to the target; one shows a default vendor login page.', 'HexaInt outside-in scan', 20, 50, true),
      F('TZ-03', 'Leaked credentials', 'high', '96 employee credentials in breach corpora; 22 from 2026 stealer logs', 'Includes two network engineers and the billing team lead; 7 match the VPN username format and are less than 60 days old.', 'HexaInt credential monitoring', 15, 35),
      F('TZ-04', 'Dark web', 'medium', 'Subscriber list sample offered on a closed forum', 'A post offers "customer list, northern fibre ISP, 60k rows". Sample fields overlap with the target billing export format; not confirmed.', 'HexaInt dark-web monitoring', 30, 70, true),
      F('TZ-05', 'Breach history', 'high', 'Service outage in 2025 after a configuration wipe on aggregation routers', 'A 9-hour outage across the Galilee; the Ministry of Communications was notified. No root-cause report in the data room.', 'Public disclosure · data room', 0, 0),
      F('TZ-06', 'Certifications', 'medium', 'ISO 27001 certificate lapsed in June; recertification not booked', 'Certificate registry shows withdrawn status. Two municipal customers require it contractually.', 'Certificate registry', 35, 60),
      F('TZ-07', 'Email & domain', 'medium', 'DMARC at p=none on 5 of 7 domains; 3 look-alike domains registered', 'One look-alike hosts a copy of the customer bill-payment page.', 'HexaInt domain monitoring', 6, 14),
      F('TZ-08', 'Questionnaire', 'high', 'No separation between office IT and network management', 'Answer to NW-07: engineers reach routers and street-cabinet power controllers from office laptops; field contractors share two VPN accounts.', 'Questionnaire NW-07', 140, 260, true),
      F('TZ-09', 'Questionnaire', 'medium', 'Subscriber database security level not documented', 'Answer to DP-02: no database definitions document or periodic audit under the Privacy Protection Regulations (Data Security).', 'Questionnaire DP-02', 40, 80),
    ],
    breaches: [{ year: 2025, what: 'Router configuration wipe, 9-hour regional outage, regulator notified' }, { year: 2023, what: 'Business email compromise, supplier invoice fraud', records: '₪0.6M loss' }],
    darkWeb: { mentions: 9, credentials: 96, stealerHosts: 5 },
    summary: 'Material cyber debt in network-management exposure and segmentation, an unexplained 2025 outage and a possible subscriber-data sample in circulation. Fixable inside the first 100 days once the network joins group tooling, but priced risk is warranted.',
  },
  {
    id: 'akamas', name: 'Akamas Cloud Services Ltd', short: 'Akamas', colour: '#4f46e5', sector: 'Managed cloud and hosting', hq: 'Nicosia, Cyprus',
    employees: 190, revenueM: 41, dealValueM: 150, stage: 'Exclusivity', dealLead: 'Tom Ellery', signingIn: 41, domains: 11, externalAssets: 318, outsideIn: 66, peer: 71,
    certifications: [{ name: 'ISO/IEC 27001', state: 'valid' }, { name: 'SOC 2 Type II', state: 'claimed' }, { name: 'PCI DSS v4.0.1 (hosting provider)', state: 'valid' }, { name: 'NIS2 registration', state: 'none' }],
    questionnaire: [
      { section: 'Governance', answered: 13, total: 14, flagged: 2 }, { section: 'Identity & access', answered: 17, total: 18, flagged: 3 }, { section: 'Endpoint & server', answered: 12, total: 12, flagged: 1 },
      { section: 'Cloud & DevOps', answered: 14, total: 16, flagged: 4 }, { section: 'Data protection', answered: 10, total: 10, flagged: 1 }, { section: 'Third parties', answered: 7, total: 11, flagged: 2 },
      { section: 'Incident response', answered: 8, total: 9, flagged: 1 }, { section: 'Backup & recovery', answered: 8, total: 8, flagged: 1 },
    ],
    findings: [
      F('AK-01', 'Attack surface', 'critical', 'Hypervisor management interface exposed on the internet', 'Two virtualisation management hosts answer on public addresses in the Nicosia facility range; the banner shows a release with a known exploited vulnerability.', 'HexaInt outside-in scan', 40, 90, true),
      F('AK-02', 'Attack surface', 'high', 'Customer control panel on an end-of-life web stack', 'panel.akamas-cloud.com.cy runs a framework release out of support since 2024; a WAF is in front.', 'HexaInt outside-in scan', 45, 100),
      F('AK-03', 'Leaked credentials', 'high', 'Automation token for the provisioning platform in a public code repository', 'Committed 5 weeks ago by a contractor. The target says it was revoked; audit-log evidence requested.', 'HexaInt code-leak monitoring', 20, 60, true),
      F('AK-04', 'Certifications', 'high', 'SOC 2 Type II claimed on the website; no report provided', 'The target states the observation period ends next quarter. Three enterprise customers cite it in contracts.', 'Data room · public website', 60, 110, true),
      F('AK-05', 'Questionnaire', 'high', 'Tenant isolation relies on shared administrator accounts', 'Answer to IA-06: 14 engineers share 3 platform administrator accounts; no session recording.', 'Questionnaire IA-06', 80, 170),
      F('AK-06', 'Questionnaire', 'medium', 'NIS2 registration and incident-reporting procedure not in place', 'Managed service providers are in scope in Cyprus; the gap analysis has not started.', 'Questionnaire GV-09', 50, 100),
      F('AK-07', 'Email & domain', 'low', 'DMARC enforced (p=reject) on all sending domains', 'Good practice; no action.', 'HexaInt domain monitoring', 0, 0),
      F('AK-08', 'Breach history', 'low', 'No public breaches or regulatory notifications found', 'Covers the Cyprus data protection commissioner and press sources since 2020.', 'Public sources', 0, 0),
    ],
    breaches: [],
    darkWeb: { mentions: 6, credentials: 41, stealerHosts: 2 },
    summary: 'A sound hosting business with one urgent exposure (management interfaces on the internet) and immature assurance: an unverified SOC 2 claim, shared platform administrators and no NIS2 readiness. Recommend escrow tied to evidence of remediation and the SOC 2 report.',
  },
  {
    id: 'nitzan', name: 'Nitzan Smart City Systems Ltd', short: 'Nitzan', colour: '#0891b2', sector: 'IoT and smart-city integrator', hq: 'Rehovot, Israel',
    employees: 240, revenueM: 36, dealValueM: 110, stage: 'LOI signed', dealLead: 'Priya Raman', signingIn: 58, domains: 5, externalAssets: 142, outsideIn: 62, peer: 64,
    certifications: [{ name: 'ISO/IEC 27001', state: 'valid' }, { name: 'ISO 9001', state: 'valid' }, { name: 'IEC 62443-2-4', state: 'none' }, { name: 'SOC 2 Type II', state: 'none' }],
    questionnaire: [
      { section: 'Governance', answered: 14, total: 14, flagged: 1 }, { section: 'Identity & access', answered: 17, total: 18, flagged: 3 }, { section: 'Endpoint & server', answered: 12, total: 12, flagged: 1 },
      { section: 'Network & OT', answered: 12, total: 15, flagged: 4 }, { section: 'Data protection', answered: 10, total: 10, flagged: 2 }, { section: 'Third parties', answered: 8, total: 11, flagged: 2 },
      { section: 'Incident response', answered: 9, total: 9, flagged: 1 }, { section: 'Backup & recovery', answered: 7, total: 8, flagged: 1 },
    ],
    findings: [
      F('NZ-01', 'Attack surface', 'high', 'Municipal IoT platform login without multi-factor authentication', 'The operator portal used by 9 municipalities for street lighting, parking and traffic sensors accepts password-only sign-in.', 'HexaInt outside-in scan · questionnaire', 25, 55, true),
      F('NZ-02', 'Attack surface', 'high', 'Field gateways reachable over public cellular addresses', '212 gateways answer on public addresses; device banners show firmware two major releases behind.', 'HexaInt outside-in scan', 60, 130, true),
      F('NZ-03', 'Leaked credentials', 'medium', '38 credentials in breach corpora; 4 from recent stealer logs', 'One belongs to a field-service supervisor with access to the gateway provisioning tool.', 'HexaInt credential monitoring', 8, 18),
      F('NZ-04', 'Questionnaire', 'high', 'Camera and licence-plate data retained without a defined period', 'Answer to DP-05: parking and traffic images kept indefinitely; the municipalities are the database owners and the target is the holder.', 'Questionnaire DP-05', 40, 90, true),
      F('NZ-05', 'Questionnaire', 'medium', 'Vendor remote support to municipal control rooms is not brokered', 'Answer to NW-11: remote-desktop tools installed per site; no session recording.', 'Questionnaire NW-11', 35, 75),
      F('NZ-06', 'Email & domain', 'medium', 'DMARC at p=quarantine; 2 look-alike domains registered', 'Look-alikes imitate the tender-submission mailbox.', 'HexaInt domain monitoring', 4, 10),
      F('NZ-07', 'Breach history', 'low', 'No public breaches or regulatory notifications found', 'Covers the Privacy Protection Authority and press sources since 2020.', 'Public sources', 0, 0),
    ],
    breaches: [],
    darkWeb: { mentions: 3, credentials: 38, stealerHosts: 1 },
    summary: 'Close to sector peers and ISO 27001 certified. The exposure is in the field: internet-reachable gateways, a password-only operator portal and undefined retention of municipal image data. Recommend conditions precedent on the portal and a retention schedule agreed with the municipalities.',
  },
];
