/**
 * Stages for every document that is not a song: a slide document, a PDF, a
 * PowerPoint or a Word file. A screen's `St:` number, and a Stage Previewer
 * pane, pick how a slide is DRAWN -- the slide itself never changes, so a
 * click, a drag, the on-screen highlight and the slide's media all keep
 * working on the real slide.
 *
 * The layouts are the song stages' own (`lyricLookAheadHelpers`), so a singer
 * reading the stage monitor sees a document the way they see a song:
 *
 * - 0: the slide as it is -- nothing here runs at all.
 * - 1: the slide, with its place in the document in the corner (`3/12`).
 * - 2: the slide large, the next one smaller under it.
 * - 3: the same, with the next two.
 * - 4: stage 2 without the corner count, for an audience.
 * - 5: the previous slide, the slide, the next one on a diagonal.
 * - 6 and up: stage 1, as songs fall back.
 *
 * The slides around it are at full opacity, as a song's now are too: the user
 * asked for the coming slide un-faded (2026-10-06).
 *
 * Kept free of runtime imports beyond two leaves: the projector imports it.
 */

import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    BLANK_HTML_SLIDE_SRC,
    BLANK_IMAGE_SLIDE_SRC,
} from '../../app-document-list/blankSlideConstants';
import {
    genRowArrangement,
    getLookAheadFrameMetrics,
    getLookAheadNextOpacity,
    PREVIOUS_NEXT_ARRANGEMENT,
    type LookAheadArrangementType,
    type LookAheadBoundsType,
    type LookAheadLayoutType,
} from '../../lyric-list/lyricLookAheadHelpers';

export type DocumentStageDefinitionType = {
    // Which slides go beside the current one and where; `null` draws the
    // current slide alone, full size.
    arrangement: LookAheadArrangementType | null;
    isShowingIndex: boolean;
};

const INDEX_ONLY_STAGE: DocumentStageDefinitionType = {
    arrangement: null,
    isShowingIndex: true,
};

const DOCUMENT_STAGE_DEFINITIONS: (DocumentStageDefinitionType | null)[] = [
    null,
    INDEX_ONLY_STAGE,
    { arrangement: genRowArrangement([1]), isShowingIndex: true },
    { arrangement: genRowArrangement([1, 2]), isShowingIndex: true },
    { arrangement: genRowArrangement([1]), isShowingIndex: false },
    { arrangement: PREVIOUS_NEXT_ARRANGEMENT, isShowingIndex: true },
];

/**
 * How a slide is drawn on `stage`, or `null` when it is drawn as it is --
 * stage 0, and anything that is not a stage number at all.
 */
export function getDocumentStageDefinition(stage: number) {
    if (!Number.isInteger(stage) || stage <= 0) {
        return null;
    }
    return DOCUMENT_STAGE_DEFINITIONS[stage] ?? INDEX_ONLY_STAGE;
}

/**
 * The slide 0 a PDF, PowerPoint or Word document leads with. It is a real
 * slide to present -- a blank screen -- but not a page of the document, so it
 * takes no number in the corner count.
 */
export function checkIsBlankLeadSlide(varySlide: VarySlideType) {
    if (varySlide.id !== 0) {
        return false;
    }
    const json = varySlide.toJson() as {
        imagePreviewSrc?: unknown;
        htmlFilePath?: unknown;
    };
    return (
        json.imagePreviewSrc === BLANK_IMAGE_SLIDE_SRC ||
        json.htmlFilePath === BLANK_HTML_SLIDE_SRC
    );
}

function getSubSlides(varySlide: VarySlideType): VarySlideType[] {
    // A PowerPoint slide's animation steps. Read ONCE: the getter builds new
    // slides on every read.
    const subSlides = (varySlide as { subSlides?: unknown }).subSlides;
    return Array.isArray(subSlides) ? subSlides : [];
}

export type StageDeckType = {
    // Every slide the arrow keys can step onto, in the order they do.
    list: VarySlideType[];
    indexById: Map<number, number>;
    // The corner count's number for a slide; a PowerPoint animation step
    // shares its slide's.
    numberById: Map<number, number>;
    total: number;
};

/**
 * A document's slides as the arrow keys walk them (`findNextSlide`): a
 * PowerPoint slide's animation steps in place after it, disabled slides left
 * out. "What comes next" on a stage is what the next press will put up.
 */
export function toStageDeck(varySlides: VarySlideType[]): StageDeckType {
    const list: VarySlideType[] = [];
    const indexById = new Map<number, number>();
    const numberById = new Map<number, number>();
    let total = 0;
    for (const varySlide of varySlides) {
        if (varySlide.isDisabled) {
            continue;
        }
        const isCounted = !checkIsBlankLeadSlide(varySlide);
        if (isCounted) {
            total += 1;
        }
        for (const step of [varySlide, ...getSubSlides(varySlide)]) {
            indexById.set(step.id, list.length);
            list.push(step);
            if (isCounted) {
                numberById.set(step.id, total);
            }
        }
    }
    return { list, indexById, numberById, total };
}

/**
 * The slide at each of `offsets` from slide `id`, or `null` where that falls
 * off either end of the document (or `id` is not in it).
 */
export function resolveStageSides(
    deck: StageDeckType,
    id: number,
    offsets: number[],
) {
    const index = deck.indexById.get(id);
    return offsets.map((offset) => {
        if (index === undefined) {
            return null;
        }
        return deck.list[index + offset] ?? null;
    });
}

/**
 * The corner count: `3/12`, or `Welcome · 3/12` for a slide with a name.
 * `null` for a slide that takes no number (the blank lead slide).
 */
export function genStageIndexLabel(
    deck: StageDeckType,
    varySlide: VarySlideType,
) {
    const number = deck.numberById.get(varySlide.id);
    if (number === undefined) {
        return null;
    }
    const count = `${number}/${deck.total}`;
    const name = (varySlide.name ?? '').trim();
    return name === '' ? count : `${name} · ${count}`;
}

// What a side box carries of a slide: its words and pictures. A video, a
// YouTube clip, a web page, a camera or a sound would be loaded and PLAYED a
// second time for a glimpse -- the same rule as a song's side boxes.
const SIDE_CANVAS_ITEM_TYPES = ['text', 'html', 'image', 'bible'];

export function filterSideCanvasItems<T extends { type: string }>(items: T[]) {
    return items.filter((item) => {
        return SIDE_CANVAS_ITEM_TYPES.includes(item.type);
    });
}

/**
 * Where the current slide and its side slides sit, for a `width` x `height`
 * slide drawn in a `stageWidth` x `stageHeight` area (the slide itself by
 * default, a whole screen on the projector).
 *
 * The arrangement lays its boxes out in the slide's own proportions, and the
 * boxes together are then grown to fill the area from its top left corner,
 * with no margin: a 16:9 slide on a 16:10 screen used to be fitted first and
 * arranged inside that, which left a band above the slide and another under
 * the next one -- room the slides now take instead (asked for by the user: "I
 * need it bigger, cut those space", then "make align left, margin 0 for
 * current and next slide"). With no arrangement the current slide fills it.
 */
export function genDocumentStageLayout(
    definition: DocumentStageDefinitionType,
    width: number,
    height: number,
    stageWidth = width,
    stageHeight = height,
): LookAheadLayoutType {
    const bounds: LookAheadBoundsType = { x: 0, y: 0, width, height };
    const layout: LookAheadLayoutType =
        definition.arrangement === null
            ? { current: bounds, sideList: [], currentScale: 1, sideScale: 1 }
            : definition.arrangement.genLayout(bounds);
    const boxes = [layout.current, ...layout.sideList];
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    if (right <= left || bottom <= top) {
        return layout;
    }
    const scale = Math.min(
        stageWidth / (right - left),
        stageHeight / (bottom - top),
    );
    const toStageBox = (box: LookAheadBoundsType): LookAheadBoundsType => {
        return {
            x: Math.round((box.x - left) * scale),
            y: Math.round((box.y - top) * scale),
            width: Math.round(box.width * scale),
            height: Math.round(box.height * scale),
        };
    };
    return {
        current: toStageBox(layout.current),
        sideList: layout.sideList.map(toStageBox),
        currentScale: layout.currentScale * scale,
        sideScale: layout.sideScale * scale,
    };
}

/**
 * How dim the side box at `offset` is: by its distance from the current slide
 * when the arrangement dims, else not at all.
 */
export function getStageSideOpacity(
    definition: DocumentStageDefinitionType,
    offset: number,
) {
    if (definition.arrangement?.isDimmed !== true) {
        return 1;
    }
    return getLookAheadNextOpacity(Math.abs(offset) - 1);
}

/**
 * A slide of its own size shrunk to fit `box`, centred in it. Side slides of
 * a PDF can be pages of another shape than the current one.
 */
export function fitSlideIntoBox(
    box: LookAheadBoundsType,
    width: number,
    height: number,
) {
    if (width <= 0 || height <= 0) {
        return { left: 0, top: 0, scale: 1 };
    }
    const scale = Math.min(box.width / width, box.height / height);
    return {
        left: Math.round((box.width - width * scale) / 2),
        top: Math.round((box.height - height * scale) / 2),
        scale,
    };
}

type StyleType = Record<string, string>;

export function genStageBoxStyle(
    box: LookAheadBoundsType,
    opacity = 1,
): StyleType {
    return {
        position: 'absolute',
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        overflow: 'hidden',
        ...(opacity < 1 ? { opacity: `${opacity}` } : {}),
    };
}

// What goes inside a box: the slide at its own size, shrunk from its top left.
export function genStageContentStyle(
    width: number,
    height: number,
    scale: number,
    left = 0,
    top = 0,
): StyleType {
    return {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
    };
}

// The song stages' frame, so a box is there even when its slide is blank.
export function genStageFrameStyle(
    box: LookAheadBoundsType,
    slideHeight: number,
    opacity = 1,
): StyleType {
    const { width, radius, color } = getLookAheadFrameMetrics(slideHeight);
    return {
        ...genStageBoxStyle(box, opacity),
        boxSizing: 'border-box',
        border: `${width}px solid ${color}`,
        borderRadius: `${radius}px`,
        pointerEvents: 'none',
    };
}

// The corner count's size, as a share of its box's height: ~86px on a full
// 1080p stage-1 slide, and still readable on the smaller coming slides, whose
// boxes carry their own count (asked for bigger: "make the index bigger,
// background 0.5 opacity").
const INDEX_FONT_RATIO = 0.08;
const INDEX_GAP_RATIO = 0.012;

/**
 * The corner count, at the bottom right of the current slide's `box` -- set
 * inside an element laid out by `genStageBoxStyle(box)`. Light text on a
 * small translucent dark pill: a halo alone was faint on a white slide (seen
 * on the mini screen), and the pill reads on white, black and a picture alike
 * while covering only its own corner.
 */
export function genStageIndexStyle(box: LookAheadBoundsType): StyleType {
    const fontSize = Math.max(8, Math.round(box.height * INDEX_FONT_RATIO));
    const gap = Math.round(box.height * INDEX_GAP_RATIO);
    const padding = Math.round(fontSize * 0.3);
    return {
        position: 'absolute',
        right: `${gap}px`,
        bottom: `${gap}px`,
        maxWidth: `${Math.max(0, box.width - gap * 2)}px`,
        boxSizing: 'border-box',
        padding: `0 ${padding}px`,
        borderRadius: `${padding}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        fontSize: `${fontSize}px`,
        lineHeight: '1.3',
        fontFamily: 'sans-serif',
        color: 'rgba(245, 245, 245, 0.95)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none',
    };
}
