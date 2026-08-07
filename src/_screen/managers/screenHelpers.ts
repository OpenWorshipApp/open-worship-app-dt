import { getSetting } from '../../helper/settingHelpers';
import appProvider from '../../server/appProvider';
import { type AllDisplayType } from '../screenTypeHelpers';

export const SCREEN_MANAGER_SETTING_NAME = 'screen-display-';

// Defined here, not in `../screenHelpers`, because `Slide` and other leaf data
// classes need `getDefaultScreenDisplay`; importing it from the big
// `../screenHelpers` module dragged the whole screen-manager graph (and, via
// `dragHelpers`, `LyricSlide extends Slide`) into their module evaluation —
// eager loading plus a "Cannot access 'Slide' before initialization" cycle.
export function getAllDisplays(): AllDisplayType {
    return appProvider.messageUtils.sendDataSync('main:app:get-displays');
}

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
    if (Number.isNaN(Number.parseInt(str))) {
        return defaultDisplay.id;
    }
    const id = Number.parseInt(str);
    const { displays } = getAllDisplays();
    return (
        displays.find((display) => {
            return display.id === id;
        })?.id ?? defaultDisplay.id
    );
}
