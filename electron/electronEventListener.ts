import electron, { FileFilter, nativeTheme, shell } from 'electron';
import fontList from 'font-list';

import ElectronAppController from './ElectronAppController';
import { attemptClosing, goDownload, tarExtract } from './electronHelpers';
import ElectronScreenController from './ElectronScreenController';
import { officeFileToPdf } from './electronOfficeHelpers';
import { getPagesCount, pdfToImages } from './pdfToImagesHelpers';

const { dialog, ipcMain, app } = electron;
const cache: { [key: string]: any } = {
    fontsMap: null,
};

export type AnyObjectType = {
    [key: string]: any;
};

export type ScreenMessageType = {
    screenId: number;
    type: string;
    data: AnyObjectType;
};
type ShowScreenDataType = {
    screenId: number;
    displayId: number;
    replyEventName: string;
};

export const channels = {
    screenMessageChannel: 'app:screen:message',
};

export function initEventListenerApp(appController: ElectronAppController) {
    ipcMain.handle('get-is-packaged', () => {
        return app.isPackaged;
    });
    ipcMain.handle('get-app-path', () => {
        return app.getAppPath();
    });

    ipcMain.on('main:app:get-data-path', (event) => {
        event.returnValue = app.getPath('userData');
    });

    ipcMain.on('main:app:get-desktop-path', (event) => {
        event.returnValue = app.getPath('desktop');
    });

    ipcMain.on('main:app:get-temp-path', (event) => {
        event.returnValue = app.getPath('temp');
    });

    ipcMain.on('main:app:select-dirs', async (event) => {
        const result = await dialog.showOpenDialog(appController.mainWin, {
            properties: ['openDirectory'],
        });
        event.returnValue = result.filePaths;
    });

    ipcMain.on(
        'main:app:select-files',
        async (event, filters?: FileFilter[]) => {
            const result = await dialog.showOpenDialog(appController.mainWin, {
                properties: ['openFile', 'multiSelections'],
                filters,
            });
            event.returnValue = result.filePaths;
        },
    );
}

export function initEventScreen(appController: ElectronAppController) {
    ipcMain.on('main:app:get-displays', (event) => {
        event.returnValue = {
            primaryDisplay: appController.settingManager.primaryDisplay,
            displays: appController.settingManager.allDisplays,
        };
    });

    ipcMain.on('main:app:get-screens', (event) => {
        event.returnValue = ElectronScreenController.getAllIds();
    });

    // TODO: use shareProps.mainWin.on or shareProps.screenWin.on
    ipcMain.on('main:app:show-screen', (event, data: ShowScreenDataType) => {
        const screenController = ElectronScreenController.createInstance(
            data.screenId,
        );
        const display = appController.settingManager.getDisplayById(
            data.displayId,
        );
        if (display !== undefined) {
            screenController.listenLoading().then(() => {
                appController.mainController.sendData(data.replyEventName);
            });
            screenController.setDisplay(display);
            appController.mainWin.focus();
        }
        screenController.win.on('close', () => {
            screenController.destroyInstance();
            appController.mainController.sendNotifyInvisibility(data.screenId);
        });
        event.returnValue = Promise.resolve('hello');
    });

    ipcMain.on('app:hide-screen', (_, screenId: number) => {
        const screenController = ElectronScreenController.getInstance(screenId);
        if (screenController === null) {
            return;
        }
        attemptClosing(screenController);
        screenController.destroyInstance();
    });
    ipcMain.on('app:hide-all-screens', () => {
        ElectronScreenController.closeAll();
    });

    ipcMain.on(
        'main:app:set-screen-display',
        (
            _event,
            {
                screenId,
                displayId,
            }: {
                screenId: number;
                displayId: number;
            },
        ) => {
            const display =
                appController.settingManager.getDisplayById(displayId);
            const screenController =
                ElectronScreenController.getInstance(screenId);
            if (display !== undefined && screenController !== null) {
                screenController.setDisplay(display);
            }
        },
    );

    ipcMain.on(
        channels.screenMessageChannel,
        async (
            event,
            {
                type,
                screenId,
                isScreen,
                data,
            }: ScreenMessageType & { isScreen: boolean },
        ) => {
            if (isScreen) {
                appController.mainController.sendMessage({
                    screenId,
                    type,
                    data,
                });
            } else {
                const screenController =
                    ElectronScreenController.getInstance(screenId);
                if (screenController !== null) {
                    screenController.sendMessage(type, data);
                }
            }
            event.returnValue = true;
        },
    );

    ipcMain.on('screen:app:change-bible', (_, isNext) => {
        appController.mainController.changeBible(isNext);
    });
    ipcMain.on('screen:app:ctrl-scrolling', (_, isUp) => {
        appController.mainController.ctrlScrolling(isUp);
    });
}

export function initEventFinder(appController: ElectronAppController) {
    ipcMain.on('main:app:open-finder', () => {
        appController.finderController.open(appController.mainWin);
    });

    ipcMain.on('finder:app:close-finder', () => {
        attemptClosing(appController.finderController);
    });

    const mainWinWebContents = appController.mainWin.webContents;
    ipcMain.on(
        'finder:app:search-in-page',
        (
            event,
            searchText: string,
            options: {
                forward?: boolean;
                findNext?: boolean;
                matchCase?: boolean;
            } = {},
        ) => {
            event.returnValue = mainWinWebContents.findInPage(
                searchText,
                options,
            );
        },
    );
    ipcMain.on(
        'finder:app:stop-search-in-page',
        (
            _,
            action: 'clearSelection' | 'keepSelection' | 'activateSelection',
        ) => {
            mainWinWebContents.stopFindInPage(action);
        },
    );
}

export function initEventOther(appController: ElectronAppController) {
    ipcMain.on(
        'main:app:tar-extract',
        async (
            _,
            {
                replyEventName,
                filePath,
                outputDir,
            }: {
                replyEventName: string;
                filePath: string;
                outputDir: string;
            },
        ) => {
            await tarExtract(filePath, outputDir);
            appController.mainController.sendData(replyEventName);
        },
    );

    ipcMain.on('main:app:get-font-list', async (event) => {
        if (cache.fontsMap !== null) {
            event.returnValue = cache.fontsMap;
        }
        try {
            const fonts = await fontList.getFonts({ disableQuoting: true });
            const fontsMap = Object.fromEntries(
                fonts.map((fontName) => {
                    return [fontName, []];
                }),
            );
            event.returnValue = fontsMap;
            cache.fontsMap = fontsMap;
        } catch (error) {
            console.log(error);
            event.returnValue = null;
        }
    });

    ipcMain.on('main:app:reveal-path', (_, path: string) => {
        shell.showItemInFolder(path);
    });

    ipcMain.on(
        'main:app:trash-path',
        async (
            _,
            data: {
                path: string;
                replyEventName: string;
            },
        ) => {
            await shell.trashItem(data.path);
            appController.mainController.sendData(data.replyEventName);
        },
    );

    ipcMain.on('main:app:preview-pdf', (_, pdfFilePath: string) => {
        appController.mainController.previewPdf(pdfFilePath);
    });
    ipcMain.on(
        'main:app:convert-to-pdf',
        async (
            _event,
            {
                replyEventName,
                officeFilePath,
                pdfFilePath,
            }: {
                replyEventName: string;
                officeFilePath: string;
                pdfFilePath: string;
            },
        ) => {
            const error = await officeFileToPdf(officeFilePath, pdfFilePath);
            if (error !== null) {
                appController.mainController.sendData(replyEventName, error);
            } else {
                appController.mainController.sendData(replyEventName);
            }
        },
    );

    ipcMain.on(
        'main:app:pdf-to-images',
        async (
            _event,
            {
                replyEventName,
                filePath,
                outDir,
                isForce,
            }: {
                replyEventName: string;
                filePath: string;
                outDir: string;
                isForce: boolean;
            },
        ) => {
            const data = await pdfToImages(filePath, outDir, isForce);
            appController.mainController.sendData(replyEventName, data);
        },
    );

    ipcMain.on(
        'main:app:pdf-pages-count',
        async (
            _event,
            {
                replyEventName,
                filePath,
            }: {
                replyEventName: string;
                filePath: string;
            },
        ) => {
            const data = await getPagesCount(filePath);
            appController.mainController.sendData(replyEventName, data);
        },
    );

    ipcMain.on('main:app:go-download', () => {
        goDownload();
    });

    ipcMain.on(
        'main:app:set-theme',
        (_event, theme: 'dark' | 'light' | 'system') => {
            nativeTheme.themeSource = theme;
            appController.resetThemeBackgroundColor();
        },
    );
}
