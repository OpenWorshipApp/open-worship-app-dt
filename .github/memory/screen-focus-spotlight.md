---
name: screen-focus-spotlight
description: Screen "Focusing" spotlight overlay — its own layer/manager, why it is NOT part of the draw overlay, and the box-shadow dead end
metadata:
  type: project
---

FreeShow-style **Focus / spotlight** on the screen output, a sibling of
[[screen-draw-feature]]. Added 2026-07-21.

**What it is:** press and hold on a mini-screen preview → the whole output dims
and a clear circle follows the pointer; release → undim. Nothing is stored about
what was on screen: no strokes, no undo history, no persisted "what is drawn".
Only three tunables persist (size / dim / edge blur).

**It is a SEPARATE LAYER, not a draw mode.** The first implementation tagged
focus strokes onto `ScreenDrawManager`'s stroke list and rendered them as a
`destination-out` pass over a dim fill. It worked and synced, and the user
rejected it: *"focus is a complete different panel, don't have to have anything
related to drawing… focus should have another layer focus layer"*. Do not merge
them back. Files:
- `src/_screen/managers/ScreenFocusManager.ts` — the whole feature.
- `src/_screen/ScreenFocusComp.tsx` → `<div id="focus">`, mounted in BOTH
  `ScreenAppComp` (output) and `MiniScreenAppComp` (preview), AFTER
  `ScreenDrawComp` so the dim covers the drawing.
- `src/_screen/preview/MiniScreenFocusHandlersComp.tsx` — the panel.

**Separate features, shared MECHANISM (dedup pass 2026-07-21).** Focus and Draw
stay separate, but the two overlays behave identically at the plumbing level, so
the plumbing lives in two shared modules — extend these rather than re-copying
into a third overlay:
- `src/_screen/managers/screenOverlayHelpers.ts` (non-React): `clampNumber`,
  `toAlphaHex`, `applyOverlayBoxStyle`, `applyOverlayFocusability`,
  `applyKeyboardOutline` + `OVERLAY_KEYBOARD_OUTLINE_COLOR`,
  `checkIsKeyboardTarget` (the shadow-root `activeElement` + `document.hasFocus`
  rule), `toNativePoint`, `forwardToOwnScreenOutput` (the targeted-IPC mirror),
  `genFrameScheduler`. `ScreenDrawManager` was rewired onto all of these too —
  its `isFocused`, focus ring, `clientToNative`, output forward and
  `scheduleRender` are now one-liners over this module.
- `src/_screen/preview/miniScreenOverlayControlComps.tsx` (React):
  `handleKeepOverlayFocus`, `useOverlayShortcut` (takes a
  `checkIsShortcutTarget: () => boolean`, read through a ref at KEY time, so
  each panel supplies its own manager's flag), `OverlayRangeComp` (icon + −/+
  steppers + slider + value, and it binds its own four step shortcuts off
  `shortcutBase`) and `OverlayColorSwatchComp` (checkerboard-backed
  `<input type="color">`). Both panels render these; the draw panel's private
  `DrawRangeComp`/`DrawStepButtonComp`/`alphaToHex`/`handleKeepCanvasFocus` are
  gone.

**Rendering: one div, one radial-gradient.** `applyMask()` sets
`background: radial-gradient(circle Rpx at Xpx Ypx, <clear> 0, <clear>
<100-edgeBlur>%, <dim> 100%)` on the `#focus` div itself, where `dim` is
`#rrggbbaa` (the chosen `dimColor` + `dimOpacity` as its alpha) and `clear` is
that SAME colour at alpha `00`. The gradient's last colour continues past the
ending shape — that is what dims the rest of the screen. `edgeBlur: 0` ⇒ both
stops meet at 100% ⇒ hard-edged cut-out.
- **The clear stop is `#rrggbb00`, not the `transparent` keyword.** `transparent`
  is transparent *black*, so a soft rim on a coloured dim would interpolate
  through it and tint the fade. Keep them the same hue.
- **A moving `box-shadow` hole DOES NOT RENDER — don't "optimize" back to it.**
  It was the first design (compositor-only `translate3d` moves, no gradient
  repaint). The spread has to exceed the screen diagonal to cover the corners,
  and Chromium silently drops a shadow that large: verified live, the element
  was present with the right computed style and *nothing painted*, while a plain
  `background` on the same element painted fine.
- No canvas on purpose: a canvas would hold a native-resolution backing store
  (~8MB at 1080p) for as long as the panel is open, for one circle.
- **Repaints are rAF-coalesced** (`genFrameScheduler`, same as the draw
  manager's `scheduleRender`). A precision mouse fires `pointermove` far above
  the refresh rate and every one of them rewrites a FULL-SCREEN div's
  `background` — the hottest path in the feature. `handlePointerMove` and
  `receiveSyncScreen` schedule; pointer-down / `stop()` / the setters still
  paint synchronously (one-off, and the manager tests read `style.background`
  right after them). Also caches the overlay rect for the gesture
  (`gestureRect`), like draw's `strokeRect`, so a move costs no layout.

**Interaction** (presenter only, `!appProvider.isPageScreen`): `pointerdown` on
the overlay starts it, window-level `pointermove`/`pointerup`/`pointercancel`
track and end it (window, not the div, so a drag off the mini-preview still gets
its release). `touch-action: none` on the div + Pointer Events ⇒ touch and pen
work identically. Click-to-toggle was the first cut; the user asked for
press-and-hold instead.

**Sync:** new screen type `'focus'` (`screenTypeList`,
`ScreenManager.getSyncGroupScreenEventHandler`), `FocusDataType` =
`{isSpotlighting, point, size, dimOpacity, edgeBlur}` — the whole state fits in
one tiny message, so there is no incremental protocol. Moves are throttled to
40ms on the wire and never throttled locally. Same two gotchas as the draw
manager, same fixes: `enableSyncGroup(screenId)` before every local send (echo
guard would otherwise permanently block this screen's own sends), and
`forwardToOwnScreenOutput` in `receiveSyncScreen` because the `screenMessage`
IPC is TARGETED to the origin screen's output window.

**Contrast toggle (added same day).** `isContrast` inverts which side of the rim
is dark: off = spotlight (clear circle, dimmed surroundings, "highlight this");
on = contrast (dimmed circle, clear surroundings, "block what the pointer is
over"). It is ONE swap of the gradient's two colours in `applyMask` — the
geometry, blur, sync, persistence and input are all shared. Persisted per screen
and carried on the wire like the rest.

**Dim colour (added same day).** `dimColor` is a `#rrggbb` the mask is tinted
with and `dimOpacity` is simply its alpha — black is the default, a dark brand
colour reads better over some backgrounds. Validated by regex on EVERY entry
(disk, wire, the input) and falling back to `#000000`: a non-hex value makes the
whole gradient string unparseable, which paints *nothing*, i.e. silently undims
a live screen. The panel's swatch is the draw palette's checkerboard-backed
`<input type="color">` — deliberately WITHOUT `handleKeepOverlayFocus`, because
preventDefault on a colour input's mousedown stops the OS picker opening (so
clicking it costs the overlay's keyboard claim, same as the draw swatch).

**Panel-open state persists per MODE (fixed 2026-07-21).** The on/off toggle is
one user-level idea but each control persists it in its OWN manager: Drawing in
`ScreenDrawManager.isDrawEnabled` (inside the serialized draw blob), Focusing in
`ScreenFocusManager.isPanelOpen` (own key `screen-focus-open-<screenId>`,
written immediately, presenter-only). Before this, enabling in Focusing mode
recorded nothing (it deliberately never calls `enableDraw()` — arming the draw
canvas would fight the focus overlay), so a Focusing panel always came back
closed while a Drawing panel reopened.
- `isPanelOpen` is NOT `isArmed` and must never be derived from it: `isArmed` is
  live overlay state written by the panel's mount effect, which StrictMode
  double-invokes, so persisting from there records a spurious close. This is the
  toggle INTENT, written only on the explicit click.
- `ScreenPreviewerFooterComp` funnels both the toggle AND the 3-dots mode switch
  through one `applyEnabledState(mode, isEnabled)`. The mode switch still must
  not CHANGE the state — it re-HOMES it, or a panel enabled before the switch
  comes back closed. Turning OFF writes both (`setIsPanelOpen(false)` +
  `disableDraw()`), keeping the no-stranded-drawing rule below.
- The seed reads whichever manager owns the RESTORED mode. Only the panel comes
  back — `isSpotlighting` stays false, so a restart never restores a dimmed
  screen. Verified live across real reloads (enable focus → reload → panel open,
  screen undimmed; paint-enabled → switch to focus → reload → focus panel open;
  off → reload → stays off). Tests: `ScreenFocusManager.test.tsx` "the panel-open
  toggle persists and reopens, but never the spotlight" and
  `preview.runtime.test.tsx` "the footer reopens the panel of the mode that was
  left enabled" (confirmed to fail against the old seed).

**Panel:** Size (40..1200 native px), Dim colour swatch, Dim (10..100%), Edge
blur (0..100%, 0 = hard), Contrast toggle, Reset. `resetSettings()` assigns all
five fields then does ONE repaint / update broadcast / debounced write — it used
to run the five setters and pay for each five times. Keyboard: reuses `drawShortcutMap` — `[`/`]`
`{`/`}` size, `-`/`=` `_`/`+` dim, and NEW `,`/`.` `<`/`>` blur
(`DrawStepShortcutBaseType` gained `'blur'`) plus `X` contrast (`c` was taken by
the draw panel's Clear). `toShortcutKeys`/`toShortcutTitle` were moved out of
`MiniScreenDrawHandlersComp` into `screenDrawShortcutHelpers.ts` so both panels
share them.
- Keys are gated on `ScreenFocusManager.isShortcutTarget` — named for the
  KEYBOARD, not the feature, because `isFocused` would be hopelessly ambiguous
  in this file. Same implementation as the draw canvas (now literally the same
  function, `checkIsKeyboardTarget`). Pressing a preview claims the keys and
  paints the same cyan ring.
- **`tabIndex` is 0 only while ARMED and on the presenter** (both overlays, via
  `applyOverlayFocusability`; -1 rather than removing the attribute, so the
  programmatic `focus()` on pointer-down still works). It used to be a flat 0,
  which put `#focus` and the draw canvas in the tab order of every mini-preview
  AND of the real output window — tabbing onto one painted the "I own the
  keyboard" ring on an overlay that ignores every key. Verified live: output
  window reports -1 for both; presenter reports 0 only for the open panel's
  overlay.
- Panel buttons carry `onMouseDown={handleKeepOverlayFocus}` (preventDefault) or
  they would steal focus and kill every shortcut.

**Toggle/mode wiring** (`ScreenPreviewerFooterComp`): ONE on/off button plus a
3-dots menu that only switches the *control type* — persisted per screen under
`screen-draw-mode-<screenId>` (`DrawModeType = 'paint' | 'focus'`). Explicit
user requirement: switching mode must NOT change the enabled state (enabled
Drawing → enabled Focusing; disabled stays disabled). The focus panel arms and
disarms its overlay in a mount effect instead of via enable/disable, and
disarming always drops the mask (a dimmed screen with no visible panel would be
a trap).
- **Turning the toggle OFF must call `disableDraw()` whatever mode is showing.**
  The first cut early-returned for `'focus'` on BOTH edges, which stranded a
  drawing: draw something → switch to Focusing (strokes stay, by design) →
  toggle off → `isDrawEnabled` was never cleared, so the strokes stayed on the
  output with no control left to clear them (the focus panel has no Clear) and
  the panel even reopened on next launch. Only the ENABLE edge is mode-gated
  now — arming the draw canvas in focus mode would fight the focus overlay for
  pointer input. Regression test: `preview.runtime.test.tsx`, "switching to
  Focusing keeps the on/off state and still disables drawing when turned off".

**Verified live** on the presenter, a sync-group member and the real
`screen.html?screenId=0` output window: dim + hole, cursor follow, undim on
release, blur 0 = hard edge, and all three shortcut families. Two CDP-testing traps cost real time here:
- `EventHandler.addPropEvent` runs every fired event through a 10ms
  `setTimeout`, so a synthetic `keydown` and the state read must not be in the
  same `evaluate_script` call — the first read looks unchanged and the shortcuts
  look dead.
- `ScreenManager.syncScreenManagerGroup` is **async** (it awaits
  `getGroupScreenManagers`), so group members lag the sender by a microtask.
  Reading a member's DOM in the same tick as the pointer event shows it stuck on
  the previous state — it looks exactly like "the stop never propagated". Await
  ~150ms before asserting on a group member.

**Docs debt (inherited):** owa-robot-test `user-workflows.md` +
`coverage-matrix.md` still cover neither Draw nor Focus.
