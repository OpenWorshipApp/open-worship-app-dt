import appProvider from '../server/appProvider';
import EventHandler from '../event/EventHandler';
import { useAppEffect } from '../helper/appHooks';
import { useState } from 'react';
import {
    HEX_COLOR_BLACK,
    checkIsColorDark,
    HEX_COLOR_WHITE,
} from './color/colorValueHelpers';

export const themeOptions = ['light', 'dark', 'system'] as const;
export type ThemeOptionType = (typeof themeOptions)[number];
// cached to avoid a blocking sync IPC round-trip per caller (per render)
let themeSourceSettingCache: ThemeOptionType | null = null;
export function getThemeSourceSetting(): ThemeOptionType {
    let themeSource = themeSourceSettingCache;
    if (themeSource === null) {
        themeSource = appProvider.messageUtils.sendDataSync(
            'main:app:get-theme',
        ) as ThemeOptionType;
        themeSourceSettingCache = themeSource;
    }
    return themeSource;
}

function getSystemDarkMatcher() {
    if (!globalThis.matchMedia) {
        return null;
    }
    return globalThis.matchMedia('(prefers-color-scheme: dark)');
}

// Blink answers `prefers-color-scheme` with LIGHT for as long as a page is
// being printed (File > Print, a window's own Print button), whatever the
// system is set to, so a window on the `system` theme turns light in the
// middle of its own print. A window that makes its paper light itself must
// not change under the print -- the Markdown Preview would draw its page
// again, diagrams and all -- and asks, through `keepThemeWhilePrinting`, for
// the answer read before the print to stand while it lasts. Every other
// window turns light with the print, as it always has.
let isThemeKeptWhilePrinting = false;
export function keepThemeWhilePrinting() {
    isThemeKeptWhilePrinting = true;
}
let printMatcher: MediaQueryList | null = null;
function checkIsThemeHeld() {
    if (!isThemeKeptWhilePrinting) {
        return false;
    }
    if (printMatcher === null && globalThis.matchMedia) {
        printMatcher = globalThis.matchMedia('print');
    }
    return printMatcher?.matches ?? false;
}
let lastIsSystemDark = false;
function checkIsSystemDark() {
    const systemDarkMatcher = getSystemDarkMatcher();
    if (systemDarkMatcher === null) {
        return false;
    }
    if (!checkIsThemeHeld()) {
        lastIsSystemDark = systemDarkMatcher.matches;
    }
    return lastIsSystemDark;
}

export function checkIsDarkMode(themeSource?: ThemeOptionType) {
    if (appProvider.isPageScreen) {
        return true;
    }
    themeSource ??= getThemeSourceSetting();
    if (themeSource === 'system' && checkIsSystemDark()) {
        return true;
    }
    return themeSource === 'dark';
}

export function getColorParts(textColor?: string) {
    textColor ??= HEX_COLOR_WHITE;
    const isTextColorDark = checkIsColorDark(textColor);
    const colorPart = isTextColorDark ? HEX_COLOR_BLACK : HEX_COLOR_WHITE;
    const invertColorPart = isTextColorDark ? HEX_COLOR_WHITE : HEX_COLOR_BLACK;
    return { colorPart, invertColorPart };
}

export const THEME_CHANGE_EVENT = 'app:theme-changed';
function applyDarkModeToApp() {
    themeSourceSettingCache = null;
    EventHandler.addPropEvent(THEME_CHANGE_EVENT, getThemeSourceSetting());
}
export function useThemeSource() {
    const [themeSource, setThemeSource] = useState<ThemeOptionType>(() =>
        getThemeSourceSetting(),
    );
    const [, setThemeRevision] = useState(0);
    const setThemeSource1 = (newThemeSource: ThemeOptionType) => {
        themeSourceSettingCache = newThemeSource;
        setThemeSource(newThemeSource);
        EventHandler.addPropEvent(THEME_CHANGE_EVENT, newThemeSource);
        appProvider.messageUtils.sendData('main:app:set-theme', newThemeSource);
    };
    useAppEffect(() => {
        const handler = (newThemeSource: ThemeOptionType) => {
            setThemeSource(newThemeSource);
            setThemeRevision((revision) => revision + 1);
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
    const theme = isDarkMode ? 'dark' : 'light';
    return {
        theme,
        themeSource: appProvider.isPageScreen ? 'dark' : themeSource,
        setThemeSource: setThemeSource1,
    };
}
export function useIsDarkMode() {
    const { themeSource } = useThemeSource();
    return checkIsDarkMode(themeSource);
}

getSystemDarkMatcher()?.addEventListener('change', () => {
    // In a window that keeps its theme, the flip printing makes is not the
    // system's; the one back once the print is done reads the same theme.
    if (!checkIsThemeHeld()) {
        applyDarkModeToApp();
    }
});
