import { getCurrentLocale, getLangDataAsync } from './lang/langHelpers';
import { sanitizeCssValue } from './helper/sanitizeHelpers';
import { getAppFontFamily, getAppFontWeight } from './setting/settingHelpers';

async function initFontFamily() {
    const id = 'app-custom-style';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (style === null) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
    }
    const fontFamily = await getAppFontFamily();
    if (fontFamily !== null) {
        const safeFontFamily = sanitizeCssValue(fontFamily);
        style.innerHTML = `
        * {
            font-family: '${safeFontFamily}';
        }
    `;
    }
    const fontWeight = await getAppFontWeight();
    if (fontWeight !== null) {
        const safeFontWeight = sanitizeCssValue(String(fontWeight));
        style.innerHTML += `
        * {
            font-weight: ${safeFontWeight};
        }
    `;
    }
}

export async function init(callback: () => void = () => {}) {
    initFontFamily();
    const currentLocale = getCurrentLocale();
    await getLangDataAsync(currentLocale);
    callback();
}
