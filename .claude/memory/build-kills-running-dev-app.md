---
name: build-kills-running-dev-app
description: npm run build deletes electron-build/, which is the running dev app's own main entry — it kills the app
metadata:
  type: feedback
---

Never run `npm run build` (or `npm run electron:build`, or the full `npm run lint`, which
ends in `build`) while the dev app is up for chrome-devtools verification. `electron:build`
starts with `node extra-work/rmdir.mjs electron-build`, a recursive delete of
`electron-build/` — and `package.json`'s `"main"` is `./electron-build/electron/index.js`,
plus the preload scripts live there. The build pulls the running app's own code out from
under it; observed 2026-07-29, the dev stack exited (`npm run electron` → code 0, then
`concurrently -k` SIGTERM'd vite) within seconds of the final `npm run build`.

**Why:** CLAUDE.md asks for both a live chrome-devtools check and a green `npm run build`,
and those two collide. It looks like an unrelated crash — the app just disappears mid-session
with no error in the renderer console.

**How to apply:** order the work — do all live verification and state restoration FIRST, then
run the build/lint stages last. If you must build mid-session, expect to relaunch with
`env -u ELECTRON_RUN_AS_NODE npm run dev` afterwards and re-verify. Also check for a competing
stack before relaunching: `Get-CimInstance Win32_Process` sorted by `CreationDate` shows
whether someone else started `npm run dev`, and a fresh `local-storage` mtime (e.g.
`screen-ft-manager`) means the app is being actively driven — don't "restore" state on top of
a live session. Related: [[dev-hmr-stale-state-qa]].
