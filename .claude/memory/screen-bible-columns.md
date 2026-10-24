---
name: screen-bible-columns
description: "Several Bibles on a screen with Line Sync off are one scroller EACH, kept on the same verse by the Reader's BibleGroupScrollSync; only the leader is sent, the host column owns the screen's one position and buttons, and each layout answers to the other's scroll names"
metadata:
  node_type: memory
  type: project
  originSessionId: 2b4d5284-62db-497f-a926-53d8c1a58927
  modified: 2026-10-12T03:53:55.384Z
---

Asked for on 2026-10-11 with a picture of a card whose Khmer column had ended
at verse 25 while the NIV beside it was on verse 19: the versions were cells of
ONE table in ONE scroller (`#bible-screen-view`), so the shorter translation
ran out early. Now `BibleBibleTableComp` draws a `.screen-bible-columns` root
with one `.screen-bible-column-<n>` scroller (one table) per Bible whenever
there are several and Line Sync is off; Line Sync and a single Bible keep the
one table in the one box. Everything about the columns is in
`src/_screen/screenBibleColumnHelpers.ts` (a leaf), keyed by the Bible div in a
WeakMap, so `ScreenLongTextManager` stays thin.

What is not obvious from the code:

- **One coordinator, two users.** `BibleGroupScrollSync`
  (`src/bible-reader/bibleGroupScrollHelpers.ts`) takes `verseSelector` and
  `getScale` now. The mini preview is the projector's layout inside a
  `transform: scale(...)`, so verse rects are drawn px and scroll offsets are
  layout px; the scale comes from the Bible div's two widths, never from a
  pane's own `offsetHeight` (rounded -- it would have put the Reader's exact
  1 off by a fraction). The Reader passes nothing and gets the arithmetic it
  always had.
- **Only the leader is sent.** A follower's scroll events are the
  coordinator's own writes, and a column the operator wheeled a moment ago
  still counts as "from a wheel" for a second -- sent out, each would name a
  new leader in the other window and the two would trade the lead every frame.
  The other window moves its OWN followers: `applyRemoteScrollPercentage`
  calls the element's `onRemoteScroll`, which is `followFrom(column)`.
  `followFrom` takes the lead only when it does not have it; taking it on every
  frame restarts every follower's glide and they trail a steady scroll.
- **The host column** is the longest one at render time. It carries the
  screen's one remembered `scroll`, the auto-scroll and "to the top" buttons
  (`z-index: 1`, or the columns after it in the DOM are drawn and clicked over
  them), and it takes the lead back on every auto-scroll frame. A wheel on
  another column while the host slides is GIVEN to the host
  (`steerScreenBibleAutoScroll`), or it would be pulled straight back.
- **Layouts differ between windows, by design.** Line Sync is a setting of each
  screen (colour-group members differ) and an open screen page reads it from
  the snapshot it was shown with, so toggling it changes the card and not the
  showing screen until hide/show -- that staleness is older than the columns.
  A scroll message names its scroller, so the host column also answers to
  `.screen-bible-container-scroll` and the one box to every
  `.screen-bible-column-<n>` (`nameScrollers`). Take that away and a scroll
  from one layout moves nothing in a window drawn the other way.
- **A viewer's scroll is allowlisted by shape** in
  `electron/virtualDisplayProtocol.ts` (`VIEWER_BIBLE_COLUMN_SELECTOR`); it
  cannot import the class name from `src/`, so rename both together.
- **`registerScrollingSyncEvent` lives in `screenScrollSyncHelpers.ts`** (the
  leaf) and is re-exported by `screenEventHelpers` for the managers. The
  column helpers must not import `screenEventHelpers`: it pulls every manager
  in, and `screenBibleHelpers` is loaded by tests that mock none of them.

QA traps met while proving it live:

- **Set/Unset Line Sync re-applies the passage**, and `applyBibleViewData`
  (`MiniScreenBodyComp`) then REBUILDS the Bibles tab's panes from the screen's
  versions -- the operator's own grouped panes and their colour note are gone.
  Say so before toggling it on someone's working app.
- A screen on a **virtual display has no `screen.html` CDP target**. Read it by
  opening `http://127.0.0.1:<mirror port>/vd/<n>/` in a headless Chrome and
  reading the `vd-screen.html` iframe; a viewer has no OS fonts, so its columns
  are other heights than the card's -- which is the honest test of "same verse,
  not same pixel".

Tests: `screenBibleColumnHelpers.test.ts`, the scale / `followFrom` /
`alignTo` cases in `bibleGroupScrollHelpers.test.ts`, matrix row `SP-33`.
Related: [[screen-sync-group-echo-guard]], [[screen-page-settings-are-page-local]],
[[virtual-displays]], [[dev-hmr-stale-state-qa]].
