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
    selectedLangCode: 'en',
    // Which language each build was asked to write the labels sidecar in.
    builtLabelsLangCodes: [] as string[],
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
    fsDeleteFile: async (filePath: string) => {
        mocked.fileMap.delete(filePath);
    },
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
    DEFAULT_LANG_CODE: 'en',
    getLangDataByCodeAsync: async (langCode: string) => ({
        langCode,
        getLookupDataVersion: mocked.isReportingDataVersion
            ? async () => mocked.lookupDataVersion
            : undefined,
    }),
}));
vi.mock('./lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => mocked.selectedLangCode,
    subscribeLookupLangCode: () => () => undefined,
}));
vi.mock('./verseTextIndexBuilder', async () => {
    const { LOOKUP_TEXT_INDEX_VERSION } = (await vi.importActual(
        './verseTextIndexTypes',
    )) as { LOOKUP_TEXT_INDEX_VERSION: number };
    return {
        buildLookupTextIndex: async (labelsLangCode: string) => {
            mocked.buildCount += 1;
            mocked.builtLabelsLangCodes.push(labelsLangCode);
            // The label carries the dataset version AND the language it was
            // written in, so a stale cache is recognizable by what it hands
            // back, not only by the build count.
            const label =
                `label-${labelsLangCode}-` +
                `${mocked.lookupDataVersion?.namesMap ?? 'none'}`;
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
        mocked.selectedLangCode = 'en';
        mocked.builtLabelsLangCodes = [];
    });

    test('builds once and reuses the cache while nothing changed', async () => {
        const first = await importFresh();
        expect(
            (await first.loadLookupRecordLabelsFile())?.labels,
        ).toStrictEqual(['label-en-46']);
        expect(mocked.buildCount).toBe(1);
        // Both derived files come out of the ONE build.
        expect(mocked.fileMap.size).toBe(2);

        const second = await importFresh();
        expect(
            (await second.loadLookupRecordLabelsFile())?.labels,
        ).toStrictEqual(['label-en-46']);
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
        ).toStrictEqual(['label-en-47']);
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

describe('the labels sidecar per lookup language', () => {
    beforeEach(() => {
        mocked.fileMap.clear();
        mocked.appVersion = '1.0.0';
        mocked.lookupDataVersion = { namesMap: 46, locationsMap: 48 };
        mocked.isReportingDataVersion = true;
        mocked.buildCount = 0;
        mocked.selectedLangCode = 'en';
        mocked.builtLabelsLangCodes = [];
    });

    // Nothing reads the pre-rename sidecar any more, and it is a quarter of a
    // megabyte in a data folder on machines that are usually tight on disk.
    test('sweeps away the sidecar written before the rename', async () => {
        mocked.fileMap.set(
            '/data/lookup-data/verse-record-labels.json',
            'stale',
        );
        const { loadLookupTextIndexFile } = await importFresh();

        await loadLookupTextIndexFile();

        expect(
            mocked.fileMap.has('/data/lookup-data/verse-record-labels.json'),
        ).toBe(false);
    });

    test('writes one sidecar per language beside the single index', async () => {
        const first = await importFresh();
        await first.loadLookupRecordLabelsFile();

        mocked.selectedLangCode = 'km';
        const second = await importFresh();
        expect(
            (await second.loadLookupRecordLabelsFile())?.labels,
        ).toStrictEqual(['label-km-46']);

        expect(mocked.builtLabelsLangCodes).toStrictEqual(['en', 'km']);
        expect([...mocked.fileMap.keys()].sort()).toStrictEqual([
            '/data/lookup-data/verse-record-labels-en.json',
            '/data/lookup-data/verse-record-labels-km.json',
            '/data/lookup-data/verse-text-index.json',
        ]);
    });

    // The English sidecar must survive a switch away and back, or every change
    // of mind costs another full dataset read.
    test('reuses a sidecar already written for a language', async () => {
        const first = await importFresh();
        await first.loadLookupRecordLabelsFile();
        mocked.selectedLangCode = 'km';
        const second = await importFresh();
        await second.loadLookupRecordLabelsFile();
        expect(mocked.buildCount).toBe(2);

        mocked.selectedLangCode = 'en';
        const third = await importFresh();
        expect(
            (await third.loadLookupRecordLabelsFile())?.labels,
        ).toStrictEqual(['label-en-46']);
        expect(mocked.buildCount).toBe(2);
    });

    // The index is English by construction — it matches KJV wording — so a
    // language the user reads records in must not invalidate it.
    test('a language change does not rebuild the index that is already valid', async () => {
        const first = await importFresh();
        await first.loadLookupTextIndexFile();
        expect(mocked.buildCount).toBe(1);

        mocked.selectedLangCode = 'km';
        const second = await importFresh();
        await second.loadLookupTextIndexFile();

        expect(mocked.buildCount).toBe(1);
    });
});
