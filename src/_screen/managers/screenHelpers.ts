import { getSetting } from '../../helper/settingHelpers';
import { getAllDisplays } from '../screenHelpers';

export const SCREEN_MANAGER_SETTING_NAME = 'screen-display-';

export function getDefaultScreenDisplay() {
    const { primaryDisplay, displays } = getAllDisplays();
    return (
        displays.find((display) => {
            return display.id !== primaryDisplay.id;
        }) ?? primaryDisplay
    );
}

export function getDisplayByScreenId(screenId: number) {
    const displayId = getDisplayIdByScreenId(screenId);
    const { displays } = getAllDisplays();
    return (
        displays.find((display) => {
            return display.id === displayId;
        }) ?? getDefaultScreenDisplay()
    );
}

export function getDisplayIdByScreenId(screenId: number) {
    const defaultDisplay = getDefaultScreenDisplay();
    const str =
        getSetting(`${SCREEN_MANAGER_SETTING_NAME}-pid-${screenId}`) ??
        defaultDisplay.id.toString();
    if (isNaN(parseInt(str))) {
        return defaultDisplay.id;
    }
    const id = parseInt(str);
    const { displays } = getAllDisplays();
    return (
        displays.find((display) => {
            return display.id === id;
        })?.id ?? defaultDisplay.id
    );
}
