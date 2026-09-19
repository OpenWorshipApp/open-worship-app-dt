import { getSetting } from '../helper/settingHelpers';
import {
    checkIsVaryAppDocumentFilePathOnScreen,
    getSelectedVaryAppDocument,
} from '../app-document-list/appDocumentHelpers';
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import type BibleItemsViewController from '../bible-reader/BibleItemsViewController';
import { getOnScreenBibleItems } from '../bible-list/bibleHelpers';

export const PRESENT_TAB_SETTING_NAME = 'presenter-tab';
export const PRESENT_FOREGROUND_FLOATING_SETTING_NAME =
    'presenter-foreground-floating';

// The setting holds every open tab's key concatenated (e.g. `db`), so this must
// test for membership, not equality.
export function getIsShowingVaryAppDocumentPreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME)?.includes('d') ?? false;
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
        // Matched by file path so it also resolves a lyric, which is previewed
        // by this tab now.
        const isOnScreen = await checkIsVaryAppDocumentFilePathOnScreen(
            varyAppDocument.filePath,
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
