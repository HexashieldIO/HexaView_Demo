---
name: hexaview-localhost
description: Run, restart or open the HexaView dev server on https://localhost (port 443). Use when the user says "run local host", "run localhost", "start the server", "restart the server" or the local site shows stale content, a wrong version number or an SSL error.
---

# HexaView on localhost

- Vite dev server over **HTTPS on port 443**, bound to `127.0.0.1`, using the self-signed
  certificate in `.certs/localhost.pem` + `.certs/localhost-key.pem` (git-ignored; SAN covers
  `localhost`, `127.0.0.1` and `hexaview.io`). Without the certs it falls back to HTTP.
- The Windows hosts file maps `127.0.0.1 HexaView.io`, so https://hexaview.io also works locally
  (`allowedHosts` in `vite.config.ts`).
- Launch config: `.claude/launch.json`, configuration name **`hexaview`**.

## Start or open

1. `mcp__Claude_Browser__preview_list`. If `hexaview` is running, open it with
   `preview_start` and a `url` (e.g. `https://localhost/`). Do not start a second server.
2. If it is not running, `preview_start` with name `hexaview`.
3. Tell the user the URLs: https://localhost and https://hexaview.io, plus the page relevant to
   what they're working on.

## Restart (needed after editing `vite.config.ts` or bumping the version)

The version number is injected at build time, so a running server keeps the old one.
`preview_stop` the running server's id, then `preview_start` with name `hexaview`, and confirm,
e.g. `document.querySelector('.auth-version')?.textContent` on `/signin`.

## Troubleshooting

- **Wrong folder served:** the preview tool can launch from the older `HexaView_Demo` checkout.
  Its untracked `.claude/launch.json` uses `npm --prefix C:/Users/Marc/Documents/GitHub/HexaView_Demo_ORG run dev -- --port 443 --strictPort`
  so it serves this repo. Check the server's `cwd` in `preview_list` if content looks stale.
- **SSL error in a normal browser window (works in Incognito):** cached certificate state.
  Suggest a full browser restart. Trusting the certificate system-wide is a security-setting
  change: give the user the `certutil` command to run themselves, never run it for them.
- **Port 443 in use:** another server is still bound; stop it via `preview_stop` rather than
  killing processes.
- **Signed out:** `sessionStorage.setItem('hv.session','1')` in the pane skips the sign-in screen
  for testing (never type real credentials).
