import FileSource from '../../helper/FileSource';
import { handleError } from '../../helper/errorHelpers';
import { tran } from '../../lang/langHelpers';
import { getMimetypeExtensions, pathJoin } from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import type { PublicDomainSongType } from './publicDomainSongsData';
import {
    publicDomainSongToMarkdown,
    sanitizeFileName,
} from './publicDomainSongsHelpers';

export async function importPublicDomainSongToDirectory(
    dirPath: string,
    song: PublicDomainSongType,
): Promise<boolean> {
    const title = tran('Import From Public Domain Songs');
    try {
        const markdown = publicDomainSongToMarkdown(song);
        if (markdown === null) {
            showSimpleToast(title, tran('This song has no lyrics to import'));
            return false;
        }
        const fileName = sanitizeFileName(song.title);
        const extension = getMimetypeExtensions('lyric')[0];
        // Pre-resolve a collision-free name so repeated imports land side by
        // side instead of failing on the existing file.
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
            showSimpleToast(title, tran('Failed to create lyric document'));
            return false;
        }
        fileSource.fireUpdateEvent();
        showSimpleToast(title, tran('Lyric document created successfully'));
        return true;
    } catch (error) {
        handleError(error);
        showSimpleToast(title, tran('Failed to create lyric document'));
        return false;
    }
}
