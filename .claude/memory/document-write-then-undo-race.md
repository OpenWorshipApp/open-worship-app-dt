---
name: document-write-then-undo-race
description: Editable documents track their in-flight writes so undo/redo/save/discard cannot overtake an edit that is still on its way
metadata:
  node_type: memory
  type: project
  originSessionId: b235b5dc-e5b5-4b4c-8e7b-9404b6966677
  modified: 2026-09-29T02:09:37.469Z
---

Several edit paths write the editing history **fire-and-forget** on purpose —
`CanvasController.setCanvasItems` calls the async `AppDocument.updateSlide`
without awaiting it, because the canvas must not stutter mid-drag. So an undo
fired in the same breath reached `EditingHistoryManager` FIRST and took back
the edit **before** the one the user meant.

Measured live 2026-09-28: arrow-nudge a canvas box, press `Ctrl+Z` with no
pause → the nudge stayed and an earlier edit vanished; the same press after a
~2 s pause worked. Four runs, four times.

**How it is closed:** `AppEditableDocumentSourceAbs` keeps ONE `pendingWrite`
promise. `trackPendingWrite(promise)` chains onto it, and `historyUndo`,
`historyRedo`, `historySave` and `historyDiscard` all `await` it before touching
the history — they all mean "of everything done so far".

**The rule that made it actually work:** the write must be registered
**synchronously, where it is STARTED**, not where it lands. Tracking inside
`setJsonData` was not enough — the canvas path reaches it only after two awaits
(`getSlideIndex`, then `getSlides`), so the undo still found nothing pending and
raced past. `AppDocument.updateSlide` is therefore a sync wrapper that registers
`applySlideUpdate(slide)` the moment it is called. **Any new fire-and-forget
mutator has to do the same**, or it re-opens this.

A failed write settles rather than rejects, so one bad save cannot leave every
later undo waiting for ever.

Related: [[history-read-cache-stale-paths]], [[presenting-flow-reads-editing-history-head]].
