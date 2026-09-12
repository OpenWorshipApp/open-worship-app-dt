---
name: aichat-guest-cannot-reach-loopback
description: "CORS stops a foreign page READING this machine, not SENDING to it — a no-cors fetch from the AI Chat guest reached the app's own CDP and MCP doors; the guest session now cancels every local/private address by webUrlPolicy.mjs's checkIsLocalHostname"
metadata:
  node_type: memory
  type: project
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
`persist:aichat` over `*://*/*` and cancels any host
`checkIsLocalHostname` calls local or private. That predicate was ADDED to
`tools/owa-devtools-mcp/webUrlPolicy.mjs` and `checkWebUrl` now uses it too,
so there is one implementation, not two — do not write a second address check
anywhere. Three traps:

- **Never narrow the filter to URL patterns.** Chromium match patterns take a
  `*` host or a `*.suffix` one and no address range, so `127.0.0.2` — still
  loopback — walks through a `127.0.0.1` pattern. The listener judges; the
  per-request main-process hop is what correctness costs.
- **Electron keeps ONE `onBeforeRequest` per session.** A second registration
  on this partition silently REPLACES the wall instead of joining it.
- **Always keep the positive control.** `probe-aichat.mjs` checks that the
  site's own origin is STILL reachable, because a wall that blocks the site
  is a brick and would pass every other check in the file.

Residues, both filed: a public NAME resolving to a local address
(`localtest.me`) is not caught — it needs a DNS pass and is a TOCTOU race
anyway, and it does not reach this app's doors, which refuse a foreign Origin
(`AC-10`); `ws:`/`wss:` are outside a `*://` pattern (`AC-11`).

Related: [[aichat-window]], [[agent-access-mcp-chatbot]].
