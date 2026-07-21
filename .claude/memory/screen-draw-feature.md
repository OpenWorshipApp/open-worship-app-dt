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
Fill, Pointer, Focus (spotlight), Particles, Zoom. Zoom was skipped because it
must scale the whole output content root (background/text), not just an overlay.

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

**Persistence:** per-screen setting key `screen-draw-data-<screenId>` holds
`{drawData, history, historyIndex, isDrawEnabled}` (JSON). Loaded in the manager
constructor (`loadPersisted`); saved (`saveDrawData`) ONLY on committed events
(stroke-complete/undo/redo/clear/enable/disable + `receiveSyncScreen`
sync/commit/clear) — NEVER per pointer-move. Writes gated to
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

**To add another mode:** extend `DrawDataType`, add render + a sync action,
and a tab/panel. The manager mirrors `ScreenForegroundManager`; `'draw'` is
registered in `ScreenManager.getSyncGroupScreenEventHandler` and
`screenTypeList`. `ScreenDrawComp` is mounted in both `MiniScreenAppComp`
(preview) and `ScreenAppComp` (real output).

**Docs debt:** owa-robot-test `user-workflows.md` + `coverage-matrix.md` were
NOT yet updated for this feature (CLAUDE.md asks for it when UI changes).
