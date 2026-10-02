// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

// `langHelpers` reads `appProvider` at module scope and that touches `document`;
// jsdom above covers it, and this keeps the electron surface out of the way.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        isPageReader: false,
        systemUtils: { isDev: true },
        messageUtils: { sendData: vi.fn(), listenForData: vi.fn() },
        appInfo: { version: '1.0.0' },
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        fileUtils: { watch: vi.fn() },
    },
}));
// Pulled in transitively by `settingHelpers`; nothing here reads a setting.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        defaultStorageDirPath: '/data',
        localStorageDir: '/data/local-storage',
        getItem: () => null,
        setItem: vi.fn(),
    },
}));

import { getLanguageTitle, type LocaleType } from './langHelpers';

describe('getLanguageTitle', () => {
    test('a language in the table keeps its own name', () => {
        expect(getLanguageTitle({ locale: 'fr-FR' }, true)).toBe(
            'French (Français) <fr-FR>',
        );
    });

    // The version menu headed the Aramaic bibles `Unknown <arc>`: the table
    // knows two-letter codes only.
    test('a three-letter code the table lacks is named by the platform', () => {
        expect(getLanguageTitle({ locale: 'arc' as LocaleType }, true)).toBe(
            'Aramaic <arc>',
        );
    });

    test('a code nobody knows is still Unknown', () => {
        expect(getLanguageTitle({ locale: 'qqq' as LocaleType }, true)).toBe(
            'Unknown <qqq>',
        );
        expect(getLanguageTitle({ langCode: 'not a tag' })).toBe('Unknown');
    });
});
