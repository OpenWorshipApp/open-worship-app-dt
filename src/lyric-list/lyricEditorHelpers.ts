import {
    openPopupWindow,
    setParamFileFullName,
    setParamIdNum,
    setParamKeyValue,
} from '../helper/domHelpers';
import appProvider from '../server/appProvider';
import { dirSourceSettingNames } from '../helper/constants';
import { SESSION_URL_PARAM_NAME } from '../media-sessions/folderSessionHelpers';
import { findNonDefaultSessionIdByFilePath } from '../media-sessions/folderSessionPathHelpers';
import type Lyric from './Lyric';

export function openPopupLyricEditorWindow(lyric: Lyric, slideId?: number) {
    const fileFullName = lyric.fileSource.fullName;
    let pathname = setParamFileFullName(
        appProvider.lyricEditorHomePage,
        fileFullName,
    );
    if (slideId !== undefined) {
        pathname = setParamIdNum(pathname, slideId);
    }
    // A song of another Documents session says which one: the editor finds
    // it by name in that session's folder.
    const sessionId = findNonDefaultSessionIdByFilePath(
        dirSourceSettingNames.APP_DOCUMENT,
        lyric.filePath,
    );
    if (sessionId !== null) {
        pathname = setParamKeyValue(
            pathname,
            SESSION_URL_PARAM_NAME,
            sessionId,
        );
    }
    return openPopupWindow(
        pathname,
        `${fileFullName}_${Date.now()}`,
        'lyric-editor',
    );
}
