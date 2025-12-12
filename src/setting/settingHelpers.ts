import { setSetting } from '../helper/settingHelpers';
import appProvider from '../server/appProvider';

export const SETTING_SETTING_NAME = 'setting-tabs';

export function openSettingPage() {
    appProvider.messageUtils.sendData('main:app:open-setting');
}

export function openGeneralSetting() {
    setSetting(SETTING_SETTING_NAME, 'g');
    openSettingPage();
}

export function openBibleSetting() {
    setSetting(SETTING_SETTING_NAME, 'b');
    openSettingPage();
}
