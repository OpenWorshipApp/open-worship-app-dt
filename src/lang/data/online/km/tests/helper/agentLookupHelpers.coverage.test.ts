// @vitest-environment jsdom
/**
 * `owa_lookup_record`'s passage reads beyond the plain quote: `near` (the
 * verse or chapter beside one), `names` (the people and places of the names
 * lookup in it), `related` (the app's cross references, the verses around
 * it, the person's own notes on it, all sized to fit one card), the Bible a
 * read falls back to, and the record reads' refusals. The pure helpers it
 * leans on (`agentCrossRefHelpers`, `agentPassageNoteHelpers`,
 * `agentLookupRecordHelpers`, `bibleTargetHelpers`) are the real ones; the
 * Bible, the cross-reference bundle, the note indexes and the names dataset
 * are a small fake Bible held here.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks, BOOK_MAP, toEnglishRef } = vi.hoisted(() => {
    const BOOK_MAP: Record<string, string> = {
        GEN: 'Genesis',
        EXO: 'Exodus',
        LEV: 'Leviticus',
        PSA: 'Psalms',
        ISA: 'Isaiah',
        JER: 'Jeremiah',
        OBA: 'Obadiah',
        MAT: 'Matthew',
        LUK: 'Luke',
        JHN: 'John',
        EPH: 'Ephesians',
        HEB: 'Hebrews',
        '2PE': '2 Peter',
        REV: 'Revelation',
    };
    const toEnglishRef = (key: string) => {
        return key.replace(/^(\S+)/, (bookKey) => BOOK_MAP[bookKey] ?? bookKey);
    };
    return {
        BOOK_MAP,
        toEnglishRef,
        state: {
            installed: [] as { key: string }[] | null,
            lookupBibleKey: 'KJV',
            langCode: 'en',
            langCodeList: ['en', 'km'],
            // `GEN 8` -> how many verses the fake Bible has there (30 when
            // not listed).
            verseCountMap: {} as Record<string, number>,
            unreadableChapters: new Set<string>(),
            chapterCountMap: {} as Record<string, number>,
            bibleLocaleMap: {} as Record<string, string>,
            crossRefMap: {} as Record<string, unknown[]>,
            failingTitles: new Set<string>(),
            failingCopies: new Set<string>(),
        },
        mocks: {
            find: vi.fn(),
            pickBible: vi.fn(),
            copy: vi.fn(),
            verses: vi.fn(),
            bibleInfo: vi.fn(),
            crossRef: vi.fn(),
            verseTitle: vi.fn(),
            referenceTitle: vi.fn(),
            acquire: vi.fn(),
            release: vi.fn(),
            resolveLocation: vi.fn(),
            chapterCount: vi.fn(),
            keyBookMap: vi.fn(),
            installedList: vi.fn(),
            noteIndexes: vi.fn(),
            readNoteFile: vi.fn(),
        },
    };
});

vi.mock('../../../../../../bible-list/BibleItem', () => ({
    default: {
        // `GEN 8:20`, `GEN 8:20-22`, `JHN 18:33-19:16`, as the app keys them.
        fromVerseKey: async (_bibleKey: string, key: string) => {
            if (key.startsWith('THROW')) {
                throw new Error('This key breaks the parser');
            }
            const match =
                /^([1-3]?[A-Z]+) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(
                    key.trim(),
                );
            if (match === null) {
                return null;
            }
            const chapter = Number(match[2]);
            const verseStart = Number(match[3]);
            const chapterEnd =
                match[4] === undefined ? chapter : Number(match[4]);
            const verseEnd =
                match[5] === undefined ? verseStart : Number(match[5]);
            const target = {
                bookKey: match[1],
                chapter,
                verseStart,
                verseEnd,
                ...(chapterEnd > chapter ? { chapterEnd } : {}),
            };
            return {
                target,
                toVerseFullKey: () => {
                    if (chapterEnd > chapter) {
                        return `${target.bookKey} ${chapter}:${verseStart}-${chapterEnd}:${verseEnd}`;
                    }
                    return verseEnd === verseStart
                        ? `${target.bookKey} ${chapter}:${verseStart}`
                        : `${target.bookKey} ${chapter}:${verseStart}-${verseEnd}`;
                },
            };
        },
    },
}));
vi.mock('../../../../../../location-name-lookup/bibleVerseHelpers', () => ({
    BIBLE_REFERENCE_KIND_BY_SCHEME: {
        'book-key': 'book',
        'chapter-key': 'chapter',
        'verse-key': 'verse',
    },
    getLookupVerseBibleKey: () => state.lookupBibleKey,
    shortToReferenceTitle: mocks.referenceTitle,
    shortToVerseCopyData: mocks.copy,
    shortToVerseTitle: mocks.verseTitle,
}));
vi.mock('../../../../../langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    supportedLocales: ['en-US', 'km-KH', 'fr-FR'],
    getLocalBibleCrossRef: mocks.crossRef,
}));
vi.mock('../../../../../../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: mocks.acquire,
    releaseLookupData: mocks.release,
}));
vi.mock('../../../../../../location-name-lookup/lookupLangHelpers', () => ({
    getLookupLangCodeListAsync: async () => state.langCodeList,
    getSelectedLookupLangCode: () => state.langCode,
}));
vi.mock('../../../../../../location-name-lookup/lookupRecordHelpers', () => ({
    resolveLocationReference: mocks.resolveLocation,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: mocks.installedList,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.bibleInfo,
    getVerses: mocks.verses,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: mocks.chapterCount,
    getModelKeyBookMap: mocks.keyBookMap,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: { keyBookMap: BOOK_MAP },
}));
vi.mock('../../../../../../helper/agentBibleFindHelpers', () => ({
    handleAgentBibleFindRequest: mocks.find,
    pickBibleForRefs: mocks.pickBible,
}));
vi.mock('../../../../../../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    readBibleNoteIndexes: mocks.noteIndexes,
    fromBibleNoteRef: (ref: string) => {
        const index = ref.lastIndexOf('@');
        const noteItemId = Number.parseInt(ref.substring(index + 1));
        return index < 1 || Number.isNaN(noteItemId)
            ? null
            : { filePath: ref.substring(0, index), noteItemId };
    },
}));
vi.mock('../../../../../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            readFileJsonData: () => mocks.readNoteFile(filePath),
        }),
    },
}));
vi.mock('../../../../../../server/fileHelpers', () => ({
    pathBasename: (filePath: string) => filePath.split('/').pop() ?? '',
    getFileName: (name: string) => name.substring(0, name.lastIndexOf('.')),
}));

import { handleAgentLookupRequest } from '../../../../../../helper/agentLookupHelpers';

function genVerseCount(bookKey: string, chapter: number) {
    return state.verseCountMap[`${bookKey} ${chapter}`] ?? 30;
}

function genManagers(fields: Record<string, any> = {}) {
    return {
        namesLookupManager: {
            getRecordById: vi.fn(() => null),
            getRecordsByName: vi.fn(() => []),
            getAllRecords: vi.fn(() => []),
            searchNames: vi.fn(() => []),
            searchByShortVerse: vi.fn(() => []),
            ...fields.namesLookupManager,
        },
        locationsLookupManager: {
            getRecordById: vi.fn(() => null),
            getRecordsByName: vi.fn(() => []),
            getAllRecords: vi.fn(() => []),
            searchLocations: vi.fn(() => []),
            searchByShortVerse: vi.fn(() => []),
            ...fields.locationsLookupManager,
        },
    };
}

beforeEach(() => {
    state.installed = [{ key: 'KJV' }, { key: 'KH' }, { key: 'XX' }];
    state.lookupBibleKey = 'KJV';
    state.langCode = 'en';
    state.langCodeList = ['en', 'km'];
    state.verseCountMap = {
        'GEN 1': 31,
        'GEN 7': 24,
        'GEN 8': 22,
        'GEN 9': 29,
        'GEN 50': 26,
        'JHN 2': 25,
        'JHN 3': 36,
        'JHN 4': 54,
        'JHN 18': 40,
        'JHN 19': 42,
        'JHN 20': 31,
        'LUK 1': 80,
        'MAT 24': 51,
        'MAT 28': 20,
        'OBA 1': 21,
        'REV 21': 27,
        'REV 22': 21,
    };
    state.unreadableChapters = new Set();
    state.chapterCountMap = {
        GEN: 50,
        EXO: 40,
        LEV: 27,
        PSA: 150,
        ISA: 66,
        JER: 52,
        OBA: 1,
        MAT: 28,
        LUK: 24,
        JHN: 21,
        EPH: 6,
        HEB: 13,
        '2PE': 3,
        REV: 22,
    };
    state.bibleLocaleMap = { KJV: 'en-US', KH: 'km-KH', XX: 'xx-YY' };
    state.crossRefMap = {};
    state.failingTitles = new Set();
    state.failingCopies = new Set();

    mocks.installedList.mockImplementation(async () => state.installed);
    mocks.chapterCount.mockImplementation((bookKey: string) => {
        const count = state.chapterCountMap[bookKey];
        if (count === undefined) {
            // As the real one does: `books[bookKey].chapterCount`.
            throw new TypeError(`Cannot read properties of undefined`);
        }
        return count;
    });
    mocks.keyBookMap.mockReturnValue(BOOK_MAP);
    mocks.verses.mockImplementation(
        async (_bibleKey: string, bookKey: string, chapter: number) => {
            if (state.unreadableChapters.has(`${bookKey} ${chapter}`)) {
                throw new Error('chapter is not in this Bible');
            }
            return Object.fromEntries(
                Array.from(
                    { length: genVerseCount(bookKey, chapter) },
                    (_, index) => [String(index + 1), `verse ${index + 1}`],
                ),
            );
        },
    );
    mocks.copy.mockImplementation(async (_bibleKey: string, key: string) => {
        if (state.failingCopies.has(key)) {
            throw new Error('copy failed');
        }
        const crossMatch = /^(\S+) (\d+):\d+-(\d+):\d+$/.exec(key);
        if (crossMatch !== null) {
            const [, bookKey, from, to] = crossMatch;
            return {
                title: toEnglishRef(key),
                text: 'whole',
                sectionList: [
                    {
                        title: `${BOOK_MAP[bookKey]} ${from}`,
                        text: `Words of ${bookKey} ${from}.`,
                    },
                    {
                        title: `${BOOK_MAP[bookKey]} ${to}`,
                        text: `Words of ${bookKey} ${to}.`,
                    },
                ],
            };
        }
        return {
            title: toEnglishRef(key),
            text: `Words of ${key}.`,
            sectionList: [
                { title: toEnglishRef(key), text: `Words of ${key}.` },
            ],
        };
    });
    mocks.bibleInfo.mockImplementation(async (bibleKey: string) => {
        return { key: bibleKey, locale: state.bibleLocaleMap[bibleKey] };
    });
    mocks.crossRef.mockImplementation(
        async (
            _locale: string,
            target: { bookKey: string; chapter: number; verse: number },
        ) => {
            return (
                state.crossRefMap[
                    `${target.bookKey} ${target.chapter}:${target.verse}`
                ] ?? []
            );
        },
    );
    mocks.verseTitle.mockImplementation(
        async (_bibleKey: string, key: string) => {
            if (state.failingTitles.has(key)) {
                throw new Error('no title');
            }
            return toEnglishRef(key);
        },
    );
    mocks.referenceTitle.mockResolvedValue(null);
    mocks.pickBible.mockImplementation(async (bibleKey: string) => bibleKey);
    mocks.find.mockResolvedValue({ verses: [] });
    mocks.acquire.mockImplementation(async () => genManagers());
    mocks.resolveLocation.mockImplementation((manager: any, id: string) =>
        manager.getRecordById(id),
    );
    mocks.noteIndexes.mockResolvedValue({
        shortVerseNoteRefs: {},
        verseAnnotationsMap: {},
    });
    mocks.readNoteFile.mockResolvedValue({ items: [] });
});

describe('a person or a place', () => {
    function genPerson(id: string, name: string, fields: object = {}) {
        return {
            id,
            name,
            kjvName: null,
            oldName: null,
            title: '',
            description: '',
            gender: 'male',
            age: '',
            years: [],
            locations: [],
            spouses: [],
            children: [],
            parents: [],
            siblings: [],
            cousin: [],
            type: '',
            verses: [],
            links: [],
            wikipedia: null,
            ...fields,
        };
    }

    test('in another language a record’s references are titled by its Bible, a failed title kept as written', async () => {
        state.lookupBibleKey = 'KH';
        state.langCode = 'km';
        const eden = {
            id: 'eden',
            name: 'អេដែន',
            kjvName: 'Eden',
            oldName: null,
            title: 'សួនក្នុង [Genesis](book-key://GEN)',
            description:
                'មើល [Genesis 2](chapter-key://GEN 2) និង ' +
                '[Ezekiel 28:13](verse-key://EZK 28:13)',
            type: 'region',
            relatedLocations: [],
            modernIdentification: null,
            coordinates: null,
            verses: ['GEN 2:8'],
            links: [],
            wikipedia: null,
            uncertainty: false,
        };
        mocks.acquire.mockResolvedValue(
            genManagers({
                locationsLookupManager: {
                    getRecordById: vi.fn((id: string) =>
                        id === 'eden' ? eden : null,
                    ),
                },
            }),
        );
        mocks.referenceTitle.mockImplementation(
            async (_bibleKey: string, kind: string, target: string) => {
                if (target === 'EZK 28:13') {
                    throw new Error('no such book in this Bible');
                }
                return kind === 'book' ? 'លោកុប្បត្តិ' : 'លោកុប្បត្តិ ២';
            },
        );
        const result: any = await handleAgentLookupRequest({
            kind: 'location',
            id: 'eden',
        });
        expect(result).toMatchObject({
            kind: 'location',
            name: 'អេដែន',
            kjvName: 'Eden',
            lang: 'km',
            bible: 'KH',
            summary: 'សួនក្នុង លោកុប្បត្តិ',
            description: 'មើល លោកុប្បត្តិ ២ និង Ezekiel 28:13',
        });
        expect(mocks.referenceTitle).toHaveBeenCalledWith('KH', 'book', 'GEN');
        expect(mocks.referenceTitle).toHaveBeenCalledWith(
            'KH',
            'chapter',
            'GEN 2',
        );
    });

    test('a translated record with no reference in its words is left as it is', async () => {
        state.langCode = 'km';
        const ruth = genPerson('ruth', 'រស់', {
            title: 'ស្ត្រីសាសន៍ម៉ូអាប់',
            gender: 'female',
        });
        mocks.acquire.mockResolvedValue(
            genManagers({
                namesLookupManager: {
                    getRecordById: vi.fn(() => ruth),
                },
            }),
        );
        const result: any = await handleAgentLookupRequest({
            kind: 'name',
            id: 'ruth',
        });
        expect(result).toMatchObject({
            summary: 'ស្ត្រីសាសន៍ម៉ូអាប់',
            lang: 'km',
        });
        expect(mocks.referenceTitle).not.toHaveBeenCalled();
    });
});
