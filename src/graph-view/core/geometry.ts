import type { GraphRelationKindType } from './types';

/**
 * Every measurement the graph lays itself out by, in graph units (unzoomed CSS
 * px). Kept in one object so tests assert against the real numbers instead of
 * restating them and drifting.
 */
export const GRAPH_GEOMETRY = {
    NODE_WIDTH: 168,
    // Must match what the box actually renders at, or the collision test
    // under-reserves and boxes overlap vertically. The stylesheet clamps the
    // box to this height so the two cannot drift apart.
    NODE_HEIGHT: 88,
    NODE_COLLAPSED_HEIGHT: 28,
    NODE_GAP: 24,
    // Both of these must clear a whole box, or two rings collide where they
    // run closest together. RING_RADIUS >= NODE_WIDTH + NODE_GAP keeps ring 0
    // off the root; RING_STEP >= the same keeps rings apart at the SIDES,
    // where consecutive rings differ in x only.
    RING_RADIUS: 200,
    RING_STEP: 196,
    // Rings are ELLIPSES, not circles. A box is 168 wide but only 88 tall, so
    // a circular ring reserves far more vertical room than it needs and a
    // 23-node fan ended up 1300px tall in a 400px viewport. Flattening the
    // ring packs the same boxes into an area shaped like the panel they are
    // being read in.
    // Also load-bearing: RING_STEP * RING_Y_RATIO must clear
    // NODE_HEIGHT + NODE_GAP, which is where the rings run closest together at
    // the top and bottom. 196 * 0.72 = 141 against a required 112.
    RING_Y_RATIO: 0.72,
    COLLISION_NUDGE: 34,
    // Bounded tightly on purpose. Every nudge grows the whole ring, so a long
    // chain of them inflates the graph far more than the overlap it was
    // avoiding costs: 24 steps could add 600px of radius and push a 23-box fan
    // to a thousand pixels tall. A couple of boxes touching is the cheaper
    // outcome, and Re-layout is one click away.
    COLLISION_MAX_STEP: 8,
    // 270 degrees, leaving a 90 degree dead zone pointing back at the node this
    // one was expanded from, so a fan never grows over its own parent.
    NON_ROOT_SWEEP: Math.PI * 1.5,
    PATH_GAP: 72,
    PATH_ROW_HEIGHT: 150,
    // Below this an edge is shorter than its own label, which would then sit
    // inside one of the two boxes it connects.
    EDGE_LABEL_MIN_LENGTH: 96,
    EDGE_BOW: 18,
    WORLD_PADDING: 336,
    FIT_PADDING: 48,
} as const;

export type GraphPointType = { x: number; y: number };

export type RadialGroupType = {
    relation: GraphRelationKindType;
    count: number;
};

export type RadialPlacementType = {
    relation: GraphRelationKindType;
    index: number;
    x: number;
    y: number;
};

export function getRingRadius(ring: number) {
    return GRAPH_GEOMETRY.RING_RADIUS + ring * GRAPH_GEOMETRY.RING_STEP;
}

/**
 * How many boxes fit around one ring without touching.
 *
 * The floor of 6 matters for the innermost ring: the exact circumference maths
 * yields fewer slots there than a small fan needs, and spilling a 4-neighbour
 * expansion onto two rings looks broken.
 */
export function getRingCapacity(ring: number) {
    const xRadius = getRingRadius(ring);
    const yRadius = xRadius * GRAPH_GEOMETRY.RING_Y_RATIO;
    // Ramanujan's approximation. The ring is an ELLIPSE, and using a circle's
    // circumference here claimed room the flattened ring does not have, so
    // every ring came out overcrowded and the collision resolver had to
    // inflate the whole graph to compensate.
    const perimeter =
        Math.PI *
        (3 * (xRadius + yRadius) -
            Math.sqrt((3 * xRadius + yRadius) * (xRadius + 3 * yRadius)));
    // The widest a box can be along the curve. Conservative on purpose: near
    // the sides only the box HEIGHT has to clear, but reserving the width
    // everywhere is what keeps the result overlap-free.
    const perNode = GRAPH_GEOMETRY.NODE_WIDTH + GRAPH_GEOMETRY.NODE_GAP;
    // A floor so a small fan does not spill onto a second ring and look
    // broken; below this the collision resolver picks up the slack.
    return Math.max(4, Math.floor(perimeter / perNode));
}

/**
 * Whether two boxes overlap, as an axis-aligned box test rather than a circle
 * one — the boxes are far wider than they are tall, and a circle test either
 * lets them overlap side by side or flings them absurdly far apart vertically.
 */
export function checkIsColliding(a: GraphPointType, b: GraphPointType) {
    return (
        Math.abs(a.x - b.x) <
            GRAPH_GEOMETRY.NODE_WIDTH + GRAPH_GEOMETRY.NODE_GAP &&
        Math.abs(a.y - b.y) <
            GRAPH_GEOMETRY.NODE_HEIGHT + GRAPH_GEOMETRY.NODE_GAP
    );
}

/**
 * The angle that sits a given fraction of the way ALONG an elliptical arc.
 *
 * Equal angles are not equal distances on an ellipse: near the flattened top
 * and bottom the points bunch up, near the sides they spread out. Spacing by
 * angle therefore left some boxes overlapping and others far apart, and the
 * collision resolver then had to inflate the whole ring to fix it. Spacing by
 * arc length places them evenly in the first place.
 *
 * Scale-invariant, so one mapping serves every ring: the shape depends only on
 * the y ratio, not the radius.
 */
function getAngleAtArcFraction(
    startAngle: number,
    sweep: number,
    fraction: number,
    yRatio: number,
) {
    const stepCount = 180;
    const stepAngle = sweep / stepCount;
    const lengthList: number[] = [0];
    let total = 0;
    for (let index = 0; index < stepCount; index++) {
        const angle = startAngle + stepAngle * (index + 0.5);
        // Speed along the ellipse at this angle, for a unit x-radius.
        const speed = Math.hypot(Math.sin(angle), Math.cos(angle) * yRatio);
        total += speed * stepAngle;
        lengthList.push(total);
    }
    if (total === 0) {
        return startAngle + sweep * fraction;
    }
    const target = total * fraction;
    for (let index = 1; index < lengthList.length; index++) {
        if (lengthList[index] < target) {
            continue;
        }
        const previous = lengthList[index - 1];
        const span = lengthList[index] - previous;
        const withinStep = span === 0 ? 0 : (target - previous) / span;
        return startAngle + stepAngle * (index - 1 + withinStep);
    }
    return startAngle + sweep;
}

/**
 * Places new neighbours on rings around the node they were expanded from,
 * grouped so each relation owns a contiguous arc.
 *
 * Deterministic by construction: no randomness, no clock, and no iteration
 * over anything whose order is not fixed, so the same record expanded twice
 * draws the same picture. Complexity is
 * O(new x (existing + new) x COLLISION_MAX_STEP) — at the 120-node cap a few
 * hundred thousand cheap comparisons, run once per expansion and never per
 * frame.
 *
 * `relationOrder` is passed in rather than imported: the core does not know
 * which relations exist, only that the source has an opinion about their order.
 */
export function layoutRadialNeighbours({
    origin,
    incomingAngle,
    groupList,
    occupiedList,
    relationOrder,
}: {
    origin: GraphPointType;
    // The direction `origin` itself was placed from; null for a root, which
    // gets the full circle instead of a sweep.
    incomingAngle: number | null;
    groupList: readonly RadialGroupType[];
    occupiedList: readonly GraphPointType[];
    relationOrder: readonly GraphRelationKindType[];
}): RadialPlacementType[] {
    const orderedGroupList = relationOrder
        .map((relation) => {
            return groupList.find((group) => {
                return group.relation === relation;
            });
        })
        .filter((group): group is RadialGroupType => {
            return group !== undefined && group.count > 0;
        });
    const total = orderedGroupList.reduce((sum, group) => {
        return sum + group.count;
    }, 0);
    if (total === 0) {
        return [];
    }

    const sweep =
        incomingAngle === null ? Math.PI * 2 : GRAPH_GEOMETRY.NON_ROOT_SWEEP;
    // Centre the fan AWAY from wherever this node was reached from.
    const centreAngle = (incomingAngle ?? -Math.PI / 2) + Math.PI;
    const startAngle = centreAngle - sweep / 2;

    // Flatten to an ordered slot list first, so grouping and ring assignment
    // stay separate concerns.
    const slotList: { relation: GraphRelationKindType; index: number }[] = [];
    for (const group of orderedGroupList) {
        for (let index = 0; index < group.count; index++) {
            slotList.push({ relation: group.relation, index });
        }
    }

    const resultList: RadialPlacementType[] = [];
    const takenList: GraphPointType[] = [...occupiedList];
    // Each ring spans the WHOLE sweep independently. Spreading one global
    // fraction across every slot instead gave each ring only its own narrow
    // slice of the arc, which bunched its nodes into a corner and left the
    // rest of the ring empty.
    let slot = 0;
    let ring = 0;
    while (slot < slotList.length) {
        const ringSlotList = slotList.slice(slot, slot + getRingCapacity(ring));
        const radius = getRingRadius(ring);
        for (let index = 0; index < ringSlotList.length; index++) {
            const angle = getAngleAtArcFraction(
                startAngle,
                sweep,
                (index + 0.5) / ringSlotList.length,
                GRAPH_GEOMETRY.RING_Y_RATIO,
            );
            let currentRadius = radius;
            let point = {
                x: origin.x + Math.cos(angle) * currentRadius,
                y:
                    origin.y +
                    Math.sin(angle) *
                        currentRadius *
                        GRAPH_GEOMETRY.RING_Y_RATIO,
            };
            // Push outward along this node's own angle until clear. Bounded on
            // purpose: every step grows the ring, so a long chain of them
            // inflates the graph more than the overlap it avoids costs.
            let step = 0;
            while (
                step < GRAPH_GEOMETRY.COLLISION_MAX_STEP &&
                takenList.some((taken) => {
                    return checkIsColliding(taken, point);
                })
            ) {
                currentRadius += GRAPH_GEOMETRY.COLLISION_NUDGE;
                point = {
                    x: origin.x + Math.cos(angle) * currentRadius,
                    y:
                        origin.y +
                        Math.sin(angle) *
                            currentRadius *
                            GRAPH_GEOMETRY.RING_Y_RATIO,
                };
                step += 1;
            }
            takenList.push(point);
            resultList.push({
                relation: ringSlotList[index].relation,
                index: ringSlotList[index].index,
                x: point.x,
                y: point.y,
            });
        }
        slot += ringSlotList.length;
        ring += 1;
    }
    return resultList;
}

/**
 * Lays a found path out end to end, wrapping boustrophedon so consecutive hops
 * are always adjacent — a plain left-to-right wrap would leave the end of one
 * row and the start of the next at opposite edges with a long line between.
 */
export function layoutPathChain({
    nodeCount,
    availableWidth,
}: {
    nodeCount: number;
    // Viewport width in GRAPH units, i.e. clientWidth divided by the scale.
    availableWidth: number;
}): GraphPointType[] {
    if (nodeCount <= 0) {
        return [];
    }
    const perNode = GRAPH_GEOMETRY.NODE_WIDTH + GRAPH_GEOMETRY.PATH_GAP;
    const perRow = Math.max(2, Math.floor(availableWidth / perNode));
    const resultList: GraphPointType[] = [];
    for (let index = 0; index < nodeCount; index++) {
        const row = Math.floor(index / perRow);
        const rawColumn = index % perRow;
        const column = row % 2 === 0 ? rawColumn : perRow - 1 - rawColumn;
        resultList.push({
            x: column * perNode,
            y: row * GRAPH_GEOMETRY.PATH_ROW_HEIGHT,
        });
    }
    return resultList;
}

/**
 * The SVG path for one edge, as a smooth cubic curve.
 *
 * Curved rather than straight because a fan of forty straight lines meeting at
 * one box reads as a starburst, while curves leaving horizontally separate
 * visually and stay followable — the same reason node editors draw links this
 * way.
 *
 * `bow` offsets the curve perpendicular to itself, which is how two records
 * related in more than one way (Abraham and Sarah are siblings AND spouses)
 * get two distinguishable lines instead of one drawn twice.
 */
export function getEdgePathD(
    from: GraphPointType,
    to: GraphPointType,
    bow = 0,
) {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const length = Math.hypot(deltaX, deltaY);
    // Horizontal control handles, with a floor so short edges still curve.
    const handle = Math.max(48, Math.abs(deltaX) * 0.5);
    const direction = deltaX >= 0 ? 1 : -1;
    const normalX = length === 0 ? 0 : -deltaY / length;
    const normalY = length === 0 ? 0 : deltaX / length;
    const control1X = from.x + handle * direction + normalX * bow;
    const control1Y = from.y + normalY * bow;
    const control2X = to.x - handle * direction + normalX * bow;
    const control2Y = to.y + normalY * bow;
    return (
        `M ${from.x} ${from.y} C ${control1X} ${control1Y}, ` +
        `${control2X} ${control2Y}, ${to.x} ${to.y}`
    );
}

/**
 * Where a label sits on that curve: the cubic at t = 0.5, which is visually
 * the middle of the arc rather than the middle of the straight line between
 * the two ends.
 */
export function getEdgeLabelPoint(
    from: GraphPointType,
    to: GraphPointType,
    bow = 0,
): GraphPointType {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const length = Math.hypot(deltaX, deltaY);
    const handle = Math.max(48, Math.abs(deltaX) * 0.5);
    const direction = deltaX >= 0 ? 1 : -1;
    const normalX = length === 0 ? 0 : -deltaY / length;
    const normalY = length === 0 ? 0 : deltaX / length;
    const control1X = from.x + handle * direction + normalX * bow;
    const control1Y = from.y + normalY * bow;
    const control2X = to.x - handle * direction + normalX * bow;
    const control2Y = to.y + normalY * bow;
    return {
        x: (from.x + 3 * control1X + 3 * control2X + to.x) / 8,
        y: (from.y + 3 * control1Y + 3 * control2Y + to.y) / 8,
    };
}

export type GraphBoundsType = {
    left: number;
    top: number;
    width: number;
    height: number;
};

/**
 * The padded box every node fits inside, in graph units.
 *
 * The edge layer is positioned and sized from this rather than anchored at the
 * origin: a fan-out to the upper left puts nodes at negative coordinates,
 * which an origin-anchored SVG clips.
 */
export function getWorldBounds(
    nodeList: readonly GraphPointType[],
): GraphBoundsType {
    if (nodeList.length === 0) {
        return { left: 0, top: 0, width: 1, height: 1 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeList) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    }
    const padding = GRAPH_GEOMETRY.WORLD_PADDING;
    return {
        left: minX - padding,
        top: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
    };
}

/**
 * The pan that puts the content's centre in the middle of the viewport,
 * leaving the zoom alone.
 *
 * A graph starts with its root at the origin, which without this sits in the
 * viewport's top-left corner with most of the box clipped away. Fitting would
 * also work but would zoom a lone root box to the maximum, so centring is the
 * right move on open.
 */
export function centreGraphInViewport({
    nodeList,
    viewportWidth,
    viewportHeight,
    zoomPercent,
}: {
    nodeList: readonly GraphPointType[];
    viewportWidth: number;
    viewportHeight: number;
    zoomPercent: number;
}): { panX: number; panY: number } {
    if (nodeList.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
        return { panX: 0, panY: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeList) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    }
    const scale = zoomPercent / 100;
    return {
        panX: viewportWidth / scale / 2 - (minX + maxX) / 2,
        panY: viewportHeight / scale / 2 - (minY + maxY) / 2,
    };
}

/**
 * Pan and zoom that bring every node into view, computed entirely from stored
 * positions and the box constants — never by measuring the DOM.
 */
export function fitGraphToViewport({
    nodeList,
    viewportWidth,
    viewportHeight,
    minZoomPercent,
    maxZoomPercent,
}: {
    nodeList: readonly GraphPointType[];
    viewportWidth: number;
    viewportHeight: number;
    minZoomPercent: number;
    maxZoomPercent: number;
}): { panX: number; panY: number; zoomPercent: number } {
    if (nodeList.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
        return { panX: 0, panY: 0, zoomPercent: 100 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeList) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    }
    // The extremes are box CENTRES, so half a box sticks out on each side.
    const padding = GRAPH_GEOMETRY.FIT_PADDING;
    const contentWidth = maxX - minX + GRAPH_GEOMETRY.NODE_WIDTH + padding * 2;
    const contentHeight =
        maxY - minY + GRAPH_GEOMETRY.NODE_HEIGHT + padding * 2;
    const rawScale = Math.min(
        viewportWidth / contentWidth,
        viewportHeight / contentHeight,
    );
    const zoomPercent = Math.max(
        minZoomPercent,
        Math.min(maxZoomPercent, Math.floor(rawScale * 100)),
    );
    const scale = zoomPercent / 100;
    return {
        panX: viewportWidth / scale / 2 - (minX + maxX) / 2,
        panY: viewportHeight / scale / 2 - (minY + maxY) / 2,
        zoomPercent,
    };
}
