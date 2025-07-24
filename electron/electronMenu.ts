import { app, Menu, shell } from 'electron';

import ElectronAppController from './ElectronAppController';
import { goDownload, toShortcutKey } from './electronHelpers';

import appInfo from '../package.json';

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
                          { role: 'about' },
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
                        shell.openExternal(appInfo.homepage);
                    },
                },
                {
                    label: 'Check for Updates',
                    click: () => {
                        goDownload();
                    },
                },
                ...(isMac ? [] : [{ role: 'about' }]),
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
