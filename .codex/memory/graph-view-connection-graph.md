---
name: graph-view-connection-graph
description: "The connection graph is a PURE non-React core in src/graph-view/core plus a thin React layer; a second dataset is one GraphSourceType, and the ring geometry has clearances that must not be tweaked casually"
metadata: 
  node_type: memory
  type: project
  originSessionId: ed0cad4d-8194-4a7e-9067-7311378aa74e
  modified: 2026-09-18T00:12:41.662Z
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
- **Edges are STORED centre to centre and DRAWN border to border.**
  `getEdgeCurve` clips the cubic to both `getNodeRect`s (coarse scan +
  bisection, `EDGE_BOX_GAP` 9) by De Casteljau, so the clipped line is a piece
  of exactly the curve the full one drew — recomputing handles from the trimmed
  ends re-bends the line every time a box changes size. Two traps this exists
  to fix, both invisible until you look for them: a `marker-end` arrowhead
  lands on the target box's CENTRE, underneath the box; and a `<marker>` lives
  in `<defs>` at the SVG root, so `.graph-view__edge-group marker path` matched
  NOTHING and every arrowhead was default black on a dark canvas. The arrow is
  now an ordinary `<path>` (`EDGE_ARROW_PATH_D`) placed by `getEdgeDrawing`,
  which returns the `d` and the arrow transform together — asking for them
  separately ran the trim scan twice per directed edge, per render and per drag
  frame. Its fill and the line's stroke both read one `--graph-edge-color` set
  per relation group, so they cannot drift apart again.
- **A collapsed box is NOT centred on its node point.** It keeps the full box's
  top and stops at `NODE_COLLAPSED_HEIGHT`, so drawing to `node.x/y` sails past
  it and parks an arrowhead in empty space below. `getNodeAnchor` gives the
  point to DRAW to; layout still works in stored coordinates. That constant is
  now pinned by the stylesheet the way `NODE_HEIGHT` is — it was dead (and 4px
  wrong) until the border trim started reading it.
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

### Copying it out as text (2026-09-17)

`graphTextExportHelpers.ts` is a SECOND pure serializer beside
`buildGraphSvg`, feeding the `📋` button's **Copy as Markdown** and
**Copy as Mermaid Diagram**. It takes the same `GraphExportNodeType` list
`readExportModel` builds for the picture, so a copy can never disagree with
what is on the canvas, and it imports nothing from the app (both imports are
types).

- **The Markdown CARRIES the diagram**, in a `mermaid` fence under a
  `## Diagram` heading, ahead of the tables (the user asked for this the moment
  the first cut shipped without it). Everywhere markdown is rendered — the
  app's own preview, a wiki, a repository — that block draws the same boxes the
  canvas has, so the tables read as the detail behind a picture rather than as
  a substitute for one. The fence GROWS past any run of backticks inside the
  diagram, and a graph with no records writes no diagram rather than fencing an
  empty `flowchart`, which fails to parse. **Copy as Mermaid Diagram** is kept
  for the narrower job: the drawing alone, for a tool that wants only that.
- **FIVE diagram languages, declared once** in `GRAPH_DIAGRAM_FORMAT_LIST`
  (the user asked for the variety: which language is right depends on what it
  is pasted into). Mermaid flowchart across and down, Mermaid mindmap,
  Graphviz DOT, PlantUML — the menu rows, the toast title and
  `buildGraphDiagram` all read that list, so a sixth is one row plus one
  branch. Two things the live run taught: **a context menu here is 210px and
  CLIPS**, which drew `Copy as Mermaid Flowchart (left to right)` and
  `… (top down)` as two identical `Copy as Mermaid Flowchar…` rows — every
  row is named short now, with the full name on `ContextMenuItemType.title`
  and on the toast; and only Mermaid can be PROVEN here, since the app's
  markdown preview renders mermaid and nothing on the machine renders DOT or
  PlantUML.
- **A mindmap needs a TREE**, so `toChildKeyListByKey` walks one breadth-first
  and UNDIRECTED from the centre (the arrows say what a relation means, not
  how it was explored; a tree built along them alone loses a family whenever
  the centre is someone's child), keeps the first line that reaches each
  record, and parks anything unreachable on the centre. It carries no relation
  words on purpose: the format has nowhere to put them, and a tree crosses half
  the edges backwards — an edge is labelled from the end it POINTS AT, so
  `son` would end up captioning a father.
- **Mermaid is a `flowchart LR` by default, and the direction was MEASURED.** `flowchart`
  is the only kind that carries this graph whole (arrows on directed relations,
  plain lines on the rest, a label per line, arbitrary cross-links; a `mindmap`
  cannot link two branches, which is most of a family). `TD` looks right for a
  family tree and is wrong here: a graph in this panel is a fan, and 29 boxes
  came out as ONE row 28 wide, squeezed to the page width, nothing legible.
  `LR` makes the fan a column. A document is read down a page.
- **The verse list is capped at 12 a record.** Uncapped, David's 29-box graph
  copied as 19KB with 15KB of it references — Solomon cites 174. The box on
  screen shows a count and keeps the list behind its Verses button.
- Structural furniture (`## Records`, `flowchart`, `_(centre)_`) is English;
  everything out of the dataset goes through the injected `translate`, the
  LOOKUP language's dictionary. A relation HEADING reads from the end the edge
  points at, so a stored parent -> child edge is **Children**, not the
  **Parents** definition that declares the same canonical kind.
- Mermaid reads labels as markup: `&` is escaped BEFORE `#`, or `&#35;` is
  escaped in turn and shows as text. A `classDef` colour is read off the live
  stylesheet, so one holding a comma or a quote is dropped rather than breaking
  the parse.
- The copy itself cannot touch `clipboard` from the renderer — see
  [[renderer-has-no-clipboard-module]], which is what the live verification of
  this feature turned up.
- **The three Mermaid shapes also OPEN, in `mermaid.live`** (2026-09-17,
  `src/helper/mermaidLiveHelpers.ts`, the user's own ask with the rows circled).
  Copying a diagram is half of what a diagram is for and nothing on an ordinary
  machine DRAWS one but this app's markdown preview. A row at the foot of the
  📋 menu opens a SECOND menu with the three shapes by name — not three more
  rows, because `Open in Mermaid Live (across)` clips at 210px the way the
  flowchart pair did — and `MERMAID_LIVE_FORMAT_LIST` is derived from
  `fenceLanguage === 'mermaid'` rather than flagged, so DOT and PlantUML can
  never reach an editor that draws neither. The link is the editor's own
  `serializeState` written out and must match it byte for byte: the state as
  JSON (`code`, the `mermaid` CONFIG as a nested JSON string, `updateDiagram`,
  `rough` — the only four its `State` requires), UTF-8, zlib `deflate`,
  URL-safe base64 unpadded, behind `pako:` in the FRAGMENT of
  `https://mermaid.live/edit`. Three things that are not obvious:
  **the fragment never reaches a server**, which is the whole reason this is
  safe for a church's own records and is what the editor means by "the
  diagrams never leave your browser"; **`base64:` is a documented second tag**
  (the same state, uncompressed) and is what a platform without
  `CompressionStream` gets, a half of the format rather than a guess; and
  **`shell.openExternal` drops a long URL in SILENCE while still resolving** —
  measured against this project's own Electron, 2 500 and 8 000 characters
  arrived whole and 30 000 never arrived, so past 8 000 the link goes to the
  clipboard with a sentence instead (an ordinary 29-box graph writes 1 290).
  The compressor is driven through its own writer and reader, never a `Blob`
  or a `Response`, because a test environment holds its own copies of those.

### Persistence

`graphPresetHelpers.ts` stores **record ids and positions, never record
content**, so a saved graph survives a dataset update or a lookup-language
change and can never pin the 34MB dataset through a settings string. The
"last session" slot is restored **when the record is next opened**, not at
launch — restoring at startup would force the lookup dataset to load in every
window on every launch.

Related: [[lookup-language-selection]], [[console-design-system-tokens]],
[[blob-download-pops-save-dialog]], [[bible-view-controller-live-arrays]].
