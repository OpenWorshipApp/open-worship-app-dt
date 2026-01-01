import appProvider from '../server/appProvider';
import Lyric from './Lyric';

const WINDOW_FEATURES =
    'popup,top=0,left=0,width=400,height=400,scrollbars=yes,' +
    'toolbar=no,location=no,status=no,menubar=no';

export function openPopupLyricEditorWindow(lyric: Lyric) {
    const fileFullName = lyric.fileSource.fullName;
    const fileFullNameEncoded = encodeURIComponent(fileFullName);
    const pathName = `${appProvider.lyricEditorHomePage}?lyric=${fileFullNameEncoded}`;
    return window.open(pathName, 'popup_window', WINDOW_FEATURES);
}
