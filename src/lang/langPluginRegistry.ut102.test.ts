import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

// The registry's failure paths and the provider WITHOUT `langUtils` (a unit
// test's own window), where the checkout's source packages stand in.

const h = vi.hoisted(() => {
    return {
        hasLangUtils: true,
        listeners: new Map<string, () => void>(),
        getLangPlugins: vi.fn<() => Promise<unknown>>(),
        getLangData: vi.fn(),
        readLangPluginJson: vi.fn(),
        listSourceLangPlugins: vi.fn<() => LangPluginType[]>(),
        loadSourceLangData: vi.fn(),
        loadSourceLangFile: vi.fn(),
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get langUtils() {
            if (!h.hasLangUtils) {
                return undefined;
            }
            return {
                getLangPlugins: h.getLangPlugins,
                getLangData: h.getLangData,
                readLangPluginJson: h.readLangPluginJson,
            };
        },
        messageUtils: {
            listenForData: (channel: string, listener: () => void) => {
                h.listeners.set(channel, listener);
            },
            sendData: () => {},
        },
    },
}));

vi.mock('./langSourceFiles', () => ({
    listSourceLangPlugins: h.listSourceLangPlugins,
    loadSourceLangData: h.loadSourceLangData,
    loadSourceLangFile: h.loadSourceLangFile,
}));

function genPlugin(langCode: string): LangPluginType {
    return {
        apiVersion: 1,
        langCode,
        locale: `${langCode}-XX`,
        name: langCode,
        nativeName: langCode,
        version: '1.0.0',
        description: '',
        isEnabled: true,
        isBuiltIn: false,
        isRemovable: true,
        builtInVersion: null,
        dirPath: `/lang/${langCode}`,
        removableDirPaths: [],
        inlineFiles: {},
    } as unknown as LangPluginType;
}

async function importModules() {
    vi.resetModules();
    const registry = await import('./langPluginRegistry');
    const store = await import('./langFileStore');
    return { registry, store };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    h.hasLangUtils = true;
    h.listeners.clear();
    // The store seeds itself from the source list at load.
    h.listSourceLangPlugins.mockReturnValue([]);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

describe('langPluginRegistry failures', () => {
    test('a provider that fails to list gives no languages and logs why', async () => {
        const failure = new Error('main process gone');
        h.getLangPlugins.mockRejectedValue(failure);
        const { registry, store } = await importModules();
        await expect(registry.ensureLangPlugins()).resolves.toEqual([]);
        expect(registry.getLoadedLangPlugins()).toEqual([]);
        expect(store.listLangFileCodes()).toEqual(['en']);
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to read the installed languages:',
            failure,
        );
    });

    test('a provider answering something not a list gives no languages', async () => {
        h.getLangPlugins.mockResolvedValue({ langCode: 'xx' });
        const { registry } = await importModules();
        await expect(registry.ensureLangPlugins()).resolves.toEqual([]);
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test('a change whose re-read fails is logged, not thrown', async () => {
        h.getLangPlugins.mockResolvedValue([genPlugin('xx')]);
        const { registry } = await importModules();
        await registry.ensureLangPlugins();
        const failure = new Error('listener broke');
        registry.onLangPluginsChanged(() => {
            throw failure;
        });
        const changed = h.listeners.get('main:app:lang-plugins-changed');
        expect(changed).toBeTypeOf('function');
        changed!();
        await vi.waitFor(() => {
            expect(errorSpy).toHaveBeenCalledWith(
                'Failed to re-read the installed languages:',
                failure,
            );
        });
        // The list itself WAS read again before the listener threw.
        expect(h.getLangPlugins).toHaveBeenCalledTimes(2);
    });

    test('an unregistered listener is no longer told', async () => {
        h.getLangPlugins.mockResolvedValue([genPlugin('xx')]);
        const { registry } = await importModules();
        const listener = vi.fn();
        const unregister = registry.onLangPluginsChanged(listener);
        unregister();
        await registry.reloadLangPlugins();
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('langPluginRegistry without langUtils', () => {
    test('the list, a small file and the code come from the source packages', async () => {
        h.hasLangUtils = false;
        h.listSourceLangPlugins.mockReturnValue([genPlugin('xx')]);
        h.loadSourceLangFile.mockResolvedValue({ fromSource: true });
        h.loadSourceLangData.mockResolvedValue({ langCode: 'xx' });
        const { registry, store } = await importModules();
        const list = await registry.ensureLangPlugins();
        expect(list.map((plugin) => plugin.langCode)).toEqual(['xx']);
        expect(store.listLangFileCodes()).toEqual(['en', 'xx']);
        await expect(
            store.loadLangFile('xx', 'questions.json'),
        ).resolves.toEqual({ fromSource: true });
        expect(h.loadSourceLangFile).toHaveBeenCalledWith(
            'xx',
            'questions.json',
        );
        await expect(registry.loadLangPluginData('xx')).resolves.toEqual({
            langCode: 'xx',
        });
        expect(h.loadSourceLangData).toHaveBeenCalledWith('xx');
        expect(h.getLangPlugins).not.toHaveBeenCalled();
        expect(h.readLangPluginJson).not.toHaveBeenCalled();
    });
});
