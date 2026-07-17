import { openPopupWindow, setParamFileFullName } from '../helper/domHelpers';
import appProvider from '../server/appProvider';
import type Lyric from './Lyric';

export function openPopupLyricEditorWindow(lyric: Lyric) {
    const fileFullName = lyric.fileSource.fullName;
    const pathname = setParamFileFullName(
        appProvider.lyricEditorHomePage,
        fileFullName,
    );
    return openPopupWindow(
        pathname,
        `${fileFullName}_${Date.now()}`,
        crypto.randomUUID(),
    );
}
