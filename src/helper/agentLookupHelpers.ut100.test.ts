import { beforeEach, describe, expect, test, vi } from 'vitest';

// The reader behind `owa_lookup_record`, over a small Bible model of its own:
// six books, thirty verses a chapter unless a test says otherwise. The record
// shaping, the cross-reference summary, the passage-note rows and the name
// alias table are the real modules; only what reads the Bible, the names
// dataset, the cross-reference bundle and the note files is a fake.
const { model, state, mocks } = vi.hoisted(() => {
    const books: Record<string, string> = {
        GEN: 'Genesis',
        EXO: 'Exodus',
        MAT: 'Matthew',
        JHN: 'John',
        JUD: 'Jude',
        REV: 'Revelation',
    };
    const chapters: Record<string, number> = {
        GEN: 50,
        EXO: 40,
        MAT: 28,
        JHN: 21,
        JUD: 1,
        REV: 22,
    };
    const state = {
        infoList: [] as { key: string }[] | null,
        selectedLang: 'en',
        verseCounts: {} as Record<string, number>,
        failedChapters: new Set<string>(),
        throwKeys: new Set<string>(),
        untitledKeys: new Set<string>(),
    };
    // As the app's own parser (`bibleInfoHelpers.fromVerseKey`) reads a key:
    // any three-letter book code, the model asked only for a key over
    // chapters -- so `JOH 3:16` parses, and only reading its words fails.
    const KEY_PATTERN =
        /^([A-Z123][A-Z]{2}) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/;
    const parseKey = (key: string) => {
        const match = KEY_PATTERN.exec(key.trim());
        if (match === null) {
            return null;
        }
        const chapter = Number(match[2]);
        const verseStart = Number(match[3]);
        const endChapter = match[4] === undefined ? chapter : Number(match[4]);
        const verseEnd = match[5] === undefined ? verseStart : Number(match[5]);
        return { bookKey: match[1], chapter, verseStart, endChapter, verseEnd };
    };
    // Null for a chapter past the book, as `getVerses` answers; a book the
    // model lacks throws, as `getChapterData` does.
    const countVerses = (bookKey: string, chapter: number) => {
        if (chapters[bookKey] === undefined) {
            throw new TypeError(
                "Cannot read properties of undefined (reading 'chapterCount')",
            );
        }
        if (chapter > chapters[bookKey]) {
            return null;
        }
        return state.verseCounts[`${bookKey} ${chapter}`] ?? 30;
    };
    const toEnglish = (key: string) => {
        return key.replace(/^(\S+)/, (bookKey) => {
            return books[bookKey] ?? bookKey;
        });
    };
    return {
        model: { books, chapters, parseKey, countVerses, toEnglish },
        state,
        mocks: {
            copy: vi.fn(),
            verseTitle: vi.fn(),
            referenceTitle: vi.fn(),
            find: vi.fn(),
            pick: vi.fn(),
            acquire: vi.fn(),
            release: vi.fn(),
            bibleInfo: vi.fn(),
            crossRef: vi.fn(),
            readNoteIndexes: vi.fn(),
            readNoteFile: vi.fn(),
        },
    };
});

vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: async (bibleKey: string, key: string) => {
            if (state.throwKeys.has(key)) {
                throw new Error('unreadable key');
            }
            const span = model.parseKey(key);
            if (span === null) {
                return null;
            }
            const { bookKey, chapter, verseStart, endChapter, verseEnd } = span;
            const isCross = endChapter > chapter;
            if (isCross && model.chapters[bookKey] === undefined) {
                throw new TypeError(
                    "Cannot read properties of undefined (reading 'chapterCount')",
                );
            }
            return {
                bibleKey,
                target: {
                    bookKey,
                    chapter,
                    verseStart,
                    verseEnd,
                    ...(isCross ? { chapterEnd: endChapter } : {}),
                },
                toVerseFullKey: () => {
                    if (isCross) {
                        return `${bookKey} ${chapter}:${verseStart}-${endChapter}:${verseEnd}`;
                    }
                    return verseEnd > verseStart
                        ? `${bookKey} ${chapter}:${verseStart}-${verseEnd}`
                        : `${bookKey} ${chapter}:${verseStart}`;
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
    getLookupVerseBibleKey: (langCode: string) => {
        return langCode === 'km' ? 'KH' : 'KJV';
    },
    shortToReferenceTitle: (...args: any[]) => mocks.referenceTitle(...args),
    shortToVerseCopyData: (...args: any[]) => mocks.copy(...args),
    shortToVerseTitle: (...args: any[]) => mocks.verseTitle(...args),
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    ensureLangPlugins: async () => [],
    getSupportedLocales: () => ['en-US', 'km-KH', 'fr-FR'],
    getLocalBibleCrossRef: (...args: any[]) => mocks.crossRef(...args),
}));
vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: (langCode: string) => mocks.acquire(langCode),
    releaseLookupData: (langCode: string) => mocks.release(langCode),
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    getLookupLangCodeListAsync: async () => ['en', 'km'],
    getSelectedLookupLangCode: () => state.selectedLang,
}));
vi.mock('../location-name-lookup/lookupRecordHelpers', () => ({
    resolveLocationReference: (manager: any, idOrName: string) => {
        return (
            manager.getRecordById(idOrName) ??
            manager.getRecordsByName(idOrName)[0] ??
            null
        );
    },
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: async () => state.infoList,
}));
vi.mock('./bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: (bibleKey: string) => mocks.bibleInfo(bibleKey),
    getVerses: async (_bibleKey: string, bookKey: string, chapter: number) => {
        const count = model.countVerses(bookKey, chapter);
        if (state.failedChapters.has(`${bookKey} ${chapter}`)) {
            throw new Error('chapter unreadable');
        }
        if (count === null) {
            return null;
        }
        return Object.fromEntries(
            Array.from({ length: count }, (_, index) => {
                return [String(index + 1), `verse ${index + 1}`];
            }),
        );
    },
}));
vi.mock('./bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => model.books,
    // `bibleModelInfo.books[bookKey].chapterCount`, as the real one reads it.
    getModelChapterCount: (bookKey: string) => {
        const count = model.chapters[bookKey];
        if (count === undefined) {
            throw new TypeError(
                "Cannot read properties of undefined (reading 'chapterCount')",
            );
        }
        return count;
    },
}));
vi.mock('./bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: { keyBookMap: model.books },
}));
vi.mock('./agentBibleFindHelpers', () => ({
    handleAgentBibleFindRequest: (...args: any[]) => mocks.find(...args),
    pickBibleForRefs: (...args: any[]) => mocks.pick(...args),
}));
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    readBibleNoteIndexes: () => mocks.readNoteIndexes(),
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
    pathBasename: (filePath: string) => filePath.split('/').at(-1) ?? '',
    getFileName: (fileName: string) => fileName.replace(/\.[^.]+$/, ''),
}));

import { handleAgentLookupRequest } from './agentLookupHelpers';

async function lookup(request: Record<string, unknown>): Promise<any> {
    return await handleAgentLookupRequest(request);
}

function genManager(
    recordList: any[],
    byVerse: Record<string, unknown[]> = {},
) {
    return {
        getRecordById: (id: string) => {
            return (
                recordList.find((record) => {
                    return record.id === id;
                }) ?? null
            );
        },
        getRecordsByName: (name: string) => {
            return recordList.filter((record) => {
                return record.name === name;
            });
        },
        getAllRecords: () => recordList,
        searchNames: vi.fn((): unknown[] => []),
        searchLocations: vi.fn((): unknown[] => []),
        searchByShortVerse: vi.fn(
            (verseKey: string) => byVerse[verseKey] ?? [],
        ),
    };
}

function genManagers({
    people = [] as any[],
    places = [] as any[],
    namesByVerse = {} as Record<string, unknown[]>,
    placesByVerse = {} as Record<string, unknown[]>,
} = {}) {
    return {
        namesLookupManager: genManager(people, namesByVerse),
        locationsLookupManager: genManager(places, placesByVerse),
    };
}

function genThemeMap(themeMap: Record<string, unknown>) {
    return async (
        _locale: string,
        target: { bookKey: string; chapter: number; verse: number },
    ) => {
        const themes =
            themeMap[`${target.bookKey} ${target.chapter}:${target.verse}`];
        if (themes instanceof Error) {
            throw themes;
        }
        return themes ?? [];
    };
}

beforeEach(() => {
    state.infoList = [{ key: 'KJV' }, { key: 'KH' }];
    state.selectedLang = 'en';
    state.verseCounts = {};
    state.failedChapters = new Set();
    state.throwKeys = new Set();
    state.untitledKeys = new Set();
    mocks.copy.mockImplementation(async (bibleKey: string, key: string) => {
        const span = model.parseKey(key);
        // A book or chapter the Bible does not have has no words to copy.
        if (
            span === null ||
            model.countVerses(span.bookKey, span.endChapter) === null
        ) {
            throw new Error('no such passage');
        }
        const sections = [];
        for (
            let chapter = span.chapter;
            chapter <= span.endChapter;
            chapter++
        ) {
            sections.push({
                title: `${model.books[span.bookKey]} ${chapter}`,
                text: `Words of ${span.bookKey} ${chapter}.`,
            });
        }
        return {
            title: bibleKey === 'KH' ? `KH ${key}` : model.toEnglish(key),
            text: sections
                .map((section) => {
                    return section.text;
                })
                .join(' '),
            sectionList: sections,
        };
    });
    mocks.verseTitle.mockImplementation(
        async (bibleKey: string, key: string) => {
            if (state.untitledKeys.has(key)) {
                throw new Error('no title');
            }
            return bibleKey === 'KH' ? `KH ${key}` : model.toEnglish(key);
        },
    );
    mocks.referenceTitle.mockResolvedValue(null);
    mocks.find.mockResolvedValue({ verses: [] });
    mocks.pick.mockImplementation(async (bibleKey: string) => bibleKey);
    mocks.bibleInfo.mockImplementation(async (bibleKey: string) => {
        return (
            {
                KJV: { locale: 'en-US' },
                KH: { locale: 'km-KH' },
                LUT: { locale: 'de-DE' },
            } as Record<string, { locale: string }>
        )[bibleKey];
    });
    mocks.crossRef.mockResolvedValue([]);
    mocks.readNoteIndexes.mockResolvedValue({
        shortVerseNoteRefs: {},
        verseAnnotationsMap: {},
    });
    mocks.readNoteFile.mockResolvedValue(null);
    mocks.acquire.mockImplementation(async () => genManagers());
});

describe('a passage read whole, then its Bible gone', () => {
    test('says nothing of names, notes or cross references it could not list', async () => {
        const readWords = mocks.copy.getMockImplementation();
        mocks.copy.mockImplementation(async (bibleKey: string, key: string) => {
            const data = await readWords?.(bibleKey, key);
            // The Bible is taken away right after the passage's words.
            state.throwKeys.add(key);
            return data;
        });
        mocks.crossRef.mockImplementation(
            genThemeMap({
                'GEN 2:2': [{ title: 'Rest', verses: ['EXO 20:11'] }],
            }),
        );

        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 2:1-3',
            names: true,
            related: true,
        });

        expect(result.passages).toEqual([
            expect.objectContaining({ key: 'GEN 2:1-3' }),
        ]);
        for (const key of [
            'people',
            'places',
            'lang',
            'crossRefs',
            'yourNotes',
        ]) {
            expect(result).not.toHaveProperty(key);
        }
        expect(mocks.acquire).not.toHaveBeenCalled();
        expect(mocks.crossRef).not.toHaveBeenCalled();
        expect(mocks.readNoteIndexes).not.toHaveBeenCalled();
        // The verses around it need no list of its own verses.
        expect(result.around).toMatchObject({
            before: { key: 'GEN 1:1-30' },
            after: { key: 'GEN 2:4-30' },
        });
    });
});

describe('a cross reference whose words fail to read', () => {
    test('is still listed by its key, with no title or words made up', async () => {
        mocks.crossRef.mockImplementation(
            genThemeMap({
                'GEN 8:21': [{ title: 'Theme', verses: ['GEN 12:7'] }],
            }),
        );
        const readWords = mocks.copy.getMockImplementation();
        mocks.copy.mockImplementation(async (bibleKey: string, key: string) => {
            if (key === 'GEN 12:7') {
                // An answer with no sections cannot be quoted.
                return { title: 'Genesis 12:7', text: 'Unto thy seed' };
            }
            return await readWords?.(bibleKey, key);
        });

        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:21',
            related: true,
        });

        const [cited] = result.crossRefs.mostCited;
        expect(cited.key).toBe('GEN 12:7');
        expect(cited).not.toHaveProperty('title');
        expect(cited).not.toHaveProperty('text');
        expect(result.passages[0].key).toBe('GEN 8:21');
    });
});

describe('a record asked for by id', () => {
    test('an id no record has is refused, even when a record carries it as a name', async () => {
        const adam = { id: 'p1', name: 'Adam', kjvName: null };
        mocks.acquire.mockImplementation(async () =>
            genManagers({ people: [adam], places: [adam] }),
        );

        for (const kind of ['name', 'location']) {
            const result = await lookup({ kind, id: 'Adam' });
            expect(result).toMatchObject({ isError: true });
            expect(result.reason).toContain('"Adam"');
        }
        expect(mocks.release).toHaveBeenCalledTimes(2);
    });
});
