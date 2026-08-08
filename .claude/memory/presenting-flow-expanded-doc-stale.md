---
name: presenting-flow-expanded-doc-stale
description: "FIXED 2026-08-08 — an expanded document element now re-subscribes to its document; before the fix its rows projected stale slide content"
metadata: 
  node_type: memory
  type: project
  originSessionId: ad24e654-a898-4f16-b4af-46c19ebd979b
  modified: 2026-08-08T16:37:51.684Z
---

Found and **FIXED** on 2026-08-08 (run `20260808-1020`).

**The bug:** `PresentingFlowDocumentSlidesComp` loaded its slides with
`useAppStateAsync(() => loadVaryAppDocumentSlides(filePath), [filePath])`
([src/presenting-flow/PresentingFlowDocumentSlidesComp.tsx](../../src/presenting-flow/PresentingFlowDocumentSlidesComp.tsx):297)
— with **no `useFileSourceEvents` subscription on the referenced document**. While the
element stayed expanded, nothing re-read it.

Two symptoms, the second much worse:

1. The child rows do not follow the document. Same window, same file, same moment: the
   presenter's centre previewer went 2 → 3 slides within 2.5 s of a disk change; the run
   sheet's expanded rows stayed at 2 until a collapse/expand cycle (or a page reload).
2. **The rows project stale CONTENT.** `PresentingFlowVarySlideRowComp.handleClicking`
   presents `varySlideRef.current`, the object captured at expand time. Reproduced against
   a showing screen: text `ROBOT-EDIT-V2` → changed on disk to `ROBOT-STALE-V4` →
   re-presenting the same row still put `ROBOT-EDIT-V2` on `screen.html`.

**Why:** the reference storage model exists *because* "a song edited in between must project
its NEW words" ([[presenting-flow-references-vs-presets]]). This defeats it silently.

**The fix:** the component now subscribes to the referenced document's `update` event and
re-runs `loadVaryAppDocumentSlides`, behind a **per-instance** `genTimeoutAttempt(500)` — one
sheet may list the SAME document twice, so a module-level timer would let the last caller
`clearTimeout` the others and leave all but one stale (CLAUDE.md's multi-instance rule).
Verified live: an expanded row picked up a new slide in ~0.2 s and presenting it put the NEW
text on `screen.html`.

**How to apply:** do not "simplify" that subscription away, and keep the timer per-instance. Do
not confuse this with PL-62, which is about the `.owpf` itself and always passed: an outside
edit of the **editing-history head** does re-render the rows
([[presenting-flow-reads-editing-history-head]]).
