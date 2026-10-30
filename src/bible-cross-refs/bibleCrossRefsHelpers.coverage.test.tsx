// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    responses: new Map<string, string | Error>(),
    requests: [] as string[],
    bibleLocales: new Map<string, string>(),
    localCrossRefs: new Map<string, unknown>(),
    localRequests: [] as unknown[][],
    langCodes: new Map<string, string | null>(),
    logs: [] as unknown[][],
    errors: [] as unknown[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        // The real hook, minus its dev-only bookkeeping: run the effect with
        // the methods it was handed whenever a dependency changes.
        useAppEffectAsync: (
            effect: (methods: object) => Promise<void>,
            deps: unknown[],
            methods: object,
        ) => {
            useEffect(() => {
                void effect({ ...methods });
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});
vi.mock('../_owa-crypto', () => ({
    decrypt: (text: string) => text,
    bible_ref: (text: string) => JSON.stringify({ text }),
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.errors.push(error),
}));
vi.mock('../helper/networkHelpers', () => ({
    appApiFetch: async (path: string) => {
        h.requests.push(path);
        const response = h.responses.get(path);
        if (response === undefined || response instanceof Error) {
            throw response ?? new Error('404');
        }
        return { text: async () => response };
    },
}));
vi.mock('../others/CacheManager', () => ({
    globalCacheManager10Seconds: {
        get: async () => null,
        set: async () => {},
    },
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { parseKJVBibleVersesKey: () => null },
}));
vi.mock('../bible-list/BibleItem', () => ({ default: { fromJson: vi.fn() } }));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) => {
        return callback();
    },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    supportedLocales: ['en-US', 'km-KH'],
    getLangCode: (locale: string) => h.langCodes.get(locale) ?? null,
    getLocalBibleCrossRef: async (locale: string, target: unknown) => {
        h.localRequests.push([locale, target]);
        return h.localCrossRefs.get(locale) ?? null;
    },
}));
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    validateCrossReference: (data: unknown) => ({
        valid: Array.isArray(data),
    }),
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({ bookKeysOrder: ['GEN'] }),
}));
vi.mock('../helper/loggerHelpers', () => ({
    appLog: (...args: unknown[]) => h.logs.push(args),
    appError: vi.fn(),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: async (bibleKey: string) => {
        return h.bibleLocales.get(bibleKey) ?? 'en-US';
    },
}));

import { useGettingBibleCrossRefAI } from './bibleCrossRefsHelpers';

type HookResultType = ReturnType<typeof useGettingBibleCrossRefAI>;

let host: HTMLDivElement;
let root: Root;
let latest: HookResultType;
const seen: unknown[] = [];

function ProbeComp({
    bibleKey,
    verse = 1,
}: Readonly<{ bibleKey: string; verse?: number }>) {
    latest = useGettingBibleCrossRefAI('anthropic', bibleKey, 'GEN', 1, verse);
    seen.push(latest.bibleCrossRef);
    return null;
}

const THEMES = [{ title: 'Creation', titleEn: 'Creation', verses: [] }];

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.responses.clear();
    h.requests.length = 0;
    h.bibleLocales.clear();
    h.localCrossRefs.clear();
    h.localRequests.length = 0;
    h.langCodes = new Map([
        ['en-US', 'en'],
        ['km-KH', 'km'],
    ]);
    h.logs.length = 0;
    h.errors.length = 0;
    seen.length = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(bibleKey: string, verse = 1) {
    await act(async () => {
        root.render(<ProbeComp bibleKey={bibleKey} verse={verse} />);
    });
    // Each await in the fetch chain is a microtask; let them all land.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe('useGettingBibleCrossRefAI', () => {
    test('loading, then the bundled references of the bible language', async () => {
        h.bibleLocales.set('KHM', 'km-KH');
        h.localCrossRefs.set('km-KH', THEMES);
        await render('KHM');
        expect(seen[0]).toBeUndefined();
        expect(latest.bibleCrossRef).toBe(THEMES);
        expect(h.localRequests).toEqual([
            ['km-KH', { bookKey: 'GEN', chapter: 1, verse: 1 }],
        ]);
        // Bundled data costs no download.
        expect(h.requests).toEqual([]);
    });

    test('a language the app does not speak reads the default bundle', async () => {
        h.bibleLocales.set('ZZZ', 'xx-XX');
        h.localCrossRefs.set('en-US', THEMES);
        await render('ZZZ');
        expect(h.localRequests[0][0]).toBe('en-US');
        expect(latest.bibleCrossRef).toBe(THEMES);
    });

    test('with no bundle, the references are fetched in the bible language', async () => {
        h.bibleLocales.set('KHM', 'km-KH');
        h.responses.set(
            'bcr/anthropic/km/GEN/1/1.json',
            JSON.stringify(THEMES),
        );
        await render('KHM');
        expect(h.requests).toEqual(['bcr/anthropic/km/GEN/1/1.json']);
        expect(latest.bibleCrossRef).toEqual(THEMES);
        expect(h.logs[0]).toEqual([
            'No local cross ref found for, fetching online',
            { locale: 'km-KH', bookKey: 'GEN', chapter: 1, verseNum: 1 },
        ]);
    });

    test('references missing in the bible language fall back to English', async () => {
        h.bibleLocales.set('KHM', 'km-KH');
        h.responses.set(
            'bcr/anthropic/en/GEN/1/1.json',
            JSON.stringify(THEMES),
        );
        await render('KHM');
        expect(h.requests).toEqual([
            'bcr/anthropic/km/GEN/1/1.json',
            'bcr/anthropic/en/GEN/1/1.json',
        ]);
        expect(latest.bibleCrossRef).toEqual(THEMES);
    });

    test('English that is missing too is not asked for twice', async () => {
        await render('KJV');
        expect(h.requests).toEqual(['bcr/anthropic/en/GEN/1/1.json']);
        expect(latest.bibleCrossRef).toBeNull();
    });

    test('a locale with no language code asks in English once', async () => {
        h.langCodes.delete('km-KH');
        h.bibleLocales.set('KHM', 'km-KH');
        await render('KHM');
        expect(h.requests).toEqual(['bcr/anthropic/en/GEN/1/1.json']);
        expect(latest.bibleCrossRef).toBeNull();
    });

    test('another verse loads its own references', async () => {
        h.localCrossRefs.set('en-US', THEMES);
        await render('KJV', 1);
        await render('KJV', 2);
        expect(h.localRequests.map(([, target]) => target)).toEqual([
            { bookKey: 'GEN', chapter: 1, verse: 1 },
            { bookKey: 'GEN', chapter: 1, verse: 2 },
        ]);
    });

    test('refresh shows loading again, then fetches anew', async () => {
        h.localCrossRefs.set('en-US', THEMES);
        await render('KJV');
        expect(latest.bibleCrossRef).toBe(THEMES);
        const fresh = [{ title: 'Light', titleEn: 'Light', verses: [] }];
        h.localCrossRefs.set('en-US', fresh);
        await act(async () => {
            latest.refresh();
        });
        expect(seen).toContain(undefined);
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(latest.bibleCrossRef).toBe(fresh);
        expect(h.localRequests).toHaveLength(2);
    });
});
