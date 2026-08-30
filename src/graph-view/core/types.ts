/**
 * Connection graph core — types.
 *
 * PURE. Everything under `core/` is framework-agnostic and app-agnostic: no
 * React, no imports from anywhere else in `src/`, no DOM. It is written to be
 * lifted out into a standalone graph-preview package later, so the boundary is
 * a real one — an import of `react` or of an app module in this directory is a
 * bug, not a shortcut.
 *
 * Nothing here knows what a "name" or a "location" is either. Node kinds and
 * relation kinds are strings that a `GraphSourceType` defines, so a second
 * dataset (bible cross references) becomes one source file rather than a fork
 * of the canvas.
 */

/** A node kind, e.g. `name` / `location` / `verse`. Defined by the source. */
export type GraphNodeKindType = string;

/** A relation kind, e.g. `parent` / `spouse` / `cross-ref`. Source-defined. */
export type GraphRelationKindType = string;

/** Enough to identify and provisionally label a record. */
export type GraphNodeRefType = {
    kind: GraphNodeKindType;
    recordId: string;
    name: string;
};

export function toGraphNodeKey(kind: GraphNodeKindType, recordId: string) {
    return `${kind}:${recordId}`;
}

export type GraphNodeType = {
    // `kind:recordId` — unique within one graph.
    key: string;
    kind: GraphNodeKindType;
    recordId: string;
    // Provisional label, so a box can render before its record resolves. The
    // record's own name wins once it does.
    name: string;
    // Graph units (unzoomed CSS px), the CENTRE of the box.
    x: number;
    y: number;
    // The user dragged it, or it belongs to a path. Layout never moves it.
    isPinned: boolean;
    isCollapsed: boolean;
    // The node this one was placed around; null for the root. Lets a later
    // expansion aim AWAY from where this node was reached from.
    originKey: string | null;
    // "Open all Related" has already run here.
    isExpanded: boolean;
};

export type GraphEdgeType = {
    key: string;
    // The direction the edge was DISCOVERED in; its label reads from here.
    fromKey: string;
    toKey: string;
    relation: GraphRelationKindType;
};

/** One open graph. */
export type GraphViewType = {
    // `sourceId:rootKind:rootId` — one graph per root record per source.
    key: string;
    sourceId: string;
    rootKey: string;
    // Provisional title until the root record resolves.
    title: string;
    nodeList: GraphNodeType[];
    edgeList: GraphEdgeType[];
    panX: number;
    panY: number;
    // An INTEGER percent, 25..300. NOT a fraction: the app's shared zoom hook
    // rounds whatever it is handed on a pinch, which would flatten a 0.25..3
    // fraction to 0/1/2/3 the first time anyone used a trackpad.
    zoomPercent: number;
    // Relation kinds switched off. Hidden relations keep their nodes'
    // positions, so re-enabling one is instant.
    hiddenRelationList: GraphRelationKindType[];
    // Ordered; `[]` when no path is shown. The ORDER is the path, which is why
    // this is an array rather than a flag on every node.
    pathNodeKeyList: string[];
    pathFromId: string | null;
    pathToId: string | null;
    isPathBarOpen: boolean;
    // Bumped when an already-open graph is opened again, so a host can pull it
    // forward.
    raiseCount: number;
};

/**
 * What a source declares about one relation kind.
 *
 * `family` is what edge identity is keyed by, so two relations that are the
 * same LINE seen from opposite ends collapse into one edge: expanding Jacob
 * (who lists Joseph under `children`) and then Joseph (who lists Jacob under
 * `parents`) must leave one edge, not two stacked on each other.
 *
 * It deliberately does not collapse everything. Abraham and Sarah are both
 * half-siblings and spouses in the lookup dataset, and those are two different
 * facts that each deserve their own line.
 */
export type GraphRelationDefType = {
    kind: GraphRelationKindType;
    // The relation this one is STORED as. Two relations sharing a canonical
    // kind are the same line seen from opposite ends and collapse to one edge:
    // `parent` and `child` both store as `child`, so expanding Jacob (who
    // lists Joseph under `children`) and then Joseph (who lists Jacob under
    // `parents`) leaves one edge rather than two stacked on each other.
    //
    // It deliberately does not collapse everything. Abraham and Sarah are both
    // half-siblings and spouses in the lookup dataset, and those are two
    // different facts that each deserve a line, so `sibling` and `spouse` keep
    // distinct canonical kinds.
    canonicalKind: GraphRelationKindType;
    // Which end of the stored edge the EXPANDED node sits at. `parent` means
    // the neighbour is the parent, so the canonical parent -> child edge runs
    // from the target back to the origin.
    canonicalFrom: 'origin' | 'target';
    // The two ends mean different things, so the edge gets an arrowhead. With
    // the direction normalized, ONE midpoint label (`son`, `daughter`) is
    // unambiguous without the reader having to decode that arrow.
    isDirected: boolean;
    // Plural label for the filter chip and the legend, as a raw English key.
    label: string;
    // Suffix of the CSS class that styles this relation's edges.
    styleKey: string;
};

/** Everything a node box needs to render, resolved from the live dataset. */
export type GraphNodeViewType = {
    name: string;
    // A translated record's English name, shown beside it. `''` when there is
    // nothing to add.
    kjvName: string;
    // One-line description, already stripped of inline reference markup.
    title: string;
    // Small muted line under the title, e.g. the record's type.
    caption: string;
    iconClass: string;
    // Drives the box's border colour. Source-defined.
    typeKey: string;
    // Short verse references this record cites.
    verseList: string[];
    // Whatever the source needs to label an edge POINTING AT this node — for
    // the lookup source, the record's gender.
    labelHint: string;
};

export type GraphNeighbourType = GraphNodeRefType & {
    relation: GraphRelationKindType;
};

/**
 * One step along a found path.
 *
 * `isReversed` says the canonical edge runs against the walking direction — a
 * hop that climbs to a parent still stores the parent -> child edge, so the
 * midpoint label genders the child and reads `son` rather than labelling the
 * father with it.
 */
export type GraphPathHopType = {
    relation: GraphRelationKindType;
    isReversed: boolean;
};

/**
 * The contract a dataset implements to be drawable as a graph.
 *
 * `TContext` is whatever the source needs in order to read its data — for the
 * lookup source, the pair of reference-counted lookup managers. It is passed
 * in rather than acquired here, so the core never learns how any dataset loads
 * and never holds one alive.
 */
export type GraphSourceType<TContext> = {
    id: string;
    relationDefList: readonly GraphRelationDefType[];
    getNodeView: (
        context: TContext,
        node: Readonly<GraphNodeRefType>,
    ) => GraphNodeViewType | null;
    // Flat, each entry carrying its own relation, ordered by
    // `relationDefList`.
    getNeighbours: (
        context: TContext,
        node: Readonly<GraphNodeRefType>,
    ) => GraphNeighbourType[];
    countNeighbours: (
        context: TContext,
        node: Readonly<GraphNodeRefType>,
    ) => number;
    // The label an edge carries, as a raw English key; `''` for none.
    getRelationLabel: (
        relation: GraphRelationKindType,
        targetView: GraphNodeViewType | null,
    ) => string;
    // Optional two-record path finding. A source omitting these renders no
    // path bar at all.
    searchNodes?: (
        context: TContext,
        query: string,
        limit: number,
    ) => GraphNodeRefType[];
    findPath?: (
        context: TContext,
        fromId: string,
        toId: string,
    ) => GraphNodeRefType[] | null;
    // How each hop of a found path connects, so the chain labels itself with
    // the same vocabulary an ordinary expansion uses. Derived after the search
    // rather than carried through it: storing a relation per adjacency entry
    // would double the weight of a structure built for one query and thrown
    // away.
    getPathHopList?: (
        context: TContext,
        refList: readonly GraphNodeRefType[],
    ) => GraphPathHopType[];
    /**
     * A display label for one raw entry of `GraphNodeViewType.verseList`.
     *
     * Optional: a source whose verse strings are already readable omits it and
     * the raw string is shown. Asynchronous because a reference is named by a
     * BIBLE, which is loaded on demand — turning `GEN 30:42` into
     * `លោកុប្បត្តិ ៣០:៤២` is a read, not a lookup in a table the graph
     * could hold. Resolved only when a verse list is actually opened.
     */
    resolveVerseTitle?: (
        context: TContext,
        verse: string,
    ) => Promise<string | null>;
    // Why this root cannot start a path, as a raw English key; `''` when it
    // can. Lets the lookup source explain that a location is not a valid
    // endpoint without the core knowing what a location is.
    getPathBlockedReason?: (root: Readonly<GraphNodeRefType>) => string;
};

/**
 * The most boxes one graph may hold.
 *
 * 120 memoized boxes plus their edges is about what a low-spec machine repaints
 * smoothly, and well past that the picture stops being readable anyway.
 * Reaching the cap stops adding and says so, rather than degrading silently.
 */
export const GRAPH_NODE_LIMIT = 120;

/**
 * Above this many neighbours, "Open all Related" asks first. Jacob alone has
 * 44 of them, 22 being cousins — a genuine "did you mean that?" moment.
 */
export const GRAPH_LARGE_FANOUT = 24;
