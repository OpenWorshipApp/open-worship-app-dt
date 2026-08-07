---
name: playlist-cc-elements
description: Playlist CC elements ride along with their host's present; they are copies, not links, and they never choose a screen themselves
metadata:
  type: project
---

A playlist entry can carry **CC elements** — followers that go to the screens with it.
`ccItems` on the entry, `slideCcItems` keyed by slide id on a document entry (the same
shape as `slideScreenIds` / `disabledSlideIds`). Added 2026-08-05.

**Why:** one click had to be able to put a slide AND a top marquee up together; doing it
as two clicks is exactly what an operator cannot spare mid-service.

**How to apply:**

- A CC stores its **own copy** of the payload, so slides stay references and
  backgrounds/bible/foregrounds stay presets — see [[playlist-references-vs-presets]].
  There is no link to maintain and no dangling state; the "original" is found by matching
  a title-free key (`toPlaylistCcOriginKey`) against the rows' `data-playlist-origin-key`
  stamps, which are scoped `${playlistFilePath}::${key}` because the tree lists every
  playlist at once. **Stamp the scoped value, not the bare key** — that mismatch was the
  one bug live testing caught.
- **A CC must never reach `chooseScreenIds`.** It rides the screens its host resolved to,
  via a latch keyed by the EVENT OBJECT (`captureChosenScreenIds` /
  `notifyChosenScreenIds` in `screenChoosingHelpers`, fired one macrotask later so the
  host's content lands first). Passing an empty list as a preset falls through to the
  selected screens and then to the menu — a second question for one click. That is why
  `applyOnScreenIds` / `showDroppedDataOnScreenIds` exist beside the `…OnScreens` pair.
  The latch holds only because React dispatches one synthetic event through capture and
  bubble and `selectVarySlide` carries that same object across its `setTimeout` — anything
  that re-wraps an event on the way silently kills path (iv).
- Arming happens at `sendPlaylistItemToScreens` (covers the tree row, the preview's
  button/foreground/action click, `Show on Screens` and the run player's ELEMENT next-key)
  plus three components that bypass that funnel: the tree's slide row, the preview's
  background and bible rows, and `VarySlidePreviewComp.handleClickingCapture`. The run
  player's CHILD next-key needs no code — it dispatches a real click onto the card.
  Same reasoning as [[playlist-preview-run-player]].
- A document entry's own CCs ride with **every** slide of it (a document is never
  presented as a unit), via `getEffectiveSlideCcItems`.
- **Dropping onto a row now attaches a CC instead of appending an element.** The drop MUST
  `stopPropagation()` or `FileItemHandlerComp`'s `<li>` also hands it to
  `PlaylistFileComp.handleDropping` and the payload lands twice. Adding an element is now
  the playlist NAME row / empty state only. A `null` payload must not stop propagation.
- **A row dragged out of a playlist carries no payload for several kinds** — an action is
  not a `DragTypeEnum` at all, and a slide and a document both return null from
  `dragSerialize`. So a drop whose `playlistDraggingStore.current` is set resolves the
  source from the playlist BY INDEX (`Playlist.addItemCcFromItemIndex`) instead of from
  `dataTransfer`; that is the only reason dragging a `Clear Bible` action onto another row
  works.
- **An element row carries BOTH drops, split by pointer position**: top/bottom bands
  (`REORDER_EDGE_HEIGHT` 7px, capped at height/3) take the POSITION, the middle attaches —
  and **Ctrl/⌘ forces the position, Alt forces the attach** anywhere on the row (Ctrl wins
  if both). `position` means MOVE for a row of this playlist and INSERT AT THAT INDEX for
  anything else, which is the only way to land an outside payload anywhere but the end of
  the sheet. The whole rule is `toPlaylistRowDropKind` in `playlistHelpers`, pure and
  tested; the component only says whether the BANDS mean anything (they are a
  same-playlist affordance — an outside payload has no "between two lines" reading to
  discover by accident, so it attaches unless Ctrl is held). The handlers live on `PlaylistRowComp`, NOT
  on `PlaylistItemComp`'s wrapper — `event.currentTarget` has to be the row for the rect to
  mean anything. Slide rows and CC rows have nothing to reorder, so their whole row
  attaches.
- **One follower does not go to a screen at all**: a `Next: Timeout` (a RUN action, see
  [[playlist-auto-next]]) attached to a line means "show this, and go on by yourself N
  seconds later". It is fired from `applyPlaylistCcItemsOnScreenIds` before the screen
  resolution is even read, so it never asks for a screen; its CC row swaps
  `Set Specific Screen` for `Change Seconds`. A `Next: Interval` is the one kind refused
  for a reason other than reaching no screen — nothing an operator does stops an interval
  — and the split is `canBeCcItem` on the registry entry, read by `toCcItemJson` and by
  the apply loop.
- **A `Jump to` host turns the CC into a POINTER, not a follower** — it names the line the
  run goes to. `PlaylistItem.checkIsCcTargetHost` switches `toCcItemJson(json, isTarget)`
  into that mode, where only an error row is refused: a DOCUMENT (never an ordinary CC) is
  the usual target. Exactly one, capped in `addItemCcItem` (the one attach funnel) and
  again on read in the `ccItems` getter. See [[playlist-auto-next]].
- **A CC is NEVER parked.** `isDisabled` is stripped in `toCcItemJson` (write) and in
  `buildCcItems` (read), the CC row has no `Disable` entry, and the apply loop has no
  parked check. Attaching a parked element therefore gives a follower in play while the
  element stays parked — which is the only reading that does not silently do nothing.
- Clicking a CC row never presents it — it reveals its original in the tree and the
  floating preview, and the preview's frame capture handler must skip
  `[data-playlist-cc-row]` or the run cursor moves under the operator.
- **An ACTION's origin key carries what it is armed with** (`action|next-timeout|3`,
  `action|next-timeout|20:17`). Without it a sheet holding `Next: Timeout (3)` and
  `(4)` revealed — and jumped to — whichever came first, since every timeout keyed as
  `action|next-timeout`. The one cost is that re-arming either side breaks the exact
  match, so BOTH lookups fall back to the arming-stripped key
  (`toPlaylistCcOriginBaseKey`; `findPlaylistCcOriginIndex` for the jump, a `^=` prefix
  selector for the reveal) — exact first, always, or a sheet holding both armings
  resolves to the wrong one. Fixed 2026-08-05.
- Known wart: clicking a live slide again toggles the slide off but re-applies the CC.
  Use a clear action to take both down.
