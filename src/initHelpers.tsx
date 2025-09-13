import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.css';

import { createRoot } from 'react-dom/client';
import { getSetting, setSetting } from './helper/settingHelpers';

export const darkModeHook = {
    check: () => {},
};
export function applyDarkModeToApp() {
    const isDarkMode = checkIsDarkMode();
    document.querySelectorAll('#app').forEach((element) => {
        if (element instanceof HTMLElement) {
            if (isDarkMode) {
                element.dataset.bsTheme = 'dark';
            } else {
                element.dataset.bsTheme = 'light';
            }
        }
    });
    darkModeHook.check();
}

const DARK_MODE_SETTING_NAME = 'dark-mode-setting';
export function getIsDarkModeSetting() {
    const setting = getSetting(DARK_MODE_SETTING_NAME);
    if (setting === 'true') {
        return true;
    }
    if (setting === 'false') {
        return false;
    }
    return null;
}
export function setIsDarkModeSetting(isDarkMode: boolean | null) {
    let setting: string | null = null;
    if (isDarkMode === true) {
        setting = 'true';
    } else if (isDarkMode === false) {
        setting = 'false';
    }
    setSetting(DARK_MODE_SETTING_NAME, setting);
    applyDarkModeToApp();
}

function getSystemDarkMatcher() {
    if (!window.matchMedia) {
        return null;
    }
    return window.matchMedia('(prefers-color-scheme: dark)');
}
export function checkIsDarkMode() {
    const isDarkModeSetting = getIsDarkModeSetting();
    if (isDarkModeSetting !== null) {
        return isDarkModeSetting;
    }
    if (getSystemDarkMatcher()?.matches) {
        return true;
    }
    return false;
}

getSystemDarkMatcher()?.addEventListener('change', applyDarkModeToApp);

export function getReactRoot() {
    const container = document.getElementById('root');
    if (container === null) {
        const message = 'Root element not found';
        window.alert(message);
        throw new Error(message);
    }
    const root = createRoot(container);
    return root;
}
