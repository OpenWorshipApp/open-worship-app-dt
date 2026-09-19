---
name: aichat-guest-cannot-reach-loopback
description: "CORS stops a foreign page READING this machine, not SENDING to it — a no-cors fetch from the AI Chat guest reached the app's own doors, and until 2026-09-14 a ws:// WebSocket reached any loopback service because *:// is http(s) only; the guest session now cancels every local/private address, http AND WebSocket"
metadata: 
  node_type: memory
  type: project
  originSessionId: c95a672a-48b7-47e0-a94d-10946a3ee48d
  modified: 2026-09-14T19:39:16.480Z
---

Measured 2026-09-12 from inside a live `<webview>` guest on claude.ai, before
the wall existed:

| From the guest | Result |
| --- | --- |
| `fetch` the app's CDP door, cors mode | `TypeError` — CORS refused the READ |
| a CDP WebSocket | closed 1006 — Chromium's `--remote-allow-origins` rule |
| POST the MCP door, cors mode | `TypeError` — `host.mjs` `checkIsAllowedOrigin` 403 |
| **`no-cors` fetch at BOTH doors** | **opaque, SERVED — the request went out** |

**Why:** the lesson generalises past this window. Every refusal in the top
three rows is somebody else's code, two of them Chromium's, and all three
only stop the page READING an answer. A blind request needs no permission and
reads nothing, which is all a state-changing call needs — the classic attack
on anything listening on loopback. This app serves two unauthenticated doors
there (CDP is a WebSocket into renderers that all have `nodeIntegration:
true`; MCP can click, present and write files), and the same request reaches
the church's router, NAS and printers.

**How to apply:** `guardGuestSessionRequests` in
`electron/aiChatGuestHelpers.ts` registers `onBeforeRequest` on
`persist:aichat` over `GUEST_REQUEST_URL_PATTERNS` — `*://*/*`, `ws://*/*`,
`wss://*/*` — and cancels any host `checkIsLocalHostname` calls local or
private. That predicate was ADDED to `tools/owa-devtools-mcp/webUrlPolicy.mjs`
and `checkWebUrl` uses it too, so there is one implementation, not two — do
not write a second address check anywhere. Four traps:

- **`*://` is http and https ONLY.** Measured 2026-09-14 (Electron 43.3.0,
  Chromium 150): under `*://*/*` a WebSocket handshake never reached the
  listener at all — `ws://` to 127.0.0.1, localhost, 127.1, [::1] and
  127.0.0.2 all OPENED from the guest, and a throwaway server on each received
  the handshake with `Origin: https://claude.ai`, while plain http to the same
  server was refused. A church machine's loopback is where OBS, Companion and
  presentation remotes accept exactly that. The `ws://*/*` / `wss://*/*`
  patterns were proven in a standalone Electron harness first (the listener
  sees `webSocket`, a cancel closes it 1006, ordinary pages still load); after
  the change the same five attempts closed 1006 with nothing received, and two
  public `wss://` echoes still opened.
- **Never `<all_urls>`, and never narrow the filter to address patterns.**
  `<all_urls>` also hands the listener `data:` and `blob:` loads, whose empty
  host `checkIsLocalHostname('')` calls local, so every site would break. And
  Chromium match patterns take a `*` host or a `*.suffix` one and no address
  range, so `127.0.0.2` walks through a `127.0.0.1` pattern. The listener
  judges; the per-request main-process hop is what correctness costs.
- **Electron keeps ONE `onBeforeRequest` per session.** A second registration
  on this partition silently REPLACES the wall instead of joining it.
- **Keep the positive controls, and read what ARRIVED.** `probe-aichat.mjs`
  checks that the site's own origin and a public `wss://` echo STILL answer,
  because a wall that blocks the site is a brick; and it starts real loopback
  servers, because a page's `closed 1006` cannot tell "refused by the wall"
  from "nothing listening".

Residues, filed: a public NAME resolving to a local address (`localtest.me`)
is not caught — it needs a DNS pass and is a TOCTOU race anyway, and it does
not reach this app's doors, which refuse a foreign Origin (`AC-10`); WebRTC's
UDP and WebTransport are not what `onBeforeRequest` is documented to see, and
neither has been measured from the guest (`AC-16`).

Related: [[aichat-window]], [[agent-access-mcp-chatbot]].
