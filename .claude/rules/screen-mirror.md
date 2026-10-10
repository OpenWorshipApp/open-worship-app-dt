---
paths:
  - "electron/screenMirror*.ts"
  - "electron/virtualDisplay*.ts"
  - "electron/cast*.ts"
  - "electron/mirrorIntercom.ts"
  - "src/screen-mirror/**"
  - "src/screen-mirror.tsx"
  - "src/virtual-display/**"
  - "src/virtual-display*.ts"
  - "html/screen-mirror.html"
  - "html/virtual-display*.html"
---

# Screen Mirror, virtual displays, casting

The connection features: another machine or a browser shows this app's
screens, talks back, or puts them on a TV. Each line is a trap someone fell
into; the memory note it names carries the why.

- **Virtual displays** (memory `virtual-displays`). A browser page draws the
  screens itself; the MP4 goes through WebCodecs, and the compositor exists
  only while an MP4 plays. Sound is stream-only, never played locally. A
  phone is not a secure context: Use HTTPS shares the port, the first byte
  picks TLS, the cert is the app's own, and the MP4 stays http. Disconnect
  blocks 127.0.0.1 too. Internet viewers need Allow or a code. Content is
  sized for the display even with no second monitor. The port is sticky.
  Every viewer query key belongs in the dev allowlist. Showing screens come
  back at start, and frames take the viewer's input.
- **Intercom and browser cameras** (memory
  `connection-intercom-and-viewer-camera`). Mic, speaker and volume are per
  connection. A `vd-camera:` source is watched only while it is shown, and a
  watch outlives the sharing. A relayed packet's `type` is the packet's own.
  The camera button picks among every camera and switches in place.
- **Cast to a TV** (memory `cast-to-tv`). Google Cast, DLNA and Roku from the
  app. A browser page casts to a TV on ITS network through its own picker,
  on the app's stream (a `?cast=` token skips Allow and the code), and the
  app's TVs are on the app's network. Every TV pulls the MP4 itself. TVs are
  searched only when the list opens. A still screen with holes cost 7 s on a
  TV; catch up by playback rate, never by SEEK.
- **Over the internet and to several hosts** (memory
  `screen-mirror-internet-multi-host`). `admits()` decides, not the bind
  address. Assets are served by the Host header. Windows are told apart by
  webContents; never remap screen ids.
- **Through a Cloudflare quick tunnel** (memory `cloudflare-quick-tunnel`)
  when a VPN or carrier NAT means nothing reaches this PC. Everything through
  it is the internet.
- **Testing across two machines** (memory `screen-mirror-cross-machine-test`).
  Hosting is opt-in, peers need Remote Control, and the MCP tools drive the
  NEWEST published instance.
