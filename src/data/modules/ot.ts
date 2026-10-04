// HexaOT data: sites, assets by Purdue level, zone/conduit flows, alerts,
// vulnerabilities and guard-railed OT test engagements. Everything is derived
// from the customer profile and anchored to headlines(c, tenantId).ot.
import type { CustomerProfile, Severity } from '../types';
import { rng } from '../../lib/rng';
import { headlines } from '../core';
import { ICS_CVES, CVES, type CveRef } from '../reference';
import { forCustomer, type CustomerMap } from '../customerMap';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Split an integer total across weights (largest remainder), so parts sum exactly. */
export function distribute(total: number, weights: number[]): number[] {
  const w = weights.reduce((s, x) => s + x, 0) || 1;
  const raw = weights.map((x) => (x / w) * total);
  const out = raw.map(Math.floor);
  let rem = total - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0 && order.length; k = (k + 1) % order.length, rem--) out[order[k][1]]++;
  return out;
}

/* ------------------------------------------------------------------ */
/* Purdue model                                                        */
/* ------------------------------------------------------------------ */

export type PurdueLevel = 'L4' | 'L3.5' | 'L3' | 'L2' | 'L1' | 'L0';
export const PURDUE: { id: PurdueLevel; label: string; name: string; desc: string }[] = [
  { id: 'L4', label: 'Level 4–5', name: 'Enterprise & business', desc: 'IT systems seen talking across the OT boundary' },
  { id: 'L3.5', label: 'Level 3.5', name: 'OT DMZ', desc: 'Jump hosts, brokers, patch relays, collectors' },
  { id: 'L3', label: 'Level 3', name: 'Site operations', desc: 'Historians, engineering workstations, orchestration' },
  { id: 'L2', label: 'Level 2', name: 'Supervisory control', desc: 'HMIs, SCADA, supervisory gateways' },
  { id: 'L1', label: 'Level 1', name: 'Basic control', desc: 'PLCs, RTUs, drives controllers, safety systems' },
  { id: 'L0', label: 'Level 0', name: 'Physical process', desc: 'Sensors, actuators, field devices' },
];
export const LEVEL_HEX: Record<PurdueLevel, string> = { L4: '#8a9bc0', 'L3.5': '#68b1ff', L3: '#a07cfb', L2: '#2dd4bf', L1: '#f5a83d', L0: '#ef6aae' };

/* ------------------------------------------------------------------ */
/* Sites                                                               */
/* ------------------------------------------------------------------ */

export type SiteKind =
  | 'terminal' | 'vessel' | 'dc' | 'atm' | 'office' | 'broadcast' | 'stage' | 'post' | 'hospital' | 'imaging' | 'lab' | 'plant' | 'cellplant'
  | 'printplant' | 'shop' | 'range' | 'api' | 'biologics' | 'aseptic' | 'fillfinish' | 'packaging' | 'specialist' | 'daysurg' | 'labimg'
  | 'park' | 'waterpark' | 'resort' | 'liveevents';
export interface OtSite {
  id: string;
  name: string;
  kind: SiteKind;
  kindLabel: string;
  tenantId: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  weight: number;
  source: string;
  sourceConnector: string;
  prefix: string;
  /** Air-gapped site: no live link; data arrives by signed bundle every `bundleHours`. */
  airGapped?: boolean;
  bundleHours?: number;
}

const SITES: CustomerMap<OtSite[]> = {
  maritime: [
    { id: 'rtm', name: 'Maasvlakte Container Terminal', kind: 'terminal', kindLabel: 'Automated terminal · STS, ASC, AGV', tenantId: 'rtm', city: 'Rotterdam', country: 'NL', lat: 51.96, lon: 4.03, weight: 30, source: 'Dragos Platform', sourceConnector: 'c-dragos', prefix: 'RTM' },
    { id: 'ant', name: 'Scheldt Deepwater Terminal', kind: 'terminal', kindLabel: 'Terminal · STS, RTG, reefer', tenantId: 'ant', city: 'Antwerp', country: 'BE', lat: 51.28, lon: 4.3, weight: 20, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'ANT' },
    { id: 'pkl', name: 'Straits Gateway Terminal', kind: 'terminal', kindLabel: 'Terminal · STS, RTG, gate OCR', tenantId: 'pkl', city: 'Port Klang', country: 'MY', lat: 3.0, lon: 101.39, weight: 16, source: 'HexaOT sensors', sourceConnector: 'c-hexaot-pkl', prefix: 'PKL' },
    { id: 'sts', name: 'Atlântico Terminal Santos', kind: 'terminal', kindLabel: 'Terminal · STS, RTG, substations', tenantId: 'sts', city: 'Santos', country: 'BR', lat: -23.96, lon: -46.3, weight: 13, source: 'HexaOT sensors', sourceConnector: 'c-hexaot-sts', prefix: 'STS' },
    { id: 'fleet', name: 'Halcyon Line Fleet (22 vessels)', kind: 'vessel', kindLabel: 'Bridge, engine, ballast, cargo · VSAT/LEO', tenantId: 'fleet', city: 'At sea', country: 'Global', lat: 36.0, lon: 14.5, weight: 21, source: 'HexaOT sensors (vessel edge)', sourceConnector: 'c-hexaot-fleet', prefix: 'HCY' },
  ],
  finserv: [
    { id: 'slough', name: 'Slough DC1', kind: 'dc', kindLabel: 'Tier III data centre · primary', tenantId: 'ukbank', city: 'Slough', country: 'GB', lat: 51.51, lon: -0.59, weight: 26, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'SLO' },
    { id: 'basildon', name: 'Basildon DC2', kind: 'dc', kindLabel: 'Tier III data centre · secondary', tenantId: 'ukbank', city: 'Basildon', country: 'GB', lat: 51.57, lon: 0.46, weight: 23, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'BAS' },
    { id: 'ld8', name: 'Equinix LD8 cage', kind: 'dc', kindLabel: 'Colocation cage · trading', tenantId: 'ukbank', city: 'London', country: 'GB', lat: 51.51, lon: -0.01, weight: 7, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'LD8' },
    { id: 'ny5', name: 'Equinix NY5 cage', kind: 'dc', kindLabel: 'Colocation cage · Markets', tenantId: 'markets', city: 'Secaucus', country: 'US', lat: 40.79, lon: -74.06, weight: 6, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'NY5' },
    { id: 'lux', name: 'Luxembourg DC', kind: 'dc', kindLabel: 'Data centre · EU entity', tenantId: 'eu', city: 'Betzdorf', country: 'LU', lat: 49.69, lon: 6.35, weight: 7, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'LUX' },
    { id: 'mcr', name: 'Manchester payments ops', kind: 'office', kindLabel: 'Ops centre · HSM rooms', tenantId: 'pay', city: 'Manchester', country: 'GB', lat: 53.48, lon: -2.24, weight: 6, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'MCR' },
    { id: 'cw', name: 'Canary Wharf HQ', kind: 'office', kindLabel: 'HQ building · trading floor', tenantId: 'ukbank', city: 'London', country: 'GB', lat: 51.5, lon: -0.02, weight: 8, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'CWF' },
    { id: 'atm', name: 'UK ATM estate', kind: 'atm', kindLabel: 'NCR SelfServ fleet · 312 branches', tenantId: 'ukbank', city: 'UK-wide', country: 'GB', lat: 52.6, lon: -1.6, weight: 13, source: 'CrowdStrike Falcon (ATM sensor)', sourceConnector: 'c-crowdstrike', prefix: 'ATM' },
    { id: 'sg', name: 'Singapore office', kind: 'office', kindLabel: 'Private banking office', tenantId: 'wealth', city: 'Singapore', country: 'SG', lat: 1.28, lon: 103.85, weight: 4, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'SGP' },
  ],
  media: [
    { id: 'atl', name: 'Atlanta broadcast centre', kind: 'broadcast', kindLabel: 'Live & sports · ST 2110 plant', tenantId: 'live', city: 'Atlanta', country: 'US', lat: 33.75, lon: -84.39, weight: 72, source: 'HexaOT sensors (broadcast)', sourceConnector: 'c-hexaot', prefix: 'ATL' },
    { id: 'burbank', name: 'Burbank stages', kind: 'stage', kindLabel: 'Sound stages · lighting & BMS', tenantId: 'live', city: 'Burbank', country: 'US', lat: 34.18, lon: -118.31, weight: 17, source: 'HexaOT sensors (broadcast)', sourceConnector: 'c-hexaot', prefix: 'BUR' },
    { id: 'soho', name: 'Soho machine room', kind: 'post', kindLabel: 'Post facility · power & cooling', tenantId: 'live', city: 'London', country: 'GB', lat: 51.51, lon: -0.13, weight: 11, source: 'HexaOT sensors (broadcast)', sourceConnector: 'c-hexaot', prefix: 'SOH' },
  ],
  healthcare: [
    { id: 'mrmc', name: 'Mercy Ridge Medical Center', kind: 'hospital', kindLabel: 'Level I trauma · 640 beds · ICU, OR, ED', tenantId: 'mrmc', city: 'Columbus', country: 'US', lat: 39.96, lon: -83.0, weight: 38, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'MRMC' },
    { id: 'kids', name: "Mercy Ridge Children's Hospital", kind: 'hospital', kindLabel: 'Paediatric · NICU, PICU · 210 beds', tenantId: 'kids', city: 'Columbus', country: 'US', lat: 39.95, lon: -82.98, weight: 19, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'KIDS' },
    { id: 'zan', name: 'Zanesville Community Hospital', kind: 'hospital', kindLabel: 'Community · 160 beds · ED, maternity', tenantId: 'community', city: 'Zanesville', country: 'US', lat: 39.94, lon: -82.01, weight: 9, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'ZAN' },
    { id: 'mar', name: 'Marion Community Hospital', kind: 'hospital', kindLabel: 'Community · 120 beds · ED, dialysis', tenantId: 'community', city: 'Marion', country: 'US', lat: 40.59, lon: -83.13, weight: 7, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'MAR' },
    { id: 'chi', name: 'Chillicothe Community Hospital', kind: 'hospital', kindLabel: 'Community · 110 beds · ED, surgery', tenantId: 'community', city: 'Chillicothe', country: 'US', lat: 39.33, lon: -82.98, weight: 7, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'CHI' },
    { id: 'oic', name: 'Outpatient Imaging & Cancer Center', kind: 'imaging', kindLabel: 'CT, MRI, PET-CT, linear accelerators', tenantId: 'mrmc', city: 'Dublin, OH', country: 'US', lat: 40.1, lon: -83.11, weight: 11, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'OIC' },
    { id: 'clp', name: 'Central Lab & Pharmacy Services', kind: 'lab', kindLabel: 'Core lab automation · central pharmacy robotics', tenantId: 'mrmc', city: 'Columbus', country: 'US', lat: 39.98, lon: -82.95, weight: 9, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'CLP' },
  ],
  automotive: [
    { id: 'ing', name: 'Ingolstadt press & body shop', kind: 'plant', kindLabel: 'Press lines · 1,100 body-shop robots', tenantId: 'ingolstadt', city: 'Ingolstadt', country: 'DE', lat: 48.77, lon: 11.43, weight: 27, source: 'Armis Centrix', sourceConnector: 'c-armis', prefix: 'ING' },
    { id: 'inp', name: 'Ingolstadt paint & final assembly', kind: 'plant', kindLabel: 'Paint shop, assembly, end-of-line test', tenantId: 'ingolstadt', city: 'Ingolstadt', country: 'DE', lat: 48.78, lon: 11.45, weight: 19, source: 'Armis Centrix', sourceConnector: 'c-armis', prefix: 'INP' },
    { id: 'gyr', name: 'Győr e-drive & powertrain', kind: 'plant', kindLabel: 'E-motor, inverter and gearbox lines', tenantId: 'gyor', city: 'Győr', country: 'HU', lat: 47.69, lon: 17.63, weight: 20, source: 'Armis Centrix', sourceConnector: 'c-armis', prefix: 'GYR' },
    { id: 'szg', name: 'Salzgitter cell plant (air-gapped)', kind: 'cellplant', kindLabel: 'Electrode, cell assembly, formation & ageing', tenantId: 'battery', city: 'Salzgitter', country: 'DE', lat: 52.15, lon: 10.33, weight: 14, source: 'HexaOT sensors (offline bundle)', sourceConnector: 'c-hexaot', prefix: 'SZG', airGapped: true, bundleHours: 6 },
    { id: 'pue', name: 'Puebla final assembly', kind: 'plant', kindLabel: 'Body, paint, assembly · AGV intralogistics', tenantId: 'puebla', city: 'Puebla', country: 'MX', lat: 19.04, lon: -98.21, weight: 20, source: 'Armis Centrix', sourceConnector: 'c-armis', prefix: 'PUE' },
  ],
  // Kingsbridge Mutual: facilities only, all in the Group tenant.
  insurance: [
    { id: 'wdc1', name: 'Windsor DC1', kind: 'dc', kindLabel: 'Tier III primary data centre · z/OS, Guidewire, Splunk', tenantId: 'group', city: 'Windsor', country: 'US', lat: 41.85, lon: -72.64, weight: 44, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'WDC' },
    { id: 'phx2', name: 'Phoenix DC2 (colocation)', kind: 'dc', kindLabel: 'Colocation suite · recovery site', tenantId: 'group', city: 'Phoenix', country: 'US', lat: 33.45, lon: -112.07, weight: 20, source: 'Schneider EcoStruxure BMS', sourceConnector: 'c-facilities', prefix: 'PHX' },
    { id: 'hpm', name: 'Hartford print & mail plant', kind: 'printplant', kindLabel: 'Policy, billing & claims mail · inserters, production print', tenantId: 'group', city: 'Hartford', country: 'US', lat: 41.76, lon: -72.69, weight: 36, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'HPM' },
  ],
  // Sentry Peak: Building 3 shop floor (Huntsville) and the Tucson test range.
  defence: [
    { id: 'b3', name: 'Building 3 machine shop', kind: 'shop', kindLabel: 'Precision machining · CNC, CMM, DNC, heat treat', tenantId: 'manufacturing', city: 'Huntsville', country: 'US', lat: 34.73, lon: -86.59, weight: 66, source: 'Armis Centrix for OT/IoT', sourceConnector: 'c-armis', prefix: 'B3' },
    { id: 'tus', name: 'Tucson test range', kind: 'range', kindLabel: 'Avionics ATE, environmental test, range telemetry', tenantId: 'tucson', city: 'Tucson', country: 'US', lat: 32.22, lon: -110.97, weight: 34, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'TUS' },
  ],
  // Rhenara: Valais (Sierre) API, biologics and the air-gapped AF-2 line; Cork (Ringaskiddy) fill-finish and packaging.
  pharma: [
    { id: 'vls-api', name: 'Valais API plant', kind: 'api', kindLabel: 'Small-molecule synthesis · PCS 7 DCS, reactors, dryers', tenantId: 'valais', city: 'Sierre', country: 'CH', lat: 46.29, lon: 7.53, weight: 22, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'VLS' },
    { id: 'vls-bio', name: 'Valais biologics plant', kind: 'biologics', kindLabel: 'DeltaV DCS · 2,000 L single-use bioreactors, chromatography', tenantId: 'valais', city: 'Sierre', country: 'CH', lat: 46.3, lon: 7.55, weight: 30, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'VLB' },
    { id: 'vls-af2', name: 'Valais aseptic line AF-2 (air-gapped)', kind: 'aseptic', kindLabel: 'Annex 1 grade A/B filling isolator & lyophiliser', tenantId: 'valais', city: 'Sierre', country: 'CH', lat: 46.28, lon: 7.52, weight: 9, source: 'HexaOT sensors (offline bundle)', sourceConnector: 'c-hexaot', prefix: 'VAF', airGapped: true, bundleHours: 8 },
    { id: 'crk-ff', name: 'Cork fill-finish plant', kind: 'fillfinish', kindLabel: 'Aseptic filling isolator, lyophilisers, cleanroom EMS', tenantId: 'cork', city: 'Ringaskiddy', country: 'IE', lat: 51.83, lon: -8.32, weight: 24, source: 'Dragos Platform', sourceConnector: 'c-dragos', prefix: 'CRK' },
    { id: 'crk-pk', name: 'Cork packaging & serialisation', kind: 'packaging', kindLabel: 'EU FMD / DSCSA serialisation & aggregation lines', tenantId: 'cork', city: 'Ringaskiddy', country: 'IE', lat: 51.82, lon: -8.31, weight: 15, source: 'Dragos Platform', sourceConnector: 'c-dragos', prefix: 'CRP' },
  ],
  // Orchid Bay: medical devices are the OT, across four clinical campuses.
  sghospital: [
    { id: 'novena', name: 'Orchid Bay Hospital Novena', kind: 'hospital', kindLabel: 'Acute hospital · 420 beds · A&E, ICU, theatres', tenantId: 'obh', city: 'Novena', country: 'SG', lat: 1.32, lon: 103.84, weight: 58, source: 'Claroty xDome for Healthcare', sourceConnector: 'c-claroty', prefix: 'OBH' },
    { id: 'tanglin', name: 'Orchid Bay Specialist Centre Tanglin', kind: 'specialist', kindLabel: 'Oncology & cardiology · TrueBeam linacs, cath lab', tenantId: 'specialist', city: 'Tanglin', country: 'SG', lat: 1.305, lon: 103.82, weight: 16, source: 'Claroty xDome for Healthcare', sourceConnector: 'c-claroty', prefix: 'SPC' },
    { id: 'punggol', name: 'Orchid Bay Day Surgery Punggol', kind: 'daysurg', kindLabel: 'Day surgery · 8 theatres, endoscopy, recovery', tenantId: 'daysurg', city: 'Punggol', country: 'SG', lat: 1.405, lon: 103.9, weight: 11, source: 'Armis Centrix for Medical Device Security', sourceConnector: 'c-armis', prefix: 'DSC' },
    { id: 'sciencepark', name: 'Orchid Bay Lab & Imaging', kind: 'labimg', kindLabel: 'Core lab (Roche cobas), CT, MRI, PACS', tenantId: 'labimg', city: 'Science Park', country: 'SG', lat: 1.29, lon: 103.79, weight: 15, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'LAB' },
  ],
  // Starfall: theme-park OT in the Orlando and Osaka resorts only.
  studio: [
    { id: 'orl-park', name: 'Starfall Studios Park Orlando', kind: 'park', kindLabel: 'Coasters, dark rides, animatronic shows', tenantId: 'parks', city: 'Orlando', country: 'US', lat: 28.47, lon: -81.47, weight: 30, source: 'Dragos Platform', sourceConnector: 'c-dragos', prefix: 'ORS' },
    { id: 'orl-lagoon', name: 'Starfall Lagoon water park', kind: 'waterpark', kindLabel: 'Water rides · pump houses, filtration, wave pool', tenantId: 'parks', city: 'Orlando', country: 'US', lat: 28.46, lon: -81.46, weight: 12, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'ORL' },
    { id: 'orl-resort', name: 'Orlando resort hotels & back-of-house', kind: 'resort', kindLabel: 'Hotels, central plant, StarPass gates, fire & BMS', tenantId: 'parks', city: 'Orlando', country: 'US', lat: 28.475, lon: -81.465, weight: 17, source: 'Armis Centrix', sourceConnector: 'c-armis', prefix: 'ORH' },
    { id: 'orl-live', name: 'Orlando night-time spectacular', kind: 'liveevents', kindLabel: 'Lagoon show · ST 2110, media servers, pyrotechnics', tenantId: 'parks', city: 'Orlando', country: 'US', lat: 28.472, lon: -81.468, weight: 9, source: 'HexaOT sensors', sourceConnector: 'c-hexaot', prefix: 'ORE' },
    { id: 'osa-park', name: 'Starfall Park Osaka', kind: 'park', kindLabel: 'Coasters, dark rides, water ride, parade', tenantId: 'parksasia', city: 'Osaka', country: 'JP', lat: 34.67, lon: 135.43, weight: 22, source: 'Claroty xDome', sourceConnector: 'c-claroty', prefix: 'OSP' },
    { id: 'osa-resort', name: 'Osaka resort hotels & CityWalk', kind: 'resort', kindLabel: 'Hotels, retail walk, StarPass gates, BMS', tenantId: 'parksasia', city: 'Osaka', country: 'JP', lat: 34.665, lon: 135.435, weight: 10, source: 'Armis Centrix', sourceConnector: 'c-armis', prefix: 'OSH' },
  ],
};

/* ------------------------------------------------------------------ */
/* Asset types                                                         */
/* ------------------------------------------------------------------ */

export interface AssetType {
  name: string;
  level: PurdueLevel;
  kinds: SiteKind[];
  share: number;
  vendor: string;
  model: string;
  abbr: string;
  fw: string[]; // oldest .. newest
  protocols: string[];
  zone: string;
  /** Consequence if misused, 1 (nuisance) to 5 (safety / loss of operation). */
  consequence: number;
  consequenceText: string;
}

const TYPES: CustomerMap<AssetType[]> = {
  maritime: [
    { name: 'TOS interface server (Navis N4)', level: 'L4', kinds: ['terminal'], share: 1.2, vendor: 'Navis', model: 'N4 3.9 app node', abbr: 'TOS', fw: ['3.7', '3.8', '3.9'], protocols: ['OPC UA'], zone: 'Enterprise IT', consequence: 3, consequenceText: 'Berth and yard planning disrupted' },
    { name: 'OT jump host', level: 'L3.5', kinds: ['terminal'], share: 0.6, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['OPC UA'], zone: 'OT DMZ', consequence: 4, consequenceText: 'Gateway into crane and AGV control' },
    { name: 'HexaOT edge collector', level: 'L3.5', kinds: ['terminal'], share: 0.4, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'OT DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'Engineering workstation', level: 'L3', kinds: ['terminal'], share: 2.4, vendor: 'Siemens', model: 'TIA Portal V18 on Dell Precision', abbr: 'EWS', fw: ['V16', 'V17', 'V18'], protocols: ['S7comm', 'PROFINET'], zone: 'Terminal operations', consequence: 5, consequenceText: 'Can download logic to crane PLCs' },
    { name: 'Process historian', level: 'L3', kinds: ['terminal'], share: 0.8, vendor: 'AVEVA', model: 'PI Server 2023', abbr: 'HIS', fw: ['2018 SP3', '2021', '2023'], protocols: ['OPC UA', 'Modbus/TCP'], zone: 'Terminal operations', consequence: 2, consequenceText: 'Operational data integrity' },
    { name: 'AGV fleet controller', level: 'L3', kinds: ['terminal'], share: 1.2, vendor: 'Vanderlande', model: 'FleetManager 5', abbr: 'AGV', fw: ['5.2', '5.4', '5.6'], protocols: ['OPC UA', 'EtherNet/IP'], zone: 'Yard automation', consequence: 5, consequenceText: 'Vehicle motion in a manned yard' },
    { name: 'Crane HMI', level: 'L2', kinds: ['terminal'], share: 6, vendor: 'Siemens', model: 'SIMATIC TP1500 Comfort', abbr: 'HMI', fw: ['15.1', '16.0', '17.0'], protocols: ['S7comm', 'PROFINET'], zone: 'Crane control', consequence: 4, consequenceText: 'Operator view of crane state' },
    { name: 'Gate OCR lane controller', level: 'L2', kinds: ['terminal'], share: 3.2, vendor: 'Cargotec', model: 'Navis Gate OCR lane 4', abbr: 'OCR', fw: ['4.1', '4.3', '4.4'], protocols: ['Modbus/TCP', 'OPC UA'], zone: 'Gate & access', consequence: 3, consequenceText: 'Gate throughput and customs release' },
    { name: 'Reefer monitoring gateway', level: 'L2', kinds: ['terminal'], share: 3.6, vendor: 'Identec Solutions', model: 'RCMS gateway', abbr: 'RFR', fw: ['2.8', '3.0', '3.2'], protocols: ['Modbus/TCP'], zone: 'Reefer', consequence: 3, consequenceText: 'Cold-chain cargo loss' },
    { name: 'STS crane PLC (Siemens S7-1500)', level: 'L1', kinds: ['terminal'], share: 7.5, vendor: 'Siemens', model: 'CPU 1516-3 PN/DP', abbr: 'PLC', fw: ['2.8', '2.9', '3.0', '3.1'], protocols: ['S7comm', 'PROFINET'], zone: 'Crane control', consequence: 5, consequenceText: 'Crane motion over people and vessels' },
    { name: 'RTG crane drive', level: 'L1', kinds: ['terminal'], share: 9, vendor: 'ABB', model: 'ACS880 drive controller', abbr: 'RTG', fw: ['3.2', '3.4', '3.5'], protocols: ['PROFINET', 'Modbus/TCP'], zone: 'Crane control', consequence: 5, consequenceText: 'Gantry and hoist motion' },
    { name: 'AGV vehicle controller', level: 'L1', kinds: ['terminal'], share: 7, vendor: 'Rockwell Automation', model: 'CompactLogix 5380', abbr: 'VEH', fw: ['32.11', '33.12', '35.11'], protocols: ['EtherNet/IP'], zone: 'Yard automation', consequence: 5, consequenceText: 'Vehicle motion and collision avoidance' },
    { name: 'Substation RTU', level: 'L1', kinds: ['terminal'], share: 1.6, vendor: 'Siemens', model: 'SICAM A8000 CP-8050', abbr: 'RTU', fw: ['4.70', '5.10', '5.30'], protocols: ['IEC 61850', 'DNP3'], zone: 'Power & substation', consequence: 5, consequenceText: 'Terminal-wide power loss' },
    { name: 'Protection relay', level: 'L0', kinds: ['terminal'], share: 2.4, vendor: 'Siemens', model: 'SIPROTEC 5 7SJ85', abbr: 'REL', fw: ['8.30', '8.80', '9.40'], protocols: ['IEC 61850'], zone: 'Power & substation', consequence: 5, consequenceText: 'Electrical protection of crane feeders' },
    { name: 'Drive / field I/O', level: 'L0', kinds: ['terminal'], share: 14, vendor: 'Siemens', model: 'ET 200SP I/O', abbr: 'IO', fw: ['4.1', '4.2', '4.5'], protocols: ['PROFINET'], zone: 'Crane control', consequence: 4, consequenceText: 'Sensor and actuator integrity' },
    // Vessel estate
    { name: 'Vessel firewall', level: 'L3.5', kinds: ['vessel'], share: 1, vendor: 'Fortinet', model: 'FortiGate 60F', abbr: 'FW', fw: ['7.0.12', '7.2.8', '7.4.4'], protocols: [], zone: 'Vessel DMZ', consequence: 3, consequenceText: 'Shore-to-ship boundary' },
    { name: 'VDR', level: 'L3', kinds: ['vessel'], share: 1, vendor: 'Danelec', model: 'DM100 VDR', abbr: 'VDR', fw: ['2.4', '2.6', '2.7'], protocols: ['NMEA 0183'], zone: 'Bridge & navigation', consequence: 2, consequenceText: 'Incident evidence integrity' },
    { name: 'ECDIS (bridge)', level: 'L2', kinds: ['vessel'], share: 2, vendor: 'Furuno', model: 'FMD-3200', abbr: 'ECD', fw: ['03.01', '03.05', '04.02'], protocols: ['NMEA 0183'], zone: 'Bridge & navigation', consequence: 5, consequenceText: 'Safe navigation' },
    { name: 'Cargo control HMI', level: 'L2', kinds: ['vessel'], share: 1.5, vendor: 'Kongsberg', model: 'K-Chief cargo station', abbr: 'CCH', fw: ['8.1', '8.3', '8.4'], protocols: ['Modbus/TCP', 'OPC UA'], zone: 'Cargo & ballast', consequence: 4, consequenceText: 'Stability and reefer power' },
    { name: 'Engine control (K-Chief)', level: 'L1', kinds: ['vessel'], share: 2.2, vendor: 'Kongsberg', model: 'K-Chief 600', abbr: 'ENG', fw: ['3.2.0', '3.3.1', '3.4.2'], protocols: ['Modbus/TCP', 'NMEA 0183'], zone: 'Machinery & propulsion', consequence: 5, consequenceText: 'Propulsion and manoeuvrability' },
    { name: 'Ballast water treatment PLC', level: 'L1', kinds: ['vessel'], share: 1.2, vendor: 'Unitronics', model: 'Vision V570', abbr: 'BWT', fw: ['9.8.9', '9.9.0', '9.9.1'], protocols: ['Modbus/TCP'], zone: 'Cargo & ballast', consequence: 4, consequenceText: 'Stability and environmental compliance' },
    { name: 'GNSS / NMEA sensors', level: 'L0', kinds: ['vessel'], share: 3, vendor: 'Furuno', model: 'GP-170 / sensors', abbr: 'NAV', fw: ['1.2', '1.4', '1.5'], protocols: ['NMEA 0183'], zone: 'Bridge & navigation', consequence: 4, consequenceText: 'Position and heading integrity' },
  ],
  finserv: [
    { name: 'DCIM server', level: 'L4', kinds: ['dc'], share: 0.5, vendor: 'Schneider Electric', model: 'EcoStruxure IT Expert', abbr: 'DCIM', fw: ['2.4', '2.6', '2.8'], protocols: ['SNMP'], zone: 'Corporate IT', consequence: 2, consequenceText: 'Capacity planning visibility' },
    { name: 'Facilities jump host', level: 'L3.5', kinds: ['dc', 'office'], share: 0.4, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['BACnet/IP'], zone: 'Facilities DMZ', consequence: 4, consequenceText: 'Gateway into power and cooling control' },
    { name: 'BMS server', level: 'L3', kinds: ['dc', 'office'], share: 0.8, vendor: 'Schneider Electric', model: 'EcoStruxure Building Operation', abbr: 'BMS', fw: ['4.0', '5.0', '6.0'], protocols: ['BACnet/IP', 'Modbus/TCP', 'LonWorks'], zone: 'BMS & DCIM', consequence: 4, consequenceText: 'Supervision of cooling and power' },
    { name: 'CCTV NVR', level: 'L3', kinds: ['dc', 'office'], share: 2, vendor: 'Milestone', model: 'XProtect Corporate', abbr: 'NVR', fw: ['2022 R3', '2023 R2', '2024 R1'], protocols: ['SNMP'], zone: 'Physical security', consequence: 2, consequenceText: 'Loss of surveillance evidence' },
    { name: 'BMS controller (EcoStruxure)', level: 'L2', kinds: ['dc', 'office'], share: 6, vendor: 'Schneider Electric', model: 'SpaceLogic AS-P', abbr: 'ASP', fw: ['3.3', '4.0', '5.0'], protocols: ['BACnet/IP', 'Modbus/TCP'], zone: 'BMS & DCIM', consequence: 4, consequenceText: 'Cooling set-points and alarms' },
    { name: 'Power monitoring gateway', level: 'L2', kinds: ['dc'], share: 2.6, vendor: 'Schneider Electric', model: 'PowerLogic Link150', abbr: 'PMG', fw: ['4.2', '4.8', '5.1'], protocols: ['Modbus/TCP', 'SNMP'], zone: 'Power (UPS, generators)', consequence: 3, consequenceText: 'Power quality visibility' },
    { name: 'ATM (NCR SelfServ)', level: 'L2', kinds: ['atm'], share: 1, vendor: 'NCR Atleos', model: 'SelfServ 84', abbr: 'ATM', fw: ['APTRA 06.04', 'APTRA 06.06', 'APTRA 07.01'], protocols: ['XFS (ATM)', 'SNMP'], zone: 'ATM network', consequence: 4, consequenceText: 'Cash-out (jackpotting) and card data' },
    { name: 'UPS (Eaton 9395)', level: 'L1', kinds: ['dc', 'office'], share: 4.5, vendor: 'Eaton', model: '9395P 1100 kVA', abbr: 'UPS', fw: ['3.10', '3.12', '3.14'], protocols: ['SNMP', 'Modbus/TCP'], zone: 'Power (UPS, generators)', consequence: 5, consequenceText: 'Data-centre hall power loss' },
    { name: 'CRAC unit', level: 'L1', kinds: ['dc', 'office'], share: 8, vendor: 'Vertiv', model: 'Liebert PDX', abbr: 'CRAC', fw: ['1.6', '1.8', '2.1'], protocols: ['BACnet/IP', 'Modbus/TCP'], zone: 'Cooling (CRAC)', consequence: 5, consequenceText: 'Thermal shutdown of a data hall' },
    { name: 'Generator controller', level: 'L1', kinds: ['dc'], share: 1.4, vendor: 'Deep Sea Electronics', model: 'DSE8610 MKII', abbr: 'GEN', fw: ['5.3', '6.1', '6.4'], protocols: ['Modbus/TCP'], zone: 'Power (UPS, generators)', consequence: 5, consequenceText: 'Loss of backup power' },
    { name: 'Fire suppression panel', level: 'L1', kinds: ['dc', 'office'], share: 1.2, vendor: 'Siemens', model: 'Cerberus PRO FC2060', abbr: 'FIRE', fw: ['IP7', 'IP8', 'IP9'], protocols: ['BACnet/IP'], zone: 'Fire & life safety', consequence: 5, consequenceText: 'Life safety and gas release' },
    { name: 'Physical access controller', level: 'L1', kinds: ['dc', 'office'], share: 5, vendor: 'HID', model: 'Mercury LP4502', abbr: 'PAC', fw: ['1.29', '1.30', '2.0'], protocols: ['SNMP'], zone: 'Physical security', consequence: 4, consequenceText: 'Unauthorised entry to data halls' },
    { name: 'Environmental sensors', level: 'L0', kinds: ['dc', 'office'], share: 16, vendor: 'Schneider Electric', model: 'NetBotz 750 sensors', abbr: 'ENV', fw: ['4.7', '5.2', '5.3'], protocols: ['SNMP'], zone: 'Cooling (CRAC)', consequence: 2, consequenceText: 'False readings mask overheating' },
    { name: 'Intelligent PDU', level: 'L0', kinds: ['dc'], share: 13, vendor: 'Raritan', model: 'PX3 series', abbr: 'PDU', fw: ['3.6', '4.0', '4.1'], protocols: ['SNMP', 'Modbus/TCP'], zone: 'Power (UPS, generators)', consequence: 4, consequenceText: 'Rack power switching' },
  ],
  media: [
    { name: 'Broadcast DMZ jump host', level: 'L3.5', kinds: ['broadcast'], share: 0.5, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['Ember+'], zone: 'Broadcast DMZ', consequence: 4, consequenceText: 'Gateway into playout and routing' },
    { name: 'Playout server (iTX)', level: 'L3', kinds: ['broadcast'], share: 2.5, vendor: 'Grass Valley', model: 'iTX 2024', abbr: 'PLY', fw: ['2.9', '3.1', '3.3'], protocols: ['SMPTE ST 2110', 'NMOS IS-04/05'], zone: 'Playout & automation', consequence: 5, consequenceText: 'Off-air on a live channel' },
    { name: 'NMOS registry & orchestration', level: 'L3', kinds: ['broadcast'], share: 0.8, vendor: 'Grass Valley', model: 'GV Orbit', abbr: 'ORB', fw: ['3.0', '3.4', '3.6'], protocols: ['NMOS IS-04/05', 'Ember+'], zone: 'Playout & automation', consequence: 5, consequenceText: 'Re-routing of every live flow' },
    { name: 'Multiviewer', level: 'L3', kinds: ['broadcast'], share: 1.6, vendor: 'Grass Valley', model: 'Kaleido-IP', abbr: 'MV', fw: ['10.2', '10.4', '11.0'], protocols: ['SMPTE ST 2110', 'NMOS IS-04/05'], zone: 'Playout & automation', consequence: 3, consequenceText: 'Operators lose sight of output' },
    { name: 'SMPTE 2110 IP router', level: 'L2', kinds: ['broadcast'], share: 2.4, vendor: 'Arista', model: '7280R3 (media fabric)', abbr: 'RTR', fw: ['4.29', '4.31', '4.32'], protocols: ['SMPTE ST 2110', 'PTP (IEEE 1588)', 'SNMP'], zone: 'ST 2110 media fabric', consequence: 5, consequenceText: 'Every live signal path' },
    { name: 'Vision mixer', level: 'L2', kinds: ['broadcast'], share: 1.6, vendor: 'Grass Valley', model: 'K-Frame XP', abbr: 'VMX', fw: ['13.1', '14.0', '14.2'], protocols: ['SMPTE ST 2110', 'Ember+'], zone: 'Studio control', consequence: 4, consequenceText: 'Programme output switching' },
    { name: 'Comms matrix (intercom)', level: 'L2', kinds: ['broadcast'], share: 1.6, vendor: 'Riedel', model: 'Artist-1024', abbr: 'COM', fw: ['8.2', '8.4', '9.0'], protocols: ['SMPTE ST 2110', 'Ember+'], zone: 'Studio control', consequence: 4, consequenceText: 'Crew talkback during live events' },
    { name: 'Studio BMS', level: 'L2', kinds: ['broadcast', 'stage', 'post'], share: 2, vendor: 'Johnson Controls', model: 'Metasys NAE', abbr: 'BMS', fw: ['11.0', '12.0', '13.0'], protocols: ['SNMP'], zone: 'Facilities', consequence: 3, consequenceText: 'Cooling of apparatus rooms' },
    { name: 'PTP grandmaster clock', level: 'L1', kinds: ['broadcast'], share: 0.5, vendor: 'Meinberg', model: 'LANTIME M1000S', abbr: 'PTP', fw: ['7.04', '7.06', '7.08'], protocols: ['PTP (IEEE 1588)', 'SNMP'], zone: 'Timing (PTP)', consequence: 5, consequenceText: 'Loss of sync across the 2110 plant' },
    { name: 'Encoder (contribution)', level: 'L1', kinds: ['broadcast'], share: 3.2, vendor: 'Appear', model: 'X20 platform', abbr: 'ENC', fw: ['6.2', '6.6', '6.8'], protocols: ['SMPTE ST 2110', 'SNMP'], zone: 'Studio control', consequence: 4, consequenceText: 'Contribution feeds to affiliates' },
    { name: 'Camera CCU', level: 'L1', kinds: ['broadcast', 'stage'], share: 5, vendor: 'Sony', model: 'HDCU-5500', abbr: 'CCU', fw: ['1.20', '1.30', '1.40'], protocols: ['SMPTE ST 2110', 'Ember+'], zone: 'Studio control', consequence: 3, consequenceText: 'Camera shading and tally' },
    { name: 'Studio lighting DMX gateway', level: 'L1', kinds: ['broadcast', 'stage'], share: 2.8, vendor: 'ETC', model: 'Response Mk2 gateway', abbr: 'DMX', fw: ['3.1', '3.3', '3.4'], protocols: ['Art-Net / sACN'], zone: 'Lighting', consequence: 4, consequenceText: 'Rig and pyro-adjacent cues on set' },
    { name: 'UPS & power distribution', level: 'L1', kinds: ['broadcast', 'post'], share: 1.4, vendor: 'Eaton', model: '93PM', abbr: 'UPS', fw: ['2.4', '2.8', '3.0'], protocols: ['SNMP'], zone: 'Facilities', consequence: 5, consequenceText: 'Apparatus room power loss' },
    { name: 'Lighting fixtures', level: 'L0', kinds: ['broadcast', 'stage'], share: 12, vendor: 'ARRI', model: 'SkyPanel S60-C', abbr: 'FIX', fw: ['4.1', '4.4', '5.0'], protocols: ['Art-Net / sACN'], zone: 'Lighting', consequence: 2, consequenceText: 'Lighting state on air' },
    { name: 'Cameras & stageboxes', level: 'L0', kinds: ['broadcast', 'stage'], share: 9, vendor: 'Sony', model: 'HDC-5500 / stagebox', abbr: 'CAM', fw: ['1.20', '1.30', '1.40'], protocols: ['SMPTE ST 2110'], zone: 'Studio control', consequence: 2, consequenceText: 'Signal quality' },
  ],
  healthcare: [
    { name: 'Epic interface engine (Bridges)', level: 'L4', kinds: ['hospital', 'imaging', 'lab'], share: 0.25, vendor: 'Epic', model: 'Bridges / Interconnect', abbr: 'EPI', fw: ['Nov 2023', 'Aug 2024', 'Feb 2025'], protocols: ['HL7 v2', 'FHIR'], zone: 'Clinical IT (Epic)', consequence: 3, consequenceText: 'Orders and results stop reaching devices' },
    { name: 'Biomed jump host', level: 'L3.5', kinds: ['hospital', 'imaging', 'lab'], share: 0.2, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['RDP'], zone: 'Medical device DMZ', consequence: 4, consequenceText: 'Gateway into pump, monitor and imaging networks' },
    { name: 'Passive collector', level: 'L3.5', kinds: ['hospital', 'imaging', 'lab'], share: 0.12, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'Medical device DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'Infusion pump server (Alaris)', level: 'L3', kinds: ['hospital'], share: 0.06, vendor: 'BD', model: 'Alaris Systems Manager 12', abbr: 'ASM', fw: ['4.33', '12.1', '12.3'], protocols: ['Proprietary pump telemetry', 'HL7 v2'], zone: 'Infusion', consequence: 4, consequenceText: 'Drug library and pump programming integrity' },
    { name: 'Patient Information Center (PIC iX)', level: 'L3', kinds: ['hospital'], share: 0.08, vendor: 'Philips', model: 'PIC iX 4.1', abbr: 'PIC', fw: ['C.02', 'C.03', '4.1'], protocols: ['HL7 v2', 'IEEE 11073'], zone: 'Patient monitoring', consequence: 5, consequenceText: 'Central alarm surveillance for ICU and step-down' },
    { name: 'PACS / VNA server', level: 'L3', kinds: ['hospital', 'imaging'], share: 0.1, vendor: 'GE HealthCare', model: 'Centricity PACS 7', abbr: 'PACS', fw: ['6.0', '7.0 SP1', '7.0 SP3'], protocols: ['DICOM', 'HL7 v2'], zone: 'Imaging', consequence: 3, consequenceText: 'Images unavailable for diagnosis' },
    { name: 'Lab middleware', level: 'L3', kinds: ['lab', 'hospital'], share: 0.06, vendor: 'Siemens Healthineers', model: 'Atellica Data Manager', abbr: 'LDM', fw: ['1.3', '1.4', '1.5'], protocols: ['HL7 v2', 'ASTM'], zone: 'Laboratory', consequence: 4, consequenceText: 'Results delayed or attached to the wrong patient' },
    { name: 'Nurse call server', level: 'L3', kinds: ['hospital'], share: 0.08, vendor: 'Hillrom', model: 'Navicare 6', abbr: 'NCS', fw: ['6.2', '6.4', '6.6'], protocols: ['HL7 v2', 'SIP'], zone: 'Nurse call & RTLS', consequence: 4, consequenceText: 'Patients cannot summon help' },
    { name: 'Modality workstation (CT console)', level: 'L2', kinds: ['hospital', 'imaging'], share: 0.3, vendor: 'GE HealthCare', model: 'Revolution CT console', abbr: 'CTW', fw: ['21MW', '22MW', '24MW'], protocols: ['DICOM'], zone: 'Imaging', consequence: 3, consequenceText: 'Scans cancelled or delayed' },
    { name: 'Pharmacy dispensing cabinet', level: 'L2', kinds: ['hospital', 'lab'], share: 1.6, vendor: 'Omnicell', model: 'XT automated dispensing', abbr: 'ADC', fw: ['21.3', '22.1', '23.2'], protocols: ['HL7 v2', 'SMB'], zone: 'Pharmacy', consequence: 4, consequenceText: 'Medication access on the ward' },
    { name: 'BMS controller (OR & isolation)', level: 'L2', kinds: ['hospital', 'imaging', 'lab'], share: 1.1, vendor: 'Johnson Controls', model: 'Metasys NAE55', abbr: 'BMS', fw: ['11.0', '12.0', '13.0'], protocols: ['BACnet/IP'], zone: 'Building & environment', consequence: 5, consequenceText: 'OR air changes and negative-pressure isolation' },
    { name: 'Nurse call console', level: 'L2', kinds: ['hospital'], share: 2, vendor: 'Hillrom', model: 'Navicare station', abbr: 'NCC', fw: ['6.2', '6.4', '6.6'], protocols: ['SIP'], zone: 'Nurse call & RTLS', consequence: 3, consequenceText: 'Calls and alarms not shown at the station' },
    { name: 'Pneumatic tube controller', level: 'L2', kinds: ['hospital'], share: 0.25, vendor: 'Swisslog', model: 'TransLogic Nexus', abbr: 'PTS', fw: ['7.1', '7.2.4', '7.2.5'], protocols: ['Modbus/TCP'], zone: 'Building & environment', consequence: 3, consequenceText: 'Lab samples and drugs stop moving' },
    { name: 'Infusion pump (BD Alaris)', level: 'L1', kinds: ['hospital', 'imaging'], share: 30, vendor: 'BD', model: 'Alaris 8015 PC unit', abbr: 'INF', fw: ['9.19', '12.1.2', '12.3.1'], protocols: ['Proprietary pump telemetry'], zone: 'Infusion', consequence: 5, consequenceText: 'Drug delivery to the patient' },
    { name: 'Patient monitor (IntelliVue)', level: 'L1', kinds: ['hospital'], share: 13, vendor: 'Philips', model: 'IntelliVue MX750', abbr: 'MON', fw: ['M.00', 'N.01', 'P.01'], protocols: ['IEEE 11073', 'HL7 v2'], zone: 'Patient monitoring', consequence: 5, consequenceText: 'Vital-sign alarms at the bedside' },
    { name: 'Ventilator', level: 'L1', kinds: ['hospital'], share: 2, vendor: 'Hamilton Medical', model: 'HAMILTON-C6', abbr: 'VEN', fw: ['2.2', '3.0', '3.1'], protocols: ['HL7 v2'], zone: 'Critical care', consequence: 5, consequenceText: 'Life support' },
    { name: 'Anaesthesia workstation', level: 'L1', kinds: ['hospital'], share: 0.8, vendor: 'GE HealthCare', model: 'Aisys CS2', abbr: 'ANE', fw: ['11', '11 SP1', '12'], protocols: ['HL7 v2'], zone: 'Surgical', consequence: 5, consequenceText: 'Anaesthetic delivery in theatre' },
    { name: 'CT scanner', level: 'L1', kinds: ['hospital', 'imaging'], share: 0.22, vendor: 'GE HealthCare', model: 'Revolution Apex', abbr: 'CT', fw: ['21MW', '22MW', '24MW'], protocols: ['DICOM'], zone: 'Imaging', consequence: 4, consequenceText: 'Trauma and stroke imaging unavailable' },
    { name: 'MRI scanner', level: 'L1', kinds: ['hospital', 'imaging'], share: 0.14, vendor: 'Siemens Healthineers', model: 'MAGNETOM Vida', abbr: 'MRI', fw: ['XA30', 'XA50', 'XA60'], protocols: ['DICOM'], zone: 'Imaging', consequence: 4, consequenceText: 'Imaging capacity loss' },
    { name: 'Linear accelerator', level: 'L1', kinds: ['imaging'], share: 0.08, vendor: 'Varian', model: 'TrueBeam', abbr: 'LIN', fw: ['2.7', '3.0', '4.0'], protocols: ['DICOM'], zone: 'Radiation oncology', consequence: 5, consequenceText: 'Radiation dose delivery' },
    { name: 'Lab analyser', level: 'L1', kinds: ['lab', 'hospital'], share: 1.1, vendor: 'Siemens Healthineers', model: 'Atellica Solution', abbr: 'LAB', fw: ['1.27', '1.29', '1.31'], protocols: ['HL7 v2', 'ASTM'], zone: 'Laboratory', consequence: 3, consequenceText: 'Results delayed or wrong' },
    { name: 'Ultrasound', level: 'L1', kinds: ['hospital', 'imaging'], share: 1.3, vendor: 'GE HealthCare', model: 'Vivid E95', abbr: 'US', fw: ['203', '204', '206'], protocols: ['DICOM'], zone: 'Imaging', consequence: 2, consequenceText: 'Bedside imaging delayed' },
    { name: 'Medical gas alarm panel', level: 'L1', kinds: ['hospital'], share: 0.2, vendor: 'Beacon Medaes', model: 'Medical gas master alarm', abbr: 'GAS', fw: ['3.1', '3.4', '3.5'], protocols: ['Modbus/TCP', 'BACnet/IP'], zone: 'Building & environment', consequence: 5, consequenceText: 'Oxygen and vacuum supply alarms' },
    { name: 'Patient telemetry transmitter', level: 'L0', kinds: ['hospital'], share: 9, vendor: 'Philips', model: 'IntelliVue MX40', abbr: 'TEL', fw: ['B.05', 'B.06', 'C.01'], protocols: ['Proprietary (WMTS)'], zone: 'Patient monitoring', consequence: 4, consequenceText: 'Ambulatory cardiac monitoring' },
    { name: 'Smart bed', level: 'L0', kinds: ['hospital'], share: 7, vendor: 'Hillrom', model: 'Centrella Smart+', abbr: 'BED', fw: ['2.4', '2.6', '2.8'], protocols: ['Proprietary bed link'], zone: 'Nurse call & RTLS', consequence: 2, consequenceText: 'Bed-exit alarms for fall risk' },
    { name: 'Fridge & freezer sensor', level: 'L0', kinds: ['hospital', 'lab'], share: 2.6, vendor: 'Primex', model: 'OneVue Sense', abbr: 'TMP', fw: ['3.2', '3.4', '3.5'], protocols: ['MQTT'], zone: 'Pharmacy', consequence: 2, consequenceText: 'Vaccine and blood product temperature' },
  ],
  automotive: [
    { name: 'MES interface (SAP / Opcenter)', level: 'L4', kinds: ['plant', 'cellplant'], share: 0.3, vendor: 'Siemens', model: 'Opcenter Execution Discrete 2404', abbr: 'MESI', fw: ['2304', '2310', '2404'], protocols: ['OPC UA', 'HTTPS'], zone: 'Enterprise IT (SAP, PLM)', consequence: 3, consequenceText: 'Build orders stop reaching the line (JIT/JIS)' },
    { name: 'OT jump host', level: 'L3.5', kinds: ['plant', 'cellplant'], share: 0.25, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['RDP'], zone: 'Plant DMZ', consequence: 4, consequenceText: 'Gateway into line control' },
    { name: 'Passive sensor / collector', level: 'L3.5', kinds: ['plant', 'cellplant'], share: 0.15, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'Plant DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'MES line server', level: 'L3', kinds: ['plant', 'cellplant'], share: 0.5, vendor: 'Siemens', model: 'Opcenter line node', abbr: 'MES', fw: ['2304', '2310', '2404'], protocols: ['OPC UA', 'S7comm'], zone: 'MES & line control', consequence: 4, consequenceText: 'Line stops within one takt' },
    { name: 'Engineering workstation', level: 'L3', kinds: ['plant', 'cellplant'], share: 1.2, vendor: 'Siemens', model: 'TIA Portal V18 on Dell Precision', abbr: 'EWS', fw: ['V16', 'V17', 'V18'], protocols: ['S7comm', 'PROFINET'], zone: 'MES & line control', consequence: 5, consequenceText: 'Can download logic to line and safety PLCs' },
    { name: 'SCADA server (WinCC)', level: 'L3', kinds: ['plant', 'cellplant'], share: 0.4, vendor: 'Siemens', model: 'WinCC OA 3.19', abbr: 'SCA', fw: ['3.17', '3.18', '3.19'], protocols: ['OPC UA', 'S7comm'], zone: 'MES & line control', consequence: 4, consequenceText: 'Operators lose plant overview' },
    { name: 'End-of-line test bench', level: 'L3', kinds: ['plant'], share: 0.5, vendor: 'Vector Informatik', model: 'EOL bench (CANoe)', abbr: 'EOL', fw: ['16 SP2', '17 SP1', '17 SP3'], protocols: ['CAN / DoIP', 'SMB'], zone: 'Final assembly & EOL', consequence: 4, consequenceText: 'Flashes vehicle ECUs before delivery' },
    { name: 'AGV fleet manager', level: 'L3', kinds: ['plant'], share: 0.15, vendor: 'Rockwell Automation', model: 'FactoryTalk fleet manager', abbr: 'AGM', fw: ['5.2', '5.4', '5.6'], protocols: ['OPC UA', 'EtherNet/IP'], zone: 'Intralogistics (AGV)', consequence: 4, consequenceText: 'Parts delivery to the line' },
    { name: 'Formation & ageing control server', level: 'L3', kinds: ['cellplant'], share: 0.5, vendor: 'Siemens', model: 'Opcenter for battery cells', abbr: 'FCS', fw: ['2304', '2310', '2404'], protocols: ['OPC UA', 'Modbus/TCP'], zone: 'Formation & ageing', consequence: 5, consequenceText: 'Cell charging profiles (thermal runaway risk)' },
    { name: 'Line HMI', level: 'L2', kinds: ['plant', 'cellplant'], share: 5, vendor: 'Siemens', model: 'SIMATIC Unified Comfort 15"', abbr: 'HMI', fw: ['17.0', '18.0', '19.0'], protocols: ['S7comm', 'PROFINET'], zone: 'Press & body shop', consequence: 3, consequenceText: 'Operator view of line state' },
    { name: 'Torque tool controller', level: 'L2', kinds: ['plant'], share: 3.2, vendor: 'Atlas Copco', model: 'Power Focus 8', abbr: 'TQ', fw: ['3.4', '3.6', '3.8'], protocols: ['OPC UA', 'Modbus/TCP'], zone: 'Final assembly & EOL', consequence: 4, consequenceText: 'Safety-relevant bolt torque (wheels, seats)' },
    { name: 'Vision quality camera', level: 'L2', kinds: ['plant', 'cellplant'], share: 3, vendor: 'Cognex', model: 'In-Sight 3D-L4000', abbr: 'VIS', fw: ['6.1', '6.3', '6.4'], protocols: ['EtherNet/IP', 'PROFINET'], zone: 'Final assembly & EOL', consequence: 2, consequenceText: 'Quality gate passes defects' },
    { name: 'Paint robot cell controller', level: 'L2', kinds: ['plant'], share: 1.2, vendor: 'Dürr', model: 'EcoRCMP2', abbr: 'PNT', fw: ['5.1', '5.3', '5.4'], protocols: ['PROFINET', 'OPC UA'], zone: 'Paint shop', consequence: 4, consequenceText: 'Paint booth atmosphere and robot motion' },
    { name: 'Dry-room HVAC controller', level: 'L2', kinds: ['cellplant'], share: 1.2, vendor: 'Siemens', model: 'Desigo PXC5', abbr: 'DRY', fw: ['6.0', '7.0', '7.1'], protocols: ['BACnet/IP'], zone: 'Dry rooms & HVAC', consequence: 5, consequenceText: 'Dew point in electrode and cell assembly' },
    { name: 'Press line PLC', level: 'L1', kinds: ['plant'], share: 1.6, vendor: 'Siemens', model: 'S7-1518F', abbr: 'PRS', fw: ['2.8', '2.9', '3.0', '3.1'], protocols: ['S7comm', 'PROFINET'], zone: 'Press & body shop', consequence: 5, consequenceText: 'Press motion with operators at the die' },
    { name: 'Body-shop safety PLC', level: 'L1', kinds: ['plant'], share: 3.5, vendor: 'Siemens', model: 'S7-1516F', abbr: 'PLC', fw: ['2.8', '2.9', '3.0', '3.1'], protocols: ['S7comm', 'PROFINET'], zone: 'Press & body shop', consequence: 5, consequenceText: 'Robot cell guarding and light curtains' },
    { name: 'Welding robot controller', level: 'L1', kinds: ['plant'], share: 11, vendor: 'KUKA', model: 'KR C5 (KR QUANTEC)', abbr: 'ROB', fw: ['8.6', '8.7', '9.0'], protocols: ['PROFINET', 'OPC UA'], zone: 'Press & body shop', consequence: 5, consequenceText: 'Robot motion near people' },
    { name: 'Conveyor PLC', level: 'L1', kinds: ['plant', 'cellplant'], share: 3, vendor: 'Siemens', model: 'S7-1515', abbr: 'CNV', fw: ['2.8', '2.9', '3.0', '3.1'], protocols: ['S7comm', 'PROFINET'], zone: 'Final assembly & EOL', consequence: 4, consequenceText: 'Line movement and skid transfer' },
    { name: 'AGV / AMR vehicle controller', level: 'L1', kinds: ['plant'], share: 2.4, vendor: 'Rockwell Automation', model: 'CompactLogix 5380', abbr: 'AGV', fw: ['32.11', '33.12', '35.11'], protocols: ['EtherNet/IP'], zone: 'Intralogistics (AGV)', consequence: 4, consequenceText: 'Vehicle motion in walkways' },
    { name: 'Formation rack controller', level: 'L1', kinds: ['cellplant'], share: 4, vendor: 'Siemens', model: 'S7-1512SP F', abbr: 'FRM', fw: ['2.9', '3.0', '3.1'], protocols: ['PROFINET', 'Modbus/TCP'], zone: 'Formation & ageing', consequence: 5, consequenceText: 'Charge current and cell temperature limits' },
    { name: 'Electrode & cell assembly PLC', level: 'L1', kinds: ['cellplant'], share: 2, vendor: 'Siemens', model: 'S7-1517F', abbr: 'CEL', fw: ['2.9', '3.0', '3.1'], protocols: ['S7comm', 'PROFINET'], zone: 'Electrode & cell assembly', consequence: 4, consequenceText: 'Coating, stacking and electrolyte filling' },
    { name: 'Servo drive', level: 'L0', kinds: ['plant', 'cellplant'], share: 26, vendor: 'Siemens', model: 'SINAMICS S210', abbr: 'DRV', fw: ['5.2', '5.2 SP3', '6.1'], protocols: ['PROFINET'], zone: 'Press & body shop', consequence: 3, consequenceText: 'Axis motion' },
    { name: 'Remote I/O & safety I/O', level: 'L0', kinds: ['plant', 'cellplant'], share: 30, vendor: 'Siemens', model: 'ET 200SP', abbr: 'IO', fw: ['4.1', '4.2', '4.5'], protocols: ['PROFINET'], zone: 'Final assembly & EOL', consequence: 3, consequenceText: 'Sensor and actuator integrity' },
  ],
  insurance: [
    { name: 'DCIM server', level: 'L4', kinds: ['dc'], share: 0.4, vendor: 'Schneider Electric', model: 'EcoStruxure IT Expert', abbr: 'DCIM', fw: ['2.6', '2.8', '3.0'], protocols: ['SNMP'], zone: 'Corporate IT', consequence: 2, consequenceText: 'Rack, power and cooling capacity view for the mainframe halls' },
    { name: 'Facilities jump host', level: 'L3.5', kinds: ['dc', 'printplant'], share: 0.4, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['RDP'], zone: 'Facilities DMZ', consequence: 4, consequenceText: 'The one path into power, cooling and print control' },
    { name: 'Passive sensor / collector', level: 'L3.5', kinds: ['dc', 'printplant'], share: 0.3, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'Facilities DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'BMS server (EcoStruxure)', level: 'L3', kinds: ['dc', 'printplant'], share: 0.6, vendor: 'Schneider Electric', model: 'EcoStruxure Building Operation 6', abbr: 'BMS', fw: ['4.0', '5.0', '6.0'], protocols: ['BACnet/IP', 'Modbus/TCP', 'LonWorks'], zone: 'BMS & DCIM', consequence: 4, consequenceText: 'Supervises chillers, CRAH units and the generator plant' },
    { name: 'Access control server (LenelS2)', level: 'L3', kinds: ['dc', 'printplant'], share: 0.4, vendor: 'LenelS2', model: 'OnGuard 8.2', abbr: 'ACS', fw: ['7.6', '8.0', '8.2'], protocols: ['HTTPS'], zone: 'Physical security', consequence: 3, consequenceText: 'Badge rights to data halls and the mail floor' },
    { name: 'CCTV NVR', level: 'L3', kinds: ['dc', 'printplant'], share: 1.2, vendor: 'Genetec', model: 'Security Center Omnicast 5.12', abbr: 'NVR', fw: ['5.10', '5.11', '5.12'], protocols: ['SNMP'], zone: 'Physical security', consequence: 2, consequenceText: 'Video evidence for hall and mail-floor access' },
    { name: 'Print workflow server', level: 'L3', kinds: ['printplant'], share: 0.8, vendor: 'Xerox', model: 'FreeFlow Core 7', abbr: 'PWS', fw: ['6.2', '7.0', '7.2'], protocols: ['IPP / JDF (print)', 'SMB'], zone: 'Print & mail production', consequence: 4, consequenceText: 'Policy, renewal and claims letters with policyholder PII' },
    { name: 'Mail-piece integrity server', level: 'L3', kinds: ['printplant'], share: 0.5, vendor: 'Pitney Bowes', model: 'Relay Communications Hub', abbr: 'MPI', fw: ['5.4', '6.0', '6.2'], protocols: ['IPP / JDF (print)', 'SMB'], zone: 'Print & mail production', consequence: 4, consequenceText: 'Ensures each letter goes in the right envelope (privacy breach if not)' },
    { name: 'BMS controller (EcoStruxure)', level: 'L2', kinds: ['dc', 'printplant'], share: 5, vendor: 'Schneider Electric', model: 'SpaceLogic AS-P', abbr: 'ASP', fw: ['4.0', '5.0', '6.0'], protocols: ['BACnet/IP', 'Modbus/TCP'], zone: 'BMS & DCIM', consequence: 4, consequenceText: 'Cooling set-points and alarms for the halls' },
    { name: 'Power monitoring gateway', level: 'L2', kinds: ['dc'], share: 2, vendor: 'Schneider Electric', model: 'PowerLogic Link150', abbr: 'PMG', fw: ['4.8', '5.1', '5.3'], protocols: ['Modbus/TCP', 'SNMP'], zone: 'Power (UPS, generators)', consequence: 3, consequenceText: 'Power quality and load-transfer visibility' },
    { name: 'Production printer (Xerox iGen)', level: 'L2', kinds: ['printplant'], share: 3, vendor: 'Xerox', model: 'iGen 5 press', abbr: 'PRN', fw: ['11.4', '12.1', '12.3'], protocols: ['IPP / JDF (print)', 'SNMP'], zone: 'Print & mail production', consequence: 3, consequenceText: 'Renewal and premium notices miss the statutory mailing date' },
    { name: 'Inserter controller (Pitney Bowes)', level: 'L2', kinds: ['printplant'], share: 3.5, vendor: 'Pitney Bowes', model: 'Rival inserter control', abbr: 'INS', fw: ['3.6', '4.0', '4.2'], protocols: ['Modbus/TCP', 'SMB'], zone: 'Print & mail production', consequence: 4, consequenceText: 'Feeder and match logic (mis-inserts expose policyholder data)' },
    { name: 'UPS (Vertiv Liebert EXL S1)', level: 'L1', kinds: ['dc', 'printplant'], share: 4, vendor: 'Vertiv', model: 'Liebert EXL S1 1200 kVA', abbr: 'UPS', fw: ['3.2', '3.4', '3.6'], protocols: ['SNMP', 'Modbus/TCP'], zone: 'Power (UPS, generators)', consequence: 5, consequenceText: 'Hall power for the mainframe and claims systems' },
    { name: 'CRAC unit (Liebert DSE)', level: 'L1', kinds: ['dc'], share: 7, vendor: 'Vertiv', model: 'Liebert DSE 125', abbr: 'CRAC', fw: ['1.8', '2.1', '2.3'], protocols: ['BACnet/IP', 'Modbus/TCP'], zone: 'Cooling (CRAC)', consequence: 5, consequenceText: 'Thermal shutdown of a data hall' },
    { name: 'Generator controller (Cummins)', level: 'L1', kinds: ['dc'], share: 1.2, vendor: 'Cummins', model: 'PowerCommand 3.3', abbr: 'GEN', fw: ['3.0', '3.2', '3.4'], protocols: ['Modbus/TCP'], zone: 'Power (UPS, generators)', consequence: 5, consequenceText: 'Standby power during a utility outage' },
    { name: 'Fire suppression panel (Novec 1230)', level: 'L1', kinds: ['dc', 'printplant'], share: 1, vendor: 'Kidde Fire Systems', model: 'ARIES NetLink', abbr: 'FIRE', fw: ['2.6', '2.8', '3.0'], protocols: ['BACnet/IP'], zone: 'Fire & life safety', consequence: 5, consequenceText: 'Life safety and clean-agent release' },
    { name: 'Physical access controller', level: 'L1', kinds: ['dc', 'printplant'], share: 4, vendor: 'LenelS2', model: 'Mercury LP4502', abbr: 'PAC', fw: ['1.30', '2.0', '2.1'], protocols: ['SNMP'], zone: 'Physical security', consequence: 4, consequenceText: 'Unauthorised entry to halls or the mail floor' },
    { name: 'Environmental sensors', level: 'L0', kinds: ['dc'], share: 14, vendor: 'Schneider Electric', model: 'NetBotz 750 sensors', abbr: 'ENV', fw: ['5.2', '5.3', '5.4'], protocols: ['SNMP'], zone: 'Cooling (CRAC)', consequence: 2, consequenceText: 'False readings hide a hot aisle' },
    { name: 'Intelligent PDU', level: 'L0', kinds: ['dc'], share: 11, vendor: 'Vertiv', model: 'Geist rPDU', abbr: 'PDU', fw: ['5.6', '6.0', '6.1'], protocols: ['SNMP', 'Modbus/TCP'], zone: 'Power (UPS, generators)', consequence: 4, consequenceText: 'Outlet switching on mainframe and storage racks' },
    { name: 'CCTV camera', level: 'L0', kinds: ['dc', 'printplant'], share: 6, vendor: 'Axis Communications', model: 'P3268-LVE', abbr: 'CAM', fw: ['10.12', '11.6', '11.11'], protocols: ['HTTP'], zone: 'Physical security', consequence: 1, consequenceText: 'Blind spot in video coverage' },
  ],
  defence: [
    { name: 'PLM release interface (Teamcenter)', level: 'L4', kinds: ['shop', 'range'], share: 0.4, vendor: 'Siemens', model: 'Teamcenter 14 manufacturing release', abbr: 'PLM', fw: ['13.3', '14.1', '14.3'], protocols: ['HTTPS', 'SMB'], zone: 'Enterprise IT (PLM & ERP)', consequence: 3, consequenceText: 'Released programmes and test procedures stop reaching the floor' },
    { name: 'OT jump host', level: 'L3.5', kinds: ['shop', 'range'], share: 0.4, vendor: 'Microsoft', model: 'Windows Server 2022 (STIG baseline)', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['RDP'], zone: 'Shop-floor DMZ', consequence: 4, consequenceText: 'The brokered path into machine and test networks' },
    { name: 'Passive sensor / collector', level: 'L3.5', kinds: ['shop', 'range'], share: 0.3, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'Shop-floor DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'DNC programme server', level: 'L3', kinds: ['shop'], share: 0.4, vendor: 'CIMCO', model: 'MDM / DNC-Max 8', abbr: 'DNC', fw: ['8.10', '8.12', '8.14'], protocols: ['DNC serial-over-IP', 'SMB'], zone: 'DNC & inspection', consequence: 5, consequenceText: 'Every released CNC programme; tampering yields out-of-tolerance flight parts' },
    { name: 'CMM inspection workstation', level: 'L3', kinds: ['shop'], share: 0.8, vendor: 'Zeiss', model: 'CALYPSO 2023 on Dell Precision', abbr: 'CMW', fw: ['2021', '2022', '2023'], protocols: ['SMB'], zone: 'DNC & inspection', consequence: 4, consequenceText: 'First-article and inspection results (AS9102)' },
    { name: 'Process historian (AVEVA)', level: 'L3', kinds: ['shop', 'range'], share: 0.4, vendor: 'AVEVA', model: 'Historian 2023 R2', abbr: 'HIS', fw: ['2020 R2', '2023', '2023 R2'], protocols: ['OPC UA', 'MTConnect'], zone: 'DNC & inspection', consequence: 2, consequenceText: 'Spindle, furnace and chamber history for quality records' },
    { name: 'Engineering workstation', level: 'L3', kinds: ['shop'], share: 0.8, vendor: 'Rockwell Automation', model: 'Studio 5000 V35 on Dell Precision', abbr: 'EWS', fw: ['V32', 'V34', 'V35'], protocols: ['EtherNet/IP'], zone: 'DNC & inspection', consequence: 5, consequenceText: 'Can download logic to the heat-treat furnace controller' },
    { name: 'Test data acquisition server', level: 'L3', kinds: ['range'], share: 0.6, vendor: 'NI', model: 'DIAdem / SystemLink 2024', abbr: 'DAQ', fw: ['2023 Q3', '2024 Q1', '2024 Q3'], protocols: ['OPC UA', 'SMB'], zone: 'Test data & ATE', consequence: 4, consequenceText: 'Qualification test data that the prime accepts the hardware on' },
    { name: 'Avionics ATE bench (NI PXI)', level: 'L2', kinds: ['range'], share: 2.4, vendor: 'NI', model: 'PXIe-1085 with TestStand 2023', abbr: 'ATE', fw: ['2021', '2022 Q4', '2023 Q4'], protocols: ['LXI / VISA', 'SMB'], zone: 'Test data & ATE', consequence: 4, consequenceText: 'Pass or fail of avionics units before delivery' },
    { name: 'Heat-treat HMI', level: 'L2', kinds: ['shop'], share: 0.8, vendor: 'Rockwell Automation', model: 'FactoryTalk View SE 13', abbr: 'HMI', fw: ['11', '12', '13'], protocols: ['EtherNet/IP'], zone: 'Heat treat', consequence: 4, consequenceText: 'Operator view of furnace and quench state' },
    { name: 'Building management controller', level: 'L2', kinds: ['shop', 'range'], share: 1.4, vendor: 'Trane', model: 'Tracer SC+', abbr: 'BMS', fw: ['5.4', '5.8', '6.0'], protocols: ['BACnet/IP'], zone: 'Facilities (HVAC, air)', consequence: 3, consequenceText: 'Shop temperature (CMM accuracy) and compressed air' },
    { name: 'CNC mill (Haas VF-4SS)', level: 'L1', kinds: ['shop'], share: 5, vendor: 'Haas Automation', model: 'VF-4SS (NGC control)', abbr: 'CNC', fw: ['100.21', '100.22', '100.24'], protocols: ['MTConnect', 'DNC serial-over-IP'], zone: 'CNC machining', consequence: 4, consequenceText: 'Spindle and axis motion; part geometry' },
    { name: 'CNC lathe (DMG Mori NLX 2500)', level: 'L1', kinds: ['shop'], share: 3, vendor: 'DMG Mori', model: 'NLX 2500 (CELOS)', abbr: 'LTH', fw: ['5.1', '5.4', '6.0'], protocols: ['MTConnect', 'OPC UA'], zone: 'CNC machining', consequence: 4, consequenceText: 'Turning operations on guidance housings' },
    { name: 'Coordinate measuring machine', level: 'L1', kinds: ['shop'], share: 0.8, vendor: 'Zeiss', model: 'CONTURA G2', abbr: 'CMM', fw: ['6.6', '6.8', '7.0'], protocols: ['SMB'], zone: 'DNC & inspection', consequence: 3, consequenceText: 'Dimensional acceptance of machined parts' },
    { name: 'Heat-treat furnace controller', level: 'L1', kinds: ['shop'], share: 0.8, vendor: 'Rockwell Automation', model: 'ControlLogix 5580', abbr: 'HTF', fw: ['33.11', '34.11', '35.13'], protocols: ['EtherNet/IP'], zone: 'Heat treat', consequence: 5, consequenceText: 'Furnace temperature and quench (fire risk; metallurgy of flight parts)' },
    { name: 'Air compressor controller', level: 'L1', kinds: ['shop'], share: 0.6, vendor: 'Atlas Copco', model: 'Elektronikon Mk5 Touch', abbr: 'AIR', fw: ['2.1', '2.3', '2.4'], protocols: ['Modbus/TCP'], zone: 'Facilities (HVAC, air)', consequence: 3, consequenceText: 'Shop air for fixtures and tool changers' },
    { name: 'Environmental chamber (Thermotron)', level: 'L1', kinds: ['range'], share: 1.6, vendor: 'Thermotron', model: 'SE-Series with 8800 controller', abbr: 'CHM', fw: ['4.2', '4.6', '5.0'], protocols: ['Modbus/TCP', 'LXI / VISA'], zone: 'Environmental test', consequence: 4, consequenceText: 'Temperature and altitude profile on flight hardware under test' },
    { name: 'Vibration shaker controller', level: 'L1', kinds: ['range'], share: 0.6, vendor: 'Data Physics', model: 'SignalStar Vector', abbr: 'SHK', fw: ['12.1', '12.4', '13.0'], protocols: ['LXI / VISA'], zone: 'Environmental test', consequence: 5, consequenceText: 'Drive limits on a shaker that can destroy a test article' },
    { name: 'Range telemetry receiver', level: 'L1', kinds: ['range'], share: 0.8, vendor: 'Quasonix', model: 'RDMS receiver', abbr: 'TLM', fw: ['3.6', '3.8', '4.0'], protocols: ['IRIG 106 telemetry'], zone: 'Range telemetry', consequence: 3, consequenceText: 'Telemetry from units under range test' },
    { name: 'Machine I/O & probes', level: 'L0', kinds: ['shop'], share: 10, vendor: 'Rockwell Automation', model: 'POINT I/O / Renishaw probes', abbr: 'IO', fw: ['3.1', '3.3', '3.5'], protocols: ['EtherNet/IP'], zone: 'CNC machining', consequence: 2, consequenceText: 'Probe and coolant signals' },
    { name: 'Test instrumentation', level: 'L0', kinds: ['range'], share: 5, vendor: 'PCB Piezotronics', model: 'Accelerometers & thermocouple scanners', abbr: 'INS', fw: ['1.4', '1.6', '1.8'], protocols: ['LXI / VISA'], zone: 'Environmental test', consequence: 2, consequenceText: 'Measured loads on the article under test' },
  ],
  pharma: [
    { name: 'ERP / MES interface (SAP S/4HANA)', level: 'L4', kinds: ['api', 'biologics', 'fillfinish', 'packaging'], share: 0.3, vendor: 'SAP', model: 'S/4HANA 2023 · PAS-X integration', abbr: 'ERP', fw: ['2021', '2022', '2023'], protocols: ['HTTPS', 'OPC UA'], zone: 'Enterprise IT (SAP)', consequence: 3, consequenceText: 'Process orders and batch release status stop flowing' },
    { name: 'OT jump host', level: 'L3.5', kinds: ['api', 'biologics', 'fillfinish', 'packaging'], share: 0.25, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['RDP'], zone: 'Plant DMZ', consequence: 4, consequenceText: 'Brokered path into DCS and line networks' },
    { name: 'Passive sensor / collector', level: 'L3.5', kinds: ['api', 'biologics', 'aseptic', 'fillfinish', 'packaging'], share: 0.15, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'Plant DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'MES server (Werum PAS-X)', level: 'L3', kinds: ['api', 'biologics', 'aseptic', 'fillfinish', 'packaging'], share: 0.4, vendor: 'Körber', model: 'Werum PAS-X 3.3', abbr: 'MES', fw: ['3.2.4', '3.3.0', '3.3.2'], protocols: ['OPC UA', 'HTTPS'], zone: 'MES & batch records', consequence: 4, consequenceText: 'Electronic batch records and Part 11 e-signatures for release' },
    { name: 'Process historian (AVEVA PI)', level: 'L3', kinds: ['api', 'biologics', 'fillfinish'], share: 0.3, vendor: 'AVEVA', model: 'PI Server 2023', abbr: 'HIS', fw: ['2018 SP3', '2021', '2023'], protocols: ['OPC UA', 'OPC DA (DCOM)'], zone: 'MES & batch records', consequence: 3, consequenceText: 'Batch trends and deviation evidence' },
    { name: 'DCS engineering station (DeltaV)', level: 'L3', kinds: ['biologics'], share: 0.4, vendor: 'Emerson', model: 'DeltaV ProfessionalPLUS 15', abbr: 'DVE', fw: ['14.3', '14.LTS', '15.LTS'], protocols: ['OPC UA', 'OPC DA (DCOM)'], zone: 'Upstream & downstream (DeltaV)', consequence: 5, consequenceText: 'Can change control modules and phases on running bioreactors' },
    { name: 'DCS engineering station (PCS 7)', level: 'L3', kinds: ['api'], share: 0.4, vendor: 'Siemens', model: 'SIMATIC PCS 7 ES V9.1', abbr: 'PES', fw: ['V9.0', 'V9.1 SP1', 'V9.1 SP2'], protocols: ['S7comm', 'OPC UA'], zone: 'API synthesis (PCS 7)', consequence: 5, consequenceText: 'Can change reactor control logic and interlocks' },
    { name: 'Environmental monitoring server (viewLinc)', level: 'L3', kinds: ['biologics', 'aseptic', 'fillfinish'], share: 0.25, vendor: 'Vaisala', model: 'viewLinc 5.1', abbr: 'EMS', fw: ['4.3', '5.0', '5.1'], protocols: ['HTTPS', 'Modbus/TCP'], zone: 'Cleanroom HVAC & EMS', consequence: 4, consequenceText: 'Cleanroom excursion records that QA needs for batch release' },
    { name: 'LIMS instrument interface (LabWare)', level: 'L3', kinds: ['api', 'biologics', 'fillfinish'], share: 0.3, vendor: 'LabWare', model: 'LIMS 8 instrument gateway', abbr: 'LIM', fw: ['7.2', '8.0', '8.1'], protocols: ['SMB', 'HTTPS'], zone: 'MES & batch records', consequence: 4, consequenceText: 'Release test results and their audit trail' },
    { name: 'Serialisation site server (L3)', level: 'L3', kinds: ['packaging'], share: 0.3, vendor: 'Antares Vision', model: 'ATSfour site manager', abbr: 'SRS', fw: ['4.1', '4.3', '4.4'], protocols: ['HTTPS', 'OPC UA'], zone: 'Serialisation & packaging', consequence: 4, consequenceText: 'EU FMD and DSCSA serial numbers and aggregation hierarchy' },
    { name: 'DCS operator station (DeltaV)', level: 'L2', kinds: ['biologics'], share: 1.2, vendor: 'Emerson', model: 'DeltaV Operate', abbr: 'DVO', fw: ['14.3', '14.LTS', '15.LTS'], protocols: ['OPC DA (DCOM)'], zone: 'Upstream & downstream (DeltaV)', consequence: 4, consequenceText: 'Operator view and control of culture and purification' },
    { name: 'DCS operator station (PCS 7)', level: 'L2', kinds: ['api'], share: 1, vendor: 'Siemens', model: 'SIMATIC PCS 7 OS V9.1', abbr: 'POS', fw: ['V9.0', 'V9.1 SP1', 'V9.1 SP2'], protocols: ['S7comm'], zone: 'API synthesis (PCS 7)', consequence: 4, consequenceText: 'Operator view and control of reactors and dryers' },
    { name: 'MES terminal (PAS-X)', level: 'L2', kinds: ['api', 'biologics', 'aseptic', 'fillfinish', 'packaging'], share: 2.4, vendor: 'Körber', model: 'PAS-X shop-floor client (Windows 10 LTSC)', abbr: 'MET', fw: ['1809', '21H2', '21H2 CU'], protocols: ['HTTPS', 'SMB'], zone: 'MES & batch records', consequence: 3, consequenceText: 'Operators record batch steps and sign them (Part 11)' },
    { name: 'Cleanroom HVAC / BMS controller', level: 'L2', kinds: ['api', 'biologics', 'aseptic', 'fillfinish', 'packaging'], share: 2.6, vendor: 'Siemens', model: 'Desigo PXC7', abbr: 'BMS', fw: ['6.0', '7.0', '7.1'], protocols: ['BACnet/IP'], zone: 'Cleanroom HVAC & EMS', consequence: 5, consequenceText: 'Pressure cascade and air changes in grade A/B rooms' },
    { name: 'Serialisation line controller', level: 'L2', kinds: ['packaging'], share: 2, vendor: 'Antares Vision', model: 'Line controller (L2)', abbr: 'SER', fw: ['3.6', '3.8', '4.0'], protocols: ['OPC UA', 'PROFINET'], zone: 'Serialisation & packaging', consequence: 4, consequenceText: 'Code printing, verification and case aggregation' },
    { name: 'Bioreactor controller (2,000 L single-use)', level: 'L1', kinds: ['biologics'], share: 1.6, vendor: 'Thermo Fisher Scientific', model: 'HyPerforma DynaDrive 2000 L (DeltaV PK)', abbr: 'BIO', fw: ['1.4', '1.6', '1.7'], protocols: ['PROFINET', 'OPC UA'], zone: 'Upstream & downstream (DeltaV)', consequence: 5, consequenceText: 'Culture conditions on a batch worth millions' },
    { name: 'Chromatography skid', level: 'L1', kinds: ['biologics'], share: 1.2, vendor: 'Cytiva', model: 'ÄKTA process (UNICORN 7)', abbr: 'CHR', fw: ['7.6', '7.8', '7.9'], protocols: ['OPC UA', 'PROFINET'], zone: 'Upstream & downstream (DeltaV)', consequence: 4, consequenceText: 'Purification yield and product quality' },
    { name: 'Reactor & dryer controller (PCS 7 AS)', level: 'L1', kinds: ['api'], share: 2, vendor: 'Siemens', model: 'SIMATIC S7-410-5H', abbr: 'REA', fw: ['8.1', '8.2', '10.1'], protocols: ['S7comm', 'PROFINET'], zone: 'API synthesis (PCS 7)', consequence: 5, consequenceText: 'Exothermic reaction control and pressure-relief interlocks' },
    { name: 'CIP/SIP skid PLC', level: 'L1', kinds: ['api', 'biologics', 'fillfinish'], share: 1.6, vendor: 'Rockwell Automation', model: 'CompactLogix 5380', abbr: 'CIP', fw: ['32.11', '33.12', '35.11'], protocols: ['EtherNet/IP'], zone: 'Clean utilities (CIP/SIP)', consequence: 4, consequenceText: 'Cleaning and sterilisation of product-contact equipment' },
    { name: 'Aseptic filling isolator PLC', level: 'L1', kinds: ['aseptic', 'fillfinish'], share: 0.8, vendor: 'Syntegon', model: 'Isolator & filling line (S7-1500F)', abbr: 'FIL', fw: ['2.9', '3.0', '3.1'], protocols: ['PROFINET'], zone: 'Aseptic filling', consequence: 5, consequenceText: 'Grade A environment and fill accuracy (sterility assurance)' },
    { name: 'Lyophiliser PLC', level: 'L1', kinds: ['aseptic', 'fillfinish'], share: 0.6, vendor: 'IMA Life', model: 'LYOMAX (S7-1500 control)', abbr: 'LYO', fw: ['2.8', '2.9', '3.0'], protocols: ['PROFINET', 'S7comm'], zone: 'Fill-finish & lyophilisation', consequence: 5, consequenceText: 'Freeze-drying cycle; an interrupted cycle loses the batch' },
    { name: 'Autoclave controller', level: 'L1', kinds: ['fillfinish', 'aseptic'], share: 0.4, vendor: 'Getinge', model: 'GSS67 (PACS 3500)', abbr: 'AUT', fw: ['3.2', '3.4', '3.5'], protocols: ['Modbus/TCP'], zone: 'Fill-finish & lyophilisation', consequence: 4, consequenceText: 'Sterilisation cycles for components and garments' },
    { name: 'Packaging line PLC', level: 'L1', kinds: ['packaging'], share: 2.4, vendor: 'Siemens', model: 'S7-1515', abbr: 'PKG', fw: ['2.8', '2.9', '3.0', '3.1'], protocols: ['S7comm', 'PROFINET'], zone: 'Serialisation & packaging', consequence: 3, consequenceText: 'Cartoner, labeller and case packer motion' },
    { name: 'Field instruments (pH, DO, temperature)', level: 'L0', kinds: ['api', 'biologics'], share: 14, vendor: 'Endress+Hauser', model: 'Liquiline / iTEMP (PROFINET)', abbr: 'FLD', fw: ['1.4', '1.6', '1.8'], protocols: ['PROFINET'], zone: 'Upstream & downstream (DeltaV)', consequence: 3, consequenceText: 'Measured values that steer the process' },
    { name: 'Cleanroom environmental sensors', level: 'L0', kinds: ['biologics', 'aseptic', 'fillfinish'], share: 6, vendor: 'Vaisala', model: 'RFL100 / HMP110 probes', abbr: 'ENV', fw: ['1.2', '1.3', '1.4'], protocols: ['Modbus/TCP'], zone: 'Cleanroom HVAC & EMS', consequence: 3, consequenceText: 'Missed excursions in grade A/B rooms' },
    { name: 'Print-and-verify camera', level: 'L0', kinds: ['packaging'], share: 5, vendor: 'Cognex', model: 'DataMan 470', abbr: 'CAM', fw: ['6.1', '6.3', '6.4'], protocols: ['EtherNet/IP'], zone: 'Serialisation & packaging', consequence: 2, consequenceText: 'Unreadable or duplicate serial codes reach the market' },
    { name: 'Remote I/O', level: 'L0', kinds: ['api', 'biologics', 'aseptic', 'fillfinish'], share: 6, vendor: 'Siemens', model: 'ET 200SP', abbr: 'IO', fw: ['4.1', '4.2', '4.5'], protocols: ['PROFINET'], zone: 'Clean utilities (CIP/SIP)', consequence: 3, consequenceText: 'Valve and sensor signals' },
  ],
  sghospital: [
    { name: 'HealthShare interface engine', level: 'L4', kinds: ['hospital', 'specialist', 'daysurg', 'labimg'], share: 0.25, vendor: 'InterSystems', model: 'HealthShare HealthConnect 2024.1', abbr: 'HSE', fw: ['2022.1', '2023.1', '2024.1'], protocols: ['HL7 v2', 'FHIR'], zone: 'Clinical IT (TrakCare)', consequence: 3, consequenceText: 'TrakCare orders and results stop reaching devices' },
    { name: 'Biomed jump host', level: 'L3.5', kinds: ['hospital', 'specialist', 'daysurg', 'labimg'], share: 0.2, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['RDP'], zone: 'Medical device DMZ', consequence: 4, consequenceText: 'Gateway into pump, monitor and imaging networks' },
    { name: 'Passive collector', level: 'L3.5', kinds: ['hospital', 'specialist', 'daysurg', 'labimg'], share: 0.12, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'Medical device DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'Infusion pump server (Alaris)', level: 'L3', kinds: ['hospital', 'specialist', 'daysurg'], share: 0.06, vendor: 'BD', model: 'Alaris Systems Manager 12', abbr: 'ASM', fw: ['4.33', '12.1', '12.3'], protocols: ['Proprietary pump telemetry', 'HL7 v2'], zone: 'Infusion', consequence: 4, consequenceText: 'Drug library and pump programming for every ward' },
    { name: 'Central monitoring station (PIC iX)', level: 'L3', kinds: ['hospital', 'specialist', 'daysurg'], share: 0.08, vendor: 'Philips', model: 'PIC iX 4.2', abbr: 'PIC', fw: ['C.03', '4.1', '4.2'], protocols: ['HL7 v2', 'IEEE 11073'], zone: 'Patient monitoring', consequence: 5, consequenceText: 'Central alarm watch for ICU, high dependency and recovery' },
    { name: 'PACS server', level: 'L3', kinds: ['hospital', 'labimg'], share: 0.1, vendor: 'Philips', model: 'Vue PACS 12.2', abbr: 'PACS', fw: ['12.0', '12.1', '12.2'], protocols: ['DICOM', 'HL7 v2'], zone: 'Imaging', consequence: 3, consequenceText: 'Images unavailable to radiologists and A&E' },
    { name: 'Laboratory information system', level: 'L3', kinds: ['labimg', 'hospital'], share: 0.06, vendor: 'Roche', model: 'cobas infinity laboratory solution', abbr: 'LIS', fw: ['3.02', '3.03', '3.04'], protocols: ['HL7 v2', 'ASTM'], zone: 'Laboratory', consequence: 4, consequenceText: 'Results delayed, or filed to the wrong patient' },
    { name: 'Oncology information system (ARIA)', level: 'L3', kinds: ['specialist'], share: 0.15, vendor: 'Varian', model: 'ARIA OIS 16.1', abbr: 'ARIA', fw: ['15.6', '16.0', '16.1'], protocols: ['DICOM', 'HL7 v2'], zone: 'Radiation oncology', consequence: 5, consequenceText: 'Treatment plans and delivered-dose records' },
    { name: 'Nurse call server', level: 'L3', kinds: ['hospital', 'specialist', 'daysurg'], share: 0.08, vendor: 'Ascom', model: 'Telligence / Unite 7', abbr: 'NCS', fw: ['6.6', '7.0', '7.2'], protocols: ['HL7 v2', 'SIP'], zone: 'Nurse call', consequence: 4, consequenceText: 'Patients cannot summon help' },
    { name: 'MRI console (Windows 7)', level: 'L2', kinds: ['labimg', 'hospital'], share: 0.12, vendor: 'Siemens Healthineers', model: 'MAGNETOM syngo MR VE11 console', abbr: 'MRW', fw: ['VE11C', 'VE11E', 'XA60'], protocols: ['DICOM', 'SMB'], zone: 'Imaging', consequence: 3, consequenceText: 'Scans cancelled; legacy OS waits on the OEM software upgrade' },
    { name: 'CT console', level: 'L2', kinds: ['hospital', 'labimg'], share: 0.18, vendor: 'GE HealthCare', model: 'Revolution CT console', abbr: 'CTW', fw: ['21MW', '22MW', '24MW'], protocols: ['DICOM'], zone: 'Imaging', consequence: 3, consequenceText: 'Stroke and trauma scans delayed' },
    { name: 'BMS controller (theatres & isolation)', level: 'L2', kinds: ['hospital', 'specialist', 'daysurg', 'labimg'], share: 1, vendor: 'Honeywell', model: 'WEBs-N4 JACE 8000', abbr: 'BMS', fw: ['4.10', '4.12', '4.14'], protocols: ['BACnet/IP'], zone: 'Building & environment', consequence: 5, consequenceText: 'Theatre air changes and isolation-room pressure' },
    { name: 'Pneumatic tube controller', level: 'L2', kinds: ['hospital', 'labimg'], share: 0.25, vendor: 'Swisslog', model: 'TransLogic Nexus', abbr: 'PTS', fw: ['7.1', '7.2.4', '7.2.5'], protocols: ['Modbus/TCP'], zone: 'Building & environment', consequence: 3, consequenceText: 'Specimens and drugs stop moving between wards and lab' },
    { name: 'Nurse call console', level: 'L2', kinds: ['hospital', 'specialist', 'daysurg'], share: 1.6, vendor: 'Ascom', model: 'Telligence station', abbr: 'NCC', fw: ['6.6', '7.0', '7.2'], protocols: ['SIP'], zone: 'Nurse call', consequence: 3, consequenceText: 'Calls and alarms missing at the nurses’ station' },
    { name: 'Infusion pump (BD Alaris)', level: 'L1', kinds: ['hospital', 'specialist', 'daysurg'], share: 18, vendor: 'BD', model: 'Alaris 8015 PC unit', abbr: 'INF', fw: ['9.19', '12.1.2', '12.3.1'], protocols: ['Proprietary pump telemetry'], zone: 'Infusion', consequence: 5, consequenceText: 'Drug delivery to the patient' },
    { name: 'Infusion pump (Fresenius Kabi Agilia)', level: 'L1', kinds: ['hospital', 'specialist'], share: 9, vendor: 'Fresenius Kabi', model: 'Agilia VP MC (Vigilant)', abbr: 'AGI', fw: ['3.2', '3.4', '3.6'], protocols: ['Proprietary pump telemetry'], zone: 'Infusion', consequence: 5, consequenceText: 'Drug delivery in oncology and paediatrics' },
    { name: 'Patient monitor (IntelliVue)', level: 'L1', kinds: ['hospital', 'specialist', 'daysurg'], share: 12, vendor: 'Philips', model: 'IntelliVue MX750', abbr: 'MON', fw: ['M.00', 'N.01', 'P.01'], protocols: ['IEEE 11073', 'HL7 v2'], zone: 'Patient monitoring', consequence: 5, consequenceText: 'Vital-sign alarms at the bedside' },
    { name: 'Ventilator', level: 'L1', kinds: ['hospital'], share: 1.4, vendor: 'Dräger', model: 'Evita V800', abbr: 'VEN', fw: ['2.4', '2.5', '2.6'], protocols: ['HL7 v2'], zone: 'Critical care', consequence: 5, consequenceText: 'Life support in ICU' },
    { name: 'Anaesthesia workstation', level: 'L1', kinds: ['hospital', 'daysurg'], share: 0.8, vendor: 'Dräger', model: 'Perseus A500', abbr: 'ANE', fw: ['2.2', '2.4', '2.5'], protocols: ['HL7 v2'], zone: 'Surgical', consequence: 5, consequenceText: 'Anaesthetic delivery in theatre' },
    { name: 'CT scanner (GE Revolution)', level: 'L1', kinds: ['hospital', 'labimg'], share: 0.2, vendor: 'GE HealthCare', model: 'Revolution Apex', abbr: 'CT', fw: ['21MW', '22MW', '24MW'], protocols: ['DICOM'], zone: 'Imaging', consequence: 4, consequenceText: 'A&E stroke and trauma imaging' },
    { name: 'MRI scanner (Siemens MAGNETOM)', level: 'L1', kinds: ['hospital', 'labimg'], share: 0.12, vendor: 'Siemens Healthineers', model: 'MAGNETOM Skyra', abbr: 'MRI', fw: ['VE11C', 'VE11E', 'XA60'], protocols: ['DICOM'], zone: 'Imaging', consequence: 4, consequenceText: 'Imaging capacity loss' },
    { name: 'Linear accelerator (Varian TrueBeam)', level: 'L1', kinds: ['specialist'], share: 0.4, vendor: 'Varian', model: 'TrueBeam 4.1', abbr: 'LIN', fw: ['2.7', '3.0', '4.1'], protocols: ['DICOM'], zone: 'Radiation oncology', consequence: 5, consequenceText: 'Radiation dose delivery' },
    { name: 'Lab analyser (Roche cobas)', level: 'L1', kinds: ['labimg', 'hospital'], share: 1, vendor: 'Roche', model: 'cobas pro integrated solutions', abbr: 'LAB', fw: ['01-04', '01-06', '02-01'], protocols: ['HL7 v2', 'ASTM'], zone: 'Laboratory', consequence: 3, consequenceText: 'Results delayed or wrong' },
    { name: 'Medical gas alarm panel', level: 'L1', kinds: ['hospital', 'specialist', 'daysurg'], share: 0.2, vendor: 'Amico', model: 'Alert-3 master alarm', abbr: 'GAS', fw: ['3.1', '3.4', '3.5'], protocols: ['Modbus/TCP', 'BACnet/IP'], zone: 'Building & environment', consequence: 5, consequenceText: 'Oxygen, medical air and vacuum supply alarms' },
    { name: 'Patient telemetry transmitter', level: 'L0', kinds: ['hospital'], share: 7, vendor: 'Philips', model: 'IntelliVue MX40', abbr: 'TEL', fw: ['B.05', 'B.06', 'C.01'], protocols: ['Proprietary (WMTS)'], zone: 'Patient monitoring', consequence: 4, consequenceText: 'Ambulatory cardiac monitoring on the wards' },
    { name: 'Cold-chain sensor', level: 'L0', kinds: ['hospital', 'labimg'], share: 2.4, vendor: 'Vaisala', model: 'RFL100 data logger', abbr: 'TMP', fw: ['1.2', '1.3', '1.4'], protocols: ['MQTT'], zone: 'Laboratory', consequence: 2, consequenceText: 'Blood bank, reagent and vaccine temperatures' },
  ],
  studio: [
    { name: 'StarPass ticketing gateway', level: 'L4', kinds: ['park', 'waterpark', 'resort'], share: 0.2, vendor: 'accesso', model: 'Passport gateway (PARKS-TKT-GW)', abbr: 'TKT', fw: ['2024.2', '2025.1', '2025.3'], protocols: ['HTTPS'], zone: 'Park operations (ticketing)', consequence: 3, consequenceText: 'Gate entry and ride reservations stop' },
    { name: 'Ride & show DMZ jump host', level: 'L3.5', kinds: ['park', 'waterpark', 'resort', 'liveevents'], share: 0.2, vendor: 'Microsoft', model: 'Windows Server 2022', abbr: 'JMP', fw: ['21H2', '22H2', '23H2'], protocols: ['RDP'], zone: 'Ride & show DMZ', consequence: 4, consequenceText: 'Brokered path into ride and show networks' },
    { name: 'Passive sensor / collector', level: 'L3.5', kinds: ['park', 'waterpark', 'resort', 'liveevents'], share: 0.15, vendor: 'HexaShield', model: 'Edge 1.9', abbr: 'EDG', fw: ['1.8.7', '1.9.1', '1.9.2'], protocols: [], zone: 'Ride & show DMZ', consequence: 1, consequenceText: 'Loss of visibility only (passive)' },
    { name: 'Ride control engineering workstation', level: 'L3', kinds: ['park', 'waterpark'], share: 0.5, vendor: 'Siemens', model: 'TIA Portal V18 + Safety Advanced', abbr: 'EWS', fw: ['V16', 'V17', 'V18'], protocols: ['S7comm', 'PROFINET / PROFIsafe'], zone: 'Ride control', consequence: 5, consequenceText: 'Can download logic to safety-rated ride controllers' },
    { name: 'Ride monitoring server', level: 'L3', kinds: ['park'], share: 0.3, vendor: 'Siemens', model: 'WinCC Unified V18', abbr: 'RMS', fw: ['V17', 'V18', 'V19'], protocols: ['OPC UA', 'S7comm'], zone: 'Ride control', consequence: 4, consequenceText: 'Ride availability, fault history and dispatch logs' },
    { name: 'Show control server', level: 'L3', kinds: ['park', 'liveevents'], share: 0.5, vendor: 'Medialon', model: 'Showmaster Pro', abbr: 'SHW', fw: ['7.6', '7.8', '8.0'], protocols: ['Art-Net / sACN', 'Modbus/TCP'], zone: 'Show control & media', consequence: 4, consequenceText: 'Cue timing for effects close to guests' },
    { name: 'Media server (projection & LED)', level: 'L3', kinds: ['park', 'liveevents'], share: 1, vendor: 'disguise', model: 'vx 4+', abbr: 'MED', fw: ['r25', 'r26', 'r27'], protocols: ['Art-Net / sACN', 'SMPTE ST 2110'], zone: 'Show control & media', consequence: 3, consequenceText: 'Projection mapping and LED content on attractions' },
    { name: 'BMS server', level: 'L3', kinds: ['resort', 'park'], share: 0.3, vendor: 'Johnson Controls', model: 'Metasys ADX 13', abbr: 'BMSV', fw: ['11.0', '12.0', '13.0'], protocols: ['BACnet/IP'], zone: 'Building & life safety', consequence: 3, consequenceText: 'Central plant, queue cooling and hotel HVAC' },
    { name: 'Ride control HMI', level: 'L2', kinds: ['park', 'waterpark'], share: 2.2, vendor: 'Siemens', model: 'SIMATIC Unified Comfort 15"', abbr: 'HMI', fw: ['17.0', '18.0', '19.0'], protocols: ['S7comm', 'PROFINET / PROFIsafe'], zone: 'Ride control', consequence: 4, consequenceText: 'Operator dispatch and e-stop status' },
    { name: 'Animatronic figure controller', level: 'L2', kinds: ['park'], share: 1.6, vendor: 'Beckhoff', model: 'CX2040 (TwinCAT 3)', abbr: 'ANI', fw: ['3.1.4022', '3.1.4024', '3.1.4026'], protocols: ['EtherCAT', 'Modbus/TCP'], zone: 'Show control & media', consequence: 4, consequenceText: 'Figure motion inside reach envelopes near guests' },
    { name: 'Park BMS controller', level: 'L2', kinds: ['resort', 'park', 'waterpark'], share: 3, vendor: 'Johnson Controls', model: 'Metasys SNC', abbr: 'BMS', fw: ['11.0', '12.0', '13.0'], protocols: ['BACnet/IP'], zone: 'Building & life safety', consequence: 3, consequenceText: 'Queue-line cooling, hotel plant and lighting' },
    { name: 'Turnstile & StarPass gate controller', level: 'L2', kinds: ['park', 'waterpark', 'resort'], share: 2.4, vendor: 'Axess', model: 'Smart Gate NG', abbr: 'GATE', fw: ['5.2', '5.4', '5.6'], protocols: ['HTTP', 'Modbus/TCP'], zone: 'Guest entry', consequence: 2, consequenceText: 'Entry throughput and wearable validation' },
    { name: 'ST 2110 live events router', level: 'L2', kinds: ['liveevents'], share: 0.6, vendor: 'Evertz', model: 'EXE-VSR IP router', abbr: 'RTR', fw: ['1.8', '2.0', '2.2'], protocols: ['SMPTE ST 2110', 'PTP (IEEE 1588)'], zone: 'Live events', consequence: 4, consequenceText: 'Every video and audio path for the night-time show' },
    { name: 'Ride control PLC (safety-rated)', level: 'L1', kinds: ['park', 'waterpark'], share: 3.4, vendor: 'Intamin', model: 'Ride control cabinet (Siemens S7-1518F)', abbr: 'RCP', fw: ['2.8', '2.9', '3.0', '3.1'], protocols: ['PROFINET / PROFIsafe', 'S7comm'], zone: 'Ride control', consequence: 5, consequenceText: 'Vehicle dispatch, block zones and restraints with guests on board' },
    { name: 'Water ride pump VFD', level: 'L1', kinds: ['waterpark', 'park'], share: 2, vendor: 'ABB', model: 'ACS880 drive', abbr: 'VFD', fw: ['3.2', '3.4', '3.5'], protocols: ['Modbus/TCP', 'EtherNet/IP'], zone: 'Water rides', consequence: 4, consequenceText: 'Flow on flumes and rapids rides' },
    { name: 'Fire alarm panel', level: 'L1', kinds: ['resort', 'park', 'waterpark', 'liveevents'], share: 1, vendor: 'Honeywell', model: 'Notifier NFS2-3030', abbr: 'FIRE', fw: ['20.0', '21.0', '22.1'], protocols: ['BACnet/IP'], zone: 'Building & life safety', consequence: 5, consequenceText: 'Evacuation of hotels, queues and show buildings' },
    { name: 'Pyrotechnic firing system', level: 'L1', kinds: ['liveevents'], share: 0.4, vendor: 'FireOne', model: 'XL7 firing system', abbr: 'PYR', fw: ['7.2', '7.4', '7.5'], protocols: ['Proprietary firing protocol'], zone: 'Live events', consequence: 5, consequenceText: 'Pyrotechnic cues near crowds and performers' },
    { name: 'Lighting & effects DMX gateway', level: 'L1', kinds: ['liveevents', 'park'], share: 1.6, vendor: 'ETC', model: 'Response Mk2 gateway', abbr: 'DMX', fw: ['3.1', '3.3', '3.4'], protocols: ['Art-Net / sACN'], zone: 'Show control & media', consequence: 3, consequenceText: 'Lighting, haze and water-effect cues' },
    { name: 'Ride sensors & safety I/O', level: 'L0', kinds: ['park', 'waterpark'], share: 22, vendor: 'Siemens', model: 'ET 200SP F', abbr: 'IO', fw: ['4.1', '4.2', '4.5'], protocols: ['PROFINET / PROFIsafe'], zone: 'Ride control', consequence: 4, consequenceText: 'Proximity, restraint and block sensors' },
    { name: 'Projection & LED fixtures', level: 'L0', kinds: ['park', 'liveevents'], share: 8, vendor: 'Christie Digital', model: 'Griffyn 4K35-RGB', abbr: 'FIX', fw: ['1.4', '1.6', '2.0'], protocols: ['Art-Net / sACN'], zone: 'Show control & media', consequence: 2, consequenceText: 'Show image on screens and facades' },
    { name: 'Hotel room & IoT controls', level: 'L0', kinds: ['resort'], share: 14, vendor: 'Honeywell', model: 'INNCOM e7 room controller', abbr: 'IOT', fw: ['3.6', '3.8', '4.0'], protocols: ['BACnet/IP'], zone: 'Building & life safety', consequence: 1, consequenceText: 'Room comfort and occupancy' },
  ],
};

export function assetTypes(c: CustomerProfile): AssetType[] {
  return forCustomer(TYPES, c);
}

/* ------------------------------------------------------------------ */
/* Scope                                                               */
/* ------------------------------------------------------------------ */

export interface OtScope {
  h: ReturnType<typeof headlines>['ot'];
  hasOt: boolean;
  sites: OtSite[];
  siteAssets: Record<string, number>;
  /** Connectors of category OT plus asset-context sources. */
  sources: { name: string; status: CustomerProfile['connectors'][number]['status']; lastSyncMin: number; intervalMin: number; note?: string }[];
}

export function otScope(c: CustomerProfile, tenantId: string): OtScope {
  const h = headlines(c, tenantId).ot;
  const hasOt = h.otAssets > 0;
  let sites = forCustomer(SITES, c).filter((s) => tenantId === 'all' || s.tenantId === tenantId);
  if (!sites.length && hasOt) sites = forCustomer(SITES, c);
  const counts = distribute(h.otAssets, sites.map((s) => s.weight));
  const siteAssets: Record<string, number> = {};
  sites.forEach((s, i) => (siteAssets[s.id] = counts[i]));
  const ids = new Set(sites.map((s) => s.sourceConnector));
  const sources = c.connectors
    .filter((k) => k.category === 'OT' || ids.has(k.id) || k.id === 'c-navis' || k.id === 'c-syslog-fleet')
    .filter((k) => tenantId === 'all' || k.tenants === 'all' || k.tenants.includes(tenantId) || ids.has(k.id))
    .map((k) => ({ name: `${k.vendor === 'HexaShield' || k.vendor === 'Generic' ? '' : `${k.vendor} `}${k.product}`, status: k.status, lastSyncMin: k.lastSyncMin, intervalMin: k.intervalMin, note: k.note }));
  return { h, hasOt, sites, siteAssets, sources };
}

/* ------------------------------------------------------------------ */
/* Vessels                                                             */
/* ------------------------------------------------------------------ */

export interface Vessel {
  name: string;
  code: string;
  cls: string;
  link: string;
  status: 'online' | 'store & forward' | 'out of coverage';
  lastSyncMin: number;
  region: string;
  assets: number;
  alerts: number;
  backlogMb: number;
}
const VESSEL_NAMES = ['Aurora', 'Borealis', 'Meridian', 'Zephyr', 'Solstice', 'Tempest', 'Calypso', 'Orion', 'Vega', 'Altair', 'Polaris', 'Sirius', 'Lyra', 'Nimbus', 'Cirrus', 'Equinox', 'Horizon', 'Mistral', 'Sirocco', 'Monsoon', 'Corona', 'Galene'];
const REGIONS = ['North Sea', 'English Channel', 'Bay of Biscay', 'Western Mediterranean', 'Suez Canal transit', 'Red Sea', 'Arabian Sea', 'Strait of Malacca', 'South China Sea', 'South Atlantic', 'Santos anchorage', 'Rotterdam berth', 'Port Klang berth', 'Indian Ocean', 'Gulf of Aden'];

export function vessels(c: CustomerProfile, fleetAssets: number): Vessel[] {
  if (c.dataKey !== 'maritime') return [];
  const r = rng(`ot-vessels-${c.id}`);
  const counts = distribute(fleetAssets, VESSEL_NAMES.map(() => r.float(0.7, 1.3, 2)));
  const outIdx = new Set([5, 12, 18]);
  return VESSEL_NAMES.map((n, i) => {
    const status: Vessel['status'] = outIdx.has(i) ? 'out of coverage' : r.chance(0.2) ? 'store & forward' : 'online';
    const link = r.weighted<string>([['LEO (Starlink Maritime)', 4], ['VSAT (Inmarsat Fleet Xpress)', 3], ['Dual LEO + VSAT', 3]]);
    return {
      name: `Halcyon ${n}`,
      code: n.slice(0, 3).toUpperCase(),
      cls: r.pick(['14,000 TEU', '11,800 TEU', '8,500 TEU', '15,200 TEU', '4,300 TEU feeder']),
      link: status === 'out of coverage' ? 'VSAT (Inmarsat Fleet Xpress)' : link,
      status,
      lastSyncMin: status === 'online' ? r.int(1, 8) : status === 'store & forward' ? r.int(18, 42) : r.int(190, 840),
      region: status === 'out of coverage' ? r.pick(['South Atlantic', 'Indian Ocean', 'Southern Ocean approach']) : r.pick(REGIONS),
      assets: counts[i],
      alerts: r.int(0, status === 'online' ? 4 : 2),
      backlogMb: status === 'online' ? r.int(0, 12) : status === 'store & forward' ? r.int(40, 220) : r.int(380, 1600),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export interface OtAsset {
  id: string;
  name: string;
  type: string;
  level: PurdueLevel;
  vendor: string;
  model: string;
  firmware: string;
  latestFirmware: string;
  fwBehind: number;
  ip: string;
  mac: string;
  zone: string;
  siteId: string;
  siteName: string;
  vessel?: string;
  protocols: string[];
  lastSeenMin: number;
  cves: string[];
  risk: number;
  sources: string[];
  consequence: number;
  consequenceText: string;
}

const ALL_CVES: CveRef[] = [
  ...ICS_CVES,
  // Real, public embedded / ICS advisories used for sector realism.
  { id: 'CVE-2022-22806', product: 'APC Smart-UPS network management', title: 'TLStorm: TLS authentication bypass', cvss: 9.0, kev: false, epss: 0.04 },
  { id: 'CVE-2020-11896', product: 'Treck TCP/IP stack (embedded)', title: 'Ripple20: IPv4 tunnelling RCE', cvss: 10.0, kev: false, epss: 0.03 },
  { id: 'CVE-2019-12256', product: 'Wind River VxWorks IPnet', title: 'URGENT/11: IP options stack overflow', cvss: 9.8, kev: false, epss: 0.05 },
  { id: 'CVE-2021-22779', product: 'Schneider Modicon / UMAS', title: 'ModiPwn: authentication bypass', cvss: 9.8, kev: false, epss: 0.02 },
  { id: 'CVE-2015-5374', product: 'Siemens SIPROTEC 4 / Compact', title: 'Crafted packet denial of service', cvss: 7.8, kev: false, epss: 0.1 },
  { id: 'CVE-2019-10959', product: 'BD Alaris Gateway Workstation', title: 'Unauthenticated firmware update', cvss: 10.0, kev: false, epss: 0.02 },
  { id: 'CVE-2020-25165', product: 'BD Alaris PC Unit 8015', title: 'Session authentication weakness (denial of service)', cvss: 6.5, kev: false, epss: 0.01 },
  { id: 'CVE-2020-16222', product: 'Philips Patient Information Center iX / IntelliVue', title: 'Improper authentication', cvss: 8.7, kev: false, epss: 0.01 },
  { id: 'CVE-2021-37163', product: 'Swisslog TransLogic Nexus panel', title: '"PwnedPiper" hard-coded credentials', cvss: 9.8, kev: false, epss: 0.02 },
  { id: 'CVE-2020-15782', product: 'Siemens SIMATIC S7-1200 / S7-1500', title: 'Memory protection bypass (code execution)', cvss: 8.1, kev: false, epss: 0.03 },
  // Legacy Windows on imaging consoles and shop-floor stations.
  { id: 'CVE-2019-0708', product: 'Windows 7 / Server 2008 R2 Remote Desktop', title: '"BlueKeep" pre-authentication RDP RCE', cvss: 9.8, kev: true, epss: 0.94 },
  { id: 'CVE-2017-0144', product: 'Windows SMBv1 server', title: '"EternalBlue" SMBv1 remote code execution', cvss: 8.1, kev: true, epss: 0.94 },
  ...CVES.filter((v) => ['CVE-2021-44228', 'CVE-2024-6387', 'CVE-2024-38063', 'CVE-2023-48795', 'CVE-2024-21762'].includes(v.id)),
];
export const OT_CVE_BY_ID: Record<string, CveRef> = Object.fromEntries(ALL_CVES.map((v) => [v.id, v]));

export type PatchState = 'Vendor patch available' | 'Patch needs outage window' | 'No vendor fix' | 'Unpatchable by design (safety case)';
interface VulnMap { cve: string; type: string; reach: 0 | 1 | 2 | 3; patch: PatchState; path: string; controls: string[] }

const VULN_MAP: CustomerMap<VulnMap[]> = {
  maritime: [
    { cve: 'CVE-2022-38465', type: 'STS crane PLC (Siemens S7-1500)', reach: 3, patch: 'Unpatchable by design (safety case)', path: 'Konecranes remote session → HPS-JUMP-OT01 → crane HMI VLAN → PLC', controls: ['Access protection level 3 set', 'PAM-brokered vendor sessions', 'PLC change monitoring (HexaOT)'] },
    { cve: 'CVE-2022-38465', type: 'Engineering workstation', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → OT DMZ → EWS (RDP)', controls: ['EDR on EWS', 'Application allow-listing'] },
    { cve: 'CVE-2023-28489', type: 'Substation RTU', reach: 1, patch: 'Patch needs outage window', path: 'Terminal operations → substation conduit (DNP3)', controls: ['Unidirectional gateway', 'IEC 61850 GOOSE monitoring'] },
    { cve: 'CVE-2015-5374', type: 'Protection relay', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Station bus only; no routed path', controls: ['Physically isolated station bus'] },
    { cve: 'CVE-2023-3595', type: 'AGV vehicle controller', reach: 2, patch: 'Patch needs outage window', path: 'Enterprise IT → OT DMZ → FleetManager → vehicle Wi-Fi', controls: ['Yard Wi-Fi WPA3-Enterprise', 'CIP Security on new vehicles'] },
    { cve: 'CVE-2022-1161', type: 'AGV vehicle controller', reach: 2, patch: 'No vendor fix', path: 'FleetManager → vehicle controllers (EtherNet/IP)', controls: ['Logic change detection', 'Key switch in RUN'] },
    { cve: 'CVE-2024-6242', type: 'AGV vehicle controller', reach: 1, patch: 'Vendor patch available', path: 'Adjacent: AGV maintenance VLAN', controls: ['Trusted slot disabled'] },
    { cve: 'CVE-2021-22681', type: 'Engineering workstation', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → OT DMZ → EWS', controls: ['Studio 5000 project encryption'] },
    { cve: 'CVE-2023-6448', type: 'Ballast water treatment PLC', reach: 3, patch: 'Vendor patch available', path: 'LEO terminal → vessel LAN → BWT PLC (Modbus/TCP, default password)', controls: ['Vessel firewall rule (partial)'] },
    { cve: 'CVE-2024-21762', type: 'Vessel firewall', reach: 3, patch: 'Vendor patch available', path: 'Internet (VSAT/LEO public IP) → SSL VPN', controls: ['SSL VPN disabled on 14 of 22 vessels'] },
    { cve: 'CVE-2024-6387', type: 'Process historian', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → OT DMZ → historian replica', controls: ['SSH restricted to jump host'] },
    { cve: 'CVE-2021-44228', type: 'TOS interface server (Navis N4)', reach: 3, patch: 'Vendor patch available', path: 'Booking portal → TOS integration bus', controls: ['WAF virtual patch'] },
    { cve: 'CVE-2024-38063', type: 'OT jump host', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → OT DMZ (IPv6 enabled)', controls: ['IPv6 disabled on 3 of 4 hosts'] },
    { cve: 'CVE-2019-12256', type: 'Reefer monitoring gateway', reach: 1, patch: 'No vendor fix', path: 'Terminal operations → reefer racks', controls: ['Reefer VLAN ACLs'] },
    { cve: 'CVE-2020-11896', type: 'Gate OCR lane controller', reach: 3, patch: 'Patch needs outage window', path: 'Enterprise IT → gate lanes directly (SMB image pull)', controls: ['None verified'] },
    { cve: 'CVE-2019-12256', type: 'ECDIS (bridge)', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'Crew LAN → USB chart updates', controls: ['Type-approved configuration', 'USB kiosk scanning'] },
    { cve: 'CVE-2023-48795', type: 'Cargo control HMI', reach: 1, patch: 'Vendor patch available', path: 'Vessel DMZ → cargo network', controls: ['Kongsberg remote access via broker'] },
    { cve: 'CVE-2020-11896', type: 'Engine control (K-Chief)', reach: 2, patch: 'Unpatchable by design (safety case)', path: 'Kongsberg remote diagnostics (LEO) → engine network', controls: ['Class-approved configuration', 'Session recording'] },
  ],
  finserv: [
    { cve: 'CVE-2022-22806', type: 'UPS (Eaton 9395)', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → facilities DMZ → UPS network cards (SNMP/HTTPS)', controls: ['Management VLAN ACLs'] },
    { cve: 'CVE-2020-11896', type: 'UPS (Eaton 9395)', reach: 2, patch: 'Patch needs outage window', path: 'Facilities DMZ → UPS network cards', controls: ['Network card firmware pinning'] },
    { cve: 'CVE-2021-22779', type: 'BMS controller (EcoStruxure)', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → BMS server → AS-P controllers', controls: ['BMS jump host with MFA'] },
    { cve: 'CVE-2023-1133', type: 'DCIM server', reach: 3, patch: 'Vendor patch available', path: 'Corporate IT (flat to DCIM)', controls: ['EDR on DCIM server'] },
    { cve: 'CVE-2023-6448', type: 'Generator controller', reach: 1, patch: 'Vendor patch available', path: 'BMS & DCIM → generator Modbus gateway', controls: ['Default credentials changed (3 of 4 sites)'] },
    { cve: 'CVE-2019-12256', type: 'Fire suppression panel', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Isolated fire network', controls: ['Physically isolated', 'Monitored by alarm receiving centre'] },
    { cve: 'CVE-2019-12256', type: 'CRAC unit', reach: 3, patch: 'No vendor fix', path: 'Vertiv cellular modem → CRAC controller (vendor remote access)', controls: ['Vendor contract requires notification'] },
    { cve: 'CVE-2024-6387', type: 'BMS server', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → facilities DMZ', controls: ['SSH limited to jump host'] },
    { cve: 'CVE-2021-44228', type: 'CCTV NVR', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → NVR web client', controls: ['WAF on NVR portal'] },
    { cve: 'CVE-2024-38063', type: 'ATM (NCR SelfServ)', reach: 2, patch: 'Patch needs outage window', path: 'Branch LAN → ATM network (IPv6)', controls: ['CrowdStrike Falcon on ATMs', 'Application allow-listing'] },
    { cve: 'CVE-2023-48795', type: 'Physical access controller', reach: 1, patch: 'Vendor patch available', path: 'Access control server → controllers', controls: ['Controller VLAN'] },
    { cve: 'CVE-2020-11896', type: 'Intelligent PDU', reach: 1, patch: 'No vendor fix', path: 'DCIM → PDU management network', controls: ['Switching disabled on critical racks'] },
  ],
  media: [
    { cve: 'CVE-2021-44228', type: 'NMOS registry & orchestration', reach: 3, patch: 'Vendor patch available', path: 'Grass Valley support tunnel → GV Orbit (bypasses DMZ)', controls: ['JNDI lookups disabled by config'] },
    { cve: 'CVE-2024-6387', type: 'Playout server (iTX)', reach: 2, patch: 'Patch needs outage window', path: 'Corporate IT → broadcast DMZ → playout', controls: ['SSH limited to jump host'] },
    { cve: 'CVE-2019-12256', type: 'Vision mixer', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'ST 2110 control VLAN', controls: ['Control VLAN isolation', 'Ember+ allow-list'] },
    { cve: 'CVE-2019-12256', type: 'Comms matrix (intercom)', reach: 1, patch: 'No vendor fix', path: 'ST 2110 control VLAN', controls: ['Control VLAN isolation'] },
    { cve: 'CVE-2020-11896', type: 'PTP grandmaster clock', reach: 2, patch: 'Patch needs outage window', path: 'Producer laptop on 2110 control VLAN → PTP management', controls: ['Boundary clocks on spine'] },
    { cve: 'CVE-2020-11896', type: 'Encoder (contribution)', reach: 3, patch: 'Vendor patch available', path: 'Internet (contribution return path) → encoder management', controls: ['Cloudflare Access on management UI'] },
    { cve: 'CVE-2023-1133', type: 'Studio BMS', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → BMS head-end', controls: ['None verified'] },
    { cve: 'CVE-2024-38063', type: 'Broadcast DMZ jump host', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → broadcast DMZ', controls: ['IPv6 disabled'] },
    { cve: 'CVE-2023-48795', type: 'SMPTE 2110 IP router', reach: 1, patch: 'Vendor patch available', path: 'Network management VLAN', controls: ['TACACS+ with MFA'] },
    { cve: 'CVE-2023-6448', type: 'UPS & power distribution', reach: 1, patch: 'Vendor patch available', path: 'BMS → UPS management', controls: ['Default credentials rotated'] },
  ],
  healthcare: [
    { cve: 'CVE-2019-10959', type: 'Infusion pump server (Alaris)', reach: 2, patch: 'Vendor patch available', path: 'Clinical IT → medical device DMZ → pump server', controls: ['Gateway firmware 1.6.1 on most units', 'Biomed jump host with MFA'] },
    { cve: 'CVE-2020-25165', type: 'Infusion pump (BD Alaris)', reach: 1, patch: 'Patch needs outage window', path: 'Infusion SSID → pump network stack', controls: ['Pump SSID isolated (WPA2-Enterprise)', 'MAC allow-list'] },
    { cve: 'CVE-2020-16222', type: 'Patient Information Center (PIC iX)', reach: 2, patch: 'Vendor patch available', path: 'Clinical network → PIC iX (HL7 export)', controls: ['HL7 listener allow-list'] },
    { cve: 'CVE-2020-16222', type: 'Patient monitor (IntelliVue)', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'Monitoring VLAN only', controls: ['Monitoring VLAN isolation', 'FDA-cleared configuration'] },
    { cve: 'CVE-2019-12256', type: 'Anaesthesia workstation', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Standalone in theatre; HL7 via serial gateway', controls: ['No routed path', 'OEM service only'] },
    { cve: 'CVE-2021-37163', type: 'Pneumatic tube controller', reach: 2, patch: 'Vendor patch available', path: 'Facilities IT → tube system head-end → stations', controls: ['Facilities VLAN ACLs'] },
    { cve: 'CVE-2024-6387', type: 'PACS / VNA server', reach: 2, patch: 'Vendor patch available', path: 'Clinical IT → PACS (SSH)', controls: ['SSH limited to biomed jump host'] },
    { cve: 'CVE-2021-44228', type: 'Nurse call server', reach: 2, patch: 'Vendor patch available', path: 'Clinical IT → nurse call web console', controls: ['JNDI lookups disabled by config'] },
    { cve: 'CVE-2024-38063', type: 'Modality workstation (CT console)', reach: 1, patch: 'Patch needs outage window', path: 'Imaging VLAN (IPv6 enabled by OEM image)', controls: ['IPv6 filtered at imaging firewall'] },
    { cve: 'CVE-2024-38063', type: 'Pharmacy dispensing cabinet', reach: 2, patch: 'Vendor patch available', path: 'Clinical network → cabinets (Windows embedded)', controls: ['Omnicell-managed patching'] },
    { cve: 'CVE-2023-48795', type: 'BMS controller (OR & isolation)', reach: 1, patch: 'Vendor patch available', path: 'Facilities IT → BMS head-end → NAEs', controls: ['BMS jump host'] },
    { cve: 'CVE-2020-11896', type: 'Lab analyser', reach: 1, patch: 'No vendor fix', path: 'Lab network → analyser management port', controls: ['Lab VLAN ACLs'] },
  ],
  automotive: [
    { cve: 'CVE-2022-38465', type: 'Body-shop safety PLC', reach: 2, patch: 'Patch needs outage window', path: 'Plant DMZ → engineering VLAN → cell network', controls: ['Access protection level 3', 'PLC change monitoring (HexaOT)'] },
    { cve: 'CVE-2020-15782', type: 'Press line PLC', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'Press line network only', controls: ['Key switch in RUN', 'Safety re-validation required for change'] },
    { cve: 'CVE-2022-38465', type: 'Engineering workstation', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → plant DMZ → EWS (RDP)', controls: ['EDR on EWS', 'Application allow-listing'] },
    { cve: 'CVE-2019-12256', type: 'Welding robot controller', reach: 1, patch: 'Patch needs outage window', path: 'Cell network → robot controller (VxWorks stack)', controls: ['Cell firewall', 'KUKA service via jump host'] },
    { cve: 'CVE-2023-3595', type: 'AGV / AMR vehicle controller', reach: 2, patch: 'Patch needs outage window', path: 'Enterprise IT → fleet manager → vehicle Wi-Fi', controls: ['Intralogistics Wi-Fi WPA3-Enterprise'] },
    { cve: 'CVE-2021-22681', type: 'Engineering workstation', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → plant DMZ → EWS', controls: ['Studio 5000 project encryption'] },
    { cve: 'CVE-2024-6387', type: 'MES line server', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → MES (SSH)', controls: ['SSH limited to jump host'] },
    { cve: 'CVE-2021-44228', type: 'MES interface (SAP / Opcenter)', reach: 3, patch: 'Vendor patch available', path: 'Supplier portal → SAP integration → MES interface', controls: ['WAF virtual patch'] },
    { cve: 'CVE-2024-38063', type: 'SCADA server (WinCC)', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → plant DMZ (IPv6 enabled)', controls: ['IPv6 disabled on 5 of 7 hosts'] },
    { cve: 'CVE-2024-38063', type: 'End-of-line test bench', reach: 3, patch: 'Patch needs outage window', path: 'Corporate file share → EOL benches (SMB, Puebla)', controls: ['None verified'] },
    { cve: 'CVE-2023-48795', type: 'Torque tool controller', reach: 1, patch: 'Vendor patch available', path: 'Line network → controller management', controls: ['Line VLAN ACLs'] },
    { cve: 'CVE-2020-11896', type: 'Formation rack controller', reach: 0, patch: 'No vendor fix', path: 'Air-gapped plant; no routed path', controls: ['Air gap', 'Signed media kiosk'] },
    { cve: 'CVE-2023-48795', type: 'Dry-room HVAC controller', reach: 0, patch: 'Vendor patch available', path: 'Air-gapped plant; BMS network', controls: ['Air gap'] },
  ],
  insurance: [
    { cve: 'CVE-2020-11896', type: 'UPS (Vertiv Liebert EXL S1)', reach: 2, patch: 'Patch needs outage window', path: 'Corporate IT → facilities DMZ → UPS network cards (SNMP/HTTPS)', controls: ['Card firmware pinned', 'Management VLAN ACLs'] },
    { cve: 'CVE-2021-22779', type: 'BMS controller (EcoStruxure)', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → BMS server → AS-P controllers (Windsor DC1)', controls: ['Facilities jump host with Okta MFA'] },
    { cve: 'CVE-2024-6387', type: 'BMS server (EcoStruxure)', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → facilities DMZ → BMS server (SSH)', controls: ['SSH limited to the jump host'] },
    { cve: 'CVE-2019-12256', type: 'CRAC unit (Liebert DSE)', reach: 3, patch: 'No vendor fix', path: 'Vertiv remote-diagnostics modem → CRAC controller (hall B)', controls: ['Modem powered only during booked visits (partial)'] },
    { cve: 'CVE-2023-6448', type: 'Generator controller (Cummins)', reach: 1, patch: 'Vendor patch available', path: 'BMS network → generator Modbus gateway', controls: ['Factory PIN changed at Windsor; Phoenix pending'] },
    { cve: 'CVE-2019-12256', type: 'Fire suppression panel (Novec 1230)', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Isolated fire network; supervised by the alarm receiving centre', controls: ['Physically isolated loop', 'Monthly panel inspection'] },
    { cve: 'CVE-2024-38063', type: 'Print workflow server', reach: 3, patch: 'Vendor patch available', path: 'Claims file servers → print workflow server (SMB job drop, IPv6 enabled)', controls: ['None verified'] },
    { cve: 'CVE-2017-0144', type: 'Mail-piece integrity server', reach: 2, patch: 'Patch needs outage window', path: 'Corporate IT → mail floor network (SMBv1 kept for inserter file exchange)', controls: ['SMBv1 limited to two inserter hosts'] },
    { cve: 'CVE-2020-11896', type: 'Inserter controller (Pitney Bowes)', reach: 1, patch: 'No vendor fix', path: 'Mail floor network → inserter controllers', controls: ['Inserter VLAN ACLs'] },
    { cve: 'CVE-2021-44228', type: 'Access control server (LenelS2)', reach: 2, patch: 'Vendor patch available', path: 'Workday HR feed → access control integration service', controls: ['JNDI lookups disabled by config'] },
    { cve: 'CVE-2023-48795', type: 'Physical access controller', reach: 1, patch: 'Vendor patch available', path: 'Access control server → controllers', controls: ['Controller VLAN'] },
    { cve: 'CVE-2020-11896', type: 'Intelligent PDU', reach: 1, patch: 'No vendor fix', path: 'DCIM → PDU management network', controls: ['Outlet switching disabled on mainframe racks'] },
  ],
  defence: [
    { cve: 'CVE-2017-0144', type: 'DNC programme server', reach: 2, patch: 'Patch needs outage window', path: 'Engineering network → shop-floor DMZ → B3-DNC-SRV01 (SMBv1 kept for older controls)', controls: ['SMBv1 limited to the DNC VLAN', 'File-integrity monitoring on released programmes'] },
    { cve: 'CVE-2019-0708', type: 'CMM inspection workstation', reach: 1, patch: 'Patch needs outage window', path: 'DNC & inspection VLAN (Windows 7 on two CMM stations)', controls: ['RDP blocked at the cell firewall', 'Application allow-listing'] },
    { cve: 'CVE-2023-3595', type: 'Heat-treat furnace controller', reach: 2, patch: 'Patch needs outage window', path: 'Engineering network → shop-floor DMZ → heat-treat cell (EtherNet/IP)', controls: ['Key switch in RUN', 'PLC change monitoring (HexaOT)'] },
    { cve: 'CVE-2022-1161', type: 'Heat-treat furnace controller', reach: 1, patch: 'No vendor fix', path: 'Heat-treat cell network only', controls: ['Logic change detection', 'Signed project archive in Teamcenter'] },
    { cve: 'CVE-2021-22681', type: 'Engineering workstation', reach: 2, patch: 'Vendor patch available', path: 'Engineering network → shop-floor DMZ → EWS', controls: ['Studio 5000 project encryption', 'Delinea-vaulted credentials'] },
    { cve: 'CVE-2024-6387', type: 'Process historian (AVEVA)', reach: 2, patch: 'Vendor patch available', path: 'GCC High historian replica → shop-floor DMZ (SSH)', controls: ['SSH limited to SPD-JUMP-OT01'] },
    { cve: 'CVE-2024-38063', type: 'OT jump host', reach: 2, patch: 'Vendor patch available', path: 'Engineering network → shop-floor DMZ (IPv6 enabled)', controls: ['IPv6 disabled on 1 of 2 hosts'] },
    { cve: 'CVE-2019-12256', type: 'CNC mill (Haas VF-4SS)', reach: 3, patch: 'No vendor fix', path: 'Machine-tool vendor cellular hotspot → CNC control (service visits)', controls: ['Hotspots banned by policy (not enforced)'] },
    { cve: 'CVE-2020-11896', type: 'Environmental chamber (Thermotron)', reach: 1, patch: 'No vendor fix', path: 'Test range network → chamber controller', controls: ['Chamber VLAN ACLs'] },
    { cve: 'CVE-2024-38063', type: 'Avionics ATE bench (NI PXI)', reach: 2, patch: 'Patch needs outage window', path: 'Tucson office network → ATE benches (IPv6, shared results folder)', controls: ['Benches re-validated after every patch cycle'] },
    { cve: 'CVE-2019-12256', type: 'Vibration shaker controller', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Standalone shaker network; no routed path', controls: ['No routed path', 'OEM service only on site'] },
    { cve: 'CVE-2023-48795', type: 'Building management controller', reach: 1, patch: 'Vendor patch available', path: 'Facilities network → BMS controllers', controls: ['Facilities VLAN'] },
  ],
  pharma: [
    { cve: 'CVE-2022-29965', type: 'DCS engineering station (DeltaV)', reach: 2, patch: 'Patch needs outage window', path: 'Enterprise IT → plant DMZ → VLS-DELTAV-PROPLUS', controls: ['Emerson Guardian patch baseline', 'DeltaV smart firewall'] },
    { cve: 'CVE-2022-29965', type: 'DCS operator station (DeltaV)', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'DeltaV control network only', controls: ['Validated state (GAMP 5)', 'GxP change control in ServiceNow'] },
    { cve: 'CVE-2022-38465', type: 'Reactor & dryer controller (PCS 7 AS)', reach: 1, patch: 'Patch needs outage window', path: 'PCS 7 plant bus from the engineering station', controls: ['Access protection level 3', 'PLC change monitoring (HexaOT)'] },
    { cve: 'CVE-2022-38465', type: 'DCS engineering station (PCS 7)', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → plant DMZ → PCS 7 ES (RDP)', controls: ['CrowdStrike Falcon on ES', 'Application allow-listing'] },
    { cve: 'CVE-2020-15782', type: 'Lyophiliser PLC', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'Lyophiliser cell network only', controls: ['Access protection level 3', 'Revalidation required for any firmware change'] },
    { cve: 'CVE-2022-38465', type: 'Aseptic filling isolator PLC', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Air-gapped AF-2 line; no routed path', controls: ['Air gap with data diode', 'Signed media kiosk'] },
    { cve: 'CVE-2023-3595', type: 'CIP/SIP skid PLC', reach: 2, patch: 'Patch needs outage window', path: 'Skid OEM remote access → plant DMZ → utilities network', controls: ['BeyondTrust brokered OEM sessions'] },
    { cve: 'CVE-2021-22681', type: 'CIP/SIP skid PLC', reach: 2, patch: 'Vendor patch available', path: 'Engineering laptops → utilities network', controls: ['Studio 5000 project encryption'] },
    { cve: 'CVE-2024-6387', type: 'Process historian (AVEVA PI)', reach: 2, patch: 'Vendor patch available', path: 'Enterprise IT → plant DMZ → PI-to-PI replica', controls: ['SSH limited to jump host'] },
    { cve: 'CVE-2024-38063', type: 'MES server (Werum PAS-X)', reach: 2, patch: 'Patch needs outage window', path: 'Enterprise IT (SAP) → plant DMZ → PAS-X application server', controls: ['IPv6 disabled at Valais; Cork pending', 'Validated patch cycle each quarter'] },
    { cve: 'CVE-2017-0144', type: 'MES terminal (PAS-X)', reach: 1, patch: 'Vendor patch available', path: 'MES terminal network (SMBv1 still enabled on older images)', controls: ['Terminal VLAN ACLs'] },
    { cve: 'CVE-2021-44228', type: 'Serialisation site server (L3)', reach: 2, patch: 'Vendor patch available', path: 'SAP serial number pool → L3 site server integration', controls: ['JNDI lookups disabled by config'] },
    { cve: 'CVE-2019-12256', type: 'Bioreactor controller (2,000 L single-use)', reach: 1, patch: 'No vendor fix', path: 'DeltaV control network → bioreactor package controller', controls: ['DeltaV network isolation'] },
    { cve: 'CVE-2020-11896', type: 'Chromatography skid', reach: 1, patch: 'No vendor fix', path: 'Downstream network → skid management port', controls: ['Skid VLAN ACLs'] },
    { cve: 'CVE-2023-48795', type: 'Cleanroom HVAC / BMS controller', reach: 1, patch: 'Vendor patch available', path: 'Facilities network → Desigo controllers', controls: ['BMS jump host'] },
  ],
  sghospital: [
    { cve: 'CVE-2019-10959', type: 'Infusion pump server (Alaris)', reach: 2, patch: 'Vendor patch available', path: 'Clinical IT → medical device DMZ → OBH-ALARIS-SRV', controls: ['Biomed jump host with CyberArk', 'Gateway firmware current on most units'] },
    { cve: 'CVE-2020-25165', type: 'Infusion pump (BD Alaris)', reach: 1, patch: 'Patch needs outage window', path: 'Infusion SSID → pump network stack', controls: ['Pump SSID isolated (WPA2-Enterprise)', 'Cisco ISE MAC profiling'] },
    { cve: 'CVE-2020-16222', type: 'Central monitoring station (PIC iX)', reach: 2, patch: 'Vendor patch available', path: 'Clinical network → PIC iX (HL7 export to TrakCare)', controls: ['HL7 listener allow-list'] },
    { cve: 'CVE-2020-16222', type: 'Patient monitor (IntelliVue)', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'Monitoring VLAN only', controls: ['Monitoring VLAN isolation', 'HSA-registered configuration'] },
    { cve: 'CVE-2019-0708', type: 'MRI console (Windows 7)', reach: 2, patch: 'Patch needs outage window', path: 'Imaging VLAN → MRI console (RDP used by OEM service)', controls: ['RDP blocked at imaging firewall', 'OEM upgrade to XA60 booked'] },
    { cve: 'CVE-2017-0144', type: 'MRI console (Windows 7)', reach: 1, patch: 'No vendor fix', path: 'Imaging VLAN (SMBv1 needed for film export)', controls: ['Forescout eyeControl quarantine policy'] },
    { cve: 'CVE-2024-38063', type: 'CT console', reach: 1, patch: 'Patch needs outage window', path: 'Imaging VLAN (IPv6 enabled by OEM image)', controls: ['IPv6 filtered at imaging firewall'] },
    { cve: 'CVE-2024-6387', type: 'PACS server', reach: 2, patch: 'Vendor patch available', path: 'Clinical IT → PACS (SSH)', controls: ['SSH limited to biomed jump host'] },
    { cve: 'CVE-2021-37163', type: 'Pneumatic tube controller', reach: 2, patch: 'Vendor patch available', path: 'Facilities network → tube system head-end → stations', controls: ['Facilities VLAN ACLs'] },
    { cve: 'CVE-2021-44228', type: 'Nurse call server', reach: 2, patch: 'Vendor patch available', path: 'Clinical IT → nurse call integration service', controls: ['JNDI lookups disabled by config'] },
    { cve: 'CVE-2020-11896', type: 'Lab analyser (Roche cobas)', reach: 1, patch: 'No vendor fix', path: 'Lab network → analyser service port', controls: ['Lab VLAN ACLs'] },
    { cve: 'CVE-2024-38063', type: 'Oncology information system (ARIA)', reach: 2, patch: 'Vendor patch available', path: 'Clinical IT → oncology application servers', controls: ['Patched at Tanglin primary; DR node pending'] },
    { cve: 'CVE-2019-12256', type: 'Linear accelerator (Varian TrueBeam)', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Treatment-room network only; OEM service via SmartConnect broker', controls: ['No routed path from clinical IT', 'OEM service recorded'] },
    { cve: 'CVE-2023-48795', type: 'BMS controller (theatres & isolation)', reach: 1, patch: 'Vendor patch available', path: 'Facilities network → BMS head-end → JACE controllers', controls: ['BMS jump host'] },
  ],
  studio: [
    { cve: 'CVE-2022-38465', type: 'Ride control PLC (safety-rated)', reach: 1, patch: 'Unpatchable by design (safety case)', path: 'Ride control network only; ride OEM service via jump host', controls: ['Access protection level 3', 'Ride safety re-certification required for change', 'PLC change monitoring (HexaOT)'] },
    { cve: 'CVE-2020-15782', type: 'Ride control PLC (safety-rated)', reach: 1, patch: 'Patch needs outage window', path: 'Ride control network from the engineering workstation', controls: ['Key switch in RUN during park hours'] },
    { cve: 'CVE-2022-38465', type: 'Ride control engineering workstation', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → ride & show DMZ → EWS (RDP)', controls: ['CrowdStrike Falcon on EWS', 'Application allow-listing'] },
    { cve: 'CVE-2024-38063', type: 'Media server (projection & LED)', reach: 2, patch: 'Patch needs outage window', path: 'Corporate IT → show control VLAN (IPv6 enabled on media servers)', controls: ['Show VLAN ACLs'] },
    { cve: 'CVE-2021-44228', type: 'StarPass ticketing gateway', reach: 3, patch: 'Vendor patch available', path: 'Internet (tickets.starfallresorts.com) → ticketing integration', controls: ['Cloudflare WAF virtual patch'] },
    { cve: 'CVE-2024-6387', type: 'Show control server', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → ride & show DMZ → show control (SSH)', controls: ['SSH limited to SFE-JUMP-PARKS'] },
    { cve: 'CVE-2019-12256', type: 'Animatronic figure controller', reach: 1, patch: 'No vendor fix', path: 'Show control network → figure controllers', controls: ['Figure network isolated per attraction'] },
    { cve: 'CVE-2020-11896', type: 'Water ride pump VFD', reach: 1, patch: 'No vendor fix', path: 'Pump-house network → drive management', controls: ['Pump-house VLAN ACLs'] },
    { cve: 'CVE-2020-11896', type: 'Turnstile & StarPass gate controller', reach: 2, patch: 'Patch needs outage window', path: 'Corporate IT → guest entry network', controls: ['Gate VLAN per entrance'] },
    { cve: 'CVE-2024-6387', type: 'BMS server', reach: 2, patch: 'Vendor patch available', path: 'Corporate IT → BMS server (SSH)', controls: ['SSH limited to jump host'] },
    { cve: 'CVE-2023-48795', type: 'ST 2110 live events router', reach: 1, patch: 'Vendor patch available', path: 'Live events management VLAN', controls: ['TACACS+ with MFA'] },
    { cve: 'CVE-2019-12256', type: 'Fire alarm panel', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Isolated fire network; monitored by the resort fire command centre', controls: ['Physically isolated loop'] },
    { cve: 'CVE-2023-48795', type: 'Pyrotechnic firing system', reach: 0, patch: 'Unpatchable by design (safety case)', path: 'Isolated firing network; armed only by key at the show', controls: ['Physical arming key', 'Two-person firing rule'] },
  ],
};

function ip(r: ReturnType<typeof rng>, level: PurdueLevel, siteIdx: number): string {
  const third = { L4: 10, 'L3.5': 35, L3: 30, L2: 20, L1: 11, L0: 1 }[level];
  return `10.${60 + siteIdx}.${third + r.int(0, 3)}.${r.int(10, 250)}`;
}
function mac(r: ReturnType<typeof rng>, vendor: string): string {
  const oui: Record<string, string> = { Siemens: '00:1B:1B', ABB: '00:21:C1', 'Rockwell Automation': '00:1D:9C', Kongsberg: '00:0E:9E', 'Schneider Electric': '00:80:F4', Eaton: '00:20:85', Sony: '00:1D:BA', 'Grass Valley': '00:10:65', Meinberg: 'EC:46:70', Arista: '44:4C:A8', Riedel: '00:0E:D6' };
  const p = oui[vendor] ?? `${r.hex(2)}:${r.hex(2)}:${r.hex(2)}`.toUpperCase();
  return `${p}:${r.hex(2)}:${r.hex(2)}:${r.hex(2)}`.toUpperCase();
}

const ASSET_CACHE = new Map<string, OtAsset[]>();
export function otAssets(c: CustomerProfile, tenantId: string): OtAsset[] {
  const key = c.id + '|' + tenantId;
  const hit = ASSET_CACHE.get(key);
  if (hit) return hit;
  const out = buildAssets(c, tenantId);
  ASSET_CACHE.set(key, out);
  return out;
}

function buildAssets(c: CustomerProfile, tenantId: string): OtAsset[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const r = rng(`ot-assets-${c.id}-${tenantId}`);
  const types = forCustomer(TYPES, c);
  const vulnByType = new Map<string, string[]>();
  for (const v of forCustomer(VULN_MAP, c)) vulnByType.set(v.type, [...(vulnByType.get(v.type) ?? []), v.cve]);
  const vs = c.dataKey === 'maritime' ? vessels(c, sc.siteAssets.fleet ?? 0) : [];
  const out: OtAsset[] = [];
  sc.sites.forEach((site, si) => {
    const ts = types.filter((t) => t.kinds.includes(site.kind));
    const counts = distribute(sc.siteAssets[site.id] ?? 0, ts.map((t) => t.share));
    ts.forEach((t, ti) => {
      for (let i = 0; i < counts[ti]; i++) {
        const fwIdx = r.weighted<number>(t.fw.map((_, k) => [k, k === t.fw.length - 1 ? 5 : k === t.fw.length - 2 ? 3 : 1.4] as const));
        const behind = t.fw.length - 1 - fwIdx;
        const vessel = site.kind === 'vessel' && vs.length ? vs[r.int(0, vs.length - 1)] : undefined;
        const cves = behind > 0 ? (vulnByType.get(t.name) ?? []) : (vulnByType.get(t.name) ?? []).filter(() => r.chance(0.25));
        const sources = [site.source];
        if (t.level === 'L3' || t.level === 'L3.5' || t.level === 'L4') {
          const it = c.connectors.find((k) => k.category === 'Vulnerability' || k.category === 'EDR / XDR');
          if (it) sources.push(`${it.vendor} ${it.product}`);
        }
        if (c.dataKey === 'maritime' && site.kind === 'terminal' && (t.zone === 'Gate & access' || t.zone === 'Crane control') && (site.id === 'rtm' || site.id === 'ant') && r.chance(0.6)) sources.push('Navis N4 (equipment register)');
        const risk = Math.min(99, Math.round(t.consequence * 9 + behind * 9 + cves.length * 7 + r.int(0, 14)));
        const name = vessel ? `${vessel.code}-${t.abbr}-${String(i + 1).padStart(2, '0')}` : `${site.prefix}-${t.abbr}-${String(i + 1).padStart(3, '0')}`;
        out.push({
          id: `${site.id}-${t.abbr}-${i}`,
          name,
          type: t.name,
          level: t.level,
          vendor: t.vendor,
          model: t.model,
          firmware: t.fw[fwIdx],
          latestFirmware: t.fw[t.fw.length - 1],
          fwBehind: behind,
          ip: ip(r, t.level, si),
          mac: mac(r, t.vendor),
          zone: t.zone,
          siteId: site.id,
          siteName: vessel ? vessel.name : site.name,
          vessel: vessel?.name,
          protocols: t.protocols,
          lastSeenMin: site.airGapped ? bundleAgeMin(c) + r.int(0, (site.bundleHours ?? 6) * 60) : vessel && vessel.status !== 'online' ? vessel.lastSyncMin + r.int(0, 30) : r.weighted<number>([[r.int(0, 5), 6], [r.int(6, 90), 3], [r.int(120, 2880), 1]]),
          cves,
          risk,
          sources,
          consequence: t.consequence,
          consequenceText: t.consequenceText,
        });
      }
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Zones and conduits                                                  */
/* ------------------------------------------------------------------ */

export interface ZoneFlow { from: string; to: string; value: number; unexpected?: boolean; note?: string; kinds: SiteKind[] }

const FLOWS: CustomerMap<ZoneFlow[]> = {
  maritime: [
    { from: 'Enterprise IT', to: 'OT DMZ (L3.5)', value: 420, kinds: ['terminal'] },
    { from: 'Vendor remote access', to: 'OT DMZ (L3.5)', value: 60, kinds: ['terminal'] },
    { from: 'OT DMZ (L3.5)', to: 'Terminal operations (L3)', value: 380, kinds: ['terminal'] },
    { from: 'OT DMZ (L3.5)', to: 'Reefer', value: 40, kinds: ['terminal'] },
    { from: 'Terminal operations (L3)', to: 'Crane control (L1–2)', value: 210, kinds: ['terminal'] },
    { from: 'Terminal operations (L3)', to: 'Yard automation (AGV)', value: 160, kinds: ['terminal'] },
    { from: 'Terminal operations (L3)', to: 'Gate & access', value: 90, kinds: ['terminal'] },
    { from: 'Terminal operations (L3)', to: 'Power & substation', value: 30, kinds: ['terminal'] },
    { from: 'Enterprise IT', to: 'Gate & access', value: 16, unexpected: true, note: 'OCR images pulled over SMB from a finance server, bypassing the DMZ (Port Klang)', kinds: ['terminal'] },
    { from: 'Vendor remote access', to: 'Crane control (L1–2)', value: 11, unexpected: true, note: 'TeamViewer session from Konecranes straight to an STS crane HMI (Antwerp)', kinds: ['terminal'] },
    { from: 'Shore (fleet ops)', to: 'Vessel DMZ', value: 90, kinds: ['vessel'] },
    { from: 'Crew & business LAN', to: 'Vessel DMZ', value: 45, kinds: ['vessel'] },
    { from: 'Vessel DMZ', to: 'Bridge & navigation', value: 34, kinds: ['vessel'] },
    { from: 'Vessel DMZ', to: 'Machinery & propulsion', value: 28, kinds: ['vessel'] },
    { from: 'Vessel DMZ', to: 'Cargo & ballast', value: 22, kinds: ['vessel'] },
    { from: 'Crew & business LAN', to: 'Bridge & navigation', value: 7, unexpected: true, note: 'ECDIS reached from crew Wi-Fi via shared folder (Halcyon Tempest)', kinds: ['vessel'] },
    { from: 'Vendor remote access', to: 'Machinery & propulsion', value: 5, unexpected: true, note: 'Kongsberg diagnostics over LEO without the PAM broker (Halcyon Vega)', kinds: ['vessel'] },
  ],
  finserv: [
    { from: 'Corporate IT', to: 'Facilities DMZ (L3.5)', value: 300, kinds: ['dc', 'office'] },
    { from: 'Vendor remote access', to: 'Facilities DMZ (L3.5)', value: 40, kinds: ['dc', 'office'] },
    { from: 'Facilities DMZ (L3.5)', to: 'BMS & DCIM (L3)', value: 260, kinds: ['dc', 'office'] },
    { from: 'BMS & DCIM (L3)', to: 'Power (UPS, generators)', value: 120, kinds: ['dc'] },
    { from: 'BMS & DCIM (L3)', to: 'Cooling (CRAC)', value: 140, kinds: ['dc', 'office'] },
    { from: 'BMS & DCIM (L3)', to: 'Fire & life safety', value: 24, kinds: ['dc', 'office'] },
    { from: 'BMS & DCIM (L3)', to: 'Physical security', value: 70, kinds: ['dc', 'office'] },
    { from: 'Corporate IT', to: 'ATM network', value: 180, kinds: ['atm'] },
    { from: 'Vendor remote access', to: 'Cooling (CRAC)', value: 9, unexpected: true, note: 'Vertiv cellular modem on a CRAC unit in Basildon DC2, outside the facilities DMZ', kinds: ['dc'] },
    { from: 'Corporate IT', to: 'Physical security', value: 18, unexpected: true, note: 'HR system pushes badge changes straight to access controllers (Slough DC1)', kinds: ['dc', 'office'] },
    { from: 'Branch LAN', to: 'ATM network', value: 12, unexpected: true, note: '4 branches route branch LAN to ATM VLAN after a router swap', kinds: ['atm'] },
  ],
  media: [
    { from: 'Corporate IT', to: 'Broadcast DMZ (L3.5)', value: 200, kinds: ['broadcast'] },
    { from: 'Vendor remote access', to: 'Broadcast DMZ (L3.5)', value: 30, kinds: ['broadcast'] },
    { from: 'Broadcast DMZ (L3.5)', to: 'Playout & automation (L3)', value: 180, kinds: ['broadcast'] },
    { from: 'Playout & automation (L3)', to: 'ST 2110 media fabric (L2)', value: 320, kinds: ['broadcast'] },
    { from: 'Timing (PTP)', to: 'ST 2110 media fabric (L2)', value: 40, kinds: ['broadcast'] },
    { from: 'ST 2110 media fabric (L2)', to: 'Studio control (L1)', value: 260, kinds: ['broadcast'] },
    { from: 'Corporate IT', to: 'Facilities & lighting', value: 60, kinds: ['broadcast', 'stage', 'post'] },
    { from: 'Vendor remote access', to: 'Playout & automation (L3)', value: 7, unexpected: true, note: 'Grass Valley support tunnel lands on GV Orbit, bypassing the broadcast DMZ', kinds: ['broadcast'] },
    { from: 'Corporate IT', to: 'ST 2110 media fabric (L2)', value: 11, unexpected: true, note: 'Producer laptop seen on the 2110 control VLAN (Studio B, Atlanta)', kinds: ['broadcast'] },
  ],
  healthcare: [
    { from: 'Clinical IT (Epic)', to: 'Medical device DMZ (L3.5)', value: 380, kinds: ['hospital', 'imaging', 'lab'] },
    { from: 'Vendor remote access', to: 'Medical device DMZ (L3.5)', value: 70, kinds: ['hospital', 'imaging'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Infusion', value: 130, kinds: ['hospital'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Patient monitoring', value: 160, kinds: ['hospital'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Imaging', value: 140, kinds: ['hospital', 'imaging'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Laboratory', value: 60, kinds: ['lab', 'hospital'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Pharmacy', value: 70, kinds: ['hospital', 'lab'] },
    { from: 'Facilities IT', to: 'Building & environment', value: 80, kinds: ['hospital', 'imaging', 'lab'] },
    { from: 'Staff & guest Wi-Fi', to: 'Infusion', value: 9, unexpected: true, note: 'Infusion pumps at Marion associating to the staff SSID after an access-point swap', kinds: ['hospital'] },
    { from: 'Vendor remote access', to: 'Imaging', value: 12, unexpected: true, note: 'Imaging OEM service tunnel to CT consoles at the Imaging & Cancer Center, outside the access broker', kinds: ['imaging'] },
    { from: 'Clinical IT (Epic)', to: 'Patient monitoring', value: 8, unexpected: true, note: "Vitals pulled straight from bedside monitors at Children's, bypassing the PIC iX gateway", kinds: ['hospital'] },
    { from: 'Staff & guest Wi-Fi', to: 'Building & environment', value: 5, unexpected: true, note: 'BMS web console answering on guest Wi-Fi at Zanesville', kinds: ['hospital'] },
  ],
  automotive: [
    { from: 'Enterprise IT (SAP, PLM)', to: 'Plant DMZ (L3.5)', value: 520, kinds: ['plant'] },
    { from: 'Vendor remote access', to: 'Plant DMZ (L3.5)', value: 110, kinds: ['plant'] },
    { from: 'Plant DMZ (L3.5)', to: 'MES & line control (L3)', value: 460, kinds: ['plant'] },
    { from: 'MES & line control (L3)', to: 'Press & body shop', value: 260, kinds: ['plant'] },
    { from: 'MES & line control (L3)', to: 'Paint shop', value: 120, kinds: ['plant'] },
    { from: 'MES & line control (L3)', to: 'Final assembly & EOL', value: 210, kinds: ['plant'] },
    { from: 'MES & line control (L3)', to: 'Intralogistics (AGV)', value: 90, kinds: ['plant'] },
    { from: 'Cell plant MES (L3)', to: 'Formation & ageing', value: 90, kinds: ['cellplant'] },
    { from: 'Cell plant MES (L3)', to: 'Electrode & cell assembly', value: 70, kinds: ['cellplant'] },
    { from: 'Cell plant MES (L3)', to: 'Dry rooms & HVAC', value: 30, kinds: ['cellplant'] },
    { from: 'Cell plant MES (L3)', to: 'Signed bundle export (6 h)', value: 24, kinds: ['cellplant'] },
    { from: 'Vendor remote access', to: 'Press & body shop', value: 14, unexpected: true, note: 'Robot OEM remote service straight to a robot controller in body-shop hall 2 (Ingolstadt), bypassing the jump host', kinds: ['plant'] },
    { from: 'Enterprise IT (SAP, PLM)', to: 'Final assembly & EOL', value: 9, unexpected: true, note: 'End-of-line benches at Puebla fetch vehicle software over SMB from a corporate file share', kinds: ['plant'] },
    { from: 'Engineering laptop (transient)', to: 'Formation & ageing', value: 3, unexpected: true, note: 'Unregistered engineering laptop on the formation rack network at Salzgitter (seen in the 6-hourly bundle)', kinds: ['cellplant'] },
  ],
  insurance: [
    { from: 'Corporate IT', to: 'Facilities DMZ (L3.5)', value: 240, kinds: ['dc', 'printplant'] },
    { from: 'Vendor remote access', to: 'Facilities DMZ (L3.5)', value: 36, kinds: ['dc', 'printplant'] },
    { from: 'Facilities DMZ (L3.5)', to: 'BMS & DCIM (L3)', value: 200, kinds: ['dc', 'printplant'] },
    { from: 'BMS & DCIM (L3)', to: 'Power (UPS, generators)', value: 100, kinds: ['dc'] },
    { from: 'BMS & DCIM (L3)', to: 'Cooling (CRAC)', value: 120, kinds: ['dc'] },
    { from: 'BMS & DCIM (L3)', to: 'Fire & life safety', value: 18, kinds: ['dc', 'printplant'] },
    { from: 'BMS & DCIM (L3)', to: 'Physical security', value: 60, kinds: ['dc', 'printplant'] },
    { from: 'Facilities DMZ (L3.5)', to: 'Print & mail production', value: 150, kinds: ['printplant'] },
    { from: 'Vendor remote access', to: 'Cooling (CRAC)', value: 8, unexpected: true, note: 'Vertiv remote-diagnostics modem on a Liebert unit in Windsor DC1 hall B, outside the facilities DMZ', kinds: ['dc'] },
    { from: 'Corporate IT', to: 'Print & mail production', value: 14, unexpected: true, note: 'Claims letters dropped over SMB from a claims file server straight onto the Hartford print workflow server, bypassing the facilities DMZ', kinds: ['printplant'] },
    { from: 'Corporate IT', to: 'Physical security', value: 10, unexpected: true, note: 'Workday HR feed writes badge changes straight to access controllers at Windsor, skipping the access control server', kinds: ['dc'] },
  ],
  defence: [
    { from: 'Enterprise IT (PLM & ERP)', to: 'Shop-floor DMZ (L3.5)', value: 260, kinds: ['shop', 'range'] },
    { from: 'Vendor remote access', to: 'Shop-floor DMZ (L3.5)', value: 40, kinds: ['shop', 'range'] },
    { from: 'Shop-floor DMZ (L3.5)', to: 'DNC & inspection (L3)', value: 220, kinds: ['shop'] },
    { from: 'DNC & inspection (L3)', to: 'CNC machining', value: 170, kinds: ['shop'] },
    { from: 'DNC & inspection (L3)', to: 'Heat treat', value: 40, kinds: ['shop'] },
    { from: 'Shop-floor DMZ (L3.5)', to: 'Facilities (HVAC, air)', value: 30, kinds: ['shop', 'range'] },
    { from: 'Shop-floor DMZ (L3.5)', to: 'Test data & ATE (L3)', value: 90, kinds: ['range'] },
    { from: 'Test data & ATE (L3)', to: 'Environmental test', value: 50, kinds: ['range'] },
    { from: 'Test data & ATE (L3)', to: 'Range telemetry', value: 30, kinds: ['range'] },
    { from: 'Vendor remote access', to: 'CNC machining', value: 9, unexpected: true, note: "Machine-tool service engineer's laptop reached a VF-4SS control over a cellular hotspot in Building 3, outside the BeyondTrust broker", kinds: ['shop'] },
    { from: 'Enterprise IT (PLM & ERP)', to: 'CNC machining', value: 6, unexpected: true, note: 'CAM workstation on the engineering network pushing NC programmes straight to a lathe in Building 3, bypassing the DNC server', kinds: ['shop'] },
    { from: 'Engineering laptop (transient)', to: 'Environmental test', value: 4, unexpected: true, note: "A visiting prime's test engineer laptop joined the Thermotron chamber network at Tucson without passing the media kiosk", kinds: ['range'] },
  ],
  pharma: [
    { from: 'Enterprise IT (SAP)', to: 'Plant DMZ (L3.5)', value: 520, kinds: ['api', 'biologics', 'fillfinish', 'packaging'] },
    { from: 'Vendor remote access', to: 'Plant DMZ (L3.5)', value: 90, kinds: ['api', 'biologics', 'fillfinish', 'packaging'] },
    { from: 'Plant DMZ (L3.5)', to: 'MES & batch records (L3)', value: 420, kinds: ['api', 'biologics', 'fillfinish', 'packaging'] },
    { from: 'MES & batch records (L3)', to: 'API synthesis (PCS 7)', value: 150, kinds: ['api'] },
    { from: 'MES & batch records (L3)', to: 'Upstream & downstream (DeltaV)', value: 220, kinds: ['biologics'] },
    { from: 'MES & batch records (L3)', to: 'Clean utilities (CIP/SIP)', value: 70, kinds: ['api', 'biologics', 'fillfinish'] },
    { from: 'MES & batch records (L3)', to: 'Cleanroom HVAC & EMS', value: 90, kinds: ['biologics', 'fillfinish', 'aseptic'] },
    { from: 'MES & batch records (L3)', to: 'Fill-finish & lyophilisation', value: 160, kinds: ['fillfinish', 'aseptic'] },
    { from: 'MES & batch records (L3)', to: 'Aseptic filling', value: 60, kinds: ['aseptic', 'fillfinish'] },
    { from: 'MES & batch records (L3)', to: 'Serialisation & packaging', value: 130, kinds: ['packaging'] },
    { from: 'MES & batch records (L3)', to: 'Signed bundle export (8 h)', value: 20, kinds: ['aseptic'] },
    { from: 'Vendor remote access', to: 'Clean utilities (CIP/SIP)', value: 10, unexpected: true, note: 'Skid OEM remote-support tool straight to a CIP skid PLC at Ringaskiddy, outside the BeyondTrust broker', kinds: ['fillfinish'] },
    { from: 'Enterprise IT (SAP)', to: 'Serialisation & packaging', value: 8, unexpected: true, note: 'An SAP batch job at Ringaskiddy pushes serial number ranges straight to line controllers, bypassing the L3 site server', kinds: ['packaging'] },
    { from: 'Enterprise IT (SAP)', to: 'Upstream & downstream (DeltaV)', value: 6, unexpected: true, note: 'An R&D data-science notebook pulls bioreactor tags straight from a DeltaV application station at Sierre, bypassing the PI replica', kinds: ['biologics'] },
    { from: 'Engineering laptop (transient)', to: 'Aseptic filling', value: 3, unexpected: true, note: 'Requalification contractor laptop on the AF-2 isolator network (seen in the 8-hourly bundle)', kinds: ['aseptic'] },
  ],
  sghospital: [
    { from: 'Clinical IT (TrakCare)', to: 'Medical device DMZ (L3.5)', value: 340, kinds: ['hospital', 'specialist', 'daysurg', 'labimg'] },
    { from: 'Vendor remote access', to: 'Medical device DMZ (L3.5)', value: 60, kinds: ['hospital', 'specialist', 'labimg'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Infusion', value: 120, kinds: ['hospital', 'specialist', 'daysurg'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Patient monitoring', value: 140, kinds: ['hospital', 'specialist', 'daysurg'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Imaging', value: 120, kinds: ['hospital', 'labimg'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Laboratory', value: 70, kinds: ['labimg', 'hospital'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Radiation oncology', value: 30, kinds: ['specialist'] },
    { from: 'Medical device DMZ (L3.5)', to: 'Nurse call', value: 50, kinds: ['hospital', 'specialist', 'daysurg'] },
    { from: 'Facilities IT', to: 'Building & environment', value: 70, kinds: ['hospital', 'specialist', 'daysurg', 'labimg'] },
    { from: 'Vendor remote access', to: 'Imaging', value: 10, unexpected: true, note: 'MRI OEM service session to a Windows 7 MAGNETOM console at Science Park through a vendor VPN box, outside CyberArk Vendor PAM', kinds: ['labimg'] },
    { from: 'Staff & guest Wi-Fi', to: 'Infusion', value: 8, unexpected: true, note: 'Alaris pumps at Punggol joining the staff SSID after a wireless controller upgrade', kinds: ['daysurg'] },
    { from: 'Clinical IT (TrakCare)', to: 'Laboratory', value: 7, unexpected: true, note: 'cobas results copied to an unregistered HL7 listener at Science Park, bypassing HealthShare', kinds: ['labimg'] },
    { from: 'Vendor remote access', to: 'Radiation oncology', value: 4, unexpected: true, note: 'Linac OEM session to a TrueBeam at Tanglin outside the booked service window', kinds: ['specialist'] },
  ],
  studio: [
    { from: 'Corporate IT', to: 'Ride & show DMZ (L3.5)', value: 380, kinds: ['park', 'waterpark', 'resort', 'liveevents'] },
    { from: 'Vendor remote access', to: 'Ride & show DMZ (L3.5)', value: 70, kinds: ['park', 'waterpark', 'liveevents'] },
    { from: 'Ride & show DMZ (L3.5)', to: 'Ride control (L1–2)', value: 240, kinds: ['park', 'waterpark'] },
    { from: 'Ride & show DMZ (L3.5)', to: 'Show control & media', value: 160, kinds: ['park', 'liveevents'] },
    { from: 'Ride & show DMZ (L3.5)', to: 'Water rides', value: 80, kinds: ['waterpark', 'park'] },
    { from: 'Ride & show DMZ (L3.5)', to: 'Live events', value: 70, kinds: ['liveevents'] },
    { from: 'Corporate IT', to: 'Guest entry', value: 110, kinds: ['park', 'waterpark', 'resort'] },
    { from: 'Facilities IT', to: 'Building & life safety', value: 90, kinds: ['resort', 'park', 'waterpark', 'liveevents'] },
    { from: 'Vendor remote access', to: 'Ride control (L1–2)', value: 9, unexpected: true, note: "The ride manufacturer's remote diagnostics reached a ride control cabinet at Starfall Park Osaka over a 4G router left in the cabinet", kinds: ['park'] },
    { from: 'Corporate IT', to: 'Show control & media', value: 12, unexpected: true, note: 'A marketing laptop in Orlando pushing new content to projection media servers over SMB, bypassing the show DMZ', kinds: ['park', 'liveevents'] },
    { from: 'Staff & guest Wi-Fi', to: 'Guest entry', value: 6, unexpected: true, note: 'StarPass gate controllers at the Osaka hotels answering on the guest Wi-Fi', kinds: ['resort'] },
    { from: 'Engineering laptop (transient)', to: 'Water rides', value: 4, unexpected: true, note: 'Contractor laptop on the pump-house network at Starfall Lagoon after the filtration upgrade', kinds: ['waterpark'] },
  ],
};

export function zoneFlows(c: CustomerProfile, tenantId: string): ZoneFlow[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const kinds = new Set(sc.sites.map((s) => s.kind));
  const share = tenantId === 'all' ? 1 : Math.max(0.25, sc.h.otAssets / headlines(c).ot.otAssets);
  return forCustomer(FLOWS, c).filter((f) => f.kinds.some((k) => kinds.has(k))).map((f) => ({ ...f, value: Math.max(f.unexpected ? 2 : 4, Math.round(f.value * share)) }));
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export interface OtAlert { id: string; sev: Severity; title: string; site: string; asset: string; technique: string; ageMin: number; source: string; detail: string }

const ALERT_SEEDS: CustomerMap<{ sev: Severity; title: string; kind: SiteKind; asset: string; technique: string; detail: string }[]> = {
  maritime: [
    { sev: 'critical', title: 'Program download to STS crane PLC outside change window', kind: 'terminal', asset: 'PLC', technique: 'T0843', detail: 'S7comm download (function 0x1A) from an engineering workstation with no approved ServiceNow change.' },
    { sev: 'high', title: 'Vendor remote session reached crane HMI without PAM broker', kind: 'terminal', asset: 'HMI', technique: 'T0886', detail: 'TeamViewer traffic from Konecranes IP range directly into the crane control zone.' },
    { sev: 'high', title: 'Unauthenticated Modbus write to reefer gateway', kind: 'terminal', asset: 'RFR', technique: 'T0855', detail: 'Write Multiple Registers (FC16) from a host not in the reefer allow-list.' },
    { sev: 'medium', title: 'New device on AGV maintenance VLAN', kind: 'terminal', asset: 'VEH', technique: 'T0846', detail: 'Unknown laptop performing EtherNet/IP List Identity broadcast.' },
    { sev: 'high', title: 'GNSS position jump on bridge sensors', kind: 'vessel', asset: 'NAV', technique: 'T0832', detail: 'Position delta of 11 nm in 2 s; correlated with known spoofing area.' },
    { sev: 'medium', title: 'USB mass storage on ECDIS', kind: 'vessel', asset: 'ECD', technique: 'T0847', detail: 'Chart update USB inserted outside the weekly ENC window.' },
    { sev: 'medium', title: 'Default credentials in use on ballast PLC', kind: 'vessel', asset: 'BWT', technique: 'T0859', detail: 'Unitronics PCOM login with factory password observed.' },
  ],
  finserv: [
    { sev: 'high', title: 'CRAC set-point changed from unknown host', kind: 'dc', asset: 'CRAC', technique: 'T0836', detail: 'BACnet WriteProperty on supply-air set-point from the Vertiv cellular modem.' },
    { sev: 'high', title: 'UPS network card firmware upload attempted', kind: 'dc', asset: 'UPS', technique: 'T0843', detail: 'HTTP POST to firmware endpoint from a corporate subnet.' },
    { sev: 'medium', title: 'Generator controller polled with default credentials', kind: 'dc', asset: 'GEN', technique: 'T0859', detail: 'Modbus/TCP session authenticated with DSE factory PIN.' },
    { sev: 'medium', title: 'ATM XFS dispenser command outside service window', kind: 'atm', asset: 'ATM', technique: 'T0855', detail: 'CDM dispense test command at 02:14 local, no engineer visit logged.' },
    { sev: 'medium', title: 'Badge controller reached from HR subnet', kind: 'office', asset: 'PAC', technique: 'T0886', detail: 'Direct push of access-level changes, bypassing the access control server.' },
  ],
  media: [
    { sev: 'high', title: 'PTP grandmaster change on studio fabric', kind: 'broadcast', asset: 'PTP', technique: 'T0836', detail: 'Best master clock moved to an unknown boundary clock for 41 s during live event.' },
    { sev: 'high', title: 'NMOS connection change from unrecognised controller', kind: 'broadcast', asset: 'ORB', technique: 'T0855', detail: 'IS-05 staged/activate on programme output from a host not in the controller list.' },
    { sev: 'medium', title: 'Producer laptop on 2110 control VLAN', kind: 'broadcast', asset: 'RTR', technique: 'T0846', detail: 'mDNS and NMOS discovery from a corporate laptop in Studio B.' },
    { sev: 'medium', title: 'Art-Net from unknown console on stage 4', kind: 'stage', asset: 'DMX', technique: 'T0855', detail: 'Universe 12 taken over by a console not on the rig sheet.' },
  ],
  healthcare: [
    { sev: 'critical', title: 'Drug library pushed to infusion pumps from an unapproved host', kind: 'hospital', asset: 'INF', technique: 'T0843', detail: 'A drug-library package reached 38 pumps on the ICU floor from a workstation that is not the Alaris Systems Manager, with no pharmacy change recorded.' },
    { sev: 'high', title: 'Vendor remote session to a CT console outside the access broker', kind: 'imaging', asset: 'CTW', technique: 'T0886', detail: 'An OEM service tunnel reached the CT console directly instead of through the brokered, recorded session.' },
    { sev: 'high', title: 'Monitor gateway queried from the staff Wi-Fi', kind: 'hospital', asset: 'PIC', technique: 'T0846', detail: 'HL7 and Telnet probes from a staff-Wi-Fi laptop against the central monitoring station.' },
    { sev: 'high', title: 'Lab analyser sending results to an unknown HL7 listener', kind: 'lab', asset: 'LAB', technique: 'T0882', detail: 'Result messages were copied to a listener that is not the lab middleware.' },
    { sev: 'medium', title: 'OR air-handling set-point changed outside a work order', kind: 'hospital', asset: 'BMS', technique: 'T0836', detail: 'BACnet WriteProperty to theatre 4 air changes per hour from the facilities subnet; no work order in the CMMS.' },
    { sev: 'medium', title: 'New unmanaged device on the infusion SSID', kind: 'hospital', asset: 'INF', technique: 'T0846', detail: 'An unknown laptop associated to the infusion network and scanned pump ports.' },
    { sev: 'medium', title: 'Factory credentials used on a pneumatic tube station', kind: 'hospital', asset: 'PTS', technique: 'T0859', detail: 'A tube station panel accepted the shipped maintenance login.' },
  ],
  automotive: [
    { sev: 'critical', title: 'Program download to a body-shop safety PLC outside the change window', kind: 'plant', asset: 'PLC', technique: 'T0843', detail: 'S7comm download to a fail-safe CPU guarding a robot cell, with no approved change and the line in production.' },
    { sev: 'high', title: 'Robot OEM remote session reached a robot controller directly', kind: 'plant', asset: 'ROB', technique: 'T0886', detail: 'Remote-service traffic from the robot OEM landed on a KR C5 controller without passing the jump host.' },
    { sev: 'high', title: 'Unregistered laptop on the formation rack network (from 6-hourly bundle)', kind: 'cellplant', asset: 'FRM', technique: 'T0846', detail: 'Seen in the signed bundle imported this morning: an unknown laptop browsed formation rack controllers for 14 minutes. The plant is air-gapped, so this was only visible once the bundle arrived.' },
    { sev: 'high', title: 'Dry-room dew-point set-point changed outside a work order', kind: 'cellplant', asset: 'DRY', technique: 'T0836', detail: 'BACnet write to the dew-point set-point of dry room 2; no work order in the plant CMMS.' },
    { sev: 'medium', title: 'Torque programme changed from an unknown host', kind: 'plant', asset: 'TQ', technique: 'T0836', detail: 'Tightening programme for wheel bolts modified from a host not in the tool-management allow-list.' },
    { sev: 'medium', title: 'Conveyor PLC put into STOP from an engineering station', kind: 'plant', asset: 'CNV', technique: 'T0816', detail: 'CPU STOP command during a shift; maintenance ticket raised 6 minutes later.' },
    { sev: 'medium', title: 'EOL bench pulled vehicle software from a corporate share', kind: 'plant', asset: 'EOL', technique: 'T0886', detail: 'SMB transfer of an ECU flash container from a corporate file server, bypassing the signed software distribution path.' },
  ],
  insurance: [
    { sev: 'high', title: 'CRAC supply-air set-point changed from the vendor modem', kind: 'dc', asset: 'CRAC', technique: 'T0836', detail: 'BACnet WriteProperty on a Liebert DSE in Windsor DC1 hall B from the Vertiv remote-diagnostics modem, with no facilities work order and no booked vendor visit.' },
    { sev: 'high', title: 'UPS network card firmware upload from a corporate subnet', kind: 'dc', asset: 'UPS', technique: 'T0843', detail: 'An HTTP POST to the firmware endpoint of a Liebert EXL S1 card came from a desktop subnet rather than the facilities jump host.' },
    { sev: 'medium', title: 'Inserter match programme changed outside the production schedule', kind: 'printplant', asset: 'INS', technique: 'T0836', detail: 'The feeder and match settings for the renewal-notice run were edited from a workstation not on the mail-floor allow-list; the integrity check then flagged 212 envelopes for a re-run to avoid policyholder letters going to the wrong address.' },
    { sev: 'medium', title: 'Unknown laptop on the print production network', kind: 'printplant', asset: 'PRN', technique: 'T0846', detail: 'An unregistered laptop on the Hartford mail floor browsed the iGen presses and the print workflow server.' },
    { sev: 'medium', title: 'Generator controller polled with the factory PIN', kind: 'dc', asset: 'GEN', technique: 'T0859', detail: 'A Modbus/TCP session to a Cummins PowerCommand controller authenticated with the shipped PIN.' },
  ],
  defence: [
    { sev: 'critical', title: 'Released NC programme on the DNC server overwritten outside change control', kind: 'shop', asset: 'DNC', technique: 'T0843', detail: 'The CNC programme for a guidance housing (TDP-2207) on B3-DNC-SRV01 was replaced by an account outside the CNC programming group; its hash no longer matches the released Teamcenter revision. Parts cut since then are quarantined pending CMM inspection.' },
    { sev: 'high', title: 'Machine-tool vendor session reached a CNC control directly', kind: 'shop', asset: 'CNC', technique: 'T0886', detail: 'A service laptop connected to a VF-4SS over a cellular hotspot rather than through the BeyondTrust broker; the session was not recorded.' },
    { sev: 'high', title: 'Heat-treat furnace set-point changed outside a work order', kind: 'shop', asset: 'HTF', technique: 'T0836', detail: 'EtherNet/IP write to the soak temperature of furnace 2 from a station not mapped to the heat-treat cell; no work order and no change to the released process sheet.' },
    { sev: 'high', title: 'Shaker test profile altered between qualification runs', kind: 'range', asset: 'SHK', technique: 'T0836', detail: 'The random-vibration profile on the Tucson shaker changed between run 3 and run 4 of campaign 26-04, from a station that is not assigned to the range test engineer.' },
    { sev: 'medium', title: 'Unregistered laptop on the environmental test network', kind: 'range', asset: 'CHM', technique: 'T0846', detail: 'A laptop that never passed the media kiosk joined the Thermotron chamber network and enumerated chamber controllers.' },
    { sev: 'medium', title: 'ATE bench copying results to an unknown host', kind: 'range', asset: 'ATE', technique: 'T0882', detail: 'Test result files from an avionics ATE bench were sent to a host that is not the DIAdem data server.' },
    { sev: 'medium', title: 'Factory login accepted on an air compressor controller', kind: 'shop', asset: 'AIR', technique: 'T0859', detail: 'The Elektronikon web interface accepted the shipped service login from the Building 3 facilities network.' },
  ],
  pharma: [
    { sev: 'critical', title: 'Audit trail switched off on a PAS-X terminal during batch execution', kind: 'biologics', asset: 'MET', technique: 'T0872', detail: 'Audit-trail capture on a PAS-X shop-floor client in the Valais biologics suite stopped for 38 minutes while a bioreactor harvest step was being recorded. QA has placed the batch on hold until the gap is explained.' },
    { sev: 'high', title: 'DeltaV control module downloaded outside GxP change control', kind: 'biologics', asset: 'BIO', technique: 'T0843', detail: 'A control module for bioreactor 3 was downloaded from the ProfessionalPLUS station with no approved change record in ServiceNow and a batch in progress.' },
    { sev: 'high', title: 'OEM remote session reached a CIP skid PLC outside the broker', kind: 'fillfinish', asset: 'CIP', technique: 'T0886', detail: 'Remote-support traffic from the skid OEM landed on a CompactLogix at Ringaskiddy without passing BeyondTrust.' },
    { sev: 'high', title: 'Unregistered laptop on the AF-2 isolator network (from 8-hourly bundle)', kind: 'aseptic', asset: 'FIL', technique: 'T0846', detail: 'Seen in the signed bundle imported this morning: an unknown laptop browsed the isolator PLC for 11 minutes during requalification. The line is air-gapped, so this was only visible once the bundle arrived.' },
    { sev: 'medium', title: 'Lyophiliser shelf-temperature set-point changed without a batch instruction', kind: 'fillfinish', asset: 'LYO', technique: 'T0836', detail: 'Shelf set-point on lyophiliser 2 moved by 4 °C from the operator panel; no matching step in the electronic batch record.' },
    { sev: 'medium', title: 'Write to a reactor set-point from an unmapped operator station', kind: 'api', asset: 'REA', technique: 'T0855', detail: 'A PCS 7 operator station not assigned to building 4 wrote a jacket temperature set-point on reactor R-402.' },
    { sev: 'medium', title: 'Serial number batch sent to an unknown host', kind: 'packaging', asset: 'SER', technique: 'T0882', detail: 'A serialisation line controller exported a commissioned serial range to a destination that is not the L3 site server.' },
  ],
  sghospital: [
    { sev: 'critical', title: 'Drug library change pushed to Alaris pumps from an unapproved workstation', kind: 'hospital', asset: 'INF', technique: 'T0843', detail: 'A drug-library package reached 26 pumps on the Novena ICU from a workstation that is not OBH-ALARIS-SRV, with no pharmacy change approval in ServiceNow.' },
    { sev: 'high', title: 'Windows 7 MRI console probed over SMBv1 by an unknown host', kind: 'labimg', asset: 'MRW', technique: 'T0846', detail: 'An unidentified host on the Science Park imaging VLAN enumerated SMB shares on a MAGNETOM console that cannot yet be upgraded.' },
    { sev: 'high', title: 'Linac OEM session outside the booked service window', kind: 'specialist', asset: 'LIN', technique: 'T0886', detail: 'A remote service session reached a TrueBeam treatment console at Tanglin on a treatment day, with no booking in the biomedical engineering calendar.' },
    { sev: 'high', title: 'cobas analyser results sent to an unknown HL7 listener', kind: 'labimg', asset: 'LAB', technique: 'T0882', detail: 'Result messages were copied to a listener that is not the cobas infinity middleware or HealthShare.' },
    { sev: 'medium', title: 'Theatre air-change set-point changed without a work order', kind: 'daysurg', asset: 'BMS', technique: 'T0836', detail: 'BACnet write to theatre 3 air changes per hour at Punggol from the facilities subnet; nothing in the maintenance system.' },
    { sev: 'medium', title: 'Factory login accepted on a pneumatic tube station', kind: 'hospital', asset: 'PTS', technique: 'T0859', detail: 'A tube station panel at Novena accepted the shipped maintenance login.' },
  ],
  studio: [
    { sev: 'critical', title: 'Program download to a safety-rated ride controller during park hours', kind: 'park', asset: 'RCP', technique: 'T0843', detail: 'S7comm download to the fail-safe CPU of a coaster with the ride open to guests and no approved work order in the ride maintenance system.' },
    { sev: 'high', title: 'Ride manufacturer session reached a ride HMI directly', kind: 'park', asset: 'HMI', technique: 'T0886', detail: 'Remote-diagnostics traffic arrived over a 4G router in the ride cabinet rather than through the jump host; the session was not recorded.' },
    { sev: 'high', title: 'Show cue list changed from an unregistered console', kind: 'park', asset: 'SHW', technique: 'T0855', detail: 'Cue timings for an animatronic finale were edited from a console that is not on the show control register.' },
    { sev: 'high', title: 'Pump drive speed reference changed outside a work order', kind: 'waterpark', asset: 'VFD', technique: 'T0836', detail: 'A Modbus write raised the speed reference on a flume pump drive at Starfall Lagoon; no work order and the ride was open.' },
    { sev: 'medium', title: 'Unknown device on the live events ST 2110 network', kind: 'liveevents', asset: 'RTR', technique: 'T0846', detail: 'mDNS and NMOS discovery from an unregistered device on the night-time show network during rehearsal.' },
    { sev: 'medium', title: 'StarPass gate controller accepting the factory login', kind: 'resort', asset: 'GATE', technique: 'T0859', detail: 'A hotel entrance gate controller accepted the shipped administrator login over HTTP.' },
  ],
};

export function otAlerts(c: CustomerProfile, tenantId: string): OtAlert[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const r = rng(`ot-alerts-${c.id}-${tenantId}`);
  const kinds = new Set(sc.sites.map((s) => s.kind));
  return forCustomer(ALERT_SEEDS, c)
    .filter((a) => kinds.has(a.kind))
    .map((a, i) => {
      const site = sc.sites.find((s) => s.kind === a.kind) ?? sc.sites[0];
      return { id: `OTA-${r.int(10000, 99999)}`, sev: a.sev, title: a.title, site: site.name, asset: `${site.prefix}-${a.asset}-${String(r.int(1, 24)).padStart(3, '0')}`, technique: a.technique, ageMin: r.int(8, 600) * (i + 1), source: site.source, detail: a.detail };
    });
}

/** 14 days of medium+ OT alerts (oldest first). */
export function alertSeries(c: CustomerProfile, tenantId: string): { critical: number[]; high: number[]; medium: number[] } {
  const sc = otScope(c, tenantId);
  const r = rng(`ot-alert-series-${c.id}-${tenantId}`);
  const perDay = (sc.h.otAlerts * 0.3) / 30;
  const critical: number[] = [], high: number[] = [], medium: number[] = [];
  for (let i = 0; i < 14; i++) {
    const spike = i === 9 ? 1.8 : 1;
    critical.push(sc.hasOt ? Math.round(r.float(0, 0.06) * perDay * spike) : 0);
    high.push(sc.hasOt ? Math.round(r.float(0.18, 0.3) * perDay * spike) : 0);
    medium.push(sc.hasOt ? Math.round(r.float(0.6, 0.85) * perDay * spike) : 0);
  }
  return { critical, high, medium };
}

/* ------------------------------------------------------------------ */
/* Vulnerabilities                                                     */
/* ------------------------------------------------------------------ */

export const REACH_LABEL = ['Isolated (no routed path)', 'Adjacent zone only', 'Reachable from IT via conduit', 'Reachable from remote access / internet'] as const;

export interface OtVuln {
  id: string;
  cve: CveRef;
  assetType: string;
  level: PurdueLevel;
  zone: string;
  siteId: string;
  siteName: string;
  instances: number;
  reach: 0 | 1 | 2 | 3;
  path: string;
  consequence: number;
  consequenceText: string;
  controls: string[];
  patch: PatchState;
  fixedIn: string;
  running: string;
  priority: number;
  advisoryDaysAgo: number;
  status: 'Open' | 'Mitigated' | 'Risk accepted' | 'Planned (outage)';
  acceptance?: { ref: string; owner: string; approvedDaysAgo: number; reviewInDays: number; safetyCase: string; conditions: string };
}

export function otVulns(c: CustomerProfile, tenantId: string): OtVuln[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const r = rng(`ot-vulns-${c.id}-${tenantId}`);
  const types = forCustomer(TYPES, c);
  const owner = c.people.otLead?.name ?? c.people.ciso.name;
  const groups: Omit<OtVuln, 'instances'>[] = [];
  const weights: number[] = [];
  for (const m of forCustomer(VULN_MAP, c)) {
    const t = types.find((x) => x.name === m.type);
    const cve = OT_CVE_BY_ID[m.cve];
    if (!t || !cve) continue;
    for (const site of sc.sites.filter((s) => t.kinds.includes(s.kind))) {
      const prio = Math.round(Math.min(99, cve.cvss * 10 * (0.34 + m.reach * 0.22) * (0.55 + t.consequence * 0.09) * (cve.kev ? 1.15 : 1) / (1 + m.controls.length * 0.1)));
      const accepted = m.patch === 'Unpatchable by design (safety case)';
      groups.push({
        id: `OTV-${site.prefix}-${m.cve.slice(4)}-${t.abbr}`,
        cve, assetType: t.name, level: t.level, zone: t.zone, siteId: site.id, siteName: site.name, reach: m.reach, path: m.path,
        consequence: t.consequence, consequenceText: t.consequenceText, controls: m.controls, patch: m.patch,
        fixedIn: m.patch === 'No vendor fix' || accepted ? '—' : t.fw[t.fw.length - 1], running: t.fw[Math.max(0, t.fw.length - 2 - r.int(0, 1))],
        priority: Math.max(5, prio + r.int(-4, 4)),
        advisoryDaysAgo: r.int(2, 700),
        status: accepted ? 'Risk accepted' : m.patch === 'Patch needs outage window' ? 'Planned (outage)' : r.chance(0.15) ? 'Mitigated' : 'Open',
        acceptance: accepted ? {
          ref: `RA-OT-${r.int(100, 999)}`, owner, approvedDaysAgo: r.int(30, 300), reviewInDays: r.weighted<number>([[r.int(-21, -2), 1], [r.int(5, 40), 2], [r.int(60, 180), 3]]),
          safetyCase: `SC-${site.prefix}-${r.int(10, 99)}`, conditions: `Compensating: ${m.controls.join('; ')}. Re-assess on any conduit change.`,
        } : undefined,
      });
      weights.push((sc.siteAssets[site.id] ?? 1) * t.share * (m.reach + 1));
    }
  }
  const counts = distribute(sc.h.otVulns, weights);
  return groups.map((g, i) => ({ ...g, instances: Math.max(1, counts[i]) })).sort((a, b) => b.priority - a.priority);
}


/* ------------------------------------------------------------------ */
/* OT penetration testing (programme view, high level only)            */
/* ------------------------------------------------------------------ */

export const OT_PHASES = ['Scoping', 'Safety review', 'Passive discovery', 'Approved validation', 'Report'] as const;
export type GateState = 'passed' | 'in review' | 'pending' | 'blocked' | 'skipped';
export type EngagementStatus = 'Scoping' | 'Awaiting safety approval' | 'In progress' | 'Paused (stop condition)' | 'Reporting' | 'Complete';

export interface OtEngagement {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  objective: string;
  status: EngagementStatus;
  phase: number;
  gates: GateState[];
  scope: 'Passive only' | 'Approved active (bounded)';
  scopeDetail: string;
  safetyCase: { ref: string; status: 'Approved' | 'In review' | 'Draft' };
  approvers: { name: string; role: string; decision: 'approved' | 'pending' }[];
  changeWindow: string;
  changeRef: string;
  stopConditions: string[];
  humanOnLoop: string;
  lead: string;
  standards: string[];
  startDaysAgo: number;
  endInDays: number;
  zones: string[];
}

export interface FindingCategory {
  id: string;
  name: string;
  desc: string;
  advice: string;
  srs: string[];
  iacs: string[];
}

export const FINDING_CATEGORIES: FindingCategory[] = [
  { id: 'creds', name: 'Default or shared credentials', desc: 'Devices still accept factory or widely shared logins.', advice: 'Change to unique credentials held in the PAM vault; where a device cannot, restrict who can reach it.', srs: ['SR 1.1', 'SR 1.5'], iacs: ['UR E27 · SR 1.5', 'UR E26 · Protect (access control)'] },
  { id: 'flat', name: 'Flat network segments', desc: 'Zones that should be separate share one network with no boundary control.', advice: 'Introduce zone boundaries with allow-listed conduits; start with the highest-consequence zone.', srs: ['SR 5.1', 'SR 5.2'], iacs: ['UR E26 · Protect (network segregation)', 'UR E27 · SR 5.1'] },
  { id: 'proto', name: 'Unauthenticated industrial protocols', desc: 'Control commands are accepted from any host that can reach the device.', advice: 'Limit which hosts may send commands, enable protocol security where the vendor supports it, and monitor writes.', srs: ['SR 3.1', 'SR 1.2'], iacs: ['UR E27 · SR 3.1', 'UR E26 · Detect (anomaly monitoring)'] },
  { id: 'remote', name: 'Vendor remote-access paths', desc: 'Supplier connections reach control systems without the brokered, recorded route.', advice: 'Route all vendor sessions through the PAM broker with approval, MFA and recording; remove direct tools and modems.', srs: ['SR 1.13', 'SR 2.6'], iacs: ['UR E26 · Protect (remote access)', 'UR E27 · SR 1.13'] },
  { id: 'media', name: 'Removable-media handling', desc: 'USB and portable media reach control stations without scanning or control.', advice: 'Use a scanning kiosk and approved media only; disable unused ports on engineering and bridge stations.', srs: ['SR 2.3', 'SR 3.2'], iacs: ['UR E26 · Protect (mobile & portable devices)', 'UR E27 · SR 2.3'] },
  { id: 'logging', name: 'Monitoring and logging gaps', desc: 'Security events from some zones are not collected or retained.', advice: 'Extend passive sensor coverage and forward device logs to the SIEM through the DMZ collector.', srs: ['SR 2.8', 'SR 6.2'], iacs: ['UR E26 · Detect', 'UR E27 · SR 6.2'] },
  { id: 'legacy', name: 'Unsupported operating systems', desc: 'Hosts in control zones run software that no longer receives security fixes.', advice: 'Plan replacement with the OEM; meanwhile isolate the host and allow-list its applications.', srs: ['SR 3.2', 'SR 7.6'], iacs: ['UR E26 · Protect (software maintenance)', 'UR E27 · SR 3.2'] },
];
export const CATEGORY_BY_ID: Record<string, FindingCategory> = Object.fromEntries(FINDING_CATEGORIES.map((f) => [f.id, f]));

export interface OtTestFinding {
  id: string;
  engagementId: string;
  engagement: string;
  siteName: string;
  category: string;
  title: string;
  zone: string;
  sev: Severity;
  status: 'Open' | 'In remediation' | 'Remediated' | 'Risk accepted';
  owner: string;
  foundDaysAgo: number;
  remediatedDaysAgo?: number;
}

interface EngSeed {
  site: string;
  name: string;
  objective: string;
  phase: number;
  status: EngagementStatus;
  scope: OtEngagement['scope'];
  scopeDetail: string;
  zones: string[];
  standards: string[];
  findings: [string, Severity, string, string][]; // category, sev, plain title, zone
}

const ENG_SEEDS: CustomerMap<EngSeed[]> = {
  maritime: [
    { site: 'rtm', name: 'Maasvlakte STS crane network assessment', objective: 'Confirm crane control zones are isolated from terminal IT and vendor paths', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture on SPAN ports at crane control and DMZ switches; nothing is sent to controllers', zones: ['Crane control', 'OT DMZ', 'Terminal operations'], standards: ['IEC 62443-3-3', 'IEC 62443-2-1'],
      findings: [['proto', 'high', 'Crane PLCs accept programme commands from any host on the crane VLAN', 'Crane control'], ['flat', 'high', 'Crane HMIs and maintenance laptops share one segment across 6 STS cranes', 'Crane control'], ['remote', 'critical', 'A vendor remote-support tool reaches a crane HMI without the PAM broker', 'Crane control'], ['logging', 'medium', 'Crane drive events are not forwarded to the SIEM', 'Crane control']] },
    { site: 'fleet', name: 'Halcyon Aurora IACS E26/E27 assessment', objective: 'Evidence for class survey: vessel network segregation and supplier access', phase: 3, status: 'In progress', scope: 'Approved active (bounded)', scopeDetail: 'Bounded checks on the vessel DMZ and crew network only, at berth in Rotterdam; engine and bridge networks passive-only', zones: ['Vessel DMZ', 'Bridge & navigation', 'Machinery & propulsion', 'Cargo & ballast'], standards: ['IACS UR E26', 'IACS UR E27', 'IMO MSC.428(98)'],
      findings: [['creds', 'high', 'Ballast treatment controller still uses the factory password', 'Cargo & ballast'], ['flat', 'high', 'Crew Wi-Fi can reach the bridge shared folder used for chart updates', 'Bridge & navigation'], ['media', 'medium', 'ECDIS chart updates arrive on unscanned USB sticks', 'Bridge & navigation'], ['remote', 'high', 'OEM diagnostics link bypasses the shore PAM broker over LEO', 'Machinery & propulsion'], ['legacy', 'medium', 'Cargo station runs an operating system past vendor support', 'Cargo & ballast'], ['logging', 'low', 'Vessel firewall logs held on board for up to 6 hours', 'Vessel DMZ']] },
    { site: 'ant', name: 'Antwerp AGV yard automation segmentation review', objective: 'Validate the new yard automation zone before 40 more vehicles go live', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks on the AGV maintenance VLAN during a yard shutdown; vehicle controllers passive-only', zones: ['Yard automation', 'OT DMZ'], standards: ['IEC 62443-3-3'], findings: [] },
    { site: 'pkl', name: 'Port Klang gate and reefer scoping', objective: 'Agree scope after unexpected IT-to-gate traffic was observed', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: sensor feed review and architecture walkthrough', zones: ['Gate & access', 'Reefer'], standards: ['IEC 62443-3-3'], findings: [] },
    { site: 'sts', name: 'Santos substation and power assessment', objective: 'Assess substation conduits after the electrical upgrade', phase: 4, status: 'Reporting', scope: 'Passive only', scopeDetail: 'Passive capture on the station bus and the substation conduit', zones: ['Power & substation', 'Terminal operations'], standards: ['IEC 62443-3-3', 'IEC 61850-90-2'],
      findings: [['proto', 'medium', 'Substation RTU accepts unauthenticated control messages from the terminal network', 'Power & substation'], ['creds', 'medium', 'Two protection relays share a common maintenance password', 'Power & substation'], ['logging', 'low', 'Station bus events are not retained beyond 7 days', 'Power & substation']] },
  ],
  finserv: [
    { site: 'slough', name: 'Slough DC1 power and cooling assessment', objective: 'Operational resilience: prove facilities control cannot be reached from corporate IT', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture on BMS and power monitoring networks; no writes to controllers', zones: ['BMS & DCIM', 'Power (UPS, generators)', 'Cooling (CRAC)'], standards: ['IEC 62443-3-3', 'FCA SYSC 15A'],
      findings: [['creds', 'high', 'Generator controllers accept the manufacturer default PIN', 'Power (UPS, generators)'], ['proto', 'medium', 'Cooling set-points can be changed by any host on the BMS network', 'Cooling (CRAC)'], ['flat', 'medium', 'Physical access controllers share the BMS network', 'Physical security']] },
    { site: 'basildon', name: 'Basildon DC2 vendor access review', objective: 'Remove supplier access paths outside the facilities DMZ', phase: 3, status: 'Paused (stop condition)', scope: 'Approved active (bounded)', scopeDetail: 'Bounded checks on supplier modems only, with the cooling vendor engineer on site', zones: ['Cooling (CRAC)', 'Facilities DMZ'], standards: ['IEC 62443-3-3', 'DORA Art. 28'],
      findings: [['remote', 'critical', 'A cooling unit has a vendor cellular modem outside the facilities DMZ', 'Cooling (CRAC)'], ['logging', 'medium', 'Supplier sessions to UPS cards are not recorded', 'Power (UPS, generators)']] },
    { site: 'atm', name: 'UK ATM estate segmentation validation', objective: 'Confirm branch LAN cannot reach the ATM network after the router refresh', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks from 4 sample branches out of hours; no interaction with dispensers', zones: ['ATM network'], standards: ['PCI DSS 1.3', 'IEC 62443-3-3'], findings: [] },
    { site: 'ny5', name: 'Equinix NY5 cage facilities scoping', objective: 'Agree responsibilities with the colocation provider', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: document review and interviews', zones: ['Power (UPS, generators)'], standards: ['NYDFS 500.11'], findings: [] },
  ],
  media: [
    { site: 'atl', name: 'Atlanta ST 2110 plant assessment', objective: 'Ensure live playout and timing cannot be disrupted from corporate IT or vendor tunnels', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture on the media fabric spine and control VLAN; no NMOS or PTP messages sent', zones: ['ST 2110 media fabric', 'Timing (PTP)', 'Playout & automation'], standards: ['IEC 62443-3-3', 'DPP CtS Broadcast'],
      findings: [['proto', 'high', 'Routing changes are accepted from any controller on the control VLAN', 'ST 2110 media fabric'], ['remote', 'high', 'An OEM support tunnel lands inside playout, bypassing the broadcast DMZ', 'Playout & automation'], ['flat', 'medium', 'Producer laptops can join the 2110 control VLAN in Studio B', 'ST 2110 media fabric'], ['logging', 'low', 'Timing events are not forwarded to the SIEM', 'Timing (PTP)']] },
    { site: 'burbank', name: 'Burbank stages lighting and BMS', objective: 'Review lighting control exposure before the Nightjar reshoot block', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: rig network capture during pre-light', zones: ['Lighting', 'Facilities'], standards: ['IEC 62443-3-3'], findings: [] },
    { site: 'soho', name: 'Soho machine room power review', objective: 'Confirm UPS management is isolated from the post network', phase: 4, status: 'Complete', scope: 'Passive only', scopeDetail: 'Passive capture on the facilities VLAN', zones: ['Facilities'], standards: ['IEC 62443-3-3'],
      findings: [['creds', 'medium', 'UPS management cards used a shared password', 'Facilities'], ['legacy', 'low', 'BMS head-end runs an unsupported OS build', 'Facilities']] },
  ],
  healthcare: [
    { site: 'mrmc', name: 'Medical Center infusion & monitoring network assessment', objective: 'Show that pump and monitor networks cannot be reached from clinical IT or vendor paths', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture on device-VLAN SPAN ports; nothing is sent to pumps, monitors or ventilators', zones: ['Infusion', 'Patient monitoring', 'Medical device DMZ'], standards: ['IEC 62443-3-3', 'IEC 80001-1', 'HHS HPH CPGs'],
      findings: [['flat', 'high', 'Infusion pumps and smart beds share one wireless network on four floors', 'Infusion'], ['remote', 'high', 'An imaging OEM service tunnel reaches modality consoles without the access broker', 'Imaging'], ['proto', 'medium', 'The monitoring gateway accepts unauthenticated HL7 connections from the clinical network', 'Patient monitoring'], ['legacy', 'medium', 'Several modality consoles run an operating system past vendor support', 'Imaging']] },
    { site: 'mar', name: 'Marion device network segmentation review', objective: 'Confirm pumps cannot join staff Wi-Fi after the access-point swap', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks on the device DMZ in a low-census window with biomed on site; no traffic to pumps or monitors', zones: ['Medical device DMZ', 'Infusion'], standards: ['IEC 62443-3-3', 'HHS HPH CPGs'], findings: [] },
    { site: 'clp', name: 'Central pharmacy automation review', objective: 'Assess dispensing cabinets and the tube system after PwnedPiper advisories', phase: 4, status: 'Reporting', scope: 'Passive only', scopeDetail: 'Passive capture on pharmacy and facilities VLANs', zones: ['Pharmacy', 'Building & environment'], standards: ['IEC 62443-3-3', 'HITRUST CSF'],
      findings: [['creds', 'medium', 'Dispensing cabinets share a common service account', 'Pharmacy'], ['creds', 'high', 'Tube-system panels still accept the shipped maintenance login', 'Building & environment'], ['logging', 'low', 'Tube-system events are not forwarded to the SIEM', 'Building & environment']] },
    { site: 'kids', name: "Children's NICU monitoring scoping", objective: 'Agree scope with clinical leadership for the NICU monitoring refresh', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: architecture walkthrough and sensor feed review', zones: ['Patient monitoring'], standards: ['IEC 80001-1'], findings: [] },
  ],
  automotive: [
    { site: 'ing', name: 'Ingolstadt body-shop robot cell assessment', objective: 'Prove robot cells and safety PLCs cannot be reached from IT or OEM service paths', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture at cell and DMZ switches; nothing is sent to PLCs or robots', zones: ['Press & body shop', 'Plant DMZ'], standards: ['IEC 62443-3-3', 'TISAX AL3 (VDA ISA 6)'],
      findings: [['remote', 'critical', 'A robot OEM remote-service path reaches robot controllers without the jump host', 'Press & body shop'], ['proto', 'high', 'Safety PLCs accept programme changes from any engineering station on the cell network', 'Press & body shop'], ['flat', 'medium', 'Vision cameras and torque controllers share the line network with HMIs', 'Final assembly & EOL'], ['logging', 'low', 'Robot controller events are not forwarded to the SIEM', 'Press & body shop']] },
    { site: 'szg', name: 'Salzgitter cell plant offline assessment', objective: 'Validate the air gap and the signed bundle export before series ramp-up', phase: 3, status: 'In progress', scope: 'Approved active (bounded)', scopeDetail: 'Bounded checks on the cell-plant DMZ and the bundle export path only, on site (no remote path exists); formation racks passive-only', zones: ['Formation & ageing', 'Dry rooms & HVAC', 'Plant DMZ'], standards: ['IEC 62443-3-3', 'IEC 62443-2-1', 'NIS2 Art. 21'],
      findings: [['media', 'high', 'Engineering laptops connect to the formation network without passing the media kiosk', 'Formation & ageing'], ['creds', 'medium', 'Dry-room HVAC controllers use a shared vendor password', 'Dry rooms & HVAC'], ['logging', 'medium', 'Security events wait up to 6 hours for the signed bundle before the SOC sees them', 'Plant DMZ']] },
    { site: 'pue', name: 'Puebla final assembly and EOL segmentation', objective: 'Stop EOL benches pulling vehicle software from corporate shares', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks from the MES network during the Sunday shutdown; EOL benches and AGVs passive-only', zones: ['Final assembly & EOL', 'Intralogistics (AGV)'], standards: ['IEC 62443-3-3', 'UNECE R155 (production)'], findings: [] },
    { site: 'gyr', name: 'Győr e-drive line scoping', objective: 'Scope the new inverter line before handover from the integrator', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: integrator documentation and sensor placement', zones: ['MES & line control'], standards: ['IEC 62443-3-3', 'IEC 62443-2-4'], findings: [] },
    { site: 'inp', name: 'Ingolstadt paint shop review', objective: 'Review paint robot cells after the controller refresh', phase: 4, status: 'Complete', scope: 'Passive only', scopeDetail: 'Passive capture on the paint-shop network', zones: ['Paint shop'], standards: ['IEC 62443-3-3'],
      findings: [['legacy', 'medium', 'Paint cell PCs run an unsupported operating system build', 'Paint shop'], ['creds', 'low', 'Paint cell HMIs used a shared operator password', 'Paint shop']] },
  ],
  insurance: [
    { site: 'wdc1', name: 'Windsor DC1 power and cooling assessment', objective: 'Show that UPS, generator and cooling control cannot be reached from corporate IT or vendor modems', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture on the BMS and power monitoring networks; nothing is written to controllers', zones: ['BMS & DCIM', 'Power (UPS, generators)', 'Cooling (CRAC)'], standards: ['IEC 62443-3-3', 'NYDFS 500.16'],
      findings: [['remote', 'critical', 'A cooling unit has a vendor diagnostics modem outside the facilities DMZ', 'Cooling (CRAC)'], ['creds', 'high', 'Generator controllers still accept the factory PIN', 'Power (UPS, generators)'], ['proto', 'medium', 'Any host on the BMS network can change cooling set-points', 'BMS & DCIM'], ['flat', 'medium', 'Access controllers share the BMS network', 'Physical security']] },
    { site: 'hpm', name: 'Hartford print & mail plant segmentation review', objective: 'Keep policyholder mail production separate from the claims office network', phase: 4, status: 'Reporting', scope: 'Passive only', scopeDetail: 'Passive capture on the mail floor and print production VLANs', zones: ['Print & mail production', 'Physical security'], standards: ['IEC 62443-3-3', 'NAIC #668 Sec. 4'],
      findings: [['flat', 'high', 'Claims file servers can drop jobs straight onto the print workflow server', 'Print & mail production'], ['creds', 'medium', 'Inserter consoles share one operator password', 'Print & mail production'], ['legacy', 'medium', 'The mail-piece integrity server still needs SMBv1 for inserter files', 'Print & mail production'], ['logging', 'low', 'Print workflow job logs are not forwarded to Splunk', 'Print & mail production']] },
    { site: 'phx2', name: 'Phoenix DC2 colocation facilities scoping', objective: 'Agree with the colocation provider who watches power and cooling for the recovery suite', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: contract review and interviews with the provider', zones: ['Power (UPS, generators)', 'Cooling (CRAC)'], standards: ['NYDFS 500.11', 'IEC 62443-2-4'], findings: [] },
  ],
  defence: [
    { site: 'b3', name: 'Building 3 machine shop network assessment', objective: 'Prove CNC, DNC and heat-treat networks cannot be reached from engineering IT or vendor paths', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture at the shop-floor DMZ and cell switches; nothing is sent to machine controls', zones: ['CNC machining', 'DNC & inspection', 'Shop-floor DMZ'], standards: ['IEC 62443-3-3', 'NIST SP 800-82r3', 'NIST SP 800-171 3.13.1'],
      findings: [['remote', 'critical', 'Machine-tool service engineers reach CNC controls over cellular hotspots', 'CNC machining'], ['flat', 'high', 'CAM stations on the engineering network can send programmes straight to machines', 'CNC machining'], ['legacy', 'medium', 'Two CMM stations run an unsupported operating system', 'DNC & inspection'], ['logging', 'low', 'CNC control events are not forwarded to Sentinel', 'CNC machining']] },
    { site: 'tus', name: 'Tucson test range segmentation validation', objective: 'Confirm the office network cannot reach ATE benches, chambers or the shaker before campaign 26-05', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks from the office network between test campaigns; chambers, shaker and telemetry passive-only', zones: ['Test data & ATE', 'Environmental test', 'Range telemetry'], standards: ['IEC 62443-3-3', 'NIST SP 800-171 3.13.1'], findings: [] },
    { site: 'b3', name: 'Building 3 heat-treat cell review', objective: 'Review the furnace controller after the ControlLogix migration', phase: 4, status: 'Complete', scope: 'Passive only', scopeDetail: 'Passive capture on the heat-treat cell network', zones: ['Heat treat'], standards: ['IEC 62443-3-3', 'AS9100D 8.5.1'],
      findings: [['proto', 'medium', 'The furnace controller accepted set-point writes from any station on the cell network', 'Heat treat'], ['creds', 'low', 'The heat-treat HMI used a shared operator login', 'Heat treat']] },
  ],
  pharma: [
    { site: 'vls-bio', name: 'Valais biologics DCS assessment', objective: 'Show that DeltaV and bioreactor networks cannot be reached from enterprise IT, R&D or OEM paths', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture at the plant DMZ and DeltaV area switches; nothing is sent to controllers', zones: ['Upstream & downstream (DeltaV)', 'MES & batch records', 'Plant DMZ'], standards: ['IEC 62443-3-3', 'GAMP 5 (2nd ed.)', 'EU GMP Annex 11'],
      findings: [['flat', 'high', 'An R&D notebook can read bioreactor data straight from a DeltaV station', 'Upstream & downstream (DeltaV)'], ['proto', 'medium', 'DeltaV historian collection still uses OPC DA over DCOM', 'MES & batch records'], ['logging', 'medium', 'PAS-X audit-trail gaps are not alerted on in real time', 'MES & batch records'], ['creds', 'low', 'Two operator stations share a service account', 'Upstream & downstream (DeltaV)']] },
    { site: 'vls-af2', name: 'AF-2 aseptic line offline assessment', objective: 'Validate the air gap and the data-diode bundle export ahead of the Annex 1 inspection', phase: 3, status: 'In progress', scope: 'Approved active (bounded)', scopeDetail: 'Bounded checks on the bundle export path and the line DMZ only, on site (no remote path exists); isolator and lyophiliser passive-only', zones: ['Aseptic filling', 'Fill-finish & lyophilisation', 'Plant DMZ'], standards: ['IEC 62443-3-3', 'EU GMP Annex 1', 'NIS2 Art. 21'],
      findings: [['media', 'high', 'Requalification laptops connect to the isolator network without passing the media kiosk', 'Aseptic filling'], ['creds', 'medium', 'The isolator HMI uses a shared supervisor login', 'Aseptic filling'], ['logging', 'medium', 'Security events wait up to 8 hours for the signed bundle before the SOC sees them', 'Plant DMZ']] },
    { site: 'crk-ff', name: 'Cork fill-finish vendor access review', objective: 'Remove OEM access paths that bypass the BeyondTrust broker', phase: 3, status: 'Paused (stop condition)', scope: 'Approved active (bounded)', scopeDetail: 'Bounded checks on OEM access routes only, with the skid OEM engineer and QA on site', zones: ['Clean utilities (CIP/SIP)', 'Fill-finish & lyophilisation'], standards: ['IEC 62443-3-3', 'IEC 62443-2-4'],
      findings: [['remote', 'critical', 'A CIP skid is reachable by its OEM outside the broker', 'Clean utilities (CIP/SIP)'], ['logging', 'medium', 'Dragos feed gaps during the WAN failover hide utilities traffic', 'Clean utilities (CIP/SIP)']] },
    { site: 'crk-pk', name: 'Cork serialisation line segmentation', objective: 'Stop SAP from writing to line controllers directly', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks from the SAP integration network during a packaging changeover; line controllers passive-only', zones: ['Serialisation & packaging'], standards: ['IEC 62443-3-3', 'EU FMD (Delegated Reg. 2016/161)'], findings: [] },
    { site: 'vls-api', name: 'Valais API plant PCS 7 review', objective: 'Review the PCS 7 V9.1 upgrade before handover to production', phase: 4, status: 'Complete', scope: 'Passive only', scopeDetail: 'Passive capture on the PCS 7 plant and terminal bus', zones: ['API synthesis (PCS 7)'], standards: ['IEC 62443-3-3', 'GAMP 5 (2nd ed.)'],
      findings: [['legacy', 'medium', 'Two operator stations ran an operating system build past support', 'API synthesis (PCS 7)'], ['creds', 'low', 'Engineering station used a shared project password', 'API synthesis (PCS 7)']] },
  ],
  sghospital: [
    { site: 'novena', name: 'Novena infusion & monitoring network assessment', objective: 'Show that pump and monitor networks cannot be reached from clinical IT, staff Wi-Fi or OEM paths', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture on device-VLAN SPAN ports; nothing is sent to pumps, monitors or ventilators', zones: ['Infusion', 'Patient monitoring', 'Medical device DMZ'], standards: ['IEC 62443-3-3', 'IEC 80001-1', 'MOH CS/DS Essentials'],
      findings: [['flat', 'high', 'Agilia and Alaris pumps share one wireless network with smart devices on three wards', 'Infusion'], ['proto', 'medium', 'The central monitoring station accepts HL7 connections from any clinical host', 'Patient monitoring'], ['creds', 'medium', 'Pneumatic tube stations accept the shipped maintenance login', 'Building & environment'], ['logging', 'low', 'Pump server events are not forwarded to Sentinel', 'Infusion']] },
    { site: 'sciencepark', name: 'Science Park legacy imaging console review', objective: 'Contain Windows 7 imaging consoles until the OEM upgrade', phase: 4, status: 'Reporting', scope: 'Passive only', scopeDetail: 'Passive capture on the imaging and lab VLANs', zones: ['Imaging', 'Laboratory'], standards: ['IEC 62443-3-3', 'HSA GL-04'],
      findings: [['legacy', 'high', 'MRI consoles run Windows 7 and need SMBv1 for film export', 'Imaging'], ['remote', 'high', 'An imaging OEM VPN box bypasses CyberArk Vendor PAM', 'Imaging'], ['logging', 'medium', 'Analyser and LIS events are not retained beyond 7 days', 'Laboratory']] },
    { site: 'punggol', name: 'Punggol day-surgery device segmentation validation', objective: 'Confirm pumps cannot join the staff SSID after the wireless upgrade', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks on the device DMZ after the last theatre list, with biomedical engineering on site; no traffic to pumps or monitors', zones: ['Medical device DMZ', 'Infusion'], standards: ['IEC 62443-3-3', 'CSA Cyber Trust'], findings: [] },
    { site: 'tanglin', name: 'Tanglin radiation oncology scoping', objective: 'Agree scope with the oncology centre for linac and ARIA monitoring', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: architecture walkthrough with the radiation oncology physicists', zones: ['Radiation oncology'], standards: ['IEC 80001-1', 'HSA GL-04'], findings: [] },
  ],
  studio: [
    { site: 'orl-park', name: 'Starfall Studios Park ride control assessment', objective: 'Prove ride control and safety PLCs cannot be reached from corporate IT or ride OEM paths', phase: 2, status: 'In progress', scope: 'Passive only', scopeDetail: 'Passive capture at the ride & show DMZ and ride cabinet switches; nothing is sent to ride controllers', zones: ['Ride control', 'Ride & show DMZ'], standards: ['IEC 62443-3-3', 'ASTM F2291'],
      findings: [['proto', 'high', 'Safety PLCs accept programme changes from any engineering station on the ride network', 'Ride control'], ['flat', 'medium', 'Show control and ride HMIs share a network in two attractions', 'Show control & media'], ['remote', 'high', 'A ride OEM diagnostics router sits inside a ride cabinet', 'Ride control'], ['logging', 'low', 'Ride HMI events are not forwarded to Google SecOps', 'Ride control']] },
    { site: 'osa-park', name: 'Starfall Park Osaka ride network segmentation', objective: 'Validate ride zones before the new coaster opens', phase: 1, status: 'Awaiting safety approval', scope: 'Approved active (bounded)', scopeDetail: 'Proposed: bounded checks from the DMZ after park close; ride controllers passive-only', zones: ['Ride control', 'Ride & show DMZ'], standards: ['IEC 62443-3-3'], findings: [] },
    { site: 'orl-lagoon', name: 'Starfall Lagoon pump-house review', objective: 'Review water ride drives after the filtration upgrade', phase: 4, status: 'Reporting', scope: 'Passive only', scopeDetail: 'Passive capture on the pump-house network', zones: ['Water rides'], standards: ['IEC 62443-3-3'],
      findings: [['media', 'medium', 'Contractor laptops connect to the pump-house network unchecked', 'Water rides'], ['creds', 'medium', 'Pump drives use one shared maintenance password', 'Water rides']] },
    { site: 'orl-live', name: 'Night-time spectacular show control scoping', objective: 'Scope the ST 2110, media and pyrotechnic networks before the holiday show', phase: 0, status: 'Scoping', scope: 'Passive only', scopeDetail: 'Passive only: rig documentation review and sensor placement during rehearsals', zones: ['Live events', 'Show control & media'], standards: ['IEC 62443-3-3', 'NFPA 1123'], findings: [] },
    { site: 'osa-resort', name: 'Osaka hotels gate and BMS review', objective: 'Separate StarPass gates and hotel BMS from guest Wi-Fi', phase: 4, status: 'Complete', scope: 'Passive only', scopeDetail: 'Passive capture on hotel back-of-house VLANs', zones: ['Guest entry', 'Building & life safety'], standards: ['IEC 62443-3-3', 'PCI DSS 1.3'],
      findings: [['flat', 'medium', 'Gate controllers answered on the guest Wi-Fi', 'Guest entry'], ['creds', 'low', 'Gate controllers used the shipped administrator login', 'Guest entry']] },
  ],
};

const STOP_COMMON = [
  'Any unexpected change of controller state or mode',
  'Loss of view on any operator HMI',
  'Operations supervisor or safety officer calls stop',
  'Traffic above the agreed rate on any conduit',
];
const STOP_SECTOR: CustomerMap<string[]> = {
  maritime: ['Vessel leaves berth or cargo operations begin', 'Any crane, AGV or vessel system alarm during the window'],
  finserv: ['Any UPS, generator or cooling alarm in the data hall', 'Live incident declared by the crisis team'],
  media: ['A live event goes on air on the affected plant', 'Any PTP lock loss or multiviewer alarm'],
  healthcare: ['Any patient-care alarm or device alert on the affected unit', 'Census surge or mass-casualty plan activated'],
  automotive: ['Any robot, press or conveyor stop on the affected line', 'Line restart or shift handover begins'],
  insurance: ['Any UPS, generator or cooling alarm in a data hall', 'A catastrophe claims surge is declared or a statutory mailing run is in progress'],
  defence: ['Any spindle, furnace or chamber alarm in the affected cell', 'A qualification test run or first-article inspection begins'],
  pharma: ['Any pressure-cascade, EMS or batch-critical alarm in the affected suite', 'A GMP batch enters an aseptic or sterilisation step'],
  sghospital: ['Any patient-care alarm or device alert on the affected ward', 'A Code Red or mass-casualty plan is activated, or a linac treatment session begins'],
  studio: ['Any ride e-stop, block fault or restraint alarm on the affected attraction', 'The park opens to guests or a show performance begins'],
};

const SITE_PEOPLE: CustomerMap<[string, string][]> = {
  maritime: [['Joost van Dam', 'Terminal Director'], ['Capt. Lars Eriksen', 'Head of Fleet Operations'], ['Tomasz Nowak', 'Crane Maintenance Supervisor'], ['Aisha Rahman', 'Terminal IT Manager'], ['Bruno Carvalho', 'Terminal Engineer']],
  finserv: [['Graham Holt', 'Head of DC Facilities'], ['Priya Natarajan', 'Head of Operational Resilience'], ['Laura Fitzgerald', 'Payments Ops Engineer'], ['Owen Price', 'Security Platform Owner']],
  media: [['Marcus Dupree', 'Broadcast Engineering Manager'], ['Ethan Brooks', 'Playout Engineer'], ['Oliver Grant', 'Head of Post'], ['Chloe Park', 'IT Platforms Manager']],
  healthcare: [['Priya Desai', 'Biomedical Engineer'], ['Angela Torres', 'Chief Nursing Officer'], ['Ben Carter', 'Radiology PACS Administrator'], ['Grace Nguyen', 'Charge Nurse, ICU']],
  automotive: [['Andreas Schulz', 'Robotics Maintenance Lead, Ingolstadt'], ['Hana Novak', 'Battery Process Engineer'], ['Lucía Romero', 'MES Engineer, Puebla'], ['Péter Nagy', 'Plant IT Manager, Győr']],
  insurance: [['Dave Rinaldi', 'Data Centre Facilities Manager, Windsor'], ['Paul Fenwick', 'Print & Mail Plant Manager, Hartford'], ['Grace Whitfield', 'Premium Billing Operations Manager'], ['Kevin Brennan', 'Security Platform Owner']],
  defence: [['Jamal Henderson', 'CNC Programming Lead, Building 3'], ['Tessa Moreno', 'Test Range Manager, Tucson'], ['Shawn McAllister', 'Vice President, Operations & Manufacturing'], ['Holly Burkett', 'Facility Security Officer']],
  pharma: [['Marco Gerber', 'MES & Automation Lead, Valais'], ['Dr. Reto Schmid', 'Qualified Person (QP), Valais'], ["Sarah O'Connell", 'Site Head, Cork Fill-Finish'], ['Fabian Imhof', 'Head of Global Manufacturing & Supply']],
  sghospital: [['Farah Iskandar', 'Biomedical Engineer'], ['Weijie Ho', 'Radiology PACS Administrator'], ['Joel Tay', 'Senior Nurse Manager, ICU'], ['Clara Seah', 'Director of Quality & Patient Safety']],
  studio: [['Hiroshi Tanaka', 'Ride Systems Engineer, Osaka'], ['Carla Mendes', 'Ride Maintenance Manager, Orlando'], ['Jordan Pike', 'Show Control Lead, Orlando'], ['James Thornton', 'Chairman, Parks & Experiences']],
};
const TESTERS = ['Elena Varga', 'Tom Ridley', 'Yusuf Demir', 'Sakura Ito'];

/** When a bounded active test window may run, in the customer's own operating terms. */
const WINDOW_NOTE: CustomerMap<string> = {
  maritime: 'at berth, no cargo ops',
  finserv: 'facilities maintenance window',
  media: 'no live events',
  healthcare: 'low-census window, biomed on site',
  automotive: 'production shutdown',
  insurance: 'facilities maintenance window, no mailing run',
  defence: 'shop-floor shutdown, no test runs',
  pharma: 'campaign changeover, QA on site',
  sghospital: 'after the last theatre list, biomed on site',
  studio: 'park closed, ride maintenance shift',
};

export function otEngagements(c: CustomerProfile, tenantId: string): OtEngagement[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const r = rng(`ot-eng-${c.id}`);
  const siteIds = new Set(sc.sites.map((s) => s.id));
  const lead = c.people.otLead ?? c.people.ciso;
  const people = forCustomer(SITE_PEOPLE, c);
  return forCustomer(ENG_SEEDS, c).map((e, i): OtEngagement => {
    const site = forCustomer(SITES, c).find((s) => s.id === e.site) ?? forCustomer(SITES, c)[0];
    const passive = e.scope === 'Passive only';
    const gates: GateState[] = OT_PHASES.map((_, k) => {
      if (passive && k === 3) return 'skipped';
      if (k < e.phase) return 'passed';
      if (k === e.phase) return e.status === 'Paused (stop condition)' ? 'blocked' : e.status === 'Complete' ? 'passed' : 'in review';
      return 'pending';
    });
    const approved = e.phase >= 2;
    const owner = people[i % people.length];
    const hotl = people[(i + 1) % people.length];
    const approvers: OtEngagement['approvers'] = [
      { name: lead.name, role: lead.role, decision: approved || e.phase === 1 ? 'approved' : 'pending' },
      { name: owner[0], role: `Site owner · ${owner[1]}`, decision: approved ? 'approved' : 'pending' },
      { name: 'HexaShield OT safety reviewer', role: 'Independent safety review', decision: approved ? 'approved' : 'pending' },
    ];
    if (!passive) approvers.push({ name: c.people.ciso.name, role: c.people.ciso.role, decision: approved ? 'approved' : 'pending' });
    const winDay = r.int(1, 12);
    const windowNote = forCustomer(WINDOW_NOTE, c);
    return {
      id: `OTPT-${site.prefix}-${r.int(100, 999)}`,
      name: e.name,
      siteId: site.id,
      siteName: site.name,
      objective: e.objective,
      status: e.status,
      phase: e.phase,
      gates,
      scope: e.scope,
      scopeDetail: e.scopeDetail,
      safetyCase: { ref: `SC-${site.prefix}-PT-${r.int(10, 99)}`, status: approved ? 'Approved' : e.phase === 1 ? 'In review' : 'Draft' },
      approvers,
      changeWindow: e.status === 'Complete' ? 'Closed' : passive ? `Continuous passive capture · next review in ${winDay} d` : `In ${winDay} d, 01:00–05:00 local (${windowNote})`,
      // Kestrel's change references carry its own prefix; everyone else (incl. Starfall, templated on media) uses CHG numbers.
      changeRef: c.id === 'media' ? `KPG-CHG-${r.int(1000, 9999)}` : `CHG${r.int(1000000, 9999999)}`,
      stopConditions: [...STOP_COMMON, ...forCustomer(STOP_SECTOR, c)],
      humanOnLoop: `${hotl[0]} (${hotl[1]})`,
      lead: `${TESTERS[i % TESTERS.length]} · HexaShield OT`,
      standards: e.standards,
      startDaysAgo: e.phase === 0 ? r.int(2, 9) : r.int(14, 60),
      endInDays: e.status === 'Complete' ? -r.int(5, 20) : r.int(6, 40),
      zones: e.zones,
    };
  }).filter((e) => siteIds.has(e.siteId));
}

export function otTestFindings(c: CustomerProfile, tenantId: string): OtTestFinding[] {
  const engs = otEngagements(c, tenantId);
  const owner = c.people.otLead?.name ?? c.people.ciso.name;
  const out: OtTestFinding[] = [];
  for (const eng of engs) {
    const seed = forCustomer(ENG_SEEDS, c).find((s) => s.name === eng.name);
    if (!seed) continue;
    const r = rng(`ot-ptf-${eng.id}`);
    seed.findings.forEach(([cat, sev, title, zone], k) => {
      const status = r.weighted<OtTestFinding['status']>(eng.status === 'Complete' ? [['Remediated', 6], ['Risk accepted', 1]] : [['Open', 4], ['In remediation', 4], ['Remediated', 2], ['Risk accepted', cat === 'legacy' ? 3 : 0.4]]);
      const found = r.int(3, Math.max(4, eng.startDaysAgo));
      out.push({
        id: `${eng.id}-F${String(k + 1).padStart(2, '0')}`,
        engagementId: eng.id, engagement: eng.name, siteName: eng.siteName,
        category: cat, title, zone, sev, status, owner,
        foundDaysAgo: found,
        remediatedDaysAgo: status === 'Remediated' ? r.int(0, found) : undefined,
      });
    });
  }
  return out;
}

/* ================================================================== */
/* Phase 2: sector wording, sensors, tracked assets, zones, crossings, */
/* protocols, the alert log and the "watching" list.                   */
/* ================================================================== */

export interface SectorWords {
  sitesHint: string;
  net: string;
  dev: string;
  team: string;
  belowLine: string;
  levels: Record<PurdueLevel, { name: string; desc: string }>;
  /** Hint on the Safety KPI (what failure of a safety-critical asset means). */
  safetyHint?: string;
  /** Requirements the risk-acceptance evidence is filed against. */
  patchEvidence?: string;
}

const DEFAULT_LEVELS: Record<PurdueLevel, { name: string; desc: string }> = {
  L4: { name: 'Enterprise', desc: 'Corporate IT that reaches into the plant' },
  'L3.5': { name: 'Industrial DMZ', desc: 'The buffer every crossing between IT and the process should pass through' },
  L3: { name: 'Site operations', desc: 'Historians, engineering stations and SCADA servers' },
  L2: { name: 'Supervisory control', desc: 'Operator screens, building systems and the local network' },
  L1: { name: 'Basic control', desc: 'Controllers, safety systems and drives' },
  L0: { name: 'Process', desc: 'Instruments on the line itself' },
};

export const SECTOR: CustomerMap<SectorWords> = {
  maritime: {
    sitesHint: 'terminals & fleet', net: 'control network', dev: 'controller', team: 'terminal engineering',
    belowLine: 'Below this line is the control network — assets here move cranes, vehicles and vessels',
    levels: { ...DEFAULT_LEVELS, L4: { name: 'Enterprise & TOS', desc: 'Terminal operating system and corporate IT that reach into the terminal' }, L3: { name: 'Site operations', desc: 'Historians, engineering stations, AGV fleet control, VDR' }, L2: { name: 'Supervisory control', desc: 'Crane HMIs, gate lanes, reefer gateways, bridge and cargo stations' }, L1: { name: 'Basic control', desc: 'Crane PLCs, drives, AGV, RTU and engine controllers' }, L0: { name: 'Process', desc: 'Field I/O, protection relays and navigation sensors' } },
    patchEvidence: 'IEC 62443-2-3 and IACS UR E26',
  },
  finserv: {
    sitesHint: 'DCs, offices, ATMs', net: 'facilities network', dev: 'controller', team: 'DC facilities',
    belowLine: 'Below this line is the facilities control network — assets here switch power and cooling',
    levels: { ...DEFAULT_LEVELS, L4: { name: 'Corporate IT', desc: 'DCIM and corporate systems reaching facilities' }, 'L3.5': { name: 'Facilities DMZ', desc: 'Jump hosts every facilities connection should pass through' }, L3: { name: 'Building operations', desc: 'BMS servers and video recorders' }, L2: { name: 'Supervisory', desc: 'BMS controllers, power gateways and ATMs' }, L1: { name: 'Basic control', desc: 'UPS, CRAC, generators, fire and access controllers' }, L0: { name: 'Sensors & PDUs', desc: 'Environmental sensors and rack power' } },
  },
  media: {
    sitesHint: 'broadcast & stages', net: 'broadcast plant network', dev: 'device', team: 'broadcast engineering',
    belowLine: 'Below this line is the live plant — a change here goes to air',
    levels: { ...DEFAULT_LEVELS, L4: { name: 'Corporate IT', desc: 'Corporate systems reaching the broadcast plant' }, 'L3.5': { name: 'Broadcast DMZ', desc: 'The path every connection into playout should take' }, L3: { name: 'Playout & orchestration', desc: 'Playout servers, NMOS registry and multiviewers' }, L2: { name: 'Media fabric & studio control', desc: 'ST 2110 routers, vision mixers, comms and BMS' }, L1: { name: 'Timing, encoders & lighting', desc: 'PTP grandmasters, encoders, CCUs and DMX gateways' }, L0: { name: 'Cameras & fixtures', desc: 'Cameras, stageboxes and lighting fixtures' } },
  },
  healthcare: {
    sitesHint: '5 hospitals, imaging, lab', net: 'device network', dev: 'medical device', team: 'Clinical Engineering (biomed)',
    belowLine: 'Below this line devices are connected to patients — a change here can harm someone',
    levels: { L4: { name: 'Clinical IT', desc: 'Epic and the integration engines that reach into device networks' }, 'L3.5': { name: 'Medical device DMZ', desc: 'Biomed jump hosts and collectors every connection should pass through' }, L3: { name: 'Clinical device servers', desc: 'Pump, monitoring, PACS, lab and nurse-call servers' }, L2: { name: 'Supervisory & building', desc: 'Modality consoles, dispensing cabinets, BMS and nurse-call stations' }, L1: { name: 'Patient-connected devices', desc: 'Infusion pumps, monitors, ventilators, scanners and analysers' }, L0: { name: 'Bedside sensors', desc: 'Telemetry transmitters, smart beds and fridge sensors' } },
    safetyHint: 'failure can harm a patient',
  },
  automotive: {
    sitesHint: 'plant halls & shops', net: 'line network', dev: 'controller', team: 'plant maintenance',
    belowLine: 'Below this line is the line network — assets here move presses, robots and conveyors',
    levels: { L4: { name: 'Enterprise IT', desc: 'SAP, PLM and MES interfaces that reach into the plants' }, 'L3.5': { name: 'Plant DMZ', desc: 'Jump hosts and collectors every crossing into the line should pass through' }, L3: { name: 'Line operations', desc: 'MES, SCADA, engineering stations and end-of-line benches' }, L2: { name: 'Supervisory control', desc: 'HMIs, torque controllers, vision, paint and dry-room control' }, L1: { name: 'Basic control', desc: 'Safety PLCs, robots, conveyors, AGVs and formation racks' }, L0: { name: 'Process', desc: 'Drives and remote I/O on the line' } },
  },
  insurance: {
    sitesHint: 'data centres & print plant', net: 'facilities network', dev: 'controller', team: 'data centre facilities',
    belowLine: 'Below this line is the facilities control network — assets here keep the data halls powered and cooled and the policy mail moving',
    levels: { L4: { name: 'Corporate IT', desc: 'DCIM and corporate systems that reach into facilities' }, 'L3.5': { name: 'Facilities DMZ', desc: 'Jump hosts and collectors every facilities connection should pass through' }, L3: { name: 'Facilities & print operations', desc: 'BMS, access control, video and print workflow servers' }, L2: { name: 'Supervisory', desc: 'BMS controllers, power gateways, presses and inserters' }, L1: { name: 'Basic control', desc: 'UPS, CRAC, generators, fire suppression and door controllers' }, L0: { name: 'Sensors & PDUs', desc: 'Environmental sensors, rack power and cameras' } },
    patchEvidence: 'IEC 62443-2-3 and NYDFS 500.7 / 500.16',
  },
  defence: {
    sitesHint: 'machine shop & test range', net: 'shop-floor network', dev: 'controller', team: 'manufacturing engineering',
    belowLine: 'Below this line are the machines and test benches — a change here alters flight hardware or the tests that qualify it',
    levels: { L4: { name: 'Enterprise IT', desc: 'Teamcenter PLM and engineering systems that reach onto the shop floor' }, 'L3.5': { name: 'Shop-floor DMZ', desc: 'Jump hosts and collectors every crossing into machines and benches should pass through' }, L3: { name: 'Shop & test operations', desc: 'DNC server, CMM stations, historian and test data servers' }, L2: { name: 'Supervisory', desc: 'ATE benches, heat-treat HMI and building controllers' }, L1: { name: 'Machine & test control', desc: 'CNC controls, CMMs, furnace, chambers, shaker and telemetry' }, L0: { name: 'Instrumentation', desc: 'Machine I/O, probes and test instrumentation' } },
    safetyHint: 'failure risks people or flight hardware',
    patchEvidence: 'IEC 62443-2-3 and NIST SP 800-171 3.14.1 (flaw remediation)',
  },
  pharma: {
    sitesHint: 'API, biologics & fill-finish', net: 'process control network', dev: 'controller', team: 'automation engineering',
    belowLine: 'Below this line is the GMP process — a change here can lose a batch or put a medicine out of specification',
    levels: { L4: { name: 'Enterprise IT', desc: 'SAP S/4HANA and the interfaces that send orders into the plants' }, 'L3.5': { name: 'Plant DMZ', desc: 'Jump hosts, collectors and the AF-2 data diode' }, L3: { name: 'Manufacturing operations', desc: 'PAS-X MES, PI historian, DCS engineering, EMS and LIMS gateways' }, L2: { name: 'Supervisory control', desc: 'DCS operator stations, MES terminals, cleanroom HVAC and serialisation' }, L1: { name: 'Basic control', desc: 'Bioreactors, reactors, isolators, lyophilisers, CIP/SIP skids' }, L0: { name: 'Process', desc: 'Field instruments, cleanroom sensors and remote I/O' } },
    safetyHint: 'failure risks people or product quality',
    patchEvidence: 'IEC 62443-2-3 and EU GMP Annex 11 change control',
  },
  sghospital: {
    sitesHint: 'hospital, specialist, day surgery, lab', net: 'device network', dev: 'medical device', team: 'Biomedical Engineering',
    belowLine: 'Below this line devices are connected to patients — a change here can harm someone',
    levels: { L4: { name: 'Clinical IT', desc: 'TrakCare and the HealthShare interfaces that reach into device networks' }, 'L3.5': { name: 'Medical device DMZ', desc: 'Biomed jump hosts and collectors every connection should pass through' }, L3: { name: 'Clinical device servers', desc: 'Pump, monitoring, PACS, LIS, oncology and nurse-call servers' }, L2: { name: 'Supervisory & building', desc: 'Imaging consoles, theatre BMS, tube system and nurse-call stations' }, L1: { name: 'Patient-connected devices', desc: 'Pumps, monitors, ventilators, scanners, linacs and analysers' }, L0: { name: 'Bedside sensors', desc: 'Telemetry transmitters and cold-chain sensors' } },
    safetyHint: 'failure can harm a patient',
    patchEvidence: 'IEC 62443-2-3 and HSA GL-04 (post-market cybersecurity)',
  },
  studio: {
    sitesHint: 'parks, water park & resorts', net: 'ride & show network', dev: 'controller', team: 'ride & show engineering',
    belowLine: 'Below this line are rides and shows — a change here moves vehicles and effects with guests nearby',
    levels: { L4: { name: 'Park IT', desc: 'Ticketing and corporate systems that reach into the parks' }, 'L3.5': { name: 'Ride & show DMZ', desc: 'Jump hosts and collectors every crossing into rides and shows should pass through' }, L3: { name: 'Ride & show operations', desc: 'Ride engineering, ride monitoring, show control and media servers' }, L2: { name: 'Supervisory', desc: 'Ride HMIs, animatronics, gates, BMS and the live events router' }, L1: { name: 'Ride & effects control', desc: 'Safety-rated ride PLCs, pump drives, fire panels and pyro' }, L0: { name: 'Field devices', desc: 'Ride sensors, safety I/O, fixtures and room controls' } },
    safetyHint: 'failure can injure guests or cast',
    patchEvidence: 'IEC 62443-2-3 and ASTM F2291 ride change control',
  },
};

export const LEVEL_NUM: Record<PurdueLevel, string> = { L4: '5–4', 'L3.5': '3.5', L3: '3', L2: '2', L1: '1', L0: '0' };

/** Minutes since the last signed bundle arrived from an air-gapped site (0 if none). */
export function bundleAgeMin(c: CustomerProfile): number {
  const site = forCustomer(SITES, c).find((s) => s.airGapped);
  if (!site) return 0;
  return c.connectors.find((k) => k.id === site.sourceConnector)?.lastSyncMin ?? (site.bundleHours ?? 6) * 60;
}

export function airGappedSite(c: CustomerProfile): OtSite | undefined {
  return forCustomer(SITES, c).find((s) => s.airGapped);
}

export interface OtBundle { id: string; importedMinAgo: number; sizeMb: number; events: number; alerts: number; sha256: string; signer: string; verified: boolean }
export function airGapBundles(c: CustomerProfile): OtBundle[] {
  const site = airGappedSite(c);
  if (!site) return [];
  const r = rng(`ot-bundles-${c.id}`);
  const age = bundleAgeMin(c);
  const every = (site.bundleHours ?? 6) * 60;
  return Array.from({ length: 8 }, (_, i) => ({
    id: `BND-${site.prefix}-${String(4120 - i).padStart(5, '0')}`,
    importedMinAgo: age + i * every + r.int(0, 9),
    sizeMb: r.int(140, 420),
    events: r.int(38000, 91000),
    alerts: i === 0 ? 2 : r.int(0, 3),
    sha256: r.hex(64),
    signer: `Ed25519 · hexaot-${site.prefix.toLowerCase()}-export-2026`,
    verified: true,
  }));
}

/* ----------------------------- Sensors ----------------------------- */

export interface OtSensor {
  id: string; name: string; desc: string; siteId: string; siteName: string; model: string;
  health: 'Good' | 'Attention' | 'Offline'; uptimeH: number; lastSyncMin: number; ram: number; disk: number; cpu: number; mbps: number; note?: string;
}

export function otSensors(c: CustomerProfile, tenantId: string): OtSensor[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const r = rng(`ot-sensors-${c.id}-${tenantId}`);
  const counts = distribute(Math.max(sc.sites.length, sc.h.sensors), sc.sites.map((s) => s.weight)).map((n) => Math.max(1, n));
  const out: OtSensor[] = [];
  let flagged = false;
  sc.sites.forEach((s, si) => {
    const zones = [...new Set(forCustomer(TYPES, c).filter((t) => t.kinds.includes(s.kind) && t.level !== 'L4' && t.level !== 'L3.5').map((t) => t.zone))];
    const conn = c.connectors.find((k) => k.id === s.sourceConnector);
    for (let i = 0; i < counts[si]; i++) {
      const collector = i > 0 && r.chance(0.3);
      const model = /Claroty/.test(s.source) ? (collector ? 'Claroty xDome collector' : 'Claroty xDome sensor') : /Armis/.test(s.source) ? (collector ? 'Armis collector' : 'Armis sensor appliance') : /Dragos/.test(s.source) ? (collector ? 'Dragos SiteStore collector' : 'Dragos sensor') : s.kind === 'vessel' ? 'HexaOT edge (vessel)' : collector ? 'HexaOT remote collector' : 'HexaOT Sensor S1';
      let health: OtSensor['health'] = 'Good';
      let lastSync = r.int(0, 2);
      let note: string | undefined;
      const zi = i % Math.max(1, zones.length);
      if (s.airGapped) {
        lastSync = bundleAgeMin(c);
        note = `Air-gapped: reports by signed bundle every ${s.bundleHours ?? 6} h`;
      } else if (conn && conn.status !== 'healthy' && i === 0 && (c.id !== 'healthcare' || s.id === 'mar')) {
        health = 'Attention';
        lastSync = conn.lastSyncMin;
        note = conn.note ?? 'Feed delayed';
      } else if (s.kind === 'vessel' && i % 7 === 3) {
        health = 'Attention';
        lastSync = r.int(190, 600);
        note = 'Vessel out of LEO coverage · store and forward';
      } else if (!flagged && si === Math.min(1, sc.sites.length - 1) && i === counts[si] - 1 && (c.dataKey === 'media' || c.dataKey === 'finserv' || c.dataKey === 'maritime' || c.id === 'defence')) {
        flagged = true;
        health = 'Attention';
        lastSync = r.int(180, 300);
        note = 'Mirror incomplete since the switch change on Sep 26';
      }
      out.push({
        id: `${s.id}-sn-${i}`,
        name: `ot-${collector ? 'collector' : 'sensor'}-${s.prefix.toLowerCase()}-${String(i + 1).padStart(2, '0')}`,
        desc: health === 'Attention' && note ? `${zones[zi] ?? 'Site core'} — ${note.charAt(0).toLowerCase()}${note.slice(1)}` : zones.slice(zi, zi + 2).join(', ') || 'Site core',
        siteId: s.id, siteName: s.name, model, health,
        uptimeH: health === 'Attention' ? r.int(40, 400) : r.int(900, 8000),
        lastSyncMin: lastSync,
        ram: r.int(18, 44), disk: r.int(26, 58), cpu: r.int(2, 9),
        mbps: Math.max(2, Math.round(((sc.siteAssets[s.id] ?? 100) / Math.max(1, counts[si])) * r.float(0.03, 0.07, 3))),
        note,
      });
    }
  });
  return out;
}

/* -------------------------- Tracked assets ------------------------- */

export type Criticality = 'Safety' | 'Production' | 'Support';
export type Route = 'Vendor patch available' | 'Compensating control' | 'No vendor fix' | 'Already on latest';
export interface TrackedAsset extends OtAsset { crit: Criticality; findings: number; critFindings: number; sevMix: [number, number, number, number]; route: Route }

const TRACK_CACHE = new Map<string, TrackedAsset[]>();
/** The assets HexaOT follows individually: the ones that govern the process or carry open findings. */
export function trackedAssets(c: CustomerProfile, tenantId: string): TrackedAsset[] {
  const key = c.id + '|' + tenantId;
  const hit = TRACK_CACHE.get(key);
  if (hit) return hit;
  const sc = otScope(c, tenantId);
  const all = otAssets(c, tenantId);
  const r = rng(`ot-tracked-${c.id}-${tenantId}`);
  const totalW = sc.sites.reduce((s, x) => s + x.weight, 0) || 1;
  const patchOf = new Map(forCustomer(VULN_MAP, c).map((v) => [v.type, v.patch] as const));
  const out: TrackedAsset[] = [];
  for (const site of sc.sites) {
    const k = Math.max(4, Math.round((36 * site.weight) / totalW));
    const perType = new Map<string, number>();
    const cand = all.filter((a) => a.siteId === site.id && a.level !== 'L0' && !a.type.includes('collector') && !a.type.includes('Passive')).sort((a, b) => b.risk - a.risk);
    let taken = 0;
    let safety = 0;
    for (const a of cand) {
      if (taken >= k) break;
      const n = perType.get(a.type) ?? 0;
      if (n >= 2) continue;
      if (a.consequence >= 5) {
        if (safety >= Math.ceil(k * 0.4)) continue;
        safety++;
      }
      perType.set(a.type, n + 1);
      taken++;
      const crit: Criticality = a.consequence >= 5 ? 'Safety' : a.consequence >= 3 ? 'Production' : 'Support';
      const findings = a.cves.length * r.int(3, 9) + a.fwBehind * r.int(4, 12) + r.int(0, 6) + (a.level === 'L3' ? r.int(12, 30) : 0);
      const critF = Math.min(findings, a.cves.filter((id) => (OT_CVE_BY_ID[id]?.cvss ?? 0) >= 9).length + (a.level === 'L3' && a.fwBehind > 1 ? 1 : 0));
      const high = Math.round((findings - critF) * r.float(0.2, 0.32, 2));
      const med = Math.round((findings - critF - high) * r.float(0.55, 0.7, 2));
      const p = patchOf.get(a.type);
      const route: Route = p === 'No vendor fix' ? 'No vendor fix' : p === 'Unpatchable by design (safety case)' ? 'Compensating control' : a.cves.length || a.fwBehind ? 'Vendor patch available' : 'Already on latest';
      out.push({ ...a, crit, findings, critFindings: critF, sevMix: [critF, high, med, Math.max(0, findings - critF - high - med)], route });
    }
  }
  out.sort((a, b) => b.findings - a.findings);
  TRACK_CACHE.set(key, out);
  return out;
}

/* ------------------------------ Zones ------------------------------ */

export type Boundary = 'Controlled' | 'Isolated' | 'Flat';
export interface OtZone { name: string; desc: string; level: PurdueLevel; boundary: Boundary; conversations: number; crossings: number; assets: number; tracked: number }

export function zoneKey(n: string): string {
  return n.replace(/ \(L[^)]*\)$/, '');
}
export function flowLevel(n: string): PurdueLevel {
  if (/DMZ|bundle/i.test(n)) return 'L3.5';
  if (/Vendor/i.test(n)) return 'L3.5';
  if (/\(L3\)/.test(n)) return 'L3';
  if (/Enterprise|Corporate|Clinical IT|Facilities IT|Wi-Fi|Crew|Shore|Branch|laptop/i.test(n)) return 'L4';
  return 'L2';
}
function flowDesc(n: string): string {
  if (/bundle/i.test(n)) return 'Signed export of sensor data from the air-gapped plant, verified on import';
  if (/DMZ/.test(n)) return 'The intended path between IT and the control network';
  if (/Vendor/.test(n)) return 'Jump hosts and brokers used by OEMs and service contractors';
  if (/Wi-Fi/.test(n)) return 'Staff and guest wireless — should never reach devices';
  if (/laptop/i.test(n)) return 'Transient engineering devices, registered at the media kiosk';
  if (/Crew/.test(n)) return 'Crew welfare and business network on board';
  if (/Shore/.test(n)) return 'Fleet operations centre and shore systems';
  if (/Branch/.test(n)) return 'Branch office network';
  if (/MES/.test(n)) return 'Cell-plant MES and line control servers';
  return 'Corporate IT reaching into site systems';
}

export function otZones(c: CustomerProfile, tenantId: string): OtZone[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const assets = otAssets(c, tenantId);
  const tracked = trackedAssets(c, tenantId);
  const flows = zoneFlows(c, tenantId);
  const r = rng(`ot-zones-${c.id}-${tenantId}`);
  const byZone = new Map<string, OtAsset[]>();
  for (const a of assets) {
    const l = byZone.get(a.zone);
    if (l) l.push(a);
    else byZone.set(a.zone, [a]);
  }
  const flat = new Set(flows.filter((f) => f.unexpected).map((f) => zoneKey(f.to)));
  const vol = new Map<string, number>();
  for (const f of flows) for (const n of [f.from, f.to]) vol.set(zoneKey(n), (vol.get(zoneKey(n)) ?? 0) + f.value);
  const names = [...new Set([...byZone.keys(), ...flows.flatMap((f) => [zoneKey(f.from), zoneKey(f.to)])])];
  const rank: Record<PurdueLevel, number> = { L4: 0, 'L3.5': 1, L3: 2, L2: 3, L1: 4, L0: 5 };
  const zones: OtZone[] = names.map((name) => {
    const as = byZone.get(name) ?? [];
    const lv = as.length ? as.reduce<PurdueLevel>((m, a) => (rank[a.level] < rank[m] ? a.level : m), as[0].level) : flowLevel(name);
    const types = [...new Set(as.map((a) => a.type))].slice(0, 3);
    const boundary: Boundary = flat.has(name) ? 'Flat' : lv === 'L1' || lv === 'L0' ? 'Isolated' : 'Controlled';
    const conversations = Math.round(Math.sqrt(as.length + 1) * r.int(6, 12) + (vol.get(name) ?? 0) * 0.25) + r.int(8, 30);
    const rate = boundary === 'Isolated' ? r.float(0.02, 0.06, 2) : boundary === 'Flat' ? r.float(0.16, 0.38, 2) : /Vendor/.test(name) ? r.float(0.4, 0.5, 2) : r.float(0.09, 0.3, 2);
    return {
      name, level: lv, boundary,
      desc: as.length ? types.join(', ') : flowDesc(name),
      conversations, crossings: Math.max(1, Math.round(conversations * rate)),
      assets: as.length, tracked: tracked.filter((t) => t.zone === name).length,
    };
  });
  const un = Math.max(4, Math.round(assets.length * 0.004));
  zones.push({ name: 'Unzoned', level: 'L0', boundary: 'Flat', desc: 'Seen on the wire but not yet placed in a zone', conversations: un + r.int(10, 40), crossings: Math.round((un + 20) * 0.41), assets: 0, tracked: 0 });
  return zones.sort((a, b) => rank[a.level] - rank[b.level]);
}

/* ---------------------------- Crossings ---------------------------- */

export interface OtEndpoint { name: string; ip: string; zone: string; level: PurdueLevel | 'Internet'; role: string }
export interface OtCrossing { id: string; src: OtEndpoint; dst: OtEndpoint; protocol: string; site: string; expected: boolean; note: string; alerts: number; lastSeenMin: number }

function pickIn(assets: OtAsset[], zone: string, r: ReturnType<typeof rng>, prefer?: PurdueLevel[]): OtAsset | undefined {
  const z = assets.filter((a) => a.zone === zone && a.level !== 'L0' && !a.type.includes('Passive'));
  const p = prefer ? z.filter((a) => prefer.includes(a.level)) : z;
  const list = p.length ? p : z;
  return list.length ? list[r.int(0, list.length - 1)] : undefined;
}
function ep(a: OtAsset | undefined, label: string, r: ReturnType<typeof rng>, siteIdx: number): OtEndpoint {
  if (a) return { name: a.name, ip: a.ip, zone: a.zone, level: a.level, role: a.type };
  const lv = flowLevel(label);
  return {
    name: /Vendor/.test(label) ? 'Vendor jump host' : /Wi-Fi/.test(label) ? 'Wi-Fi client' : /laptop/i.test(label) ? 'Unregistered laptop' : /DMZ/.test(label) ? 'DMZ broker' : /bundle/i.test(label) ? 'Bundle export host' : /MES/.test(label) ? 'Cell-plant MES' : 'Office subnet',
    ip: `10.${/Vendor/.test(label) ? 60 + siteIdx : 10}.${r.int(4, 9)}.${r.int(10, 250)}`, zone: zoneKey(label), level: lv, role: zoneKey(label),
  };
}

const IT_PROTO = (n: string) => (/Vendor/.test(n) ? 'RDP' : /Wi-Fi/.test(n) ? 'HTTP' : /laptop/i.test(n) ? 'S7comm' : 'SMB');

export function otCrossings(c: CustomerProfile, tenantId: string): OtCrossing[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const assets = otAssets(c, tenantId);
  const flows = zoneFlows(c, tenantId);
  const r = rng(`ot-crossings-${c.id}-${tenantId}`);
  const out: OtCrossing[] = [];
  let expectedShown = 0;
  for (const f of flows) {
    const named = f.note ? sc.sites.findIndex((s) => f.kinds.includes(s.kind) && (f.note!.includes(s.city) || f.note!.includes(s.name.split(' ')[0]))) : -1;
    const siteIdx = named >= 0 ? named : Math.max(0, sc.sites.findIndex((s) => f.kinds.includes(s.kind)));
    const site = sc.sites[siteIdx];
    const siteAssets = assets.filter((a) => a.siteId === site.id);
    if (!f.unexpected) {
      if (expectedShown >= 5) continue;
      expectedShown++;
    }
    const src = ep(pickIn(siteAssets, zoneKey(f.from), r, ['L3', 'L2', 'L3.5', 'L4']), f.from, r, siteIdx);
    const dst = ep(pickIn(siteAssets, zoneKey(f.to), r, f.unexpected ? ['L1', 'L2'] : ['L3', 'L2', 'L1']), f.to, r, siteIdx);
    const dstAsset = siteAssets.find((a) => a.name === dst.name);
    out.push({
      id: `X-${out.length + 1}`, src, dst,
      protocol: dstAsset?.protocols[0] ?? IT_PROTO(f.from),
      site: site.name,
      expected: !f.unexpected,
      note: f.note ?? `${zoneKey(f.from)} to ${zoneKey(f.to)} — the designed path`,
      alerts: f.unexpected ? r.int(4, 36) : 0,
      lastSeenMin: f.unexpected ? r.int(6, 1600) : r.int(0, 6),
    });
  }
  // A controller trying to reach the internet: blocked, but worth fixing at source.
  const first = sc.sites.find((s) => !s.airGapped) ?? sc.sites[0];
  const ctl = assets.filter((a) => a.level === 'L1' && a.siteId === first.id);
  if (ctl.length) {
    const a = ctl[r.int(0, ctl.length - 1)];
    out.push({ id: `X-${out.length + 1}`, src: { name: a.name, ip: a.ip, zone: a.zone, level: a.level, role: a.type }, dst: { name: 'Vendor update service', ip: `198.51.100.${r.int(10, 200)}`, zone: 'Public internet', level: 'Internet', role: 'Outside the estate' }, protocol: 'HTTPS', site: first.name, expected: false, note: `A ${forCustomer(SECTOR, c).dev} reaching out to its vendor for updates — outbound, blocked at the firewall, still trying`, alerts: r.int(6, 20), lastSeenMin: r.int(30, 400) });
  }
  return out.sort((a, b) => Number(a.expected) - Number(b.expected) || b.alerts - a.alerts);
}

/* ---------------------------- Protocols ---------------------------- */

export interface OtProtocol { name: string; kind: 'Industrial' | 'Medical' | 'Building' | 'Broadcast' | 'Vehicle' | 'General purpose'; desc: string; assets: number; provesIdentity: boolean }

const PROTO_META: Record<string, [OtProtocol['kind'], string, boolean]> = {
  S7comm: ['Industrial', 'Siemens control and program transfer', false],
  PROFINET: ['Industrial', 'Cyclic I/O between controllers, drives and remote I/O', false],
  'Modbus/TCP': ['Industrial', 'Register reads and writes to controllers and meters', false],
  'EtherNet/IP': ['Industrial', 'Rockwell control traffic', false],
  'OPC UA': ['Industrial', 'Historian, MES and SCADA data collection', true],
  DNP3: ['Industrial', 'Substation telemetry and control', false],
  'IEC 61850': ['Industrial', 'Substation protection and control', false],
  'NMEA 0183': ['Industrial', 'Navigation sensor sentences on the bridge', false],
  'BACnet/IP': ['Building', 'Building management — air handling, chillers, isolation rooms', false],
  LonWorks: ['Building', 'Legacy building automation', false],
  'XFS (ATM)': ['Industrial', 'ATM device commands (dispenser, card reader)', false],
  'SMPTE ST 2110': ['Broadcast', 'Uncompressed video, audio and data essence', false],
  'NMOS IS-04/05': ['Broadcast', 'Discovery and connection management of media flows', false],
  'Ember+': ['Broadcast', 'Control of routers, mixers and intercom', false],
  'PTP (IEEE 1588)': ['Broadcast', 'Precision timing for the media fabric', false],
  'Art-Net / sACN': ['Broadcast', 'Lighting control universes', false],
  'HL7 v2': ['Medical', 'Orders, results and vitals between devices and the EHR', false],
  FHIR: ['Medical', 'Modern clinical data API', true],
  DICOM: ['Medical', 'Imaging studies between modalities and PACS', false],
  'IEEE 11073': ['Medical', 'Point-of-care device data (monitors)', false],
  ASTM: ['Medical', 'Laboratory analyser results', false],
  'Proprietary pump telemetry': ['Medical', 'Pump status and drug-library sync', false],
  'Proprietary (WMTS)': ['Medical', 'Wireless medical telemetry to central stations', false],
  'Proprietary bed link': ['Medical', 'Bed status and bed-exit alarms to nurse call', false],
  SIP: ['General purpose', 'Nurse-call voice and alerts', false],
  MQTT: ['General purpose', 'Sensor telemetry to dashboards', false],
  'CAN / DoIP': ['Vehicle', 'ECU flashing and diagnostics at end of line', false],
  SNMP: ['General purpose', 'Device health polling', false],
  HTTPS: ['General purpose', 'Encrypted management interfaces', true],
  HTTP: ['General purpose', 'Web interfaces on panels, cameras and controllers', false],
  SMB: ['General purpose', 'File shares used by engineering and reporting', true],
  RDP: ['General purpose', 'Remote desktop into engineering stations', true],
  SSH: ['General purpose', 'Switch and firewall administration', true],
  NTP: ['General purpose', 'Clock sync across the control network', false],
  Telnet: ['General purpose', 'Legacy console access on older switches', false],
  FTP: ['General purpose', 'Firmware and recipe transfer to panels', false],
  MTConnect: ['Industrial', 'Machine-tool status and spindle data from CNC controls', false],
  'DNC serial-over-IP': ['Industrial', 'NC programme transfer between the DNC server and machine controls', false],
  'LXI / VISA': ['Industrial', 'Instrument control on test benches and chambers', false],
  'IRIG 106 telemetry': ['Industrial', 'Range telemetry from units under test', false],
  'OPC DA (DCOM)': ['Industrial', 'Legacy DCS and historian data collection over DCOM', false],
  'PROFINET / PROFIsafe': ['Industrial', 'Safety-rated I/O between ride controllers and sensors', false],
  EtherCAT: ['Industrial', 'Motion control for animatronic figures', false],
  'Proprietary firing protocol': ['Industrial', 'Pyrotechnic cue arming and firing', false],
  'IPP / JDF (print)': ['General purpose', 'Print job submission and job tickets for production presses', false],
};

export function otProtocols(c: CustomerProfile, tenantId: string): OtProtocol[] {
  const assets = otAssets(c, tenantId);
  if (!assets.length) return [];
  const r = rng(`ot-protocols-${c.id}-${tenantId}`);
  const m = new Map<string, number>();
  for (const a of assets) for (const p of a.protocols) m.set(p, (m.get(p) ?? 0) + 1);
  const upper = assets.filter((a) => a.level !== 'L0' && a.level !== 'L1').length;
  const l3 = assets.filter((a) => a.level === 'L3' || a.level === 'L3.5').length;
  const gen: [string, number][] = [['SNMP', upper * 0.55], ['HTTP', upper * 0.3], ['NTP', upper * 0.25], ['HTTPS', upper * 0.12], ['SMB', l3 * 1.6], ['RDP', l3 * 0.9], ['SSH', l3 * 0.6], ['Telnet', Math.max(3, upper * 0.01)], ['FTP', Math.max(2, upper * 0.02)]];
  for (const [p, n] of gen) m.set(p, (m.get(p) ?? 0) + Math.max(1, Math.round(n * r.float(0.85, 1.15, 2))));
  return [...m.entries()].map(([name, n]) => {
    const meta = PROTO_META[name] ?? (['Industrial', 'Vendor-specific control traffic', false] as [OtProtocol['kind'], string, boolean]);
    return { name, kind: meta[0], desc: meta[1], assets: n, provesIdentity: meta[2] };
  }).sort((a, b) => b.assets - a.assets);
}

/* ---------------------------- Alert log ---------------------------- */

export type AlertStatus = 'Open' | 'Acknowledged' | 'Closed';
export type RiskBand = 'Very high' | 'High' | 'Medium' | 'Low';
export interface OtAlertRow {
  id: string; risk: number; band: RiskBand; title: string; kind: 'Security-relevant' | 'Process event'; protocol: string; ageMin: number;
  siteId: string; siteName: string; zone: string; src: OtEndpoint; dst: OtEndpoint; status: AlertStatus;
  techniques: string[]; desc: string; why: string; what: string; source: string;
}

export function riskBand(n: number): RiskBand {
  return n >= 9 ? 'Very high' : n >= 7 ? 'High' : n >= 4 ? 'Medium' : 'Low';
}
export const BAND_HEX: Record<RiskBand, string> = { 'Very high': '#e0345e', High: '#f2643f', Medium: '#f0a338', Low: '#8593b4' };

const WHY: Record<string, string> = {
  T0843: 'Either a genuine change made without a work order, or an engineering station running code it should not.',
  T0821: 'The device was switched out of its running state from a station that is not booked to do so.',
  T0886: 'Remote sessions are only allowed through the brokered, recorded path.',
  T0846: 'A device nobody has registered is talking on a network where every device should be known.',
  T0859: 'Factory or cleartext credentials can be reused by anyone who can listen on the segment.',
  T0883: 'Something on the control side is configured to reach the internet.',
  T0855: 'A command changed how the process behaves, from a host not on the allow-list for that device.',
  T0836: 'A set-point or parameter moved outside a recorded work order.',
  T0882: 'Operational data is leaving to a destination that is not in the design.',
  T0816: 'A stop or restart outside planned maintenance interrupts the process.',
  T0832: 'What operators see no longer matches what is happening.',
  T0847: 'Removable media reached a station outside the media procedure.',
  T0888: 'Housekeeping traffic, recorded for context.',
  T0872: 'The record of what happened on the process was switched off or altered; under GMP the batch cannot be released until the gap is explained.',
};
const RELATED: Record<string, string[]> = {
  T0843: ['T0843', 'T0821'], T0821: ['T0821', 'T0843'], T0886: ['T0886', 'T0866'], T0846: ['T0846', 'T0888'], T0859: ['T0859', 'T0866'],
  T0883: ['T0883'], T0855: ['T0855', 'T0831'], T0836: ['T0836', 'T0831'], T0882: ['T0882'], T0816: ['T0816', 'T0826'], T0832: ['T0832'], T0847: ['T0847'], T0888: [], T0872: ['T0872', 'T0836'],
};

type GenEnd = PurdueLevel | 'vendor' | 'unknown' | 'office';
interface GenAlert { title: (w: SectorWords) => string; kind: OtAlertRow['kind']; risk: number; tech: string; src: GenEnd; dst: PurdueLevel | 'internet'; proto?: string; desc: (w: SectorWords) => string }
function cap1(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const GENERIC: GenAlert[] = [
  { title: (w) => `${cap1(w.dev)} mode changed to program`, kind: 'Security-relevant', risk: 8, tech: 'T0821', src: 'L3', dst: 'L1', desc: (w) => `The ${w.dev} was switched from run to program from an engineering station during operation.` },
  { title: (w) => `Remote access session into the ${w.net}`, kind: 'Security-relevant', risk: 7, tech: 'T0886', src: 'vendor', dst: 'L3', proto: 'RDP', desc: () => 'An external party opened a remote desktop session to a server inside the control zones.' },
  { title: (w) => `New asset appeared on the ${w.net}`, kind: 'Process event', risk: 6, tech: 'T0846', src: 'unknown', dst: 'L1', desc: () => 'A device that was not in the inventory started talking to equipment.' },
  { title: (w) => `Cleartext credentials on the ${w.net}`, kind: 'Security-relevant', risk: 6, tech: 'T0859', src: 'L3', dst: 'L2', proto: 'Telnet', desc: () => 'A login crossed the network in the clear; the sensor saw the username and password.' },
  { title: (w) => `Outbound connection attempt from a ${w.dev}`, kind: 'Process event', risk: 5, tech: 'T0883', src: 'L1', dst: 'internet', proto: 'HTTPS', desc: () => 'Blocked at the site firewall, but the device keeps retrying.' },
  { title: () => 'Unauthorised write to a process variable', kind: 'Security-relevant', risk: 8, tech: 'T0855', src: 'L2', dst: 'L1', desc: () => 'A write reached a device from a station that is not mapped to it.' },
  { title: () => 'Duplicated IP address', kind: 'Process event', risk: 4, tech: 'T0888', src: 'L2', dst: 'L2', desc: () => 'Two devices answered for the same address; usually a replacement installed with a copied configuration.' },
  { title: () => 'Device reachable from the office network', kind: 'Security-relevant', risk: 7, tech: 'T0886', src: 'office', dst: 'L2', proto: 'HTTP', desc: () => 'A management web interface answered from the corporate network with its factory password unchanged.' },
  { title: (w) => `Firmware transfer to a ${w.dev}`, kind: 'Process event', risk: 5, tech: 'T0843', src: 'L3', dst: 'L1', desc: () => 'A firmware image was transferred; matched to a planned maintenance ticket.' },
  { title: (w) => `Configuration read from a ${w.dev}`, kind: 'Process event', risk: 3, tech: 'T0888', src: 'L3', dst: 'L1', desc: () => 'A full configuration upload, usually a backup job.' },
  { title: () => 'Excessive polling from a historian or gateway', kind: 'Process event', risk: 3, tech: 'T0888', src: 'L3', dst: 'L1', desc: () => 'Polling rate doubled after a tag-list change; no security impact.' },
];

function humanWhat(tech: string, w: SectorWords, role: string): string {
  const team = w.team;
  switch (tech) {
    case 'T0843': case 'T0821': return `We have asked ${team} to confirm the change against the maintenance log. Until they do, treat the ${role.toLowerCase()} as unverified.`;
    case 'T0886': return `We have asked ${team} who opened the session and whether it was booked through the access broker.`;
    case 'T0846': return `Fingerprinted passively; ${team} asked to identify the device and register or remove it.`;
    case 'T0859': return 'Raised to the asset owner to rotate the credential and move management to an encrypted protocol.';
    case 'T0883': return 'Blocked at the site firewall; the owner has been asked to disable the update setting at source.';
    case 'T0855': case 'T0836': return `Confirmed with ${team}; the value was checked against its expected range and the change is being traced to a person.`;
    case 'T0882': return 'Asked the owner to confirm the listener and remove it if it is not in the design.';
    case 'T0816': return 'Correlated with the maintenance ticket raised shortly after; kept for the shift report.';
    case 'T0832': return 'The bridge team was informed and cross-checked position with radar and visual fixes.';
    case 'T0847': return 'Media scanned at the kiosk afterwards; crew reminded of the procedure.';
    case 'T0872': return `Quality assurance has placed the batch on hold; ${team} is reconstructing the gap from the historian and the system event log.`;
    default: return 'No action needed; recorded for context.';
  }
}

const LOG_CACHE = new Map<string, OtAlertRow[]>();
export function otAlertLog(c: CustomerProfile, tenantId: string): OtAlertRow[] {
  const key = c.id + '|' + tenantId;
  const hit = LOG_CACHE.get(key);
  if (hit) return hit;
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const w = forCustomer(SECTOR, c);
  const assets = otAssets(c, tenantId);
  const r = rng(`ot-alertlog-${c.id}-${tenantId}`);
  const kinds = new Set(sc.sites.map((s) => s.kind));
  const out: OtAlertRow[] = [];
  const asEp = (a: OtAsset): OtEndpoint => ({ name: a.name, ip: a.ip, zone: a.zone, level: a.level, role: a.type });
  const bySiteLevel = new Map<string, OtAsset[]>();
  for (const a of assets) {
    if (a.type.includes('Passive')) continue;
    const k = `${a.siteId}|${a.level}`;
    const l = bySiteLevel.get(k);
    if (l) l.push(a);
    else bySiteLevel.set(k, [a]);
  }
  const anyIn = (siteId: string, lvs: PurdueLevel[]): OtAsset | undefined => {
    for (const lv of lvs) {
      const pool = bySiteLevel.get(`${siteId}|${lv}`);
      if (pool?.length) return pool[r.int(0, pool.length - 1)];
    }
    return undefined;
  };
  const special = (kind: 'vendor' | 'unknown' | 'office' | 'internet', si: number): OtEndpoint => {
    if (kind === 'vendor') return { name: 'Vendor jump host', ip: `10.${60 + si}.5.${r.int(10, 60)}`, zone: 'Vendor remote access', level: 'L3.5', role: 'Vendor remote access' };
    if (kind === 'unknown') return { name: 'Unidentified', ip: `10.${60 + si}.${r.int(11, 14)}.${r.int(60, 250)}`, zone: 'Unzoned', level: 'L0', role: 'Not yet identified' };
    if (kind === 'office') return { name: 'Office subnet', ip: `10.10.${r.int(2, 9)}.${r.int(10, 250)}`, zone: w.levels.L4.name, level: 'L4', role: 'Corporate workstation' };
    return { name: 'Vendor update service', ip: `198.51.100.${r.int(10, 200)}`, zone: 'Public internet', level: 'Internet', role: 'Outside the estate' };
  };
  // Sector seeds first (the alerts the story is about).
  forCustomer(ALERT_SEEDS, c).filter((s) => kinds.has(s.kind)).forEach((s, i) => {
    const site = sc.sites.find((x) => x.kind === s.kind) ?? sc.sites[0];
    const si = sc.sites.indexOf(site);
    const dstA = assets.find((a) => a.siteId === site.id && a.name.includes(`-${s.asset}-`)) ?? anyIn(site.id, ['L1', 'L2']);
    if (!dstA) return;
    const srcKind = s.technique === 'T0886' ? 'vendor' : s.technique === 'T0846' ? 'unknown' : undefined;
    const srcA = srcKind ? undefined : anyIn(site.id, s.technique === 'T0855' ? ['L2', 'L3'] : ['L3', 'L3.5', 'L2']);
    const src = srcKind ? special(srcKind, si) : srcA ? asEp(srcA) : special('office', si);
    const dst = asEp(dstA);
    const risk = s.sev === 'critical' ? 9 : s.sev === 'high' ? (i % 2 ? 7 : 8) : s.sev === 'medium' ? (i % 2 ? 5 : 6) : 3;
    const exfil = s.technique === 'T0882';
    out.push({
      id: `OTA-${r.int(10000, 99999)}`, risk, band: riskBand(risk), title: s.title, kind: 'Security-relevant',
      protocol: dstA.protocols[0] ?? 'TCP', ageMin: 0, siteId: site.id, siteName: site.name, zone: dstA.zone,
      src: exfil ? dst : src, dst: exfil ? { ...special('internet', si), name: 'Unknown listener', role: 'Not in the design' } : dst,
      status: 'Open', techniques: RELATED[s.technique] ?? [s.technique], desc: s.detail, why: WHY[s.technique] ?? '',
      what: humanWhat(s.technique, w, dst.role), source: site.source,
    });
  });
  let gi = 0;
  while (out.length < 18 && gi < 44) {
    const g = GENERIC[gi % GENERIC.length];
    const site = sc.sites[(gi * 3 + 1) % sc.sites.length];
    const si = sc.sites.indexOf(site);
    gi++;
    const dA = g.dst === 'internet' ? undefined : anyIn(site.id, [g.dst]);
    if (!dA && g.dst !== 'internet') continue;
    const sA = g.src.startsWith('L') ? anyIn(site.id, [g.src as PurdueLevel, 'L3']) : undefined;
    const src = sA ? asEp(sA) : special(g.src as 'vendor' | 'unknown' | 'office', si);
    const dst = dA ? asEp(dA) : special('internet', si);
    const risk = Math.max(1, Math.min(10, g.risk + r.int(-1, 0)));
    out.push({
      id: `OTA-${r.int(10000, 99999)}`, risk, band: riskBand(risk), title: g.title(w), kind: g.kind,
      protocol: g.proto ?? dA?.protocols[0] ?? sA?.protocols[0] ?? 'TCP', ageMin: 0, siteId: site.id, siteName: site.name, zone: dA?.zone ?? sA?.zone ?? 'Unzoned',
      src, dst, status: 'Open', techniques: RELATED[g.tech] ?? [], desc: g.desc(w), why: WHY[g.tech] ?? '',
      what: humanWhat(g.tech, w, dst.role), source: site.source,
    });
  }
  // Time order and statuses.
  let t = 0;
  out.forEach((a, i) => {
    t += r.int(8, 140) + i * 6;
    const site = sc.sites.find((s) => s.id === a.siteId);
    a.ageMin = site?.airGapped ? Math.max(t, bundleAgeMin(c) + r.int(20, 300)) : t;
    a.status = i < 3 ? (i === 1 ? 'Acknowledged' : 'Open') : r.weighted<AlertStatus>([['Open', 3], ['Acknowledged', 4], ['Closed', 4]]);
  });
  out.sort((a, b) => a.ageMin - b.ageMin);
  LOG_CACHE.set(key, out);
  return out;
}

/** 14-day totals by risk band, anchored to the 30-day headline. */
export function alertBands(c: CustomerProfile, tenantId: string): { total: number; bands: Record<RiskBand, number>; daily: Record<'Very high' | 'High' | 'Medium', number[]>; siteTotals: Record<string, number>; sitePeak: Record<string, number> } {
  const sc = otScope(c, tenantId);
  const r = rng(`ot-bands-${c.id}-${tenantId}`);
  const total = Math.round((sc.h.otAlerts * 14) / 30);
  const vh = sc.hasOt ? Math.max(1, Math.round(total * 0.003)) : 0;
  const hi = Math.round(total * 0.021);
  const me = Math.round(total * 0.2);
  const bands: Record<RiskBand, number> = { 'Very high': vh, High: hi, Medium: me, Low: Math.max(0, total - vh - hi - me) };
  const dayW = Array.from({ length: 14 }, (_, i) => r.float(0.6, 1.3, 2) * (i === 9 ? 1.7 : 1));
  const daily = { 'Very high': distribute(vh, dayW.map((x) => x * r.float(0.4, 1.6, 2))), High: distribute(hi, dayW), Medium: distribute(me, dayW) };
  const st = distribute(total, sc.sites.map((s) => s.weight * r.float(0.7, 1.4, 2)));
  const log = otAlertLog(c, tenantId);
  const siteTotals: Record<string, number> = {};
  const sitePeak: Record<string, number> = {};
  sc.sites.forEach((s, i) => {
    siteTotals[s.id] = st[i];
    sitePeak[s.id] = Math.max(r.int(4, 6), ...log.filter((a) => a.siteId === s.id).map((a) => a.risk));
  });
  return { total, bands, daily, siteTotals, sitePeak };
}

export interface WatchItem { id: string; title: string; desc: string; n: number; level: 'Attention' | 'Noted'; to: string }
export function otWatching(c: CustomerProfile, tenantId: string): WatchItem[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const assets = otAssets(c, tenantId);
  const flows = zoneFlows(c, tenantId);
  const w = forCustomer(SECTOR, c);
  const r = rng(`ot-watch-${c.id}-${tenantId}`);
  const writers = assets.filter((a) => a.level === 'L1').length;
  const ews = assets.filter((a) => /Engineering workstation|jump host/i.test(a.type)).length;
  const vendor = flows.filter((f) => /Vendor/.test(f.from)).reduce((s, f) => s + f.value, 0);
  // Patient-connected wording follows the sector words (pharma is templated on healthcare but has no patients on the wire).
  const hc = w.dev === 'medical device';
  return [
    { id: 'unid', title: 'Assets we cannot identify', desc: 'Talking on the network, but their traffic alone does not say what they are. Each one is a gap in the inventory.', n: Math.max(3, Math.round(assets.length * 0.011)), level: 'Attention', to: '/ot/network?zone=Unzoned' },
    { id: 'inet', title: `Attempted connections from the ${w.net} to the internet`, desc: 'All blocked at the site firewall. Every one is a device configured to reach out, which is worth turning off at the source.', n: r.int(6, 22), level: 'Attention', to: '/ot/network?expected=no' },
    { id: 'dual', title: 'Assets bridging two zones at once', desc: 'A dual-homed device joins two networks for as long as it is connected, whatever the firewall between them says.', n: r.int(2, 5), level: 'Attention', to: '/ot/network?expected=no' },
    { id: 'write', title: hc ? 'Devices connected to patients' : 'Assets that can write to the process', desc: hc ? 'Pumps, monitors, ventilators and scanners. The set where a change can reach a patient.' : 'Controllers, safety systems and remote terminal units. The set where a change matters most.', n: writers, level: 'Noted', to: '/ot/assets?view=all&level=L1' },
    { id: 'ews', title: hc ? 'Stations able to push configuration to devices' : 'Stations able to download a program to a controller', desc: 'Engineering stations and jump hosts with the tooling and the network path to change how equipment behaves.', n: ews, level: 'Noted', to: '/ot/assets?view=all&level=L3' },
    { id: 'vendor', title: 'Vendor remote-access sessions in the window', desc: hc ? 'Device OEMs servicing pumps, imaging and lab equipment from outside.' : 'Machine builders and service contractors working on site equipment from outside.', n: Math.max(2, Math.round(vendor / 4)), level: 'Noted', to: '/ot/alerts?q=Remote' },
  ];
}
