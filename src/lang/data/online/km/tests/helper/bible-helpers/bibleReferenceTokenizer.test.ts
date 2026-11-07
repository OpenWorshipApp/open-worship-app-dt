import { describe, expect, test } from 'vitest';

import {
    normalizeBibleReferenceText,
    toBibleDigitPattern,
    tokenizeBibleRangeReference,
} from '../../../../../../../helper/bible-helpers/bibleReferenceTokenizer';

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

describe('normalizeBibleReferenceText', () => {
    test('reads digits of any script, and a Bible numbering of its own', () => {
        expect(normalizeBibleReferenceText('យ៉ូហាន ១៨.៣៣-១៩.១៦')).toBe(
            'យ៉ូហាន ១៨:៣៣-១៩:១៦',
        );
        const pattern = toBibleDigitPattern(['a', 'b', 'c', 'd']);
        expect(normalizeBibleReferenceText('Book b.c - d.a', pattern)).toBe(
            'Book b:c-d:a',
        );
    });
});

describe('tokenizeBibleRangeReference', () => {
    test('reads a Bible numbering of its own', () => {
        const pattern = toBibleDigitPattern(KHMER_DIGITS);
        expect(
            tokenizeBibleRangeReference('យ៉ូហាន ១៨:៣៣-១៩:១៦', pattern),
        ).toMatchObject({
            book: 'យ៉ូហាន',
            chapter: '១៨',
            verseStart: '៣៣',
            chapterEnd: '១៩',
            verseEnd: '១៦',
        });
        const ownPattern = toBibleDigitPattern(['a', 'b', 'c']);
        expect(
            tokenizeBibleRangeReference('Book b:c-c:a', ownPattern),
        ).toMatchObject({ chapter: 'b', chapterEnd: 'c', verseEnd: 'a' });
        expect(tokenizeBibleRangeReference('Book b:c-c:a')).toBeNull();
    });
});
