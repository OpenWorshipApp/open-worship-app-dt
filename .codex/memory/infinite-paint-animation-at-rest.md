---
name: infinite-paint-animation-at-rest
description: An infinite CSS animation of a paint property keeps a whole window repainting at 60 fps while nobody touches it
metadata: 
  node_type: memory
  type: project
  originSessionId: 0d015ff8-b1ef-42dd-9018-0c29d243051c
  modified: 2026-09-18T23:48:04.920Z
---

An `infinite` CSS animation of a PAINT property (`color`, `border-color`,
`text-decoration-color`, `box-shadow`, `background`) on an element that stays
mounted makes Chromium repaint the element's whole paint layer every frame, for
as long as the window is open. It is invisible on a dev machine and shows up
only as idle CPU.

Measured 2026-09-15 on the dev app (owa-enhance run `20260915-1203`):

- **EN-09**: the noted-verse hint (`app-bible-note-verse-hint`, cycling
  `text-decoration-color`) on ONE marked verse number repainted the whole
  `bible-view-text` column (1092×2157 px). The idle Reader ran 235 paints/s and
  5.5 s/min of main-thread work, and 23 % of the main thread at 4× throttle.
  Capped at 3 cycles: 0 paints/s, 0.64 s/min.
- **EN-10**: the on-air pulse (`.app-highlight-selected.animation`, cycling
  `border-color`) on one slide card on a screen held the idle Presenter at
  59 frames/s and 22 paints/s. Capped at 3 cycles: 4 frames/s, 0 paints/s.
- **EN-19** (2026-09-18): the Mini Screen's show/hide icon
  (`.show-hide.showing .app-showing-indicator`, `app-live-blinking-amin`,
  cycling `color`) ran for as long as a screen was SHOWING, which is the whole
  service. Each frame repainted the icon and a full `#document`: the idle
  Presenter ran at a median of 60 frames/s, 120 paints/s and 60 style
  recalculations/s. It is now 3 `opacity` pulses and then a steady colour:
  8 / 17 / 12, with the icon at 0 paints. **EN-10 never saw it because it
  traced with the screen HIDDEN.** Trace the Presenter with a screen showing
  too, with the user's OK, since that lights a projector.

**Why:** the target machines are old church laptops, where 60 fps of style and
paint competes with the projector window and every keystroke.

**How to apply:** give such an animation a small iteration count and let it
end on its steady state, or animate `opacity`/`transform` on its own layer.
Prove it with an idle `performance_start_trace` (`reload: false`): count
`Paint` and `BeginMainThreadFrame` per second for the app renderer's pid. A
live check is `document.getAnimations().filter(a => a.playState === 'running')`,
which is empty at rest when the rule holds. OS CPU-seconds from `app-vitals.mjs`
are noisy while DevTools is open in dev (its Performance Monitor shares the GPU
process), so judge on the trace. Related: [[chatbot-cdp-driver-gotchas]] for why
tools can end up on a packaged app instead of the dev one.
