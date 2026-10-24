---
name: presenting-flow-onscreen-marking-design
description: "The presenting flow tree marks live rows through ONE shared screen subscription with a shared debounce — per-row useScreenUpdateEvents blew up with \"Maximum update depth exceeded\""
metadata:
  node_type: memory
  type: project
  originSessionId: 829e5085-b5de-4acc-939c-409012ccdd19
  modified: 2026-10-02T20:17:53.115Z
---

`src/presenting-flow/presentingFlowOnScreenHelpers.ts` deliberately does NOT use
`useScreenUpdateEvents` per row. That hook fans out into seven subscriptions, each with
its own `useState`; with a document expanded to ~90 slide rows a single "slide went on
screen" produced ~650 state updates and React answered with **Maximum update depth
exceeded**, stalling the very present the operator asked for.

Instead: one module-level `Set` of subscribers + `useSyncExternalStore` per row, so a row
re-renders only when ITS OWN answer flips. Three rules that look wrong out of context:

- **A single SHARED `genTimeoutAttempt(500)` is correct here**, contrary to CLAUDE.md's
  per-instance-timer rule: one debounced pass refreshes EVERY subscriber, so no row is
  left stale by another row's activity.
- `refreshOnScreenAfterPresenting()` hops a macrotask (`setTimeout(…, 0)`) and then calls
  the timer with `isImmediate` — the clicked row confirms itself at once AND cancels the
  debounced pass the same screen event scheduled, so the walk happens once, not twice.
- `checkIsAnythingOnScreen()` is the idle gate: four setting reads, and with nothing
  presenting no presenting flow file is opened at all. It is checked once by the two callers,
  never per file.

Preset matching: marquee and message rows match on TEXT (every message up, not the
first of the same length), `time`/`camera` on id, `web`/`video`/`image` on filePath.
**Countdown / stopwatch / quick-text match on a ROW KEY** (2026-10-02): the screen keeps
nothing of the row (a countdown's time is worked out at show time, a quick text holds
rendered html), so `applyForegroundDragData` stamps `rowKey = toForegroundRowKey(data)` on
what it puts up and the matcher compares it. They used to match "that slot is occupied",
which lit every countdown row while ANY countdown was up, the panel's own included — the
same "status for something that is not on the screen" defect as a session's Hide row
listing another session's overlay. A panel-started one carries no key and lights no row.
`foregroundOnScreenMatcherMap` is keyed by `ForegroundDragTargetType` on purpose — a new
foreground widget becomes a compile error rather than a row that silently never marks.

See [[onscreen-check-must-not-parse]] (never call `getSlides()` from a check) and
[[presenting-flow-references-vs-presets]].
