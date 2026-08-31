import type {
    ArchiveFileCollector,
    ArchiveFileKindType,
} from '../../helper/appArchiveHelpers';
import { handleError } from '../../helper/errorHelpers';
import FileSource from '../../helper/FileSource';
import type { SingleItemArchiveConfigType } from '../../helper/singleItemArchiveHelpers';
import {
    askAndImportSingleItemArchiveFromUrl,
    checkIsSingleItemArchiveFileFullName,
    createSingleItemArchive,
    exportSingleItem,
    importDroppedSingleItemArchive,
    importSingleItemArchive,
    selectAndImportSingleItemArchive,
} from '../../helper/singleItemArchiveHelpers';
import type { DroppedFileType } from '../../others/droppingFileHelpers';
import {
    ensureDirectory,
    fsCreateFile,
    fsReadFile,
} from '../../server/fileHelpers';
import { appLocalStorage } from '../../setting/directory-setting/appLocalStorage';
import {
    collectLexicalAppFilePaths,
    parseJson,
    rewriteLexicalAppFilePaths,
} from './noteEmbeddedFileHelpers';

/**
 * A whole bible note file (`.own`) as a self-contained `.owanote.tar.gz`
 * bundle, using the same generic single-item bundle as a document
 * (`src/helper/singleItemArchiveHelpers.ts`).
 *
 * This is the FILE-level bundle. The item-level one
 * (`bibleNoteItemArchiveHelpers.ts`, `.owabn.tar.gz`) moves a single note item
 * into an existing note file; this one moves the file itself, with every item
 * it holds, into the Bible Notes list.
 *
 * What rides along beyond what the shared collector already takes (the file
 * verbatim plus the background attached to it through its `.bg.json` sidecar):
 * the images a note item embeds in its Lexical content. Those live in the app's
 * temp-files folder rather than in any dir-source folder, so they travel as
 * their own `note-asset` kind whose destination is preset below.
 */

const NOTE_ASSET_KIND: ArchiveFileKindType = 'note-asset';

export const BIBLE_NOTE_ARCHIVE_DOT_EXTENSION = '.owanote.tar.gz';

/**
 * Every embedded path across every item of the note.
 *
 * The file is walked as RAW JSON rather than through `Note`/`NoteItem`: the
 * `Note.items` setter rebuilds every item through `NoteItem.toJson()`, so any
 * field those classes do not carry would be dropped on the way back out — and
 * loading the note model from here would close a module cycle besides.
 */
async function readNoteItemContents(filePath: string) {
    try {
        const jsonData = parseJson(await fsReadFile(filePath)) as {
            items?: unknown;
        } | null;
        if (jsonData === null || !Array.isArray(jsonData.items)) {
            return null;
        }
        return jsonData as { items: { content?: unknown }[] };
    } catch (error) {
        handleError(error);
        return null;
    }
}

export async function collectNoteEmbeddedFiles(
    collector: ArchiveFileCollector,
    filePath: string,
) {
    const jsonData = await readNoteItemContents(filePath);
    if (jsonData === null) {
        return;
    }
    for (const item of jsonData.items) {
        if (typeof item?.content !== 'string') {
            continue;
        }
        for (const embeddedFilePath of collectLexicalAppFilePaths(
            item.content,
        )) {
            // A missing file is skipped rather than fatal: an item can point at
            // an image the operator has already deleted, and losing that one
            // picture is a far better outcome than refusing to export the note.
            await collector.addFile(embeddedFilePath, NOTE_ASSET_KIND);
        }
    }
}

async function getNoteAssetDirPaths() {
    const tmpFilesDir = appLocalStorage.tmpFilesDir;
    await ensureDirectory(tmpFilesDir);
    return new Map<ArchiveFileKindType, string>([
        [NOTE_ASSET_KIND, tmpFilesDir],
    ]);
}

/**
 * Re-point the imported note's items at the local copies of their images. The
 * note arrives holding the exporting machine's absolute paths, so without this
 * every embedded picture renders broken even though it was bundled.
 */
export async function applyImportedNoteEmbeddedFiles(
    itemFilePath: string,
    localFilePathByOriginalPath: Map<string, string>,
) {
    const jsonData = await readNoteItemContents(itemFilePath);
    if (jsonData === null) {
        return;
    }
    let isChanged = false;
    for (const item of jsonData.items) {
        if (typeof item?.content !== 'string') {
            continue;
        }
        const newContent = rewriteLexicalAppFilePaths(
            item.content,
            localFilePathByOriginalPath,
        );
        if (newContent === item.content) {
            continue;
        }
        item.content = newContent;
        isChanged = true;
    }
    if (!isChanged) {
        return;
    }
    await fsCreateFile(itemFilePath, JSON.stringify(jsonData), true);
    FileSource.getInstance(itemFilePath).fireUpdateEvent();
}

const CONFIG: SingleItemArchiveConfigType = {
    itemKind: 'note',
    dotExtension: BIBLE_NOTE_ARCHIVE_DOT_EXTENSION,
    fallbackName: 'Bible Note',
    workDirPrefix: 'owanote',
    exportTitle: 'Export Bible Note',
    importTitle: 'Import Bible Note',
    urlLabel: 'Bible Note Archive URL:',
    itemLabel: 'bible note',
    collectExtraFiles: collectNoteEmbeddedFiles,
    getExtraPresetDirPaths: getNoteAssetDirPaths,
    applyImportedExtraFiles: applyImportedNoteEmbeddedFiles,
};

export function checkIsBibleNoteArchiveFileFullName(fileFullName: string) {
    return checkIsSingleItemArchiveFileFullName(fileFullName, CONFIG);
}

export function createBibleNoteArchive(
    filePath: string,
    password: string | null = null,
) {
    return createSingleItemArchive(filePath, CONFIG, password);
}

export function exportBibleNote(filePath: string) {
    return exportSingleItem(filePath, CONFIG);
}

export function importBibleNoteArchive(archiveFilePath: string) {
    return importSingleItemArchive(archiveFilePath, CONFIG);
}

export function selectAndImportBibleNoteArchive() {
    return selectAndImportSingleItemArchive(CONFIG);
}

export function askAndImportBibleNoteArchiveFromUrl() {
    return askAndImportSingleItemArchiveFromUrl(CONFIG);
}

export function importDroppedBibleNoteArchive(file: DroppedFileType) {
    return importDroppedSingleItemArchive(file, CONFIG);
}
