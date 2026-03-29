import { getSetting } from '../helper/settingHelpers';
import {
    checkIsVaryAppDocumentOnScreen,
    getSelectedVaryAppDocument,
} from '../app-document-list/appDocumentHelpers';
import LyricAppDocument from '../lyric-list/LyricAppDocument';
import { getSelectedLyric } from '../lyric-list/lyricHelpers';
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import type BibleItemsViewController from '../bible-reader/BibleItemsViewController';
import { getOnScreenBibleItems } from '../bible-list/bibleHelpers';

export const PRESENT_TAB_SETTING_NAME = 'presenter-tab';

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
        const lyricAppDocument = LyricAppDocument.getInstanceFromLyricFilePath(
            selectedLyric.filePath,
        );
        if (lyricAppDocument === null) {
            return false;
        }
        const isOnScreen =
            await checkIsVaryAppDocumentOnScreen(lyricAppDocument);
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
