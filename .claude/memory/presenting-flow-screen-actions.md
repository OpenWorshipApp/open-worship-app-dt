---
name: presenting-flow-screen-actions
description: Presenting Flow "actions" are a non-DragTypeEnum item kind added from a menu; two families now — screen actions and run actions — extend presentingFlowActionList, not the drag pipeline
metadata:
  type: project
---

A presenting flow element can be an ACTION (added 2026-08-04, branch refactor23), not just
content. The registry is `src/presenting-flow/presentingFlowActionHelpers.ts` — id, label, badge,
icon, color, and a `target` discriminant that splits it into TWO families:

- `target: 'screen'` → `apply(screenManager, presentingFlowItem)`. Sixteen ship: the five
  that mirror the mini screen's clear bar, plus one per foreground widget
  (`clear-foreground-<ForegroundDragTargetType>`) built from `foregroundClearMap`, which
  is keyed by that type so a NEW foreground widget without a clear is a compile error.
  The Foreground panel's **Background Images Slide Show** has none on purpose — it drives
  `ScreenBackgroundManager`, so `Clear Background` covers it. Then
  `screen-show` / `screen-hide` (added 2026-08-06), which are about the WINDOW rather than
  what is on it — see [[presenting-flow-screen-show-hide]] — and `slide-media-control`
  (2026-08-08), the one that acts on what is INSIDE a slide and the only entry that reads
  its own stored settings off the entry, which is why `apply` takes it
  ([[presenting-flow-media-control]]).
- `target: 'run'` → `start(presentingFlowItem)` and drives the RUN rather than a screen (added
  2026-08-05, branch refactor24). Five ship: `next-interval` and `next-timeout`, which drive
  [[presenting-flow-auto-next]]; `next-clear-interval` (2026-08-08), which ends a running
  interval and only an interval; `jump-to`, the sheet's GOTO; and `keyboard-event`, the
  hotkey — the ONE of them that reaches a screen at all, and only through its CC elements
  (see [[presenting-flow-keyboard-event]]).

**The `Add Action` menu is FOUR levels now** (2026-08-08): everything that erases folds behind
one `Clear Screen` row — the five whole-layer clears, and inside them the eight per-widget FG
clears behind `Other Clear FG Items` again. Thirteen of the twenty entries clear something, so
inline they WERE the menu. `presentingFlowActionMenuList` is the menu's SHAPE (a flat action or a
`{label, iconName, color, actionList}` group, told apart by `checkIsPresentingFlowActionGroup`);
a group holds MENU ENTRIES, so a family may hold a family, and `PresentingFlowFileComp`'s
`genMenuEntry` walks it RECURSIVELY. `presentingFlowActionList` stays the flat registry an id
resolves against — the stored ids did NOT change, so no migration. Only `PresentingFlowFileComp`
reads the former — a family added later folds itself away without the component learning its
name.

**Why:** an operator's run sheet needs "blank the screen here" between two items, and
the mini screen's clear bar is the only place that lived. Storing it as a presenting flow
element makes it steppable with the next-key like everything else — and once a run sheet
holds instructions, "carry on by yourself from here" is one too.

**How to apply:**

- Add an action = append to `presentingFlowActionList` + widen `PresentingFlowActionIdType`; a new
  FOREGROUND clear is just an entry in `foregroundClearMap` (the id is derived). Appending to
  `presentingFlowActionMenuList` is a SEPARATE decision — `slide-media-control` is in the
  registry and deliberately not in the menu, because it is added from the slide it controls
  ([[presenting-flow-media-control]]).
  Storage, `validate`, the row, the preview, the drag and the next-key all read it
  from there. `PRESENTING_FLOW_ACTION_TYPE` is deliberately NOT a `DragTypeEnum` —
  `acceptedDragTypeList` must keep refusing it so nothing else can produce one.
- Only the id is stored (`{type:'action', data:id}`) plus `actionNumber` for the run
  family, no captured `title` — `PresentingFlowItem.title` calls `tran()` live, so labels
  follow the locale (the number is appended AFTER `tran`, never baked into the key).
  Reuse a label the app already ships or the km key must be added too (see
  [[tran-missing-key-throws-in-dev]]).
- Narrow with `PresentingFlowItem.screenAction` / `.runAction`, never `action.apply` behind an
  `isAction` test. `isShowableOnScreen` is FALSE for every action (they are run, not
  shown); `isScreenReachable` = content + SCREEN actions and is the click / drag / pin /
  menu gate; `isRunReachable` adds the run family and is what the next-key stops on.
  See [[presenting-flow-preview-run-player]].
- Everything routes through `sendPresentingFlowItemToScreens` in `presentingFlowHelpers.ts` — which
  is also where a run action is peeled off BEFORE `armPresentingFlowCcPropagation`: it
  resolves no screens, so a CC attached TO one could never fire (its menu offers no
  `Add CC Elements`). The other direction is open for the timeout only —
  `toCcItemJson` reads `canBeCcItem`, and `applyPresentingFlowCcItemsOnScreenIds` fires it.
- Colours mirror the clear bar's button variants EXCEPT the two `secondary` ones: the
  context menu's own background IS `--bs-secondary`, so those icons were invisible —
  they use `--bs-gray-500`. The run family wears no eraser and no ONE colour: timeout
  `--bs-warning`, interval `--bs-teal`, jump `--bs-purple` — three different things to find
  at a glance mid-service. The row's BADGE is tinted with the icon's colour too (its badges
  are glyphs, not ids), which in practice tints only the action rows.
- A sync-grouped screen takes its whole group with it when an action runs on one
  member; that is the built-in clear button's behaviour too, not a bug here.
