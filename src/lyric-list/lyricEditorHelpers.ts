import { openPopupEditorWindow } from '../helper/domHelpers';
import appProvider from '../server/appProvider';
import type Lyric from './Lyric';

export function openPopupLyricEditorWindow(lyric: Lyric) {
    const fileFullName = lyric.fileSource.fullName;
    const fileFullNameEncoded = encodeURIComponent(fileFullName);
    const pathName = `${appProvider.lyricEditorHomePage}?file=${fileFullNameEncoded}`;
    return openPopupEditorWindow(pathName);
}
