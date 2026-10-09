---
name: screen-page-settings-are-page-local
description: "A screen page (screen.html, vd-screen.html, a compositor guest) reads settings from its context snapshot; what the presenter syncs lands in that copy, and a screen never originates a setting -- Bible text contrast is presenter-only"
metadata:
  node_type: memory
  type: project
  originSessionId: 72e1ac67-7514-442e-91d7-e098f96055e3
  modified: 2026-10-09T00:53:37.635Z
---

Since `efedb3b0` (2026-10-05) `appLocalStorage.getItem` in ANY screen page
answers from `screenUtils.getContext().settings` -- the snapshot the page was
opened with -- and a screen never writes the disk. `setItem` / `removeItem`
there used to return without doing anything, which broke every setting the
presenter SYNCS rather than re-sends as layer data. Found by robot run
vd-20261008b (2026-10-08), fixed the same day:

- **A synced setting never took effect on an open screen.** The Bible text
  style (`screen-bible--style-text`: colour, size, shadow) arrives as
  `bible-screen-view-text-style` → `receiveSyncTextStyle` → `setSetting`,
  which dropped it; `ScreenBibleComp` re-rendered from the snapshot. Measured:
  font size 104 in the presenter, 101px on the screen. Now a screen's
  `setItem` writes into its own context copy (page-local, never disk).
- **A screen undid the presenter's contrast fix.** `ScreenManager.initEvent`
  ran on screen pages too: a colour background fired `color-set` there,
  `reflectBackgroundColor` "applied" a contrasting colour that was dropped and
  sent the snapshot's style BACK, and the presenter adopted it -- white Bible
  text on the white background a verse attaches, on the Mini Screen as well,
  right after a toast saying the colour had been changed. `initEvent` now
  returns on `appProvider.isPageScreen` (true in `vd-screen.html` too: the
  stand-in provider names `screenHomePage: '/vd-screen.html'`).

**Rule:** the presenter owns settings; a screen page only takes them in. A new
screen-side handler must not call anything that ends in `sendScreenMessage`
with a SETTING it read itself, and a new synced setting is read through
`appLocalStorage` so it lands in the page's copy. Tests:
`appLocalStorage.test.ts` ("a screen page"), `ScreenManager.runtime.test.tsx`
("leaves the Bible text contrast to the presenter").

Related: [[settings-write-race-corrupts-onscreen-map]] (only non-screen
windows write on-screen maps), [[virtual-displays]].
