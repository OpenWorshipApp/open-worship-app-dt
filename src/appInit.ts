import appProvider from './server/appProvider';
import { getAppFontFamily, getAppFontWeight } from './setting/settingHelpers';

const id = 'app-custom-style';
function initApp() {
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
            font-family: '${fontFamily}', sans-serif;
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
    setTimeout(() => {
        appProvider.messageUtils.sendData('main:app:ask-camera-access');
    }, 3e3);
}
initApp();
