import { getBibleLocale } from '../helper/bible-helpers/bibleLogicHelpers2';
import { MutationType } from '../helper/helpers';
import {
    checkIsValidLocale,
    getFontFamilyByLocale,
    LocaleType,
} from '../lang/langHelpers';

export async function applyFontFamily(element: Node, type: MutationType) {
    if (!(element instanceof HTMLElement)) {
        return;
    }
    let locale = element.dataset.locale;
    if (!locale) {
        const bibleKey = element.dataset.bibleKey;
        if (bibleKey) {
            locale = await getBibleLocale(bibleKey);
        }
    }
    if (locale && checkIsValidLocale(locale)) {
        const fontFamily = await getFontFamilyByLocale(locale as LocaleType);
        if (fontFamily) {
            element.style.fontFamily = fontFamily;
        }
    }
    if (type === 'added') {
        for (const child of Array.from(element.children)) {
            applyFontFamily(child, type);
        }
    }
}
