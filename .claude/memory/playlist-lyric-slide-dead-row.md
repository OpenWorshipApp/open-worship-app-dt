---
name: playlist-lyric-slide-dead-row
description: A lyric ATTACHMENT slide in a playlist could not be read back — getSlideById only searched getSlidesQuick(), which never lists them (fixed 2026-08-06)
metadata:
  type: project
---

A lyric stage document has more slides than its `structure`: `getStageSlides` appends the
**attachment** slides (`genSlidesFromAttachments`, e.g. a YouTube attachment) and whatever
`extendExtraSlide` adds, numbered after the structure's own. `getSlidesQuick()` builds from
`structure` alone, so it never contains those ids.

`LyricAppDocumentStageAbstract.getSlideById` looked the id up in the quick list and returned
`null` on a miss. A playlist stores a lyric slide by id, so an attachment slide dragged into
a run sheet became a dead row: it previewed **"Fail to read file data"** and clicking it
presented nothing, with no toast and no console error.

**Fixed 2026-08-06** — `getSlideById` falls back to the full list for exactly those ids (the
slow path only runs for them), and an unresolvable playlist reference now toasts
`Showing Playlist Item / Fail to read file data` instead of failing silently.

**Why:** the stage is stored correctly, so the file looks right and only a live present
reveals it — matrix row PL-64 exists for this.

**How to apply:** when a lyric slide misbehaves, check whether it is a structure slide or an
appended attachment slide before suspecting the stage. Related:
[[lyric-subsystem-architecture]], [[owa-robot-test-playlist-mode]].
