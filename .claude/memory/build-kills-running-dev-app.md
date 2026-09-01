---
name: build-kills-running-dev-app
description: npm run build deletes electron-build/, which is the running dev app's own main entry — it kills the app, or else EPERMs on a loaded .dll and the build dies instead
metadata:
  type: feedback
---

Never run `npm run build` (or `npm run electron:build`, or the full `npm run lint`, which
ends in `build`) while the dev app is up for `owa-devtools` verification. `electron:build`
starts with `node extra-work/rmdir.mjs electron-build`, a recursive delete of
`electron-build/` — and `package.json`'s `"main"` is `./electron-build/electron/index.js`,
plus the preload scripts live there. The build pulls the running app's own code out from
under it; observed 2026-07-29, the dev stack exited (`npm run electron` → code 0, then
`concurrently -k` SIGTERM'd vite) within seconds of the final `npm run build`.

The collision has a **second outcome — Windows only** (file locking; on macOS unlink on an
open file succeeds, so the delete wins and the first outcome is what you get), seen
2026-08-12: on Windows the delete can simply FAIL —
`Error: EPERM: operation not permitted, unlink 'electron-build\db-exts\fts5.dll'` — because
the live app has that native module loaded and the OS locks the file. Then `rmdir.mjs` throws,
`electron:build` aborts, and it is the BUILD that dies while the app keeps running (CDP still
answers). Every earlier `npm run lint` stage — `test:all`, `lint:all:error`, `lint:pre`,
`lint:es`, `vite:build` — has already passed at that point, since the chain is `&&`, so a
renderer-only (`src/`) change is fully gated; only the `electron/**/*.ts` emit is missing, and
`lint:all:error`'s project-wide `tsc --noEmit` already typechecked that too.

**Why:** CLAUDE.md asks for both a live `owa-devtools` check and a green `npm run build`,
and those two collide. It looks like an unrelated crash — the app just disappears mid-session
with no error in the renderer console.

**How to apply:** order the work — do all live verification and state restoration FIRST, then
run the build/lint stages last, and read the log BODY: an EPERM on a `db-exts/*.dll` is the app
holding its own file, not a broken build, and re-running it needs the app closed rather than
any code fix. If you must build mid-session, expect to relaunch with
`env -u ELECTRON_RUN_AS_NODE npm run dev` afterwards and re-verify. Also check for a competing
stack before relaunching: `Get-CimInstance Win32_Process` sorted by `CreationDate` (Windows
only; macOS: `lsof +D electron-build` / `ps -o pid,lstart,args`) shows
whether someone else started `npm run dev`, and a fresh `local-storage` mtime (e.g.
`screen-ft-manager`) means the app is being actively driven — don't "restore" state on top of
a live session. Related: [[dev-hmr-stale-state-qa]].
