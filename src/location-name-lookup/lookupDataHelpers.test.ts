import { beforeEach, describe, expect, test, vi } from 'vitest';

// The real loader fetches ~34MB of JSON and dynamically imports `bible-note`.
// What is under test is the reference counting around it, so the load itself is
// a counter — the whole point is how MANY times it runs.
const h = vi.hoisted(() => ({
    loadCount: 0,
    langDataMap: {} as { [langCode: string]: any },
    fromRawDatasetCount: 0,
    selectedLangCode: 'en',
    langCodeListeners: new Set<() => void>(),
    // What `fromRawDataset` was handed, so a test can assert that ONLY the
    // selected language's data ever reaches it, and with which style.
    lastDataMapKeys: [] as string[],
    lastStyle: undefined as any,
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
    getLangDataByCodeAsync: async (langCode: string) => {
        h.loadCount += 1;
        return h.langDataMap[langCode] ?? null;
    },
}));
// The real one reads a setting file; the selection itself is covered by
// `lookupLangHelpers.test.ts`. `selectLangCode` below plays the part of
// `setSelectedLookupLangCode`.
vi.mock('./lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => h.selectedLangCode,
    subscribeLookupLangCode: (listener: () => void) => {
        h.langCodeListeners.add(listener);
        return () => {
            h.langCodeListeners.delete(listener);
        };
    },
}));
vi.mock('bible-note', () => {
    class FakeManager {
        static fromRawDataset(
            rawDataMap: { [langCode: string]: unknown },
            _defaultLang: string,
            style?: any,
        ) {
            h.fromRawDatasetCount += 1;
            h.lastDataMapKeys = Object.keys(rawDataMap);
            h.lastStyle = style;
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
import { globalCacheManager10Seconds } from '../others/CacheManager';

function genLangData(langCode: string, fontFamily?: string) {
    return {
        langCode,
        fontFamily,
        packageDir: `/lang/${langCode}`,
        getLookupData: async () => ({ namesMap: {}, locationsMap: {} }),
    };
}

function selectLangCode(langCode: string) {
    h.selectedLangCode = langCode;
    for (const listener of h.langCodeListeners) {
        listener();
    }
}

beforeEach(async () => {
    h.loadCount = 0;
    h.fromRawDatasetCount = 0;
    h.lastDataMapKeys = [];
    h.lastStyle = undefined;
    h.selectedLangCode = 'en';
    h.langDataMap = {
        en: genLangData('en'),
        km: genLangData('km', 'app-Battambang'),
    };
    // Both the 60s cache and the holder are module-level.
    globalCacheManager10Seconds.clear();
    releaseLookupData();
    releaseLookupData();
    releaseLookupData();
});

describe('loading the dataset', () => {
    test('refuses to build managers without the selected dataset', async () => {
        h.langDataMap = {
            en: { langCode: 'en', getLookupData: async () => null },
        };
        globalCacheManager10Seconds.clear();

        await expect(getLookupDataCached()).rejects.toThrow(
            'Failed to load lookup data for language code: en',
        );
    });

    test('a package carrying no lookup data at all fails the same way', async () => {
        h.langDataMap = { en: { langCode: 'en' } };
        globalCacheManager10Seconds.clear();

        await expect(getLookupDataCached()).rejects.toThrow(
            'Failed to load lookup data for language code: en',
        );
    });

    // `fromRawDataset` normalizes EVERY language it is handed, eagerly, so
    // handing it every shipped package meant reading ~70MB to serve one.
    test('hands the managers only the selected language', async () => {
        selectLangCode('km');

        await getLookupDataCached();

        expect(h.lastDataMapKeys).toStrictEqual(['km']);
    });

    // The managers carry the style into `bible-note`'s OWN surfaces — the
    // mention popup, the hover card, the advanced panel — which otherwise
    // render Khmer records in the editor's Latin font.
    test('gives the managers the language package font', async () => {
        selectLangCode('km');

        await getLookupDataCached();

        expect(h.lastStyle).toStrictEqual({ fontFamily: 'app-Battambang' });
    });

    // English names no font, and then the records must keep the app's own
    // rather than being forced into one.
    test('gives no style for a package naming no font', async () => {
        await getLookupDataCached();

        expect(h.lastStyle).toBeUndefined();
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
        globalCacheManager10Seconds.clear();
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
        globalCacheManager10Seconds.clear();

        await acquireLookupData();

        expect(h.loadCount).toBe(2);
        releaseLookupData();
    });

    test('one holder leaving does not drop it for the other', async () => {
        const forPanel = await acquireLookupData();
        await acquireLookupData();
        releaseLookupData();
        globalCacheManager10Seconds.clear();

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
        globalCacheManager10Seconds.clear();
        const second = await acquireLookupData();

        expect(second).toBe(first);
        releaseLookupData();
        releaseLookupData();
    });

    test('a failed load is not cached as a holder', async () => {
        h.langDataMap = {};
        globalCacheManager10Seconds.clear();

        await expect(acquireLookupData()).rejects.toThrow();
        releaseLookupData();

        // The next open gets a real attempt rather than the rejected promise.
        h.langDataMap = { en: genLangData('en') };
        await expect(acquireLookupData()).resolves.toBeDefined();
        releaseLookupData();
    });
});

describe('changing the lookup language', () => {
    // The held copy is ~34MB of the language the user just switched away from.
    // Serving it on would leave every lookup surface in the previous language.
    test('drops the held instance and reloads in the new language', async () => {
        const forEnglish = await acquireLookupData();
        expect(h.lastDataMapKeys).toStrictEqual(['en']);

        selectLangCode('km');
        const forKhmer = await acquireLookupData();

        expect(forKhmer).not.toBe(forEnglish);
        expect(h.lastDataMapKeys).toStrictEqual(['km']);

        releaseLookupData();
        releaseLookupData();
    });

    // The short cache sits behind the holder, so leaving it alone would keep the
    // previous language's copy resident exactly while the new one is built.
    test('evicts the previous language from the short cache too', async () => {
        await acquireLookupData();
        releaseLookupData();

        selectLangCode('km');
        h.loadCount = 0;

        // Nothing is mounted at this point, so nothing will ever ask again —
        // the English copy has to have been dropped by the CHANGE itself.
        await acquireLookupData();
        expect(h.lastDataMapKeys).toStrictEqual(['km']);
        releaseLookupData();

        selectLangCode('en');
        h.loadCount = 0;
        await acquireLookupData();

        expect(h.loadCount).toBe(1);
        releaseLookupData();
    });

    test('a load already in flight cannot install itself afterwards', async () => {
        // Warms `bible-note` into the module registry first: two dynamic
        // imports of it racing is a vitest mock-resolution hazard, not
        // something this test is about.
        await acquireLookupData();
        releaseLookupData();

        const pendingEnglish = acquireLookupData();
        selectLangCode('km');
        const pendingKhmer = acquireLookupData();
        await Promise.all([pendingEnglish, pendingKhmer]);

        // Whatever the superseded English load did on landing, a holder joining
        // now must still get the language that is actually selected.
        const forKhmer = await acquireLookupData();

        expect(forKhmer).toBe(await pendingKhmer);
        releaseLookupData();
        releaseLookupData();
        releaseLookupData();
    });
});
