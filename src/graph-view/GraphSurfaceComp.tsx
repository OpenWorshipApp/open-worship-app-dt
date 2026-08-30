import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
} from 'react';

import { isBlankDragArea } from '../app-modal/floatingWidgetHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { mapInYieldingBatches } from '../helper/helpers';
import { tran } from '../lang/langHelpers';
import { openDetailPanel } from '../location-name-lookup/detailPanelHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type {
    GraphBoundsType,
    GraphNeighbourType,
    GraphNodeViewType,
    GraphPointType,
    GraphRectType,
    GraphSourceType,
    GraphViewType,
} from './core';
import {
    GRAPH_GEOMETRY,
    GRAPH_LARGE_FANOUT,
    GRAPH_ZOOM_RANGE,
    centreGraphInViewport,
    fitGraphToViewport,
    getEdgeBowIndexMap,
    getEdgeDrawing,
    getEdgeLabelPoint,
    getNodeAnchor,
    getNodeRect,
    getPathEdgeKeySet,
    getVisibleGraph,
    getWheelZoomPercent,
    getWorldBounds,
    toGraphDelta,
    zoomAtPoint,
} from './core';
import GraphEdgeLayerComp from './GraphEdgeLayerComp';
import GraphNodeBoxComp from './GraphNodeBoxComp';
import type { GraphNodeCallbacksType } from './GraphNodeBoxComp';
import GraphDockComp from './GraphDockComp';
import GraphToolbarComp from './GraphToolbarComp';
import {
    buildGraphSvg,
    PRINT_PALETTE,
    printGraph,
    saveGraphImage,
} from './graphExportHelpers';
import { getGraphEngine } from './graphViewStore';

type GraphPointListType = readonly { x: number; y: number }[];

// Below this the labels are a few pixels tall and read as noise, and dropping
// them from paint is the biggest single win when surveying a large graph.
const LABEL_HIDE_ZOOM_PERCENT = 60;
// A very long verse list would make an unusable menu; Jerusalem alone cites
// over seven hundred.
const VERSE_MENU_LIMIT = 30;

type DragStateType = {
    mode: 'node' | 'pan';
    pointerId: number;
    nodeKey: string | null;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
};

type DragEdgeEntryType = {
    isFrom: boolean;
    // The fixed end's DRAWN point, which is the box's centre rather than the
    // node's own when that box is collapsed.
    otherAnchor: GraphPointType;
    // The fixed end's box, for the border trim. Its shape cannot change
    // mid-gesture, so it is built once with the rest of the cache.
    otherRect: GraphRectType;
    bow: number;
    path: SVGPathElement;
    label: SVGTextElement | null;
    // Only a DIRECTED edge draws one, so this is null for most of them.
    arrow: SVGPathElement | null;
};

type DragCacheType = {
    // Identity guard: a store commit mid-drag re-renders the canvas, so the
    // cached elements would be dead — a mismatch here rebuilds instead.
    graph: GraphViewType;
    nodeKey: string;
    isNodeCollapsed: boolean;
    element: HTMLElement | null;
    bounds: GraphBoundsType;
    entryList: DragEdgeEntryType[];
};

/**
 * Everything a node-drag frame needs, resolved ONCE per gesture instead of per
 * rAF: the box element, the incident edges' DOM nodes, the fixed endpoints'
 * positions, the bows and the world bounds are identical for every frame of
 * one drag, and re-deriving them each frame made the hot path
 * O(edges x nodes) with a DOM query per incident edge on top.
 */
function buildDragCache(
    world: HTMLElement,
    graph: GraphViewType,
    nodeKey: string,
): DragCacheType {
    const nodeByKey = new Map(
        graph.nodeList.map((node) => {
            return [node.key, node];
        }),
    );
    const bowByKey = getEdgeBowIndexMap(graph.edgeList);
    const entryList: DragEdgeEntryType[] = [];
    for (const edge of graph.edgeList) {
        if (edge.fromKey !== nodeKey && edge.toKey !== nodeKey) {
            continue;
        }
        const path = world.querySelector<SVGPathElement>(
            `[data-edge-key="${CSS.escape(edge.key)}"]`,
        );
        const other = nodeByKey.get(
            edge.fromKey === nodeKey ? edge.toKey : edge.fromKey,
        );
        if (path === null || other === undefined) {
            continue;
        }
        entryList.push({
            isFrom: edge.fromKey === nodeKey,
            otherAnchor: getNodeAnchor(other, other.isCollapsed),
            otherRect: getNodeRect(other, other.isCollapsed),
            bow: bowByKey.get(edge.key) ?? 0,
            path,
            label: world.querySelector<SVGTextElement>(
                `[data-edge-label-for="${CSS.escape(edge.key)}"]`,
            ),
            arrow: world.querySelector<SVGPathElement>(
                `[data-edge-arrow-for="${CSS.escape(edge.key)}"]`,
            ),
        });
    }
    return {
        graph,
        nodeKey,
        isNodeCollapsed: nodeByKey.get(nodeKey)?.isCollapsed ?? false,
        element: world.querySelector<HTMLElement>(
            `[data-node-key="${CSS.escape(nodeKey)}"]`,
        ),
        bounds: getWorldBounds(graph.nodeList),
        entryList,
    };
}

/**
 * The interactive graph surface: pan, zoom, node drag, expansion and the
 * toolbar above it.
 *
 * Generic over the data source, so a second dataset needs a `GraphSourceType`
 * and nothing here.
 */
export default function GraphSurfaceComp<TContext>({
    graph,
    source,
    context,
    fontFamily,
    verseFontFamily,
    translate,
}: Readonly<{
    graph: GraphViewType;
    source: GraphSourceType<TContext>;
    context: TContext;
    fontFamily: string | undefined;
    // A verse reference is named by a BIBLE rather than by the record
    // language, so the verse menu takes its own font. `verseList` is already
    // part of the source contract; this is the font that goes with it.
    verseFontFamily?: string;
    // Record-facing wording goes through the source dataset's language, which
    // is not the interface locale — and unlike `tran` it must not throw on a
    // key some dataset language happens to be missing.
    translate: (key: string) => string;
}>) {
    const engine = getGraphEngine();
    const viewportRef = useRef<HTMLDivElement>(null);
    const worldRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragStateType | null>(null);
    const dragCacheRef = useRef<DragCacheType | null>(null);
    const frameRef = useRef<number | null>(null);
    const [busyNodeKey, setBusyNodeKey] = useState<string | null>(null);
    const graphRef = useAppCurrentRef(graph);
    const contextRef = useAppCurrentRef(context);
    const sourceRef = useAppCurrentRef(source);
    const verseFontFamilyRef = useAppCurrentRef(verseFontFamily);
    const { nodeList, edgeList } = useMemo(() => {
        return getVisibleGraph(graph);
        // The STRUCTURAL fields, not the graph object: a pan or zoom commit
        // replaces the graph, and recomputing visibility then would hand every
        // box and edge a fresh identity — re-rendering the whole canvas per
        // wheel tick whenever a relation filter is active.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        graph.nodeList,
        graph.edgeList,
        graph.hiddenRelationList,
        graph.rootKey,
        graph.pathNodeKeyList,
    ]);

    /**
     * Node views, resolved once per render pass rather than per box.
     *
     * These are Map lookups into the already-loaded dataset, and the result
     * holds only the small view objects — never the records themselves, which
     * belong to the reference-counted managers.
     *
     * The FULL node list rather than the visible one, so the edge-label
     * resolver below can read a view for any endpoint instead of paying a
     * per-edge record lookup of its own.
     */
    const viewByKey = useMemo(() => {
        const result = new Map<string, GraphNodeViewType | null>();
        for (const node of graph.nodeList) {
            result.set(node.key, source.getNodeView(context, node));
        }
        return result;
    }, [graph.nodeList, source, context]);
    const viewByKeyRef = useAppCurrentRef(viewByKey);

    /**
     * Neighbour counts for the expand badges.
     *
     * Cached per node because counting a LOCATION means scanning every name
     * record — doing that per render, per box, would make the panel crawl. The
     * cache is dropped whenever the dataset identity changes (a lookup-language
     * switch), so it can never outlive the data it describes.
     */
    const countCacheRef = useRef(new Map<string, number>());
    useEffect(() => {
        countCacheRef.current = new Map();
    }, [context, source]);
    const countByKey = useMemo(() => {
        const cache = countCacheRef.current;
        const result = new Map<string, number>();
        for (const node of nodeList) {
            const cached = cache.get(node.key);
            if (cached !== undefined) {
                result.set(node.key, cached);
                continue;
            }
            const count = source.countNeighbours(context, node);
            cache.set(node.key, count);
            result.set(node.key, count);
        }
        return result;
    }, [nodeList, source, context]);

    const bounds = useMemo(() => {
        return getWorldBounds(nodeList);
    }, [nodeList]);
    const pathEdgeKeySet = useMemo(() => {
        return getPathEdgeKeySet(graph);
        // Structural fields only, same as `getVisibleGraph` above: a new Set
        // per viewport commit broke the edge layer's memo and re-rendered
        // every edge on every wheel tick.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graph.edgeList, graph.pathNodeKeyList]);
    const pathNodeKeySet = useMemo(() => {
        return new Set(graph.pathNodeKeyList);
    }, [graph.pathNodeKeyList]);

    const scale = graph.zoomPercent / 100;

    // --- gestures -------------------------------------------------------

    const applyFrame = useCallback(() => {
        frameRef.current = null;
        const drag = dragRef.current;
        const world = worldRef.current;
        if (drag === null || world === null) {
            return;
        }
        if (drag.mode === 'pan') {
            world.style.transform = `translate3d(${drag.startX}px, ${drag.startY}px, 0)`;
            // The dot grid rides along, or the background would sit still and
            // the pan would look like the boxes sliding over a fixed pattern.
            if (canvasRef.current !== null) {
                canvasRef.current.style.backgroundPosition = `${drag.startX}px ${drag.startY}px`;
            }
            return;
        }
        if (drag.nodeKey === null) {
            return;
        }
        const currentGraph = graphRef.current;
        let cache = dragCacheRef.current;
        if (
            cache === null ||
            cache.graph !== currentGraph ||
            cache.nodeKey !== drag.nodeKey
        ) {
            cache = buildDragCache(world, currentGraph, drag.nodeKey);
            dragCacheRef.current = cache;
        }
        // Written straight to the DOM: committing to the store per pointer
        // frame would re-render every box sixty times a second.
        if (cache.element !== null) {
            cache.element.style.left = `${drag.startX - GRAPH_GEOMETRY.NODE_WIDTH / 2}px`;
            cache.element.style.top = `${drag.startY - GRAPH_GEOMETRY.NODE_HEIGHT / 2}px`;
        }
        const movedCentre = {
            x: drag.startX - cache.bounds.left,
            y: drag.startY - cache.bounds.top,
        };
        const moved = getNodeAnchor(movedCentre, cache.isNodeCollapsed);
        const movedRect = getNodeRect(movedCentre, cache.isNodeCollapsed);
        const otherOffset = {
            x: -cache.bounds.left,
            y: -cache.bounds.top,
        };
        for (const entry of cache.entryList) {
            const fixed = {
                x: entry.otherAnchor.x + otherOffset.x,
                y: entry.otherAnchor.y + otherOffset.y,
            };
            const fixedRect = {
                left: entry.otherRect.left + otherOffset.x,
                right: entry.otherRect.right + otherOffset.x,
                top: entry.otherRect.top + otherOffset.y,
                bottom: entry.otherRect.bottom + otherOffset.y,
            };
            const start = entry.isFrom ? moved : fixed;
            const end = entry.isFrom ? fixed : moved;
            const startRect = entry.isFrom ? movedRect : fixedRect;
            const endRect = entry.isFrom ? fixedRect : movedRect;
            // The SAME curve, bow AND border trim the renderer draws, or the
            // edge would snap to a different line the moment a drag started.
            const drawing = getEdgeDrawing(
                start,
                end,
                entry.bow,
                startRect,
                endRect,
            );
            entry.path.setAttribute('d', drawing.d);
            if (entry.label !== null) {
                const point = getEdgeLabelPoint(start, end, entry.bow);
                entry.label.setAttribute('x', `${point.x}`);
                entry.label.setAttribute('y', `${point.y}`);
            }
            if (entry.arrow !== null) {
                entry.arrow.setAttribute('transform', drawing.arrowTransform);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const requestFrame = useCallback(() => {
        if (frameRef.current !== null) {
            return;
        }
        frameRef.current = globalThis.requestAnimationFrame(applyFrame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleNodePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>, nodeKey: string) => {
            const target = event.target;
            // Presses that land on a control are that control's, not a drag.
            if (
                event.button !== 0 ||
                !(target instanceof Element) ||
                !isBlankDragArea(target)
            ) {
                return;
            }
            const node = graphRef.current.nodeList.find((item) => {
                return item.key === nodeKey;
            });
            if (node === undefined) {
                return;
            }
            // Focus follows the press so the undo keys land on THIS panel.
            viewportRef.current?.focus({ preventScroll: true });
            dragCacheRef.current = null;
            dragRef.current = {
                mode: 'node',
                pointerId: event.pointerId,
                nodeKey,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: node.x,
                startY: node.y,
            };
            try {
                viewportRef.current?.setPointerCapture(event.pointerId);
            } catch {
                // A synthetic or already-cancelled pointer id throws here; the
                // gesture still tracks through the handlers below, and an
                // uncaught throw would escalate to the app reload dialog.
            }
            event.preventDefault();
            event.stopPropagation();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handleViewportPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const target = event.target;
            // Middle button pans from anywhere, including over a box.
            const isPanButton =
                event.button === 1 ||
                (event.button === 0 &&
                    target instanceof Element &&
                    target.closest('.graph-view__node') === null &&
                    target.closest('.graph-view__dock') === null);
            viewportRef.current?.focus({ preventScroll: true });
            if (!isPanButton) {
                return;
            }
            dragRef.current = {
                mode: 'pan',
                pointerId: event.pointerId,
                nodeKey: null,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: graphRef.current.panX,
                startY: graphRef.current.panY,
            };
            try {
                viewportRef.current?.setPointerCapture(event.pointerId);
            } catch {
                // See above.
            }
            event.preventDefault();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (drag === null || drag.pointerId !== event.pointerId) {
                return;
            }
            const delta = toGraphDelta(
                {
                    x: event.clientX - drag.startClientX,
                    y: event.clientY - drag.startClientY,
                },
                graphRef.current.zoomPercent,
            );
            const node =
                drag.nodeKey === null
                    ? null
                    : graphRef.current.nodeList.find((item) => {
                          return item.key === drag.nodeKey;
                      });
            if (drag.mode === 'node' && node !== undefined && node !== null) {
                drag.startX = node.x + delta.x;
                drag.startY = node.y + delta.y;
            } else if (drag.mode === 'pan') {
                drag.startX = graphRef.current.panX + delta.x;
                drag.startY = graphRef.current.panY + delta.y;
            }
            requestFrame();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const finishDrag = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (drag === null || drag.pointerId !== event.pointerId) {
                return;
            }
            dragRef.current = null;
            dragCacheRef.current = null;
            if (frameRef.current !== null) {
                globalThis.cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
            if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
                viewportRef.current.releasePointerCapture(event.pointerId);
            }
            const currentGraph = graphRef.current;
            const isMoved =
                Math.abs(event.clientX - drag.startClientX) > 1 ||
                Math.abs(event.clientY - drag.startClientY) > 1;
            if (!isMoved) {
                return;
            }
            // One commit at the end of the gesture, so exactly one re-render.
            if (drag.mode === 'node' && drag.nodeKey !== null) {
                engine.moveNode(
                    currentGraph.key,
                    drag.nodeKey,
                    drag.startX,
                    drag.startY,
                );
                return;
            }
            engine.setViewport(currentGraph.key, {
                panX: drag.startX,
                panY: drag.startY,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    useEffect(() => {
        return () => {
            if (frameRef.current !== null) {
                globalThis.cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    /**
     * Wheel and pinch zoom, anchored on the pointer.
     *
     * Hand-rolled rather than the app's shared `useZoomingRegistering` because
     * a graph canvas wants three things that hook does not do: a PLAIN wheel
     * zooms (there is nothing here to scroll, so requiring Ctrl just made the
     * wheel feel dead), the zoom is anchored on the cursor instead of the
     * viewport centre, and the step is multiplicative so it feels the same at
     * 30% as at 200%.
     *
     * Registered non-passively so `preventDefault` actually stops the page
     * scrolling underneath.
     */
    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport === null) {
            return;
        }
        const getAnchor = (clientX: number, clientY: number) => {
            const rect = viewport.getBoundingClientRect();
            return { x: clientX - rect.left, y: clientY - rect.top };
        };
        // Wheel ticks are coalesced to ONE store commit per animation frame: a
        // trackpad fires several events per frame, and every commit re-renders
        // the surface and re-lays-out the whole CSS-zoomed canvas. The
        // exponential step composes over the summed delta, so the zoom lands
        // where per-tick commits would have put it.
        let pendingWheel: {
            deltaY: number;
            clientX: number;
            clientY: number;
        } | null = null;
        let wheelFrame: number | null = null;
        const applyWheel = () => {
            wheelFrame = null;
            const pending = pendingWheel;
            pendingWheel = null;
            if (pending === null) {
                return;
            }
            const currentGraph = graphRef.current;
            getGraphEngine().setViewport(
                currentGraph.key,
                zoomAtPoint(
                    currentGraph,
                    getWheelZoomPercent(
                        currentGraph.zoomPercent,
                        pending.deltaY,
                    ),
                    getAnchor(pending.clientX, pending.clientY),
                ),
            );
        };
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            pendingWheel = {
                deltaY: (pendingWheel?.deltaY ?? 0) + event.deltaY,
                clientX: event.clientX,
                clientY: event.clientY,
            };
            if (wheelFrame === null) {
                wheelFrame = globalThis.requestAnimationFrame(applyWheel);
            }
        };
        let pinchDistance = 0;
        const getDistance = (touchList: TouchList) => {
            return Math.hypot(
                touchList[0].clientX - touchList[1].clientX,
                touchList[0].clientY - touchList[1].clientY,
            );
        };
        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length === 2) {
                pinchDistance = getDistance(event.touches);
            }
        };
        const handleTouchMove = (event: TouchEvent) => {
            if (event.touches.length !== 2 || pinchDistance === 0) {
                return;
            }
            event.preventDefault();
            const nextDistance = getDistance(event.touches);
            const currentGraph = graphRef.current;
            const anchor = getAnchor(
                (event.touches[0].clientX + event.touches[1].clientX) / 2,
                (event.touches[0].clientY + event.touches[1].clientY) / 2,
            );
            getGraphEngine().setViewport(
                currentGraph.key,
                zoomAtPoint(
                    currentGraph,
                    currentGraph.zoomPercent * (nextDistance / pinchDistance),
                    anchor,
                ),
            );
            pinchDistance = nextDistance;
        };
        const handleTouchEnd = () => {
            pinchDistance = 0;
        };
        viewport.addEventListener('wheel', handleWheel, { passive: false });
        viewport.addEventListener('touchstart', handleTouchStart, {
            passive: false,
        });
        viewport.addEventListener('touchmove', handleTouchMove, {
            passive: false,
        });
        viewport.addEventListener('touchend', handleTouchEnd);
        viewport.addEventListener('touchcancel', handleTouchEnd);
        return () => {
            if (wheelFrame !== null) {
                globalThis.cancelAnimationFrame(wheelFrame);
            }
            viewport.removeEventListener('wheel', handleWheel);
            viewport.removeEventListener('touchstart', handleTouchStart);
            viewport.removeEventListener('touchmove', handleTouchMove);
            viewport.removeEventListener('touchend', handleTouchEnd);
            viewport.removeEventListener('touchcancel', handleTouchEnd);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A graph starts with its root at the origin, which would otherwise render
    // in the viewport's top-left corner with most of the box clipped off. Only
    // on first mount, and only while the user has not panned themselves.
    const hasCentredRef = useRef(false);
    useEffect(() => {
        const viewport = viewportRef.current;
        const currentGraph = graphRef.current;
        if (
            hasCentredRef.current ||
            viewport === null ||
            viewport.clientWidth === 0 ||
            currentGraph.nodeList.length === 0 ||
            currentGraph.panX !== 0 ||
            currentGraph.panY !== 0
        ) {
            return;
        }
        hasCentredRef.current = true;
        getGraphEngine().setViewport(
            currentGraph.key,
            centreGraphInViewport({
                nodeList: currentGraph.nodeList,
                viewportWidth: viewport.clientWidth,
                viewportHeight: viewport.clientHeight,
                zoomPercent: currentGraph.zoomPercent,
            }),
            // The app placing the graph, not the user moving it: an undo
            // straight after opening must not put the root back in the corner.
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graph.key]);

    // --- actions --------------------------------------------------------

    /**
     * `nodeList` is passed in by callers that have just changed the graph:
     * `graphRef` only catches up on the next render, so fitting straight after
     * an expansion would measure the graph as it was BEFORE the boxes arrived
     * and zoom in on the single node it still saw.
     */
    const handleFitToView = useCallback(
        (nodeList?: GraphPointListType, isUserMove = true) => {
            const viewport = viewportRef.current;
            const currentGraph = graphRef.current;
            // The VISIBLE nodes, not every node: fitting to boxes a relation
            // filter has hidden would leave the graph zoomed out around empty
            // space the user cannot see.
            // `Array.isArray` rather than a null check: this is a public-ish
            // callback, and passing it straight to an `onClick` would hand it a
            // MouseEvent, which is not iterable and took the whole app down with
            // "Reload is needed".
            const fitNodeList = Array.isArray(nodeList)
                ? nodeList
                : getVisibleGraph(currentGraph).nodeList;
            if (viewport === null || fitNodeList.length === 0) {
                return;
            }
            const next = fitGraphToViewport({
                nodeList: fitNodeList,
                viewportWidth: viewport.clientWidth,
                viewportHeight: viewport.clientHeight,
                minZoomPercent: GRAPH_ZOOM_RANGE.min,
                maxZoomPercent: GRAPH_ZOOM_RANGE.max,
            });
            getGraphEngine().setViewport(currentGraph.key, next, isUserMove);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    /**
     * Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, on the panel rather than on the window.
     *
     * Several graphs can be open at once, so the keys have to reach the one
     * the user is working in — which is what focus already means. The viewport
     * takes focus on any press inside it, and the event is stopped here so it
     * never reaches a window-level undo belonging to something else.
     */
    const handleKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLDivElement>) => {
            if (!event.ctrlKey && !event.metaKey) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key !== 'z' && key !== 'y') {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const graphKey = graphRef.current.key;
            if (key === 'y' || event.shiftKey) {
                getGraphEngine().redo(graphKey);
                return;
            }
            getGraphEngine().undo(graphKey);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    /** The viewport width in GRAPH units; it is CSS-zoomed, so scale it back. */
    const getAvailableWidth = useCallback(() => {
        return viewportRef.current === null
            ? undefined
            : viewportRef.current.clientWidth /
                  (graphRef.current.zoomPercent / 100);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Brings a just-changed graph on screen.
     *
     * The engine is re-read rather than trusting `graphRef`, which does not
     * catch up until the next render, and the fit rides along with the change
     * that caused it as ONE undo step.
     */
    const fitAfterChange = useCallback(
        (graphKey: string) => {
            const next = getGraphEngine()
                .getSnapshot()
                .find((item) => {
                    return item.key === graphKey;
                });
            if (next === undefined) {
                return;
            }
            handleFitToView(getVisibleGraph(next).nodeList, false);
        },
        [handleFitToView],
    );

    /**
     * Tidies every box back into rings around the root, then brings the result
     * into view.
     *
     * The fit is not optional: a re-layout puts the root back at the world
     * origin and clears the pan, so without it the whole graph jumps into the
     * viewport's top-left corner and most of it sits off-screen — which reads
     * as the button having broken something rather than tidied it.
     *
     * The engine is re-read rather than trusting `graphRef`, which does not
     * catch up until the next render, and the fit rides along with the
     * re-layout as ONE undo step.
     */
    const handleRelayout = useCallback(() => {
        const graphKey = graphRef.current.key;
        getGraphEngine().relayout(
            graphKey,
            sourceRef.current.relationDefList,
            getAvailableWidth(),
        );
        fitAfterChange(graphKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitAfterChange, getAvailableWidth]);

    const handleUndo = useCallback(() => {
        getGraphEngine().undo(graphRef.current.key);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRedo = useCallback(() => {
        getGraphEngine().redo(graphRef.current.key);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Adds a set of neighbours and brings the result into view.
     */
    const commitNeighbours = useCallback(
        (nodeKey: string, neighbourList: readonly GraphNeighbourType[]) => {
            const result = getGraphEngine().addNeighbours(
                graphRef.current.key,
                {
                    originKey: nodeKey,
                    neighbourList,
                    relationDefList: sourceRef.current.relationDefList,
                },
            );
            if (result?.isCapped) {
                showSimpleToast(
                    tran('Graph Preview'),
                    tran('Graph node limit reached'),
                );
            }
            if (result !== null && result.addedCount > 0) {
                // A fan of forty boxes lands mostly outside the viewport at the
                // current zoom; showing the whole result is what the user asked
                // for by expanding.
                //
                // Not a step of its own in the history: this fit BELONGS to
                // the expansion, and one undo should take both back.
                handleFitToView(result.graph.nodeList, false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [handleFitToView],
    );

    /**
     * Offers the relations this node actually has, rather than expanding them
     * all blindly.
     *
     * A record with 22 cousins and 2 parents is unreadable once everything is
     * on screen at once, and the user usually wants one of those groups — so
     * the count doubles as a menu, with "All" still at the top for the times
     * they want the lot.
     */
    const handleExpand = useCallback(
        (event: MouseEvent, nodeKey: string) => {
            const currentGraph = graphRef.current;
            const node = currentGraph.nodeList.find((item) => {
                return item.key === nodeKey;
            });
            if (node === undefined) {
                return;
            }
            setBusyNodeKey(nodeKey);
            // Deferred a macrotask so the spinner paints before a location's scan
            // over every name record blocks the thread.
            setTimeout(() => {
                let neighbourList: GraphNeighbourType[] = [];
                try {
                    neighbourList = sourceRef.current.getNeighbours(
                        contextRef.current,
                        node,
                    );
                } catch (error) {
                    handleError(error);
                    setBusyNodeKey(null);
                    return;
                }
                setBusyNodeKey(null);
                if (neighbourList.length === 0) {
                    return;
                }
                const countMap = new Map<string, GraphNeighbourType[]>();
                for (const neighbour of neighbourList) {
                    const list = countMap.get(neighbour.relation) ?? [];
                    list.push(neighbour);
                    countMap.set(neighbour.relation, list);
                }
                const itemList: ContextMenuItemType[] = [
                    {
                        id: 'all',
                        menuElement: `${tran('All')} (${neighbourList.length})`,
                        childBefore: genContextMenuItemIcon('diagram-3'),
                        onSelect: () => {
                            if (neighbourList.length > GRAPH_LARGE_FANOUT) {
                                showAppConfirm(
                                    tran('Open all Related'),
                                    `${neighbourList.length} — ${tran(
                                        'This will add many boxes to the graph. Continue?',
                                    )}`,
                                )
                                    .then((isConfirmed) => {
                                        if (isConfirmed) {
                                            commitNeighbours(
                                                nodeKey,
                                                neighbourList,
                                            );
                                        }
                                    })
                                    .catch(handleError);
                                return;
                            }
                            commitNeighbours(nodeKey, neighbourList);
                        },
                    },
                    // Only the relations this record actually has, in the source's
                    // own order so the menu reads the same way the chips do.
                    ...sourceRef.current.relationDefList
                        .filter((definition) => {
                            return countMap.has(definition.kind);
                        })
                        .map((definition): ContextMenuItemType => {
                            const list = countMap.get(definition.kind) ?? [];
                            return {
                                id: definition.kind,
                                menuElement: `${tran(definition.label)} (${list.length})`,
                                onSelect: () => {
                                    commitNeighbours(nodeKey, list);
                                },
                            };
                        }),
                ];
                showAppContextMenu(event, itemList);
            }, 0);
        },
        [commitNeighbours, contextRef, graphRef, sourceRef],
    );

    const nodeCallbacks: GraphNodeCallbacksType = useMemo(() => {
        const findNode = (nodeKey: string) => {
            return (
                graphRef.current.nodeList.find((item) => {
                    return item.key === nodeKey;
                }) ?? null
            );
        };
        const toggleCollapsed = (nodeKey: string) => {
            const node = findNode(nodeKey);
            getGraphEngine().setNodeCollapsed(
                graphRef.current.key,
                nodeKey,
                !(node?.isCollapsed ?? false),
            );
        };
        const openDetail = (nodeKey: string) => {
            const node = findNode(nodeKey);
            if (node === null) {
                return;
            }
            // The ordinary name/location floating panel, opened through
            // the store it already owns.
            openDetailPanel({
                kind: node.kind as 'name' | 'location',
                target: node.recordId,
                name: node.name,
            });
        };
        const removeNode = (nodeKey: string) => {
            getGraphEngine().removeNode(graphRef.current.key, nodeKey);
        };
        const reRoot = (nodeKey: string) => {
            const graphKey = graphRef.current.key;
            const engineNow = getGraphEngine();
            engineNow.reRoot(
                graphKey,
                nodeKey,
                sourceRef.current.relationDefList,
                getAvailableWidth(),
            );
            fitAfterChange(graphKey);
        };
        const resetToNode = (nodeKey: string) => {
            const graphKey = graphRef.current.key;
            getGraphEngine().resetToNode(graphKey, nodeKey);
            fitAfterChange(graphKey);
        };
        const openVerses = (event: MouseEvent, nodeKey: string) => {
            const node = findNode(nodeKey);
            if (node === null) {
                return;
            }
            const view = sourceRef.current.getNodeView(
                contextRef.current,
                node,
            );
            const verseList = (view?.verseList ?? []).slice(
                0,
                VERSE_MENU_LIMIT,
            );
            if (verseList.length === 0) {
                return;
            }
            // The stored key stays the target whatever the label says:
            // `target` is canonical everywhere in the app, and only the
            // wording is per-bible.
            const showMenu = (titleList: readonly string[]) => {
                showAppContextMenu(
                    event,
                    verseList.map((shortVerse, index) => {
                        const title = titleList[index] ?? shortVerse;
                        return {
                            menuElement: title,
                            style: { fontFamily: verseFontFamilyRef.current },
                            onSelect: () => {
                                openDetailPanel({
                                    kind: 'verse',
                                    target: shortVerse,
                                    name: title,
                                });
                            },
                        };
                    }),
                );
            };
            const { resolveVerseTitle } = sourceRef.current;
            if (resolveVerseTitle === undefined) {
                // A source whose verse strings already read properly.
                showMenu(verseList);
                return;
            }
            // Each title is a bible read, so they are resolved only for
            // the handful about to be shown, and in yielding batches — one
            // long chain of them drains the microtask queue and the window
            // stops answering the user while it runs.
            mapInYieldingBatches(verseList, async (shortVerse) => {
                try {
                    return (
                        (await resolveVerseTitle(
                            contextRef.current,
                            shortVerse,
                        )) ?? shortVerse
                    );
                } catch {
                    // A reference the current bible does not know still
                    // belongs in the menu, under the key as stored.
                    return shortVerse;
                }
            })
                .then(showMenu)
                .catch(handleError);
        };
        /**
         * The box's own right-click menu.
         *
         * Everything the box's buttons do, reachable in one gesture and from a
         * COLLAPSED box, which draws none of those buttons. The two entries
         * that lead to a further menu are handed the SAME event, so it opens
         * where the user right-clicked instead of jumping across the canvas.
         */
        const openNodeMenu = (event: MouseEvent, nodeKey: string) => {
            const node = findNode(nodeKey);
            if (node === null) {
                return;
            }
            const view = sourceRef.current.getNodeView(
                contextRef.current,
                node,
            );
            // Read from the badge's cache rather than counted again: counting
            // a LOCATION scans every name record, and a right-click must not
            // pay for what this box has already worked out.
            const neighbourCount = countCacheRef.current.get(nodeKey) ?? 0;
            const verseCount = view?.verseList.length ?? 0;
            const itemList: ContextMenuItemType[] = [
                {
                    id: 'detail',
                    menuElement: tran('Open detail'),
                    childBefore: genContextMenuItemIcon('info-circle'),
                    onSelect: () => {
                        openDetail(nodeKey);
                    },
                },
            ];
            if (verseCount > 0) {
                itemList.push({
                    id: 'verses',
                    menuElement: `${tran('Verses')} (${verseCount})`,
                    childBefore: genContextMenuItemIcon('book-half'),
                    onSelect: () => {
                        openVerses(event, nodeKey);
                    },
                });
            }
            if (neighbourCount > 0) {
                itemList.push({
                    id: 'expand',
                    menuElement: `${tran('Open all Related')} (${neighbourCount})`,
                    childBefore: genContextMenuItemIcon('diagram-3'),
                    onSelect: () => {
                        handleExpand(event, nodeKey);
                    },
                });
            }
            itemList.push(
                { id: 'divider', menuElement: elementDivider },
                {
                    id: 'collapse',
                    menuElement: node.isCollapsed
                        ? tran('Expand')
                        : tran('Collapse'),
                    childBefore: genContextMenuItemIcon(
                        node.isCollapsed ? 'chevron-down' : 'chevron-up',
                    ),
                    onSelect: () => {
                        toggleCollapsed(nodeKey);
                    },
                },
            );
            // The root is what everything else hangs off: re-rooting on it is
            // a no-op, and removing it would empty the graph.
            if (nodeKey !== graphRef.current.rootKey) {
                itemList.push(
                    {
                        id: 're-root',
                        menuElement: tran('Set as centre'),
                        childBefore: genContextMenuItemIcon('bullseye'),
                        onSelect: () => {
                            reRoot(nodeKey);
                        },
                    },
                    {
                        id: 'use-as-root',
                        menuElement: tran('Use as root'),
                        childBefore: genContextMenuItemIcon('node-minus'),
                        onSelect: () => {
                            resetToNode(nodeKey);
                        },
                    },
                    {
                        id: 'remove',
                        menuElement: tran('Remove'),
                        childBefore: genContextMenuItemIcon('x-lg'),
                        onSelect: () => {
                            removeNode(nodeKey);
                        },
                    },
                );
            }
            showAppContextMenu(event, itemList);
        };
        return {
            onPointerDown: handleNodePointerDown,
            onExpand: handleExpand,
            onContextMenu: openNodeMenu,
            onToggleCollapsed: toggleCollapsed,
            onOpenDetail: openDetail,
            onOpenVerses: openVerses,
            onRemove: removeNode,
            onReRoot: reRoot,
            onResetToNode: resetToNode,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resolveEdgeLabel = useCallback(
        (edge: { relation: string; toKey: string }) => {
            const definition = sourceRef.current.relationDefList.find(
                (item) => {
                    return item.canonicalKind === edge.relation;
                },
            );
            // The views already resolved for the boxes, reused. A per-edge
            // `nodeList.find` plus a fresh `getNodeView` here cost
            // O(edges x nodes) with an allocation per edge, every time the
            // edge layer rendered.
            const view = viewByKeyRef.current.get(edge.toKey) ?? null;
            const rawLabel = sourceRef.current.getRelationLabel(
                edge.relation,
                view,
            );
            return {
                label: rawLabel === '' ? '' : translate(rawLabel),
                styleKey: definition?.styleKey ?? 'default',
                isDirected: definition?.isDirected ?? false,
            };
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [translate],
    );

    /**
     * The current graph as a standalone SVG.
     *
     * Built only when an export is actually asked for — never per render — and
     * it reads the palette off the live element so the picture matches what is
     * on screen in whichever theme the user is in.
     */
    const buildExportSvg = useCallback(
        (isForPrint = false) => {
            const currentGraph = graphRef.current;
            const visible = getVisibleGraph(currentGraph);
            const root = viewportRef.current;
            const style =
                root === null
                    ? null
                    : globalThis.getComputedStyle(
                          root.closest('.graph-view') ?? root,
                      );
            const readColor = (name: string, fallback: string) => {
                const value = style?.getPropertyValue(name).trim();
                return value === undefined || value === '' ? fallback : value;
            };
            return buildGraphSvg({
                title: currentGraph.title,
                nodeList: visible.nodeList.map((node) => {
                    const view = sourceRef.current.getNodeView(
                        contextRef.current,
                        node,
                    );
                    return {
                        node,
                        view,
                        typeColor: readColor(
                            `--graph-type-${view?.typeKey ?? 'unknown'}`,
                            readColor('--graph-edge-default', '#8d949e'),
                        ),
                    };
                }),
                edgeList: visible.edgeList,
                resolveEdge: (edge) => {
                    const { label, isDirected } = resolveEdgeLabel(edge);
                    return { label, isDirected };
                },
                pathEdgeKeySet: getPathEdgeKeySet(currentGraph),
                palette: isForPrint
                    ? PRINT_PALETTE
                    : {
                          background: readColor('--app-surface', '#1b1e21'),
                          surface: readColor('--bs-body-bg', '#212529'),
                          ink: readColor('--app-ink', '#dee2e6'),
                          muted: readColor('--app-muted', '#8d949e'),
                          line: readColor('--app-line', '#6c757d'),
                          accent: readColor('--app-accent', '#6ea8fe'),
                      },
                fontFamily: fontFamily ?? 'sans-serif',
            });
        },
        [resolveEdgeLabel, fontFamily, contextRef, graphRef, sourceRef],
    );

    const handleSaveImage = useCallback(() => {
        saveGraphImage(buildExportSvg()).catch(handleError);
    }, [buildExportSvg]);

    const handlePrint = useCallback(() => {
        printGraph(buildExportSvg(true), graphRef.current.title);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildExportSvg]);

    return (
        // The font is set ONCE, here, for the whole panel: the boxes, the edge
        // labels, the chips and the dock are all wording that belongs to the
        // record's language, and one root declaration beats setting it on each
        // of them. What sits OUTSIDE this element still needs its own — the
        // widget's title bar (chrome) and any context menu (a portal).
        <div className="graph-view" style={{ fontFamily }}>
            <GraphToolbarComp
                graph={graph}
                source={source}
                context={context}
                onSaveImage={handleSaveImage}
                onPrint={handlePrint}
                viewportRef={viewportRef}
            />
            <div
                ref={viewportRef}
                className="graph-view__viewport"
                // Belt and braces: the widget content is already excluded from
                // the floating widget's move gesture, but this surface must
                // never start one whatever the chrome does later.
                data-no-widget-drag="true"
                // Focusable so the undo keys can reach the panel the user is
                // in; the focus ring is suppressed in the stylesheet, since
                // this is a canvas rather than a control.
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onPointerDown={handleViewportPointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
            >
                <div
                    ref={canvasRef}
                    className="graph-view__canvas"
                    // CSS `zoom`, not `transform: scale` — the house rule, and
                    // it keeps a real layout box for the boxes inside.
                    style={{
                        zoom: scale,
                        backgroundPosition: `${graph.panX}px ${graph.panY}px`,
                    }}
                >
                    <div
                        ref={worldRef}
                        className="graph-view__world"
                        // A translate stays on the compositor; panning with
                        // left/top would reflow the whole subtree every frame.
                        style={{
                            transform: `translate3d(${graph.panX}px, ${graph.panY}px, 0)`,
                        }}
                    >
                        <GraphEdgeLayerComp
                            edgeList={edgeList}
                            nodeList={nodeList}
                            bounds={bounds}
                            pathEdgeKeySet={pathEdgeKeySet}
                            relationDefList={source.relationDefList}
                            resolveLabel={resolveEdgeLabel}
                            isLabelHidden={
                                graph.zoomPercent < LABEL_HIDE_ZOOM_PERCENT
                            }
                        />
                        {nodeList.map((node) => {
                            return (
                                <GraphNodeBoxComp
                                    key={node.key}
                                    node={node}
                                    view={viewByKey.get(node.key) ?? null}
                                    neighbourCount={
                                        countByKey.get(node.key) ?? -1
                                    }
                                    isRoot={node.key === graph.rootKey}
                                    isOnPath={pathNodeKeySet.has(node.key)}
                                    isBusy={busyNodeKey === node.key}
                                    callbacks={nodeCallbacks}
                                />
                            );
                        })}
                    </div>
                </div>
                <GraphDockComp
                    graph={graph}
                    onFitToView={handleFitToView}
                    onRelayout={handleRelayout}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    visibleCount={nodeList.length}
                />
            </div>
        </div>
    );
}
