// Seed data for the second partner: Kinneret Business Cyber, the managed-security
// arm of Kinneret Telecom Group (shown when the selected customer is `telco`).
// It resells HexaView to the group's business customers. Same shapes as the
// Northwind seeds in partner.ts; partner.ts picks the set for the active partner.
// Every organisation here is fictional. Types only are imported from partner.ts.

import type { Campaign, ContentItem, Deal, MdfClaim, ProvRequest, SavedQuote, SmallSeed, Ticket } from './partner';

type ClientId = (short: string) => string;

/** Fifteen seats in the same order as Northwind's team (name, role). */
const staff: [name: string, role: string][] = [
  ['Yael Carmi', 'General Manager, Kinneret Business Cyber'],
  ['Oren Tzur', 'Head of Sales'],
  ['Lina Zaher', 'Account Executive, Finance & Public Sector'],
  ['Boaz Shalev', 'Account Executive, Industry & Infrastructure'],
  ['Keren Oz', 'Solutions Architect'],
  ['Fadi Mazzawi', 'Solutions Engineer'],
  ['Asaf Dror', 'SOC Lead, Petah Tikva'],
  ['Rasha Daoud', 'SOC Analyst L2'],
  ['Tomer Malka', 'SOC Analyst L1'],
  ['Inbal Sasson', 'OT Security Engineer'],
  ['Yuval Amar', 'GRC Consultant'],
  ['Sivan Ohayon', 'Customer Success Manager'],
  ['Majd Khalil', 'Customer Success Manager'],
  ['Hadas Weiss', 'Partner Marketing Manager'],
  ['Roi Elbaz', 'Platform Engineer'],
];

/** Business customers of the telco that buy managed security from its MSSP arm. */
const small: SmallSeed[] = [
  { name: 'Bank Tavor', short: 'Bank Tavor', sector: 'Banking', city: 'Haifa', country: 'IL', lat: 32.79, lon: 34.99, colour: '#1d4ed8', tier: 'Enterprise / CNI', status: 'active', employees: 3400, services: ['mdr', 'hunting', 'ir', 'darkweb', 'pentest', 'redteam', 'caas', 'tprm'], frameworks: ['Bank of Israel Directive 361', 'PCI DSS 4.0', 'ISO 27001', 'Privacy Protection Regulations'], issue: 'Red-team finding open for 41 days: help-desk reset path without call-back verification', deployment: 'Customer Azure data plane', residency: 'Israel Central' },
  { name: 'Emek Health Services', short: 'Emek Health', sector: 'Healthcare', city: 'Afula', country: 'IL', lat: 32.61, lon: 35.29, colour: '#dc2626', tier: 'Professional', status: 'active', employees: 5200, services: ['mdr', 'ir', 'ot-visibility', 'ot-vuln', 'caas'], frameworks: ['Ministry of Health cyber guidance', 'Privacy Protection Regulations', 'ISO 27001'], issue: '310 imaging and infusion devices still on a flat clinical VLAN at the main campus', deployment: 'Customer-hosted + clinical edge', residency: 'Israel Central' },
  { name: 'Municipality of Givat Alon', short: 'Givat Alon', sector: 'Local government', city: 'Kfar Saba', country: 'IL', lat: 32.18, lon: 34.91, colour: '#15803d', tier: 'Essentials', status: 'onboarding', employees: 1900, services: ['mdr', 'caas'], frameworks: ['INCD CDM', 'Privacy Protection Regulations'], issue: 'Onboarding: Microsoft 365 and Check Point connectors pending consent', deployment: 'HexaShield-hosted', residency: 'Israel Central' },
  { name: 'Sharon Regional Water Authority', short: 'Sharon Water', sector: 'Water utility', city: 'Hadera', country: 'IL', lat: 32.44, lon: 34.92, colour: '#0284c7', tier: 'Professional', status: 'active', employees: 780, services: ['mdr', 'ir', 'ot-visibility', 'ot-vuln', 'caas'], frameworks: ['INCD CDM', 'Water-sector cyber requirements', 'IEC 62443'], issue: 'Telemetry at 3 booster stations still uses an unbrokered vendor modem link', deployment: 'HexaShield-hosted + OT edge', residency: 'Israel Central' },
  { name: 'Port of Carmel Logistics', short: 'Port of Carmel', sector: 'Ports & logistics', city: 'Haifa', country: 'IL', lat: 32.82, lon: 35.0, colour: '#ea580c', tier: 'Enterprise / CNI', status: 'active', employees: 2600, services: ['mdr', 'hunting', 'ir', 'ot-visibility', 'ot-vuln', 'ot-pentest', 'exposure', 'tprm'], frameworks: ['INCD CDM', 'IEC 62443', 'ISO 27001', 'ISPS Code'], issue: 'Private 5G gate-automation network: 4 crane telemetry gateways on unsupported firmware', deployment: 'Customer-hosted + terminal edge', residency: 'Israel Central' },
  { name: 'Paylo Fintech', short: 'Paylo', sector: 'Fintech', city: 'Tel Aviv', country: 'IL', lat: 32.07, lon: 34.78, colour: '#7c3aed', tier: 'Professional', status: 'active', employees: 420, services: ['mdr', 'pentest', 'asm', 'darkweb', 'caas', 'ai-gov'], frameworks: ['PCI DSS 4.0', 'SOC 2', 'ISO 27001'], issue: 'Leaked CI token in a public repository (rotated; scope review still open)', deployment: 'Customer AWS data plane', residency: 'AWS il-central-1' },
  { name: 'Hula Valley Growers Co-operative', short: 'Hula Valley', sector: 'Agri-tech co-operative', city: 'Kiryat Shmona', country: 'IL', lat: 33.21, lon: 35.57, colour: '#65a30d', tier: 'Essentials', status: 'active', employees: 640, services: ['mdr', 'exposure', 'darkweb'], frameworks: ['Privacy Protection Regulations', 'ISO 27001'], issue: 'Integration cap reached (5 of 5): irrigation-control telemetry connector queued', deployment: 'HexaShield-hosted', residency: 'Israel Central' },
  { name: 'Negev Institute of Technology', short: 'Negev Tech', sector: 'Higher education', city: "Be'er Sheva", country: 'IL', lat: 31.25, lon: 34.79, colour: '#b45309', tier: 'Professional', status: 'trial', employees: 3100, services: ['mdr'], trial: ['hunting', 'caas', 'exposure'], frameworks: ['INCD CDM', 'Privacy Protection Regulations', 'ISO 27001'], issue: 'Proof of value ends in 12 days: 2 success criteria still open', deployment: 'Customer Azure data plane', residency: 'Israel Central' },
  { name: 'Shefa Retail Chain', short: 'Shefa', sector: 'Retail', city: 'Rishon LeZion', country: 'IL', lat: 31.97, lon: 34.8, colour: '#db2777', tier: 'Professional', status: 'at-risk', employees: 7400, services: ['mdr', 'pentest', 'asm', 'darkweb'], trial: ['caas'], frameworks: ['PCI DSS 4.0', 'Privacy Protection Regulations'], issue: 'Renewal in 38 days; SLA miss on a P1 in September still unresolved with the client', deployment: 'HexaShield-hosted', residency: 'Israel Central' },
  { name: 'Arbel Insurance Group', short: 'Arbel', sector: 'Insurance', city: 'Ramat Gan', country: 'IL', lat: 32.08, lon: 34.81, colour: '#0f766e', tier: 'Professional', status: 'onboarding', employees: 2300, services: ['mdr', 'caas', 'tprm'], frameworks: ['Capital Market Authority cyber-risk circular', 'ISO 27001', 'Privacy Protection Regulations'], issue: 'Onboarding: Splunk Cloud data plane awaiting firewall change', deployment: 'Customer Azure data plane', residency: 'Israel Central' },
  { name: 'Orbis Semiconductors', short: 'Orbis', sector: 'Hi-tech manufacturing', city: 'Yokneam', country: 'IL', lat: 32.66, lon: 35.11, colour: '#475569', tier: 'Professional', status: 'active', employees: 1800, services: ['mdr', 'ir', 'ot-visibility', 'pentest', 'tprm', 'custody'], frameworks: ['ISO 27001', 'IEC 62443', 'SOC 2'], issue: 'Design-file custody: 1 untracked copy at a foundry partner in the last 7 days', deployment: 'Customer-hosted (on-prem Kubernetes)', residency: 'Israel Central' },
  { name: 'Vantic Analytics', short: 'Vantic', sector: 'Software (SaaS scale-up)', city: 'Herzliya', country: 'IL', lat: 32.16, lon: 34.84, colour: '#9333ea', tier: 'Essentials', status: 'active', employees: 310, services: ['mdr', 'darkweb', 'exposure'], frameworks: ['SOC 2', 'ISO 27001'], issue: '9 developer credentials in a stealer log from a personal device', deployment: 'HexaShield-hosted', residency: 'Israel Central' },
];

function prov(id: ClientId): ProvRequest[] {
  return [
    { id: 'PRV-4418', clientId: id('Givat Alon'), kind: 'Add integration', detail: 'Microsoft 365 (read: audit logs, users; write: revoke sessions)', requestedBy: 'Roi Elbaz', ageHours: 5, status: 'awaiting-client', step: 2, steps: ['Requested', 'Consent sent', 'Client consent', 'Credentials in vault', 'First sync'], approval: 'auto' },
    { id: 'PRV-4417', clientId: id('Arbel'), kind: 'Data plane', detail: 'Customer-hosted data plane on Azure Israel Central (Splunk Cloud, Defender, Entra ID)', requestedBy: 'Roi Elbaz', ageHours: 26, status: 'awaiting-client', step: 2, steps: ['Requested', 'Helm chart issued', 'Firewall egress to stamp', 'Heartbeat', 'Connectors bound'], approval: 'partner admin' },
    { id: 'PRV-4415', clientId: id('Negev Tech'), kind: 'Add module', detail: 'HexaSOC 24/7 MDR (trial to paid on PoV success)', requestedBy: 'Boaz Shalev', ageHours: 31, status: 'queued', step: 0, steps: ['Requested', 'Commercials', 'Entitlement', 'Runbooks', 'Live'], approval: 'HexaShield' },
    { id: 'PRV-4412', clientId: id('Kinneret'), kind: 'New tenant', detail: 'New tenant: Limassol PoP (CY), landing-station edge + NIS2 pack', requestedBy: 'Boaz Shalev', ageHours: 52, status: 'in-progress', step: 3, steps: ['Requested', 'Tenant created', 'Data plane', 'Connectors', 'Baseline', 'Live'], approval: 'partner admin' },
    { id: 'PRV-4409', clientId: id('Hula Valley'), kind: 'Add integration', detail: 'Irrigation-control telemetry (blocked: Essentials cap of 5 reached)', requestedBy: 'Majd Khalil', ageHours: 70, status: 'failed', step: 1, steps: ['Requested', 'Entitlement check', 'Consent', 'First sync'], approval: 'auto' },
    { id: 'PRV-4406', clientId: id('Emek Health'), kind: 'Change mode', detail: 'HexaStrike from Advisory to Co-managed (purple teaming)', requestedBy: 'Lina Zaher', ageHours: 96, status: 'in-progress', step: 2, steps: ['Requested', 'SOW signed', 'Entitlement', 'Live'], approval: 'HexaShield' },
    { id: 'PRV-4401', clientId: id('Bank Tavor'), kind: 'Seat change', detail: '+8 analyst seats for the year-end change-freeze watch', requestedBy: 'Sivan Ohayon', ageHours: 120, status: 'done', step: 3, steps: ['Requested', 'Approved', 'Seats live'], approval: 'auto' },
    { id: 'PRV-4397', clientId: id('Port of Carmel'), kind: 'Data plane', detail: 'Terminal edge agent v1.9.4 rollout to 3 quays (store-and-forward)', requestedBy: 'Inbal Sasson', ageHours: 140, status: 'in-progress', step: 2, steps: ['Requested', 'Change window', 'Rollout', 'Heartbeat'], approval: 'partner admin' },
    { id: 'PRV-4390', clientId: id('Orbis'), kind: 'Add module', detail: 'HexaCustody for design files (2 tenants)', requestedBy: 'Boaz Shalev', ageHours: 210, status: 'done', step: 4, steps: ['Requested', 'Commercials', 'Entitlement', 'Agents', 'Live'], approval: 'HexaShield' },
    { id: 'PRV-4384', clientId: id('Sharon Water'), kind: 'Offboard module', detail: 'Retire legacy log forwarding after cutover', requestedBy: 'Roi Elbaz', ageHours: 260, status: 'done', step: 2, steps: ['Requested', 'Data exported', 'Removed'], approval: 'partner admin' },
  ];
}

function deals(): Deal[] {
  return [
    { id: 'DR-3158', opportunity: 'Galil Dairies: Managed SOC', endClient: 'Galil Dairies Ltd', sector: 'Food manufacturing', modules: ['soc', 'comply'], tier: 'Professional', valueUsd: 214000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 22, protectedDays: 68, owner: 'Oren Tzur', se: 'Nadia Kerr', competitor: 'Incumbent MSSP (log forwarding only)', closeQuarter: 'Q4 2026', kind: 'new logo' },
    { id: 'DR-3157', opportunity: 'Arbel: Compliance as a service', endClient: 'Arbel Insurance Group', sector: 'Insurance', existingClientId: 'arbel', modules: ['comply'], tier: 'Professional', valueUsd: 66000, stage: 'Qualifying', reg: 'pending', submittedDaysAgo: 1, protectedDays: null, owner: 'Lina Zaher', competitor: 'Big Four advisory', closeQuarter: 'Q4 2026', deskHoursLeft: 30, kind: 'upsell' },
    { id: 'DR-3156', opportunity: 'Negev Tech: MDR + exposure after PoV', endClient: 'Negev Institute of Technology', sector: 'Higher education', existingClientId: 'negev-tech', modules: ['soc', 'comply', 'int'], tier: 'Professional', valueUsd: 238000, stage: 'Negotiation', reg: 'approved', submittedDaysAgo: 47, protectedDays: 43, owner: 'Boaz Shalev', se: 'Nadia Kerr', competitor: 'In-house SOC build', closeQuarter: 'Q4 2026', kind: 'upsell' },
    { id: 'DR-3154', opportunity: 'Carmit Insurance Agency: Penetration testing', endClient: 'Carmit Insurance Agency', sector: 'Insurance', modules: ['strike'], tier: 'Essentials', valueUsd: 48000, stage: 'Proposal', reg: 'expiring', submittedDaysAgo: 81, protectedDays: 9, owner: 'Lina Zaher', competitor: 'Boutique penetration tester', closeQuarter: 'Q4 2026', kind: 'new logo', note: 'Renew before expiry or the opportunity opens up to other partners.' },
    { id: 'DR-3152', opportunity: 'Lev HaGalil Medical Centre: Medical-device OT visibility', endClient: 'Lev HaGalil Medical Centre', sector: 'Healthcare', modules: ['ot', 'soc'], tier: 'Enterprise / CNI', valueUsd: 412000, stage: 'Discovery', reg: 'pending', submittedDaysAgo: 2, protectedDays: null, owner: 'Lina Zaher', competitor: 'Medical IoT specialist', closeQuarter: 'Q2 2027', deskHoursLeft: 6, conflict: 'Possible overlap: HexaShield direct has an open lead at Lev HaGalil (public-health tender). Deal desk is reviewing.', kind: 'new logo' },
    { id: 'DR-3149', opportunity: 'Bank Tavor: threat-led red team', endClient: 'Bank Tavor', sector: 'Banking', existingClientId: 'bank-tavor', modules: ['strike'], tier: 'Enterprise / CNI', valueUsd: 172000, stage: 'Negotiation', reg: 'approved', submittedDaysAgo: 35, protectedDays: 55, owner: 'Lina Zaher', se: 'Nadia Kerr', competitor: 'Specialist red-team firm', closeQuarter: 'Q4 2026', kind: 'upsell' },
    { id: 'DR-3147', opportunity: 'Shefa: Renewal + purple teaming', endClient: 'Shefa Retail Chain', sector: 'Retail', existingClientId: 'shefa', modules: ['soc', 'strike'], tier: 'Professional', valueUsd: 286000, stage: 'Negotiation', reg: 'approved', submittedDaysAgo: 30, protectedDays: 60, owner: 'Lina Zaher', se: 'Nadia Kerr', competitor: 'Retailer in-house SOC build', closeQuarter: 'Q4 2026', kind: 'renewal', note: 'Renewal at risk: client wants SLA credits for the September P1.' },
    { id: 'DR-3145', opportunity: 'Port of Carmel: private-5G OT monitoring expansion', endClient: 'Port of Carmel Logistics', sector: 'Ports & logistics', existingClientId: 'port-of-carmel', modules: ['ot', 'soc'], tier: 'Enterprise / CNI', valueUsd: 420000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 18, protectedDays: 72, owner: 'Boaz Shalev', se: 'Nadia Kerr', competitor: 'OT-native vendor', closeQuarter: 'Q1 2027', kind: 'upsell' },
    { id: 'DR-3143', opportunity: 'Sharon Water: HexaCustody for SCADA configuration', endClient: 'Sharon Regional Water Authority', sector: 'Water utility', existingClientId: 'sharon-water', modules: ['custody'], tier: 'Professional', valueUsd: 98000, stage: 'Qualifying', reg: 'renewal', submittedDaysAgo: 88, protectedDays: 2, owner: 'Boaz Shalev', competitor: 'None identified', closeQuarter: 'Q1 2027', deskHoursLeft: 14, kind: 'upsell' },
    { id: 'DR-3140', opportunity: 'Emek Health: AI governance (clinical scribe)', endClient: 'Emek Health Services', sector: 'Healthcare', existingClientId: 'emek-health', modules: ['comply'], tier: 'Professional', valueUsd: 96000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 26, protectedDays: 64, owner: 'Lina Zaher', competitor: 'GRC platform vendor', closeQuarter: 'Q4 2026', kind: 'upsell' },
    { id: 'DR-3138', opportunity: 'Yarden Energy: OT monitoring', endClient: 'Yarden Energy', sector: 'Energy', modules: ['ot', 'soc'], tier: 'Enterprise / CNI', valueUsd: 356000, stage: 'Discovery', reg: 'rejected', submittedDaysAgo: 12, protectedDays: null, owner: 'Boaz Shalev', competitor: 'OT-native vendor', closeQuarter: 'Q2 2027', conflict: 'Registered by another partner (protected until 14 Dec 2026). You can co-sell with HexaShield approval.', kind: 'new logo' },
    { id: 'DR-3135', opportunity: 'Paylo: Threat hunting + ASM', endClient: 'Paylo Fintech', sector: 'Fintech', existingClientId: 'paylo', modules: ['soc', 'strike'], tier: 'Professional', valueUsd: 74000, stage: 'Closed won', reg: 'approved', submittedDaysAgo: 96, protectedDays: -6, owner: 'Lina Zaher', competitor: 'None identified', closeQuarter: 'Q3 2026', kind: 'upsell' },
    { id: 'DR-3131', opportunity: 'Port of Carmel: OT penetration test (quay cranes)', endClient: 'Port of Carmel Logistics', sector: 'Ports & logistics', existingClientId: 'port-of-carmel', modules: ['ot'], tier: 'Enterprise / CNI', valueUsd: 92000, stage: 'Closed won', reg: 'approved', submittedDaysAgo: 120, protectedDays: -30, owner: 'Boaz Shalev', competitor: 'Specialist ICS tester', closeQuarter: 'Q3 2026', kind: 'upsell' },
    { id: 'DR-3127', opportunity: 'Municipality of Tel Shahar: MDR', endClient: 'Municipality of Tel Shahar', sector: 'Local government', modules: ['soc'], tier: 'Essentials', valueUsd: 88000, stage: 'Closed lost', reg: 'expired', submittedDaysAgo: 140, protectedDays: -50, owner: 'Oren Tzur', competitor: 'Framework incumbent', closeQuarter: 'Q3 2026', kind: 'new logo', note: 'Lost on price under the municipal framework tender.' },
    { id: 'DR-3124', opportunity: 'Orbis: Custody for design files', endClient: 'Orbis Semiconductors', sector: 'Hi-tech manufacturing', existingClientId: 'orbis', modules: ['custody', 'comply'], tier: 'Professional', valueUsd: 58000, stage: 'Closed won', reg: 'approved', submittedDaysAgo: 150, protectedDays: -60, owner: 'Boaz Shalev', competitor: 'DRM vendor', closeQuarter: 'Q2 2026', kind: 'upsell' },
    { id: 'DR-3120', opportunity: 'Vantic: Executive exposure', endClient: 'Vantic Analytics', sector: 'Software (SaaS scale-up)', existingClientId: 'vantic', modules: ['int'], tier: 'Essentials', valueUsd: 21000, stage: 'Proposal', reg: 'approved', submittedDaysAgo: 40, protectedDays: 50, owner: 'Oren Tzur', competitor: 'Identity-protection vendor', closeQuarter: 'Q4 2026', kind: 'upsell' },
  ];
}

const protectedNames: { match: string; result: 'other-partner' | 'direct'; detail: string }[] = [
  { match: 'yarden', result: 'other-partner', detail: 'Registered by another partner, protected until 14 Dec 2026.' },
  { match: 'lev hagalil', result: 'direct', detail: 'HexaShield direct has an open lead under a public-health tender.' },
  { match: 'atlas', result: 'other-partner', detail: 'Registered by another partner, protected until 2 Feb 2027.' },
  { match: 'meridian', result: 'direct', detail: 'HexaShield named strategic account: co-sell only.' },
];

function quotes(): SavedQuote[] {
  return [
    { id: 'Q-4391', client: 'Port of Carmel Logistics', dealId: 'DR-3145', tier: 'Enterprise / CNI', services: 6, sellUsd: 418400, marginPct: 29.1, status: 'Sent', daysAgo: 3, owner: 'Boaz Shalev' },
    { id: 'Q-4388', client: 'Galil Dairies Ltd', dealId: 'DR-3158', tier: 'Professional', services: 4, sellUsd: 211900, marginPct: 30.4, status: 'Sent', daysAgo: 6, owner: 'Oren Tzur' },
    { id: 'Q-4384', client: 'Shefa Retail Chain', dealId: 'DR-3147', tier: 'Professional', services: 7, sellUsd: 282100, marginPct: 26.8, status: 'Draft', daysAgo: 8, owner: 'Lina Zaher' },
    { id: 'Q-4379', client: 'Negev Institute of Technology', dealId: 'DR-3156', tier: 'Professional', services: 4, sellUsd: 236500, marginPct: 31.2, status: 'Sent', daysAgo: 12, owner: 'Boaz Shalev' },
    { id: 'Q-4371', client: 'Bank Tavor', dealId: 'DR-3149', tier: 'Enterprise / CNI', services: 1, sellUsd: 171200, marginPct: 22.6, status: 'Sent', daysAgo: 19, owner: 'Lina Zaher' },
    { id: 'Q-4366', client: 'Paylo Fintech', dealId: 'DR-3135', tier: 'Professional', services: 2, sellUsd: 73800, marginPct: 24.9, status: 'Accepted', daysAgo: 41, owner: 'Lina Zaher' },
    { id: 'Q-4352', client: 'Municipality of Tel Shahar', dealId: 'DR-3127', tier: 'Essentials', services: 1, sellUsd: 86000, marginPct: 18.4, status: 'Expired', daysAgo: 92, owner: 'Oren Tzur' },
  ];
}

function campaigns(): Campaign[] {
  return [
    { id: 'CMP-218', name: 'Amendment 13 in 90 days: privacy officer and breach readiness', type: 'Webinar', sector: 'Cross-sector', status: 'Completed', budget: 9000, mdf: 4500, leads: 232, mqls: 44, pipelineUsd: 540000, wonUsd: 172000, startDays: -62, owner: 'Hadas Weiss' },
    { id: 'CMP-221', name: 'Ports & logistics OT roundtable, Haifa', type: 'Roundtable', sector: 'Ports & logistics', status: 'Completed', budget: 16000, mdf: 8000, leads: 34, mqls: 17, pipelineUsd: 780000, wonUsd: 92000, startDays: -45, owner: 'Hadas Weiss' },
    { id: 'CMP-224', name: 'Clinical device visibility for hospital networks', type: 'Email nurture', sector: 'Healthcare', status: 'Live', budget: 6000, mdf: 3000, leads: 148, mqls: 24, pipelineUsd: 412000, wonUsd: 0, startDays: -20, owner: 'Hadas Weiss' },
    { id: 'CMP-226', name: 'Tel Aviv cyber conference stand (shared with HexaShield)', type: 'Event', sector: 'Cross-sector', status: 'Completed', budget: 46000, mdf: 23000, leads: 540, mqls: 92, pipelineUsd: 1380000, wonUsd: 214000, startDays: -140, owner: 'Hadas Weiss' },
    { id: 'CMP-229', name: 'Directive 361 evidence without the spreadsheets', type: 'ABM', sector: 'Banking', status: 'Live', budget: 18000, mdf: 9000, leads: 22, mqls: 13, pipelineUsd: 690000, wonUsd: 0, startDays: -12, owner: 'Hadas Weiss' },
    { id: 'CMP-231', name: 'Account takeover and SIM-swap fraud: what retailers and fintechs can do', type: 'Paid social', sector: 'Retail & fintech', status: 'Live', budget: 7500, mdf: 3750, leads: 96, mqls: 12, pipelineUsd: 180000, wonUsd: 0, startDays: -8, owner: 'Hadas Weiss' },
    { id: 'CMP-234', name: "Water & energy OT breakfast, Be'er Sheva", type: 'Roundtable', sector: 'Utilities', status: 'Planned', budget: 11000, mdf: 5500, leads: 0, mqls: 0, pipelineUsd: 0, wonUsd: 0, startDays: 24, owner: 'Hadas Weiss' },
    { id: 'CMP-237', name: 'Agentic SOC, explained for CISOs (Hebrew session)', type: 'Webinar', sector: 'Cross-sector', status: 'Planned', budget: 5000, mdf: 2500, leads: 0, mqls: 0, pipelineUsd: 0, wonUsd: 0, startDays: 38, owner: 'Hadas Weiss' },
  ];
}

function mdf(): MdfClaim[] {
  return [
    { id: 'MDF-1841', campaignId: 'CMP-226', amount: 23000, status: 'Paid', daysAgo: 96, proof: ['Stand invoice', 'Lead list (540)', 'Photos'] },
    { id: 'MDF-1852', campaignId: 'CMP-218', amount: 4500, status: 'Paid', daysAgo: 48, proof: ['Platform invoice', 'Attendee report'] },
    { id: 'MDF-1857', campaignId: 'CMP-221', amount: 8000, status: 'Approved', daysAgo: 30, proof: ['Venue invoice', 'Attendee list', 'Agenda'] },
    { id: 'MDF-1863', campaignId: 'CMP-224', amount: 3000, status: 'Submitted', daysAgo: 6, proof: ['Agency invoice'] },
    { id: 'MDF-1866', campaignId: 'CMP-229', amount: 9000, status: 'Needs proof', daysAgo: 4, proof: ['Agency invoice'] },
    { id: 'MDF-1870', campaignId: 'CMP-231', amount: 3750, status: 'Submitted', daysAgo: 2, proof: ['LinkedIn invoice', 'Creative'] },
    { id: 'MDF-1872', campaignId: 'CMP-234', amount: 5500, status: 'Pre-approved', daysAgo: 1, proof: ['Plan & budget'] },
    { id: 'MDF-1873', campaignId: 'CMP-237', amount: 2500, status: 'Pre-approved', daysAgo: 1, proof: ['Plan & budget'] },
  ];
}

function tickets(id: (short: string) => string | undefined): Ticket[] {
  return [
    { id: 'PS-8781', title: 'Shefa: P1 SLA credit calculation for the September incident', clientId: id('Shefa'), priority: 'P2', category: 'Billing', status: 'With HexaShield', ageHours: 30, slaHours: 24, owner: 'Sivan Ohayon', assignee: 'HexaShield Billing', updates: [{ who: 'Sivan Ohayon', text: 'Client is asking for 10% credit; our calc says 4%. Need the HexaShield view before the renewal call on Thursday.', hoursAgo: 30 }, { who: 'HexaShield Billing', text: 'Reviewing against the MDR SLA schedule; response by end of day.', hoursAgo: 6 }] },
    { id: 'PS-8779', title: 'Hula Valley: raise Essentials integration cap or upgrade path', clientId: id('Hula Valley'), priority: 'P3', category: 'Deal desk', status: 'Awaiting partner', ageHours: 52, slaHours: 48, owner: 'Majd Khalil', assignee: 'Deal desk', updates: [{ who: 'Deal desk', text: 'Essentials is capped at 5. Options: add-on integration (US$2,400/yr) or Professional with a 12% first-year step-down. Which should we quote?', hoursAgo: 20 }] },
    { id: 'PS-8776', title: 'Kinneret Telecom: Limassol PoP tenant stuck at data plane step', clientId: id('Kinneret'), priority: 'P2', category: 'Platform', status: 'With HexaShield', ageHours: 18, slaHours: 8, owner: 'Roi Elbaz', assignee: 'Nadia Kerr', updates: [{ who: 'Roi Elbaz', text: 'Edge agent registers then drops heartbeat after 4 min. Logs attached.', hoursAgo: 18 }, { who: 'Nadia Kerr', text: 'Proxy is stripping the mTLS header. Workaround sent; fix in agent 1.9.5.', hoursAgo: 3 }] },
    { id: 'PS-8772', title: 'White-label: custom domain TLS renewal for cyber.kinneret-telecom.co.il', priority: 'P3', category: 'White label', status: 'Resolved', ageHours: 70, slaHours: 48, owner: 'Roi Elbaz', assignee: 'HexaShield Platform', updates: [{ who: 'HexaShield Platform', text: 'Certificate renewed and auto-renew re-enabled after CAA record fix.', hoursAgo: 40 }] },
    { id: 'PS-8770', title: 'Bank Tavor: Veeam connector field drift since v12.2', clientId: id('Bank Tavor'), priority: 'P3', category: 'Connector', status: 'With HexaShield', ageHours: 96, slaHours: 72, owner: 'Asaf Dror', assignee: 'Connector team', updates: [{ who: 'Connector team', text: 'Mapping update scheduled in connector release 2026.11.2.', hoursAgo: 12 }] },
    { id: 'PS-8766', title: 'Shefa: escalation on missed P1 acknowledgement', clientId: id('Shefa'), priority: 'P1', category: 'Service delivery', status: 'Open', ageHours: 3, slaHours: 4, owner: 'Oren Tzur', assignee: 'HexaShield Service Delivery', updates: [{ who: 'Oren Tzur', text: 'Client exec wants a joint RCA before the renewal decision. Need a HexaShield SDM on the call.', hoursAgo: 3 }] },
    { id: 'PS-8761', title: 'Deal registration DR-3152 overlap with HexaShield direct', priority: 'P3', category: 'Deal desk', status: 'With HexaShield', ageHours: 40, slaHours: 48, owner: 'Lina Zaher', assignee: 'Deal desk', updates: [{ who: 'Deal desk', text: 'Checking with the direct public-sector team; decision inside the 2-business-day window.', hoursAgo: 10 }] },
    { id: 'PS-8755', title: 'Emek Health: copilot token usage spike in October', clientId: id('Emek Health'), priority: 'P4', category: 'Billing', status: 'Resolved', ageHours: 160, slaHours: 120, owner: 'Majd Khalil', assignee: 'HexaShield Billing', updates: [{ who: 'HexaShield Billing', text: 'Spike traced to a scheduled board-pack generation loop; tokens credited.', hoursAgo: 110 }] },
    { id: 'PS-8749', title: 'Request: Hebrew translation of the OT datasheet', priority: 'P4', category: 'Enablement', status: 'Resolved', ageHours: 220, slaHours: 240, owner: 'Hadas Weiss', assignee: 'Partner marketing', updates: [{ who: 'Partner marketing', text: 'Published in the Content Library.', hoursAgo: 90 }] },
    { id: 'PS-8744', title: 'Negev Tech: PoV success criteria sign-off template', clientId: id('Negev Tech'), priority: 'P3', category: 'Deal desk', status: 'Resolved', ageHours: 260, slaHours: 48, owner: 'Boaz Shalev', assignee: 'Nadia Kerr', updates: [{ who: 'Nadia Kerr', text: 'Template shared; added campus-network criteria.', hoursAgo: 240 }] },
  ];
}

/** Extra library items HexaShield publishes for operator partners (appended to the shared library). */
const content: Omit<ContentItem, 'id' | 'downloads'>[] = [
  { title: 'Telecommunications: from signalling to site power', type: 'Sector one-pager', product: 'HexaView', sector: 'Telecommunications', summary: 'Mobile core, fibre, data centres and cell-site plant in one view.', bullets: ['ISO 27011, GSMA and licence-obligation evidence', 'Signalling, fraud and DDoS tools read side by side', 'Network and site infrastructure treated as OT (read-only)'], format: 'PDF · A4', pages: 1, updatedDays: 5, cobrand: true },
  { title: 'Selling managed security alongside connectivity', type: 'Deck', product: 'Partner', summary: 'For operator MSSP arms: bundle HexaView with business connectivity.', bullets: ['One invoice: connectivity, cloud and security', 'Customer zero: run your own estate on the same platform', 'Packaging by tier for small, mid-size and regulated customers'], format: 'PPTX · 16 slides', pages: 16, updatedDays: 12, cobrand: true },
];

export const KT = {
  staff, small, prov, deals, protectedNames, quotes, campaigns, mdf, tickets, content,
  /** Invoice status rules by client short name. */
  disputed: 'Shefa', overdue: ['Hula Valley', 'Vantic'], onboardingAhead: 'Givat Alon',
};
