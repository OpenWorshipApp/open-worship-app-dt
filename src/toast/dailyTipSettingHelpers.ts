import { getSetting, setSetting } from '../helper/settingHelpers';

export const DAILY_TIPS_DISABLED_SETTING_NAME = 'daily-tips-disabled';

export function getAreDailyTipsDisabled() {
    return getSetting(DAILY_TIPS_DISABLED_SETTING_NAME) === 'true';
}

export function setAreDailyTipsEnabled(isEnabled: boolean) {
    setSetting(DAILY_TIPS_DISABLED_SETTING_NAME, `${!isEnabled}`);
}

export function disableDailyTips() {
    setAreDailyTipsEnabled(false);
}
