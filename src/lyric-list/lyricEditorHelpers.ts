import { openPopupWindow } from '../helper/domHelpers';
import appProvider from '../server/appProvider';
import type Lyric from './Lyric';

export function openPopupLyricEditorWindow(lyric: Lyric) {
    const fileFullName = lyric.fileSource.fullName;
    const fileFullNameEncoded = encodeURIComponent(fileFullName);
    const url = `${appProvider.lyricEditorHomePage}?file=${fileFullNameEncoded}`;
    return openPopupWindow(
        url,
        `${fileFullName}_${Date.now()}`,
        crypto.randomUUID(),
    );
}
