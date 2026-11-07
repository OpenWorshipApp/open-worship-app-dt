// @vitest-environment jsdom

/**
 * `useGettingBibleCrossRefAI` through a probe component on the REAL app hooks:
 * the bundled cross references first, the online ones when the bundle has
 * none, the English set when the bible's own language has none, and a refresh
 * that clears the list before it refetches.
 */

import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const realSetImmediate = globalThis.setImmediate.bind(globalThis);

const h = vi.hoisted(() => ({
    responses: new Map<string, string | Error>(),
    requests: [] as string[],
    lastRefresh: null as null | (() => void),
    handleError: vi.fn(),
    appLog: vi.fn(),
    appError: vi.fn(),
    getBibleLocale: vi.fn(),
    getLocalBibleCrossRef: vi.fn(),
    getLangCode: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../_owa-crypto', () => ({
    decrypt: (text: string) => text,
    bible_ref: (text: string) => JSON.stringify({ text }),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../helper/loggerHelpers', () => ({
    appLog: h.appLog,
    appError: h.appError,
    appWarning: () => {},
}));
vi.mock('../helper/networkHelpers', () => ({
    appApiFetch: async (path: string) => {
        h.requests.push(path);
        const response = h.responses.get(path);
        if (response instanceof Error) {
            throw response;
        }
        return { text: async () => response ?? 'null' };
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
vi.mock('../bible-list/BibleItem', () => ({
    default: { fromJson: (json: unknown) => json },
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, work: () => Promise<unknown>) => work(),
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    ensureLangPlugins: async () => [],
    getSupportedLocales: () => ['en-US', 'km-KH', 'fr-FR'],
    getLangCode: h.getLangCode,
    getLocalBibleCrossRef: h.getLocalBibleCrossRef,
}));
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    validateCrossReference: (data: unknown) => ({
        valid: Array.isArray(data),
    }),
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({ bookKeysOrder: ['GEN', 'JHN'] }),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: h.getBibleLocale,
}));

import { useGettingBibleCrossRefAI } from './bibleCrossRefsHelpers';

const creation = [{ title: 'Creation', verses: ['JHN 1:1'] }];
const light = [{ title: 'Light', verses: ['JHN 8:12', 'GEN 1:3'] }];

function ProbeComp({ bibleKey }: Readonly<{ bibleKey: string }>) {
    const { bibleCrossRef, refresh } = useGettingBibleCrossRefAI(
        'anthropic',
        bibleKey,
        'GEN',
        1,
        3,
    );
    h.lastRefresh = refresh;
    return (
        <div className="probe">
            {bibleCrossRef === undefined
                ? 'undefined'
                : JSON.stringify(bibleCrossRef)}
        </div>
    );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function flush(times = 4) {
    for (let i = 0; i < times; i++) {
        await act(async () => {
            await new Promise((resolve) => {
                realSetImmediate(resolve);
            });
        });
    }
}

async function renderProbe(bibleKey: string) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<ProbeComp bibleKey={bibleKey} />);
    });
    await flush();
    return container.querySelector('.probe')!;
}

beforeEach(() => {
    h.responses = new Map();
    h.requests = [];
    h.lastRefresh = null;
    h.getBibleLocale.mockResolvedValue('en-US');
    h.getLocalBibleCrossRef.mockResolvedValue(null);
    h.getLangCode.mockImplementation((locale: string) => {
        return locale.split('-')[0];
    });
});

afterEach(async () => {
    if (root !== null) {
        const oldRoot = root;
        root = null;
        await act(async () => {
            oldRoot.unmount();
        });
    }
    container?.remove();
    container = null;
});

describe('useGettingBibleCrossRefAI', () => {
    it('answers from the bundled set without going online', async () => {
        h.getLocalBibleCrossRef.mockResolvedValue(creation);
        const probe = await renderProbe('KJV');
        expect(probe.textContent).toBe(JSON.stringify(creation));
        expect(h.getBibleLocale).toHaveBeenCalledWith('KJV');
        expect(h.getLocalBibleCrossRef).toHaveBeenCalledWith('en-US', {
            bookKey: 'GEN',
            chapter: 1,
            verse: 3,
        });
        expect(h.requests).toEqual([]);
        expect(h.appLog).not.toHaveBeenCalled();
    });

    it('reads a bible in an unsupported locale as the default locale', async () => {
        h.getBibleLocale.mockResolvedValue('ja-JP');
        h.getLocalBibleCrossRef.mockResolvedValue(creation);
        await renderProbe('JPN');
        expect(h.getLocalBibleCrossRef).toHaveBeenCalledWith(
            'en-US',
            expect.anything(),
        );
    });

    it("fetches the bible's own language online when nothing is bundled", async () => {
        h.getBibleLocale.mockResolvedValue('km-KH');
        h.responses.set('bcr/anthropic/km/GEN/1/3.json', JSON.stringify(light));
        const probe = await renderProbe('KHM');
        expect(probe.textContent).toBe(JSON.stringify(light));
        expect(h.requests).toEqual(['bcr/anthropic/km/GEN/1/3.json']);
        expect(h.appLog).toHaveBeenCalledWith(
            'No local cross ref found for, fetching online',
            { locale: 'km-KH', bookKey: 'GEN', chapter: 1, verseNum: 3 },
        );
    });

    it('falls back to the English set when its own language has none', async () => {
        h.getBibleLocale.mockResolvedValue('fr-FR');
        h.responses.set('bcr/anthropic/fr/GEN/1/3.json', 'not json');
        h.responses.set(
            'bcr/anthropic/en/GEN/1/3.json',
            JSON.stringify(creation),
        );
        const probe = await renderProbe('LSG');
        expect(h.requests).toEqual([
            'bcr/anthropic/fr/GEN/1/3.json',
            'bcr/anthropic/en/GEN/1/3.json',
        ]);
        expect(h.handleError).toHaveBeenCalledTimes(1);
        expect(probe.textContent).toBe(JSON.stringify(creation));
    });

    it('asks once, in English, when the locale names no language', async () => {
        h.getLangCode.mockReturnValue(null);
        const probe = await renderProbe('KJV');
        expect(h.requests).toEqual(['bcr/anthropic/en/GEN/1/3.json']);
        expect(probe.textContent).toBe('null');
    });

    it('clears the list on refresh and shows what the refetch brings', async () => {
        h.getLocalBibleCrossRef.mockResolvedValueOnce(creation);
        const probe = await renderProbe('KJV');
        expect(probe.textContent).toBe(JSON.stringify(creation));
        let release: (value: unknown) => void = () => {};
        h.getLocalBibleCrossRef.mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            }),
        );
        await act(async () => {
            h.lastRefresh!();
        });
        expect(probe.textContent).toBe('undefined');
        release(light);
        await flush();
        expect(probe.textContent).toBe(JSON.stringify(light));
        expect(h.getLocalBibleCrossRef).toHaveBeenCalledTimes(2);
    });
});
