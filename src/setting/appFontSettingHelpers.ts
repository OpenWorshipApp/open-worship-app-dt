import { getFontFamilyMapByNodeFont } from '../server/fontHelpers';
import { appLocalStorage } from './directory-setting/appLocalStorage';

export const APP_FONT_FAMILY_SETTING_NAME = 'app-font-family';
export const APP_FONT_WEIGHT_SETTING_NAME = 'app-font-weight';

export async function getAppFontFamily() {
    const fonts = await getFontFamilyMapByNodeFont();
    const fontFamily = appLocalStorage.getItem(APP_FONT_FAMILY_SETTING_NAME);
    if (!fontFamily || !fonts?.[fontFamily]) {
        return null;
    }
    return fontFamily;
}

export async function getAppFontWeight() {
    const fonts = await getFontFamilyMapByNodeFont();
    const fontWeight = appLocalStorage.getItem(APP_FONT_WEIGHT_SETTING_NAME);
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
