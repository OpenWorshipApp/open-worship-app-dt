---
name: cdp-pin-is-exclusive
description: A named CDP port (OWA_CDP_PORT or pinCdpPort) is that port or nothing — it no longer falls through to the newest published app
metadata: 
  node_type: memory
  type: project
  originSessionId: e5ec9e8c-e9cc-4670-95e1-4aae6714bc30
  modified: 2026-09-17T21:29:53.392Z
---

`listCandidatePorts` in `tools/owa-devtools-mcp/discovery.mjs` returns ONLY the
port that was named on purpose — by `pinCdpPort` (the in-app host) or by
`OWA_CDP_PORT`. With nothing named it still walks the published instances
newest-first and then the legacy fallbacks.

**Why:** it used to put the named port at the HEAD of that full list, and
`resolveCdpPort` takes the first that ANSWERS. So a dead pin fell through in
silence to whatever was published last — while chrome-devtools' own tools read
`resolveAppBrowserUrl`, which has always been exclusive and kept failing on the
dead port. Two halves of one server driving two different apps. A dev app that
nodemon restarted comes back on a NEW port, so a script pinned to dev a minute
earlier was then driving the newest instance: the PACKAGED app, with the user's
real data, had one been up (seen 2026-09-14 with three sessions on one dev app).

**How to apply:**

- A failed resolve now throws `describeDeadPin()`'s sentence, which names the
  pin, who set it, and what the app actually published. Keep it that way: the
  old text said "start the app" with the app right there on another port, which
  is what made this take three sessions to notice.
- `resolveAppBrowserUrl` and `listCandidatePorts` must agree about which app is
  being driven. If you add a third way to choose one, add it to
  `readExplicitCdpPort` so both read it.
- A pinned PORT still dies with the instance. Pinning by KIND
  (`OWA_CDP_TARGET=dev`, filtering `readLiveInstances()` on the published
  `isDev`) survives a nodemon restart and is what a verification script
  actually means — filed as `MC-31`, not written. Until then a script that
  drives the app should check `owa_app_state` `isDev` first, as
  [[chatbot-cdp-driver-gotchas]] says.
