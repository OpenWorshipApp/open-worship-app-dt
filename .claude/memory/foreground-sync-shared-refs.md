---
name: foreground-sync-shared-refs
description: Sync-grouped screens share the SAME foreground-data object references in-process; never key a module-global map by those objects.
metadata:
  node_type: memory
  type: project
  originSessionId: 48f87cdb-a654-4ed3-ba60-fe8d9c0afea3
  modified: 2026-11-10T00:06:05.435Z
---

In the presenter process, sync-grouped screen managers end up holding the
**identical object reference** for a given foreground datum (e.g.
`marqueeTopData`). `ScreenForegroundManager.receiveSyncScreen`
(`src/_screen/managers/ScreenForegroundManager.ts`) stores
`message.data[key]` straight from the syncing screen's `foregroundData`, so
screen 0 and screen 1's `marqueeTopData` are `===` (verified live via fiber
walk).

**Why:** A **module-level** `WeakMap` keyed by the data object (the old
`containerMapper`) can then only hold ONE container for that shared object.
`createDivContainer` calls `removeDivContainer(data)` first, so whichever screen
rendered LAST evicted the other screen's DOM container — symptom: one screen's
`#foreground` div had 0 children while `marqueeTopData` was set and `isShowing`
was true. This was the "no top marquee on screen #0" bug (fixed 2026-07-15 by
making `containerMapper` a per-instance field). Since 2026-11-09 the slot is a
per-session list (`marqueeTopDataList`) and the shared references are its
entries -- [[foreground-session-owns-overlay]].

**How to apply:** Any registry that maps a foreground/overlay data object to a
per-screen DOM node MUST be scoped per manager instance, never module-global.
The bug only manifests in the presenter (multiple managers in one process, incl.
mini-previews); each real `screen.html?screenId=N` window is its own process with
a single manager, so it never collided. Related: [[dev-hmr-stale-state-qa]].
