---
name: reveal-original-context-menu
description: Locating a presenting flow entry's origin is the "Reveal Original" context-menu item (genRevealOriginal), not the 3-second hover it replaced
metadata:
  type: project
---

Presenting Flow rows used to point at where an entry came from once the pointer had rested on
them for 3 s. That affordance was replaced (2026-08-04, branch refactor23) by an
explicit context-menu item — **Reveal Original** (km `បង្ហាញកន្លែងដើម`, `eye` icon).

- The factory is `genRevealOriginal(reveal: () => void)` in
  `src/others/FileItemHandlerComp.tsx:118`, alongside `genCommonMenu` /
  `genShowOnScreensContextMenu` — shared so any row type can take the item. It
  takes the whole ACTION, not an element getter — some origins must open their
  panel before they have an element at all.
- Both wirings live in `src/presenting-flow/presentingFlowItemMenuHelpers.ts`:
  element rows via `genPresentingFlowItemContextMenuItems` (first item, omitted
  for `isAction` entries — an action has no original), slide child rows via
  `genPresentingFlowVarySlideContextMenuItems` → `notifyVarySlideOrigin`.
- The origin *selectors* still live in
  `src/presenting-flow/presentingFlowOriginHelpers.ts` (`toOriginElementGetter`).
- `notifyPresentingFlowItemOrigin` is shared by the menu item AND the non-menu
  callers (clicking an audio entry, the floating preview). It opens the Audios
  split itself for an audio entry, so Reveal Original on an audio row with the
  ♫Audios♫ panel closed WORKS — the old `isForceWidgetReveal` placeholder and
  `HOVER_NOTIFY_DELAY_MS` leftover are both deleted (zero hits outside memory
  files).
- `notifyPresentingFlowCcOrigin` is a third, separate path for CC rows: it
  queries the tree and the floating-preview roots synchronously by uuid,
  because for a CC a closed widget is an answer, not something to poll for.

**Why:** a 3-second dwell fires while the pointer is merely crossing a list, and
nothing on screen advertises that waiting does anything; a right-click item is
discoverable and deliberate.

**How to apply:** don't reintroduce a hover timer for this, and don't hand-roll a
reveal — push `genRevealOriginal(...)` into the row's menu.

See [[presenting-flow-references-vs-presets]] for how the entries these rows point at are
stored.
