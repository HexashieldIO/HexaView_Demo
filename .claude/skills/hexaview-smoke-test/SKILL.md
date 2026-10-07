---
name: hexaview-smoke-test
description: Smoke-test HexaView pages across all 10 demo customers in the browser pane. Use after building or changing pages, before a release, or when the user asks to "test", "check it works" or "smoke test". Loads each route per customer in offscreen iframes and flags crashes, NaN, undefined and empty pages.
---

# HexaView smoke test (all 10 customers)

The demo has 10 customers, and every page must work for all of them:
`maritime, finserv, media, healthcare, automotive, insurance, defence, pharma, sghospital, studio`.

## Prerequisites

- The dev server is running on https://localhost (see the `hexaview-localhost` skill).
- The browser pane is open on a localhost page. `sessionStorage['hv.session']='1'` skips sign-in;
  `localStorage['hv.customer']` selects the customer.

## Run

1. Pick the routes to test: the pages you changed, plus the module overviews they link to. Use
   real paths, e.g. `/strike/aipentest?section=pricing`, `/incident-response/warroom`,
   `/ops/admin?section=billing&billing=retainer`.
2. Run [smoke.js](smoke.js) with `mcp__Claude_Browser__javascript_tool`, after replacing the
   `ROUTES` array. It starts the run in the background and returns at once; then poll with a
   second call: `await new Promise(r=>setTimeout(r,40000)); JSON.stringify(window.__smoke)`.
   Allow about 4 s per customer (routes load in parallel); use one poll per ~45 s, since the tool
   times out at 45 s.
3. `out: []` with `done: true` means every page rendered. Each failure line reads
   `customer route flags len=N`; open that route in the pane for that customer to debug.

## Notes

- The pane may be hidden, which throttles `requestAnimationFrame`. Count-ups have timer
  fallbacks, so text checks still work; screenshots can render offset, so prefer DOM checks.
- The script clears the in-session demo stores (`hv.aipt.*`, `hv.ir.*`) before and after, and
  restores the customer to `maritime`, so the demo starts fresh.
- A full flow test (click-through) is separate: drive it with `javascript_tool` by clicking
  buttons found by text, and report each step.
