import path from 'node:path';
import electron, {
    BrowserWindow,
    clipboard,
    type FileFilter,
    type IpcMain,
    type IpcMainEvent,
    nativeTheme,
    shell,
    systemPreferences,
    type WebContents,
} from 'electron';

import type ElectronAppController from './ElectronAppController';
import { writeClipboardText } from './clipboardHelpers';
import { getMcpToken, getMcpUrl, getRemoteDebuggingPort } from './aiHelpers';
import {
    AI_CHAT_MICROPHONE_ANSWER_CHANNEL,
    answerAiChatMicrophoneAsk,
    clearAiChatGuestData,
} from './aiChatGuestHelpers';
import {
    AI_CHAT_HAND_TAB_CHANNEL,
    AI_CHAT_TAKE_TAB_CHANNEL,
    AI_CHAT_WINDOW_SLOT_CHANNEL,
    claimAiChatWindowSlot,
    handAiChatTab,
    takeAiChatTab,
    tellOtherAiChatWindowsSignedOut,
} from './aiChatWindowHelpers';
import {
    checkIsEncryptedFile,
    decryptFile,
    encryptFile,
} from './archiveCryptoHelpers';
import {
    forgetDisplayWallpapers,
    readDisplayWallpaper,
    type DisplaySizeType,
} from './displayWallpaperHelpers';
import {
    attemptClosing,
    captureWebScreenShot,
    captureMiniScreenImage,
    captureWindowImage,
    findScreenWindow,
    getUpdatePageUrl,
    goDownload,
    isMac,
    messageChannels,
    previewPrintCurrentWindow,
    printHTMLContent,
    setGuideRunning,
    askGuideHelp,
    answerGuideHelp,
    sendChatAttachment,
    takeChatAttachment,
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
import { getScreenMirror } from './screenMirrorService';
import { getVirtualDisplays } from './virtualDisplayService';
import {
    getScreenOutput,
    getVirtualScreenOutput,
    getVirtualScreenOutputIds,
} from './screenOutputRegistry';
import { isVirtualDisplayId } from './virtualDisplayProtocol';
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
import { captureOAuthRedirectUrl } from './oauthHelpers';
import { relaunchApp } from './taskbarHelpers';
import { readWebPage } from './webPageHelpers';
import {
    cancelCustomLlmFetch,
    handleCustomLlmFetch,
} from './customLlmRelayHelpers';
import {
    CUSTOM_LLM_CANCEL_CHANNEL,
    CUSTOM_LLM_FETCH_CHANNEL,
    type CustomLlmFetchRequestType,
} from './customLlmProtocol';
import { type FontListMapType, getSystemFontListMap } from './fontListHelpers';

const { dialog, ipcMain, app } = electron;

export type AnyObjectType = {
    [key: string]: any;
};

export type ScreenMessageType = {
    stage?: number;
    screenId: number;
    type: string;
    data: AnyObjectType;
};
type ShowScreenDataType = {
    screenId: number;
    displayId: number;
};

// Enumerating system fonts spawns a child process (PowerShell on Windows) that
// takes seconds while the OS cold-loads its font APIs. The answer -- a few KB --
// is kept for the whole app run so that happens once however many windows and
// dropdowns ask, and asks that arrive while it runs share the one in flight
// (the start-up prewarm and the first dropdown used to spawn two). A failure
// or an empty list is not kept, so the next ask tries again.
let fontListMapPromise: Promise<FontListMapType | null> | null = null;
function getFontListMap() {
    fontListMapPromise ??= getSystemFontListMap().then(
        (fontListMap) => {
            if (Object.keys(fontListMap).length > 0) {
                return fontListMap;
            }
            fontListMapPromise = null;
            return null;
        },
        (error) => {
            console.log(error);
            fontListMapPromise = null;
            return null;
        },
    );
    return fontListMapPromise;
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

    // What the in-app chatbot connects to. Both doors are on ports this
    // process picked at launch, so nothing in the renderer can hardcode them.
    // The MCP capability stays off the URL and crosses only this IPC seam.
    ipcMain.on('main:app:get-ai-endpoints', (event) => {
        event.returnValue = {
            mcpUrl: getMcpUrl(),
            mcpToken: getMcpToken(),
            cdpPort: getRemoteDebuggingPort(),
        };
    });

    // The AI Chat window's "Sign out of every site". It is the only way in
    // the app to end a sign-in held on the guest partition, and the window
    // has already asked twice by the time it gets here.
    // Every AI Chat window shares the one partition, so the others are told
    // and drop the pages they are still showing.
    onAsync(ipcMain, 'main:app:clear-ai-chat-data', async (_data, event) => {
        await clearAiChatGuestData();
        tellOtherAiChatWindowsSignedOut(event.sender);
        return true;
    });

    // Which of the open AI Chat windows this is, so each keeps its own tabs.
    ipcMain.on(AI_CHAT_WINDOW_SLOT_CHANNEL, (event) => {
        event.returnValue = claimAiChatWindowSlot(event.sender);
    });
    // A tab dragged out of one AI Chat window into a new one: held here
    // between the two, synchronously, so it is here before the window is.
    ipcMain.on(AI_CHAT_HAND_TAB_CHANNEL, (event, data: unknown) => {
        event.returnValue = handAiChatTab(event.sender, data);
    });
    ipcMain.on(AI_CHAT_TAKE_TAB_CHANNEL, (event) => {
        event.returnValue = takeAiChatTab(event.sender);
    });

    // A site in the AI Chat window asking for the microphone, answered by the
    // person on that window's own line. The sender is checked against the
    // window that was asked, so no other page in the app can say yes.
    ipcMain.on(AI_CHAT_MICROPHONE_ANSWER_CHANNEL, (event, data: unknown) => {
        answerAiChatMicrophoneAsk(event.sender.id, data);
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

    // A photograph of what the operator is actually looking at. Three callers,
    // one path: the Presenting Control's snapshot button, the chatbot's own
    // "attach a screenshot", and `owa_screenshot` for an agent driving the app
    // from outside. Everything here is a data URL, and the renderer that asked
    // is the one that decides what to do with it.
    onAsync(
        ipcMain,
        'main:app:capture-window',
        async ({ screenId }: { screenId?: number }) => {
            // A screen on a virtual display is a page, not a window.
            const virtualCapture =
                screenId === undefined
                    ? undefined
                    : getVirtualDisplays()?.captureScreen(screenId);
            if (virtualCapture !== undefined) {
                const image = await virtualCapture;
                if (image === null) {
                    // Drawn here only while an MP4 is watched: else its
                    // Mini Screen is the picture.
                    return await captureMiniScreenImage(
                        appController.mainWin,
                        screenId!,
                    );
                }
                return image.toDataURL();
            }
            return await captureWindowImage(
                screenId === undefined
                    ? appController.mainWin
                    : findScreenWindow(screenId),
            );
        },
    );

    // A monitor's DESKTOP BACKGROUND, for the mini screen previewer's backdrop.
    // The screen windows are transparent, so what the audience sees where the
    // app draws nothing is that display's wallpaper -- this is how the card can
    // show it instead of a checkered "nothing here" pattern. Deliberately the
    // wallpaper FILE rather than a screen capture: no other window is in it, and
    // it needs no retaking. Null (rather than an error) when this machine will
    // not say what its background is.
    onAsync(
        ipcMain,
        'main:app:read-display-wallpaper',
        async ({
            displayId,
            displayIndex,
            width,
            sizes,
            isForced,
        }: {
            displayId?: number;
            displayIndex: number;
            width?: number;
            sizes?: DisplaySizeType[];
            isForced?: boolean;
        }) => {
            if (isForced) {
                forgetDisplayWallpapers();
            }
            // A virtual display's wallpaper is its own setting, not the OS's.
            if (isVirtualDisplayId(displayId)) {
                return (
                    (await getVirtualDisplays()?.readWallpaper(
                        displayId,
                        width,
                    )) ?? null
                );
            }
            return await readDisplayWallpaper({ displayIndex, width, sizes });
        },
    );
}

function onAsync<T1, T2>(
    ipc: IpcMain,
    eventName: string,
    callee: (data: T1, event: IpcMainEvent) => OptionalPromise<T2>,
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
            result = await callee(data, event);
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
    const mirror = getScreenMirror();
    const virtualDisplays = getVirtualDisplays();
    mirror?.configure(appController.mainWin.webContents);
    ipcMain.on('main:app:get-displays', (event) => {
        event.returnValue = {
            primaryDisplay: appController.settingManager.primaryDisplay,
            // Virtual displays last: the wallpaper readers count the real
            // monitors by their place in this list.
            displays: [
                ...appController.settingManager.allDisplays,
                ...(mirror?.displays() ?? []),
                ...(virtualDisplays?.displays() ?? []),
            ],
        };
    });

    ipcMain.on('main:app:get-screens', (event) => {
        event.returnValue = [
            ...new Set([
                ...ElectronScreenController.getAllIds(),
                ...(mirror?.showingIds() ?? []),
                ...getVirtualScreenOutputIds(),
            ]),
        ];
    });

    const notifyHidden = (screenId: number) => {
        mirror?.hide(screenId);
        appController.mainController.sendNotifyInvisibility(screenId);
    };

    // A screen window on a monitor. Closing it hides the screen, unless it is
    // only being handed to a virtual display.
    const openScreenWindow = async (screenId: number, displayId: number) => {
        const isNewInstance =
            ElectronScreenController.getInstance(screenId) === null;
        const screenController =
            ElectronScreenController.createInstance(screenId);
        // Attach only once — createInstance returns a cached controller,
        // and stacking a listener per show call duplicates the notify.
        if (isNewInstance) {
            screenController.win.on('close', () => {
                screenController.destroyInstance();
                if (!screenController.isMoving) {
                    notifyHidden(screenId);
                }
            });
        }
        const display = appController.settingManager.getDisplayById(displayId);
        if (display !== undefined) {
            await screenController.listenLoading();
            screenController.setDisplay(display);
            appController.mainWin.focus();
        }
    };

    // A screen on a virtual display: no window of its own, a page in the
    // display's compositor while somebody watches.
    const attachVirtualScreen = (screenId: number, displayId: number) => {
        if (virtualDisplays === undefined) {
            throw new Error('Virtual display is unavailable');
        }
        const controller = virtualDisplays.attachScreen(screenId, displayId);
        controller.onClosed(() => {
            if (!controller.isMoving) {
                notifyHidden(screenId);
            }
        });
    };

    // Hands a showing screen from a monitor to a virtual display or back, or
    // between two virtual displays. The presenter is never told it hid,
    // because it did not.
    const moveScreenHere = async (screenId: number, displayId: number) => {
        mirror?.retargetOutput(screenId, displayId);
        const virtualOutput = getVirtualScreenOutput(screenId);
        if (isVirtualDisplayId(displayId)) {
            if (virtualOutput !== null) {
                virtualDisplays?.moveScreen(screenId, displayId);
                return;
            }
            const screenController =
                ElectronScreenController.getInstance(screenId);
            if (screenController !== null) {
                screenController.isMoving = true;
                screenController.destroyInstance();
                screenController.close();
            }
            attachVirtualScreen(screenId, displayId);
            return;
        }
        if (virtualOutput !== null) {
            virtualOutput.isMoving = true;
            virtualOutput.close();
        }
        await openScreenWindow(screenId, displayId);
    };

    // TODO: use shareProps.mainWin.on or shareProps.screenWin.on
    onAsync(
        ipcMain,
        'main:app:show-screen',
        async (data: ShowScreenDataType) => {
            if (
                mirror &&
                (await mirror.prepareOutput(data.screenId, data.displayId))
            )
                return;
            if (isVirtualDisplayId(data.displayId)) {
                if (getVirtualScreenOutput(data.screenId) !== null) {
                    return;
                }
                const screenController = ElectronScreenController.getInstance(
                    data.screenId,
                );
                if (screenController !== null) {
                    screenController.isMoving = true;
                    screenController.destroyInstance();
                    screenController.close();
                }
                attachVirtualScreen(data.screenId, data.displayId);
                return;
            }
            const virtualOutput = getVirtualScreenOutput(data.screenId);
            if (virtualOutput !== null) {
                virtualOutput.isMoving = true;
                virtualOutput.close();
            }
            await openScreenWindow(data.screenId, data.displayId);
        },
    );

    ipcMain.on('app:hide-screen', (event, screenId: number) => {
        // A Screen Mirror host's screen shown here closes itself, not this
        // computer's own screen that happens to share its id.
        if (mirror?.closeIncomingOf(event.sender)) return;
        mirror?.hide(screenId);
        getVirtualScreenOutput(screenId)?.close();
        const screenController = ElectronScreenController.getInstance(screenId);
        if (screenController === null) {
            return;
        }
        attemptClosing(screenController);
        screenController.destroyInstance();
    });
    ipcMain.on('app:hide-all-screens', () => {
        for (const id of mirror?.showingIds() ?? []) mirror?.hide(id);
        virtualDisplays?.closeAllScreens();
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
            const virtualOutput = getVirtualScreenOutput(screenId);
            const isToRemote = !!mirror?.isRemoteDisplay(displayId);
            const isFromRemote = !!mirror?.isRemoteOutput(screenId);
            // To, from or between virtual displays, all on this computer.
            if (
                (virtualOutput !== null || isVirtualDisplayId(displayId)) &&
                !isToRemote &&
                !isFromRemote
            ) {
                const isShowing =
                    virtualOutput !== null ||
                    ElectronScreenController.getInstance(screenId) !== null;
                if (isShowing) {
                    moveScreenHere(screenId, displayId).catch((error) => {
                        console.error(error);
                    });
                }
                return;
            }
            if (virtualOutput !== null && isToRemote) {
                virtualOutput.isMoving = true;
                virtualOutput.close();
            }
            if (
                mirror?.showingIds().includes(screenId) &&
                (isToRemote ||
                    isFromRemote ||
                    ElectronScreenController.getInstance(screenId) === null)
            ) {
                ElectronScreenController.getInstance(screenId)?.close();
                void mirror
                    .prepareOutput(screenId, displayId)
                    .then((isRemote) => {
                        if (isRemote) {
                            return;
                        }
                        if (isVirtualDisplayId(displayId)) {
                            attachVirtualScreen(screenId, displayId);
                            return;
                        }
                        const targetDisplay =
                            appController.settingManager.getDisplayById(
                                displayId,
                            );
                        if (targetDisplay)
                            ElectronScreenController.createInstance(
                                screenId,
                            ).setDisplay(targetDisplay);
                    })
                    .catch((error) => console.error(error.message));
                return;
            }
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
                stage,
            }: ScreenMessageType & { isScreen: boolean },
        ) => {
            if (isScreen) {
                if (
                    mirror?.sendFeedback({ screenId, type, data }, event.sender)
                )
                    return;
                appController.mainController.sendScreenMessage({
                    screenId,
                    type,
                    data,
                });
            } else {
                if (mirror?.sendScreenMessage({ screenId, type, data, stage }))
                    return;
                const screenOutput = getScreenOutput(screenId);
                if (screenOutput !== null) {
                    const message = mirror?.localMessage({
                        screenId,
                        type,
                        data,
                        stage,
                    });
                    screenOutput.sendMessage(type, message?.data ?? data);
                }
            }
            event.returnValue = true;
        },
    );

    ipcMain.on(
        'screen:app:change-bible',
        (event, data: { screenId: number; isNext: boolean }) => {
            if (mirror?.stepBible(data, event.sender)) return;
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
    // OAuth sign-in (e.g. CCLI SongSelect): the consent page must live in a
    // real window the main process controls, so the renderer only receives
    // the captured redirect URL back.
    onAsync(
        ipcMain,
        'main:app:oauth-authorize',
        (data: { authorizeUrl: string; redirectUriPrefix: string }) => {
            return captureOAuthRedirectUrl(data);
        },
    );

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
            excludeEntryPaths?: string[];
        }) => {
            return tarCreate(
                data.inputDir,
                data.outputFilePath,
                data.files,
                data.isGzip,
                data.excludeNamePatterns,
                data.excludeEntryPaths,
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

    // The clipboard module lives in this process only, so a renderer's copy
    // has to come through here.
    ipcMain.on('main:app:copy-to-clipboard', (_, text: unknown) => {
        if (typeof text !== 'string' || text.length === 0) {
            return;
        }
        void writeClipboardText(text);
    });

    onAsync(
        ipcMain,
        'main:app:write-clipboard-text',
        (data: { text?: unknown }) => {
            return writeClipboardText(data?.text);
        },
    );
    onAsync(ipcMain, 'main:app:read-clipboard-text', () =>
        clipboard.readText(),
    );

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
                // Electron's words when Windows will not recycle the item: a
                // USB flash drive has no Recycle Bin. Retrying cannot change
                // that, and the renderer is waiting to ask the person whether
                // to delete it outright (`FileSource.trash`).
                if (
                    error instanceof Error &&
                    error.message.includes('Operation was aborted')
                ) {
                    return false;
                }
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
        (
            data: {
                filePath: string;
                outDir: string;
                isForce: boolean;
                progressEventName?: string;
            },
            event,
        ) => {
            const mainDisplay = appController.settingManager.primaryDisplay;
            return pdfToImages(
                data.filePath,
                data.outDir,
                mainDisplay.size.width,
                data.isForce,
                (completed, total) => {
                    if (!data.progressEventName) {
                        return;
                    }
                    try {
                        event.sender.send(data.progressEventName, {
                            completed,
                            total,
                        });
                    } catch {
                        // A closed renderer should not abort PDF conversion.
                    }
                },
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

    // The in-app update check's hand-off: a Store install goes to its own
    // page in Microsoft Store, anything else to the website download page.
    ipcMain.on('main:app:go-update', () => {
        shell.openExternal(getUpdatePageUrl()).catch((error) => {
            console.error('Failed to open the update page:', error);
        });
    });

    // Asked for by the Settings panel that owns a setting a reload cannot
    // apply. Fire-and-forget on purpose: nothing can be answered to a renderer
    // that is about to be torn down with the process.
    ipcMain.on('main:app:relaunch', () => {
        relaunchApp();
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

    // The media download found the pack missing, or Settings just installed
    // it, in one renderer; the Settings window it is about to raise has to
    // re-read, and a Screen Mirror tunnel waiting for the pack's cloudflared
    // starts.
    ipcMain.on('all:app:extra-bin-changed', () => {
        appController.sendMessageToAll('main:app:extra-bin-changed');
        getScreenMirror()?.retryTunnel();
    });

    // A bible was created, imported, reset or removed in one renderer; a
    // window still answering "not available" for its key asks again.
    ipcMain.on('all:app:bible-list-changed', () => {
        appController.sendMessageToAll('main:app:bible-list-changed');
    });

    // The help window working on an answer, for the 🤖 in every other window
    // (`src/helper/ai/chatbotBusyHelpers.ts`). Remembered so a window opened
    // mid-answer can ask, and cleared when the help window closes mid-answer
    // -- a dot left on for a window that no longer exists would never go out.
    let isChatbotBusy = false;
    const watchedChatbotSet = new WeakSet<WebContents>();
    const setChatbotBusy = (isBusy: boolean) => {
        if (isBusy === isChatbotBusy) {
            return;
        }
        isChatbotBusy = isBusy;
        appController.sendMessageToAll('main:app:chatbot-busy', { isBusy });
    };
    ipcMain.on('all:app:chatbot-busy', (event, data: any) => {
        if (!watchedChatbotSet.has(event.sender)) {
            watchedChatbotSet.add(event.sender);
            event.sender.once('destroyed', () => {
                setChatbotBusy(false);
            });
        }
        setChatbotBusy(data?.isBusy === true);
    });
    // Answered on the relay's own channel, to the asking window alone --
    // never as a synchronous `returnValue`, which blocks that window until
    // this replies.
    ipcMain.on('all:app:get-chatbot-busy', (event) => {
        event.sender.send('main:app:chatbot-busy', { isBusy: isChatbotBusy });
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

    // What `owa_read_website` reaches through. The address is judged in
    // `readWebPage` itself rather than here: that function is what opens the
    // socket, and a check placed at the door instead would be one an added
    // caller could forget.
    onAsync(
        ipcMain,
        'main:app:read-web-page',
        (data: {
            url: string;
            bibleCatalog?: boolean;
            wantsScreenshot?: boolean;
            maxChars?: number;
            width?: number;
            height?: number;
        }) => {
            return readWebPage(data.url, data);
        },
    );

    // The chatbot's door to a custom model server (LM Studio and the like):
    // forwarded only to an address saved in Settings, only the two calls the
    // chatbot makes, with the key read here -- `customLlmRelayHelpers.ts`.
    onAsync(
        ipcMain,
        CUSTOM_LLM_FETCH_CHANNEL,
        (data: CustomLlmFetchRequestType, event) => {
            return handleCustomLlmFetch(data, event.sender);
        },
    );
    // Stop, sent with no reply wanted: the request's own reply settles it.
    ipcMain.on(CUSTOM_LLM_CANCEL_CHANNEL, (_event, data) => {
        cancelCustomLlmFetch(data?.requestId);
    });

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
                options,
            }: {
                key: string;
                menusData: CustomMenusDataType | null;
                options?: { isRoutedToFocusedWindow?: boolean };
            },
        ) => {
            // Route clicks back to the renderer that contributed the items, not
            // to whichever window happens to be focused: only the owner has a
            // handler for its own `clickData` (e.g. the presenter opens the lang
            // tools links), so focus-based routing silently drops the click
            // whenever a popup or a screen window is in front.
            const ownerWin = BrowserWindow.fromWebContents(event.sender);
            // ...unless the items belong to a feature EVERY window carries.
            // Only one entry is kept per key, so the last window to load owns
            // the routing and every other window's press lands nowhere -- the
            // owner is not focused, and its own guard drops it. For those, the
            // window in front is the one that meant to press it.
            const isRoutedToFocusedWindow =
                options?.isRoutedToFocusedWindow === true;
            setCustomMenusData(
                key,
                menusData === null
                    ? null
                    : {
                          menusData,
                          clickMenu: (menuData: any) => {
                              sendMenuClicked(
                                  menuData,
                                  isRoutedToFocusedWindow
                                      ? (BrowserWindow.getFocusedWindow() ??
                                            ownerWin)
                                      : ownerWin,
                              );
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

    // Sibling of `main:app:client-setting` for credentials. Same shape, but the
    // values are encrypted at rest by `safeStorage`. There is deliberately no
    // `get-all-keys`: enumerating secret key names buys nothing.
    ipcMain.on(
        'main:app:secure-setting',
        (
            event,
            data: {
                key: string;
                type: 'get' | 'set' | 'delete' | 'clear' | 'is-available';
                value?: any;
            },
        ) => {
            const { key, type, value } = data;
            const { settingManager } = appController;
            let returnValue: any = null;
            if (type === 'get') {
                returnValue = settingManager.getSecureSetting(key);
            } else if (type === 'set') {
                settingManager.setSecureSetting(key, value);
                returnValue = true;
            } else if (type === 'delete') {
                settingManager.deleteSecureSetting(key);
                returnValue = true;
            } else if (type === 'clear') {
                settingManager.clearSecureSettings();
                returnValue = true;
            } else if (type === 'is-available') {
                returnValue = settingManager.checkIsSecureStorageAvailable();
            }
            event.returnValue = returnValue;
        },
    );

    ipcMain.on('all:app:check-is-main-window', (event) => {
        event.returnValue = event.sender === appController.mainWin.webContents;
    });

    // The chatbot's walkthrough card, relayed out of the window it is drawn in
    // (`domHelpers`). The sender IS that window, which is the one the card
    // rings controls in -- and so the one the help window must not cover.
    ipcMain.on(
        'all:app:guide-running',
        (event, data: { isRunning: boolean }) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win === null) {
                return;
            }
            setGuideRunning(win, data.isRunning === true);
        },
    );

    // The same card, stuck on a step it cannot press. It asks the chat window
    // that started the walkthrough; the answer comes back the other way and is
    // drawn on the card, so the user never leaves the window they are working
    // in. Both halves are routed here because the two renderers cannot reach
    // each other, and the ANSWER carries no window of its own -- it goes back
    // to whichever window asked, which `askGuideHelp` is holding.
    ipcMain.on('all:app:guide-help', (event, data: any) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win === null) {
            return;
        }
        askGuideHelp(win, data ?? {});
    });
    ipcMain.on('all:app:guide-help-answer', (_event, data: any) => {
        answerGuideHelp(data ?? {});
    });

    // The Presenting Control's snapshot, on its way to the help window. Sent
    // if that window is already up, and held for it either way -- the same
    // press opens it, and a window still loading has nobody listening yet.
    ipcMain.on('all:app:chat-attach', (_event, data: any) => {
        sendChatAttachment(data ?? {});
    });
    ipcMain.on('main:app:take-chat-attachment', (event) => {
        event.returnValue = takeChatAttachment();
    });
}
