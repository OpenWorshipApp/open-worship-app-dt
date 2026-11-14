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
        return langCode === 'xx' ? 'XXV' : 'KJV';
    },
    shortToReferenceTitle: (...args: any[]) => mocks.referenceTitle(...args),
    shortToVerseCopyData: (...args: any[]) => mocks.copy(...args),
    shortToVerseTitle: (...args: any[]) => mocks.verseTitle(...args),
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    ensureLangPlugins: async () => [],
    getSupportedLocales: () => ['en-US', 'xx-XX', 'yy-YY'],
    getLocalBibleCrossRef: (...args: any[]) => mocks.crossRef(...args),
}));
vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: (langCode: string) => mocks.acquire(langCode),
    releaseLookupData: (langCode: string) => mocks.release(langCode),
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    getLookupLangCodeListAsync: async () => ['en', 'xx'],
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

import {
    CROSS_REF_SOURCE_TEXT,
    handleAgentLookupRequest,
} from './agentLookupHelpers';
import { toLexicalContent } from './agentNoteTextHelpers';

async function lookup(request: Record<string, unknown>): Promise<any> {
    return await handleAgentLookupRequest(request);
}

function genRecord(id: string, name: string, kjvName: string | null = null) {
    return { id, name, kjvName };
}

function genPerson(
    id: string,
    name: string,
    fields: Record<string, unknown> = {},
) {
    return {
        id,
        name,
        kjvName: null,
        oldName: null,
        title: '',
        description: '',
        gender: 'male',
        age: 'unknown',
        years: [],
        locations: [],
        spouses: [],
        children: [],
        parents: [],
        siblings: [],
        cousin: [],
        type: 'person',
        verses: [],
        links: [],
        wikipedia: null,
        ...fields,
    };
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
    state.infoList = [{ key: 'KJV' }, { key: 'XXV' }];
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
            title: bibleKey === 'XXV' ? `XXV ${key}` : model.toEnglish(key),
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
            return bibleKey === 'XXV' ? `XXV ${key}` : model.toEnglish(key);
        },
    );
    mocks.referenceTitle.mockResolvedValue(null);
    mocks.find.mockResolvedValue({ verses: [] });
    mocks.pick.mockImplementation(async (bibleKey: string) => bibleKey);
    mocks.bibleInfo.mockImplementation(async (bibleKey: string) => {
        return (
            {
                KJV: { locale: 'en-US' },
                XXV: { locale: 'xx-XX' },
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

describe('asking', () => {
    test('a kind is needed, and a passage needs its reference', async () => {
        for (const request of [{}, { kind: 'book' }]) {
            await expect(lookup(request)).resolves.toEqual({
                isError: true,
                reason:
                    'Give kind: "name" for a person, "location" for a place, ' +
                    'or "verse" for a Bible passage.',
            });
        }
        await expect(lookup({ kind: 'verse', ref: '   ' })).resolves.toEqual({
            isError: true,
            reason: 'Give ref: the passage to read, "GEN 2:19-21" or "Genesis 2:19".',
        });
        expect(mocks.copy).not.toHaveBeenCalled();
    });

    test('a search in a language the names lookup lacks is refused unread', async () => {
        await expect(
            lookup({ kind: 'location', search: 'Sinai', lang: 'de' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The names lookup has no "de" language. It has: en, xx.',
        });
        expect(mocks.acquire).not.toHaveBeenCalled();
    });
});

describe('which Bible', () => {
    test('with no Bible installed a passage is refused, and a record still reads', async () => {
        state.infoList = null;
        await expect(
            lookup({ kind: 'verse', ref: 'GEN 1:1' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'No Bible is installed on this computer, so no verse can ' +
                'be read. A Bible is added in Settings, under the Bible tab.',
        });
        mocks.acquire.mockResolvedValue(
            genManagers({
                people: [
                    genPerson('noah', 'Noah', {
                        verses: ['GEN 6:8', 'GEN 6:9'],
                    }),
                ],
            }),
        );
        const noah = await lookup({ kind: 'name', id: 'noah' });
        expect(noah).toMatchObject({
            name: 'Noah',
            verseCount: 2,
            verses: ['GEN 6:8', 'GEN 6:9'],
        });
        expect(noah).not.toHaveProperty('bible');
        expect(noah).not.toHaveProperty('quoted');
        expect(mocks.copy).not.toHaveBeenCalled();
    });

    test('a Bible asked for must be installed, matched without case', async () => {
        await expect(
            lookup({ kind: 'verse', ref: 'GEN 1:1', bible: 'NIV' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No Bible called "NIV" is installed. Installed: KJV, XXV.',
        });
        await expect(
            lookup({ kind: 'verse', ref: 'GEN 1:1', bible: 'xxv' }),
        ).resolves.toMatchObject({
            bible: 'XXV',
            passages: [{ key: 'GEN 1:1', title: 'XXV GEN 1:1' }],
        });
        // A Bible asked for is the one read: no other is picked for the words.
        expect(mocks.pick).not.toHaveBeenCalled();
    });

    test("with none asked, the lookup language's Bible, else the first installed", async () => {
        state.selectedLang = 'xx';
        await expect(
            lookup({ kind: 'verse', ref: 'GEN 1:1' }),
        ).resolves.toMatchObject({ bible: 'XXV' });
        expect(mocks.pick).toHaveBeenLastCalledWith('XXV', 'GEN 1:1');
        state.infoList = [{ key: 'ESV' }, { key: 'LUT' }];
        await expect(
            lookup({ kind: 'verse', ref: 'GEN 1:1' }),
        ).resolves.toMatchObject({ bible: 'ESV' });
    });

    test('a Bible picker that fails keeps the lookup Bible', async () => {
        mocks.pick.mockRejectedValue(new Error('no book names'));
        await expect(
            lookup({ kind: 'verse', ref: 'GEN 1:1' }),
        ).resolves.toMatchObject({
            bible: 'KJV',
            passages: [{ key: 'GEN 1:1', ref: 'Genesis 1:1' }],
        });
    });
});

describe('reading a passage', () => {
    test('a passage over chapters is quoted chapter by chapter, under each title', async () => {
        const result = await lookup({
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

    test('a verse past its chapter is no verse: the finder says why', async () => {
        state.verseCounts['GEN 3'] = 24;
        mocks.find.mockResolvedValue({
            verses: [],
            notFound: [
                { ref: 'GEN 3:30', reason: 'Genesis 3 has 24 verses.' },
                { ref: 'EXO 41:1', reason: 'Exodus has 40 chapters.' },
                { ref: 5, reason: 'not a reference' },
                null,
            ],
        });
        await expect(
            lookup({ kind: 'verse', bible: 'KJV', ref: 'GEN 3:30; EXO 41:1' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Genesis 3 has 24 verses. Exodus has 40 chapters.',
        });
        expect(mocks.find).toHaveBeenCalledExactlyOnceWith({
            bible: 'KJV',
            refs: 'GEN 3:30; EXO 41:1',
        });
        // A verse past its chapter's end is never even read for its words.
        expect(mocks.copy).not.toHaveBeenCalledWith('KJV', 'GEN 3:30');
    });

    test('a key that will not parse, or words that are empty, are not quoted', async () => {
        state.throwKeys.add('GEN 1:1');
        await expect(
            lookup({ kind: 'verse', bible: 'KJV', ref: 'GEN 1:1' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                '"GEN 1:1" could not be read in KJV. Write a reference as ' +
                'book, chapter and verse -- "Genesis 2:19" or "GEN 2:19".',
        });
        state.throwKeys.clear();
        mocks.copy.mockResolvedValueOnce({
            title: 'Genesis 1:2',
            text: '   ',
            sectionList: [],
        });
        await expect(
            lookup({ kind: 'verse', bible: 'KJV', ref: 'GEN 1:2' }),
        ).resolves.toMatchObject({ isError: true });
        expect(mocks.find).toHaveBeenCalledTimes(2);
    });

    test('a chapter that cannot be counted is read rather than refused', async () => {
        state.failedChapters.add('GEN 2');
        await expect(
            lookup({ kind: 'verse', bible: 'KJV', ref: 'GEN 2:7' }),
        ).resolves.toMatchObject({
            passages: [{ key: 'GEN 2:7', text: 'Words of GEN 2.' }],
        });
    });
});

describe('the passage beside one', () => {
    test.each([
        ['GEN 1:5', 'next', 'GEN 1:6'],
        ['GEN 1:30', 'next', 'GEN 2:1'],
        ['GEN 50:30', 'next', 'EXO 1:1'],
        ['GEN 1:5', 'previous', 'GEN 1:4'],
        ['GEN 2:1', 'previous', 'GEN 1:30'],
        ['EXO 1:1', 'previous', 'GEN 50:30'],
        ['GEN 1:1-3', 'next', 'GEN 2:1-30'],
        ['GEN 2:4-6', 'previous', 'GEN 1:1-30'],
        ['GEN 50:1-3', 'next', 'EXO 1:1-30'],
        ['JHN 18:33-19:16', 'next', 'JHN 20:1-30'],
        ['JHN 18:33-19:16', 'previous', 'JHN 17:1-30'],
        ['GEN 1:5; EXO 2:2', 'next', 'GEN 1:6'],
    ])('%s, %s, is %s', async (ref, near, expected) => {
        const result = await lookup({ kind: 'verse', bible: 'KJV', ref, near });
        expect(
            result.passages.map((passage: any) => {
                return passage.key;
            }),
        ).toEqual([expected]);
    });

    test('a chapter of one verse is named as that verse', async () => {
        state.verseCounts['GEN 2'] = 1;
        await expect(
            lookup({
                kind: 'verse',
                bible: 'KJV',
                ref: 'GEN 1:1-3',
                near: 'next',
            }),
        ).resolves.toMatchObject({ passages: [{ key: 'GEN 2:1' }] });
    });

    test('a word other than previous or next reads the passage itself', async () => {
        await expect(
            lookup({
                kind: 'verse',
                bible: 'KJV',
                ref: 'GEN 1:5',
                near: 'after',
            }),
        ).resolves.toMatchObject({ passages: [{ key: 'GEN 1:5' }] });
    });

    test.each([
        ['GEN 1:1', 'previous', 'before'],
        ['GEN 1:1-5', 'previous', 'before'],
        ['REV 22:21', 'next', 'after'],
        ['REV 22:1-5', 'next', 'after'],
        // Read neither as a code nor as words. (This row was `Genesis 1:1`,
        // asserting the bug the next test is about.)
        ['Nowhere 1:1', 'next', 'after'],
        // Over chapters, a book code the Bible model lacks fails to parse.
        ['JOH 3:16-4:2', 'next', 'after'],
        // One verse of it parsed, and the chapter count of a book the model
        // does not have threw a raw TypeError (2026-11-03). The finder here
        // reads nothing, so there is still no passage to name.
        ['JOH 3:16', 'next', 'after'],
    ])('there is no passage %s the edge (%s)', async (ref, near, side) => {
        state.verseCounts['REV 22'] = 21;
        await expect(
            lookup({ kind: 'verse', bible: 'KJV', ref, near }),
        ).resolves.toEqual({
            isError: true,
            reason: `There is no passage ${side} "${ref}" in KJV.`,
        });
        expect(mocks.copy).not.toHaveBeenCalled();
    });

    // Stepping read book codes alone, while a passage is as often written the
    // way a person writes it -- `John 3:16` is the tool's own example -- and
    // both sides of it answered "There is no passage" (found live,
    // 2026-11-03). The finder's reader names the passage; the step goes on
    // from the key it read.
    test.each([
        ['John 3:16', 'JHN 3:16', 'next', 'JHN 3:17'],
        ['John 3:16', 'JHN 3:16', 'previous', 'JHN 3:15'],
        ['JOH 3:16', 'JHN 3:16', 'next', 'JHN 3:17'],
        ['Genesis 1', 'GEN 1:1-30', 'next', 'GEN 2:1-30'],
        // Neither a code nor English words: only the finder can read it.
        ['✝ ５:３', 'MAT 5:3', 'previous', 'MAT 5:2'],
    ])(
        '%s, read by the finder as %s, steps %s to %s',
        async (ref, key, near, expected) => {
            mocks.find.mockImplementation(
                async ({ refs }: { refs: string }) => {
                    return refs === ref
                        ? {
                              bible: 'KJV',
                              verses: [{ key, ref, text: 'words' }],
                          }
                        : { bible: 'KJV', verses: [] };
                },
            );
            const result = await lookup({
                kind: 'verse',
                bible: 'KJV',
                ref,
                near,
            });
            expect(
                result.passages.map((passage: any) => {
                    return passage.key;
                }),
            ).toEqual([expected]);
            expect(mocks.find).toHaveBeenCalledWith({
                bible: 'KJV',
                refs: ref,
            });
        },
    );

    // The finder reads a passage's words as well as its key: a code that
    // steps on its own is never sent to it.
    test('a book code steps without asking the finder', async () => {
        await expect(
            lookup({
                kind: 'verse',
                bible: 'KJV',
                ref: 'GEN 1:5',
                near: 'next',
            }),
        ).resolves.toMatchObject({ passages: [{ key: 'GEN 1:6' }] });
        expect(mocks.find).not.toHaveBeenCalled();
    });

    // The verse before is in the same chapter, so it is named -- and then it
    // cannot be read, which says how to write a reference. It threw a raw
    // TypeError (`reading 'chapterCount'`) on the way (2026-11-03).
    test('the verse before one in a book the model lacks is a sentence, not a TypeError', async () => {
        await expect(
            lookup({
                kind: 'verse',
                bible: 'KJV',
                ref: 'JOH 3:16',
                near: 'previous',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                '"JOH 3:15" could not be read in KJV. Write a reference as ' +
                'book, chapter and verse -- "Genesis 2:19" or "GEN 2:19".',
        });
    });

    test('nor beside a chapter that reads no verses', async () => {
        state.verseCounts['GEN 1'] = 0;
        state.verseCounts['GEN 3'] = 0;
        await expect(
            lookup({
                kind: 'verse',
                bible: 'KJV',
                ref: 'GEN 2:1',
                near: 'previous',
            }),
        ).resolves.toMatchObject({
            reason: 'There is no passage before "GEN 2:1" in KJV.',
        });
        await expect(
            lookup({
                kind: 'verse',
                bible: 'KJV',
                ref: 'GEN 2:1-4',
                near: 'next',
            }),
        ).resolves.toMatchObject({
            reason: 'There is no passage after "GEN 2:1-4" in KJV.',
        });
    });
});

describe('names in a passage', () => {
    test('each person and place once, with every verse that names them', async () => {
        const cain = genRecord('cain', 'Cain');
        const managers = genManagers({
            namesByVerse: {
                'GEN 4:1': [
                    genRecord('adam', 'Adam', 'Adam'),
                    genRecord('eve', 'Eva', 'Eve'),
                    cain,
                ],
                'GEN 4:2': [genRecord('abel', 'Abel', 'Abel'), cain],
                'GEN 4:3': [cain],
            },
            placesByVerse: { 'GEN 4:3': [genRecord('eden', 'Eden')] },
        });
        mocks.acquire.mockResolvedValue(managers);
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 4:1-3',
            names: true,
        });
        expect(result.people).toEqual([
            { id: 'adam', name: 'Adam', verses: ['4:1'] },
            { id: 'eve', name: 'Eva', kjvName: 'Eve', verses: ['4:1'] },
            { id: 'cain', name: 'Cain', verses: ['4:1', '4:2', '4:3'] },
            { id: 'abel', name: 'Abel', verses: ['4:2'] },
        ]);
        expect(result.places).toEqual([
            { id: 'eden', name: 'Eden', verses: ['4:3'] },
        ]);
        expect(result.lang).toBe('en');
        expect(mocks.acquire).toHaveBeenCalledWith('en');
        expect(mocks.release).toHaveBeenCalledWith('en');
    });

    test('over chapters, verse by verse into the next, forty names at most', async () => {
        state.verseCounts['JHN 18'] = 40;
        const many = Array.from({ length: 45 }, (_, index) => {
            return genRecord(`p${index}`, `Person ${index}`);
        });
        const managers = genManagers({
            namesByVerse: {
                'JHN 18:39': many,
                'JHN 19:1': [many[0], many[44]],
            },
        });
        mocks.acquire.mockResolvedValue(managers);
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'JHN 18:39-19:2',
            names: true,
            lang: 'xx',
        });
        expect(
            managers.namesLookupManager.searchByShortVerse.mock.calls.map(
                ([verseKey]) => {
                    return verseKey;
                },
            ),
        ).toEqual(['JHN 18:39', 'JHN 18:40', 'JHN 19:1', 'JHN 19:2']);
        expect(result.people).toHaveLength(40);
        expect(result.people[0].verses).toEqual(['18:39', '19:1']);
        expect(
            result.people.some((one: any) => {
                return one.id === 'p44';
            }),
        ).toBe(false);
        expect(result.lang).toBe('xx');
        expect(mocks.release).toHaveBeenCalledWith('xx');
    });

    test('a long passage is looked through for its first two hundred verses', async () => {
        const managers = genManagers();
        mocks.acquire.mockResolvedValue(managers);
        await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 1:1-10:30',
            names: true,
        });
        const calls = managers.namesLookupManager.searchByShortVerse.mock.calls;
        expect(calls).toHaveLength(200);
        expect(calls.at(-1)).toEqual(['GEN 7:20']);
    });

    test('names in a language the lookup lacks are left out, the dataset unloaded', async () => {
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 4:1',
            names: true,
            lang: 'de',
        });
        expect(result.passages).toHaveLength(1);
        expect(result).not.toHaveProperty('people');
        expect(mocks.acquire).not.toHaveBeenCalled();
    });
});

describe('what a passage is related to', () => {
    function setGenesisEight() {
        state.verseCounts['GEN 7'] = 24;
        state.verseCounts['GEN 8'] = 22;
        state.verseCounts['GEN 9'] = 29;
        // Matthew 24:37-39 must fit its chapter to be quoted.
        state.verseCounts['MAT 24'] = 51;
    }

    test('the verses around it, the notes on it, and where the Bible leads', async () => {
        setGenesisEight();
        // Matthew 5 is shorter than the verse a theme names: counted, not quoted.
        state.verseCounts['MAT 5'] = 20;
        state.untitledKeys.add('EXO 29:18');
        mocks.crossRef.mockImplementation(
            genThemeMap({
                'GEN 8:20': [
                    {
                        title: 'Early <b>Altars</b> &amp; Offerings',
                        verses: [
                            'GEN 12:7',
                            'GEN 13:18',
                            'EXO 20:24',
                            'GEN 8:21',
                        ],
                    },
                    { title: 'Clean animals', verses: ['GEN 7:2', 'MAT 5:24'] },
                    { title: 'A third theme', verses: ['JHN 1:1'] },
                ],
                'GEN 8:21': [
                    {
                        title: 'A Sweet Savour',
                        verses: ['EXO 29:18', 'GEN 12:7', 'MAT 24:37-39'],
                    },
                ],
                'GEN 8:22': new Error('bundle unreadable'),
                'GEN 7:11': [
                    {
                        title: 'The flood',
                        verses: ['REV 6:12', 'JHN 3:16', 'GEN 6:17'],
                    },
                ],
            }),
        );
        mocks.readNoteIndexes.mockResolvedValue({
            shortVerseNoteRefs: {
                'GEN 8:20': ['/notes/Default.own@3'],
                'GEN 8:21': [
                    '/notes/Default.own@3',
                    '/notes/Sunday.own@1',
                    'broken',
                ],
                'GEN 9:1': ['/notes/Other.own@2'],
            },
            verseAnnotationsMap: {
                '(KJV) GEN 8:21': {
                    highlights: [{ highlight: { text: 'a sweet savour' } }],
                    comments: [
                        { comment: { text: 'sweet', comment: 'Noah offered' } },
                    ],
                },
                '(KJV) GEN 1:1': {
                    highlights: [{ highlight: { text: 'In the beginning' } }],
                    comments: [],
                },
            },
        });
        mocks.readNoteFile.mockImplementation(async (filePath: string) => {
            if (filePath !== '/notes/Default.own') {
                throw new Error('unreadable note file');
            }
            return {
                items: [
                    { metadata: { id: 2 }, title: 'Unrelated', content: '' },
                    {
                        metadata: { id: 3 },
                        title: 'Altar',
                        content: toLexicalContent('Noah built an altar'),
                    },
                ],
            };
        });

        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });

        expect(result.passages).toEqual([
            {
                key: 'GEN 8:20-22',
                ref: 'Genesis 8:20-22',
                text: 'Words of GEN 8.',
            },
        ]);
        expect(result.around).toEqual({
            before: { key: 'GEN 8:1-19', title: 'Genesis 8:1-19' },
            after: { key: 'GEN 9:1-29', title: 'Genesis 9:1-29' },
        });
        expect(result.yourNotes).toEqual({
            verseCount: 2,
            notes: [
                {
                    file: 'Default',
                    title: 'Altar',
                    verses: ['GEN 8:20', 'GEN 8:21'],
                    text: 'Noah built an altar',
                },
            ],
            noteCount: 1,
            marks: [
                {
                    verse: 'GEN 8:21',
                    bible: 'KJV',
                    highlighted: ['a sweet savour'],
                    comments: [{ words: 'sweet', comment: 'Noah offered' }],
                },
            ],
            markCount: 1,
        });
        expect(result.crossRefs).toEqual({
            source: CROSS_REF_SOURCE_TEXT,
            language: 'en-US',
            verseCount: 2,
            themeCount: 4,
            referenceCount: 9,
            mostCited: [
                {
                    key: 'GEN 12:7',
                    from: ['20', '21'],
                    title: 'Genesis 12:7',
                    text: 'Words of GEN 12.',
                },
            ],
            otherTestamentName: 'New Testament',
            otherTestament: [
                { key: 'MAT 5:24', from: ['20'] },
                {
                    key: 'MAT 24:37-39',
                    from: ['21'],
                    title: 'Matthew 24:37-39',
                    text: 'Words of MAT 24.',
                },
                { key: 'JHN 1:1', from: ['20'], title: 'John 1:1' },
            ],
            otherTestamentAround: [
                {
                    key: 'JHN 3:16',
                    from: ['7:11'],
                    title: 'John 3:16',
                    text: 'Words of JHN 3.',
                },
                { key: 'REV 6:12', from: ['7:11'], title: 'Revelation 6:12' },
            ],
            byVerse: [
                {
                    verse: '20',
                    themes: [
                        {
                            theme: 'Early Altars & Offerings',
                            refs: [
                                'Genesis 12:7',
                                'Genesis 13:18',
                                'Exodus 20:24',
                            ],
                        },
                        {
                            theme: 'Clean animals',
                            refs: ['Genesis 7:2', 'Matthew 5:24'],
                        },
                    ],
                },
                {
                    verse: '21',
                    themes: [
                        {
                            theme: 'A Sweet Savour',
                            refs: [
                                'EXO 29:18',
                                'Genesis 12:7',
                                'Matthew 24:37-39',
                            ],
                        },
                    ],
                },
            ],
        });
        // The bundle is read in the Bible's language, one verse at a time.
        expect(mocks.crossRef).toHaveBeenCalledWith('en-US', {
            bookKey: 'GEN',
            chapter: 8,
            verse: 20,
        });
        // A reference named under two verses is titled once.
        expect(
            mocks.verseTitle.mock.calls.filter(([, key]) => {
                return key === 'GEN 12:7';
            }),
        ).toHaveLength(1);
    });

    test('one verse is told whole, every reference in its themes order', async () => {
        setGenesisEight();
        mocks.crossRef.mockImplementation(
            genThemeMap({
                'GEN 8:21': [
                    {
                        title: 'A Sweet Savour',
                        verses: [
                            'EXO 29:18',
                            'GEN 12:7',
                            'MAT 24:37-39',
                            'EXO 20:24',
                        ],
                    },
                    { title: 'Never again', verses: ['GEN 9:11', 'GEN 9:15'] },
                ],
            }),
        );
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:21',
            related: true,
        });
        const { mostCited, byVerse } = result.crossRefs;
        expect(
            mostCited.map((one: any) => {
                return one.key;
            }),
        ).toEqual([
            'EXO 29:18',
            'GEN 12:7',
            'MAT 24:37-39',
            'EXO 20:24',
            'GEN 9:11',
            'GEN 9:15',
        ]);
        // The first three are quoted, the rest named.
        expect(
            mostCited.map((one: any) => {
                return 'text' in one;
            }),
        ).toEqual([true, true, true, false, false, false]);
        expect(byVerse).toEqual([
            {
                verse: '21',
                themes: [
                    {
                        theme: 'A Sweet Savour',
                        refs: [
                            'Exodus 29:18',
                            'Genesis 12:7',
                            'Matthew 24:37-39',
                            'Exodus 20:24',
                        ],
                    },
                    {
                        theme: 'Never again',
                        refs: ['Genesis 9:11', 'Genesis 9:15'],
                    },
                ],
            },
        ]);
        // The rest of the chapter each side: one verse after is one verse.
        expect(result.around).toEqual({
            before: { key: 'GEN 8:1-20', title: 'Genesis 8:1-20' },
            after: { key: 'GEN 8:22', title: 'Genesis 8:22' },
        });
    });

    test('at a chapter start the whole chapter before, at a book end nothing after', async () => {
        state.verseCounts['GEN 8'] = 22;
        state.verseCounts['REV 22'] = 21;
        await expect(
            lookup({
                kind: 'verse',
                bible: 'KJV',
                ref: 'GEN 9:1-3',
                related: true,
            }),
        ).resolves.toMatchObject({
            around: {
                before: { key: 'GEN 8:1-22' },
                after: { key: 'GEN 9:4-30' },
            },
        });
        const end = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'REV 22:1-21',
            related: true,
        });
        expect(end.around).toEqual({
            before: { key: 'REV 21:1-30', title: 'Revelation 21:1-30' },
        });
        // Genesis 1 has nothing before it, and a title that fails is the key.
        state.untitledKeys.add('GEN 1:4-30');
        const start = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 1:1-3',
            related: true,
        });
        expect(start.around).toEqual({
            after: { key: 'GEN 1:4-30', title: 'GEN 1:4-30' },
        });
    });

    test('a book of one chapter, read whole, has no verses around it', async () => {
        state.verseCounts['JUD 1'] = 25;
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'JUD 1:1-25',
            related: true,
        });
        expect(result.passages).toHaveLength(1);
        expect(result).not.toHaveProperty('around');
        // Nobody wrote anything here and the bundle has nothing: neither is said.
        expect(result).not.toHaveProperty('yourNotes');
        expect(result).not.toHaveProperty('crossRefs');
    });

    test('a neighbouring chapter that reads no verses is left out', async () => {
        state.verseCounts['GEN 4'] = 0;
        state.verseCounts['GEN 6'] = 0;
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 5:1-30',
            related: true,
        });
        expect(result).not.toHaveProperty('around');
    });

    test('the cross references are read in the Bible language, else in English', async () => {
        state.infoList = [
            { key: 'KJV' },
            { key: 'XXV' },
            { key: 'LUT' },
            { key: 'OLD' },
        ];
        mocks.crossRef.mockImplementation(
            genThemeMap({
                'GEN 8:21': [{ title: 'Theme', verses: ['GEN 12:7'] }],
            }),
        );
        const inOwnLanguage = await lookup({
            kind: 'verse',
            bible: 'XXV',
            ref: 'GEN 8:21',
            related: true,
        });
        expect(inOwnLanguage.crossRefs).toMatchObject({
            language: 'xx-XX',
            mostCited: [
                {
                    key: 'GEN 12:7',
                    title: 'XXV GEN 12:7',
                    text: 'Words of GEN 12.',
                },
            ],
            byVerse: [{ verse: '21', themes: [{ refs: ['XXV GEN 12:7'] }] }],
        });
        expect(mocks.crossRef).toHaveBeenCalledWith('xx-XX', {
            bookKey: 'GEN',
            chapter: 8,
            verse: 21,
        });
        for (const bible of ['LUT', 'OLD']) {
            const result = await lookup({
                kind: 'verse',
                bible,
                ref: 'GEN 8:21',
                related: true,
            });
            expect(result.crossRefs.language).toBe('en-US');
        }
    });

    test('a note index or a Bible that fails takes only its own part away', async () => {
        setGenesisEight();
        mocks.crossRef.mockImplementation(
            genThemeMap({
                'GEN 8:21': [{ title: 'Theme', verses: ['GEN 12:7'] }],
            }),
        );
        mocks.readNoteIndexes.mockRejectedValue(new Error('index unavailable'));
        const noNotes = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(noNotes).not.toHaveProperty('yourNotes');
        expect(noNotes.crossRefs.mostCited).toEqual([
            {
                key: 'GEN 12:7',
                from: ['21'],
                title: 'Genesis 12:7',
                text: 'Words of GEN 12.',
            },
        ]);
        mocks.bibleInfo.mockRejectedValue(new Error('info unavailable'));
        const noCrossRefs = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:20-22',
            related: true,
        });
        expect(noCrossRefs).not.toHaveProperty('crossRefs');
        expect(noCrossRefs.around).toMatchObject({
            before: { key: 'GEN 8:1-19' },
        });
    });

    function genWideThemes(themeChars: number, verseCount: number) {
        const themeMap: Record<string, unknown> = {};
        for (let verse = 1; verse <= verseCount; verse++) {
            themeMap[`GEN 8:${verse}`] = [
                {
                    title: `${'A'.repeat(themeChars)} ${verse}`,
                    verses: [
                        'GEN 9:15',
                        'MAT 24:37-39',
                        'EXO 20:24',
                        'JHN 3:16',
                    ],
                },
                {
                    title: `${'B'.repeat(themeChars)} ${verse}`,
                    verses: ['GEN 9:16'],
                },
            ];
        }
        return genThemeMap(themeMap);
    }

    test('too much for a card: one theme a verse goes first, every verse kept', async () => {
        setGenesisEight();
        mocks.crossRef.mockImplementation(genWideThemes(200, 20));
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:1-20',
            related: true,
        });
        const { crossRefs } = result;
        expect(JSON.stringify(crossRefs).length).toBeLessThanOrEqual(9000);
        expect(crossRefs.byVerse).toHaveLength(20);
        for (const one of crossRefs.byVerse) {
            expect(one.themes).toHaveLength(1);
            expect(one.themes[0].theme.startsWith('A')).toBe(true);
            // Fewer references a theme comes only after one theme a verse.
            expect(one.themes[0].refs).toHaveLength(4);
        }
        // Led to from all twenty verses: six named and the rest counted.
        expect(crossRefs.mostCited[0]).toEqual({
            key: 'GEN 9:15',
            from: ['1', '2', '3', '4', '5', '6'],
            fromCount: 20,
            title: 'Genesis 9:15',
            text: 'Words of GEN 9.',
        });
        expect(
            mocks.verseTitle.mock.calls.filter(([, key]) => {
                return key === 'GEN 9:15';
            }),
        ).toHaveLength(1);
    });

    test('far too much: references, then quotes, then verses from the end go', async () => {
        setGenesisEight();
        mocks.crossRef.mockImplementation(genWideThemes(600, 20));
        const result = await lookup({
            kind: 'verse',
            bible: 'KJV',
            ref: 'GEN 8:1-20',
            related: true,
        });
        const { crossRefs } = result;
        expect(JSON.stringify(crossRefs).length).toBeLessThanOrEqual(9000);
        const kept = crossRefs.byVerse.map((one: any) => {
            return one.verse;
        });
        expect(kept.length).toBeGreaterThan(0);
        expect(kept.length).toBeLessThan(20);
        // Cut from the end: the first verses stay, in order.
        expect(kept).toEqual(
            Array.from({ length: kept.length }, (_, index) => {
                return String(index + 1);
            }),
        );
        for (const one of crossRefs.byVerse) {
            expect(one.themes).toHaveLength(1);
            expect(one.themes[0].refs).toEqual([
                'Genesis 9:15',
                'Matthew 24:37-39',
            ]);
        }
        for (const list of [crossRefs.mostCited, crossRefs.otherTestament]) {
            expect(list.length).toBeGreaterThan(0);
            for (const one of list) {
                expect(one).not.toHaveProperty('text');
            }
        }
    });
});

describe('a person or a place', () => {
    test("found by the panel's search when no name matches, the rest named", async () => {
        const moshe = genPerson('m1', 'Moshe', {
            kjvName: 'Moses',
            title: 'lawgiver',
        });
        const mosheh = genPerson('m2', 'Mosheh', { kjvName: 'Moses' });
        const moishe = genPerson('m3', 'Moishe', { kjvName: 'Moishe' });
        const mossa = genPerson('m4', 'Mossa', { kjvName: 'Moza' });
        const managers = genManagers({
            people: [moshe, mosheh, moishe, mossa],
        });
        managers.namesLookupManager.searchNames.mockReturnValue([
            moshe,
            mosheh,
            moishe,
            mossa,
        ]);
        mocks.acquire.mockResolvedValue(managers);
        const result = await lookup({ kind: 'name', name: 'Mos' });
        expect(managers.namesLookupManager.searchNames).toHaveBeenCalledWith(
            'Mos',
            { limit: 6 },
        );
        expect(result).toMatchObject({
            id: 'm1',
            name: 'Moshe',
            kjvName: 'Moses',
            summary: 'lawgiver',
            // The other Moses is a namesake, so it is not a match as well.
            sameName: [{ id: 'm2', name: 'Mosheh', kjvName: 'Moses' }],
            otherMatches: [
                { id: 'm3', name: 'Moishe' },
                { id: 'm4', name: 'Mossa', kjvName: 'Moza' },
            ],
        });
    });

    test('one that is not there is named back, and the dataset given back', async () => {
        await expect(lookup({ kind: 'name', name: 'Zzz' })).resolves.toEqual({
            isError: true,
            reason:
                'No person or name "Zzz" is in the names lookup. Try the ' +
                'English name, or another spelling.',
        });
        await expect(lookup({ kind: 'name', id: 'nobody' })).resolves.toEqual({
            isError: true,
            reason:
                'No person or name "nobody" is in the names lookup. Try the ' +
                'English name, or another spelling.',
        });
        expect(mocks.acquire).toHaveBeenCalledTimes(2);
        expect(mocks.release).toHaveBeenCalledTimes(2);
    });

    test('its verses are quoted, eight read at most, an unreadable one left out', async () => {
        state.verseCounts['GEN 6'] = 22;
        const verses = [
            'GEN 6:8',
            'GEN 6:99',
            ...Array.from({ length: 8 }, (_, index) => {
                return `GEN 6:${index + 9}`;
            }),
        ];
        mocks.acquire.mockImplementation(async () => {
            return genManagers({
                people: [genPerson('noah', 'Noah', { verses })],
            });
        });
        const result = await lookup({ kind: 'name', id: 'noah' });
        expect(result.bible).toBe('KJV');
        expect(result.verseCount).toBe(10);
        expect(
            result.quoted.map((one: any) => {
                return one.key;
            }),
        ).toEqual([
            'GEN 6:8',
            'GEN 6:9',
            'GEN 6:10',
            'GEN 6:11',
            'GEN 6:12',
            'GEN 6:13',
            'GEN 6:14',
        ]);
        expect(result.quoted[0]).toEqual({
            key: 'GEN 6:8',
            ref: 'Genesis 6:8',
            text: 'Words of GEN 6.',
        });
        // Read in the Bible asked for; a Bible that is not there quotes nothing.
        const inOwnLanguage = await lookup({
            kind: 'name',
            id: 'noah',
            bible: 'XXV',
        });
        expect(inOwnLanguage.bible).toBe('XXV');
        expect(inOwnLanguage.quoted[0]).toMatchObject({ title: 'XXV GEN 6:8' });
        const missing = await lookup({
            kind: 'name',
            id: 'noah',
            bible: 'NIV',
        });
        expect(missing).not.toHaveProperty('bible');
        expect(missing).not.toHaveProperty('quoted');
        expect(missing.verseCount).toBe(10);
    });

    test('a place is found by its own name', async () => {
        const sinai = {
            ...genPerson('sinai', 'Sinai'),
            type: 'mountain',
            relatedLocations: [],
            modernIdentification: 'Jebel Musa',
            coordinates: null,
            uncertainty: true,
        };
        mocks.acquire.mockResolvedValue(genManagers({ places: [sinai] }));
        const result = await lookup({ kind: 'location', name: 'Sinai' });
        expect(result).toMatchObject({
            kind: 'location',
            id: 'sinai',
            name: 'Sinai',
            type: 'mountain',
            modernIdentification: 'Jebel Musa',
            isPlaceUncertain: true,
        });
        expect(result).not.toHaveProperty('fromJerusalem');
        expect(result).not.toHaveProperty('otherMatches');
    });
});
