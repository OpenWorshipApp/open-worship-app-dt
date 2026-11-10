import { getFontFamilyMapByNodeFont } from '../server/fontHelpers';
import { appLocalStorage } from './directory-setting/appLocalStorage';

export const APP_FONT_FAMILY_SETTING_NAME = 'app-font-family';
export const APP_FONT_WEIGHT_SETTING_NAME = 'app-font-weight';

/**
 * The computer's fonts, and -- only when the chosen family is not one of them
 * -- the language packages' (`langFontListHelpers`): a language's own face
 * chosen as the app's font is a package's, and reading the packages also
 * registers its faces in this window, which is what draws it. A family on the computer
 * never loads a language at start-up.
 */
async function readFontsFor(fontFamily: string | null) {
    const fonts = await getFontFamilyMapByNodeFont();
    if (!fontFamily || fonts?.[fontFamily]) {
        return fonts;
    }
    const { getLangFontList, mergeLangFontList } =
        await import('../lang/langFontListHelpers');
    return mergeLangFontList(await getLangFontList(), fonts);
}

export async function getAppFontFamily() {
    const fontFamily = appLocalStorage.getItem(APP_FONT_FAMILY_SETTING_NAME);
    const fonts = await readFontsFor(fontFamily);
    if (!fontFamily || !fonts?.[fontFamily]) {
        return null;
    }
    return fontFamily;
}

export async function getAppFontWeight() {
    const fontWeight = appLocalStorage.getItem(APP_FONT_WEIGHT_SETTING_NAME);
    const fontFamily = await getAppFontFamily();
    const fonts = await readFontsFor(fontFamily);
    if (
        !fontWeight ||
        !fontFamily ||
        !fonts?.[fontFamily]?.includes(fontWeight)
    ) {
        return null;
    }
    return fontWeight;
}
