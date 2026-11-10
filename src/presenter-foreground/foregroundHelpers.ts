import ScreenForegroundManager, {
    type ForegroundSessionListKeyType,
} from '../_screen/managers/ScreenForegroundManager';
import { getForegroundDataListOnScreenSetting } from '../_screen/screenHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    getAllScreenManagers,
    getScreenManagerByKey,
    getScreenManagerByScreenId,
} from '../_screen/managers/screenManagerHelpers';
import type {
    ForegroundDataType,
    ForegroundSrcListType,
} from '../_screen/screenTypeHelpers';

export function getForegroundShowingScreenIdDataList(
    filterFunc: (
        data: ForegroundDataType,
        allForegroundDataList: ForegroundSrcListType,
    ) => boolean,
) {
    const allForegroundDataList = getForegroundDataListOnScreenSetting();
    const showingScreenIdDataList = Object.entries(allForegroundDataList)
        .map(([key, data]): [number, ForegroundDataType] => {
            return [
                Number.parseInt(key),
                ScreenForegroundManager.parseAllForegroundData(data),
            ];
        })
        .filter(([_, data]) => {
            return filterFunc(data, allForegroundDataList);
        });
    return showingScreenIdDataList;
}

/**
 * Every overlay of one per-session kind on the screens, one `[screenId, item]`
 * row per SESSION's overlay: two sessions up on one screen are two rows, each
 * marked on its own tab and taken down by its own Hide.
 */
export function getForegroundSessionShowingList<
    K extends ForegroundSessionListKeyType,
>(key: K): [number, ForegroundDataType[K][number]][] {
    return getForegroundShowingScreenIdDataList((data) => {
        return data[key].length > 0;
    }).flatMap(([screenId, data]) => {
        return data[key].map(
            (item): [number, ForegroundDataType[K][number]] => {
                return [screenId, item];
            },
        );
    });
}

export function getScreenForegroundManagerInstances(
    screenId: number,
    callback: (screenForegroundManager: ScreenForegroundManager) => void,
) {
    const screenManager = getScreenManagerByScreenId(screenId);
    if (screenManager === null) {
        showSimpleToast('ScreenManager not found', 'error');
        return;
    }
    const { screenForegroundManager } = screenManager;
    callback(screenForegroundManager);
}

export function getIsAnyForegroundShowing() {
    return getAllScreenManagers().some((screenManager) => {
        return screenManager.screenForegroundManager.isShowing;
    });
}

export function getScreenForegroundManagerByDropped(event: any) {
    const target = event.currentTarget;
    if (
        target instanceof HTMLElement &&
        target.dataset.screenKey !== undefined
    ) {
        const screenManager = getScreenManagerByKey(target.dataset.screenKey);
        if (screenManager !== null) {
            return screenManager.screenForegroundManager;
        }
    }
    return null;
}
