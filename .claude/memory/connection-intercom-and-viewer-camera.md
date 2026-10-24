---
name: connection-intercom-and-viewer-camera
description: "Per-connection intercom (mic/speaker/volume) for Screen Mirror guests and virtual display browsers, a browser's camera shared as a host camera (`vd-camera:`), and the MP4 mic -- all off by default, all inside the existing sockets"
metadata:
  node_type: memory
  type: project
  originSessionId: 84de4c50-a44b-4c8d-bd33-0a72a39fe576
  modified: 2026-10-09T15:15:00.000Z
---

Built 2026-10-08 at the user's ask (_"3 icons per connection, mic speaker and
camera"_, _"like a video call session, but camera will share to be host's
virtual camera"_, _"make all those buttons disabled by default"_).

**Intercom** (`electron/mirrorIntercom.ts`, `src/screen-mirror/intercomAudio.ts`,
`MirrorIntercomComp`): per connection a mic (send mine), a speaker (play
theirs, green dot while their mic is on) and a volume. Keys
`guest:<id>` / `link:<id>` / `viewer:<id>`. Opus by WebCodecs, 20 ms packets,
base64 inside JSON on the connection's OWN socket (binary frames are refused;
≤1 KB, ≤100/s), jitter-buffered through an AudioContext. The host's side runs
in the hidden camera broker window, kept alive by a `brokerRequests` entry
while any intercom is on. macOS asks `askForMediaAccess('microphone')`
(`NSMicrophoneUsageDescription`). A volume change must broadcast the state
like any other change -- it once did not, and the slider snapped back.

**A browser's camera** (`electron/virtualDisplayViewerCameras.ts`,
`src/virtual-display/viewerCameraTransport.ts`): the viewer page's _Share my
cameras_ makes `vd-camera:<viewer>` (label `Browser <address>: <device>`) a
camera of this computer for any foreground or background. VP8 by
`VideoEncoder` (≤640 wide, 15 fps), sent only while something WATCHES it:
`window:<webContents id>` (IPC `vd:camera-watch`) or a browser's screen page
`screen:<viewer>:<screen>` (its socket's `camera-watch`, only for a camera that
screen shows) -- the same frames passed on, never encoded twice. Decoded into a
`MediaStreamTrackGenerator`, or a canvas stream where there is none.

- **A watch outlives the sharing.** Not shared (tab reloading -- it keeps its
  id -- or camera turned off) pauses every watcher (`vd:camera-end`); sharing
  again sends `camera-start` and the picture comes back on every screen with
  nothing re-added. The box hides while no pictures come
  (`listenViewerCameraLive`, `visibility: hidden`) -- never a black box or a
  frozen face. `getCameraAndShowMedia` opens an unlisted `vd-camera:` id
  anyway; a background camera goes up at once instead of waiting for metadata
  that will not come. Before this, screen windows (no `mirror:devices-changed`
  re-render there) never got a re-shared camera back.
- **A relayed packet's `type` names the packet.** Passing a frame on to a
  browser's screen page as `{...frame, type: 'vd-camera-frame'}` overwrote its
  `key`/`delta`; the page waited for a key frame for ever and drew nothing.
  The frame's own goes as `frameType`.
- **The camera button is a picker, not a toggle** (2026-10-08, asked for:
  _"on mobile I need option to choose different. add all choices"_ -- it
  opened the browser's default, a phone's front, and nothing else). It opens
  `#camera-panel` (styled with the cast list as `.panel`; one open at a time):
  before the browser has allowed a camera it names none, so a coarse-pointer
  device gets Front / Back (`facingMode`, the back one EXACT so a device with
  none refuses rather than sharing its front under the wrong name) and
  anything else one "Camera"; after, every `videoinput` by label, Android's
  `camera2 N, facing back` read as Back camera, numbered when several. A
  switch STOPS the shared track before `getUserMedia` (a phone opens one
  camera at a time), keeps the same `camera` object and encoder (`isKeyWanted`)
  and sends `camera-state shared:true` with the new name -- never `false` in
  between, so the host's watchers just carry on; `share()` renames the
  `vd-camera:` entry. `cameraRequest` is bumped by every open and by
  `stopCamera`, so a camera that opens after the display was lost is closed,
  not shared. The `<video>` already feeding the encoder is the panel's
  preview, put in the DOM only while the list is open.
- Release through `stopCameraStream` (`cameraHelpers`): it lets go of the
  mirror AND the viewer transports. The background camera used to release only
  the mirror one.
- A laptop camera whose privacy shutter or kill key is on (seen on HP) SENDS a
  slashed-camera picture as its video. That picture on a screen is the camera
  working, not the app's "unavailable" state -- check the device in _Camera
  Show_ before debugging.

**MP4 mic**: a row's mic button mixes this computer's microphone into that
display's MP4 sound (compositor message `{type:'mic'}`, re-sent on
`vd:compositor-ready`).

**Viewer page controls**: mic, ONE sound button, share camera (the picker
above), full screen.
The sound button is the display's sound AND the host's voice, on and off
together (asked for 2026-10-08: the old one-shot _Turn on sound_ beside a
separate speaker for the voice was _"one extra icon"_); pressing it loads the
screens again as the sound player (`sound=1`) or no longer, and while on it
shows the voice volume. Mic and camera show only on a secure page (loopback,
the tunnel); nothing shows in the app's own Preview. Controls appear only
under the mouse; a mic that is on stays visible. A refusal says so in a toast
(`micFailed`, `cameraFailed`).

**On an iPhone or iPad a camera shows in a canvas, never a `<video>`**
(2026-10-09, reported _"iphone and ipad can't [see] the camera"_; Android and
every computer could). Two WebKit traps, both measured on the user's iPad
through a logging proxy (below):

- A `<video>` of a canvas's `captureStream()` -- how a browser camera reached
  the screen where there is no `MediaStreamTrackGenerator` -- takes the
  camera's size and never paints nor autoplays (WebKit 181663, 275456). The
  tell: a box with the camera's exact shape filled with the style's own
  background colour. Now the frames go straight into canvases
  (`createViewerCameraView`).
- A WebRTC `<video>` (this computer's camera, `mirror-camera:`) played --
  `paused:false`, time running, every frame decoded -- and painted only its
  background. A fresh copy painted or not by its style (blur on, positioned:
  yes; plain or unblurred: no), and re-attaching the stream did not save the
  element, so no style is a fix. A canvas drawn from the same video always
  painted, even from a video on no page. `createCameraCanvasView`
  (`cameraHelpers`) does that wherever there is no track generator: a video
  nobody sees, started at once (not on its metadata), drawn per frame by
  `requestVideoFrameCallback` (15/s, the camera's rate; never per refresh).
  No per-frame callback: the `<video>` stays. Foreground, camera background
  (put up at once -- its hidden video never loads) and slide camera items
  all swap the canvas in. Chromium keeps the `<video>`.

**A camera on the screen follows the device, not the tab.** A browser's
camera id is its viewer id, per tab: a new tab, another port, or a tab
Safari threw away is a new camera, and the screen kept the old id. The
presenter found it again by name (`resolveCameraDeviceId`), so its Mini
Screen showed it while every browser page and the Preview showed nothing --
a page may only ask for an id its screen shows. Now a screen page's watch
carries the name the screen gives the camera (`cameraLabelOf`), and
`ViewerCameras` feeds an unshared id from a camera shared under exactly that
name, tagging the frames with the id asked for; routes are worked out again
on every share, rename, drop and watch, and only the differences are sent
(start, stop, key frame, pause). The name begins `Browser <address>:`,
written here, so another device cannot take a box over. A window gives no
name and follows only its id. A switch to another camera renames it, so a
box following the old name pauses.

**Seeing what an iPhone does with no Mac:** a throwaway reverse proxy in the
scratchpad on a spare LAN port, forwarding to the app's port (Host and Origin
rewritten to the app's address, WebSocket upgrades piped), injecting a
logger script into every HTML page that POSTs back what the page does
(capabilities, `RTCPeerConnection` states and `getStats`, `play()` results,
each video's state, canvas pixels). Labelled A/B tiles placed in the screen's
own container answered the paint questions in one screenshot each. It opens
LAN ports: ask first, and stop it after. Safari loads a self-signed https
proxy page once its warning is passed.

**Testing without a second person:** a throwaway Electron main in the
scratchpad with `use-fake-device-for-media-stream` +
`use-fake-ui-for-media-stream`, its own `userData`, loading `/vd/<n>/` and
driven through a loopback port of its own (eval / capturePage) -- a real
browser with a camera and mic that changes nothing in the app. Quit it by that
port, never by killing every electron.exe ([[dont-taskkill-all-electron]]).

Related: [[virtual-displays]], [[screen-mirror-internet-multi-host]],
[[cloudflare-quick-tunnel]].
