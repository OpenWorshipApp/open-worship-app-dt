// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
    isMainPage: true,
    isPagePresenter: false,
    isPageReader: false,
    isPopup: false,
    missingParentDirPath: null as string | null,
    selectedParentDir: null as string | null,
    foundDirs: [] as string[],
    locale: 'en',
    fontFamily: 'Test Font' as string | undefined,
    settings: new Map<string, string>(),
    effects: [] as Array<() => Promise<void>>,
    confirm: vi.fn(
        async (_title: string, _body?: string, _options?: unknown) => false,
    ),
    offerReport: vi.fn(async () => false),
    handleError: vi.fn(),
    reload: vi.fn(),
    initProvider: vi.fn(async () => {}),
    initCrypto: vi.fn(async () => {}),
    checkColorNotes: vi.fn(async () => {}),
    setSelectedParentDir: vi.fn(async () => {}),
    clearStorage: vi.fn(async () => {}),
    openGeneralSetting: vi.fn(),
    rootRender: vi.fn(),
    addDomListener: vi.fn(),
    initWidgetMenu: vi.fn(),
    checkUpdate: vi.fn(),
    initMeter: vi.fn(),
    initDragDrop: vi.fn(),
    popupWindow: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    getCurrentLocale: () => mocks.locale,
    getLangData: (locale: string) =>
        locale === 'missing' ? null : { fontFamily: mocks.fontFamily },
    tran: (key: string) => key,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/errorReportOfferHelpers', () => ({
    offerErrorReporting: mocks.offerReport,
}));
vi.mock('../helper/FileSourceMetaManager', () => ({
    default: { checkAllColorNotes: mocks.checkColorNotes },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        get isMainPage() {
            return mocks.isMainPage;
        },
        get isPagePresenter() {
            return mocks.isPagePresenter;
        },
        get isPageReader() {
            return mocks.isPageReader;
        },
        init: mocks.initProvider,
        reload: mocks.reload,
    },
}));
vi.mock('../_owa-crypto', () => ({ default: mocks.initCrypto }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => mocks.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => mocks.settings.set(key, value),
}));
vi.mock('./LanguageWrapper', () => ({ applyFontFamily: vi.fn() }));
vi.mock('../helper/helpers', () => ({
    HIGHLIGHT_SELECTED_CLASSNAME: 'selected',
}));
vi.mock('../helper/domHelpers', () => ({
    checkIsPopupWindow: () => mocks.isPopup,
    handleClassNameAction: vi.fn(),
    handleFullWidgetView: vi.fn(),
    addDomChangeEventListener: mocks.addDomListener,
    HoverMotionHandler: class {
        listenForHoverMotion() {}
    },
    InputContextMenuHandler: class {
        listenForInputContextMenu() {}
    },
    handleActiveSelectedElementScrolling: vi.fn(),
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get missingParentDirPath() {
            return mocks.missingParentDirPath;
        },
        getSelectedParentDirectory: async () => mocks.selectedParentDir,
        setSelectedParentDirectory: mocks.setSelectedParentDir,
        clear: mocks.clearStorage,
    },
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => boolean) => callback(),
}));
vi.mock('../helper/appHooks', () => ({
    useAppEffectAsync: (effect: () => Promise<void>) => {
        mocks.effects.push(effect);
    },
}));
vi.mock('../setting/settingHelpers', () => ({
    openGeneralSetting: mocks.openGeneralSetting,
}));
vi.mock('../server/fileHelpers', () => ({
    findDataDirsOnVolumesSync: () => mocks.foundDirs,
    getDesktopPath: () => '/desktop',
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../helper/sanitizeHelpers', () => ({
    escapeHtmlText: (value: string) => value.replaceAll('<', '&lt;'),
}));
vi.mock('./themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('./rootHelpers', () => ({
    getReactRoot: () => ({ render: mocks.rootRender }),
}));
vi.mock('../event/KeyboardEventListener', () => ({
    default: { onMacQuitting: undefined },
}));
vi.mock('../server/updatingAppHelpers', () => ({
    checkForAppUpdate: mocks.checkUpdate,
}));
vi.mock('../helper/titleSoundMeterHelpers', () => ({
    initTitleSoundMeter: mocks.initMeter,
}));
vi.mock('../helper/touchDragHelpers', () => ({
    initTouchDragAndDrop: mocks.initDragDrop,
}));
vi.mock('../app-modal/floatingWidgetHelpers', () => ({
    checkAreChildrenOnscreen: vi.fn(),
}));
vi.mock('../resize-actor/widgetAppMenuHelpers', () => ({
    initWidgetAppMenu: mocks.initWidgetMenu,
}));

import { RenderAppComp, run } from './main';
import KeyboardEventListener from '../event/KeyboardEventListener';

const originalOnError = globalThis.onerror;
const originalOnUnhandledRejection = globalThis.onunhandledrejection;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.clear();
    mocks.effects.length = 0;
    mocks.isMainPage = true;
    mocks.isPagePresenter = false;
    mocks.isPageReader = false;
    mocks.isPopup = false;
    mocks.missingParentDirPath = null;
    mocks.selectedParentDir = null;
    mocks.foundDirs = [];
    mocks.locale = 'en';
    mocks.fontFamily = 'Test Font';
    mocks.confirm.mockResolvedValue(false);
    mocks.offerReport.mockResolvedValue(false);
});

afterEach(() => {
    globalThis.onerror = originalOnError;
    globalThis.onunhandledrejection = originalOnUnhandledRejection;
    document.body.style.fontFamily = '';
    vi.useRealTimers();
});

describe('renderer startup', () => {
    test('initializes storage and window controls before rendering children', async () => {
        await run(<span>service</span>);
        expect(mocks.initCrypto).toHaveBeenCalledOnce();
        expect(mocks.checkColorNotes).toHaveBeenCalledOnce();
        expect(mocks.initProvider).toHaveBeenCalledOnce();
        expect(mocks.addDomListener).toHaveBeenCalledTimes(6);
        expect(mocks.initMeter).toHaveBeenCalledOnce();
        expect(mocks.initDragDrop).toHaveBeenCalledOnce();
        expect(mocks.initWidgetMenu).toHaveBeenCalledOnce();
        expect(document.body.style.fontFamily).toBe('Test Font');
        expect(mocks.rootRender.mock.calls[0][0].type).toBe(RenderAppComp);
        expect(
            renderToStaticMarkup(<RenderAppComp>service</RenderAppComp>),
        ).toContain('data-bs-theme="dark">service');
        KeyboardEventListener.onMacQuitting?.();
        await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
        expect(mocks.confirm.mock.calls[0][0]).toBe('Quick Exit');
    });

    test('popup windows skip widget menu and reject missing locale data', async () => {
        mocks.isPopup = true;
        mocks.fontFamily = undefined;
        await run();
        expect(mocks.initWidgetMenu).not.toHaveBeenCalled();
        expect(mocks.rootRender).not.toHaveBeenCalled();
        expect(document.body.style.fontFamily).toBe('');

        mocks.locale = 'missing';
        await expect(run()).rejects.toThrow(
            'Lang data not found for locale missing',
        );
    });

    test('reports uncaught failures and reloads once for the first ordinary error', async () => {
        await run();
        (globalThis.onerror as any)('broken');
        await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
        expect(mocks.handleError).toHaveBeenCalledWith('broken');
        expect(mocks.confirm.mock.calls[0][0]).toBe('Reload is needed');
        expect(mocks.settings.has('error-datetime-setting')).toBe(true);

        mocks.confirm.mockResolvedValue(true);
        (globalThis.onerror as any)('broken again');
        await vi.waitFor(() =>
            expect(mocks.clearStorage).toHaveBeenCalledOnce(),
        );
        expect(mocks.confirm.mock.calls[1][0]).toBe('Unfixable Error');
        expect(mocks.reload).toHaveBeenCalledOnce();
    });

    test('ignores canceled promises and ResizeObserver errors for reload prompts', async () => {
        await run();
        (globalThis.onunhandledrejection as any)({
            reason: { name: 'Canceled' },
        });
        (globalThis.onunhandledrejection as any)({
            reason: 'ResizeObserver loop',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(mocks.offerReport).not.toHaveBeenCalled();
    });
});

describe('data directory startup', () => {
    async function checkDirectory() {
        renderToStaticMarkup(<RenderAppComp>app</RenderAppComp>);
        expect(mocks.effects).toHaveLength(1);
        await mocks.effects[0]();
    }

    test('a missing directory offers retry or opens General Settings', async () => {
        mocks.missingParentDirPath = '/usb/<missing>';
        mocks.confirm.mockResolvedValueOnce(true);
        await checkDirectory();
        expect(mocks.confirm.mock.calls[0][1]).toContain('&lt;missing>');
        expect(mocks.reload).toHaveBeenCalledOnce();

        mocks.effects.length = 0;
        mocks.confirm.mockResolvedValueOnce(false);
        await checkDirectory();
        expect(mocks.openGeneralSetting).toHaveBeenCalledOnce();
    });

    test('offers a found folder and persists acceptance before reloading', async () => {
        mocks.foundDirs = ['/usb/open-worship-data'];
        mocks.confirm.mockResolvedValueOnce(true);
        await checkDirectory();
        expect(mocks.setSelectedParentDir).toHaveBeenCalledWith(
            '/usb/open-worship-data',
        );
        expect(mocks.reload).toHaveBeenCalledOnce();
    });

    test('falls back to folder settings when discovery is declined', async () => {
        mocks.foundDirs = ['/usb/open-worship-data'];
        mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        await checkDirectory();
        expect(mocks.confirm.mock.calls[1][0]).toBe(
            'No Parent Directory Selected',
        );
        expect(mocks.openGeneralSetting).toHaveBeenCalledOnce();
        expect(mocks.setSelectedParentDir).not.toHaveBeenCalled();
    });

    test('does not prompt an auxiliary window or an already configured main window', async () => {
        mocks.isMainPage = false;
        await checkDirectory();
        mocks.effects.length = 0;
        mocks.isMainPage = true;
        mocks.selectedParentDir = '/saved';
        await checkDirectory();
        expect(mocks.confirm).not.toHaveBeenCalled();
    });
});
