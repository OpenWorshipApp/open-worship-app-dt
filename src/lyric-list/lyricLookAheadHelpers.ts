/**
 * The look-ahead stage layout: the section being sung large across the top,
 * and the next one or two under it — smaller and dimmer, so a singer on the
 * back stage can see what is coming without it pulling the eye off the words
 * they are singing now.
 *
 * Kept free of imports on purpose: it is pure geometry, and the stage classes
 * sit inside the `lyricHelpers → stage → LyricAppDocument` cycle.
 */

export type LookAheadBoundsType = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type LookAheadLayoutType = {
    current: LookAheadBoundsType;
    // One box per SIDE slide, in the order of the arrangement's `offsets`.
    sideList: LookAheadBoundsType[];
    // Every box is the WHOLE slide shrunk, never cropped or stretched: the
    // sections are rendered once at the slide's own size (exactly as stage 1
    // renders them) and each box shows that render scaled down (see
    // `genLookAheadBoxHtml`), so it looks like the full slide, only smaller.
    currentScale: number;
    sideScale: number;
};

// The gap between boxes, as a share of the slide's content height.
const GAP_RATIO = 0.02;
// An upcoming box is this much of the current one — small enough that the
// current section stays the thing the eye goes to. It puts the current slide
// at ~60% of the full slide and an upcoming one at ~38%, as sketched.
const NEXT_TO_CURRENT_RATIO = 0.63;

/**
 * How dim each side box is, by its distance from the current slide, nearest
 * first. Opacity rather than a colour
 * change, so it lowers the contrast against whatever the stage is drawn on —
 * a theme, a background fill, a video — without knowing what that is.
 */
const NEXT_OPACITY_LIST = [0.5, 0.35];

export function getLookAheadNextOpacity(nextIndex: number) {
    return (
        NEXT_OPACITY_LIST[nextIndex] ??
        NEXT_OPACITY_LIST[NEXT_OPACITY_LIST.length - 1]
    );
}

/**
 * The current slide at the top left, the upcoming ones under it side by side
 * from the left — all in the slide's own proportions. The current slide plus
 * one row fills the height; a row too wide for the slide (three or more
 * upcoming boxes) shrinks its boxes to fit rather than spilling off.
 */
export function genLookAheadLayout(
    bounds: LookAheadBoundsType,
    lookAheadCount: number,
): LookAheadLayoutType {
    const count = Math.max(1, Math.trunc(lookAheadCount));
    const gap = Math.round(bounds.height * GAP_RATIO);
    const currentScale =
        (bounds.height - gap) / (bounds.height * (1 + NEXT_TO_CURRENT_RATIO));
    const sideScale = Math.min(
        currentScale * NEXT_TO_CURRENT_RATIO,
        (bounds.width - gap * (count - 1)) / (bounds.width * count),
    );
    const currentHeight = Math.round(bounds.height * currentScale);
    const nextWidth = Math.round(bounds.width * sideScale);
    const nextTop = bounds.y + currentHeight + gap;
    return {
        current: {
            x: bounds.x,
            y: bounds.y,
            width: Math.round(bounds.width * currentScale),
            height: currentHeight,
        },
        sideList: Array.from({ length: count }, (_, i) => {
            return {
                x: bounds.x + i * (nextWidth + gap),
                y: nextTop,
                width: nextWidth,
                height: Math.round(bounds.height * sideScale),
            };
        }),
        currentScale,
        sideScale,
    };
}

/**
 * The previous slide small at the top left, the current one large beside it
 * and the next small at the bottom right -- so the three read on a diagonal,
 * in the order they are sung, and the current slide sits BETWEEN the other
 * two (previous and next side by side under it read as two upcoming slides).
 * Every box keeps the slide's proportions; a side box plus the current slide
 * span the full width AND the full height.
 */
export function genPreviousNextLayout(
    bounds: LookAheadBoundsType,
): LookAheadLayoutType {
    const gap = Math.round(bounds.height * GAP_RATIO);
    // side + gap + current fills both axes; the slide's own ratio makes the
    // two constraints the same one.
    const currentScale =
        (bounds.height - gap) / (bounds.height * (1 + NEXT_TO_CURRENT_RATIO));
    const sideScale = currentScale * NEXT_TO_CURRENT_RATIO;
    const sideWidth = Math.round(bounds.width * sideScale);
    const sideHeight = Math.round(bounds.height * sideScale);
    const currentWidth = Math.round(bounds.width * currentScale);
    const currentHeight = Math.round(bounds.height * currentScale);
    const right = bounds.x + bounds.width;
    return {
        current: {
            x: right - currentWidth,
            y: bounds.y,
            width: currentWidth,
            height: currentHeight,
        },
        sideList: [
            // previous
            {
                x: bounds.x,
                y: bounds.y,
                width: sideWidth,
                height: sideHeight,
            },
            // next
            {
                x: right - sideWidth,
                y: bounds.y + currentHeight + gap,
                width: sideWidth,
                height: sideHeight,
            },
        ],
        currentScale,
        sideScale,
    };
}

/**
 * WHICH slides go beside the current one -- `offsets` from it in the deck,
 * `1` the next, `-1` the previous -- and WHERE: `genLayout` returns one side
 * box per offset, in the same order. `isDimmed` fades the side slides so
 * they draw less attention (a singer's look-ahead); off, they are drawn in
 * the same full contrast as the current one (an audience that has to READ
 * them from the back of the room).
 */
export type LookAheadArrangementType = {
    offsets: number[];
    genLayout: (bounds: LookAheadBoundsType) => LookAheadLayoutType;
    isDimmed: boolean;
};

// The current slide on top, the slides at `offsets` in a row under it.
export function genRowArrangement(offsets: number[]): LookAheadArrangementType {
    return {
        offsets,
        genLayout: (bounds) => genLookAheadLayout(bounds, offsets.length),
        isDimmed: true,
    };
}

export const PREVIOUS_NEXT_ARRANGEMENT: LookAheadArrangementType = {
    offsets: [-1, 1],
    genLayout: genPreviousNextLayout,
    // Full contrast: faded, the previous and next slides were hard to read.
    isDimmed: false,
};

/**
 * A slide's html shown in a smaller box, drawn EXACTLY as it was laid out at
 * full size (`width` x `height`) and then shrunk as a picture.
 *
 * `transform: scale()`, deliberately not `zoom`. open-lyric freezes every
 * box of its markup in pixels, and a section title is shrink-wrapped to its
 * words with no room to spare. `zoom` lays the text out AGAIN at the smaller
 * font size, where glyph advances do not scale exactly, so `Verse 2:` came
 * out a hair wider than its zoomed box and wrapped onto two lines. A
 * transform never re-lays anything out. Its one catch — the full-size layout
 * box it keeps — is clipped by the outer box, and lyric slides never reach
 * the print path where that would matter (see CLAUDE.md, Printing).
 * `opacity` below 1 dims an upcoming slide.
 */
export function genLookAheadBoxHtml(
    html: string,
    scale: number,
    width: number,
    height: number,
    opacity = 1,
) {
    const opacityStyle = opacity < 1 ? ` opacity: ${opacity};` : '';
    return (
        `<div class="lyric-look-ahead-box" style="position: relative; ` +
        `width: 100%; height: 100%; overflow: hidden;${opacityStyle}">` +
        `<div style="position: absolute; left: 0; top: 0; ` +
        `width: ${width}px; height: ${height}px; ` +
        `transform: scale(${scale}); transform-origin: 0 0;">` +
        `${html}</div></div>`
    );
}

// The frame's line, as a share of the slide's content height: ~4px on a
// 1080p screen, still a visible hairline in a previewer thumbnail.
const FRAME_WIDTH_RATIO = 0.004;
const FRAME_RADIUS_RATIO = 0.012;
// A mid grey at partial alpha reads on a dark stage theme and a light one
// alike, and on whatever background is behind the slide.
const FRAME_COLOR = 'rgba(128, 128, 128, 0.7)';

/**
 * The outline drawn around a box, so the box is THERE even when the slide in
 * it is blank (None) — a singer seeing an empty dim rectangle knows a blank
 * slide comes next, where no rectangle at all reads as "nothing more".
 */
export function genLookAheadFrameHtml(
    bounds: LookAheadBoundsType,
    opacity = 1,
) {
    const width = Math.max(1, Math.round(bounds.height * FRAME_WIDTH_RATIO));
    const radius = Math.round(bounds.height * FRAME_RADIUS_RATIO);
    const opacityStyle = opacity < 1 ? ` opacity: ${opacity};` : '';
    return (
        `<div class="lyric-look-ahead-frame" style="width: 100%; ` +
        `height: 100%; box-sizing: border-box; ` +
        `border: ${width}px solid ${FRAME_COLOR}; ` +
        `border-radius: ${radius}px;${opacityStyle}"></div>`
    );
}

// The few fields of a canvas item this layout moves; everything else rides
// along untouched.
type LookAheadItemType = {
    id: number;
    left: number;
    top: number;
    width: number;
    height: number;
    type: string;
    html?: string;
};

/**
 * One item of a full-size slide, moved into `box` at `scale`. The slide's
 * content area (`bounds`) maps onto the box, so an item keeps its place
 * WITHIN the slide; an html item's markup is shrunk with it.
 */
function toLookAheadItem<T extends LookAheadItemType>(
    item: T,
    bounds: LookAheadBoundsType,
    box: LookAheadBoundsType,
    scale: number,
    opacity = 1,
): T {
    const scaledItem: T = {
        ...item,
        left: Math.round(box.x + (item.left - bounds.x) * scale),
        top: Math.round(box.y + (item.top - bounds.y) * scale),
        width: Math.round(item.width * scale),
        height: Math.round(item.height * scale),
    };
    if (item.type === 'html' && typeof item.html === 'string') {
        scaledItem.html = genLookAheadBoxHtml(
            item.html,
            scale,
            item.width,
            item.height,
            opacity,
        );
    }
    return scaledItem;
}

// The item kinds a side box shows -- see `genLookAheadItemsList`.
const SIDE_ITEM_TYPES = ['html', 'image'];

/**
 * A deck of full-size slides, each re-laid as itself plus the slides at the
 * arrangement's `offsets` from it in the deck, each in its own side box (see
 * `LookAheadArrangementType`). It starts from the very first slide, so a slot
 * that would fall off either end of the deck stays empty.
 *
 * Only text (html) and picture items are carried into a side box. The one
 * picture a song's own slides hold is the First slide's whole-song overview,
 * already a data URI in memory, so showing it again costs nothing -- and it
 * is what the previous box on Info shows. A video, a YouTube clip or a web
 * page would be loaded and PLAYED a second time for a glimpse; those come
 * from attachment slides, which never get side boxes, and this keeps them
 * out if one ever does. Every box
 * that holds a slide gets a frame (`genFrameItem`, drawn LAST so a section's
 * own background fill cannot cover it), an empty slide included; a slot off
 * the end of the deck gets none. When the arrangement `isDimmed`, a side box
 * is faded by its DISTANCE from the current slide. Ids are
 * renumbered per slide because the renderer keys items by id.
 */
export function genLookAheadItemsList<T extends LookAheadItemType>(
    itemsList: T[][],
    bounds: LookAheadBoundsType,
    arrangement: LookAheadArrangementType,
    genFrameItem: (box: LookAheadBoundsType, html: string) => T,
): T[][] {
    const { offsets } = arrangement;
    const layout = arrangement.genLayout(bounds);
    return itemsList.map((items, i) => {
        const newItems = items.map((item) => {
            return toLookAheadItem(
                item,
                bounds,
                layout.current,
                layout.currentScale,
            );
        });
        const frameItems = [
            genFrameItem(layout.current, genLookAheadFrameHtml(bounds)),
        ];
        layout.sideList.forEach((box, slotIndex) => {
            const offset = offsets[slotIndex];
            const nextItems = itemsList[i + offset];
            if (nextItems === undefined) {
                return;
            }
            const opacity = arrangement.isDimmed
                ? getLookAheadNextOpacity(Math.abs(offset) - 1)
                : 1;
            frameItems.push(
                genFrameItem(box, genLookAheadFrameHtml(bounds, opacity)),
            );
            nextItems
                .filter((item) => SIDE_ITEM_TYPES.includes(item.type))
                .forEach((item) => {
                    newItems.push(
                        toLookAheadItem(
                            item,
                            bounds,
                            box,
                            layout.sideScale,
                            opacity,
                        ),
                    );
                });
        });
        newItems.push(...frameItems);
        return newItems.map((item, id) => {
            return { ...item, id };
        });
    });
}
