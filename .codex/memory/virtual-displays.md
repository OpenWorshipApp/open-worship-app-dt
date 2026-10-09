---
name: virtual-displays
description: "Virtual displays (W-51, SP-30/31): app-only monitors in the display picker, watched as a browser page that draws the screens itself or as a WebCodecs MP4; sound streamed, never local; the compositor exists only while an MP4 plays"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-09T01:04:59.060Z
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
  router every device is ONE address (a whole church). The disconnected page
  gets `{type:'refused'}` with the words, closed 4001, and stops retrying
  until its **Retry**. **Coming back, a blocked browser is let in only to
  ASK** (2026-10-08, reported _"after host disconnect then client unable to
  connect again"_ -- Retry met the block and nothing else): it waits for
  approval from ANY network and even in code mode (the code must not get it
  past the operator's Disconnect); `VirtualDisplayService.allow` lifts its
  block before granting, or `checkIsActive` would refuse its screens. Reject
  blocks it again. An MP4 block still covers 127.0.0.1
  (only `?preview=1` from this computer is exempt); a player cannot ask.
  EN-41 detaches screen broadcasts, input authority and camera routes
  synchronously on revocation/replacement; a delayed WebSocket close must
  never keep the old viewer authorized or clear its replacement's cameras.
- **An internet viewer is let in by the operator or by a code** (2026-10-08,
  asked: _"virtual display internet address for web access should have option
  approve each connection or require connection code"_). Client setting
  `virtual-display-access` (`approve` default | `code`), secure setting
  `virtual-display-code` -- its own, not Screen Mirror's, but wrong codes count
  toward the SAME per-sender lockout (`mirror.checkSenderCode`). Only
  `network === 'internet'`; this computer and its own networks are not asked.
  A waiting browser's socket is accepted and sent `{type:'access', waiting}`
  -- NO layout, so no screen socket (`checkIsActive` needs `waiting === null`)
  and no `/content/` URL (those are random ids handed out only in contexts).
  Allow / the right code sends the layout and remembers the viewer id
  (`grantedClients`, like `allowedClients`), so a reload is not asked again.
  At most 8 waiting browsers across every display. A PLAYER (`/vd/<n>/video`)
  in approve mode is HELD (the response waits, listed as waiting, 403 after
  5 min) and Allow grants its ADDRESS for that display; in code mode it gives
  the code as HTTP Basic's password (401 + `WWW-Authenticate` makes VLC and
  browsers ask) on EVERY connection -- one right code does not open the whole
  address. The option or code changing, or the internet closing, ends every
  internet viewer and forgets every grant.

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

**A looping video background went missing — FIXED 2026-10-08** (reported
from a browser page: _"the background occasionally missing"_; the MP4 showed it
too). Not the virtual display: a screen PAGE rendered its background twice in
one tick on load, both copies went up, and the end-of-lap crossfade then parked
them all at opacity 0 -- see [[video-loop-crossfade-two-elements]]. The
presenter's Mini Screen never showed it, which is what made it look like a
viewer bug. Caught by sampling the browser page's `#background` children every
250 ms over several laps: THREE copies at load, all at opacity 0 by the third.

Browser cameras, the intercom and the MP4 mic:
[[connection-intercom-and-viewer-camera]].

Casting a display to a TV, from the app or a browser: [[cast-to-tv]].

**Robot run vd-20261008 ("fix and enhance") -- the rules it left:**

- **Every key `toScreenSrc` writes must be in `DEV_VIEWER_PAGE_QUERY_KEYS`**
  (`virtualDisplayProtocol.ts`). `sound` was missing: _Turn on sound_ on a
  phone of a DEV build reloaded every screen as a 404 -- the wallpaper alone,
  no error. 127.0.0.1 never goes through that filter, so a loopback test
  passes; test the page on the LAN address.
- **A page-relative app address is not a disk path.** `/assets/blank.png`
  (every PDF's blank slide 0) passed `path.isAbsolute` in `translate()` and was
  published as `C:\assets\blank.png` (the root on macOS): a 404 and a broken
  "pdf-image" icon on every viewer and guest. `toAppFile` maps it like a
  `getRootUrl()` URL, before the absolute-path branch.
- **The port is sticky.** `listen()` asks first for `screen-mirror-last-port`
  and retries a busy first port 12 × 250 ms before moving on: a restart used to
  find 39240 still held by the closing copy and took 39241 (seen 39240 → 39241
  → 39240 on three dev relaunches), leaving every bookmark and printed QR on a
  dead address. A port change also gives a browser a new origin, so its
  sessionStorage viewer id (and Allow interaction) is lost.
- **Windows shares a port between a loopback bind and an every-network one.**
  A second dev copy (hosting off → `127.0.0.1:39240`) bound happily beside the
  user's app (`0.0.0.0:39240`), and loopback then went to the NEWER app -- the
  first one's screen windows and MP4 compositor load from
  `http://127.0.0.1:<port>`. `listen()` now probes `127.0.0.1:<port>` first
  (`checkIsLoopbackPortAnswering`) and treats an answer as EADDRINUSE. Seen
  live 2026-10-08 starting a scratch instance; give a scratch copy its own
  `screen-mirror-port` anyway.
- **`getDefaultScreenDisplay()` is the SIZING display; placement is private.**
  It used to skip virtual displays for everything, so with a laptop + virtual
  display a song (`LyricAppDocument.displayDim`), a new slide, a web
  background's viewport and a capture were 1494×934 and boxed on a 1920×1080
  display. Now: a physical second monitor wins; else a virtual display a
  screen is SET to (the `screen-display--pid-N` settings, not whether it is
  showing -- a song must not change shape when a screen is shown). Where a
  screen with no display goes is `getPlacementDisplay` and still never virtual.
- **OS fonts never reach a viewer.** The viewer gets only `@font-face` rules
  (the bundled ones, `fontCss`); `Khmer OS Battambang`, `Moul`, `Hanuman`
  installed on the presenting PC fall back to the phone's own Khmer face. The
  `km` CSS now answers `Battambang` with the shipped files and `Khmer OS
  Battambang` / `Kh Battambang` with `local()` first, the shipped one only
  where missing. Serving the PC's other font files is NOT built: there is no
  family → file resolver (`fontListHelpers.ts` lists names and weights only).
- **The screen's ✕ under Allow interaction** hides that screen (asked:
  _"allowed interactive should be able to [close] a screen by the `x`
  button"_). The stand-in answers `app:hide-screen` with `{type:'hide'}` on
  the screen socket, only while interactive; the server takes the socket's
  own screen (never an id from the packet) → `mirror.hide` + controller close,
  as `app:hide-screen` does. `vd-screen.html` hides `#close` unless
  `html[data-vd-interactive='1']`. A viewer can still never SHOW a screen.
- **The card**: Where to watch leads with `splitVirtualDisplayAddresses` (best
  LAN by `rankMirrorAddress` + every internet address, QR open), the rest and
  the MP4 under _More addresses_ (fold `more-addresses`, closed by default);
  Preview first; a note when `screenIds.length > 1`; each viewer named from its
  user agent (`toViewerDeviceLabel`, `virtualDisplayAddressHelpers.ts`).
- **Viewer page**: a frame that loads without `#root` (an error page) is
  asked again 3× with growing delay; full screen locks orientation to the
  display's shape where allowed (`screen.orientation.lock`, refused on desktop).
- **The screen page hides the full-width document scrollbar**
  (`screen.scss`, `#slide .half-scale-container`); the Mini Screen keeps it.
- **QA trap**: a running slide show (5 s) moves every slide you present on
  that document -- it read as "the viewer is one step behind". Stop it, or
  sample the viewer over time, before calling a sync bug.

**Robot run vd-20261008b ("fix high medium and low") -- the rules it left:**

- **The screen frames cover the page and take every input.** A tap, click,
  mouse move, key or double-click on the picture lands in a `vd-screen.html`
  frame, never on the viewer page: the buttons came back only from the black
  bars and a double-click selected a word on the screen. `listenToFrame`
  (`virtual-display-viewer.ts`) listens inside each same-origin frame once it
  loads (again on every reload): pointer/keys wake the controls, `dblclick`
  toggles full screen (user activation reaches the parent), the frame's
  `mouseleave` hides them after 150 ms (a move onto the toolbar over the
  picture shows them again first). `vd-screen.html` sets `user-select: none`
  and shows the pointer only under `html[data-vd-controls='1']`, which the
  page sets on a CHANGE of shown/hidden only (`showControls` runs per move).
- **A tab sent to another site stayed listed for minutes**: Chrome kept it in
  the back/forward cache with its socket OPEN (Back restored it,
  `performance.now()` 295 s, nav `navigate`). `pagehide` (persisted) closes
  the socket -- nulled first so its close schedules no reconnect -- and
  `pageshow` (persisted) reloads. And nothing noticed a viewer that vanished
  without a FIN: `VirtualDisplayWebViewers` pings every page socket every 20 s
  while any is open (`watchHeartbeat`; no timer when nobody watches) and
  terminates one silent a whole round -- live, ended 22 s after its first ping.
- **A VD screen's picture with no MP4 watched** (no compositor guest) is
  cropped out of the presenter's Mini Screen card
  (`captureMiniScreenImage`: `.mini-screen[data-screen-key=N]
  .mini-screen-preview-fit`, `capturePage(rect)`), for `owa_screenshot`, the
  chatbot's attachment and Presenting Control alike; it used to throw "That
  window is not open". `cdp.mjs` `toPageErrorMessage` drops a page error's
  stack frames for every `owa_*` tool.
- **Every `electron/` module `src/` imports for a value must pass the dev
  allowlist** -- a test now reads the imports (`virtualDisplayProtocol.test.ts`);
  a new `screenShowProtocol.ts` 404'd and left every LAN, internet and tunnel
  viewer of a dev build on the wallpaper, while 127.0.0.1 looked fine.
- **Bible text white on white / a style change not reaching a screen**: not
  the viewer -- every screen page; see [[screen-page-settings-are-page-local]].
- **A screen showing on a virtual display comes back showing at the next
  start** (asked: _"it should remember showing screen, so even reload it
  still have content showing"_). Main forgets every output on a relaunch, so
  the PRESENTER keeps `virtual-display-showing-screens` (ids showing on a
  display SET to virtual, read off the stored `screen-display--pid-N`, no IPC)
  from `fireVisibleEvent` and the `displayId` setter, and `AppPresenterComp`
  lazily runs `restoreVirtualDisplayScreens` once: each remembered screen
  still on an existing virtual display (`displayId` falls back to a monitor
  when its display is gone) is shown as its F5 does. Nothing is written
  before that pass, which then writes what is up (so a screen already up is
  kept without a toggle). `hideAllScreens` (the Reader) forgets them; a real
  monitor never comes up by itself. Not done in main: a restored output would
  ask the presenter for its context before the presenter exists.
  **A show needs the presenter to ANSWER**: main's `prepareOutput` sends
  `mirror:bootstrap-request` and gives up after 10 s, and the presenter
  answers only once `ScreenManager.initReceiveScreenMessage()` ran -- at the
  top of `MiniScreenComp`, a lazy chunk. The first restore fired before it
  loaded: the presenter said showing, main never attached, ten seconds later
  it went off (sampled live). The restore imports `MiniScreenComp` first; any
  new caller that shows a screen early must do the same.
- **The long notes fold** (asked: _"make those verbose message collapsed,
  expandable"_): the internet warning (`MirrorInternetWarningComp`, both
  tabs), the tunnel note and the router note are `CollapsibleNoteComp` -- one
  clamped line keeping colour and first words, chevron or a click opens it,
  `virtual-screens-note-<name>-expanded` remembers it.

**Driving it in dev:** the presenter deletes `globalThis.provider` after
`appProvider` reads it; raw CDP in a scratch instance reaches IPC through
`require('electron').ipcRenderer` (nodeIntegration). A scratch instance holding
39241 makes `screenMirrorService.test.ts` time out — stop it before the gate
([[scratch-dev-instance-beside-user-app]]). Related: [[screen-mirror-internet-multi-host]],
[[screen-mirror-cross-machine-test]], [[mini-screen-monitor-wallpaper]].
