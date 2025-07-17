import { getBibleLocale } from '../helper/bible-helpers/serverBibleHelpers2';
import { MutationType } from '../helper/helpers';
import {
    checkIsValidLocale,
    getFontFamily,
    LocaleType,
} from '../lang/langHelpers';

export async function applyFontFamily(element: Node, type: MutationType) {
    if (!(element instanceof HTMLElement)) {
        return;
    }
    let locale = element.getAttribute('data-locale');
    if (locale === null) {
        const bibleKey = element.getAttribute('data-bible-key');
        if (bibleKey !== null) {
            locale = await getBibleLocale(bibleKey);
        }
    }
    if (locale !== null && checkIsValidLocale(locale)) {
        const fontFamily = await getFontFamily(locale as LocaleType);
        if (fontFamily) {
            element.style.fontFamily = fontFamily;
        }
    }
    if (type === 'added') {
        Array.from(element.children).forEach((child) => {
            applyFontFamily(child, type);
        });
    }
}
