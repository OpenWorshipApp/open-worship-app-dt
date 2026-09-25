---
name: settings-write-race-corrupts-onscreen-map
description: "FIXED 2026-09-24 (EN-38): projector windows raced the Presenter on the on-screen maps; now only non-screen windows write, an unreadable map is rebuilt from the Presenter's managers, and setItem is atomic"
metadata: 
  node_type: memory
  type: project
  originSessionId: deac06bb-7abf-4575-b053-ee4bfade133f
  modified: 2026-09-24T17:25:00.000Z
---

**Status: FIXED 2026-09-24 (`EN-38`).** What shipped, and what must stay true:

- `persistOnScreenEntry` (`src/_screen/managers/onScreenSettingPersistHelpers.ts`)
  is the ONE save for the slide, background, Bible and foreground maps. It never
  writes from `screen.html` (`checkIsOnScreenSettingWriter`), and neither does
  `saveScreenManagersSetting`. A new screen layer or setter that persists a
  whole-screens map must go through it — a bare `unlocking(...) + setSetting`
  in a manager setter reopens this bug, because those setters also run in the
  projector on every sync.
- A map that reads back EMPTY while the file holds more than `{}` is rebuilt in
  the Presenter from its live managers (`collectLive`); in any other window the
  save is skipped. It is never saved as `{}` + one key.
- `appLocalStorage.setItem` → `fsWriteFileAtomicSync` (hidden
  `.<key>.<random>.tmp` + `renameSync`, 5 tries, then in-place). Windows refuses
  the rename while another process has the target open, which is why the
  single writer, not the rename, is the real fix.
- Proven live: 2 screens showing, 6 presents, 0 of 5 707 watcher reads
  unparseable, both screens kept their own slide across a real reload. Ctrl+R
  over CDP did NOT reload the Presenter while screens were up — check
  `performance.timeOrigin` or use `Page.reload` before calling a reload proven.

The original report follows.

**Was OPEN, observed live 2026-08-07** (robot run `20260807-1412`; report and the
corrupt/repaired file pair were in `test-results/robot-test/` and have since been pruned —
the source evidence is the in-tree code below, all still verifiable).

Showing a screen (an ordinary `F5`) left
`open-worship-data-dev\local-storage\screen-vary-app-document-manager` structurally corrupt:
325,099 chars where the first complete JSON object ends at index 102,635 holding only key
`"0"`, followed by 222,463 bytes of the previous write's tail holding `"1"` and `"2"`. A
102 KB single-screen write landed on top of a 325 KB three-screen write and the loser's
tail outlived the winner's closing brace.

Two defects compound:

1. **`unlocking()` is per-renderer.** `src/server/unlockingHelpers.ts` guards with a
   module-level `const lockSet = new Set<string>()`. The presenter and every
   `screen.html?screenId=N` are separate processes, and each runs the same
   read-modify-write on the same file in `set_varySlideData`
   (`src/_screen/managers/ScreenVaryAppDocumentManager.ts` ~line 258): read map → add own
   key → `JSON.stringify` → write back. Nothing serialises that across processes.
2. **The write is non-atomic.** `appLocalStorage.setItem` → `fsWriteFileSync`
   (`src/server/fileHelpers.ts:663-668`) writes in place with `flag: 'w'` — no
   write-to-temp + rename. A concurrent reader sees a partial file (the observed
   `Unterminated string in JSON at position 8192`); two concurrent writers interleave.

**Why it matters:** the amplifier is `deriveAppDocumentListOnScreen`'s outer `catch`
(`src/_screen/preview/screenPreviewerHelpers.ts`) returning `{}` — the caller then persists
that `{}` plus its own key, deleting every other screen's entry. Observed end state: after
the next reload all three mini screens blank, every `SL` clear-button outline, zero
`.app-on-screen` elements. Lyric slides make it easy to hit because the setting string is
~185 KB per presented lyric instead of ~835 bytes.
`getAppDocumentListOnScreenSetting()` now returns a shallow copy each call
(`screenPreviewerHelpers.ts:148-150`, with a why-comment) — hardens the in-process case
but does nothing about the cross-process race, which is this note's point.

**How to apply:** don't treat a `SyntaxError` from `parseJsonSafely` in a screen or
presenter console as noise — it means the on-screen map is unreadable app-wide and the next
present will bake the loss in. Fix direction: atomic write (tmp + rename), and/or move
settings persistence to a single owner process (the `// TODO: Change to use SettingManager`
in `settingHelpers.ts` already anticipates this), and make the parse-failure path fail
closed rather than hand `{}` to a caller that is about to persist. Corrects the "no longer
explained by this path" advice in [[screen-onscreen-setting-all-or-nothing]]; related:
[[onscreen-setting-parse-amplification]], [[filesource-cache-sliding-ttl]].
