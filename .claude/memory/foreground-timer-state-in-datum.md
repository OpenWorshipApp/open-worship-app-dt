---
name: foreground-timer-state-in-datum
description: Countdown/stopwatch start-pause-reset state lives in the screen datum; timing-only changes update the clock in place
metadata:
  node_type: memory
  type: project
  originSessionId: f570286c-7c82-42ef-990f-e6fc474abbcc
  modified: 2026-10-04T11:52:00.817Z
---

The Foreground **Countdown** and **Stopwatch** go up STOPPED by default and are
driven by a Start / Pause / Resume / Reset row in their panels, with a per-session
**Auto-start** switch (2026-10-04, asked for by the user; W-09, PM-151/PM-152).

- **The state is in the screen DATUM**, never in a window: `pausedMillisecond`
  (the reading while stopped; negative = countdown overtime) and, for a duration
  countdown only, `durationMillisecond` (what Reset winds back to). Running =
  no `pausedMillisecond`, and `dateTime` is the zero a countdown reaches / a
  stopwatch counts from. The screen window and every mini preview draw from the
  same saved datum, so this is the only place a pause can live.
- **Every rule is in `src/_screen/managers/timerStateHelpers.ts`** (a leaf) —
  the clocks, the panels, run-sheet replay and the assistant all call it.
- **A countdown to a date & time is `fixed`**: no controls, always runs.
- **A timing-only change must not remount the clock** or it fades out and back
  in on the wall at every press: `genHtmlForeground{Countdown,Stopwatch}` return
  `handleUpdating`, `createDivContainer` stores it, and
  `ScreenForegroundManager.updateInPlace` (first thing in `compareAndRender`)
  hands the new datum over and re-keys the container map. Any other key change
  (style, layer, length) still remounts.
- **Rounding**: countdown rounds UP while counting down (no lead second needed;
  `00:00:00` lands exactly on time), DOWN in the overtime (zero holds one second,
  then `+00:00:01`). `TimerClockController` ticks with a second-aligned
  `setTimeout`, never per frame, and not at all while stopped.
- **Stopwatch history** (same day, PM-153): Reset saves the reading first into a
  per-session list (`stopwatchHistoryHelpers.ts`, one setting per session,
  newest first, capped at 20, under-a-second readings dropped). It is PANEL
  state, not screen data — the screen never shows it. The controls and the
  list live in `StopwatchTimerComp`, keyed by session because the setting is
  read once per mount.
- **Run-sheet rows**: `durationSecond` is still WRITTEN with the old +1
  (`COUNTDOWN_LEAD_SECOND`) and every reader subtracts it, so old and new rows
  agree. A row with no `isAutoStart` (saved before) starts at once.

**Why:** volunteers put the countdown up before the service and start it on the
cue; a press that blinked the clock on the projector would read as a glitch.

**How to apply:** a new way to start a countdown/stopwatch builds its timing
with `genCountdownTiming` / `genStopwatchTiming`; never compute the state from a
window's own copy. See [[infinite-paint-animation-at-rest]] for why the clock
must not tick per frame, and [[foreground-sync-shared-refs]] for the sync-group
data sharing the in-place re-key respects.
