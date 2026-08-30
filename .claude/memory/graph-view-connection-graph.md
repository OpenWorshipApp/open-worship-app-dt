---
name: graph-view-connection-graph
description: The connection graph is a PURE non-React core in src/graph-view/core plus a thin React layer; a second dataset is one GraphSourceType, and the ring geometry has clearances that must not be tweaked casually
metadata:
  type: project
---

**`src/graph-view/` — the floating "Open Graph Preview" panel, added 2026-08-29.**
Boxes for lookup records, connected by labelled curved edges; expand, drag, pan,
zoom, filter, find a path between two people, save/print. It is a VIEW over data
the app already loads — it reads no new files.

**The core is deliberately not React.** Everything under `core/` (types,
geometry, graphModel, graphEngine, pathFinder, viewport) is pure TypeScript with
**no React and no import from anywhere else in `src/`** — the user intends to
lift it out as a standalone package. `graphViewStore.ts` is the ONLY module that
binds it to React (`useSyncExternalStore` over `createGraphEngine()`). An
`import { ... } from 'react'` inside `core/` is a bug, not a shortcut.

**A second dataset is one `GraphSourceType`, not a fork.** Node kinds and
relation kinds are source-defined strings; `lookupGraphSource.ts` is the first
implementation and a bible cross-reference one is planned. To add a source:
implement the interface, add a lazy body component, and add one line to the
source switch in `GraphViewPanelsComp`.

### Geometry clearances are load-bearing (`core/geometry.ts`)

Rings are **ellipses** (`RING_Y_RATIO`), because a box is 168 wide and 88 tall
and circular rings wasted so much vertical room that a 23-box fan came out
1300px tall in a 400px viewport. Three constraints must all hold or boxes
overlap, and the overlap test in `graphModel.test.ts` is what catches it:

- `RING_RADIUS >= NODE_WIDTH + NODE_GAP` — keeps ring 0 clear of the root.
- `RING_STEP >= NODE_WIDTH + NODE_GAP` — adjacent rings run closest together at
  the SIDES, where they differ in x only.
- `RING_STEP * RING_Y_RATIO >= NODE_HEIGHT + NODE_GAP` — and at the top/bottom,
  where they differ in y only.

Two more traps that cost real debugging:

- **Nodes are spaced by ARC LENGTH, not by angle** (`getAngleAtArcFraction`).
  Equal angles on a flattened ellipse bunch up at the top and spread at the
  sides, which left some boxes overlapping while the collision resolver
  inflated the whole graph trying to fix it.
- **Each ring spans the WHOLE sweep independently.** Spreading one global
  fraction across every slot gave each ring a narrow slice of the arc and
  crammed its nodes into a corner.
- `NODE_HEIGHT` must match what the box actually renders at; the stylesheet
  pins `.graph-view__node { height: 88px }` so the two cannot drift.

### Viewport-tick isolation (perf pass 2026-08-30)

A pan or zoom commit replaces the GRAPH OBJECT but not `nodeList`/`edgeList`,
and everything downstream leans on that:

- `GraphSurfaceComp`'s `getVisibleGraph` and `getPathEdgeKeySet` memos key on
  the STRUCTURAL fields (`nodeList`, `edgeList`, `hiddenRelationList`,
  `rootKey`, `pathNodeKeyList`), never on `graph` — `[graph]` handed the edge
  layer and every box a fresh identity per wheel tick.
- `viewByKey` is built over the FULL node list and `resolveEdgeLabel` reads it
  through a ref; it must NOT go back to a per-edge `nodeList.find` +
  `getNodeView` (O(edges x nodes) plus an allocation per edge, per render).
- Wheel ticks are coalesced to one `setViewport` per rAF inside the wheel
  effect; the multiplicative step composes over the summed delta so the result
  is identical (verified 128 -> 425 -> 128 against `exp(±8·60/400)`).
- `RenderGraphPanelComp` is memoized: the engine replaces only the changed
  graph, so other open panels bail on prop identity.
- A node drag builds `buildDragCache` once per gesture (elements, incident
  edges, other endpoints, bows, bounds), guarded by graph identity so a
  mid-drag store commit rebuilds it. It also passes the BOW, so multi-edges no
  longer snap straight while dragging.
- `lookupGraphSource.countNeighbours` for a LOCATION reads
  `getMentionCountMap` — ONE scan over all name records builds every
  location's mentioned-by count, weakly keyed by the managers object so it
  dies with the refcounted dataset (id -> number only). Ten location boxes in
  one expansion used to pay ten full scans inside a single render.
  `getNeighbours` still scans per call on purpose: it needs records, is
  user-initiated and sits behind the spinner.

### Rendering and gesture rules

- **Dragging writes straight to the DOM** (`left`/`top`, and the incident edges'
  `d`) per rAF and commits to the store once on pointer-up. Committing per frame
  would re-render every box 60x/s.
- **The edge SVG has NO `viewBox`** — one would rescale user units to the CSS
  box and drift the lines off the DOM boxes. Explicit px width/height in raw
  graph units, positioned from the computed world bounds (a fan to the upper
  left lives at negative coordinates).
- Edge labels use `paint-order="stroke"` for their halo; a background `<rect>`
  would need a `getBBox()` per label, which is exactly the layout thrash to
  avoid.
- **Zoom is an INTEGER PERCENT**, and the wheel/pinch handling is hand-rolled
  rather than `useZoomingRegistering`: a graph wants a PLAIN wheel to zoom,
  anchored on the cursor, with a multiplicative step. The shared hook is
  Ctrl-gated, centres on the viewport, and **rounds** its pinch value — a 0.25–3
  fraction would collapse to 0/1/2/3.
- **Never pass `isBodyDraggable: true`** to the widget: it flips the content's
  `data-no-widget-drag` to `"false"` and then every node drag drags the panel.
  Also override `.floating-widget__content`'s `overflow: auto` to `hidden`, or
  the absolutely-positioned boxes grow scrollbars.

**Anything a box shows that the DATASET does not name goes through an optional
source hook, never a direct app call from the surface.** `resolveVerseTitle` is
the first: `verseList` holds canonical keys (`GEN 24:29-30`) and only the bible
the reader is showing can turn one into `លោកុប្បត្តិ ២៤:២៩-៣០`, so the
lookup source implements it and `GraphSurfaceComp` stays dataset-agnostic. It is
async and one bible read per reference — resolve only what a menu is about to
show, in `mapInYieldingBatches`, and keep the canonical key as the `target` and
as the fallback label.

**A box's right-click menu is built from the same handlers its buttons call**,
all defined inside the one `nodeCallbacks` `useMemo` so the box stays memoized.
Two rules there: read the neighbour count from `countCacheRef`, never re-count
(a LOCATION count scans every name record), and hand the ORIGINAL right-click
event to the rows that open a further menu, so it appears at the pointer. Menu
icons go through `genContextMenuItemIcon`, which gives the fixed-width icon
column translated labels need — a bare `<i>` sits flush against the text.

### History, layout and fonts

- **Undo/redo lives in the engine, as snapshots.** Transforms are structural,
  so an entry is an array of pointers, not a copy — capped at 30 and deleted
  with the graph. Two rules keep it usable: consecutive VIEWPORT changes inside
  700ms are one step (a wheel tick each would be useless), and viewport moves
  the APP makes (first-mount centring, the fit that rides an expansion or a
  re-layout) pass `isUserMove: false` and record nothing. Keys are handled on
  the focused panel, never on the window: several graphs can be open.
- **`relayoutGraph` is path-aware.** A found path is a CHAIN; laying 32
  generations out radially spirals them back over each other, so when
  `pathNodeKeyList` has more than one entry the chain layout is rebuilt and the
  rings only fan what hangs off it. It also resets pan to 0 and puts the root at
  the origin, so the caller MUST fit afterwards or the graph lands in the
  viewport's top-left corner.
- **Opening a record starts FRESH — there is no implicit last session.** It was
  tried and removed: a path or a re-root inside the panel moves the root and the
  title, so clicking `David` came back as a stranger's family under David's
  name. `openGraphPreview` now just calls `open()` (an already-open panel is
  raised, not reset), and NAMED PRESETS are the only persistence. `repairGraph`
  survives for presets stored before `setPath` re-rooted: a dangling `rootKey`
  moves onto the first box rather than the preset being dropped.
- **The path bar has ONE endpoint.** The source is always the graph's current
  ROOT (a fixed chip), which is why `setPath` re-rooting matters: the next
  search carries on from where the last one arrived. Picker rows resolve
  `getNodeView` per row for the English name — `searchNodes` returns a bare
  `GraphNodeRefType` with no `kjvName` on it.
- **`setPath` re-roots and re-titles.** The chain replaces the canvas, so the
  old `rootKey` pointed at a box that was gone and the panel kept the name of a
  record nobody could see.
- **The font is declared ONCE on `.graph-view`.** Boxes, SVG edge labels, chips
  and dock all inherit it. Only two things sit outside and need their own: the
  widget TITLE (chrome — resolved per source, so a second dataset is not
  assumed to use the lookup language) and any CONTEXT MENU (a portal), where a
  verse menu takes the BIBLE's font rather than the record language's.

- **Re-rooting must be followed by a re-layout and a fit, in ONE step.**
  `reRootGraph` moves the new centre to the world origin AND clears the pan, so
  by itself it threw the graph into the viewport's top-left corner still
  arranged around the box it used to hang from. `engine.reRoot` takes the
  relation vocabulary and does both transforms inside one `replace`; the fit
  rides along as `isUserMove: false`. `resetToNode` (**Use as root**) is the
  same shape.

### Things that bit during the build

- `onClick={onFitToView}` passed React's MouseEvent as the "node list" and took
  the app down with "Reload is needed". Handlers with optional first arguments
  must be wrapped, and `handleFitToView` now checks `Array.isArray`.
- Fitting right after an expansion must use `result.graph.nodeList`; `graphRef`
  has not caught up yet, so it fitted the pre-expansion graph and zoomed IN.
- `'Mentioned by'` and `'mentioned by'` collide after `sanitizeTranKey`, and the
  km dictionary throws AT LOAD on a duplicate. See [[tran-missing-key-throws-in-dev]].

### Persistence

`graphPresetHelpers.ts` stores **record ids and positions, never record
content**, so a saved graph survives a dataset update or a lookup-language
change and can never pin the 34MB dataset through a settings string. The
"last session" slot is restored **when the record is next opened**, not at
launch — restoring at startup would force the lookup dataset to load in every
window on every launch.

Related: [[lookup-language-selection]], [[console-design-system-tokens]],
[[blob-download-pops-save-dialog]], [[bible-view-controller-live-arrays]].
