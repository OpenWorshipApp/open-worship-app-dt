import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.css';

import { createRoot } from 'react-dom/client';
import appProvider from '../server/appProvider';

export const darkModeHook = {
    check: () => {},
};
export function applyDarkModeToApp() {
    const isDarkMode = checkIsDarkMode();
    const theme = isDarkMode ? 'dark' : 'light';
    for (const element of document.querySelectorAll('#app')) {
        if (element instanceof HTMLElement) {
            element.dataset.bsTheme = theme;
        }
    }
    darkModeHook.check();
}

export const themeOptions = ['light', 'dark', 'system'] as const;
export type ThemeOptionType = (typeof themeOptions)[number];
export function getThemeSourceSetting(): ThemeOptionType {
    const themeSource =
        appProvider.messageUtils.sendDataSync('main:app:get-theme');
    return themeSource;
}
export function setThemeSourceSetting(themeSource: ThemeOptionType) {
    appProvider.messageUtils.sendData('main:app:set-theme', themeSource);
    applyDarkModeToApp();
}

function getSystemDarkMatcher() {
    if (!globalThis.matchMedia) {
        return null;
    }
    return globalThis.matchMedia('(prefers-color-scheme: dark)');
}
export function checkIsDarkMode() {
    const themeSource = getThemeSourceSetting();
    if (themeSource === 'system' && getSystemDarkMatcher()?.matches) {
        return true;
    }
    return themeSource === 'dark';
}

export function getColorParts() {
    const isDarkMode = checkIsDarkMode();
    const colorPart = isDarkMode ? '000000' : 'ffffff';
    const invertColorPart = isDarkMode ? 'ffffff' : '000000';
    return { colorPart, invertColorPart };
}

getSystemDarkMatcher()?.addEventListener('change', applyDarkModeToApp);

export function getReactRoot() {
    const container = document.getElementById('root');
    if (container === null) {
        const message = 'Root element not found';
        globalThis.alert(message);
        throw new Error(message);
    }
    const root = createRoot(container);
    return root;
}
