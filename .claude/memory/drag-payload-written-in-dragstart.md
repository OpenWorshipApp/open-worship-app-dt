---
name: drag-payload-written-in-dragstart
description: "A drag's dataTransfer is writable only inside dragstart and readable only inside drop: an await before setData sends an empty drag, one before getData reads nothing"
metadata:
  node_type: memory
  type: project
  originSessionId: 446d265c-75ea-4e60-95d4-ac3b5aa61dfd
  modified: 2026-10-22T22:22:46.834Z
---

The browser seals `dataTransfer` the moment a `dragstart` or `drop` handler
yields. Fixed 2026-10-22 after the user's _drag from history item got error_:
the Bible lookup's history row awaited `extractBibleTitle` before
`handleDragStart`, so every drag left with no payload and the Bible pane's
`applyDropped` threw `Unexpected end of JSON input` on `JSON.parse('')`.

- **Writing**: what a source sets must be ready when `dragstart` fires. A
  source that has to resolve something first does it on `pointerenter` /
  `pointerdown` (a mouse always enters and presses before the drag starts),
  keeps it in a ref, and `preventDefault`s the `dragstart` when nothing is
  ready — no drag rather than one that drops nothing
  (`BibleLookupInputHistoryComp`).
- **Reading**: read every `dataTransfer` field before the first await, and
  never let a drop handler raise an error for text it does not understand — a
  dragged link, an OS file or a run-sheet row is not a mistake
  (`extractDragData` returns null; `applyDropped` and
  `NoBibleViewAvailableComp` go through it). `readDroppedFiles` copies every
  file out before it yields the first, because the slide canvas awaits per
  file and the list is empty by the second.
- **`dragStore.onDropped`** is for one drag: `handleDragStart` clears it at
  the next `dragend` (a screen calls it for any drop it cannot read, and nine
  foreground sources never took it back, so an OS file dropped on a screen
  replayed the last countdown).
- **A row stops only the drop it takes.** Every list row sits inside a file
  list whose own drop copies files in; `handleAttachBackgroundDrop` stopped
  EVERY drop, so a `.owb` / `.own` dropped from the disk on a Bibles or notes
  row was lost without a word (fixed 2026-10-22). It stops a background now
  and lets the rest bubble; a picture on a slide card goes on to the
  previewer and becomes a slide.

**Testing it** (the robot test's §6h, coverage rows DD-01..19):

- **`owa_drag` is sealed like the browser** (2026-10-22): the drop gets a copy
  of what `dragstart` wrote, taken when it returned, cleared after the drop's
  handlers ran. It hovers and presses the source first (`pointerover` …
  `mousedown`), as a mouse does. The touch path's transfer is still unsealed.
  Its drop walks into open shadow roots: the Slide Editor canvas draws in
  one, and a drop sent to the host reached no handler.
- **Aim by the label a tool hands out.** Since 2026-10-22 a press or drag
  takes the joined label (`FG Clear Foreground [F10]`) and a long one as cut
  (80 characters in a match, 60 in `nearMisses`); both were refused before,
  the retry included. Two rows of ONE name are twins: rename one first.
- **Driving a second instance**: `OWA_CDP_PORT=<its port>` pins a fresh
  stdio server to it; chrome-devtools page ids are numbered per server
  session, so read `list_pages` in the same session before a `pageId`. The
  in-page matcher is memoised (`window.__owaDomMatch`): after editing
  `domMatch.mjs`, delete it in each page first
  ([[dom-match-memoised-in-page]]).
- **`owa_drop_files`** drops real files and folders from the disk through
  CDP `Input.dispatchDragEvent` — stdio door only, fixture paths only
  (`test-results/` or the temp folder). A page-built `File` has no path, so
  nothing else reaches a list's copy-in. Send `dragOver` twice with a pause:
  Chromium silently discards a drop the page has not yet accepted, and
  Resources answered too late for a back-to-back drop.
- **In vitest**, `src/test-setup/sealedDataTransfer.ts`: dispatch, `seal()`,
  then let the handler's awaits run.
- The chrome-devtools `drag` by uid is the browser's own drag, but reports
  its END in page coordinates, so the ✨ tab strip reads it as a tear-off.

See [[canceled-pointerdown-kills-click]] and [[drag-kind-mime-and-dim-target]].
