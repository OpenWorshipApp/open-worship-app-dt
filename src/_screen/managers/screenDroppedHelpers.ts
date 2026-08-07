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
    presetScreenIds: number[] = [],
) {
    const screenIds = await ScreenEventHandler.chooseScreenIds(
        event,
        isForceChoosing,
        presetScreenIds,
    );
    await applyOnScreenIds(screenIds, apply);
}

/**
 * The CHOOSING half on its own — which screens the operator meant, with nothing
 * done to them.
 *
 * For the one caller that has followers but no content: a playlist's
 * `Keyboard Event` shows nothing itself, so unless it runs the resolution, the
 * CC elements riding on it are never told where to land (they read the answer off
 * `captureChosenScreenIds`, and only a resolution publishes one). Going through
 * `applyOnChosenScreens` with an empty `apply` would do the same thing and then
 * toast once per closed screen for work it was never going to do.
 */
export async function chooseScreenIdsOnEvent(
    event: any,
    isForceChoosing = false,
    presetScreenIds: number[] = [],
) {
    return await ScreenEventHandler.chooseScreenIds(
        event,
        isForceChoosing,
        presetScreenIds,
    );
}

/**
 * The doing half above, with the screens already decided.
 *
 * What a FOLLOWER uses — a playlist element's CC elements, which must land on
 * the screens their host resolved to and may not raise a question of their own.
 * Going back through `applyOnChosenScreens` with those ids would only be safe
 * while the list is non-empty: an empty one falls straight through to the
 * selected screens and then to the "which screen?" menu, which is precisely the
 * second question one click may not ask.
 */
export async function applyOnScreenIds(
    screenIds: number[],
    apply: (screenManager: ScreenManager) => void | Promise<void>,
) {
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
    presetScreenIds: number[] = [],
) {
    await applyOnChosenScreens(
        event,
        isForceChoosing,
        (screenManager) => {
            return screenManager.receiveScreenDropped(droppedData);
        },
        presetScreenIds,
    );
}

export async function showDroppedDataOnScreenIds(
    screenIds: number[],
    droppedData: DroppedDataType,
) {
    await applyOnScreenIds(screenIds, (screenManager) => {
        return screenManager.receiveScreenDropped(droppedData);
    });
}
