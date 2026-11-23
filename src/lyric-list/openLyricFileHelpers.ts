import type Lyric from './Lyric';
import FileSource from '../helper/FileSource';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import type { DroppedFileType } from '../others/droppingFileHelpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import {
    fsReadFile,
    fsWriteFile,
    getAvailableFileName,
    getDownloadPath,
    getFileFullName,
    getMimetypeExtensions,
    pathJoin,
    toPortableFileName,
} from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { OPEN_LYRIC_FILE_DOT_EXTENSION } from './openLyricFileNameHelpers';

/*
 * The app keeps its songs as `.owl` (the same Open Lyric Markdown inside the
 * JSON that carries the song's metadata and stage setting), so a `.ol.md` is
 * never listed or opened as it is: one dropped on, or added to, the Documents
 * list becomes a `.owl` beside the others, and a `.owl` goes back out through
 * its row's "Export to Open Lyric File". Loaded only when one of the two
 * happens.
 */

const FALLBACK_SONG_NAME = 'Lyric';

/** `Amazing Grace.ol.md` -> `Amazing Grace`, safe to name a file with. */
export function toOpenLyricFileSongName(fileFullName: string) {
    return toPortableFileName(
        fileFullName.slice(0, -OPEN_LYRIC_FILE_DOT_EXTENSION.length),
        FALLBACK_SONG_NAME,
    );
}

/** The song's Markdown as the `.owl` keeps it: no BOM, `\n` line ends. */
export function toOpenLyricContent(text: string) {
    return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

async function readOpenLyricFileText(file: DroppedFileType) {
    if (typeof file === 'string') {
        return await fsReadFile(file);
    }
    return await file.text();
}

async function importOpenLyricFileNow(file: DroppedFileType, dirPath: string) {
    const fileFullName = getFileFullName(file) ?? '';
    const content = toOpenLyricContent(await readOpenLyricFileText(file));
    if (content.trim() === '') {
        throw new Error(`Empty Open Lyric file: ${fileFullName}`);
    }
    const dotExtension = `.${getMimetypeExtensions('lyric')[0]}`;
    const name = await getAvailableFileName(
        dirPath,
        toOpenLyricFileSongName(fileFullName),
        dotExtension,
    );
    // Dynamic on purpose, as in the other song imports: importing Lyric
    // statically from the documents list can close an import cycle through
    // the app-document helpers.
    const { default: LyricClass } = await import('./Lyric');
    const fileSource = await LyricClass.createWithContent(
        dirPath,
        name,
        content,
    );
    if (fileSource === null) {
        throw new Error(`Unable to create a lyric from: ${fileFullName}`);
    }
    fileSource.fireUpdateEvent();
}

// One file at a time, however many were dropped: a hymnal's worth at once
// would otherwise read every file into memory together and race each other
// for the same free name. One toast for the whole run, not one per song.
let importChain: Promise<void> = Promise.resolve();
let pendingCount = 0;
let createdCount = 0;
let failedNames: string[] = [];

function showImportResult() {
    const title = tran('Import');
    if (createdCount > 0) {
        showSimpleToast(
            title,
            `${tran('Lyric document created successfully')} (${createdCount})`,
        );
    }
    if (failedNames.length > 0) {
        showSimpleToast(
            title,
            `${tran('Failed to create lyric document')}: ${failedNames.join(', ')}`,
        );
    }
    createdCount = 0;
    failedNames = [];
}

/**
 * Converts a `.ol.md` into a `.owl` in `dirPath`. The Open Lyric file itself
 * is only read, never copied or changed.
 */
export function importOpenLyricFile(file: DroppedFileType, dirPath: string) {
    pendingCount++;
    importChain = importChain.then(async () => {
        try {
            await importOpenLyricFileNow(file, dirPath);
            createdCount++;
        } catch (error) {
            handleError(error);
            failedNames.push(getFileFullName(file) ?? '');
        } finally {
            pendingCount--;
            if (pendingCount === 0) {
                showImportResult();
            }
        }
    });
    return importChain;
}

/**
 * Writes the song's Markdown, as it is now in the app, to
 * `<Downloads>/<song>.ol.md` and shows it in the file explorer.
 */
export async function exportLyricToOpenLyricFile(lyric: Lyric) {
    const title = tran('Export to Open Lyric File');
    try {
        const content = await lyric.getContent();
        const dirPath = getDownloadPath();
        const name = await getAvailableFileName(
            dirPath,
            toPortableFileName(
                FileSource.getInstance(lyric.filePath).name,
                FALLBACK_SONG_NAME,
            ),
            OPEN_LYRIC_FILE_DOT_EXTENSION,
        );
        const filePath = await fsWriteFile(
            pathJoin(dirPath, `${name}${OPEN_LYRIC_FILE_DOT_EXTENSION}`),
            content,
        );
        // `showSimpleToast` does not translate; the path goes on AFTER the
        // translation, never into the key.
        showSimpleToast(title, `${tran('Exported to')} ${filePath}`);
        showFileOrDirExplorer(filePath);
        return filePath;
    } catch (error) {
        handleError(error);
        return null;
    }
}
