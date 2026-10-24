// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    copy: vi.fn(),
    verses: vi.fn(),
    acquire: vi.fn(),
    release: vi.fn(),
    resolveLocation: vi.fn(),
    shortTitle: vi.fn(),
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: async (_bible: string, key: string) => {
            const match = /^(MAT|JHN) (\d+):(\d+)-(\d+)$/.exec(key);
            return match === null
                ? null
                : {
                      target: {
                          bookKey: match[1],
                          chapter: Number(match[2]),
                          verseStart: Number(match[3]),
                          verseEnd: Number(match[4]),
                      },
                      toVerseFullKey: () => key,
                  };
        },
    },
}));
vi.mock('../location-name-lookup/bibleVerseHelpers', () => ({
    BIBLE_REFERENCE_KIND_BY_SCHEME: { 'book-key': 'book' },
    getLookupVerseBibleKey: () => 'KJV',
    shortToReferenceTitle: mocks.shortTitle,
    shortToVerseCopyData: mocks.copy,
}));
vi.mock('../lang/langHelpers', () => ({ DEFAULT_LANG_CODE: 'en' }));
vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: mocks.acquire,
    releaseLookupData: mocks.release,
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    getLookupLangCodeListAsync: async () => ['en', 'km'],
    getSelectedLookupLangCode: () => 'en',
}));
vi.mock('../location-name-lookup/lookupRecordHelpers', () => ({
    resolveLocationReference: mocks.resolveLocation,
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: async () => [{ key: 'KJV' }, { key: 'KH' }],
}));
vi.mock('./bible-helpers/bibleInfoHelpers', () => ({
    getVerses: mocks.verses,
}));
vi.mock('./bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: vi.fn(),
    getModelKeyBookMap: vi.fn(),
}));
vi.mock('./bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: { keyBookMap: { MAT: 'Matthew', JHN: 'John' } },
}));
vi.mock('./agentBibleFindHelpers', () => ({
    handleAgentBibleFindRequest: mocks.find,
    pickBibleForRefs: async () => 'KH',
}));

import { handleAgentLookupRequest } from './agentLookupHelpers';
import { acquireLookupData } from '../location-name-lookup/lookupDataHelpers';
import { getModelKeyBookMap } from './bible-helpers/bibleLogicHelpers1';

const fullText = Array.from({ length: 14 }, (_, index) => {
    return `(${index + 1}): The complete words of verse ${index + 1}.`;
}).join(' ');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.verses.mockResolvedValue(
        Object.fromEntries(
            Array.from({ length: 14 }, (_, i) => [i + 1, 'text']),
        ),
    );
    mocks.copy.mockResolvedValue({
        title: 'Matthew 18:1-14',
        text: fullText,
        sectionList: [{ title: 'Matthew 18', text: fullText }],
    });
    mocks.find.mockResolvedValue({
        verses: [
            {
                key: 'MAT 18:1-14',
                ref: 'Matthew 18:1-14',
                text: fullText.slice(0, 300) + '…',
            },
        ],
    });
    mocks.acquire.mockResolvedValue({
        namesLookupManager: {
            getRecordById: vi.fn(() => null),
            getRecordsByName: vi.fn(() => []),
            getAllRecords: vi.fn(() => []),
            searchNames: vi.fn(() => []),
        },
        locationsLookupManager: {
            getRecordById: vi.fn(() => null),
            getRecordsByName: vi.fn(() => []),
            getAllRecords: vi.fn(() => []),
            searchLocations: vi.fn(() => []),
        },
    });
    mocks.shortTitle.mockResolvedValue(null);
    mocks.resolveLocation.mockImplementation((manager: any, id: string) =>
        manager.getRecordById(id),
    );
});

test('a written reference quotes the same complete passage as its book code', async () => {
    const written = await handleAgentLookupRequest({
        kind: 'verse',
        bible: 'KJV',
        ref: 'Matthew 18:1-14',
    });
    const keyed = await handleAgentLookupRequest({
        kind: 'verse',
        bible: 'KJV',
        ref: 'MAT 18:1-14',
    });
    expect(written).toEqual(keyed);
    expect(written).toMatchObject({ passages: [{ text: fullText }] });
    expect(mocks.find).toHaveBeenCalledExactlyOnceWith({
        bible: 'KJV',
        refs: 'Matthew 18:1-14',
    });
});

test('the resolved passage keeps its localized title and selected Bible', async () => {
    mocks.copy.mockResolvedValue({
        title: 'ម៉ាថាយ ១៨:១-១៤',
        text: fullText,
        sectionList: [{ text: fullText }],
    });
    const result = await handleAgentLookupRequest({
        kind: 'verse',
        ref: 'ម៉ាថាយ ១៨:១-១៤',
    });
    expect(result).toMatchObject({
        bible: 'KH',
        passages: [{ title: 'ម៉ាថាយ ១៨:១-១៤', text: fullText }],
    });
    expect(mocks.copy).toHaveBeenCalledWith('KH', 'MAT 18:1-14');
});

test('written references retain the existing passage length bound', async () => {
    mocks.copy.mockResolvedValue({
        title: 'Matthew 18:1-14',
        text: 'word '.repeat(2000),
        sectionList: [{ text: 'word '.repeat(2000) }],
    });
    const result: any = await handleAgentLookupRequest({
        kind: 'verse',
        bible: 'KJV',
        ref: 'Matthew 18:1-14',
    });
    expect(result.passages[0].text.length).toBeLessThanOrEqual(6001);
    expect(result.passages[0].text).toMatch(/^word .*…$/);
});

test('an unreadable resolved passage refuses instead of quoting a search preview', async () => {
    mocks.copy.mockRejectedValue(new Error('Bible unavailable'));
    await expect(
        handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'Matthew 18:1-14',
        }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('could not be read'),
    });
});

test('partial resolution keeps missing references and their specific reasons', async () => {
    mocks.find.mockResolvedValue({
        verses: [
            { key: 'MAT 18:1-14', ref: 'Matthew 18:1-14', text: 'preview…' },
        ],
        unread: ['Genesis 3:203'],
        notFound: [
            { ref: 'Genesis 3:203', reason: 'Genesis 3 has 24 verses.' },
        ],
    });
    await expect(
        handleAgentLookupRequest({
            kind: 'verse',
            bible: 'KJV',
            ref: 'Matthew 18:1-14; Genesis 3:203',
        }),
    ).resolves.toMatchObject({
        passages: [{ text: fullText }],
        unread: ['Genesis 3:203'],
        notFound: [
            { ref: 'Genesis 3:203', reason: 'Genesis 3 has 24 verses.' },
        ],
    });
});

test('a localized person record carries its related names and namesakes', async () => {
    const parents = [
        {
            id: 'parent-1',
            name: 'Amram',
            kjvName: 'Amram',
            oldName: null,
            title: '',
            description: '',
            gender: '',
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
        },
    ];
    const record = {
        id: 'moses-1',
        name: 'Moses',
        kjvName: 'Moses',
        oldName: 'Prince of Egypt',
        title: '[Genesis](book-key://GEN)',
        description: 'See [John](book-key://JHN).',
        gender: 'male',
        age: '120 years',
        years: [{ type: 'life', start: -1526, end: -1406 }],
        locations: ['place-1'],
        spouses: [],
        children: [],
        parents: ['parent-1'],
        siblings: [],
        cousin: [],
        type: 'prophet',
        verses: [],
        links: [{ type: 'article', url: 'https://example.test/moses' }],
        wikipedia: 'https://en.wikipedia.org/wiki/Moses',
    };
    const other = { ...record, id: 'moses-2', kjvName: 'Moses' };
    const namesLookupManager = {
        getRecordById: vi.fn((id: string) =>
            id === 'parent-1' ? parents[0] : null,
        ),
        getRecordsByName: vi.fn(() => [record, other]),
        getAllRecords: vi.fn(() => [record, other, ...parents]),
        searchNames: vi.fn(),
    };
    const locationsLookupManager = {
        getRecordById: vi.fn(() => null),
        getRecordsByName: vi.fn(() => []),
        getAllRecords: vi.fn(() => []),
        searchLocations: vi.fn(),
    };
    mocks.acquire.mockResolvedValueOnce({
        namesLookupManager,
        locationsLookupManager,
    });
    mocks.resolveLocation.mockReturnValue({
        id: 'place-1',
        name: 'Midian',
        kjvName: null,
    });
    mocks.shortTitle.mockResolvedValueOnce('Genesis in Khmer');
    mocks.shortTitle.mockResolvedValueOnce('John in Khmer');

    const result: any = await handleAgentLookupRequest({
        kind: 'name',
        name: 'Moses',
        lang: 'km',
    });

    expect(result).toMatchObject({
        kind: 'name',
        id: 'moses-1',
        name: 'Moses',
        alsoCalled: 'Prince of Egypt',
        gender: 'male',
        age: '120 years',
        years: ['life: -1526 – -1406'],
        summary: 'Genesis in Khmer',
        description: 'See John in Khmer.',
        places: [{ id: 'place-1', name: 'Midian' }],
        parents: [{ id: 'parent-1', name: 'Amram' }],
        lang: 'km',
        bible: 'KJV',
        // The other Moses is named as a namesake on every read, and not
        // twice (2026-10-22).
        sameName: [{ id: 'moses-2', name: 'Moses' }],
    });
    expect(result).not.toHaveProperty('otherMatches');
    expect(mocks.release).toHaveBeenCalledWith('km');
});

test('name and place searches return bounded records with their useful labels', async () => {
    const namesLookupManager = {
        getRecordById: vi.fn(() => null),
        getRecordsByName: vi.fn(() => []),
        searchNames: vi.fn(() => [
            {
                id: 'n-1',
                name: 'Moses',
                kjvName: 'Moses',
                title: '[Moses](name-id://n-1)',
                type: 'person',
            },
            { id: 'n-2', name: 'Moshe', kjvName: null, title: '', type: '' },
        ]),
    };
    const locationsLookupManager = {
        getRecordById: vi.fn(() => null),
        getRecordsByName: vi.fn(() => []),
        searchLocations: vi.fn(() => [
            {
                id: 'l-1',
                name: 'Mount Sinai',
                kjvName: 'Sinai',
                title: 'Mountain in the wilderness',
                type: 'mountain',
            },
        ]),
    };
    mocks.acquire.mockResolvedValue({
        namesLookupManager,
        locationsLookupManager,
    });

    await expect(
        handleAgentLookupRequest({
            kind: 'name',
            search: '  Mo   ses ',
            lang: 'km',
        }),
    ).resolves.toEqual({
        kind: 'name',
        search: 'Mo ses',
        lang: 'km',
        count: 2,
        records: [
            {
                id: 'n-1',
                name: 'Moses',
                title: 'Moses',
                type: 'person',
            },
            { id: 'n-2', name: 'Moshe' },
        ],
    });
    await expect(
        handleAgentLookupRequest({
            kind: 'location',
            search: 'Sinai',
        }),
    ).resolves.toMatchObject({
        kind: 'location',
        records: [
            {
                id: 'l-1',
                name: 'Mount Sinai',
                kjvName: 'Sinai',
                title: 'Mountain in the wilderness',
                type: 'mountain',
            },
        ],
    });
    expect(namesLookupManager.searchNames).toHaveBeenCalledWith('Mo ses', {
        limit: 25,
    });
    expect(locationsLookupManager.searchLocations).toHaveBeenCalledWith(
        'Sinai',
        { limit: 25 },
    );
    expect(mocks.release).toHaveBeenCalledTimes(2);
});

test('lookup search and record refusals do not load the dataset unnecessarily', async () => {
    await expect(
        handleAgentLookupRequest({ kind: 'name', search: ' ' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('Give id'),
    });
    await expect(
        handleAgentLookupRequest({ kind: 'name', name: 'Moses', lang: 'fr' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('has: en, km'),
    });
    await expect(
        handleAgentLookupRequest({ kind: 'location', name: 'Nowhere' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('No place'),
    });
    expect(mocks.acquire).toHaveBeenCalledTimes(1);
    expect(mocks.release).toHaveBeenCalledTimes(1);
});

// The dataset's own ids: the alias table is not mocked.
const NOAH_ID = 'efee19ca-1c94-40af-84ce-f452da778047';
const NOE_ID = '909854ad-75f5-47da-a210-0df93ddb1884';
const SEM_ID = 'ec62956f-b4dc-44ce-b56e-d75b6f25ea31';
const SHEM_ID = '5599b7b7-bcae-4cde-abd8-70c657daa39b';
const JERUSALEM_ID = '00000000-0000-4000-8000-000000000117';
const BETHLEHEM_ID = '00000000-0000-4000-8000-000000000034';

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

function genPlace(
    id: string,
    name: string,
    coordinates: { latitude: number; longitude: number } | null,
) {
    return {
        id,
        name,
        kjvName: null,
        oldName: null,
        title: '',
        description: '',
        type: 'city',
        relatedLocations: [],
        modernIdentification: null,
        coordinates,
        verses: [],
        links: [],
        wikipedia: null,
        uncertainty: false,
    };
}

function genManager(recordList: any[]) {
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
        getAllRecords: () => {
            return recordList;
        },
        searchNames: () => [],
        searchLocations: () => [],
    };
}

test('a person is read with its other names, its children once, and namesakes', async () => {
    vi.mocked(getModelKeyBookMap).mockReturnValue({
        GEN: 'Genesis',
        MAT: 'Matthew',
        HEB: 'Hebrews',
    } as any);
    vi.mocked(acquireLookupData).mockResolvedValue({
        namesLookupManager: genManager([
            genPerson(NOAH_ID, 'Noah', {
                title: 'righteous patriarch',
                children: [SEM_ID, SHEM_ID],
                verses: ['HEB 11:7', 'GEN 6:8-10'],
            }),
            genPerson(NOE_ID, 'Noe', {
                title: 'Greek KJV form of [Noah](name-id://x)',
                verses: ['MAT 24:37-38'],
            }),
            genPerson(SEM_ID, 'Sem'),
            genPerson(SHEM_ID, 'Shem'),
            genPerson('noah-2', 'Noah', {
                gender: 'female',
                title: 'daughter of Zelophehad',
            }),
        ]),
        locationsLookupManager: genManager([]),
    } as any);
    const result: any = await handleAgentLookupRequest({
        kind: 'name',
        id: NOAH_ID,
    });
    expect(result).toMatchObject({
        name: 'Noah',
        children: [{ id: SHEM_ID, name: 'Shem' }],
        otherForms: [
            {
                id: NOE_ID,
                name: 'Noe',
                summary: 'Greek KJV form of Noah',
                verses: ['MAT 24:37-38'],
            },
        ],
        sameName: [
            { id: 'noah-2', name: 'Noah', summary: 'daughter of Zelophehad' },
        ],
        verseCount: 3,
        verses: ['GEN 6:8-10', 'MAT 24:37-38', 'HEB 11:7'],
    });
    expect(result).not.toHaveProperty('otherMatches');
});

test('a place is read with how far from Jerusalem, what is near and who lived there', async () => {
    vi.mocked(acquireLookupData).mockResolvedValue({
        namesLookupManager: genManager([
            genPerson('ruth', 'Ruth', { locations: [BETHLEHEM_ID] }),
            genPerson('moses', 'Moses', { locations: ['egypt'] }),
        ]),
        locationsLookupManager: genManager([
            genPlace(BETHLEHEM_ID, 'Bethlehem', {
                latitude: 31.704928,
                longitude: 35.201605,
            }),
            genPlace(JERUSALEM_ID, 'Jerusalem', {
                latitude: 31.777769,
                longitude: 35.236004,
            }),
        ]),
    } as any);
    const result: any = await handleAgentLookupRequest({
        kind: 'location',
        id: BETHLEHEM_ID,
    });
    expect(result).toMatchObject({
        name: 'Bethlehem',
        fromJerusalem: { km: 8.7, direction: 'south' },
        nearby: [{ id: JERUSALEM_ID, km: 8.7, direction: 'north' }],
        people: [{ id: 'ruth', name: 'Ruth' }],
    });
    // Jerusalem is not measured from itself.
    const jerusalem: any = await handleAgentLookupRequest({
        kind: 'location',
        id: JERUSALEM_ID,
    });
    expect(jerusalem).not.toHaveProperty('fromJerusalem');
    expect(jerusalem.nearby).toEqual([
        expect.objectContaining({ id: BETHLEHEM_ID, direction: 'south' }),
    ]);
});
