import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The IPC doors the other two suites do not open: the AI Chat window's slot
// and tab hand-off, the problem report's console lines, the wallpaper reader,
// the remaining screen moves to and from virtual displays and remote hosts,
// the chatbot's busy dot and the LLM relay channels. Its own mock surface, so
// `isMac` can be flipped per test.

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const state = vi.hoisted(() => ({
    isMac: false,
    listAppWindows: vi.fn(),
    claimAiChatWindowSlot: vi.fn(),
    handAiChatTab: vi.fn(),
    takeAiChatTab: vi.fn(),
    tellOtherAiChatWindowsSignedOut: vi.fn(),
    getRecentConsoleLines: vi.fn(),
    importEsm: vi.fn(),
    toMcpPackagePath: vi.fn(),
    getRemoteDebuggingPort: vi.fn(),
    forgetDisplayWallpapers: vi.fn(),
    readDisplayWallpaper: vi.fn(),
    getVirtualDisplays: vi.fn(),
    getScreenMirror: vi.fn(),
    screenControllerMocks: {
        closeAll: vi.fn(),
        createInstance: vi.fn(),
        getAllIds: vi.fn(),
        getInstance: vi.fn(),
    },
    captureWindowImage: vi.fn(),
    captureMiniScreenImage: vi.fn(),
    findScreenWindow: vi.fn(),
    pdfToChatPages: vi.fn(),
    getSystemFontListMap: vi.fn(),
    handleCustomLlmFetch: vi.fn(),
    cancelCustomLlmFetch: vi.fn(),
    getLlmRegistryStatus: vi.fn(),
    refreshLlmRegistry: vi.fn(),
    handleLlmReportPost: vi.fn(),
    cancelLlmReportPost: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    get isMac() {
        return state.isMac;
    },
    attemptClosing: vi.fn(),
    captureMiniScreenImage: state.captureMiniScreenImage,
    captureWindowImage: state.captureWindowImage,
    findScreenWindow: state.findScreenWindow,
    messageChannels: { screenMessage: 'app:screen:message' },
}));
vi.mock('./aiHelpers', () => ({
    getMcpToken: vi.fn(),
    getMcpUrl: vi.fn(),
    getRemoteDebuggingPort: state.getRemoteDebuggingPort,
    importEsm: state.importEsm,
    toMcpPackagePath: state.toMcpPackagePath,
}));
vi.mock('./appWindowListHelpers', () => ({
    listAppWindows: state.listAppWindows,
}));
vi.mock('./aiChatWindowHelpers', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    claimAiChatWindowSlot: state.claimAiChatWindowSlot,
    handAiChatTab: state.handAiChatTab,
    takeAiChatTab: state.takeAiChatTab,
    tellOtherAiChatWindowsSignedOut: state.tellOtherAiChatWindowsSignedOut,
}));
vi.mock('./aiChatGuestHelpers', () => ({
    AI_CHAT_MICROPHONE_ANSWER_CHANNEL: 'main:app:ai-chat-microphone-answer',
    answerAiChatMicrophoneAsk: vi.fn(),
    clearAiChatGuestData: vi.fn(),
}));
vi.mock('./consoleLogHelpers', () => ({
    getRecentConsoleLines: state.getRecentConsoleLines,
}));
vi.mock('./displayWallpaperHelpers', () => ({
    forgetDisplayWallpapers: state.forgetDisplayWallpapers,
    readDisplayWallpaper: state.readDisplayWallpaper,
}));
vi.mock('./screenMirrorService', () => ({
    getScreenMirror: state.getScreenMirror,
}));
vi.mock('./virtualDisplayService', () => ({
    getVirtualDisplays: state.getVirtualDisplays,
}));
vi.mock('./ElectronScreenController', () => ({
    default: state.screenControllerMocks,
}));
vi.mock('./finderOverlayHelpers', () => ({
    closeFindOverlay: vi.fn(),
    getFindOverlayHostWebContents: vi.fn(),
    getFindOverlayWebContents: vi.fn(),
    setFindOverlayMounted: vi.fn(),
    startFindOverlayDragging: vi.fn(),
    stopFindOverlayDragging: vi.fn(),
}));
vi.mock('./electronOfficeHelpers', () => ({ officeFileToPdf: vi.fn() }));
vi.mock('./pdfToImagesHelpers', () => ({
    getPagesCount: vi.fn(),
    pdfToChatPages: state.pdfToChatPages,
    pdfToImages: vi.fn(),
}));
vi.mock('./msHelpers', () => ({
    docxToHtmls: vi.fn(),
    getDocxToHtmlsVersion: vi.fn(),
    getPptxSlidesCount: vi.fn(),
    getPptxToHtmlsVersion: vi.fn(),
    pptxToHtmls: vi.fn(),
}));
vi.mock('./electronMenu', () => ({
    initMenu: vi.fn(),
    sendMenuClicked: vi.fn(),
    sendMenuClickedToAllWindows: vi.fn(),
    setCustomMenusData: vi.fn(),
}));
vi.mock('./appMenuAgentHelpers', () => ({
    AGENT_MENU_LIST_CHANNEL: 'main:app:agent-menu-list',
    AGENT_MENU_CLICK_CHANNEL: 'main:app:agent-menu-click',
    listAgentMenuItems: vi.fn(),
    clickAgentMenuItem: vi.fn(),
}));
vi.mock('./oauthHelpers', () => ({ captureOAuthRedirectUrl: vi.fn() }));
vi.mock('./taskbarHelpers', () => ({ relaunchApp: vi.fn() }));
vi.mock('./webPageHelpers', () => ({ readWebPage: vi.fn() }));
vi.mock('./fontListHelpers', () => ({
    getSystemFontListMap: state.getSystemFontListMap,
}));
vi.mock('./customLlmRelayHelpers', () => ({
    handleCustomLlmFetch: state.handleCustomLlmFetch,
    cancelCustomLlmFetch: state.cancelCustomLlmFetch,
}));
vi.mock('./llmRegistryHelpers', () => ({
    getLlmRegistryStatus: state.getLlmRegistryStatus,
    refreshLlmRegistry: state.refreshLlmRegistry,
}));
vi.mock('./llmReportHelpers', () => ({
    handleLlmReportPost: state.handleLlmReportPost,
    cancelLlmReportPost: state.cancelLlmReportPost,
}));

import {
    initEventListenerApp,
    initEventOther,
    initEventScreen,
} from './electronEventListener';
import { electronMockState } from './testElectronModule';
import { flushPromises } from './testUtils';
import {
    AI_CHAT_HAND_TAB_CHANNEL,
    AI_CHAT_TAKE_TAB_CHANNEL,
    AI_CHAT_WINDOW_SLOT_CHANNEL,
} from './aiChatWindowHelpers';
import {
    CUSTOM_LLM_CANCEL_CHANNEL,
    CUSTOM_LLM_FETCH_CHANNEL,
    LLM_REGISTRY_GET_CHANNEL,
    LLM_REGISTRY_RELOAD_CHANNEL,
    LLM_REPORT_CANCEL_CHANNEL,
    LLM_REPORT_POST_CHANNEL,
} from './customLlmProtocol';
import {
    getVirtualScreenOutput,
    removeVirtualScreenOutput,
    setVirtualScreenOutput,
} from './screenOutputRegistry';

const VIRTUAL_DISPLAY_ID = -500001;
const OTHER_VIRTUAL_DISPLAY_ID = -500002;
const REMOTE_DISPLAY_ID = -1000005;

function findOnHandler(eventName: string) {
    const handler = electronMockState.ipcMain.on.mock.calls.find(
        ([name]) => name === eventName,
    )?.[1];
    if (handler === undefined) {
        throw new Error(`No "on" handler registered for ${eventName}`);
    }
    return handler as (...args: any[]) => any;
}

// An `onAsync` door: the answer is sent on the reply channel it was given.
async function callAsync(eventName: string, data: any = {}, sender?: any) {
    const replySender = sender ?? { send: vi.fn() };
    await findOnHandler(eventName)(
        { sender: replySender },
        { replyEventName: 'reply', ...data },
    );
    expect(replySender.send).toHaveBeenCalledTimes(1);
    expect(replySender.send.mock.calls[0][0]).toBe('reply');
    return replySender.send.mock.calls[0][1];
}

function createAppController() {
    return {
        mainWin: {
            focus: vi.fn(),
            webContents: { id: 1, getZoomFactor: vi.fn(() => 1) },
        },
        mainController: {
            sendNotifyInvisibility: vi.fn(),
            sendScreenMessage: vi.fn(),
            changeBible: vi.fn(),
            syncStayAwake: vi.fn(),
        },
        settingManager: {
            primaryDisplay: { id: 1, size: { width: 1280, height: 720 } },
            allDisplays: [{ id: 1 }, { id: 8 }],
            getDisplayById: vi.fn((id: number) => {
                return id === 8 ? { id: 8, bounds: { x: 1, y: 2 } } : undefined;
            }),
        },
        sendMessageToAll: vi.fn(),
        reloadAll: vi.fn(),
        resetThemeBackgroundColor: vi.fn(),
    } as any;
}

function createVirtualOutput(screenId: number) {
    const output = {
        screenId,
        isMoving: false,
        sendData: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => removeVirtualScreenOutput(screenId, output)),
    };
    return output;
}

function createScreenController() {
    return {
        isMoving: false,
        win: { on: vi.fn() },
        listenLoading: vi.fn(async () => undefined),
        setDisplay: vi.fn(),
        destroyInstance: vi.fn(),
        close: vi.fn(),
    };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
const registeredOutputs: [number, any][] = [];

beforeEach(() => {
    electronMockState.reset();
    state.isMac = false;
    state.getSystemFontListMap.mockResolvedValue({});
    state.getRemoteDebuggingPort.mockReturnValue(51234);
    state.getScreenMirror.mockReturnValue(undefined);
    state.getVirtualDisplays.mockReturnValue(undefined);
    state.screenControllerMocks.getAllIds.mockReturnValue([]);
    state.screenControllerMocks.getInstance.mockReturnValue(null);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    for (const [screenId, output] of registeredOutputs.splice(0)) {
        removeVirtualScreenOutput(screenId, output);
    }
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
});

function registerOutput(screenId: number) {
    const output = createVirtualOutput(screenId);
    setVirtualScreenOutput(screenId, output);
    registeredOutputs.push([screenId, output]);
    return output;
}

describe('app doors', () => {
    test('lists the open windows through the CDP port picked at launch', async () => {
        state.listAppWindows.mockResolvedValue([{ id: 'main', title: 'OWA' }]);
        initEventListenerApp(createAppController());

        const answer = await callAsync('main:app:list-app-windows');

        expect(state.listAppWindows).toHaveBeenCalledWith(51234);
        expect(answer).toEqual([{ id: 'main', title: 'OWA' }]);
    });

    test('AI Chat windows claim a slot and hand a tab over through main', () => {
        initEventListenerApp(createAppController());
        const sender = { id: 7 };
        state.claimAiChatWindowSlot.mockReturnValue(2);
        state.handAiChatTab.mockReturnValue(true);
        state.takeAiChatTab.mockReturnValue({ url: 'https://chat.example' });

        const slotEvent: any = { sender };
        findOnHandler(AI_CHAT_WINDOW_SLOT_CHANNEL)(slotEvent);
        expect(state.claimAiChatWindowSlot).toHaveBeenCalledWith(sender);
        expect(slotEvent.returnValue).toBe(2);

        const handEvent: any = { sender };
        const tab = { url: 'https://chat.example' };
        findOnHandler(AI_CHAT_HAND_TAB_CHANNEL)(handEvent, tab);
        expect(state.handAiChatTab).toHaveBeenCalledWith(sender, tab);
        expect(handEvent.returnValue).toBe(true);

        const takeEvent: any = { sender };
        findOnHandler(AI_CHAT_TAKE_TAB_CHANNEL)(takeEvent);
        expect(state.takeAiChatTab).toHaveBeenCalledWith(sender);
        expect(takeEvent.returnValue).toEqual({ url: 'https://chat.example' });
    });

    test('recent console lines go out through the firewall scrub, or not at all', async () => {
        const appController = createAppController();
        initEventListenerApp(appController);

        // Nothing logged: the scrub is never loaded.
        state.getRecentConsoleLines.mockReturnValue([]);
        expect(await callAsync('main:app:recent-console')).toEqual([]);
        expect(state.getRecentConsoleLines).toHaveBeenCalledWith(
            appController.mainWin.webContents,
        );
        expect(state.importEsm).not.toHaveBeenCalled();

        // Lines are each passed through `redactSecrets`.
        state.getRecentConsoleLines.mockReturnValue(['key sk-123', 'plain']);
        state.toMcpPackagePath.mockReturnValue('/mcp/firewall.mjs');
        const redactSecrets = vi.fn((line: string) => {
            return line.replace('sk-123', '[redacted]');
        });
        state.importEsm.mockResolvedValue({ redactSecrets });
        expect(await callAsync('main:app:recent-console')).toEqual([
            'key [redacted]',
            'plain',
        ]);
        expect(state.toMcpPackagePath).toHaveBeenCalledWith('firewall.mjs');
        expect(String(state.importEsm.mock.calls[0][0])).toMatch(
            /^file:\/\/.*firewall\.mjs$/,
        );

        // No scrub to be had: no lines rather than unscrubbed ones.
        state.importEsm.mockRejectedValue(new Error('missing'));
        expect(await callAsync('main:app:recent-console')).toEqual([]);
    });

    test('a streamed virtual display screen is captured from its own page', async () => {
        const image = { toDataURL: vi.fn(() => 'data:image/png;base64,AAA') };
        const captureScreen = vi.fn(() => Promise.resolve(image));
        state.getVirtualDisplays.mockReturnValue({ captureScreen });
        initEventListenerApp(createAppController());

        const answer = await callAsync('main:app:capture-window', {
            screenId: 4,
        });

        expect(captureScreen).toHaveBeenCalledWith(4);
        expect(answer).toBe('data:image/png;base64,AAA');
        expect(state.captureMiniScreenImage).not.toHaveBeenCalled();
        expect(state.captureWindowImage).not.toHaveBeenCalled();
    });

    test('reads a monitor wallpaper, or a virtual display own wallpaper', async () => {
        const readWallpaper = vi.fn();
        state.getVirtualDisplays.mockReturnValue({ readWallpaper });
        state.readDisplayWallpaper.mockResolvedValue('data:wallpaper');
        initEventListenerApp(createAppController());

        const sizes = [{ width: 1920, height: 1080 }];
        const monitor = await callAsync('main:app:read-display-wallpaper', {
            displayId: 8,
            displayIndex: 1,
            width: 320,
            sizes,
        });
        expect(monitor).toBe('data:wallpaper');
        expect(state.readDisplayWallpaper).toHaveBeenCalledWith({
            displayIndex: 1,
            width: 320,
            sizes,
        });
        expect(state.forgetDisplayWallpapers).not.toHaveBeenCalled();

        // A forced read forgets what was cached first.
        await callAsync('main:app:read-display-wallpaper', {
            displayIndex: 0,
            isForced: true,
        });
        expect(state.forgetDisplayWallpapers).toHaveBeenCalledTimes(1);

        readWallpaper.mockResolvedValueOnce('data:virtual');
        const virtual = await callAsync('main:app:read-display-wallpaper', {
            displayId: VIRTUAL_DISPLAY_ID,
            displayIndex: 3,
            width: 200,
        });
        expect(virtual).toBe('data:virtual');
        expect(readWallpaper).toHaveBeenCalledWith(VIRTUAL_DISPLAY_ID, 200);
        expect(state.readDisplayWallpaper).toHaveBeenCalledTimes(2);

        // A virtual display with no wallpaper set answers null, not undefined.
        readWallpaper.mockResolvedValueOnce(undefined);
        expect(
            await callAsync('main:app:read-display-wallpaper', {
                displayId: VIRTUAL_DISPLAY_ID,
                displayIndex: 3,
            }),
        ).toBeNull();

        // ...and so does one whose service is gone.
        state.getVirtualDisplays.mockReturnValue(undefined);
        expect(
            await callAsync('main:app:read-display-wallpaper', {
                displayId: VIRTUAL_DISPLAY_ID,
                displayIndex: 3,
            }),
        ).toBeNull();
    });
});

describe('screen doors', () => {
    test('showing on a virtual display with no service answers an error', async () => {
        initEventScreen(createAppController());

        const answer = await callAsync('main:app:show-screen', {
            screenId: 5,
            displayId: VIRTUAL_DISPLAY_ID,
        });

        expect(answer).toBeInstanceOf(Error);
        expect(answer.message).toBe('Virtual display is unavailable');
    });

    test('showing on a monitor closes the virtual page first, without hiding', async () => {
        const output = registerOutput(6);
        const controller = createScreenController();
        state.screenControllerMocks.createInstance.mockReturnValue(controller);
        const appController = createAppController();
        initEventScreen(appController);

        await callAsync('main:app:show-screen', { screenId: 6, displayId: 8 });

        expect(output.isMoving).toBe(true);
        expect(output.close).toHaveBeenCalledTimes(1);
        expect(getVirtualScreenOutput(6)).toBeNull();
        expect(state.screenControllerMocks.createInstance).toHaveBeenCalledWith(
            6,
        );
        expect(controller.listenLoading).toHaveBeenCalledTimes(1);
        expect(controller.setDisplay).toHaveBeenCalledWith({
            id: 8,
            bounds: { x: 1, y: 2 },
        });
        expect(appController.mainWin.focus).toHaveBeenCalledTimes(1);
        expect(
            appController.mainController.sendNotifyInvisibility,
        ).not.toHaveBeenCalled();
    });

    test('a monitor screen moved onto a virtual display is closed, then attached', () => {
        const controller = createScreenController();
        state.screenControllerMocks.getInstance.mockReturnValue(controller);
        const closedCallbacks: (() => void)[] = [];
        const virtualController = {
            isMoving: false,
            onClosed: vi.fn((callback: () => void) => {
                closedCallbacks.push(callback);
            }),
        };
        const order: string[] = [];
        controller.destroyInstance.mockImplementation(() => {
            order.push('destroy');
        });
        controller.close.mockImplementation(() => order.push('close'));
        const attachScreen = vi.fn(() => {
            order.push('attach');
            return virtualController;
        });
        state.getVirtualDisplays.mockReturnValue({ attachScreen });
        const appController = createAppController();
        initEventScreen(appController);

        findOnHandler('main:app:set-screen-display')(
            {},
            { screenId: 9, displayId: VIRTUAL_DISPLAY_ID },
        );

        expect(controller.isMoving).toBe(true);
        expect(order).toEqual(['destroy', 'close', 'attach']);
        expect(attachScreen).toHaveBeenCalledWith(9, VIRTUAL_DISPLAY_ID);
        // The page closing later is a real hide.
        closedCallbacks[0]();
        expect(
            appController.mainController.sendNotifyInvisibility,
        ).toHaveBeenCalledWith(9);
    });

    test('a screen that is not showing is not moved anywhere', () => {
        const attachScreen = vi.fn();
        state.getVirtualDisplays.mockReturnValue({ attachScreen });
        initEventScreen(createAppController());

        findOnHandler('main:app:set-screen-display')(
            {},
            { screenId: 10, displayId: VIRTUAL_DISPLAY_ID },
        );

        expect(attachScreen).not.toHaveBeenCalled();
        expect(
            state.screenControllerMocks.createInstance,
        ).not.toHaveBeenCalled();
    });

    test('a failed move back to a monitor is logged, not thrown', async () => {
        registerOutput(11);
        const controller = createScreenController();
        const failure = new Error('window failed to load');
        controller.listenLoading.mockRejectedValue(failure);
        state.screenControllerMocks.createInstance.mockReturnValue(controller);
        initEventScreen(createAppController());

        findOnHandler('main:app:set-screen-display')(
            {},
            { screenId: 11, displayId: 8 },
        );
        await flushPromises();

        expect(consoleErrorSpy).toHaveBeenCalledWith(failure);
        expect(controller.setDisplay).not.toHaveBeenCalled();
    });

    describe('with a Screen Mirror showing the screen', () => {
        function createMirror(isRemote: boolean | Error) {
            return {
                configure: vi.fn(),
                displays: vi.fn(() => []),
                showingIds: vi.fn(() => [12]),
                retargetOutput: vi.fn(),
                isRemoteDisplay: vi.fn((id: number) => {
                    return id === REMOTE_DISPLAY_ID;
                }),
                isRemoteOutput: vi.fn(() => false),
                hide: vi.fn(),
                prepareOutput: vi.fn(() => {
                    return isRemote instanceof Error
                        ? Promise.reject(isRemote)
                        : Promise.resolve(isRemote);
                }),
            };
        }

        test('a virtual page sent to a remote host closes without hiding', async () => {
            const output = registerOutput(12);
            const mirror = createMirror(true);
            state.getScreenMirror.mockReturnValue(mirror);
            initEventScreen(createAppController());

            findOnHandler('main:app:set-screen-display')(
                {},
                { screenId: 12, displayId: REMOTE_DISPLAY_ID },
            );
            await flushPromises();

            expect(output.isMoving).toBe(true);
            expect(output.close).toHaveBeenCalledTimes(1);
            expect(mirror.prepareOutput).toHaveBeenCalledWith(
                12,
                REMOTE_DISPLAY_ID,
            );
            // The host took it: nothing is opened on this computer.
            expect(
                state.screenControllerMocks.createInstance,
            ).not.toHaveBeenCalled();
        });

        test('a screen back from a host opens on the chosen monitor', async () => {
            const mirror = createMirror(false);
            state.getScreenMirror.mockReturnValue(mirror);
            const existing = createScreenController();
            const created = createScreenController();
            state.screenControllerMocks.getInstance.mockReturnValue(existing);
            state.screenControllerMocks.createInstance.mockReturnValue(created);
            mirror.isRemoteOutput.mockReturnValue(true);
            initEventScreen(createAppController());

            findOnHandler('main:app:set-screen-display')(
                {},
                { screenId: 12, displayId: 8 },
            );
            await flushPromises();

            expect(existing.close).toHaveBeenCalledTimes(1);
            expect(mirror.prepareOutput).toHaveBeenCalledWith(12, 8);
            expect(
                state.screenControllerMocks.createInstance,
            ).toHaveBeenCalledWith(12);
            expect(created.setDisplay).toHaveBeenCalledWith({
                id: 8,
                bounds: { x: 1, y: 2 },
            });
        });

        test('a screen back from a host to an unknown monitor opens nothing', async () => {
            const mirror = createMirror(false);
            mirror.isRemoteOutput.mockReturnValue(true);
            state.getScreenMirror.mockReturnValue(mirror);
            initEventScreen(createAppController());

            findOnHandler('main:app:set-screen-display')(
                {},
                { screenId: 12, displayId: 99 },
            );
            await flushPromises();

            expect(mirror.prepareOutput).toHaveBeenCalledWith(12, 99);
            expect(
                state.screenControllerMocks.createInstance,
            ).not.toHaveBeenCalled();
        });

        test('a screen back from a host to a virtual display is attached there', async () => {
            const mirror = createMirror(false);
            mirror.isRemoteOutput.mockReturnValue(true);
            state.getScreenMirror.mockReturnValue(mirror);
            const attachScreen = vi.fn(() => ({ onClosed: vi.fn() }));
            state.getVirtualDisplays.mockReturnValue({ attachScreen });
            initEventScreen(createAppController());

            findOnHandler('main:app:set-screen-display')(
                {},
                { screenId: 12, displayId: OTHER_VIRTUAL_DISPLAY_ID },
            );
            await flushPromises();

            expect(attachScreen).toHaveBeenCalledWith(
                12,
                OTHER_VIRTUAL_DISPLAY_ID,
            );
        });

        test('a host that refuses the screen is logged by its message', async () => {
            const mirror = createMirror(new Error('host went away'));
            state.getScreenMirror.mockReturnValue(mirror);
            initEventScreen(createAppController());

            findOnHandler('main:app:set-screen-display')(
                {},
                { screenId: 12, displayId: REMOTE_DISPLAY_ID },
            );
            await flushPromises();

            expect(consoleErrorSpy).toHaveBeenCalledWith('host went away');
            expect(
                state.screenControllerMocks.createInstance,
            ).not.toHaveBeenCalled();
        });
    });
});

describe('other doors', () => {
    test('only a .pdf by name is turned into chat pages', async () => {
        state.pdfToChatPages.mockResolvedValue({
            isSuccessful: true,
            pages: ['p1'],
        });
        initEventOther(createAppController());

        expect(
            await callAsync('main:app:pdf-to-chat-pages', {
                filePath: '/docs/notes.txt',
            }),
        ).toEqual({ isSuccessful: false, message: 'Not a PDF file' });
        expect(
            await callAsync('main:app:pdf-to-chat-pages', { filePath: 7 }),
        ).toEqual({ isSuccessful: false, message: 'Not a PDF file' });
        expect(state.pdfToChatPages).not.toHaveBeenCalled();

        const answer = await callAsync('main:app:pdf-to-chat-pages', {
            filePath: '/docs/Sermon.PDF',
            startPage: 2,
            maxPages: 4,
            longEdge: 1024,
            allPages: true,
        });
        expect(state.pdfToChatPages).toHaveBeenCalledWith(
            '/docs/Sermon.PDF',
            2,
            4,
            1024,
            true,
        );
        expect(answer).toEqual({ isSuccessful: true, pages: ['p1'] });
    });

    test('camera access needs no ask off macOS', async () => {
        state.isMac = false;
        initEventOther(createAppController());

        expect(await callAsync('main:app:ask-camera-access')).toBe(true);
        expect(
            electronMockState.systemPreferences.askForMediaAccess,
        ).not.toHaveBeenCalled();
    });

    test('the chatbot busy dot is broadcast on change and cleared when its window dies', () => {
        const appController = createAppController();
        initEventOther(appController);
        const setBusy = findOnHandler('all:app:chatbot-busy');
        const destroyedCallbacks: (() => void)[] = [];
        const chatbot = {
            once: vi.fn((name: string, callback: () => void) => {
                if (name === 'destroyed') destroyedCallbacks.push(callback);
            }),
        };

        setBusy({ sender: chatbot }, { isBusy: true });
        expect(appController.sendMessageToAll).toHaveBeenCalledTimes(1);
        expect(appController.sendMessageToAll).toHaveBeenLastCalledWith(
            'main:app:chatbot-busy',
            { isBusy: true },
        );

        // The same state again is not re-broadcast, and the window is watched
        // only once.
        setBusy({ sender: chatbot }, { isBusy: true });
        expect(appController.sendMessageToAll).toHaveBeenCalledTimes(1);
        expect(chatbot.once).toHaveBeenCalledTimes(1);

        // A window opened mid-answer asks, and is answered on its own.
        const asker = { send: vi.fn() };
        findOnHandler('all:app:get-chatbot-busy')({ sender: asker });
        expect(asker.send).toHaveBeenCalledWith('main:app:chatbot-busy', {
            isBusy: true,
        });

        // The help window closing mid-answer turns the dot off.
        destroyedCallbacks[0]();
        expect(appController.sendMessageToAll).toHaveBeenCalledTimes(2);
        expect(appController.sendMessageToAll).toHaveBeenLastCalledWith(
            'main:app:chatbot-busy',
            { isBusy: false },
        );
        findOnHandler('all:app:get-chatbot-busy')({ sender: asker });
        expect(asker.send).toHaveBeenLastCalledWith('main:app:chatbot-busy', {
            isBusy: false,
        });

        // Anything but a strict `true` reads as idle.
        setBusy({ sender: chatbot }, { isBusy: 'yes' });
        setBusy({ sender: chatbot }, null);
        expect(appController.sendMessageToAll).toHaveBeenCalledTimes(2);
    });

    test('custom LLM, registry and report channels reach their helpers', async () => {
        initEventOther(createAppController());
        const sender = { send: vi.fn() };

        state.handleCustomLlmFetch.mockResolvedValue({ ok: true, status: 200 });
        const fetchRequest = { requestId: 'r1', serverId: 's', call: 'models' };
        expect(
            await callAsync(CUSTOM_LLM_FETCH_CHANNEL, fetchRequest, sender),
        ).toEqual({ ok: true, status: 200 });
        expect(state.handleCustomLlmFetch).toHaveBeenCalledWith(
            expect.objectContaining(fetchRequest),
            sender,
        );

        findOnHandler(CUSTOM_LLM_CANCEL_CHANNEL)({}, { requestId: 'r1' });
        expect(state.cancelCustomLlmFetch).toHaveBeenCalledWith('r1');
        findOnHandler(CUSTOM_LLM_CANCEL_CHANNEL)({}, undefined);
        expect(state.cancelCustomLlmFetch).toHaveBeenLastCalledWith(undefined);

        state.getLlmRegistryStatus.mockReturnValue({ entries: 2 });
        expect(await callAsync(LLM_REGISTRY_GET_CHANNEL)).toEqual({
            entries: 2,
        });
        state.refreshLlmRegistry.mockResolvedValue({ entries: 3 });
        expect(await callAsync(LLM_REGISTRY_RELOAD_CHANNEL)).toEqual({
            entries: 3,
        });
        expect(state.refreshLlmRegistry).toHaveBeenCalledTimes(1);

        state.handleLlmReportPost.mockResolvedValue({ isSent: true });
        const report = { requestId: 'p1', entryId: 'e', text: 'it broke' };
        expect(await callAsync(LLM_REPORT_POST_CHANNEL, report)).toEqual({
            isSent: true,
        });
        expect(state.handleLlmReportPost).toHaveBeenCalledWith(
            expect.objectContaining(report),
        );
        findOnHandler(LLM_REPORT_CANCEL_CHANNEL)({}, { requestId: 'p1' });
        expect(state.cancelLlmReportPost).toHaveBeenCalledWith('p1');
    });
});
