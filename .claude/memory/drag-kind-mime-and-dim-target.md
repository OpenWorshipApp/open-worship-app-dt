---
name: drag-kind-mime-and-dim-target
description: Drop targets gate dragover on the `application/x-owa-drag-<kind>` mime; and `changeDragEventStyle` dims `event.target`, not `currentTarget`
metadata:
  type: project
---

Two things about drag & drop that bite any new drop target:

**1. The drag kind rides its own mime type.** `handleDragStart`
(`src/helper/dragHelpers.ts`) writes the payload to `'text'` AND a second,
valueless entry named `genDragMimeType(type)` = `application/x-owa-drag-<kind>`
(`src/helper/DragInf.ts`). Chromium's protected mode makes `getData` return `''`
during `dragover`, so the payload is unreadable while hovering — the mime TYPE
is the only thing a target can gate its accept feedback on. `setData`
lowercases the format, hence the `toLowerCase()` in `genDragMimeType`
(`bibleItem` -> `bibleitem`). Exemplar consumer:
`checkIsCanvasBackgroundDropDataTransfer` in
`src/slide-editor/canvas/canvasBackgroundDropHelpers.ts`, used by
`dragOverHandling`.

**2. `changeDragEventStyle` (`src/helper/helpers.ts`) writes to `event.target`,
but `dragOverHandling` dims `event.currentTarget`.** They are the same element
only when the drop lands on bare background; a drop onto a child leaves the
container dimmed forever, because `dragleave` does not fire on a drop. Same
mismatch bites the insert position: `CanvasController.getMousePosition` measures
against `event.target.getBoundingClientRect()`, so a drop on a child takes the
child's top-left as the origin. Read `currentTarget` synchronously into a
`{clientX, clientY, target}` object and pass that — see `handleDropping` in
`src/slide-editor/canvas/canvas-container/canvasContainerHelpers.ts`.

**Why:** both are silent — no error, no toast, just a stuck-dim canvas and an
item inserted somewhere unexpected.

**How to apply:** when adding a drop target, gate `dragover` on the kind mime
(never on `text/plain`, which every internal drag carries), and never assume
`target === currentTarget`. Related: [[eventhandler-sync-dispatch]].

Also: `.every()` on an empty `dataTransfer.items` is vacuously true — a
mimetype gate needs an explicit `length > 0`.
