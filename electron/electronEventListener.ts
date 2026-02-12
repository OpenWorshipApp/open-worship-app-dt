import electron, {
    FileFilter,
    IpcMain,
    nativeTheme,
    shell,
    systemPreferences,
} from 'electron';

import ElectronAppController from './ElectronAppController';
import {
    attemptClosing,
    goDownload,
    isMac,
    printHTMLContent,
    tarExtract,
} from './electronHelpers';
import ElectronScreenController from './ElectronScreenController';
import { officeFileToPdf } from './electronOfficeHelpers';
import { getPagesCount, pdfToImages } from './pdfToImagesHelpers';
import {
    countSlides,
    exportBibleMSWord,
    removeSlideBackground,
} from './msHelpers';

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

function onAsync<T1, T2>(
    ipc: IpcMain,
    eventName: string,
    callee: (data: T1) => Promise<T2>,
): void {
    ipc.on(eventName, async (event, data: T1) => {
        const replyEventName = (data as any).replyEventName;
        if (!replyEventName) {
            throw new Error('replyEventName is required');
        }
        const result = await callee(data);
        event.sender.send(replyEventName, result);
    });
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
    onAsync(
        ipcMain,
        'main:app:show-screen',
        async (data: ShowScreenDataType) => {
            const screenController = ElectronScreenController.createInstance(
                data.screenId,
            );
            const display = appController.settingManager.getDisplayById(
                data.displayId,
            );
            if (display !== undefined) {
                await screenController.listenLoading();
                screenController.setDisplay(display);
                appController.mainWin.focus();
            }
            screenController.win.on('close', () => {
                screenController.destroyInstance();
                appController.mainController.sendNotifyInvisibility(
                    data.screenId,
                );
            });
        },
    );

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
    ipcMain.on('finder:app:close-finder', () => {
        attemptClosing(appController.finderController);
    });

    ipcMain.on('main:app:open-setting', () => {
        appController.settingController.open(
            appController.mainWin,
            appController.settingManager,
        );
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
    onAsync(
        ipcMain,
        'main:app:tar-extract',
        (data: { filePath: string; outputDir: string }) => {
            return tarExtract(data.filePath, data.outputDir);
        },
    );

    ipcMain.on('main:app:get-font-list', async (event) => {
        if (cache.fontsMap !== null) {
            event.returnValue = cache.fontsMap;
        }
        try {
            const fontList = await import('font-list');
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

    onAsync(ipcMain, 'main:app:trash-path', (data: { path: string }) => {
        return shell.trashItem(data.path);
    });

    ipcMain.on('main:app:preview-pdf', (_, pdfFilePath: string) => {
        appController.mainController.previewPdf(pdfFilePath);
    });
    onAsync(
        ipcMain,
        'main:app:convert-to-pdf',
        (data: { officeFilePath: string; pdfFilePath: string }) => {
            return officeFileToPdf(data.officeFilePath, data.pdfFilePath);
        },
    );

    onAsync(
        ipcMain,
        'main:app:pdf-to-images',
        (data: { filePath: string; outDir: string; isForce: boolean }) => {
            return pdfToImages(data.filePath, data.outDir, data.isForce);
        },
    );

    onAsync(
        ipcMain,
        'main:app:pdf-pages-count',
        (data: { filePath: string }) => {
            return getPagesCount(data.filePath);
        },
    );

    ipcMain.on('main:app:go-download', () => {
        goDownload();
    });

    ipcMain.on(
        'main:app:set-theme',
        (_event, theme: 'dark' | 'light' | 'system') => {
            if (
                ['dark', 'light', 'system'].includes(theme) === false ||
                nativeTheme.themeSource === theme
            ) {
                return;
            }
            appController.settingManager.themeSource = theme;
            appController.resetThemeBackgroundColor();
        },
    );
    ipcMain.on('main:app:get-theme', (event) => {
        event.returnValue = appController.settingManager.themeSource;
    });

    onAsync(ipcMain, 'main:app:ask-camera-access', async () => {
        if (!isMac) {
            return true;
        }
        try {
            const access = await systemPreferences.askForMediaAccess('camera');
            console.log('Camera access:', access);
            return access;
        } catch (error) {
            console.error('Camera access error:', error);
        }
        return false;
    });

    ipcMain.on('all:app:force-reload', () => {
        appController.reloadAll();
    });

    ipcMain.on('all:app:print', (_event, htmlText: string) => {
        printHTMLContent(htmlText);
    });

    onAsync(
        ipcMain,
        'main:app:ms-pp-slides-count',
        (data: { filePath: string; dotNetRoot?: string }) => {
            return countSlides(data.filePath, data.dotNetRoot);
        },
    );
    onAsync(
        ipcMain,
        'main:app:ms-pp-remove-slides-bg',
        (data: { filePath: string; dotNetRoot?: string }) => {
            return removeSlideBackground(data.filePath, data.dotNetRoot);
        },
    );
    onAsync(
        ipcMain,
        'main:app:ms-word-export-bible',
        (data: { filePath: string; data: object[]; dotNetRoot?: string }) => {
            return exportBibleMSWord(data.filePath, data.data, data.dotNetRoot);
        },
    );
}
