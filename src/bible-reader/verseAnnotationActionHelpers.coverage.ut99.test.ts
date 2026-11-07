// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        fromJson: vi.fn(),
        fromBibleVerseKey: vi.fn(),
        toTitle: vi.fn(),
        removeVerseAnnotation: vi.fn(),
    };
});

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

// `./bibleVerseAnnotationHelpers` stays real: it is dependency-free DOM code,
// and the offsets it measures are what these functions hand on.
import { VERSE_ANNOTATION_ANCHOR_ATTR } from './bibleVerseAnnotationHelpers';
import {
    readVerseSelection,
    removeAnnotationRefs,
    toOverlappingAnnotationRefs,
    toVerseAnchor,
    toVerseBibleItem,
} from './verseAnnotationActionHelpers';

const TARGET = { bookKey: 'GEN', chapter: 22, verseStart: 1, verseEnd: 1 };
const RECT = { left: 4, top: 5, width: 6, height: 7, bottom: 12 };

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

let originalRangeRect: PropertyDescriptor | undefined;

beforeEach(() => {
    // jsdom lays nothing out, and has no Range rect at all.
    originalRangeRect = Object.getOwnPropertyDescriptor(
        Range.prototype,
        'getBoundingClientRect',
    );
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: () => RECT,
    });
});

afterEach(() => {
    globalThis.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
    if (originalRangeRect === undefined) {
        delete (Range.prototype as any).getBoundingClientRect;
    } else {
        Object.defineProperty(
            Range.prototype,
            'getBoundingClientRect',
            originalRangeRect,
        );
    }
});

describe('readVerseSelection', () => {
    test('nothing selected, or a caret only, is no selection', () => {
        const { first } = mountVerses();
        expect(readVerseSelection()).toBeNull();
        select(first.firstChild!, 3, first.firstChild!, 3);
        expect(globalThis.getSelection()!.isCollapsed).toBe(true);
        expect(readVerseSelection()).toBeNull();
    });

    test('words inside one verse read as that verse and their offsets', () => {
        const { first } = mountVerses();
        // "it came" inside the verse's first text node.
        select(first.firstChild!, 4, first.firstChild!, 11);
        expect(readVerseSelection()).toEqual({
            verseKey: '(KJV) GEN 22:1',
            offsets: { start: 4, end: 11, text: 'it came' },
            rect: RECT,
        });
    });

    test('a selection held by the verse element itself is still that verse', () => {
        const { first } = mountVerses();
        // A triple-click hands over (element, childIndex) boundaries.
        globalThis.getSelection()!.selectAllChildren(first);
        expect(readVerseSelection()).toEqual({
            verseKey: '(KJV) GEN 22:1',
            offsets: {
                start: 0,
                end: 'And it came to pass after'.length,
                text: 'And it came to pass after',
            },
            rect: RECT,
        });
    });

    test('a selection across two verses is refused, not clamped', () => {
        const { first, second } = mountVerses();
        select(first.firstChild!, 4, second.firstChild!, 3);
        expect(readVerseSelection()).toBeNull();
    });

    test('words outside any verse are no selection', () => {
        mountVerses();
        const outside = document.getElementById('outside')!;
        select(outside.firstChild!, 0, outside.firstChild!, 5);
        expect(readVerseSelection()).toBeNull();
    });

    test('a selection of only the gap between words marks nothing', () => {
        const { first } = mountVerses();
        select(first.firstChild!, 3, first.firstChild!, 4);
        expect(globalThis.getSelection()!.toString()).toBe(' ');
        expect(readVerseSelection()).toBeNull();
    });
});

describe('toVerseAnchor', () => {
    test('files the mark under the verse with its localized title', async () => {
        h.fromBibleVerseKey.mockReturnValue({ bibleKey: 'KJV', ...TARGET });
        h.toTitle.mockResolvedValue('Genesis 22:1');
        await expect(toVerseAnchor('(KJV) GEN 22:1')).resolves.toEqual({
            verseKey: '(KJV) GEN 22:1',
            shortVerse: 'GEN 22:1',
            title: '(KJV) Genesis 22:1',
        });
        expect(h.fromBibleVerseKey).toHaveBeenCalledWith('(KJV) GEN 22:1');
        expect(h.toTitle).toHaveBeenCalledWith('KJV', TARGET);
    });

    test('a key with no bible part names no verse', async () => {
        await expect(toVerseAnchor('GEN 22:1')).resolves.toBeNull();
        expect(h.fromBibleVerseKey).not.toHaveBeenCalled();
    });

    test('a key too malformed to parse names no verse', async () => {
        h.fromBibleVerseKey.mockImplementation(() => {
            throw new Error('bad key');
        });
        await expect(toVerseAnchor('(KJV) nonsense')).resolves.toBeNull();
        expect(h.toTitle).not.toHaveBeenCalled();
    });
});

describe('toOverlappingAnnotationRefs', () => {
    const annotations = {
        highlights: [
            {
                filePath: '/a.own',
                noteItemId: 1,
                highlight: { id: 'h-1', start: 0, end: 5 },
            },
            {
                filePath: '/a.own',
                noteItemId: 1,
                highlight: { id: 'h-2', start: 20, end: 30 },
            },
        ],
        comments: [
            {
                filePath: '/b.own',
                noteItemId: 2,
                comment: { id: 'c-1', start: 4, end: 9 },
            },
            {
                filePath: '/b.own',
                noteItemId: 2,
                comment: { id: 'c-2', start: 9, end: 12 },
            },
        ],
    } as any;

    test('a verse with no marks has nothing to remove', () => {
        expect(toOverlappingAnnotationRefs(undefined, 0, 10)).toEqual([]);
    });

    test('every highlight, then every comment, the range touches', () => {
        expect(toOverlappingAnnotationRefs(annotations, 3, 9)).toEqual([
            { filePath: '/a.own', noteItemId: 1, id: 'h-1' },
            { filePath: '/b.own', noteItemId: 2, id: 'c-1' },
        ]);
        expect(toOverlappingAnnotationRefs(annotations, 12, 20)).toEqual([]);
    });
});

describe('removeAnnotationRefs', () => {
    test('removes one after another, never two at once', async () => {
        const resolverList: (() => void)[] = [];
        h.removeVerseAnnotation.mockImplementation(() => {
            return new Promise<void>((resolve) => {
                resolverList.push(resolve);
            });
        });
        const refList = [
            { filePath: '/a.own', noteItemId: 1, id: 'h-1' },
            { filePath: '/b.own', noteItemId: 2, id: 'c-1' },
        ];
        const promise = removeAnnotationRefs(refList);
        await Promise.resolve();
        expect(h.removeVerseAnnotation.mock.calls).toEqual([
            ['/a.own', 1, 'h-1'],
        ]);
        resolverList[0]();
        await vi.waitFor(() => {
            expect(h.removeVerseAnnotation).toHaveBeenCalledTimes(2);
        });
        expect(h.removeVerseAnnotation).toHaveBeenLastCalledWith(
            '/b.own',
            2,
            'c-1',
        );
        resolverList[1]();
        await expect(promise).resolves.toBe(2);
    });

    test('nothing to remove removes nothing', async () => {
        await expect(removeAnnotationRefs([])).resolves.toBe(0);
        expect(h.removeVerseAnnotation).not.toHaveBeenCalled();
    });
});

describe('toVerseBibleItem', () => {
    test('builds the verse as a new bible item, synchronously', () => {
        const bibleItem = { id: -1 };
        h.fromBibleVerseKey.mockReturnValue({ bibleKey: 'KJV', ...TARGET });
        h.fromJson.mockReturnValue(bibleItem);
        expect(toVerseBibleItem('(KJV) GEN 22:1')).toBe(bibleItem);
        expect(h.fromJson).toHaveBeenCalledWith({
            id: -1,
            bibleKey: 'KJV',
            target: TARGET,
            metadata: {},
        });
    });

    test('a key that does not parse is no item', () => {
        h.fromBibleVerseKey.mockImplementation(() => {
            throw new Error('bad key');
        });
        expect(toVerseBibleItem('(KJV) nonsense')).toBeNull();
        expect(h.fromJson).not.toHaveBeenCalled();
    });
});
