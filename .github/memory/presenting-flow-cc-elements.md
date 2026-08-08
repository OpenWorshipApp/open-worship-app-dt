---
name: presenting-flow-cc-elements
description: Presenting Flow CC elements ride along with their host's present; they are UUID references to a listed line, and they never choose a screen themselves
metadata:
  type: project
---

A presenting flow entry can carry **CC elements** — followers that go to the screens with it.
`ccItems` on the entry, `slideCcItems` keyed by slide id on a document entry (the same
shape as `slideScreenIds` / `disabledSlideIds`). Added 2026-08-05; **rebuilt on UUID
references 2026-08-06** — a CC stored a COPY of the payload before that, and every note
about origin keys is stale.

**Why:** one click had to be able to put a slide AND a top marquee up together; doing it
as two clicks is exactly what an operator cannot spare mid-service.

**How to apply:**

- **A CC stores `{uuid, screenIds?}` and NOTHING else.** Every entry carries a `uuid`
  (`genPresentingFlowItemUuid`, minted on add; a DUPLICATE is re-keyed; a legacy entry gets one
  only when something first points at it — reading a sheet never rewrites a file). What a
  CC shows and sends is read off that entry every time
  (`PresentingFlowItem.resolveCcItemJson`), so **re-arming a `Next: Timeout` element re-arms
  every CC of it at once**. Its own pin is the one override; `Change Seconds` is gone from
  the CC row menu.
- **Resolution needs the LIST, not the item.** `PresentingFlow.getItems` calls
  `PresentingFlowItem.bindCcSources(items)`, which hands every entry one shared uuid→item map
  (built only when some entry has CCs). A `PresentingFlowItem` built alone — a test, a CC —
  resolves nothing, on purpose. Rows are stamped `data-presenting-flow-item-uuid` (bare uuid,
  unscoped: it is globally unique), which is what `notifyPresentingFlowCcOrigin` and the run's
  `jumpToUuid` query.
- **Every CC has an element of its own in the sheet.** A payload dropped from outside is
  APPENDED at the bottom first and the CC then points at it; a row dragged from ANOTHER
  presenting flow is copied in the same way (a uuid is an identity within one file). Both happen
  in ONE write (`PresentingFlow.attachItemCcItem`), so a refused attach never strands an
  appended line. Removing an element DROPS every CC of it
  (`dropPresentingFlowCcItemsOfUuid`), and a reference answering to nothing is simply not
  drawn.
- **A CC must never reach `chooseScreenIds`.** It rides the screens its host resolved to,
  via a latch keyed by the EVENT OBJECT (`captureChosenScreenIds` /
  `notifyChosenScreenIds` in `screenChoosingHelpers`, fired one macrotask later so the
  host's content lands first). Passing an empty list as a preset falls through to the
  selected screens and then to the menu — a second question for one click. That is why
  `applyOnScreenIds` / `showDroppedDataOnScreenIds` exist beside the `…OnScreens` pair.
  **The latch is keyed by the NATIVE event, never React's wrapper** (fixed 2026-08-06): a
  slide card renders into a shadow root with its OWN React root, so one click is wrapped
  TWICE — the outer tree arms the followers, the inner tree resolves the screens — and
  keying on the wrapper silently dropped every follower of every document slide in the
  floating preview, with no error and no toast. `selectVarySlide` still has to carry the
  same event across its `setTimeout`.
- Arming happens at `sendPresentingFlowItemToScreens` (covers the tree row, the preview's
  button/foreground/action click, `Show on Screens` and the run player's ELEMENT next-key)
  plus three components that bypass that funnel: the tree's slide row, the preview's
  background and bible rows, and `VarySlidePreviewComp.handleClickingCapture`. The run
  player's CHILD next-key needs no code — it dispatches a real click onto the card.
  Same reasoning as [[presenting-flow-preview-run-player]].
- A document entry's own CCs ride with **every** slide of it (a document is never
  presented as a unit), via `getEffectiveSlideCcItems`.
- **Dropping onto a row now attaches a CC instead of appending an element.** The drop MUST
  `stopPropagation()` or `FileItemHandlerComp`'s `<li>` also hands it to
  `PresentingFlowFileComp.handleDropping` and the payload lands twice. Adding an element is now
  the presenting flow NAME row / empty state only. A `null` payload must not stop propagation.
- **A row dragged out of a presenting flow carries no payload for several kinds** — an action is
  not a `DragTypeEnum` at all, and a slide and a document both return null from
  `dragSerialize`. So a drop whose `presentingFlowDraggingStore.current` is set resolves the
  source from the presenting flow BY INDEX (`PresentingFlow.addItemCcFromItemIndex`) instead of from
  `dataTransfer`; that is the only reason dragging a `Clear Bible` action onto another row
  works.
- **An element row carries BOTH drops, split by pointer position**: top/bottom bands
  (`REORDER_EDGE_HEIGHT` 7px, capped at height/3) take the POSITION, the middle attaches —
  and **Ctrl/⌘ forces the position, Alt forces the attach** anywhere on the row (Ctrl wins
  if both). `position` means MOVE for a row of this presenting flow and INSERT AT THAT INDEX for
  anything else, which is the only way to land an outside payload anywhere but the end of
  the sheet. The whole rule is `toPresentingFlowRowDropKind` in `presentingFlowHelpers`, pure and
  tested; the component only says whether the BANDS mean anything (they are a
  same-presenting-flow affordance — an outside payload has no "between two lines" reading to
  discover by accident, so it attaches unless Ctrl is held). The handlers live on `PresentingFlowRowComp`, NOT
  on `PresentingFlowItemComp`'s wrapper — `event.currentTarget` has to be the row for the rect to
  mean anything. Slide rows and CC rows have nothing to reorder, so their whole row
  attaches.
- **One follower does not go to a screen at all**: a `Next: Timeout` (a RUN action, see
  [[presenting-flow-auto-next]]) attached to a line means "show this, and go on by yourself N
  seconds later". It is fired from `applyPresentingFlowCcItemsOnScreenIds` before the screen
  resolution is even read, so it never asks for a screen. A `Next: Interval` is the one
  kind refused for a reason other than reaching no screen — nothing an operator does stops
  an interval — and the split is `canBeCcItem` on the registry entry, read by
  `resolveCcItemJson` and by the apply loop. A CC'd timeout met by a running interval
  BORROWS its cycle rather than replacing it; see [[presenting-flow-auto-next]].
- **A `Jump to` host turns the CC into a POINTER, not a follower** — it names the line the
  run goes to. `PresentingFlowItem.checkIsCcTargetHost` switches `resolveCcItemJson(json, isTarget)`
  into that mode, where only an error row is refused: a DOCUMENT (never an ordinary CC) is
  the usual target. Exactly one, capped in `attachItemCcItem` (the one attach funnel) and
  again on read in the `ccItems` getter. See [[presenting-flow-auto-next]].
- **A CC is NEVER parked.** `isDisabled` (with the per-slide maps and the element's own
  CCs) is left behind by `resolveCcItemJson`, the CC row has no `Disable` entry, and the
  apply loop has no parked check. Following a parked element therefore gives a follower in
  play while the element stays parked — the only reading that does not silently do nothing.
  One level also falls out rather than being enforced: a reference has no payload for a CC
  of its own to hang off.
- Clicking a CC row never presents it — it reveals the element it points at, in the tree
  and the floating preview at once, and the preview's frame capture handler must skip
  `[data-presenting-flow-cc-row]` or the run cursor moves under the operator.
- The `.owapf` archive no longer walks CC jsons for paths: a CC holds none, and what it
  points at is a listed entry walked in its own right ([[presenting-flow-archive-owapf]]).
- **Migrating a real presenting flow means migrating `<file>.owpf.histories/<n>-head`**, not just
  the `.owpf` — `AppEditableDocumentSourceAbs.getJsonData` reads the editing-history HEAD,
  so a file edited underneath the app is simply ignored (see [[dev-data-dir-is-separate]]).
- The bug that forced the rebuild: a derived key could not tell `Next: Timeout (3)` from
  `(4)`, so clicking a CC revealed — and a `Jump to` jumped to — whichever came first. A
  uuid has nothing to disambiguate. `toPresentingFlowCcOriginKey` and every `*OriginKey` helper
  are GONE; don't reintroduce a derived identity.
- Known wart: clicking a live slide again toggles the slide off but re-applies the CC.
  Use a clear action to take both down.
