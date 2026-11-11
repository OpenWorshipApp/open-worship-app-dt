import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The doors of `electronEventListener.ts` the other suites leave shut: the
// help and AI Chat windows' asks, the wallpaper reader, screens handed
// between monitors, virtual displays and other computers, the 🤖 busy dot
// and the model-server relays. Every collaborator is a stand-in built here.

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const { fixture, mocks } = vi.hoisted(() => {
    // A screen window on a monitor, as `ElectronScreenController` keeps one
    // per screen id until it is destroyed.
    class FakeScreen {
        isMoving = false;
        readonly win = { on: vi.fn() };
        readonly listenLoading = vi.fn(async () => undefined);
        readonly setDisplay = vi.fn();
        readonly close = vi.fn();
        readonly destroyInstance = vi.fn(() => {
            fixture.screens.delete(this.screenId);
        });
        constructor(readonly screenId: number) {}
    }
    const fixture = {
        isMac: false,
        mirror: undefined as any,
        virtualDisplays: undefined as any,
        screens: new Map<number, FakeScreen>(),
        // Called on every window `createInstance` makes, before it is used.
        prepareScreen: null as ((screen: FakeScreen) => void) | null,
        mcpDirectory: '',
        FakeScreen,
    };
    const mocks = {
        listAppWindows: vi.fn(),
        getRemoteDebuggingPort: vi.fn(),
        importEsm: vi.fn(),
        toMcpPackagePath: vi.fn(),
        getRecentConsoleLines: vi.fn(),
        claimAiChatWindowSlot: vi.fn(),
        handAiChatTab: vi.fn(),
        takeAiChatTab: vi.fn(),
        forgetDisplayWallpapers: vi.fn(),
        readDisplayWallpaper: vi.fn(),
        captureWindowImage: vi.fn(),
        captureMiniScreenImage: vi.fn(),
        pdfToChatPages: vi.fn(),
        handleCustomLlmFetch: vi.fn(),
        cancelCustomLlmFetch: vi.fn(),
        getLlmRegistryStatus: vi.fn(),
        refreshLlmRegistry: vi.fn(),
        handleLlmReportPost: vi.fn(),
        cancelLlmReportPost: vi.fn(),
        getSystemFontListMap: vi.fn(),
    };
    return { fixture, mocks };
});

vi.mock('./electronHelpers', () => ({
    attemptClosing: vi.fn(),
    captureWebScreenShot: vi.fn(),
    captureMiniScreenImage: mocks.captureMiniScreenImage,
    captureWindowImage: mocks.captureWindowImage,
    findScreenWindow: vi.fn(),
    getUpdatePageUrl: vi.fn(),
    goDownload: vi.fn(),
    get isMac() {
        return fixture.isMac;
    },
    messageChannels: { screenMessage: 'app:screen:message' },
    previewPrintCurrentWindow: vi.fn(),
    printHTMLContent: vi.fn(),
    setGuideRunning: vi.fn(),
    askGuideHelp: vi.fn(),
    answerGuideHelp: vi.fn(),
    sendChatAttachment: vi.fn(),
    takeChatAttachment: vi.fn(),
    tarAppend: vi.fn(),
    tarCreate: vi.fn(),
    tarExtract: vi.fn(),
}));
vi.mock('./aiHelpers', () => ({
    getMcpToken: vi.fn(),
    getMcpUrl: vi.fn(),
    getRemoteDebuggingPort: mocks.getRemoteDebuggingPort,
    importEsm: mocks.importEsm,
    republishAiLangDirs: vi.fn(),
    toMcpPackagePath: mocks.toMcpPackagePath,
}));
vi.mock('./consoleLogHelpers', () => ({
    getRecentConsoleLines: mocks.getRecentConsoleLines,
}));
vi.mock('./appWindowListHelpers', () => ({
    listAppWindows: mocks.listAppWindows,
    checkIsWatchedPageUrl: () => false,
}));
vi.mock('./aiChatGuestHelpers', () => ({
    AI_CHAT_MICROPHONE_ANSWER_CHANNEL: 'main:app:ai-chat-microphone-answer',
    answerAiChatMicrophoneAsk: vi.fn(),
    clearAiChatGuestData: vi.fn(),
}));
vi.mock('./aiChatWindowHelpers', () => ({
    AI_CHAT_HAND_TAB_CHANNEL: 'main:app:ai-chat-hand-tab',
    AI_CHAT_TAKE_TAB_CHANNEL: 'main:app:ai-chat-take-tab',
    AI_CHAT_WINDOW_SLOT_CHANNEL: 'main:app:ai-chat-window-slot',
    claimAiChatWindowSlot: mocks.claimAiChatWindowSlot,
    handAiChatTab: mocks.handAiChatTab,
    takeAiChatTab: mocks.takeAiChatTab,
    tellOtherAiChatWindowsSignedOut: vi.fn(),
}));
vi.mock('./archiveCryptoHelpers', () => ({
    checkIsEncryptedFile: vi.fn(),
    decryptFile: vi.fn(),
    encryptFile: vi.fn(),
}));
vi.mock('./displayWallpaperHelpers', () => ({
    forgetDisplayWallpapers: mocks.forgetDisplayWallpapers,
    readDisplayWallpaper: mocks.readDisplayWallpaper,
}));
vi.mock('./finderOverlayHelpers', () => ({
    closeFindOverlay: vi.fn(),
    getFindOverlayHostWebContents: vi.fn(),
    getFindOverlayWebContents: vi.fn(),
    setFindOverlayMounted: vi.fn(),
    startFindOverlayDragging: vi.fn(),
    stopFindOverlayDragging: vi.fn(),
}));
vi.mock('./ElectronScreenController', () => ({
    default: {
        getInstance: (screenId: number) => {
            return fixture.screens.get(screenId) ?? null;
        },
        createInstance: (screenId: number) => {
            let screen = fixture.screens.get(screenId);
            if (screen === undefined) {
                screen = new fixture.FakeScreen(screenId);
                fixture.prepareScreen?.(screen);
                fixture.screens.set(screenId, screen);
            }
            return screen;
        },
        closeAll: () => {
            fixture.screens.clear();
        },
        getAllIds: () => {
            return [...fixture.screens.keys()];
        },
    },
}));
vi.mock('./screenMirrorService', () => ({
    getScreenMirror: () => fixture.mirror,
}));
vi.mock('./virtualDisplayService', () => ({
    getVirtualDisplays: () => fixture.virtualDisplays,
}));
vi.mock('./electronOfficeHelpers', () => ({ officeFileToPdf: vi.fn() }));
vi.mock('./pdfToImagesHelpers', () => ({
    getPagesCount: vi.fn(),
    pdfToChatPages: mocks.pdfToChatPages,
    pdfToImages: vi.fn(),
}));
vi.mock('./msHelpers', () => ({
    docxToHtmls: vi.fn(),
    getDocxToHtmlsVersion: vi.fn(),
    pptxToHtmls: vi.fn(),
    getPptxToHtmlsVersion: vi.fn(),
    getPptxSlidesCount: vi.fn(),
}));
vi.mock('./electronMenu', () => ({
    initMenu: vi.fn(),
    sendMenuClicked: vi.fn(),
    sendMenuClickedToAllWindows: vi.fn(),
    setCustomMenusData: vi.fn(),
}));
vi.mock('./appMenuAgentHelpers', () => ({
    AGENT_MENU_CLICK_CHANNEL: 'main:app:agent-menu-click',
    AGENT_MENU_LIST_CHANNEL: 'main:app:agent-menu-list',
    clickAgentMenuItem: vi.fn(),
    listAgentMenuItems: vi.fn(),
}));
vi.mock('./oauthHelpers', () => ({ captureOAuthRedirectUrl: vi.fn() }));
vi.mock('./taskbarHelpers', () => ({ relaunchApp: vi.fn() }));
vi.mock('./webPageHelpers', () => ({ readWebPage: vi.fn() }));
vi.mock('./clipboardHelpers', () => ({ writeClipboardText: vi.fn() }));
vi.mock('./customLlmRelayHelpers', () => ({
    cancelCustomLlmFetch: mocks.cancelCustomLlmFetch,
    handleCustomLlmFetch: mocks.handleCustomLlmFetch,
}));
vi.mock('./llmRegistryHelpers', () => ({
    getLlmRegistryStatus: mocks.getLlmRegistryStatus,
    refreshLlmRegistry: mocks.refreshLlmRegistry,
}));
vi.mock('./llmReportHelpers', () => ({
    cancelLlmReportPost: mocks.cancelLlmReportPost,
    handleLlmReportPost: mocks.handleLlmReportPost,
}));
vi.mock('./fontListHelpers', () => ({
    getSystemFontListMap: mocks.getSystemFontListMap,
}));

import {
    CUSTOM_LLM_CANCEL_CHANNEL,
    CUSTOM_LLM_FETCH_CHANNEL,
    LLM_REGISTRY_GET_CHANNEL,
    LLM_REGISTRY_RELOAD_CHANNEL,
    LLM_REPORT_CANCEL_CHANNEL,
    LLM_REPORT_POST_CHANNEL,
} from './customLlmProtocol';
import {
    initEventListenerApp,
    initEventOther,
    initEventScreen,
} from './electronEventListener';
import {
    getVirtualScreenOutput,
    removeVirtualScreenOutput,
    setVirtualScreenOutput,
    type ScreenOutputType,
} from './screenOutputRegistry';
import { electronMockState } from './testElectronModule';
import { VIRTUAL_DISPLAY_ID_BASE } from './virtualDisplayProtocol';

const VIRTUAL_DISPLAY_ID = VIRTUAL_DISPLAY_ID_BASE - 1;
const MONITOR = { id: 8, bounds: { x: 1920, y: 0, width: 1280, height: 720 } };
const REMOTE_DISPLAY_ID = 900;

type FakeSender = ReturnType<typeof makeSender>;

function makeSender(id = 1) {
    const listeners = new Map<string, () => void>();
    return {
        id,
        send: vi.fn(),
        once: vi.fn((eventName: string, listener: () => void) => {
            listeners.set(eventName, listener);
        }),
        emit(eventName: string) {
            listeners.get(eventName)?.();
        },
    };
}

function makeAppController() {
    return {
        mainWin: {
            focus: vi.fn(),
            webContents: { id: 1, send: vi.fn() },
        },
        mainController: {
            sendScreenMessage: vi.fn(),
            changeBible: vi.fn(),
            sendNotifyInvisibility: vi.fn(),
            syncStayAwake: vi.fn(),
        },
        settingManager: {
            themeSource: 'system',
            primaryDisplay: { id: 1 },
            allDisplays: [{ id: 1 }, MONITOR],
            getDisplayById: (displayId: number) => {
                return displayId === MONITOR.id ? MONITOR : undefined;
            },
        },
        resetThemeBackgroundColor: vi.fn(),
        reloadAll: vi.fn(),
        sendMessageToAll: vi.fn(),
    } as any;
}

// The handler registered last on a channel: each test inits afresh.
function handlerOf(channel: string) {
    const handler = electronMockState.ipcMain.on.mock.calls
        .filter(([name]) => name === channel)
        .at(-1)?.[1];
    if (handler === undefined) {
        throw new Error(`Nothing listens on ${channel}`);
    }
    return handler as (...args: any[]) => any;
}

// An `onAsync` door: asked with a reply channel, answered on it once.
async function ask(
    channel: string,
    data: Record<string, unknown> = {},
    sender: FakeSender = makeSender(),
) {
    await handlerOf(channel)({ sender }, { replyEventName: 'reply', ...data });
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(sender.send.mock.calls[0][0]).toBe('reply');
    return sender.send.mock.calls[0][1];
}

// A synchronous door: answered in `event.returnValue`.
function askSync(channel: string, sender: FakeSender, ...args: unknown[]) {
    const event: { sender: FakeSender; returnValue?: unknown } = { sender };
    handlerOf(channel)(event, ...args);
    return event.returnValue;
}

function flush() {
    return new Promise<void>((resolve) => setImmediate(resolve));
}

const registeredOutputs: [number, ScreenOutputType][] = [];

// A screen shown as a page in a virtual display's compositor.
function showOnVirtualDisplay(screenId: number) {
    const output = {
        screenId,
        isMoving: false,
        sendData: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => removeVirtualScreenOutput(screenId, output)),
    };
    setVirtualScreenOutput(screenId, output);
    registeredOutputs.push([screenId, output]);
    return output;
}

function makeVirtualDisplays() {
    const closedCallbacks: (() => void)[] = [];
    const controller = {
        isMoving: false,
        onClosed: vi.fn((callback: () => void) => {
            closedCallbacks.push(callback);
        }),
    };
    return {
        controller,
        closedCallbacks,
        displays: vi.fn(() => [{ id: VIRTUAL_DISPLAY_ID }]),
        attachScreen: vi.fn(() => controller),
        moveScreen: vi.fn(),
        closeAllScreens: vi.fn(),
        captureScreen: vi.fn(),
        readWallpaper: vi.fn(),
    };
}

// Screen Mirror as `electronEventListener` sees it: which displays are on
// another computer, which screens are output there, and the hand-over.
function makeMirror({
    showingIds = [] as number[],
    remoteOutputIds = [] as number[],
} = {}) {
    return {
        configure: vi.fn(),
        displays: vi.fn(() => [{ id: REMOTE_DISPLAY_ID }]),
        showingIds: vi.fn(() => showingIds),
        isRemoteDisplay: vi.fn((id: number) => id === REMOTE_DISPLAY_ID),
        isRemoteOutput: vi.fn((id: number) => remoteOutputIds.includes(id)),
        prepareOutput: vi.fn(async (): Promise<boolean> => true),
        retargetOutput: vi.fn(),
        hide: vi.fn(),
    };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    electronMockState.reset();
    fixture.isMac = false;
    fixture.mirror = undefined;
    fixture.virtualDisplays = undefined;
    fixture.screens.clear();
    fixture.prepareScreen = null;
    fixture.mcpDirectory = path.join(os.tmpdir(), 'owa-mcp-package');
    mocks.getRemoteDebuggingPort.mockReturnValue(51234);
    mocks.toMcpPackagePath.mockImplementation((name: string) => {
        return path.join(fixture.mcpDirectory, name);
    });
    mocks.getSystemFontListMap.mockResolvedValue({ Arial: ['400'] });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    for (const [screenId, output] of registeredOutputs.splice(0)) {
        removeVirtualScreenOutput(screenId, output);
    }
    consoleError.mockRestore();
});

describe('the help and AI Chat windows’ asks', () => {
    test('the window picker lists the windows on this launch’s debugging port', async () => {
        const windows = [{ id: 'main', title: 'Presenter' }];
        mocks.listAppWindows.mockResolvedValue(windows);
        initEventListenerApp(makeAppController());

        expect(await ask('main:app:list-app-windows')).toBe(windows);
        expect(mocks.listAppWindows).toHaveBeenCalledWith(51234);
    });

    test('an AI Chat window claims its slot, hands a tab over and takes one, each answered at once', () => {
        const sender = makeSender(7);
        const tab = { url: 'https://chat.example/', title: 'Chat' };
        mocks.claimAiChatWindowSlot.mockReturnValue(2);
        mocks.handAiChatTab.mockReturnValue(true);
        mocks.takeAiChatTab.mockReturnValue(tab);
        initEventListenerApp(makeAppController());

        expect(askSync('main:app:ai-chat-window-slot', sender)).toBe(2);
        expect(mocks.claimAiChatWindowSlot).toHaveBeenCalledWith(sender);
        expect(askSync('main:app:ai-chat-hand-tab', sender, tab)).toBe(true);
        expect(mocks.handAiChatTab).toHaveBeenCalledWith(sender, tab);
        expect(askSync('main:app:ai-chat-take-tab', sender)).toBe(tab);
        expect(mocks.takeAiChatTab).toHaveBeenCalledWith(sender);
    });
});

describe('the recent console lines for a problem report', () => {
    test('leave main through the firewall’s scrub', async () => {
        const appController = makeAppController();
        mocks.getRecentConsoleLines.mockReturnValue([
            'Error: provider said no to sk-live-123456',
            'Warning: slow paint',
        ]);
        mocks.importEsm.mockResolvedValue({
            redactSecrets: (line: string) => {
                return line.replace(/sk-live-\w+/g, '[redacted]');
            },
        });
        initEventListenerApp(appController);

        expect(await ask('main:app:recent-console')).toEqual([
            'Error: provider said no to [redacted]',
            'Warning: slow paint',
        ]);
        expect(mocks.getRecentConsoleLines).toHaveBeenCalledWith(
            appController.mainWin.webContents,
        );
        expect(mocks.importEsm).toHaveBeenCalledWith(
            pathToFileURL(
                path.join(fixture.mcpDirectory, 'firewall.mjs'),
            ).toString(),
        );
    });

    test('none to send loads no scrub', async () => {
        mocks.getRecentConsoleLines.mockReturnValue([]);
        initEventListenerApp(makeAppController());

        expect(await ask('main:app:recent-console')).toEqual([]);
        expect(mocks.importEsm).not.toHaveBeenCalled();
    });

    test('a scrub that cannot be loaded sends no lines rather than raw ones', async () => {
        mocks.getRecentConsoleLines.mockReturnValue([
            'Error: provider said no to sk-live-123456',
        ]);
        mocks.importEsm.mockRejectedValue(new Error('Cannot find module'));
        initEventListenerApp(makeAppController());

        expect(await ask('main:app:recent-console')).toEqual([]);
    });
});

describe('pictures of what the operator sees', () => {
    test('a screen on a virtual display is photographed from its page', async () => {
        const virtualDisplays = makeVirtualDisplays();
        virtualDisplays.captureScreen.mockResolvedValue({
            toDataURL: () => 'data:image/png;base64,UEFHRQ==',
        });
        fixture.virtualDisplays = virtualDisplays;
        initEventListenerApp(makeAppController());

        expect(await ask('main:app:capture-window', { screenId: 4 })).toBe(
            'data:image/png;base64,UEFHRQ==',
        );
        expect(virtualDisplays.captureScreen).toHaveBeenCalledWith(4);
        expect(mocks.captureWindowImage).not.toHaveBeenCalled();
        expect(mocks.captureMiniScreenImage).not.toHaveBeenCalled();
    });

    test('a monitor’s wallpaper is read from the system, kept unless forced', async () => {
        const sizes = [{ width: 1920, height: 1080 }];
        mocks.readDisplayWallpaper.mockResolvedValue('data:image/jpeg;x');
        initEventListenerApp(makeAppController());

        expect(
            await ask('main:app:read-display-wallpaper', {
                displayId: MONITOR.id,
                displayIndex: 1,
                width: 320,
                sizes,
            }),
        ).toBe('data:image/jpeg;x');
        expect(mocks.readDisplayWallpaper).toHaveBeenCalledWith({
            displayIndex: 1,
            width: 320,
            sizes,
        });
        expect(mocks.forgetDisplayWallpapers).not.toHaveBeenCalled();

        await ask('main:app:read-display-wallpaper', {
            displayIndex: 0,
            isForced: true,
        });
        expect(mocks.forgetDisplayWallpapers).toHaveBeenCalledOnce();
        expect(
            mocks.forgetDisplayWallpapers.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.readDisplayWallpaper.mock.invocationCallOrder[1]);
    });

    test('a virtual display’s wallpaper is its own setting, and none is null', async () => {
        const virtualDisplays = makeVirtualDisplays();
        virtualDisplays.readWallpaper.mockResolvedValueOnce('data:image/png;v');
        fixture.virtualDisplays = virtualDisplays;
        initEventListenerApp(makeAppController());
        const request = {
            displayId: VIRTUAL_DISPLAY_ID,
            displayIndex: 2,
            width: 480,
        };

        expect(await ask('main:app:read-display-wallpaper', request)).toBe(
            'data:image/png;v',
        );
        expect(virtualDisplays.readWallpaper).toHaveBeenCalledWith(
            VIRTUAL_DISPLAY_ID,
            480,
        );
        // Nothing set for that display.
        virtualDisplays.readWallpaper.mockResolvedValueOnce(undefined);
        expect(await ask('main:app:read-display-wallpaper', request)).toBe(
            null,
        );
        // No virtual displays on this computer at all.
        fixture.virtualDisplays = undefined;
        expect(await ask('main:app:read-display-wallpaper', request)).toBe(
            null,
        );
        expect(mocks.readDisplayWallpaper).not.toHaveBeenCalled();
    });
});

describe('screens between monitors and virtual displays', () => {
    test('showing on a virtual display where there are none answers an error', async () => {
        initEventScreen(makeAppController());

        const answer = await ask('main:app:show-screen', {
            screenId: 3,
            displayId: VIRTUAL_DISPLAY_ID,
        });

        expect(answer).toBeInstanceOf(Error);
        expect((answer as Error).message).toBe(
            'Virtual display is unavailable',
        );
        expect(fixture.screens.size).toBe(0);
    });

    test('a screen on a virtual display shown on a monitor leaves its page first', async () => {
        const appController = makeAppController();
        const output = showOnVirtualDisplay(6);
        initEventScreen(appController);

        expect(
            await ask('main:app:show-screen', {
                screenId: 6,
                displayId: MONITOR.id,
            }),
        ).toBeUndefined();

        expect(output.isMoving).toBe(true);
        expect(output.close).toHaveBeenCalledOnce();
        expect(getVirtualScreenOutput(6)).toBeNull();
        const screen = fixture.screens.get(6)!;
        expect(screen.listenLoading).toHaveBeenCalledOnce();
        expect(screen.setDisplay).toHaveBeenCalledWith(MONITOR);
        expect(appController.mainWin.focus).toHaveBeenCalledOnce();
        // A move: the presenter is not told the screen hid.
        expect(
            appController.mainController.sendNotifyInvisibility,
        ).not.toHaveBeenCalled();
    });

    test('a monitor screen moved onto a virtual display closes its window without a hide', async () => {
        const appController = makeAppController();
        const mirror = makeMirror();
        const virtualDisplays = makeVirtualDisplays();
        fixture.mirror = mirror;
        fixture.virtualDisplays = virtualDisplays;
        const screen = new fixture.FakeScreen(7);
        fixture.screens.set(7, screen);
        initEventScreen(appController);

        handlerOf('main:app:set-screen-display')(
            {},
            { screenId: 7, displayId: VIRTUAL_DISPLAY_ID },
        );
        await flush();

        expect(mirror.retargetOutput).toHaveBeenCalledWith(
            7,
            VIRTUAL_DISPLAY_ID,
        );
        expect(screen.isMoving).toBe(true);
        expect(screen.destroyInstance).toHaveBeenCalledOnce();
        expect(screen.close).toHaveBeenCalledOnce();
        expect(fixture.screens.has(7)).toBe(false);
        expect(virtualDisplays.attachScreen).toHaveBeenCalledWith(
            7,
            VIRTUAL_DISPLAY_ID,
        );
        expect(
            appController.mainController.sendNotifyInvisibility,
        ).not.toHaveBeenCalled();

        // Its page closing for good is the screen hiding.
        virtualDisplays.closedCallbacks[0]();
        expect(mirror.hide).toHaveBeenCalledWith(7);
        expect(
            appController.mainController.sendNotifyInvisibility,
        ).toHaveBeenCalledWith(7);
    });

    test('a move whose window fails to load is logged, not thrown', async () => {
        const output = showOnVirtualDisplay(6);
        const failure = new Error('Screen page failed to load');
        fixture.prepareScreen = (screen) => {
            screen.listenLoading.mockRejectedValue(failure);
        };
        initEventScreen(makeAppController());

        handlerOf('main:app:set-screen-display')(
            {},
            { screenId: 6, displayId: MONITOR.id },
        );
        await flush();

        expect(output.close).toHaveBeenCalledOnce();
        expect(fixture.screens.get(6)?.setDisplay).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(failure);
    });
});

describe('screens handed to and from another computer', () => {
    test('a screen on a virtual display handed to another computer leaves its page', async () => {
        const mirror = makeMirror({ showingIds: [6] });
        fixture.mirror = mirror;
        const output = showOnVirtualDisplay(6);
        initEventScreen(makeAppController());

        handlerOf('main:app:set-screen-display')(
            {},
            { screenId: 6, displayId: REMOTE_DISPLAY_ID },
        );
        await flush();

        expect(output.isMoving).toBe(true);
        expect(output.close).toHaveBeenCalledOnce();
        expect(getVirtualScreenOutput(6)).toBeNull();
        expect(mirror.prepareOutput).toHaveBeenCalledWith(6, REMOTE_DISPLAY_ID);
        // The other computer shows it: nothing opens here.
        expect(fixture.screens.size).toBe(0);
    });

    test('a monitor screen handed to another computer closes its window', async () => {
        const mirror = makeMirror({ showingIds: [5] });
        fixture.mirror = mirror;
        const screen = new fixture.FakeScreen(5);
        fixture.screens.set(5, screen);
        initEventScreen(makeAppController());

        handlerOf('main:app:set-screen-display')(
            {},
            { screenId: 5, displayId: REMOTE_DISPLAY_ID },
        );
        await flush();

        expect(screen.close).toHaveBeenCalledOnce();
        expect(screen.setDisplay).not.toHaveBeenCalled();
        expect(mirror.prepareOutput).toHaveBeenCalledWith(5, REMOTE_DISPLAY_ID);
    });

    test('a screen back from another computer opens on the chosen monitor, if it is still there', async () => {
        const mirror = makeMirror({ showingIds: [5], remoteOutputIds: [5] });
        mirror.prepareOutput.mockResolvedValue(false);
        fixture.mirror = mirror;
        initEventScreen(makeAppController());
        const setScreenDisplay = handlerOf('main:app:set-screen-display');

        setScreenDisplay({}, { screenId: 5, displayId: MONITOR.id });
        await flush();
        expect(mirror.prepareOutput).toHaveBeenCalledWith(5, MONITOR.id);
        expect(fixture.screens.get(5)?.setDisplay).toHaveBeenCalledWith(
            MONITOR,
        );

        // A monitor unplugged meanwhile: no window for it.
        fixture.screens.clear();
        setScreenDisplay({}, { screenId: 5, displayId: 77 });
        await flush();
        expect(mirror.prepareOutput).toHaveBeenLastCalledWith(5, 77);
        expect(fixture.screens.size).toBe(0);
    });

    test('a screen back from another computer onto a virtual display is attached there', async () => {
        const appController = makeAppController();
        const mirror = makeMirror({ showingIds: [5], remoteOutputIds: [5] });
        mirror.prepareOutput.mockResolvedValue(false);
        const virtualDisplays = makeVirtualDisplays();
        fixture.mirror = mirror;
        fixture.virtualDisplays = virtualDisplays;
        initEventScreen(appController);

        handlerOf('main:app:set-screen-display')(
            {},
            { screenId: 5, displayId: VIRTUAL_DISPLAY_ID },
        );
        await flush();

        expect(virtualDisplays.attachScreen).toHaveBeenCalledWith(
            5,
            VIRTUAL_DISPLAY_ID,
        );
        expect(fixture.screens.size).toBe(0);
        // Moved on again: not a hide.
        virtualDisplays.controller.isMoving = true;
        virtualDisplays.closedCallbacks[0]();
        expect(
            appController.mainController.sendNotifyInvisibility,
        ).not.toHaveBeenCalled();
    });

    test('a hand-over that fails is logged by its message', async () => {
        const mirror = makeMirror({ showingIds: [5], remoteOutputIds: [5] });
        mirror.prepareOutput.mockRejectedValue(new Error('Host went away'));
        fixture.mirror = mirror;
        initEventScreen(makeAppController());

        handlerOf('main:app:set-screen-display')(
            {},
            { screenId: 5, displayId: MONITOR.id },
        );
        await flush();

        expect(consoleError).toHaveBeenCalledWith('Host went away');
        expect(fixture.screens.size).toBe(0);
    });
});

describe('the assistant’s other doors', () => {
    test('only a file named .pdf is turned into pages', async () => {
        const pages = { isSuccessful: true, pages: ['data:image/png;p1'] };
        mocks.pdfToChatPages.mockResolvedValue(pages);
        initEventOther(makeAppController());

        for (const filePath of [undefined, 42, 'C:/notes/sermon.docx']) {
            expect(
                await ask('main:app:pdf-to-chat-pages', { filePath }),
            ).toEqual({ isSuccessful: false, message: 'Not a PDF file' });
        }
        expect(mocks.pdfToChatPages).not.toHaveBeenCalled();

        expect(
            await ask('main:app:pdf-to-chat-pages', {
                filePath: 'C:/notes/Order of Service.PDF',
                startPage: 3,
                maxPages: 4,
                longEdge: 1024,
                allPages: true,
            }),
        ).toBe(pages);
        expect(mocks.pdfToChatPages).toHaveBeenCalledWith(
            'C:/notes/Order of Service.PDF',
            3,
            4,
            1024,
            true,
        );
    });

    test('off a Mac the camera is not asked for', async () => {
        initEventOther(makeAppController());

        expect(await ask('main:app:ask-camera-access')).toBe(true);
        expect(
            electronMockState.systemPreferences.askForMediaAccess,
        ).not.toHaveBeenCalled();
    });

    test('the 🤖 busy dot is told to every window once per change, and goes out with its window', async () => {
        const appController = makeAppController();
        initEventOther(appController);
        const setBusy = handlerOf('all:app:chatbot-busy');
        const helpWindow = makeSender(11);
        const busyMessages = () => {
            return appController.sendMessageToAll.mock.calls.filter(
                ([channel]: [string]) => channel === 'main:app:chatbot-busy',
            );
        };

        setBusy({ sender: helpWindow }, { isBusy: true });
        setBusy({ sender: helpWindow }, { isBusy: true });
        expect(busyMessages()).toEqual([
            ['main:app:chatbot-busy', { isBusy: true }],
        ]);

        // A window opened mid-answer asks, and is answered on its own line.
        const otherWindow = makeSender(12);
        handlerOf('all:app:get-chatbot-busy')({ sender: otherWindow });
        expect(otherWindow.send).toHaveBeenCalledWith('main:app:chatbot-busy', {
            isBusy: true,
        });

        // Anything but `true` is not busy.
        setBusy({ sender: helpWindow }, { isBusy: 'yes' });
        expect(busyMessages().at(-1)).toEqual([
            'main:app:chatbot-busy',
            { isBusy: false },
        ]);
        setBusy({ sender: helpWindow }, { isBusy: true });
        expect(helpWindow.once).toHaveBeenCalledOnce();

        // The help window closes mid-answer: the dot goes out.
        helpWindow.emit('destroyed');
        expect(busyMessages()).toHaveLength(4);
        expect(busyMessages().at(-1)).toEqual([
            'main:app:chatbot-busy',
            { isBusy: false },
        ]);
        handlerOf('all:app:get-chatbot-busy')({ sender: otherWindow });
        expect(otherWindow.send).toHaveBeenLastCalledWith(
            'main:app:chatbot-busy',
            { isBusy: false },
        );
    });

    test('a custom model server is reached through the relay, and a stop reaches it', async () => {
        const sender = makeSender(21);
        const answer = { requestId: 'r-1', status: 200, body: '{}' };
        mocks.handleCustomLlmFetch.mockResolvedValue(answer);
        initEventOther(makeAppController());

        expect(
            await ask(
                CUSTOM_LLM_FETCH_CHANNEL,
                { requestId: 'r-1', serverId: 'lm-studio', path: 'models' },
                sender,
            ),
        ).toBe(answer);
        expect(mocks.handleCustomLlmFetch).toHaveBeenCalledWith(
            expect.objectContaining({
                requestId: 'r-1',
                serverId: 'lm-studio',
            }),
            sender,
        );

        handlerOf(CUSTOM_LLM_CANCEL_CHANNEL)({}, { requestId: 'r-1' });
        handlerOf(CUSTOM_LLM_CANCEL_CHANNEL)({}, undefined);
        expect(mocks.cancelCustomLlmFetch.mock.calls).toEqual([
            ['r-1'],
            [undefined],
        ]);
    });

    test('the shared registry is read and reloaded, and a report is posted or stopped', async () => {
        const status = { servers: [], note: '' };
        const reloaded = { servers: [{ id: 'hall' }], note: 'fresh' };
        const posted = { isSuccessful: true };
        mocks.getLlmRegistryStatus.mockReturnValue(status);
        mocks.refreshLlmRegistry.mockResolvedValue(reloaded);
        mocks.handleLlmReportPost.mockResolvedValue(posted);
        initEventOther(makeAppController());

        expect(await ask(LLM_REGISTRY_GET_CHANNEL)).toBe(status);
        expect(await ask(LLM_REGISTRY_RELOAD_CHANNEL)).toBe(reloaded);
        expect(
            await ask(LLM_REPORT_POST_CHANNEL, {
                requestId: 'q-1',
                text: 'The projector went black',
            }),
        ).toBe(posted);
        expect(mocks.handleLlmReportPost).toHaveBeenCalledWith(
            expect.objectContaining({
                requestId: 'q-1',
                text: 'The projector went black',
            }),
        );

        handlerOf(LLM_REPORT_CANCEL_CHANNEL)({}, { requestId: 'q-1' });
        expect(mocks.cancelLlmReportPost).toHaveBeenCalledWith('q-1');
    });
});
