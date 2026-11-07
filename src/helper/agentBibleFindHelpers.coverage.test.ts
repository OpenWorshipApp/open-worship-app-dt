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
        pickCalls: [] as unknown[],
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
    // `checkVerseFitsChapter` and `segmentByVocabulary` are the real ones: a
    // chapter that cannot be counted is no verdict, and a run of letters is
    // cut into the vocabulary's own words.
    countWordHits: (...args: Parameters<typeof countWordHitsMock>) =>
        countWordHitsMock(...args),
    cutFoundText: (text: string) => text.trim(),
    genVerseFindSql: () => genVerseFindSqlMock(),
    genVerseRangeReason: (
        ...args: Parameters<typeof genVerseRangeReasonMock>
    ) => genVerseRangeReasonMock(...args),
    parseFoundVerseRow: (text: string) => parseFoundVerseRowMock(text),
    parseRefParts: (text: string) => parseReference(text),
    pickBibleKeyForBookName: (
        book: string,
        infoList: unknown[],
        preferredKey: string,
    ) => {
        state.pickCalls.push({ book, infoList, preferredKey });
        return state.pickedBibleKey;
    },
    readVerseKey: (text: string) => readVerseKeyMock(text),
    resolveBookFilter: (book: string) =>
        book.toLowerCase() === 'matthew' || book.toLowerCase() === 'mat'
            ? { bookKeys: ['MAT'], unknown: [] }
            : { bookKeys: [], unknown: [book] },
    resolveBookKey: (book: string, maps: Record<string, string>[]) =>
        resolveBookKeyMock(book, maps),
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

import {
    handleAgentBibleFindRequest,
    pickBibleForRefs,
} from './agentBibleFindHelpers';

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
    // What the real `genChapterCountSql` scan answers: `c` is `GEN.7`.
    chapters?: {
        c: string;
        count: number;
        rareVerses: number;
        rareScore: number;
    }[];
}) {
    return {
        getAll: vi.fn((sql: string) => {
            if (sql === 'SELECT COUNT(*) AS count FROM verses;') {
                return [{ count: 1000 }];
            }
            if (sql === 'SELECT CANDIDATES') return config.candidates ?? [];
            if (sql === 'SELECT TOTAL') return [{ count: config.total ?? 0 }];
            if (sql === 'SELECT text FROM spell;') return config.spell ?? [];
            if (sql.startsWith('SELECT substr(')) return config.chapters ?? [];
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
    state.pickCalls = [];
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

test('with no Bible asked the Lookup’s Bible is searched, and the first installed one when the Lookup cannot be read', async () => {
    state.liveLookup = {
        selectedBibleItem: { bibleKey: 'KH' },
        applyTargetOrBibleKey: mocks.applyTarget,
    };
    await expect(handleAgentBibleFindRequest({})).resolves.toMatchObject({
        bible: 'KH',
    });

    mocks.getCurrentLookup.mockImplementation(() => {
        throw new Error('no Bible Lookup in this window');
    });
    await expect(handleAgentBibleFindRequest({})).resolves.toMatchObject({
        bible: 'KJV',
    });
});

test('pickBibleForRefs keeps the chosen Bible with nothing to read, and one unreadable Bible does not stop the pick', async () => {
    await expect(pickBibleForRefs('KJV', ' ; ')).resolves.toBe('KJV');
    await expect(pickBibleForRefs('KJV', 'not a reference')).resolves.toBe(
        'KJV',
    );
    expect(mocks.getAllBibles).not.toHaveBeenCalled();
    expect(state.pickCalls).toEqual([]);

    mocks.getBibleInfo.mockImplementation(async (key: string) => {
        if (key === 'KH') {
            throw new Error('unreadable Bible');
        }
        return { keyBookMap: state.bookMaps[key] };
    });
    await expect(
        pickBibleForRefs('KJV', 'John 3:16; Genesis 1:1'),
    ).resolves.toBe('KH');
    expect(state.pickCalls).toEqual([
        {
            book: 'John',
            infoList: [
                { key: 'KJV', keyBookMap: state.bookMaps.KJV },
                { key: 'KH', keyBookMap: undefined },
            ],
            preferredKey: 'KJV',
        },
    ]);
});

test('a book named the way a third installed Bible names it is read even when another Bible cannot be opened', async () => {
    state.bibleList = [
        { key: 'KJV', title: 'King James Version' },
        { key: 'KH', title: 'Khmer Bible' },
        { key: 'XX', title: 'A Third Bible' },
    ];
    state.locales.XX = 'xx';
    // A made-up name only that Bible gives the book.
    state.bookMaps.XX = { JHN: 'Xohn' };
    mocks.getBibleInfo.mockImplementation(async (key: string) => {
        if (key === 'KH') {
            throw new Error('unreadable Bible');
        }
        return { keyBookMap: state.bookMaps[key] ?? {} };
    });

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', refs: 'Xohn 3:16' }),
    ).resolves.toEqual({
        bible: 'KJV',
        verses: [{ key: 'JHN 3:16', ref: 'John 3:16', text: 'KJV verse text' }],
    });
    expect(mocks.fromTitleText).not.toHaveBeenCalled();
});

test('a run of letters in an unspaced Bible is cut into its own words, and the English Bible is named for a translation', async () => {
    const database = makeDatabase({
        termCounts: { love: 3, enemies: 2, jesusasked: 1 },
        candidates: [{ text: 'MAT|5|44|love your enemies', hits: 2, r: 0 }],
        chapters: [{ c: 'MAT.5', count: 1, rareVerses: 1, rareScore: 3 }],
        spell: [
            { text: 'love' },
            { text: 'your' },
            { text: 'enemies' },
            { text: 'jesus asked' },
        ],
    });
    state.controllers.KH.databaseFindHandler.database = database;
    state.titleByBible.KH = '✝ ５:４４';
    mocks.getStopWord.mockImplementation((locale: string, word: string) => {
        return locale === 'km' && word === 'your';
    });

    const result = await handleAgentBibleFindRequest({
        bible: 'KH',
        words: 'loveyourenemies jesusasked',
    });

    expect(result).toMatchObject({
        bible: 'KH',
        // `jesusasked` is a word of the vocabulary, kept whole; `your` is a
        // stop word of the language.
        words: ['love', 'enemies', 'jesusasked'],
        of: 3,
        total: 1,
        verses: [
            {
                key: 'MAT 5:44',
                ref: 'Matthew 5:44',
                text: 'love your enemies',
                hits: 2,
                title: '✝ ５:４４',
            },
        ],
        englishBible: 'KJV',
        note: expect.stringContaining('This script has no spaces'),
    });
    expect(result).not.toHaveProperty('next');
    expect(database.getAll).toHaveBeenCalledWith('SELECT text FROM spell;');
    expect(database.getAll).toHaveBeenCalledWith('TERM:enemies');
    expect(database.getAll).not.toHaveBeenCalledWith('TERM:loveyourenemies');

    // A short word is searched as typed: the vocabulary is not read for it.
    database.getAll.mockClear();
    await expect(
        handleAgentBibleFindRequest({ bible: 'KH', words: 'love' }),
    ).resolves.toMatchObject({ words: ['love'] });
    expect(database.getAll).not.toHaveBeenCalledWith('SELECT text FROM spell;');
});

test('a book named after a word like "in" is the book searched, not a word to find', async () => {
    const database = makeDatabase({
        termCounts: { noah: 5, dove: 3 },
        candidates: [
            {
                text: 'GEN|8|11|And the dove came in to him; Noah knew',
                hits: 2,
                r: 0,
            },
        ],
    });
    state.controllers.KJV.databaseFindHandler.database = database;

    const result = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'in Genesis noah dove',
    });

    expect(result).toMatchObject({
        bible: 'KJV',
        words: ['noah', 'dove'],
        books: ['Genesis'],
        readAsBook: ['genesis'],
        total: 1,
        verses: [{ key: 'GEN 8:11', ref: 'Genesis 8:11', hits: 2 }],
    });
    expect(result).not.toHaveProperty('notBooks');
    // The scan is narrowed to the book; a name after "in" is not counted.
    expect(database.getAll).toHaveBeenCalledWith(
        expect.stringContaining("WHERE (text LIKE 'GEN.%')"),
    );
    expect(database.getAll).not.toHaveBeenCalledWith('TERM:genesis');

    // A book with nothing left to search for is searched as words.
    const bookOnly = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'in Genesis',
    });
    expect(bookOnly).toMatchObject({ words: ['in', 'genesis'] });
    expect(bookOnly).not.toHaveProperty('books');
    expect(bookOnly).not.toHaveProperty('readAsBook');
});

test('a book name the verses use is a word to find, and a misspelt one is the book only while no verse uses it', async () => {
    state.bookMaps.KJV = { ...state.bookMaps.KJV, DAN: 'Daniel' };
    const termCounts: Record<string, number> = {
        daniel: 5,
        lions: 2,
        den: 2,
        noah: 5,
        dove: 3,
    };
    const database = makeDatabase({
        termCounts,
        candidates: [
            { text: 'DAN|6|16|cast him into the den of lions', hits: 2, r: 0 },
        ],
    });
    state.controllers.KJV.databaseFindHandler.database = database;

    const daniel = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'Daniel lions den',
    });
    expect(daniel).toMatchObject({
        words: ['daniel', 'lions', 'den'],
        verses: [{ key: 'DAN 6:16', hits: 2 }],
    });
    expect(daniel).not.toHaveProperty('books');
    expect(daniel).not.toHaveProperty('readAsBook');
    expect(database.getAll).toHaveBeenCalledWith('TERM:daniel');

    const misspelt = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'Genisis noah dove',
    });
    expect(misspelt).toMatchObject({
        words: ['noah', 'dove'],
        books: ['Genesis'],
        readAsBook: ['genisis'],
        // The one verse held neither word read word by word.
        total: 0,
        verses: [],
        note: expect.stringContaining('No verse has these words together'),
    });

    termCounts.genisis = 2;
    const written = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'Genisis noah dove',
    });
    expect(written).toMatchObject({ words: ['genisis', 'noah', 'dove'] });
    expect(written).not.toHaveProperty('books');
});

test('verses where the words gather rank first, with the passage, every book and the next page', async () => {
    const database = makeDatabase({
        termCounts: { noah: 5, dove: 3 },
        candidates: [
            {
                text: 'GEN|8|11|And the dove came in to him; Noah knew',
                hits: 2,
                r: 2,
            },
            { text: 'GEN|7|1|And the LORD said unto Noah', hits: 1, r: 1 },
            // "Noe" holds neither word read word by word: left out.
            { text: 'MAT|24|37|But as the days of Noe were', hits: 1, r: 3 },
            {
                text: 'GEN|8|8|Also he sent forth a dove from him',
                hits: 1,
                r: 0,
            },
            { text: 'GEN|7|5|And Noah did according unto all', hits: 1, r: 4 },
            { text: 'GEN|8|1|And God remembered Noah', hits: 1, r: 5 },
        ],
        chapters: [
            { c: 'GEN.7', count: 9, rareVerses: 2, rareScore: 10 },
            { c: 'GEN.8', count: 9, rareVerses: 3, rareScore: 12 },
            { c: 'MAT.24', count: 9, rareVerses: 1, rareScore: 1 },
            { c: 'not a chapter', count: 9, rareVerses: 9, rareScore: 99 },
        ],
    });
    state.controllers.KJV.databaseFindHandler.database = database;

    const first = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'noah dove',
        limit: 2,
    });
    expect(first).toEqual({
        bible: 'KJV',
        words: ['noah', 'dove'],
        of: 2,
        // Counted word by word: the run-together count said 27.
        total: 5,
        verses: [
            {
                key: 'GEN 8:11',
                ref: 'Genesis 8:11',
                text: 'And the dove came in to him; Noah knew',
                hits: 2,
            },
            // Ties go to the chapter holding more of the verses found:
            // Genesis 8 holds three, Genesis 7 two.
            {
                key: 'GEN 8:1',
                ref: 'Genesis 8:1',
                text: 'And God remembered Noah',
                hits: 1,
            },
        ],
        next: 2,
        passages: [{ ref: 'Genesis 7-8', key: 'GEN 8', verses: 5 }],
        byBook: [{ book: 'Genesis', key: 'GEN', verses: 5 }],
    });

    const second: any = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'noah dove',
        limit: 2,
        from: 2,
    });
    expect(second).toMatchObject({ from: 2, next: 4 });
    expect(
        second.verses.map((verse: { key: string }) => {
            return verse.key;
        }),
    ).toEqual(['GEN 7:1', 'GEN 7:5']);

    const last: any = await handleAgentBibleFindRequest({
        bible: 'KJV',
        words: 'noah dove',
        limit: 2,
        from: 4,
    });
    expect(
        last.verses.map((verse: { key: string }) => {
            return verse.key;
        }),
    ).toEqual(['GEN 8:8']);
    expect(last).not.toHaveProperty('next');
});

test('an unspaced Bible names the passages and books a search gathers in its own words and digits', async () => {
    state.controllers.KH.databaseFindHandler.database = makeDatabase({
        termCounts: { noe: 4, dove: 3 },
        candidates: [
            { text: 'GEN|8|11|dove noe', hits: 2, r: 1 },
            { text: 'GEN|7|1|noe', hits: 1, r: 0 },
            { text: 'GEN|8|1|noe remembered', hits: 1, r: 2 },
        ],
        chapters: [
            { c: 'GEN.7', count: 2, rareVerses: 2, rareScore: 8 },
            { c: 'GEN.8', count: 3, rareVerses: 3, rareScore: 9 },
            { c: 'DAN.6', count: 3, rareVerses: 3, rareScore: 5 },
        ],
    });
    mocks.getBibleInfo.mockImplementation(async (key: string) => ({
        keyBookMap: state.bookMaps[key] ?? {},
        ...(key === 'KH'
            ? { numbersMap: { '1': '１', '7': '７', '8': '８' } }
            : {}),
    }));
    mocks.fromVerseKey.mockImplementation(
        async (bibleKey: string, key: string) => {
            if (key === 'GEN 7:1') {
                throw new Error('not in this Bible');
            }
            const item = makeVerseItem(bibleKey, key);
            if (item !== null && key === 'GEN 8:1') {
                return {
                    ...item,
                    toTitle: async () => {
                        throw new Error('no title');
                    },
                };
            }
            return item;
        },
    );
    state.titleByBible.KH = '✝ ８:１１';

    const result: any = await handleAgentBibleFindRequest({
        bible: 'KH',
        words: 'noe dove',
        limit: 3,
    });

    expect(result).toMatchObject({
        bible: 'KH',
        total: 8,
        next: 3,
        englishBible: 'KJV',
    });
    expect(result.passages).toEqual([
        {
            ref: 'Genesis 7-8',
            key: 'GEN 8',
            verses: 5,
            title: 'Genesis KH ７-８',
            keyTitle: 'Genesis KH ８',
        },
        // A book this Bible has no name for keeps the English one.
        { ref: 'DAN 6', key: 'DAN 6', verses: 3 },
    ]);
    expect(result.byBook).toEqual([
        { book: 'Genesis', key: 'GEN', verses: 5, title: 'Genesis KH' },
        { book: 'DAN', key: 'DAN', verses: 3 },
    ]);
    // A verse the Bible cannot title, or cannot read, is listed untitled.
    expect(result.verses).toEqual([
        {
            key: 'GEN 8:11',
            ref: 'Genesis 8:11',
            text: 'dove noe',
            hits: 2,
            title: '✝ ８:１１',
        },
        { key: 'GEN 8:1', ref: 'Genesis 8:1', text: 'noe remembered', hits: 1 },
        { key: 'GEN 7:1', ref: 'Genesis 7:1', text: 'noe', hits: 1 },
    ]);
});

test('passages keep their English names when the Bible’s own names cannot be read back', async () => {
    state.controllers.KH.databaseFindHandler.database = makeDatabase({
        termCounts: { noe: 4 },
        candidates: [{ text: 'GEN|8|11|noe', hits: 1, r: 0 }],
        chapters: [
            { c: 'GEN.8', count: 2, rareVerses: 2, rareScore: 9 },
            { c: 'MAT.24', count: 1, rareVerses: 0, rareScore: 0 },
        ],
    });
    let khReads = 0;
    mocks.getBibleInfo.mockImplementation(async (key: string) => {
        // Read for the search; gone by the time the passages are named.
        if (key === 'KH' && ++khReads > 1) {
            throw new Error('the Bible was removed meanwhile');
        }
        return { keyBookMap: state.bookMaps[key] ?? {} };
    });

    const result: any = await handleAgentBibleFindRequest({
        bible: 'KH',
        words: 'noe',
        limit: 1,
    });

    expect(result.passages).toEqual([
        { ref: 'Genesis 8', key: 'GEN 8', verses: 2 },
    ]);
    expect(result.byBook).toEqual([
        { book: 'Genesis', key: 'GEN', verses: 2 },
        { book: 'Matthew', key: 'MAT', verses: 1 },
    ]);
    expect(result.verses).toEqual([
        {
            key: 'GEN 8:11',
            ref: 'Genesis 8:11',
            text: 'noe',
            hits: 1,
            title: 'John 3:16 in Khmer',
        },
    ]);
});

test('a search refuses a Bible it cannot open, a book that is no book, a Bible with no way to search, and says when no word is in it', async () => {
    state.controllers.KJV = undefined;
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', words: 'love' }),
    ).resolves.toEqual({
        isError: true,
        reason: expect.stringContaining('could not be opened for searching'),
    });

    state.controllers.KJV = {
        databaseFindHandler: {
            database: makeDatabase({ termCounts: { love: 2 } }),
        },
        onlineFindHandler: null,
    };
    await expect(
        handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'love',
            book: 'Hezekiah',
        }),
    ).resolves.toEqual({
        isError: true,
        reason: expect.stringContaining(
            '"Hezekiah" is not a book of the Bible',
        ),
    });

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', words: 'zzz' }),
    ).resolves.toEqual({
        bible: 'KJV',
        words: ['zzz'],
        total: 0,
        verses: [],
        notInBible: ['zzz'],
        note: expect.stringContaining('None of these words is in this Bible'),
    });

    state.controllers.KJV = {
        databaseFindHandler: { database: null },
        onlineFindHandler: null,
    };
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', words: 'love' }),
    ).resolves.toEqual({
        isError: true,
        reason: 'The Bible KJV cannot be searched.',
    });
});

test('words not in the asked Bible’s language go to the KJV first, then another English Bible, before any other', async () => {
    state.bibleList = [
        { key: 'KH', title: 'Khmer Bible' },
        { key: 'XX', title: 'Another Bible' },
        { key: 'WEB', title: 'World English Bible' },
        { key: 'KJV', title: 'King James Version' },
    ];
    state.locales = { KH: 'km', XX: 'xx', WEB: 'en-US', KJV: 'en' };
    state.noTermsLocales = ['km'];
    // The KJV is tried and cannot be opened; the next English one answers.
    state.controllers.KJV = undefined;
    state.controllers.WEB = {
        databaseFindHandler: {
            database: makeDatabase({
                termCounts: { love: 4 },
                candidates: [
                    {
                        text: 'JHN|3|16|For God so loved the world',
                        hits: 1,
                        r: 0,
                    },
                ],
            }),
        },
        onlineFindHandler: null,
    };
    state.controllers.XX = {
        databaseFindHandler: {
            database: makeDatabase({ termCounts: { love: 4 } }),
        },
        onlineFindHandler: null,
    };

    const result = await handleAgentBibleFindRequest({
        bible: 'KH',
        words: 'love',
    });

    expect(result).toMatchObject({
        bible: 'KH',
        searchedIn: 'WEB',
        verses: [{ key: 'JHN 3:16', text: 'Khmer verse text' }],
        note: expect.stringContaining('searched in WEB'),
    });
    expect(
        mocks.getInstant.mock.calls.map(([key]) => {
            return key;
        }),
    ).toEqual(['KH', 'KJV', 'WEB']);
});

test('words no installed Bible’s language reads are refused with the asked Bible’s language, no other index built', async () => {
    state.noTermsLocales = ['en', 'km'];

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', words: '✝✝' }),
    ).resolves.toEqual({
        isError: true,
        reason: expect.stringMatching(
            /^Those words are not in the Bible’s language\. KJV is written in "en"/,
        ),
    });
    expect(mocks.getInstant).toHaveBeenCalledExactlyOnceWith('KJV');
});

test('a phrase of nothing but asking words leaves no word to search in any Bible', async () => {
    mocks.getStopWord.mockImplementation((_locale: string, word: string) => {
        return word === 'the';
    });

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', words: 'find the' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('KJV is written in "en"'),
    });
    expect(
        mocks.getInstant.mock.calls.map(([key]) => {
            return key;
        }),
    ).toEqual(['KJV', 'KH']);
});

test('references read a chapter that cannot be counted and a book written the Bible’s own way, and leave out what reads as nothing', async () => {
    mocks.getVersesCount.mockRejectedValue(new Error('chapter unreadable'));
    mocks.fromTitleText.mockImplementation(
        async (bibleKey: string, ref: string) => {
            return ref === 'Jn 3:17'
                ? makeVerseItem(bibleKey, 'JHN 3:17')
                : null;
        },
    );
    mocks.fromVerseKey.mockImplementation(
        async (bibleKey: string, key: string) => {
            const item = makeVerseItem(bibleKey, key);
            if (item !== null && key === 'JHN 3:18') {
                return {
                    ...item,
                    toText: async () => {
                        throw new Error('unreadable verse');
                    },
                };
            }
            if (item !== null && key === 'JHN 3:19') {
                // The renderer's placeholder for a missing verse.
                return { ...item, toText: async () => ' ?? ' };
            }
            return item;
        },
    );

    await expect(
        handleAgentBibleFindRequest({
            bible: 'KJV',
            refs: 'John 3:16; Jn 3:17; John 3:18; John 3:19; Nowhere 1:1',
        }),
    ).resolves.toEqual({
        bible: 'KJV',
        verses: [
            { key: 'JHN 3:16', ref: 'John 3:16', text: 'KJV verse text' },
            { key: 'JHN 3:17', ref: 'John 3:17', text: 'KJV verse text' },
        ],
        unread: ['John 3:18', 'John 3:19', 'Nowhere 1:1'],
        note: expect.stringContaining(
            'Write a reference as book, chapter and verse',
        ),
    });
});

test('open takes a result’s key, a whole chapter, and a verse whose chapter cannot be counted, through the popup', async () => {
    const openPopup = vi.fn();
    state.popupOpener = openPopup;

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'JHN 3:16' }),
    ).resolves.toEqual({
        opened: 'John 3:16',
        bible: 'KJV',
        note: expect.stringContaining('nothing went on a screen'),
    });
    expect(mocks.applyTarget).toHaveBeenCalledWith(
        { id: 'selected' },
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
    expect(openPopup).toHaveBeenCalledTimes(1);

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'John 3' }),
    ).resolves.toMatchObject({ opened: 'John 3:1-24' });
    expect(mocks.fromVerseKey).toHaveBeenLastCalledWith('KJV', 'JHN 3:1-24');

    mocks.getVersesCount.mockRejectedValue(new Error('chapter unreadable'));
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'JHN 3:16' }),
    ).resolves.toMatchObject({ opened: 'John 3:16' });
    expect(openPopup).toHaveBeenCalledTimes(3);
});

test('open refuses a book no Bible names, an empty or unreadable chapter, and a verse the Bible cannot read', async () => {
    const openPopup = vi.fn();
    state.popupOpener = openPopup;

    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'Xohn 3:16' }),
    ).resolves.toEqual({
        isError: true,
        reason: expect.stringContaining('"Xohn 3:16" is not a verse of KJV'),
    });

    mocks.getVersesCount.mockResolvedValue(0);
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'John 4' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('"John 4" is not a verse of KJV'),
    });

    mocks.getVersesCount.mockRejectedValue(new Error('chapter unreadable'));
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'John 5' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('"John 5" is not a verse of KJV'),
    });

    mocks.getVersesCount.mockResolvedValue(24);
    mocks.fromVerseKey.mockRejectedValue(new Error('no such verse'));
    await expect(
        handleAgentBibleFindRequest({ bible: 'KJV', open: 'JHN 3:16' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('"JHN 3:16" is not a verse of KJV'),
    });
    expect(mocks.applyTarget).not.toHaveBeenCalled();
    expect(openPopup).not.toHaveBeenCalled();
});
