---
name: hexaview-new-module
description: Add a new module, tab or in-page section to the HexaView demo. Use when the user asks for a new module, sidebar entry, tab, sub-menu or feature area (e.g. "add an Incident Response module", "new tab under HexaStrike"). Covers every file that must be wired, the per-customer data rules and the quality bar.
---

# Add a module or tab to HexaView

Read `docs/BUILD_GUIDE.md` first; it has the page standards. Stack: Vite + React 19 +
TypeScript strict (`verbatimModuleSyntax`, `noUnusedLocals`, `erasableSyntaxOnly`),
react-router, lucide-react, ECharts (SVG) and hand-built SVG visuals.

## 1. Wire it in (all required)

| What | Where |
|---|---|
| Module entry: `id`, `group` (`overview`/`core`/`platform`/`fabric`/`ops`/`partner`), `product`, `title`, `tagline`, `glyph` (or `brandIcon`), `tone: 'var(--m-<id>)'`, `basePath`, `tabs[]` | `src/modules/registry.ts` (`MODULES`; array order = sidebar order within a group) |
| One lazy page per tab, keyed `"<module>/<tab>"` | `src/pages/registry.ts` (`PAGES`) |
| Glyph icon: add it to both the lucide import and `GLYPHS` | `src/components/HexIcon.tsx` |
| Accent colour `--m-<id>` in light **and** dark blocks | `src/styles/tokens.css` |
| Which roles can open it (others see it locked) | `src/modules/roles.ts` `access` lists (`master`/`ciso`/`admin` usually have `all`) |
| Old URLs that should forward | `REDIRECTS` in `src/App.tsx` |

- **New tab on an existing module:** add it to that module's `tabs` and to `PAGES`.
- **In-page sub-menu:** use a `?section=` section bar, like `src/pages/strike/AiPentest.tsx` or
  `src/pages/soc/socreport`.
- **`service` on a tab:** only add one if the `ServiceId` exists in every customer's `services`
  map; otherwise leave it out.
- **Labels:** never add "New" / "New module" badges or flags.

## 2. Data: all 10 customers

`maritime, finserv, media, healthcare, automotive, insurance, defence, pharma, sghospital, studio`.

- Put seeded data in `src/data/modules/<id>.ts`, using `rng` (`src/lib/rng.ts`) so values are
  stable.
- Anchor numbers come from `headlines(c, tenantId)`.
- For per-customer maps use `CustomerMap<T>` and `forCustomer(map, c)` from
  `src/data/customerMap.ts`. The newer five customers fall back to their `dataKey` template.
- Use each customer's own people (`c.people`, role-based people in `rolePeople`), tenants,
  connectors (real tool names), frameworks, currency (`src/lib/format.ts`, incl. CHF/SGD) and
  sector. Never copy one sector's text into another.
- Respect the tenant scope and time range from `useApp()`.
- Session-only user actions go in a small store persisted to `sessionStorage` under an `hv.<id>.*`
  key. Demo reset clears `hv.*`, keeping `hv.theme` and `hv.session`.
- Keep each customer's stored state small (well under 1 MB).

## 3. Quality bar

- Every headline number is clickable (`to` or a drawer) and has a `source`.
- Visuals are crisp SVG/HTML, using the module `tone`.
- Count-ups use `useIntro` (it has a timer fallback); respect `prefers-reduced-motion`.
- No horizontal page scroll at 375px. Use the existing components in `src/components`
  (`ui`, `FlowMap`, `DataTable`, `Overlay`, `CustomerLogo`) and the report parts in
  `src/pages/reports/parts.tsx`.
- Never write these words anywhere: **WhiteIntel, Nozomi, Copla, QUIC**.
- Never define React components inside other components; they remount on every update and lose
  their state.
- Legal or contract wording (authorisation letters, terms) comes from HexaShield's own templates.
  Fill in the fields only; don't write new legal clauses.

## 4. Verify, then hand back

1. `npx tsc -p tsconfig.app.json --noEmit` and `npm run build` must both pass.
2. Run the `hexaview-smoke-test` skill on every new route.
3. Click through the main flow once.
4. Don't commit unless the user asks; shipping goes through the `hexaview-release` skill.
