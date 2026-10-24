import type { SlidePropsType } from '../app-document-list/Slide';
import type { PdfSlidePropsType } from '../app-document-list/PdfSlide';
import PdfSlide from '../app-document-list/PdfSlide';
import type { PptxSlidePropsType } from '../app-document-list/PptxSlide';
import PptxSlide from '../app-document-list/PptxSlide';
import type { DocxSlidePropsType } from '../app-document-list/DocxSlide';
import DocxSlide from '../app-document-list/DocxSlide';
import type { VarySlideDataType } from '../app-document-list/appDocumentTypeHelpers';
import { genPdfSlide } from '../app-document-presenter/items/PdfSlideRenderComp';
import { genPptxSlide } from '../app-document-presenter/items/PptxSlideRenderComp';
import { genDocxSlide } from '../app-document-presenter/items/DocxSlideRenderComp';
import { genSlideHtml } from '../app-document-presenter/items/SlideRendererComp';
import {
    filterSideCanvasItems,
    fitSlideIntoBox,
    genDocumentStageLayout,
    genStageBoxStyle,
    genStageContentStyle,
    genStageFrameStyle,
    genStageIndexStyle,
    getDocumentStageDefinition,
    getStageSideOpacity,
} from '../app-document-presenter/stage/documentStageHelpers';
import type { StageLookAheadDataType } from './screenAppDocumentTypeHelpers';
import type { LookAheadBoundsType } from '../lyric-list/lyricLookAheadHelpers';
import {
    flushStageMove,
    genRenderId,
    runStageMove,
    setRenderId,
    STAGE_MOVE_TRANSITION,
    type StageMoveStateType,
} from './stageMoveHelpers';

export { STAGE_MOVE_MILLISECOND } from './stageMoveHelpers';

/**
 * The projector's half of a document stage: the same layout a Stage Previewer
 * card draws (`StageLookAheadComp`), from the same helpers, built as plain DOM
 * the way the screen builds every slide.
 *
 * A layout that is already on screen can also be MOVED into the next one
 * (`moveStageLookAhead`): the slides both hold keep their elements and only
 * have their style changed, so the coming slide is seen growing into the
 * presented one's place instead of being cut to. A song's stage slide holds
 * its coming verses itself and is moved by `lyricLookAheadDomHelpers`.
 */

type StyleType = Record<string, string>;

function genStyledDiv(style: StyleType) {
    const div = document.createElement('div');
    Object.assign(div.style, style);
    return div;
}

// A part of a slide's place on the stage: styled when it is placed, and again
// every time its slide is moved.
function genMovingDiv() {
    return genStyledDiv({ transition: STAGE_MOVE_TRANSITION });
}

function applyStageStyle(element: HTMLElement, style: StyleType) {
    Object.assign(element.style, style);
    if (style.opacity === undefined) {
        // The style helpers leave `opacity` off at 1.
        element.style.opacity = '';
    }
}

function queryAllDeep(root: ParentNode, selector: string): Element[] {
    const results = Array.from(root.querySelectorAll(selector));
    for (const element of Array.from(root.querySelectorAll('*'))) {
        if (element instanceof HTMLElement && element.shadowRoot !== null) {
            results.push(...queryAllDeep(element.shadowRoot, selector));
        }
    }
    return results;
}

/**
 * Nothing in `content` plays, loads a page or is painted for the presented
 * slide alone (the preview colour behind a PDF or Word page). The box of a
 * coming slide and the presented one then draw it the same, so one can become
 * the other without being drawn again.
 */
function checkIsPlain(content: HTMLElement) {
    return (
        content.style.backgroundColor === '' &&
        queryAllDeep(content, 'video, audio, iframe').length === 0
    );
}

// A slide as it is drawn: at its own size, before its box shrinks it.
type StageDrawnType = {
    content: HTMLElement;
    width: number;
    height: number;
    isPlain: boolean;
};

/**
 * A side slide's content at its own size, or `null` when there is nothing to
 * draw. Never anything that plays: canvas media is filtered out before it gets
 * here, and the media a PowerPoint or Word page embeds is taken out after.
 */
function genSideContent(itemJson: VarySlideDataType): StageDrawnType | null {
    if (PdfSlide.tryValidate(itemJson)) {
        const json = itemJson as PdfSlidePropsType;
        if (!json.imagePreviewSrc) {
            return null;
        }
        return {
            content: genPdfSlide(json.imagePreviewSrc),
            ...json.metadata,
            isPlain: true,
        };
    }
    let content: HTMLElement;
    let size: { width: number; height: number };
    // Whether the box draws all of the slide, nothing of it left out.
    let isWhole = true;
    if (PptxSlide.tryValidate(itemJson)) {
        const json = itemJson as PptxSlidePropsType;
        size = json.metadata;
        content = genPptxSlide(
            json.html,
            json.htmlFilePath,
            size.width,
            size.height,
        );
    } else if (DocxSlide.tryValidate(itemJson)) {
        const json = itemJson as DocxSlidePropsType;
        size = json.metadata;
        content = genDocxSlide(
            json.html,
            json.htmlFilePath,
            size.width,
            size.height,
            size.width,
        );
    } else {
        const json = itemJson as SlidePropsType;
        if (!Array.isArray(json.canvasItems) || !json.metadata) {
            return null;
        }
        size = json.metadata;
        const canvasItems = filterSideCanvasItems(json.canvasItems);
        isWhole = canvasItems.length === json.canvasItems.length;
        content = genSlideHtml(canvasItems);
    }
    const isPlain = isWhole && checkIsPlain(content);
    for (const media of isPlain ? [] : queryAllDeep(content, 'video, audio')) {
        media.remove();
    }
    return { content, width: size.width, height: size.height, isPlain };
}

/**
 * A drawn slide's id (`genRenderId`): which slide it is and what it draws, so
 * a slide edited since is drawn again. A coming slide's is worked out from
 * what its box is handed, which is the slide itself unless something in it
 * plays (`toSideItemJson`). The md5 rather than the data, which a slide with
 * a picture in it would otherwise keep a second copy of for as long as it is
 * on screen.
 */
function genStageSlideKey(itemJson: VarySlideDataType) {
    const json = itemJson as {
        id: number;
        metadata?: unknown;
        canvasItems?: unknown;
        imagePreviewSrc?: string;
        htmlFilePath?: string;
        html?: string;
    };
    return genRenderId([
        json.id,
        json.metadata,
        json.canvasItems ??
            json.imagePreviewSrc ?? [json.htmlFilePath, json.html?.length],
    ]);
}

// A slide the stage wants on screen, and where.
type StagePlaceType = {
    // `null` for a slide nobody named: it is never taken for another one.
    id: number | null;
    key: string | null;
    isCurrent: boolean;
    bounds: LookAheadBoundsType;
    opacity: number;
    isFramed: boolean;
    label: string | null;
    // A coming slide's own data; the presented one is handed over built.
    itemJson: VarySlideDataType | null;
};

type StageSceneType = {
    // The presented slide's own size, and the scale its box shows it at.
    width: number;
    height: number;
    currentScale: number;
    stageHeight: number;
    places: StagePlaceType[];
};

function genStageScene(
    width: number,
    height: number,
    data: StageLookAheadDataType,
    stageWidth: number,
    stageHeight: number,
    itemJson?: VarySlideDataType,
): StageSceneType | null {
    const definition = getDocumentStageDefinition(data.stage);
    if (
        definition === null ||
        width <= 0 ||
        height <= 0 ||
        stageWidth <= 0 ||
        stageHeight <= 0
    ) {
        return null;
    }
    const layout = genDocumentStageLayout(
        definition,
        width,
        height,
        stageWidth,
        stageHeight,
    );
    const places: StagePlaceType[] = [
        {
            id: itemJson?.id ?? null,
            key: itemJson === undefined ? null : genStageSlideKey(itemJson),
            isCurrent: true,
            bounds: layout.current,
            opacity: 1,
            isFramed: definition.arrangement !== null,
            label: definition.isShowingIndex ? data.label : null,
            itemJson: null,
        },
    ];
    layout.sideList.forEach((bounds, i) => {
        const side = data.sideList[i] ?? null;
        if (side === null) {
            return;
        }
        places.push({
            id: side.itemJson.id,
            key: genStageSlideKey(side.itemJson),
            isCurrent: false,
            bounds,
            opacity: getStageSideOpacity(definition, side.offset),
            // The frame says a slide comes next even when it is blank or
            // cannot be drawn.
            isFramed: true,
            label:
                definition.isShowingIndex && typeof side.label === 'string'
                    ? side.label
                    : null,
            itemJson: side.itemJson,
        });
    });
    return {
        width,
        height,
        currentScale: layout.currentScale,
        stageHeight,
        places,
    };
}

// A slide as the stage holds it: its box, its frame and its corner count, all
// three laid out on the same bounds.
type StageSlotType = {
    id: number | null;
    key: string | null;
    isCurrent: boolean;
    bounds: LookAheadBoundsType;
    // `null` while there is nothing to draw: a blank slide keeps its frame.
    box: HTMLDivElement | null;
    inner: HTMLDivElement | null;
    width: number;
    height: number;
    isPlain: boolean;
    frame: HTMLDivElement | null;
    labelBox: HTMLDivElement | null;
};

type StageStateType = StageMoveStateType & {
    slots: StageSlotType[];
    // Boxes go before `frameMark`, frames before `labelMark` and counts last,
    // so a slide's own background fill cannot cover a frame or a count --
    // whenever its slide is added.
    frameMark: Comment;
    labelMark: Comment;
};

const stageStateMap = new WeakMap<HTMLElement, StageStateType>();

/**
 * Whether what `slot` holds is what `place` draws, so it is kept as it is and
 * only moved. `current` is the presented slide freshly built, or `null` when
 * the caller did not build it.
 */
function checkIsKeeping(
    slot: StageSlotType,
    place: StagePlaceType,
    current: StageDrawnType | null,
) {
    if (slot.box === null || slot.key === null || slot.key !== place.key) {
        return false;
    }
    if (!slot.isCurrent && !place.isCurrent) {
        return true;
    }
    // Into or out of the presented box, which alone holds what plays.
    return (
        slot.isPlain &&
        (!place.isCurrent || current === null || current.isPlain)
    );
}

function setSlotContent(
    root: HTMLElement,
    state: StageStateType,
    slot: StageSlotType,
    drawn: StageDrawnType | null,
) {
    if (drawn === null) {
        slot.box?.remove();
        slot.box = null;
        slot.inner = null;
        slot.isPlain = false;
        return;
    }
    if (slot.box === null || slot.inner === null) {
        slot.box = genMovingDiv();
        slot.inner = genMovingDiv();
        slot.box.appendChild(slot.inner);
        root.insertBefore(slot.box, state.frameMark);
    }
    slot.inner.replaceChildren(drawn.content);
    slot.width = drawn.width;
    slot.height = drawn.height;
    slot.isPlain = drawn.isPlain;
}

// A slide's frame and its count are drawn from its slide and their own kind.
function genPartRenderId(key: string | null, part: string) {
    return key === null ? null : genRenderId([key, part]);
}

/**
 * Brings `slot` to what `place` asks for. Its elements are made the first time
 * and from then on only restyled, which is what the browser animates.
 */
function placeStageSlot(
    root: HTMLElement,
    state: StageStateType,
    slot: StageSlotType,
    place: StagePlaceType,
    scene: StageSceneType,
    current: StageDrawnType | null,
) {
    if (!checkIsKeeping(slot, place, current)) {
        setSlotContent(
            root,
            state,
            slot,
            place.itemJson === null ? current : genSideContent(place.itemJson),
        );
    }
    const { bounds, opacity } = place;
    slot.id = place.id;
    slot.key = place.key;
    slot.isCurrent = place.isCurrent;
    slot.bounds = bounds;
    if (slot.box !== null && slot.inner !== null) {
        setRenderId(slot.box, slot.key);
        applyStageStyle(slot.box, genStageBoxStyle(bounds, opacity));
        // Side slides of a PDF can be pages of another shape than their box.
        const fit = place.isCurrent
            ? { scale: scene.currentScale, left: 0, top: 0 }
            : fitSlideIntoBox(bounds, slot.width, slot.height);
        applyStageStyle(
            slot.inner,
            genStageContentStyle(
                slot.width,
                slot.height,
                fit.scale,
                fit.left,
                fit.top,
            ),
        );
    }
    if (place.isFramed) {
        if (slot.frame === null) {
            slot.frame = genMovingDiv();
            root.insertBefore(slot.frame, state.labelMark);
        }
        setRenderId(slot.frame, genPartRenderId(slot.key, 'frame'));
        applyStageStyle(
            slot.frame,
            genStageFrameStyle(bounds, scene.stageHeight, opacity),
        );
    } else {
        slot.frame?.remove();
        slot.frame = null;
    }
    if (place.label === null) {
        slot.labelBox?.remove();
        slot.labelBox = null;
        return;
    }
    // A slide's corner count, at the bottom right of its box.
    if (slot.labelBox === null) {
        slot.labelBox = genMovingDiv();
        const label = genMovingDiv();
        label.className = 'stage-look-ahead-index';
        slot.labelBox.appendChild(label);
        root.appendChild(slot.labelBox);
    }
    setRenderId(
        slot.labelBox,
        genPartRenderId(slot.key, `count:${place.label}`),
    );
    applyStageStyle(slot.labelBox, {
        ...genStageBoxStyle(bounds),
        pointerEvents: 'none',
    });
    const label = slot.labelBox.firstElementChild as HTMLElement;
    applyStageStyle(label, genStageIndexStyle(bounds));
    // Only when it says something else: writing the same count again would
    // still swap its text for a new node.
    if (label.textContent !== place.label) {
        label.textContent = place.label;
    }
}

function addStageSlots(
    root: HTMLElement,
    state: StageStateType,
    places: StagePlaceType[],
    scene: StageSceneType,
    current: StageDrawnType | null,
) {
    for (const place of places) {
        const slot: StageSlotType = {
            id: null,
            key: null,
            isCurrent: false,
            bounds: place.bounds,
            box: null,
            inner: null,
            width: 0,
            height: 0,
            isPlain: false,
            frame: null,
            labelBox: null,
        };
        placeStageSlot(root, state, slot, place, scene, current);
        state.slots.push(slot);
    }
}

function removeStageSlot(slot: StageSlotType) {
    slot.box?.remove();
    slot.frame?.remove();
    slot.labelBox?.remove();
}

function checkIsSameBounds(a: LookAheadBoundsType, b: LookAheadBoundsType) {
    return (
        a.x === b.x &&
        a.y === b.y &&
        a.width === b.width &&
        a.height === b.height
    );
}

function toStageDrawn(
    content: HTMLElement | null,
    scene: StageSceneType,
): StageDrawnType | null {
    if (content === null) {
        return null;
    }
    return {
        content,
        width: scene.width,
        height: scene.height,
        isPlain: checkIsPlain(content),
    };
}

/**
 * `content` -- the slide the screen just built, at its own `width` x `height`
 * -- set into its stage's layout: in the current box, the slides around it in
 * theirs, and each one's corner count. `null` when the stage draws the slide as it
 * is, and the caller then shows `content` untouched.
 *
 * `itemJson` names the slide, so the layout can later be moved into the next
 * one (`moveStageLookAhead`).
 */
export function wrapWithStageLookAhead(
    content: HTMLElement,
    width: number,
    height: number,
    data: StageLookAheadDataType,
    // The area the layout fills -- the whole screen on the projector, so a
    // slide of another shape than the screen leaves no bands around it.
    stageWidth = width,
    stageHeight = height,
    itemJson?: VarySlideDataType,
): HTMLDivElement | null {
    const scene = genStageScene(
        width,
        height,
        data,
        stageWidth,
        stageHeight,
        itemJson,
    );
    if (scene === null) {
        return null;
    }
    const root = genStyledDiv({
        position: 'relative',
        width: `${stageWidth}px`,
        height: `${stageHeight}px`,
        overflow: 'hidden',
    });
    const state: StageStateType = {
        slots: [],
        frameMark: document.createComment(''),
        labelMark: document.createComment(''),
        pending: null,
    };
    root.append(state.frameMark, state.labelMark);
    stageStateMap.set(root, state);
    addStageSlots(
        root,
        state,
        scene.places,
        scene,
        toStageDrawn(content, scene),
    );
    return root;
}

/**
 * Moves the layout `root` holds (one `wrapWithStageLookAhead` made, for the
 * same stage area) into the one for the slide now presented, WITHOUT drawing
 * again what is already there: a slide both layouts hold keeps its elements
 * and only has their style changed, which `transition: all` turns into the
 * slide travelling to its new place and size.
 *
 * In the order `runStageMove` keeps: the slides that leave are taken out, the
 * style of the ones that stay is changed, and the ones that come in are added
 * once those have arrived.
 *
 * `content` is the presented slide freshly built, or `null` when the caller
 * did not build it and counts on the one on screen. `false` -- with nothing
 * changed that matters -- when no slide on screen stays, or that one cannot
 * be kept: the caller then draws the layout anew, a cut as before.
 */
export function moveStageLookAhead(
    root: HTMLElement,
    content: HTMLElement | null,
    width: number,
    height: number,
    data: StageLookAheadDataType,
    stageWidth: number,
    stageHeight: number,
    itemJson: VarySlideDataType,
): boolean {
    const state = stageStateMap.get(root);
    const scene = genStageScene(
        width,
        height,
        data,
        stageWidth,
        stageHeight,
        itemJson,
    );
    if (state === undefined || scene === null) {
        return false;
    }
    flushStageMove(state);
    const current = toStageDrawn(content, scene);
    const freeSlots = new Set(state.slots);
    const stayingList: [StageSlotType, StagePlaceType][] = [];
    const comingPlaces: StagePlaceType[] = [];
    for (const place of scene.places) {
        const slot =
            place.id === null
                ? undefined
                : Array.from(freeSlots).find((freeSlot) => {
                      return freeSlot.id === place.id;
                  });
        if (slot === undefined) {
            comingPlaces.push(place);
            continue;
        }
        freeSlots.delete(slot);
        stayingList.push([slot, place]);
    }
    if (stayingList.length === 0) {
        return false;
    }
    if (current === null) {
        const isCurrentKept = stayingList.some(([slot, place]) => {
            return place.isCurrent && checkIsKeeping(slot, place, null);
        });
        if (!isCurrentKept) {
            return false;
        }
    }
    runStageMove(root, state, {
        remove: () => {
            for (const slot of freeSlots) {
                removeStageSlot(slot);
            }
            state.slots = stayingList.map(([slot]) => slot);
        },
        restyle: () => {
            let isMoving = false;
            for (const [slot, place] of stayingList) {
                isMoving ||= !checkIsSameBounds(slot.bounds, place.bounds);
                placeStageSlot(root, state, slot, place, scene, current);
            }
            return isMoving;
        },
        add:
            comingPlaces.length === 0
                ? null
                : () => {
                      addStageSlots(root, state, comingPlaces, scene, current);
                  },
    });
    return true;
}
