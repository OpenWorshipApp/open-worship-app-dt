---
name: electron-icu-has-no-khmer
description: "Electron's ICU has no Khmer — Intl asked for km-KH answers in English silently, while Node (vitest) formats it fine"
metadata:
  node_type: memory
  type: project
  originSessionId: d1f4e05a-0b07-4227-b76c-7400bbaf5e18
  modified: 2026-10-06T22:15:29.387Z
---

Electron ships Chromium's trimmed ICU data, and Khmer is not in it.
`Intl.DateTimeFormat.supportedLocalesOf(['km-KH'])` is `[]` in the app, and
`new Date().toLocaleDateString('km-KH', …)` returns ENGLISH (`Oct 4`) with no
error. French is there. Node, which runs vitest, has full ICU and answers
`4 តុលា` — so a unit test of a Khmer date passes while the app shows English.

Measured 2026-10-06 with
`ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe -e "…"`
(same `icudtl.dat` as the renderer): `{"km":"Oct 4, 7:57 AM","supported":["fr-FR"]}`.

**Why:** the Stopwatch history's dates were fixed to pass the app's locale, the
test passed, and the Khmer panel still read `Oct 4, 7:57 AM`.

**How to apply:** any `toLocale*String` / `Intl.*Format` that must read in the
app's language has to check `supportedLocalesOf([locale])` and fall back — the
stopwatch history (`stopwatchHistoryHelpers.ts`) uses numbers only, day first,
24-hour (`04/10 07:57`). A test of it must mock `supportedLocalesOf` to `[]` to
be Electron; a test that only runs `km-KH` under Node proves nothing. Number
glyphs come from the app's own `toStringNum` / language data, never from Intl.
See [[tran-missing-key-throws-in-dev]].
