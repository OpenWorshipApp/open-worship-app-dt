import {
    openPopupWindow,
    setParamFileFullName,
    setParamIdNum,
} from '../helper/domHelpers';
import appProvider from '../server/appProvider';
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
    return openPopupWindow(
        pathname,
        `${fileFullName}_${Date.now()}`,
        'lyric-editor',
    );
}
