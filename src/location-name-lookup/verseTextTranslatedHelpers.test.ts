import { describe, expect, test, vi } from 'vitest';

// Same reach as `verseTextIndexHelpers.test.ts`: the module pulls the file
// helpers in at import time through the store it exports, while the matching
// itself is pure.
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
    fsDeleteFile: vi.fn(async () => undefined),
    fsReadFile: vi.fn(async () => null),
    fsWriteFile: vi.fn(async () => ''),
    pathJoin: (...paths: string[]) => paths.join('/'),
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorage: '/tmp/data' },
}));

import { findTranslatedLookupMatches } from './verseTextTranslatedHelpers';
import type {
    LookupTextIndexType,
    LookupTextNeedlesType,
} from './verseTextIndexTypes';
import {
    LOOKUP_TEXT_INDEX_VERSION,
    NEEDLE_SEPARATOR,
} from './verseTextIndexTypes';

const ADAM = 'id-adam';
const ADAH = 'id-adah';
const EVE = 'id-eve';
const CAIN = 'id-cain';
// Attested nowhere near Genesis, and its Khmer name is the ordinary word for
// "wild" — the case that made the dataset-wide fallback unusable here.
const SCYTHIA = 'id-scythia';
const HARAN_PLACE = 'id-haran-place';
const JOSEPH_ONE = 'id-joseph-1';
const JOSEPH_TWO = 'id-joseph-2';

const IDS = [
    ADAM,
    ADAH,
    EVE,
    CAIN,
    SCYTHIA,
    HARAN_PLACE,
    JOSEPH_ONE,
    JOSEPH_TWO,
];
const ADAM_INDEX = 0;
const ADAH_INDEX = 1;
const EVE_INDEX = 2;
const CAIN_INDEX = 3;
const SCYTHIA_INDEX = 4;
const HARAN_INDEX = 5;
const JOSEPH_ONE_INDEX = 6;
const JOSEPH_TWO_INDEX = 7;

const ADAM_KM = 'អ័ដាម';
const ADAH_KM = 'អ័ដា';
const EVE_KM = 'អេវ៉ា';
const CAIN_KM = 'កាអ៊ីន';
const SCYTHIA_KM = 'ព្រៃ';
const HARAN_KM = 'ហារ៉ាន';
const JOSEPH_KM = 'យ៉ូសែប';

const ZERO_WIDTH_SPACE = '​';

function genIndex(): LookupTextIndexType {
    return {
        version: LOOKUP_TEXT_INDEX_VERSION,
        ids: IDS,
        // The English needle maps play no part in this path at all.
        names: {},
        locations: {},
        verseNames: {
            'GEN 4:1': [ADAM_INDEX, EVE_INDEX, CAIN_INDEX],
            // Adam is spelled out here too, but the evidence map only lists
            // Adah — the chapter tier is what covers that.
            'GEN 4:19': [ADAH_INDEX],
            'GEN 5:1': [ADAM_INDEX],
            // Both Josephs at once: unresolvable, exactly as in English.
            'MAT 1:16': [JOSEPH_ONE_INDEX, JOSEPH_TWO_INDEX],
        },
        verseLocations: {
            'GEN 11:31': [HARAN_INDEX],
        },
    };
}

function genNeedles(): LookupTextNeedlesType {
    const needles = IDS.map(() => '');
    needles[ADAM_INDEX] = ADAM_KM;
    needles[ADAH_INDEX] = ADAH_KM;
    needles[EVE_INDEX] = EVE_KM;
    needles[CAIN_INDEX] = CAIN_KM;
    needles[SCYTHIA_INDEX] = SCYTHIA_KM;
    needles[HARAN_INDEX] = HARAN_KM;
    needles[JOSEPH_ONE_INDEX] = JOSEPH_KM;
    needles[JOSEPH_TWO_INDEX] = JOSEPH_KM;
    return { version: LOOKUP_TEXT_INDEX_VERSION, needles };
}

function toFoundList(text: string, kjvShortVerse: string) {
    return findTranslatedLookupMatches(
        genIndex(),
        genNeedles(),
        text,
        kjvShortVerse,
    ).map((match) => {
        return {
            recordId: match.recordId,
            kind: match.kind,
            // Proves the offsets point into the original string.
            sliced: text.slice(match.start, match.end),
        };
    });
}

describe('findTranslatedLookupMatches', () => {
    test('finds every name the verse itself attests', () => {
        const text = `${ADAM_KM}ក៏ស្គាល់${EVE_KM}ជាប្រពន្ធ បង្កើតបាន${CAIN_KM}`;
        expect(toFoundList(text, 'GEN 4:1')).toEqual([
            { recordId: ADAM, kind: 'name', sliced: ADAM_KM },
            { recordId: EVE, kind: 'name', sliced: EVE_KM },
            { recordId: CAIN, kind: 'name', sliced: CAIN_KM },
        ]);
    });

    test('reads through the zero-width spaces Khmer marks its words with', () => {
        const spacedName = ADAM_KM.split('').join(ZERO_WIDTH_SPACE);
        const text = `${ZERO_WIDTH_SPACE}${spacedName}${ZERO_WIDTH_SPACE}ក៏`;
        const foundList = toFoundList(text, 'GEN 5:1');
        expect(foundList).toHaveLength(1);
        expect(foundList[0].recordId).toBe(ADAM);
        // The decoration covers the spaced spelling exactly, so the verse still
        // renders character for character.
        expect(foundList[0].sliced).toBe(spacedName);
    });

    test('the chapter tier covers a verse the evidence map skipped', () => {
        // Adam is listed for GEN 4:1 and not for GEN 4:19, and his name is in
        // both.
        const foundList = toFoundList(`${ADAM_KM}មានប្រពន្ធ`, 'GEN 4:19');
        expect(foundList).toEqual([
            { recordId: ADAM, kind: 'name', sliced: ADAM_KM },
        ]);
    });

    test('a record attested nowhere in the chapter never matches', () => {
        // `ព្រៃ` is Scythia in the dataset and "wild" in ordinary Khmer. It is
        // the only record bearing that form, so a dataset-wide tier would mark
        // it; there is deliberately no such tier.
        expect(toFoundList(`សត្វ${SCYTHIA_KM}នៅទីនោះ`, 'GEN 4:1')).toEqual([]);
        expect(toFoundList(`សត្វ${SCYTHIA_KM}នៅទីនោះ`, 'MAT 1:16')).toEqual([]);
    });

    test('the longer name wins where one is a prefix of the other', () => {
        // Adah is attested for this verse and Adam only for the chapter, so the
        // shorter form is the one with the stronger evidence — and still loses,
        // because it is not what the text says.
        const foundList = toFoundList(`${ADAM_KM}ក៏`, 'GEN 4:19');
        expect(foundList).toEqual([
            { recordId: ADAM, kind: 'name', sliced: ADAM_KM },
        ]);
        expect(toFoundList(`${ADAH_KM}ក៏`, 'GEN 4:19')).toEqual([
            { recordId: ADAH, kind: 'name', sliced: ADAH_KM },
        ]);
    });

    test('two records writing their name the same way stay plain text', () => {
        expect(toFoundList(`${JOSEPH_KM}ជាប្តី`, 'MAT 1:16')).toEqual([]);
    });

    test('a location is found and reported as one', () => {
        expect(toFoundList(`ទៅដល់${HARAN_KM}`, 'GEN 11:31')).toEqual([
            { recordId: HARAN_PLACE, kind: 'location', sliced: HARAN_KM },
        ]);
    });

    test('every occurrence in the verse is decorated, not only the first', () => {
        const text = `${CAIN_KM}ថា ${CAIN_KM}ក៏`;
        expect(toFoundList(text, 'GEN 4:1')).toEqual([
            { recordId: CAIN, kind: 'name', sliced: CAIN_KM },
            { recordId: CAIN, kind: 'name', sliced: CAIN_KM },
        ]);
    });

    test('a record the translation does not cover contributes nothing', () => {
        const needles = genNeedles();
        needles.needles[CAIN_INDEX] = '';
        const foundList = findTranslatedLookupMatches(
            genIndex(),
            needles,
            `${CAIN_KM}ថា`,
            'GEN 4:1',
        );
        expect(foundList).toEqual([]);
    });

    test('a record with several forms is found by any of them', () => {
        const needles = genNeedles();
        needles.needles[CAIN_INDEX] = [CAIN_KM, 'កាអ៊ី'].join(NEEDLE_SEPARATOR);
        const foundList = findTranslatedLookupMatches(
            genIndex(),
            needles,
            'កាអ៊ីថា',
            'GEN 4:1',
        );
        expect(foundList).toHaveLength(1);
        expect(foundList[0].recordId).toBe(CAIN);
    });

    test('an empty verse and a malformed reference are answered with nothing', () => {
        expect(toFoundList('', 'GEN 4:1')).toEqual([]);
        expect(toFoundList(ADAM_KM, 'GEN 4')).toEqual([]);
    });
});
