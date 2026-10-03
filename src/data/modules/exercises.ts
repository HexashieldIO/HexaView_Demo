import type { CustomerId, CustomerProfile } from '../types';
import { rng } from '../../lib/rng';
import { NOW } from '../../lib/format';
import { resilienceIndex } from '../core';

/* =====================================================================
   Crisis Exercises: a quarterly programme of tabletop, technical, OT/site,
   supply-chain, ransomware and regulator-notification exercises, driven by
   each customer's regulatory obligations. Scenarios are sector-specific,
   with timed injects; completed exercises carry capability scores,
   lessons learned and actions that flow into HexaComply as evidence.
   ===================================================================== */

export type ExKind = 'tabletop' | 'technical' | 'ot' | 'supply' | 'ransomware' | 'regulator';
export type ExStatus = 'completed' | 'overdue' | 'scheduled' | 'planned';
export type Cap = 'detect' | 'decide' | 'communicate' | 'recover' | 'notify';
export type ActionStatus = 'open' | 'in_progress' | 'done';

export const EX_KINDS: { id: ExKind; label: string; short: string; color: string }[] = [
  { id: 'tabletop', label: 'Board / executive tabletop', short: 'Tabletop', color: 'var(--m-view)' },
  { id: 'technical', label: 'Technical (SOC / IR)', short: 'Technical', color: 'var(--m-soc)' },
  { id: 'ot', label: 'OT / site', short: 'OT / site', color: 'var(--m-ot)' },
  { id: 'supply', label: 'Third-party / supply chain', short: 'Supply chain', color: 'var(--m-comply)' },
  { id: 'ransomware', label: 'Ransomware', short: 'Ransomware', color: 'var(--m-strike)' },
  { id: 'regulator', label: 'Regulator-notification drill', short: 'Regulator drill', color: 'var(--m-reports)' },
];
export const KIND_BY_ID = Object.fromEntries(EX_KINDS.map((k) => [k.id, k])) as Record<ExKind, (typeof EX_KINDS)[number]>;

export const CAPS: { id: Cap; label: string; color: string; hint: string }[] = [
  { id: 'detect', label: 'Detect', color: '#a07cfb', hint: 'Recognise, triage and declare at the right severity' },
  { id: 'decide', label: 'Decide', color: '#68b1ff', hint: 'Clear command, timely decisions with recorded rationale' },
  { id: 'communicate', label: 'Communicate', color: '#ef6aae', hint: 'Internal, customer, partner and press messaging' },
  { id: 'recover', label: 'Recover', color: '#3ad0ae', hint: 'Restore services within RTO and impact tolerance' },
  { id: 'notify', label: 'Notify', color: '#f7a04a', hint: 'Regulator and contractual notifications on time' },
];
export const CAP_BY_ID = Object.fromEntries(CAPS.map((k) => [k.id, k])) as Record<Cap, (typeof CAPS)[number]>;

export const STATUS_COLOR: Record<ExStatus, string> = {
  completed: 'var(--good)',
  overdue: 'var(--bad)',
  scheduled: 'var(--m-core)',
  planned: 'var(--sev-info)',
};
export const ACTION_COLOR: Record<ActionStatus | 'overdue', string> = {
  open: 'var(--sev-medium)',
  in_progress: 'var(--m-core)',
  done: 'var(--good)',
  overdue: 'var(--bad)',
};

export interface Inject {
  t: number;
  from: string;
  title: string;
  prompt: string;
  cap: Cap;
}
export interface Scenario {
  id: string;
  title: string;
  kind: ExKind;
  summary: string;
  objectives: string[];
  audience: string;
  durationMin: number;
  difficulty: 'Foundation' | 'Intermediate' | 'Advanced';
  tenantId: string;
  controls: string[];
  frameworks: string[];
  drivers: string[];
  injects: Inject[];
  /** Lesson learned, the action it raised, and the capability it belongs to. */
  lessons: [string, string, Cap][];
}
export interface Driver {
  id: string;
  name: string;
  requirement: string;
  perYear: number;
  note: string;
}
export interface ExAction {
  id: string;
  exerciseId: string;
  title: string;
  lesson: string;
  owner: string;
  cap: Cap;
  dueDays: number;
  status: ActionStatus;
  pushed: boolean;
}
export interface Exercise {
  id: string;
  scenarioId: string;
  title: string;
  kind: ExKind;
  quarter: 1 | 2 | 3 | 4;
  date: Date;
  dayOffset: number;
  status: ExStatus;
  tenantId: string;
  facilitator: string;
  participants: string[];
  invited: number;
  attended: number;
  durationMin: number;
  drivers: string[];
  scores?: Record<Cap, number>;
  overall?: number;
  lessons: string[];
  actions: ExAction[];
  evidenceId: string;
  pushed: boolean;
  /** Added from a live run in this session. */
  live?: boolean;
  decisions?: { t: number; text: string; by: string; ttd: number }[];
}
export interface RegClock {
  name: string;
  body: string;
  dueMin: number;
}

/* ---------------- small authoring helpers ---------------- */
type InjSeed = [number, string, string, string, Cap];
const inj = (rows: InjSeed[]): Inject[] => rows.map(([t, from, title, prompt, cap]) => ({ t, from, title, prompt, cap }));

/* =====================================================================
   Regulatory drivers per customer
   ===================================================================== */
const DRIVERS: Record<CustomerId, Driver[]> = {
  maritime: [
    { id: 'isps', name: 'ISPS Code', requirement: 'Part A/18.5–18.6 · drills every 3 months, exercises yearly (cyber annex)', perYear: 3, note: 'Port facilities and ships; PFSO and CSO attend' },
    { id: 'nis2', name: 'NIS2 Art. 21(2)(c)', requirement: 'Business continuity and crisis management, tested', perYear: 2, note: 'Maasvlakte and Antwerp as essential entities' },
    { id: 'imo', name: 'IMO MSC.428(98)', requirement: 'Cyber risk in the SMS: contingency plans exercised', perYear: 1, note: 'Verified at DoC / SMC audits' },
    { id: 'iacs', name: 'IACS UR E26 §4.4', requirement: 'Incident response and recovery plans tested on board', perYear: 1, note: 'Class survey evidence for newbuilds' },
    { id: 'iec', name: 'IEC 62443-2-1', requirement: 'SP.09 incident response exercised for OT', perYear: 1, note: 'Terminal OT (cranes, gate, reefer)' },
  ],
  finserv: [
    { id: 'dora-test', name: 'DORA Art. 24–25', requirement: 'Digital operational resilience testing programme, at least yearly', perYear: 3, note: 'Covers all ICT systems supporting critical functions' },
    { id: 'dora-bcp', name: 'DORA Art. 11(6)', requirement: 'ICT business continuity and crisis-communication plans tested yearly', perYear: 1, note: 'Includes switchover to redundant capacity' },
    { id: 'dora-tlpt', name: 'DORA Art. 26 (TLPT)', requirement: 'Threat-led penetration testing (TIBER-EU) every 3 years', perYear: 1, note: 'Cycle 2025–2027; CSSF as TLPT authority' },
    { id: 'fca', name: 'FCA/PRA SYSC 15A', requirement: 'Scenario testing of important business services against impact tolerance', perYear: 2, note: 'Self-assessment signed by the board' },
    { id: 'nydfs', name: 'NYDFS 500.16', requirement: 'Incident response and BCDR plans tested at least annually', perYear: 1, note: 'Aldersgate Markets Inc.; senior officer and CISO attend' },
    { id: 'pci', name: 'PCI DSS 12.10.2', requirement: 'Incident response plan reviewed and tested at least once every 12 months', perYear: 1, note: 'Cardholder data environment (Payments)' },
  ],
  media: [
    { id: 'tpn', name: 'TPN Gold Shield', requirement: 'Incident response plan tested yearly with evidence for the assessor', perYear: 1, note: 'Re-assessment in 41 days' },
    { id: 'mpa', name: 'MPA CSBP · IR', requirement: 'Content security incident response tested, including leak scenarios', perYear: 1, note: 'Studio partners request evidence' },
    { id: 'iso', name: 'ISO 27001 A.5.24–A.5.30', requirement: 'Incident management and ICT readiness for business continuity', perYear: 2, note: 'Surveillance audit samples exercises' },
    { id: 'soc2', name: 'SOC 2 CC7.4–7.5', requirement: 'Incident response and recovery tested (KestrelPlay)', perYear: 1, note: 'Type II period ends 31 Dec' },
    { id: 'dpp', name: 'DPP Committed to Security', requirement: 'Broadcast continuity and playout incident handling', perYear: 1, note: 'Live & Sports' },
    { id: 'pci', name: 'PCI DSS 12.10.2', requirement: 'Incident response plan tested every 12 months', perYear: 1, note: 'Subscriber payment pages' },
  ],
  healthcare: [
    { id: 'cms', name: 'CMS EP Rule 42 CFR 482.15(d)', requirement: 'Two exercises a year: one full-scale or functional, plus one more', perYear: 2, note: 'Condition of participation for every hospital' },
    { id: 'tjc', name: 'Joint Commission EM.17.01.01', requirement: 'Two emergency exercises a year incl. an escalating event', perYear: 2, note: 'Unannounced survey window open' },
    { id: 'hipaa', name: 'HIPAA 164.308(a)(7)(ii)(D)', requirement: 'Testing and revision of contingency plans', perYear: 1, note: 'OCR asks for evidence after any breach' },
    { id: 'cpg', name: 'HHS HPH CPGs', requirement: 'Incident planning and preparedness exercised (essential goal)', perYear: 1, note: 'Ties to CMS incentive proposals' },
    { id: 'hitrust', name: 'HITRUST r2 12.c–12.e', requirement: 'Business continuity plans tested and updated', perYear: 1, note: 'r2 assessment in March' },
  ],
  automotive: [
    { id: 'r155', name: 'UNECE R155 7.2.2.2(g)', requirement: 'CSMS processes to respond to cyber attacks on vehicle types, exercised', perYear: 1, note: 'KBA CSMS re-audit in April' },
    { id: 'iso21434', name: 'ISO/SAE 21434 cl. 13', requirement: 'Cybersecurity incident response for the post-development phase', perYear: 1, note: 'VSOC with Upstream' },
    { id: 'r156', name: 'UNECE R156 7.1.2', requirement: 'Software update process recovery (failed or malicious update)', perYear: 1, note: 'OTA release management' },
    { id: 'tisax', name: 'TISAX 1.6.2', requirement: 'Security incidents handled and the process tested', perYear: 1, note: 'AL3 renewal in February' },
    { id: 'nis2', name: 'NIS2 Art. 21(2)(c)', requirement: 'Business continuity and crisis management, tested', perYear: 2, note: 'Ingolstadt and Győr as essential entities' },
    { id: 'iec', name: 'IEC 62443-2-1', requirement: 'SP.09 incident response exercised per plant', perYear: 2, note: 'Ingolstadt, Győr, Puebla, battery plant' },
  ],
};

/* =====================================================================
   Scenario libraries (sector-specific)
   ===================================================================== */
function scenarioSeeds(c: CustomerProfile): Scenario[] {
  const p = c.people;
  switch (c.id) {
    case 'maritime':
      return [
        {
          id: 'MX-TT-01', title: 'Board tabletop: two terminals dark in peak season', kind: 'tabletop', tenantId: 'all', difficulty: 'Intermediate', durationMin: 150,
          summary: 'A coordinated intrusion takes the Navis N4 TOS down at Maasvlakte and Antwerp during the pre-Christmas peak. Vessels queue, charterers threaten to divert and a leak site claims 40 GB of customs data.',
          objectives: ['Test escalation from terminal to group crisis team', 'Agree criteria for diverting vessels to partner terminals', 'Rehearse NIS2 early warning and charterer messaging'],
          audience: `${p.board.name} (CEO), CFO, ${p.ciso.name}, terminal directors, group comms, legal`, controls: ['CTL-BKP-07', 'CTL-NET-04'], frameworks: ['NIS2', 'ISO 27001', 'IMO'], drivers: ['nis2', 'imo'],
          injects: inj([
            [0, 'Terminal ops (Maasvlakte)', 'Yard cranes idle: TOS screens frozen at RTM', 'Is this an IT outage or a cyber incident? Who decides?', 'detect'],
            [15, 'HexaSOC', 'Defender XDR: same ransomware family on ANT-TOS-APP02', 'Do you declare a group major incident now?', 'detect'],
            [35, 'Commercial', 'Three carriers ask whether to divert to Wilhelmshaven', 'What do you tell carriers, and who signs it off?', 'communicate'],
            [60, 'HexaInt', 'Leak site posts 40 GB sample incl. customs declarations', 'Does this change notification duties or the ransom stance?', 'notify'],
            [90, 'Legal', 'NIS2 24 h early-warning window: 14 h remaining', 'Submit early warning to CSIRT NL and CCB now or wait?', 'notify'],
            [120, 'Terminal IT', 'Clean restore point found; 18 h to rebuild TOS', 'Accept 18 h, or run manual gate and berth operations?', 'recover'],
          ]),
          lessons: [
            ['Group crisis team took 47 min to convene; terminal directors were unsure who could declare', 'Publish a one-page declaration matrix for terminal directors and the duty CISO', 'decide'],
            ['No pre-approved holding statement existed for carriers and charterers', 'Draft and pre-approve carrier, charterer and shipper holding statements', 'communicate'],
            ['NIS2 early warning was drafted ad hoc; nobody owned the CSIRT NL portal account', 'Assign a named NIS2 notification owner and test portal access quarterly', 'notify'],
          ],
        },
        {
          id: 'MX-TE-02', title: 'SOC/IR drill: VSAT remote-access compromise on a vessel', kind: 'technical', tenantId: 'fleet', difficulty: 'Advanced', durationMin: 180,
          summary: 'A stolen vendor credential is used over the VSAT link to reach the Halcyon Aurora engine-room network via an unmanaged remote-access tool. HexaSOC sees the session only through store-and-forward telemetry.',
          objectives: ['Validate detection of T1133/T1219 over satellite links', 'Practise ship-to-shore isolation without affecting navigation', 'Exercise the vendor credential revocation path'],
          audience: `${p.socLead.name}, ${p.otLead?.name ?? 'OT lead'}, fleet IT, HexaShield IR, Chief Engineer (remote)`, controls: ['CTL-OT-02', 'CTL-ACC-01'], frameworks: ['IACS E26/27', 'IEC 62443'], drivers: ['iacs', 'imo'],
          injects: inj([
            [0, 'HexaSOC', 'Vessel edge: new AnyDesk session from unknown ASN', 'Is this sanctioned vendor maintenance?', 'detect'],
            [20, 'Chief Engineer', 'ECR workstation mouse moving on its own', 'Do you cut the VSAT remote-access path at sea?', 'decide'],
            [45, 'Master', 'Vessel 6 h from pilot station, heavy traffic', 'Who has authority over IT isolation on board vs bridge safety?', 'decide'],
            [70, 'HexaInt', 'Vendor credential found in a stealer log 9 days ago', 'Revoke all sessions for the vendor fleet-wide?', 'recover'],
            [110, 'Flag state liaison', 'Flag asks whether the ship is safe to continue', 'What do you report and on which channel?', 'notify'],
          ]),
          lessons: [
            ['Store-and-forward delay added 22 min before HexaSOC saw the session', 'Raise vessel edge forwarding priority for remote-access events', 'detect'],
            ['Bridge and ECR disagreed on who could order isolation', 'Add cyber isolation authority to the SMS master standing orders', 'decide'],
          ],
        },
        {
          id: 'MX-OT-03', title: 'OT site: STS crane PLC logic change at Maasvlakte', kind: 'ot', tenantId: 'rtm', difficulty: 'Advanced', durationMin: 120,
          summary: 'Dragos flags an unscheduled programme download to a ship-to-shore crane PLC. Crane maintenance cannot explain it and a twin-lift is in progress over a loaded vessel.',
          objectives: ['Test OT read-only detection to safe-state decision', 'Exercise the crane OEM call-out and safety case', 'Confirm evidence capture without touching controllers'],
          audience: `${p.otLead?.name ?? 'OT lead'}, crane maintenance, terminal director, HSE, HexaShield OT IR`, controls: ['CTL-OT-12', 'CTL-OT-02'], frameworks: ['IEC 62443', 'ISPS'], drivers: ['iec', 'isps'],
          injects: inj([
            [0, 'Dragos', 'Programme download to STS-07 PLC (Modbus/TCP)', 'Is there an approved change ticket?', 'detect'],
            [12, 'Crane maintenance', 'No work order; engineer laptop on leave', 'Do you stop STS-07 mid-operation?', 'decide'],
            [30, 'HSE', 'Twin-lift over a loaded vessel in progress', 'How do you reach a safe state, and who authorises it?', 'decide'],
            [55, 'Crane OEM', 'OEM can compare logic in 4 h', 'Keep the crane out of service until then?', 'recover'],
            [80, 'PFSO', 'PFSO asks if this is an ISPS security incident', 'Do you report to the port authority?', 'notify'],
          ]),
          lessons: [
            ['Golden PLC images were not available on site to compare logic', 'Store signed golden PLC images for all STS cranes in the OT vault', 'recover'],
            ['Safe-state procedure for cyber events was not in the crane operating manual', 'Add a cyber safe-state step to crane operating procedures', 'decide'],
          ],
        },
        {
          id: 'MX-SC-04', title: 'Supply chain: poisoned TOS vendor update', kind: 'supply', tenantId: 'all', difficulty: 'Intermediate', durationMin: 120,
          summary: 'A TOS vendor discloses that a signed hotfix pushed last week contained a backdoor. Three terminals installed it; Santos is mid-upgrade.',
          objectives: ['Exercise third-party breach intake and contract levers', 'Decide on rollback vs isolation per terminal', 'Test supplier communications and evidence requests'],
          audience: `${p.grcLead.name}, ${p.ciso.name}, procurement, terminal IT managers`, controls: ['CTL-SUP-11'], frameworks: ['NIS2', 'ISO 27001'], drivers: ['nis2'],
          injects: inj([
            [0, 'Vendor', 'Security advisory: hotfix 4.2.17 contained a backdoor', 'Which terminals installed it? How fast can you know?', 'detect'],
            [20, 'HexaView', 'Fabric: hotfix seen on RTM, ANT, PKL; Santos staged', 'Stop the Santos upgrade? Roll back the others?', 'decide'],
            [50, 'HexaSOC', 'Beacon to vendor-hosted domain from ANT-TOS-APP01', 'Isolate Antwerp TOS during working hours?', 'recover'],
            [80, 'Procurement', 'Contract allows a 72 h breach report from the vendor', 'What evidence do you demand, and by when?', 'communicate'],
          ]),
          lessons: [
            ['SBOM for the TOS was not available, slowing the exposure check', 'Require SBOM delivery for TOS and gate OCR releases in contracts', 'detect'],
            ['Supplier breach clause had no right to forensic evidence', 'Add forensic cooperation and evidence rights to the vendor DPA', 'communicate'],
          ],
        },
        {
          id: 'MX-RW-05', title: 'Ransomware: TOS encryption at Port Klang', kind: 'ransomware', tenantId: 'pkl', difficulty: 'Advanced', durationMin: 180,
          summary: 'Replay of MI-2026-031: a LockBit affiliate encrypts the TOS application tier and gate OCR controllers. Quay cranes run on local control; the gate goes to paper.',
          objectives: ['Validate the lessons from MI-2026-031 are embedded', 'Time-to-isolate the Level 3.5 conduit', 'Restore from immutable copies within RTO'],
          audience: `${p.ciso.name}, terminal IT (Port Klang), ${p.otLead?.name ?? 'OT lead'}, HexaShield DFIR, CFO`, controls: ['CTL-BKP-07', 'CTL-MAL-05', 'CTL-NET-04'], frameworks: ['ISO 27001', 'IEC 62443'], drivers: ['iec', 'isps'],
          injects: inj([
            [0, 'Defender XDR', 'Mass file rename on PKL-TOS-APP01 (T1486)', 'Declare? At what severity?', 'detect'],
            [10, 'Terminal IT', 'Gate OCR lanes 1–6 down', 'Close the Level 3.5 conduit now?', 'decide'],
            [40, 'HexaInt', 'Ransom note: LockBit 3.0 affiliate, 72 h deadline', 'Engage, or not? Who decides?', 'decide'],
            [75, 'Veeam', 'Immutable copy from 02:00 verified clean', 'Accept 3 h data loss and restore?', 'recover'],
            [110, 'NACSA liaison', 'NCII designation confirmed: 6 h initial report', 'Who files, and with what facts?', 'notify'],
            [150, 'Commercial', 'Charterers ask for berth window update', 'What do you commit to publicly?', 'communicate'],
          ]),
          lessons: [
            ['Conduit isolation took 9 min, down from 17 min in the live incident', 'Automate Level 3.5 conduit closure as a pre-approved HexaView action', 'recover'],
            ['NACSA template not pre-filled; facts gathered by email', 'Pre-fill NACSA and port authority templates from HexaView case data', 'notify'],
          ],
        },
        {
          id: 'MX-RD-06', title: 'Regulator drill: NIS2 24 h early warning to CSIRT NL and CCB', kind: 'regulator', tenantId: 'rtm', difficulty: 'Foundation', durationMin: 90,
          summary: 'A significant incident at Maasvlakte triggers NIS2 Article 23. The team must file the early warning, then the 72 h notification, with consistent facts across two authorities.',
          objectives: ['File the early warning within 24 h', 'Keep facts consistent across CSIRT NL and CCB Belgium', 'Rehearse sign-off by the management body'],
          audience: `${p.grcLead.name}, legal, ${p.ciso.name}, terminal director Maasvlakte`, controls: ['CTL-LOG-06'], frameworks: ['NIS2'], drivers: ['nis2', 'isps'],
          injects: inj([
            [0, 'HexaSOC', 'Incident classed significant: berth operations degraded', 'Does Article 23 apply? Which entity is notifying?', 'notify'],
            [20, 'Legal', 'Antwerp shares the same TOS cluster', 'Do you notify CCB Belgium as well?', 'notify'],
            [40, 'Comms', 'Journalist asks for comment', 'Is the press statement consistent with the regulator filing?', 'communicate'],
            [60, 'CSIRT NL', 'Request for indicators and cross-border impact', 'What do you share and through which channel?', 'notify'],
          ]),
          lessons: [
            ['Early warning filed at T+3.2 h, well inside 24 h', 'Keep the pre-filled NIS2 template in HexaView reporting', 'notify'],
            ['Cross-border impact assessment was not documented', 'Add a cross-border impact checklist to the NIS2 playbook', 'notify'],
          ],
        },
        {
          id: 'MX-OT-07', title: 'ISPS drill: port facility access control outage', kind: 'ot', tenantId: 'ant', difficulty: 'Foundation', durationMin: 75,
          summary: 'The badge and gate access control system at Antwerp fails after a suspicious firmware push. Security level may need raising while the gate runs on manual checks.',
          objectives: ['Exercise ISPS security-level change with a cyber cause', 'Run manual access control with the PFSO', 'Preserve evidence from the access controllers'],
          audience: 'PFSO Antwerp, terminal security, terminal IT, HexaShield OT IR', controls: ['CTL-ACC-01', 'CTL-OT-12'], frameworks: ['ISPS', 'IEC 62443'], drivers: ['isps'],
          injects: inj([
            [0, 'Gate security', 'All badge readers rejecting valid cards', 'Fail open, fail closed, or manual?', 'decide'],
            [15, 'HexaOT', 'Unscheduled firmware push to access controllers', 'Is this a security incident under ISPS?', 'detect'],
            [35, 'PFSO', 'Consider moving to security level 2', 'Who informs the port authority and ships alongside?', 'notify'],
            [55, 'Vendor', 'Firmware rollback possible in 2 h', 'Roll back or rebuild from known-good?', 'recover'],
          ]),
          lessons: [
            ['Manual access lists were 3 weeks out of date', 'Sync emergency manual access lists weekly from the HR system', 'recover'],
          ],
        },
      ];
    case 'finserv':
      return [
        {
          id: 'FS-TT-01', title: 'Board tabletop: payments outage beyond impact tolerance', kind: 'tabletop', tenantId: 'all', difficulty: 'Advanced', durationMin: 150,
          summary: 'A destructive attack on the payments hub stops Faster Payments for 9 hours on a payday Friday, breaching the board-approved impact tolerance of 4 hours.',
          objectives: ['Test board decision-making when tolerance is breached', 'Rehearse customer redress and FCA/PRA engagement', 'Validate DORA crisis-communication plan'],
          audience: `${p.board.name}, ${p.staff[0]?.name ?? 'CFO'} (CFO), ${p.ciso.name}, COO, General Counsel, Head of Comms`, controls: ['CTL-BCP-09', 'CTL-PAY-04'], frameworks: ['FCA Op Res', 'DORA'], drivers: ['fca', 'dora-bcp', 'dora-test'],
          injects: inj([
            [0, 'Payments ops', 'FPS submissions failing; queue at 180k', 'Is this an operational or cyber incident? Who leads?', 'detect'],
            [20, 'HexaSOC', 'Wiper artefacts on two payments hub servers', 'Fail over to the secondary site, knowing it may be infected?', 'decide'],
            [50, 'Treasury', 'Liquidity buffers stretched by failed outbound payments', 'Do you request Bank of England support?', 'decide'],
            [80, 'Comms', 'Social media: customers cannot pay rent', 'What do you say, and do you commit to redress?', 'communicate'],
            [110, 'Regulator', 'PRA supervisor calls the CRO', 'What is your path back within tolerance?', 'notify'],
            [140, 'Payments ops', 'Clean rebuild ready; 5 h to restore', 'Accept, or run a manual payments process?', 'recover'],
          ]),
          lessons: [
            ['Board had no pre-agreed criteria for failing over to a possibly infected site', 'Define failover go/no-go criteria for the payments hub', 'decide'],
            ['Customer redress approach was debated for 35 min', 'Pre-approve a customer redress framework for payments outages', 'communicate'],
            ['Impact tolerance breach messaging to PRA lacked a recovery timeline', 'Template the tolerance-breach notification with recovery milestones', 'notify'],
          ],
        },
        {
          id: 'FS-TE-02', title: 'SOC/IR: help-desk social engineering to Okta takeover', kind: 'technical', tenantId: 'ukbank', difficulty: 'Advanced', durationMin: 180,
          summary: 'A Scattered Spider-style caller convinces the service desk to reset MFA for a payments engineer, then registers a new device and pivots to CyberArk.',
          objectives: ['Detect MFA reset abuse and new-device registration', 'Exercise session revocation across Okta and Entra ID', 'Contain before Tier 0 credentials are retrieved'],
          audience: `${p.socLead.name}, service desk lead, identity team, HexaShield IR`, controls: ['CTL-IAM-01', 'CTL-PAM-02'], frameworks: ['DORA', 'PCI DSS', 'NYDFS 500'], drivers: ['dora-test', 'pci'],
          injects: inj([
            [0, 'Service desk', 'Caller requests urgent MFA reset, cites a live outage', 'Does the verification script hold?', 'detect'],
            [15, 'Okta', 'New FIDO device registered from a residential proxy', 'Is this alert triaged automatically or by a human?', 'detect'],
            [30, 'CyberArk', 'Vault retrieval of a payments service account', 'Revoke the user and rotate the account now?', 'decide'],
            [55, 'HexaSOC', 'Entra ID sign-in to Azure portal from the same session', 'Contain across both IdPs; who approves?', 'recover'],
            [90, 'Legal', 'Possible access to cardholder data environment', 'Do PCI or NYDFS notifications apply?', 'notify'],
          ]),
          lessons: [
            ['Service desk script allowed reset with knowledge-based answers', 'Require video or manager verification for privileged MFA resets', 'detect'],
            ['Session revocation in Okta and Entra ID took two separate approvals', 'Bundle cross-IdP revocation as one pre-approved high-risk action', 'recover'],
          ],
        },
        {
          id: 'FS-OT-03', title: 'Data-centre site: cooling failure during a cyber event', kind: 'ot', tenantId: 'ukbank', difficulty: 'Intermediate', durationMin: 120,
          summary: 'The BMS at the primary data centre reports a chiller failure while HexaSOC is investigating suspicious BMS vendor access. Hall temperatures rise 1 °C every 6 minutes.',
          objectives: ['Coordinate facilities, security and IT under time pressure', 'Decide on controlled shutdown vs failover', 'Validate vendor access revocation for BMS'],
          audience: `${p.otLead?.name ?? 'Facilities lead'}, ${p.socLead.name}, infrastructure, BMS vendor`, controls: ['CTL-TPR-10', 'CTL-BCP-09'], frameworks: ['DORA', 'ISO 27001'], drivers: ['dora-bcp'],
          injects: inj([
            [0, 'BMS', 'Chiller 2 offline; hall B at 27 °C and rising', 'Fault or attack? What do you check first?', 'detect'],
            [15, 'HexaSOC', 'BMS vendor session active from an unusual country', 'Terminate the vendor session while the chiller is down?', 'decide'],
            [35, 'Facilities', 'Hall B will reach 32 °C in 30 min', 'Fail over trading and payments workloads now?', 'recover'],
            [70, 'Vendor', 'Vendor denies any remote session', 'Who preserves the evidence?', 'detect'],
          ]),
          lessons: [
            ['BMS vendor access was not brokered via CyberArk', 'Move BMS vendor access behind PAM with session recording', 'detect'],
          ],
        },
        {
          id: 'FS-SC-04', title: 'Critical ICT third party: cloud region outage', kind: 'supply', tenantId: 'eu', difficulty: 'Intermediate', durationMin: 120,
          summary: 'A hyperscaler region hosting the EU core banking replica is unavailable for 14 hours. Aldersgate Europe must decide whether to invoke the exit plan under DORA Art. 28.',
          objectives: ['Exercise concentration-risk decisions', 'Test exit and substitution plans for a critical provider', 'Report to CSSF consistently'],
          audience: `${p.staff[2]?.name ?? 'CEO Europe'}, ${p.grcLead.name}, vendor management, cloud platform team`, controls: ['CTL-TPR-10', 'CTL-CLD-12'], frameworks: ['DORA', 'NIS2'], drivers: ['dora-test', 'dora-bcp'],
          injects: inj([
            [0, 'Cloud platform', 'eu-west region degraded: core replica unreachable', 'Does this meet the major ICT incident criteria?', 'detect'],
            [30, 'Vendor management', 'Provider ETA unknown; status page vague', 'Invoke the exit plan for critical functions?', 'decide'],
            [60, 'Operations', 'Branch and online banking in Luxembourg offline', 'What do customers hear and when?', 'communicate'],
            [90, 'Legal', 'DORA initial notification due 4 h after classification', 'Who files with CSSF?', 'notify'],
          ]),
          lessons: [
            ['Exit plan assumed 48 h notice; no hot standby existed', 'Fund a warm standby for EU core banking in a second region', 'recover'],
            ['Major-incident classification criteria were applied inconsistently', 'Embed DORA RTS classification criteria in the HexaView incident form', 'notify'],
          ],
        },
        {
          id: 'FS-RW-05', title: 'Ransomware with data-leak extortion on the batch estate', kind: 'ransomware', tenantId: 'all', difficulty: 'Advanced', durationMin: 180,
          summary: 'A double-extortion crew encrypts the distributed batch servers feeding the mainframe and posts wealth-client records on a leak site.',
          objectives: ['Rehearse ransom decision governance', 'Exercise restoration of end-of-day batch within tolerance', 'Coordinate GDPR, NYDFS and FCA notifications'],
          audience: `${p.ciso.name}, ${p.staff[6]?.name ?? 'mainframe lead'}, ${p.staff[3]?.name ?? 'Head of Private Banking'}, legal, HexaShield DFIR`, controls: ['CTL-BCP-09', 'CTL-EDR-05', 'CTL-MF-13'], frameworks: ['DORA', 'NYDFS 500'], drivers: ['nydfs', 'dora-test'],
          injects: inj([
            [0, 'CrowdStrike', 'Encryption on 14 batch servers (T1486)', 'Contain and declare: who and how fast?', 'detect'],
            [25, 'Mainframe', 'End-of-day batch cannot start; RACF unaffected', 'Run batch manually or delay settlement?', 'recover'],
            [60, 'HexaInt', 'Leak site lists 1,200 wealth clients', 'Notify clients now or after verification?', 'notify'],
            [100, 'Board', 'Ransom demand £8.5M; insurer on the line', 'Engage, refuse, or delay? Who records the rationale?', 'decide'],
            [140, 'Comms', 'FT asks for confirmation', 'What do you confirm?', 'communicate'],
          ]),
          lessons: [
            ['Ransom decision authority was not written down', 'Document ransom decision authority and sanctions screening steps', 'decide'],
            ['Batch restore relied on one engineer', 'Cross-train two engineers on batch restore runbooks', 'recover'],
          ],
        },
        {
          id: 'FS-RD-06', title: 'DORA major ICT incident reporting drill (4 h / 72 h / 1 month)', kind: 'regulator', tenantId: 'pay', difficulty: 'Foundation', durationMin: 90,
          summary: 'A card-acquiring outage is classified as major. The team files the initial, intermediate and final reports on the ITS template, plus the NYDFS 72 h notice for Markets.',
          objectives: ['File the initial report within 4 h of classification', 'Keep facts consistent across CSSF, FCA and NYDFS', 'Rehearse sign-off and record keeping'],
          audience: `${p.grcLead.name}, regulatory affairs, legal, ${p.ciso.name}`, controls: ['CTL-LOG-06'], frameworks: ['DORA', 'NYDFS 500'], drivers: ['dora-test', 'nydfs'],
          injects: inj([
            [0, 'Payments', 'Card acquiring down for 2 h, 310k transactions failed', 'Major under the RTS criteria? Classify now.', 'notify'],
            [25, 'Regulatory affairs', 'Initial report template: 11 mandatory fields', 'Which facts are confirmed vs estimated?', 'notify'],
            [50, 'Markets', 'Same root cause affects the US broker-dealer', 'Does NYDFS 500.17 apply (72 h)?', 'notify'],
            [75, 'Comms', 'Merchant helpline volumes up 9×', 'Align the merchant message with the regulator filing?', 'communicate'],
          ]),
          lessons: [
            ['Initial report filed at 3 h 10 min; two fields estimated', 'Pre-populate RTS fields from HexaView incident data', 'notify'],
          ],
        },
        {
          id: 'FS-TE-07', title: 'TLPT replay: SWIFT secure zone (TIBER-EU purple team)', kind: 'technical', tenantId: 'ukbank', difficulty: 'Advanced', durationMin: 240,
          summary: 'Purple-team replay of the red-team path from a phished operator to the SWIFT Alliance Access jump host, with the blue team watching live.',
          objectives: ['Validate detections along the TLPT attack path', 'Close the gaps found in the red-team phase', 'Produce TLPT remediation evidence for CSSF'],
          audience: `${p.socLead.name}, SWIFT operations, HexaStrike red team, detection engineering`, controls: ['CTL-SWF-03', 'CTL-PAM-02'], frameworks: ['DORA', 'SWIFT CSP'], drivers: ['dora-tlpt', 'dora-test'],
          injects: inj([
            [0, 'HexaStrike', 'Phishing payload executed on operator workstation', 'Which detection should fire? Did it?', 'detect'],
            [40, 'HexaStrike', 'Credential dumping on the jump host (T1003.001)', 'Time to alert vs time to contain?', 'detect'],
            [90, 'HexaStrike', 'Operator session into Alliance Access', 'Who can stop a payment release?', 'decide'],
            [150, 'Detection engineering', 'Two detections did not fire', 'Deploy fixes now via HexaView write-back?', 'recover'],
          ]),
          lessons: [
            ['Jump-host credential dumping was not detected', 'Deploy LSASS access detection to the SWIFT secure zone', 'detect'],
          ],
        },
      ];
    case 'media':
      return [
        {
          id: 'MD-TT-01', title: 'Exec tabletop: Project Nightjar leaks three weeks before premiere', kind: 'tabletop', tenantId: 'all', difficulty: 'Intermediate', durationMin: 120,
          summary: 'A watermarked screener of Project Nightjar appears on a torrent index. Studio partners, the director and talent agencies demand answers within hours.',
          objectives: ['Trace the leak to source via watermark and custody chain', 'Decide on takedown, legal and release-date options', 'Coordinate studio-partner and talent communications'],
          audience: `${p.board.name}, ${p.staff[0]?.name ?? 'President of Production'}, ${p.grcLead.name}, legal, marketing`, controls: ['CTL-WAT-08', 'CTL-CST-01'], frameworks: ['MPA CSBP', 'TPN'], drivers: ['mpa', 'tpn'],
          injects: inj([
            [0, 'HexaInt', 'Nightjar 1080p screener on a torrent index', 'Is it ours? How fast can you confirm?', 'detect'],
            [15, 'HexaCustody', 'Watermark traced to a review link issued to a vendor', 'Revoke every open review link for the title?', 'decide'],
            [40, 'Studio partner', 'Distribution partner invokes the security clause', 'What do you tell them, and when?', 'communicate'],
            [70, 'Legal', 'Takedown notices: 14 mirrors identified', 'Move the release date or proceed?', 'decide'],
            [100, 'Marketing', 'Director posts on social media', 'Single spokesperson? What is the line?', 'communicate'],
          ]),
          lessons: [
            ['Watermark lookup took 50 min because the vendor index was manual', 'Automate forensic watermark lookup via the HexaCustody API', 'detect'],
            ['No owner for studio-partner notification', 'Name the Content Security Director as studio-partner notifier', 'notify'],
          ],
        },
        {
          id: 'MD-TE-02', title: 'SOC/IR: screener portal review-link token abuse', kind: 'technical', tenantId: 'studios', difficulty: 'Intermediate', durationMin: 150,
          summary: 'An attacker abuses an auth bypass on screeners.kestrelpictures.com to mint review-link tokens and bulk-download dailies.',
          objectives: ['Detect abnormal review-link downloads', 'Exercise emergency WAF rule deployment via Cloudflare', 'Rotate signing keys without breaking legitimate review'],
          audience: `${p.socLead.name}, web platform team, ${p.grcLead.name}, HexaShield IR`, controls: ['CTL-VUL-09', 'CTL-LOG-07'], frameworks: ['TPN', 'ISO 27001'], drivers: ['iso', 'tpn'],
          injects: inj([
            [0, 'Cloudflare', '4,000 review-link requests from 30 IPs in 10 min', 'Rate-limit, block or observe?', 'detect'],
            [20, 'Google SecOps', 'Token minted without a matching login', 'Is the portal itself compromised?', 'detect'],
            [45, 'Web platform', 'Rotating the signing key breaks 900 live links', 'Rotate now?', 'decide'],
            [80, 'Content security', '37 dailies downloaded', 'Notify the affected productions?', 'notify'],
          ]),
          lessons: [
            ['Cloudflare emergency rule took 25 min to approve', 'Pre-approve emergency WAF rules as a medium-risk HexaView action', 'recover'],
          ],
        },
        {
          id: 'MD-OT-03', title: 'Live broadcast: ST 2110 playout hijack during live sports', kind: 'ot', tenantId: 'live', difficulty: 'Advanced', durationMin: 120,
          summary: 'During a live league match, an unauthorised stream appears on the Atlanta playout chain. The rights-holder contract requires notification within 15 minutes of any on-air incident.',
          objectives: ['Switch to the clean backup chain within 60 s', 'Preserve evidence on the ST 2110 network', 'Notify the league within contract timelines'],
          audience: `${p.otLead?.name ?? 'Broadcast engineering'}, ${p.staff[6]?.name ?? 'playout engineer'}, master control, ${p.socLead.name}`, controls: ['CTL-OT-12'], frameworks: ['DPP CtS', 'ISO 27001'], drivers: ['dpp', 'iso'],
          injects: inj([
            [0, 'Master control', 'Unknown graphic overlay on air for 8 s', 'Switch to backup chain? Who calls it?', 'decide'],
            [5, 'HexaOT', 'Unexpected NMOS registration on the playout VLAN', 'Is the backup chain also exposed?', 'detect'],
            [15, 'League', 'Rights-holder asks what happened', 'What do you say within 15 minutes?', 'notify'],
            [40, 'Comms', 'Clips trending on social media', 'Statement now or after root cause?', 'communicate'],
            [80, 'Vendor', 'Graphics vendor remote session found', 'Revoke vendor access during a live event?', 'recover'],
          ]),
          lessons: [
            ['Switch to the backup chain took 2 min 40 s', 'Drill the one-button backup chain switch monthly', 'recover'],
            ['League notification exceeded 15 min', 'Add the league contact and template to the master control runbook', 'notify'],
          ],
        },
        {
          id: 'MD-SC-04', title: 'Vendor chain: localisation vendor breach exposes dubbed masters', kind: 'supply', tenantId: 'post', difficulty: 'Intermediate', durationMin: 120,
          summary: 'Red Fern Localisation reports ransomware; dubbed masters for two unreleased titles may have been exfiltrated. Their TPN status is under review.',
          objectives: ['Establish which assets the vendor held', 'Revoke vendor custody and access quickly', 'Exercise contractual and studio notifications'],
          audience: `${p.grcLead.name}, ${p.staff[7]?.name ?? 'localisation coordinator'}, vendor management, legal`, controls: ['CTL-VEN-05', 'CTL-CST-01'], frameworks: ['TPN', 'MPA CSBP'], drivers: ['tpn', 'mpa'],
          injects: inj([
            [0, 'Vendor', 'Red Fern: ransomware on file servers', 'Which of our titles and assets did they hold?', 'detect'],
            [20, 'HexaCustody', '2 titles, 118 assets in their custody chain', 'Revoke all access now?', 'decide'],
            [50, 'HexaInt', 'Leak-site listing names Red Fern', 'Notify studio partners before confirmation?', 'notify'],
            [80, 'Production', 'Dubbing deadline in 5 days', 'Move work to another vendor?', 'recover'],
          ]),
          lessons: [
            ['Custody chain showed 2 untracked copies at the vendor', 'Enforce custody agents at all localisation vendors', 'detect'],
          ],
        },
        {
          id: 'MD-RW-05', title: 'Ransomware on the render farm and NEXIS storage', kind: 'ransomware', tenantId: 'post', difficulty: 'Advanced', durationMin: 180,
          summary: 'Encryption spreads from an edit bay to render nodes and Avid NEXIS. Two features are in final conform; delivery deadlines are contractual.',
          objectives: ['Contain lateral spread on the content network', 'Restore masters from immutable copies', 'Prioritise deliveries against contract deadlines'],
          audience: `${p.ciso.name}, ${p.staff[2]?.name ?? 'Head of Post'}, IT platforms, HexaShield DFIR`, controls: ['CTL-BKP-11', 'CTL-EDR-06', 'CTL-NET-03'], frameworks: ['ISO 27001', 'TPN'], drivers: ['iso', 'tpn'],
          injects: inj([
            [0, 'SentinelOne', 'Encryption on EDIT-BAY-07 and 4 render nodes', 'Isolate the content network segment?', 'detect'],
            [20, 'Post', 'NEXIS workspace for Nightjar inaccessible', 'Pull the plug on NEXIS?', 'decide'],
            [60, 'IT platforms', 'Immutable copies verified to 03:00', 'Restore order: which title first?', 'recover'],
            [110, 'Studio partner', 'Delivery due in 72 h', 'Ask for an extension or deliver partial?', 'communicate'],
          ]),
          lessons: [
            ['Restore priority was not pre-agreed between titles', 'Maintain a delivery-priority list in the BC plan', 'recover'],
          ],
        },
        {
          id: 'MD-RD-06', title: 'Breach notification drill: KestrelPlay subscriber data', kind: 'regulator', tenantId: 'play', difficulty: 'Foundation', durationMin: 90,
          summary: 'A misconfigured analytics bucket exposed 2.1M subscriber records, including partial card data. GDPR 72 h, US state laws and PCI card-brand rules all apply.',
          objectives: ['Map obligations across GDPR, US states and PCI', 'File within the shortest clock', 'Draft subscriber notices'],
          audience: `${p.grcLead.name}, privacy counsel, ${p.staff[8]?.name ?? 'streaming SRE'}, customer care`, controls: ['CTL-PCI-10', 'CTL-LOG-07'], frameworks: ['PCI DSS', 'SOC 2'], drivers: ['soc2', 'pci'],
          injects: inj([
            [0, 'Cloud posture', 'Public S3 bucket with subscriber exports', 'Personal data breach? Card data in scope?', 'detect'],
            [30, 'Privacy', 'EU, UK and 31 US states affected', 'Which clock is shortest?', 'notify'],
            [55, 'Acquirer', 'Card brands require notice within 24 h', 'Who contacts the acquirer?', 'notify'],
            [80, 'Customer care', 'Volumes spike after a tweet', 'Publish an FAQ now?', 'communicate'],
          ]),
          lessons: [
            ['Obligation mapping took 70 min across jurisdictions', 'Keep a pre-built obligations matrix for subscriber data', 'notify'],
          ],
        },
        {
          id: 'MD-TT-07', title: 'Talent account takeover and deepfake statement', kind: 'tabletop', tenantId: 'studios', difficulty: 'Foundation', durationMin: 90,
          summary: "A lead actor's social account is hijacked and posts a deepfake video attacking the studio days before a press junket.",
          objectives: ['Coordinate with talent agencies and platforms', 'Verify authenticity quickly', 'Agree a single public line'],
          audience: `Marketing, talent relations, ${p.grcLead.name}, legal, ${p.socLead.name}`, controls: ['CTL-IAM-02'], frameworks: ['ISO 27001'], drivers: ['iso'],
          injects: inj([
            [0, 'Marketing', 'Actor account posts an inflammatory video', 'Is it real? Who verifies?', 'detect'],
            [20, 'HexaInt', 'Deepfake indicators and a SIM-swap report', 'Engage the platform trust team?', 'decide'],
            [45, 'Agency', 'Agent demands the studio says nothing', 'Who leads the public line?', 'communicate'],
          ]),
          lessons: [
            ['No escalation path to platform trust and safety teams', 'Register verified escalation contacts with major platforms', 'communicate'],
          ],
        },
      ];
    case 'healthcare':
      return [
        {
          id: 'HC-TT-01', title: 'Board tabletop: Epic down 72 hours across the system', kind: 'tabletop', tenantId: 'all', difficulty: 'Advanced', durationMin: 150,
          summary: 'A system-wide Epic outage after a ransomware intrusion forces downtime procedures in every hospital. The ED at the Medical Center considers diversion.',
          objectives: ['Test board and incident command decisions on diversion and elective surgery', 'Rehearse patient, staff and community communications', 'Validate extended downtime procedures'],
          audience: `${p.board.name}, ${p.staff[0]?.name ?? 'CMIO'}, ${p.staff[2]?.name ?? 'CNO'}, ${p.staff[1]?.name ?? 'CFO'}, ${p.ciso.name}, hospital incident commanders`, controls: ['CTL-BKP-06', 'CTL-EDR-05'], frameworks: ['HIPAA', 'HPH CPGs'], drivers: ['cms', 'tjc', 'hipaa'],
          injects: inj([
            [0, 'Epic technical', 'Hyperspace unavailable at all sites', 'Activate HICS and downtime procedures?', 'detect'],
            [20, 'ED', 'ED boarding at 140%; ambulances inbound', 'Divert ambulances? For how long?', 'decide'],
            [50, 'Pharmacy', 'eMAR down; medication administration on paper', 'Pause elective surgery tomorrow?', 'decide'],
            [80, 'HexaSOC', 'Ransomware confirmed on Epic app servers', 'Engage the FBI and CISA?', 'notify'],
            [110, 'Comms', 'Local TV at the ED entrance', 'What do patients and families hear?', 'communicate'],
            [140, 'Epic technical', 'Clean rebuild: 52 h to full restore', 'Accept, or bring up read-only first?', 'recover'],
          ]),
          lessons: [
            ['Diversion criteria for a cyber outage were not defined', 'Add cyber-triggered diversion criteria to the EOP', 'decide'],
            ['Downtime BCA PCs had stale reports at two community hospitals', 'Verify downtime BCA report refresh daily at every site', 'recover'],
            ['Patient communications were drafted from scratch', 'Pre-approve patient and community statements for extended downtime', 'communicate'],
          ],
        },
        {
          id: 'HC-TE-02', title: 'SOC/IR: help-desk MFA reset fraud to Epic access', kind: 'technical', tenantId: 'mrmc', difficulty: 'Intermediate', durationMin: 150,
          summary: 'A caller impersonating a surgeon gets an MFA reset, then uses Epic Hyperspace and Citrix to browse VIP patient records.',
          objectives: ['Detect MFA reset abuse and unusual Epic access', 'Exercise FairWarning and Entra ID correlation', 'Decide on breach assessment under HIPAA'],
          audience: `${p.socLead.name}, ${p.staff[5]?.name ?? 'service desk supervisor'}, privacy office, ${p.staff[3]?.name ?? 'Epic technical lead'}`, controls: ['CTL-HD-02', 'CTL-IAM-01', 'CTL-LOG-07'], frameworks: ['HIPAA', 'HPH CPGs'], drivers: ['cpg', 'hipaa'],
          injects: inj([
            [0, 'Service desk', 'Urgent reset request: surgeon "in theatre"', 'Does the callback procedure hold?', 'detect'],
            [20, 'Entra ID', 'New device registered; sign-in from a hosting ASN', 'Auto-revoke or wait for triage?', 'detect'],
            [40, 'FairWarning', 'VIP record access by the same user', 'Is this a reportable breach?', 'notify'],
            [70, 'Privacy', '312 records viewed', 'Four-factor risk assessment: who signs?', 'decide'],
          ]),
          lessons: [
            ['Callback procedure skipped for "urgent clinical" requests', 'Remove the clinical-urgency exception from the reset procedure', 'detect'],
          ],
        },
        {
          id: 'HC-OT-03', title: 'Clinical engineering: infusion pump fleet compromise', kind: 'ot', tenantId: 'community', difficulty: 'Advanced', durationMin: 120,
          summary: 'Claroty flags anomalous traffic from 140 legacy infusion pumps on the flat clinical VLAN at the community hospitals. Patient safety drives every decision.',
          objectives: ['Make patient-safety-first isolation decisions', 'Coordinate biomed, nursing and the manufacturer', 'Practise FDA MedWatch and manufacturer reporting'],
          audience: `${p.otLead?.name ?? 'Clinical engineering'}, ${p.staff[2]?.name ?? 'CNO'}, ${p.staff[4]?.name ?? 'biomed engineer'}, ${p.socLead.name}`, controls: ['CTL-MD-03', 'CTL-MD-04'], frameworks: ['FDA 524B', 'HPH CPGs'], drivers: ['tjc', 'cpg'],
          injects: inj([
            [0, 'HexaOT', 'Pumps beaconing to an external IP', 'Are infusions at risk right now?', 'detect'],
            [15, 'Nursing', '62 pumps in use on patients', 'Isolate the VLAN, or swap pumps first?', 'decide'],
            [40, 'Manufacturer', 'Known vulnerability, patch in 10 days', 'Take the fleet out of service?', 'recover'],
            [70, 'Regulatory', 'Possible device malfunction report', 'Report to FDA and the manufacturer?', 'notify'],
          ]),
          lessons: [
            ['No spare pump pool for a fleet-wide swap', 'Agree an emergency pump loan with the manufacturer', 'recover'],
            ['Clinical VLAN segmentation still flat at community hospitals', 'Fund segmentation of 1,140 legacy devices', 'detect'],
          ],
        },
        {
          id: 'HC-SC-04', title: 'Third party: clearinghouse outage halts claims', kind: 'supply', tenantId: 'all', difficulty: 'Intermediate', durationMin: 120,
          summary: 'The claims clearinghouse suffers ransomware and disconnects all customers. Claims, eligibility checks and prior authorisations stop for weeks.',
          objectives: ['Quantify cash-flow impact and options', 'Decide on disconnection and alternative clearinghouse', 'Coordinate BAA obligations'],
          audience: `${p.staff[1]?.name ?? 'CFO'}, ${p.staff[6]?.name ?? 'revenue cycle'}, ${p.grcLead.name}, vendor management`, controls: ['CTL-TPR-10'], frameworks: ['HIPAA', 'HITRUST'], drivers: ['hitrust', 'hipaa'],
          injects: inj([
            [0, 'Revenue cycle', 'Clearinghouse connections down', 'Disconnect our interfaces too?', 'detect'],
            [30, 'Finance', '$46M of claims per week at risk', 'Draw on the credit line?', 'decide'],
            [60, 'Vendor management', 'Alternative clearinghouse needs 3 weeks', 'Start onboarding now?', 'recover'],
            [90, 'Privacy', 'BA may have exposed PHI', 'Whose breach notification is it?', 'notify'],
          ]),
          lessons: [
            ['No pre-contracted secondary clearinghouse', 'Pre-contract a secondary clearinghouse with tested connectivity', 'recover'],
          ],
        },
        {
          id: 'HC-RW-05', title: 'Ransomware with ED diversion at the Medical Center', kind: 'ransomware', tenantId: 'mrmc', difficulty: 'Advanced', durationMin: 180,
          summary: 'Encryption hits PACS and lab interfaces at the Level I trauma centre. Imaging is unavailable and the trauma team considers diversion.',
          objectives: ['Contain without stopping critical care', 'Decide on trauma diversion with the EMS region', 'Restore PACS from immutable copies'],
          audience: `${p.ciso.name}, ${p.staff[9]?.name ?? 'PACS admin'}, ED leadership, ${p.otLead?.name ?? 'clinical engineering'}, HexaShield DFIR`, controls: ['CTL-BKP-06', 'CTL-EDR-05', 'CTL-PRV-12'], frameworks: ['HIPAA', 'HPH CPGs'], drivers: ['cms', 'tjc'],
          injects: inj([
            [0, 'Falcon', 'Encryption on PACS archive servers', 'Isolate imaging now?', 'detect'],
            [15, 'Radiology', 'CT reads impossible; stroke alert inbound', 'Divert stroke and trauma?', 'decide'],
            [50, 'Cohesity', 'Immutable PACS copies verified', 'Restore order: current studies first?', 'recover'],
            [90, 'Legal', 'Possible PHI exfiltration', 'Start the 60-day HIPAA clock?', 'notify'],
            [130, 'Comms', 'EMS region asks for ETA', 'What do you commit to?', 'communicate'],
          ]),
          lessons: [
            ['Diversion took 38 min to agree with the EMS region', 'Pre-agree cyber diversion protocol with the regional EMS', 'decide'],
          ],
        },
        {
          id: 'HC-RD-06', title: 'HIPAA breach notification drill (500+ individuals)', kind: 'regulator', tenantId: 'clinics', difficulty: 'Foundation', durationMin: 90,
          summary: 'A compromised mailbox at the physician network exposed records for 8,400 patients. OCR, media and state notifications all apply.',
          objectives: ['Complete the four-factor risk assessment', 'Prepare OCR, individual, media and state AG notices', 'Track the 60-day clock'],
          audience: `${p.grcLead.name}, privacy counsel, clinic operations, comms`, controls: ['CTL-EML-09', 'CTL-LOG-07'], frameworks: ['HIPAA', 'PCI DSS'], drivers: ['hipaa', 'cpg'],
          injects: inj([
            [0, 'Mimecast', 'Inbox rule forwarding to external address', 'When did discovery happen legally?', 'detect'],
            [25, 'Privacy', '8,400 patients across 3 states', 'Media notice required? Which state AGs?', 'notify'],
            [50, 'Comms', 'Patients start calling clinics', 'Call centre script ready?', 'communicate'],
          ]),
          lessons: [
            ['Discovery date was disputed internally', 'Define discovery date criteria in the breach procedure', 'notify'],
          ],
        },
        {
          id: 'HC-OT-07', title: "Children's hospital: PACS and lab interface outage", kind: 'ot', tenantId: 'kids', difficulty: 'Intermediate', durationMin: 120,
          summary: "A failed interface engine update, possibly malicious, stops lab results and imaging flowing to Epic at the children's hospital.",
          objectives: ['Run paper results workflows', 'Separate fault from attack', 'Validate restore of interface engine'],
          audience: `Children's hospital incident command, lab director, ${p.staff[9]?.name ?? 'PACS admin'}, ${p.socLead.name}`, controls: ['CTL-BKP-06'], frameworks: ['HIPAA', 'NIST CSF'], drivers: ['cms', 'tjc'],
          injects: inj([
            [0, 'Lab', 'Results not crossing to Epic', 'Downtime procedures for results?', 'detect'],
            [20, 'HexaSOC', 'Unsigned change to interface engine config', 'Treat as a cyber incident?', 'decide'],
            [45, 'Integration', 'Rollback ready in 40 min', 'Roll back or rebuild?', 'recover'],
          ]),
          lessons: [
            ['Interface engine changes were not monitored', 'Monitor interface engine config changes in Sentinel', 'detect'],
          ],
        },
      ];
    case 'automotive':
    default:
      return [
        {
          id: 'AU-TT-01', title: 'Board tabletop: line stop at Ingolstadt with JIS cascade', kind: 'tabletop', tenantId: 'all', difficulty: 'Advanced', durationMin: 150,
          summary: 'MES encryption stops body and assembly at Ingolstadt. Each hour costs €2.3M; JIS suppliers queue trucks and dealers face delivery delays.',
          objectives: ['Test Vorstand decisions on shutdown and restart', 'Coordinate supplier and dealer messaging', 'Rehearse NIS2 and insurer notifications'],
          audience: `${p.board.name}, ${p.staff[0]?.name ?? 'CFO'}, ${p.ciso.name}, plant management, purchasing, communications`, controls: ['CTL-BKP-09', 'CTL-OT-04'], frameworks: ['NIS2', 'IEC 62443'], drivers: ['nis2', 'iec'],
          injects: inj([
            [0, 'Plant Ingolstadt', 'MES unavailable; line 3 stopped', 'Is this cyber? Who decides on a plant-wide stop?', 'detect'],
            [20, 'HexaSOC', 'Encryption on MES and SAP application servers', 'Stop all lines or run line 1 on local control?', 'decide'],
            [50, 'Purchasing', 'JIS seat supplier: 40 trucks queued', 'Tell suppliers to stop deliveries?', 'communicate'],
            [80, 'Legal', 'NIS2 early warning to BSI due in 24 h', 'File now with partial facts?', 'notify'],
            [120, 'IT/OT', 'Clean MES rebuild: 30 h', 'Restart with manual tracking or wait?', 'recover'],
          ]),
          lessons: [
            ['Plant-wide stop criteria for cyber events not defined', 'Define cyber stop and restart criteria per plant', 'decide'],
            ['Supplier messaging relied on personal phone lists', 'Integrate supplier crisis contacts into the HexaView comms log', 'communicate'],
          ],
        },
        {
          id: 'AU-TE-02', title: 'VSOC/IR: vehicle API abuse and remote unlock attempts', kind: 'technical', tenantId: 'connected', difficulty: 'Advanced', durationMin: 180,
          summary: 'Upstream vSOC sees a surge of remote-unlock commands from a leaked API token against 12,000 vehicles. Some succeed.',
          objectives: ['Correlate vehicle SOC and backend signals', 'Revoke tokens without breaking legitimate app use', 'Exercise R155 monitoring and reporting obligations'],
          audience: `${p.staff[2]?.name ?? 'Head of Vehicle Cybersecurity'}, ${p.socLead.name}, connected-car backend, Upstream VSOC`, controls: ['CTL-VSOC-02', 'CTL-API-11'], frameworks: ['UNECE R155', 'ISO/SAE 21434'], drivers: ['r155', 'iso21434'],
          injects: inj([
            [0, 'Upstream vSOC', '3,200 remote-unlock commands in 6 min', 'Legit app traffic or abuse?', 'detect'],
            [15, 'Backend', 'Requests share one OAuth client token', 'Revoke the token fleet-wide?', 'decide'],
            [40, 'Customer care', 'Owners report doors unlocking', 'Push a customer notice?', 'communicate'],
            [70, 'CSMS', 'Possible new threat for vehicle type approval', 'Report to KBA under R155?', 'notify'],
            [120, 'Backend', 'Fix: per-vehicle token binding', 'Deploy as an emergency change?', 'recover'],
          ]),
          lessons: [
            ['Token revocation required a backend release', 'Add a kill switch for OAuth clients in the vehicle backend', 'recover'],
          ],
        },
        {
          id: 'AU-OT-03', title: 'Plant: robot cell vendor remote access abuse at Puebla', kind: 'ot', tenantId: 'puebla', difficulty: 'Intermediate', durationMin: 120,
          summary: 'A robot integrator session via BeyondTrust connects outside the change window and pushes a programme to welding robots on the body line.',
          objectives: ['Detect out-of-window vendor sessions', 'Reach safe state on the body line', 'Exercise vendor access revocation and evidence capture'],
          audience: `${p.otLead?.name ?? 'OT security'}, ${p.staff[5]?.name ?? 'MES engineer'}, plant maintenance, integrator`, controls: ['CTL-OT-03', 'CTL-OT-05'], frameworks: ['IEC 62443', 'TISAX'], drivers: ['iec', 'tisax'],
          injects: inj([
            [0, 'BeyondTrust', 'Integrator session at 02:14 outside window', 'Terminate the session?', 'detect'],
            [10, 'Armis', 'Programme download to 6 welding robots', 'Stop the body line?', 'decide'],
            [35, 'Maintenance', 'Robots show modified weld paths', 'Quarantine bodies-in-white produced since 02:14?', 'recover'],
            [70, 'Quality', 'Possible safety-relevant weld defects', 'Recall risk: who is informed?', 'communicate'],
          ]),
          lessons: [
            ['Out-of-window vendor sessions were not blocked by policy', 'Enforce change-window policy in BeyondTrust for all integrators', 'detect'],
          ],
        },
        {
          id: 'AU-SC-04', title: 'Supply chain: tier-1 supplier ransomware stops seat deliveries', kind: 'supply', tenantId: 'all', difficulty: 'Intermediate', durationMin: 120,
          summary: 'A JIS seat supplier is hit by ransomware. Their EDI link to Vireo shows suspicious traffic and deliveries stop within hours.',
          objectives: ['Decide on EDI disconnection', 'Assess spread risk from supplier connections', 'Coordinate production replanning'],
          audience: `${p.grcLead.name}, ${p.staff[7]?.name ?? 'supplier quality'}, purchasing, logistics, ${p.socLead.name}`, controls: ['CTL-SUP-10'], frameworks: ['TISAX', 'NIS2'], drivers: ['tisax', 'nis2'],
          injects: inj([
            [0, 'Supplier', 'Supplier reports ransomware, ERP down', 'Disconnect EDI and VPN now?', 'detect'],
            [25, 'HexaSOC', 'Scanning from the supplier VPN range', 'Block and hunt internally?', 'decide'],
            [60, 'Logistics', 'Seats for 4 h of production left', 'Replan the line or slow it?', 'recover'],
            [90, 'Purchasing', 'Supplier asks to reconnect tomorrow', 'What evidence before reconnecting?', 'communicate'],
          ]),
          lessons: [
            ['No reconnection criteria for compromised suppliers', 'Publish supplier reconnection criteria (TISAX label, clean bill)', 'recover'],
          ],
        },
        {
          id: 'AU-RW-05', title: 'Ransomware on MES and SAP at Győr', kind: 'ransomware', tenantId: 'gyor', difficulty: 'Advanced', durationMin: 180,
          summary: 'E-drive production at Győr stops after encryption of MES and the local SAP application tier. Rubrik anomaly detection flagged the change 40 minutes earlier.',
          objectives: ['Act on early backup anomaly signals', 'Restore MES and PLC projects from immutable copies', 'Coordinate with NCSC-HU'],
          audience: `${p.staff[3]?.name ?? 'Plant IT Manager, Győr'}, ${p.otLead?.name ?? 'OT security'}, ${p.ciso.name}, HexaShield DFIR`, controls: ['CTL-BKP-09', 'CTL-EDR-08'], frameworks: ['NIS2', 'IEC 62443'], drivers: ['nis2', 'iec'],
          injects: inj([
            [0, 'Rubrik', 'Anomalous change rate on MES backups', 'Escalate a backup anomaly to SOC?', 'detect'],
            [40, 'Defender XDR', 'Encryption on GYR-MES-APP01', 'Isolate the plant IT network?', 'decide'],
            [80, 'Rubrik', 'Clean snapshot 3 h old', 'Accept 3 h loss of traceability data?', 'recover'],
            [120, 'Legal', 'NCSC-HU early warning due', 'Who files in Hungary?', 'notify'],
          ]),
          lessons: [
            ['Backup anomaly alert sat unread for 40 min', 'Route Rubrik anomaly alerts into HexaSOC as high severity', 'detect'],
          ],
        },
        {
          id: 'AU-RD-06', title: 'NIS2 and R155 notification drill (BSI, KBA, GDPR)', kind: 'regulator', tenantId: 'ingolstadt', difficulty: 'Foundation', durationMin: 90,
          summary: 'An incident affecting plant operations and connected services triggers NIS2 (BSI), R155 monitoring obligations (KBA) and possibly GDPR.',
          objectives: ['Sequence three notifications with consistent facts', 'Rehearse the BSI portal submission', 'Decide on R155 reporting relevance'],
          audience: `${p.grcLead.name}, ${p.staff[2]?.name ?? 'CSMS lead'}, data protection officer, legal`, controls: ['CTL-VSOC-02'], frameworks: ['NIS2', 'UNECE R155'], drivers: ['nis2', 'r155'],
          injects: inj([
            [0, 'HexaSOC', 'Significant incident at Ingolstadt', 'Early warning to BSI within 24 h?', 'notify'],
            [25, 'CSMS', 'Same actor probes the vehicle backend', 'Is this R155-relevant for type approval?', 'notify'],
            [50, 'DPO', 'Employee data possibly accessed', 'GDPR 72 h clock running?', 'notify'],
            [75, 'Comms', 'Trade press asks about plant stoppage', 'Statement aligned with filings?', 'communicate'],
          ]),
          lessons: [
            ['BSI portal access token had expired', 'Test BSI portal access quarterly', 'notify'],
          ],
        },
        {
          id: 'AU-TE-07', title: 'OTA rollback drill: malicious package after signing', kind: 'technical', tenantId: 'connected', difficulty: 'Advanced', durationMin: 150,
          summary: 'A package signed in the HSM ceremony is found to contain an unapproved binary. 180,000 vehicles have the campaign queued.',
          objectives: ['Halt an OTA campaign within minutes', 'Exercise rollback and RXSWIN records', 'Investigate the signing ceremony'],
          audience: `${p.staff[6]?.name ?? 'OTA release manager'}, ${p.staff[2]?.name ?? 'CSMS lead'}, HSM custodians, ${p.socLead.name}`, controls: ['CTL-OTA-01'], frameworks: ['UNECE R156', 'ISO/SAE 21434'], drivers: ['r156', 'iso21434'],
          injects: inj([
            [0, 'GitHub Advanced Security', 'SBOM mismatch on released package', 'Halt the campaign?', 'detect'],
            [10, 'OTA backend', '14,200 vehicles already installed', 'Roll back those vehicles?', 'decide'],
            [40, 'HexaCustody', 'Package lineage shows an extra build step', 'Who touched it?', 'detect'],
            [90, 'Type approval', 'RXSWIN changed for 2 vehicle types', 'Inform KBA?', 'notify'],
          ]),
          lessons: [
            ['Campaign halt required two teams', 'Single-button campaign halt for the OTA release manager', 'recover'],
          ],
        },
      ];
  }
}

export function scenarios(c: CustomerProfile): Scenario[] {
  return scenarioSeeds(c);
}
export function drivers(c: CustomerProfile): Driver[] {
  return DRIVERS[c.id];
}

/* =====================================================================
   Regulatory and contractual clocks for the live run (sim minutes)
   ===================================================================== */
const CLOCKS: Record<CustomerId, RegClock[]> = {
  maritime: [
    { name: 'PFSO / port authority', body: 'ISPS security incident: report without delay', dueMin: 120 },
    { name: 'NACSA initial (NCII)', body: 'Cyber Security Act 2024: 6 h', dueMin: 360 },
    { name: 'NIS2 early warning', body: 'CSIRT NL / CCB Belgium: 24 h', dueMin: 1440 },
    { name: 'Insurer notice', body: 'Policy condition: 48 h via broker', dueMin: 2880 },
  ],
  finserv: [
    { name: 'DORA initial report', body: 'CSSF / FCA: 4 h from classification', dueMin: 240 },
    { name: 'PCI card brands', body: 'Acquirer notice: 24 h', dueMin: 1440 },
    { name: 'NYDFS 500.17', body: 'Cybersecurity event: 72 h', dueMin: 4320 },
    { name: 'DORA intermediate', body: '72 h after initial', dueMin: 4560 },
  ],
  media: [
    { name: 'League / rights-holder', body: 'On-air incident: 15 min (contract)', dueMin: 15 },
    { name: 'Studio partner', body: 'Content security incident: 24 h (contract)', dueMin: 1440 },
    { name: 'PCI card brands', body: 'Acquirer notice: 24 h', dueMin: 1440 },
    { name: 'GDPR / UK GDPR', body: 'Supervisory authority: 72 h', dueMin: 4320 },
  ],
  healthcare: [
    { name: 'HICS activation', body: 'Hospital incident command: 30 min', dueMin: 30 },
    { name: 'EMS region / diversion', body: 'Regional notification: 60 min', dueMin: 60 },
    { name: 'Cyber insurer', body: 'Policy condition: 48 h', dueMin: 2880 },
    { name: 'CISA (CIRCIA)', body: 'Covered incident: 72 h', dueMin: 4320 },
  ],
  automotive: [
    { name: 'NIS2 early warning', body: 'BSI / NCSC-HU: 24 h', dueMin: 1440 },
    { name: 'OEM customer / dealers', body: 'Delivery impact: 24 h', dueMin: 1440 },
    { name: 'GDPR', body: 'BayLDA: 72 h if personal data', dueMin: 4320 },
    { name: 'KBA (R155)', body: 'Monitoring report: without undue delay', dueMin: 4320 },
  ],
};
export function regClocks(c: CustomerProfile): RegClock[] {
  return CLOCKS[c.id];
}

/* =====================================================================
   The programme: this year's calendar, statuses, scores and actions
   ===================================================================== */
type PlanSeed = [scenarioId: string, month: number, day: number, overdue?: boolean];
const PLAN: Record<CustomerId, PlanSeed[]> = {
  maritime: [['MX-RD-06', 0, 22], ['MX-OT-07', 1, 18], ['MX-TE-02', 3, 9], ['MX-SC-04', 4, 27], ['MX-OT-03', 6, 15], ['MX-TT-01', 8, 4], ['MX-OT-07', 8, 24, true], ['MX-RW-05', 9, 21], ['MX-RD-06', 10, 12], ['MX-TT-01', 11, 2]],
  finserv: [['FS-RD-06', 0, 28], ['FS-TE-02', 1, 24], ['FS-TT-01', 2, 19], ['FS-SC-04', 4, 13], ['FS-OT-03', 5, 17], ['FS-TE-07', 7, 26], ['FS-RW-05', 8, 16, true], ['FS-TT-01', 9, 14], ['FS-RD-06', 10, 4], ['FS-SC-04', 11, 9]],
  media: [['MD-RD-06', 1, 3], ['MD-TE-02', 2, 12], ['MD-OT-03', 4, 6], ['MD-SC-04', 5, 23], ['MD-TT-01', 7, 19], ['MD-RW-05', 8, 10, true], ['MD-TT-07', 9, 16], ['MD-OT-03', 10, 20], ['MD-RD-06', 11, 8]],
  healthcare: [['HC-RD-06', 0, 20], ['HC-TT-01', 2, 10], ['HC-TE-02', 3, 21], ['HC-OT-07', 4, 19], ['HC-SC-04', 6, 8], ['HC-OT-03', 7, 27], ['HC-RW-05', 8, 22, true], ['HC-TT-01', 9, 20], ['HC-RD-06', 10, 17], ['HC-OT-03', 11, 4]],
  automotive: [['AU-RD-06', 0, 27], ['AU-TE-07', 1, 25], ['AU-OT-03', 3, 15], ['AU-TT-01', 4, 21], ['AU-SC-04', 6, 1], ['AU-TE-02', 7, 12], ['AU-RW-05', 8, 9, true], ['AU-OT-03', 9, 22], ['AU-RD-06', 10, 10], ['AU-TT-01', 11, 3]],
};

const DAY = 86_400_000;

/** Pool of people who take part in exercises (customer staff plus HexaShield). */
export function exercisePeople(c: CustomerProfile): { name: string; role: string; org: string }[] {
  const p = c.people;
  const own = [p.ciso, p.socLead, p.grcLead, ...(p.otLead ? [p.otLead] : []), p.board, ...p.staff.slice(0, 6)].map((x) => ({ name: x.name, role: x.role, org: c.short }));
  return [...own, { name: 'Nadia Farouk', role: 'HexaShield IR duty manager', org: 'HexaShield' }, { name: 'Callum Reid', role: 'HexaShield exercise facilitator', org: 'HexaShield' }];
}

export function programme(c: CustomerProfile, tenantId = 'all'): Exercise[] {
  const scs = scenarios(c);
  const byId = new Map(scs.map((s) => [s.id, s]));
  const year = NOW.getFullYear();
  const ri = resilienceIndex(c).value;
  const people = exercisePeople(c);
  const owners = [c.people.ciso.name, c.people.socLead.name, c.people.grcLead.name, c.people.otLead?.name ?? c.people.admin.name, c.people.admin.name, ...c.people.staff.slice(0, 4).map((s) => s.name)];
  const out: Exercise[] = PLAN[c.id].map(([sid, m, d, overdue], idx) => {
    const s = byId.get(sid) ?? scs[0];
    const r = rng(`ex-${c.id}-${sid}-${idx}`);
    const date = new Date(year, m, d, 9 + (idx % 3), 30);
    const dayOffset = Math.round((date.getTime() - NOW.getTime()) / DAY);
    const status: ExStatus = dayOffset < 0 ? (overdue ? 'overdue' : 'completed') : dayOffset <= 45 ? 'scheduled' : 'planned';
    const participants = r.pickN(people, r.int(6, Math.min(10, people.length))).map((x) => x.name);
    const invited = participants.length + r.int(1, 5);
    const attended = status === 'completed' ? invited - r.int(0, 3) : 0;
    const exId = `EX-${String(year).slice(2)}${String(idx + 1).padStart(2, '0')}`;
    let scores: Record<Cap, number> | undefined;
    let overall: number | undefined;
    const actions: ExAction[] = [];
    if (status === 'completed') {
      const progress = m / 11; // later in the year, better scores
      const base = ri - 12 + progress * 10;
      const kindAdj: Record<Cap, number> = { detect: s.kind === 'technical' ? 4 : 0, decide: s.kind === 'tabletop' ? -3 : 1, communicate: s.kind === 'tabletop' ? -2 : -5, recover: s.kind === 'ransomware' ? -6 : 0, notify: s.kind === 'regulator' ? 6 : -4 };
      scores = Object.fromEntries(CAPS.map((k) => [k.id, Math.max(38, Math.min(97, Math.round(base + kindAdj[k.id] + r.int(-8, 8))))])) as Record<Cap, number>;
      overall = Math.round(CAPS.reduce((a, k) => a + (scores as Record<Cap, number>)[k.id], 0) / CAPS.length);
      s.lessons.forEach(([lesson, title, cap], i) => {
        const dueDays = dayOffset + r.int(30, 75);
        const st: ActionStatus = dueDays < -20 ? (r.chance(0.82) ? 'done' : 'in_progress') : dueDays < 0 ? (r.chance(0.5) ? 'done' : 'open') : r.pick<ActionStatus>(['open', 'in_progress', 'in_progress', 'done']);
        actions.push({ id: `${exId}-A${i + 1}`, exerciseId: exId, title, lesson, owner: owners[(idx + i) % owners.length], cap, dueDays, status: st, pushed: dayOffset < -30 || st === 'done' });
      });
    }
    return {
      id: exId, scenarioId: s.id, title: s.title, kind: s.kind, quarter: (Math.floor(m / 3) + 1) as 1 | 2 | 3 | 4, date, dayOffset, status,
      tenantId: s.tenantId, facilitator: r.chance(0.7) ? 'Callum Reid (HexaShield)' : c.people.grcLead.name, participants, invited, attended,
      durationMin: s.durationMin, drivers: s.drivers, scores, overall, lessons: status === 'completed' ? s.lessons.map((l) => l[0]) : [], actions,
      evidenceId: `EV-EX-${r.int(1000, 9999)}`, pushed: status === 'completed' && dayOffset < -21,
    };
  });
  return tenantId === 'all' ? out : out.filter((e) => e.tenantId === 'all' || e.tenantId === tenantId);
}

/** Exercises the programme needs this year (sum of distinct driver requirements, at least the plan size minus slack). */
export function requiredThisYear(c: CustomerProfile): number {
  return Math.max(PLAN[c.id].length - 1, Math.ceil(DRIVERS[c.id].reduce((s, d) => s + d.perYear, 0) * 0.85));
}

export function driverProgress(ds: Driver[], exs: Exercise[]): { d: Driver; done: number; planned: number; exercises: Exercise[] }[] {
  return ds.map((d) => {
    const list = exs.filter((e) => e.drivers.includes(d.id));
    return { d, done: list.filter((e) => e.status === 'completed').length, planned: list.filter((e) => e.status === 'scheduled' || e.status === 'planned').length, exercises: list };
  });
}

export function quarterLabel(q: number): string {
  return `Q${q} ${NOW.getFullYear()}`;
}
