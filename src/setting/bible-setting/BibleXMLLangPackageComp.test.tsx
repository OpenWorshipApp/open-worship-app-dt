// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A made-up second language: the case is about a Bible whose language is not
// English, not about any one language's package.
const OTHER_LOCALE = 'de-DE';
const OTHER_CODE = 'de';

const mocks = vi.hoisted(() => ({
    pluginList: [] as Record<string, unknown>[],
    changeListeners: new Set<() => void>(),
    getLangCatalogEntries: vi.fn(),
    installLangPlugin: vi.fn(),
    setLangPluginEnabled: vi.fn(),
    reload: vi.fn(),
    openLanguagesSetting: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getLangCode: (locale: string) => {
        return (
            ({ 'en-US': 'en', 'de-DE': 'de' } as Record<string, string>)[
                locale
            ] ?? null
        );
    },
    getInstalledLangPlugins: () => mocks.pluginList,
    getLanguageTitle: ({ langCode }: { langCode: string }) => {
        return `English name of ${langCode}`;
    },
    tran: (text: string) => `tr:${text}`,
}));
vi.mock('../../lang/langPluginRegistry', () => ({
    onLangPluginsChanged: (listener: () => void) => {
        mocks.changeListeners.add(listener);
        return () => {
            mocks.changeListeners.delete(listener);
        };
    },
}));
vi.mock('../../lang/langPluginInstallHelpers', () => ({
    getLangCatalogEntries: mocks.getLangCatalogEntries,
    installLangPlugin: mocks.installLangPlugin,
    setLangPluginEnabled: mocks.setLangPluginEnabled,
}));
vi.mock('../settingHelpers', () => ({
    forceReloadAppWindows: mocks.reload,
    openLanguagesSetting: mocks.openLanguagesSetting,
}));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
        useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
            const [value, setValue] = React.useState<unknown>(undefined);
            React.useEffect(() => {
                let isAlive = true;
                Promise.resolve(callee()).then((newValue) => {
                    if (isAlive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isAlive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});

const OTHER_ENTRY = {
    langCode: OTHER_CODE,
    locale: OTHER_LOCALE,
    name: 'Other',
    nativeName: 'Own name',
    version: '0.0.5',
};

function toPlugin(isEnabled: boolean) {
    return {
        langCode: OTHER_CODE,
        locale: OTHER_LOCALE,
        name: 'Other',
        nativeName: 'Own name',
        isEnabled,
    };
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
    // The catalog's helpers are imported on the first ask, then read.
    for (let i = 0; i < 3; i++) {
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }
}

async function renderComp(locale: string | undefined) {
    // A fresh module each time: the list's catalog read is kept a while.
    const { default: BibleXMLLangPackageComp } =
        await import('./BibleXMLLangPackageComp');
    act(() => {
        root.render(<BibleXMLLangPackageComp locale={locale as any} />);
    });
    await flush();
}

function findButton() {
    return container.querySelector('button');
}

beforeEach(() => {
    vi.resetModules();
    mocks.pluginList = [];
    mocks.changeListeners.clear();
    mocks.getLangCatalogEntries.mockReset();
    mocks.installLangPlugin.mockReset();
    mocks.setLangPluginEnabled.mockReset();
    mocks.reload.mockReset();
    mocks.openLanguagesSetting.mockReset();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('BibleXMLLangPackageComp', () => {
    test('says nothing for an English Bible, nor reads the catalog', async () => {
        await renderComp('en-US');
        expect(container.innerHTML).toBe('');
        expect(mocks.getLangCatalogEntries).not.toHaveBeenCalled();
    });

    test('says nothing for a language the world table does not know', async () => {
        await renderComp('zz-ZZ');
        expect(container.innerHTML).toBe('');
        expect(mocks.getLangCatalogEntries).not.toHaveBeenCalled();
    });

    test('says nothing when the language is installed and on', async () => {
        mocks.pluginList = [toPlugin(true)];
        await renderComp(OTHER_LOCALE);
        expect(container.innerHTML).toBe('');
        expect(mocks.getLangCatalogEntries).not.toHaveBeenCalled();
    });

    test('a missing language is offered, named, and installed on a press', async () => {
        mocks.getLangCatalogEntries.mockResolvedValue([OTHER_ENTRY]);
        mocks.installLangPlugin.mockResolvedValue(true);
        await renderComp(OTHER_LOCALE);
        // Quiet: nobody asked, so dev's "no catalog built" toast stays away.
        expect(mocks.getLangCatalogEntries).toHaveBeenCalledWith(true);
        const text = container.textContent ?? '';
        expect(text).toContain('tr:This Bible is in ');
        expect(text).toContain('Own name (Other)');
        expect(text).not.toContain('{language}');
        expect(container.querySelector('bdi')?.textContent).toBe(
            'Own name (Other)',
        );
        const button = findButton();
        expect(button?.textContent).toBe('tr:Install');
        await act(async () => {
            button?.click();
        });
        await flush();
        expect(mocks.installLangPlugin).toHaveBeenCalledWith(OTHER_ENTRY, null);
        // Applied at once: every window reloads.
        expect(mocks.reload).toHaveBeenCalledTimes(1);
    });

    test('a failed install reloads nothing and leaves the button usable', async () => {
        mocks.getLangCatalogEntries.mockResolvedValue([OTHER_ENTRY]);
        mocks.installLangPlugin.mockResolvedValue(false);
        await renderComp(OTHER_LOCALE);
        await act(async () => {
            findButton()?.click();
        });
        await flush();
        expect(mocks.reload).not.toHaveBeenCalled();
        expect(findButton()?.disabled).toBe(false);
    });

    test('the note goes once the language list says it is installed', async () => {
        mocks.getLangCatalogEntries.mockResolvedValue([OTHER_ENTRY]);
        await renderComp(OTHER_LOCALE);
        expect(findButton()).not.toBeNull();
        mocks.pluginList = [toPlugin(true)];
        act(() => {
            for (const listener of mocks.changeListeners) {
                listener();
            }
        });
        expect(container.innerHTML).toBe('');
    });

    test('a language the catalog does not offer is not asked for', async () => {
        mocks.getLangCatalogEntries.mockResolvedValue([
            { ...OTHER_ENTRY, langCode: 'xx' },
        ]);
        await renderComp(OTHER_LOCALE);
        expect(container.innerHTML).toBe('');
    });

    test('offline, the note points to the Languages tab', async () => {
        mocks.getLangCatalogEntries.mockResolvedValue(null);
        await renderComp(OTHER_LOCALE);
        expect(container.textContent).toContain(
            `English name of ${OTHER_CODE}`,
        );
        const button = findButton();
        expect(button?.textContent).toBe('tr:Languages');
        act(() => {
            button?.click();
        });
        expect(mocks.openLanguagesSetting).toHaveBeenCalledTimes(1);
        expect(mocks.installLangPlugin).not.toHaveBeenCalled();
    });

    test('a turned-off language is turned on by its button', async () => {
        mocks.pluginList = [toPlugin(false)];
        await renderComp(OTHER_LOCALE);
        expect(mocks.getLangCatalogEntries).not.toHaveBeenCalled();
        expect(container.textContent).toContain('which is turned off');
        const button = findButton();
        expect(button?.textContent).toBe('tr:Enable');
        await act(async () => {
            button?.click();
        });
        await flush();
        expect(mocks.setLangPluginEnabled).toHaveBeenCalledWith(
            OTHER_CODE,
            true,
        );
        expect(mocks.reload).toHaveBeenCalledTimes(1);
    });

    test('every row of one list shares one catalog read', async () => {
        mocks.getLangCatalogEntries.mockResolvedValue([OTHER_ENTRY]);
        const { default: BibleXMLLangPackageComp } =
            await import('./BibleXMLLangPackageComp');
        act(() => {
            root.render(
                <>
                    <BibleXMLLangPackageComp locale={OTHER_LOCALE as any} />
                    <BibleXMLLangPackageComp locale={OTHER_LOCALE as any} />
                </>,
            );
        });
        await flush();
        expect(container.querySelectorAll('button')).toHaveLength(2);
        expect(mocks.getLangCatalogEntries).toHaveBeenCalledTimes(1);
    });
});
