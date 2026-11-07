---
name: screen-selection-glides-into-view
description: "A selected Bible verse or long-text row on a screen is brought into view by our own ease-out glide (screenGlideScrollHelpers), not scrollIntoView smooth — why, and the three things the glide must keep doing"
metadata:
  node_type: memory
  type: project
  originSessionId: 7de106d3-a9c1-4b7a-a9cf-50b4532fe903
  modified: 2026-11-07T01:38:27.648Z
---

2026-11-06, the user, mid-way through Atom Mode: _for bible and longtext text
on screen scroll into view in selected, shoud be ease in fast to slow, let say
while user reading and it move quickly this will cause distruptioin_.
`ScreenLongTextManager.renderSelectedIndex` used `bringDomTo*View`
(`scrollIntoView({ behavior: 'smooth' })`), whose curve eases in AND out over
a short, distance-bound time. It now calls `glideDomIntoView(dom, block,
this.div)` (`src/_screen/managers/screenGlideScrollHelpers.ts`): ease-out
cubic, 450–900 ms. Every other `bringDomTo*View` caller (the Reader, lists) is
unchanged on purpose: the ask was the screen's text.

What the glide must keep doing, or it breaks something that is not obvious:

- **Its time is counted in screen heights, not pixels.** The Mini Screen and
  the projector each glide on their own layout
  (`bible-screen-view-selected-index`). Counting pixels would land the small
  copy first.
- **It re-marks `markProgrammaticScroll` on EVERY frame.** The scroll-sync
  quiet window is 1000 ms (`REMOTE_SCROLL_QUIET_MS`). A late frame on a slow
  machine would otherwise go out as the operator's scroll and tug the other
  windows mid-glide. It also stops the moment the operator wheels or presses
  (`inputAt > startedAt`), and a new selection cancels the last glide on the
  same scroller.
- **It scrolls only inside the screen's own view** (the boundary). The
  browser's `scrollIntoView` also scrolled every scrollable ancestor,
  presenter panels around a Mini Screen included.

Not verified live: the curve itself. A screenshot cannot catch it, so
`screenGlideScrollHelpers.test.ts` runs the frames by hand. Related:
[[long-text-show]], [[screen-bible-columns]].
