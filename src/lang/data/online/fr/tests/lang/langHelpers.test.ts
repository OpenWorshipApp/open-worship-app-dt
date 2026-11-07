// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

// `langHelpers` against the REAL French package. Moved here from
// `src/lang/langHelpers.packages.test.ts`, which keeps the cases every package
// shares. Its own app-side imports are mocked here, in this file only.
const h = vi.hoisted(() => {
    return {
        locale: 'fr-FR',
        isDev: true,
        sendData: vi.fn(),
        listenForData: vi.fn(),
        removeListener: vi.fn(),
        openExternalURL: vi.fn(),
        handleError: vi.fn(),
        cache: new Map<string, unknown>(),
        readers: [] as { path: string; isClosed: boolean }[],
        asyncState: undefined as unknown,
        asyncCalls: [] as { callee: () => unknown; deps: unknown[] }[],
    };
});

vi.mock('../../../../../../server/appProvider', () => ({
    default: {
        systemUtils: {
            get isDev() {
                return h.isDev;
            },
        },
        messageUtils: {
            sendData: (...args: unknown[]) => h.sendData(...args),
            listenForData: (...args: unknown[]) => h.listenForData(...args),
            removeListener: (...args: unknown[]) => h.removeListener(...args),
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
    },
}));
vi.mock('../../../../../../helper/SettingManager', () => ({
    default: class {
        getSetting() {
            return h.locale;
        }
        setSetting(value: string) {
            h.locale = value;
        }
    },
}));
vi.mock('../../../../../../helper/appHooks', () => ({
    useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
        h.asyncCalls.push({ callee, deps });
        return [h.asyncState];
    },
}));
vi.mock('../../../../../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, run: () => Promise<unknown>) => run(),
}));
vi.mock('../../../../../../others/CacheManager', () => ({
    globalCacheManager10Seconds: {
        get: async (key: string) => h.cache.get(key),
        set: async (key: string, value: unknown) => {
            h.cache.set(key, value);
        },
    },
}));
vi.mock('../../../../../../server/fontHelpers', () => ({
    getFontFamilies: async () => [],
}));
vi.mock('../../../../../../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));
vi.mock('../../../../../BibleCrossRefBundleReader', () => ({
    BibleCrossRefBundleReader: class {
        record: { path: string; isClosed: boolean };
        constructor(path: string) {
            this.record = { path, isClosed: false };
            h.readers.push(this.record);
        }
        close() {
            this.record.isClosed = true;
        }
        getVerse(bookKey: string, chapter: number, verse: number) {
            return [`${this.record.path}#${bookKey} ${chapter}:${verse}`];
        }
    },
}));
vi.mock('../../../../../gzBundleFilePath', () => ({
    resolveGzBundleFilePath: (bundle: { filePath: string }) => {
        return bundle.filePath;
    },
}));

import { getLangData, getLangDataAsync } from '../../../../../langHelpers';

describe('the language package cache', () => {
    test('caches another locale of a language under the locale asked for', async () => {
        const french = await getLangDataAsync('fr-CA');
        expect(french?.locale).toBe('fr-FR');
        expect(getLangData('fr-CA')).toBe(french);
        expect(getLangData('fr-FR')).toBe(french);
    });
});
