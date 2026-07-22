---
name: screen-draw-feature
description: Screen Draw overlay feature — scope, architecture, and how to extend to more FreeShow modes
metadata:
  type: project
---

FreeShow-style "Draw" overlay on the screen output, driven from the presenter
mini-screen previewer. Added 2026-07-20.

**Scope shipped: Paint mode ONLY.** The user explicitly deferred the other
FreeShow Draw modes and chose to SKIP Zoom entirely. Not implemented yet:
Fill, Pointer, Particles, Zoom. Zoom was skipped because it must scale the whole
output content root (background/text), not just an overlay.
**Focus (spotlight) SHIPPED 2026-07-21 as a separate layer** — see
[[screen-focus-spotlight]]. It is deliberately NOT a draw mode: no strokes, no
history, its own `#focus` overlay and `ScreenFocusManager`. The previewer's
3-dots menu switches which control (Drawing / Focusing) the toggle and panel
drive. An earlier attempt that made it a stroke `mode` on this manager was
built, verified working, and then rejected by the user — don't redo it.

**Key files:**
- `src/_screen/managers/ScreenDrawManager.ts` — the paint engine. Holds
  `drawData: { paintStrokeList }`, renders strokes to a `<canvas>` it appends
  to its `#draw` div, captures pointer input (only when `!isPageScreen`, i.e.
  presenter side, and only while `paintTool !== null`).
- `src/_screen/preview/MiniScreenDrawHandlersComp.tsx` — the Paint control
  panel (Color, Size, Straight, 3D, Dots, Clear drawing) shown in the previewer
  footer. It arms/disarms the tool via `screenDrawManager.setPaintTool(...)`.
- `DrawSwitchComp` (brush icon) lives in
  `src/_screen/preview/ScreenPreviewerFooterComp.tsx`, next to the sound-wave
  audio toggle — mirrors that show/hide-panel pattern (local `useState`).

**Persistence:** per-screen setting key `screen-draw-data-<screenId>` holds a
JSON **v2 deduped** blob: `{version:2, drawData, strokePool, historyIds,
historyIndex, isDrawEnabled}` (`serialize()`). History snapshots share stroke
refs in memory but FLATTEN on `JSON.stringify` — the naive `history: [[stroke,
...], ...]` form is O(history × strokes), quadratic as a drawing grows — so each
unique stroke is stored ONCE in `strokePool` (keyed by id) and history as arrays
of ids (`historyIds`); `parsePersistedHistory` rebuilds it (and still reads the
legacy inline `history` form). Loaded in the constructor (`loadPersisted`);
`saveDrawData` fires on committed events only (stroke-complete/undo/redo/clear/
enable/disable + `receiveSyncScreen` sync/commit/clear) — NEVER per pointer-move
— and is **trailing-debounced 500ms** (`saveAttempt = genTimeoutAttempt(500)`)
so a burst collapses into one `fsWriteFileSync` off the pointer-up critical path;
`delete()` flushes it immediately (`saveAttempt(fn, true)`). Writes gated to
`appProvider.isPagePresenter` (settings are a shared file — output windows
restore via the presenter's init re-sync, avoiding write races). The footer's
`isDrawHandlersVisible` initializes from `screenDrawManager?.isDrawEnabled` (the
`?.` matters — preview test mocks lack `screenDrawManager`), so the panel
re-opens on reload. So a drawing + its undo/redo stack + the toggle all survive
an app reload.

**Sync design (performance-critical):** coordinates are NATIVE screen pixels
so a stroke drawn on the CSS-scaled mini-preview renders identically on the
unscaled output + group members (`clientToNative` divides by the canvas
`getBoundingClientRect`). Wire messages are tiny incremental actions —
`begin` (stroke header) then throttled `points` batches (~60ms) — NOT a full
snapshot per move. Full `sync` snapshot only on init/screen-show. Receivers
CLONE incoming data (sync-group members share message object refs in-process,
see [[foreground-sync-shared-refs]]).

**Enable/disable lifecycle (toggle-driven, NOT effect lifecycle):** the draw
toggle click in `DrawSwitchComp` (ScreenPreviewerFooterComp) calls
`screenDrawManager.enableDraw()` / `disableDraw()`. Enable → `sendSyncScreen(true)`
requests the group's existing drawing (needs `GroupMembershipInf` +
`setGroupMembershipInf` in the ScreenManager ctor, like background/vary). Disable
→ clears ONLY if no other group member has `isDrawEnabled` (so an active member
keeps the shared drawing). Do NOT put clear/request in a React effect cleanup:
the presenter runs under StrictMode, whose mount→cleanup→mount double-invoke
fires a spurious clear (observed as a 1→0→1 stroke transient + stale canvas). The
panel's arming effect (setPaintTool) can stay in an effect — it's local and
idempotent.

**Keyboard:** the paint `<canvas>` is `tabIndex=0` (focused on pointer-down).
Its `keydown` handler (presenter side only, while armed) does Ctrl+Z=undo,
Ctrl+Shift+Z / Ctrl+Y=redo, and `stopPropagation()`s ALL keys so the app's
`document.onkeydown` global shortcuts don't fire while the canvas is focused.

**Palette shortcuts (added 2026-07-21).** `src/_screen/managers/
screenDrawShortcutHelpers.ts` is the single source of truth: `drawShortcutMap`
(id → `EventMapperType[]`), `DrawStepShortcutBaseType` and
`checkIsDrawShortcutKey`.
Bindings: `E` toggle eraser (same key on/off — user requirement), `B` back to
paint, `[`/`]` size ∓1 and `{`/`}` ∓5, `-`/`=` opacity ∓1 and `_`/`+` ∓5,
`S`/`3`/`D` straight/3D/dots, `Q` quality, `R` reset, `C` clear (undoable),
Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo-redo. Every plain letter/punct key was free
— the app's own globals are only F5–F10, arrows, PageUp/Down, Space and Ctrl
combos. Design points that matter:
- It lives in a **non-React module** on purpose: `ScreenDrawManager` imports
  `checkIsDrawShortcutKey` to make its canvas `keydown` RETURN (not
  `stopPropagation`) for these keys, so they reach `document.onkeydown` while
  the canvas holds focus — i.e. mid-stroke, when they matter most. Importing the
  lazily-loaded panel from the manager would defeat the lazy chunk.
- `checkIsDrawShortcutKey` MUST resolve the key with
  `KeyboardEventListener.toEnUsKey(event)` (physical `code`), not `event.key` —
  that is what the dispatch side matches on. Keying off `event.key` made every
  letter/digit shortcut dead on AZERTY/Dvorak/Colemak: the canvas swallowed the
  key as "not a shortcut" while the panel was still listening for it.
- The panel binds them with `useKeyboardRegistering` in `useDrawShortcut`, which
  **drops auto-repeat** unless the binding opts in (only the +/- steps do). A
  held `C` otherwise pushed ~30 empty snapshots/second and flushed the 50-deep
  undo history it is supposed to preserve; held `Q` reallocated the backing store
  and broadcast a full-history sync per repeat; held toggles just flapped.
- `undo`/`redo` are deliberately NOT bound in the panel — the map still declares
  them so the buttons can show the keys, but a binding would be unreachable: the
  canvas keydown handler consumes Ctrl+Z / Ctrl+Y and `stopPropagation`s before
  `document.onkeydown` runs, and the hook only acts while that canvas is focused.
- Panel buttons carry `onMouseDown={handleKeepCanvasFocus}` (preventDefault).
  Without it, clicking ANY palette button moved focus off the canvas, which both
  killed every shortcut and turned the user's next drag into a silent no-op
  re-select. The range/color inputs still take focus — they need the default
  mousedown to drag — so palette keys do go quiet after a slider drag.
- It deliberately does **not** `preventDefault()`: with N screen previewers open
  there are N panels, and `EventHandler.checkOnEvent` breaks the listener loop on
  `defaultPrevented`, which would silently drop the other panels' listeners.
- **Click-to-select gates EVERYTHING (user requirement, arrived at over three
  rounds).** `ScreenDrawManager.isFocused` (was `isShortcutTarget`) is true only
  while that screen's own canvas holds focus, and it gates BOTH the palette
  shortcuts AND `handlePointerDown`. So a pointer-down on an unfocused overlay
  only focuses it and returns — no stroke — and the user must click a mini-screen
  to select it before drawing/erasing there. Rejected along the way: "nobody
  focused → every panel reacts" (keys firing behind the user's back) and
  first-click-also-paints (stray marks when reaching for the right preview).
  Consequences: no typing guard is needed (the key event's target is always the
  canvas — an earlier `checkIsTypingTarget` helper was deleted as unreachable),
  and no static focus registry is needed (read the DOM directly). Focus MUST be
  read off `canvas.getRootNode().activeElement`, NOT `document.activeElement` —
  the overlay is inside the mini-screen's shadow root, so document-level focus
  only ever reports the shadow host. Any test that drives a stroke via synthetic
  pointer events now needs TWO pointer-downs (or a `focus()`) first.
  `isFocused` also requires `document.hasFocus()`: `activeElement` survives the
  window being deactivated, so without it the click that merely brings the
  presenter back to the foreground landed as a stroke.
- `handlePointerDown` bails on `event.button !== 0`. The armed overlay covers the
  whole mini-screen, so a right-click aimed at the preview's context menu
  otherwise claimed the keyboard and (once focused) left a dot behind.
- **Focus ring.** `applyFocusOutline` puts a translucent cyan
  (`FOCUS_OUTLINE_COLOR`, user-tuned) `outline` on the focused canvas —
  `outline`, not `border`, so nothing reflows. Width scales with the screen width
  (`width/480`, min 2) because the overlay is sized in NATIVE px and then
  CSS-scaled by the previewer; a fixed 2px ring renders sub-pixel.
  `setPaintTool(null)` blurs, so closing the panel drops both the ring and the
  shortcut claim.
- Bindings must stay in sync with the button `title`s via `toShortcutTitle`.

**Undo/redo (shared across the group):** `ScreenDrawManager` keeps a snapshot
history (`history`/`historyIndex`, cap 50; shallow copies sharing immutable
stroke refs). It's kept in LOCKSTEP across sync-group members: a finished stroke
broadcasts a lightweight `{action:'commit'}` (no data — receivers snapshot their
already-synced drawData), `clear` records an empty snapshot on receivers too,
and `undo`/`redo` + `toSyncMessage` send the FULL history on the `'sync'` action
(`history`+`historyIndex`). So undo/redo on any member affects all members, and a
screen enabling later ADOPTS the full undo stack (answered "can history be shared
to newly enabled drawing" — yes). Buttons: undo/redo icons + icon-only eraser.

**Group→output-window gotcha (fixed):** the `screenMessage` IPC is TARGETED —
`electron/electronEventListener.ts` routes a presenter message only to
`ElectronScreenController.getInstance(screenId)` (the ORIGIN screen's output
window). So group-syncing to another member updates its presenter mini-screen
(in-process `syncScreenManagerGroup`) but NOT its output window. Fix: draw's
`receiveSyncScreen` calls `forwardToOwnScreenOutput(data)` — presenter-only, a
RAW `sendScreenMessage` (no `enableSyncGroup`, so the echo-guard flag stays set
and it can't loop back to the group) that re-sends to this screen's own output
window. `ScreenForegroundManager` gets this for free because its
`receiveSyncScreen` re-sends via `saveForegroundData→sendSyncScreen`.

**Render quality (fast vs high quality, added 2026-07-20):** manager field
`isHighQuality` (default TRUE = high quality, per user request 2026-07-20; when
the shared setting key is unset both the manager's `loadPersisted` and the panel's
`DEFAULT_HIGH_QUALITY` default to true). Fast = 1× backing store + straight
polyline segments (the cheap low-spec fallback). High quality = `HQ_SCALE`(2)×
supersampled backing store (real edge AA via downscale-on-display) +
quadratic-curve smoothing through sampled midpoints + `imageSmoothingQuality:
'high'`. Backing-store resolution is per-canvas so quality is manager-level (NOT
per-stroke like straight/3d/dots). Persisted per screen under shared key
`draw-paint-quality-<screenId>` (read by BOTH presenter + output managers on load
via `DRAW_QUALITY_PREFIX`, and by the panel's `useStateSettingBoolean`). Live
toggle: panel calls `setRenderQuality(bool)` → persists, `scheduleRender`
(setupContainer resizes the backing store), and broadcasts a full `buildSyncAction`
carrying `isHighQuality` so the output window + group members switch fidelity in
lockstep (receiveSyncScreen adopts it on `'sync'`). NOT driven from an effect
(would re-broadcast every panel mount). 2× = 4× overlay-canvas memory, so it's
strictly opt-in per the low-spec mandate; fast mode is unchanged/free.

**Manual eraser (yellow toggle, added 2026-07-21).** A second eraser sitting
left of the red `bi-eraser-fill` "Clear drawing" button: an `outline-warning`/
`warning` toggle (`bi-eraser`, `aria-label="Manual eraser"`) that arms the brush
to ERASE instead of paint, so a drag rubs out any chunk of the drawn lines.
Implemented as **just another stroke**, which is why it needed no new plumbing:
`DrawPaintStrokeType.isEraser?` + `PaintToolType.isEraser?` (both OPTIONAL, so
old persisted blobs and existing `setPaintTool` callers/tests still typecheck),
and `drawStroke` sets `ctx.globalCompositeOperation = 'destination-out'` with an
opaque style (only source ALPHA matters for destination-out; the stored color is
irrelevant). The existing per-stroke `ctx.save()/restore()` resets the composite
op, so no leakage into later strokes. It therefore rides the existing
begin/points/commit sync, undo/redo history, and v2 persistence for free.
- Eraser strokes force `isStraight/is3D/isDots` to FALSE at creation
  (`handlePointerDown`) — a 3D-shadowed destination-out stroke would erase a
  blurry halo, and dotted/straight erasing is unintuitive. So an eraser always
  falls through to the plain dot / HQ-curve / polyline branches.
- Ordering matters and is the desired semantic: an eraser only affects strokes
  EARLIER in `paintStrokeList`; painting after erasing draws on top normally.
- The panel's `isEraser` is transient `useState(false)` — deliberately NOT
  persisted (unlike straight/3D/dots), so a reload never reopens mid-erase. It
  is included in `updatePaintToolParams` deps and reset by "Reset settings".
- An eraser stroke over empty space still counts for `isShowing`/canvas sizing.
  Known trade-off of the "eraser is just a stroke" design: erasing is purely
  ADDITIVE, so rubbing a drawing out completely never shrinks `paintStrokeList`,
  never releases the (up to 33MB) backing store, and leaves every erased stroke
  being replayed each frame — erasing raises render cost while lowering visible
  content. Only `Clear` actually reclaims. A fix means stroke-list compaction
  (dropping fully-covered strokes), which the current model has no geometry for.
- The Opacity control is silently INERT while the eraser is armed: `drawStroke`
  paints eraser paths fully opaque because only source alpha matters for
  `destination-out`. Honouring the stored alpha would give a soft/partial eraser
  (the stroke already carries the colour, unused) — deliberately not done, since
  arming the eraser at 5% opacity would then look broken.
- Verified live: drag cut a chunk out of the loop on the presenter preview, and
  it synced to the group member AND the real `screen.html?screenId=0` output
  window; undo restored it.

**Coords are native px of the SOURCE screen** — fine when group members share a
resolution (typical). Cross-resolution group members would misplace strokes;
switch to normalized 0..1 coords if that ever matters.

**Group-sync gotcha (fixed):** every LOCAL send MUST call
`ScreenDrawManager.enableSyncGroup(this.screenId)` first (done in
`sendDrawMessage` + overridden `sendSyncScreen`). Reason: when a screen RECEIVES
a group sync, `ScreenManager.syncScreenManagerGroup` sets that screen's
`noSyncGroupMap['screen-draw-m'] = true` as an echo guard, which then
permanently blocks that screen's OWN outgoing draws (`checkIsSyncGroupEnabled`
returns `!flag`). `ScreenForegroundManager` re-enables the same way. Without
this, sync is one-directional (the screen you drew on first works; a screen that
received first can't send back).

**Perf optimizations (review pass, 2026-07-20).** Applied after a multi-agent
review flagged eager allocation vs the low-spec mandate. All keep behavior;
`ScreenDrawManager.test.tsx` covers the changed logic:
- **Lazy canvas backing store.** `setupContainer` (styles + canvas creation, on
  the div-set/`refresh`/`render()` path) is split from `syncCanvasSize` (the
  per-frame `renderAllStrokes` path). `syncCanvasSize` keeps the backing store at
  **0×0 whenever `paintStrokeList` is empty**, sizing to native×`renderScale`
  only when there's something to draw and releasing on clear. Previously every
  screen AND every mini-preview held a native×HQ_SCALE(2) = ~33MB canvas for the
  app's life even if Draw was never used. Do NOT re-merge `setupContainer` into
  the per-frame path (resize re-applies div dims only via `render()`).
- **Straight strokes keep 2 points.** `handlePointerMove` rubber-bands
  `stroke.points = [first, current]` for `isStraight && !isDots` (Dots needs
  every point — it draws a dot at each, and the `isDots` branch precedes
  `isStraight` in `drawStroke`). Stops unbounded point accumulation + O(n²) IPC
  on a slow straight drag.
- **Cached stroke rect.** `strokeRect` captured at pointer-down, reused by
  `clientToNative` for the gesture (canvas can't move under pointer capture),
  cleared on up/detach — no `getBoundingClientRect` reflow per move.
- **Panel arming split.** `MiniScreenDrawHandlersComp` arms/disarms Paint in a
  mount-only effect (`[screenDrawManager]`) and pushes brush params via a
  separate effect calling `updatePaintToolParams` (in-place, no pointerEvents
  flip / update broadcast) — a slider tick no longer disarm/re-arms.
- **Quality single-writer.** The panel seeds `isHighQuality` from
  `screenDrawManager.isHighQuality` via plain `useState` (manager's
  `loadPersisted` already read the shared key); `setRenderQuality` is the sole
  persister (was a redundant second `fsWriteFileSync`).

Deferred (noted, not applied): offscreen committed-stroke render cache (F4 —
trades memory, the #1 concern, for an unmeasured per-frame CPU win) and sizing
the mini-preview backing store to its CSS display size rather than native×HQ
(changes the coord mapping — needs live verification).

**Shared overlay plumbing (2026-07-21).** After Focus shipped, everything the
two overlays do identically was pulled into
`src/_screen/managers/screenOverlayHelpers.ts` (keyboard-target check, focus
ring, native-px mapping, `forwardToOwnScreenOutput`, `genFrameScheduler`,
`toAlphaHex`) and `src/_screen/preview/miniScreenOverlayControlComps.tsx`
(`useOverlayShortcut`, `OverlayRangeComp`, `OverlayColorSwatchComp`,
`handleKeepOverlayFocus`). This manager and its panel now consume those — see
[[screen-focus-spotlight]] for the full inventory. Behaviour is unchanged EXCEPT
the canvas `tabIndex`, which is now 0 only while armed on the presenter.

**To add another mode:** extend `DrawDataType`, add render + a sync action,
and a tab/panel. The manager mirrors `ScreenForegroundManager`; `'draw'` is
registered in `ScreenManager.getSyncGroupScreenEventHandler` and
`screenTypeList`. `ScreenDrawComp` is mounted in both `MiniScreenAppComp`
(preview) and `ScreenAppComp` (real output).

**Docs debt:** owa-robot-test `user-workflows.md` + `coverage-matrix.md` were
NOT yet updated for this feature — not the original Paint panel, not the
2026-07-21 manual eraser, not the palette shortcuts (CLAUDE.md asks for it when
UI changes). The shortcuts also belong in the `KB-xx` keyboard matrix.
