// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

// `langHelpers` against INSTALLED language plugins this file makes up
// (codes `xx`, `yy`, `zz`, `ww`, ASCII data): a plugin that says it is
// written right to left, one that fails to load, the stored language
// prepared before a window takes a new list, a plugin dictionary that
// translates a padded label but not its words, and a plugin with no
// cross-reference bundle. The plugin registry is this file's own fake.
const h = vi.hoisted(() => {
    return {
        locale: 'en-US',
        isDev: true,
        pluginList: null as LangPluginType[] | null,
        // What `loadLangPluginData` answers, by code; a function may throw.
        dataMap: {} as Record<string, unknown>,
        prepare: null as null | ((list: LangPluginType[]) => Promise<void>),
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            get isDev() {
                return h.isDev;
            },
        },
        messageUtils: {
            sendData: () => {},
            listenForData: () => {},
            removeListener: () => {},
        },
        browserUtils: { openExternalURL: () => {} },
    },
}));
vi.mock('../helper/SettingManager', () => ({
    default: class {
        getSetting() {
            return h.locale;
        }
        setSetting(value: string) {
            h.locale = value;
        }
    },
}));
vi.mock('../helper/appHooks', () => ({
    useAppStateAsync: () => [undefined],
    useAppEffect: () => {},
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, run: () => Promise<unknown>) => run(),
}));
vi.mock('../others/CacheManager', () => ({
    globalCacheManager10Seconds: {
        get: async () => undefined,
        set: async () => {},
    },
}));
vi.mock('../server/fontHelpers', () => ({ getFontFamilies: async () => [] }));
vi.mock('./BibleCrossRefBundleReader', () => ({
    BibleCrossRefBundleReader: class {
        getVerse() {
            return ['should not be read'];
        }
    },
}));
vi.mock('./gzBundleFilePath', () => ({
    resolveGzBundleFilePath: () => '/bundles/x.gz',
}));
vi.mock('./langPluginRegistry', () => ({
    ensureLangPlugins: async () => h.pluginList ?? [],
    getLoadedLangPlugins: () => h.pluginList,
    getEnabledLangPlugins: () => {
        return (h.pluginList ?? []).filter((plugin) => plugin.isEnabled);
    },
    loadLangPluginData: async (langCode: string) => {
        const data = h.dataMap[langCode];
        return typeof data === 'function' ? data() : (data ?? null);
    },
    // A plain function, not a mock: the call is made once, at module load.
    setLangPluginsPrepare: (
        listener: (list: LangPluginType[]) => Promise<void>,
    ) => {
        h.prepare = listener;
    },
}));

import {
    checkIsRtl,
    getLangData,
    getLangDataAsync,
    getLangDataByCodeAsync,
    getLocalBibleCrossRef,
    tran,
    type LocaleType,
} from './langHelpers';

function genPlugin(
    langCode: string,
    extra: Partial<LangPluginType> = {},
): LangPluginType {
    return {
        apiVersion: 1,
        langCode,
        locale: `${langCode}-${langCode.toUpperCase()}`,
        name: `Name ${langCode}`,
        nativeName: `Native ${langCode}`,
        version: '1.0.0',
        description: '',
        isEnabled: true,
        isBuiltIn: false,
        isRemovable: true,
        builtInVersion: null,
        dirPath: `/data/lang/${langCode}@1.0.0`,
        removableDirPaths: [],
        inlineFiles: {},
        ...extra,
    };
}

// A plugin's `LanguageDataType`, with only what these paths read.
function genLangData(langCode: string, extra: Record<string, unknown> = {}) {
    return {
        langCode,
        locale: `${langCode}-${langCode.toUpperCase()}`,
        dictionary: {},
        sanitizeTranKey: (key: string) => key,
        genCss: () => '',
        getBibleCrossRefBundleFilePath: () => null,
        ...extra,
    };
}

const PLUGIN_LIST = [
    genPlugin('xx', { direction: 'rtl' } as Partial<LangPluginType>),
    genPlugin('yy'),
    genPlugin('zz'),
    genPlugin('ww'),
];

beforeEach(() => {
    h.locale = 'en-US';
    h.isDev = true;
    h.pluginList = PLUGIN_LIST;
    h.dataMap = {};
});

describe('an installed language plugin', () => {
    test('is right to left when its own manifest says so, and only then', () => {
        expect(checkIsRtl('xx-XX' as LocaleType)).toBe(true);
        expect(checkIsRtl('yy-YY' as LocaleType)).toBe(false);
    });

    test('one that fails to load is a language that is not there, never a blank page', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const failure = new Error('broken index.js');
        h.dataMap.yy = () => {
            throw failure;
        };

        expect(await getLangDataByCodeAsync('yy')).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to load the "yy" language:',
            failure,
        );
        expect(getLangData('yy')).toBeNull();
    });

    test('a plugin with no cross-reference bundle answers none (the caller reads English’s)', async () => {
        h.dataMap.ww = genLangData('ww');

        expect(
            await getLocalBibleCrossRef('ww-WW' as LocaleType, {
                bookKey: 'GEN',
                chapter: 1,
                verse: 1,
            }),
        ).toBeNull();
    });
});

describe('the stored language, prepared before a window takes a new list', () => {
    test('a plugin that gives no data leaves it unloaded; one that does is ready under its locale', async () => {
        expect(h.prepare).not.toBeNull();

        h.locale = 'zz-ZZ';
        h.dataMap.zz = null;
        await h.prepare!(PLUGIN_LIST);
        expect(getLangData('zz-ZZ')).toBeNull();
        expect(getLangData('zz')).toBeNull();

        const data = genLangData('zz');
        h.dataMap.zz = data;
        await h.prepare!(PLUGIN_LIST);
        expect(getLangData('zz-ZZ')).toBe(data);
        expect(getLangData('zz')).toBe(data);
    });
});

describe('tran with a plugin dictionary', () => {
    // The real factory trims every key, so a padded label found means its
    // words are found; a plugin's own `sanitizeTranKey` may not, and then
    // the words of a padded label can be missing.
    test('a padded label whose words are missing throws in dev and reads as English otherwise', async () => {
        const data = genLangData('xx', {
            dictionary: { ' Save ': 'S', Open: 'O' },
        });
        h.dataMap.xx = data;
        expect(await getLangDataAsync('xx-XX' as LocaleType)).toBe(data);
        h.locale = 'xx-XX';

        expect(tran('Open')).toBe('O');
        expect(() => tran(' Save ')).toThrow(
            'Translation for text "Save" not found in locale xx-XX.',
        );
        h.isDev = false;
        expect(tran(' Save ')).toBe(' Save ');
    });
});
