import { beforeEach, describe, expect, test, vi } from 'vitest';

import kjvBibleConfigJson from '../helper/bible-helpers/kjvBibleConfig.json';

const h = vi.hoisted(() => ({
    getCurrentLocale: vi.fn(),
    getLangData: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    getCurrentLocale: h.getCurrentLocale,
    getLangData: h.getLangData,
    // Marks what went through the dictionary.
    tran: (text: string) => `«${text}»`,
}));

import { toResourcePatternLabel } from './resourcePatternHelpers';

// A language's own names for the 66 books, beside a shorter list (a
// 39-book Old Testament) that must never be taken for it.
const LOCALIZED_BOOKS = kjvBibleConfigJson.bookKeysOrder.map((bookKey) => {
    return `km-${bookKey}`;
});
const SHORT_BOOKS = kjvBibleConfigJson.bookKeysOrder
    .slice(0, 39)
    .map((bookKey) => `short-${bookKey}`);

function genPattern(bookKey: string, chapter: number) {
    return {
        pattern: `${bookKey}.${chapter}.*`,
        bookKey,
        chapter,
        isBookLevel: chapter < 1,
    };
}

beforeEach(() => {
    h.getCurrentLocale.mockReturnValue('km-KH');
    h.getLangData.mockReturnValue({
        bibleBooks: [
            { keys: [], books: SHORT_BOOKS },
            { keys: [], books: LOCALIZED_BOOKS },
        ],
    });
});

describe('toResourcePatternLabel', () => {
    test('names the book in the current language, from its whole-bible list', () => {
        expect(toResourcePatternLabel(genPattern('REV', 3))).toBe(
            'REV.3.*, «{book} chapter {chapter}»'
                .replace('{book}', 'km-REV')
                .replace('{chapter}', '3'),
        );
        expect(h.getLangData).toHaveBeenCalledWith('km-KH');
    });

    test('a book-level pattern reads as the book introduction', () => {
        expect(toResourcePatternLabel(genPattern('GEN', 0))).toBe(
            'GEN.0.*, km-GEN «Introduction»',
        );
    });

    test('with no language data loaded, the English name is used', () => {
        h.getLangData.mockReturnValue(null);
        expect(toResourcePatternLabel(genPattern('GEN', 0))).toBe(
            'GEN.0.*, Genesis «Introduction»',
        );
        // A language with no whole-bible list says nothing either.
        h.getLangData.mockReturnValue({
            bibleBooks: [{ keys: [], books: SHORT_BOOKS }],
        });
        expect(toResourcePatternLabel(genPattern('REV', 0))).toBe(
            'REV.0.*, Revelation «Introduction»',
        );
    });

    test('a book the 66 do not hold comes from the model that has it, or is its key', () => {
        // In the KJVD model only: the localized list holds no slot for it.
        expect(toResourcePatternLabel(genPattern('TOB', 0))).toBe(
            'TOB.0.*, Tobit «Introduction»',
        );
        // In the Douay-Rheims model only.
        expect(toResourcePatternLabel(genPattern('JAM', 0))).toBe(
            'JAM.0.*, James «Introduction»',
        );
        expect(toResourcePatternLabel(genPattern('XYZ', 0))).toBe(
            'XYZ.0.*, XYZ «Introduction»',
        );
    });
});
