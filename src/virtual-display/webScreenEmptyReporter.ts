import { getScreenManagerByScreenId } from '../_screen/managers/screenManagerHelpers';
import type ScreenManager from '../_screen/managers/ScreenManager';
import { VD_SCREEN_STATE_MESSAGE } from './viewerMessages';

// A screen of a virtual display drawn in a browser tells the viewer page
// holding it (its parent, same origin) whether it shows anything at all, so
// a display with nothing on it says so instead of showing a bare wallpaper.
// Told once, then again only when that changes -- on its layers' own update
// events, nothing polled.

// The screen page mounts its manager on its first render; it is looked for
// that long, a frame at a time.
const MAX_WAIT_FRAMES = 600;

function checkIsEmpty(screenManager: ScreenManager) {
    return ![
        screenManager.screenBackgroundManager,
        screenManager.screenVaryAppDocumentManager,
        screenManager.screenBibleManager,
        screenManager.screenForegroundManager,
        screenManager.screenDrawManager,
        screenManager.screenFocusManager,
    ].some((manager) => manager.isShowing);
}

function watch(screenManager: ScreenManager) {
    let lastIsEmpty: boolean | null = null;
    const report = () => {
        const isEmpty = checkIsEmpty(screenManager);
        if (isEmpty === lastIsEmpty) {
            return;
        }
        lastIsEmpty = isEmpty;
        globalThis.parent.postMessage(
            {
                type: VD_SCREEN_STATE_MESSAGE,
                screenId: screenManager.screenId,
                isEmpty,
            },
            globalThis.location.origin,
        );
    };
    for (const manager of [
        screenManager.screenBackgroundManager,
        screenManager.screenVaryAppDocumentManager,
        screenManager.screenBibleManager,
        screenManager.screenForegroundManager,
        screenManager.screenDrawManager,
        screenManager.screenFocusManager,
    ]) {
        manager.registerEventListener(['update'], report);
    }
    report();
}

export function reportScreenEmptiness(screenId: number) {
    if (globalThis.parent === globalThis.window) {
        return;
    }
    let frames = 0;
    const find = () => {
        const screenManager = getScreenManagerByScreenId(screenId);
        if (screenManager !== null) {
            watch(screenManager);
        } else if (frames++ < MAX_WAIT_FRAMES) {
            requestAnimationFrame(find);
        }
    };
    find();
}
