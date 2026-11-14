import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    openPopupWindowMock,
    getSettingMock,
    getSettingForceMock,
    removeSettingMock,
    setSettingMock,
    getFontFamilyMapByNodeFontMock,
    initAllLangCssMock,
    appProviderMock,
    registeredListeners,
} = vi.hoisted(() => ({
    openPopupWindowMock: vi.fn(),
    getSettingMock: vi.fn(),
    getSettingForceMock: vi.fn(),
    removeSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
    getFontFamilyMapByNodeFontMock: vi.fn(),
    initAllLangCssMock: vi.fn(),
    appProviderMock: {
        settingHomePage: '/setting.html',
        messageUtils: {
            listenForData: vi.fn((channel: string, callback: () => void) => {
                registeredListeners.set(channel, callback);
            }),
            sendData: vi.fn(),
        },
    },
    registeredListeners: new Map<string, () => void>(),
}));

vi.mock('../helper/domHelpers', () => ({
    openPopupWindow: openPopupWindowMock,
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    getSettingForce: getSettingForceMock,
    removeSetting: removeSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('../server/fontHelpers', () => ({
    getFontFamilyMapByNodeFont: getFontFamilyMapByNodeFontMock,
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: getSettingMock,
    },
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../lang/langHelpers', () => ({
    initAllLangCss: initAllLangCssMock,
}));

async function loadSettingHelpers() {
    return await import('./settingHelpers');
}

describe('setting settingHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        registeredListeners.clear();
        getSettingMock.mockReturnValue(null);
        getSettingForceMock.mockReturnValue(null);
        getFontFamilyMapByNodeFontMock.mockResolvedValue({});
        initAllLangCssMock.mockResolvedValue([]);
    });

    test('opens the setting popup and switches between path, bible and ai tabs', async () => {
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
        const module = await loadSettingHelpers();

        module.openSettingPage();
        module.openPathSetting();
        module.openBibleSetting();
        // The tab the "media tools are missing" dialog jumps to.
        module.openOthersSetting();
        // The tab the assistant's key requests jump to.
        module.openAISetting();

        expect(setSettingMock).toHaveBeenCalledWith(
            module.SETTING_SETTING_NAME,
            'p',
        );
        expect(setSettingMock).toHaveBeenCalledWith(
            module.SETTING_SETTING_NAME,
            'b',
        );
        expect(setSettingMock).toHaveBeenCalledWith(
            module.SETTING_SETTING_NAME,
            'o',
        );
        expect(setSettingMock).toHaveBeenCalledWith(
            module.SETTING_SETTING_NAME,
            'a',
        );
        const tabRequests = setSettingMock.mock.calls.filter(
            ([key]) => key === 'setting-tab-request',
        );
        expect(tabRequests).toHaveLength(4);
        expect(JSON.parse(tabRequests[3][1])).toEqual({
            tabKey: 'a',
            requestedAt: 12345,
        });

        expect(openPopupWindowMock).toHaveBeenNthCalledWith(
            1,
            '/setting.html',
            'setting_12345',
            'setting',
            { appTopToMain: true },
        );
        expect(openPopupWindowMock).toHaveBeenNthCalledWith(
            3,
            '/setting.html',
            'setting_12345',
            'setting',
            { appTopToMain: true },
        );

        nowSpy.mockRestore();
    });

    test('consumes only fresh valid tab requests', async () => {
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(50_000);
        const module = await loadSettingHelpers();

        getSettingForceMock.mockReturnValueOnce(
            JSON.stringify({ tabKey: 'o', requestedAt: 49_000 }),
        );
        expect(module.takeSettingTabRequest()).toBe('o');
        expect(removeSettingMock).toHaveBeenCalledWith('setting-tab-request');

        getSettingForceMock.mockReturnValueOnce(
            JSON.stringify({ tabKey: 'x', requestedAt: 49_000 }),
        );
        expect(module.takeSettingTabRequest()).toBeNull();

        getSettingForceMock.mockReturnValueOnce(
            JSON.stringify({ tabKey: 'g', requestedAt: 10_000 }),
        );
        expect(module.takeSettingTabRequest()).toBeNull();

        getSettingForceMock.mockReturnValueOnce('{broken');
        expect(module.takeSettingTabRequest()).toBeNull();

        // Nothing asked for: nothing to remove either.
        removeSettingMock.mockClear();
        expect(module.takeSettingTabRequest()).toBeNull();
        expect(removeSettingMock).not.toHaveBeenCalled();

        nowSpy.mockRestore();
    });

    test('tells this window at once when it asks itself for a tab, until it stops listening', async () => {
        const module = await loadSettingHelpers();
        const listener = vi.fn();
        const stopListening = module.listenForSettingTabRequest(listener);

        module.openBibleSetting();
        expect(listener).toHaveBeenCalledWith('b');
        // Told after the request is stored, so taking it finds it there.
        expect(setSettingMock.mock.invocationCallOrder[1]).toBeLessThan(
            listener.mock.invocationCallOrder[0],
        );

        stopListening();
        module.openAISetting();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(setSettingMock).toHaveBeenCalledWith('setting-tabs', 'a');
    });

    test('registers the setting-home listener and reloads app windows on demand', async () => {
        const module = await loadSettingHelpers();
        const listener = registeredListeners.get('app:main:go-to-setting-home');

        expect(appProviderMock.messageUtils.listenForData).toHaveBeenCalledWith(
            'app:main:go-to-setting-home',
            expect.any(Function),
        );
        expect(listener).toBeTypeOf('function');

        listener?.();

        expect(setSettingMock).toHaveBeenCalledWith(
            module.SETTING_SETTING_NAME,
            'b',
        );
        expect(openPopupWindowMock).toHaveBeenCalledWith(
            '/setting.html',
            expect.stringMatching(/^setting_\d+$/),
            'setting',
            { appTopToMain: true },
        );

        module.forceReloadAppWindows();

        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:force-reload',
        );
    });

    test('asks the main process to close and open the app again', async () => {
        const module = await loadSettingHelpers();

        module.relaunchApp();

        // A reload cannot apply a setting the main process read before it had
        // a window to reload, so this one goes the whole way round.
        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'main:app:relaunch',
        );
    });

    test('returns only valid app font family and weight settings', async () => {
        const module = await loadSettingHelpers();

        getFontFamilyMapByNodeFontMock.mockResolvedValue({
            Inter: ['400', '700'],
            Serif: ['Regular'],
        });
        getSettingMock.mockImplementation((key: string) => {
            if (key === module.APP_FONT_FAMILY_SETTING_NAME) {
                return 'Inter';
            }
            if (key === module.APP_FONT_WEIGHT_SETTING_NAME) {
                return '700';
            }
            return null;
        });

        expect(await module.getAppFontFamily()).toBe('Inter');
        expect(await module.getAppFontWeight()).toBe('700');

        getFontFamilyMapByNodeFontMock.mockResolvedValue({
            Inter: ['400'],
        });
        getSettingMock.mockImplementation((key: string) => {
            if (key === module.APP_FONT_FAMILY_SETTING_NAME) {
                return 'Inter';
            }
            if (key === module.APP_FONT_WEIGHT_SETTING_NAME) {
                return '900';
            }
            return null;
        });

        expect(await module.getAppFontFamily()).toBe('Inter');
        expect(await module.getAppFontWeight()).toBeNull();

        getSettingMock.mockImplementation((key: string) => {
            if (key === module.APP_FONT_FAMILY_SETTING_NAME) {
                return 'Missing';
            }
            if (key === module.APP_FONT_WEIGHT_SETTING_NAME) {
                return '700';
            }
            return null;
        });

        expect(await module.getAppFontFamily()).toBeNull();
        expect(await module.getAppFontWeight()).toBeNull();
    });

    test("a language package's font is a valid app font, read only when the computer lacks the family", async () => {
        const module = await loadSettingHelpers();
        const { genFontsData } =
            await import('../lang/data/online/langFontFaces');
        const { css } = genFontsData(
            {
                uiFamily: 'app-Sample Serif',
                family: 'Sample Serif',
                faces: [
                    { file: 'regular.ttf', weight: 'normal' },
                    { file: 'bold.ttf', weight: 'bold' },
                ],
            },
            { 'regular.ttf': 'blob:regular', 'bold.ttf': 'blob:bold' },
        );
        initAllLangCssMock.mockResolvedValue([{ genCss: () => css }]);
        getFontFamilyMapByNodeFontMock.mockResolvedValue({ Inter: ['400'] });
        const chosen = { family: 'Inter', weight: '400' };
        getSettingMock.mockImplementation((key: string) => {
            if (key === module.APP_FONT_FAMILY_SETTING_NAME) {
                return chosen.family;
            }
            if (key === module.APP_FONT_WEIGHT_SETTING_NAME) {
                return chosen.weight;
            }
            return null;
        });

        // A family on the computer never loads a language.
        expect(await module.getAppFontFamily()).toBe('Inter');
        expect(initAllLangCssMock).not.toHaveBeenCalled();

        chosen.family = 'Sample Serif';
        chosen.weight = '700';
        expect(await module.getAppFontFamily()).toBe('Sample Serif');
        expect(await module.getAppFontWeight()).toBe('700');

        chosen.weight = '300';
        expect(await module.getAppFontWeight()).toBeNull();
    });
});
