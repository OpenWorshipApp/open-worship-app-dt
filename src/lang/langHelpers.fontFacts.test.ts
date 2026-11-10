// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

// EN-59: a window that only DRAWS the installed languages -- every screen at
// boot, a song previewer, a font list -- registers their fonts from the
// plugin list's `langFacts.json` and loads no plugin. Made-up plugins `xx`,
// `yy` and `zz` (ASCII data); the registry and the provider are this file's
// own fakes, and the one loader they share counts every load.
const h = vi.hoisted(() => {
    return {
        pluginList: [] as LangPluginType[],
        loadCodeList: [] as string[],
        dataMap: {} as Record<string, unknown>,
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: true },
        messageUtils: {
            sendData: () => {},
            listenForData: () => {},
            removeListener: () => {},
        },
        browserUtils: { openExternalURL: () => {} },
        langUtils: {
            getLangAssetBaseUrl: (langCode: string) => {
                return `owa://local/@lang/${langCode}/`;
            },
        },
    },
}));
vi.mock('../helper/SettingManager', () => ({
    default: class {
        getSetting() {
            return 'en-US';
        }
        setSetting() {}
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
vi.mock('./langPluginRegistry', () => ({
    ensureLangPlugins: async () => h.pluginList,
    getLoadedLangPlugins: () => h.pluginList,
    getEnabledLangPlugins: () => {
        return h.pluginList.filter((plugin) => plugin.isEnabled);
    },
    loadLangPluginData: async (langCode: string) => {
        h.loadCodeList.push(langCode);
        return h.dataMap[langCode] ?? null;
    },
    setLangPluginsPrepare: () => {},
}));

import {
    getLangDataByCodeAsync,
    initAllLangCss,
    initLangCss,
} from './langHelpers';

const FONTS = {
    uiFamily: 'app-Xx',
    family: 'Xx Sans',
    faces: [{ file: 'fonts/Xx-Regular.ttf', weight: 'normal' }],
};

function genPlugin(
    langCode: string,
    inlineFiles: Record<string, unknown>,
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
        inlineFiles,
    };
}

// A plugin's whole `LanguageDataType`, as far as these paths read it.
function genLangData(langCode: string, css: string) {
    return {
        langCode,
        locale: `${langCode}-${langCode.toUpperCase()}`,
        name: `Name ${langCode}`,
        dictionary: { loaded: 'yes' },
        sanitizeTranKey: (key: string) => key,
        genCss: () => css,
    };
}

function readStyle(langCode: string) {
    return document.querySelector(`style#lang-${langCode}`)?.textContent;
}

beforeEach(() => {
    document.head.innerHTML = '';
    h.loadCodeList = [];
    h.dataMap = {
        xx: genLangData('xx', '/* xx whole */'),
        yy: genLangData('yy', '/* yy whole */'),
        zz: genLangData('zz', '/* zz whole */'),
    };
});

describe('initAllLangCss', () => {
    test("registers each language's fonts from its facts, and loads no plugin", async () => {
        h.pluginList = [
            genPlugin('xx', {
                'langFacts.json': {
                    fonts: FONTS,
                    fontFiles: {
                        'fonts/Xx-Regular.ttf': 'assets/Xx-Regular-a1.ttf',
                    },
                },
            }),
            genPlugin('yy', { 'langFacts.json': { fonts: null } }),
        ];
        const list = await initAllLangCss();
        expect(h.loadCodeList).toEqual([]);
        expect(readStyle('xx')).toContain(
            'url(owa://local/@lang/xx/assets/Xx-Regular-a1.ttf)',
        );
        expect(readStyle('yy')).toBe('');
        const xx = list.find((langData) => {
            return langData.langCode === 'xx';
        });
        expect(xx?.fontFamily).toBe('app-Xx');
        expect(xx).not.toHaveProperty('dictionary');
    });

    test('a plugin built before the facts file is loaded, as it always was', async () => {
        h.pluginList = [
            genPlugin('xx', { 'langFacts.json': { fonts: null } }),
            genPlugin('zz', {}),
        ];
        await initAllLangCss();
        expect(h.loadCodeList).toEqual(['zz']);
        expect(readStyle('zz')).toBe('/* zz whole */');
    });

    test('a language this window already loaded for real is used as it is', async () => {
        h.pluginList = [genPlugin('yy', { 'langFacts.json': { fonts: null } })];
        await getLangDataByCodeAsync('yy');
        expect(h.loadCodeList).toEqual(['yy']);
        const list = await initAllLangCss();
        expect(h.loadCodeList).toEqual(['yy']);
        expect(
            list.find((langData) => {
                return langData.langCode === 'yy';
            }),
        ).toHaveProperty('dictionary');
    });
});

describe('initLangCss', () => {
    test('takes only what it writes: the code and the CSS', () => {
        initLangCss({ langCode: 'xx', genCss: () => '/* only */' });
        expect(readStyle('xx')).toBe('/* only */');
    });
});
