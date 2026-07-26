import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    copyDebugInfoToClipboard,
    goDownload,
    previewPrintCurrentWindow,
    printCurrentWindow,
    toShortcutKey,
} = vi.hoisted(() => ({
    copyDebugInfoToClipboard: vi.fn(),
    goDownload: vi.fn(),
    previewPrintCurrentWindow: vi.fn(async () => undefined),
    printCurrentWindow: vi.fn(),
    toShortcutKey: vi.fn(() => 'CmdOrCtrl+F'),
}));

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

    test('routes Find to the finder for the main window only', () => {
        const mainWin = createMockBrowserWindow();
        const appController = {
            openAboutPage: vi.fn(),
            openFindPage: vi.fn(),
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

        expect(appController.openFindPage).toHaveBeenCalledTimes(1);
        expect(mainWin.webContents.send).not.toHaveBeenCalled();

        // Any other window searches in place instead of opening the finder
        // popup, which only the main window owns.
        const popupWin = createMockBrowserWindow();
        findItem.click(undefined, popupWin);

        expect(appController.openFindPage).toHaveBeenCalledTimes(1);
        expect(popupWin.webContents.send).toHaveBeenCalledWith(
            'app:main:menu-item-clicked',
            { isOpenSearch: true },
        );

        // No focused window at all (macOS with every window minimized) still
        // falls back to the main window rather than dropping the click.
        findItem.click(undefined, undefined);

        expect(appController.openFindPage).toHaveBeenCalledTimes(2);
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
});
