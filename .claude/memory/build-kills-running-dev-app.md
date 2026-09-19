---
name: build-kills-running-dev-app
description: "npm run build deletes electron-build/, which is the running dev app's own main entry — it kills the app, or else EPERMs on a loaded .dll and the build dies instead. npm run lint no longer builds there (2026-09-18) and is safe beside the app"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ef615b0c-6dec-4fb2-a7a3-11bb0c49dfff
  modified: 2026-09-18T17:36:10.968Z
---

Never run `npm run build` (or `npm run electron:build`, `npm run test:e2e`, or a
`pack:*`) while the dev app is up for `owa-devtools` verification. `electron:build`
starts with `node extra-work/rmdir.mjs electron-build`, a recursive delete of
`electron-build/` — and `package.json`'s `"main"` is `./electron-build/electron/index.js`,
plus the preload scripts live there. The build pulls the running app's own code out from
under it; observed 2026-07-29, the dev stack exited (`npm run electron` → code 0, then
`concurrently -k` SIGTERM'd vite) within seconds of the final `npm run build`.

**`npm run lint` is NOT in that list any more** (2026-09-18, `EN-16`). It used to end in
`npm run build` and start with `prettier --write`, so it either killed the app or was run
in pieces with the build "left to the operator" (`MC-29`) — and the piece left out was the
only place `electron/` was typechecked. The gate now only CHECKS: `lint:all:error` runs
`tsc -p electron.tsconfig.json --noEmit` beside the `src` typecheck, prettier is `--check`
(`npm run format` writes), and `lint:build` builds into a temp dir that it deletes
(`extra-work/check-build.mjs`). Run it whenever, app up or not.

The collision has a **second outcome — Windows only** (file locking; on macOS unlink on an
open file succeeds, so the delete wins and the first outcome is what you get), seen
2026-08-12: on Windows the delete can simply FAIL —
`Error: EPERM: operation not permitted, unlink 'electron-build\db-exts\fts5.dll'` — because
the live app has that native module loaded and the OS locks the file. Then `rmdir.mjs` throws,
`electron:build` aborts, and it is the BUILD that dies while the app keeps running (CDP still
answers).

**Correction (2026-09-18):** this note used to say `lint:all:error`'s `tsc --noEmit` had
"already typechecked" `electron/**/*.ts`. It had not — `tsconfig.json` includes `src` alone
and nothing in `src/` imports `electron/`, so `--listFilesOnly` listed 0 electron files. A
session that skipped the build had shipped electron code no compiler had read. The electron
test files (`electron/**/*.test.ts`) are still in NO typecheck: `electron.tsconfig.json`
excludes them, and a scratch config found 10 errors in them (`EN-14`, the optional half).

**Why:** CLAUDE.md asks for a live `owa-devtools` check, and the packaging build still
deletes that app's own files. It looks like an unrelated crash — the app just disappears
mid-session with no error in the renderer console.

**How to apply:** `npm run lint` any time. For a real `build`, order the work — do all live
verification and state restoration FIRST, then build, and read the log BODY: an EPERM on a
`db-exts/*.dll` is the app holding its own file, not a broken build, and re-running it needs
the app closed rather than any code fix. If you must build mid-session, expect to relaunch with
`env -u ELECTRON_RUN_AS_NODE npm run dev` afterwards and re-verify. Also check for a competing
stack before relaunching: `Get-CimInstance Win32_Process` sorted by `CreationDate` (Windows
only; macOS: `lsof +D electron-build` / `ps -o pid,lstart,args`) shows
whether someone else started `npm run dev`, and a fresh `local-storage` mtime (e.g.
`screen-ft-manager`) means the app is being actively driven — don't "restore" state on top of
a live session. Related: [[dev-hmr-stale-state-qa]], [[dev-electron-hardcodes-port-3000]].
