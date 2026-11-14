// @vitest-environment jsdom

import { afterEach, describe, expect, test } from 'vitest';

import { toNoteSelectionMention } from './noteSelectionMentionHelpers';

// Words selected in a Bible note, with where they are in their line, for the
// help window's box: read off the selection's DOM range.

let host: HTMLDivElement | null = null;

function mount(html: string) {
    host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
}

afterEach(() => {
    host?.remove();
    host = null;
});

function textOf(element: Element) {
    return element.firstChild as Text;
}

function genRange(
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number,
) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
}

function toSelection(text: string, domRange: Range | null) {
    return { text, html: '', domRange } as any;
}

describe('toNoteSelectionMention', () => {
    test('with no range from the editor, the words alone', () => {
        expect(toNoteSelectionMention(toSelection('grace', null))).toBe(
            'grace',
        );
    });

    test('a word in one line comes with its line and its place in it', () => {
        const root = mount('<p>The Lord is my shepherd</p>');
        const text = textOf(root.querySelector('p')!);
        // "Lord": characters 5 to 8 of the line, counted from 1.
        const range = genRange(text, 4, text, 8);

        expect(toNoteSelectionMention(toSelection('Lord', range))).toEqual({
            text: 'Lord',
            before: 'The ',
            after: ' is my shepherd',
            start: 5,
            end: 8,
        });
    });

    test('the spaces a drag picked up at either end are not counted as the words', () => {
        const root = mount('<h2>The Lord is my shepherd</h2>');
        const text = textOf(root.querySelector('h2')!);
        // " Lord " -- the same word, the same place.
        const range = genRange(text, 3, text, 9);

        expect(toNoteSelectionMention(toSelection('Lord', range))).toEqual({
            text: 'Lord',
            before: 'The ',
            after: ' is my shepherd',
            start: 5,
            end: 8,
        });
    });

    test('words in a formatted run are read in the whole line', () => {
        const root = mount('<li>Love <b>one another</b> daily</li>');
        const bold = root.querySelector('b')!;
        // The range starts on the list item element itself (offset 1: after
        // "Love ") and ends inside the bold run's text.
        const range = genRange(root.querySelector('li')!, 1, textOf(bold), 3);

        expect(toNoteSelectionMention(toSelection('one', range))).toEqual({
            text: 'one',
            before: 'Love ',
            after: ' another daily',
            start: 6,
            end: 8,
        });
    });

    test('a selection over two lines keeps both ends, with no place counted', () => {
        const root = mount('<p>In the beginning</p><p>was the Word</p>');
        const [first, second] = root.querySelectorAll('p');
        const range = genRange(textOf(first), 7, textOf(second), 3);

        expect(
            toNoteSelectionMention(toSelection('beginning\nwas', range)),
        ).toEqual({
            text: 'beginning\nwas',
            before: 'In the ',
            after: ' the Word',
            start: null,
            end: null,
        });
    });

    test('only spaces selected: no place counted', () => {
        const root = mount('<p>a   b</p>');
        const text = textOf(root.querySelector('p')!);
        const range = genRange(text, 1, text, 4);

        const mention = toNoteSelectionMention(toSelection(' ', range));
        expect(mention).toMatchObject({ start: null, end: null });
    });

    test('a range outside any line the editor draws is the words alone', () => {
        const root = mount('<div>loose words</div>');
        const text = textOf(root.querySelector('div')!);
        const range = genRange(text, 0, text, 5);

        expect(toNoteSelectionMention(toSelection('loose', range))).toBe(
            'loose',
        );
    });

    test('a range the note no longer matches still hands over the words', () => {
        const root = mount('<p>short</p>');
        const text = textOf(root.querySelector('p')!);
        // Offsets from before the line was shortened.
        const stale = {
            startContainer: text,
            startOffset: 40,
            endContainer: text,
            endOffset: 45,
            toString: () => 'gone',
        } as unknown as Range;

        expect(toNoteSelectionMention(toSelection('gone', stale))).toBe('gone');
    });
});
