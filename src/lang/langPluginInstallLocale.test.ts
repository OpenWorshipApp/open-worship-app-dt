// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

// The stored language is missing at boot, so the window reads as English and
// loads English alone; then it is installed (Settings > Languages, in this
// window or another) and every window reads the list again. On 2026-11-05 the
// window took the new list first: `getCurrentLocale` named the language, its
// data was not loaded, and `tran` threw in dev -- in every open window, the
// error handler's own label included. Through the REAL `langHelpers` and
// registry; only the provider and the stored setting stand in.

const h = vi.hoisted(() => ({
    locale: 'en-US',
    plugins: [] as LangPluginType[],
    getLangData: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: true },
        langUtils: {
            getLangPlugins: async () => h.plugins,
            getLangData: h.getLangData,
            readLangPluginJson: async () => null,
        },
        messageUtils: {
            sendData: vi.fn(),
            listenForData: vi.fn(),
            removeListener: vi.fn(),
        },
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
    useAppEffect: vi.fn(),
}));

import {
    allLocalesMap,
    ensureLangPlugins,
    getCurrentLocale,
    getLangData,
    tran,
    type LanguageDataType,
} from './langHelpers';
import { reloadLangPlugins } from './langPluginRegistry';

// Any language the world table knows: which one is not the point.
const [otherLocale, otherLangCode] = Object.entries(allLocalesMap).find(
    ([, langCode]) => {
        return langCode !== 'en';
    },
)!;

function genPlugin(isEnabled: boolean): LangPluginType {
    return {
        apiVersion: 1,
        langCode: otherLangCode,
        locale: otherLocale,
        name: otherLangCode,
        nativeName: otherLangCode,
        version: '1.0.0',
        description: '',
        isEnabled,
        isBuiltIn: false,
        isRemovable: true,
        builtInVersion: null,
        dirPath: `/lang/${otherLangCode}`,
        removableDirPaths: [],
        inlineFiles: {},
    } as LangPluginType;
}

const otherLangData = {
    langCode: otherLangCode,
    locale: otherLocale,
    dictionary: { save: '[other] Save' },
    sanitizeTranKey: (key: string) => key.trim().toLowerCase(),
    genCss: () => '',
} as unknown as LanguageDataType;

beforeEach(() => {
    h.locale = otherLocale;
    h.plugins = [];
    h.getLangData.mockReset();
    h.getLangData.mockResolvedValue(otherLangData);
});

test('a stored language installed later is loaded before the window names it', async () => {
    await ensureLangPlugins();
    expect(getCurrentLocale()).toBe('en-US');
    expect(tran('Save')).toBe('Save');

    h.plugins = [genPlugin(false)];
    await reloadLangPlugins();
    // Installed but turned off: still English, and nothing was loaded.
    expect(getCurrentLocale()).toBe('en-US');
    expect(h.getLangData).not.toHaveBeenCalled();

    h.plugins = [genPlugin(true)];
    await reloadLangPlugins();
    expect(h.getLangData).toHaveBeenCalledExactlyOnceWith(otherLangCode);
    expect(getCurrentLocale()).toBe(otherLocale);
    expect(getLangData(otherLocale)).toBe(otherLangData);
    expect(tran('Save')).toBe('[other] Save');

    // Read again with the language already loaded: not loaded twice.
    await reloadLangPlugins();
    expect(h.getLangData).toHaveBeenCalledOnce();
});
