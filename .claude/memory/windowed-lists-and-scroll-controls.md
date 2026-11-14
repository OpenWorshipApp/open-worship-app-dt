---
name: windowed-lists-and-scroll-controls
description: "Long lists draw only the rows in view (src/virtual-list) -- a row scrolled away has no DOM until a list is asked to reveal it; the to-the-top and auto-scroll buttons (src/scrolling) run in the app AND in the screen's shadow root"
metadata:
  node_type: memory
  type: project
  originSessionId: 87eaed46-7cb4-4873-b510-f52c277a7713
  modified: 2026-11-11T04:09:16.460Z
---

**Windowed lists** (`src/virtual-list/`). `VirtualGridComp` lays items out
in rows of a computed column count -- a document's slides
(`src/app-document-presenter/items/VarySlidesComp.tsx`), the background
thumbnails (`src/background/BackgroundMediaComp.tsx`), a run-sheet line's
slides -- and `VirtualListComp` takes rows of different heights, the run
sheet itself (`src/presenting-flow/PresentingFlowFileComp.tsx`). Neither owns
its scroller: `src/virtual-list/virtualScrollHelpers.ts` reads the band the
user can see as the intersection of every clipping ancestor and the window,
one listener per scroller however many lists ride it.

- **A row out of view is NOT in the DOM.** Code that finds an item by
  querying the document (the new-file flash, Reveal Original, a slide show
  following what it presents, a run player stepping on) asks first:
  `revealVirtualItem(key)` (`src/virtual-list/virtualRevealHelpers.ts`) asks
  EVERY mounted list, since two panels can list one folder, and
  `notifyElementHighlight`'s `revealKey` asks again on each poll. An agent
  hits the same wall: `owa_find_ui` / `owa_list_ui` / `owa_click` match
  nothing past the fold until `owa_scroll` moves the list (`MC-54`).
- **A reveal DRAWS the row** (`src/virtual-list/useRevealPin.ts`): a scroll
  aimed from estimates misses a far row once the screenful it lands on is
  measured for real. The pin is released on a timer, and while it holds the
  row is re-aimed on every change of the list's height -- a run-sheet line
  holding a document grows by its slides after it is drawn.
- **Heights are measured BY KEY**, not position, and pruned to what the list
  holds (`src/virtual-list/useMeasuredRowHeights.ts`); a row never drawn is
  the MEDIAN of those that were. A caller's guess about one kind of row made
  a 1 000-row sheet 34 000 px tall that was really 150 000, and "go to line
  995" aimed past the end. Rows laid at one measured height had left uneven
  gaps and rows overlapping by up to 26 px. With `getItemHeight` (a slide
  knows its shape) the geometry is arithmetic and exact.

**Scroll controls** (`src/scrolling/`): the to-the-top arrow and the
auto-scroll (play-to-bottom) double chevron with its ⋯ menu, put on a scroller by
`ScrollingHandlerComp` -- the Bible views, Bible Find, the lookup panels, the
slide previewer, file lists, the presenting-flow preview -- and by
`src/_screen/screenHelpers.ts` on the SCREEN, inside a shadow root no app
stylesheet reaches; that is why its CSS is a string injected there
(`TO_THE_TOP_STYLE_STRING` in `src/scrolling/scrollingHandlerHelpers.ts`).

- `applyPlayToBottom` runs from an inline `ref` callback on EVERY render, so
  its state hangs off the button element, never the closure: a per-call
  store read speed 0 after a re-render (a right-click then STOPPED the
  scroll) and a second loop ran the page at double speed.
- Speed keeps its unit (CSS px per 60 Hz frame on 35 px text) but is applied
  per SECOND, scaled by the size the text is shown at: a per-frame step ran
  at half speed on a 30 fps machine, the target hardware.
  The ⋯ menu fires the button's real mouse events, so the two cannot drift
  (`src/scrolling/playToBottomMenuHelpers.tsx`).
- A slow scroll is drawn sub-pixel -- whole pixels to `scrollTop`, the rest
  a `translate` on its own layer -- and `releaseSubPixelScroll` drops the
  layer when it stops (`src/scrolling/subPixelScrollHelpers.ts`).

Related: [[mcp-page-actions-by-label]], [[slide-arrows-need-panel-focus]].
