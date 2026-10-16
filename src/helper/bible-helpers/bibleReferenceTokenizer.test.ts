import { describe, expect, test } from 'vitest';

import {
    checkHasBibleRangeReference,
    normalizeBibleReferenceText,
    toBibleDigitPattern,
    tokenizeBibleRangeReference,
} from './bibleReferenceTokenizer';

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

function tokenize(text: string) {
    return tokenizeBibleRangeReference(normalizeBibleReferenceText(text));
}

describe('normalizeBibleReferenceText', () => {
    test.each([
        ['John 1:2–3:4', 'John 1:2-3:4'],
        ['John 1:2 — 3:4', 'John 1:2-3:4'],
        ['John 1:2－3:4', 'John 1:2-3:4'],
        ['John 1 : 2 - 3 : 4', 'John 1:2-3:4'],
        ['John 1:2 to 3:4', 'John 1:2-3:4'],
        ['John 1 THROUGH 3', 'John 1-3'],
        ['John 1:2 thru 3:4', 'John 1:2-3:4'],
        ['John 18.33-19.16', 'John 18:33-19:16'],
        ['John 3.', 'John 3:'],
        ['John 1:2--3:4', 'John 1:2-3:4'],
        ['John 3,16-4,2', 'John 3:16-4:2'],
        ['John 3:16, 18', 'John 3:16, 18'],
        ['1. Mose 1.1', '1. Mose 1:1'],
        ['Matt. 5:1', 'Matt. 5:1'],
        ['1 John 1:5', '1 John 1:5'],
        ['John', 'John'],
        ['Tomorrow to John', 'Tomorrow to John'],
    ])('%s => %s', (text, expected) => {
        expect(normalizeBibleReferenceText(text)).toBe(expected);
    });

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
    test.each([
        [
            'John 1:2-3:4',
            { chapter: '1', verseStart: '2', chapterEnd: '3', verseEnd: '4' },
        ],
        [
            'John 1:-2:',
            { chapter: '1', verseStart: null, chapterEnd: '2', verseEnd: null },
        ],
        [
            'John 1:4-3:-3',
            { chapter: '1', verseStart: '4', chapterEnd: '3', verseEnd: '3' },
        ],
        [
            'John 1:-3',
            { chapter: '1', verseStart: null, chapterEnd: null, verseEnd: '3' },
        ],
        [
            'John 1:-',
            {
                chapter: '1',
                verseStart: null,
                chapterEnd: null,
                verseEnd: null,
            },
        ],
        [
            'John 1:2-3:',
            { chapter: '1', verseStart: '2', chapterEnd: '3', verseEnd: null },
        ],
        [
            'John 1-3:5',
            { chapter: '1', verseStart: null, chapterEnd: '3', verseEnd: '5' },
        ],
        [
            '1 John 1:5-2:2',
            { chapter: '1', verseStart: '5', chapterEnd: '2', verseEnd: '2' },
        ],
    ])('%s', (text, expected) => {
        expect(tokenize(text)).toEqual({
            book: text.slice(0, text.lastIndexOf(' ')),
            isWithoutColon: false,
            ...expected,
        });
    });

    test('a range with no colon is chapters, or verses of a one-chapter book', () => {
        expect(tokenize('John 1-3')).toEqual({
            book: 'John',
            chapter: '1',
            verseStart: null,
            chapterEnd: '3',
            verseEnd: null,
            isWithoutColon: true,
        });
        expect(tokenize('John 1-')).toEqual({
            book: 'John',
            chapter: '1',
            verseStart: null,
            chapterEnd: null,
            verseEnd: null,
            isWithoutColon: true,
        });
    });

    // Every form the legacy parser reads stays the legacy parser's.
    test.each([
        'John',
        'John 3',
        'John 3:',
        'John 3:16',
        'John 3:16-18',
        'John 3:16-',
        'JHN 3:16-17',
        '(KJV) John 3:16',
        'John 3:16 niv',
        '3:16-4:2',
        'John 1:2-3:4:5',
        'John 1:2-3-4',
        'John a-b',
    ])('leaves %s alone', (text) => {
        expect(tokenize(text)).toBeNull();
    });

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

describe('checkHasBibleRangeReference', () => {
    test('finds a range beside a version name', () => {
        expect(checkHasBibleRangeReference('John 1:2-3:4 (esv)')).toBe(true);
        expect(checkHasBibleRangeReference('niv John 1-3')).toBe(true);
        expect(checkHasBibleRangeReference('John 3:16-18 niv')).toBe(false);
        expect(checkHasBibleRangeReference('John 3:16')).toBe(false);
    });
});

describe('toBibleDigitPattern', () => {
    test('adds only the digits that are not already decimal digits', () => {
        expect(toBibleDigitPattern()).toBe(String.raw`\p{Nd}`);
        expect(toBibleDigitPattern(KHMER_DIGITS)).toBe(String.raw`\p{Nd}`);
        expect(toBibleDigitPattern(['x', '.', ''])).toBe(
            String.raw`(?:\p{Nd}|x|\.)`,
        );
    });
});
