import type { DroppedDataType } from '../../helper/DragInf';
import { showSimpleToast } from '../../toast/toastHelpers';
import ScreenEventHandler from './ScreenEventHandler';
import type ScreenManager from './ScreenManager';
import { getScreenManagerByScreenId } from './screenManagerHelpers';

/**
 * Do something to the screens the operator meant: the selected ones, or the ones
 * a menu asks about. Everything a click, a menu entry or a key aims at a screen
 * goes through here, so "which screens" is answered in exactly one place — what
 * differs between callers is only the doing.
 *
 * Every screen is handed its work before anything is awaited, so a second screen
 * never waits on the first one's render. Awaiting them together afterwards is
 * what lets a caller run its follow-up work knowing the content is already
 * there — dropping the promises made every such caller read the previous, stale
 * state.
 */
export async function applyOnChosenScreens(
    event: any,
    isForceChoosing: boolean,
    apply: (screenManager: ScreenManager) => void | Promise<void>,
) {
    const screenIds = await ScreenEventHandler.chooseScreenIds(
        event,
        isForceChoosing,
    );
    const applyingList: (void | Promise<void>)[] = [];
    for (const screenId of screenIds) {
        const screenManager = getScreenManagerByScreenId(screenId);
        if (screenManager === null) {
            // An operator whose screen is closed has to be told, not left with
            // something that looks like it did nothing.
            showSimpleToast(
                'Failed to apply to screen. Please make sure the screen is open.',
                'error',
            );
            continue;
        }
        applyingList.push(apply(screenManager));
    }
    await Promise.all(applyingList);
}

// Clicking a playlist row and dropping the same row on a screen must do exactly
// the same thing, so both go through `receiveScreenDropped`. Only the screen
// choice differs: a drop names its screen, a click asks (or uses the selected
// screens) via `chooseScreenIds`.
export async function showDroppedDataOnScreens(
    event: any,
    droppedData: DroppedDataType,
    isForceChoosing = false,
) {
    await applyOnChosenScreens(event, isForceChoosing, (screenManager) => {
        return screenManager.receiveScreenDropped(droppedData);
    });
}
