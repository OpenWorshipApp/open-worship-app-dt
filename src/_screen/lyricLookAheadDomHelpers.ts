import type { CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';
import {
    checkIsLookAheadItems,
    LOOK_AHEAD_BOX_CLASSNAME,
    readLookAheadBoxHtml,
} from '../lyric-list/lyricLookAheadHelpers';
import {
    flushStageMove,
    genRenderId,
    runStageMove,
    setRenderId,
    STAGE_MOVE_TRANSITION,
    type StageMoveStateType,
} from './stageMoveHelpers';

/**
 * A song's stage slide moved into the next one (`St:` 2 and up).
 *
 * Unlike a document's, a song's stage slide is not laid out by the screen: it
 * arrives holding its coming verses itself, each one a canvas item of its own
 * beside the verse being sung (`genLookAheadItemsList`). So what is told
 * apart and moved here is the canvas item -- a verse, a picture, a box's
 * frame -- each under the md5 of what it draws (`genRenderId`): the verse in
 * the coming box of one slide and in the current box of the next is the same
 * html, so it is the same item, kept as it is and given its new place.
 */

// What a look-ahead slide is made of. Nothing in these plays or loads a page,
// so an item drawn for a coming verse is the item drawn when it is sung.
const MOVABLE_ITEM_TYPES = ['html', 'image'];

// A canvas item of a look-ahead slide, as the screen draws it.
type LyricPartType = {
    // Empty for an item that cannot be kept: it never matches another one.
    renderId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    // What a verse's box shows it at (`genLookAheadBoxHtml`). `null` for a
    // picture or a frame, which fill their box whatever its size.
    scale: number | null;
    opacity: number;
};

type LyricSlotType = LyricPartType & { node: HTMLElement };

type LyricStateType = StageMoveStateType & {
    slots: LyricSlotType[];
    // The slide's own size, which the whole layout hangs on.
    width: number;
    height: number;
};

const lyricStateMap = new WeakMap<HTMLElement, LyricStateType>();

/**
 * Where an item goes is its style; everything else about it is what it draws
 * and makes its id. A verse's html is read out of its box first, the box
 * being where and how big.
 */
function toLyricPart(item: CanvasItemPropsType): LyricPartType | null {
    if (!MOVABLE_ITEM_TYPES.includes(item.type)) {
        return null;
    }
    const {
        id: _id,
        uuid: _uuid,
        left,
        top,
        width,
        height,
        html,
        ...data
    } = item as CanvasItemPropsType & { html?: unknown };
    const look = typeof html === 'string' ? readLookAheadBoxHtml(html) : null;
    const drawnHtml = look === null ? html : look.html;
    const dataMap = data as Record<string, unknown>;
    return {
        renderId: genRenderId([
            // On its own: a verse is hundreds of kilobytes of markup, which
            // JSON would copy once more to escape.
            typeof drawnHtml === 'string' ? genRenderId(drawnHtml) : null,
            Object.keys(dataMap)
                .sort()
                .map((key) => [key, dataMap[key]]),
        ]),
        left,
        top,
        width,
        height,
        scale: look?.scale ?? null,
        opacity: look?.opacity ?? 1,
    };
}

function toLyricParts(canvasItems: CanvasItemPropsType[]) {
    const parts: LyricPartType[] = [];
    for (const canvasItem of canvasItems) {
        const part = toLyricPart(canvasItem);
        if (part === null) {
            return null;
        }
        parts.push(part);
    }
    return parts;
}

// The two elements `genLookAheadBoxHtml` puts in a drawn html item: the box
// and, in it, the verse at its own size.
function getLookElements(node: HTMLElement) {
    const box = node.firstElementChild?.firstElementChild;
    const inner = box?.firstElementChild;
    if (
        !(box instanceof HTMLElement) ||
        !box.classList.contains(LOOK_AHEAD_BOX_CLASSNAME) ||
        !(inner instanceof HTMLElement)
    ) {
        return null;
    }
    return { box, inner };
}

// Takes a drawn item in: named by its id, and moved from now on by a change
// of style alone.
function adoptNode(node: HTMLElement, part: LyricPartType): LyricSlotType {
    const look = part.scale === null ? null : getLookElements(node);
    if (part.scale !== null && look === null) {
        // Not the markup expected, so nothing here could resize the verse.
        return { ...part, renderId: '', node };
    }
    setRenderId(node, part.renderId);
    node.style.transition = STAGE_MOVE_TRANSITION;
    if (look !== null) {
        look.box.style.transition = STAGE_MOVE_TRANSITION;
        look.inner.style.transition = STAGE_MOVE_TRANSITION;
    }
    return { ...part, node };
}

function checkIsSamePlace(a: LyricPartType, b: LyricPartType) {
    return (
        a.left === b.left &&
        a.top === b.top &&
        a.width === b.width &&
        a.height === b.height &&
        a.scale === b.scale &&
        a.opacity === b.opacity
    );
}

// Gives `slot` the place `part` asks for; whether it had somewhere to go.
function placeSlot(slot: LyricSlotType, part: LyricPartType) {
    const isMoving = !checkIsSamePlace(slot, part);
    Object.assign(slot.node.style, {
        left: `${part.left}px`,
        top: `${part.top}px`,
        width: `${part.width}px`,
        height: `${part.height}px`,
    });
    const look = part.scale === null ? null : getLookElements(slot.node);
    if (look !== null) {
        look.inner.style.transform = `scale(${part.scale})`;
        look.box.style.opacity = part.opacity < 1 ? `${part.opacity}` : '';
    }
    Object.assign(slot, part);
    return isMoving;
}

/**
 * The item on screen each part is, or `null` for one to draw. Twice over the
 * parts: first the ones already where they are wanted, so of two things drawn
 * the same -- every frame, a chorus sung twice running -- neither is moved
 * for the other to take its place.
 */
function pairLyricParts(slots: LyricSlotType[], parts: LyricPartType[]) {
    const freeSlots = new Set(slots);
    const pairedSlots: (LyricSlotType | null)[] = parts.map(() => null);
    for (const isSamePlaceOnly of [true, false]) {
        parts.forEach((part, i) => {
            if (pairedSlots[i] !== null || part.renderId === '') {
                return;
            }
            for (const slot of freeSlots) {
                if (
                    slot.renderId === part.renderId &&
                    (!isSamePlaceOnly || checkIsSamePlace(slot, part))
                ) {
                    freeSlots.delete(slot);
                    pairedSlots[i] = slot;
                    return;
                }
            }
        });
    }
    return { pairedSlots, freeSlots };
}

/**
 * Takes in a look-ahead slide the screen has just drawn -- `root` is its
 * content, one child per canvas item -- so the next one can be moved to
 * (`moveLyricLookAhead`). `false`, with nothing kept, for any other slide.
 */
export function registerLyricLookAhead(
    root: HTMLElement,
    canvasItems: CanvasItemPropsType[],
    width: number,
    height: number,
) {
    if (
        !checkIsLookAheadItems(canvasItems) ||
        root.children.length !== canvasItems.length
    ) {
        return false;
    }
    const parts = toLyricParts(canvasItems);
    if (parts === null) {
        return false;
    }
    lyricStateMap.set(root, {
        slots: parts.map((part, i) => {
            return adoptNode(root.children[i] as HTMLElement, part);
        }),
        pending: null,
        width,
        height,
    });
    return true;
}

/**
 * Moves the look-ahead slide `root` holds into the one `canvasItems` make,
 * WITHOUT drawing again what both hold: an item of the same id keeps its
 * element and only has its style changed, which `transition: all` turns into
 * the coming verse growing into the current one's place. In the order
 * `runStageMove` keeps.
 *
 * `build` draws the items that are not on screen, one child per item in
 * their order. `false` -- with nothing changed that matters -- when `root` is
 * not such a slide, the next one is not, or nothing on screen stays: the
 * caller then draws the slide anew, a cut as before.
 */
export function moveLyricLookAhead(
    root: HTMLElement,
    canvasItems: CanvasItemPropsType[],
    width: number,
    height: number,
    build: (canvasItems: CanvasItemPropsType[]) => HTMLElement,
): boolean {
    const state = lyricStateMap.get(root);
    if (
        state === undefined ||
        state.width !== width ||
        state.height !== height ||
        !checkIsLookAheadItems(canvasItems)
    ) {
        return false;
    }
    const parts = toLyricParts(canvasItems);
    if (parts === null) {
        return false;
    }
    flushStageMove(state);
    const { pairedSlots, freeSlots } = pairLyricParts(state.slots, parts);
    const stayingSlots = pairedSlots.filter((slot) => slot !== null);
    if (stayingSlots.length === 0) {
        return false;
    }
    runStageMove(root, state, {
        remove: () => {
            for (const slot of freeSlots) {
                slot.node.remove();
            }
            state.slots = stayingSlots;
        },
        restyle: () => {
            let isMoving = false;
            parts.forEach((part, i) => {
                const slot = pairedSlots[i];
                if (slot !== null && placeSlot(slot, part)) {
                    isMoving = true;
                }
            });
            return isMoving;
        },
        add:
            stayingSlots.length === parts.length
                ? null
                : () => {
                      const comingNodes = Array.from(
                          build(
                              canvasItems.filter((_, i) => {
                                  return pairedSlots[i] === null;
                              }),
                          ).children,
                      );
                      // From the last one back, each new item goes in before
                      // the one that follows it in the slide: the frames are
                      // its last items, and stay over every verse's own fill.
                      let nextNode: HTMLElement | null = null;
                      const slots: LyricSlotType[] = [];
                      for (let i = parts.length - 1; i >= 0; i--) {
                          let slot = pairedSlots[i];
                          if (slot === null) {
                              const node = comingNodes.pop();
                              if (!(node instanceof HTMLElement)) {
                                  continue;
                              }
                              root.insertBefore(node, nextNode);
                              slot = adoptNode(node, parts[i]);
                          }
                          nextNode = slot.node;
                          slots.unshift(slot);
                      }
                      state.slots = slots;
                  },
    });
    return true;
}
