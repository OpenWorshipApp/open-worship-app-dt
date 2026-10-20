import { openPopupWindow } from '../helper/domHelpers';
import {
    getSettingForce,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import appProvider from '../server/appProvider';

export {
    APP_FONT_FAMILY_SETTING_NAME,
    APP_FONT_WEIGHT_SETTING_NAME,
    getAppFontFamily,
    getAppFontWeight,
} from './appFontSettingHelpers';

export const SETTING_SETTING_NAME = 'setting-tabs';
const SETTING_TAB_REQUEST_SETTING_NAME = 'setting-tab-request';
const SETTING_TAB_REQUEST_MAX_AGE_MILLISECONDS = 30_000;
export type SettingTabKeyType = 'g' | 'b' | 'o';

// The tab listener of THIS renderer, when it is the Settings window. A module
// of its own would be cleaner, but `requestSettingTab` must reach it without
// the asking window importing the settings page: the two are the same module
// instance only when the asker IS Settings (`openOthersSetting` from the
// assistant's "Enable AI features" prompt, answered inside Settings itself).
// There the raise that carries a request to a window open in the background
// fires no `focus` event -- the window is already in front -- so the tab
// request was never taken and Yes did nothing.
const settingTabListenerSet = new Set<(tabKey: SettingTabKeyType) => void>();

/** Told when THIS window asks itself to show a tab, at once. */
export function listenForSettingTabRequest(
    callback: (tabKey: SettingTabKeyType) => void,
) {
    settingTabListenerSet.add(callback);
    return () => {
        settingTabListenerSet.delete(callback);
    };
}

function requestSettingTab(tabKey: SettingTabKeyType) {
    setSetting(SETTING_SETTING_NAME, tabKey);
    setSetting(
        SETTING_TAB_REQUEST_SETTING_NAME,
        JSON.stringify({ tabKey, requestedAt: Date.now() }),
    );
    for (const callback of settingTabListenerSet) {
        callback(tabKey);
    }
}

/**
 * The tab another window asked Settings to show while bringing it forward.
 *
 * The request is consumed even when malformed or stale. Otherwise one bad
 * value would be reconsidered every time the Settings window receives focus.
 */
export function takeSettingTabRequest(): SettingTabKeyType | null {
    const text = getSettingForce(SETTING_TAB_REQUEST_SETTING_NAME);
    if (!text) {
        return null;
    }
    removeSetting(SETTING_TAB_REQUEST_SETTING_NAME);
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        return null;
    }
    if (
        typeof data?.requestedAt !== 'number' ||
        Math.abs(Date.now() - data.requestedAt) >
            SETTING_TAB_REQUEST_MAX_AGE_MILLISECONDS ||
        !['g', 'b', 'o'].includes(data.tabKey)
    ) {
        return null;
    }
    return data.tabKey as SettingTabKeyType;
}

export function openSettingPage() {
    openPopupWindow(
        appProvider.settingHomePage,
        `setting_${Date.now()}`,
        'setting',
        {
            appTopToMain: true,
        },
    );
}

export function openGeneralSetting() {
    requestSettingTab('g');
    openSettingPage();
}

export function openBibleSetting() {
    requestSettingTab('b');
    openSettingPage();
}

export function openOthersSetting() {
    requestSettingTab('o');
    openSettingPage();
}
appProvider.messageUtils.listenForData('app:main:go-to-setting-home', () => {
    openBibleSetting();
});

export function forceReloadAppWindows() {
    appProvider.messageUtils.sendData('all:app:force-reload');
}

/**
 * The heavier sibling of `forceReloadAppWindows`: the whole process closes and
 * opens again, not just its renderers.
 *
 * Reloading a window re-reads every setting the RENDERER owns. It cannot
 * re-read one the main process read before `ready` -- the AI master switch is
 * the only such setting -- so that panel needs this instead. Nothing comes
 * back: the window asking is gone with the process.
 */
export function relaunchApp() {
    appProvider.messageUtils.sendData('main:app:relaunch');
}
