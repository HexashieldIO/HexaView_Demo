# HexaView v3 · demo

A clickable demo of **HexaView SaaS**: one bidirectional single pane of glass over a customer's
entire security toolset, in cloud, on-prem and OT, built on HexaShield's platform. Dummy data only.

## What is in it

- **Five demo customers**, switchable from the sidebar:
  - **Halcyon Ports & Shipping** (Maritime): 4 container terminals, a 22-vessel fleet, heavy OT,
    customer-hosted and on-prem OT data planes, vessels on store-and-forward edge collectors.
  - **Aldersgate Financial Group** (Financial Services): 5 regulated entities, Azure + AWS + data
    centres with mainframe and SWIFT, dedicated stamp with BYOK; DORA, PCI DSS, SWIFT CSP, NYDFS.
  - **Kestrel Pictures Group** (Media & Entertainment): studio, post & VFX, streaming and live
    broadcast; Professional tier; content custody across 63 vendors; TPN, MPA, DPP.
  - **Mercy Ridge Health** (Healthcare): 5 hospitals, Epic, 14,600 medical devices as OT; HIPAA,
    HITRUST, HHS HPH CPGs, FDA 524B.
  - **Vireo Motor Group** (Automotive): 4 plants incl. an air-gapped battery plant, 2.1M connected
    vehicles with a vehicle SOC; UNECE R155/R156, ISO/SAE 21434, TISAX, NIS2, IEC 62443.
- **Overview**: Command Centre (Resilience Index, HexaCore platform map, estate by environment,
  tenant roll-up, attention queue, live feed), Board View, Closed-Loop Assurance.
- **Six core capabilities covering the 20 managed services**:
  - HexaSOC (24/7 MDR, Incident Response, Threat Hunting, Digital Forensics, Detection Engineering,
    ATT&CK Coverage)
  - HexaInt (Dark Web Monitoring, OSINT & Threat Intel, Credential & Executive Exposure)
  - HexaStrike (Penetration Testing, Red Teaming, Purple Teaming, Attack Surface Management)
  - HexaOT (Asset Visibility, OT Vulnerability Management, OT Penetration Testing)
  - HexaComply (Compliance as a Service, Third-Party Risk, AI Security & Governance)
  - HexaCustody (Content Custody & Chain of Evidence, with revocation at supplier, user and session)
- **New capabilities**: HexaAI (cited copilot, AI discovery & runtime, agentic SOC dial, AI red
  teaming), Cyber Insurance & Risk Quantification, Reporting Centre.
- **Integration Fabric (HexaCore)**: integrations health, data planes (control plane over data
  plane), unified assets, exposure, identity, cloud posture, attack paths, pipeline & cost.
- **Operations**: Action Centre (gated write-back), Audit Ledger (hash chain), Crisis War Room,
  Tool Scorecard, Peer Benchmark, Trust Centre, Service Catalogue, Administration.

Global controls: customer, tenant scope (group roll-up or one tenant), time range, role-based view,
light/dark theme, customer vs partner/MSSP account, Ctrl+K search. Every headline number opens the
records behind it.

**Partner / MSSP mode** (sidebar Account type) adds Partner Console (overview, clients,
provisioning), Partner Sales (deal registration, quotes & pricing, pipeline), White Label (branding,
domains & login, templates), Enablement (content library, training, co-marketing & MDF) and Billing
(usage, invoices, commissions, support).

## Run it

```bash
npm install
npm run dev
```

## Build and deploy

```bash
npm run build
```

`dist/` is a static site. On Cloudflare Pages use build command `npm run build` and output
directory `dist`; `public/_redirects` handles client-side routes.

## Where things live

- `src/data/customers/` customer profiles (tenants, data planes, connectors, frameworks, people)
- `src/data/core.ts` headline numbers shared by every page, Resilience Index, closed loops
- `src/data/modules/` per-module dummy data generators (seeded, stable per customer and tenant)
- `src/modules/registry.ts` modules, tabs and the 20 services
- `src/pages/` one folder per module, one file per tab
- `docs/BUILD_GUIDE.md` conventions for adding pages
