// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

// The selection in a Bible view as the assistant is handed it: the verse's
// key, the words, the verse's words around them and their place in it.
vi.mock('../bible-list/BibleItem', () => ({
    default: { fromJson: vi.fn() },
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { fromBibleVerseKey: vi.fn(), toTitle: vi.fn() },
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    removeVerseAnnotation: vi.fn(),
}));

// `./bibleVerseAnnotationHelpers` stays real: the offsets it measures are
// what the mention is built from.
import { VERSE_ANNOTATION_ANCHOR_ATTR } from './bibleVerseAnnotationHelpers';
import { readVerseSelectionMention } from './verseAnnotationActionHelpers';

function mountVerses() {
    document.body.innerHTML =
        '<div id="view">' +
        `<span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 22:1">` +
        'And it came <b>to pass</b> after</span>' +
        `<span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 22:2">` +
        'And he said</span>' +
        '<span id="outside">no verse here</span>' +
        '</div>';
    const [first, second] = Array.from(
        document.querySelectorAll(`[${VERSE_ANNOTATION_ANCHOR_ATTR}]`),
    );
    return { first, second };
}

function select(
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number,
) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = globalThis.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

afterEach(() => {
    globalThis.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
});

describe('readVerseSelectionMention', () => {
    test('nothing selected, or a caret only, is no mention', () => {
        const { first } = mountVerses();
        expect(readVerseSelectionMention()).toBeNull();
        select(first.firstChild!, 3, first.firstChild!, 3);
        expect(readVerseSelectionMention()).toBeNull();
    });

    test('words across a formatted run carry the verse around them, counted from 1', () => {
        const { first } = mountVerses();
        // "to pass" -- characters 13 to 19 of "And it came to pass after".
        const bold = first.querySelector('b')!;
        select(bold.firstChild!, 0, bold.firstChild!, 7);

        expect(readVerseSelectionMention()).toEqual({
            verseKey: '(KJV) GEN 22:1',
            mention: {
                text: 'to pass',
                before: 'And it came ',
                after: ' after',
                start: 13,
                end: 19,
            },
        });
    });

    test('the spaces a drag picked up are left out of the words', () => {
        const { second } = mountVerses();
        // " he " in "And he said": the word is characters 5 to 6.
        select(second.firstChild!, 3, second.firstChild!, 7);

        expect(readVerseSelectionMention()).toEqual({
            verseKey: '(KJV) GEN 22:2',
            mention: {
                text: 'he',
                before: 'And ',
                after: ' said',
                start: 5,
                end: 6,
            },
        });
    });

    test('a selection across two verses, outside any, or of spaces only is none', () => {
        const { first, second } = mountVerses();
        select(first.firstChild!, 4, second.firstChild!, 3);
        expect(readVerseSelectionMention()).toBeNull();

        const outside = document.getElementById('outside')!;
        select(outside.firstChild!, 0, outside.firstChild!, 5);
        expect(readVerseSelectionMention()).toBeNull();

        // "And it came " -- the space before "to".
        select(first.firstChild!, 11, first.firstChild!, 12);
        expect(readVerseSelectionMention()).toBeNull();
    });
});
