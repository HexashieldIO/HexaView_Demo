---
name: hexaview-release
description: Ship HexaView to the live site. Use when the user says "commit and push", "commit and push to live site", "ship it", "release" or "deploy". Bumps the patch version (1.0.3 → 1.0.4), writes release notes, verifies, commits, rebases on teammates' work, pushes (which auto-deploys Cloudflare Pages + Azure) and confirms the deploy.
---

# HexaView release (commit + push to live)

Pushing to branch `HexaView_Demo` of `HexashieldIO/HexaView_Demo` deploys **live**:
Cloudflare Pages (https://hexaview-saas-demo.pages.dev, behind Cloudflare Access) and the
Azure Web App `hexaview-saas-demo` (GitHub Actions). Only run this when the user asked to
commit/push in their latest message; approval for one push does not carry to the next.

Work from `C:\Users\Marc\Documents\GitHub\HexaView_Demo_ORG`.

## Steps

1. **Nothing half-built.** Make sure no background agent is still editing files. Never `git stash`
   another agent's work.

2. **Bump the version.** Every live push raises the patch number by one.
   ```bash
   npm run bump        # npm version patch --no-git-tag-version → package.json + package-lock.json
   ```
   Add a new entry at the **top** of `RELEASE_NOTES` in `src/version.ts` for the new version:
   3 short, user-facing lines describing what changed since the last push (look at
   `git diff --stat` and the conversation). The version shows on the sign-in screen and in the
   profile panel under Help & support → What's new.

3. **Verify.**
   ```bash
   npx tsc -p tsconfig.app.json --noEmit
   npm run build
   ```
   Both must pass. Scan for banned words, which must never appear anywhere in the app:
   ```bash
   grep -rniE "whiteintel|nozomi|copla|\bquic\b" src
   ```
   (`Quick Assist` contains "Quic" only case-insensitively; it is fine.)
   If pages changed, run the `hexaview-smoke-test` skill first.

4. **Commit.** Stage only project files (`src`, `public`, `package.json`, `package-lock.json`,
   `vite.config.ts`, `docs`, `.claude/skills` as relevant), never `.certs/` or scratch files.
   Message: `vX.Y.Z: <summary>`, ending with the attribution line from the system reminder.

5. **Rebase, then push.** Teammates (e.g. lunarangelo) push to the same branch.
   ```bash
   git fetch && git rebase origin/HexaView_Demo && git push
   ```
   If the rebase conflicts, stop and show the user the conflicting files.

6. **Confirm the deploy.**
   ```bash
   curl -s "https://api.github.com/repos/HexashieldIO/HexaView_Demo/actions/runs?per_page=2" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>JSON.parse(d).workflow_runs.forEach(r=>console.log(r.head_sha.slice(0,7),r.status,r.conclusion)))"
   ```
   Cloudflare Pages builds on push too. To prove the live bundle, compare the
   `/assets/index-*.js` name in `dist/index.html` with the live page (the user must be signed in
   to Cloudflare Access in the browser pane; never enter credentials).

7. **Restart the local dev server** so localhost shows the new version (it is injected at build
   time via vite `define`): `preview_stop` the running `hexaview` server, then `preview_start`
   with name `hexaview`.

8. **Report** in a few lines: the version (e.g. **v1.0.4**), the commit hash, what shipped, deploy
   status, and the next version number.
