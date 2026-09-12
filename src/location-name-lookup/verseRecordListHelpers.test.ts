import { describe, expect, test, vi } from 'vitest';

// `verseRecordListHelpers` pulls in the file-backed store at import time, which
// reaches for the data folder and the app version. The query itself is pure.
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
    checkIsRecordLabelsMatching,
    collectVerseRecords,
    toVerseListLabel,
} from './verseRecordListHelpers';
import type {
    LookupRecordLabelsType,
    LookupTextIndexType,
} from './verseTextIndexTypes';
import { LOOKUP_TEXT_INDEX_VERSION } from './verseTextIndexTypes';

const TIBERIUS = 'id-tiberius';
const PILATE = 'id-pilate';
const JOHN = 'id-john';
const JUDAEA = 'id-judaea';
const JORDAN = 'id-jordan';
const UNNAMED = 'id-unnamed';
// Named in the text but absent from the verse evidence — the real dataset does
// this (Luke 13:1 says "Pilate" and the evidence map does not list him).
const HEROD = 'id-herod';
const ITURAEA = 'id-ituraea';

function genIndex(): LookupTextIndexType {
    return {
        version: LOOKUP_TEXT_INDEX_VERSION,
        ids: [TIBERIUS, PILATE, JOHN, JUDAEA, JORDAN, UNNAMED, HEROD, ITURAEA],
        names: { herod: [6] },
        locations: { ituraea: [7] },
        verseNames: {
            'LUK 3:1': [0, 1],
            'LUK 3:2': [2, 5],
            'LUK 3:3': [2],
        },
        verseLocations: {
            'LUK 3:1': [3],
            'LUK 3:3': [4],
        },
    };
}

function genRecordLabels(): LookupRecordLabelsType {
    return {
        version: LOOKUP_TEXT_INDEX_VERSION,
        labels: [
            'Tiberius Caesar',
            'Pontius Pilate',
            'John the Baptist',
            'Judaea',
            'Jordan',
            // Attested by the dataset but never named: nothing to show.
            '',
            'Herod the Tetrarch',
            'Ituraea',
        ],
        types: ['person', 'person', 'person', '', '', 'person', 'person', ''],
        // A Khmer sidecar: the English name is kept beside the translated
        // label. `Jordan` stands for a record the translation does not cover,
        // whose label stayed English and so has nothing to add.
        kjvNames: [
            'Tiberius Caesar',
            'Pontius Pilate',
            'John the Baptist',
            'Judaea',
            '',
            '',
            'Herod the Tetrarch',
            'Ituraea',
        ],
        titles: [
            'Roman emperor',
            'governor of Judaea',
            'forerunner of Christ',
            'Roman province',
            'river of Israel',
            '',
            'tetrarch of Galilee',
            'region north-east of Galilee',
        ],
    };
}

const LUKE_3_1_TO_3 = {
    bookKey: 'LUK',
    chapter: 3,
    verseStart: 1,
    verseEnd: 3,
};

describe('collectVerseRecords', () => {
    test('collects names and locations across the whole verse range', () => {
        const { names, locations } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            null,
        );
        expect(names.map((record) => record.label)).toEqual([
            'Tiberius Caesar',
            'Pontius Pilate',
            'John the Baptist',
        ]);
        expect(locations.map((record) => record.label)).toEqual([
            'Judaea',
            'Jordan',
        ]);
    });

    test('lists a record spanning several verses once, with every verse', () => {
        const { names } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            null,
        );
        const john = names.find((record) => {
            return record.recordId === JOHN;
        });
        expect(john?.verseList).toEqual([2, 3]);
        expect(names.filter((record) => record.recordId === JOHN)).toHaveLength(
            1,
        );
    });

    test('carries the title and an icon matching the record type', () => {
        const { names, locations } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            null,
        );
        expect(names[0].title).toBe('Roman emperor');
        expect(names[0].iconClass).toBe('bi bi-person-fill');
        expect(names[0].kind).toBe('name');
        expect(locations[0].iconClass).toBe('bi bi-geo-alt-fill');
        expect(locations[0].kind).toBe('location');
    });

    test('carries the English name beside a translated label', () => {
        const { names, locations } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            null,
        );
        expect(names[0].kjvName).toBe('Tiberius Caesar');
        expect(locations[0].kjvName).toBe('Judaea');
        // Untranslated: the label already IS the English name.
        expect(locations[1].kjvName).toBe('');
    });

    test('drops a record the sidecar has no name for', () => {
        const { names } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            null,
        );
        expect(names.some((record) => record.recordId === UNNAMED)).toBe(false);
    });

    test('returns nothing for a verse the dataset does not attest', () => {
        const result = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            {
                bookKey: 'LUK',
                chapter: 3,
                verseStart: 10,
                verseEnd: 12,
            },
            null,
        );
        expect(result.names).toEqual([]);
        expect(result.locations).toEqual([]);
    });

    test('returns nothing for an inverted range', () => {
        const result = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            {
                bookKey: 'LUK',
                chapter: 3,
                verseStart: 3,
                verseEnd: 1,
            },
            null,
        );
        expect(result.names).toEqual([]);
    });

    test('reads a single verse, not the whole chapter', () => {
        const { names, locations } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            { bookKey: 'LUK', chapter: 3, verseStart: 1, verseEnd: 1 },
            null,
        );
        expect(names.map((record) => record.label)).toEqual([
            'Tiberius Caesar',
            'Pontius Pilate',
        ]);
        expect(locations.map((record) => record.label)).toEqual(['Judaea']);
    });

    // The two derived files are written by one build pass, so a length mismatch
    // means one of them is damaged — labelling records by the wrong index would
    // silently attribute every name to the wrong person.
    test('refuses to guess when the sidecar does not match the index', () => {
        const recordLabels = genRecordLabels();
        recordLabels.labels = recordLabels.labels.slice(0, 2);
        const result = collectVerseRecords(
            genIndex(),
            recordLabels,
            LUKE_3_1_TO_3,
            null,
        );
        expect(result.names).toEqual([]);
        expect(result.locations).toEqual([]);
    });
});

describe('collectVerseRecords with the KJV wording', () => {
    const KJV_LUKE_3 = {
        '1': 'Herod being tetrarch of Galilee, and of the region of Ituraea',
        '2': 'the word of God came unto John',
        '3': 'And he came into all the country about Jordan',
    };

    // The evidence map is incomplete, and the reader underlines what the scan
    // finds — a list that omitted it would contradict the verse on screen.
    test('adds records the text names but the evidence map omits', () => {
        const { names, locations } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            KJV_LUKE_3,
        );
        expect(names.map((record) => record.label)).toContain(
            'Herod the Tetrarch',
        );
        expect(locations.map((record) => record.label)).toContain('Ituraea');
    });

    test('keeps the evidence-only records the text never spells out', () => {
        const { names } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            KJV_LUKE_3,
        );
        // Neither name appears in the wording above; both come from evidence.
        expect(names.map((record) => record.label)).toEqual(
            expect.arrayContaining(['Tiberius Caesar', 'Pontius Pilate']),
        );
    });

    test('does not list a record twice when both sources name it', () => {
        const { names } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            LUKE_3_1_TO_3,
            // `John` is in the evidence for 3:2 AND in the wording.
            KJV_LUKE_3,
        );
        const john = names.filter((record) => record.recordId === JOHN);
        expect(john).toHaveLength(1);
        expect(john[0].verseList).toEqual([2, 3]);
    });

    test('ignores verses of the chapter outside the target range', () => {
        const { names } = collectVerseRecords(
            genIndex(),
            genRecordLabels(),
            { bookKey: 'LUK', chapter: 3, verseStart: 2, verseEnd: 2 },
            KJV_LUKE_3,
        );
        expect(names.map((record) => record.label)).not.toContain(
            'Herod the Tetrarch',
        );
    });
});

describe('checkIsRecordLabelsMatching', () => {
    test('accepts a sidecar with one label per interned record', () => {
        expect(checkIsRecordLabelsMatching(genIndex(), genRecordLabels())).toBe(
            true,
        );
    });

    test('rejects a sidecar of a different length', () => {
        const recordLabels = genRecordLabels();
        recordLabels.labels = [...recordLabels.labels, 'extra'];
        expect(checkIsRecordLabelsMatching(genIndex(), recordLabels)).toBe(
            false,
        );
    });
});

describe('toVerseListLabel', () => {
    test('prefixes every verse with its chapter', () => {
        expect(toVerseListLabel(3, [1, 2, 3])).toBe('3:1, 3:2, 3:3');
    });

    test('renders a single verse without a separator', () => {
        expect(toVerseListLabel(13, [5])).toBe('13:5');
    });
});
