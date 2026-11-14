---
name: foreground-session-owns-overlay
description: "Every foreground session owns its own overlay on a screen: countdown, stopwatch, marquees and quick text are per-session LISTS, never one slot a second session's Show replaces"
metadata:
  node_type: memory
  type: project
  originSessionId: 48f87cdb-a654-4ed3-ba60-fe8d9c0afea3
  modified: 2026-11-10T00:16:57.163Z
---

The user, 2026-11-09: _each session of all foreground components should own
it's screen render, e.g. for quick-text, when I show `(ពគប) ម៉ាថាយ ៣:៣-` then
`Session 6` it should render both not override the showing one_. Until then
`ForegroundDataType` held ONE `countdownData` / `stopwatchData` /
`marqueeTopData` / `marqueeBottomData` / `quickTextData` per screen, and a
second session's Show took the first down. They are `…DataList` now, at most
one entry per session, keyed by the datum's `id` (`toSessionDataKey`: none
is the Default session's, which is also what a run-sheet row, a drag and the
assistant without a session write).

- **Show is `putSessionData`, Hide is `removeSessionData(key, datum)`**, both
  in `ScreenForegroundManager.ts`; `null` removes every session's entry --
  only for a Clear of the whole kind (F10, a run sheet's Clear FG <kind>, the
  assistant's stop of a component). The typed `set…Data(datum)` stayed as the
  put and takes no `null`, so a caller that meant "hide" no longer compiles.
- **A timer's Start / Pause stays in place inside the list**
  (`updateListInPlace` pairs the changed entry with the SAME session's mounted
  one before the diff) -- [[foreground-timer-state-in-datum]].
- **A quick text's time-to-live removes the exact entry it rendered**, and
  only while that entry is still up: a session shown again or restyled has a
  newer entry, which the old timer must not take down.
- **An older saved screen keeps what it showed**: `parseAllForegroundData`
  folds a single slot into its list; the run sheet's on-screen matchers read
  the saved map RAW (they run per row per screen event, memory
  [[onscreen-check-must-not-parse]]) and accept the old key too
  (`readSavedSessionList`).
- **Two sessions must have two ids**: `genMediaSessionId` was `s` + the
  millisecond, so two sessions the assistant made in one ask shared an id and
  the second Show replaced the first. It never goes at or below the last id
  the window made now, still `s<base36>` (`SESSION_ID_PATTERN` reads that).
- **Two sessions at the same place cover each other** -- the panels' default
  Properties are the same; the manual (W-09) tells the person to give each
  its own place. The Bible layer clears the TALLEST top marquee.
- Panels list one `[screenId, entry]` row per session entry
  (`getForegroundSessionShowingList`), so the strip's dot, the Hide row and a
  Properties restyle each act on their own session ([[foreground-sync-shared-refs]]).

**Why:** the user's call -- a verse band and a speaker's name, or two clocks,
are ordinary at once, and the slot made every session but one useless on air.

**How to apply:** a new per-session foreground kind goes into
`ForegroundSessionListKeyType` and its list, never a single slot; anything
that reads a saved foreground entry raw must accept both shapes. W-09, PM-175.
