import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { GraphNodeRefType, GraphSourceType, GraphViewType } from './core';
import { GRAPH_GEOMETRY, GRAPH_MAX_PATH_HOP } from './core';
import { getGraphEngine } from './graphViewStore';
import { fitGraphOnScreen } from './graphFitHelpers';

const SEARCH_DEBOUNCE_MILLISECOND = 300;
const SEARCH_RESULT_LIMIT = 8;

/**
 * What a search that came back empty says.
 *
 * The walk gives up past `GRAPH_MAX_PATH_HOP` steps, so "no connection" alone
 * claimed more than it knew: two records further apart than that ARE
 * connected, and the user had no way to tell that from two that are not. A
 * `{count}` placeholder rather than a number glued onto the sentence, because
 * where the count sits is the translation's to decide.
 */
export function genNoConnectionMessage() {
    return tran('No connection found within {count} steps').replace(
        '{count}',
        `${GRAPH_MAX_PATH_HOP}`,
    );
}

/**
 * A record's name, with its English one beside it.
 *
 * Records are written in the lookup language, and a list of eight Khmer names
 * that all begin the same way is not something anyone can pick from — the
 * lookup list and the graph boxes both show `ដាវីឌ (David)` for exactly
 * that reason, so the picker has to as well.
 *
 * The English name is not on the search RESULT, it is on the record: one map
 * lookup per row, for the eight rows on screen while the user is typing.
 */
function RenderNodeLabelComp<TContext>({
    node,
    source,
    context,
}: Readonly<{
    node: Readonly<GraphNodeRefType>;
    source: GraphSourceType<TContext>;
    context: TContext;
}>) {
    const kjvName = source.getNodeView(context, node)?.kjvName ?? '';
    return (
        <>
            <span className="text-truncate">{node.name}</span>
            {kjvName === '' ? null : (
                <span
                    className={
                        'location-name-lookup__kjv-name ms-1 text-truncate'
                    }
                >
                    ({kjvName})
                </span>
            )}
        </>
    );
}

/**
 * One record picker.
 *
 * Its debounce timer is created per INSTANCE. A shared one would let the To
 * field clear the From field's pending search, which is the multi-instance
 * timer bug the lookup panel documents.
 */
function RenderNodePickerComp<TContext>({
    label,
    source,
    context,
    selected,
    onSelect,
    inputRef,
}: Readonly<{
    label: string;
    source: GraphSourceType<TContext>;
    context: TContext;
    selected: GraphNodeRefType | null;
    onSelect: (node: GraphNodeRefType | null) => void;
    inputRef: RefObject<HTMLInputElement | null>;
}>) {
    const [query, setQuery] = useState('');
    const [resultList, setResultList] = useState<GraphNodeRefType[]>([]);
    const sourceRef = useAppCurrentRef(source);
    const contextRef = useAppCurrentRef(context);
    const searchAttempt = useMemo(() => {
        return genTimeoutAttempt(SEARCH_DEBOUNCE_MILLISECOND);
    }, []);

    if (selected !== null) {
        return (
            <span className="graph-view__picker graph-view__picker--chosen">
                <RenderNodeLabelComp
                    node={selected}
                    source={source}
                    context={context}
                />
                <button
                    type="button"
                    className="graph-view__tool-button"
                    title={tran('Clear search')}
                    aria-label={tran('Clear search')}
                    onClick={() => {
                        onSelect(null);
                        setQuery('');
                        setResultList([]);
                    }}
                >
                    <i className="bi bi-x" />
                </button>
            </span>
        );
    }
    return (
        <span className="graph-view__picker">
            <input
                ref={inputRef}
                type="text"
                className="form-control form-control-sm"
                placeholder={label}
                aria-label={label}
                value={query}
                onChange={(event) => {
                    const nextQuery = event.target.value;
                    setQuery(nextQuery);
                    searchAttempt(() => {
                        if (nextQuery.trim() === '') {
                            setResultList([]);
                            return;
                        }
                        const searchNodes = sourceRef.current.searchNodes;
                        if (searchNodes === undefined) {
                            return;
                        }
                        setResultList(
                            searchNodes(
                                contextRef.current,
                                nextQuery,
                                SEARCH_RESULT_LIMIT,
                            ),
                        );
                    });
                }}
            />
            {resultList.length > 0 ? (
                <ul className="graph-view__picker-list">
                    {resultList.map((node) => {
                        return (
                            <li key={`${node.kind}:${node.recordId}`}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelect(node);
                                        setResultList([]);
                                        setQuery('');
                                    }}
                                >
                                    <RenderNodeLabelComp
                                        node={node}
                                        source={source}
                                        context={context}
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </span>
    );
}

/**
 * Find the connection between THIS graph and another record.
 *
 * There is only one picker: the path always starts at the graph's own centre
 * box, which is the record the panel is about. Asking for a starting point as
 * well made the user name a record the panel was already showing, and let them
 * build a search with nothing to do with what was on screen.
 *
 * A found path re-roots the graph on its first box, so the next search
 * naturally carries on from where the last one arrived.
 */
export default function GraphPathBarComp<TContext>({
    graph,
    source,
    context,
    viewportRef,
}: Readonly<{
    graph: GraphViewType;
    source: GraphSourceType<TContext>;
    context: TContext;
    viewportRef: RefObject<HTMLDivElement | null>;
}>) {
    const engine = getGraphEngine();
    const [toNode, setToNode] = useState<GraphNodeRefType | null>(null);
    const [message, setMessage] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const pickerInputRef = useRef<HTMLInputElement>(null);
    const findButtonRef = useRef<HTMLButtonElement>(null);
    const focusAfterPickRef = useRef<'find' | 'picker' | null>(null);

    /**
     * Picking a record removes the row that was pressed, and clearing it
     * removes the chip's ✕ — either drops focus to `<body>`, where Ctrl+Z is
     * the browser's undo of whatever was typed last. So focus moves on to what
     * comes next: Find after a pick, the search box after a clear, and the
     * canvas when Find cannot be pressed (the same record twice).
     */
    const handleToNodeSelect = (node: GraphNodeRefType | null) => {
        focusAfterPickRef.current = node === null ? 'picker' : 'find';
        setToNode(node);
    };
    useEffect(() => {
        const focusAfterPick = focusAfterPickRef.current;
        focusAfterPickRef.current = null;
        if (focusAfterPick === null) {
            return;
        }
        const target =
            focusAfterPick === 'find'
                ? findButtonRef.current
                : pickerInputRef.current;
        if (target === null || target.disabled) {
            viewportRef.current?.focus({ preventScroll: true });
            return;
        }
        target.focus();
    }, [toNode, viewportRef]);

    const rootNode = graph.nodeList.find((node) => {
        return node.key === graph.rootKey;
    });
    const blockedReason =
        rootNode === undefined
            ? ''
            : (source.getPathBlockedReason?.(rootNode) ?? '');

    const handleFind = () => {
        const findPath = source.findPath;
        if (
            findPath === undefined ||
            rootNode === undefined ||
            toNode === null
        ) {
            return;
        }
        // Find is disabled while it searches, and a found path re-roots the
        // graph — the canvas is where the next Ctrl+Z belongs.
        viewportRef.current?.focus({ preventScroll: true });
        setIsSearching(true);
        setMessage('');
        // A macrotask so the button paints its busy state before the walk over
        // a few thousand records blocks the thread.
        setTimeout(() => {
            try {
                const refList = findPath(
                    context,
                    rootNode.recordId,
                    toNode.recordId,
                );
                if (refList === null || refList.length === 0) {
                    // Disconnected records are common here, so this reads as
                    // an answer rather than an error: no red, no icon.
                    const noConnectionMessage = genNoConnectionMessage();
                    setMessage(noConnectionMessage);
                    showSimpleToast(
                        tran('Find Connection'),
                        noConnectionMessage,
                    );
                    return;
                }
                const viewport = viewportRef.current;
                const availableWidth =
                    viewport === null
                        ? GRAPH_GEOMETRY.NODE_WIDTH * 4
                        : viewport.clientWidth / (graph.zoomPercent / 100);
                engine.setPath(graph.key, {
                    refList,
                    hopList: source.getPathHopList?.(context, refList) ?? [],
                    availableWidth,
                });
                engine.setPathEndpoints(graph.key, {
                    pathFromId: rootNode.recordId,
                    pathToId: toNode.recordId,
                });
                // The path is laid out where it lands, and at the old zoom
                // half of it sat off-screen until Fit to view was pressed.
                // Not a history step of its own: it belongs to the path.
                fitGraphOnScreen(graph.key, viewport, undefined, false);
            } catch (error) {
                handleError(error);
            } finally {
                setIsSearching(false);
            }
        }, 0);
    };

    if (blockedReason) {
        return (
            <div className="graph-view__path-bar">
                <span className="graph-view__path-message">
                    {tran(blockedReason)}
                </span>
            </div>
        );
    }
    return (
        <div className="graph-view__path-bar">
            {/* Where the path starts, shown rather than asked for. */}
            <span
                className={
                    'graph-view__picker graph-view__picker--chosen' +
                    ' graph-view__picker--fixed'
                }
                title={rootNode?.name ?? ''}
            >
                <i className="bi bi-geo-alt" />
                {rootNode === undefined ? null : (
                    <RenderNodeLabelComp
                        node={rootNode}
                        source={source}
                        context={context}
                    />
                )}
            </span>
            <i className="bi bi-arrow-right graph-view__path-arrow" />
            <RenderNodePickerComp
                label={tran('Path to')}
                source={source}
                context={context}
                selected={toNode}
                onSelect={handleToNodeSelect}
                inputRef={pickerInputRef}
            />
            <button
                ref={findButtonRef}
                type="button"
                className="btn btn-sm btn-outline-secondary"
                // Same-record and empty pickers are simply not askable, which
                // saves explaining either case afterwards.
                disabled={
                    isSearching ||
                    rootNode === undefined ||
                    toNode === null ||
                    rootNode.recordId === toNode.recordId
                }
                onClick={handleFind}
            >
                {tran('Find Connection')}
            </button>
            {message === '' ? null : (
                <span className="graph-view__path-message">{message}</span>
            )}
        </div>
    );
}
