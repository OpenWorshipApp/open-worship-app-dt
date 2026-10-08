---
name: virtual-displays
description: "Virtual displays (W-51, SP-30/31): app-only monitors in the display picker, watched as a browser page that draws the screens itself or as a WebCodecs MP4; sound streamed, never local; the compositor exists only while an MP4 plays"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-07T23:54:12.871Z
  originSessionId: d2d65105-9e71-4dd7-9744-fda3c4099ead
---

Built 2026-10-07 at the user's ask. The floating Screen Mirror panel became
**Virtual Screens Manager** with two tabs (Screen Mirror Connection / Virtual
Displays); the open state and tab persist (`virtual-screens-manager-*`), and
every fold in a card persists per display (`virtual-display-<n>-<part>-expanded`,
cleared on a delete made from the card).

**Shape** (all on the Screen Mirror HTTP server, ports 39240-39259):

- Records in the client setting `virtual-displays` (`{nextNumber, list}`; a
  number is NEVER reused — screens remember a display id and QR codes carry the
  number). Display ids are `-500000 - n` (`toVirtualDisplayId`), inside
  `(-1000000, -500000)`, below every mirror guest range. Never the default
  display. Max 8.
- A screen on one is a `VirtualScreenController` (`electron/screenOutputRegistry.ts`
  `getScreenOutput` picks it before an `ElectronScreenController`): no OS window.
  Its messages go to the compositor guest when there is one AND to every browser
  viewer's socket, serialized once.
- **`/vd/<n>/`** (the user's choice, _"Browser renders + MP4"_, after _"if video
  stream not meet this requirement let do different way"_): a plain page that
  stacks one same-origin `<iframe>` of `/vd-screen.html` per screen over the
  wallpaper. Each iframe runs the app's real screen page on a stand-in provider
  (`src/virtual-display/webScreenProvider.ts`, fed by `/vd/<n>/ws`: context
  snapshot, then live messages). Nothing is encoded for it (~0.17 s glass to
  glass). Full screen button + dblclick, Wake Lock else a looping muted 1 KB mp4,
  **Turn on sound** reloads the frames after a tap. A packaged app serves its
  built files to every admitted viewer. A DEV build proxies Vite to every
  admitted viewer (the user turned the internet on and expected it to work —
  2026-10-07) but only the viewer's module graph —
  `checkIsVirtualDisplayDevViewerFile` (two pages, `/@fs/<repo>/src/`,
  `node_modules/` minus dot-dirs except `.vite/deps`, two `tools/` modules, two
  protocol files, the Vite client; no `..`, `\`, `?raw`). Measure the graph
  again with a resource log if the screen page starts importing elsewhere: the
  first symptom is a 404 in that list, and on a phone just the wallpaper.
  Off this computer `/@vite/client` is answered with a stand-in
  (`DEV_VIEWER_VITE_CLIENT`: same exports, styles kept, no HMR) — the real one
  dials a dev socket never opened to the network and fills the console with
  errors and a ping a second. `/favicon.ico` and `/logo192.png` get the 6 KB
  logo (the .ico is 370 KB). A favicon error naming `192.168.x.x` on a page
  opened by the PUBLIC address is Chrome's own (Private Network Access), not
  a request this server made.
- **The browser page cannot ask for a file the way a screen window does.** A
  window's `pathToFileURL` calls `mirror:resource`, which publishes on demand;
  the stand-in only has the snapshot's `resources`. A PowerPoint/HTML slide's
  pictures are RELATIVE to its HTML (`media/x.png`) and never in the snapshot,
  so the slide drew white (its white lyric text vanished with it) — and looked
  fine whenever the MP4 window was open, because ITS requests filled the shared
  list. `genResourceResolver` maps a file inside a published `.html`/`.css`
  file's folder to that page's address, which the server serves whole.
- **A phone is NOT a secure context.** `http://127.0.0.1` counts as secure,
  `http://192.168.x.x` does not, so `crypto.randomUUID` (used app-wide, e.g.
  `CacheManager`), `crypto.subtle`, clipboard, `mediaDevices` and Wake Lock are
  missing there. The screen page died on its first cache and drew only the
  wallpaper — every check made on loopback passed. `vd-screen.ts` calls
  `ensureRandomUUID()` first; test a viewer change on the LAN address, never
  only on 127.0.0.1.
- **`/vd/<n>/video`**: a hidden compositor `BrowserWindow` (main-created,
  `<webview>` per screen, registered in `virtualDisplayHostRegistry.ts` so the AI
  Chat guest guard steps aside — `.claude/rules/aichat.md`) self-captures with
  `getDisplayMedia`, encodes with WebCodecs and a hand-written fMP4 muxer (one
  fragment per frame; MediaRecorder only cut at keyframes, ~1.1 s), fanned out by
  `electron/fmp4Fanout.ts` holding ONLY the init segment — a joiner asks for a
  keyframe. Created on the first MP4 viewer, destroyed 5 s after the last. A
  static picture yields ~1 frame a second (capture is damage-driven).
- **Sound is stream-only**: `ScreenManagerBase.isOnVirtualDisplay` +
  `checkIsSoundHere` (`src/_screen/screenSoundHelpers.ts`) flip which window
  sounds — the screen page plays it (captured per guest via the display-media
  handler returning the guest's `mainFrame`, guests `setAudioMuted`), the
  presenter's copy is muted but still drives play/pause/time/volume.
- **Viewers watch; a hand reaches the app only per client, opt-in** (asked
  for 2026-10-07: _"give toggle option to allow interactive on each
  connection, disable by default"_, _"allow per client"_). Watching now's
  **Allow interaction** switch, off for a new viewer; while on, the screen
  socket's `feedback` packets pass `readVirtualDisplayViewerFeedback` — ONLY
  `bible-screen-view-selected-index` and `sync-scroll-percentage` (two
  selectors), rebuilt field by field, ≤60/s — to `mirror.forwardViewerFeedback`
  → the presenter, as a screen window's own report. Never `visible` (hides the
  screen) or `init` (makes the presenter resend everything). The page is told
  `{type:'interactive'}` so it sends nothing while off. The viewer id is kept in
  `sessionStorage` per tab and the server remembers allowed ids
  (`allowedClients`), so a reload stays allowed; the same id from the same
  address REPLACES its old socket (a reload can beat the old close).
- **Disconnect keeps out a BROWSER by its id, a PLAYER by its address**, for
  10 min or until **Allow again** (the panel's Disconnected list). It blocked
  the address at first, and the user's own tabs on the public address all sat
  on "Waiting for the display" with a console of refused sockets: behind a
  router every device is ONE address (a whole church). A blocked browser is
  let in only to be sent `{type:'refused'}` with the words and closed 4001; its
  page shows them and stops retrying. An MP4 block still covers 127.0.0.1
  (only `?preview=1` from this computer is exempt).

**Bugs this work found in older code:**

- `MirrorContentRegistry.serve` compared `realpath(file)` to the published path
  with `!==`; realpath returns the disk's casing (`c--Users`), the app the casing
  it was given (`C--Users`), so every media file on a VD screen 404'd. Now
  `path.relative(...) !== ''` (case-insensitive on win32).
- `rebind()` hung: `server.close()` waits for UPGRADED sockets, so toggling a
  share switch with a viewer connected left the server down. Sockets are tracked
  per server and destroyed on rebind.
- Background-video sync ids hashed the whole URL, so the presenter's `file:` URL
  and a screen's `/content/...` URL never matched: `toMediaSyncKey` keys on the
  decoded basename.
- The mirror's `translate()` rebuilds every object from its own entries to swap
  paths for URLs, and a `Date` has none: a running countdown/stopwatch reached
  every Screen Mirror guest AND virtual display as `dateTime: {}` and drew
  00:00:00 for good (reported by the user from the MP4 and the preview). Dates
  now pass through untouched, and `ScreenForegroundManager.reviveTimerDates`
  turns the ISO text that JSON delivers (browser page, guest socket) back into a
  Date in `receiveSyncScreen`. Any new `Date` field in screen data needs the same.

**Cameras reach a browser over Screen Mirror's camera relay** (2026-10-07,
reported _"camera not showing on web"_). A camera overlay or camera background
opens a camera on whatever machine DRAWS the page; a phone has none of this
computer's (and on plain `http://` no `mediaDevices`), and before the fix the
page even waited for ever on `main:app:ask-camera-access`. Now the stand-in
renames each on-screen camera to `mirror-camera:<hostId>:<id>`
(`genCameraMapper`; `hostId` rides the web context), answers the permission
question `false`, lists only those cameras for `mirror:cameras`, and carries
`camera-request/-signal/-close` over the screen socket. The server lets a
request through only for a camera that screen SHOWS
(`VirtualScreenController.noteCameras` from every message and the snapshot),
rebuilds every field, caps 8 streams (each is an encode here), and ends a
stream the moment its camera leaves the screen; `routeCamera` then pairs the
viewer (`vd:<viewer>:<screen>`) with the camera broker. `iceServers: []`:
this network only, not the internet. Two traps met testing it: a second app
on the same PC gets **"Device in use"** (Windows lets one app hold a webcam)
-- test with `electron . --use-fake-device-for-media-stream`; and a camera
`<video>` must be `muted` as a PROPERTY or a browser refuses to start it.

**A browser page plays sound only after "Turn on sound"**: it loads its
screens with `sound=1` then, and the stand-in is the sound owner only with it.
Before, every page was the owner at once and an unmuted video threw
NotAllowedError until tapped.

**Driving it in dev:** the presenter deletes `globalThis.provider` after
`appProvider` reads it; raw CDP in a scratch instance reaches IPC through
`require('electron').ipcRenderer` (nodeIntegration). A scratch instance holding
39241 makes `screenMirrorService.test.ts` time out — stop it before the gate
([[scratch-dev-instance-beside-user-app]]). Related: [[screen-mirror-internet-multi-host]],
[[screen-mirror-cross-machine-test]], [[mini-screen-monitor-wallpaper]].
