# HTML-in-Canvas — research for slide animation

Research date: **2026-07-25**. Everything marked ✅ **verified** was measured
locally against this repo's own Electron (`electron@43.1.1` →
**Chromium 150.0.7871.114**, Windows 11, dpr 1.5) with a throwaway probe app.
Claims taken from the spec but not exercised locally are marked 📄 **spec**;
things I could not settle are marked ❓ **open**.

Upstream: <https://html-in-canvas.dev/> · <https://github.com/WICG/html-in-canvas>

---

## 1. TL;DR for the slide-animation idea

- The API **works today in our Electron**, behind a command-line switch. No
  origin-trial token needed, no Electron upgrade needed. ✅
- It is a **capture/composite primitive, not an animation system**. It gives you
  "render this live DOM subtree into a canvas right now". Everything about
  _motion_ you write yourself, in canvas space. ✅
- The single most important rule: **CSS `transform` on the drawn element is
  ignored, and `transform`/`opacity` _animations_ on it are invisible to the
  canvas.** Our existing transition effects (`transitionEffectHelpers.ts`) are
  built exactly out of those two properties, so they do **not** port over
  as-is — they have to be re-expressed as canvas math. ✅
- **Nested animation works, but not via nested canvases** (those throw). The
  model is: one canvas, every canvas-item as a _direct child_, each drawn
  separately with its own transform/alpha → independent per-item animation.
  Animation _inside_ an item is ordinary CSS on descendants, which does render
  and does invalidate at 60 fps. ✅
- Steady-state performance at 1920×1080 is fine (60 fps) for every pattern we
  tried, but the **first** run of an animation pattern hitches. Pre-warm before
  the first transition of a service. ✅
- Functional gap to plan for: **cross-origin iframes draw blank**, which is our
  `website` and `youtube` canvas-item types — recoverable three ways: drop the
  frame (resolve the YouTube URL to its direct stream with the `yt-dlp` we
  already ship and play it in a `<video>`, which the draw _does_ capture),
  mirror the real player's pixels out of the frame with Element/Region Capture,
  or keep it in a DOM overlay layer driven by the draw matrix (§8.3). ✅

Verdict: viable and interesting for slide/canvas-item animation, but it is a
rewrite of the effect layer, not a swap-in. It is also single-vendor and
flag-gated — anything built on it needs feature detection and a DOM fallback.

---

## 2. Availability & how to turn it on

|                                             |                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Chromium in `electron@43.1.1`               | `150.0.7871.114` ✅                                                                    |
| Enabled by default                          | **No** — `drawElementImage` is undefined and `layoutsubtree` children get no layout ✅ |
| `--enable-blink-features=CanvasDrawElement` | **Works** ✅                                                                           |
| `--enable-features=CanvasDrawElement`       | **Works** (either switch alone is enough) ✅                                           |
| Browser equivalent                          | `chrome://flags/#canvas-draw-element` (Chromium 147+) 📄                               |
| Chrome origin trial                         | M148–M151 📄                                                                           |
| Firefox / Safari                            | no commitment to implement 📄                                                          |

To try it in the app, add one line next to the existing switch in
[electron/index.ts:41](electron/index.ts#L41):

```ts
app.commandLine.appendSwitch('enable-blink-features', 'CanvasDrawElement');
```

It must be appended **before** `app.whenReady()`, like the existing
`ignore-certificate-errors` call. Always feature-detect in renderer code:

```ts
const isHtmlInCanvasSupported =
  'drawElementImage' in CanvasRenderingContext2D.prototype;
```

---

## 3. API surface actually present in Chromium 150 ✅

Feature-detected and exercised:

```ts
<canvas layoutsubtree>…</canvas>          // attribute; reflected as canvas.layoutSubtree

ctx.drawElementImage(el, dx, dy)                                  // → DOMMatrix
ctx.drawElementImage(el, dx, dy, dw, dh)
ctx.drawElementImage(el, sx, sy, sw, sh, dx, dy, dw, dh)          // verified
ctx.drawElementImage(elementImage, dx, dy)                        // snapshots too

canvas.requestPaint()                     // fire one paint event (rAF-like)
canvas.captureElementImage(el)            // → ElementImage {width, height, close()}
canvas.getElementTransform(el, drawnMatrix)  // → DOMMatrix for el.style.transform
canvas.onpaint = (e) => { e.changedElements /* FrozenArray<Element> */ }

WebGLRenderingContext.prototype.texElementImage2D                 // present, untested ❓
OffscreenCanvasRenderingContext2D.prototype.drawElementImage      // present, untested ❓
globalThis.ElementImage                                           // constructor exists
```

Notes:

- The method is **`drawElementImage`**. The older name `drawElement` you'll see
  in blog posts is **not** present in Chromium 150. ✅
- There is no `PaintEvent` global. ✅
- `ElementImage` is **device-pixel sized**: a 1920×1080 element captured at
  dpr 1.5 yields 2880×1620. ✅

---

## 4. Verified behavior (the rules you have to design around)

### 4.1 Draw constraints

| Situation                                                           | Result                                                                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Element is a direct child of the canvas                             | draws ✅                                                                                                                                                        |
| Element is a _grandchild_                                           | `InvalidStateError: Only immediate children of the <canvas> element can be passed to DrawElementImage.` ✅                                                      |
| `<canvas layoutsubtree>` inside a canvas child                      | `NotSupportedError: Nested canvases are not supported.` ✅                                                                                                      |
| `display: none` child                                               | `InvalidStateError: No cached paint record for element.` ✅                                                                                                     |
| Drawing before the first rendering update                           | same "No cached paint record" error — **draw from `onpaint` or after a rAF** ✅                                                                                 |
| Child much bigger than the canvas (1920×1080 into a 192×108 canvas) | draws **in full**, all four corners present — no viewport culling of the subtree ✅                                                                             |
| Drawing after `elementImage.close()`                                | `InvalidStateError: The ElementImage has been closed.` ✅                                                                                                       |
| Drawing an `ElementImage` into a _different_ canvas                 | `…The source was captured from a different canvas.` — snapshots are bound to their capturing canvas ✅                                                          |
| Backing store bigger than the CSS box (a hi-dpi canvas)             | the element rasterizes at the **backing/CSS density on its own** — scale slide space from `clientWidth`, not `canvas.width`, or the density is applied twice ✅ |

### 4.2 The source subtree must be _painted_, not necessarily _visible_

This decides whether you can stage/pre-render the next slide offscreen. Tested
by wrapping the canvas in a container with each style:

| Staging technique                                     | Result                              |
| ----------------------------------------------------- | ----------------------------------- |
| `overflow:hidden` 1×1 parent, full-size canvas inside | **draws in full** (2,073,600 px) ✅ |
| covered by an opaque `<div>`                          | **draws** ✅                        |
| `z-index: -1`                                         | **draws** ✅                        |
| `left: -6000px` (out of viewport)                     | silently **empty**, no throw ⚠️ ✅  |
| `transform: translateX(-7000px)`                      | silently **empty** ⚠️ ✅            |
| `opacity: 0`                                          | silently **empty** ⚠️ ✅            |
| `clip-path: inset(100%)`                              | silently **empty** ⚠️ ✅            |
| `visibility: hidden`                                  | **throws** (no paint record) ✅     |
| `content-visibility: hidden`                          | **throws** ✅                       |

So the staging recipe is: keep the canvas at the viewport origin and hide it by
**clipping it to 1×1 or covering it** — never by moving, hiding or fading it.
The silent-empty cases are the dangerous ones: no exception, just a blank frame.

### 4.3 Layout & interaction of canvas children

- Children are laid out but **never painted into the page** — confirmed by
  screenshotting the probe window: only drawn canvas output was visible. ✅
- **All direct children are placed at the canvas's content origin and stack**;
  `position:absolute; left:500px; top:200px` on a direct child is neutralized
  (measured rect `[0, 0, w, h]` for every child). You position items at _draw_
  time via `ctx.translate`. ✅
- **Children live in the canvas's CSS-pixel space, not its backing store.** Two
  consequences, both measured:
  - Percentages resolve against the CSS box. A canvas with
    `width=1920 height=1080` displayed at 481×271 CSS px gave a
    `width:100%; height:50%` child a box of **480×135**.
  - `dx`/`dy` are ordinary backing-store coordinates, but the drawn element's
    **size is multiplied by backing ÷ CSS size**, so it rasterizes at the
    canvas's device resolution. On a canvas with an 800×400 backing store shown
    at 400×200, a 100×50 child drew as **200×100**; at 400×200 backing / 800×400
    CSS the same child drew as **50×25**. `ctx.scale()` composes with that
    factor, and passing explicit `dw`/`dh` overrides it exactly.

  So the ratio behaves as an automatic devicePixelRatio for element draws —
  free crispness, but it silently changes geometry if you assume 1:1. To author
  slides in 1920×1080 units, give the canvas a **CSS size** of 1920×1080 (with
  a larger backing store for HiDPI) and scale the canvas element itself; or
  always pass explicit `dw`/`dh`. ✅

- Draw order is painter's order — later draw wins. ✅
- Children participate in **hit testing** at their DOM position; assigning
  `el.style.transform = canvas.getElementTransform(el, drawnMatrix)` moves the
  hit area onto the drawn position (verified: `elementFromPoint` at the drawn
  spot returns the child). ✅
- **`getElementTransform` is only correct for an unscaled draw.** Measured on
  two element sizes (180×60 and 1920×1080) at scale 1, 0.5 and 0.25: it returns
  exactly **twice** the translation `drawElementImage` returned — it applies the
  centre-origin correction a second time — so the element lands
  `(1 − scale) × its own size` away under any `transform-origin`. What is exact
  is the **matrix `drawElementImage` itself returns, assigned to the element's
  `style.transform` with the default (centre) `transform-origin`**: the element
  then covers its drawn pixels to the pixel, at every scale. At scale 1 both
  agree, which is why the hit-testing result above holds. It also throws
  `InvalidStateError` for anything that is not an immediate child. ✅
  (`youtubeDemo.tsx#YouTubeOverlayComp`)

### 4.4 What renders and what silently doesn't

| Inside the drawn subtree                                                          | Rendered?                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text, web fonts, complex scripts (Khmer / Arabic / CJK), `text-shadow`, gradients | yes ✅                                                                                                                                                        |
| `backdrop-filter`                                                                 | **yes** — `invert(1)` over red gave exact cyan ✅                                                                                                             |
| Static `opacity` on the drawn root                                                | **yes** (0.3 → alpha 77) ✅                                                                                                                                   |
| Static `transform` on the drawn root                                              | **no — ignored** (spec-mandated) ✅                                                                                                                           |
| `transform`/`opacity` **animation** on the drawn root                             | **no**, and it does **not** fire `paint` (compositor-driven) ✅                                                                                               |
| Any animation on a **descendant** (background-color, opacity, transform)          | **yes**, and fires `paint` at ~60 fps ✅                                                                                                                      |
| A plain (non-`layoutsubtree`) `<canvas>` being JS-animated inside the subtree     | **yes**, live; 6/6 distinct frames, 39 paint events in ~600 ms ✅                                                                                             |
| `<video>` playing inside the subtree                                              | **yes** — drawn frames matched a `drawImage(video)` control, and paint fired at the video's frame rate (15 events / 1.4 s for a 10 fps clip) ✅               |
| Same-origin `<iframe>` (`srcdoc`)                                                 | **yes** ✅                                                                                                                                                    |
| **Cross-origin `<iframe>`**                                                       | **blanked to the parent background, no throw** ✅                                                                                                             |
| A real YouTube embed (`/embed/<id>?rel=0&enablejsapi=1`)                          | **blank** — the centre pixel of the drawn player read back exactly the colour painted behind it; the canvas is _not_ tainted, `getImageData` keeps working ✅ |
| The same YouTube video as a **direct stream** in a `<video>` (`yt-dlp -g`)        | **yes** — same slide, same box, real frames in the canvas at the video's own paint rate, and the readback still works with `crossOrigin="anonymous"` ✅       |
| The YouTube **player itself, mirrored** into a `<video>` (Element/Region Capture) | **yes** — the cross-origin frame's own pixels, drawn in the canvas; needs a `getDisplayMedia` handler in main and a stacking-context target (§8.3) ✅         |
| Animated GIF                                                                      | ❓ not verified — my generated GIF didn't animate even in the plain `drawImage` control, so the test was inconclusive                                         |
| System colors/themes, spellcheck marks, visited links, autofill, subpixel AA      | excluded by spec ("read-back-allowed rendering") 📄                                                                                                           |

### 4.5 The `paint` event

- Fires when a canvas child's rendering changes; `e.changedElements` lists the
  **direct child**, not the descendant that actually changed. ✅
- Only fires for children that have a **cached paint record** — i.e. one you
  have already drawn. An element you never draw never invalidates. ✅
- `requestPaint()` calling itself from `onpaint` sustains **~62 fps**, so it can
  be used as the animation clock instead of `requestAnimationFrame`. ✅
- Descendants fire before ancestors (reverse tree order); DOM changes made
  inside `onpaint` land in the _next_ frame, canvas draws land in the current
  one. 📄

---

## 5. Animating & transitioning HTML DOM through canvas

Three models, in order of how much they buy us.

### Model A — animate in canvas space (whole-slide transitions)

The DOM stays still; the _drawing_ moves. This is the only way to move/scale/
fade a whole drawn element, because its own CSS transform is ignored.

```ts
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const incoming = document.getElementById('slide-next')!;
const outgoing = canvas.captureElementImage(
  document.getElementById('slide-current')!,
); // freeze the old frame

const start = performance.now();
const DURATION = 500;

const step = (now: number) => {
  const k = Math.min(1, (now - start) / DURATION);
  ctx.reset();

  ctx.globalAlpha = 1 - k; // fade out the frozen old slide
  ctx.drawElementImage(outgoing, 0, 0);

  ctx.globalAlpha = k; // zoom + fade in the live new slide
  ctx.save();
  ctx.translate(960, 540);
  ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  ctx.translate(-960, -540);
  ctx.drawElementImage(incoming, 0, 0);
  ctx.restore();

  ctx.globalAlpha = 1;
  if (k < 1) requestAnimationFrame(step);
  else outgoing.close(); // release the snapshot
};
requestAnimationFrame(step);
```

What this unlocks that CSS can't do as cleanly:

- **`ctx.clip()` wipes/reveals** — arbitrary path reveals of real HTML.
- **`ctx.filter`** — `blur()`, `brightness()`, etc. applied to a live DOM subtree.
- **WebGL** via `texElementImage2D` — page-curl, dissolve, particles, 3D.
- **A frozen outgoing slide.** Today `render()` in
  [ScreenVaryAppDocumentManager.ts:890](src/_screen/managers/ScreenVaryAppDocumentManager.ts#L890)
  keeps the old slide's DOM mounted and animates it out (`animOut` then
  `child.remove()`), so two full slide trees — including videos and YouTube
  players — are live at once for the whole transition. An `ElementImage` is
  just pixels, so the old tree can be torn down immediately. That is a direct
  memory/CPU win on weak machines.

### Model B — CSS animation inside the drawn subtree (parts of a slide)

Animations on **descendants** render and invalidate at 60 fps. So this works:

```html
<canvas layoutsubtree>
  <div id="text-item">
    <!-- drawn root: don't animate this -->
    <span class="word-in">Amazing</span>
    <!-- CSS keyframes here: fine -->
  </div>
</canvas>
```

and the canvas just needs to redraw when told:

```ts
canvas.onpaint = () => {
  ctx.reset();
  ctx.drawElementImage(textItem, x, y);
};
```

The trap: **never put the animated `transform`/`opacity` on the drawn root
itself** — it will animate on screen in the DOM's own compositor world and be
completely invisible in the canvas, with no paint events either. Always wrap.

### Model C — snapshots as transition state

`captureElementImage()` freezes a child's pixels; the DOM is then free to change
underneath. Constraints: same canvas only, device-pixel sized, `close()` it.
Useful for A/B transitions, "hold last frame while the next slide loads", and
undo-style visual diffing.

---

## 6. Nested animation — animating one canvas-item

This maps onto our model better than expected.

**Do this — flatten items into direct children:**

```html
<canvas layoutsubtree width="1920" height="1080">
  <div data-item-id="1">…background image item…</div>
  <div data-item-id="2">…text item…</div>
  <div data-item-id="3">…bible item…</div>
</canvas>
```

```ts
// each item animates on its own timeline
for (const item of items) {
  const t = item.animator.valueAt(now); // per-item easing/stagger
  ctx.save();
  ctx.globalAlpha = t.opacity;
  ctx.translate(item.left + t.dx, item.top + t.dy);
  ctx.scale(t.scale, t.scale);
  ctx.drawElementImage(item.element, 0, 0);
  ctx.restore();
}
```

Why this fits us: `CanvasItem` already stores explicit `left/top/width/height`,
and canvas children stack at the origin anyway — so positioning at draw time is
_the_ natural expression, not a workaround. Z-order is draw order, which is
already how the item list is ordered.

**Two levels of nesting are available:**

1. **Item level** — independent transform/alpha/filter/clip per canvas-item, in
   canvas space (per-item stagger, fly-in, per-item fade). ✅
2. **Inside an item** — ordinary CSS animation on descendants (word-by-word
   reveal, blinking cursor, marquee). Renders live and drives paint. ✅

**Dead end:** a nested `<canvas layoutsubtree>` per item — `NotSupportedError:
Nested canvases are not supported.` ✅ If you need hand-drawn sub-content, a
_plain_ `<canvas>` inside an item does work and is captured live. ✅

**Cost:** cached background bitmap + one small live item animated per frame ran
at 60 fps with 1 dropped frame in 89. Per-item animation is the cheap case,
because only a small region gets re-rasterized. ✅

---

## 7. Performance (measured, with caveats)

Measured on **this dev machine** (Windows 11, dpr 1.5, GPU raster on), canvas
backing store 1920×1080. Numbers are frame-delta medians from a rAF loop;
"dropped" counts inter-frame gaps > 20 ms out of 59.

Per-call JS cost of `drawElementImage` on a 1920×1080 subtree: **~0.1 ms
median**. That is only command recording — it is _not_ the rasterization cost,
which is why the frame-level numbers below matter more.

Three interleaved repetitions of each pattern, 60 frames each:

| Pattern                         | rep 1               | rep 2    | rep 3    |
| ------------------------------- | ------------------- | -------- | -------- |
| idle control                    | 16.7 ms / 1 dropped | 16.7 / 0 | 16.7 / 0 |
| live element, identity          | 16.7 / 0            | 16.7 / 1 | 16.7 / 0 |
| live element, alpha only        | 16.7 / **8**        | 16.7 / 0 | 16.7 / 0 |
| live element, translate         | 16.7 / 1            | 16.7 / 0 | 16.7 / 1 |
| live element, **scale**         | 16.7 / **15**       | 16.7 / 0 | 16.7 / 0 |
| `ElementImage`, scale           | 16.7 / **7**        | 16.7 / 0 | 16.7 / 0 |
| cached `ImageBitmap`, scale     | 16.7 / 0            | 16.7 / 0 | 16.7 / 0 |
| cached bitmap crossfade + scale | 16.7 / 0            | 16.7 / 0 | 16.7 / 0 |

Readings:

- **Steady state is 60 fps for everything**, including scaling a live 1920×1080
  DOM subtree every frame. That was better than expected.
- **The first run of a pattern hitches.** Scaling a live element dropped a
  quarter of its first 59 frames. A pre-rasterized `ImageBitmap` never hitched,
  in any pass. In a service, the _first_ transition is exactly the one people
  watch, so: pre-warm the effect (run it once invisibly) or pre-rasterize.
- An earlier single-pass measurement showed live-element-plus-scale pinned at
  33.3 ms (30 fps) and a two-layer scaled crossfade at 50 ms (20 fps). Those
  numbers were cold-path only and did not survive repetition — but they are a
  fair picture of what a cold, unwarmed effect looks like.
- `getImageData(1920×1080)` costs **3.3 ms** — never read back per frame.
- Downscaling a 1920×1080 subtree into a 320×180 preview canvas (either via the
  8-arg overload or `ctx.scale`) held 60 fps. ✅

⚠️ **All of this is dev-machine data.** Our target is old church hardware,
possibly on software rasterization. The _ordering_ (cached bitmap ≥ snapshot ≥
live element; identity ≥ translate ≥ scale) should hold, but absolute numbers
must be re-measured there before committing.

---

## 8. What this would mean for our codebase

1. **The effect layer is a rewrite, not a port.**
   [transitionEffectHelpers.ts](src/_screen/transitionEffectHelpers.ts) builds
   `fade`, `zoom` and `none` out of `@keyframes` on `opacity` and
   `transform: scale()`, applied to the container that would become the drawn
   child. Those are precisely the two properties that are invisible through
   `drawElementImage`. `move` (which animates `left` via rAF) _would_ still
   render, since `left` is a layout property — but at the cost of relayout per
   frame. All of them are better expressed as canvas math.
2. **We'd gain the transition primitives the TODOs are about.** The two
   `// TODO: fix backdrop filter stop working during animation` notes exist
   because CSS composited animations break `backdrop-filter`. In the canvas
   path `backdrop-filter` renders correctly inside the subtree, and effect
   opacity lives in `globalAlpha` instead of on the element. Same for the
   `// TODO: make none effect work without animation to prevent flash`.
3. **Cross-origin content regresses, but there are three mitigations.**
   `CanvasItemWebsite` (iframe) and `CanvasItemYouTube` (YouTube embed) are
   cross-origin iframes → they draw as blank holes, silently (measured with a
   real embed, §4.4).

   For `CanvasItemYouTube` specifically the cheaper fix is to **stop using a
   frame**: what the draw refuses is the cross-origin _iframe_, not the video.
   `resolveMediaStreamUrl` (`src/server/appHelpers.ts`) runs the `yt-dlp` we
   already ship — the media downloader's own binary — with `-g -f b[ext=mp4]/b`
   to turn a watch URL into its direct muxed stream, and a plain
   `<video crossOrigin="anonymous">` on that URL draws into the canvas like any
   local clip, live, readable, at the video's own paint rate. Verified end to
   end against the real binary (`youtubeDemo.tsx#YouTubeComp`, the
   "draw for real (yt-dlp)" button). What it does _not_ get you: player chrome,
   captions, the `SlideYouTubePlayer` `postMessage` protocol, or a URL you can
   store — the resolved URL expires and is bound to the requesting IP, so it
   has to be re-resolved per session, which costs a process spawn and a few
   seconds.

   When the real player must stay but its pixels have to reach the canvas (a
   live broadcast, captions, chrome), **mirror it out**. A self tab-capture
   narrowed to the iframe by Element Capture (`RestrictionTarget` +
   `track.restrictTo`) or Region Capture (`CropTarget` + `track.cropTo`) comes
   back as an ordinary `MediaStreamTrack`, and that track in a `<video>` draws
   like any clip. All of it verified live (`youtubeMirrorDemo.tsx`):

   - `getDisplayMedia` is dead in Electron until a handler answers it —
     `NotSupportedError: Not supported`. `initDisplayMediaHandler`
     (`electron/displayMediaHelpers.ts`) hands back the requesting frame, which
     is a **tab** capture (`displaySurface: "browser"`) and the only surface
     the two narrowing APIs accept. It can hand back that frame's audio too.
   - **Element Capture fails open.** Its target must form a stacking context;
     on a bare `<iframe>` `restrictTo` resolves and then quietly keeps mirroring
     the whole page — same iframe, back to back: bare **2241×1401** (the
     viewport) vs `isolation: isolate` **1440×810** (the element). Check the
     track size, don't trust the resolve. ✅
   - Both APIs narrow **asynchronously**: `getSettings()` on the line after the
     await still reports the full viewport. Poll for it. ✅
   - Resolution is capped by the source's on-screen size — the track is the
     element's CSS box × a pixel ratio the capture picks. At `devicePixelRatio`
     3 an exactly 480×270 source mirrors at **1440×810** under _both_ APIs, and
     the track reports its own `screenPixelRatio`. Put the border outside the
     box and the source is 481.33×271.33, which mirrors at 1446×816 — the ceiling
     tracks the layout box to the sub-pixel, so `box-sizing: border-box` on the
     source is worth having. ✅
   - **That pixel ratio is not a constant, and Region Capture is where it
     moves.** The same source in the same window has come back at both 3.0x
     (`1446×816`) and 1.5x (`722×406`) under Region Capture across runs, and a
     plain non-isolated `<div>` measured 1.5x while an `isolation: isolate`
     iframe alongside it measured 3.0x. Element Capture has measured full device
     pixel ratio every time. An earlier revision of this file read the 1.5x
     sample as a rule and claimed Element Capture is sharper by a fixed factor of
     2 — it is not a fixed factor. Treat Element Capture as the one that does not
     surprise you, and read `getSettings()` rather than predicting it. ✅
   - **The mouse pointer IS captured — while it moves — and there is no knob to
     turn it off.** The track reports `cursor: "motion"` and means it literally:
     the pointer is composited into the frames only while in motion, and is
     absent from them once it stops. Seen directly in the mirror, under **Region
     Capture**, in a screenshot of the running demo. ✅
     Beware the measurement trap that sets. A pixel scan taken while the pointer
     merely _rests_ over the page comes back perfectly clean — 0 non-sheet
     pixels across 6 frames, ~14.5M pixels, with `body:hover` true throughout —
     and reads as proof of exclusion. It is not. Only frames sampled _during_
     `mousemove` say anything, and **CDP cannot generate that motion**: driving
     `Input.dispatchMouseEvent` (Puppeteer `hover`) across a static, isolated
     capture target moved the renderer's hit-test but composited nothing — the
     largest frame-to-frame delta over 410 frames sat at a fixed encoder-noise
     pixel, nowhere near either hover point. The cursor overlay follows the real
     OS pointer only, so this question cannot be answered from an agent at all;
     it needs a hand on the mouse. ✅
     The `cursor` constraint that used to control this is gone from Chromium
     150: absent from both `getSupportedConstraints()` and a live track's
     `getCapabilities()` (`["aspectRatio", "deviceId", "displaySurface",
"facingMode", "frameRate", "height", "resizeMode", "width"]`),
     `getDisplayMedia({video: {cursor: 'never'}})` still yields a track
     reporting `"motion"`, and `applyConstraints({cursor: 'never'})` resolves
     and leaves `getSettings().cursor` at `"motion"`. The API route is closed. ✅
   - **Whether Element Capture excludes the pointer where Region Capture
     includes it is still open.** The spec is silent on the cursor — it says only
     that frames "consist of information from the target-element and its
     descendants", and the cursor is not a descendant of anything. Chromium
     composites it as a capturer-level overlay rather than as page content, which
     argues it survives the restriction, but that is a reading of the mechanism,
     not a measurement. ❓ needs a real pointer over the source in each mode
   - Suppressing the pointer therefore has to be structural, and there is one
     move that works from inside the page: the capture composites **whatever
     cursor bitmap the hovered element asks for**, so a hit-testable layer
     wearing `cursor: none` in front of the player leaves the capturer with
     nothing to draw. The parent cannot set that inside a cross-origin
     `<iframe>` — the framed document owns its own cursor — but it does not have
     to reach inside; it only has to be the thing under the pointer. The layer
     swallows clicks to the player, which is the price, and it is not a
     descendant of the target, so Element Capture drops it from the mirror
     outright. Wired up as the demo's _hide pointer_ toggle. ❓ mechanism sound,
     unverified for the same reason as above
     Failing that, keeping the capture source in a window nobody points at (the
     operator's pointer lives on the presenter) does not depend on any of this. 📄
   - The source must be genuinely painted — an iframe inside a `layoutsubtree`
     canvas is laid out but never painted, so it cannot be its own capture
     source. 📄
   - DRM titles capture as black frames. 📄

   When the player itself is the requirement and its pixels are not, the escape
   hatch is an **overlay layer**: draw the slide
   with the item's box left empty, and stack one DOM layer over the canvas that
   is a copy of the slide's coordinate space, holding the live iframes, wearing
   the matrix the draw returned. Verified live — the player is positioned to the
   pixel, plays, answers the same `postMessage` protocol `SlideYouTubePlayer`
   uses, and tracks a canvas-space zoom when re-synced each frame
   (`youtubeDemo.tsx#YouTubeOverlayComp`). What it costs: those pixels are DOM,
   so `ctx.filter`, `ctx.clip()` wipes and per-slide `globalAlpha` stop at the
   player's edge, the layer sits above everything drawn after it, and it must be
   re-synced on every frame of a transition. Slides mixing those item types with
   canvas-space effects still need the DOM path.

4. **Video and local media are fine** — verified live, including paint
   invalidation at the video's own frame rate.
5. **Previews are bitmap copies, not extra DOM.** A subtree can only be drawn by
   _its own_ canvas (drawing it into another canvas throws `Only immediate
children of the <canvas> element…`), so a second canvas cannot share the
   slide DOM. What it _can_ do is `drawImage(sourceCanvas, …)` — every extra
   preview then costs one bitmap blit instead of a second live slide tree, and
   the 8-arg overload draws a 1920×1080 subtree into a small canvas at full
   fidelity. Previews today render a second copy of the slide inside a shadow
   root (`ShadowingFillParentWidthComp`) and CSS-scale it.
6. **Printing must keep the DOM path.** `printAppDocument` relies on real DOM
   plus `@page` fragmentation; canvas output is a flat bitmap. Canvas rendering
   would be a screen-only concern.
7. **Feature detection is mandatory.** Flag-gated, single-vendor, and the spec
   renamed the main method recently (`drawElement` → `drawElementImage`). Build
   it as an opt-in path with the current DOM renderer as fallback.

---

## 9. Open questions

- ❓ Animated GIF invalidation (test was inconclusive — the control GIF didn't
  animate either).
- ❓ `texElementImage2D` (WebGL) and the OffscreenCanvas/worker path end to end.
  `ElementImage` _is_ structured-cloneable with transfer (verified), so the
  worker story is plausible but untested.
- ❓ Behavior on low-spec / software-rasterized hardware — the number that
  actually decides this.
- ❓ Memory cost of holding several `ElementImage` snapshots (device-pixel
  sized: a 1920×1080 slide at dpr 1.5 is 2880×1620 ≈ 18 MB uncompressed).
- ❓ Interaction with our separate screen `BrowserWindow`s and multi-screen sync.
- ❓ Spec churn: the WICG explainer lists an "auto-updating canvas" mode (canvas
  child snapshots pushed to a worker so threaded scroll/animation can render
  without main-thread redraws) as a _future_ consideration. If it lands, most of
  Model A becomes cheaper.

---

## 10. Reproducing the probes

Everything above is demonstrated live in `./HtmlInCanvasComp.tsx` — 23 demos
(transitions, per-item animation, the staging matrix, the benchmark, the error
cases). Run the app with the switch from §2 and open
`https://localhost:3000/experiment.html`.

Each demo prints its own code under the preview: `./demoSourceHelpers.ts` reads
the demo file's raw text at run time and slices out the symbols named in the
`sourceList` of `./demoList.ts`, so a listing can never drift from the code that
actually ran. Add a demo → give it a `sourceList`; rename a symbol → update the
reference (the block says `"<symbol>" not found` if you forget).

The original probe harness was a standalone Electron app (7 pages, ~1500 lines)
run against `node_modules/electron/dist/electron.exe`; it lived in a scratch dir
and is not checked in. Minimal reproduction:

```js
// main.js
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('enable-blink-features', 'CanvasDrawElement');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { backgroundThrottling: false },
  });
  await win.loadFile('index.html');
  console.log(await win.webContents.executeJavaScript('window.__probe()'));
});
```

```html
<!-- index.html -->
<canvas id="c" layoutsubtree width="300" height="150">
  <div id="k" style="width: 300px; height: 150px; background: #0a0">hello</div>
</canvas>
<script>
  window.__probe = async () => {
    await new Promise(requestAnimationFrame); // MUST wait one frame first
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const m = ctx.drawElementImage(document.getElementById('k'), 0, 0);
    return { available: 'drawElementImage' in ctx, matrix: String(m) };
  };
</script>
```

Run with `env -u ELECTRON_RUN_AS_NODE …/electron.exe .` — the harness shell
exports `ELECTRON_RUN_AS_NODE=1`, which makes Electron run as plain Node (same
gotcha as `npm run dev`, see CLAUDE.md).

---

## 11. Sources

- <https://html-in-canvas.dev/> — overview, browser support
- <https://github.com/WICG/html-in-canvas> — explainer (paint event ordering,
  restrictions, read-back-allowed rendering, future auto-updating canvas)
- <https://wicg.github.io/html-in-canvas/> — spec draft
- <https://groups.google.com/a/chromium.org/g/blink-dev/c/t_nGEmJ_v4s> —
  Intent to Experiment (M148–M151, interop signals)
- <https://tympanus.net/codrops/2026/05/13/exploring-the-html-in-canvas-proposal/>
  — use cases, three.js `InteractionManager` hit-testing approach
- Local measurements: Electron 43.1.1 / Chromium 150.0.7871.114, 2026-07-25
