import { describe, expect, test, vi } from 'vitest';

// The module under test reaches for the data folder and the app version at
// import time through these; the matching functions themselves are pure.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        appInfo: { version: '1.0.0' },
        messageUtils: { sendData: vi.fn() },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: vi.fn(async () => false),
    fsCreateDir: vi.fn(async () => undefined),
    fsReadFile: vi.fn(async () => null),
    fsWriteFile: vi.fn(async () => ''),
    pathJoin: (...paths: string[]) => paths.join('/'),
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorage: '/tmp/data' },
}));

import {
    checkCanLookupVerseText,
    findLookupTextMatches,
    toVerseTextSegments,
} from './verseTextIndexHelpers';
import type { LookupTextIndexType } from './verseTextIndexTypes';
import { LOOKUP_TEXT_INDEX_VERSION } from './verseTextIndexTypes';

const ABRAM = 'id-abram';
const JOSEPH_PATRIARCH = 'id-joseph-1';
const JOSEPH_HUSBAND = 'id-joseph-2';
const HARAN_PLACE = 'id-haran-place';
const MARY_MAGDALENE = 'id-mary-magdalene';
const MARY = 'id-mary';
const HARAN_SON = 'id-haran-son';
const HARAN_OTHER = 'id-haran-other';

function genIndex(): LookupTextIndexType {
    const ids = [
        ABRAM,
        JOSEPH_PATRIARCH,
        JOSEPH_HUSBAND,
        HARAN_PLACE,
        MARY_MAGDALENE,
        MARY,
        HARAN_SON,
        HARAN_OTHER,
    ];
    return {
        version: LOOKUP_TEXT_INDEX_VERSION,
        ids,
        names: {
            abram: [0],
            joseph: [1, 2],
            'mary magdalene': [4],
            mary: [5],
            // Borne by people AND by a city — the hard case.
            haran: [6, 7],
        },
        locations: {
            haran: [3],
        },
        verseNames: {
            // Only the patriarch is attested here, so `Joseph` is resolvable.
            'GEN 37:2': [1],
            // Both Josephs are attested, so `Joseph` must stay ambiguous.
            'MAT 1:16': [1, 2],
            'JHN 20:1': [4, 5],
            'GEN 11:27': [6],
        },
        verseLocations: {
            'GEN 11:31': [3],
        },
    };
}

describe('findLookupTextMatches', () => {
    test('matches a name borne by exactly one record without any evidence', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'And Abram went down into Egypt.',
            'GEN 12:10',
        );
        expect(matchList).toHaveLength(1);
        expect(matchList[0]).toMatchObject({
            text: 'Abram',
            kind: 'name',
            recordId: ABRAM,
            start: 4,
            end: 9,
        });
    });

    test('uses verse evidence to disambiguate a shared name', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'These are the generations of Joseph.',
            'GEN 37:2',
        );
        expect(matchList).toHaveLength(1);
        expect(matchList[0].recordId).toBe(JOSEPH_PATRIARCH);
    });

    test('leaves a name ambiguous under competing evidence unmatched', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'And Jacob begat Joseph.',
            'MAT 1:16',
        );
        expect(matchList).toEqual([]);
    });

    test('leaves a shared name with no evidence at all unmatched', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'Joseph went out.',
            'LUK 2:4',
        );
        expect(matchList).toEqual([]);
    });

    test('matches locations as well as names', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'And they came unto Haran, and dwelt there.',
            'GEN 11:31',
        );
        expect(matchList).toHaveLength(1);
        expect(matchList[0]).toMatchObject({
            text: 'Haran',
            kind: 'location',
            recordId: HARAN_PLACE,
        });
    });

    test('picks the person when the verse attests the person, not the city', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'and Haran begat Lot.',
            'GEN 11:27',
        );
        expect(matchList).toHaveLength(1);
        expect(matchList[0]).toMatchObject({
            kind: 'name',
            recordId: HARAN_SON,
        });
    });

    test('never falls back to the other kind when a form is both', () => {
        // "Haran" is two people and a city, and this verse attests none of
        // them. Preferring the city just because its list holds one entry would
        // turn Terah's son into a place.
        const matchList = findLookupTextMatches(
            genIndex(),
            'and begat Abram, Nahor, and Haran.',
            'GEN 11:26',
        );
        expect(matchList.map((match) => match.text)).toEqual(['Abram']);
    });

    test('prefers the longest phrase over its first word', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'Then cometh Mary Magdalene early.',
            'JHN 20:1',
        );
        expect(matchList).toHaveLength(1);
        expect(matchList[0]).toMatchObject({
            text: 'Mary Magdalene',
            recordId: MARY_MAGDALENE,
        });
    });

    test('excludes a trailing possessive from the highlighted range', () => {
        const text = "Abram's wife was Sarai.";
        const matchList = findLookupTextMatches(genIndex(), text, 'GEN 11:29');
        expect(matchList).toHaveLength(1);
        expect(matchList[0].text).toBe('Abram');
        expect(text.slice(matchList[0].start, matchList[0].end)).toBe('Abram');
    });

    test('ignores lowercase words that happen to spell a name', () => {
        const matchList = findLookupTextMatches(
            genIndex(),
            'they went abram down',
            'GEN 12:10',
        );
        expect(matchList).toEqual([]);
    });

    test('returns nothing for text with no names', () => {
        expect(
            findLookupTextMatches(genIndex(), 'In the beginning.', 'GEN 1:1'),
        ).toEqual([]);
    });
});

describe('toVerseTextSegments', () => {
    test('returns null when there is nothing to decorate', () => {
        expect(
            toVerseTextSegments(genIndex(), 'In the beginning.', 'GEN 1:1'),
        ).toBeNull();
        expect(
            toVerseTextSegments(null, 'And Abram went.', 'GEN 12:10'),
        ).toBeNull();
        expect(toVerseTextSegments(genIndex(), '', 'GEN 12:10')).toBeNull();
    });

    test('splits into plain runs and matches without losing a character', () => {
        const text = 'And Abram went down into Egypt.';
        const segmentList = toVerseTextSegments(genIndex(), text, 'GEN 12:10');
        expect(segmentList).not.toBeNull();
        expect(segmentList).toEqual([
            { kind: 'text', text: 'And ' },
            {
                kind: 'match',
                match: expect.objectContaining({ text: 'Abram' }),
            },
            { kind: 'text', text: ' went down into Egypt.' },
        ]);
        const rebuilt = segmentList!
            .map((segment) => {
                return segment.kind === 'text'
                    ? segment.text
                    : segment.match.text;
            })
            .join('');
        expect(rebuilt).toBe(text);
    });

    test('keeps the possessive suffix in the surrounding text run', () => {
        const text = "Abram's wife was Sarai.";
        const segmentList = toVerseTextSegments(genIndex(), text, 'GEN 11:29');
        const rebuilt = segmentList!
            .map((segment) => {
                return segment.kind === 'text'
                    ? segment.text
                    : segment.match.text;
            })
            .join('');
        expect(rebuilt).toBe(text);
    });
});

describe('checkCanLookupVerseText', () => {
    test('accepts KJV only — the dataset was extracted from it', () => {
        expect(checkCanLookupVerseText('KJV')).toBe(true);
        // Another English translation words the same verse differently, so the
        // KJV-keyed evidence must not be applied to it.
        expect(checkCanLookupVerseText('NIV')).toBe(false);
        expect(checkCanLookupVerseText('ESV')).toBe(false);
        expect(checkCanLookupVerseText('KJVD')).toBe(false);
        expect(checkCanLookupVerseText('ពគប')).toBe(false);
        expect(checkCanLookupVerseText('')).toBe(false);
    });
});
