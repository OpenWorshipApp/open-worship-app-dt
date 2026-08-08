---
name: presenting-flow-expanded-doc-stale
description: "OPEN — an expanded document element in a run sheet never re-reads its document, so its rows project stale slide content"
metadata: 
  node_type: memory
  type: project
  originSessionId: ad24e654-a898-4f16-b4af-46c19ebd979b
  modified: 2026-08-08T15:22:06.994Z
---

Verified live 2026-08-08 (run `20260808-1020`).
`PresentingFlowDocumentSlidesComp` loads its slides with
`useAppStateAsync(() => loadVaryAppDocumentSlides(filePath), [filePath])`
([src/presenting-flow/PresentingFlowDocumentSlidesComp.tsx](../../src/presenting-flow/PresentingFlowDocumentSlidesComp.tsx):297)
— there is **no `useFileSourceEvents` subscription on the referenced document**. While the
element stays expanded, nothing re-reads it.

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

**How to apply:** fix by subscribing to the referenced document's `update` event and re-running
the loader, behind a **per-instance** `genTimeoutAttempt(500)` (several rows can share a
`filePath`, so a module-level timer would leave all but one stale — CLAUDE.md's multi-instance
rule). Do not confuse this with PL-62, which is about the `.owpf` itself and passes: an outside
edit of the **editing-history head** does re-render the rows
([[presenting-flow-reads-editing-history-head]]).
