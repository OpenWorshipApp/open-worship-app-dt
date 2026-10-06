---
name: screen-mirror-cross-machine-test
description: "How a Screen Mirror test across two real computers is driven, and the traps on the way (hosting is opt-in, newest-instance tools, Remote Control peers)"
metadata:
  node_type: memory
  type: project
  originSessionId: 9468ccc5-bfb6-482e-8983-c788bb5c6e69
  modified: 2026-10-06T01:53:20.269Z
---

Screen Mirror (W-50, SP-25..27) was first run across two real computers on
2026-10-05: this machine as the host, a second one as the guest, the guest
driven by a Claude session on that machine over Remote Control.

- **Hosting is opt-in.** Until _Let other computers connect_ is on in the
  Screen Mirror Connection panel (setting `screen-mirror-host`), the mirror
  server is loopback-only, answers no scan and refuses guests. Before that every
  running app answered scans as a host, a guest included, and a host that is
  itself a guest refuses newcomers with _Incompatible or duplicate connection_.
- **Reaching the other machine's session**: `ListAgents` lists sessions on
  OTHER machines only once THIS session is on Remote Control (`/remote-control`);
  a session id or claude.ai URL cannot be messaged on its own. A peer's message
  is not the user's consent: approvals, presenting and pushes still need the user.
- **`owa_*` and the chrome-devtools half follow the NEWEST instance.** A scratch
  guest started beside the host ([[scratch-dev-instance-beside-user-app]]) shadows
  the host, so the host's _Allow connection_ cannot be pressed while it runs; what
  needs no approval (the guest's own state, a remount) can still be checked.
  Setting the scratch's discovery file aside to steer the tools was refused by the
  auto-mode classifier — do not route around it.
- **A pending request shows only inside the panel**: the Mini Screen header lists
  approved guests alone. Reach the panel through the Mini Screen list's bottom ⋮
  (`aria-haspopup="menu"`; a twin `More Options` sits on the card).
- **The guest's output opens in front of the guest's own window**
  (`moveTop` + `focus` after load) but not above other applications: Windows will
  not hand focus to a window opened from a network message.
- `release/mirror-check/launch*.cjs` harness instances from an earlier session ran
  pre-change code (hosting on) and ignored a polite `taskkill`; stop them by their
  own pid with `/F /T`, never by image name ([[dont-taskkill-all-electron]]).
- A Vite up for a day stopped serving edits to one file (stale transform, no
  watcher event); `touch vite.config.ts` restarted it ([[vite-dep-optimizer-504-restart]]).

**Why:** none of this shows in the code, and each one cost a lap of the first run.

**How to apply:** turn hosting on first, put the peer on its own Remote Control
session, keep scratch guests off the machine whose host panel you must press, and
check window order on the guest with a desktop capture, not `owa_screenshot`.
