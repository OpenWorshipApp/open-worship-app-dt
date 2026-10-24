// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        lang: 'km',
        lookupBible: 'KH2',
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

const DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

function toKhmerDigits(value: number) {
    return String(value).replace(/\d/g, (digit) => DIGITS[Number(digit)]);
}

function fromKhmerDigits(value: string) {
    return Number(
        Array.from(value, (digit) => {
            const index = DIGITS.indexOf(digit);
            return index < 0 ? digit : String(index);
        }).join(''),
    );
}

beforeEach(() => {
    state.lang = 'km';
    state.lookupBible = 'KH2';
    state.bibleList = [
        { key: 'KH1', locale: 'km' },
        { key: 'KJV', locale: 'en' },
        { key: 'KH2', locale: 'km-KH' },
    ];
    state.bibleInfo = {
        KH1: {
            keyBookMap: { GEN: 'First Genesis', JHN: 'First John' },
            booksAvailable: ['GEN', 'JHN'],
        },
        KH2: {
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
        async (_bibleKey: string, value: string) => fromKhmerDigits(value),
    );
    mocks.toLocaleNumber.mockImplementation(
        async (_bibleKey: string, value: number) =>
            state.localizedNumbers ? toKhmerDigits(value) : String(value),
    );
    mocks.getHeldLookupData.mockImplementation(() => state.held);
    mocks.acquire.mockImplementation(async () => state.acquired);
});

test('book suggestions use the Bible selected in the lookup, then list its matching names', async () => {
    const result = await handleAgentBibleSuggestRequest({ prefix: 'jo' });

    expect(mocks.getBibleInfo).toHaveBeenCalledWith('KH2');
    expect(result).toEqual({
        kind: 'reference',
        suggestions: [
            { label: 'John', fill: 'John ', detail: 'John' },
            { label: 'Job', fill: 'Job ', detail: 'Job' },
        ],
    });
});

test('chapter choices decode and return the lookup Bible’s digits and honor the limit', async () => {
    const result = await handleAgentBibleSuggestRequest({
        prefix: 'John ១',
        limit: 2,
    });

    expect(result).toEqual({
        kind: 'reference',
        suggestions: [
            { label: 'John ១', fill: 'John ១:', detail: 'John 1' },
            { label: 'John ១០', fill: 'John ១០:', detail: 'John 10' },
        ],
    });
    expect(mocks.getModelChapterCount).toHaveBeenCalledWith('JHN');
});

test('digit-only chapter and verse drafts use the card’s book hint', async () => {
    const chapterResult = await handleAgentBibleSuggestRequest({
        prefix: '១',
        book: 'JHN',
        limit: 2,
    });
    const verseResult = await handleAgentBibleSuggestRequest({
        prefix: '៣:១',
        book: 'JHN',
        limit: 3,
    });

    expect(chapterResult).toMatchObject({
        suggestions: [
            { fill: 'John ១:', detail: 'John 1' },
            { fill: 'John ១០:', detail: 'John 10' },
        ],
    });
    expect(verseResult).toMatchObject({
        suggestions: [
            { fill: 'John ៣:១', detail: 'John 3:1' },
            { fill: 'John ៣:១០', detail: 'John 3:10' },
            { fill: 'John ៣:១១', detail: 'John 3:11' },
        ],
    });
    expect(mocks.getVersesCount).toHaveBeenCalledWith('KH2', 'JHN', 3);
});

test('unavailable Bibles, books, chapters, and verse counts produce no suggestions', async () => {
    state.bibleList = [];
    await expect(
        handleAgentBibleSuggestRequest({ prefix: 'John' }),
    ).resolves.toEqual({ kind: 'reference', suggestions: [] });

    state.bibleList = [{ key: 'KH2', locale: 'km' }];
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
    expect(mocks.acquire).toHaveBeenCalledWith('km');
    expect(mocks.release).toHaveBeenCalledWith('km');
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
    expect(mocks.release).toHaveBeenCalledWith('km');
});
