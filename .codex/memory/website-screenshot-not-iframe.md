---
name: website-screenshot-not-iframe
description: Website canvas items and web backgrounds render a cached screenshot everywhere except the projected screen; the size travels in the markup because both fill-in points work on a detached div
metadata:
  node_type: memory
  type: project
  originSessionId: 8f6440db-baaf-4737-9c9f-46b8d9947cbe
  modified: 2026-09-24T21:53:42.443Z
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
- A REMOTE screenshot never self-invalidates — a clock page stays frozen. The only escape
  is the website box's **Refresh Preview** context item (`refreshWebCapturing`), which is
  website-only (a youtube item shares the `url` prop but renders a real embed). A `file:`
  page is the exception: its key carries its own md5 (below), so editing it in the app's
  own web editor invalidates the shot by itself.

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
4. **A local file is cached by the md5 of its own bytes, and that shot does not expire**
   (2026-09-24, asked for by the user: *web capturing should cached with file md5 (if a
   file)* — *to improve performance*). There are two cache managers now. The ten-second
   one is for a page that can change with nothing here to observe it. A `file:` url —
   every page in the Webs panel, every Foreground **Web Show** tile, every website item
   dragged off one — keys as `<url>-<md5>-<w>-<h>-<delay>` into a manager with **no
   expiry**, because an entry that is still there is still right and dropping it buys
   nothing but another hidden window and another three seconds, paid again on every tab
   switch, panel re-open and remounted tile. Peak memory is unchanged: both managers
   share the one byte budget above and evict oldest-first.
   - The md5 is memoised against a **stat** (path + size + mtime, 10s) so a panel of
     tiles reads the file once, not once per tile — mtime is only the memo, never the
     identity, because a file restored from a backup has new mtime and the same bytes.
   - `fileHelpers` is imported **lazily** there, and only for a `file:` url: a static
     import puts the whole file/mime layer back into the graph that
     `screenWebsiteHelpers` lazily imports this module to avoid, and it cascades through
     unrelated test mocks.
   - Stale shots of a file are dropped **by md5, not by key** (`dropStaleCachedScreenshots`)
     — one file is legitimately cached at several box sizes at once, and dropping the
     siblings of the size being captured re-creates the eviction thrash guard 3 fixed.
   - `capturingHelpers.test.ts` pins the semantics against the REAL `CacheManager`;
     `domHelpers.test.tsx` stubs it with a TTL-free map, so the expiry difference cannot
     be shown there.
