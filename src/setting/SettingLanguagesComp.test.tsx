// @vitest-environment jsdom

// Settings > Languages rendered whole: the language picker on top, English
// and every installed language with its switch, an update offered when the catalog is newer, and the
// catalog searched and installed from. The work itself is
// `langPluginInstallHelpers`' and has its own test; here it is recorded.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

const h = vi.hoisted(() => ({
    plugins: [] as any[],
    catalog: [] as any[] | null,
    setEnabled: vi.fn(),
    install: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    confirm: vi.fn(async () => true),
    pendingApply: vi.fn(),
    reload: vi.fn(),
    importFromFile: vi.fn(async (_list: any[]) => true),
    saveToDownloads: vi.fn(async (_entry: any) => '/downloads/x.tar.gz'),
    reportUpdates: vi.fn(),
    reveal: vi.fn(),
}));

function checkIsNewer(plugin: any, entry: any) {
    return entry !== undefined && entry.version !== plugin.version;
}

// `appHooks` reads the dev flag as it loads.
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../lang/langHelpers', () => ({
    ensureLangPlugins: async () => h.plugins,
    tran: (text: string) => text,
}));
vi.mock('../lang/langPluginRegistry', () => ({
    onLangPluginsChanged: () => () => {},
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
    deleteLangPlugin: h.remove,
    getLangCatalogEntries: async () => h.catalog,
    importLangPluginFromFile: h.importFromFile,
    installLangPlugin: h.install,
    saveLangPackToDownloads: h.saveToDownloads,
    isolateText: (text: string) => `"${text}"`,
    searchLangCatalog: (list: any[], query: string) => {
        return list.filter((entry) => {
            return entry.name.toLowerCase().includes(query.toLowerCase());
        });
    },
    setLangPluginEnabled: h.setEnabled,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.confirm,
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: h.reveal,
}));
vi.mock('./SettingApplyComp', () => ({
    applyStore: { pendingApply: h.pendingApply },
}));
// Every change here reloads every window at once.
vi.mock('./settingHelpers', () => ({
    forceReloadAppWindows: h.reload,
}));
// The picker has its own test (`SettingGeneralComp.test.tsx`); here it is
// only where it stands.
vi.mock('./SettingLanguagePickerComp', () => ({
    default: () => <div className="language-picker" />,
}));
vi.mock('./SettingOthersSectionComp', () => ({
    default: ({
        title,
        stateLabel,
        isUpdateAvailable,
        headerActions,
        children,
    }: any) => (
        <section
            data-title={title}
            data-state={stateLabel}
            data-update={isUpdateAvailable ? 'yes' : 'no'}
        >
            {headerActions}
            {children}
        </section>
    ),
}));
// The gear's and the tab's dots hear what this tab learned.
vi.mock('../helper/packageUpdateHelpers', () => ({
    reportPackageUpdates: h.reportUpdates,
}));

import SettingLanguagesComp from './SettingLanguagesComp';

function genPlugin(extra: Partial<LangPluginType>): LangPluginType {
    return {
        apiVersion: 1,
        langCode: 'xx',
        locale: 'xx-XX',
        name: 'Example',
        nativeName: 'Own',
        version: '1.0.0',
        description: 'An example.',
        isEnabled: true,
        isBuiltIn: true,
        isRemovable: false,
        builtInVersion: '1.0.0',
        dirPath: '/lang/xx',
        removableDirPaths: [],
        inlineFiles: {},
        ...extra,
    };
}

function genEntry(langCode: string, name: string, version: string) {
    return { langCode, name, nativeName: name, version, description: '' };
}

let container: HTMLDivElement;
let root: Root;

async function renderTab() {
    await act(async () => {
        root.render(<SettingLanguagesComp />);
    });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
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

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    h.plugins = [
        genPlugin({}),
        genPlugin({
            langCode: 'yy',
            name: 'Other',
            nativeName: 'Other',
            isBuiltIn: false,
            isRemovable: true,
            builtInVersion: null,
            removableDirPaths: ['/data/lang/yy@1.0.0'],
        }),
    ];
    h.catalog = [
        genEntry('yy', 'Other', '1.0.1'),
        genEntry('zz', 'Third', '0.1.0'),
    ];
    for (const mock of [
        h.setEnabled,
        h.install,
        h.remove,
        h.confirm,
        h.pendingApply,
        h.reload,
        h.importFromFile,
        h.saveToDownloads,
        h.reportUpdates,
        h.reveal,
    ]) {
        mock.mockClear();
    }
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('SettingLanguagesComp', () => {
    test('the language picker comes first, above the installed languages', async () => {
        await renderTab();
        const rack = container.querySelector('.app-setting-others-rack');
        expect(
            Array.from(rack?.children ?? []).map((child) => {
                return child.getAttribute('data-title') ?? child.className;
            }),
        ).toEqual([
            'language-picker',
            'Installed Languages',
            'Find a Language',
        ]);
    });

    test('English is always on; every other language can be turned off', async () => {
        await renderTab();
        const switchList = Array.from(
            container.querySelectorAll<HTMLInputElement>(
                'input[role="switch"]',
            ),
        );
        expect(switchList).toHaveLength(3);
        expect(switchList[0].disabled).toBe(true);
        expect(switchList[0].checked).toBe(true);
        await act(async () => {
            switchList[1].click();
        });
        expect(h.setEnabled).toHaveBeenCalledWith('xx', false);
        // Applied at once: every window reloads, nothing waits for Apply.
        expect(h.reload).toHaveBeenCalledOnce();
        expect(h.pendingApply).not.toHaveBeenCalled();
        // Its own name first, the English one beside it.
        expect(container.textContent).toContain('Own (Example)');
    });

    test('a newer pack is offered as an update, and only an installed copy deletes', async () => {
        await renderTab();
        expect(
            container
                .querySelector('[data-title="Installed Languages"]')
                ?.getAttribute('data-state'),
        ).toBe('Update Available');
        const updateList = Array.from(
            container.querySelectorAll('button'),
        ).filter((button) => button.textContent === 'Update to 1.0.1');
        // On its installed row and on its catalog row.
        expect(updateList).toHaveLength(2);
        await act(async () => {
            updateList[0].click();
        });
        expect(h.install).toHaveBeenCalledWith(h.catalog?.[0], h.plugins[1]);
        expect(h.reload).toHaveBeenCalledOnce();
        expect(findButton('Delete: Example')).toBeNull();
        await act(async () => {
            findButton('Delete: Other')?.click();
        });
        expect(h.confirm).toHaveBeenCalledOnce();
        expect(h.remove).toHaveBeenCalledWith(h.plugins[1]);
        expect(h.reload).toHaveBeenCalledTimes(2);
        expect(h.pendingApply).not.toHaveBeenCalled();
    });

    test('a delete that leaves files in use keeps its toast on screen: Apply Settings, no reload', async () => {
        h.remove.mockResolvedValueOnce(false);
        await renderTab();
        await act(async () => {
            findButton('Delete: Other')?.click();
        });
        expect(h.remove).toHaveBeenCalledWith(h.plugins[1]);
        expect(h.reload).not.toHaveBeenCalled();
        expect(h.pendingApply).toHaveBeenCalledOnce();
    });

    test('every installed language reveals its folder, changing nothing', async () => {
        h.plugins[1].dirPath = '/data/lang/yy@1.0.0';
        await renderTab();
        // English is the app's own: no folder of its own to show.
        expect(findButton('Reveal Folder: English')).toBeNull();
        const revealButton = findButton('Reveal Folder: Other');
        expect(revealButton?.title).toBe('/data/lang/yy@1.0.0\nReveal Folder');
        await act(async () => {
            revealButton?.click();
        });
        expect(h.reveal).toHaveBeenCalledExactlyOnceWith('/data/lang/yy@1.0.0');
        await act(async () => {
            findButton('Reveal Folder: Example')?.click();
        });
        expect(h.reveal).toHaveBeenLastCalledWith('/lang/xx');
        expect(h.reload).not.toHaveBeenCalled();
        expect(h.pendingApply).not.toHaveBeenCalled();
    });

    test('a delete answered Cancel changes nothing and reloads nothing', async () => {
        h.confirm.mockResolvedValueOnce(false);
        await renderTab();
        await act(async () => {
            findButton('Delete: Other')?.click();
        });
        expect(h.remove).not.toHaveBeenCalled();
        expect(h.reload).not.toHaveBeenCalled();
    });

    test('the catalog is searched and installed from', async () => {
        await renderTab();
        const input = container.querySelector<HTMLInputElement>(
            'input[type="search"]',
        )!;
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        await act(async () => {
            setValue.call(input, 'thi');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        // The catalog shows the match alone; the installed list is untouched.
        expect(
            Array.from(container.querySelectorAll('button')).filter(
                (button) => button.textContent === 'Update to 1.0.1',
            ),
        ).toHaveLength(1);
        await act(async () => {
            findButton('Install')?.click();
        });
        expect(h.install).toHaveBeenCalledWith(h.catalog?.[1], null);
        expect(h.reload).toHaveBeenCalledOnce();
        await act(async () => {
            setValue.call(input, 'nothing like it');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(container.textContent).toContain('No language matches.');
    });

    test('a failed install reloads nothing', async () => {
        h.install.mockResolvedValueOnce(false);
        await renderTab();
        await act(async () => {
            findButton('Install')?.click();
        });
        expect(h.install).toHaveBeenCalledWith(h.catalog?.[1], null);
        expect(h.reload).not.toHaveBeenCalled();
        expect(h.pendingApply).not.toHaveBeenCalled();
        expect(findButton('Install')?.disabled).toBe(false);
    });

    test('Import hands over what is installed, and reloads only when it installed', async () => {
        await renderTab();
        await act(async () => {
            findButton('Import')?.click();
        });
        // Its copy that came with the app decides whether the file is newer.
        expect(h.importFromFile).toHaveBeenCalledWith(h.plugins);
        expect(h.reload).toHaveBeenCalledOnce();

        h.importFromFile.mockResolvedValueOnce(false);
        await act(async () => {
            findButton('Import')?.click();
        });
        expect(h.reload).toHaveBeenCalledOnce();
        expect(h.pendingApply).not.toHaveBeenCalled();
    });

    test('Download saves a catalog row to pass on, installing nothing, and every button waits for it', async () => {
        let finish!: (value: string) => void;
        h.saveToDownloads.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        await renderTab();
        await act(async () => {
            findButton('Download: Third')?.click();
        });
        expect(h.saveToDownloads).toHaveBeenCalledWith(h.catalog?.[1]);
        expect(h.install).not.toHaveBeenCalled();
        expect(findButton('Import')?.disabled).toBe(true);
        expect(findButton('Install')?.disabled).toBe(true);

        await act(async () => {
            finish('/downloads/zz-0.1.0.tar.gz');
        });
        expect(findButton('Import')?.disabled).toBe(false);
        // Saving a pack changes nothing installed: no reload.
        expect(h.reload).not.toHaveBeenCalled();
        expect(h.pendingApply).not.toHaveBeenCalled();
    });

    test('no catalog says so, and what is installed still shows', async () => {
        h.catalog = null;
        await renderTab();
        expect(container.textContent).toContain(
            'Could not reach the language list.',
        );
        expect(container.querySelectorAll('input[role="switch"]')).toHaveLength(
            3,
        );
        // An unreachable catalog says nothing about updates: the launch's
        // answer is left as it was.
        expect(h.reportUpdates).not.toHaveBeenCalled();
    });

    test('the language with an update carries the dot, and the gear hears which', async () => {
        await renderTab();
        expect(h.reportUpdates).toHaveBeenCalledWith({ langCodes: ['yy'] });
        expect(
            container
                .querySelector('[data-title="Installed Languages"]')
                ?.getAttribute('data-update'),
        ).toBe('yes');
        const dotList = Array.from(
            container.querySelectorAll('.app-update-dot-inline'),
        );
        // On the installed row of the one that updates, nowhere else.
        expect(dotList).toHaveLength(1);
        expect(dotList[0].closest('li')?.textContent).toContain('Other');
        expect(dotList[0].getAttribute('aria-label')).toBe('Update Available');
    });

    test('nothing to update clears the dots', async () => {
        h.catalog = [genEntry('yy', 'Other', '1.0.0')];
        await renderTab();
        expect(h.reportUpdates).toHaveBeenCalledWith({ langCodes: [] });
        expect(container.querySelector('.app-update-dot-inline')).toBeNull();
        expect(
            container
                .querySelector('[data-title="Installed Languages"]')
                ?.getAttribute('data-update'),
        ).toBe('no');
    });
});
