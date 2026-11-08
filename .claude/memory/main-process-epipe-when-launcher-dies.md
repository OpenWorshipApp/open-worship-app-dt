---
name: main-process-epipe-when-launcher-dies
description: "\"A JavaScript error occurred in the main process … EPIPE: broken pipe, write\" = the dev launcher (nodemon) died while the app stayed up; guarded since 2026-11-07"
metadata:
  node_type: memory
  type: project
  originSessionId: 0640f31a-a265-4c17-8535-3c7f809510ad
  modified: 2026-11-08T01:59:04.624Z
---

The dialog _A JavaScript error occurred in the main process — Uncaught
Exception: Error: EPIPE: broken pipe, write … at console.log …
ElectronSettingManager_ means the dev app's launcher went away while the app
kept running: under `npm run dev` / `electron:dev`, Electron's main process
runs under `electron/cli.js` started by nodemon (`electron:watch`); when
nodemon (or the terminal) is gone, stdout leads into a closed pipe and the
next `console.log` (a settings save's `Setting saved`) raises EPIPE on the
stream. With no listener that was an uncaught exception, and the main
process stopped on the dialog — every window, the MCP door and the CDP door
with it (the dev app "is not responding" to owa tools).

**Why:** seen 2026-11-07 while two agent sessions drove one dev app; the
watcher chain was dead (no nodemon, no `electron:build:watch`) and the app
was left orphaned.

**How to apply:** fixed in code by `guardBrokenPipes` (`electron/
stdioGuardHelpers.ts`, first line of `main()` in `electron/index.ts`):
EPIPE / a destroyed stream on stdout or stderr is ignored, anything else
still throws. It only takes effect after a relaunch (memory
[[main-process-change-needs-relaunch]]). If the dialog appears on an app
started before that change, the person presses OK and starts `npm run dev`
again (with `ELECTRON_RUN_AS_NODE` unset) — and no watcher is compiling
`electron/` until they do. Do not kill the user's Electron processes to
"fix" it.
