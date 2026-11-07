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
        defaultStorageDirPath: '/data',
        localStorageDir: '/data/local-storage',
        getItem: () => null,
        setItem: vi.fn(),
    },
}));

import { readTranValue, tranByLangData } from './langHelpers';
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

// A language package's words, in a made-up language: what is read is which
// dictionary, never what it says.
const otherLangData = genLangData('xx', {
    people: '[xx] people',
    person: '[xx] people',
    'all types': '[xx] every kind',
});

describe('translating into a named language', () => {
    test('reads the named language, not the interface locale', () => {
        expect(tranByLangData(otherLangData, 'People')).toBe('[xx] people');
        expect(tranByLangData(otherLangData, 'All types')).toBe(
            '[xx] every kind',
        );
    });

    test('matches keys the way the package sanitizes them', () => {
        expect(tranByLangData(otherLangData, '  people ')).toBe('[xx] people');
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
        expect(tranByLangData(otherLangData, 'Deities')).toBe('Deities');
    });
});

// What every lookup counts as translated: the dictionary's own key. A
// plugin's dictionary that answers a missing key by itself (a Proxy handing
// the key back), or a key that only reaches the object's prototype, is not.
describe('readTranValue', () => {
    test('reads what the dictionary holds, by the key the package makes', () => {
        expect(readTranValue(otherLangData, ' People ')).toBe('[xx] people');
    });

    test('a fallback the dictionary makes up is not a translation', () => {
        const proxied = genLangData(
            'xx',
            new Proxy({ people: '[xx] people' } as { [key: string]: string }, {
                get(target, key) {
                    if (typeof key !== 'string') {
                        return undefined;
                    }
                    return Object.hasOwn(target, key) ? target[key] : key;
                },
            }),
        );
        expect(readTranValue(proxied, 'People')).toBe('[xx] people');
        expect(readTranValue(proxied, 'Deities')).toBeUndefined();
        expect(tranByLangData(proxied, 'Deities')).toBe('Deities');
    });

    test('nor is what only the prototype has', () => {
        expect(readTranValue(otherLangData, 'constructor')).toBeUndefined();
        expect(readTranValue(otherLangData, 'toString')).toBeUndefined();
    });
});
