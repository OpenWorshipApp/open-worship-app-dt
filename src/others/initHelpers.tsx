import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.css';

import appProvider from '../server/appProvider';
import EventHandler from '../event/EventHandler';
import { useAppEffect } from '../helper/debuggerHelpers';
import { useState } from 'react';

export const themeOptions = ['light', 'dark', 'system'] as const;
export type ThemeOptionType = (typeof themeOptions)[number];
export function getThemeSourceSetting(): ThemeOptionType {
    const themeSource =
        appProvider.messageUtils.sendDataSync('main:app:get-theme');
    return themeSource;
}

function getSystemDarkMatcher() {
    if (!globalThis.matchMedia) {
        return null;
    }
    return globalThis.matchMedia('(prefers-color-scheme: dark)');
}
export function checkIsDarkMode(themeSource?: ThemeOptionType) {
    if (appProvider.isPageScreen) {
        return true;
    }
    themeSource ??= getThemeSourceSetting();
    if (themeSource === 'system' && getSystemDarkMatcher()?.matches) {
        return true;
    }
    return themeSource === 'dark';
}

export function getColorParts(backgroundColor?: string) {
    let isDarkMode = checkIsDarkMode();
    if (backgroundColor !== undefined) {
        const r = Number.parseInt(backgroundColor.slice(1, 3), 16);
        const g = Number.parseInt(backgroundColor.slice(3, 5), 16);
        const b = Number.parseInt(backgroundColor.slice(5, 7), 16);
        // https://www.w3.org/TR/AERT/#color-contrast
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        isDarkMode = brightness < 128;
    }
    const colorPart = isDarkMode ? '000000' : 'ffffff';
    const invertColorPart = isDarkMode ? 'ffffff' : '000000';
    return { colorPart, invertColorPart };
}

const THEME_CHANGE_EVENT = 'app:theme-changed';
function applyDarkModeToApp() {
    const isDarkMode = checkIsDarkMode();
    const themeSource = isDarkMode ? 'dark' : 'light';
    EventHandler.addPropEvent(THEME_CHANGE_EVENT, themeSource);
}
export function useThemeSource() {
    const [themeSource, setThemeSource] = useState<ThemeOptionType>(
        getThemeSourceSetting(),
    );
    const setThemeSource1 = (newThemeSource: ThemeOptionType) => {
        setThemeSource(newThemeSource);
        EventHandler.addPropEvent(THEME_CHANGE_EVENT, newThemeSource);
        appProvider.messageUtils.sendData('main:app:set-theme', newThemeSource);
    };
    useAppEffect(() => {
        const handler = (newTheme: ThemeOptionType) => {
            setThemeSource(newTheme);
        };
        const registeredEvent = EventHandler.registerEventListener(
            [THEME_CHANGE_EVENT],
            handler,
        );
        return () => {
            EventHandler.unregisterEventListener(registeredEvent);
        };
    }, []);
    const isDarkMode = checkIsDarkMode(themeSource);
    return {
        theme: isDarkMode ? 'dark' : 'light',
        themeSource: appProvider.isPageScreen ? 'dark' : themeSource,
        setThemeSource: setThemeSource1,
    };
}

getSystemDarkMatcher()?.addEventListener('change', applyDarkModeToApp);
