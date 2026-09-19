import FileSource from '../../helper/FileSource';
import { handleError } from '../../helper/errorHelpers';
import { tran } from '../../lang/langHelpers';
import { getMimetypeExtensions, pathJoin } from '../../server/fileHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import type { SongSelectSearchRecordType } from './songSelectApiHelpers';
import {
    getSongLyrics,
    toSongSelectErrorMessageKey,
} from './songSelectApiHelpers';

export async function importSongSelectSongToDirectory(
    dirPath: string,
    record: SongSelectSearchRecordType,
): Promise<boolean> {
    const title = tran('Import From SongSelect');
    const progressKey = `song-select-import-${record.id}`;
    showProgressBar(progressKey);
    try {
        const lyricsData = await getSongLyrics(record.id);
        // The open-lyric mapping is heavy; load it only when a song is
        // actually downloaded.
        const { sanitizeFileName, songSelectLyricsToMarkdown } =
            await import('./songSelectLyricHelpers');
        const markdown = songSelectLyricsToMarkdown(lyricsData);
        if (markdown === null) {
            showSimpleToast(title, tran('This song has no lyrics to import'));
            return false;
        }
        const fileName = sanitizeFileName(lyricsData.title || record.title);
        const extension = getMimetypeExtensions('lyric')[0];
        // Pre-resolve a collision-free name: `createNewFileDetail` would
        // reject an existing file (with a wrongly-titled toast), and the
        // suffixed name keeps repeated imports side by side.
        const filePath = pathJoin(dirPath, `${fileName}.${extension}`);
        const uniqueFilePath =
            await FileSource.getInstance(filePath).genNextFilePath();
        const uniqueName = FileSource.getInstance(uniqueFilePath).name;
        // Dynamic on purpose: importing Lyric statically from here can close
        // an import cycle through the app-document helpers.
        const { default: Lyric } = await import('../../lyric-list/Lyric');
        const fileSource = await Lyric.createWithContent(
            dirPath,
            uniqueName,
            markdown,
        );
        if (fileSource === null) {
            showSimpleToast(title, tran('SongSelect request failed'));
            return false;
        }
        fileSource.fireUpdateEvent();
        showSimpleToast(title, tran('Lyric document created successfully'));
        return true;
    } catch (error) {
        handleError(error);
        showSimpleToast(title, tran(toSongSelectErrorMessageKey(error)));
        return false;
    } finally {
        hideProgressBar(progressKey);
    }
}
