import { openPopupWindow } from '../helper/domHelpers';
import { setSetting } from '../helper/settingHelpers';
import appProvider from '../server/appProvider';

export {
    APP_FONT_FAMILY_SETTING_NAME,
    APP_FONT_WEIGHT_SETTING_NAME,
    getAppFontFamily,
    getAppFontWeight,
} from './appFontSettingHelpers';

export const SETTING_SETTING_NAME = 'setting-tabs';

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
    setSetting(SETTING_SETTING_NAME, 'g');
    openSettingPage();
}

export function openBibleSetting() {
    setSetting(SETTING_SETTING_NAME, 'b');
    openSettingPage();
}

export function openOthersSetting() {
    setSetting(SETTING_SETTING_NAME, 'o');
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
