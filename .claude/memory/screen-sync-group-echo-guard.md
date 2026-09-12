---
name: screen-sync-group-echo-guard
description: noSyncGroupMap is a STICKY echo guard, so color-note groups silently go one-way; reload now repairs divergence via reconcileScreenManagerGroups
metadata:
  type: project
---

`ScreenManager.syncScreenManagerGroup` sets the *receiver's*
`noSyncGroupMap` entry before `receiveSyncScreen`, and never resets it — it is
a `Map<string, boolean>` (`ScreenManagerBase.ts:51`), written via
`.set(prefix, true)` (`ScreenEventHandler.ts:104`, `ScreenManager.ts:490-493`).
`checkIsSyncGroupEnabled` is consulted on the **sender**, so once a screen has
received one group sync for a layer, that screen can no longer broadcast that
layer to its group — the color-note group silently becomes one-way for the rest
of the session. `ScreenDrawManager` and `ScreenFocusManager` both escape it —
every local send calls `enableSyncGroup` first (`sendDrawMessage` /
`sendSyncScreen`, `sendFocusMessage` at `ScreenFocusManager.ts:508` /
`sendSyncScreen` at `:532`) — which is why drawings and the spotlight stay in
lockstep across a group while slides/background drift apart. Bible and
foreground have narrower re-enable paths on their `apply*WithSyncGroup` setters
only (`ScreenBibleManager.ts:296`, `ScreenForegroundManager.ts:711`), and
`ScreenManagerBase.setColorNote` re-enables when a screen joins/leaves a group.

**Why:** this is the root cause of "mini screens in one group show different
content". Layer state is persisted per screenId and each manager reloads its own
copy in its constructor, so the drift survives an app restart.

**How to apply:** as of 2026-07-22, `reconcileScreenManagerGroups` in
`src/_screen/managers/screenManagerHelpers.ts` repairs divergence at load —
elects the member showing the most content (ties → lowest screenId, locked
groups skipped), broadcasts its state, then clears every member's
`noSyncGroupMap` so the repair doesn't itself leave the group one-way. The
sticky guard on the *live* path is still unfixed; fixing it means
save/restore-around-dispatch in `syncScreenManagerGroup`, and needs care that no
layer setter echoes back asynchronously. See CLAUDE.md's "Event dispatch is
microtask-async" section.
