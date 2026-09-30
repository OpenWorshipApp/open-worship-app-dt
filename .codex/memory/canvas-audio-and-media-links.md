---
name: canvas-audio-and-media-links
description: The `audio` canvas item is preview-only (no screen sync, no preload) and image/video/audio may hold a link instead of a path — a lyric attachment becomes exactly such an item
metadata:
  type: project
---

Two rules added on branch refactor24 (2026-08-06) that span the slide editor,
the screen manager and the archive helpers:

**`CanvasItemAudio` is preview-only.** Its renderer stamps `PREVIEW_ONLY_ATTR`
(`data-preview-only`) on the `<audio>` and sets `preload="none"`. In
`ScreenVaryAppDocumentManager.cleanupSlideContent` a preview-only media element
short-circuits the whole sync block: no `genVideoIDFromSrc` id, no
`preload='auto'`, no `setSlideVideoCurrentTimeForce` broadcast. On the projected
screen it is hidden and never fetched; on the presenter mini screen it gets
sound + native controls + pointer events and only the block-unload listeners.
Sound comes from the presenter machine, exactly like a background audio. PPTX /
DOCX embedded media carries no such mark and keeps the full sync wiring — do
not "unify" the two branches.

**A media item's source may be a link.** `src/helper/mediaSourceHelpers.ts` is
deliberately dependency-free so view components, models and archive helpers can
all import it without dragging in `appProvider`. It answers **two different
questions**, and mixing them up is the trap:

- `checkIsRemoteMediaSource` — "is this off this machine?" `http(s)` ONLY. This
  is the POLICY question: `iterateCanvasFileItems` skips such a source so the
  archive never bundles it, and the canvas context menu offers Open/Copy URL
  instead of Reveal/Download.
- `checkIsUrlMediaSource` — "is this already a URL?" `http(s)` **or** `file://`.
  This is the RENDERING question, and the only one the video/audio renderers
  ask: a URL is used verbatim, a plain path goes through `pathToFileURL`. A
  `file://` source run through `pathToFileURL` yields a mangled, dead `src`.

A link goes verbatim into `filePath` (video/audio) or `srcData` (image).

**A lyric attachment becomes one of these items.** open-lyric writes the Config
`Attachments` field as URLs, so a local file arrives as `file:///…` — that is
why the `file://` case exists at all.
`LyricAppDocumentStageAbstract.genCanvasItemPropsFromAttachment` maps
youtube/image/video/audio/other onto the canvas kinds and `pdf` is still a TODO.
It calls each class's **`genCanvasItemPropsFromLink(url, boxProps)`**, NOT
`genCanvasItemFromLink(x, y, url)`: the latter downloads the media just to
measure it, and an attachment slide's box is the slide's own content bounds
regardless of the media's ratio, so the measurement would be discarded. Keeping
it synchronous also keeps a song's slide build free of network I/O. An
attachment whose link is unusable (the `pdf` branch, or open-lyric's `other`
fallback that carries raw text) still yields its slide, just with no item.

Related: [[presenting-flow-references-vs-presets]], [[document-archive-owadoc]],
[[lyric-subsystem-architecture]].
