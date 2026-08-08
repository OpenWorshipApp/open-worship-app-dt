import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    copyDebugInfoToClipboard,
    goDownload,
    openFindOverlay,
    previewPrintCurrentWindow,
    printCurrentWindow,
    toShortcutKey,
} = vi.hoisted(() => ({
    copyDebugInfoToClipboard: vi.fn(),
    goDownload: vi.fn(),
    openFindOverlay: vi.fn(),
    previewPrintCurrentWindow: vi.fn(async () => undefined),
    printCurrentWindow: vi.fn(),
    toShortcutKey: vi.fn(() => 'CmdOrCtrl+F'),
}));

vi.mock('./finderOverlayHelpers', async (importOriginal) => {
    // Only the opening is stubbed; the host test stays real so the routing
    // decision itself is covered.
    const actual =
        await importOriginal<typeof import('./finderOverlayHelpers')>();
    return { ...actual, openFindOverlay };
});

vi.mock('./electronHelpers', () => ({
    copyDebugInfoToClipboard,
    goDownload,
    previewPrintCurrentWindow,
    printCurrentWindow,
    toShortcutKey,
}));

vi.mock('./client/appInfo', () => ({
    default: {
        title: 'Open Worship app',
    },
}));

import { initMenu, sendMenuClicked, setCustomMenusData } from './electronMenu';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

describe('electronMenu', () => {
    beforeEach(() => {
        electronMockState.reset();
        copyDebugInfoToClipboard.mockClear();
        goDownload.mockClear();
        openFindOverlay.mockClear();
        previewPrintCurrentWindow.mockClear();
        printCurrentWindow.mockClear();
        toShortcutKey.mockClear();
        electronMockState.shell.openExternal.mockClear();
        electronMockState.Menu.buildFromTemplate.mockReturnValue({
            id: 'menu',
        });
    });

    test('builds the application menu and wires tool actions', () => {
        const appController = {
            openAboutPage: vi.fn(),
            openFindPage: vi.fn(),
            mainController: {
                gotoSettingHomePage: vi.fn(),
            },
            lwShareController: {
                open: vi.fn(),
            },
            mainWin: {},
            settingManager: {
                restoreMainBounds: vi.fn(),
            },
        };

        const clickMenu = vi.fn();
        const menusData = {
            tools: [
                {
                    label: 'Khmer Tools',
                    submenu: [
                        {
                            label: 'Editor',
                            clickData: {
                                url: 'https://editor-km.openworship.app',
                            },
                        },
                        {
                            label: 'Open Lyric',
                            clickData: {
                                url: 'https://lyric-km.openworship.app',
                            },
                        },
                        {
                            label: 'BibleNote',
                            clickData: {
                                url: 'https://biblenote-km.openworship.app',
                            },
                        },
                    ],
                },
            ],
        };

        // Custom tool items are now registered per owner key and kept across
        // rebuilds (several renderers contribute their own), so they go in
        // before the menu is built rather than as an argument to initMenu.
        setCustomMenusData('test', {
            menusData: menusData as any,
            clickMenu,
        });
        initMenu(appController as any);

        expect(electronMockState.Menu.buildFromTemplate).toHaveBeenCalledTimes(
            1,
        );
        expect(electronMockState.Menu.setApplicationMenu).toHaveBeenCalledWith({
            id: 'menu',
        });

        const template =
            electronMockState.Menu.buildFromTemplate.mock.calls[0][0];
        const fileMenu = template.find((item: any) => item.label === 'File');
        const printItem = fileMenu.submenu.find(
            (item: any) => item.label === 'Print',
        );
        const printWithoutPreviewItem = fileMenu.submenu.find(
            (item: any) => item.label === 'Print Without Preview',
        );
        const toolsMenu = template.find((item: any) => item.label === 'Tools');
        const copyItem = toolsMenu.submenu.find(
            (item: any) => item.label === 'Copy Debug Info',
        );
        const fontsItem = toolsMenu.submenu.find(
            (item: any) => item.label === 'Google Fonts',
        );
        const khmerToolsMenu = toolsMenu.submenu.find(
            (item: any) => item.label === 'Khmer Tools',
        );
        const editorItem = khmerToolsMenu.submenu.find(
            (item: any) => item.label === 'Editor',
        );
        const openLyricItem = khmerToolsMenu.submenu.find(
            (item: any) => item.label === 'Open Lyric',
        );
        const bibleNoteItem = khmerToolsMenu.submenu.find(
            (item: any) => item.label === 'BibleNote',
        );
        const currentWindow = createMockBrowserWindow();

        printItem.click(undefined, currentWindow);
        printWithoutPreviewItem.click(undefined, currentWindow);
        copyItem.click();
        fontsItem.click();
        editorItem.click();
        openLyricItem.click();
        bibleNoteItem.click();

        expect(previewPrintCurrentWindow).toHaveBeenCalledWith(currentWindow);
        expect(printCurrentWindow).toHaveBeenCalledWith(currentWindow);
        expect(copyDebugInfoToClipboard).toHaveBeenCalledTimes(1);
        expect(electronMockState.shell.openExternal).toHaveBeenCalledWith(
            'https://fonts.google.com/',
        );
        // Custom tool items delegate to the clickMenu handler with their
        // clickData rather than opening links directly.
        expect(clickMenu).toHaveBeenCalledWith({
            url: 'https://editor-km.openworship.app',
        });
        expect(clickMenu).toHaveBeenCalledWith({
            url: 'https://lyric-km.openworship.app',
        });
        expect(clickMenu).toHaveBeenCalledWith({
            url: 'https://biblenote-km.openworship.app',
        });

        setCustomMenusData('test', null);
    });

    test('routes Find to the window the click targets', () => {
        const mainWin = createMockBrowserWindow();
        // An app page gets the pinned find bar; anything else is asked to
        // search in place.
        mainWin.webContents.getURL.mockReturnValue(
            'https://localhost:3000/presenter.html',
        );
        const appController = {
            openAboutPage: vi.fn(),
            mainController: { gotoSettingHomePage: vi.fn() },
            lwShareController: { open: vi.fn() },
            mainWin,
            settingManager: { restoreMainBounds: vi.fn() },
        };
        initMenu(appController as any);

        const template =
            electronMockState.Menu.buildFromTemplate.mock.calls[0][0];
        const editMenu = template.find((item: any) => item.label === 'Edit');
        const findItem = editMenu.submenu.find(
            (item: any) => item.label === 'Find',
        );

        findItem.click(undefined, mainWin);

        expect(openFindOverlay).toHaveBeenCalledWith(mainWin);
        expect(mainWin.webContents.send).not.toHaveBeenCalled();

        // The bible note has its own in-place search and only wants the
        // request; it never gets a pinned bar.
        const popupWin = createMockBrowserWindow();
        popupWin.webContents.getURL.mockReturnValue(
            'https://localhost:3000/bibleNote.html',
        );
        findItem.click(undefined, popupWin);

        expect(openFindOverlay).toHaveBeenCalledTimes(1);
        expect(popupWin.webContents.send).toHaveBeenCalledWith(
            'app:main:menu-item-clicked',
            { isOpenSearch: true },
        );

        // No window handed to the click (macOS with every window minimized)
        // falls back to the focused one rather than dropping the click.
        electronMockState.browserWindows.push(mainWin);
        findItem.click(undefined, undefined);

        expect(openFindOverlay).toHaveBeenCalledTimes(2);
    });

    test('does not send menu clicks to a destroyed window', () => {
        const destroyedWin = createMockBrowserWindow({
            isDestroyed: vi.fn(() => true),
        });

        expect(
            sendMenuClicked({ isOpenSearch: true }, destroyedWin as any),
        ).toBe(false);
        expect(destroyedWin.webContents.send).not.toHaveBeenCalled();
    });

    test('every window, tools, and help action is wired up', async () => {
        const appController = createAppController();
        initMenu(appController as any);
        const template =
            electronMockState.Menu.buildFromTemplate.mock.calls[0][0];

        clickItem(template, 'File', 'Print');
        previewPrintCurrentWindow.mockRejectedValueOnce(
            new Error('no printer'),
        );
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        try {
            clickItem(template, 'File', 'Print');
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(consoleLogSpy).toHaveBeenCalledWith(
                'Print preview failed:',
                expect.any(Error),
            );
        } finally {
            consoleLogSpy.mockRestore();
        }

        clickItem(template, 'Tools', 'Copy Full Debug Info');
        expect(copyDebugInfoToClipboard).toHaveBeenCalledWith(true);

        clickItem(template, 'Tools', 'Local Web Share');
        expect(appController.lwShareController.open).toHaveBeenCalledWith(
            appController.mainWin,
        );

        clickItem(template, 'Window', 'Reset Position and Size');
        expect(
            appController.settingManager.restoreMainBounds,
        ).toHaveBeenCalledWith(appController.mainWin);

        const helpMenu = template.find((item: any) => item.role === 'help');
        clickSubmenuItem(helpMenu, 'Learn More');
        expect(electronMockState.shell.openExternal).toHaveBeenCalledWith(
            expect.stringContaining('openworship'),
        );

        clickSubmenuItem(helpMenu, 'Check for Updates');
        expect(appController.mainController.sendMessage).toHaveBeenCalledWith(
            'main:app:check-update',
        );

        clickSubmenuItem(helpMenu, 'Check for Updates Online');
        expect(goDownload).toHaveBeenCalledTimes(1);
    });

    test('the macOS app menu opens About and Preferences', () => {
        withPlatform('darwin', () => {
            const appController = createAppController();
            initMenu(appController as any);
            const template =
                electronMockState.Menu.buildFromTemplate.mock.calls.at(-1)?.[0];
            const appMenu = template[0];

            clickSubmenuItem(appMenu, 'About Open Worship app');
            expect(appController.openAboutPage).toHaveBeenCalledTimes(1);

            clickSubmenuItem(appMenu, 'Preferences...');
            expect(
                appController.mainController.gotoSettingHomePage,
            ).toHaveBeenCalledTimes(1);
        });
    });

    test('non-macOS gets Settings in Edit and About in Help instead', () => {
        withPlatform('win32', () => {
            const appController = createAppController();
            initMenu(appController as any);
            const template =
                electronMockState.Menu.buildFromTemplate.mock.calls.at(-1)?.[0];

            // no dedicated app menu on Windows/Linux
            expect(template[0].label).toBe('File');

            clickItem(template, 'Edit', 'Settings...');
            expect(
                appController.mainController.gotoSettingHomePage,
            ).toHaveBeenCalledTimes(1);

            const helpMenu = template.find((item: any) => item.role === 'help');
            clickSubmenuItem(helpMenu, 'About Open Worship app');
            expect(appController.openAboutPage).toHaveBeenCalledTimes(1);
        });
    });

    test('the Insert menu exists only while a renderer contributes to it', () => {
        // Nothing registered: the whole top-level menu must be absent rather
        // than present-but-empty, so pages with no canvas do not show a dead
        // Insert menu.
        initMenu(createAppController() as any);
        let template =
            electronMockState.Menu.buildFromTemplate.mock.calls.at(-1)?.[0];
        expect(
            template.find((item: any) => item.label === 'Insert'),
        ).toBeUndefined();

        const insertClick = vi.fn();
        setCustomMenusData('canvas-insert', {
            menusData: {
                insert: [
                    { label: 'New', clickData: { canvasInsert: 'text' } },
                    {
                        label: 'Insert Camera',
                        clickData: { canvasInsert: 'camera' },
                    },
                ],
            } as any,
            clickMenu: insertClick,
        });

        try {
            initMenu(createAppController() as any);
            template =
                electronMockState.Menu.buildFromTemplate.mock.calls.at(-1)?.[0];
            const insertMenu = template.find(
                (item: any) => item.label === 'Insert',
            );
            expect(insertMenu.submenu.map((item: any) => item.label)).toEqual([
                'New',
                'Insert Camera',
            ]);
            // It sits between Edit and View, where an Insert menu belongs.
            const labels = template.map((item: any) => item.label ?? item.role);
            expect(labels.indexOf('Insert')).toBe(labels.indexOf('Edit') + 1);
            expect(labels.indexOf('View')).toBe(labels.indexOf('Insert') + 1);

            clickItem(template, 'Insert', 'Insert Camera');
            expect(insertClick).toHaveBeenCalledWith({
                canvasInsert: 'camera',
            });
        } finally {
            setCustomMenusData('canvas-insert', null);
        }
    });

    test('custom tool items from several renderers are ordered by owner key', () => {
        const firstClick = vi.fn();
        const secondClick = vi.fn();
        setCustomMenusData('zeta', {
            menusData: { tools: [{ label: 'Zeta Tool' }] } as any,
            clickMenu: secondClick,
        });
        setCustomMenusData('alpha', {
            menusData: { tools: [{ label: 'Alpha Tool' }] } as any,
            clickMenu: firstClick,
        });

        try {
            initMenu(createAppController() as any);
            const template =
                electronMockState.Menu.buildFromTemplate.mock.calls.at(-1)?.[0];
            const toolsMenu = template.find(
                (item: any) => item.label === 'Tools',
            );
            const customLabels = toolsMenu.submenu
                .slice(-2)
                .map((item: any) => item.label);

            expect(customLabels).toEqual(['Alpha Tool', 'Zeta Tool']);
        } finally {
            setCustomMenusData('zeta', null);
            setCustomMenusData('alpha', null);
        }
    });
});

function createAppController() {
    return {
        openAboutPage: vi.fn(),
        openFindPage: vi.fn(),
        mainController: {
            gotoSettingHomePage: vi.fn(),
            sendMessage: vi.fn(),
        },
        lwShareController: { open: vi.fn() },
        mainWin: createMockBrowserWindow(),
        settingManager: { restoreMainBounds: vi.fn() },
    };
}

function clickSubmenuItem(menu: any, label: string) {
    const item = menu.submenu.find((entry: any) => entry.label === label);
    if (item === undefined) {
        throw new Error(`No menu item labelled "${label}"`);
    }
    item.click();
}

function clickItem(template: any[], menuLabel: string, itemLabel: string) {
    const menu = template.find((item: any) => item.label === menuLabel);
    if (menu === undefined) {
        throw new Error(`No menu labelled "${menuLabel}"`);
    }
    clickSubmenuItem(menu, itemLabel);
}

// `initMenu` branches on the host platform at call time, so both menu shapes
// have to be exercised regardless of where the suite runs.
function withPlatform(platform: string, callback: () => void) {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', {
        configurable: true,
        value: platform,
    });
    try {
        callback();
    } finally {
        if (descriptor !== undefined) {
            Object.defineProperty(process, 'platform', descriptor);
        }
    }
}
