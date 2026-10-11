import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';

export const DAILY_TIPS_DISABLED_SETTING_NAME = 'daily-tips-disabled';
export const DAILY_TIPS_HIDDEN_UNTIL_SETTING_NAME = 'daily-tips-hidden-until';

// The card's button says the number ("Hide for 30 days"), so the label and
// this change together.
export const DAILY_TIPS_HIDE_MS = 30 * 24 * 60 * 60 * 1000;

// Hidden from the card until a day that comes by itself. A stamp further off
// than twice what the button sets is not believed: pressed while the clock ran
// ahead (a flat clock battery, a dual-boot offset) it would keep the tips away
// for years once the clock is right. Twice rather than once, so an ordinary
// correction backwards does not bring back a card that was just put away.
function checkAreDailyTipsHidden(now: number) {
    const remaining =
        Number(getSetting(DAILY_TIPS_HIDDEN_UNTIL_SETTING_NAME)) - now;
    return remaining > 0 && remaining <= 2 * DAILY_TIPS_HIDE_MS;
}

// Off from Settings, which lasts, or hidden from the card, which does not.
export function getAreDailyTipsDisabled(now = Date.now()) {
    return (
        getSetting(DAILY_TIPS_DISABLED_SETTING_NAME) === 'true' ||
        checkAreDailyTipsHidden(now)
    );
}

// The Settings switch is also the way back from the card's hide: it reads off
// while the tips are hidden, and turning it on ends the 30 days early.
export function setAreDailyTipsEnabled(isEnabled: boolean) {
    setSetting(DAILY_TIPS_DISABLED_SETTING_NAME, `${!isEnabled}`);
    removeSetting(DAILY_TIPS_HIDDEN_UNTIL_SETTING_NAME);
}

export function hideDailyTips(now = Date.now()) {
    setSetting(
        DAILY_TIPS_HIDDEN_UNTIL_SETTING_NAME,
        `${now + DAILY_TIPS_HIDE_MS}`,
    );
}
