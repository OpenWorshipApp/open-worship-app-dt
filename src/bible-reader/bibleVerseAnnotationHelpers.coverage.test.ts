// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
    VERSE_ANNOTATION_ANCHOR_ATTR,
    getOffsetFromPoint,
} from './bibleVerseAnnotationHelpers';

type CaretPositionType = { offsetNode: Node; offset: number } | null;

let caretPosition: CaretPositionType = null;
let askedPoints: [number, number][] = [];

function mount() {
    document.body.innerHTML =
        `<span id="outside">Before</span>` +
        `<span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 22:1">` +
        'And it came to pass, that <b>God</b> did tempt</span>';
    return document.querySelector(`[${VERSE_ANNOTATION_ANCHOR_ATTR}]`)!;
}

describe('getOffsetFromPoint', () => {
    beforeEach(() => {
        askedPoints = [];
        caretPosition = null;
    });

    afterEach(() => {
        delete (document as any).caretPositionFromPoint;
        document.body.innerHTML = '';
    });

    function stubCaret() {
        // jsdom lays nothing out, so it has no caret lookup of its own.
        (document as any).caretPositionFromPoint = (x: number, y: number) => {
            askedPoints.push([x, y]);
            return caretPosition;
        };
    }

    test('a browser without caret lookup hit-tests nothing', () => {
        const anchorElement = mount();
        expect(getOffsetFromPoint(anchorElement, 5, 5)).toBeNull();
    });

    test('a point over no text hits nothing', () => {
        const anchorElement = mount();
        stubCaret();
        expect(getOffsetFromPoint(anchorElement, 5, 6)).toBeNull();
        expect(askedPoints).toEqual([[5, 6]]);
    });

    test("a point over another element's text is not this verse's", () => {
        const anchorElement = mount();
        stubCaret();
        caretPosition = {
            offsetNode: document.getElementById('outside')!.firstChild!,
            offset: 2,
        };
        expect(getOffsetFromPoint(anchorElement, 5, 5)).toBeNull();
    });

    test('a point over the verse is its offset in the whole verse text', () => {
        const anchorElement = mount();
        stubCaret();
        // Inside "God", which lives in its own text node.
        caretPosition = {
            offsetNode: anchorElement.querySelector('b')!.firstChild!,
            offset: 1,
        };
        expect(getOffsetFromPoint(anchorElement, 5, 5)).toBe(
            'And it came to pass, that G'.length,
        );
        caretPosition = { offsetNode: anchorElement.firstChild!, offset: 4 };
        expect(getOffsetFromPoint(anchorElement, 5, 5)).toBe(4);
    });
});
