---
name: cloudflare-quick-tunnel
description: "Screen Mirror guests and virtual display viewers can come in through a Cloudflare quick tunnel (cloudflared built from source, shipped in the extra-bin pack) — the answer when a VPN or carrier NAT means nothing reaches this PC; everything through it is the internet"
metadata:
  node_type: memory
  type: project
  originSessionId: 84de4c50-a44b-4c8d-bd33-0a72a39fe576
  modified: 2026-10-08T17:44:32.068Z
---

Built 2026-10-08. The user's PC ran Proton VPN (`ProTUN`, 10.2.0.2): the panel
listed the VPN's exit (149.102.242.95) as the public IP and nothing reached it,
the VPN blocked the router (no UPnP), and Proton's gateway answered no NAT-PMP
(no port forwarding on that plan/server). Asked _"the vpn address is
unreachable, find solution"_, the user chose **Built-in tunnel** over Proton
split tunneling or Proton port forwarding.

- **`electron/screenMirrorTunnel.ts`** (`MirrorTunnel`): `cloudflared tunnel
  --no-autoupdate --url http://127.0.0.1:<door>`; parses the
  `https://<words>.trycloudflare.com` address from its log, restarts it with
  backoff when it dies, killed on stop/quit.
- **cloudflared ships in the extra-bin pack** (2026-10-08, asked: _"I want
  cloudflared ... to be a part of extra bin, build it commit in code base in
  extra-work\experiment-building"_), at
  `<data folder>/extra-bin/<platform>/cloudflared/cloudflared[.exe]`; main
  resolves it in `electron/extraBinPaths.ts` from `selected-parent-dir` (while
  it exists) else `userData`. Nothing is downloaded from GitHub any more.
  `*-build-cloudflared.*` builds tag **2026.9.3** with a pinned Go **1.26.8**
  fetched into `tmp/` (go.dev SHA-256); pure Go, `CGO_ENABLED=0`, so ONE host
  cross-compiles all six packs (`all`, `CLOUDFLARED_SHIP=1`) -- the other
  tools are built per host. Pack **0.0.4** onward carries it. No pack -> error
  `missing` + a **Go to Settings** button; `installExtraBin` broadcasts
  `all:app:extra-bin-changed` and main's `retryTunnel()` starts a waiting
  tunnel. The media gate asks for its own three tools only
  (`EXTRA_BIN_MEDIA_NAMES`), so a 0.0.3 pack still downloads video.
- **Announced only once Cloudflare's DNS (over HTTPS) knows the name**, up to
  30 s: asked sooner, this PC's resolver cached the NXDOMAIN and the link
  failed ENOTFOUND for minutes on this PC (seen live). After the wait it
  opened on the first try through the VPN.
- **The door** (`ScreenMirrorService.openTunnel`): its own loopback listener
  with the same handlers; every socket on it is marked, and every request
  through it is `internet` from `Cf-Connecting-Ip` (`mirrorRequestSender.ts`
  `noteTunnelRequest` / `readRequestSender` -- downstream code reads the
  sender THERE, never `req.socket.remoteAddress`). So the approval/code gate
  ([[virtual-displays]]) applies. The viewer page's socket origin is
  `https://<host>` there. **Screen Mirror guests use it too** (2026-10-08,
  asked: _"sync the connection behavior between Screen Mirror Connection and
  Virtual Display... especially tunnelling"_): while hosting is on,
  `/discovery`, `/content/` and the `/mirror` socket pass under the usual
  `admits` (internet open) and guest access; their files are published under
  `readMirrorOrigin(host, isTunnel)` = `https://<host>`. Hosting off: viewers
  only. Never app files through it.
- Wanted while `screen-mirror-tunnel` AND the internet is open AND hosting or
  sharing is on (`isTunnelEnabled && isRouterWanted`). Its address is in the
  SHARED `addressList` (`kind: 'tunnel'`, port 443) only while `up`; a row
  shows/copies `https://host`, its QR stays `host:443` (the user's
  host:port rule).
- **A guest dials 443 with TLS** (`MIRROR_SECURE_PORT`): https discovery,
  wss socket. `readMirrorAddressText` gives an `https://`/`wss://` link port
  443, and the guest's port box is OPTIONAL (asked: _"the tunnel has no port
  display, so client should just make port input optional"_): empty dials
  `toMirrorDefaultPort` -- 443 for `*.trycloudflare.com`, else 39240.
- Both tabs draw the same settings from `MirrorInternetComps.tsx` (guest
  access -- each tab keeps its own mode/code --, tunnel, public address,
  custom port); the public address and port have their own commands
  (`public-address`, `custom-port`), since `settings` always rewrites
  Screen Mirror's mode.
- Errors are codes (`missing|stopped|failed`) the panel turns into `tran()`
  words -- a raw error string would throw in dev.

**Why:** a VPN, carrier NAT or a router that forwards nothing makes every
inbound way fail; the tunnel needs nothing inbound and gives phones https (a
secure context).

**How to apply:** test it outside the app with the module copied to `.mts`
and `node --experimental-transform-types` (the repo is CJS); never let a unit
test reach GitHub or Cloudflare. Related: [[screen-mirror-internet-multi-host]].
