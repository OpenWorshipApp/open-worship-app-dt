---
name: dev-electron-hardcodes-port-3000
description: "Dev Electron always loads :3000, so a stale Vite there gets silently attached while your own npm run dev sits on :3001"
metadata: 
  node_type: memory
  type: project
  originSessionId: 184f20c7-313f-457c-a9cb-e1f78fba99ec
  modified: 2026-08-05T10:21:29.529Z
---

Observed 2026-08-05: a Vite left over from an earlier session still held `:3000`. A fresh
`npm run dev` logged `Port 3000 is in use, trying another one…` and bound **:3001**, but the
Electron it launched still loaded `https://localhost:3000/presenter.html` — i.e. the *other*
server. Nothing in the UI or the terminal flags the mismatch.

**Why:** it silently invalidates verification work. If the stale server belongs to a different
branch or worktree, you are screenshotting the wrong code and every "verified live" claim is
wrong. (In that session both servers served this same repo, so results held — but only by luck,
and it took a process/port check to establish.)

**How to apply:** when a run matters, confirm which process owns `:3000` before trusting the
window — `Get-NetTCPConnection -LocalPort 3000 -State Listen` then
`Get-CimInstance Win32_Process` for its cwd/start time. If the dev terminal ever prints
"Port 3000 is in use", stop and reconcile before testing. At cleanup, kill only your own tree
and leave the pre-existing server alone. Related: [[vite-dep-optimizer-504-restart]],
[[build-kills-running-dev-app]].
