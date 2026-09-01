import {
    app,
    BrowserWindow,
    Menu,
    shell,
    type MenuItemConstructorOptions,
} from 'electron';

import type ElectronAppController from './ElectronAppController';
import { checkIsAiEnabled } from './aiHelpers';
import {
    copyDebugInfoToClipboard,
    goDownload,
    previewPrintCurrentWindow,
    printCurrentWindow,
    toShortcutKey,
    type CustomMenusDataType,
    type CustomMenuItemType,
} from './electronHelpers';

import {
    checkIsFindOverlayHost,
    openFindOverlay,
} from './finderOverlayHelpers';
import {
    RESET_WINDOW_BOUNDS_LABEL,
    resetWindowsBounds,
} from './taskbarHelpers';

import packageInfo from '../package.json';
import appInfo from './client/appInfo';

const findingShortcut = toShortcutKey({
    wControlKey: ['Ctrl'],
    lControlKey: ['Ctrl'],
    mControlKey: ['Meta'],
    key: 'f',
});

const printShortcut = toShortcutKey({
    wControlKey: ['Ctrl'],
    lControlKey: ['Ctrl'],
    mControlKey: ['Meta'],
    key: 'p',
});

function formatMenuItems(
    items: CustomMenuItemType[],
    clickHandler: (clickData: any) => void,
) {
    const genItems: MenuItemConstructorOptions[] = items
        .filter((item) => {
            return item.label !== undefined && item.label.trim() !== '';
        })
        .map((item) => {
            const submenu = item.submenu;
            let genSubmenu: MenuItemConstructorOptions[] | undefined;
            if (submenu !== undefined) {
                genSubmenu = formatMenuItems(submenu, clickHandler);
            }
            const clickData = item.clickData;
            delete item.clickData;
            return {
                ...item,
                submenu: genSubmenu,
                click: () => {
                    clickHandler(clickData);
                },
            };
        });
    return genItems;
}

type CustomMenusDataEntryType = {
    menusData: CustomMenusDataType;
    clickMenu: (clickData: any) => void;
};
const customMenusData: {
    [key: string]: CustomMenusDataEntryType;
} = {};
export function setCustomMenusData(
    key: string,
    data: CustomMenusDataEntryType | null,
) {
    if (data === null) {
        delete customMenusData[key];
    } else {
        customMenusData[key] = data;
    }
}

export function sendMenuClicked(menuData: any, win?: BrowserWindow | null) {
    const targetWin = win ?? BrowserWindow.getFocusedWindow();
    // The owner window may already be gone (a popup that registered its own
    // menu items and was then closed); touching `webContents` on a destroyed
    // window throws.
    if (targetWin === null || targetWin.isDestroyed()) {
        return false;
    }
    targetWin.webContents.send('app:main:menu-item-clicked', menuData);
    return true;
}

function getCustomMenuItems(key: string) {
    const items = Object.entries(customMenusData)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([_, value]) => {
            return value;
        });
    const menuItems = items.flatMap(({ menusData = {}, clickMenu }) => {
        let data =
            (menusData as Record<string, CustomMenuItemType[]>)[key] || [];
        data = JSON.parse(JSON.stringify(data));
        return formatMenuItems(data, clickMenu);
    });
    return menuItems;
}

export function initMenu(appController: ElectronAppController) {
    const isMac = process.platform === 'darwin';
    const fileMenuItems = getCustomMenuItems('file');
    const insertMenuItems = getCustomMenuItems('insert');
    const viewMenuItems = getCustomMenuItems('view');

    const template: any[] = [
        // { role: 'appMenu' }
        ...(isMac
            ? [
                  {
                      label: app.name,
                      submenu: [
                          {
                              label: `About ${appInfo.title}`,
                              click: () => {
                                  appController.openAboutPage();
                              },
                          },
                          { type: 'separator' },
                          {
                              label: 'Preferences...',
                              click: () => {
                                  appController.mainController.gotoSettingHomePage();
                              },
                          },
                          { type: 'separator' },
                          { role: 'services' },
                          { type: 'separator' },
                          { role: 'hide' },
                          { role: 'hideOthers' },
                          { role: 'unhide' },
                          { type: 'separator' },
                          { role: 'quit' },
                      ],
                  },
              ]
            : []),
        // { role: 'fileMenu' }
        {
            label: 'File',
            submenu: [
                {
                    label: 'Print',
                    accelerator: printShortcut,
                    click: (
                        _menuItem: unknown,
                        browserWindow?: BrowserWindow,
                    ) => {
                        void previewPrintCurrentWindow(browserWindow).catch(
                            (error) => {
                                console.log('Print preview failed:', error);
                            },
                        );
                    },
                },
                {
                    label: 'Print Without Preview',
                    click: (
                        _menuItem: unknown,
                        browserWindow?: BrowserWindow,
                    ) => {
                        printCurrentWindow(browserWindow);
                    },
                },
                // Renderer-owned entries (Export/Import Data). Same mechanism
                // the Tools menu uses for the language packs' own items, so the
                // labels are translated where `tran` actually works.
                ...(fileMenuItems.length === 0
                    ? []
                    : [{ type: 'separator' }, ...fileMenuItems]),
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' },
            ],
        },
        // { role: 'editMenu' }
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                {
                    label: `Find`,
                    // Every window searches in place. App pages get the find
                    // bar pinned into the window as its own `WebContentsView`
                    // (`openFindOverlay`); the bible note has its own in-page
                    // search and only wants the request. Use the window
                    // electron hands the click, not `getFocusedWindow()` — it
                    // is the window the menu action actually targets.
                    click: (
                        _menuItem: unknown,
                        browserWindow?: BrowserWindow,
                    ) => {
                        const targetWin =
                            browserWindow ?? BrowserWindow.getFocusedWindow();
                        if (targetWin === null) {
                            return;
                        }
                        if (checkIsFindOverlayHost(targetWin)) {
                            openFindOverlay(targetWin);
                            return;
                        }
                        sendMenuClicked({ isOpenSearch: true }, targetWin);
                    },
                    accelerator: findingShortcut,
                },
                ...(isMac
                    ? [
                          { role: 'pasteAndMatchStyle' },
                          { role: 'delete' },
                          { role: 'selectAll' },
                          { type: 'separator' },
                          {
                              label: 'Speech',
                              submenu: [
                                  { role: 'startSpeaking' },
                                  { role: 'stopSpeaking' },
                              ],
                          },
                      ]
                    : [
                          { role: 'delete' },
                          { type: 'separator' },
                          { role: 'selectAll' },
                          { type: 'separator' },
                          {
                              label: 'Settings...',
                              click: () => {
                                  appController.mainController.gotoSettingHomePage();
                              },
                          },
                          { type: 'separator' },
                      ]),
            ],
        },
        // Entirely renderer-owned: the slide editor contributes what can be
        // added to a canvas, so the whole menu is absent on pages that have no
        // canvas rather than sitting there empty and dead.
        ...(insertMenuItems.length === 0
            ? []
            : [{ label: 'Insert', submenu: insertMenuItems }]),
        // { role: 'viewMenu' }
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                // Renderer-owned entries (the widget open/close checkboxes and
                // `Reset Widgets Size`). Same mechanism the File and Tools menus
                // use, so the labels are translated where `tran` actually works.
                ...(viewMenuItems.length === 0
                    ? []
                    : [{ type: 'separator' }, ...viewMenuItems]),
            ],
        },
        {
            label: 'Tools',
            submenu: [
                {
                    label: 'Copy Debug Info',
                    click: () => {
                        copyDebugInfoToClipboard();
                    },
                },
                {
                    label: 'Copy Full Debug Info',
                    click: () => {
                        copyDebugInfoToClipboard(true);
                    },
                },
                {
                    label: 'Local Web Share',
                    click: () => {
                        appController.lwShareController.open(
                            appController.mainWin,
                        );
                    },
                },
                {
                    label: 'Google Fonts',
                    click: () => {
                        shell.openExternal('https://fonts.google.com/');
                    },
                },
                ...getCustomMenuItems('tools'),
            ],
        },
        // { role: 'windowMenu' }
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac
                    ? [
                          { type: 'separator' },
                          { role: 'front' },
                          { type: 'separator' },
                          { role: 'window' },
                      ]
                    : [{ role: 'close' }]),
                {
                    // shared with the taskbar jump list task so the two entries
                    // can never drift apart
                    label: RESET_WINDOW_BOUNDS_LABEL,
                    click: () => {
                        resetWindowsBounds(appController);
                    },
                },
            ],
        },
        {
            role: 'help',
            submenu: [
                // Hidden outright when AI is switched off in Settings ->
                // Others: the window it opens would have nothing to talk to.
                ...(checkIsAiEnabled()
                    ? [
                          {
                              label: 'App Help (Chatbot)',
                              click: () => {
                                  appController.openChatbotPage();
                              },
                          },
                          { type: 'separator' },
                      ]
                    : []),
                {
                    label: 'Learn More',
                    click: () => {
                        shell.openExternal(packageInfo.homepage);
                    },
                },
                {
                    label: 'Check for Updates',
                    click: () => {
                        appController.mainController.sendMessage(
                            'main:app:check-update',
                        );
                    },
                },
                {
                    label: 'Check for Updates Online',
                    click: () => {
                        goDownload();
                    },
                },
                ...(isMac
                    ? []
                    : [
                          { type: 'separator' },
                          {
                              label: `About ${appInfo.title}`,
                              click: () => {
                                  appController.openAboutPage();
                              },
                          },
                      ]),
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
