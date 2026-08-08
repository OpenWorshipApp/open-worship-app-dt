---
name: reveal-original-context-menu
description: Locating a presenting flow entry's origin is the "Reveal Original" context-menu item (genRevealOriginal), not the 3-second hover it replaced
metadata:
  type: project
---

Presenting Flow rows used to point at where an entry came from once the pointer had rested on
them for 3 s. That affordance was replaced (2026-08-04, branch refactor23) by an
explicit context-menu item — **Reveal Original** (km `បង្ហាញកន្លែងដើម`, `eye` icon).

- The factory is `genRevealOriginal(originElementGetter, isForceWidgetReveal?)` in
  `src/others/FileItemHandlerComp.tsx`, alongside `genCommonMenu` /
  `genShowOnScreensContextMenu` — shared so any row type can take the item; it just
  calls `notifyElementHighlight`. `isForceWidgetReveal` is a placeholder (TODO: open
  the target widget when it is hidden) and is currently ignored.
- Wired in two places today: presenting flow element rows (`PresentingFlowItemComp`, first item in
  the menu) and the slide child rows under an expanded document
  (`PresentingFlowDocumentSlidesComp`, via `toVarySlideOriginElementGetter`).
- The origin *selectors* did not change and still live in
  `src/presenting-flow/presentingFlowOriginHelpers.ts` (`toOriginElementGetter`): background
  thumbnail, Documents row, previewer slide, bible item, foreground button — null for
  a colour or camera entry.
- `notifyPresentingFlowItemOrigin` survives for the non-menu callers: clicking an audio
  entry (the Audios panel owns playback, so the click points at the track instead of
  playing it) and the floating preview. It is the only path that calls
  `openBackgroundAudioTab()` first — the menu item does **not**, so Reveal Original on
  an audio row with the ♫Audios♫ split closed finds no element and quietly gives up.
  That is exactly the gap the `isForceWidgetReveal` TODO stands for.

**Why:** a 3-second dwell fires while the pointer is merely crossing a list, and
nothing on screen advertises that waiting does anything; a right-click item is
discoverable and deliberate.

**How to apply:** don't reintroduce a hover timer for this, and don't hand-roll a
reveal — push `genRevealOriginal(...)` into the row's menu. Two leftovers of the old
path are still in the tree: `HOVER_NOTIFY_DELAY_MS` in `presentingFlowOriginHelpers.ts` now
has no consumer, and the doc comment above `notifyPresentingFlowItemOrigin` still credits
"the hover-after-3s affordance".

See [[presenting-flow-references-vs-presets]] for how the entries these rows point at are
stored.
