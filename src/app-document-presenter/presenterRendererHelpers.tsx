import { getSetting } from '../helper/settingHelpers';
import {
    checkIsVaryAppDocumentFilePathOnScreen,
    checkIsVaryAppDocumentOnScreen,
    getSelectedVaryAppDocument,
} from '../app-document-list/appDocumentHelpers';
import { getSelectedLyric } from '../lyric-list/lyricHelpers';
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import type BibleItemsViewController from '../bible-reader/BibleItemsViewController';
import { getOnScreenBibleItems } from '../bible-list/bibleHelpers';

export const PRESENT_TAB_SETTING_NAME = 'presenter-tab';
export const PRESENT_FOREGROUND_FLOATING_SETTING_NAME =
    'presenter-foreground-floating';

export function getIsShowingVaryAppDocumentPreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'd';
}
export function getIsShowingLyricPreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'l';
}
export function getIsShowingBiblePreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'f';
}

export async function checkIsOnScreen<T>(
    targeKey: T,
    viewController: BibleItemsViewController,
) {
    if (targeKey === 'd') {
        const varyAppDocument = await getSelectedVaryAppDocument();
        if (varyAppDocument === null) {
            return false;
        }
        const isOnScreen =
            await checkIsVaryAppDocumentOnScreen(varyAppDocument);
        return isOnScreen;
    } else if (targeKey === 'l') {
        const selectedLyric = await getSelectedLyric();
        if (selectedLyric === null) {
            return false;
        }
        const isOnScreen = await checkIsVaryAppDocumentFilePathOnScreen(
            selectedLyric.filePath,
        );
        return isOnScreen;
    } else if (targeKey === 'f') {
        const allScreenManager = getAllScreenManagers();
        return allScreenManager.some((screenManager) => {
            return screenManager.screenForegroundManager.isShowing;
        });
    } else if (targeKey === 'b') {
        const titleList = await getOnScreenBibleItems();
        const bibleItems = viewController.straightBibleItems;
        for (const bibleItem of bibleItems) {
            const title = await bibleItem.toTitle();
            if (titleList.includes(title)) {
                return true;
            }
        }
    }
    return false;
}
