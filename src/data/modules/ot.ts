// HexaOT data: sites, assets by Purdue level, zone/conduit flows, alerts,
// vulnerabilities and guard-railed OT test engagements. Everything is derived
// from the customer profile and anchored to headlines(c, tenantId).ot.
import type { CustomerId, CustomerProfile, Severity } from '../types';
import { rng } from '../../lib/rng';
import { headlines } from '../core';
import { ICS_CVES, CVES, type CveRef } from '../reference';

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

export type SiteKind = 'terminal' | 'vessel' | 'dc' | 'atm' | 'office' | 'broadcast' | 'stage' | 'post' | 'hospital' | 'imaging' | 'lab' | 'plant' | 'cellplant';
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

const SITES: Record<CustomerId, OtSite[]> = {
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

const TYPES: Record<CustomerId, AssetType[]> = {
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
};

export function assetTypes(c: CustomerProfile): AssetType[] {
  return TYPES[c.id];
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
  let sites = SITES[c.id].filter((s) => tenantId === 'all' || s.tenantId === tenantId);
  if (!sites.length && hasOt) sites = SITES[c.id];
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
  if (c.id !== 'maritime') return [];
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
  ...CVES.filter((v) => ['CVE-2021-44228', 'CVE-2024-6387', 'CVE-2024-38063', 'CVE-2023-48795', 'CVE-2024-21762'].includes(v.id)),
];
export const OT_CVE_BY_ID: Record<string, CveRef> = Object.fromEntries(ALL_CVES.map((v) => [v.id, v]));

export type PatchState = 'Vendor patch available' | 'Patch needs outage window' | 'No vendor fix' | 'Unpatchable by design (safety case)';
interface VulnMap { cve: string; type: string; reach: 0 | 1 | 2 | 3; patch: PatchState; path: string; controls: string[] }

const VULN_MAP: Record<CustomerId, VulnMap[]> = {
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
  const types = TYPES[c.id];
  const vulnByType = new Map<string, string[]>();
  for (const v of VULN_MAP[c.id]) vulnByType.set(v.type, [...(vulnByType.get(v.type) ?? []), v.cve]);
  const vs = c.id === 'maritime' ? vessels(c, sc.siteAssets.fleet ?? 0) : [];
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
        if (c.id === 'maritime' && site.kind === 'terminal' && (t.zone === 'Gate & access' || t.zone === 'Crane control') && (site.id === 'rtm' || site.id === 'ant') && r.chance(0.6)) sources.push('Navis N4 (equipment register)');
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

const FLOWS: Record<CustomerId, ZoneFlow[]> = {
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
};

export function zoneFlows(c: CustomerProfile, tenantId: string): ZoneFlow[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const kinds = new Set(sc.sites.map((s) => s.kind));
  const share = tenantId === 'all' ? 1 : Math.max(0.25, sc.h.otAssets / headlines(c).ot.otAssets);
  return FLOWS[c.id].filter((f) => f.kinds.some((k) => kinds.has(k))).map((f) => ({ ...f, value: Math.max(f.unexpected ? 2 : 4, Math.round(f.value * share)) }));
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export interface OtAlert { id: string; sev: Severity; title: string; site: string; asset: string; technique: string; ageMin: number; source: string; detail: string }

const ALERT_SEEDS: Record<CustomerId, { sev: Severity; title: string; kind: SiteKind; asset: string; technique: string; detail: string }[]> = {
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
};

export function otAlerts(c: CustomerProfile, tenantId: string): OtAlert[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const r = rng(`ot-alerts-${c.id}-${tenantId}`);
  const kinds = new Set(sc.sites.map((s) => s.kind));
  return ALERT_SEEDS[c.id]
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
  const types = TYPES[c.id];
  const owner = c.people.otLead?.name ?? c.people.ciso.name;
  const groups: Omit<OtVuln, 'instances'>[] = [];
  const weights: number[] = [];
  for (const m of VULN_MAP[c.id]) {
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

const ENG_SEEDS: Record<CustomerId, EngSeed[]> = {
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
};

const STOP_COMMON = [
  'Any unexpected change of controller state or mode',
  'Loss of view on any operator HMI',
  'Operations supervisor or safety officer calls stop',
  'Traffic above the agreed rate on any conduit',
];
const STOP_SECTOR: Record<CustomerId, string[]> = {
  maritime: ['Vessel leaves berth or cargo operations begin', 'Any crane, AGV or vessel system alarm during the window'],
  finserv: ['Any UPS, generator or cooling alarm in the data hall', 'Live incident declared by the crisis team'],
  media: ['A live event goes on air on the affected plant', 'Any PTP lock loss or multiviewer alarm'],
  healthcare: ['Any patient-care alarm or device alert on the affected unit', 'Census surge or mass-casualty plan activated'],
  automotive: ['Any robot, press or conveyor stop on the affected line', 'Line restart or shift handover begins'],
};

const SITE_PEOPLE: Record<CustomerId, [string, string][]> = {
  maritime: [['Joost van Dam', 'Terminal Director'], ['Capt. Lars Eriksen', 'Head of Fleet Operations'], ['Tomasz Nowak', 'Crane Maintenance Supervisor'], ['Aisha Rahman', 'Terminal IT Manager'], ['Bruno Carvalho', 'Terminal Engineer']],
  finserv: [['Graham Holt', 'Head of DC Facilities'], ['Priya Natarajan', 'Head of Operational Resilience'], ['Laura Fitzgerald', 'Payments Ops Engineer'], ['Owen Price', 'Security Platform Owner']],
  media: [['Marcus Dupree', 'Broadcast Engineering Manager'], ['Ethan Brooks', 'Playout Engineer'], ['Oliver Grant', 'Head of Post'], ['Chloe Park', 'IT Platforms Manager']],
  healthcare: [['Priya Desai', 'Biomedical Engineer'], ['Angela Torres', 'Chief Nursing Officer'], ['Ben Carter', 'Radiology PACS Administrator'], ['Grace Nguyen', 'Charge Nurse, ICU']],
  automotive: [['Andreas Schulz', 'Robotics Maintenance Lead, Ingolstadt'], ['Hana Novak', 'Battery Process Engineer'], ['Lucía Romero', 'MES Engineer, Puebla'], ['Péter Nagy', 'Plant IT Manager, Győr']],
};
const TESTERS = ['Elena Varga', 'Tom Ridley', 'Yusuf Demir', 'Sakura Ito'];

export function otEngagements(c: CustomerProfile, tenantId: string): OtEngagement[] {
  const sc = otScope(c, tenantId);
  if (!sc.hasOt) return [];
  const r = rng(`ot-eng-${c.id}`);
  const siteIds = new Set(sc.sites.map((s) => s.id));
  const lead = c.people.otLead ?? c.people.ciso;
  const people = SITE_PEOPLE[c.id];
  return ENG_SEEDS[c.id].map((e, i): OtEngagement => {
    const site = SITES[c.id].find((s) => s.id === e.site) ?? SITES[c.id][0];
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
    const windowNote = c.id === 'maritime' ? 'at berth, no cargo ops' : c.id === 'finserv' ? 'facilities maintenance window' : c.id === 'healthcare' ? 'low-census window, biomed on site' : c.id === 'automotive' ? 'production shutdown' : 'no live events';
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
      changeRef: c.id === 'media' ? `KPG-CHG-${r.int(1000, 9999)}` : `CHG${r.int(1000000, 9999999)}`,
      stopConditions: [...STOP_COMMON, ...STOP_SECTOR[c.id]],
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
    const seed = ENG_SEEDS[c.id].find((s) => s.name === eng.name);
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
}

const DEFAULT_LEVELS: Record<PurdueLevel, { name: string; desc: string }> = {
  L4: { name: 'Enterprise', desc: 'Corporate IT that reaches into the plant' },
  'L3.5': { name: 'Industrial DMZ', desc: 'The buffer every crossing between IT and the process should pass through' },
  L3: { name: 'Site operations', desc: 'Historians, engineering stations and SCADA servers' },
  L2: { name: 'Supervisory control', desc: 'Operator screens, building systems and the local network' },
  L1: { name: 'Basic control', desc: 'Controllers, safety systems and drives' },
  L0: { name: 'Process', desc: 'Instruments on the line itself' },
};

export const SECTOR: Record<CustomerId, SectorWords> = {
  maritime: {
    sitesHint: 'terminals & fleet', net: 'control network', dev: 'controller', team: 'terminal engineering',
    belowLine: 'Below this line is the control network — assets here move cranes, vehicles and vessels',
    levels: { ...DEFAULT_LEVELS, L4: { name: 'Enterprise & TOS', desc: 'Terminal operating system and corporate IT that reach into the terminal' }, L3: { name: 'Site operations', desc: 'Historians, engineering stations, AGV fleet control, VDR' }, L2: { name: 'Supervisory control', desc: 'Crane HMIs, gate lanes, reefer gateways, bridge and cargo stations' }, L1: { name: 'Basic control', desc: 'Crane PLCs, drives, AGV, RTU and engine controllers' }, L0: { name: 'Process', desc: 'Field I/O, protection relays and navigation sensors' } },
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
  },
  automotive: {
    sitesHint: 'plant halls & shops', net: 'line network', dev: 'controller', team: 'plant maintenance',
    belowLine: 'Below this line is the line network — assets here move presses, robots and conveyors',
    levels: { L4: { name: 'Enterprise IT', desc: 'SAP, PLM and MES interfaces that reach into the plants' }, 'L3.5': { name: 'Plant DMZ', desc: 'Jump hosts and collectors every crossing into the line should pass through' }, L3: { name: 'Line operations', desc: 'MES, SCADA, engineering stations and end-of-line benches' }, L2: { name: 'Supervisory control', desc: 'HMIs, torque controllers, vision, paint and dry-room control' }, L1: { name: 'Basic control', desc: 'Safety PLCs, robots, conveyors, AGVs and formation racks' }, L0: { name: 'Process', desc: 'Drives and remote I/O on the line' } },
  },
};

export const LEVEL_NUM: Record<PurdueLevel, string> = { L4: '5–4', 'L3.5': '3.5', L3: '3', L2: '2', L1: '1', L0: '0' };

/** Minutes since the last signed bundle arrived from an air-gapped site (0 if none). */
export function bundleAgeMin(c: CustomerProfile): number {
  const site = SITES[c.id].find((s) => s.airGapped);
  if (!site) return 0;
  return c.connectors.find((k) => k.id === site.sourceConnector)?.lastSyncMin ?? (site.bundleHours ?? 6) * 60;
}

export function airGappedSite(c: CustomerProfile): OtSite | undefined {
  return SITES[c.id].find((s) => s.airGapped);
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
    const zones = [...new Set(TYPES[c.id].filter((t) => t.kinds.includes(s.kind) && t.level !== 'L4' && t.level !== 'L3.5').map((t) => t.zone))];
    const conn = c.connectors.find((k) => k.id === s.sourceConnector);
    for (let i = 0; i < counts[si]; i++) {
      const collector = i > 0 && r.chance(0.3);
      const model = /Claroty/.test(s.source) ? (collector ? 'Claroty xDome collector' : 'Claroty xDome sensor') : /Armis/.test(s.source) ? (collector ? 'Armis collector' : 'Armis sensor appliance') : s.kind === 'vessel' ? 'HexaOT edge (vessel)' : collector ? 'HexaOT remote collector' : 'HexaOT Sensor S1';
      let health: OtSensor['health'] = 'Good';
      let lastSync = r.int(0, 2);
      let note: string | undefined;
      const zi = i % Math.max(1, zones.length);
      if (s.airGapped) {
        lastSync = bundleAgeMin(c);
        note = `Air-gapped: reports by signed bundle every ${s.bundleHours ?? 6} h`;
      } else if (conn && conn.status !== 'healthy' && i === 0 && (s.id === 'mar' || c.id !== 'healthcare')) {
        health = 'Attention';
        lastSync = conn.lastSyncMin;
        note = conn.note ?? 'Feed delayed';
      } else if (s.kind === 'vessel' && i % 7 === 3) {
        health = 'Attention';
        lastSync = r.int(190, 600);
        note = 'Vessel out of LEO coverage · store and forward';
      } else if (!flagged && si === Math.min(1, sc.sites.length - 1) && i === counts[si] - 1 && (c.id === 'media' || c.id === 'finserv' || c.id === 'maritime')) {
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
  const patchOf = new Map(VULN_MAP[c.id].map((v) => [v.type, v.patch] as const));
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
    out.push({ id: `X-${out.length + 1}`, src: { name: a.name, ip: a.ip, zone: a.zone, level: a.level, role: a.type }, dst: { name: 'Vendor update service', ip: `198.51.100.${r.int(10, 200)}`, zone: 'Public internet', level: 'Internet', role: 'Outside the estate' }, protocol: 'HTTPS', site: first.name, expected: false, note: `A ${SECTOR[c.id].dev} reaching out to its vendor for updates — outbound, blocked at the firewall, still trying`, alerts: r.int(6, 20), lastSeenMin: r.int(30, 400) });
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
  'HL7 v2': ['Medical', 'Orders, results and vitals between devices and Epic', false],
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
};
const RELATED: Record<string, string[]> = {
  T0843: ['T0843', 'T0821'], T0821: ['T0821', 'T0843'], T0886: ['T0886', 'T0866'], T0846: ['T0846', 'T0888'], T0859: ['T0859', 'T0866'],
  T0883: ['T0883'], T0855: ['T0855', 'T0831'], T0836: ['T0836', 'T0831'], T0882: ['T0882'], T0816: ['T0816', 'T0826'], T0832: ['T0832'], T0847: ['T0847'], T0888: [],
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
  const w = SECTOR[c.id];
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
  ALERT_SEEDS[c.id].filter((s) => kinds.has(s.kind)).forEach((s, i) => {
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
  const w = SECTOR[c.id];
  const r = rng(`ot-watch-${c.id}-${tenantId}`);
  const writers = assets.filter((a) => a.level === 'L1').length;
  const ews = assets.filter((a) => /Engineering workstation|jump host/i.test(a.type)).length;
  const vendor = flows.filter((f) => /Vendor/.test(f.from)).reduce((s, f) => s + f.value, 0);
  const hc = c.id === 'healthcare';
  return [
    { id: 'unid', title: 'Assets we cannot identify', desc: 'Talking on the network, but their traffic alone does not say what they are. Each one is a gap in the inventory.', n: Math.max(3, Math.round(assets.length * 0.011)), level: 'Attention', to: '/ot/network?zone=Unzoned' },
    { id: 'inet', title: `Attempted connections from the ${w.net} to the internet`, desc: 'All blocked at the site firewall. Every one is a device configured to reach out, which is worth turning off at the source.', n: r.int(6, 22), level: 'Attention', to: '/ot/network?expected=no' },
    { id: 'dual', title: 'Assets bridging two zones at once', desc: 'A dual-homed device joins two networks for as long as it is connected, whatever the firewall between them says.', n: r.int(2, 5), level: 'Attention', to: '/ot/network?expected=no' },
    { id: 'write', title: hc ? 'Devices connected to patients' : 'Assets that can write to the process', desc: hc ? 'Pumps, monitors, ventilators and scanners. The set where a change can reach a patient.' : 'Controllers, safety systems and remote terminal units. The set where a change matters most.', n: writers, level: 'Noted', to: '/ot/assets?view=all&level=L1' },
    { id: 'ews', title: hc ? 'Stations able to push configuration to devices' : 'Stations able to download a program to a controller', desc: 'Engineering stations and jump hosts with the tooling and the network path to change how equipment behaves.', n: ews, level: 'Noted', to: '/ot/assets?view=all&level=L3' },
    { id: 'vendor', title: 'Vendor remote-access sessions in the window', desc: hc ? 'Device OEMs servicing pumps, imaging and lab equipment from outside.' : 'Machine builders and service contractors working on site equipment from outside.', n: Math.max(2, Math.round(vendor / 4)), level: 'Noted', to: '/ot/alerts?q=Remote' },
  ];
}
