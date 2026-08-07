---
name: playlist-onscreen-marking-design
description: The playlist tree marks live rows through ONE shared screen subscription with a shared debounce — per-row useScreenUpdateEvents blew up with "Maximum update depth exceeded"
metadata:
  type: project
---

`src/playlist/playlistOnScreenHelpers.ts` deliberately does NOT use
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
  presenting no playlist file is opened at all. It is checked once by the two callers,
  never per file.

Preset matching is inherently imprecise and that is accepted: marquee rows match on TEXT,
`time`/`camera` on id, `web` on filePath, but **countdown / stopwatch / quick-text can
only match "that slot is occupied"**, so all rows of that kind mark while any one is live.
`foregroundOnScreenMatcherMap` is keyed by `ForegroundDragTargetType` on purpose — a new
foreground widget becomes a compile error rather than a row that silently never marks.

See [[onscreen-check-must-not-parse]] (never call `getSlides()` from a check) and
[[playlist-references-vs-presets]].
