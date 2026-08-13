import path from 'node:path';
import electron, {
    BrowserWindow,
    type FileFilter,
    type IpcMain,
    nativeTheme,
    shell,
    systemPreferences,
    type WebContents,
} from 'electron';

import type ElectronAppController from './ElectronAppController';
import {
    checkIsEncryptedFile,
    decryptFile,
    encryptFile,
} from './archiveCryptoHelpers';
import {
    attemptClosing,
    captureWebScreenShot,
    goDownload,
    isMac,
    messageChannels,
    previewPrintCurrentWindow,
    printHTMLContent,
    tarAppend,
    tarCreate,
    tarExtract,
} from './electronHelpers';
import type { CustomMenusDataType, OptionalPromise } from './electronHelpers';
import {
    closeFindOverlay,
    getFindOverlayHostWebContents,
    getFindOverlayWebContents,
    startFindOverlayDragging,
    stopFindOverlayDragging,
} from './finderOverlayHelpers';
import ElectronScreenController from './ElectronScreenController';
import { officeFileToPdf } from './electronOfficeHelpers';
import { getPagesCount, pdfToImages } from './pdfToImagesHelpers';
import {
    docxToHtmls,
    getDocxToHtmlsVersion,
    pptxToHtmls,
    getPptxToHtmlsVersion,
    getPptxSlidesCount,
    type DocxToHtmlsParamsType,
    type PptxToHtmlsParamsType,
} from './msHelpers';
import { initMenu, sendMenuClicked, setCustomMenusData } from './electronMenu';

const { dialog, ipcMain, app } = electron;

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

// Enumerating system fonts spawns PowerShell (Windows) / a shell helper on the
// first call, which can take several seconds while the OS cold-loads its font
// APIs. Cache the result for the whole app run so it happens once regardless of
// how many windows/dropdowns request it (each renderer only caches per-window).
let cachedFontListMap: Record<string, string[]> | null = null;
async function getFontListMap() {
    if (cachedFontListMap !== null) {
        return cachedFontListMap;
    }
    try {
        const fontList = await import('font-list');
        const fonts = await fontList.getFonts({ disableQuoting: true });
        cachedFontListMap = Object.fromEntries(
            fonts.map((fontName) => {
                return [fontName, []];
            }),
        );
        return cachedFontListMap;
    } catch (error) {
        console.log(error);
    }
    return null;
}

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

    ipcMain.on('main:app:get-app-path', (event) => {
        event.returnValue = app.getAppPath();
    });

    ipcMain.on(
        'main:app:get-special-path',
        (
            event,
            name:
                | 'desktop'
                | 'downloads'
                | 'home'
                | 'appData'
                | 'assets'
                | 'userData'
                | 'sessionData'
                | 'temp'
                | 'exe'
                | 'module'
                | 'documents'
                | 'music'
                | 'pictures'
                | 'videos'
                | 'recent'
                | 'logs'
                | 'crashDumps',
        ) => {
            event.returnValue = app.getPath(name);
        },
    );

    ipcMain.on('main:app:get-temp-path', (event) => {
        event.returnValue = app.getPath('temp');
    });

    onAsync(ipcMain, 'main:app:select-dirs', async () => {
        const result = await dialog.showOpenDialog(appController.mainWin, {
            properties: ['openDirectory'],
        });
        return result.filePaths;
    });

    onAsync(
        ipcMain,
        'main:app:select-files',
        async ({ filters }: { filters?: FileFilter[] }) => {
            const result = await dialog.showOpenDialog(appController.mainWin, {
                properties: ['openFile', 'multiSelections'],
                filters,
            });
            return result.filePaths;
        },
    );
}

function onAsync<T1, T2>(
    ipc: IpcMain,
    eventName: string,
    callee: (data: T1) => OptionalPromise<T2>,
): void {
    ipc.on(eventName, async (event, data: T1) => {
        const replyEventName = (data as any)?.replyEventName;
        if (!replyEventName) {
            console.error(`${eventName}: replyEventName is required`);
            return;
        }
        // Always reply — a missing reply leaves the renderer's awaiting
        // promise pending forever (stuck progress bars, silent failures).
        // The renderer rejects when the reply is an Error instance.
        let result: T2 | Error;
        try {
            result = await callee(data);
        } catch (error) {
            console.error(`${eventName}:`, error);
            result = error instanceof Error ? error : new Error(String(error));
        }
        try {
            event.sender.send(replyEventName, result);
        } catch (error) {
            console.error(`${eventName}: failed to reply`, error);
        }
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
            const isNewInstance =
                ElectronScreenController.getInstance(data.screenId) === null;
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
            // Attach only once — createInstance returns a cached controller,
            // and stacking a listener per show call duplicates the notify.
            if (isNewInstance) {
                screenController.win.on('close', () => {
                    screenController.destroyInstance();
                    appController.mainController.sendNotifyInvisibility(
                        data.screenId,
                    );
                });
            }
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
        messageChannels.screenMessage,
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
                appController.mainController.sendScreenMessage({
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

    ipcMain.on(
        'screen:app:change-bible',
        (_, data: { screenId: number; isNext: boolean }) => {
            appController.mainController.changeBible(data);
        },
    );
}

// The find bar drives the page of the window it is pinned to -- never a fan-out
// over every open window, which used to highlight matches in windows the
// operator was not even looking at.
const foundInPageTrackedContents = new WeakSet<WebContents>();

function trackFoundInPage(hostWebContents: WebContents) {
    if (foundInPageTrackedContents.has(hostWebContents)) {
        return;
    }
    foundInPageTrackedContents.add(hostWebContents);
    hostWebContents.on('found-in-page', (_event, result) => {
        const overlayWebContents =
            getFindOverlayWebContents(hostWebContents) ?? null;
        if (overlayWebContents === null || overlayWebContents.isDestroyed()) {
            return;
        }
        overlayWebContents.send('main:app:found-in-page', {
            activeMatchOrdinal: result.activeMatchOrdinal,
            matches: result.matches,
            finalUpdate: result.finalUpdate,
        });
    });
}

export function initFinderEvent() {
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
            const hostWebContents = getFindOverlayHostWebContents(event.sender);
            if (hostWebContents === null) {
                return;
            }
            trackFoundInPage(hostWebContents);
            hostWebContents.findInPage(searchText, options);
        },
    );
    ipcMain.on(
        'finder:app:stop-search-in-page',
        (
            event,
            action: 'clearSelection' | 'keepSelection' | 'activateSelection',
        ) => {
            getFindOverlayHostWebContents(event.sender)?.stopFindInPage(action);
        },
    );
    ipcMain.on('finder:app:close', (event) => {
        closeFindOverlay(event.sender);
    });
    ipcMain.on('finder:app:drag-start', (event, grabOffsetX: number) => {
        startFindOverlayDragging(event.sender, grabOffsetX);
    });
    ipcMain.on('finder:app:drag-stop', (event) => {
        stopFindOverlayDragging(event.sender);
    });
}

export function initEventOther(appController: ElectronAppController) {
    onAsync(
        ipcMain,
        'main:app:tar-extract',
        (data: { filePath: string; outputDir: string; entries?: string[] }) => {
            return tarExtract(data.filePath, data.outputDir, data.entries);
        },
    );

    onAsync(
        ipcMain,
        'main:app:tar-create',
        (data: {
            inputDir: string;
            outputFilePath: string;
            files: string[];
            isGzip?: boolean;
            excludeNamePatterns?: string[];
        }) => {
            return tarCreate(
                data.inputDir,
                data.outputFilePath,
                data.files,
                data.isGzip,
                data.excludeNamePatterns,
            );
        },
    );

    onAsync(
        ipcMain,
        'main:app:tar-append',
        (data: {
            archiveFilePath: string;
            inputDir: string;
            files: string[];
        }) => {
            return tarAppend(data.archiveFilePath, data.inputDir, data.files);
        },
    );

    // Password protection for an exported archive. It runs here rather than in
    // the renderer so the bytes never cross the bridge: an archive can be
    // gigabytes, and both directions stream straight from disk to disk.
    onAsync(
        ipcMain,
        'main:app:file-encrypt',
        (data: {
            filePath: string;
            outputFilePath: string;
            password: string;
        }) => {
            return encryptFile(
                data.filePath,
                data.outputFilePath,
                data.password,
            );
        },
    );

    onAsync(
        ipcMain,
        'main:app:file-decrypt',
        (data: {
            filePath: string;
            outputFilePath: string;
            password: string;
        }) => {
            return decryptFile(
                data.filePath,
                data.outputFilePath,
                data.password,
            );
        },
    );

    onAsync(
        ipcMain,
        'main:app:check-is-encrypted-file',
        (data: { filePath: string }) => {
            return checkIsEncryptedFile(data.filePath);
        },
    );

    onAsync(ipcMain, 'main:app:get-font-list', async () => {
        return await getFontListMap();
    });
    // Prewarm the font list so the first font dropdown doesn't pay the cold cost.
    void getFontListMap();

    ipcMain.on('main:app:reveal-path', (_, filePath: string) => {
        if (typeof filePath !== 'string' || filePath.length === 0) {
            return;
        }
        const resolvedFilePath = path.resolve(filePath);
        shell.showItemInFolder(resolvedFilePath);
    });

    onAsync(ipcMain, 'main:app:trash-path', async (data: { path: string }) => {
        if (typeof data.path !== 'string' || data.path.length === 0) {
            return false;
        }
        const resolvedFilePath = path.resolve(data.path);
        for (let i = 0; i < 5; i++) {
            try {
                await shell.trashItem(resolvedFilePath);
                return true;
            } catch (error) {
                console.error('Error trashing item:', error);
            }
            console.log('Retrying trashing item:', resolvedFilePath);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        return false;
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
            const mainDisplay = appController.settingManager.primaryDisplay;
            return pdfToImages(
                data.filePath,
                data.outDir,
                mainDisplay.size.width,
                data.isForce,
            );
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

    // The media download found the pack missing (or just installed it) in one
    // renderer; the Settings window it is about to raise has to re-read.
    ipcMain.on('all:app:extra-bin-changed', () => {
        appController.sendMessageToAll('main:app:extra-bin-changed');
    });

    ipcMain.on('all:app:print', (event, htmlText?: string) => {
        if (typeof htmlText === 'string') {
            void printHTMLContent(htmlText).catch((error) => {
                console.error('Print content failed:', error);
            });
            return;
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        void previewPrintCurrentWindow(win).catch((error) => {
            console.error('Print preview failed:', error);
        });
    });

    ipcMain.on('all:app:log', (_event, messages: any[]) => {
        console.log(...messages);
    });

    ipcMain.on('all:app:get-zoom-factor', (event) => {
        event.returnValue = appController.mainWin.webContents.getZoomFactor();
    });

    onAsync(
        ipcMain,
        'main:app:ms-pp-slides-count',
        (data: { filePath: string }) => {
            const slidesCount = getPptxSlidesCount(data.filePath);
            return slidesCount;
        },
    );

    onAsync(
        ipcMain,
        'main:app:capture-web-screen-shot',
        (data: {
            url: string;
            width: number;
            height: number;
            delay?: number;
        }) => {
            return captureWebScreenShot(data.url, data);
        },
    );

    ipcMain.on('all:app:check-is-window-on-top', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win === null) {
            return false;
        }
        const isOnTop = win.isAlwaysOnTop();
        event.returnValue = isOnTop;
    });
    ipcMain.on(
        'all:app:set-is-window-on-top',
        (event, data: { isOnTop: boolean }) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win === null) {
                return false;
            }
            win.setAlwaysOnTop(data.isOnTop);
        },
    );

    onAsync(
        ipcMain,
        'main:app:pptx-to-htmls',
        (data: PptxToHtmlsParamsType) => {
            const isSuccess = pptxToHtmls(data);
            return isSuccess;
        },
    );
    onAsync(ipcMain, 'main:app:get-pptx-to-htmls-version', () => {
        const version = getPptxToHtmlsVersion();
        return version;
    });
    onAsync(
        ipcMain,
        'main:app:docx-to-htmls',
        (data: DocxToHtmlsParamsType) => {
            const isSuccess = docxToHtmls(data);
            return isSuccess;
        },
    );
    onAsync(ipcMain, 'main:app:get-docx-to-htmls-version', () => {
        const version = getDocxToHtmlsVersion();
        return version;
    });

    ipcMain.on(
        'main:app:set-menu-items',
        (
            event,
            {
                key,
                menusData,
            }: { key: string; menusData: CustomMenusDataType | null },
        ) => {
            // Route clicks back to the renderer that contributed the items, not
            // to whichever window happens to be focused: only the owner has a
            // handler for its own `clickData` (e.g. the presenter opens the lang
            // tools links), so focus-based routing silently drops the click
            // whenever a popup or a screen window is in front.
            const ownerWin = BrowserWindow.fromWebContents(event.sender);
            setCustomMenusData(
                key,
                menusData === null
                    ? null
                    : {
                          menusData,
                          clickMenu: (menuData: any) => {
                              sendMenuClicked(menuData, ownerWin);
                          },
                      },
            );
            initMenu(appController);
        },
    );

    ipcMain.on(
        'main:app:client-setting',
        (
            event,
            data: {
                key: string;
                type: 'get' | 'set' | 'delete' | 'get-all-keys' | 'clear';
                value?: any;
            },
        ) => {
            const { key, type, value } = data;
            let returnValue: any = null;
            if (type === 'get') {
                const setting =
                    appController.settingManager.getClientSetting(key);
                returnValue = setting;
            } else if (type === 'set') {
                appController.settingManager.setClientSetting(key, value);
                returnValue = true;
            } else if (type === 'delete') {
                appController.settingManager.deleteClientSetting(key);
                returnValue = true;
            } else if (type === 'get-all-keys') {
                const allSettings =
                    appController.settingManager.getAllClientSettingKeys();
                returnValue = JSON.stringify(allSettings);
            } else if (type === 'clear') {
                appController.settingManager.clearClientSettings();
                returnValue = true;
            }
            event.returnValue = returnValue;
        },
    );
}
