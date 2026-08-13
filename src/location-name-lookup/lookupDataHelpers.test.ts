import { beforeEach, describe, expect, test, vi } from 'vitest';

// The real loader fetches ~34MB of JSON and dynamically imports `bible-note`.
// What is under test is the reference counting around it, so the load itself is
// a counter — the whole point is how MANY times it runs.
const h = vi.hoisted(() => ({
    loadCount: 0,
    langDataList: [] as any[],
    fromRawDatasetCount: 0,
}));

// `CacheManager` and `loggerHelpers` both read `appProvider` at module scope,
// and the real one touches `document` — which a node-env test has none of.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        isPagePresenter: false,
        isPageAppDocumentEditor: false,
        isPageReader: false,
        isPageExperiment: false,
        currentHomePage: 'test',
        systemUtils: { isDev: false },
        messageUtils: { sendData: vi.fn() },
    },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getAllLangsAsync: async () => {
        h.loadCount += 1;
        return h.langDataList;
    },
}));
vi.mock('bible-note', () => {
    class FakeManager {
        static fromRawDataset() {
            h.fromRawDatasetCount += 1;
            return new FakeManager();
        }
    }
    return {
        NamesLookupManager: FakeManager,
        LocationsLookupManager: FakeManager,
    };
});

import {
    acquireLookupData,
    releaseLookupData,
    getLookupDataCached,
} from './lookupDataHelpers';
import { globalCacheManager1M } from '../others/CacheManager';

function genEnglishLangData() {
    return {
        langCode: 'en',
        getLookupData: async () => ({ namesMap: {}, locationsMap: {} }),
    };
}

beforeEach(async () => {
    h.loadCount = 0;
    h.fromRawDatasetCount = 0;
    h.langDataList = [genEnglishLangData()];
    // Both the 60s cache and the holder are module-level.
    globalCacheManager1M.clear();
    releaseLookupData();
    releaseLookupData();
    releaseLookupData();
});

describe('loading the dataset', () => {
    test('refuses to build managers without the English dataset', async () => {
        h.langDataList = [
            { langCode: 'km', getLookupData: async () => null },
            // No `getLookupData` at all — skipped, not treated as a failure.
            { langCode: 'xx' },
        ];
        globalCacheManager1M.clear();

        await expect(getLookupDataCached()).rejects.toThrow(
            'Failed to load English lookup data',
        );
    });

    test('serializes concurrent first-opens into one load', async () => {
        const [first, second] = await Promise.all([
            getLookupDataCached(),
            getLookupDataCached(),
        ]);

        expect(h.loadCount).toBe(1);
        expect(first).toBe(second);
    });
});

describe('the shared reference', () => {
    // The regression this exists for: the lookup panel and the detail widgets
    // are separate React trees and each used to ask for the dataset on its own.
    // Past the 60s cache window that meant a SECOND ~34MB fetch and
    // re-materialization while the first copy was still held.
    test('two holders share one instance even with the cache gone', async () => {
        const forPanel = await acquireLookupData();
        globalCacheManager1M.clear();
        const forDetails = await acquireLookupData();

        expect(forDetails).toBe(forPanel);
        expect(h.loadCount).toBe(1);
        expect(h.fromRawDatasetCount).toBe(2); // names + locations, once each.

        releaseLookupData();
        releaseLookupData();
    });

    test('a holder joining mid-load waits for the same instance', async () => {
        const [first, second] = await Promise.all([
            acquireLookupData(),
            acquireLookupData(),
        ]);

        expect(first).toBe(second);
        expect(h.loadCount).toBe(1);

        releaseLookupData();
        releaseLookupData();
    });

    // Nothing may outlive the UI that needs it: ~34MB held after the last
    // widget closed is exactly the memory bloat this app cannot afford.
    test('drops the instance once the last holder leaves', async () => {
        await acquireLookupData();
        releaseLookupData();
        globalCacheManager1M.clear();

        await acquireLookupData();

        expect(h.loadCount).toBe(2);
        releaseLookupData();
    });

    test('one holder leaving does not drop it for the other', async () => {
        const forPanel = await acquireLookupData();
        await acquireLookupData();
        releaseLookupData();
        globalCacheManager1M.clear();

        const forNextDetail = await acquireLookupData();

        expect(forNextDetail).toBe(forPanel);
        expect(h.loadCount).toBe(1);

        releaseLookupData();
        releaseLookupData();
    });

    test('an unbalanced release cannot drive the count negative', async () => {
        releaseLookupData();
        releaseLookupData();

        const first = await acquireLookupData();
        // With a negative count this second acquire would see count <= 0 and
        // refuse to hold, reloading for every consumer from then on.
        globalCacheManager1M.clear();
        const second = await acquireLookupData();

        expect(second).toBe(first);
        releaseLookupData();
        releaseLookupData();
    });

    test('a failed load is not cached as a holder', async () => {
        h.langDataList = [];
        globalCacheManager1M.clear();

        await expect(acquireLookupData()).rejects.toThrow();
        releaseLookupData();

        // The next open gets a real attempt rather than the rejected promise.
        h.langDataList = [genEnglishLangData()];
        await expect(acquireLookupData()).resolves.toBeDefined();
        releaseLookupData();
    });
});
