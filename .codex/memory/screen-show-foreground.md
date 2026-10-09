---
name: screen-show-foreground
description: "Foreground Screen Show draws screen N's CONTENT inside screen M by running the app's own screen page for N in an iframe, fed N's state by the presenter -- shown or hidden; never a capture of N's window. No self, no loop, one level only"
metadata:
  node_type: memory
  type: project
  originSessionId: 404596bb-2c59-4b25-822a-b55e16e5101e
  modified: 2026-10-09T00:24:24.942Z
---

Built 2026-10-08 at the user's ask (_"clone `camera show` foreground to `Screen Show`
… screen id thumbnail … as a user I want to show a screen in another screen"_; rule
chosen: **no self, no loop**; live in the Mini Screen too). Panel cards are a STATIC
tile per screen (identity colour + id).

**The first cut was a tab capture of N's window and the user rejected it:**
_"wrong design, screen should be rendered independently in screen 0, no need to wait
until it got live"_. A capture needs N's window up; the operator wants N shown even
while it is hidden, which only drawing N from its STATE can do. Do not go back to a
capture (`getMediaSourceId`, `getDisplayMedia`, `desktopCapturer`).

**How it is drawn:** `mountScreenShowFrame` (`src/_screen/screenShowFrameHelpers.ts`)
puts an iframe of `vd-screen.html?screenId=N&screenShow=<key>` in M's overlay box --
the real screen page, its own realm (a second N manager set in the PRESENTER realm
would replace N's: every manager is cached by screen id), at N's own size and scaled
with a transform (the page reloads itself on resize). `vd-screen.ts` gives it the
stand-in provider `screenShowFrameProvider.ts` built from a host the parent puts on
`window.__owaScreenShowFrameHosts`: the parent's provider minus its `isPage*` flags,
settings read lazily, files through the parent's `pathToFileURL`, camera access
through the parent. It sends NOTHING out except its `init`, answered with N's whole
state. Context `isSoundOwner: false` + `isScreenShowFrame: true` keep it silent
(`checkIsPresenterCopySilenced` covers Sound-on foreground video) and stop nesting
(`renderScreen` returns inside a copy).

**Where N's state comes from:** the presenter, which holds it whatever N's window
does. `ScreenManager.postScreenMessage` relays every message for N to each SHOWING M
whose `screenDataList` lists N, wrapped as `screen-show` `{sourceScreenId, width,
height, stage, isSnapshot, messages}` (`relayToScreenShows`), and to the presenter's
own copies directly. Snapshots (`genScreenShowPayload` → `genSyncSnapshotMessages`) go
when N is added to M (`setScreenDataList` → `sendScreenShowSnapshots`), on M's `init`
(`sendSyncScreen`), and in M's bootstrap context (`getMirrorBootstrap`). Main forwards
`screen-show` like any type and `translate` publishes N's files in M's scope.
A screen page keeps the latest STATE message per kind (never video time, scroll or a
stroke) and drops it 3 s after the last copy of N goes.

**See-through** (the user, 2026-10-08: _"it should be transparency"_): where N draws
nothing, M shows. Two things stood in the way. The panel used the text overlays'
common style -- a `#000080AA` backing and a 5px blur -- so it takes
`isCommonStyle: false`, like Video and Image Show. And Chromium paints an iframe
OPAQUE when its colour scheme differs from its element's, so both the iframe and
the frame's root are `color-scheme: normal`. And the copy's box drops any
backing a datum carries (`backgroundColor`/`backgroundImage`/`backdropFilter`
forced in `mountScreenShowFrame`): items placed or saved in a run sheet before
the fix still held the navy, and the user read it as the display's wallpaper
(_"the nature of screen rendering is transparency, no display wallpaper"_). It
was not: sample the pixels -- `#000080AA` over the stars is `#070764`; a
virtual display's wallpaper is the MINI SCREEN's backdrop (`RenderBackdropComp`),
never drawn by a screen page, so it cannot reach a copy.

**Traps met:** `toastHelpers` wrote Node's `global` (dev only) and killed the no-Node
iframe page -- it is `globalThis` now; a floating panel forces `.card-body`
transparent `!important`, so the tile colour sits on an inner box; a mutated snapshot
array (`getMirrorBootstrap` now builds a new one); the frame helper must stay light
(`ScreenManager` imports it), so setting/camera readers are passed in.

Cost: one more screen page (and N's videos decoded again) per copy, in the presenter
AND on the projector. Related: [[foreground-sync-shared-refs]],
[[virtual-displays]] (the same page and stand-in idea), [[scratch-dev-instance-beside-user-app]].
