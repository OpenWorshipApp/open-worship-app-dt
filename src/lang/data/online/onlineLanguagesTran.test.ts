// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

// An online language through the REAL `tran()`: it reads the language's own
// dictionary, and a key the dictionary lacks THROWS in dev (2026-11-04, the
// user: _all keys are translated, fail on dev for non traslated_) -- there is
// no English fallback in `onlineLangPackage.ts` to hide one -- and shows the
// English in a packaged window. Each language stands in for an installed
// plugin; with none left, nothing here runs.

const h = vi.hoisted(() => ({
    locale: 'en-US',
    isDev: true,
    pluginList: [] as { langCode: string; locale: string; isEnabled: true }[],
    loadLangData: null as null | ((langCode: string) => Promise<unknown>),
}));

vi.mock('../../../server/appProvider', () => ({
    default: {
        systemUtils: {
            get isDev() {
                return h.isDev;
            },
        },
        messageUtils: {
            sendData: vi.fn(),
            listenForData: vi.fn(),
            removeListener: vi.fn(),
        },
    },
}));
vi.mock('../../../helper/SettingManager', () => ({
    default: class {
        getSetting() {
            return h.locale;
        }
        setSetting(value: string) {
            h.locale = value;
        }
    },
}));
vi.mock('../../../helper/appHooks', () => ({
    useAppStateAsync: () => [undefined],
    useAppEffect: vi.fn(),
}));
vi.mock('../../langPluginRegistry', () => ({
    ensureLangPlugins: async () => h.pluginList,
    getLoadedLangPlugins: () => h.pluginList,
    getEnabledLangPlugins: () => h.pluginList,
    loadLangPluginData: async (langCode: string) => {
        return h.loadLangData?.(langCode) ?? null;
    },
    setLangPluginsPrepare: vi.fn(),
}));

import { getLangDataAsync, tran, type LocaleType } from '../../langHelpers';
import { loadSourceLangData } from '../../langSourceFiles';

type MetaType = { locale: string };

const META_MAP = import.meta.glob<MetaType>('./*/meta.json', {
    eager: true,
    import: 'default',
});
// Every language, a folder with a `dictionary.json` (`README.md`).
const DICTIONARY_PATH_LIST = Object.keys(
    import.meta.glob('./*/dictionary.json'),
);
const langCodes = DICTIONARY_PATH_LIST.map((filePath) => {
    return filePath.split('/')[1];
}).sort();

h.pluginList = langCodes.map((langCode) => {
    return {
        langCode,
        locale: META_MAP[`./${langCode}/meta.json`].locale,
        isEnabled: true,
    };
});
// The package as its plugin would hand it over: the folder's data through
// the one factory (`langSourceFiles.vitest.ts`).
h.loadLangData = loadSourceLangData;

const MISSING_KEY = 'A label no dictionary has';

beforeEach(() => {
    h.isDev = true;
    h.locale = 'en-US';
});

describe.each(langCodes)('tran() in the online language "%s"', (langCode) => {
    const locale = META_MAP[`./${langCode}/meta.json`].locale as LocaleType;

    test('reads its dictionary and fails in dev on a key it lacks', async () => {
        const langData = await getLangDataAsync(locale);
        expect(langData?.langCode).toBe(langCode);
        h.locale = locale;
        const saveLabel =
            langData!.dictionary[langData!.sanitizeTranKey('Save')];
        expect(saveLabel).toBeTruthy();
        expect(tran('Save')).toBe(saveLabel);
        expect(() => tran(MISSING_KEY)).toThrow(
            `Translation for text "${MISSING_KEY}" not found in locale ${locale}.`,
        );
        h.isDev = false;
        expect(tran(MISSING_KEY)).toBe(MISSING_KEY);
    });
});

// A plugin's dictionary is the plugin's own object, and Hebrew 0.0.2 shipped
// one that answered every key it lacked with the key itself: its windows
// showed English and dev never threw (2026-11-04, the user: _non-translated
// should fail the app (on dev), only prod allow english fallback_). What
// counts as translated is what the dictionary HOLDS (`readTranValue`).
test.runIf(langCodes.length > 0)(
    'a dictionary that answers a missing key with English still fails in dev',
    async () => {
        const locale = META_MAP[`./${langCodes[0]}/meta.json`]
            .locale as LocaleType;
        const langData = (await getLangDataAsync(locale))!;
        const { dictionary } = langData;
        langData.dictionary = new Proxy(dictionary, {
            get(target, key) {
                if (typeof key !== 'string') {
                    return undefined;
                }
                return Object.hasOwn(target, key) ? target[key] : key;
            },
        });
        try {
            h.locale = locale;
            expect(tran('Save')).toBe(
                dictionary[langData.sanitizeTranKey('Save')],
            );
            expect(() => tran(MISSING_KEY)).toThrow(
                `Translation for text "${MISSING_KEY}" not found in locale ${locale}.`,
            );
            // Padded, the text goes through the trimmed lookup too.
            expect(() => tran(` ${MISSING_KEY} `)).toThrow('not found');
            h.isDev = false;
            expect(tran(MISSING_KEY)).toBe(MISSING_KEY);
        } finally {
            langData.dictionary = dictionary;
        }
    },
);

test('the online languages are found, so a green run means something', () => {
    expect(Array.isArray(langCodes)).toBe(true);
});
