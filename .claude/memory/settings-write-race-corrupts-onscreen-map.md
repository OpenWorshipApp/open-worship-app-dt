---
name: settings-write-race-corrupts-onscreen-map
description: "unlocking()'s lockSet is per-renderer, so presenter and screen windows race the same settings file and corrupt it — all screens blank after reload"
metadata: 
  node_type: memory
  type: project
  originSessionId: deac06bb-7abf-4575-b053-ee4bfade133f
  modified: 2026-08-07T19:01:41.288Z
---

**Status: OPEN bug, observed live 2026-08-07** (robot run `20260807-1412`; report and the
corrupt/repaired file pair are in `test-results/robot-test/`).

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
   (`src/_screen/managers/ScreenVaryAppDocumentManager.ts` ~line 202): read map → add own
   key → `JSON.stringify` → write back. Nothing serialises that across processes.
2. **The write is non-atomic.** `appLocalStorage.setItem` → `fsWriteFileSync`
   (`src/server/fileHelpers.ts` ~line 559) writes in place with `flag: 'w'` — no
   write-to-temp + rename. A concurrent reader sees a partial file (the observed
   `Unterminated string in JSON at position 8192`); two concurrent writers interleave.

**Why it matters:** the amplifier is `deriveAppDocumentListOnScreen`'s outer `catch`
(`src/_screen/preview/screenPreviewerHelpers.ts`) returning `{}` — the caller then persists
that `{}` plus its own key, deleting every other screen's entry. Observed end state: after
the next reload all three mini screens blank, every `SL` clear-button outline, zero
`.app-on-screen` elements. Lyric slides make it easy to hit because the setting string is
~185 KB per presented lyric instead of ~835 bytes.

**How to apply:** don't treat a `SyntaxError` from `parseJsonSafely` in a screen or
presenter console as noise — it means the on-screen map is unreadable app-wide and the next
present will bake the loss in. Fix direction: atomic write (tmp + rename), and/or move
settings persistence to a single owner process (the `// TODO: Change to use SettingManager`
in `settingHelpers.ts` already anticipates this), and make the parse-failure path fail
closed rather than hand `{}` to a caller that is about to persist. Corrects the "no longer
explained by this path" advice in [[screen-onscreen-setting-all-or-nothing]]; related:
[[onscreen-setting-parse-amplification]], [[filesource-cache-sliding-ttl]].
