// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

vi.mock('../bible-list/BibleItem', () => {
    return { default: { fromJson: vi.fn() } };
});
vi.mock('../bible-list/bibleRenderHelpers', () => {
    return { bibleRenderHelper: { fromBibleVerseKey: vi.fn() } };
});
vi.mock('../bible-list/note/verseAnnotationHelpers', () => {
    return { removeVerseAnnotation: vi.fn() };
});
vi.mock('./bibleVerseAnnotationHelpers', () => {
    return {
        VERSE_ANNOTATION_ANCHOR_ATTR: 'data-anchor',
        VERSE_ANNOTATION_ANCHOR_SELECTOR: '[data-anchor]',
        checkIsOverlapping: vi.fn(),
        getOffsetsFromRange: vi.fn(),
    };
});

const { openVerseBibleItem } = await import('./verseAnnotationActionHelpers');

describe('openVerseBibleItem', () => {
    test('opens the mark as its own view, outside any colour-note group', () => {
        // A new view inherits its neighbour's colour note, and a colour group
        // is synced to the lookup's target: the marked verse used to be
        // re-pointed to whatever passage the lookup showed.
        const lastItem = { id: 1 };
        const markItem = { id: -1 };
        const viewController = {
            straightBibleItems: [{ id: 0 }, lastItem],
            addBibleItem: vi.fn(),
            addBibleItemRight: vi.fn(),
        };
        openVerseBibleItem(viewController as any, markItem as any);
        expect(viewController.addBibleItemRight).toHaveBeenCalledWith(
            lastItem,
            markItem,
            true,
        );
    });

    test('an empty view takes the mark as its only item', () => {
        const markItem = { id: -1 };
        const viewController = {
            straightBibleItems: [],
            addBibleItem: vi.fn(),
            addBibleItemRight: vi.fn(),
        };
        openVerseBibleItem(viewController as any, markItem as any);
        expect(viewController.addBibleItem).toHaveBeenCalledWith(
            null,
            markItem,
            false,
            false,
            false,
        );
        expect(viewController.addBibleItemRight).not.toHaveBeenCalled();
    });
});
