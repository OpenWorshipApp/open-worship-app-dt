/**
 * A Bible note's own window: `bibleNote.html?file=<file name>&id=<note id>`
 * -- plus the Bible Notes session it belongs to when that is not the default
 * one, the editor finding the file by name in that session's folder -- as a
 * note row's **Open** opens it (`handleOpening`), and as the help window
 * opens a note the assistant has just made (2026-11-08, the user: _after
 * create should open the note and attach to the chatbot session_), which
 * imports this at that moment only.
 */
import appProvider from '../../server/appProvider';
import { dirSourceSettingNames } from '../../helper/constants';
import {
    openPopupWindow,
    setParamFileFullName,
    setParamIdNum,
    setParamKeyValue,
} from '../../helper/domHelpers';
import { SESSION_URL_PARAM_NAME } from '../../media-sessions/folderSessionHelpers';
import { findNonDefaultSessionIdByFilePath } from '../../media-sessions/folderSessionPathHelpers';

/** The address of one note's window. */
export function genNoteWindowPathname(
    fileFullName: string,
    filePath: string,
    noteId: number,
) {
    let pathname = setParamFileFullName(
        appProvider.bibleNoteHomePage,
        fileFullName,
    );
    pathname = setParamIdNum(pathname, noteId);
    // A note of another Bible Notes session says which one.
    const sessionId = findNonDefaultSessionIdByFilePath(
        dirSourceSettingNames.BIBLE_NOTES,
        filePath,
    );
    if (sessionId !== null) {
        pathname = setParamKeyValue(
            pathname,
            SESSION_URL_PARAM_NAME,
            sessionId,
        );
    }
    return pathname;
}

/** Opens one note in its own window: `fileFullName` is its file's name. */
export function openNoteWindow(
    fileFullName: string,
    filePath: string,
    noteId: number,
) {
    return openPopupWindow(
        genNoteWindowPathname(fileFullName, filePath, noteId),
        `${fileFullName}-${noteId}_${Date.now()}`,
        crypto.randomUUID(),
        {
            width: 870,
        },
    );
}
