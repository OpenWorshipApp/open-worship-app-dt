---
name: dev-electron-hardcodes-port-3000
description: "Dev Electron always loads :3000; Vite used to slide to :3001 in silence when a stale server held it — strictPort (2026-09-18) now stops npm run dev with 'Port 3000 is already in use' instead"
metadata: 
  node_type: memory
  type: project
  originSessionId: 184f20c7-313f-457c-a9cb-e1f78fba99ec
  modified: 2026-09-18T19:47:34.455Z
---

Observed 2026-08-05: a Vite left over from an earlier session still held `:3000`. A fresh
`npm run dev` logged `Port 3000 is in use, trying another one…` and bound **:3001**, but the
Electron it launched still loaded `https://localhost:3000/presenter.html` — i.e. the *other*
server (`electron/protocolHelpers.ts` hard-codes the dev origin). Nothing in the UI or the
terminal flags the mismatch.

**FIXED 2026-09-18 (`EN-15`):** `vite.config.ts` sets
`server.strictPort: true`, so a busy `:3000` now stops the Vite half with
`Port 3000 is already in use` and `concurrently -k` takes `npm run dev` down with it — a loud
failure instead of an app on someone else's server. Measured the day of the fix with a
throwaway server built from the real config while `:3000` was held: before, it listened on
`:3001`; after, it was refused. The same day found TWO dev stacks from three days earlier
still alive on `:3001` and `:3002` — each had started into a taken `:3000` and slid along
unnoticed. They were stopped by pid, with the user's OK.

Knock-on: a restart of Vite (a `vite.config.ts` edit) re-listens on the CONFIGURED port, so
a stray server sitting on `:3001` would also try `:3000` and now exits instead of sliding.

**Why:** it silently invalidates verification work. If the stale server belongs to a different
branch or worktree, you are screenshotting the wrong code and every "verified live" claim is
wrong.

**How to apply:** if `npm run dev` dies with `Port 3000 is already in use`, find the owner —
`Get-NetTCPConnection -State Listen -LocalPort 3000` (Windows) or
`lsof -nP -iTCP:3000 -sTCP:LISTEN` then `ps -o pid,lstart,args -p <pid>` (macOS) — and decide
whether it is a live session's server (leave it, and use that session's app) or a leftover
(stop only its tree, by pid, and never by image name — [[dont-taskkill-all-electron]]).
Related: [[vite-dep-optimizer-504-restart]], [[build-kills-running-dev-app]].
