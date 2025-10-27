import { app, Menu, shell } from 'electron';

import ElectronAppController from './ElectronAppController';
import {
    copyDebugInfoToClipboard,
    goDownload,
    toShortcutKey,
} from './electronHelpers';

import packageInfo from '../package.json';
import appInfo from './client/appInfo';

const findingShortcut = toShortcutKey({
    wControlKey: ['Ctrl'],
    lControlKey: ['Ctrl'],
    mControlKey: ['Meta'],
    key: 'f',
});

export function initMenu(appController: ElectronAppController) {
    const isMac = process.platform === 'darwin';

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
                                  appController.aboutController.open(
                                      appController.mainWin,
                                  );
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
            submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
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
                    click: () => {
                        appController.finderController.open(
                            appController.mainWin,
                        );
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
                    label: 'Reset Position and Size',
                    click: () => {
                        appController.settingController.restoreMainBounds(
                            appController.mainWin,
                        );
                    },
                },
            ],
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: () => {
                        shell.openExternal(packageInfo.homepage);
                    },
                },
                {
                    label: 'Check for Updates',
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
                                  appController.aboutController.open(
                                      appController.mainWin,
                                  );
                              },
                          },
                      ]),
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
