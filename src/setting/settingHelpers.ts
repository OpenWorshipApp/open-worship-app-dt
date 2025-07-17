import { setSetting } from '../helper/settingHelpers';
import { goToPath } from '../router/routeHelpers';
import appProvider from '../server/appProvider';

export const SETTING_SETTING_NAME = 'setting-tabs';

export function goToGeneralSetting() {
    setSetting(SETTING_SETTING_NAME, 'g');
    goToPath(appProvider.settingHomePage);
}

export function goToBibleSetting() {
    setSetting(SETTING_SETTING_NAME, 'b');
    goToPath(appProvider.settingHomePage);
}
