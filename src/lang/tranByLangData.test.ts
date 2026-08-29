// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

// `langHelpers` reads `appProvider` at module scope and that touches `document`;
// jsdom above covers it, and this keeps the electron surface out of the way.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        isPageReader: false,
        // `isDev: true` on purpose: `tran` THROWS on a missing key in dev, and
        // the whole point below is that this function does not.
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
        defaultStorage: '/data',
        localStorageDir: '/data/local-storage',
        getItem: () => null,
        setItem: vi.fn(),
    },
}));

import { tranByLangData } from './langHelpers';
import type { LanguageDataType } from './langHelpers';

// Dictionaries are stored under sanitized keys, exactly as a real package
// exposes them.
function genLangData(
    langCode: string,
    dictionary: { [key: string]: string },
): LanguageDataType {
    return {
        langCode,
        dictionary,
        sanitizeTranKey: (key: string) => key.trim().toLowerCase(),
    } as unknown as LanguageDataType;
}

const khmerLangData = genLangData('km', {
    people: 'មនុស្ស',
    person: 'មនុស្ស',
    'all types': 'គ្រប់ប្រភេទ',
});

describe('translating into a named language', () => {
    test('reads the named language, not the interface locale', () => {
        expect(tranByLangData(khmerLangData, 'People')).toBe('មនុស្ស');
        expect(tranByLangData(khmerLangData, 'All types')).toBe('គ្រប់ប្រភេទ');
    });

    test('matches keys the way the package sanitizes them', () => {
        expect(tranByLangData(khmerLangData, '  people ')).toBe('មនុស្ស');
    });

    // English IS the key language, so a package that carries no dictionary for
    // it must not be treated as a failed lookup.
    test('hands English straight back', () => {
        expect(tranByLangData(genLangData('en', {}), 'People')).toBe('People');
    });

    // Until the language module resolves, the caller renders the English label
    // rather than nothing at all.
    test('falls back while the package is still loading', () => {
        expect(tranByLangData(null, 'People')).toBe('People');
        expect(tranByLangData(undefined, 'People')).toBe('People');
    });

    // Unlike `tran`, which throws in dev: the interface locale is guaranteed to
    // translate every string the app renders, but a language picked for its
    // DATA is not, and blanking the lookup panel over one missing category label
    // would be a far worse outcome than showing it in English.
    test('degrades to English on a missing key even in dev', () => {
        expect(tranByLangData(khmerLangData, 'Deities')).toBe('Deities');
    });
});
