import { getSetting } from '../../helper/settingHelpers';
import { screenManagerSettingNames } from '../../helper/constants';
import appProvider from '../../server/appProvider';
import { MIRROR_REMOTE_DISPLAY_FIRST } from '../../../electron/screenMirrorProtocol';
import { isVirtualDisplayId } from '../../../electron/virtualDisplayProtocol';
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

// Where a screen goes when it has no display of its own, or its display is
// gone: the first monitor that is not this one, else this one -- never a
// virtual display, which nobody sees until someone opens its address.
function getPlacementDisplay({ primaryDisplay, displays }: AllDisplayType) {
    return (
        displays.find((display) => {
            return (
                display.id !== primaryDisplay.id &&
                !isVirtualDisplayId(display.id)
            );
        }) ?? primaryDisplay
    );
}

// The screens the presenter keeps, read straight from their setting: this
// module stays a leaf (see `getAllDisplays`), so no screen-manager import.
function readScreenIds(): number[] {
    try {
        const list = JSON.parse(
            getSetting(screenManagerSettingNames.MANAGERS) ?? '[]',
        );
        return Array.isArray(list)
            ? list
                  .map((item) => item?.screenId)
                  .filter((screenId) => Number.isInteger(screenId))
            : [];
    } catch {
        return [];
    }
}

// The display content is SIZED for: a new slide, a song's slides, a web
// page's viewport, a capture. A second monitor wins, as it does for placing a
// screen; with none, a virtual display a screen is set to -- that is the
// output then, and sizing for the operator's own monitor letterboxed every
// song on it (1494x934 inside a 1920x1080 virtual display).
export function getDefaultScreenDisplay() {
    const allDisplays = getAllDisplays();
    const placementDisplay = getPlacementDisplay(allDisplays);
    if (placementDisplay.id !== allDisplays.primaryDisplay.id) {
        return placementDisplay;
    }
    for (const screenId of readScreenIds()) {
        const displayId = Number.parseInt(
            getSetting(`${SCREEN_MANAGER_SETTING_NAME}-pid-${screenId}`) ?? '',
        );
        if (!isVirtualDisplayId(displayId)) {
            continue;
        }
        const display = allDisplays.displays.find((item) => {
            return item.id === displayId;
        });
        if (display !== undefined) {
            return display;
        }
    }
    return placementDisplay;
}

export function getDisplayByScreenId(screenId: number) {
    const displayId = getDisplayIdByScreenId(screenId);
    const allDisplays = getAllDisplays();
    return (
        allDisplays.displays.find((display) => {
            return display.id === displayId;
        }) ?? getPlacementDisplay(allDisplays)
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
    const defaultDisplay = getPlacementDisplay(getAllDisplays());
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
