import { describe, expect, test } from 'vitest';

import {
    listNumberPrefixMatches,
    matchBibleBooks,
    readBibleReferencePrefix,
    toCompactBookName,
} from './bibleSuggestHelpers';

const BOOK_LIST = [
    { bookKey: 'GEN', name: 'លោកុប្បត្តិ', englishName: 'Genesis' },
    { bookKey: 'JHN', name: 'យ៉ូហាន', englishName: 'John' },
    { bookKey: 'JOB', name: 'យ៉ូប', englishName: 'Job' },
    { bookKey: 'JOL', name: 'យ៉ូអែល', englishName: 'Joel' },
];

describe('a reference being typed', () => {
    test('is a book, a chapter, a verse and the colon between them', () => {
        expect(readBibleReferencePrefix('John 3:16')).toEqual({
            bookPart: 'John',
            chapterDigits: '3',
            verseDigits: '16',
            hasColon: true,
            hasDigits: true,
        });
        expect(readBibleReferencePrefix('យ៉ូហាន ៣:១៦')).toEqual({
            bookPart: 'យ៉ូហាន',
            chapterDigits: '៣',
            verseDigits: '១៦',
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
        expect(readBibleReferencePrefix('យ៉ូ')).toEqual({
            bookPart: 'យ៉ូ',
            chapterDigits: '',
            verseDigits: '',
            hasColon: false,
            hasDigits: false,
        });
        // A Khmer keyboard's word breaks are not part of the name.
        expect(readBibleReferencePrefix('យ៉ូ​ហាន 3').bookPart).toBe('យ៉ូហាន');
    });

    test('matches books exactly first, then every name that starts so', () => {
        expect(
            matchBibleBooks('John', BOOK_LIST).map((b) => b.bookKey),
        ).toEqual(['JHN']);
        expect(matchBibleBooks('យ៉ូ', BOOK_LIST).map((b) => b.bookKey)).toEqual(
            ['JHN', 'JOB', 'JOL'],
        );
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
