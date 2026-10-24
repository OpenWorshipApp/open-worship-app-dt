import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    responses: new Map<string, string | Error>(),
    cached: new Map<string, unknown>(),
    requests: [] as string[],
    errors: [] as unknown[],
    logs: [] as string[],
    items: [] as Record<string, unknown>[],
    bibleText: 'In the beginning' as string,
    referenceValid: true,
    bookKey: 'GEN',
    chapterEnd: undefined as number | undefined,
    verseEnd: 3,
    toTextArgs: [] as unknown[][],
    // What the strict parser makes of a key the data spells wrongly.
    isUnparsable: false,
    parsedKeys: [] as string[],
}));

vi.mock('../_owa-crypto', () => ({
    decrypt: (text: string) => text,
    bible_ref: (text: string) => JSON.stringify({ text }),
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.errors.push(error),
}));
vi.mock('../helper/appHooks', () => ({ useAppEffectAsync: vi.fn() }));
vi.mock('../helper/networkHelpers', () => ({
    appApiFetch: async (path: string) => {
        h.requests.push(path);
        const response = h.responses.get(path);
        if (response instanceof Error) throw response;
        return { text: async () => response ?? '' };
    },
}));
vi.mock('../others/CacheManager', () => ({
    globalCacheManager10Seconds: {
        get: async (key: string) => h.cached.get(key) ?? null,
        set: async (key: string, value: unknown) => {
            h.cached.set(key, value);
        },
    },
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        parseKJVBibleVersesKey: (key: string) => {
            h.parsedKeys.push(key);
            if (h.isUnparsable) {
                return null;
            }
            return {
                bookKey: h.bookKey,
                chapter: 1,
                verseStart: 2,
                verseEnd: h.verseEnd,
                ...(h.chapterEnd === undefined
                    ? {}
                    : { chapterEnd: h.chapterEnd }),
            };
        },
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromJson: (data: Record<string, unknown>) => {
            h.items.push(data);
            return {
                toTitle: async () => 'Genesis 1:2-3',
                toText: async (...args: unknown[]) => {
                    h.toTextArgs.push(args);
                    return h.bibleText;
                },
            };
        },
    },
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) =>
        callback(),
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    getLangCode: () => 'en',
    getLocalBibleCrossRef: async () => null,
    supportedLocales: ['en-US'],
}));
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    validateCrossReference: () => ({ valid: h.referenceValid }),
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({ bookKeysOrder: ['GEN', 'EXO'] }),
}));
vi.mock('../helper/loggerHelpers', () => ({
    appLog: vi.fn(),
    appError: (message: string) => h.logs.push(message),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: async () => 'en-US',
}));

import {
    breakItem,
    fromBibleCrossRefText,
    getBibleCrossRef,
    getBibleCrossRefAI,
} from './bibleCrossRefsHelpers';

beforeEach(() => {
    h.responses.clear();
    h.cached.clear();
    h.requests.length = 0;
    h.errors.length = 0;
    h.logs.length = 0;
    h.items.length = 0;
    h.bibleText = 'In the beginning';
    h.referenceValid = true;
    h.bookKey = 'GEN';
    h.chapterEnd = undefined;
    h.verseEnd = 3;
    h.toTextArgs.length = 0;
    h.isUnparsable = false;
    h.parsedKeys.length = 0;
});

describe('Bible cross-reference downloads', () => {
    test('uses the cache unless a refresh is requested', async () => {
        const cached = [[{ text: 'GEN 1:1', isS: false }]];
        h.cached.set('bible-refs/KJV', cached);
        expect(await getBibleCrossRef('KJV')).toBe(cached);
        expect(h.requests).toEqual([]);

        h.responses.set('bible-refs/KJV', JSON.stringify([['S GEN 1:1 *']]));
        const refreshed = await getBibleCrossRef('KJV', true);
        expect(refreshed).toEqual([
            [
                {
                    text: 'GEN 1:1',
                    isS: true,
                    isFN: false,
                    isStar: true,
                    isTitle: false,
                    isLXXDSS: false,
                },
            ],
        ]);
        expect(h.cached.get('bible-refs/KJV')).toEqual(refreshed);
        expect(h.requests).toEqual(['bible-refs/KJV']);
    });

    test('returns null for unavailable or malformed reference data', async () => {
        h.responses.set('bible-refs/KJV', new Error('offline'));
        expect(await getBibleCrossRef('KJV')).toBeNull();
        expect(h.errors).toHaveLength(1);
        h.responses.set('bible-refs/KJV', '{invalid');
        expect(await getBibleCrossRef('KJV')).toBeNull();
        expect(h.logs).toContain('Error parsing JSON: for key');
        h.responses.set('bible-refs/KJV', JSON.stringify({ invalid: true }));
        expect(await getBibleCrossRef('KJV')).toBeNull();
        expect(h.cached.size).toBe(0);
    });

    test('validates AI references and handles bad responses', async () => {
        const params = {
            aiType: 'related',
            langCode: 'en',
            bookKey: 'GEN',
            chapter: 1,
            verse: 2,
        };
        const path = 'bcr/related/en/GEN/1/2.json';
        h.responses.set(path, JSON.stringify([{ verse: 'GEN 1:3' }]));
        expect(await getBibleCrossRefAI(params)).toEqual([
            { verse: 'GEN 1:3' },
        ]);
        h.referenceValid = false;
        expect(await getBibleCrossRefAI(params)).toBeNull();
        h.responses.set(path, '{bad');
        expect(await getBibleCrossRefAI(params)).toBeNull();
        h.responses.set(path, new Error('offline'));
        expect(await getBibleCrossRefAI(params)).toBeNull();
        expect(h.requests).toEqual([path, path, path, path]);
        expect(h.errors).toHaveLength(2);
    });
});

describe('reference display', () => {
    test('extracts all reference markers without changing the verse', () => {
        expect(
            fromBibleCrossRefText("S Title GEN 1:1 'fn' * (LXX and DSS)"),
        ).toEqual({
            text: 'GEN 1:1',
            isS: true,
            isFN: true,
            isStar: true,
            isTitle: true,
            isLXXDSS: true,
        });
        expect(fromBibleCrossRefText('EXO 2:4')).toEqual({
            text: 'EXO 2:4',
            isS: false,
            isFN: false,
            isStar: false,
            isTitle: false,
            isLXXDSS: false,
        });
    });

    test('shows a short verse in full and trims long previews at a word', async () => {
        expect(await breakItem('KJV', 'GEN 1:2-3')).toMatchObject({
            htmlText: 'In the beginning',
            bibleText: 'In the beginning',
        });
        expect(h.items[0]).toMatchObject({
            bibleKey: 'KJV',
            target: { bookKey: 'GEN', chapter: 1, verseStart: 2, verseEnd: 3 },
        });
        h.bibleText = `${'word '.repeat(32)}last word`;
        const long = await breakItem('KJV', 'GEN 1:2-3');
        expect(long?.htmlText.endsWith('…')).toBe(true);
        expect(long?.htmlText.length).toBeLessThan(h.bibleText.length);
        expect(long?.bibleText).toBe(h.bibleText);
        h.bookKey = 'UNKNOWN';
        expect(await breakItem('KJV', 'UNKNOWN 1:2-3')).toBeNull();
    });

    // RD-51: `PSA 119:ющ` is in every shipped bundle. Read leniently it was a
    // row titled `Psalm 119:` opening "Record not found".
    test('builds nothing for a reference that names no passage', async () => {
        h.isUnparsable = true;
        expect(await breakItem('KJV', 'PSA 119:ющ')).toBeNull();
        expect(h.parsedKeys).toEqual(['PSA 119:ющ']);
        expect(h.items).toEqual([]);
        expect(h.toTextArgs).toEqual([]);
    });

    test('keeps the end chapter of a cross-chapter reference and reads one chapter', async () => {
        h.chapterEnd = 3;
        h.verseEnd = 4;
        expect(await breakItem('KJV', 'GEN 1:2-3:4')).not.toBeNull();
        expect(h.items[0].target).toEqual({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 4,
            chapterEnd: 3,
        });
        // A preview of ~150 characters never reads chapters 2 and 3.
        expect(h.toTextArgs).toEqual([[1]]);
    });

    test('writes no end chapter for a one-chapter reference', async () => {
        h.chapterEnd = 1;
        await breakItem('KJV', 'GEN 1:2-3');
        expect(h.items[0].target).toEqual({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 3,
        });
    });
});
