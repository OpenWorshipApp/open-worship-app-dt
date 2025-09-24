import { setSetting } from '../helper/settingHelpers';
import { goToPath } from '../router/routeHelpers';
import appProvider from '../server/appProvider';

export const SETTING_SETTING_NAME = 'setting-tabs';

export function gotoSettingPage() {
    goToPath(appProvider.settingHomePage);
}
(window as any).gotoSettingPage = gotoSettingPage;

export function goToGeneralSetting() {
    setSetting(SETTING_SETTING_NAME, 'g');
    gotoSettingPage();
}

export function goToBibleSetting() {
    setSetting(SETTING_SETTING_NAME, 'b');
    gotoSettingPage();
}
