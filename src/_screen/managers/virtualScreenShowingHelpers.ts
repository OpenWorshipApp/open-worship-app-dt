import { getSetting, setSetting } from '../../helper/settingHelpers';
import appProvider from '../../server/appProvider';
import { isVirtualDisplayId } from '../../../electron/virtualDisplayProtocol';
import { SCREEN_MANAGER_SETTING_NAME } from './screenHelpers';

// A screen on a virtual display has no window and nobody in the room sees it
// go: the people watching it from a phone, a TV or a stream do. It used to
// come back HIDDEN after every restart of the app -- each viewer left on the
// wallpaper until somebody noticed and pressed show again (asked for
// 2026-10-08: "it should remember showing screen, so even reload it still
// have content showing"). So the presenter keeps which of them were showing,
// and the next start puts those up again. A screen on a real monitor is left
// as it always was: a window appearing over a projector by itself is not a
// thing to do to a room.
export const VIRTUAL_SCREENS_SHOWING_SETTING_NAME =
    'virtual-display-showing-screens';

export type ShowingScreenType = {
    screenId: number;
    isShowing: boolean;
};

export function readVirtualScreensShowing(): number[] {
    try {
        const ids = JSON.parse(
            getSetting(VIRTUAL_SCREENS_SHOWING_SETTING_NAME) ?? '[]',
        );
        return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
    } catch {
        return [];
    }
}

// The display a screen is SET to, as stored: no display lookup, so it is
// cheap enough to read for every screen on every show and hide.
function checkIsSetToVirtualDisplay(screenId: number) {
    const stored = Number.parseInt(
        getSetting(`${SCREEN_MANAGER_SETTING_NAME}-pid-${screenId}`) ?? '',
    );
    return isVirtualDisplayId(stored);
}

// Nothing is written before the start has put the remembered screens up:
// a screen hiding as the app comes up must not wipe the list first.
let isRestoreDone = false;

export function rememberVirtualScreensShowing(screens: ShowingScreenType[]) {
    if (!appProvider.isPagePresenter || !isRestoreDone) {
        return;
    }
    const ids = screens
        .filter(({ screenId, isShowing }) => {
            return isShowing && checkIsSetToVirtualDisplay(screenId);
        })
        .map(({ screenId }) => screenId)
        .sort((a, b) => a - b);
    const text = JSON.stringify(ids);
    if ((getSetting(VIRTUAL_SCREENS_SHOWING_SETTING_NAME) ?? '[]') !== text) {
        setSetting(VIRTUAL_SCREENS_SHOWING_SETTING_NAME, text);
    }
}

// Every screen hidden on purpose at once (the Reader does it): none of them
// is to come back by itself.
export function forgetVirtualScreensShowing() {
    if (readVirtualScreensShowing().length > 0) {
        setSetting(VIRTUAL_SCREENS_SHOWING_SETTING_NAME, '[]');
    }
}

// Once per start of the presenter: each remembered screen still on a virtual
// display that exists, and not up already (a reload of the window keeps them
// up), is shown the way its show button does it.
export function restoreVirtualScreensShowing(
    screens: (ShowingScreenType & {
        displayId: number;
        show: () => void;
    })[],
) {
    if (!appProvider.isPagePresenter || isRestoreDone) {
        return [];
    }
    isRestoreDone = true;
    const ids = readVirtualScreensShowing();
    const shown: number[] = [];
    for (const screen of screens) {
        if (
            ids.includes(screen.screenId) &&
            !screen.isShowing &&
            isVirtualDisplayId(screen.displayId)
        ) {
            screen.show();
            shown.push(screen.screenId);
        }
    }
    return shown;
}
