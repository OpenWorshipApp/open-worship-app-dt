---
name: connection-intercom-and-viewer-camera
description: "Per-connection intercom (mic/speaker/volume) for Screen Mirror guests and virtual display browsers, a browser's camera shared as a host camera (`vd-camera:`), and the MP4 mic -- all off by default, all inside the existing sockets"
metadata:
  node_type: memory
  type: project
  originSessionId: 84de4c50-a44b-4c8d-bd33-0a72a39fe576
  modified: 2026-10-08T22:15:00.000Z
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

**Testing without a second person:** a throwaway Electron main in the
scratchpad with `use-fake-device-for-media-stream` +
`use-fake-ui-for-media-stream`, its own `userData`, loading `/vd/<n>/` and
driven through a loopback port of its own (eval / capturePage) -- a real
browser with a camera and mic that changes nothing in the app. Quit it by that
port, never by killing every electron.exe ([[dont-taskkill-all-electron]]).

Related: [[virtual-displays]], [[screen-mirror-internet-multi-host]],
[[cloudflare-quick-tunnel]].
