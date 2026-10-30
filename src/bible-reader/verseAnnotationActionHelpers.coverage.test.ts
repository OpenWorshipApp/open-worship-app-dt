// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    fromBibleVerseKey: vi.fn(),
    toTitle: vi.fn(),
    fromJson: vi.fn(),
    removeVerseAnnotation: vi.fn(),
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: { fromJson: h.fromJson },
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        fromBibleVerseKey: h.fromBibleVerseKey,
        toTitle: h.toTitle,
    },
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    removeVerseAnnotation: h.removeVerseAnnotation,
}));

// The real offset helpers: dependency-free by design, so the selection is
// read against real DOM exactly as it is in the reader.
import { VERSE_ANNOTATION_ANCHOR_ATTR } from './bibleVerseAnnotationHelpers';
import {
    readVerseSelection,
    removeAnnotationRefs,
    toOverlappingAnnotationRefs,
    toVerseAnchor,
    toVerseBibleItem,
} from './verseAnnotationActionHelpers';

const RECT = { left: 10, top: 20, width: 30, height: 12 };

function mountVerses() {
    document.body.innerHTML =
        '<div id="verses">' +
        `<span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 1:1">` +
        'In the <b>beginning</b> God</span> ' +
        `<span ${VERSE_ANNOTATION_ANCHOR_ATTR}="(KJV) GEN 1:2">` +
        'And the earth</span>' +
        '<span id="outside">Not a verse</span>' +
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
    return range;
}

beforeEach(() => {
    // jsdom lays nothing out; the toolbar only needs the box handed back.
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: () => RECT,
    });
});

afterEach(() => {
    globalThis.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
    delete (Range.prototype as any).getBoundingClientRect;
});

describe('readVerseSelection', () => {
    test('nothing selected reads as nothing', () => {
        mountVerses();
        expect(readVerseSelection()).toBeNull();
        const { first } = mountVerses();
        // A caret is a selection too, and it marks nothing.
        globalThis.getSelection()!.collapse(first.firstChild!, 2);
        expect(readVerseSelection()).toBeNull();
    });

    test('words inside one verse read as that verse and their offsets', () => {
        const { first } = mountVerses();
        // "the " inside the first text node.
        select(first.firstChild!, 3, first.firstChild!, 7);
        expect(readVerseSelection()).toEqual({
            verseKey: '(KJV) GEN 1:1',
            offsets: { start: 3, end: 6, text: 'the' },
            rect: RECT,
        });
    });

    test('words inside markup in a verse still find their verse', () => {
        const { first } = mountVerses();
        const bold = first.querySelector('b')!;
        select(bold.firstChild!, 0, bold.firstChild!, 5);
        expect(readVerseSelection()).toMatchObject({
            verseKey: '(KJV) GEN 1:1',
            offsets: { start: 7, end: 12, text: 'begin' },
        });
    });

    test('a whole verse selected by element boundaries is read', () => {
        const { second } = mountVerses();
        globalThis.getSelection()!.selectAllChildren(second);
        expect(readVerseSelection()).toMatchObject({
            verseKey: '(KJV) GEN 1:2',
            offsets: { start: 0, end: 13, text: 'And the earth' },
        });
    });

    test('a selection running across two verses is refused', () => {
        const { first, second } = mountVerses();
        select(first.firstChild!, 3, second.firstChild!, 3);
        expect(readVerseSelection()).toBeNull();
    });

    test('a selection outside every verse is refused', () => {
        mountVerses();
        const outside = document.getElementById('outside')!;
        select(outside.firstChild!, 0, outside.firstChild!, 3);
        expect(readVerseSelection()).toBeNull();
    });

    test('only whitespace inside a verse marks nothing', () => {
        const { first } = mountVerses();
        // The space between "In" and "the".
        select(first.firstChild!, 2, first.firstChild!, 3);
        expect(readVerseSelection()).toBeNull();
    });
});

describe('toVerseAnchor', () => {
    test('files a mark under the localized verse title', async () => {
        h.fromBibleVerseKey.mockReturnValue({
            bibleKey: 'KJV',
            bookKey: 'GEN',
            chapter: 22,
            verseStart: 1,
            verseEnd: 1,
        });
        h.toTitle.mockResolvedValue('Genesis 22:1');
        expect(await toVerseAnchor('(KJV) GEN 22:1')).toEqual({
            verseKey: '(KJV) GEN 22:1',
            shortVerse: 'GEN 22:1',
            title: '(KJV) Genesis 22:1',
        });
        expect(h.fromBibleVerseKey).toHaveBeenCalledWith('(KJV) GEN 22:1');
        // The bible key is split off the target before titling it.
        expect(h.toTitle).toHaveBeenCalledWith('KJV', {
            bookKey: 'GEN',
            chapter: 22,
            verseStart: 1,
            verseEnd: 1,
        });
    });

    test('a key with no bible part is refused without parsing', async () => {
        expect(await toVerseAnchor('GEN 22:1')).toBeNull();
        expect(h.fromBibleVerseKey).not.toHaveBeenCalled();
    });

    test('a key too malformed to parse is refused', async () => {
        h.fromBibleVerseKey.mockImplementation(() => {
            throw new Error('bad key');
        });
        expect(await toVerseAnchor('(KJV) ???')).toBeNull();
    });

    test('a title that cannot be read is refused', async () => {
        h.fromBibleVerseKey.mockReturnValue({ bibleKey: 'KJV' });
        h.toTitle.mockRejectedValue(new Error('no bible'));
        expect(await toVerseAnchor('(KJV) GEN 22:1')).toBeNull();
    });
});

describe('toOverlappingAnnotationRefs', () => {
    const annotations = {
        highlights: [
            {
                filePath: '/a.own',
                noteItemId: 1,
                highlight: { id: 'h-before', start: 0, end: 3 },
            },
            {
                filePath: '/a.own',
                noteItemId: 1,
                highlight: { id: 'h-inside', start: 4, end: 8 },
            },
        ],
        comments: [
            {
                filePath: '/b.own',
                noteItemId: 2,
                comment: { id: 'c-across', start: 7, end: 20 },
            },
            {
                filePath: '/b.own',
                noteItemId: 2,
                comment: { id: 'c-after', start: 10, end: 12 },
            },
        ],
    } as any;

    test('a verse with no marks has nothing to erase', () => {
        expect(toOverlappingAnnotationRefs(undefined, 0, 10)).toEqual([]);
    });

    test('collects every highlight and comment the range touches', () => {
        expect(toOverlappingAnnotationRefs(annotations, 3, 9)).toEqual([
            { filePath: '/a.own', noteItemId: 1, id: 'h-inside' },
            { filePath: '/b.own', noteItemId: 2, id: 'c-across' },
        ]);
    });

    test('a range touching no mark erases nothing', () => {
        expect(toOverlappingAnnotationRefs(annotations, 25, 30)).toEqual([]);
    });
});

describe('removeAnnotationRefs', () => {
    test('deletes one after another, never in parallel', async () => {
        const order: string[] = [];
        let releaseFirst: () => void = () => {};
        h.removeVerseAnnotation.mockImplementation(
            (_filePath: string, _noteItemId: number, id: string) => {
                order.push(`start ${id}`);
                if (id === 'first') {
                    return new Promise<void>((resolve) => {
                        releaseFirst = () => {
                            order.push('end first');
                            resolve();
                        };
                    });
                }
                return Promise.resolve();
            },
        );
        const promise = removeAnnotationRefs([
            { filePath: '/a.own', noteItemId: 1, id: 'first' },
            { filePath: '/b.own', noteItemId: 2, id: 'second' },
        ]);
        await Promise.resolve();
        // The second delete waits for the first write to finish.
        expect(order).toEqual(['start first']);
        releaseFirst();
        expect(await promise).toBe(2);
        expect(order).toEqual(['start first', 'end first', 'start second']);
        expect(h.removeVerseAnnotation).toHaveBeenNthCalledWith(
            2,
            '/b.own',
            2,
            'second',
        );
    });

    test('nothing to remove removes nothing', async () => {
        expect(await removeAnnotationRefs([])).toBe(0);
        expect(h.removeVerseAnnotation).not.toHaveBeenCalled();
    });
});

describe('toVerseBibleItem', () => {
    test('builds the verse as a new bible item, synchronously', () => {
        const bibleItem = { id: -1 };
        h.fromBibleVerseKey.mockReturnValue({
            bibleKey: 'KJV',
            bookKey: 'GEN',
            chapter: 22,
            verseStart: 1,
            verseEnd: 1,
        });
        h.fromJson.mockReturnValue(bibleItem);
        expect(toVerseBibleItem('(KJV) GEN 22:1')).toBe(bibleItem);
        expect(h.fromJson).toHaveBeenCalledWith({
            id: -1,
            bibleKey: 'KJV',
            target: {
                bookKey: 'GEN',
                chapter: 22,
                verseStart: 1,
                verseEnd: 1,
            },
            metadata: {},
        });
    });

    test('a key that cannot be parsed builds nothing', () => {
        h.fromBibleVerseKey.mockImplementation(() => {
            throw new Error('bad key');
        });
        expect(toVerseBibleItem('(KJV) ???')).toBeNull();
        expect(h.fromJson).not.toHaveBeenCalled();
    });
});
