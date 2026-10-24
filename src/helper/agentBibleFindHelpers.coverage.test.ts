// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        bibleList: [] as { key: string; title: string }[],
        locales: {} as Record<string, string>,
        bookMaps: {} as Record<string, Record<string, string>>,
        controllers: {} as Record<string, any>,
        verseCounts: {} as Record<string, number>,
        textByBible: {} as Record<string, string>,
        titleByBible: {} as Record<string, string>,
        noTermsLocales: [] as string[],
        pickedBibleKey: 'KH',
        liveLookup: null as any,
        popupOpener: null as null | (() => void),
    },
    mocks: {
        getInstant: vi.fn(),
        fromVerseKey: vi.fn(),
        fromTitleText: vi.fn(),
        getCurrentLookup: vi.fn(),
        getBibleInfo: vi.fn(),
        getAllBibles: vi.fn(),
        getVersesCount: vi.fn(),
        getBibleLocale: vi.fn(),
        getStopWord: vi.fn(),
        sanitize: vi.fn(),
        getPopupOpener: vi.fn(),
        applyTarget: vi.fn(),
        doFinding: vi.fn(),
    },
}));

vi.mock('../bible-find/BibleFindController', () => ({
    default: { getInstant: (...args: unknown[]) => mocks.getInstant(...args) },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: (...args: unknown[]) => mocks.fromVerseKey(...args),
        fromTitleText: (...args: unknown[]) => mocks.fromTitleText(...args),
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    default: class LookupBibleItemController {
        selectedBibleItem = { id: 'selected' };
        applyTargetOrBibleKey(...args: unknown[]) {
            return mocks.applyTarget(...args);
        }
    },
    getCurrentLookupBibleItemController: (...args: unknown[]) =>
        mocks.getCurrentLookup(...args),
}));
vi.mock('../others/bibleLookupPopupOpener', () => ({
    getBibleLookupPopupOpener: (...args: unknown[]) =>
        mocks.getPopupOpener(...args),
}));
vi.mock('../lang/langHelpers', () => ({
    checkIsStopWord: (...args: unknown[]) => mocks.getStopWord(...args),
    sanitizeFindingText: (...args: unknown[]) => mocks.sanitize(...args),
    // A language's own words for "in the book of" and "the story of" (the
    // English pack's, as the search reads them in front of a book's name).
    getBookMarkerWords: () => ['in', 'inside', 'from', 'book'],
    getFindFrameWords: () => [
        'find',
        'search',
        'look',
        'show',
        'me',
        'help',
        'please',
        'verse',
        'verses',
        'scripture',
        'bible',
        'story',
        'stories',
        'about',
        'where',
        'which',
        'what',
        'tell',
        'tells',
        'says',
        'say',
    ],
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: (...args: unknown[]) =>
        mocks.getAllBibles(...args),
}));
vi.mock('./bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: (...args: unknown[]) => mocks.getBibleInfo(...args),
}));
vi.mock('./bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: (...args: unknown[]) => mocks.getVersesCount(...args),
}));
vi.mock('./bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: {
        keyBookMap: { GEN: 'Genesis', MAT: 'Matthew', JHN: 'John' },
    },
}));
vi.mock('./bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: (...args: unknown[]) => mocks.getBibleLocale(...args),
}));
// The module is pure (it imports nothing), so what this file does not stand
// in for is the real one: the worker kept gaining helpers -- the named
// books, the frame words, where words gather -- and a mock written out
// whole failed every search the day it did (2026-10-23).
vi.mock('./bibleVerseFindHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./bibleVerseFindHelpers')>()),
    DEFAULT_FIND_LIMIT: 5,
    LONG_UNSPACED_TERM_LENGTH: 8,
    NOT_IN_LANGUAGE_REASON: 'Those words are not in the Bible’s language.',
    MAX_FIND_CANDIDATES: 300,
    MAX_FIND_LIMIT: 100,
    checkIsSpacedLocale: (locale: string) =>
        locale.toLowerCase().startsWith('en'),
    checkVerseFitsChapter: (
        ...args: Parameters<typeof checkVerseFitsChapterMock>
    ) => checkVerseFitsChapterMock(...args),
    countWordHits: (...args: Parameters<typeof countWordHitsMock>) =>
        countWordHitsMock(...args),
    cutFoundText: (text: string) => text.trim(),
    genVerseFindSql: () => genVerseFindSqlMock(),
    genVerseRangeReason: (
        ...args: Parameters<typeof genVerseRangeReasonMock>
    ) => genVerseRangeReasonMock(...args),
    parseFoundVerseRow: (text: string) => parseFoundVerseRowMock(text),
    parseRefParts: (text: string) => parseReference(text),
    pickBibleKeyForBookName: () => state.pickedBibleKey,
    readVerseKey: (text: string) => readVerseKeyMock(text),
    resolveBookFilter: (book: string) =>
        book.toLowerCase() === 'matthew' || book.toLowerCase() === 'mat'
            ? { bookKeys: ['MAT'], unknown: [] }
            : { bookKeys: [], unknown: [book] },
    resolveBookKey: (book: string, maps: Record<string, string>[]) =>
        resolveBookKeyMock(book, maps),
    segmentByVocabulary: (word: string) => [word],
    splitRefList: (refs: string) =>
        refs
            .split(';')
            .map((ref) => ref.trim())
            .filter(Boolean),
    toFindTermList: (words: string[], isStopWord: (word: string) => boolean) =>
        words
            .map((word) => word.trim().toLowerCase())
            .filter(Boolean)
            .filter((word) => !isStopWord(word)),
    toEnglishStem: (word: string) => word.toLowerCase(),
    toNeededHits: () => 1,
    toSingleVerseText: (text: string) => text,
    toTermWeight: (_verseCount: number, count: number) => count,
    toVerseKey: (
        book: string,
        chapter: number,
        start: number,
        end?: number | null,
    ) =>
        `${book} ${chapter}:${start}${end !== null && end !== undefined && end > start ? `-${end}` : ''}`,
}));
vi.mock('./helpers', () => ({
    cloneJson: (value: unknown) => structuredClone(value),
}));

import { handleAgentBibleFindRequest } from './agentBibleFindHelpers';

function parseReference(text: string) {
    const match =
        /^(?<book>(?:[1-3]\s*)?[A-Za-z]+|[A-Z]{3})\s+(?<chapter>\d+)(?::(?<start>\d+)(?:-(?<end>\d+))?)?$/u.exec(
            text.trim(),
        );
    if (match?.groups === undefined) return null;
    return {
        book: match.groups.book,
        chapter: Number(match.groups.chapter),
        verseStart:
            match.groups.start === undefined
                ? null
                : Number(match.groups.start),
        verseEnd:
            match.groups.end === undefined ? null : Number(match.groups.end),
    };
}

function resolveBookKeyMock(book: string, maps: Record<string, string>[]) {
    const upper = book.trim().toUpperCase();
    if (Object.hasOwn(maps.at(-1) ?? {}, upper)) return upper;
    return (
        maps
            .flatMap((map) => Object.entries(map))
            .find(
                ([, name]) => name.toLowerCase() === book.trim().toLowerCase(),
            )?.[0] ?? null
    );
}

function readVerseKeyMock(text: string) {
    const parts = parseReference(text);
    if (parts === null || !/^[A-Z]{3}$/u.test(parts.book)) return null;
    return { ...parts, bookKey: parts.book };
}

function parseFoundVerseRowMock(text: string) {
    const match =
        /^(?<book>[A-Z]{3})\|(?<chapter>\d+)\|(?<verse>\d+)\|(?<text>.*)$/u.exec(
            text,
        );
    if (match?.groups === undefined) return null;
    return {
        bookKey: match.groups.book,
        chapter: Number(match.groups.chapter),
        verse: Number(match.groups.verse),
        text: match.groups.text,
    };
}

function checkVerseFitsChapterMock(
    count: unknown,
    start: number,
    end?: number | null,
) {
    return (
        typeof count === 'number' &&
        start >= 1 &&
        start <= count &&
        (end === null || end === undefined || (end >= start && end <= count))
    );
}

function countWordHitsMock(words: string[], terms: string[]) {
    return terms.map((term) => {
        return words.some((word) => word.toLowerCase().startsWith(term));
    });
}

function genVerseFindSqlMock() {
    return {
        termCountSql: (term: string) => `TERM:${term}`,
        selectSql: 'SELECT CANDIDATES',
        countSql: 'SELECT TOTAL',
    };
}

function genVerseRangeReasonMock(book: string, chapter: number, count: number) {
    return `${book} ${chapter} has ${count} verses.`;
}

function makeVerseItem(bibleKey: string, key: string) {
    const parts = readVerseKeyMock(key) ?? parseReference(key);
    if (parts === null) return null;
    const target = {
        bookKey: 'bookKey' in parts ? parts.bookKey : parts.book,
        chapter: parts.chapter,
        verseStart: parts.verseStart ?? 1,
        verseEnd: parts.verseEnd ?? parts.verseStart ?? 1,
    };
    return {
        target,
        toText: async () => state.textByBible[bibleKey] ?? `${bibleKey} text`,
        toTitle: async () => state.titleByBible[bibleKey] ?? '',
    };
}

function makeDatabase(config: {
    termCounts?: Record<string, number>;
    candidates?: { text: string; hits: number; r: number }[];
    total?: number;
    spell?: { text: string }[];
}) {
    return {
        getAll: vi.fn((sql: string) => {
            if (sql === 'SELECT COUNT(*) AS count FROM verses;') {
                return [{ count: 1000 }];
            }
            if (sql === 'SELECT CANDIDATES') return config.candidates ?? [];
            if (sql === 'SELECT TOTAL') return [{ count: config.total ?? 0 }];
            if (sql === 'SELECT text FROM spell;') return config.spell ?? [];
            if (sql.startsWith('TERM:')) {
                return [{ count: config.termCounts?.[sql.slice(5)] ?? 0 }];
            }
            return [];
        }),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    state.bibleList = [
        { key: 'KJV', title: 'King James Version' },
        { key: 'KH', title: 'Khmer Bible' },
    ];
    state.locales = { KJV: 'en', KH: 'km' };
    state.bookMaps = {
        KJV: { GEN: 'Genesis', MAT: 'Matthew', JHN: 'John' },
        KH: { GEN: 'Genesis KH', MAT: 'Matthew KH', JHN: 'John KH' },
    };
    state.verseCounts = { 'KJV:MAT:3': 36, 'KH:MAT:3': 36 };
    state.textByBible = { KJV: 'KJV verse text', KH: 'Khmer verse text' };
    state.titleByBible = { KH: 'John 3:16 in Khmer' };
    state.noTermsLocales = [];
    state.pickedBibleKey = 'KH';
    state.liveLookup = null;
    state.popupOpener = null;
    state.controllers = {
        KJV: {
            databaseFindHandler: {
                database: makeDatabase({
                    termCounts: { love: 2 },
                    candidates: [
                        {
                            text: 'MAT|3|16|For God so loved the world',
                            hits: 1,
                            r: 0,
                        },
                    ],
                    total: 1,
                }),
            },
            onlineFindHandler: null,
        },
        KH: {
            databaseFindHandler: { database: makeDatabase({}) },
            onlineFindHandler: null,
        },
    };

    mocks.getAllBibles.mockImplementation(async () => state.bibleList);
    mocks.getBibleInfo.mockImplementation(async (key: string) => ({
        keyBookMap: state.bookMaps[key] ?? {},
    }));
    mocks.getBibleLocale.mockImplementation(async (key: string) => {
        return state.locales[key] ?? 'en';
    });
    mocks.getVersesCount.mockImplementation(
        async (key: string, bookKey: string, chapter: number) =>
            state.verseCounts[`${key}:${bookKey}:${chapter}`] ?? 24,
    );
    mocks.getInstant.mockImplementation(async (key: string) => {
        return state.controllers[key] ?? null;
    });
    mocks.getStopWord.mockReturnValue(false);
    mocks.sanitize.mockImplementation(async (locale: string, words: string) =>
        state.noTermsLocales.includes(locale)
            ? ''
            : words
                  .toLowerCase()
                  .replace(/[^\p{L}\p{N}]+/gu, ' ')
                  .trim(),
    );
    mocks.getCurrentLookup.mockImplementation(() => state.liveLookup);
    mocks.getPopupOpener.mockImplementation(() => state.popupOpener);
    mocks.fromVerseKey.mockImplementation(
        async (bibleKey: string, key: string) => makeVerseItem(bibleKey, key),
    );
    mocks.fromTitleText.mockImplementation(
        async (bibleKey: string, ref: string) => makeVerseItem(bibleKey, ref),
    );
});

test('refuses when no Bible is installed or an asked Bible is missing', async () => {
    state.bibleList = [];
    await expect(
        handleAgentBibleFindRequest({ words: 'love' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('No Bible is installed'),
    });

    state.bibleList = [{ key: 'KH', title: 'Khmer Bible' }];
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', refs: 'John 3:16' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('No Bible called "KJV"'),
    });
});

test('a request with no query lists installed Bibles and their locales', async () => {
    await expect(handleAgentBibleFindRequest({})).resolves.toMatchObject({
        bible: 'KJV',
        bibles: [
            { key: 'KJV', title: 'King James Version', locale: 'en' },
            { key: 'KH', title: 'Khmer Bible', locale: 'km' },
        ],
        note: expect.stringContaining('Give words to search'),
    });
});

test('legacy online Bible search sends the bounded query and ignores malformed rows', async () => {
    const online = { doFinding: mocks.doFinding };
    state.controllers.KJV = {
        databaseFindHandler: { database: null },
        onlineFindHandler: online,
    };
    mocks.doFinding.mockResolvedValue({
        maxLineNumber: 18,
        content: [
            { text: 'MAT|3|16|For God so loved the world' },
            { text: 'not a verse row' },
            { text: 'JHN|1|1|In the beginning' },
        ],
    });

    const result = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: ' Love   WORLD ',
        book: 'Matthew',
        limit: 2,
    });

    expect(mocks.doFinding).toHaveBeenCalledWith({
        text: 'love world',
        bookKeys: ['MAT'],
        fromLineNumber: 0,
        toLineNumber: 1,
    });
    expect(result).toMatchObject({
        bible: 'KJV',
        books: ['Matthew'],
        words: ['love', 'world'],
        total: 18,
        verses: [
            {
                key: 'MAT 3:16',
                ref: 'Matthew 3:16',
                text: 'For God so loved the world',
            },
            { key: 'JHN 1:1', ref: 'John 1:1', text: 'In the beginning' },
        ],
    });
});

test('local Bible search reports matched and absent terms with ranked verse hits', async () => {
    const database = makeDatabase({
        termCounts: { love: 8, absent: 0 },
        candidates: [
            {
                text: 'MAT|3|16|For God so loved the world',
                hits: 1,
                r: 0,
            },
        ],
        total: 4,
    });
    state.controllers.KJV.databaseFindHandler.database = database;

    const result = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'love absent',
        limit: 1,
    });

    expect(result).toMatchObject({
        bible: 'KJV',
        words: ['love', 'absent'],
        of: 1,
        total: 1,
        notInBible: ['absent'],
        verses: [
            {
                key: 'MAT 3:16',
                ref: 'Matthew 3:16',
                text: 'For God so loved the world',
                hits: 1,
            },
        ],
    });
    expect(database.getAll).toHaveBeenCalledWith('SELECT CANDIDATES');
});

test('words in another script are searched in English and quoted from the chosen Bible', async () => {
    state.noTermsLocales = ['km'];
    state.controllers.KJV.databaseFindHandler.database = makeDatabase({
        termCounts: { love: 8 },
        candidates: [{ text: 'JHN|3|16|For God so loved', hits: 1, r: 0 }],
        total: 1,
    });

    const result = await handleAgentBibleFindRequest({
        bible: 'KH',
        words: 'love',
    });

    expect(result).toMatchObject({
        bible: 'KH',
        searchedIn: 'KJV',
        verses: [
            {
                key: 'JHN 3:16',
                ref: 'John 3:16',
                text: 'Khmer verse text',
                title: 'John 3:16 in Khmer',
            },
        ],
    });
});

test('a written reference chooses the Bible whose book names it and reports an invalid verse', async () => {
    state.verseCounts['KH:MAT:3'] = 24;

    const result = await handleAgentBibleFindRequest({
        refs: 'Matthew 3:203',
    });

    expect(result).toMatchObject({
        bible: 'KH',
        verses: [],
        unread: ['Matthew 3:203'],
        notFound: [
            {
                ref: 'Matthew 3:203',
                reason: 'Matthew 3 has 24 verses.',
            },
        ],
    });
    expect(mocks.fromVerseKey).not.toHaveBeenCalled();
});

test('opening a valid reference updates the live Lookup and never sends it to a screen', async () => {
    state.liveLookup = {
        selectedBibleItem: { id: 'current' },
        applyTargetOrBibleKey: mocks.applyTarget,
    };

    const result = await handleAgentBibleFindRequest({
        bible: 'KJV',
        open: 'John 3:16',
    });

    expect(result).toMatchObject({
        opened: 'John 3:16',
        bible: 'KJV',
        note: expect.stringContaining('nothing went on a screen'),
    });
    expect(mocks.applyTarget).toHaveBeenCalledWith(
        { id: 'current' },
        {
            bibleKey: 'KJV',
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart: 16,
                verseEnd: 16,
            },
        },
    );
});

test('opening an out-of-range verse refuses without changing the Lookup', async () => {
    state.verseCounts['KJV:MAT:3'] = 24;

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'Matthew 3:203' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: 'Matthew 3 has 24 verses.',
    });
    expect(mocks.applyTarget).not.toHaveBeenCalled();
});

test('opening from a window without a live Lookup needs its popup opener', async () => {
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'not a verse' }),
    ).resolves.toMatchObject({ isError: true });

    const valid = await handleAgentBibleFindRequest({
        bible: 'KJV',
        open: 'John 3:16',
    });
    expect(valid).toMatchObject({
        isError: true,
        reason: expect.stringContaining('no Bible Lookup to open'),
    });
});
