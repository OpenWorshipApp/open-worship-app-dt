---
name: playlist-screen-actions
description: Playlist "actions" are a non-DragTypeEnum item kind added from a menu; two families now — screen actions and run actions — extend playlistActionList, not the drag pipeline
metadata:
  type: project
---

A playlist element can be an ACTION (added 2026-08-04, branch refactor23), not just
content. The registry is `src/playlist/playlistActionHelpers.ts` — id, label, badge,
icon, color, and a `target` discriminant that splits it into TWO families:

- `target: 'screen'` → `apply(screenManager)`. Thirteen ship: the five that mirror the
  mini screen's clear bar, plus one per foreground widget
  (`clear-foreground-<ForegroundDragTargetType>`) built from `foregroundClearMap`, which
  is keyed by that type so a NEW foreground widget without a clear is a compile error.
  The Foreground panel's **Background Images Slide Show** has none on purpose — it drives
  `ScreenBackgroundManager`, so `Clear Background` covers it.
- `target: 'run'` → `start(filePath, actionNumber)` and touches NO screen (added
  2026-08-05, branch refactor24). Two ship: `next-interval` and `next-timeout`, which
  drive [[playlist-auto-next]].

**Why:** an operator's run sheet needs "blank the screen here" between two items, and
the mini screen's clear bar is the only place that lived. Storing it as a playlist
element makes it steppable with the next-key like everything else — and once a run sheet
holds instructions, "carry on by yourself from here" is one too.

**How to apply:**

- Add an action = append to `playlistActionList` + widen `PlaylistActionIdType`; a new
  FOREGROUND clear is just an entry in `foregroundClearMap` (the id is derived).
  Storage, `validate`, the row, the preview, the drag and the next-key all read it
  from there. `PLAYLIST_ACTION_TYPE` is deliberately NOT a `DragTypeEnum` —
  `acceptedDragTypeList` must keep refusing it so nothing else can produce one.
- Only the id is stored (`{type:'action', data:id}`) plus `actionNumber` for the run
  family, no captured `title` — `PlaylistItem.title` calls `tran()` live, so labels
  follow the locale (the number is appended AFTER `tran`, never baked into the key).
  Reuse a label the app already ships or the km key must be added too (see
  [[tran-missing-key-throws-in-dev]]).
- Narrow with `PlaylistItem.screenAction` / `.runAction`, never `action.apply` behind an
  `isAction` test. `isShowableOnScreen` is FALSE for every action (they are run, not
  shown); `isScreenReachable` = content + SCREEN actions and is the click / drag / pin /
  menu gate; `isRunReachable` adds the run family and is what the next-key stops on.
  See [[playlist-preview-run-player]].
- Everything routes through `sendPlaylistItemToScreens` in `playlistHelpers.ts` — which
  is also where a run action is peeled off BEFORE `armPlaylistCcPropagation`: it
  resolves no screens, so a CC attached TO one could never fire (its menu offers no
  `Add CC Elements`). The other direction is open for the timeout only —
  `toCcItemJson` reads `canBeCcItem`, and `applyPlaylistCcItemsOnScreenIds` fires it.
- Colours mirror the clear bar's button variants EXCEPT the two `secondary` ones: the
  context menu's own background IS `--bs-secondary`, so those icons were invisible —
  they use `--bs-gray-500`. The run family wears no eraser and no ONE colour: timeout
  `--bs-warning`, interval `--bs-teal`, jump `--bs-purple` — three different things to find
  at a glance mid-service. The row's BADGE is tinted with the icon's colour too (its badges
  are glyphs, not ids), which in practice tints only the action rows.
- A sync-grouped screen takes its whole group with it when an action runs on one
  member; that is the built-in clear button's behaviour too, not a bug here.
