---
name: twin-tab-close-loses-conversation
description: "A chatbot tab closed by a label two tabs share closes the user's tab, and the transcript is gone"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b467f10b-a82a-47cf-b80c-1ac9ecb8f5e1
  modified: 2026-10-19T19:38:09.838Z
---

Verification of the lookup conversation opens tabs named for the record
(`ដាវីឌ`), and the user's own tab carries the same name. `owa_click "បិទ
ដាវីឌ"` takes the FIRST match in the DOM, which is the user's tab: measured
2026-10-19, it closed their David conversation. `chatbot-sessions` has no
trash, so the transcript is gone; and writing it back by hand is overwritten
by the window's own `beforeunload` flush on the next reload.

**Why:** a tab strip label is not an address when the tab was opened from the
same record, and the store is one JSON file the window rewrites.

**How to apply:** close only a tab you opened, by the uid a `take_snapshot`
gave (`click` with that uid), never by a shared label — or reuse one test tab
for the whole run. If the store must be repaired, run a watchdog that rewrites
the session while the window reloads. See [[corpus-run-in-a-shared-dev-app]]
and [[chatbot-cdp-driver-gotchas]].
