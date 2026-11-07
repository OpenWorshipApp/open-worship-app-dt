import { describe, expect, it } from 'vitest';

import {
    checkIsOneEditApart,
    cutNamedBooks,
    findNamedBooks,
    parseRefParts,
    pickBibleKeyForBookName,
    resolveBookFilter,
    resolveBookKey,
    segmentByVocabulary,
    stripLeadingFrameWords,
    toSingleVerseText,
} from '../../../../../../helper/bibleVerseFindHelpers';

const ENGLISH_NAMES = {
    GEN: 'Genesis',
    JOB: 'Job',
    PSA: 'Psalms',
    JHN: 'John',
    '1JN': '1 John',
    JOS: 'Joshua',
    JOL: 'Joel',
    JDG: 'Judges',
    JUD: 'Jude',
    MAT: 'Matthew',
    PHP: 'Philippians',
    PHM: 'Philemon',
    REV: 'Revelation',
};

describe('letters typed with no space', () => {
    // The user's own, 2026-10-16: "Jesus asked Peter many times", typed as
    // one run of Khmer letters, matched nothing.
    const vocabulary = new Set([
        'ព្រះ',
        'យេស',
        'សួរ',
        'ពេត្រុស',
        'ច្រើន',
        'ដង',
    ]);

    it('cuts them into the words the Bible uses', () => {
        expect(
            segmentByVocabulary('ព្រះយេស៊ូសួរពេត្រុសច្រើនដង', vocabulary),
        ).toEqual(['ព្រះ', 'យេស៊ូ', 'សួរ', 'ពេត្រុស', 'ច្រើន', 'ដង']);
    });

    it('keeps letters no word starts with, together', () => {
        expect(segmentByVocabulary('xyzសួរab', vocabulary)).toEqual([
            'xyz',
            'សួរ',
            'ab',
        ]);
        expect(segmentByVocabulary('', vocabulary)).toEqual([]);
    });

    it('takes the longest word first', () => {
        expect(
            segmentByVocabulary('abcd', new Set(['ab', 'abc', 'cd'])),
        ).toEqual(['abc', 'd']);
    });
});

describe('a found row', () => {
    it('takes the number off a single verse’s text', () => {
        expect(toSingleVerseText('(34): Take therefore')).toBe(
            'Take therefore',
        );
        expect(toSingleVerseText('(១៦): ដ្បិត')).toBe('ដ្បិត');
        expect(toSingleVerseText('Take (34): it')).toBe('Take (34): it');
    });
});

describe('a book named as it is said', () => {
    const nameMapList = [{ JHN: 'យ៉ូហាន' }, ENGLISH_NAMES];

    it('reads a code, a name, a singular and the Bible’s own name', () => {
        expect(resolveBookKey('JHN', nameMapList)).toBe('JHN');
        expect(resolveBookKey('john', nameMapList)).toBe('JHN');
        expect(resolveBookKey('1 John', nameMapList)).toBe('1JN');
        expect(resolveBookKey('1john', nameMapList)).toBe('1JN');
        expect(resolveBookKey('Psalm', nameMapList)).toBe('PSA');
        // The KJV's own name is the singular.
        expect(resolveBookKey('Psalms', [{ PSA: 'Psalm' }])).toBe('PSA');
        expect(resolveBookKey('Rev', nameMapList)).toBe('REV');
        expect(resolveBookKey('Philip', nameMapList)).toBe('PHP');
        expect(resolveBookKey('jud', nameMapList)).toBe('JUD');
        expect(resolveBookKey('យ៉ូហាន', nameMapList)).toBe('JHN');
    });

    it('guesses no book a short form leaves open', () => {
        expect(resolveBookKey('Jo', nameMapList)).toBeNull();
        expect(resolveBookKey('Phil.', nameMapList)).toBeNull();
        expect(resolveBookKey('Ju', nameMapList)).toBeNull();
        expect(resolveBookKey('Hezekiah', nameMapList)).toBeNull();
        expect(resolveBookKey('', nameMapList)).toBeNull();
    });

    it('narrows a search to the books named, and names the rest', () => {
        expect(
            resolveBookFilter('Matthew, John and Psalms; Hezekiah', [
                ENGLISH_NAMES,
            ]),
        ).toEqual({ bookKeys: ['MAT', 'JHN', 'PSA'], unknown: ['Hezekiah'] });
    });
});

describe('references as they are written', () => {
    it('reads a reference in the reader’s own digits', () => {
        // A Resources `ref` written as the person said it (2026-10-19).
        expect(parseRefParts('ម៉ាថាយ ១៨')).toEqual({
            book: 'ម៉ាថាយ',
            chapter: 18,
            verseStart: null,
            verseEnd: null,
        });
        expect(parseRefParts('យ៉ូហាន ៣:១៦')?.verseStart).toBe(16);
    });
});

describe('the Bible that names the book the way it was written', () => {
    const INFO_LIST = [
        { key: 'KJV', keyBookMap: { GEN: 'Genesis', JHN: 'John' } },
        { key: 'ពគប', keyBookMap: { GEN: 'លោកុប្បត្តិ', JHN: 'យ៉ូហាន' } },
    ];

    it('is the preferred one when it has the name', () => {
        expect(pickBibleKeyForBookName('Genesis', INFO_LIST, 'KJV')).toBe(
            'KJV',
        );
    });

    it('else the one that does', () => {
        expect(pickBibleKeyForBookName('លោកុប្បត្តិ', INFO_LIST, 'KJV')).toBe(
            'ពគប',
        );
        expect(pickBibleKeyForBookName('1 John', INFO_LIST, 'KJV')).toBe('KJV');
    });

    it('else the preferred one, never a guess', () => {
        expect(pickBibleKeyForBookName('Psalms', INFO_LIST, 'KJV')).toBe('KJV');
        expect(pickBibleKeyForBookName('', INFO_LIST, 'KJV')).toBe('KJV');
    });
});

describe('a book named among the words remembered', () => {
    const KHMER_NAMES = {
        GEN: 'លោកុប្បត្តិ',
        PSA: 'ទំនុកដំកើង',
        JON: 'យ៉ូណាស',
    };
    const SONG_NAMES = { SNG: 'Song of Solomon', '1SA': '1 Samuel' };

    it('reads one letter off, never a short name', () => {
        expect(checkIsOneEditApart('លោកុប្បត្តិ', 'លោកប្បត្តិ')).toBe(true);
        expect(checkIsOneEditApart('genesis', 'genisis')).toBe(true);
        expect(checkIsOneEditApart('genesis', 'genesiss')).toBe(true);
        expect(checkIsOneEditApart('genesis', 'gensis')).toBe(true);
        expect(checkIsOneEditApart('genesis', 'gnsis')).toBe(false);
        expect(
            findNamedBooks('the jab of the sword', [ENGLISH_NAMES], [], true),
        ).toEqual([]);
    });

    it('finds the misspelt Genesis inside a run, after "book"', () => {
        // The user's own, 2026-10-22: search in the book of Genesis -- a
        // vowel sign left out -- Noah released the dove.
        const text = 'ស្វែងរកក្នុងគម្ពីរលោកប្បត្តិណូអេលែងព្រាប';
        const found = findNamedBooks(
            text,
            [KHMER_NAMES],
            ['ក្នុង', 'គម្ពីរ'],
            false,
        );
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({
            bookKey: 'GEN',
            typed: 'លោកប្បត្តិ',
            isAfterMarker: true,
            isNear: true,
        });
        expect(cutNamedBooks(text, found)).toBe('ស្វែងរកក្នុង ណូអេលែងព្រាប');
    });

    it('finds a name of several words and the word that marks it', () => {
        const found = findNamedBooks(
            'in song of solomon my beloved',
            [SONG_NAMES, ENGLISH_NAMES],
            ['in'],
            true,
        );
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({
            bookKey: 'SNG',
            isAfterMarker: true,
            isNear: false,
        });
        expect(cutNamedBooks('in song of solomon my beloved', found)).toBe(
            'my beloved',
        );
        // "within" does not end in the word "in".
        expect(
            findNamedBooks('within genesis', [ENGLISH_NAMES], ['in'], true)[0]
                ?.isAfterMarker,
        ).toBe(false);
        // A person's name is found as a book too; the caller decides by
        // whether the verses use it.
        expect(
            findNamedBooks(
                'jonah whale belly',
                [{ JON: 'Jonah' }],
                ['in'],
                true,
            )[0],
        ).toMatchObject({ bookKey: 'JON', isAfterMarker: false });
    });
});

describe('the words of asking, taken off the front', () => {
    it('takes the front of a run of letters', () => {
        expect(
            stripLeadingFrameWords(
                'ស្វែងរកក្នុង ណូអេលែងព្រាប',
                ['ស្វែងរក', 'ក្នុង', 'រឿង'],
                () => false,
                false,
            ),
        ).toBe('ណូអេលែងព្រាប');
        expect(
            stripLeadingFrameWords('រឿងទឹកជំនន់', ['រឿង'], () => false, false),
        ).toBe('ទឹកជំនន់');
        expect(stripLeadingFrameWords('រឿង', ['រឿង'], () => false, false)).toBe(
            'រឿង',
        );
    });
});

describe('a book named inside an unspaced run', () => {
    const KHMER_NAMES = {
        GEN: 'លោកុប្បត្តិ',
        // Shorter than a one-letter-off guess is ever tried for.
        JOB: 'យ៉ូប',
    };

    it('finds a whole name inside an unspaced run before trying near ones', () => {
        const text = 'ស្វែងរកក្នុងលោកុប្បត្តិណូអេ';
        const found = findNamedBooks(text, [KHMER_NAMES], ['ក្នុង'], false);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({
            bookKey: 'GEN',
            typed: 'លោកុប្បត្តិ',
            isAfterMarker: true,
            isNear: false,
        });
        expect(cutNamedBooks(text, found)).toBe('ស្វែងរក ណូអេ');
    });

    it('guesses only a long name one letter off, never a short one', () => {
        // `យ៉ូ` is one letter off `យ៉ូប`, but that name is too short to guess.
        const found = findNamedBooks('យ៉ូលោកប្បត្តិ', [KHMER_NAMES], [], false);
        expect(found.map(({ bookKey, isNear }) => [bookKey, isNear])).toEqual([
            ['GEN', true],
        ]);
    });
});
