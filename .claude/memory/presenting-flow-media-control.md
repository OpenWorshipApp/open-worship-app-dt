---
name: presenting-flow-media-control
description: Slide: Media Control is the one action that exists ONLY as a CC element and the only one whose settings live on the attachment; its pin narrows the host's screens instead of replacing them
metadata:
  type: project
---

`Slide: Media Control` (added 2026-08-08) drives the media INSIDE a slide from the run
sheet — play/pause/stop, from a point, up to a point, at a volume and a speed. Cyan,
badge `MC`, icon `sliders`. A SCREEN action (`target: 'screen'`), so `isScreenReachable`,
the pin and the CC apply loop all take it for free — see
[[presenting-flow-screen-actions]].

**Why:** slide media was operator-driven only. "Start this video three seconds after the
slide goes up, from 0:10, at 2x, and stop it at 1:10" meant sitting on the mouse.

**How to apply:**

- **It is the ONE action that is not in `presentingFlowActionMenuList`.** The registry/menu
  split exists for exactly this: the id resolves, so a stored one reads back, but `Add
  Action` never offers one loose. The only way to make one is `genAddMediaControlContextMenu`
  on a SLIDE host — `isSlide || isAppDocument` on an element row, every slide row inside a
  document — which calls `PresentingFlow.addItemCcAction`, the only attach path that MINTS
  the element it points at (element + reference in ONE write). A listed element carries no
  settings and clicking it does nothing, by design.
- **Its settings live on the CC RECORD** (`PresentingFlowCcItemType.mediaControl`), widening
  the "a CC stores `{uuid, screenIds}` and NOTHING else" rule by one field on purpose: the
  same controller attached to two slides must mean two different things.
  `buildCcItems` OVERLAYS it onto the resolved json exactly as `screenIds` is overlaid, and
  `resolveCcItemJson` STRIPS any an element carries so a hand-edit cannot become a second
  source. `PresentingFlow.setItemCcItemMediaControl` writes the config AND the pin in one
  call — the panel asks both as one answer.
- **Every field but `mode` is absent-means-leave-alone**, not absent-means-default. An unset
  volume must not undo the level the operator set by hand on the mini screen.
  `pauseAfterSecond`/`pauseAtSecond` are ALTERNATIVES (`applyPresentingFlowMediaControlPause`
  deletes the other), the `actionNumber`/`actionTime` rule again.
  `toPresentingFlowMediaControl` reads defensively and NEVER throws — do not add it to
  `PresentingFlowItem.validate`.
- **`filtersHostScreenIds` is new on `PresentingFlowScreenActionType`, true only here.**
  Its pin NARROWS the host's screens (`intersectCcScreenIds`) instead of replacing them
  (`resolveCcScreenIds`): it acts on media the host just projected, so a pin naming a screen
  the host never reached names a screen with no media on it and must do NOTHING.
- **`apply` now takes `(screenManager, presentingFlowItem)`.** The other fifteen entries
  (16 screen actions total: 5 clears + 8 FG clears + 2 show/hide + media-control)
  ignore the second argument; widening it beat a third `target` family, which would have
  cost branches in `isScreenReachable`, the pin gate, the drop path and the CC apply loop.
- **The executor runs on the PRESENTER side** (`screenSlideMediaControlHelpers.ts`, under
  `_screen` so `ScreenVaryAppDocumentManager` can import its canceller — nothing under
  `_screen` may import the presenting flow, hence the config module being a dependency-free
  leaf). It drives the mini screen's elements and lets the projection follow through the
  `play`/`pause`/`timeupdate` listeners `cleanupSlideContent` already attached — the same
  route an operator's own click takes. `getAllMediaElements()` (all `video, audio`,
  shadow-piercing) is new beside `getMediaElements(videoId)`.
- **`playbackRate` had to be SYNCED, not just set.** `setVideoCurrentTime` re-seeks a
  follower past 0.15s of drift, so a presenter at 2x against a screen at 1x would seek the
  projection forward on every tick. It rides `SlideVideoTimeDataType` as an optional field
  (omitted at 1, so the common message is unchanged), and the three `handleSlideYouTube*`
  handlers carry `player.playbackRate` too — a YouTube-ONLY slide broadcasts nothing else
  that knows the rate, so leaving it off let the next tick reset every follower to 1x.
  `SlideYouTubePlayer` remembers the rate and drops a repeat: `applyYouTubeSync` runs per
  tick and would otherwise `postMessage` per player per `timeupdate`.
- **Volume is presenter-side only and that is not a gap.** The projected screen holds slide
  media `muted` on purpose. A preview-only canvas `audio` exists only on the presenter at
  all ([[canvas-audio-and-media-links]]) and is driven there.
- **`pauseAtSecond` is WATCHED, not timed** — a one-shot `timeupdate` listener, so a rate
  change or a manual scrub cannot make it miss. A YouTube embed has no `timeupdate` to hang
  one on (its callback is taken by the group sync), so its stop point is TIMED from the
  media-clock delta over the rate.
- **Everything armed is dropped when the slide changes**, from the one point
  `set_varySlideData` writes `_varySlideData` (past every early return). A pause left
  running would pause whatever went up next, and a `timeupdate` watcher on a replaced
  element would hold that slide for the life of the app. One slot per SCREEN — a later
  controller supersedes the earlier one outright.
- The gear is `PresentingFlowCcRowComp`'s `extraChild` (the row's one clickable trailing
  icon; `stopPropagation` is mandatory or the click fires the app's UNSCOPED FileSource
  `select`), with `Media Control Settings` on the CC row menu as the right-click route.
  The floating preview draws CC rows through the same component, so it is there for free.
- Unit tests: only `src/_screen/managers/screenSlideMediaControlHelpers.test.ts`
  (fake timers) survives. `presentingFlowMediaControl.test.ts` and the intersection
  case in `presentingFlowCcPropagation.test.ts` were deleted 2026-08-24 — the
  presenting-flow half is untested.

See [[presenting-flow-cc-elements]], [[presenting-flow-screen-pinning]].
