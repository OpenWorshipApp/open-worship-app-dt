---
name: presenting-flow-screen-show-hide
description: Screen: Show / Screen: Hide are the only presenting flow actions that NAME their screens — asked at add time, stored in the ordinary screenIds pin, and no ambient fallback ever
metadata:
  type: project
---

`screen-show` / `screen-hide` (added 2026-08-06, branch refactor24) are SCREEN actions
(`target: 'screen'`, see [[presenting-flow-screen-actions]]) whose `apply` writes
`screenManager.isShowing` — the run sheet's copy of `ShowHideScreenComp` / `F5`. Every
other action changes what is ON a screen; these change whether there is one, which is the
only thing an unattended sheet could not do (light the screen for a pre-service loop
walked by a `Next: Interval`, darken it at the end — see [[presenting-flow-auto-next]]).

**Why:** an automated running order that fills a screen and clears it still leaves the
window up holding the last thing, and nobody is at the machine to press F5.

**How to apply:**

- **They are the one family with `requiresScreenIds: true`**, and that flag is the whole
  design. `PresentingFlowFileComp`'s Add Action menu calls `askForPresentingFlowActionScreenIds`
  BEFORE the line is written (a `showAppInput` checklist, one row per
  `getAllScreenManagerBases()`), exactly as the run family is asked for its seconds —
  cancel adds nothing, an empty tick is refused with `Please choose at least one screen`.
  The answer goes through `fromActionId(id, arming, screenIds)` into the ORDINARY
  `screenIds` pin, so the row draws the usual badge and `Set Specific Screen` re-aims it;
  an empty list omits the key rather than storing `[]`.
- **No ambient fallback, ever.** `sendPresentingFlowItemToScreens` refuses with the same toast
  when the pin is empty instead of letting `chooseScreenIds` fall through to the selected
  screens and then to the menu — a "which screen?" menu at 7:05 with nobody there is a
  screen that never goes up. `applyPresentingFlowCcItemsOnScreenIds` has its own branch for the
  same reason: as a CC it uses `ownScreenIds` and never `resolveCcScreenIds`'s host
  fallback. `Apply on Screens` (`isForceChoosing`) still asks — that entry IS the operator
  saying "somewhere else" — and does not rewrite the pin.
- **`apply` reads `isShowing` before writing.** The setter does real show/hide window work
  and fires `visible` on every write; an interval walking past a `Screen: Show` each cycle
  must not pay for it.
- **`ccItemCount` moved to `PresentingFlowActionBaseType`** so a SCREEN action can refuse hosts
  too (these two are `0`, every clear stays `Infinity`); `PresentingFlowItem.getMaxCcItemCount`
  now reads the registry entry whatever the family, and an unknown id answers 0. Being a
  CC is untouched and deliberate — "put this last slide up AND light the screen" — see
  [[presenting-flow-cc-elements]].
- Icons/colours mirror the mini screen toggle: `file-slides-fill` green / `file-slides`
  red, badges `ON` / `OFF`. Menu order is clears → FG group → these two → run family.
- Matrix row `PL-100`; the presenting flow deep mode scope is `PL-81..101` (68 rows) now.
