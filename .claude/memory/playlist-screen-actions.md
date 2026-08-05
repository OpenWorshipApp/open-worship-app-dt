---
name: playlist-screen-actions
description: Playlist "actions" are a non-DragTypeEnum item kind added from a menu; extend playlistActionList, not the drag pipeline
metadata:
  type: project
---

A playlist element can be a screen ACTION (added 2026-08-04, branch refactor23), not
just content. The registry is `src/playlist/playlistActionHelpers.ts` — id, label,
badge, icon, color and `apply(screenManager)`. Clearing is the first family; more are
expected, which is why the menu entry is a generic `lightning-charge` icon rather than
an eraser. Thirteen ship: the five that mirror the mini screen's clear bar, plus one
per foreground widget (`clear-foreground-<ForegroundDragTargetType>`) built from
`foregroundClearMap`, which is keyed by that type so a NEW foreground widget without a
clear is a compile error. The Foreground panel's **Background Images Slide Show** has
none on purpose — it drives `ScreenBackgroundManager`, so `Clear Background` covers it.

**Why:** an operator's run sheet needs "blank the screen here" between two items, and
the mini screen's clear bar is the only place that lived. Storing it as a playlist
element makes it steppable with the next-key like everything else.

**How to apply:**

- Add an action = append to `playlistActionList` + widen `PlaylistActionIdType`; a new
  FOREGROUND clear is just an entry in `foregroundClearMap` (the id is derived).
  Storage, `validate`, the row, the preview, the drag and the next-key all read it
  from there. `PLAYLIST_ACTION_TYPE` is deliberately NOT a `DragTypeEnum` —
  `acceptedDragTypeList` must keep refusing it so nothing else can produce one.
- Only the id is stored (`{type:'action', data:id}`), no captured `title` —
  `PlaylistItem.title` calls `tran()` live, so labels follow the locale. Reuse a label
  the app already ships or the km key must be added too (see
  [[tran-missing-key-throws-in-dev]]).
- `isShowableOnScreen` stays FALSE for actions (they are run, not shown);
  `isScreenReachable` is the gate for "can go to a screen at all" and is what the
  click / drag / next-key / context menu use. See [[playlist-preview-run-player]].
- Everything routes through `sendPlaylistItemToScreens` in `playlistHelpers.ts`.
- Colours mirror the clear bar's button variants EXCEPT the two `secondary` ones: the
  context menu's own background IS `--bs-secondary`, so those icons were invisible —
  they use `--bs-gray-500`.
- A sync-grouped screen takes its whole group with it when an action runs on one
  member; that is the built-in clear button's behaviour too, not a bug here.
