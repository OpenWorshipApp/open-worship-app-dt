import { getSetting } from '../../helper/settingHelpers';
import appProvider from '../../server/appProvider';
import { MIRROR_REMOTE_DISPLAY_FIRST } from '../../../electron/screenMirrorProtocol';
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

// Lives here rather than in the big `../screenHelpers` for the same reason as
// `getAllDisplays` above; that module re-exports it for its existing callers.
export function getAllShowingScreenIds(): number[] {
    return appProvider.messageUtils.sendDataSync('main:app:get-screens');
}

// The display a documents slides will actually land on. getDefaultScreenDisplay
// answers "the first non-primary display", which is right when nothing is up and
// wrong the moment a screen sits somewhere else: with screen 1 moved onto the
// primary display, the slide-dimension check warned about -- and offered to
// resize every slide to -- a display nothing was being shown on.
export function getPresentingScreenDisplay() {
    const screenIds = getAllShowingScreenIds();
    if (screenIds.length === 0) {
        return getDefaultScreenDisplay();
    }
    return getDisplayByScreenId(screenIds[0]);
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
    // A remote selection is retained while unplugged, never redirected locally.
    if (id <= MIRROR_REMOTE_DISPLAY_FIRST) return id;
    const { displays } = getAllDisplays();
    return (
        displays.find((display) => {
            return display.id === id;
        })?.id ?? defaultDisplay.id
    );
}
