---
name: cast-to-tv
description: "A virtual display casts to a TV: from the app (Google Cast over CASTV2, DLNA over UPnP AVTransport, Roku over ECP) and from a browser page (Remote Playback / AirPlay picker); every TV pulls the display's MP4 itself"
metadata:
  node_type: memory
  type: project
  originSessionId: 84de4c50-a44b-4c8d-bd33-0a72a39fe576
  modified: 2026-10-08T22:43:23.722Z
---

Built 2026-10-08 at the user's ask (_"both highlighted area to have a screen
casting icon and do screen casting on tv"_; asked which TVs: _"Both"_, then
_"all kinds that support"_).

**One idea for every kind: the TV pulls `/vd/<n>/video` itself** -- one more
MP4 player in Watching now, so it plays while nothing here draws it and the
compositor runs only while it does. Over this network only: `cast-start`
refuses while _Let other devices watch_ is off, and turning it off stops every
cast.

**From the app** (`electron/castProtocol.ts` pure, `electron/castTargets.ts`
sockets; the card header's cast button opens `VirtualDisplayCastComp`):

- Looked for ONLY when the list opens (3 s, `cast-search`), out of every
  network card, and the few found kept until the next look -- no background
  discovery.
- **Google Cast**: mDNS `_googlecast._tcp.local` with the QU bit (asked from a
  port other than 5353); devices without video out (`ca` bit 1 clear --
  speakers, groups) left out. CASTV2 by hand, no dependency: TLS to 8009
  (`rejectUnauthorized: false` -- a Cast device signs its own certificate),
  4-byte length + hand-written CastMessage protobuf, CONNECT, PING/PONG every
  5 s, LAUNCH of the Default Media Receiver `CC1AD845`, then LOAD of the MP4 as
  `streamType: 'LIVE'` on the app's transportId. A RECEIVER_STATUS without our
  sessionId = stopped on the TV or another phone cast over it.
- **DLNA**: SSDP `MediaRenderer:1`; the description's AVTransport controlURL
  must be on the host that answered. Stop (its "no" ignored), then
  SetAVTransportURI with DIDL-Lite metadata, then Play. The MP4 route answers a
  TV's `getcontentFeatures.dlna.org: 1` / `transferMode.dlna.org` with
  `DLNA_CONTENT_FEATURES` (live, not seekable) and `Streaming` -- picky
  Samsungs want them. No end detection: shown casting until Stop.
- **Roku**: SSDP `roku:ecp`; ECP `POST /launch/15985?t=v&u=…` (Play on Roku),
  stop by `POST /keypress/Home`. Port from its LOCATION.
- **AirPlay from the app: not built** -- Apple TVs and AirPlay TVs make a
  third-party sender pair with an on-screen code (HomeKit pairing). Safari's
  picker does that itself, so AirPlay goes through the browser page.
- The URL handed to a TV is built from `findLocalAddressFor(tv)` (a UDP
  "connect" picks the route, sends nothing): the card facing the TV, right on a
  computer with a VPN too.
- Every answer is untrusted: LAN addresses only, a device is always the address
  that answered, descriptions capped, names one tidy line
  (`toCastTargetName`), brand names (Google Cast, DLNA, Roku) not translated.
- Shared UPnP pieces moved to `electron/upnpHelpers.ts`; the router uses them.

**Latency** (asked for 2026-10-08: _"casting and video of virtual display is
really slow"_; measured on a real TV with Chromecast built in, by joining it as
a second CASTV2 sender and comparing its `currentTime` with the stream's newest
`tfdt` -- the script is the way to measure it again):

- **7.0 s → 3.4 s: the MP4 had holes.** A still screen went out about once a
  second (an idle `setInterval` firing up to 2 s apart) with every frame
  written as 1/30 s long: 97% of the video track was holes, and a player that
  buffers a few frames first waited seconds. `LiveMp4Encoder` now holds each
  frame until the next one exists and writes it lasting exactly until it, and
  repeats a still picture every 100 ms on a timer each frame moves on. Cost: a
  still screen is encoded 10× a second instead of once, only while an MP4 is
  watched.
- **3.4 s → ~1.4 s: catching up.** The Default Media Receiver buffers ~3 s
  before it plays and never catches up. `SEEK` toward live KILLS playback (a
  live progressive MP4 cannot seek; the TV went IDLE). `SET_PLAYBACK_RATE`
  works: the session plays at 1.2× while more than 0.6 s past its target
  (1.4 s), back to 1× at the target; the TV runs dry and stalls near 1.0 s, so
  a BUFFERING while faster drops to 1× and moves the target +0.3 s (max 3 s).
  The live edge is `Fmp4Fanout.liveTime` (the newest video `tfdt`). The cast
  list shows "Casting · 1.3 s behind live".
- **Only our own media session counts.** A TV still holding an earlier cast's
  player reports that one IDLE/INTERRUPTED when our LOAD replaces it; taken
  as ours, the app dropped the cast while the TV played on, unsteered. Ours is
  the one the answer to our LOAD (`requestId`) names, else the first non-idle
  after it. IDLE FINISHED/ERROR of ours reloads (3×); CANCELLED/INTERRUPTED
  ends it.
- Chromium's own `<video src>` sits ~2.4 s behind whatever the stream does --
  its preroll; the app's own pages draw the screens instead and are live.
- Not steered: a cast started from a browser's own picker (the app is not its
  sender), DLNA and Roku (no rate control). A cast from the page's list IS
  the app's, so it is steered like the card's.

**From a browser** (`#cast-button`, left of the mic) opens `#cast-panel`, two
parts (2026-10-08, reported with screenshots: _"screen casting on client web
not working"_, then _"host app should stream video to the web to cast from page
to browser. this is for casting to a tv with same network of the browser not
app"_):

- **Cast from this browser** -- the PRIMARY one: a TV on the BROWSER's
  network, by the browser's own picker (`video.remote.prompt()` → Google Cast
  in Chrome/Edge; `webkitShowPlaybackTargetPicker()` → AirPlay in Safari).
  The bug: desktop Chrome reports remote playback UNAVAILABLE for a hidden
  `<video preload="none">` it never loaded (`watchAvailability` → false), so
  `prompt()` rejected AT ONCE with `NotAllowedError: The prompt was
  dismissed.` -- which the page took for a person closing the picker: the
  button did nothing. Now opening the list sends `cast-stream`; the app
  answers `{type:'cast-stream', path:'/vd/<n>/video?cast=<token>'}`
  (`issueCastToken`: 36 hex, one per browser and display, ended by its
  Disconnect, `revokeInternetGrants`, the display's delete, or a day); the
  page sets it on the cast `<video>` with `preload="metadata"`, muted, NEVER
  played, so the browser judges a stream it has read. **The token is the TV's
  ticket**: `route()` treats a valid `cast` as access `open`, so a TV pulling
  from the internet is not held for Allow nor asked the Basic-auth code it
  cannot type (`virtualDisplayService.test.ts`). A rejection under 400 ms
  (`CAST_PROMPT_REFUSED_MILLISECOND`) is "this browser found no TV", a slower
  one a hand closing it. The stream is let go when the list closes and no TV
  of this browser plays (`releaseCastStream`) -- the compositor encodes only
  while somebody pulls. A page on 127.0.0.1 hands `layout.castUrl` + the
  token's query (the first LAN address, null while sharing is off) -- a TV
  cannot reach loopback. Headless Chrome has no cast devices: there it can
  only prove the stream and the "found no TV" note, never a TV.
- **TVs on the app's network** -- for a browser on that network only
  (`isAllowed`; hidden from the internet): `cast-open` / `cast-search` /
  `cast-start` / `cast-stop` / `cast-close` (`receiveCast` in
  `virtualDisplayWebViewers.ts`, ≤4/s) and `{type:'cast', state}`
  (`VirtualDisplayViewerCastState`), pushed on every service state change to
  pages with the list open (`sendCastStates` from `scheduleState`). The app's
  own `searchCastTargets` / `startCast` / `stopCast` do the work, so the
  card's list moves with it. A page's look waits 5 s after the last one
  (`VIEWER_CAST_SEARCH_GAP_MILLISECOND`); the card's never waits.

**Testing without a TV**: a scratchpad script of three stand-ins -- SSDP and
mDNS responders (bind 1900/5353 with `reuseAddr`, join the groups per
interface), an HTTP device for DLNA and Roku, a TLS CASTV2 receiver on an
`openssl req -x509` certificate -- each pulling the URL it is told and logging
the bytes. Live 2026-10-08: all three found; DLNA got Stop/Set/Play and pulled
1 MB of `ftyp`… in 4 s with both DLNA headers. A real Google Cast TV was
found and played the cast from the app (2026-10-08, see Latency).

Related: [[virtual-displays]], [[connection-intercom-and-viewer-camera]],
[[screen-mirror-internet-multi-host]].
