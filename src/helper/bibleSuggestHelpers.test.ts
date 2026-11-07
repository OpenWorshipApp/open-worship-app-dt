import { describe, expect, test } from 'vitest';

import {
    listNumberPrefixMatches,
    matchBibleBooks,
    readBibleReferencePrefix,
    toCompactBookName,
} from './bibleSuggestHelpers';

const BOOK_LIST = [
    { bookKey: 'GEN', name: 'Genesis', englishName: 'Genesis' },
    { bookKey: 'JHN', name: 'John', englishName: 'John' },
    { bookKey: 'JOB', name: 'Job', englishName: 'Job' },
    { bookKey: 'JOL', name: 'Joel', englishName: 'Joel' },
];

// The same in a language with its own names and digits is that language's
// test (`src/lang/data/online/<code>/tests/helper/bibleSuggestHelpers.test.ts`).
describe('a reference being typed', () => {
    test('is a book, a chapter, a verse and the colon between them', () => {
        expect(readBibleReferencePrefix('John 3:16')).toEqual({
            bookPart: 'John',
            chapterDigits: '3',
            verseDigits: '16',
            hasColon: true,
            hasDigits: true,
        });
        expect(readBibleReferencePrefix('1 John 4')).toEqual({
            bookPart: '1 John',
            chapterDigits: '4',
            verseDigits: '',
            hasColon: false,
            hasDigits: true,
        });
        expect(readBibleReferencePrefix('Jo')).toEqual({
            bookPart: 'Jo',
            chapterDigits: '',
            verseDigits: '',
            hasColon: false,
            hasDigits: false,
        });
        // A zero-width break inside a name is not part of it.
        expect(
            readBibleReferencePrefix(`Jo${String.fromCodePoint(0x200b)}hn 3`)
                .bookPart,
        ).toBe('John');
    });

    test('matches books exactly first, then every name that starts so', () => {
        expect(
            matchBibleBooks('John', BOOK_LIST).map((b) => b.bookKey),
        ).toEqual(['JHN']);
        expect(matchBibleBooks('Jo', BOOK_LIST).map((b) => b.bookKey)).toEqual([
            'JHN',
            'JOB',
            'JOL',
        ]);
        expect(matchBibleBooks('', BOOK_LIST)).toEqual([]);
        expect(toCompactBookName('1 John')).toBe('1john');
    });

    test('keeps the numbers a typed prefix could still become', () => {
        expect(listNumberPrefixMatches('', 5)).toEqual([1, 2, 3, 4, 5]);
        expect(listNumberPrefixMatches('1', 21)).toEqual([
            1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        ]);
        expect(listNumberPrefixMatches('16', 176)).toEqual([
            16, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169,
        ]);
    });
});
