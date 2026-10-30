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

vi.mock('../bible-list/BibleItem', () => ({
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
vi.mock('../location-name-lookup/bibleVerseHelpers', () => ({
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
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    supportedLocales: ['en-US', 'km-KH', 'fr-FR'],
    getLocalBibleCrossRef: mocks.crossRef,
}));
vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: mocks.acquire,
    releaseLookupData: mocks.release,
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    getLookupLangCodeListAsync: async () => state.langCodeList,
    getSelectedLookupLangCode: () => state.langCode,
}));
vi.mock('../location-name-lookup/lookupRecordHelpers', () => ({
    resolveLocationReference: mocks.resolveLocation,
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: mocks.installedList,
}));
vi.mock('./bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.bibleInfo,
    getVerses: mocks.verses,
}));
vi.mock('./bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: mocks.chapterCount,
    getModelKeyBookMap: mocks.keyBookMap,
}));
vi.mock('./bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: { keyBookMap: BOOK_MAP },
}));
vi.mock('./agentBibleFindHelpers', () => ({
    handleAgentBibleFindRequest: mocks.find,
    pickBibleForRefs: mocks.pickBible,
}));
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    readBibleNoteIndexes: mocks.noteIndexes,
    fromBibleNoteRef: (ref: string) => {
        const index = ref.lastIndexOf('@');
        const noteItemId = Number.parseInt(ref.substring(index + 1));
        return index < 1 || Number.isNaN(noteItemId)
            ? null
            : { filePath: ref.substring(0, index), noteItemId };
    },
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            readFileJsonData: () => mocks.readNoteFile(filePath),
        }),
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathBasename: (filePath: string) => filePath.split('/').pop() ?? '',
    getFileName: (name: string) => name.substring(0, name.lastIndexOf('.')),
}));

import {
    CROSS_REF_SOURCE_TEXT,
    handleAgentLookupRequest,
} from './agentLookupHelpers';

function genVerseCount(bookKey: string, chapter: number) {
    return state.verseCountMap[`${bookKey} ${chapter}`] ?? 30;
}

function toLexical(text: string) {
    return JSON.stringify({
        root: {
            type: 'root',
            children: [
                {
                    type: 'paragraph',
                    children: [{ type: 'text', text }],
                },
            ],
        },
    });
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

describe('which Bible a passage is read in', () => {
    test('a request with no kind, or a passage with no reference, is refused in a sentence', async () => {
        await expect(handleAgentLookupRequest({})).resolves.toEqual({
            isError: true,
            reason:
                'Give kind: "name" for a person, "location" for a place, or ' +
                '"verse" for a Bible passage.',
        });
        await expect(
            handleAgentLookupRequest({ kind: 'verse', ref: '   ' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('Give ref'),
        });
        expect(mocks.installedList).not.toHaveBeenCalled();
    });

    test('with no Bible installed nothing is read, and the way to add one is said', async () => {
        state.installed = null;
        await expect(
            handleAgentLookupRequest({ kind: 'verse', ref: 'GEN 1:1' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'No Bible is installed on this computer, so no verse can be ' +
                'read. A Bible is added in Settings, under the Bible tab.',
        });
        expect(mocks.copy).not.toHaveBeenCalled();
    });

    test('a Bible asked for by a key that is not installed names the installed ones', async () => {
        await expect(
            handleAgentLookupRequest({
                kind: 'verse',
                ref: 'GEN 1:1',
                bible: 'NIV',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No Bible called "NIV" is installed. Installed: KJV, KH, XX.',
        });
    });

    test('an asked key matches whatever its case, and the installed key is the one used', async () => {
        const result = await handleAgentLookupRequest({
            kind: 'verse',
            ref: 'GEN 1:1',
            bible: 'kh',
        });
        expect(result).toMatchObject({ kind: 'verse', bible: 'KH' });
        // A Bible asked for by name is not second-guessed by the book name.
        expect(mocks.pickBible).not.toHaveBeenCalled();
    });

    test('the lookup Bible missing falls back to the first installed one, kept when picking fails', async () => {
        state.installed = [{ key: 'KH' }, { key: 'KJV' }];
        state.lookupBibleKey = 'NIV';
        mocks.pickBible.mockRejectedValue(new Error('no book names'));
        const result = await handleAgentLookupRequest({
            kind: 'verse',
            ref: 'GEN 1:1',
        });
        expect(mocks.pickBible).toHaveBeenCalledWith('KH', 'GEN 1:1');
        expect(result).toMatchObject({
            bible: 'KH',
            passages: [{ key: 'GEN 1:1', text: 'Words of GEN 1:1.' }],
        });
    });
});

describe('reading a passage', () => {
    test('a passage over two chapters is quoted chapter by chapter under each title', async () => {
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'JHN 18:33-19:16',
        });
        expect(result.passages).toEqual([
            {
                key: 'JHN 18:33-19:16',
                ref: 'John 18:33-19:16',
                text: 'John 18\nWords of JHN 18.\nJohn 19\nWords of JHN 19.',
            },
        ]);
    });

    test('a key the parser throws on goes to the verse finder, whose reasons are the answer', async () => {
        mocks.find.mockResolvedValue({
            verses: [],
            notFound: [
                { ref: 'THROW 1:1', reason: 'No book is called THROW.' },
                { ref: 7, reason: 'not a ref string' },
                { ref: 'Genesis 3:203', reason: 'Genesis 3 has 24 verses.' },
            ],
        });
        await expect(
            handleAgentLookupRequest({
                kind: 'verse',
                bible: 'KJV',
                ref: 'THROW 1:1; Genesis 3:203',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No book is called THROW. Genesis 3 has 24 verses.',
        });
        expect(mocks.find).toHaveBeenCalledWith({
            bible: 'KJV',
            refs: 'THROW 1:1; Genesis 3:203',
        });
    });

    test('a verse past its chapter is not quoted, and an unreadable chapter is not a verdict', async () => {
        state.unreadableChapters.add('PSA 3');
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:23; PSA 3:9',
        });
        // GEN 8 has 22 verses; PSA 3 could not be counted, so it is read.
        expect(result.passages.map((one: any) => one.key)).toEqual(['PSA 3:9']);
        expect(mocks.find).toHaveBeenCalledWith({
            bible: 'KJV',
            refs: 'GEN 8:23',
        });
    });
});

describe('near: the passage beside one', () => {
    async function readNear(ref: string, near: string) {
        return (await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref,
            near,
        })) as any;
    }

    test.each([
        ['JHN 3:16', 'next', 'JHN 3:17'],
        ['JHN 3:36', 'next', 'JHN 4:1'],
        ['JHN 3:16', 'previous', 'JHN 3:15'],
        ['JHN 4:1', 'previous', 'JHN 3:36'],
        // Across a book's start into the last verse of the book before.
        ['EXO 1:1', 'previous', 'GEN 50:26'],
    ])('one verse %s, %s, is the verse %s', async (ref, near, expected) => {
        const result = await readNear(ref, near);
        expect(result.passages.map((one: any) => one.key)).toEqual([expected]);
    });

    test.each([
        ['JHN 3:1-21', 'next', 'JHN 4:1-54'],
        ['JHN 3:1-21', 'previous', 'JHN 2:1-25'],
        // Over chapters, "next" starts after the LAST chapter.
        ['JHN 18:33-19:16', 'next', 'JHN 20:1-31'],
        // Past a book's last chapter into the next book.
        ['MAT 28:1-20', 'next', 'LUK 1:1-80'],
        ['EXO 1:1-30', 'previous', 'GEN 50:1-26'],
    ])(
        'a passage %s, %s, is the whole chapter %s',
        async (ref, near, expected) => {
            const result = await readNear(ref, near);
            expect(result.passages.map((one: any) => one.key)).toEqual([
                expected,
            ]);
        },
    );

    test('a chapter of one verse is read as that verse', async () => {
        state.verseCountMap['PSA 2'] = 1;
        const result = await readNear('PSA 1:1-6', 'next');
        expect(result.passages.map((one: any) => one.key)).toEqual(['PSA 2:1']);
    });

    test('only the first of several references is stepped from', async () => {
        const result = await readNear('JHN 3:16; GEN 1:1', 'next');
        expect(result.passages.map((one: any) => one.key)).toEqual([
            'JHN 3:17',
        ]);
    });

    test.each([
        ['GEN 1:1', 'previous', 'before'],
        ['GEN 1:1-31', 'previous', 'before'],
        ['REV 22:21', 'next', 'after'],
        ['REV 22:1-21', 'next', 'after'],
        ['not a reference', 'next', 'after'],
        ['THROW 1:1', 'previous', 'before'],
    ])('nothing %s %s: refused, no verse read', async (ref, near, side) => {
        await expect(readNear(ref, near)).resolves.toEqual({
            isError: true,
            reason: `There is no passage ${side} "${ref}" in KJV.`,
        });
        expect(mocks.copy).not.toHaveBeenCalled();
    });

    test('a neighbouring chapter that cannot be read is no passage', async () => {
        state.unreadableChapters.add('JHN 3');
        state.unreadableChapters.add('JHN 4');
        await expect(readNear('JHN 4:1', 'previous')).resolves.toMatchObject({
            isError: true,
            reason: 'There is no passage before "JHN 4:1" in KJV.',
        });
        await expect(readNear('JHN 2:1-25', 'next')).resolves.toMatchObject({
            isError: true,
            reason: 'There is no passage after "JHN 2:1-25" in KJV.',
        });
    });

    test('any other near is ignored and the passage itself is read', async () => {
        const result = await readNear('JHN 3:16', 'sideways');
        expect(result.passages.map((one: any) => one.key)).toEqual([
            'JHN 3:16',
        ]);
    });
});

describe('names: the people and places in a passage', () => {
    function genRecord(id: string, name: string, kjvName: string | null) {
        return { id, name, kjvName };
    }

    test('each person and place is named once, with every verse that names it', async () => {
        const peopleByVerse: Record<string, any[]> = {
            'GEN 4:1': [
                genRecord('adam', 'Adam', 'Adam'),
                genRecord('eve', 'Ewa', 'Eve'),
                genRecord('cain', 'Cain', null),
            ],
            'GEN 4:2': [
                genRecord('abel', 'Abel', ''),
                genRecord('cain', 'Cain', null),
            ],
            'GEN 4:3': [genRecord('cain', 'Cain', null)],
        };
        const managers = genManagers({
            namesLookupManager: {
                searchByShortVerse: vi.fn((key: string) => {
                    return peopleByVerse[key] ?? [];
                }),
            },
            locationsLookupManager: {
                searchByShortVerse: vi.fn((key: string) => {
                    return key === 'GEN 4:2'
                        ? [genRecord('eden', 'Eden', 'Eden')]
                        : [];
                }),
            },
        });
        mocks.acquire.mockResolvedValue(managers);
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 4:1-3',
            names: true,
            lang: 'km',
        });
        expect(result).toMatchObject({
            passages: [{ key: 'GEN 4:1-3' }],
            lang: 'km',
            people: [
                { id: 'adam', name: 'Adam', verses: ['4:1'] },
                { id: 'eve', name: 'Ewa', kjvName: 'Eve', verses: ['4:1'] },
                { id: 'cain', name: 'Cain', verses: ['4:1', '4:2', '4:3'] },
                { id: 'abel', name: 'Abel', verses: ['4:2'] },
            ],
            places: [{ id: 'eden', name: 'Eden', verses: ['4:2'] }],
        });
        // The KJV name is said only where it differs.
        expect(result.people[0]).not.toHaveProperty('kjvName');
        expect(mocks.acquire).toHaveBeenCalledWith('km');
        expect(mocks.release).toHaveBeenCalledWith('km');
    });

    test('forty of each at most; a record met first past the bound is never listed', async () => {
        const many = Array.from({ length: 45 }, (_, index) => {
            return genRecord(`p${index}`, `Person ${index}`, null);
        });
        const managers = genManagers({
            namesLookupManager: {
                searchByShortVerse: vi.fn((key: string) => {
                    return key === 'GEN 10:1' ? many : [many[0], many[44]];
                }),
            },
        });
        mocks.acquire.mockResolvedValue(managers);
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 10:1-2',
            names: true,
        });
        expect(result.people).toHaveLength(40);
        expect(result.people[0]).toMatchObject({
            id: 'p0',
            verses: ['10:1', '10:2'],
        });
        expect(result.people.some((one: any) => one.id === 'p44')).toBeFalsy();
        expect(result.lang).toBe('en');
    });

    test('a long passage is looked through two hundred verses, chapter by chapter', async () => {
        const managers = genManagers();
        mocks.acquire.mockResolvedValue(managers);
        await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 1:1-12:5',
            names: true,
        });
        const searched = managers.namesLookupManager.searchByShortVerse.mock
            .calls as unknown as string[][];
        expect(searched).toHaveLength(200);
        // GEN 1 has 31 verses, the five after it 30, GEN 7 24: the 200th
        // verse is GEN 7:19.
        expect(searched[30][0]).toBe('GEN 1:31');
        expect(searched[31][0]).toBe('GEN 2:1');
        expect(searched[199][0]).toBe('GEN 7:19');
    });

    test('a passage over chapters names the verses of the middle ones by count', async () => {
        const managers = genManagers();
        mocks.acquire.mockResolvedValue(managers);
        await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'JHN 18:33-19:2',
            names: true,
        });
        expect(
            managers.locationsLookupManager.searchByShortVerse.mock.calls.map(
                (call: any[]) => call[0],
            ),
        ).toEqual([
            'JHN 18:33',
            'JHN 18:34',
            'JHN 18:35',
            'JHN 18:36',
            'JHN 18:37',
            'JHN 18:38',
            'JHN 18:39',
            'JHN 18:40',
            'JHN 19:1',
            'JHN 19:2',
        ]);
    });

    test('a language the lookup does not have adds no names and loads nothing', async () => {
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 4:1-3',
            names: true,
            lang: 'zz',
        });
        expect(result.passages).toHaveLength(1);
        expect(result).not.toHaveProperty('people');
        expect(mocks.acquire).not.toHaveBeenCalled();
    });
});

describe('related: cross references, the verses around, the notes', () => {
    function seedNoahCrossRefs() {
        state.crossRefMap = {
            'GEN 8:20': [
                {
                    title: 'Early <i>Altars</i> Built to the Lord',
                    verses: ['GEN 12:7', 'GEN 13:18', 'HEB 11:4', 'GEN 8:21'],
                },
                { title: 'Noah&#39;s Burnt Offering', verses: ['EXO 29:18'] },
            ],
            'GEN 8:21': [
                { title: 'A Sweet Savour', verses: ['EXO 29:18', 'EPH 5:2'] },
            ],
            'GEN 8:22': [
                {
                    title: 'Seasons Continue',
                    verses: ['JER 33:20', 'PSA 74:17', 'GEN 12:7'],
                },
            ],
            // The chapters around: what the New Testament says of the flood.
            'GEN 7:11': [
                {
                    title: 'The Flood Came',
                    verses: ['MAT 24:37-39', 'LUK 17:26-27', '2PE 2:5'],
                },
            ],
            'GEN 7:12': [{ title: 'Rain', verses: ['MAT 24:38-39'] }],
            'GEN 9:11': [
                { title: 'Never Again', verses: ['ISA 54:9', 'HEB 11:4'] },
            ],
        };
    }

    test('a passage reads what its verses lead to, the chapters around it and the notes on it', async () => {
        seedNoahCrossRefs();
        state.failingTitles.add('PSA 74:17');
        mocks.noteIndexes.mockResolvedValue({
            shortVerseNoteRefs: {
                'GEN 8:20': [
                    'C:/notes/Default.json@1',
                    'C:/notes/Default.json@2',
                    'C:/notes/Study.json@5',
                    'not-a-note-ref',
                ],
                'GEN 8:21': ['C:/notes/Default.json@1'],
                'GEN 9:1': ['C:/notes/Default.json@3'],
            },
            verseAnnotationsMap: {
                '(KJV) GEN 8:21': {
                    highlights: [{ highlight: { text: 'a sweet savour' } }],
                    comments: [],
                },
                '(KJV) GEN 9:1': {
                    highlights: [{ highlight: { text: 'be fruitful' } }],
                    comments: [],
                },
            },
        });
        mocks.readNoteFile.mockImplementation(async (filePath: string) => {
            if (filePath === 'C:/notes/Study.json') {
                throw new Error('unreadable note file');
            }
            return {
                items: [
                    {
                        metadata: { id: 1 },
                        title: 'Altars',
                        content: toLexical('Noah built an altar first.'),
                    },
                    // A verse's marks are an item too, told as marks.
                    { metadata: { id: 2 }, verseKey: 'GEN 8:20' },
                    { metadata: { id: 3 }, title: 'Blessing' },
                ],
            };
        });

        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });

        expect(result.around).toEqual({
            before: { key: 'GEN 8:1-19', title: 'Genesis 8:1-19' },
            after: { key: 'GEN 9:1-29', title: 'Genesis 9:1-29' },
        });
        expect(result.yourNotes).toEqual({
            verseCount: 2,
            notes: [
                {
                    file: 'Default',
                    title: 'Altars',
                    verses: ['GEN 8:20', 'GEN 8:21'],
                    text: 'Noah built an altar first.',
                },
            ],
            noteCount: 1,
            marks: [
                {
                    verse: 'GEN 8:21',
                    bible: 'KJV',
                    highlighted: ['a sweet savour'],
                    comments: [],
                },
            ],
            markCount: 1,
        });
        expect(result.crossRefs).toEqual({
            source: CROSS_REF_SOURCE_TEXT,
            language: 'en-US',
            verseCount: 3,
            themeCount: 4,
            referenceCount: 9,
            // Led to from two verses each, the first met first.
            mostCited: [
                {
                    key: 'GEN 12:7',
                    from: ['20', '22'],
                    title: 'Genesis 12:7',
                    text: 'Words of GEN 12:7.',
                },
                {
                    key: 'EXO 29:18',
                    from: ['20', '21'],
                    title: 'Exodus 29:18',
                    text: 'Words of EXO 29:18.',
                },
            ],
            otherTestamentName: 'New Testament',
            otherTestament: [
                {
                    key: 'EPH 5:2',
                    from: ['21'],
                    title: 'Ephesians 5:2',
                    text: 'Words of EPH 5:2.',
                },
                {
                    key: 'HEB 11:4',
                    from: ['20'],
                    title: 'Hebrews 11:4',
                    text: 'Words of HEB 11:4.',
                },
            ],
            // Matthew 24:37-39 and 24:38-39 are one saying; Hebrews 11:4 is
            // already named above; only the first is quoted.
            otherTestamentAround: [
                {
                    key: 'MAT 24:37-39',
                    from: ['7:11', '7:12'],
                    title: 'Matthew 24:37-39',
                    text: 'Words of MAT 24:37-39.',
                },
                {
                    key: 'LUK 17:26-27',
                    from: ['7:11'],
                    title: 'Luke 17:26-27',
                },
                { key: '2PE 2:5', from: ['7:11'], title: '2 Peter 2:5' },
            ],
            byVerse: [
                {
                    verse: '20',
                    themes: [
                        {
                            theme: 'Early Altars Built to the Lord',
                            refs: [
                                'Genesis 12:7',
                                'Genesis 13:18',
                                'Hebrews 11:4',
                            ],
                        },
                        {
                            theme: 'Noah’s Burnt Offering',
                            refs: ['Exodus 29:18'],
                        },
                    ],
                },
                {
                    verse: '21',
                    themes: [
                        {
                            theme: 'A Sweet Savour',
                            refs: ['Exodus 29:18', 'Ephesians 5:2'],
                        },
                    ],
                },
                {
                    verse: '22',
                    themes: [
                        {
                            theme: 'Seasons Continue',
                            // No title in the Bible: the key stays.
                            refs: [
                                'Jeremiah 33:20',
                                'PSA 74:17',
                                'Genesis 12:7',
                            ],
                        },
                    ],
                },
            ],
        });
        // Each reference is titled once, however often it is named.
        expect(
            mocks.verseTitle.mock.calls.filter(([, key]) => key === 'GEN 12:7'),
        ).toHaveLength(1);
        expect(mocks.crossRef).toHaveBeenCalledWith('en-US', {
            bookKey: 'GEN',
            chapter: 8,
            verse: 20,
        });
        // The chapters around: GEN 7, GEN 8 without the passage, GEN 9.
        expect(mocks.crossRef).toHaveBeenCalledWith('en-US', {
            bookKey: 'GEN',
            chapter: 7,
            verse: 1,
        });
        expect(mocks.crossRef).toHaveBeenCalledWith('en-US', {
            bookKey: 'GEN',
            chapter: 9,
            verse: 29,
        });
        expect(mocks.crossRef).toHaveBeenCalledTimes(3 + 24 + 19 + 29);
    });

    test('one verse is told whole: every theme, its references in order, three quoted', async () => {
        seedNoahCrossRefs();
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20',
            related: true,
        });
        // The next verse is not "the passage" when only one verse is read.
        expect(
            result.crossRefs.mostCited.map((one: any) => [
                one.key,
                'text' in one,
            ]),
        ).toEqual([
            ['GEN 12:7', true],
            ['GEN 13:18', true],
            ['HEB 11:4', true],
            ['GEN 8:21', false],
            ['EXO 29:18', false],
        ]);
        expect(result.crossRefs.byVerse).toEqual([
            {
                verse: '20',
                themes: [
                    {
                        theme: 'Early Altars Built to the Lord',
                        refs: [
                            'Genesis 12:7',
                            'Genesis 13:18',
                            'Hebrews 11:4',
                            'Genesis 8:21',
                        ],
                    },
                    {
                        theme: 'Noah’s Burnt Offering',
                        refs: ['Exodus 29:18'],
                    },
                ],
            },
        ]);
        expect(result.around).toEqual({
            before: { key: 'GEN 8:1-19', title: 'Genesis 8:1-19' },
            after: { key: 'GEN 8:21-22', title: 'Genesis 8:21-22' },
        });
    });

    test('a reference led to from more than six verses names six and counts them all', async () => {
        state.crossRefMap = Object.fromEntries(
            Array.from({ length: 8 }, (_, index) => [
                `PSA 119:${index + 1}`,
                [{ title: 'Delight in the Law', verses: ['PSA 1:2'] }],
            ]),
        );
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'PSA 119:1-8',
            related: true,
        });
        expect(result.crossRefs.mostCited).toEqual([
            {
                key: 'PSA 1:2',
                from: ['1', '2', '3', '4', '5', '6'],
                fromCount: 8,
                title: 'Psalms 1:2',
                text: 'Words of PSA 1:2.',
            },
        ]);
    });

    test('a reference this Bible cannot read is named by its key alone, untitled and unquoted', async () => {
        state.crossRefMap = {
            'GEN 8:20': [
                { title: 'Altars', verses: ['GEN 12:7', 'EXO 29:18'] },
            ],
            'GEN 8:21': [
                { title: 'Savour', verses: ['GEN 12:7', 'EXO 29:18'] },
            ],
        };
        state.failingCopies.add('GEN 12:7');
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-21',
            related: true,
        });
        expect(result.crossRefs.mostCited).toEqual([
            { key: 'GEN 12:7', from: ['20', '21'] },
            {
                key: 'EXO 29:18',
                from: ['20', '21'],
                title: 'Exodus 29:18',
                text: 'Words of EXO 29:18.',
            },
        ]);
    });

    test('the themes are in the Bible’s language when the app has it, else in English', async () => {
        seedNoahCrossRefs();
        const khmer: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KH',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(khmer.crossRefs.language).toBe('km-KH');
        expect(mocks.crossRef).toHaveBeenCalledWith(
            'km-KH',
            expect.objectContaining({ verse: 20 }),
        );
        const other: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'XX',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(other.crossRefs.language).toBe('en-US');
    });

    test('a passage the bundle says nothing of has no crossRefs, and a failing verse read is skipped', async () => {
        state.crossRefMap = {
            'GEN 8:21': [{ title: 'A Sweet Savour', verses: ['EXO 29:18'] }],
        };
        mocks.crossRef.mockImplementation(
            async (_locale: string, target: { verse: number }) => {
                if (target.verse === 20) {
                    throw new Error('bundle unreadable');
                }
                return target.verse === 21 ? state.crossRefMap['GEN 8:21'] : [];
            },
        );
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(result.crossRefs.verseCount).toBe(1);
        expect(result.crossRefs.byVerse).toEqual([
            {
                verse: '21',
                themes: [{ theme: 'A Sweet Savour', refs: ['Exodus 29:18'] }],
            },
        ]);

        state.crossRefMap = {};
        mocks.crossRef.mockResolvedValue([]);
        const none: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(none).not.toHaveProperty('crossRefs');
        expect(none).not.toHaveProperty('yourNotes');
        expect(none.around).toBeDefined();
    });

    test('a failing cross-reference or note read never fails the passage', async () => {
        seedNoahCrossRefs();
        mocks.bibleInfo.mockRejectedValue(new Error('Bible info unreadable'));
        mocks.noteIndexes.mockRejectedValue(new Error('notes unreadable'));
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(result).toMatchObject({
            kind: 'verse',
            passages: [{ key: 'GEN 8:20-22' }],
            around: { before: { key: 'GEN 8:1-19' } },
        });
        expect(result).not.toHaveProperty('crossRefs');
        expect(result).not.toHaveProperty('yourNotes');
    });

    test.each([
        // A verse before and the next chapter after; one verse is `GEN 8:1`.
        ['GEN 8:2-22', { key: 'GEN 8:1' }, { key: 'GEN 9:1-29' }],
        // Starts its book: nothing before.
        ['GEN 1:1-31', null, { key: 'GEN 2:1-30' }],
        // Starts its chapter: the whole chapter before.
        ['GEN 9:1-29', { key: 'GEN 8:1-22' }, { key: 'GEN 10:1-30' }],
        // Ends its book: nothing after.
        ['REV 22:1-21', { key: 'REV 21:1-27' }, null],
    ])('around %s', async (ref, before, after) => {
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref,
            related: true,
        });
        expect(result.around).toEqual({
            ...(before === null
                ? {}
                : { before: { ...before, title: toEnglishRef(before.key) } }),
            ...(after === null
                ? {}
                : { after: { ...after, title: toEnglishRef(after.key) } }),
        });
    });

    test('a whole one-chapter book, or chapters that cannot be read, have nothing around', async () => {
        const obadiah: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'OBA 1:1-21',
            related: true,
        });
        expect(obadiah.passages).toHaveLength(1);
        expect(obadiah).not.toHaveProperty('around');

        state.unreadableChapters.add('GEN 8');
        state.unreadableChapters.add('GEN 10');
        const unread: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 9:1-29',
            related: true,
        });
        expect(unread).not.toHaveProperty('around');
    });

    test('a side with no title in the Bible keeps its key as its title', async () => {
        state.failingTitles.add('GEN 8:1-19');
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(result.around.before).toEqual({
            key: 'GEN 8:1-19',
            title: 'GEN 8:1-19',
        });
    });

    test('a book the Bible model does not know reads, with nothing around it', async () => {
        state.crossRefMap = {
            'XYZ 1:1': [{ title: 'Elsewhere', verses: ['GEN 1:1'] }],
        };
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'XYZ 1:1-3',
            related: true,
        });
        expect(result.passages).toEqual([
            { key: 'XYZ 1:1-3', ref: 'XYZ 1:1-3', text: 'Words of XYZ 1:1-3.' },
        ]);
        expect(result).not.toHaveProperty('around');
        expect(result.crossRefs).toMatchObject({
            verseCount: 1,
            otherTestamentAround: [],
        });
    });
});

describe('related: a long passage is cut to fit one card', () => {
    const LONG = 'A long theme sentence that a reader would skim past. ';

    function seedLongPassage(firstTitleRepeat: number) {
        state.crossRefMap = Object.fromEntries(
            Array.from({ length: 30 }, (_, index) => {
                const verse = index + 1;
                return [
                    `ISA 40:${verse}`,
                    [
                        {
                            title: `First ${verse}. ${LONG.repeat(firstTitleRepeat)}`,
                            verses: [
                                'GEN 3:15',
                                `JER ${verse}:1`,
                                `JER ${verse}:2`,
                                `JER ${verse}:3`,
                            ],
                        },
                        {
                            title: `Second ${verse}. ${LONG.repeat(8)}`,
                            verses: [`PSA ${verse}:1`, `PSA ${verse}:2`],
                        },
                    ],
                ];
            }),
        );
    }

    async function readLongPassage() {
        const result: any = await handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'ISA 40:1-30',
            related: true,
        });
        return result.crossRefs;
    }

    test('one theme a verse goes first, and every verse is kept', async () => {
        seedLongPassage(0);
        const crossRefs = await readLongPassage();
        expect(JSON.stringify(crossRefs).length).toBeLessThanOrEqual(9000);
        expect(crossRefs.byVerse).toHaveLength(30);
        for (const [index, one] of crossRefs.byVerse.entries()) {
            expect(one.verse).toBe(String(index + 1));
            expect(one.themes).toHaveLength(1);
            expect(one.themes[0].theme).toMatch(/^First /);
            // References a theme are cut only after the second theme went.
            expect(one.themes[0].refs).toHaveLength(4);
        }
        // Quotes are kept while the themes are enough.
        expect(crossRefs.mostCited[0]).toMatchObject({
            key: 'GEN 3:15',
            text: 'Words of GEN 3:15.',
        });
    });

    test('past every other cut, verses go from the end, never from the start', async () => {
        seedLongPassage(4);
        const crossRefs = await readLongPassage();
        expect(JSON.stringify(crossRefs).length).toBeLessThanOrEqual(9000);
        expect(crossRefs.byVerse.length).toBeGreaterThan(0);
        expect(crossRefs.byVerse.length).toBeLessThan(30);
        for (const [index, one] of crossRefs.byVerse.entries()) {
            expect(one.verse).toBe(String(index + 1));
            expect(one.themes).toHaveLength(1);
            expect(one.themes[0].refs.length).toBeLessThanOrEqual(2);
        }
        // Every quote went before any verse did.
        for (const ref of [
            ...crossRefs.mostCited,
            ...crossRefs.otherTestament,
            ...crossRefs.otherTestamentAround,
        ]) {
            expect(ref).not.toHaveProperty('text');
        }
    });
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

    test('a name not found exactly is searched, and the other matches are named with their ids', async () => {
        const moses = genPerson('moses', 'Moses', {
            verses: ['EXO 2:10', 'EXO 3:1'],
        });
        const moshe = genPerson('moshe', 'Moshe', { kjvName: 'Mosheh' });
        const mosa = genPerson('mosa', 'Mosa', { kjvName: 'Mosa' });
        const searchNames = vi.fn(() => [moses, moshe, mosa]);
        mocks.acquire.mockResolvedValue(
            genManagers({
                namesLookupManager: {
                    getAllRecords: vi.fn(() => [moses, moshe, mosa]),
                    searchNames,
                },
            }),
        );
        const result: any = await handleAgentLookupRequest({
            kind: 'name',
            name: 'mos',
        });
        expect(searchNames).toHaveBeenCalledWith('mos', { limit: 6 });
        expect(result).toMatchObject({
            kind: 'name',
            id: 'moses',
            lang: 'en',
            bible: 'KJV',
            otherMatches: [
                { id: 'moshe', name: 'Moshe', kjvName: 'Mosheh' },
                { id: 'mosa', name: 'Mosa' },
            ],
            // The record's verses quoted in the lookup's Bible.
            quoted: [
                {
                    key: 'EXO 2:10',
                    ref: 'Exodus 2:10',
                    text: 'Words of EXO 2:10.',
                },
                {
                    key: 'EXO 3:1',
                    ref: 'Exodus 3:1',
                    text: 'Words of EXO 3:1.',
                },
            ],
        });
        expect(result.otherMatches[1]).not.toHaveProperty('kjvName');
        expect(mocks.release).toHaveBeenCalledWith('en');
    });

    test('a person nobody of that name, by id or by name, is refused and the dataset is given back', async () => {
        await expect(
            handleAgentLookupRequest({ kind: 'name', name: 'Nobody' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'No person or name "Nobody" is in the names lookup. Try the ' +
                'English name, or another spelling.',
        });
        await expect(
            handleAgentLookupRequest({ kind: 'name', id: 'missing-id' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('"missing-id"'),
        });
        await expect(
            handleAgentLookupRequest({ kind: 'location', id: 'no-place' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('No place "no-place"'),
        });
        expect(mocks.acquire).toHaveBeenCalledTimes(3);
        expect(mocks.release).toHaveBeenCalledTimes(3);
    });

    test('with no Bible installed a record still reads, without quotes or a bible', async () => {
        state.installed = [];
        const adam = genPerson('adam', 'Adam', { verses: ['GEN 2:19'] });
        mocks.acquire.mockResolvedValue(
            genManagers({
                namesLookupManager: {
                    getRecordById: vi.fn((id: string) =>
                        id === 'adam' ? adam : null,
                    ),
                },
            }),
        );
        const result: any = await handleAgentLookupRequest({
            kind: 'name',
            id: 'adam',
        });
        expect(result).toMatchObject({
            id: 'adam',
            verseCount: 1,
            verses: ['GEN 2:19'],
        });
        expect(result).not.toHaveProperty('quoted');
        expect(result).not.toHaveProperty('bible');
        expect(mocks.copy).not.toHaveBeenCalled();
    });

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

    test('a search in a language the lookup does not have names the ones it has', async () => {
        await expect(
            handleAgentLookupRequest({
                kind: 'location',
                search: 'Bethel',
                lang: 'de',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The names lookup has no "de" language. It has: en, km.',
        });
        expect(mocks.acquire).not.toHaveBeenCalled();
    });
});
