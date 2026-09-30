---
name: foreground-camera-deviceid-rotates
description: "A foreground camera opens its OWN stream in each window, and Chromium rotates deviceId per document — so the screen window must resolve by label or the projector silently shows nothing"
metadata:
  node_type: memory
  type: project
  originSessionId: a24d7439-2c44-4661-8bf9-b2598198c5cf
  modified: 2026-09-26T15:23:17.632Z
---

A foreground **Camera Show** overlay is not one stream shared between windows. Both the
presenter's mini preview and `screen.html` run `ScreenForegroundManager.renderCamera`, and
each calls `getCameraAndShowMedia` → `getUserMedia` **in its own document**.

Two consequences that look identical to a volunteer — camera live in the mini preview,
nothing on the projector:

1. **`deviceId` rotates per origin and per session.** The screen window is a different
   document from the presenter, so the id the presenter saved is routinely dead there and
   `{deviceId: {exact: …}}` throws `OverconstrainedError`. This is why
   `ForegroundCameraDataType` carries a **`label`** and why `getCameraAndShowMedia`
   resolves through `resolveCameraDeviceId(id, label)` before opening — the same thing
   `slideCameraSyncHelpers` already did for a slide camera item.
2. **A webcam is usually exclusive.** Even with a good id, a second concurrent
   `getUserMedia` on the same device commonly fails with `NotReadableError` on Windows.
   Nothing in code fixes that; the operator has to be told.

The failure used to be `handleError` only, which is `console.trace` + `console.error`
(`electron/client/appUtils.ts`) — so there was no message anywhere the operator would look
while the widget still showed an on-screen dot and a working Hide button.

**`cameraHelpers.ts` must stay a leaf**: it loads in the screen window, so it may not import
`tran`, the toast helpers or anything reaching `SettingManager` (that chain pulls
`appLocalStorage` → `storageFileHelpers`, which touches `appProvider.pathUtils` and breaks
node-env tests). That is why it reports through an **`onUnavailable` callback** instead of
toasting itself. The toast lives in `renderCamera`, guarded by `!appProvider.isPageScreen` —
**a toast in the screen window IS the projector**, the one place it must never appear.

Related: [[slide-website-loads-in-a-box]], [[screen-layer-needs-z-index-above-foreground]].
