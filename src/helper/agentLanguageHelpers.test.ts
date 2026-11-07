import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        getLangPlugins: vi.fn(),
        readCatalog: vi.fn(),
        installLangPlugin: vi.fn(),
        setLangPluginEnabled: vi.fn(),
    };
});

vi.mock('../server/appProvider', () => {
    return {
        default: { langUtils: { getLangPlugins: mocks.getLangPlugins } },
    };
});
vi.mock('../lang/langHelpers', () => {
    return {
        DEFAULT_LANG_CODE: 'en',
        getInstalledLangPlugins: () => [],
        languageNameMap: {
            en: 'English',
            de: 'German',
            nl: 'Dutch',
            la: 'Latin',
        },
    };
});
vi.mock('../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs', () => {
    return {
        toCatalogLanguageWord: (word: string) => {
            return word === 'germany' ? 'german' : null;
        },
    };
});
vi.mock('../setting/bible-setting/bibleLangPackageHelpers', () => {
    return {
        readLangCatalogForBibles: mocks.readCatalog,
        findLangCatalogEntry: (list: { langCode: string }[], code: string) => {
            return (
                list.find((entry) => {
                    return entry.langCode === code;
                }) ?? null
            );
        },
    };
});
vi.mock('../lang/langPluginInstallHelpers', () => {
    return {
        installLangPlugin: mocks.installLangPlugin,
        setLangPluginEnabled: mocks.setLangPluginEnabled,
    };
});

import { handleAgentLanguageRequest } from './agentLanguageHelpers';

const DUTCH_PLUGIN = {
    langCode: 'nl',
    name: 'Dutch',
    nativeName: 'Dutchish',
    version: '0.0.6',
    isEnabled: true,
};
const GERMAN_ENTRY = {
    langCode: 'de',
    locale: 'de-DE',
    name: 'German',
    nativeName: 'Gerlandish',
    version: '0.0.6',
    size: 220_000,
};

beforeEach(() => {
    mocks.getLangPlugins.mockReset().mockResolvedValue([DUTCH_PLUGIN]);
    mocks.readCatalog.mockReset().mockResolvedValue([GERMAN_ENTRY]);
    mocks.installLangPlugin.mockReset().mockResolvedValue(true);
    mocks.setLangPluginEnabled.mockReset();
});

describe('check', () => {
    it('says a missing language the catalog has, with its size', async () => {
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'German',
            }),
        ).toEqual({
            language: 'German',
            state: 'missing',
            langCode: 'de',
            name: 'German',
            nativeName: 'Gerlandish',
            version: '0.0.6',
            size: 220_000,
        });
    });

    it('reads an installed language without the catalog', async () => {
        const result = await handleAgentLanguageRequest({
            action: 'check',
            language: 'Dutchish',
        });
        expect(result).toMatchObject({ state: 'installed', langCode: 'nl' });
        expect(mocks.readCatalog).not.toHaveBeenCalled();
    });

    it('says a turned-off one, English, and a code', async () => {
        mocks.getLangPlugins.mockResolvedValue([
            { ...DUTCH_PLUGIN, isEnabled: false },
        ]);
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'nl',
            }),
        ).toMatchObject({ state: 'turned-off', langCode: 'nl' });
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'English',
            }),
        ).toMatchObject({ state: 'english', langCode: 'en' });
    });

    it('finds a language by the name only the catalog knows', async () => {
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'Gerlandish',
            }),
        ).toMatchObject({ state: 'missing', langCode: 'de' });
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'germany',
            }),
        ).toMatchObject({ state: 'missing', langCode: 'de' });
    });

    // 2026-11-05: "Norwegian Bokmal" was read as Norwegian by English's
    // table, which the catalog has no package of, and its Bokmal package
    // was answered "unavailable". A made-up pair stands in for it.
    it('lets the catalog name a package its neighbour shadowed', async () => {
        mocks.readCatalog.mockResolvedValue([
            GERMAN_ENTRY,
            {
                ...GERMAN_ENTRY,
                langCode: 'lc',
                name: 'Latin Classic',
                nativeName: 'Classicish',
            },
        ]);
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'Latin Classic',
            }),
        ).toMatchObject({ state: 'missing', langCode: 'lc' });
        // The plain neighbour is still itself, and still has no package.
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'Latin',
            }),
        ).toMatchObject({ state: 'unavailable', langCode: 'la' });
    });

    it('a language with no package, an offline catalog and no language', async () => {
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'Latin',
            }),
        ).toMatchObject({ state: 'unavailable', langCode: 'la' });
        mocks.readCatalog.mockResolvedValue(null);
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'German',
            }),
        ).toMatchObject({ state: 'unavailable', isOffline: true });
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: 'the newest one',
            }),
        ).toEqual({ language: 'the newest one', state: 'unknown' });
    });
});

describe('install', () => {
    it('installs a missing language from the catalog', async () => {
        const result = await handleAgentLanguageRequest({
            action: 'install',
            language: 'de',
        });
        expect(mocks.installLangPlugin).toHaveBeenCalledWith(
            GERMAN_ENTRY,
            null,
        );
        expect(result).toMatchObject({ state: 'installed', installed: 'de' });
    });

    it('turns a turned-off one back on instead', async () => {
        mocks.getLangPlugins.mockResolvedValue([
            { ...DUTCH_PLUGIN, isEnabled: false },
        ]);
        const result = await handleAgentLanguageRequest({
            action: 'install',
            language: 'Dutch',
        });
        expect(mocks.setLangPluginEnabled).toHaveBeenCalledWith('nl', true);
        expect(mocks.installLangPlugin).not.toHaveBeenCalled();
        expect(result).toMatchObject({ state: 'installed', wasTurnedOn: true });
    });

    it('does nothing for one already there', async () => {
        const result = await handleAgentLanguageRequest({
            action: 'install',
            language: 'Dutch',
        });
        expect(mocks.installLangPlugin).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            state: 'installed',
            isAlreadyThere: true,
        });
    });

    it('answers a problem, never throws', async () => {
        mocks.installLangPlugin.mockResolvedValue(false);
        expect(
            await handleAgentLanguageRequest({
                action: 'install',
                language: 'German',
            }),
        ).toMatchObject({ problem: 'failed' });
        expect(
            await handleAgentLanguageRequest({
                action: 'install',
                language: 'Latin',
            }),
        ).toMatchObject({ problem: 'unavailable' });
    });
});

describe('list and wrong requests', () => {
    it('lists the installed and the catalog’s others', async () => {
        expect(await handleAgentLanguageRequest({ action: 'list' })).toEqual({
            installed: [
                {
                    langCode: 'nl',
                    name: 'Dutch',
                    nativeName: 'Dutchish',
                    version: '0.0.6',
                    isEnabled: true,
                },
            ],
            available: [
                {
                    langCode: 'de',
                    name: 'German',
                    nativeName: 'Gerlandish',
                    version: '0.0.6',
                    size: 220_000,
                },
            ],
        });
    });

    it('refuses an unknown action and a missing language in a sentence', async () => {
        expect(
            await handleAgentLanguageRequest({ action: 'delete' }),
        ).toMatchObject({ isError: true });
        expect(
            await handleAgentLanguageRequest({
                action: 'check',
                language: ' ',
            }),
        ).toMatchObject({ isError: true });
    });
});
