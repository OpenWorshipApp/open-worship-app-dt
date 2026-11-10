// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

const bases = new Map<number, any>();

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isWindows: false } },
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: vi.fn(async () => [
            'screen-bg-manager',
            'api-key',
            // A copy an older version left in the data folder.
            'language-locale',
        ]),
        getItem: vi.fn((key: string) => `value:${key}`),
    },
}));
vi.mock('../lang/langHelpers', () => ({
    LOCALE_SETTING_NAME: 'language-locale',
    getCurrentLocale: () => 'xx-XX',
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getScreenManagerBase: (screenId: number) => bases.get(screenId) ?? null,
}));

import { getMirrorBootstrap } from './screenBootstrapHelpers';

describe('getMirrorBootstrap', () => {
    test("carries the screen's state and that of every screen it shows", async () => {
        const ownMessages = [
            { screenId: 0, type: 'background', data: { src: 'red' } },
        ];
        const payload = {
            sourceScreenId: 2,
            width: 1600,
            height: 1000,
            stage: 1,
            isSnapshot: true,
            messages: [],
        };
        bases.set(2, { genScreenShowPayload: () => payload });
        const manager = {
            screenId: 0,
            stage: 3,
            genSyncSnapshotMessages: () => ownMessages,
            screenForegroundManager: {
                // Itself (a colour-note group's copy), a source, and a screen
                // that no longer exists.
                foregroundData: {
                    screenDataList: [{ id: 0 }, { id: 2 }, { id: 9 }],
                },
            },
        };

        const context = await getMirrorBootstrap(manager as any);

        expect(context.screenId).toBe(0);
        expect(context.stage).toBe(3);
        // Only what a screen draws with, never anything else -- and the
        // language this computer uses, not the data folder's stale copy.
        expect(context.settings).toEqual({
            'screen-bg-manager': 'value:screen-bg-manager',
            'language-locale': 'xx-XX',
        });
        expect(context.messages).toEqual([
            { screenId: 0, type: 'screen-show', data: payload },
            ...ownMessages,
        ]);
    });
});

const plainManager = {
    screenId: 1,
    stage: 0,
    genSyncSnapshotMessages: () => [],
    screenForegroundManager: { foregroundData: { screenDataList: [] } },
};

describe('getMirrorBootstrap, what else crosses', () => {
    const styles: HTMLStyleElement[] = [];
    function addStyle(cssText: string) {
        const style = document.createElement('style');
        style.textContent = cssText;
        document.head.appendChild(style);
        styles.push(style);
        return style.sheet!;
    }
    afterEach(() => {
        for (const style of styles.splice(0)) {
            style.remove();
        }
        vi.unstubAllGlobals();
    });

    test("carries the page's font faces with absolute addresses, past a sheet it may not read", async () => {
        const fontSheet = addStyle(
            "@font-face {font-family: MadeUp; src: url(fonts/made-up.woff2), url('/fonts/made-up.ttf');} body {color: red;}",
        );
        // jsdom keeps its font-face rule class to itself; the browser's is a
        // global.
        vi.stubGlobal('CSSFontFaceRule', fontSheet.cssRules[0].constructor);
        // A stylesheet from another origin: reading its rules throws.
        const foreignSheet = addStyle('@font-face {font-family: Foreign;}');
        Object.defineProperty(foreignSheet, 'cssRules', {
            get() {
                throw new DOMException('Not allowed', 'SecurityError');
            },
        });
        // The order of the sheets on the page is kept.
        addStyle('@font-face {font-family: Late; src: url("late.woff");}');

        const context = await getMirrorBootstrap(plainManager as any);

        const base = location.href;
        expect(context.fontCss).toBe(
            [
                `@font-face {font-family: MadeUp; src: url("${new URL('fonts/made-up.woff2', base).href}"), url("${new URL('/fonts/made-up.ttf', base).href}");}`,
                `@font-face {font-family: Late; src: url("${new URL('late.woff', base).href}");}`,
            ].join('\n'),
        );
        expect(context.fontCss).not.toContain('Foreign');
        expect(context.fontCss).not.toContain('color: red');
    });

    test('carries no settings value that is missing or too big to send', async () => {
        const { appLocalStorage } =
            await import('../setting/directory-setting/appLocalStorage');
        vi.mocked(appLocalStorage.listKeys).mockResolvedValueOnce([
            'screen-small',
            'screen-missing',
            'screen-huge',
            'page-base-color',
            'pdf-full-width',
            'pdf-full-width-extra',
        ]);
        vi.mocked(appLocalStorage.getItem).mockImplementation((key: string) => {
            if (key === 'screen-missing') {
                return null;
            }
            if (key === 'screen-huge') {
                return 'x'.repeat(256000);
            }
            return `value:${key}`;
        });

        const context = await getMirrorBootstrap(plainManager as any);

        expect(context.settings).toEqual({
            'screen-small': 'value:screen-small',
            'page-base-color': 'value:page-base-color',
            'pdf-full-width': 'value:pdf-full-width',
            'language-locale': 'xx-XX',
        });
        expect(context.fontCss).toBe('');
        expect(context.resources).toEqual({});
        expect(context.remote).toBe(false);
        expect(context.isWindows).toBe(false);
        expect(context.messages).toEqual([]);
    });
});
