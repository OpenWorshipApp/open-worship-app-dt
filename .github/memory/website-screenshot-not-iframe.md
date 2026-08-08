---
name: website-screenshot-not-iframe
description: Website canvas items and web backgrounds render a cached screenshot everywhere except the projected screen; the size travels in the markup because both fill-in points work on a detached div
metadata:
  type: project
---

A `website` canvas item and a `web` BACKGROUND no longer render a live `<iframe>`
anywhere except the **projected** screen. An iframe keeps its page's scripts, timers and
media running for as long as it is in the DOM, so a document full of website slides used
to run every one of them at once.

**Where each surface lands** (`hydrateWebsiteFrames` / `genWebBackgroundElement` in
`src/_screen/managers/screenWebsiteHelpers.ts`):

| Surface | Canvas item | Web background |
| --- | --- | --- |
| Editor canvas, Canvas Items, slide strip, presenter list, print | screenshot | n/a |
| Presenter MINI screen | screenshot, live after ~1s hover | screenshot, **no hover** |
| PROJECTED screen | live iframe, `pointer-events:none` | live iframe |

**Why:** [[onscreen-check-must-not-parse]] and CLAUDE.md's low-spec rule. This is the
camera item's contract (`CAMERA_ITEM_ATTR`) applied to the web.

## The things that will bite

- **The capture size travels in `WEBSITE_CAPTURE_SIZE_ATTR` (`"800x600"`), not from
  layout.** Both fill-in points — `cleanupSlideContent` and `printAppDocument` — run on a
  **detached** div, where every `offsetWidth` is 0. I lost a live-verification round to
  this: `offsetWidth` silently returned 0, `fillScreenShot` early-returned, and the mini
  screen sat on the globe fallback forever with no error. Stamping it also makes every
  surface hit ONE `captureWebScreenShot` cache entry instead of each spawning a hidden
  BrowserWindow.
- **The frame must be the ONLY hit target in the box.** Every descendant is
  `pointer-events: none`, and the frame itself deliberately is NOT (the old wrapper was,
  because an iframe swallows events — a plain div bubbles, so the box still drags). Add a
  badge inside without `pointer-events: none` and the bubbling `mouseover`/`mouseout` pair
  flaps forever. The `relatedTarget`-inside-frame guard is the second line of defence.
- **A web background gets no hover-to-live** — `ScreenBackgroundManager.containerStyle`
  makes the whole `#background` container `pointer-events: none`, so it never sees a
  pointer. Don't "fix" that by removing it.
- **`capturingHelpers` is imported dynamically** by `screenWebsiteHelpers`. It reaches
  React hooks + the settings chain + the display IPC, and a projected screen never needs
  it. A static import blows up several screen suites at module load and bloats every
  screen window. Consequence for tests: the shot lands a **macrotask** later, so
  `await Promise.resolve()` twice is not enough — use `setTimeout(…, 25)`.
- **`sanitizeHtml` is still a no-op stub.** When a real one lands it MUST allowlist
  `data-website-*` and `data-camera-*`, or both item kinds silently stop hydrating with no
  error anywhere.
- The screenshot never self-invalidates — a clock page stays frozen. The only escape is
  the website box's **Refresh Preview** context item (`refreshWebCapturing`), which is
  website-only (a youtube item shares the `url` prop but renders a real embed).

## Capture cost controls (in `src/helper/capturingHelpers.ts`)

Capturing is NOT free — each one opens a hidden BrowserWindow, loads the page and sleeps
3s. Three guards make screenshot-everywhere cheaper than the iframes it replaced, and
removing any one of them makes it worse than before:

1. An `IntersectionObserver` gate (`isEnabled`) so off-screen thumbnails never capture.
2. A **concurrency cap of 2**, hand-rolled. Do NOT use `unlocking` for this — its waiters
   poll every 100ms and after 60s it gives up, logs an `appError` and runs the callback
   **concurrently with the lock holder** anyway.
3. A **total-size** cache budget (~6M chars) instead of the old 3-entry count cap, which
   was the thrash trigger once more than 3 distinct urls existed.
