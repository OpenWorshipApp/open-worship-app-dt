import { getCurrentLocale, getLangDataAsync } from './lang/langHelpers';
import { getAppFontFamily, getAppFontWeight } from './setting/settingHelpers';

export async function init(callback: () => void) {
    const id = 'app-custom-style';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (style === null) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
    }
    const fontFamily = getAppFontFamily();
    if (fontFamily !== null) {
        style.innerHTML = `
        * {
            font-family: '${fontFamily}', sans-serif !important;
        }
    `;
    }
    const fontWeight = getAppFontWeight();
    if (fontWeight !== null) {
        style.innerHTML += `
        * {
            font-weight: ${fontWeight};
        }
    `;
    }
    const currentLocale = getCurrentLocale();
    await getLangDataAsync(currentLocale);
    callback();
}
