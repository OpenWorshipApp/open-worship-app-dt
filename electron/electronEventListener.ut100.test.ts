import { beforeEach, describe, expect, test, vi } from 'vitest';

// The language plugin doors (the scan's options, the installed list, the
// install folder) and the package-update doors, on the IPC suite's mock
// surface plus a mock of the plugin scanner.

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
    republishAiLangDirs: vi.fn(),
    toMcpPackagePath: state.toMcpPackagePath,
}));
vi.mock('./appWindowListHelpers', () => ({
    listAppWindows: state.listAppWindows,
    checkIsWatchedPageUrl: () => false,
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

const langState = vi.hoisted(() => ({
    clearLangPluginsCache: vi.fn(),
    configureLangPlugins: vi.fn(),
    getBuiltInLangPluginsDirPath: vi.fn(),
    getLangPlugins: vi.fn(),
    getLangPluginsDirPath: vi.fn(),
}));
vi.mock('./langPluginHelpers', () => ({
    clearLangPluginsCache: langState.clearLangPluginsCache,
    configureLangPlugins: langState.configureLangPlugins,
    getBuiltInLangPluginsDirPath: langState.getBuiltInLangPluginsDirPath,
    getLangPlugins: langState.getLangPlugins,
    getLangPluginsDirPath: langState.getLangPluginsDirPath,
}));

import appInfo from '../package.json';
import { initEventListenerApp, initEventOther } from './electronEventListener';
import {
    DISABLED_LANG_CODES_SETTING_NAME,
    LANG_PLUGINS_CHANNEL,
    LANG_PLUGINS_DIR_CHANNEL,
} from './langPluginProtocol';
import {
    PACKAGE_UPDATES_BROADCAST_CHANNEL,
    PACKAGE_UPDATES_GET_CHANNEL,
    PACKAGE_UPDATES_RENDERER_CHANNEL,
} from './packageUpdateProtocol';
import { electronMockState } from './testElectronModule';

function findHandler(kind: 'on' | 'handle', eventName: string) {
    const handler = electronMockState.ipcMain[kind].mock.calls.find(
        ([name]: [string]) => name === eventName,
    )?.[1];
    if (handler === undefined) {
        throw new Error(`No "${kind}" handler registered for ${eventName}`);
    }
    return handler as (...args: any[]) => any;
}

function createAppController(clientSettings: Record<string, unknown> = {}) {
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
            dataDirPath: '/data/owa',
            getClientSetting: vi.fn((name: string) => clientSettings[name]),
            primaryDisplay: { id: 1, size: { width: 1280, height: 720 } },
            allDisplays: [{ id: 1 }],
            getDisplayById: vi.fn(() => undefined),
        },
        sendMessageToAll: vi.fn(),
        reloadAll: vi.fn(),
        resetThemeBackgroundColor: vi.fn(),
    } as any;
}

beforeEach(() => {
    electronMockState.reset();
    state.getSystemFontListMap.mockResolvedValue({});
    state.getScreenMirror.mockReturnValue(undefined);
    state.getVirtualDisplays.mockReturnValue(undefined);
    state.screenControllerMocks.getAllIds.mockReturnValue([]);
    state.screenControllerMocks.getInstance.mockReturnValue(null);
    langState.getBuiltInLangPluginsDirPath.mockReturnValue('/app/lang');
});

describe('language plugin doors', () => {
    test('configures the plugin scan from the built-in folder, the data folder, the turned-off codes and the app version', () => {
        const appController = createAppController({
            [DISABLED_LANG_CODES_SETTING_NAME]: '["xx","yy",3]',
        });
        initEventListenerApp(appController);

        expect(langState.configureLangPlugins).toHaveBeenCalledTimes(1);
        const readOptions = langState.configureLangPlugins.mock.calls[0][0];
        // Read lazily: the setting is consulted on each scan, not at startup.
        expect(
            appController.settingManager.getClientSetting,
        ).not.toHaveBeenCalledWith(DISABLED_LANG_CODES_SETTING_NAME);

        expect(readOptions()).toEqual({
            builtInDirPath: '/app/lang',
            dataDirPath: '/data/owa',
            disabledLangCodes: ['xx', 'yy'],
            appVersion: appInfo.version,
        });
        expect(langState.getBuiltInLangPluginsDirPath).toHaveBeenCalledWith(
            electronMockState.app.getAppPath(),
        );
    });

    test('a turned-off list that is not JSON turns nothing off', () => {
        const appController = createAppController({
            [DISABLED_LANG_CODES_SETTING_NAME]: 'not json',
        });
        initEventListenerApp(appController);

        const readOptions = langState.configureLangPlugins.mock.calls[0][0];
        expect(readOptions().disabledLangCodes).toEqual([]);
    });

    test('answers the installed plugins and the folder they install into', () => {
        initEventListenerApp(createAppController());
        const plugins = [{ langCode: 'xx', version: '1.0.0' }];
        langState.getLangPlugins.mockReturnValue(plugins);
        langState.getLangPluginsDirPath.mockReturnValue('/data/owa/lang');

        expect(findHandler('handle', LANG_PLUGINS_CHANNEL)()).toBe(plugins);

        const event: any = {};
        findHandler('on', LANG_PLUGINS_DIR_CHANNEL)(event);
        expect(event.returnValue).toBe('/data/owa/lang');
    });
});

describe('package update doors', () => {
    test('nothing is known until a window reports; then every window is told the merged state', () => {
        const appController = createAppController();
        initEventOther(appController);
        const sender = { send: vi.fn() };

        findHandler('on', PACKAGE_UPDATES_GET_CHANNEL)({ sender });
        expect(sender.send).toHaveBeenLastCalledWith(
            PACKAGE_UPDATES_RENDERER_CHANNEL,
            null,
        );

        findHandler('on', PACKAGE_UPDATES_BROADCAST_CHANNEL)(
            {},
            { langCodes: ['xx'] },
        );
        expect(appController.sendMessageToAll).toHaveBeenLastCalledWith(
            PACKAGE_UPDATES_RENDERER_CHANNEL,
            { langCodes: ['xx'], isExtraBinOutdated: false },
        );

        // A later report of the other half keeps what the first one said.
        findHandler('on', PACKAGE_UPDATES_BROADCAST_CHANNEL)(
            {},
            { isExtraBinOutdated: true },
        );
        expect(appController.sendMessageToAll).toHaveBeenLastCalledWith(
            PACKAGE_UPDATES_RENDERER_CHANNEL,
            { langCodes: ['xx'], isExtraBinOutdated: true },
        );

        // Asked again: answered to the asking window alone, from what is kept.
        findHandler('on', PACKAGE_UPDATES_GET_CHANNEL)({ sender });
        expect(sender.send).toHaveBeenLastCalledWith(
            PACKAGE_UPDATES_RENDERER_CHANNEL,
            { langCodes: ['xx'], isExtraBinOutdated: true },
        );
        expect(sender.send).toHaveBeenCalledTimes(2);
    });
});
