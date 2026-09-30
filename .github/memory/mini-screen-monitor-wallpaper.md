---
name: mini-screen-monitor-wallpaper
description: "The mini screen card draws the monitor's WALLPAPER behind its layers, read from the OS — never a desktopCapturer photograph of the display"
metadata:
  node_type: memory
  type: project
  originSessionId: bc1540be-5b63-4911-80d5-2f674d20397b
  modified: 2026-09-27T19:45:44.578Z
---

Each mini screen previewer card draws **that display's desktop wallpaper**
behind everything it renders, in place of the checkered pattern
(`RenderBackdropComp` in `src/_screen/preview/MiniScreenAppComp.tsx`,
`src/_screen/preview/displayWallpaperHelpers.ts`,
`electron/displayWallpaperHelpers.ts`, IPC
`main:app:read-display-wallpaper`). A screen window is `transparent: true`, so
wherever the app puts nothing the audience really does see that monitor's
desktop — the pattern was a stand-in for exactly this.

**Why:** the first cut photographed the display with `desktopCapturer` and the
live run killed it twice over. A capture is the display AS COMPOSITED, so it
drags in every other window that is up: the card for a screen assigned to the
machine's own monitor drew a picture of the app inside itself, one nesting
level deeper per retake. And a photograph has to be retaken to stay honest — a
periodic desktop grab on machines chosen for being cheap, plus a stale frame
ghosting the previous slide behind the current one once a screen is showing.
A wallpaper is a FILE: no other window is in it, and it needs no retaking.

**How to apply:** do not "improve" this back into a screen capture. Read the
wallpaper per platform — Windows `CachedFiles\CachedImage_<w>_<h>_POS*.jpg`
(per-monitor and pre-fitted; ambiguous when two monitors share a size, then
fall back) else `HKCU\Control Panel\Desktop`'s `WallPaper`; macOS `System
Events` `picture of every desktop`, indexed by display position; GNOME
`gsettings`. Those key off a monitor's PIXEL SIZE or its POSITION, so the
renderer passes `displayIndex` and `sizes` from the display list it already
holds rather than the main process reaching for `screen`. One read per display
is shared by every card on it and released with the last one; the desktop's own
layout is copied (Fill / Fit / Stretch / Centre / Tile) because a "Fit"
wallpaper really does show the desktop colour down its sides. A machine that
will not say keeps the pattern — that is an answer, not a failure. The ⋮ menu's
**Show Monitor Wallpaper** turns it off, **Refresh Preview** forces a re-read.
See [[panel-name-in-dom]], [[dev-data-dir-is-separate]].
