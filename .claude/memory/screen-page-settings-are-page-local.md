---
name: screen-page-settings-are-page-local
description: "A screen page (screen.html, vd-screen.html, a compositor guest) reads settings from its context copy; every presentation setting the presenter writes is pushed into that copy as `screen-setting` (and into main's copy for a reload), and a screen never originates a setting -- Bible text contrast is presenter-only"
metadata:
  node_type: memory
  type: project
  originSessionId: 72e1ac67-7514-442e-91d7-e098f96055e3
  modified: 2026-11-07T14:23:21.776Z
---

Since `efedb3b0` (2026-10-05) `appLocalStorage.getItem` in ANY screen page
answers from `screenUtils.getContext().settings` -- the copy the page was
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
- **Every OTHER setting stayed as the screen was opened with it** (2026-11-07,
  the user after a robot run compared Mini Screen and projector: _make sure
  screen mini and real screen are always sync_). Only the text style had a
  message of its own, so **Set Line Sync** (`screen-bible--line-sync-<id>`,
  read at render by `screenBibleHelpers.tsx`) changed the card and left a
  showing projector in columns until it was hidden and shown again -- which
  W-18 had written down as how it works. Now
  `screenSettingPushHelpers.ts` listens to every write of the window
  (`addSettingWriteListener` in `appLocalStorage.ts`, never on a screen
  page) and sends each presentation setting -- the bootstrap's own rule,
  `checkIsMirrorPresentationSetting` in `electron/screenMirrorProtocol.ts`,
  minus the keys whose value IS a layer's state (the four on-screen maps,
  `screen-draw-data-*`) -- to every SHOWING screen as `screen-setting`
  `{ settings: { key: value | null } }`. Same channel as the layer messages,
  so the redraw a setter sends after it already reads it; nothing is
  debounced for that reason. The screen page takes it into its copy
  (`applyMirrorSettingPatch`: presentation keys only, a string sets, `null`
  drops); main takes it into `output.context.settings` too
  (`noteSettingPatch` in `screenMirrorService.ts`, the local window, a
  guest's output and a host's screen here), so a window that RELOADS -- a
  display change reloads it -- or a guest that reconnects opens with the
  current value instead of the one taken at show time. A value of 256 000
  characters or more is sent as `null`, as the bootstrap leaves it out.
  Proven live on the dev app: rows/columns on a showing screen 0 switched
  with each toggle, and a reloaded projector page came back in rows.

**Rule:** the presenter owns settings; a screen page only takes them in. A new
screen-side handler must not call anything that ends in `sendScreenMessage`
with a SETTING it read itself, and a new setting a screen draws with is read
through `appLocalStorage` under a key the presentation rule matches, so the
push carries it -- no message of its own needed. A setting that is a whole
layer's state belongs in `LAYER_STATE_SETTING_NAMES` (or its prefix list), or
every present sends it twice. Tests: `appLocalStorage.test.ts` ("a screen
page", "a write listener"), `screenSettingPushHelpers.test.ts`,
`ScreenManager.runtime.test.tsx` ("leaves the Bible text contrast to the
presenter", "a presentation setting written here goes to every screen that is
up"), `screenMirrorService.coverage*.test.ts` ("goes into the copy").

Related: [[settings-write-race-corrupts-onscreen-map]] (only non-screen
windows write on-screen maps), [[virtual-displays]],
[[screen-bible-columns]], [[long-text-show]].
