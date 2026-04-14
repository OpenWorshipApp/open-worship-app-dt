import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    openPopupWindowMock,
    getSettingMock,
    setSettingMock,
    getFontFamilyMapByNodeFontMock,
    appProviderMock,
    registeredListeners,
} = vi.hoisted(() => ({
    openPopupWindowMock: vi.fn(),
    getSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
    getFontFamilyMapByNodeFontMock: vi.fn(),
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
    setSetting: setSettingMock,
}));

vi.mock('../server/fontHelpers', () => ({
    getFontFamilyMapByNodeFont: getFontFamilyMapByNodeFontMock,
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
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
        getFontFamilyMapByNodeFontMock.mockResolvedValue({});
    });

    test('opens the setting popup and switches between general and bible tabs', async () => {
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
        const module = await loadSettingHelpers();

        module.openSettingPage();
        module.openGeneralSetting();
        module.openBibleSetting();

        expect(openPopupWindowMock).toHaveBeenNthCalledWith(
            1,
            '/setting.html',
            'setting_12345',
            'setting',
        );
        expect(setSettingMock).toHaveBeenNthCalledWith(
            1,
            module.SETTING_SETTING_NAME,
            'g',
        );
        expect(setSettingMock).toHaveBeenNthCalledWith(
            2,
            module.SETTING_SETTING_NAME,
            'b',
        );
        expect(openPopupWindowMock).toHaveBeenNthCalledWith(
            3,
            '/setting.html',
            'setting_12345',
            'setting',
        );

        nowSpy.mockRestore();
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
        );

        module.forceReloadAppWindows();

        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:force-reload',
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
});
