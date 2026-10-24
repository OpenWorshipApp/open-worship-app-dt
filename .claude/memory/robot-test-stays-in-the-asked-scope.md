---
name: robot-test-stays-in-the-asked-scope
description: "A focused /owa-robot-test (e.g. path settings) stays inside that focus -- no screen, media, export/import or KJV blocks unless asked"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 819b138a-b9db-4a65-b21b-aab87139bcd0
  modified: 2026-10-24T20:20:58.806Z
---

When the user scopes a robot test to an area ("test everything related to path
setting"), test THAT area only. The skill's mandatory blocks (screen, media
download, drag-and-drop, locale) and neighbouring features (Export/Import Data,
the KJV question, downloads) are out of scope unless the user asks for them.
Asked "how far from goal" twice, then stopped the run: _"the scope is should
be anything related to path selection only"_, then _"keep reporting for what
already tested"_ (2026-10-24, run 20261024-1009).

**Why:** a scoped run that grows into the whole app costs hours of machine
time and turns a strict goal ("work perfectly") into an open-ended one, while
the user waits for the answer about the area they named.

**How to apply:** before adding a block or a row, ask whether it is the named
area; a drop INTO a chosen folder or a copy TO a chosen place is path
selection, a media download or an archive's contents is not. A fault found
outside the area is reported, not chased. When the user asks for a report,
stop testing and report what was run. See [[data-folder-live-test-recipe]].
