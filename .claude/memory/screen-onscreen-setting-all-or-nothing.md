---
name: screen-onscreen-setting-all-or-nothing
description: FIXED on refactor21 — the VARY_APP_DOCUMENT read now drops only invalid entries instead of the whole map
metadata: 
  node_type: memory
  type: project
  originSessionId: deac06bb-7abf-4575-b053-ee4bfade133f
  modified: 2026-08-07T19:01:21.908Z
---

**Status: FIXED (verified in source 2026-07-26, branch `refactor21`, uncommitted).**

`getAppDocumentListOnScreenSetting()` (`src/_screen/preview/screenPreviewerHelpers.ts`) used to
validate **every** entry of the persisted `VARY_APP_DOCUMENT` map and return `{}` if any single
one threw. Because `set varySlideData`
(`src/_screen/managers/ScreenVaryAppDocumentManager.ts`) does a read-modify-write on that map,
one bad entry silently dropped **every other screen's** presented slide from persisted state —
invisible in the mini-preview, surfacing only after a reload with that screen blank.

It now validates **per entry** via `checkIsValidOnScreenEntry()`, keeps the good ones, and calls
`handleError` with `'Dropping invalid on-screen slide entry for screen id: <key>'` for each bad
one — exactly the fix direction this note originally proposed.

**Why:** the original all-or-nothing read was observed live 2026-07-25; the trigger was never
isolated, but the code path was real. The 2026-07-26 robot-test run re-read the source and found
it corrected.

**How to apply:** a screen coming up blank after restart is no longer explained by *this*
path — but it IS still explained by its sibling. The per-entry guard sits inside a `try`
whose **outer `catch` still returns `{}`**, so a whole-file `JSON.parse` failure reproduces
the original all-or-nothing wipe exactly. That is not hypothetical: see
[[settings-write-race-corrupts-onscreen-map]], observed live 2026-08-07. Check the console
for a `SyntaxError` from `parseJsonSafely` **before** blaming the sync-group logic
([[screen-sync-group-echo-guard]], [[foreground-sync-shared-refs]]). If you see the
"Dropping invalid on-screen slide entry" error instead, that is the new guard working, and
the *entry's* origin is the bug to chase.
