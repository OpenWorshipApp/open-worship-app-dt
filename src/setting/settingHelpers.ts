import { getSetting, setSetting } from '../helper/settingHelpers';
import appProvider from '../server/appProvider';
import { getFontFamilyMapByNodeFont } from '../server/fontHelpers';

export const SETTING_SETTING_NAME = 'setting-tabs';

export function openSettingPage() {
    appProvider.messageUtils.sendData('main:app:open-setting');
}

export function openGeneralSetting() {
    setSetting(SETTING_SETTING_NAME, 'g');
    openSettingPage();
}

export function openBibleSetting() {
    setSetting(SETTING_SETTING_NAME, 'b');
    openSettingPage();
}

export const APP_FONT_FAMILY_SETTING_NAME = 'app-font-family';
export const APP_FONT_WEIGHT_SETTING_NAME = 'app-font-weight';

export function getAppFontFamily() {
    const fonts = getFontFamilyMapByNodeFont();
    const fontFamily = getSetting(APP_FONT_FAMILY_SETTING_NAME);
    if (!fontFamily || !fonts?.[fontFamily]) {
        return null;
    }
    return fontFamily;
}

export function getAppFontWeight() {
    const fonts = getFontFamilyMapByNodeFont();
    const fontWeight = getSetting(APP_FONT_WEIGHT_SETTING_NAME);
    const fontFamily = getAppFontFamily();
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
