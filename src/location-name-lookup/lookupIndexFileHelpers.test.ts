import { beforeEach, describe, expect, test, vi } from 'vitest';

// One in-memory data folder plus the two versions the cache is keyed on, so a
// test can change either and watch what the loader does with the file already
// on "disk".
const mocked = vi.hoisted(() => ({
    fileMap: new Map<string, string>(),
    appVersion: '1.0.0',
    lookupDataVersion: { namesMap: 46, locationsMap: 48 } as {
        namesMap: number;
        locationsMap: number;
    } | null,
    isReportingDataVersion: true,
    buildCount: 0,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        appInfo: {
            get version() {
                return mocked.appVersion;
            },
        },
        messageUtils: { sendData: vi.fn() },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => mocked.fileMap.has(filePath),
    fsCreateDir: async () => undefined,
    fsReadFile: async (filePath: string) =>
        mocked.fileMap.get(filePath) ?? null,
    fsWriteFile: async (filePath: string, text: string) => {
        mocked.fileMap.set(filePath, text);
        return filePath;
    },
    pathJoin: (...paths: string[]) => paths.join('/'),
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorage: '/data' },
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => any) => await callback(),
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getLangDataAsync: async () => ({
        langCode: 'en',
        getLookupDataVersion: mocked.isReportingDataVersion
            ? async () => mocked.lookupDataVersion
            : undefined,
    }),
}));
vi.mock('./verseTextIndexBuilder', async () => {
    const { LOOKUP_TEXT_INDEX_VERSION } = (await vi.importActual(
        './verseTextIndexTypes',
    )) as { LOOKUP_TEXT_INDEX_VERSION: number };
    return {
        buildLookupTextIndex: async () => {
            mocked.buildCount += 1;
            // The label carries the dataset version so a stale cache is
            // recognizable by what it hands back, not only by the build count.
            const label = `label-${mocked.lookupDataVersion?.namesMap ?? 'none'}`;
            return {
                index: {
                    version: LOOKUP_TEXT_INDEX_VERSION,
                    ids: ['id-1'],
                    names: { [label]: [0] },
                    locations: {},
                    verseNames: {},
                    verseLocations: {},
                },
                recordLabels: {
                    version: LOOKUP_TEXT_INDEX_VERSION,
                    labels: [label],
                    types: ['person'],
                    titles: ['a title'],
                },
            };
        },
    };
});

// The data version is memoized for the session, so every case needs its own
// module instance.
async function importFresh() {
    vi.resetModules();
    return await import('./lookupIndexFileHelpers');
}

describe('lookup derived file cache invalidation', () => {
    beforeEach(() => {
        mocked.fileMap.clear();
        mocked.appVersion = '1.0.0';
        mocked.lookupDataVersion = { namesMap: 46, locationsMap: 48 };
        mocked.isReportingDataVersion = true;
        mocked.buildCount = 0;
    });

    test('builds once and reuses the cache while nothing changed', async () => {
        const first = await importFresh();
        expect(
            (await first.loadLookupRecordLabelsFile())?.labels,
        ).toStrictEqual(['label-46']);
        expect(mocked.buildCount).toBe(1);
        // Both derived files come out of the ONE build.
        expect(mocked.fileMap.size).toBe(2);

        const second = await importFresh();
        expect(
            (await second.loadLookupRecordLabelsFile())?.labels,
        ).toStrictEqual(['label-46']);
        expect(mocked.buildCount).toBe(1);
    });

    test('stamps the dataset version onto what it writes', async () => {
        const { loadLookupTextIndexFile } = await importFresh();
        await loadLookupTextIndexFile();
        const written = JSON.parse(
            mocked.fileMap.get('/data/lookup-data/verse-text-index.json') ?? '',
        );
        expect(written._dataVersion).toBe('46-48');
        expect(written._appVersion).toBe('1.0.0');
    });

    test('rebuilds when the dataset version changed under the same app', async () => {
        const first = await importFresh();
        await first.loadLookupRecordLabelsFile();
        expect(mocked.buildCount).toBe(1);

        mocked.lookupDataVersion = { namesMap: 47, locationsMap: 48 };
        const second = await importFresh();
        expect(
            (await second.loadLookupRecordLabelsFile())?.labels,
        ).toStrictEqual(['label-47']);
        expect(mocked.buildCount).toBe(2);
    });

    test('rebuilds when only a map other than names changed', async () => {
        const first = await importFresh();
        await first.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(1);

        mocked.lookupDataVersion = { namesMap: 46, locationsMap: 49 };
        const second = await importFresh();
        await second.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(2);
    });

    test('still rebuilds when the app version changed', async () => {
        const first = await importFresh();
        await first.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(1);

        mocked.appVersion = '1.0.1';
        const second = await importFresh();
        await second.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(2);
    });

    test('a package that reports no version keeps reusing its cache', async () => {
        mocked.isReportingDataVersion = false;
        const first = await importFresh();
        await first.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(1);
        expect(
            JSON.parse(
                mocked.fileMap.get('/data/lookup-data/verse-text-index.json') ??
                    '',
            )._dataVersion,
        ).toBe('');

        // The point of the empty token: an unanswerable version must not mean a
        // ~34MB rebuild on every launch.
        const second = await importFresh();
        await second.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(1);
    });

    test('a failed version read is treated as unknown, not as a mismatch', async () => {
        mocked.lookupDataVersion = null;
        const first = await importFresh();
        await first.loadLookupTextIndexFile();
        const second = await importFresh();
        await second.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(1);
    });
});
