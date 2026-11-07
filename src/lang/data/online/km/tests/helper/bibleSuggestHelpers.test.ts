import { describe, expect, test } from 'vitest';

import {
    matchBibleBooks,
    readBibleReferencePrefix,
} from '../../../../../../helper/bibleSuggestHelpers';

const BOOK_LIST = [
    { bookKey: 'GEN', name: 'លោកុប្បត្តិ', englishName: 'Genesis' },
    { bookKey: 'JHN', name: 'យ៉ូហាន', englishName: 'John' },
    { bookKey: 'JOB', name: 'យ៉ូប', englishName: 'Job' },
    { bookKey: 'JOL', name: 'យ៉ូអែល', englishName: 'Joel' },
];

describe('a reference being typed', () => {
    test('is a book, a chapter, a verse and the colon between them', () => {
        expect(readBibleReferencePrefix('យ៉ូហាន ៣:១៦')).toEqual({
            bookPart: 'យ៉ូហាន',
            chapterDigits: '៣',
            verseDigits: '១៦',
            hasColon: true,
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
        expect(matchBibleBooks('យ៉ូ', BOOK_LIST).map((b) => b.bookKey)).toEqual(
            ['JHN', 'JOB', 'JOL'],
        );
    });

    test('reads the language’s own colon between chapter and verse', () => {
        expect(readBibleReferencePrefix('យ៉ូហាន ៣៖១៦')).toMatchObject({
            chapterDigits: '៣',
            verseDigits: '១៦',
            hasColon: true,
        });
    });
});
