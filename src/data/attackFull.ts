// Complete MITRE ATT&CK Enterprise matrix (parent techniques), 14 tactics in
// kill-chain order. A technique that belongs to several tactics appears under
// each of them, as in the MITRE navigator. Real IDs and names (ATT&CK v16).

export interface FullTactic {
  id: string;
  name: string;
  short: string;
  /** Column accent (original HexaMatrix palette). */
  color: string;
}

export const FULL_TACTICS: FullTactic[] = [
  { id: 'TA0043', name: 'Reconnaissance', short: 'Recon', color: '#38bdf8' },
  { id: 'TA0042', name: 'Resource Development', short: 'Resource dev', color: '#34d399' },
  { id: 'TA0001', name: 'Initial Access', short: 'Initial access', color: '#a78bfa' },
  { id: 'TA0002', name: 'Execution', short: 'Execution', color: '#2dd4bf' },
  { id: 'TA0003', name: 'Persistence', short: 'Persistence', color: '#fbbf24' },
  { id: 'TA0004', name: 'Privilege Escalation', short: 'Priv. esc.', color: '#f472b6' },
  { id: 'TA0005', name: 'Defense Evasion', short: 'Defense evasion', color: '#fb923c' },
  { id: 'TA0006', name: 'Credential Access', short: 'Cred. access', color: '#22d3ee' },
  { id: 'TA0007', name: 'Discovery', short: 'Discovery', color: '#a3e635' },
  { id: 'TA0008', name: 'Lateral Movement', short: 'Lateral mvmt', color: '#818cf8' },
  { id: 'TA0009', name: 'Collection', short: 'Collection', color: '#e879f9' },
  { id: 'TA0011', name: 'Command and Control', short: 'C2', color: '#4ade80' },
  { id: 'TA0010', name: 'Exfiltration', short: 'Exfiltration', color: '#60a5fa' },
  { id: 'TA0040', name: 'Impact', short: 'Impact', color: '#f87171' },
];

export const TACTIC_COLOR: Record<string, string> = Object.fromEntries(FULL_TACTICS.map((t) => [t.name, t.color]));

export interface FullTechnique {
  id: string;
  name: string;
  tactics: string[];
}

// [id, name, tactic ids...]
type Row = [string, string, ...string[]];
const R = 'TA0043', RD = 'TA0042', IA = 'TA0001', EX = 'TA0002', PE = 'TA0003', PR = 'TA0004', DE = 'TA0005', CA = 'TA0006', DI = 'TA0007', LM = 'TA0008', CO = 'TA0009', C2 = 'TA0011', EF = 'TA0010', IM = 'TA0040';

const ROWS: Row[] = [
  // Reconnaissance
  ['T1595', 'Active Scanning', R],
  ['T1592', 'Gather Victim Host Information', R],
  ['T1589', 'Gather Victim Identity Information', R],
  ['T1590', 'Gather Victim Network Information', R],
  ['T1591', 'Gather Victim Org Information', R],
  ['T1598', 'Phishing for Information', R],
  ['T1597', 'Search Closed Sources', R],
  ['T1596', 'Search Open Technical Databases', R],
  ['T1593', 'Search Open Websites/Domains', R],
  ['T1594', 'Search Victim-Owned Websites', R],
  // Resource Development
  ['T1650', 'Acquire Access', RD],
  ['T1583', 'Acquire Infrastructure', RD],
  ['T1586', 'Compromise Accounts', RD],
  ['T1584', 'Compromise Infrastructure', RD],
  ['T1587', 'Develop Capabilities', RD],
  ['T1585', 'Establish Accounts', RD],
  ['T1588', 'Obtain Capabilities', RD],
  ['T1608', 'Stage Capabilities', RD],
  // Initial Access
  ['T1659', 'Content Injection', IA, C2],
  ['T1189', 'Drive-by Compromise', IA],
  ['T1190', 'Exploit Public-Facing Application', IA],
  ['T1133', 'External Remote Services', IA, PE],
  ['T1200', 'Hardware Additions', IA],
  ['T1566', 'Phishing', IA],
  ['T1091', 'Replication Through Removable Media', IA, LM],
  ['T1195', 'Supply Chain Compromise', IA],
  ['T1199', 'Trusted Relationship', IA],
  ['T1078', 'Valid Accounts', IA, PE, PR, DE],
  // Execution
  ['T1651', 'Cloud Administration Command', EX],
  ['T1059', 'Command and Scripting Interpreter', EX],
  ['T1609', 'Container Administration Command', EX],
  ['T1610', 'Deploy Container', EX, DE],
  ['T1203', 'Exploitation for Client Execution', EX],
  ['T1559', 'Inter-Process Communication', EX],
  ['T1106', 'Native API', EX],
  ['T1053', 'Scheduled Task/Job', EX, PE, PR],
  ['T1648', 'Serverless Execution', EX],
  ['T1129', 'Shared Modules', EX],
  ['T1072', 'Software Deployment Tools', EX, LM],
  ['T1569', 'System Services', EX],
  ['T1204', 'User Execution', EX],
  ['T1047', 'Windows Management Instrumentation', EX],
  // Persistence
  ['T1098', 'Account Manipulation', PE, PR],
  ['T1197', 'BITS Jobs', PE, DE],
  ['T1547', 'Boot or Logon Autostart Execution', PE, PR],
  ['T1037', 'Boot or Logon Initialization Scripts', PE, PR],
  ['T1176', 'Browser Extensions', PE],
  ['T1554', 'Compromise Host Software Binary', PE],
  ['T1136', 'Create Account', PE],
  ['T1543', 'Create or Modify System Process', PE, PR],
  ['T1546', 'Event Triggered Execution', PE, PR],
  ['T1574', 'Hijack Execution Flow', PE, PR, DE],
  ['T1525', 'Implant Internal Image', PE],
  ['T1556', 'Modify Authentication Process', PE, DE, CA],
  ['T1137', 'Office Application Startup', PE],
  ['T1653', 'Power Settings', PE],
  ['T1542', 'Pre-OS Boot', PE, DE],
  ['T1505', 'Server Software Component', PE],
  ['T1205', 'Traffic Signaling', PE, DE, C2],
  // Privilege Escalation
  ['T1548', 'Abuse Elevation Control Mechanism', PR, DE],
  ['T1134', 'Access Token Manipulation', PR, DE],
  ['T1484', 'Domain or Tenant Policy Modification', PR, DE],
  ['T1611', 'Escape to Host', PR],
  ['T1068', 'Exploitation for Privilege Escalation', PR],
  ['T1055', 'Process Injection', PR, DE],
  // Defense Evasion
  ['T1612', 'Build Image on Host', DE],
  ['T1622', 'Debugger Evasion', DE, DI],
  ['T1140', 'Deobfuscate/Decode Files or Information', DE],
  ['T1006', 'Direct Volume Access', DE],
  ['T1480', 'Execution Guardrails', DE],
  ['T1211', 'Exploitation for Defense Evasion', DE],
  ['T1222', 'File and Directory Permissions Modification', DE],
  ['T1564', 'Hide Artifacts', DE],
  ['T1562', 'Impair Defenses', DE],
  ['T1656', 'Impersonation', DE],
  ['T1070', 'Indicator Removal', DE],
  ['T1202', 'Indirect Command Execution', DE],
  ['T1036', 'Masquerading', DE],
  ['T1578', 'Modify Cloud Compute Infrastructure', DE],
  ['T1112', 'Modify Registry', DE],
  ['T1601', 'Modify System Image', DE],
  ['T1599', 'Network Boundary Bridging', DE],
  ['T1027', 'Obfuscated Files or Information', DE],
  ['T1647', 'Plist File Modification', DE],
  ['T1620', 'Reflective Code Loading', DE],
  ['T1207', 'Rogue Domain Controller', DE],
  ['T1014', 'Rootkit', DE],
  ['T1553', 'Subvert Trust Controls', DE],
  ['T1218', 'System Binary Proxy Execution', DE],
  ['T1216', 'System Script Proxy Execution', DE],
  ['T1221', 'Template Injection', DE],
  ['T1127', 'Trusted Developer Utilities Proxy Execution', DE],
  ['T1535', 'Unused/Unsupported Cloud Regions', DE],
  ['T1550', 'Use Alternate Authentication Material', DE, LM],
  ['T1497', 'Virtualization/Sandbox Evasion', DE, DI],
  ['T1600', 'Weaken Encryption', DE],
  ['T1220', 'XSL Script Processing', DE],
  // Credential Access
  ['T1557', 'Adversary-in-the-Middle', CA, CO],
  ['T1110', 'Brute Force', CA],
  ['T1555', 'Credentials from Password Stores', CA],
  ['T1212', 'Exploitation for Credential Access', CA],
  ['T1187', 'Forced Authentication', CA],
  ['T1606', 'Forge Web Credentials', CA],
  ['T1056', 'Input Capture', CA, CO],
  ['T1111', 'Multi-Factor Authentication Interception', CA],
  ['T1621', 'Multi-Factor Authentication Request Generation', CA],
  ['T1040', 'Network Sniffing', CA, DI],
  ['T1003', 'OS Credential Dumping', CA],
  ['T1528', 'Steal Application Access Token', CA],
  ['T1649', 'Steal or Forge Authentication Certificates', CA],
  ['T1558', 'Steal or Forge Kerberos Tickets', CA],
  ['T1539', 'Steal Web Session Cookie', CA],
  ['T1552', 'Unsecured Credentials', CA],
  // Discovery
  ['T1087', 'Account Discovery', DI],
  ['T1010', 'Application Window Discovery', DI],
  ['T1217', 'Browser Information Discovery', DI],
  ['T1580', 'Cloud Infrastructure Discovery', DI],
  ['T1538', 'Cloud Service Dashboard', DI],
  ['T1526', 'Cloud Service Discovery', DI],
  ['T1619', 'Cloud Storage Object Discovery', DI],
  ['T1613', 'Container and Resource Discovery', DI],
  ['T1652', 'Device Driver Discovery', DI],
  ['T1482', 'Domain Trust Discovery', DI],
  ['T1083', 'File and Directory Discovery', DI],
  ['T1615', 'Group Policy Discovery', DI],
  ['T1654', 'Log Enumeration', DI],
  ['T1046', 'Network Service Discovery', DI],
  ['T1135', 'Network Share Discovery', DI],
  ['T1201', 'Password Policy Discovery', DI],
  ['T1120', 'Peripheral Device Discovery', DI],
  ['T1069', 'Permission Groups Discovery', DI],
  ['T1057', 'Process Discovery', DI],
  ['T1012', 'Query Registry', DI],
  ['T1018', 'Remote System Discovery', DI],
  ['T1518', 'Software Discovery', DI],
  ['T1082', 'System Information Discovery', DI],
  ['T1614', 'System Location Discovery', DI],
  ['T1016', 'System Network Configuration Discovery', DI],
  ['T1049', 'System Network Connections Discovery', DI],
  ['T1033', 'System Owner/User Discovery', DI],
  ['T1007', 'System Service Discovery', DI],
  ['T1124', 'System Time Discovery', DI],
  // Lateral Movement
  ['T1210', 'Exploitation of Remote Services', LM],
  ['T1534', 'Internal Spearphishing', LM],
  ['T1570', 'Lateral Tool Transfer', LM],
  ['T1563', 'Remote Service Session Hijacking', LM],
  ['T1021', 'Remote Services', LM],
  ['T1080', 'Taint Shared Content', LM],
  // Collection
  ['T1560', 'Archive Collected Data', CO],
  ['T1123', 'Audio Capture', CO],
  ['T1119', 'Automated Collection', CO],
  ['T1185', 'Browser Session Hijacking', CO],
  ['T1115', 'Clipboard Data', CO],
  ['T1530', 'Data from Cloud Storage', CO],
  ['T1602', 'Data from Configuration Repository', CO],
  ['T1213', 'Data from Information Repositories', CO],
  ['T1005', 'Data from Local System', CO],
  ['T1039', 'Data from Network Shared Drive', CO],
  ['T1025', 'Data from Removable Media', CO],
  ['T1074', 'Data Staged', CO],
  ['T1114', 'Email Collection', CO],
  ['T1113', 'Screen Capture', CO],
  ['T1125', 'Video Capture', CO],
  // Command and Control
  ['T1071', 'Application Layer Protocol', C2],
  ['T1092', 'Communication Through Removable Media', C2],
  ['T1132', 'Data Encoding', C2],
  ['T1001', 'Data Obfuscation', C2],
  ['T1568', 'Dynamic Resolution', C2],
  ['T1573', 'Encrypted Channel', C2],
  ['T1008', 'Fallback Channels', C2],
  ['T1665', 'Hide Infrastructure', C2],
  ['T1105', 'Ingress Tool Transfer', C2],
  ['T1104', 'Multi-Stage Channels', C2],
  ['T1095', 'Non-Application Layer Protocol', C2],
  ['T1571', 'Non-Standard Port', C2],
  ['T1572', 'Protocol Tunneling', C2],
  ['T1090', 'Proxy', C2],
  ['T1219', 'Remote Access Software', C2],
  ['T1102', 'Web Service', C2],
  // Exfiltration
  ['T1020', 'Automated Exfiltration', EF],
  ['T1030', 'Data Transfer Size Limits', EF],
  ['T1048', 'Exfiltration Over Alternative Protocol', EF],
  ['T1041', 'Exfiltration Over C2 Channel', EF],
  ['T1011', 'Exfiltration Over Other Network Medium', EF],
  ['T1052', 'Exfiltration Over Physical Medium', EF],
  ['T1567', 'Exfiltration Over Web Service', EF],
  ['T1029', 'Scheduled Transfer', EF],
  ['T1537', 'Transfer Data to Cloud Account', EF],
  // Impact
  ['T1531', 'Account Access Removal', IM],
  ['T1485', 'Data Destruction', IM],
  ['T1486', 'Data Encrypted for Impact', IM],
  ['T1565', 'Data Manipulation', IM],
  ['T1491', 'Defacement', IM],
  ['T1561', 'Disk Wipe', IM],
  ['T1499', 'Endpoint Denial of Service', IM],
  ['T1657', 'Financial Theft', IM],
  ['T1495', 'Firmware Corruption', IM],
  ['T1490', 'Inhibit System Recovery', IM],
  ['T1498', 'Network Denial of Service', IM],
  ['T1496', 'Resource Hijacking', IM],
  ['T1489', 'Service Stop', IM],
  ['T1529', 'System Shutdown/Reboot', IM],
];

const TACTIC_NAME: Record<string, string> = Object.fromEntries(FULL_TACTICS.map((t) => [t.id, t.name]));

export const FULL_TECHNIQUES: FullTechnique[] = ROWS.map(([id, name, ...tas]) => ({ id, name, tactics: tas.map((x) => TACTIC_NAME[x]) }));
export const FULL_BY_ID: Record<string, FullTechnique> = Object.fromEntries(FULL_TECHNIQUES.map((t) => [t.id, t]));

/** Techniques listed under one tactic, alphabetical as in the MITRE matrix. */
export function techniquesForTactic(tactic: string): FullTechnique[] {
  return FULL_TECHNIQUES.filter((t) => t.tactics.includes(tactic)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Parent ID of a (sub-)technique, e.g. T1566.001 → T1566. */
export function parentId(id: string): string {
  return id.split('.')[0];
}
