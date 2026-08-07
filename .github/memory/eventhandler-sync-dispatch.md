---
name: eventhandler-sync-dispatch
description: "EventHandler.addPropEvent dispatches synchronously — CLAUDE.md's \"10ms setTimeout + MD5 dedup\" claim is stale for this tree"
metadata: 
  node_type: memory
  type: project
  originSessionId: 918508de-c212-454e-ab27-f1c422e28641
  modified: 2026-07-22T03:31:59.211Z
---

`src/event/EventHandler.ts` `addPropEvent` dispatches listeners synchronously. An audit agent verified (2026-07-21) via reading the file and `git log -S md5` / `-S genTimeoutAttempt` that no MD5-keyed 10ms debounce exists or ever existed in that file, despite CLAUDE.md describing one ("Events dispatch via a real 10ms setTimeout... debounced/deduped by an MD5 of the payload").

**Why:** Reasoning from the stale claim produces wrong conclusions (e.g. expecting identical draw-point payloads to be deduped/swallowed — they are not; the draw wire path is `sendScreenMessage` → `ipcRenderer.sendSync`). Test guidance about waiting a real macrotask may still hold for other reasons, but the mechanism description is wrong.

**How to apply:** Don't assume event dedup/async dispatch from CLAUDE.md; verify at the call site. Suggest the user correct CLAUDE.md. Related: [[screen-draw-feature]].
