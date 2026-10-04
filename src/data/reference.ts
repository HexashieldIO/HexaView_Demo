// Reference data shared across modules (LLD 6.7: loaded into the ref schema,
// never tenant-specific). Real ATT&CK identifiers and real, public CVEs.

export const TACTICS = [
  { id: 'TA0043', name: 'Reconnaissance', short: 'Recon' },
  { id: 'TA0001', name: 'Initial Access', short: 'Initial access' },
  { id: 'TA0002', name: 'Execution', short: 'Execution' },
  { id: 'TA0003', name: 'Persistence', short: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation', short: 'Priv. esc.' },
  { id: 'TA0005', name: 'Defense Evasion', short: 'Defense evasion' },
  { id: 'TA0006', name: 'Credential Access', short: 'Cred. access' },
  { id: 'TA0007', name: 'Discovery', short: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement', short: 'Lateral mvmt' },
  { id: 'TA0009', name: 'Collection', short: 'Collection' },
  { id: 'TA0011', name: 'Command and Control', short: 'C2' },
  { id: 'TA0010', name: 'Exfiltration', short: 'Exfiltration' },
  { id: 'TA0040', name: 'Impact', short: 'Impact' },
] as const;

export interface Technique {
  id: string;
  name: string;
  tactic: string;
  matrix: 'enterprise' | 'ics' | 'atlas';
}

export const TECHNIQUES: Technique[] = [
  { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance', matrix: 'enterprise' },
  { id: 'T1589', name: 'Gather Victim Identity Information', tactic: 'Reconnaissance', matrix: 'enterprise' },
  { id: 'T1566.001', name: 'Spearphishing Attachment', tactic: 'Initial Access', matrix: 'enterprise' },
  { id: 'T1566.002', name: 'Spearphishing Link', tactic: 'Initial Access', matrix: 'enterprise' },
  { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access', matrix: 'enterprise' },
  { id: 'T1133', name: 'External Remote Services', tactic: 'Initial Access', matrix: 'enterprise' },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access', matrix: 'enterprise' },
  { id: 'T1199', name: 'Trusted Relationship', tactic: 'Initial Access', matrix: 'enterprise' },
  { id: 'T1195.002', name: 'Compromise Software Supply Chain', tactic: 'Initial Access', matrix: 'enterprise' },
  { id: 'T1059.001', name: 'PowerShell', tactic: 'Execution', matrix: 'enterprise' },
  { id: 'T1059.003', name: 'Windows Command Shell', tactic: 'Execution', matrix: 'enterprise' },
  { id: 'T1204.002', name: 'Malicious File', tactic: 'Execution', matrix: 'enterprise' },
  { id: 'T1047', name: 'Windows Management Instrumentation', tactic: 'Execution', matrix: 'enterprise' },
  { id: 'T1053.005', name: 'Scheduled Task', tactic: 'Persistence', matrix: 'enterprise' },
  { id: 'T1098', name: 'Account Manipulation', tactic: 'Persistence', matrix: 'enterprise' },
  { id: 'T1136.003', name: 'Create Cloud Account', tactic: 'Persistence', matrix: 'enterprise' },
  { id: 'T1505.003', name: 'Web Shell', tactic: 'Persistence', matrix: 'enterprise' },
  { id: 'T1547.001', name: 'Registry Run Keys', tactic: 'Persistence', matrix: 'enterprise' },
  { id: 'T1068', name: 'Exploitation for Privilege Escalation', tactic: 'Privilege Escalation', matrix: 'enterprise' },
  { id: 'T1548.002', name: 'Bypass User Account Control', tactic: 'Privilege Escalation', matrix: 'enterprise' },
  { id: 'T1484.001', name: 'Group Policy Modification', tactic: 'Privilege Escalation', matrix: 'enterprise' },
  { id: 'T1562.001', name: 'Disable or Modify Tools', tactic: 'Defense Evasion', matrix: 'enterprise' },
  { id: 'T1070.001', name: 'Clear Windows Event Logs', tactic: 'Defense Evasion', matrix: 'enterprise' },
  { id: 'T1027', name: 'Obfuscated Files or Information', tactic: 'Defense Evasion', matrix: 'enterprise' },
  { id: 'T1550.001', name: 'Application Access Token', tactic: 'Defense Evasion', matrix: 'enterprise' },
  { id: 'T1218.011', name: 'Rundll32', tactic: 'Defense Evasion', matrix: 'enterprise' },
  { id: 'T1003.001', name: 'LSASS Memory', tactic: 'Credential Access', matrix: 'enterprise' },
  { id: 'T1110.003', name: 'Password Spraying', tactic: 'Credential Access', matrix: 'enterprise' },
  { id: 'T1621', name: 'MFA Request Generation', tactic: 'Credential Access', matrix: 'enterprise' },
  { id: 'T1558.003', name: 'Kerberoasting', tactic: 'Credential Access', matrix: 'enterprise' },
  { id: 'T1539', name: 'Steal Web Session Cookie', tactic: 'Credential Access', matrix: 'enterprise' },
  { id: 'T1555', name: 'Credentials from Password Stores', tactic: 'Credential Access', matrix: 'enterprise' },
  { id: 'T1087.002', name: 'Domain Account Discovery', tactic: 'Discovery', matrix: 'enterprise' },
  { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery', matrix: 'enterprise' },
  { id: 'T1482', name: 'Domain Trust Discovery', tactic: 'Discovery', matrix: 'enterprise' },
  { id: 'T1580', name: 'Cloud Infrastructure Discovery', tactic: 'Discovery', matrix: 'enterprise' },
  { id: 'T1021.001', name: 'Remote Desktop Protocol', tactic: 'Lateral Movement', matrix: 'enterprise' },
  { id: 'T1021.002', name: 'SMB/Windows Admin Shares', tactic: 'Lateral Movement', matrix: 'enterprise' },
  { id: 'T1570', name: 'Lateral Tool Transfer', tactic: 'Lateral Movement', matrix: 'enterprise' },
  { id: 'T1550.002', name: 'Pass the Hash', tactic: 'Lateral Movement', matrix: 'enterprise' },
  { id: 'T1114.002', name: 'Remote Email Collection', tactic: 'Collection', matrix: 'enterprise' },
  { id: 'T1530', name: 'Data from Cloud Storage', tactic: 'Collection', matrix: 'enterprise' },
  { id: 'T1213', name: 'Data from Information Repositories', tactic: 'Collection', matrix: 'enterprise' },
  { id: 'T1560.001', name: 'Archive via Utility', tactic: 'Collection', matrix: 'enterprise' },
  { id: 'T1071.001', name: 'Web Protocols', tactic: 'Command and Control', matrix: 'enterprise' },
  { id: 'T1219', name: 'Remote Access Software', tactic: 'Command and Control', matrix: 'enterprise' },
  { id: 'T1572', name: 'Protocol Tunneling', tactic: 'Command and Control', matrix: 'enterprise' },
  { id: 'T1090.003', name: 'Multi-hop Proxy', tactic: 'Command and Control', matrix: 'enterprise' },
  { id: 'T1567.002', name: 'Exfiltration to Cloud Storage', tactic: 'Exfiltration', matrix: 'enterprise' },
  { id: 'T1048.003', name: 'Exfiltration Over Unencrypted Protocol', tactic: 'Exfiltration', matrix: 'enterprise' },
  { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration', matrix: 'enterprise' },
  { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact', matrix: 'enterprise' },
  { id: 'T1490', name: 'Inhibit System Recovery', tactic: 'Impact', matrix: 'enterprise' },
  { id: 'T1489', name: 'Service Stop', tactic: 'Impact', matrix: 'enterprise' },
  { id: 'T1657', name: 'Financial Theft', tactic: 'Impact', matrix: 'enterprise' },
  { id: 'T1565.001', name: 'Stored Data Manipulation', tactic: 'Impact', matrix: 'enterprise' },
];

export const ICS_TECHNIQUES: Technique[] = [
  { id: 'T0883', name: 'Internet Accessible Device', tactic: 'Initial Access', matrix: 'ics' },
  { id: 'T0886', name: 'Remote Services', tactic: 'Initial Access', matrix: 'ics' },
  { id: 'T0847', name: 'Replication Through Removable Media', tactic: 'Initial Access', matrix: 'ics' },
  { id: 'T0862', name: 'Supply Chain Compromise', tactic: 'Initial Access', matrix: 'ics' },
  { id: 'T0866', name: 'Exploitation of Remote Services', tactic: 'Lateral Movement', matrix: 'ics' },
  { id: 'T0872', name: 'Indicator Removal on Host', tactic: 'Evasion', matrix: 'ics' },
  { id: 'T0859', name: 'Valid Accounts', tactic: 'Lateral Movement', matrix: 'ics' },
  { id: 'T0846', name: 'Remote System Discovery', tactic: 'Discovery', matrix: 'ics' },
  { id: 'T0888', name: 'Remote System Information Discovery', tactic: 'Discovery', matrix: 'ics' },
  { id: 'T0843', name: 'Program Download', tactic: 'Lateral Movement', matrix: 'ics' },
  { id: 'T0821', name: 'Modify Controller Tasking', tactic: 'Execution', matrix: 'ics' },
  { id: 'T0831', name: 'Manipulation of Control', tactic: 'Impact', matrix: 'ics' },
  { id: 'T0855', name: 'Unauthorized Command Message', tactic: 'Impair Process Control', matrix: 'ics' },
  { id: 'T0836', name: 'Modify Parameter', tactic: 'Impair Process Control', matrix: 'ics' },
  { id: 'T0816', name: 'Device Restart/Shutdown', tactic: 'Inhibit Response Function', matrix: 'ics' },
  { id: 'T0814', name: 'Denial of Service', tactic: 'Inhibit Response Function', matrix: 'ics' },
  { id: 'T0832', name: 'Manipulation of View', tactic: 'Impact', matrix: 'ics' },
  { id: 'T0826', name: 'Loss of Availability', tactic: 'Impact', matrix: 'ics' },
  { id: 'T0882', name: 'Theft of Operational Information', tactic: 'Impact', matrix: 'ics' },
];

export const ATLAS_TECHNIQUES: Technique[] = [
  { id: 'AML.T0051', name: 'LLM Prompt Injection', tactic: 'Initial Access', matrix: 'atlas' },
  { id: 'AML.T0054', name: 'LLM Jailbreak', tactic: 'Defense Evasion', matrix: 'atlas' },
  { id: 'AML.T0057', name: 'LLM Data Leakage', tactic: 'Exfiltration', matrix: 'atlas' },
  { id: 'AML.T0024', name: 'Exfiltration via ML Inference API', tactic: 'Exfiltration', matrix: 'atlas' },
  { id: 'AML.T0020', name: 'Poison Training Data', tactic: 'Resource Development', matrix: 'atlas' },
  { id: 'AML.T0043', name: 'Craft Adversarial Data', tactic: 'ML Attack Staging', matrix: 'atlas' },
  { id: 'AML.T0048', name: 'External Harms', tactic: 'Impact', matrix: 'atlas' },
  { id: 'AML.T0053', name: 'LLM Plugin Compromise', tactic: 'Execution', matrix: 'atlas' },
];

export const TECHNIQUE_BY_ID: Record<string, Technique> = Object.fromEntries(
  [...TECHNIQUES, ...ICS_TECHNIQUES, ...ATLAS_TECHNIQUES].map((t) => [t.id, t]),
);

export interface CveRef {
  id: string;
  product: string;
  title: string;
  cvss: number;
  kev: boolean;
  epss: number;
}

/** Public, well-known CVEs used to make vulnerability data realistic. */
export const CVES: CveRef[] = [
  { id: 'CVE-2024-3400', product: 'Palo Alto PAN-OS GlobalProtect', title: 'Command injection in GlobalProtect', cvss: 10.0, kev: true, epss: 0.96 },
  { id: 'CVE-2023-4966', product: 'Citrix NetScaler ADC/Gateway', title: '"Citrix Bleed" session token disclosure', cvss: 9.4, kev: true, epss: 0.97 },
  { id: 'CVE-2024-21762', product: 'Fortinet FortiOS SSL VPN', title: 'Out-of-bounds write, unauthenticated RCE', cvss: 9.8, kev: true, epss: 0.94 },
  { id: 'CVE-2025-0282', product: 'Ivanti Connect Secure', title: 'Stack-based buffer overflow, unauthenticated RCE', cvss: 9.0, kev: true, epss: 0.91 },
  { id: 'CVE-2025-53770', product: 'Microsoft SharePoint Server', title: '"ToolShell" deserialisation RCE', cvss: 9.8, kev: true, epss: 0.93 },
  { id: 'CVE-2024-1709', product: 'ConnectWise ScreenConnect', title: 'Authentication bypass', cvss: 10.0, kev: true, epss: 0.95 },
  { id: 'CVE-2023-34362', product: 'Progress MOVEit Transfer', title: 'SQL injection leading to RCE', cvss: 9.8, kev: true, epss: 0.97 },
  { id: 'CVE-2024-6387', product: 'OpenSSH (glibc Linux)', title: '"regreSSHion" signal handler race', cvss: 8.1, kev: false, epss: 0.42 },
  { id: 'CVE-2021-44228', product: 'Apache Log4j', title: '"Log4Shell" JNDI injection', cvss: 10.0, kev: true, epss: 0.97 },
  { id: 'CVE-2023-20198', product: 'Cisco IOS XE Web UI', title: 'Privilege escalation, implant observed', cvss: 10.0, kev: true, epss: 0.95 },
  { id: 'CVE-2024-47575', product: 'Fortinet FortiManager', title: '"FortiJump" missing authentication', cvss: 9.8, kev: true, epss: 0.88 },
  { id: 'CVE-2023-23397', product: 'Microsoft Outlook', title: 'NTLM credential leak via reminder', cvss: 9.8, kev: true, epss: 0.92 },
  { id: 'CVE-2024-38063', product: 'Windows TCP/IP (IPv6)', title: 'Remote code execution', cvss: 9.8, kev: false, epss: 0.35 },
  { id: 'CVE-2023-48795', product: 'SSH (various)', title: '"Terrapin" prefix truncation', cvss: 5.9, kev: false, epss: 0.18 },
  { id: 'CVE-2024-4577', product: 'PHP-CGI on Windows', title: 'Argument injection RCE', cvss: 9.8, kev: true, epss: 0.94 },
  { id: 'CVE-2024-55956', product: 'Cleo Harmony/VLTrader', title: 'Unauthenticated file write', cvss: 9.8, kev: true, epss: 0.9 },
  { id: 'CVE-2023-27997', product: 'Fortinet FortiGate SSL-VPN', title: 'Heap overflow pre-auth RCE', cvss: 9.8, kev: true, epss: 0.89 },
  { id: 'CVE-2024-23897', product: 'Jenkins', title: 'Arbitrary file read via CLI', cvss: 9.8, kev: true, epss: 0.96 },
  { id: 'CVE-2022-41040', product: 'Microsoft Exchange', title: '"ProxyNotShell" SSRF', cvss: 8.8, kev: true, epss: 0.94 },
  { id: 'CVE-2024-37085', product: 'VMware ESXi', title: 'AD integration auth bypass', cvss: 6.8, kev: true, epss: 0.7 },
];

export const ICS_CVES: CveRef[] = [
  { id: 'CVE-2022-38465', product: 'Siemens SIMATIC S7-1500', title: 'Global private key extraction', cvss: 9.3, kev: false, epss: 0.08 },
  { id: 'CVE-2023-3595', product: 'Rockwell ControlLogix 1756-EN2T', title: 'Out-of-bounds write, RCE', cvss: 9.8, kev: true, epss: 0.21 },
  { id: 'CVE-2022-1161', product: 'Rockwell Logix controllers', title: 'Modified code not shown to engineering station', cvss: 10.0, kev: false, epss: 0.05 },
  { id: 'CVE-2023-6448', product: 'Unitronics Vision PLC', title: 'Default administrative password', cvss: 9.8, kev: true, epss: 0.31 },
  { id: 'CVE-2024-6242', product: 'Rockwell ControlLogix', title: 'Trusted slot feature bypass', cvss: 8.4, kev: false, epss: 0.03 },
  { id: 'CVE-2023-1133', product: 'Delta Electronics InfraSuite', title: 'Deserialisation RCE', cvss: 9.8, kev: false, epss: 0.12 },
  { id: 'CVE-2022-29965', product: 'Emerson DeltaV', title: 'Deterministic debug credentials', cvss: 8.8, kev: false, epss: 0.02 },
  { id: 'CVE-2024-38876', product: 'Siemens Omnivise T3000', title: 'Path traversal', cvss: 8.1, kev: false, epss: 0.02 },
  { id: 'CVE-2023-28489', product: 'Siemens SICAM A8000 RTU', title: 'Command injection', cvss: 9.8, kev: false, epss: 0.04 },
  { id: 'CVE-2021-22681', product: 'Rockwell Studio 5000 / Logix', title: 'Insufficiently protected credentials', cvss: 10.0, kev: false, epss: 0.06 },
];
