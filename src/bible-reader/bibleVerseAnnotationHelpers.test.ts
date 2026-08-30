// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from 'vitest';

import {
    VERSE_ANNOTATION_ANCHOR_ATTR,
    checkIsOffsetInside,
    checkIsOverlapping,
    createRangeFromOffsets,
    getOffsetsFromRange,
} from './bibleVerseAnnotationHelpers';

const VERSE_TEXT = 'And it came to pass after these things, that God did tempt';

function mount(innerHtml: string) {
    document.body.innerHTML =
        `<div id="container"><span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 22:1">` +
        `${innerHtml}</span></div>`;
    const anchorElement = document.querySelector(
        `[${VERSE_ANNOTATION_ANCHOR_ATTR}]`,
    );
    if (anchorElement === null) {
        throw new Error('anchor not mounted');
    }
    return anchorElement;
}

// The three shapes a verse's text actually renders as. They differ only in how
// the same characters are split across text nodes, which is exactly what the
// offset walk has to be indifferent to.
const shapes: [string, string][] = [
    ['one text node', VERSE_TEXT],
    [
        'lookup-decorated',
        'And it came to pass after these things, that ' +
            '<span class="verse-lookup-link">God</span> did tempt',
    ],
    [
        'custom verse html',
        '<span><b>And it came</b> to pass after these things, ' +
            '<i>that God did tempt</i></span>',
    ],
];

describe('verse annotation offsets', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe.each(shapes)('%s', (_name, innerHtml) => {
        test('the whole verse reads back as one string', () => {
            const anchorElement = mount(innerHtml);
            expect(anchorElement.textContent).toBe(VERSE_TEXT);
        });

        test('offsets select exactly the stored words', () => {
            const anchorElement = mount(innerHtml);
            const start = VERSE_TEXT.indexOf('pass after these');
            const end = start + 'pass after these'.length;
            const range = createRangeFromOffsets(anchorElement, start, end);
            expect(range?.toString()).toBe('pass after these');
        });

        test('a range round-trips back to the offsets it came from', () => {
            const anchorElement = mount(innerHtml);
            const start = VERSE_TEXT.indexOf('God did tempt');
            const end = start + 'God did tempt'.length;
            const range = createRangeFromOffsets(anchorElement, start, end);
            if (range === null) {
                throw new Error('range not built');
            }
            expect(getOffsetsFromRange(anchorElement, range)).toEqual({
                start,
                end,
                text: 'God did tempt',
            });
        });

        test('a mark ending on a node boundary stops there', () => {
            const anchorElement = mount(innerHtml);
            const end = 'And it came'.length;
            const range = createRangeFromOffsets(anchorElement, 0, end);
            expect(range?.toString()).toBe('And it came');
        });
    });

    test('offsets past the end of the text yield no range', () => {
        const anchorElement = mount(VERSE_TEXT);
        expect(
            createRangeFromOffsets(
                anchorElement,
                VERSE_TEXT.length - 2,
                VERSE_TEXT.length + 40,
            ),
        ).toBeNull();
    });

    test('an empty or inverted span yields no range', () => {
        const anchorElement = mount(VERSE_TEXT);
        expect(createRangeFromOffsets(anchorElement, 5, 5)).toBeNull();
        expect(createRangeFromOffsets(anchorElement, 9, 4)).toBeNull();
    });

    test('a selection that leaves the verse is refused, not clamped', () => {
        // Half a cross-verse selection would silently mark words the user never
        // chose, with nothing on screen to say which half was kept.
        document.body.innerHTML =
            `<span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 22:1">first verse</span>` +
            `<span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 22:2">second verse</span>`;
        const [firstElement, secondElement] = Array.from(
            document.querySelectorAll(`[${VERSE_ANNOTATION_ANCHOR_ATTR}]`),
        );
        const range = document.createRange();
        range.setStart(firstElement.firstChild as Text, 6);
        range.setEnd(secondElement.firstChild as Text, 6);
        expect(getOffsetsFromRange(firstElement, range)).toBeNull();
    });

    test('a collapsed range yields no offsets', () => {
        const anchorElement = mount(VERSE_TEXT);
        const range = document.createRange();
        range.setStart(anchorElement.firstChild as Text, 4);
        range.collapse(true);
        expect(getOffsetsFromRange(anchorElement, range)).toBeNull();
    });
});

describe('offset predicates', () => {
    const annotation = { start: 10, end: 20 };

    test('the end offset is outside the mark', () => {
        expect(checkIsOffsetInside(annotation, 10)).toBe(true);
        expect(checkIsOffsetInside(annotation, 19)).toBe(true);
        expect(checkIsOffsetInside(annotation, 20)).toBe(false);
        expect(checkIsOffsetInside(annotation, 9)).toBe(false);
    });

    test('ranges that merely touch do not overlap', () => {
        expect(checkIsOverlapping(annotation, 0, 10)).toBe(false);
        expect(checkIsOverlapping(annotation, 20, 30)).toBe(false);
        expect(checkIsOverlapping(annotation, 0, 11)).toBe(true);
        expect(checkIsOverlapping(annotation, 19, 30)).toBe(true);
        expect(checkIsOverlapping(annotation, 12, 15)).toBe(true);
    });
});
