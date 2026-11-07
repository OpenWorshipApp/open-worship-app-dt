import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

// A window's language plugins through `appProvider.langUtils`: read once, put
// into the small-file store, read again when any window says they changed.

const h = vi.hoisted(() => {
    return {
        plugins: [] as LangPluginType[],
        listeners: new Map<string, () => void>(),
        sent: [] as string[],
        getLangData: vi.fn(async (langCode: string) => ({ langCode })),
        readLangPluginJson: vi.fn(async () => ({ read: true })),
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        langUtils: {
            getLangPlugins: async () => h.plugins,
            getLangData: h.getLangData,
            readLangPluginJson: h.readLangPluginJson,
        },
        messageUtils: {
            listenForData: (channel: string, listener: () => void) => {
                h.listeners.set(channel, listener);
            },
            sendData: (channel: string) => {
                h.sent.push(channel);
            },
        },
    },
}));

function genPlugin(
    langCode: string,
    extra: Partial<LangPluginType> = {},
): LangPluginType {
    return {
        apiVersion: 1,
        langCode,
        locale: `${langCode}-XX`,
        name: langCode,
        nativeName: langCode,
        version: '1.0.0',
        description: '',
        isEnabled: true,
        isBuiltIn: true,
        isRemovable: false,
        builtInVersion: '1.0.0',
        dirPath: `/lang/${langCode}`,
        removableDirPaths: [],
        inlineFiles: { 'script.json': { scriptPattern: langCode } },
        ...extra,
    };
}

async function importModules() {
    vi.resetModules();
    const registry = await import('./langPluginRegistry');
    const store = await import('./langFileStore');
    return { registry, store };
}

beforeEach(() => {
    h.plugins = [genPlugin('xx'), genPlugin('yy', { isEnabled: false })];
    h.listeners.clear();
    h.sent = [];
});

describe('langPluginRegistry', () => {
    test('reads the list once and gives the store the languages turned on', async () => {
        const { registry, store } = await importModules();
        expect(registry.getLoadedLangPlugins()).toBeNull();
        const list = await registry.ensureLangPlugins();
        expect(list).toBe(h.plugins);
        await registry.ensureLangPlugins();
        expect(registry.getLoadedLangPlugins()).toBe(list);
        expect(
            registry.getEnabledLangPlugins().map((plugin) => plugin.langCode),
        ).toEqual(['xx']);
        expect(store.listLangFileCodes()).toEqual(['en', 'xx']);
        expect(store.getLangFile('xx', 'meta.json')).toEqual({
            locale: 'xx-XX',
            order: undefined,
        });
        // A bigger file comes through the provider.
        await expect(
            store.loadLangFile('xx', 'questions.json'),
        ).resolves.toEqual({ read: true });
        expect(h.readLangPluginJson).toHaveBeenCalledWith(
            'xx',
            'questions.json',
        );
    });

    test('a change in any window reads the list again and tells the listeners', async () => {
        const { registry, store } = await importModules();
        await registry.ensureLangPlugins();
        const listener = vi.fn();
        registry.onLangPluginsChanged(listener);
        h.plugins = [genPlugin('yy')];
        const changed = h.listeners.get('main:app:lang-plugins-changed');
        expect(changed).toBeDefined();
        changed?.();
        await vi.waitFor(() => {
            expect(listener).toHaveBeenCalledOnce();
        });
        expect(store.listLangFileCodes()).toEqual(['en', 'yy']);
        registry.notifyLangPluginsChanged();
        expect(h.sent).toEqual(['all:app:lang-plugins-changed']);
    });

    // Khmer installed from Settings, 2026-11-05: the window took the new list
    // before the language it now named was loaded, and `tran` threw.
    test('a list read again is prepared before the window takes it', async () => {
        const { registry } = await importModules();
        const seenList: (LangPluginType[] | null)[] = [];
        const prepare = vi.fn(async () => {
            seenList.push(registry.getLoadedLangPlugins());
        });
        registry.setLangPluginsPrepare(prepare);
        const firstList = await registry.ensureLangPlugins();
        // The boot loads its own language after the first read.
        expect(prepare).not.toHaveBeenCalled();
        const nextList = [genPlugin('zz')];
        h.plugins = nextList;
        await registry.reloadLangPlugins();
        expect(prepare).toHaveBeenCalledExactlyOnceWith(nextList);
        expect(seenList).toEqual([firstList]);
        expect(registry.getLoadedLangPlugins()).toBe(nextList);
    });

    test('a failing preparation still takes the new list', async () => {
        const { registry } = await importModules();
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        registry.setLangPluginsPrepare(async () => {
            throw new Error('broken plugin');
        });
        await registry.ensureLangPlugins();
        const nextList = [genPlugin('zz')];
        h.plugins = nextList;
        await expect(registry.reloadLangPlugins()).resolves.toBe(nextList);
        expect(registry.getLoadedLangPlugins()).toBe(nextList);
        expect(errorSpy).toHaveBeenCalledOnce();
        errorSpy.mockRestore();
    });

    test("a language's code is loaded through the provider", async () => {
        const { registry } = await importModules();
        await expect(registry.loadLangPluginData('xx')).resolves.toEqual({
            langCode: 'xx',
        });
        expect(h.getLangData).toHaveBeenCalledWith('xx');
    });
});
