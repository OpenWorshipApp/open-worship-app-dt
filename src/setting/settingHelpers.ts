import { openPopupWindow } from '../helper/domHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import appProvider from '../server/appProvider';
import { getFontFamilyMapByNodeFont } from '../server/fontHelpers';

export const SETTING_SETTING_NAME = 'setting-tabs';

export function openSettingPage() {
    openPopupWindow(
        appProvider.settingHomePage,
        `setting_${Date.now()}`,
        'setting',
    );
}

export function openGeneralSetting() {
    setSetting(SETTING_SETTING_NAME, 'g');
    openSettingPage();
}

export function openBibleSetting() {
    setSetting(SETTING_SETTING_NAME, 'b');
    openSettingPage();
}
(globalThis as any).openBibleSetting = openBibleSetting;

export const APP_FONT_FAMILY_SETTING_NAME = 'app-font-family';
export const APP_FONT_WEIGHT_SETTING_NAME = 'app-font-weight';

export async function getAppFontFamily() {
    const fonts = await getFontFamilyMapByNodeFont();
    const fontFamily = getSetting(APP_FONT_FAMILY_SETTING_NAME);
    if (!fontFamily || !fonts?.[fontFamily]) {
        return null;
    }
    return fontFamily;
}

export async function getAppFontWeight() {
    const fonts = await getFontFamilyMapByNodeFont();
    const fontWeight = getSetting(APP_FONT_WEIGHT_SETTING_NAME);
    const fontFamily = await getAppFontFamily();
    if (
        !fontWeight ||
        !fontFamily ||
        !fonts?.[fontFamily]?.includes(fontWeight)
    ) {
        return null;
    }
    return fontWeight;
}

export function forceReloadAppWindows() {
    appProvider.messageUtils.sendData('all:app:force-reload');
}
