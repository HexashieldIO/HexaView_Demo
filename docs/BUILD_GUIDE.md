# HexaView v3 demo · build guide for page authors

## PHASE 2 STANDARDS (read first; these override anything below)

1. **Five customers.** `maritime`, `finserv`, `media`, `healthcare` (Mercy Ridge Health: US
   hospitals, Epic EHR, 14,600 medical devices as OT, HIPAA / HITRUST / HHS HPH CPGs / FDA 524B) and
   `automotive` (Vireo Motor Group: German OEM, 4 plants incl. an AIR-GAPPED battery plant, 2.1M
   connected vehicles with a vehicle SOC, OTA updates, UNECE R155/R156, ISO/SAE 21434, TISAX, NIS2,
   IEC 62443, currency EUR). Every data map keyed by `CustomerId` must have all five, with genuinely
   sector-specific content (never copy another sector's text). `headlines()` already covers all five.
2. **Match the original HexaView v2.** It is live at https://hexaview-dev-v2.pages.dev (already
   signed in). Use the browser tools to study the module you own: create your OWN tab with
   `mcp__Claude_Browser__tabs_create` and only ever drive that tab (pass its tabId on every call;
   never touch tabs named `seed` or `tab-1`). In the original, modules are opened from the sidebar
   (buttons `HEXASOC`, `HEXAOT` …) and tabs are `.cap-tab` buttons. Take screenshots and read page
   text (`get_page_text`) for each tab, and copy its layout, information design and visual style,
   then make ours richer. You may also open our build at http://localhost:5174 in your own tab to
   check your pages render (resize your tab to 1440×1000 for checks).
3. **Crisp visuals, no fuzzy text.** Charts now render as SVG and text halos are stripped
   automatically, but prefer hand-built HTML/SVG visuals like the original wherever the visual is
   the story: use `FlowMap` (src/components/FlowMap.tsx) for any flow/sankey, HTML bar rows,
   segmented bars, ring gauges, heat grids and card matrices. Never put text on top of chart marks
   where it collides; never use `textBorder`/text shadows; keep labels ≥ 10.5px; use hex colours
   inside chart options (CSS `var()` is resolved automatically but avoid `color-mix`).
4. **Every headline is clickable and pivots to its data.** Every KPI in a `KpiStrip` must have
   either `to: '/module/tab?filter=…'` (navigates; the target page reads `useSearchParams()` and
   pre-filters its table) or `onClick` that opens a `Drawer` listing the underlying records with
   their source connector. Add `source: 'Microsoft Sentinel · Defender XDR'` to each KPI. Big
   numbers inside cards (stat blocks, gauges, legend counts) should do the same.
5. Keep the tenant scope, time range and theme behaviour from the rules below.


This is a clickable sales demo of **HexaView SaaS**: a bidirectional single pane of glass over a
customer's entire security toolset (cloud, on-prem and OT), on HexaShield's platform. It must look
and feel like the v2 demo (dark navy, module-accented header bands, KPI strips, ring gauges, dense
but readable cards) and be **rich**: every page should feel like a real product screen with real
data, drill-downs and at least one interaction. Dummy data only.

Read before you write anything:

- `src/data/types.ts`, `src/data/customers/*.ts` (the three customers: their tenants, data planes,
  connectors, frameworks, people, third parties and sector vocabulary)
- `src/data/core.ts` (**headlines**: anchor numbers every page must agree with; Resilience Index; loops)
- `src/data/reference.ts` (ATT&CK techniques, ICS techniques, ATLAS, real public CVEs)
- `src/components/ui.tsx`, `Chart.tsx`, `DataTable.tsx`, `Overlay.tsx`, `WorldMap.tsx`
- `src/pages/overview/CommandCentre.tsx` (the reference page: copy its idioms)
- `src/modules/registry.ts` (modules, tabs, the 20 services)
- `src/styles/app.css` (available CSS classes)

## Stack and rules

- React 19 + TypeScript (strict, `verbatimModuleSyntax`: use `import type` for types; `noUnusedLocals`).
- Charts: `<Chart option={…} height={…} />` (ECharts option object; theme handled for you). Use
  `PALETTE` / `SEV_HEX` from `Chart.tsx` for colours inside chart options (CSS variables do not work
  inside canvas charts). In JSX use CSS variables (`var(--m-soc)`, `var(--sev-high)`, `var(--good)`).
- Icons: `lucide-react` named imports only.
- **Do not edit shared files**: `src/components/*`, `src/styles/*`, `src/data/core.ts`,
  `src/data/customers/*`, `src/data/reference.ts`, `src/modules/registry.ts`, `src/App.tsx`,
  `src/pages/registry.ts`. If you need a helper component, put it in your own folder
  (`src/pages/<module>/parts.tsx`). If you need extra CSS, create `src/pages/<module>/<module>.css`,
  import it from your pages, and prefix every class (e.g. `.soc-…`).
- Your page files already exist as stubs at `src/pages/<module>/<Tab>.tsx`; replace their content and
  keep the default export. The router already wraps each tab in `ModuleLayout` (header band, tabs,
  score ring, subscription banner), so your page renders only the body content.
- Put data generation in `src/data/modules/<module>.ts` (one file per module you own). Export pure
  functions `(c: CustomerProfile, tenantId: string, …) => data`. Use the seeded RNG:
  `const r = rng(\`soc-incidents-${c.id}-${tenantId}\`)` so data is stable across reloads and
  distinct per customer and tenant. Memoise in the page with `useMemo`.
- Typecheck with `npx tsc -p tsconfig.app.json --noEmit` before you finish, and fix every error in
  your files. Do **not** run `npm run build` or the dev server, do not use the browser, do not commit.

## What every page must do

1. **Respond to the global context** from `useApp()`: `customer` (three very different customers),
   `tenantId` (`'all'` = group roll-up, or one tenant: filter or scale with `scopedTenants`,
   `tenantShare`, `scale`), `timeRange` (scale counts/series with `rangeDays`). Switching customer must
   visibly change names, tools, numbers, frameworks and sector-specific content.
2. **Anchor to the headlines** in `headlines(c, tenantId)` (e.g. SOC open incidents, OT asset count,
   custody assets). If the Command Centre says 14 open incidents, the SOC page must list 14.
3. Open with a one-line `<p className="page-intro">` naming the customer/tenant and the tools behind
   the view (e.g. "watched through Microsoft Sentinel, Defender XDR and Entra ID"), taken from
   `c.connectors` so it is right for each customer.
4. A **KPI strip** (`<KpiStrip items=[…] toneColor={tone} />`), then 2 to 5 rows of cards using the
   grid classes (`grid g2 / g3 / g4 / g-2-1 / g-3-2 / g-1-2`). Mix charts (line, bar, stacked bar,
   donut, radar, heatmap, sankey, treemap, scatter, gauges, `WorldMap`), tables (`DataTable` with
   search, sort and row click) and lists.
5. **Drill-down**: rows and tiles open a `<Drawer>` with detail (KV list, timeline, related entities,
   source tools, ATT&CK techniques, evidence).
6. **Bidirectional**: where it makes sense, offer a write-back action (e.g. "Deploy rule to Sentinel",
   "Revoke sessions in Entra ID", "Request evidence from owner"). Show what will change, the risk
   class (low / medium / high per LLD 8.2) and the approvals needed in a `<Modal>`; on submit, call
   `toast('…')`. **Never** render action controls in an OT context (OT is read-only by policy; say so).
7. **Degrade honestly**: key tiles show where data comes from (`<Sources items=[{name,status}]/>`)
   and freshness (`<Freshness minutes stale label/>`). If a contributing connector is degraded or
   stale in the customer profile, label it ("Stale: Veeam last synced 3 h ago"); never show unknown
   as zero.
8. Use the module's tone (`MODULE_BY_ID['soc'].tone`) for accents so each module keeps its colour.

## Content and tone

- Realistic and sector-specific. Use the customer's own vocabulary (`c.vocab`), people
  (`c.people`), third parties, tools (`c.connectors`), frameworks and tenants. Maritime is OT-heavy
  (terminals, cranes, vessels, VSAT, IMO / IACS E26/E27); Financial Services is regulated and
  cloud-plus-mainframe (DORA, PCI, SWIFT, NYDFS, Scattered Spider, Lazarus); Media is about
  pre-release content, vendors and custody (TPN, MPA, leaks, watermarks).
- British English in prose. Concise labels. Numbers formatted with `fmtNum`, `fmtCompact`, `fmtPct`,
  `fmtAgo`, `fmtDur`, `fmtMoney(n, c.currency)`.
- **Never** use these words anywhere: WhiteIntel, Nozomi, Copla, QUIC.
- HexaShield platform names: HexaCore, HexaSOC, HexaInt, HexaStrike, HexaOT, HexaComply,
  HexaCustody, HexaMatrix (ATT&CK coverage), HexaAI, HexaView.
- Do not use a gradient on large text. Keep cards dense but breathable; avoid walls of text.
