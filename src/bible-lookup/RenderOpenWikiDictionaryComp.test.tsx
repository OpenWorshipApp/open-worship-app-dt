// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    // The real map's shape: the retired `in` / `iw` beside `id` / `he`.
    const localeMap: { [key: string]: string } = {
        'en-US': 'en',
        'he-IL': 'he',
        'id-ID': 'id',
        'in-ID': 'in',
        'iw-IL': 'iw',
        'km-KH': 'km',
    };
    return {
        localeMap,
        reversedLocalesMap: Object.fromEntries(
            Object.entries(localeMap).map(([locale, code]) => [code, locale]),
        ),
        showAppContextMenuMock: vi.fn(),
        openExternalURLMock: vi.fn(),
        getBibleLocaleMock: vi.fn(async (): Promise<string> => 'km-KH'),
    };
});

vi.mock('../server/appProvider', () => ({
    default: { browserUtils: { openExternalURL: h.openExternalURLMock } },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    reversedLocalesMap: h.reversedLocalesMap,
    getLangCode: (locale: string) => h.localeMap[locale] ?? null,
    getLangData: () => null,
    getLanguageTitle: ({ langCode }: { langCode: string }) => {
        return `Language ${langCode}`;
    },
    tran: (text: string) => text,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenuMock,
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: '---',
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    useBibleKeyContext: () => 'TB',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: h.getBibleLocaleMock,
}));

import RenderOpenWikiDictionaryComp from './RenderOpenWikiDictionaryComp';

let container: HTMLDivElement;
let root: Root;

async function openMenuUrls() {
    await act(async () => {
        root.render(<RenderOpenWikiDictionaryComp />);
    });
    await act(async () => {
        container.querySelector('button')!.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const items: any[] = h.showAppContextMenuMock.mock.calls[0][1];
    return items
        .map((item) => item.title)
        .filter((title) => typeof title === 'string');
}

describe('RenderOpenWikiDictionaryComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    // Indonesian and Hebrew were each listed twice: under their codes and
    // under the ones ISO 639 retired, which no Wiktionary edition uses.
    test('lists each language once, under its current code', async () => {
        const urls = await openMenuUrls();

        expect(urls).toEqual([
            'https://km.wiktionary.org',
            'https://he.wiktionary.org',
            'https://id.wiktionary.org',
        ]);
    });

    test("a Bible written with a retired code opens its language's edition", async () => {
        h.getBibleLocaleMock.mockResolvedValueOnce('in-ID');

        const urls = await openMenuUrls();

        expect(urls[0]).toBe('https://id.wiktionary.org');
        expect(urls.filter((url) => url.includes('id.'))).toHaveLength(1);
        expect(urls.some((url) => /\/\/(in|iw)\./.test(url))).toBe(false);
    });
});
