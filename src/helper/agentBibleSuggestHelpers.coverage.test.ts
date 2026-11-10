// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        lang: 'xx',
        lookupBible: 'XX2',
        bibleList: [] as { key: string; locale: string }[],
        bibleInfo: {} as Record<
            string,
            { keyBookMap: Record<string, string>; booksAvailable: string[] }
        >,
        englishNames: {} as Record<string, string>,
        chapterCounts: {} as Record<string, number>,
        verseCount: 12,
        held: null as any,
        acquired: null as any,
        localizedNumbers: true,
    },
    mocks: {
        acquire: vi.fn(),
        release: vi.fn(),
        getBibleInfo: vi.fn(),
        getAllBibles: vi.fn(),
        getVersesCount: vi.fn(),
        fromLocaleNumber: vi.fn(),
        toLocaleNumber: vi.fn(),
        getModelChapterCount: vi.fn(),
        getHeldLookupData: vi.fn(),
    },
}));

vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: (...args: unknown[]) => mocks.acquire(...args),
    getHeldLookupData: (...args: unknown[]) => mocks.getHeldLookupData(...args),
    releaseLookupData: (...args: unknown[]) => mocks.release(...args),
}));
vi.mock('../location-name-lookup/bibleVerseHelpers', () => ({
    getLookupVerseBibleKey: () => state.lookupBible,
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => state.lang,
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: (...args: unknown[]) =>
        mocks.getAllBibles(...args),
}));
vi.mock('./bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: (...args: unknown[]) => mocks.getBibleInfo(...args),
}));
vi.mock('./bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: (...args: unknown[]) =>
        mocks.getModelChapterCount(...args),
    getModelKeyBookMap: () => state.englishNames,
}));
vi.mock('./bible-helpers/bibleLogicHelpers2', () => ({
    fromLocaleNumBible: (...args: unknown[]) => mocks.fromLocaleNumber(...args),
    getVersesCount: (...args: unknown[]) => mocks.getVersesCount(...args),
    toLocaleNumBible: (...args: unknown[]) => mocks.toLocaleNumber(...args),
}));

import { handleAgentBibleSuggestRequest } from './agentBibleSuggestHelpers';

const DIGITS = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];

function toOwnDigits(value: number) {
    return String(value).replace(/\d/g, (digit) => DIGITS[Number(digit)]);
}

function fromOwnDigits(value: string) {
    return Number(
        Array.from(value, (digit) => {
            const index = DIGITS.indexOf(digit);
            return index < 0 ? digit : String(index);
        }).join(''),
    );
}

beforeEach(() => {
    state.lang = 'xx';
    state.lookupBible = 'XX2';
    state.bibleList = [
        { key: 'XX1', locale: 'xx' },
        { key: 'KJV', locale: 'en' },
        { key: 'XX2', locale: 'xx-XX' },
    ];
    state.bibleInfo = {
        XX1: {
            keyBookMap: { GEN: 'First Genesis', JHN: 'First John' },
            booksAvailable: ['GEN', 'JHN'],
        },
        XX2: {
            keyBookMap: { GEN: 'Genesis', JHN: 'John', JOB: 'Job' },
            booksAvailable: ['GEN', 'JHN', 'JOB'],
        },
        KJV: {
            keyBookMap: { GEN: 'Genesis', JHN: 'John', JOB: 'Job' },
            booksAvailable: ['GEN', 'JHN', 'JOB'],
        },
    };
    state.englishNames = { GEN: 'Genesis', JHN: 'John', JOB: 'Job' };
    state.chapterCounts = { GEN: 50, JHN: 21, JOB: 42 };
    state.verseCount = 12;
    state.held = null;
    state.acquired = null;
    state.localizedNumbers = true;

    vi.clearAllMocks();
    mocks.getAllBibles.mockImplementation(async () => state.bibleList);
    mocks.getBibleInfo.mockImplementation(async (key: string) => {
        return state.bibleInfo[key] ?? null;
    });
    mocks.getModelChapterCount.mockImplementation((bookKey: string) => {
        return state.chapterCounts[bookKey] ?? 0;
    });
    mocks.getVersesCount.mockImplementation(
        async (_bibleKey: string, bookKey: string, chapter: number) =>
            chapter <= (state.chapterCounts[bookKey] ?? 0)
                ? state.verseCount
                : 0,
    );
    mocks.fromLocaleNumber.mockImplementation(
        async (_bibleKey: string, value: string) => fromOwnDigits(value),
    );
    mocks.toLocaleNumber.mockImplementation(
        async (_bibleKey: string, value: number) =>
            state.localizedNumbers ? toOwnDigits(value) : String(value),
    );
    mocks.getHeldLookupData.mockImplementation(() => state.held);
    mocks.acquire.mockImplementation(async () => state.acquired);
});

test('book suggestions use the Bible selected in the lookup, then list its matching names', async () => {
    const result = await handleAgentBibleSuggestRequest({ prefix: 'jo' });

    expect(mocks.getBibleInfo).toHaveBeenCalledWith('XX2');
    expect(result).toEqual({
        kind: 'reference',
        suggestions: [
            { label: 'John', fill: 'John ', detail: 'John' },
            { label: 'Job', fill: 'Job ', detail: 'Job' },
        ],
    });
});

test('unavailable Bibles, books, chapters, and verse counts produce no suggestions', async () => {
    state.bibleList = [];
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });

    state.bibleList = [{ key: 'XX2', locale: 'xx' }];
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'Unknown 1' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John 22:' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });

    state.verseCount = 0;
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John 3:' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });
});

test('name suggestions do not load the large lookup dataset unless allowed', async () => {
    await expect(
        handleAgentBibleSuggestRequest({ kind: 'name', prefix: 'Mo' }),
    ).resolves.toEqual({ kind: 'name', suggestions: [] });
    await expect(
        handleAgentBibleSuggestRequest({
            kind: 'name',
            prefix: 'M',
            allowLoad: true,
        }),
    ).resolves.toEqual({ kind: 'name', suggestions: [] });

    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
});

test('name suggestions combine people and places and release a newly acquired dataset', async () => {
    const names = {
        namesLookupManager: {
            searchNames: vi.fn(() => [
                { name: 'Moses', kjvName: 'Moses' },
                { name: 'Moseroth', kjvName: null },
            ]),
        },
        locationsLookupManager: {
            searchLocations: vi.fn(() => [
                { name: 'Mount Horeb', kjvName: 'Horeb' },
            ]),
        },
    };
    state.acquired = names;

    const result = await handleAgentBibleSuggestRequest({
        kind: 'name',
        prefix: 'Mo',
        allowLoad: true,
        limit: 3,
    });

    expect(result).toEqual({
        kind: 'name',
        suggestions: [
            { label: 'Moses', fill: 'Moses', detail: 'Moses' },
            { label: 'Moseroth', fill: 'Moseroth', detail: '' },
            { label: 'Mount Horeb', fill: 'Mount Horeb', detail: 'Horeb' },
        ],
    });
    expect(names.namesLookupManager.searchNames).toHaveBeenCalledWith('Mo', {
        limit: 3,
    });
    expect(names.locationsLookupManager.searchLocations).toHaveBeenCalledWith(
        'Mo',
        { limit: 3 },
    );
    expect(mocks.acquire).toHaveBeenCalledWith('xx');
    expect(mocks.release).toHaveBeenCalledWith('xx');
});

test('a held lookup dataset is reused and not released by the suggestion request', async () => {
    state.held = {
        namesLookupManager: {
            searchNames: () => [{ name: 'Moses', kjvName: 'Moses' }],
        },
        locationsLookupManager: { searchLocations: () => [] },
    };

    await expect(
        handleAgentBibleSuggestRequest({ kind: 'name', prefix: 'Mo' }),
    ).resolves.toMatchObject({
        suggestions: [{ label: 'Moses', fill: 'Moses', detail: 'Moses' }],
    });
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
});

test('numbers the Bible cannot write in its own digits are offered in plain digits', async () => {
    mocks.toLocaleNumber.mockRejectedValue(new Error('no digits'));

    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John 2', limit: 1 }),
    ).resolves.toEqual({
        kind: 'reference',
        suggestions: [{ label: 'John 2', fill: 'John 2:', detail: 'John 2' }],
    });
});

test('a Bible whose book list cannot be read offers no book', async () => {
    mocks.getBibleInfo.mockRejectedValue(new Error('unreadable Bible'));

    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'jo' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });
});

test('digits the Bible cannot read back narrow nothing, and chapter zero has no verses', async () => {
    mocks.fromLocaleNumber.mockImplementation(
        async (_bibleKey: string, value: string) => {
            if (value === '９' || value === '４') {
                throw new Error('not a digit of this Bible');
            }
            return fromOwnDigits(value);
        },
    );

    // `９` alone would be chapter 9: unread, every chapter is offered.
    const chapters = await handleAgentBibleSuggestRequest({
        prefix: 'John ９',
        limit: 3,
    });
    expect(chapters).toMatchObject({
        suggestions: [
            { detail: 'John 1' },
            { detail: 'John 2' },
            { detail: 'John 3' },
        ],
    });
    // A chapter that cannot be read, or chapter 0, has no verses to offer.
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John ９:' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John ０:' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });
    expect(mocks.getVersesCount).not.toHaveBeenCalled();

    // Verse digits that cannot be read leave every verse of the chapter.
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John ３:４', limit: 2 }),
    ).resolves.toMatchObject({
        suggestions: [{ detail: 'John 3:1' }, { detail: 'John 3:2' }],
    });
});

test('a chapter whose verses cannot be counted offers no verse', async () => {
    mocks.getVersesCount.mockRejectedValue(new Error('chapter unreadable'));

    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John ３:' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });
    expect(mocks.getVersesCount).toHaveBeenCalledWith('XX2', 'JHN', 3);
});

test('a names dataset that fails to load offers no name and is not released', async () => {
    mocks.acquire.mockRejectedValue(new Error('dataset unavailable'));

    await expect(
        handleAgentBibleSuggestRequest({
            kind: 'name',
            prefix: 'Mo',
            allowLoad: true,
        }),
    ).resolves.toEqual({ kind: 'name', suggestions: [] });
    expect(mocks.acquire).toHaveBeenCalledWith('xx');
    expect(mocks.release).not.toHaveBeenCalled();
});

test('an acquired lookup dataset is released when a names search throws', async () => {
    state.acquired = {
        namesLookupManager: {
            searchNames: () => {
                throw new Error('lookup failed');
            },
        },
        locationsLookupManager: { searchLocations: () => [] },
    };

    await expect(
        handleAgentBibleSuggestRequest({
            kind: 'name',
            prefix: 'Mo',
            allowLoad: true,
        }),
    ).rejects.toThrow('lookup failed');
    expect(mocks.release).toHaveBeenCalledWith('xx');
});
