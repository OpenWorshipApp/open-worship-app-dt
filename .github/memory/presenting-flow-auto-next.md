---
name: presenting-flow-auto-next
description: The presenting flow run can walk itself (one clock, two endings) and jump; the run's SELECTION CHANGING cancels a timeout and restarts an interval — raw clicks/keys mean nothing
metadata:
  type: project
---

`src/presenting-flow/presentingFlowAutoNextHelpers.ts` (added 2026-08-05, branch refactor24) is the
run sheet's own clock, armed by the two `next-*` run actions of
[[presenting-flow-screen-actions]]. ONE slot for the whole app, in memory only, ticking once a
second and only while something is armed.

The two modes differ ONLY in what the RUN MOVING does to them. **Neither answers to raw
input** — that was the first design and it was wrong: an unintended click anywhere killed
the wait. The one signal is the preview's CURSOR changing
(`notifyPresentingFlowRunSelectionChanged`, called from `notifySelecting` in
`presentingFlowPreviewFloatingHelpers`, which is the only place that knows the run moved):

- **timeout** — counts down once, forces the next selection, spent. The run going
  somewhere CANCELS it ("I have taken over"); a click on a background, a button or the
  widget's own chrome leaves it counting. It is also the ONE that may be armed with a
  **time of day** instead of a count of seconds (`canBeTimeArmed`, stored as `actionTime`
  = `HH:mm`, `startPresentingFlowAutoNextAtTime`): a service starts at 7:05, and counting the
  seconds to it by hand is the sum an operator should not be doing. TODAY only — a time
  already gone by is refused with `The set time is already due` and arms nothing, never
  rolled over to tomorrow. While a `dueTime` is set the wall clock is the truth and each
  tick RE-READS the remainder from it (a sleeping laptop stops delivering ticks; an
  hour-long countdown that subtracted one per tick would be minutes out).
- **interval** — keeps forcing it every N seconds, and the run going somewhere RESTARTS
  its count: an operator who steps ahead by hand gets the whole interval on the line they
  landed on. It is cleared by its own ⊗ pill, by the widget closing, or by reaching the end
  of the sheet. Do not "fix" this into cancelling.

**A timeout met by a running interval LENDS it its count for one cycle** rather than
replacing it (`borrowPresentingFlowAutoNextCycle`, 2026-08-06) — interval at 5 + a
`Next: Timeout (7)` counts 7 once, then 5, 5, 5. The one crossing between the two, and the
one exception to "arming a second is saying *this instead*": a timeout is nearly always met
as a CC riding a line the run is showing anyway ("hold this one longer"), and killing the
loop walking the sheet is the opposite of that. Firing an INTERVAL is still a re-arm.
`seconds` is untouched (what it goes back to); a time-armed borrow carries `dueTime`, which
is dropped when the cycle ends — an INTERVAL holding a `dueTime` IS a borrowed cycle, and a
spent one left behind would fire every tick.

**Either clock can be HELD** — `setPresentingFlowAutoNextPaused`, the pill's own ⏸/▶ button
(2026-08-06), beside the ⊗ that stops it. Pausing CLEARS the ticking rather than skipping
on a flag (a run sheet left paused must cost nothing), and a paused countdown gives up its
`dueTime`: holding "go on at 7:05" means the run waits that many more seconds from when it
is let go, which is what an operator means while a speaker overruns. A CC'd timeout
BORROWING a held interval's cycle does not let it go. The pill goes dashed while held —
a frozen number that looked like a running one is the thing not to make them guess at.

**Why:** an operator wants a slide to linger and then go on without them, or a loop of
announcement slides to run while they do something else. Both are the run moving, not a
screen changing, so they are run actions and not screen actions.

The third run action is **`jump-to`**, the sheet's GOTO: armed with exactly ONE CC element
that NAMES the line to go to (`ccItemCount: 1`, matched by the target's UUID), never armed with
a number, and never a CC itself. `PresentingFlowItem.checkIsCcTargetHost` is what makes its CC a
POINTER rather than a follower, so `resolveCcItemJson(json, isTarget)` lets it name a DOCUMENT —
the usual target, and the one thing an ordinary CC can never be.

**A jump IS the next-key aimed at a chosen line** — same landing (`landPresentingFlowRunOnIndex`),
so whatever it lands on fires exactly as a step would fire it, **a clock included**. That is
not incidental: interval over a set of slides + a jump at the end pointing back at the
interval IS the looping set. The only thing withheld is another JUMP (`movesRunAtOnce` on
the registry entry, `isFromJump` at the landing) — two aimed at each other would move the
run for ever with nothing in between. Withholding every run action instead was a bug that
silently broke the loop.

A timeout may also be attached to another line as a **CC element** (an interval may not —
`canBeCcItem` on the registry entry): "show this slide, and go on by yourself N seconds
later", and on a DOCUMENT element it rides every slide, which is how a song advances by
itself. See [[presenting-flow-cc-elements]].

**How to apply:**

- Every path that ARMS one settles the cursor FIRST (the preview frame's `onClickCapture`
  runs before the button's `onClick`; `landPresentingFlowRunOnIndex` selects before it fires), so
  arming is never cancelled by the very gesture that armed it. Keep it that way.
- A REPAIR is not a move: `resolvePresentingFlowPreviewSelectedIndex` writing back the position a
  reorder shifted the same element to notifies the panel's listeners ONLY
  (`notifySelectingListeners`), or tidying the sheet would kill a countdown.
- The run CONTROLLER (`stepForward` + `jumpToUuid`) is REGISTERED by
  `PresentingFlowPreviewFloatingComp` (with its filePath), never implemented here — nothing in this module may hold a run sheet or a document's slides.
  Unregistering stops the clock. Arming from anywhere with no matching open run returns
  false, and `sendPresentingFlowItemToScreens` toasts.
- A tick settles the slot BEFORE stepping and re-checks a `generation` counter after, so
  an auto-step that lands on ANOTHER run action hands the clock over instead of being
  overwritten by the tick it came from.
- A CC'd timeout is fired from `applyPresentingFlowCcItemsOnScreenIds` — i.e. only once the
  HOST has resolved its screens, so a dismissed "which screen?" menu starts no countdown —
  and it forces the next selection of the PREVIEW's cursor, wherever that is. Presenting
  the host from the TREE therefore advances the panel, not the tree; that is the same
  thing the next-key would have done at that moment, not a bug.
- `firePresentingFlowRunAction` lives in THIS module, not `presentingFlowHelpers`, so that
  `presentingFlowCcApplyHelpers` can call it without importing back into `presentingFlowHelpers`
  (which imports it). `PresentingFlowItem` is a TYPE-only import here for the same reason.
- `start(presentingFlowItem)` answers with a `tran` KEY to toast (or null), so each action says
  what is actually missing; the toast is titled with the action's own label.
- `actionNumber` and `actionTime` are ALTERNATIVES, so both the question and the setter
  deal in one `PresentingFlowActionArmingType` and `applyPresentingFlowActionArming` DELETES the other
  — `actionTime` wins in `PresentingFlowItem`, so a stale number left behind would be the field
  that quietly stopped mattering. `PresentingFlowItem.actionTime` also answers null for an action
  that may not carry one, so a hand-edited interval is ignored in the row, the question and
  the clock at once.
- Unit tests: `src/presenting-flow/presentingFlowAutoNext.test.ts` (fake timers),
  `presentingFlowActionTime.test.ts` (the clock-time half, `vi.setSystemTime`) +
  `presentingFlowCcPropagation.test.ts` (the CC half).
