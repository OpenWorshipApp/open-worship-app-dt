---
name: screen-mirror-internet-multi-host
description: "Screen Mirror over the internet (off by default, UPnP, assets by Host header) and a guest linked to several hosts (windows told apart by webContents, never by screen id)"
metadata:
  node_type: memory
  type: project
  originSessionId: 0d6afc89-1c6b-4cd5-8f88-163d1daabea1
  modified: 2026-10-07T17:36:34.694Z
---

Built 2026-10-07 at the user's ask (W-50 steps 7–8, SP-28/29).

- **Hosting listens dual-stack (`::`, falling back to `0.0.0.0`) whenever it is
  on; who may come in is `admits()`, not the bind.** With _Open to the
  internet_ (`screen-mirror-internet`, off by default) everyone is admitted;
  without it only a local sender — a private / CGNAT / link-local / ULA address,
  or one on a card's own subnet or IPv6 /64 (`checkIsLocalSender`). So toggling
  the option needs no rebind and drops no LAN guest. The gate covers HTTP,
  the WebSocket upgrade and UDP discovery.
- **A guest's files are published under the origin it DIALLED** — its own
  `Host` header (`readMirrorOrigin`), not `peer.localAddress`. Behind NAT the
  connection arrives on the LAN card, so the old LAN-address URLs reached an
  internet guest's control channel and none of its pictures.
- **UPnP lives in `screenMirrorRouter.ts`**, no dependency: SSDP per IPv4 card,
  every URL must be the router itself, `AddPortMapping` 3600 s with a 725 →
  permanent-lease fallback (the user's router only takes permanent), 718 →
  another port. The mapping is remembered in `screen-mirror-router-mapping`
  so a launch with the option off removes what a crash left; quitting does
  not wait for the router. A private external address is `shared` (carrier
  NAT) and nothing is mapped.
- **A guest holds one `Link` per host.** A host's screen opens in
  `ElectronScreenController.createDetached(hostScreenId)` — outside the
  id-keyed cache — and `incoming` is keyed `linkId:screenId`, found again by
  the window's `webContents.id` (`incomingOf`) for `mirror:screen-context`,
  `mirror:resource`, feedback, step-bible and the screen's own ✕
  (`app:hide-screen` → `closeIncomingOf`). **Any IPC a screen window sends
  naming its screen by id must ask the SENDER first**: the ✕ went dead the
  day the windows left the cache (reported by the user), because
  `getInstance(id)` found nothing — or would have closed this computer's own
  screen of that id. **Never remap the screen id**:
  the screen page keys its own settings by it (`pt-effect-<id>-…`, draw,
  focus, bible line sync). `destroyInstance` only drops the cache entry that
  is itself.
- Wrong codes lock a sender (IPv4 address or IPv6 /64) after 5 in 10 min;
  waiting-request caps (8, 4 per sender) apply to INTERNET requests only — a
  LAN or a site behind one router must not be capped.
  The existing GLOBAL 32-connection limit still covers every network: since
  EN-43 it counts handshakes before hello and closing transports until their
  socket closes. Do not apply the internet-only cap of eight to LAN guests.
- QR: `qr-image` `svgObject` in main on demand (plain `host:port`, never a
  link — the user's rule); decoding is `jsqr`, lazily imported in the guest
  page. Electron on Windows has no `BarcodeDetector`.

**Why:** each of these was a wrong first guess or a user correction; the code
says what, not why.

**How to apply:** read this before touching `screenMirrorService.ts`'s gate,
`translate()`, the link/incoming maps, or the router lifecycle. Testing it
live: [[screen-mirror-cross-machine-test]].
