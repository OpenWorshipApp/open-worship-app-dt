---
name: llm-tunnel-check-races-502
description: "llm-tunnel self-check churns cloudflared every ~3 min while the LAN LLM server is down — its 15 s abort races the door's ~14.7 s upstream-timeout 502"
metadata:
  node_type: memory
  type: project
  originSessionId: df0bef19-c3e9-4546-b80e-20bd5e94e8c8
  modified: 2026-10-20T17:13:32.567Z
---

`extra-work/local-llm/llm-tunnel.mjs`: when the tunnel's target LLM server is
off but its LAN host still pings, the door's upstream connect hangs ~14–15 s
before answering 502 (with `x-llm-door: 1`). The self-check
(`checkIsTunnelAnswering`) aborts at 15 s, so the door's proof-header almost
never arrives → 3 misses → `tunnel.restart()` → **a new trycloudflare address
every ~3 minutes for as long as the server is down**, plus registry republish
churn.

**Why:** the check was meant to treat any header-carrying response (incl. a 502
about the upstream) as "tunnel alive", and it would — if the timeout didn't
fire first. Observed 2026-10-20 with LM Studio at 192.168.1.12:1237 dead.

**How to apply:** fix by bounding the door's upstream CONNECT timeout to ~3–4 s
(a dead upstream then 502s fast and the check sees the header), or widen the
check's `AbortSignal.timeout` past the door's worst upstream wait. Related:
[[cloudflare-quick-tunnel]]; the hidden-popup bug found in the same run:
[[hidden-popup-not-shown-by-reopen]].
