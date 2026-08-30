import { memo } from 'react';

import type {
    GraphBoundsType,
    GraphEdgeType,
    GraphNodeType,
    GraphRelationDefType,
} from './core';
import {
    GRAPH_GEOMETRY,
    getEdgeBowIndexMap,
    getEdgeLabelPoint,
    getEdgePathD,
} from './core';

export type GraphEdgeLabelResolverType = (edge: GraphEdgeType) => {
    label: string;
    styleKey: string;
    isDirected: boolean;
};

/**
 * The one SVG holding every edge.
 *
 * One element with N children, never one SVG per edge — and deliberately with
 * NO `viewBox`: a viewBox rescales user units to the CSS box, so the lines
 * would drift away from the DOM boxes the moment the world bounds changed.
 * Explicit pixel width/height in raw graph units means CSS `zoom` scales the
 * SVG and the boxes by exactly the same factor, and they cannot disagree.
 *
 * It is positioned from the computed world bounds rather than anchored at the
 * origin, because a fan-out to the upper left puts nodes at negative
 * coordinates that an origin-anchored SVG would clip.
 */
function GraphEdgeLayerComp({
    edgeList,
    nodeList,
    bounds,
    pathEdgeKeySet,
    relationDefList,
    resolveLabel,
    isLabelHidden,
}: Readonly<{
    edgeList: GraphEdgeType[];
    nodeList: GraphNodeType[];
    bounds: GraphBoundsType;
    pathEdgeKeySet: Set<string>;
    relationDefList: readonly GraphRelationDefType[];
    resolveLabel: GraphEdgeLabelResolverType;
    isLabelHidden: boolean;
}>) {
    const pointByKey = new Map(
        nodeList.map((node) => {
            return [node.key, node];
        }),
    );
    const bowByKey = getEdgeBowIndexMap(edgeList);
    const styleKeyByRelation = new Map(
        relationDefList.map((definition) => {
            return [definition.canonicalKind, definition.styleKey];
        }),
    );
    const hasPath = pathEdgeKeySet.size > 0;

    return (
        <svg
            className={[
                'graph-view__edges',
                hasPath ? 'graph-view__edges--has-path' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            width={bounds.width}
            height={bounds.height}
            style={{ left: bounds.left, top: bounds.top }}
            aria-hidden="true"
        >
            <defs>
                <marker
                    id="graph-view-arrow"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
            </defs>
            {edgeList.map((edge) => {
                const from = pointByKey.get(edge.fromKey);
                const to = pointByKey.get(edge.toKey);
                if (from === undefined || to === undefined) {
                    return null;
                }
                const { label, isDirected } = resolveLabel(edge);
                const styleKey =
                    styleKeyByRelation.get(edge.relation) ?? 'default';
                const isOnPath = pathEdgeKeySet.has(edge.key);
                const bow = bowByKey.get(edge.key) ?? 0;
                const length = Math.hypot(to.x - from.x, to.y - from.y);
                // Computed straight from the stored positions — no DOM
                // measurement, so this stays cheap while a drag repaints.
                const localFrom = {
                    x: from.x - bounds.left,
                    y: from.y - bounds.top,
                };
                const localTo = { x: to.x - bounds.left, y: to.y - bounds.top };
                const labelPoint = getEdgeLabelPoint(localFrom, localTo, bow);
                const isLabelVisible =
                    !isLabelHidden &&
                    label !== '' &&
                    length >= GRAPH_GEOMETRY.EDGE_LABEL_MIN_LENGTH;
                return (
                    <g
                        key={edge.key}
                        className={[
                            'graph-view__edge-group',
                            `graph-view__edge-group--${styleKey}`,
                            isOnPath ? 'graph-view__edge-group--on-path' : '',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                    >
                        <path
                            className="graph-view__edge"
                            data-edge-key={edge.key}
                            data-edge-from={edge.fromKey}
                            data-edge-to={edge.toKey}
                            d={getEdgePathD(localFrom, localTo, bow)}
                            markerEnd={
                                isDirected
                                    ? 'url(#graph-view-arrow)'
                                    : undefined
                            }
                        />
                        {isLabelVisible ? (
                            <text
                                className="graph-view__edge-label"
                                data-edge-label-for={edge.key}
                                x={labelPoint.x}
                                y={labelPoint.y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                // A stroked halo painted UNDER the fill, so the
                                // label reads over crossing lines without a
                                // background rect — a rect would need a
                                // getBBox() measurement per label, which is
                                // exactly the layout thrash to avoid here.
                                paintOrder="stroke"
                            >
                                {label}
                            </text>
                        ) : null}
                    </g>
                );
            })}
        </svg>
    );
}

export default memo(GraphEdgeLayerComp);
