import { describe, expect, test } from 'vitest';

import {
    genLookAheadBoxHtml,
    genLookAheadFrameHtml,
    genLookAheadItemsList,
    genLookAheadLayout,
    genPreviousNextLayout,
    genRowArrangement,
    getLookAheadNextOpacity,
    PREVIOUS_NEXT_ARRANGEMENT,
} from './lyricLookAheadHelpers';

// A 1920x1080 display with the default 1% padding.
const BOUNDS = { x: 19, y: 19, width: 1882, height: 1042 };
const SLIDE_RATIO = BOUNDS.width / BOUNDS.height;

function checkIsInside(
    box: { x: number; y: number; width: number; height: number },
    bounds: typeof BOUNDS,
) {
    return (
        box.x >= bounds.x &&
        box.y >= bounds.y &&
        box.x + box.width <= bounds.x + bounds.width + 1 &&
        box.y + box.height <= bounds.y + bounds.height + 1
    );
}

describe('genLookAheadLayout', () => {
    test('one upcoming slide sits under the current one, smaller', () => {
        const layout = genLookAheadLayout(BOUNDS, 1);
        expect(layout.current.x).toBe(BOUNDS.x);
        expect(layout.current.y).toBe(BOUNDS.y);
        // The current slide keeps most of the height.
        expect(layout.currentScale).toBeGreaterThan(0.58);
        expect(layout.sideList).toHaveLength(1);
        const [next] = layout.sideList;
        expect(next.x).toBe(BOUNDS.x);
        expect(next.y).toBeGreaterThan(
            layout.current.y + layout.current.height,
        );
        expect(next.width).toBeLessThan(layout.current.width);
        expect(checkIsInside(layout.current, BOUNDS)).toBe(true);
        expect(checkIsInside(next, BOUNDS)).toBe(true);
    });

    test('two upcoming slides sit side by side and fit the slide', () => {
        const layout = genLookAheadLayout(BOUNDS, 2);
        expect(layout.sideList).toHaveLength(2);
        const [first, second] = layout.sideList;
        expect(second.y).toBe(first.y);
        expect(second.x).toBeGreaterThan(first.x + first.width);
        layout.sideList.forEach((box) => {
            expect(checkIsInside(box, BOUNDS)).toBe(true);
        });
    });

    // Every box shows the full-slide render scaled down, which only fits
    // when the box keeps the slide's own proportions.
    test('every box keeps the slide ratio', () => {
        [1, 2, 3].forEach((count) => {
            const layout = genLookAheadLayout(BOUNDS, count);
            [layout.current, ...layout.sideList].forEach((box) => {
                expect(box.width / box.height).toBeCloseTo(SLIDE_RATIO, 1);
            });
            expect(layout.current.width).toBe(
                Math.round(BOUNDS.width * layout.currentScale),
            );
            layout.sideList.forEach((box) => {
                expect(checkIsInside(box, BOUNDS)).toBe(true);
            });
        });
    });
});

describe('genLookAheadBoxHtml', () => {
    test('shrinks the full-size layout and dims only an upcoming slide', () => {
        const current = genLookAheadBoxHtml('<p>Amazing</p>', 0.6, 1882, 1042);
        // Laid out at full size, then scaled as a picture: never re-laid out
        // at the small size, where a tight title wraps (`zoom` did that).
        expect(current).toContain('width: 1882px; height: 1042px');
        expect(current).toContain('transform: scale(0.6)');
        expect(current).not.toContain('zoom');
        expect(current).toContain('overflow: hidden');
        expect(current).not.toContain('opacity');
        expect(current).toContain('<p>Amazing</p>');
        const next = genLookAheadBoxHtml(
            '<p>Grace</p>',
            0.38,
            1882,
            1042,
            getLookAheadNextOpacity(0),
        );
        expect(next).toContain(`opacity: ${getLookAheadNextOpacity(0)}`);
        expect(getLookAheadNextOpacity(0)).toBeLessThan(1);
        expect(getLookAheadNextOpacity(1)).toBeLessThan(
            getLookAheadNextOpacity(0),
        );
    });
});

function genItem(type: string, html?: string) {
    return {
        id: 0,
        left: BOUNDS.x,
        top: BOUNDS.y,
        width: BOUNDS.width,
        height: BOUNDS.height,
        type,
        ...(html === undefined ? {} : { html }),
    };
}

function genFrame(
    box: { x: number; y: number; width: number; height: number },
    html: string,
) {
    return {
        id: -1,
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        type: 'frame',
        html,
    };
}

function toContent<T extends { type: string }>(items: T[]) {
    return items.filter((item) => item.type !== 'frame');
}

function toFrames<T extends { type: string }>(items: T[]) {
    return items.filter((item) => item.type === 'frame');
}

function toContentList<T extends { type: string }>(itemsList: T[][]) {
    return itemsList.map(toContent);
}

describe('genLookAheadItemsList', () => {
    // The deck as a stage builds it: First (a picture), Info, None (empty),
    // then the sections.
    const deck = [
        [genItem('image')],
        [genItem('html', '<p>Info</p>')],
        [],
        [genItem('html', '<p>Verse 1</p>')],
        [genItem('html', '<p>Chorus</p>')],
    ];

    test('looks ahead from the very first slide, in deck order', () => {
        const itemsList = toContentList(
            genLookAheadItemsList(
                deck,
                BOUNDS,
                genRowArrangement([1]),
                genFrame,
            ),
        );
        expect(itemsList).toHaveLength(deck.length);
        // First: its own picture, then Info coming.
        expect(itemsList[0].map((item) => item.type)).toEqual([
            'image',
            'html',
        ]);
        expect(itemsList[0][1].html).toContain('<p>Info</p>');
        // Info: None is next and has nothing to show.
        expect(itemsList[1]).toHaveLength(1);
        // None: nothing of its own, Verse 1 coming.
        expect(itemsList[2]).toHaveLength(1);
        expect(itemsList[2][0].html).toContain('<p>Verse 1</p>');
        expect(itemsList[2][0].html).toContain('opacity');
        // The last slide looks ahead to nothing.
        expect(itemsList[4]).toHaveLength(1);
        expect(itemsList[4][0].html).not.toContain('opacity');
    });

    test('places each item in its box and renumbers ids', () => {
        const layout = genLookAheadLayout(BOUNDS, 2);
        const itemsList = genLookAheadItemsList(
            deck,
            BOUNDS,
            genRowArrangement([1, 2]),
            genFrame,
        );
        const [current, next1, next2] = toContent(itemsList[1 + 1 + 1]);
        expect(current).toMatchObject({
            left: layout.current.x,
            top: layout.current.y,
            width: layout.current.width,
        });
        expect(next1.left).toBe(layout.sideList[0].x);
        expect(next1.top).toBe(layout.sideList[0].y);
        expect(next1.html).toContain('<p>Chorus</p>');
        expect(next2).toBeUndefined();
        // Content + 3 frames (current, next 1, next 2), ids 0.. in order.
        expect(itemsList[0].map((item) => item.id)).toEqual([0, 1, 2, 3, 4]);
    });

    // The First slide's whole-song overview is a picture, and it is the
    // previous slide of Info: a side box left empty there looked broken.
    test('carries a picture into a side box, never a video', () => {
        const withPicture = genLookAheadItemsList(
            [[genItem('html', 'a')], [genItem('image')]],
            BOUNDS,
            genRowArrangement([1]),
            genFrame,
        );
        expect(toContent(withPicture[0]).map((item) => item.type)).toEqual([
            'html',
            'image',
        ]);
        const withVideo = genLookAheadItemsList(
            [[genItem('html', 'a')], [genItem('video')]],
            BOUNDS,
            genRowArrangement([1]),
            genFrame,
        );
        expect(toContent(withVideo[0])).toHaveLength(1);
    });
});

describe('look-ahead frames', () => {
    const deck = [
        [genItem('html', '<p>Info</p>')],
        [],
        [genItem('html', '<p>Verse 1</p>')],
    ];

    // The point of the frame: a blank slide coming next is still a box.
    test('an EMPTY upcoming slide still gets its frame', () => {
        const layout = genLookAheadLayout(BOUNDS, 1);
        const itemsList = genLookAheadItemsList(
            deck,
            BOUNDS,
            genRowArrangement([1]),
            genFrame,
        );
        const frames = toFrames(itemsList[0]);
        expect(frames).toHaveLength(2);
        expect(frames[1]).toMatchObject({
            left: layout.sideList[0].x,
            top: layout.sideList[0].y,
            width: layout.sideList[0].width,
        });
        // Drawn over the content, so a section's fill cannot hide it.
        expect(itemsList[0].at(-1)?.type).toBe('frame');
    });

    test('the empty slide itself is framed too', () => {
        const itemsList = genLookAheadItemsList(
            deck,
            BOUNDS,
            genRowArrangement([1]),
            genFrame,
        );
        expect(toContent(itemsList[1])).toHaveLength(1);
        expect(toFrames(itemsList[1])).toHaveLength(2);
    });

    test('no frame for a slot past the end of the deck', () => {
        const itemsList = genLookAheadItemsList(
            deck,
            BOUNDS,
            genRowArrangement([1, 2]),
            genFrame,
        );
        // The last slide: only its own frame.
        expect(toFrames(itemsList[2])).toHaveLength(1);
        // One from the end: its own + the one slide left.
        expect(toFrames(itemsList[1])).toHaveLength(2);
    });

    test('an upcoming frame is dimmed like its slide', () => {
        expect(genLookAheadFrameHtml(BOUNDS)).not.toContain('opacity');
        expect(
            genLookAheadFrameHtml(BOUNDS, getLookAheadNextOpacity(0)),
        ).toContain(`opacity: ${getLookAheadNextOpacity(0)}`);
        expect(genLookAheadFrameHtml(BOUNDS)).toMatch(/border: \d+px solid/);
    });
});

describe('previous and next (stage 5)', () => {
    const deck = [
        [genItem('html', '<p>Verse 1</p>')],
        [genItem('html', '<p>Chorus</p>')],
        [genItem('html', '<p>Verse 2</p>')],
    ];
    const layout = genPreviousNextLayout(BOUNDS);
    const [previousBox, nextBox] = layout.sideList;
    const itemsList = genLookAheadItemsList(
        deck,
        BOUNDS,
        PREVIOUS_NEXT_ARRANGEMENT,
        genFrame,
    );

    // previous -> current -> next on one diagonal, in the order they are sung.
    test('previous top left, current beside it, next bottom right', () => {
        expect(previousBox.x).toBe(BOUNDS.x);
        expect(previousBox.y).toBe(BOUNDS.y);
        expect(layout.current.x).toBeGreaterThan(
            previousBox.x + previousBox.width,
        );
        expect(layout.current.y).toBe(BOUNDS.y);
        expect(nextBox.y).toBeGreaterThan(
            layout.current.y + layout.current.height,
        );
        expect(nextBox.x + nextBox.width).toBe(BOUNDS.x + BOUNDS.width);
        [layout.current, previousBox, nextBox].forEach((box) => {
            expect(checkIsInside(box, BOUNDS)).toBe(true);
            expect(box.width / box.height).toBeCloseTo(SLIDE_RATIO, 1);
        });
        expect(previousBox.width).toBeLessThan(layout.current.width);
    });

    test('each slide lands in its box', () => {
        const [current, previous, next] = toContent(itemsList[1]);
        expect(current.html).toContain('<p>Chorus</p>');
        expect(current.left).toBe(layout.current.x);
        expect(previous.html).toContain('<p>Verse 1</p>');
        expect(previous.left).toBe(previousBox.x);
        expect(previous.top).toBe(previousBox.y);
        expect(next.html).toContain('<p>Verse 2</p>');
        expect(next.left).toBe(nextBox.x);
        expect(next.top).toBe(nextBox.y);
    });

    // Faded, the previous and next slides were too hard to read.
    test('previous and next are drawn in full contrast', () => {
        const [, previous, next] = toContent(itemsList[1]);
        expect(previous.html).not.toContain('opacity');
        expect(next.html).not.toContain('opacity');
        toFrames(itemsList[1]).forEach((frame) => {
            expect(frame.html).not.toContain('opacity');
        });
    });

    test('the first slide has no previous, the last no next', () => {
        const [, firstNext] = toContent(itemsList[0]);
        expect(firstNext.top).toBe(nextBox.y);
        expect(toFrames(itemsList[0])).toHaveLength(2);
        const [, lastPrevious, lastNext] = toContent(itemsList[2]);
        expect(lastPrevious.top).toBe(previousBox.y);
        expect(lastNext).toBeUndefined();
        expect(toFrames(itemsList[2])).toHaveLength(2);
    });
});
