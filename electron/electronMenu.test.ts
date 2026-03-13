import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const { copyDebugInfoToClipboard, goDownload, toShortcutKey } = vi.hoisted(
    () => ({
        copyDebugInfoToClipboard: vi.fn(),
        goDownload: vi.fn(),
        toShortcutKey: vi.fn(() => 'CmdOrCtrl+F'),
    }),
);

vi.mock('./electronHelpers', () => ({
    copyDebugInfoToClipboard,
    goDownload,
    toShortcutKey,
}));

vi.mock('./client/appInfo', () => ({
    default: {
        title: 'Open Worship app',
    },
}));

import { initMenu } from './electronMenu';
import { electronMockState } from './testElectronModule';

describe('electronMenu', () => {
    beforeEach(() => {
        electronMockState.reset();
        copyDebugInfoToClipboard.mockClear();
        goDownload.mockClear();
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

        initMenu(appController as any);

        expect(electronMockState.Menu.buildFromTemplate).toHaveBeenCalledTimes(
            1,
        );
        expect(electronMockState.Menu.setApplicationMenu).toHaveBeenCalledWith({
            id: 'menu',
        });

        const template =
            electronMockState.Menu.buildFromTemplate.mock.calls[0][0];
        const toolsMenu = template.find((item: any) => item.label === 'Tools');
        const copyItem = toolsMenu.submenu.find(
            (item: any) => item.label === 'Copy Debug Info',
        );
        const fontsItem = toolsMenu.submenu.find(
            (item: any) => item.label === 'Google Fonts',
        );

        copyItem.click();
        fontsItem.click();

        expect(copyDebugInfoToClipboard).toHaveBeenCalledTimes(1);
        expect(electronMockState.shell.openExternal).toHaveBeenCalledWith(
            'https://fonts.google.com/',
        );
    });
});
