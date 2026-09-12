import { memo } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import type { GraphNodeType, GraphNodeViewType } from './core';
import { GRAPH_GEOMETRY } from './core';

export type GraphNodeCallbacksType = {
    onPointerDown: (
        event: ReactPointerEvent<HTMLDivElement>,
        nodeKey: string,
    ) => void;
    // Takes the native event so the relation menu can open at the button.
    onExpand: (event: MouseEvent, nodeKey: string) => void;
    onContextMenu: (event: MouseEvent, nodeKey: string) => void;
    onToggleCollapsed: (nodeKey: string) => void;
    onOpenDetail: (nodeKey: string) => void;
    onOpenVerses: (event: MouseEvent, nodeKey: string) => void;
    onRemove: (nodeKey: string) => void;
    onReRoot: (nodeKey: string) => void;
    // Throw the rest of the graph away and start again from this box.
    onResetToNode: (nodeKey: string) => void;
};

/**
 * One box on the canvas.
 *
 * Memoized because a graph holds up to 120 of these and a pan, a zoom or a
 * single neighbour being added must not re-render all of them.
 */
function GraphNodeBoxComp({
    node,
    view,
    neighbourCount,
    isRoot,
    isOnPath,
    isBusy,
    callbacks,
}: Readonly<{
    node: GraphNodeType;
    view: GraphNodeViewType | null;
    // -1 while it has not been counted yet, so the badge can stay quiet rather
    // than flashing a wrong number.
    neighbourCount: number;
    isRoot: boolean;
    isOnPath: boolean;
    isBusy: boolean;
    callbacks: GraphNodeCallbacksType;
}>) {
    const name = view?.name ?? node.name;
    const hasNeighbours = neighbourCount !== 0;
    const verseCount = view?.verseList.length ?? 0;
    const expandLabel = hasNeighbours
        ? tran('Open all Related')
        : tran('No related records');
    return (
        <div
            className={[
                'graph-view__node',
                node.isCollapsed ? 'graph-view__node--collapsed' : '',
                isRoot ? 'graph-view__node--root' : '',
                isOnPath ? 'graph-view__node--on-path' : '',
                node.isExpanded ? 'graph-view__node--expanded' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            data-node-key={node.key}
            data-type-key={view?.typeKey ?? 'unknown'}
            data-node-kind={node.kind}
            style={
                {
                    left: node.x - GRAPH_GEOMETRY.NODE_WIDTH / 2,
                    top: node.y - GRAPH_GEOMETRY.NODE_HEIGHT / 2,
                    width: GRAPH_GEOMETRY.NODE_WIDTH,
                } as CSSProperties
            }
            onPointerDown={(event) => {
                callbacks.onPointerDown(event, node.key);
            }}
            onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                callbacks.onReRoot(node.key);
            }}
            // Right-click anywhere on the box — including a COLLAPSED one,
            // which draws none of the buttons below.
            onContextMenu={(event) => {
                callbacks.onContextMenu(event.nativeEvent, node.key);
            }}
        >
            <div className="graph-view__node-head">
                <i
                    className={`${view?.iconClass ?? 'bi bi-question-circle'} graph-view__node-icon`}
                />
                <span className="graph-view__node-name text-truncate">
                    {name}
                    {view?.kjvName ? (
                        <span className="location-name-lookup__kjv-name ms-1">
                            ({view.kjvName})
                        </span>
                    ) : null}
                </span>
                {/* In the HEAD, which a collapsed box still draws — that is the
                    box with no action buttons at all, and the one whose menu is
                    hardest to reach without a right button. */}
                <ContextMenuDotsButtonComp
                    onOpening={(event) => {
                        callbacks.onContextMenu(event.nativeEvent, node.key);
                    }}
                />
            </div>
            {node.isCollapsed ? null : (
                <>
                    {view?.title ? (
                        <div className="graph-view__node-title">
                            <span>{view.title}</span>
                        </div>
                    ) : null}
                    <div className="graph-view__node-actions">
                        <button
                            type="button"
                            className="graph-view__node-button"
                            title={expandLabel}
                            aria-label={expandLabel}
                            disabled={!hasNeighbours || isBusy}
                            onClick={(event) => {
                                callbacks.onExpand(event.nativeEvent, node.key);
                            }}
                        >
                            <i
                                className={
                                    isBusy
                                        ? 'bi bi-arrow-repeat graph-view__spin'
                                        : 'bi bi-diagram-3'
                                }
                            />
                            {neighbourCount > 0 ? (
                                <span className="app-data ms-1">
                                    {neighbourCount}
                                </span>
                            ) : null}
                        </button>
                        <button
                            type="button"
                            className="graph-view__node-button"
                            title={tran('Open detail')}
                            aria-label={tran('Open detail')}
                            onClick={() => {
                                callbacks.onOpenDetail(node.key);
                            }}
                        >
                            <i className="bi bi-info-circle" />
                        </button>
                        {verseCount > 0 ? (
                            <button
                                type="button"
                                className="graph-view__node-button"
                                title={tran('Verses')}
                                aria-label={tran('Verses')}
                                onClick={(event) => {
                                    callbacks.onOpenVerses(
                                        event.nativeEvent,
                                        node.key,
                                    );
                                }}
                            >
                                <i className="bi bi-book-half" />
                                <span className="app-data ms-1">
                                    {verseCount}
                                </span>
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="graph-view__node-button ms-auto"
                            title={tran('Collapse')}
                            aria-label={tran('Collapse')}
                            onClick={() => {
                                callbacks.onToggleCollapsed(node.key);
                            }}
                        >
                            <i className="bi bi-chevron-up" />
                        </button>
                        {isRoot ? null : (
                            <button
                                type="button"
                                className="graph-view__node-button"
                                title={tran('Remove')}
                                aria-label={tran('Remove')}
                                onClick={() => {
                                    callbacks.onRemove(node.key);
                                }}
                            >
                                <i className="bi bi-x-lg" />
                            </button>
                        )}
                    </div>
                </>
            )}
            {node.isCollapsed ? (
                <button
                    type="button"
                    className="graph-view__node-expand"
                    title={tran('Expand')}
                    aria-label={tran('Expand')}
                    onClick={() => {
                        callbacks.onToggleCollapsed(node.key);
                    }}
                >
                    <i className="bi bi-chevron-down" />
                </button>
            ) : null}
        </div>
    );
}

export default memo(GraphNodeBoxComp);
