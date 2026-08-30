---
name: presenting-flow-keyboard-event
description: The Keyboard Event run action is a hotkey line — Ctrl/Shift only, unique per sheet, and the ONE run action that resolves screens because its CC elements are its whole payload
metadata:
  type: project
---

`Keyboard Event` (added 2026-08-06, branch refactor24) is the run sheet's HOTKEY: arm a line
with `Shift+A`, and pressing it in the floating preview sends the run to that line and puts
whatever is attached to it on the screens. The fourth member of the run family
([[presenting-flow-screen-actions]]), pink, badge `⌨`.

**Why:** everything else in the panel walks FORWARD (or, with a `Jump to`, to a line another
line names). This is the one thing the operator aims themselves, mid-service, without looking.

**How to apply:**

- **Armed with a SHORTCUT, a third alternative to the two clocks.**
  `PresentingFlowActionArmingType` now carries `actionKey` beside `actionNumber`/`actionTime`, and
  `applyPresentingFlowActionArming` deletes all three before writing one — same rule, one more field.
  Registry flag: `canBeKeyArmed` (only this action; its `number` is null, so the clock half of
  `askForPresentingFlowActionArming` is skipped entirely by an early branch).
- **Ctrl and Shift ONLY, and at least one of them.** `presentingFlowActionKeyHelpers.ts` is a LEAF
  storing a canonical `Ctrl+Shift+A` — NOT `KeyboardEventListener.toShortcutKey`'s output,
  which is platform-formatted (`⌃⇧ A` on a Mac) and would not survive the file being opened on
  another machine. The mapper it builds uses `allControlKey`, which is exactly why Ctrl/Shift
  are the only two allowed: Alt is `Option` on a Mac and Meta is another key again, so either
  would silently stop matching. A bare key is refused because `ArrowDown`/`Space` step the run.
  The canonical string IS the row label — no second, prettier form to keep in step.
- **UNIQUE per presenting flow**, enforced in `PresentingFlow` (the write funnel), not at the question:
  `insertItemJson` + `setItemActionArming` both call `checkPresentingFlowActionKeyIsFree`, and
  `duplicateItemAtIndex` / `addItemCcFromItemIndex` DELETE `actionKey` on the copy the way
  they re-key the uuid. Two lines answering to one key is the exact bug uuid references were
  introduced to end. `collectPresentingFlowRunShortcutKeys` still dedupes on read (first wins) — a
  hand-edited file or an imported archive gets no second registration and no duplicate React key.
- **It is the ONE run action that resolves screens.** Its CCs are ordinary FOLLOWERS and it
  shows nothing of its own, so unless it runs the resolution nothing does and the key appears
  dead. `sendPresentingFlowItemToScreens` branches on `PresentingFlowItem.hostsCcFollowers`
  (`ccItemCount > 0 && !ccItemsAreTargets`) → arms the CCs, then
  `chooseScreenIdsOnEvent` (new, in `screenDroppedHelpers` — the choosing half of
  `applyOnChosenScreens` with no `apply`, so a closed screen is not toasted per no-op).
  With NOTHING attached it falls back to `firePresentingFlowRunAction` for the toast.
- **`checkIsCcTargetHost` is now per-action (`ccItemsAreTargets`), not "is it a run action".**
  Leaving it as the latter would have made a `Keyboard Event`'s followers TARGETS, letting a
  document be attached and then silently dropped on the press. `ccItemCount` widened from
  `0 | 1` to `number` (Infinity here). See [[presenting-flow-cc-elements]].
- **`isScreenPinnable` includes it** — the pin is read for the followers' screens, exactly as
  a document's pin is read for its slides.
- **One `PresentingFlowRunShortcutComp` per shortcut, keyed by it.** `useKeyboardRegistering`
  SPREADS the resolved event names into its effect deps, so one hook over a changing set hands
  React a deps array that changes LENGTH. A component per shortcut keeps every array constant;
  re-arming remounts exactly the one whose key changed. Registering through the app's keyboard
  LAYER (not a raw window listener) is what lets a modal take the key back.
- **The widget now focuses itself on open** (`containerRef.current?.focus({preventScroll:true})`,
  on `[filePath]`). Every key it answers to is gated on focus being inside it, but the gesture
  that opens it leaves focus on the tree's button — so the operator's FIRST press did nothing,
  with nothing on screen to say why. This fixed the next-key too.
- Menu: `Change Shortcut` (beside `Change Seconds`/`Change Timing`), and the fire entry reads
  `Apply on Screens` rather than the action's own label for any CC-hosting run action.
- **The run now stops on EVERYTHING that is not parked**, and unfolds what it lands on —
  `findNextPresentingFlowPreviewIndex` lost its `checkIsEnterable` gate and `landPresentingFlowRunOnIndex`
  calls `expandPresentingFlowPreviewItem`. See [[presenting-flow-preview-run-player]].
- The `Add Action` menu is now FOUR levels: every clear folds behind `Clear Screen`, and the
  eight per-widget FG clears behind `Other Clear FG Items` inside it.
  `presentingFlowActionMenuList` (shape, nestable) is separate from `presentingFlowActionList`
  (flat registry, what an id resolves against) — only the component reads the former.
- **No unit tests.** `presentingFlowActionKey.test.ts` was deleted with the whole
  src/presenting-flow suite on 2026-08-24 (47053c9d); the only live coverage is
  matrix rows PL-97/PL-98.
