// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    files: new Map<string, string>(),
    directories: new Set<string>(),
    deleted: [] as string[],
    locks: [] as string[],
    toast: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
    dir: '/data' as string | null,
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: async (path: string) => h.directories.has(path),
    fsCheckFileExist: async (path: string) => h.files.has(path),
    fsDeleteFile: async (path: string) => {
        h.deleted.push(path);
        h.files.delete(path);
    },
    fsMkDirSync: (path: string) => {
        h.directories.add(path);
    },
    fsReadFile: async (path: string) => h.files.get(path),
    fsWriteFile: async (path: string, text: string) => {
        h.files.set(path, text);
    },
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../../setting/directory-setting/directoryHelpers', () => ({
    ensureDataDirectory: async () => h.dir,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (key: string, callback: () => Promise<unknown>) => {
        h.locks.push(key);
        return await callback();
    },
}));
vi.mock('../appHooks', () => ({
    useAppEffect: vi.fn(),
    useAppEffectAsync: vi.fn(),
}));
vi.mock('./aiHelpers', () => ({
    bibleCrossRefSchemaJson: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                titleEn: { type: 'string' },
                verses: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'verses'],
            additionalProperties: false,
        },
    },
}));
vi.mock('../errorHelpers', () => ({ handleError: h.error }));
vi.mock('../bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({
        GEN: 'Genesis',
        EXO: 'Exodus',
        SONG: 'Song of Solomon',
    }),
}));
vi.mock('../helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));
vi.mock('../bible-helpers/bibleInfoHelpers', () => ({
    toVerseFullKeyFormat: (book: string, chapter: number, verse: number) =>
        `${book} ${chapter}:${verse}`,
}));
vi.mock('../bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
    getBibleModelInfoSetting: () => 'model-v1',
}));
vi.mock('../loggerHelpers', () => ({ appError: h.logError }));

import {
    getBibleCrossRef,
    transformCrossReferenceToVerseList,
    validateCrossReference,
    type CrossReferenceType,
} from './bibleCrossRefHelpers';

const data: CrossReferenceType[] = [
    { title: 'Creation', verses: ['Genesis 1:1', 'Exodus 20:11'] },
];
const filePath = '/data/bible-cross-refs/Genesis 1_1.json';
const getCrossRefs = vi.fn(async () => structuredClone(data));

beforeEach(() => {
    h.files.clear();
    h.directories.clear();
    h.deleted.length = 0;
    h.locks.length = 0;
    h.toast.mockClear();
    h.error.mockClear();
    h.logError.mockClear();
    h.dir = '/data';
    getCrossRefs.mockClear();
});

describe('Bible cross reference data', () => {
    test('validates the reference shape before saving it', () => {
        expect(validateCrossReference(data).valid).toBe(true);
        expect(
            validateCrossReference([{ title: 'Bad', verses: [4] }]).valid,
        ).toBe(false);
        expect(
            validateCrossReference([{ title: 'Bad', verses: [], extra: true }])
                .valid,
        ).toBe(false);
    });

    test('builds a key from a verse, creates the cache directory, and writes references', async () => {
        expect(
            await getBibleCrossRef(
                {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseNum: 1,
                    dataDir: 'cross-ref',
                },
                getCrossRefs,
            ),
        ).toEqual(data);
        expect(getCrossRefs).toHaveBeenCalledWith('Genesis 1:1');
        expect(h.locks).toEqual(['cross-ref-Genesis 1:1']);
        expect(h.directories.has('/data/bible-cross-refs')).toBe(true);
        expect(JSON.parse(h.files.get(filePath)!)).toMatchObject({
            value: data,
        });
    });

    test('uses a valid fresh cache and refreshes it when forced', async () => {
        h.files.set(
            filePath,
            JSON.stringify({
                _cachingTime: Date.now(),
                _bibleModel: 'model-v1',
                value: data,
            }),
        );
        const params = { bibleTitle: 'Genesis 1:1', dataDir: 'cross-ref' };
        expect(await getBibleCrossRef(params, getCrossRefs)).toEqual(data);
        expect(getCrossRefs).not.toHaveBeenCalled();
        expect(
            await getBibleCrossRef(
                { ...params, forceRefresh: true },
                getCrossRefs,
            ),
        ).toEqual(data);
        expect(h.deleted).toEqual([filePath]);
        expect(getCrossRefs).toHaveBeenCalledTimes(1);
    });

    test('rejects a cache from another Bible model and stamps the replacement', async () => {
        const stale = [{ title: 'Old model', verses: ['Genesis 1:1'] }];
        h.files.set(
            filePath,
            JSON.stringify({
                _cachingTime: Date.now(),
                _bibleModel: 'model-v0',
                value: stale,
            }),
        );
        expect(
            await getBibleCrossRef(
                {
                    bibleTitle: 'Genesis 1:1',
                    dataDir: 'cross-ref',
                },
                getCrossRefs,
            ),
        ).toEqual(data);
        expect(getCrossRefs).toHaveBeenCalledTimes(1);
        expect(JSON.parse(h.files.get(filePath)!)).toMatchObject({
            _bibleModel: 'model-v1',
            value: data,
        });
    });

    test('discards invalid cached data and recovers from unreadable JSON', async () => {
        h.files.set(
            filePath,
            JSON.stringify({
                _cachingTime: Date.now(),
                _bibleModel: 'model-v1',
                value: [{ title: 4, verses: [] }],
            }),
        );
        const params = { bibleTitle: 'Genesis 1:1', dataDir: 'cross-ref' };
        expect(await getBibleCrossRef(params, getCrossRefs)).toEqual(data);
        expect(h.error).toHaveBeenCalled();
        expect(h.deleted).toEqual([filePath]);
        h.files.set(filePath, '{bad json');
        expect(await getBibleCrossRef(params, getCrossRefs)).toEqual(data);
        expect(h.logError).toHaveBeenCalled();
    });

    test('does not save invalid provider data or access a missing data directory', async () => {
        const invalid = vi.fn(async () => [{ title: 'Bad', verses: [5] }]);
        const params = { bibleTitle: 'Genesis 1:1', dataDir: 'cross-ref' };
        expect(await getBibleCrossRef(params, invalid as any)).toBeNull();
        expect(h.files.size).toBe(0);
        expect(h.error).toHaveBeenCalled();
        h.dir = null;
        expect(await getBibleCrossRef(params, getCrossRefs)).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Bible Cross Reference',
            'Fail to ensure data directory for AI data.',
        );
        expect(getCrossRefs).not.toHaveBeenCalled();
    });

    test('transforms only recognized English book names and does not mutate input', async () => {
        const input: CrossReferenceType[] = [
            {
                title: 'Group',
                verses: [
                    ' Genesis 1:1 ',
                    'Song of Solomon 2:3',
                    'Unknown 1:1',
                    'bad',
                ],
            },
        ];
        const result = await transformCrossReferenceToVerseList(input);
        expect(result?.[0].verses).toEqual(['GEN 1:1', 'SONG 2:3']);
        expect(input[0].verses).toHaveLength(4);
        expect(await transformCrossReferenceToVerseList(null)).toBeNull();
    });
});
