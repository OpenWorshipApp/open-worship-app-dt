---
name: canvas-item-blend-mode
description: "Every AppDocument canvas item carries a Blend Mode, but unlike a foreground widget it blends only with the items under it IN THE SAME SLIDE — the slide is an isolated group everywhere it is drawn, so the screen background behind it is out of reach"
metadata:
  node_type: memory
  type: project
  originSessionId: 3bd662b4-d7ac-477e-b130-4c0190514668
  modified: 2026-09-24T23:53:09.889Z
---

Asked for as _"like foreground image/video/…, I want all AppDocument's canvas
item types support blend mode"_ (2026-09-24). Every canvas item kind — text,
html, image, video, audio, youtube, website, bible, camera — now has a **Blend
Mode** picker under **Shape Properties** in the Document Editor's item
properties, sharing the foreground widgets' vocabulary through
`src/helper/blendModeHelpers.ts` (leaf, no imports) and
`src/others/BlendModeSelectComp.tsx`.

**The blend group is the SLIDE, not the screen.** This is the one place it
differs from [[foreground-blend-mode-stacking]], and the difference is not a
choice — it is forced by how a slide is scaled:

- On the projector, `ScreenVaryAppDocumentManager.render` mounts the slide in
  `divContainer` (`transform: scale(...) translate(...)`) inside
  `divHaftScale` (`transform: translate(-50%, -50%)`). **Both transforms make a
  stacking context**, so an item can never reach `#background`.
- The editor canvas (`.slide-canvas-editor`) and every preview scale the same
  way, so they isolate identically. Editor and projector therefore agree.

So a lone blended item over the screen background shows **no change at all**,
which is correct and will read as a bug to anyone who has not been told. What
does work: an item blended over another item of the same slide — the normal way,
with a full-bleed image/video item at the bottom of the slide. Reaching
`#background` would mean replacing those two transforms with `zoom` on the
app's most important render path; not attempted.

Consequences worth knowing:

- **`blendMode` is absent or a real mode, never the string `normal`**
  (`cleanupBlendMode` in `CanvasItem.ts`, called from the constructor and from
  `applyProps`). Storing `normal` would rewrite every slide document in the
  user's folder the first time it is opened, and an unknown value would void
  the whole `style` declaration it lands in.
- **It goes in `genBoxStyle`, NOT `genShapeBoxStyle`.** The shape style also
  dresses the properties panel's own preview well, where the item is shown
  alone and a blend would misreport what the slide does.
- **The editor puts it on `.editor-controller-box-wrapper`**, the only element
  between the box and the canvas with no isolating ancestor — the box's own
  `translate(-50%, -50%)` already makes it a stacking context, so a blend set
  there has nothing to blend with.
- **The selection chrome moved OUT of the box** into a sibling
  `.editor-controller-box-chrome` anchor (`box-chrome-frame` + `.tools` +
  `.locked-indicator` + the dashed outline). `mix-blend-mode` composites a
  whole subtree as one group, so chrome left inside a `multiply` box on a dark
  canvas went black — the handles disappeared. The anchor is
  `pointer-events: none` with `auto` back on `.object`, so a press between two
  handles still reaches the box; `BoxEditorController.initEvent` takes the
  chrome element and mirrors every live `left`/`top`, `width`/`height` and
  `transform` write onto it (group drags resolve each member's chrome through
  `BoxEditorController.chromeOf`, its anchor's next sibling).
- **The editor's transparency checkerboard moved OFF `.slide-canvas-editor`**
  onto a wrapper one level up (`BodyRendererComp`). The element that makes the
  stacking context contributes its own background as the group's base, so with
  the check ON the canvas a `multiply` box darkened against grey squares that
  the projector does not have. Leave that wrapper unpositioned: a positioned
  ancestor there becomes the boxes' `offsetParent` and moves every number the
  drag engine reads.
- The mode labels are read with a dynamic `tran(mode.labelKey)`, so
  `tranKeyCoverage.test.ts` parses `BLEND_MODE_GROUP_LIST` as SOURCE TEXT — it
  reads `src/helper/blendModeHelpers.ts` now, not the foreground panel.

Proven live in the Document Editor on `Peaching.ows`: two overlapping boxes with
**Difference**, the composite visible in the canvas and in the slide-list
thumbnail (`SlideRendererComp` → `genBoxStyle`, the same function the projector
and the print PDF use), the green outline and blue handles unblended, and the
checkerboard showing through the unblended part.

Related: [[foreground-blend-mode-stacking]], [[lyric-in-documents-list]].
