---
name: playlist-references-vs-presets
description: Playlist entries store slides/documents as file references but backgrounds/bible/foregrounds as verbatim presets — and foreground drags only became storable because the widgets now serialize themselves
metadata:
  type: project
---

The playlist (implemented 2026-08-04, branch refactor23) deliberately stores its two
kinds of entry differently, and reviews keep wanting to "unify" them:

- **Slides and documents are REFERENCES** (`filePath` + `id`), resolved at click time.
  A playlist is built days before the service, so a song edited in between must project
  its new words. Snapshotting the dragged slide JSON would silently project stale text.
- **Backgrounds, bible verses and foregrounds are PRESETS** — the drag payload stored
  verbatim in `data`. They are small and self-describing, and for a foreground the
  preset (the marquee text, the countdown duration, the styling) *is* the point.

Two consequences worth knowing before touching this:

- Foregrounds used to travel ONLY through `dragStore.onDropped`, a closure that dies with
  the drag, so they could not be stored at all. Every `Foreground*Comp` drag button now
  ALSO calls `handleDragStart` with a serialized `DragTypeEnum.FOREGROUND` payload, and
  `ScreenManager.receiveScreenDropped` grew a foreground branch. The closure is still set
  — both paths must keep producing the same result.
- A duration countdown stores `durationSecond`, not a resolved date, and quick text
  stores its markdown, not rendered html — otherwise replaying a stored preset later
  would show an expired countdown or stale rendering.

Two more consequences of the same split, both easy to mistake for bugs:

- An entry's `title` is a label **captured when it was added** — purely cosmetic. Renaming
  the underlying file does not change the row's text; resolving real names would mean
  reading every referenced file just to draw a list.
- `colorNote` lives on the ENTRY, not in the shared colour-note settings, so the same slide
  can be flagged differently in two playlists — and colour-noted rows keep their running
  order rather than being re-sorted into groups the way the file lists are.

Export/import (`playlistArchiveHelpers.ts`) follows the bible-note archive pattern:
`.owapl.tar.gz` via `tarCreate`/`tarExtract`, NOT a real zip — the app has no zip
dependency and this matches [[bible-note-archive]]-style code already shipped. Details in
[[playlist-archive-owapl]].

See also [[onscreen-check-must-not-parse]] and [[playlist-onscreen-marking-design]] for why
playlist rows avoid per-row screen checks, [[playlist-drag-and-settings-rules]] for the
drag/settings rules, [[playlist-preview-run-player]] for the floating preview, and
[[playlist-panel-no-longer-dev-only]] — the panel is no longer gated to dev builds.
