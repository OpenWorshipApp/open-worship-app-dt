// @vitest-environment jsdom

// Settings > Languages: the catalog row's own Update press, a change heard
// from another window re-reading what is installed, and Refresh re-reading
// both lists. The same mock surface as `SettingLanguagesComp.test.tsx`, with
// the change listener kept so a test can fire it and every read counted.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

const h = vi.hoisted(() => ({
    plugins: [] as any[],
    catalog: [] as any[] | null,
    pluginReadCount: 0,
    catalogReadCount: 0,
    changeListeners: new Set<() => void>(),
    install: vi.fn(),
    reload: vi.fn(),
}));

function checkIsNewer(plugin: any, entry: any) {
    return entry !== undefined && entry.version !== plugin.version;
}

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../lang/langHelpers', () => ({
    ensureLangPlugins: async () => {
        h.pluginReadCount += 1;
        return h.plugins;
    },
    tran: (text: string) => text,
}));
vi.mock('../lang/langPluginRegistry', () => ({
    onLangPluginsChanged: (listener: () => void) => {
        h.changeListeners.add(listener);
        return () => {
            h.changeListeners.delete(listener);
        };
    },
}));
vi.mock('../lang/langPluginInstallHelpers', () => ({
    checkIsLangUpdateAvailable: checkIsNewer,
    listLangUpdateCodes: (pluginList: any[], entryList: any[]) => {
        return pluginList
            .filter((plugin) => {
                return checkIsNewer(
                    plugin,
                    entryList.find((entry) => {
                        return entry.langCode === plugin.langCode;
                    }),
                );
            })
            .map((plugin) => {
                return plugin.langCode;
            });
    },
    deleteLangPlugin: async () => true,
    getLangCatalogEntries: async () => {
        h.catalogReadCount += 1;
        return h.catalog;
    },
    importLangPluginFromFile: async () => false,
    installLangPlugin: async (entry: any, plugin: any) => {
        h.install(entry, plugin);
        return true;
    },
    saveLangPackToDownloads: async () => null,
    isolateText: (text: string) => `"${text}"`,
    searchLangCatalog: (list: any[]) => list,
    setLangPluginEnabled: () => {},
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: async () => true,
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: () => {},
}));
vi.mock('./SettingApplyComp', () => ({
    applyStore: { pendingApply: () => {} },
}));
vi.mock('./settingHelpers', () => ({
    forceReloadAppWindows: h.reload,
}));
vi.mock('./SettingLanguagePickerComp', () => ({
    default: () => <div className="language-picker" />,
}));
vi.mock('./SettingOthersSectionComp', () => ({
    default: ({ title, headerActions, children }: any) => (
        <section data-title={title}>
            {headerActions}
            {children}
        </section>
    ),
}));
vi.mock('../helper/packageUpdateHelpers', () => ({
    reportPackageUpdates: () => {},
}));

import SettingLanguagesComp from './SettingLanguagesComp';

function genPlugin(extra: Partial<LangPluginType>): LangPluginType {
    return {
        apiVersion: 1,
        langCode: 'yy',
        locale: 'yy-YY',
        name: 'Other',
        nativeName: 'Other',
        version: '1.0.0',
        description: '',
        isEnabled: true,
        isBuiltIn: false,
        isRemovable: true,
        builtInVersion: null,
        dirPath: '/data/lang/yy@1.0.0',
        removableDirPaths: ['/data/lang/yy@1.0.0'],
        inlineFiles: {},
        ...extra,
    };
}

function genEntry(langCode: string, name: string, version: string) {
    return { langCode, name, nativeName: name, version, description: '' };
}

let container: HTMLDivElement;
let root: Root;

async function settle() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function renderTab() {
    await act(async () => {
        root.render(<SettingLanguagesComp />);
    });
    await settle();
}

function findButton(text: string) {
    return (
        Array.from(container.querySelectorAll('button')).find((button) => {
            return (
                button.textContent?.trim() === text ||
                button.getAttribute('aria-label') === text
            );
        }) ?? null
    );
}

function sectionText(title: string) {
    return container.querySelector(`[data-title="${title}"]`)?.textContent;
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    h.plugins = [genPlugin({})];
    h.catalog = [genEntry('yy', 'Other', '1.0.1')];
    h.pluginReadCount = 0;
    h.catalogReadCount = 0;
    h.changeListeners.clear();
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('SettingLanguagesComp', () => {
    test('the catalog row’s own Update press installs over the copy in use', async () => {
        await renderTab();
        const catalogUpdate = Array.from(
            container.querySelectorAll('[data-title="Find a Language"] button'),
        ).find((button) => button.textContent === 'Update to 1.0.1')!;

        await act(async () => {
            (catalogUpdate as HTMLButtonElement).click();
        });

        expect(h.install).toHaveBeenCalledWith(h.catalog?.[0], h.plugins[0]);
        expect(h.reload).toHaveBeenCalledOnce();
    });

    test('a change heard from any window reads the installed languages again', async () => {
        await renderTab();
        expect(h.pluginReadCount).toBe(1);
        expect(h.changeListeners.size).toBe(1);
        expect(sectionText('Installed Languages')).not.toContain('Third');

        h.plugins = [
            ...h.plugins,
            genPlugin({ langCode: 'zz', name: 'Third', nativeName: 'Third' }),
        ];
        await act(async () => {
            for (const listener of h.changeListeners) {
                listener();
            }
        });
        await settle();

        expect(h.pluginReadCount).toBe(2);
        // The catalog is not read again for it.
        expect(h.catalogReadCount).toBe(1);
        expect(sectionText('Installed Languages')).toContain('Third');
    });

    test('Refresh reads the catalog and the installed languages again', async () => {
        await renderTab();
        expect(sectionText('Find a Language')).not.toContain('Fourth');

        h.catalog = [...(h.catalog ?? []), genEntry('ww', 'Fourth', '0.0.1')];
        await act(async () => {
            findButton('Refresh')!.click();
        });
        await settle();

        expect(h.catalogReadCount).toBe(2);
        expect(h.pluginReadCount).toBe(2);
        expect(sectionText('Find a Language')).toContain('Fourth');
    });

    test('closing the tab stops it listening for changes', async () => {
        await renderTab();
        expect(h.changeListeners.size).toBe(1);
        await act(async () => {
            root.render(<div />);
        });
        expect(h.changeListeners.size).toBe(0);
    });
});
