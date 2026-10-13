import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { dirSourceSettingNames } from '../helper/constants';
import DirSource from '../helper/DirSource';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import { getFileName, pathBasename } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    getLongTextLangCodes,
    toLongTextLanguageLabel,
} from './foregroundLongTextLangHelpers';

// The two choices a Long Text Show card is made of, each a menu at the cursor
// that answers with what was picked -- or with null when it was put away.

function showChoosingMenu<T>(
    event: any,
    genMenuItems: (choose: (value: T) => void) => ContextMenuItemType[],
) {
    return new Promise<T | null>((resolve) => {
        const menuItems = genMenuItems(resolve);
        // Put away without a pick: the second `resolve` after a pick is
        // ignored, so this only ever answers the dismissed menu.
        showAppContextMenu(event, menuItems, {
            shouldAutoFocusContainer: true,
        }).promiseDone.then(() => {
            resolve(null);
        });
    });
}

/**
 * A language for a card. The ones the session already has are left out: a
 * language is in a session once, and a menu that offered it again would only
 * be offering a refusal.
 */
export function chooseLongTextLangCode(event: any, usedLangCodes: string[]) {
    return showChoosingMenu<string>(event, (choose) => {
        return getLongTextLangCodes()
            .filter((langCode) => {
                return !usedLangCodes.includes(langCode);
            })
            .map((langCode) => {
                return {
                    menuElement: toLongTextLanguageLabel(langCode),
                    onSelect: () => {
                        choose(langCode);
                    },
                };
            });
    });
}

/**
 * The lyric files of the Documents folder, and only those. The folder's own
 * list counts a PDF, a PowerPoint and a Word file in whatever it is asked for
 * (`checkExtraFile`, set by the Documents panel), so this asks without that:
 * the menu offered `Doxology.pptx` as a song, and it could not be read.
 */
async function listLyricFilePaths() {
    try {
        const dirSource = await DirSource.getInstance(
            dirSourceSettingNames.APP_DOCUMENT,
        );
        if (!dirSource.dirPath) {
            return [];
        }
        return await dirSource.getFilePathsQuick('lyric', true);
    } catch (error) {
        handleError(error);
        return [];
    }
}

/**
 * A lyric file of the Documents folder, where the songs are kept. Listed when
 * asked for and not before: the folder is read for this menu, not watched.
 */
export async function chooseLyricFilePath(event: any, currentFilePath: string) {
    const filePaths = await listLyricFilePaths();
    if (filePaths.length === 0) {
        showSimpleToast(
            tran('Choose Lyric'),
            tran('No lyric file in the Documents folder'),
        );
        return null;
    }
    return showChoosingMenu<string>(event, (choose) => {
        return filePaths.map((filePath) => {
            return {
                childBefore: genContextMenuItemIcon(
                    filePath === currentFilePath ? 'check2' : 'music-note',
                ),
                menuElement: getFileName(pathBasename(filePath)),
                title: filePath,
                onSelect: () => {
                    choose(filePath);
                },
            };
        });
    });
}
