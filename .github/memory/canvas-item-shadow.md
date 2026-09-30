---
name: canvas-item-shadow
description: "Every slide canvas box can cast a shadow, and the picker has TWO kinds because one CSS property cannot dress both: Box Shadow is the shadow of the rectangle, Drop Shadow is `filter: drop-shadow()` and follows what is actually painted — the letters, or a picture's see-through edge"
metadata:
  node_type: memory
  type: project
  modified: 2026-09-25T21:43:15.119Z
  originSessionId: f691b657-fb6a-41ad-9af9-40fd74d3fc3c
---

Asked for as _"add box-shadow drop-shadow to slide canvas item properties"_
(2026-09-25). Every canvas item kind now has a **Shadow** row under **Shape
Properties** in the Document Editor's item **Properties**, between **Round:**
and **Blend Mode** — `src/slide-editor/canvas/canvasShadowHelpers.ts` (a leaf
module: it imports TYPES only) plus `ShadowPropertiesComp` inside
`src/slide-editor/canvas/tools/ShapePropertiesComp.tsx`.

**Two kinds, and the difference is the whole point.** `box` is `box-shadow`:
the shadow of the box's own RECTANGLE, rounded corners included, which is what
a text box with a backing colour wants. `drop` is `filter: drop-shadow()`: the
shadow of what is actually PAINTED, so it follows the letterforms of a box with
no backing and the cut-out of a logo PNG. Handing a transparent logo a box
shadow draws a rectangle in mid-air behind it — that mistake is why this is a
picker and not a checkbox. Chromium reads `drop-shadow()`'s three lengths
exactly as `box-shadow` does (only spread is unsupported, so the picker has no
spread), which is why one number means the same fall and the same softness
whichever kind is chosen.

Consequences worth knowing:

- **It goes in `genShapeBoxStyle`, NOT `genBoxStyle`** — the opposite of
  [[canvas-item-blend-mode]], and deliberately. A blend describes the box's
  relationship to the items under it, which the properties panel's lone preview
  well would misreport; a shadow is the box's OWN dressing, so the editor box
  (`BoxEditorComp`), the preview well (`CanvasItemPreviewComp`), the slide
  thumbnails, the projector and the print PDF all have to show it, and one
  function gives all five.
- **`shadow` is absent or a whole repaired object, never a `none` kind**
  (`cleanupCanvasShadow`, called from the `CanvasItem` constructor and from
  `applyProps`). Same rule as `blendMode` never being written as `normal`: a
  document written before this existed round-trips byte for byte, and a box
  nobody dressed costs no declaration at all. Picking **No Shadow** sends
  `{ shadow: null }`, which is what takes the key off.
- **Only an unknown `kind` means "no shadow"; every other field is REPAIRED.**
  One unparseable token voids the whole CSS declaration, so a hand-edited
  document must never reach the screen as written — but a missing colour or a
  wild offset is clamped (±200px offset, 0–200px blur, whole pixels), not a
  reason to throw away the shadow the operator asked for. The panel reads its
  own state back through `toValidCanvasShadow`, so a typed 9999 shows as the 200
  that will be stored.
- **The blur limit is a performance bound, not taste.** A shadow is painted by
  blurring a copy of the whole box; on the machines this app targets that is the
  one number here with a real cost, and 200px is already a fifth of a 1080p
  slide's height.
- The X / Y / Blur fields are `BoxNumberFieldComp`
  (`src/slide-editor/canvas/tools/BoxNumberFieldComp.tsx`), extracted out of
  `BoxPositionSizeComp` so the two groups in one column cannot drift. That
  extraction also put an `aria-label` on the inputs, so `owa_find_ui` /
  `owa_type` can now aim at **X:** / **Y:** / **W:** / **H:** / **Rotate:** too.
- **PPTX export does not carry it.** `pptxSlideMeasureHelpers` measures the
  rendered DOM into shapes and has no shadow leaf; the shadow is simply absent
  from an exported deck. Not attempted.

Proven live in the Document Editor on `Peaching.ows`, slide 2: **Box Shadow** at
`0 / 120 / 0` drew a hard rounded slab under the box, **Drop Shadow** at the
same numbers drew the ghosted words _What is Faith_ instead — both identical in
the canvas and in the left-hand slide thumbnail (`SlideRendererComp` →
`genBoxStyle`, the same function the projector and the print PDF use). Undone
with the Undo button afterwards, never **Discard changed**.

Related: [[canvas-item-blend-mode]], [[foreground-effects-one-setting]].
