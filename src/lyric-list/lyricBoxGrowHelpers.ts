/**
 * A lyric box grows to show the whole of its part (2026-11-07, the user:
 * _I don't want any cut content_ -- chosen with them: GROW the box, never
 * shrink the words).
 *
 * open-lyric lays a part out in a tile of the box's size with
 * `overflow: hidden`, and writes every element's px `width` and `height`
 * inline, so nothing in the markup can re-flow. A part taller than its box
 * was cropped: the Info card's title and subtitle in a box a fifth of the
 * screen high lost the subtitle. Here the tile is grown on the page to the
 * height its part needs, into the room the stage's Position leaves around the
 * box (`LyricGrowRoomType`, stamped on the html item by the lyric document):
 * up from a box at the bottom, down from one at the top, both ways from a
 * centred one, never past the slide's edge.
 *
 * Measured, because only a laid-out page knows. A tile is a candidate when
 * its section's `scrollHeight` passes its `clientHeight`. That alone over- and
 * under-counts: a part's lines are centred in a body frozen at the box's
 * height, so half of what overflows is above the top where `scrollHeight`
 * never looks; and in Atom Mode the lines box keeps the WHOLE part's frozen
 * height around one line that fits. So the boxes open-lyric sized off the
 * tile are let go (`height: auto`) and the tile's own height is read again:
 * that is what the part needs. A part that fits after all -- an Atom Mode
 * line -- gets its frozen heights back exactly as they were.
 *
 * Batched: every box waiting is read, then written, then read and written
 * once more -- two layouts for a whole pane of cards, not two per card. A
 * box with no room stamped (any html that is not a song's) costs nothing.
 *
 * A leaf on purpose, no imports: the html canvas item's render and the screen
 * manager both call it.
 */

export const LYRIC_GROW_ROOM_ATTR = 'data-lyric-grow-room';
const TILE_CLASSNAME = 'ol-song-view__section-tile';
// The section and the boxes under it open-lyric sizes off the tile rather
// than off their content: the body that centres a part's lines, and the lines
// box itself. Deeper ones are lines and words, already their own size.
const LET_GO_DEPTH = 2;
// Sub-pixel layout rounding is not a cut.
const TOLERANCE_PX = 1;

/** The px of slide above and below a lyric box that it may grow into. */
export type LyricGrowRoomType = {
    up: number;
    down: number;
};

export function genLyricGrowRoomAttr(room: LyricGrowRoomType) {
    const up = Math.max(0, Math.round(room.up));
    const down = Math.max(0, Math.round(room.down));
    return `${up},${down}`;
}

export function parseLyricGrowRoomAttr(
    value: string | null,
): LyricGrowRoomType | null {
    if (!value) {
        return null;
    }
    const [up, down] = value.split(',').map(Number);
    if (!Number.isFinite(up) || !Number.isFinite(down)) {
        return null;
    }
    return { up: Math.max(0, up), down: Math.max(0, down) };
}

type SavedStyleType = {
    element: HTMLElement;
    height: string;
    gridTemplateRows: string;
    transform: string;
};
// What a grown box's elements held before, to give back before the box is
// measured again. Keyed by the box, emptied on every restore: it never holds
// more than the boxes grown on the page.
const savedStylesMap = new WeakMap<HTMLElement, SavedStyleType[]>();

function restoreBox(box: HTMLElement) {
    const savedStyles = savedStylesMap.get(box);
    if (savedStyles === undefined) {
        return;
    }
    for (const saved of savedStyles) {
        saved.element.style.height = saved.height;
        saved.element.style.gridTemplateRows = saved.gridTemplateRows;
        saved.element.style.transform = saved.transform;
    }
    savedStylesMap.delete(box);
}

function saveStyle(element: HTMLElement): SavedStyleType {
    return {
        element,
        height: element.style.height,
        gridTemplateRows: element.style.gridTemplateRows,
        transform: element.style.transform,
    };
}

// Only boxes that hold other elements: a title or a word keeps its height.
function collectLetGoElements(section: HTMLElement) {
    const elements: HTMLElement[] = [section];
    let level = [section];
    for (let depth = 0; depth < LET_GO_DEPTH; depth++) {
        const nextLevel: HTMLElement[] = [];
        for (const element of level) {
            for (const child of Array.from(element.children)) {
                if (
                    child instanceof HTMLElement &&
                    child.childElementCount > 0
                ) {
                    nextLevel.push(child);
                }
            }
        }
        elements.push(...nextLevel);
        level = nextLevel;
    }
    return elements;
}

type CandidateType = {
    box: HTMLElement;
    room: LyricGrowRoomType;
    tile: HTMLElement;
    section: HTMLElement;
    height: number;
};

function readCandidate(box: HTMLElement): CandidateType | null {
    if (!box.isConnected) {
        return null;
    }
    const room = parseLyricGrowRoomAttr(box.getAttribute(LYRIC_GROW_ROOM_ATTR));
    if (room === null || room.up + room.down <= 0) {
        return null;
    }
    const tile = box.firstElementChild;
    if (
        !(tile instanceof HTMLElement) ||
        !tile.classList.contains(TILE_CLASSNAME)
    ) {
        return null;
    }
    const section = tile.firstElementChild;
    if (!(section instanceof HTMLElement)) {
        return null;
    }
    // Zero when not laid out (a hidden pane): nothing to measure yet.
    const clientHeight = section.clientHeight;
    if (
        clientHeight === 0 ||
        section.scrollHeight <= clientHeight + TOLERANCE_PX
    ) {
        return null;
    }
    return { box, room, tile, section, height: tile.offsetHeight };
}

function growCandidate(candidate: CandidateType, neededHeight: number) {
    const { box, room, tile } = candidate;
    const totalRoom = room.up + room.down;
    const growth = Math.min(neededHeight - candidate.height, totalRoom);
    if (growth <= TOLERANCE_PX) {
        restoreBox(box);
        return;
    }
    // The tile sits centred on the box, so it grows evenly both ways; this
    // moves it toward the edge the box is set against, by each side's share
    // of the room.
    const upGrowth = (growth * room.up) / totalRoom;
    const downGrowth = growth - upGrowth;
    const shift = Math.round((downGrowth - upGrowth) / 2);
    tile.style.height = `${candidate.height + growth}px`;
    tile.style.gridTemplateRows = 'minmax(0, 1fr)';
    tile.style.transform = shift === 0 ? '' : `translateY(${shift}px)`;
}

/**
 * Grows every given lyric box whose part is cut, in one read-write pass. A
 * box grown before is put back first, so a box whose room changed (the stage
 * was restyled, the markup kept) is measured as open-lyric drew it.
 */
export function growLyricBoxElements(boxes: HTMLElement[]) {
    boxes.forEach(restoreBox);
    const candidates = boxes
        .map(readCandidate)
        .filter((candidate) => candidate !== null);
    if (candidates.length === 0) {
        return;
    }
    for (const candidate of candidates) {
        const { box, tile, section } = candidate;
        const letGoElements = collectLetGoElements(section);
        savedStylesMap.set(box, [
            saveStyle(tile),
            ...letGoElements.map(saveStyle),
        ]);
        tile.style.height = 'auto';
        tile.style.gridTemplateRows = 'auto';
        for (const element of letGoElements) {
            element.style.height = 'auto';
        }
    }
    // The boxes' own height, and what still scrolls past it: a script's
    // marks above and below its letters ink a few px outside the box they
    // belong to (one measured: the Info title's box 112px, its ink 144px),
    // and a grown box that stopped at the boxes still clipped the subtitle's.
    // Twice that, because the part is centred in its box: only half of
    // what the box grows by lands under it. Plus a px, since each of the
    // three reads is rounded to a whole px.
    const neededHeights = candidates.map(({ tile, section }) => {
        const inkOverflow = Math.max(
            0,
            section.scrollHeight - section.clientHeight,
        );
        return tile.offsetHeight + inkOverflow * 2 + TOLERANCE_PX;
    });
    candidates.forEach((candidate, i) => {
        growCandidate(candidate, neededHeights[i]);
    });
}

/** Every lyric box under `root` -- a slide just put on a screen. */
export function growLyricBoxes(root: ParentNode) {
    const boxes = Array.from(
        root.querySelectorAll<HTMLElement>(`[${LYRIC_GROW_ROOM_ATTR}]`),
    );
    if (boxes.length > 0) {
        growLyricBoxElements(boxes);
    }
}

// The boxes rendered in the commit being made, grown together once it is
// done and before it is painted. Emptied by every flush.
const pendingBoxes = new Set<HTMLElement>();

function flushPendingBoxes() {
    const boxes = Array.from(pendingBoxes);
    pendingBoxes.clear();
    growLyricBoxElements(boxes);
}

/** A rendered lyric box, grown with the rest of the commit's. */
export function scheduleLyricBoxGrow(box: HTMLElement) {
    if (pendingBoxes.size === 0) {
        queueMicrotask(flushPendingBoxes);
    }
    pendingBoxes.add(box);
}
